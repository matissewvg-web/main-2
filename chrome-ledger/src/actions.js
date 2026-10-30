// Acties uitvoeren. Alle acties, kosten en effecten komen uit data/actions.json.
//
// Actie-velden: id, naam, ap, kost {stat: waarde}, schaal {stat: {kostStat: factor}},
// vereist [voorwaarden], effecten [effecttaal], max_per_beurt (optioneel).
// schaal: kost × (1 + factor × huidige waarde van stat), bv. duurder per vestiging.

import { maakRng } from './rng.js';
import { pasToe, voldaan, vind, zet } from './effects.js';
import { modsVan } from './state.js';
import { log, controleerEinde } from './turn.js';

export function actieKost(state, actie, mods) {
  const kost = {};
  for (const [stat, basis] of Object.entries(actie.kost || {})) {
    let f = 1;
    for (const [schaalStat, per] of Object.entries(actie.schaal || {})) f += (per[stat] || 0) * state.res[schaalStat];
    if (stat === 'geld') {
      f *= Math.max(0, 1 + (mods.actie_kost || 0));
      kost[stat] = Math.round((basis * f) / 100) * 100;
    } else {
      kost[stat] = Math.round(basis * f);
    }
  }
  return kost;
}

// { ok, reden, kost } — reden: 'fase' | 'ap' | 'max' | 'kost' | 'vereist'
export function controleer(state, data, actie, mods = modsVan(state, data)) {
  const kost = actieKost(state, actie, mods);
  if (state.fase !== 'acties') return { ok: false, reden: 'fase', kost };
  if (state.ap < (actie.ap ?? 1)) return { ok: false, reden: 'ap', kost };
  if (actie.max_per_beurt && (state.acties_deze_beurt[actie.id] || 0) >= actie.max_per_beurt) {
    return { ok: false, reden: 'max', kost };
  }
  for (const [stat, v] of Object.entries(kost)) {
    if (state.res[stat] < v) return { ok: false, reden: 'kost', stat, kost };
  }
  if (!voldaan(state, actie.vereist)) return { ok: false, reden: 'vereist', kost };
  return { ok: true, kost };
}

export function voerUit(state, data, id) {
  const actie = vind(data.actions, id);
  if (!actie) return null;
  const mods = modsVan(state, data);
  const c = controleer(state, data, actie, mods);
  if (!c.ok) return null;

  for (const [stat, v] of Object.entries(c.kost)) zet(state, stat, state.res[stat] - v);
  state.ap -= actie.ap ?? 1;
  state.acties_deze_beurt[id] = (state.acties_deze_beurt[id] || 0) + 1;

  const uit = pasToe(state, actie.effecten, { mods, rng: maakRng(state) });
  for (const [stat, v] of Object.entries(c.kost)) uit.wijzigingen[stat] = (uit.wijzigingen[stat] || 0) - v;

  state.laatsteActie = { id, ...uit };
  log(state, { soort: 'actie', titel: actie.naam, teksten: uit.teksten, wijzigingen: uit.wijzigingen });
  controleerEinde(state, data);
  return uit;
}
