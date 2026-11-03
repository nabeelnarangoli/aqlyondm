/* =====================================================================
   Aqlyon SEO checks — shared by the live checker in /admin (blog posts)
   and the whole-site report built on every deploy (/seo).
   Works in the browser (window.SEOChecks) and in Node (loaded with vm).
   ===================================================================== */
(function (root) {
  "use strict";

  var norm = function (s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9ഀ-ൿ؀-ۿ]+/g, " ").trim(); };
  var words = function (s) { var n = norm(s); return n ? n.split(" ") : []; };
  var has = function (hay, kw) { var h = " " + norm(hay) + " ", k = norm(kw); return !!k && h.indexOf(" " + k + " ") !== -1; };
  var count = function (hay, kw) { var h = " " + norm(hay) + " ", k = " " + norm(kw) + " ", n = 0, i = 0; if (!norm(kw)) return 0; while ((i = h.indexOf(k, i)) !== -1) { n++; i += k.length - 1; } return n; };
  var sentences = function (t) { return String(t || "").split(/(?<=[.!?])\s+/).map(function (x) { return x.trim(); }).filter(function (x) { return words(x).length > 2; }); };

  /* Turn Markdown (what the editor saves) into the structure the checks use */
  function fromMarkdown(md) {
    md = String(md || "");
    var doc = { headings: [], paragraphs: [], links: [], images: [], text: "" };
    var re, m;
    re = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g; while ((m = re.exec(md))) doc.images.push({ alt: m[1], src: m[2] });
    re = /<img[^>]*>/gi; while ((m = re.exec(md))) { var alt = /alt="([^"]*)"/i.exec(m[0]); var src = /src="([^"]*)"/i.exec(m[0]); doc.images.push({ alt: alt ? alt[1] : "", src: src ? src[1] : "" }); }
    re = /(^|[^!])\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g; while ((m = re.exec(md))) doc.links.push({ text: m[2], href: m[3] });
    re = /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi; while ((m = re.exec(md))) doc.links.push({ href: m[1], text: m[2].replace(/<[^>]+>/g, "") });
    var plain = function (s) { return s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, " ").replace(/[*_`>#]+/g, " ").replace(/\s+/g, " ").trim(); };
    md.split(/\n\s*\n/).forEach(function (block) {
      block.split("\n").forEach(function (line) {
        var h = /^(#{1,6})\s+(.+)$/.exec(line.trim());
        if (h) doc.headings.push({ level: h[1].length, text: plain(h[2]) });
      });
      var body = block.split("\n").filter(function (l) { return !/^\s*#{1,6}\s/.test(l); }).join(" ");
      var p = plain(body.replace(/^\s*([-*+]|\d+\.)\s+/gm, ""));
      if (p && !/^\s*[-*+]\s|^\s*\d+\.\s/.test(block.trim())) doc.paragraphs.push(p);
      else if (p) doc.paragraphs.push(p);
    });
    doc.text = plain(md);
    return doc;
  }

  /* Rules. Each returns {status: good|ok|bad, text, fix}. ok = could be better, bad = needs attention. */
  function analyze(input) {
    var kw = String(input.keyword || "").trim();
    var doc = input.doc || fromMarkdown(input.markdown);
    var fullTitle = input.seoTitle || (input.title ? input.title + (input.siteName ? " | " + input.siteName : "") : "");
    var desc = String(input.metaDescription || "").trim();
    var slug = String(input.slug || "");
    var wc = words(doc.text).length;
    var out = [];
    var isPost = input.kind !== "page";
    var add = function (id, group, status, text, fix) { out.push({ id: id, group: group, status: status, text: text, fix: fix || "" }); };

    // ---- keyword ----
    if (!kw && !isPost) { /* ordinary pages: keyword checks only when a keyword is set */ }
    else if (!kw) add("kw", "Focus keyword", "bad", "No focus keyword set.", "Choose the search phrase this page should rank for (2–4 words people would type into Google, e.g. “branding agency in Kerala”).");
    else {
      var kwWords = words(kw).length;
      add("kw", "Focus keyword", kwWords > 5 ? "ok" : "good", "Focus keyword: “" + kw + "”.", kwWords > 5 ? "Long keywords are hard to use naturally. Try 2–4 words." : "");
      var inTitle = has(fullTitle, kw), start = norm(fullTitle).indexOf(norm(kw));
      add("kw-title", "Focus keyword", inTitle ? (start <= 25 ? "good" : "ok") : "bad",
        inTitle ? (start <= 25 ? "The keyword is near the start of the Google title." : "The keyword is in the Google title, but not near the start.") : "The keyword isn't in the Google title.",
        inTitle ? (start <= 25 ? "" : "Move the keyword closer to the beginning of the title.") : "Put the exact keyword in the title (or the “Title for Google” field), ideally at the start.");
      var inDesc = has(desc, kw);
      add("kw-desc", "Focus keyword", inDesc ? "good" : "bad", inDesc ? "The keyword is in the meta description." : "The keyword isn't in the meta description.", inDesc ? "" : "Use the keyword once in the meta description; Google shows it in bold when it matches the search.");
      if (isPost || slug) {
        var slugHas = words(kw).every(function (w) { return norm(slug).split(" ").join("-").indexOf(w) !== -1 || slug.indexOf(w) !== -1; });
        add("kw-url", "Focus keyword", slugHas ? "good" : "ok", slugHas ? "The keyword is in the web address." : "The web address doesn't contain the keyword.", slugHas ? "" : "When you create a new post, start the title with the keyword so the address includes it. Don't change the address of a published post.");
      }
      var firstP = (doc.paragraphs[0] || "") + " " + (doc.paragraphs[1] || "");
      var inIntro = has(firstP, kw);
      add("kw-intro", "Focus keyword", inIntro ? "good" : "bad", inIntro ? "The keyword appears in the opening paragraph." : "The keyword doesn't appear in the opening paragraph.", inIntro ? "" : "Mention the keyword in the first one or two sentences so Google and readers know the topic straight away.");
      var subs = doc.headings.filter(function (h) { return h.level >= 2; });
      var subHas = subs.filter(function (h) { return has(h.text, kw); }).length;
      if (subs.length) add("kw-sub", "Focus keyword", subHas ? "good" : "ok", subHas ? "The keyword is used in " + subHas + " subheading" + (subHas > 1 ? "s" : "") + "." : "None of the subheadings use the keyword.", subHas ? "" : "Use the keyword (or a close variation) in at least one H2 or H3 subheading.");
      var n = count(doc.text, kw), dens = wc ? (n * kwWords) / wc * 100 : 0;
      var dStatus = n === 0 ? "bad" : dens < 0.5 ? "ok" : dens > 3 ? "bad" : "good";
      add("kw-density", "Focus keyword", dStatus, "The keyword appears " + n + " time" + (n === 1 ? "" : "s") + " (" + dens.toFixed(1) + "% of the words).",
        dStatus === "good" ? "" : dens > 3 ? "That's too often and can look like keyword stuffing. Replace some with natural variations." : "Use the keyword a few more times where it reads naturally (aim for about 1–2% of the words).");
      var altHas = doc.images.some(function (i) { return has(i.alt, kw); }) || has(input.coverAlt, kw);
      if (doc.images.length || input.cover) add("kw-alt", "Focus keyword", altHas ? "good" : "ok", altHas ? "An image description (alt text) includes the keyword." : "No image description (alt text) includes the keyword.", altHas ? "" : "Describe at least one image using the keyword, e.g. “Aqlyon team planning a branding project in Kerala”.");
    }

    // ---- title & description ----
    var tl = fullTitle.length;
    add("title-len", "Google listing", !tl ? "bad" : tl < 30 ? "ok" : tl <= 60 ? "good" : tl <= 70 ? "ok" : "bad",
      !tl ? "There's no title." : "The Google title is " + tl + " characters.",
      !tl ? "Add a title." : tl < 30 ? "Short titles waste space. Aim for 50–60 characters." : tl > 60 ? "Google cuts titles off at about 60 characters. Shorten it, or write a shorter “Title for Google”." : "");
    var dl = desc.length;
    add("desc-len", "Google listing", !dl ? "bad" : dl < 120 ? "ok" : dl <= 160 ? "good" : "ok",
      !dl ? "There's no meta description." : "The meta description is " + dl + " characters.",
      !dl ? "Write 120–160 characters that sum up the page and invite the click. Without one, Google picks random text." : dl < 120 ? "Use more of the space: aim for 120–160 characters." : dl > 160 ? "Google cuts it off at about 160 characters. Shorten it so the end isn't lost." : "");

    // ---- content ----
    var minWords = isPost ? 600 : 300;
    add("length", "Content", wc >= minWords ? "good" : wc >= minWords / 2 ? "ok" : "bad", "The text has " + wc + " words.",
      wc >= minWords ? "" : "Pages that rank usually go deeper. Aim for at least " + minWords + " words that genuinely answer the reader's question.");
    var h1Count = (doc.h1s || []).length;
    if (!isPost || doc.h1s) add("h1", "Content", h1Count === 1 ? "good" : "bad", h1Count === 1 ? "The page has exactly one main heading (H1)." : "The page has " + h1Count + " main headings (H1).", h1Count === 1 ? "" : "Use exactly one H1 per page: the main title.");
    if (isPost && doc.headings.some(function (h) { return h.level === 1; })) add("h1-body", "Content", "bad", "The article text contains a top-level heading (#).", "The post title is already the H1. Use ## for sections and ### for sub-sections.");
    var subsAll = doc.headings.filter(function (h) { return h.level >= 2; }).length;
    var needSubs = Math.floor(wc / 300);
    add("subheadings", "Content", subsAll >= Math.max(1, needSubs) ? "good" : subsAll ? "ok" : "bad", "There " + (subsAll === 1 ? "is 1 subheading" : "are " + subsAll + " subheadings") + ".",
      subsAll >= Math.max(1, needSubs) ? "" : "Break the text up with a subheading about every 300 words so it's easy to scan.");
    var internal = doc.links.filter(function (l) { return /^\/(?!\/)|^#|aqlyondm\.com/i.test(l.href); }).length;
    var external = doc.links.filter(function (l) { return /^https?:\/\//i.test(l.href) && !/aqlyondm\.com/i.test(l.href); }).length;
    add("links-int", "Content", internal ? "good" : "ok", internal ? internal + " link" + (internal > 1 ? "s" : "") + " to other pages on your site." : "No links to other pages on your site.", internal ? "" : "Link to a related service, post or the contact section. Internal links help Google discover and rank your pages.");
    if (isPost) add("links-ext", "Content", external ? "good" : "ok", external ? external + " link" + (external > 1 ? "s" : "") + " to other websites." : "No links to other websites.", external ? "" : "Linking to a trustworthy source (a study, Google's guidance, an official site) adds credibility.");
    var imgs = doc.images.length + (input.cover ? 1 : 0);
    var noAlt = doc.images.filter(function (i) { return !String(i.alt || "").trim(); }).length + (input.cover && !String(input.coverAlt || "").trim() ? 1 : 0);
    add("images", "Content", imgs ? "good" : "ok", imgs ? imgs + " image" + (imgs > 1 ? "s" : "") + "." : "No images.", imgs ? "" : "Add at least one relevant image; posts with images get more clicks and shares.");
    if (imgs) add("alt", "Content", noAlt ? "bad" : "good", noAlt ? noAlt + " image" + (noAlt > 1 ? "s have" : " has") + " no description (alt text)." : "Every image has a description (alt text).", noAlt ? "Describe each image in a few words. It helps Google Images and people using screen readers." : "");
    if (isPost && "cover" in input) add("cover", "Content", input.cover ? "good" : "ok", input.cover ? "There's a cover image (used when the post is shared)." : "There's no cover image.", input.cover ? "" : "Add a wide cover image (at least 1200 px). It shows in WhatsApp, Facebook and LinkedIn previews.");

    // ---- readability ----
    var sent = sentences(doc.paragraphs.join(" "));
    if (sent.length >= 5) {
      var longS = sent.filter(function (x) { return words(x).length > 25; }).length, pct = Math.round(longS / sent.length * 100);
      add("sentences", "Readability", pct <= 25 ? "good" : pct <= 40 ? "ok" : "bad", pct + "% of sentences are longer than 25 words.", pct <= 25 ? "" : "Split long sentences in two. Short sentences are easier to read on a phone.");
    }
    var longP = doc.paragraphs.filter(function (p) { return words(p).length > 150; }).length;
    if (doc.paragraphs.length) add("paragraphs", "Readability", longP ? "ok" : "good", longP ? longP + " paragraph" + (longP > 1 ? "s are" : " is") + " longer than 150 words." : "Paragraphs are a comfortable length.", longP ? "Break long paragraphs into smaller ones of 2–4 sentences." : "");

    var pts = { good: 2, ok: 1, bad: 0 }, total = out.length * 2, got = out.reduce(function (t, c) { return t + pts[c.status]; }, 0);
    var score = total ? Math.round(got / total * 100) : 0;
    return { score: score, grade: score >= 80 ? "good" : score >= 55 ? "ok" : "bad", checks: out, title: fullTitle, description: desc, words: wc };
  }

  root.SEOChecks = { analyze: analyze, fromMarkdown: fromMarkdown, words: words, has: has };
})(typeof window !== "undefined" ? window : globalThis);
