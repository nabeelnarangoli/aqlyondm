// Registration form definitions (Google Forms style) and server-side checking of answers.
// The same field types are rendered in the browser by public/js/form-fields.js.
export const STD_FIELDS = ['whatsapp', 'country', 'education', 'role'];   // name, email and mobile are always asked
const TYPES = ['short', 'paragraph', 'choice', 'checkboxes', 'dropdown', 'scale', 'rating', 'grid', 'checkgrid', 'date', 'time', 'file', 'section'];
const OPT = ['choice', 'checkboxes', 'dropdown'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v, n) => String(v ?? '').trim().slice(0, n);
// dropdowns are searchable on the form, so they can hold very long lists (districts, schools, colleges …)
export const MAX_DROPDOWN = 5000;
const list = (a, max, n) => [...new Set((Array.isArray(a) ? a : []).map((x) => str(x, n)).filter(Boolean))].slice(0, max);
const num = (v) => (v === '' || v == null || !isFinite(Number(v)) ? '' : Number(v));

export const defaultForm = () => ({ std: { whatsapp: true, country: true, education: false, role: false }, fields: [] }); // aqlyondm: education level and student/parent are off by default (switch on per event)
export const formOf = (e) => (e && e.form ? e.form : defaultForm());

export function cleanForm(def) {
  const out = defaultForm();
  if (!def || typeof def !== 'object') return out;
  for (const k of STD_FIELDS) if (def.std && def.std[k] !== undefined) out.std[k] = !!def.std[k];
  const seen = new Set();
  for (const f of (Array.isArray(def.fields) ? def.fields : []).slice(0, 40)) {
    if (!f || !TYPES.includes(f.type)) continue;
    let id = /^f[a-z0-9]{3,12}$/.test(f.id) && !seen.has(f.id) ? f.id : 'f' + Math.random().toString(36).slice(2, 9);
    seen.add(id);
    const c = { id, type: f.type, label: str(f.label, 200), help: str(f.help, 500), required: f.type === 'section' ? false : !!f.required };
    if (OPT.includes(f.type)) { c.options = list(f.options, f.type === 'dropdown' ? MAX_DROPDOWN : 50, 120); if (!c.options.length) c.options = ['Option 1']; if (f.type !== 'dropdown') c.other = !!f.other; }
    if (f.type === 'short') { c.valid = ['text', 'number', 'email', 'url', 'phone'].includes(f.valid) ? f.valid : 'text'; if (c.valid === 'number') { c.min = num(f.min); c.max = num(f.max); } }
    if (f.type === 'scale') { c.scaleMin = Number(f.scaleMin) === 0 ? 0 : 1; c.scaleMax = Math.min(10, Math.max(2, parseInt(f.scaleMax, 10) || 5)); c.minLabel = str(f.minLabel, 40); c.maxLabel = str(f.maxLabel, 40); }
    if (f.type === 'rating') c.stars = Math.min(10, Math.max(3, parseInt(f.stars, 10) || 5));
    if (f.type === 'grid' || f.type === 'checkgrid') { c.rows = list(f.rows, 20, 80); c.cols = list(f.cols, 10, 60); if (!c.rows.length) c.rows = ['Row 1']; if (!c.cols.length) c.cols = ['Column 1']; }
    if (f.type === 'file') c.accept = ['image', 'pdf', 'image,pdf'].includes(f.accept) ? f.accept : 'image,pdf';
    if (!c.label && f.type !== 'section') c.label = 'Untitled question';
    out.fields.push(c);
  }
  return out;
}

const inOpts = (f, v) => f.options.includes(v) || (f.other && /^Other: .{1,200}$/s.test(v));

// returns { answers } or { error }; fileOk(id) checks an uploaded file belongs to this event
export async function checkAnswers(form, raw, fileOk) {
  const answers = {}; raw = raw && typeof raw === 'object' ? raw : {};
  for (const f of form.fields) {
    if (f.type === 'section') continue;
    let v = raw[f.id];
    const L = `"${f.label}"`;
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    if (empty) { if (f.required) return { error: `Please answer ${L}.` }; continue; }
    switch (f.type) {
      case 'short': {
        v = str(v, 300);
        if (f.valid === 'number') { const n = Number(v); if (!isFinite(n)) return { error: `${L} must be a number.` }; if (f.min !== '' && f.min != null && n < f.min) return { error: `${L} must be at least ${f.min}.` }; if (f.max !== '' && f.max != null && n > f.max) return { error: `${L} must be at most ${f.max}.` }; }
        if (f.valid === 'email' && !EMAIL.test(v)) return { error: `${L} must be an email address.` };
        if (f.valid === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return { error: `${L} must be a web link starting with https://` };
        if (f.valid === 'phone' && !/^\+?[\d\s\-()]{6,20}$/.test(v)) return { error: `${L} must be a phone number.` };
        break;
      }
      case 'paragraph': v = str(v, 2000); break;
      case 'choice': case 'dropdown': v = str(v, 220); if (!inOpts(f, v)) return { error: `Please choose an option for ${L}.` }; break;
      case 'checkboxes': if (!Array.isArray(v)) return { error: `Please choose options for ${L}.` }; v = list(v, 60, 220); if (!v.every((x) => inOpts(f, x))) return { error: `Please choose options for ${L}.` }; break;
      case 'scale': { const n = parseInt(v, 10); if (!(n >= f.scaleMin && n <= f.scaleMax)) return { error: `Please pick a number for ${L}.` }; v = String(n); break; }
      case 'rating': { const n = parseInt(v, 10); if (!(n >= 1 && n <= f.stars)) return { error: `Please give a rating for ${L}.` }; v = String(n); break; }
      case 'grid': case 'checkgrid': {
        if (typeof v !== 'object' || Array.isArray(v)) return { error: `Please answer ${L}.` };
        const o = {};
        for (const [r, c] of Object.entries(v)) {
          if (!f.rows.includes(r)) continue;
          if (f.type === 'grid') { if (f.cols.includes(c)) o[r] = c; }
          else { const cs = (Array.isArray(c) ? c : []).filter((x) => f.cols.includes(x)); if (cs.length) o[r] = cs; }
        }
        if (f.required && Object.keys(o).length < f.rows.length) return { error: `Please answer every row of ${L}.` };
        if (!Object.keys(o).length) continue; v = o; break;
      }
      case 'date': v = str(v, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${L} must be a date.` }; break;
      case 'time': v = str(v, 5); if (!/^\d{2}:\d{2}$/.test(v)) return { error: `${L} must be a time.` }; break;
      case 'file': { const meta = await fileOk(String(v)); if (!meta) return { error: `The file for ${L} did not upload. Please choose it again.` }; v = meta; break; }
    }
    answers[f.id] = v;
  }
  return { answers };
}

// a readable value for emails, WhatsApp messages and exports
export function showAnswer(f, v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (f && f.type === 'file' && typeof v === 'object') return v.name || 'File';
  if (typeof v === 'object') return Object.entries(v).map(([r, c]) => `${r}: ${Array.isArray(c) ? c.join(', ') : c}`).join('; ');
  if (f && f.type === 'rating') return `${v} / ${f.stars || 5}`;
  return String(v);
}
