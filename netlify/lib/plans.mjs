// Event planner: preparation checklists (category → subheading → numbered items) and a program chart
// (start time + items with durations). One document per event in the "plans" store.
// The organiser shares the checklists and the program chart as two separate links (/plan#<key>); on the checklist link
// the team can tick items off if allowed.
import crypto from 'node:crypto';

const newId = () => crypto.randomBytes(5).toString('hex');
const okId = (s) => (/^[a-z0-9]{6,16}$/.test(s || '') ? s : newId());
const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cleanPlan(b = {}) {
  const checklists = (Array.isArray(b.checklists) ? b.checklists : []).slice(0, 30).map((c) => ({
    id: okId(c && c.id), title: txt(c && c.title, 100),
    groups: (Array.isArray(c && c.groups) ? c.groups : []).slice(0, 40).map((g) => ({
      id: okId(g && g.id), title: txt(g && g.title, 100),
      items: (Array.isArray(g && g.items) ? g.items : []).slice(0, 150).map((i) => ({
        id: okId(i && i.id), text: txt(i && i.text, 300), who: txt(i && i.who, 60),
        done: !!(i && i.done), by: txt(i && i.by, 60), t: Math.max(0, Number(i && i.t) || 0),
      })),
    })),
  }));
  const p = b.program || {};
  const program = {
    start: TIME.test(p.start || '') ? p.start : '',
    items: (Array.isArray(p.items) ? p.items : []).slice(0, 120).map((i) => ({
      id: okId(i && i.id), title: txt(i && i.title, 160), dur: Math.min(720, Math.max(0, parseInt(i && i.dur, 10) || 0)),
      who: txt(i && i.who, 100), note: txt(i && i.note, 200),
    })),
  };
  return { checklists, program };
}
const eachItem = (plan, fn) => { for (const c of plan.checklists || []) for (const g of c.groups || []) for (const i of g.items || []) fn(i); };

export function createPlans({ getStore, json, eventsStore, whenText }) {
  const plans = () => getStore('plans');
  const meta = () => getStore('meta');
  const load = async (id) => (await plans().get(id, { type: 'json' })) || { checklists: [], program: { start: '', items: [] }, share: { key: '', on: false, tick: true } };
  const pub = (p) => ({ checklists: p.checklists, program: p.program, updatedAt: p.updatedAt || '' });

  // two separate team links: the checklists (people can tick items off) and the program chart (view only)
  const SHARE_KEY = { lists: 'share', program: 'shareProg' };
  const blankShare = (kind) => ({ key: '', on: false, tick: kind === 'lists' });
  const shares = (p) => ({ lists: p.share || blankShare('lists'), program: p.shareProg || blankShare('program') });
  async function shared(key) {
    if (!/^[a-f0-9]{24}$/.test(key)) return { error: 'This planner link is not valid.' };
    const ix = await meta().get('plan-' + key, { type: 'json' });
    if (!ix) return { error: 'This planner link is not valid. Ask the organiser for the current link.' };
    const e = await eventsStore().get(ix.e, { type: 'json' });
    const p = e && (await load(e.id));
    const kind = ix.k === 'program' ? 'program' : 'lists', sh = p && p[SHARE_KEY[kind]];
    if (!e || !sh || !sh.on || sh.key !== key) return { error: 'This link has been turned off or replaced. Ask the organiser for the current link.' };
    return { e, p, kind, sh };
  }
  const evInfo = (e) => ({ title: e.title, start: e.start, when: whenText ? whenText(e) : e.start, venue: e.mode === 'offline' ? e.locationName || '' : 'Online',
    org: (e.badge && e.badge.org) || '', logo: e.badge && /^[a-f0-9]{24}$/.test(e.badge.logo || '') ? `/api/img/${e.badge.logo}` : '' });

  async function routes({ path, method, body, auth }) {
    /* ---------- team link ---------- */
    let m = path.match(/^\/plan\/([a-f0-9]{24})(?:\/item)?$/);
    if (m) {
      const s = await shared(m[1]); if (s.error) return json(403, { error: s.error });
      if (method === 'GET') {   // only the part this link is for
        const plan = s.kind === 'program' ? { program: s.p.program, checklists: [] } : { checklists: s.p.checklists, program: { start: '', items: [] } };
        return json(200, { event: evInfo(s.e), kind: s.kind, plan: { ...plan, updatedAt: s.p.updatedAt || '' }, tick: s.kind === 'lists' && s.sh.tick !== false });
      }
      if (method === 'POST' && path.endsWith('/item')) {
        if (s.kind !== 'lists' || s.sh.tick === false) return json(403, { error: 'This link is view only.' });
        let hit = null; eachItem(s.p, (i) => { if (i.id === body.id) hit = i; });
        if (!hit) return json(404, { error: 'That item was removed. Refresh the page.' });
        hit.done = !!body.done; hit.by = hit.done ? txt(body.by, 60) : ''; hit.t = Date.now();
        s.p.updatedAt = new Date().toISOString(); await plans().setJSON(s.e.id, s.p);
        return json(200, { item: hit, plan: { checklists: s.p.checklists, program: { start: '', items: [] }, updatedAt: s.p.updatedAt } });
      }
      return json(405, { error: 'Not allowed.' });
    }

    /* ---------- organiser ---------- */
    m = path.match(/^\/admin\/events\/([a-f0-9]{16})\/plan(\/share)?$/);
    if (!m) return null;
    if (!auth || auth.r !== 'admin') return json(401, { error: 'Admin login needed.' });
    const e = await eventsStore().get(m[1], { type: 'json' }); if (!e) return json(404, { error: 'Event not found.' });
    const p = await load(e.id);
    if (!m[2] && method === 'GET') return json(200, { plan: pub(p), shares: shares(p) });
    if (!m[2] && method === 'PUT') {
      const n = cleanPlan(body);
      // ticks can come from the team link while the organiser edits: for each item keep the newest tick
      const old = new Map(); eachItem(p, (i) => old.set(i.id, i));
      eachItem(n, (i) => { const o = old.get(i.id); if (o && o.t > i.t) { i.done = o.done; i.by = o.by; i.t = o.t; } });
      const next = { ...p, ...n, updatedAt: new Date().toISOString() };
      await plans().setJSON(e.id, next);
      return json(200, { plan: pub(next), shares: shares(next) });
    }
    if (m[2] && method === 'POST') {
      const kind = body.kind === 'program' ? 'program' : 'lists', field = SHARE_KEY[kind];
      const sh = p[field] || blankShare(kind);
      if (body.tick !== undefined && kind === 'lists') sh.tick = !!body.tick;
      if (body.on !== undefined) sh.on = !!body.on;
      if (sh.on && (!sh.key || body.reset)) {
        if (sh.key) await meta().delete('plan-' + sh.key);
        sh.key = crypto.randomBytes(12).toString('hex');
        await meta().setJSON('plan-' + sh.key, { e: e.id, k: kind });
      }
      p[field] = sh; await plans().setJSON(e.id, p);
      return json(200, { shares: shares(p) });
    }
    return json(405, { error: 'Not allowed.' });
  }
  async function remove(eventId) { const p = await plans().get(eventId, { type: 'json' }); if (p) for (const f of ['share', 'shareProg']) if (p[f] && p[f].key) await meta().delete('plan-' + p[f].key); await plans().delete(eventId); }
  return { routes, remove };
}
