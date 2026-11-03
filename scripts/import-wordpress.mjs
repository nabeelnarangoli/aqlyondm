#!/usr/bin/env node
/**
 * Import blog posts from a WordPress export into src/blog/posts.
 *
 * 1. In WordPress: Tools → Export → Posts → Download Export File (an .xml file).
 * 2. Run:  npm run import:wordpress -- path/to/export.xml [--download] [--overwrite]
 *      --download   also copy each post's images into src/uploads/blog/ (needs access to the old site)
 *      --overwrite  replace posts that were imported before
 *
 * Works with Elementor pages: only the article itself is kept (from the post title down to the
 * "Have Questions?" / "Ready to …" call-to-action), converted to clean Markdown.
 * Also writes src/_redirects so old WordPress links (/<slug>/) go to /blog/<slug>/,
 * and scripts/wordpress-images.txt listing every image URL with its new local path.
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const download = args.includes("--download");
const overwrite = args.includes("--overwrite");
if (!file) {
  console.error("Usage: npm run import:wordpress -- export.xml [--download] [--overwrite]");
  process.exit(1);
}

const xml = await readFile(file, "utf8");
const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);
const tag = (s, name) => {
  const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() : "";
};
const clean = (s) => String(s || "").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
const decode = (s) => { const { document } = parseHTML(`<p>${s}</p>`); return document.querySelector("p").textContent; };
const yaml = (s) => JSON.stringify(String(s ?? ""));

// attachment id → url (featured images)
const attachments = new Map();
for (const it of items) if (tag(it, "wp:post_type") === "attachment") attachments.set(tag(it, "wp:post_id"), tag(it, "wp:attachment_url"));

// images: remote url → local path under /uploads/blog/
const images = new Map();
const localFor = (url, slug) => {
  if (images.has(url)) return images.get(url);
  const base = path.basename(new URL(url).pathname).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const local = `/uploads/blog/${slug}-${base}`;
  images.set(url, local);
  return local;
};
const SKIP_IMG = /Screenshot-2025-04-12-102643|cropped-ICON|logo/i;   // site logo / icons from the old page layout

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", emDelimiter: "*" });
td.remove(["script", "style", "noscript", "iframe", "form", "button", "svg", "select", "input", "textarea"]);

const BLOCKS = new Set(["H2", "H3", "H4", "H5", "P", "UL", "OL", "BLOCKQUOTE", "TABLE", "IMG", "FIGURE"]);
const END = /^(Have Questions\?|Ready to future-proof|Communicate\. Collaborate\. Create\.|Quick Links|Location)\b/i;

function article(html, slug) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const h1 = document.querySelector("h1");
  const all = [...document.querySelectorAll("*")];
  let started = !h1, kept = [];
  for (const el of all) {
    if (el === h1) { started = true; continue; }
    if (!started) continue;
    if (/^H[1-6]$/.test(el.tagName) && END.test(clean(el.textContent))) break;
    if (!BLOCKS.has(el.tagName)) continue;
    if (kept.some((k) => k.contains(el))) continue;            // already inside a kept block
    if (el.closest("form, header, footer, nav")) continue;
    if (el.tagName === "IMG") {
      const src = el.getAttribute("src") || "";
      if (!src || SKIP_IMG.test(src)) continue;
    } else if (!clean(el.textContent) && !el.querySelector("img")) continue;
    kept.push(el);
  }
  // list items: drop the <p> wrappers Elementor puts inside them (they make loose, spaced-out lists)
  for (const k of kept) for (const p of k.querySelectorAll("li > p")) p.replaceWith(...p.childNodes);
  // tidy attributes and point images at their new home
  for (const k of kept) for (const el of [k, ...k.querySelectorAll("*")]) {
    for (const a of [...el.attributes]) if (!["href", "src", "alt"].includes(a.name)) el.removeAttribute(a.name);
    if (el.tagName === "IMG") {
      const src = el.getAttribute("src").replace(/^http:/, "https:").replace(/-\d+x\d+(\.\w+)$/, "$1");   // full-size file, not a thumbnail
      el.setAttribute("src", localFor(src, slug));
      if (!el.getAttribute("alt")) el.setAttribute("alt", "");
    }
  }
  const md = td.turndown(kept.map((k) => k.outerHTML).join("\n"))
    .replace(/ /g, " ").replace(/[​-‍﻿]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return { title: h1 ? clean(h1.textContent).replace(/\s*Whatsapp$/i, "") : "", md, firstP: kept.find((k) => k.tagName === "P") };
}

const outDir = "src/blog/posts";
await mkdir(outDir, { recursive: true });
await mkdir("src/uploads/blog", { recursive: true });
const redirects = [];
// WordPress excerpts are sometimes copied between posts; a repeated excerpt is only kept by the oldest post
const firstWithExcerpt = new Map();
for (const it of items) {
  if (tag(it, "wp:post_type") !== "post" || tag(it, "wp:status") !== "publish") continue;
  const ex = tag(it, "excerpt:encoded").trim(), d = tag(it, "wp:post_date");
  if (ex && (!firstWithExcerpt.has(ex) || d < firstWithExcerpt.get(ex))) firstWithExcerpt.set(ex, d);
}
let count = 0;

for (const it of items) {
  if (tag(it, "wp:post_type") !== "post" || tag(it, "wp:status") !== "publish") continue;
  const slug = tag(it, "wp:post_name");
  const date = tag(it, "wp:post_date").slice(0, 10);
  const catMatch = it.match(/<category domain="category"[^>]*><!\[CDATA\[(.*?)\]\]><\/category>/);
  const category = catMatch && !/uncategori[sz]ed/i.test(catMatch[1]) ? decode(catMatch[1]) : "Marketing";
  const a = article(tag(it, "content:encoded"), slug);
  const title = clean(a.title || decode(tag(it, "title")).replace(/\s*\|\s*Aqlyon.*$/i, ""));
  const rawEx = tag(it, "excerpt:encoded").trim();
  let excerpt = rawEx && firstWithExcerpt.get(rawEx) === tag(it, "wp:post_date") ? clean(decode(rawEx.replace(/<[^>]+>/g, " "))) : "";
  if (!excerpt && a.firstP) { excerpt = clean(a.firstP.textContent); if (excerpt.length > 180) excerpt = excerpt.slice(0, excerpt.lastIndexOf(" ", 175)) + "…"; }
  const thumbMeta = it.match(/<wp:meta_key><!\[CDATA\[_thumbnail_id\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(\d+)\]\]>/);
  const coverUrl = thumbMeta ? attachments.get(thumbMeta[1]) : "";
  const cover = coverUrl ? localFor(coverUrl.replace(/^http:/, "https:"), slug) : "";

  redirects.push(`/${slug}  /blog/${slug}/  301`, `/${slug}/  /blog/${slug}/  301`);
  const target = path.join(outDir, `${slug}.md`);
  if (!overwrite) { try { await access(target); console.log(`skip  ${target} (already exists)`); continue; } catch {} }
  const fm = ["---", `title: ${yaml(title)}`, `date: ${date}`, "draft: false", `category: ${yaml(category)}`,
    `excerpt: ${yaml(excerpt)}`, `cover: ${yaml(cover)}`, `cover_alt: ""`, "---", ""].join("\n");
  await writeFile(target, fm + a.md + "\n");
  console.log(`wrote ${target}  (${a.md.length} chars)`);
  count++;
}

await writeFile("src/_redirects", "# Old WordPress post links → new blog pages (made by scripts/import-wordpress.mjs)\n" + redirects.join("\n") + "\n");
await writeFile("scripts/wordpress-images.txt", [...images].map(([u, l]) => `${u}\t${l}`).join("\n") + "\n");
console.log(`\nImported ${count} post(s). ${images.size} image(s) listed in scripts/wordpress-images.txt.`);

if (download) {
  let ok = 0;
  for (const [url, local] of images) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      await writeFile(path.join("src", local), Buffer.from(await res.arrayBuffer())); ok++;
    } catch (e) { console.warn(`  could not download ${url}: ${e.message}`); }
  }
  console.log(`Downloaded ${ok} of ${images.size} image(s).`);
}
