// Eén state-object: de enige bron van waarheid. Alles wat het spel moet
// onthouden zit hierin, zodat opslaan gewoon JSON.stringify(state) is.

import { seedNaarGetal, maakRng } from './rng.js';
import { bronnen, pasToe, berekenMods, vind } from './effects.js';
import { zetAandeel } from './districts.js';

// 3 = verdiepingsupdate (bedrijfsvorm, markt, opdrachten). Oudere saves laden niet meer.
export const VERSIE = 3;

let huidige = null;

export const staat = () => huidige;
export const zetStaat = (s) => { huidige = s; };

// kaart: uit genereerKaart (eventueel met hernoemde districten). corp.hq = district-id.
// wereld: { toon: 'alle' | 'grimmig' | ..., moeilijkheid: id }
export function maakStaat(corp, data, kaart, wereld = {}) {
  const b = data.balans;
  const s = {
    versie: VERSIE,
    seed: kaart.seed,
    rng: seedNaarGetal(kaart.seed),
    beurt: 1,
    jaar: b.startjaar,
    deel: 1,
    corp: structuredClone(corp),
    wereld: { toon: wereld.toon ?? 'alle', moeilijkheid: wereld.moeilijkheid ?? 'normaal' },
    res: { ...b.start },
    kaart: structuredClone(kaart),
    markt: { fase: data.markt.start, resterend: 4 },
    opdrachten: { aangeboden: [], actief: [], gezien: {}, gelukt: 0, mislukt: 0 },
    nieuws: [],
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
  const extra = [vind(data.moeilijkheid, s.wereld.moeilijkheid)].filter(Boolean);
  for (const bron of [...bronnen(corp, data), ...extra]) pasToe(s, bron.start, { rng, district: corp.hq, balans: b });
  s.rapport = { beurt: 1, jaar: s.jaar, deel: 1, welkom: true, posten: [], wijzigingen: {}, meldingen: [] };
  return s;
}

// Alle modifiers samen: corpo-keuzes, moeilijkheid en de huidige marktfase.
export function modsVan(state, data) {
  const mods = berekenMods(state.corp, data);
  const extra = [
    vind(data.moeilijkheid, state.wereld?.moeilijkheid)?.mods,
    vind(data.markt.fasen, state.markt?.fase)?.mods,
  ];
  for (const m of extra) {
    for (const [k, v] of Object.entries(m || {})) mods[k] = Math.round(((mods[k] || 0) + v) * 1000) / 1000;
  }
  return mods;
}
