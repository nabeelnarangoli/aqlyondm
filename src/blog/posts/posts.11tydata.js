export default {
  layout: "layouts/post.njk",
  permalink: (data) => (data.draft ? false : `/blog/${data.page.fileSlug}/`),
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) => !!data.draft,
  },
};
