// Maakt src/europa-geo.js uit Natural Earth (public domain, via het npm-pakket world-atlas).
// Gebruik: npm install --no-save world-atlas topojson-client && node tools/maak-europa.mjs
// De uitvoer staat in de repo, dus dit hoeft alleen opnieuw als je regio's verandert.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { REGIOTEKST, ZEELINKS, LABELS } from './europa-regios.mjs';
const require = createRequire(process.argv[2] ? process.argv[2] + '/' : import.meta.url);
const { feature } = require('topojson-client');
const landen = require('world-atlas/countries-50m.json');
const landmassa = require('world-atlas/land-50m.json');

const W = 2000, rad = Math.PI / 180;
// Lambert conformal conic: Europa zonder uitgerekt noorden
const f1 = 38 * rad, f2 = 62 * rad, l0 = 17 * rad, f0 = 50 * rad;
const nK = Math.log(Math.cos(f1) / Math.cos(f2)) / Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
const FK = Math.cos(f1) * Math.pow(Math.tan(Math.PI / 4 + f1 / 2), nK) / nK;
const rho = (f) => FK / Math.pow(Math.tan(Math.PI / 4 + f / 2), nK), rho0 = rho(f0);
const ruw = ([lon, lat]) => { const r = rho(lat * rad), t = nK * (lon * rad - l0); return [r * Math.sin(t), rho0 - r * Math.cos(t)]; };
const links = ruw([-10.8, 44])[0], rechts = ruw([49, 46])[0], boven = ruw([17, 71.4])[1], onder = ruw([17, 29.6])[1];
const schaal = W / (rechts - links), H = Math.round((boven - onder) * schaal);
const proj = (p) => { const [x, y] = ruw(p); return [(x - links) * schaal, (boven - y) * schaal]; };

const knip = (ring, nx, ny, c) => { // houdt nx*x+ny*y <= c
  const uit = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], dp = nx * p[0] + ny * p[1] - c, dq = nx * q[0] + ny * q[1] - c;
    if (dp <= 0) uit.push(p);
    if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); uit.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return uit;
};
const opp = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
const dp = (pts, tol) => { // Douglas-Peucker
  if (pts.length < 3) return pts;
  const houd = new Uint8Array(pts.length); houd[0] = houd[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let mx = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - x1) * dy - (pts[i][1] - y1) * dx) / l; if (d > mx) { mx = d; mi = i; } }
    if (mx > tol && mi > 0) { houd[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => houd[i]);
};
const ringenVan = (geom) => (geom.type === 'Polygon' ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0]));
const verwerk = (ring, minOpp) => {
  const oost = ring.some((p) => p[0] > 100); // Eurazië loopt over de datumgrens: Tsjoekotka niet om de wereld laten klappen
  let r = ring.slice(0, -1).map(([lon, lat]) => [oost && lon < -100 ? lon + 360 : lon, lat]);
  r = knip(r, -1, 0, 32); r = knip(r, 1, 0, 88); r = knip(r, 0, -1, -24); r = knip(r, 0, 1, 74); // lon -32..88, lat 24..74
  if (r.length < 3) return null;
  r = r.map(proj);
  r = knip(r, -1, 0, 0); r = knip(r, 1, 0, W); r = knip(r, 0, -1, 0); r = knip(r, 0, 1, H);
  if (r.length < 3 || opp(r) < minOpp) return null;
  // vereenvoudig in twee helften zodat het begin- en eindpunt vastliggen
  const half = r.length >> 1, a = dp(r.slice(0, half + 1), 0.9), b = dp(r.slice(half).concat([r[0]]), 0.9);
  r = a.slice(0, -1).concat(b.slice(0, -1));
  return r.length >= 3 ? r : null;
};

const perLand = {};
for (const f of feature(landen, landen.objects.countries).features) {
  const rs = ringenVan(f.geometry).map((r) => verwerk(r, 14)).filter(Boolean);
  if (rs.length) perLand[f.properties.name] = rs;
}
const regios = REGIOTEKST.trim().split('\n').map((l) => {
  const [id, naam, lnd, zaad, terrein, infra, waarde, fort] = l.split('|'); const [fo, linie] = fort.split(':');
  return { id, naam, landen: lnd.split(';'), zaad: zaad ? proj(zaad.split(',').map(Number)) : null, terrein, infra: infra ? infra.split(',') : [], waarde: +waarde, fort: +fo, linie: linie || '', ringen: [] };
});
for (const r of regios) for (const l of r.landen) if (!perLand[l]) console.warn('land ontbreekt:', l);
// verdeel: elk land-ring gaat naar de regio's die dat land noemen; met zaadpunten via Voronoi
const alleLanden = new Set(regios.flatMap((r) => r.landen));
for (const land of alleLanden) {
  const kand = regios.filter((r) => r.landen.includes(land));
  for (const ring of perLand[land] || []) {
    if (kand.length === 1) { kand[0].ringen.push(ring); continue; }
    for (const r of kand) {
      let deel = ring;
      for (const q of kand) { if (q === r || deel.length < 3) continue; const nx = q.zaad[0] - r.zaad[0], ny = q.zaad[1] - r.zaad[1]; deel = knip(deel, nx, ny, nx * (r.zaad[0] + q.zaad[0]) / 2 + ny * (r.zaad[1] + q.zaad[1]) / 2); }
      if (deel.length >= 3 && opp(deel) > 10) r.ringen.push(deel);
    }
  }
}
for (const r of regios) if (!r.ringen.length) console.warn('LEEG:', r.id);

// labelpunt: opgegeven, anders zaadpunt, anders zwaartepunt van de grootste ring
for (const r of regios) {
  if (LABELS[r.id]) [r.x, r.y] = proj(LABELS[r.id]);
  else if (r.zaad) [r.x, r.y] = r.zaad;
  else { const g = r.ringen.slice().sort((a, b) => opp(b) - opp(a))[0]; let a = 0, cx = 0, cy = 0; for (let i = 0; i < g.length; i++) { const p = g[i], q = g[(i + 1) % g.length], k = p[0] * q[1] - q[0] * p[1]; a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k; } r.x = cx / (3 * a); r.y = cy / (3 * a); }
  r.x = Math.round(Math.max(30, Math.min(W - 30, r.x))); r.y = Math.round(Math.max(20, Math.min(H - 20, r.y)));
}

// buren en gedeelde grenzen: verdicht de randen en zoek punten die tegen een andere regio liggen
const STAP = 2.5, NABIJ = 2.2, CEL = 4;
const dicht = (ring) => { const uit = []; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / STAP)); for (let k = 0; k < n; k++) uit.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); } return uit; };
const rooster = new Map();
regios.forEach((r, ri) => { r.dicht = r.ringen.map(dicht); for (const ring of r.dicht) for (const p of ring) { const k = Math.floor(p[0] / CEL) + ',' + Math.floor(p[1] / CEL); let l = rooster.get(k); if (!l) rooster.set(k, l = []); l.push([p[0], p[1], ri]); } });
const buren = {}, grenzen = {};
regios.forEach((r) => { buren[r.id] = []; });
regios.forEach((r, ri) => {
  const lopen = {}; // per buur: lijst van runs
  for (const ring of r.dicht) {
    let vorige = {};
    for (const p of ring) {
      const cx = Math.floor(p[0] / CEL), cy = Math.floor(p[1] / CEL), raak = new Set();
      if (p[0] > 1 && p[1] > 1 && p[0] < W - 1 && p[1] < H - 1) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of rooster.get((cx + dx) + ',' + (cy + dy)) || []) if (q[2] !== ri && Math.hypot(q[0] - p[0], q[1] - p[1]) < NABIJ) raak.add(q[2]);
      const nu = {};
      for (const b of raak) { const lijst = lopen[b] || (lopen[b] = []); if (vorige[b]) { vorige[b].push(p); nu[b] = vorige[b]; } else { const run = [p]; lijst.push(run); nu[b] = run; } }
      vorige = nu;
    }
  }
  for (const [b, runs] of Object.entries(lopen)) {
    const ander = regios[b], totaal = runs.reduce((s, x) => s + x.length, 0) * STAP;
    if (totaal < 9) continue;
    if (!buren[r.id].includes(ander.id)) buren[r.id].push(ander.id);
    if (!buren[ander.id].includes(r.id)) buren[ander.id].push(r.id);
    const sleutel = [r.id, ander.id].sort().join('|');
    if (!grenzen[sleutel]) grenzen[sleutel] = runs.filter((x) => x.length >= 2).map((x) => dp(x, 0.9));
  }
});
for (const [a, b] of ZEELINKS) { if (!buren[a].includes(b)) buren[a].push(b); if (!buren[b].includes(a)) buren[b].push(a); }

const pad = (ring, sluit) => { let d = '', px = 0, py = 0; ring.forEach((p, i) => { const x = Math.round(p[0]), y = Math.round(p[1]); if (i === 0) d += `M${x} ${y}`; else if (x !== px || y !== py) d += `l${x - px} ${y - py}`; px = x; py = y; }); return d + (sluit ? 'z' : ''); };
const land = ringenVan({ type: 'MultiPolygon', coordinates: feature(landmassa, landmassa.objects.land).features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)) }).map((r) => verwerk(r, 30)).filter(Boolean);
const uit = {
  w: W, h: H, land: land.map((r) => pad(r, true)).join(''),
  regios: regios.map((r) => ({ id: r.id, naam: r.naam, x: r.x, y: r.y, terrein: r.terrein, infra: r.infra, waarde: r.waarde, fort: r.fort, linie: r.linie, d: r.ringen.map((x) => pad(x, true)).join('') })),
  buren, zeelinks: ZEELINKS,
  grenzen: Object.fromEntries(Object.entries(grenzen).map(([k, runs]) => [k, runs.map((x) => pad(x, false)).join('')])),
};
const doel = new URL('../src/europa-geo.js', import.meta.url);
writeFileSync(doel, `// Gegenereerd door tools/maak-europa.mjs uit Natural Earth (public domain). Niet met de hand bewerken.\nexport const EUROPA_GEO = ${JSON.stringify(uit)};\n`);
const losse = regios.filter((r) => !buren[r.id].length).map((r) => r.id);
console.log(`${regios.length} regio's, ${W}×${H}, ${Math.round(JSON.stringify(uit).length / 1024)} kB. Zonder buren: ${losse.join(', ') || 'geen'}`);
for (const r of regios) console.log(' ', r.id.padEnd(15), buren[r.id].join(' '));
