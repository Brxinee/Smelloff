/* Smelloff customer accounts — phone-OTP session client.
 *
 * Deliberately hand-rolled against the Supabase REST endpoints instead of
 * pulling in supabase-js: the site's CSP is `script-src 'self'` (plus GTM and
 * the Meta Pixel), so a CDN bundle would be blocked outright, and the whole
 * surface we need is four endpoints. Same vanilla style as the rest of
 * /assets/js — no build step, no framework.
 *
 * Session shape in localStorage (smelloff_auth_v1):
 *   { access_token, refresh_token, expires_at (epoch seconds), user }
 *
 * The access token is short-lived (1h by default) and is refreshed on demand by
 * token(), so every caller should await it rather than caching the string.
 *
 * Public API — window.SmelloffAuth:
 *   sendOtp(phone)            → Promise<void>       ask for a code
 *   verifyOtp(phone, code)    → Promise<user>       exchange code for a session
 *   token()                   → Promise<string|null> fresh access token
 *   user()                    → object|null         cached user
 *   phone()                   → string              verified 10-digit number
 *   isSignedIn()              → boolean             (may still need a refresh)
 *   signOut()                 → Promise<void>
 *   rest(path, opts)          → Promise<any>        authenticated PostgREST call
 *   fn(name, body)            → Promise<any>        authenticated edge function
 *   onReady(cb)               → cb(user|null) once the session is resolved
 */
(function (w) {
  'use strict';

  var CFG = w.SMELLOFF_CONFIG || {};
  var URL_BASE = CFG.SUPABASE_URL || 'https://tnuqjydmoxczdjnsgpci.supabase.co';
  var ANON_KEY = CFG.SUPABASE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXFqeWRtb3hjemRqbnNncGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzI2NDgsImV4cCI6MjA5MzEwODY0OH0.6qyyo-1lpntK7FC3H9j_oqWp0W_R1XydVG_IxVUd6F4';

  var KEY = 'smelloff_auth_v1';
  var COUNTRY = '91';
  // Refresh this many seconds before the token actually expires, so a request
  // can't die in flight on a token that lapsed mid-round-trip.
  var SKEW = 60;

  var session = null;
  var refreshing = null; // in-flight refresh, shared by concurrent callers

  // ---- storage ------------------------------------------------------------

  function load() {
    try {
      var raw = w.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; } // private mode / storage disabled
  }

  function save(s) {
    session = s;
    try {
      if (s) w.localStorage.setItem(KEY, JSON.stringify(s));
      else w.localStorage.removeItem(KEY);
    } catch (e) { /* session stays in memory for this page at least */ }
  }

  session = load();

  // ---- helpers ------------------------------------------------------------

  // Accepts "9876543210", "+91 98765 43210", "09876543210" → "919876543210".
  function e164(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.length > 10) d = d.slice(-10);
    return d.length === 10 ? COUNTRY + d : '';
  }

  function local10(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  // Supabase error payloads vary by endpoint/version; pull the useful bits and
  // translate the ones a shopper can actually act on.
  function messageFor(payload, fallback) {
    var code = (payload && (payload.error_code || payload.code || payload.error)) || '';
    var msg = (payload && (payload.msg || payload.message || payload.error_description)) || '';

    // Our edge functions answer with { error: "a human sentence" }, while GoTrue
    // uses `error` for a machine code alongside `error_description`. Fall back to
    // `error` as the message only when nothing better is present — otherwise the
    // useful text ("already dispatched…") gets swallowed by the generic fallback.
    if (!msg && payload && typeof payload.error === 'string' && !payload.error_code) {
      msg = payload.error;
    }

    if (code === 'phone_provider_disabled') {
      return 'Phone sign-in isn’t switched on yet. Please use WhatsApp to reach us in the meantime.';
    }
    if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit') {
      return 'Too many codes requested. Wait a minute and try again.';
    }
    if (code === 'otp_expired') {
      return 'That code has expired. Tap "Resend code" for a fresh one.';
    }
    if (code === 'invalid_credentials' || /token has expired or is invalid/i.test(msg)) {
      return 'That code isn’t right. Check the SMS and try again.';
    }
    if (code === 'validation_failed') {
      return 'That phone number doesn’t look right.';
    }
    return msg || fallback;
  }

  function request(path, opts) {
    opts = opts || {};
    var headers = { apikey: ANON_KEY, 'Content-Type': 'application/json' };
    for (var k in (opts.headers || {})) headers[k] = opts.headers[k];

    return fetch(URL_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON body */ }
        if (!res.ok) {
          var err = new Error(messageFor(json, 'Something went wrong. Try again in a moment.'));
          err.status = res.status;
          err.payload = json;
          throw err;
        }
        return json;
      });
    });
  }

  function adopt(data) {
    if (!data || !data.access_token) return null;
    save({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ||
        (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
      user: data.user || null
    });
    return session.user;
  }

  // ---- auth ---------------------------------------------------------------

  function sendOtp(phone) {
    var p = e164(phone);
    if (!p) return Promise.reject(new Error('Enter a valid 10-digit mobile number.'));
    return request('/auth/v1/otp', {
      method: 'POST',
      body: { phone: p, create_user: true }
    }).then(function () { /* nothing useful in the body */ });
  }

  function verifyOtp(phone, code) {
    var p = e164(phone);
    var token = String(code || '').replace(/\D/g, '');
    if (!p) return Promise.reject(new Error('Enter a valid 10-digit mobile number.'));
    if (token.length < 4) return Promise.reject(new Error('Enter the code from the SMS.'));

    return request('/auth/v1/verify', {
      method: 'POST',
      body: { type: 'sms', phone: p, token: token }
    }).then(function (data) {
      var u = adopt(data);
      if (!u) throw new Error('Sign-in failed. Try again.');
      return u;
    });
  }

  function refresh() {
    if (refreshing) return refreshing;
    if (!session || !session.refresh_token) return Promise.resolve(null);

    refreshing = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token }
    }).then(function (data) {
      refreshing = null;
      return adopt(data) ? session.access_token : null;
    }).catch(function () {
      // Refresh token is spent or revoked — drop the session rather than
      // leaving the UI in a half-signed-in state.
      refreshing = null;
      save(null);
      return null;
    });

    return refreshing;
  }

  function token() {
    if (!session || !session.access_token) return Promise.resolve(null);
    var now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - SKEW <= now) return refresh();
    return Promise.resolve(session.access_token);
  }

  function signOut() {
    var t = session && session.access_token;
    save(null);
    if (!t) return Promise.resolve();
    // Best-effort server-side revoke; the local session is already gone.
    return request('/auth/v1/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t }
    }).catch(function () {});
  }

  // ---- authenticated calls ------------------------------------------------

  // PostgREST. RLS scopes every read to the caller's own rows.
  function rest(path, opts) {
    opts = opts || {};
    return token().then(function (t) {
      if (!t) throw new Error('Please sign in again.');
      var headers = { Authorization: 'Bearer ' + t };
      for (var k in (opts.headers || {})) headers[k] = opts.headers[k];
      return request('/rest/v1' + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body
      });
    });
  }

  // Edge function with the session attached (create-order, cancel-order).
  function fn(name, body) {
    return token().then(function (t) {
      if (!t) throw new Error('Please sign in again.');
      return request('/functions/v1/' + name, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t },
        body: body || {}
      });
    });
  }

  // ---- session bootstrap --------------------------------------------------

  // Resolves once we know whether the stored session is actually usable.
  var ready = (function () {
    if (!session) return Promise.resolve(null);
    return token().then(function (t) {
      return t ? (session && session.user) || null : null;
    });
  })();

  w.SmelloffAuth = {
    sendOtp: sendOtp,
    verifyOtp: verifyOtp,
    token: token,
    signOut: signOut,
    rest: rest,
    fn: fn,
    user: function () { return session ? session.user : null; },
    phone: function () { return local10(session && session.user && session.user.phone); },
    isSignedIn: function () { return !!(session && session.access_token); },
    onReady: function (cb) { ready.then(cb, function () { cb(null); }); },
    // Exposed for the checkout form, which normalises the same way.
    normalizePhone: local10
  };
})(window);
