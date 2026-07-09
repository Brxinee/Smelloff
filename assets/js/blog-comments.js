/* =============================================================================
 * Smelloff blog comments — self-contained, Supabase-backed, open commenting.
 *
 * Self-contained by design: this one file injects its own scoped styles, reads
 * the per-post slug from `#blog-comments[data-post-slug]`, renders existing
 * comments (newest first), and handles submission. It touches nothing else on
 * the page — no shared config object, no framework, no external CDN.
 *
 * UX: the form is collapsed behind an "Add a comment" button that opens a
 * neo-brutalist modal. The list shows the 3 newest comments; the rest live in a
 * "View more" drawer that expands/collapses in place.
 *
 * Why direct REST (not the supabase-js CDN client): the site's Content-Security
 * -Policy `script-src` does not allow cdn.jsdelivr.net, so the CDN client would
 * be blocked at load time. `connect-src` DOES allow the Supabase origin, so we
 * call the auto-generated REST + waitlist endpoints directly — the same pattern
 * the existing reviews/waitlist features already use. The anon key is safe to
 * ship in client code: Row Level Security protects the table.
 *
 * Submission flow:
 *   name + comment  -> public `blog_comments` table (rendered on the post)
 *   email           -> `waitlist` table + Google Sheet (NOT stored in comments)
 * ============================================================================= */
(function () {
  'use strict';

  var mount = document.getElementById('blog-comments');
  if (!mount || mount.dataset.wired === '1') return;
  mount.dataset.wired = '1';

  // --- Config (all public / already exposed elsewhere on the site) ------------
  var SUPABASE_URL = 'https://tnuqjydmoxczdjnsgpci.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXFqeWRtb3hjemRqbnNncGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzI2NDgsImV4cCI6MjA5MzEwODY0OH0.6qyyo-1lpntK7FC3H9j_oqWp0W_R1XydVG_IxVUd6F4';
  var SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwvZamMivX4MF_jM83VjO3f8GDYmitlOxKkkXS2mSnivZ1wzps9ZolIQG2tvKMATIoh2Q/exec';

  var NAME_MAX = 60, BODY_MAX = 2000, COOLDOWN_MS = 30000, TOP_N = 3;
  var COOLDOWN_KEY = 'os_comment_last';
  var EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  // post_slug: explicit attribute wins; fall back to the URL filename.
  var slug = (mount.getAttribute('data-post-slug') || '').trim();
  if (!slug) {
    slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  }
  if (!slug) return;

  // --- Helpers ---------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function relativeTime(iso) {
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 45) return 'just now';
    var mins = Math.floor(secs / 60);
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    var weeks = Math.floor(days / 7);
    if (days < 30) return weeks + (weeks === 1 ? ' week ago' : ' weeks ago');
    var months = Math.floor(days / 30);
    if (days < 365) return months + (months === 1 ? ' month ago' : ' months ago');
    var years = Math.floor(days / 365);
    return years + (years === 1 ? ' year ago' : ' years ago');
  }

  // --- Scoped styles (neo-brutalist: #080808 / #B8FF57, hard offset shadows,
  //     thick borders, sharp corners, Barlow Condensed 900 uppercase headings) -
  var style = document.createElement('style');
  style.textContent = [
    '.bc-wrap{max-width:680px;margin:0 auto;padding:0 32px 80px;font-family:"DM Sans",sans-serif}',
    '.bc-wrap *{box-sizing:border-box}',
    '.bc-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 20px}',
    '.bc-title{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:28px;letter-spacing:.04em;text-transform:uppercase;color:#F5F5F5;margin:0;line-height:1}',
    '.bc-count{font-family:"Barlow Condensed",sans-serif;font-weight:900;color:#B8FF57}',
    // Trigger button — acid-green-on-black CTA
    '.bc-cta{display:inline-flex;align-items:center;gap:8px;background:#B8FF57;color:#080808;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:15px;letter-spacing:.1em;text-transform:uppercase;padding:11px 20px;border:2px solid #000;border-radius:0;box-shadow:5px 5px 0 #000;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}',
    '.bc-cta:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 #000}',
    '.bc-cta:active{transform:translate(0,0);box-shadow:3px 3px 0 #000}',
    // List (compact cards)
    '.bc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}',
    '.bc-card{background:#111111;border:2px solid #262626;border-left:3px solid #B8FF57;box-shadow:4px 4px 0 #000;padding:13px 16px}',
    '.bc-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 4px}',
    '.bc-name{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:15px;letter-spacing:.03em;text-transform:uppercase;color:#B8FF57}',
    '.bc-time{font-family:"DM Sans",sans-serif;font-size:12px;color:#8C8C8C;white-space:nowrap}',
    '.bc-body{font-family:"DM Sans",sans-serif;font-size:14.5px;line-height:1.55;color:#F5F5F5;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}',
    '.bc-state{font-family:"DM Sans",sans-serif;font-size:15px;color:#8C8C8C;padding:6px 0}',
    // "View more" drawer
    '.bc-drawer{max-height:0;overflow:hidden;transition:max-height .35s ease}',
    '.bc-drawer .bc-list{margin-top:12px}',
    '.bc-more{display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:transparent;color:#B8FF57;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:14px;letter-spacing:.1em;text-transform:uppercase;padding:9px 16px;border:2px solid #B8FF57;border-radius:0;box-shadow:4px 4px 0 #000;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}',
    '.bc-more:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #000}',
    '.bc-more .bc-chev{transition:transform .25s ease}',
    '.bc-more.open .bc-chev{transform:rotate(180deg)}',
    // Modal
    '.bc-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto}',
    '.bc-modal[hidden]{display:none}',
    '.bc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.78)}',
    '.bc-modal-card{position:relative;width:100%;max-width:520px;margin:auto;background:#111111;border:3px solid #B8FF57;box-shadow:8px 8px 0 #000;padding:26px 24px}',
    '.bc-modal-title{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:22px;letter-spacing:.06em;text-transform:uppercase;color:#B8FF57;margin:0 0 4px;padding-right:40px}',
    '.bc-modal-sub{font-family:"DM Sans",sans-serif;font-size:13px;color:#8C8C8C;margin:0 0 18px}',
    '.bc-x{position:absolute;top:14px;right:14px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:#080808;color:#F5F5F5;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:22px;line-height:1;border:2px solid #F5F5F5;border-radius:0;cursor:pointer;transition:background .12s ease,color .12s ease}',
    '.bc-x:hover{background:#B8FF57;color:#080808;border-color:#000}',
    '.bc-field{margin:0 0 14px}',
    '.bc-label{display:block;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#F5F5F5;margin:0 0 6px}',
    '.bc-input,.bc-textarea{width:100%;background:#080808;color:#F5F5F5;border:2px solid #F5F5F5;border-radius:0;padding:11px 13px;font-family:"DM Sans",sans-serif;font-size:16px;line-height:1.5;box-shadow:none;-webkit-appearance:none;appearance:none;transition:border-color .12s ease,box-shadow .12s ease}',
    '.bc-input:focus,.bc-textarea:focus{outline:none;border-color:#B8FF57;box-shadow:4px 4px 0 #B8FF57}',
    '.bc-textarea{min-height:100px;resize:vertical}',
    '.bc-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0;pointer-events:none}',
    '.bc-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:4px}',
    '.bc-counter{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:12px;letter-spacing:.08em;color:#8C8C8C}',
    '.bc-submit{display:inline-block;background:#B8FF57;color:#080808;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:16px;letter-spacing:.1em;text-transform:uppercase;padding:13px 26px;border:2px solid #000;border-radius:0;box-shadow:5px 5px 0 #000;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}',
    '.bc-submit:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:7px 7px 0 #000}',
    '.bc-submit:active:not(:disabled){transform:translate(0,0);box-shadow:3px 3px 0 #000}',
    '.bc-submit:disabled{opacity:.55;cursor:not-allowed}',
    '.bc-msg{font-family:"DM Sans",sans-serif;font-size:14px;font-weight:600;margin:14px 0 0;padding:10px 13px;border:2px solid;border-radius:0}',
    '.bc-msg.err{color:#080808;background:#ff6b6b;border-color:#000}',
    '.bc-msg.ok{color:#080808;background:#B8FF57;border-color:#000}',
    '.bc-hidden{display:none}',
    '@media(max-width:520px){.bc-wrap{padding:0 20px 64px}.bc-title{font-size:24px}.bc-modal-card{padding:22px 18px}}'
  ].join('');
  document.head.appendChild(style);

  // --- Markup ----------------------------------------------------------------
  mount.innerHTML =
    '<div class="bc-wrap">' +
      '<div class="bc-head">' +
        '<h2 class="bc-title">Comments <span class="bc-count" id="bc-count"></span></h2>' +
        '<button type="button" class="bc-cta" id="bc-open">+ Add comment</button>' +
      '</div>' +
      '<div class="bc-state" id="bc-state">Loading comments…</div>' +
      '<ul class="bc-list" id="bc-top"></ul>' +
      '<div class="bc-drawer" id="bc-drawer"><ul class="bc-list" id="bc-rest"></ul></div>' +
      '<button type="button" class="bc-more bc-hidden" id="bc-more" aria-expanded="false"></button>' +
    '</div>' +
    // Modal (form lives here, opened on demand)
    '<div class="bc-modal" id="bc-modal" hidden>' +
      '<div class="bc-backdrop" id="bc-backdrop"></div>' +
      '<div class="bc-modal-card" role="dialog" aria-modal="true" aria-labelledby="bc-modal-title">' +
        '<button type="button" class="bc-x" id="bc-close" aria-label="Close">&times;</button>' +
        '<h3 class="bc-modal-title" id="bc-modal-title">Add a comment</h3>' +
        '<p class="bc-modal-sub">Your email is private — only your name shows on the post.</p>' +
        '<form id="bc-form" novalidate>' +
          '<div class="bc-field">' +
            '<label class="bc-label" for="bc-name">Name</label>' +
            '<input class="bc-input" id="bc-name" name="name" type="text" maxlength="' + NAME_MAX + '" autocomplete="name" required>' +
          '</div>' +
          '<div class="bc-field">' +
            '<label class="bc-label" for="bc-email">Email</label>' +
            '<input class="bc-input" id="bc-email" name="email" type="email" maxlength="120" autocomplete="email" inputmode="email" required>' +
          '</div>' +
          '<div class="bc-field">' +
            '<label class="bc-label" for="bc-body">Comment</label>' +
            '<textarea class="bc-textarea" id="bc-body" name="body" maxlength="' + BODY_MAX + '" required></textarea>' +
          '</div>' +
          '<div class="bc-hp" aria-hidden="true">' +
            '<label>Website<input type="text" id="bc-website" name="website" tabindex="-1" autocomplete="off"></label>' +
          '</div>' +
          '<div class="bc-row">' +
            '<span class="bc-counter"><span id="bc-remaining">' + BODY_MAX + '</span> left</span>' +
            '<button class="bc-submit" id="bc-submit" type="submit">Post comment</button>' +
          '</div>' +
          '<p class="bc-msg bc-hidden" id="bc-msg" role="alert"></p>' +
        '</form>' +
      '</div>' +
    '</div>';

  var openBtn = document.getElementById('bc-open');
  var modal = document.getElementById('bc-modal');
  var backdrop = document.getElementById('bc-backdrop');
  var closeBtn = document.getElementById('bc-close');
  var form = document.getElementById('bc-form');
  var nameEl = document.getElementById('bc-name');
  var emailEl = document.getElementById('bc-email');
  var bodyEl = document.getElementById('bc-body');
  var hpEl = document.getElementById('bc-website');
  var submitEl = document.getElementById('bc-submit');
  var msgEl = document.getElementById('bc-msg');
  var stateEl = document.getElementById('bc-state');
  var topEl = document.getElementById('bc-top');
  var restEl = document.getElementById('bc-rest');
  var drawerEl = document.getElementById('bc-drawer');
  var moreBtn = document.getElementById('bc-more');
  var countEl = document.getElementById('bc-count');
  var remainingEl = document.getElementById('bc-remaining');

  var comments = [];   // full list, newest first
  var expanded = false;
  var lastFocused = null;

  bodyEl.addEventListener('input', function () {
    remainingEl.textContent = String(BODY_MAX - bodyEl.value.length);
  });

  function showMsg(text, kind) { msgEl.textContent = text; msgEl.className = 'bc-msg ' + kind; }
  function clearMsg() { msgEl.className = 'bc-msg bc-hidden'; msgEl.textContent = ''; }

  function cardHtml(row) {
    return '' +
      '<li class="bc-card">' +
        '<div class="bc-card-head">' +
          '<span class="bc-name">' + esc(row.author_name) + '</span>' +
          '<span class="bc-time">' + esc(relativeTime(row.created_at)) + '</span>' +
        '</div>' +
        '<div class="bc-body">' + esc(row.body) + '</div>' +
      '</li>';
  }

  function setDrawerHeight() {
    // Animate to the natural height when open; collapse to 0 when closed.
    drawerEl.style.maxHeight = expanded ? (restEl.scrollHeight + 12) + 'px' : '0px';
  }

  function render() {
    countEl.textContent = comments.length > 0 ? '(' + comments.length + ')' : '';

    if (!comments.length) {
      stateEl.textContent = 'No comments yet — be the first.';
      topEl.innerHTML = '';
      restEl.innerHTML = '';
      moreBtn.classList.add('bc-hidden');
      drawerEl.style.maxHeight = '0px';
      return;
    }

    stateEl.textContent = '';
    topEl.innerHTML = comments.slice(0, TOP_N).map(cardHtml).join('');

    var rest = comments.slice(TOP_N);
    restEl.innerHTML = rest.map(cardHtml).join('');

    if (rest.length) {
      moreBtn.classList.remove('bc-hidden');
      moreBtn.innerHTML = expanded
        ? 'Show less <span class="bc-chev" aria-hidden="true">▾</span>'
        : 'View ' + rest.length + ' more <span class="bc-chev" aria-hidden="true">▾</span>';
      moreBtn.classList.toggle('open', expanded);
      moreBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    } else {
      moreBtn.classList.add('bc-hidden');
      expanded = false;
    }
    setDrawerHeight();
  }

  moreBtn.addEventListener('click', function () {
    expanded = !expanded;
    render();
  });

  // --- Modal open/close ------------------------------------------------------
  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    clearMsg();
    setTimeout(function () { nameEl.focus(); }, 30);
  }
  function closeModal() {
    modal.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  // --- Load existing comments (newest first) ---------------------------------
  function loadComments() {
    var url = SUPABASE_URL + '/rest/v1/blog_comments' +
      '?select=author_name,body,created_at' +
      '&post_slug=eq.' + encodeURIComponent(slug) +
      '&approved=eq.true' +
      '&order=created_at.desc&limit=500';
    fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (rows) { comments = rows || []; render(); })
      .catch(function () {
        stateEl.textContent = 'Couldn’t load comments right now. Please refresh to try again.';
      });
  }

  // --- Capture email into the waitlist (Supabase table + Google Sheet) --------
  // Fire-and-forget; failures here (e.g. duplicate email) must never block the
  // comment itself.
  function captureEmail(email) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/waitlist', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify({ email: email, source: 'blog-comment' }),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* ignore */ }

    try {
      var img = new Image();
      img.src = SHEETS_ENDPOINT + '?email=' + encodeURIComponent(email);
      if (navigator.sendBeacon) {
        var fd = new FormData();
        fd.append('email', email);
        navigator.sendBeacon(SHEETS_ENDPOINT, fd);
      }
    } catch (e) { /* ignore */ }
  }

  // --- Submit ----------------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMsg();

    // Honeypot: silently accept-and-drop so bots get no signal.
    if (hpEl && hpEl.value.trim() !== '') {
      form.reset();
      remainingEl.textContent = String(BODY_MAX);
      showMsg('Thanks! Your comment has been posted.', 'ok');
      setTimeout(closeModal, 1000);
      return;
    }

    var name = nameEl.value.trim();
    var email = emailEl.value.trim();
    var body = bodyEl.value.trim();

    if (!name || name.length > NAME_MAX) {
      showMsg('Please enter your name (1–' + NAME_MAX + ' characters).', 'err'); nameEl.focus(); return;
    }
    if (!email || !EMAIL_RE.test(email) || email.length > 120) {
      showMsg('Please enter a valid email address.', 'err'); emailEl.focus(); return;
    }
    if (!body || body.length > BODY_MAX) {
      showMsg('Please enter a comment (1–' + BODY_MAX + ' characters).', 'err'); bodyEl.focus(); return;
    }

    // Soft throttle: one submit per 30s per browser.
    var last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
    var waitMs = COOLDOWN_MS - (Date.now() - last);
    if (last && waitMs > 0) {
      showMsg('Please wait ' + Math.ceil(waitMs / 1000) + 's before posting again.', 'err');
      return;
    }

    submitEl.disabled = true;
    var originalLabel = submitEl.textContent;
    submitEl.textContent = 'Posting…';

    // Email -> waitlist / sheet (private, not stored in comments).
    captureEmail(email);

    // Name + comment -> public blog_comments.
    fetch(SUPABASE_URL + '/rest/v1/blog_comments', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ post_slug: slug, author_name: name, body: body })
    })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (rows) {
        var row = (Array.isArray(rows) && rows[0]) ||
          { author_name: name, body: body, created_at: new Date().toISOString() };
        try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) {}

        // Optimistic: prepend to the top of the list, no page reload.
        comments.unshift(row);
        render();

        form.reset();
        remainingEl.textContent = String(BODY_MAX);
        showMsg('Thanks, ' + name + '! Your comment has been posted.', 'ok');
        setTimeout(closeModal, 1100);
      })
      .catch(function () {
        showMsg('Something went wrong posting your comment. Please try again.', 'err');
      })
      .then(function () {
        submitEl.disabled = false;
        submitEl.textContent = originalLabel;
      });
  });

  loadComments();
})();
