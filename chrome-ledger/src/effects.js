// De effect-interpreter (plan 2.5). Dit is de enige plek waar de effecttaal
// uit events, acties, perks en gebreken wordt uitgevoerd.
//
// Effect-vormen:
//   { "stat": "geld", "op": "add" | "mul" | "set", "waarde": 5 | { "min": 1, "max": 4 } }
//   { "kans": 0.6, "kans_mod": "kans.sabotage", "dan": [...], "anders": [...],
//     "dan_tekst": "...", "anders_tekst": "..." }
//   { "vlag": "naam", "op": "set" | "wis", "waarde": true }
//   { "tekst": "..." }
//   { "district": ..., ... }   (vanaf Mijlpaal 2; nu overgeslagen)
//
// Voorwaarde-vormen (allemaal moeten kloppen):
//   { "stat": "heat", "min": 40, "max": 90 }   { "vlag": "naam", "is": true }
//   { "beurt_min": 4 }   { "sector": "media" }   { "oprichter": "hacker" }
//   { "perk": "id" }   { "gebrek": "id" }   { "district_type": ... } (Mijlpaal 2)

// Positieve wijzigingen van deze stats worden geschaald met een modifier.
const GAIN_MOD = { heat: 'heat_gain', invloed: 'invloed_gain', tech: 'tech_gain' };

// Ondergrens/bovengrens per stat, uit balans.json ("grenzen"; null = onbegrensd).
let grenzen = {};
export function stelGrenzenIn(g = {}) {
  grenzen = Object.fromEntries(Object.entries(g).map(([k, [lo, hi]]) => [k, [lo ?? -Infinity, hi ?? Infinity]]));
}
const GEHEEL = new Set(['geld', 'personeel', 'omvang']);

let districtGemeld = false;

export const vind = (lijst, id) => lijst.find((x) => x.id === id);

const klem = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Alles wat een corpo bij creatie koos, als lijst bronnen met start/per_beurt/mods.
export function bronnen(corp, data) {
  return [
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
  state.res[stat] = GEHEEL.has(stat) ? Math.round(waarde) : Math.round(waarde * 10) / 10;
}

// Voert een lijst effecten uit. Geeft { wijzigingen: {stat: delta}, teksten: [] } terug.
export function pasToe(state, effecten, { mods = {}, rng }) {
  const uit = { wijzigingen: {}, teksten: [] };
  voer(state, effecten || [], mods, rng, uit);
  return uit;
}

function voer(state, lijst, mods, rng, uit) {
  for (const e of lijst) {
    if ('kans' in e) {
      const p = klem(e.kans + (e.kans_mod ? mods[e.kans_mod] || 0 : 0), 0.05, 0.95);
      const gelukt = rng.next() < p;
      const tekst = gelukt ? e.dan_tekst : e.anders_tekst;
      if (tekst) uit.teksten.push(tekst);
      voer(state, (gelukt ? e.dan : e.anders) || [], mods, rng, uit);
    } else if ('district' in e || 'district_type' in e) {
      if (!districtGemeld) console.warn('District-effecten werken pas vanaf Mijlpaal 2; overgeslagen.', e);
      districtGemeld = true;
    } else if ('vlag' in e) {
      if (e.op === 'wis') delete state.vlaggen[e.vlag];
      else state.vlaggen[e.vlag] = e.waarde ?? true;
    } else if ('stat' in e) {
      wijzigStat(state, e, mods, rng, uit);
    } else if ('tekst' in e) {
      uit.teksten.push(e.tekst);
    } else {
      console.warn('Onbekend effect', e);
    }
  }
}

function wijzigStat(state, e, mods, rng, uit) {
  if (!(e.stat in state.res)) {
    console.warn(`Onbekende stat: ${e.stat}`);
    return;
  }
  let v = typeof e.waarde === 'object' ? rng.int(e.waarde.min, e.waarde.max) : e.waarde;
  const oud = state.res[e.stat];
  let nieuw;
  switch (e.op ?? 'add') {
    case 'add':
      if (v > 0 && GAIN_MOD[e.stat]) v *= Math.max(0, 1 + (mods[GAIN_MOD[e.stat]] || 0));
      nieuw = oud + v;
      break;
    case 'mul':
      nieuw = oud * v;
      break;
    case 'set':
      nieuw = v;
      break;
    default:
      console.warn(`Onbekende op: ${e.op}`);
      return;
  }
  zet(state, e.stat, nieuw);
  const delta = state.res[e.stat] - oud;
  if (delta !== 0) uit.wijzigingen[e.stat] = Math.round(((uit.wijzigingen[e.stat] || 0) + delta) * 10) / 10;
}

export function voldaan(state, voorwaarden = []) {
  return voorwaarden.every((v) => {
    if ('district_type' in v || 'district' in v) return false; // Mijlpaal 2
    if ('stat' in v) {
      const w = state.res[v.stat];
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

// De eerste voorwaarde die niet klopt (voor uitleg in de UI), of null.
export function eersteOnvoldaan(state, voorwaarden = []) {
  return voorwaarden.find((v) => !voldaan(state, [v])) || null;
}
