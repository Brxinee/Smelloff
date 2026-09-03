/* =====================================================================
   Smelloff BuyModule — hydrates [data-so-buy] from SMELLOFF_PRODUCT_TRUTH.
   Does not own checkout math. Selections are handed to checkout.js
   canonical purchase state (window.getPurchaseState / selectPay / buyNow).
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
  return '/?buy=1';
}

function packQty(root) {
  var pressed = root.querySelector('[data-so-pack][aria-checked="true"], [data-so-pack][aria-pressed="true"]');
  if (pressed) {
    var n = parseInt(pressed.getAttribute('data-so-pack'), 10);
    if (n >= 1 && n <= 5) return n;
  }
  if (typeof window.getPurchaseState === 'function') {
    try {
      var st = window.getPurchaseState();
      if (st && st.quantity) return st.quantity;
    } catch (e) {}
  }
  return 1;
}

function displayTotal(root, method) {
  if (typeof window.getPurchaseState === 'function') {
    try {
      var st = window.getPurchaseState();
      var qty = packQty(root);
      if (typeof window.setPurchaseQuantity === 'function') {
        st = window.setPurchaseQuantity(qty) || st;
      }
      var pay = method || (root.getAttribute('data-pay') === 'cod' ? 'cod' : 'prepaid');
      var sub = st && typeof st.subtotal === 'number' ? st.subtotal : T.pricePrepaid;
      var fee = pay === 'cod' ? (T.codFee || 60) : 0;
      return sub + fee;
    } catch (e) {}
  }
  var qty = packQty(root);
  var sub = qty === 2 ? 429 : qty === 3 ? 599 : T.pricePrepaid * qty;
  return sub + (method === 'cod' ? (T.codFee || 60) : 0);
}

function setPay(root, method) {
  var pay = method === 'cod' ? 'cod' : 'prepaid';
  var opts = root.querySelectorAll('[data-so-pay]');
  for (var i = 0; i < opts.length; i++) {
    var on = opts[i].getAttribute('data-so-pay') === pay;
    opts[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  var cta = root.querySelector('[data-so-cta]');
  if (cta) cta.textContent = 'Buy ODORSTRIKE — ' + rupee(displayTotal(root, pay));
  root.setAttribute('data-pay', pay);
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
        var qty = packQty(root);
        if (typeof window.setPurchaseQuantity === 'function') window.setPurchaseQuantity(qty);
        var selectedPay = root.getAttribute('data-pay') === 'cod' ? 'cod' : 'prepaid';
        if (typeof window.selectPay === 'function') window.selectPay(selectedPay);
        window.buyNow();
      }
    });
  }

  var opts = root.querySelectorAll('[data-so-pay]');
  for (var i = 0; i < opts.length; i++) {
    opts[i].addEventListener('click', function () {
      var pay = this.getAttribute('data-so-pay');
      setPay(root, pay);
      if (typeof window.selectPay === 'function') window.selectPay(pay);
    });
  }

  var packs = root.querySelectorAll('[data-so-pack]');
  for (var p = 0; p < packs.length; p++) {
    packs[p].addEventListener('click', function () {
      var qty = parseInt(this.getAttribute('data-so-pack'), 10) || 1;
      if (typeof window.setPurchaseQuantity === 'function') window.setPurchaseQuantity(qty);
      setPay(root, root.getAttribute('data-pay') === 'cod' ? 'cod' : 'prepaid');
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
