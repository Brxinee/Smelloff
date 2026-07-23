/* Blog share widget — wires social share links + copy-link + native share
   from the page's canonical URL and title. No dependencies, no tracking. */
(function () {
  function canonicalURL() {
    var link = document.querySelector('link[rel="canonical"]');
    return (link && link.href) || location.href;
  }
  function pageTitle() {
    var og = document.querySelector('meta[property="og:title"]');
    return (og && og.content) || document.title || 'Smelloff';
  }

  var url = canonicalURL();
  var title = pageTitle();
  var eu = encodeURIComponent(url);
  var et = encodeURIComponent(title);

  var targets = {
    whatsapp: 'https://wa.me/?text=' + et + '%20' + eu,
    x: 'https://twitter.com/intent/tweet?text=' + et + '&url=' + eu,
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + eu,
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + eu,
    telegram: 'https://t.me/share/url?url=' + eu + '&text=' + et
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
        navigator.share({ title: title, url: url }).catch(function () {});
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
