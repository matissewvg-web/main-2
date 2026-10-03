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
  const MAX_TERRITORIES = 25;
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

  const SHAPES = ['island', 'archipelago', 'mainland'];
  const SHAPE_LABEL = { island: 'Island', archipelago: 'Archipelago', mainland: 'Mainland coast' };
  // Map furniture the coastline should stay clear of: cartouche, compass rose, scale bar.
  const DECOR_ZONES = [
    [14, 12, 258, 72],
    [880, 30, 985, 135],
    [100, 650, 300, 690],
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

  function mapShape(map) {
    return SHAPES.includes(map.shape) ? map.shape : 'island';
  }

  function mapIslands(map) {
    if (mapShape(map) !== 'mainland' && Array.isArray(map.islands) && map.islands.length) return map.islands;
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
    if (mapShape(map) === 'mainland') {
      const cf = coastFrame(map);
      return clamp((cf.c - (x * cf.nx + y * cf.ny)) / 420, 0, 1);
    }
    return clamp(1 - nearestIsland(mapIslands(map), x, y)[1], 0, 1);
  }

  // Each landmass: a convex outline its territories are cut from.
  function landmasses(map) {
    if (mapShape(map) === 'mainland') {
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
    return mapShape(map) === 'mainland' ? 0 : nearestIsland(mapIslands(map), x, y)[0];
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
    if (mapShape(map) === 'mainland') {
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

  // Shortest route between two territories over borders and sea lanes (a crossing costs a quarter more).
  function findRoute(geo, fromIdx, toIdx) {
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
        const d = distTo[u] + dist(geo.sites[u], geo.sites[v]) * (sea ? 1.25 : 1);
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

  function newId(prefix) {
    return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function relax(sites, map, iterations) {
    let s = sites;
    const mainland = mapShape(map) === 'mainland';
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

  function newCampaign(opts) {
    const o = opts || {};
    const seed = String(o.seed || randomSeed());
    const count = clamp(Math.round(o.count || 20), MIN_TERRITORIES, MAX_TERRITORIES);
    const now = o.now || nowMs();
    // A shape left as random comes from the seed, so a seed always means the same map.
    const shape = SHAPES.includes(o.shape) ? o.shape : SHAPES[Math.floor(mulberry32(hashString('shape:' + seed))() * SHAPES.length)];
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

  // "The Ravenmere Raids", "The Harrying of Ketilvik"... named after the richest prize.
  function campaignName(c) {
    const rng = mulberry32(hashString('name:' + c.seed));
    const prize = c.territories.filter((t) => t.id !== c.baseTerritory).sort((a, b) => b.goldValue - a.goldValue)[0] || c.territories[0];
    const patterns = [
      (n) => 'The ' + n + ' Raids',
      (n) => 'The Harrying of ' + n,
      (n) => 'The Saga of ' + n,
      (n) => 'The ' + n + ' War',
      (n) => 'Fire over ' + n,
    ];
    return patterns[Math.floor(rng() * patterns.length)](prize.name);
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
    if (t.id === c.baseTerritory) return 'home';
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

  function deriveStatus(t) {
    if (t.control >= 100) return 'conquered';
    if (t.ongoing > 0 || (t.lastOutcome === 'failure' && t.control > 0)) return 'contested';
    if (t.control > 0) return 'claimed';
    return 'unclaimed';
  }

  function replay(c, startOverride) {
    const R = RULES;
    const start = startOverride || c.start || DEFAULT_START;
    const nowIdx = seasonIndex(c.year, c.season);
    const base = c.baseTerritory;
    const byId = new Map();
    for (const t of c.territories) {
      const isBase = t.id === base;
      byId.set(t.id, {
        id: t.id,
        name: t.name,
        goldValue: t.goldValue,
        garrisonBase: t.garrisonBase,
        terrain: t.terrain,
        isBase,
        control: isBase ? 100 : 0,
        garrison: isBase ? 0 : t.garrisonBase,
        damage: 0,
        lastOutcome: null,
        ongoing: 0,
        raids: 0,
        wins: 0,
        fails: 0,
        loot: 0,
        losses: 0,
        status: isBase ? 'conquered' : 'unclaimed',
      });
    }
    let treasury = start.treasury;
    let army = start.army;
    let morale = start.morale;
    let inField = 0;
    const totalTargets = Math.max(1, c.territories.length - 1);
    let conquered = 0;
    const auto = [];
    const reached = new Set();
    let firstBlood = false;
    let firstConquest = false;
    let lowMorale = false;
    const treasuryMarks = [1000, 2500, 5000, 10000];
    let treasuryMark = treasuryMarks.findIndex((m) => m > treasury);
    if (treasuryMark === -1) treasuryMark = treasuryMarks.length;

    let clock = 0; // timestamp of the event being applied, so milestones sort with custom ones
    function mark(si, kind, label, territory, raidId) {
      const s = seasonFromIndex(si);
      auto.push({ id: 'auto-' + auto.length, auto: true, kind, label, year: s.year, season: s.season, idx: si, timestamp: clock, territory: territory || null, raid: raidId || null });
    }

    function checkProgress(si) {
      const pct = (conquered / totalTargets) * 100;
      for (const p of [25, 50, 75]) {
        if (pct >= p && !reached.has(p)) {
          reached.add(p);
          mark(si, 'empire', p + '% of the realm conquered');
        }
      }
      if (c.goalPct && pct >= c.goalPct && !reached.has('goal')) {
        reached.add('goal');
        mark(si, 'empire', 'Goal reached: ' + c.goalPct + '% conquered');
      }
      while (treasuryMark < treasuryMarks.length && treasury >= treasuryMarks[treasuryMark]) {
        mark(si, 'empire', 'Treasury passes ' + treasuryMarks[treasuryMark].toLocaleString('en-GB') + ' gold');
        treasuryMark++;
      }
      if (morale <= 15 && !lowMorale) {
        lowMorale = true;
        mark(si, 'defeat', 'Morale collapses');
      } else if (morale > 30) lowMorale = false;
    }

    function applyRaid(r, si) {
      const t = byId.get(r.targetTerritory);
      if (!t || t.isBase) return;
      t.raids++;
      if (r.outcome === 'ongoing') {
        t.ongoing++;
        inField += Math.max(0, r.warband || 0);
        return;
      }
      const losses = Math.max(0, r.losses || 0);
      const loot = Math.max(0, r.lootGained || 0);
      const armyBefore = army;
      army = Math.max(0, army - losses);
      treasury += loot;
      t.loot += loot;
      t.losses += losses;
      if (r.outcome === 'success') {
        t.wins++;
        morale = clamp(morale + R.moraleSuccess, 0, 100);
        t.garrison = Math.round(t.garrison * R.successGarrisonMult);
        const before = t.control;
        t.control = Math.min(100, t.control + R.successControl);
        if (!firstBlood) {
          firstBlood = true;
          mark(si, 'victory', 'First blood at ' + t.name, t.id, r.id);
        }
        if (before < 100 && t.control >= 100) {
          conquered++;
          t.garrison = 0;
          morale = clamp(morale + R.moraleConquest, 0, 100);
          mark(si, 'victory', (firstConquest ? '' : 'First conquest: ') + t.name + ' falls', t.id, r.id);
          firstConquest = true;
        }
      } else if (r.outcome === 'failure') {
        t.fails++;
        morale = clamp(morale + R.moraleFailure, 0, 100);
        if (t.control >= 100) conquered--;
        t.control = Math.max(0, t.control + R.failureControl);
        t.damage = Math.min(R.damageMax, t.damage + R.damagePerFailure);
        const cap = Math.round(t.garrisonBase * R.garrisonCapMult);
        t.garrison = Math.min(cap, Math.max(t.garrison, Math.round(t.garrison * R.failureGarrisonMult) + 1));
        if (losses >= Math.max(R.heavyDefeatMin, armyBefore * R.heavyDefeatShare)) {
          mark(si, 'defeat', 'Heavy defeat at ' + t.name + ' (' + losses + ' fell)', t.id, r.id);
        }
      }
      t.lastOutcome = r.outcome;
    }

    function applyAdjustment(a) {
      treasury += Number(a.treasury) || 0;
      army = Math.max(0, army + (Number(a.army) || 0));
      morale = clamp(morale + (Number(a.morale) || 0), 0, 100);
    }

    function endSeason() {
      for (const t of byId.values()) {
        if (t.control >= 100) treasury += Math.round(t.goldValue * R.tributeRate);
        else if (t.control > 0) treasury += Math.round(t.goldValue * R.tributeRate * R.claimedTributeFactor * (t.control / 100));
        if (t.control < 100 && t.garrison < t.garrisonBase) {
          t.garrison = Math.min(t.garrisonBase, t.garrison + Math.max(1, Math.round(t.garrisonBase * R.regenPerSeason)));
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

    let claimed = 0;
    let contested = 0;
    conquered = 0;
    for (const src of c.territories) {
      const t = byId.get(src.id);
      t.status = t.isBase ? 'conquered' : src.override || deriveStatus(t);
      if (t.isBase) continue;
      if (t.status === 'conquered') conquered++;
      else if (t.status === 'claimed') claimed++;
      else if (t.status === 'contested') contested++;
    }

    const custom = (c.milestones || []).map((m) => Object.assign({}, m, { auto: false, idx: seasonIndex(m.year, m.season) }));
    const milestones = auto.concat(custom).sort((a, b) => a.idx - b.idx || (a.timestamp || 0) - (b.timestamp || 0));

    return {
      territories: byId,
      treasury,
      army,
      inField: Math.min(inField, army),
      morale,
      conquered,
      claimed,
      contested,
      totalTargets,
      progressPct: (conquered / totalTargets) * 100,
      milestones,
      nowIdx,
    };
  }

  // Writes the derived state back onto the campaign so saved and exported JSON
  // reads correctly on its own (status, garrison, conquered, treasury...).
  function snapshot(c, result) {
    const res = result || replay(c);
    for (const t of c.territories) {
      const d = res.territories.get(t.id);
      t.garrison = d.garrison;
      t.control = d.control;
      t.damage = d.damage;
      t.status = d.status;
      t.conquered = d.status === 'conquered';
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

  function nextRaidId(c) {
    let max = 0;
    for (const r of c.raids) {
      const m = /^r(\d+)$/.exec(r.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return 'r' + (max + 1);
  }

  // Territories a raid may start from: home, plus anything held or partly held.
  function raidSources(c, result) {
    const out = [];
    for (const t of c.territories) {
      const d = result.territories.get(t.id);
      if (t.id === c.baseTerritory) continue;
      if (d.control > 0) out.push(t.id);
    }
    return out;
  }

  // Unconquered territories bordering anything the player holds.
  function frontier(c, geo, result) {
    const out = new Set();
    c.territories.forEach((t, i) => {
      const d = result.territories.get(t.id);
      if (d.control <= 0) return;
      for (const j of geo.adjacency[i]) {
        const n = c.territories[j];
        if (result.territories.get(n.id).status !== 'conquered') out.add(n.id);
      }
    });
    return out;
  }

  /* ---------- example campaign ---------- */

  function exampleCampaign(now) {
    const t0 = now || nowMs();
    const c = newCampaign({ name: 'The Saltmarch Raids', seed: 'saltmarch', count: 20, shape: 'island', now: t0 });
    c.example = true;
    const geo = buildGeometry(c);
    const baseIdx = geo.index.get(c.baseTerritory);
    const near = c.territories
      .map((t, i) => ({ t, i, d: routeLeagues(geo, findRoute(geo, baseIdx, i)) }))
      .filter((x) => x.i !== baseIdx)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.t.id);
    const [n1, n2, n3, n4, n5] = near;
    const script = [
      [1, 'spring', n1, 'success', 30, 3, 70],
      [1, 'spring', n1, 'success', 30, 2, 55],
      [1, 'summer', n2, 'failure', 25, 10, 10],
      [1, 'summer', n1, 'success', 32, 2, 60],
      [1, 'autumn', n3, 'success', 28, 4, 85],
      [1, 'autumn', n2, 'success', 35, 5, 45],
      [1, 'winter', n5, 'failure', 20, 8, 0],
      [2, 'spring', n2, 'success', 34, 3, 50],
      [2, 'spring', n4, 'ongoing', 20, 0, 0],
    ];
    let ts = t0 - script.length * 3600e3;
    c.raids = script.map((s, k) => ({
      id: 'r' + (k + 1),
      sourceTerritory: 'base',
      targetTerritory: s[2],
      outcome: s[3],
      timestamp: (ts += 3600e3),
      losses: s[5],
      lootGained: s[6],
      warband: s[4],
      year: s[0],
      season: s[1],
      notes: '',
    }));
    c.adjustments = [
      { id: 'a1', year: 1, season: 'winter', timestamp: t0 - 2 * 3600e3, treasury: -60, army: 12, morale: 0, note: 'Hired 12 sellswords' },
    ];
    c.milestones = [{ id: 'm1', year: 1, season: 'spring', timestamp: t0 - 10 * 3600e3, kind: 'custom', label: 'The longships land' }];
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
    if (raw.territories.length < 2 || raw.territories.length > 60) {
      throw new Error('"' + label + '" has ' + raw.territories.length + ' territories; it needs between 2 (a home base and a target) and 60.');
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
      };
    });

    let map = raw.map && typeof raw.map === 'object' ? raw.map : null;
    const mapSeed = num(map && map.seed, hashString('map:' + (raw.seed || raw.id || label))) >>> 0;
    const islandsOk =
      map && Array.isArray(map.islands) && map.islands.length >= 1 && map.islands.length <= 8 &&
      map.islands.every((i) => i && num(i.rx, 0) > 0 && num(i.ry, 0) > 0 && Number.isFinite(num(i.cx, NaN)) && Number.isFinite(num(i.cy, NaN)));
    const coastOk = map && map.coast && Number.isFinite(num(map.coast.angle, NaN)) && Number.isFinite(num(map.coast.c, NaN));
    if (map && map.shape === 'mainland' && coastOk) {
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

    let base = typeof raw.baseTerritory === 'string' && ids.has(raw.baseTerritory) ? raw.baseTerritory : null;
    if (!base) {
      const held = territories.find((t) => t.override === 'conquered');
      base = (held || territories[0]).id;
      warnings.push('No home base was set, so ' + territories.find((t) => t.id === base).name + ' became home.');
    }
    const baseT = territories.find((t) => t.id === base);
    if (baseT.override) baseT.override = null;

    const year = Math.max(1, Math.floor(num(raw.year, 1)));
    const season = SEASONS.includes(raw.season) ? raw.season : 'spring';
    let dropped = 0;
    const raidIds = new Set();
    const raids = (Array.isArray(raw.raids) ? raw.raids : []).filter((r) => {
      const ok = r && typeof r === 'object' && ids.has(r.targetTerritory) && r.targetTerritory !== base && OUTCOMES.includes(r.outcome);
      if (!ok) dropped++;
      return ok;
    }).map((r, i) => {
      let id = typeof r.id === 'string' && r.id ? r.id : 'r' + (i + 1);
      if (raidIds.has(id)) id = 'r' + (raidIds.size + 1000 + i);
      raidIds.add(id);
      const hasSeason = SEASONS.includes(r.season) && num(r.year, 0) >= 1;
      return {
        id,
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
    });
    if (dropped) warnings.push(dropped + ' raid' + (dropped === 1 ? '' : 's') + ' pointed at unknown territories or had no outcome, and were left out.');

    const adjustments = (Array.isArray(raw.adjustments) ? raw.adjustments : [])
      .filter((a) => a && typeof a === 'object')
      .map((a, i) => ({
        id: typeof a.id === 'string' ? a.id : 'a' + (i + 1),
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
        id: typeof m.id === 'string' ? m.id : 'm' + (i + 1),
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
      version: 1,
      createdAt: normalizeTimestamp(raw.createdAt, nowMs()),
      updatedAt: normalizeTimestamp(raw.updatedAt, nowMs()),
      year,
      season,
      goalPct: clamp(Math.round(num(raw.goalPct, 60)), 5, 100),
      baseTerritory: base,
      start: null,
      treasury: 0,
      army: 0,
      morale: 0,
      map,
      territories,
      raids,
      adjustments,
      milestones,
    };

    if (raw.start && typeof raw.start === 'object') {
      c.start = {
        treasury: Math.round(num(raw.start.treasury, DEFAULT_START.treasury)),
        army: Math.max(0, Math.round(num(raw.start.army, DEFAULT_START.army))),
        morale: clamp(Math.round(num(raw.start.morale, DEFAULT_START.morale)), 0, 100),
      };
    } else if (raw.treasury != null || raw.army != null || raw.morale != null) {
      // Keep the file's current totals: back out what the raids already contributed.
      const zero = replay(c, { treasury: 0, army: 1e9, morale: 50 });
      c.start = {
        treasury: Math.round(num(raw.treasury, DEFAULT_START.treasury) - zero.treasury),
        army: Math.max(0, Math.round(num(raw.army, DEFAULT_START.army) - (zero.army - 1e9))),
        morale: clamp(Math.round(num(raw.morale, DEFAULT_START.morale) - (zero.morale - 50)), 0, 100),
      };
    } else c.start = Object.assign({}, DEFAULT_START);

    if (raw.example) c.example = true;
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
    MAX_TERRITORIES,
    SHAPES,
    SHAPE_LABEL,
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
    buildGeometry,
    pathData,
    findRoute,
    routeLeagues,
    newCampaign,
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
    newId,
    normalizeCampaign,
    parseImport,
    exportJSON,
  };
});
