/* =====================================================================
   Admin: Upcoming events (create, edit, open/close registration,
   registrations page with approvals over WhatsApp and Excel download)
   ===================================================================== */
const EV_TZ=[['Asia/Kolkata','India time (IST)'],['Asia/Dubai','UAE time (GST)'],['Asia/Riyadh','Saudi time (AST)'],['Asia/Qatar','Qatar time (AST)'],['Europe/London','UK time']];
const EV_CUR=['AED','INR','USD','SAR','QAR','OMR'];
let EVENTS=[],EVSET={whatsapp:'+971509693948',defaultTz:'Asia/Dubai',calUrl:'',calEmail:''};
const evDate=e=>{try{const d=new Date(e.start+':00');return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit',hour12:true})+' '+((EV_TZ.find(t=>t[0]===e.tz)||[])[1]||'').replace(/.*\((.*)\)/,'$1')}catch(x){return e.start}};
const evLink=e=>location.origin+'/events/'+e.slug;
const STATE_LABEL={open:['Registration open','ok'],closed:['Registration closed','no'],full:['Fully booked','no'],ended:['Ended','muted'],none:['Info only','muted']};
const waLink=(num,text)=>`https://api.whatsapp.com/send?phone=${String(num).replace(/[^\d]/g,'')}&text=${encodeURIComponent(text)}`;

function adminTabs(active){return ''}   // aqlyondm: the event manager has a single section
function bindTabs(){$$('[data-tab]').forEach(b=>b.onclick=()=>{const t=b.dataset.tab;history.replaceState(null,'',t==='events'?'#events':location.pathname);showTab(t)})}
async function showTab(t){
 if(t!=='checkin')t='events';   // aqlyondm: no learners section
 $('.admtabwrap').innerHTML=adminTabs(t==='checkin'?'events':t);bindTabs();
 if(typeof stopScan==='function')stopScan();
 if(t==='checkin')return checkinRoute();
 if(t==='events'){$('.adm').innerHTML='<p class="lead" style="margin-top:20px">Loading events…</p>';await loadEvents();
  const m=location.hash.match(/^#events\/([a-f0-9]{16})(\/checkin|\/report)?/),ev=m&&EVENTS.find(x=>x.id===m[1]);   // reopen the event page after a refresh
  if(ev)return m[2]==='/checkin'?checkinView(ev):m[2]==='/report'?reportView(ev):regsView(ev);renderEvents()}
 else{$('.adm').innerHTML='<p class="lead" style="margin-top:20px">Loading learners…</p>';try{await load()}catch(e){return}render()}
}
async function loadEvents(){const d=await AAPI.call('/admin/events');EVENTS=d.events;EVSET=d.settings}

function renderEvents(){
 const main=$('.adm');
 const card=e=>{const [sl,sc]=STATE_LABEL[e.state]||['',''];return `<article class="evcard">
  <div class="evthumb">${e.cover?`<img src="/api/img/${e.cover}" alt="" loading="lazy">`:'<span>No cover</span>'}</div>
  <div class="evbody"><div class="evchips">${e.published?'':'<span class="chipx draft">Draft (hidden)</span>'}<span class="chipx ${sc}">${sl}</span>${e.liveNow==='live'?'<span class="chipx live">● Live now</span>':e.liveNow==='scheduled'?'<span class="chipx sched">📡 Live scheduled</span>':''}${(e.photos||[]).length||(e.videos||[]).length?`<span class="chipx">${(e.photos||[]).length} photos · ${(e.videos||[]).length} videos</span>`:''}<span class="chipx">${e.mode==='online'?'Online':'Offline'}</span><span class="chipx">${e.paid?esc(e.currency+' '+e.price):'Free'}</span></div>
  <h3>${esc(e.title)}</h3><p class="small">${esc(evDate(e))}${e.mode==='offline'&&e.locationName?' · '+esc(e.locationName):''}</p>
  <p class="small">${e.regMode==='form'?`<b>${e.counts.total}</b> registration${e.counts.total===1?'':'s'} · ${e.counts.seats} seat${e.counts.seats===1?'':'s'}${e.capacity?' of '+e.capacity:''}${e.counts.pending?` · <b class="warn">${e.counts.pending} waiting for approval</b>`:''}`:e.regMode==='link'?'Registration on an external link':'No registration'}</p>
  <div class="evbtns"><button type="button" class="btn sm" data-ev="edit" data-id="${e.id}">Edit</button><button type="button" class="btn sm ghost" data-ev="media" data-id="${e.id}">📡 Live & media</button>${e.regMode==='form'?`<button type="button" class="btn sm ghost" data-ev="regs" data-id="${e.id}">Registrations</button>`:''}${e.regMode!=='none'&&e.state!=='ended'?`<button type="button" class="btn sm ghost" data-ev="toggle" data-id="${e.id}">${e.regOpen?'Close registration':'Open registration'}</button>`:''}${e.regMode==='form'&&e.mode!=='online'&&e.counts.total?`<button type="button" class="btn sm ghost" data-ev="scan" data-id="${e.id}">📷 Check-in${e.counts.attended?` (${e.counts.attended})`:''}</button>`:''}<button type="button" class="btn sm ghost" data-ev="copy" data-id="${e.id}">Copy link</button><a class="btn sm ghost" href="/events/${esc(e.slug)}" target="_blank" rel="noopener">View page ↗</a></div></div></article>`};
 const t=e=>Date.parse(e.start+':00');const up=EVENTS.filter(e=>e.state!=='ended').sort((a,b)=>t(a)-t(b)),past=EVENTS.filter(e=>e.state==='ended').sort((a,b)=>t(b)-t(a));
 main.innerHTML=`<div class="admhead"><h1>Events</h1><button type="button" class="btn" id="newev">＋ New event</button></div>
 <div class="calbar ${EVSET.calUrl&&!EVSET.calNeedsUpdate?'on':EVSET.calNeedsUpdate?'warn':''}"><span class="calic">📅</span><div><b>Calendar invitations ${EVSET.calNeedsUpdate?'need a quick update':EVSET.calUrl?'on':'off'}</b><small>${EVSET.calNeedsUpdate?'Switch to our own invitation email (“Invitation from Aqlyon Brand Management: event name”). Takes 2 minutes.':EVSET.calUrl?`Emailed from ${esc(EVSET.calEmail||'your Google account')} as “Invitation from Aqlyon Brand Management: <i>event name</i>”, with the event attached for their calendar.`:'Connect so everyone who registers gets an invitation email with the event for their calendar.'}</small></div><button type="button" class="btn sm ${EVSET.calUrl&&!EVSET.calNeedsUpdate?'ghost':''} calsetup">${EVSET.calNeedsUpdate?'Update now':EVSET.calUrl?'Settings':'Connect'}</button></div>
 <details class="evset"><summary><b>Event settings</b> · WhatsApp for approvals: ${esc(EVSET.whatsapp)} · New events in ${esc(((EV_TZ.find(x=>x[0]===(EVSET.defaultTz||'Asia/Dubai'))||[])[1])||'UAE time (GST)')}</summary>
  <form class="mform evsetform"><div class="field"><label for="es-wa">WhatsApp number for paid registrations</label><input id="es-wa" value="${esc(EVSET.whatsapp)}" inputmode="tel"><small class="small">Visitors who register for a paid event send their details to this number for payment and approval. Include the country code.</small></div>
  <div class="field"><label for="es-tz">Time zone for new events</label><select id="es-tz">${EV_TZ.map(([v,t])=>`<option value="${v}" ${v===(EVSET.defaultTz||'Asia/Dubai')?'selected':''}>${t}</option>`).join('')}</select><small class="small">New events start in this time zone. You can still pick a different one on each event.</small></div>
  <p class="fbsub">Common WhatsApp message</p><p class="small">Used for every event that doesn't have its own message (set one in the event's <b>WhatsApp message</b> section). It's the confirmation sent from the WhatsApp lists and the <b>Send details on WhatsApp</b> button.</p>
  <div class="wacommon" data-on="0"></div><button type="button" class="linkbtn sm wareset" data-on="0">Use the built-in message</button>
  <div class="wacommon" data-on="1"></div><button type="button" class="linkbtn sm wareset" data-on="1">Use the built-in message</button>
  <p class="formerr"></p><button class="btn sm" type="submit">Save settings</button></form></details>
 <h2 class="evh">Upcoming</h2>${up.length?`<div class="evlist">${up.map(card).join('')}</div>`:`<div class="empty"><p>No upcoming events. Press <b>＋ New event</b> to add one. It appears on the website under <b>Upcoming events</b>.</p></div>`}
 ${past.length?`<h2 class="evh">Past</h2><div class="evlist past">${past.map(card).join('')}</div>`:''}`;
 $('#newev').onclick=()=>eventForm();
 $('.calsetup').onclick=calSetup;
 const sampleEv=EVENTS.find(x=>x.mode==='offline')||EVENTS[0]||{title:'Your event name',start:new Date(Date.now()+7*864e5).toISOString().slice(0,10)+'T10:00',tz:'Asia/Dubai',mode:'offline',locationName:'Aqlyon Brand Management, Koyilandy'};
 const sampleOn=EVENTS.find(x=>x.mode==='online')||{...sampleEv,mode:'online',onlineUrl:'https://meet.google.com/abc-defg-hij'};
 const WC=[0,1].map(o=>waEditor($(`.wacommon[data-on="${o}"]`),{value:waCommon(EVSET,!!o),online:!!o,ev:waEvent(o?sampleOn:sampleEv),person:WA_SAMPLE,id:'es-wa'+o,label:o?'For online events':'For in-person events'}));
 $$('.wareset').forEach(b=>b.onclick=()=>WC[+b.dataset.on].set(waDefault(!!+b.dataset.on)));
 $('.evsetform').onsubmit=async ev=>{ev.preventDefault();const f=ev.target;const keep=(o)=>{const v=WC[o].get();return v===waDefault(!!o).trim()?'':v};   // built-in text is stored as "use built-in"
  try{EVSET=await AAPI.call('/admin/events/settings',{method:'PATCH',body:{whatsapp:$('#es-wa').value,defaultTz:$('#es-tz').value,waMsg:keep(0),waMsgOnline:keep(1)}});toast('Settings saved');renderEvents()}catch(err){$('.formerr',f).textContent=err.message}};
 $$('[data-ev]').forEach(b=>b.onclick=async()=>{const e=EVENTS.find(x=>x.id===b.dataset.id);const a=b.dataset.ev;
  if(a==='edit')return eventForm(e);
  if(a==='media')return mediaForm(e);
  if(a==='regs')return regsView(e);
  if(a==='scan')return checkinView(e);
  if(a==='copy')return copy(evLink(e));
  if(a==='toggle'){try{await AAPI.call('/admin/events/'+e.id,{method:'PATCH',body:{regOpen:!e.regOpen}});toast(e.regOpen?'Registration closed':'Registration open');await loadEvents();renderEvents()}catch(err){toast(err.message,true)}}
 });
}

/* resize the cover in the browser before upload: max 1600 px wide, WebP (JPEG on older Safari) */
async function prepImage(file){
 const bmp=await createImageBitmap(file);const k=Math.min(1,1600/bmp.width);const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
 let url=c.toDataURL('image/webp',.84);if(!url.startsWith('data:image/webp'))url=c.toDataURL('image/jpeg',.85);
 return {type:url.slice(5,url.indexOf(';')),data:url.slice(url.indexOf(',')+1),preview:url};
}

function eventForm(e){
 const isNew=!e;e=e||{tz:EVSET.defaultTz||'Asia/Dubai',mode:'offline',regMode:'form',regOpen:true,published:true,currency:'AED',maxSeats:1,paid:false};
 const r=(n,v,cur,label)=>`<label class="radio"><input type="radio" name="${n}" value="${v}" ${cur===v?'checked':''}><span>${label}</span></label>`;
 modal(`<h2>${isNew?'New event':'Edit event'}</h2><form class="mform evform">
 <div class="field"><label for="ef-title">Event name *</label><input id="ef-title" maxlength="120" required value="${esc(e.title||'')}"></div>
 <div class="field"><label for="ef-sum">Short summary <small>(one line on the event card)</small></label><input id="ef-sum" maxlength="240" value="${esc(e.summary||'')}"></div>
 <div class="field"><label for="ef-det">Event details *</label><textarea id="ef-det" rows="7" maxlength="6000" required>${esc(e.details||'')}</textarea><small class="small">What will happen, who it's for, speakers, what to bring. Leave an empty line between paragraphs. Web links become clickable.</small></div>
 <div class="field"><label>Cover photo</label><div class="evcover"><div class="evcprev">${e.cover?`<img src="/api/img/${e.cover}" alt="">`:'<span>No cover yet</span>'}</div><div><input type="file" id="ef-cover" accept="image/jpeg,image/png,image/webp"><small class="small">Best size: 1600 × 900 (16:9). It is also used when the event link is shared on WhatsApp or social media.</small>${e.cover?'<button type="button" class="linkbtn rmcover">Remove cover</button>':''}</div></div></div>
 <fieldset class="qset"><legend>Date and time *</legend><div class="f3"><div class="field"><label for="ef-start">Starts</label><input type="datetime-local" id="ef-start" required value="${esc(e.start||'')}"></div><div class="field"><label for="ef-end">Ends <small>(optional)</small></label><input type="datetime-local" id="ef-end" value="${esc(e.end||'')}"></div><div class="field"><label for="ef-tz">Time zone</label><select id="ef-tz">${EV_TZ.map(([v,t])=>`<option value="${v}" ${e.tz===v?'selected':''}>${t}</option>`).join('')}</select></div></div></fieldset>
 <fieldset class="qset"><legend>Where</legend><div class="rrow">${r('mode','offline',e.mode,'Offline (at a place)')}${r('mode','online',e.mode,'Online')}</div>
  <div class="m-off"><div class="field"><label for="ef-loc">Location *</label><input id="ef-loc" maxlength="160" value="${esc(e.locationName||'')}" placeholder="e.g. Aqlyon Brand Management, Koyilandy"></div><div class="field"><label for="ef-map">Google Maps link</label><input id="ef-map" maxlength="600" value="${esc(e.mapUrl||'')}" placeholder="https://maps.app.goo.gl/…"><small class="small">In Google Maps: find the place → Share → Copy link.</small></div></div>
  <div class="m-on"><div class="field"><label for="ef-on">Online meeting link</label><input id="ef-on" maxlength="600" value="${esc(e.onlineUrl||'')}" placeholder="https://meet.google.com/… or https://zoom.us/j/…"><small class="small">Kept private: free events show it after registering; paid events get it only after you approve them.</small></div></div></fieldset>
 <fieldset class="qset"><legend>Price</legend><div class="rrow">${r('paid','free',e.paid?'paid':'free','Free')}${r('paid','paid',e.paid?'paid':'free','Paid')}</div>
  <div class="m-paid"><div class="f3"><div class="field"><label for="ef-price">Price per person *</label><input id="ef-price" type="number" min="0" step="0.01" value="${e.price||''}"></div><div class="field"><label for="ef-cur">Currency</label><select id="ef-cur">${EV_CUR.map(c=>`<option ${e.currency===c?'selected':''}>${c}</option>`).join('')}</select></div></div><p class="small">Visitors register, then send their details to you on WhatsApp (${esc(EVSET.whatsapp)}) for payment. You approve them under <b>Registrations</b>.</p></div></fieldset>
 <fieldset class="qset"><legend>Registration</legend><div class="rrow">${r('regMode','form',e.regMode,'Our registration form')}${r('regMode','link',e.regMode,'External link')}${r('regMode','none',e.regMode,'No registration')}</div>
  <div class="m-form"><div class="f3"><div class="field"><label for="ef-cap">Total seats <small>(0 = no limit)</small></label><input id="ef-cap" type="number" min="0" value="${e.capacity||0}"></div><div class="field"><label for="ef-max">Seats one person can book</label><input id="ef-max" type="number" min="1" max="20" value="${e.maxSeats||1}"></div></div>
   <div class="fbuild"></div>
   ${isNew?'':`<p class="small evregnote">${e.counts?`<b>${e.counts.total}</b> registration${e.counts.total===1?'':'s'} so far. `:''}<button type="button" class="linkbtn openregs">View registrations and download Excel</button></p>`}</div>
  <div class="m-link"><div class="field"><label for="ef-link">Registration link *</label><input id="ef-link" maxlength="600" value="${esc(e.regLink||'')}" placeholder="https://forms.gle/…"></div></div>
  <label class="ck"><input type="checkbox" id="ef-open" ${e.regOpen?'checked':''}><span><b>Registration is open</b>: the Register button shows until you untick this.</span></label></fieldset>
 <fieldset class="qset bdgset"><legend>Badge design</legend><div class="bdgdesign"></div></fieldset>
 <fieldset class="qset wamset"><legend>WhatsApp message</legend><p class="small">The confirmation message sent on WhatsApp: in the lists you share with helpers and the <b>Send details on WhatsApp</b> button.</p>
  <div class="wause"><label class="ck"><input type="radio" name="wause" value="common" ${e.waMsg?'':'checked'}><span><b>Use the common message</b>: the same for all events (change it in <b>Event settings</b>)</span></label><label class="ck"><input type="radio" name="wause" value="own" ${e.waMsg?'checked':''}><span><b>Write a message for this event</b></span></label></div>
  <div class="waedit"></div></fieldset>
 <label class="ck"><input type="checkbox" id="ef-pub" ${e.published?'checked':''}><span><b>Show on the website</b>: untick to keep it as a hidden draft.</span></label>
 <label class="ck"><input type="checkbox" id="ef-share" ${e.share!==false?'checked':''}><span><b>Show share buttons</b>: lets visitors share the event (Share button, WhatsApp, Facebook, LinkedIn, X, copy link). Untick to hide all of them.</span></label>
 <p class="formerr" role="alert"></p>
 <div class="mrow">${isNew?'':'<button type="button" class="btn danger delev" style="margin-right:auto">Delete</button>'}<button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">${isNew?'Create event':'Save changes'}</button></div></form>`,(m,close)=>{
  m.querySelector('.modal').classList.add('wide');
  let cover=e.cover||'';
  const sync=()=>{const v=n=>(m.querySelector(`input[name=${n}]:checked`)||{}).value;
   $('.m-off',m).hidden=v('mode')!=='offline';$('.m-on',m).hidden=v('mode')!=='online';$('.m-paid',m).hidden=v('paid')!=='paid';$('.m-form',m).hidden=v('regMode')!=='form';$('.m-link',m).hidden=v('regMode')!=='link'};
  $$('input[type=radio]',m).forEach(x=>x.onchange=sync);sync();
  $('#ef-cover',m).onchange=async ev=>{const f=ev.target.files[0];if(!f)return;const pv=$('.evcprev',m);pv.innerHTML='<span>Uploading…</span>';
   try{const img=await prepImage(f);const d=await AAPI.call('/admin/upload',{method:'POST',body:{type:img.type,data:img.data}});cover=d.id;pv.innerHTML=`<img src="${img.preview}" alt="">`}catch(err){pv.innerHTML='<span>Upload failed</span>';toast(err.message,true)}};
  const FORM=JSON.parse(JSON.stringify(e.form||{std:{whatsapp:true,country:true,education:false,role:false},fields:[]}));
  formBuilder($('.fbuild',m),FORM,e);
  const BADGE=badgeDesigner($('.bdgdesign',m),e,m);
  const mode=()=>(m.querySelector('input[name=mode]:checked')||{}).value==='online';
  const evNow=()=>waEvent({title:$('#ef-title',m).value||'Your event name',start:$('#ef-start',m).value,end:$('#ef-end',m).value,tz:$('#ef-tz',m).value,mode:mode()?'online':'offline',locationName:$('#ef-loc',m).value,mapUrl:$('#ef-map',m).value,onlineUrl:$('#ef-on',m).value,slug:e.slug});
  const WB=$('.waedit',m),WM=waEditor(WB,{value:e.waMsg||waCommon(EVSET,mode()),online:mode(),ev:evNow,person:WA_SAMPLE,id:'ef-wa'});
  let own=e.waMsg||'',isOwn=null;   // the event's own message is kept while you look at the common one
  const waUse=()=>{const o=(m.querySelector('input[name=wause]:checked')||{}).value==='own';if(o===isOwn)return;if(isOwn)own=WM.get();isOwn=o;
   WB.classList.toggle('ro',!o);WM.ta.readOnly=!o;WM.set(o?(own||waCommon(EVSET,mode())):waCommon(EVSET,mode()))};
  $$('input[name=wause]',m).forEach(x=>x.addEventListener('change',waUse));waUse();
  $$('input[name=mode]',m).forEach(x=>x.addEventListener('change',()=>{WM.mode(mode());if(WB.classList.contains('ro'))WM.set(waCommon(EVSET,mode()))}));
  $('form',m).addEventListener('input',ev=>{if(ev.target!==WM.ta)WM.refresh()});
  $('form',m).addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.tagName==='INPUT'&&!['submit','button','checkbox','radio'].includes(ev.target.type))ev.preventDefault()});   // Enter never saves and closes the form by accident
  const rc=$('.rmcover',m);if(rc)rc.onclick=()=>{cover='';$('.evcprev',m).innerHTML='<span>No cover</span>'};
  const orr=$('.openregs',m);if(orr)orr.onclick=()=>{close();regsView(e)};
  const del=$('.delev',m);if(del)del.onclick=async()=>{close();if(!await confirmBox('Delete event?',`<b>${esc(e.title)}</b> and all its registrations will be deleted. This cannot be undone.`,'Delete event',true))return;await AAPI.call('/admin/events/'+e.id,{method:'DELETE'});toast('Event deleted');await loadEvents();renderEvents()};
  $('form',m).onsubmit=async ev=>{ev.preventDefault();const v=n=>(m.querySelector(`input[name=${n}]:checked`)||{}).value;const btn=$('button[type=submit]',m);btn.disabled=true;
   const body={title:$('#ef-title',m).value,summary:$('#ef-sum',m).value,details:$('#ef-det',m).value,cover,start:$('#ef-start',m).value,end:$('#ef-end',m).value,tz:$('#ef-tz',m).value,mode:v('mode'),locationName:$('#ef-loc',m).value,mapUrl:$('#ef-map',m).value,onlineUrl:$('#ef-on',m).value,paid:v('paid')==='paid',price:$('#ef-price',m).value,currency:$('#ef-cur',m).value,regMode:v('regMode'),capacity:$('#ef-cap',m).value,maxSeats:$('#ef-max',m).value,regLink:$('#ef-link',m).value,form:FORM,badge:BADGE,regOpen:$('#ef-open',m).checked,published:$('#ef-pub',m).checked,share:$('#ef-share',m).checked,waMsg:WB.classList.contains('ro')?'':WM.get()};
   try{const sv=await AAPI.call(isNew?'/admin/events':'/admin/events/'+e.id,{method:isNew?'POST':'PATCH',body});close();toast(sv.calendar==='ok'?'Event saved. Updated invitation emailed to everyone invited.':sv.calendar?'Event saved, but the updated invitation was not emailed: '+sv.calendar:isNew?'Event created':'Event saved',!!sv.calendar&&sv.calendar!=='ok');await loadEvents();renderEvents()}catch(err){$('.formerr',m).textContent=err.message;btn.disabled=false}};
 });
}


/* ---------- Live stream, videos and photos for one event ---------- */
const LIVE_HOST=u=>{const h=(()=>{try{return new URL(u).hostname.replace(/^www\.|^m\./,'')}catch(x){return ''}})();return /youtu/.test(h)?'YouTube':/facebook|fb\.watch/.test(h)?'Facebook':/instagram/.test(h)?'Instagram':/linkedin/.test(h)?'LinkedIn':/zoom/.test(h)?'Zoom':/vimeo/.test(h)?'Vimeo':h||'link'};
const ytOf=u=>{const m=/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i.exec(String(u||''));return m?m[1]:''};
function mediaForm(e){
 const L=Object.assign({url:'',start:'',end:'',status:'auto'},e.live||{});
 let videos=(e.videos||[]).map(v=>({...v})),photos=(e.photos||[]).slice();
 const st=(v,label,sub)=>`<label class="radio"><input type="radio" name="lvst" value="${v}" ${L.status===v?'checked':''}><span>${label}${sub?`<small> ${sub}</small>`:''}</span></label>`;
 modal(`<h2>Live & media</h2><p class="small" style="margin-top:-6px">${esc(e.title)} · ${esc(evDate(e))}</p><form class="mform mediaform">
 <fieldset class="qset"><legend>📡 Live stream</legend>
  <div class="field"><label for="lv-url">Live stream link</label><input id="lv-url" maxlength="600" value="${esc(L.url)}" placeholder="https://youtube.com/live/… or a Facebook / Instagram live link"><small class="small">YouTube streams play right on the event page. Other links (Facebook, Instagram, LinkedIn) show a “Watch live” button. Visitors can see this link.</small></div>
  <div class="f3"><div class="field"><label for="lv-start">Stream starts <small>(empty = event start)</small></label><input type="datetime-local" id="lv-start" value="${esc(L.start)}"></div><div class="field"><label for="lv-end">Stream ends <small>(optional)</small></label><input type="datetime-local" id="lv-end" value="${esc(L.end)}"></div></div>
  <p class="small">Times are in the event's time zone. The website shows <b>Live scheduled</b> before the start, <b>Live now</b> between start and end, then the recording.</p>
  <div class="rrow lvst">${st('auto','Automatic','by the times above')}${st('live','🔴 Live now','show it as live right away')}${st('ended','Ended','show it as finished')}</div>
 </fieldset>
 <fieldset class="qset"><legend>🎬 Videos</legend><p class="small">Paste YouTube links (highlights, speeches, recap films). They play on the event page. Up to 30.</p>
  <div class="vidlist"></div>
  <div class="vidadd"><input id="vd-url" maxlength="600" placeholder="https://youtu.be/…"><input id="vd-title" maxlength="120" placeholder="Title (optional)"><button type="button" class="btn sm ghost" id="vd-add">Add video</button></div>
 </fieldset>
 <fieldset class="qset"><legend>📸 Photos</legend><p class="small">Choose several photos at once. They're resized in your browser before uploading. Up to 80.</p>
  <label class="btn sm ghost upbtn">＋ Add photos<input type="file" id="ph-in" accept="image/jpeg,image/png,image/webp" multiple hidden></label> <span class="small phstat"></span>
  <div class="phgrid"></div>
 </fieldset>
 <p class="formerr" role="alert"></p>
 <div class="mrow">${e.slug?`<a class="btn ghost" href="/events/${esc(e.slug)}" target="_blank" rel="noopener" style="margin-right:auto">View event page ↗</a>`:''}<button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">Save</button></div></form>`,(m,close)=>{
  m.querySelector('.modal').classList.add('wide');
  const drawV=()=>{$('.vidlist',m).innerHTML=videos.length?videos.map((v,i)=>{const y=ytOf(v.url);return `<div class="vidrow">${y?`<img src="https://i.ytimg.com/vi/${y}/mqdefault.jpg" alt="">`:'<span class="novid">🎬</span>'}<div><input data-vt="${i}" value="${esc(v.title)}" placeholder="Title (optional)" maxlength="120"><small class="small">${esc(v.url)}${y?'':' · not a YouTube link: shown as a button'}</small></div><button type="button" class="linkbtn" data-vu="${i}" ${i?'':'disabled'} aria-label="Move up">↑</button><button type="button" class="linkbtn" data-vx="${i}">Remove</button></div>`}).join(''):'<p class="small muted">No videos yet.</p>';
   $$('[data-vt]',m).forEach(x=>x.oninput=()=>{videos[+x.dataset.vt].title=x.value});
   $$('[data-vx]',m).forEach(x=>x.onclick=()=>{videos.splice(+x.dataset.vx,1);drawV()});
   $$('[data-vu]',m).forEach(x=>x.onclick=()=>{const i=+x.dataset.vu;if(i){[videos[i-1],videos[i]]=[videos[i],videos[i-1]];drawV()}})};
  const addV=()=>{const u=$('#vd-url',m).value.trim();if(!u)return;if(!/^https?:\/\//i.test(u))return toast('Video links must start with https://',true);if(videos.length>=30)return toast('Up to 30 videos.',true);videos.push({url:u,title:$('#vd-title',m).value.trim()});$('#vd-url',m).value='';$('#vd-title',m).value='';drawV()};
  $('#vd-add',m).onclick=addV;[$('#vd-url',m),$('#vd-title',m)].forEach(x=>x.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();addV()}});
  const drawP=()=>{$('.phgrid',m).innerHTML=photos.map((id,i)=>`<figure><img src="/api/img/${id}" alt="" loading="lazy"><button type="button" data-px="${i}" aria-label="Remove photo">×</button>${i?`<button type="button" class="pl" data-pl="${i}" aria-label="Move earlier">‹</button>`:''}</figure>`).join('');
   $('.phstat',m).textContent=photos.length?photos.length+' photo'+(photos.length===1?'':'s'):'';
   $$('[data-px]',m).forEach(x=>x.onclick=()=>{photos.splice(+x.dataset.px,1);drawP()});
   $$('[data-pl]',m).forEach(x=>x.onclick=()=>{const i=+x.dataset.pl;[photos[i-1],photos[i]]=[photos[i],photos[i-1]];drawP()})};
  $('#ph-in',m).onchange=async ev=>{const files=[...ev.target.files].slice(0,80-photos.length);ev.target.value='';let n=0;
   for(const f of files){$('.phstat',m).textContent=`Uploading ${++n} of ${files.length}…`;try{const img=await prepImage(f);const d=await AAPI.call('/admin/upload',{method:'POST',body:{type:img.type,data:img.data}});photos.push(d.id);drawP()}catch(err){toast(f.name+': '+err.message,true)}}
   drawP();toast(files.length+' photo'+(files.length===1?'':'s')+' added. Press Save to publish them.')};
  drawV();drawP();
  $('form',m).addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.tagName==='INPUT')ev.preventDefault()});
  $('form',m).onsubmit=async ev=>{ev.preventDefault();const btn=$('button[type=submit]',m);btn.disabled=true;
   if($('#vd-url',m).value.trim())addV();
   const body={live:{url:$('#lv-url',m).value.trim(),start:$('#lv-start',m).value,end:$('#lv-end',m).value,status:(m.querySelector('input[name=lvst]:checked')||{}).value||'auto'},videos,photos};
   try{await AAPI.call('/admin/events/'+e.id,{method:'PATCH',body});close();toast('Live & media saved');await loadEvents();renderEvents()}catch(err){$('.formerr',m).textContent=err.message;btn.disabled=false}};
 });
}

const CAL_SCRIPT=`// Aqlyon Brand Management event invitations
// Sends the invitation emails prepared by the website from this Gmail account, with the event attached
// as a calendar invitation. Subject: "Invitation from Aqlyon Brand Management: <event name>".
var SECRET = '__SECRET__';
var VERSION = 2;

// Run this once from the editor (choose "authorize" at the top, press Run) and allow sending email.
function authorize() {
  var left = MailApp.getRemainingDailyQuota();
  Logger.log('Ready. Emails are sent from ' + Session.getEffectiveUser().getEmail() + '. Emails left today: ' + left);
}

function doPost(e) {
  var out;
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) out = { ok: false, error: 'Wrong key. Copy the code again from the admin panel.' };
    else if (d.action === 'ping') out = { ok: true, version: VERSION, email: Session.getEffectiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota() };
    else if (d.action === 'mail') out = send(d.messages || []);
    else out = { ok: false, error: 'Unknown action' };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function send(messages) {
  var results = [];
  messages.forEach(function (m) {
    try {
      if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Gmail daily limit reached. Try again tomorrow.');
      MailApp.sendEmail({
        to: m.to,
        subject: m.subject,
        body: m.text,
        htmlBody: m.html,
        name: 'Aqlyon Brand Management',
        attachments: [Utilities.newBlob(m.ics, 'text/calendar; charset=UTF-8; method=' + m.method, 'invite.ics')]
      });
      results.push({ ok: true });
    } catch (err) {
      results.push({ ok: false, error: String(err && err.message || err) });
    }
  });
  return { ok: true, results: results, quota: MailApp.getRemainingDailyQuota() };
}
`;

/* ---------- Calendar invitations: our own email from the academy Gmail, with the event attached ---------- */
async function calSetup(){
 let st;try{st=await AAPI.call('/admin/events/settings')}catch(err){return toast(err.message,true)}
 const code=CAL_SCRIPT.replace('__SECRET__',st.calSecret);
 const upd=st.calNeedsUpdate;
 modal(`<h2>Calendar invitations</h2>
 <p>Everyone who registers gets an email from <b>${esc(st.calEmail||'your Google account')}</b> with the subject <b>“Invitation from Aqlyon Brand Management: <i>event name</i>”</b>. It shows their details and reference number and includes the event as a calendar invitation, so Gmail, Outlook and iPhone show <b>Add to calendar</b>. The calendar entry has reminders 1 day and 1 hour before.</p>
 ${upd?`<p class="calwarn">⚠ <b>Update needed.</b> Invitations are now sent as our own email instead of Google Calendar's “Invitation from an unknown sender”. Follow steps 2, 3, 4 and 6 below once with the same Apps Script project. The web app URL stays the same.</p>`:st.calUrl?`<p class="calok">✅ Connected${st.calEmail?` to <b>${esc(st.calEmail)}</b>`:''}.</p>`:''}
 <ol class="steps2">
  <li>Sign in to the Google (Gmail) account that should send the invitations. Open your Apps Script project <b>Aqlyon events calendar</b> (or create one at <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com → New project</a>).</li>
  <li>Select all the code in <b>Code.gs</b>, delete it, paste this code and press <b>Save</b> (💾). It contains this website's private key, so don't share it.<pre class="creds">${esc(code)}</pre><button type="button" class="btn ghost sm cpcode">Copy code</button></li>
  <li>In the function list at the top (next to <b>Debug</b>), choose <b>authorize</b> and press <b>▶ Run</b>. When Google asks, click <b>Review permissions</b> → choose that account → <b>Advanced → Go to Aqlyon events calendar</b> → <b>Select all</b> → <b>Continue / Allow</b>. The log says <b>Ready</b>.</li>
  <li>${st.calUrl?'Click <b>Deploy → Manage deployments → ✏ Edit</b>, set <b>Version: New version</b> and click <b>Deploy</b>.':'Click <b>Deploy → New deployment</b> → ⚙ → <b>Web app</b>. Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>, then <b>Deploy</b>.'}</li>
  <li>${st.calUrl?'The web app URL stays the same.':'Copy the <b>Web app URL</b> (starts with https://script.google.com/macros/s/ and ends with /exec) and paste it below.'}</li>
  <li>Press <b>${st.calUrl?'Save':'Connect'}</b> below. The panel checks the script straight away.</li>
 </ol>
 <form class="mform calform"><div class="field"><label for="cal-url">Web app URL</label><input id="cal-url" value="${esc(st.calUrl)}" placeholder="https://script.google.com/macros/s/…/exec"></div><p class="formerr" role="alert"></p>
 <div class="mrow">${st.calUrl?'<button type="button" class="btn danger caldis" style="margin-right:auto">Disconnect</button><button type="button" class="btn ghost caltest">Test</button>':''}<button type="button" class="btn ghost" data-close>Close</button><button class="btn" type="submit">${st.calUrl?'Save':'Connect'}</button></div></form>
 <h3>Good to know</h3>
 <ul class="steps2 small"><li><b>Free events:</b> the invitation email goes out as soon as someone registers. <b>Paid events:</b> when you press Approve. Rejecting or cancelling sends a short cancellation that removes it from their calendar.</li>
 <li><b>Changing an event</b> (name, date, time or place) emails an updated invitation to everyone already invited.</li>
 <li><b>Daily limit:</b> a free Gmail account can send about <b>100 of these emails a day</b>. If the limit is reached, the person shows <b>Not sent</b> in Registrations; press <b>Send calendar invites</b> the next day.</li>
 <li>On the event page, visitors can also press <b>Add to Google Calendar</b> or <b>Download calendar file</b> themselves.</li>
 <li>If the code changes later: paste it, then <b>Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy</b>.</li></ul>`,(m,close)=>{
  m.querySelector('.modal').classList.add('wide');
  $('.cpcode',m).onclick=()=>copy(code);
  $('.calform',m).onsubmit=async ev=>{ev.preventDefault();const b=$('button[type=submit]',m);b.disabled=true;b.textContent='Checking…';$('.formerr',m).textContent='';
   try{EVSET=await AAPI.call('/admin/events/settings',{method:'PATCH',body:{calUrl:$('#cal-url',m).value}});close();toast(EVSET.calUrl?`Calendar invitations connected${EVSET.calEmail?' ('+EVSET.calEmail+')':''}`:'Saved');renderEvents()}
   catch(err){$('.formerr',m).innerHTML=/permission|authoriz/i.test(err.message)?'<b>Google has not given the script permission yet.</b> In Apps Script choose <b>authorize</b> at the top, press <b>▶ Run</b>, click <b>Review permissions</b>, tick <b>Select all</b> and allow. Then deploy a new version and press this button again.':esc(err.message);b.disabled=false;b.textContent=st.calUrl?'Save':'Connect'}};
  const t=$('.caltest',m);if(t)t.onclick=async()=>{t.disabled=true;try{const d=await AAPI.call('/admin/events/settings',{method:'POST',body:{action:'test'}});toast(`Working. Emails are sent from ${d.email||'your Google account'}${d.quota!=null?` · ${d.quota} left today`:''}`)}catch(err){toast(err.message,true)}t.disabled=false};
  const dc=$('.caldis',m);if(dc)dc.onclick=async()=>{EVSET=await AAPI.call('/admin/events/settings',{method:'PATCH',body:{calUrl:''}});close();toast('Calendar invitations turned off');renderEvents()};
 });
}

/* ---------- Excel (.xlsx) download, built in the browser: a small zip (stored) with the sheet XML ---------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zipStore(files){
 const enc=new TextEncoder(),parts=[],cen=[];let off=0;
 const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 for(const [name,text] of files){const nm=enc.encode(name),d=enc.encode(text),c=crc32(d);
  const common=[...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0)];
  const loc=new Uint8Array([...u32(0x04034b50),...common]);parts.push(loc,nm,d);
  cen.push(new Uint8Array([...u32(0x02014b50),...u16(20),...common,...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
  off+=loc.length+nm.length+d.length}
 const cl=cen.reduce((t,x)=>t+x.length,0);
 return new Blob([...parts,...cen,new Uint8Array([...u32(0x06054b50),0,0,0,0,...u16(files.length),...u16(files.length),...u32(cl),...u32(off),0,0])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
/* rows: arrays of strings, numbers, or {d:Date}. title rows on top, then a bold header row with a filter */
// one or more sheets: [{name,titles,head,rows,widths}]; titles are lines above a bold header row with filters
function xlsxBook(sheets){
 const x=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const col=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=(i-m-1)/26}return s};
 const cell=(v,r,c,st)=>{const ref=col(c)+r;
  if(v&&v.d instanceof Date)return `<c r="${ref}" s="3"><v>${(v.d.getTime()-v.d.getTimezoneOffset()*60000)/86400000+25569}</v></c>`;
  if(typeof v==='number')return `<c r="${ref}"${st?` s="${st}"`:''}><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${st?` s="${st}"`:''}><is><t xml:space="preserve">${x(v)}</t></is></c>`};
 const used=new Set();
 const built=sheets.map((sh,si)=>{
  let r=0;const out=[];const titles=sh.titles||[];
  titles.forEach((t,i)=>{r++;out.push(`<row r="${r}">${(Array.isArray(t)?t:[t]).map((v,c)=>cell(v,r,c,i===0&&c===0?2:Array.isArray(t)&&c===0?1:0)).join('')}</row>`)});
  if(titles.length)r++;
  let hr=0;
  if(sh.head&&sh.head.length){hr=++r;out.push(`<row r="${hr}">${sh.head.map((h,c)=>cell(h,hr,c,1)).join('')}</row>`)}
  (sh.rows||[]).forEach(row=>{r++;out.push(`<row r="${r}">${row.map((v,c)=>cell(v,r,c,0)).join('')}</row>`)});
  const last=col(Math.max(0,(sh.head||[]).length-1)),filt=hr&&sh.rows&&sh.rows.length;
  let name=String(sh.name||'Sheet'+(si+1)).replace(/[\[\]:*?\/\\]/g,' ').slice(0,31);while(used.has(name))name=name.slice(0,28)+' '+si;used.add(name);
  const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"${si===0?' tabSelected="1"':''}>${hr?`<pane ySplit="${hr}" topLeftCell="A${hr+1}" activePane="bottomLeft" state="frozen"/>`:''}</sheetView></sheetViews><cols>${(sh.widths||[]).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${out.join('')}</sheetData>${filt?`<autoFilter ref="A${hr}:${last}${hr+sh.rows.length}"/>`:''}</worksheet>`;
  return {name:x(name),raw:name,xml,def:filt?`<definedName name="_xlnm._FilterDatabase" localSheetId="${si}" hidden="1">'${x(name).replace(/'/g,"''")}'!$A$${hr}:$${last}$${hr+sh.rows.length}</definedName>`:''};
 });
 const defs=built.map(b=>b.def).join('');
 return zipStore([
  ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${built.map((b,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${built.map((b,i)=>`<sheet name="${b.name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>${defs?`<definedNames>${defs}</definedNames>`:''}</workbook>`],
  ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${built.map((b,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${built.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd mmm yyyy, hh:mm"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1A1E3A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
  ...built.map((b,i)=>[`xl/worksheets/sheet${i+1}.xml`,b.xml])]);
}
const xlsxBlob=(sheetName,titles,head,rows,widths)=>xlsxBook([{name:sheetName,titles,head,rows,widths}]);
const saveBlob=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};

/* ---------- one event: header with Registrations / Check-in tabs ---------- */
const evCanCheckin=e=>e.regMode==='form'&&e.mode!=='online';
function evHeadHTML(e,active){
 const c=e.counts||{};
 return `<p class="rback"><button type="button" class="linkbtn backev">← All events</button></p>
 <div class="evhead"><h1>${esc(e.title)}</h1><p class="small">${esc(evDate(e))}${e.mode==='offline'&&e.locationName?' · '+esc(e.locationName):e.mode==='online'?' · Online':''}</p></div>
 <nav class="evsub" role="tablist"><button type="button" role="tab" data-sub="regs" class="${active==='regs'?'on':''}" aria-selected="${active==='regs'}">Registrations${c.total!=null?` <i>${c.total}</i>`:''}</button>${evCanCheckin(e)?`<button type="button" role="tab" data-sub="checkin" class="${active==='checkin'?'on':''}" aria-selected="${active==='checkin'}">📷 Check-in${c.seats?` <i>${c.attended||0}/${c.seats}</i>`:''}</button>`:''}${e.regMode==='form'?`<button type="button" role="tab" data-sub="report" class="${active==='report'?'on':''}" aria-selected="${active==='report'}">📊 Report</button>`:''}</nav>`;
}
function bindEvHead(e){
 $('.backev').onclick=async()=>{if(typeof stopScan==='function')stopScan();history.replaceState(null,'','#events');await loadEvents();renderEvents();scrollTo(0,0)};
 $$('[data-sub]').forEach(b=>b.onclick=async()=>{if(typeof stopScan==='function')stopScan();try{await loadEvents()}catch(x){}const fresh=EVENTS.find(x=>x.id===e.id)||e;b.dataset.sub==='checkin'?checkinView(fresh):b.dataset.sub==='report'?reportView(fresh):regsView(fresh)});
}

/* ---------- Registrations page for one event ---------- */
const REG_ST={pending:['Waiting for approval','warn'],approved:['Approved','ok'],confirmed:['Confirmed','ok'],rejected:['Rejected','no'],cancelled:['Cancelled','muted']};
const countryName=iso=>{const c=(typeof COUNTRIES!=='undefined'?COUNTRIES:[]).find(x=>x[0]===iso);return c?c[1]:(iso||'')};
const regTime=at=>new Date(at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});

async function regsView(e){
 const main=$('.adm');main.innerHTML='<p class="lead" style="margin-top:20px">Loading registrations…</p>';
 let regs=[],calOn=false;try{const d=await AAPI.call(`/admin/events/${e.id}/regs`);regs=d.regs;calOn=d.calendar}catch(err){toast(err.message,true);return renderEvents()}
 const notInvited=()=>regs.filter(r=>['confirmed','approved'].includes(r.status)&&!r.cal).length;
 const calCell=r=>!['confirmed','approved'].includes(r.status)?'<span class="muted">–</span>':r.cal?'<span class="calyes" title="Invited '+esc(regTime(r.cal))+'">✓ Invited</span>':r.calErr?'<span class="calno" title="'+esc(r.calErr)+'">Not sent</span>':'<span class="muted">Not yet</span>';
 let q='',fs='all';const sel=new Set();
 const imp=r=>r.status==='pending'&&r.source==='import';
 const stLabel=r=>imp(r)?['Imported · not confirmed','warn']:REG_ST[r.status]||[r.status,''];
 const FM=e.form||{std:{whatsapp:true,country:true,education:false,role:false},fields:[]};
 const showStd=k=>!!FM.std[k]||regs.some(r=>r[k]);
 const QF=(FM.fields||[]).filter(f=>f.type!=='section');
 const ans=(r,f)=>(r.answers||{})[f.id];
 const ansCell=(r,f)=>{const v=ans(r,f);if(f.type==='file'&&v&&v.id)return `<button type="button" class="linkbtn sm fileopen" data-file="${v.id}">📎 ${esc(v.name||'File')}</button>`;const t=FF.show(f,v);return t?`<span class="ans" title="${esc(t)}">${esc(t)}</span>`:'<span class="muted">–</span>'};
 const okReg=r=>['confirmed','approved'].includes(r.status);
 const attCell=r=>!okReg(r)?'<span class="muted">–</span>':r.attended?`<span class="attyes">✓ ${esc(new Date(r.attended).toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit',hour12:true}))}</span> <button type="button" class="linkbtn sm" data-att="0" data-id="${r.id}" title="Undo check-in">Undo</button>`:`<button type="button" class="btn sm ghost" data-att="1" data-id="${r.id}">Check in</button>`;
 const live=r=>!['rejected','cancelled'].includes(r.status);
 const counted=r=>live(r)&&!imp(r);
 const confirmMsg=r=>waFill(waTemplate(e,EVSET),waEvent(e),waPerson(e,r));   // the event's WhatsApp message (or the common one)
 const ordered=()=>regs.slice().sort((a,b)=>a.at<b.at?-1:1); // oldest first, so # is the sign-up order
 const shown=()=>{const t=q.trim().toLowerCase();return ordered().map((r,i)=>({r,n:i+1})).filter(({r})=>(fs==='all'||(fs==='active'?counted(r):fs==='imported'?imp(r):fs==='pending'?r.status==='pending'&&!imp(r):fs==='in'?!!r.attended:fs==='notin'?okReg(r)&&!r.attended:r.status===fs))&&(!t||[r.name,r.email,r.phone,r.whatsapp,r.ref,countryName(r.country),r.education,r.role,...QF.map(f=>FF.show(f,ans(r,f)))].join(' ').toLowerCase().includes(t)))};
 const download=()=>{
  const head=['#','Ref','Name','Email','Mobile'],w=[5,11,24,30,17];const cols=[];
  if(showStd('whatsapp')){head.push('WhatsApp');w.push(17);cols.push(r=>r.whatsapp||'')}
  if(showStd('country')){head.push('Country');w.push(16);cols.push(r=>countryName(r.country))}
  if(showStd('education')){head.push('Education');w.push(12);cols.push(r=>r.education||'')}
  if(showStd('role')){head.push('Student / Parent');w.push(15);cols.push(r=>r.role||'')}
  for(const f of QF){if(f.type==='grid'||f.type==='checkgrid'){for(const row of f.rows||[]){head.push(`${f.label} [${row}]`);w.push(20);cols.push(r=>{const v=(ans(r,f)||{})[row];return Array.isArray(v)?v.join(', '):v||''})}}
   else{head.push(f.label);w.push(f.type==='paragraph'?40:22);cols.push(r=>{const v=ans(r,f);return f.type==='scale'||(f.type==='short'&&f.valid==='number')?(v===undefined||v===''?'':Number(v)):FF.show(f,v)})}}
  head.push('People','Status','Registered on','Attended');w.push(8,20,20,20);
  if(e.paid){head.push('Amount');w.push(14)}
  const rows=ordered().map((r,i)=>{const row=[i+1,r.ref,r.name,r.email,r.phone,...cols.map(c=>c(r)),r.seats,(REG_ST[r.status]||[r.status])[0],{d:new Date(r.at)},r.attended?{d:new Date(r.attended)}:''];if(e.paid)row.push(`${e.currency} ${e.price*r.seats}`);return row});
  const act=regs.filter(live);
  const titles=[e.title,`${evDate(e)} · ${e.mode==='online'?'Online':e.locationName||''}`,`${regs.length} registrations · ${act.reduce((t,r)=>t+r.seats,0)} people attending${e.capacity?' of '+e.capacity+' seats':''} · ${regs.filter(r=>okReg(r)&&r.attended).reduce((t,r)=>t+r.seats,0)} checked in · downloaded ${regTime(Date.now())}`];
  const a=document.createElement('a');a.href=URL.createObjectURL(xlsxBlob('Registrations',titles,head,rows,w));a.download=`${e.slug}-registrations.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Excel file downloaded')};
 const acts=r=>`${r.status==='pending'?`<button type="button" class="btn sm" data-r="${e.paid?'approved':'confirmed'}" data-id="${r.id}">${e.paid?'Approve':'Confirm'}</button><button type="button" class="btn sm ghost" data-r="rejected" data-id="${r.id}">Reject</button>`:''}${['approved','confirmed'].includes(r.status)&&r.tk&&e.mode!=='online'?`<a class="btn sm ghost" target="_blank" rel="noopener" href="/badge/${r.tk}">Badge</a>`:''}${['approved','confirmed'].includes(r.status)?`<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(r.whatsapp||r.phone,confirmMsg(r))}">Send details on WhatsApp</a><button type="button" class="btn sm ghost" data-r="cancelled" data-id="${r.id}">Cancel</button>`:''}${['rejected','cancelled'].includes(r.status)?`<button type="button" class="btn sm ghost" data-r="${e.paid?'pending':'confirmed'}" data-id="${r.id}">Restore</button>`:''}`;
 const table=()=>{const list=shown();
  if(!regs.length)return '<div class="empty"><p>No registrations yet. They appear here as soon as someone registers on the event page.</p></div>';
  if(!list.length)return '<div class="empty"><p>No registrations match your search.</p></div>';
  return `<div class="rtwrap"><table class="rtable"><thead><tr><th class="selc"><input type="checkbox" class="selall" aria-label="Select all shown" ${list.length&&list.every(({r})=>sel.has(r.id))?'checked':''}></th><th>#</th><th>Ref</th><th>Name</th><th>Email</th><th>Mobile</th>${showStd('whatsapp')?'<th>WhatsApp</th>':''}${showStd('country')?'<th>Country</th>':''}${showStd('education')?'<th>Education</th>':''}${showStd('role')?'<th>Student / Parent</th>':''}${QF.map(f=>`<th class="qh" title="${esc(f.label)}">${esc(f.label.length>40?f.label.slice(0,38)+'…':f.label)}</th>`).join('')}<th>People</th><th>Status</th>${calOn?'<th>Calendar</th>':''}${regs.some(r=>r.wa)?'<th>WhatsApp</th>':''}<th>Attended</th><th>Registered on</th><th>Actions</th></tr></thead><tbody>${list.map(({r,n})=>{const [sl,sc]=stLabel(r);return `<tr class="${live(r)?'':'off'} ${sel.has(r.id)?'picked':''}"><td class="selc"><input type="checkbox" data-sel="${r.id}" ${sel.has(r.id)?'checked':''} aria-label="Select ${esc(r.name)}"></td><td>${n}</td><td class="mono">${esc(r.ref)}</td><td class="nw"><b>${esc(r.name)}</b></td><td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td><td class="nw"><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></td>${showStd('whatsapp')?`<td class="nw">${r.whatsapp?`<a href="${waLink(r.whatsapp,'')}" target="_blank" rel="noopener">${esc(r.whatsapp)}</a>`:'<span class="muted">–</span>'}</td>`:''}${showStd('country')?`<td class="nw">${esc(countryName(r.country))}</td>`:''}${showStd('education')?`<td>${esc(r.education||'')}</td>`:''}${showStd('role')?`<td>${esc(r.role||'')}</td>`:''}${QF.map(f=>`<td>${ansCell(r,f)}</td>`).join('')}<td class="num">${r.seats}</td><td><span class="chipx ${sc}">${sl}</span></td>${calOn?`<td class="nowrap">${calCell(r)}</td>`:''}${regs.some(x=>x.wa)?`<td class="nowrap">${r.wa&&r.wa.at?`<span class="calyes" title="Sent by ${esc(r.wa.by||'')}">✓ Sent</span><small class="muted" style="display:block">${esc(r.wa.by||'')}</small>`:'<span class="muted">–</span>'}</td>`:''}<td class="nowrap">${attCell(r)}</td><td class="nowrap">${esc(regTime(r.at))}</td><td><div class="regact">${acts(r)}</div></td></tr>`}).join('')}</tbody></table></div>`};
 const stats=()=>{const act=regs.filter(counted),nimp=regs.filter(imp).length,ppl=act.reduce((t,r)=>t+r.seats,0),pend=regs.filter(r=>r.status==='pending'&&!imp(r)).length,stu=act.filter(r=>r.role==='Student').length,par=act.filter(r=>r.role==='Parent').length;
  return `<div class="rstats"><div><b>${regs.length}</b><span>Registrations</span></div><div><b>${ppl}${e.capacity?`<small> / ${e.capacity}</small>`:''}</b><span>People attending</span></div>${e.paid?`<div class="${pend?'hot':''}"><b>${pend}</b><span>Waiting for approval</span></div>`:''}${nimp?`<div class="hot"><b>${nimp}</b><span>Imported, not confirmed</span></div>`:''}<div class="chk"><b>${regs.filter(r=>okReg(r)&&r.attended).reduce((t,r)=>t+r.seats,0)}<small> / ${ppl}</small></b><span>Checked in</span></div>${showStd('role')?`<div><b>${stu}</b><span>Students</span></div><div><b>${par}</b><span>Parents</span></div>`:''}</div>`};
 const opts=[['all','All'],['active','Attending'],...(e.paid?[['pending','Waiting for approval'],['approved','Approved'],['rejected','Rejected']]:[['confirmed','Confirmed']]),['cancelled','Cancelled'],['in','Checked in'],['notin','Not checked in yet'],['imported','Imported, not confirmed']];
 main.innerHTML=`${evHeadHTML(e,'regs')}
  <div class="evbtns rbtns"><button type="button" class="btn xls" ${regs.length?'':'disabled'}>⬇ Download Excel</button><button type="button" class="btn ghost impx">⬆ Import from Excel</button><button type="button" class="btn ghost editev">Edit event</button></div>
  <div class="calnote"></div>
  <div class="rstatwrap">${stats()}</div>
  <div class="rtools"><input type="search" class="rq" placeholder="Search name, email, mobile or ref" aria-label="Search registrations"><select class="rf" aria-label="Show">${opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div>
  <div class="wlistwrap"></div>
  <div class="bulkbar" hidden></div>
  <div class="rtbody">${table()}</div>`;
 const bind=()=>{$$('.fileopen',main).forEach(b=>b.onclick=async()=>{const w=window.open('about:blank','_blank');try{const r=await fetch('/api/admin/uploads/'+b.dataset.file,{headers:{authorization:'Bearer '+AAPI.token()}});if(!r.ok)throw new Error('File not found');const u=URL.createObjectURL(await r.blob());if(w)w.location=u;else location.href=u}catch(err){if(w)w.close();toast(err.message,true)}});$$('[data-att]',main).forEach(b=>b.onclick=async()=>{b.disabled=true;try{const d=await AAPI.call(`/admin/events/${e.id}/regs/${b.dataset.id}`,{method:'PATCH',body:{attended:b.dataset.att==='1'}});regs=regs.map(x=>x.id===d.reg.id?d.reg:x);toast(d.reg.attended?`${d.reg.name} checked in`:'Check-in undone');draw()}catch(err){b.disabled=false;toast(err.message,true)}});bindR()};
 const bindR=()=>$$('[data-r]',main).forEach(b=>b.onclick=async()=>{const st=b.dataset.r;b.disabled=true;
  try{const d=await AAPI.call(`/admin/events/${e.id}/regs/${b.dataset.id}`,{method:'PATCH',body:{status:st}});regs=regs.map(x=>x.id===d.reg.id?d.reg:x);
   toast((st==='approved'?'Approved. Now send the joining details on WhatsApp.':'Updated')+(d.calendar&&d.calendar!=='ok'?' Invitation email not sent: '+d.calendar:d.calendar==='ok'?(st==='approved'||st==='confirmed'?' Invitation email sent.':' Cancellation email sent.'):''),!!d.calendar&&d.calendar!=='ok');
   if(st==='approved'){e.onlineUrl=d.onlineUrl||e.onlineUrl;window.open(waLink(d.reg.whatsapp||d.reg.phone,confirmMsg(d.reg)),'_blank','noopener')}
   draw();loadEvents()}catch(err){b.disabled=false;toast(err.message,true)}});
 const note=()=>{const n=notInvited(),el=$('.calnote',main);
  el.innerHTML=!calOn?`<p class="small">📅 Calendar invitations are off. <button type="button" class="linkbtn gocal">Connect them</button> so people get an invitation email with the event for their calendar.</p>`:n?`<div class="calbar"><span class="calic">📅</span><div><b>${n} ${n===1?'person has':'people have'} no invitation email yet</b><small>For example people who registered before invitations were switched on, or when Gmail's daily limit was reached.</small></div><button type="button" class="btn sm invall">Send calendar invites</button></div>`:'';
  const g=$('.gocal',el);if(g)g.onclick=calSetup;
  const iv=$('.invall',el);if(iv)iv.onclick=async()=>{iv.disabled=true;let sent=0,err='',skip=[],left=1;
   while(left>0){iv.textContent=`Sending… ${sent} sent`;
    try{const d=await AAPI.call(`/admin/events/${e.id}/regs`,{method:'POST',body:{action:'invite-all',skip}});regs=d.regs;sent+=d.invited;skip=skip.concat(d.failed||[]);left=d.left;if(d.error){err=d.error;if(/limit/i.test(d.error))break}if(!d.invited&&!(d.failed||[]).length)break}
    catch(x){err=x.message;break}}
   toast(sent?`Invitations sent to ${sent} ${sent===1?'person':'people'}${err?'. Some were not sent: '+err:''}`:err||'Nothing to send',!!err);draw()}};
 const bulkBar=()=>{const bb=$('.bulkbar',main);const n=sel.size;bb.hidden=!n;if(!n)return;
  const picked=regs.filter(r=>sel.has(r.id)),canConfirm=picked.filter(r=>!okReg(r)).length;
  bb.innerHTML=`<b>${n} selected</b>${canConfirm?`<button type="button" class="btn sm bconf">✓ Confirm${calOn?' & email badges':''} (${canConfirm})</button>`:''}<button type="button" class="btn sm ghost bwa">📤 WhatsApp list</button><button type="button" class="btn sm ghost" data-bulk="checkin">Check in</button><button type="button" class="btn sm ghost" data-bulk="${e.paid?'reject':'cancel'}">${e.paid?'Reject':'Cancel'}</button><button type="button" class="btn sm ghost danger" data-bulk="delete">Delete</button><button type="button" class="linkbtn bclr">Clear selection</button>`;
  $('.bclr',bb).onclick=()=>{sel.clear();draw()};
  $('.bwa',bb).onclick=()=>slCreate(e,regs,[...sel],async()=>{try{regs=(await AAPI.call(`/admin/events/${e.id}/regs`)).regs}catch(x){}sel.clear();draw();slPanel(e,$('.wlistwrap',main))});
  const run=async(op,label)=>{const ids=[...sel];$$('button',bb).forEach(b=>b.disabled=true);
   try{const d=await AAPI.call(`/admin/events/${e.id}/regs`,{method:'POST',body:{action:'bulk',op,ids}});regs=d.regs;sel.clear();draw();toast(`${label}: ${d.changed}${d.skipped?` (${d.skipped} skipped)`:''}`);loadEvents();return d}catch(err){toast(err.message,true);draw()}};
  const cf=$('.bconf',bb);if(cf)cf.onclick=async()=>{const d=await run('confirm','Confirmed');if(!d||!d.changed)return;
   if(fs==='imported'){fs='all';$('.rf',main).value='all';draw()}
   if(!calOn)return toast('Confirmed. Badges are ready; invitation emails are off (connect them under Events).');
   // email the badge and invitation to everyone confirmed who has not had one yet, 10 at a time
   let sent=0,err='',skip=[],left=1;const bar=$('.bulkbar',main);bar.hidden=false;
   while(left>0){bar.innerHTML=`<b>Sending invitation emails… ${sent} sent</b>`;
    try{const x=await AAPI.call(`/admin/events/${e.id}/regs`,{method:'POST',body:{action:'invite-all',skip}});regs=x.regs;sent+=x.invited;skip=skip.concat(x.failed||[]);left=x.left;if(x.error){err=x.error;if(/limit/i.test(x.error))break}if(!x.invited&&!(x.failed||[]).length)break}catch(y){err=y.message;break}}
   bar.hidden=true;draw();toast(`${d.changed} confirmed · ${sent} invitation email${sent===1?'':'s'} with badge sent${err?'. Not sent to some: '+err:''}`,!!err)};
  $$('[data-bulk]',bb).forEach(b=>b.onclick=async()=>{const op=b.dataset.bulk;
   if(op==='delete'&&!await confirmBox(`Delete ${n} registration${n>1?'s':''}?`,'They are removed from this event completely. This cannot be undone.','Delete',true))return;
   if((op==='cancel'||op==='reject')&&!await confirmBox(`${op==='reject'?'Reject':'Cancel'} ${n} registration${n>1?'s':''}?`,'People who already got an invitation email receive a short cancellation.',op==='reject'?'Reject':'Cancel them',true))return;
   run(op,{checkin:'Checked in',cancel:'Cancelled',reject:'Rejected',delete:'Deleted'}[op])});
 };
 const bindSel=()=>{$$('[data-sel]',main).forEach(c=>c.onchange=()=>{c.checked?sel.add(c.dataset.sel):sel.delete(c.dataset.sel);c.closest('tr').classList.toggle('picked',c.checked);const all=$('.selall',main);if(all)all.checked=shown().every(({r})=>sel.has(r.id));bulkBar()});
  const all=$('.selall',main);if(all)all.onchange=()=>{shown().forEach(({r})=>all.checked?sel.add(r.id):sel.delete(r.id));draw()};bulkBar()};
 const draw=()=>{$('.rtbody',main).innerHTML=table();$('.rstatwrap',main).innerHTML=stats();note();bind();bindSel()};
 $('.rq',main).oninput=ev=>{q=ev.target.value;draw()};
 $('.rf',main).onchange=ev=>{fs=ev.target.value;draw()};
 $('.xls',main).onclick=download;
 bindEvHead(e);history.replaceState(null,'','#events/'+e.id);
 $('.editev',main).onclick=()=>eventForm(EVENTS.find(x=>x.id===e.id)||e);
 note();bind();bindSel();scrollTo(0,0);slPanel(e,$('.wlistwrap',main));
 $('.impx',main).onclick=()=>importView(e,regs,(d)=>{regs=d.regs;sel.clear();regs.filter(r=>imp(r)).forEach(r=>sel.add(r.id));fs='imported';$('.rf',main).value='imported';draw();$('.bulkbar',main).scrollIntoView({behavior:'smooth',block:'center'})});
}
