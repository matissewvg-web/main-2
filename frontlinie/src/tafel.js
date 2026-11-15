// Tafelmap-generator: bovenaanzicht van de speeltafel, alleen met terrein dat je echt hebt.
// Intern rekent alles in inch; de weergave toont de eenheid die je koos.
import { maakRng } from './rng.js';

export const STUKKEN = {
  bos: { naam: 'Bos', b: 9, h: 7, blok: true, vorm: 'vlek', kleur: '#6f9a5b', rand: '#3f6a34' },
  heuvel: { naam: 'Heuvel', b: 10, h: 7, blok: true, vorm: 'vlek', kleur: '#c9b684', rand: '#8d7a4c' },
  gebouw: { naam: 'Gebouw', b: 4, h: 3, blok: true, vorm: 'recht', kleur: '#a8674e', rand: '#5e3424' },
  kerk: { naam: 'Groot gebouw of kerk', b: 6, h: 4, blok: true, vorm: 'recht', kleur: '#8d5a66', rand: '#4f2c36' },
  ruine: { naam: 'Ruïne', b: 4, h: 4, blok: true, vorm: 'ruine', kleur: '#b9b2a6', rand: '#5c564c' },
  haag: { naam: 'Haag of bocage', b: 6, h: 0.9, blok: true, vorm: 'lijn', kleur: '#3f6a34', rand: '#3f6a34' },
  muur: { naam: 'Muur', b: 5, h: 0.5, blok: false, vorm: 'lijn', kleur: '#7d766a', rand: '#7d766a' },
  veld: { naam: 'Akker of veld', b: 8, h: 6, blok: false, vorm: 'veld', kleur: '#e3d58a', rand: '#a8963f' },
  rotsen: { naam: 'Rotsen', b: 4, h: 3, blok: true, vorm: 'vlek', kleur: '#a39c90', rand: '#5f594f' },
  wadi: { naam: 'Wadi of ravijn', b: 12, h: 3, blok: false, vorm: 'vlek', kleur: '#b99a6a', rand: '#7a5f38' },
  duin: { naam: 'Duin of rug', b: 9, h: 4, blok: true, vorm: 'vlek', kleur: '#ecdca6', rand: '#b09a5a' },
  moeras: { naam: 'Moeras', b: 8, h: 6, blok: false, vorm: 'vlek', kleur: '#8fae9a', rand: '#4d6f5c' },
  krater: { naam: 'Krater of puin', b: 3, h: 3, blok: false, vorm: 'vlek', kleur: '#8a8172', rand: '#4c463b' },
  bunker: { naam: 'Bunker', b: 2.6, h: 2.6, blok: true, vorm: 'bunker', kleur: '#8b8f93', rand: '#3c4044' },
  mijnen: { naam: 'Mijnenveld', b: 8, h: 2, blok: false, vorm: 'mijnen', kleur: '#d9a441', rand: '#7a5410' },
  draad: { naam: 'Prikkeldraad', b: 8, h: 0.7, blok: false, vorm: 'draad', kleur: '#4a4a4a', rand: '#4a4a4a' },
  rivier: { naam: 'Rivier, rand tot rand', speciaal: true, kleur: '#7fb0d0', rand: '#3f7397' },
  brug: { naam: 'Brug', speciaal: true, kleur: '#8a6a45', rand: '#4a3520' },
  weg: { naam: 'Weg, rand tot rand', speciaal: true, kleur: '#d9c9a3', rand: '#9a8a66' },
};

export const STANDAARD_VOORRAAD = { bos: 4, heuvel: 3, gebouw: 5, kerk: 1, ruine: 3, haag: 8, muur: 4, veld: 4, rotsen: 3, wadi: 1, duin: 2, moeras: 1, krater: 3, bunker: 2, mijnen: 2, draad: 3, rivier: 1, brug: 2, weg: 2 };
export const STANDAARD_TAFEL = { b: 72, h: 48, eenheid: 'inch' };

// Gewenste aantallen voor een tafel van 6x4 ft; schaalt mee met het oppervlak.
export const TERREINSETS = {
  steppe: { tekst: 'Open steppe, enkele dorpjes en ravijnen (balka\'s).', s: { heuvel: 2, veld: 3, gebouw: 3, wadi: 2, bos: 1, rotsen: 1 }, wegen: 1, dorpen: 1 },
  akkers: { tekst: 'Akkerland met boerderijen, bosjes en hagen.', s: { veld: 4, bos: 2, gebouw: 4, haag: 5, heuvel: 1, muur: 2 }, wegen: 2, dorpen: 1 },
  bocage: { tekst: 'Bocage: hagen, kleine velden en holle wegen.', s: { haag: 12, veld: 4, gebouw: 3, bos: 2, muur: 2 }, wegen: 2, dorpen: 1 },
  woestijn: { tekst: 'Woestijn: wadi\'s, ruggen en verspreide rotsen.', s: { rotsen: 4, wadi: 2, heuvel: 2, duin: 3, gebouw: 1 }, wegen: 1, dorpen: 0 },
  stad: { tekst: 'Stad: straten, ruïnes en pleinen.', s: { gebouw: 9, ruine: 4, kerk: 1, muur: 4, krater: 3 }, wegen: 2, stad: true },
  bos: { tekst: 'Dicht bos met paden en open plekken.', s: { bos: 7, heuvel: 2, gebouw: 1, veld: 1 }, wegen: 1, dorpen: 0 },
  heuvels: { tekst: 'Heuvels, terrassen en dorpjes op de hoogte.', s: { heuvel: 4, bos: 3, gebouw: 3, veld: 2, muur: 3, haag: 2 }, wegen: 1, dorpen: 1 },
  bergen: { tekst: 'Bergland: steile ruggen, rotsen en een enkele pasweg.', s: { heuvel: 5, rotsen: 4, bos: 2, gebouw: 2, muur: 2 }, wegen: 1, dorpen: 1 },
  rivier: { tekst: 'Rivierlandschap: rivier rand tot rand, brug en oevers.', s: { bos: 2, gebouw: 3, veld: 3, heuvel: 1, haag: 3, moeras: 1 }, wegen: 1, dorpen: 1, rivier: true },
  strand: { tekst: 'Kust: zee, strand, duinen en bunkers.', s: { duin: 4, heuvel: 1, gebouw: 2, haag: 3, bos: 1 }, wegen: 1, dorpen: 1 },
  moeras: { tekst: 'Moeras: natte laagtes, bos en een dijkweg.', s: { moeras: 4, bos: 4, gebouw: 1, veld: 1 }, wegen: 1, dorpen: 0 },
};

const DOELWITTEN = ['Brandstofdepot', 'Radiopost', 'Geschutsstelling', 'Munitieopslag', 'Hoofdkwartier', 'Radarpost'];
const klem = (x, a, b) => Math.max(a, Math.min(b, x));

function afstandTotLijn(p, lijn) {
  let d = Infinity;
  for (let i = 0; i < lijn.length - 1; i++) {
    const a = lijn[i], b = lijn[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = klem(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
    d = Math.min(d, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return d;
}
function puntOpLijn(lijn, t) {
  const i = klem(Math.floor(t * (lijn.length - 1)), 0, lijn.length - 2), f = t * (lijn.length - 1) - i;
  const a = lijn[i], b = lijn[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, hoek: Math.atan2(b.y - a.y, b.x - a.x) };
}

function maakFrame(opst, B, H) {
  // u: 0 = rand van de aanvaller, 1 = rand van de verdediger. v: dwars, 0..1
  if (opst === 'kort') return { as: 'h', pt: (u, v) => ({ x: B * (1 - u), y: H * v }) };
  if (opst === 'diagonaal' || opst === 'hoeken') {
    return { as: 'd', pt: (u, v) => ({ x: klem(B * (1 - u) + (v - 0.5) * B * 0.6, 4, B - 4), y: klem(H * (1 - u) - (v - 0.5) * H * 0.6, 4, H - 4) }) };
  }
  if (opst === 'midden') return { as: 'h', pt: (u, v) => ({ x: B / 2 + (v - 0.5) * B * 0.3, y: H / 2 + (0.6 - u) * H * 0.5 }) };
  return { as: 'v', pt: (u, v) => ({ x: B * v, y: H * (1 - u) }) };
}

function maakZones(opst, B, H, rng) {
  const d = Math.max(8, Math.round(H / 4)), d2 = Math.max(10, Math.round(B / 5));
  const rechth = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const z = [];
  if (opst === 'kort') {
    z.push({ zijde: 'V', label: 'Verdediger', poly: rechth(0, 0, d2, H) }, { zijde: 'A', label: 'Aanvaller', poly: rechth(B - d2, 0, d2, H) });
  } else if (opst === 'diagonaal') {
    z.push({ zijde: 'V', label: 'Verdediger', poly: [{ x: 0, y: 0 }, { x: B * 0.55, y: 0 }, { x: 0, y: H * 0.72 }] },
      { zijde: 'A', label: 'Aanvaller', poly: [{ x: B, y: H }, { x: B * 0.45, y: H }, { x: B, y: H * 0.28 }] });
  } else if (opst === 'hoeken') {
    z.push({ zijde: 'V', label: 'Verdediger', poly: rechth(0, 0, B / 2 - 6, H / 2 - 3) }, { zijde: 'A', label: 'Aanvaller', poly: rechth(B / 2 + 6, H / 2 + 3, B / 2 - 6, H / 2 - 3) });
  } else if (opst === 'midden') {
    z.push({ zijde: 'V', label: 'Verdediger', poly: rechth(B * 0.3, H * 0.2, B * 0.4, H * 0.6) },
      { zijde: 'A', label: 'Aanvaller', poly: rechth(0, 0, 8, H) }, { zijde: 'A', label: 'Aanvaller', poly: rechth(B - 8, 0, 8, H) });
  } else if (opst === 'strand') {
    z.push({ zijde: 'V', label: 'Verdediger', poly: rechth(0, 0, B, H * 0.45) }, { zijde: 'zee', label: 'Zee', poly: rechth(0, H - 6, B, 6) },
      { zijde: 'A', label: 'Landingsstrook', poly: rechth(0, H - 14, B, 8) });
  } else if (opst === 'verspreid') {
    z.push({ zijde: 'V', label: 'Verdediger', poly: rechth(0, 0, B, d) });
    for (let i = 0; i < 3; i++) {
      const cx = B * (0.2 + 0.3 * i) + rng.tussen(-4, 4), cy = H * rng.tussen(0.5, 0.8), r = 7, poly = [];
      for (let k = 0; k < 20; k++) poly.push({ x: klem(cx + Math.cos(k / 20 * 6.283) * r, 0, B), y: klem(cy + Math.sin(k / 20 * 6.283) * r, 0, H) });
      z.push({ zijde: 'A', label: 'Dropzone ' + (i + 1), poly });
    }
  } else {
    z.push({ zijde: 'V', label: 'Verdediger', poly: rechth(0, 0, B, d) }, { zijde: 'A', label: 'Aanvaller', poly: rechth(0, H - d, B, d) });
  }
  return z;
}

export function genereerTafel(opts, seed) {
  const rng = maakRng('tafel:' + seed);
  const eenheid = opts.tafel.eenheid || 'inch';
  const naarInch = eenheid === 'cm' ? 1 / 2.54 : 1;
  const B = opts.tafel.b * naarInch, H = opts.tafel.h * naarInch;
  const scn = opts.scenario || { type: 'doorbraak', obj: 'diep', opstelling: 'lang', fortExtra: {}, grond: 'normaal' };
  const set = TERREINSETS[opts.terrein] || TERREINSETS.akkers;
  const voorraad = Object.assign({}, opts.voorraad || STANDAARD_VOORRAAD);
  const factor = (B * H) / (72 * 48);
  const frame = maakFrame(scn.opstelling, B, H);
  const zones = maakZones(scn.opstelling, B, H, rng);
  const waarschuwingen = [], tekort = [], gebruikt = {};
  const stukken = [], objectives = [], randen = [];
  const neem = (type) => { if ((voorraad[type] || 0) - (gebruikt[type] || 0) > 0) { gebruikt[type] = (gebruikt[type] || 0) + 1; return true; } return false; };
  const over = (type) => (voorraad[type] || 0) - (gebruikt[type] || 0);

  // ── rivier en bruggen ──
  let rivier = null; const bruggen = []; let doorwaad = null;
  const brugScn = scn.obj === 'brug';
  const wilRivier = brugScn || set.rivier || (opts.infraBrug && rng.kans(0.6));
  if (wilRivier) {
    const heeft = (voorraad.rivier || 0) > 0;
    if (heeft || brugScn) {
      if (!heeft) waarschuwingen.push('Geen rivier in je voorraad: markeer hem met blauw lint, vilt of papier.');
      else gebruikt.rivier = 1;
      let langs = frame.as === 'v';
      if (!brugScn && frame.as === 'v' && rng.kans(0.5)) langs = false;
      const basis = langs ? H * (brugScn ? rng.tussen(0.44, 0.56) : rng.tussen(0.4, 0.6)) : B * (brugScn || frame.as !== 'v' ? rng.tussen(0.45, 0.55) : rng.kies([0.28, 0.72]));
      const amp = (langs ? H : B) * 0.06, pts = [];
      let o = 0;
      for (let i = 0; i <= 8; i++) {
        o = klem(o + rng.tussen(-amp, amp) * 0.7, -amp, amp);
        pts.push(langs ? { x: B * i / 8, y: basis + o } : { x: basis + o, y: H * i / 8 });
      }
      rivier = { punten: pts, breedte: 3.5, langs, geimproviseerd: !heeft };
      let nBrug = brugScn && rng.kans(0.35) ? 2 : 1;
      if ((voorraad.brug || 0) < nBrug) {
        if ((voorraad.brug || 0) === 0) { waarschuwingen.push('Geen brug in je voorraad: leg een strook karton over de rivier.'); nBrug = 1; } else nBrug = voorraad.brug;
      }
      const ts = nBrug === 2 ? [0.3, 0.7] : [rng.tussen(0.4, 0.6)];
      for (const t of ts) { const p = puntOpLijn(pts, t); bruggen.push({ x: p.x, y: p.y, hoek: p.hoek, t }); if ((voorraad.brug || 0) > 0) gebruikt.brug = (gebruikt.brug || 0) + 1; }
      if (scn.type !== 'brugopblazen') { const t = rng.kies([0.12, 0.88]); const p = puntOpLijn(pts, t); doorwaad = { x: p.x, y: p.y, hoek: p.hoek }; }
    }
  }

  // ── wegen ──
  const wegen = [];
  const wilWegen = Math.max(set.wegen || 0, scn.obj === 'konvooi' || bruggen.length ? 1 : 0);
  const maakWeg = (lijn) => {
    if ((voorraad.weg || 0) - (gebruikt.weg || 0) > 0) gebruikt.weg = (gebruikt.weg || 0) + 1;
    else if (!waarschuwingen.some((w) => w.startsWith('Te weinig weg'))) waarschuwingen.push('Te weinig weg in je voorraad: markeer de weg met tape of zand.');
    wegen.push(lijn);
  };
  const slinger = (vast, van, tot, horizontaal, ankers) => {
    const pts = []; let o = 0; const amp = 3;
    for (let i = 0; i <= 8; i++) {
      const s = van + (tot - van) * i / 8;
      o = klem(o + rng.tussen(-amp, amp) * 0.6, -amp * 1.5, amp * 1.5);
      let dw = vast + o;
      for (const a of ankers || []) { const d = Math.abs(s - a.s); if (d < 10) dw = a.dw + (dw - a.dw) * (d / 10); }
      pts.push(horizontaal ? { x: s, y: dw } : { x: dw, y: s });
    }
    return pts;
  };
  if (scn.obj === 'konvooi') {
    maakWeg(slinger(H * 0.42, 0, B, true, bruggen.filter(() => rivier && !rivier.langs).map((b) => ({ s: b.x, dw: b.y }))));
  } else if (bruggen.length) {
    for (const b of bruggen) {
      if (rivier.langs) maakWeg(slinger(b.x, 0, H, false, [{ s: b.y, dw: b.x }]));
      else maakWeg(slinger(b.y, 0, B, true, [{ s: b.x, dw: b.y }]));
    }
  } else if (wilWegen >= 1 && ((voorraad.weg || 0) > 0)) {
    if (frame.as === 'h') maakWeg(slinger(H * rng.tussen(0.35, 0.65), 0, B, true));
    else maakWeg(slinger(B * rng.tussen(0.35, 0.65), 0, H, false));
  }
  if (wilWegen >= 2 && wegen.length === 1 && over('weg') > 0 && scn.obj !== 'konvooi') {
    const eersteHor = Math.abs(wegen[0][0].x - wegen[0][8].x) > Math.abs(wegen[0][0].y - wegen[0][8].y);
    const kruistRivier = rivier && (rivier.langs === eersteHor ? false : true);
    if (!kruistRivier) { // tweede weg dwars op de eerste, maar nooit door de rivier zonder brug
      if (eersteHor) { if (!rivier || !rivier.langs) maakWeg(slinger(B * rng.tussen(0.3, 0.7), 0, H, false)); }
      else if (!rivier || rivier.langs === false) maakWeg(slinger(H * rng.tussen(0.3, 0.7), 0, B, true));
    }
  }

  // ── botsingen ──
  const cirkels = (s) => {
    const def = STUKKEN[s.type];
    if (def.vorm === 'lijn' || def.vorm === 'draad') {
      const c = Math.cos(s.rot * Math.PI / 180), si = Math.sin(s.rot * Math.PI / 180), uit = [];
      for (const t of [-0.4, 0, 0.4]) uit.push({ x: s.x + c * s.b * t, y: s.y + si * s.b * t, r: 0.9 });
      return uit;
    }
    return [{ x: s.x, y: s.y, r: Math.max(s.b, s.h) / 2 * 0.88 }];
  };
  const vrij = (s, marge, opties = {}) => {
    const cs = cirkels(s);
    for (const c of cs) {
      if (c.x - c.r < 0.5 || c.y - c.r < 0.5 || c.x + c.r > B - 0.5 || c.y + c.r > H - 0.5) return false;
      if (rivier && afstandTotLijn(c, rivier.punten) < c.r + rivier.breedte / 2 + 0.5) return false;
      if (!opties.opWeg) for (const w of wegen) if (afstandTotLijn(c, w) < c.r * 0.8 + 1.3) return false;
      if (scn.opstelling === 'strand' && c.y + c.r > H - 15 && !opties.strand) return false;
      for (const o of objectives) if (!opties.opDoel && Math.hypot(c.x - o.x, c.y - o.y) < c.r + 2) return false;
      for (const p of stukken) {
        const mg = (STUKKEN[p.type].vorm === 'lijn' || STUKKEN[s.type].vorm === 'lijn') ? Math.min(marge, 0.6) : marge;
        for (const pc of p._c) if (Math.hypot(c.x - pc.x, c.y - pc.y) < c.r + pc.r + mg) return false;
      }
    }
    return true;
  };
  const zet = (type, x, y, rot, opties) => {
    const def = STUKKEN[type];
    const s = { type, x, y, b: def.b, h: def.h, rot: rot || 0, z: rng.int(1, 99999) };
    if (!vrij(s, opties && opties.marge !== undefined ? opties.marge : 2, opties)) return null;
    s._c = cirkels(s); stukken.push(s); return s;
  };
  const probeer = (type, n, kiesPlek, opties) => {
    let gezet = 0;
    for (let i = 0; i < n; i++) {
      if (over(type) <= 0) break;
      for (let k = 0; k < 50; k++) {
        const p = kiesPlek(i, k);
        if (zet(type, p.x, p.y, p.rot, opties)) { gebruikt[type] = (gebruikt[type] || 0) + 1; gezet++; break; }
      }
    }
    return gezet;
  };
  const willekeurig = (type) => () => {
    const def = STUKKEN[type], r = Math.max(def.b, def.h) / 2 + 1;
    return { x: rng.tussen(r, B - r), y: rng.tussen(r, H - r), rot: rng.int(0, 179) };
  };

  // ── objectives (die niet van terrein afhangen) ──
  const doel = (p, label, zijde) => objectives.push({ x: klem(p.x, 3, B - 3), y: klem(p.y, 3, H - 3), label, zijde: zijde || '' });
  const P = frame.pt;
  switch (scn.obj) {
    case 'diep': doel(P(0.86, 0.3), 'Objective 1'); doel(P(0.86, 0.7), 'Objective 2'); break;
    case 'houden': doel(P(0.7, 0.3), 'Objective 1'); doel(P(0.7, 0.7), 'Objective 2'); break;
    case 'snel': doel(P(0.74, 0.3), 'Objective 1'); doel(P(0.74, 0.7), 'Objective 2'); break;
    case 'brug':
      if (bruggen.length) bruggen.forEach((b, i) => doel(b, bruggen.length > 1 ? 'Brug ' + (i + 1) : 'De brug'));
      else doel(P(0.5, 0.5), 'Kruispunt');
      break;
    case 'centraal':
      doel(P(0.3, 0.3), 'Objective', 'A'); doel(P(0.3, 0.7), 'Objective', 'A'); doel(P(0.7, 0.3), 'Objective', 'V'); doel(P(0.7, 0.7), 'Objective', 'V'); break;
    case 'doelwitten': { const n = rng.schud(DOELWITTEN); doel(P(0.8, 0.25), n[0]); doel(P(0.86, 0.55), n[1]); doel(P(0.76, 0.8), n[2]); break; }
    case 'uitgangen': [0.2, 0.5, 0.8].forEach((v, i) => doel({ x: B * v, y: H * 0.5 }, 'Uitgang ' + (i + 1))); break;
    case 'verzamel': doel(P(0.55, 0.2), 'Objective 1'); doel(P(0.72, 0.55), 'Objective 2'); doel(P(0.5, 0.82), 'Objective 3'); break;
    case 'corridor': doel(P(0.95, 0.5), 'Ontzet: ingesloten troepen'); doel(P(0.55, 0.5), 'Kruispunt'); break;
    case 'bunkers': doel(P(0.87, 0.35), 'Objective 1'); doel(P(0.87, 0.65), 'Objective 2'); break;
    case 'konvooi': if (wegen[0]) { doel(wegen[0][0], 'Ingang konvooi'); doel(wegen[0][8], 'Uitgang konvooi'); } break;
    case 'rand_v':
      if (frame.as === 'h') randen.push({ a: { x: 0, y: H * 0.1 }, b: { x: 0, y: H * 0.9 }, label: 'Aftochtrand verdediger' });
      else randen.push({ a: { x: B * 0.1, y: 0 }, b: { x: B * 0.9, y: 0 }, label: 'Aftochtrand verdediger' });
      break;
    case 'uitbraak':
      if (scn.opstelling === 'midden') randen.push({ a: { x: B, y: H * 0.2 }, b: { x: B, y: H * 0.8 }, label: 'Uitbraakrand' });
      else randen.push({ a: { x: B * 0.2, y: H }, b: { x: B * 0.8, y: H }, label: 'Uitbraakrand' });
      break;
    default: break;
  }

  // ── versterkingen uit het scenario ──
  const fx = scn.fortExtra || {};
  const linieU = scn.opstelling === 'strand' ? null : 0.62;
  const fortPlek = (i, n, uExtra) => {
    if (scn.opstelling === 'strand') return { x: B * (i + 0.5) / n + rng.tussen(-3, 3), y: H * 0.5 + uExtra * 18 + rng.tussen(-1, 1), rot: 0 };
    const p = P(linieU + uExtra, (i + 0.5) / n + rng.tussen(-0.05, 0.05));
    return { x: p.x, y: p.y, rot: frame.as === 'h' ? 90 : 0 };
  };
  const zetFort = (type, n, uExtra) => {
    if (!n) return;
    const kan = Math.min(n, over(type));
    if (kan < n) tekort.push({ type, gewenst: n, heeft: voorraad[type] || 0, scenario: true });
    probeer(type, kan, (i, k) => { const p = fortPlek(i, n, uExtra); return { x: p.x + (k ? rng.tussen(-4, 4) : 0), y: p.y + (k ? rng.tussen(-2, 2) : 0), rot: p.rot }; }, { marge: 0.5, strand: true, opWeg: type !== 'bunker' });
  };
  zetFort('bunker', fx.bunkers || 0, 0.02);
  zetFort('mijnen', fx.mijnen || 0, scn.opstelling === 'strand' ? 0.22 : -0.12);
  zetFort('draad', fx.draad || 0, scn.opstelling === 'strand' ? 0.13 : -0.07);

  // ── terreinset ──
  const gewenst = {};
  for (const [t, n] of Object.entries(set.s)) gewenst[t] = Math.max(n > 0 && factor > 0.35 ? 1 : 0, Math.round(n * factor));
  if (scn.ruine && gewenst.gebouw) { const om = Math.min(Math.ceil(gewenst.gebouw / 2), voorraad.ruine || 0); gewenst.ruine = (gewenst.ruine || 0) + om; gewenst.gebouw -= om; gewenst.krater = (gewenst.krater || 0) + 2; }
  if (scn.opstelling === 'strand') gewenst.duin = Math.max(gewenst.duin || 0, Math.round(3 * factor));
  for (const [t, n] of Object.entries(gewenst)) if ((voorraad[t] || 0) < n) tekort.push({ type: t, gewenst: n, heeft: voorraad[t] || 0 });

  // duinen op de duinenrij
  if (scn.opstelling === 'strand' && gewenst.duin) {
    probeer('duin', gewenst.duin, (i) => ({ x: B * (i + 0.5) / gewenst.duin + rng.tussen(-5, 5), y: H * 0.58 + rng.tussen(-2, 2), rot: rng.int(-15, 15) }), { strand: true, marge: 1 });
    gewenst.duin = 0;
  }
  // gebouwen: stad = blokkenraster, anders dorpen bij de weg
  const bouw = ['kerk', 'gebouw', 'ruine'];
  if (set.stad) {
    const cellen = [];
    for (let x = 7; x < B - 5; x += 7.5) for (let y = 6; y < H - 4; y += 7) cellen.push({ x: x + rng.tussen(-0.7, 0.7), y: y + rng.tussen(-0.7, 0.7) });
    const midden = rng.schud(cellen).sort((a, b) => Math.hypot(a.x - B / 2, a.y - H / 2) * rng.tussen(0.6, 1.4) - Math.hypot(b.x - B / 2, b.y - H / 2) * rng.tussen(0.6, 1.4));
    let ci = 0;
    for (const t of bouw) {
      probeer(t, gewenst[t] || 0, () => { const c = midden[ci++ % midden.length]; return { x: c.x, y: c.y, rot: rng.kies([0, 90]) }; }, { marge: 1.2 });
    }
  } else {
    const nDorp = Math.max(1, set.dorpen || 1), centra = [];
    for (let i = 0; i < nDorp; i++) {
      if (wegen.length) { const p = puntOpLijn(rng.kies(wegen), rng.tussen(0.25, 0.75)); centra.push(p); }
      else centra.push({ x: rng.tussen(B * 0.2, B * 0.8), y: rng.tussen(H * 0.25, H * 0.75) });
    }
    for (const t of bouw) {
      probeer(t, gewenst[t] || 0, (i, k) => { const c = centra[i % centra.length], r = 4 + k * 0.25; return { x: c.x + rng.tussen(-r, r), y: c.y + rng.tussen(-r, r), rot: rng.kies([0, 90]) + rng.int(-12, 12) }; }, { marge: 1 });
    }
  }
  // grote vlakken
  for (const t of ['heuvel', 'bos', 'moeras', 'veld', 'wadi', 'duin']) probeer(t, gewenst[t] || 0, willekeurig(t));
  // hagen: bocage = omheiningen op een raster, anders langs velden
  if (gewenst.haag) {
    if (opts.terrein === 'bocage') {
      const kand = [];
      for (let x = 6; x < B; x += 12) for (let y = 6; y < H; y += 12) {
        kand.push({ x: x + 3, y, rot: 0 }, { x: x + 9, y, rot: 0 }, { x, y: y + 3, rot: 90 }, { x, y: y + 9, rot: 90 });
      }
      const lijst = rng.schud(kand); let ki = 0;
      probeer('haag', gewenst.haag, () => { const c = lijst[ki++ % lijst.length]; return { x: c.x + rng.tussen(-1, 1), y: c.y + rng.tussen(-1, 1), rot: c.rot + rng.int(-6, 6) }; }, { marge: 0.4 });
    } else {
      const velden = stukken.filter((s) => s.type === 'veld');
      probeer('haag', gewenst.haag, (i, k) => {
        if (velden.length && k < 25) {
          const v = velden[(i + k) % velden.length], zij = rng.int(0, 3), a = (v.rot + zij * 90) * Math.PI / 180, afst = (zij % 2 ? v.b : v.h) / 2 + 0.9;
          return { x: v.x + Math.cos(a + Math.PI / 2) * afst, y: v.y + Math.sin(a + Math.PI / 2) * afst, rot: v.rot + zij * 90 };
        }
        return willekeurig('haag')();
      }, { marge: 0.3 });
    }
  }
  // muren bij gebouwen
  if (gewenst.muur) {
    const huizen = stukken.filter((s) => bouw.includes(s.type));
    probeer('muur', gewenst.muur, (i, k) => {
      if (huizen.length && k < 30) { const g = rng.kies(huizen), a = rng.kies([0, 90, 180, 270]) * Math.PI / 180; return { x: g.x + Math.cos(a) * (g.b / 2 + 2.2), y: g.y + Math.sin(a) * (g.h / 2 + 2.2), rot: (a * 180 / Math.PI + 90) % 180 }; }
      return willekeurig('muur')();
    }, { marge: 0.3 });
  }
  for (const t of ['rotsen', 'krater']) probeer(t, gewenst[t] || 0, willekeurig(t), { marge: 1 });

  // ── sectoren: objectives op gebouwen ──
  if (scn.obj === 'sectoren') {
    const huizen = stukken.filter((s) => bouw.includes(s.type)).sort((a, b) => Math.hypot(a.x - B / 2, a.y - H / 2) - Math.hypot(b.x - B / 2, b.y - H / 2));
    const gekozen = [];
    for (const g of huizen) { if (gekozen.length >= 5) break; if (gekozen.every((o) => Math.hypot(o.x - g.x, o.y - g.y) > 9)) gekozen.push(g); }
    gekozen.forEach((g, i) => objectives.push({ x: g.x, y: g.y, label: 'Sector ' + (i + 1), zijde: '' }));
    for (let i = gekozen.length; i < 3; i++) doel(P(0.35 + 0.15 * i, 0.25 + 0.25 * i), 'Sector ' + (i + 1));
    if (gekozen.length < 3) waarschuwingen.push('Te weinig gebouwen voor een stadsgevecht: markeer de ontbrekende sectoren als straatblok met karton.');
  }

  // ── schietbanen: geen open strook van rand tot rand ──
  const DREMPEL = 10;
  const raster = () => {
    const W = Math.ceil(B), HH = Math.ceil(H), g = new Uint8Array(W * HH);
    for (const s of stukken) {
      const def = STUKKEN[s.type]; if (!def.blok) continue;
      const c = Math.cos(-s.rot * Math.PI / 180), si = Math.sin(-s.rot * Math.PI / 180), hb = s.b / 2, hh = Math.max(s.h / 2, 0.6), R = Math.ceil(Math.max(hb, hh)) + 1;
      for (let x = Math.max(0, Math.floor(s.x - R)); x < Math.min(W, s.x + R); x++) for (let y = Math.max(0, Math.floor(s.y - R)); y < Math.min(HH, s.y + R); y++) {
        const dx = x + 0.5 - s.x, dy = y + 0.5 - s.y, lx = dx * c - dy * si, ly = dx * si + dy * c;
        const binnen = def.vorm === 'vlek' ? (lx * lx) / (hb * hb) + (ly * ly) / (hh * hh) <= 1 : Math.abs(lx) <= hb && Math.abs(ly) <= hh;
        if (binnen) g[y * W + x] = 1;
      }
    }
    return { g, W, HH };
  };
  const openBanen = () => {
    const { g, W, HH } = raster(), banen = [];
    const scan = (n, m, cel, richting) => {
      let start = -1;
      for (let i = 0; i <= n; i++) {
        let open = i < n;
        if (open) for (let j = 0; j < m; j++) if (cel(i, j)) { open = false; break; }
        if (open && start < 0) start = i;
        if (!open && start >= 0) { if (i - start >= DREMPEL) banen.push({ richting, van: start, tot: i }); start = -1; }
      }
    };
    if (frame.as !== 'h') scan(W, HH, (x, y) => g[y * W + x], 'v');
    if (frame.as !== 'v') scan(HH, W, (y, x) => g[y * W + x], 'h');
    return banen;
  };
  let banen = openBanen();
  for (let ronde = 0; ronde < 12 && banen.length; ronde++) {
    const baan = banen[0], mid = (baan.van + baan.tot) / 2;
    const type = ['bos', 'heuvel', 'rotsen', 'ruine', 'gebouw', 'duin', 'haag'].find((t) => over(t) > 0);
    if (!type) break;
    let ok = false;
    for (let k = 0; k < 40 && !ok; k++) {
      const langs = rng.tussen(0.22, 0.78), dw = mid + rng.tussen(-2, 2);
      const p = baan.richting === 'v' ? { x: dw, y: H * langs } : { x: B * langs, y: dw };
      if (zet(type, p.x, p.y, baan.richting === 'v' ? rng.int(-20, 20) : 90 + rng.int(-20, 20), { marge: 1 })) { gebruikt[type] = (gebruikt[type] || 0) + 1; ok = true; }
    }
    if (!ok) break;
    banen = openBanen();
  }
  if (banen.length) waarschuwingen.push(`${banen.length} open schietba${banen.length > 1 ? 'nen' : 'an'} van rand tot rand: je voorraad is op. Leg er zelf iets in, of speel het als open terrein.`);

  for (const s of stukken) delete s._c;
  return { seed, eenheid, B, H, terrein: opts.terrein, setTekst: set.tekst, grond: scn.grond || 'normaal', opstelling: scn.opstelling, stukken, rivier, bruggen, doorwaad, wegen, objectives, zones, randen, waarschuwingen, tekort, gebruikt };
}

// ───────────────────────── SVG ─────────────────────────
const GROND = { normaal: '#d5dcae', sneeuw: '#eef1f2', modder: '#bfae8b', droog: '#e6d3a1' };
const TERREINGROND = { woestijn: '#e6d3a1', stad: '#cfcbc2', strand: '#d9d9a8', moeras: '#c3cfa6', bergen: '#cfc7a8' };
const f1 = (n) => Math.round(n * 10) / 10;

function vlekPad(s, S) {
  const rng = maakRng(s.z), n = 10, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = rng.tussen(0.78, 1.05); pts.push({ x: Math.cos(a) * s.b / 2 * r * S, y: Math.sin(a) * s.h / 2 * r * S }); }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    d += i === 0 ? `M${f1(mx)} ${f1(my)}` : `Q${f1(p.x)} ${f1(p.y)} ${f1(mx)} ${f1(my)}`;
  }
  const p0 = pts[0], q0 = pts[1];
  return d + `Q${f1(p0.x)} ${f1(p0.y)} ${f1((p0.x + q0.x) / 2)} ${f1((p0.y + q0.y) / 2)}Z`;
}

function tekenStuk(s, S) {
  const def = STUKKEN[s.type], w = s.b * S, h = s.h * S;
  const t = `transform="translate(${f1(s.x * S)} ${f1(s.y * S)}) rotate(${s.rot})"`;
  const st = `fill="${def.kleur}" stroke="${def.rand}" stroke-width="1.2"`;
  switch (def.vorm) {
    case 'vlek': {
      let extra = '';
      if (s.type === 'bos') { const r = maakRng(s.z + 7); for (let i = 0; i < 6; i++) extra += `<circle cx="${f1(r.tussen(-w / 3, w / 3))}" cy="${f1(r.tussen(-h / 3, h / 3))}" r="${f1(S * 0.9)}" fill="#4f7d40" stroke="none"/>`; }
      if (s.type === 'heuvel' || s.type === 'duin') extra = `<path d="${vlekPad({ z: s.z, b: s.b * 0.55, h: s.h * 0.55 }, S)}" fill="none" stroke="${def.rand}" stroke-width="0.8" opacity="0.7"/>`;
      if (s.type === 'moeras') extra = `<path d="M${-w / 4} 0h${w / 6}M0 ${h / 6}h${w / 6}M${-w / 8} ${-h / 5}h${w / 6}" stroke="#3f7397" stroke-width="1.4" fill="none"/>`;
      return `<g ${t}><path d="${vlekPad(s, S)}" ${st}/>${extra}</g>`;
    }
    case 'recht': return `<g ${t}><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" ${st}/><path d="M${-w / 2} 0H${w / 2}" stroke="${def.rand}" stroke-width="0.9"/></g>`;
    case 'ruine': return `<g ${t}><path d="M${-w / 2} ${-h / 2}H${w / 5}M${w / 2} ${-h / 5}V${h / 2}H${-w / 4}M${-w / 2} ${h / 2}V${-h / 2}" fill="none" stroke="${def.rand}" stroke-width="2.4"/><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${def.kleur}" opacity="0.55"/></g>`;
    case 'veld': return `<g ${t}><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" ${st} stroke-dasharray="3 2"/>${[-0.25, 0, 0.25].map((k) => `<path d="M${-w / 2 + 3} ${h * k}H${w / 2 - 3}" stroke="${def.rand}" stroke-width="0.6" opacity="0.6"/>`).join('')}</g>`;
    case 'lijn': return `<g ${t}><path d="M${-w / 2} 0H${w / 2}" stroke="${def.kleur}" stroke-width="${Math.max(3, h)}" stroke-linecap="round"/></g>`;
    case 'draad': { let d = `M${-w / 2} 0`; for (let i = 1; i <= 16; i++) d += `L${f1(-w / 2 + w * i / 16)} ${i % 2 ? -3 : 3}`; return `<g ${t}><path d="${d}" fill="none" stroke="${def.kleur}" stroke-width="1.2"/></g>`; }
    case 'mijnen': return `<g ${t}><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${def.kleur}" fill-opacity="0.45" stroke="${def.rand}" stroke-width="1.2" stroke-dasharray="4 2"/><text y="4" text-anchor="middle" font-size="10" font-weight="700" fill="${def.rand}">MIJNEN</text></g>`;
    case 'bunker': { const r = w / 2; let p = ''; for (let i = 0; i < 6; i++) p += `${f1(Math.cos(i / 6 * 6.283) * r)},${f1(Math.sin(i / 6 * 6.283) * r)} `; return `<g ${t}><polygon points="${p}" ${st} stroke-width="2"/><rect x="${-r / 3}" y="${-r / 6}" width="${r / 1.5}" height="${r / 3}" fill="${def.rand}"/></g>`; }
    default: return '';
  }
}

function staal(type) {
  const def = STUKKEN[type];
  if (def.vorm === 'lijn' || def.vorm === 'draad') return `<path d="M0 7H22" stroke="${def.kleur}" stroke-width="${type === 'draad' ? 1.5 : 4}" stroke-linecap="round" ${type === 'draad' ? 'stroke-dasharray="2 2"' : ''}/>`;
  return `<rect x="1" y="1" width="20" height="12" rx="${def.vorm === 'vlek' ? 6 : 1}" fill="${def.kleur}" stroke="${def.rand}" stroke-width="1"/>`;
}

export function tafelSvg(m, opties = {}) {
  const S = 10, mg = 30, W = m.B * S, H = m.H * S;
  const cm = m.eenheid === 'cm';
  const maat = (inch) => (cm ? Math.round(inch * 2.54) + ' cm' : Math.round(inch) + '″');
  const grond = m.grond !== 'normaal' ? GROND[m.grond] : (TERREINGROND[m.terrein] || GROND.normaal);
  const pad = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + f1(p.x * S) + ' ' + f1(p.y * S)).join('');
  let o = '';
  // raster
  const stap = cm ? 30 / 2.54 : 12;
  let ras = '';
  for (let x = stap; x < m.B - 0.1; x += stap) ras += `<path d="M${f1(x * S)} 0V${H}"/>`;
  for (let y = stap; y < m.H - 0.1; y += stap) ras += `<path d="M0 ${f1(y * S)}H${W}"/>`;
  o += `<rect width="${W}" height="${H}" fill="${grond}"/><g stroke="#000" stroke-opacity="0.13" stroke-width="1" stroke-dasharray="2 4">${ras}</g>`;
  // zones
  const ZK = { A: '#b3402e', V: '#2f5d9b', zee: '#4f8fb8' };
  for (const z of m.zones) {
    const d = pad(z.poly) + 'Z';
    if (z.zijde === 'zee') { o += `<path d="${d}" fill="#7fb0d0"/>`; continue; }
    o += `<path d="${d}" fill="${ZK[z.zijde]}" fill-opacity="0.13" stroke="${ZK[z.zijde]}" stroke-width="2" stroke-dasharray="8 5"/>`;
  }
  // wegen, rivier
  for (const w of m.wegen) o += `<path d="${pad(w)}" fill="none" stroke="#9a8a66" stroke-width="${2.6 * S}" stroke-linejoin="round"/><path d="${pad(w)}" fill="none" stroke="#d9c9a3" stroke-width="${2.2 * S}" stroke-linejoin="round"/>`;
  if (m.rivier) {
    const d = pad(m.rivier.punten);
    o += `<path d="${d}" fill="none" stroke="#3f7397" stroke-width="${(m.rivier.breedte + 0.4) * S}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#7fb0d0" stroke-width="${m.rivier.breedte * S}" stroke-linejoin="round"/>`;
    if (m.doorwaad) o += `<g transform="translate(${f1(m.doorwaad.x * S)} ${f1(m.doorwaad.y * S)}) rotate(${f1(m.doorwaad.hoek * 180 / Math.PI + 90)})"><rect x="${-2.6 * S}" y="${-1.2 * S}" width="${5.2 * S}" height="${2.4 * S}" fill="#b9d3e2" stroke="#3f7397" stroke-dasharray="3 3"/></g>`;
    for (const b of m.bruggen) o += `<g transform="translate(${f1(b.x * S)} ${f1(b.y * S)}) rotate(${f1(b.hoek * 180 / Math.PI + 90)})"><rect x="${-3 * S}" y="${-1.3 * S}" width="${6 * S}" height="${2.6 * S}" fill="#8a6a45" stroke="#4a3520" stroke-width="2"/><path d="M${-3 * S} ${-0.5 * S}H${3 * S}M${-3 * S} ${0.5 * S}H${3 * S}" stroke="#4a3520" stroke-width="1"/></g>`;
  }
  // stukken: vlakken eerst, dan lijnen en gebouwen
  const volg = (s) => ({ veld: 0, moeras: 0, wadi: 0, heuvel: 1, duin: 1, bos: 2, krater: 2, rotsen: 2 }[s.type] ?? 3);
  for (const s of m.stukken.slice().sort((a, b) => volg(a) - volg(b))) o += tekenStuk(s, S);
  // randen
  for (const r of m.randen) {
    const mx = (r.a.x + r.b.x) / 2 * S, my = (r.a.y + r.b.y) / 2 * S, vert = Math.abs(r.a.x - r.b.x) < 0.1;
    o += `<path d="${pad([r.a, r.b])}" stroke="#1d7a4a" stroke-width="9" stroke-linecap="round"/>`;
    o += `<text x="${f1(klem(mx, 60, W - 60))}" y="${f1(vert ? my : klem(my + (my < H / 2 ? 22 : -12), 16, H - 8))}" text-anchor="${vert ? (mx > W / 2 ? 'end' : 'start') : 'middle'}" ${vert ? `dx="${mx > W / 2 ? -12 : 12}"` : ''} font-size="15" font-weight="700" fill="#14573a" stroke="#fff" stroke-width="3" paint-order="stroke">${r.label}</text>`;
  }
  // zonelabels
  for (const z of m.zones) {
    if (z.zijde === 'zee') continue;
    const cx = z.poly.reduce((s, p) => s + p.x, 0) / z.poly.length * S, cy = z.poly.reduce((s, p) => s + p.y, 0) / z.poly.length * S;
    o += `<text x="${f1(cx)}" y="${f1(cy + 5)}" text-anchor="middle" font-size="16" font-weight="700" letter-spacing="1" fill="${ZK[z.zijde]}" stroke="#fff" stroke-opacity="0.8" stroke-width="3.5" paint-order="stroke">${z.label.toUpperCase()}</text>`;
  }
  // objectives
  m.objectives.forEach((ob, i) => {
    const x = ob.x * S, y = ob.y * S, links = x > W - 150;
    o += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${2 * S}" fill="none" stroke="#111" stroke-width="1" stroke-dasharray="3 3"/><circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="#f2c230" stroke="#111" stroke-width="2"/><text x="${f1(x)}" y="${f1(y + 4)}" text-anchor="middle" font-size="11" font-weight="700" fill="#111">${i + 1}</text>`;
    o += `<text x="${f1(x + (links ? -14 : 14))}" y="${f1(y - 12)}" text-anchor="${links ? 'end' : 'start'}" font-size="13" font-weight="700" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${ob.label}${ob.zijde ? ' (helft ' + ob.zijde + ')' : ''}</text>`;
  });
  // kader en maten
  let maten = `<rect width="${W}" height="${H}" fill="none" stroke="#111" stroke-width="2.5"/>`;
  for (let x = 0; x <= m.B + 0.01; x += stap) maten += `<path d="M${f1(x * S)} ${H}v6" stroke="#111"/><text x="${f1(x * S)}" y="${H + 18}" text-anchor="middle" font-size="11" fill="#333">${maat(x)}</text>`;
  for (let y = 0; y <= m.H + 0.01; y += stap) maten += `<path d="M0 ${f1(y * S)}h-6" stroke="#111"/><text x="-9" y="${f1(y * S + 4)}" text-anchor="end" font-size="11" fill="#333">${cm ? Math.round(y * 2.54) : Math.round(y)}</text>`;
  // legenda
  const items = Object.entries(m.gebruikt).filter(([, n]) => n > 0);
  const kol = Math.max(1, Math.floor(W / 170)), rijen = Math.ceil((items.length + 3) / kol);
  let leg = '';
  const alle = items.map(([t, n]) => ({ sw: STUKKEN[t].speciaal ? `<rect x="1" y="3" width="20" height="8" fill="${STUKKEN[t].kleur}" stroke="${STUKKEN[t].rand}"/>` : staal(t), tekst: `${n}× ${STUKKEN[t].naam}` }));
  alle.push({ sw: '<circle cx="11" cy="7" r="6" fill="#f2c230" stroke="#111" stroke-width="1.5"/>', tekst: 'Objective' },
    { sw: '<rect x="1" y="1" width="20" height="12" fill="#b3402e" fill-opacity="0.2" stroke="#b3402e" stroke-dasharray="3 2"/>', tekst: 'Zone aanvaller' },
    { sw: '<rect x="1" y="1" width="20" height="12" fill="#2f5d9b" fill-opacity="0.2" stroke="#2f5d9b" stroke-dasharray="3 2"/>', tekst: 'Zone verdediger' });
  alle.forEach((it, i) => { leg += `<g transform="translate(${(i % kol) * 170} ${Math.floor(i / kol) * 20})">${it.sw}<text x="28" y="11" font-size="12" fill="#222">${it.tekst}</text></g>`; });
  const legH = rijen * 20 + 8;
  const totW = W + mg * 2, totH = H + mg + 26 + legH + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totW} ${totH}" width="${opties.breedte || '100%'}" font-family="system-ui, 'Segoe UI', Arial, sans-serif" role="img" aria-label="Tafelmap"><rect width="${totW}" height="${totH}" fill="#fbfaf5"/><g transform="translate(${mg + 6} ${14})"><defs><clipPath id="tk${m.seed}"><rect width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#tk${m.seed})">${o}</g>${maten}<g transform="translate(0 ${H + 34})">${leg}</g></g></svg>`;
}
