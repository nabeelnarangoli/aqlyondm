/* =====================================================================
   Admin: import registrations from an Excel / CSV file into one event.
   1. choose the file (a template can be downloaded)  2. check which column is which
   3. preview: rows with problems or duplicates are flagged and left out  4. import.
   Imported people arrive as "Imported, not confirmed". Selecting them and pressing
   Confirm then follows the normal process (confirmed, badge, invitation email).
   ===================================================================== */
const IMP_STD=[['name','Full name',1],['email','Email',1],['phone','Mobile number',1],['whatsapp','WhatsApp number'],['country','Country'],['education','Education level'],['role','Student or parent'],['seats','Number of people']];
const impNorm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const IMP_SYN={
 name:['name','fullname','studentname','participantname','participant','candidatename','candidate','attendee','attendeename'],
 email:['email','emailid','emailaddress','mail','gmail'],
 phone:['mobile','mobilenumber','mobileno','phone','phonenumber','phoneno','contact','contactnumber','contactno','cell','number'],
 whatsapp:['whatsapp','whatsappnumber','whatsappno','wa','wanumber'],
 country:['country','nationality','location'],
 education:['education','educationlevel','qualification','highestqualification'],
 role:['studentparent','studentorparent','role','iam','type','category','participanttype'],
 seats:['people','numberofpeople','seats','persons','count','tickets','noofpeople','pax'],
};
const IMP_EDU=[[/sslc|10th|tenth|class ?10|x\b/i,'SSLC'],[/plus ?two|\+2|12th|twelfth|hsc|higher secondary|class ?12/i,'Plus Two'],[/ph\.?d|doctor/i,'PhD'],[/master|\bm\.?(sc|a|com|tech|ba)\b|mba|post ?grad|\bpg\b/i,'Masters'],[/bachelor|degree|\bb\.?(sc|a|com|tech|e|ba|ca)\b|graduat|\bug\b/i,'Bachelors']];
const IMP_CTRY={uae:'AE',emirates:'AE',dubai:'AE',ksa:'SA',saudi:'SA',uk:'GB',england:'GB',usa:'US',us:'US',america:'US',india:'IN',bharat:'IN'};

async function impLib(){if(window.XLSX)return;await new Promise((res,rej)=>{const s=document.createElement('script');s.src='/js/vendor/xlsx.full.min.js';s.onload=res;s.onerror=()=>rej(new Error('Could not load the Excel reader.'));document.head.appendChild(s)})}
const dialOfIso=iso=>(COUNTRIES.find(c=>c[0]===iso)||[])[2]||'';
const DIALS=[...new Set(COUNTRIES.map(c=>String(c[2])))].sort((a,b)=>b.length-a.length);
// "+91 9847012345" from "98470 12345", "+919847012345", "00971 50 123 4567", "050 123 4567"…
function impPhone(v,defIso){
 let s=String(v??'').trim();if(!s)return '';
 if(/e\+/i.test(s)&&isFinite(Number(s)))s=BigInt(Math.round(Number(s))).toString();
 const plus=/^\s*(\+|00)/.test(s);let d=s.replace(/\D/g,'');if(s.trim().startsWith('00'))d=d.slice(2);
 const def=String(dialOfIso(defIso));
 if(plus){const cc=DIALS.find(c=>d.startsWith(c)&&d.length-c.length>=6);return cc?`+${cc} ${d.slice(cc.length)}`:''}
 d=d.replace(/^0+/,'');
 if(def&&d.startsWith(def)&&d.length>=def.length+8)return `+${def} ${d.slice(def.length)}`;
 return d.length>=6&&d.length<=14&&def?`+${def} ${d}`:'';
}
const impIsoFromPhone=p=>{const m=String(p).match(/^\+(\d+) /);if(!m)return '';const pref={'1':'US','7':'RU','44':'GB','91':'IN','971':'AE'};return pref[m[1]]||(COUNTRIES.find(c=>String(c[2])===m[1])||[])[0]||''};
function impCountry(v){const t=String(v??'').trim();if(!t)return '';const up=t.toUpperCase();if(COUNTRIES.some(c=>c[0]===up))return up;const k=impNorm(t);if(IMP_CTRY[k])return IMP_CTRY[k];const c=COUNTRIES.find(c=>impNorm(c[1])===k);return c?c[0]:''}
function impEdu(v){const t=String(v??'').trim();if(!t)return '';const ex=['SSLC','Plus Two','Bachelors','Masters','PhD','Other'].find(x=>x.toLowerCase()===t.toLowerCase());if(ex)return ex;const m=IMP_EDU.find(([re])=>re.test(t));return m?m[1]:t.slice(0,40)}
function impRole(v){const t=String(v??'').toLowerCase();return /stud/.test(t)?'Student':/parent|guardian|father|mother/.test(t)?'Parent':''}
const impCell=v=>v instanceof Date?v.toISOString().slice(0,10):typeof v==='number'&&Number.isInteger(v)?BigInt(v).toString():String(v??'').trim();

function importView(e,regs,onDone){
 const FM=e.form||{std:{whatsapp:true,country:true,education:false,role:false},fields:[]};
 const QF=(FM.fields||[]).filter(f=>!['section','file','grid','checkgrid'].includes(f.type));
 const targets=[...IMP_STD.filter(([k])=>!['whatsapp','country','education','role'].includes(k)||FM.std[k]!==false),...QF.map(f=>[f.id,f.label,0,f])];
 let data=null,map={};
 const defIso=(typeof guessCountry==='function'&&guessCountry())||'IN';
 modal(`<h2>Import registrations</h2><p>Add people from an Excel or CSV file to <b>${esc(e.title)}</b>. They arrive as <b>Imported, not confirmed</b>. Then select them and press <b>Confirm</b> to give them badges and send the invitation emails.</p>
 <div class="impstep"><label class="btn impfile">📄 Choose Excel or CSV file<input type="file" accept=".xlsx,.xls,.csv,.ods" hidden></label><button type="button" class="linkbtn imptpl">Download a template</button><span class="small impname"></span></div>
 <div class="field impcc"><label for="impcc">Country code for mobile numbers written without one</label><select id="impcc">${COUNTRIES.map(c=>`<option value="${c[0]}" ${c[0]===defIso?'selected':''}>${flagOf(c[0])} +${c[2]} · ${c[1]}</option>`).join('')}</select></div>
 <div class="impbody"></div><p class="formerr" role="alert"></p>
 <div class="mrow"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn impgo" disabled>Import</button></div>`,(m,close)=>{
  m.querySelector('.modal').classList.add('wide','impmodal');
  const err=$('.formerr',m);
  $('.imptpl',m).onclick=()=>{const head=targets.map(t=>t[1]);const ex=targets.map(([k,,,f])=>({name:'Aisha Rahman',email:'aisha@example.com',phone:'+91 9847012345',whatsapp:'+91 9847012345',country:'India',education:'Plus Two',role:'Student',seats:1}[k]??(f&&f.options?f.options[0]:'')));
   saveBlob(xlsxBook([{name:'Registrations',head,rows:[ex],widths:head.map(h=>Math.max(14,Math.min(36,h.length+4)))}]),`${e.slug}-import-template.xlsx`)};
  $('.impfile input',m).onchange=async x=>{const file=x.target.files[0];if(!file)return;err.textContent='';$('.impname',m).textContent=file.name;$('.impbody',m).innerHTML='<p class="small">Reading the file…</p>';
   try{await impLib();const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    let rows=[];for(const n of wb.SheetNames){rows=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:''}).map(r=>r.map(impCell));if(rows.filter(r=>r.some(Boolean)).length>1)break}
    const hi=rows.findIndex((r,i)=>i<15&&r.filter(Boolean).length>=2);if(hi<0)throw new Error('No table with column headings found in this file.');
    const head=rows[hi].map(h=>String(h));const body=rows.slice(hi+1).map((r,i)=>({n:hi+i+2,c:r})).filter(r=>r.c.some(Boolean));
    if(!body.length)throw new Error('The sheet has headings but no rows of people.');
    data={head,body};map=autoMap(head);draw()}
   catch(y){$('.impbody',m).innerHTML='';err.textContent=y.message||'Could not read this file.'}};
  $('#impcc',m).onchange=()=>data&&draw();
  function autoMap(head){const used=new Set(),out={};const hn=head.map(impNorm);
   const take=(k,test)=>{if(out[k]!=null)return;const i=hn.findIndex((h,j)=>!used.has(j)&&h&&test(h));if(i>=0){out[k]=i;used.add(i)}};
   targets.forEach(([k,label,,f])=>{if(f)take(k,h=>h===impNorm(label))});
   targets.forEach(([k])=>{if(IMP_SYN[k])take(k,h=>IMP_SYN[k].includes(h))});
   take('whatsapp',h=>h.includes('whatsapp'));take('email',h=>h.includes('mail'));
   take('name',h=>h.includes('name')&&!/school|college|parent|father|mother|guardian|company|organ|institution|event/.test(h));
   take('phone',h=>/mobile|phone|contact/.test(h));
   targets.forEach(([k,label,,f])=>{const l=impNorm(label);if(f&&l.length>3)take(k,h=>h.length>3&&(h.includes(l)||l.includes(h)))});
   return out}
  const build=()=>{const iso=$('#impcc',m).value;const g=(r,k)=>map[k]!=null?r.c[map[k]]??'':'';
   const seenE=new Set(regs.filter(r=>!['rejected','cancelled'].includes(r.status)).map(r=>r.email)),seenP=new Set(regs.filter(r=>!['rejected','cancelled'].includes(r.status)).map(r=>r.phone));
   const inE=new Set(),inP=new Set();
   return data.body.map(r=>{const name=String(g(r,'name')).trim(),email=String(g(r,'email')).trim().toLowerCase(),phone=impPhone(g(r,'phone'),iso);
    const wa=map.whatsapp!=null?impPhone(g(r,'whatsapp'),iso):'';const country=impCountry(g(r,'country'))||impIsoFromPhone(phone);
    const answers={};QF.forEach(f=>{if(map[f.id]==null)return;let v=String(g(r,f.id)).trim();if(!v)return;
     if(f.type==='checkboxes')answers[f.id]=v.split(/\s*[,;]\s*/).filter(Boolean).map(x=>(f.options||[]).find(o=>o.toLowerCase()===x.toLowerCase())||(f.other?'Other: '+x:x));
     else if(['choice','dropdown'].includes(f.type))answers[f.id]=(f.options||[]).find(o=>o.toLowerCase()===v.toLowerCase())||(f.other?'Other: '+v:v);
     else answers[f.id]=v});
    const why=!name?'No name':!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)?'Email missing or not valid':!phone?'Mobile missing or not valid':seenE.has(email)?'Already registered (email)':seenP.has(phone)?'Already registered (mobile)':inE.has(email)?'Repeated in the file (email)':inP.has(phone)?'Repeated in the file (mobile)':'';
    if(!why){inE.add(email);inP.add(phone)}
    return {row:r.n,name,email,phone,whatsapp:wa||(FM.std.whatsapp!==false?phone:''),country,education:impEdu(g(r,'education')),role:impRole(g(r,'role')),seats:Math.min(e.maxSeats||20,Math.max(1,parseInt(g(r,'seats'),10)||1)),answers,why}})};
  let picked=null;
  function draw(){const rows=build();if(!picked)picked=new Set(rows.filter(r=>!r.why).map(r=>r.row));
   rows.forEach(r=>{if(r.why)picked.delete(r.row)});
   const good=rows.filter(r=>!r.why).length,bad=rows.length-good,n=rows.filter(r=>picked.has(r.row)).length;
   $('.impbody',m).innerHTML=`<h3 class="fbph">1 · Which column is which?</h3><p class="small">Matched automatically from your headings. Change any that are wrong. Columns marked * are needed.</p>
   <div class="impmap">${targets.map(([k,label,req])=>`<label><span>${esc(label)}${req?' *':''}</span><select data-map="${k}"><option value="">Not in my file</option>${data.head.map((h,i)=>`<option value="${i}" ${map[k]===i?'selected':''}>${esc(h||'Column '+(i+1))}</option>`).join('')}</select></label>`).join('')}</div>
   <h3 class="fbph">2 · Check the people</h3><p class="small"><b>${good}</b> ready${bad?` · <b class="warn">${bad}</b> with a problem (left out)`:''} · <b>${n}</b> selected</p>
   <div class="rtwrap impprev"><table class="rtable"><thead><tr><th class="selc"><input type="checkbox" class="impall" ${n&&n===good?'checked':''} aria-label="Select all ready rows"></th><th>Row</th><th>Name</th><th>Email</th><th>Mobile</th>${map.role!=null?'<th>Student / Parent</th>':''}${map.education!=null?'<th>Education</th>':''}<th>People</th><th>Check</th></tr></thead><tbody>
   ${rows.slice(0,300).map(r=>`<tr class="${r.why?'off':''}"><td class="selc"><input type="checkbox" data-row="${r.row}" ${picked.has(r.row)?'checked':''} ${r.why?'disabled':''}></td><td>${r.row}</td><td class="nw">${esc(r.name)||'<span class="muted">–</span>'}</td><td>${esc(r.email)||'<span class="muted">–</span>'}</td><td class="nw">${esc(r.phone)||'<span class="muted">–</span>'}</td>${map.role!=null?`<td>${esc(r.role)}</td>`:''}${map.education!=null?`<td>${esc(r.education)}</td>`:''}<td class="num">${r.seats}</td><td class="nw">${r.why?`<span class="calno">⚠ ${esc(r.why)}</span>`:'<span class="calyes">✓ Ready</span>'}</td></tr>`).join('')}</tbody></table></div>
   ${rows.length>300?`<p class="small">Showing the first 300 of ${rows.length} rows. All selected rows are imported.</p>`:''}`;
   const go=$('.impgo',m);go.disabled=!n;go.textContent=n?`Import ${n} ${n===1?'person':'people'}`:'Import';
   $$('[data-map]',m).forEach(s=>s.onchange=()=>{const v=s.value===''?null:+s.value;Object.keys(map).forEach(k=>{if(map[k]===v&&v!==null)delete map[k]});if(v===null)delete map[s.dataset.map];else map[s.dataset.map]=v;picked=null;draw()});
   $$('[data-row]',m).forEach(c=>c.onchange=()=>{c.checked?picked.add(+c.dataset.row):picked.delete(+c.dataset.row);draw()});
   const all=$('.impall',m);if(all)all.onchange=()=>{rows.forEach(r=>{if(!r.why)all.checked?picked.add(r.row):picked.delete(r.row)});draw()};
   go.onclick=async()=>{const list=rows.filter(r=>picked.has(r.row)&&!r.why);if(!list.length)return;go.disabled=true;let added=0,skipped=[],last=null;
    try{for(let i=0;i<list.length;i+=150){go.textContent=`Importing… ${Math.min(i+150,list.length)} of ${list.length}`;
      last=await AAPI.call(`/admin/events/${e.id}/regs`,{method:'POST',body:{action:'import',rows:list.slice(i,i+150).map(({why,...r})=>r)}});added+=last.added;skipped=skipped.concat(last.skipped)}
     close();toast(`${added} imported${skipped.length?` · ${skipped.length} skipped`:''}. They're selected below: press Confirm to send badges.`);onDone&&onDone(last);loadEvents()}
    catch(y){err.textContent=y.message;go.disabled=false;go.textContent=`Import ${list.length} people`;if(last)onDone&&onDone(last)}};
  }
 });
}

/* ---------- WhatsApp send lists: share selected people with a helper who sends the confirmations ---------- */
const slUrl=k=>`${location.origin}/send#${k}`;
function slShare(e,l){
 const qr=t=>{if(typeof qrcode!=='function')return '';const q=qrcode(0,'M');q.addData(t);q.make();const n=q.getModuleCount();let p='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))p+=`M${x+3} ${y+3}h1v1h-1z`;return `<svg viewBox="0 0 ${n+6} ${n+6}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${p}"/></svg>`};
 const msg=`Hi! Please send the WhatsApp confirmations for "${e.title}" (${l.total} people).\nOpen this link on your phone and tap "Send on WhatsApp" for each person:\n${slUrl(l.key)}\nPlease don't share this link.`;
 modal(`<h2>WhatsApp list ready: ${esc(l.name)}</h2><p>Send this link to the helper who will send the messages. They see only the <b>${l.total}</b> people on this list, tap <b>Send on WhatsApp</b> for each one, and you can follow the progress under Registrations.</p>
 <div class="stlink"><div class="stqr">${qr(slUrl(l.key))}</div><div><input class="stin" readonly value="${esc(slUrl(l.key))}" aria-label="List link"><div class="evbtns"><button type="button" class="btn sm slcp">Copy link</button><a class="btn sm ghost" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}">Send link on WhatsApp</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(slUrl(l.key))}">Open ↗</a></div></div></div>
 <p class="small">The link works until 2 days after the event. You can turn it off or delete it any time.</p><div class="mrow"><button type="button" class="btn" data-close>Done</button></div>`,(m)=>{m.querySelector('.modal').classList.add('wide');$('.slcp',m).onclick=()=>copy(slUrl(l.key))});
}
/* ---------- WhatsApp message helpers (admin) ---------- */
// the event's details as the message placeholders need them (same wording as the server)
function waEvent(e){
 const TZN={'Asia/Kolkata':'India time','Asia/Dubai':'UAE time','Asia/Riyadh':'Saudi time','Asia/Qatar':'Qatar time','Europe/London':'UK time'};
 const OFF={'Asia/Kolkata':330,'Asia/Dubai':240,'Asia/Riyadh':180,'Asia/Qatar':180,'Europe/London':0};
 const tz=e.tz||'Asia/Kolkata',utc=l=>Date.parse(l+':00Z')-(OFF[tz]??330)*60000,tf=ms=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'numeric',minute:'2-digit',hour12:true}).format(ms);
 let when='';try{when=`${new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(utc(e.start))}, ${tf(utc(e.start))}${e.end?' – '+tf(utc(e.end)):''} (${TZN[tz]||''})`}catch(x){}
 return {title:e.title||'',when,venue:e.mode==='online'?'Online':e.locationName||'',mapUrl:e.mode==='offline'?e.mapUrl||'':'',join:e.onlineUrl||'',page:e.slug?evLink(e):'',mode:e.mode};
}
const waPerson=(e,r)=>({name:r.name,ref:r.ref,seats:r.seats||1,badge:e.mode!=='online'&&r.tk?location.origin+'/badge/'+r.tk:''});
const WA_SAMPLE={name:'Aisha Rahman',ref:'AQ-7F3C21',seats:1,badge:location.origin+'/badge/preview'};
// message box with the {placeholder} buttons and a live preview; get() returns the text
function waEditor(box,{value,online,ev,person,label='Message',id='wamsg'}){
 box.innerHTML=`<div class="field"><label for="${id}">${label}</label><div class="watags"></div><textarea id="${id}" class="watpl">${esc(value)}</textarea><small class="small">Words in {curly brackets} are filled in for each person. *Stars* make text bold in WhatsApp.</small></div>
 <p class="small"><b>Preview</b> for ${esc(person.name)}:</p><pre class="wapre"></pre>`;
 const ta=$('textarea',box),pv=$('.wapre',box);let on=online,E=ev;
 const tags=()=>{$('.watags',box).innerHTML=WA_TAGS.filter(([t])=>on?!['{badge}','{map}'].includes(t):t!=='{join}').map(([t,l])=>`<button type="button" data-tag="${t}" title="Insert ${l}">${t}</button>`).join('');
  $$('[data-tag]',box).forEach(b=>b.onclick=()=>{const t=b.dataset.tag,s=ta.selectionStart??ta.value.length;ta.value=ta.value.slice(0,s)+t+ta.value.slice(ta.selectionEnd??s);ta.focus();ta.selectionStart=ta.selectionEnd=s+t.length;prev()})};
 const prev=()=>{pv.textContent=waFill(ta.value,{...(typeof E==='function'?E():E),mode:on?'online':'offline'},person)};
 ta.oninput=prev;tags();prev();
 return {get:()=>ta.value.replace(/\r/g,'').trim(),set:v=>{ta.value=v;prev()},mode:o=>{if(o!==on){on=o;tags()}prev()},refresh:prev,ta};
}

function slCreate(e,regs,ids,after){
 const okR=r=>['confirmed','approved'].includes(r.status);
 const picked=regs.filter(r=>ids.includes(r.id)),good=picked.filter(okR),left=picked.length-good.length;
 if(!good.length)return toast('Select confirmed people first. Only confirmed or approved people get a confirmation message.',true);
 const ev=waEvent(e);
 const sample=good[0],sp=waPerson(e,sample);
 const n=(e.sendLists||[]).length+1;
 modal(`<h2>Share for WhatsApp</h2><p><b>${good.length}</b> ${good.length===1?'person':'people'} will be on this list${left?` (${left} not confirmed ${left===1?'is':'are'} left out)`:''}. A helper opens the link and sends each person this message from their own WhatsApp.</p>
 <div class="field"><label for="slname">Name of the list <small>(e.g. the helper's name)</small></label><input id="slname" maxlength="60" value="List ${n}"></div>
 <div class="slwa"></div>
 <div class="wasave"><label class="ck"><input type="checkbox" id="sl-saveev"><span>Save this message for <b>${esc(e.title)}</b> (used next time for this event)</span></label><label class="ck"><input type="checkbox" id="sl-saveall"><span>Save as the <b>common message</b> for all events</span></label></div>
 <p class="formerr" role="alert"></p><div class="mrow"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn slgo">Create link</button></div>`,(m,close)=>{
  m.querySelector('.modal').classList.add('wide');
  const W=waEditor($('.slwa',m),{value:waTemplate(e,EVSET),online:e.mode==='online',ev,person:sp,id:'slmsg'});
  $('.slgo',m).onclick=async x=>{x.target.disabled=true;try{const msg=W.get();if(!msg)throw new Error('Write a message first.');
   const l=await AAPI.call(`/admin/events/${e.id}/sendlists`,{method:'POST',body:{name:$('#slname',m).value,msg,ids:good.map(r=>r.id)}});
   const saved=[];
   if($('#sl-saveev',m).checked){try{await AAPI.call('/admin/events/'+e.id,{method:'PATCH',body:{waMsg:msg}});e.waMsg=msg;const k=EVENTS.find(v=>v.id===e.id);if(k)k.waMsg=msg;saved.push('this event')}catch(er){toast('List created, but the message was not saved for the event: '+er.message,true)}}
   if($('#sl-saveall',m).checked){try{EVSET=await AAPI.call('/admin/events/settings',{method:'PATCH',body:{[e.mode==='online'?'waMsgOnline':'waMsg']:msg}});saved.push('all events')}catch(er){toast('List created, but the common message was not saved: '+er.message,true)}}
   if(saved.length)setTimeout(()=>toast('Message saved for '+saved.join(' and ')),400);
   e.sendLists=[...(e.sendLists||[]),l.key];close();slShare(e,l);after&&after()}catch(err){$('.formerr',m).textContent=err.message;x.target.disabled=false}};
 });
}
async function slPanel(e,box){
 let lists=[];try{lists=(await AAPI.call(`/admin/events/${e.id}/sendlists`)).lists}catch(x){return}
 if(!lists.length){box.innerHTML='';return}
 box.innerHTML=`<h3 class="fbph">WhatsApp lists shared with helpers</h3><div class="wlists">${lists.map(l=>`<div class="wlist ${l.on?'':'offl'}"><div><b>${esc(l.name)}</b>${l.on?'':' <span class="chipx muted">Off</span>'}<small>${l.sent} of ${l.total} sent${l.valid<l.total?` · ${l.total-l.valid} no longer confirmed`:''}</small><div class="ckprog"><i style="width:${l.total?Math.round(l.sent/l.total*100):0}%"></i></div></div>
  <span class="evbtns" style="margin:0"><button type="button" class="btn sm ghost" data-sl="share" data-k="${l.key}">Share link</button><button type="button" class="btn sm ghost" data-sl="${l.on?'off':'on'}" data-k="${l.key}">${l.on?'Turn off':'Turn on'}</button><button type="button" class="btn sm ghost danger" data-sl="del" data-k="${l.key}">Delete</button></span></div>`).join('')}</div>`;
 $$('[data-sl]',box).forEach(b=>b.onclick=async()=>{const l=lists.find(x=>x.key===b.dataset.k),a=b.dataset.sl;
  if(a==='share')return slShare(e,l);
  if(a==='del'&&!await confirmBox('Delete this WhatsApp list?',`The link for <b>${esc(l.name)}</b> stops working. Messages already sent stay marked in Registrations.`,'Delete list',true))return;
  try{if(a==='del'){await AAPI.call(`/admin/events/${e.id}/sendlists/${l.key}`,{method:'DELETE'});e.sendLists=(e.sendLists||[]).filter(k=>k!==l.key)}else await AAPI.call(`/admin/events/${e.id}/sendlists/${l.key}`,{method:'PATCH',body:{on:a==='on'}});slPanel(e,box)}catch(err){toast(err.message,true)}});
}
