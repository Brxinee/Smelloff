/* =====================================================================
   Smelloff BuyModule — hydrates [data-so-buy] from SMELLOFF_PRODUCT_TRUTH.
   Does not rewrite checkout. CTA wraps /odorstrike?buy=1 or window.buyNow().
   ===================================================================== */
import { SMELLOFF_PRODUCT_TRUTH as T } from '/shared/product-truth.js';

function rupee(n) {
  return '₹' + n;
}

function waHref() {
  var num = String(T.whatsappNumber || '').replace(/^\+/, '');
  var text = 'Hi Smelloff, I would like to order ODORSTRIKE 50ml.';
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
}

function checkoutHref() {
  if (typeof window.buyNow === 'function') return '#';
  return '/odorstrike?buy=1';
}

function setPay(root, method) {
  var prepaid = method !== 'cod';
  var opts = root.querySelectorAll('[data-so-pay]');
  for (var i = 0; i < opts.length; i++) {
    var on = opts[i].getAttribute('data-so-pay') === method;
    opts[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  var cta = root.querySelector('[data-so-cta]');
  if (cta) {
    var amount = prepaid ? T.pricePrepaid : T.priceCod;
    cta.textContent = 'Buy ODORSTRIKE — ' + rupee(amount);
  }
  root.setAttribute('data-pay', method);
}

function hydrate(root) {
  if (root.getAttribute('data-so-ready') === '1') return;
  root.setAttribute('data-so-ready', '1');

  var name = root.querySelector('[data-so-name]');
  if (name) name.textContent = T.productName;
  var cat = root.querySelector('[data-so-cat]');
  if (cat) cat.textContent = T.size + ' ' + T.category;
  var prepaidPrice = root.querySelector('[data-so-prepaid-price]');
  if (prepaidPrice) prepaidPrice.textContent = rupee(T.pricePrepaid);
  var codPrice = root.querySelector('[data-so-cod-price]');
  if (codPrice) codPrice.textContent = rupee(T.priceCod);
  var codFee = root.querySelector('[data-so-cod-fee]');
  if (codFee) codFee.textContent = rupee(T.codFee) + ' handling';
  var wa = root.querySelector('[data-so-wa]');
  if (wa) {
    wa.setAttribute('href', waHref());
    wa.setAttribute('target', '_blank');
    wa.setAttribute('rel', 'noopener');
  }
  var cta = root.querySelector('[data-so-cta]');
  if (cta) {
    cta.setAttribute('href', checkoutHref());
    cta.addEventListener('click', function (e) {
      if (typeof window.buyNow === 'function') {
        e.preventDefault();
        window.buyNow();
      }
    });
  }

  var opts = root.querySelectorAll('[data-so-pay]');
  for (var i = 0; i < opts.length; i++) {
    opts[i].addEventListener('click', function () {
      setPay(root, this.getAttribute('data-so-pay'));
    });
  }
  setPay(root, 'prepaid');
}

function init() {
  var nodes = document.querySelectorAll('[data-so-buy]');
  for (var i = 0; i < nodes.length; i++) hydrate(nodes[i]);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { hydrate, init };
