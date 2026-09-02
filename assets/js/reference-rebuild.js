(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cart = { bottles: 0, pack: "The Trio", total: 0 };
  const packs = {
    "One": { bottles: 1, price: 299, note: "₹299 / bottle", blurb: "Start with one 50 ml ODORSTRIKE bottle for everyday carry." },
    "The Duo": { bottles: 2, price: 549, note: "₹274.50 / bottle · save 8%", blurb: "One for home. One for your bag, car or office." },
    "The Trio": { bottles: 3, price: 699, note: "₹233 / bottle · save 22%", blurb: "The daily rotation: wardrobe, gym bag and car." },
    "The Six": { bottles: 6, price: 1199, note: "₹199.83 / bottle · best value", blurb: "Keep ODORSTRIKE wherever odor shows up." }
  };
  const formatter = n => `₹${n.toLocaleString("en-IN")}`;

  function addPack(name = "The Trio") {
    const p = packs[name];
    cart.bottles += p.bottles;
    cart.total += p.price;
    cart.pack = name;
    $("#cart-count").textContent = cart.bottles;
    $("#cart-line").innerHTML = `<div class="rr-cart-line"><span>${name}<small style="display:block;color:var(--rr-muted);margin-top:3px">${p.bottles} × 50 ml</small></span><b>${formatter(p.price)}</b></div>`;
    $("#cart-total").innerHTML = `<span>Total</span><b>${formatter(cart.total)}</b>`;
    $("#cart-drawer").classList.add("open");
    $("#cart-backdrop").classList.add("open");
  }

  $$("[data-pack]").forEach(btn => btn.addEventListener("click", () => {
    $$("[data-pack]").forEach(x => x.classList.remove("is-active"));
    btn.classList.add("is-active");
    const name = btn.dataset.pack;
    const p = packs[name];
    $("#pack-detail-name").textContent = name;
    $("#pack-detail-copy").textContent = p.blurb;
    $("#pack-detail-price").textContent = formatter(p.price);
    $("#pack-detail-note").textContent = p.note;
    $("#selected-pack").value = name;
  }));

  $$("[data-add]").forEach(btn => btn.addEventListener("click", () => addPack(btn.dataset.add || $("#selected-pack").value || "The Trio")));
  $("#drawer-close")?.addEventListener("click", () => { $("#cart-drawer").classList.remove("open"); $("#cart-backdrop").classList.remove("open"); });
  $("#cart-backdrop")?.addEventListener("click", () => { $("#cart-drawer").classList.remove("open"); $("#cart-backdrop").classList.remove("open"); });

  let finderStep = 0, finderWhere = "clothes";
  const questions = [
    { q: "Where is odor loudest?", options: [["clothes","Clothes","Shirts, jackets, commute"],["shoes","Shoes","Sneakers, trainers, socks"],["bags","Bags & sofas","Gym bags, backpacks, upholstery"],["car","Car","Seats, mats, closed air"]] },
    { q: "How much backup do you want?", options: [["one","One bottle","Start with ODORSTRIKE"],["two","Two bottles","Home + carry"],["three","Three bottles","Your daily rotation"],["six","The stash","Keep one wherever odor shows up"]] }
  ];
  function renderFinder() {
    const box = $("#finder-box");
    const q = questions[finderStep];
    box.innerHTML = `<div class="rr-step-count">${finderStep + 1} of 2</div><div class="rr-question">${q.q}</div><div class="rr-option-grid">${q.options.map(([id,label,hint]) => `<button class="rr-option" data-finder="${id}"><b>${label}</b><span>${hint}</span></button>`).join("")}</div>`;
    $$("[data-finder]", box).forEach(b => b.addEventListener("click", () => {
      if (finderStep === 0) { finderWhere = b.dataset.finder; finderStep = 1; renderFinder(); return; }
      const map = { one: "One", two: "The Duo", three: "The Trio", six: "The Six" };
      const pick = map[b.dataset.finder] || "The Trio";
      const p = packs[pick];
      box.innerHTML = `<div class="rr-kicker">Your set</div><div class="rr-question">${pick}</div><p class="rr-lead">${p.blurb}</p><div style="margin:18px 0;font:500 28px var(--rr-serif)">${formatter(p.price)}</div><div class="rr-actions"><button class="rr-btn rr-btn-dark" data-result-add="${pick}">Add ${pick}</button><button class="rr-btn rr-btn-soft" id="finder-reset">Start over</button></div>`;
      $("[data-result-add]")?.addEventListener("click", () => addPack(pick));
      $("#finder-reset")?.addEventListener("click", () => { finderStep = 0; renderFinder(); });
    }));
  }
  renderFinder();

  $$(".rr-faq-q").forEach(q => q.addEventListener("click", () => q.parentElement.classList.toggle("open")));
  $("#newsletter")?.addEventListener("submit", e => { e.preventDefault(); $("#newsletter-msg").textContent = "You’re in. We’ll keep it useful."; });
})();