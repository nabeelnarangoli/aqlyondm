// SEO dashboard API (/api/seo/*): Google Search Console data and the AI writing assistant.
// Admin-only. Keys are pasted in the dashboard and kept in Netlify Blobs (store "meta", key "seo-settings");
// they are never sent back to the browser. Environment variables work as a fallback.
import crypto from "node:crypto";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const AI_DAILY_LIMIT = 150;
const b64u = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
const day = (d) => new Date(d).toISOString().slice(0, 10);

export function createSeo({ getStore, json, env }) {
  const meta = () => getStore("meta");
  const raw = async () => (await meta().get("seo-settings", { type: "json" })) || {};
  const creds = async () => {
    const s = await raw(), e = env();
    let sa = s.gscCredentials || e.GSC_SERVICE_ACCOUNT || "";
    try { sa = typeof sa === "string" && sa ? JSON.parse(sa) : sa; } catch { sa = null; }
    return { sa: sa && sa.client_email && sa.private_key ? sa : null, site: s.gscSite || e.GSC_SITE_URL || "", aiKey: s.anthropicKey || e.ANTHROPIC_API_KEY || "", model: s.model || e.ANTHROPIC_MODEL || "claude-sonnet-5-5" };
  };
  const publicSettings = async () => {
    const c = await creds();
    return { gscConnected: !!(c.sa && c.site), gscEmail: c.sa ? c.sa.client_email : "", gscSite: c.site, aiConnected: !!c.aiKey, model: c.model };
  };

  /* ---------- Google Search Console ---------- */
  let tokenCache = null;
  async function gscToken(sa) {
    if (tokenCache && tokenCache.email === sa.client_email && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64u({ alg: "RS256", typ: "JWT" })}.${b64u({ iss: sa.client_email, scope: GSC_SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
    const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
    const d = await res.json();
    if (!res.ok) throw new Error("Google refused the key: " + (d.error_description || d.error || res.status));
    tokenCache = { email: sa.client_email, token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
    return d.access_token;
  }
  async function gscQuery(c, body) {
    const token = await gscToken(c.sa);
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(c.site)}/searchAnalytics/query`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) {
      const msg = d.error?.message || res.status;
      if (res.status === 403) throw new Error(`Search Console says this key has no access to ${c.site}. In Search Console → Settings → Users and permissions, add ${c.sa.client_email} (Restricted is enough). (${msg})`);
      throw new Error("Search Console: " + msg);
    }
    return d.rows || [];
  }
  async function gscReport(days) {
    const c = await creds();
    if (!c.sa || !c.site) return json(200, { connected: false });
    const end = new Date(Date.now() - 2 * 864e5);                   // Google's data is about 2 days behind
    const start = new Date(end.getTime() - (days - 1) * 864e5);
    const pEnd = new Date(start.getTime() - 864e5), pStart = new Date(pEnd.getTime() - (days - 1) * 864e5);
    const range = { startDate: day(start), endDate: day(end) };
    const [byDate, prev, queries, pages, devices, countries] = await Promise.all([
      gscQuery(c, { ...range, dimensions: ["date"], rowLimit: 500 }),
      gscQuery(c, { startDate: day(pStart), endDate: day(pEnd), rowLimit: 1 }),
      gscQuery(c, { ...range, dimensions: ["query"], rowLimit: 50 }),
      gscQuery(c, { ...range, dimensions: ["page"], rowLimit: 30 }),
      gscQuery(c, { ...range, dimensions: ["device"], rowLimit: 5 }),
      gscQuery(c, { ...range, dimensions: ["country"], rowLimit: 8 }),
    ]);
    const sum = (rows) => {
      const clicks = rows.reduce((t, r) => t + r.clicks, 0), impressions = rows.reduce((t, r) => t + r.impressions, 0);
      const position = impressions ? rows.reduce((t, r) => t + r.position * r.impressions, 0) / impressions : 0;
      return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
    };
    const row = (r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
    // "Quick wins": searches where you already show on page 2 or low page 1 with real impressions
    const wins = queries.map(row).filter((q) => q.position > 4 && q.position <= 20 && q.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 10);
    return json(200, { connected: true, site: c.site, range, current: sum(byDate), previous: sum(prev),
      daily: byDate.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position })),
      queries: queries.map(row), pages: pages.map(row), devices: devices.map(row), countries: countries.map(row), quickWins: wins });
  }

  /* ---------- AI assistant ---------- */
  const TASKS = {
    keywords: (i) => `Suggest 15 keywords this business should target on Google${i.topic ? ` around: ${i.topic}` : ""}${i.location ? `, for customers in ${i.location}` : ""}.
Mix short and long-tail phrases people really type, including local ones ("near me", city names). For each give the search intent and whether it suits a service page, a blog post or the home page.
Reply as JSON: {"keywords":[{"keyword":"","intent":"informational|commercial|local|transactional","use":"home|service|blog","why":""}],"tips":[""]}`,
    meta: (i) => `Write SEO titles and meta descriptions for this page.
URL: ${i.url || ""}
Current title: ${i.title || ""}
Current description: ${i.description || ""}
Focus keyword: ${i.keyword || "(choose the best one from the content)"}
Page text (start): ${String(i.text || "").slice(0, 3000)}
Rules: titles 50–60 characters with the keyword near the start; descriptions 140–160 characters, include the keyword once and end with a reason to click. Don't use the site name in descriptions.
Reply as JSON: {"keyword":"","titles":["","",""],"descriptions":["","",""],"notes":""}`,
    ideas: (i) => `Suggest 10 blog post ideas that would bring this business customers from Google${i.topic ? `, focused on: ${i.topic}` : ""}${i.location ? `, for readers in ${i.location}` : ""}.
Avoid topics already covered by these existing posts: ${(i.existing || []).join(" | ") || "none"}.
For each give a title (with the keyword near the start), the focus keyword, who it's for, and a 5-point outline.
Reply as JSON: {"ideas":[{"title":"","keyword":"","audience":"","outline":["","","","",""]}]}`,
    draft: (i) => `Write a complete, genuinely helpful blog post in Markdown for this business.
Title: ${i.title || i.topic || ""}
Focus keyword: ${i.keyword || ""}
${i.notes ? "Notes from the owner: " + i.notes : ""}
Rules: 900–1300 words; start with a short intro that uses the keyword in the first sentence; use ## and ### subheadings (keyword in at least one); short paragraphs; one bullet list; a practical example from the UAE or Kerala; end with a short call to action to contact the business. Do not invent statistics, prices, clients or quotes; if a number would help, write [ADD FIGURE]. Do not include the title as a heading.
Reply as JSON: {"title":"","seo_title":"","meta_description":"","excerpt":"","focus_keyword":"","markdown":""}`,
    improve: (i) => `Review this page for Google ranking and give the most valuable improvements, in priority order.
URL: ${i.url || ""}
Title: ${i.title || ""}
Meta description: ${i.description || ""}
Focus keyword: ${i.keyword || "(none set)"}
Issues found by the site checker: ${(i.issues || []).join(" | ") || "none"}
Page text: ${String(i.text || "").slice(0, 6000)}
Be specific to this page: say exactly what to add, rewrite or link. Include a rewritten title and meta description.
Reply as JSON: {"summary":"","actions":[{"priority":"high|medium|low","action":"","why":""}],"title":"","description":"","missing_topics":[""]}`,
    plan: (i) => `Create a practical 30-day plan to improve this business's Google rankings, for a small team.
Current situation: ${i.situation || ""}
Cover: Google Business Profile for each office, reviews, on-page fixes, content (which posts to write), local citations/directories in the UAE and India, backlinks from partners and associations, and measuring progress in Search Console.
Reply as JSON: {"weeks":[{"week":1,"focus":"","tasks":[""]}],"ongoing":[""]}`,
  };
  async function ai(body) {
    const c = await creds();
    if (!c.aiKey) return json(400, { error: "The AI assistant isn't connected yet. Add an Anthropic API key in the Settings tab." });
    const task = TASKS[body.task];
    if (!task) return json(400, { error: "Unknown task." });
    const used = (await meta().get("seo-ai-usage", { type: "json" })) || { day: "", n: 0 };
    const today = day(Date.now()); if (used.day !== today) { used.day = today; used.n = 0; }
    if (used.n >= AI_DAILY_LIMIT) return json(429, { error: `Daily limit of ${AI_DAILY_LIMIT} AI requests reached. It resets tomorrow.` });
    used.n++; await meta().setJSON("seo-ai-usage", used);
    const i = body.input || {};
    const system = `You are an expert SEO consultant and copywriter helping a digital marketing and branding agency grow on Google.
Business: ${String(i.business || "").slice(0, 1500)}
Write in clear British English. Be practical and specific. Never invent facts, statistics, prices, client names or reviews.
Always reply with valid JSON only, no Markdown fences, exactly in the shape asked for.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": c.aiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: c.model, max_tokens: body.task === "draft" ? 6000 : 3000, system, messages: [{ role: "user", content: task(i) }] }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = d.error?.message || `status ${res.status}`;
      return json(res.status === 401 ? 400 : 502, { error: res.status === 401 ? "The Anthropic API key was refused. Check it in Settings." : "The AI service answered with an error: " + msg });
    }
    const text = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    let data = null;
    try { data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { /* fall back to plain text */ }
    return json(200, { task: body.task, data, text: data ? "" : text, usage: { today: used.n, limit: AI_DAILY_LIMIT } });
  }

  async function routes({ path, method, body }) {
    if (path === "/seo/settings" && method === "GET") return json(200, await publicSettings());
    if (path === "/seo/settings" && method === "PATCH") {
      const s = await raw();
      if (body.gscCredentials !== undefined) {
        const v = String(body.gscCredentials || "").trim();
        if (v) {
          let sa; try { sa = JSON.parse(v); } catch { return json(400, { error: "That doesn't look like the JSON key file. Open the downloaded .json file and paste everything in it." }); }
          if (!sa.client_email || !sa.private_key) return json(400, { error: "The key file is missing client_email or private_key. Download a new JSON key for the service account." });
        }
        s.gscCredentials = v; tokenCache = null;
      }
      if (body.gscSite !== undefined) {
        const v = String(body.gscSite || "").trim();
        if (v && !/^(sc-domain:[a-z0-9.-]+|https?:\/\/\S+\/)$/i.test(v)) return json(400, { error: "Use exactly the property name from Search Console: sc-domain:aqlyondm.com (domain property) or https://aqlyondm.com/ (URL-prefix property, with the slash at the end)." });
        s.gscSite = v;
      }
      if (body.anthropicKey !== undefined) {
        const v = String(body.anthropicKey || "").trim();
        if (v && !/^sk-ant-[\w-]{20,}$/.test(v)) return json(400, { error: "That doesn't look like an Anthropic API key (it starts with sk-ant-)." });
        s.anthropicKey = v;
      }
      if (body.model !== undefined) s.model = String(body.model || "").trim().slice(0, 60);
      await meta().setJSON("seo-settings", s);
      return json(200, await publicSettings());
    }
    if (path === "/seo/gsc" && method === "GET") {
      try { return await gscReport(Math.min(90, Math.max(7, parseInt(body.days, 10) || 28))); }
      catch (e) { return json(502, { error: e.message }); }
    }
    if (path === "/seo/ai" && method === "POST") {
      try { return await ai(body); } catch (e) { return json(502, { error: "Couldn't reach the AI service. Try again in a minute." }); }
    }
    return null;
  }
  return { routes };
}
