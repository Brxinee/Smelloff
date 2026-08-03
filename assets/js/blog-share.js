/* Blog share widget — wires social share links + copy-link + native share
   from the page's canonical URL and title. No dependencies, no tracking.

   Share copy comes from optional per-post meta tags, stamped by
   scripts/share/apply-share-templates.mjs from scripts/share/share-templates.config.mjs:

     <meta name="share:whatsapp" content="…{url}…">
     <meta name="share:x"        content="…">

   A post without them falls back to its title, which is what every post did
   before the templates existed — so this is additive and nothing breaks if a
   slug is missing from the config.

   Facebook and LinkedIn are deliberately absent from that list. Facebook's
   sharer.php accepts the URL only and pre-filling a caption is against Meta's
   platform policy; LinkedIn's share-offsite accepts the URL only and the older
   shareArticle title/summary parameters are deprecated and ignored. For both,
   the share card is whatever og:title / og:description / og:image say. */
(function () {
  function meta(sel, attr) {
    var m = document.querySelector(sel);
    return (m && (m.getAttribute(attr) || '').trim()) || '';
  }
  function canonicalURL() {
    var link = document.querySelector('link[rel="canonical"]');
    return (link && link.href) || location.href;
  }

  var url = canonicalURL();
  var title = meta('meta[property="og:title"]', 'content') || document.title || 'Smelloff';

  // A template may place the link mid-sentence with {url}; if it doesn't, the
  // link goes on the end, which is where a person would put it anyway.
  function render(tpl, fallback) {
    var text = tpl || fallback;
    if (text.indexOf('{url}') !== -1) {
      return { text: text.replace(/\{url\}/g, url), inline: true };
    }
    return { text: text, inline: false };
  }

  var wa = render(meta('meta[name="share:whatsapp"]', 'content'), title);
  var xt = render(meta('meta[name="share:x"]', 'content'), title);

  var eu = encodeURIComponent(url);

  // Telegram and X take the link in their own `url` parameter and render it
  // themselves, so a template that inlined {url} would show it twice. Strip it
  // back out of the text for those two. WhatsApp has no url parameter — the
  // whole message is one blob — so there the inline position is honoured as
  // written, and an absent {url} is appended.
  function withoutURL(s) {
    return s.replace(url, '').replace(/\s+/g, ' ').replace(/[\s:—-]+$/, '').trim();
  }

  var targets = {
    whatsapp:
      'https://wa.me/?text=' +
      encodeURIComponent(wa.inline ? wa.text : wa.text + ' ' + url),
    telegram:
      'https://t.me/share/url?url=' + eu + '&text=' + encodeURIComponent(withoutURL(wa.text)),
    x:
      'https://twitter.com/intent/tweet?text=' +
      encodeURIComponent(withoutURL(xt.text)) +
      '&url=' + eu,
    // URL only, by platform rule. See the note at the top of this file.
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + eu,
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + eu
  };

  document.querySelectorAll('.post-share [data-share]').forEach(function (a) {
    var net = a.getAttribute('data-share');
    if (targets[net]) a.setAttribute('href', targets[net]);
  });

  // Native share sheet (mobile) — reveal only where supported.
  document.querySelectorAll('.post-share [data-share-native]').forEach(function (btn) {
    if (navigator.share) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        navigator.share({ title: title, text: wa.inline ? undefined : wa.text, url: url })
          .catch(function () {});
      });
    }
  });

  // Copy link — Clipboard API with a legacy fallback.
  document.querySelectorAll('.post-share [data-share-copy]').forEach(function (btn) {
    var label = btn.querySelector('.ps-copy-label');
    var original = label ? label.textContent : '';
    function done() {
      if (label) label.textContent = 'Copied!';
      btn.classList.add('is-copied');
      setTimeout(function () {
        if (label) label.textContent = original;
        btn.classList.remove('is-copied');
      }, 1800);
    }
    function fallback() {
      var t = document.createElement('textarea');
      t.value = url;
      t.setAttribute('readonly', '');
      t.style.position = 'absolute';
      t.style.left = '-9999px';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(t);
    }
    btn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(fallback);
      } else {
        fallback();
      }
    });
  });
})();
