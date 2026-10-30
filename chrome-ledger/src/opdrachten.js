// Opdrachten (data/opdrachten.json): doelen met een deadline, beloning en straf.
// Ze gebruiken dezelfde voorwaarde- en effecttaal als events.
//
// Extra in een doel:
//   { "stat": "tech", "plus": 10 }   → bij aanvaarden: huidige waarde + 10
//   { "district": { "context": true, ... } }   → het district van de opdracht
// "context": districtfilter om het district van de opdracht te kiezen.

import { pasToe, voldaan, vind } from './effects.js';
import { filterDistricten, statWaarde } from './districts.js';

const vul = (tekst, d) => (d ? tekst.replaceAll('{district}', d.naam) : tekst);

// Maakt een concrete opdracht uit een definitie, of null als er geen geschikt district is.
function maakOpdracht(def, state, rng) {
  let district = null;
  if (def.context) {
    const kandidaten = filterDistricten(state, def.context);
    if (!kandidaten.length) return null;
    district = kandidaten[rng.int(0, kandidaten.length - 1)].id;
  }
  const d = district != null ? state.kaart.districten[district] : null;
  return {
    id: def.id,
    titel: vul(def.titel, d),
    tekst: vul(def.tekst, d),
    opdrachtgever: def.opdrachtgever,
    district,
    termijn: def.termijn,
    verloopt: state.beurt + 2,
  };
}

// Bij aanvaarden worden relatieve doelen ('plus') vastgezet op de huidige stand.
function vastDoel(def, state, district) {
  return (def.doel || []).map((v) => {
    if (v.plus != null) return { stat: v.stat, min: Math.round((statWaarde(state, v.stat) + v.plus) * 10) / 10 };
    if (v.district?.context) {
      const { context, ...rest } = v.district;
      return { district: { ...rest, id: district } };
    }
    return v;
  });
}

export function biedAan(state, data, rng) {
  const b = data.balans;
  const o = state.opdrachten;
  o.aangeboden = o.aangeboden.filter((x) => x.verloopt > state.beurt);
  if (o.aangeboden.length >= b.opdrachten_aanbod || !rng.kans(b.opdracht_kans)) return;
  const bezig = new Set([...o.aangeboden, ...o.actief].map((x) => x.id));
  const kandidaten = data.opdrachten.filter((def) => !bezig.has(def.id)
    && (o.gezien[def.id] == null || state.beurt - o.gezien[def.id] >= b.opdracht_cooldown)
    && voldaan(state, def.voorwaarde));
  if (!kandidaten.length) return;
  const nieuw = maakOpdracht(kandidaten[rng.int(0, kandidaten.length - 1)], state, rng);
  if (nieuw) {
    o.aangeboden.push(nieuw);
    o.gezien[nieuw.id] = state.beurt;
  }
}

export function aanvaard(state, data, index) {
  const o = state.opdrachten;
  const x = o.aangeboden[index];
  if (!x || o.actief.length >= data.balans.opdrachten_max || state.fase !== 'acties') return false;
  const def = vind(data.opdrachten, x.id);
  o.aangeboden.splice(index, 1);
  o.actief.push({ ...x, doel: vastDoel(def, state, x.district), deadline: state.beurt + x.termijn });
  return true;
}

export function weiger(state, index) {
  if (state.fase !== 'acties') return;
  state.opdrachten.aangeboden.splice(index, 1);
}

export const doelBereikt = (state, x) => voldaan(state, x.doel);

// Aan het begin van een beurt: uitbetalen of afstraffen. Geeft meldingen en logregels terug.
export function controleerOpdrachten(state, data, ctx) {
  const o = state.opdrachten;
  const uitkomsten = [];
  o.actief = o.actief.filter((x) => {
    const def = vind(data.opdrachten, x.id);
    const gelukt = doelBereikt(state, x);
    if (!gelukt && state.beurt < x.deadline) return true;
    const uit = pasToe(state, gelukt ? def.beloning : def.straf, { ...ctx, district: x.district });
    if (gelukt) o.gelukt++; else o.mislukt++;
    uitkomsten.push({ x, gelukt, uit });
    return false;
  });
  return uitkomsten;
}
