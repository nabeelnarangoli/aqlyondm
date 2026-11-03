// Whole-site SEO report, run by Eleventy after every build (see eleventy.config.js).
// Reads every built HTML page, runs the shared rules in src/assets/js/seo-checks.js plus
// site-wide checks, and writes _site/seo/report.json for the SEO dashboard at /seo.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { parseHTML } from "linkedom";

const ctx = {}; vm.createContext(ctx);
vm.runInContext(await readFile(new URL("../src/assets/js/seo-checks.js", import.meta.url), "utf8"), ctx);
const { analyze } = ctx.SEOChecks;

const SKIP = /^\/(admin|manage|seo|checkin|send|badge|api|thanks)\b|^\/404\.html$/;

export async function buildSeoReport(results, outDir, site) {
  const pages = [];
  const known = new Set(results.map((r) => r.url).filter(Boolean));
  for (const r of results) {
    if (!r.outputPath || !r.outputPath.endsWith(".html") || !r.url || SKIP.test(r.url)) continue;
    const { document } = parseHTML(r.content);
    const q = (s) => document.querySelector(s);
    const meta = (n) => (q(`meta[name="${n}"]`) || q(`meta[property="${n}"]`))?.getAttribute("content") || "";
    if (/noindex/i.test(meta("robots"))) continue;
    const isPost = r.url.startsWith("/blog/") && r.url !== "/blog/";
    const scope = (isPost && q(".prose")) || q("main") || document.body;
    const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const doc = {
      h1s: [...document.querySelectorAll("main h1")].map(text),
      headings: [...scope.querySelectorAll("h1,h2,h3,h4")].map((el) => ({ level: +el.tagName[1], text: text(el) })),
      paragraphs: [...scope.querySelectorAll("p,li")].map(text).filter(Boolean),
      links: [...scope.querySelectorAll("a[href]")].map((a) => ({ href: a.getAttribute("href"), text: text(a) })),
      // alt="" marks a decorative image (fine on layout pages); inside an article every image should be described
      images: [...scope.querySelectorAll("img")].filter((i) => !i.closest("[aria-hidden=true]") && (isPost || i.getAttribute("alt") !== "")).map((i) => ({ src: i.getAttribute("src"), alt: i.getAttribute("alt") || "" })),
    };
    if (isPost) { doc.text = text(scope); doc.h1s = [text(q("article h1") || q("h1") || { textContent: "" })]; }
    else doc.text = text(scope);
    const title = text(q("title") || { textContent: "" });
    const res = analyze({ keyword: meta("seo:focus"), seoTitle: title, metaDescription: meta("description"), slug: r.url.split("/").filter(Boolean).pop() || "", doc, kind: isPost ? "post" : "page",
      cover: isPost ? meta("og:image") : undefined, coverAlt: isPost ? (q(".post-hero img")?.getAttribute("alt") || "") : undefined });
    // page-level technical checks
    const tech = [];
    if (!q('link[rel="canonical"]')) tech.push({ id: "canonical", group: "Technical", status: "bad", text: "No canonical link.", fix: "Every page should say which address is the main one." });
    if (!meta("og:image")) tech.push({ id: "og", group: "Technical", status: "ok", text: "No share image (og:image).", fix: "Add a cover image so links look good on WhatsApp and social media." });
    const broken = [...document.querySelectorAll("main a[href^='/']")].map((a) => a.getAttribute("href").split("#")[0])
      .filter((h) => h && !/^\/(api|uploads|assets|img|events\/[a-z0-9-]+$|badge|manage|admin)/.test(h) && !known.has(h) && !known.has(h + "/") && !known.has(h.replace(/\/$/, "") + "/"));
    if (broken.length) tech.push({ id: "broken", group: "Technical", status: "bad", text: `${broken.length} link${broken.length > 1 ? "s" : ""} to pages that don't exist: ${[...new Set(broken)].slice(0, 3).join(", ")}`, fix: "Fix or remove these links." });
    res.checks.push(...tech);
    const pts = { good: 2, ok: 1, bad: 0 }; const score = Math.round(res.checks.reduce((t, c) => t + pts[c.status], 0) / (res.checks.length * 2) * 100);
    pages.push({ url: r.url, type: isPost ? "Blog post" : "Page", title, description: meta("description"), keyword: meta("seo:focus"), words: res.words, score, grade: score >= 80 ? "good" : score >= 55 ? "ok" : "bad",
      checks: res.checks.filter((c) => c.status !== "good"), passed: res.checks.filter((c) => c.status === "good").length });
  }

  // site-wide checks
  const site_checks = [];
  const dup = (key, label) => {
    const m = new Map(); for (const p of pages) if (p[key]) m.set(p[key], [...(m.get(p[key]) || []), p.url]);
    for (const [v, urls] of m) if (urls.length > 1) site_checks.push({ status: "bad", text: `${urls.length} pages share the same ${label}: “${v.slice(0, 70)}”`, fix: `Give each page its own ${label}.`, urls });
  };
  dup("title", "title"); dup("description", "meta description");
  const kw = new Map(); for (const p of pages) if (p.keyword) kw.set(p.keyword.toLowerCase(), [...(kw.get(p.keyword.toLowerCase()) || []), p.url]);
  for (const [k, urls] of kw) if (urls.length > 1) site_checks.push({ status: "ok", text: `${urls.length} posts target the same keyword “${k}”`, fix: "Posts with the same keyword compete with each other. Give each its own angle, or merge them.", urls });
  const posts = pages.filter((p) => p.type === "Blog post");
  const noKw = posts.filter((p) => !p.keyword).length;
  if (noKw) site_checks.push({ status: "ok", text: `${noKw} of ${posts.length} blog posts have no focus keyword`, fix: "Open each post in /admin and fill in “SEO · Focus keyword”. The live checker then shows exactly what to improve.", urls: posts.filter((p) => !p.keyword).map((p) => p.url) });
  const latest = posts.map((p) => p.url).length;
  site_checks.push({ status: latest >= 8 ? "good" : "ok", text: `${posts.length} blog posts published`, fix: latest >= 8 ? "" : "Publishing 2–4 helpful posts a month on topics your customers search for is one of the strongest ways to grow on Google." });
  site_checks.push({ status: "good", text: "sitemap.xml and robots.txt are generated on every deploy", fix: "" });

  const report = {
    generated: new Date().toISOString(), site: site.url,
    summary: { pages: pages.length, avg: pages.length ? Math.round(pages.reduce((t, p) => t + p.score, 0) / pages.length) : 0,
      bad: pages.reduce((t, p) => t + p.checks.filter((c) => c.status === "bad").length, 0) + site_checks.filter((c) => c.status === "bad").length,
      ok: pages.reduce((t, p) => t + p.checks.filter((c) => c.status === "ok").length, 0) + site_checks.filter((c) => c.status === "ok").length },
    site_checks, pages: pages.sort((a, b) => a.score - b.score),
  };
  await mkdir(path.join(outDir, "seo"), { recursive: true });
  await writeFile(path.join(outDir, "seo", "report.json"), JSON.stringify(report));
  return report;
}
