// One way of writing every participant's name, whatever they typed:
// "HAMEED NAMATH" / "hameed namath" -> "Hameed Namath". Initials stay capital ("Sainudheen vv" -> "Sainudheen VV",
// "K.m. Abhijith" -> "K.M. Abhijith"), short particles keep a capital first letter ("al" -> "Al"), hyphenated parts
// and O'… names are capitalised on each part. Scripts without capital letters (Malayalam, Arabic) are unchanged.
const SMALL = new Set(['al', 'el', 'ul', 'mr', 'dr', 'ms', 'st']);
const VOWEL = /[aeiouy]/i;
const cap = (p) => p.charAt(0).toLocaleUpperCase('en') + p.slice(1).toLocaleLowerCase('en');
export function nameCase(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map((w) => {
    const letters = w.replace(/[^\p{L}]/gu, '');
    if (!letters || letters.toLocaleUpperCase('en') === letters.toLocaleLowerCase('en')) return w; // no case (numbers, other scripts)
    const low = letters.toLocaleLowerCase('en');
    if (SMALL.has(low)) return cap(w);                                                             // Dr. / Al
    if (/\./.test(w) && letters.length <= 4) return w.toLocaleUpperCase('en');                     // K.M. / P.T
    if ((letters.length <= 2 || (letters.length === 3 && !VOWEL.test(letters)))) return w.toLocaleUpperCase('en'); // VV, PT, MKT
    return w.split(/([-'’])/).map((p) => (/^[-'’]$/.test(p) ? p : cap(p))).join('');
  }).join(' ');
}
