#!/usr/bin/env node
/**
 * Import blog posts from a WordPress export into src/blog/posts.
 *
 * 1. In WordPress: Tools → Export → "Posts" → Download Export File (an .xml file).
 * 2. Run:  npm run import:wordpress -- path/to/export.xml
 *    Add --download to also copy each post's featured image into src/uploads.
 *
 * Existing files with the same name are not overwritten.
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const download = args.includes("--download");
if (!file) {
  console.error("Usage: npm run import:wordpress -- export.xml [--download]");
  process.exit(1);
}

const xml = await readFile(file, "utf8");
const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);

const tag = (s, name) => {
  const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
};
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&#8217;/g, "’").replace(/&#8211;/g, "–").replace(/&#8212;/g, "—");
const yaml = (s) => JSON.stringify(String(s ?? ""));

// attachment id → url, for featured images
const attachments = new Map();
for (const it of items) {
  if (tag(it, "wp:post_type") === "attachment") attachments.set(tag(it, "wp:post_id"), tag(it, "wp:attachment_url"));
}

const outDir = "src/blog/posts";
await mkdir(outDir, { recursive: true });
await mkdir("src/uploads/blog", { recursive: true });
let count = 0;

for (const it of items) {
  if (tag(it, "wp:post_type") !== "post" || tag(it, "wp:status") !== "publish") continue;
  const title = decode(tag(it, "title"));
  const slug = tag(it, "wp:post_name") || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const date = tag(it, "wp:post_date").slice(0, 10);
  const excerpt = decode(tag(it, "excerpt:encoded").replace(/<[^>]+>/g, "")).trim();
  const catMatch = it.match(/<category domain="category"[^>]*><!\[CDATA\[(.*?)\]\]><\/category>/);
  const category = catMatch ? decode(catMatch[1]) : "Marketing";
  let body = tag(it, "content:encoded")
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const thumbMeta = it.match(/<wp:meta_key><!\[CDATA\[_thumbnail_id\]\]><\/wp:meta_key>\s*<wp:meta_value><!\[CDATA\[(\d+)\]\]>/);
  let cover = thumbMeta ? attachments.get(thumbMeta[1]) || "" : "";

  if (cover && download) {
    try {
      const res = await fetch(cover);
      if (res.ok) {
        const name = `${slug}${path.extname(new URL(cover).pathname) || ".jpg"}`;
        await writeFile(`src/uploads/blog/${name}`, Buffer.from(await res.arrayBuffer()));
        cover = `/uploads/blog/${name}`;
      }
    } catch (e) {
      console.warn(`  Could not download cover for "${title}": ${e.message}`);
    }
  }

  const target = path.join(outDir, `${slug}.md`);
  try { await access(target); console.log(`skip  ${target} (already exists)`); continue; } catch {}

  const fm = [
    "---",
    `title: ${yaml(title)}`,
    `date: ${date}`,
    "draft: false",
    `category: ${yaml(category)}`,
    `excerpt: ${yaml(excerpt)}`,
    `cover: ${yaml(cover)}`,
    'cover_alt: ""',
    "---",
    "",
  ].join("\n");
  await writeFile(target, fm + body + "\n");
  console.log(`wrote ${target}`);
  count++;
}
console.log(`\nImported ${count} post(s).`);
