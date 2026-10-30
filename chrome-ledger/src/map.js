// Kaartgeneratie (plan 1.2) en canvas-render (plan 1.5).
// De kaart heeft een eigen RNG-stroom uit de seed, zodat dezelfde seed en
// hetzelfde aantal districten altijd dezelfde stad geven.

import { maakRng, seedNaarGetal } from './rng.js';

export const BREEDTE = 32;
export const HOOGTE = 20;
const idx = (x, y) => y * BREEDTE + x;
const xy = (t) => [t % BREEDTE, Math.floor(t / BREEDTE)];
const BUREN4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const WATER = -1;

function maakHeap(kleiner) {
  const a = [];
  return {
    get grootte() { return a.length; },
    push(x) {
      a.push(x);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!kleiner(a[i], a[p])) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    },
    pop() {
      const top = a[0];
      const laatste = a.pop();
      if (a.length) {
        a[0] = laatste;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && kleiner(a[l], a[m])) m = l;
          if (r < a.length && kleiner(a[r], a[m])) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]];
          i = m;
        }
      }
      return top;
    },
  };
}

// Stap 1: de Schelde langs de westkant, plus havenbekkens die oostwaarts uitsteken.
function zetWater(rng) {
  const water = new Array(BREEDTE * HOOGTE).fill(false);
  const fase = rng.next() * Math.PI * 2;
  const basis = 3 + rng.int(0, 1);
  const oever = [];
  for (let y = 0; y < HOOGTE; y++) {
    const w = Math.max(2, Math.round(basis + Math.sin(y / 3.2 + fase) * 1.3 + rng.next() - 0.5));
    oever.push(w);
    for (let x = 0; x < w; x++) water[idx(x, y)] = true;
  }
  const bekkens = rng.int(3, 5);
  for (let i = 0; i < bekkens; i++) {
    const y0 = rng.int(1, HOOGTE - 3);
    const hoogte = rng.int(1, 2);
    const lengte = rng.int(2, 5);
    for (let y = y0; y < y0 + hoogte; y++) {
      const eind = Math.min(oever[y] + lengte + rng.int(0, 1), BREEDTE - 6);
      for (let x = oever[y]; x < eind; x++) water[idx(x, y)] = true;
    }
  }
  return water;
}

// Stap 2: zaadpunten op land met minimale onderlinge afstand.
function zaai(rng, land, aantal) {
  let minAfstand = Math.sqrt(land.length / aantal) * 0.8;
  const zaden = [];
  let pogingen = 0;
  while (zaden.length < aantal) {
    const t = land[rng.int(0, land.length - 1)];
    const [x, y] = xy(t);
    if (zaden.every((z) => z.t !== t && Math.hypot(z.x - x, z.y - y) >= minAfstand)) zaden.push({ t, x, y });
    if (++pogingen > 400) {
      minAfstand = Math.max(1, minAfstand * 0.9);
      pogingen = 0;
    }
  }
  return zaden;
}

// Stap 3: voronoi op het raster. Groeit vanaf elk zaad in volgorde van euclidische
// afstand, zodat elk district aaneengesloten blijft (ook rond havenbekkens).
function groei(water, zaden) {
  const eigenaar = water.map((w) => (w ? WATER : -2));
  const heap = maakHeap((a, b) => (a.d - b.d || a.o - b.o || a.t - b.t) < 0);
  zaden.forEach((z, o) => heap.push({ d: 0, t: z.t, o }));
  while (heap.grootte) {
    const { t, o } = heap.pop();
    if (eigenaar[t] !== -2) continue;
    eigenaar[t] = o;
    const [x, y] = xy(t);
    for (const [dx, dy] of BUREN4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= BREEDTE || ny >= HOOGTE) continue;
      const n = idx(nx, ny);
      if (eigenaar[n] === -2) heap.push({ d: Math.hypot(nx - zaden[o].x, ny - zaden[o].y), t: n, o });
    }
  }
  // Losse stukjes land die geen zaad bereikte, worden water.
  return eigenaar.map((e) => (e === -2 ? WATER : e));
}

function kenmerken(eigenaar, aantal) {
  const info = Array.from({ length: aantal }, () => ({ tegels: [], water: 0, rand: 0, sx: 0, sy: 0 }));
  let lx = 0;
  let ly = 0;
  let ln = 0;
  eigenaar.forEach((o, t) => {
    if (o < 0) return;
    const [x, y] = xy(t);
    const i = info[o];
    i.tegels.push(t);
    i.sx += x;
    i.sy += y;
    lx += x;
    ly += y;
    ln++;
    if (BUREN4.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < BREEDTE && ny < HOOGTE && eigenaar[idx(nx, ny)] === WATER;
    })) i.water++;
    if (x === BREEDTE - 1 || y === 0 || y === HOOGTE - 1) i.rand++;
  });
  const mx = lx / ln;
  const my = ly / ln;
  for (const i of info) {
    i.cx = i.sx / i.tegels.length;
    i.cy = i.sy / i.tegels.length;
    i.afstand = Math.hypot(i.cx - mx, i.cy - my);
  }
  const max = (f) => Math.max(...info.map(f)) || 1;
  const maxW = max((i) => i.water / i.tegels.length);
  const maxR = max((i) => i.rand / i.tegels.length);
  const maxA = max((i) => i.afstand);
  const maxG = max((i) => i.tegels.length);
  return info.map((i) => ({
    ...i,
    k: {
      water: i.water / i.tegels.length / maxW,
      rand: i.rand / i.tegels.length / maxR,
      midden: 1 - i.afstand / maxA,
      grootte: i.tegels.length / maxG,
      oost: i.cx / (BREEDTE - 1),
    },
  }));
}

const score = (type, k) => Object.entries(type.plaatsing || {}).reduce((a, [f, w]) => a + w * (k[f] || 0), 0);

// Stap 4: types toewijzen. In de volgorde van districts.json kiest elk type het
// best passende vrije district (Haven eerst aan het water, Zakenkwartier in het midden, ...).
function wijsTypesToe(info, types) {
  const type = new Array(info.length).fill(null);
  for (const t of types.slice(0, info.length)) {
    let beste = -1;
    info.forEach((i, d) => {
      if (type[d] === null && (beste < 0 || score(t, i.k) > score(t, info[beste].k))) beste = d;
    });
    type[beste] = t;
  }
  // Meer districten dan types: herhaalbare types, met een straf per herhaling voor variatie.
  const herhaalbaar = types.filter((t) => t.herhaalbaar);
  const aantal = (t) => type.filter((x) => x === t).length;
  const metStraf = (t, k) => score(t, k) - 1.5 * aantal(t);
  info.forEach((i, d) => {
    if (type[d]) return;
    type[d] = herhaalbaar.reduce((b, t) => (metStraf(t, i.k) > metStraf(b, i.k) ? t : b));
  });
  return type;
}

export function genereerKaart(seed, aantal, data) {
  const rng = maakRng({ rng: seedNaarGetal(`${seed}:kaart`) });
  const water = zetWater(rng);
  const land = water.map((w, t) => (w ? -1 : t)).filter((t) => t >= 0);
  const zaden = zaai(rng, land, aantal);
  const tegels = groei(water, zaden);
  const info = kenmerken(tegels, aantal);
  const types = wijsTypesToe(info, data.districts.types);

  const gebruikt = new Set();
  const districten = info.map((i, id) => {
    const type = types[id];
    // Stap 5: naam uit de naampool van het type.
    const vrij = type.namen.filter((n) => !gebruikt.has(n));
    let naam = vrij.length ? vrij[rng.int(0, vrij.length - 1)] : `${type.naam} ${id + 1}`;
    while (gebruikt.has(naam)) naam += '′';
    gebruikt.add(naam);
    const stats = {};
    for (const s of data.districts.stats) stats[s] = rng.int(...type.waarden[s]);
    stats.heat = 0;
    // Labeltegel: de tegel van het district die het dichtst bij het zwaartepunt ligt.
    const label = i.tegels.reduce((b, t) => {
      const [x, y] = xy(t);
      const [bx, by] = xy(b);
      return Math.hypot(x - i.cx, y - i.cy) < Math.hypot(bx - i.cx, by - i.cy) ? t : b;
    });
    return {
      id, naam, type: type.id, buren: [], stats,
      basis: { loyaliteit: stats.loyaliteit, criminaliteit: stats.criminaliteit },
      slots: rng.int(...type.waarden.slots),
      invloed: {}, gebouwen: [], tegels: i.tegels.length, label,
    };
  });

  // Stap 6: buren.
  tegels.forEach((o, t) => {
    if (o < 0) return;
    const [x, y] = xy(t);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= BREEDTE || ny >= HOOGTE) continue;
      const n = tegels[idx(nx, ny)];
      if (n >= 0 && n !== o && !districten[o].buren.includes(n)) {
        districten[o].buren.push(n);
        districten[n].buren.push(o);
      }
    }
  });
  for (const d of districten) d.buren.sort((a, b) => a - b);

  return { seed: String(seed), breedte: BREEDTE, hoogte: HOOGTE, tegels, districten };
}

// ---- Render ----

const FONT = '"JetBrains Mono", "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace';

// opties: { kleur(d) → css-kleur, geselecteerd, hq, kleuren: { water, golf, grens, kust, selectie, tekst, schaduw } }
export function tekenKaart(canvas, kaart, opties) {
  const { breedte: B, hoogte: H, tegels, districten } = kaart;
  const k = opties.kleuren;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  if (!w) return;
  const tg = w / B;
  const h = tg * H;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = k.water;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = k.golf;
  ctx.lineWidth = 1;
  tegels.forEach((o, t) => {
    if (o !== WATER) return;
    const [x, y] = xy(t);
    if ((x + y) % 2) return;
    ctx.beginPath();
    ctx.moveTo(x * tg + tg * 0.2, y * tg + tg * 0.55);
    ctx.quadraticCurveTo(x * tg + tg * 0.5, y * tg + tg * 0.35, x * tg + tg * 0.8, y * tg + tg * 0.55);
    ctx.stroke();
  });

  const kleuren = districten.map(opties.kleur);
  tegels.forEach((o, t) => {
    if (o < 0) return;
    const [x, y] = xy(t);
    ctx.fillStyle = kleuren[o];
    ctx.fillRect(x * tg, y * tg, tg + 0.5, tg + 0.5);
  });

  const lijn = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1 * tg, y1 * tg);
    ctx.lineTo(x2 * tg, y2 * tg);
    ctx.stroke();
  };
  const grenzen = (filter, kleur, dikte) => {
    ctx.strokeStyle = kleur;
    ctx.lineWidth = dikte;
    ctx.lineCap = 'round';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < B; x++) {
        const a = tegels[idx(x, y)];
        if (x + 1 < B) {
          const b = tegels[idx(x + 1, y)];
          if (a !== b && filter(a, b)) lijn(x + 1, y, x + 1, y + 1);
        }
        if (y + 1 < H) {
          const b = tegels[idx(x, y + 1)];
          if (a !== b && filter(a, b)) lijn(x, y + 1, x + 1, y + 1);
        }
      }
    }
  };
  grenzen((a, b) => a >= 0 && b >= 0, k.grens, Math.max(1.5, tg * 0.09));
  grenzen((a, b) => (a < 0) !== (b < 0), k.kust, Math.max(1, tg * 0.06));
  if (opties.geselecteerd != null) {
    const s = opties.geselecteerd;
    grenzen((a, b) => (a === s) !== (b === s), k.selectie, Math.max(2.5, tg * 0.16));
  }

  // Labels
  const fs = Math.max(9, Math.min(13, tg * 0.42));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const d of districten) {
    const [lx, ly] = xy(d.label);
    const cx = (lx + 0.5) * tg;
    const cy = (ly + 0.5) * tg;
    const regels = breekNaam(ctx, d.naam, tg * 5, fs);
    const top = cy - ((regels.length - 1) * fs * 1.1) / 2;
    ctx.font = `700 ${fs}px ${FONT}`;
    regels.forEach((r, i) => {
      ctx.strokeStyle = k.schaduw;
      ctx.lineWidth = 3;
      ctx.strokeText(r, cx, top + i * fs * 1.1);
      ctx.fillStyle = k.tekst;
      ctx.fillText(r, cx, top + i * fs * 1.1);
    });
    const extra = [d.id === opties.hq ? '★' : '', d.gebouwen.length ? `▦${d.gebouwen.length}` : ''].filter(Boolean).join(' ');
    if (extra) {
      ctx.font = `700 ${fs * 0.9}px ${FONT}`;
      const ey = top + regels.length * fs * 1.1;
      ctx.strokeText(extra, cx, ey);
      ctx.fillStyle = k.selectie;
      ctx.fillText(extra, cx, ey);
    }
  }
}

function breekNaam(ctx, naam, maxBreedte, fs) {
  ctx.font = `700 ${fs}px ${FONT}`;
  if (ctx.measureText(naam).width <= maxBreedte) return [naam];
  const woorden = naam.split(/(?<=[\s-])/);
  const regels = [''];
  for (const w of woorden) {
    const probeer = regels[regels.length - 1] + w;
    if (regels[regels.length - 1] && ctx.measureText(probeer).width > maxBreedte) regels.push(w);
    else regels[regels.length - 1] = probeer;
  }
  return regels.map((r) => r.trim());
}

// Welk district ligt onder dit punt? → id of null.
export function districtOp(canvas, kaart, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((clientX - r.left) / r.width) * kaart.breedte);
  const y = Math.floor(((clientY - r.top) / r.height) * kaart.hoogte);
  if (x < 0 || y < 0 || x >= kaart.breedte || y >= kaart.hoogte) return null;
  const o = kaart.tegels[idx(x, y)];
  return o >= 0 ? o : null;
}
