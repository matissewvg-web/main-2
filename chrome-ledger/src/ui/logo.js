// Corpo-logo als SVG: een vorm in de hoofdkleur met een symbool in de accentkleur.

const NS = 'http://www.w3.org/2000/svg';

const VORMEN = {
  cirkel: ['circle', { cx: 50, cy: 50, r: 45 }],
  vierkant: ['rect', { x: 6, y: 6, width: 88, height: 88, rx: 12 }],
  zeshoek: ['polygon', { points: '50,4 90,27 90,73 50,96 10,73 10,27' }],
  ruit: ['polygon', { points: '50,3 97,50 50,97 3,50' }],
  schild: ['path', { d: 'M50 4 L92 18 V48 C92 74 72 90 50 97 C28 90 8 74 8 48 V18 Z' }],
};

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function logoSvg({ vorm, symbool }, kleur, accent, grootte = 48) {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', width: grootte, height: grootte, class: 'logo', 'aria-hidden': 'true' });
  const [tag, attrs] = VORMEN[vorm] || VORMEN.cirkel;
  svg.append(svgEl(tag, { ...attrs, fill: kleur, stroke: accent, 'stroke-width': 5 }));
  const tekst = svgEl('text', {
    x: 50, y: 53, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-size': 46, fill: accent, 'font-family': 'system-ui, sans-serif',
  });
  tekst.textContent = symbool;
  svg.append(tekst);
  return svg;
}
