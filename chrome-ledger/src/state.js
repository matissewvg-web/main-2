// Eén state-object: de enige bron van waarheid. Alles wat het spel moet
// onthouden zit hierin, zodat opslaan gewoon JSON.stringify(state) is.

import { seedNaarGetal, maakRng } from './rng.js';
import { bronnen, pasToe, berekenMods } from './effects.js';
import { zetAandeel } from './districts.js';

// 2 = Mijlpaal 2 (kaart en districten). Saves van Mijlpaal 1 laden niet meer.
export const VERSIE = 2;

let huidige = null;

export const staat = () => huidige;
export const zetStaat = (s) => { huidige = s; };

// kaart: uit genereerKaart (eventueel met hernoemde districten). corp.hq = district-id.
export function maakStaat(corp, data, kaart) {
  const b = data.balans;
  const s = {
    versie: VERSIE,
    seed: kaart.seed,
    rng: seedNaarGetal(kaart.seed),
    beurt: 1,
    jaar: b.startjaar,
    deel: 1,
    corp: structuredClone(corp),
    res: { ...b.start },
    kaart: structuredClone(kaart),
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
  const hq = s.kaart.districten[corp.hq];
  zetAandeel(hq, b.hq_invloed);
  hq.stats.loyaliteit = Math.max(hq.stats.loyaliteit, b.hq_loyaliteit);
  hq.basis.loyaliteit = Math.max(hq.basis.loyaliteit, b.hq_loyaliteit);

  // Startbonussen zijn vaste waarden: zonder gain-modifiers.
  const rng = maakRng(s);
  for (const bron of bronnen(corp, data)) pasToe(s, bron.start, { rng, district: corp.hq, balans: b });
  s.rapport = { beurt: 1, jaar: s.jaar, deel: 1, welkom: true, posten: [], wijzigingen: {}, meldingen: [] };
  return s;
}

export const modsVan = (state, data) => berekenMods(state.corp, data);
