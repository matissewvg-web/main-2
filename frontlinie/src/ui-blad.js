// Het scenarioblad: scenario, briefing en tafelmap op één (printbare) pagina.
import { esc } from './ui-kaart.js';
import { tafelSvg, STUKKEN, TERREINSETS } from './tafel.js';
import { RULESETS } from './scenario.js';
import { TERREINEN } from './kaarten.js';
import { EENHEDEN, PERIODES } from './campagnes.js';

const lijst = (items, leeg) => (items.length ? `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>` : `<p class="stil">${leeg}</p>`);
const voordeelLijst = (v) => lijst(v.map((x) => `<b>${esc(x.bron)}.</b> ${esc(x.tekst)}`), 'Geen bijzondere voordelen.');

// meta: {oog, regio, A:{naam,kleur,id}, V:{naam,kleur,id}, periode, ingebed, acties}
export function scenarioBlad(scn, tm, meta) {
  const rs = RULESETS[scn.ruleset];
  const maat = tm.eenheid === 'cm' ? `${Math.round(tm.B * 2.54)} × ${Math.round(tm.H * 2.54)} cm` : `${Math.round(tm.B)} × ${Math.round(tm.H)}″ (${(tm.B / 12).toFixed(1).replace('.0', '')} × ${(tm.H / 12).toFixed(1).replace('.0', '')} ft)`;
  const tekort = tm.tekort.map((t) => `${esc(STUKKEN[t.type].naam)}: ${t.scenario ? 'het scenario vraagt' : 'de terreinset wil'} ${t.gewenst}, je hebt er ${t.heeft}`);
  const kant = (z, f, brief, win, voordelen) => `<div class="kant kant${z}"><h3><span class="stip" style="background:${f.kleur}"></span>${z === 'A' ? 'Aanvaller' : 'Verdediger'}: ${esc(f.naam)}</h3>
    <p class="brief">${esc(brief)}</p><h4>Zo win je</h4><p>${esc(win)}</p><h4>Voordelen</h4>${voordeelLijst(voordelen)}</div>`;
  const check = (f) => (f.id && EENHEDEN[meta.periode] && EENHEDEN[meta.periode][f.id] ? `<p><b>${esc(f.naam)}.</b> ${esc(EENHEDEN[meta.periode][f.id])}</p>` : '');
  const checks = check(meta.A) + (meta.V.id !== meta.A.id ? check(meta.V) : '');
  return `<article class="vel">
  <header class="velkop">
    <div><p class="oog">${esc(meta.oog)}</p><h2>${esc(scn.naam)}</h2><p class="doel">${esc(scn.doel)}</p></div>
    <dl class="feiten">
      <div><dt>Systeem</dt><dd>${esc(rs.naam)}</dd></div>
      <div><dt>Punten per kant</dt><dd>${scn.punten}${scn.klein ? ' (klein gevecht)' : ''}</dd></div>
      <div><dt>Beurten</dt><dd>${scn.beurten}</dd></div>
      <div><dt>Lijkt op</dt><dd>${esc(scn.analoog)}</dd></div>
      <div><dt>Seed</dt><dd class="mono">${esc(scn.seed)}</dd></div>
    </dl>
  </header>
  <div class="velgrid">
    <figure class="tafel">
      ${tafelSvg(tm)}
      <figcaption>Tafel ${maat}. ${esc(TERREINEN[tm.terrein] || '')}: ${esc((TERREINSETS[tm.terrein] || TERREINSETS.akkers).tekst)} Raster per ${tm.eenheid === 'cm' ? '30 cm' : '12″'}.</figcaption>
      ${tm.waarschuwingen.length ? `<div class="let">${lijst(tm.waarschuwingen.map(esc), '')}</div>` : ''}
      ${tekort.length ? `<details class="tekort"><summary>Voorraad te klein voor ${tekort.length} soort${tekort.length > 1 ? 'en' : ''} terrein</summary>${lijst(tekort, '')}<p class="stil">De map gebruikt alleen wat je hebt. Pas je voorraad aan onder Tafel.</p></details>` : ''}
      ${meta.acties || ''}
    </figure>
    <div class="veltekst">
      ${scn.verwijzing ? `<p class="verwijzing">${esc(scn.verwijzing)}</p>` : ''}
      <section><h3>Opstelling</h3><p>${esc(scn.opstellingTekst)}</p><p>${esc(scn.volgorde)}</p></section>
      <section><h3>Tijd en weer</h3><p class="chips"><span class="chip">${esc(scn.tijdNaam)}</span><span class="chip">${esc(scn.weerNaam)}</span><span class="chip">${esc({ normaal: 'vaste grond', sneeuw: 'sneeuw', modder: 'modder', droog: 'droog' }[scn.grond])}</span><span class="chip">${scn.luchtKan ? 'luchtsteun mogelijk' : 'geen luchtsteun'}</span></p>${lijst(scn.effecten.map(esc), 'Geen weereffecten.')}</section>
      <section><h3>Speciale regels</h3>${lijst(scn.regels.map(esc), 'Geen.')}</section>
      <section class="kanten">${kant('A', meta.A, scn.briefingA, scn.winA, scn.voordelenA)}${kant('V', meta.V, scn.briefingV, scn.winV, scn.voordelenV)}</section>
      <section><h3>Winst in ${esc(rs.naam)}</h3><p>${esc(scn.winst)}</p><p>${esc(scn.marge)}</p><p>${esc(scn.reserve)}</p></section>
      ${meta.A.leger || meta.V.leger ? `<section><h3>Legers op tafel</h3>${[meta.A, meta.V].filter((f) => f.leger).map((f) => `<p><b>${esc(f.naam)}.</b> ${esc(f.leger)}</p>`).join('')}</section>` : ''}
      ${checks ? `<section><h3>Periode-check: ${esc(PERIODES[meta.periode].naam)} (${PERIODES[meta.periode].jaren})</h3>${checks}</section>` : ''}
    </div>
  </div>
</article>`;
}
