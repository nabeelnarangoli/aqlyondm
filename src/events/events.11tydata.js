// Event photo galleries (website content, edited at /admin) live at /gallery/<slug>/.
// /events/<slug> is reserved for live events with registration from the event manager (/manage).
export default {
  layout: "layouts/event.njk",
  permalink: (data) => (data.draft ? false : `/gallery/${data.page.fileSlug}/`),
};
