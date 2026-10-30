// De effect-interpreter (plan 2.5). Dit is de enige plek waar de effecttaal
// uit events, acties, gebouwen, perks en gebreken wordt uitgevoerd.
//
// Effect-vormen:
//   { "stat": "geld", "op": "add" | "mul" | "set", "waarde": 5 | { "min": 1, "max": 4 } }
//   { "district": "doel" | "hier" | "context" | "hq" | "alle" | "aanwezig" | "controle" | "Haven",
//     "stat": "loyaliteit" | "invloed" | ..., "op": ..., "waarde": ... }
//       "invloed" in een district = jouw aandeel in procent.
//   { "district": "context", "gebouw": "verwijder" }   (sloopt één willekeurig gebouw)
//   { "kans": 0.6, "kans_mod": "kans.sabotage", "dan": [...], "anders": [...],
//     "dan_tekst": "...", "anders_tekst": "..." }
//   { "vlag": "naam", "op": "set" | "wis", "waarde": true }
//   { "tekst": "..." }
//
// Voorwaarde-vormen (allemaal moeten kloppen):
//   { "stat": "heat", "min": 40, "max": 90 }   (ook: gebouwen, districten, controle, stad)
//   { "vlag": "naam", "is": true }   { "beurt_min": 4 }
//   { "sector": "media" }   { "oprichter": "hacker" }   { "perk": "id" }   { "gebrek": "id" }
//   { "district_type": "Haven", "controle": true }
//   { "district": { "type": "slums", "controle": bool, "aanwezig": bool, "bereikbaar": bool,
//                   "stat": "criminaliteit", "min": 60 } }

import {
  zoekDistricten, filterDistricten, alsDistrictFilter, districtWaarde, zetAandeel, statWaarde,
} from './districts.js';

// Positieve wijzigingen van deze stats worden geschaald met een modifier.
const GAIN_MOD = { heat: 'heat_gain', invloed: 'invloed_gain', tech: 'tech_gain' };

// Ondergrens/bovengrens per stat, uit balans.json ("grenzen"; null = onbegrensd).
let grenzen = {};
export function stelGrenzenIn(g = {}) {
  grenzen = Object.fromEntries(Object.entries(g).map(([k, [lo, hi]]) => [k, [lo ?? -Infinity, hi ?? Infinity]]));
}
const GEHEEL = new Set(['geld', 'personeel']);

export const vind = (lijst, id) => lijst.find((x) => x.id === id);

const klem = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

// Alles wat een corpo bij creatie koos, als lijst bronnen met start/per_beurt/mods.
export function bronnen(corp, data) {
  return [
    vind(data.bedrijfsvormen, corp.vorm),
    vind(data.archetypes, corp.oprichter),
    vind(data.sectors, corp.sector),
    ...corp.perks.map((id) => vind(data.perks, id)),
    ...corp.gebreken.map((id) => vind(data.flaws, id)),
  ].filter(Boolean);
}

// Telt alle passieve modifiers op: oprichter, sector, perks, gebreken en cultuur.
export function berekenMods(corp, data) {
  const mods = {};
  const tel = (m, factor = 1) => {
    for (const [k, v] of Object.entries(m || {})) mods[k] = (mods[k] || 0) + v * factor;
  };
  for (const bron of bronnen(corp, data)) tel(bron.mods);
  for (const as of data.culture) tel(as.per_punt, corp.cultuur[as.id] || 0);
  for (const k of Object.keys(mods)) {
    mods[k] = Math.round(mods[k] * 1000) / 1000;
    if (mods[k] === 0) delete mods[k];
  }
  return mods;
}

export function zet(state, stat, waarde) {
  const [lo, hi] = grenzen[stat] || [-Infinity, Infinity];
  waarde = klem(waarde, lo, hi);
  state.res[stat] = GEHEEL.has(stat) ? Math.round(waarde) : r1(waarde);
}

// Voert een lijst effecten uit.
// ctx: { mods, rng, district (id voor doel/hier/context), balans }
// Geeft { wijzigingen: {stat: delta}, districten: [{id, naam, stat, delta}], teksten: [] } terug.
export function pasToe(state, effecten, ctx) {
  const uit = { wijzigingen: {}, districten: [], teksten: [] };
  voer(state, effecten || [], { mods: {}, ...ctx }, uit);
  return uit;
}

function voer(state, lijst, ctx, uit) {
  for (const e of lijst) {
    if ('kans' in e) {
      const p = klem(e.kans + (e.kans_mod ? ctx.mods[e.kans_mod] || 0 : 0), 0.05, 0.95);
      const gelukt = ctx.rng.next() < p;
      const tekst = gelukt ? e.dan_tekst : e.anders_tekst;
      if (tekst) uit.teksten.push(tekst);
      voer(state, (gelukt ? e.dan : e.anders) || [], ctx, uit);
    } else if ('district' in e || 'district_type' in e) {
      for (const d of zoekDistricten(state, e.district ?? e.district_type, ctx.district)) {
        if (e.gebouw === 'verwijder') sloop(d, ctx, uit);
        else wijzigDistrict(d, e, ctx, uit);
      }
    } else if ('vlag' in e) {
      if (e.op === 'wis') delete state.vlaggen[e.vlag];
      else state.vlaggen[e.vlag] = e.waarde ?? true;
    } else if ('stat' in e) {
      wijzigStat(state, e, ctx, uit);
    } else if ('tekst' in e) {
      uit.teksten.push(e.tekst);
    } else {
      console.warn('Onbekend effect', e);
    }
  }
}

const waardeVan = (e, rng) => (typeof e.waarde === 'object' ? rng.int(e.waarde.min, e.waarde.max) : e.waarde);

function nieuweWaarde(oud, e, v) {
  switch (e.op ?? 'add') {
    case 'add': return oud + v;
    case 'mul': return oud * v;
    case 'set': return v;
    default:
      console.warn(`Onbekende op: ${e.op}`);
      return oud;
  }
}

function wijzigStat(state, e, { mods, rng }, uit) {
  if (!(e.stat in state.res)) {
    console.warn(`Onbekende stat: ${e.stat}`);
    return;
  }
  let v = waardeVan(e, rng);
  if ((e.op ?? 'add') === 'add' && v > 0 && GAIN_MOD[e.stat]) v *= Math.max(0, 1 + (mods[GAIN_MOD[e.stat]] || 0));
  const oud = state.res[e.stat];
  zet(state, e.stat, nieuweWaarde(oud, e, v));
  const delta = state.res[e.stat] - oud;
  if (delta !== 0) uit.wijzigingen[e.stat] = r1((uit.wijzigingen[e.stat] || 0) + delta);
}

function registreer(uit, d, stat, delta) {
  const bestaand = uit.districten.find((x) => x.id === d.id && x.stat === stat);
  if (bestaand) bestaand.delta = r1(bestaand.delta + delta);
  else uit.districten.push({ id: d.id, naam: d.naam, stat, delta });
}

function sloop(d, { rng }, uit) {
  if (!d.gebouwen.length) return;
  d.gebouwen.splice(rng.int(0, d.gebouwen.length - 1), 1);
  registreer(uit, d, 'gebouwen', -1);
}

function wijzigDistrict(d, e, { rng, balans, mods }, uit) {
  if (e.stat !== 'invloed' && !(e.stat in d.stats)) {
    console.warn(`Onbekende districtstat: ${e.stat}`);
    return;
  }
  let v = waardeVan(e, rng);
  const oud = districtWaarde(d, e.stat);
  if (e.stat === 'invloed') {
    // Veel politie remt nieuwe invloed af.
    if ((e.op ?? 'add') === 'add' && v > 0 && balans) {
      v *= Math.max(0.2, 1 - d.stats.politie * balans.politie_weerstand) * Math.max(0, 1 + (mods.expansie_kracht || 0));
    }
    zetAandeel(d, nieuweWaarde(oud, e, v));
  } else {
    d.stats[e.stat] = r1(klem(nieuweWaarde(oud, e, v), e.stat === 'bevolking' ? 1 : 0, 100));
  }
  const delta = r1(districtWaarde(d, e.stat) - oud);
  if (delta) registreer(uit, d, e.stat, delta);
}

export function voldaan(state, voorwaarden = []) {
  return voorwaarden.every((v) => {
    const filter = alsDistrictFilter(v);
    if (filter) return filterDistricten(state, filter).length > 0;
    if ('stat' in v) {
      const w = statWaarde(state, v.stat);
      return w != null && (v.min == null || w >= v.min) && (v.max == null || w <= v.max);
    }
    if ('vlag' in v) return !!state.vlaggen[v.vlag] === (v.is ?? true);
    if ('beurt_min' in v) return state.beurt >= v.beurt_min;
    if ('sector' in v) return state.corp.sector === v.sector;
    if ('oprichter' in v) return state.corp.oprichter === v.oprichter;
    if ('perk' in v) return state.corp.perks.includes(v.perk);
    if ('gebrek' in v) return state.corp.gebreken.includes(v.gebrek);
    console.warn('Onbekende voorwaarde', v);
    return false;
  });
}

// Het district waar een event over gaat: het best passende district van de eerste districtvoorwaarde.
export function eventDistrict(state, voorwaarden = []) {
  for (const v of voorwaarden) {
    const filter = alsDistrictFilter(v);
    if (filter) return filterDistricten(state, filter)[0]?.id ?? null;
  }
  return null;
}

// De eerste voorwaarde die niet klopt (voor uitleg in de UI), of null.
export function eersteOnvoldaan(state, voorwaarden = []) {
  return voorwaarden.find((v) => !voldaan(state, [v])) || null;
}
