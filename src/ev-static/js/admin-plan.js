/* Event planner (organiser): preparation checklists and the program chart for one event.
   Every change saves by itself. Ticks made by the team on the shared link appear here within 20 seconds. */
const PL_START=[
 {title:'LED Wall Creatives',groups:['Speakers Background','Intro & Countdown Video','Sponsor Slides']},
 {title:'Social Media',groups:['Announcement Poster','Speaker & Guest Cards','Countdown Posts','Live Coverage & Reels']},
 {title:'Print',groups:['Stage Backdrop','Badges & Passes','Certificates & Mementos']},
 {title:'Venue & Logistics',groups:[''],items:['Sound and light check','Seating plan','Reception desk','Photographer and videographer']},
];
const PL_PROG=[['National Anthem',2],['Welcome Speech',10],['Presidential Address',10],['Inauguration',15],['Chief Guest Address',20],['Award Presentation',20],['Vote of Thanks',5]];
// list markers at the start of a pasted line: 1.  1)  (1)  1 -  -  •  *  a)
const PL_MARK=/^\s*(?:\(?\d{1,3}\s*[.)\]:：-]|\(\d{1,3}\)|\d{1,3}\s+[-–]|[-–•*·●▪◦➤►✓✔]|[a-z][.)](?=\s))\s*/i;
const plId=()=>Math.random().toString(36).slice(2,10).padEnd(8,'0');

async function planView(e,tab0){
 const main=$('.adm');main.innerHTML=evHeadHTML(e,'plan')+'<p class="lead" style="margin-top:20px">Loading the planner…</p>';bindEvHead(e);
 let P,SH;try{const d=await AAPI.call(`/admin/events/${e.id}/plan`);P=d.plan;SH=d.shares||{lists:{},program:{}}}catch(err){toast(err.message,true);return}
 if(!P.program.start&&/T\d{2}:\d{2}$/.test(e.start||''))P.program.start=e.start.slice(11,16);
 let tab=tab0||'lists',timer=0,saving=false,dirty=false;
 const PV=window.PlanView,ev={title:e.title,when:evDate(e),venue:e.mode==='offline'?e.locationName||'':'Online',org:(e.badge||{}).org||'',logo:(e.badge||{}).logo?'/api/img/'+e.badge.logo:''};
 main.innerHTML=evHeadHTML(e,'plan')+`<div class="plhead"><button type="button" class="plorg" id="plorg" aria-label="Organiser name and logo"></button><div class="pltop"><span class="plsum"></span><span class="plsave small" aria-live="polite"></span></div>
  <div class="evbtns" style="margin:0"><button type="button" class="btn sm" id="plshare">🔗 Share</button><button type="button" class="btn sm ghost" id="plprint">🖨 Print / PDF</button></div></div>
  <nav class="evsub" role="tablist" aria-label="Planner"><button type="button" role="tab" data-pt="lists">✅ Checklists</button><button type="button" role="tab" data-pt="program">🕒 Program chart</button></nav>
  <div class="plbody"></div>`;
 bindEvHead(e);
 const body=$('.plbody',main);
 const stat=(t,bad)=>{const s=$('.plsave',main);if(s){s.textContent=t;s.classList.toggle('bad',!!bad)}};
 const summary=()=>{const k=PV.count(P.checklists),t=PV.total(P.program);$('.plsum',main).innerHTML=`<b>${k.d}</b> of ${k.n} tasks done · program ${PV.dur(t)}${SH.lists.on||SH.program.on?` · <span class="plshared">Shared: ${[SH.lists.on&&'checklist',SH.program.on&&'program chart'].filter(Boolean).join(' and ')}</span>`:''}`};
 const save=()=>{dirty=true;stat('Saving…');summary();clearTimeout(timer);timer=setTimeout(flush,700)};
 const flush=async()=>{if(saving){timer=setTimeout(flush,400);return}saving=true;dirty=false;
  try{const d=await AAPI.call(`/admin/events/${e.id}/plan`,{method:'PUT',body:{checklists:P.checklists,program:P.program}});merge(d.plan);stat(dirty?'Saving…':'All changes saved ✓')}
  catch(err){dirty=true;stat('Not saved: '+err.message,true)}finally{saving=false}};
 // take newer ticks from the server (the team may tick while you work), without redrawing what you're typing
 const merge=sp=>{const by=new Map();for(const c of sp.checklists)for(const g of c.groups)for(const i of g.items)by.set(i.id,i);
  let changed=false;for(const c of P.checklists)for(const g of c.groups)for(const i of g.items){const s=by.get(i.id);if(s&&s.t>i.t){Object.assign(i,{done:s.done,by:s.by,t:s.t});changed=true;
   const cb=body.querySelector(`[data-tick="${i.id}"]`);if(cb){cb.checked=i.done;cb.closest('li').classList.toggle('done',i.done);const b=cb.closest('li').querySelector('.byl');if(b)b.textContent=i.done&&i.by?'✓ '+i.by:''}}}
  if(changed){summary();if(tab==='lists')$$('.plcat',body).forEach(cc=>catProg(cc))}};
 const catProg=el=>{const c=P.checklists.find(x=>x.id===el.dataset.cat);if(!c)return;const k=PV.count([c]);const s=$('.plpill',el);if(s){s.textContent=`${k.d} / ${k.n} done`;s.classList.toggle('all',!!k.n&&k.d===k.n)}const b=$('.plbar i',el);if(b)b.style.width=PV.pct(k)+'%'};
 const poll=setInterval(async()=>{if(!document.body.contains(body)){clearInterval(poll);return}if(dirty||saving||document.hidden)return;
  try{const d=await AAPI.call(`/admin/events/${e.id}/plan`);merge(d.plan);SH=d.shares||SH}catch(x){}},20e3);

 /* ---------- checklists ---------- */
 const find=(cid,gid)=>{const c=P.checklists.find(x=>x.id===cid);return {c,g:c&&gid?c.groups.find(x=>x.id===gid):null}};
 const move=(arr,i,d)=>{const j=i+d;if(j<0||j>=arr.length)return false;[arr[i],arr[j]]=[arr[j],arr[i]];return true};
 function drawLists(focus){
  const L=P.checklists;
  body.innerHTML=(L.length?L.map((c,ci)=>{const k=PV.count([c]);return `<section class="plcat" data-cat="${c.id}">
   <div class="plcathead"><button type="button" class="dragh" data-drag="cat" aria-label="Drag to move this category" title="Drag to move">⠿</button><input class="plcatin" data-f="ctitle" value="${esc(c.title)}" placeholder="Category, e.g. LED Wall Creatives" maxlength="100" aria-label="Category name">
    <span class="plpill ${k.n&&k.d===k.n?'all':''}">${k.d} / ${k.n} done</span>
    <span class="placts"><button type="button" class="iconb" data-a="cup" ${ci?'':'disabled'} aria-label="Move category up">↑</button><button type="button" class="iconb" data-a="cdown" ${ci<L.length-1?'':'disabled'} aria-label="Move category down">↓</button><button type="button" class="iconb del" data-a="cdel" aria-label="Delete category">🗑</button></span>
    <div class="plbar"><i style="width:${PV.pct(k)}%"></i></div></div>
   ${c.groups.map((g,gi)=>`<div class="plgrp" data-grp="${g.id}"><div class="plgrphead"><button type="button" class="dragh" data-drag="grp" aria-label="Drag to move this subheading" title="Drag to move">⠿</button><input class="plgrpin" data-f="gtitle" value="${esc(g.title)}" placeholder="Subheading, e.g. Speakers Background (optional)" maxlength="100" aria-label="Subheading">
     <span class="placts"><button type="button" class="iconb" data-a="gup" ${gi?'':'disabled'} aria-label="Move subheading up">↑</button><button type="button" class="iconb del" data-a="gdel" aria-label="Delete subheading">🗑</button></span></div>
    <ol class="plitems">${g.items.map((i,ii)=>`<li class="${i.done?'done':''}" data-item="${i.id}"><button type="button" class="dragh" data-drag="item" aria-label="Drag to move this item" title="Drag to move">⠿</button><input type="checkbox" data-tick="${i.id}" ${i.done?'checked':''} aria-label="Done"><span class="num">${ii+1}</span>
     <input class="plitin" data-f="text" value="${esc(i.text)}" placeholder="What needs doing" maxlength="300" aria-label="Item ${ii+1}"><input class="plwho" data-f="who" value="${esc(i.who)}" placeholder="Who" maxlength="60" aria-label="Who is doing item ${ii+1}">
     <span class="byl small">${i.done&&i.by?'✓ '+esc(i.by):''}</span><span class="placts"><button type="button" class="iconb" data-a="iup" ${ii?'':'disabled'} aria-label="Move up">↑</button><button type="button" class="iconb del" data-a="idel" aria-label="Delete item">×</button></span></li>`).join('')}</ol>
    <div class="pladd"><span class="num">${g.items.length+1}</span><input class="pladdin" placeholder="Add an item and press Enter, or paste a whole list" maxlength="300" aria-label="Add an item${g.title?' to '+esc(g.title):''}"><button type="button" class="btn sm ghost" data-a="iadd">Add</button></div></div>`).join('')}
   <button type="button" class="linkbtn" data-a="gadd">＋ Add subheading</button></section>`}).join('')
   :`<div class="plstart"><p><b>Plan everything that needs preparing.</b> Make categories (like <i>LED Wall Creatives</i>), add subheadings (like <i>Speakers Background</i>) and list the items under each. Tick them off as they're done, or share the list with your team.</p><button type="button" class="btn" data-a="tpl">Start with an example</button></div>`)+
   `<button type="button" class="btn ghost plnewcat" data-a="cadd">＋ Add category</button>`;
  if(focus){const el=body.querySelector(focus);if(el){el.focus();if(el.select&&el.value)el.select()}}
 }
 body.addEventListener('input',ev=>{const t=ev.target,f=t.dataset.f;if(!f)return;
  if(tab==='program'){const r=t.closest('[data-row]');const it=r?P.program.items.find(x=>x.id===r.dataset.row):null;
   if(f==='start'){P.program.start=t.value;progTimes()}else if(it){it[f]=f==='dur'?Math.max(0,parseInt(t.value,10)||0):t.value;if(f==='dur')progTimes()}save();return}
  const cat=t.closest('[data-cat]'),grp=t.closest('[data-grp]'),li=t.closest('[data-item]');const {c,g}=find(cat&&cat.dataset.cat,grp&&grp.dataset.grp);
  if(f==='ctitle'&&c)c.title=t.value;else if(f==='gtitle'&&g)g.title=t.value;else if(li&&g){const i=g.items.find(x=>x.id===li.dataset.item);if(i)i[f]=t.value}
  save()});
 body.addEventListener('change',ev=>{const t=ev.target;if(!t.dataset.tick)return;
  for(const c of P.checklists)for(const g of c.groups)for(const i of g.items)if(i.id===t.dataset.tick){i.done=t.checked;i.by=t.checked?'Organiser':'';i.t=Date.now();
   const li=t.closest('li');li.classList.toggle('done',i.done);$('.byl',li).textContent=i.done?'✓ Organiser':'';catProg(t.closest('[data-cat]'))}
  save()});
 const addItem=grp=>{const inp=$('.pladdin',grp),v=inp.value.trim();if(!v){inp.focus();return}const {g}=find(grp.closest('[data-cat]').dataset.cat,grp.dataset.grp);
  g.items.push({id:plId(),text:v,who:'',done:false,by:'',t:0});save();drawLists(`[data-grp="${g.id}"] .pladdin`)};
 /* paste a whole list (from WhatsApp, Word, Excel…): numbered or bulleted lines become items,
    other lines become subheadings with the items below them; the old numbers are dropped */
 body.addEventListener('paste',async ev=>{const t=ev.target;
  if(!t.classList||!(t.classList.contains('pladdin')||t.id==='pa-title'))return;
  const text=(ev.clipboardData||window.clipboardData).getData('text')||'';
  const lines=text.split(/\r?\n/).map(l=>l.replace(/​/g,'').trim()).filter(Boolean);
  if(lines.length<2)return;   // one line: paste normally
  ev.preventDefault();
  if(t.id==='pa-title'){   // program chart: one row per line, "… 10 min" at the end becomes the duration
   const rows=lines.map(l=>{l=l.replace(PL_MARK,'').trim();const m=/[\s\-–—,|(]*(\d{1,3})\s*(?:min|mins|minutes|m)\.?\)?\s*$/i.exec(l);return {title:(m?l.slice(0,m.index):l).trim(),dur:m?+m[1]:0}}).filter(r=>r.title);
   if(!rows.length)return;
   if(!await confirmBox(`Add ${rows.length} program items?`,`One row for each line you pasted.${rows.some(r=>r.dur)?' Minutes at the end of a line were used as the duration.':' Add the minutes for each row afterwards.'}`,'Add'))return;
   for(const r of rows)P.program.items.push({id:plId(),title:r.title.slice(0,160),dur:r.dur,who:'',note:''});save();drawProgram('#pa-title');toast(`${rows.length} program items added`);return}
  const grp=t.closest('[data-grp]'),{c,g}=find(grp.closest('[data-cat]').dataset.cat,grp.dataset.grp);
  const numbered=lines.filter(l=>PL_MARK.test(l)).length;
  const blocks=[{title:null,items:[]}];
  for(const l of lines){
   if(!numbered||PL_MARK.test(l)){const x=l.replace(PL_MARK,'').trim();if(x)blocks[blocks.length-1].items.push(x)}
   else blocks.push({title:l.replace(/[\s:;：]+$/,'').trim().slice(0,100),items:[]});
  }
  for(let i=blocks.length-1;i>0;i--)if(!blocks[i].items.length)blocks.splice(i,1);   // a heading with nothing under it (e.g. a title line)
  if(!g.items.length&&!g.title&&!blocks[0].items.length&&blocks[1]){blocks[0]=blocks[1];blocks.splice(1,1);g.title=blocks[0].title}   // empty untitled group takes the first heading
  const items=blocks.reduce((n,b)=>n+b.items.length,0),heads=blocks.slice(1).length;
  if(!items&&!heads)return;
  if(!await confirmBox(`Add ${items} item${items===1?'':'s'}${heads?` in ${heads+(blocks[0].items.length?1:0)} subheadings`:''}?`,
   heads?`Lines without a number became subheadings: <b>${blocks.slice(1,4).map(b=>esc(b.title)).join('</b>, <b>')}</b>${heads>3?' …':''}. The numbers you pasted are replaced by the planner's own.`:'One item for each line you pasted. The numbers you pasted are replaced by the planner\'s own.','Add'))return;
  const mk=x=>({id:plId(),text:x.slice(0,300),who:'',done:false,by:'',t:0});
  g.items.push(...blocks[0].items.map(mk));
  let at=c.groups.indexOf(g)+1;
  for(const b of blocks.slice(1))c.groups.splice(at++,0,{id:plId(),title:b.title,items:b.items.map(mk)});
  save();drawLists(`[data-grp="${g.id}"] .pladdin`);toast(`${items} item${items===1?'':'s'} added`);
 });
 body.addEventListener('keydown',ev=>{const t=ev.target;if(ev.key!=='Enter'||t.tagName!=='INPUT')return;ev.preventDefault();
  if(t.classList.contains('pladdin'))addItem(t.closest('[data-grp]'));
  else if(t.classList.contains('prgaddin'))addRow();
  else if(t.classList.contains('plitin')){const g=t.closest('[data-grp]');$('.pladdin',g).focus()}});
 body.addEventListener('click',async ev=>{const b=ev.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
  const cat=b.closest('[data-cat]'),grp=b.closest('[data-grp]'),li=b.closest('[data-item]');const {c,g}=find(cat&&cat.dataset.cat,grp&&grp.dataset.grp);
  const L=P.checklists,ci=c?L.indexOf(c):-1;
  if(a==='tpl'){for(const t of PL_START)L.push({id:plId(),title:t.title,groups:t.groups.map(x=>({id:plId(),title:x,items:(t.items||[]).map(s=>({id:plId(),text:s,who:'',done:false,by:'',t:0}))}))});save();drawLists();return}
  if(a==='cadd'){const n={id:plId(),title:'',groups:[{id:plId(),title:'',items:[]}]};L.push(n);save();drawLists(`[data-cat="${n.id}"] .plcatin`);return}
  if(a==='cup'||a==='cdown'){if(move(L,ci,a==='cup'?-1:1)){save();drawLists()}return}
  if(a==='cdel'){const n=PV.count([c]).n;if(n&&!await confirmBox('Delete category?',`<b>${esc(c.title||'This category')}</b> and its ${n} item${n===1?'':'s'} will be deleted.`,'Delete',true))return;L.splice(ci,1);save();drawLists();return}
  if(a==='gadd'){const n={id:plId(),title:'',items:[]};c.groups.push(n);save();drawLists(`[data-grp="${n.id}"] .plgrpin`);return}
  if(a==='gup'){if(move(c.groups,c.groups.indexOf(g),-1)){save();drawLists()}return}
  if(a==='gdel'){if(g.items.length&&!await confirmBox('Delete subheading?',`<b>${esc(g.title||'This group')}</b> and its ${g.items.length} item${g.items.length===1?'':'s'} will be deleted.`,'Delete',true))return;c.groups.splice(c.groups.indexOf(g),1);save();drawLists();return}
  if(a==='iadd'){addItem(grp);return}
  if(a==='iup'||a==='idel'){const ii=g.items.findIndex(x=>x.id===li.dataset.item);if(a==='idel')g.items.splice(ii,1);else move(g.items,ii,-1);save();drawLists();return}
  // program chart
  const r=b.closest('[data-row]'),items=P.program.items,ri=r?items.findIndex(x=>x.id===r.dataset.row):-1;
  if(a==='radd'){addRow();return}
  if(a==='rtpl'){for(const [t,d] of PL_PROG)items.push({id:plId(),title:t,dur:d,who:'',note:''});save();drawProgram();return}
  if(a==='rup'||a==='rdown'){if(move(items,ri,a==='rup'?-1:1)){save();drawProgram()}return}
  if(a==='rdel'){items.splice(ri,1);save();drawProgram();return}
 });

 /* ---------- drag and drop (mouse and touch): categories, subheadings (also into another category),
    items (also into another subheading) and program rows. The page is rearranged while you drag;
    when you let go, the new order is read back from the page and saved. ---------- */
 let drag=null;
 const below=(t,y)=>{const r=t.getBoundingClientRect();return y>r.top+r.height/2};
 const byY=(list,y,end)=>{for(const t of list){if(t===el2())continue;const r=t.getBoundingClientRect();if(y<r.top+r.height/2)return t}return end};
 const el2=()=>drag&&drag.el;
 const place=()=>{const {kind,el,x,y}=drag;
  // categories and program rows follow the pointer's height, so they still move while the page scrolls under a sticky header
  if(kind==='cat'){const t=byY($$('.plcat',body),y,$('.plnewcat',body));if(t&&t!==el&&t.previousElementSibling!==el)body.insertBefore(el,t);else if(t!==el&&t===$('.plnewcat',body)&&el.nextElementSibling!==t)body.insertBefore(el,t);return}
  if(kind==='row'){const tb=el.parentNode,t=byY($$('tr[data-row]',tb),y,$('.prgadd',tb));if(t&&t!==el&&el.nextElementSibling!==t)tb.insertBefore(el,t);return}
  let hit=document.elementFromPoint(x,y),yy=y;while((!hit||!body.contains(hit))&&yy<y+240){yy+=20;hit=document.elementFromPoint(x,yy)}   // look past a sticky header
  if(!hit||!body.contains(hit))return;
  if(kind==='item'){const li=hit.closest('li[data-item]');if(li&&li!==el){if(li.closest('[data-grp]'))li.parentNode.insertBefore(el,below(li,y)?li.nextSibling:li);return}
   const g=hit.closest('.plgrp');if(g&&!li){const ol=$('.plitems',g);if(el.parentNode!==ol){if(y<ol.getBoundingClientRect().top)ol.insertBefore(el,ol.firstChild);else ol.appendChild(el)}}return}
  if(kind==='grp'){const g=hit.closest('.plgrp');if(g&&g!==el){g.parentNode.insertBefore(el,below(g,y)?g.nextSibling:g);return}
   const c=hit.closest('.plcat');if(c&&!g&&el.parentNode!==c){const gs=$$('.plgrp',c);if(gs.length&&y<gs[0].getBoundingClientRect().top)c.insertBefore(el,gs[0]);else c.insertBefore(el,$('[data-a=gadd]',c))}return}
  };
 const commit=(kind,before)=>{
  if(kind==='row'){const ids=$$('tr[data-row]',body).map(r=>r.dataset.row);P.program.items.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id))}
  else{const I=new Map(),G=new Map(),C=new Map();
   for(const c of P.checklists){C.set(c.id,c);for(const g of c.groups){G.set(g.id,g);for(const i of g.items)I.set(i.id,i)}}
   P.checklists=$$('.plcat',body).map(ce=>{const c=C.get(ce.dataset.cat);if(c)c.groups=$$('.plgrp',ce).map(ge=>{const g=G.get(ge.dataset.grp);if(g)g.items=$$('li[data-item]',ge).map(li=>I.get(li.dataset.item)).filter(Boolean);return g}).filter(Boolean);return c}).filter(Boolean)}
  const after=JSON.stringify(kind==='row'?P.program.items.map(i=>i.id):P.checklists.map(c=>[c.id,c.groups.map(g=>[g.id,g.items.map(i=>i.id)])]));
  if(after!==before)save();kind==='row'?drawProgram():drawLists()};
 body.addEventListener('pointerdown',ev=>{const h=ev.target.closest('[data-drag]');if(!h||ev.button>0)return;
  const kind=h.dataset.drag,el=h.closest({item:'li[data-item]',grp:'.plgrp',cat:'.plcat',row:'tr[data-row]'}[kind]);if(!el)return;
  ev.preventDefault();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  const before=JSON.stringify(kind==='row'?P.program.items.map(i=>i.id):P.checklists.map(c=>[c.id,c.groups.map(g=>[g.id,g.items.map(i=>i.id)])]));
  drag={kind,el,x:ev.clientX,y:ev.clientY,raf:0};el.classList.add('dragging');body.classList.add('pldrag','pldrag-'+kind);
  const mv=e=>{if(!drag)return;e.preventDefault();drag.x=e.clientX;drag.y=e.clientY;place()};
  const tick=()=>{if(!drag)return;const m=70,sp=drag.y<m?-14:drag.y>innerHeight-m?14:0;if(sp){scrollBy(0,sp);place()}drag.raf=requestAnimationFrame(tick)};drag.raf=requestAnimationFrame(tick);
  // listen on the whole page: moving the element in the page would drop a pointer capture on the handle
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);
   cancelAnimationFrame(drag.raf);el.classList.remove('dragging');body.classList.remove('pldrag','pldrag-'+kind);drag=null;commit(kind,before)};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
 });

 /* ---------- program chart ---------- */
 const progTimes=()=>{const T=PV.times(P.program);P.program.items.forEach((it,n)=>{const c=body.querySelector(`[data-row="${it.id}"] .prgt`);if(c)c.innerHTML=T[n].from?`<b>${T[n].from}</b><small>to ${T[n].to}</small>`:`<b>–</b>`});
  const tot=PV.total(P.program),f=$('.prgtot',body);if(f)f.textContent=`${P.program.items.length} item${P.program.items.length===1?'':'s'} · total ${PV.dur(tot)}${P.program.start?` · ends at ${PV.clock(PV.toMin(P.program.start)+tot)}`:''}`};
 function drawProgram(focus){
  const items=P.program.items;
  body.innerHTML=`<div class="prghead"><label class="prgstart">Program starts at <input type="time" data-f="start" value="${esc(P.program.start)}"></label><p class="small" style="margin:0">Add each item with how many minutes it takes. Times are worked out for you, and change when you reorder or edit.</p></div>
  <div class="prgwrap"><table class="prgtab"><thead><tr><th>#</th><th>Time</th><th>Program item</th><th>Minutes</th><th>Person</th><th>Notes</th><th><span class="vh">Actions</span></th></tr></thead><tbody>
   ${items.map((it,n)=>`<tr data-row="${it.id}"><td class="n"><button type="button" class="dragh" data-drag="row" aria-label="Drag to move this program item" title="Drag to move">⠿</button><span>${n+1}</span></td><td class="prgt"></td><td><input data-f="title" value="${esc(it.title)}" placeholder="e.g. National Anthem" maxlength="160" aria-label="Program item ${n+1}"></td><td><input class="dur" type="number" min="0" max="720" inputmode="numeric" data-f="dur" value="${it.dur||''}" aria-label="Minutes for item ${n+1}"></td><td><input data-f="who" value="${esc(it.who)}" placeholder="Speaker / person" maxlength="100" aria-label="Person for item ${n+1}"></td><td><input data-f="note" value="${esc(it.note)}" placeholder="Notes" maxlength="200" aria-label="Notes for item ${n+1}"></td>
    <td class="acts"><button type="button" class="iconb" data-a="rup" ${n?'':'disabled'} aria-label="Move up">↑</button><button type="button" class="iconb" data-a="rdown" ${n<items.length-1?'':'disabled'} aria-label="Move down">↓</button><button type="button" class="iconb del" data-a="rdel" aria-label="Delete item">×</button></td></tr>`).join('')}
   <tr class="prgadd"><td class="n">${items.length+1}</td><td></td><td><input class="prgaddin" id="pa-title" placeholder="Add a program item, or paste a list" maxlength="160" aria-label="New program item"></td><td><input class="dur prgaddin" id="pa-dur" type="number" min="0" max="720" inputmode="numeric" placeholder="min" aria-label="Minutes"></td><td><input class="prgaddin" id="pa-who" placeholder="Speaker / person" maxlength="100" aria-label="Person"></td><td colspan="2"><button type="button" class="btn sm" data-a="radd">Add</button></td></tr>
  </tbody></table></div><p class="prgtot"></p>
  ${items.length?'':`<div class="plstart"><p>Not sure where to start? Add a typical running order, then change the names and minutes.</p><button type="button" class="btn ghost" data-a="rtpl">Add example program</button></div>`}`;
  progTimes();if(focus){const el=$(focus,body);if(el)el.focus()}
 }
 const addRow=()=>{const t=$('#pa-title',body).value.trim();if(!t){$('#pa-title',body).focus();return}
  P.program.items.push({id:plId(),title:t,dur:Math.max(0,parseInt($('#pa-dur',body).value,10)||0),who:$('#pa-who',body).value.trim(),note:''});save();drawProgram('#pa-title')};

 /* ---------- tabs, share, print ---------- */
 const go=t=>{tab=t;$$('[data-pt]',main).forEach(b=>{const on=b.dataset.pt===t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  const what=t==='program'?'program chart':'checklist';$('#plshare',main).textContent='🔗 Share '+what;$('#plprint',main).textContent='🖨 Print '+what;t==='program'?drawProgram():drawLists()};
 $$('[data-pt]',main).forEach(b=>b.onclick=()=>go(b.dataset.pt));
 $('#plprint',main).onclick=async()=>{if(dirty){clearTimeout(timer);await flush()}if(!PV.print(P,ev,tab))toast('Allow pop-ups to print.',true)};
 const orgBtn=()=>{$('#plorg',main).innerHTML=ev.logo?`<img src="${esc(ev.logo)}" alt=""><span>${esc(ev.org||'Organiser')}<small>Change</small></span>`:`<span class="plorgadd">＋</span><span>Organiser logo<small>Shown on the team link and print-out</small></span>`};
 $('#plorg',main).onclick=()=>planOrg(e,ev,orgBtn);orgBtn();
 $('#plshare',main).onclick=()=>planShare(e,tab,SH[tab]||{},all=>{SH=all;summary()});
 summary();stat('All changes saved ✓');go(tab);
}

function planShare(e,kind,SH,onChange){
 const prog=kind==='program',what=prog?'program chart':'checklist';
 const link=()=>location.origin+'/plan#'+SH.key;
 modal(`<h2>Share the ${what}</h2><p class="small" style="margin-top:-4px">${prog?'This link shows <b>only the program chart</b>: handy for the anchor, stage team and guests.':'This link shows <b>only the preparation checklist</b>, not the program chart.'} People open it without logging in.</p>
  <label class="ck"><input type="checkbox" id="ps-on" ${SH.on?'checked':''}><span><b>Link is on</b>: untick to stop the link working.</span></label>
  ${prog?'':`<label class="ck"><input type="checkbox" id="ps-tick" ${SH.tick!==false?'checked':''}><span><b>Team can tick items off</b>: they type their name once, and you see who ticked what. Untick for view only.</span></label>`}
  <div class="pslink" ${SH.on?'':'hidden'}><div class="field"><label for="ps-url">${prog?'Program chart':'Checklist'} link</label><input id="ps-url" readonly value="${SH.key?esc(link()):''}"></div>
   <div class="evbtns"><button type="button" class="btn sm" id="ps-copy">Copy link</button><a class="btn sm ghost" id="ps-wa" target="_blank" rel="noopener">Send on WhatsApp</a><a class="btn sm ghost" id="ps-open" target="_blank" rel="noopener">Open ↗</a><button type="button" class="linkbtn" id="ps-new">Make a new link (old one stops working)</button></div></div>
  <div class="mrow"><button type="button" class="btn" data-close>Done</button></div>`,(m,close)=>{
  const sync=()=>{$('.pslink',m).hidden=!SH.on;if(SH.key){$('#ps-url',m).value=link();$('#ps-open',m).href=link();$('#ps-wa',m).href=waLink('',`${prog?'Program chart':'Preparation checklist'} for ${e.title}\n${link()}`)}};
  const send=async body=>{try{const d=await AAPI.call(`/admin/events/${e.id}/plan/share`,{method:'POST',body:{...body,kind}});SH=d.shares[kind];onChange(d.shares);sync()}catch(err){toast(err.message,true)}};
  $('#ps-on',m).onchange=ev=>send({on:ev.target.checked});
  const tk=$('#ps-tick',m);if(tk)tk.onchange=ev=>send({tick:ev.target.checked});
  $('#ps-copy',m).onclick=()=>copy(link());
  $('#ps-new',m).onclick=async()=>{if(await confirmBox('Make a new link?','The current link will stop working for everyone who has it.','Make new link',true))send({on:true,reset:true})};
  sync();
 });
}

/* organiser name + logo: saved in the event's badge design, shown on the planner print-out and team link */
function planOrg(e,ev,done){
 let logo=(e.badge||{}).logo||'';
 modal(`<h2>Organiser</h2><p class="small" style="margin-top:-4px">Shown at the top of the planner's team link and print-out, and on the event's name badges.</p>
  <div class="field"><label for="po-name">Organiser name</label><input id="po-name" maxlength="80" value="${esc((e.badge||{}).org||'')}" placeholder="e.g. Dubai KMCC Kozhikode District Committee"></div>
  <div class="field"><label>Organiser logo</label><div class="evcover"><div class="evcprev polprev">${logo?`<img src="/api/img/${logo}" alt="">`:'<span>No logo yet</span>'}</div><div><input type="file" id="po-file" accept="image/png,image/jpeg,image/webp"><small class="small">A PNG with a transparent background looks best.</small>${logo?'<button type="button" class="linkbtn po-rm">Remove logo</button>':''}</div></div></div>
  <p class="formerr" role="alert"></p><div class="mrow"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn" id="po-save">Save</button></div>`,(m,close)=>{
  $('#po-file',m).onchange=async ev2=>{const f=ev2.target.files[0];if(!f)return;const pv=$('.polprev',m);pv.innerHTML='<span>Uploading…</span>';
   try{const img=await prepImage(f);const d=await AAPI.call('/admin/upload',{method:'POST',body:{type:img.type,data:img.data}});logo=d.id;pv.innerHTML=`<img src="${img.preview}" alt="">`}catch(err){pv.innerHTML='<span>Upload failed</span>';toast(err.message,true)}};
  const rm=$('.po-rm',m);if(rm)rm.onclick=()=>{logo='';$('.polprev',m).innerHTML='<span>No logo</span>'};
  $('#po-save',m).onclick=async()=>{const b=$('#po-save',m);b.disabled=true;
   try{const badge={...(e.badge||{}),org:$('#po-name',m).value.trim(),logo};const d=await AAPI.call('/admin/events/'+e.id,{method:'PATCH',body:{badge}});
    e.badge=d.event.badge;ev.org=e.badge.org||'';ev.logo=e.badge.logo?'/api/img/'+e.badge.logo:'';close();done();toast('Organiser saved')}
   catch(err){$('.formerr',m).textContent=err.message;b.disabled=false}};
 });
}
