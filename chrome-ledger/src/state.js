// Eén state-object: de enige bron van waarheid. Alles wat het spel moet
// onthouden zit hierin, zodat opslaan gewoon JSON.stringify(state) is.

import { seedNaarGetal, maakRng } from './rng.js';
import { bronnen, pasToe, berekenMods } from './effects.js';

export const VERSIE = 1;

let huidige = null;

export const staat = () => huidige;
export const zetStaat = (s) => { huidige = s; };

export function maakStaat(corp, data, seed) {
  const b = data.balans;
  const s = {
    versie: VERSIE,
    seed: String(seed),
    rng: seedNaarGetal(seed),
    beurt: 1,
    jaar: b.startjaar,
    deel: 1,
    corp: structuredClone(corp),
    res: { ...b.start },
    ap: b.actiepunten,
    schuld: 0,
    vlaggen: {},
    gezien: {},
    wachtrij: [],
    acties_deze_beurt: {},
    fase: 'acties',
    event: null,
    rapport: null,
    laatsteActie: null,
    logboek: [],
    einde: null,
  };
  // Startbonussen zijn vaste waarden: zonder gain-modifiers.
  const rng = maakRng(s);
  for (const bron of bronnen(corp, data)) pasToe(s, bron.start, { rng });
  s.rapport = { beurt: 1, jaar: s.jaar, deel: 1, welkom: true, posten: [], wijzigingen: {}, meldingen: [] };
  return s;
}

export const modsVan = (state, data) => berekenMods(state.corp, data);
