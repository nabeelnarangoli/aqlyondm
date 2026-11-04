// API for the aqlyondm.com event module (events, registrations, badges, check-in).
// The event logic itself is in events.mjs, shared with the Aqlyon Career Discovery Centre site.
// Storage is any object with get(key,{type:'json'}), setJSON(key,value), delete(key), list() — Netlify Blobs in production.
import crypto from 'node:crypto';
import { createEvents } from './events.mjs';
import { createSeo } from './seo.mjs';
import { createPlans } from './plans.mjs';
import { whenText } from './invite-mail.mjs';

const MAX_BODY = 300_000;
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

export function createHandler({ getStore, env }) {
  const cfg = () => {
    const e = env();
    const admin = e.ADMIN_PASSWORD || '';
    const secret = e.SESSION_SECRET || (admin ? crypto.createHash('sha256').update('dm-session:' + admin).digest('hex') : '');
    return { admin, secret };
  };
  const sign = (payload, secret) => {
    const body = b64u(JSON.stringify(payload));
    const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${mac}`;
  };
  const verify = (token, secret) => {
    if (!token || !token.includes('.')) return null;
    const [body, mac] = token.split('.');
    const want = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString());
      if (!p.exp || p.exp < Date.now()) return null;
      return p;
    } catch { return null; }
  };

  const EV = createEvents({ getStore, json });
  const SEO = createSeo({ getStore, json, env });
  const PL = createPlans({ getStore, json, eventsStore: () => getStore('events'), whenText });

  return async function handle(req) {
    const { admin, secret } = cfg();
    if (!admin) return json(500, { error: 'The server is not set up yet. Add an ADMIN_PASSWORD environment variable in Netlify and redeploy.' });

    const url = new URL(req.url);
    const pm = url.pathname.match(/^\/events\/([a-z0-9-]{1,80})\/?$/);
    if (pm && req.method === 'GET') return EV.page(pm[1], url.origin);
    const bm = url.pathname.match(/^\/badge\/([a-f0-9]{20}|preview)\/?$/);
    if (bm && req.method === 'GET') return EV.badge(bm[1], url.origin);

    const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();
    const meta = getStore('meta');

    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const text = await req.text();
      const limit = path === '/admin/upload' ? 2_600_000 : /^\/events\/[a-z0-9-]+\/upload$/.test(path) ? 4_400_000 : path.startsWith('/admin/events') ? 2_000_000 : MAX_BODY;
      if (text.length > limit) return json(413, { error: 'Too much data.' });
      try { body = text ? JSON.parse(text) : {}; } catch { return json(400, { error: 'Invalid JSON.' }); }
    }
    const auth = verify((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), secret);

    try {
      if (path === '/admin/login' && method === 'POST') {
        const att = (await meta.get('admin-attempts', { type: 'json' })) || { fails: 0, lockUntil: 0 };
        if (att.lockUntil > Date.now()) return json(429, { error: 'Too many wrong tries. Wait 5 minutes.' });
        if (!safeEqual(body.password || '', admin)) {
          att.fails += 1;
          if (att.fails >= 6) { att.lockUntil = Date.now() + 5 * 60_000; att.fails = 0; }
          await meta.setJSON('admin-attempts', att);
          return json(401, { error: 'Wrong admin password.' });
        }
        await meta.setJSON('admin-attempts', { fails: 0, lockUntil: 0 });
        return json(200, { token: sign({ r: 'admin', exp: Date.now() + (body.remember ? 14 * 864e5 : 12 * 36e5) }, secret) });
      }
      if (path.startsWith('/seo/')) {
        if (!auth || auth.r !== 'admin') return json(401, { error: 'Admin login needed.' });
        const r = await SEO.routes({ path, method, body: method === 'GET' ? Object.fromEntries(url.searchParams) : body });
        if (r) return r;
      }
      const plr = await PL.routes({ path, method, body, auth });   // event planner: checklists + program chart
      if (plr) return plr;
      const evr = await EV.routes({ path, method, body, req, auth });
      if (evr && method === 'DELETE' && evr.status === 200 && /^\/admin\/events\/[a-f0-9]{16}$/.test(path)) await PL.remove(path.split('/').pop());
      if (evr) return evr;
      return json(404, { error: 'Not found.' });
    } catch (err) {
      console.error(err);
      return json(500, { error: 'Something went wrong on the server. Please try again.' });
    }
  };
}
