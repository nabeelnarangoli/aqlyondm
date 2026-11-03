/* =====================================================================
   Aqlyon SEO dashboard (/seo)
   - Overview & Pages: the site report built on every deploy (/seo/report.json)
   - Search Console: live Google data through /api/seo/gsc
   - AI assistant: keyword ideas, post ideas, drafts, titles & descriptions (/api/seo/ai)
   - Action plan: the off-site work that moves rankings, with a checklist
   - Settings: connect Search Console and the AI key
   Uses the same admin password (and login) as the event manager.
   ===================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var app = $("#app");
  var store = {
    get: function (k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v, keep) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); if (v) (keep ? localStorage : sessionStorage).setItem(k, v); } catch (e) {} },
  };
  var TOKEN = "dm-admin";   // shared with /manage
  var S = { site: null, report: null, settings: null, gsc: null, gscDays: 28, tab: "overview" };

  function toast(msg, bad) { $$(".toast").forEach(function (x) { x.remove(); }); var t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function api(path, opts) {
    opts = opts || {};
    var h = { "content-type": "application/json" }, t = store.get(TOKEN); if (t) h.authorization = "Bearer " + t;
    return fetch("/api" + path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path !== "/admin/login") { store.set(TOKEN, null); login("Please log in again."); throw new Error("Admin login needed."); }
        if (!r.ok) throw new Error(d.error || "Something went wrong."); return d; }); });
  }
  var fmt = function (n) { return Number(n || 0).toLocaleString("en-GB"); };
  var pct = function (n) { return (n * 100).toFixed(1) + "%"; };
  var pos = function (n) { return n ? n.toFixed(1) : "–"; };
  var when = function (s) { return new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  var gradeOf = function (s) { return s >= 80 ? "good" : s >= 55 ? "ok" : "bad"; };
  var GRADE = { good: "Good", ok: "Could be better", bad: "Needs work" };
  var copyBtn = function (text) { return '<div class="copy"><span>' + esc(text) + '</span><button type="button" data-copy="' + esc(text) + '">Copy</button></div>'; };
  var postSlug = function (url) { var m = /^\/blog\/([^/]+)\/?$/.exec(url); return m ? m[1] : ""; };

  /* ---------------- login ---------------- */
  function login(msg) {
    app.innerHTML = '<div class="auth"><div class="card"><img src="/img/aqlyon-q.png" alt="" style="height:44px;margin:0 auto 12px"><h1 style="font-size:28px">SEO dashboard</h1><p style="color:var(--ink2);margin:8px 0 0">Your Google ranking assistant. Use the same admin password as the event manager.</p>' +
      '<form class="form"><label>Admin password<input type="password" id="pw" autocomplete="current-password" required></label><label style="flex-direction:row;align-items:center;gap:8px;font-weight:500"><input type="checkbox" id="keep" checked style="width:auto"> Keep me signed in on this device</label><p class="err" role="alert">' + esc(msg || "") + '</p><button class="btn" type="submit">Log in</button></form></div></div>';
    $("form").onsubmit = function (e) {
      e.preventDefault(); var b = $("button", e.target); b.disabled = true;
      api("/admin/login", { method: "POST", body: { password: $("#pw").value, remember: $("#keep").checked } })
        .then(function (d) { store.set(TOKEN, d.token, $("#keep").checked); boot(); })
        .catch(function (err) { $(".err").textContent = err.message; b.disabled = false; });
    };
    $("#pw").focus();
  }

  /* ---------------- shell ---------------- */
  var TABS = [["overview", "Overview"], ["pages", "Pages"], ["gsc", "Search Console"], ["ai", "AI assistant"], ["plan", "Action plan"], ["settings", "Settings"]];
  function shell() {
    app.innerHTML = '<header class="top"><div class="in"><span class="brand"><img src="/img/aqlyon-q.png" alt="">SEO dashboard</span><nav class="tabs" role="tablist" aria-label="Sections">' +
      TABS.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + "</button>"; }).join("") +
      '</nav><button type="button" class="lo" id="lo">Log out</button></div></header><main id="main"></main>';
    $$("[data-tab]").forEach(function (b) { b.onclick = function () { go(b.getAttribute("data-tab")); }; });
    $("#lo").onclick = function () { store.set(TOKEN, null); login(); };
  }
  function go(tab) {
    S.tab = tab; history.replaceState(null, "", "#" + tab);
    $$("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === tab); });
    ({ overview: overview, pages: pages, gsc: gsc, ai: aiView, plan: plan, settings: settings })[tab]();
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy]"); if (!c) return;
    (navigator.clipboard ? navigator.clipboard.writeText(c.getAttribute("data-copy")) : Promise.reject()).then(function () { toast("Copied"); }, function () { toast("Couldn't copy. Select the text instead.", true); });
  });

  /* ---------------- overview ---------------- */
  function ring(score, size) {
    size = size || 96; var r = size / 2 - 8, c = 2 * Math.PI * r, g = gradeOf(score), col = { good: "#1E9E62", ok: "#C9820F", bad: "#D93A3F" }[g];
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="Score ' + score + ' out of 100"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#E7E8E3" stroke-width="10"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - score / 100) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="' + size * 0.3 + '">' + score + "</text></svg>";
  }
  function topIssues() {
    var by = {};
    S.report.pages.forEach(function (p) { p.checks.forEach(function (c) {
      var k = c.id + "|" + c.status; (by[k] = by[k] || { id: c.id, status: c.status, fix: c.fix, sample: c.text, pages: [] }).pages.push(p.url); }); });
    var LABELS = { kw: "No focus keyword set", "title-len": "Google title too long or too short", "desc-len": "Meta description missing or the wrong length", "kw-desc": "Keyword missing from the meta description",
      "kw-title": "Keyword missing from (or late in) the title", alt: "Images without a description (alt text)", "links-int": "No links to other pages on the site", "links-ext": "No links to trusted outside sources",
      length: "Not enough text", "kw-intro": "Keyword missing from the opening paragraph", "kw-sub": "Keyword not in any subheading", "kw-density": "Keyword used too little or too much", "kw-alt": "No image alt text uses the keyword",
      broken: "Broken links", subheadings: "Too few subheadings", canonical: "Missing canonical link", og: "No share image", h1: "Wrong number of main headings (H1)", images: "No images", sentences: "Long sentences", paragraphs: "Long paragraphs", cover: "No cover image", "kw-url": "Keyword not in the web address" };
    return Object.keys(by).map(function (k) { var x = by[k]; x.label = LABELS[x.id] || x.sample; return x; })
      .sort(function (a, b) { return (a.status === "bad" ? 0 : 1) - (b.status === "bad" ? 0 : 1) || b.pages.length - a.pages.length; });
  }
  function overview() {
    var R = S.report, main = $("#main");
    if (!R) { main.innerHTML = '<div class="card empty">The site report hasn\'t been built yet. It appears after the next deploy.</div>'; return; }
    var posts = R.pages.filter(function (p) { return p.type === "Blog post"; }).length, issues = topIssues();
    main.innerHTML = '<div class="head"><div><h1>How your site is doing</h1><p>Checked ' + R.summary.pages + " pages on " + esc(when(R.generated)) + '. The report updates on every deploy.</p></div></div>' +
      '<div class="grid g4"><div class="card ring">' + ring(R.summary.avg) + '<div><b style="font-family:var(--display);font-size:20px">' + GRADE[gradeOf(R.summary.avg)] + '</b><p class="hint" style="margin:4px 0 0">Average SEO score across your pages</p></div></div>' +
      '<div class="card stat"><b>' + R.summary.bad + "</b><span>problems to fix</span></div>" +
      '<div class="card stat"><b>' + R.summary.ok + "</b><span>improvements suggested</span></div>" +
      '<div class="card stat"><b>' + posts + "</b><span>blog posts published</span></div></div>" +
      '<div class="section" id="gscSnap"></div>' +
      '<div class="section"><h2>Fix these first</h2><div class="card">' + (issues.length ? issues.slice(0, 10).map(function (x) {
        return '<div class="issue"><span class="dot ' + x.status + '"></span><div><b>' + esc(x.label) + ' <small>· ' + x.pages.length + " page" + (x.pages.length > 1 ? "s" : "") + "</small></b><p>" + esc(x.fix) + "</p></div></div>"; }).join("") : '<p class="empty">Nothing to fix. Nice work.</p>') +
      '</div><p class="hint" style="margin-top:8px">Open the <a href="#pages" data-go="pages">Pages</a> tab to see the exact problems on each page.</p></div>' +
      '<div class="section"><h2>Whole-site checks</h2><div class="card">' + R.site_checks.map(function (c) {
        return '<div class="issue"><span class="dot ' + c.status + '"></span><div><b>' + esc(c.text) + "</b>" + (c.fix ? "<p>" + esc(c.fix) + "</p>" : "") + "</div></div>"; }).join("") + "</div></div>";
    $$("[data-go]", main).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(a.getAttribute("data-go")); }; });
    var snap = $("#gscSnap");
    if (S.settings && S.settings.gscConnected) {
      snap.innerHTML = '<h2>Google search, last 28 days</h2><div class="card">Loading Search Console…</div>';
      loadGsc(28).then(function (d) { snap.innerHTML = "<h2>Google search, last 28 days</h2>" + gscStats(d); }).catch(function (e) { snap.innerHTML = '<h2>Google search</h2><div class="card"><p class="err">' + esc(e.message) + "</p></div>"; });
    } else snap.innerHTML = '<div class="card"><b>See your real Google clicks and rankings here.</b><p class="hint" style="margin:4px 0 10px">Connect Google Search Console in Settings (about 10 minutes, once).</p><button class="btn ghost" type="button" data-go2="settings">Connect Search Console</button></div>';
    var g2 = $("[data-go2]", snap); if (g2) g2.onclick = function () { go("settings"); };
  }

  /* ---------------- pages ---------------- */
  function pages() {
    var R = S.report, main = $("#main");
    if (!R) { main.innerHTML = '<div class="card empty">No report yet.</div>'; return; }
    main.innerHTML = '<div class="head"><div><h1>Pages</h1><p>Lowest scores first. Click a page to see what to fix.</p></div><label style="min-width:220px">Show<select id="pf"><option value="all">All pages</option><option value="Blog post">Blog posts</option><option value="Page">Other pages</option></select></label></div><div class="card" id="pl"></div>';
    var draw = function () {
      var f = $("#pf").value;
      $("#pl").innerHTML = R.pages.filter(function (p) { return f === "all" || p.type === f; }).map(function (p, i) {
        var slug = postSlug(p.url);
        return '<div class="page"><button type="button" aria-expanded="false" data-i="' + i + '"><span class="score ' + p.grade + '">' + p.score + '</span><span><span class="u">' + esc(p.title) + '</span><br><span class="s">' + esc(p.url) + " · " + p.type + " · " + p.words + " words" + (p.keyword ? ' · keyword <span class="kw">' + esc(p.keyword) + "</span>" : "") + '</span></span><span class="pill ' + p.grade + '">' + p.checks.filter(function (c) { return c.status === "bad"; }).length + " to fix</span></button>" +
          '<div class="body" hidden>' + (p.checks.length ? p.checks.sort(function (a, b) { return (a.status === "bad" ? 0 : 1) - (b.status === "bad" ? 0 : 1); }).map(function (c) { return '<div class="issue"><span class="dot ' + c.status + '"></span><div><b>' + esc(c.text) + "</b>" + (c.fix ? "<p>" + esc(c.fix) + "</p>" : "") + "</div></div>"; }).join("") : '<p>All checks passed.</p>') +
          '<p class="hint">' + p.passed + ' checks passed.</p><div class="row"><a class="btn ghost" href="' + esc(p.url) + '" target="_blank" rel="noopener">Open page ↗</a>' + (slug ? '<a class="btn ghost" href="/admin/#/collections/blog/entries/' + esc(slug) + '" target="_blank" rel="noopener">Edit in /admin ↗</a>' : "") +
          '<button class="btn green" type="button" data-improve="' + esc(p.url) + '">✨ Get AI suggestions</button></div><div class="ai-out"></div></div></div>';
      }).join("");
      $$("#pl .page>button").forEach(function (b) { b.onclick = function () { var body = b.nextElementSibling; body.hidden = !body.hidden; b.setAttribute("aria-expanded", !body.hidden); }; });
      $$("[data-improve]").forEach(function (b) { b.onclick = function () { improve(b); }; });
    };
    $("#pf").onchange = draw; draw();
  }
  function pageText(url) {
    return fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      var d = new DOMParser().parseFromString(html, "text/html"), m = d.querySelector(".prose") || d.querySelector("main");
      $$("script,style,form,dialog,[aria-hidden=true]", m).forEach(function (x) { x.remove(); });
      return (m ? m.textContent : "").replace(/\s+/g, " ").trim();
    });
  }
  function improve(b) {
    var p = S.report.pages.filter(function (x) { return x.url === b.getAttribute("data-improve"); })[0], out = b.parentNode.nextElementSibling;
    if (!S.settings.aiConnected) { out.innerHTML = '<div class="card"><p>Connect the AI assistant in <a href="#settings">Settings</a> first.</p></div>'; return; }
    b.disabled = true; b.textContent = "Thinking…";
    pageText(p.url).then(function (text) {
      return api("/seo/ai", { method: "POST", body: { task: "improve", input: { business: business(), url: p.url, title: p.title, description: p.description, keyword: p.keyword, issues: p.checks.map(function (c) { return c.text; }), text: text } } });
    }).then(function (d) { out.innerHTML = renderAi(d); })
      .catch(function (e) { out.innerHTML = '<p class="err">' + esc(e.message) + "</p>"; })
      .then(function () { b.disabled = false; b.textContent = "✨ Get AI suggestions"; });
  }

  /* ---------------- Search Console ---------------- */
  function loadGsc(days) { return api("/seo/gsc?days=" + days).then(function (d) { S.gsc = d; return d; }); }
  function delta(cur, prev, invert) {
    if (!prev) return ""; var ch = (cur - prev) / prev, good = invert ? ch < 0 : ch > 0;
    if (!isFinite(ch) || Math.abs(ch) < 0.005) return ""; return '<span class="delta ' + (good ? "up" : "down") + '">' + (ch > 0 ? "▲" : "▼") + " " + Math.abs(ch * 100).toFixed(0) + "%</span>";
  }
  function gscStats(d) {
    var c = d.current, p = d.previous;
    return '<div class="grid g4"><div class="card stat"><b>' + fmt(c.clicks) + delta(c.clicks, p.clicks) + "</b><span>clicks from Google</span></div>" +
      '<div class="card stat"><b>' + fmt(c.impressions) + delta(c.impressions, p.impressions) + "</b><span>times you appeared in results</span></div>" +
      '<div class="card stat"><b>' + pct(c.ctr) + delta(c.ctr, p.ctr) + "</b><span>click-through rate</span></div>" +
      '<div class="card stat"><b>' + pos(c.position) + delta(c.position, p.position, true) + "</b><span>average position (lower is better)</span></div></div>" +
      '<p class="hint" style="margin-top:8px">' + esc(d.range.startDate) + " to " + esc(d.range.endDate) + ", compared with the period before. Google's data is about 2 days behind.</p>";
  }
  function chart(daily) {
    if (!daily.length) return '<p class="empty">No data yet for this period.</p>';
    var W = 900, H = 220, P = 30, maxC = Math.max.apply(null, daily.map(function (x) { return x.clicks; }).concat([1])), maxI = Math.max.apply(null, daily.map(function (x) { return x.impressions; }).concat([1]));
    var X = function (i) { return P + i * (W - 2 * P) / Math.max(1, daily.length - 1); };
    var line = function (key, max) { return daily.map(function (x, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + (H - P - x[key] / max * (H - 2 * P)).toFixed(1); }).join(" "); };
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Daily clicks and impressions"><line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="#E2E3DD"/>' +
      '<path d="' + line("impressions", maxI) + '" fill="none" stroke="#8FB8FF" stroke-width="2.5"/><path d="' + line("clicks", maxC) + '" fill="none" stroke="#22AD72" stroke-width="3"/>' +
      '<text x="' + P + '" y="' + (H - 8) + '" font-size="12" fill="#5C5F57">' + esc(daily[0].date) + '</text><text x="' + (W - P) + '" y="' + (H - 8) + '" font-size="12" fill="#5C5F57" text-anchor="end">' + esc(daily[daily.length - 1].date) + "</text></svg>" +
      '<div class="legend"><span><i style="background:#22AD72"></i>Clicks (max ' + fmt(maxC) + ')</span><span><i style="background:#8FB8FF"></i>Impressions (max ' + fmt(maxI) + ")</span></div>";
  }
  function table(rows, label, link) {
    if (!rows.length) return '<p class="empty">No data yet.</p>';
    return '<div class="tw"><table><thead><tr><th>' + label + '</th><th class="n">Clicks</th><th class="n">Impressions</th><th class="n">CTR</th><th class="n">Position</th></tr></thead><tbody>' +
      rows.map(function (r) { return "<tr><td>" + (link ? '<a href="' + esc(r.key) + '" target="_blank" rel="noopener">' + esc(r.key.replace(/^https?:\/\/[^/]+/, "") || "/") + "</a>" : esc(r.key)) + '</td><td class="n">' + fmt(r.clicks) + '</td><td class="n">' + fmt(r.impressions) + '</td><td class="n">' + pct(r.ctr) + '</td><td class="n">' + pos(r.position) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  function gsc() {
    var main = $("#main");
    if (!S.settings.gscConnected) { main.innerHTML = '<div class="head"><div><h1>Search Console</h1><p>Your real performance on Google: clicks, impressions, positions and the searches that find you.</p></div></div>' + gscSetup(); bindSettings(); return; }
    main.innerHTML = '<div class="head"><div><h1>Search Console</h1><p>' + esc(S.settings.gscSite) + '</p></div><label style="min-width:180px">Period<select id="days"><option value="7">Last 7 days</option><option value="28">Last 28 days</option><option value="90">Last 3 months</option></select></label></div><div id="g"><div class="card">Loading…</div></div>';
    $("#days").value = String(S.gscDays);
    var draw = function () {
      S.gscDays = +$("#days").value; $("#g").innerHTML = '<div class="card">Loading…</div>';
      loadGsc(S.gscDays).then(function (d) {
        $("#g").innerHTML = gscStats(d) + '<div class="section card chart">' + chart(d.daily) + "</div>" +
          '<div class="section"><h2>Quick wins</h2><p class="hint" style="margin:-4px 0 10px">Searches where you already appear on page 1–2 but not at the top. Improving the page that ranks for these is the fastest way to more clicks.</p><div class="card">' + table(d.quickWins, "Search") + "</div></div>" +
          '<div class="grid g2 section"><div><h2 style="margin-bottom:12px">Top searches</h2><div class="card">' + table(d.queries.slice(0, 25), "Search") + '</div></div><div><h2 style="margin-bottom:12px">Top pages</h2><div class="card">' + table(d.pages.slice(0, 25), "Page", true) + "</div></div></div>" +
          '<div class="grid g2 section"><div><h2 style="margin-bottom:12px">Devices</h2><div class="card">' + table(d.devices, "Device") + '</div></div><div><h2 style="margin-bottom:12px">Countries</h2><div class="card">' + table(d.countries.map(function (r) { r.key = r.key.toUpperCase(); return r; }), "Country") + "</div></div></div>";
      }).catch(function (e) { $("#g").innerHTML = '<div class="card"><p class="err">' + esc(e.message) + "</p></div>"; });
    };
    $("#days").onchange = draw; draw();
  }

  /* ---------------- AI assistant ---------------- */
  function business() {
    var s = S.site || {};
    return (s.title || "") + ". " + (s.description || "") + " Offices: " + (s.offices || []).join("; ") + ". Services: " + (s.services || []).join(", ") + ". Website: " + (s.url || "");
  }
  var AI_TASKS = [
    ["keywords", "🔑 Keyword ideas", "Find the searches your customers use.", '<label>Topic or service <input name="topic" placeholder="e.g. branding, explainer videos, event coverage"></label><label>Location <input name="location" placeholder="e.g. Dubai, Kozhikode, Kerala"></label>'],
    ["ideas", "💡 Blog post ideas", "10 topics that can bring customers from Google, with outlines.", '<label>Focus (optional) <input name="topic" placeholder="e.g. restaurants in Kerala, startups in Dubai"></label><label>Location <input name="location" placeholder="e.g. UAE and Kerala"></label>'],
    ["draft", "✍️ Write a blog draft", "A full, ready-to-edit post with its SEO fields.", '<label>Post title or topic <input name="title" required placeholder="e.g. How to choose a branding agency in Kerala"></label><label>Focus keyword <input name="keyword" placeholder="e.g. branding agency in Kerala"></label><label>Your notes (optional) <textarea name="notes" placeholder="Points you want covered, your experience, examples…"></textarea></label>'],
    ["meta", "🏷️ Titles & descriptions", "Better Google titles and meta descriptions for any page.", '<label>Page <select name="url"></select></label><label>Focus keyword (optional) <input name="keyword"></label>'],
    ["plan", "📅 30-day ranking plan", "A week-by-week plan for your team.", '<label>Where are you now? (optional) <textarea name="situation" placeholder="e.g. new website, 7 blog posts, Google Business Profile for Dubai only, few reviews"></textarea></label>'],
  ];
  function aiView() {
    var main = $("#main");
    main.innerHTML = '<div class="head"><div><h1>AI assistant</h1><p>Ideas, drafts and wording to help you rank. Always read and adjust before publishing.</p></div></div>' +
      (S.settings.aiConnected ? "" : '<div class="card" style="margin-bottom:14px"><b>Connect the AI assistant first.</b><p class="hint" style="margin:4px 0 10px">Add an Anthropic API key in Settings.</p><button class="btn ghost" type="button" id="toSet">Open Settings</button></div>') +
      '<div class="grid g2">' + AI_TASKS.map(function (t) {
        return '<form class="card form" data-task="' + t[0] + '"><div><h2 style="font-size:20px">' + t[1] + '</h2><p class="hint" style="margin:4px 0 0">' + t[2] + "</p></div>" + t[3] + '<div class="row"><button class="btn" type="submit"' + (S.settings.aiConnected ? "" : " disabled") + '>Generate</button></div><div class="ai-out"></div></form>';
      }).join("") + "</div>";
    var ts = $("#toSet"); if (ts) ts.onclick = function () { go("settings"); };
    var sel = $('[data-task="meta"] select');
    if (sel && S.report) sel.innerHTML = S.report.pages.map(function (p) { return '<option value="' + esc(p.url) + '">' + esc(p.url) + " (" + p.score + ")</option>"; }).join("");
    $$("form[data-task]").forEach(function (f) {
      f.onsubmit = function (e) {
        e.preventDefault(); var task = f.getAttribute("data-task"), b = $("button[type=submit]", f), out = $(".ai-out", f);
        var input = { business: business() }; $$("input,select,textarea", f).forEach(function (x) { if (x.name) input[x.name] = x.value; });
        if (task === "ideas") input.existing = (S.site && S.site.posts) || [];
        b.disabled = true; b.textContent = "Thinking… (up to a minute)"; out.innerHTML = "";
        var prep = Promise.resolve();
        if (task === "meta") {
          var p = S.report.pages.filter(function (x) { return x.url === input.url; })[0] || {};
          input.title = p.title; input.description = p.description; input.keyword = input.keyword || p.keyword;
          prep = pageText(input.url).then(function (t) { input.text = t; });
        }
        prep.then(function () { return api("/seo/ai", { method: "POST", body: { task: task, input: input } }); })
          .then(function (d) { out.innerHTML = renderAi(d); })
          .catch(function (err) { out.innerHTML = '<p class="err">' + esc(err.message) + "</p>"; })
          .then(function () { b.disabled = false; b.textContent = "Generate"; });
      };
    });
  }
  function list(items) { return "<ul>" + (items || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
  function renderAi(d) {
    var x = d.data, h = '<div class="card">';
    if (!x) return h + '<pre class="md">' + esc(d.text) + "</pre></div>";
    if (d.task === "keywords") {
      h += '<div class="tw"><table><thead><tr><th>Keyword</th><th>Intent</th><th>Use on</th><th>Why</th></tr></thead><tbody>' + (x.keywords || []).map(function (k) { return '<tr><td><b>' + esc(k.keyword) + '</b> <button type="button" class="lo" style="min-height:0;padding:2px 8px;font-size:12px" data-copy="' + esc(k.keyword) + '">Copy</button></td><td>' + esc(k.intent) + "</td><td>" + esc(k.use) + "</td><td>" + esc(k.why) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      if (x.tips && x.tips.length) h += "<h3>Tips</h3>" + list(x.tips);
    } else if (d.task === "ideas") {
      h += (x.ideas || []).map(function (i, n) { return "<h3>" + (n + 1) + ". " + esc(i.title) + '</h3><p style="margin:0 0 6px">Keyword <span class="kw">' + esc(i.keyword) + "</span> · for " + esc(i.audience) + "</p>" + list(i.outline); }).join("");
    } else if (d.task === "draft") {
      h += "<h3>SEO fields</h3>" + ["title", "seo_title", "meta_description", "excerpt", "focus_keyword"].map(function (k) { return x[k] ? '<p class="hint" style="margin:8px 0 0">' + k.replace("_", " ") + "</p>" + copyBtn(x[k]) : ""; }).join("") +
        '<h3>Article (Markdown)</h3><div class="row" style="margin-bottom:8px"><button type="button" class="btn" data-copy="' + esc(x.markdown) + '">Copy article</button><a class="btn ghost" href="/admin/#/collections/blog/new" target="_blank" rel="noopener">Create a new post in /admin ↗</a></div><pre class="md">' + esc(x.markdown) + "</pre>" +
        '<p class="hint">Paste the article into the Article field, fill in the SEO fields, add a cover image, then check the score on the right before publishing. Replace any [ADD FIGURE] with your own numbers.</p>';
    } else if (d.task === "meta") {
      if (x.keyword) h += '<p>Suggested keyword: <span class="kw">' + esc(x.keyword) + "</span></p>";
      h += "<h3>Titles</h3>" + (x.titles || []).map(function (t) { return copyBtn(t + "  (" + t.length + " chars)").replace('data-copy="' + esc(t + "  (" + t.length + " chars)") + '"', 'data-copy="' + esc(t) + '"'); }).join("") +
        "<h3>Meta descriptions</h3>" + (x.descriptions || []).map(function (t) { return copyBtn(t + "  (" + t.length + " chars)").replace('data-copy="' + esc(t + "  (" + t.length + " chars)") + '"', 'data-copy="' + esc(t) + '"'); }).join("") + (x.notes ? '<p class="hint">' + esc(x.notes) + "</p>" : "");
    } else if (d.task === "improve") {
      h += "<p>" + esc(x.summary) + "</p><h3>What to do</h3>" + (x.actions || []).map(function (a) { return '<div class="issue"><span class="dot ' + (a.priority === "high" ? "bad" : a.priority === "medium" ? "ok" : "good") + '"></span><div><b>' + esc(a.action) + "</b><p>" + esc(a.why) + "</p></div></div>"; }).join("") +
        (x.title ? "<h3>Suggested title</h3>" + copyBtn(x.title) : "") + (x.description ? "<h3>Suggested meta description</h3>" + copyBtn(x.description) : "") + (x.missing_topics && x.missing_topics.length ? "<h3>Topics to add</h3>" + list(x.missing_topics) : "");
    } else if (d.task === "plan") {
      h += (x.weeks || []).map(function (w) { return "<h3>Week " + esc(w.week) + ": " + esc(w.focus) + "</h3>" + list(w.tasks); }).join("") + (x.ongoing && x.ongoing.length ? "<h3>Every month</h3>" + list(x.ongoing) : "");
    }
    return h + '<p class="hint" style="margin-top:12px">AI requests today: ' + d.usage.today + " of " + d.usage.limit + ".</p></div>";
  }

  /* ---------------- action plan ---------------- */
  var CHECKLIST = [
    ["Submit your sitemap to Google", "In Search Console → Sitemaps, add sitemap.xml. Google then finds every new page and post automatically."],
    ["Claim and complete Google Business Profile — Dubai", "business.google.com: add services, opening hours, photos, the website link and the WhatsApp number. Post an update every week."],
    ["Claim and complete Google Business Profile — Koyilandy", "Use exactly the same name, address and phone as on the website, so Google trusts the listing."],
    ["Ask happy clients for Google reviews", "Send the review link on WhatsApp after each project. Reply to every review. Reviews are one of the biggest local ranking factors."],
    ["Add the business to local directories", "UAE: Yellow Pages UAE, Connect.ae, Dubai Chamber directory. India: Justdial, Sulekha, IndiaMART. Keep name, address and phone identical everywhere."],
    ["Link your social profiles to the website", "Instagram, Facebook, LinkedIn and YouTube bios should all link to the website, and the website links back (already done in the footer)."],
    ["Get links from partners and clients", "Ask clients, event organisers and associations (KMCC, chambers, trade groups) to credit and link “Branding by Aqlyon” on their sites and event pages."],
    ["Publish 2–4 helpful posts a month", "Use the AI assistant for ideas and drafts, add your own experience and examples, and aim for a green score in /admin before publishing."],
    ["Fill in a focus keyword for every post", "Each post should target one search phrase. Fix the red items the live checker shows."],
    ["Add project case studies", "A short page per client project (problem, what you did, results with real figures) ranks for “[service] in [city]” searches and convinces visitors."],
    ["Also verify the site in Bing Webmaster Tools", "Import from Google Search Console in one click. Bing also powers several AI search tools."],
    ["Check the Search Console tab every month", "Look at Quick wins: improve the pages that already appear on page 1–2."],
  ];
  function plan() {
    var done = {}; try { done = JSON.parse(localStorage.getItem("seo-plan") || "{}"); } catch (e) {}
    var n = CHECKLIST.filter(function (c, i) { return done[i]; }).length;
    $("#main").innerHTML = '<div class="head"><div><h1>Action plan</h1><p>Most ranking gains come from work outside the website. Tick items off as you go (saved in this browser).</p></div><span class="pill ' + (n === CHECKLIST.length ? "good" : n ? "ok" : "bad") + '">' + n + " of " + CHECKLIST.length + " done</span></div>" +
      '<div class="card"><ul class="checklist">' + CHECKLIST.map(function (c, i) { return '<li><input type="checkbox" id="c' + i + '" data-i="' + i + '"' + (done[i] ? " checked" : "") + '><label for="c' + i + '" style="display:block;font-weight:400"><b>' + esc(c[0]) + "</b><p>" + esc(c[1]) + "</p></label></li>"; }).join("") + "</ul></div>" +
      '<div class="section card form" style="max-width:none"><h2 style="font-size:20px">Want a plan made for you?</h2><p class="hint" style="margin:0">The AI assistant can turn this into a week-by-week plan for your situation.</p><div class="row"><button class="btn ghost" type="button" id="toAi">Open AI assistant → 30-day plan</button></div></div>';
    $$(".checklist input").forEach(function (c) { c.onchange = function () { done[c.getAttribute("data-i")] = c.checked; try { localStorage.setItem("seo-plan", JSON.stringify(done)); } catch (e) {} plan(); }; });
    $("#toAi").onclick = function () { go("ai"); };
  }

  /* ---------------- settings ---------------- */
  function gscSetup() {
    var s = S.settings;
    return '<div class="card form" id="gscForm"><h2 style="font-size:20px">Google Search Console ' + (s.gscConnected ? '<span class="pill good">Connected</span>' : '<span class="pill bad">Not connected</span>') + "</h2>" +
      '<ol class="steps"><li>In <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Search Console</a>, add your website as a property (a <b>Domain</b> property for <code>aqlyondm.com</code> is best) and verify it. For the HTML-tag method, paste the code into /admin → Site content → Contact details → <i>Google Search Console verification code</i>, then deploy.</li>' +
      '<li>In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a>, create a project (e.g. “Aqlyon SEO”), then go to <b>APIs &amp; Services → Library</b> and enable <b>Google Search Console API</b>.</li>' +
      '<li>Go to <b>IAM &amp; Admin → Service accounts → Create service account</b> (any name). Open it → <b>Keys → Add key → Create new key → JSON</b>. A .json file downloads.</li>' +
      '<li>Back in Search Console → <b>Settings → Users and permissions → Add user</b>: paste the service account email (it ends in <code>iam.gserviceaccount.com</code>) with <b>Restricted</b> permission.</li>' +
      "<li>Paste the whole .json file below, enter the property name, and save.</li></ol>" +
      (s.gscEmail ? '<p class="hint">Connected with ' + esc(s.gscEmail) + ". Paste a new key only if you want to replace it.</p>" : "") +
      '<label>Service account key (.json file contents)<textarea id="gscKey" placeholder="{ &quot;type&quot;: &quot;service_account&quot;, … }" spellcheck="false"></textarea></label>' +
      '<label>Search Console property<input id="gscSite" value="' + esc(s.gscSite) + '" placeholder="sc-domain:aqlyondm.com"><span class="hint">Domain property: <code>sc-domain:aqlyondm.com</code>. URL-prefix property: <code>https://aqlyondm.com/</code> (with the slash).</span></label>' +
      '<p class="err" id="gscErr"></p><div class="row"><button class="btn" type="button" id="gscSave">Save and test</button>' + (s.gscConnected ? '<button class="btn ghost" type="button" id="gscOff">Disconnect</button>' : "") + "</div></div>";
  }
  function bindSettings() {
    var gs = $("#gscSave");
    if (gs) gs.onclick = function () {
      var body = { gscSite: $("#gscSite").value }; if ($("#gscKey").value.trim()) body.gscCredentials = $("#gscKey").value;
      gs.disabled = true; $("#gscErr").textContent = "";
      api("/seo/settings", { method: "PATCH", body: body }).then(function (st) { S.settings = st; return loadGsc(7); })
        .then(function () { toast("Search Console connected"); go(S.tab); })
        .catch(function (e) { $("#gscErr").textContent = e.message; gs.disabled = false; });
    };
    var go2 = $("#gscOff"); if (go2) go2.onclick = function () { api("/seo/settings", { method: "PATCH", body: { gscCredentials: "", gscSite: "" } }).then(function (st) { S.settings = st; toast("Disconnected"); go(S.tab); }); };
    var as = $("#aiSave");
    if (as) as.onclick = function () {
      var body = { model: $("#aiModel").value }; if ($("#aiKey").value.trim()) body.anthropicKey = $("#aiKey").value.trim();
      as.disabled = true; $("#aiErr").textContent = "";
      api("/seo/settings", { method: "PATCH", body: body }).then(function (st) { S.settings = st; toast("Saved"); go(S.tab); })
        .catch(function (e) { $("#aiErr").textContent = e.message; as.disabled = false; });
    };
    var ao = $("#aiOff"); if (ao) ao.onclick = function () { api("/seo/settings", { method: "PATCH", body: { anthropicKey: "" } }).then(function (st) { S.settings = st; toast("Removed"); go(S.tab); }); };
  }
  function settings() {
    var s = S.settings;
    $("#main").innerHTML = '<div class="head"><div><h1>Settings</h1><p>Keys are stored on the server and never shown again after saving.</p></div></div><div class="grid g2">' + gscSetup() +
      '<div class="card form"><h2 style="font-size:20px">AI assistant ' + (s.aiConnected ? '<span class="pill good">Connected</span>' : '<span class="pill bad">Not connected</span>') + "</h2>" +
      '<ol class="steps"><li>Go to <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>, sign in and add a payment method under <b>Billing</b> (you pay per use; a keyword list or a blog draft costs a few cents).</li><li>Open <b>API keys → Create key</b>, copy it (it starts with <code>sk-ant-</code>) and paste it below.</li><li>Optional: set a monthly spend limit in the console.</li></ol>' +
      '<label>Anthropic API key<input id="aiKey" type="password" autocomplete="off" placeholder="' + (s.aiConnected ? "Saved. Paste a new key to replace it." : "sk-ant-…") + '"></label>' +
      '<label>Model<input id="aiModel" value="' + esc(s.model) + '"><span class="hint">Leave as it is unless you know you want a different Claude model.</span></label>' +
      '<p class="hint">The assistant is limited to 150 requests a day to keep costs predictable.</p><p class="err" id="aiErr"></p><div class="row"><button class="btn" type="button" id="aiSave">Save</button>' + (s.aiConnected ? '<button class="btn ghost" type="button" id="aiOff">Remove key</button>' : "") + "</div></div></div>";
    bindSettings();
  }

  /* ---------------- start ---------------- */
  function boot() {
    if (!store.get(TOKEN)) return login();
    app.innerHTML = '<p class="loading">Loading your SEO data…</p>';
    Promise.all([
      api("/seo/settings"),
      fetch("/seo/report.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch("/seo/site.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (a) {
      S.settings = a[0]; S.report = a[1]; S.site = a[2];
      var h = location.hash.slice(1); if (TABS.some(function (t) { return t[0] === h; })) S.tab = h;
      shell(); go(S.tab);
    }).catch(function (e) { if (!/login/i.test(e.message)) app.innerHTML = '<div class="auth"><div class="card"><p class="err">' + esc(e.message) + "</p></div></div>"; });
  }
  window.addEventListener("hashchange", function () { var h = location.hash.slice(1); if (S.settings && h !== S.tab && TABS.some(function (t) { return t[0] === h; })) go(h); });
  boot();
})();
