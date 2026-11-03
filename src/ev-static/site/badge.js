/* Participant badge at /badge/<token> (and /badge/preview#<design> for the admin preview).
   One badge layout, styled by the event's design (template, colour, organiser, size). The saved image is
   painted from the badge on screen, so screen, print and image always match. Data comes from window.BADGE. */
(()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SIZES={a6:{mm:[105,148],name:'A6'},card:{mm:[54,85.6],name:'ID card'},a7:{mm:[74,105],name:'A7'},'4x6':{mm:[101.6,152.4],name:'4 × 6 in'},tag:{mm:[101.6,76.2],name:'Name tag'}};
const TZN={'Asia/Kolkata':'IST','Asia/Dubai':'GST','Asia/Riyadh':'AST','Asia/Qatar':'AST','Europe/London':'UK time'};
const DEF={tpl:'classic',color:'#0D2B22',org:'',logo:'',brand:true,size:'a6',showRole:true,showTime:true,showVenue:true,hole:true};

function previewData(){let p={};try{p=JSON.parse(decodeURIComponent(location.hash.slice(1))||'{}')}catch(x){}
 const ev=p.event||{};const st=Date.now()+7*864e5;
 return {preview:true,design:p.design||{},name:p.name||'Aisha Rahman',role:p.role??'Student',seats:p.seats||1,ref:'AQ-7F3C21',status:'confirmed',valid:true,attended:'',qr:location.origin+'/manage#checkin/0000000000preview00',
  event:{title:ev.title||'Your event name',slug:'',tz:ev.tz||'Asia/Kolkata',startUTC:ev.startUTC||st,endUTC:ev.endUTC||null,mode:ev.mode||'offline',locationName:ev.locationName||'Event venue',mapUrl:''}}}

function render(){
 const B=window.BADGE||previewData(),E=B.event,D={...DEF,...(B.design||{})};
 const fmt=(ms,o)=>new Intl.DateTimeFormat('en-GB',{timeZone:E.tz||'Asia/Kolkata',...o}).format(ms);
 const day=fmt(E.startUTC,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const time=fmt(E.startUTC,{hour:'numeric',minute:'2-digit',hour12:true})+(E.endUTC?' – '+fmt(E.endUTC,{hour:'numeric',minute:'2-digit',hour12:true}):'')+' '+(TZN[E.tz]||E.tzLabel||'');
 const place=E.mode==='online'?'Online event':E.locationName;
 const first=String(B.name).trim().split(/\s+/)[0];
 const qr=qrcode(0,'M');qr.addData(B.qr);qr.make();const N=qr.getModuleCount();
 let path='';for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(qr.isDark(y,x))path+=`M${x+3} ${y+3}h1v1h-1z`;
 const qrSVG=`<svg class="qrsvg" viewBox="0 0 ${N+6} ${N+6}" role="img" aria-label="QR code for check-in" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
 const state=!B.valid?(B.status==='pending'?'pending':'off'):B.attended?'in':'ok';
 const at=B.attended?new Date(B.attended).toLocaleTimeString('en-GB',{hour:'numeric',minute:'2-digit',hour12:true}):'';
 const sz=SIZES[D.size]||SIZES.a6,ar=sz.mm[0]/sz.mm[1];
 const hasOrg=!!(D.org||D.logo);
 const orgHTML=hasOrg?`<div class="borg">${D.logo?`<img class="blogo" src="${esc(D.logo)}" alt="">`:''}${D.org?`<span class="borgn">${esc(D.org)}</span>`:''}</div>`
  :D.brand?`<div class="borg"><img class="blogo aq" src="/img/aqlyon-q.png" alt=""><span class="borgn"><b>Aqlyon</b> Brand Management</span></div>`:'';
 const role=D.showRole&&B.role?B.role:'';
 const chips=`${role&&D.tpl!=='conference'?`<span class="bchip ${role==='Parent'?'par':''}">${esc(role)}</span>`:''}${B.seats>1?`<span class="bchip adm">Admits ${B.seats}</span>`:''}`;
 const active=state==='ok'||state==='in';
 const qrPart=active?`<div class="bqr"><div class="qrbox">${qrSVG}</div><span class="bref">Ref <b>${esc(B.ref)}</b></span></div>`
  :`<div class="bqr"><div class="qrbox off"><span>${state==='pending'?'⏳':'✕'}</span></div><span class="bref">Ref <b>${esc(B.ref)}</b></span></div>`;
 const card=`<article class="bdg t-${esc(D.tpl)} sz-${esc(D.size)} st-${state}${D.hole!==false?' holed':''}" style="--c:${esc(D.color)};--ar:${ar}" aria-label="Event badge for ${esc(B.name)}">
  ${D.tpl==='minimal'?'<div class="bbar"></div>':''}${D.hole!==false?'<div class="bhole"></div>':''}
  <div class="bhead">${orgHTML}
   <span class="bkick">Event pass</span><h1 class="btitle">${esc(E.title)}</h1>
   ${D.showTime?`<p class="bwhen"><b>${esc(day)}</b> <span>${esc(time)}</span></p>`:''}${D.showVenue&&place?`<p class="bplace">${esc(place)}</p>`:''}</div>
  ${D.tpl==='classic'?'<div class="bcut"><i class="dot l"></i><i class="ln"></i><i class="dot r"></i></div>':''}
  <div class="bmain"><div class="bwho"><span class="blbl">Participant</span><h2 class="bname">${esc(B.name)}</h2>${chips?`<div class="bchips">${chips}</div>`:''}</div>${qrPart}</div>
  ${D.tpl==='conference'?`<div class="brole">${esc(role?role.toUpperCase():'PARTICIPANT')}</div>`:''}
  ${hasOrg&&D.brand?`<div class="bfoot"><img class="blogo aq" src="/img/aqlyon-q.png" alt=""><span>www.aqlyondm.com</span></div>`:''}
 </article>`;
 document.title=B.preview?'Badge preview':`${B.name} · ${E.title} · Badge`;
 $('#badge').innerHTML=`${B.preview?'':`<p class="bdgtop"><a href="/events/${esc(E.slug)}"><img src="/img/aqlyon-q.png" alt="" width="28" height="28"><span><b>Aqlyon</b> Brand Management</span></a></p>`}
 <div class="bstage ${D.size==='tag'?'land':''}"><div class="bdgbox sz-${esc(D.size)}">${card}</div></div>
 ${state==='in'?`<p class="stamp">✓ Checked in · ${esc(at)}</p>`:''}
 ${state==='pending'?`<p class="bdgwarn">Your badge is not active yet. It will work once your registration is approved. Open this page again after you get the confirmation.</p>`:''}
 ${state==='off'?`<p class="bdgwarn bad">This registration is ${esc(B.status)}, so the badge can't be used. Contact Aqlyon Brand Management if this is a mistake.</p>`:''}
 ${active&&!B.preview?`<p class="bdghint">Show this QR code at the entrance</p><div class="bdgbtns"><button type="button" class="btn" id="save">Save badge image</button><button type="button" class="btn line" id="print">Print (${esc(sz.name)})</button></div>
 <p class="bdgnote">Tip: save the image to your phone so you can show it without internet. Hi ${esc(first)}, see you there!</p>`:''}
 ${B.preview?`<p class="bdgnote">Preview with sample details · printed size ${esc(sz.name)} (${sz.mm[0]} × ${sz.mm[1]} mm)</p>`:`<p class="bdgnote"><a href="/events/${esc(E.slug)}">Event details</a>${E.mapUrl&&E.mode!=='online'?` · <a href="${esc(E.mapUrl)}" target="_blank" rel="noopener">Directions</a>`:''}</p>`}`;
 // print exactly at the badge size
 let ps=$('#pagesize');if(!ps){ps=document.createElement('style');ps.id='pagesize';document.head.appendChild(ps)}
 ps.textContent=`@page{size:${sz.mm[0]}mm ${sz.mm[1]}mm;margin:0}@media print{.bdgbox{width:${sz.mm[0]}mm!important;max-width:none!important}}`;
 const pr=$('#print');if(pr)pr.onclick=()=>print();
 const sv=$('#save');if(sv)sv.onclick=async()=>{sv.disabled=true;sv.textContent='Preparing…';
  try{const blob=await paint($('.bdg'),Math.round(sz.mm[0]/25.4*300),{qr,N});const name=`${E.slug}-badge-${B.ref}.png`;
   const file=new File([blob],name,{type:'image/png'});
   if(navigator.canShare&&navigator.canShare({files:[file]})&&matchMedia('(pointer:coarse)').matches){try{await navigator.share({files:[file],title:E.title})}catch(x){}}
   else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
  }catch(x){console.error(x);alert('Could not make the image. Take a screenshot instead.')}
  sv.disabled=false;sv.textContent='Save badge image'};
}

/* paint the badge element onto a canvas: backgrounds, borders, images, the QR code and every word of text,
   at the same positions as on screen, scaled to the print resolution */
async function paint(root,outW,{qr,N}){
 try{await document.fonts.ready}catch(x){}
 await Promise.all([...root.querySelectorAll('img')].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
 const R0=root.getBoundingClientRect(),k=outW/R0.width,c=document.createElement('canvas');c.width=Math.round(R0.width*k);c.height=Math.round(R0.height*k);
 const g=c.getContext('2d');g.scale(k,k);g.translate(-R0.left,-R0.top);
 const rr=(x,y,w,h,r)=>{r=Math.max(0,Math.min(r,w/2,h/2));g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()};
 const px=v=>parseFloat(v)||0;const clear=v=>!v||v==='transparent'||/rgba\([^)]*,\s*0\)$/.test(v);
 const rs=getComputedStyle(root);rr(R0.left,R0.top,R0.width,R0.height,px(rs.borderTopLeftRadius));g.clip();
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
 for(let n=root;n;n=walker.nextNode()){
  if(n.nodeType===1){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden')continue;const r=n.getBoundingClientRect();if(!r.width||!r.height)continue;
   const rad=n.classList.contains('dot')?r.width/2:px(s.borderTopLeftRadius);
   if(!clear(s.backgroundColor)&&n!==root||n===root){g.fillStyle=n===root&&clear(s.backgroundColor)?'#fff':s.backgroundColor;rr(r.left,r.top,r.width,r.height,rad);g.fill()}
   const bw=px(s.borderTopWidth);if(bw&&s.borderTopStyle!=='none'&&!clear(s.borderTopColor)){g.save();g.strokeStyle=s.borderTopColor;g.lineWidth=bw;if(s.borderTopStyle==='dashed')g.setLineDash([bw*3,bw*2.5]);
    if(px(s.borderLeftWidth)||px(s.borderBottomWidth)){rr(r.left+bw/2,r.top+bw/2,r.width-bw,r.height-bw,Math.max(0,rad-bw/2));g.stroke()}else{g.beginPath();g.moveTo(r.left,r.top+bw/2);g.lineTo(r.right,r.top+bw/2);g.stroke()}g.restore()}
   if(n.tagName==='IMG'&&n.naturalWidth){const f=Math.min(r.width/n.naturalWidth,r.height/n.naturalHeight),w=n.naturalWidth*f,h=n.naturalHeight*f;g.drawImage(n,r.left+(r.width-w)/2,r.top+(r.height-h)/2,w,h)}
   if(n.classList.contains('qrsvg')){const cell=r.width/(N+6);g.fillStyle='#fff';g.fillRect(r.left,r.top,r.width,r.height);g.fillStyle='#111';
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(qr.isDark(y,x))g.fillRect(r.left+(x+3)*cell,r.top+(y+3)*cell,cell+.02,cell+.02)}
   continue}
  // text: every word drawn where the browser placed it
  const el=n.parentElement;if(!el||el.closest('svg'))continue;const s=getComputedStyle(el);if(s.visibility==='hidden')continue;
  const box=el.getBoundingClientRect();
  g.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;g.fillStyle=s.color;g.textBaseline='alphabetic';
  if('letterSpacing' in g)g.letterSpacing=s.letterSpacing==='normal'?'0px':s.letterSpacing;
  const m=g.measureText('Hg'),asc=m.fontBoundingBoxAscent||px(s.fontSize)*.8,desc=m.fontBoundingBoxDescent||px(s.fontSize)*.2;
  const txt=n.textContent,rng=document.createRange();const re=/\S+/g;let w;
  while((w=re.exec(txt))){rng.setStart(n,w.index);rng.setEnd(n,w.index+w[0].length);const rects=rng.getClientRects();if(!rects.length)continue;const b=rects[0];
   const mid=(b.top+b.bottom)/2;if(mid>box.bottom||mid<box.top)continue;     // hidden by line clamping
   let word=w[0];if(s.textTransform==='uppercase')word=word.toUpperCase();
   g.fillText(word,b.left,b.top+(b.height-(asc+desc))/2+asc)}
 }
 return await new Promise(res=>c.toBlob(res,'image/png'));
}
render();
addEventListener('hashchange',()=>{if(!window.BADGE)render()});
})();
