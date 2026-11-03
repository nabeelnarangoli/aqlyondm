export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/uploads");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.ignores.add("src/admin/**");
  // Event module front end (event pages, badges, /manage, check-in): copied as-is to the site root
  eleventyConfig.addPassthroughCopy({ "src/ev-static": "/" });
  eleventyConfig.ignores.add("src/ev-static/**");
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.png": "favicon.png" });

  const notDraft = (item) => !item.data.draft;
  const byDateDesc = (a, b) => b.date - a.date;
  const byOrder = (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999);

  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/blog/posts/*.md").filter(notDraft).sort(byDateDesc)
  );
  eleventyConfig.addCollection("testimonials", (api) =>
    api.getFilteredByGlob("src/testimonials/*.md").filter(notDraft).sort(byOrder)
  );
  eleventyConfig.addCollection("clients", (api) =>
    api.getFilteredByGlob("src/clients/*.md").filter(notDraft).sort(byOrder)
  );
  eleventyConfig.addCollection("events", (api) =>
    api.getFilteredByGlob("src/events/*.md").filter(notDraft).sort(byDateDesc)
  );

  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString());
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  eleventyConfig.addFilter("waDigits", (s) => String(s || "").replace(/[^0-9]/g, ""));
  eleventyConfig.addFilter("readingTime", (html) => {
    const words = String(html || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  });
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));
  eleventyConfig.addFilter("initial", (s) => String(s || "?").trim().charAt(0).toUpperCase());
  eleventyConfig.addFilter("letters", (s) => String(s || "").split(""));
  eleventyConfig.addFilter("absoluteUrl", (path, base) => {
    try { return new URL(path, base).toString(); } catch { return path; }
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
