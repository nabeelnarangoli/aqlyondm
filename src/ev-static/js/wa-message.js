/* WhatsApp confirmation message: a template with {placeholders}, filled in per person.
   Shared by the admin (writing / previewing the message) and the helper's send page. */
const WA_TAGS=[['{first name}','First name'],['{name}','Full name'],['{event}','Event name'],['{date}','Date and time'],['{venue}','Place'],['{map}','Map link'],['{badge}','Badge link'],['{ref}','Reference'],['{people}','Number of people'],['{join}','Online joining link'],['{event page}','Event page']];
function waDefault(online){return online
 ?`Hello {first name} 👋\nYour registration for *{event}* is confirmed ✅\n\n📅 {date}\n💻 Online · join here: {join}\n🔖 Ref: {ref}\n\nSee you there!\n– Aqlyon Digital Marketing`
 :`Hello {first name} 👋\nYour registration for *{event}* is confirmed ✅\n\n📅 {date}\n📍 {venue} {map}\n🎫 Your entry badge (show the QR code at the entrance): {badge}\n🔖 Ref: {ref}{people}\n\nSee you there!\n– Aqlyon Digital Marketing`}
function waFill(tpl,ev,p){
 const v={'{first name}':String(p.name||'').trim().split(/\s+/)[0],'{name}':p.name||'','{event}':ev.title||'','{date}':ev.when||'','{venue}':ev.venue||'','{map}':ev.mapUrl||'',
  '{badge}':p.badge||'','{ref}':p.ref||'','{people}':p.seats>1?` · ${p.seats} people`:'','{join}':ev.join||'','{event page}':ev.page||''};
 return String(tpl||waDefault(ev.mode==='online')).replace(/\{(first name|name|event|date|venue|map|badge|ref|people|join|event page)\}/g,m=>v[m]).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
const waUrl=(num,text)=>`https://api.whatsapp.com/send?phone=${String(num||'').replace(/[^\d]/g,'')}&text=${encodeURIComponent(text)}`;
// Which message to use: the event's own message, else the common message (Event settings), else the built-in one.
const waCommon=(set,online)=>(((set||{})[online?'waMsgOnline':'waMsg'])||'').trim()||waDefault(online);
const waTemplate=(e,set)=>(e&&e.waMsg||'').trim()||waCommon(set,e&&e.mode==='online');
