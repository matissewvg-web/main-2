// De beurtlus: rapport → acties (actiepunten) → event → volgende beurt.
//
// state.fase:
//   'acties'    speler gebruikt actiepunten
//   'event'     er ligt een event klaar, speler moet kiezen
//   'resultaat' gevolgen van de keuze worden getoond
//   'einde'     gewonnen of verloren

import { maakRng } from './rng.js';
import { pasToe, voldaan, vind, zet, bronnen, eventDistrict } from './effects.js';
import { modsVan } from './state.js';
import { marktBeurt, nieuwsBeurt } from './markt.js';
import { controleerOpdrachten, biedAan } from './opdrachten.js';
import {
  alleGebouwen, gebouwInkomen, marktInkomen, controleert, aandeel, zetAandeel,
} from './districts.js';

const LOG_MAX = 150;

export function log(state, item) {
  state.logboek.unshift({ beurt: state.beurt, jaar: state.jaar, deel: state.deel, ...item });
  if (state.logboek.length > LOG_MAX) state.logboek.length = LOG_MAX;
}

function datum(beurt, b) {
  const i = beurt - 1;
  return { jaar: b.startjaar + Math.floor(i / b.beurten_per_jaar), deel: (i % b.beurten_per_jaar) + 1 };
}

// Personeel dat nodig is om alle gebouwen op volle kracht te draaien.
export function personeelNodig(state, data) {
  let n = data.balans.personeel_basis;
  for (const { def } of alleGebouwen(state, data)) n += def.personeel;
  return n;
}

// Verwacht bruto-inkomen bij de huidige stand (zonder events), opgesplitst per bron.
export function brutoInkomen(state, data, mods) {
  const b = data.balans;
  const r = state.res;
  const sector = vind(data.sectors, state.corp.sector);
  const nodig = personeelNodig(state, data);
  const bezetting = nodig > 0 ? Math.min(1, r.personeel / nodig) : 1;
  let markt = 0;
  let gebouwen = 0;
  for (const d of state.kaart.districten) markt += marktInkomen(d, b, mods);
  for (const { d, def } of alleGebouwen(state, data)) gebouwen += gebouwInkomen(def, d, b, mods);
  const techF = 1 + r.tech * b.tech_inkomen * (1 + (mods.tech_inkomen || 0));
  const drukF = 1 - (r.druk * b.druk_inkomen) / 100;
  const modF = Math.max(0, 1 + (mods.inkomen || 0));
  const f = techF * drukF * modF * bezetting;
  const delen = {
    basis: Math.round(sector.basisinkomen * f),
    markt: Math.round(markt * f),
    gebouwen: Math.round(gebouwen * f),
  };
  return { ...delen, bruto: delen.basis + delen.markt + delen.gebouwen, bezetting, nodig };
}

export function kosten(state, data, mods) {
  const b = data.balans;
  let onderhoud = 0;
  for (const { def } of alleGebouwen(state, data)) onderhoud += def.onderhoud;
  return {
    lonen: Math.round(state.res.personeel * b.loon * Math.max(0, 1 + (mods.personeel_kost || 0))),
    onderhoud,
  };
}

// Districten leven verder: loyaliteit en criminaliteit zakken terug naar hun basis,
// lokale heat koelt af, en jouw invloed volgt de loyaliteit.
function districtBeurt(state, data) {
  const b = data.balans;
  const r1 = (v) => Math.round(v * 10) / 10;
  for (const d of state.kaart.districten) {
    for (const s of ['loyaliteit', 'criminaliteit']) d.stats[s] = r1(d.stats[s] + (d.basis[s] - d.stats[s]) * b.district_drift);
    d.stats.heat = r1(d.stats.heat * (1 - b.district_heat_verval));
    const a = aandeel(d);
    if (a > 0) zetAandeel(d, a + (d.stats.loyaliteit - 50) * b.loyaliteit_invloed - b.district_invloed_verval);
  }
}

// De kwartaalcijfers: inkomen, kosten, vaste posten, gebouwen, districten, heat, druk, verloop.
function economie(state, data, mods, rng) {
  const b = data.balans;
  const r = state.res;
  const voor = { ...r };
  const meldingen = [];
  const posten = [];
  const ds = state.kaart.districten;
  const controleVoor = ds.map(controleert);
  const aantalGebouwen = ds.reduce((a, d) => a + d.gebouwen.length, 0);

  const ink = brutoInkomen(state, data, mods);
  const { lonen, onderhoud } = kosten(state, data, mods);
  posten.push({ sleutel: 'rapport.basis', waarde: ink.basis });
  if (ink.markt) posten.push({ sleutel: 'rapport.markt', waarde: ink.markt });
  if (ink.gebouwen) posten.push({ sleutel: 'rapport.gebouwen', waarde: ink.gebouwen });
  posten.push({ sleutel: 'rapport.lonen', waarde: -lonen });
  if (onderhoud) posten.push({ sleutel: 'rapport.onderhoud', waarde: -onderhoud });
  zet(state, 'geld', r.geld + ink.bruto - lonen - onderhoud);
  if (ink.bezetting < 1) {
    meldingen.push({ soort: 'slecht', sleutel: 'melding.onderbezet', vars: { nodig: ink.nodig, pct: Math.round(ink.bezetting * 100) } });
  }

  for (const bron of bronnen(state.corp, data)) {
    if (!bron.per_beurt?.length) continue;
    const uit = pasToe(state, bron.per_beurt, { mods, rng, balans: b });
    if (uit.wijzigingen.geld) posten.push({ naam: bron.naam, waarde: uit.wijzigingen.geld });
  }

  let opwarming = 0;
  for (const { d, def } of alleGebouwen(state, data)) {
    opwarming += def.heat ?? b.heat_per_gebouw;
    if (def.per_beurt?.length) pasToe(state, def.per_beurt, { mods, rng, district: d.id, balans: b });
  }
  districtBeurt(state, data);

  opwarming *= Math.max(0, 1 + (mods.heat_gain || 0));
  const afkoeling = b.heat_afkoeling + r.invloed * b.heat_afkoeling_per_invloed + (mods.afkoeling || 0);
  zet(state, 'heat', r.heat + opwarming - afkoeling);
  zet(state, 'invloed', r.invloed - b.invloed_verval);
  zet(state, 'druk', r.druk + (b.druk_groei + aantalGebouwen * b.druk_groei_per_gebouw) * Math.max(0, 1 + (mods.druk_groei || 0)));

  ds.forEach((d, i) => {
    const nu = controleert(d);
    if (nu && !controleVoor[i]) meldingen.push({ soort: 'goed', sleutel: 'melding.controle_gewonnen', vars: { naam: d.naam } });
    if (!nu && controleVoor[i]) meldingen.push({ soort: 'slecht', sleutel: 'melding.controle_verloren', vars: { naam: d.naam } });
  });

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

// '{district}' in eventteksten → naam van het district waar het event over gaat.
export function vulIn(tekst, state) {
  if (!tekst) return tekst;
  const d = state.event?.district != null ? state.kaart.districten[state.event.district] : null;
  return d ? tekst.replaceAll('{district}', d.naam) : tekst.replaceAll('{district}', '?');
}

// → { id, district } of null. Een keten-event houdt het district van zijn voorganger.
function kiesEvent(state, data, mods, rng) {
  const b = data.balans;
  const klaar = state.wachtrij.findIndex((w) => w.beurt <= state.beurt);
  if (klaar >= 0) {
    const w = state.wachtrij.splice(klaar, 1)[0];
    return { id: w.id, district: w.district ?? null };
  }
  if (!rng.kans(b.eventkans)) return null;

  const toon = state.wereld.toon === 'alle' ? null : state.wereld.toon;
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
  return ev ? { id: ev.id, district: eventDistrict(state, ev.voorwaarde) } : null;
}

export function eindigBeurt(state, data) {
  if (state.fase !== 'acties') return;
  const mods = modsVan(state, data);
  const rng = maakRng(state);
  const gekozen = kiesEvent(state, data, mods, rng);
  // Een event waar geen enkele keuze mogelijk is, zou het spel vastzetten: overslaan.
  const ev = gekozen && vind(data.events, gekozen.id);
  if (!ev || !ev.keuzes.some((k) => voldaan(state, k.vereist))) {
    if (gekozen) console.warn(`${gekozen.id}: geen keuze mogelijk, overgeslagen`);
    return volgendeBeurt(state, data);
  }
  state.gezien[ev.id] = state.beurt;
  state.event = { id: ev.id, district: gekozen.district, keuze: null, resultaat: null };
  state.fase = 'event';
}

export function kiesKeuze(state, data, index) {
  if (state.fase !== 'event') return;
  const ev = vind(data.events, state.event.id);
  const keuze = ev?.keuzes[index];
  if (!keuze || !voldaan(state, keuze.vereist)) return;
  const uit = pasToe(state, keuze.effecten, {
    mods: modsVan(state, data), rng: maakRng(state), district: state.event.district, balans: data.balans,
  });
  if (keuze.volgt) {
    state.wachtrij.push({ id: keuze.volgt, beurt: state.beurt + (keuze.volgt_na ?? 1), district: state.event.district });
  }
  const teksten = [keuze.resultaat, ...uit.teksten].filter(Boolean).map((tk) => vulIn(tk, state));
  state.event.keuze = index;
  state.event.resultaat = { teksten, wijzigingen: uit.wijzigingen, districten: uit.districten };
  state.fase = 'resultaat';
  log(state, {
    soort: 'event', titel: vulIn(ev.titel, state), keuze: vulIn(keuze.tekst, state),
    teksten, wijzigingen: uit.wijzigingen, districten: uit.districten,
  });
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
  const mods = modsVan(state, data);
  const rng = maakRng(state);
  const rapport = economie(state, data, mods, rng);

  // De stad beweegt: marktcyclus, opdrachten, nieuws.
  const nieuweFase = marktBeurt(state, data, rng);
  if (nieuweFase) rapport.meldingen.unshift({ soort: nieuweFase.toon, sleutel: 'melding.markt', vars: { naam: nieuweFase.naam } });
  for (const { x, gelukt, uit } of controleerOpdrachten(state, data, { mods, rng, balans: data.balans })) {
    rapport.meldingen.push({ soort: gelukt ? 'goed' : 'slecht', sleutel: gelukt ? 'melding.opdracht_gelukt' : 'melding.opdracht_mislukt', vars: { titel: x.titel } });
    log(state, { soort: 'opdracht', titel: x.titel, teksten: [], wijzigingen: uit.wijzigingen, districten: uit.districten, gelukt });
  }
  biedAan(state, data, rng);
  nieuwsBeurt(state, data, rng, nieuweFase);
  state.rapport = { beurt: state.beurt, jaar: state.jaar, deel: state.deel, ...rapport };
  state.ap = data.balans.actiepunten;
  state.acties_deze_beurt = {};
  state.laatsteActie = null;
  state.fase = 'acties';
  log(state, { soort: 'rapport', netto: rapport.netto, wijzigingen: rapport.wijzigingen });
  controleerEinde(state, data);
}
