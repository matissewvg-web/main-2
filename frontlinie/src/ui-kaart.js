// Campagnekaart als SVG: cellen in de kleur van de eigenaar, frontlijn, iconen, orders en gevechten.
import { KAARTEN } from './kaarten.js';
import { FACTIES } from './campagnes.js';
import { kaartInfo } from './engine.js';

const n1 = (x) => Math.round(x * 10) / 10;
export function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const INFRALETTER = { stad: 'S', haven: 'H', brug: 'B', spoor: 'T', vliegveld: 'V' };
export const ORDERCODE = { aanval: 'AV', landing: 'LA', luchtlanding: 'PA', raid: 'RA', versterk: 'VS', verdedig: 'VD', recon: 'RE', bevoorraad: 'BV', partizanen: 'PZ', voorbereid: 'VB' };

function terreinTeken(t, s) {
  // klein kaartsymbool, getekend rond (0,0), schaal s
  const st = `fill="none" stroke="#1b2420" stroke-opacity="0.5" stroke-width="${n1(s * 0.09)}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (t) {
    case 'bos': return `<path d="M${-s} ${s * 0.5}L${-s * 0.5} ${-s * 0.5}L0 ${s * 0.5}ZM${s * 0.1} ${s * 0.5}L${s * 0.6} ${-s * 0.7}L${s * 1.1} ${s * 0.5}Z" ${st}/>`;
    case 'bergen': return `<path d="M${-s * 1.2} ${s * 0.5}L${-s * 0.3} ${-s * 0.8}L${s * 0.2} ${-s * 0.1}L${s * 0.6} ${-s * 0.6}L${s * 1.3} ${s * 0.5}" ${st}/>`;
    case 'heuvels': return `<path d="M${-s * 1.2} ${s * 0.4}Q${-s * 0.5} ${-s * 0.7} ${s * 0.1} ${s * 0.4}M${-s * 0.1} ${s * 0.4}Q${s * 0.6} ${-s * 0.5} ${s * 1.2} ${s * 0.4}" ${st}/>`;
    case 'stad': return `<path d="M${-s} ${s * 0.5}V${-s * 0.3}H${-s * 0.3}V${s * 0.5}M${-s * 0.1} ${s * 0.5}V${-s * 0.8}H${s * 0.5}V${s * 0.5}M${s * 0.7} ${s * 0.5}V0H${s * 1.2}V${s * 0.5}" ${st}/>`;
    case 'rivier': return `<path d="M${-s * 1.2} 0Q${-s * 0.6} ${-s * 0.7} 0 0T${s * 1.2} 0M${-s * 1.2} ${s * 0.5}Q${-s * 0.6} ${-s * 0.2} 0 ${s * 0.5}T${s * 1.2} ${s * 0.5}" ${st}/>`;
    case 'woestijn': return `<path d="M${-s * 1.2} ${s * 0.3}Q${-s * 0.6} ${-s * 0.3} 0 ${s * 0.3}Q${s * 0.6} ${-s * 0.3} ${s * 1.2} ${s * 0.3}" ${st} stroke-dasharray="${n1(s * 0.12)} ${n1(s * 0.25)}"/>`;
    case 'strand': return `<path d="M${-s * 1.2} ${-s * 0.1}H${s * 1.2}" ${st} stroke-dasharray="${n1(s * 0.1)} ${n1(s * 0.3)}"/><path d="M${-s * 1.2} ${s * 0.4}Q${-s * 0.6} ${s * 0.1} 0 ${s * 0.4}T${s * 1.2} ${s * 0.4}" ${st}/>`;
    case 'moeras': return `<path d="M${-s} ${s * 0.3}H${-s * 0.2}M${s * 0.1} ${s * 0.3}H${s}M${-s * 0.6} ${-s * 0.2}H${s * 0.5}M${-s * 0.3} ${s * 0.3}V${-s * 0.1}M${s * 0.5} ${s * 0.3}V${-s * 0.1}" ${st}/>`;
    case 'bocage': return `<path d="M${-s} ${-s * 0.4}H${s}M${-s} ${s * 0.4}H${s}M${-s * 0.4} ${-s * 0.4}V${s * 0.4}M${s * 0.5} ${-s * 0.4}V${s * 0.4}" ${st}/>`;
    case 'steppe': return `<path d="M${-s} ${s * 0.3}L${-s * 0.8} ${-s * 0.2}M${-s * 0.2} ${s * 0.3}L0 ${-s * 0.3}M${s * 0.6} ${s * 0.3}L${s * 0.8} ${-s * 0.2}" ${st}/>`;
    default: return `<path d="M${-s} ${-s * 0.2}H${s}M${-s} ${s * 0.3}H${s}" ${st} stroke-dasharray="${n1(s * 0.4)} ${n1(s * 0.2)}"/>`;
  }
}

function splitsNaam(naam) {
  if (naam.length <= 13 || !naam.includes(' ')) return [naam];
  const w = naam.split(' '); let beste = 1, verschil = Infinity;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < verschil) { verschil = d; beste = i; } }
  return [w.slice(0, beste).join(' '), w.slice(beste).join(' ')];
}

// s: {kaart, subset, regios:{id:{eigenaar,...}}, facties:[{id,kleur,zijde,hoofdstad}], doel}
// o: {selectie, kiesbaar:Set|Array, bron, pijlen:[{van,naar,fid,type}], merktekens:[{regio,code,fid}], gevechten:[{regio,open}], toonFort:(id)=>bool, klein}
export function kaartSvg(s, o = {}) {
  const info = kaartInfo(s.kaart, s.subset), geo = info.geo, R = geo ? 60 : KAARTEN[s.kaart].straal, bb = info.bbox;
  const fac = (id) => s.facties.find((f) => f.id === id);
  const kleur = (id) => (fac(id) || FACTIES[id] || FACTIES.neutraal).kleur;
  const zijde = (id) => (fac(id) ? fac(id).zijde : 'neutraal');
  const kies = new Set(o.kiesbaar || []);
  const hoofdsteden = new Set(s.facties.map((f) => f.hoofdstad).filter(Boolean));
  const doelen = new Set(s.doel ? s.doel.regios : []);
  const fs = geo ? 21 : R * 0.2 * (KAARTEN[s.kaart].tekst || 1);
  let cellen = '', front = '', labels = '', boven = '';

  for (const r of info.regios) {
    const rs = s.regios[r.id], poly = geo ? [] : info.cellen[r.id];
    const d = geo ? r.d : poly.map((p, i) => (i ? 'L' : 'M') + n1(p.x) + ' ' + n1(p.y)).join('') + 'Z';
    const kl = ['rg', kies.has(r.id) ? 'kan' : '', o.selectie === r.id ? 'sel' : '', o.bron === r.id ? 'bron' : '', kies.size && !kies.has(r.id) && o.bron !== r.id ? 'dof' : ''].filter(Boolean).join(' ');
    cellen += `<g class="${kl}"${o.klein ? '' : ` data-a="regio" data-id="${r.id}"`}><path d="${d}" ${o.verf ? 'fill="#ffffff" fill-opacity="0"' : `fill="${rs.gesloten ? '#6d6f6a' : kleur(rs.eigenaar)}"`}/>`;
    if (rs.bev === false) cellen += `<path d="${d}" fill="url(#arc)" class="geenklik"/>`;
    if (rs.omstreden > 0) cellen += `<path d="${d}" fill="none" stroke="#e8792b" stroke-width="${n1(R * 0.07)}" stroke-dasharray="${n1(R * 0.12)} ${n1(R * 0.1)}" class="geenklik"/>`;
    cellen += '</g>';
    // frontlijn: grens tussen twee zijden
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (!a.bron || a.bron < r.id || !s.regios[a.bron] || !info.buren[r.id].includes(a.bron)) continue;
      const z1 = zijde(rs.eigenaar), z2 = zijde(s.regios[a.bron].eigenaar);
      if (z1 !== z2 && z1 !== 'neutraal' && z2 !== 'neutraal') front += `M${n1(a.x)} ${n1(a.y)}L${n1(b.x)} ${n1(b.y)}`;
    }
    if (o.klein) { if (hoofdsteden.has(r.id) || doelen.has(r.id)) labels += `<circle cx="${r.x}" cy="${r.y}" r="${n1(R * 0.16)}" fill="${doelen.has(r.id) ? '#f2c230' : '#fff'}" stroke="#14181c" stroke-width="${n1(R * 0.04)}"/>`; continue; }
    // labels
    const regels = splitsNaam(r.naam), y0 = r.y - (regels.length - 1) * fs * 0.55;
    let t = `<g class="lb" transform="translate(${r.x} ${r.y})">`;
    if (!geo) t += `<g transform="translate(0 ${n1(-R * 0.42)})">${terreinTeken(r.terrein, R * 0.13)}</g>`;
    if (doelen.has(r.id)) t += `<circle r="${n1(R * (geo ? 0.75 : 0.66))}" fill="none" stroke="#f2c230" stroke-width="${n1(R * 0.05)}" stroke-dasharray="${n1(R * 0.14)} ${n1(R * 0.07)}"/>`;
    t += '</g>';
    regels.forEach((regel, i) => { t += `<text x="${r.x}" y="${n1(y0 + i * fs * 1.08)}" font-size="${n1(fs)}" class="rn">${hoofdsteden.has(r.id) && i === 0 ? '★ ' : ''}${esc(regel)}</text>`; });
    const infra = r.infra.map((x) => INFRALETTER[x]).filter(Boolean).join(' ');
    const zieFort = o.toonFort ? o.toonFort(r.id) : true;
    const fort = rs.fort === undefined ? r.fort : rs.fort;
    const fortTxt = zieFort ? (fort > 0 ? '▲'.repeat(fort) : '') : (o.fortVraag === undefined ? '?' : o.fortVraag);
    t += `<text x="${r.x}" y="${n1(y0 + regels.length * fs * 1.08 + fs * 0.1)}" font-size="${n1(fs * 0.78)}" class="ri">${r.waarde}${infra && !geo ? ' · ' + infra : ''}${fortTxt ? ' · ' + fortTxt : ''}</text>`;
    labels += t;
  }

  if (geo && !o.verf) for (const [sleutel, pad] of Object.entries(geo.grenzen)) {
    const [a, b] = sleutel.split('|');
    if (!s.regios[a] || !s.regios[b] || !info.opId[a] || !info.opId[b]) continue;
    const z1 = zijde(s.regios[a].eigenaar), z2 = zijde(s.regios[b].eigenaar);
    if (z1 !== z2 && z1 !== 'neutraal' && z2 !== 'neutraal') front += pad;
  }
  for (const [a, b] of info.links) { const p = info.opId[a], q = info.opId[b]; boven += `<path d="M${p.x} ${p.y}L${q.x} ${q.y}" class="zeelink" stroke-width="${n1(R * 0.035)}" stroke-dasharray="${n1(R * 0.08)} ${n1(R * 0.08)}"/>`; }
  for (const g of o.gevechten || []) {
    const r = info.opId[g.regio]; if (!r) continue; const k = R * 0.2;
    boven += `<g transform="translate(${n1(r.x + R * 0.48)} ${n1(r.y - R * 0.45)})" class="geenklik"><circle r="${n1(k * 1.25)}" fill="${g.open ? '#c0261c' : '#3c4a45'}" stroke="#fff" stroke-width="${n1(k * 0.2)}"/><path d="M${-k * 0.6} ${-k * 0.6}L${k * 0.6} ${k * 0.6}M${k * 0.6} ${-k * 0.6}L${-k * 0.6} ${k * 0.6}" stroke="#fff" stroke-width="${n1(k * 0.28)}" stroke-linecap="round"/></g>`;
  }
  for (const p of o.pijlen || []) {
    const b = info.opId[p.naar]; if (!b) continue;
    if (p.van && info.opId[p.van]) {
      const a = info.opId[p.van], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const x1 = a.x + ux * R * 0.3, y1 = a.y + uy * R * 0.3, x2 = b.x - ux * R * 0.42, y2 = b.y - uy * R * 0.42, k = R * 0.2;
      const kop = `${n1(x2 + ux * k)},${n1(y2 + uy * k)} ${n1(x2 - uy * k * 0.6)},${n1(y2 + ux * k * 0.6)} ${n1(x2 + uy * k * 0.6)},${n1(y2 - ux * k * 0.6)}`;
      boven += `<g class="geenklik"><path d="M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}" stroke="#14181c" stroke-width="${n1(R * 0.13)}" stroke-linecap="round"/><polygon points="${kop}" fill="#14181c" stroke="#14181c" stroke-width="${n1(R * 0.05)}" stroke-linejoin="round"/><path d="M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}" stroke="${kleur(p.fid)}" stroke-width="${n1(R * 0.07)}" stroke-linecap="round"/><polygon points="${kop}" fill="${kleur(p.fid)}"/></g>`;
    }
  }
  const perRegio = {};
  for (const m of (o.merktekens || [])) (perRegio[m.regio] = perRegio[m.regio] || []).push(m);
  for (const [rid, lijst] of Object.entries(perRegio)) {
    const r = info.opId[rid]; if (!r) continue; const bw = R * 0.36, bh = R * 0.22;
    lijst.forEach((m, i) => {
      const x = r.x - (lijst.length * bw + (lijst.length - 1) * 2) / 2 + i * (bw + 2), y = r.y + R * 0.5;
      boven += `<g class="geenklik"><rect x="${n1(x)}" y="${n1(y)}" width="${n1(bw)}" height="${n1(bh)}" rx="${n1(bh * 0.25)}" fill="#14181c" stroke="${kleur(m.fid)}" stroke-width="${n1(R * 0.035)}"/><text x="${n1(x + bw / 2)}" y="${n1(y + bh * 0.76)}" font-size="${n1(bh * 0.72)}" text-anchor="middle" fill="#fff" font-weight="700">${m.code}</text></g>`;
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(bb.x)} ${n1(bb.y)} ${n1(bb.w)} ${n1(bb.h)}" class="kaart${o.klein ? ' klein' : ''}${o.verf ? ' verfmodus' : ''}" role="img" aria-label="Campagnekaart ${esc(info.naam)}">
<defs><pattern id="arc" width="${n1(R * 0.16)}" height="${n1(R * 0.16)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${n1(R * 0.06)}" height="${n1(R * 0.16)}" fill="#14181c" fill-opacity="0.38"/></pattern></defs>
<rect x="${n1(bb.x)}" y="${n1(bb.y)}" width="${n1(bb.w)}" height="${n1(bb.h)}" class="zee"/>${geo && !o.verf ? `<path d="${geo.land}" class="land"/>` : ''}
<g stroke="#14181c" stroke-opacity="0.5" stroke-width="${n1(geo ? 1.6 : R * 0.022)}" stroke-linejoin="round">${cellen}</g>
<path d="${front}" fill="none" stroke="#14181c" stroke-width="${n1(geo ? 6 : R * 0.085)}" stroke-linecap="round" stroke-linejoin="round" class="geenklik"/>
<g class="geenklik">${labels}</g>${boven}</svg>`;
}
