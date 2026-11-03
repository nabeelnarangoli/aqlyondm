/* Live SEO checker for blog posts in /admin (shown in the preview pane on the right while you edit).
   Rules live in /assets/js/seo-checks.js, shared with the whole-site report at /seo. */
(function () {
  if (!window.CMS || !window.SEOChecks) return;
  var h = window.h, createClass = window.createClass;
  var SITE = { title: "Aqlyon Brand Management", url: "https://aqlyondm.com" };
  fetch("/seo/site.json").then(function (r) { return r.json(); }).then(function (d) { SITE = d; }).catch(function () {});
  var slugify = function (s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
  var COLORS = { good: "#1E9E62", ok: "#E39A1B", bad: "#D93A3F" };
  var LABEL = { good: "Good", ok: "Could be better", bad: "Needs work" };
  var trunc = function (s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + " …" : s; };

  var Preview = createClass({
    render: function () {
      var entry = this.props.entry, data = entry.get("data");
      var get = function (k) { var v = data.get(k); return v == null ? "" : String(v); };
      var title = get("title"), slug = entry.get("slug") || slugify(title);
      var res = window.SEOChecks.analyze({
        keyword: get("focus_keyword"), title: title, seoTitle: get("seo_title"), siteName: SITE.title,
        metaDescription: get("meta_description") || get("excerpt"), slug: slug, markdown: get("body"),
        cover: get("cover"), coverAlt: get("cover_alt"), kind: "post"
      });
      var groups = {};
      res.checks.forEach(function (c) { (groups[c.group] = groups[c.group] || []).push(c); });
      var order = { bad: 0, ok: 1, good: 2 };
      var host = String(SITE.url).replace(/^https?:\/\//, "").replace(/\/$/, "");
      var ring = 2 * Math.PI * 34, col = COLORS[res.grade];
      return h("div", { className: "seo" },
        h("div", { className: "seo-top" },
          h("svg", { width: 84, height: 84, viewBox: "0 0 84 84", className: "seo-ring" },
            h("circle", { cx: 42, cy: 42, r: 34, fill: "none", stroke: "#E7E8E3", strokeWidth: 9 }),
            h("circle", { cx: 42, cy: 42, r: 34, fill: "none", stroke: col, strokeWidth: 9, strokeLinecap: "round", strokeDasharray: ring, strokeDashoffset: ring * (1 - res.score / 100), transform: "rotate(-90 42 42)" }),
            h("text", { x: 42, y: 48, textAnchor: "middle", fontSize: 22, fontWeight: 700, fill: "#0B0B0B" }, res.score)),
          h("div", null,
            h("p", { className: "seo-kicker" }, "SEO score"),
            h("p", { className: "seo-grade", style: { color: col } }, LABEL[res.grade]),
            h("p", { className: "seo-sub" }, get("focus_keyword") ? "For “" + get("focus_keyword") + "” · " + res.words + " words" : "Set a focus keyword in the SEO fields to score this post."))),
        h("div", { className: "seo-serp" },
          h("p", { className: "seo-kicker" }, "Google preview"),
          h("div", { className: "serp" },
            h("p", { className: "serp-url" }, host + " › blog › " + trunc(slug, 40)),
            h("p", { className: "serp-title" }, trunc(res.title || "Your post title", 62)),
            h("p", { className: "serp-desc" }, trunc(res.description || "Add a meta description (or a short summary) so Google shows your words here.", 160)))),
        Object.keys(groups).map(function (g) {
          return h("div", { className: "seo-group", key: g },
            h("h3", null, g),
            groups[g].sort(function (a, b) { return order[a.status] - order[b.status]; }).map(function (c) {
              return h("div", { className: "seo-check " + c.status, key: c.id },
                h("span", { className: "dot", style: { background: COLORS[c.status] } }),
                h("div", null, h("p", { className: "t" }, c.text), c.fix ? h("p", { className: "f" }, c.fix) : null));
            }));
        }),
        h("p", { className: "seo-more" }, "Need ideas for a title, description or keywords? Open the SEO dashboard at ", h("b", null, "/seo"), " → AI assistant."),
        h("hr"),
        h("article", { className: "seo-article" }, h("h1", null, title), this.props.widgetFor("body"))
      );
    }
  });
  CMS.registerPreviewStyle("/admin/content/seo-preview.css");
  CMS.registerPreviewTemplate("blog", Preview);
})();
