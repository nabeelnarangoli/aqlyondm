/* Helper page (/send#<key>): send the WhatsApp confirmation to each person on a list the organiser shared.
   Tap "Send on WhatsApp", press send in WhatsApp, come back: the person is marked as sent and the next one is ready. */
(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,bad)=>{const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3000)};
const KEY=(location.hash.match(/^#([a-f0-9]{24})$/)||[])[1]||'';
const main=$('#send');let D=null,view='todo';
const blocked=msg=>{main.innerHTML=`<div class="empty" style="margin-top:30px"><p><b>This list is not available</b></p><p>${esc(msg)}</p></div>`};
async function call(path,opts={}){let r;try{r=await fetch('/api/send/'+KEY+path,{method:opts.method||'GET',headers:{'content-type':'application/json'},body:opts.body?JSON.stringify(opts.body):undefined})}catch(e){throw new Error('No internet connection. Try again.')}
 let d={};try{d=await r.json()}catch(e){}if(r.status===403){blocked(d.error);throw new Error(d.error)}if(!r.ok)throw new Error(d.error||'Something went wrong.');return d}
const time=s=>new Date(s).toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit',hour12:true});
function draw(){
 const ok=D.people.filter(p=>p.ok),sent=ok.filter(p=>p.sent),todo=ok.filter(p=>!p.sent),off=D.people.filter(p=>!p.ok);
 const list=view==='todo'?todo:view==='sent'?sent:D.people;
 main.innerHTML=`<div class="admhead"><div><h1 style="margin-bottom:2px">${esc(D.event.title)}</h1><p class="small">${esc(D.event.when)}${D.event.venue?' · '+esc(D.event.venue):''}<br>List: <b>${esc(D.list.name)}</b></p></div></div>
 <div class="ckcount"><b>${sent.length}</b> of ${ok.length} sent<div class="ckprog"><i style="width:${ok.length?Math.round(sent.length/ok.length*100):0}%"></i></div></div>
 <p class="tipbox small" style="margin:0 0 12px">Tap <b>Send on WhatsApp</b>, press the send arrow in WhatsApp, then come back here. The person is marked as sent and the next one moves to the top.</p>
 <nav class="evsub" role="tablist">${[['todo',`To send`,todo.length],['sent','Sent',sent.length],['all','All',D.people.length]].map(([k,t,n])=>`<button type="button" data-v="${k}" class="${view===k?'on':''}">${t} <i>${n}</i></button>`).join('')}</nav>
 <div class="wal">${list.length?list.map(p=>`<div class="ckrow warow ${p.sent?'done':''} ${p.ok?'':'off'}"><div><b>${esc(p.name)}</b><small>${esc(p.ref)} · ${esc(p.whatsapp)}${p.seats>1?' · '+p.seats+' people':''}</small>${p.ok?'':`<small class="calno">Registration ${esc(p.status)}: don't send</small>`}${p.sent?`<small class="attyes">✓ Sent ${time(p.sent)}</small>`:''}</div>
  ${p.ok?(p.sent?`<span class="waacts"><a class="btn sm ghost" data-send="${p.id}" href="${esc(waUrl(p.whatsapp,waFill(D.list.msg,D.event,p)))}" target="_blank" rel="noopener">Send again</a><button type="button" class="linkbtn sm" data-undo="${p.id}">Undo</button></span>`
   :`<a class="btn wabtn" data-send="${p.id}" href="${esc(waUrl(p.whatsapp,waFill(D.list.msg,D.event,p)))}" target="_blank" rel="noopener">Send on WhatsApp</a>`):''}</div>`).join('')
  :`<p class="small" style="margin:16px 0">${view==='todo'?'🎉 Everyone on this list has been sent their message.':'Nobody here yet.'}</p>`}</div>
 ${off.length&&view!=='all'?`<p class="small">${off.length} on this list ${off.length===1?'is':'are'} no longer confirmed and ${off.length===1?'is':'are'} hidden.</p>`:''}
 <details class="evset" style="margin-top:18px"><summary>See the message</summary><pre class="wapre">${esc(waFill(D.list.msg,D.event,ok[0]||D.people[0]||{name:'Name',ref:'AQ-XXXXXX',seats:1,badge:''}))}</pre></details>`;
 $$('[data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;draw()});
 $$('[data-send]').forEach(a=>a.addEventListener('click',()=>{const p=D.people.find(x=>x.id===a.dataset.send);if(!p||p.sent)return;
  p.sent=new Date().toISOString();setTimeout(draw,600);call('/'+p.id,{method:'POST',body:{sent:true}}).catch(e=>{p.sent='';draw();toast(e.message,true)})}));
 $$('[data-undo]').forEach(b=>b.onclick=async()=>{const p=D.people.find(x=>x.id===b.dataset.undo);try{await call('/'+p.id,{method:'POST',body:{sent:false}});p.sent='';draw();toast('Marked as not sent')}catch(e){toast(e.message,true)}});
}
async function load(){if(!KEY)return blocked('This link is incomplete. Open the full link you were sent.');try{D=await call('');draw()}catch(e){if(!main.querySelector('.empty'))blocked(e.message)}}
load();
addEventListener('hashchange',()=>location.reload());
document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&D){try{const n=await call('');D=n;draw()}catch(e){}}});   // back from WhatsApp: refresh (other helpers may have sent too)
})();
