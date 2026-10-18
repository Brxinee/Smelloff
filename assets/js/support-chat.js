/* =====================================================================
   Smelloff — AI assistant widget ("smell doctor" + shop help)
   =====================================================================
   One launcher bottom-right on every page (stamped by apply-chrome.mjs),
   opening a chat panel. Replies come from /api/support-chat (Gemini via the
   Worker; the browser never sees the key) as { reply, cards, suggestions }.
   The conversation lives in sessionStorage only and follows the visitor
   from page to page in the tab.

   Built on NN/g's site-chatbot research (2024–25): say what it can do for
   THIS page, tappable suggestions after every answer, images in product
   answers, short scannable replies, don't autoscroll past the start of an
   answer. One proactive teaser per session at most. No voice input (owner's
   call, 2026-10-18).

   - All reply text goes through textContent. **bold** and "- " lists are
     built as nodes; only smelloff.in, wa.me and @smelloff.in become links.
     Card links are site-relative paths, wa.me or an https tracking URL.
   - The launcher sits above the sticky buy strip and the consent bar and
     hides under the phone menu and checkout/cart modals. z-index stays
     below 9999 (the consent bar / modal ladder in chrome.css).
   ===================================================================== */
(function () {
  'use strict';
  if (window.__sfChat) return;
  window.__sfChat = true;
  if (/^\/admin/.test(location.pathname)) return;

  var WA = 'https://wa.me/919392974031';
  var STORE = 'sf-chat-v2';
  var TEASED = 'sf-chat-teased';
  var OPENED = 'sf-chat-opened';

  var path = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  var KIND = path === '/odorstrike' ? 'pdp' : /^\/blog\/[a-z0-9-]+$/.test(path) ? 'post' : path === '/track-order' ? 'track' : 'home';
  var OPENERS = {
    home: {
      hi: 'Tell me what your clothes smell of and I’ll tell you why, and how to fix it. I can also help you pick a pack or check an order.',
      tiles: ['My shirt smells of sweat', 'Smoke or cooking smell', 'Musty, damp smell', 'Which pack should I buy?', 'Where’s my order?'],
      teaser: 'What do your clothes smell of today? I can tell you why.'
    },
    pdp: {
      hi: 'Questions before you buy? Ask anything, or I’ll help you pick the right pack.',
      tiles: ['Which pack is right for me?', 'How long does a bottle last?', 'Will it leave marks?', 'Is Cash on Delivery available?', 'How fast is delivery?'],
      teaser: 'Not sure which pack? I’ll do the maths with you.'
    },
    post: {
      hi: 'Dealing with this smell right now? Tell me where it is and I’ll give you the short fix.',
      tiles: ['Does ODORSTRIKE help here?', 'My shirt smells of sweat', 'Musty, damp smell', 'Which pack should I buy?'],
      teaser: 'Got this smell right now? Ask me for the short fix.'
    },
    track: {
      hi: 'Send your order ID (SMF-…) and the phone number you ordered with, and I’ll check it.',
      tiles: ['Where’s my order?', 'Change my address', 'Cancel my order'],
      teaser: ''
    }
  };
  var OPEN = OPENERS[KIND];

  var R = 'var(--rule,rgba(242,245,239,.14))';
  var css =
    '.sfc-launch{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px) + var(--sfc-lift,0px));z-index:65;display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px 0 14px;border-radius:100px;border:1px solid ' + R + ';background:var(--surface-2,#1A1A1A);color:var(--text,#F2F5EF);font:500 15px/1 var(--body,system-ui,sans-serif);cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.5);transition:bottom .3s var(--ease,ease),opacity .2s ease}' +
    '.sfc-launch svg{width:22px;height:22px;color:var(--acid,#B8FF57);fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfc-launch[data-dot]::after{content:"";position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;background:var(--acid,#B8FF57);box-shadow:0 0 0 2px var(--surface-2,#1A1A1A)}' +
    // Phones: an icon-only 48px circle, so the label doesn't sit over headings and prices.
    '@media(max-width:519px){.sfc-launch{width:48px;padding:0;justify-content:center}.sfc-launch span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}' +
    '.sfc-launch:focus-visible,.sfc-panel :focus-visible,.sfc-tease :focus-visible{outline:2px solid var(--acid,#B8FF57);outline-offset:2px}' +
    'html.sf-menu-open .sfc-launch,html.sf-modal-open .sfc-launch,html.sf-chat-open .sfc-launch,html.sf-menu-open .sfc-tease,html.sf-modal-open .sfc-tease,html.sf-chat-open .sfc-tease{opacity:0;pointer-events:none;visibility:hidden}' +
    'html.sf-chat-open #smelloff-consent-bar,html.sf-chat-open .mobile-bar{display:none!important}' +
    // Proactive teaser: one per session, above the launcher.
    '.sfc-tease{position:fixed;z-index:64;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(76px + env(safe-area-inset-bottom,0px) + var(--sfc-lift,0px));max-width:min(280px,calc(100vw - 32px));display:flex;align-items:flex-start;gap:4px;padding:12px 6px 12px 14px;border-radius:14px 14px 4px 14px;border:1px solid ' + R + ';background:var(--surface-2,#1A1A1A);color:var(--text,#F2F5EF);box-shadow:0 14px 34px rgba(0,0,0,.55);font:500 14.5px/1.4 var(--body,system-ui,sans-serif);transition:bottom .3s var(--ease,ease),opacity .25s ease,transform .25s ease}' +
    '.sfc-tease[hidden]{display:none}' +
    '.sfc-tease__go{flex:1;background:none;border:0;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
    '.sfc-tease__x{flex:0 0 auto;width:32px;height:32px;margin:-6px 0 -6px;border:0;background:none;color:var(--muted,#9DA398);cursor:pointer;border-radius:8px;font-size:18px;line-height:1}' +
    // Panel.
    '.sfc-panel{position:fixed;z-index:9000;display:flex;flex-direction:column;background:var(--ink,#0A0A0A);color:var(--text,#F2F5EF);font-family:var(--body,system-ui,sans-serif);inset:0;height:100%;height:100dvh}' +
    '.sfc-panel[hidden]{display:none}' +
    '@media(min-width:520px){.sfc-panel{inset:auto max(16px,env(safe-area-inset-right,0px)) 16px auto;width:400px;height:min(660px,calc(100vh - 32px));border:1px solid ' + R + ';border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.6);overflow:hidden}}' +
    '.sfc-head{display:flex;align-items:center;gap:10px;padding:10px 6px 10px 14px;padding-top:max(10px,env(safe-area-inset-top,0px));border-bottom:1px solid ' + R + ';background:var(--surface,#121212)}' +
    '.sfc-ava{flex:0 0 auto;width:40px;height:40px;border-radius:50%;overflow:hidden;background:#000;display:block}' +
    '.sfc-ava img{display:block;width:100%;height:100%;object-fit:cover}' +
    '.sfc-head__txt{flex:1;min-width:0}' +
    '.sfc-title{margin:0;font:700 16px/1.2 var(--display,system-ui,sans-serif);letter-spacing:-.01em}' +
    '.sfc-sub{margin:2px 0 0;font-size:12.5px;color:var(--muted,#9DA398);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.sfc-sub i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--acid,#B8FF57);margin-right:6px;vertical-align:1px}' +
    '.sfc-ib{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;background:none;border:0;color:var(--text,#F2F5EF);cursor:pointer;border-radius:8px}' +
    '.sfc-ib svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfc-ib:hover{background:rgba(242,245,239,.06)}' +
    '.sfc-log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}' +
    '@media(prefers-reduced-motion:reduce){.sfc-log{scroll-behavior:auto}}' +
    '.sfc-row{display:flex;flex-direction:column;gap:8px;align-items:flex-start;scroll-margin-top:8px}' +
    '.sfc-row--me{align-items:flex-end}' +
    '.sfc-msg{max-width:88%;padding:10px 14px;border-radius:14px;font-size:15px;line-height:1.5;overflow-wrap:anywhere}' +
    '.sfc-msg p{margin:0}.sfc-msg p+p,.sfc-msg p+ul,.sfc-msg ul+p{margin-top:6px}' +
    '.sfc-msg ul{margin:4px 0 0;padding-left:18px}.sfc-msg li{margin:2px 0}.sfc-msg li::marker{color:var(--acid,#B8FF57)}' +
    '.sfc-msg strong{font-weight:600;color:var(--text,#F2F5EF)}' +
    '.sfc-msg--bot{background:var(--surface-2,#1A1A1A);border-bottom-left-radius:4px}' +
    '.sfc-msg--me{background:var(--acid,#B8FF57);color:var(--on-acid,#0A0A0A);border-bottom-right-radius:4px;white-space:pre-wrap}' +
    '.sfc-msg a{color:var(--acid,#B8FF57);text-decoration:underline;text-underline-offset:2px}' +
    '.sfc-msg--me a{color:inherit}' +
    '.sfc-typing{display:inline-flex;gap:4px;align-items:center;height:22px}' +
    '.sfc-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted,#9DA398);animation:sfc-dot 1s infinite ease-in-out}' +
    '.sfc-typing i:nth-child(2){animation-delay:.15s}.sfc-typing i:nth-child(3){animation-delay:.3s}' +
    '.sfc-typing em{font-style:normal;font-size:13px;color:var(--muted,#9DA398);margin-left:8px}' +
    '@keyframes sfc-dot{0%,80%,100%{opacity:.3}40%{opacity:1}}' +
    '@media(prefers-reduced-motion:reduce){.sfc-typing i{animation:none;opacity:.7}.sfc-launch,.sfc-tease{transition:none}}' +
    // Welcome tiles.
    '.sfc-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}' +
    '.sfc-tile{min-height:52px;padding:10px 12px;border-radius:12px;border:1px solid ' + R + ';background:var(--surface,#121212);color:var(--text,#F2F5EF);font:500 14px/1.3 var(--body,system-ui,sans-serif);text-align:left;cursor:pointer}' +
    '.sfc-tile:hover{border-color:var(--acid,#B8FF57)}' +
    '.sfc-tile:last-child:nth-child(odd){grid-column:1/-1}' +
    // Cards.
    '.sfc-cards{display:flex;flex-direction:column;gap:8px;width:100%;max-width:340px}' +
    '.sfc-card{display:flex;gap:12px;align-items:center;padding:10px;border-radius:12px;border:1px solid ' + R + ';background:var(--surface,#121212);color:var(--text,#F2F5EF);text-decoration:none}' +
    'a.sfc-card:hover{border-color:var(--acid,#B8FF57)}' +
    '.sfc-card img{flex:0 0 auto;width:64px;height:64px;border-radius:9px;object-fit:cover;background:#000}' +
    '.sfc-card--pack img{object-fit:contain}' +
    '.sfc-card__b{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}' +
    '.sfc-card__t{font:600 14.5px/1.3 var(--body,system-ui,sans-serif)}' +
    '.sfc-card__d{font-size:13px;line-height:1.4;color:var(--muted,#9DA398);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.sfc-price{font:700 17px/1.2 var(--display,system-ui,sans-serif)}' +
    '.sfc-price s{font:400 13px var(--body,system-ui,sans-serif);color:var(--muted,#9DA398);margin-left:6px}' +
    '.sfc-badge{align-self:flex-start;font:600 11px/1 var(--body,system-ui,sans-serif);letter-spacing:.04em;padding:4px 7px;border-radius:100px;background:var(--acid,#B8FF57);color:var(--on-acid,#0A0A0A)}' +
    '.sfc-badge--q{background:transparent;color:var(--muted,#9DA398);border:1px solid ' + R + '}' +
    '.sfc-buy{flex:0 0 auto;align-self:center;display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:8px;background:var(--cta,#B8FF57);color:var(--on-cta,#0A0A0A);font:600 14px/1 var(--body,system-ui,sans-serif);text-decoration:none}' +
    '.sfc-card--order{flex-direction:column;align-items:stretch;gap:10px}' +
    '.sfc-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}' +
    '.sfc-steps span{height:4px;border-radius:4px;background:rgba(242,245,239,.14)}.sfc-steps span.on{background:var(--acid,#B8FF57)}' +
    '.sfc-steplab{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:11px;color:var(--muted,#9DA398)}' +
    '.sfc-kv{font-size:13px;color:var(--text-2,#CDD3C8);line-height:1.5}' +
    '.sfc-act{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 14px;border-radius:8px;border:1px solid ' + R + ';color:var(--text,#F2F5EF);text-decoration:none;font:600 14px/1 var(--body,system-ui,sans-serif)}' +
    '.sfc-act--wa{background:var(--surface-2,#1A1A1A);color:var(--text,#F2F5EF);align-self:flex-start;padding:0 16px 0 12px}.sfc-act--wa:hover{border-color:#25D366}.sfc-act--wa img{width:22px;height:22px;display:block}' +
    '.sfc-act svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    // Feedback.
    '.sfc-fb{display:flex;align-items:center;gap:2px;margin-top:-2px}' +
    '.sfc-fb button{width:32px;height:32px;border:0;background:none;color:var(--muted,#9DA398);cursor:pointer;border-radius:8px;display:inline-flex;align-items:center;justify-content:center}' +
    '.sfc-fb button:hover{color:var(--text,#F2F5EF)}.sfc-fb button[aria-pressed="true"]{color:var(--acid,#B8FF57)}' +
    '.sfc-fb svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfc-fb small{font-size:12px;color:var(--muted,#9DA398);margin-left:4px}' +
    // Suggestions + input.
    '.sfc-chips{display:flex;gap:8px;padding:0 16px 10px;overflow-x:auto;scrollbar-width:none}' +
    '.sfc-chips::-webkit-scrollbar{display:none}.sfc-chips:empty{display:none}' +
    '.sfc-chip{flex:0 0 auto;min-height:36px;padding:0 14px;border-radius:100px;border:1px solid ' + R + ';background:transparent;color:var(--text,#F2F5EF);font:500 14px/1 var(--body,system-ui,sans-serif);cursor:pointer;white-space:nowrap}' +
    '.sfc-chip:hover{border-color:var(--acid,#B8FF57)}' +
    '.sfc-form{display:flex;gap:8px;align-items:flex-end;padding:12px 16px 10px;border-top:1px solid ' + R + ';background:var(--surface,#121212)}' +
    '.sfc-form label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '.sfc-input{flex:1;min-width:0;min-height:48px;max-height:120px;resize:none;padding:13px 14px;border-radius:10px;border:1px solid ' + R + ';background:var(--ink,#0A0A0A);color:var(--text,#F2F5EF);font:16px/1.4 var(--body,system-ui,sans-serif)}' +
    '.sfc-input:focus{outline:none;border-color:var(--acid,#B8FF57);box-shadow:0 0 0 3px rgba(184,255,87,.2)}' +
    '.sfc-send{flex:0 0 auto;width:48px;height:48px;border-radius:10px;border:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
    '.sfc-send{background:var(--cta,#B8FF57);color:var(--on-cta,#0A0A0A)}.sfc-send:disabled{opacity:.5;cursor:default}' +
    '.sfc-send svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfc-foot{margin:0;padding:0 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--surface,#121212);font-size:12px;line-height:1.45;color:var(--muted,#9DA398)}' +
    '.sfc-foot a{color:var(--text-2,#CDD3C8);text-decoration:underline;text-underline-offset:2px}';

  function svg(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  var I = {
    // Brand chat mark (owner's artwork, 2026-10-18): rounded speech bubble,
    // angled tail bottom-left, one four-point sparkle. Outline stroked,
    // sparkle filled, all currentColor.
    spark: svg('<path d="M6.4 3.9h11c1.7 0 2.7 1.1 2.7 2.7v7.6c0 1.7-1 2.7-2.7 2.7h-6.85L6.4 19.7l1.75-2.8H6.4c-1.7 0-2.7-1-2.7-2.7V6.6c0-1.6 1-2.7 2.7-2.7z"/>' +
      '<path fill="currentColor" stroke="none" d="M11.95 7.92c.45 1.4 1.1 2.15 2.63 2.63-1.53.48-2.18 1.23-2.63 2.63-.45-1.4-1.1-2.15-2.63-2.63 1.53-.48 2.18-1.23 2.63-2.63z"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    restart: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    up: svg('<path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/>'),
    down: svg('<path d="M7 13V4H4v9zM7 13l4 8a2 2 0 0 0 2-2v-4h5.5a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.3 4H7"/>'),
    truck: svg('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>')
  };

  function track(type, label, meta) {
    try { if (typeof window.smfTrack === 'function') window.smfTrack({ type: type, label: label, meta: meta || {} }); } catch (e) {}
  }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  var style = document.createElement('style');
  style.id = 'sfc-style';
  style.textContent = css;
  document.head.appendChild(style);

  var launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'sfc-launch';
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-controls', 'sfcPanel');
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-label', 'Chat with the Smelloff assistant');
  launch.innerHTML = I.spark + '<span>Ask us</span>';

  var tease = document.createElement('div');
  tease.className = 'sfc-tease';
  tease.hidden = true;
  tease.setAttribute('role', 'status');
  tease.innerHTML = '<button type="button" class="sfc-tease__go"></button><button type="button" class="sfc-tease__x" aria-label="Dismiss">×</button>';

  var panel = document.createElement('section');
  panel.className = 'sfc-panel';
  panel.id = 'sfcPanel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'sfcTitle');
  // The header avatar is the owner's robot artwork (2026-10-18), lazy-loaded:
  // the panel is hidden until opened, so pages where nobody chats don't fetch it.
  panel.innerHTML =
    '<div class="sfc-head"><picture class="sfc-ava">' +
    '<source type="image/avif" srcset="/assets/brand/chat-avatar%4080.avif 80w, /assets/brand/chat-avatar%40120.avif 120w" sizes="40px">' +
    '<img src="/assets/brand/chat-avatar%4080.webp" srcset="/assets/brand/chat-avatar%4080.webp 80w, /assets/brand/chat-avatar%40120.webp 120w" sizes="40px" width="40" height="40" alt="" loading="lazy" decoding="async" data-no-skel></picture>' +
    '<div class="sfc-head__txt"><h2 class="sfc-title" id="sfcTitle">Smelloff assistant</h2>' +
    '<p class="sfc-sub"><i></i>AI · smell fixes, packs, orders</p></div>' +
    '<button type="button" class="sfc-ib sfc-new" aria-label="Start a new chat" title="New chat">' + I.restart + '</button>' +
    '<button type="button" class="sfc-ib sfc-x" aria-label="Close chat">' + I.x + '</button></div>' +
    '<div class="sfc-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div class="sfc-chips" aria-label="Suggested replies"></div>' +
    '<form class="sfc-form" novalidate><label for="sfcInput">Your message</label>' +
    '<textarea class="sfc-input" id="sfcInput" rows="1" maxlength="1200" placeholder="Ask in any language" autocomplete="off"></textarea>' +
    '<button type="submit" class="sfc-send" aria-label="Send">' + I.send + '</button></form>' +
    '<p class="sfc-foot">AI answers can be wrong. For refunds or anything urgent, <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp a person</a>. Never share card or UPI details here.</p>';

  document.body.appendChild(tease);
  document.body.appendChild(launch);
  document.body.appendChild(panel);

  var log = panel.querySelector('.sfc-log');
  var chips = panel.querySelector('.sfc-chips');
  var form = panel.querySelector('.sfc-form');
  var input = panel.querySelector('.sfc-input');
  var sendBtn = panel.querySelector('.sfc-send');

  // history: [{role:'user'|'model', text, cards?, suggestions?, fb?}]
  var history = [];
  try { history = JSON.parse(ss(STORE) || '[]') || []; } catch (e) { history = []; }
  if (!Array.isArray(history)) history = [];
  function save() { ss(STORE, JSON.stringify(history.slice(-30))); }

  // ---------------------------------------------------------- text → nodes
  var LINK_RE = /(https:\/\/(?:www\.)?(?:smelloff\.in|wa\.me)(?:\/[^\s<>()"'*]*)?|[A-Za-z0-9._%+-]+@smelloff\.in)/g;
  function linkify(el, text) {
    var last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      var raw = m[0].replace(/[.,;:!?]+$/, '');
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      var isMail = raw.indexOf('@') > 0 && raw.indexOf('http') !== 0;
      a.href = isMail ? 'mailto:' + raw : raw;
      a.textContent = raw.replace(/^https:\/\/(www\.)?/, '');
      if (!isMail && raw.indexOf('wa.me') > -1) { a.target = '_blank'; a.rel = 'noopener'; }
      el.appendChild(a);
      last = m.index + raw.length;
      LINK_RE.lastIndex = last;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }
  // **bold** spans inside one line.
  function inline(el, text) {
    var parts = String(text).split(/\*\*(.+?)\*\*/g);
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2) { var b = document.createElement('strong'); linkify(b, parts[i]); el.appendChild(b); }
      else linkify(el, parts[i].replace(/\*\*/g, ''));
    }
  }
  // Paragraphs and "- " lists.
  function richText(el, text) {
    var lines = String(text).replace(/\r/g, '').split('\n');
    var ul = null, para = null;
    lines.forEach(function (line) {
      var t = line.trim();
      var li = t.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (!t) { ul = null; para = null; return; }
      if (li) {
        if (!ul) { ul = document.createElement('ul'); el.appendChild(ul); para = null; }
        var item = document.createElement('li'); inline(item, li[1]); ul.appendChild(item);
      } else {
        ul = null;
        if (!para) { para = document.createElement('p'); el.appendChild(para); }
        else para.appendChild(document.createElement('br'));
        inline(para, t);
      }
    });
  }

  // ---------------------------------------------------------- cards
  function safeHref(u) {
    u = String(u || '');
    if (/^\/[^/]/.test(u)) return u;
    if (/^https:\/\/wa\.me\//.test(u)) return u;
    if (/^https:\/\//.test(u)) return u;
    return null;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function rupees(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function cardKey(c) { return c.kind === 'pack' ? 'pack:' + c.qty : c.kind === 'guide' ? 'guide:' + c.slug : c.kind; }

  function renderCard(c) {
    var href = safeHref(c.url);
    if (c.kind === 'pack' && href) {
      var box = el('div', 'sfc-card sfc-card--pack');
      var img = el('img'); img.src = c.img; img.alt = ''; img.width = 64; img.height = 64; img.loading = 'lazy'; img.setAttribute('data-no-skel', '');
      var b = el('div', 'sfc-card__b');
      b.appendChild(el('span', 'sfc-badge' + (c.qty === 5 ? '' : ' sfc-badge--q'), c.note));
      b.appendChild(el('span', 'sfc-card__t', c.title));
      var pr = el('span', 'sfc-price', rupees(c.price));
      var s = el('s', null, rupees(c.mrp)); pr.appendChild(s);
      b.appendChild(pr);
      if (c.each) b.appendChild(el('span', 'sfc-card__d', rupees(c.each) + ' a bottle'));
      var buy = el('a', 'sfc-buy', 'Buy'); buy.href = href;
      buy.setAttribute('aria-label', 'Buy ' + c.title + ' for ' + rupees(c.price));
      buy.addEventListener('click', function () { track('chat_card_click', 'pack:' + c.qty, { page: path }); });
      box.appendChild(img); box.appendChild(b); box.appendChild(buy);
      return box;
    }
    if (c.kind === 'guide' && href) {
      var a = el('a', 'sfc-card sfc-card--guide'); a.href = href;
      if (c.thumb) { var im = el('img'); im.src = c.thumb; im.alt = ''; im.width = 64; im.height = 64; im.loading = 'lazy'; im.setAttribute('data-no-skel', ''); a.appendChild(im); }
      var gb = el('div', 'sfc-card__b');
      gb.appendChild(el('span', 'sfc-card__t', c.title));
      if (c.desc) gb.appendChild(el('span', 'sfc-card__d', c.desc));
      a.appendChild(gb);
      a.addEventListener('click', function () { track('chat_card_click', 'guide:' + c.slug, { page: path }); });
      return a;
    }
    if (c.kind === 'whatsapp' && href) {
      var w = el('a', 'sfc-act sfc-act--wa'); w.href = href; w.target = '_blank'; w.rel = 'noopener';
      // The site's own WhatsApp logo (same file family as the footer's social row).
      var wi = el('img'); wi.src = '/assets/icon-whatsapp.png'; wi.alt = ''; wi.width = 22; wi.height = 22; wi.loading = 'lazy'; wi.setAttribute('data-no-skel', '');
      w.appendChild(wi); w.appendChild(document.createTextNode('Continue on WhatsApp'));
      w.addEventListener('click', function () { track('chat_card_click', 'whatsapp', { page: path }); });
      return w;
    }
    if (c.kind === 'order') {
      var o = el('div', 'sfc-card sfc-card--order');
      var top = el('div', 'sfc-card__b');
      top.appendChild(el('span', 'sfc-badge sfc-badge--q', c.code));
      top.appendChild(el('span', 'sfc-card__t', c.label));
      o.appendChild(top);
      if (c.step >= 0) {
        var steps = el('div', 'sfc-steps'), labs = el('div', 'sfc-steplab');
        ['Confirmed', 'Shipped', 'Out today', 'Delivered'].forEach(function (name, i) {
          var bar = el('span'); if (c.step >= i + 1) bar.className = 'on'; steps.appendChild(bar);
          labs.appendChild(el('span', null, name));
        });
        o.appendChild(steps); o.appendChild(labs);
      }
      var bits = [];
      if (c.bottles) bits.push(c.bottles + (c.bottles === 1 ? ' bottle' : ' bottles'));
      if (c.total != null) bits.push(rupees(c.total) + (c.payment ? ' · ' + c.payment : ''));
      if (c.courier) bits.push(c.courier + (c.trackingId ? ' · ' + c.trackingId : ''));
      if (bits.length) o.appendChild(el('div', 'sfc-kv', bits.join('\n'))).style.whiteSpace = 'pre-line';
      var t = safeHref(c.trackingUrl);
      if (t && /^https:/.test(t)) {
        var ta = el('a', 'sfc-act'); ta.href = t; ta.target = '_blank'; ta.rel = 'noopener';
        ta.innerHTML = I.truck; ta.appendChild(document.createTextNode('Track with courier'));
        o.appendChild(ta);
      }
      return o;
    }
    return null;
  }

  // ---------------------------------------------------------- messages
  function row(role) {
    var r = el('div', 'sfc-row' + (role === 'user' ? ' sfc-row--me' : ''));
    log.appendChild(r);
    return r;
  }
  function addMessage(m, index) {
    var r = row(m.role);
    var b = el('div', 'sfc-msg ' + (m.role === 'user' ? 'sfc-msg--me' : 'sfc-msg--bot'));
    if (m.role === 'user') b.textContent = m.text; else richText(b, m.text);
    r.appendChild(b);
    if (m.cards && m.cards.length) {
      var wrap = el('div', 'sfc-cards');
      m.cards.forEach(function (c) { var n = renderCard(c); if (n) wrap.appendChild(n); });
      if (wrap.childNodes.length) r.appendChild(wrap);
    }
    if (m.role === 'model' && index != null && m.rated !== false) r.appendChild(feedback(m, index));
    return r;
  }
  function feedback(m, index) {
    var f = el('div', 'sfc-fb');
    if (m.fb) { f.appendChild(el('small', null, m.fb === 'up' ? 'Thanks!' : 'Thanks, we’ll improve it.')); return f; }
    [['up', 'Helpful'], ['down', 'Not helpful']].forEach(function (d) {
      var btn = el('button'); btn.type = 'button'; btn.setAttribute('aria-label', d[1]); btn.setAttribute('aria-pressed', 'false'); btn.innerHTML = d[0] === 'up' ? I.up : I.down;
      btn.addEventListener('click', function () {
        history[index].fb = d[0]; save();
        var prevUser = history[index - 1] && history[index - 1].role === 'user' ? history[index - 1].text.slice(0, 200) : '';
        track('chat_feedback', d[0], { q: prevUser, page: path });
        f.textContent = ''; f.appendChild(el('small', null, d[0] === 'up' ? 'Thanks!' : 'Thanks, we’ll improve it.'));
        if (d[0] === 'down') {
          var w = renderCard({ kind: 'whatsapp', url: WA + '?text=' + encodeURIComponent('Hi Smelloff: ' + prevUser) });
          if (w) f.parentNode.insertBefore(w, f.nextSibling);
        }
      });
      f.appendChild(btn);
    });
    return f;
  }
  function welcome() {
    var r = row('model');
    var b = el('div', 'sfc-msg sfc-msg--bot');
    richText(b, OPEN.hi);
    r.appendChild(b);
    if (!history.length) {
      var tiles = el('div', 'sfc-tiles');
      OPEN.tiles.forEach(function (label) {
        var t = el('button', 'sfc-tile', label); t.type = 'button';
        t.addEventListener('click', function () { ask(label, 'tile'); });
        tiles.appendChild(t);
      });
      r.appendChild(tiles);
    }
  }
  function setChips(list) {
    chips.textContent = '';
    (list || []).slice(0, 3).forEach(function (label) {
      var c = el('button', 'sfc-chip', label); c.type = 'button';
      c.addEventListener('click', function () { ask(label, 'chip'); });
      chips.appendChild(c);
    });
  }
  function renderAll() {
    log.textContent = '';
    welcome();
    history.forEach(function (m, i) { addMessage(m, m.role === 'model' ? i : null); });
    var last = history[history.length - 1];
    setChips(last && last.role === 'model' ? last.suggestions : []);
    log.scrollTop = log.scrollHeight;
  }
  // Show the START of a new answer (NN/g: don't scroll past it).
  function reveal(r) {
    var top = r.offsetTop - 8;
    log.scrollTop = Math.min(top, log.scrollHeight);
  }

  // ---------------------------------------------------------- ask
  var busy = false;
  var ORDER_HINT = /SMF[\s-]?\d{8}|\b[6-9]\d{4}\s?\d{5}\b|order|parcel|track|delivery status/i;
  function ask(text, source) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    setChips([]);
    var tiles = log.querySelector('.sfc-tiles'); if (tiles) tiles.remove();
    history.push({ role: 'user', text: text.slice(0, 1200) });
    save();
    var userRow = addMessage(history[history.length - 1]);
    var typing = row('model');
    var tb = el('div', 'sfc-msg sfc-msg--bot');
    tb.innerHTML = '<span class="sfc-typing"><i></i><i></i><i></i><em></em></span>';
    tb.querySelector('em').textContent = ORDER_HINT.test(text) ? 'Checking…' : 'Thinking…';
    tb.setAttribute('aria-label', 'Assistant is typing');
    typing.appendChild(tb);
    reveal(userRow);
    track('chat_message', source || 'typed', { page: path, n: history.filter(function (m) { return m.role === 'user'; }).length });

    var payload = history.slice(-16).map(function (m) {
      var o = { role: m.role, text: m.text };
      if (m.role === 'model' && m.cards) o.cards = m.cards.map(cardKey);
      return o;
    });
    fetch('/api/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload, page: { path: path, title: document.title.slice(0, 120) } })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function () { return {}; })
      .then(function (j) {
        typing.remove();
        var msg = {
          role: 'model',
          text: (j && typeof j.reply === 'string' && j.reply) || 'Network hiccup. Try again, or WhatsApp us and a person will help.',
          cards: j && Array.isArray(j.cards) ? j.cards : [{ kind: 'whatsapp', url: WA }],
          suggestions: j && Array.isArray(j.suggestions) ? j.suggestions : []
        };
        if (!j || !j.reply) msg.rated = false;
        history.push(msg);
        save();
        var r = addMessage(msg, history.length - 1);
        setChips(msg.suggestions);
        reveal(r);
        busy = false; sendBtn.disabled = false;
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    input.value = '';
    grow();
    ask(v, 'typed');
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
  input.addEventListener('input', grow);

  // ---------------------------------------------------------- open / close
  var rendered = false;
  function open(source) {
    hideTease(false);
    if (!rendered) { renderAll(); rendered = true; }
    panel.hidden = false;
    document.documentElement.classList.add('sf-chat-open');
    launch.setAttribute('aria-expanded', 'true');
    launch.removeAttribute('data-dot');
    if (!ss(OPENED)) { ss(OPENED, '1'); track('chat_open', source || 'launcher', { page: path }); }
    window.setTimeout(function () {
      // Phones: don't pop the keyboard over the welcome tiles.
      if (window.matchMedia('(min-width:520px)').matches || history.length) input.focus({ preventScroll: true });
      if (history.length) log.scrollTop = log.scrollHeight;
    }, 30);
  }
  function close() {
    panel.hidden = true;
    document.documentElement.classList.remove('sf-chat-open');
    launch.setAttribute('aria-expanded', 'false');
    launch.focus({ preventScroll: true });
  }
  launch.addEventListener('click', function () { open('launcher'); });
  panel.querySelector('.sfc-x').addEventListener('click', close);
  panel.querySelector('.sfc-new').addEventListener('click', function () {
    if (busy) return;
    history = []; save(); renderAll();
    input.focus({ preventScroll: true });
  });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  // Any element with data-sf-chat opens the panel; data-sf-chat="question" also asks it.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-sf-chat]');
    if (!t) return;
    e.preventDefault();
    open('link');
    var q = t.getAttribute('data-sf-chat');
    if (q && q.length > 2) ask(q.slice(0, 200), 'link');
  });

  // ---------------------------------------------------------- teaser
  // At most once per session, never after the chat was opened, only where it
  // has something page-specific to offer, and gone for good once dismissed.
  var teaseTimer = null;
  function hideTease(dismissed) {
    if (tease.hidden) return;
    tease.hidden = true;
    clearTimeout(teaseTimer);
    if (dismissed) track('chat_teaser', 'dismissed', { page: path });
  }
  function showTease() {
    if (!OPEN.teaser || ss(TEASED) || ss(OPENED) || !panel.hidden) return;
    var root = document.documentElement.classList;
    if (root.contains('sf-modal-open') || root.contains('sf-menu-open')) return;
    ss(TEASED, '1');
    tease.querySelector('.sfc-tease__go').textContent = OPEN.teaser;
    tease.hidden = false;
    launch.setAttribute('data-dot', '');
    track('chat_teaser', 'shown', { page: path });
    teaseTimer = setTimeout(function () { hideTease(false); }, 14000);
  }
  tease.querySelector('.sfc-tease__go').addEventListener('click', function () { track('chat_teaser', 'clicked', { page: path }); open('teaser'); });
  tease.querySelector('.sfc-tease__x').addEventListener('click', function () { hideTease(true); launch.removeAttribute('data-dot'); });
  if (OPEN.teaser && !ss(TEASED) && !ss(OPENED)) {
    if (KIND === 'post') {
      var onScroll = function () {
        var d = document.documentElement;
        if ((window.scrollY + window.innerHeight) / Math.max(d.scrollHeight, 1) > 0.45) { window.removeEventListener('scroll', onScroll); showTease(); }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    } else {
      setTimeout(showTease, KIND === 'pdp' ? 25000 : 30000);
    }
  }

  // ---------------------------------------------------------- placement
  // Keep the launcher (and teaser) above whatever is pinned to the bottom of
  // the screen: the sticky buy strip (.mobile-bar.visible) and the consent bar.
  function lift() {
    var h = 0;
    var bars = document.querySelectorAll('.mobile-bar.visible, #smelloff-consent-bar');
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      var cs = getComputedStyle(b);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = b.getBoundingClientRect();
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
