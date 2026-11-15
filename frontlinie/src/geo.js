// Kaartgeometrie: elke regio is een punt; de cel eromheen is een Voronoi-cel,
// begrensd door een cirkel. Twee regio's zijn buren als hun cellen een grens delen.
// Zo klopt wat je ziet altijd met de graaf. Zee = plekken waar geen cel komt.

function knipVlak(poly, nx, ny, c, bron) {
  // houdt het deel waar nx*x + ny*y <= c
  const uit = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = nx * p.x + ny * p.y - c, dq = nx * q.x + ny * q.y - c;
    if (dp <= 0) uit.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      uit.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, bron: dp <= 0 ? bron : p.bron });
    }
  }
  return uit;
}

export function bouwCellen(punten, w, h, straal) {
  const cellen = {}, buren = {};
  for (const p of punten) {
    let poly = [];
    const N = 32;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      poly.push({ x: p.x + Math.cos(a) * straal, y: p.y + Math.sin(a) * straal, bron: null });
    }
    poly = knipVlak(poly, -1, 0, 0, null);
    poly = knipVlak(poly, 1, 0, w, null);
    poly = knipVlak(poly, 0, -1, 0, null);
    poly = knipVlak(poly, 0, 1, h, null);
    for (const q of punten) {
      if (q === p || poly.length < 3) continue;
      const nx = q.x - p.x, ny = q.y - p.y;
      if (nx * nx + ny * ny > 4 * straal * straal) continue;
      poly = knipVlak(poly, nx, ny, nx * (p.x + q.x) / 2 + ny * (p.y + q.y) / 2, q.id);
    }
    cellen[p.id] = poly;
    const set = new Set();
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (a.bron && Math.hypot(b.x - a.x, b.y - a.y) > 10) set.add(a.bron);
    }
    buren[p.id] = set;
  }
  // symmetrisch maken
  const uit = {};
  for (const p of punten) uit[p.id] = [];
  for (const p of punten) for (const q of buren[p.id]) if (buren[q] && buren[q].has(p.id)) uit[p.id].push(q);
  return { cellen, buren: uit };
}

export function afstandPt(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
