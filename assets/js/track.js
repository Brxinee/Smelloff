/* Smelloff — first-party, cookieless event beacon (page views, clicks, funnel). */
(function () {
  'use strict';
  if (window.smfTrack) return;
  var ENDPOINT = '/api/track', noop = function () {};
  function smfIsBot() { try { var n=navigator; return n.webdriver===true || /Headless|PhantomJS|Puppeteer|Playwright|Electron\//i.test(n.userAgent||'') || window._phantom || window.callPhantom || window.__nightmare || !!(n.languages&&n.languages.length===0); } catch(e){ return false; } }
  window.smfIsBot=smfIsBot;
  if(location.search){var r=document.querySelector('meta[name="robots"]');if(!r){r=document.createElement('meta');r.name='robots';document.head.appendChild(r)}r.content='noindex,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'}
  var owner=false;try{owner=localStorage.getItem('smelloff_owner')==='1'}catch(e){}
  if(owner||smfIsBot()||/^\/(admin|api)(\/|$)/.test(location.pathname||'/')){window.smfTrack=noop;return}
  var sid='';try{sid=sessionStorage.getItem('smf_sid')||'';if(!sid){sid=Date.now().toString(36)+Math.random().toString(36).slice(2,10);sessionStorage.setItem('smf_sid',sid)}}catch(e){}
  function send(p){try{p=p||{};p.path=p.path||location.pathname;p.ref=p.ref||document.referrer||'';if(sid)p.session=sid;var s=localStorage.getItem('smelloff_utm_source'),m=localStorage.getItem('smelloff_utm_medium'),c=localStorage.getItem('smelloff_utm_campaign');if(s||m||c){p.meta=p.meta||{};if(s)p.meta.utm_source=s;if(m)p.meta.utm_medium=m;if(c)p.meta.utm_campaign=c}var b=JSON.stringify(p);if(navigator.sendBeacon)navigator.sendBeacon(ENDPOINT,new Blob([b],{type:'application/json'}));else fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true}).catch(noop)}catch(e){}}
  window.smfTrack=send;
  if(!window.__smelloffPV){window.__smelloffPV=true;send({type:'pageview'})}
  var ps=history.pushState;history.pushState=function(){ps.apply(this,arguments);send({type:'pageview'})};addEventListener('popstate',function(){send({type:'pageview'})});
  if(location.pathname==='/'||location.pathname===''||/^\/odorstrike\/?$/.test(location.pathname))send({type:'product_view',label:'ODORSTRIKE Fabric Mist'});
  addEventListener('click',function(e){if(e.isTrusted===false)return;var el=e.target&&e.target.closest?e.target.closest('a,button,[data-track]'):null;if(!el||el.closest&&el.closest('#smelloff-consent-bar'))return;var label=(el.getAttribute('data-track')||el.innerText||el.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,120);if(!label)return;var href=el.getAttribute('href');send({type:'click',label:label,meta:href?{href:href}:{}})},true)
})();
