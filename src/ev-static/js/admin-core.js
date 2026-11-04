/* =====================================================================
   Aqlyon Brand Management — event manager (/manage)
   Shared helpers and the login / page shell. The event screens come from
   admin-events.js, admin-checkin.js, admin-import.js, admin-report.js and
   admin-formbuilder.js (the same module as the Career Discovery Centre site).
   ===================================================================== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SVG={
 cursor:'<svg viewBox="0 0 24 24"><path d="M4 2.5l14.5 10.8-6.3.9 3.9 7.4-3 1.6-3.9-7.5L4 20.4z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
 play:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#FFD84D"/><path d="M10 7.5l7 4.5-7 4.5z" fill="#1A1E3A"/></svg>',
 replay:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
 speak:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
 star:'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="currentColor"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 back:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
 next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
 map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
 laptop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/></svg>',
 warm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="2"/><path d="M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 14.5h10"/></svg>',
 bulb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
 game:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9h4M8 7v4M15 8h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.6 5.6A2.8 2.8 0 0 0 7 16.3L8.6 14h6.8l1.6 2.3a2.8 2.8 0 0 0 4.9-2.1l-.6-5.6A4 4 0 0 0 17.3 5z"/></svg>',
 flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
 chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
 help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.8M12 17h.01"/></svg>',
 user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
 logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
 wifi:'<svg viewBox="0 0 24 18"><path d="M12 16.5l2.6-3.1a4 4 0 0 0-5.2 0zM5.7 9.2l1.8 2.1a7 7 0 0 1 9 0l1.8-2.1a9.8 9.8 0 0 0-12.6 0zM1.7 4.5l1.8 2.1a13 13 0 0 1 17 0l1.8-2.1a15.8 15.8 0 0 0-20.6 0z" fill="#1d1d1f"/></svg>',
 cc:'<svg viewBox="0 0 24 18"><rect x="1" y="1.5" width="22" height="6" rx="3" fill="none" stroke="#1d1d1f" stroke-width="1.8"/><circle cx="17" cy="4.5" r="2" fill="#1d1d1f"/><rect x="1" y="10.5" width="22" height="6" rx="3" fill="none" stroke="#1d1d1f" stroke-width="1.8"/><circle cx="7" cy="13.5" r="2" fill="#1d1d1f"/></svg>',
 vol:'<svg viewBox="0 0 24 18"><path d="M3 6v6h4l5 4V2L7 6z" fill="#1d1d1f"/><path d="M15 5.5a5 5 0 0 1 0 7M17.5 3a8.5 8.5 0 0 1 0 12" stroke="#1d1d1f" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
 bat:'<svg viewBox="0 0 26 14"><rect x="1" y="1" width="21" height="12" rx="3" fill="none" stroke="#1d1d1f" stroke-width="1.6"/><rect x="3.5" y="3.5" width="14" height="7" rx="1.2" fill="#1d1d1f"/><rect x="23" y="4.5" width="2" height="5" rx="1" fill="#1d1d1f"/></svg>',
 search:'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="#666" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
 alL:'<svg viewBox="0 0 20 20" stroke="#333" stroke-width="2"><path d="M3 5h14M3 9h9M3 13h14M3 17h9"/></svg>',
 alC:'<svg viewBox="0 0 20 20" stroke="#333" stroke-width="2"><path d="M3 5h14M5.5 9h9M3 13h14M5.5 17h9"/></svg>',
 alR:'<svg viewBox="0 0 20 20" stroke="#333" stroke-width="2"><path d="M3 5h14M8 9h9M3 13h14M8 17h9"/></svg>',
 bul:'<svg viewBox="0 0 20 20"><circle cx="4" cy="6" r="1.6" fill="#333"/><circle cx="4" cy="14" r="1.6" fill="#333"/><path d="M8 6h10M8 14h10" stroke="#333" stroke-width="2"/></svg>',
 pic:'<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#8fd3ff"/><path d="M2 17l6-6 5 5 3-3 6 6v1H2z" fill="#4caf50"/><circle cx="16.5" cy="8.5" r="2" fill="#FFE066"/></svg>',
 table:'<svg viewBox="0 0 24 24" fill="none" stroke="#185ABD" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/></svg>',
 shapes:'<svg viewBox="0 0 24 24"><circle cx="8" cy="9" r="5" fill="#FF6B8B"/><rect x="11" y="11" width="10" height="9" rx="1" fill="#2F7BF6"/></svg>',
 chart:'<svg viewBox="0 0 24 24"><rect x="4" y="12" width="4" height="8" fill="#2F7BF6"/><rect x="10" y="6" width="4" height="14" fill="#107C41"/><rect x="16" y="9" width="4" height="11" fill="#F0A500"/></svg>',
 sigma:'<svg viewBox="0 0 24 24"><path d="M17 5H6l6 7-6 7h11" fill="none" stroke="#107C41" stroke-width="2.4" stroke-linejoin="round"/></svg>',
 clip:'<svg viewBox="0 0 24 24" width="1.3em" height="1.3em" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round"><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L14.8 7"/></svg>',
 send:'<svg viewBox="0 0 24 24" width="1.3em" height="1.3em"><path d="M3 11l18-8-8 18-2-8z" fill="#2F7BF6"/></svg>',
 reply:'<svg viewBox="0 0 24 24" width="1.3em" height="1.3em" fill="none" stroke="#555" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 7L4 12l6 5"/><path d="M4 12h10a6 6 0 0 1 6 6"/></svg>',
 shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
 lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
 power:'<svg viewBox="0 0 24 24" width="1.2em" height="1.2em" fill="none" stroke="#333" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>',
};
const root=$('#admin');
const AAPI={
 // "Keep me signed in" stores the login on this device (so badge QR links open straight into check-in)
 token:()=>{try{return sessionStorage.getItem('dm-admin')||localStorage.getItem('dm-admin')}catch(e){return null}},
 setToken:(t,keep)=>{try{sessionStorage.removeItem('dm-admin');localStorage.removeItem('dm-admin');if(t)(keep?localStorage:sessionStorage).setItem('dm-admin',t)}catch(e){}},
 async call(path,{method='GET',body}={}){
  const h={'content-type':'application/json'};const t=AAPI.token();if(t)h.authorization='Bearer '+t;
  let r;try{r=await fetch('/api'+path,{method,headers:h,body:body?JSON.stringify(body):undefined})}catch(e){throw new Error('Can\'t reach the server.')}
  let d={};try{d=await r.json()}catch(e){}
  if(r.status===401&&path!=='/admin/login'){AAPI.setToken(null);if(self!==top)parent.postMessage('aqlyon-admin:logout',location.origin);loginView('Please log in again.');throw new Error('Admin login needed.')}
  if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;
 }
};
const fmtDate=s=>s?new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'–';
const ago=s=>{if(!s)return'Never';const d=(Date.now()-new Date(s))/864e5;return d<1?'Today':d<2?'Yesterday':d<7?Math.floor(d)+' days ago':fmtDate(s)};
function toast(msg,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
// scroll an element into view inside its popup (scrolling the page would shift the popup)
function mScroll(el,gap=80){const md=el&&el.closest('.modal');if(!md)return el&&el.scrollIntoView({block:'center'});md.scrollTo({top:md.scrollTop+el.getBoundingClientRect().top-md.getBoundingClientRect().top-gap,behavior:'smooth'})}
function modal(html,onReady){const m=document.createElement('div');m.className='modalbg';m.innerHTML=`<div class="modal" role="dialog" aria-modal="true">${html}</div>`;document.body.appendChild(m);
 const close=()=>m.remove();
 // the dark background never scrolls; if something tries (e.g. focusing a hidden field), put it straight back
 m.addEventListener('scroll',()=>{if(m.scrollTop||m.scrollLeft){m.scrollTop=0;m.scrollLeft=0}});
 // clicking outside closes only simple messages; a window with things to fill in closes with its own buttons, so nothing typed is lost
 let downOut=false;m.addEventListener('pointerdown',e=>{downOut=e.target===m});
 m.addEventListener('click',e=>{if(e.target.closest('[data-close]'))return close();if(e.target===m&&downOut&&!m.querySelector('input:not([type=checkbox]):not([type=radio]),textarea,select'))close()});document.addEventListener('keydown',function k(e){if(!m.isConnected)return document.removeEventListener('keydown',k);if(e.key==='Escape'&&m===[...document.querySelectorAll('.modalbg')].pop()){close();document.removeEventListener('keydown',k)}});onReady&&onReady(m,close);return close}
// copy text (links) to the clipboard; older phones get a box to copy from
async function copy(t){try{await navigator.clipboard.writeText(t);toast('Link copied')}catch(e){prompt('Copy this link',t)}}
function confirmBox(title,text,okLabel,danger){return new Promise(res=>modal(`<h2>${title}</h2><p>${text}</p><div class="mrow"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn ${danger?'danger':''} ok">${okLabel}</button></div>`,(m,close)=>{$('.ok',m).onclick=()=>{close();res(true)};m.addEventListener('click',e=>{if(e.target.closest('[data-close]')||e.target===m)res(false)})}))}

function loginView(msg=''){
 root.innerHTML=`<main class="auth"><div class="authcard"><div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 14px"><img src="/img/aqlyon-q.png" alt="" style="height:40px;width:auto"><span style="text-align:left;line-height:1.1"><b style="font-size:20px">Aqlyon</b><br><small>Brand Management</small></span></div><h1>Event manager</h1><p class="lead">Create events, manage registrations and check people in.</p><form class="authform"><div class="field"><label for="ap">Admin password</label><input id="ap" type="password" autocomplete="current-password" required></div><label class="ck keep"><input type="checkbox" id="keep" checked><span>Keep me signed in on this device <small>(for 2 weeks, handy for scanning badges)</small></span></label>${location.hash.startsWith('#checkin/')?'<p class="tipbox" style="margin:0 0 12px"><b>Helping with check-in?</b> You don\'t need to log in. Open the check-in link the organiser sent you and press <b>Scan badge</b> there.</p>':''}<p class="formerr" role="alert">${esc(msg)}</p><button class="btn" type="submit">Log in ${SVG.next}</button></form><p class="small"><a href="/">Back to the website</a> · <a href="/admin/">Website content (blog, logos, galleries)</a></p></div></main>`;
 $('form').onsubmit=async e=>{e.preventDefault();const b=$('button',e.target);b.disabled=true;$('.formerr').textContent='';
  try{const keep=$('#keep').checked;const d=await AAPI.call('/admin/login',{method:'POST',body:{password:$('#ap').value,remember:keep}});AAPI.setToken(d.token,keep);dashboard()}catch(err){$('.formerr').textContent=err.message;b.disabled=false}};
 $('#ap').focus();
}
async function dashboard(){
 root.innerHTML=`<header class="top"><div class="in"><span class="brand"><img src="/img/aqlyon-q.png" alt="" width="28" height="28" style="border-radius:7px"><span>Event manager</span></span><a class="userbtn" href="/events/" target="_blank" rel="noopener" style="margin-left:auto">View events page ↗</a><button type="button" class="userbtn" id="alo">${SVG.logout}<span>Log out</span></button></div></header><div class="wrap admtabwrap"></div><main class="wrap adm"><p class="lead" style="margin-top:20px">Loading…</p></main>`;
 $('#alo').onclick=()=>{AAPI.setToken(null);loginView()};
 const h=location.hash;showTab(h.startsWith('#checkin/')||h.startsWith('#scan')?'checkin':'events');
}
