// Balans-simulator: speelt honderden spellen zonder UI met vaste strategieën.
// Gebruik: node tools/sim.mjs [spellen=300] [beurten=40]
//
// Doel (stopregel Mijlpaal 1): geen enkele "spam één actie"-strategie mag
// structureel beter zijn dan een gemengde strategie.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { laadData } from '../src/data.js';
import { maakStaat } from '../src/state.js';
import { maakRng } from '../src/rng.js';
import { voerUit, controleer } from '../src/actions.js';
import { eindigBeurt, kiesKeuze, sluitEvent, personeelNodig } from '../src/turn.js';
import { voldaan, vind } from '../src/effects.js';
import { genereerKaart } from '../src/map.js';
import { aandeel, bereikbaar, gebouwInkomen, afgeleid } from '../src/districts.js';
import { aanvaard } from '../src/opdrachten.js';
import { modsVan } from '../src/state.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = await laadData(async (p) => JSON.parse(await readFile(path.join(root, p), 'utf8')));
const b = data.balans;

const SPELLEN = Number(process.argv[2] || 300);
const BEURTEN = Number(process.argv[3] || 40);

function corpVoor(i, rng, kaart) {
  return {
    naam: `Sim ${i}`, slogan: '', kleur: '#f0f', accent: '#0ff', logo: { vorm: 'cirkel', symbool: '⚡' },
    hq: rng.int(0, kaart.districten.length - 1),
    vorm: data.bedrijfsvormen[rng.int(0, data.bedrijfsvormen.length - 1)].id,
    oprichter: data.archetypes[rng.int(0, data.archetypes.length - 1)].id,
    sector: data.sectors[rng.int(0, data.sectors.length - 1)].id,
    cultuur: Object.fromEntries(data.culture.map((a) => [a.id, rng.int(-3, 3)])),
    perks: ['oude_connecties'],
    gebreken: ['maffiaschuld'],
  };
}

const kan = (s, id, opties) => controleer(s, data, vind(data.actions, id), undefined, opties).ok;
const waarde = (d) => d.stats.bevolking * d.stats.rijkdom;

// Beste district om uit te breiden: waardevol, nog niet stevig in handen.
function expandDoel(s) {
  const kandidaten = s.kaart.districten
    .filter((d) => bereikbaar(s.kaart, d) && aandeel(d) < 70)
    .sort((a, c) => (waarde(c) * (aandeel(c) > 0 ? 1.5 : 1) * (100 - c.stats.politie)) - (waarde(a) * (aandeel(a) > 0 ? 1.5 : 1) * (100 - a.stats.politie)));
  return kandidaten.find((d) => kan(s, 'expanderen', { district: d.id }))?.id;
}

// Beste district voor een andere districtactie: waardevol waar je kan, of de minst loyale wijk waar je zit.
function districtDoel(s, id) {
  const actie = vind(data.actions, id);
  const ds = [...s.kaart.districten];
  if (actie.doel === 'aanwezig') ds.sort((a, c) => (id === 'orde' ? c.stats.criminaliteit - a.stats.criminaliteit : a.stats.loyaliteit - c.stats.loyaliteit));
  else ds.sort((a, c) => waarde(c) - waarde(a));
  return ds.find((d) => kan(s, id, { district: d.id }))?.id;
}

// Beste gebouw (netto per beurt) op een bouwplaats die kan.
function bouwKeuze(s) {
  let beste = null;
  const mods = modsVan(s, data);
  for (const d of s.kaart.districten) {
    for (const g of data.buildings) {
      if (!kan(s, 'bouwen', { district: d.id, gebouw: g.id })) continue;
      const netto = gebouwInkomen(g, d, b, mods) - g.onderhoud - g.personeel * b.loon;
      if (!beste || netto > beste.netto) beste = { netto, opties: { district: d.id, gebouw: g.id } };
    }
  }
  return beste;
}

const metDoel = (id, s) => {
  if (id === 'expanderen') {
    const d = expandDoel(s);
    return d == null ? null : [id, { district: d }];
  }
  if (id === 'bouwen') {
    const k = bouwKeuze(s);
    return k ? [id, k.opties] : null;
  }
  if (id === 'verkopen') return null;
  if (vind(data.actions, id).doel) {
    const d = districtDoel(s, id);
    return d == null ? null : [id, { district: d }];
  }
  return kan(s, id) ? [id, {}] : null;
};

const STRATEGIEEN = {
  ...Object.fromEntries(data.actions.map((a) => [`spam:${a.id}`, (s) => metDoel(a.id, s)])),
  willekeurig: (s, rng) => {
    const opties = data.actions.map((a) => metDoel(a.id, s)).filter(Boolean);
    return opties.length ? opties[rng.int(0, opties.length - 1)] : null;
  },
  // Elke actie om de beurt, zonder na te denken.
  rotatie: (s) => {
    const ids = data.actions.map((a) => a.id);
    for (let i = 0; i < ids.length; i++) {
      const k = metDoel(ids[(s.beurt + (3 - s.ap) + i) % ids.length], s);
      if (k) return k;
    }
    return null;
  },
  gemengd: (s) => {
    const r = s.res;
    const wil = [];
    if (r.heat > 70) wil.push('witwassen');
    if (r.heat > 55) wil.push('lobbyen');
    if (s.kaart.districten.some((d) => aandeel(d) > 0 && d.stats.loyaliteit < 40)) wil.push('pr');
    if (r.personeel < personeelNodig(s, data)) wil.push('aanwerven');
    if (r.druk > 35 && r.heat < 45) wil.push('sabotage');
    if (r.invloed < 12) wil.push('lobbyen');
    const bouw = bouwKeuze(s);
    if (bouw && bouw.netto > 0 && r.geld > 30000) wil.push('bouwen');
    if (r.heat < 50) wil.push('expanderen');
    wil.push('onderzoek', 'lobbyen');
    for (const id of wil) {
      const k = metDoel(id, s);
      if (k) return k;
    }
    return null;
  },
  // Zelfde, maar eerst uitbreiden en pas daarna bouwen.
  expansie: (s) => {
    const r = s.res;
    const wil = [];
    if (r.heat > 55) wil.push('lobbyen');
    if (r.personeel < personeelNodig(s, data)) wil.push('aanwerven');
    if (r.invloed < 12) wil.push('lobbyen');
    if (r.heat < 50) wil.push('expanderen');
    const bouw = bouwKeuze(s);
    if (bouw && bouw.netto > 0 && r.geld > 30000) wil.push('bouwen');
    if (r.druk > 35 && r.heat < 45) wil.push('sabotage');
    wil.push('onderzoek', 'lobbyen');
    for (const id of wil) {
      const k = metDoel(id, s);
      if (k) return k;
    }
    return null;
  },
};

function speel(strategie, i) {
  const srng = maakRng({ rng: 1000 + i });
  const kaart = genereerKaart(`sim-${i}`, [8, 12, 16][i % 3], data);
  const s = maakStaat(corpVoor(i, srng, kaart), data, kaart);
  let netto20 = null;
  while (!s.einde && s.beurt <= BEURTEN) {
    if (s.fase === 'acties') {
      while (s.opdrachten.aangeboden.length && aanvaard(s, data, 0));
      let k;
      while (s.ap > 0 && !s.einde && (k = strategie(s, srng))) {
        if (!voerUit(s, data, k[0], k[1])) break;
      }
      if (!s.einde) eindigBeurt(s, data);
    } else if (s.fase === 'event') {
      const ev = vind(data.events, s.event.id);
      const opties = ev.keuzes.map((k, idx) => [k, idx]).filter(([k]) => voldaan(s, k.vereist));
      kiesKeuze(s, data, opties[srng.int(0, opties.length - 1)][1]);
    } else if (s.fase === 'resultaat') {
      sluitEvent(s, data);
    }
    if (s.beurt === 20 && netto20 == null && s.rapport) netto20 = s.rapport.netto;
  }
  return { s, netto20 };
}

const pct = (n, d) => `${Math.round((100 * n) / d)}%`.padStart(5);
const gem = (xs) => (xs.length ? Math.round(xs.reduce((a, c) => a + c, 0) / xs.length) : 0);
const fmt = (n) => n.toLocaleString('nl-BE').padStart(11);

console.log(`${SPELLEN} spellen × ${BEURTEN} beurten\n`);
console.log('strategie            leeft  heat  faill. gewon. (beurt)   gem.geld   netto/b20  gebouw distr. contr.  stad%');
for (const [naam, strat] of Object.entries(STRATEGIEEN)) {
  const res = Array.from({ length: SPELLEN }, (_, i) => speel(strat, i));
  const levend = res.filter((r) => !r.s.einde || r.s.einde.soort === 'gewonnen');
  const heat = res.filter((r) => r.s.einde?.reden === 'heat').length;
  const faill = res.filter((r) => r.s.einde?.reden === 'faillissement').length;
  const winst = res.filter((r) => r.s.einde?.soort === 'gewonnen');
  const af = levend.map((r) => afgeleid(r.s));
  console.log(
    naam.padEnd(20),
    pct(levend.length, SPELLEN), pct(heat, SPELLEN), pct(faill, SPELLEN),
    pct(winst.length, SPELLEN), `(${winst.length ? gem(winst.map((r) => r.s.einde.beurt)) : '-'})`.padStart(7),
    fmt(gem(levend.map((r) => r.s.res.geld))),
    fmt(gem(levend.map((r) => r.netto20 ?? 0))),
    String(gem(af.map((a) => a.gebouwen))).padStart(7),
    String(gem(af.map((a) => a.districten))).padStart(6),
    String(gem(af.map((a) => a.controle))).padStart(6),
    String(gem(af.map((a) => a.stad))).padStart(6),
  );
}
