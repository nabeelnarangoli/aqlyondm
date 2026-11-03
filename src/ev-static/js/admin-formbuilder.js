/* =====================================================================
   Admin: registration form builder (like Google Forms) inside the event editor.
   Name, email and mobile are always asked. WhatsApp, country, education level and
   student/parent can be switched off. "＋ Add field" opens a picker where any number of
   question types and ready-made questions can be ticked and added at once.
   ===================================================================== */
const FB_STD=[['whatsapp','WhatsApp number'],['country','Country'],['education','Education level'],['role','Student or parent']];
const FB_VALID=[['text','Any text'],['number','Number'],['email','Email address'],['url','Web link'],['phone','Phone number']];

function formBuilder(box,FORM,ev){
 const fields=()=>FORM.fields;
 const optEditor=(f,key,label,addLabel)=>`<div class="fbopts" data-list="${key}"><p class="fbsub">${label}</p>${(f[key]||[]).map((o,i)=>`<div class="fbopt"><span class="fbmark">${key==='options'?(f.type==='checkboxes'?'☐':f.type==='dropdown'?(i+1)+'.':'◯'):key==='rows'?(i+1)+'.':'▢'}</span><input value="${esc(o)}" data-o="${i}" maxlength="${key==='options'?120:80}" aria-label="${label} ${i+1}"><button type="button" class="fbx" data-rmo="${i}" aria-label="Remove">×</button></div>`).join('')}
  <div class="fboptadd"><button type="button" class="linkbtn" data-addo>＋ ${addLabel}</button><button type="button" class="linkbtn" data-paste>Paste a list</button>${key==='options'&&f.type!=='dropdown'?`<label class="fbinl"><input type="checkbox" data-k="other" ${f.other?'checked':''}> Add "Other" with a text box</label>`:''}</div></div>`;
 const editor=f=>{
  switch(f.type){
   case 'choice':case 'checkboxes':case 'dropdown':return optEditor(f,'options','Options','Add option');
   case 'short':return `<div class="fbrow"><label>Answer must be<select data-k="valid">${FB_VALID.map(([v,t])=>`<option value="${v}" ${f.valid===v?'selected':''}>${t}</option>`).join('')}</select></label>${f.valid==='number'?`<label>Lowest<input type="number" data-k="min" value="${f.min??''}"></label><label>Highest<input type="number" data-k="max" value="${f.max??''}"></label>`:''}</div>`;
   case 'scale':return `<div class="fbrow"><label>From<select data-k="scaleMin">${[0,1].map(n=>`<option ${+f.scaleMin===n?'selected':''}>${n}</option>`).join('')}</select></label><label>To<select data-k="scaleMax">${[2,3,4,5,6,7,8,9,10].map(n=>`<option ${+f.scaleMax===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Label at the start<input data-k="minLabel" maxlength="40" value="${esc(f.minLabel||'')}" placeholder="e.g. Not at all"></label><label>Label at the end<input data-k="maxLabel" maxlength="40" value="${esc(f.maxLabel||'')}" placeholder="e.g. Very much"></label></div>`;
   case 'rating':return `<div class="fbrow"><label>Number of stars<select data-k="stars">${[3,4,5,6,7,8,9,10].map(n=>`<option ${+f.stars===n?'selected':''}>${n}</option>`).join('')}</select></label></div>`;
   case 'grid':case 'checkgrid':return `<div class="fbgrid">${optEditor(f,'rows','Rows','Add row')}${optEditor(f,'cols','Columns','Add column')}</div>`;
   case 'file':return `<div class="fbrow"><label>Allowed files<select data-k="accept">${[['image,pdf','Photo or PDF'],['image','Photo only'],['pdf','PDF only']].map(([v,t])=>`<option value="${v}" ${f.accept===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="fbsub">Up to 3 MB per file. You can open the files from Registrations.</p></div>`;
  }
  return '';
 };
 const card=(f,i)=>`<div class="fbcard ${f.type==='section'?'sec':''}" data-i="${i}">
  <div class="fbtop"><span class="fbnum">${f.type==='section'?'T':i+1}</span><input class="fblabel" data-k="label" value="${esc(f.label)}" placeholder="${f.type==='section'?'Section title':'Question'}" maxlength="200" aria-label="Question">
   <select class="fbtype" data-type aria-label="Question type">${FF.TYPES.map(t=>`<option value="${t.t}" ${f.type===t.t?'selected':''}>${t.ic} ${t.name}</option>`).join('')}</select></div>
  <input class="fbhelp" data-k="help" value="${esc(f.help||'')}" placeholder="${f.type==='section'?'Description (optional)':'Description or hint (optional)'}" maxlength="500" aria-label="Description">
  ${editor(f)}
  <div class="fbfoot">${f.type==='section'?'':`<label class="fbreq"><input type="checkbox" data-k="required" ${f.required?'checked':''}><span>Required</span></label>`}
   <span class="fbtools"><button type="button" data-mv="-1" ${i?'':'disabled'} aria-label="Move up" title="Move up">↑</button><button type="button" data-mv="1" ${i<fields().length-1?'':'disabled'} aria-label="Move down" title="Move down">↓</button><button type="button" data-dup aria-label="Duplicate" title="Duplicate">⧉</button><button type="button" data-del aria-label="Delete" title="Delete">🗑</button></span></div></div>`;
 const draw=()=>{
  box.innerHTML=`<div class="fbhead"><b>Registration form</b><small>Choose the questions people answer when they register.</small></div>
  <div class="fbfixed">${['Full name','Email','Mobile number'].map(t=>`<span class="fbchip lock" title="Always asked">🔒 ${t}</span>`).join('')}
   ${FB_STD.map(([k,t])=>`<label class="fbchip tog ${FORM.std[k]?'on':''}"><input type="checkbox" data-std="${k}" ${FORM.std[k]?'checked':''}><span>${t}</span></label>`).join('')}</div>
  <p class="fbsub">🔒 Always asked (needed for the badge and emails). Tap the others to switch them on or off.</p>
  <div class="fbcards">${fields().map(card).join('')}</div>
  ${fields().length?'':'<p class="fbempty">No extra questions yet.</p>'}
  <div class="fbbtns"><button type="button" class="btn sm fbadd">＋ Add field</button><button type="button" class="btn ghost sm fbprev">👁 Preview form</button></div>`;
  bind();
 };
 const bind=()=>{
  $$('[data-std]',box).forEach(c=>c.onchange=()=>{FORM.std[c.dataset.std]=c.checked;c.closest('.fbchip').classList.toggle('on',c.checked)});
  $('.fbadd',box).onclick=()=>fbPicker(FORM,added=>{FORM.fields.push(...added);draw();const cs=$$('.fbcard',box);const first=cs[cs.length-added.length];if(first){mScroll(first);first.classList.add('fbnew');const l=$('.fblabel',first);if(l&&!l.value)l.focus({preventScroll:true})}});
  $('.fbprev',box).onclick=()=>fbPreview(FORM,ev);
  $$('.fbcard',box).forEach(c=>{const i=+c.dataset.i,f=fields()[i];
   $$('[data-k]',c).forEach(inp=>{const k=inp.dataset.k;const up=()=>{let v=inp.type==='checkbox'?inp.checked:inp.value;if(['scaleMin','scaleMax','stars'].includes(k))v=+v;f[k]=v;if(k==='valid')draw()};inp.oninput=up;inp.onchange=up});
   $('[data-type]',c).onchange=x=>{const t=x.target.value,nb=FF.blank(t);const keep={id:f.id,label:f.label,help:f.help,required:t==='section'?false:f.required};
    if(FF.OPT_TYPES.includes(t)&&f.options)keep.options=f.options;fields()[i]={...nb,...keep};draw()};
   $$('[data-list]',c).forEach(L=>{const key=L.dataset.list;
    $$('[data-o]',L).forEach(inp=>inp.oninput=()=>{f[key][+inp.dataset.o]=inp.value});
    $$('[data-o]',L).forEach(inp=>inp.onkeydown=k=>{if(k.key==='Enter'){k.preventDefault();f[key].splice(+inp.dataset.o+1,0,'');draw();const n=$$(`.fbcard[data-i="${i}"] [data-list="${key}"] [data-o]`,box)[+inp.dataset.o+1];if(n)n.focus({preventScroll:true})}});
    $$('[data-rmo]',L).forEach(b=>b.onclick=()=>{if(f[key].length<=1)return toast('Keep at least one.',true);f[key].splice(+b.dataset.rmo,1);draw()});
    $('[data-addo]',L).onclick=()=>{const n=f[key].length+1;f[key].push(key==='options'?'Option '+n:key==='rows'?'Row '+n:'Column '+n);draw();const ins=$$(`.fbcard[data-i="${i}"] [data-list="${key}"] [data-o]`,box);const last=ins[ins.length-1];if(last){last.focus({preventScroll:true});last.select()}};
    $('[data-paste]',L).onclick=()=>modal(`<h2>Paste a list</h2><p class="small">One item per line. This replaces the current ${key==='options'?'options':key}.</p><textarea class="pastebox" rows="8">${esc(f[key].join('\n'))}</textarea><div class="mrow"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn pasteok">Use this list</button></div>`,(pm,close)=>{const ta=$('.pastebox',pm);ta.focus();$('.pasteok',pm).onclick=()=>{const items=[...new Set(ta.value.split('\n').map(x=>x.trim()).filter(Boolean))];if(!items.length)return toast('The list is empty.',true);const cap=key==='options'?(f.type==='dropdown'?5000:50):20;f[key]=items.slice(0,cap);close();draw();if(items.length>cap)toast(`Only the first ${cap} were kept${f.type!=='dropdown'&&key==='options'?' (use a Dropdown for longer lists)':''}.`,true)}});
   });
   $$('[data-mv]',c).forEach(b=>b.onclick=()=>{const j=i+ +b.dataset.mv;if(j<0||j>=fields().length)return;[fields()[i],fields()[j]]=[fields()[j],fields()[i]];draw()});
   $('[data-dup]',c).onclick=()=>{const copyF={...JSON.parse(JSON.stringify(f)),id:FF.nid()};fields().splice(i+1,0,copyF);draw()};
   $('[data-del]',c).onclick=async()=>{if(ev&&ev.counts&&ev.counts.total&&f.type!=='section'&&!await confirmBox('Delete this question?',`Answers already given to <b>${esc(f.label||'this question')}</b> will no longer show in Registrations or the Excel file.`,'Delete question',true))return;fields().splice(i,1);draw()};
  });
 };
 draw();
}

/* picker: tick any number of question types and ready-made questions, then add them all */
function fbPicker(FORM,onAdd){
 const have=new Set(FORM.fields.map(f=>f.label.toLowerCase()));
 const pick=new Map();   // key -> count
 modal(`<h2>Add fields</h2><p class="small">Tick everything you need, then press <b>Add</b>. Tap a question type again to add more than one.</p>
 <h3 class="fbph">Question types</h3><div class="fbtiles">${FF.TYPES.map(t=>`<button type="button" class="fbtile" data-key="t:${t.t}"><span class="ic">${t.ic}</span><b>${t.name}</b><small>${t.desc}</small><i class="cnt"></i></button>`).join('')}</div>
 <h3 class="fbph">Ready-made questions</h3><div class="fbtiles pre">${FF.PRESETS.map((p,i)=>`<button type="button" class="fbtile" data-key="p:${i}" ${have.has(p.label.toLowerCase())?'data-had="1"':''}><span class="ic">${(FF.TYPES.find(t=>t.t===p.type)||{}).ic||'?'}</span><b>${esc(p.label)}</b><small>${FF.typeName(p.type)}${p.options?' · '+esc(p.options.slice(0,3).join(', '))+(p.options.length>3?'…':''):''}${have.has(p.label.toLowerCase())?' · already in your form':''}</small><i class="cnt"></i></button>`).join('')}</div>
 <div class="mrow fbpickbar"><span class="fbpicked small">Nothing selected</span><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn fbdo" disabled>Add</button></div>`,(m,close)=>{
  m.querySelector('.modal').classList.add('wide','fbpick');
  const sync=()=>{let n=0;$$('.fbtile',m).forEach(b=>{const c=pick.get(b.dataset.key)||0;n+=c;b.classList.toggle('on',c>0);$('.cnt',b).textContent=c>1?'×'+c:c?'✓':''});
   $('.fbpicked',m).textContent=n?`${n} field${n>1?'s':''} selected`:'Nothing selected';const d=$('.fbdo',m);d.disabled=!n;d.textContent=n?`Add ${n} field${n>1?'s':''}`:'Add'};
  $$('.fbtile',m).forEach(b=>{b.onclick=()=>{const k=b.dataset.key,c=pick.get(k)||0;
    if(k.startsWith('t:'))pick.set(k,c>=5?0:c+1);else pick.set(k,c?0:1);sync()};
   b.oncontextmenu=x=>{x.preventDefault();pick.set(b.dataset.key,0);sync()}});
  $('.fbdo',m).onclick=()=>{const out=[];
   $$('.fbtile',m).forEach(b=>{const k=b.dataset.key,c=pick.get(k)||0;for(let j=0;j<c;j++){if(k.startsWith('t:'))out.push(FF.blank(k.slice(2)));else out.push(FF.fromPreset(FF.PRESETS[+k.slice(2)]))}});
   if(FORM.fields.length+out.length>40)return toast('A form can have up to 40 fields.',true);
   close();onAdd(out);toast(`${out.length} field${out.length>1?'s':''} added. Edit the wording below.`)};
 });
}

/* preview: the form exactly as visitors see it (answers are not saved) */
function fbPreview(FORM,ev){
 const std=FORM.std,sel=t=>`<select disabled><option>${t}</option></select>`;
 modal(`<h2>Form preview</h2><p class="small">This is what people see when they press Register${ev&&ev.title?` for <b>${esc(ev.title)}</b>`:''}. Try it: answers are not saved.</p>
 <form class="pvform" novalidate>
  <label>Full name <span class="req">*</span><input></label><label>Email <span class="req">*</span><input type="email"></label><label>Mobile number <span class="req">*</span><input type="tel"></label>
  ${std.whatsapp?'<label>WhatsApp number <span class="req">*</span><input type="tel" placeholder="Same as mobile"></label>':''}
  ${std.country?`<label>Country <span class="req">*</span>${sel('India')}</label>`:''}${std.education?`<label>Education level <span class="req">*</span>${sel('Choose…')}</label>`:''}${std.role?`<label>I am a <span class="req">*</span>${sel('Student / Parent')}</label>`:''}
  ${FORM.fields.map(f=>FF.render(f,'pv')).join('')}
  <p class="err" role="alert"></p><div class="mrow"><button type="button" class="btn ghost" data-close>Close</button><button type="submit" class="btn">Check my answers</button></div></form>`,(m)=>{
  m.querySelector('.modal').classList.add('wide');const f=$('.pvform',m);FF.enhance(f);
  $$('.othtxt',f).forEach(t=>t.addEventListener('input',()=>{const o=t.closest('.opt').querySelector('input[value=__other]');if(t.value&&o)o.checked=true}));
  f.onsubmit=x=>{x.preventDefault();$$('.ff.bad',f).forEach(b=>b.classList.remove('bad'));const err=$('.err',f);
   for(const q of FORM.fields){const msg=FF.check(q,FF.read(q,f,'pv'));if(msg){const b=$(`[data-f="${q.id}"]`,f);if(b){b.classList.add('bad');mScroll(b)}err.textContent=msg;return}}
   err.textContent='';toast('All answers look good. This is only a preview, so nothing was saved.')};
 });
}

/* ---------- badge design for one event: template, colour, organiser name + logo, size, what to show, live preview ---------- */
const BD_TPLS=[['classic','Classic','Dark header with a ticket cut'],['minimal','Minimal','White with a colour bar'],['bold','Bold','Whole badge in your colour'],['conference','Conference','Lanyard style, big name, role bar']];
const BD_SIZES=[['a6','A6 · 105 × 148 mm (postcard)'],['card','ID card · 54 × 86 mm (lanyard card)'],['a7','A7 · 74 × 105 mm'],['4x6','4 × 6 in · 102 × 152 mm (photo size)'],['tag','Name tag · 102 × 76 mm (landscape)']];
const BD_COLORS=['#0D2B22','#1A1E3A','#5B3FD6','#0E5A8A','#0E6E6E','#7A1F2B','#C2560E','#111111'];
function badgeDesigner(box,e,m){
 const D=Object.assign({tpl:'classic',color:'#0D2B22',org:'',logo:'',brand:true,size:'a6',showRole:true,showTime:true,showVenue:true,hole:true},e.badge||{});
 const ck=(k,t)=>`<label class="fbinl"><input type="checkbox" data-bk="${k}" ${D[k]?'checked':''}> ${t}</label>`;
 box.innerHTML=`<div class="bdgrid"><div class="bdopts">
  <p class="fbsub" style="margin-top:0">Template</p><div class="bdtpls">${BD_TPLS.map(([v,t,d])=>`<label class="bdtpl"><input type="radio" name="bdtpl" value="${v}" ${D.tpl===v?'checked':''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
  <p class="fbsub">Colour</p><div class="bdcols">${BD_COLORS.map(c=>`<button type="button" class="bdcol ${D.color.toLowerCase()===c.toLowerCase()?'on':''}" data-col="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}<label class="bdcustom" title="Pick any colour"><input type="color" value="${D.color}" aria-label="Custom colour"><span>Other</span></label></div>
  <div class="field"><label for="bd-org">Organiser name <small>(shown at the top of the badge)</small></label><input id="bd-org" maxlength="80" value="${esc(D.org)}" placeholder="e.g. KMCC Education Wing"></div>
  <div class="field"><label>Organiser logo</label><div class="bdlogo"><span class="bdlprev">${D.logo?`<img src="/api/img/${D.logo}" alt="">`:'No logo'}</span><input type="file" id="bd-logo" accept="image/png,image/jpeg,image/webp"><button type="button" class="linkbtn bdlrm" ${D.logo?'':'hidden'}>Remove</button></div><small class="small">A PNG with a transparent background looks best.</small></div>
  <div class="field"><label for="bd-size">Badge size <small>(for printing and the saved image)</small></label><select id="bd-size">${BD_SIZES.map(([v,t])=>`<option value="${v}" ${D.size===v?'selected':''}>${t}</option>`).join('')}</select></div>
  <p class="fbsub">Show on the badge</p><div class="bdchecks">${ck('showTime','Date and time')}${ck('showVenue','Venue')}${ck('showRole','Student / Parent')}${ck('brand','Aqlyon (www.aqlyondm.com at the bottom)')}${ck('hole','Empty space at the top for a lanyard hole')}</div>
 </div><div class="bdprev"><iframe title="Badge preview" loading="lazy"></iframe></div></div>`;
 const fr=$('iframe',box);
 const OFF={'Asia/Kolkata':330,'Asia/Dubai':240,'Asia/Riyadh':180,'Asia/Qatar':180,'Europe/London':0};
 const ev=()=>{const tz=$('#ef-tz',m).value,u=l=>l?Date.parse(l+':00Z')-(OFF[tz]??330)*60000:null;const mode=(m.querySelector('input[name=mode]:checked')||{}).value;
  return {title:$('#ef-title',m).value||'Your event name',tz,startUTC:u($('#ef-start',m).value)||Date.now()+7*864e5,endUTC:u($('#ef-end',m).value),mode,locationName:$('#ef-loc',m).value||'Event venue'}};
 let t=0;const show=()=>{clearTimeout(t);t=setTimeout(()=>{const h='#'+encodeURIComponent(JSON.stringify({design:{...D,logo:D.logo?'/api/img/'+D.logo:''},event:ev()}));
  if(fr.src&&fr.contentWindow&&fr.contentWindow.location.pathname==='/badge/preview')fr.contentWindow.location.hash=h;else fr.src='/badge/preview'+h},120)};
 // size the frame to the badge itself (not the page, which is always at least as tall as the frame: measuring that made it grow forever)
 fr.onload=()=>{try{const d=fr.contentDocument,w=d.getElementById('badge');if(!w)return;let last=0;
  const fit=()=>{const h=Math.min(1400,Math.ceil(w.getBoundingClientRect().height)+2);if(h>40&&Math.abs(h-last)>1){last=h;fr.style.height=h+'px'}};
  fit();new ResizeObserver(fit).observe(w)}catch(x){}};
 $$('input[name=bdtpl]',box).forEach(r=>r.onchange=()=>{D.tpl=r.value;show()});
 $$('.bdcol',box).forEach(b=>b.onclick=()=>{D.color=b.dataset.col;$$('.bdcol',box).forEach(x=>x.classList.toggle('on',x===b));$('.bdcustom input',box).value=D.color;show()});
 $('.bdcustom input',box).oninput=x=>{D.color=x.target.value;$$('.bdcol',box).forEach(b=>b.classList.remove('on'));show()};
 $('#bd-org',box).oninput=x=>{D.org=x.target.value;show()};
 $('#bd-size',box).onchange=x=>{D.size=x.target.value;show()};
 $$('[data-bk]',box).forEach(c=>c.onchange=()=>{D[c.dataset.bk]=c.checked;show()});
 $('#bd-logo',box).onchange=async x=>{const f=x.target.files[0];if(!f)return;const pv=$('.bdlprev',box);pv.textContent='Uploading…';
  try{const img=await prepImage(f);const d=await AAPI.call('/admin/upload',{method:'POST',body:{type:img.type,data:img.data}});D.logo=d.id;pv.innerHTML=`<img src="${img.preview}" alt="">`;$('.bdlrm',box).hidden=false;show()}catch(err){pv.textContent='Upload failed';toast(err.message,true)}};
 $('.bdlrm',box).onclick=()=>{D.logo='';$('.bdlprev',box).textContent='No logo';$('.bdlrm',box).hidden=true;$('#bd-logo',box).value='';show()};
 // the preview follows the event's name, date and venue as they are typed
 ['#ef-title','#ef-start','#ef-end','#ef-tz','#ef-loc'].forEach(s=>{const i=$(s,m);if(i)i.addEventListener('input',show)});$$('input[name=mode]',m).forEach(r=>r.addEventListener('change',show));
 show();
 return D;
}
