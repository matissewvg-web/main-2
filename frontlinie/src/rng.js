// Seeded toeval: elk scenario en elke tafelmap is exact te reproduceren uit zijn seed.
export function hashTekst(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function maakRng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashTekst(String(seed));
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    tussen: (lo, hi) => lo + next() * (hi - lo),
    kans: (p) => next() < p,
    kies: (arr) => arr[Math.floor(next() * arr.length)],
    // items: [{w: gewicht, ...}] -> één item, kans evenredig met w
    gewogen(items) {
      const tot = items.reduce((s, i) => s + Math.max(0, i.w), 0);
      let r = next() * tot;
      for (const i of items) { r -= Math.max(0, i.w); if (r < 0) return i; }
      return items[items.length - 1];
    },
    schud(arr) {
      const b = arr.slice();
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]];
      }
      return b;
    },
  };
}

export function nieuweSeed() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
