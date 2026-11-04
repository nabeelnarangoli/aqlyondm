/* Event planner: read-only drawing shared by the team page (/plan#key) and the organiser's Print / PDF.
   Program chart times come from the start time plus each item's duration. */
window.PlanView=(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1])*60+(+m[2]):null};
const clock=min=>{min=((min%1440)+1440)%1440;const h=Math.floor(min/60),m=min%60;return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'am':'pm'}`};
const times=prog=>{let t=toMin(prog.start);return (prog.items||[]).map(i=>{if(t===null)return {from:'',to:''};const r={from:clock(t),to:clock(t+(i.dur||0))};t+=i.dur||0;return r})};
const total=prog=>(prog.items||[]).reduce((s,i)=>s+(i.dur||0),0);
const dur=m=>!m?'–':m<60?`${m} min`:`${Math.floor(m/60)} h${m%60?` ${m%60} min`:''}`;
const count=list=>{let n=0,d=0;for(const c of list||[])for(const g of c.groups||[])for(const i of g.items||[]){n++;if(i.done)d++}return {n,d}};
const pct=({n,d})=>n?Math.round(d/n*100):0;

function lists(plan,{tick=false,hideEmpty=false}={}){
 let L=plan.checklists||[];
 if(hideEmpty)L=L.map(c=>({...c,groups:c.groups.filter(g=>g.items.length)})).filter(c=>c.groups.length);
 if(!L.length)return '<p class="plempty">No checklists yet.</p>';
 return L.map(c=>{const k=count([c]);return `<section class="plc"><header class="plch"><h2>${esc(c.title||'Untitled category')}</h2><span class="plpill ${k.n&&k.d===k.n?'all':''}">${k.d} / ${k.n} done</span><div class="plbar"><i style="width:${pct(k)}%"></i></div></header>
  ${(c.groups||[]).map(g=>`<div class="plg">${g.title?`<h3>${esc(g.title)}</h3>`:''}${g.items.length?`<ol class="pli">${g.items.map((i,n)=>`<li class="${i.done?'done':''}"><label><input type="checkbox" data-item="${esc(i.id)}" ${i.done?'checked':''} ${tick?'':'disabled'} aria-label="${esc(i.text||'Item '+(n+1))}"><span class="num">${n+1}</span><span class="tx">${esc(i.text||'–')}${i.who?` <span class="who">${esc(i.who)}</span>`:''}${i.done&&i.by?` <small class="by">✓ ${esc(i.by)}</small>`:''}</span></label></li>`).join('')}</ol>`:'<p class="plnone">Nothing added yet.</p>'}</div>`).join('')}</section>`}).join('');
}
function program(plan){
 const P=plan.program||{items:[]},T=times(P),tot=total(P);
 if(!P.items.length)return '<p class="plempty">No program chart yet.</p>';
 return `<div class="plprog"><table><thead><tr><th class="t">Time</th><th>Program</th><th class="d">Duration</th><th>Person / notes</th></tr></thead><tbody>
  ${P.items.map((i,n)=>`<tr><td class="t">${T[n].from?`<b>${T[n].from}</b><small>to ${T[n].to}</small>`:`<b>${n+1}</b>`}</td><td class="p">${esc(i.title||'–')}</td><td class="d">${dur(i.dur)}</td><td>${i.who?`<b>${esc(i.who)}</b>`:''}${i.note?`<small>${esc(i.note)}</small>`:''}</td></tr>`).join('')}
 </tbody></table><p class="pltot">${P.items.length} item${P.items.length===1?'':'s'} · total ${dur(tot)}${P.start?` · ${clock(toMin(P.start))} to ${clock(toMin(P.start)+tot)}`:''}</p></div>`;
}
/* a printable page in a new window: which = 'lists' | 'program' | 'both' */
function print(plan,ev,which='both'){
 const w=window.open('','_blank');if(!w)return false;
 let css='';for(const sh of document.styleSheets){try{if(/plan\.css/.test(sh.href||''))css+=[...sh.cssRules].map(r=>r.cssText).join('\n')}catch(x){}}
 w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(ev.title)} · ${which==='program'?'Program chart':which==='lists'?'Checklists':'Event plan'}</title>${css?`<style>${css}</style>`:`<link rel="stylesheet" href="${location.origin}/css/plan.css">`}</head><body class="plprint">
  <header class="plph"><img src="${location.origin}/img/aqlyon-q.png" alt="" width="34" height="34"><div><h1>${esc(ev.title)}</h1><p>${esc(ev.when||'')}${ev.venue?' · '+esc(ev.venue):''}</p></div></header>
  ${which!=='lists'?`<h2 class="plsec">Program chart</h2>${program(plan)}`:''}${which!=='program'?`<h2 class="plsec">Preparation checklist</h2>${lists(plan,{hideEmpty:true})}`:''}
  <script>setTimeout(()=>print(),500)<\/script></body></html>`);
 w.document.close();return true;
}
return {esc,toMin,clock,times,total,dur,count,pct,lists,program,print};
})();
