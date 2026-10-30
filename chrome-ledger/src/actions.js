// Acties uitvoeren. Alle acties, kosten en effecten komen uit data/actions.json.
//
// Actie-velden: id, naam, ap, kost {stat: waarde}, schaal {stat: {kostStat: factor}},
// vereist [voorwaarden], effecten [effecttaal], max_per_beurt (optioneel),
// doel: 'bereikbaar' (district waar je zit of dat eraan grenst) | 'bouwplaats' (genoeg invloed + vrije slot),
// soort: 'bouwen' (kost en gebouw komen uit buildings.json).
// schaal: kost × (1 + factor × huidige waarde van stat), bv. duurder per district waar je zit.
//
// opties bij uitvoeren: { district: id, gebouw: id }

import { maakRng } from './rng.js';
import { pasToe, voldaan, vind, zet } from './effects.js';
import { modsVan } from './state.js';
import { log, controleerEinde } from './turn.js';
import { statWaarde, bereikbaar, bouwProbleem } from './districts.js';

export function actieKost(state, actie, mods, gebouw = null) {
  const basisKost = { ...actie.kost };
  if (gebouw) basisKost.geld = (basisKost.geld || 0) + gebouw.kost;
  const kost = {};
  for (const [stat, basis] of Object.entries(basisKost)) {
    let f = 1;
    for (const [schaalStat, per] of Object.entries(actie.schaal || {})) f += (per[stat] || 0) * statWaarde(state, schaalStat);
    if (stat === 'geld') {
      f *= Math.max(0, 1 + (mods.actie_kost || 0));
      kost[stat] = Math.round((basis * f) / 100) * 100;
    } else {
      kost[stat] = Math.round(basis * f);
    }
  }
  return kost;
}

// { ok, reden, kost } — reden: 'fase' | 'ap' | 'max' | 'geen_doel' | 'onbereikbaar' | 'geen_gebouw'
//   | 'te_weinig_invloed' | 'vol' | 'verkeerd_type' | 'max_gebouw' | 'kost' | 'vereist'
export function controleer(state, data, actie, mods = modsVan(state, data), opties = {}) {
  const gebouw = actie.soort === 'bouwen' ? vind(data.buildings, opties.gebouw) : null;
  const kost = actieKost(state, actie, mods, gebouw);
  const nee = (reden, extra) => ({ ok: false, reden, kost, ...extra });
  if (state.fase !== 'acties') return nee('fase');
  if (state.ap < (actie.ap ?? 1)) return nee('ap');
  if (actie.max_per_beurt && (state.acties_deze_beurt[actie.id] || 0) >= actie.max_per_beurt) return nee('max');
  if (actie.doel) {
    const d = state.kaart.districten[opties.district];
    if (!d) return nee('geen_doel');
    if (actie.doel === 'bereikbaar' && !bereikbaar(state.kaart, d)) return nee('onbereikbaar');
    if (actie.soort === 'bouwen') {
      if (!gebouw) return nee('geen_gebouw');
      const probleem = bouwProbleem(d, gebouw, data.balans);
      if (probleem) return nee(probleem);
    }
  }
  for (const [stat, v] of Object.entries(kost)) {
    if (state.res[stat] < v) return nee('kost', { stat });
  }
  if (!voldaan(state, actie.vereist)) return nee('vereist');
  return { ok: true, kost };
}

export function voerUit(state, data, id, opties = {}) {
  const actie = vind(data.actions, id);
  if (!actie) return null;
  const mods = modsVan(state, data);
  const c = controleer(state, data, actie, mods, opties);
  if (!c.ok) return null;

  for (const [stat, v] of Object.entries(c.kost)) zet(state, stat, state.res[stat] - v);
  state.ap -= actie.ap ?? 1;
  state.acties_deze_beurt[id] = (state.acties_deze_beurt[id] || 0) + 1;

  const d = actie.doel ? state.kaart.districten[opties.district] : null;
  const gebouw = actie.soort === 'bouwen' ? vind(data.buildings, opties.gebouw) : null;
  if (gebouw) d.gebouwen.push({ type: gebouw.id });

  const uit = pasToe(state, actie.effecten, { mods, rng: maakRng(state), district: d?.id, balans: data.balans });
  for (const [stat, v] of Object.entries(c.kost)) uit.wijzigingen[stat] = (uit.wijzigingen[stat] || 0) - v;

  const titel = [actie.naam, gebouw?.naam, d?.naam].filter(Boolean).join(' · ');
  state.laatsteActie = { id, titel, ...uit };
  log(state, { soort: 'actie', titel, teksten: uit.teksten, wijzigingen: uit.wijzigingen, districten: uit.districten });
  controleerEinde(state, data);
  return uit;
}
