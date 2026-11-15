// Tekenlaag voor de Europakaart: gebied is geen tegel maar een ingekleurd vlak.
// Elke cel van een fijn raster heeft een eigenaar. Bij het tekenen van de kaart wordt dat raster
// vervormd met vaste ruis, zodat grenzen en frontlijnen grillig lopen als een kustlijn. De regio's blijven bestaan voor orders en scenario's:
// een regio is van wie het grootste deel ervan heeft ingekleurd.
import { KAARTEN } from './kaarten.js';
import { FACTIES } from './campagnes.js';
import { kaartVan, herberekenBevoorrading } from './engine.js';

const VG = 5; // celgrootte in kaarteenheden
const VS = 2; // één beeldpunt van de tekenlaag in kaarteenheden
const verfBasisCache = {};
let vh = null; // {cid, bron, data, basis, doek, vuil}

function verfBasis(state) {
  const info = kaartVan(state), k = KAARTEN[state.kaart], sleutel = state.kaart + '|' + (state.subset || []).join(',');
  if (verfBasisCache[sleutel]) return verfBasisCache[sleutel];
  const gw = Math.ceil(k.w / VG), gh = Math.ceil(k.h / VG), n = gw * gh;
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const masker = (d) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, gw, gh); ctx.setTransform(1 / VG, 0, 0, 1 / VG, 0, 0); ctx.fill(new Path2D(d)); return ctx.getImageData(0, 0, gw, gh).data; };
  const regio = new Uint8Array(n);
  info.regios.forEach((r, i) => { const a = masker(r.d); for (let j = 0; j < n; j++) if (a[j * 4 + 3] > 110 && !regio[j]) regio[j] = i + 1; });
  const la = masker(k.geo.land), land = new Uint8Array(n);
  for (let j = 0; j < n; j++) land[j] = la[j * 4 + 3] > 20 ? 1 : 0;
  // kustcellen die net buiten een regio vallen, horen bij de regio ernaast
  for (let ronde = 0; ronde < 3; ronde++) {
    const kopie = regio.slice();
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const j = y * gw + x; if (regio[j] || !land[j]) continue; regio[j] = kopie[j - 1] || kopie[j + 1] || kopie[j - gw] || kopie[j + gw]; }
  }
  const totaal = new Uint32Array(info.regios.length + 1);
  for (let j = 0; j < n; j++) totaal[regio[j]]++;
  // vaste ruis (altijd dezelfde) die de grenzen laat kronkelen: grove bochten plus fijne kartels
  const pw = Math.ceil(k.w / VS), ph = Math.ceil(k.h / VS), wx = new Int8Array(pw * ph), wy = new Int8Array(pw * ph);
  const hash = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295 - 0.5; };
  const ruis = (x, y, golf, z) => { const fx = x / golf, fy = y / golf, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash(x0, y0, z), b = hash(x0 + 1, y0, z), c2 = hash(x0, y0 + 1, z), d = hash(x0 + 1, y0 + 1, z); return a + (b - a) * sx + (c2 - a + (a - b - c2 + d) * sx) * sy; };
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const X = x * VS, Y = y * VS, i = y * pw + x;
    wx[i] = Math.round((ruis(X, Y, 64, 1) * 15 + ruis(X, Y, 22, 2) * 8 + ruis(X, Y, 8, 3) * 3.5) * 8);
    wy[i] = Math.round((ruis(X, Y, 64, 4) * 15 + ruis(X, Y, 22, 5) * 8 + ruis(X, Y, 8, 6) * 3.5) * 8);
  }
  return (verfBasisCache[sleutel] = { gw, gh, n, regio, land, totaal, landPad: new Path2D(k.geo.land), w: k.w, h: k.h, pw, ph, wx, wy, masker });
}
const verfCode = (state, fid) => { const i = state.facties.findIndex((f) => f.id === fid); return i < 0 ? 0 : i + 1; };
const verfFid = (state, code) => (code > 0 && state.facties[code - 1] ? state.facties[code - 1].id : 'neutraal');
function verfCodeer(data) {
  const uit = []; let vorige = data[0], tel = 1;
  for (let j = 1; j < data.length; j++) { if (data[j] === vorige) tel++; else { uit.push(vorige.toString(36) + '.' + tel.toString(36)); vorige = data[j]; tel = 1; } }
  uit.push(vorige.toString(36) + '.' + tel.toString(36));
  return uit.join(',');
}
function verfLaad(state) {
  if (vh && vh.cid === state.id && vh.bron === (state.verf || '')) return;
  const basis = verfBasis(state), info = kaartVan(state), data = new Uint8Array(basis.n);
  if (state.verf) {
    let j = 0;
    for (const stuk of state.verf.split(',')) { const [o, t] = stuk.split('.'); const code = parseInt(o, 36), tel = parseInt(t, 36); data.fill(code, j, j + tel); j += tel; }
  } else {
    const codes = info.regios.map((r) => verfCode(state, state.regios[r.id].eigenaar));
    for (let j = 0; j < basis.n; j++) if (basis.regio[j]) data[j] = codes[basis.regio[j] - 1];
  }
  vh = { cid: state.id, bron: state.verf || '', data, basis, doek: vh && vh.doek ? vh.doek : null, vuil: true };
}

// Houdt tekening en regels gelijk. Geeft true als de state is aangepast (dan opslaan).
export function verfSync(state) {
  verfLaad(state);
  const { basis, data } = vh, info = kaartVan(state), nC = state.facties.length + 1, nR = info.regios.length;
  let nieuw = !state.verf, eigenaarGewijzigd = false, dataGewijzigd = false;
  if (!state.verfEig) { state.verfEig = {}; for (const r of info.regios) state.verfEig[r.id] = state.regios[r.id].eigenaar; }
  const tel = new Uint32Array((nR + 1) * nC);
  for (let j = 0; j < basis.n; j++) if (basis.regio[j]) tel[basis.regio[j] * nC + data[j]]++;
  const vullen = {};
  info.regios.forEach((r, i) => {
    const rs = state.regios[r.id], eng = verfCode(state, rs.eigenaar);
    let maj = 0, top = -1;
    for (let c = 0; c < nC; c++) if (tel[(i + 1) * nC + c] > top) { top = tel[(i + 1) * nC + c]; maj = c; }
    if (rs.eigenaar !== state.verfEig[r.id]) { // de regels hebben de regio van eigenaar gewisseld: kleur haar helemaal in
      if (tel[(i + 1) * nC + eng] !== basis.totaal[i + 1]) vullen[i + 1] = eng;
      state.verfEig[r.id] = rs.eigenaar;
    } else if (maj !== eng && basis.totaal[i + 1] > 0) { // er is getekend: de regio volgt de meerderheid
      rs.eigenaar = verfFid(state, maj); rs.gehoudenSinds = state.beurt; rs.afgesnedenSinds = 0;
      state.verfEig[r.id] = rs.eigenaar; eigenaarGewijzigd = true;
    }
  });
  if (Object.keys(vullen).length) { for (let j = 0; j < basis.n; j++) if (vullen[basis.regio[j]] !== undefined) data[j] = vullen[basis.regio[j]]; dataGewijzigd = true; }
  if (eigenaarGewijzigd) herberekenBevoorrading(state);
  if (nieuw || dataGewijzigd || vh.gekwast) { state.verf = verfCodeer(data); vh.bron = state.verf; vh.vuil = true; vh.gekwast = false; return true; }
  return eigenaarGewijzigd;
}

// Past een getekende lijn toe. modus 'lasso': de lijn is een omtrek en wordt gevuld.
// modus 'kwast': de lijn zelf wordt ingekleurd, `straal` breed. Alleen land binnen het speelveld verandert.
export function verfPasToe(state, punten, fid, modus, straal) {
  verfLaad(state);
  if (punten.length < (modus === 'lasso' ? 3 : 1)) return false;
  const { basis, data } = vh, code = verfCode(state, fid), c = document.createElement('canvas');
  c.width = basis.gw; c.height = basis.gh;
  const ctx = c.getContext('2d'); ctx.setTransform(1 / VG, 0, 0, 1 / VG, 0, 0);
  ctx.beginPath(); punten.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (modus === 'lasso') { ctx.closePath(); ctx.fill(); }
  else { if (punten.length === 1) ctx.lineTo(punten[0].x + 0.1, punten[0].y); ctx.lineWidth = straal * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  const a = ctx.getImageData(0, 0, basis.gw, basis.gh).data; let iets = false;
  for (let j = 0; j < basis.n; j++) if (a[j * 4 + 3] > 127 && basis.regio[j] && data[j] !== code) { data[j] = code; iets = true; }
  if (iets) { vh.vuil = true; vh.gekwast = true; }
  return iets;
}

function hexNaarRgb(h) { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function verfBouw(state) {
  const { basis, data } = vh, { gw, gh, pw, ph, wx, wy } = basis;
  if (!vh.doek) { vh.doek = document.createElement('canvas'); vh.doek.width = basis.w; vh.doek.height = basis.h; vh.klein = document.createElement('canvas'); vh.klein.width = pw; vh.klein.height = ph; }
  const stijl = getComputedStyle(document.documentElement), landKleur = hexNaarRgb((stijl.getPropertyValue('--land') || '#c9cabd').trim());
  const kleuren = [hexNaarRgb(FACTIES.neutraal.kleur)].concat(state.facties.map((f) => hexNaarRgb(f.kleur)));
  const zijden = [''].concat(state.facties.map((f) => (f.zijde === 'neutraal' ? '' : f.zijde)));
  // 1. per beeldpunt: wie is hier de baas? Kijk op de vervormde plek en neem de zwaarste van de vier cellen eromheen.
  const N = pw * ph, baas = new Uint8Array(N); // 0 zee, 255 land buiten het spel, anders code + 1
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const i = y * pw + x, fx = (x * VS + 1 + wx[i] / 8) / VG - 0.5, fy = (y * VS + 1 + wy[i] / 8) / VG - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    let c1 = -1, w1 = 0, c2 = -1, w2 = 0, c3 = -1, w3 = 0;
    for (let k = 0; k < 4; k++) {
      const gx = x0 + (k & 1), gy = y0 + (k >> 1);
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
      const j = gy * gw + gx; if (!basis.regio[j]) continue;
      const w = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty), c = data[j];
      if (c === c1) w1 += w; else if (c === c2) w2 += w; else if (c === c3) w3 += w; else if (c1 < 0) { c1 = c; w1 = w; } else if (c2 < 0) { c2 = c; w2 = w; } else { c3 = c; w3 = w; }
    }
    if (c1 >= 0) { let c = c1, w = w1; if (w2 > w) { c = c2; w = w2; } if (w3 > w) c = c3; baas[i] = c + 1; continue; }
    const j = Math.min(gh - 1, Math.floor(y * VS / VG)) * gw + Math.min(gw - 1, Math.floor(x * VS / VG));
    baas[i] = basis.regio[j] ? data[j] + 1 : basis.land[j] ? 255 : 0;
  }
  // 2. grenzen: dun tussen twee landen, dik waar twee zijden tegenover elkaar staan
  const lijn = new Uint8Array(N);
  const merk = (i, a, b) => {
    if (a === b || !a || !b || a === 255 || b === 255) return;
    const front = zijden[a - 1] && zijden[b - 1] && zijden[a - 1] !== zijden[b - 1];
    if (!front) { if (!lijn[i]) lijn[i] = 1; return; }
    const x = i % pw, y = (i / pw) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < pw && yy < ph) lijn[yy * pw + xx] = 2; }
  };
  for (let y = 0; y < ph - 1; y++) for (let x = 0; x < pw - 1; x++) { const i = y * pw + x; merk(i, baas[i], baas[i + 1]); merk(i, baas[i], baas[i + pw]); }
  // 3. inkleuren
  const kctx = vh.klein.getContext('2d'), img = kctx.createImageData(pw, ph), px = img.data;
  for (let i = 0; i < N; i++) {
    const b = baas[i]; if (!b) continue;
    let k = b === 255 ? landKleur : kleuren[b - 1] || kleuren[0], r = k[0], g = k[1], bl = k[2];
    if (lijn[i] === 2) { r = 20; g = 24; bl = 28; } else if (lijn[i] === 1) { r = r * 0.42 + 8; g = g * 0.42 + 10; bl = bl * 0.42 + 12; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = bl; px[i * 4 + 3] = 255;
  }
  kctx.putImageData(img, 0, 0);
  const ctx = vh.doek.getContext('2d');
  ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, basis.w, basis.h);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(vh.klein, 0, 0, pw * VS, ph * VS);
  // de echte kustlijn snijdt alles netjes af
  ctx.globalCompositeOperation = 'destination-in'; ctx.fill(basis.landPad);
  ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(20,24,28,0.55)'; ctx.lineWidth = 1.3; ctx.stroke(basis.landPad);
  vh.vuil = false; vh.thema = stijl.getPropertyValue('--land');
}
export function verfTeken(state, canvas) {
  verfLaad(state);
  if (vh.vuil || !vh.doek || vh.thema !== getComputedStyle(document.documentElement).getPropertyValue('--land')) verfBouw(state);
  const bb = kaartVan(state).bbox, ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(vh.doek, bb.x, bb.y, bb.w, bb.h, 0, 0, canvas.width, canvas.height);
}

// Toont de lijn die nu getekend wordt, bovenop de kaart.
export function verfVoorbeeld(state, canvas, punten, fid, modus, straal) {
  verfTeken(state, canvas);
  if (!punten.length) return;
  const bb = kaartVan(state).bbox, ctx = canvas.getContext('2d'), f = state.facties.find((x) => x.id === fid), kleur = f ? f.kleur : FACTIES.neutraal.kleur, sch = canvas.width / bb.w;
  ctx.save(); ctx.scale(sch, sch); ctx.translate(-bb.x, -bb.y);
  ctx.beginPath(); punten.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (modus === 'lasso') {
    ctx.save(); ctx.closePath(); ctx.globalAlpha = 0.45; ctx.fillStyle = kleur; ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#14181c'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.stroke();
  } else { ctx.globalAlpha = 0.6; ctx.strokeStyle = kleur; ctx.lineWidth = straal * 2; ctx.stroke(); }
  ctx.restore();
}
