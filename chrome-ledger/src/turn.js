// De beurtlus: rapport → acties (actiepunten) → event → volgende beurt.
//
// state.fase:
//   'acties'    speler gebruikt actiepunten
//   'event'     er ligt een event klaar, speler moet kiezen
//   'resultaat' gevolgen van de keuze worden getoond
//   'einde'     gewonnen of verloren

import { maakRng } from './rng.js';
import { pasToe, voldaan, vind, zet, bronnen } from './effects.js';
import { modsVan } from './state.js';

const LOG_MAX = 150;

export function log(state, item) {
  state.logboek.unshift({ beurt: state.beurt, jaar: state.jaar, deel: state.deel, ...item });
  if (state.logboek.length > LOG_MAX) state.logboek.length = LOG_MAX;
}

function datum(beurt, b) {
  const i = beurt - 1;
  return { jaar: b.startjaar + Math.floor(i / b.beurten_per_jaar), deel: (i % b.beurten_per_jaar) + 1 };
}

// Personeel dat nodig is om alle vestigingen op volle kracht te draaien.
export const personeelNodig = (state, data) =>
  data.balans.personeel_basis + state.res.omvang * data.balans.personeel_per_omvang;

// Verwacht bruto-inkomen bij de huidige stand (zonder events).
export function brutoInkomen(state, data, mods) {
  const b = data.balans;
  const r = state.res;
  const sector = vind(data.sectors, state.corp.sector);
  const nodig = personeelNodig(state, data);
  const bezetting = nodig > 0 ? Math.min(1, r.personeel / nodig) : 1;
  const basis = sector.basisinkomen + r.omvang * b.inkomen_per_omvang;
  const techF = 1 + r.tech * b.tech_inkomen * (1 + (mods.tech_inkomen || 0));
  const drukF = 1 - (r.druk * b.druk_inkomen) / 100;
  const modF = Math.max(0, 1 + (mods.inkomen || 0));
  return { bruto: Math.round(basis * techF * drukF * modF * bezetting), bezetting, nodig };
}

export function kosten(state, data, mods) {
  const b = data.balans;
  return {
    lonen: Math.round(state.res.personeel * b.loon * Math.max(0, 1 + (mods.personeel_kost || 0))),
    onderhoud: Math.round(state.res.omvang * b.onderhoud_per_omvang),
  };
}

// De kwartaalcijfers: inkomen, kosten, vaste posten, heat, invloed, druk, verloop.
function economie(state, data, mods, rng) {
  const b = data.balans;
  const r = state.res;
  const voor = { ...r };
  const meldingen = [];
  const posten = [];

  const { bruto, bezetting, nodig } = brutoInkomen(state, data, mods);
  const { lonen, onderhoud } = kosten(state, data, mods);
  posten.push({ sleutel: 'rapport.inkomsten', waarde: bruto });
  posten.push({ sleutel: 'rapport.lonen', waarde: -lonen });
  if (onderhoud) posten.push({ sleutel: 'rapport.onderhoud', waarde: -onderhoud });
  zet(state, 'geld', r.geld + bruto - lonen - onderhoud);
  if (bezetting < 1) meldingen.push({ soort: 'slecht', sleutel: 'melding.onderbezet', vars: { nodig, pct: Math.round(bezetting * 100) } });

  for (const bron of bronnen(state.corp, data)) {
    if (!bron.per_beurt?.length) continue;
    const uit = pasToe(state, bron.per_beurt, { mods, rng });
    if (uit.wijzigingen.geld) posten.push({ naam: bron.naam, waarde: uit.wijzigingen.geld });
  }

  const opwarming = r.omvang * b.heat_per_omvang * Math.max(0, 1 + (mods.heat_gain || 0));
  const afkoeling = b.heat_afkoeling + r.invloed * b.heat_afkoeling_per_invloed + (mods.afkoeling || 0);
  zet(state, 'heat', r.heat + opwarming - afkoeling);
  zet(state, 'invloed', r.invloed - b.invloed_verval);
  zet(state, 'druk', r.druk + (b.druk_groei + r.omvang * b.druk_groei_per_omvang) * Math.max(0, 1 + (mods.druk_groei || 0)));

  const kans = b.verloop * Math.max(0, 1 + (mods.verloop || 0));
  const verwacht = r.personeel * kans;
  const weg = Math.floor(verwacht) + (rng.next() < verwacht % 1 ? 1 : 0);
  if (weg > 0) {
    zet(state, 'personeel', r.personeel - weg);
    meldingen.push({ soort: 'info', sleutel: 'melding.verloop', vars: { aantal: weg } });
  }

  if (r.geld < 0) {
    state.schuld++;
    meldingen.push({ soort: 'slecht', sleutel: 'melding.schuld', vars: { over: b.schuld_beurten - state.schuld } });
  } else {
    state.schuld = 0;
  }
  if (r.heat >= b.heat_waarschuwing) meldingen.push({ soort: 'slecht', sleutel: 'melding.heat', vars: { max: b.heat_max } });

  const wijzigingen = {};
  for (const k of Object.keys(r)) {
    const d = Math.round((r[k] - voor[k]) * 10) / 10;
    if (d) wijzigingen[k] = d;
  }
  const netto = posten.reduce((a, p) => a + p.waarde, 0);
  return { posten, netto, wijzigingen, meldingen };
}

const WIN = {
  geld: (s, w) => s.res.geld >= w.doel,
  sandbox: () => false,
};

export function controleerEinde(state, data) {
  if (state.einde) return true;
  const b = data.balans;
  let einde = null;
  if (state.res.heat > b.heat_max) einde = { soort: 'verloren', reden: 'heat' };
  else if (state.schuld >= b.schuld_beurten) einde = { soort: 'verloren', reden: 'faillissement' };
  else {
    for (const w of data.winconditions) {
      if (w.actief && WIN[w.type]?.(state, w)) {
        einde = { soort: 'gewonnen', reden: w.id };
        break;
      }
    }
  }
  if (!einde) return false;
  state.einde = { ...einde, beurt: state.beurt, jaar: state.jaar, deel: state.deel };
  // Een getoond eventresultaat eerst laten lezen; sluitEvent zet daarna 'einde'.
  if (state.fase !== 'resultaat') state.fase = 'einde';
  return true;
}

function kiesEvent(state, data, mods, rng) {
  const b = data.balans;
  const klaar = state.wachtrij.findIndex((w) => w.beurt <= state.beurt);
  if (klaar >= 0) return state.wachtrij.splice(klaar, 1)[0].id;
  if (!rng.kans(b.eventkans)) return null;

  const toon = state.toon; // wereldtoon komt in Mijlpaal 2; null = alle tonen
  const kandidaten = data.events.filter((ev) => {
    if (ev.alleen_keten) return false;
    if (state.jaar < (ev.van ?? -Infinity) || state.jaar > (ev.tot ?? Infinity)) return false;
    if (toon && ev.toon && !ev.toon.includes(toon)) return false;
    const gezien = state.gezien[ev.id];
    if (gezien != null && (ev.uniek || state.beurt - gezien < (ev.cooldown ?? b.event_cooldown))) return false;
    return voldaan(state, ev.voorwaarde);
  });
  const ev = rng.gewogen(kandidaten, (e) =>
    (e.gewicht ?? 1) * (e.gewicht_mod ? Math.max(0, 1 + (mods[e.gewicht_mod] || 0)) : 1));
  return ev?.id ?? null;
}

export function eindigBeurt(state, data) {
  if (state.fase !== 'acties') return;
  const mods = modsVan(state, data);
  const rng = maakRng(state);
  const id = kiesEvent(state, data, mods, rng);
  // Een event waar geen enkele keuze mogelijk is, zou het spel vastzetten: overslaan.
  const ev = id && vind(data.events, id);
  if (!ev || !ev.keuzes.some((k) => voldaan(state, k.vereist))) {
    if (id) console.warn(`${id}: geen keuze mogelijk, overgeslagen`);
    return volgendeBeurt(state, data);
  }
  state.gezien[id] = state.beurt;
  state.event = { id, keuze: null, resultaat: null };
  state.fase = 'event';
}

export function kiesKeuze(state, data, index) {
  if (state.fase !== 'event') return;
  const ev = vind(data.events, state.event.id);
  const keuze = ev?.keuzes[index];
  if (!keuze || !voldaan(state, keuze.vereist)) return;
  const uit = pasToe(state, keuze.effecten, { mods: modsVan(state, data), rng: maakRng(state) });
  if (keuze.volgt) state.wachtrij.push({ id: keuze.volgt, beurt: state.beurt + (keuze.volgt_na ?? 1) });
  const teksten = [keuze.resultaat, ...uit.teksten].filter(Boolean);
  state.event.keuze = index;
  state.event.resultaat = { teksten, wijzigingen: uit.wijzigingen };
  state.fase = 'resultaat';
  log(state, { soort: 'event', titel: ev.titel, keuze: keuze.tekst, teksten, wijzigingen: uit.wijzigingen });
  controleerEinde(state, data);
}

export function sluitEvent(state, data) {
  if (state.fase !== 'resultaat') return;
  state.event = null;
  if (state.einde) {
    state.fase = 'einde';
    return;
  }
  volgendeBeurt(state, data);
}

function volgendeBeurt(state, data) {
  state.beurt++;
  Object.assign(state, datum(state.beurt, data.balans));
  const rapport = economie(state, data, modsVan(state, data), maakRng(state));
  state.rapport = { beurt: state.beurt, jaar: state.jaar, deel: state.deel, ...rapport };
  state.ap = data.balans.actiepunten;
  state.acties_deze_beurt = {};
  state.laatsteActie = null;
  state.fase = 'acties';
  log(state, { soort: 'rapport', netto: rapport.netto, wijzigingen: rapport.wijzigingen });
  controleerEinde(state, data);
}
