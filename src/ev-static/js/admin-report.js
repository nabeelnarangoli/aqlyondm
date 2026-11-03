/* =====================================================================
   Admin: graphical report for one event (Registrations / Check-in / Report tab).
   A chart for every question on the form, worked out from the field type:
   - choices, dropdowns, checkboxes, scales, ratings, grid rows -> counts per answer
   - standard fields (country, education, student/parent), status, check-in, imported/online
   - short answers: numbers -> ranges; text (e.g. a typed city) -> grouped answers, top 15
   - dates -> by month; registrations over time -> by day
   Count registrations or people, choose who to include, and break any chart down by another question.
   Colours: categorical slots in a fixed order (validated palette); numbers are always written next to bars.
   ===================================================================== */
const RP_COLORS=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#6250d6','#e34948'];
const RP_ONE='#2a78d6',RP_OTHER='#8C8B86';
let RP={e:null,regs:[],count:'regs',who:'attending',by:'',showAll:{}};

function rpFields(e,regs){
 const FM=e.form||{std:{whatsapp:true,country:true,education:false,role:false},fields:[]};
 const out=[];const has=k=>regs.some(r=>r[k]);
 // what kind of field, and how to read its answer(s) from a registration
 if(FM.std.role!==false||has('role'))out.push({id:'role',label:'Student or parent',kind:'cat',order:['Student','Parent'],get:r=>r.role});
 if(FM.std.education!==false||has('education'))out.push({id:'education',label:'Education level',kind:'cat',order:['SSLC','Plus Two','Bachelors','Masters','PhD','Other'],get:r=>r.education});
 if(FM.std.country!==false||has('country'))out.push({id:'country',label:'Country',kind:'cat',get:r=>r.country?countryName(r.country):''});
 for(const f of FM.fields||[]){
  const get=r=>(r.answers||{})[f.id];
  if(f.type==='choice'||f.type==='dropdown')out.push({id:f.id,label:f.label,kind:'cat',order:f.options,other:true,get});
  else if(f.type==='checkboxes')out.push({id:f.id,label:f.label,kind:'multi',order:f.options,other:true,get});
  else if(f.type==='scale')out.push({id:f.id,label:f.label,kind:'ord',order:Array.from({length:f.scaleMax-f.scaleMin+1},(_,i)=>String(f.scaleMin+i)),avg:true,ends:[f.minLabel,f.maxLabel],get});
  else if(f.type==='rating')out.push({id:f.id,label:f.label,kind:'ord',order:Array.from({length:f.stars},(_,i)=>String(i+1)),avg:true,stars:true,get});
  else if(f.type==='grid'||f.type==='checkgrid')(f.rows||[]).forEach(row=>out.push({id:f.id+'::'+row,label:`${f.label} · ${row}`,kind:f.type==='grid'?'cat':'multi',order:f.cols,get:r=>((r.answers||{})[f.id]||{})[row]}));
  else if(f.type==='short'&&f.valid==='number')out.push({id:f.id,label:f.label,kind:'num',get});
  else if(f.type==='short')out.push({id:f.id,label:f.label,kind:'text',get});
  else if(f.type==='date')out.push({id:f.id,label:f.label,kind:'month',get});
  else if(f.type==='paragraph'||f.type==='file'||f.type==='time')out.push({id:f.id,label:f.label,kind:'answered',get});
 }
 out.push({id:'_seats',label:'People per booking',kind:'ord',order:[...new Set(regs.map(r=>String(r.seats||1)))].sort((a,b)=>a-b),get:r=>String(r.seats||1)});
 out.push({id:'_status',label:'Registration status',kind:'cat',get:r=>r.status==='pending'&&r.source==='import'?'Imported, not confirmed':(REG_ST[r.status]||[r.status])[0]});
 out.push({id:'_in',label:'Checked in',kind:'cat',order:['Checked in','Not checked in'],get:r=>['confirmed','approved'].includes(r.status)?(r.attended?'Checked in':'Not checked in'):''});
 if(regs.some(r=>r.source==='import'))out.push({id:'_src',label:'How they registered',kind:'cat',get:r=>r.source==='import'?'Imported from Excel':'Online form'});
 return out;
}
// one answer -> the group it is counted in
const rpTitle=s=>String(s).trim().replace(/\s+/g,' ').toLowerCase().replace(/(^|[\s\-/(])\S/g,m=>m.toUpperCase());
function rpKeys(f,v){
 if(v==null||v===''||(Array.isArray(v)&&!v.length))return [];
 if(f.kind==='multi')return (Array.isArray(v)?v:[v]).map(x=>/^Other: /.test(x)?'Other':x);
 if(f.kind==='cat')return [/^Other: /.test(v)?'Other':String(v)];
 if(f.kind==='ord')return [String(v)];
 if(f.kind==='text')return [rpTitle(v)];
 if(f.kind==='month'){const d=new Date(v+'T00:00:00');return isNaN(d)?[]:[d.toLocaleDateString('en-GB',{month:'short',year:'numeric'})]}
 if(f.kind==='num'){const n=Number(v);if(!isFinite(n))return [];return [n]}
 if(f.kind==='answered')return ['Answered'];
 return [];
}
function rpPeople(){const ok=r=>['confirmed','approved'].includes(r.status);
 return RP.regs.filter(r=>RP.who==='all'?true:RP.who==='in'?ok(r)&&r.attended:RP.who==='attending'?ok(r)||(r.status==='pending'&&r.source!=='import'):true)}
const rpW=r=>RP.count==='people'?(r.seats||1):1;

// counts per group (optionally split by the breakdown field)
function rpTally(f,list,byF){
 const groups=new Map(),split=new Map();let answered=0,blank=0;const nums=[];
 for(const r of list){let ks=rpKeys(f,f.get(r));if(!ks.length){blank+=rpW(r);continue}answered+=rpW(r);
  if(f.kind==='num'){nums.push([ks[0],r]);continue}
  const sk=byF?(rpKeys(byF,byF.get(r))[0]||'No answer'):'';
  for(const k of new Set(ks)){groups.set(k,(groups.get(k)||0)+rpW(r));if(byF){const m=split.get(k)||new Map();m.set(sk,(m.get(sk)||0)+rpW(r));split.set(k,m)}}}
 if(f.kind==='num'&&nums.length){   // numbers -> about 6 equal ranges
  const vals=nums.map(x=>x[0]),lo=Math.min(...vals),hi=Math.max(...vals);const step=Math.max(1,Math.ceil((hi-lo+1)/6));
  const lab=i=>{const a=lo+i*step,b=a+step-1;return a===b?String(a):`${a}–${b}`};f._order=[];for(let i=0;lo+i*step<=hi;i++)f._order.push(lab(i));
  for(const [n,r] of nums){const k=lab(Math.floor((n-lo)/step));groups.set(k,(groups.get(k)||0)+rpW(r));if(byF){const sk=rpKeys(byF,byF.get(r))[0]||'No answer';const m=split.get(k)||new Map();m.set(sk,(m.get(sk)||0)+rpW(r));split.set(k,m)}}
  f._avg=vals.reduce((a,b)=>a+b,0)/vals.length}
 let rows=[...groups.entries()];
 const order=f._order||f.order;
 if(f.kind==='ord'||f.kind==='num'||f.kind==='month'){const o=order||[];if(f.kind==='month')rows.sort((a,b)=>new Date('1 '+a[0])-new Date('1 '+b[0]));else rows.sort((a,b)=>o.indexOf(a[0])-o.indexOf(b[0]));
  if((f.kind==='ord'||f.kind==='num')&&o.length)rows=o.map(k=>[k,groups.get(k)||0])}   // keep empty ranges so the scale stays honest
 else rows.sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(b[0]));
 return {rows,split,answered,blank,total:list.reduce((t,r)=>t+rpW(r),0)};
}

async function reportView(e){
 const main=$('.adm');RP.e=e;
 main.innerHTML=`${evHeadHTML(e,'report')}<p class="lead">Loading…</p>`;bindEvHead(e);history.replaceState(null,'','#events/'+e.id+'/report');
 try{RP.regs=(await AAPI.call(`/admin/events/${e.id}/regs`)).regs}catch(err){RP.regs=[]}
 rpDraw();
}
function rpDraw(){
 const e=RP.e,main=$('.adm'),fields=rpFields(e,RP.regs),list=rpPeople();
 const byChoices=fields.filter(f=>(f.kind==='cat'||f.kind==='ord')&&!f.id.startsWith('_seats'));
 const byF=byChoices.find(f=>f.id===RP.by)||null;
 const ok=RP.regs.filter(r=>['confirmed','approved'].includes(r.status)),ppl=ok.reduce((t,r)=>t+(r.seats||1),0);
 const inP=ok.filter(r=>r.attended).reduce((t,r)=>t+(r.seats||1),0);
 const unit=RP.count==='people'?'people':'registrations';
 // break-down colours follow the answer, in the field's own order, so they never repaint when filters change
 let byKeys=[];if(byF){const seen=new Set();list.forEach(r=>{const k=rpKeys(byF,byF.get(r))[0];if(k)seen.add(k)});byKeys=[...(byF.order||[]).filter(k=>seen.has(k)),...[...seen].filter(k=>!(byF.order||[]).includes(k)).sort()];if(list.some(r=>!rpKeys(byF,byF.get(r)).length))byKeys.push('No answer')}
 const colorOf=k=>{const i=byKeys.indexOf(k);return k==='No answer'||i>=8?RP_OTHER:RP_COLORS[i]};
 // registrations per day
 const days=new Map();list.forEach(r=>{const d=new Date(r.at).toISOString().slice(0,10);days.set(d,(days.get(d)||0)+rpW(r))});
 const dayRows=[...days.entries()].sort();
 main.innerHTML=`${evHeadHTML(e,'report')}
 <div class="rphero"><div><b>${RP.regs.length}</b><span>Registrations</span></div><div><b>${ppl}</b><span>People confirmed</span></div><div><b>${inP}</b><span>Checked in</span></div><div><b>${ppl?Math.round(inP/ppl*100):0}%</b><span>Attendance</span></div></div>
 <div class="rpbar">
  <label>Count<select id="rpcount"><option value="regs" ${RP.count==='regs'?'selected':''}>Registrations</option><option value="people" ${RP.count==='people'?'selected':''}>People (seats)</option></select></label>
  <label>Include<select id="rpwho"><option value="attending" ${RP.who==='attending'?'selected':''}>Attending (not cancelled)</option><option value="in" ${RP.who==='in'?'selected':''}>Checked in only</option><option value="all" ${RP.who==='all'?'selected':''}>Everyone, any status</option></select></label>
  <label>Break down by<select id="rpby"><option value="">Nothing</option>${byChoices.map(f=>`<option value="${esc(f.id)}" ${RP.by===f.id?'selected':''}>${esc(f.label)}</option>`).join('')}</select></label>
  <span class="rpacts"><button type="button" class="btn sm ghost rpxls">⬇ Excel</button><button type="button" class="btn sm ghost rpprint">🖨 Print / PDF</button></span>
 </div>
 ${byF?`<div class="rplegend"><b>${esc(byF.label)}:</b>${byKeys.map(k=>`<span><i style="background:${colorOf(k)}"></i>${esc(k)}</span>`).join('')}</div>`:''}
 <div class="rpgrid">
  ${dayRows.length>1?`<section class="rpcard wide"><h3>Registrations over time</h3><p class="rpsub">${list.length} ${unit} · by day registered</p>${rpColumns(dayRows,unit)}</section>`:''}
  ${fields.map(f=>rpCard(f,list,byF,byKeys,colorOf,unit)).join('')}
 </div>
 ${list.length?'':'<div class="empty"><p>No registrations match. Change <b>Include</b> above.</p></div>'}
 <div class="rptip" hidden></div>`;
 bindEvHead(e);
 $('#rpcount').onchange=x=>{RP.count=x.target.value;rpDraw()};$('#rpwho').onchange=x=>{RP.who=x.target.value;rpDraw()};$('#rpby').onchange=x=>{RP.by=x.target.value;rpDraw()};
 $$('[data-more]').forEach(b=>b.onclick=()=>{RP.showAll[b.dataset.more]=!RP.showAll[b.dataset.more];rpDraw()});
 $$('[data-tbl]').forEach(b=>b.onclick=()=>{const c=b.closest('.rpcard');c.classList.toggle('tbl');b.textContent=c.classList.contains('tbl')?'Chart':'Table'});
 $('.rpprint').onclick=()=>print();
 $('.rpxls').onclick=()=>rpExcel(e,fields,list,byF,byKeys,unit);
 // hover: exact numbers for any bar or segment
 const tip=$('.rptip');
 $$('[data-tip]').forEach(m=>{m.onmousemove=ev=>{tip.hidden=false;tip.innerHTML=m.dataset.tip;tip.style.left=Math.min(ev.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(ev.clientY+14)+'px'};m.onmouseleave=()=>tip.hidden=true});
}
function rpCard(f,list,byF,byKeys,colorOf,unit){
 const T=rpTally(f,list,byF&&byF.id!==f.id?byF:null);
 if(f.kind==='answered')return `<section class="rpcard small"><h3>${esc(f.label)}</h3><p class="rpbig"><b>${T.answered}</b> answered${T.blank?` · ${T.blank} left blank`:''}</p><p class="rpsub">Written answers: see them in Registrations or the Excel file.</p></section>`;
 if(!T.answered)return `<section class="rpcard small"><h3>${esc(f.label)}</h3><p class="rpsub">No answers yet.</p></section>`;
 const lim=15,all=RP.showAll[f.id];let rows=T.rows;let folded=0;
 if(rows.length>lim&&!all&&f.kind!=='ord'){folded=rows.slice(lim).reduce((t,r)=>t+r[1],0);rows=rows.slice(0,lim)}
 const max=Math.max(...rows.map(r=>r[1]),folded,1);
 const base=f.kind==='multi'?T.answered:T.answered;   // % of people who answered this question
 const split=byF&&byF.id!==f.id;
 const bar=(k,v)=>{const pct=base?Math.round(v/base*100):0;const segs=split?byKeys.map(s=>[s,(T.split.get(k)||new Map()).get(s)||0]).filter(x=>x[1]):[];
  const tip=`<b>${esc(k)}</b><br>${v} ${unit} · ${pct}%${segs.length?'<br>'+segs.map(([s,n])=>`<i style="background:${colorOf(s)}"></i>${esc(s)}: ${n}`).join('<br>'):''}`;
  return `<div class="rprow" data-tip="${esc(tip)}"><span class="rplab" title="${esc(k)}">${f.stars?'★'.repeat(+k):esc(k)}</span><span class="rptrack"><span class="rpfill" style="width:${v/max*100}%;${v?'':'min-width:0'}">${split?segs.map(([s,n])=>`<i style="width:${n/v*100}%;background:${colorOf(s)}"></i>`).join(''):`<i style="width:100%;background:${RP_ONE}"></i>`}</span></span><span class="rpval"><b>${v}</b> <small>${pct}%</small></span></div>`};
 const avg=f.avg&&T.answered?(T.rows.reduce((t,[k,v])=>t+Number(k)*v,0)/T.rows.reduce((t,[,v])=>t+v,0)):f._avg;
 const tbl=`<table class="rptbl"><thead><tr><th>${esc(f.kind==='num'?'Range':'Answer')}</th>${split?byKeys.map(s=>`<th>${esc(s)}</th>`).join(''):''}<th>${RP.count==='people'?'People':'Count'}</th><th>%</th></tr></thead><tbody>${T.rows.map(([k,v])=>`<tr><td>${esc(k)}</td>${split?byKeys.map(s=>`<td>${(T.split.get(k)||new Map()).get(s)||0}</td>`).join(''):''}<td>${v}</td><td>${base?Math.round(v/base*100):0}%</td></tr>`).join('')}</tbody></table>`;
 return `<section class="rpcard ${rows.length>8?'tall':''}"><div class="rphead"><h3>${esc(f.label)}</h3><button type="button" class="linkbtn sm" data-tbl>Table</button></div>
 <p class="rpsub">${T.answered} ${unit} answered${T.blank?` · ${T.blank} no answer`:''}${f.kind==='multi'?' · people could pick several, so % add up to more than 100':''}${avg!=null&&!isNaN(avg)?` · average <b>${avg.toFixed(1)}</b>`:''}${f.ends&&(f.ends[0]||f.ends[1])?` · ${esc(f.order[0])} = ${esc(f.ends[0]||'')}, ${esc(f.order[f.order.length-1])} = ${esc(f.ends[1]||'')}`:''}</p>
 <div class="rpbars">${rows.map(([k,v])=>bar(k,v)).join('')}${folded?`<div class="rprow"><span class="rplab">All others</span><span class="rptrack"><span class="rpfill" style="width:${folded/max*100}%"><i style="width:100%;background:${RP_OTHER}"></i></span></span><span class="rpval"><b>${folded}</b></span></div>`:''}</div>
 ${T.rows.length>lim&&f.kind!=='ord'?`<button type="button" class="linkbtn sm" data-more="${esc(f.id)}">${all?'Show top 15':`Show all ${T.rows.length}`}</button>`:''}
 <div class="rptblwrap">${tbl}</div></section>`;
}
function rpColumns(rows,unit){
 const max=Math.max(...rows.map(r=>r[1]),1);const fmt=d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
 const step=Math.ceil(rows.length/12);
 return `<div class="rpcols">${rows.map(([d,v],i)=>`<div class="rpcol" data-tip="${esc(`<b>${fmt(d)}</b><br>${v} ${unit}`)}"><span class="rpcv">${v}</span><span class="rpcb" style="height:${v/max*100}%;background:${RP_ONE}"></span><span class="rpcl">${i%step===0?fmt(d):''}</span></div>`).join('')}</div>`;
}
function rpExcel(e,fields,list,byF,byKeys,unit){
 const sheets=[];const sum=[];
 sum.push(['Registrations',RP.regs.length],['Counting',RP.count==='people'?'People (seats)':'Registrations'],['Included',{attending:'Attending (not cancelled)',in:'Checked in only',all:'Everyone, any status'}[RP.who]],['Break down by',byF?byF.label:'Nothing']);
 sheets.push({name:'Summary',titles:[e.title+' · report',`${evDate(e)} · made ${new Date().toLocaleString('en-GB')}`],head:['','Value'],rows:sum,widths:[34,30]});
 const used=new Set(['Summary']);
 for(const f of fields){const T=rpTally(f,list,byF&&byF.id!==f.id?byF:null);if(!T.answered||f.kind==='answered')continue;
  const split=byF&&byF.id!==f.id;let nm=f.label.replace(/[\[\]:*?\/\\]/g,' ').slice(0,28);let i=2;while(used.has(nm))nm=nm.slice(0,26)+' '+i++;used.add(nm);
  sheets.push({name:nm,titles:[f.label,`${T.answered} ${unit} answered${T.blank?` · ${T.blank} no answer`:''}`],head:[f.kind==='num'?'Range':'Answer',...(split?byKeys:[]),RP.count==='people'?'People':'Count','%'],
   rows:T.rows.map(([k,v])=>[k,...(split?byKeys.map(s=>(T.split.get(k)||new Map()).get(s)||0):[]),v,T.answered?Math.round(v/T.answered*1000)/10:0]),widths:[34,...(split?byKeys.map(()=>14):[]),12,8]})}
 saveBlob(xlsxBook(sheets),`${e.slug}-report.xlsx`);toast('Report downloaded');
}
