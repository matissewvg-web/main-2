/*
 * Pillage Ransack engine: map generation, campaign rules and the save format.
 * No DOM access, so the same file runs in the page and under `node --test`.
 *
 * The campaign is event-sourced: territories hold only their fixed traits
 * (position, gold value, base garrison, terrain) and the raids, adjustments and
 * the current season are the history. replay() derives everything else
 * (control, current garrison, burn damage, status, treasury, army, morale,
 * milestones), so deleting or resolving a raid can never leave the map out of
 * sync with the log.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PREngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAP_W = 1000;
  const MAP_H = 700;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const TERRAINS = ['grassland', 'forest', 'hills', 'mountains', 'marsh', 'coast'];
  const STATUSES = ['unclaimed', 'claimed', 'contested', 'conquered'];
  const OUTCOMES = ['success', 'failure', 'ongoing'];
  const MIN_TERRITORIES = 15;
  const MAX_TERRITORIES = 40;
  // Shared Voronoi edges shorter than this don't count as a land border.
  const MIN_SHARED_EDGE = 6;
  // 100 map units on the scale bar.
  const LEAGUES_PER_100 = 10;

  // Placeholder rules. Pillage Ransack had none written down, so these are
  // invented; change them here and every derived number follows.
  const RULES = {
    successControl: 40,        // control gained per successful raid (100 = conquered)
    failureControl: -25,       // control lost per failed raid
    successGarrisonMult: 0.6,  // defenders left after a successful raid
    failureGarrisonMult: 1.1,  // defenders grow after repelling a raid...
    garrisonCapMult: 1.5,      // ...up to 1.5x their base strength
    regenPerSeason: 0.15,      // share of base garrison restored each season
    tributeRate: 0.2,          // share of gold value a conquered territory pays per season
    claimedTributeFactor: 0.5, // claimed land pays this x control% of full tribute
    moraleSuccess: 5,
    moraleFailure: -10,
    moraleConquest: 10,
    damagePerFailure: 1,
    damageMax: 3,
    damageHealPerSeason: 0.5,
    heavyDefeatShare: 0.25,    // a failure costing this share of the army is a milestone
    heavyDefeatMin: 10,
    provisionPct: 5,           // a warband's provisions cost this share of its gp value, paid when it sets out
    gpPerMan: 40,              // gp of an ordinary warrior: warband strength for the odds is its value / this
  };

  /* ---------- Pillage: factions, troops and their gold-piece costs ---------- */

  // Pillage: Ransack the Middle Ages (Victrix) prices every figure in gold pieces (gp) by its
  // equipment, and the same kit costs differently per faction. The full tables are in the rulebook.
  // src says where each price comes from: 'book' = a published example, 'range' = inside the book's
  // 30-50 gp range for warriors, 'est' = an estimate. A campaign can override any price (c.costs).
  const FACTIONS = {
    vikings: {
      label: 'Vikings',
      troops: [
        { id: 'chieftain', label: 'Jarl', gp: 70, src: 'est', note: 'leads the warband' },
        { id: 'elite', label: 'Hirdman', gp: 60, src: 'est', note: 'household warrior, full armour' },
        { id: 'warrior', label: 'Bondi warrior', gp: 40, src: 'range', note: 'shield and spear or axe, some armour' },
        { id: 'archer', label: 'Bowman', gp: 40, src: 'est', note: 'bow, no armour' },
        { id: 'levy', label: 'Thrall', gp: 30, src: 'range', note: 'spear, no armour' },
      ],
    },
    saxons: {
      label: 'Anglo-Saxons',
      troops: [
        { id: 'chieftain', label: 'Chieftain', gp: 70, src: 'book', note: 'leads the warband' },
        { id: 'elite', label: 'Huscarl', gp: 60, src: 'book', note: 'household warrior, full armour' },
        { id: 'warrior', label: 'Fyrd warrior', gp: 40, src: 'range', note: 'shield and spear, some armour' },
        { id: 'archer', label: 'Bowman', gp: 40, src: 'est', note: 'bow, no armour' },
        { id: 'levy', label: 'Ceorl', gp: 30, src: 'range', note: 'spear, no armour' },
      ],
    },
    normans: {
      label: 'Normans',
      troops: [
        { id: 'chieftain', label: 'Lord', gp: 70, src: 'est', note: 'leads the warband' },
        { id: 'knight', label: 'Mounted knight', gp: 135, src: 'book', note: 'horse, heavy armour, shield, spear' },
        { id: 'elite', label: 'Man-at-arms', gp: 60, src: 'est', note: 'on foot, full armour' },
        { id: 'warrior', label: 'Serjeant', gp: 40, src: 'range', note: 'shield and spear, some armour' },
        { id: 'archer', label: 'Crossbowman', gp: 40, src: 'est', note: 'crossbow, some armour' },
        { id: 'levy', label: 'Levy', gp: 30, src: 'range', note: 'spear, no armour' },
      ],
    },
    irish: {
      label: 'Irish',
      troops: [
        { id: 'chieftain', label: 'R\u00ed', gp: 70, src: 'est', note: 'leads the warband' },
        { id: 'elite', label: 'Champion', gp: 60, src: 'est', note: 'picked warrior, some armour' },
        { id: 'warrior', label: 'Warrior', gp: 40, src: 'range', note: 'shield and spear' },
        { id: 'levy', label: 'Kern', gp: 30, src: 'range', note: 'javelins, no armour' },
      ],
    },
  };
  const FACTION_IDS = Object.keys(FACTIONS);
  const TROOP_SRC = { book: 'rulebook example', range: 'inside the rulebook\u2019s 30\u201350 gp warrior range', est: 'estimate' };

  // The five scenarios in the Pillage rulebook. A raid records which one was played on the table.
  const SCENARIOS = {
    pitched: 'Pitched Battle',
    pillage: 'Pillage!',
    landing: 'Landing',
    pilgrimage: 'Pilgrimage',
    stbrice: 'St. Brice\u2019s Day Massacre',
  };

  const TERRAIN_STATS = {
    grassland: { gold: 1.25, garrison: 0.9, defense: 1.0, label: 'Grassland' },
    forest: { gold: 0.9, garrison: 1.0, defense: 1.15, label: 'Forest' },
    hills: { gold: 1.0, garrison: 1.2, defense: 1.25, label: 'Hills' },
    mountains: { gold: 0.85, garrison: 1.4, defense: 1.5, label: 'Mountains' },
    marsh: { gold: 0.6, garrison: 0.7, defense: 1.2, label: 'Marsh' },
    coast: { gold: 1.3, garrison: 1.0, defense: 1.0, label: 'Coast' },
  };

  const DEFAULT_START = { treasury: 100, army: 60, morale: 60 };

  /* ---------- randomness ---------- */

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth 2D value noise in [-1, 1].
  function valueNoise(seed) {
    const s = seed | 0;
    function lattice(x, y) {
      let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      n ^= n >>> 16;
      return ((n >>> 0) / 4294967295) * 2 - 1;
    }
    return function (x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      const a = lattice(xi, yi);
      const b = lattice(xi + 1, yi);
      const c = lattice(xi, yi + 1);
      const d = lattice(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  const SEED_WORDS = [
    'ember', 'wolf', 'raven', 'salt', 'iron', 'thorn', 'ash', 'frost', 'mire', 'crown',
    'stag', 'brine', 'oak', 'hollow', 'gale', 'rook', 'flint', 'barrow', 'tide', 'cinder',
  ];

  function randomSeed() {
    const r = Math.random;
    const a = SEED_WORDS[Math.floor(r() * SEED_WORDS.length)];
    const b = SEED_WORDS[Math.floor(r() * SEED_WORDS.length)];
    return a + '-' + b + '-' + Math.floor(r() * 900 + 100);
  }

  /* ---------- geometry ---------- */

  // Engine 1 (the first release) drew these three; engine 2 draws them all.
  const SHAPES1 = ['island', 'archipelago', 'mainland'];
  const SHAPES = ['island', 'archipelago', 'mainland', 'inland', 'strait', 'fjords', 'peninsula'];
  const SHAPE_LABEL = { island: 'Island', archipelago: 'Archipelago', mainland: 'Mainland coast', inland: 'Inland sea', strait: 'Twin lands', fjords: 'Fjord coast', peninsula: 'Peninsula', europe: 'Europe, c. 1000' };
  // Map furniture the coastline should stay clear of: cartouche, compass rose, scale bar.
  const DECOR_ZONES = [
    [14, 12, 258, 72],
    [880, 30, 985, 135],
    [100, 650, 300, 690],
    [826, 628, 1000, 700], // zoom buttons
  ];

  function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function ellipsePolygon(cx, cy, rx, ry, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  // Keep the part of `poly` where nx*x + ny*y <= c. labels[k] names what
  // produced edge poly[k] -> poly[k+1]: a neighbour index, -1 for coast, -2 for
  // the map edge (land that carries on off the map).
  function clipHalfPlane(poly, labels, nx, ny, c, label) {
    const f = (p) => p[0] * nx + p[1] * ny - c;
    const out = [];
    const outLabels = [];
    const n = poly.length;
    for (let k = 0; k < n; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % n];
      const fa = f(a);
      const fb = f(b);
      if (fa <= 0) {
        out.push(a);
        outLabels.push(labels[k]);
        if (fb > 0) {
          const t = fa / (fa - fb);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          outLabels.push(label);
        }
      } else if (fb <= 0) {
        const t = fa / (fa - fb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        outLabels.push(labels[k]);
      }
    }
    return [out, outLabels];
  }

  // Keep the part of `poly` closer to `site` than to `other`.
  function clipCell(poly, labels, site, other, otherIdx) {
    const nx = other[0] - site[0];
    const ny = other[1] - site[1];
    const c = ((site[0] + other[0]) / 2) * nx + ((site[1] + other[1]) / 2) * ny;
    return clipHalfPlane(poly, labels, nx, ny, c, otherIdx);
  }

  // Voronoi cells by half-plane clipping. O(n^2), which is nothing for 25 sites
  // and keeps the page free of a geometry library.
  function voronoiCells(sites, boundary, boundaryLabels) {
    const bl = boundaryLabels || boundary.map(() => -1);
    return sites.map((s, i) => {
      let poly = boundary.slice();
      let labels = bl.slice();
      for (let j = 0; j < sites.length && poly.length; j++) {
        if (j !== i) [poly, labels] = clipCell(poly, labels, s, sites[j], j);
      }
      return { poly, labels };
    });
  }

  function polygonArea(pts) {
    let a = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  function polygonCentroid(pts) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      const cross = p[0] * q[1] - q[0] * p[1];
      a += cross;
      cx += (p[0] + q[0]) * cross;
      cy += (p[1] + q[1]) * cross;
    }
    if (Math.abs(a) < 1e-9) return pts[0] ? pts[0].slice() : [0, 0];
    return [cx / (3 * a), cy / (3 * a)];
  }

  function pointInPolygon(p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
        inside = !inside;
      }
    }
    return inside;
  }

  // The part of a polygon inside the visible map, for label anchors and sizes.
  function clipToFrame(poly, map, inset) {
    const m = inset || 0;
    const L = poly.map(() => 0);
    let p = poly;
    let l = L;
    [p, l] = clipHalfPlane(p, l, -1, 0, -m, 0);
    [p, l] = clipHalfPlane(p, l, 1, 0, map.width - m, 0);
    [p, l] = clipHalfPlane(p, l, 0, -1, -m, 0);
    [p, l] = clipHalfPlane(p, l, 0, 1, map.height - m, 0);
    return p;
  }

  function mapShape1(map) {
    return SHAPES1.includes(map.shape) ? map.shape : 'island';
  }

  function mapShape(map) {
    if (map.kind === 'europe') return 'europe';
    return SHAPES.includes(map.shape) ? map.shape : 'island';
  }

  function mapIslands(map) {
    if (mapShape1(map) !== 'mainland' && Array.isArray(map.islands) && map.islands.length) return map.islands;
    return [{ cx: map.width / 2, cy: map.height / 2, rx: map.rx, ry: map.ry }];
  }

  function rhoOf(isl, x, y) {
    const ex = (x - isl.cx) / isl.rx;
    const ey = (y - isl.cy) / isl.ry;
    return Math.sqrt(ex * ex + ey * ey);
  }

  function nearestIsland(islands, x, y) {
    let best = 0;
    let bestR = Infinity;
    islands.forEach((isl, i) => {
      const r = rhoOf(isl, x, y);
      if (r < bestR) {
        bestR = r;
        best = i;
      }
    });
    return [best, bestR];
  }

  // Mainland coast: land is where nx*x + ny*y <= c (n points out to sea).
  function coastFrame(map) {
    return { nx: Math.cos(map.coast.angle), ny: Math.sin(map.coast.angle), c: map.coast.c };
  }

  // How far inland a point is, 0 at the coast to 1 deep inland.
  function inlandness(map, x, y) {
    if (mapShape1(map) === 'mainland') {
      const cf = coastFrame(map);
      return clamp((cf.c - (x * cf.nx + y * cf.ny)) / 420, 0, 1);
    }
    return clamp(1 - nearestIsland(mapIslands(map), x, y)[1], 0, 1);
  }

  // Each landmass: a convex outline its territories are cut from.
  function landmasses(map) {
    if (mapShape1(map) === 'mainland') {
      const m = 60;
      const cf = coastFrame(map);
      const [boundary, labels] = clipHalfPlane(
        [[-m, -m], [map.width + m, -m], [map.width + m, map.height + m], [-m, map.height + m]],
        [-2, -2, -2, -2],
        cf.nx,
        cf.ny,
        cf.c,
        -1
      );
      return [{ boundary, labels }];
    }
    return mapIslands(map).map((isl) => {
      const boundary = ellipsePolygon(isl.cx, isl.cy, isl.rx, isl.ry, 96);
      return { boundary, labels: boundary.map(() => -1) };
    });
  }

  function landmassOf(map, x, y) {
    return mapShape1(map) === 'mainland' ? 0 : nearestIsland(mapIslands(map), x, y)[0];
  }

  // Voronoi within each landmass; territories on different islands never share a border.
  function landCells(sites, map) {
    const lands = landmasses(map);
    const groups = lands.map(() => []);
    sites.forEach((s, i) => groups[landmassOf(map, s[0], s[1])].push(i));
    const cells = new Array(sites.length);
    lands.forEach((land, li) => {
      for (const i of groups[li]) {
        let poly = land.boundary.slice();
        let labels = land.labels.slice();
        for (const j of groups[li]) {
          if (j !== i && poly.length) [poly, labels] = clipCell(poly, labels, sites[i], sites[j], j);
        }
        cells[i] = { poly, labels, land: li };
      }
    });
    return { cells, groups };
  }

  /*
   * Turns the convex Voronoi layout into a coastline and borders. Near the coast
   * points are pushed in or out (bays and headlands): radially around each island,
   * or along the coastline's normal on a mainland. Everywhere, fractal value noise
   * adds wobble. Both are pure functions of position, so an edge shared by two
   * territories bends identically for both of them.
   */
  function makeWarp(map) {
    const octaves = [
      [24, 1 / 200],
      [6, 1 / 55],
      [1.8, 1 / 16],
    ].map(([amp, freq], i) => ({
      amp,
      freq,
      nx: valueNoise(map.seed + 101 * i + 1),
      ny: valueNoise(map.seed + 101 * i + 2),
    }));
    let shapeWarp;
    if (mapShape1(map) === 'mainland') {
      const cf = coastFrame(map);
      const tx = -cf.ny;
      const ty = cf.nx;
      const rng = mulberry32((map.seed ^ 0x51ed270b) >>> 0);
      const waves = [520, 300, 170].map((lam, k) => ({ f: (Math.PI * 2) / lam, a: [1, 0.6, 0.35][k] * (0.6 + rng() * 0.8), phi: rng() * Math.PI * 2 }));
      const sumA = waves.reduce((s, w) => s + w.a, 0);
      const A = 55;
      shapeWarp = function (x, y) {
        const d = x * cf.nx + y * cf.ny - cf.c;
        const w = 1 - smoothstep(0, 160, Math.abs(d));
        if (w <= 0) return [x, y];
        const u = x * tx + y * ty;
        let s = 0;
        for (const wv of waves) s += wv.a * Math.sin(wv.f * u + wv.phi);
        const delta = A * (s / sumA) * w;
        return [x + cf.nx * delta, y + cf.ny * delta];
      };
    } else {
      const islands = mapIslands(map).map((isl, i) => {
        const rng = mulberry32((map.seed ^ (0x9e3779b9 + i * 7919)) >>> 0);
        const harmonics = [2, 3, 4, 6].map((k) => ({ k, a: 0.3 + rng() * 0.7, phi: rng() * Math.PI * 2 }));
        return { isl, harmonics, sumA: harmonics.reduce((s, h) => s + h.a, 0) };
      });
      const B = 0.2;
      shapeWarp = function (x, y) {
        let best = islands[0];
        let rho = Infinity;
        for (const it of islands) {
          const r = rhoOf(it.isl, x, y);
          if (r < rho) {
            rho = r;
            best = it;
          }
        }
        const w = smoothstep(0.55, 1, rho);
        if (w <= 0) return [x, y];
        const { isl } = best;
        const th = Math.atan2((y - isl.cy) / isl.ry, (x - isl.cx) / isl.rx);
        let s = 0;
        for (const h of best.harmonics) s += h.a * Math.sin(h.k * th + h.phi);
        const scale = 1 + B * (s / best.sumA) * w;
        return [isl.cx + (x - isl.cx) * scale, isl.cy + (y - isl.cy) * scale];
      };
    }
    return function (x, y) {
      const p = shapeWarp(x, y);
      let X = p[0];
      let Y = p[1];
      for (const o of octaves) {
        X += o.amp * o.nx(x * o.freq, y * o.freq);
        Y += o.amp * o.ny(x * o.freq, y * o.freq);
      }
      return [X, Y];
    };
  }

  function warpedEdge(a, b, warp, step) {
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push(warp(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    }
    return out;
  }

  const ELEVATION = { mountains: 1, hills: 0.78, forest: 0.5, grassland: 0.42, marsh: 0.18, coast: 0.25 };

  /*
   * Rivers run along territory borders (as rivers often are borders), starting
   * high in mountains or hills and always flowing downhill. They reach the sea,
   * join another river, or pool in a lake where the land gives them nowhere lower.
   */
  function computeRivers(campaign, cells, warp) {
    const verts = [];
    function vid(p) {
      for (let k = 0; k < verts.length; k++) {
        const q = verts[k].p;
        if (Math.abs(q[0] - p[0]) < 0.05 && Math.abs(q[1] - p[1]) < 0.05) return k;
      }
      verts.push({ p, cells: new Set(), coast: false, edge: false, nbrs: new Set() });
      return verts.length - 1;
    }
    cells.forEach((cell, i) => {
      const n = cell.poly.length;
      const ids = cell.poly.map(vid);
      for (let k = 0; k < n; k++) {
        const a = ids[k];
        const b = ids[(k + 1) % n];
        verts[a].cells.add(i);
        const L = cell.labels[k];
        if (L === -1) verts[a].coast = verts[b].coast = true;
        else if (L === -2) verts[a].edge = verts[b].edge = true;
        else if (a !== b && dist(verts[a].p, verts[b].p) > 2) {
          verts[a].nbrs.add(b);
          verts[b].nbrs.add(a);
        }
      }
    });
    const rng = mulberry32(hashString('rivers:' + campaign.seed));
    const elev = verts.map((v) => {
      if (v.coast) return 0;
      let s = 0;
      for (const c of v.cells) s += ELEVATION[campaign.territories[c].terrain] || 0.4;
      return s / Math.max(1, v.cells.size) + (v.edge ? 0.6 : 0) + rng() * 0.04;
    });
    const highland = (v) => [...v.cells].some((c) => ['mountains', 'hills'].includes(campaign.territories[c].terrain));
    const candidates = verts
      .map((v, k) => k)
      .filter((k) => !verts[k].coast && !verts[k].edge && highland(verts[k]) && verts[k].nbrs.size >= 2)
      .sort((a, b) => elev[b] - elev[a]);
    const want = clamp(Math.round(campaign.territories.length / 7), 2, 4);
    const used = new Set();
    const sources = [];
    const rivers = [];
    const lakes = [];
    for (const start of candidates) {
      if (rivers.length >= want) break;
      if (used.has(start) || sources.some((s) => dist(verts[s].p, verts[start].p) < 110)) continue;
      const path = [start];
      const seen = new Set(path);
      let cur = start;
      let end = 'lake';
      for (let step = 0; step < 80; step++) {
        if (verts[cur].coast) {
          end = 'sea';
          break;
        }
        let best = -1;
        for (const nb of verts[cur].nbrs) if (!seen.has(nb) && (best === -1 || elev[nb] < elev[best])) best = nb;
        if (best === -1 || elev[best] > elev[cur] + 0.02) break;
        path.push(best);
        seen.add(best);
        if (used.has(best)) {
          end = 'join';
          break;
        }
        cur = best;
      }
      if (path.length < 2) continue;
      const points = [];
      for (let i = 1; i < path.length; i++) {
        const seg = warpedEdge(verts[path[i - 1]].p, verts[path[i]].p, warp, 5);
        if (i > 1) seg.shift();
        for (const p of seg) points.push(p);
      }
      if (points.length < 12) continue; // under ~60px is a stub, not a river
      rivers.push({ points, end });
      if (end === 'lake') {
        const p = points[points.length - 1];
        lakes.push({ x: p[0], y: p[1], r: 9 + rng() * 5 });
      }
      path.forEach((v) => used.add(v));
      sources.push(start);
    }
    return { rivers, lakes };
  }

  /*
   * Everything the renderer needs, rebuilt from stored data (positions + map
   * parameters + terrain), so imported campaigns redraw the same map.
   */
  function buildGeometry(campaign) {
    return campaign.map && campaign.map.engine === 2 ? buildGeometry2(campaign) : buildGeometry1(campaign);
  }

  function buildGeometry1(campaign) {
    const map = campaign.map;
    const sites = campaign.territories.map((t) => [t.position.x, t.position.y]);
    const { cells, groups } = landCells(sites, map);
    const warp = makeWarp(map);
    const step = 5;
    const borders = [];
    const coast = [];
    const adjacency = sites.map(() => new Set());
    const shapes = cells.map((cell, i) => {
      const { poly, labels } = cell;
      const points = [];
      let coastLength = 0;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k];
        const b = poly[(k + 1) % poly.length];
        const seg = warpedEdge(a, b, warp, step);
        const label = labels[k];
        const len = dist(a, b);
        if (label === -1) {
          coast.push(seg.slice());
          coastLength += len;
        } else if (label >= 0) {
          if (label > i && len > 0.5) borders.push({ a: i, b: label, points: seg.slice() });
          if (len >= MIN_SHARED_EDGE) {
            adjacency[i].add(label);
            adjacency[label].add(i);
          }
        }
        seg.pop();
        for (const p of seg) points.push(p);
      }
      const visible = clipToFrame(poly, map, 12);
      const c = polygonCentroid(visible.length >= 3 ? visible : poly);
      return {
        index: i,
        id: campaign.territories[i].id,
        land: cell.land,
        points,
        centroid: warp(c[0], c[1]),
        area: Math.abs(polygonArea(visible.length >= 3 ? visible : poly)),
        coastLength,
        rings: [points],
        d: pathData(points, true),
      };
    });

    // Sea lanes join the islands of an archipelago: the shortest crossing between
    // each pair of islands, kept as a minimum spanning tree plus one extra loop.
    const seaLanes = [];
    const laneSet = new Set();
    const lands = groups.map((g, li) => ({ li, coastal: g.filter((i) => shapes[i].coastLength > 10) })).filter((l) => l.coastal.length);
    if (lands.length > 1) {
      const pairs = [];
      for (let x = 0; x < lands.length; x++) {
        for (let y = x + 1; y < lands.length; y++) {
          let best = null;
          for (const i of lands[x].coastal) {
            for (const j of lands[y].coastal) {
              const d = dist(sites[i], sites[j]);
              if (!best || d < best.d) best = { x, y, i, j, d };
            }
          }
          pairs.push(best);
        }
      }
      pairs.sort((p, q) => p.d - q.d);
      const parent = lands.map((_, k) => k);
      const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
      const spare = [];
      for (const p of pairs) {
        const rx = find(p.x);
        const ry = find(p.y);
        if (rx !== ry) {
          parent[rx] = ry;
          seaLanes.push(p);
        } else spare.push(p);
      }
      if (lands.length >= 3 && spare.length) seaLanes.push(spare[0]);
      for (const p of seaLanes) {
        adjacency[p.i].add(p.j);
        adjacency[p.j].add(p.i);
        laneSet.add(Math.min(p.i, p.j) + '|' + Math.max(p.i, p.j));
      }
    }

    const { rivers, lakes } = computeRivers(campaign, cells, warp);
    const index = new Map(campaign.territories.map((t, i) => [t.id, i]));
    return {
      engine: 1,
      islets: [],
      shapes,
      borders,
      coast,
      adjacency,
      index,
      sites,
      warp,
      seaLanes: seaLanes.map((p) => ({ a: p.i, b: p.j })),
      laneSet,
      rivers,
      lakes,
      landCount: groups.filter((g) => g.length).length,
    };
  }

  function pathData(points, close) {
    if (!points.length) return '';
    let d = 'M' + points[0][0].toFixed(1) + ' ' + points[0][1].toFixed(1);
    for (let i = 1; i < points.length; i++) d += 'L' + points[i][0].toFixed(1) + ' ' + points[i][1].toFixed(1);
    return close ? d + 'Z' : d;
  }

  // Shortest route between two territories over borders and sea lanes (a crossing costs a quarter more, unless opts.seaCost says otherwise).

  // Even-odd test against every ring, so holes (lakes inside a territory) count as outside.
  function pointInShape(p, shape) {
    let inside = false;
    for (const r of shape.rings || [shape.points]) if (pointInPolygon(p, r)) inside = !inside;
    return inside;
  }

  function findRoute(geo, fromIdx, toIdx, opts) {
    const seaCost = (opts && opts.seaCost) || 1.25;
    const n = geo.sites.length;
    if (fromIdx === toIdx) return [fromIdx];
    const distTo = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(-1);
    const done = new Array(n).fill(false);
    distTo[fromIdx] = 0;
    for (let iter = 0; iter < n; iter++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u === -1 || distTo[i] < distTo[u])) u = i;
      if (u === -1 || distTo[u] === Infinity) break;
      if (u === toIdx) break;
      done[u] = true;
      for (const v of geo.adjacency[u]) {
        const sea = geo.laneSet && geo.laneSet.has(Math.min(u, v) + '|' + Math.max(u, v));
        const d = distTo[u] + dist(geo.sites[u], geo.sites[v]) * (sea ? seaCost : 1);
        if (d < distTo[v]) {
          distTo[v] = d;
          prev[v] = u;
        }
      }
    }
    if (prev[toIdx] === -1) return [fromIdx, toIdx];
    const route = [toIdx];
    while (route[0] !== fromIdx) route.unshift(prev[route[0]]);
    return route;
  }

  function routeLeagues(geo, route) {
    let d = 0;
    for (let i = 1; i < route.length; i++) d += dist(geo.sites[route[i - 1]], geo.sites[route[i]]);
    return Math.round((d / 100) * LEAGUES_PER_100);
  }

  /* ---------- engine 2: a land mask on a fine grid ----------
   *
   * The map is a jittered grid of ~3,800 small Voronoi cells. A shape field plus
   * noise decides which cells are land, so any coastline works: fjords, inland
   * seas, straits, peninsulas, lakes and islets. Territories are grown outward
   * from their seats over land cells (never across water), which gives organic,
   * non-convex borders, and rivers run downhill over the cell corners.
   */

  const FINE = 15;
  const FINE_EUROPE = 8; // the real map needs a finer grid for its coastline
  const EUROPE_REACH = 110; // land further than this from every seat stays wild
  const FRAME_PAD = 45;
  const GEN_DEFAULTS = { rough: 1, mountains: 1, forests: 1, wetlands: 1, wealth: 1, defences: 1, rivers: 1, borders: 1 };
  const GEN_LEVEL = [0, 1, 2];

  function normGen(g) {
    const out = {};
    for (const k in GEN_DEFAULTS) {
      const v = g && Math.round(Number(g[k]));
      out[k] = GEN_LEVEL.includes(v) ? v : GEN_DEFAULTS[k];
    }
    return out;
  }

  function harmonicsFrom(rng, ks) {
    return ks.map((k) => [k, Math.round((0.3 + rng() * 0.7) * 1000) / 1000, Math.round(rng() * Math.PI * 2 * 1000) / 1000]);
  }

  function harmonic(h, th) {
    let s = 0;
    let sa = 0;
    for (const [k, a, phi] of h) {
      s += a * Math.sin(k * th + phi);
      sa += a;
    }
    return sa ? s / sa : 0;
  }

  // Positive inside a wobbly ellipse; roughly the distance to its edge in hundreds of map units.
  function blobField(b, x, y) {
    const dx = (x - b.cx) / b.rx;
    const dy = (y - b.cy) / b.ry;
    const rho = Math.sqrt(dx * dx + dy * dy);
    const r = 1 + b.amp * harmonic(b.harm, Math.atan2(dy, dx));
    return ((1 - rho / r) * Math.min(b.rx, b.ry)) / 100;
  }

  // A wavy coastline: positive on the land side.
  function lineField(L, x, y) {
    const nx = Math.cos(L.angle);
    const ny = Math.sin(L.angle);
    const u = -x * ny + y * nx;
    return (L.c + L.A * harmonicU(L.waves, u) - (x * nx + y * ny)) / 100;
  }

  function harmonicU(waves, u) {
    let s = 0;
    let sa = 0;
    for (const [f, a, phi] of waves) {
      s += a * Math.sin(f * u + phi);
      sa += a;
    }
    return sa ? s / sa : 0;
  }

  // Distance from a point to a curve given as sample points, with the curve
  // parameter at the nearest point.
  function curveDistance(pts, x, y) {
    let best = Infinity;
    let bt = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
      const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (d < best) {
        best = d;
        bt = (i - 1 + t) / (pts.length - 1);
      }
    }
    return [best, bt];
  }

  function bentCurve(x0, y0, angle, len, bend, from, n) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = from + ((1 - from) * i) / n;
      const off = bend * len * t * t;
      pts.push([x0 + dx * len * t - dy * off, y0 + dy * len * t + dx * off]);
    }
    return pts;
  }

  function lineParams(rng, share) {
    const angle = rng() * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const landShare = (c) => {
      let land = 0;
      let total = 0;
      for (let x = 12; x < MAP_W; x += 25) {
        for (let y = 12; y < MAP_H; y += 25) {
          total++;
          if (x * nx + y * ny <= c) land++;
        }
      }
      return land / total;
    };
    let lo = -1500;
    let hi = 1500;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (landShare(mid) < share) lo = mid;
      else hi = mid;
    }
    const waves = [520, 300, 170].map((lam, k) => [Math.round(((Math.PI * 2) / lam) * 1e5) / 1e5, Math.round([1, 0.6, 0.35][k] * (0.6 + rng() * 0.8) * 1000) / 1000, Math.round(rng() * 6283) / 1000]);
    return { angle: Math.round(angle * 1000) / 1000, c: Math.round((lo + hi) / 2), A: 55, waves };
  }

  function placeBlobs(rng, n, totalArea, aspectSpread) {
    let scale = 1;
    for (let attempt = 0; attempt < 600; attempt++) {
      if (attempt && attempt % 40 === 0) scale *= 0.95;
      const weights = Array.from({ length: n }, () => 0.5 + rng());
      const wsum = weights.reduce((s, w) => s + w, 0);
      const blobs = [];
      let ok = true;
      for (let i = 0; i < n && ok; i++) {
        const area = ((totalArea * weights[i]) / wsum) * scale * scale;
        const aspect = 1 + rng() * aspectSpread;
        const rx = Math.sqrt((area * aspect) / Math.PI);
        const ry = rx / aspect;
        let placed = false;
        for (let t = 0; t < 120 && !placed; t++) {
          const cx = rx * 1.05 + 20 + rng() * (MAP_W - 2 * rx * 1.05 - 40);
          const cy = ry * 1.05 + 20 + rng() * (MAP_H - 2 * ry * 1.05 - 40);
          if (MAP_W - 2 * rx * 1.05 - 40 < 0 || MAP_H - 2 * ry * 1.05 - 40 < 0) break;
          if (!clearOfDecor(cx, cy, Math.max(rx, ry) * 0.9)) continue;
          if (blobs.some((b) => Math.hypot(b.cx - cx, b.cy - cy) < Math.max(b.rx, b.ry) * 1.05 + Math.max(rx, ry) * 1.05 + 24)) continue;
          blobs.push({ cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(rx), ry: Math.round(ry), amp: 0.24, harm: harmonicsFrom(rng, [2, 3, 5]) });
          placed = true;
        }
        if (!placed) ok = false;
      }
      if (ok) return blobs;
    }
    return [{ cx: 500, cy: 350, rx: 300, ry: 200, amp: 0.2, harm: harmonicsFrom(rng, [2, 3, 5]) }];
  }

  // Shape parameters, stored on the map so the same coastline redraws after an import.
  function maskParams(rng, shape) {
    const W = MAP_W;
    const H = MAP_H;
    switch (shape) {
      case 'archipelago':
        return { blobs: placeBlobs(rng, 3 + Math.floor(rng() * 3), W * H * 0.3, 0.6) };
      case 'mainland':
        return { line: lineParams(rng, 0.58 + rng() * 0.1) };
      case 'inland': {
        const lake = { cx: Math.round(W / 2 + (rng() - 0.5) * 120), cy: Math.round(H / 2 + (rng() - 0.5) * 80), rx: Math.round(250 + rng() * 80), ry: Math.round(150 + rng() * 60), amp: 0.28, harm: harmonicsFrom(rng, [2, 3, 4, 6]) };
        const isles = [];
        if (rng() < 0.6) isles.push({ cx: Math.round(lake.cx + (rng() - 0.5) * lake.rx * 0.6), cy: Math.round(lake.cy + (rng() - 0.5) * lake.ry * 0.5), rx: Math.round(70 + rng() * 40), ry: Math.round(45 + rng() * 25), amp: 0.25, harm: harmonicsFrom(rng, [2, 3]) });
        return { lake, isles };
      }
      case 'strait': {
        const angle = (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.9;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        return { angle: Math.round(angle * 1000) / 1000, c: Math.round((W / 2) * nx + (H / 2) * ny + (rng() - 0.5) * 80), amp: Math.round(40 + rng() * 50), lam: Math.round(420 + rng() * 300), phi: Math.round(rng() * 6283) / 1000, phi2: Math.round(rng() * 6283) / 1000, width: Math.round(70 + rng() * 35) };
      }
      case 'fjords': {
        const line = lineParams(rng, 0.62);
        const nx = Math.cos(line.angle);
        const ny = Math.sin(line.angle);
        // Where the coastline crosses the map, measured along it.
        const us = [];
        for (let x = 0; x <= W; x += 10) {
          for (let y = 0; y <= H; y += 10) {
            if (Math.abs(x * nx + y * ny - line.c) < 8) us.push(-x * ny + y * nx);
          }
        }
        const umin = Math.min(...us) + 70;
        const umax = Math.max(...us) - 70;
        const inlets = [];
        const n = 3 + Math.floor(rng() * 3);
        for (let tries = 0; tries < 60 && inlets.length < n && umax > umin; tries++) {
          const u = umin + rng() * (umax - umin);
          if (inlets.some((f) => Math.abs(f.u - u) < 105)) continue;
          inlets.push({ u: Math.round(u), len: Math.round(150 + rng() * 150), width: Math.round(34 + rng() * 22), bend: Math.round((rng() - 0.5) * 800) / 1000, tilt: Math.round((rng() - 0.5) * 500) / 1000 });
        }
        return { line, inlets };
      }
      case 'peninsula': {
        const side = Math.floor(rng() * 4);
        const along = 0.3 + rng() * 0.4;
        const base = [[W * along, -40, Math.PI / 2], [W + 40, H * along, Math.PI], [W * along, H + 40, -Math.PI / 2], [-40, H * along, 0]][side];
        const span = side % 2 === 0 ? H : W;
        return { x0: Math.round(base[0]), y0: Math.round(base[1]), angle: Math.round((base[2] + (rng() - 0.5) * 0.7) * 1000) / 1000, len: Math.round(span * (0.75 + rng() * 0.2)), width: Math.round(150 + rng() * 45), bend: Math.round((rng() - 0.5) * 600) / 1000 };
      }
      default:
        return { blobs: [{ cx: Math.round(W / 2 + (rng() - 0.5) * 40), cy: Math.round(H / 2 + (rng() - 0.5) * 30), rx: Math.round(355 + rng() * 30), ry: Math.round(232 + rng() * 22), amp: 0.22, harm: harmonicsFrom(rng, [2, 3, 4, 6]) }], sats: rng() < 0.6 ? 1 + Math.floor(rng() * 3) : 0 };
    }
  }

  function makeShapeField(map) {
    const m = map.mask || {};
    switch (map.shape) {
      case 'mainland':
        return (x, y) => lineField(m.line, x, y);
      case 'inland':
        return (x, y) => {
          let f = -blobField(m.lake, x, y);
          for (const b of m.isles || []) f = Math.max(f, blobField(b, x, y));
          return f;
        };
      case 'strait': {
        const nx = Math.cos(m.angle);
        const ny = Math.sin(m.angle);
        return (x, y) => {
          const u = -x * ny + y * nx;
          const d = x * nx + y * ny - m.c - m.amp * Math.sin((Math.PI * 2 * u) / m.lam + m.phi);
          const w = m.width * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin((Math.PI * 2 * u) / (m.lam * 0.63) + m.phi2)));
          return (Math.abs(d) - w / 2) / 100;
        };
      }
      case 'fjords': {
        const L = m.line;
        const nx = Math.cos(L.angle);
        const ny = Math.sin(L.angle);
        const curves = (m.inlets || []).map((f) => {
          const s = L.c + L.A * harmonicU(L.waves, f.u);
          const x0 = nx * s - ny * f.u;
          const y0 = ny * s + nx * f.u;
          return { f, pts: bentCurve(x0, y0, L.angle + Math.PI + f.tilt, f.len, f.bend, -0.2, 18) };
        });
        return (x, y) => {
          let v = lineField(L, x, y);
          for (const c of curves) {
            if (Math.abs(x - c.pts[0][0]) > c.f.len + 80 && Math.abs(y - c.pts[0][1]) > c.f.len + 80) continue;
            const [d, t] = curveDistance(c.pts, x, y);
            const hw = (c.f.width / 2) * (1 - 0.8 * Math.max(0, t * 1.2 - 0.2));
            v = Math.min(v, (d - hw) / 100);
          }
          return v;
        };
      }
      case 'peninsula': {
        const pts = bentCurve(m.x0, m.y0, m.angle, m.len, m.bend, -0.3, 24);
        return (x, y) => {
          const [d, t] = curveDistance(pts, x, y);
          return (m.width * (1 - 0.45 * clamp(t * 1.3 - 0.3, 0, 1)) - d) / 100;
        };
      }
      default:
        return (x, y) => {
          let f = -Infinity;
          for (const b of m.blobs || []) f = Math.max(f, blobField(b, x, y));
          return f;
        };
    }
  }

  function fineWarp(map) {
    const g = normGen(map.gen);
    const mult = [0.55, 1, 1.45][g.rough] * (map.kind === 'europe' ? 0.22 : 1);
    const octaves = [
      [10, 1 / 170],
      [3.5, 1 / 50],
      [1.2, 1 / 15],
    ].map(([amp, freq], i) => ({ amp: amp * mult, freq, nx: valueNoise(map.seed + 211 * i + 3), ny: valueNoise(map.seed + 211 * i + 4) }));
    return function (x, y) {
      let X = x;
      let Y = y;
      for (const o of octaves) {
        X += o.amp * o.nx(x * o.freq, y * o.freq);
        Y += o.amp * o.ny(x * o.freq, y * o.freq);
      }
      return [X, Y];
    };
  }


  /* ---------- the real map: Europe around the year 1000 ---------- */

  // Ireland to Kiev, Trondheim to the Alps: the Viking-age world of Pillage's four factions,
  // in an equirectangular projection true at 54°N (so the 1000x700 map keeps real proportions).
  const EUROPE_FRAME = { lon0: -12, lon1: 34, lat0: 44.5, lat1: 63.5 };
  function europeXY(lat, lon) {
    const F = EUROPE_FRAME;
    return [((lon - F.lon0) / (F.lon1 - F.lon0)) * MAP_W, ((F.lat1 - lat) / (F.lat1 - F.lat0)) * MAP_H];
  }

  // Coastline: Natural Earth 1:50m land (public domain), clipped to the frame, projected and
  // simplified to half a pixel. Rings separated by ';', each a list of base-36 deltas in half-pixels.
  const EUROPE_LAND = '15t,9z,3,2,6,-2,6,2,f,9,1,2,-9,1,-h,f,-a,0,-6,1,-4,4,-2,8,-3,7,-7,2,0,-4,8,-c,-d,-8,-1,-3,3,-1,3,-5,-6,-8,6,-1,4,2,4,-3,4,1,3,-5,9,-4;11j,bl,-4,2,-2,5,-5,3,-1,g,5,7,-6,2,-3,9,-a,6,-4,6,-2,8,-4,3,-4,1,6,-c,-3,-4,-5,-a,2,-5,-1,-g,i,-k,8,-3,3,3,2,-5,3,-2;to,fs,-1,a,-a,5,-3,4,-1,5,2,4,5,2,2,7,-5,4,-a,3,-1,s,-8,3,-6,-a,-4,-k,-a,-2,-5,0,-6,-9,1,-a,-2,-5,-1,-5,-5,-3,-1,-6,f,-2,6,-9,1,-5,6,-1,3,3,0,e,6,2,4,-a,1,-5,-3,-5,f,-b,5,0,b,4,1,2,-4,9;rd,g5,7,m,-1,3,1,5,-1,6,-7,5,-8,1,-k,-9,-6,-e,1,-c,i,-7,6,4,4,0;ar,a7,-1,8,-4,7,-y,q,-2,8,8,3,-a,a,-2,7,c,-1,k,-8,g,2,8,-1,q,1,8,-2,5,2,4,5,3,a,-a,g,-3,b,-7,i,-f,m,-8,6,-c,3,-b,6,i,-3,a,6,0,5,-5,4,-9,0,-8,9,-8,4,-f,-3,-4,-2,8,5,o,5,9,-5,b,0,j,9,m,o,a,14,8,o,4,4,l,b,d,g,c,c,-5,7,e,v,-4,-2,-4,-1,-9,-7,-8,2,-9,-1,g,3,i,g,7,a,3,d,-2,6,-b,d,a,7,4,-1,8,-b,m,1,e,5,c,a,2,5,2,g,-7,q,-8,9,-4,3,-4,-2,2,a,-4,3,-3,1,-7,-1,-9,5,7,3,1,3,-2,6,-3,2,-d,3,-4,3,5,-2,3,2,4,6,8,2,n,-1,0,e,-g,a,-4,8,-8,0,-3,3,-l,a,-i,-4,-b,0,-e,3,-s,-9,4,5,-8,6,-f,2,-8,-1,3,7,-3,2,-d,-2,-4,3,-5,-2,-a,-6,-a,-1,-h,6,-4,6,-4,h,-4,6,-5,1,-i,-c,-4,2,-9,2,-a,3,-c,a,-5,9,-4,1,-5,-4,-5,-2,-8,4,-1,-6,4,-5,a,-3,e,-j,5,-3,1,-3,c,-f,3,-e,a,-4,5,-c,f,-3,a,0,a,3,a,-1,4,-3,7,-c,k,-p,-d,c,-b,3,-d,b,-c,-1,-e,-e,-f,2,6,-7,-8,-1,-5,-5,-9,1,-d,8,-c,-9,-1,-8,-3,-2,3,-5,4,-3,v,-f,7,-6,b,-k,-3,-1,-2,-3,2,-8,-3,-8,0,-7,-b,1,-a,6,-4,1,2,-6,a,-9,6,-a,7,-5,d,-7,7,1,a,-3,4,-1,a,7,-3,-a,4,-3,7,9,2,1,5,-1,-7,-3,-7,-c,1,-5,6,-b,-5,-3,0,-a,6,-4,2,-d,-1,-3,-5,0,-5,4,-3,0,-7,-8,-a,-h,-1,-8,5,-f,9,-a,a,-3,-i,-1,-5,1,-4,4,-6,2,-7,7,-8,0,-5,-5,-c,6,-d,-6,-3,5,-1,6,-5,-5,-5,-7,-1,-a,2,-2,3,2,4,-c,c,-q,-2,-7,-7,-7,1,-d,3,-5,9,0,-b,-8,2,-8,-5,a,-8,3,-1,3,-3,1,-2,3,1,-d,9,-d,-3,3,-e,f,1,c,-8,x,-3,4,-4,0,-2,-5,4,-h,7,-d,-3,1,-2,-2,1,-h,9,-y,3,-3,1,-5,5,-a,-k,g,-9,-2,-3,-3,-2,-6,-7,-1,4,-5,7,-1,7,-5,-6,-4,5,-4,7,-b,1,-9,-4,-8,-6,-3,-1,-4,2,-5,8,-3,-4,-2,-3,-7,6,-g,b,0,3,-2,6,2,-c,-e,3,-5,1,-7,e,-2,-4,-9,1,-a,3,-3,4,-2,5,1,4,5,9,-5,3,4,b,-3,14,-7,9,2;5u,ha,3,1,3,-3,4,-7,b,-1,9,-3,f,1,4,6,3,8,5,9,6,7,0,4,-7,6,0,3,6,-3,7,1,5,c,-1,4,-3,-5,-5,-2,1,c,4,1,-2,7,-a,3,-4,a,-4,3,-9,-3,3,6,-7,0,-1,2,1,8,2,3,6,j,-1,g,5,k,1,c,-6,e,-2,e,-6,b,-5,4,6,7,-5,3,-6,1,-9,-1,-5,4,-3,-7,-2,6,-3,2,-6,0,-d,3,-5,8,-9,3,-a,9,-3,1,-7,-6,-5,1,3,3,0,8,-b,6,-6,1,-4,4,-k,6,-8,-2,-c,4,-4,-1,6,-8,8,-6,-h,2,-9,4,2,-4,e,-d,6,-3,-l,7,-5,-1,-1,-2,-5,1,-1,-5,6,-8,c,-7,2,-4,-l,-1,1,-5,7,-5,3,0,9,3,7,-1,-3,-3,-1,-6,-2,-2,c,-b,p,-5,c,-5,-6,-2,-3,-3,-8,9,-a,1,-7,-3,-9,6,-6,0,h,-f,5,-9,-3,-3,7,-c,c,-4,4,-4,-9,-3,-g,1,-3,-2,-2,-5,-8,1,-3,-2,4,-3,-d,-2,2,-5,-3,-5,h,-4,-8,-4,0,-5,7,-4,7,-2,0,-5,-7,-1,-7,2,2,-h,-3,1,-2,-8,-5,3,0,-5,1,-3,3,-1,8,0,4,-2,7,-1,b,1,7,7,6,-6,i,4,2,-1,-3,-8,6,-7,b,-4,4,-a,-e,2,-d,-5,2,-4,8,-4,6,-8,-1,-5,1,-4,3,-3,2,-6,c,-4,b,1,-1,-5,4,-1,5,7,0,3,-3,5,2,2,-3,4,8,-5,-3,-b,1,-4,3,-2,6,-2,-3,-4,3,-1,f,a,-9,7,-2,3;1m2,-2i,0,17w,0,-6x,-b,2,-i,i,-6,d,-9,8,-2,0,c,-d,0,-7,-2,-5,-8,d,-9,5,0,9,2,e,5,e,g,p,3,3,5,0,8,-6,4,0,8,2,2,-4,0,t,-9,2,-8,-7,-5,-2,-4,2,-5,9,-9,6,-3,7,-8,-2,-8,1,-b,7,-8,d,-9,9,-7,2,-7,-1,-d,-b,7,-q,-2,-e,-7,-7,-6,2,-3,-2,-c,-c,-6,0,-7,2,-5,-6,s,-p,6,-1,g,-e,-3,-b,-7,3,-a,-9,-b,4,-6,0,-e,3,-j,-d,-5,-2,-4,1,-3,-3,a,-3,0,-5,-c,-3,-7,-6,7,0,s,5,9,-a,-a,4,-9,-2,-4,-4,-4,-a,-1,-f,-4,-d,-3,-4,6,l,-1,l,-5,1,-a,-2,1,-9,-7,b,-4,1,-7,-1,-f,6,-6,l,-7,c,-c,h,-i,a,-6,-1,-2,2,-1,9,3,4,2,f,-4,r,-3,a,-m,6,1,-3,-1,-9,2,-4,-5,-1,-2,2,-2,3,1,8,-3,7,-2,b,4,0,-b,k,1,n,-3,e,-1,m,-5,8,-6,-3,-8,2,-4,9,-da,0,-6,-8,-d,-6,-a,-5,-b,2,-6,-1,-2,-3,0,-7,-j,-i,-e,-k,-3,-6,7,-2,8,1,-8,-8,-d,-h,-4,-7,1,-k,-2,-8,-e,-g,-7,-3,-3,0,-3,d,-c,o,-5,0,-a,-k,-5,-r,c,-b,-7,-b,-3,0,-4,5,-b,-5,-8,a,-n,d,-3,0,5,-6,-2,0,-a,7,-2,f,3,3,5,c,5,5,-2,a,-4,3,-4,-3,-2,9,3,l,4,f,4,7,9,a,9,6,h,h,9,5,b,p,-3y,0,-2,-7,-6,-a,-3,-p,-2,-7,-6,-6,-e,-6,-j,-g,-4,0,-c,-6,-7,-1,-9,5,-o,z,-c,5,-a,3,-e,8,-e,g,-6,5,-2,7,-1l,0,-2,-5,-b,-1,0,-6,-f,5,-m,-8,-7,-8,-6,2,-6,8,-f,d,-ez,0,4,-4,9,1,e,-6,4,-3,-2,-7,2,-3,b,-9,6,-1,7,-4,5,3,3,-1,b,b,9,3,7,-3,z,0,a,-4,8,5,g,2,9,4,p,6,9,0,j,-6,5,1,7,-3,4,1,4,4,g,6,5,-5,3,-1,b,3,c,6,6,1,9,-2,g,-7,6,-9,6,-y,5,-13,3,-8,4,-2,-3,-5,-4,7,2,-11,5,-r,b,b,2,5,4,g,6,7,-4,-6,-4,-m,-3,-6,-h,-j,-1,-4,4,1,4,2,-3,-e,-2,-t,-b,-2,-h,-c,-c,-m,-1,-8,3,-9,-3,-5,-5,-4,4,-8,4,0,c,4,-a,-7,-h,2,-6,-2,-1,-5,4,-7,-5,-4,-a,1,-1,-2,3,-5,-2,-1,-8,1,-5,-1,-4,-5,-4,0,-3,-2,-5,0,-3,-3,-h,-6,-7,-1,-7,3,-4,-1,-5,-b,-b,-5,3,-3,a,-3,3,-3,-8,-5,-3,-4,2,-2,5,2,7,-1,-2,-3,-4,-2,-e,0,-2,-6,1,-7,9,-6,k,-6,9,1,6,-1,8,-4,3,-4,a,-2,a,4,e,i,a,-8,g,1,4,4,4,-8,3,5,k,-2,-5,-3,-3,-8,-1,-t,-a,-m,-3,-7,1,-7,c,1,9,-3,5,2,1,e,4,8,8,-1,8,3,b,0,g,5,6,-3,7,-5,c,-4,1,-1,-7,0,-7,-3,0,-4,3,-a,j,-c,d,-4,e,-6,7,-7,8,-c,-2,-3,1,-x,4,-a,5,-4,6,-4,n,-6,m,-e,l,-a,7,0,d,3,5,-3,5,3,4,-2,-9,-5,-8,3,-6,-3,-4,0,-6,-7,4,-3,8,-1,7,2,b,8,6,-1,-c,-9,8,-1,-b,-f,4,-8,k,-s,3,-a,5,-r,4,-a,5,2,8,-3,d,-a,3,-9,4,-4,f,-8,8,-2,x,-3,7,9,a,3,-7,-7,3,-d,4,-8,3,-2,f,-1,h,1,7,b,-3,5,4,3,2,-1,4,-c,7,7,0,9,2,-c,-1,-9,0,-8,5,-7,c,3,d,-1,5,3,b,f,4,3,5,1,-6,-4,-e,-j,-f,-5,-3,-5,0,-j,-6,-4,-5,1,0,-7,d,-5,0,-6,-c,-i,-1,-f,-4,-b,5,-1,-1,-d,-2,-7,-l,-d,3,-s,-3,-c,2,-y,5,-1,c,4,5,5,3,-a,6,-8,8,-4,6,7,2,-n,-6,-2,-5,2,-a,l,-7,1,-6,4,-9,-7,1,-7,6,-a,9,-9,8,0,a,-3,b,0,6,-2,5,-4,i,-q,d,-3,c,-8,3,0,-6,9,-1,3,4,9,-1,f,-a,i,0,s,9,7,f,0,4,6,-3,b,-5,4,-9,3,-5,-6,-2,2,-3,3,-6,q,-7,-1,-5,2,6,6,-6,4,-d,g,3,h,-1,4,-6,7,-2,5,5,0,5,3,2,3,-1,3,2,8,6,3,5,7,1,7,-7,8,c,-1,3,6,6,-2,g,9,d,-5,2,7,-3,8,-8,7,2,5,2,1,9,-1,c,5,i,-f,d,-1,3,-5,i,-h,j,4,5,9,d,b,c,-1,5,a,2,c,3,4,s,c,-1,-e,-9,-3,-j,-1,-1,-4,1,-5,-4,-4,0,-5,i,e,6,1,f,-7,o,-9,14,-b,g,-k,e,-3,g,-a,10,-8,a,0,j,c,2,3,-d,-8,-3,0,a,n,8,5,6,1,i,-2,7,-4,9,-8,4,-7,4,-8,1,-d,6,-3,d,1,5,-3,7,-8,e,-m,5,-g,-1,9,-3,b,-j,r,d,5,5,0,8,-2,2,-p,-1,-5,1,-8,-8,-r,-2,-w,1,-s,2,-e,c,-e,5,-n,b,-i,10,-b,5,9,l,k,6,h,g,9,c,-3,f,-c,5,-6,1,-5,-2,-o,-3,-a,2,-9,5,-f,1,-b,3,-3,-1,-4,-8,-2,-4,7,-6,2,-f,-7,-3,-6,0,-5,-6,-5,-2,-6,1,-4,6,-6,-7,0,-4,-a,4,-5,-2,-3,2,-5,-1,-7,d,-6,d,-1,-1,-6,5,0,9,-7,9,1,c,-5,p,0,3,-3,0,-6,c,1,t,6,7,0,f,7,g,0,o,3,5,-4,3,-6,-2,-d,2,-4,3,0,3,4,6,3,4,-4,1,-5,3,-3,3,2,7,1,8,-1,9,-d,n,3,j,6,2,-2,1,-4,-9,-5,-5,-7,-6,-5,-7,-1,-8,2,-d,-1,-c,-b,-7,-3,-6,-c,5,4,1,-9,-6,-5,-e,8,-i,3,-d,5,-b,-6,-6,1,-5,4,-a,1,-9,3,0,-4,3,-9,1,-2,-2,0,-5,b,-3,4,-8,1,-7,-5,-4,0,4,a,-4,-1,-8,6,-2,0,-3,-5,-9,6,-8,1,-5,4,-o,5,-6,7,-5,-1,-r,5,-b,-1,-c,a,-7,2,-3,0,a,-b,0,-4,-5,-2,-3,-3,-4,-9,-2,0,-2,8,-3,4,-5,2,-8,0,-1,-5,2,-4,-1,-1,1,-3,4,0,1,-2,0,-2,-3,0,0,-2,3,-7,-f,-2,-e,-7,-3,0,-2,-7,-9,5,-7,-5,-1,-3,-3,-o,1,-7,5,-8,1,-o,2,0,-3,-4,4,-2,1,-1,-9,-o,-6,-6,4,-h,-1,-9,-7,-5,-3,-f,1,-5,3,-8,c,-b,0,-7,8,0,-3,-5,-2,-7,c,-3,4,2,9,-2,9,-5,-3,-9,1,-2,3,1,-1,-4,4,1,5,-7,0,-5,a,-3,b,-a,a,-5,b,-a,5,-1,2,-7,c,-a,4,-8,b,-a,a,-f,-3w,0,5,d,5,6,-1,3,-1,3,-j,f,-c,n,-3,3,-a,4,-b,8,-c,4,-6,5,-3,6,-3,0,-6,-4,-1,7,-6,-4,-5,9,-9,8,-9,-1,-1,1,3,3,-b,2,-4,8,-8,3,-1,2,8,1,-2,7,-9,3,-3,4,-4,0,0,-3,-6,0,-2,-4,-1,1,4,b,-3,5,6,4,-4,2,-5,6,-5,0,-3,3,-3,0,-7,-4,-2,6,3,7,4,5,4,2,-5,5,-6,m,4,e,-c,-3,1,5,-3,6,1,8,-1,6,3,5,-2,3,2,o,3,a,-1,8,5,5,8,0,5,7,c,-4,3,6,6,8,4,3,7,2,7,6,-1,8,2,2,9,3,6,a,2,9,0,5,-v,n,-2,2,-3,-1,-8,5,0,2,7,1,6,-3,5,-1,6,-3,2,2,2,4,-9,3,-1,8,-4,5,-8,4,-c,8,-3,-1,-4,4,-9,4,-5,6,-g,9,-t,-1,-4,2,7,3,4,-1,e,2,6,7,-c,4,5,g,-3,4,0,i,-5,1,-1,7,2,i,2,5,-1,5,-7,c,2,f,-7,q,-9,g,-7,k,-7,7,-9,-4,-d,2,-c,-1,-b,1,-3,2,1,7,-4,1,-4,-2,-7,5,-8,b,-1,8,6,e,-7,a,-g,-2,-l,6,-j,-5,2,-5,2,-k,-m,-14,a,4,4,-2,-6,-d,9,-1,2,-4,-1,-8,-7,-3,-7,-c,-6,-6,-c,-o,-4,-g,-4,2,-4,-j,-6,-3,-1,-j,-7,-2,-4,-8,-1,-h,-5,-3,-3,1,1,-8,-3,-t,-3,-9,2,-6,5,-1,4,4,0,-2,-1,-3,-n,-6,-8,-f,-3,-s,-2,5,1,8,-7,5,2,b,-1,7,-b,k,-4,-2,-5,5,-5,1,-2,-5,-7,-7,-4,0,6,8,-1,3,-f,8,3,4,-3,4,-4,1,-2,4,-b,8,-i,k,-f,c,-6,-1,-7,5,-i,5,-b,-2,-9,1,-4,-3,0,-5,-1,-1,-4,0,-3,6,-7,-4,6,-7,-2,-3,-c,0,-e,-8,-3,-5,-c,-6,-5,-7,-3,-8,1,-j,3,-2,a,4,b,6,b,-9,-1,-2,-a,5,-9,-8,0,-3,2,-2,1,-4,0,-8,k,-j,-1,-1,-5,2,-j,e,-c,4,-5,7,-4,2,-8,1,-2,-5,5,-p,2,-6,5,-1,3,-4,d,4,4,-6,5,0,a,-6,0,-1,-h,3,-3,-1,-1,-4,f,-g,3,-b,9,-9,7,-4,2,3,-2,g,9,-k,3,-3,7,-1,2,-3,-8,1,-k,6,-9,5,-a,f,-2,6,-3,3,-5,1,-6,8,-2,6,-g,d,-1,-2,0,-c,5,-b,-2,-4,1,-4,d,2,8,-4,-1,-3,-b,0,-5,-3,-5,-8,-2,-a,1,-3,h,-a,4,-5,-2,0,-6,5,-9,4,-6,-5,-3,-5,-1,-p,3,-2,9,2,9,-1,l,-4,j,2,8,-4,7,0,9,6,0,5,3,3,2,-1,-2,-9,m,-7,2,-2,-8,-1,-3,-6,4,-a,-5,5,-2,6,0,8,-4,1,-a,0,-d,-3,-2,-2,1,-3,-1,-1,-5,a,-5,1,-d,-2,-j,1,-8,4,-6,-1,-9,-6,-4,-4,-1,-e,b,-1,4,-3,-8,-4,-3,-5,-4,-2,-3,-5,0,-d,2,-1,6,1,f,-1,o,8,k,-1,b,-5,-2,-1,-c,3,-c,-1,-s,-7,-9,1,-5,-1,-3,-5,2,-a,5,-2,2,2,3,0,5,-6,2,-5,8,-5,9,-3,3,1,4,4,m,-4,5,-5,-o,4,-1,-2,5,-6,1,-4,4,-3,h,-1,9,0,e,2,a,4,8,-3,-7,-1,0,-5,c,-4,d,0,-3,-3,-r,4,-7,-3,-6,0,-e,4,-2,-2,8,-f,k,-7,8,-5,d,-1,a,1,5,7,i,b,-1,-2,-g,-f,-4,-6,2,-6,3,-3,e,-2,2,-2,0,-4,-2,-3,-9,-1,-1,-4,2,-3,c,-6,7,-2,d,4,1,2,-4,5,1,3,3,0,7,-8,g,-4,b,b,2,6,1,0,3,-3,5,-2,p,0,-4,-7,2,-5,a,-6,7,-1,b,-7,-3,-5,-5,-1,c,-8,-1,-2,-6,-1,-a,4,-7,5,6,6,-5,5,-q,f,-c,4,-6,-1,-7,-d,-7,2,-1,-2,2,-7,4,-5,7,-4,6,-c,a,-7,e,-i,c,-5,4,-6,7,-3,6,-5,9,-3,sb,0,0,c,7,9,b,5,6,2,a,-3,i,c;yh,15e,-5,-3,1,-5,h,3,2,2,-3,3;bh,so,-2,5,-4,-2,0,-1,4,-3;c2,t7,0,4,-2,1,-1,-1,-7,0,1,-6;10y,89,-1,2,-1,-3,1,-3,2,-2,4,1;1h6,ze,6,4,-7,-1,-d,-3,-6,-4,-2,-8,5,7;166,9k,-3,4,-3,-3,-5,8,-5,1,-3,-1,0,-3,-3,-8,-4,-3,-7,0,-4,-3,h,-3,6,-7,3,-1,2,1,1,5,8,1,3,5,1,7;16p,a5,-4,0,-8,-5,4,-5,7,3;96,j2,-9,a,-3,-2,-4,1,3,-c,4,-3,5,-8,3,-2,2,1,2,9;6i,e5,-2,1,0,-1,4,-5,4,0;8c,gh,-6,0,-4,-2,-3,-a,3,-7,3,-1,4,4,3,7;7j,en,-i,4,-6,0,1,-3,5,-2,2,-9,-8,-5,1,-4,5,-3,3,0,7,8,8,4;73,fi,3,h,-1,3,-9,4,1,-5,-1,-8,-2,0,-7,6,2,-8,4,-5,2,1;7a,fq,-3,1,-1,-6,1,-3,6,-3,-3,-2,2,-4,9,-5;d8,64,-1,1,-4,-8,3,-8,4,0,1,2,-1,2,-2,1;cx,62,1,5,2,-1,3,5,5,-2,-6,w,-5,a,-2,-3,3,-f,0,-2,-2,-3,-7,1,0,-4,-7,-1,-1,-3,8,-1,5,-3,-3,-a,-6,-2,9,-8,3,0;dk,5i,-2,9,-4,0,-1,-4,1,-5,2,1,2,-2;ao,9n,-5,1,-4,-5,-1,-5,6,1,2,6;9f,ku,2,1,5,0,-2,3,-c,a,-2,-3,-3,0,-3,-7,-1,-9,5,-2,6,0;bf,8r,-5,0,2,-5,9,0;ay,9r,-4,-6,6,-1;at,95,-1,2,b,2,3,2,-2,3,-3,2,-5,-4,-9,1,-2,-5,-4,2,-1,-7,2,-5,2,-1,9,3,1,3;6i,3h,-2,3,-8,-6,-2,-4,a,3;6f,47,-1,2,-8,-8,-2,-8,9,5;5t,2s,6,5,-5,3,-9,-3,-2,-5;6i,2m,-2,a,-5,-3,-2,-1,-1,2,5,9,0,3,-c,-a,-7,-e,9,-3;b7,8u,-4,2,-1,-2,-1,-5,-6,-3,-2,-3,3,-1,7,8,4,1;6r,2j,-2,6,-4,-2,0,-b;70,ai,-5,d,-a,7,6,2,-1,4,-b,8,-5,6,-2,0,-5,6,-2,-1,-3,-4,a,-8,-9,-6,3,-3,-5,-4,1,-6,3,-4,5,4,7,-1,-2,-8,o,-f,1,5;6x,de,-3,0,-4,-4,5,-3,2,3;73,ca,-1,7,1,7,3,2,8,2,8,-1,1,1,-1,4,-b,c,-3,-1,-1,-b,-5,1,-7,-1,-5,-9,-b,-3,-3,-6,2,-4,3,1,3,-1,-2,-5,a,-2,1,-5,5,1,4,5;5s,bx,5,4,-4,7,-6,0,-8,-5,2,-4,9,0;5r,d2,-6,-1,-2,-7,1,-b,6,1;2h,jm,0,3,-5,-6,-9,-1,4,-3,8,1,2,1;5j,dd,-4,1,-1,-1,1,-3,3,-1,2,2;152,6h,-3,0,-5,-3,0,-2,2,0,-1,-5,3,3,2,2,-2,1;129,6s,0,2,-3,0,-1,2,-2,-1,-1,-3,2,-4,3,0;12n,6g,4,0,8,7,-3,5,-7,1,0,6,-a,1,-3,-1,-3,-a,1,-3,4,-1,0,5,3,0,1,-6,-4,-4,2,-3,2,-1;144,j,1,1,2,0,4,-2,2,1,0,3,-2,0,-5,4,-5,-4,-3,-6,7,0;11n,bf,-1,5,-2,-1,-2,-3,4,-5,8,1,-7,3;yg,er,-2,4,-2,0,-1,-5,0,-j,a,-n,4,-2,d,-w,4,1,-3,3,0,6,-7,g,-2,b,-3,2;wq,hd,-2,1,-7,-2,-9,-5,2,-a,2,-5,g,c,0,4;v2,io,1,5,-1,2,-5,-4,-5,0,-3,7,-2,0,-8,-6,-1,-5,1,-b,2,-3,0,-4,5,-4,3,0,3,6,8,4,0,2,-4,5,1,3;tn,hh,-1,1,-7,-1,-8,5,-2,-1,2,-5,4,-3,0,-3,2,1,7,2;ts,g6,-5,3,-1,-4,3,-5;s8,hm,7,5,6,0,3,1,1,a,-d,4,-i,-b,1,-c,8,-1;r6,hq,-3,0,-4,-1,-6,-8,9,5,4,3;qn,hn,-4,1,-7,-3,-1,-c,9,6;rg,hx,-1,0,-3,-8,e,-m;rb,ft,-1,1,-3,-1,0,-d,1,-3,5,9;s4,il,-6,0,-6,-3,2,-4,2,-1,6,2;ru,cs,-2,2,-5,-2,2,-4,7,-1,4,0;oj,hu,-1,2,0,-b,5,-b,2,0,-2,5,-1,7,b,0,-1,2,-b,2;d2,101,-1,6,-7,-b,-1,-6,5,3;d7,q8,-3,2,-2,5,-3,0,-2,0,-9,-6,-2,1,2,-3,9,-5,7,3;ke,ld,-4,5,-3,-3,1,-4,6,-7,0,9;we,11x,-6,1,-3,-5,-4,0,-3,-4,-1,-1,4,-4,2,-5;wf,12d,1,3,-8,-4,0,-6,3,1;wu,138,-1,2,-b,-d,-7,-g,7,7,e,j;wu,143,1,1,-3,0,-c,-k;w0,12k,-1,3,-2,-4,-5,-j,1,-6,-2,-a,3,-1,2,a,3,4;j9,o3,6,6,-5,2,-6,-5,-4,1,-1,-2,0,-2,3,-1;ov,hz,-2,2,-6,-2,5,-3,2,1;15a,6f,8,1,2,3,-4,3,-1,3,3,5,-5,0,-3,-6,-4,-3,2,-5;14e,63,0,3,-6,1,-3,-4,0,-7,1,-1,2,3;14v,6w,-4,2,-2,-1,0,-4,3,-2,4,0;13e,73,0,2,-4,0,-5,-2,4,-3,3,1;14m,6y,-4,1,-2,-2,4,-4,2,0;kh,4y,-7,0,2,-7,1,-1,2,-1,3,4;oa,c,-9,-1,-4,-5,c,-4,3,3,0,5;oq,-c,-5,0,-3,-2,i,-6,1,-2,4,2,-1,5;kn,6j,0,9,-4,-1,-2,-3,-1,-c,1,-3,2,0';

  let europeMask = null;
  // A 1px land raster of the frame (plus the grid's padding), filled once from the rings.
  function europeLand() {
    if (europeMask) return europeMask;
    const pad = FRAME_PAD;
    const cols = MAP_W + 2 * pad;
    const rows = MAP_H + 2 * pad;
    const grid = new Uint8Array(cols * rows);
    const rings = EUROPE_LAND.split(';').map((r) => {
      const v = r.split(',').map((n) => parseInt(n, 36));
      const pts = [];
      let x = 0;
      let y = 0;
      for (let i = 0; i < v.length; i += 2) {
        x += v[i];
        y += v[i + 1];
        pts.push([x / 2 + pad, y / 2 + pad]);
      }
      return pts;
    });
    const xs = [];
    for (let row = 0; row < rows; row++) {
      const y = row + 0.5;
      xs.length = 0;
      for (const r of rings) {
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const [x1, y1] = r[j];
          const [x2, y2] = r[i];
          if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5));
        const b = Math.min(cols - 1, Math.floor(xs[k + 1] - 0.5));
        for (let col = a; col <= b; col++) grid[row * cols + col] = 1;
      }
    }
    europeMask = (x, y) => {
      const col = Math.floor(x + pad);
      const row = Math.floor(y + pad);
      return col >= 0 && row >= 0 && col < cols && row < rows && grid[row * cols + col] === 1;
    };
    return europeMask;
  }

  // The realms of about 1000 AD (the "states"), and their lands (the territories, or "substates").
  const EUROPE_REALMS = {
    eng: 'Kingdom of England',
    wal: 'Welsh Kingdoms',
    alba: 'Kingdom of Alba',
    iri: 'Kingdoms of Ireland',
    den: 'Kingdom of Denmark',
    nor: 'Kingdom of Norway',
    swe: 'Kingdom of Sweden',
    balt: 'Baltic and Finnic Lands',
    rus: 'Kievan Rus’',
    pol: 'Duchy of Poland',
    boh: 'Duchy of Bohemia',
    hun: 'Kingdom of Hungary',
    ger: 'Kingdom of Germany',
    ita: 'Kingdom of Italy',
    bur: 'Kingdom of Burgundy',
    fra: 'Kingdom of France',
  };
  // [name, realm, latitude, longitude, terrain]
  const EUROPE_TERRITORIES = [
    ['Wessex', 'eng', 51.1, -1.6, 'grassland'],
    ['Kent', 'eng', 51.2, 0.8, 'coast'],
    ['Mercia', 'eng', 52.6, -1.7, 'grassland'],
    ['East Anglia', 'eng', 52.5, 0.9, 'marsh'],
    ['Jórvík', 'eng', 54.0, -1.1, 'grassland'],
    ['Northumbria', 'eng', 55.2, -1.9, 'hills'],
    ['Cornwall', 'eng', 50.4, -4.8, 'coast'],
    ['Gwynedd', 'wal', 52.9, -3.8, 'mountains'],
    ['Deheubarth', 'wal', 51.9, -4.3, 'hills'],
    ['Strathclyde', 'alba', 55.6, -4.2, 'hills'],
    ['Alba', 'alba', 56.5, -3.5, 'hills'],
    ['Moray', 'alba', 57.4, -3.8, 'mountains'],
    ['Argyll and the Isles', 'alba', 56.3, -5.3, 'coast'],
    ['Ulaid', 'iri', 54.5, -6.0, 'hills'],
    ['Ailech', 'iri', 54.8, -7.5, 'hills'],
    ['Dublin and Mide', 'iri', 53.5, -6.6, 'grassland'],
    ['Leinster', 'iri', 52.7, -6.7, 'grassland'],
    ['Munster', 'iri', 52.4, -8.4, 'grassland'],
    ['Connacht', 'iri', 53.7, -9.0, 'marsh'],
    ['Jutland', 'den', 56.2, 9.1, 'grassland'],
    ['Zealand', 'den', 55.5, 11.8, 'coast'],
    ['Scania', 'den', 55.8, 13.6, 'grassland'],
    ['Viken', 'nor', 59.5, 10.6, 'coast'],
    ['Agder', 'nor', 58.5, 7.5, 'coast'],
    ['Vestlandet', 'nor', 60.8, 6.3, 'mountains'],
    ['Trøndelag', 'nor', 62.9, 10.5, 'mountains'],
    ['Orkney and Caithness', 'nor', 58.4, -3.3, 'coast'],
    ['Götaland', 'swe', 57.8, 14.2, 'forest'],
    ['Svealand', 'swe', 59.7, 16.8, 'forest'],
    ['Norrland', 'swe', 61.8, 16.0, 'forest'],
    ['Gotland', 'swe', 57.5, 18.5, 'coast'],
    ['Finland', 'balt', 61.0, 23.8, 'forest'],
    ['Estonia', 'balt', 58.7, 25.6, 'forest'],
    ['Curonia', 'balt', 57.0, 22.3, 'forest'],
    ['Lithuania', 'balt', 55.3, 24.2, 'forest'],
    ['Prussia', 'balt', 54.3, 21.0, 'forest'],
    ['Novgorod', 'rus', 58.5, 31.2, 'forest'],
    ['Polotsk', 'rus', 55.6, 28.6, 'forest'],
    ['Turov', 'rus', 52.1, 27.5, 'marsh'],
    ['Volhynia', 'rus', 50.8, 25.3, 'grassland'],
    ['Kiev', 'rus', 50.4, 30.4, 'grassland'],
    ['Pomerania', 'pol', 53.9, 15.6, 'coast'],
    ['Greater Poland', 'pol', 52.4, 17.2, 'grassland'],
    ['Masovia', 'pol', 52.4, 21.0, 'grassland'],
    ['Silesia', 'pol', 51.0, 16.8, 'grassland'],
    ['Lesser Poland', 'pol', 50.0, 20.2, 'hills'],
    ['Bohemia', 'boh', 50.0, 14.4, 'hills'],
    ['Moravia', 'boh', 49.3, 17.0, 'hills'],
    ['Nitra', 'hun', 48.4, 18.6, 'hills'],
    ['Hungary', 'hun', 47.3, 19.6, 'grassland'],
    ['Transylvania', 'hun', 46.6, 24.0, 'mountains'],
    ['Frisia', 'ger', 53.1, 6.3, 'marsh'],
    ['Saxony', 'ger', 52.4, 10.0, 'grassland'],
    ['Wendland', 'ger', 53.7, 12.4, 'forest'],
    ['Thuringia', 'ger', 51.0, 11.2, 'forest'],
    ['Meissen', 'ger', 51.2, 13.6, 'hills'],
    ['Brabant', 'ger', 50.9, 5.2, 'grassland'],
    ['Lotharingia', 'ger', 49.4, 6.6, 'forest'],
    ['Franconia', 'ger', 49.8, 9.9, 'forest'],
    ['Swabia', 'ger', 48.3, 9.3, 'hills'],
    ['Bavaria', 'ger', 48.5, 12.2, 'grassland'],
    ['East March', 'ger', 48.2, 15.9, 'hills'],
    ['Carinthia', 'ger', 46.8, 14.2, 'mountains'],
    ['Lombardy', 'ita', 45.6, 9.6, 'grassland'],
    ['Friuli', 'ita', 46.0, 13.0, 'hills'],
    ['Upper Burgundy', 'bur', 46.8, 7.2, 'mountains'],
    ['Franche-Comté', 'bur', 47.3, 6.0, 'forest'],
    ['Flanders', 'fra', 51.0, 3.0, 'grassland'],
    ['Normandy', 'fra', 49.1, 0.2, 'coast'],
    ['Brittany', 'fra', 48.1, -2.9, 'coast'],
    ['Francia', 'fra', 48.8, 2.4, 'grassland'],
    ['Champagne', 'fra', 48.9, 4.4, 'grassland'],
    ['Blois', 'fra', 47.6, 1.4, 'grassland'],
    ['Anjou', 'fra', 47.4, -0.6, 'grassland'],
    ['Duchy of Burgundy', 'fra', 47.2, 4.6, 'hills'],
    ['Poitou', 'fra', 46.5, 0.1, 'grassland'],
    ['Aquitaine', 'fra', 45.4, 0.8, 'forest'],
    ['Auvergne', 'fra', 45.6, 3.1, 'mountains'],
  ];
  // The sea roads raiders actually used (Lindisfarne, the Danelaw, the Norman crossing...).
  // Pairs already sharing a land border are skipped.
  const EUROPE_LANES = [
    ['Vestlandet', 'Orkney and Caithness'],
    ['Vestlandet', 'Northumbria'],
    ['Agder', 'Jutland'],
    ['Viken', 'Jutland'],
    ['Jutland', 'East Anglia'],
    ['Jutland', 'Zealand'],
    ['Zealand', 'Scania'],
    ['Zealand', 'Wendland'],
    ['Scania', 'Pomerania'],
    ['Gotland', 'Götaland'],
    ['Gotland', 'Svealand'],
    ['Gotland', 'Curonia'],
    ['Svealand', 'Finland'],
    ['Svealand', 'Estonia'],
    ['Finland', 'Estonia'],
    ['East Anglia', 'Frisia'],
    ['Kent', 'Flanders'],
    ['Wessex', 'Normandy'],
    ['Cornwall', 'Brittany'],
    ['Gwynedd', 'Dublin and Mide'],
    ['Deheubarth', 'Leinster'],
    ['Argyll and the Isles', 'Ulaid'],
    ['Strathclyde', 'Ulaid'],
    ['Orkney and Caithness', 'Argyll and the Isles'],
  ];
  // Who starts where: one kingdom per Pillage faction, at its historical seat, with the ruler of about 1000.
  const EUROPE_KINGDOMS = [
    { faction: 'vikings', name: 'Kingdom of Denmark', ruler: { title: 'King', name: 'Sweyn Forkbeard' }, motto: 'The whale-road is ours', capital: 'Jutland', trait: 'reavers', arms: { division: 'plain', field: 'or', second: 'or', charge: 'raven', chargeColor: 'sable' } },
    { faction: 'saxons', name: 'Kingdom of England', ruler: { title: 'King', name: 'Æthelred the Unready' }, motto: 'Not one hide of land', capital: 'Wessex', trait: 'ironwall', arms: { division: 'plain', field: 'gules', second: 'gules', charge: 'dragon', chargeColor: 'or' } },
    { faction: 'normans', name: 'Duchy of Normandy', ruler: { title: 'Duke', name: 'Richard the Good' }, motto: 'Dex aie', capital: 'Normandy', trait: 'merchants', arms: { division: 'plain', field: 'azure', second: 'azure', charge: 'crown', chargeColor: 'or' } },
    { faction: 'irish', name: 'Kingdom of Munster', ruler: { title: 'King', name: 'Brian Bóruma' }, motto: 'From Cashel to the sea', capital: 'Munster', trait: 'zealots', arms: { division: 'plain', field: 'vert', second: 'vert', charge: 'stag', chargeColor: 'or' } },
  ];

  function europeCampaign(o, seed, now, nK) {
    const gen = normGen(o.gen);
    const map = { engine: 2, kind: 'europe', width: MAP_W, height: MAP_H, seed: hashString('map:' + seed), shape: 'europe', gen };
    const rng = mulberry32(hashString('sites:' + seed));
    const wealth = [0.65, 1, 1.45][gen.wealth];
    const defences = [0.65, 1, 1.45][gen.defences];
    const territories = EUROPE_TERRITORIES.map(([name, realm, lat, lon, terrain], i) => {
      const ts = TERRAIN_STATS[terrain];
      const [x, y] = europeXY(lat, lon);
      return {
        id: 't' + (i + 1),
        name,
        realm: EUROPE_REALMS[realm],
        position: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
        goldValue: Math.max(10, Math.round(((60 + rng() * 140) * ts.gold * wealth) / 5) * 5),
        garrisonBase: Math.max(5, Math.round((15 + rng() * 65) * ts.garrison * defences)),
        garrison: 0,
        status: 'unclaimed',
        terrain,
        conquered: false,
        control: 0,
        damage: 0,
        override: null,
        overrideBy: null,
        editedAt: 0,
      };
    });
    const c = {
      id: newId('c'),
      name: '',
      seed,
      version: 3,
      createdAt: now,
      updatedAt: now,
      year: 1,
      season: 'spring',
      seasonAt: 0,
      goalPct: 35,
      settingsAt: 0,
      map,
      territories,
      kingdoms: [],
      players: [],
      raids: [],
      adjustments: [],
      milestones: [],
      deleted: [],
    };
    const byName = new Map(territories.map((t) => [t.name, t.id]));
    const krng = mulberry32(hashString('kingdoms:' + seed));
    c.kingdoms = EUROPE_KINGDOMS.slice(0, nK).map((spec, i) => {
      const k = randomKingdom(krng, i, byName.get(spec.capital), spec.capital, { now: 0 });
      return Object.assign(k, JSON.parse(JSON.stringify(spec)), { capital: byName.get(spec.capital) });
    });
    if (Array.isArray(o.kingdomSpecs)) o.kingdomSpecs.forEach((spec, i) => c.kingdoms[i] && Object.assign(c.kingdoms[i], spec));
    c.players = assignPlayers(c, o.players, 0);
    c.name = o.name || 'Anno Domini 1000';
    return snapshot(c);
  }

  /*
   * The fine grid: cells, their shared corners, which cells are land, and the
   * fields generation and rivers need (distance from the coast, elevation, moisture).
   */
  function buildFine(map) {
    const W = map.width;
    const H = map.height;
    const europe = map.kind === 'europe';
    const s = europe ? FINE_EUROPE : FINE;
    const pad = FRAME_PAD;
    const g = normGen(map.gen);
    const rng = mulberry32((map.seed ^ 0x27d4eb2d) >>> 0);
    const cols = Math.ceil((W + 2 * pad) / s);
    const rows = Math.ceil((H + 2 * pad) / s);
    const pts = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) pts.push([-pad + (i + 0.5 + (rng() - 0.5) * 0.7) * s, -pad + (j + 0.5 + (rng() - 0.5) * 0.7) * s]);
    }
    const frame = [[-pad, -pad], [W + pad, -pad], [W + pad, H + pad], [-pad, H + pad]];
    const vkey = new Map();
    const verts = [];
    function vid(p) {
      const kx = Math.round(p[0] * 100);
      const ky = Math.round(p[1] * 100);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const id = vkey.get((kx + dx) * 200003 + (ky + dy));
          if (id !== undefined && Math.abs(verts[id][0] - p[0]) < 1e-4 && Math.abs(verts[id][1] - p[1]) < 1e-4) return id;
        }
      }
      verts.push(p);
      vkey.set(kx * 200003 + ky, verts.length - 1);
      return verts.length - 1;
    }
    const field = europe ? null : makeShapeField(map);
    const onLand = europe ? europeLand() : null;
    const nm = [0.45, 1, 1.6][g.rough];
    const n1 = valueNoise(map.seed + 17);
    const n2 = valueNoise(map.seed + 29);
    const cells = pts.map((p, idx) => {
      const ci = idx % cols;
      const cj = (idx / cols) | 0;
      const near = [];
      for (let dj = -2; dj <= 2; dj++) {
        for (let di = -2; di <= 2; di++) {
          const ni = ci + di;
          const nj = cj + dj;
          if ((di || dj) && ni >= 0 && nj >= 0 && ni < cols && nj < rows) near.push(nj * cols + ni);
        }
      }
      near.sort((a, b) => dist(p, pts[a]) - dist(p, pts[b]));
      let poly = frame.slice();
      let labels = [-2, -2, -2, -2];
      for (const j of near) if (poly.length) [poly, labels] = clipCell(poly, labels, p, pts[j], j);
      const vids = poly.map(vid);
      const land = europe ? onLand(p[0], p[1]) : field(p[0], p[1]) + nm * (0.16 * n1(p[0] / 160, p[1] / 160) + 0.06 * n2(p[0] / 50, p[1] / 50)) > 0;
      return { p, poly, labels, vids, area: Math.abs(polygonArea(poly)), land };
    });
    const n = cells.length;
    // Distance from the sea over land, for elevation.
    const coastDist = new Float64Array(n).fill(Infinity);
    const queue = [];
    cells.forEach((c, i) => {
      if (!c.land) return;
      if (c.labels.some((L) => L >= 0 && !cells[L].land)) {
        coastDist[i] = 0;
        queue.push(i);
      }
    });
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      for (const L of cells[i].labels) {
        if (L < 0 || !cells[L].land) continue;
        const d = coastDist[i] + dist(cells[i].p, cells[L].p);
        if (d < coastDist[L] - 1e-9) {
          coastDist[L] = d;
          queue.push(L);
        }
      }
    }
    const ridge = valueNoise(map.seed + 41);
    const hills = valueNoise(map.seed + 53);
    const wet = valueNoise(map.seed + 67);
    cells.forEach((c, i) => {
      const [x, y] = c.p;
      const cd = Number.isFinite(coastDist[i]) ? coastDist[i] : 400;
      c.coastDist = cd;
      c.elev = c.land ? 0.55 * Math.min(1, cd / 230) + 0.35 * (1 - Math.abs(ridge(x / 240, y / 240))) + 0.15 * hills(x / 90, y / 90) : -1;
      c.moist = wet(x / 220, y / 220) + (cd < 40 ? 0.15 : 0);
    });
    return { cells, verts, cols, rows };
  }

  function landComponents(cells) {
    const comp = new Int32Array(cells.length).fill(-1);
    const comps = [];
    cells.forEach((c, i) => {
      if (!c.land || comp[i] >= 0) return;
      const id = comps.length;
      const members = [i];
      comp[i] = id;
      for (let qi = 0; qi < members.length; qi++) {
        for (const L of cells[members[qi]].labels) {
          if (L >= 0 && cells[L].land && comp[L] < 0) {
            comp[L] = id;
            members.push(L);
          }
        }
      }
      comps.push({ id, members, area: members.reduce((s, m) => s + cells[m].area, 0) });
    });
    return { comp, comps };
  }

  // Grow territories outward from their seats over land; noisy costs make the borders organic.
  function growRegions(map, cells, comp, seeds) {
    const g = normGen(map.gen);
    const k = [0.15, 0.55, 1.0][g.borders];
    const bn = valueNoise(map.seed + 79);
    const owner = new Int32Array(cells.length).fill(-1);
    const cost = new Float64Array(cells.length).fill(Infinity);
    const reach = map.kind === 'europe' ? EUROPE_REACH : Infinity;
    // Binary heap keyed by cost.
    const heap = [];
    const push = (i, c) => {
      heap.push([c, i]);
      let j = heap.length - 1;
      while (j > 0) {
        const p = (j - 1) >> 1;
        if (heap[p][0] <= heap[j][0]) break;
        [heap[p], heap[j]] = [heap[j], heap[p]];
        j = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let j = 0;
        for (;;) {
          const l = 2 * j + 1;
          const r = l + 1;
          let m = j;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === j) break;
          [heap[m], heap[j]] = [heap[j], heap[m]];
          j = m;
        }
      }
      return top;
    };
    seeds.forEach((s, t) => {
      cost[s] = 0;
      owner[s] = t;
      push(s, 0);
    });
    while (heap.length) {
      const [c0, i] = pop();
      if (c0 > cost[i]) continue;
      const pi = cells[i].p;
      for (const L of cells[i].labels) {
        if (L < 0 || !cells[L].land || comp[L] !== comp[i]) continue;
        const pl = cells[L].p;
        const mx = (pi[0] + pl[0]) / 2;
        const my = (pi[1] + pl[1]) / 2;
        const c1 = c0 + dist(pi, pl) * Math.exp(k * bn(mx / 90, my / 90));
        if (c1 < cost[L] && c1 <= reach) {
          cost[L] = c1;
          owner[L] = owner[i];
          push(L, c1);
        }
      }
    }
    return owner;
  }

  function nearestCell(cells, x, y, pred) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < cells.length; i++) {
      if (pred && !pred(i)) continue;
      const d = (cells[i].p[0] - x) ** 2 + (cells[i].p[1] - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  function chaikin(pts, iterations, closed) {
    let p = pts;
    for (let it = 0; it < iterations && p.length > 2; it++) {
      const out = closed ? [] : [p[0]];
      const n = p.length;
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const a = p[i];
        const b = p[(i + 1) % n];
        out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      if (!closed) {
        out[1] = out[1];
        out.splice(1, 1);
        out.splice(out.length - 1, 1);
        out.push(p[n - 1]);
      }
      p = out;
    }
    return p;
  }

  /*
   * Outlines of every region (territory or islet): the cell edges where the
   * neighbour belongs elsewhere, chained into rings and cut into runs that share
   * one neighbour. A run between two territories is smoothed and warped the same
   * way from both sides, so shared borders match exactly.
   */
  function traceRegions(map, fine, region, regionCount, warp) {
    const { cells, verts } = fine;
    const g = normGen(map.gen);
    const coastSmooth = [2, 1, 0][g.rough];
    const borderSmooth = [3, 2, 1][g.borders];
    const out = Array.from({ length: regionCount }, () => ({ rings: [], runs: [], coastLength: 0, border: new Map() }));
    const edgesBy = Array.from({ length: regionCount }, () => new Map());
    cells.forEach((c, i) => {
      const R = region[i];
      if (R < 0) return;
      const n = c.vids.length;
      for (let k = 0; k < n; k++) {
        const a = c.vids[k];
        const b = c.vids[(k + 1) % n];
        if (a === b) continue;
        const L = c.labels[k];
        let lab;
        if (L === -2) lab = -2;
        else {
          const o = region[L];
          if (o === R) continue;
          lab = o < 0 ? -1 : o;
        }
        const m = edgesBy[R];
        if (!m.has(a)) m.set(a, []);
        m.get(a).push({ a, b, lab, used: false });
      }
    });
    const runCache = new Map();
    function processRun(ids, lab, closed) {
      const key = closed ? null : ids.join(',');
      const rkey = closed ? null : ids.slice().reverse().join(',');
      if (key && runCache.has(rkey)) return runCache.get(rkey).slice().reverse();
      let pts = ids.map((v) => verts[v]);
      const it = lab === -2 ? 0 : lab === -1 ? coastSmooth : borderSmooth;
      pts = chaikin(pts, it, closed).map((p) => warp(p[0], p[1]));
      if (key) runCache.set(key, pts);
      return pts;
    }
    for (let R = 0; R < regionCount; R++) {
      const m = edgesBy[R];
      for (const list of m.values()) {
        for (const e0 of list) {
          if (e0.used) continue;
          const loop = [];
          let e = e0;
          while (e && !e.used) {
            e.used = true;
            loop.push(e);
            const next = (m.get(e.b) || []).find((x) => !x.used);
            e = next;
          }
          if (loop.length < 3) continue;
          // Rotate so the loop starts where the neighbour changes.
          let start = loop.findIndex((x, i) => x.lab !== loop[(i - 1 + loop.length) % loop.length].lab);
          const single = start === -1;
          if (single) start = 0;
          const ordered = loop.slice(start).concat(loop.slice(0, start));
          const ring = [];
          let i = 0;
          while (i < ordered.length) {
            const lab = ordered[i].lab;
            const ids = [ordered[i].a];
            while (i < ordered.length && ordered[i].lab === lab) {
              ids.push(ordered[i].b);
              i++;
            }
            const len = ids.reduce((s, v, k) => (k ? s + dist(verts[ids[k - 1]], verts[v]) : 0), 0);
            let pts;
            if (single) {
              ids.pop();
              pts = processRun(ids, lab, true);
            } else pts = processRun(ids, lab, false);
            out[R].runs.push({ lab, pts, len, closed: single });
            if (lab === -1) out[R].coastLength += len;
            else if (lab >= 0) out[R].border.set(lab, (out[R].border.get(lab) || 0) + len);
            const add = single ? pts : pts.slice(0, -1);
            for (const p of add) ring.push(p);
          }
          out[R].rings.push(ring);
        }
      }
      out[R].rings.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
    }
    return out;
  }

  function fineRivers(map, fine, region, warp) {
    const { cells, verts } = fine;
    const g = normGen(map.gen);
    const nv = verts.length;
    const elev = new Float64Array(nv);
    const cnt = new Int32Array(nv);
    const coast = new Uint8Array(nv);
    const edge = new Uint8Array(nv);
    const nbrs = Array.from({ length: nv }, () => []);
    cells.forEach((c, i) => {
      if (!c.land) return;
      const n = c.vids.length;
      for (let k = 0; k < n; k++) {
        const a = c.vids[k];
        const b = c.vids[(k + 1) % n];
        elev[a] += c.elev;
        cnt[a]++;
        const L = c.labels[k];
        if (L === -2) edge[a] = edge[b] = 1;
        else if (!cells[L].land) coast[a] = coast[b] = 1;
        else if (a !== b && region[i] >= 0 && region[L] >= 0) {
          nbrs[a].push(b);
        }
      }
    });
    for (let v = 0; v < nv; v++) elev[v] = coast[v] ? 0 : cnt[v] ? elev[v] / cnt[v] : -1;
    const rng = mulberry32(hashString('rivers2:' + map.seed));
    const want = [2, 4, 7][g.rivers];
    const visible = (p) => p[0] > 25 && p[0] < map.width - 25 && p[1] > 25 && p[1] < map.height - 25 && clearOfDecor(p[0], p[1], 10);
    const cand = [];
    for (let v = 0; v < nv; v++) if (cnt[v] >= 2 && !coast[v] && !edge[v] && nbrs[v].length && visible(verts[v])) cand.push(v);
    cand.sort((a, b) => elev[b] - elev[a]);
    const top = cand.slice(0, Math.max(want * 6, Math.round(cand.length * 0.12)));
    const used = new Set();
    const sources = [];
    const rivers = [];
    const lakes = [];
    for (const start of top) {
      if (rivers.length >= want) break;
      if (used.has(start) || sources.some((s) => dist(verts[s], verts[start]) < 100)) continue;
      const path = [start];
      const seen = new Set(path);
      let cur = start;
      let end = 'lake';
      let budget = 0.05;
      for (let step = 0; step < 400; step++) {
        if (coast[cur]) {
          end = 'sea';
          break;
        }
        let best = -1;
        for (const nb of nbrs[cur]) if (!seen.has(nb) && (best === -1 || elev[nb] < elev[best])) best = nb;
        if (best === -1) break;
        const rise = elev[best] - elev[cur];
        if (rise > 0) {
          budget -= rise;
          if (budget < 0) break;
        }
        path.push(best);
        seen.add(best);
        if (used.has(best)) {
          end = 'join';
          break;
        }
        cur = best;
      }
      if (path.length < 7 || (end === 'lake' && path.length < 12)) continue;
      const points = chaikin(path.map((v) => verts[v]), 2, false).map((p) => warp(p[0], p[1]));
      rivers.push({ points, end });
      if (end === 'lake') {
        const p = points[points.length - 1];
        lakes.push({ x: p[0], y: p[1], r: 9 + rng() * 5 });
      }
      path.forEach((v) => used.add(v));
      sources.push(start);
    }
    return { rivers, lakes };
  }

  // Which cell each territory's seat sits on (nearest land cell to its stored position).
  function seatCells(fine, positions) {
    const taken = new Set();
    return positions.map((p) => {
      const i = nearestCell(fine.cells, p.x, p.y, (k) => fine.cells[k].land && !taken.has(k));
      taken.add(i);
      return i;
    });
  }

  function buildGeometry2(campaign) {
    const map = campaign.map;
    const fine = buildFine(map);
    const { cells } = fine;
    const { comp, comps } = landComponents(cells);
    const seeds = seatCells(fine, campaign.territories.map((t) => t.position));
    const owner = growRegions(map, cells, comp, seeds);
    // Land nobody's seat reaches (separate islets) becomes unowned islets.
    const T = campaign.territories.length;
    const region = new Int32Array(cells.length).fill(-1);
    const isletOf = new Map();
    cells.forEach((c, i) => {
      if (!c.land) return;
      if (owner[i] >= 0) region[i] = owner[i];
      else {
        if (!isletOf.has(comp[i])) isletOf.set(comp[i], T + isletOf.size);
        region[i] = isletOf.get(comp[i]);
      }
    });
    const regionCount = T + isletOf.size;
    const warp = fineWarp(map);
    const traced = traceRegions(map, fine, region, regionCount, warp);

    // Label anchors: the cell deepest inside each territory (and on the visible map).
    const depth = new Float64Array(cells.length).fill(Infinity);
    const q = [];
    cells.forEach((c, i) => {
      if (region[i] < 0 || region[i] >= T) return;
      if (c.labels.some((L) => L >= 0 && region[L] !== region[i])) {
        depth[i] = 0;
        q.push(i);
      }
    });
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      for (const L of cells[i].labels) {
        if (L < 0 || region[L] !== region[i]) continue;
        const d = depth[i] + dist(cells[i].p, cells[L].p);
        if (d < depth[L] - 1e-9) {
          depth[L] = d;
          q.push(L);
        }
      }
    }
    const anchor = new Array(T).fill(-1);
    const area = new Array(T).fill(0);
    cells.forEach((c, i) => {
      const R = region[i];
      if (R < 0 || R >= T) return;
      const [x, y] = c.p;
      if (x > 22 && x < map.width - 22 && y > 22 && y < map.height - 22) area[R] += c.area;
      if (x < 58 || x > map.width - 58 || y < 34 || y > map.height - 26 || !clearOfDecor(x, y, 26)) return;
      const d = Number.isFinite(depth[i]) ? depth[i] : 999;
      if (anchor[R] < 0 || d > depth[anchor[R]] + 1e-9 || (!Number.isFinite(depth[anchor[R]]) && d > 0)) anchor[R] = i;
    });

    const adjacency = Array.from({ length: T }, () => new Set());
    const borders = [];
    const coast = [];
    const shapes = campaign.territories.map((t, R) => {
      const tr = traced[R];
      for (const [o, len] of tr.border) {
        if (o < T && len >= MIN_SHARED_EDGE) {
          adjacency[R].add(o);
          adjacency[o].add(R);
        }
      }
      for (const run of tr.runs) {
        if (run.lab === -1) coast.push(run.closed ? run.pts.concat([run.pts[0]]) : run.pts);
        else if (run.lab >= 0 && run.lab < T && R < run.lab) borders.push({ a: R, b: run.lab, points: run.pts });
        else if (run.lab >= T) borders.push({ a: R, b: -1, points: run.pts });
      }
      const a = anchor[R] >= 0 ? anchor[R] : seeds[R];
      const rings = tr.rings.length ? tr.rings : [[warp(cells[seeds[R]].p[0], cells[seeds[R]].p[1])]];
      return {
        index: R,
        id: t.id,
        land: comp[seeds[R]],
        rings,
        points: rings[0],
        d: rings.map((r) => pathData(r, true)).join(''),
        centroid: warp(cells[a].p[0], cells[a].p[1]),
        area: Math.max(area[R], 600),
        coastLength: tr.coastLength,
      };
    });
    const islets = [];
    for (let R = T; R < regionCount; R++) {
      for (const run of traced[R].runs) if (run.lab === -1) coast.push(run.closed ? run.pts.concat([run.pts[0]]) : run.pts);
      for (const ring of traced[R].rings) islets.push(ring);
    }

    // Sea lanes between landmasses that hold territories.
    const geoLite = { sites: seeds.map((s) => cells[s].p) };
    const groups = new Map();
    shapes.forEach((sh, i) => {
      if (!groups.has(sh.land)) groups.set(sh.land, []);
      groups.get(sh.land).push(i);
    });
    const europe = map.kind === 'europe';
    const seaLanes = europe ? europeLanes(campaign, adjacency) : laneTree([...groups.values()], shapes, geoLite.sites, adjacency);
    const laneSet = new Set(seaLanes.map((p) => Math.min(p.a, p.b) + '|' + Math.max(p.a, p.b)));
    const { rivers, lakes } = europe ? { rivers: [], lakes: [] } : fineRivers(map, fine, region, warp);
    const prov = provinces(campaign, adjacency, shapes, map.seed);
    return {
      engine: 2,
      shapes,
      borders,
      coast,
      islets,
      adjacency,
      index: new Map(campaign.territories.map((t, i) => [t.id, i])),
      sites: geoLite.sites,
      warp,
      seaLanes,
      laneSet,
      rivers,
      lakes,
      landCount: groups.size,
      regions: prov.regions,
      regionOf: prov.regionOf,
      regionKind: prov.kind,
    };
  }

  function europeLanes(campaign, adjacency) {
    const idx = new Map(campaign.territories.map((t, i) => [t.name, i]));
    const out = [];
    for (const [a, b] of EUROPE_LANES) {
      const i = idx.get(a);
      const j = idx.get(b);
      if (i == null || j == null || adjacency[i].has(j)) continue;
      adjacency[i].add(j);
      adjacency[j].add(i);
      out.push({ a: i, b: j });
    }
    return out;
  }

  // The "states" above the territories. Real maps carry each territory's realm; generated maps
  // group neighbouring territories into named provinces of about four.
  function provinces(campaign, adjacency, shapes, seed) {
    const ts = campaign.territories;
    const T = ts.length;
    const regionOf = new Int32Array(T).fill(-1);
    const regions = [];
    const centroidOf = (members) => {
      let x = 0;
      let y = 0;
      let w = 0;
      for (const i of members) {
        const a = shapes[i].area;
        x += shapes[i].centroid[0] * a;
        y += shapes[i].centroid[1] * a;
        w += a;
      }
      return [x / w, y / w];
    };
    if (ts.some((t) => t.realm)) {
      const byName = new Map();
      ts.forEach((t, i) => {
        const name = t.realm || 'Free lands';
        if (!byName.has(name)) {
          byName.set(name, regions.length);
          regions.push({ name, members: [] });
        }
        regionOf[i] = byName.get(name);
        regions[regionOf[i]].members.push(i);
      });
      for (const r of regions) r.centroid = centroidOf(r.members);
      return { regions, regionOf, kind: 'realm' };
    }
    const rng = mulberry32(hashString('provinces:' + seed));
    const k = clamp(Math.round(T / 4), 3, 10);
    const c = (i) => shapes[i].centroid;
    const heads = [Math.floor(rng() * T)];
    while (heads.length < k) {
      let best = -1;
      let bd = -1;
      for (let i = 0; i < T; i++) {
        if (heads.includes(i)) continue;
        const d = Math.min(...heads.map((h) => dist(c(i), c(h))));
        if (d > bd) {
          bd = d;
          best = i;
        }
      }
      heads.push(best);
    }
    // Grow from the heads over borders, nearest first, so provinces stay in one piece.
    const q = heads.map((h, r) => [0, h, r]);
    heads.forEach((h, r) => (regionOf[h] = r));
    const cost = new Float64Array(T).fill(Infinity);
    heads.forEach((h) => (cost[h] = 0));
    while (q.length) {
      q.sort((a, b) => a[0] - b[0]);
      const [d0, i, r] = q.shift();
      if (d0 > cost[i]) continue;
      for (const j of adjacency[i]) {
        const d1 = d0 + dist(c(i), c(j));
        if (d1 < cost[j]) {
          cost[j] = d1;
          regionOf[j] = r;
          q.push([d1, j, r]);
        }
      }
    }
    for (let i = 0; i < T; i++) {
      if (regionOf[i] >= 0) continue;
      let best = 0;
      heads.forEach((h, r) => {
        if (dist(c(i), c(h)) < dist(c(i), c(heads[best]))) best = r;
      });
      regionOf[i] = best;
    }
    const styles = [(n) => 'Duchy of ' + n, (n) => 'Earldom of ' + n, (n) => 'March of ' + n, (n) => n + ' Riding', (n) => 'Lordship of ' + n, (n) => n + 'shire', (n) => 'Hundred of ' + n];
    heads.forEach((h, r) => {
      const members = [];
      for (let i = 0; i < T; i++) if (regionOf[i] === r) members.push(i);
      regions.push({ name: styles[Math.floor(rng() * styles.length)](ts[h].name), members, centroid: centroidOf(members) });
    });
    return { regions, regionOf, kind: 'province' };
  }

  // Minimum spanning tree of the shortest crossings between landmasses, plus one loop when there are 3+.
  function laneTree(groups, shapes, sites, adjacency) {
    const lands = groups.map((g) => g.filter((i) => shapes[i].coastLength > 10)).filter((g) => g.length);
    const lanes = [];
    if (lands.length < 2) return lanes;
    const pairs = [];
    for (let x = 0; x < lands.length; x++) {
      for (let y = x + 1; y < lands.length; y++) {
        let best = null;
        for (const i of lands[x]) for (const j of lands[y]) {
          const d = dist(sites[i], sites[j]);
          if (!best || d < best.d) best = { x, y, i, j, d };
        }
        pairs.push(best);
      }
    }
    pairs.sort((p, q) => p.d - q.d);
    const parent = lands.map((_, k) => k);
    const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    const spare = [];
    for (const p of pairs) {
      const rx = find(p.x);
      const ry = find(p.y);
      if (rx !== ry) {
        parent[rx] = ry;
        lanes.push(p);
      } else spare.push(p);
    }
    if (lands.length >= 3 && spare.length) lanes.push(spare[0]);
    for (const p of lanes) {
      adjacency[p.i].add(p.j);
      adjacency[p.j].add(p.i);
    }
    return lanes.map((p) => ({ a: p.i, b: p.j }));
  }

  /*
   * Generation for engine 2: land, seats spread over the land in proportion to
   * each landmass's size, relaxed toward even territories, then grown.
   */
  function generateMap2(seed, count, shape, gen) {
    const rng = mulberry32(hashString('mask:' + seed));
    const map = { engine: 2, width: MAP_W, height: MAP_H, seed: hashString('map:' + seed), shape, gen: normGen(gen) };
    map.mask = maskParams(rng, shape);
    if (shape === 'island' && map.mask.sats) {
      // A few satellite isles around the main island.
      const b = map.mask.blobs[0];
      for (let k = 0; k < map.mask.sats; k++) {
        const a = rng() * Math.PI * 2;
        const cx = b.cx + Math.cos(a) * b.rx * 1.18;
        const cy = b.cy + Math.sin(a) * b.ry * 1.22;
        if (cx > 60 && cx < MAP_W - 60 && cy > 60 && cy < MAP_H - 60 && clearOfDecor(cx, cy, 60)) {
          map.mask.blobs.push({ cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(40 + rng() * 45), ry: Math.round(30 + rng() * 30), amp: 0.25, harm: harmonicsFrom(rng, [2, 3]) });
        }
      }
      delete map.mask.sats;
    }
    const fine = buildFine(map);
    const { cells } = fine;
    const { comp, comps } = landComponents(cells);
    const visible = (i) => {
      const [x, y] = cells[i].p;
      return x > 62 && x < MAP_W - 62 && y > 42 && y < MAP_H - 36 && clearOfDecor(x, y, 34) && cells[i].coastDist > 12;
    };
    const visArea = (cm) => cm.members.reduce((s, m) => s + (visible(m) ? cells[m].area : 0), 0);
    const totalVis = comps.reduce((s, cm) => s + visArea(cm), 0) || 1;
    let eligible = comps.filter((cm) => visArea(cm) >= (0.35 * totalVis) / count).sort((a, b) => visArea(b) - visArea(a)).slice(0, count);
    if (!eligible.length) eligible = comps.slice().sort((a, b) => b.area - a.area).slice(0, 1);
    const eArea = eligible.reduce((s, cm) => s + visArea(cm), 0) || 1;
    const alloc = eligible.map((cm) => Math.max(1, Math.floor((count * visArea(cm)) / eArea)));
    while (alloc.reduce((s, x) => s + x, 0) < count) {
      let best = 0;
      let bestGap = -Infinity;
      eligible.forEach((cm, k) => {
        const gap = (count * visArea(cm)) / eArea - alloc[k];
        if (gap > bestGap) {
          bestGap = gap;
          best = k;
        }
      });
      alloc[best]++;
    }
    while (alloc.reduce((s, x) => s + x, 0) > count) alloc[alloc.indexOf(Math.max(...alloc))]--;
    let seeds = [];
    eligible.forEach((cm, k) => {
      const pool = cm.members.filter(visible);
      const usable = pool.length ? pool : cm.members;
      const picked = [usable[Math.floor(rng() * usable.length)]];
      while (picked.length < alloc[k] && picked.length < usable.length) {
        let best = -1;
        let bd = -1;
        for (const i of usable) {
          let d = Infinity;
          for (const s of picked) d = Math.min(d, dist(cells[i].p, cells[s].p));
          if (d > bd) {
            bd = d;
            best = i;
          }
        }
        picked.push(best);
      }
      seeds.push(...picked);
    });
    const iters = [4, 2, 0][map.gen.borders];
    for (let it = 0; it < iters; it++) {
      const owner = growRegions(map, cells, comp, seeds);
      const sx = new Array(seeds.length).fill(0);
      const sy = new Array(seeds.length).fill(0);
      const sw = new Array(seeds.length).fill(0);
      cells.forEach((c, i) => {
        const o = owner[i];
        if (o < 0 || !visible(i)) return;
        sx[o] += c.p[0] * c.area;
        sy[o] += c.p[1] * c.area;
        sw[o] += c.area;
      });
      const taken = new Set();
      seeds = seeds.map((s, t) => {
        if (!sw[t]) return s;
        const cx = sx[t] / sw[t];
        const cy = sy[t] / sw[t];
        const i = nearestCell(cells, cx, cy, (k) => owner[k] === t && visible(k) && !taken.has(k));
        const pick = i >= 0 ? i : s;
        taken.add(pick);
        return pick;
      });
    }
    return { map, fine, seeds, comp };
  }

  /* ---------- map generation ---------- */

  const NAME_PREFIX = [
    'Ash', 'Black', 'Bram', 'Cold', 'Crow', 'Dun', 'Elder', 'Grey', 'Hart', 'Iron', 'Kings',
    'Oak', 'Raven', 'Red', 'Salt', 'Stag', 'Stone', 'Thorn', 'Wolf', 'Wyrm', 'Yew', 'Winter',
    'Gall', 'Brack', 'Ember', 'Hag', 'Rook', 'Sheep', 'Whit', 'Bleak', 'Cinder', 'Hawk',
    'Gold', 'Mor', 'Wend', 'Hal', 'Skarth', 'Thurs', 'Ulf', 'Har', 'Ketil', 'Swart',
  ];
  const NAME_SUFFIX = {
    grassland: ['ford', 'stead', 'dale', 'by', 'field', 'ham', 'ley', 'thorpe'],
    forest: ['holt', 'wold', 'wood', 'hurst', 'shaw', 'grove', 'lund'],
    hills: ['barrow', 'fell', 'down', 'tor', 'ridge', 'howe', 'knoll'],
    mountains: ['crag', 'peak', 'fell', 'spire', 'pike', 'scar', 'gard'],
    marsh: ['mere', 'fen', 'moss', 'carr', 'marsh', 'slough', 'wash'],
    coast: ['haven', 'mouth', 'wick', 'strand', 'ness', 'reach', 'vik'],
  };

  function makeNames(rng, terrains) {
    const used = new Set();
    return terrains.map((terrain) => {
      for (let tries = 0; tries < 200; tries++) {
        const pre = NAME_PREFIX[Math.floor(rng() * NAME_PREFIX.length)];
        const sufs = NAME_SUFFIX[terrain];
        const suf = sufs[Math.floor(rng() * sufs.length)];
        if (pre.toLowerCase().slice(-1) === suf[0]) continue;
        const name = pre + suf;
        if (!used.has(name)) {
          used.add(name);
          return name;
        }
      }
      const fallback = 'Territory ' + (used.size + 1);
      used.add(fallback);
      return fallback;
    });
  }

  function clearOfDecor(cx, cy, r) {
    return DECOR_ZONES.every(([x0, y0, x1, y1]) => {
      const dx = Math.max(x0 - cx, 0, cx - x1);
      const dy = Math.max(y0 - cy, 0, cy - y1);
      return Math.hypot(dx, dy) > r;
    });
  }

  function dartThrow(rng, count, minD, sample) {
    const pts = [];
    let tries = 0;
    let d = minD;
    while (pts.length < count) {
      if (++tries > 3000) {
        d *= 0.9;
        tries = 0;
      }
      const p = sample();
      if (p && pts.every((q) => dist(p, q) >= d)) pts.push(p);
    }
    return pts;
  }

  function sitesInEllipse(rng, count, isl) {
    const reach = 0.82;
    const minD = Math.sqrt((Math.PI * isl.rx * isl.ry * reach * reach) / count) * 0.8;
    return dartThrow(rng, count, minD, () => {
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * reach;
      return [isl.cx + Math.cos(ang) * r * isl.rx, isl.cy + Math.sin(ang) * r * isl.ry];
    });
  }

  // 2-4 islands of different sizes, spaced so their coasts never touch.
  function layoutArchipelago(rng, count) {
    const maxN = Math.min(4, Math.floor(count / 5));
    const n = 2 + Math.floor(rng() * (maxN - 1));
    const weights = Array.from({ length: n }, () => 0.6 + rng());
    const wsum = weights.reduce((s, w) => s + w, 0);
    const counts = weights.map((w) => Math.max(4, Math.round((count * w) / wsum)));
    while (counts.reduce((s, k) => s + k, 0) > count) counts[counts.indexOf(Math.max(...counts))]--;
    while (counts.reduce((s, k) => s + k, 0) < count) counts[counts.indexOf(Math.min(...counts))]++;
    const landArea = Math.PI * 375 * 248 * 0.85; // shrunk below until the islands fit
    let scale = 1;
    for (let attempt = 0; attempt < 800; attempt++) {
      if (attempt && attempt % 40 === 0) scale *= 0.95;
      const isl = counts.map((k) => {
        const area = ((landArea * k) / count) * scale * scale;
        const aspect = 1.05 + rng() * 0.5;
        const rx = Math.sqrt((area * aspect) / Math.PI);
        return { cx: 0, cy: 0, rx: Math.round(rx), ry: Math.round(rx / aspect), k };
      });
      let ok = true;
      for (let i = 0; i < isl.length && ok; i++) {
        const s = isl[i];
        const R = Math.max(s.rx, s.ry) * 1.22 + 30;
        let placed = false;
        for (let t = 0; t < 150 && !placed; t++) {
          const mx = s.rx * 1.22 + 26;
          const my = s.ry * 1.22 + 26;
          if (MAP_W - 2 * mx <= 0 || MAP_H - 2 * my <= 0) break;
          const cx = mx + rng() * (MAP_W - 2 * mx);
          const cy = my + rng() * (MAP_H - 2 * my);
          if (!clearOfDecor(cx, cy, Math.max(s.rx, s.ry) * 1.2 + 6)) continue;
          if (isl.slice(0, i).some((o) => dist([cx, cy], [o.cx, o.cy]) < R + Math.max(o.rx, o.ry) * 1.22 + 30 + 8)) continue;
          s.cx = Math.round(cx);
          s.cy = Math.round(cy);
          placed = true;
        }
        if (!placed) ok = false;
      }
      if (ok) return isl;
    }
    // Fallback: small islands in a row.
    const r = Math.min(110, (MAP_W - 80) / (2 * n * 1.3));
    return counts.map((k, i) => ({ cx: Math.round(70 + r * 1.3 + i * ((MAP_W - 140 - 2.6 * r) / Math.max(1, n - 1))), cy: MAP_H / 2, rx: Math.round(r), ry: Math.round(r * 0.75), k }));
  }

  // A coastline across the map at a random angle, with 58-68% of the map land.
  function layoutMainland(rng) {
    const angle = rng() * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const target = 0.58 + rng() * 0.1;
    const share = (c) => {
      let land = 0;
      let total = 0;
      for (let x = 12; x < MAP_W; x += 25) {
        for (let y = 12; y < MAP_H; y += 25) {
          total++;
          if (x * nx + y * ny <= c) land++;
        }
      }
      return land / total;
    };
    let lo = -1500;
    let hi = 1500;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (share(mid) < target) lo = mid;
      else hi = mid;
    }
    return { angle: Math.round(angle * 1000) / 1000, c: Math.round((lo + hi) / 2) };
  }

  function nowMs() {
    return Date.now();
  }

  // Time, then six fixed-width random base-36 digits, then a counter: unique within this device, and two
  // devices only collide with the same millisecond and the same 1-in-2-billion draw.
  let idCount = 0;
  function newId(prefix) {
    idCount = (idCount + 1) % 1296;
    return prefix + Date.now().toString(36) + Math.floor(Math.random() * 2176782336).toString(36).padStart(6, '0') + idCount.toString(36).padStart(2, '0');
  }

  function relax(sites, map, iterations) {
    let s = sites;
    const mainland = mapShape1(map) === 'mainland';
    const cf = mainland ? coastFrame(map) : null;
    for (let it = 0; it < iterations; it++) {
      const prev = s;
      s = landCells(s, map).cells.map((c, i) => {
        let p = polygonCentroid(mainland ? clipToFrame(c.poly, map, 40) : c.poly);
        if (mainland) {
          p = [clamp(p[0], 45, map.width - 45), clamp(p[1], 45, map.height - 45)];
          const over = p[0] * cf.nx + p[1] * cf.ny - (cf.c - 40);
          if (over > 0) p = [p[0] - cf.nx * over, p[1] - cf.ny * over];
          // Land runs under the cartouche and compass here; keep territory centres out from under them.
          if (!clearOfDecor(p[0], p[1], 30)) p = prev[i];
        }
        return p;
      });
    }
    return s;
  }

  // The first release's generator, kept so its maps can still be created on request.
  function legacyNewCampaign(opts) {
    const o = opts || {};
    const seed = String(o.seed || randomSeed());
    const count = clamp(Math.round(o.count || 20), MIN_TERRITORIES, MAX_TERRITORIES);
    const now = o.now || nowMs();
    // A shape left as random comes from the seed, so a seed always means the same map.
    const shape = SHAPES1.includes(o.shape) ? o.shape : SHAPES1[Math.floor(mulberry32(hashString('shape:' + seed))() * SHAPES1.length)];
    const map = { width: MAP_W, height: MAP_H, seed: hashString('map:' + seed), shape, rx: 375, ry: 248 };
    const rng = mulberry32(hashString('sites:' + seed));
    let sites;
    if (shape === 'archipelago') {
      const islands = layoutArchipelago(rng, count);
      map.islands = islands.map(({ cx, cy, rx, ry }) => ({ cx, cy, rx, ry }));
      sites = [];
      for (const isl of islands) sites.push(...sitesInEllipse(rng, isl.k, isl));
    } else if (shape === 'mainland') {
      map.coast = layoutMainland(rng);
      const cf = coastFrame(map);
      const landShare = 0.6 * MAP_W * MAP_H;
      sites = dartThrow(rng, count, Math.sqrt(landShare / count) * 0.8, () => {
        const p = [50 + rng() * (MAP_W - 100), 50 + rng() * (MAP_H - 100)];
        return p[0] * cf.nx + p[1] * cf.ny <= cf.c - 45 && clearOfDecor(p[0], p[1], 30) ? p : null;
      });
    } else {
      sites = sitesInEllipse(rng, count, { cx: MAP_W / 2, cy: MAP_H / 2, rx: map.rx, ry: map.ry });
    }
    sites = relax(sites, map, 3);
    const { cells } = landCells(sites, map);

    const elevation = valueNoise(hashString('elev:' + seed));
    const moisture = valueNoise(hashString('wet:' + seed));
    const info = sites.map((s, i) => {
      let coastLen = 0;
      const { poly, labels } = cells[i];
      for (let k = 0; k < poly.length; k++) if (labels[k] === -1) coastLen += dist(poly[k], poly[(k + 1) % poly.length]);
      const e = elevation(s[0] / 260, s[1] / 260) + 0.5 * elevation(s[0] / 110 + 7, s[1] / 110) + inlandness(map, s[0], s[1]) * 0.9;
      return { i, coastal: coastLen > 15, e, m: moisture(s[0] / 220, s[1] / 220) };
    });
    // Rank-based terrain keeps every map varied: a few peaks, some hills, a marsh or two.
    const terrain = new Array(count).fill('grassland');
    const byElev = info.slice().sort((a, b) => b.e - a.e);
    const nMount = Math.max(2, Math.round(count * 0.15));
    const nHills = Math.max(2, Math.round(count * 0.15));
    byElev.slice(0, nMount).forEach((x) => (terrain[x.i] = 'mountains'));
    byElev.slice(nMount, nMount + nHills).forEach((x) => (terrain[x.i] = 'hills'));
    const rest = byElev.slice(nMount + nHills);
    rest.filter((x) => x.coastal).sort((a, b) => a.e - b.e).slice(0, Math.round(count * 0.22)).forEach((x) => (terrain[x.i] = 'coast'));
    const inland = rest.filter((x) => terrain[x.i] === 'grassland');
    inland.slice().sort((a, b) => a.e - a.m * 0.5 - (b.e - b.m * 0.5)).slice(0, Math.max(1, Math.round(count * 0.1))).forEach((x) => (terrain[x.i] = 'marsh'));
    const open = inland.filter((x) => terrain[x.i] === 'grassland').sort((a, b) => b.m - a.m);
    open.slice(0, Math.max(Math.round(open.length * 0.45), Math.min(2, open.length))).forEach((x) => (terrain[x.i] = 'forest'));

    const names = makeNames(rng, terrain);
    const territories = sites.map((s, i) => {
      const ts = TERRAIN_STATS[terrain[i]];
      return {
        id: 't' + (i + 1),
        name: names[i],
        position: { x: Math.round(s[0] * 10) / 10, y: Math.round(s[1] * 10) / 10 },
        goldValue: Math.round(((60 + rng() * 140) * ts.gold) / 5) * 5,
        garrisonBase: Math.round((15 + rng() * 65) * ts.garrison),
        garrison: 0,
        status: 'unclaimed',
        terrain: terrain[i],
        conquered: false,
        control: 0,
        damage: 0,
        override: null,
      };
    });

    // Home base: the westernmost coastal territory, a landing spot for raiders.
    const clearSpot = (x) => clearOfDecor(sites[x.i][0], sites[x.i][1], 45);
    const landing = info.filter((x) => x.coastal && ['coast', 'grassland', 'forest'].includes(terrain[x.i]));
    const pool = landing.filter(clearSpot).length ? landing.filter(clearSpot) : landing.length ? landing : info;
    const base = pool.reduce((best, x) => (sites[x.i][0] < sites[best.i][0] ? x : best), pool[0]);

    const c = {
      id: newId('c'),
      name: '',
      seed,
      version: 1,
      createdAt: now,
      updatedAt: now,
      year: 1,
      season: 'spring',
      goalPct: 60,
      baseTerritory: territories[base.i].id,
      start: Object.assign({}, DEFAULT_START),
      treasury: DEFAULT_START.treasury,
      army: DEFAULT_START.army,
      morale: DEFAULT_START.morale,
      map,
      territories,
      raids: [],
      adjustments: [],
      milestones: [],
    };
    c.name = o.name || campaignName(c);
    return snapshot(c);
  }

  /* ---------- settlements ---------- */

  const FEATURES = {
    harbour: { label: 'Harbour', note: 'Quays, warehouses and merchant ships at anchor.' },
    fishing: { label: 'Fishing village', note: 'Boats, nets and smoke-houses along the shingle.' },
    mine: { label: 'Mine', note: 'Silver and iron dug out of the rock.' },
    watchtower: { label: 'Watchtower', note: 'A beacon tower watching the passes.' },
    castle: { label: 'Castle', note: 'Stone walls and a standing garrison.' },
    stones: { label: 'Standing stones', note: 'An old ring of stones; few people, older gods.' },
    lodge: { label: 'Hunting lodge', note: 'A lord’s lodge deep in the woods.' },
    abbey: { label: 'Abbey', note: 'Monks, relics and silver plate.' },
    town: { label: 'Market town', note: 'Granaries, a mint and a weekly market.' },
    mill: { label: 'Mill', note: 'A water mill and the grain stores beside it.' },
    village: { label: 'Village', note: 'Farmsteads around a longhouse.' },
    fen: { label: 'Fen village', note: 'Huts on stilts above the reeds.' },
  };

  // The territory's seat, from its terrain, wealth and defences. Derived rather
  // than stored, so older saves and imports get one too.
  function territoryFeature(c, t, coastLength) {
    if (t.id === c.baseTerritory || (c.kingdoms || []).some((k) => k.capital === t.id)) return 'home';
    const h = hashString((c.seed || '') + ':' + t.id) / 4294967296;
    if (t.garrisonBase >= 85) return 'castle';
    switch (t.terrain) {
      case 'coast':
        return t.goldValue >= 160 ? 'harbour' : 'fishing';
      case 'mountains':
        return h < 0.6 ? 'mine' : 'watchtower';
      case 'hills':
        return t.garrisonBase >= 60 ? 'castle' : h < 0.45 ? 'stones' : 'mine';
      case 'forest':
        return t.goldValue >= 150 ? 'abbey' : h < 0.55 ? 'lodge' : 'village';
      case 'marsh':
        return h < 0.7 ? 'fen' : 'stones';
      default:
        if (t.goldValue >= 170) return coastLength > 15 ? 'harbour' : 'town';
        return h < 0.4 ? 'mill' : t.goldValue >= 120 && h < 0.7 ? 'abbey' : 'village';
    }
  }

  /* ---------- kingdoms ---------- */

  const MAX_KINGDOMS = 4;
  // Players are people, kingdoms are sides: extra players join a kingdom as co-rulers.
  const MAX_PLAYERS = 16;
  // Map colours for kingdoms. Validated as a set (all pairs, colour-blind
  // simulation and normal vision) on the parchment; a fifth could not pass,
  // which is why a campaign holds at most four kingdoms.
  const KINGDOM_COLORS = [
    { id: 'red', hex: '#b23a2b', label: 'Crimson' },
    { id: 'blue', hex: '#2b5fa8', label: 'Azure' },
    { id: 'gold', hex: '#b8860b', label: 'Gold' },
    { id: 'teal', hex: '#1f8a70', label: 'Sea green' },
  ];
  const TINCTURES = {
    or: { hex: '#d9a92e', label: 'Or (gold)', metal: true },
    argent: { hex: '#ece6d6', label: 'Argent (silver)', metal: true },
    gules: { hex: '#b23a2b', label: 'Gules (red)' },
    azure: { hex: '#2b5fa8', label: 'Azure (blue)' },
    vert: { hex: '#3f7a43', label: 'Vert (green)' },
    sable: { hex: '#2a2520', label: 'Sable (black)' },
    purpure: { hex: '#6d3f7a', label: 'Purpure (purple)' },
    tenne: { hex: '#b8662a', label: 'Tenné (orange)' },
  };
  const DIVISIONS = { plain: 'Plain', pale: 'Per pale', fess: 'Per fess', bend: 'Per bend', quarterly: 'Quarterly', chevron: 'Chevron', saltire: 'Saltire' };
  const CHARGES = { none: 'No charge', wolf: 'Wolf', raven: 'Raven', axe: 'Axe', ship: 'Longship', tower: 'Tower', dragon: 'Dragon', boar: 'Boar', stag: 'Stag', crown: 'Crown', sun: 'Sun', hammer: 'Hammer' };
  const RANDOM_TITLES = ['King', 'Queen', 'Jarl', 'Thane', 'Earl', 'Chieftain'];
  const TITLES = RANDOM_TITLES.concat(['Duke', 'Duchess', 'High King', 'Prince']);
  // Traits bend the placeholder rules for one kingdom.
  const TRAITS = {
    none: { label: 'No trait', note: 'Plays by the standard rules.' },
    reavers: { label: 'Reavers', note: 'Successful raids take 50% control instead of 40%.', successControl: 10 },
    merchants: { label: 'Merchant princes', note: 'Tribute from held land is 50% higher.', tributeMult: 1.5 },
    ironwall: { label: 'Iron walls', note: 'Garrisons on your land recover twice as fast, and raids on your land take 10% less control.', regenMult: 2, defendControl: 10 },
    zealots: { label: 'Zealots', note: 'Failed raids cost half the morale, and morale never falls below 30.', failureMoraleMult: 0.5, moraleFloor: 30 },
    seafarers: { label: 'Seafarers', note: 'Raids over a sea lane (Landings) need no provisions, and raids on coast take 10% more control.', seaCost: 1, coastControl: 10, freeLandings: true },
    horde: { label: 'Horde', note: 'Starts with 30 more men, and each conquest lifts morale by 15 instead of 10.', startArmy: 30, conquestMorale: 5 },
  };
  const RULERS = ['Ragnhild', 'Sigurd', 'Astrid', 'Ulf', 'Eadric', 'Godwin', 'Thyra', 'Ivar', 'Hilda', 'Bjorn', 'Aelfgifu', 'Halfdan', 'Gunnhild', 'Osric', 'Sweyn', 'Brynja', 'Ketil', 'Freydis', 'Wulfstan', 'Sigrid', 'Orm', 'Edith', 'Harald', 'Ingrid'];
  const EPITHETS = ['the Bold', 'Ironside', 'the Grim', 'Bloodaxe', 'the Wise', 'Fairhair', 'Forkbeard', 'Longspear', 'Ravenfeeder', 'the Cruel', 'the Unbowed', 'Sea-wolf', 'the Red', 'Oathkeeper', 'the Old', 'Ash-hand'];
  const MOTTOS = ['Fire before mercy', 'The sea provides', 'We take what is ours', 'Iron and salt', 'No shore is far', 'Burn bright, burn brief', 'Hold the line', 'Gold for the brave', 'The wolf does not ask', 'Ever onward', 'Ash follows us', 'By oar and axe'];

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }

  function randomArms(rng) {
    const metals = ['or', 'argent'];
    const colours = ['gules', 'azure', 'vert', 'sable', 'purpure', 'tenne'];
    const metalField = rng() < 0.4;
    const field = metalField ? pick(rng, metals) : pick(rng, colours);
    const division = pick(rng, Object.keys(DIVISIONS));
    let second = metalField ? pick(rng, colours) : pick(rng, metals);
    // Rule of tincture: a charge contrasts with the field (metal on colour, colour on metal).
    const charge = pick(rng, Object.keys(CHARGES).filter((k) => k !== 'none'));
    const chargeColor = division === 'plain' ? second : metalField ? 'sable' : pick(rng, metals);
    if (division === 'plain') second = field;
    return { division, field, second, charge, chargeColor };
  }

  function realmName(rng, capitalName) {
    const stem = pick(rng, NAME_PREFIX);
    const patterns = [stem + 'mark', stem + 'heim', stem + 'gard', 'Kingdom of ' + capitalName, 'Jarldom of ' + capitalName, 'Realm of ' + capitalName];
    return pick(rng, patterns);
  }

  function randomKingdom(rng, index, capital, capitalName, opts) {
    const o = opts || {};
    const title = pick(rng, RANDOM_TITLES);
    return {
      id: o.id || 'k' + (index + 1),
      name: realmName(rng, capitalName || 'the North'),
      ruler: { title, name: pick(rng, RULERS) + ' ' + pick(rng, EPITHETS) },
      motto: pick(rng, MOTTOS),
      color: KINGDOM_COLORS[index % KINGDOM_COLORS.length].id,
      arms: randomArms(rng),
      trait: index === 0 && o.plainFirst ? 'none' : pick(rng, Object.keys(TRAITS)),
      faction: FACTION_IDS[hashString(String(capitalName || index)) % FACTION_IDS.length],
      capital,
      start: Object.assign({}, DEFAULT_START),
      updatedAt: o.now || 0,
    };
  }

  /* ---------- players ---------- */

  // A player is a person at the table (a name) or a claude.ai account (userId), playing for one kingdom.
  function newPlayer(name, kingdom, opts) {
    const o = opts || {};
    return { id: o.id || newId('p'), name: String(name || '').trim().slice(0, 30), kingdom, userId: o.userId || null, updatedAt: o.now || nowMs() };
  }

  function playersOf(c, kid) {
    return (c.players || []).filter((p) => p.kingdom === kid);
  }

  // Shared campaigns: a kingdom with linked accounts can only be played by those accounts;
  // one without is open. At one screen (no uid) every kingdom is playable.
  function kingdomPlayable(c, kid, uid) {
    if (!uid) return true;
    const linked = playersOf(c, kid).filter((p) => p.userId);
    return !linked.length || linked.some((p) => p.userId === uid);
  }

  // Spread names over the kingdoms in turn: four kingdoms and six players gives two teams of two.
  function assignPlayers(c, names, now) {
    const list = (names || []).map((n) => String(n || '').trim()).filter(Boolean).slice(0, MAX_PLAYERS);
    return list.map((name, i) => newPlayer(name, c.kingdoms[i % c.kingdoms.length].id, { id: 'p' + (i + 1), now: now || 0 }));
  }

  function kingdomColor(k) {
    return (KINGDOM_COLORS.find((c) => c.id === k.color) || KINGDOM_COLORS[0]).hex;
  }

  // Capitals spread out: the first on a western landing beach, the rest as far
  // (by route) from the others as possible, preferring coasts.
  function chooseCapitals(c, geo, n) {
    const T = c.territories;
    const landing = (i) => ['coast', 'grassland', 'forest'].includes(T[i].terrain) && geo.shapes[i].coastLength > 15;
    const clear = (i) => {
      const [x, y] = geo.shapes[i].centroid;
      return x > 70 && x < MAP_W - 70 && y > 50 && y < MAP_H - 40 && clearOfDecor(x, y, 45);
    };
    let pool = T.map((t, i) => i).filter((i) => landing(i) && clear(i));
    if (!pool.length) pool = T.map((t, i) => i).filter(clear);
    if (!pool.length) pool = T.map((t, i) => i);
    const caps = [pool.reduce((best, i) => (geo.shapes[i].centroid[0] < geo.shapes[best].centroid[0] ? i : best), pool[0])];
    const hops = (a) => {
      const d = new Array(T.length).fill(Infinity);
      d[a] = 0;
      const q = [a];
      for (let qi = 0; qi < q.length; qi++) for (const v of geo.adjacency[q[qi]]) if (d[v] === Infinity) {
        d[v] = d[q[qi]] + 1;
        q.push(v);
      }
      return d;
    };
    while (caps.length < n) {
      const ds = caps.map(hops);
      const score = (i) => Math.min(...ds.map((d) => (Number.isFinite(d[i]) ? d[i] : 99))) * 1000 + Math.min(...caps.map((k) => dist(geo.sites[i], geo.sites[k]))) + (landing(i) ? 500 : 0);
      const cand = T.map((t, i) => i).filter((i) => !caps.includes(i) && clear(i));
      const options = cand.length ? cand : T.map((t, i) => i).filter((i) => !caps.includes(i));
      if (!options.length) break;
      caps.push(options.reduce((best, i) => (score(i) > score(best) ? i : best), options[0]));
    }
    return caps.map((i) => T[i].id);
  }

  /* ---------- campaign creation ---------- */

  function assignTerrain(count, info, gen) {
    const g = normGen(gen);
    const mult = [0.5, 1, 1.7];
    const terrain = new Array(count).fill('grassland');
    const byElev = info.slice().sort((a, b) => b.e - a.e);
    const nMount = Math.max(1, Math.round(count * 0.15 * mult[g.mountains]));
    const nHills = Math.max(1, Math.round(count * 0.15 * mult[g.mountains]));
    byElev.slice(0, nMount).forEach((x) => (terrain[x.i] = 'mountains'));
    byElev.slice(nMount, nMount + nHills).forEach((x) => (terrain[x.i] = 'hills'));
    const rest = byElev.slice(nMount + nHills);
    rest.filter((x) => x.coastal).sort((a, b) => a.e - b.e).slice(0, Math.round(count * 0.22)).forEach((x) => (terrain[x.i] = 'coast'));
    const inland = rest.filter((x) => terrain[x.i] === 'grassland');
    inland.slice().sort((a, b) => a.e - a.m * 0.5 - (b.e - b.m * 0.5)).slice(0, Math.max(g.wetlands ? 1 : 0, Math.round(count * 0.1 * mult[g.wetlands]))).forEach((x) => (terrain[x.i] = 'marsh'));
    const open = inland.filter((x) => terrain[x.i] === 'grassland').sort((a, b) => b.m - a.m);
    const share = [0.25, 0.45, 0.7][g.forests];
    open.slice(0, Math.max(Math.round(open.length * share), Math.min(g.forests ? 2 : 1, open.length))).forEach((x) => (terrain[x.i] = 'forest'));
    return terrain;
  }

  function newCampaign(opts) {
    const o = opts || {};
    const seed = String(o.seed || randomSeed());
    const count = clamp(Math.round(o.count || 20), MIN_TERRITORIES, MAX_TERRITORIES);
    const now = o.now || nowMs();
    const nK = clamp(Math.round(o.kingdoms || 1), 1, MAX_KINGDOMS);
    if (o.engine === 1) return upgradeCampaign(legacyNewCampaign(Object.assign({}, o, { seed, count, now })), now, nK);
    if (o.world === 'europe') return europeCampaign(o, seed, now, nK);
    const shape = SHAPES.includes(o.shape) ? o.shape : SHAPES[Math.floor(mulberry32(hashString('shape:' + seed))() * SHAPES.length)];
    const gen = normGen(o.gen);
    const { map, fine, seeds, comp } = generateMap2(seed, count, shape, gen);
    const rng = mulberry32(hashString('sites:' + seed));
    const owner = growRegions(map, fine.cells, comp, seeds);
    const acc = seeds.map(() => ({ e: 0, m: 0, w: 0, coast: false }));
    fine.cells.forEach((c, i) => {
      const t = owner[i];
      if (t < 0) return;
      acc[t].e += c.elev * c.area;
      acc[t].m += c.moist * c.area;
      acc[t].w += c.area;
      if (!acc[t].coast && c.labels.some((L) => L >= 0 && !fine.cells[L].land)) acc[t].coast = true;
    });
    const info = acc.map((a, i) => ({ i, e: a.w ? a.e / a.w : 0, m: a.w ? a.m / a.w : 0, coastal: a.coast }));
    const terrain = assignTerrain(seeds.length, info, gen);
    const names = makeNames(rng, terrain);
    const wealth = [0.65, 1, 1.45][gen.wealth];
    const defences = [0.65, 1, 1.45][gen.defences];
    const territories = seeds.map((s, i) => {
      const ts = TERRAIN_STATS[terrain[i]];
      const p = fine.cells[s].p;
      return {
        id: 't' + (i + 1),
        name: names[i],
        position: { x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10 },
        goldValue: Math.max(10, Math.round(((60 + rng() * 140) * ts.gold * wealth) / 5) * 5),
        garrisonBase: Math.max(5, Math.round((15 + rng() * 65) * ts.garrison * defences)),
        garrison: 0,
        status: 'unclaimed',
        terrain: terrain[i],
        conquered: false,
        control: 0,
        damage: 0,
        override: null,
        overrideBy: null,
        editedAt: 0,
      };
    });
    const c = {
      id: newId('c'),
      name: '',
      seed,
      version: 3,
      createdAt: now,
      updatedAt: now,
      year: 1,
      season: 'spring',
      seasonAt: 0,
      goalPct: 60,
      settingsAt: 0,
      map,
      territories,
      kingdoms: [],
      players: [],
      raids: [],
      adjustments: [],
      milestones: [],
      deleted: [],
    };
    const geo = buildGeometry2(c);
    const caps = chooseCapitals(c, geo, nK);
    const krng = mulberry32(hashString('kingdoms:' + seed));
    c.kingdoms = caps.map((cap, i) => randomKingdom(krng, i, cap, territories.find((t) => t.id === cap).name, { plainFirst: nK === 1, now: 0 }));
    if (Array.isArray(o.kingdomSpecs)) o.kingdomSpecs.forEach((spec, i) => c.kingdoms[i] && Object.assign(c.kingdoms[i], spec));
    c.players = assignPlayers(c, o.players, 0);
    c.name = o.name || campaignName(c);
    return snapshot(c);
  }

  // Older single-player campaigns: the home base becomes the capital of one kingdom.
  function upgradeCampaign(c, now, nK) {
    if (Array.isArray(c.kingdoms) && c.kingdoms.length) return c;
    const krng = mulberry32(hashString('kingdoms:' + c.seed));
    const base = c.baseTerritory;
    const baseName = (c.territories.find((t) => t.id === base) || c.territories[0]).name;
    const k = randomKingdom(krng, 0, base, baseName, { plainFirst: true, now: 0 });
    k.name = 'Your kingdom';
    k.start = Object.assign({}, c.start || DEFAULT_START);
    c.kingdoms = [k];
    if (nK > 1) {
      const geo = buildGeometry(c);
      const caps = chooseCapitals(Object.assign({}, c), geo, nK).filter((id) => id !== base);
      caps.slice(0, nK - 1).forEach((cap, i) => c.kingdoms.push(randomKingdom(krng, i + 1, cap, c.territories.find((t) => t.id === cap).name, { now: 0 })));
    }
    for (const r of c.raids || []) if (!r.by) r.by = k.id;
    for (const a of c.adjustments || []) if (!a.kingdom) a.kingdom = k.id;
    delete c.baseTerritory;
    delete c.start;
    c.version = 3;
    c.players = c.players || [];
    c.deleted = c.deleted || [];
    c.seasonAt = c.seasonAt || 0;
    c.settingsAt = c.settingsAt || 0;
    return snapshot(c);
  }

  // "The Ravenmere Raids", "The Harrying of Ketilvik"... named after the richest prize.
  function campaignName(c) {
    const rng = mulberry32(hashString('name:' + c.seed));
    const caps = new Set((c.kingdoms || []).map((k) => k.capital).concat(c.baseTerritory ? [c.baseTerritory] : []));
    const prize = c.territories.filter((t) => !caps.has(t.id)).sort((a, b) => b.goldValue - a.goldValue)[0] || c.territories[0];
    const patterns = [(n) => 'The ' + n + ' Raids', (n) => 'The Harrying of ' + n, (n) => 'The Saga of ' + n, (n) => 'The ' + n + ' War', (n) => 'Fire over ' + n];
    return patterns[Math.floor(rng() * patterns.length)](prize.name);
  }

  /* ---------- seasons ---------- */

  function seasonIndex(year, season) {
    const y = Math.max(1, Math.floor(Number(year) || 1));
    const s = Math.max(0, SEASONS.indexOf(season));
    return (y - 1) * 4 + s;
  }

  function seasonFromIndex(i) {
    const k = Math.max(0, Math.floor(i));
    return { year: Math.floor(k / 4) + 1, season: SEASONS[k % 4] };
  }

  function seasonLabel(year, season) {
    return 'Year ' + year + ', ' + season.charAt(0).toUpperCase() + season.slice(1);
  }

  /* ---------- rules ---------- */

  function holderOf(t) {
    for (const k in t.inf) if (t.inf[k] >= 100) return k;
    return null;
  }

  // Influence: each kingdom's share of control. Gaining pushes the others out.
  function addInfluence(t, kid, gain) {
    let next = Math.min(100, (t.inf[kid] || 0) + gain);
    let others = 0;
    for (const k in t.inf) if (k !== kid) others += t.inf[k];
    const over = next + others - 100;
    if (over > 0 && others > 0) {
      const f = Math.max(0, (others - over) / others);
      for (const k in t.inf) {
        if (k === kid) continue;
        t.inf[k] = Math.round(t.inf[k] * f);
        if (t.inf[k] <= 0) delete t.inf[k];
      }
    }
    let sum = next;
    for (const k in t.inf) if (k !== kid) sum += t.inf[k];
    if (sum > 100) next -= sum - 100;
    if (next > 0) t.inf[kid] = next;
    else delete t.inf[kid];
  }

  function replay(c, startOverride) {
    const R = RULES;
    const nowIdx = seasonIndex(c.year, c.season);
    const kings = c.kingdoms && c.kingdoms.length ? c.kingdoms : [{ id: 'k1', name: 'Your kingdom', capital: c.baseTerritory || c.territories[0].id, start: c.start || DEFAULT_START, trait: 'none' }];
    const first = kings[0];
    const multi = kings.length > 1;
    const capOf = new Map(kings.map((k) => [k.capital, k.id]));
    const kname = new Map(kings.map((k) => [k.id, k.name]));
    const pre = (kid) => (multi ? kname.get(kid) + ': ' : '');
    const byId = new Map();
    for (const t of c.territories) {
      const cap = capOf.get(t.id) || null;
      byId.set(t.id, {
        id: t.id,
        name: t.name,
        goldValue: t.goldValue,
        garrisonBase: t.garrisonBase,
        terrain: t.terrain,
        capitalOf: cap,
        isCapital: !!cap,
        isBase: cap === first.id,
        inf: cap ? { [cap]: 100 } : {},
        garrison: t.garrisonBase,
        damage: 0,
        lastOutcome: null,
        lastBy: null,
        ongoing: 0,
        raids: 0,
        wins: 0,
        fails: 0,
        loot: 0,
        losses: 0,
        status: cap ? 'conquered' : 'unclaimed',
        owner: cap,
        control: cap ? 100 : 0,
      });
    }
    const totalTargets = Math.max(1, c.territories.length - 1);
    const treasuryMarks = [1000, 2500, 5000, 10000];
    const ks = new Map(
      kings.map((k, i) => {
        const st = startOverride && i === 0 ? startOverride : k.start || DEFAULT_START;
        const tr = TRAITS[k.trait] || TRAITS.none;
        const treasury = Number(st.treasury) || 0;
        let mark = treasuryMarks.findIndex((m) => m > treasury);
        if (mark === -1) mark = treasuryMarks.length;
        return [k.id, { id: k.id, tr, treasury, army: Math.max(0, (Number(st.army) || 0) + (tr.startArmy || 0)), morale: clamp(Number(st.morale) || 0, tr.moraleFloor || 0, 100), inField: 0, firstBlood: false, firstConquest: false, reached: new Set(), lowMorale: false, mark, won: false }];
      })
    );
    const auto = [];
    let clock = 0;
    let winner = null;
    function mark(si, kid, kind, label, territory, raidId) {
      const s = seasonFromIndex(si);
      auto.push({ id: 'auto-' + auto.length, auto: true, kind, label, kingdom: kid, year: s.year, season: s.season, idx: si, timestamp: clock, territory: territory || null, raid: raidId || null });
    }
    const moraleAdd = (k, d) => (k.morale = clamp(k.morale + d, k.tr.moraleFloor || 0, 100));
    function conqueredBy(kid) {
      let n = 0;
      for (const t of byId.values()) if (t.capitalOf !== kid && holderOf(t) === kid) n++;
      return n;
    }
    function checkProgress(si) {
      for (const k of ks.values()) {
        const pct = (conqueredBy(k.id) / totalTargets) * 100;
        for (const p of [25, 50, 75]) {
          if (pct >= p && !k.reached.has(p)) {
            k.reached.add(p);
            mark(si, k.id, 'empire', pre(k.id) + p + '% of the realm conquered');
          }
        }
        if (c.goalPct && pct >= c.goalPct && !k.reached.has('goal')) {
          k.reached.add('goal');
          if (!winner) winner = k.id;
          mark(si, k.id, 'empire', multi ? kname.get(k.id) + (winner === k.id ? ' wins the war: ' : ' also reaches the goal: ') + c.goalPct + '% conquered' : 'Goal reached: ' + c.goalPct + '% conquered');
        }
        while (k.mark < treasuryMarks.length && k.treasury >= treasuryMarks[k.mark]) {
          mark(si, k.id, 'empire', pre(k.id) + 'Treasury passes ' + treasuryMarks[k.mark].toLocaleString('en-GB') + ' gold');
          k.mark++;
        }
        if (k.morale <= 15 && !k.lowMorale) {
          k.lowMorale = true;
          mark(si, k.id, 'defeat', pre(k.id) + 'Morale collapses');
        } else if (k.morale > 30) k.lowMorale = false;
      }
    }
    function applyRaid(r, si) {
      const t = byId.get(r.targetTerritory);
      const att = ks.get(r.by) || ks.get(first.id);
      if (!t || t.capitalOf === att.id) return;
      const A = att.id;
      t.raids++;
      att.treasury -= Math.max(0, r.cost || 0);
      if (r.outcome === 'ongoing') {
        t.ongoing++;
        att.inField += Math.max(0, r.warband || 0);
        return;
      }
      const losses = Math.max(0, r.losses || 0);
      const loot = Math.max(0, r.lootGained || 0);
      const armyBefore = att.army;
      att.army = Math.max(0, att.army - losses);
      att.treasury += loot;
      t.loot += loot;
      t.losses += losses;
      const before = holderOf(t);
      if (r.outcome === 'success') {
        t.wins++;
        moraleAdd(att, R.moraleSuccess);
        t.garrison = Math.round(t.garrison * R.successGarrisonMult);
        let gain = R.successControl + (att.tr.successControl || 0) + (t.terrain === 'coast' ? att.tr.coastControl || 0 : 0);
        let defender = null;
        for (const k in t.inf) if (k !== A && (!defender || t.inf[k] > t.inf[defender])) defender = k;
        if (defender && ks.get(defender)) gain -= ks.get(defender).tr.defendControl || 0;
        addInfluence(t, A, Math.max(5, gain));
        if (!att.firstBlood) {
          att.firstBlood = true;
          mark(si, A, 'victory', pre(A) + 'First blood at ' + t.name, t.id, r.id);
        }
        const after = holderOf(t);
        if (before && before !== A && after !== before && ks.get(before)) {
          moraleAdd(ks.get(before), -8);
          mark(si, before, 'defeat', (t.capitalOf === before ? kname.get(before) + '’s capital, ' + t.name + ', is breached' : pre(before) + t.name + ' slips from your grip'), t.id, r.id);
        }
        if (after === A && before !== A) {
          t.garrison = 0;
          moraleAdd(att, R.moraleConquest + (att.tr.conquestMorale || 0));
          const label = t.capitalOf && t.capitalOf !== A ? kname.get(t.capitalOf) + '’s capital, ' + t.name + ', falls to ' + kname.get(A) : pre(A) + (att.firstConquest ? '' : 'First conquest: ') + t.name + ' falls';
          mark(si, A, 'victory', label, t.id, r.id);
          att.firstConquest = true;
        }
      } else if (r.outcome === 'failure') {
        t.fails++;
        moraleAdd(att, R.moraleFailure * (att.tr.failureMoraleMult || 1));
        if (t.inf[A]) {
          t.inf[A] = Math.max(0, t.inf[A] + R.failureControl);
          if (!t.inf[A]) delete t.inf[A];
        }
        t.damage = Math.min(R.damageMax, t.damage + R.damagePerFailure);
        const cap = Math.round(t.garrisonBase * R.garrisonCapMult);
        t.garrison = Math.min(cap, Math.max(t.garrison, Math.round(t.garrison * R.failureGarrisonMult) + 1));
        if (losses >= Math.max(R.heavyDefeatMin, armyBefore * R.heavyDefeatShare)) {
          mark(si, A, 'defeat', pre(A) + 'Heavy defeat at ' + t.name + ' (' + losses + ' fell)', t.id, r.id);
        }
      }
      t.lastOutcome = r.outcome;
      t.lastBy = A;
    }
    function applyAdjustment(a) {
      const k = ks.get(a.kingdom) || ks.get(first.id);
      k.treasury += Number(a.treasury) || 0;
      k.army = Math.max(0, k.army + (Number(a.army) || 0));
      moraleAdd(k, Number(a.morale) || 0);
    }
    function endSeason() {
      for (const t of byId.values()) {
        for (const kid in t.inf) {
          const k = ks.get(kid);
          if (!k) continue;
          const tm = k.tr.tributeMult || 1;
          const v = t.inf[kid];
          k.treasury += v >= 100 ? Math.round(t.goldValue * R.tributeRate * tm) : Math.round(t.goldValue * R.tributeRate * R.claimedTributeFactor * (v / 100) * tm);
        }
        if (t.garrison < t.garrisonBase) {
          const h = holderOf(t);
          const mult = h && ks.get(h) ? ks.get(h).tr.regenMult || 1 : 1;
          t.garrison = Math.min(t.garrisonBase, t.garrison + Math.max(1, Math.round(t.garrisonBase * R.regenPerSeason * mult)));
        }
        t.damage = Math.max(0, t.damage - R.damageHealPerSeason);
      }
    }
    const events = [];
    for (const r of c.raids || []) events.push({ idx: clamp(seasonIndex(r.year, r.season), 0, nowIdx), ts: r.timestamp || 0, raid: r });
    for (const a of c.adjustments || []) events.push({ idx: clamp(seasonIndex(a.year, a.season), 0, nowIdx), ts: a.timestamp || 0, adjust: a });
    events.sort((x, y) => x.idx - y.idx || x.ts - y.ts);
    let e = 0;
    for (let si = 0; si <= nowIdx; si++) {
      while (e < events.length && events[e].idx === si) {
        clock = events[e].ts;
        if (events[e].raid) applyRaid(events[e].raid, si);
        else applyAdjustment(events[e].adjust);
        checkProgress(si);
        e++;
      }
      if (si < nowIdx) {
        endSeason();
        checkProgress(si);
      }
    }

    const counts = new Map(kings.map((k) => [k.id, { conquered: 0, claimed: 0, contested: 0, held: 0 }]));
    for (const src of c.territories) {
      const t = byId.get(src.id);
      const holders = Object.keys(t.inf).filter((k) => t.inf[k] > 0);
      const h = holderOf(t);
      const top = holders.sort((a, b) => t.inf[b] - t.inf[a])[0] || null;
      if (src.override && STATUSES.includes(src.override)) {
        t.status = src.override;
        t.owner = src.override === 'unclaimed' ? null : src.overrideBy && ks.has(src.overrideBy) ? src.overrideBy : h || top || first.id;
        t.control = t.status === 'conquered' ? 100 : t.owner ? t.inf[t.owner] || 0 : 0;
      } else if (h) {
        t.status = 'conquered';
        t.owner = h;
        t.control = 100;
      } else if (t.ongoing > 0 || holders.length >= 2 || (holders.length === 1 && t.lastOutcome === 'failure' && t.lastBy === holders[0])) {
        t.status = 'contested';
        t.owner = top;
        t.control = top ? t.inf[top] : 0;
      } else if (holders.length === 1) {
        t.status = 'claimed';
        t.owner = top;
        t.control = t.inf[top];
      } else {
        t.status = 'unclaimed';
        t.owner = null;
        t.control = 0;
      }
      for (const [kid, n] of counts) {
        const mine = t.owner === kid;
        if (t.status === 'conquered' && mine && t.capitalOf !== kid) n.conquered++;
        else if (t.status === 'claimed' && mine) n.claimed++;
        else if (t.status === 'contested' && (mine || (t.inf[kid] || 0) > 0)) n.contested++;
        if ((t.inf[kid] || 0) > 0 || (mine && t.status !== 'unclaimed')) n.held++;
      }
    }
    const kingdoms = new Map();
    for (const k of kings) {
      const s = ks.get(k.id);
      const n = counts.get(k.id);
      kingdoms.set(k.id, { id: k.id, treasury: s.treasury, army: s.army, inField: Math.min(s.inField, s.army), morale: s.morale, conquered: n.conquered, claimed: n.claimed, contested: n.contested, alive: n.held > 0, capitalHeld: byId.get(k.capital) ? byId.get(k.capital).owner === k.id : false, totalTargets, progressPct: (n.conquered / totalTargets) * 100 });
    }
    const custom = (c.milestones || []).map((m) => Object.assign({}, m, { auto: false, idx: seasonIndex(m.year, m.season) }));
    const milestones = auto.concat(custom).sort((a, b) => a.idx - b.idx || (a.timestamp || 0) - (b.timestamp || 0));
    const f = kingdoms.get(first.id);
    return {
      territories: byId,
      kingdoms,
      winner,
      milestones,
      nowIdx,
      treasury: f.treasury,
      army: f.army,
      inField: f.inField,
      morale: f.morale,
      conquered: f.conquered,
      claimed: f.claimed,
      contested: f.contested,
      totalTargets,
      progressPct: f.progressPct,
    };
  }

  // Writes the derived state back onto the campaign so saved and exported JSON
  // reads correctly on its own (status, owner, garrison, each kingdom's treasury...).
  function snapshot(c, result) {
    const res = result || replay(c);
    for (const t of c.territories) {
      const d = res.territories.get(t.id);
      t.garrison = d.garrison;
      t.control = d.control;
      t.damage = d.damage;
      t.status = d.status;
      t.owner = d.owner;
      t.influence = Object.assign({}, d.inf);
      t.conquered = d.status === 'conquered';
    }
    for (const k of c.kingdoms || []) {
      const s = res.kingdoms.get(k.id);
      if (!s) continue;
      k.treasury = s.treasury;
      k.army = s.army;
      k.morale = s.morale;
    }
    c.treasury = res.treasury;
    c.army = res.army;
    c.morale = res.morale;
    return c;
  }

  function raidOdds(warband, garrison, terrain) {
    const def = garrison * (TERRAIN_STATS[terrain] || TERRAIN_STATS.grassland).defense;
    if (def <= 0) return { ratio: Infinity, label: 'Undefended' };
    const ratio = (Number(warband) || 0) / def;
    let label = 'Grim';
    if (ratio >= 1.5) label = 'Favourable';
    else if (ratio >= 0.9) label = 'Even';
    else if (ratio >= 0.5) label = 'Risky';
    return { ratio, label };
  }

  // Unique across devices, so two players logging at once never collide.
  function nextRaidId() {
    return newId('r');
  }

  function kingdomOf(c, kid) {
    return (c.kingdoms || []).find((k) => k.id === kid) || (c.kingdoms || [])[0];
  }

  // Territories a kingdom's raids may start from (besides its capital): anything it holds a share of.
  function raidSources(c, result, kid) {
    const k = kingdomOf(c, kid);
    const out = [];
    for (const t of c.territories) {
      if (t.id === k.capital) continue;
      const d = result.territories.get(t.id);
      if ((d.inf[k.id] || 0) > 0) out.push(t.id);
    }
    return out;
  }

  // What a kingdom may raid. Campaign rule: only land bordering land it holds (it is the
  // territory's holder), across a shared border or a sea lane (a raid from the sea is Pillage's
  // Landing scenario), plus land where it already has a foothold. Never its own capital or land it
  // has fully conquered.
  function frontier(c, geo, result, kid) {
    const k = kingdomOf(c, kid);
    const out = new Set();
    const open = (n) => {
      const dn = result.territories.get(n.id);
      return n.id !== k.capital && !(dn.status === 'conquered' && dn.owner === k.id);
    };
    c.territories.forEach((t, i) => {
      const d = result.territories.get(t.id);
      if ((d.inf[k.id] || 0) > 0 && open(t)) out.add(t.id);
      if (d.owner !== k.id) return;
      for (const j of geo.adjacency[i]) if (open(c.territories[j])) out.add(c.territories[j].id);
    });
    return out;
  }

  function canRaid(c, geo, result, kid, target) {
    return frontier(c, geo, result, kid).has(target);
  }

  // Where a raid on target can set out from: land the kingdom holds that borders it ('base' is the
  // capital). A foothold with no held neighbour is raided from the capital.
  function sourcesFor(c, geo, result, kid, target) {
    const k = kingdomOf(c, kid);
    const ti = geo.index.get(target);
    if (ti == null) return ['base'];
    const out = [];
    for (const j of geo.adjacency[ti]) {
      const n = c.territories[j];
      if (result.territories.get(n.id).owner !== k.id) continue;
      out.push(n.id === k.capital ? 'base' : n.id);
    }
    out.sort((a, b) => (a === 'base' ? -1 : b === 'base' ? 1 : 0));
    return out.length ? out : ['base'];
  }

  function crossesSea(geo, a, b) {
    const i = geo.index.get(a);
    const j = geo.index.get(b);
    return i != null && j != null && geo.laneSet.has(Math.min(i, j) + '|' + Math.max(i, j));
  }

  // The scenario a raid most likely is: over a sea lane, a Landing; on land another kingdom holds
  // a share of, or a capital, a Pitched Battle; otherwise Pillage!.
  function suggestScenario(c, geo, result, kid, source, target) {
    const k = kingdomOf(c, kid);
    const from = source === 'base' ? k.capital : source;
    if (crossesSea(geo, from, target)) return 'landing';
    const d = result.territories.get(target);
    const t = c.territories.find((x) => x.id === target);
    const rival = d && Object.keys(d.inf).some((o) => o !== k.id && d.inf[o] > 0);
    if (rival || (d && d.owner && d.owner !== k.id) || (t && (c.kingdoms || []).some((o) => o.capital === t.id))) return 'pitched';
    return 'pillage';
  }

  /* ---------- troops and costs ---------- */

  function factionOf(k) {
    return FACTIONS[k && k.faction] || FACTIONS.vikings;
  }

  // A kingdom's troop list with this campaign's prices.
  function troopList(c, kid) {
    const k = kingdomOf(c, kid);
    const fid = FACTIONS[k.faction] ? k.faction : 'vikings';
    const own = (c.costs && c.costs[fid]) || {};
    return FACTIONS[fid].troops.map((t) => Object.assign({}, t, { gp: Number.isFinite(own[t.id]) ? own[t.id] : t.gp, custom: Number.isFinite(own[t.id]) && own[t.id] !== t.gp }));
  }

  function normTroops(troops) {
    if (!troops || typeof troops !== 'object') return null;
    const out = {};
    for (const [id, n] of Object.entries(troops)) {
      const v = Math.max(0, Math.min(999, Math.round(Number(n) || 0)));
      if (/^[a-z]{1,16}$/.test(id) && v) out[id] = v;
    }
    return Object.keys(out).length ? out : null;
  }

  function normCosts(costs) {
    const out = {};
    if (!costs || typeof costs !== 'object') return out;
    for (const fid of FACTION_IDS) {
      const src = costs[fid];
      if (!src || typeof src !== 'object') continue;
      for (const t of FACTIONS[fid].troops) {
        const v = Number(src[t.id]);
        if (Number.isFinite(v) && v >= 0) (out[fid] = out[fid] || {})[t.id] = Math.min(9999, Math.round(v));
      }
    }
    return out;
  }

  // What a warband is worth in gp (its points value for the tabletop game), what feeding it costs
  // the treasury, and how strong it counts for the odds.
  function warbandCost(c, kid, troops) {
    const list = troopList(c, kid);
    const t = normTroops(troops) || {};
    let men = 0;
    let value = 0;
    const lines = [];
    for (const u of list) {
      const n = t[u.id] || 0;
      if (!n) continue;
      men += n;
      value += n * u.gp;
      lines.push({ id: u.id, label: u.label, n, gp: u.gp, total: n * u.gp });
    }
    const provisions = Math.round((value * RULES.provisionPct) / 100);
    return { men, value, provisions, strength: value / RULES.gpPerMan, lines };
  }

  function plural(label) {
    if (/(s|\u00ed)$/.test(label)) return label;
    if (/man$/.test(label)) return label.slice(0, -3) + 'men';
    if (/[^aeiou]y$/.test(label)) return label.slice(0, -1) + 'ies';
    return label + 's';
  }

  // "1 Jarl, 4 Hirdmen, 10 Bondi warriors" for a stored raid.
  function troopSummary(c, kid, troops) {
    const t = troops || {};
    return troopList(c, kid)
      .filter((u) => t[u.id])
      .map((u) => t[u.id] + ' ' + (t[u.id] > 1 ? plural(u.label) : u.label))
      .join(', ');
  }

  /* ---------- multiplayer sync ---------- */

  /*
   * Merges two copies of one campaign (this device's and the saved one) without
   * losing anyone's moves: raids, adjustments and milestones are unioned by id
   * (newer edit wins, deletions are remembered), and each setting group keeps
   * whichever side changed it last.
   */
  function mergeCampaigns(a, b) {
    if (!b) return a;
    if (!a) return b;
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const out = clone(a);
    const deleted = new Set([...(a.deleted || []), ...(b.deleted || [])]);
    const stamp = (x) => x.updatedAt || x.timestamp || 0;
    const mergeList = (la, lb) => {
      const m = new Map();
      for (const x of la || []) m.set(x.id, x);
      for (const y of lb || []) {
        const x = m.get(y.id);
        if (!x || stamp(y) > stamp(x)) m.set(y.id, y);
      }
      return [...m.values()].filter((x) => !deleted.has(x.id)).map(clone);
    };
    out.raids = mergeList(a.raids, b.raids).sort((x, y) => x.timestamp - y.timestamp);
    out.adjustments = mergeList(a.adjustments, b.adjustments).sort((x, y) => x.timestamp - y.timestamp);
    out.milestones = mergeList(a.milestones, b.milestones).sort((x, y) => x.timestamp - y.timestamp);
    const porder = (a.players || []).map((x) => x.id).concat((b.players || []).map((x) => x.id).filter((id) => !(a.players || []).some((x) => x.id === id)));
    const pm = new Map(mergeList(a.players, b.players).map((x) => [x.id, x]));
    out.players = porder.filter((id) => pm.has(id)).map((id) => pm.get(id));
    const order = (a.kingdoms || []).map((k) => k.id).concat((b.kingdoms || []).map((k) => k.id).filter((id) => !(a.kingdoms || []).some((k) => k.id === id)));
    const km = new Map(mergeList(a.kingdoms, b.kingdoms).map((k) => [k.id, k]));
    out.kingdoms = order.filter((id) => km.has(id)).map((id) => km.get(id));
    const alive = new Set(out.kingdoms.map((k) => k.id));
    out.players = out.players.filter((x) => alive.has(x.kingdom));
    const bt = new Map((b.territories || []).map((t) => [t.id, t]));
    out.territories = out.territories.map((t) => {
      const o = bt.get(t.id);
      if (o && (o.editedAt || 0) > (t.editedAt || 0)) return Object.assign({}, t, { name: o.name, override: o.override || null, overrideBy: o.overrideBy || null, editedAt: o.editedAt });
      return t;
    });
    if ((b.seasonAt || 0) > (a.seasonAt || 0)) {
      out.year = b.year;
      out.season = b.season;
      out.seasonAt = b.seasonAt;
    }
    if ((b.settingsAt || 0) > (a.settingsAt || 0)) {
      out.name = b.name;
      out.goalPct = b.goalPct;
      out.costs = b.costs || {};
      out.settingsAt = b.settingsAt;
    }
    out.deleted = [...deleted];
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    out.shared = !!(a.shared || b.shared);
    if (b.example === false || a.example === false) out.example = false;
    return snapshot(out);
  }

  /* ---------- example campaign ---------- */

  // Two kingdoms a year into a war, with every territory state on show.
  function exampleCampaign(now) {
    const t0 = now || nowMs();
    const c = newCampaign({ name: 'The Saltmarch War', seed: 'saltmarch', count: 20, shape: 'island', kingdoms: 2, now: t0 });
    c.example = true;
    const [k1, k2] = c.kingdoms;
    Object.assign(k1, { name: 'Ravenmark', ruler: { title: 'Queen', name: 'Ragnhild Ironside' }, motto: 'We take what is ours', trait: 'reavers', faction: 'vikings', arms: { division: 'plain', field: 'sable', second: 'sable', charge: 'raven', chargeColor: 'argent' } });
    Object.assign(k2, { name: 'Kingdom of Saltvik', ruler: { title: 'Jarl', name: 'Halfdan the Grim' }, motto: 'The sea provides', trait: 'seafarers', faction: 'vikings', arms: { division: 'pale', field: 'azure', second: 'or', charge: 'ship', chargeColor: 'gules' } });
    const geo = buildGeometry(c);
    const nearTo = (cap, skip) => {
      const from = geo.index.get(cap);
      return c.territories
        .map((t, i) => ({ id: t.id, d: routeLeagues(geo, findRoute(geo, from, i)) }))
        .filter((x) => x.id !== k1.capital && x.id !== k2.capital && !skip.includes(x.id))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.id);
    };
    const a = nearTo(k1.capital, []);
    const [n1, n2, n3, n4, n5] = a;
    const b = nearTo(k2.capital, a.slice(0, 5));
    const [m1, m2] = b;
    // A territory both kingdoms reach for: the closest to both capitals not already used.
    const shared = nearTo(k2.capital, [n1, n2, n3, n4, n5, m1, m2])[0];
    const script = [
      [1, 'spring', 'k1', n1, 'success', 30, 3, 70],
      [1, 'spring', 'k2', m1, 'success', 28, 2, 60],
      [1, 'spring', 'k1', n1, 'success', 30, 2, 55],
      [1, 'summer', 'k1', n2, 'failure', 25, 10, 10],
      [1, 'summer', 'k1', n1, 'success', 32, 2, 60],
      [1, 'summer', 'k2', m1, 'success', 30, 3, 45],
      [1, 'autumn', 'k1', n3, 'success', 28, 4, 85],
      [1, 'autumn', 'k2', shared, 'success', 26, 4, 40],
      [1, 'autumn', 'k1', n2, 'success', 35, 5, 45],
      [1, 'winter', 'k1', n5, 'failure', 20, 8, 0],
      [1, 'winter', 'k1', shared, 'success', 30, 5, 35],
      [2, 'spring', 'k1', n2, 'success', 34, 3, 50],
      [2, 'spring', 'k2', m2, 'success', 25, 3, 40],
      [2, 'spring', 'k1', n4, 'ongoing', 20, 0, 0],
    ];
    let ts = t0 - script.length * 3600e3;
    c.raids = script.map((s, i) => ({
      id: 'r' + (i + 1),
      by: s[2],
      sourceTerritory: 'base',
      targetTerritory: s[3],
      outcome: s[4],
      timestamp: (ts += 3600e3),
      losses: s[6],
      lootGained: s[7],
      warband: s[5],
      year: s[0],
      season: s[1],
      notes: '',
    }));
    c.adjustments = [{ id: 'a1', kingdom: 'k1', year: 1, season: 'winter', timestamp: t0 - 5 * 3600e3, treasury: -60, army: 12, morale: 0, note: 'Hired 12 sellswords' }];
    c.milestones = [{ id: 'm1', kingdom: null, year: 1, season: 'spring', timestamp: t0 - 20 * 3600e3, kind: 'custom', label: 'The longships land' }];
    c.year = 2;
    c.season = 'spring';
    return snapshot(c);
  }

  /* ---------- import / export ---------- */

  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeTimestamp(v, fallback) {
    const n = num(v, fallback);
    return n > 0 && n < 1e12 ? n * 1000 : n;
  }

  // Validates one campaign from an import, filling gaps. Throws an Error whose
  // message says what is wrong when the data can't be used at all.
  function normalizeCampaign(raw, key) {
    const warnings = [];
    if (!raw || typeof raw !== 'object') throw new Error('A campaign entry is not an object.');
    const label = raw.name || key || 'campaign';
    if (!Array.isArray(raw.territories)) throw new Error('"' + label + '" has no territories list.');
    if (raw.territories.length < 2 || raw.territories.length > 120) {
      throw new Error('"' + label + '" has ' + raw.territories.length + ' territories; it needs between 2 (a home base and a target) and 120.');
    }
    const foreign = raw.version == null; // written by hand or by another tool
    const ids = new Set();
    const territories = raw.territories.map((t, i) => {
      if (!t || typeof t !== 'object') throw new Error('Territory ' + (i + 1) + ' in "' + label + '" is not an object.');
      const x = num(t.position && t.position.x, NaN);
      const y = num(t.position && t.position.y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error('Territory "' + (t.name || t.id || i + 1) + '" in "' + label + '" needs a position with numeric x and y.');
      }
      let id = typeof t.id === 'string' && t.id ? t.id : 't' + (i + 1);
      if (ids.has(id)) {
        id = id + '_' + (i + 1);
        warnings.push('Duplicate territory id renamed to ' + id + '.');
      }
      ids.add(id);
      const status = STATUSES.includes(t.status) ? t.status : 'unclaimed';
      let override = STATUSES.includes(t.override) ? t.override : null;
      // Hand-written files carry status but no raid history, so keep it as a manual status.
      if (foreign && status !== 'unclaimed') override = t.conquered ? 'conquered' : status;
      return {
        id,
        name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 60) : 'Territory ' + (i + 1),
        position: { x, y },
        goldValue: Math.max(0, Math.round(num(t.goldValue, 100))),
        garrisonBase: Math.max(0, Math.round(num(t.garrisonBase, num(t.garrison, 30)))),
        garrison: 0,
        status,
        terrain: TERRAINS.includes(t.terrain) ? t.terrain : 'grassland',
        conquered: false,
        control: 0,
        damage: 0,
        override,
        overrideBy: typeof t.overrideBy === 'string' ? t.overrideBy : null,
        editedAt: num(t.editedAt, 0),
        ...(typeof t.realm === 'string' && t.realm.trim() ? { realm: t.realm.trim().slice(0, 40) } : {}),
      };
    });

    let map = raw.map && typeof raw.map === 'object' ? raw.map : null;
    const mapSeed = num(map && map.seed, hashString('map:' + (raw.seed || raw.id || label))) >>> 0;
    const islandsOk =
      map && Array.isArray(map.islands) && map.islands.length >= 1 && map.islands.length <= 8 &&
      map.islands.every((i) => i && num(i.rx, 0) > 0 && num(i.ry, 0) > 0 && Number.isFinite(num(i.cx, NaN)) && Number.isFinite(num(i.cy, NaN)));
    const coastOk = map && map.coast && Number.isFinite(num(map.coast.angle, NaN)) && Number.isFinite(num(map.coast.c, NaN));
    let engine2 = null;
    if (map && map.engine === 2 && map.kind === 'europe') {
      engine2 = { engine: 2, kind: 'europe', width: MAP_W, height: MAP_H, seed: mapSeed, shape: 'europe', gen: normGen(map.gen) };
    } else if (map && map.engine === 2) {
      try {
        if (!SHAPES.includes(map.shape) || !map.mask || typeof map.mask !== 'object') throw new Error('bad mask');
        const m2 = { engine: 2, width: num(map.width, MAP_W), height: num(map.height, MAP_H), seed: mapSeed, shape: map.shape, gen: normGen(map.gen), mask: JSON.parse(JSON.stringify(map.mask)) };
        const f = makeShapeField(m2);
        if (![f(500, 350), f(100, 100), f(900, 600)].every(Number.isFinite)) throw new Error('bad mask');
        engine2 = m2;
      } catch (e) {
        warnings.push('The coastline settings could not be read, so the map is drawn as one island.');
      }
    }
    if (engine2) map = engine2;
    else if (map && map.shape === 'mainland' && coastOk) {
      map = { width: num(map.width, MAP_W), height: num(map.height, MAP_H), seed: mapSeed, shape: 'mainland', rx: 375, ry: 248, coast: { angle: num(map.coast.angle, 0), c: num(map.coast.c, 0) } };
    } else if (map && map.shape === 'archipelago' && islandsOk) {
      map = {
        width: num(map.width, MAP_W),
        height: num(map.height, MAP_H),
        seed: mapSeed,
        shape: 'archipelago',
        rx: 375,
        ry: 248,
        islands: map.islands.map((i) => ({ cx: num(i.cx, 0), cy: num(i.cy, 0), rx: num(i.rx, 1), ry: num(i.ry, 1) })),
      };
    } else if (!map || !(num(map.rx, 0) > 0) || !(num(map.ry, 0) > 0)) {
      if (map) warnings.push('Map size was incomplete, so it was recalculated.');
      const width = num(map && map.width, MAP_W);
      const height = num(map && map.height, MAP_H);
      let maxRho = 0;
      for (const t of territories) {
        const ex = (t.position.x - width / 2) / 375;
        const ey = (t.position.y - height / 2) / 248;
        maxRho = Math.max(maxRho, Math.sqrt(ex * ex + ey * ey));
      }
      const grow = Math.max(1, maxRho / 0.85);
      map = { width, height, rx: 375 * grow, ry: 248 * grow, seed: mapSeed, shape: 'island' };
    } else {
      if (map.shape && map.shape !== 'island') warnings.push('The map shape was incomplete, so it is drawn as one island.');
      map = { width: num(map.width, MAP_W), height: num(map.height, MAP_H), rx: num(map.rx, 375), ry: num(map.ry, 248), seed: mapSeed, shape: 'island' };
    }

    const year = Math.max(1, Math.floor(num(raw.year, 1)));
    const season = SEASONS.includes(raw.season) ? raw.season : 'spring';
    const safeId = (v) => typeof v === 'string' && /^[A-Za-z0-9_\-~:@+]{1,120}$/.test(v);

    // Kingdoms, or one kingdom built from an older file's home base.
    const kingdoms = [];
    const usedK = new Set();
    const usedCaps = new Set();
    const usedColors = new Set();
    const krng = mulberry32(hashString('kingdoms:' + (raw.seed || raw.id || label)));
    const freeCap = () => (territories.find((t) => !usedCaps.has(t.id)) || territories[0]).id;
    const addKingdom = (k, i) => {
      let id = safeId(k.id) && !usedK.has(k.id) ? k.id : 'k' + (i + 1);
      while (usedK.has(id)) id += 'x';
      const cap = ids.has(k.capital) && !usedCaps.has(k.capital) ? k.capital : freeCap();
      const color = KINGDOM_COLORS.some((x) => x.id === k.color) && !usedColors.has(k.color) ? k.color : (KINGDOM_COLORS.find((x) => !usedColors.has(x.id)) || KINGDOM_COLORS[0]).id;
      usedK.add(id);
      usedCaps.add(cap);
      usedColors.add(color);
      const a = k.arms && typeof k.arms === 'object' ? k.arms : {};
      const ra = randomArms(krng);
      const tinct = (v, d) => (TINCTURES[v] ? v : d);
      const st = k.start && typeof k.start === 'object' ? k.start : {};
      kingdoms.push({
        id,
        name: typeof k.name === 'string' && k.name.trim() ? k.name.trim().slice(0, 40) : 'Kingdom ' + (i + 1),
        ruler: {
          title: k.ruler && TITLES.includes(k.ruler.title) ? k.ruler.title : 'King',
          name: k.ruler && typeof k.ruler.name === 'string' && k.ruler.name.trim() ? k.ruler.name.trim().slice(0, 40) : pick(krng, RULERS),
        },
        motto: typeof k.motto === 'string' ? k.motto.slice(0, 60) : '',
        color,
        arms: {
          division: DIVISIONS[a.division] ? a.division : ra.division,
          field: tinct(a.field, ra.field),
          second: tinct(a.second, ra.second),
          charge: CHARGES[a.charge] ? a.charge : ra.charge,
          chargeColor: tinct(a.chargeColor, ra.chargeColor),
        },
        trait: TRAITS[k.trait] ? k.trait : 'none',
        faction: FACTIONS[k.faction] ? k.faction : 'vikings',
        capital: cap,
        start: {
          treasury: Math.round(num(st.treasury, DEFAULT_START.treasury)),
          army: Math.max(0, Math.round(num(st.army, DEFAULT_START.army))),
          morale: clamp(Math.round(num(st.morale, DEFAULT_START.morale)), 0, 100),
        },
        updatedAt: num(k.updatedAt, 0),
      });
      if (safeId(k.ownerId)) legacyOwners.push([id, k.ownerId, num(k.updatedAt, 0)]);
    };
    const legacyOwners = [];
    if (Array.isArray(raw.kingdoms) && raw.kingdoms.length) {
      if (raw.kingdoms.length > MAX_KINGDOMS) warnings.push('Only the first ' + MAX_KINGDOMS + ' kingdoms were kept.');
      raw.kingdoms.slice(0, MAX_KINGDOMS).forEach((k, i) => k && typeof k === 'object' && addKingdom(k, i));
    }
    let backOut = false;
    if (!kingdoms.length) {
      let base = typeof raw.baseTerritory === 'string' && ids.has(raw.baseTerritory) ? raw.baseTerritory : null;
      if (!base) {
        const held = territories.find((t) => t.override === 'conquered');
        base = (held || territories[0]).id;
        warnings.push('No home base was set, so ' + territories.find((t) => t.id === base).name + ' became home.');
      }
      const k = randomKingdom(krng, 0, base, territories.find((t) => t.id === base).name, { plainFirst: true });
      k.name = typeof raw.kingdomName === 'string' && raw.kingdomName.trim() ? raw.kingdomName.trim().slice(0, 40) : 'Your kingdom';
      k.faction = 'vikings';
      if (raw.start && typeof raw.start === 'object') k.start = raw.start;
      else backOut = raw.treasury != null || raw.army != null || raw.morale != null;
      addKingdom(k, 0);
    }
    const kIds = new Set(kingdoms.map((k) => k.id));
    const capOf = new Map(kingdoms.map((k) => [k.capital, k.id]));

    const players = [];
    const pIds = new Set();
    const seenUsers = new Set();
    for (const [i, pl] of (Array.isArray(raw.players) ? raw.players : []).entries()) {
      if (!pl || typeof pl !== 'object' || players.length >= MAX_PLAYERS) continue;
      const userId = safeId(pl.userId) ? pl.userId : null;
      if (userId && seenUsers.has(userId)) continue; // one kingdom per account
      let id = safeId(pl.id) ? pl.id : 'p' + (i + 1);
      while (pIds.has(id)) id += 'x';
      const name = typeof pl.name === 'string' ? pl.name.trim().slice(0, 30) : '';
      if (!name && !userId) continue;
      pIds.add(id);
      if (userId) seenUsers.add(userId);
      players.push({ id, name, kingdom: kIds.has(pl.kingdom) ? pl.kingdom : kingdoms[0].id, userId, updatedAt: num(pl.updatedAt, 0) });
    }
    // Version 2 kept one owner on each kingdom.
    if (!Array.isArray(raw.players)) {
      for (const [kid, userId, at] of legacyOwners) {
        if (seenUsers.has(userId)) continue;
        seenUsers.add(userId);
        players.push({ id: 'p-' + kid, name: '', kingdom: kid, userId, updatedAt: at });
      }
    }
    for (const t of territories) {
      if (capOf.has(t.id)) t.override = null;
      if (t.overrideBy && !kIds.has(t.overrideBy)) t.overrideBy = null;
    }

    let dropped = 0;
    const raidIds = new Set();
    const raids = (Array.isArray(raw.raids) ? raw.raids : [])
      .filter((r) => {
        const by = r && kIds.has(r.by) ? r.by : kingdoms[0].id;
        const ok = r && typeof r === 'object' && ids.has(r.targetTerritory) && capOf.get(r.targetTerritory) !== by && OUTCOMES.includes(r.outcome);
        if (!ok) dropped++;
        return ok;
      })
      .map((r, i) => {
        let id = safeId(r.id) ? r.id : 'r' + (i + 1);
        while (raidIds.has(id)) id += 'x';
        raidIds.add(id);
        const hasSeason = SEASONS.includes(r.season) && num(r.year, 0) >= 1;
        const out = {
          id,
          by: kIds.has(r.by) ? r.by : kingdoms[0].id,
          sourceTerritory: r.sourceTerritory === 'base' || !ids.has(r.sourceTerritory) ? 'base' : r.sourceTerritory,
          targetTerritory: r.targetTerritory,
          outcome: r.outcome,
          timestamp: normalizeTimestamp(r.timestamp, nowMs()),
          losses: Math.max(0, Math.round(num(r.losses, 0))),
          lootGained: Math.max(0, Math.round(num(r.lootGained, 0))),
          warband: Math.max(0, Math.round(num(r.warband, 0))),
          year: hasSeason ? Math.floor(num(r.year, year)) : year,
          season: hasSeason ? r.season : season,
          notes: typeof r.notes === 'string' ? r.notes.slice(0, 500) : '',
        };
        if (num(r.updatedAt, 0)) out.updatedAt = num(r.updatedAt, 0);
        if (safeId(r.authorId)) out.authorId = r.authorId;
        if (safeId(r.playerId)) out.playerId = r.playerId;
        const troops = normTroops(r.troops);
        if (troops) {
          out.troops = troops;
          out.warband = Object.values(troops).reduce((a, n) => a + n, 0);
        }
        if (num(r.value, 0) > 0) out.value = Math.round(num(r.value, 0));
        if (num(r.cost, 0) > 0) out.cost = Math.round(num(r.cost, 0));
        if (SCENARIOS[r.scenario]) out.scenario = r.scenario;
        return out;
      });
    if (dropped) warnings.push(dropped + ' raid' + (dropped === 1 ? '' : 's') + ' pointed at unknown territories, at the raider’s own capital, or had no outcome, and were left out.');

    const adjustments = (Array.isArray(raw.adjustments) ? raw.adjustments : [])
      .filter((a) => a && typeof a === 'object')
      .map((a, i) => ({
        id: safeId(a.id) ? a.id : 'a' + (i + 1),
        kingdom: kIds.has(a.kingdom) ? a.kingdom : kingdoms[0].id,
        year: Math.max(1, Math.floor(num(a.year, year))),
        season: SEASONS.includes(a.season) ? a.season : season,
        timestamp: normalizeTimestamp(a.timestamp, nowMs()),
        treasury: Math.round(num(a.treasury, 0)),
        army: Math.round(num(a.army, 0)),
        morale: Math.round(num(a.morale, 0)),
        note: typeof a.note === 'string' ? a.note.slice(0, 200) : '',
      }));

    const milestones = (Array.isArray(raw.milestones) ? raw.milestones : [])
      .filter((m) => m && typeof m === 'object' && !m.auto && typeof m.label === 'string' && m.label.trim())
      .map((m, i) => ({
        id: safeId(m.id) ? m.id : 'm' + (i + 1),
        kingdom: kIds.has(m.kingdom) ? m.kingdom : null,
        year: Math.max(1, Math.floor(num(m.year, year))),
        season: SEASONS.includes(m.season) ? m.season : season,
        timestamp: normalizeTimestamp(m.timestamp, nowMs()),
        kind: ['victory', 'defeat', 'empire', 'custom'].includes(m.kind) ? m.kind : 'custom',
        label: m.label.trim().slice(0, 80),
      }));

    const c = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : typeof key === 'string' && key ? key : newId('c'),
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Imported campaign',
      seed: typeof raw.seed === 'string' ? raw.seed : String(map.seed),
      version: 3,
      createdAt: normalizeTimestamp(raw.createdAt, nowMs()),
      updatedAt: normalizeTimestamp(raw.updatedAt, nowMs()),
      year,
      season,
      seasonAt: num(raw.seasonAt, 0),
      goalPct: clamp(Math.round(num(raw.goalPct, 60)), 5, 100),
      settingsAt: num(raw.settingsAt, 0),
      costs: normCosts(raw.costs),
      map,
      territories,
      kingdoms,
      players,
      raids,
      adjustments,
      milestones,
      deleted: (Array.isArray(raw.deleted) ? raw.deleted : []).filter(safeId).slice(-2000),
    };
    if (raw.shared) c.shared = true;

    if (backOut) {
      // Keep the file's current totals: back out what the raids already contributed.
      const zero = replay(c, { treasury: 0, army: 1e9, morale: 50 });
      kingdoms[0].start = {
        treasury: Math.round(num(raw.treasury, DEFAULT_START.treasury) - zero.treasury),
        army: Math.max(0, Math.round(num(raw.army, DEFAULT_START.army) - (zero.army - 1e9))),
        morale: clamp(Math.round(num(raw.morale, DEFAULT_START.morale) - (zero.morale - 50)), 0, 100),
      };
    }
    if (raw.example) c.example = true;
    else if (raw.example === false) c.example = false;
    return { campaign: snapshot(c), warnings };
  }

  // Accepts {"campaigns": {id: campaign}}, a list of campaigns, or one campaign.
  function parseImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not valid JSON (' + e.message + ').');
    }
    let entries;
    if (data && data.campaigns && typeof data.campaigns === 'object') {
      entries = Array.isArray(data.campaigns) ? data.campaigns.map((c) => [null, c]) : Object.entries(data.campaigns);
    } else if (Array.isArray(data)) entries = data.map((c) => [null, c]);
    else if (data && Array.isArray(data.territories)) entries = [[null, data]];
    else throw new Error('No campaigns found. Expected {"campaigns": {...}} or a single campaign with a territories list.');
    if (!entries.length) throw new Error('The file has an empty campaigns list.');
    const campaigns = [];
    const warnings = [];
    for (const [key, raw] of entries) {
      const res = normalizeCampaign(raw, key);
      campaigns.push(res.campaign);
      for (const w of res.warnings) warnings.push(res.campaign.name + ': ' + w);
    }
    return { campaigns, warnings };
  }

  function exportJSON(campaigns) {
    const out = { app: 'pillage-ransack', version: 1, exportedAt: new Date(nowMs()).toISOString(), campaigns: {} };
    for (const c of campaigns) out.campaigns[c.id] = snapshot(JSON.parse(JSON.stringify(c)));
    return JSON.stringify(out, null, 2);
  }

  return {
    MAP_W,
    MAP_H,
    SEASONS,
    TERRAINS,
    STATUSES,
    OUTCOMES,
    MIN_TERRITORIES,
    EUROPE_REALMS,
    EUROPE_TERRITORIES,
    europeXY,
    MAX_TERRITORIES,
    SHAPES,
    SHAPES1,
    SHAPE_LABEL,
    GEN_DEFAULTS,
    MAX_KINGDOMS,
    MAX_PLAYERS,
    KINGDOM_COLORS,
    TINCTURES,
    DIVISIONS,
    CHARGES,
    TITLES,
    TRAITS,
    FEATURES,
    DECOR_ZONES,
    clearOfDecor,
    LEAGUES_PER_100,
    RULES,
    TERRAIN_STATS,
    DEFAULT_START,
    hashString,
    mulberry32,
    valueNoise,
    randomSeed,
    voronoiCells,
    polygonArea,
    polygonCentroid,
    pointInPolygon,
    pointInShape,
    buildGeometry,
    pathData,
    findRoute,
    routeLeagues,
    newCampaign,
    upgradeCampaign,
    randomKingdom,
    randomArms,
    kingdomColor,
    kingdomOf,
    chooseCapitals,
    mergeCampaigns,
    newPlayer,
    playersOf,
    kingdomPlayable,
    assignPlayers,
    normGen,
    campaignName,
    territoryFeature,
    mapShape,
    exampleCampaign,
    seasonIndex,
    seasonFromIndex,
    seasonLabel,
    replay,
    snapshot,
    raidOdds,
    nextRaidId,
    raidSources,
    frontier,
    canRaid,
    sourcesFor,
    crossesSea,
    suggestScenario,
    FACTIONS,
    FACTION_IDS,
    TROOP_SRC,
    SCENARIOS,
    factionOf,
    troopList,
    normTroops,
    warbandCost,
    troopSummary,
    newId,
    normalizeCampaign,
    parseImport,
    exportJSON,
  };
});
