// Eén seeded RNG (mulberry32). De teller zit in houder.rng (het spel-state),
// zodat opslaan en laden exact dezelfde reeks voortzet.

export function seedNaarGetal(seed) {
  // FNV-1a over de seed-tekst
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Alleen om een seed te verzinnen als de speler er geen opgeeft.
export function willekeurigeSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export function maakRng(houder) {
  const next = () => {
    let t = (houder.rng = (houder.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    kans: (p) => next() < p,
    gewogen(items, gewichtVan) {
      const gewichten = items.map(gewichtVan);
      const totaal = gewichten.reduce((a, b) => a + b, 0);
      if (totaal <= 0) return null;
      let r = next() * totaal;
      for (let i = 0; i < items.length; i++) {
        r -= gewichten[i];
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}
