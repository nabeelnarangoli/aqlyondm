// A new value on every build, added to CSS/JS links (?v=…) so browsers fetch the
// latest styles and scripts after each deploy instead of an old cached copy.
export default { v: Date.now().toString(36) };
