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

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = await laadData(async (p) => JSON.parse(await readFile(path.join(root, p), 'utf8')));

const SPELLEN = Number(process.argv[2] || 300);
const BEURTEN = Number(process.argv[3] || 40);

function corpVoor(i, rng) {
  return {
    naam: `Sim ${i}`, slogan: '', kleur: '#f0f', accent: '#0ff', logo: { vorm: 'cirkel', symbool: '⚡' }, hq: 'haven',
    oprichter: data.archetypes[rng.int(0, data.archetypes.length - 1)].id,
    sector: data.sectors[rng.int(0, data.sectors.length - 1)].id,
    cultuur: Object.fromEntries(data.culture.map((a) => [a.id, rng.int(-3, 3)])),
    perks: ['oude_connecties'],
    gebreken: ['maffiaschuld'],
  };
}

const kan = (s, id) => controleer(s, data, vind(data.actions, id)).ok;

const STRATEGIEEN = {
  ...Object.fromEntries(data.actions.map((a) => [`spam:${a.id}`, (s) => (kan(s, a.id) ? a.id : null)])),
  willekeurig: (s, rng) => {
    const opties = data.actions.filter((a) => kan(s, a.id));
    return opties.length ? opties[rng.int(0, opties.length - 1)].id : null;
  },
  // Elke actie om de beurt, zonder na te denken.
  rotatie: (s) => {
    const volgorde = ['aanwerven', 'expanderen', 'onderzoek', 'lobbyen', 'sabotage'];
    for (let i = 0; i < volgorde.length; i++) {
      const id = volgorde[(s.beurt + (3 - s.ap) + i) % volgorde.length];
      if (kan(s, id)) return id;
    }
    return null;
  },
  gemengd: (s) => {
    const r = s.res;
    const wil = [];
    if (r.heat > 55) wil.push('lobbyen');
    if (r.personeel < personeelNodig(s, data)) wil.push('aanwerven');
    if (r.druk > 35 && r.heat < 45) wil.push('sabotage');
    if (r.invloed < 12) wil.push('lobbyen');
    if (r.heat < 50) wil.push('expanderen');
    wil.push('onderzoek', 'lobbyen');
    return wil.find((id) => kan(s, id)) ?? null;
  },
};

function speel(strategie, i) {
  const srng = maakRng({ rng: 1000 + i });
  const s = maakStaat(corpVoor(i, srng), data, `sim-${i}`);
  let netto20 = null;
  while (!s.einde && s.beurt <= BEURTEN) {
    if (s.fase === 'acties') {
      let id;
      while (s.ap > 0 && !s.einde && (id = strategie(s, srng))) voerUit(s, data, id);
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
const gem = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const fmt = (n) => n.toLocaleString('nl-BE').padStart(11);

console.log(`${SPELLEN} spellen × ${BEURTEN} beurten\n`);
console.log('strategie            leeft  heat  faill. gewon. (beurt)   gem.geld   netto/b20  omvang  tech');
for (const [naam, strat] of Object.entries(STRATEGIEEN)) {
  const res = Array.from({ length: SPELLEN }, (_, i) => speel(strat, i));
  const levend = res.filter((r) => !r.s.einde || r.s.einde.soort === 'gewonnen');
  const heat = res.filter((r) => r.s.einde?.reden === 'heat').length;
  const faill = res.filter((r) => r.s.einde?.reden === 'faillissement').length;
  const winst = res.filter((r) => r.s.einde?.soort === 'gewonnen');
  console.log(
    naam.padEnd(20),
    pct(levend.length, SPELLEN), pct(heat, SPELLEN), pct(faill, SPELLEN),
    pct(winst.length, SPELLEN), `(${winst.length ? gem(winst.map((r) => r.s.einde.beurt)) : '-'})`.padStart(7),
    fmt(gem(levend.map((r) => r.s.res.geld))),
    fmt(gem(levend.map((r) => r.netto20 ?? 0))),
    String(gem(levend.map((r) => r.s.res.omvang))).padStart(7),
    String(gem(levend.map((r) => r.s.res.tech))).padStart(5),
  );
}
