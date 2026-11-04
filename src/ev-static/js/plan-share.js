/* Team page for the event planner (/plan#<key>): see the checklists and program chart, and tick items off
   if the organiser allowed it. Ticks from others appear within 20 seconds. */
(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const PV=window.PlanView,esc=PV.esc;
const toast=(m,bad)=>{const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)};
const KEY=(location.hash.match(/^#([a-f0-9]{24})/)||[])[1]||'';
const main=$('#plan');let D=null,tab='lists',busy=0;
const store={get:k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
let me=store.get('plan-name');
const blocked=msg=>{main.innerHTML=`<div class="empty" style="margin-top:30px"><p><b>This planner is not available</b></p><p>${esc(msg)}</p></div>`};
async function call(path='',opts={}){let r;try{r=await fetch('/api/plan/'+KEY+path,{method:opts.method||'GET',headers:{'content-type':'application/json'},body:opts.body?JSON.stringify(opts.body):undefined})}catch(e){throw new Error('No internet connection. Try again.')}
 let d={};try{d=await r.json()}catch(e){}if(r.status===403){blocked(d.error||'This link is not valid.');throw new Error(d.error)}if(!r.ok)throw new Error(d.error||'Something went wrong.');return d}
function draw(){
 const k=PV.count(D.plan.checklists),P=D.plan.program,prog=D.kind==='program';tab=prog?'program':'lists';
 main.innerHTML=`<div class="plteam">${PV.head(D.event)}</div><div class="plkind"><h2>${prog?'🕒 Program chart':'✅ Preparation checklist'}</h2><button type="button" class="btn sm ghost" id="pp">🖨 Print ${prog?'program chart':'checklist'}</button></div>
 ${prog?'':`<div class="ckcount"><b>${k.d}</b> of ${k.n} tasks done<div class="ckprog"><i style="width:${PV.pct(k)}%"></i></div></div>
 ${D.tick?`<div class="field plme"><label for="me">Your name <small>(shown next to the items you tick)</small></label><input id="me" maxlength="60" value="${esc(me)}" placeholder="e.g. Shameer" autocomplete="name"></div>`:'<p class="tipbox small">View only. Ask the organiser if you need to tick items off.</p>'}`}
 <div class="plview">${prog?PV.program(D.plan):PV.lists(D.plan,{tick:D.tick,hideEmpty:true})}</div>`;
 $('#pp').onclick=()=>{if(!PV.print(D.plan,D.event,tab))toast('Allow pop-ups to print.',true)};
 const mi=$('#me');if(mi)mi.oninput=()=>{me=mi.value.trim();store.set('plan-name',me)};
 $$('[data-item]').forEach(cb=>cb.onchange=async()=>{
  if(cb.checked&&!me){cb.checked=false;const n=$('#me');n.focus();n.classList.add('need');toast('Type your name first, so the team knows who did it.',true);return}
  busy++;const li=cb.closest('li');li.classList.toggle('done',cb.checked);
  try{const d=await call('/item',{method:'POST',body:{id:cb.dataset.item,done:cb.checked,by:me}});D.plan=d.plan;draw();toast(cb.checked?'Marked as done':'Marked as not done')}
  catch(e){cb.checked=!cb.checked;li.classList.toggle('done',cb.checked);toast(e.message,true)}finally{busy--}});
}
async function load(first){try{const d=await call();const same=!first&&D&&JSON.stringify(d.plan)===JSON.stringify(D.plan)&&d.tick===D.tick;D=d;if(!same){const f=document.activeElement&&document.activeElement.id==='me';draw();if(f){const n=$('#me');n.focus();n.setSelectionRange(n.value.length,n.value.length)}}}catch(e){if(first&&!/not valid|turned off/i.test(e.message))blocked(e.message)}}
if(!KEY)blocked('The link is incomplete. Ask the organiser to send it again.');
else{load(true);setInterval(()=>{if(!document.hidden&&!busy)load(false)},20e3)}
})();
