export default {
  layout: "layouts/event.njk",
  permalink: (data) => (data.draft ? false : `/events/${data.page.fileSlug}/`),
};
