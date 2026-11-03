/* Check-in page for helpers (/checkin#<key>): scan badges and mark attendance for one event,
   without the admin password. The key in the link (after #) never reaches server logs as a path. */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}
const REG_ST={pending:['Waiting for approval','warn'],approved:['Approved','ok'],confirmed:['Confirmed','ok'],rejected:['Rejected','no'],cancelled:['Cancelled','muted']};
const STAFF_KEY=(location.hash.match(/^#([a-f0-9]{24})$/)||[])[1]||'';
async function staffCall(path,opts={}){
 let r;try{r=await fetch('/api/staff/'+STAFF_KEY+path,{method:opts.method||'GET',headers:{'content-type':'application/json'},body:opts.body?JSON.stringify(opts.body):undefined})}catch(e){throw new Error('No internet connection. Try again.')}
 let d={};try{d=await r.json()}catch(e){}
 if(r.status===403){staffBlocked(d.error);throw new Error(d.error)}
 if(!r.ok)throw new Error(d.error||'Something went wrong.');return d;
}
let STAFF_EV=null;
window.CKAPI={
 regs:async()=>{const d=await staffCall('');STAFF_EV=d.event;return d.regs},
 info:tk=>staffCall('/badge/'+tk),
 mark:(tk,on)=>staffCall('/badge/'+tk,{method:'POST',body:{attended:on}}),
};
function staffBlocked(msg){if(typeof stopScan==='function')stopScan();$('#staff').innerHTML=`<div class="empty" style="margin-top:30px"><p><b>Check-in is not available</b></p><p>${esc(msg||'This link is not valid.')}</p></div>`}
async function staffStart(){
 if(!STAFF_KEY)return staffBlocked('This link is incomplete. Open the full link you were sent.');
 let d;try{d=await staffCall('')}catch(e){if(!/not valid|turned off|expired/.test(e.message))staffBlocked(e.message);return}
 STAFF_EV=d.event;CK.ev=d.event;CK.regs=d.regs;
 const day=new Date(d.event.start+':00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
 $('#staff').innerHTML=`<div class="admhead"><div><h1 style="margin-bottom:2px">${esc(d.event.title)}</h1><p class="small">${esc(day)}${d.event.locationName?' · '+esc(d.event.locationName):''} · You are helping with check-in</p></div></div>${ckBody()}
 <p class="small" style="margin-top:24px">Tip: keep this page open. If the camera does not start, allow the camera for this website in your browser settings.</p>`;
 ckBind();ckDraw();
 setInterval(async()=>{if(document.hidden||CK.busy||$('.cksheet'))return;try{CK.regs=await CKAPI.regs();ckDraw()}catch(e){}},30000);  // see check-ins made by other helpers
}
addEventListener('hashchange',()=>location.reload());   // a different link pasted into the same tab
