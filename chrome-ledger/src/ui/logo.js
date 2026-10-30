// Corpo-logo als SVG. logo = { vorm, symbool, monogram, vulling, rand, symboolKleur, grootte, draaiing }
// Alle keuzes staan in data/logos.json; hier staat alleen hoe ze getekend worden.

import { meng } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
let teller = 0;

export const STANDAARD_LOGO = {
  vorm: 'zeshoek', symbool: '⚡', monogram: '', vulling: 'effen', rand: 'dun',
  symboolKleur: 'accent', grootte: 'normaal', draaiing: 0,
};

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Regelmatige veelhoek of ster rond (50,50).
function punten(n, r, binnen = null, start = -90) {
  const p = [];
  const stappen = binnen ? n * 2 : n;
  for (let i = 0; i < stappen; i++) {
    const hoek = ((start + (360 / stappen) * i) * Math.PI) / 180;
    const straal = binnen && i % 2 ? binnen : r;
    p.push(`${(50 + straal * Math.cos(hoek)).toFixed(1)},${(50 + straal * Math.sin(hoek)).toFixed(1)}`);
  }
  return p.join(' ');
}

const VORMEN = {
  cirkel: () => ['circle', { cx: 50, cy: 50, r: 45 }],
  vierkant: () => ['rect', { x: 7, y: 7, width: 86, height: 86, rx: 12 }],
  zeshoek: () => ['polygon', { points: '50,4 90,27 90,73 50,96 10,73 10,27' }],
  ruit: () => ['polygon', { points: '50,3 97,50 50,97 3,50' }],
  schild: () => ['path', { d: 'M50 4 L92 18 V48 C92 74 72 90 50 97 C28 90 8 74 8 48 V18 Z' }],
  driehoek: () => ['polygon', { points: '50,6 95,88 5,88' }],
  achthoek: () => ['polygon', { points: punten(8, 46, null, -67.5) }],
  ster: () => ['polygon', { points: punten(5, 48, 22) }],
  ring: () => ['path', { d: 'M50 4 A46 46 0 1 0 50.01 4 Z M50 24 A26 26 0 1 1 49.99 24 Z', 'fill-rule': 'evenodd' }],
  kristal: () => ['polygon', { points: '50,2 82,34 50,98 18,34' }],
  tandwiel: () => ['polygon', { points: punten(10, 47, 38) }],
  chip: () => ['path', {
    d: 'M20 14 H80 V20 H90 V30 H80 V44 H90 V56 H80 V70 H90 V80 H80 V86 H20 V80 H10 V70 H20 V56 H10 V44 H20 V30 H10 V20 H20 Z',
  }],
};

const SYMBOOLKLEUR = { wit: '#ffffff', zwart: '#0b0b12' };
const GROOTTE = { klein: 0.7, normaal: 1, groot: 1.3 };

export function logoSvg(invoer, kleur, accent, grootte = 48) {
  const logo = { ...STANDAARD_LOGO, ...invoer };
  const id = `logo${++teller}`;
  const svg = svgEl('svg', { viewBox: '0 0 100 100', width: grootte, height: grootte, class: 'logo', 'aria-hidden': 'true' });
  const defs = svgEl('defs');
  svg.append(defs);
  const donker = meng(kleur, '#000000', 0.45);

  let vulling = kleur;
  if (logo.vulling === 'verloop' || logo.vulling === 'gesplitst') {
    const g = svgEl('linearGradient', { id: `${id}v`, x1: 0, y1: 0, x2: 1, y2: 1 });
    const stops = logo.vulling === 'verloop'
      ? [[0, kleur], [1, meng(kleur, accent, 0.55)]]
      : [[0, kleur], [0.5, kleur], [0.5, donker], [1, donker]];
    for (const [o, c] of stops) g.append(svgEl('stop', { offset: o, 'stop-color': c }));
    defs.append(g);
    vulling = `url(#${id}v)`;
  } else if (logo.vulling === 'strepen' || logo.vulling === 'raster') {
    const p = svgEl('pattern', { id: `${id}p`, width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: logo.vulling === 'strepen' ? 'rotate(45)' : '' });
    p.append(svgEl('rect', { width: 10, height: 10, fill: kleur }));
    if (logo.vulling === 'strepen') p.append(svgEl('rect', { width: 4, height: 10, fill: donker }));
    else p.append(svgEl('path', { d: 'M0 0 H10 M0 0 V10', stroke: meng(kleur, accent, 0.6), 'stroke-width': 1.6 }));
    defs.append(p);
    vulling = `url(#${id}p)`;
  } else if (logo.vulling === 'leeg') {
    vulling = 'none';
  }

  const rand = logo.vulling === 'leeg' && logo.rand === 'geen' ? 'dun' : logo.rand;
  const dikte = { geen: 0, dun: 4, dik: 8, dubbel: 3, gloed: 4 }[rand] ?? 4;
  if (rand === 'gloed') {
    const f = svgEl('filter', { id: `${id}g`, x: '-30%', y: '-30%', width: '160%', height: '160%' });
    f.append(svgEl('feGaussianBlur', { stdDeviation: 3, result: 'b' }));
    const m = svgEl('feMerge');
    m.append(svgEl('feMergeNode', { in: 'b' }), svgEl('feMergeNode', { in: 'SourceGraphic' }));
    f.append(m);
    defs.append(f);
  }

  const [tag, attrs] = (VORMEN[logo.vorm] || VORMEN.cirkel)();
  const groep = svgEl('g', { transform: `rotate(${Number(logo.draaiing) || 0} 50 50)` });
  const vorm = svgEl(tag, {
    ...attrs, fill: vulling, stroke: dikte ? accent : 'none', 'stroke-width': dikte, 'stroke-linejoin': 'round',
    ...(rand === 'gloed' ? { filter: `url(#${id}g)` } : {}),
  });
  groep.append(vorm);
  if (rand === 'dubbel') {
    groep.append(svgEl(tag, {
      ...attrs, fill: 'none', stroke: accent, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
      transform: 'translate(50 50) scale(0.8) translate(-50 -50)',
    }));
  }
  svg.append(groep);

  const tekst = (logo.monogram || '').trim().slice(0, 3).toUpperCase();
  const inhoud = tekst || logo.symbool;
  if (inhoud) {
    const basis = tekst ? [0, 48, 38, 28][tekst.length] : 46;
    const el = svgEl('text', {
      x: 50, y: 53, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': basis * (GROOTTE[logo.grootte] ?? 1),
      'font-weight': 800,
      fill: logo.symboolKleur === 'hoofd' ? kleur : SYMBOOLKLEUR[logo.symboolKleur] ?? accent,
      'font-family': tekst ? '"JetBrains Mono", Consolas, monospace' : 'system-ui, sans-serif',
      ...(logo.symboolKleur === 'hoofd' || logo.vulling === 'leeg' ? {} : { stroke: meng(kleur, '#000000', 0.6), 'stroke-width': 0.6 }),
    });
    el.textContent = inhoud;
    svg.append(el);
  }
  return svg;
}
