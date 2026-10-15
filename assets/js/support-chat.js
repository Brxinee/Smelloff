/* =====================================================================
   Smelloff — support chat widget (AI assistant via /api/support-chat)
   =====================================================================
   One launcher bottom-right on every page (stamped by apply-chrome.mjs),
   opening a chat panel. Replies come from Gemini through the Worker; the
   browser never sees the API key. The conversation lives in sessionStorage
   only (lost when the tab closes) and is sent with each message.

   - Bot text is rendered with textContent; links are built as <a> only
     for smelloff.in, wa.me and mailto, so a reply can't inject markup.
   - Sits above the sticky buy strip and the consent bar instead of under
     them, and hides while the phone menu or a checkout/cart modal is open.
   - z-index stays below 9999 (the consent bar / modal ladder in chrome.css).
   ===================================================================== */
(function () {
  'use strict';
  if (window.__sfChat) return;
  window.__sfChat = true;
  if (/^\/admin/.test(location.pathname)) return;

  var WA = 'https://wa.me/919392974031';
  var STORE = 'sf-chat-v1';
  var GREETING = 'Hi! I’m the Smelloff assistant. Ask me about ODORSTRIKE, delivery, COD, returns — or send your order ID and phone number and I’ll check your order.';
  var CHIPS = ['Track my order', 'How do I use it?', 'Is COD available?', 'What’s the return policy?'];

  var css =
    '.sfc-launch{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px) + var(--sfc-lift,0px));z-index:65;display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px 0 14px;border-radius:100px;border:1px solid var(--rule,rgba(242,245,239,.14));background:var(--surface-2,#1A1A1A);color:var(--text,#F2F5EF);font:500 15px/1 var(--body,system-ui,sans-serif);cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.5);transition:bottom .3s var(--ease,ease),opacity .2s ease}' +
    '.sfc-launch svg{width:20px;height:20px;fill:none;stroke:var(--acid,#B8FF57);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    // Phones: an icon-only 48px circle, so the label doesn't sit over headings and prices.
    '@media(max-width:519px){.sfc-launch{width:48px;padding:0;justify-content:center}.sfc-launch span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}' +
    '.sfc-launch:focus-visible,.sfc-panel :focus-visible{outline:2px solid var(--acid,#B8FF57);outline-offset:2px}' +
    'html.sf-menu-open .sfc-launch,html.sf-modal-open .sfc-launch,html.sf-chat-open .sfc-launch{opacity:0;pointer-events:none;visibility:hidden}' +
    'html.sf-chat-open #smelloff-consent-bar,html.sf-chat-open .mobile-bar{display:none!important}' +
    '.sfc-panel{position:fixed;z-index:9000;display:flex;flex-direction:column;background:var(--ink,#0A0A0A);color:var(--text,#F2F5EF);font-family:var(--body,system-ui,sans-serif);inset:0;height:100%;height:100dvh}' +
    '.sfc-panel[hidden]{display:none}' +
    '@media(min-width:520px){.sfc-panel{inset:auto max(16px,env(safe-area-inset-right,0px)) 16px auto;width:380px;height:min(620px,calc(100vh - 32px));border:1px solid var(--rule,rgba(242,245,239,.14));border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.6);overflow:hidden}}' +
    '.sfc-head{display:flex;align-items:center;gap:12px;padding:12px 8px 12px 16px;padding-top:max(12px,env(safe-area-inset-top,0px));border-bottom:1px solid var(--rule,rgba(242,245,239,.14));background:var(--surface,#121212)}' +
    '.sfc-head__txt{flex:1;min-width:0}' +
    '.sfc-title{margin:0;font:700 17px/1.2 var(--display,system-ui,sans-serif);letter-spacing:-.01em}' +
    '.sfc-sub{margin:2px 0 0;font-size:13px;color:var(--muted,#9DA398)}' +
    '.sfc-x{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;background:none;border:0;color:var(--text,#F2F5EF);cursor:pointer;border-radius:8px}' +
    '.sfc-x svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}' +
    '.sfc-log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:10px}' +
    '.sfc-msg{max-width:86%;padding:10px 14px;border-radius:14px;font-size:15px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.sfc-msg--bot{align-self:flex-start;background:var(--surface-2,#1A1A1A);border-bottom-left-radius:4px}' +
    '.sfc-msg--me{align-self:flex-end;background:var(--acid,#B8FF57);color:var(--on-acid,#0A0A0A);border-bottom-right-radius:4px}' +
    '.sfc-msg a{color:var(--acid,#B8FF57);text-decoration:underline;text-underline-offset:2px}' +
    '.sfc-msg--me a{color:inherit}' +
    '.sfc-typing{display:inline-flex;gap:4px;align-items:center;height:22px}' +
    '.sfc-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted,#9DA398);animation:sfc-dot 1s infinite ease-in-out}' +
    '.sfc-typing i:nth-child(2){animation-delay:.15s}.sfc-typing i:nth-child(3){animation-delay:.3s}' +
    '@keyframes sfc-dot{0%,80%,100%{opacity:.3}40%{opacity:1}}' +
    '@media(prefers-reduced-motion:reduce){.sfc-typing i{animation:none;opacity:.7}.sfc-launch{transition:none}}' +
    '.sfc-chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px}' +
    '.sfc-chip{min-height:36px;padding:0 14px;border-radius:100px;border:1px solid var(--rule,rgba(242,245,239,.14));background:transparent;color:var(--text,#F2F5EF);font:500 14px/1 var(--body,system-ui,sans-serif);cursor:pointer}' +
    '.sfc-chip:hover{border-color:var(--acid,#B8FF57)}' +
    '.sfc-form{display:flex;gap:8px;align-items:flex-end;padding:12px 16px;border-top:1px solid var(--rule,rgba(242,245,239,.14));background:var(--surface,#121212)}' +
    '.sfc-form label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '.sfc-input{flex:1;min-width:0;min-height:48px;max-height:120px;resize:none;padding:13px 14px;border-radius:10px;border:1px solid var(--rule,rgba(242,245,239,.14));background:var(--ink,#0A0A0A);color:var(--text,#F2F5EF);font:16px/1.4 var(--body,system-ui,sans-serif)}' +
    '.sfc-input:focus{outline:none;border-color:var(--acid,#B8FF57);box-shadow:0 0 0 3px rgba(184,255,87,.2)}' +
    '.sfc-send{flex:0 0 auto;width:48px;height:48px;border-radius:10px;border:0;background:var(--cta,#B8FF57);color:var(--on-cta,#0A0A0A);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
    '.sfc-send:disabled{opacity:.5;cursor:default}' +
    '.sfc-send svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfc-foot{margin:0;padding:0 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--surface,#121212);font-size:12.5px;line-height:1.45;color:var(--muted,#9DA398)}' +
    '.sfc-foot a{color:var(--text-2,#CDD3C8);text-decoration:underline;text-underline-offset:2px}';

  var ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  var style = document.createElement('style');
  style.id = 'sfc-style';
  style.textContent = css;
  document.head.appendChild(style);

  var launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'sfc-launch';
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-controls', 'sfcPanel');
  launch.innerHTML = ICON_CHAT + '<span>Help</span>';
  launch.setAttribute('aria-label', 'Chat with Smelloff support');

  var panel = document.createElement('section');
  panel.className = 'sfc-panel';
  panel.id = 'sfcPanel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'sfcTitle');
  panel.innerHTML =
    '<div class="sfc-head"><div class="sfc-head__txt"><h2 class="sfc-title" id="sfcTitle">Smelloff support</h2>' +
    '<p class="sfc-sub">AI assistant · replies in seconds</p></div>' +
    '<button type="button" class="sfc-x" aria-label="Close chat">' + ICON_X + '</button></div>' +
    '<div class="sfc-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div class="sfc-chips"></div>' +
    '<form class="sfc-form" novalidate><label for="sfcInput">Your message</label>' +
    '<textarea class="sfc-input" id="sfcInput" rows="1" maxlength="1200" placeholder="Type your question" autocomplete="off"></textarea>' +
    '<button type="submit" class="sfc-send" aria-label="Send">' + ICON_SEND + '</button></form>' +
    '<p class="sfc-foot">AI answers can be wrong. For cancellations, refunds or anything urgent, <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp us</a>. Don’t share card or UPI details here.</p>';

  document.body.appendChild(launch);
  document.body.appendChild(panel);

  var log = panel.querySelector('.sfc-log');
  var chips = panel.querySelector('.sfc-chips');
  var form = panel.querySelector('.sfc-form');
  var input = panel.querySelector('.sfc-input');
  var send = panel.querySelector('.sfc-send');
  var closeBtn = panel.querySelector('.sfc-x');

  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORE) || '[]') || []; } catch (e) { history = []; }
  if (!Array.isArray(history)) history = [];
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-30))); } catch (e) {} }

  // Text → nodes, linking only our own hosts, WhatsApp and email.
  var LINK_RE = /(https:\/\/(?:www\.)?(?:smelloff\.in|wa\.me)(?:\/[^\s<>()"']*)?|[A-Za-z0-9._%+-]+@smelloff\.in)/g;
  function fill(el, text) {
    var last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      var raw = m[0].replace(/[.,;:!?]+$/, '');
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      var isMail = raw.indexOf('@') > 0 && raw.indexOf('http') !== 0;
      a.href = isMail ? 'mailto:' + raw : raw;
      a.textContent = raw;
      if (!isMail && raw.indexOf('wa.me') > -1) { a.target = '_blank'; a.rel = 'noopener'; }
      el.appendChild(a);
      last = m.index + raw.length;
      LINK_RE.lastIndex = last;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }
  function bubble(role, text) {
    var div = document.createElement('div');
    div.className = 'sfc-msg ' + (role === 'user' ? 'sfc-msg--me' : 'sfc-msg--bot');
    fill(div, text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }
  function renderChips() {
    chips.textContent = '';
    if (history.some(function (m) { return m.role === 'user'; })) return;
    CHIPS.forEach(function (label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sfc-chip';
      b.textContent = label;
      b.addEventListener('click', function () { ask(label); });
      chips.appendChild(b);
    });
  }
  function renderAll() {
    log.textContent = '';
    bubble('model', GREETING);
    history.forEach(function (m) { bubble(m.role, m.text); });
    renderChips();
  }

  var busy = false;
  function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true; send.disabled = true;
    history.push({ role: 'user', text: text.slice(0, 1200) });
    save();
    bubble('user', text);
    renderChips();
    var typing = document.createElement('div');
    typing.className = 'sfc-msg sfc-msg--bot';
    typing.setAttribute('aria-label', 'Assistant is typing');
    typing.innerHTML = '<span class="sfc-typing"><i></i><i></i><i></i></span>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    fetch('/api/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-16) })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) { return (j && (j.reply || j.error)) || ''; })
      .catch(function () { return ''; })
      .then(function (reply) {
        typing.remove();
        if (!reply) reply = 'Network hiccup — try again, or WhatsApp us at ' + WA;
        history.push({ role: 'model', text: reply });
        save();
        bubble('model', reply);
        busy = false; send.disabled = false;
        try { if (window.smfTrack) window.smfTrack('contact_submit', { channel: 'chat' }); } catch (e) {}
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    input.value = '';
    grow();
    ask(v);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
  input.addEventListener('input', grow);

  var rendered = false;
  function open() {
    if (!rendered) { renderAll(); rendered = true; }
    panel.hidden = false;
    document.documentElement.classList.add('sf-chat-open');
    launch.setAttribute('aria-expanded', 'true');
    window.setTimeout(function () { input.focus({ preventScroll: true }); log.scrollTop = log.scrollHeight; }, 30);
  }
  function close() {
    panel.hidden = true;
    document.documentElement.classList.remove('sf-chat-open');
    launch.setAttribute('aria-expanded', 'false');
    launch.focus({ preventScroll: true });
  }
  launch.setAttribute('aria-expanded', 'false');
  launch.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  // Any link or button with data-sf-chat opens the panel (e.g. on /contact).
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-sf-chat]');
    if (t) { e.preventDefault(); open(); }
  });

  // Keep the launcher above whatever is pinned to the bottom of the screen:
  // the sticky buy strip (.mobile-bar.visible) and the consent bar.
  function lift() {
    var h = 0;
    var bars = document.querySelectorAll('.mobile-bar.visible, #smelloff-consent-bar');
    for (var i = 0; i < bars.length; i++) {
      var el = bars[i];
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.height && r.top < window.innerHeight) h = Math.max(h, window.innerHeight - r.top);
    }
    document.documentElement.style.setProperty('--sfc-lift', h ? (h - 6) + 'px' : '0px');
  }
  var queued = false;
  function queueLift() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; lift(); }); }
  window.addEventListener('scroll', queueLift, { passive: true });
  window.addEventListener('resize', queueLift);
  if ('MutationObserver' in window) {
    new MutationObserver(queueLift).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  }
  document.addEventListener('transitionend', queueLift, true);
  lift();
})();
