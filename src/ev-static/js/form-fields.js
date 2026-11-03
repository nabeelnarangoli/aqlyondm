/* =====================================================================
   Registration form fields (like Google Forms), shared by the event page
   and the admin form builder / preview.
   A field: {id, type, label, help, required, options[], other, valid, max, min,
             scaleMin, scaleMax, minLabel, maxLabel, stars, rows[], cols[], accept}
   ===================================================================== */
const FF=(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES=[
 {t:'short',name:'Short answer',ic:'—',desc:'One line of text, a number, email, link or phone'},
 {t:'paragraph',name:'Paragraph',ic:'≡',desc:'Longer answer over several lines'},
 {t:'choice',name:'Multiple choice',ic:'◉',desc:'Pick one option'},
 {t:'checkboxes',name:'Checkboxes',ic:'☑',desc:'Pick one or more options'},
 {t:'dropdown',name:'Dropdown',ic:'▾',desc:'Pick one from a list'},
 {t:'scale',name:'Linear scale',ic:'1‥5',desc:'Pick a number on a scale, e.g. 1 to 5'},
 {t:'rating',name:'Rating',ic:'★',desc:'Stars, e.g. 1 to 5'},
 {t:'grid',name:'Multiple choice grid',ic:'⋮⋮',desc:'One choice for each row'},
 {t:'checkgrid',name:'Checkbox grid',ic:'☷',desc:'Several choices for each row'},
 {t:'date',name:'Date',ic:'📅',desc:'Pick a date'},
 {t:'time',name:'Time',ic:'🕒',desc:'Pick a time'},
 {t:'file',name:'File upload',ic:'📎',desc:'Photo or PDF, up to 3 MB'},
 {t:'section',name:'Title and description',ic:'T',desc:'A heading or note between questions (not a question)'},
];
const OPT_TYPES=['choice','checkboxes','dropdown'];
const nid=()=>'f'+Math.random().toString(36).slice(2,9);
const blank=t=>{const f={id:nid(),type:t,label:'',help:'',required:false};
 if(OPT_TYPES.includes(t))f.options=['Option 1','Option 2'];
 if(t==='short')f.valid='text';
 if(t==='scale')Object.assign(f,{scaleMin:1,scaleMax:5,minLabel:'',maxLabel:''});
 if(t==='rating')f.stars=5;
 if(t==='grid'||t==='checkgrid')Object.assign(f,{rows:['Row 1','Row 2'],cols:['Column 1','Column 2']});
 if(t==='file')f.accept='image,pdf';
 return f};
// ready-made questions
const P=(label,type,extra={})=>({label,type,...extra});
const PRESETS=[
 P('Company / business name','short'),
 P('Job title','short'),
 P('Industry','short'),
 P('Company website','short',{valid:'url'}),
 P('Age','short',{valid:'number',min:3,max:100}),
 P('Gender','choice',{options:['Male','Female','Prefer not to say']}),
 P('Date of birth','date'),
 P('City / town','short'),
 P('School / college name','short'),
 P('Class / grade','dropdown',{options:['Class 8','Class 9','Class 10','Class 11','Class 12','College 1st year','College 2nd year','College 3rd year','Graduate','Other']}),
 P('Stream','dropdown',{options:['Science','Commerce','Humanities','Vocational','Not decided yet']}),
 P('Subjects or careers you are interested in','checkboxes',{options:['Engineering','Medicine','Business & management','Law','Design & arts','Computer science & AI','Teaching','Government / civil services','Not sure yet'],other:true}),
 P("Parent / guardian's name",'short'),
 P("Parent / guardian's mobile",'short',{valid:'phone'}),
 P('Occupation','short'),
 P('Organisation / company','short'),
 P('How did you hear about this event?','choice',{options:['Instagram','Facebook','WhatsApp','YouTube','Friend or family','School / college','Newspaper'],other:true}),
 P('What do you hope to get from this event?','paragraph'),
 P('Questions for the speakers','paragraph'),
 P('Food preference','choice',{options:['Vegetarian','Non-vegetarian']}),
 P('T-shirt size','dropdown',{options:['XS','S','M','L','XL','XXL']}),
 P('Special requirements or accessibility needs','paragraph'),
 P('How interested are you in studying abroad?','scale',{scaleMin:1,scaleMax:5,minLabel:'Not at all',maxLabel:'Very interested'}),
 P('Photo ID','file',{accept:'image,pdf'}),
 P('Passport-size photo','file',{accept:'image'}),
 P('Photo / video consent','choice',{options:['Yes, you may use photos of me','No, please do not use photos of me']}),
 P('I agree to the event terms','checkboxes',{options:['I agree'],required:true}),
];
const fromPreset=p=>({...blank(p.type),...JSON.parse(JSON.stringify(p)),id:nid()});

const ACCEPT={image:'image/jpeg,image/png,image/webp,image/heic,image/heif',pdf:'application/pdf'};
const acceptOf=f=>String(f.accept||'image,pdf').split(',').map(k=>ACCEPT[k]).filter(Boolean).join(',');
const range=(a,b)=>{const o=[];for(let i=a;i<=b;i++)o.push(i);return o};

/* ---------- visitor form ---------- */
function render(f,pre='q'){
 const id=pre+'-'+f.id,req=f.required?' <span class="req" aria-hidden="true">*</span>':'',help=f.help?`<small class="fhelp">${esc(f.help)}</small>`:'';
 const lab=`<span class="flab">${esc(f.label||'Untitled question')}${req}</span>${help}`;
 const nm=`name="${id}"`;
 switch(f.type){
  case 'section':return `<div class="ffsec"><h3>${esc(f.label)}</h3>${f.help?`<p>${esc(f.help)}</p>`:''}</div>`;
  case 'short':{const t={number:'number',email:'email',url:'url',phone:'tel'}[f.valid]||'text';
   return `<label class="ff" data-f="${f.id}">${lab}<input ${nm} type="${t}" ${t==='number'?`inputmode="decimal" ${f.min!=null&&f.min!==''?`min="${f.min}"`:''} ${f.max!=null&&f.max!==''?`max="${f.max}"`:''}`:`maxlength="${f.maxLen||300}"`} ${t==='tel'?'inputmode="tel"':''}></label>`}
  case 'paragraph':return `<label class="ff" data-f="${f.id}">${lab}<textarea ${nm} rows="3" maxlength="${f.maxLen||2000}"></textarea></label>`;
  case 'dropdown':return `<label class="ff" data-f="${f.id}">${lab}<select ${nm} data-search><option value="">Choose…</option>${(f.options||[]).map(o=>`<option>${esc(o)}</option>`).join('')}</select></label>`;
  case 'choice':case 'checkboxes':{const tp=f.type==='choice'?'radio':'checkbox';
   return `<fieldset class="ff opts" data-f="${f.id}"><legend>${lab}</legend>${(f.options||[]).map(o=>`<label class="opt"><input type="${tp}" ${nm} value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}${f.other?`<label class="opt oth"><input type="${tp}" ${nm} value="__other"><span>Other:</span><input class="othtxt" name="${id}-other" maxlength="200" aria-label="Other"></label>`:''}</fieldset>`}
  case 'scale':return `<fieldset class="ff" data-f="${f.id}"><legend>${lab}</legend><div class="scale">${f.minLabel?`<span class="sl">${esc(f.minLabel)}</span>`:''}<div class="sbtns">${range(+f.scaleMin||1,+f.scaleMax||5).map(n=>`<label><input type="radio" ${nm} value="${n}"><span>${n}</span></label>`).join('')}</div>${f.maxLabel?`<span class="sl">${esc(f.maxLabel)}</span>`:''}</div></fieldset>`;
  case 'rating':return `<fieldset class="ff" data-f="${f.id}"><legend>${lab}</legend><div class="stars">${range(1,+f.stars||5).reverse().map(n=>`<input type="radio" id="${id}-${n}" ${nm} value="${n}"><label for="${id}-${n}" title="${n} of ${f.stars||5}">★</label>`).join('')}</div></fieldset>`;
  case 'grid':case 'checkgrid':{const tp=f.type==='grid'?'radio':'checkbox';
   return `<fieldset class="ff" data-f="${f.id}"><legend>${lab}</legend><div class="gridwrap"><table class="ffgrid"><thead><tr><th></th>${(f.cols||[]).map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${(f.rows||[]).map((r,i)=>`<tr><th>${esc(r)}</th>${(f.cols||[]).map(c=>`<td><input type="${tp}" name="${id}-r${i}" value="${esc(c)}" aria-label="${esc(r)}: ${esc(c)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></fieldset>`}
  case 'date':return `<label class="ff" data-f="${f.id}">${lab}<input ${nm} type="date"></label>`;
  case 'time':return `<label class="ff" data-f="${f.id}">${lab}<input ${nm} type="time"></label>`;
  case 'file':return `<label class="ff" data-f="${f.id}">${lab}<input ${nm} type="file" accept="${acceptOf(f)}"><small class="fhelp">${String(f.accept||'image,pdf').includes('pdf')?'Photo or PDF':'Photo'}, up to 3 MB</small></label>`;
 }
 return '';
}
// read one answer from the form (file fields return the File; the page uploads it)
function read(f,form,pre='q'){
 const id=pre+'-'+f.id,els=form.querySelectorAll(`[name="${id}"]`);
 const other=()=>{const o=form.querySelector(`[name="${id}-other"]`);return o?o.value.trim():''};
 switch(f.type){
  case 'section':return undefined;
  case 'choice':case 'scale':case 'rating':{const c=[...els].find(x=>x.checked);if(!c)return '';return c.value==='__other'?(other()?'Other: '+other():'__other'):c.value}
  case 'checkboxes':return [...els].filter(x=>x.checked).map(x=>x.value==='__other'?(other()?'Other: '+other():'__other'):x.value);
  case 'grid':return Object.fromEntries((f.rows||[]).map((r,i)=>{const c=[...form.querySelectorAll(`[name="${id}-r${i}"]`)].find(x=>x.checked);return [r,c?c.value:'']}).filter(x=>x[1]));
  case 'checkgrid':return Object.fromEntries((f.rows||[]).map((r,i)=>[r,[...form.querySelectorAll(`[name="${id}-r${i}"]`)].filter(x=>x.checked).map(x=>x.value)]).filter(x=>x[1].length));
  case 'file':return els[0]&&els[0].files[0]||null;
  default:return els[0]?els[0].value.trim():'';
 }
}
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function check(f,v){
 const L=`"${f.label||'This question'}"`;
 const empty=v==null||v===''||(Array.isArray(v)&&!v.length)||(typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Blob)&&!Object.keys(v).length);
 if(f.type==='section')return '';
 if(empty)return f.required?`Please answer ${L}.`:'';
 if(v==='__other'||(Array.isArray(v)&&v.includes('__other')))return `Please write your "Other" answer for ${L}.`;
 if(f.type==='short'){
  if(f.valid==='number'){const n=Number(v);if(!isFinite(n))return `${L} must be a number.`;if(f.min!==''&&f.min!=null&&n<+f.min)return `${L} must be at least ${f.min}.`;if(f.max!==''&&f.max!=null&&n>+f.max)return `${L} must be at most ${f.max}.`}
  if(f.valid==='email'&&!EMAIL.test(v))return `${L} must be an email address.`;
  if(f.valid==='url'&&!/^https?:\/\/\S+\.\S+/.test(v))return `${L} must be a web link starting with https://`;
  if(f.valid==='phone'&&!/^\+?[\d\s\-()]{6,20}$/.test(v))return `${L} must be a phone number.`;
 }
 if((f.type==='grid'||f.type==='checkgrid')&&f.required&&Object.keys(v).length<(f.rows||[]).length)return `Please answer every row of ${L}.`;
 if(f.type==='file'&&v instanceof Blob&&v.size>3*1024*1024)return `The file for ${L} is larger than 3 MB.`;
 return '';
}
// how an answer is shown in the admin table and Excel
function show(f,v){
 if(v==null||v==='')return '';
 if(Array.isArray(v))return v.join(', ');
 if(f&&f.type==='file'&&typeof v==='object')return v.name||'File';
 if(typeof v==='object')return Object.entries(v).map(([r,c])=>`${r}: ${Array.isArray(c)?c.join(', '):c}`).join('; ');
 if(f&&f.type==='rating')return v+' / '+(f.stars||5);
 return String(v);
}
/* ---------- searchable dropdown ----------
   Turns a <select> into a button that opens a list with a search box (type to filter).
   The real <select> stays in the form (hidden), so reading, checking and saving answers work as before
   and its "change" event still fires. The list opens in the page flow, so it is never cut off inside a popup. */
const fold=s=>String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'');
function searchable(sel){
 if(!sel||sel.dataset.dd)return;sel.dataset.dd='1';
 const w=document.createElement('span');w.className='ddw';
 w.innerHTML=`<button type="button" class="ddbtn" aria-haspopup="listbox" aria-expanded="false"><span class="ddval"></span><span class="ddar" aria-hidden="true">▾</span></button>
  <span class="ddpop" hidden><input class="ddq" type="search" placeholder="Type to search…" autocomplete="off" enterkeyhint="search" aria-label="Search the list"><span class="ddlist" role="listbox"></span><span class="ddnone" hidden>No match. Try fewer letters.</span></span>`;
 sel.before(w);w.appendChild(sel);sel.hidden=true;sel.tabIndex=-1;
 const btn=w.querySelector('.ddbtn'),val=w.querySelector('.ddval'),pop=w.querySelector('.ddpop'),q=w.querySelector('.ddq'),list=w.querySelector('.ddlist'),none=w.querySelector('.ddnone');
 const opts=()=>[...sel.options].filter(o=>o.value!=='');
 const ph=()=>{const o=[...sel.options].find(o=>o.value==='');return o?o.text:'Choose…'};
 const paint=()=>{const o=sel.selectedIndex>=0&&sel.options[sel.selectedIndex];const has=o&&o.value!=='';val.textContent=has?o.text:ph();w.classList.toggle('empty',!has)};
 let act=-1;
 const items=()=>[...list.querySelectorAll('.ddo:not([hidden])')];
 const mark=i=>{const it=items();act=Math.max(0,Math.min(i,it.length-1));it.forEach((x,j)=>x.classList.toggle('act',j===act));if(it[act])it[act].scrollIntoView({block:'nearest'})};
 const build=()=>{list.innerHTML=opts().map((o,i)=>`<span class="ddo${o.selected?' sel':''}" role="option" data-i="${i}" aria-selected="${o.selected}">${esc(o.text)}</span>`).join('')};
 const filter=()=>{const words=fold(q.value.trim()).split(/\s+/).filter(Boolean),os=opts();let n=0;
  list.querySelectorAll('.ddo').forEach(x=>{const t=fold(os[+x.dataset.i].text);const ok=words.every(k=>t.includes(k));x.hidden=!ok;if(ok)n++});
  none.hidden=n>0;mark(0)};
 const open=(seed='')=>{if(!pop.hidden)return;closeAll(w);build();pop.hidden=false;w.classList.add('open');btn.setAttribute('aria-expanded','true');q.value=seed;filter();
  const s=items().findIndex(x=>x.classList.contains('sel'));if(!seed&&s>=0)mark(s);
  q.focus({preventScroll:true});pop.scrollIntoView({block:'nearest'})};
 const close=(back)=>{if(pop.hidden)return;pop.hidden=true;w.classList.remove('open');btn.setAttribute('aria-expanded','false');if(back)btn.focus({preventScroll:true})};
 const pick=x=>{if(!x)return;const o=opts()[+x.dataset.i];if(o&&sel.value!==o.value){sel.value=o.value;sel.dispatchEvent(new Event('change',{bubbles:true}));sel.dispatchEvent(new Event('input',{bubbles:true}))}paint();close(true)};
 w._ddclose=()=>close(false);
 btn.addEventListener('click',e=>{e.preventDefault();pop.hidden?open():close(true)});
 btn.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open()}else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key!==' '){e.preventDefault();open(e.key)}});
 q.addEventListener('input',filter);
 q.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();mark(act+1)}else if(e.key==='ArrowUp'){e.preventDefault();mark(act-1)}
  else if(e.key==='Enter'){e.preventDefault();pick(items()[act])}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true)}
  else if(e.key==='Tab')close(false)});
 // the field sits inside a <label>: stop clicks in the list from "clicking the label" (which would toggle it again)
 pop.addEventListener('click',e=>{if(e.target!==q)e.preventDefault();const x=e.target.closest('.ddo');if(x)pick(x)});
 pop.addEventListener('mousedown',e=>{if(e.target!==q)e.preventDefault()}); // keep the search box focused
 list.addEventListener('mousemove',e=>{const x=e.target.closest('.ddo');if(x){const i=items().indexOf(x);if(i!==act)mark(i)}});
 sel.addEventListener('change',paint);
 paint();
}
function closeAll(except){document.querySelectorAll('.ddw.open').forEach(w=>{if(w!==except&&w._ddclose)w._ddclose()})}
if(typeof document!=='undefined')document.addEventListener('pointerdown',e=>{const w=e.target.closest&&e.target.closest('.ddw');closeAll(w)},true);
// make every list in a form searchable (the registration questions' dropdowns, plus any <select data-search>)
const enhance=root=>root.querySelectorAll('select[data-search]').forEach(searchable);

return {TYPES,PRESETS,OPT_TYPES,blank,fromPreset,render,read,check,show,esc,nid,searchable,enhance,typeName:t=>(TYPES.find(x=>x.t===t)||{}).name||t};
})();
