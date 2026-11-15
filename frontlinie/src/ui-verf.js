// Tekenlaag voor de Europakaart: gebied is geen tegel maar een ingekleurd vlak.
// Elke cel van een fijn raster heeft een eigenaar; grenzen en frontlijnen volgen de celranden
// en lopen dus grillig mee met wat je tekent. De regio's blijven bestaan voor orders en scenario's:
// een regio is van wie het grootste deel ervan heeft ingekleurd.
import { KAARTEN } from './kaarten.js';
import { FACTIES } from './campagnes.js';
import { kaartVan, herberekenBevoorrading } from './engine.js';

const VG = 5; // celgrootte in kaarteenheden
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
  return (verfBasisCache[sleutel] = { gw, gh, n, regio, land, totaal, landPad: new Path2D(k.geo.land), w: k.w, h: k.h });
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

// Kleurt alle cellen binnen `straal` (kaarteenheden) rond (x, y) voor een land.
export function verfKwast(state, x, y, straal, fid) {
  verfLaad(state);
  const { basis, data } = vh, code = verfCode(state, fid), r = straal / VG, cx = x / VG, cy = y / VG;
  for (let gy = Math.max(0, Math.floor(cy - r)); gy <= Math.min(basis.gh - 1, Math.ceil(cy + r)); gy++) for (let gx = Math.max(0, Math.floor(cx - r)); gx <= Math.min(basis.gw - 1, Math.ceil(cx + r)); gx++) {
    const j = gy * basis.gw + gx;
    if (basis.regio[j] && data[j] !== code && Math.hypot(gx + 0.5 - cx, gy + 0.5 - cy) <= r) { data[j] = code; vh.vuil = true; vh.gekwast = true; }
  }
}

function hexNaarRgb(h) { const v = parseInt(h.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function verfBouw(state) {
  const { basis, data } = vh, { gw, gh } = basis;
  if (!vh.doek) { vh.doek = document.createElement('canvas'); vh.doek.width = basis.w; vh.doek.height = basis.h; vh.klein = document.createElement('canvas'); vh.klein.width = gw; vh.klein.height = gh; }
  const stijl = getComputedStyle(document.documentElement), landKleur = hexNaarRgb((stijl.getPropertyValue('--land') || '#c9cabd').trim());
  const kleuren = [hexNaarRgb(FACTIES.neutraal.kleur)].concat(state.facties.map((f) => hexNaarRgb(f.kleur)));
  const zijden = [''].concat(state.facties.map((f) => (f.zijde === 'neutraal' ? '' : f.zijde)));
  const kctx = vh.klein.getContext('2d'), img = kctx.createImageData(gw, gh), px = img.data;
  for (let j = 0; j < basis.n; j++) {
    if (!basis.land[j] && !basis.regio[j]) continue;
    const k = basis.regio[j] ? kleuren[data[j]] || kleuren[0] : landKleur;
    px[j * 4] = k[0]; px[j * 4 + 1] = k[1]; px[j * 4 + 2] = k[2]; px[j * 4 + 3] = 255;
  }
  kctx.putImageData(img, 0, 0);
  const ctx = vh.doek.getContext('2d');
  ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, basis.w, basis.h);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(vh.klein, 0, 0, gw * VG, gh * VG);
  // grenzen: dun tussen twee landen, dik waar twee zijden tegenover elkaar staan
  const dun = new Path2D(), dik = new Path2D();
  const rand = (a, b, x1, y1, x2, y2) => { if (a === b) return; const p = zijden[a] && zijden[b] && zijden[a] !== zijden[b] ? dik : dun; p.moveTo(x1, y1); p.lineTo(x2, y2); };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const j = y * gw + x; if (!basis.regio[j]) continue;
    if (x + 1 < gw && basis.regio[j + 1]) rand(data[j], data[j + 1], (x + 1) * VG, y * VG, (x + 1) * VG, (y + 1) * VG);
    if (y + 1 < gh && basis.regio[j + gw]) rand(data[j], data[j + gw], x * VG, (y + 1) * VG, (x + 1) * VG, (y + 1) * VG);
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,24,28,0.55)'; ctx.lineWidth = 1.6; ctx.stroke(dun);
  ctx.strokeStyle = '#14181c'; ctx.lineWidth = 5.5; ctx.stroke(dik);
  // de echte kustlijn snijdt de blokjes netjes af
  ctx.globalCompositeOperation = 'destination-in'; ctx.fill(basis.landPad);
  ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(20,24,28,0.5)'; ctx.lineWidth = 1.2; ctx.stroke(basis.landPad);
  vh.vuil = false; vh.thema = stijl.getPropertyValue('--land');
}
export function verfTeken(state, canvas) {
  verfLaad(state);
  if (vh.vuil || !vh.doek || vh.thema !== getComputedStyle(document.documentElement).getPropertyValue('--land')) verfBouw(state);
  const bb = kaartVan(state).bbox, ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(vh.doek, bb.x, bb.y, bb.w, bb.h, 0, 0, canvas.width, canvas.height);
}
