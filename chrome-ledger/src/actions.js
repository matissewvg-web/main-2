// Acties uitvoeren. Alle acties, kosten en effecten komen uit data/actions.json.
//
// Actie-velden: id, naam, ap, kost {stat: waarde}, schaal {stat: {kostStat: factor}},
// vereist [voorwaarden], effecten [effecttaal], max_per_beurt (optioneel),
// doel: 'bereikbaar' (district waar je zit of dat eraan grenst) | 'aanwezig' (je hebt er invloed)
//   | 'bouwplaats' (genoeg invloed + vrije slot) | 'eigen_gebouw' (het gekozen gebouw staat er),
// soort: 'bouwen' (kost en gebouw uit buildings.json) | 'verkopen' (gebouw weg, geld terug).
// schaal: kost × (1 + factor × huidige waarde van stat), bv. duurder per district waar je zit.
//
// opties bij uitvoeren: { district: id, gebouw: id }

import { maakRng } from './rng.js';
import { pasToe, voldaan, vind, zet } from './effects.js';
import { modsVan } from './state.js';
import { log, controleerEinde } from './turn.js';
import { statWaarde, bereikbaar, bouwProbleem, aanwezig } from './districts.js';

export function actieKost(state, actie, mods, gebouw = null) {
  const basisKost = { ...actie.kost };
  if (gebouw) basisKost.geld = (basisKost.geld || 0) + gebouw.kost * Math.max(0, 1 + (mods.bouw_kost || 0));
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

// Wat een verkoop opbrengt.
export const verkoopPrijs = (data, gebouw) => Math.round((gebouw.kost * data.balans.verkoop_factor) / 100) * 100;

// { ok, reden, kost } — reden: 'fase' | 'ap' | 'max' | 'geen_doel' | 'onbereikbaar' | 'niet_aanwezig'
//   | 'geen_gebouw' | 'geen_eigen_gebouw' | 'te_weinig_invloed' | 'vol' | 'verkeerd_type' | 'max_gebouw'
//   | 'kost' | 'vereist'
export function controleer(state, data, actie, mods = modsVan(state, data), opties = {}) {
  const gekozen = actie.soort ? vind(data.buildings, opties.gebouw) : null;
  const kost = actieKost(state, actie, mods, actie.soort === 'bouwen' ? gekozen : null);
  const nee = (reden, extra) => ({ ok: false, reden, kost, ...extra });
  if (state.fase !== 'acties') return nee('fase');
  if (state.ap < (actie.ap ?? 1)) return nee('ap');
  if (actie.max_per_beurt && (state.acties_deze_beurt[actie.id] || 0) >= actie.max_per_beurt) return nee('max');
  if (actie.doel) {
    const d = state.kaart.districten[opties.district];
    if (!d) return nee('geen_doel');
    if (actie.doel === 'bereikbaar' && !bereikbaar(state.kaart, d)) return nee('onbereikbaar');
    if (actie.doel === 'aanwezig' && !aanwezig(d)) return nee('niet_aanwezig');
    if (actie.soort && !gekozen) return nee(actie.soort === 'verkopen' ? 'geen_eigen_gebouw' : 'geen_gebouw');
    if (actie.soort === 'bouwen') {
      const probleem = bouwProbleem(d, gekozen, data.balans);
      if (probleem) return nee(probleem);
    }
    if (actie.soort === 'verkopen' && !d.gebouwen.some((g) => g.type === gekozen.id)) return nee('geen_eigen_gebouw');
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
  const gebouw = actie.soort ? vind(data.buildings, opties.gebouw) : null;
  if (actie.soort === 'bouwen') d.gebouwen.push({ type: gebouw.id });
  if (actie.soort === 'verkopen') {
    d.gebouwen.splice(d.gebouwen.findIndex((g) => g.type === gebouw.id), 1);
    zet(state, 'geld', state.res.geld + verkoopPrijs(data, gebouw));
  }

  const uit = pasToe(state, actie.effecten, { mods, rng: maakRng(state), district: d?.id, balans: data.balans });
  for (const [stat, v] of Object.entries(c.kost)) uit.wijzigingen[stat] = (uit.wijzigingen[stat] || 0) - v;
  if (actie.soort === 'verkopen') {
    uit.wijzigingen.geld = (uit.wijzigingen.geld || 0) + verkoopPrijs(data, gebouw);
    uit.districten.push({ id: d.id, naam: d.naam, stat: 'gebouwen', delta: -1 });
  }
  if (actie.soort === 'bouwen') uit.districten.push({ id: d.id, naam: d.naam, stat: 'gebouwen', delta: 1 });

  const titel = [actie.naam, gebouw?.naam, d?.naam].filter(Boolean).join(' · ');
  state.laatsteActie = { id, titel, ...uit };
  log(state, { soort: 'actie', titel, teksten: uit.teksten, wijzigingen: uit.wijzigingen, districten: uit.districten });
  controleerEinde(state, data);
  return uit;
}
