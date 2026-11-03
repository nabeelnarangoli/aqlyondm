import { nameCase } from './name-case.mjs';
// Upcoming events: storage, public API, admin API, registrations and the shareable event page.
// Stores: events (one JSON per event), regs (one JSON per event: {list:[...]}), images (cover photos as base64).
import crypto from 'node:crypto';
import { inviteMail, whenText } from './invite-mail.mjs';
import { cleanForm, formOf, checkAnswers } from './form-def.mjs';

export const TZS = {
  'Asia/Kolkata': { label: 'IST', name: 'India time', off: 330 },
  'Asia/Dubai': { label: 'GST', name: 'UAE time', off: 240 },
  'Asia/Riyadh': { label: 'AST', name: 'Saudi time', off: 180 },
  'Asia/Qatar': { label: 'AST', name: 'Qatar time', off: 180 },
  'Europe/London': { label: 'UK', name: 'UK time', off: 0 },
};
const CURRENCIES = ['AED', 'INR', 'USD', 'SAR', 'QAR', 'OMR'];
export const EDUCATION = ['SSLC', 'Plus Two', 'Bachelors', 'Masters', 'PhD', 'Other'];
export const ROLES = ['Student', 'Parent'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event';
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(String(s || ''));
// local date-time string + time zone -> UTC milliseconds
export const toUTC = (local, tz) => { if (!local) return NaN; const off = (TZS[tz] || TZS['Asia/Kolkata']).off; return Date.parse(local + ':00Z') - off * 60_000; };

// badge design per event: template, colour, organiser name and logo, printed size, what to show
export const BADGE_TPLS = ['classic', 'minimal', 'bold', 'conference'];
export const BADGE_SIZES = ['a6', 'card', 'a7', '4x6', 'tag'];
export function cleanBadge(b = {}) {
  const bool = (v, d) => (v === undefined ? d : !!v);
  return {
    tpl: BADGE_TPLS.includes(b.tpl) ? b.tpl : 'classic',
    color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#0D2B22',
    org: String(b.org || '').trim().slice(0, 80),
    logo: /^[a-f0-9]{24}$/.test(b.logo || '') ? b.logo : '',
    brand: bool(b.brand, true), size: BADGE_SIZES.includes(b.size) ? b.size : 'a6',
    showRole: bool(b.showRole, true), showTime: bool(b.showTime, true), showVenue: bool(b.showVenue, true), hole: bool(b.hole, true),
  };
}
const badgeDesign = (e) => { const d = cleanBadge(e.badge || {}); return { ...d, logo: d.logo ? `/api/img/${d.logo}` : '' }; };

const waText = (v) => String(v ?? '').replace(/\r/g, '').slice(0, 1500).trim();
function clean(b, old = {}) {
  const e = { ...old };
  const str = (k, n) => { if (b[k] !== undefined) e[k] = String(b[k] ?? '').trim().slice(0, n); };
  str('title', 120); str('details', 6000); str('summary', 240); str('start', 16); str('end', 16);
  str('locationName', 160); str('mapUrl', 600); str('onlineUrl', 600); str('regLink', 600); str('cover', 40);
  if (b.tz !== undefined) e.tz = TZS[b.tz] ? b.tz : 'Asia/Kolkata';
  if (b.mode !== undefined) e.mode = b.mode === 'online' ? 'online' : 'offline';
  if (b.paid !== undefined) e.paid = !!b.paid;
  if (b.price !== undefined) e.price = Math.max(0, Math.round(Number(b.price) * 100) / 100 || 0);
  if (b.currency !== undefined) e.currency = CURRENCIES.includes(b.currency) ? b.currency : 'AED';
  if (b.regMode !== undefined) e.regMode = ['form', 'link', 'none'].includes(b.regMode) ? b.regMode : 'form';
  if (b.regOpen !== undefined) e.regOpen = !!b.regOpen;
  if (b.published !== undefined) e.published = !!b.published;
  if (b.capacity !== undefined) e.capacity = Math.max(0, parseInt(b.capacity, 10) || 0);
  if (b.form !== undefined) e.form = cleanForm(b.form);
  if (b.share !== undefined) e.share = !!b.share;
  if (b.waMsg !== undefined) e.waMsg = waText(b.waMsg); // WhatsApp confirmation message for this event ('' = use the common one)
  if (b.badge !== undefined) e.badge = cleanBadge(b.badge);
  if (b.maxSeats !== undefined) e.maxSeats = Math.min(20, Math.max(1, parseInt(b.maxSeats, 10) || 1));
  return e;
}
function validate(e) {
  if (!e.title) return 'Please add the event name.';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.start || '')) return 'Please add the event date and time.';
  if (e.end && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(e.end)) return 'The end time is not valid.';
  if (e.end && toUTC(e.end, e.tz) <= toUTC(e.start, e.tz)) return 'The end time must be after the start time.';
  if (e.mode === 'offline' && !e.locationName) return 'Offline event: please add the location.';
  if (e.mode === 'offline' && e.mapUrl && !isUrl(e.mapUrl)) return 'The map link must start with https://';
  if (e.mode === 'online' && e.onlineUrl && !isUrl(e.onlineUrl)) return 'The online link must start with https://';
  if (e.regMode === 'link' && !isUrl(e.regLink)) return 'Please add the registration link (starting with https://).';
  if (e.paid && !(e.price > 0)) return 'Paid event: please add the price.';
  return '';
}
const ended = (e, now = Date.now()) => (e.end ? toUTC(e.end, e.tz) : toUTC(e.start, e.tz) + 3 * 3600_000) < now;
// seats in use: not rejected/cancelled, and not imported people who are still waiting to be confirmed
const seatsTaken = (list) => list.filter((r) => r.status !== 'rejected' && r.status !== 'cancelled' && !(r.status === 'pending' && r.source === 'import')).reduce((t, r) => t + (r.seats || 1), 0);
function regState(e, list) {
  if (ended(e)) return 'ended';
  if (e.regMode === 'none') return 'none';
  if (!e.regOpen) return 'closed';
  if (e.regMode === 'form' && e.capacity && seatsTaken(list) >= e.capacity) return 'full';
  return 'open';
}
// what visitors may see: never the online joining link
function publicEvent(e, list) {
  const taken = seatsTaken(list);
  return {
    slug: e.slug, title: e.title, summary: e.summary || '', details: e.details || '', cover: e.cover ? `/api/img/${e.cover}` : '',
    start: e.start, end: e.end || '', tz: e.tz, tzLabel: (TZS[e.tz] || TZS['Asia/Kolkata']).label, startUTC: toUTC(e.start, e.tz), endUTC: e.end ? toUTC(e.end, e.tz) : null,
    mode: e.mode, locationName: e.mode === 'offline' ? e.locationName || '' : '', mapUrl: e.mode === 'offline' ? e.mapUrl || '' : '',
    paid: !!e.paid, price: e.price || 0, currency: e.currency || 'AED', regMode: e.regMode, regLink: e.regMode === 'link' ? e.regLink : '',
    form: formOf(e), share: e.share !== false, state: regState(e, list), seatsLeft: e.capacity ? Math.max(0, e.capacity - taken) : null, maxSeats: e.maxSeats || 1,
  };
}

// Calendar invitations: our own email from the academy Gmail account (Apps Script mailer), with the
// event attached as a calendar invitation. Subject: "Invitation from Aqlyon Brand Management: <event name>".
const adminSettings = (s) => ({ whatsapp: s.whatsapp || '+971509693948', waMsg: s.waMsg || '', waMsgOnline: s.waMsgOnline || '', calUrl: s.calUrl || '', calEmail: s.calEmail || '', calSecret: s.calSecret || '', calNeedsUpdate: !!s.calUrl && !s.calV2 });
const calOk = (r) => r && (r.status === 'confirmed' || r.status === 'approved');
async function calPost(cfg, payload, wait = 9000) {
  if (!cfg || !cfg.calUrl) return { ok: false, error: 'Calendar invitations are not connected.' };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), wait);
    const res = await fetch(process.env.CAL_TEST_URL || cfg.calUrl, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, secret: cfg.calSecret }), redirect: 'follow', signal: ctl.signal });
    clearTimeout(t);
    const txt = await res.text(); try { return JSON.parse(txt); } catch { return { ok: false, error: 'Google answered with a page instead of data. Check that the web app is deployed with access "Anyone".' }; }
  } catch (x) { return { ok: false, error: x.name === 'AbortError' ? 'Google took too long to answer.' : 'Could not reach the Apps Script mailer.' }; }
}

export function createEvents({ getStore, json }) {
  const events = () => getStore('events');
  const regs = () => getStore('regs');
  const images = () => getStore('images');
  const meta = () => getStore('meta');
  const badges = () => getStore('badges');
  const uploads = () => getStore('uploads');
  const sendlists = () => getStore('sendlists');      // WhatsApp send lists shared with helpers: key -> {e, name, ids, msg, on, sent}
  const slSummary = (l, doc) => ({ key: l.key, name: l.name, on: l.on, msg: l.msg, createdAt: l.createdAt, total: l.ids.length,
    sent: l.ids.filter((id) => l.sent[id]).length, valid: l.ids.filter((id) => calOk(doc.list.find((r) => r.id === id))).length });
  async function sendList(key) {
    const l = await sendlists().get(key, { type: 'json' });
    if (!l || !l.on) return { error: 'This WhatsApp list has been turned off or deleted. Ask the organiser for a new link.' };
    const e = await events().get(l.e, { type: 'json' }); if (!e) return { error: 'This event no longer exists.' };
    const endMs = e.end ? toUTC(e.end, e.tz) : toUTC(e.start, e.tz) + 3 * 3600_000;
    if (Date.now() > endMs + 2 * 864e5) return { error: 'This WhatsApp list has expired because the event is over.' };
    return { l, e };
  }          // files people attach in registration forms            // badge token -> { e: event id, r: registration id }
  // every registration gets a private badge token; the QR code on the badge holds it
  async function ensureTk(e, r) { if (r.tk) return false; r.tk = crypto.randomBytes(10).toString('hex'); await badges().setJSON(r.tk, { e: e.id, r: r.id }); return true; }
  async function byBadge(tk) {
    const ix = await badges().get(tk, { type: 'json' }); if (!ix) return null;
    const e = await events().get(ix.e, { type: 'json' }); if (!e) return null;
    const doc = (await regs().get(e.id, { type: 'json' })) || { list: [] };
    const r = doc.list.find((x) => x.id === ix.r); return r ? { e, doc, r } : null;
  }
  const checkinInfo = (e, doc, r) => ({
    event: { id: e.id, title: e.title, slug: e.slug, start: e.start, tz: e.tz, tzLabel: (TZS[e.tz] || TZS['Asia/Kolkata']).label, mode: e.mode, locationName: e.locationName || '' },
    reg: { id: r.id, tk: r.tk, ref: r.ref, name: nameCase(r.name), role: r.role || '', education: r.education || '', seats: r.seats || 1, phone: r.phone, email: r.email, status: r.status, attended: r.attended || '' },
    counts: { attended: doc.list.filter((x) => calOk(x) && x.attended).reduce((t, x) => t + (x.seats || 1), 0), total: seatsTaken(doc.list) },
  });
  const getRegs = async (id) => ((await regs().get(id, { type: 'json' })) || { list: [] }).list;
  const all = async () => { const s = events(); const { blobs } = await s.list(); const out = []; for (const b of blobs) { const e = await s.get(b.key, { type: 'json' }); if (e) out.push(e); } return out; };
  const bySlug = async (slug) => (await all()).find((e) => e.slug === slug);
  const rawSettings = async () => (((await meta().get('settings', { type: 'json' })) || {}).events || {});
  const evSettings = async () => ({ whatsapp: (await rawSettings()).whatsapp || '+971509693948' });
  const calCfg = async () => { const s = await rawSettings(); return s.calUrl ? { calUrl: s.calUrl, calSecret: s.calSecret, calEmail: s.calEmail } : null; };
  // check-in link for helpers: works for one event, until 2 days after it ends, without the admin password
  const p4 = (r) => String(r.phone || '').replace(/\D/g, '').slice(-4);
  const staffView = (info) => ({ ...info, reg: { ...info.reg, phone: '••• ' + p4(info.reg), email: undefined, education: undefined } });
  async function staffEvent(key) {
    const ix = await meta().get('staff-' + key, { type: 'json' }); if (!ix) return { error: 'This check-in link is not valid. Ask the organiser for the current link.' };
    const e = await events().get(ix.e, { type: 'json' });
    if (!e || !e.staffOn || e.staffKey !== key) return { error: 'This check-in link has been turned off or replaced. Ask the organiser for the current link.' };
    const endMs = e.end ? toUTC(e.end, e.tz) : toUTC(e.start, e.tz) + 3 * 3600_000;
    if (Date.now() > endMs + 2 * 864e5) return { error: 'This check-in link has expired because the event is over.' };
    return { e };
  }
  // send invitation / update / cancellation emails; marks each registration with the result so the admin can see it
  async function calGuests(e, doc, list, kind, origin) {
    const cfg = await calCfg(); if (!cfg || !list.length) return null;
    for (const r of list) await ensureTk(e, r);
    const messages = list.map((r) => inviteMail(e, r, kind, { origin, organizer: cfg.calEmail, seq: (r.calSeq ?? -1) + 1 }));
    const out = await calPost(cfg, { action: 'mail', messages }, 25000);
    const at = new Date().toISOString(); let sent = 0;
    list.forEach((r, i) => {
      const res = out.ok ? (out.results || [])[i] || { ok: false, error: 'No answer for this email' } : { ok: false, error: out.error || 'Email error' };
      if (res.ok) { sent++; r.calSeq = (r.calSeq ?? -1) + 1; r.cal = kind === 'cancel' ? '' : at; r.calErr = ''; }
      else if (kind !== 'cancel') r.calErr = res.error || 'Email error';
    });
    await regs().setJSON(e.id, doc);
    return { ok: out.ok && sent === list.length, sent, error: out.ok ? (sent < list.length ? (out.results.find((x) => !x.ok) || {}).error || 'Some emails were not sent' : '') : out.error, quota: out.quota };
  }

  async function routes({ path, method, body, req, auth }) {
    /* ---------- public ---------- */
    let m = path.match(/^\/img\/([a-f0-9]{24})$/);
    if (m && method === 'GET') {
      const img = await images().get(m[1], { type: 'json' });
      if (!img) return new Response('Not found', { status: 404 });
      return new Response(Buffer.from(img.data, 'base64'), { status: 200, headers: { 'content-type': img.type, 'cache-control': 'public, max-age=31536000, immutable' } });
    }
    if (path === '/events' && method === 'GET') {
      const now = Date.now(); const list = (await all()).filter((e) => e.published);
      const out = []; for (const e of list) out.push(publicEvent(e, await getRegs(e.id)));
      const upcoming = out.filter((e) => e.state !== 'ended').sort((a, b) => a.startUTC - b.startUTC);
      const past = out.filter((e) => e.state === 'ended').sort((a, b) => b.startUTC - a.startUTC).slice(0, 6);
      return json(200, { upcoming, past, now });
    }
    m = path.match(/^\/events\/([a-z0-9-]{1,80})$/);
    if (m && method === 'GET') {
      const e = await bySlug(m[1]);
      if (!e || !e.published) return json(404, { error: 'Event not found.' });
      return json(200, { event: publicEvent(e, await getRegs(e.id)), whatsapp: (await evSettings()).whatsapp });
    }
    m = path.match(/^\/send\/([a-f0-9]{24})(?:\/([a-f0-9]{16}))?$/);
    if (m) {
      const sl = await sendList(m[1]); if (sl.error) return json(403, { error: sl.error });
      const { l, e } = sl; const rs = regs(); const doc = (await rs.get(e.id, { type: 'json' })) || { list: [] };
      const origin = new URL(req.url).origin;
      if (!m[2] && method === 'GET') {
        const people = [];
        for (const id of l.ids) { const r = doc.list.find((x) => x.id === id); if (!r) continue; if (await ensureTk(e, r)) await rs.setJSON(e.id, doc);
          people.push({ id: r.id, name: nameCase(r.name), ref: r.ref, phone: r.phone, whatsapp: r.whatsapp || r.phone, seats: r.seats || 1, role: r.role || '', ok: calOk(r), status: r.status, badge: calOk(r) && e.mode !== 'online' ? `${origin}/badge/${r.tk}` : '', sent: (l.sent[id] || {}).at || '' }); }
        return json(200, { list: { name: l.name, msg: l.msg }, event: { title: e.title, slug: e.slug, mode: e.mode, when: whenText(e), venue: e.mode === 'online' ? 'Online' : e.locationName || '', mapUrl: e.mode === 'offline' ? e.mapUrl || '' : '', join: e.mode === 'online' ? e.onlineUrl || '' : '', page: `${origin}/events/${e.slug}` }, people });
      }
      if (m[2] && method === 'POST') {
        if (!l.ids.includes(m[2])) return json(404, { error: 'This person is not on this list.' });
        const r = doc.list.find((x) => x.id === m[2]); if (!r) return json(404, { error: 'Registration not found.' });
        const at = body.sent ? new Date().toISOString() : '';
        if (at) l.sent[m[2]] = { at }; else delete l.sent[m[2]];
        await sendlists().setJSON(l.key, l);
        r.wa = at ? { at, by: l.name } : null; await rs.setJSON(e.id, doc);
        return json(200, { sent: at });
      }
      return json(405, { error: 'Not allowed.' });
    }
    m = path.match(/^\/staff\/([a-f0-9]{24})(?:\/badge\/([a-f0-9]{20}))?$/);
    if (m) {
      const st = await staffEvent(m[1]); if (st.error) return json(403, { error: st.error });
      const e = st.e;
      if (!m[2] && method === 'GET') {
        const list = await getRegs(e.id);
        return json(200, { event: { id: e.id, title: e.title, slug: e.slug, start: e.start, end: e.end || '', tz: e.tz, tzLabel: (TZS[e.tz] || TZS['Asia/Kolkata']).label, locationName: e.locationName || '', mode: e.mode },
          regs: list.map((r) => ({ id: r.id, tk: r.tk, ref: r.ref, name: nameCase(r.name), role: r.role || '', seats: r.seats || 1, status: r.status, attended: r.attended || '', phone: '••• ' + p4(r), p4: p4(r) })) });
      }
      if (m[2]) {
        const f = await byBadge(m[2]);
        if (!f) return json(404, { error: 'This QR code is not an Aqlyon badge, or the registration was deleted.' });
        if (f.e.id !== e.id) return json(409, { error: `This badge is for another event: ${f.e.title}.` });
        if (method === 'POST') {
          if (body.attended && !calOk(f.r)) return json(409, { error: f.r.status === 'pending' ? 'Not approved yet: this person is still waiting for approval.' : `This registration is ${f.r.status}.` });
          f.r.attended = body.attended ? (f.r.attended || new Date().toISOString()) : '';
          f.r.checkedBy = body.attended ? 'helper link' : '';
          await regs().setJSON(f.e.id, f.doc);
        }
        return json(200, staffView(checkinInfo(f.e, f.doc, f.r)));
      }
      return json(405, { error: 'Not allowed.' });
    }
    m = path.match(/^\/events\/([a-z0-9-]{1,80})\/upload$/);
    if (m && method === 'POST') {
      const e = await bySlug(m[1]);
      if (!e || !e.published || e.regMode !== 'form' || regState(e, await getRegs(e.id)) !== 'open') return json(404, { error: 'Registration for this event is not open.' });
      if (!formOf(e).fields.some((f) => f.type === 'file')) return json(400, { error: 'This form does not take files.' });
      const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
      const type = okTypes.includes(body.type) ? body.type : '';
      const data = String(body.data || ''); const size = Math.floor(data.length * 3 / 4);
      if (!type) return json(400, { error: 'Please choose a photo (JPG, PNG, WebP, HEIC) or a PDF.' });
      if (!data || size > 3 * 1024 * 1024 + 4) return json(400, { error: 'The file is larger than 3 MB.' });
      const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      const ipKey = 'evup-' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
      const rl = (await meta().get(ipKey, { type: 'json' })) || { n: 0, since: Date.now() };
      if (Date.now() - rl.since > 3600_000) { rl.n = 0; rl.since = Date.now(); }
      if (rl.n >= 20) return json(429, { error: 'Too many uploads from here. Please try again in an hour.' });
      rl.n += 1; await meta().setJSON(ipKey, rl);
      const id = crypto.randomBytes(12).toString('hex');
      await uploads().setJSON(id, { e: e.id, name: String(body.name || 'file').replace(/[^\w.\- ()]/g, '_').slice(0, 100), type, size, data, at: new Date().toISOString() });
      return json(201, { id });
    }
    m = path.match(/^\/events\/([a-z0-9-]{1,80})\/register$/);
    if (m && method === 'POST') {
      if (body.website) return json(200, { ok: true });            // honeypot: bots fill hidden fields
      const e = await bySlug(m[1]);
      if (!e || !e.published) return json(404, { error: 'Event not found.' });
      const store = regs(); const doc = (await store.get(e.id, { type: 'json' })) || { list: [] };
      const st = regState(e, doc.list);
      if (e.regMode !== 'form') return json(400, { error: 'Registration for this event happens on another page.' });
      if (st !== 'open') return json(409, { error: st === 'full' ? 'Sorry, this event is fully booked.' : st === 'ended' ? 'This event has already ended.' : 'Registration for this event is closed.' });
      const name = nameCase(String(body.name || '').slice(0, 120)).slice(0, 80);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 80);
      const phone = String(body.phone || '').trim().slice(0, 24);
      const country = String(body.country || '').trim().toUpperCase().slice(0, 2);
      const whatsapp = String(body.whatsapp || '').trim().slice(0, 24);
      const education = EDUCATION.includes(body.education) ? body.education : '';
      const role = ROLES.includes(body.role) ? body.role : '';
      const seats = Math.min(e.maxSeats || 1, Math.max(1, parseInt(body.seats, 10) || 1));
      if (!name) return json(400, { error: 'Please enter your name.' });
      if (!EMAIL_RE.test(email)) return json(400, { error: 'Please enter a valid email address.' });
      if (!/^\+\d{1,4} \d{6,14}$/.test(phone)) return json(400, { error: 'Please enter a valid mobile number.' });
      const form = formOf(e), std = form.std;
      if (std.whatsapp && !/^\+\d{1,4} \d{6,14}$/.test(whatsapp)) return json(400, { error: 'Please enter a valid WhatsApp number.' });
      if (std.country && !/^[A-Z]{2}$/.test(country)) return json(400, { error: 'Please choose your country.' });
      if (std.education && !education) return json(400, { error: 'Please choose your education level.' });
      if (std.role && !role) return json(400, { error: 'Please choose whether you are a student or a parent.' });
      const uploadsUsed = [];
      const chk = await checkAnswers(form, body.answers, async (id) => {
        if (!/^[a-f0-9]{24}$/.test(id)) return null;
        const u = await uploads().get(id, { type: 'json' });
        if (!u || u.e !== e.id || u.used) return null;
        uploadsUsed.push(id); return { id, name: u.name, type: u.type, size: u.size };
      });
      if (chk.error) return json(400, { error: chk.error });
      if (e.capacity && seatsTaken(doc.list) + seats > e.capacity) return json(409, { error: `Only ${e.capacity - seatsTaken(doc.list)} seat(s) left.` });
      const dup = doc.list.find((r) => r.status !== 'cancelled' && r.status !== 'rejected' && (r.email === email || r.phone === phone));
      if (dup) return json(409, { error: 'You are already registered for this event with this email or mobile number.', ref: dup.ref });
      const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      const ipKey = 'evreg-' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
      const rl = (await meta().get(ipKey, { type: 'json' })) || { n: 0, since: Date.now() };
      if (Date.now() - rl.since > 3600_000) { rl.n = 0; rl.since = Date.now(); }
      if (rl.n >= 10) return json(429, { error: 'Too many registrations from here. Please try again in an hour.' });
      rl.n += 1; await meta().setJSON(ipKey, rl);
      const ref = 'AQ-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const r = { id: crypto.randomBytes(8).toString('hex'), ref, name, email, phone, whatsapp: std.whatsapp ? whatsapp : '', country: std.country ? country : '', education: std.education ? education : '', role: std.role ? role : '', answers: chk.answers, seats, status: e.paid ? 'pending' : 'confirmed', at: new Date().toISOString() };
      await ensureTk(e, r);
      doc.list.push(r); await store.setJSON(e.id, doc);
      for (const id of uploadsUsed) { const u = await uploads().get(id, { type: 'json' }); if (u) { u.used = r.id; await uploads().setJSON(id, u); } }
      const s = await evSettings();
      const origin = new URL(req.url).origin;
      const cal = calOk(r) ? await calGuests(e, doc, [r], 'invite', origin) : null;
      // free online events: the joining link is shown right away; paid ones get it after approval
      return json(201, { ref, status: r.status, seats, total: e.paid ? e.price * seats : 0, currency: e.currency || 'AED', onlineUrl: !e.paid && e.mode === 'online' ? e.onlineUrl || '' : '', whatsapp: s.whatsapp, calendar: !!(cal && cal.ok), badge: calOk(r) ? `/badge/${r.tk}` : '' });
    }

    /* ---------- admin ---------- */
    if (!path.startsWith('/admin/')) return null;
    if (!path.startsWith('/admin/events') && !path.startsWith('/admin/checkin/') && !path.startsWith('/admin/uploads/') && path !== '/admin/upload') return null;
    if (!auth || auth.r !== 'admin') return json(401, { error: 'Admin login needed.' });

    if (path === '/admin/upload' && method === 'POST') {
      const type = ['image/webp', 'image/jpeg', 'image/png'].includes(body.type) ? body.type : '';
      const data = String(body.data || '');
      if (!type || !data || data.length > 2_400_000) return json(400, { error: 'Please choose a JPG, PNG or WebP image (up to about 1.5 MB).' });
      const id = crypto.randomBytes(12).toString('hex');
      await images().setJSON(id, { type, data, at: new Date().toISOString() });
      return json(201, { id, url: `/api/img/${id}` });
    }
    if (path === '/admin/events/settings') {
      const all2 = (await meta().get('settings', { type: 'json' })) || {};
      if (method === 'PATCH') {
        const cur = await rawSettings(); cur.whatsapp = cur.whatsapp || '+971509693948';
        if (body.calUrl !== undefined) { const u = String(body.calUrl).trim(); if (u && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) return json(400, { error: 'Paste the Web app URL from Apps Script. It starts with https://script.google.com/macros/s/ and ends with /exec' }); cur.calUrl = u; if (!u) cur.calEmail = ''; }
        if (body.whatsapp !== undefined) { const w = String(body.whatsapp).replace(/[^\d+]/g, ''); if (!/^\+\d{8,15}$/.test(w)) return json(400, { error: 'WhatsApp number: include the country code, like +971509693948.' }); cur.whatsapp = w; }
        if (body.waMsg !== undefined) cur.waMsg = waText(body.waMsg);              // common WhatsApp message, in-person events
        if (body.waMsgOnline !== undefined) cur.waMsgOnline = waText(body.waMsgOnline); // and online events
        if (!cur.calSecret) cur.calSecret = crypto.randomBytes(18).toString('base64url');
        if (body.calUrl) { const t = await calPost(cur, { action: 'ping' }); if (!t.ok) return json(400, { error: 'The link was not saved. ' + (t.error || 'The script did not answer.') }); if (t.version !== 2) return json(400, { error: 'This is the old script. Copy the new code from this window into Apps Script, run authorize, then Deploy → Manage deployments → Edit → New version → Deploy.' }); cur.calEmail = t.email || ''; cur.calQuota = t.quota; cur.calV2 = true; }
        all2.events = cur; await meta().setJSON('settings', all2);
        return json(200, adminSettings(cur));
      }
      if (method === 'POST' && body.action === 'test') { const cur = await rawSettings(); const t = await calPost(cur, { action: 'ping' }); if (t.ok && t.version !== 2) return json(400, { error: 'Apps Script still runs the old code. Paste the new code, run authorize, then Deploy → Manage deployments → Edit → New version → Deploy.' }); return t.ok ? json(200, { ok: true, email: t.email || '', quota: t.quota }) : json(400, { error: t.error || 'The script did not answer.' }); }
      const cur = await rawSettings();
      if (!cur.calSecret) { cur.calSecret = crypto.randomBytes(18).toString('base64url'); all2.events = { ...cur }; await meta().setJSON('settings', all2); }
      return json(200, adminSettings(cur));
    }
    if (path === '/admin/events' && method === 'GET') {
      const out = [];
      for (const e of await all()) { const list = await getRegs(e.id); out.push({ ...e, state: regState(e, list), counts: { total: list.length, seats: seatsTaken(list), pending: list.filter((r) => r.status === 'pending').length, attended: list.filter((r) => calOk(r) && r.attended).reduce((t, r) => t + (r.seats || 1), 0) } }); }
      out.sort((a, b) => toUTC(b.start, b.tz) - toUTC(a.start, a.tz));
      return json(200, { events: out, settings: adminSettings(await rawSettings()) });
    }
    if (path === '/admin/events' && method === 'POST') {
      const e = clean({ tz: 'Asia/Dubai', mode: 'offline', regMode: 'form', regOpen: true, published: true, currency: 'AED', maxSeats: 1, ...body });
      const err = validate(e); if (err) return json(400, { error: err });
      e.id = crypto.randomBytes(8).toString('hex');
      const used = new Set((await all()).map((x) => x.slug)); let slug = slugify(e.title); let n = 2; while (used.has(slug)) slug = `${slugify(e.title)}-${n++}`;
      e.slug = slug; e.createdAt = new Date().toISOString();
      await events().setJSON(e.id, e);
      return json(201, { event: e });
    }
    m = path.match(/^\/admin\/uploads\/([a-f0-9]{24})$/);
    if (m && method === 'GET') {
      const u = await uploads().get(m[1], { type: 'json' });
      if (!u) return json(404, { error: 'File not found.' });
      return new Response(Buffer.from(u.data, 'base64'), { status: 200, headers: { 'content-type': u.type, 'content-disposition': `inline; filename="${u.name.replace(/"/g, '')}"`, 'cache-control': 'private, no-store' } });
    }
    m = path.match(/^\/admin\/checkin\/([a-f0-9]{20})$/);
    if (m) {
      const f = await byBadge(m[1]);
      if (!f) return json(404, { error: 'This QR code is not an Aqlyon badge, or the registration was deleted.' });
      if (method === 'POST') {
        if (body.attended && !calOk(f.r)) return json(409, { error: f.r.status === 'pending' ? 'Not approved yet: this person is still waiting for approval.' : `This registration is ${f.r.status}.`, ...checkinInfo(f.e, f.doc, f.r) });
        const already = !!f.r.attended;
        f.r.attended = body.attended ? (f.r.attended || new Date().toISOString()) : '';
        f.r.checkedBy = body.attended ? 'admin' : '';
        await regs().setJSON(f.e.id, f.doc);
        return json(200, { ...checkinInfo(f.e, f.doc, f.r), already: body.attended && already });
      }
      return json(200, checkinInfo(f.e, f.doc, f.r));
    }
    m = path.match(/^\/admin\/events\/([a-f0-9]{16})\/sendlists(?:\/([a-f0-9]{24}))?$/);
    if (m) {
      const e = await events().get(m[1], { type: 'json' }); if (!e) return json(404, { error: 'Event not found.' });
      const doc = (await regs().get(e.id, { type: 'json' })) || { list: [] };
      const keys = e.sendLists || [];
      if (!m[2] && method === 'GET') { const out = []; for (const k of keys) { const l = await sendlists().get(k, { type: 'json' }); if (l) out.push(slSummary(l, doc)); } return json(200, { lists: out.reverse() }); }
      if (!m[2] && method === 'POST') {
        const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []))].filter((id) => doc.list.some((r) => r.id === id && calOk(r))).slice(0, 1000);
        if (!ids.length) return json(400, { error: 'Select confirmed people first. Only confirmed or approved people get a confirmation message.' });
        const l = { key: crypto.randomBytes(12).toString('hex'), e: e.id, name: String(body.name || '').trim().slice(0, 60) || `List ${keys.length + 1}`, msg: String(body.msg || '').slice(0, 1500), ids, on: true, sent: {}, createdAt: new Date().toISOString() };
        await sendlists().setJSON(l.key, l); e.sendLists = [...keys, l.key]; await events().setJSON(e.id, e);
        return json(201, slSummary(l, doc));
      }
      if (m[2]) {
        if (!keys.includes(m[2])) return json(404, { error: 'List not found.' });
        const l = await sendlists().get(m[2], { type: 'json' }); if (!l) return json(404, { error: 'List not found.' });
        if (method === 'PATCH') { if (body.on !== undefined) l.on = !!body.on; if (body.name !== undefined) l.name = String(body.name).trim().slice(0, 60) || l.name; if (body.msg !== undefined) l.msg = String(body.msg).slice(0, 1500); await sendlists().setJSON(l.key, l); return json(200, slSummary(l, doc)); }
        if (method === 'DELETE') { await sendlists().delete(l.key); e.sendLists = keys.filter((k) => k !== l.key); await events().setJSON(e.id, e); return json(200, { ok: true }); }
      }
      return json(405, { error: 'Not allowed.' });
    }
    m = path.match(/^\/admin\/events\/([a-f0-9]{16})\/staff$/);
    if (m && method === 'POST') {
      const e = await events().get(m[1], { type: 'json' }); if (!e) return json(404, { error: 'Event not found.' });
      if (body.on) {
        if (!e.staffKey || body.reset) {
          if (e.staffKey) await meta().delete('staff-' + e.staffKey);
        for (const k of e.sendLists || []) await sendlists().delete(k);
          e.staffKey = crypto.randomBytes(12).toString('hex');
          await meta().setJSON('staff-' + e.staffKey, { e: e.id });
        }
        e.staffOn = true;
      } else e.staffOn = false;
      await events().setJSON(e.id, e);
      return json(200, { on: e.staffOn, key: e.staffKey || '' });
    }
    m = path.match(/^\/admin\/events\/([a-f0-9]{16})(\/regs(?:\/([a-f0-9]{16}))?)?$/);
    if (m) {
      const store = events(); const e = await store.get(m[1], { type: 'json' });
      if (!e) return json(404, { error: 'Event not found.' });
      if (m[2] && m[2].startsWith('/regs')) {
        const rs = regs(); const doc = (await rs.get(e.id, { type: 'json' })) || { list: [] };
        if (!m[3] && method === 'GET') {
          let changed = false; for (const r of doc.list) { if (await ensureTk(e, r)) changed = true; const nm = nameCase(r.name); if (nm && nm !== r.name) { r.name = nm; changed = true; } } // names written one way
          if (changed) await rs.setJSON(e.id, doc);
          return json(200, { regs: doc.list, calendar: !!(await rawSettings()).calUrl });
        }
        // import people from a spreadsheet (they arrive as "imported, not confirmed yet")
        if (!m[3] && method === 'POST' && body.action === 'import') {
          const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
          const form = formOf(e); const qids = new Set(form.fields.map((f) => f.id));
          const seenE = new Set(doc.list.filter((r) => !['rejected', 'cancelled'].includes(r.status)).map((r) => r.email));
          const seenP = new Set(doc.list.filter((r) => !['rejected', 'cancelled'].includes(r.status)).map((r) => r.phone));
          const added = [], skipped = [];
          for (const [i, x] of rows.entries()) {
            const name = nameCase(String(x.name || '').slice(0, 120)).slice(0, 80), email = String(x.email || '').trim().toLowerCase().slice(0, 80), phone = String(x.phone || '').trim().slice(0, 24);
            const why = !name ? 'No name' : !EMAIL_RE.test(email) ? 'Email missing or not valid' : !/^\+\d{1,4} \d{5,14}$/.test(phone) ? 'Mobile missing or not valid' : seenE.has(email) ? 'Already registered (same email)' : seenP.has(phone) ? 'Already registered (same mobile)' : '';
            if (why) { skipped.push({ row: x.row ?? i + 1, name, reason: why }); continue; }
            seenE.add(email); seenP.add(phone);
            const answers = {};
            for (const [k, v] of Object.entries(x.answers || {})) if (qids.has(k) && v !== '' && v != null) answers[k] = Array.isArray(v) ? v.map((y) => String(y).slice(0, 220)).slice(0, 60) : String(v).slice(0, 2000);
            const r = { id: crypto.randomBytes(8).toString('hex'), ref: 'AQ-' + crypto.randomBytes(3).toString('hex').toUpperCase(), name, email, phone,
              whatsapp: /^\+\d{1,4} \d{5,14}$/.test(String(x.whatsapp || '')) ? String(x.whatsapp) : '', country: /^[A-Z]{2}$/.test(String(x.country || '')) ? x.country : '',
              education: EDUCATION.includes(x.education) ? x.education : String(x.education || '').slice(0, 40), role: ROLES.includes(x.role) ? x.role : '',
              answers, seats: Math.min(20, Math.max(1, parseInt(x.seats, 10) || 1)), status: 'pending', source: 'import', at: new Date().toISOString() };
            await ensureTk(e, r); doc.list.push(r); added.push(r.id);
          }
          await rs.setJSON(e.id, doc);
          return json(200, { added: added.length, skipped, regs: doc.list });
        }
        // the same change for many people at once (confirm, reject, cancel, check in, delete)
        if (!m[3] && method === 'POST' && body.action === 'bulk') {
          const ids = new Set(Array.isArray(body.ids) ? body.ids : []); const op = body.op; let n = 0, skipped = 0;
          const okStatus = e.paid ? 'approved' : 'confirmed';
          const toCancel = [];
          if (op === 'delete') { const before = doc.list.length; doc.list = doc.list.filter((r) => !ids.has(r.id)); n = before - doc.list.length; }
          else for (const r of doc.list) {
            if (!ids.has(r.id)) continue;
            if (op === 'confirm') { if (calOk(r)) { skipped++; continue; } r.status = okStatus; }
            else if (op === 'reject' || op === 'cancel') { if (calOk(r) && r.cal) toCancel.push(r); r.status = op === 'reject' ? 'rejected' : 'cancelled'; }
            else if (op === 'checkin') { if (!calOk(r)) { skipped++; continue; } r.attended = r.attended || new Date().toISOString(); r.checkedBy = r.checkedBy || 'admin'; }
            else if (op === 'uncheckin') r.attended = '';
            else continue;
            r.updatedAt = new Date().toISOString(); n++;
          }
          await rs.setJSON(e.id, doc);
          // people who had an invitation get a cancellation email (first 20; the rest keep their calendar entry)
          if (toCancel.length) await calGuests(e, doc, toCancel.slice(0, 20), 'cancel', new URL(req.url).origin);
          return json(200, { changed: n, skipped, regs: doc.list });
        }
        if (!m[3] && method === 'POST' && body.action === 'invite-all') {
          const skip = new Set(body.skip || []);   // ones that already failed in this round
          const all = doc.list.filter((r) => calOk(r) && !r.cal && !skip.has(r.id)), todo = all.slice(0, 10);
          if (!todo.length) return json(200, { ok: true, invited: 0, left: 0, regs: doc.list });
          const out = await calGuests(e, doc, todo, 'invite', new URL(req.url).origin);
          if (!out) return json(400, { error: 'Connect calendar invitations first (Events → Connect).' });
          return json(200, { ok: out.ok, invited: out.sent, failed: todo.filter((r) => !r.cal).map((r) => r.id), left: all.length - todo.length, error: out.error || '', quota: out.quota, regs: doc.list });
        }
        const r = doc.list.find((x) => x.id === m[3]);
        if (!r) return json(404, { error: 'Registration not found.' });
        if (method === 'PATCH') {
          const was = calOk(r);
          if (['pending', 'approved', 'confirmed', 'rejected', 'cancelled'].includes(body.status)) r.status = body.status;
          if (body.attended !== undefined) { if (body.attended && !calOk(r)) return json(409, { error: 'Only confirmed or approved people can be checked in.' }); r.attended = body.attended ? (r.attended || new Date().toISOString()) : ''; }
          await ensureTk(e, r);
          r.updatedAt = new Date().toISOString(); await rs.setJSON(e.id, doc);
          let cal = null;
          if (!was && calOk(r)) cal = await calGuests(e, doc, [r], 'invite', new URL(req.url).origin);
          else if (was && !calOk(r) && r.cal) cal = await calGuests(e, doc, [r], 'cancel', new URL(req.url).origin);
          return json(200, { reg: r, onlineUrl: e.onlineUrl || '', calendar: cal ? (cal.ok ? 'ok' : cal.error) : '' });
        }
        if (method === 'DELETE') { doc.list = doc.list.filter((x) => x.id !== r.id); await rs.setJSON(e.id, doc); return json(200, { ok: true }); }
      }
      if (!m[2] && method === 'PATCH') {
        const n = clean(body, e); const err = validate(n); if (err) return json(400, { error: err });
        n.updatedAt = new Date().toISOString(); await store.setJSON(e.id, n);
        // keep the calendar invitation in step: new name, time or place is sent to every guest
        let cal = '';
        const keys = ['title', 'start', 'end', 'tz', 'mode', 'locationName', 'mapUrl', 'onlineUrl', 'summary'];
        if (keys.some((k) => (e[k] || '') !== (n[k] || ''))) {
          const doc = (await regs().get(e.id, { type: 'json' })) || { list: [] };
          const invited = doc.list.filter((r) => calOk(r) && r.cal);
          if (invited.length) { const c = await calGuests(n, doc, invited.slice(0, 25), 'update', new URL(req.url).origin); cal = c && c.ok ? 'ok' : (c && c.error) || 'Email error'; }
        }
        return json(200, { event: n, calendar: cal });
      }
      if (!m[2] && method === 'DELETE') {
        for (const r of await getRegs(e.id)) for (const v of Object.values(r.answers || {})) if (v && v.id && v.size !== undefined) await uploads().delete(v.id);
        if (e.staffKey) await meta().delete('staff-' + e.staffKey);
        await store.delete(e.id); await regs().delete(e.id); if (e.cover) await images().delete(e.cover); if (e.badge && e.badge.logo) await images().delete(e.badge.logo); return json(200, { ok: true }); }
    }
    return null;
  }

  // Badge page: what the participant shows at the entrance (QR code for the admin check-in)
  async function badge(tk, origin) {
    const f = tk === 'preview' ? null : await byBadge(tk);
    const head = (t) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(t)}</title><meta name="robots" content="noindex"><link rel="icon" href="/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/site/site.css"><link rel="stylesheet" href="/site/badge.css"></head>`;
    if (tk === 'preview') return new Response(`${head('Badge preview')}<body class="bdgpage pv"><main class="bdgwrap" id="badge"></main><script src="/js/vendor/qrcode.js"></script><script src="/site/badge.js"></script></body></html>`, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } });
    if (!f) return new Response(`${head('Badge not found')}<body class="bdgpage"><main class="bdgwrap"><div class="bdgmsg"><h1>Badge not found</h1><p>Check the link, or contact Aqlyon Brand Management.</p><p><a class="btn" href="/#events">See upcoming events</a></p></div></main></body></html>`, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    const { e, r } = f;
    const pe = publicEvent(e, f.doc.list);
    const data = { design: badgeDesign(e), tk: r.tk, qr: `${origin}/manage#checkin/${r.tk}`, name: nameCase(r.name), role: r.role || '', seats: r.seats || 1, ref: r.ref, status: r.status, valid: calOk(r), attended: r.attended || '',
      event: { title: e.title, slug: e.slug, start: e.start, end: e.end || '', tz: e.tz, tzLabel: pe.tzLabel, startUTC: pe.startUTC, endUTC: pe.endUTC, mode: e.mode, locationName: e.locationName || '', mapUrl: e.mapUrl || '', cover: pe.cover } };
    return new Response(`${head(`${r.name} · ${e.title} · Badge`)}<body class="bdgpage"><main class="bdgwrap" id="badge"></main>
<script>window.BADGE=${JSON.stringify(data).replace(/</g, '\\u003c')};</script><script src="/js/vendor/qrcode.js"></script><script src="/site/badge.js"></script></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }

  // Shareable event page with link-preview tags (WhatsApp, Facebook, LinkedIn show the cover and title)
  async function page(slug, origin) {
    const e = await bySlug(slug);
    if (!e || !e.published) return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event not found</title><body style="font-family:Inter,system-ui,sans-serif;padding:40px;text-align:center;background:#F2F3EF;color:#0B0B0B"><h1>Event not found</h1><p><a href="/events/">See upcoming events</a></p>`, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    const pe = publicEvent(e, await getRegs(e.id));
    const desc = (e.summary || e.details || '').replace(/\s+/g, ' ').slice(0, 200);
    const img = pe.cover ? origin + pe.cover : origin + '/img/og-default.png';
    const url = `${origin}/events/${e.slug}`;
    const ld = { '@context': 'https://schema.org', '@type': 'Event', name: e.title, description: desc, image: [img], startDate: new Date(pe.startUTC).toISOString(), ...(pe.endUTC ? { endDate: new Date(pe.endUTC).toISOString() } : {}),
      eventAttendanceMode: e.mode === 'online' ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
      location: e.mode === 'online' ? { '@type': 'VirtualLocation', url } : { '@type': 'Place', name: e.locationName, address: e.locationName },
      organizer: { '@type': 'Organization', name: 'Aqlyon Brand Management', url: origin },
      offers: { '@type': 'Offer', price: e.paid ? e.price : 0, priceCurrency: e.currency || 'AED', url, availability: pe.state === 'open' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut' } };
    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(e.title)} · Aqlyon Brand Management</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Aqlyon Brand Management">
<meta property="og:title" content="${esc(e.title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/site/site.css"><link rel="stylesheet" href="/site/events.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head><body class="evpage">
<header class="evtop"><a class="brand dmbrand" href="/" aria-label="Aqlyon Brand Management, home"><img src="/img/aqlyon-q.png" alt="" width="34" height="36"><span><b>Aqlyon</b><small>Brand Management</small></span></a><a class="evback" href="/events/">All events</a></header>
<main id="ev" data-slug="${esc(e.slug)}"><noscript><h1>${esc(e.title)}</h1><p>${esc(desc)}</p></noscript></main>
<script>window.EVENT=${JSON.stringify(pe).replace(/</g, '\\u003c')};</script>
<script src="/js/countries.js"></script><script src="/js/form-fields.js"></script><script src="/site/events.js"></script>
</body></html>`;
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  return { routes, page, badge };
}
