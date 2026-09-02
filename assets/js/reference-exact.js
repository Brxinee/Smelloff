(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const packs = {
    One:{bottles:1,price:299,note:'₹299 / bottle',copy:'Start with one 50 ml ODORSTRIKE bottle for everyday carry.'},
    'The Duo':{bottles:2,price:549,note:'₹274.50 / bottle · save 8%',copy:'One for home. One for your bag, car or office.'},
    'The Trio':{bottles:3,price:699,note:'₹233 / bottle · save 22%',copy:'The daily rotation: wardrobe, gym bag and car.'},
    'The Six':{bottles:6,price:1199,note:'₹199.83 / bottle · best value',copy:'Keep ODORSTRIKE wherever odor shows up.'}
  };
  let cart={bottles:0,name:'',total:0};
  const money=n=>`₹${Number(n).toLocaleString('en-IN')}`;
  function drawer(open){$('#cart-drawer')?.classList.toggle('open',open);$('#cart-backdrop')?.classList.toggle('open',open);document.body.classList.toggle('drawer-open',open)}
  function renderCart(){ $('#cart-count').textContent=cart.bottles; $('#bag-count-label').textContent=cart.bottles?`(${cart.bottles})`:''; $('#cart-line').innerHTML=cart.bottles?`<div class="cartitem"><span><strong>${cart.name}</strong><small>${packs[cart.name].bottles} × 50 ml</small></span><b>${money(cart.total)}</b></div>`:'Your bag is empty.'; $('#cart-total').textContent=money(cart.total)}
  function add(name){const p=packs[name]||packs.One;cart.bottles+=p.bottles;cart.name=name;cart.total+=p.price;renderCart();drawer(true)}
  $$('[data-add]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.add||'One')));
  $$('.pack[data-pack]').forEach(b=>b.addEventListener('click',()=>{ $$('.pack[data-pack]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); const p=packs[b.dataset.pack]; $('#detail-name').textContent=b.dataset.pack; $('#detail-copy').textContent=p.copy; $('#detail-price').textContent=money(p.price); $('#detail-note').textContent=p.note; $('#detail-add').dataset.add=b.dataset.pack; }));
  $('#cart-open')?.addEventListener('click',()=>drawer(true));$('#drawer-close')?.addEventListener('click',()=>drawer(false));$('#cart-backdrop')?.addEventListener('click',()=>drawer(false));$('#menu-btn')?.addEventListener('click',()=>$('#mobile-nav')?.classList.toggle('open'));
  $$('.faqq').forEach(q=>q.addEventListener('click',()=>q.parentElement.classList.toggle('open')));
  const questions=[{q:'Where is odor loudest?',options:[['clothes','Clothes','Shirts, jackets, commute'],['shoes','Shoes','Sneakers, trainers, socks'],['bags','Bags & upholstery','Gym bags, backpacks, sofas'],['car','Car','Seats, mats, fabric interiors']]},{q:'How much backup do you want?',options:[['one','One bottle','Start with ODORSTRIKE'],['two','Two bottles','Home + carry'],['three','Three bottles','Your daily rotation'],['six','The stash','Keep one wherever odor shows up']]}];
  let step=0;
  function renderFinder(){const box=$('#finder-box');if(!box)return;const q=questions[step];box.innerHTML=`<div class="stepcount">${step+1} of 2</div><div class="question">${q.q}</div><div class="options">${q.options.map(([id,label,hint])=>`<button class="option" data-finder="${id}"><b>${label}</b><span>${hint}</span></button>`).join('')}</div>`;$$('[data-finder]',box).forEach(b=>b.addEventListener('click',()=>{if(step===0){step=1;renderFinder();return}const map={one:'One',two:'The Duo',three:'The Trio',six:'The Six'};const name=map[b.dataset.finder]||'The Trio';const p=packs[name];box.innerHTML=`<div class="kicker">Your set</div><div class="question">${name}</div><p class="lead">${p.copy}</p><div class="packprice" style="margin-top:18px">${money(p.price)}</div><div class="actions" style="margin-top:24px"><button class="btn btn-dark" data-add="${name}">Add ${name}</button><button class="btn btn-soft" id="finder-reset">Start over</button></div>`;$('[data-add]',box).addEventListener('click',()=>add(name));$('#finder-reset').addEventListener('click',()=>{step=0;renderFinder()})}))}
  renderFinder();$('#newsletter')?.addEventListener('submit',e=>{e.preventDefault();e.currentTarget.innerHTML='<div class="question" style="margin:0">You’re on the list. Quietly.</div>'});renderCart();
})();