// Chrome Ledger: engine, opslag en acties. Geladen na world-data.js en voor het scherm.
"use strict";
/* =====================================================================
   CHROME LEDGER — engine (JavaScript-versie van tools/sim.py + world.py)
   Bedragen in M€. De engine gooit alle dobbelstenen; de GM (Claude)
   beoordeelt alleen kosten en kansen, vóór de worp.
   ===================================================================== */
const DIFF = {Casual: 0.8, Realistisch: 1.0, Genadeloos: 1.15};
const DT = {
  "Biotech": {rev: 9, cost: 6, heat: 1, vol: 0.35},
  "Cyberware": {rev: 11, cost: 7, heat: 2, vol: 0.40},
  "Logistiek": {rev: 7, cost: 4, heat: 0, vol: 0.15},
  "Media & Data": {rev: 8, cost: 4, heat: 1, vol: 0.30},
  "Private Security": {rev: 8, cost: 5, heat: 2, vol: 0.20},
  "Financieel": {rev: 10, cost: 5, heat: 1, vol: 0.45},
  "Smokkel": {rev: 14, cost: 4, heat: 4, vol: 0.50},
  "Weapon Manufacturing": {rev: 12, cost: 7, heat: 3, vol: 0.35}, /* 6.10: standaard: wapens, pantser, drones, tanks; zware producten alleen via contracten */
};
const SECTORS = Object.keys(DT);
let RNG = Math.random; /* 5.7: tijdens het maken van een wereld een vast zaad */
const R = () => RNG(), U = (a, b) => a + R() * (b - a), RI = (a, b) => a + Math.floor(R() * (b - a + 1));
const CH = a => a[Math.floor(R() * a.length)];
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const r1 = x => Math.round(x * 10) / 10;
const ym = s => `${s.date.year}-${String(s.date.month).padStart(2, "0")}`;
const hex8 = () => Math.floor(R() * 0xffffffff).toString(16).padStart(8, "0");
const clone = o => JSON.parse(JSON.stringify(o));
function d100(){ try { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % 100); } catch(e){ return RI(1, 100); } }

function template(){
  return {
    setup_done: false, status: "actief", date: {year: 2004, month: 1},
    player: {corp_name: "", title: "CEO", motto: "", background: "", doctrine: "", difficulty: "Realistisch", home_district: ""},
    cash: 100, debt: 0, interest_rate: 0.08, heat: 5, reputation: 30, morale: 60,
    staff: {count: 20, avg_salary: 30},
    culture: {slogans: [], layoff_policy: "normal", bonus_cost: 0, morale_drift: 0, heat_decay: 2, ethics_rules: []},
    divisions: [], projects: [],
    districts: [
      {id: "A", name: "Haven", control: "neutral", income: 6, upkeep: 2, lore: "Docks, smokkel, vakbonden. Goedkope logistiek."},
      {id: "B", name: "Staal", control: "neutral", income: 7, upkeep: 3, lore: "Fabrieken, veel arbeid, lage lonen."},
      {id: "C", name: "Glas", control: "neutral", income: 10, upkeep: 6, lore: "Corpotorens. Prestige, dure grond."},
      {id: "D", name: "Oude Stad", control: "neutral", income: 5, upkeep: 2, lore: "Politie, bank, bureaucratie. Vergunningen en krediet."},
      {id: "E", name: "De Kruising", control: "neutral", income: 8, upkeep: 3, lore: "Transitknoop. Alles komt hier langs."},
      {id: "F", name: "Neon Mile", control: "neutral", income: 8, upkeep: 4, lore: "Media, nachtleven, vice."},
      {id: "G", name: "Roest", control: "neutral", income: 3, upkeep: 1, lore: "Sloppen, zwarte markt, goedkope rekruten."},
      {id: "H", name: "Campus", control: "neutral", income: 6, upkeep: 3, lore: "Universiteit en labs. Onderzoek en talent."},
    ],
    rivals: [
      {name: "Okonkwo-Brandt Holdings", ceo: "Adaeze Brandt", cash: 400, aggression: 0.4, memory: [], hq: "C", sector: "Financieel"},
      {name: "Vanderhoeven Logistics", ceo: "Pieter Vanderhoeven", cash: 250, aggression: 0.3, memory: [], hq: "A", sector: "Logistiek"},
      {name: "Saito Neurosystems", ceo: "Haruki Saito", cash: 500, aggression: 0.6, memory: [], hq: "H", sector: "Cyberware"},
    ],
    npcs: [
      {name: "Marta Delcourt", role: "CFO", loyalty: 70, ambition: 55, secret: "Houdt een tweede set boeken bij 'voor de zekerheid'."},
      {name: "Jorik Maes", role: "Head of Security", loyalty: 60, ambition: 40, secret: "Heeft een schuld bij Brigada Volk."},
      {name: "Lien Verstraeten", role: "PR", loyalty: 50, ambition: 75, secret: "Lekt af en toe aan een journalist."},
    ],
    flags: {compensatie_473: true, eigen_475: true, overname_477: true, herstel_wm_479: true, herstel_wm_4710: true, overname_herstel_478: true}, autoStandaard: {keuring: true}, /* 5.4.1: nieuwe spellen laten nieuwe producten vanzelf officieel keuren */
  };
}

/* 3.6: foutlog, zodat vangnetten geen echte fouten meer verbergen */
function foutLog(waar, e){
  const f = {t: new Date().toISOString().slice(0, 16).replace("T", " "), waar, fout: String((e && e.message) || e).slice(0, 200)};
  G.fouten = [f, ...(G.fouten || [])].slice(0, 30);
  try { console.warn("[Chrome Ledger]", waar, e); localStorage.setItem("cl_fouten", JSON.stringify(G.fouten)); } catch(_){}
  return f;
}
/* 3.6: de wereldkaart komt altijd uit WORLD_DATA; ze hoeft niet in elke save (was 75% van de grootte) */
const pak = s => s && s.map && s.map.kind === "wereld" && s.map.versie === 2 && s.map.frame ? {...s, map: {kind: "wereld", versie: 2, gedeeld: true}} : s;
function migrate(s){
  if (s.flags && !s.flags.armor_611 && (s.producten || []).some(p => p.id === "peb221407")){ /* 6.11.1: op verzoek, na de update midden in een lancering: armorpakket terug, Directe Verkoop weer aan het publiek */
    const dv = s.producten.find(p => p.id === "peb221407"); if (dv.schaal === "vlag") dv.schaal = "groot";
    const d = (s.divisions || []).find(x => x.type === "Weapon Manufacturing" || /weapon manufacturing/i.test(x.name || "")) || (s.divisions || [])[0];
    if (d && !s.producten.some(p => /armor ?pakket/i.test(p.naam)) && typeof mkProduct === "function"){ const p = mkProduct(s, d, "Pax Armata Armor Pakket", 3, 55);
      Object.assign(p, {aard: "wapen", schaal: "groot", keuring: "ok", prijs: "standaard", trait: null, stuk: {eenheid: "armorpakketten", enkel: "armorpakket", prijs: 4800},
        doelgroep: "Legers, politie, particuliere beveiligingsbedrijven en wie liever niet geraakt wordt",
        pitch: "Alles om heelhuids thuis te komen, in één pakket: kogelwerende vesten (plaat en zacht), helmen met nachtzicht-rail, militaire uniformen, handschoenen en knie- en elleboogbescherming. Eén keer betalen, geen abonnement. Uit onze eigen fabriek."});
      try { maakReview(p); } catch(e){} s.producten.push(p); }
    s.flags.armor_611 = true; (s.log ??= []).push(`${s.date ? s.date.year + "-" + String(s.date.month).padStart(2, "0") : ""} · Pax Armata Armor Pakket op de markt (body armor, helmen, uniformen; geen abonnement) en Directe Verkoop weer aan het publiek`); }
  if (s.custom_types){ const wm = Object.keys(s.custom_types).find(k => /^weapon\s*manufactur/i.test(k)); /* 6.10: eigen soort Weapon manufacturing wordt de standaardsoort */
    if (wm && wm !== "Weapon Manufacturing"){ const N = "Weapon Manufacturing";
      for (const d of s.divisions || []) if (d.type === wm) d.type = N; for (const p of s.producten || []) if (p.type === wm) p.type = N;
      if (s.market && s.market[wm]){ s.market[N] ??= s.market[wm]; delete s.market[wm]; } if (s.sectoren && s.sectoren[wm]){ s.sectoren[N] ??= s.sectoren[wm]; delete s.sectoren[wm]; }
      if (s.player && typeof s.player.doctrine === "string") s.player.doctrine = s.player.doctrine.split(" + ").map(x => x === wm ? N : x).join(" + ");
      delete s.custom_types[wm]; (s.log ??= []).push(`${s.date ? s.date.year + "-" + String(s.date.month).padStart(2, "0") : ""} · Weapon manufacturing is nu een standaardsoort (Weapon Manufacturing)`); } }
  if (s.map && s.map.gedeeld) s.map = genWorld().map;
  if (Array.isArray(s.rivals)) for (const r of s.rivals) if (r && r.name && !r.karakter) r.karakter = Object.keys(RIVAAL_KARAKTER)[hashN(r.name, 0) % 6]; /* 5.8.1: oude saves krijgen een karakterlabel (zonder de cijfers te veranderen) */
  if (!(s.flags || {}).compensatie_473 && s.flags && s.date){ s.cash = r1((s.cash || 0) + 100); if (s.accounts) s.accounts.operationeel = s.cash; s.flags.compensatie_473 = true; (s.log ??= []).push(`${ym(s)} · Compensatie: +€100M omdat facturen en gebeurtenissen te duur waren (4.7.3)`); } /* 4.7.3: eenmalig €100M terug in bestaande saves */
  if (!(s.flags || {}).eigen_475 && s.producten && s.flags){ for (const p of s.producten){ p.delen = [0, 1, 2].map(i => ({kwal: ((p.delen || [])[i] || {}).kwal || "standaard", eigen: true})); } s.flags.eigen_475 = true; } /* 4.7.5: eenmalig alles naar eigen productie */
  if (s.flags && !s.flags.overname_477){ /* 4.7.7: overnamebod weg; een verloren divisie komt terug met haar producten */
    s.arcs = (s.arcs || []).filter(a => a.id !== "hostile_bid"); delete s.flags.wacht_op_speler_hostile_bid;
    const namen = new Set((s.divisions || []).map(d => d.name || d.type)), wees = {};
    for (const p of s.producten || []) if (p.divisie && !namen.has(p.divisie)) (wees[p.divisie] ??= []).push(p);
    for (const [naam, ps] of Object.entries(wees)){ const n = ps.filter(p => p.status !== "teruggeroepen").length; (s.divisions ??= []).push({name: naam, type: ps[0].type, level: Math.max(2, n - 2), efficiency: 1}); (s.log ??= []).push(`${ym(s)} · ${naam} terug na de geschrapte overname (${n} producten)`); }
    if (s.flags.overgenomen){ delete s.flags.overgenomen; if (/OVERGENOMEN/.test(s.status || "")) s.status = "actief"; }
    s.flags.overname_477 = true; }
  if (s.flags && s.flags.herstel_wm_479 && !s.flags.herstel_wm_4710){ /* 4.7.10: de speler bouwt de wapenlijn zelf: teruggezette producten weg, niveau 6, €60M en 5 gratis ontwikkelingen */
    const T = ["Wapens", "Sniper", "Armor", "Drones", "Tanks", "Mechs", "Vliegtuigen"], d = (s.divisions || []).find(x => /weapon manufacturing/i.test(x.name || x.type));
    s.producten = (s.producten || []).filter(p => !(d && p.divisie === (d.name || d.type) && T.includes(p.naam))); if (d) d.level = Math.max(d.level || 1, 6);
    s.cash = r1((s.cash || 0) + 60); if (s.accounts) s.accounts.operationeel = s.cash; s.gratisDev = (s.gratisDev || 0) + 5;
    (s.log ??= []).push(`${ym(s)} · Weapon manufacturing naar niveau 6, +€60M en 5 gratis productontwikkelingen`); s.flags.herstel_wm_4710 = true; }
  if (s.flags && !s.flags.herstel_wm_479 && (s.hostile_bid || {}).uitslag === "verloren" && s.divisions && !s.divisions.some(d => /weapon manufacturing/i.test(d.name || d.type))){ /* 4.7.9: verloren wapendivisie van de speler terug */
    s.custom_types ??= {}; let type = Object.keys(s.custom_types).find(k => /weapon/i.test(k)); if (!type && typeof addCustomType === "function"){ const r = addCustomType(s, "Weapon manufacturing", PRESETS.gebalanceerd, "Wapens, voertuigen en drones"); if (r.ok) type = r.naam; }
    const d = {name: "Weapon manufacturing", type: type || "Private Security", level: 5, efficiency: 1}; s.divisions.push(d);
    const L = [["Wapens", "klein", null], ["Sniper", "groot", ["sniperrifles", "sniperrifle", 12000]], ["Armor", "groot", ["pantsersets", "pantserset", 3500]], ["Drones", "groot", ["gevechtsdrones", "gevechtsdrone", 45000]],
      ["Tanks", "vlag", null], ["Mechs", "vlag", ["mechs", "mech", 12000000, true]], ["Vliegtuigen", "vlag", ["gevechtsvliegtuigen", "gevechtsvliegtuig", 35000000, true]]];
    for (const [naam, sc, st] of L){ const p = mkProduct(s, d, naam, 3, 55); Object.assign(p, {aard: "wapen", schaal: sc, keuring: "ok", prijs: "standaard", trait: null, kanaal: "groothandel"}); if (st) p.stuk = {eenheid: st[0], enkel: st[1], prijs: st[2], order: !!st[3]}; try { maakReview(p); } catch(e){} (s.producten ??= []).push(p); }
    (s.log ??= []).push(`${ym(s)} · Weapon manufacturing terug met 7 producten (overname geschrapt)`); s.flags.herstel_wm_479 = true; }
  if (!(s.flags || {}).keur_471 && s.producten){ for (const p of s.producten) if (p.keuring != null && p.keuring !== "ok"){ p.keuring = "ok"; ((s.vergunning ??= {})[p.aard || aardVan(p.type, p.naam)] = true); } (s.flags ??= {}).keur_471 = true; } /* 4.7.1: eenmalig alles gekeurd in bestaande saves */
  s.accounts ??= {operationeel: s.cash, zwart: 0, offshore: 0};
  s.accounts.zwart ??= 0; s.accounts.offshore ??= 0;
  s.invoices ??= []; s.auto_pay ??= true; s.arcs ??= []; s.hidden_truth ??= [];
  s.lopende_effecten ??= []; s.projects ??= []; s.divisions ??= []; s.flags ??= {};
  s.log ??= []; s.worpen ??= []; s.history ??= []; s.custom_types ??= {};
  s.factions ??= {
    nomaden: {standing: 0, note: "Clans buiten de snelweg. Respect, geen vriendschap."},
    vakbond: {standing: 0, note: "Haven/Staal. Onderhandelt hard, staakt sneller."},
    politie: {standing: 0, note: "Oude Stad. Koopbaar, maar de prijs stijgt."},
    stad: {standing: 0, note: "Gemeenteraad. Vergunningen en subsidies."},
    straat: {standing: 0, note: "Roest/Neon. Wie je ook bent, zij weten het eerder."},
  };
  s.market ??= {};
  for (const sec of allTypes(s)){
    const m = s.market[sec] ??= {size: 100, player: 0, rivals: {}};
    for (const r of s.rivals) m.rivals[r.name] ??= 0;
  }
  for (const r of s.rivals){ r.sector ??= CH(SECTORS); r.memory ??= []; initRival(r); }
  s.defensie ??= 0; s.aanbiedingen ??= [];
  if (!s.map) buildMapForExisting(s);
  if (s.map && s.map.kind === "wereld" && !s.map.frame) upgradeToRealWorld(s);
  s.invloed ??= 0;
  if (s.schepen === undefined){ s.schepen = (s.vloot || 0) * 2; s.inzet = {}; const z0 = (s.districts.find(d => d.control === "player" && (d.zee || []).length) || {}).zee; if (z0 && s.schepen) s.inzet[z0[0]] = s.schepen; }
  s.inzet ??= {};
  for (const r of s.rivals) if (!r.kleur) r.kleur = RIVAL_COLORS.find(c => !s.rivals.some(x => x.kleur === c)) || "#cccccc";
  for (const r of s.rivals){
    let d = s.districts.find(x => x.id === r.hq);
    if (d && d.control !== "neutral" && d.control !== r.name){ const alt = s.districts.filter(x => x.control === "neutral"); d = alt.length ? alt[Math.floor(R() * alt.length)] : null; r.hq = d ? d.id : null; }
    if (d && d.control === "neutral") d.control = r.name;
  }
  for (const n of s.npcs){ n.loyalty ??= 50; n.ambition ??= 50; }
  for (const i of s.invoices){ i.id ??= hex8(); i.auto_pay ??= true; i.overdue ??= 0; }
  migrate13(s); migrate20(s); migrate21(s); migrate22(s);
  return s;
}

const faction = (s, n) => (s.factions[n] || {}).standing || 0;
function shiftFaction(s, n, d){ const f = s.factions[n] ??= {standing: 0, note: ""}; f.standing = clamp(f.standing + d, -100, 100); }
function addLog(s, line){ s.log.push(`${ym(s)} · ${line}`); s.log = s.log.slice(-300); }
function addRoll(s, line){ s.worpen.push(`${ym(s)} · ${line}`); s.worpen = s.worpen.slice(-80); }
function remember(r, s, txt){ r.memory.push(`${ym(s)}: ${txt}`); r.memory = r.memory.slice(-12); }

/* ---------- mails: de engine verzamelt, de opslag schrijft weg ---------- */
function Ctx(){ return {mails: [], rep: []}; }
function mail(ctx, s, van, onderwerp, body, prio = "NORMAAL"){
  if ((prio === "LAAG" || prio === "NORMAAL") && ctx.inTick && !/^(Maandrapport|Gewonnen|Uw termijn)/.test(onderwerp)){ (ctx.klein ??= []).push({van, onderwerp, body}); return; }   /* 4.3: gewone meldingen in het maandrapport */
  ctx.mails.push({datum: ym(s), van, aan: s.player.title || "CEO", onderwerp, prio, body});
}

/* ---------- events ---------- */
const EVENTS = [
  {id: "staking", prob: 0.07, when: s => s.morale < 45 || faction(s, "vakbond") < -40, effect: {cash_pct: -0.04, morale: -5, reputation: -3},
   from: "HR", subject: "Wilde staking in {district}", prio: "HOOG", body: "Morale is te laag. De ploeg legt het werk neer. Elke dag stilstand kost geld. De vakbond wil praten, niet drinken."},
  {id: "audit", prob: 0.08, when: s => s.heat > 35, effect: {cash_pct: -0.06, heat: -8, reputation: -2},
   from: "Juridische Zaken", subject: "Onaangekondigde inspectie", prio: "HOOG", body: "De toezichthouder staat in de lobby met een rechter-commissaris en veel tijd. Boetes volgen. Als je heat hoog blijft, komt hij terug."},
  {id: "datalek", prob: 0.05, when: () => true, effect: {reputation: -6, cash: -15},
   from: "Head of Security", subject: "Datalek, bron onbekend", prio: "HOOG", body: "Klantgegevens zijn te koop op een forum. Ik weet nog niet of het intern of extern is. Vertrouw niemand met toegang tot de serverkamer."},
  {id: "beurspiek", prob: 0.07, when: () => true, effect: {cash_pct: 0.05, reputation: 2},
   from: "CFO", subject: "Markt trekt aan", prio: "LAAG", body: "Sector-optimisme verhoogt de omzet. Het gaat vanzelf weer weg. Houd cash, geen illusies."},
  {id: "recessie", prob: 0.05, when: () => true, effect: {cash_pct: -0.05, morale: -2},
   from: "CFO", subject: "Kredietmarkt droogt op", prio: "HOOG", body: "Banken sluiten de kraan. Omzet daalt, schulden niet."},
  {id: "talent", prob: 0.06, when: s => s.reputation > 40, effect: {morale: 4, reputation: 1},
   from: "HR", subject: "Een toptalent solliciteert", prio: "NORMAAL", body: "Een ex-onderzoeker van een rivaal wil bij ons werken. Salaris is niet laag. Motieven ook niet duidelijk."},
  {id: "schandaal", prob: 0.05, when: s => s.heat > 25, effect: {reputation: -10, heat: 5},
   from: "PR", subject: "Journalist weet iets", prio: "HOOG", body: "Een freelancer belt over een 'patroon in de cijfers'. We kunnen bellen, betalen of zwijgen. Alle drie hebben een prijs."},
  {id: "sabotage", prob: 0.035, when: s => s.rivals.some(r => r.aggression > 0.5), effect: {cash: -12, morale: -3},
   from: "Anoniem", subject: "Brand in magazijn", prio: "HOOG", body: "Geen dodelijke slachtoffers. Wel een brief: 'dit was maar een proefrun.'"},
];
function eventProb(s, e, diff){
  let p = e.prob * diff * 0.6;   /* 4.3: minder gebeurtenissen */
  if (e.id === "staking") p *= faction(s, "vakbond") < -30 ? 1.5 : faction(s, "vakbond") > 30 ? 0.6 : 1;
  if (e.id === "audit") p *= faction(s, "politie") > 30 ? 0.5 : faction(s, "politie") < -30 ? 1.4 : 1;
  if (e.id === "audit" && relV(s, "politie") >= 50) p *= 0.6;
  if (e.id === "staking" && relV(s, "vakbond") >= 50) p = 0;
  if (e.id === "schandaal" && relV(s, "pers") >= 50) p *= 0.5;
  return p;
}
/* omvang van het bedrijf: schade en rekeningen schalen mee, zodat een starter niet als een megacorp geraakt wordt */
const omvang = s => clamp((((s.history || []).slice(-1)[0]) || {omzet: 30}).omzet / 50, 0.35, 2);
function applyEffect(s, eff){ /* 4.7.3: verliezen 30% kleiner; een percentage raakt hoogstens drie maanden omzet, niet je hele spaarpot */
  const c = eff.cash || 0, pct = eff.cash_pct || 0, basis = pct < 0 ? Math.min(Math.max(s.cash, 0), 3 * (((s.history || []).slice(-1)[0] || {}).omzet || 30)) : s.cash;
  s.cash = r1(s.cash + (c < 0 ? c * 0.7 : c) + basis * pct);
  for (const k of ["heat", "morale", "reputation"]) if (k in eff) s[k] = clamp(s[k] + eff[k]);
}

/* ---------- markt ---------- */
function marketRevMult(s, type){
  const m = s.market[type]; if (!m) return 1;
  if (s.custom_types && s.custom_types[type]) return clamp(1 + m.player * 0.4, 0.8, 1.2);
  const vals = Object.values(m.rivals); const top = vals.length ? Math.max(...vals) : 0;
  return clamp(1 + m.player - top * 0.45, 0.65, 1.5);
}
const divCostMult = (s, type) => (["Logistiek", "Smokkel"].includes(type) && s.flags.nomad_contract === true) ? 0.8 : 1;

function lingeringTick(s, ctx, diff){
  s.lopende_effecten = s.lopende_effecten.filter(e => {
    const f = e.effect || {};
    s.cash = r1(s.cash + (f.cash || 0) * ((f.cash || 0) < 0 ? diff : 1));
    for (const k of ["reputation", "heat", "morale"]) if (k in f) s[k] = clamp(s[k] + f[k]);
    e.maanden -= 1; ctx.rep.push(`Lopend: ${e.naam}`);
    return e.maanden > 0;
  });
}

const RECURRING = [
  ["Netbeheerder TransGrid", 1.5, 3.0, "Elektriciteit en datacenter-koeling."],
  ["Vastgoedfonds Glas BV", 2.5, 6.0, "Huur van kantoor- en labruimte."],
  ["Advocatenkantoor De Wit & Partners", 1.0, 4.0, "Maandelijkse retainer, 'voor het geval dat'."],
  ["Verzekeraar Argos-Bloom", 1.0, 2.5, "Premie bedrijfsaansprakelijkheid. Met uitsluitingen."],
];
function invoice(s, payee, amount, due, note, tag = "vast"){
  s.invoices.push({id: hex8(), payee, amount: r1(amount), due_in: due, note, tag, overdue: 0, auto_pay: true});
}
function invoicesTick(s, ctx, diff){
  const scale = 0.35 * omvang(s); /* 4.7.3: was 0,6 */
  for (const [p, lo, hi, note] of RECURRING) if (R() < 0.4) invoice(s, p, U(lo, hi) * scale * diff, 2, note);
  if (R() < 0.15 * inst(s, "events")){
    const payee = CH(["Beveiligingsbureau Falk", "Consultants Merrick & Zoon", "Overheid: leges en heffingen", "Schadeherstel BV 'Snelle Jan'", "Cleaning crew (geen vragen)"]);
    let amt = U(1, 8) * scale * diff;
    if (payee.startsWith("Overheid") && faction(s, "stad") < -30) amt *= 1.5;
    invoice(s, payee, amt, 1, "Onverwacht, wel verplicht.", "incidenteel");
  }
  let paid = 0, late = 0; const still = [], cfo = assistentDoet(s, ctx, "facturen"), korting = cfo && talentVan(cfo) >= 4 ? 0.95 : 1; let cfoN = 0;
  for (const inv of s.invoices){
    inv.due_in -= 1;
    if (inv.due_in > 0){ still.push(inv); continue; }
    if (s.auto_pay && inv.auto_pay && s.cash >= inv.amount){ s.cash = r1(s.cash - inv.amount); paid += inv.amount; continue; }
    if (cfo && s.cash - inv.amount * korting >= 20){ const b = r1(inv.amount * korting); s.cash = r1(s.cash - b); paid += b; cfoN++; continue; } /* 5.8: de CFO betaalt */
    inv.overdue += 1;
    const fee = r1(inv.amount * 0.08); inv.amount = r1(inv.amount + fee); late += fee;
    s.reputation = clamp(s.reputation - 1.5);
    if (inv.overdue === 2) mail(ctx, s, inv.payee, `Aanmaning: ${inv.payee}`, `Tweede herinnering. Openstaand: €${inv.amount}M. Daarna volgt de deurwaarder, niet de sympathie.`, "HOOG");
    if (inv.overdue === 4){
      s.reputation = clamp(s.reputation - 4); s.flags["deurwaarder_" + inv.payee] = true; ctx.rep.push(`Deurwaarder voor ${inv.payee}`);
      mail(ctx, s, "Deurwaarder Claes", "Beslag op bedrijfsmiddelen", `Namens ${inv.payee} leg ik beslag. €${inv.amount}M, binnen de week.`, "KRITIEK");
    }
    if (inv.overdue >= 5){
      const take = Math.min(Math.max(s.cash, 0), inv.amount);
      s.cash = r1(s.cash - take); inv.amount = r1(inv.amount - take);
      if (take) ctx.rep.push(`Beslag gelegd: €${r1(take)}M`);
      if (inv.amount <= 0) continue;
    }
    still.push(inv);
  }
  s.invoices = still;
  if (paid) ctx.rep.push(`Facturen betaald: €${r1(paid)}M`); if (cfoN) ctx.rep.push(`${cfo.name}: ${cfoN} factu${cfoN > 1 ? "ren" : "ur"} betaald${korting < 1 ? " met 5% korting" : ""}`); ctx.facturen = r1(paid + late);
  if (late) ctx.rep.push(`Boete/rente achterstallig: €${r1(late)}M`);
}

function marketTick(s, ctx){
  for (const [sec, m] of Object.entries(s.market)){
    m.size = Math.max(50, m.size * (1 + U(-0.03, 0.04)));
    const lvl = s.divisions.filter(d => d.type === sec).reduce((a, d) => a + d.level, 0);
    const tgt = Math.min(0.5, lvl * 0.07 * (0.6 + s.reputation / 250));
    m.player += (tgt - m.player) * 0.2;
    for (const r of s.rivals){
      let t = (r.sector === sec ? 0.30 : 0.04) * (0.7 + 0.6 * R()) * (1 + r.aggression * 0.4);
      m.rivals[r.name] = (m.rivals[r.name] || 0) + (t - (m.rivals[r.name] || 0)) * 0.15;
    }
    const total = m.player + Object.values(m.rivals).reduce((a, b) => a + b, 0);
    if (total > 0.92){ const f = 0.92 / total; m.player *= f; for (const k in m.rivals) m.rivals[k] *= f; }
  }
  for (const r of s.rivals){
    if (R() >= 0.12 + r.aggression * 0.1) continue;
    const sec = r.sector, concurrent = r.status === "oorlog" || s.divisions.some(d => d.type === r.sector); let move = CH(concurrent ? ["headhunt", "gezamenlijk", "dumping", "smaad", "smaad", "licentiebod"] : ["headhunt", "gezamenlijk", "dumping", "smaad", "licentiebod"]);
    if (move === "smaad" && !concurrent) move = "licentiebod"; /* 4.3.4: laster alleen van concurrenten in je eigen sector of in oorlog */
    r.cash = r1(r.cash - U(2, 8));
    if (move === "headhunt" && s.npcs.length){
      const n = CH(s.npcs);
      keuzeHeadhunt(s, ctx, r, n);
      n.loyalty = clamp(n.loyalty - RI(3, 10)); n.benaderd_door ??= r.name;
      ctx.rep.push(`${r.name} probeert ${n.name} weg te kopen`);
    } else if (move === "gezamenlijk"){
      mail(ctx, s, r.ceo, `Joint venture ${sec}`, `${r.name} stelt een gezamenlijk project voor in ${sec}. Winst delen, risico's delen, geheimen niet.`);
      s.flags["jv_aanbod_" + r.name] = ym(s);
    } else if (move === "dumping"){
      s.market[sec].player *= 0.9; ctx.rep.push(`${r.name} dumpt prijzen in ${sec}`);
    } else if (move === "smaad"){
      s.reputation = clamp(s.reputation - 3); (s.smaadLog ??= []).push(ym(s)); s.smaadLog = s.smaadLog.slice(-6);
      mail(ctx, s, "PR", "Campagne tegen ons", `Anonieme blogs wijzen naar ${r.name}. Natuurlijk zonder bewijs. Natuurlijk effectief.`, "HOOG");
    } else {
      mail(ctx, s, r.ceo, "Licentie aanbod", `${r.name} wil technologie van ons licentiëren. Prijs vraagt u maar. Dat is zelden goed nieuws.`);
    }
  }
  for (const r of s.rivals){
    if (R() < 0.04){
      r.cash = r1(r.cash - r.cash * U(0.2, 0.5));
      if (R() < 0.6) news(s, `Problemen bij ${r.name}?`, `Bronnen spreken over een mislukt project bij ${r.name}. Cijfers ontbreken. Paniek niet.`, landNaam(s, r.hq), "markt");
    }
  }
  for (const r of [...s.rivals]){
    if (r.cash < -20 && R() < 0.25){
      s.rivals = s.rivals.filter(x => x !== r); releaseDistricts(s, r); s.aanbiedingen = (s.aanbiedingen || []).filter(o => o.rival !== r.name);
      for (const m of Object.values(s.market)){ m.player += (m.rivals[r.name] || 0) * 0.3; delete m.rivals[r.name]; }
      mail(ctx, s, "Journalist", `${r.name} failliet`, `${r.name} is omgevallen. Bezittingen worden verkocht. Wie het eerst belt, krijgt de beste stukken.`, "HOOG");
      s.flags["faillissement_" + r.name] = ym(s); ctx.rep.push(`${r.name} gaat failliet (kans!)`);
    }
  }
  if (R() < 0.04){
    const sec = CH(SECTORS), naam = genRivaalNaam(sec, new Set([...s.rivals.map(r => r.name), ...(s.flags.start_rivalen || [])]));
    if (!s.rivals.some(r => r.name === naam)){
      const free = s.districts.filter(d => d.control === "neutral"), home = free.length ? CH(free) : null;
      const nr = initRival({name: naam, ceo: CH(RIVAL_CEO_NAMEN.filter(x => !s.rivals.some(r => r.ceo === x))), cash: RI(80, 300),
        aggression: r1(U(0.2, 0.7) * 10) / 10, memory: [], hq: home ? home.id : null, sector: sec, divs: {[sec]: 2}});
      s.rivals.push(nr); if (home) home.control = naam;
      for (const m of Object.values(s.market)) m.rivals[naam] = 0;
      news(s, `Nieuwe speler: ${naam}`, `Nieuwkomer in ${sec}${home ? ", met een hoofdkantoor in " + home.name : ""}. Geld uit onduidelijke bron. Dat is gewoonlijk een signaal.`, home ? home.continent : "", "markt", true);
      ctx.rep.push(`Nieuwe concurrent: ${naam}`);
    }
  }
}

function factionTick(s, ctx){
  if (s.flags.nomad_contract_gebroken && s.flags.nomad_contract === true){
    s.flags.nomad_contract = false; shiftFaction(s, "nomaden", -60);
    mail(ctx, s, "Nomadenleider Isra", "Het pact", "U heeft uw woord teruggenomen. Wij nemen niets terug. Niet vandaag, wel ooit.", "KRITIEK");
    ctx.rep.push("Nomadenpact gebroken");
  }
  for (const f of Object.values(s.factions)) f.standing = clamp(f.standing * 0.97, -100, 100);
  if (s.morale < 40) shiftFaction(s, "vakbond", -3);
  if (s.heat > 40){ shiftFaction(s, "politie", -2); shiftFaction(s, "stad", -1); }
  if (s.districts.some(d => d.control === "player" && (d.tags || []).includes("straat"))) shiftFaction(s, "straat", 1);
  if (s.flags.nomad_contract === true) shiftFaction(s, "nomaden", 1);
  if (faction(s, "vakbond") < -40 && relV(s, "vakbond") < 50 && R() < 0.15){
    s.morale = clamp(s.morale - 4);
    mail(ctx, s, "HR", "Vakbond dreigt met acties", "De vakbond heeft een stakingskas en een lijst grieven. Wij staan bovenaan beide.", "HOOG");
  }
}

function npcTick(s, ctx){
  for (const n of [...s.npcs]){
    const target = 15 + s.morale * 0.5 - (n.ambition - 50) * 0.3 + (heeftFocus(s, "talent") ? 5 : 0);
    n.loyalty = r1(clamp(n.loyalty + (target - n.loyalty) * 0.05 + U(-1.5, 1.5)));
    const risk = n.loyalty < 35 ? (35 - n.loyalty) / 100 + n.ambition / 400 : 0;
    if (risk <= 0 || R() > risk) continue;
    const role = (n.role || "").toLowerCase(), mg = maandenGespeeld(s);
    if (mg < 6 || (mg < 12 && n.ambition >= 60 && !n.verraad)) continue;   /* 3.9.3: aanloop, eerst je mensen leren kennen */
    if (n.ambition >= 60 && !n.verraad){
      n.verraad = ym(s);
      if (role.includes("cfo")){ s.flags.cfo_manipuleert = n.name; s.hidden_truth.push({id: "cfo_boeken", waar: true, inhoud: `${n.name} kleurt de maandrapporten en roomt af.`}); }
      else if (role.includes("pr")){ s.flags.pr_lekt = n.name; s.hidden_truth.push({id: "pr_lek", waar: true, inhoud: `${n.name} lekt structureel aan de pers.`}); }
      else if (role.includes("security")){ s.flags.security_verkocht = n.name; s.hidden_truth.push({id: "security_lek", waar: true, inhoud: `${n.name} verkoopt toegang aan derden.`}); }
      else s.flags["verraad_" + n.name] = ym(s);
      continue;
    }
    s.npcs = s.npcs.filter(x => x !== n);
    const to = n.benaderd_door || (s.rivals.length ? CH(s.rivals).name : "onbekend");
    mail(ctx, s, n.name, "Mijn ontslag", `Na rijp beraad stop ik als ${n.role}, per direct. Ik dank u voor de kansen. Mijn badge ligt bij de receptie.`, "HOOG");
    mail(ctx, s, "HR", `Vertrek ${n.role}`, `${n.name} is weg. Volgens de wandelgangen naar ${to}. Wat er in het hoofd van ${n.name} zat, gaat mee.`, "HOOG");
    s.morale = clamp(s.morale - 3); s.flags["vacature_" + n.role] = ym(s);
    for (const r of s.rivals) if (r.name === to) remember(r, s, `nam ${n.name} (${n.role}) over`);
    ctx.rep.push(`${n.name} (${n.role}) neemt ontslag`);
  }
  if (s.flags.cfo_manipuleert && R() < 0.5) s.cash = r1(s.cash - U(1, 4));
  if (s.flags.pr_lekt && R() < 0.12){
    s.reputation = clamp(s.reputation - 3);
    mail(ctx, s, "Journalist", "Vraag om reactie", "Ik heb interne notulen van uw laatste directievergadering. Wilt u reageren voor publicatie? Morgen gaat het online.", "HOOG");
  }
  if (s.flags.security_verkocht && R() < 0.15){
    s.cash = r1(s.cash - U(5, 15));
    mail(ctx, s, "IT", "Inbraak zonder braaksporen", "Iemand is binnengekomen met een geldige badge. De logs van die nacht zijn gewist. Netjes gewist.", "HOOG");
  }
}

function chaosTick(s, ctx, diff){
  const fase = clamp(maandenGespeeld(s) / 120, 0, 1); /* 4.7.3: chaos groeit mee: 8% kans en halve schade in het begin, 25% en volle schade na tien jaar */
  if (R() > (0.08 + 0.17 * fase) * inst(s, "chaos")) return;
  const n = faction(s, "nomaden"), contract = s.flags.nomad_contract === true, broken = !!s.flags.nomad_contract_gebroken;
  const table = [["nomaden_konvooi", 3], ["nomaden_ruil", 2], ["nomaden_conflict", n < 10 ? (broken ? 5 : 2) : 0], ["nomaden_eis", contract ? 3 : 0],
    ["cyberpsycho", s.divisions.some(d => d.type === "Cyberware") ? 2 : 0.5], ["spookzending", 1.5], ["heimwee_ai", 1], ["sekte_roest", 0],
    ["overstroming", 1], ["dode_cfo_brief", s.flags.dode_cfo_pakket ? 0 : 1], ["slimme_vreemdeling", 0], ["stroomstoring", 1.5],
    ["gemeentelijk_feest", 0], ["tip_van_straat", 0]];
  let x = U(0, table.reduce((a, [, w]) => a + w, 0)), pick = table[0][0];
  for (const [k, w] of table){ x -= w; if (w && x <= 0){ pick = k; break; } }
  const dist = CH(s.districts).name;
  const eff = ({cash = 0, rep = 0, mor = 0, heat = 0, nom = 0} = {}) => {
    s.cash = r1(s.cash + cash * diff * (cash < 0 ? omvang(s) * 0.7 * (0.5 + 0.5 * fase) : 1)); s.reputation = clamp(s.reputation + rep); s.morale = clamp(s.morale + mor);
    s.heat = clamp(s.heat + heat); shiftFaction(s, "nomaden", nom);
  };
  const M = (v, o, b, p = "NORMAAL") => mail(ctx, s, v, o, b, p);
  switch (pick){
    case "nomaden_konvooi":
      if (n >= 15 || contract || relV(s, "isra") >= 50){ eff({cash: 6, nom: 3}); M("Logistiek", "Konvooi uit de woestenij", "Een nomaden-konvooi van de Zwarte Kraai-clan levert onderdelen. Geen papieren. Wel korting. Ze willen terugbetaling in gunsten.", "LAAG"); }
      else if (n <= -15){ eff({cash: -12, nom: -2}); M("Head of Security", "Konvooi blokkeert de snelweg", "Een clan blokkeert onze leveringen. Ze eisen tol. Ik raad niet aan om met een pistool te onderhandelen. Ik raad niets aan.", "HOOG"); }
      else { eff({cash: -3}); M("Logistiek", "Konvooi op de snelweg", "Een nomaden-konvooi vertraagt onze vrachtwagens. Geen vijandigheid, nog niet. Gewoon aanwezigheid.", "LAAG"); }
      break;
    case "nomaden_ruil": eff({nom: 2}); M("Anoniem", "Ruilvoorstel van de clan", "Een nomadenvrouw (kenteken onleesbaar) biedt een koffer 'gekalibreerde onderdelen'. Ze wil data in ruil. Welke data staat er niet bij.");
      s.hidden_truth.push({id: "ruil", waar: R() < 0.5, bron: "nomaden"}); break;
    case "nomaden_conflict": eff({cash: -15, nom: -6, heat: 3}); M("Head of Security", "Clan viel depot aan", `De Zwarte Kraai raakte een depot in ${dist}. Er is niets gestolen dat we kunnen opsommen. Maar iemand wilde een boodschap afgeven.`, "HOOG"); break;
    case "nomaden_eis": { const amt = r1(U(3, 8) * diff); s.flags.nomaden_eis = {bedrag: amt, sinds: ym(s)};
      M("Nomadenleider Isra", "Een gunst", `Het pact is goud waard, toch? Een van onze trucks staat in beslag in een haven. €${amt}M of een telefoontje naar de juiste persoon. Ik wacht niet lang.`, "HOOG"); break; }
    case "cyberpsycho": eff({cash: -8, rep: -4, mor: -3, heat: 2}); M("Head of Security", "Cyberware-incident in " + dist, "Een gebruiker van implantaten is losgeslagen. Drie gewonden, één dode. Pers belt. Of het onze implantaten waren, weet ik nog niet. De pers wacht daar niet op.", "HOOG");
      s.flags.cyberpsycho_incident = (s.flags.cyberpsycho_incident || 0) + 1; break;
    case "spookzending": eff({rep: -1}); M("IT", "Piratensignaal op ons interne netwerk", "Een stem leest woordelijk onze managementnotulen voor. Of iemand heeft een bug geplant, of iemand in de directie praat.", "HOOG"); s.flags.lek_intern = true; break;
    case "heimwee_ai": eff({mor: 2}); M("IT", "Het planningssysteem stelt vragen", "Het oude planningssysteem begint te antwoorden in volzinnen. Het vraagt of 'de bezoeker uit 1997' nog leeft. We hebben niemand uit 1997.", "LAAG"); break;
    case "sekte_roest": eff({mor: -2, rep: -1}); M("HR", "Medewerkers vertrekken naar de Kerk van Chroom", "Een sekte in Roest rekruteert onze operators. Ze zeggen 'vlees is tijdelijk'. Dat is niet ons loonbeleid."); break;
    case "overstroming": eff({cash: -9}); M("COO", "Overstroming in " + dist, "Stormvloed. Magazijnen onder water. Verzekeraar vermeldt 'artikel 7'. Dat artikel bestaat niet.", "HOOG"); break;
    case "dode_cfo_brief": M("Notaris Hubrecht", "Afgifte van een brief", "Een voormalig CFO van een rivaal is overleden. Hij liet instructies na dat dit pakket naar u gaat. Ik open het niet.", "HOOG");
      s.flags.dode_cfo_pakket = true; s.hidden_truth.push({id: "dode_cfo", waar: true, inhoud: `bewijs van illegaal handelen bij ${s.rivals.length ? CH(s.rivals).name : "een rivaal"}`}); break;
    case "slimme_vreemdeling": M("Receptie", "Vreemdeling vraagt naar u", "Een man zonder naam wil u persoonlijk spreken. Hij betaalt contant voor een kop koffie en weigert te verklaren wat hij wil.");
      s.hidden_truth.push({id: "vreemdeling", waar: R() < 0.5, bron: "onbekend"}); break;
    case "stroomstoring": eff({cash: -4, mor: -1}); M("COO", "Stroomstoring in " + dist, "Twee uur duisternis. Noodgenerator weigerde. De monteur zegt dat hij 'dit pas hoort bij sluiting'.", "LAAG"); break;
    case "gemeentelijk_feest": eff({rep: 2, cash: -2}); M("PR", "Gemeente vraagt sponsoring", "Een stadsfeest in de Oude Stad zoekt een hoofdsponsor. Een kans, een kostenpost, en een bom aan fotografen.", "LAAG"); break;
    case "tip_van_straat": M("Anoniem", "Tip: iemand praat over u in Roest", "Een bron beweert dat een rivaal een sabotage plant. Of dit waar is, weten we niet. De bron vraagt €2M.");
      s.hidden_truth.push({id: "tip", waar: R() < 0.5, bron: "straat"}); break;
  }
}
function nomadDemandTick(s, ctx){
  const e = s.flags.nomaden_eis;
  if (!e || typeof e !== "object" || e.sinds === ym(s)) return;
  delete s.flags.nomaden_eis; shiftFaction(s, "nomaden", -12);
  mail(ctx, s, "Nomadenleider Isra", "Genoteerd", "U had het druk. Wij onthouden wie het druk heeft.");
  ctx.rep.push("Nomaden-eis genegeerd");
}

const RUMORS = [
  ["rivaal_fusie", "Gerucht: twee rivalen bespreken een fusie."],
  ["overheid_regels", "Gerucht: overheden schrijven nieuwe regels voor implantaten."],
  ["vonk_terug", "Gerucht: Mara Vonk speelt weer op daken in de grote steden. Iemand zag de vuist met de bliksem op een muur."],
  ["nomaden_pact", "Gerucht: nomadenclans sluiten een pact en gaan de snelweg tolheffen."],
  ["ceo_verdwenen", "Gerucht: de CEO van een rivaal is verdwenen. Of op vakantie."],
  ["bank_wankelt", "Gerucht: Nordhavn Bank staat er slechter voor dan ze zegt."],
  ["mol", "Gerucht: een rivaal heeft iemand binnen in uw bedrijf."],
];
function rumorTick(s, ctx){
  if (R() >= 0.3) return;
  const [id, txt] = CH(RUMORS);
  let waar = R() < 0.55;
  if (id === "mol") waar = !!(s.flags.security_verkocht || s.flags.pr_lekt || s.flags.cfo_manipuleert) || R() < 0.2;
  s.hidden_truth.push({id, waar, datum: ym(s)});
  news(s, txt.replace(/^Gerucht: /, "Gerucht: ").replace(/\.$/, ""), "Bron onbekend, betrouwbaarheid onbekend. Wie erop handelt, betaalt als het niet klopt.", "", "gerucht");
}

/* ---------- verhaalbogen ---------- */
const ARCS = {
  vonk: {start: 0.05, stages: [
    {delay: 2, from: "Receptie", subject: "Graffiti op de HQ-muur", body: "Iemand heeft 'JULLIE ETEN DE STAD OP' op de muur gespoten. Signatuur: een vuist die een bliksemschicht vasthoudt. De schoonmaakploeg vraagt overuren.", effect: {reputation: -1}},
    {delay: 2, from: "PR", subject: "Illegaal concert in de nachtwijk", body: "Mara Vonk, frontvrouw van punkband Kortsluiting, speelde gisteren op het dak van een parkeergarage. Het refrein was onze bedrijfsnaam, gevolgd door een woord dat ik hier niet typ. Tweehonderd telefoons filmden mee.", effect: {reputation: -3, heat: 2}, flag: "vonk_concert"},
    {delay: 3, from: "Mara Vonk", subject: "Een voorstel, geen verzoek", body: "Je hebt het nummer gehoord. Er komen er meer. Twee opties: je financiert mijn volgende tour en ik zing over iemand anders, of je wordt mijn album. Geen contract, geen advocaten. - M.V.", flag: "vonk_keuze", decide: true},
    {delay: 2, from: "Straat", subject: "De straat heeft besloten", resolve: true},
  ]},
  nomaden_pact: {start: 0.04, stages: [
    {delay: 2, from: "Logistiek", subject: "Clans verzamelen aan de snelweg", body: "Meerdere clans staan stil bij het knooppunt. Geen aanvallen, geen vragen. Iemand ziet een zwarte vlag met een kraai.", flag: "nomaden_verzameling"},
    {delay: 3, from: "Nomadenleider Isra", subject: "Een uitnodiging", body: "We hebben uw bedrijf gezien. We vragen geen vriendschap. We vragen toegang tot uw netwerk, in ruil voor bescherming op de snelweg.", flag: "nomaden_aanbod", decide: true},
    {delay: 1, from: "Nomadenleider Isra", subject: "Ons antwoord op uw antwoord", resolve: true},
  ]},
  hostile_bid: {start: 0, stages: [ /* 4.7.7: uitgeschakeld (willekeurige straf zonder echte tegenzet) */
    {delay: 3, from: "Marktwacht", subject: "Ongewone aandelenaankopen", body: "Iemand koopt stilletjes onze aandelen op. De bron is een holding in een belastingparadijs. De namen zijn geen namen.", effect: {reputation: -1}},
    {delay: 3, from: "Advocaat De Wit", subject: "Formeel overnamebod ontvangen", body: "Een 'vriendelijk' overnamebod ligt op tafel. U heeft 30 dagen. Een verdediging kost geld. Niets doen kost de baan.", effect: {heat: 1}, flag: "overnamebod", decide: true},
    {delay: 1, from: "Advocaat De Wit", subject: "Uitslag overnamestrijd", resolve: true},
  ]},
};
const DEFENSES = {niets: [0.15, 0], investeren: [0.35, 1 / 200], white_knight: [0.60, 0], juridisch: [0.35, 1 / 150], poison_pill: [0.75, 0]};
const RESOLVE = {
  vonk(s, ctx){
    const deal = s.flags.vonk_deal || "negeren";
    if (deal === "sponsor"){ shiftFaction(s, "straat", 15); shiftFaction(s, "politie", -5); s.heat = clamp(s.heat + 5); s.reputation = clamp(s.reputation + 2);
      return "Kortsluiting speelt een nieuw nummer. Het gaat over de burgemeester. Uw logo hangt klein naast het podium. De straat vindt u ineens minder erg. De politie vindt u ineens interessanter."; }
    if (deal === "uitgeschakeld"){
      shiftFaction(s, "straat", -25); s.heat = clamp(s.heat + 15);
      if (R() < 0.35){ s.reputation = clamp(s.reputation - 15); s.flags.vonk_schandaal = ym(s);
        s.lopende_effecten.push({naam: "Boycot na Vonk-schandaal", maanden: 3, effect: {reputation: -1, morale: -1}}); ctx.rep.push("Vonk-zaak lekt uit");
        return "Mara Vonk is van de straat. En iemand heeft een opname van een telefoontje vanuit ons gebouw. Het staat op elke muur in de sloppen. Dit gaat niet over."; }
      s.hidden_truth.push({id: "vonk_spoor", waar: true, inhoud: "Er bestaat ergens een spoor naar de opdrachtgever."});
      return "Kortsluiting heeft het laatste concert afgezegd. Niemand weet waarom. De nachtwijk is stil, en stil is daar nooit een goed teken.";
    }
    const m = RI(1, 3); s.lopende_effecten.push({naam: "Vonk zingt over ons", maanden: m, effect: {reputation: -2}});
    return `Het nieuwe album heet naar ons bedrijf. Het staat op elke radio die niet van ons is. Verwacht ${m} maand(en) reputatieschade.`;
  },
  nomaden_pact(s){
    if (s.flags.nomad_contract === true){ shiftFaction(s, "nomaden", 20);
      return "Het pact staat. Onze trucks rijden voortaan veilig over de snelweg, en uw logistiek wordt goedkoper. Wij vragen soms een gunst. Wie weigert, merkt dat de snelweg lang is."; }
    shiftFaction(s, "nomaden", -10); s.flags.nomad_contract = false;
    return "U heeft nee gezegd. Dat is uw goed recht. De snelweg is ook van ons. Rij voorzichtig.";
  },
  hostile_bid(s, ctx, diff){
    const d = s.hostile_bid || {}; let def = DEFENSES[d.verdediging] ? d.verdediging : "niets";
    const budget = +d.budget || 0, [base, perK] = DEFENSES[def];
    let chance = base + budget * perK + (s.reputation - 30) / 300 + (s.cash > 150 ? 0.05 : 0);
    chance = clamp(chance / Math.sqrt(diff), 0.05, 0.92);
    const kk = snapKans(Math.round(chance * 100)), rr = rolKans(kk), won = rr.ok;
    Object.assign(d, {kans: kk / 100, rol: rr.txt, uitslag: won ? "afgeslagen" : "verloren"}); s.hostile_bid = d;
    ctx.rep.push(`Overnamestrijd (${def}, kans ${kk}%): ${rr.txt} -> ${won ? "afgeslagen" : "verloren"}`);
    addRoll(s, `Overnamestrijd (${def}): ${rr.txt} → ${won ? "afgeslagen" : "verloren"}`);
    if (def === "white_knight") s.flags.white_knight_schuld = true;
    if (def === "poison_pill"){ s.morale = clamp(s.morale - 10); s.reputation = clamp(s.reputation - 5); s.debt = r1(s.debt + 50); }
    if (def === "juridisch") s.heat = clamp(s.heat + 3);
    if (won) return `Het bod is van tafel (verdediging: ${def}). De kopers trekken zich terug, voor nu. Ze hebben wel geleerd hoe we reageren.`;
    if (s.player.difficulty === "Casual" && s.divisions.length){
      const big = s.divisions.reduce((a, b) => b.level > a.level ? b : a); s.divisions = s.divisions.filter(x => x !== big); s.cash = r1(s.cash * 0.7);
      return `We verliezen de strijd gedeeltelijk. De kopers nemen divisie '${big.name || big.type}' en 30% van de kas mee als schikking. U blijft CEO van wat er over is.`;
    }
    s.flags.overgenomen = true;
    return "De aandeelhouders hebben gekozen. Morgen staat er een andere naam op de deur. Uw badge werkt tot middernacht.";
  },
};
function arcsTick(s, ctx, diff){
  const active = new Set(s.arcs.map(a => a.id)), done = s.flags.arcs_done || [];
  for (const [id, arc] of Object.entries(ARCS))
    if (!active.has(id) && !done.includes(id) && R() < arc.start){ s.arcs.push({id, stage: 0, next_in: arc.stages[0].delay}); ctx.rep.push(`Verhaallijn gestart: ${id}`); }
  for (const a of [...s.arcs]){
    if (!ARCS[a.id]){ s.arcs = s.arcs.filter(x => x !== a); continue; }
    if (s.flags["wacht_op_speler_" + a.id]){ ctx.rep.push(`Verhaallijn ${a.id} wacht op een keuze van de CEO`); continue; }
    if (--a.next_in > 0) continue;
    const st = ARCS[a.id].stages[a.stage];
    const body = st.resolve ? RESOLVE[a.id](s, ctx, diff) : st.body;
    mail(ctx, s, st.from, st.subject, body, st.decide || st.resolve ? "HOOG" : "NORMAAL");
    const e = st.effect || {}; s.reputation = clamp(s.reputation + (e.reputation || 0)); s.heat = clamp(s.heat + (e.heat || 0));
    if (st.flag) s.flags[st.flag] = ym(s);
    if (st.decide) s.flags["wacht_op_speler_" + a.id] = true;
    a.stage += 1;
    if (a.stage >= ARCS[a.id].stages.length){ s.arcs = s.arcs.filter(x => x !== a); (s.flags.arcs_done ??= []).push(a.id); ctx.rep.push(`Verhaallijn afgerond: ${a.id}`); }
    else a.next_in = ARCS[a.id].stages[a.stage].delay;
  }
}

/* ---------- de maand ---------- */
function tick(s){
  migrate(s);
  const ctx = Ctx(), diff = DIFF[s.player.difficulty] || 1, played = ym(s), start = s.cash, rep = ctx.rep, gz = gezondheidStart(s); ctx.inTick = true;
  let rev = 0, cost = 0, heatAdd = 0; const lines = [], sf = staffFactor(s), need = staffNeed(s);
  for (const d of s.divisions){
    const t = typeOf(s, d.type) || {rev: 6, cost: 4, heat: 1, vol: 0.3};
    const eff = (d.efficiency || 1) * (0.75 + 0.35 * s.morale / 100) * sf;
    const r = t.rev * Math.pow(d.level, 0.95) * eff * (1 + U(-t.vol, t.vol)) * marketRevMult(s, d.type) * sectorBonus(s, d.type) * sectorMult(s, d.type) * productMult(s, d) * hoofdF(d, "omzet");
    const c = t.cost * 0.85 * d.level * diff * divCostMult(s, d.type) * hoofdF(d, "kosten"); /* 6.1: divisiehoofd */
    rev += r; cost += c; heatAdd += t.heat * Math.pow(t.heat <= 1 ? Math.min(d.level, 6) : d.level, 0.75) * 0.5;
    lines.push(`| ${d.name || d.type} (${d.type} L${d.level}) | ${r1(r)} | ${r1(c)} |`); (s.divomzet ??= {})[d.name || d.type] = r1(r);
    const mk = opMarkt(s, d); if (mk.length){ let po = 0, pk = 0, zw = 0, vk = 0; for (const p of mk){ const K = KANAAL[kanaalVan(p)]; let o = prodOmzet(s, p) * eff; if (stukInfo(p).order && !isAbo(p)) o = 0; /* 6.8: zware producten (tanks, satellieten, ...) verkopen niet aan het publiek, alleen via contracten */ (s.prodomzet ??= {})[p.id] = r1(o); pk += prodKost(p, o);
        { const ex = exportExtra(s, p, o); if (ex.legaal || ex.zwart){ po += ex.legaal; zw += ex.zwart; heatAdd += ex.heat; pk += prodKost(p, ex.legaal + ex.zwart); (s.exportOmzet ??= {})[p.id] = r1(ex.legaal + ex.zwart); } } /* 5.10 */
        if (K.zwart){ zw += o * K.zwart; po += o * (1 - K.zwart); if (o > 0 && !ctx.journo && kansRol() < 0.04){ ctx.journo = true; s.reputation = clamp(s.reputation - 3); heatAdd += 3; mail(ctx, s, "Journalist", `${p.naam} op de zwarte markt`, `Een reportage volgt een lading ${p.naam} van een kofferbak in een steeg tot een bende. Uw naam staat erbij. Reputatie −3, heat +3.`, "HOOG"); } } else po += o; /* 5.0: zwarte markt is een echt risico */ vk += K.vast * diff + capVast(s, p); heatAdd += K.heat; }
      rev += po; cost += pk + vk; lines.push(`| Producten ${d.name || d.type} (${mk.length}) | ${r1(po)} | ${r1(pk + vk)} |`);
      if (zw){ s.accounts.zwart = r1((s.accounts.zwart || 0) + zw); lines.push(`| Zwarte markt ${d.name || d.type} (naar zwart geld) | ${r1(zw)} | 0 |`); } }
  }
  for (const d of s.districts) if (d.control === "player"){ rev += incOf(d) * U(0.85, 1.15); cost += d.upkeep; }
  let streamRev = 0; for (const x of s.streams || []) streamRev += x.bedrag * (0.75 + 0.35 * s.morale / 100) * sf * U(0.85, 1.12);
  if (streamRev){ rev += streamRev; lines.push(`| Eigen inkomstenbronnen (${(s.streams || []).length}) | ${r1(streamRev)} | 0 |`); }
  for (const x of s.streams || []) if (x.maanden != null && --x.maanden <= 0) ctx.rep.push(`${x.naam} loopt af`);
  s.streams = (s.streams || []).filter(x => x.maanden == null || x.maanden > 0);
  { const ad = aandeelInkomen(s); if (ad.geld){ rev += ad.geld; lines.push(`| Aandeel in andere districten (${ad.n}) | ${ad.geld} | 0 |`); } } /* 5.6 */
  const dom = dominanceIncome(s, "player");
  if (dom.geld){ rev += dom.geld; ctx.rep.push(`Dominantie: +€${dom.geld}M`); }
  if (dom.inv){ s.invloed = r1((s.invloed || 0) + dom.inv); ctx.rep.push(`Invloed +${dom.inv}`); }
  const payroll = s.staff.count * s.staff.avg_salary / 12 * 0.1 * loonMult(s);
  const interest = s.debt * Math.max(0.01, s.interest_rate - (heeftFocus(s, "kas") ? 0.02 : 0)) / 12;
  const projCost = s.projects.reduce((a, p) => a + (p.cost_per_month || 0), 0);
  const crewKost = crewLoonTotaal(s) + legerKostNu(s);
  if (crewKost) lines.push(`| Crew${s.huurleger ? " en huurleger" : ""} (${(s.crew || []).length}) | 0 | ${r1(crewKost)} |`);
  cost += payroll + (s.culture.bonus_cost || 0) + interest + projCost + (s.defensie || 0) * 2 + (s.schepen || 0) * 1.2 + crewKost;
  { const tl = termijnTick(s); if (tl){ cost += tl; lines.push(`| Termijnleningen (rente en aflossing) | 0 | ${tl} |`); } } /* 5.15 */
  { const hl = r1(s.divisions.reduce((a, d) => a + ((d.hoofd || {}).loon || 0), 0)); if (hl){ cost += hl; lines.push(`| Divisiehoofden (${s.divisions.filter(d => d.hoofd).length}) | 0 | ${hl} |`); } } /* 6.1 */
  { const dl = directieLoon(s); if (dl){ cost += dl; lines.push(`| Directie: loon nieuwe assistenten | 0 | ${dl} |`); } } /* 5.8 */
  { const np = patrouilles(s).length, pk = r1(np * patrouilleKost(s)); if (pk){ cost += pk; lines.push(`| Patrouilles op straat (${np}) | 0 | ${pk} |`); if (!heeftWet(s, "beveiliging")) heatAdd += np * 0.25; } } /* 5.5 */
  if (npcActive(s, "kosten")) cost *= 0.97;
  if (heeftFocus(s, "lean")) cost *= 0.95;
  const off = (s.accounts.offshore >= 20 ? 0.08 : 0) + (heeftWet(s, "zone") ? 0.05 : 0), winst0 = Math.max(0, rev - cost), belasting = r1(Math.min(winst0, 60) * (0.2 - off) + Math.max(0, winst0 - 60) * (0.35 - off));
  if (belasting){ cost += belasting; lines.push(`| Winstbelasting (${Math.round((0.2 - off) * 100)}% tot €60M, ${Math.round((0.35 - off) * 100)}% daarboven${s.accounts.offshore >= 20 ? ", offshore" : ""}${heeftWet(s, "zone") ? ", corpozone" : ""}) | 0 | ${belasting} |`); }
  const net = r1(rev - cost); s.cash = r1(s.cash + net);

  { const h0 = s.heat, ha = heatAdd * 0.7 * inst(s, "heat") * (s.player.difficulty === "Casual" ? 0.9 : 1) * (heeftFocus(s, "juristen") ? 0.9 : 1), dec = (s.culture.heat_decay ?? 2) + s.heat * 0.07 + spanningHeat(s); s.heat = clamp(s.heat + ha - dec); gz.hDelen.push(["Divisies (omzet trekt aandacht)", r1(ha)], ["Vanzelf afnemen", r1(s.heat - h0 - ha)]); }
  let drift = (s.culture.morale_drift || 0) + (net > 0 ? 1 : -2); if (s.culture.layoff_policy === "hard") drift -= 2;
  drift += clamp((s.staff.avg_salary - 30) / 6, -2, 2);
  if (sf < 0.8){ drift -= 1; rep.push(`Onderbezetting: ${s.staff.count} mensen voor ${need} plekken`); }
  { const m0 = s.morale; s.morale = clamp(s.morale + drift + U(-2, 2));
    gz.mDelen.push(["Cultuur en bonussen", s.culture.morale_drift || 0], [net > 0 ? "Winst deze maand" : "Verlies deze maand", net > 0 ? 1 : -2]);
    if (s.culture.layoff_policy === "hard") gz.mDelen.push(["Hard ontslagbeleid", -2]);
    const sal = clamp((s.staff.avg_salary - 30) / 6, -2, 2); if (sal) gz.mDelen.push(["Salarisniveau", r1(sal)]); if (sf < 0.8) gz.mDelen.push(["Onderbezetting", -1]);
    gz.mDelen.push(["Toeval en sfeer", r1(s.morale - m0 - gz.mDelen.reduce((a, [, v]) => a + v, 0))]); }
  s.reputation = clamp(s.reputation + (net > 0 ? 0.5 : -1) - s.heat / 60);

  for (const p of [...s.projects]){
    if (--p.eta_months > 0) continue;
    if (!p.gerold){ p.gerold = true; const rr = rol2d6(0, projectDoel(s)); addRoll(s, `Project ${p.name}: ${rr.txt} → ${rr.ok ? "OP SCHEMA" : rr.blunder ? "MISLUKT" : "VERTRAAGD"}`);
      if (rr.blunder){ s.projects = s.projects.filter(x => x !== p); const back = r1((p.kost || 0) * 0.25); s.cash = r1(s.cash + back);
        mail(ctx, s, "COO", `Project mislukt: ${p.name}`, `Het is mis (${rr.txt}). Een aannemer ging failliet, een vergunning werd ingetrokken, een partner trok zich terug: alles tegelijk. Van het geld komt €${back}M terug. De rest is weg.`, "KRITIEK"); rep.push(`Project mislukt: ${p.name}`); continue; }
      if (!rr.ok){ p.eta_months = RI(1, 2); p.cost_per_month = r1((p.cost_per_month || 1) * 1.5 + 1);
        mail(ctx, s, "COO", `Vertraging: ${p.name}`, `Het project loopt uit (${rr.txt}). Nog ${p.eta_months} maand(en), en het kost nu €${p.cost_per_month}M per maand.`, "HOOG"); rep.push(`Vertraging: ${p.name}`); continue; } }
    s.projects = s.projects.filter(x => x !== p);
    mail(ctx, s, "COO", `Project klaar: ${p.name}`, p.done_msg || "Opgeleverd. Kijk wat het oplevert."); rep.push(`Project klaar: ${p.name}`);
    const oc = p.on_complete || {};
    if (oc.new_division){ s.divisions.push(oc.new_division); divisieOpening(s, ctx, p, oc.new_division); }
    if (oc.upgrade_division) for (const d of s.divisions) if ((d.name || d.type) === oc.upgrade_division) d.level += oc.levels || 1;
    if (oc.district_control) for (const d of s.districts) if (d.id === oc.district_control) d.control = "player";
    if (oc.effect) applyEffect(s, oc.effect);
  }

  for (const r of s.rivals){
    if (s.heat > 40){ remember(r, s, "speler heeft hoge heat"); r.aggression = clamp(r.aggression + 0.05, 0, 1); }
    if (r.status !== "oorlog" && !r.verdragen.length && R() < 0.1 + r.aggression * 0.12){
      const move = CH(["overname-bod", "spionage", "prijsoorlog", "lobby"]);
      if (move === "overname-bod" && r.cash > s.cash * 1.5 && s.cash < 50){
        mail(ctx, s, r.ceo, "Vriendelijk voorstel", `${r.name} biedt aan je bedrijf te 'redden'. Lees tussen de regels. Dit is een bod, geen vriendschap.`, "HOOG");
        s.flags["reddingsbod_" + r.name] = played; rep.push(`${r.name} doet overname-bod`);
      } else if (move === "spionage"){
        mail(ctx, s, "Head of Security", `Spionageactiviteit door ${r.name}?`, "Ongeautoriseerde toegang tot een testserver. Ik kan het niet bewijzen. Nog niet.");
        s.flags["spionage_" + r.name] = played;
      } else if (move === "prijsoorlog"){ s.cash = r1(s.cash - RI(3, 10) * diff * omvang(s)); r.cash = r1(r.cash - RI(3, 10)); rep.push(`Prijsoorlog met ${r.name}`); }
      else if (move === "lobby"){ s.reputation = clamp(s.reputation - 2); rep.push(`${r.name} lobbyt tegen je`); }
    }
  }

  rivalAI(s, ctx, diff);
  navalTick(s, ctx, diff);
  gangTick(s, ctx, diff);
  crewTick(s, ctx); legerTick(s, ctx); dreigTick(s, ctx, diff); planTick(s, ctx, diff); focusTick(s, ctx);

  for (const e of EVENTS){
    if (e.when(s) && R() < eventProb(s, e, diff)){
      applyEffect(s, {...e.effect, cash: (e.effect.cash || 0) * omvang(s)});
      const dist = CH(s.districts).name, subj = e.subject.replace("{district}", dist);
      mail(ctx, s, e.from, subj, e.body, e.prio); rep.push(`Event: ${subj}`);
    }
  }

  if (s.reputation < 25) s.reputation = clamp(r1(s.reputation + (25 - s.reputation) * 0.04)); /* 5.6.1: mensen vergeten; een lage reputatie herstelt langzaam vanzelf */
  s.accounts.operationeel = s.cash;
  lingeringTick(s, ctx, diff); invoicesTick(s, ctx, diff); marketTick(s, ctx); factionTick(s, ctx);
  npcTick(s, ctx); nomadDemandTick(s, ctx); chaosTick(s, ctx, diff); rumorTick(s, ctx); arcsTick(s, ctx, diff);
  sectorTick(s); regionTick(s, ctx); bedrijfTick(s, ctx); bedrijfLeven(s, ctx); peopleTick(s, ctx, diff);
  specialTick(s, ctx); productTick(s, ctx); { const pe = productEffectTick(s); if (pe.heat) gz.hDelen.push(["Producten", r1(pe.heat)]); if (pe.morale) gz.mDelen.push(["Producten", r1(pe.morale)]); } productEventTick(s, ctx); tijdlijnTick(s, ctx); spanningTick(s, ctx); corpoTick(s, ctx); domTick(s, ctx); assistentTick(s, ctx); aanvraagTick(s, ctx); regioTick(s); grondstofTick(s, ctx); patentTick(s, ctx); onderzoekTick(s, ctx); beursTick(s, ctx); eigenPlanTick(s, ctx); ceoTick(s, ctx); hoofdTick(s, ctx); vraagTick(s); rivalProductTick(s); wereldInvloedProducten(s); eraTick(s, ctx); if (s.date.month === 12) jaarTick(s, ctx); marktTick(s); klusTick(s);
  s.accounts.operationeel = s.cash; s.hidden_truth = s.hidden_truth.slice(-30);

  let status = "actief";
  if (s.cash < 0){
    s.flags.negatieve_cash_maanden = (s.flags.negatieve_cash_maanden || 0) + 1;
    const left = 3 - s.flags.negatieve_cash_maanden;
    mail(ctx, s, "CFO", "Cash is negatief", "We betalen onze leveranciers met rente. " + (left > 0 ? `Nog ${left} maand(en) zo en de rechtbank beslist voor ons.` : "Het is op."), "KRITIEK");
    if (s.flags.negatieve_cash_maanden >= 3) status = "FAILLIET";
  } else s.flags.negatieve_cash_maanden = 0;
  s.flags.lage_morale = s.morale < 10 ? (s.flags.lage_morale || 0) + 1 : 0;
  if (s.flags.lage_morale >= 2 && R() < 0.5) status = "COUP IN DE RAAD";
  else if (s.morale < 20) mail(ctx, s, "Anoniem", "De raad vergadert zonder u", "Drie bestuursleden lunchten gisteren samen. U stond niet op de lijst.", "HOOG");
  s.flags.hoge_heat = s.heat > 90 ? (s.flags.hoge_heat || 0) + 1 : 0;
  if (s.flags.hoge_heat >= 2 && R() < 0.4 * (heeftWet(s, "rechtspraak") ? 0.5 : 1)) status = "RAZZIA / VERVOLGING";
  else if (s.heat > 75) mail(ctx, s, "Juridische Zaken", "Er wordt een dossier opgebouwd", "Een bevriende griffier zegt dat ons dossier dikker wordt. Bij de huidige heat is een inval een kwestie van tijd.", "KRITIEK");
  if (s.flags.overgenomen){ delete s.flags.overgenomen; status = "OVERGENOMEN"; }
  statsTick(s); gezondheidEind(s, gz, ctx);
  { const runway = net < 0 && s.cash > 0 ? s.cash / -net : 99;
    if (runway < 6 && !s.flags.waarsch_cash){ s.flags.waarsch_cash = true; mail(ctx, s, "CFO", "We verliezen geld", `Deze maand ${net}M netto. In dit tempo is de kas over ongeveer ${Math.max(1, Math.round(runway))} maand(en) leeg. Na drie maanden rood beslist de rechtbank.\n\nWat helpt: minder crew of personeel, een uitbreiding uitstellen, een product lanceren, zwart geld overboeken (Financiën), of een lening zolang de bank nog wil.`, "KRITIEK"); }
    if (runway > 12) delete s.flags.waarsch_cash; }
  if (status === "actief") status = eindCheck(s);
  s.status = status;
  if (status !== "actief"){ if (!status.startsWith("OVERWINNING") && status !== "EINDE TERMIJN") mail(ctx, s, "Raad van Bestuur", `Einde: ${status}`, `Per ${played} is het voorbij. Status: ${status}. Het archief wordt verzegeld.`, "KRITIEK");
    else mail(ctx, s, "Raad van Bestuur", status.startsWith("OVERWINNING") ? "Gewonnen" : "Uw termijn zit erop", status.startsWith("OVERWINNING") ? `${status.slice(13).toLowerCase()}. De aandeelhouders staan op hun stoelen. Uw naam komt op de gevel van het hoofdkantoor.` : "De raad bedankt u. Het bedrijf gaat verder, met of zonder u. Uw score staat vast.", "KRITIEK");
    eindRapport(s, ctx, status); }

  const shown = {cash: s.cash, net, heat: s.heat};
  if (s.flags.cfo_manipuleert){
    shown.cash = r1(s.cash * U(1.05, 1.2) + U(2, 8)); shown.net = r1(net + Math.abs(net) * U(0.1, 0.3) + U(1, 4)); shown.heat = clamp(s.heat - U(3, 8));
  }
  const risks = [shown.cash < 30 && "Cash laag", shown.heat > 40 && "Heat hoog", s.morale < 40 && "Morale laag", s.reputation < 30 && "Reputatie zwak",
    s.debt > shown.cash && "Schuld", s.invoices.some(i => i.overdue) && "Achterstallige facturen"].filter(Boolean).slice(0, 3);
  const waiting = Object.keys(s.flags).filter(k => k.startsWith("wacht_op_speler_") && s.flags[k]).map(k => k.slice(16));
  const report = `# Maandrapport ${played}\n\n*Bedragen in M€ (miljoen euro). Opgesteld door de CFO.*\n\n| Item | Waarde |\n|---|---|\n` +
    `| Cash | ${shown.cash} (was ${start}) |\n| Omzet | ${r1(rev)} |\n| Kosten | ${r1(cost)} (lonen ${r1(payroll)}, rente ${r1(interest)}, projecten ${r1(projCost)}) |\n` +
    `| Netto (voor facturen) | ${shown.net} |\n| Facturen betaald | ${ctx.facturen || 0} |\n| Netto na facturen | ${r1(shown.net - (ctx.facturen || 0))} |\n| Schuld | ${s.debt} |\n| Open facturen | ${s.invoices.length} (€${r1(s.invoices.reduce((a, i) => a + i.amount, 0))}M) |\n` +
    `| Zwart / offshore | ${s.accounts.zwart} / ${s.accounts.offshore} |\n| Personeel | ${s.staff.count} (nodig ${staffNeed(s)}) |\n| Oorlogen | ${atWar(s).map(r => r.name).join(", ") || "geen"} |\n| Heat | ${r1(shown.heat)} |\n| Reputatie | ${r1(s.reputation)} |\n| Morale | ${r1(s.morale)} |\n| Status | ${status} |\n\n` +
    (lines.length ? `| Divisie | Omzet | Kosten |\n|---|---|---|\n${lines.join("\n")}\n\n` : "") +
    `**Projecten:** ${s.projects.map(p => `${p.name} (${p.eta_months} mnd)`).join("; ") || "geen"}\n\n` +
    `**Top risico's:** ${risks.join(", ") || "Geen acute risico's. Verdacht."}\n\n**Gebeurd:** ${rep.join("; ") || "Niets noemenswaards."}\n` +
    (waiting.length ? `\n**Wacht op uw besluit:** ${waiting.join(", ")}\n` : "");
  mail(ctx, s, "CFO", `Maandrapport ${played}`, report);
  ctx.reportIndex = ctx.mails.length - 1;
  s.maanden = maandenGespeeld(s) + 1;
  try { adviesTick(s); } catch(e){ foutLog && foutLog("adviesTick", e); }
  s.history.push({m: played, cash: shown.cash, netto: shown.net, omzet: r1(rev), kosten: r1(cost), heat: r1(shown.heat), rep: r1(s.reputation), morale: r1(s.morale), waarde: playerValue(s)}); /* 5.16: waarde voor het jaaroverzicht */
  divHistTick(s);
  s.history = s.history.slice(-48); s.log = s.log.slice(-200);
  s.laatste_rapport = {maand: played, netto: shown.net, omzet: r1(rev), kosten: r1(cost), cash_offset: r1(shown.cash - s.cash), heat_offset: r1(shown.heat - s.heat), gebeurd: rep};
  addLog(s, `Maand gespeeld: netto ${shown.net >= 0 ? "+" : ""}${shown.net}M${status !== "actief" ? " · " + status : ""}`);
  if (status === "actief"){ const d = s.date; d.month += 1; if (d.month > 12){ d.month = 1; d.year += 1; } }
  ctx.inTick = false;
  if ((ctx.klein || []).length && ctx.mails[ctx.reportIndex]) ctx.mails[ctx.reportIndex].body += `\n**Ook deze maand:**\n${ctx.klein.map(k => `- **${k.onderwerp}** (${k.van}): ${String(k.body).split(/(?<=[.!?])\s/)[0]}`).join("\n")}\n`;
  return ctx;
}

/* ---------- de stad: elke game een andere kaart ---------- */
const VERSION = "6.14";
const MAP_W = 1000, MAP_H = 680;
const RIVAL_COLORS = ["#ff9a1f", "#3d7bff", "#c6ff2e", "#f2f2f2", "#9b5cff", "#ffd400", "#ff4d4d"];
const ARCH = {
  haven: {names: ["Haven", "Dokken", "Kadewijk", "Pier Zeven", "Containerveld"], inc: [5, 7], upk: [2, 2], kust: true, tags: ["haven"], lore: "Docks, containers en smokkel. Goedkope logistiek, een sterke vakbond, en de zee als achterdeur."},
  industrie: {names: ["Staal", "Smeltwijk", "Ovenbuurt", "Ketelveld"], inc: [6, 8], upk: [3, 3], tags: ["industrie"], lore: "Fabrieken en lage lonen. Veel arbeid, veel stof, weinig vragen."},
  corporate: {names: ["Glas", "Torenveld", "Spiegelstad", "Het Atrium"], inc: [9, 11], upk: [5, 6], tags: ["corporate"], lore: "Corpotorens. Prestige, dure grond en privébeveiliging op elke hoek."},
  oud: {names: ["Oude Stad", "Stadhuiswijk", "Grachtengordel", "Het Gerecht"], inc: [4, 6], upk: [2, 2], tags: ["bestuur"], lore: "Politie, bank en bureaucratie. Hier worden vergunningen en kredieten geregeld."},
  transit: {names: ["De Kruising", "Knooppunt", "Spoorhart", "Viaduct"], inc: [7, 9], upk: [3, 3], tags: ["transit"], lore: "Alles komt hier langs: treinen, data, mensen en wat ze bij zich hebben."},
  nacht: {names: ["Neon Mile", "Lichtkwartier", "De Gloed", "Kitschkade"], inc: [7, 9], upk: [3, 4], tags: ["straat", "media"], lore: "Media, nachtleven en vice. Wie hier gezien wordt, bestaat."},
  sloppen: {names: ["Roest", "Kolenkuil", "De Put", "Blikstad"], inc: [2, 4], upk: [1, 1], tags: ["straat"], lore: "Armoede en zwarte markt. Goedkope rekruten, dure fouten."},
  campus: {names: ["Campus", "Laboratoria", "Kennisheuvel", "Instituut"], inc: [5, 7], upk: [2, 3], tags: ["onderzoek"], lore: "Universiteit en labs. Talent, onderzoek en studenten met schulden."},
  data: {names: ["Koelvelden", "Serverpark", "De Stroom"], inc: [7, 9], upk: [4, 4], tags: ["data"], lore: "Datacentra en koeltorens. Wie hier zit, ziet alles langskomen."},
  markt: {names: ["Zwarte Bazaar", "Marktveld", "De Ruil"], inc: [5, 7], upk: [2, 2], tags: ["straat", "handel"], lore: "Handel zonder kassabon. Alles is te koop, ook stilte."},
  villa: {names: ["Heuvelrand", "Lindenhof", "Het Park"], inc: [6, 8], upk: [3, 4], tags: ["elite"], lore: "Villa's achter hekken. Geld, connecties en advocaten met een eigen ingang."},
};
const CITY_NAMES = ["Meridian Bay", "Nieuw-Kaapstad", "Vexholm", "Port Aurel", "Zuiderkap", "Grauwhaven", "Nordmund", "Galeborg", "Lichthaven", "Kalmar Delta", "Ostrava Kust", "Saltmere"];
const SEA_NAMES = ["De Noordgeul", "Olievlakte", "Wrakkenveld", "Zoutkanaal", "Grijze Rede", "De Diepte", "Ankerbank", "Mistgat"];
function shuffleR(a, rng){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function clipHalf(poly, a, b, c){
  const out = [];
  for (let i = 0; i < poly.length; i++){
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const pin = a * P[0] + b * P[1] <= c + 1e-9, qin = a * Q[0] + b * Q[1] <= c + 1e-9;
    if (pin) out.push(P);
    if (pin !== qin){ const t = (c - a * P[0] - b * P[1]) / (a * (Q[0] - P[0]) + b * (Q[1] - P[1])); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
  }
  return out;
}
function cellOf(i, sites, land){
  let poly = land; const [x1, y1] = sites[i];
  for (let j = 0; j < sites.length && poly.length >= 3; j++){
    if (j === i) continue; const [x2, y2] = sites[j];
    poly = clipHalf(poly, x2 - x1, y2 - y1, (x2 * x2 + y2 * y2 - x1 * x1 - y1 * y1) / 2);
  }
  return poly;
}
function centroid(poly){
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++){ const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length], f = x0 * y1 - x1 * y0; A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
  A /= 2; if (Math.abs(A) < 1e-6) return poly[0]; return [cx / (6 * A), cy / (6 * A)];
}
function genDistricts(seed){
  const rng = seeded("stad:" + seed), n = 10 + Math.floor(rng() * 4);
  const list = ["haven", "haven", "industrie", "corporate", "oud", "transit", "nacht", "sloppen", "campus"];
  const extra = ["data", "markt", "villa", "industrie", "sloppen", "transit", "haven", "nacht"];
  while (list.length < n) list.push(extra[Math.floor(rng() * extra.length)]);
  const used = new Set();
  return list.map((a, i) => {
    const A = ARCH[a]; let nm = A.names[0];
    for (let k = 0; k < 12; k++){ nm = A.names[Math.floor(rng() * A.names.length)]; if (!used.has(nm)) break; }
    if (used.has(nm)) nm = nm + " " + ["Noord", "Zuid", "Oost", "West"][i % 4]; used.add(nm);
    return {id: String.fromCharCode(65 + i), name: nm, arch: a, control: "neutral",
      income: A.inc[0] + Math.round(rng() * (A.inc[1] - A.inc[0])), upkeep: A.upk[0] + Math.round(rng() * (A.upk[1] - A.upk[0])), lore: A.lore, tags: [...A.tags]};
  });
}
function genGeometry(seed, districts, city){
  const rng = seeded("geo:" + seed), W = MAP_W, H = MAP_H, n = districts.length;
  const p1 = rng() * 6.28, p2 = rng() * 6.28, bayX = 250 + rng() * 500, bayW = 70 + rng() * 60, bayD = 40 + rng() * 55;
  const coastY = x => 95 + 26 * Math.sin(x / 95 + p1) + 13 * Math.sin(x / 31 + p2) + bayD * Math.exp(-(((x - bayX) / bayW) ** 2));
  const coast = []; for (let x = 0; x <= W; x += 20) coast.push([x, coastY(x)]);
  const land = [...coast, [W, H], [0, H]];
  let sites = [], minD = Math.sqrt(W * (H - 140) / n) * 0.72, tries = 0;
  while (sites.length < n && tries < 8000){
    tries++; const x = 30 + rng() * (W - 60), y = 130 + rng() * (H - 160);
    if (y < coastY(x) + 35) continue;
    if (sites.every(s => Math.hypot(s[0] - x, s[1] - y) > minD)) sites.push([x, y]);
    if (tries % 1500 === 0) minD *= 0.9;
  }
  while (sites.length < n) sites.push([60 + rng() * (W - 120), 260 + rng() * (H - 300)]);
  let cells;
  for (let it = 0; it < 3; it++){ cells = sites.map((_, i) => cellOf(i, sites, land)); sites = cells.map((c, i) => c.length > 2 ? centroid(c) : sites[i]); }
  cells = sites.map((_, i) => cellOf(i, sites, land));
  const xs = [0, Math.round(300 + rng() * 80), Math.round(620 + rng() * 80), W];
  const names = shuffleR([...SEA_NAMES], rng); names[1] = "Baai van " + city.split(/[ -]/)[0];
  const zones = [0, 1, 2].map(k => {
    const top = [[xs[k], 0], [xs[k + 1], 0]], cps = [[xs[k + 1], coastY(xs[k + 1])], ...coast.filter(p => p[0] > xs[k] && p[0] < xs[k + 1]).reverse(), [xs[k], coastY(xs[k])]];
    const poly = [...top, ...cps];
    return {id: "Z" + (k + 1), naam: names[k], bonus: 2 + Math.round(rng()), poly: poly.map(p => [Math.round(p[0]), Math.round(p[1])]), lx: Math.round((xs[k] + xs[k + 1]) / 2), ly: 34};
  });
  const coastal = cells.map(c => { const zs = new Set(); for (const [x, y] of c) if (y <= coastY(x) + 1.5) zs.add(x < xs[1] ? 0 : x < xs[2] ? 1 : 2); return [...zs]; });
  const idx = cells.map((_, i) => i), coastCells = shuffleR(idx.filter(i => coastal[i].length), rng), innerCells = shuffleR(idx.filter(i => !coastal[i].length), rng);
  const order = districts.map((_, i) => i).sort((a, b) => ((ARCH[districts[b].arch] || {}).kust ? 1 : 0) - ((ARCH[districts[a].arch] || {}).kust ? 1 : 0));
  const assign = {};
  for (const di of order){ const kust = (ARCH[districts[di].arch] || {}).kust; assign[di] = kust ? (coastCells.pop() ?? innerCells.pop()) : (innerCells.pop() ?? coastCells.pop()); }
  const shared = (a, b) => { let k = 0; for (const p of a) for (const q of b) if (Math.abs(p[0] - q[0]) < 0.75 && Math.abs(p[1] - q[1]) < 0.75){ k++; break; } return k; };
  const out = {};
  districts.forEach((d, di) => {
    const ci = assign[di], c = cells[ci], cen = centroid(c);
    out[d.id] = {poly: c.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]), cx: Math.round(cen[0]), cy: Math.round(cen[1])};
    d.zee = coastal[ci].map(k => "Z" + (k + 1));
    d.neighbors = districts.filter((e, ei) => ei !== di && shared(c, cells[assign[ei]]) >= 2).map(e => e.id);
  });
  return {seed, city, w: W, h: H, land: land.map(p => [Math.round(p[0]), Math.round(p[1])]), zones, cells: out};
}
const CITY_CACHE = {};
function genCity(seed){
  if (CITY_CACHE[seed]) return CITY_CACHE[seed];
  const city = CITY_NAMES[Math.floor(seeded("naam:" + seed)() * CITY_NAMES.length)];
  const districts = genDistricts(seed), map = genGeometry(seed, districts, city);
  return CITY_CACHE[seed] = {districts, map};
}
function buildMapForExisting(s){
  const NA = {"Haven": "haven", "Staal": "industrie", "Glas": "corporate", "Oude Stad": "oud", "De Kruising": "transit", "Neon Mile": "nacht", "Roest": "sloppen", "Campus": "campus"};
  for (const d of s.districts){ d.arch ??= NA[d.name] || "transit"; d.tags ??= [...(ARCH[d.arch] || ARCH.transit).tags]; }
  s.city ??= "Meridian Bay";
  s.map = genGeometry("oud:" + (s.player.corp_name || "x"), s.districts, s.city);
}
function ownerColor(s, o){ if (o === "player") return (typeof stijlKleuren === "function" && s.huisstijl && (stijlKleuren(s.huisstijl).k || {}).hex) || (s.huisstijl && s.huisstijl.kleur) || "#05d9e8"; /* 6.5: jouw (leesbare) kleur op de kaart */ if (o === "neutral") return s.map && s.map.frame ? "#b8155c" : "#2c1f4f"; const r = s.rivals.find(x => x.name === o); return r && r.kleur ? r.kleur : "#8a8aa0"; }

/* --- zee: eskaders, overwicht per zeezone, konvooioorlog en zeeslagen (in de geest van een grand strategy-marine) --- */
const SHIP_MAX = 16, SHIP_POWER = 4;
const shipCost = s => r1(10 * (DIFF[s.player.difficulty] || 1));
const shipsFree = (o) => (o.schepen || 0) - Object.values(o.inzet || {}).reduce((a, b) => a + b, 0);
function navalLevels(s, owner){
  if (owner === "player") return s.divisions.filter(x => x.type === "Logistiek" || x.type === "Smokkel").reduce((a, x) => a + x.level, 0);
  const r = s.rivals.find(x => x.name === owner); return r ? (r.divs.Logistiek || 0) + (r.divs.Smokkel || 0) : 0;
}
function fleetIn(s, owner, z){
  if (owner === "player") return (s.inzet || {})[z] || 0;
  const r = s.rivals.find(x => x.name === owner); return r ? (r.inzet || {})[z] || 0 : 0;
}
function seaControl(s){
  if (!s.map) return [];
  return s.map.zones.map(z => {
    const str = {}, kust = {};
    for (const d of s.districts){ if (!(d.zee || []).includes(z.id) || d.control === "neutral") continue; kust[d.control] = (kust[d.control] || 0) + (d.arch === "haven" ? 3 : 1); }
    for (const o of Object.keys(kust)) str[o] = kust[o] * (1 + 0.1 * navalLevels(s, o));
    const owners = ["player", ...s.rivals.map(r => r.name)];
    for (const o of owners){ const f = fleetIn(s, o, z.id); if (f) str[o] = (str[o] || 0) + f * SHIP_POWER; }
    for (const o of Object.keys(str)) str[o] = Math.round(str[o] * 10) / 10;
    const tot = Object.values(str).reduce((a, b) => a + b, 0); let dom = null;
    for (const [o, v] of Object.entries(str)) if (tot && v / tot > 0.5) dom = o;
    return {id: z.id, naam: z.naam, bonus: z.bonus, sterkte: str, totaal: tot, dominant: dom, vloten: Object.fromEntries(owners.map(o => [o, fleetIn(s, o, z.id)]).filter(x => x[1]))};
  });
}
function reachable(s, owner, d){
  if (!d) return false; if (d.control === owner || !s.map) return true;
  if (s.districts.some(x => x.control === owner && (d.neighbors || []).includes(x.id))) return true;
  const sea = seaControl(s).filter(z => z.dominant === owner).map(z => z.id);
  return (d.zee || []).some(z => sea.includes(z));
}
function actShip(s){
  if ((s.schepen || 0) >= SHIP_MAX) return {ok: false, msg: `Maximaal ${SHIP_MAX} eskaders.`};
  if (!s.districts.some(d => d.control === "player" && (d.zee || []).length)) return {ok: false, msg: "Je hebt geen kustgebied. Zonder haven geen vloot."};
  const kost = shipCost(s); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  s.cash = r1(s.cash - kost); s.schepen = (s.schepen || 0) + 1; s.accounts.operationeel = s.cash;
  const msg = `Eskader ${s.schepen} te water gelaten: snelle boten, drones en radar. Eenmalig €${kost}M, €1,2M per maand. Wijs het toe aan een zeezone.`;
  addLog(s, msg); return {ok: true, msg};
}
function actDeploy(s, zone, delta){
  if (!s.map.zones.some(z => z.id === zone)) return {ok: false, msg: "Onbekende zeezone."};
  s.inzet ??= {}; const cur = s.inzet[zone] || 0;
  if (delta > 0 && shipsFree(s) < 1) return {ok: false, msg: "Geen vrije eskaders. Bouw er een of haal er een weg uit een andere zone."};
  if (delta < 0 && cur < 1) return {ok: false, msg: "Je hebt daar geen eskaders."};
  s.inzet[zone] = cur + (delta > 0 ? 1 : -1); if (!s.inzet[zone]) delete s.inzet[zone];
  return {ok: true, msg: ""};
}
/* elke maand: rivalen bouwen en verplaatsen, en in oorlog wordt er op zee gevochten */
function navalTick(s, ctx, diff){
  const sc = () => seaControl(s);
  for (const r of s.rivals){
    r.schepen ??= (r.vloot || 0) * 2; r.inzet ??= {};
    const coast = [...new Set(rivalDistricts(s, r).flatMap(d => d.zee || []))];
    if (coast.length && r.schepen < 10 && r.cash > 70 + r.schepen * 10 && R() < 0.12 + r.aggression * 0.1){ r.schepen += 1; r.cash = r1(r.cash - 25); }
    // herverdelen: eigen kusten, in oorlog ook waar de speler domineert
    const want = [...coast];
    if (r.status === "oorlog") for (const z of sc()) if (z.dominant === "player" && (coast.includes(z.id) || s.districts.some(d => d.control === "player" && (d.zee || []).includes(z.id)))) want.unshift(z.id);
    r.inzet = {}; if (want.length) for (let i = 0; i < r.schepen; i++){ const z = want[i % want.length]; r.inzet[z] = (r.inzet[z] || 0) + 1; }
  }
  // konvooioorlog: een vijand die een zee beheerst, knijpt de handel van jouw kustgebieden daar af
  let raid = 0;
  for (const z of sc()){
    const r = s.rivals.find(x => x.name === z.dominant && x.status === "oorlog"); if (!r) continue;
    const hit = s.districts.filter(d => d.control === "player" && (d.zee || []).includes(z.id));
    for (const d of hit) raid += d.income * 0.3;
  }
  if (raid){ raid = r1(raid); s.cash = r1(s.cash - raid); ctx.rep.push(`Konvooiaanvallen: -€${raid}M aan handel`); }
  for (const r of s.rivals.filter(x => x.status === "oorlog")){
    let loss = 0; for (const z of sc()) if (z.dominant === "player") for (const d of rivalDistricts(s, r)) if ((d.zee || []).includes(z.id)) loss += d.income * 0.3;
    if (loss){ r.cash = r1(r.cash - loss); r.moeheid = clamp(r.moeheid + 2); }
  }
}

/* ---------- de wereld: echte kaart (Natural Earth, publiek domein), 43 speelbare gebieden, 16 zeezones ---------- */
const CONTINENTS = [
  {naam: "Noord-Amerika", lore: "Ooit één supermacht, nu een lappendeken van staten waar elke corporatie haar eigen wetten koopt."},
  {naam: "Zuid-Amerika", lore: "Grondstoffen, jungle en havens. Wie de wegen en kusten beheerst, beheerst de rijkdom."},
  {naam: "Europa", lore: "Oude landen, nieuwe eigenaren. Regels die op papier streng zijn en in de praktijk te koop."},
  {naam: "Midden-Oosten", lore: "De kruising van drie continenten: pijpleidingen, zeestraten en geld dat nooit slaapt."},
  {naam: "Afrika", lore: "Het snelst groeiende continent: zonnestroom, megasteden en corporaties die om elke vierkante meter vechten."},
  {naam: "Azië", lore: "Het economische hart van de wereld. Megacorporaties die ouder zijn dan sommige staten."},
  {naam: "Oceanië", lore: "Afgelegen, rijk en goed beveiligd. Waar de elite naartoe vlucht."},
];
let WORLD_CACHE = null;
function genWorld(){
  if (WORLD_CACHE) return WORLD_CACHE;
  const D = WORLD_DATA, frame = D.frame, all = [];
  for (const z of D.zones) for (const a of z.anchors) all.push({z, a});
  const zones = D.zones.map(z => ({id: z.id, naam: z.naam, bonus: z.bonus, lx: z.lx, ly: z.ly, polys: []}));
  all.forEach((x, i) => { const poly = cellOf(i, all.map(y => y.a), frame); if (poly.length > 2) zones.find(z => z.id === x.z.id).polys.push(poly.map(p => [Math.round(p[0]), Math.round(p[1])])); });
  for (const z of zones) z.poly = z.polys[0];
  const districts = D.territories.map(t => ({id: t.id, name: t.name, kort: t.kort, continent: t.continent, arch: t.arch, control: "neutral", income: t.income, upkeep: t.upkeep, lore: t.lore, tags: [...((ARCH[t.arch] || {}).tags || [])], zee: t.zee, neighbors: t.neighbors}));
  const cells = {}; for (const t of D.territories) cells[t.id] = {d: t.d, cx: t.cx, cy: t.cy};
  return WORLD_CACHE = {districts, map: {kind: "wereld", versie: 2, city: "Wereld", w: D.w, h: D.h, frame, continents: CONTINENTS, zones, cells}};
}

/* ---------- dominantie: aandeel per continent en per zee, drempels, opbrengst per beurt ---------- */
const DOM_TIERS = [
  {min: 25, naam: "Voet aan de grond", geld: 0, inv: 1},
  {min: 50, naam: "Dominant", geld: 1, inv: 2},
  {min: 80, naam: "Hegemonie", geld: 2, inv: 4},
];
const SEA_TIERS = [
  {min: 50, naam: "Overwicht", geld: 1, inv: 0},
  {min: 80, naam: "Zeeheerschappij", geld: 2, inv: 1},
];
const SEA_MIN = 6; // zonder echte vloot geen zeeheerschappij
function tierOf(pct, tiers = DOM_TIERS){ let t = null; for (const x of tiers) if (pct >= x.min) t = x; return t; }
function nextTier(pct, tiers = DOM_TIERS){ return tiers.find(x => pct < x.min) || null; }
function regionDominance(s){
  const conts = [...new Set(s.districts.map(d => d.continent).filter(Boolean))];
  const namen = new Set(["player", ...s.rivals.map(r => r.name)]);
  return conts.map(c => {
    const ds = s.districts.filter(d => d.continent === c), tot = ds.reduce((a, d) => a + d.income, 0), by = {};
    for (const d of ds){ if (d.dom){ for (const [o, v] of Object.entries(d.dom)) if (namen.has(o)) by[o] = (by[o] || 0) + d.income * v / 100; } else if (d.control !== "neutral") by[d.control] = (by[d.control] || 0) + d.income; } /* 5.6: aandelen per district */
    const shares = Object.entries(by).map(([o, v]) => ({o, pct: Math.round(v / tot * 100)})).sort((a, b) => b.pct - a.pct);
    return {soort: "continent", id: c, naam: c, totaal: tot, waarde: Math.max(2, Math.round(tot * 0.12)), shares, gebieden: ds.length};
  });
}
function dominanceIncome(s, owner){
  let geld = 0, inv = 0; const regels = [];
  for (const r of regionDominance(s)){
    const sh = r.shares.find(x => x.o === owner), pct = sh ? sh.pct : 0, t = tierOf(pct);
    if (t){ const g = r.waarde * t.geld; geld += g; inv += t.inv; regels.push({soort: "continent", naam: r.naam, pct, tier: t.naam, geld: g, inv: t.inv}); }
  }
  for (const z of seaControl(s)){
    const v = z.sterkte[owner] || 0, pct = z.totaal ? Math.round(v / z.totaal * 100) : 0, t = v >= SEA_MIN ? tierOf(pct, SEA_TIERS) : null;
    if (t){ const g = z.bonus * t.geld; geld += g; inv += t.inv; regels.push({soort: "zee", naam: z.naam, pct, tier: t.naam, geld: g, inv: t.inv}); }
  }
  return {geld: r1(geld), inv, regels};
}
/* invloed besteden: een soort politieke macht die je per beurt opbouwt */
const INFLUENCE = {
  pers: {label: "Mediacampagne", kost: 20, uitleg: "Reputatie +5."},
  rust: {label: "Rust in de straat", kost: 20, uitleg: "Heat -8: de juiste mensen kijken even de andere kant op."},
  lobby: {label: "Lobbyen", kost: 25, uitleg: "Een factie naar keuze +15."},
  diplomatie: {label: "Diplomatieke druk", kost: 30, uitleg: "Relatie met een rivaal naar keuze +15."},
  vergunning: {label: "Vergunning op maat", kost: 35, uitleg: "Je volgende vestiging kost geen geld, alleen de opbouwtijd."},
};
function actInfluence(s, kind, target){
  const a = INFLUENCE[kind]; if (!a) return {ok: false, msg: "Onbekende actie."};
  if ((s.invloed || 0) < a.kost) return {ok: false, msg: `Niet genoeg invloed (${a.kost} nodig, je hebt ${Math.floor(s.invloed || 0)}).`};
  let msg;
  if (kind === "pers"){ s.reputation = clamp(s.reputation + 5); msg = "De campagne loopt: reputatie +5."; }
  else if (kind === "rust"){ s.heat = clamp(s.heat - 8); msg = "Een paar telefoontjes later: heat -8."; }
  else if (kind === "lobby"){ if (!s.factions[target]) return {ok: false, msg: "Kies een factie."}; shiftFaction(s, target, 15); msg = `Gelobbyd bij ${target}: +15.`; }
  else if (kind === "diplomatie"){ const r = s.rivals.find(x => x.name === target); if (!r) return {ok: false, msg: "Kies een rivaal."}; relShift(r, 15); msg = `Druk via tussenpersonen: relatie met ${r.name} +15.`; }
  else if (kind === "vergunning"){ if (s.flags.vergunning) return {ok: false, msg: "Je hebt al een vergunning klaarliggen."}; s.flags.vergunning = true; msg = "Vergunning geregeld: je volgende vestiging kost geen geld."; }
  s.invloed = r1(s.invloed - a.kost); addLog(s, `Invloed besteed (${a.kost}): ${msg}`);
  return {ok: true, msg};
}
/* oude verzonnen wereldkaart naar de echte wereld, met bezit en al */
const OLD2REAL = {CAS: "CAN", GML: "CAN", MOJ: "USA", AKF: "USA", GOL: "MEX", AMA: "BRA", RPK: "CSU", AND: "AND", LLC: "BNL", RIJ: "DEU", IBP: "IBE", NDS: "SCA", BTZ: "BLK",
  LAG: "NGA", HRN: "HRN", KAP: "ZAF", SZS: "MAG", NKP: "JPN", HDC: "CHN", MKV: "IDC", BNG: "IND", SIB: "RUS", ZKG: "AUS", TVZ: "PAC"};
function upgradeToRealWorld(s){
  const W = genWorld(), nd = clone(W.districts), conv = id => OLD2REAL[id] || id;
  s.player.home_district = conv(s.player.home_district);
  const home = nd.find(x => x.id === s.player.home_district) || nd.find(x => x.id === "BNL"); s.player.home_district = home.id; home.control = "player";
  for (const d of s.districts) if (d.control !== "neutral"){ const t = nd.find(x => x.id === conv(d.id)); if (t && t.control === "neutral") t.control = d.control; }
  for (const r of s.rivals){
    let t = nd.find(x => x.id === conv(r.hq));
    if (!t || (t.control !== "neutral" && t.control !== r.name)){ const free = nd.filter(x => x.control === "neutral" && x.continent !== home.continent); t = free[Math.floor(R() * free.length)]; }
    if (t){ r.hq = t.id; t.control = r.name; }
    r.kleur = undefined; r.inzet = {};
  }
  for (const p of s.projects){ if (p.district) p.district = conv(p.district); if (p.on_complete && p.on_complete.district_control) p.on_complete.district_control = conv(p.on_complete.district_control); }
  for (const o of s.aanbiedingen || []) if (o.district) o.district = conv(o.district);
  s.districts = nd; s.map = clone(W.map); s.city = "Wereld"; s.inzet = {};
  if (s.log) addLog(s, "De kaart is bijgewerkt naar de echte wereld. Je bezit en je hoofdkantoor zijn meeverhuisd.");
}

/* ---------- eigen bedrijfssoorten & personeel ---------- */
const PRESETS = {
  veilig: {rev: 7, cost: 4, heat: 0, vol: 0.15, label: "Veilig", uitleg: "Stabiel, weinig marge, geen aandacht"},
  gebalanceerd: {rev: 9, cost: 5.5, heat: 1, vol: 0.3, label: "Gebalanceerd", uitleg: "Gemiddeld in alles"},
  groei: {rev: 11, cost: 7, heat: 1, vol: 0.45, label: "Groei", uitleg: "Duur, schommelt, kan veel opleveren"},
  riskant: {rev: 12, cost: 6, heat: 2, vol: 0.5, label: "Riskant", uitleg: "Hoge marge, trekt aandacht"},
  illegaal: {rev: 14, cost: 4, heat: 4, vol: 0.5, label: "Illegaal", uitleg: "Veel geld, veel heat"},
};
function typeOf(s, t){ return DT[t] || (s && s.custom_types ? s.custom_types[t] : undefined); }
function allTypes(s){ return [...SECTORS, ...Object.keys((s && s.custom_types) || {})]; }
function addCustomType(s, naam, stats, omschrijving){
  naam = String(naam || "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (naam.length < 2) return {ok: false, msg: "Geef de soort een naam."};
  if (typeOf(s, naam)) return {ok: false, msg: "Die soort bestaat al."};
  const cost = clamp(+stats.cost || 5, 3, 8), rev = Math.min(clamp(+stats.rev || 9, 5, 14), cost + 7);
  const ty = {rev: r1(rev), cost: r1(cost), heat: Math.round(clamp(+stats.heat || 0, 0, 4)), vol: Math.round(clamp(+stats.vol || 0.3, 0.1, 0.5) * 100) / 100,
    omschrijving: String(omschrijving || "").slice(0, 240), eigen: true};
  s.custom_types ??= {}; s.custom_types[naam] = ty;
  s.market ??= {}; s.market[naam] ??= {size: 100, player: 0, rivals: Object.fromEntries(s.rivals.map(r => [r.name, 0]))};
  if (s.log) addLog(s, `Nieuwe bedrijfssoort: ${naam} (omzet ${ty.rev}, kosten ${ty.cost}, heat ${ty.heat} per niveau).`);
  return {ok: true, msg: `Soort '${naam}' aangemaakt.`, naam};
}
const SALARY = {laag: 24, marktconform: 30, hoog: 36};
const staffNeed = s => Math.round((6 + s.divisions.reduce((a, d) => a + d.level * 4, 0) + s.districts.filter(d => d.control === "player").length) * (npcActive(s, "staf") ? 0.9 : 1));
function staffFactor(s){ const f = s.staff.count / Math.max(1, staffNeed(s)); return f >= 1 ? 1 : 0.45 + 0.55 * f; }
function actStaff(s, kind, n){
  n = Math.round(+n || 0); const hard = s.culture.layoff_policy === "hard";
  if (kind === "huren"){
    if (n < 1 || n > 50) return {ok: false, msg: "Kies tussen 1 en 50 mensen."};
    const cost = r1(n * 0.4); if (s.cash < cost) return {ok: false, msg: `Werving kost €${cost}M. Niet genoeg cash.`};
    s.cash = r1(s.cash - cost); s.staff.count += n; s.accounts.operationeel = s.cash;
    const msg = `${n} mensen aangenomen. Werving €${cost}M; loonkosten stijgen met ≈€${r1(n * s.staff.avg_salary / 120)}M per maand.`; addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "ontslaan"){
    if (n < 1) return {ok: false, msg: "Kies hoeveel mensen."};
    n = Math.min(n, s.staff.count - 5); if (n < 1) return {ok: false, msg: "Onder de 5 mensen is er geen bedrijf meer."};
    const cost = r1(n * (hard ? 0.4 : 1)); if (s.cash < cost) return {ok: false, msg: `Ontslagvergoedingen kosten €${cost}M. Niet genoeg cash.`};
    s.cash = r1(s.cash - cost); s.staff.count -= n; s.accounts.operationeel = s.cash;
    s.morale = clamp(s.morale - Math.ceil(n / 3) * (hard ? 1 : 1.5)); shiftFaction(s, "vakbond", -Math.ceil(n / (hard ? 1 : 2)));
    const msg = `${n} mensen ontslagen. Vergoedingen €${cost}M. De werkvloer heeft het gezien.`; addLog(s, msg); return {ok: true, msg};
  }
  if (SALARY[kind]){
    const old = s.staff.avg_salary, nw = SALARY[kind]; if (old === nw) return {ok: false, msg: "Dat is al het salarisniveau."};
    s.staff.avg_salary = nw;
    if (nw < old){ s.morale = clamp(s.morale - 6); shiftFaction(s, "vakbond", -8); } else s.morale = clamp(s.morale + 3);
    const msg = `Salarisniveau naar ${kind} (gemiddeld €${nw}M per jaar).`; addLog(s, msg); return {ok: true, msg};
  }
  return {ok: false, msg: "Onbekende actie."};
}

/* ---------- rivalen als echte tegenstanders: economie, macht, diplomatie, oorlog ---------- */
const STATUS_LABEL = {vrede: "vrede", oorlog: "oorlog", wapenstilstand: "wapenstilstand"};
function initRival(r){
  r.divs ??= {[r.sector]: 3};
  r.staff ??= 30 + Math.round(R() * 15);
  r.defensie ??= r.aggression > 0.5 ? 1 : 0;
  r.relatie ??= Math.round(15 - r.aggression * 45);
  r.status ??= "vrede"; r.statusMaanden ??= 0; r.moeheid ??= 0; r.verdragen ??= []; r.schepen ??= (r.vloot || 0) * 2; r.inzet ??= {}; r.hebzucht ??= Math.round(U(0.3, 0.8) * 100) / 100;
  return r;
}
const rivalDistricts = (s, r) => s.districts.filter(d => d.control === r.name);
const playerDistricts = s => s.districts.filter(d => d.control === "player");
function playerPower(s){
  const sec = s.divisions.filter(d => d.type === "Private Security").reduce((a, d) => a + d.level, 0) + s.divisions.filter(d => d.type === "Weapon Manufacturing").reduce((a, d) => a + d.level, 0) * 0.5; /* 6.10: een eigen wapenfabriek telt half mee */
  return Math.round(10 + (s.defensie || 0) * 12 + sec * 8 + s.staff.count / 10 + playerDistricts(s).length * 3 + s.reputation / 10 + (npcActive(s, "macht") ? 6 : 0) + (s.flags.alert ? 8 : 0) + legerMacht(s) + productMacht(s) + patrouilles(s).length * 2);
}
function rivalPower(s, r){
  return Math.round(10 + (r.defensie || 0) * 12 + (r.divs["Private Security"] || 0) * 8 + (r.divs["Weapon Manufacturing"] || 0) * 4 + r.staff / 10 + rivalDistricts(s, r).length * 3);
}
const districtValue = d => Math.round(d.income * 10 + 10);
function freeDistricts(s, exclude){ return s.districts.filter(d => d.control === "neutral" && d.id !== exclude); }
function releaseDistricts(s, r, to = "neutral"){ for (const d of s.districts) if (d.control === r.name) d.control = to; }
function relShift(r, v){ r.relatie = Math.round(clamp(r.relatie + v, -100, 100)); }
function atWar(s){ return s.rivals.filter(r => r.status === "oorlog"); }

function warChance(s, r, mod){ return snapKans(Math.round(clamp(50 + (playerPower(s) - rivalPower(s, r)) * 1.2 + mod + (s.flags.fixer_klus ? 15 : 0) + (s.flags["dossier_" + r.name] ? 15 : 0), 5, 90))); }
function rivalHitChance(s, r, mod){ return clamp(50 + (rivalPower(s, r) - playerPower(s)) * 1.2 + mod, 10, 85); }
const WAR = {
  sabotage: {label: "Sabotage", uitleg: "Brand in een loods, kapotte machines, zendingen die verdwijnen.", kost: 5, mod: 0, heat: 4},
  hack: {label: "Hack", uitleg: "Hun klantdata stelen en verkopen. Hun klanten gaan twijfelen.", kost: 7, mod: -5, heat: 2},
  smaad: {label: "Smaadcampagne", uitleg: "Journalisten met mapjes, anonieme blogs, een lek op het juiste moment.", kost: 3, mod: 10, heat: 1},
  overval: {label: "Gebied overnemen", uitleg: "Hun vestigingen, contacten en mensen in dat land overnemen.", kost: 14, mod: -10, heat: 8, district: true},
  hq: {label: "Aanval op hun HQ", uitleg: "Alles of niets. Lukt het, dan valt hun bedrijf en neem jij hun districten over.", kost: 45, mod: -30, heat: 15},
};
function defeatRival(s, ctx, r, how){
  const loot = r1(Math.max(0, r.cash) * 0.3);
  releaseDistricts(s, r, how === "oorlog" ? "player" : "neutral");
  s.rivals = s.rivals.filter(x => x !== r);
  for (const m of Object.values(s.market)){ m.player += (m.rivals[r.name] || 0) * 0.4; delete m.rivals[r.name]; }
  s.aanbiedingen = s.aanbiedingen.filter(o => o.rival !== r.name);
  if (how === "oorlog"){
    s.cash = r1(s.cash + loot); s.reputation = clamp(s.reputation - 10); s.heat = clamp(s.heat + 15);
    for (const o of s.rivals){ relShift(o, -15); o.aggression = Math.min(1, Math.round((o.aggression + 0.1) * 100) / 100); remember(o, s, `speler vernietigde ${r.name}`); }
    mail(ctx, s, "Journalist", `${r.name} valt na aanval op hoofdkantoor`, `Het hoofdkantoor van ${r.name} is gisteravond overgenomen. ${r.ceo} is onbereikbaar. Bronnen noemen uw bedrijf. De rest van de stad heeft het ook gezien.`, "KRITIEK");
    addLog(s, `${r.name} verslagen in oorlog. Buit €${loot}M, hun districten zijn van ons.`);
  }
}

/* --- jouw zetten tegen of met een rivaal --- */
function actWar(s, ctx, name, kind, districtId){
  const r = s.rivals.find(x => x.name === name), w = WAR[kind];
  if (!r || !w) return {ok: false, msg: "Onbekende actie."};
  if (r.status !== "oorlog") return {ok: false, msg: `Je bent niet in oorlog met ${r.name}. Verklaar eerst de oorlog.`};
  let target = null;
  if (w.district){ target = s.districts.find(d => d.id === districtId && d.control === r.name && d.id !== r.hq); if (!target) return {ok: false, msg: "Kies een district van hen (niet hun HQ)."};
    if (!reachable(s, "player", target)) return {ok: false, msg: `${target.name} grenst niet aan jouw gebied en ligt niet aan een zee die jij beheerst.`}; }
  if (kind === "hq"){ const hqd = s.districts.find(d => d.id === r.hq); if (hqd && !reachable(s, "player", hqd)) return {ok: false, msg: "Hun hoofdkantoor ligt buiten bereik. Je gebied moet eraan grenzen, of je moet de zee ervoor beheersen."}; }
  if (kind === "hq" && rivalDistricts(s, r).length > 1 && rivalPower(s, r) > playerPower(s) * 0.8) return {ok: false, msg: "Hun HQ is nog te goed beschermd. Neem eerst hun andere districten in of verzwak hun macht."};
  const kost = r1(w.kost * (DIFF[s.player.difficulty] || 1) * (relV(s, "fixer") >= 50 ? 0.8 : 1));
  if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  s.cash = r1(s.cash - kost);
  const kans = warChance(s, r, w.mod), roll = rolKans(kans), ok = roll.ok;
  addRoll(s, `${w.label} tegen ${r.name}: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`); delete s.flags.fixer_klus; delete s.flags["dossier_" + r.name];
  s.heat = clamp(s.heat + (ok ? w.heat : w.heat / 2)); s.reputation = clamp(s.reputation - 1); relShift(r, -8);
  let msg;
  if (ok){
    r.moeheid = clamp(r.moeheid + 10);
    if (kind === "sabotage"){ const l = r1(U(15, 30)); r.cash = r1(r.cash - l); if (R() < 0.3 && r.divs[r.sector] > 1) r.divs[r.sector] -= 1; msg = `Sabotage bij ${r.name} geslaagd. Schade bij hen ongeveer €${l}M.`; }
    else if (kind === "hack"){ const l = r1(U(8, 16)), g = r1(U(4, 10)); r.cash = r1(r.cash - l); s.cash = r1(s.cash + g);
      const m = s.market[r.sector]; if (m){ m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.85; m.player += 0.03; } msg = `Hack geslaagd. Hun data leverde €${g}M op en hun klanten twijfelen.`; }
    else if (kind === "smaad"){ r.moeheid = clamp(r.moeheid + 6); const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.9; msg = `De campagne tegen ${r.name} slaat aan. Hun klanten en hun eigen mensen worden onrustig.`; }
    else if (kind === "overval"){ target.control = "player"; r.moeheid = clamp(r.moeheid + 15); r.cash = r1(r.cash - 10); msg = `${target.name} is van ons. ${r.name} is een district kwijt.`; }
    else if (kind === "hq"){ defeatRival(s, ctx, r, "oorlog"); msg = `Hun hoofdkantoor is gevallen. ${r.name} bestaat niet meer.`; }
    remember(r, s, `${w.label.toLowerCase()} door speler`);
  } else {
    r.moeheid = clamp(r.moeheid - 5);
    msg = `${w.label} mislukt. ${r.name} weet wie het was.`;
    if (R() < 0.4){ const l = r1(U(5, 15)); s.cash = r1(s.cash - l); msg += ` Ze sloegen direct terug: €${l}M schade.`; }
    remember(r, s, `mislukte ${w.label.toLowerCase()} door speler`);
  }
  mail(ctx, s, ok ? "Head of Security" : "Juridische Zaken", `${w.label} tegen ${r.name}: ${ok ? "gelukt" : "mislukt"}`, msg + ` (Worp ${roll.txt}.)`, ok ? "NORMAAL" : "HOOG");
  addLog(s, msg); s.accounts.operationeel = s.cash;
  return {ok: true, msg: msg + ` Worp ${roll.txt}.`};
}
function peaceChance(s, r, herstel){ return snapKans(Math.round(clamp(20 + r.moeheid * 0.6 + (playerPower(s) - rivalPower(s, r)) * 0.8 + (+herstel || 0) / 2 + r.relatie * 0.2, 5, 95))); }
function tradeChance(s, r){ return snapKans(Math.round(clamp(35 + r.relatie * 0.6 - r.aggression * 25 + r.hebzucht * 10, 5, 95))); }
function tradeAmount(s, r){ const lv = s.divisions.reduce((a, d) => a + d.level, 0) + Object.values(r.divs).reduce((a, b) => a + b, 0); return r1(2 + lv * 0.4); }
const askPrice = (s, r, d) => Math.round(districtValue(d) * (1.6 - r.relatie / 200) * (0.8 + r.hebzucht * 0.5));
const bidPrice = (s, r, d) => Math.round(districtValue(d) * (0.7 + r.relatie / 400) * (1.1 - r.hebzucht * 0.3));
function actDiplo(s, ctx, name, kind, a = {}){
  const r = s.rivals.find(x => x.name === name); if (!r) return {ok: false, msg: "Die rivaal bestaat niet meer."};
  const roll = () => d100();
  if (kind === "oorlog"){
    if (r.status === "oorlog") return {ok: false, msg: "Jullie zijn al in oorlog."};
    let msg = `Oorlog verklaard aan ${r.name}.`;
    if (r.verdragen.length){ r.verdragen = []; s.reputation = clamp(s.reputation - 6); msg += " Het handelsverdrag is verscheurd; de stad onthoudt woordbreuk."; }
    if (r.status === "wapenstilstand"){ s.reputation = clamp(s.reputation - 8); msg += " Je breekt een wapenstilstand."; }
    const OP = oorlogPrijs(s); r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -40); s.reputation = clamp(s.reputation - OP.rep); s.heat = clamp(s.heat + OP.heat); if (OP.corpo){ r.corpo = true; msg += " Een corpo-oorlog: de staat kijkt weg."; }
    for (const o of s.rivals) if (o !== r){ if (OP.wantrouw) relShift(o, -OP.wantrouw); remember(o, s, `speler verklaarde ${r.name} de oorlog`); }
    remember(r, s, "speler verklaarde de oorlog");
    mail(ctx, s, r.ceo, "Zo zij het", `U heeft gekozen. ${r.name} ook. Vanaf vandaag zijn er geen regels meer tussen ons.`, "KRITIEK");
    addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "vrede"){
    if (r.status !== "oorlog") return {ok: false, msg: "Er is geen oorlog om te beëindigen."};
    const h = Math.max(0, Math.round(+a.bedrag || 0)); if (s.cash < h) return {ok: false, msg: `Je hebt geen €${h}M om te bieden.`};
    const kans = peaceChance(s, r, h), w = rolKans(kans), ok = w.ok;
    addRoll(s, `Vredesvoorstel aan ${r.name}${h ? ` (herstel €${h}M)` : ""}: ${w.txt} → ${ok ? "AANVAARD" : "AFGEWEZEN"}`);
    if (ok){ s.cash = r1(s.cash - h); r.cash = r1(r.cash + h); r.status = "wapenstilstand"; r.statusMaanden = 6; r.moeheid = 0; relShift(r, 20);
      mail(ctx, s, r.ceo, "Wapenstilstand", `Zes maanden. Daarna zien we verder. Breek dit en de hele stad weet wat uw woord waard is.`, "HOOG"); }
    else { relShift(r, -3); mail(ctx, s, r.ceo, "Nee", `${r.name} is nog niet klaar met u.`, "HOOG"); }
    const msg = ok ? `Wapenstilstand met ${r.name} voor 6 maanden.` : `${r.name} weigert vrede. (Worp ${w.txt}.)`;
    addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "handel"){
    if (r.status === "oorlog") return {ok: false, msg: "Geen handel in oorlogstijd."};
    if (r.verdragen.length) return {ok: false, msg: "Er loopt al een handelsverdrag."};
    if (r.relatie < -20) return {ok: false, msg: `${r.name} wil niet eens praten. Verbeter eerst de relatie.`};
    const kans = tradeChance(s, r), bedrag = tradeAmount(s, r), w = rolKans(kans), ok = w.ok;
    addRoll(s, `Handelsverdrag met ${r.name}: ${w.txt} → ${ok ? "GETEKEND" : "AFGEWEZEN"}`);
    if (ok){ r.verdragen.push({type: "handel", bedrag, maanden: 12}); relShift(r, 10);
      mail(ctx, s, r.ceo, "Getekend", `Twaalf maanden samenwerking. Beide kanten verdienen er ongeveer €${bedrag}M per maand aan. Laten we het zakelijk houden.`, "NORMAAL"); }
    else relShift(r, -2);
    const msg = ok ? `Handelsverdrag met ${r.name}: +€${bedrag}M per maand, 12 maanden.` : `${r.name} wijst het handelsverdrag af. (Worp ${w.txt}.)`;
    addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "geschenk"){
    const b = Math.round(+a.bedrag || 0); if (b < 1) return {ok: false, msg: "Kies een bedrag."}; if (s.cash < b) return {ok: false, msg: "Niet genoeg cash."};
    s.cash = r1(s.cash - b); r.cash = r1(r.cash + b); const v = Math.min(30, Math.round(b * 0.8)); relShift(r, v);
    if (r.status === "oorlog") r.moeheid = clamp(r.moeheid + v / 2);
    const msg = `€${b}M aan ${r.name} gegeven. Relatie +${v}.`; addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "koop"){
    const d = s.districts.find(x => x.id === a.district && x.control === r.name);
    if (!d) return {ok: false, msg: "Kies een district van hen."}; if (d.id === r.hq) return {ok: false, msg: "Hun HQ is niet te koop."};
    if (r.status === "oorlog") return {ok: false, msg: "In oorlog verkopen ze niets. Neem het in, of sluit eerst vrede."};
    const p = askPrice(s, r, d); if (s.cash < p) return {ok: false, msg: `Ze vragen €${p}M. Niet genoeg cash.`};
    s.cash = r1(s.cash - p); r.cash = r1(r.cash + p); d.control = "player"; relShift(r, 3);
    const msg = `${d.name} gekocht van ${r.name} voor €${p}M.`; addLog(s, msg); mail(ctx, s, r.ceo, `Verkocht: ${d.name}`, `Het is van u. De sleutels liggen bij de notaris. Ons personeel trekt zich terug.`); return {ok: true, msg};
  }
  if (kind === "verkoop"){
    const d = s.districts.find(x => x.id === a.district && x.control === "player");
    if (!d) return {ok: false, msg: "Kies een district van jou."}; if (d.id === s.player.home_district) return {ok: false, msg: "Je thuisdistrict verkoop je niet."};
    if (r.status === "oorlog") return {ok: false, msg: "Aan de vijand verkopen? Nee."};
    const p = bidPrice(s, r, d); if (r.cash < p) return {ok: false, msg: `${r.name} heeft het geld niet (ze bieden €${p}M).`};
    s.cash = r1(s.cash + p); r.cash = r1(r.cash - p); d.control = r.name; relShift(r, 4);
    const msg = `${d.name} verkocht aan ${r.name} voor €${p}M.`; addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "ruil"){
    const mine = s.districts.find(x => x.id === a.mijn && x.control === "player"), theirs = s.districts.find(x => x.id === a.hun && x.control === r.name);
    if (!mine || !theirs) return {ok: false, msg: "Kies één district van jou en één van hen."};
    if (mine.id === s.player.home_district || theirs.id === r.hq) return {ok: false, msg: "Thuisdistrict en HQ ruil je niet."};
    if (r.status === "oorlog") return {ok: false, msg: "In oorlog ruilt niemand."};
    const ok = districtValue(mine) * (1 + r.relatie / 200) >= districtValue(theirs) * (1.05 + r.hebzucht * 0.2);
    if (!ok){ const msg = `${r.name} vindt ${mine.name} niet genoeg waard voor ${theirs.name}. Leg er geld bij via een aankoop, of verbeter de relatie.`; return {ok: false, msg}; }
    mine.control = r.name; theirs.control = "player"; relShift(r, 2);
    const msg = `Geruild: ${mine.name} naar ${r.name}, ${theirs.name} naar ons.`; addLog(s, msg); return {ok: true, msg};
  }
  return {ok: false, msg: "Onbekende actie."};
}
function actDefense(s){
  const lvl = s.defensie || 0; if (lvl >= 5) return {ok: false, msg: "Beveiliging staat al op het maximum."};
  const kost = r1(15 * (lvl + 1) * (DIFF[s.player.difficulty] || 1)); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  s.cash = r1(s.cash - kost); s.defensie = lvl + 1; s.accounts.operationeel = s.cash;
  const msg = `Beveiliging naar niveau ${s.defensie}. Eenmalig €${kost}M, voortaan €${s.defensie * 2}M per maand.`; addLog(s, msg); return {ok: true, msg};
}
function offerDecide(s, ctx, id, yes){
  const o = s.aanbiedingen.find(x => x.id === id); if (!o) return {ok: false, msg: "Dit aanbod is verlopen."};
  const r = s.rivals.find(x => x.name === o.rival); s.aanbiedingen = s.aanbiedingen.filter(x => x !== o);
  if (!r) return {ok: false, msg: "Die rivaal bestaat niet meer."};
  let msg;
  if (!yes){
    if (o.type === "ultimatum"){ r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -30);
      mail(ctx, s, r.ceo, "Dan niet", "U had de keuze. Vanaf nu is het oorlog.", "KRITIEK"); msg = `Ultimatum van ${r.name} geweigerd. Het is oorlog.`; }
    else { relShift(r, -3); msg = `Aanbod van ${r.name} afgewezen.`; }
    addLog(s, msg); return {ok: true, msg};
  }
  if (o.type === "handel"){ r.verdragen.push({type: "handel", bedrag: o.bedrag, maanden: 12}); relShift(r, 10); msg = `Handelsverdrag met ${r.name}: +€${o.bedrag}M per maand, 12 maanden.`; }
  else if (o.type === "vrede"){ r.status = "wapenstilstand"; r.statusMaanden = 6; r.moeheid = 0; relShift(r, 20); msg = `Wapenstilstand met ${r.name}, 6 maanden.`; }
  else if (o.type === "ultimatum"){ if (s.cash < o.bedrag) return {ok: false, msg: `Je hebt de €${o.bedrag}M niet.`}; s.cash = r1(s.cash - o.bedrag); r.cash = r1(r.cash + o.bedrag); relShift(r, 15); r.aggression = Math.min(1, r.aggression + 0.03); msg = `€${o.bedrag}M betaald aan ${r.name}. Voor nu is het rustig. Ze weten nu wel dat je betaalt.`; }
  else if (o.type === "district_koop"){ const d = s.districts.find(x => x.id === o.district && x.control === "player"); if (!d) return {ok: false, msg: "Dat district is niet meer van jou."}; if (r.cash < o.bedrag) return {ok: false, msg: `${r.name} kan het niet meer betalen.`};
    d.control = r.name; s.cash = r1(s.cash + o.bedrag); r.cash = r1(r.cash - o.bedrag); relShift(r, 4); msg = `${d.name} verkocht aan ${r.name} voor €${o.bedrag}M.`; }
  else if (o.type === "district_verkoop"){ const d = s.districts.find(x => x.id === o.district && x.control === r.name); if (!d) return {ok: false, msg: "Dat district is niet meer van hen."}; if (s.cash < o.bedrag) return {ok: false, msg: `Je hebt de €${o.bedrag}M niet.`};
    d.control = "player"; s.cash = r1(s.cash - o.bedrag); r.cash = r1(r.cash + o.bedrag); relShift(r, 3); msg = `${d.name} gekocht van ${r.name} voor €${o.bedrag}M.`; }
  s.accounts.operationeel = s.cash; addLog(s, msg); return {ok: true, msg};
}

/* --- wat rivalen elke maand zelf doen --- */
function rivalAI(s, ctx, diff){
  const m = ym(s);
  s.aanbiedingen = s.aanbiedingen.filter(o => {
    if (o.verloopt > m) return true;
    const r = s.rivals.find(x => x.name === o.rival);
    if (o.type === "ultimatum" && r && r.status !== "oorlog"){ r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -30);
      mail(ctx, s, r.ceo, "U heeft niet betaald", "Dan betaalt u op een andere manier. Vanaf vandaag is het oorlog.", "KRITIEK"); ctx.rep.push(`${r.name} verklaart de oorlog`); }
    return false;
  });
  const addOffer = (r, type, bedrag, district, tekst, onderwerp) => {
    if (s.aanbiedingen.some(o => o.rival === r.name && o.type === type)) return;
    const d = new Date(s.date.year, s.date.month - 1 + 2, 1);
    s.aanbiedingen.push({id: hex8(), rival: r.name, type, bedrag, district: district || null, verloopt: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`});
    mail(ctx, s, r.ceo, onderwerp, tekst, type === "ultimatum" ? "KRITIEK" : "HOOG");
  };
  for (const r of [...s.rivals]){
    initRival(r);
    // economie
    let inc = 0;
    for (const [sec, lv] of Object.entries(r.divs)){ const t = typeOf(s, sec) || {rev: 8, cost: 5}; inc += lv * (t.rev - t.cost) * 0.8; }
    for (const d of rivalDistricts(s, r)) inc += d.income - d.upkeep;
    inc -= r.defensie * 2 + (r.schepen || 0) * 1.2 + (r.status === "oorlog" ? 3 : 0) + r.staff / 8;
    inc += dominanceIncome(s, r.name).geld + rivalProductInkomen(r);
    for (const v of r.verdragen){ inc += v.bedrag; }
    r.cash = r1(r.cash + inc * U(0.8, 1.2) * (RIVAAL_MULT[s.player.difficulty] || 1));
    // verdragen
    for (const v of r.verdragen){ s.cash = r1(s.cash + v.bedrag); relShift(r, 1); v.maanden -= 1; }
    if (r.verdragen.some(v => v.maanden <= 0)){ mail(ctx, s, r.ceo, "Verdrag afgelopen", "Ons handelsverdrag is verlopen. Als u wilt verlengen, weet u me te vinden."); }
    r.verdragen = r.verdragen.filter(v => v.maanden > 0);
    if (r.verdragen.length) ctx.rep.push(`Handel met ${r.name}: +€${r.verdragen.reduce((a, v) => a + v.bedrag, 0)}M`);
    // relatie zakt terug naar hun aard
    const base = 15 - r.aggression * 45; r.relatie = Math.round(r.relatie + (base - r.relatie) * 0.05 + (r.status === "oorlog" ? -2 : 0));
    // status
    if (r.status === "wapenstilstand" && --r.statusMaanden <= 0){ r.status = "vrede"; mail(ctx, s, "Juridische Zaken", `Wapenstilstand met ${r.name} voorbij`, "De wapenstilstand is afgelopen. Formeel is het vrede. In de praktijk is het afwachten."); }
    if (r.status === "oorlog"){
      r.statusMaanden += 1; r.moeheid = clamp(r.moeheid + 6 + (playerPower(s) > rivalPower(s, r) ? 4 : 0));
      if (r.cash > 60 && r.defensie < 5 && R() < 0.3){ r.defensie += 1; r.cash = r1(r.cash - 25); }
      // aanvallen
      if (R() < 0.35 + r.aggression * 0.3){
        const opts = ["sabotage", "hack", "smaad"]; const mine = playerDistricts(s).filter(d => d.id !== s.player.home_district && reachable(s, r.name, d));
        if (mine.length) opts.push("overval");
        const kind = CH(opts), w = WAR[kind], kans = rivalHitChance(s, r, w.mod), hit = R() * 100 < kans;
        r.cash = r1(r.cash - w.kost * 0.7);
        if (hit){
          let txt;
          if (kind === "sabotage"){ const l = r1(U(10, 22) * diff * clamp(omvang(s), 0.5, 3)); s.cash = r1(s.cash - l); s.morale = clamp(s.morale - 3); txt = `Sabotage door ${r.name}: brand in een loods, €${l}M schade.`; }
          else if (kind === "hack"){ const l = r1(U(6, 14) * diff); s.cash = r1(s.cash - l); for (const d of s.divisions) if (s.market[d.type]) s.market[d.type].player *= 0.93; txt = `${r.name} heeft onze systemen gekraakt. €${l}M weg en klanten twijfelen.`; }
          else if (kind === "smaad"){ s.reputation = clamp(s.reputation - 5); txt = `Een lastercampagne van ${r.name} raakt onze reputatie.`; }
          else { const d = CH(mine); d.control = r.name; txt = `${r.name} heeft ${d.name} ingenomen. Onze mensen zijn eruit gezet.`; }
          mail(ctx, s, "Head of Security", `Aanval: ${w.label.toLowerCase()} door ${r.name}`, txt + " Hun macht tegen de onze bepaalde het.", "KRITIEK");
          ctx.rep.push(txt);
        } else {
          r.moeheid = clamp(r.moeheid + 5);
          mail(ctx, s, "Head of Security", `Aanval afgeslagen`, `${r.name} probeerde een ${w.label.toLowerCase()}. Onze beveiliging hield stand.`, "HOOG");
          ctx.rep.push(`Aanval van ${r.name} afgeslagen`);
        }
      }
      if (r.moeheid > 55 && R() < 0.45) addOffer(r, "vrede", 0, null, `Dit kost ons allebei te veel. Ik stel een wapenstilstand van zes maanden voor. Het aanbod staat tot het einde van volgende maand.`, "Een wapenstilstand?");
      if (r.cash < 0 && R() < 0.5) addOffer(r, "vrede", 0, null, "Laten we eerlijk zijn: niemand wint dit. Wapenstilstand?", "Genoeg");
    } else {
      // vrede: groeien, handelen, dreigen
      const free = freeDistricts(s, s.player.home_district).filter(d => reachable(s, r.name, d));
      if (free.length && maandenGespeeld(s) >= 4 && rivalDistricts(s, r).length < Math.min(10, 3 + Math.floor(maandenGespeeld(s) / 12) * 2) && r.cash > 90 && R() < 0.06 + r.hebzucht * 0.06){
        const d = CH(free), p = districtValue(d) * 0.8;
        if (r.cash > p * 2){ d.control = r.name; r.cash = r1(r.cash - p); news(s, `${r.name} breidt uit naar ${d.name}`, `${r.name} heeft panden, vergunningen en een paar ministers in ${d.name} gekocht. Het gebied is nu van hen.`, d.continent, "markt", (d.neighbors || []).some(n => (s.districts.find(x => x.id === n) || {}).control === "player")); ctx.rep.push(`${r.name} neemt ${d.name}`); }
      }
      const lv = r.divs[r.sector] || 0, inv = 30 + lv * 15;
      if (lv < 8 && r.cash > inv * 2.5 && R() < 0.15){ r.divs[r.sector] = lv + 1; r.staff += 6; r.cash = r1(r.cash - inv); }
      if (r.relatie > 25 && !r.verdragen.length && R() < 0.1) addOffer(r, "handel", tradeAmount(s, r), null, `Wat zou u zeggen van twaalf maanden samenwerking? Beide kanten ongeveer €${tradeAmount(s, r)}M per maand beter af.`, "Een zakelijk voorstel");
      const mine = playerDistricts(s).filter(d => d.id !== s.player.home_district);
      if (mine.length && r.relatie > -20 && R() < 0.05){ const d = CH(mine), p = Math.round(districtValue(d) * U(0.9, 1.35)); if (r.cash > p * 1.2) addOffer(r, "district_koop", p, d.id, `Wij bieden €${p}M voor uw positie in ${d.name}. Een eerlijke prijs, en een die niet lang blijft staan.`, `Bod op ${d.name}`); }
      const theirs = rivalDistricts(s, r).filter(d => d.id !== r.hq);
      if (theirs.length && r.cash < 40 && R() < 0.25){ const d = CH(theirs), p = Math.round(districtValue(d) * U(0.7, 1)); addOffer(r, "district_verkoop", p, d.id, `Wij willen af van ${d.name}. €${p}M en het is van u.`, `Te koop: ${d.name}`); }
      if (r.status === "vrede" && r.relatie < -45 && r.aggression > 0.45 && R() < 0.2){
        const b = Math.round(10 + r.aggression * 30); addOffer(r, "ultimatum", b, null, `Uw bedrijf zit in de weg. €${b}M voor het einde van volgende maand, en we laten u met rust. Zo niet, dan is het oorlog.`, "Ultimatum");
      }
    }
    if (r.cash < -40){ ctx.rep.push(`${r.name} gaat failliet`); mail(ctx, s, "Journalist", `${r.name} failliet`, `${r.name} is omgevallen. Hun districten liggen open.`, "HOOG"); releaseDistricts(s, r); s.rivals = s.rivals.filter(x => x !== r); s.aanbiedingen = s.aanbiedingen.filter(o => o.rival !== r.name); for (const mk of Object.values(s.market)){ mk.player += (mk.rivals[r.name] || 0) * 0.3; delete mk.rivals[r.name]; } }
  }
  // rivalen onderling
  if (s.rivals.length >= 2 && R() < 0.05){
    const [a, b] = [...s.rivals].sort(() => R() - 0.5), loot = rivalDistricts(s, b).filter(d => d.id !== b.hq);
    if (loot.length && rivalPower(s, a) > rivalPower(s, b) * 0.9){ const d = CH(loot); d.control = a.name;
      news(s, `${a.name} neemt ${d.name} over van ${b.name}`, `Een stille oorlog tussen ${a.name} en ${b.name} kost ${b.name} een gebied. Niemand wil commentaar geven.`, d.continent, "oorlog"); ctx.rep.push(`${a.name} neemt ${d.name} van ${b.name}`); }
  }
  // oorlog vreet aan je eigen mensen
  const wars = atWar(s).length; if (wars){ s.morale = clamp(s.morale - wars); s.reputation = clamp(s.reputation - 0.5 * wars); }
}

/* ---------- acties van de speler ---------- */
const loanCap = s => r1(Math.max(0, s.reputation * 4 - s.debt - termijnRest(s) + Math.max(0, s.cash) * 0.5 + (relV(s, "bank") >= 40 ? 50 : 0)));
const districtCost = (s, d) => r1((d.upkeep * 8 + d.income * 4) * (s.rivals.some(r => r.hq === d.id) ? 2 : 1) * (DIFF[s.player.difficulty] || 1) * vestigingMult(s) * (1 + 0.12 * Math.max(0, playerDistricts(s).length - 1)));
const upgradeCost = (s, d) => r1(20 * Math.pow(d.level, 1.3) * (DIFF[s.player.difficulty] || 1));
const newDivCost = s => r1(30 * (DIFF[s.player.difficulty] || 1));

function actTransfer(s, ctx, van, naar, amount){
  const A = ["operationeel", "zwart", "offshore"]; amount = +amount;
  if (!A.includes(van) || !A.includes(naar) || van === naar || !(amount > 0)) return {ok: false, msg: "Kies twee verschillende rekeningen en een bedrag."};
  const bal = van === "operationeel" ? s.cash : s.accounts[van];
  if (bal < amount) return {ok: false, msg: `Onvoldoende saldo op ${van}: €${bal}M.`};
  const pct = (5 + RI(0, 10)) / 100, fee = r1(amount * pct);
  if (van === "operationeel") s.cash = r1(s.cash - amount); else s.accounts[van] = r1(s.accounts[van] - amount);
  if (naar === "operationeel") s.cash = r1(s.cash + amount - fee); else s.accounts[naar] = r1(s.accounts[naar] + amount - fee);
  let risk = Math.min(0.6, 0.05 + amount / 400 + s.heat / 300 + ([van, naar].includes("zwart") ? 0.08 : 0));
  if (faction(s, "politie") > 30) risk *= 0.6;
  const roll = rolKans(snapKans(Math.round(risk * 100))), caught = roll.ok;
  addRoll(s, `Controle bij transfer €${amount}M: ${roll.txt} → ${caught ? "GEMELD" : "onopgemerkt"}`);
  let msg = `€${amount}M van ${van} naar ${naar}. Fee ${Math.round(pct * 100)}% (€${fee}M). Controle: ${caught ? "gemeld" : "onopgemerkt"}.`;
  if (caught){
    s.heat = clamp(s.heat + 6 + amount / 20); s.flags.transfer_onderzoek = ym(s);
    mail(ctx, s, "Nordhavn Bank, afdeling Compliance", "Ongebruikelijke transactie", `Wij hebben een transactie van €${amount}M gemeld bij de toezichthouder. Dit is een standaardprocedure. Wij hopen voor u dat het standaard blijft.`, "HOOG");
  }
  s.accounts.operationeel = s.cash; addLog(s, msg);
  return {ok: true, msg};
}
function actLoan(s, amount){
  amount = +amount; const cap = loanCap(s);
  if (!(amount > 0)) return {ok: false, msg: "Vul een bedrag in."};
  if (amount > cap) return {ok: false, msg: `De bank weigert. Maximaal leenbaar nu: €${cap}M.`};
  const nd = s.debt + amount;
  const rate = Math.round((0.06 + Math.max(0, 50 - s.reputation) / 500 + nd / 3000 + (s.heat > 40 ? 0.03 : 0)) * 1000) / 1000;
  s.debt = r1(nd); s.interest_rate = rate; s.cash = r1(s.cash + amount);
  const msg = `Lening €${amount}M. Totale schuld €${s.debt}M tegen ${r1(rate * 100)}% per jaar (≈ €${r1(s.debt * rate / 12)}M rente per maand).`;
  addLog(s, msg); return {ok: true, msg};
}
function actRepay(s, amount){
  amount = Math.min(+amount || 0, s.debt);
  if (amount <= 0 || s.cash < amount) return {ok: false, msg: `Kan niet aflossen. Schuld €${s.debt}M, cash €${s.cash}M.`};
  s.cash = r1(s.cash - amount); s.debt = r1(s.debt - amount);
  const msg = `€${amount}M afgelost. Resterende schuld €${s.debt}M.`; addLog(s, msg); return {ok: true, msg};
}
function actInvoice(s, id, action){
  const inv = s.invoices.find(i => i.id === id); if (!inv) return {ok: false, msg: "Factuur niet gevonden."};
  if (action === "betaal"){
    if (s.cash < inv.amount) return {ok: false, msg: `Onvoldoende cash voor €${inv.amount}M.`};
    s.cash = r1(s.cash - inv.amount); s.invoices = s.invoices.filter(x => x !== inv);
    if (inv.overdue) s.reputation = clamp(s.reputation + 0.5);
    return {ok: true, msg: `${inv.payee} betaald: €${inv.amount}M.`};
  }
  inv.auto_pay = !inv.auto_pay;
  return {ok: true, msg: `${inv.payee}: ${inv.auto_pay ? "wordt automatisch betaald." : "laten we bewust liggen."}`};
}
function actDecision(s, arc, keuze, budget){
  const f = s.flags; budget = Math.max(0, +budget || 0);
  const pay = (amt, black) => {
    if (black && s.accounts.zwart >= amt){ s.accounts.zwart = r1(s.accounts.zwart - amt); return true; }
    if (s.cash < amt) return false; s.cash = r1(s.cash - amt); return true;
  };
  let line;
  if (arc === "vonk" && f.wacht_op_speler_vonk && ["sponsor", "negeren", "uitgeschakeld"].includes(keuze)){
    const c = {sponsor: 15, negeren: 0, uitgeschakeld: 10}[keuze];
    if (!pay(c, keuze === "uitgeschakeld")) return {ok: false, msg: `Niet genoeg geld (€${c}M nodig).`};
    f.vonk_deal = keuze; delete f.wacht_op_speler_vonk;
    line = {sponsor: "We financieren de tour van Mara Vonk.", negeren: "We negeren Mara Vonk.", uitgeschakeld: "Mara Vonk wordt 'opgelost'."}[keuze];
  } else if (arc === "nomaden_pact" && f.wacht_op_speler_nomaden_pact && ["ja", "nee"].includes(keuze)){
    f.nomad_contract = keuze === "ja"; delete f.wacht_op_speler_nomaden_pact;
    line = keuze === "ja" ? "Pact met de nomaden gesloten." : "Pact met de nomaden geweigerd.";
  } else if (arc === "hostile_bid" && f.wacht_op_speler_hostile_bid && DEFENSES[keuze]){
    const b = ["investeren", "juridisch"].includes(keuze) ? budget : 0;
    if (!pay(b)) return {ok: false, msg: `Niet genoeg cash voor een budget van €${b}M.`};
    s.hostile_bid = {verdediging: keuze, budget: b}; delete f.wacht_op_speler_hostile_bid;
    line = `Verdediging tegen het overnamebod: ${keuze}${b ? ` (budget €${b}M)` : ""}.`;
  } else if (arc === "nomaden_eis" && f.nomaden_eis && ["betalen", "weigeren"].includes(keuze)){
    if (keuze === "betalen"){
      const a = f.nomaden_eis.bedrag; if (!pay(a)) return {ok: false, msg: `Niet genoeg cash (€${a}M).`};
      shiftFaction(s, "nomaden", 3); delete f.nomaden_eis; line = `Isra's gunst betaald (€${a}M).`;
    } else { f.nomaden_eis.genegeerd = true; line = "Isra's eis blijft liggen."; }
  } else return {ok: false, msg: "Dit besluit staat niet (meer) open."};
  s.accounts.operationeel = s.cash; addLog(s, line);
  return {ok: true, msg: line + " De gevolgen merk je na de volgende maand."};
}
function actProject(s, kind, a){
  let cost, proj;
  if (kind === "upgrade"){
    const d = s.divisions.find(x => (x.name || x.type) === a.divisie); if (!d) return {ok: false, msg: "Divisie niet gevonden."};
    const nm = d.name || d.type;
    if (s.projects.some(p => p.division === nm)) return {ok: false, msg: "Daar loopt al een uitbreiding."};
    cost = upgradeCost(s, d);
    proj = {name: `Uitbreiding ${nm} naar L${d.level + 1}`, eta_months: 2, cost_per_month: 2, division: nm,
      done_msg: `${nm} draait nu op niveau ${d.level + 1}. Meer omzet, meer kosten, meer aandacht.`, on_complete: {upgrade_division: nm, levels: 1}};
  } else if (kind === "divisie"){
    const type = a.type, nm = String(a.naam || type).trim().slice(0, 40) || type;
    if (!typeOf(s, type)) return {ok: false, msg: "Onbekend type."};
    if (s.divisions.some(x => x.name === nm) || s.projects.some(p => p.new_name === nm)) return {ok: false, msg: "Die naam bestaat al."};
    cost = newDivCost(s);
    proj = {name: `Opstart ${nm} (${type})`, eta_months: 3, cost_per_month: 3, new_name: nm,
      done_msg: `${nm} is operationeel. Klein begin. De concurrentie heeft het gezien.`, on_complete: {new_division: {name: nm, type, level: 1}}};
    if ((typeOf(s, type).heat || 0) >= 3) proj.on_complete.effect = {heat: 4};
  } else if (kind === "district"){
    const d = s.districts.find(x => x.id === a.id);
    if (!d || d.control === "player") return {ok: false, msg: "Dat district is al van jou."};
    if (d.control !== "neutral") return {ok: false, msg: `${d.name} is in handen van ${d.control}. Koop het van hen of neem het in, via Rivalen.`};
    if (!reachable(s, "player", d)) return {ok: false, msg: `${d.name} ligt buiten bereik. Breid uit via een buurdistrict, of beheers de zee aan die kust.`};
    if (s.projects.some(p => p.district === d.id)) return {ok: false, msg: "Daar loopt al een vestiging."};
    cost = s.flags.vergunning ? 0 : districtCost(s, d); if (s.flags.vergunning) delete s.flags.vergunning;
    proj = {name: `Vestiging in ${d.name}`, eta_months: 3, cost_per_month: 1, district: d.id,
      done_msg: `We hebben voet aan de grond in ${d.name}. Panden, contacten, een paar mensen die ons kennen.`, on_complete: {district_control: d.id}};
    for (const r of s.rivals) if (r.hq === d.id){ remember(r, s, `speler dringt district ${d.id} binnen`); r.aggression = Math.min(1, r1(r.aggression * 100 + 5) / 100); }
  } else return {ok: false, msg: "Onbekend project."};
  if (s.cash < cost) return {ok: false, msg: `Niet genoeg cash: €${cost}M nodig.`};
  s.cash = r1(s.cash - cost); s.accounts.operationeel = s.cash; proj.kost = cost; s.projects.push(proj);
  addLog(s, `Project gestart: ${proj.name} (€${cost}M + €${proj.cost_per_month}M/maand, ${proj.eta_months} mnd).`);
  const rk = projectRisico(s);
  return {ok: true, msg: `${proj.name} gestart. €${cost}M betaald, klaar over ${proj.eta_months} maanden. Risico: ${rk.vertraging}% vertraging, ${rk.mislukt}% mislukt.`};
}
/* ===================== 1.1 WERELD: startvoordeel, markten, nieuws, bedrijven ===================== */
const START_BONUS = {
  haven: {naam: "Havenstaat", uitleg: "Logistiek en Smokkel +20% omzet. Je start met 1 eskader.", sector: {"Logistiek": 0.2, "Smokkel": 0.2}},
  industrie: {naam: "Industrieel hart", uitleg: "Private Security en Weapon Manufacturing +20% omzet, lonen 10% lager en 8 extra mensen bij de start.", sector: {"Private Security": 0.2, "Weapon Manufacturing": 0.2}, loon: 0.9},
  corporate: {naam: "Financieel centrum", uitleg: "Financieel +20% omzet, €30M extra startkapitaal en reputatie +5.", sector: {"Financieel": 0.2}},
  data: {naam: "Datavallei", uitleg: "Media & Data +20% en Cyberware +10% omzet, 10 invloed bij de start.", sector: {"Media & Data": 0.2, "Cyberware": 0.1}},
  nacht: {naam: "Mediahoofdstad", uitleg: "Media & Data +15% omzet, reputatie +8 en de straat +15.", sector: {"Media & Data": 0.15}},
  sloppen: {naam: "Onderwereld", uitleg: "Smokkel +20% omzet, lonen 15% lager en de straat +25, maar heat +5.", sector: {"Smokkel": 0.2}, loon: 0.85},
  campus: {naam: "Kennisstad", uitleg: "Biotech en Cyberware +20% omzet.", sector: {"Biotech": 0.2, "Cyberware": 0.2}},
  transit: {naam: "Kruispunt", uitleg: "Vestigingen 25% goedkoper en Logistiek +10% omzet.", sector: {"Logistiek": 0.1}, vestiging: 0.75},
  markt: {naam: "Zwarte markt", uitleg: "Smokkel +25% omzet, €10M zwart geld bij de start en heat zakt elke maand 1 extra.", sector: {"Smokkel": 0.25}},
  villa: {naam: "Belastingparadijs", uitleg: "€25M offshore bij de start en 2% lagere rente op leningen.", sector: {}},
};
const ARCH_SECTOR = {haven: ["Logistiek", "Smokkel"], industrie: ["Private Security", "Weapon Manufacturing"], corporate: ["Financieel"], data: ["Media & Data", "Cyberware"], nacht: ["Media & Data"],
  sloppen: ["Smokkel"], campus: ["Biotech", "Cyberware"], transit: ["Logistiek"], markt: ["Smokkel"], villa: ["Financieel"]};
const ARCH_LABEL = {haven: "havenstaat", industrie: "industrie", corporate: "financieel centrum", data: "datacentra", nacht: "media en nachtleven", sloppen: "sloppen en zwarte markt",
  campus: "onderzoek", transit: "doorvoer", markt: "handel zonder vragen", villa: "belastingparadijs"};
const startBonus = s => START_BONUS[s.player.startbonus] || null;
function sectorBonus(s, type){
  const b = startBonus(s); let n = 0;
  for (const d of s.districts) if (d.control === "player" && (ARCH_SECTOR[d.arch] || []).includes(type)) n++;
  return 1 + ((b && b.sector[type]) || 0) + Math.min(0.2, n * 0.04);
}
const loonMult = s => ((startBonus(s) || {}).loon || 1) * (1 + 0.06 * (s.tijdperk || 0));   /* 3.9.1: lonen stijgen 6% per tijdperk */
function vestigingMult(s){ let m = (startBonus(s) || {}).vestiging || 1; if (relV(s, "stad") >= 50) m *= 0.85; return m; }
const incOf = d => d.income * (d.mod ? d.mod.f : 1);
const landNaam = (s, id) => (s.districts.find(d => d.id === id) || {}).name || id;
function wpick(list){ let x = U(0, list.reduce((a, [, w]) => a + w, 0)); for (const [v, w] of list){ x -= w; if (w > 0 && x <= 0) return v; } return list[list.length - 1][0]; }
function plusMonths(s, n){ const d = new Date(s.date.year, s.date.month - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function news(s, kop, tekst, regio, soort = "markt", jij = false){
  (s.nieuws ??= []).unshift({m: ym(s), kop, tekst, regio: regio || "", soort, jij: !!jij});
  s.nieuws = s.nieuws.slice(0, 70);
}

/* markten: elke sector heeft een index die de omzet van iedereen in die sector trekt */
function sectorTick(s){
  s.sectoren ??= {};
  for (const t of allTypes(s)){
    const x = s.sectoren[t] ??= {idx: 100, trend: 0, hist: []};
    x.trend = x.trend * 0.75 + U(-0.025, 0.028) + (100 - x.idx) * 0.0006;
    x.idx = r1(clamp(x.idx * (1 + x.trend), 60, 170)); x.hist = [...(x.hist || []), Math.round(x.idx)].slice(-12);
    if (x.trend > 0.045 && R() < 0.5) news(s, `Hausse in ${t}`, `Beleggers storten zich op ${t}. De index staat op ${Math.round(x.idx)}. Wie nu in ${t} zit, verdient extra.`, "", "markt", s.divisions.some(d => d.type === t));
    if (x.trend < -0.045 && R() < 0.5) news(s, `${t} onder druk`, `Orders worden geschrapt en marges krimpen. De index zakt naar ${Math.round(x.idx)}.`, "", "markt", s.divisions.some(d => d.type === t));
  }
}
const sectorMult = (s, t) => { const x = (s.sectoren || {})[t]; return x ? 0.6 + 0.4 * x.idx / 100 : 1; };

/* gebeurtenissen per continent of land: ze veranderen tijdelijk wat gebieden opleveren */
const REGIO_EVENTS = [
  {id: "storm", w: 2, arch: "haven", f: 0.6, m: 2, kop: c => `Superstorm raakt de havens in ${c}`, tekst: "Kranen liggen stil, containers drijven weg. Havengebieden verdienen twee maanden veel minder."},
  {id: "staking", w: 2, arch: "industrie", f: 0.7, m: 2, kop: c => `Algemene staking in de industrie van ${c}`, tekst: "Fabrieken liggen stil. De bonden eisen meer dan loon: ze eisen zeggenschap."},
  {id: "blackout", w: 1.5, arch: "data", f: 0.6, m: 1, kop: c => `Stroomnet valt uit: datacentra in ${c} op noodstroom`, tekst: "Koeling faalt, servers vallen om. Wie geen back-up had, heeft nu ook geen klanten."},
  {id: "boom", w: 2, land: true, f: 1.35, m: 3, kop: (c, l) => `Investeringsgolf in ${l}`, tekst: "Buitenlands kapitaal stroomt binnen. Wie hier zit, verdient drie maanden extra."},
  {id: "coup", w: 1, land: true, f: 0.5, m: 3, kop: (c, l) => `Staatsgreep in ${l}`, tekst: "Het leger heeft de omroep en de centrale bank. De contracten van gisteren zijn vandaag papier."},
  {id: "akkoord", w: 1.5, cont: true, f: 1.12, m: 3, kop: c => `Handelsakkoord in ${c}`, tekst: "Tarieven omlaag, grenzen open voor geld. Het hele continent verdient een paar maanden meer."},
  {id: "sancties", w: 1.2, land: true, f: 0.7, m: 4, kop: (c, l) => `Sancties tegen ${l}`, tekst: "Betalingsverkeer bevroren, schepen omgeleid. Officieel tijdelijk."},
  {id: "virus", w: 0.8, cont: true, f: 0.85, m: 2, kop: c => `Synthetisch virus verspreidt zich in ${c}`, tekst: "Quarantaines en lege straten. Biotech-aandelen schieten omhoog.", sector: ["Biotech", 0.06]},
  {id: "cyber", w: 1, cont: true, f: 0.92, m: 1, kop: c => `Grote cyberaanval op banken in ${c}`, tekst: "Geldautomaten geven niets meer. Beveiligingsbedrijven bellen rond met offertes.", sector: ["Private Security", 0.05]},
  {id: "implantaat", w: 0.8, cont: true, f: 1, m: 1, kop: c => `Nieuwe wet op implantaten in ${c}`, tekst: "Strengere keuring voor cyberware. Grote spelers lachen, kleine sluiten.", sector: ["Cyberware", -0.05]},
];
function regionTick(s, ctx){
  for (const d of s.districts) if (d.mod && --d.mod.m <= 0) delete d.mod;
  if (R() > 0.45 * inst(s, "events")) return;
  const e = wpick(REGIO_EVENTS.map(x => [x, x.w])), conts = [...new Set(s.districts.map(d => d.continent))];
  let targets = [], c = CH(conts), l = "";
  if (e.arch){ const ok = conts.filter(k => s.districts.some(d => d.continent === k && d.arch === e.arch)); if (!ok.length) return; c = CH(ok); targets = s.districts.filter(d => d.continent === c && d.arch === e.arch); }
  else if (e.land){ const d = CH(s.districts); targets = [d]; c = d.continent; l = d.name; }
  else targets = s.districts.filter(d => d.continent === c);
  for (const d of targets) if (e.f !== 1) d.mod = {f: e.f, m: e.m, why: e.kop(c, l)};
  if (e.sector && s.sectoren && s.sectoren[e.sector[0]]) s.sectoren[e.sector[0]].trend += e.sector[1];
  for (const [a, v] of (VRAAG_DOOR_EVENT[e.id] || [])) vraagSchok(s, a, v, e.kop(c, l));
  const mine = targets.filter(d => d.control === "player");
  const pct = Math.round((e.f - 1) * 100);
  news(s, e.kop(c, l), e.tekst + (mine.length ? ` Dit raakt jouw gebied: ${mine.map(d => d.name).join(", ")} (${pct > 0 ? "+" : ""}${pct}% inkomen, ${e.m} mnd).` : ""), c, "regio", mine.length > 0);
  if (mine.length && e.f !== 1) ctx.rep.push(`${e.kop(c, l)} (${pct > 0 ? "+" : ""}${pct}% in ${mine.map(d => d.kort || d.name).join(", ")})`);
}

/* bedrijven in de wereld: geen rivalen, wel kansen (contracten, aandelen, overnames) */
const BEDRIJF_NAMEN = {
  "Logistiek": ["Kraken Freight", "Silkline Cargo", "Polar Route AS", "Meridian Containers"],
  "Biotech": ["Pallas Bio", "Verdant Genomics", "Lotus Biolabs", "Helix Mutual Health"],
  "Cyberware": ["Kestrel Dynamics", "Synapse Ortho", "Ironhand Prosthetics", "Okami Neural"],
  "Media & Data": ["Static Bloom Media", "Glasshouse Data", "NightWire News", "Echo Vault"],
  "Private Security": ["Bastion Arms", "Grey Wolf Security", "Aegis Contractors"],
  "Financieel": ["Nova-Linde Kapital", "Gilded Ledger Bank", "Atlas Credit", "Saffron Trust"],
  "Smokkel": ["Zenith Import-Export", "Blue Lantern Trading", "Coral Exchange"],
  "Weapon Manufacturing": ["Ironclad Ordnance", "Valkyrie Arms", "Halberd Munitions"],
};
const CEO_NAMEN = ["Ilse Verhoeven", "Chen Wei", "Rafael Ortega", "Dr. Amara Vos", "Kenji Mori", "Olga Petrenko", "Thabo Ndlovu", "Lucía Marín", "Farid Haddad", "Sigrid Holm", "Priya Raman",
  "Jonas Brandt", "Mei Lin", "Kwame Asante", "Hana Novak", "Diego Alvarez", "Yusuf Demir", "Ines Duarte", "Arjun Mehta", "Freya Lund", "Tomasz Wójcik", "Ngozi Eze", "Sven Aalto", "Laila Karimi", "Noa Ben-David"];
/* 5.7: elk spel een nieuwe wereld. Rivalen, hun CEO's (met karakter) en de bedrijven in de wereld worden per spel gemaakt uit een wereldzaad; hetzelfde zaad geeft dezelfde wereld. */
const NAAM_STAM = ["Okonkwo", "Brandt", "Vanderhoeven", "Saito", "Tessera", "Kovač", "Ndiaye", "Halvorsen", "Moreau", "Takeda", "Ibarra", "Volkov", "Achterberg", "Lindqvist", "Mbeki", "Castellanos", "Hayashi", "Oyelaran", "Petrov", "Ferreira", "Nakamura", "Adebayo", "Kowalski", "Delacroix", "Rahimi", "Sørensen", "Zhou", "Okafor", "Varga", "Quispe"];
const NAAM_WOORD = ["Zwarte Meridiaan", "Iron Bloom", "Zenith", "Albatros", "Obsidian", "Helix", "Northgate", "Crimson", "Vector", "Paragon", "Monolith", "Halcyon", "Kestrel", "Sable", "Aurora", "Titan", "Cobalt", "Ember", "Quasar", "Basalt", "Roest & Zonen", "Glasvezel", "Nachtwacht", "Kraanvogel"];
const NAAM_SUFFIX = {Financieel: ["Holdings", "Kapital", "Trust", "Capital Group"], Logistiek: ["Logistics", "Freight", "Shipping", "Transport"], Cyberware: ["Neurosystems", "Cybernetics", "Dynamics", "Augmentics"], "Media & Data": ["Media", "Data Group", "Networks", "Broadcast"], Biotech: ["Biolabs", "Genomics", "Life Sciences", "Pharma"], "Private Security": ["Security", "Defense", "Arms", "Tactical"], Smokkel: ["Trading", "Import-Export", "Exchange", "Mutual"]};
const VOORNAMEN = ["Adaeze", "Pieter", "Haruki", "Helena", "Idris", "Marcus", "Yuki", "Ruben", "Olena", "Sofia", "Haruto", "Carmen", "Viktor", "Amara", "Kenji", "Thabo", "Lucía", "Farid", "Sigrid", "Priya", "Jonas", "Mei", "Kwame", "Hana", "Diego", "Yusuf", "Ines", "Arjun", "Freya", "Tomasz", "Ngozi", "Sven", "Laila", "Noor", "Ezra", "Ayla"];
const RIVAAL_KARAKTER = {
  haai: {label: "Haai", tekst: "Valt aan zodra je zwak lijkt.", agr: 0.15, heb: 0.1},
  diplomaat: {label: "Diplomaat", tekst: "Zoekt deals en vergeet niets.", agr: -0.12, rel: 15},
  paranoide: {label: "Paranoïde", tekst: "Investeert in beveiliging en vertrouwt niemand.", def: 1, agr: 0.05, rel: -5},
  visionair: {label: "Visionair", tekst: "Groeit snel in de eigen sector.", div: 1},
  opportunist: {label: "Opportunist", tekst: "Koopt en verkoopt alles voor de juiste prijs.", heb: 0.2},
  traditioneel: {label: "Traditioneel", tekst: "Langzaam en voorzichtig, maar moeilijk te verdrijven.", agr: -0.08, def: 1},
};
const zaadNorm = z => { const t = String(z || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12); return t.length >= 3 ? t : ""; };
const nieuwZaad = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let z = ""; for (let i = 0; i < 6; i++) z += A[Math.floor(Math.random() * A.length)]; return z; };
function genRivaalNaam(sector, bezet){ const suf = NAAM_SUFFIX[sector] || ["Group"];
  for (let i = 0; i < 40; i++){ const v = R(), a = CH(NAAM_STAM), b = CH(NAAM_STAM);
    const n = v < 0.35 && a !== b ? `${a}-${b} ${CH(suf)}` : v < 0.65 ? `${a} ${CH(suf)}` : `${CH(NAAM_WOORD)} ${CH(suf)}`; if (!bezet.has(n)) return n; }
  return `${CH(NAAM_WOORD)} ${CH(suf)} ${RI(2, 99)}`; }
function genCeoNaam(bezet){ for (let i = 0; i < 40; i++){ const n = `${CH(VOORNAMEN)} ${CH(NAAM_STAM)}`; if (!bezet.has(n)) return n; } return CH(RIVAL_CEO_NAMEN); }
function geefKarakter(r){ if (r.karakter) return r; const k = CH(Object.keys(RIVAAL_KARAKTER)), K = RIVAAL_KARAKTER[k]; r.karakter = k;
  if (K.agr) r.aggression = r1(clamp(r.aggression + K.agr, 0.05, 0.95) * 100) / 100; if (K.heb) r.hebzucht = r1(clamp((r.hebzucht || 0.5) + K.heb, 0.1, 1) * 100) / 100;
  if (K.rel) r.relatie = Math.round(clamp((r.relatie || 0) + K.rel, -100, 100)); if (K.def) r.defensie = (r.defensie || 0) + K.def; if (K.div) r.divs[r.sector] = (r.divs[r.sector] || 3) + K.div; return r; }
function genBedrijfNamen(sec, n, bezet){ const pool = [...(BEDRIJF_NAMEN[sec] || [])], suf = NAAM_SUFFIX[sec] || ["Group"]; for (let i = 0; i < 6; i++) pool.push(`${CH(NAAM_WOORD)} ${CH(suf)}`);
  const out = []; while (out.length < n && pool.length){ const x = pool.splice(Math.floor(R() * pool.length), 1)[0]; if (!bezet.has(x) && !out.includes(x)) out.push(x); } return out; }
function genBedrijven(s){
  const out = [], lands = s.districts.filter(d => d.id !== s.player.home_district); let i = 0;
  const bezet = new Set(s.rivals.map(r => r.name));
  for (const [sec, names0] of Object.entries(BEDRIJF_NAMEN)) for (const n of genBedrijfNamen(sec, names0.length, bezet)){ bezet.add(n);
    const fit = lands.filter(d => (ARCH_SECTOR[d.arch] || []).includes(sec)), land = (fit.length && R() < 0.65) ? CH(fit) : CH(lands);
    out.push({id: "b" + i, naam: n, sector: sec, land: land.id, ceo: genCeoNaam(new Set()), waarde: RI(60, 320), vorige: 0, relatie: RI(-10, 20), aandeel: 0, eigenaar: null, contract: false, actie: null});
    i++;
  }
  for (const b of out) b.vorige = b.waarde;
  return out;
}
function bedrijfOpties(s, b){
  const dif = DIFF[s.player.difficulty] || 1, conc = s.rivals.some(r => r.sector === b.sector) ? 5 : 0;
  return {
    diner: {kost: 2, uitleg: "Relatie +10. Een betere relatie maakt een contract of overname kansrijker."},
    contract: {kost: r1(Math.max(6, b.waarde * 0.1)), bedrag: r1(clamp(b.waarde * 0.011, 0.8, 4.5)), kans: snapKans(Math.round(clamp(50 + b.relatie / 2 + (s.reputation - 30) / 3 - conc, 15, 95)))},
    koop: {kost: r1(b.waarde * 0.1 * 1.05), dividend: r1(b.waarde * 0.1 * 0.009)},
    verkoop: {opbrengst: r1(b.waarde * 0.1 * 0.95)},
    overname: {kost: r1(b.waarde * (100 - b.aandeel) / 100 * 1.35 * dif), kans: snapKans(Math.round(clamp(40 + b.aandeel * 0.9 + b.relatie / 3 + (s.reputation - 30) / 4, 10, 95))), koppel: koppelOpties(s, b).map(k => k.kort)},
  };
}
function integrateCompany(s, b){
  const lvl = b.waarde > 220 ? 2 : 1; let d = s.divisions.find(x => x.type === b.sector), txt;
  if (d){ d.level = Math.min(12, d.level + lvl); txt = `${d.name || d.type} groeit naar L${d.level}`; }
  else if (s.divisions.length < 8){ d = {name: b.naam, type: b.sector, level: lvl}; s.divisions.push(d); txt = `nieuwe divisie ${b.naam} (${b.sector} L${lvl})`; }
  else { d = s.divisions.reduce((a, x) => x.level < a.level ? x : a); d.level += lvl; txt = `${d.name || d.type} groeit naar L${d.level}`; }
  s.staff.count += 4 * lvl;
  return txt + `, +${4 * lvl} mensen`;
}
function koppelOpties(s, b){
  const lvl = b.waarde > 220 ? 2 : 1, d = s.divisions.find(x => x.type === b.sector), out = [], bd = r1(b.waarde * 0.012), sg = r1(b.waarde * 0.75);
  if (d) out.push({id: "samen", label: `Samenvoegen met ${divNaam(d)}`, kort: `samenvoegen met ${divNaam(d)} (+${lvl} niveau)`, uitleg: `${divNaam(d)} gaat van L${d.level} naar L${d.level + lvl}, +${4 * lvl} mensen, en hun bestseller komt in jouw productlijn. Het merk ${b.naam} verdwijnt.`});
  if (s.divisions.length < 8) out.push({id: "eigen", label: `Eigen divisie ${b.naam}`, kort: `eigen divisie (${b.sector} L${lvl})`, uitleg: `${b.naam} wordt een aparte divisie (${b.sector}, L${lvl}) met +${4 * lvl} mensen en hun bestseller al op de markt. Een tak erbij, met eigen kosten en heat.`});
  out.push({id: "dochter", label: "Als dochter laten draaien", kort: `dochter (+€${bd}M/mnd)`, uitleg: `${b.naam} blijft zelfstandig onder jouw vlag: elke maand +€${bd}M, geen extra kosten, heat of werk. Telt mee in je bedrijfswaarde.`});
  out.push({id: "strip", label: "Opknippen en verkopen", kort: `opknippen (+€${sg}M nu)`, uitleg: `De delen apart verkopen: +€${sg}M nu. Reputatie −4, de bond −6, en het bedrijf is weg.`});
  return out;
}
function koppelBedrijf(s, id, wijze){
  const b = (s.bedrijven || []).find(x => x.id === id); if (!b) return "Dat bedrijf bestaat niet meer.";
  const lvl = b.waarde > 220 ? 2 : 1, aard = aardVan(b.sector, "");
  const best = d => { if ((s.producten || []).filter(p => p.divisie === divNaam(d) && p.status !== "teruggeroepen").length >= maxProducten(d)) return "";
    const p = mkProduct(s, d, null, 2 + lvl, RI(40, 55)); p.aard = aard; p.prijs = "standaard"; maakReview(p); (s.producten ??= []).push(p); prodLog(p, s, `Overgenomen van ${b.naam}`); return `, met ${p.naam} meteen op de markt`; };
  if (wijze === "samen"){ const d = s.divisions.find(x => x.type === b.sector);
    if (d){ d.level = Math.min(12, d.level + lvl); s.staff.count += 4 * lvl; b.koppeling = "samen"; return `${b.naam} gaat op in ${divNaam(d)} (nu L${d.level})${best(d)}.`; } wijze = "eigen"; }
  if (wijze === "eigen" && s.divisions.length < 8){ const naam = s.divisions.some(x => divNaam(x) === b.naam) ? `${b.naam} ${b.sector}` : b.naam, d = {name: naam, type: b.sector, level: lvl};
    s.divisions.push(d); s.staff.count += 4 * lvl; b.koppeling = "eigen"; return `${naam} is een eigen divisie (${b.sector} L${lvl})${best(d)}.`; }
  if (wijze === "strip"){ const g = r1(b.waarde * 0.75); s.cash = r1(s.cash + g); s.accounts.operationeel = s.cash; s.reputation = clamp(s.reputation - 4); shiftFaction(s, "vakbond", -6); b.koppeling = "strip"; b.waarde = 0; return `${b.naam} is opgeknipt en verkocht: +€${g}M.`; }
  const bd = r1(b.waarde * 0.012); (s.streams ??= []).push({naam: "Dochter " + b.naam, bedrag: bd, sinds: ym(s)}); b.koppeling = "dochter"; return `${b.naam} draait als dochter: +€${bd}M per maand.`;
}
function actDochter(s, id, actie){
  const b = (s.bedrijven || []).find(x => x.id === id && x.eigenaar === "player" && x.koppeling === "dochter"); if (!b) return {ok: false, msg: "Dat is geen dochter van je."};
  const st = (s.streams || []).find(x => x.naam === "Dochter " + b.naam); s.streams = (s.streams || []).filter(x => x !== st); let msg;
  if (actie === "samen"){ b.koppeling = null; msg = koppelBedrijf(s, id, s.divisions.some(d => d.type === b.sector) ? "samen" : "eigen"); }
  else if (actie === "verkoop"){ const g = r1(b.waarde * 0.9); s.cash = r1(s.cash + g); s.accounts.operationeel = s.cash; b.eigenaar = null; b.aandeel = 0; b.koppeling = null; msg = `${b.naam} is verkocht voor €${g}M.`; }
  else { if (st) s.streams.push(st); return {ok: false, msg: "Onbekende actie."}; }
  addLog(s, msg); return {ok: true, msg};
}
function actBedrijf(s, ctx, id, soort){
  const b = (s.bedrijven || []).find(x => x.id === id); if (!b) return {ok: false, msg: "Onbekend bedrijf."};
  if (b.eigenaar === "player") return {ok: false, msg: `${b.naam} is al van jou.`};
  if (b.eigenaar) return {ok: false, msg: `${b.naam} is van ${b.eigenaar}.`};
  const m = ym(s), o = bedrijfOpties(s, b), pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; };
  let msg;
  if (soort === "diner"){
    if (b.actie === m) return {ok: false, msg: "Je hebt deze maand al met ze aan tafel gezeten."};
    if (!pay(o.diner.kost)) return {ok: false, msg: "Niet genoeg cash."};
    b.relatie = Math.round(clamp(b.relatie + 10, -100, 100)); b.actie = m; msg = `Diner met ${b.ceo} van ${b.naam}. Relatie nu ${b.relatie}.`;
  } else if (soort === "contract"){
    if (b.contract) return {ok: false, msg: "Je hebt al een contract met ze."};
    if (!pay(o.contract.kost)) return {ok: false, msg: `Een contract opzetten kost €${o.contract.kost}M. Niet genoeg cash.`};
    const roll = rolKans(o.contract.kans), ok = roll.ok;
    addRoll(s, `Leveringscontract met ${b.naam}: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`);
    if (ok){ b.contract = true; b.relatie = Math.round(clamp(b.relatie + 5, -100, 100)); (s.streams ??= []).push({naam: "Contract " + b.naam, bedrag: o.contract.bedrag, sinds: m});
      msg = `Getekend (worp ${roll.txt}). ${b.naam} levert je voortaan ongeveer €${o.contract.bedrag}M per maand op.`; }
    else { b.relatie = Math.round(clamp(b.relatie - 5, -100, 100)); msg = `Geen deal (worp ${roll.txt}). Het geld voor juristen en presentaties is weg.`; }
  } else if (soort === "koop"){
    if (b.aandeel >= 40) return {ok: false, msg: "Boven 40% moet je een overnamebod doen."};
    if (!pay(o.koop.kost)) return {ok: false, msg: `10% kost €${o.koop.kost}M. Niet genoeg cash.`};
    b.aandeel += 10; msg = `Je bezit nu ${b.aandeel}% van ${b.naam}. Dividend ongeveer €${r1(b.waarde * b.aandeel / 100 * 0.009)}M per maand.`;
  } else if (soort === "verkoop"){
    if (!b.aandeel) return {ok: false, msg: "Je hebt geen aandelen."};
    s.cash = r1(s.cash + o.verkoop.opbrengst); b.aandeel -= 10; msg = `10% van ${b.naam} verkocht voor €${o.verkoop.opbrengst}M.`;
  } else if (soort === "overname"){
    if (!pay(o.overname.kost)) return {ok: false, msg: `De overname kost €${o.overname.kost}M. Niet genoeg cash.`};
    const roll = rolKans(o.overname.kans), ok = roll.ok;
    addRoll(s, `Overnamebod op ${b.naam}: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`);
    if (ok){
      b.eigenaar = "player"; b.aandeel = 100;
      if (b.contract){ b.contract = false; s.streams = (s.streams || []).filter(x => x.naam !== "Contract " + b.naam); }
      const ko = koppelOpties(s, b);
      addKeuze(s, ctx, {soort: "koppel_" + b.id, van: "COO", titel: `${b.naam} is van ons. Hoe koppelen we het?`, tekst: `De handtekeningen staan. ${b.naam} (${b.sector}, ${landNaam(s, b.land)}, waarde €${Math.round(b.waarde)}M) is van ons. Nu de vraag wat we ermee doen.`,
        opties: ko.map(k => ({label: k.label, uitleg: k.uitleg, eff: {integratie: {id: b.id, wijze: k.id}}})), standaard: 0});
      msg = `${b.naam} is van jou (worp ${roll.txt}). Kies in het overzicht hoe je het koppelt: ${ko.map(k => k.kort).join(", ")}.`;
      news(s, `${s.player.corp_name} neemt ${b.naam} over`, `${b.naam} (${b.sector}, ${landNaam(s, b.land)}) gaat op in ${s.player.corp_name}.`, landNaam(s, b.land), "overname", true);
    } else {
      const back = r1(o.overname.kost * 0.85); s.cash = r1(s.cash + back); b.relatie = Math.round(clamp(b.relatie - 15, -100, 100));
      msg = `Het bestuur van ${b.naam} wijst het bod af (worp ${roll.txt}). Je krijgt €${back}M terug; de rest ging op aan adviseurs.`;
    }
  } else return {ok: false, msg: "Onbekende actie."};
  addLog(s, msg); return {ok: true, msg};
}

/* ===================== 4.2 LEVENDE BEDRIJVENWERELD: oprichtingen, faillissementen, fusies, nieuwe namen, beursgangen, schandalen ===================== */
const NAAM_A = ["Neo", "Vanta", "Kairo", "Helio", "Obsidian", "Nova", "Quanta", "Ardent", "Cobalt", "Lumen", "Strata", "Vector", "Argent", "Halcyon", "Onyx", "Sable", "Tessel", "Umbra", "Zenith", "Kite",
  "Orchid", "Basalt", "Ember", "Fathom", "Glint", "Ion", "Juno", "Mantis", "Nimbus", "Prism", "Rook", "Solace", "Talon", "Vesper", "Wren", "Axiom", "Bramble", "Corvid", "Drift", "Echo"];
const NAAM_B = {"Logistiek": ["Freight", "Haulage", "Lines", "Cargo", "Routes", "Shipping"], "Biotech": ["Bio", "Genomics", "Labs", "Cellworks", "Therapeutics", "Pharma"], "Cyberware": ["Dynamics", "Neural", "Ortho", "Synthetics", "Kinetics", "Augment"],
  "Media & Data": ["Media", "Signal", "Data", "Feed", "Broadcast", "Analytics"], "Private Security": ["Guard", "Shield", "Sentinel", "Watch", "Defense", "Response"], "Financieel": ["Capital", "Trust", "Ledger", "Bancorp", "Holdings", "Partners"],
  "Smokkel": ["Trading", "Imports", "Exchange", "Brokers", "Supply", "Transit"], "Weapon Manufacturing": ["Arms", "Ordnance", "Munitions", "Armory", "Ballistics", "Defense Systems"]};
function bedrijfNaam(s, sector){
  const used = new Set([...(s.bedrijven || []).map(b => b.naam), ...s.rivals.map(r => r.name)]), B = NAAM_B[sector] || ["Group", "Works", "Systems", "Industries"];
  for (let i = 0; i < 60; i++){ const n = `${CH(NAAM_A)} ${CH(B)}`; if (!used.has(n)) return n; }
  return `${CH(NAAM_A)} ${CH(B)} ${RI(2, 99)}`;
}
const bLog = (b, s, t) => { (b.log ??= []).unshift({m: ym(s), t}); b.log = b.log.slice(0, 8); };
function hernoemStroom(s, oud, nieuw){ for (const x of s.streams || []) if (x.naam === "Contract " + oud) x.naam = "Contract " + nieuw; }
function bedrijfLeven(s, ctx){
  const B = (s.bedrijven ??= []), vrij = () => B.filter(b => !b.eigenaar), mg = maandenGespeeld(s);
  for (const b of B){ b.groei = r1(clamp((b.groei ?? U(-0.015, 0.015)) * 0.92 + U(-0.011, 0.01), -0.05, 0.05) * 1000) / 1000; b.piek = Math.max(b.piek || 0, b.waarde); b.zwak = (b.waarde < 38 || b.waarde < b.piek * 0.4) && !b.eigenaar ? (b.zwak || 0) + 1 : 0; }
  // faillissement: drie maanden onder water
  for (const b of B.filter(x => x.zwak >= 3 && !x.eigenaar)){
    s.bedrijven = s.bedrijven.filter(x => x !== b); leverancierWeg(s, typeof ctx !== "undefined" ? ctx : null, b); if (b.contract) s.streams = (s.streams || []).filter(x => x.naam !== "Contract " + b.naam);
    (s.stats ??= {}).failliet = (s.stats.failliet || 0) + 1; (s.wereldJaar ??= {})[s.date.year] = {...((s.wereldJaar || {})[s.date.year] || {}), failliet: (((s.wereldJaar || {})[s.date.year] || {}).failliet || 0) + 1};
    news(s, `${b.naam} failliet`, `${b.naam} (${b.sector}) houdt op te bestaan.${b.aandeel ? ` Jouw ${b.aandeel}% is niets meer waard.` : ""}${b.contract ? " Je leveringscontract vervalt." : ""}`, landNaam(s, b.land), "markt", !!(b.aandeel || b.contract));
    if (b.aandeel || b.contract) ctx.rep.push(`${b.naam} failliet`); }
  // oprichtingen: de wereld blijft tussen ±20 en 36 bedrijven
  if (B.length < 20 || (B.length < 36 && R() < 0.06)){ const sec = CH(allTypes(s).filter(t => NAAM_B[t]).concat(["Financieel"])), land = CH(s.districts.filter(d => d.id !== s.player.home_district)), naam = bedrijfNaam(s, sec);
    const b = {id: "b" + hex8(), naam, sector: sec, land: land.id, ceo: CH(CEO_NAMEN), waarde: r1(RI(45, 110) * (1 + (s.tijdperk || 0) * 0.3)), vorige: 0, relatie: RI(0, 20), aandeel: 0, eigenaar: null, contract: false, actie: null, startup: true, groei: r1(U(0.005, 0.03) * 1000) / 1000, sinds: ym(s)};
    b.vorige = b.waarde; bLog(b, s, "Opgericht"); s.bedrijven.push(b); (s.wereldJaar ??= {})[s.date.year] = {...((s.wereldJaar || {})[s.date.year] || {}), nieuw: (((s.wereldJaar || {})[s.date.year] || {}).nieuw || 0) + 1};
    news(s, `Nieuwkomer: ${naam}`, `Een jong bedrijf in ${sec}, uit ${land.name}. Klein, snel en te koop voor wie er vroeg bij is.`, land.continent, "markt"); }
  if (mg < 3) return;
  const V = vrij(); if (!V.length) return;
  const x = R();
  if (x < 0.04){ // nieuwe naam
    const b = CH(V), oud = b.naam; b.naam = bedrijfNaam(s, b.sector); hernoemStroom(s, oud, b.naam); bLog(b, s, `Nieuwe naam (heette ${oud})`);
    news(s, `${oud} heet voortaan ${b.naam}`, `Na een herstructurering gaat ${oud} verder als ${b.naam}. Zelfde mensen, nieuwe brochure.`, landNaam(s, b.land), "markt", !!(b.aandeel || b.contract)); }
  else if (x < 0.07){ // fusie in dezelfde sector
    const a = CH(V), part = V.filter(y => y !== a && y.sector === a.sector);
    if (part.length){ const b = CH(part), nieuw = R() < 0.5 ? bedrijfNaam(s, a.sector) : a.naam, oudA = a.naam;
      let extra = ""; if (b.aandeel){ const p = r1(b.waarde * b.aandeel / 100 * 1.15); s.cash = r1(s.cash + p); extra = ` Jouw ${b.aandeel}% in ${b.naam} is uitgekocht voor €${p}M.`; ctx.rep.push(`Fusie: belang in ${b.naam} uitgekocht (+€${p}M)`); }
      if (b.contract){ hernoemStroom(s, b.naam, nieuw); a.contract = true; extra += ` Je contract met ${b.naam} loopt door bij ${nieuw}.`; }
      if (a.naam !== nieuw) hernoemStroom(s, a.naam, nieuw);
      a.waarde = r1((a.waarde + b.waarde) * 1.05); a.naam = nieuw; a.relatie = Math.round((a.relatie + b.relatie) / 2); s.bedrijven = s.bedrijven.filter(y => y !== b);
      bLog(a, s, `Fusie: ${oudA} + ${b.naam}${nieuw !== oudA ? ` → ${nieuw}` : ""}`);
      news(s, `Fusie: ${oudA} en ${b.naam}`, `Samen verder als ${nieuw}, met een waarde van ±€${Math.round(a.waarde)}M.${extra}`, landNaam(s, a.land), "overname", !!extra); } }
  else if (x < 0.09){ // beursgang
    const b = V.filter(y => !y.beurs && y.waarde > 140).sort((p, q) => q.waarde - p.waarde)[0];
    if (b){ b.beurs = true; b.waarde = r1(b.waarde * 1.25); b.groei = Math.round(((b.groei || 0) + 0.01) * 1000) / 1000; bLog(b, s, "Naar de beurs"); news(s, `${b.naam} gaat naar de beurs`, `De koers opent 25% boven verwachting. Aandelen kopen is nu duurder; wie al een belang had, is rijker.`, landNaam(s, b.land), "markt", !!b.aandeel); } }
  else if (x < 0.12){ // schandaal
    const b = CH(V); b.waarde = r1(b.waarde * 0.75); b.groei = Math.round((Math.min(b.groei || 0, 0) - 0.015) * 1000) / 1000; bLog(b, s, "Schandaal");
    news(s, `Schandaal bij ${b.naam}`, CH([`Een klokkenluider spreekt over vervalste cijfers.`, `Een product van ${b.naam} blijkt mensen ziek te maken.`, `De CEO is gearresteerd op een vliegveld.`]) + ` De waarde zakt met een kwart.`, landNaam(s, b.land), "markt", !!(b.aandeel || b.contract)); }
  else if (x < 0.15){ // nieuwe CEO
    const b = CH(V), oud = b.ceo; b.ceo = CH(CEO_NAMEN.filter(n => n !== oud)); b.relatie = Math.round(b.relatie * 0.5); b.groei = Math.round(((b.groei || 0) + U(-0.01, 0.015)) * 1000) / 1000; bLog(b, s, `Nieuwe CEO: ${b.ceo}`);
    if (b.contract || b.aandeel || Math.abs(b.relatie) > 10) news(s, `Nieuwe CEO bij ${b.naam}`, `${oud} vertrekt, ${b.ceo} neemt het over. Wat jullie samen hadden opgebouwd, moet opnieuw.`, landNaam(s, b.land), "mensen"); }
}
function bedrijfTick(s, ctx){
  let div = 0;
  for (const b of s.bedrijven || []){
    const d = s.districts.find(x => x.id === b.land), sx = (s.sectoren || {})[b.sector];
    b.vorige = b.waarde;
    b.waarde = r1(Math.max(25, b.waarde * (1 + (sx ? sx.trend * 0.8 : 0) + (b.groei || 0) + U(-0.025, 0.025) + ((d && d.mod ? d.mod.f : 1) - 1) * 0.08)));
    if (b.aandeel && b.eigenaar !== "player") div += b.waarde * 0.009 * b.aandeel / 100;
    b.relatie = Math.round(b.relatie * 0.97 + (b.contract ? 1 : 0));
  }
  if (div){ s.cash = r1(s.cash + div); ctx.rep.push(`Dividend uit belangen: +€${r1(div)}M`); }
  if (R() < 0.05 && s.rivals.length){
    const free = (s.bedrijven || []).filter(b => !b.eigenaar && b.aandeel < 50), r = CH(s.rivals);
    if (free.length){ const b = CH(free), price = b.waarde * 1.3;
      if (r.cash > price * 1.4){
        r.cash = r1(r.cash - price); b.eigenaar = r.name; r.divs[b.sector] = Math.min(10, (r.divs[b.sector] || 0) + 1);
        let extra = "";
        if (b.aandeel){ const p = r1(b.waarde * b.aandeel / 100 * 1.3); s.cash = r1(s.cash + p); extra = ` Jouw belang van ${b.aandeel}% is uitgekocht voor €${p}M.`; b.aandeel = 0; ctx.rep.push(`${r.name} koopt ${b.naam}: jouw belang uitgekocht (+€${p}M)`); }
        if (b.contract){ b.contract = false; s.streams = (s.streams || []).filter(x => x.naam !== "Contract " + b.naam); extra += " Jouw leveringscontract is opgezegd."; ctx.rep.push(`Contract met ${b.naam} vervalt`); }
        news(s, `${r.name} neemt ${b.naam} over`, `Voor ongeveer €${Math.round(price)}M gaat ${b.naam} (${b.sector}) naar ${r.name}.${extra}`, landNaam(s, b.land), "overname", !!extra);
      } } }
}
function rivalValue(s, r){
  let v = Math.max(0, r.cash) + Object.values(r.divs).reduce((a, x) => a + x * 45, 0) + rivalDistricts(s, r).reduce((a, d) => a + districtValue(d), 0) + (r.schepen || 0) * 15;
  for (const b of s.bedrijven || []) if (b.eigenaar === r.name) v += b.waarde;
  return Math.round(v);
}
function playerValue(s){ return Math.round(bedrijfWaarde(s) * (1 - publiekDeel(s))); } /* 5.15: jouw deel; na een beursgang is een deel van de aandeelhouders */
function bedrijfWaarde(s){
  let v = s.cash + s.accounts.offshore + s.accounts.zwart * 0.5 - s.debt - termijnRest(s) + voorraadWaarde(s) + s.divisions.reduce((a, d) => a + d.level * 45, 0) + playerDistricts(s).reduce((a, d) => a + districtValue(d), 0)
    + (s.streams || []).reduce((a, x) => a + x.bedrag * (x.maanden != null ? Math.min(12, x.maanden) : 12), 0) + (s.schepen || 0) * 15;
  for (const b of s.bedrijven || []) if (b.eigenaar !== "player") v += b.waarde * b.aandeel / 100;
  return Math.round(v);
}

/* ===================== 1.2 MENSEN: relaties, gunsten, keuzes ===================== */
const NETWERK = [
  ["fixer", "Zes", "Fixer, werkt op elk continent", "Regelt wat niet op papier mag: mensen, spullen, ongelukjes. Kortaf, wil cash vooraf, liefst zwart.", "straat"],
  ["pers", "Dana Kröller", "Onderzoeksjournalist, Global Wire", "Nieuwsgierig en op haar manier eerlijk. Koopbaar met verhalen, niet met geld.", null],
  ["politie", "Commissaris Vermeulen", "Europol, afdeling bedrijfscriminaliteit", "Moe, pragmatisch, half corrupt. Wil rust en een goed pensioen.", "politie"],
  ["stad", "Minister Achterberg", "Minister van Handel", "Glad en ambitieus. Denkt in verkiezingen, subsidies en fotomomenten.", "stad"],
  ["vakbond", "Bram Oosterhout", "Internationale Transport- en Industriebond", "Ex-havenarbeider, rechtlijnig, wantrouwt elke directie.", "vakbond"],
  ["bank", "Mevr. Lindqvist", "Kredietdirecteur, Nordhavn Bank", "Correct en kil. Kijkt naar cijfers, reputatie en heat.", null],
  ["isra", "Isra", "Leider van de Zwarte Kraai-clan, nomaden op de snelwegen", "Trots, geduldig, onthoudt alles. Nomaden-eer gaat boven geld.", "nomaden"],
  ["vonk", "Mara Vonk", "Frontvrouw van punkband Kortsluiting", "Anti-corpo, slim, laat zich niet kopen zonder dat het er goed uitziet voor haar fans.", "straat"],
  ["werving", "Bureau Kestrel Talent", "Werving & selectie", "Headhunters. Vinden mensen voor sleutelposities. Rekenen een fee van 2-6k per kandidaat.", null],
];
const MENS = {
  fixer: {gunst: {label: "Een klus voorbereiden", drempel: 30, uitleg: "Je volgende oorlogsactie krijgt +15% kans."}, passief: {min: 50, tekst: "Oorlogsacties 20% goedkoper"}},
  pers: {gunst: {label: "Een positief stuk", drempel: 30, uitleg: "Reputatie +6."}, passief: {min: 50, tekst: "Waarschuwt je: schandalen half zo vaak"}, geenCadeau: "Dana stuurt het cadeau terug, met een foto ervan voor haar archief."},
  politie: {gunst: {label: "Een dossier laten verdwijnen", drempel: 35, uitleg: "Heat −10."}, passief: {min: 50, tekst: "Inspecties 40% minder vaak"}},
  stad: {gunst: {label: "Subsidie regelen", drempel: 30, uitleg: "€12M subsidie."}, passief: {min: 50, tekst: "Vestigingen 15% goedkoper"}},
  vakbond: {gunst: {label: "Vrede op de werkvloer", drempel: 30, uitleg: "Morale +8."}, passief: {min: 50, tekst: "Geen wilde stakingen"}, geenCadeau: "Een cadeau van de directie? Bram noemt het omkoping, in de nieuwsbrief van de bond."},
  bank: {gunst: {label: "Betere voorwaarden", drempel: 35, uitleg: "Rente −1% (minimaal 4%)."}, passief: {min: 40, tekst: "Leenruimte +€50M"}},
  isra: {gunst: {label: "Een konvooi zonder papieren", drempel: 30, uitleg: "€10M aan goederen, als zwart geld."}, passief: {min: 50, tekst: "De clans laten je trucks met rust en helpen soms"}},
  vonk: {gunst: {label: "Een nummer over een rivaal", drempel: 40, uitleg: "De rivaal met de slechtste relatie verliest 15% marktaandeel; straat +5."}, passief: {min: 50, tekst: "Reputatie +0,3 en straat +1 per maand"}},
};
const relV = (s, key) => ((s.relaties || {})[key] || {}).v || 0;
function relShiftP(s, key, v){ const r = (s.relaties ??= {})[key] ??= {v: 0}; r.v = Math.round(clamp(r.v + v, -100, 100)); }
function homeLandNaam(s){ return landNaam(s, s.player.home_district); }

function npcPerk(n){
  const r = (n.role || "").toLowerCase();
  if (/\bcfo\b|financ/.test(r)) return {key: "kosten", tekst: "Vaste kosten 3% lager"};
  if (/security|beveilig/.test(r)) return {key: "macht", tekst: "Macht +6"};
  if (/\bpr\b|communicatie|pers|media/.test(r)) return {key: "rep", tekst: "Reputatie +0,5 per maand"};
  if (/\bcoo\b|operat|logist/.test(r)) return {key: "staf", tekst: "10% minder personeel nodig"};
  return {key: "morale", tekst: "Morale +0,5 per maand"};
}
const npcActive = (s, key) => s.npcs.some(n => !n.verraad && n.loyalty >= 60 && npcPerk(n).key === key);

function gunstEffect(s, key){
  if (key === "fixer"){ s.flags.fixer_klus = true; return "Zes heeft mensen klaarstaan. Je volgende oorlogsactie krijgt +15% kans."; }
  if (key === "pers"){ s.reputation = clamp(s.reputation + 6); return "Global Wire brengt een lovend stuk. Reputatie +6."; }
  if (key === "politie"){ s.heat = clamp(s.heat - 10); return "Een dossier is zoekgeraakt. Heat −10."; }
  if (key === "stad"){ s.cash = r1(s.cash + 12); return "Subsidie toegekend: +€12M."; }
  if (key === "vakbond"){ s.morale = clamp(s.morale + 8); return "Bram praat met de werkvloer. Morale +8."; }
  if (key === "bank"){ s.interest_rate = Math.max(0.04, r1((s.interest_rate - 0.01) * 1000) / 1000); return `Nieuwe voorwaarden: rente ${Math.round(s.interest_rate * 1000) / 10}%.`; }
  if (key === "isra"){ s.accounts.zwart = r1(s.accounts.zwart + 10); shiftFaction(s, "nomaden", 3); return "Een konvooi levert goederen zonder papieren: +€10M zwart geld."; }
  if (key === "vonk"){ const r = s.rivals.slice().sort((a, b) => a.relatie - b.relatie)[0]; shiftFaction(s, "straat", 5);
    if (r){ const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.85; remember(r, s, "werd bespot in een nummer van Kortsluiting"); return `Kortsluiting brengt een nummer over ${r.name}. Hun klanten haken af (−15% marktaandeel).`; }
    return "Kortsluiting zingt over je. Positief, voor de verandering."; }
  return "";
}
function actMens(s, ctx, key, soort){
  const m = ym(s), pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; };
  if (key.startsWith("npc-")){
    const n = s.npcs.find(x => "npc-" + slug(x.name) === key); if (!n) return {ok: false, msg: "Die persoon werkt hier niet meer."};
    n.acties ??= {}; let msg;
    if (soort === "gesprek"){ if (n.acties.gesprek === m) return {ok: false, msg: "Je hebt deze maand al met " + n.name + " gesproken."};
      n.acties.gesprek = m; n.loyalty = clamp(n.loyalty + 4); n.gepeild = {m, v: n.verraad ? clamp(n.loyalty + RI(15, 30)) : clamp(n.loyalty + RI(-5, 5))};
      msg = `Gesprek met ${n.name}. Je schatting van de loyaliteit: ongeveer ${Math.round(n.gepeild.v)}.`; }
    else if (soort === "bonus"){ if (n.acties.bonus === m) return {ok: false, msg: "Twee bonussen in één maand wekt argwaan."}; if (!pay(3)) return {ok: false, msg: "Een bonus kost €3M. Niet genoeg cash."};
      n.acties.bonus = m; n.loyalty = clamp(n.loyalty + 12); msg = `${n.name} krijgt een bonus van €3M. Loyaliteit +12.`; }
    else if (soort === "promotie"){ if (n.promotie) return {ok: false, msg: `${n.name} is al gepromoveerd.`};
      n.promotie = m; s.culture.bonus_cost = r1((s.culture.bonus_cost || 0) + 1); n.loyalty = clamp(n.loyalty + 18); n.ambition = clamp(n.ambition - 10);
      msg = `${n.name} krijgt meer verantwoordelijkheid en €1M per maand meer. Loyaliteit +18, ambitie gestild.`; }
    else if (soort === "natrekken"){ if (n.acties.natrekken === m) return {ok: false, msg: "Het onderzoek loopt al."}; if (!pay(3)) return {ok: false, msg: "Een onderzoek kost €3M. Niet genoeg cash."};
      n.acties.natrekken = m; const kans = snapKans(65), roll = rolKans(kans), ok = roll.ok;
      addRoll(s, `Onderzoek naar ${n.name}: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`);
      if (ok && n.verraad){ msg = ontmasker(s, ctx, n.name) + ` (worp ${roll.txt})`; }
      else if (ok){ msg = `Het onderzoek naar ${n.name} vindt niets (worp ${roll.txt}). Schoon, of heel voorzichtig.`; if (R() < 0.3){ n.loyalty = clamp(n.loyalty - 10); msg += ` ${n.name} heeft het gemerkt. Loyaliteit −10.`; } }
      else { msg = `Het onderzoek levert niets bruikbaars op (worp ${roll.txt}). Dat zegt niets.`; if (R() < 0.4){ n.loyalty = clamp(n.loyalty - 10); msg += ` ${n.name} weet dat je hebt laten zoeken. Loyaliteit −10.`; } } }
    else if (soort === "ontslaan"){ if (!pay(4)) return {ok: false, msg: "De vertrekregeling kost €4M. Niet genoeg cash."};
      s.npcs = s.npcs.filter(x => x !== n); for (const f of ["cfo_manipuleert", "pr_lekt", "security_verkocht"]) if (s.flags[f] === n.name) delete s.flags[f];
      delete s.flags["verraad_" + n.name]; s.morale = clamp(s.morale - 3); s.flags["vacature_" + n.role] = m;
      msg = `${n.name} (${n.role}) is ontslagen. Vertrekregeling €4M, morale −3. Zoek via de Assistent of Kestrel Talent een opvolger.`; }
    else return {ok: false, msg: "Onbekende actie."};
    addLog(s, msg); return {ok: true, msg};
  }
  const P = MENS[key], c = NETWERK.find(x => x[0] === key); if (!P || !c) return {ok: false, msg: "Met deze persoon kun je dat niet."};
  const r = (s.relaties ??= {})[key] ??= {v: 0}, naam = netwerkNaam(s, key, c[1]); let msg;
  if (soort === "diner"){ if (r.actie === m) return {ok: false, msg: `Je hebt ${naam} deze maand al gezien.`}; if (!pay(1.5)) return {ok: false, msg: "Niet genoeg cash."};
    r.actie = m; const v = key === "vakbond" ? 4 : RI(5, 8); relShiftP(s, key, v); if (c[4]) shiftFaction(s, c[4], 2); msg = `Diner met ${naam}. Relatie +${v} (nu ${relV(s, key)}).`; }
  else if (soort === "cadeau"){ if (r.actie === m) return {ok: false, msg: `Je hebt ${naam} deze maand al gezien.`};
    if (P.geenCadeau){ r.actie = m; relShiftP(s, key, -4); msg = P.geenCadeau + " Relatie −4."; }
    else { if (!pay(4)) return {ok: false, msg: "Een cadeau kost €4M. Niet genoeg cash."}; r.actie = m; const v = RI(10, 14); relShiftP(s, key, v); if (c[4]) shiftFaction(s, c[4], 3); msg = `Cadeau voor ${naam}. Relatie +${v} (nu ${relV(s, key)}).`; } }
  else if (soort === "gunst"){ if (r.gunst && r.gunst > plusMonths(s, -3)) return {ok: false, msg: `Je vroeg ${naam} kortgeleden al een gunst. Wacht tot ${plusMonths({date: {year: +r.gunst.slice(0, 4), month: +r.gunst.slice(5)}}, 3)}.`};
    if (r.v < P.gunst.drempel) return {ok: false, msg: `${naam} doet dit pas vanaf relatie ${P.gunst.drempel} (nu ${r.v}).`};
    r.gunst = m; relShiftP(s, key, -8); msg = gunstEffect(s, key) + " Relatie −8."; }
  else if (soort === "druk"){ if (r.actie === m) return {ok: false, msg: `Je hebt ${naam} deze maand al gezien.`};
    r.actie = m; const kans = Math.round(clamp(30 + playerPower(s) / 3 + (s.accounts.zwart > 10 ? 10 : 0), 15, 75)), roll = rolKans(snapKans(kans)), ok = roll.ok;
    addRoll(s, `${naam} onder druk zetten: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`);
    s.heat = clamp(s.heat + 4); relShiftP(s, key, -20); if (c[4]) shiftFaction(s, c[4], -6);
    if (ok) msg = `${naam} buigt (worp ${roll.txt}). ${gunstEffect(s, key)} Relatie −20, heat +4.`;
    else { relShiftP(s, key, -10); s.heat = clamp(s.heat + 4); s.reputation = clamp(s.reputation - 3); msg = `${naam} laat zich niet onder druk zetten (worp ${roll.txt}) en vertelt het rond. Relatie −30, heat +8, reputatie −3.`; } }
  else return {ok: false, msg: "Onbekende actie."};
  addLog(s, msg); return {ok: true, msg};
}
function ontmasker(s, ctx, name){
  const n = s.npcs.find(x => x.name === name); if (!n || !n.verraad) return `${name} blijkt schoon.`;
  for (const f of ["cfo_manipuleert", "pr_lekt", "security_verkocht"]) if (s.flags[f] === n.name) delete s.flags[f];
  delete s.flags["verraad_" + n.name]; n.verraad = null; n.ontmaskerd = ym(s); n.loyalty = clamp(Math.min(n.loyalty, 30));
  addKeuze(s, ctx, {van: "Head of Security", titel: `Wat doen we met ${n.name}?`, tekst: `Het bewijs is duidelijk: ${n.name} (${n.role}) werkte tegen ons. Er zijn drie smaken. Geen van alle smaakt goed.`, opties: [
    {label: "Ontslaan · €4M", kost: 4, uitleg: "Weg ermee. Morale −3, maar het lek is dicht.", eff: {ontslag: n.name, morale: -3}},
    {label: "Omdraaien", uitleg: "Blijft, voedt de tegenpartij met valse info. Loyaliteit naar 50, rivalen −0,1 agressie. Riskant.", eff: {loyaliteit_zet: {[n.name]: 50}, rivaal_alle: {agressie: -0.1}, tekst: `${n.name} werkt voortaan voor ons. Zegt ${n.name}.`}},
    {label: "Aangifte doen", uitleg: "Ontslag en politie erbij. Reputatie +3, toezicht +5, heat −3.", eff: {ontslag: n.name, reputation: 3, heat: -3, factions: {politie: 5}}}], standaard: 0});
  return `${n.name} is ontmaskerd. Het lek is gedicht; je beslist wat er nu gebeurt.`;
}

/* keuzes: mails met knoppen. De engine voert ze uit; geen GM nodig */
const FLAVOR_KEUZE = new Set(["opslag", "cao", "klant", "subsidie", "sponsor", "interview", "data", "tip", "vreemdeling", "sekte", "klokkenluider", "isra_vracht", "diner_rivaal", "diner"]);
const mndNr = m => { const [y, mo] = String(m || "0-0").split("-").map(Number); return y * 12 + mo; };
function addKeuze(s, ctx, k){
  if (FLAVOR_KEUZE.has(k.soort)){ const last = s.flags.flavor_keuze; if (last && mndNr(ym(s)) - mndNr(last) < 2) return k; s.flags.flavor_keuze = ym(s); }   /* 4.3: kleine keuzes hoogstens één per twee maanden */
  k.id = "k" + hex8(); k.verloopt = plusMonths(s, 2); k.sinds = ym(s);
  for (const o of k.opties) o.kost = r1(o.kost || 0);
  (s.keuzes ??= []).push(k);
  mail(ctx, s, k.van, k.titel, k.tekst + "\n\n*Kies in deze mail of in het overzicht. Zonder antwoord geldt na twee maanden: " + k.opties[k.standaard || 0].label + ".*", "HOOG");
  ctx.mails[ctx.mails.length - 1].keuze = k.id;
  return k;
}
function applyChoice(s, ctx, eff, out = []){
  if (!eff) return out;
  if (eff.kans != null){
    const kans = snapKans(Math.round(clamp(eff.kans, 1, 99))), roll = rolKans(kans), ok = roll.ok;
    addRoll(s, `Keuze: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`);
    out.push(`Worp ${roll.txt}: ${ok ? "gelukt" : "mislukt"}.`);
    return applyChoice(s, ctx, ok ? eff.succes : eff.falen, out);
  }
  const num = (v, lo, hi) => clamp(+v || 0, lo, hi);
  if (eff.cash) s.cash = r1(s.cash + num(eff.cash, -200, 100));
  if (eff.cash_pct) s.cash = r1(s.cash + Math.max(0, s.cash) * num(eff.cash_pct, -0.3, 0.3));
  if (eff.zwart) s.accounts.zwart = r1(Math.max(0, s.accounts.zwart + num(eff.zwart, -100, 60)));
  for (const k2 of ["heat", "reputation", "morale"]) if (eff[k2]) s[k2] = clamp(s[k2] + num(eff[k2], -25, 25));
  for (const [n, v] of Object.entries(eff.factions || {})) if (s.factions[n]) shiftFaction(s, n, num(v, -30, 30));
  for (const [n, v] of Object.entries(eff.loyaliteit || {})){ const p = s.npcs.find(x => x.name === n); if (p) p.loyalty = clamp(p.loyalty + num(v, -40, 40)); }
  for (const [n, v] of Object.entries(eff.loyaliteit_zet || {})){ const p = s.npcs.find(x => x.name === n); if (p) p.loyalty = clamp(+v); }
  for (const [k2, v] of Object.entries(eff.relatie || {})) relShiftP(s, k2, num(v, -40, 40));
  if (eff.bonus_cost) s.culture.bonus_cost = r1(Math.max(0, (s.culture.bonus_cost || 0) + num(eff.bonus_cost, -10, 10)));
  if (eff.personeel) s.staff.count = Math.max(5, s.staff.count + Math.round(num(eff.personeel, -50, 50)));
  if (eff.invloed) s.invloed = r1(Math.max(0, (s.invloed || 0) + num(eff.invloed, -50, 50)));
  if (eff.stream && eff.stream.naam){ (s.streams ??= []).push({naam: String(eff.stream.naam).slice(0, 60), bedrag: r1(num(eff.stream.bedrag, 0.3, 8)), sinds: ym(s), ...(eff.stream.maanden ? {maanden: Math.round(eff.stream.maanden)} : {})}); }
  for (const [n, o] of Object.entries(eff.rivaal || {})){ const r = s.rivals.find(x => x.name === n); if (!r) continue;
    if (o.relatie) relShift(r, num(o.relatie, -40, 40)); if (o.agressie) r.aggression = r1(clamp(r.aggression + num(o.agressie, -0.3, 0.3), 0, 1) * 100) / 100;
    if (o.aandeel){ const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * clamp(+o.aandeel, 0.5, 1.2); }
    if (o.geheugen) remember(r, s, String(o.geheugen).slice(0, 120)); }
  if (eff.rivaal_alle) for (const r of s.rivals) r.aggression = r1(clamp(r.aggression + num(eff.rivaal_alle.agressie, -0.3, 0.3), 0, 1) * 100) / 100;
  for (const [id, o] of Object.entries(eff.bedrijf || {})){ const b = (s.bedrijven || []).find(x => x.id === id); if (b && o.relatie) b.relatie = Math.round(clamp(b.relatie + num(o.relatie, -40, 40), -100, 100)); if (b && o.contract && !b.eigenaar) b.contract = true; }
  for (const [id, o] of Object.entries(eff.gang || {})){ const g = (s.gangs || []).find(x => x.id === id); if (!g) continue;
    if (o.relatie) g.relatie = Math.round(clamp(g.relatie + num(o.relatie, -50, 50), -100, 100));
    if (o.deal !== undefined) g.deal = o.deal;
    if (o.presence){ const [land, v] = o.presence; if (g.gebied[land] != null) g.gebied[land] = Math.round(clamp(g.gebied[land] + v, 0, 95)); } }
  for (const [k2, v] of Object.entries(eff.flags || {})) s.flags[k2] = v;
  if (eff.ontslag){ const n = s.npcs.find(x => x.name === eff.ontslag); if (n){ s.npcs = s.npcs.filter(x => x !== n); s.flags["vacature_" + n.role] = ym(s); out.push(`${n.name} is weg.`); } }
  if (eff.ontmasker) out.push(ontmasker(s, ctx, eff.ontmasker));
  if (eff.dreiging){ const t = (s.dreigingen || []).find(x => x.id === eff.dreiging.id); if (t){ if (eff.dreiging.annuleer) s.dreigingen = s.dreigingen.filter(x => x !== t); else t.extra = (t.extra || 0) + (eff.dreiging.extra || 0); } }
  for (const [id, o] of Object.entries(eff.product || {})){ const p = (s.producten || []).find(x => x.id === id); if (!p) continue;
    if (o.abo && isAbo(p)) p.abo = r1(clamp((p.abo || 0) * (1 + o.abo / 100), 0, 140)); if (o.pop) p.pop = Math.round(clamp(p.pop + o.pop, 3, 95)); if (o.pop && isAbo(p)) p.abo = r1(clamp((p.abo ?? p.pop) * (1 + o.pop / (o.pop < 0 ? 100 : 200)), 0, 140)); if (o.prijs && PRIJS[o.prijs]){ p.prijs = o.prijs; p.prijsF = Math.max(prijsF(p), PRIJS_F[o.prijs]); } if (o.versie && !p.verbetering && p.kwaliteit < 5) p.verbetering = o.versie; }
  if (eff.crew_vrij){ const m = (s.crew || []).find(x => x.id === eff.crew_vrij); if (m){ m.uit = null; m.loyaliteit = clamp(m.loyaliteit + 15); } }
  for (const [id, v] of Object.entries(eff.crew_loy || {})){ const m = (s.crew || []).find(x => x.id === id); if (m) m.loyaliteit = clamp(m.loyaliteit + v); }
  if (eff.plan) planActie(s, eff.plan, out);
  if (eff.focus && FOCUS[eff.focus] && !heeftFocus(s, eff.focus)){ (s.focus ??= []).push(eff.focus); out.push(`Nieuwe koers: ${FOCUS[eff.focus].naam}. ${FOCUS[eff.focus].tekst}`); }
  if (eff.integratie) out.push(koppelBedrijf(s, eff.integratie.id, eff.integratie.wijze));
  if (eff.tekst) out.push(eff.tekst);
  return out;
}
function actKeuze(s, ctx, id, i){
  const k = (s.keuzes || []).find(x => x.id === id); if (!k) return {ok: false, msg: "Deze keuze staat niet meer open."};
  const o = k.opties[+i]; if (!o) return {ok: false, msg: "Onbekende optie."};
  if (o.kost){ if (o.bron === "zwart"){ if (s.accounts.zwart < o.kost) return {ok: false, msg: `Niet genoeg zwart geld (€${o.kost}M nodig).`}; s.accounts.zwart = r1(s.accounts.zwart - o.kost); }
    else { if (s.cash < o.kost) return {ok: false, msg: `Niet genoeg cash (€${o.kost}M nodig).`}; s.cash = r1(s.cash - o.kost); } }
  s.keuzes = s.keuzes.filter(x => x !== k);
  const out = applyChoice(s, ctx, o.eff); s.accounts.operationeel = s.cash;
  const msg = `${k.titel}: ${o.label}. ${out.join(" ")}`.trim();
  (s.keuzes_klaar ??= []).unshift({id: k.id, soort: k.soort, titel: k.titel, gekozen: o.label, uitkomst: out.join(" "), m: ym(s)}); s.keuzes_klaar = s.keuzes_klaar.slice(0, 40);
  addLog(s, msg); return {ok: true, msg};
}
function keuzeExpiry(s, ctx){
  for (const k of [...(s.keuzes || [])]) if (k.verloopt <= ym(s)){
    const o = k.opties[k.standaard || 0]; s.keuzes = s.keuzes.filter(x => x !== k);
    if (o.kost && s.cash >= o.kost) s.cash = r1(s.cash - o.kost);
    const out = applyChoice(s, ctx, o.eff);
    (s.keuzes_klaar ??= []).unshift({id: k.id, soort: k.soort, titel: k.titel, gekozen: o.label + " (geen antwoord)", uitkomst: out.join(" "), m: ym(s)});
    ctx.rep.push(`Geen antwoord op "${k.titel}": ${o.label}`);
  }
}
function keuzeHeadhunt(s, ctx, r, n){
  if ((s.keuzes || []).some(k => k.soort === "headhunt" && k.wie === n.name)) return;
  const k = addKeuze(s, ctx, {soort: "headhunt", wie: n.name, van: "HR", titel: `${r.name} probeert ${n.name} weg te kopen`,
    tekst: `${r.ceo} heeft ${n.name} (${n.role}) mee uit lunchen genomen. Volgens de wandelgangen ligt er een aanbod met een mooi getal. ${n.name} heeft nog niets gezegd. Tegen ons ook niet.`, opties: [
    {label: "Tegenbod · €5M", kost: 5, uitleg: "Loyaliteit +15. Het aanbod van de rivaal is van tafel.", eff: {loyaliteit: {[n.name]: 15}, tekst: `${n.name} blijft.`}},
    {label: "Een eerlijk gesprek", uitleg: `Gratis. ${n.loyalty >= 50 ? "Goede" : "Kleine"} kans dat het helpt.`, eff: {kans: clamp(n.loyalty + 15, 20, 90), succes: {loyaliteit: {[n.name]: 8}, tekst: `${n.name} blijft, voorlopig.`}, falen: {loyaliteit: {[n.name]: -6}, tekst: `${n.name} hoorde vooral dat er geen geld kwam.`}}},
    {label: `${r.ceo} aanspreken`, uitleg: "Relatie met de rivaal −12, loyaliteit +5. Je laat zien dat je het weet.", eff: {rivaal: {[r.name]: {relatie: -12, geheugen: "werd betrapt op headhunten"}}, loyaliteit: {[n.name]: 5}}},
    {label: "Laten gaan", uitleg: "Gratis. Loyaliteit −8.", eff: {loyaliteit: {[n.name]: -8}}}], standaard: 3});
  return k;
}
const KEUZES = [
  {id: "opslag", w: 2, cd: 9, gen(s){ const n = CH(s.npcs.filter(x => x.ambition >= 45 && !x.promotie)); if (!n) return null; const b = r1(1 + n.ambition / 60);
    return {van: `${n.name} (${n.role})`, titel: "Een gesprek over mijn toekomst", tekst: `Ik werk hier nu een tijd. Ik krijg aanbiedingen, en ik zou liegen als ik zei dat ik er niet over nadenk. Ik vraag €${b}M per maand meer. Of een eenmalig gebaar. Of u zegt nee, en dan weet ik ook waar ik sta.`,
      opties: [{label: `Opslag · +€${b}M/mnd`, uitleg: "Loyaliteit +18. Je vaste kosten stijgen blijvend.", eff: {bonus_cost: b, loyaliteit: {[n.name]: 18}}},
        {label: "Eenmalige bonus · €4M", kost: 4, uitleg: "Loyaliteit +8.", eff: {loyaliteit: {[n.name]: 8}}},
        {label: "Nee", uitleg: "Gratis. Loyaliteit −12.", eff: {loyaliteit: {[n.name]: -12}}}], standaard: 2}; }},
  {id: "interview", w: 1.5, gen(s){ const r = CH(s.rivals); const k2 = snapKans(Math.round(clamp(55 + relV(s, "pers") / 3 + (s.reputation - 30) / 4, 15, 90)));
    return {van: "Dana Kröller (Global Wire)", titel: "Een interview?", tekst: `Ik schrijf een groot stuk over de nieuwe corporaties. U komt erin voor, met of zonder uw medewerking. Met is beter voor u. Of u geeft me iets over ${r ? r.name : "de concurrentie"}, dan schrijf ik over hen.`,
      opties: [{label: "Interview geven", uitleg: `Kans ${k2}%: reputatie +6. Mislukt: reputatie −5.`, eff: {kans: k2, succes: {reputation: 6, relatie: {pers: 5}, tekst: "Het stuk is mild. Bijna vriendelijk."}, falen: {reputation: -5, relatie: {pers: -3}, tekst: "Eén zin uit het interview gaat viraal. De verkeerde."}}},
        ...(r ? [{label: `Iets geven over ${r.name}`, uitleg: `Relatie met Dana +10, ${r.name} verliest 10% marktaandeel, relatie met hen −10, heat +2.`, eff: {relatie: {pers: 10}, rivaal: {[r.name]: {aandeel: 0.9, relatie: -10, geheugen: "vermoedt dat de speler lekte naar de pers"}}, heat: 2}}] : []),
        {label: "Weigeren", uitleg: "Gratis. Relatie met Dana −5.", eff: {relatie: {pers: -5}}}], standaard: r ? 2 : 1}; }},
  {id: "cao", w: 1.5, cd: 14, when: s => faction(s, "vakbond") < 25 || s.morale < 55, gen(s){ const k2 = snapKans(Math.round(clamp(50 + relV(s, "vakbond") / 3, 20, 85)));
    return {van: "Bram Oosterhout (bond)", titel: "De bond wil een akkoord", tekst: "Onze leden draaien uw winst. Wij willen een akkoord: betere roosters, een bonus als het goed gaat. Teken, onderhandel, of zeg nee. Dat laatste raad ik niet aan.",
      opties: [{label: "Akkoord · +€1,5M/mnd", uitleg: "Morale +6, bond +12, relatie +10.", eff: {bonus_cost: 1.5, morale: 6, factions: {vakbond: 12}, relatie: {vakbond: 10}}},
        {label: "Onderhandelen", uitleg: `Kans ${k2}%: morale +3, bond +5. Mislukt: staking, 4% van de kas weg, morale −4.`, eff: {kans: k2, succes: {morale: 3, factions: {vakbond: 5}, tekst: "Een compromis. Niemand is blij, dus het is eerlijk."}, falen: {cash_pct: -0.04, morale: -4, factions: {vakbond: -8}, tekst: "De onderhandelingen klappen. Twee dagen staking."}}},
        {label: "Weigeren", uitleg: "Bond −15, morale −4, relatie −10.", eff: {factions: {vakbond: -15}, morale: -4, relatie: {vakbond: -10}}}], standaard: 2}; }},
  {id: "subsidie", w: 1, cd: 12, gen(s){ const l = homeLandNaam(s);
    return {van: "Minister Achterberg", titel: `Banen in ${l}`, tekst: `De verkiezingen komen eraan en ik heb banen nodig. Neem tien mensen aan in ${l} en ik regel €15M subsidie. Iedereen tevreden, vooral de kiezer.`,
      opties: [{label: "Tien mensen aannemen", uitleg: "+10 personeel (hogere loonkosten), +€15M subsidie, overheid +8, relatie +8.", eff: {personeel: 10, cash: 15, factions: {stad: 8}, relatie: {stad: 8}}},
        {label: "Nee, dank u", uitleg: "Relatie met de minister −4.", eff: {relatie: {stad: -4}}}], standaard: 1}; }},
  {id: "data", w: 1.2, when: s => s.rivals.length > 0, gen(s){ const r = CH(s.rivals), zw = s.accounts.zwart >= 8;
    return {van: "Zes (fixer)", titel: `Data van ${r.name}`, tekst: `Ik heb iemand binnen bij ${r.name}. Klantenlijsten, prijzen, alles. €5M${zw ? " zwart" : ""}. Kan misgaan. Gaat meestal goed.`,
      opties: [{label: `Kopen · €5M${zw ? " zwart" : ""}`, kost: 5, bron: zw ? "zwart" : "operationeel", uitleg: `Kans ${snapKans(70)}%: ${r.name} −15% marktaandeel, +€6M aan klanten voor jou. Mislukt: heat +6, relatie met hen −20.`,
        eff: {kans: 70, succes: {rivaal: {[r.name]: {aandeel: 0.85}}, cash: 6, heat: 2, relatie: {fixer: 5}, tekst: "De data is goud. Hun klanten bellen ons."}, falen: {heat: 6, rivaal: {[r.name]: {relatie: -20, geheugen: "betrapte de speler op bedrijfsspionage"}}, tekst: "De contactpersoon is opgepakt. Hij praat."}}},
        {label: "Nee", uitleg: "Gratis.", eff: {}}], standaard: 1}; }},
  {id: "tip", w: 1.2, when: s => s.rivals.some(r => r.aggression > 0.45 || r.status === "oorlog"), gen(s){
    return {van: "Anoniem", titel: "Iemand plant iets tegen u", tekst: "Een bron zegt dat er een aanval op uw bedrijf wordt voorbereid. Wie, weet ik pas als u betaalt. €2M. Of u gelooft me niet, dat mag ook.",
      opties: [{label: "Betalen · €2M", kost: 2, uitleg: `Kans ${snapKans(60)}% dat het klopt: twee maanden macht +8.`, eff: {kans: 60, succes: {flags: {alert: plusMonths(s, 2)}, tekst: "De tip klopt. Security staat twee maanden extra scherp."}, falen: {tekst: "De bron is spoorloos. Het geld ook."}}},
        {label: "Negeren", uitleg: "Gratis.", eff: {}}], standaard: 1}; }},
  {id: "vreemdeling", w: 0.8, gen(s){
    return {van: "Receptie", titel: "Een vreemdeling zonder naam", tekst: "Een man zonder naam wil u persoonlijk spreken. Hij betaalt contant voor een kop koffie en weigert te zeggen wat hij wil. Hij wacht in de lobby.",
      opties: [{label: "Ontvangen", uitleg: "Onbekend. Kan geld opleveren of moeilijkheden.", eff: {kans: 55, succes: {cash: 12, invloed: 3, tekst: "Een stille investeerder. €12M, geen vragen, een telefoonnummer zonder netnummer."}, falen: {heat: 4, reputation: -2, tekst: "Er stond een fotograaf buiten. Morgen staat u naast een wapenhandelaar in de krant."}}},
        {label: "Wegsturen", uitleg: "Gratis.", eff: {}}], standaard: 1}; }},
  {id: "sponsor", w: 1, gen(s){ const d = CH(s.districts.filter(x => x.control === "player")) || CH(s.districts);
    return {van: "PR", titel: `Festival in ${d.name} zoekt een hoofdsponsor`, tekst: `Het grootste muziekfestival van ${d.name} zoekt een hoofdsponsor. Een kans, een kostenpost en een bom aan fotografen. Kortsluiting staat op de affiche.`,
      opties: [{label: "Sponsoren · €6M", kost: 6, uitleg: "Reputatie +4, straat +6, relatie met Mara Vonk +5.", eff: {reputation: 4, factions: {straat: 6}, relatie: {vonk: 5}}},
        {label: "Nee", uitleg: "Gratis.", eff: {}}], standaard: 1}; }},
  {id: "sekte", w: 0.8, gen(s){
    return {van: "HR", titel: "De Kerk van Chroom werft onder onze mensen", tekst: "Een sekte rekruteert operators op de werkvloer. Ze zeggen 'vlees is tijdelijk'. Dat is niet ons loonbeleid. Mensen vinden het interessant.",
      opties: [{label: "Verbieden", uitleg: `Kans ${snapKans(70)}%: rust. Mislukt: reputatie −3. Altijd morale −2.`, eff: {morale: -2, kans: 70, succes: {tekst: "De pamfletten zijn weg."}, falen: {reputation: -3, tekst: "Een medewerker klaagt publiek over 'geloofsvervolging'."}}},
        {label: "Toestaan", uitleg: "Morale +2, reputatie −2.", eff: {morale: 2, reputation: -2}},
        {label: "Infiltreren · €3M", kost: 3, uitleg: `Kans ${snapKans(55)}%: invloed +5 en de sekte werkt voor jou. Mislukt: heat +3.`, eff: {kans: 55, succes: {invloed: 5, tekst: "De Kerk heeft een nieuwe weldoener. U."}, falen: {heat: 3, tekst: "Onze infiltrant is bekeerd."}}}], standaard: 0}; }},
  {id: "klant", w: 2, when: s => (s.bedrijven || []).some(b => !b.eigenaar && !b.contract), gen(s){ const b = CH((s.bedrijven || []).filter(x => !x.eigenaar && !x.contract)); const amt = r1(clamp(b.waarde * 0.012, 1, 4)), on = r1(b.waarde * 0.04);
    return {van: `${b.ceo} (${b.naam})`, titel: "Een jaarcontract?", tekst: `${b.naam} uit ${landNaam(s, b.land)} zoekt een partner voor twaalf maanden. Wij betalen goed, u levert op tijd. Opstarten kost u wat.`,
      opties: [{label: `Tekenen · €${on}M`, kost: on, uitleg: `12 maanden +€${amt}M per maand. Relatie +10.`, eff: {stream: {naam: `Jaarcontract ${b.naam}`, bedrag: amt, maanden: 12}, bedrijf: {[b.id]: {relatie: 10}}}},
        {label: "Hoger inzetten", kost: on, uitleg: `€${on}M. Kans ${snapKans(50)}%: 12 maanden +€${r1(amt * 1.4)}M. Mislukt: geen deal, geld weg.`, eff: {kans: 50, succes: {stream: {naam: `Jaarcontract ${b.naam}`, bedrag: r1(amt * 1.4), maanden: 12}, tekst: "Ze slikken de prijs."}, falen: {bedrijf: {[b.id]: {relatie: -8}}, tekst: "Ze kiezen een ander."}}},
        {label: "Afslaan", uitleg: "Gratis.", eff: {}}], standaard: 2}; }},
  {id: "diner_rivaal", w: 1, when: s => s.rivals.some(r => r.status !== "oorlog"), gen(s){ const r = CH(s.rivals.filter(x => x.status !== "oorlog"));
    return {van: r.ceo, titel: "Een diner, zonder advocaten", tekst: `We zijn concurrenten, geen vijanden. Nog niet. Ik nodig u uit voor een diner. U betaalt de wijn, ik de rest.`,
      opties: [{label: "Ingaan · €1M", kost: 1, uitleg: "Relatie met " + r.name + " +12.", eff: {rivaal: {[r.name]: {relatie: 12}}}},
        {label: "Afslaan", uitleg: "Relatie −6.", eff: {rivaal: {[r.name]: {relatie: -6, geheugen: "sloeg een uitnodiging af"}}}}], standaard: 1}; }},
  {id: "klokkenluider", w: 2, when: s => s.npcs.some(n => n.verraad), gen(s){ const n = s.npcs.find(x => x.verraad);
    return {van: "Een medewerker (anoniem)", titel: "Ik moet iemand iets vertellen", tekst: "Ik werk op de afdeling van iemand in de directie. Ik zie dingen. Ik wil praten, maar niet hier en niet lang.",
      opties: [{label: "Luisteren", uitleg: `Gratis. Kans ${snapKans(65)}% dat het iets oplevert.`, eff: {kans: 65, succes: {ontmasker: n.name}, falen: {tekst: "De medewerker kwam niet opdagen. Een dag later had hij ontslag genomen."}}},
        {label: "Afwimpelen", uitleg: "Gratis.", eff: {}}], standaard: 1}; }},
  {id: "isra_vracht", w: 1, when: s => faction(s, "nomaden") > -10, gen(s){
    return {van: "Isra", titel: "Een vracht die niemand wil", tekst: "Er staat een trailer aan de grens die niemand wil hebben. Wij wel. Wij kunnen hem niet verkopen, u wel. We delen.",
      opties: [{label: "Meenemen", uitleg: "+€8M zwart, nomaden +5, relatie +6, heat +3.", eff: {zwart: 8, factions: {nomaden: 5}, relatie: {isra: 6}, heat: 3}},
        {label: "Weigeren", uitleg: "Nomaden −4.", eff: {factions: {nomaden: -4}}}], standaard: 1}; }},
];
function peopleTick(s, ctx, diff){
  keuzeExpiry(s, ctx);
  for (const [key, , , , fac] of NETWERK){ const r = (s.relaties ??= {})[key] ??= {v: fac ? Math.round(faction(s, fac) * 0.6) : 0};
    r.v = Math.round(r.v + ((fac ? faction(s, fac) * 0.6 : 0) - r.v) * 0.04); }
  if (relV(s, "vonk") >= 50){ s.reputation = clamp(s.reputation + 0.3); shiftFaction(s, "straat", 1); }
  if (npcActive(s, "rep")) s.reputation = clamp(s.reputation + 0.5);
  if (npcActive(s, "morale")) s.morale = clamp(s.morale + 0.5);
  if (s.flags.alert && s.flags.alert < ym(s)) delete s.flags.alert;
  if ((s.keuzes || []).length >= 3 || R() > 0.6) return;
  const ok = KEUZES.filter(k => !(s.keuzes || []).some(x => x.soort === k.id) && (!k.when || k.when(s)) && (s.flags["keuze_" + k.id] || "") < plusMonths(s, -(k.cd || 6)));
  if (!ok.length) return;
  const k = wpick(ok.map(x => [x, x.w])), body = k.gen(s); if (!body) return;
  body.soort = k.id; s.flags["keuze_" + k.id] = ym(s); addKeuze(s, ctx, body);
}

/* ===================== 1.3 ONDERWERELD: syndicaten per regio ===================== */
const GANG_DEFS = [
  {id: "kade", naam: "De Zwarte Kade", leider: "Joost 'Anker' Vermaas", soort: "havensyndicaat", kleur: "#ff9a1f", stijl: "Havens, containers en douaniers op de loonlijst.", gebied: {BNL: 55, UKI: 30, DEU: 25, SCA: 20, FRA: 15}},
  {id: "volk", naam: "Brigada Volk", leider: "Katya Orlova", soort: "maffia", kleur: "#ff3b3b", stijl: "Ex-militairen die energie, wapens en huurlingen verhandelen.", gebied: {RUS: 60, OEU: 45, BLK: 40, CEU: 25, CAZ: 20}},
  {id: "ceniza", naam: "Cártel de Ceniza", leider: "El Gris", soort: "kartel", kleur: "#c6ff2e", stijl: "Drugs, mensen en grensovergangen.", gebied: {MEX: 65, CAM: 50, USA: 25, CAR: 35, GCO: 30}},
  {id: "ferros", naam: "Os Ferros", leider: "Dona Cláudia Reis", soort: "favelanetwerk", kleur: "#ffd400", stijl: "Favela's, wapens en een eigen stroomnet.", gebied: {BRA: 55, GCO: 25, CSU: 30, AND: 20}},
  {id: "static", naam: "Lagos Static", leider: "Chidi 'Zero' Okafor", soort: "hackercollectief", kleur: "#3d7bff", stijl: "Fraude, piratenradio en datadiefstal.", gebied: {NGA: 55, WAF: 40, CAF: 30, NIJ: 15}},
  {id: "haaien", naam: "De Kaapse Haaien", leider: "Pieter-Jan Moolman", soort: "zeepiraten", kleur: "#2bff9a", stijl: "Piraterij en verzekeringsfraude op de Indische Oceaan.", gebied: {ZAF: 40, ZOA: 35, HRN: 55}},
  {id: "zand", naam: "Zandwolven", leider: "Tariq al-Nasr", soort: "smokkelnetwerk", kleur: "#f2a65a", stijl: "Pijpleidingen aftappen, wapens en valse papieren.", gebied: {ARB: 30, LEV: 50, PER: 40, TUR: 35, MAG: 30, NIJ: 30}},
  {id: "lotus", naam: "Rode Lotus", leider: "Madame Wen", soort: "triade", kleur: "#ff5fa2", stijl: "Havens, gokpaleizen en namaak-implantaten.", gebied: {CHN: 45, IDC: 50, INS: 40, KOR: 15, PAC: 20}},
  {id: "kuroi", naam: "Kuroi-kai", leider: "Oyabun Sato", soort: "yakuza-clan", kleur: "#f2f2f2", stijl: "Bescherming, vastgoed en klinieken voor illegale cyberware.", gebied: {JPN: 55, KOR: 30}},
  {id: "spook", naam: "Spookdraad", leider: "Anansi", soort: "hackernetwerk", kleur: "#9b5cff", stijl: "Ransomware, botnets en gestolen identiteiten.", gebied: {IND: 40, PAK: 35, CAZ: 25, SCA: 15}},
  {id: "rif", naam: "Het Rif-syndicaat", leider: "Shane Callahan", soort: "motorbende", kleur: "#00e5ff", stijl: "Mijnsteden, synthetische drugs en motorclubs.", gebied: {AUS: 50, PAC: 30}},
];
function genGangs(s){
  const ids = new Set(s.districts.map(d => d.id));
  return GANG_DEFS.map(g => { const geb = Object.fromEntries(Object.entries(g.gebied).filter(([k2]) => ids.has(k2)).map(([k2, v]) => [k2, Math.round(v * U(0.85, 1.15))]));
    return {id: g.id, naam: g.naam, leider: g.leider, soort: g.soort, kleur: g.kleur, stijl: g.stijl, relatie: 0, deal: null, actie: null, gebied: geb, basis: {...geb}}; });
}
const gangKracht = g => Math.round(15 + Object.values(g.gebied).reduce((a, v) => a + v, 0) / 8);
const gangLanden = (s, g) => Object.entries(g.gebied).filter(([id, v]) => v >= 15 && (s.districts.find(d => d.id === id) || {}).control === "player").map(([id, v]) => ({id, v}));
const gangFee = (s, g) => r1(Math.max(0.5, gangLanden(s, g).reduce((a, x) => a + x.v, 0) / 20 * clamp(omvang(s), 0.5, 2.5)) * (DIFF[s.player.difficulty] || 1));
const gangPartner = (s, g) => r1(gangLanden(s, g).reduce((a, x) => a + x.v, 0) / 28);
function gangOf(s, land){ let best = null; for (const g of s.gangs || []){ const v = g.gebied[land] || 0; if (v > (best ? best.v : 0)) best = {g, v}; } return best; }
function uitrokenKans(s, g, land){ return snapKans(Math.round(clamp(45 + (playerPower(s) - gangKracht(g)) * 1.2 - (g.gebied[land] || 0) / 4, 10, 85))); }
function actGang(s, ctx, id, soort, land){
  const g = (s.gangs || []).find(x => x.id === id); if (!g) return {ok: false, msg: "Onbekende groep."};
  const m = ym(s), pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; }; let msg;
  if (soort === "bescherming"){ if (g.deal === "bescherming") return {ok: false, msg: "Je betaalt ze al."}; if (g.relatie < -40) return {ok: false, msg: `${g.naam} wil niet met je praten (relatie ${g.relatie}). Maak eerst iets goed.`};
    g.deal = "bescherming"; g.relatie = Math.round(clamp(g.relatie + 10, -100, 100)); msg = `Afgesproken met ${g.leider}: €${gangFee(s, g)}M per maand en ${g.naam} laat je met rust.`; }
  else if (soort === "partner"){ if (g.deal === "partner") return {ok: false, msg: "Jullie werken al samen."}; if (g.relatie < 25) return {ok: false, msg: `${g.naam} werkt pas samen vanaf relatie 25 (nu ${g.relatie}).`};
    if (s.culture.heat_decay >= 3 && (s.culture.ethics_rules || []).length > 1) return {ok: false, msg: "Je eigen ethiekregels verbieden dit. De raad zou het merken."};
    g.deal = "partner"; s.heat = clamp(s.heat + 3); shiftFaction(s, "politie", -5); msg = `Partners met ${g.naam}: ongeveer €${gangPartner(s, g)}M zwart geld per maand, maar heat stijgt en het toezicht kijkt mee.`; }
  else if (soort === "opzeggen"){ if (!g.deal || g.deal === "oorlog") return {ok: false, msg: "Er is niets op te zeggen."};
    const was = g.deal; g.deal = null; g.relatie = Math.round(clamp(g.relatie - (was === "partner" ? 20 : 10), -100, 100)); msg = `Afspraak met ${g.naam} opgezegd. Ze onthouden het.`; }
  else if (soort === "geschenk"){ if (g.actie === m) return {ok: false, msg: "Je hebt ze deze maand al iets gestuurd."}; if (!pay(5)) return {ok: false, msg: "Een geschenk kost €5M. Niet genoeg cash."};
    g.actie = m; g.relatie = Math.round(clamp(g.relatie + 12, -100, 100)); if (g.deal === "oorlog" && g.relatie > -40){ g.deal = null; msg = `${g.leider} accepteert het gebaar. Het conflict is voorbij.`; } else msg = `${g.leider} accepteert het geschenk. Relatie nu ${g.relatie}.`; }
  else if (soort === "uitroken"){
    if (!land || !(g.gebied[land] >= 5)) return {ok: false, msg: "Kies een gebied waar ze zitten."};
    const d = s.districts.find(x => x.id === land); if (!d || d.control !== "player") return {ok: false, msg: "Je kunt ze alleen uit je eigen gebied verdrijven."};
    const kost = r1(4 * (DIFF[s.player.difficulty] || 1)); if (!pay(kost)) return {ok: false, msg: `Uitroken kost €${kost}M. Niet genoeg cash.`};
    const kans = uitrokenKans(s, g, land), roll = rolKans(kans), ok = roll.ok;
    addRoll(s, `${g.naam} uit ${d.name} verdrijven: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`);
    g.relatie = Math.round(clamp(g.relatie - (ok ? 25 : 15), -100, 100)); if (g.deal === "bescherming" || g.deal === "partner") g.deal = null;
    if (g.relatie <= -50) g.deal = "oorlog";
    if (ok){ g.gebied[land] = Math.max(0, g.gebied[land] - 30); s.reputation = clamp(s.reputation + 2); shiftFaction(s, "politie", 3);
      msg = `Geslaagd (worp ${roll.txt}). ${g.naam} verliest terrein in ${d.name}: aanwezigheid nu ${g.gebied[land]}.`;
      news(s, `${s.player.corp_name} verdrijft ${g.naam} uit ${d.name}`, `Een reeks invallen op panden van ${g.naam}. Officieel was het de politie.`, d.continent, "onderwereld", true); }
    else { s.cash = r1(s.cash - 5); s.morale = clamp(s.morale - 3); s.heat = clamp(s.heat + 3); msg = `Mislukt (worp ${roll.txt}). Onze mensen liepen in een hinderlaag: €5M schade, morale −3, heat +3.`; }
    if (g.deal === "oorlog") msg += ` ${g.naam} beschouwt dit als oorlog.`;
  } else return {ok: false, msg: "Onbekende actie."};
  addLog(s, msg); return {ok: true, msg};
}
function gangTick(s, ctx, diff){
  const gangs = s.gangs || []; if (!gangs.length) return;
  const sec = s.divisions.filter(d => d.type === "Private Security").reduce((a, d) => a + d.level, 0);
  for (const g of gangs){
    for (const [land, p] of Object.entries(g.gebied)){
      const d = s.districts.find(x => x.id === land); if (!d) continue;
      let tgt = (g.basis || {})[land] ?? 20;
      if (d.control === "player") tgt -= (s.defensie || 0) * 5 + sec * 3 - (g.deal === "partner" ? 15 : 0) + ((s.patrouille || {})[land] ? 15 : 0);
      else if (d.control !== "neutral"){ const r = s.rivals.find(x => x.name === d.control); tgt -= r ? r.defensie * 5 + (r.divs["Private Security"] || 0) * 3 : 0; }
      g.gebied[land] = Math.round(clamp(p + (tgt - p) * 0.05 + U(-2, 2), 0, 95));
    }
    if (R() < 0.04){ const from = Object.keys(g.gebied).filter(k2 => g.gebied[k2] > 40), src = from.length ? s.districts.find(d => d.id === CH(from)) : null;
      const nb = src ? (src.neighbors || []).filter(n => g.gebied[n] == null) : [];
      if (nb.length){ const n = CH(nb); g.gebied[n] = 10; (g.basis ??= {})[n] = 20; news(s, `${g.naam} duikt op in ${landNaam(s, n)}`, `Nieuwe panden, nieuwe gezichten, dezelfde tatoeages. ${g.naam} breidt uit.`, (s.districts.find(d => d.id === n) || {}).continent, "onderwereld", (s.districts.find(d => d.id === n) || {}).control === "player"); } }
    g.relatie = Math.round(g.relatie * 0.98 + (g.deal === "partner" ? 1.5 : g.deal === "bescherming" ? 0.6 : 0));
    if (g.deal === "oorlog" && g.relatie > -30) g.deal = null;
  }
  // syndicaten onderling en tegen rivalen
  if (R() < 0.08){
    const shared = []; for (const a of gangs) for (const b of gangs) if (a.id < b.id) for (const l of Object.keys(a.gebied)) if (b.gebied[l] > 10 && a.gebied[l] > 10) shared.push([a, b, l]);
    if (shared.length){ const [a, b, l] = CH(shared), win = R() < a.gebied[l] / (a.gebied[l] + b.gebied[l]) ? a : b, lose = win === a ? b : a, d = s.districts.find(x => x.id === l);
      lose.gebied[l] = Math.max(0, lose.gebied[l] - 15); win.gebied[l] = Math.min(95, win.gebied[l] + 8); if (d) d.mod = {f: 0.85, m: 2, why: `Bendeoorlog in ${d.name}`};
      vraagSchok(s, "wapen", 0.05, `Bendeoorlog in ${d ? d.name : l}`);
      news(s, `Bendeoorlog in ${d ? d.name : l}: ${win.naam} tegen ${lose.naam}`, `Schietpartijen bij havens en clubs. ${win.naam} wint terrein. De economie van ${d ? d.name : l} lijdt twee maanden.`, d ? d.continent : "", "onderwereld", d && d.control === "player"); }
  }
  for (const r of s.rivals) for (const d of rivalDistricts(s, r)){ const b = gangOf(s, d.id); if (b && b.v > 45 && R() < 0.04){ r.cash = r1(r.cash - U(3, 8)); news(s, `${b.g.naam} raakt ${r.name} in ${d.name}`, `Een overval op een depot van ${r.name}. ${b.g.leider} ontkent alles en lacht erbij.`, d.continent, "onderwereld"); } }
  // gevolgen voor de speler
  let fee = 0, zw = 0, incident = false;
  for (const g of gangs){
    const lands = gangLanden(s, g); if (!lands.length) continue;
    if (g.deal === "bescherming"){ fee += gangFee(s, g); continue; }
    if (g.deal === "partner"){ zw += gangPartner(s, g); s.heat = clamp(s.heat + 0.5 * lands.length); shiftFaction(s, "politie", -0.5); continue; }
    if (incident || (g.rust && mndNr(ym(s)) - mndNr(g.rust) < 4)) continue;   /* 4.3: na een incident vier maanden rust */
    const pw = Math.min(0.6, playerPower(s) / 150);
    for (const {id, v} of lands){
      const p = v / 700 * (g.deal === "oorlog" ? 2.2 : 1) * diff * (1 - pw);
      if (R() >= p) continue;
      incident = true; g.rust = ym(s); const d = s.districts.find(x => x.id === id), dmg = r1(clamp(v / 5, 3, 18) * diff * clamp(omvang(s), 0.5, 2.5)), b = r1(clamp(v / 4, 3, 20) * diff * clamp(omvang(s), 0.5, 2.5)), k2 = uitrokenKans(s, g, id);
      if (g.deal === "oorlog" || (s.keuzes || []).some(x => x.soort === "gang_" + g.id)){
        s.cash = r1(s.cash - dmg); s.morale = clamp(s.morale - 2);
        mail(ctx, s, "Head of Security", `${g.naam} slaat toe in ${d.name}`, `Een overval op onze vestiging in ${d.name}. €${dmg}M schade, mensen zijn bang. ${g.naam} laat weten dat dit pas het begin is.`, "KRITIEK");
        ctx.rep.push(`${g.naam} overvalt ${d.name}: −€${dmg}M`);
      } else addKeuze(s, ctx, {soort: "gang_" + g.id, van: `${g.leider} (${g.naam})`, titel: `Een rekening uit ${d.name}`,
        tekst: `Uw vestiging in ${d.name} staat op ons grondgebied. Dat is niet erg. Wel als u er niet voor betaalt. €${b}M en er gebeurt niets. Anders gebeurt er iets.`, opties: [
        {label: `Betalen · €${b}M`, kost: b, uitleg: "Rust, voor nu. Relatie +6.", eff: {gang: {[g.id]: {relatie: 6}}, tekst: "Het geld is opgehaald. Beleefd zelfs."}},
        {label: "Vaste bescherming", uitleg: `€${gangFee(s, g)}M per maand en geen incidenten meer van ${g.naam}. Relatie +10.`, eff: {gang: {[g.id]: {deal: "bescherming", relatie: 10}}, tekst: `U staat op de lijst van ${g.naam}. De goede lijst.`}},
        {label: "Weigeren", uitleg: `Gratis. Grote kans op €${dmg}M schade.`, eff: {kans: Math.round(clamp(30 + playerPower(s) / 3 - v / 3, 10, 75)), succes: {gang: {[g.id]: {relatie: -5}}, tekst: "Er gebeurde niets. Ze testten u, en u knipperde niet."}, falen: {cash: -dmg, morale: -3, gang: {[g.id]: {relatie: -10}}, tekst: `Een loods in ${d.name} brandde af. Niemand zag iets.`}}},
        {label: `Terugslaan · €${r1(8 * diff)}M`, kost: r1(8 * diff), uitleg: `Kans ${k2}% om ze uit ${d.name} te verdrijven (−30 aanwezigheid). Mislukt: €${dmg}M schade en een vete.`, eff: {kans: k2,
          succes: {gang: {[g.id]: {relatie: -25, presence: [id, -30]}}, reputation: 2, tekst: `${g.naam} trekt zich terug uit ${d.name}.`}, falen: {cash: -dmg, morale: -4, heat: 4, gang: {[g.id]: {relatie: -20}}, tekst: "Een hinderlaag. Onze mensen kwamen terug zonder auto's."}}}], standaard: 2});
      break;
    }
  }
  if (fee){ s.cash = r1(s.cash - fee); ctx.rep.push(`Bescherming: −€${r1(fee)}M`); }
  if (zw){ s.accounts.zwart = r1(s.accounts.zwart + zw); ctx.rep.push(`Onderwereld-partners: +€${r1(zw)}M zwart`); }
}

/* ===================== migratie en wereldfeiten voor 1.1-1.3 ===================== */
function migrate13(s){
  if (!s.districts || !s.districts.length || !s.player) return;
  s.nieuws ??= []; s.keuzes ??= []; s.keuzes_klaar ??= []; s.relaties ??= {};
  if (!s.sectoren){ s.sectoren = {}; for (const t of allTypes(s)) s.sectoren[t] = {idx: 100, trend: 0, hist: [100]}; }
  if (!s.bedrijven && s.map && s.map.kind === "wereld") s.bedrijven = genBedrijven(s);
  if (!s.gangs && s.map && s.map.kind === "wereld") s.gangs = genGangs(s);
  for (const g of s.gangs || []) g.basis ??= Object.fromEntries(Object.entries(g.gebied).map(([k2, v]) => [k2, Math.min(v, 60)]));
  if (s.player.startbonus === undefined){ const a = (s.districts.find(d => d.id === s.player.home_district) || {}).arch; s.player.startbonus = START_BONUS[a] ? a : null; }
  for (const [key, , , , fac] of NETWERK) s.relaties[key] ??= {v: fac ? Math.round(faction(s, fac) * 0.6) : 0};
  const F = s.factions || {};
  const notes = {nomaden: "Clans op de transcontinentale snelwegen. Respect, geen vriendschap.", vakbond: "De internationale bonden: havens, fabrieken, transport.", politie: "Politie en toezicht: Europol, douane, inspecties.", stad: "Overheden en ministeries: vergunningen en subsidies.", straat: "De straat, op elk continent. Zij weten het eerder."};
  for (const [k2, n] of Object.entries(notes)) if (F[k2] && /Ringweg|Haven\/Staal|Oude Stad|Gemeenteraad|Roest/.test(F[k2].note || "")) F[k2].note = n;
}

/* ===================== 2.0 DOBBELSTENEN: 2d6 + bonus tegen een doel ===================== */
const DICE = "⚀⚁⚂⚃⚄⚅";
function d6(){ try { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % 6); } catch(e){ return RI(1, 6); } }
function kans2d6(bonus, doel, slordig){ let n = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++){ const t = a + b; if (t === 12 || (t > (slordig ? 3 : 2) && t + bonus >= doel)) n++; } return Math.round(n / 36 * 100); }
function doelVoor(kans){ let best = 7, bd = 1e9; for (let t = 3; t <= 12; t++){ const d = Math.abs(kans2d6(0, t) - kans); if (d < bd){ bd = d; best = t; } } return best; }
const snapKans = k => k >= 100 ? 100 : kans2d6(0, doelVoor(k));
function rol2d6(bonus, doel, slordig){
  const a = d6(), b = d6(), t = a + b, som = t + bonus, crit = t === 12, blunder = t <= (slordig ? 3 : 2), ok = crit || (!blunder && som >= doel);
  return {ok, crit, blunder, som, doel, kans: kans2d6(bonus, doel, slordig),
    txt: `${DICE[a - 1]}${DICE[b - 1]}${bonus ? ` ${bonus > 0 ? "+" : "−"}${Math.abs(bonus)}` : ""} = ${som}, nodig ${doel}+${crit ? " · dubbel zes, altijd raak" : blunder ? " · blunder" : ""}`};
}
function rolKans(kans){ if (kans >= 100) return {ok: true, txt: "geen worp nodig", kans: 100}; return rol2d6(0, doelVoor(kans)); }

/* ===================== 2.0 TIJD: tijdperken, status, een wereld die verandert ===================== */
const TIJDPERKEN = [
  {naam: "Analoge chroom", vanaf: 0, tekst: "Telefoons met draaischijf, implantaten voor de rijken en corporaties die nog doen alsof ze regels volgen."},
  {naam: "Neurale opmars", vanaf: 24, tekst: "Implantaten worden goedkoop en overal verkocht. Cyberware groeit, syndicaten ook. Er komen nieuwe bedrijven en betere specialisten op de markt."},
  {naam: "Corporatieoorlogen", vanaf: 60, tekst: "Rivalen worden agressiever en vechten ook onderling. Huurlingen zijn duurder, klussen leveren meer op."},
  {naam: "Het Chroomtijdperk", vanaf: 96, tekst: "De eerste orbitale fabrieken draaien. Staten zijn franchises. Wie nu groot is, blijft het, als hij niet valt."},
];
const STATUS_LADDER = [[0, "Startup"], [450, "Gevestigde naam"], [1000, "Machtsblok"], [2000, "Megacorporatie"], [4000, "Hegemoon"]];
const maandenGespeeld = s => s.maanden ?? (s.history || []).length;
const tijdperkVan = s => { let i = 0; TIJDPERKEN.forEach((t, j) => { if (maandenGespeeld(s) >= t.vanaf) i = j; }); return i; };
function statusVan(s){ const v = playerValue(s); let i = 0; STATUS_LADDER.forEach(([min], j) => { if (v >= min) i = j; }); return i; }
const crewMax = s => 3 + (s.statusNiveau || 0);
const OPVOLGERS = {
  stad: [["Minister Achterberg", "verliest de verkiezingen"], ["Minister Okafor-Lind", "wint de verkiezingen"], ["Minister Van der Brugge", "neemt de portefeuille over"], ["Minister Sato-Meyer", "wordt benoemd na een kabinetscrisis"]],
  politie: [["Commissaris Vermeulen", "gaat met pensioen"], ["Commissaris Dragić", "neemt de afdeling over"], ["Commissaris Haddad", "wordt hoofd bedrijfscriminaliteit"]],
  pers: [["Dana Kröller", "stapt over naar een groter blad"], ["Yusuf Ellery", "wordt de nieuwe onderzoeksjournalist van Global Wire"], ["Ines Vahl", "neemt de economierubriek over"]],
  bank: [["Mevr. Lindqvist", "wordt naar het hoofdkantoor gehaald"], ["Dhr. Abara", "wordt de nieuwe kredietdirecteur"], ["Mevr. Castellanos", "neemt de kredietafdeling over"]],
  vakbond: [["Bram Oosterhout", "verliest de voorzittersverkiezing"], ["Fatima Ouali", "wordt voorzitter van de bond"], ["Sven Rasmussen", "neemt de bond over"]],
};
const RIVAL_CEO_NAMEN = ["Helena Voss", "Marcus Adeyemi", "Yuki Tanabe", "Ruben Castillo", "Olena Kravets", "Idris Bello", "Sofia Lindgren", "Haruto Kaneda", "Carmen Duarte", "Viktor Hale"];
const STARTUPS = ["Neonroot Labs", "Quietwire", "Kobaltkraai", "Ninth Harbor", "Glasvogel AI", "Redshift Freight", "Morrow Biotics", "Paper Moon Media", "Ferrite Guard", "Lucent Ledger", "Driftwood Imports", "Hollow Sun Data"];
const netwerkNaam = (s, key, std) => ((s.netwerk_namen || {})[key]) || std;

function eraTick(s, ctx){
  const i = tijdperkVan(s), was = s.tijdperk || 0;
  if (i > was){
    s.tijdperk = i; const T = TIJDPERKEN[i];
    for (const d of s.districts){ d.income = r1(d.income * 1.1); d.upkeep = r1(d.upkeep * 1.05); }
    for (const g of s.gangs || []) for (const k2 of Object.keys(g.basis || {})) g.basis[k2] = Math.min(80, g.basis[k2] + 5);
    for (const r of s.rivals) r.aggression = r1(clamp(r.aggression + (i >= 2 ? 0.1 : 0.05), 0, 1) * 100) / 100;
    if (i === 1 && s.sectoren && s.sectoren["Cyberware"]) s.sectoren["Cyberware"].trend += 0.08;
    if (i >= 3 && !typeOf(s, "Orbitaal")) unlockOrbitaal(s);
    nieuweStartups(s, 2 + i);
    mail(ctx, s, "Strategie", `Een nieuw tijdperk: ${T.naam}`, `${T.tekst}\n\nWat er verandert: alle gebieden leveren 10% meer op (en kosten 5% meer), syndicaten worden sterker, rivalen agressiever, en op de huurmarkt staan betere mensen.`, "HOOG");
    news(s, `Tijdperk: ${T.naam}`, T.tekst, "", "special", true); ctx.rep.push(`Nieuw tijdperk: ${T.naam}`);
  }
  const st = statusVan(s);
  if (st > (s.statusNiveau || 0)){
    s.statusNiveau = st; const naam = STATUS_LADDER[st][1];
    for (const r of s.rivals){ relShift(r, -5); remember(r, s, `ziet de speler als ${naam.toLowerCase()}`); }
    mail(ctx, s, "Raad van Bestuur", `U bent nu: ${naam}`, `De markt rekent ons tot de ${naam.toLowerCase()}s. Dat opent deuren: je crew mag een plek groter (${crewMax(s)}), en de huurmarkt stuurt betere mensen. Het opent ook ogen: elke rivaal kijkt nu naar ons.`, "HOOG");
    news(s, `${s.player.corp_name} groeit uit tot ${naam.toLowerCase()}`, `Analisten waarderen ${s.player.corp_name} op ongeveer €${playerValue(s)}M.`, "", "markt", true);
  }
}
function unlockOrbitaal(s){
  addCustomType(s, "Orbitaal", {rev: 13, cost: 7, heat: 1, vol: 0.45}, "Fabrieken en datacentra in een baan om de aarde. Duur, wild en ongereguleerd.");
  (s.sectoren ??= {})["Orbitaal"] ??= {idx: 110, trend: 0.03, hist: [110]};
}
function nieuweStartups(s, n){
  const used = new Set((s.bedrijven || []).map(b => b.naam));
  for (let i = 0; i < n; i++){
    const naam = STARTUPS.find(x => !used.has(x)); if (!naam) break; used.add(naam);
    const sec = CH(allTypes(s)), land = CH(s.districts.filter(d => d.id !== s.player.home_district));
    (s.bedrijven ??= []).push({id: "b" + hex8(), naam, sector: sec, land: land.id, ceo: CH(CEO_NAMEN), waarde: RI(40, 120) * (1 + (s.tijdperk || 0) * 0.3), vorige: 0, relatie: RI(0, 20), aandeel: 0, eigenaar: null, contract: false, actie: null, startup: true});
    news(s, `Nieuwkomer: ${naam}`, `Een jong bedrijf in ${sec}, uit ${land.name}. Klein, snel en te koop voor wie er vroeg bij is.`, land.continent, "markt");
  }
}
function jaarTick(s, ctx){
  // mensen in je netwerk worden opgevolgd
  for (const [key, lijst] of Object.entries(OPVOLGERS)){
    if (R() > 0.22) continue;
    const std = (NETWERK.find(x => x[0] === key) || [])[1], cur = netwerkNaam(s, key, std), idx = Math.max(0, lijst.findIndex(x => x[0] === cur));
    const next = lijst[(idx + 1) % lijst.length]; if (next[0] === cur) continue;
    (s.netwerk_namen ??= {})[key] = next[0]; const oud = relV(s, key); const fac = (NETWERK.find(x => x[0] === key) || [])[4];
    s.relaties[key] = {v: fac ? Math.round(faction(s, fac) * 0.4) : 0};
    news(s, `${cur} ${lijst[idx][1]}`, `${next[0]} ${next[1]}. Je relatie begint opnieuw${oud >= 25 ? ": wat je met de vorige had opgebouwd, ben je kwijt" : ""}.`, "", "mensen", true);
  }
  // rivalen krijgen een nieuwe CEO
  for (const r of s.rivals){ if (R() > 0.12) continue;
    const oud = r.ceo; r.ceo = CH(RIVAL_CEO_NAMEN.filter(x => x !== oud && !s.rivals.some(q => q.ceo === x))); const d = r1(U(-0.2, 0.2) * 10) / 10; r.aggression = r1(clamp(r.aggression + d, 0.1, 0.95) * 100) / 100; r.memory = r.memory.slice(-3);
    news(s, `Nieuwe CEO bij ${r.name}`, `${oud} is vertrokken. ${r.ceo} neemt het over en ${d > 0 ? "belooft een hardere koers" : d < 0 ? "spreekt over samenwerking" : "zegt weinig"}.`, landNaam(s, r.hq), "mensen"); }
  // directie wordt ambitieuzer
  for (const n of s.npcs) n.ambition = clamp(n.ambition + RI(1, 5));
  // zwakke bedrijven vallen om, nieuwe komen op
  for (const b of []) if (!b.eigenaar && b.waarde < 40 && R() < 0.5){   /* 4.2: faillissementen en oprichtingen gaan nu maandelijks in bedrijfLeven */
    s.bedrijven = s.bedrijven.filter(x => x !== b); leverancierWeg(s, typeof ctx !== "undefined" ? ctx : null, b); if (b.contract) s.streams = (s.streams || []).filter(x => x.naam !== "Contract " + b.naam);
    let extra = ""; if (b.aandeel){ extra = ` Jouw ${b.aandeel}% is niets meer waard.`; }
    news(s, `${b.naam} failliet`, `${b.naam} houdt op te bestaan.${extra}`, landNaam(s, b.land), "markt", !!(b.aandeel || b.contract)); }
}

/* ===================== 2.0 CREW: specialisten op de loonlijst ===================== */
const CREW_ROLLEN = {
  netrunner: {label: "Netrunner", tekst: "Hacken, sporen wissen, data stelen."},
  fixer: {label: "Fixer", tekst: "Spullen, contacten en informatie regelen."},
  huurling: {label: "Huurling", tekst: "Beveiliging, overvallen en straatwerk."},
  dealmaker: {label: "Dealmaker", tekst: "Contracten, lobby en onderhandelingen."},
  spindokter: {label: "Spindokter", tekst: "Pers, campagnes en schandalen begraven."},
  speurder: {label: "Speurder", tekst: "Mensen natrekken, dossiers en geheimen."},
};
const CREW_TRAITS = [
  {id: "koel", naam: "Koelbloedig", tekst: "+1 bij gevaarlijke opdrachten"},
  {id: "chroom", naam: "Volgechroomd", tekst: "+1 op alles, maar elke opdracht +1 heat"},
  {id: "hebberig", naam: "Hebberig", tekst: "20% duurder, loyaliteit zakt sneller"},
  {id: "netwerk", naam: "Kent iedereen", tekst: "Klussen leveren 25% meer op"},
  {id: "slordig", naam: "Slordig", tekst: "Ook een worp van 3 is een blunder"},
  {id: "trouw", naam: "Trouw", tekst: "Loyaliteit zakt niet"},
  {id: "stil", naam: "Spoorloos", tekst: "Wordt nooit opgepakt, halve heat"},
];
const CREW_VOOR = ["Kira", "Dex", "Mila", "Jonah", "Roos", "Tariq", "Lena", "Vik", "Noor", "Pim", "Sasha", "Ezra", "Ayo", "Marit", "Lou", "Ren", "Ilse", "Bo", "Yara", "Teun", "Zhen", "Ines", "Kofi", "Femke"];
const CREW_BIJ = ["Splinter", "Nul", "Grijs", "Vonk", "Kraai", "Spook", "Mes", "Ruis", "Staal", "Lucht", "Haak", "Wolf", "Draad", "Inkt", "Glas"];
const crewLoon = (s, m) => r1((0.8 + m.niveau * 0.5) * (m.trait === "hebberig" ? 1.2 : 1));
const crewStatus = (s, m) => m.uit && m.uit > ym(s) ? m.uitReden || "uit" : m.bezig === ym(s) ? "bezig" : "vrij";
const traitOf = id => CREW_TRAITS.find(t => t.id === id) || {naam: "", tekst: ""};
function genKandidaat(s){
  const rollen = Object.keys(CREW_ROLLEN), rol = CH(rollen), base = 1 + (s.tijdperk || 0) * 0.6 + (s.statusNiveau || 0) * 0.5;
  const niveau = clamp(Math.round(base + U(-0.6, 1.2)), 1, 5);
  const m = {id: "c" + hex8(), naam: `${CH(CREW_VOOR)} '${CH(CREW_BIJ)}'`, rol, niveau, xp: 0, loyaliteit: RI(45, 70), trait: R() < 0.75 ? CH(CREW_TRAITS).id : null, sinds: null};
  m.loon = crewLoon(s, m); return m;
}
function marktTick(s){
  s.huurmarkt = (s.huurmarkt || []).filter(() => R() < 0.5).slice(0, 2);
  while (s.huurmarkt.length < 4) s.huurmarkt.push(genKandidaat(s));
}
function crewTick(s, ctx){
  let loon = 0;
  for (const m of [...(s.crew || [])]){
    loon += m.loon;
    if (m.trait !== "trouw") m.loyaliteit = clamp(m.loyaliteit + ((55 + (s.morale - 60) / 4) - m.loyaliteit) * 0.1 - (m.trait === "hebberig" ? 1.5 : 0) - (s.cash < 0 ? 6 : 0));
    if (m.loyaliteit < 25 && R() < 0.35){ s.crew = s.crew.filter(x => x !== m);
      mail(ctx, s, m.naam, "Ik ben weg", `Het werd tijd. Zoek iemand anders voor het vuile werk. Mijn nummer werkt niet meer.`, "HOOG"); ctx.rep.push(`${m.naam} (${CREW_ROLLEN[m.rol].label}) vertrekt`); }
  }
  return loon;
}
function crewBonus(s, m, gevaar){ return m.niveau - 1 + (m.trait === "chroom" ? 1 : 0) + (gevaar && m.trait === "koel" ? 1 : 0); }
function xpUp(s, m, n){
  m.xp += n; const need = 3 + m.niveau * 3;
  if (m.xp >= need && m.niveau < 5){ m.xp -= need; m.niveau += 1; m.loon = crewLoon(s, m); m.loyaliteit = clamp(m.loyaliteit + 5); return ` ${m.naam} is beter geworden: niveau ${m.niveau} (loon nu €${m.loon}M).`; }
  return "";
}
function pech(s, m, ernstig){
  if (m.trait === "stil"){ m.uit = plusMonths(s, 1); m.uitReden = "ondergedoken"; return ` ${m.naam} duikt een maand onder.`; }
  if (ernstig && R() < 0.35){ m.uit = plusMonths(s, 3); m.uitReden = "opgepakt"; s.heat = clamp(s.heat + 4); return ` ${m.naam} is opgepakt: drie maanden uit beeld, heat +4.`; }
  if (R() < 0.5){ m.uit = plusMonths(s, 2); m.uitReden = "gewond"; return ` ${m.naam} raakt gewond en ligt twee maanden stil.`; }
  return "";
}
/* opdrachten: doel = moeilijkheid. Bonus = niveau (+ eigenschap) + situatie */
const MISSIES = [
  {id: "datadiefstal", rol: "netrunner", label: "Data stelen", doelwit: "rivaal", doel: 10, gevaar: false, uitleg: "Hun klantdata verkopen: zij −12% marktaandeel, jij €2-5M.",
    mod: (s, r) => -Math.round((r.defensie || 0) / 2), ok(s, m, r, crit){ const g = RI(2, 5) * (crit ? 2 : 1); s.cash = r1(s.cash + g); const mk = s.market[r.sector]; if (mk) mk.rivals[r.name] = (mk.rivals[r.name] || 0) * 0.88; return `Data van ${r.name} verkocht: +€${g}M, hun klanten twijfelen.`; },
    fail(s, m, r){ s.heat = clamp(s.heat + 4); relShift(r, -10); remember(r, s, "betrapte een hacker van de speler"); return `${r.name} zag de inbraak. Heat +4, relatie −10.` + pech(s, m, true); }},
  {id: "sporen", rol: "netrunner", label: "Sporen wissen", doel: 7, uitleg: "Heat −6.", ok(s, m, t, crit){ s.heat = clamp(s.heat - (crit ? 10 : 6)); return `Logs gewist, dossiers beschadigd. Heat −${crit ? 10 : 6}.`; }, fail(s){ s.heat = clamp(s.heat + 2); return "Iemand merkte dat er logs verdwenen. Heat +2."; }},
  {id: "beurs", rol: "netrunner", label: "Koersen manipuleren", doel: 10, uitleg: "€4-9M, heat +3.", ok(s, m, t, crit){ const g = RI(4, 9) * (crit ? 1.5 : 1); s.cash = r1(s.cash + g); s.heat = clamp(s.heat + 3); return `Een paar nepberichten, een paar snelle trades: +€${r1(g)}M.`; },
    fail(s, m){ s.heat = clamp(s.heat + 6); s.reputation = clamp(s.reputation - 3); return "De beurswaakhond zag het patroon. Heat +6, reputatie −3." + pech(s, m, true); }},
  {id: "spullen", rol: "fixer", label: "Spullen regelen", doel: 8, uitleg: "€2-6M zwart geld.", ok(s, m, t, crit){ const g = RI(2, 6) * (crit ? 2 : 1); s.accounts.zwart = r1(s.accounts.zwart + g); return `Een vrachtwagen zonder papieren: +€${g}M zwart.`; }, fail(s){ s.heat = clamp(s.heat + 3); return "De lading werd onderschept. Heat +3."; }},
  {id: "intro", rol: "fixer", label: "Contact leggen", doelwit: "netwerk", doel: 7, uitleg: "Relatie met iemand in je netwerk +12.", ok(s, m, key, crit){ relShiftP(s, key, crit ? 20 : 12); return `Een introductie via de juiste kanalen. Relatie +${crit ? 20 : 12}.`; }, fail(s, m, key){ relShiftP(s, key, -3); return "Het gesprek liep stroef. Relatie −3."; }},
  {id: "info", rol: "fixer", label: "Gerucht natrekken", doel: 8, uitleg: "Je hoort of het laatste gerucht klopt.", ok(s){ const h = (s.hidden_truth || []).slice().reverse().find(x => x.datum || x.bron); if (!h) return "Er gaat niets rond dat de moeite waard is.";
      const n = (s.nieuws || []).find(x => x.soort === "gerucht"); return `${n ? `"${n.kop}"` : "Het laatste gerucht"}: ${h.waar ? "het klopt." : "het klopt niet."}`; }, fail(){ return "De bron wilde niet praten."; }},
  {id: "beveiligen", rol: "huurling", label: "Beveiliging draaien", doel: 0, uitleg: "Geen worp: een maand macht +8.", ok(s){ s.flags.alert = plusMonths(s, 1); return "Extra ploegen, extra camera's. Een maand macht +8."; }},
  {id: "overval", rol: "huurling", label: "Overval op rivaal", doelwit: "oorlog", doel: 9, gevaar: true, uitleg: "Alleen in oorlog. Zij €10-25M schade en meer oorlogsmoeheid.",
    mod: (s, r) => Math.round((playerPower(s) - rivalPower(s, r)) / 12), ok(s, m, r, crit){ const l = RI(10, 25) * (crit ? 1.5 : 1); r.cash = r1(r.cash - l); r.moeheid = clamp(r.moeheid + 12); return `Een depot van ${r.name} leeggehaald: ongeveer €${r1(l)}M schade.`; },
    fail(s, m, r){ s.morale = clamp(s.morale - 2); return `${r.name} stond klaar. Morale −2.` + pech(s, m, false); }},
  {id: "bende", rol: "huurling", label: "Syndicaat terugdringen", doelwit: "bende", doel: 9, gevaar: true, uitleg: "Aanwezigheid −20 in een gebied van jou, relatie met de bende −15.",
    mod: (s, x) => Math.round((50 - gangKracht(x.g)) / 10), ok(s, m, x, crit){ x.g.gebied[x.land] = Math.max(0, x.g.gebied[x.land] - (crit ? 30 : 20)); x.g.relatie = Math.round(clamp(x.g.relatie - 15, -100, 100)); if (x.g.relatie <= -50) x.g.deal = "oorlog";
      return `${x.g.naam} verliest terrein in ${landNaam(s, x.land)}: aanwezigheid nu ${x.g.gebied[x.land]}.`; }, fail(s, m, x){ x.g.relatie = Math.round(clamp(x.g.relatie - 10, -100, 100)); return `${x.g.naam} sloeg terug.` + pech(s, m, false); }},
  {id: "contract", rol: "dealmaker", label: "Contract binnenhalen", doelwit: "bedrijf", doel: 8, uitleg: "Een leveringscontract zonder kosten vooraf.", mod: (s, b) => Math.round(b.relatie / 25),
    ok(s, m, b, crit){ const o = bedrijfOpties(s, b), amt = r1(o.contract.bedrag * (crit ? 1.3 : 1)); b.contract = true; b.relatie = Math.round(clamp(b.relatie + 5, -100, 100)); (s.streams ??= []).push({naam: "Contract " + b.naam, bedrag: amt, sinds: ym(s)}); return `Getekend met ${b.naam}: +€${amt}M per maand.`; },
    fail(s, m, b){ b.relatie = Math.round(clamp(b.relatie - 8, -100, 100)); return `${b.naam} haakte af. Relatie −8.`; }},
  {id: "lobby", rol: "dealmaker", label: "Lobbyen", doelwit: "factie", doel: 8, uitleg: "Een factie +10.", ok(s, m, f, crit){ shiftFaction(s, f, crit ? 18 : 10); return `De juiste lunches met de juiste mensen: ${f} +${crit ? 18 : 10}.`; }, fail(s, m, f){ shiftFaction(s, f, -3); return `Te opdringerig: ${f} −3.`; }},
  {id: "verzoenen", rol: "dealmaker", label: "Relatie met rivaal", doelwit: "rivaal", doel: 7, uitleg: "Relatie +15, ook in oorlog.", ok(s, m, r, crit){ relShift(r, crit ? 25 : 15); if (r.status === "oorlog") r.moeheid = clamp(r.moeheid + 10); return `Een stil gesprek met ${r.ceo}. Relatie +${crit ? 25 : 15}.`; }, fail(s, m, r){ relShift(r, -4); return `${r.ceo} liet zich niet paaien. Relatie −4.`; }},
  {id: "campagne", rol: "spindokter", label: "Campagne", doel: 7, uitleg: "Reputatie +4.", ok(s, m, t, crit){ s.reputation = clamp(s.reputation + (crit ? 8 : 4)); return `Goede pers, goede foto's. Reputatie +${crit ? 8 : 4}.`; }, fail(s){ s.reputation = clamp(s.reputation - 1); return "De campagne viel plat. Reputatie −1."; }},
  {id: "begraven", rol: "spindokter", label: "Schandaal begraven", doel: 8, uitleg: "Heat −5, reputatie +1.", ok(s){ s.heat = clamp(s.heat - 5); s.reputation = clamp(s.reputation + 1); return "Ander nieuws op de voorpagina. Heat −5."; }, fail(s){ s.heat = clamp(s.heat + 2); return "Het verhaal werd groter. Heat +2."; }},
  {id: "smaad", rol: "spindokter", label: "Rivaal zwartmaken", doelwit: "rivaal", doel: 9, uitleg: "Zij −8% marktaandeel, relatie −8.", ok(s, m, r){ const mk = s.market[r.sector]; if (mk) mk.rivals[r.name] = (mk.rivals[r.name] || 0) * 0.92; relShift(r, -8); return `Twijfels over ${r.name} in elke krant.`; }, fail(s, m, r){ s.reputation = clamp(s.reputation - 3); relShift(r, -10); return "De bron werd bekend. Reputatie −3."; }},
  {id: "natrekken", rol: "speurder", label: "Directielid natrekken", doelwit: "npc", doel: 8, uitleg: "Vindt een verrader, als die er is.", ok(s, m, n, crit, ctx){ return n.verraad ? ontmasker(s, ctx, n.name) : `${n.name} is schoon. Echt schoon.`; }, fail(s, m, n){ if (R() < 0.4){ n.loyalty = clamp(n.loyalty - 8); return `${n.name} merkte het. Loyaliteit −8.`; } return "Niets gevonden, en dat zegt niets."; }},
  {id: "dossier", rol: "speurder", label: "Dossier over rivaal", doelwit: "rivaal", doel: 9, uitleg: "Je volgende actie tegen hen krijgt +15% kans.", ok(s, m, r){ s.flags["dossier_" + r.name] = true; return `Een map vol zwakke plekken van ${r.name}. Je volgende actie tegen hen: +15%.`; }, fail(s, m, r){ relShift(r, -5); return `${r.name} ontdekte de schaduw.` + pech(s, m, false); }},
];
function missieDoelwitten(s, ms){
  if (ms.doelwit === "rivaal") return s.rivals.map(r => ({id: r.name, label: r.name}));
  if (ms.doelwit === "oorlog") return atWar(s).map(r => ({id: r.name, label: r.name}));
  if (ms.doelwit === "bende") { const out = []; for (const g of s.gangs || []) for (const x of gangLanden(s, g)) out.push({id: g.id + "|" + x.id, label: `${g.naam} in ${landNaam(s, x.id)} (${x.v})`}); return out; }
  if (ms.doelwit === "netwerk") return NETWERK.filter(([k2]) => MENS[k2]).map(([k2, n]) => ({id: k2, label: netwerkNaam(s, k2, n)}));
  if (ms.doelwit === "bedrijf") return (s.bedrijven || []).filter(b => !b.eigenaar && !b.contract).map(b => ({id: b.id, label: `${b.naam} (+€${bedrijfOpties(s, b).contract.bedrag}M)`}));
  if (ms.doelwit === "factie") return Object.keys(s.factions).map(f => ({id: f, label: f}));
  if (ms.doelwit === "npc") return s.npcs.map(n => ({id: n.name, label: `${n.name} (${n.role})`}));
  return null;
}
function missieTarget(s, ms, id){
  if (ms.doelwit === "rivaal" || ms.doelwit === "oorlog") return s.rivals.find(r => r.name === id && (ms.doelwit !== "oorlog" || r.status === "oorlog"));
  if (ms.doelwit === "bende"){ const [g, l] = String(id || "").split("|"), gg = (s.gangs || []).find(x => x.id === g); return gg && gg.gebied[l] != null ? {g: gg, land: l} : null; }
  if (ms.doelwit === "netwerk") return MENS[id] ? id : null;
  if (ms.doelwit === "bedrijf") return (s.bedrijven || []).find(b => b.id === id && !b.eigenaar && !b.contract);
  if (ms.doelwit === "factie") return s.factions[id] ? id : null;
  if (ms.doelwit === "npc") return s.npcs.find(n => n.name === id);
  return true;
}
function missieBonus(s, m, ms, t){ let b = crewBonus(s, m, ms.gevaar) + (ms.mod && t && t !== true ? ms.mod(s, t) : 0); if (t && t.name && s.flags["dossier_" + t.name] && ms.id !== "dossier") b += 2; return b; }
function actMissie(s, ctx, crewId, missieId, targetId){
  const m = (s.crew || []).find(x => x.id === crewId); if (!m) return {ok: false, msg: "Onbekend crewlid."};
  const st = crewStatus(s, m); if (st !== "vrij") return {ok: false, msg: `${m.naam} is ${st}.`};
  const ms = MISSIES.find(x => x.id === missieId); if (!ms || ms.rol !== m.rol) return {ok: false, msg: "Dat is niet het werk van deze persoon."};
  const t = ms.doelwit ? missieTarget(s, ms, targetId) : true; if (!t) return {ok: false, msg: "Kies een geldig doelwit."};
  m.bezig = ym(s); let msg;
  if (!ms.doel){ msg = ms.ok(s, m, t, false, ctx); m.xp += 0.5; }
  else {
    const bonus = missieBonus(s, m, ms, t), r = rol2d6(bonus, ms.doel, m.trait === "slordig");
    if (t && t.name) delete s.flags["dossier_" + t.name];
    addRoll(s, `${m.naam} · ${ms.label}: ${r.txt} → ${r.ok ? "GELUKT" : "MISLUKT"}`);
    msg = `${m.naam}, ${ms.label.toLowerCase()} (${r.txt}): ` + (r.ok ? ms.ok(s, m, t, r.crit, ctx) + xpUp(s, m, r.crit ? 2 : 1) : ms.fail(s, m, t, ctx));
    if (m.trait === "chroom") s.heat = clamp(s.heat + (m.trait === "stil" ? 0.5 : 1));
    if (!r.ok) m.loyaliteit = clamp(m.loyaliteit - 2);
  }
  s.accounts.operationeel = s.cash; addLog(s, msg); return {ok: true, msg};
}
function actCrew(s, ctx, soort, id){
  const pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; };
  if (soort === "huren"){ const k = (s.huurmarkt || []).find(x => x.id === id); if (!k) return {ok: false, msg: "Die kandidaat is al weg."};
    if ((s.crew || []).length >= crewMax(s)) return {ok: false, msg: `Je crew is vol (${crewMax(s)}). Groei in status voor meer plekken, of laat iemand gaan.`};
    if (!pay(k.loon)) return {ok: false, msg: `Tekengeld is één maandloon: €${k.loon}M. Niet genoeg cash.`};
    s.huurmarkt = s.huurmarkt.filter(x => x !== k); k.sinds = ym(s); k.bezig = ym(s); (s.crew ??= []).push(k);
    const msg = `${k.naam} (${CREW_ROLLEN[k.rol].label}, niveau ${k.niveau}) begint volgende maand. Loon €${k.loon}M per maand, opdrachten kosten verder niets.`; addLog(s, msg); return {ok: true, msg}; }
  if (soort === "ontslaan"){ const m = (s.crew || []).find(x => x.id === id); if (!m) return {ok: false, msg: "Onbekend."}; s.crew = s.crew.filter(x => x !== m); const msg = `${m.naam} is ontslagen.`; addLog(s, msg); return {ok: true, msg}; }
  if (soort === "borg"){ const m = (s.crew || []).find(x => x.id === id); if (!m || m.uitReden !== "opgepakt" || !(m.uit > ym(s))) return {ok: false, msg: "Er is niemand vrij te kopen."};
    if (!pay(4)) return {ok: false, msg: "Borg en advocaat kosten €4M."}; m.uit = null; m.loyaliteit = clamp(m.loyaliteit + 15); const msg = `Borg betaald. ${m.naam} is vrij en dankbaar (loyaliteit +15).`; addLog(s, msg); return {ok: true, msg}; }
  if (soort === "bonus"){ const m = (s.crew || []).find(x => x.id === id); if (!m) return {ok: false, msg: "Onbekend."}; if (!pay(2)) return {ok: false, msg: "Een bonus kost €2M."};
    m.loyaliteit = clamp(m.loyaliteit + 12); const msg = `${m.naam} krijgt een bonus. Loyaliteit +12.`; addLog(s, msg); return {ok: true, msg}; }
  return {ok: false, msg: "Onbekende actie."};
}

/* klussen: fixers bieden werk aan. Jouw crew doet het, jij verdient */
const FIXERS = [["Zes", "Europa"], ["Mama Kafui", "Afrika"], ["Oude Lin", "Azië"], ["Santos 'Dos Caras'", "Zuid-Amerika"], ["Brigid Kerr", "Noord-Amerika"], ["Ishaan Wire", "Midden-Oosten"], ["Moana Reeve", "Oceanië"]];
const KLUS_TYPES = [
  {rol: "huurling", titel: "Konvooi door {zee}", tekst: "Een lading medicijnen moet door piratenwater. De verzekeraar betaalt, als hij aankomt.", doel: 9, gevaar: true, beloning: 12},
  {rol: "netrunner", titel: "Een datakluis bij {bedrijf}", tekst: "Iemand wil weten wat er in de servers van {bedrijf} staat. Niemand mag weten dat het gebeurd is.", doel: 10, beloning: 15, zwart: true, heat: 3},
  {rol: "speurder", titel: "Een vermiste ingenieur", tekst: "Een chipontwerper is verdwenen in {land}. Haar familie betaalt. Haar werkgever misschien meer.", doel: 9, beloning: 11},
  {rol: "fixer", titel: "Een smokkelroute testen", tekst: "Nieuwe route, nieuwe douaniers. Iemand moet kijken of ze zijn wat ze beloven.", doel: 8, beloning: 10, zwart: true, heat: 2},
  {rol: "spindokter", titel: "Een verkiezing in {land}", tekst: "Een kandidaat heeft een imagoprobleem. En een campagnekas.", doel: 8, beloning: 9, factie: ["stad", 4]},
  {rol: "dealmaker", titel: "Bemiddelen tussen twee clans", tekst: "Twee nomadenclans vechten om een snelweg. Wie de vrede tekent, wordt onthouden.", doel: 9, beloning: 10, factie: ["nomaden", 8]},
  {rol: "huurling", titel: "Lijfwacht voor een CEO", tekst: "Een topvrouw reist een week door {land} en vertrouwt haar eigen beveiliging niet.", doel: 8, gevaar: true, beloning: 9, rep: 2},
  {rol: "netrunner", titel: "Een beursbericht lekken", tekst: "Een bericht moet net iets te vroeg op straat liggen. Precies vijf minuten te vroeg.", doel: 9, beloning: 12, heat: 2},
  {rol: "speurder", titel: "Een verzekeringsfraude", tekst: "Een verzekeraar denkt dat een rederij zijn eigen schip liet zinken. Bewijs het.", doel: 8, beloning: 8},
  {rol: "fixer", titel: "Een prototype terughalen", tekst: "Gestolen uit een lab in {land}. De eigenaar wil het terug, zonder politie.", doel: 10, gevaar: true, beloning: 18},
];
function klusTick(s){
  s.klussen = (s.klussen || []).filter(k => k.verloopt > ym(s));
  const T = s.tijdperk || 0;
  const rollen = [...new Set((s.crew || []).map(m => m.rol))];
  while (s.klussen.length < ((s.crew || []).length >= 4 ? 4 : 3)){
    const pool = rollen.length && R() < 0.65 ? KLUS_TYPES.filter(x => rollen.includes(x.rol)) : KLUS_TYPES, t = CH(pool.length ? pool : KLUS_TYPES), [fx, cont] = CH(FIXERS), lands = s.districts.filter(d => d.continent === cont), land = CH(lands.length ? lands : s.districts);
    const zee = (s.map && s.map.zones ? (s.map.zones.find(z => (land.zee || []).includes(z.id)) || CH(s.map.zones)) : {naam: "open zee"}).naam, bed = CH(s.bedrijven || [{naam: "een bank"}]).naam;
    const fill = x => x.replace(/\{land\}/g, land.name).replace(/\{zee\}/g, zee).replace(/\{bedrijf\}/g, bed);
    s.klussen.push({id: "k" + hex8(), fixer: fx, regio: cont, rol: t.rol, titel: fill(t.titel), tekst: fill(t.tekst), doel: t.doel - 1 + T + (R() < 0.3 ? 1 : 0), gevaar: !!t.gevaar,
      beloning: Math.round(t.beloning * 0.8 * (1 + T * 0.3) * U(0.85, 1.2)), zwart: !!t.zwart, heat: t.heat || 0, factie: t.factie || null, rep: t.rep || 0, verloopt: plusMonths(s, 2)});
  }
}
function actKlus(s, ctx, klusId, crewId){
  const k = (s.klussen || []).find(x => x.id === klusId); if (!k) return {ok: false, msg: "Die klus is weg."};
  const m = (s.crew || []).find(x => x.id === crewId); if (!m) return {ok: false, msg: "Kies wie het doet."};
  if (m.rol !== k.rol) return {ok: false, msg: `Hier is een ${CREW_ROLLEN[k.rol].label.toLowerCase()} voor nodig.`};
  const st = crewStatus(s, m); if (st !== "vrij") return {ok: false, msg: `${m.naam} is ${st}.`};
  m.bezig = ym(s); s.klussen = s.klussen.filter(x => x !== k);
  const r = rol2d6(crewBonus(s, m, k.gevaar), k.doel, m.trait === "slordig");
  addRoll(s, `Klus "${k.titel}" door ${m.naam}: ${r.txt} → ${r.ok ? "GELUKT" : "MISLUKT"}`);
  let msg;
  if (r.ok){
    const g = r1(k.beloning * (m.trait === "netwerk" ? 1.25 : 1) * (r.crit ? 1.3 : 1));
    if (k.zwart) s.accounts.zwart = r1(s.accounts.zwart + g); else s.cash = r1(s.cash + g);
    if (k.heat) s.heat = clamp(s.heat + k.heat * (m.trait === "stil" ? 0.5 : 1)); if (k.factie) shiftFaction(s, k.factie[0], k.factie[1]); if (k.rep) s.reputation = clamp(s.reputation + k.rep);
    if (k.fixer === "Zes") relShiftP(s, "fixer", 3);
    msg = `Klus geklaard door ${m.naam} (${r.txt}): +€${g}M${k.zwart ? " zwart" : ""}.${xpUp(s, m, r.crit ? 2 : 1)}`;
  } else { msg = `De klus "${k.titel}" mislukt (${r.txt}). ${k.fixer} betaalt niets.` + (k.gevaar ? pech(s, m, false) : ""); m.loyaliteit = clamp(m.loyaliteit - 2); if (k.heat) s.heat = clamp(s.heat + k.heat); }
  s.accounts.operationeel = s.cash; addLog(s, msg); return {ok: true, msg};
}

/* huurlegers: macht te huur voor een oorlog */
const HUURLEGERS = [
  {id: "jakhalzen", naam: "De IJzeren Jakhalzen", macht: 10, loon: 4, tekst: "Goedkoop, luid, niet erg trouw."},
  {id: "sable", naam: "Compagnie Sable", macht: 18, loon: 7, tekst: "Ex-legionairs. Netjes, effectief, duur in onderhoud."},
  {id: "lotus", naam: "Grijze Lotus PMC", macht: 28, loon: 12, tekst: "Een privéleger met drones en eigen advocaten."},
];
const legerLoon = (s, h) => r1(h.loon * (1 + (s.tijdperk || 0) * 0.15));
function actLeger(s, id){
  if (id === "stop"){ if (!s.huurleger) return {ok: false, msg: "Je hebt geen huurleger."}; s.huurleger = null; return {ok: true, msg: "Contract opgezegd. Ze vertrekken zonder te zwaaien."}; }
  const h = HUURLEGERS.find(x => x.id === id); if (!h) return {ok: false, msg: "Onbekend."};
  if (s.huurleger) return {ok: false, msg: "Je hebt al een huurleger. Zeg dat eerst op."};
  const l = legerLoon(s, h); if (s.cash < l) return {ok: false, msg: `Eerste maand vooruit: €${l}M. Niet genoeg cash.`};
  s.cash = r1(s.cash - l); s.huurleger = {id: h.id, maanden: 3}; const msg = `${h.naam} staat drie maanden onder contract: macht +${h.macht}, €${l}M per maand.`; addLog(s, msg); return {ok: true, msg};
}
function legerTick(s, ctx){
  if (!s.huurleger) return;
  const h = HUURLEGERS.find(x => x.id === s.huurleger.id); if (!h){ s.huurleger = null; return; }
  if (--s.huurleger.maanden <= 0){ s.huurleger = null; mail(ctx, s, h.naam, "Contract afgelopen", "Ons contract is voorbij. Wilt u verlengen, dan weet u ons te vinden. Onze prijs is gestegen.", "NORMAAL"); return; }
}
const crewLoonTotaal = s => r1((s.crew || []).reduce((a, m) => a + m.loon, 0));
function legerKostNu(s){ const h = s.huurleger && HUURLEGERS.find(x => x.id === s.huurleger.id); return h && s.huurleger.maanden > 1 ? legerLoon(s, h) : 0; }
const legerMacht = s => { const h = s.huurleger && HUURLEGERS.find(x => x.id === s.huurleger.id); return h ? h.macht : 0; };

/* bijzondere wereldgebeurtenissen: groot, zeldzaam, met een keuze en een blijvend gevolg */
const SPECIALS = [
  {id: "krach", kop: "Wereldwijde beurskrach", tekst: "In drie dagen verdampt een kwart van alle beurswaarde. Banken sluiten, bedrijven zijn spotgoedkoop.", run(s){ for (const b of s.bedrijven || []) b.waarde = r1(b.waarde * 0.7); for (const x of Object.values(s.sectoren || {})) x.idx = r1(x.idx * 0.88); for (const r of s.rivals) r.cash = r1(r.cash * 0.85); },
    keuze: s => ({van: "CFO", titel: "De krach: wat doen we?", tekst: "Alles is goedkoop, ook wij. Bedrijven kosten nu 30% minder: wie geld heeft, koopt. Wie geen geld heeft, overleeft.", opties: [
      {label: "Inkopen in de dip · €15M", kost: 15, uitleg: `Kans ${snapKans(72)}%: 12 maanden +€3M. Mislukt: het geld zakt verder weg.`, eff: {kans: 72, succes: {stream: {naam: "Krachbeleggingen", bedrag: 3, maanden: 12}, tekst: "Op de bodem gekocht."}, falen: {tekst: "Het was nog niet de bodem."}}},
      {label: "Kosten snijden", uitleg: "€10M erbij, morale −6.", eff: {cash: 10, morale: -6}},
      {label: "Rustig blijven", uitleg: "Niets.", eff: {}}], standaard: 2})},
  {id: "blackout", kop: "De Grote Blackout", tekst: "Een zonnestorm legt een derde van het wereldwijde datanet plat. Een maand lang werkt bijna niets.", run(s){ if (s.sectoren["Media & Data"]) s.sectoren["Media & Data"].idx = r1(s.sectoren["Media & Data"].idx * 0.75); for (const d of s.districts) if (d.arch === "data") d.mod = {f: 0.5, m: 1, why: "De Grote Blackout"}; },
    keuze: s => ({van: "COO", titel: "Blackout: generatoren", tekst: "Wij hebben generatoren en vrachtwagens. Iedereen wil ze. We kunnen verhuren, weggeven of stilzitten.", opties: [
      {label: "Verhuren", uitleg: "+€10M, reputatie −2.", eff: {cash: 10, reputation: -2}}, {label: "Ziekenhuizen helpen · €5M", kost: 5, uitleg: "Reputatie +6, overheid +6.", eff: {reputation: 6, factions: {stad: 6}}}, {label: "Niets", uitleg: "", eff: {}}], standaard: 2})},
  {id: "aiwet", kop: "De Wereld-AI-wet", tekst: "Na een reeks incidenten met zelflerende systemen tekenen 120 landen een AI-verdrag. Cyberware en Media & Data moeten keuren, registreren en betalen.", run(s){ for (const t of ["Cyberware", "Media & Data"]) if (s.sectoren[t]) s.sectoren[t].trend -= 0.05; },
    keuze: s => ({van: "Juridische Zaken", titel: "Het AI-verdrag", tekst: "We kunnen ons aanpassen, lobbyen voor uitzonderingen, of doen alsof het verdrag niet voor ons geldt.", opties: [
      {label: "Netjes aanpassen", uitleg: "+€1M vaste kosten per maand, reputatie +4.", eff: {bonus_cost: 1, reputation: 4}}, {label: "Lobbyen · €6M", kost: 6, uitleg: `Kans ${snapKans(58)}%: invloed +8. Mislukt: heat +4.`, eff: {kans: 58, succes: {invloed: 8, tekst: "Er staat nu een uitzondering in, met onze naam er bijna in."}, falen: {heat: 4}}},
      {label: "Negeren", uitleg: "Heat +8.", eff: {heat: 8}}], standaard: 2})},
  {id: "pool", kop: "De Noordpoolroute gaat open", tekst: "Voor het eerst is de poolroute het hele jaar bevaarbaar. Groenland, Canada en Rusland worden ineens doorvoerlanden.", run(s){ for (const d of s.districts) if (["GRL", "CAN", "RUS", "SCA"].includes(d.id)) d.income = r1(d.income + 2); },
    keuze: s => ({van: "Strategie", titel: "Een plek op de poolroute", tekst: "Een consortium zoekt partners voor havens en ijsbrekers. Vroeg instappen is duur, laat instappen kan niet meer.", opties: [
      {label: "Instappen · €12M", kost: 12, uitleg: "Blijvend +€1,6M per maand.", eff: {stream: {naam: "Poolroute-consortium", bedrag: 1.6}}}, {label: "Laten gaan", uitleg: "", eff: {}}], standaard: 1})},
  {id: "rivalenoorlog", kop: "Corporatieoorlog", tekst: "Twee megacorporaties gaan elkaar openlijk te lijf. Depots branden, aandelen kelderen.", when: s => s.rivals.length >= 2,
    run(s){ const [a, b] = [...s.rivals].sort(() => R() - 0.5); s.flags.special_oorlog = [a.name, b.name]; a.cash = r1(a.cash * 0.75); b.cash = r1(b.cash * 0.75); a.moeheid = clamp(a.moeheid + 20); b.moeheid = clamp(b.moeheid + 20); },
    keuze: s => { const [a, b] = s.flags.special_oorlog || ["de een", "de ander"]; return {van: "Strategie", titel: `${a} tegen ${b}`, tekst: `${a} en ${b} vechten. Dat is goed nieuws voor wie ertussen staat en slim is.`, opties: [
      {label: "Wapens leveren aan beide", uitleg: "+€15M zwart, heat +6.", eff: {zwart: 15, heat: 6}}, {label: "Bemiddelen", uitleg: "Relatie met beide +15, invloed +5.", eff: {rivaal: {[a]: {relatie: 15}, [b]: {relatie: 15}}, invloed: 5}}, {label: "Toekijken", uitleg: "", eff: {}}], standaard: 2}; }},
  {id: "psychose", kop: "Golf van cyberpsychose", tekst: "In twintig steden slaan mensen met goedkope implantaten tegelijk door. Niemand weet waarom. Iedereen weet wie ze verkocht.", run(s){ if (s.sectoren["Cyberware"]) s.sectoren["Cyberware"].idx = r1(s.sectoren["Cyberware"].idx * 0.8); if (s.sectoren["Private Security"]) s.sectoren["Private Security"].trend += 0.06; },
    keuze: s => ({van: "PR", titel: "De psychose-golf", tekst: "Er zijn klinieken nodig en beveiliging. We kunnen helpen, of verdienen.", opties: [
      {label: "Klinieken financieren · €6M", kost: 6, uitleg: "Reputatie +6, de straat +6.", eff: {reputation: 6, factions: {straat: 6}}}, {label: "Beveiliging verkopen", uitleg: "+€9M, reputatie −3.", eff: {cash: 9, reputation: -3}}, {label: "Afwachten", uitleg: "", eff: {}}], standaard: 2})},
  {id: "orbitaal", kop: "De eerste orbitale fabriek draait", tekst: "Een consortium meldt dat zijn fabriek in een baan om de aarde winst maakt. Er is een nieuwe sector: Orbitaal.", when: s => !typeOf(s, "Orbitaal") && (s.tijdperk || 0) >= 1, run(s){ unlockOrbitaal(s); },
    keuze: s => ({van: "Strategie", titel: "Naar de ruimte?", tekst: "Orbitaal is nu een sector. Je kunt er een divisie in starten via Bedrijf, of nu meedoen in het consortium.", opties: [
      {label: "Consortium · €20M", kost: 20, uitleg: "Blijvend +€2,4M per maand.", eff: {stream: {naam: "Orbitaal consortium", bedrag: 2.4}}}, {label: "Later", uitleg: "Je kunt altijd een divisie Orbitaal starten.", eff: {}}], standaard: 1})},
  {id: "signaal", kop: "Het Signaal", tekst: "Een onbekende AI stuurt dezelfde boodschap naar elke corporatie ter wereld: 'Ik kan helpen. Wie antwoordt eerst?'", run(){},
    keuze: s => ({van: "IT", titel: "Een AI wil met ons praten", tekst: "Het ding zit in onze servers en vraagt om toegang. Het biedt in ruil 'inzicht'. Wat dat betekent, weet niemand.", opties: [
      {label: "Antwoorden", uitleg: `Kans ${snapKans(58)}%: invloed +10 en €10M. Mislukt: heat +6, reputatie −4.`, eff: {kans: 58, succes: {invloed: 10, cash: 10, tekst: "Het Signaal helpt. Voor nu."}, falen: {heat: 6, reputation: -4, tekst: "Het Signaal lekte alles wat het vond."}}},
      {label: "Servers uitzetten", uitleg: "Morale −2, verder niets.", eff: {morale: -2}}], standaard: 1})},
  {id: "vluchtelingen", kop: "Klimaatvluchtelingen", tekst: "Na een zomer van hitte trekken miljoenen mensen naar het noorden. Overheden schuiven met quota en grenzen.", run(s){ for (const d of s.districts) if (["IND", "PAK", "NIJ", "LEV", "CAF"].includes(d.id)) d.mod = {f: 0.8, m: 3, why: "Klimaatvlucht"}; },
    keuze: s => ({van: "HR", titel: "Mensen die werk zoeken", tekst: "Er staan duizenden mensen aan de poort, goed opgeleid en wanhopig. We kunnen ze aannemen.", opties: [
      {label: "Tien mensen aannemen", uitleg: "+10 personeel, reputatie +3, de straat +4.", eff: {personeel: 10, reputation: 3, factions: {straat: 4}}}, {label: "Lobbyen voor dichte grenzen", uitleg: "Overheid +5, de straat −8.", eff: {factions: {stad: 5, straat: -8}}}, {label: "Niets", uitleg: "", eff: {}}], standaard: 2})},
];
function specialTick(s, ctx){
  const n = maandenGespeeld(s); s.flags.volgende_special ??= 7;
  if (n < s.flags.volgende_special) return;
  const done = s.flags.specials_gehad || [], ok = SPECIALS.filter(x => !done.includes(x.id) && (!x.when || x.when(s)));
  s.flags.volgende_special = n + RI(8, 14);
  if (!ok.length) return;
  const e = CH(ok); (s.flags.specials_gehad ??= []).push(e.id);
  e.run(s); for (const [a, v] of (VRAAG_DOOR_SPECIAL[e.id] || [])) vraagSchok(s, a, v, e.kop); news(s, e.kop, e.tekst, "", "special", true); ctx.rep.push(`Wereldgebeurtenis: ${e.kop}`);
  const k = e.keuze(s); k.soort = "special_" + e.id; addKeuze(s, ctx, k);
}

function migrate20(s){
  if (!s.player || !s.districts) return;
  s.crew ??= []; s.huurmarkt ??= []; s.klussen ??= []; s.huurleger ??= null; s.netwerk_namen ??= {};
  s.tijdperk ??= tijdperkVan(s); s.statusNiveau ??= 0;
  if (s.setup_done && !s.huurmarkt.length){ marktTick(s); klusTick(s); }
}

/* ===================== 2.1 PRODUCTEN: de lineup van elke divisie ===================== */
const PRODUCT_NAMEN = {
  "Biotech": ["Regen-X huidkweek", "NeuroCalm", "Synthetisch bloed S2", "Gentherapie Kit", "Immuno-patch", "Leverkweek L4"],
  "Cyberware": ["Optiek Mk I", "Reflexbooster R7", "Subdermaal pantser", "Neurale link NL-2", "Kunsthand Pro", "Spraakchip Babel"],
  "Logistiek": ["Containerlijn Noord", "Dronekoerier D3", "Koelketen 24/7", "Expresroute", "Havenservice", "Nachtvracht"],
  "Media & Data": ["Nieuwsfeed Puls", "Advertentienet", "Datakluis", "Streamingdienst Neon", "Profielenbank", "Trendradar"],
  "Private Security": ["Objectbewaking", "Persoonsbeveiliging", "Escortdienst", "Cyberwacht", "Snelle respons", "Bunkerservice"],
  "Financieel": ["Microkrediet", "Offshore-rekening", "Risicofonds Kraken", "Valutadesk", "Polis Zorgeloos", "Cryptobewaring"],
  "Smokkel": ["Grenspakket", "Stille vracht", "Papierwerk", "Nachtroute", "Containerkoppeling", "Diplomatieke koffer"],
  "Weapon Manufacturing": ["Dienstpistool P9", "Sniper Longshot", "Pantserset Bastion", "Gevechtsdrone Horzel", "Tank Mammoet", "Gevechtsvliegtuig Valk"],
  "Orbitaal": ["Satellietdienst", "Microzwaartekracht-lab", "Orbitale opslag", "Lanceerslot"],
};
const PRODUCT_WOORDEN = [
  [/wapen|weapon|arms|gun|firearm|ammo|munitie|munition|defensi|defen[cs]e|geweer|rifle|militair|military/i, ["Pistool P9", "Smartgun S-3", "Railgun Donder", "Monodraad-mes", "Drone-geweer DG", "Pantservest K4", "Granaatwerper GL-6"]],
  [/drone/i, ["Bezorgdrone B1", "Bewakingsdrone Oog", "Zwermset 12", "Vrachtdrone Ezel", "Racedrone Spits"]],
  [/drug|pharma|medic|zorg|kliniek|clinic|health|trauma|ambulance/i, ["Pijnstiller Nul", "Slaapmiddel Zacht", "Focuspil F", "Kliniekpakket", "Stimulant Rood"]],
  [/auto|voertuig|motor|vervoer|taxi/i, ["Stadsauto Mier", "Pantserwagen", "Motor Kraai", "Robottaxi", "Vrachtwagen Os"]],
  [/voed|food|eten|drank|restaur/i, ["Synthvlees", "Eiwitreep", "Energiedrank Volt", "Algenburger", "Kweekvis"]],
  [/mode|kleding|textiel/i, ["Lichtjas", "Kogelwerend pak", "Neonlijn", "Slimme stof", "Streetlijn"]],
  [/game|entertain|muziek|film|club/i, ["VR-arena", "Neurogame", "Clubnacht", "Livestream Gloed", "Platenlabel"]],
  [/energie|stroom|solar|zon|kern/i, ["Zonnepark", "Batterijbank", "Microreactor", "Stroomabonnement", "Netbalans"]],
  [/ai|robot|software|tech/i, ["Assistent-AI", "Fabrieksrobot", "Beveiligingssoftware", "Vertaalmodel", "Robotarm R2"]],
];
const PRODUCT_SCHAAL = {
  klein: {label: "Klein product", kost: 5, maanden: 2, doel: 6, kw: 0, flop: 0},
  groot: {label: "Grote lancering", kost: 14, maanden: 3, doel: 7, kw: 1, flop: 8},
  vlag: {label: "Vlaggenschip", kost: 30, maanden: 4, doel: 8, kw: 2, flop: 15},
};
function productNamen(type){ if (PRODUCT_NAMEN[type]) return PRODUCT_NAMEN[type]; const kw = PRODUCT_WOORDEN.find(([re]) => re.test(type)); return kw ? kw[1] : ["Basis", "Pro", "Elite", "X", "Mk II", "Nova"].map(x => `${type} ${x}`); }
function nieuwProductNaam(s, type){ const used = new Set((s.producten || []).map(p => p.naam)); return productNamen(type).find(x => !used.has(x)) || `${type} ${RI(2, 9)}${CH(["00", "X", "S", "Pro"])}`; }
function mkProduct(s, d, naam, kw, pop){ return {id: "p" + hex8(), naam: naam || nieuwProductNaam(s, d.type), divisie: d.name || d.type, type: d.type, kwaliteit: clamp(Math.round(kw), 1, 5), pop: Math.round(pop), leeftijd: 0, sinds: ym(s), status: "markt", delen: [0, 1, 2].map(() => ({kwal: "standaard", eigen: true})), auto: {...(s.autoStandaard || {})}}; } /* 4.7.5: standaard alles uit de eigen fabriek */
const divNaam = d => d.name || d.type;
const opMarkt = (s, d) => (s.producten || []).filter(p => p.divisie === divNaam(d) && p.status === "markt");
const maxProducten = d => 2 + d.level;
/* 4.4.3: varianten van een product op de markt: andere prijs, onderdelen en kwaliteit; ze nemen een deel van de klanten van het origineel over */
const VARIANT = {basis: {label: "Basis", f: 0.8, delen: "goedkoop", kw: -1, tekst: "goedkoper (80%), goedkope onderdelen, kwaliteit −1: voor prijsbewuste klanten"},
  pro: {label: "Pro", f: 1.25, delen: "premium", kw: 0, tekst: "duurder (125%), premium onderdelen: voor wie op eigenschappen let"},
  elite: {label: "Elite", f: 1.6, delen: "premium", kw: 1, tekst: "veel duurder (160%), premium onderdelen, kwaliteit +1: voor de koopkrachtige top"}};
const variantKost = s => r1(PRODUCT_SCHAAL.klein.kost * 0.5 * (DIFF[s.player.difficulty] || 1));
const leegStraf = d => clamp(((d.leeg || 0) - 12) * 0.006, 0, 0.2);
function productMult(s, d){ const ps = opMarkt(s, d); if (!ps.length) return Math.round((0.95 - leegStraf(d)) * 100) / 100; return 1; }
/* 4.3: elk product levert zijn eigen omzet; productie kost een vaste prijs per stuk (PROD_KOST × de standaardprijs) */
const PROD_KOST = 0.45;
/* 4.3 stap 2: vrije prijs. prijsF = prijs ten opzichte van de standaardprijs (0,6 tot 1,8). Een duurder product verkoopt minder
   (prijsgevoeligheid per markt; hogere kwaliteit maakt klanten minder gevoelig), de kostprijs per stuk blijft gelijk. */
const ELAST = {wapen: 0.95, medisch: 0.6, implantaat: 0.85, data: 1.3, beveiliging: 0.7, smokkel: 0.75, logistiek: 1.35, financieel: 1.2, orbitaal: 0.7, consument: 1.55};
const PRIJS_F = {budget: 0.8, standaard: 1, premium: 1.35}, PRIJS_MIN = 0.6, PRIJS_MAX = 1.8;
const prijsF = p => clamp(p.prijsF ?? PRIJS_F[p.prijs || "standaard"] ?? 1, PRIJS_MIN, PRIJS_MAX);
const prijsLabel = f => f <= 0.85 ? "budget" : f >= 1.25 ? "premium" : "standaard";
const elast = p => Math.round((ELAST[p.aard || aardVan(p.type, p.naam)] ?? 1.2) * clamp(1.2 - 0.05 * (p.kwaliteit || 3), 0.9, 1.15) * 100) / 100;
/* 4.3.3: klantsegmenten. Elk soort product heeft drie groepen klanten met een eigen deel van de markt, een eigen prijsgevoeligheid (em × de basis)
   en een eigenschap waar ze op letten (index in SPECS). Een product dat op die eigenschap uitblinkt verkoopt meer in dat segment. */
const SEGMENTEN = {
  wapen: [["Legers en staten", 0.35, 0.6, 0], ["Bendes en huurlingen", 0.4, 1.2, 2], ["Particulieren", 0.25, 1.4, 1]],
  medisch: [["Ziekenhuizen", 0.45, 0.6, 1], ["Rijke particulieren", 0.3, 0.4, 2], ["Straatklinieken", 0.25, 2.0, 0]],
  implantaat: [["Corporate elite", 0.3, 0.4, 0], ["Klinieken", 0.45, 1.0, 1], ["Ripperdocs op straat", 0.25, 1.8, 2]],
  data: [["Corporaties", 0.45, 0.7, 1], ["Overheden", 0.25, 0.8, 0], ["Consumenten", 0.3, 1.6, 2]],
  beveiliging: [["Corporaties", 0.45, 0.8, 1], ["Rijke particulieren", 0.3, 0.6, 2], ["Gemeenten", 0.25, 1.4, 0]],
  smokkel: [["Syndicaten", 0.45, 0.8, 2], ["Zwarte markt", 0.35, 1.3, 1], ["Nomaden", 0.2, 1.0, 0]],
  logistiek: [["Webwinkels", 0.45, 1.4, 0], ["Industrie", 0.35, 0.8, 1], ["Overheid", 0.2, 0.7, 2]],
  financieel: [["Particulieren", 0.5, 1.3, 2], ["MKB", 0.3, 1.0, 1], ["Vermogenden", 0.2, 0.5, 0]],
  orbitaal: [["Satellietbedrijven", 0.45, 0.8, 1], ["Staten", 0.3, 0.6, 0], ["Start-ups", 0.25, 1.6, 2]],
  consument: [["Massamarkt", 0.55, 1.4, 1], ["Trendvolgers", 0.25, 0.8, 0], ["Bewuste kopers", 0.2, 0.9, 2]]};
/* 4.4: per segment telt ook hoe je scoort tegen de producten van rivalen in dezelfde markt (hun gemiddelde op die eigenschap) */
function rivaalSpecs(s, a){ return s ? s.rivals.flatMap(r => (r.producten || []).filter(x => x.aard === a).map(x => ({naam: x.naam, wie: r.name, specs: prodSpecs({id: x.naam, kwaliteit: x.kwaliteit, aard: a})}))) : []; }
function segmenten(p, s = (typeof G !== "undefined" && G.game) || null){ const a = p.aard || aardVan(p.type, p.naam), specs = prodSpecs({...p, aard: a}), gem = specs.reduce((t, x) => t + x.v, 0) / 3, E = elast(p), f = prijsF(p), RS = rivaalSpecs(s, a);
  const rows = (SEGMENTEN[a] || SEGMENTEN.consument).map(([naam, aandeel, em, v]) => { const rg = RS.length ? RS.reduce((t, x) => t + x.specs[v].v, 0) / RS.length : null, best = RS.length ? RS.reduce((b, x) => x.specs[v].v > b.specs[v].v ? x : b) : null;
    const fit = clamp(1 + (specs[v].v - gem) * 0.07, 0.75, 1.3) * (rg == null ? 1 : clamp(1 + (specs[v].v - rg) * 0.04, 0.85, 1.15)), mk = p.mkt && p.mkt.seg === (SEGMENTEN[a] || SEGMENTEN.consument).findIndex(x => x[0] === naam) ? p.mkt.f : 1, vol = aandeel * fit * mk * Math.exp(-E * em * (f - 1));
    return {naam, aandeel, em, wil: specs[v].naam, score: specs[v].v, rivaal: rg == null ? null : Math.round(rg * 10) / 10, beste: best ? {naam: best.naam, wie: best.wie, v: best.specs[v].v} : null, fit: Math.round(fit * 100) / 100, gevoelig: Math.round(E * em * 100) / 100, vol}; });
  const tot = rows.reduce((t, x) => t + x.vol, 0) || 1; for (const r of rows) r.pct = Math.round(r.vol / tot * 100); return {rows, tot}; }
const volF = p => clamp(segmenten(p).tot, 0.15, 1.6);
const prodKost = (p, omzet) => omzet * PROD_KOST * kostFactor(p) / (prijsF(p) * KANAAL[kanaalVan(p)].marge) + garantie(p, omzet); /* productie + garantie (4.5) */
function prijsProef(s, p, f){ const q = {...p, prijsF: clamp(f, PRIJS_MIN, PRIJS_MAX)}, o = prodOmzet(s, q); return {f: q.prijsF, stukPrijs: stukPrijs(q), omzet: r1(o), winst: r1(o - prodKost(q, o)), w: o - prodKost(q, o), vraag: Math.round(vraagNa(q)), cap: prodCap(s, q), churn: isAbo(q) ? Math.round(aboChurn(q) * 1000) / 10 : null}; }
function besteprijs(s, p){ let best = null; for (let f = PRIJS_MIN; f <= PRIJS_MAX + 1e-9; f += 0.05){ const x = prijsProef(s, p, Math.round(f * 100) / 100); if (!best || x.w > best.w + 1e-6) best = x; } return best; }
function prodOmzet(s, p){ const d = s.divisions.find(x => divNaam(x) === p.divisie); if (!d) return 0; return (5 + 3 * Math.pow(d.level, 0.8)) * prodGewicht(p, s) * 0.17; }
/* vraag na de prijs: losse producten verkopen minder bij een hogere prijs; bij abonnementen werkt de prijs via opzeggers en nieuwe klanten */
const vraagNa = p => isAbo(p) ? bereik(p) : bereik(p) * volF(p);
function productKans(s, d, schaal){ const sc = PRODUCT_SCHAAL[schaal]; const b = Math.ceil(d.level / 2) + ((s.crew || []).some(m => m.rol === "spindokter") ? 1 : 0); return {bonus: b, doel: sc.doel, kans: kans2d6(b, sc.doel)}; }
function actProduct(s, ctx, soort, a){
  const pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; };
  const m = ym(s), dif = DIFF[s.player.difficulty] || 1; let msg;
  if (soort === "ontwikkel"){
    const d = s.divisions.find(x => divNaam(x) === a.divisie); if (!d) return {ok: false, msg: "Kies een divisie."};
    const sc = PRODUCT_SCHAAL[a.schaal]; if (!sc) return {ok: false, msg: "Kies een schaal."};
    const alle = (s.producten || []).filter(p => p.divisie === divNaam(d) && p.status !== "teruggeroepen");
    if (alle.length >= maxProducten(d)) return {ok: false, msg: `${divNaam(d)} kan op niveau ${d.level} maximaal ${maxProducten(d)} producten dragen (inclusief de wachtrij). Haal er een uit de markt of breid de divisie uit.`};
    const focus = DEV_FOCUS[a.focus] ? a.focus : "standaard", F = DEV_FOCUS[focus], aardK = PRODUCT_AARD[a.aard] ? a.aard : null, beta = a.beta === true || a.beta === "ja", plan = devPlan(s, d, a.schaal, focus, aardK || aardVan(d.type, a.naam || ""), beta);
    const gratis = (s.gratisDev || 0) > 0, kost = gratis ? 0 : plan.kost, bezig = false; /* 4.7.11: geen wachtrij meer, alles start meteen */ /* 4.7.10: gratis ontwikkelingen */
    if (bezig){ if (alle.filter(p => p.status === "wachtrij").length >= 3) return {ok: false, msg: "De wachtrij is vol (3)."};
      const naamW = String(a.naam || "").trim().slice(0, 40) || nieuwProductNaam(s, d.type); if ((s.producten || []).some(p => p.naam === naamW)) return {ok: false, msg: "Die naam bestaat al."};
      const q = mkProduct(s, d, naamW, plan.kw, 0); q.status = "wachtrij"; q.schaal = a.schaal; q.focus = focus; q.nadruk = nadrukVan(a.nadruk); if (beta) q.beta = true; if (DEEL_KWAL[a.delen] && a.delen !== "standaard") q.delen = [0, 1, 2].map(() => ({kwal: a.delen, eigen: true})); q.aard = aardK || aardVan(d.type, naamW); if (a.vorm === "abonnement") q.soort = "abonnement"; (s.producten ??= []).push(q);
      if (gratis){ q.kostOverride = 0; s.gratisDev -= 1; }
      const msgW = `${naamW} staat in de wachtrij van ${divNaam(d)}. Het start vanzelf als het vorige product gelanceerd is; ${gratis ? `gratis (nog ${s.gratisDev} gratis)` : `dan wordt €${kost}M betaald`}.`; addLog(s, msgW); return {ok: true, msg: msgW}; }
    const naam = String(a.naam || "").trim().slice(0, 40) || nieuwProductNaam(s, d.type);
    if ((s.producten || []).some(p => p.naam === naam)) return {ok: false, msg: "Die naam bestaat al."};
    if (!pay(kost)) return {ok: false, msg: `Dit kost €${kost}M. Niet genoeg cash.`}; if (gratis) s.gratisDev -= 1;
    const p = mkProduct(s, d, naam, plan.kw, 0); p.status = "ontwikkeling"; p.eta = plan.maanden; p.schaal = a.schaal; p.focus = focus; p.nadruk = nadrukVan(a.nadruk); if (beta) p.beta = true; if (DEEL_KWAL[a.delen] && a.delen !== "standaard") p.delen = [0, 1, 2].map(() => ({kwal: a.delen, eigen: true})); p.aard = aardK || aardVan(d.type, naam); if (a.vorm === "abonnement") p.soort = "abonnement"; (s.producten ??= []).push(p);
    const K = devPlan(s, d, a.schaal, focus, p.aard, beta).kansen; prodLog(p, s, `Ontwikkeling gestart (${PRODUCT_SCHAAL[a.schaal].label.toLowerCase()}, focus ${F.label.toLowerCase()})`);
    msg = `${naam} in ontwikkeling bij ${divNaam(d)}: €${kost}M, ${plan.maanden} maanden. Bij de lancering: hit ${K.hit}%, gewoon ${K.gewoon}%, matig ${K.neutraal}%, flop ${K.flop}%, terugroepactie ${K.terug}%.`;
  } else {
    const p = (s.producten || []).find(x => x.id === a.id); if (!p) return {ok: false, msg: "Onbekend product."};
    if (soort === "campagne"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (p.actie === m) return {ok: false, msg: "Deze maand al een campagne gehad."};
      const M = MARKETING[a.mk] || MARKETING.reclame, mk = MARKETING[a.mk] ? a.mk : "reclame", k = M.kost;
      if (M.zwart){ if ((s.accounts.zwart || 0) < k) return {ok: false, msg: `Een fluistercampagne kost €${k}M zwart geld.`}; s.accounts.zwart = r1(s.accounts.zwart - k); } else if (!pay(k)) return {ok: false, msg: `${M.label} kost €${k}M.`};
      const pop = mk === "fluister" && ILLEGAAL.has(p.aard) ? 12 : M.pop; p.actie = m; p.pop = clamp(p.pop + pop, 0, 95); if (M.heat) s.heat = clamp(s.heat + M.heat);
      const si = mktSegIndex(p, M.doel), seg = si >= 0 ? (SEGMENTEN[p.aard] || SEGMENTEN.consument)[si][0] : null; if (si >= 0) p.mkt = {seg: si, f: M.f, maanden: M.maanden, kanaal: mk};
      prodLog(p, s, `${M.label}${seg ? ` (${seg.toLowerCase()})` : ""}`); msg = `${M.label} voor ${p.naam}: populariteit nu ${p.pop}${seg ? `, ${M.maanden} maanden meer afzet bij ${seg.toLowerCase()}` : ""}${M.heat ? `, heat +${M.heat}` : ""}.`; }
    else if (soort === "verbeter"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (p.kwaliteit >= 5) return {ok: false, msg: "Beter wordt het niet."}; if (p.verbetering) return {ok: false, msg: "Er loopt al een verbetering."};
      const kost = r1(8 * dif); if (!pay(kost)) return {ok: false, msg: `Een nieuwe versie kost €${kost}M.`}; p.verbetering = 2; msg = `Versie ${p.kwaliteit + 1} van ${p.naam} in ontwikkeling: €${kost}M, 2 maanden.`; }
    else if (soort === "prijs"){ const rr = actPrijs(s, p.id, a.f != null ? +a.f : a.prijs); if (rr.ok) prodLog(p, s, `Prijs: €${stukPrijs(p).toLocaleString("nl-NL")} per ${isAbo(p) ? "abonnee" : "stuk"} (${PRIJS[p.prijs].label.toLowerCase()})`); return rr; }
    else if (soort === "kanaal"){ if (!KANAAL[a.k]) return {ok: false, msg: "Onbekend kanaal."}; if (kanaalVan(p) === a.k) return {ok: false, msg: "Dat is al zo."};
      const k = p.status === "markt" ? kanaalWissel(s) : 0; if (k && !pay(k)) return {ok: false, msg: `Wisselen kost €${k}M.`}; p.kanaal = a.k; prodLog(p, s, `Verkoop via ${KANAAL[a.k].label.toLowerCase()}`);
      msg = `${p.naam} verkoopt nu via ${KANAAL[a.k].label.toLowerCase()}${k ? ` (€${k}M om over te stappen)` : ""}.${a.k === "zwart" ? " Heat +0,4 per maand; de helft van de omzet komt als zwart geld binnen." : ""}`; }
    else if (soort === "keuring"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; const st = keurStatus(p); if (st === "ok") return {ok: false, msg: "Al goedgekeurd."}; if (st === "bezig") return {ok: false, msg: "De keuring loopt al."};
      if (a.wijze === "omkopen"){ const k = omkoopKost(s), zw = (s.accounts.zwart || 0) >= k; if (zw) s.accounts.zwart = r1(s.accounts.zwart - k); else if (!pay(k)) return {ok: false, msg: `Omkopen kost €${k}M.`};
        const r = rol2d6(0, 7); addRoll(s, `Keurder omkopen voor ${p.naam}: ${r.txt} → ${r.ok ? "GELUKT" : "MISLUKT"}`);
        if (r.ok){ p.keuring = "ok"; vergunning(s, p); s.heat = clamp(s.heat + 3); prodLog(p, s, "Goedgekeurd (met een envelop)"); msg = `${keurInstantie(p)} stempelt ${p.naam} goed (${r.txt}). €${k}M${zw ? " zwart" : ""}, heat +3.`; }
        else { s.heat = clamp(s.heat + 6); s.reputation = clamp(s.reputation - 4); prodLog(p, s, "Omkoping mislukt"); msg = `De keurder weigert en praat (${r.txt}). €${k}M weg, heat +6, reputatie −4. Een officiële keuring kan nog.`; } }
      else { const k = keurKost(s); if (!pay(k)) return {ok: false, msg: `Een keuring kost €${k}M.`}; p.keuring = {maanden: 2}; prodLog(p, s, "Keuring aangevraagd"); msg = `Keuring van ${p.naam} aangevraagd bij ${keurInstantie(p)}: €${k}M, 2 maanden, ${kans2d6(0, keurDoel(p))}% kans.`; } }
    else if (soort === "variant"){ const V = VARIANT[a.v]; if (!V) return {ok: false, msg: "Onbekende variant."}; if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (p.variantVan) return {ok: false, msg: "Maak varianten van het origineel."};
      const d = s.divisions.find(x => divNaam(x) === p.divisie); if (!d) return {ok: false, msg: "Geen divisie."}; const alle = s.producten.filter(x => x.divisie === p.divisie && x.status !== "teruggeroepen");
      if (alle.length >= maxProducten(d)) return {ok: false, msg: `${p.divisie} draagt maximaal ${maxProducten(d)} producten. Haal er een uit de markt of breid de divisie uit.`};
      const naam = `${p.naam} ${V.label}`; if (s.producten.some(x => x.naam === naam)) return {ok: false, msg: "Die variant bestaat al."};
      const k = variantKost(s); if (!pay(k)) return {ok: false, msg: `Een variant kost €${k}M.`};
      const q = mkProduct(s, d, naam, clamp(p.kwaliteit + V.kw, 1, 5), 0); Object.assign(q, {status: "ontwikkeling", eta: 1, schaal: "klein", focus: "veilig", doelOverride: 5, aard: p.aard, soort: p.soort, nadruk: p.nadruk ?? null, delen: [0, 1, 2].map(() => ({kwal: V.delen, eigen: true})), prijsF: V.f, prijs: prijsLabel(V.f), variantVan: p.id, trait: p.trait ?? null});
      s.producten.push(q); prodLog(p, s, `Variant ${V.label} in ontwikkeling`); prodLog(q, s, `Variant van ${p.naam}`); msg = `${naam} in ontwikkeling: €${k}M, 1 maand. Bij de lancering neemt het klanten over van ${p.naam}.`; }
    else if (soort === "auto"){ if (!AUTO[a.k]) return {ok: false, msg: "Onbekend."}; (p.auto ??= {})[a.k] = !!a.aan && a.aan !== "0" && a.aan !== "false"; msg = `Autopilot ${p.naam}: ${AUTO[a.k].split(" (")[0].toLowerCase()} ${p.auto[a.k] ? "aan" : "uit"}.`; }
    else if (soort === "zelfmaken"){ const idx = a.i === "alle" ? delenVan(p).map((_, j) => j).filter(j => !eigenDeel(p, j)) : [+a.i].filter(j => delenVan(p)[j] && !eigenDeel(p, j));
      if (!idx.length) return {ok: false, msg: "Dat maak je al zelf."}; const k = r1(zelfKost(s) * idx.length); if (!pay(k)) return {ok: false, msg: `Zelf maken kost €${k}M (€${zelfKost(s)}M per onderdeel).`};
      const kp0 = kostPrijs(p); for (const j of idx){ leverancier(s, p, j); p.delen[j].eigen = true; p.delen[j].lev = null; } prodLog(p, s, `Eigen productie: ${idx.map(j => delenVan(p)[j][0].toLowerCase()).join(", ")}`);
      msg = `${p.naam}: ${idx.length === 1 ? delenVan(p)[idx[0]][0].toLowerCase() + " komt" : `${idx.length} onderdelen komen`} nu uit je eigen fabriek (€${k}M). Kostprijs €${kp0} → €${kostPrijs(p)} per stuk, geen leverancier meer.`; }
    else if (soort === "onderdeel"){ const i = +a.i, D = delenVan(p)[i]; if (!D || !DEEL_KWAL[a.kwal]) return {ok: false, msg: "Onbekend onderdeel."}; if (deelKwal(p, i) === a.kwal) return {ok: false, msg: "Dat is al zo."};
      const k = p.status === "markt" ? omschakelKost(s) : 0; if (k && !pay(k)) return {ok: false, msg: `Omschakelen kost €${k}M.`}; const kp0 = kostPrijs(p); leverancier(s, p, i); p.delen[i].kwal = a.kwal;
      const sp = prodSpecs(p).find(x => x.naam === (SPECS[p.aard] || SPECS.consument)[D[2]]);
      msg = `${p.naam}: ${D[0].toLowerCase()} nu ${DEEL_KWAL[a.kwal].label.toLowerCase()}${k ? ` (omschakelen €${k}M)` : ""}. Kostprijs €${kp0} → €${kostPrijs(p)} per stuk, ${sp.naam.toLowerCase()} ${sp.v}/10.`; prodLog(p, s, `${D[0]}: ${DEEL_KWAL[a.kwal].label.toLowerCase()}`); }
    else if (soort === "krimpen"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (prodCap(s, p) - 15 < 45) return {ok: false, msg: "Kleiner dan 45 kan niet; haal het product anders uit de markt."};
      const terug = (p.capExtra || 0) > 0 ? r1((5 + ((p.capExtra || 0) - 15) / 5) * (DIFF[s.player.difficulty] || 1)) : 0; /* een betaalde uitbreiding terugdraaien: investering terug */
      p.capExtra = (p.capExtra || 0) - 15; if (terug){ s.cash = r1(s.cash + terug); s.accounts.operationeel = s.cash; } prodLog(p, s, "Productie ingekrompen");
      msg = `Productielijn van ${p.naam} ingekrompen: capaciteit nu ${prodCap(s, p)} (vraag ${Math.round(vraagNa(p))}).${terug ? ` De €${terug}M van de uitbreiding komt terug.` : ""} Vaste kosten van de lijn nu ${capVast(s, p) >= 0 ? `€${capVast(s, p)}M` : `€${-capVast(s, p)}M bespaard`} per maand.`; }
    else if (soort === "capaciteit"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; const k = capKost(s, p); if (!pay(k)) return {ok: false, msg: `Productie uitbreiden kost €${k}M.`}; p.capExtra = (p.capExtra || 0) + 15; msg = `Productielijn van ${p.naam} uitgebreid: capaciteit nu ${prodCap(s, p)} (vraag ${Math.round(vraagNa(p))}). Vaste kosten van de lijn nu €${capVast(s, p)}M per maand.`; }
    else if (soort === "loyaliteit"){ if (!isAbo(p)) return {ok: false, msg: "Alleen voor abonnementen."}; p.loyaal = !p.loyaal; msg = p.loyaal ? `Loyaliteitsprogramma voor ${p.naam}: €${loyKost(p)}M per maand, opzeggers −1,2 procentpunt.` : `Loyaliteitsprogramma van ${p.naam} gestopt.`; }
    else if (soort === "stop"){ s.producten = s.producten.filter(x => x !== p); msg = `${p.naam} is uit de markt gehaald.`; }
    else return {ok: false, msg: "Onbekende actie."};
  }
  addLog(s, msg); return {ok: true, msg};
}
/* 5.2.1: automatisch ontwikkelen per divisie: is er een vrije plek, geen ontwikkeling bezig en genoeg kas (kosten + €30M buffer), dan start de divisie zelf een product */
function autoDevTick(s, ctx){ for (const d of s.divisions){ const A = d.autoDev; if (!A || !A.aan) continue; const nm = divNaam(d), alle = (s.producten || []).filter(p => p.divisie === nm && p.status !== "teruggeroepen");
  if (alle.length >= maxProducten(d) || alle.some(p => p.status === "ontwikkeling" || p.status === "wachtrij")) continue;
  const aard = A.aard || aardVan(d.type, ""), schaal = PRODUCT_SCHAAL[A.schaal] ? A.schaal : "klein", plan = devPlan(s, d, schaal, "standaard", aard), kost = (s.gratisDev || 0) > 0 ? 0 : plan.kost;
  if (s.cash < kost + 30) continue; const r = actProduct(s, ctx, "ontwikkel", {divisie: nm, schaal, focus: "standaard", aard}); if (r.ok) ctx.rep.push(`Automatisch ontwikkelen ${nm}: ${r.msg.split(":")[0]}`); } }
function productTick(s, ctx){
  s.producten ??= []; autoDevTick(s, ctx);
  for (const d of s.divisions){ const had = (d.leeg || 0) > 12; d.leeg = opMarkt(s, d).length ? 0 : (d.leeg || 0) + 1; if (d.leeg === 13) mail(ctx, s, "Verkoop", `${divNaam(d)} verkoopt al een jaar niets`, `Klanten van ${divNaam(d)} stappen over naar rivalen die wel iets nieuws hebben. Zolang we niets op de markt hebben, zakt de omzet van deze divisie elke maand verder, tot −20%. Eén product stopt het meteen.`, "HOOG"); }
  const namen = new Set(s.divisions.map(divNaam)); s.producten = s.producten.filter(p => namen.has(p.divisie));
  for (const d of s.divisions){ const nm = divNaam(d);
    for (const q of s.producten.filter(p => p.divisie === nm && p.status === "wachtrij")){
    const sc = PRODUCT_SCHAAL[q.schaal || "klein"], F = DEV_FOCUS[q.focus || "standaard"] || DEV_FOCUS.standaard, kost = q.betaald ? 0 : q.kostOverride != null ? q.kostOverride : r1(sc.kost * (DIFF[s.player.difficulty] || 1) * (F.kost || 1) * (q.beta ? 1.2 : 1));
    if (s.cash < kost + 10){ if (!q.wachtgeld) ctx.rep.push(`${q.naam} wacht in de rij op €${kost}M`); q.wachtgeld = true; continue; }
    s.cash = r1(s.cash - kost); q.status = "ontwikkeling"; q.eta = (q.maandenOverride || Math.max(1, sc.maanden + (F.maanden || 0))) + 1 + (q.beta ? 1 : 0); delete q.wachtgeld; ctx.rep.push(`Productie gestart: ${q.naam}${kost ? ` (€${kost}M)` : ""}`); } }
  for (const p of [...s.producten]){
    const d = s.divisions.find(x => divNaam(x) === p.divisie);
    if (p.status === "wachtrij") continue;
    if (p.status === "ontwikkeling"){
      if (--p.eta > 0) continue;
      const r = lanceerWorp(s, d, p); addRoll(s, `Lancering ${p.naam}: ${r.txt} → ${r.crit ? "HIT" : r.ok ? "GELUKT" : r.neutraal ? "MATIG" : r.blunder ? "TERUGGEROEPEN" : "FLOP"}`);
      const sc = PRODUCT_SCHAAL[p.schaal || "klein"]; p.status = "markt"; p.sinds = ym(s); p.leeftijd = 0;
      if (r.crit){ (s.stats ??= {}).hits = (s.stats.hits || 0) + 1; if (r.nat) p.kwaliteit = clamp(p.kwaliteit + 1, 1, 5); p.pop = r.nat ? 85 : RI(72, 82); mail(ctx, s, "Marketing", `${p.naam} is een hit`, `De lancering van ${p.naam} (${r.txt}) overtreft alles. Wachtlijsten, recensies, kopieën op de zwarte markt binnen een week.`, "NORMAAL"); news(s, `${p.naam} van ${s.player.corp_name} is een hit`, `Het nieuwe product van ${divNaam(d)} gaat de deur uit sneller dan het gemaakt wordt.`, "", "markt", true); }
      else if (r.ok){ p.pop = RI(55, 72); mail(ctx, s, "Marketing", `${p.naam} gelanceerd`, `${p.naam} ligt in de winkels (${r.txt}). Goede start, populariteit ${p.pop}.`, "NORMAAL"); }
      else if (r.neutraal){ p.pop = RI(38, 50); mail(ctx, s, "Marketing", `${p.naam}: rustige start`, `${p.naam} ligt in de winkels (${r.txt}). Geen hit, geen flop: populariteit ${p.pop}. Een campagne kan het een duw geven.`, "NORMAAL"); }
      else if (r.blunder){ s.producten = s.producten.filter(x => x !== p); s.reputation = clamp(s.reputation - 5); const k2 = r1(sc.kost * 0.3); s.cash = r1(s.cash - k2);
        mail(ctx, s, "Juridische Zaken", `Terugroepactie: ${p.naam}`, `${p.naam} (${r.txt}) blijkt een fout te hebben die we niet mochten missen. Alles moet terug. €${k2}M aan kosten, reputatie −5, en de pers heeft foto's.`, "KRITIEK"); ctx.rep.push(`Terugroepactie ${p.naam}`); continue; }
      else { (s.stats ??= {}).flops = (s.stats.flops || 0) + 1; p.pop = RI(15, 28) + (sc.flop || 0); p.kwaliteit = Math.max(1, p.kwaliteit - 1); mail(ctx, s, "Marketing", `${p.naam} flopt`, `De lancering van ${p.naam} (${r.txt}) valt tegen: populariteit ${p.pop}. Een campagne of een nieuwe versie kan het redden. Of je haalt het uit de markt.`, "HOOG"); ctx.rep.push(`${p.naam} flopt`); }
      if (KEURING_AARD.has(p.aard || aardVan(p.type, p.naam)) && p.keuring === undefined){ const o = p.variantVan && s.producten.find(x => x.id === p.variantVan); p.keuring = "nodig"; }
      if (p.variantVan){ const o = s.producten.find(x => x.id === p.variantVan); if (o && o.status === "markt"){ p.pop = Math.round(clamp(o.pop * 0.6, 3, 95)); p.variantStart = {pop: p.pop, origineelVoor: o.pop}; o.pop = Math.round(clamp(o.pop * 0.88, 3, 95)); prodLog(o, s, `${p.naam} neemt klanten over (populariteit −12%)`); } }
      if (heeftFocus(s, "merk")) p.pop = Math.round(clamp(p.pop + 6, 3, 95));
      if (isAbo(p)) p.abo = Math.round(p.pop * 0.5);
      p.aard ??= aardVan(p.type, p.naam); p.prijs ??= "standaard"; if (p.trait === undefined){ const ft = focusTrait(p); p.trait = ft !== undefined ? ft : kiesTrait(p, r.crit, !r.ok && !r.neutraal); } maakReview(p);
      prodLog(p, s, r.crit ? `Lancering: een hit (${p.review.sterren}★)` : r.ok ? `Gelanceerd (${p.review.sterren}★)` : r.neutraal ? `Rustige lancering (${p.review.sterren}★)` : `Lancering geflopt (${p.review.sterren}★)`); if (p.trait) prodLog(p, s, `Eigenschap: ${PRODUCT_TRAITS[p.trait].label}`); continue;
    }
    keuringTick(s, ctx, p); defectTick(s, ctx, p); mktTick(p); autoTick(s, ctx, p); editieTick(s, ctx, p);
    if (p.verbetering && --p.verbetering <= 0){ delete p.verbetering; const r = rol2d6(Math.ceil(d.level / 2), 8); addRoll(s, `Nieuwe versie ${p.naam}: ${r.txt} → ${r.ok ? "GELUKT" : "MISLUKT"}`);
      if (r.ok){ p.kwaliteit = clamp(p.kwaliteit + 1, 1, 5); p.pop = clamp(p.pop + 10, 0, 95); p.leeftijd = 0; maakReview(p); if (KEURING_AARD.has(p.aard || aardVan(p.type, p.naam)) && kanaalVan(p) !== "zwart") p.keuring = "nodig"; /* 4.7.2: nieuwe editie, nieuwe keuring */ if (p.trait === "gevoelig") p.trait = null; prodLog(p, s, `Versie ${p.kwaliteit}`); mail(ctx, s, "R&D", `${p.naam} versie ${p.kwaliteit}`, `De nieuwe versie is klaar (${r.txt}). Kwaliteit ${p.kwaliteit}, en de klanten merken het.${p.keuring === "nodig" ? " Let op: een nieuwe editie moet opnieuw gekeurd worden; tot dan alleen de grijze markt." : ""}`, "NORMAAL"); }
      else mail(ctx, s, "R&D", `Nieuwe versie ${p.naam} mislukt`, `Het ontwikkelteam kreeg het niet werkend (${r.txt}). Het geld is op, het product blijft zoals het was.`, "HOOG"); }
    p.leeftijd = (p.leeftijd || 0) + 1;
    const idx = ((s.sectoren || {})[p.type] || {idx: 100}).idx, tgt = 28 + p.kwaliteit * 8 + (idx - 100) / 3 - Math.max(0, p.leeftijd - 24) * (p.trait === "verslavend" || p.soort === "abonnement" ? 0.25 : 0.8) + ((((s.vraag || {})[p.aard] || {}).idx || 100) - 100) / 6;
    p.pop = Math.round(clamp(p.pop + (tgt - p.pop) * 0.08 + U(-2, 2), p.trait === "cult" ? 35 : 3, 95));
    if (isAbo(p)) aboTick(s, p, ctx);
    if (p.trait === "gevoelig" && p.leeftijd % 3 === 0 && !p.verbetering) p.pop = Math.max(3, p.pop - 5);
  }

}
function startProducten(s){ s.producten = []; }

/* ===================== 2.1 DOELWIT: fixers en huurlingen die op jou worden gezet ===================== */
const DREIG = [
  {id: "sabotage", label: "sabotage", door: "huurlingen", w: 3},
  {id: "data", label: "datadiefstal", door: "een netrunner", w: 3},
  {id: "ontvoering", label: "ontvoering", door: "huurlingen", w: 1.5, when: s => (s.crew || []).some(m => crewStatus(s, m) === "vrij" || crewStatus(s, m) === "bezig")},
  {id: "omkoping", label: "omkoping van je crew", door: "een fixer", w: 1.5, when: s => (s.crew || []).some(m => m.loyaliteit < 55 && m.trait !== "trouw")},
  {id: "rd", label: "inbraak bij R&D", door: "een fixer", w: 2, when: s => (s.producten || []).some(p => p.status === "ontwikkeling" || p.verbetering) || s.projects.length},
  {id: "smaad", label: "lastercampagne", door: "een fixer", w: 2},
];
function verdediging(s, t){
  const cr = (s.crew || []).filter(m => ["vrij", "bezig"].includes(crewStatus(s, m)));
  let v = Math.floor(playerPower(s) / 25) + (t && t.extra || 0);
  if (cr.some(m => m.rol === "huurling")) v += 1;
  if (t && t.type === "data" && cr.some(m => m.rol === "netrunner")) v += 1;
  if (t && t.type === "smaad" && cr.some(m => m.rol === "spindokter")) v += 1;
  if (t && t.type === "omkoping" && cr.some(m => m.rol === "speurder")) v += 1;
  return v;
}

/* ===================== 3.8 PLANNEN: rivalen en syndicaten die over maanden iets tegen je opbouwen ===================== */
const PLAN_SOORT = {
  prijsoorlog: {titel: (w) => `${w} bereidt een prijsoorlog voor`, stappen: ["koopt stilletjes leveranciers op", "werft verkopers weg bij concurrenten", "dumpt de prijzen"], eindTekst: "4 maanden minder omzet en je producten verliezen populariteit",
    eind(s, p, f){ (s.lopende_effecten ??= []).push({naam: `Prijsoorlog van ${p.wie}`, maanden: 4, effect: {cash: -r1(4 * omvang(s) * f)}}); for (const x of (s.producten || []).filter(x => x.status === "markt")) x.pop = Math.round(clamp(x.pop - 8 * f, 3, 95)); return `${p.wie} dumpt de prijzen: vier maanden lang verliezen we omzet en klanten.`; }},
  personeel: {titel: (w) => `${w} wil je mensen`, stappen: ["brengt je teams in kaart", "doet aanbiedingen onder de tafel", "haalt een heel team weg"], eindTekst: "je verliest personeel, morale en loyaliteit van je directie",
    eind(s, p, f){ const n = Math.max(2, Math.round(s.staff.count * 0.1 * f)); s.staff.count = Math.max(5, s.staff.count - n); s.morale = clamp(s.morale - 6 * f); const np = s.npcs[0]; if (np) np.loyalty = clamp(np.loyalty - 15 * f); return `${p.wie} heeft ${n} mensen weggekocht. De rest kijkt rond.`; }},
  laster: {titel: (w) => `${w} bouwt een lastercampagne`, stappen: ["verzamelt vuil over je bedrijf", "benadert journalisten", "publiceert"], eindTekst: "reputatie omlaag, heat omhoog",
    eind(s, p, f){ s.reputation = clamp(s.reputation - 8 * f); s.heat = clamp(s.heat + 4 * f); (s.lopende_effecten ??= []).push({naam: `Laster van ${p.wie}`, maanden: 2, effect: {reputation: -1 * f}}); return `De artikelen staan online. ${p.wie} ontkent alles, met een glimlach.`; }},
  contract: {titel: (w, b) => `${w} wil je contract met ${b}`, stappen: ["praat met je contractpartner", "biedt meer dan jij", "neemt het contract over"], eindTekst: "je verliest een leveringscontract",
    eind(s, p, f){ const st = (s.streams || []).find(x => x.naam === "Contract " + p.doel); if (!st || f < 1){ if (f < 1) return `${p.doel} bleef bij ons, omdat we op tijd beter boden. Het kostte wel wat goodwill bij ${p.wie}.`; return PLAN_SOORT.laster.eind(s, p, f); }
      s.streams = s.streams.filter(x => x !== st); const b = (s.bedrijven || []).find(x => x.naam === p.doel); if (b){ b.contract = false; b.relatie = Math.round(clamp(b.relatie - 20, -100, 100)); } return `${p.doel} levert voortaan aan ${p.wie}. Ons contract (€${st.bedrag}M per maand) is weg.`; }},
  sabotage: {titel: (w) => `${w} plant een aanslag op je depots`, stappen: ["verkent je depots", "koopt een bewaker om", "slaat toe"], eindTekst: "cash weg en je beste product raakt beschadigd",
    eind(s, p, f){ const k = r1(10 * omvang(s) * f); s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; s.heat = clamp(s.heat + 2); const best = (s.producten || []).filter(x => x.status === "markt").sort((a, b) => b.pop - a.pop)[0]; if (best) best.pop = Math.round(clamp(best.pop - 15 * f, 3, 95));
      return `Brand in een depot. €${k}M schade${best ? `, en ${best.naam} ligt een maand niet in de winkels` : ""}.`; }},
};
function planKansOntdekt(s){ return clamp(0.2 + ((s.crew || []).some(m => ["speurder", "fixer"].includes(m.rol) && crewStatus(s, m) !== "opgepakt") ? 0.3 : 0) + (relV(s, "fixer") >= 30 ? 0.15 : 0), 0, 0.8); }
function planStart(s, ctx, diff){
  if ((s.plannen ??= []).length || maandenGespeeld(s) < 8 || R() > 0.07 * diff) return;
  const riv = s.rivals.filter(r => r.status === "oorlog" || (r.relatie || 0) < -10 || r.aggression > 0.6), gangs = (s.gangs || []).filter(g => g.deal === "oorlog" || g.relatie < -30);
  const opties = [...riv.map(r => [{r}, 2]), ...gangs.map(g => [{g}, 1])]; if (!opties.length) return;
  const o = wpick(opties); let soort, wie, doel = null;
  if (o.g){ soort = "sabotage"; wie = o.g.naam; }
  else { wie = o.r.name; const contract = (s.streams || []).find(x => /^Contract /.test(x.naam)); soort = CH(["prijsoorlog", "personeel", "laster", ...(contract ? ["contract"] : [])]); if (soort === "contract") doel = contract.naam.slice(9); }
  const T = PLAN_SOORT[soort];
  s.plannen.push({id: "pl" + hex8(), soort, wie, doel, gang: !!o.g, titel: T.titel(wie, doel), stappen: T.stappen.slice(), stap: 0, volgende: plusMonths(s, 2), ontdekt: false, sinds: ym(s)});
}
function planTick(s, ctx, diff){
  planStart(s, ctx, diff);
  for (const p of [...(s.plannen || [])]){
    if (p.volgende > ym(s)) continue;
    p.stap += 1; p.volgende = plusMonths(s, 2);
    if (p.stap >= p.stappen.length){
      const f = p.zacht ? 0.5 : 1, txt = PLAN_SOORT[p.soort].eind(s, p, f); s.plannen = s.plannen.filter(x => x !== p);
      const r = s.rivals.find(x => x.name === p.wie); if (r) remember(r, s, `${p.titel}: uitgevoerd`);
      mail(ctx, s, p.ontdekt ? "Head of Security" : "Anoniem", p.ontdekt ? `${p.titel}: het is zover` : `Te laat ontdekt: ${p.titel}`, `${txt}${p.zacht ? " We waren voorbereid: het had erger kunnen zijn." : ""}${p.ontdekt ? "" : " Niemand had het zien aankomen. Een speurder of fixer in je crew hoort zulke dingen eerder."}`, "HOOG");
      ctx.rep.push(`Plan uitgevoerd: ${p.titel}`); continue; }
    if (!p.ontdekt && R() < planKansOntdekt(s)){
      p.ontdekt = true; const kosten = r1(5 * omvang(s)), kans = snapKans(clamp(45 + ((s.crew || []).some(m => m.rol === "huurling") ? 10 : 0) + ((s.crew || []).some(m => m.rol === "speurder") ? 10 : 0) + (relV(s, "fixer") >= 30 ? 10 : 0), 20, 85));
      addKeuze(s, ctx, {soort: "plan_" + p.id, van: "Je crew", titel: `Ontdekt: ${p.titel}`, tekst: `${p.wie} is bezig. Stap ${p.stap} van ${p.stappen.length}: ${p.stappen[p.stap - 1]}. Volgende stap: ${p.stappen[p.stap]}. Als het plan slaagt: ${PLAN_SOORT[p.soort].eindTekst}.${p.gm && p.motief ? " Waarom: " + p.motief : ""}`, opties: [
        {label: `Verstoren · €${kosten}M`, kost: kosten, uitleg: `Kans ${kans}% dat het plan stopt. Mislukt het, dan weten ze dat we het weten: heat +3 en ze versnellen.`, eff: {kans, succes: {plan: {id: p.id, actie: "stop"}}, falen: {heat: 3, plan: {id: p.id, actie: "haast"}}}},
        {label: "Voorbereiden · €3M", kost: 3, uitleg: "Het plan gaat door, maar de klap is half zo groot.", eff: {plan: {id: p.id, actie: "zacht"}}},
        {label: "Laten gebeuren", uitleg: `Gratis. Over ${2 * (p.stappen.length - p.stap)} maanden: ${PLAN_SOORT[p.soort].eindTekst}.`, eff: {}}], standaard: 2}); }
  }
}
function planActie(s, o, out){
  const p = (s.plannen || []).find(x => x.id === o.id); if (!p) return;
  if (o.actie === "stop"){ s.plannen = s.plannen.filter(x => x !== p); const r = s.rivals.find(x => x.name === p.wie); if (r){ remember(r, s, `${p.titel}: verstoord door de speler`); relShift(r, -5); } out.push(`${p.titel}: verstoord. ${p.wie} moet opnieuw beginnen.`); }
  else if (o.actie === "zacht"){ p.zacht = true; out.push("We zijn voorbereid: de klap wordt half zo groot."); }
  else if (o.actie === "haast"){ p.volgende = ym(s); out.push(`${p.wie} weet dat we het weten en versnelt.`); }
}
function planPrompt(s, p){
  return `Je bent de Game Master van CHROME LEDGER (Nederlands, droog, cynisch, corporate-noir). ${p.wie} ${p.gang ? "(een syndicaat)" : "(een rivaliserende corporatie)"} begint een plan tegen ${s.player.corp_name}. Het soort plan ligt vast: ${p.soort} (${PLAN_SOORT[p.soort].eindTekst}). Schrijf er een geloofwaardige titel bij, ${p.stappen.length} korte stappen (3-8 woorden, wat ze doen) en een motief van 1 zin, passend bij wat ze over de speler onthouden.
Context: ${JSON.stringify({rivaal_geheugen: ((s.rivals.find(r => r.name === p.wie) || {}).memory || []).slice(-4), speler_producten: (s.producten || []).filter(x => x.status === "markt").map(x => x.naam).slice(0, 5), doel: p.doel})}
Antwoord met alleen JSON: {"titel": "...", "stappen": ["...", "...", "..."], "motief": "..."}`;
}
async function planGM(s){
  if (!live()) return; const p = (s.plannen || []).find(x => !x.gm); if (!p) return; p.gm = true;
  try { const r = await G.sample.json(planPrompt(s, p), {modelTier: "quick"}); if (s !== G.game) return;
    if (r && cStr(r.titel, 90)) p.titel = cStr(r.titel, 90);
    if (r && Array.isArray(r.stappen) && r.stappen.length === p.stappen.length) p.stappen = r.stappen.map((x, i) => cStr(x, 80) || p.stappen[i]);
    if (r && r.motief) p.motief = cStr(r.motief, 200); await persist(Ctx()); }
  catch(e){ foutLog("plan door de GM", e); }
}

/* ===================== 3.10 BEDRIJFSFOCUS: eens per jaar een strategiedag, één vaste koers erbij ===================== */
const FOCUS = {
  lean: {naam: "Lean", tekst: "Alle vaste kosten −5%."},
  juristen: {naam: "Juristen in huis", tekst: "Divisies trekken 10% minder heat."},
  merk: {naam: "Merkbouwer", tekst: "Lanceringen starten 6 punten populairder."},
  talent: {naam: "Talentmagneet", tekst: "De loyaliteit van je directie blijft hoger (+5 doel)."},
  rd: {naam: "Snelle R&D", tekst: "Nieuwe producten zijn een maand eerder klaar (minimaal 1)."},
  abo: {naam: "Abonnementshuis", tekst: "Opzeggers −0,6 procentpunt per maand op elk abonnement."},
  kas: {naam: "Huisbankier", tekst: "Rente op je schuld −2 procentpunt."},
};
const heeftFocus = (s, id) => (s.focus || []).includes(id);
function focusTick(s, ctx){
  const mg = maandenGespeeld(s); if (mg < 12 || mg % 12 !== 0 || (s.keuzes || []).some(k => k.soort === "focus")) return;
  const vrij = Object.keys(FOCUS).filter(k => !heeftFocus(s, k)); if (!vrij.length) return;
  const keus = []; while (keus.length < Math.min(3, vrij.length)){ const k = CH(vrij); if (!keus.includes(k)) keus.push(k); }
  addKeuze(s, ctx, {soort: "focus", van: "Raad van Bestuur", titel: "Strategiedag: welke koers houden we vast?", tekst: `Eens per jaar kiest de raad één koers die blijft. Je hebt er nu ${(s.focus || []).length}${(s.focus || []).length ? ": " + s.focus.map(k => FOCUS[k].naam).join(", ") : ""}. Kies er een bij.`,
    opties: keus.map(k => ({label: FOCUS[k].naam, uitleg: FOCUS[k].tekst + " Blijvend.", eff: {focus: k}})), standaard: 0});
}
function dreigTick(s, ctx, diff){
  s.dreigingen ??= [];
  for (const t of [...s.dreigingen]) if (t.maand <= ym(s)) resolveDreiging(s, ctx, t, diff);
  const vijand = s.rivals.filter(r => r.status === "oorlog" || r.relatie < -30), gangs = (s.gangs || []).filter(g => g.deal === "oorlog");
  const p = 0.025 + 0.035 * vijand.length + 0.035 * gangs.length + (s.statusNiveau || 0) * 0.02 + (s.heat > 50 ? 0.03 : 0);   /* 4.2.1: minder aanslagen */
  if (maandenGespeeld(s) < 3 || R() > p * diff) return;
  const kandidaten = [...vijand.map(r => [{soort: "rivaal", r}, 3]), ...gangs.map(g => [{soort: "gang", g}, 2]), ...s.rivals.filter(r => !vijand.includes(r)).map(r => [{soort: "rivaal", r}, 0.5]), [{soort: "onbekend"}, 1]];
  const o = wpick(kandidaten), ty = wpick(DREIG.filter(x => !x.when || x.when(s)).map(x => [x, x.w]));
  const van = o.soort === "rivaal" ? o.r.name : o.soort === "gang" ? o.g.naam : "een onbekende opdrachtgever";
  const kracht = o.soort === "rivaal" ? clamp(Math.round(rivalPower(s, o.r) / 18), 1, 5) : o.soort === "gang" ? clamp(Math.round(gangKracht(o.g) / 14), 1, 5) : RI(1, 3);
  const t = {id: "d" + hex8(), type: ty.id, label: ty.label, door: ty.door, van, kracht, maand: plusMonths(s, 1)};
  const crewIntel = (s.crew || []).some(m => ["speurder", "fixer"].includes(m.rol) && crewStatus(s, m) !== "opgepakt");
  const warn = crewIntel ? 0.65 : 0.2 + (relV(s, "fixer") >= 30 ? 0.3 : 0);
  if (R() < warn){
    s.dreigingen.push(t); const af = r1(3 * kracht * diff), doel0 = 8 + verdediging(s, t);
    addKeuze(s, ctx, {soort: "dreig_" + t.id, van: crewIntel ? "Je crew" : "Zes (fixer)", titel: `Er is een opdracht op ons gezet`,
      tekst: `Via via: ${van} heeft ${ty.door} ingehuurd voor ${ty.label} tegen ons. Het gebeurt volgende maand. Hun sterkte: ${kracht}. Nu moeten ze 2d6+${kracht} ≥ ${doel0} gooien (${kans2d6(kracht, doel0)}% kans).`, opties: [
      {label: "Crew en beveiliging klaarzetten", uitleg: `Gratis. Verdediging +2 (hun kans ${kans2d6(kracht, doel0 + 2)}%).`, eff: {dreiging: {id: t.id, extra: 2}, tekst: "Iedereen weet wat er komt."}},
      {label: "Extra beveiliging · €4M", kost: 4, uitleg: `Verdediging +3 (hun kans ${kans2d6(kracht, doel0 + 3)}%).`, eff: {dreiging: {id: t.id, extra: 3}, tekst: "Extra ploegen, extra camera's, een paar honden."}},
      {label: `De opdracht afkopen · €${af}M`, kost: af, uitleg: "Via een fixer de klus overbieden. Het gaat niet door.", eff: {dreiging: {id: t.id, annuleer: true}, tekst: "De huurlingen hebben een betere aanbieding gekregen. Van ons."}},
      {label: "Niets doen", uitleg: `Hun kans blijft ${kans2d6(kracht, doel0)}%.`, eff: {}}], standaard: 3});
  } else { t.verrassing = true; resolveDreiging(s, ctx, t, diff); }
}
function resolveDreiging(s, ctx, t, diff){
  s.dreigingen = (s.dreigingen || []).filter(x => x.id !== t.id);
  s.keuzes = (s.keuzes || []).filter(k => k.soort !== "dreig_" + t.id);
  const doel = 8 + verdediging(s, t), r = rol2d6(t.kracht, doel);
  addRoll(s, `Aanslag (${t.label}) in opdracht van ${t.van}: ${r.txt} → ${r.ok ? "RAAK" : "AFGESLAGEN"}`);
  const rv = s.rivals.find(x => x.name === t.van);
  if (!r.ok){
    (s.stats ??= {}).aanslagenAf = (s.stats.aanslagenAf || 0) + 1;
    if (rv){ relShift(rv, -5); remember(rv, s, `${t.label} tegen de speler mislukte`); }
    for (const m of (s.crew || []).filter(m => m.rol === "huurling" && crewStatus(s, m) !== "opgepakt")) m.xp += 1;
    mail(ctx, s, "Head of Security", `Aanslag afgeslagen: ${t.label}`, `${t.door[0].toUpperCase() + t.door.slice(1)}, ingehuurd door ${t.van}, probeerden ${t.label}. Hun worp: ${r.txt}. Onze verdediging hield.${t.verrassing ? " We zagen het niet aankomen, en toch." : ""}`, "HOOG");
    ctx.rep.push(`Aanslag van ${t.van} afgeslagen`); return;
  }
  let txt;
  if (t.type === "sabotage"){ const l = r1(RI(4, 10) * diff * clamp(omvang(s), 0.5, 3)); s.cash = r1(s.cash - l); const pr = CH((s.producten || []).filter(p => p.status === "markt")); if (pr) pr.pop = Math.max(3, pr.pop - 10);
    txt = `Brand in een productiehal: €${l}M schade${pr ? `, en ${pr.naam} is een maand slecht leverbaar (populariteit −10)` : ""}.`; }
  else if (t.type === "data"){ const d = CH(s.divisions); const l = r1(RI(2, 5)); s.cash = r1(s.cash - l); if (d && s.market[d.type]) s.market[d.type].player *= 0.9; if (rv && d && s.market[d.type]) s.market[d.type].rivals[rv.name] = (s.market[d.type].rivals[rv.name] || 0) + 0.02;
    txt = `Klantdata en ontwerpen van ${d ? divNaam(d) : "het bedrijf"} zijn gestolen. Marktaandeel −10%, €${l}M aan herstel.`; }
  else if (t.type === "ontvoering"){ const m = CH((s.crew || []).filter(x => ["vrij", "bezig"].includes(crewStatus(s, x)))); if (m){ m.uit = plusMonths(s, 2); m.uitReden = "ontvoerd"; m.loyaliteit = clamp(m.loyaliteit - 10);
      const lg = r1(4 + m.niveau * 2);
      addKeuze(s, ctx, {soort: "losgeld_" + m.id, van: "Onbekend nummer", titel: `${m.naam} is ontvoerd`, tekst: `We hebben ${m.naam}. €${lg}M en je krijgt je mens terug, heel. Anders over twee maanden, misschien.`, opties: [
        {label: `Losgeld · €${lg}M`, kost: lg, uitleg: "Meteen terug, loyaliteit +15.", eff: {crew_vrij: m.id, tekst: `${m.naam} is terug, met een verhaal.`}},
        {label: "Wachten", uitleg: "Twee maanden kwijt, loyaliteit −15.", eff: {crew_loy: {[m.id]: -15}}}], standaard: 1});
      txt = `${m.naam} is van straat geplukt.`; } else { s.morale = clamp(s.morale - 3); txt = "Een poging tot ontvoering op het hoofdkantoor. Iedereen is bang. Morale −3."; } }
  else if (t.type === "omkoping"){ const m = (s.crew || []).filter(x => x.loyaliteit < 55 && x.trait !== "trouw").sort((a, b) => a.loyaliteit - b.loyaliteit)[0];
    if (m){ s.crew = s.crew.filter(x => x !== m); txt = `${m.naam} (${CREW_ROLLEN[m.rol].label}) is omgekocht en vertrokken${rv ? ` naar ${rv.name}` : ""}.`; } else { txt = "Ze probeerden je crew om te kopen. Niemand ging mee, deze keer."; } }
  else if (t.type === "rd"){ const p = (s.producten || []).find(x => x.status === "ontwikkeling" || x.verbetering);
    if (p){ if (p.status === "ontwikkeling") p.eta += 2; else p.verbetering += 2; txt = `Inbraak bij R&D: de plannen van ${p.naam} zijn gestolen en het werk ligt twee maanden terug.`; }
    else { const pj = s.projects[0]; if (pj){ pj.eta_months += 1; txt = `Inbraak bij een bouwproject: ${pj.name} loopt een maand vertraging op.`; } else { s.cash = r1(s.cash - 4); txt = "Inbraak bij R&D: €4M aan apparatuur weg."; } } }
  else { s.reputation = clamp(s.reputation - 5); txt = "Een lastercampagne: anonieme dossiers, nepinterviews, een hashtag. Reputatie −5."; }
  (s.stats ??= {}).aanslagenRaak = (s.stats.aanslagenRaak || 0) + 1;
  if (rv) remember(rv, s, `liet ${t.label} uitvoeren tegen de speler`);
  mail(ctx, s, "Head of Security", `Aanslag: ${t.label}`, `${txt}\n\nUitgevoerd door ${t.door}, in opdracht van ${t.van}. Hun worp: ${r.txt}.${t.verrassing ? " We zagen het niet aankomen: met een speurder of fixer in je crew hoor je dit soort dingen vaker van tevoren." : ""}`, "KRITIEK");
  ctx.rep.push(`Aanslag (${t.label}) door ${t.van}`);
}

/* ===================== 2.1 PROJECTEN KUNNEN MISLUKKEN ===================== */
function projectDoel(s){ return 5 + (s.heat > 50 ? 1 : 0) + (s.morale < 40 ? 1 : 0); }
function projectRisico(s){ const d = projectDoel(s); return {vertraging: 100 - kans2d6(0, d) - 3, mislukt: 3, doel: d}; }
function migrate21(s){
  if (!s.player || !s.districts || !s.setup_done) return;
  s.dreigingen ??= [];
  if (!s.producten){ startProducten(s); }
}

/* ===================== 2.2 DOEL, SCORE EN EINDE ===================== */
const SPEL_LENGTE = {kort: {label: "10 jaar", maanden: 120}, normaal: {label: "20 jaar", maanden: 240}, eindeloos: {label: "Eindeloos", maanden: 0}};
const WIN_WAARDE = 8000, HEG_PCT = 60, HEG_N = 3, RIVAAL_DOEL = 3, CZ_PCT = 60; /* 6.3: corporate zone */
const WIN_LENGTE = {kort: 0.9, normaal: 1.55, eindeloos: 2.1}; /* 5.0: was 0,8 / 1,38 / 1,9; het spel was na de kostenverlagingen te makkelijk. 5.6.1: hoger (1,8) testte geen verschil, dus zo gelaten */
const winWaardeVoor = lengte => Math.round(WIN_WAARDE * (WIN_LENGTE[lengte] || 1) / 100) * 100;
const winWaarde = s => Math.round(winWaardeVoor(s.player.lengte) * inst(s, "winst") / 100) * 100;
const RIVAAL_MULT = {Casual: 0.85, Realistisch: 1, Genadeloos: 1.2};
const SCORE_MULT = {Casual: 0.8, Realistisch: 1, Genadeloos: 1.4};
const spelLengte = s => (SPEL_LENGTE[s.player.lengte] || SPEL_LENGTE.normaal).maanden;
function contPcts(s){ return regionDominance(s).map(r => ({naam: r.naam, pct: (r.shares.find(x => x.o === "player") || {}).pct || 0})).sort((a, b) => b.pct - a.pct); }
function rivalenWeg(s){ const st = s.flags.start_rivalen || []; return {weg: st.filter(n => !s.rivals.some(r => r.name === n)).length, van: st.length}; }
function doelen(s){
  const w = playerValue(s), WW = winWaarde(s), cp = contPcts(s), heg = cp.filter(c => c.pct >= HEG_PCT).length, rw = rivalenWeg(s), RD = Math.min(RIVAAL_DOEL, rw.van), L = spelLengte(s), n = maandenGespeeld(s);
  const out = [
    {id: "economisch", naam: "Economische overwinning", tekst: `Bedrijfswaarde van €${WW}M`, pct: Math.round(clamp(w / WW * 100, 0, 100)), klaar: w >= WW, nu: `€${Math.round(w)}M`},
    {id: "hegemonie", naam: "Hegemonie", tekst: `${HEG_PCT}% of meer op ${HEG_N} continenten`, pct: Math.round(clamp(cp.slice(0, HEG_N).reduce((a, c) => a + Math.min(HEG_PCT, c.pct), 0) / (HEG_PCT * HEG_N) * 100, 0, 100)), klaar: heg >= HEG_N, nu: cp.slice(0, 3).map(c => `${c.naam} ${c.pct}%`).join(", ")},
    {id: "uitschakeling", naam: "Marktmeester", tekst: `${RD} van de ${rw.van} oorspronkelijke rivalen uitgeschakeld (overgenomen, failliet of kapotgemaakt)`, pct: RD ? Math.round(clamp(rw.weg / RD, 0, 1) * 100) : 0, klaar: RD > 0 && rw.weg >= RD, nu: `${rw.weg} van ${RD}`},
  ];
  { const thuis = (s.districts.find(x => x.id === s.player.home_district) || {}).continent, sp = spanningVan(s, thuis), aand = (cp.find(c => c.naam === thuis) || {}).pct || 0; /* 6.3: corporate zone */
    out.push({id: "corpzone", naam: "Corporate zone", tekst: `${thuis} wordt een corporate zone (spanning 90+) en jij hebt er ${CZ_PCT}% of meer`, pct: Math.round(clamp(Math.min(sp / 90, aand / CZ_PCT), 0, 1) * 100), /* 6.4: de zwakste voorwaarde telt */ klaar: sp >= 90 && aand >= CZ_PCT, nu: `spanning ${Math.round(sp)}, aandeel ${aand}%`}); }
  if (L) out.push({id: "termijn", naam: "Einde van de termijn", tekst: `Na ${L / 12} jaar telt je score`, pct: Math.round(clamp(n / L * 100, 0, 100)), klaar: n >= L, nu: `nog ${Math.max(0, L - n)} maanden`});
  return out;
}
function score(s, einde){
  const cp = contPcts(s), rw = rivalenWeg(s);
  /* 3.4: waarde telt met de wortel, zodat de rest meetelt; wie verliest, verliest ook de waarde van zijn bedrijf */
  const dom = cp.reduce((a, c) => a + (c.pct >= 80 ? 400 : c.pct >= HEG_PCT ? 250 : c.pct >= 25 ? 60 : 0), 0), n = maandenGespeeld(s);
  const verloren = !!einde && !einde.startsWith("OVERWINNING") && einde !== "EINDE TERMIJN", gewonnen = !!einde && einde.startsWith("OVERWINNING");
  const L = spelLengte(s) || 240, delen = [[verloren ? "Bedrijfswaarde (verloren met het bedrijf)" : "Bedrijfswaarde (40 × √waarde)", verloren ? 0 : Math.round(40 * Math.sqrt(Math.max(0, playerValue(s))))], ["Dominantie", dom], ["Reputatie", Math.round(s.reputation * 6)],
    ["Jaren overleefd", Math.round(n / 12 * 60)], ["Rivalen uitgeschakeld", rw.weg * 300], ["Status", (s.statusNiveau || 0) * 120]];
  if (gewonnen && n < L) delen.push(["Tempo (maanden voor het einde × 6)", (L - n) * 6]);
  const basis = delen.reduce((a, [, v]) => a + v, 0), mult = Math.round((SCORE_MULT[s.player.difficulty] || 1) * (s.player.instelScore ?? 1) * 100) / 100;
  const eind = !einde ? 1 : gewonnen ? 1.25 : einde === "EINDE TERMIJN" ? 1 : 0.75;
  return {delen, basis, mult, eind, totaal: Math.round(basis * mult * eind)};
}
function eindCheck(s){
  const d = doelen(s).find(x => x.klaar && x.id !== "termijn");
  if (d) return "OVERWINNING: " + ({economisch: "ECONOMISCHE MACHT", hegemonie: "HEGEMONIE", uitschakeling: "MARKTMEESTER", corpzone: "CORPORATE ZONE"}[d.id] || d.naam.toUpperCase());
  if (doelen(s).some(x => x.id === "termijn" && x.klaar)) return "EINDE TERMIJN";
  return "actief";
}
function statsTick(s){
  const st = s.stats ??= {piekWaarde: 0, bestePlek: 99, hits: 0, flops: 0, aanslagenAf: 0, aanslagenRaak: 0, klussen: 0, oorlogen: 0};
  st.piekWaarde = Math.max(st.piekWaarde, playerValue(s)); st.piekCash = Math.max(st.piekCash || 0, s.cash);
  try { st.bestePlek = Math.min(st.bestePlek, wereldVM(s).plek); } catch(e){ foutLog("beste plek bijhouden", e); }
}
function eindRapport(s, ctx, status){
  const sc = score(s, status), st = s.stats || {};
  s.eind = {status, score: sc.totaal, delen: sc.delen, mult: sc.mult, eindMult: sc.eind, datum: ym(s), maanden: maandenGespeeld(s), waarde: playerValue(s), stats: {...st}};
  const tabel = sc.delen.map(([k2, v]) => `| ${k2} | ${v} |`).join("\n");
  mail(ctx, s, "Raad van Bestuur", `Eindrapport: ${status}`, `# Eindrapport ${s.player.corp_name}\n\n**${status}** na ${Math.floor(maandenGespeeld(s) / 12)} jaar en ${maandenGespeeld(s) % 12} maanden.\n\n| Onderdeel | Punten |\n|---|---|\n${tabel}\n| Moeilijkheid (${s.player.difficulty}) | ×${sc.mult} |\n| ${status.startsWith("OVERWINNING") ? "Overwinning" : status === "EINDE TERMIJN" ? "Termijn uitgediend" : "Verloren"} | ×${sc.eind} |\n| **Score** | **${sc.totaal}** |\n\n` +
    `Hoogste waarde: €${Math.round(st.piekWaarde || 0)}M · beste plek op de ranglijst: ${st.bestePlek < 99 ? st.bestePlek : "-"} · producthits: ${st.hits || 0} · flops: ${st.flops || 0} · aanslagen afgeslagen: ${st.aanslagenAf || 0} van ${(st.aanslagenAf || 0) + (st.aanslagenRaak || 0)}.`, "KRITIEK");
}

/* ===================== 2.2 GEZONDHEID: waarom morale en heat bewegen ===================== */
function gezondheidStart(s){ return {m0: s.morale, h0: s.heat, mDelen: [], hDelen: []}; }
function gezondheidEind(s, g, ctx){
  const rest = (v0, v1, delen) => { const d = r1(v1 - v0 - delen.reduce((a, [, v]) => a + v, 0)); return Math.abs(d) >= 0.5 ? [...delen, ["Gebeurtenissen, keuzes en oorlog", d]] : delen; };
  s.gezondheid = {morale: {van: r1(g.m0), naar: r1(s.morale), delen: rest(g.m0, s.morale, g.mDelen).map(([k2, v]) => [k2, r1(v)])}, heat: {van: r1(g.h0), naar: r1(s.heat), delen: rest(g.h0, s.heat, g.hDelen).map(([k2, v]) => [k2, r1(v)])}};
  const f = s.flags;
  if (s.morale < 30 && !(f.waarsch_morale)){ f.waarsch_morale = true; mail(ctx, s, "HR", "Morale is gevaarlijk laag", `Morale staat op ${Math.round(s.morale)}. Onder de 10 komt de raad in opstand: twee maanden zo en u bent uw bedrijf kwijt.\n\nWat helpt: salaris naar marktconform of hoog (Bedrijf), bonussen in de cultuur, winst draaien, een oorlog beëindigen, Bram Oosterhout om een gunst vragen (Mensen), of een directielid laten promoveren.`, "KRITIEK"); }
  if (s.morale >= 40) delete f.waarsch_morale;
  if (s.heat > 65 && !(f.waarsch_heat)){ f.waarsch_heat = true; mail(ctx, s, "Juridische Zaken", "Heat wordt gevaarlijk", `Heat staat op ${Math.round(s.heat)}. Boven de 90 volgt een razzia: twee maanden zo en het is voorbij.\n\nWat helpt: een netrunner sporen laten wissen of een spindokter een schandaal laten begraven (Crew), de commissaris om een gunst vragen (Mensen), invloed besteden aan 'Rust in de straat' (Kaart), minder smokkel en illegale klussen, of een strengere ethiek.`, "KRITIEK"); }
  if (s.heat <= 55) delete f.waarsch_heat;
}

function migrate22(s){
  if (!s.player || !s.setup_done) return;
  s.player.lengte ??= "normaal"; s.maanden ??= (s.history || []).length; vraagInit(s); rivalProductInit(s);
  s.flags.start_rivalen ??= s.rivals.slice(0, 3).map(r => r.name);
  s.stats ??= {piekWaarde: 0, bestePlek: 99, hits: 0, flops: 0, aanslagenAf: 0, aanslagenRaak: 0, klussen: 0, oorlogen: 0};
  s.log = (s.log || []).slice(-200); s.nieuws = (s.nieuws || []).slice(0, 50);
}

/* ===================== 2.2 LEVENDE PRODUCTEN: aard, prijs, recensies, gebeurtenissen ===================== */
const PRODUCT_AARD = {
  wapen: {label: "Wapen", eff: {macht: 2.5, heat: 0.5, straat: 0.4, politie: -0.3}, tekst: "geeft macht en aanzien op straat, trekt aandacht van de politie"},
  medisch: {label: "Medisch", eff: {reputation: 0.3, stad: 0.3}, tekst: "verbetert je reputatie en je band met overheden"},
  implantaat: {label: "Implantaat", eff: {straat: 0.3, reputation: 0.1, heat: 0.15}, tekst: "populair op straat, met een randje risico"},
  data: {label: "Data en media", eff: {invloed: 0.3}, tekst: "levert invloed op: wie de feeds heeft, heeft de mensen"},
  beveiliging: {label: "Beveiliging", eff: {macht: 2, politie: 0.2}, tekst: "maakt je sterker tegen aanvallen en aanslagen"},
  smokkel: {label: "Smokkelwaar", eff: {zwart: 0.8, heat: 0.4, politie: -0.2}, tekst: "levert zwart geld op en heat"},
  logistiek: {label: "Logistiek", eff: {vakbond: 0.2, morale: 0.1}, tekst: "veel banen: de bond en je mensen merken het"},
  financieel: {label: "Financieel", eff: {reputation: 0.1, stad: 0.1, invloed: 0.1}, tekst: "geeft je bedrijf gewicht in de kantoren waar het telt"},
  orbitaal: {label: "Orbitaal", eff: {invloed: 0.4, reputation: 0.2}, tekst: "prestige en invloed"},
  consument: {label: "Consumentenproduct", eff: {reputation: 0.15}, tekst: "bekendheid bij het grote publiek"},
};
const SECTOR_AARD = {"Biotech": "medisch", "Cyberware": "implantaat", "Logistiek": "logistiek", "Media & Data": "data", "Private Security": "beveiliging", "Financieel": "financieel", "Smokkel": "smokkel", "Orbitaal": "orbitaal", "Weapon Manufacturing": "wapen"};
function aardVan(type, naam){
  if (SECTOR_AARD[type]) return SECTOR_AARD[type];
  const t = `${type} ${naam || ""}`;
  if (/wapen|weapon|arms|gun|firearm|ammo|munitie|munition|defensi|defen[cs]e|geweer|pistool|rifle|militair|military/i.test(t)) return "wapen";
  if (/implant|cyber|prothes|neur|chrome|chroom/i.test(t)) return "implantaat";
  if (/logist|transport|freight|shipping|cargo|vracht|haven/i.test(t)) return "logistiek";
  if (/financ|bank|crypto|invest|verzeker|insurance/i.test(t)) return "financieel";
  if (/orbit|space|ruimte|satelliet|satellite|raket|rocket/i.test(t)) return "orbitaal";
  if (/drug|pharma|medic|zorg|kliniek|clinic|health|bio|trauma|ambulance/i.test(t)) return "medisch";
  if (/drone|bewak|beveilig|security|guard|merc|huurling/i.test(t)) return "beveiliging";
  if (/data|media|game|ai|software|stream|nieuws/i.test(t)) return "data";
  if (/smokkel|zwart|contraband/i.test(t)) return "smokkel";
  return "consument";
}
/* 3.3.1: abonnementen draaien op abonnees, niet op populariteit */
const isAbo = p => !!p && p.soort === "abonnement";
function bereik(p){ return isAbo(p) && p.abo != null ? clamp(Math.round(p.abo), 0, 110) : p.pop; }
function aboChurn(p){ const pr = clamp((prijsF(p) - 1) * 0.03 * elast(p), -0.01, 0.03);
  return clamp(0.055 - 0.007 * p.kwaliteit + pr - (p.loyaal ? 0.012 : 0) - (G.game && heeftFocus(G.game, "abo") ? 0.006 : 0) + (p.trait === "gevoelig" ? 0.01 : 0) - (p.trait === "verslavend" ? 0.015 : 0) - (p.trait === "cult" ? 0.01 : 0), 0.012, 0.09); }
const loyKost = p => r1(0.5 + (p.abo || 0) / 50);
function aboTick(s, p, ctx){ if (p.abo == null) p.abo = Math.round(p.pop * 0.8);
  if (p.loyaal){ const k = loyKost(p); s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; }
  if (ctx && p.abo > 15 && R() < 0.03 && !(s.keuzes || []).some(k => k.soort === "abo_" + p.id)){ const tb = r1(2 + p.abo / 20), gm = r1(p.abo / 12);
    addKeuze(s, ctx, {soort: "abo_" + p.id, van: "Klantenservice", titel: `Een concurrent lokt abonnees van ${p.naam} weg`, tekst: `Een rivaal biedt onze ${Math.round(p.abo * 10000).toLocaleString("nl-NL")} abonnees drie maanden gratis als ze overstappen. De opzeggingen lopen al binnen.`, opties: [
      {label: `Tegenbod · €${tb}M`, kost: tb, uitleg: "Een korting voor wie blijft. Bijna iedereen blijft (−2%).", eff: {product: {[p.id]: {abo: -2}}}},
      {label: `Gratis maand voor iedereen · −€${gm}M`, uitleg: "Een maand inkomsten weg, maar maar 4% vertrekt en het product wordt populairder (+5).", eff: {cash: -gm, product: {[p.id]: {abo: -4, pop: 5}}}},
      {label: "Laten gaan", uitleg: "Ongeveer 12% van je abonnees vertrekt.", eff: {product: {[p.id]: {abo: -12}}}}], standaard: 2}); }
  const vf = vraagFactor(s, p.aard || aardVan(p.type, p.naam)), inn = r1(p.pop / 100 * (4 + Math.max(0, 8 - (p.leeftijd || 0)) * 0.5) * vf * volF(p)), uit = r1(p.abo * aboChurn(p));
  p.abo = r1(clamp(p.abo - uit + inn, 0, 140)); p.aboIn = inn; p.aboUit = uit; }
const PRIJS = {budget: {label: "Budget", pop: 12, gewicht: 0.8, rep: -0.05}, standaard: {label: "Standaard", pop: 0, gewicht: 1, rep: 0}, premium: {label: "Premium", pop: -10, gewicht: 1.35, rep: 0.1}};

/* ===================== 4.0 ECHTE PRODUCTEN: eigenschappen, prijs per stuk, marge, afzet, levensfase, marktaandeel, capaciteit ===================== */
const STUK = {wapen: {eenheid: "stuks", prijs: 320}, medisch: {eenheid: "doses", prijs: 20}, implantaat: {eenheid: "implantaten", prijs: 1600}, data: {eenheid: "licenties", prijs: 6},
  beveiliging: {eenheid: "diensten", prijs: 380}, smokkel: {eenheid: "ladingen", prijs: 260}, logistiek: {eenheid: "zendingen", prijs: 9}, financieel: {eenheid: "rekeningen", prijs: 4},
  orbitaal: {eenheid: "ladingplaatsen", prijs: 8500}, consument: {eenheid: "stuks", prijs: 12}};
const SPECS = {wapen: ["Vuurkracht", "Betrouwbaarheid", "Onopvallendheid"], medisch: ["Werkzaamheid", "Veiligheid", "Herstel"], implantaat: ["Prestatie", "Afstoting", "Levensduur"],
  data: ["Bereik", "Nauwkeurigheid", "Privacy"], beveiliging: ["Reactietijd", "Dekking", "Discretie"], smokkel: ["Snelheid", "Onzichtbaarheid", "Volume"], logistiek: ["Snelheid", "Betrouwbaarheid", "Bereik"],
  financieel: ["Rendement", "Risico", "Gemak"], orbitaal: ["Lading", "Precisie", "Kosten"], consument: ["Design", "Gemak", "Duurzaamheid"]};
function hashN(str, i){ let h = 7; for (const ch of String(str) + ":" + i) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
/* 4.4.1: onderdelenlijst. Per soort drie onderdelen (deel van de kostprijs, gekoppelde eigenschap, sectoren van mogelijke leveranciers); de rest (20%) is arbeid.
   Goedkoop: −30% kosten, −1 op die eigenschap. Premium: +35% kosten, +1. Standaard kost precies wat een product vóór 4.4.1 kostte. */
const ONDERDELEN = {
  wapen: [["Loop en mechaniek", 0.35, 1, ["Weapon Manufacturing", "Private Security", "Cyberware"]], ["Munitie en lading", 0.25, 0, ["Weapon Manufacturing", "Private Security", "Smokkel"]], ["Behuizing en demping", 0.2, 2, ["Weapon Manufacturing", "Cyberware"]]],
  medisch: [["Werkzame stof", 0.4, 0, ["Biotech"]], ["Zuivering en tests", 0.25, 1, ["Biotech"]], ["Nazorgpakket", 0.15, 2, ["Biotech", "Logistiek"]]],
  implantaat: [["Neurale chip", 0.4, 0, ["Cyberware"]], ["Biocompatibele coating", 0.25, 1, ["Biotech"]], ["Voeding en behuizing", 0.15, 2, ["Cyberware"]]],
  data: [["Servers en opslag", 0.35, 0, ["Media & Data"]], ["Datasets", 0.25, 1, ["Media & Data"]], ["Versleuteling", 0.2, 2, ["Media & Data", "Cyberware"]]],
  beveiliging: [["Voertuigen en drones", 0.35, 0, ["Private Security", "Logistiek"]], ["Sensoren en camera's", 0.25, 1, ["Cyberware"]], ["Training en screening", 0.2, 2, ["Private Security"]]],
  smokkel: [["Voertuigen", 0.35, 0, ["Logistiek"]], ["Valse papieren", 0.25, 1, ["Smokkel", "Media & Data"]], ["Opslag en containers", 0.2, 2, ["Logistiek"]]],
  logistiek: [["Voertuigen en brandstof", 0.4, 0, ["Logistiek"]], ["Tracking en software", 0.2, 1, ["Media & Data"]], ["Depots", 0.2, 2, ["Logistiek"]]],
  financieel: [["Rekenkracht", 0.3, 0, ["Media & Data"]], ["Compliance en verzekering", 0.3, 1, ["Financieel"]], ["App en klantenservice", 0.2, 2, ["Media & Data"]]],
  orbitaal: [["Lanceerraket", 0.45, 0, ["Orbitaal", "Logistiek"]], ["Navigatie", 0.2, 1, ["Cyberware"]], ["Brandstof", 0.15, 2, ["Orbitaal", "Logistiek"]]],
  consument: [["Ontwerp en materiaal", 0.35, 0, ["Cyberware", "Media & Data"]], ["Elektronica", 0.25, 1, ["Cyberware"]], ["Verpakking en levering", 0.2, 2, ["Logistiek"]]]};
const ARBEID = 0.2, DEEL_KWAL = {goedkoop: {label: "Goedkoop", kost: 0.7, spec: -1}, standaard: {label: "Standaard", kost: 1, spec: 0}, premium: {label: "Premium", kost: 1.35, spec: 1}};
const delenVan = p => ONDERDELEN[p.aard || aardVan(p.type, p.naam)] || ONDERDELEN.consument;
const deelKwal = (p, i) => DEEL_KWAL[((p.delen || [])[i] || {}).kwal] ? p.delen[i].kwal : "standaard";
const EIGEN_KORTING = 0.85, zelfKost = s => r1(4 * (DIFF[(s && s.player.difficulty)] || 1)); /* 4.7.4: onderdelen zelf maken: eenmalige investering, daarna 15% goedkoper en geen leverancier */
const eigenDeel = (p, i) => !!((p.delen || [])[i] || {}).eigen;
const kostFactor = p => extraF(p, "kosten") * (ARBEID + delenVan(p).reduce((t, d, i) => t + d[1] * DEEL_KWAL[deelKwal(p, i)].kost * (eigenDeel(p, i) ? EIGEN_KORTING : 1), 0) * (p.matF ?? 1) * ((p.tech || 0) >= 2 ? 0.92 : 1)); /* 5.12: grondstofprijzen werken op het onderdelendeel; 5.14: onderzoek niveau 2 −8% */
function leverancier(s, p, i){ if (!s) return null; const D = delenVan(p)[i], x = ((p.delen ??= [])[i] ??= {kwal: "standaard"}), B = s.bedrijven || []; if (x.eigen) return null;
  let b = x.lev && B.find(y => y.id === x.lev); if (!b){ const pool = B.filter(y => D[3].includes(y.sector)), lijst = pool.length ? pool : B; b = lijst.length ? lijst[hashN(p.id, i) % lijst.length] : null; x.lev = b ? b.id : null; }
  return b; }
function leverancierWeg(s, ctx, b){ for (const p of s.producten || []) (p.delen || []).forEach((x, i) => { if (x && x.lev === b.id){ x.lev = null; const nb = leverancier(s, p, i); if (ctx) ctx.rep.push(`Leverancier ${b.naam} van ${p.naam} failliet; ${nb ? nb.naam : "de eigen werkplaats"} neemt het over`); } }); }
/* 4.5: defecten. Percentage per product: basis per soort × kwaliteit × onderdelen × eigenschap × bètatest. Garantie kost dat percentage van de omzet;
   boven 5% defecten kan elke maand een terugroepactie nodig zijn. */
const DEFECT_BASIS = {wapen: 2, medisch: 1.5, implantaat: 3, data: 1, beveiliging: 1.5, smokkel: 4, logistiek: 2, financieel: 0.5, orbitaal: 3, consument: 3};
const DEFECT_DEEL = {goedkoop: 1.5, standaard: 1, premium: 0.7};
function defectDelen(p){ return delenVan(p).reduce((t, d, i) => t + d[1] * DEFECT_DEEL[deelKwal(p, i)], 0) / 0.8; }
function defectPct(p){ const a = p.aard || aardVan(p.type, p.naam), q = clamp(1.6 - 0.2 * (p.kwaliteit || 3), 0.6, 1.4), tr = p.trait === "gevoelig" ? 1.6 : p.trait === "goedkoop" ? 1.5 : 1;
  return Math.round((DEFECT_BASIS[a] ?? 2) * q * defectDelen(p) * tr * (p.beta ? 0.85 : 1) * extraF(p, "betrouwbaar") * 10) / 10; }
const DEFECT_DREMPEL = 5;
/* 6.13: edities. Een product krijgt een opvolger (Editie 2, 3, ...): je bespreekt met de GM wat er beter of bij moet, de engine rekent kosten, duur en kans. Bij de lancering blijft het hetzelfde product (contracten, geschiedenis), met een nieuwe naam, extra's en een sprong in kwaliteit. */
const EXTRA_SOORT = {omzet: {label: "Meer verkoop", uitleg: "+6% omzet", f: 1.06}, populariteit: {label: "Hype", uitleg: "+6 populariteit bij de lancering", pop: 6}, betrouwbaar: {label: "Betrouwbaarder", uitleg: "−15% defecten", f: 0.85}, kosten: {label: "Goedkoper te maken", uitleg: "−6% productiekosten", f: 0.94}, imago: {label: "Beter imago", uitleg: "reputatie +2 bij de lancering", rep: 2}};
const EXTRA_MAX = 8, ROMEINS = ["", "", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function extraF(p, soort){ const n = (p && p.extras || []).filter(x => x.soort === soort).length; if (!n) return 1; const E = EXTRA_SOORT[soort]; return E && E.f ? Math.pow(E.f, n) : 1; }
const editieNr = p => p.editie || 1;
const basisNaam = p => p.basisNaam || String(p.naam || "").replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)$/, "");
function editieKosten(s, p, v){ const dif = DIFF[s.player.difficulty] || 1, sch = {klein: 0.7, groot: 1, vlag: 1.6}[p.schaal || "groot"] || 1, ne = v.extras.length, kw = v.kwPlus;
  const d = s.divisions.find(x => divNaam(x) === p.divisie) || {level: 1};
  return {kost: r1((6 + 4 * ne + 10 * kw) * dif * sch), maanden: clamp(2 + kw + Math.floor(ne / 2), 2, 6), doel: 6 + kw + (ne >= 3 ? 1 : 0), bonus: Math.ceil(d.level / 2)}; }
function editieKans(s, p, v){ const k = editieKosten(s, p, v); return kans2d6(k.bonus, k.doel); }
const EXTRA_WOORD = [[/goedko|kosten|efficie|productie|sneller te maken|lean/i, "kosten"], [/betrouw|robuust|sterk|duurza|defect|veilig|bescherm|licht|comfort/i, "betrouwbaar"], [/hype|marketing|design|camo|stijl|kleur|look|merk|limited|luxe/i, "populariteit"], [/imago|ethisch|schoon|groen|legaal|transparant/i, "imago"]];
function editieVoorstelLokaal(s, p, tekst){ const delen = String(tekst || "").split(/,|;|\n|\ben\b|\+/i).map(x => x.trim()).filter(x => x.length >= 3).slice(0, 4);
  const extras = (delen.length ? delen : [tekst || "Nieuwe functies"]).map(x => { const w = EXTRA_WOORD.find(([re]) => re.test(x)); return {naam: cStr(x[0].toUpperCase() + x.slice(1), 50), uitleg: "", soort: w ? w[1] : "omzet"}; });
  const kwPlus = p.kwaliteit >= 5 ? 0 : /beter|upgrade|generatie|kwaliteit|krachtig|sterker|geavanceerd|pro\b/i.test(tekst) ? 1 : 0;
  const n = editieNr(p) + 1; return {naam: `${basisNaam(p)} ${ROMEINS[n] || n}`, pitch: `Editie ${n} van ${basisNaam(p)}: ${extras.map(e => e.naam.toLowerCase()).join(", ")}.`, extras, kwPlus, risico: "Een nieuwe editie moet opnieuw gekeurd worden en de vorige editie verdwijnt uit de schappen.", lokaal: true}; }
function cleanEditie(r, s, p){ r = r && typeof r === "object" ? r : {}; const n = editieNr(p) + 1;
  const extras = (Array.isArray(r.extras) ? r.extras : []).slice(0, 4).map(x => ({naam: cStr(x && x.naam, 50), uitleg: cStr(x && x.uitleg, 160), soort: EXTRA_SOORT[x && x.soort] ? x.soort : "omzet"})).filter(x => x.naam);
  return {naam: cStr(r.naam, 40) || `${basisNaam(p)} ${ROMEINS[n] || n}`, pitch: cStr(r.pitch, 500), extras: extras.length ? extras : [{naam: "Nieuwe functies", uitleg: "", soort: "omzet"}], kwPlus: Math.round(clamp(+r.kwaliteit_plus || 0, 0, Math.min(2, 5 - p.kwaliteit))), risico: cStr(r.risico, 200)}; }
function editiePrompt(s, p, tekst){ const n = editieNr(p) + 1;
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie (taal: Nederlands, toon: droog, cynisch, corporate-noir). De CEO van ${s.player.corp_name} wil editie ${n} van een bestaand product: "${p.naam}" (${PRODUCT_AARD[p.aard || aardVan(p.type, p.naam)].label}, kwaliteit ${p.kwaliteit}/5, schaal ${p.schaal || "groot"}${p.pitch ? `, nu: ${cStr(p.pitch, 300)}` : ""}${(p.extras || []).length ? `, heeft al: ${p.extras.map(x => x.naam).join(", ")}` : ""}).
Wat de CEO wil: "${tekst}"
Werk dit uit tot een opvolger, zo dicht mogelijk bij wat de CEO bedoelt. Geef 1 tot 4 extra's: concrete nieuwe dingen of verbeteringen. Elke extra krijgt één soort effect: "omzet" (meer verkoop), "populariteit" (hype bij de lancering), "betrouwbaar" (minder defecten), "kosten" (goedkoper te maken) of "imago" (reputatie). "kwaliteit_plus" 0, 1 of 2: alleen 2 als het echt een nieuwe generatie is. Kosten en duur rekent de engine zelf.
Antwoord met alleen JSON: {"naam": "naam van editie ${n} (meestal de oude naam met ${ROMEINS[n] || n}, of een nieuwe als de CEO dat wil)", "pitch": "2-3 zinnen in de stem van het hoofd R&D", "extras": [{"naam": "...", "uitleg": "één zin", "soort": "omzet|populariteit|betrouwbaar|kosten|imago"}], "kwaliteit_plus": 1, "risico": "één zin"}`; }
async function gmEditie(id, tekst){ const s = G.game, p = s && (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, bericht: "Onbekend product."};
  tekst = cStr(tekst, 600); if (tekst.length < 3) return {ok: false, bericht: "Zeg eerst wat er in de nieuwe editie moet."};
  let v; if (live()){ try { v = cleanEditie(await G.sample.json(editiePrompt(s, p, tekst), {modelTier: "default"}), s, p); } catch(e){ return {ok: false, bericht: sampleErrorText(e)}; } } else v = editieVoorstelLokaal(s, p, tekst);
  v.vraagVan = tekst; v.voor = p.id; (G.edities ??= {})[p.id] = v; return {ok: true, bericht: `${live() ? "De GM" : "R&D"} heeft ${v.naam} uitgewerkt. Lees het voorstel en kies.`}; }
function actEditie(s, ctx, id, v){ const p = (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, msg: "Onbekend product."}; if (!v) return {ok: false, msg: "Er ligt geen voorstel klaar."};
  if (p.status !== "markt") return {ok: false, msg: "Alleen een product op de markt krijgt een nieuwe editie."}; if (p.editieBezig) return {ok: false, msg: `${p.naam} heeft al een editie in ontwikkeling.`}; if (p.verbetering) return {ok: false, msg: "Er loopt al een nieuwe versie."};
  const k = editieKosten(s, p, v); if (s.cash < k.kost) return {ok: false, msg: `Editie ${editieNr(p) + 1} kost €${k.kost}M.`}; s.cash = r1(s.cash - k.kost); s.accounts.operationeel = s.cash;
  p.editieBezig = {naam: cStr(v.naam, 40), pitch: cStr(v.pitch, 500), extras: (v.extras || []).slice(0, 4).map(x => ({naam: cStr(x.naam, 50), uitleg: cStr(x.uitleg, 160), soort: EXTRA_SOORT[x.soort] ? x.soort : "omzet"})), kwPlus: Math.round(clamp(+v.kwPlus || 0, 0, Math.min(2, 5 - p.kwaliteit))), over: k.maanden, doel: k.doel, bonus: k.bonus, kost: k.kost, sinds: ym(s)};
  prodLog(p, s, `Editie ${editieNr(p) + 1} in ontwikkeling: ${p.editieBezig.naam}`); addLog(s, `${p.naam}: editie ${editieNr(p) + 1} (${p.editieBezig.naam}) in ontwikkeling, €${k.kost}M, ${k.maanden} maanden`);
  return {ok: true, msg: `${p.editieBezig.naam} in ontwikkeling: €${k.kost}M, ${k.maanden} maanden, ${kans2d6(k.bonus, k.doel)}% kans dat alles lukt. Tot dan verkoopt ${p.naam} gewoon door.`}; }
function editieTick(s, ctx, p){ const E = p.editieBezig; if (!E || --E.over > 0) return; delete p.editieBezig;
  const r = rol2d6(E.bonus || 1, E.doel || 7), oud = p.naam, n = editieNr(p) + 1; addRoll(s, `Editie ${n} van ${oud}: ${r.txt} → ${r.ok ? "GELUKT" : "HALF"}`);
  const extras = r.ok ? E.extras : E.extras.slice(0, 1), kw = r.ok ? E.kwPlus : 0;
  p.basisNaam ??= basisNaam(p); p.editie = n; p.naam = E.naam || p.naam; if (E.pitch) p.pitch = E.pitch;
  p.extras = [...(p.extras || []), ...extras.map(x => ({...x, editie: n}))].slice(-EXTRA_MAX); p.kwaliteit = clamp(p.kwaliteit + kw, 1, 5);
  const pop = 10 + extras.reduce((a, x) => a + (EXTRA_SOORT[x.soort].pop || 0), 0) + (r.crit ? 8 : 0), rep = extras.reduce((a, x) => a + (EXTRA_SOORT[x.soort].rep || 0), 0);
  p.pop = clamp(p.pop + pop, 0, 95); if (rep) s.reputation = clamp(s.reputation + rep); p.leeftijd = 0; if (p.trait === "gevoelig") p.trait = null; maakReview(p);
  if (KEURING_AARD.has(p.aard || aardVan(p.type, p.naam)) && kanaalVan(p) !== "zwart") p.keuring = "nodig";
  (p.edities ??= []).push({n, naam: p.naam, m: ym(s), extras: extras.map(x => x.naam), kw: p.kwaliteit, ok: r.ok});
  prodLog(p, s, `Editie ${n}: ${p.naam}${r.ok ? "" : " (half gelukt)"}`);
  const txt = r.ok ? `${p.naam} ligt in de winkel (${r.txt}). Nieuw: ${extras.map(x => x.naam.toLowerCase()).join(", ")}${kw ? `, kwaliteit nu ${p.kwaliteit}` : ""}. Populariteit +${pop}${rep ? `, reputatie +${rep}` : ""}.`
    : `${p.naam} is uit, maar niet alles zat erin (${r.txt}): alleen ${extras.map(x => x.naam.toLowerCase()).join(", ")}, geen sprong in kwaliteit. Populariteit +${pop}.`;
  mail(ctx, s, "R&D", `${p.naam}: editie ${n}`, txt + (p.keuring === "nodig" ? " Een nieuwe editie moet opnieuw gekeurd worden." : ""), r.ok ? "NORMAAL" : "HOOG"); ctx.rep.push(`${p.naam}: editie ${n}${r.ok ? "" : " (half)"}`);
  if (r.ok) news(s, `${s.player.corp_name} lanceert ${p.naam}`, `De opvolger van ${oud === p.naam ? "het origineel" : oud}. ${extras.length ? "Nieuw: " + extras.map(x => x.naam.toLowerCase()).join(", ") + "." : ""}`, "", "markt", true); }
/* 4.5.1: keuring. Medisch, implantaten en wapens mogen pas overal verkocht worden na een keuring; daarvoor alleen de grijze markt (60% van de afzet).
   Producten van vóór 4.5.1 (zonder veld) gelden als gekeurd. */
const KEURING_AARD = new Set(["medisch", "implantaat", "wapen"]), KEUR_ZONDER = 0.6;
/* 4.6: verkoopkanalen per product. vol = afzet, marge = opbrengst per stuk (geen tussenhandel), vast = M€ per maand, heat per maand. */
const DIGITAAL = new Set(["data", "financieel", "consument"]), ILLEGAAL = new Set(["wapen", "smokkel", "implantaat"]);
const KANAAL = {
  groothandel: {label: "Groothandel", vol: () => 1, marge: 1, vast: 0, heat: 0, tekst: "Distributeurs nemen alles af en verkopen het door. Geen gedoe, geen extra marge."},
  eigen: {label: "Eigen winkels", vol: () => 0.9, marge: 1.15, vast: 1.5, heat: 0, tekst: "Je eigen winkels en verkopers: geen tussenhandel (+15% opbrengst per stuk), minder bereik, €1,5M vaste kosten per maand."},
  online: {label: "Online", vol: p => DIGITAAL.has(p.aard) ? 1.15 : 0.85, marge: 1.05, vast: 0.5, heat: 0, tekst: "Webwinkel en platforms: sterk voor data, financiële en consumentenproducten (+15% afzet), zwak voor de rest (−15%). €0,5M per maand."},
  zwart: {label: "Zwarte markt", vol: p => ILLEGAAL.has(p.aard) ? 1.25 : 0.8, marge: 1, vast: 0, heat: 0.4, zwart: 0.5, tekst: "Via fixers en kofferbakken: geen keuring nodig, sterk voor wapens, smokkelwaar en implantaten (+25%), zwak voor de rest (−20%). De helft van de omzet komt als zwart geld binnen. Heat +0,4 per maand."}};
/* 4.6.1: marketingkanalen. Een campagne geeft populariteit en een paar maanden extra afzet in één klantsegment:
   doel "gevoelig" = het prijsgevoeligste segment, "koopkrachtig" = het minst prijsgevoelige. */
const MARKETING = {
  reclame: {label: "Reclame", kost: 3, pop: 12, doel: null, f: 1, maanden: 0, tekst: "Posters, spots, billboards: populariteit +12 bij iedereen."},
  influencers: {label: "Influencers", kost: 3, pop: 8, doel: "gevoelig", f: 1.4, maanden: 4, tekst: "Gezichten met volgers: populariteit +8 en 4 maanden 40% meer afzet in het prijsgevoeligste segment."},
  beurs: {label: "Beurs", kost: 5, pop: 5, doel: "koopkrachtig", f: 1.5, maanden: 6, tekst: "Een stand, een diner, handdrukken: populariteit +5 en 6 maanden 50% meer afzet bij de koopkrachtigste, minst prijsgevoelige klanten."},
  fluister: {label: "Fluistercampagne", kost: 2, zwart: true, pop: 8, doel: "gevoelig", f: 1.3, maanden: 4, heat: 2, tekst: "Via de straat, betaald met zwart geld: populariteit +8 (wapens, smokkelwaar en implantaten +12), 4 maanden 30% meer afzet in het prijsgevoeligste segment, heat +2."}};
function mktSegIndex(p, doel){ const L = SEGMENTEN[p.aard || aardVan(p.type, p.naam)] || SEGMENTEN.consument; if (!doel) return -1; let best = 0; L.forEach((x, i) => { if (doel === "gevoelig" ? x[2] > L[best][2] : x[2] < L[best][2]) best = i; }); return best; }
function mktTick(p){ if (p.mkt && --p.mkt.maanden <= 0) delete p.mkt; }
const kanaalVan = p => KANAAL[p.kanaal] ? p.kanaal : "groothandel";
const kanaalF = p => { const K = KANAAL[kanaalVan(p)]; return K.vol(p) * K.marge; };
const kanaalWissel = s => r1(1 * (DIFF[(s && s.player.difficulty)] || 1));
const keurStatus = p => p.keuring == null ? "ok" : typeof p.keuring === "object" ? "bezig" : p.keuring;
const keurF = p => keurStatus(p) === "ok" || kanaalVan(p) === "zwart" ? 1 : KEUR_ZONDER;
const keurKost = s => r1(4 * (DIFF[(s && s.player.difficulty)] || 1)), omkoopKost = s => r1(2 * (DIFF[(s && s.player.difficulty)] || 1));
const keurDoel = p => 5 + (defectPct(p) > 3 ? 1 : 0) /* 6.8: was 6; ±83% i.p.v. 72% */ + (defectPct(p) > DEFECT_DREMPEL ? 1 : 0) - ((p.kwaliteit || 3) >= 4 ? 1 : 0);
const keurInstantie = p => ({medisch: "het geneesmiddelenbureau", implantaat: "de keuringsdienst voor implantaten", wapen: "de wapeninspectie"})[p.aard] || "de keurder";
/* 4.7.2: een goedkeuring is permanent, maar geldt alleen voor deze editie: een nieuw product, een variant of een nieuwe versie wordt opnieuw gekeurd */
function vergunning(s, p){ }
function keuringTick(s, ctx, p){ if (keurStatus(p) !== "bezig" || --p.keuring.maanden > 0) return;
  const r = rol2d6(0, keurDoel(p)); addRoll(s, `Keuring ${p.naam}: ${r.txt} → ${r.ok ? "GOEDGEKEURD" : "AFGEKEURD"}`);
  if (r.ok){ p.keuring = "ok"; vergunning(s, p); prodLog(p, s, "Goedgekeurd"); mail(ctx, s, "Juridische Zaken", `${p.naam} goedgekeurd`, `${keurInstantie(p)[0].toUpperCase() + keurInstantie(p).slice(1)} keurt ${p.naam} goed (${r.txt}). Vanaf nu overal in de winkel.`, "NORMAAL"); }
  else { p.keuring = "afgekeurd"; prodLog(p, s, "Afgekeurd"); mail(ctx, s, "Juridische Zaken", `${p.naam} afgekeurd`, `${keurInstantie(p)[0].toUpperCase() + keurInstantie(p).slice(1)} keurt ${p.naam} af (${r.txt}).${defectPct(p) > 3 ? ` Ze wijzen op het aantal defecten (${defectPct(p)}%).` : ""} We mogen opnieuw aanvragen; betere onderdelen of een nieuwe versie helpen.`, "HOOG"); } }
function kansRol(){ return R(); } /* eigen functie zodat tests de kans kunnen vastzetten */
function defectTick(s, ctx, p){ if (p.status !== "markt") return; { const dp = defectPct(p); if (dp > DEFECT_DREMPEL && kansRol() < (dp - DEFECT_DREMPEL) / 100 && !(s.keuzes || []).some(k => k.soort === "defect_" + p.id) && (!p.defectLaatst || mndNr(ym(s)) - mndNr(p.defectLaatst) >= 12)){ p.defectLaatst = ym(s); const k1 = r1(Math.max(2, (s.prodomzet || {})[p.id] || 2) * 1.5), k2 = r1(k1 / 3);
      addKeuze(s, ctx, {soort: "defect_" + p.id, van: "Kwaliteitsdienst", titel: `Te veel defecten bij ${p.naam}`, tekst: `${dp}% van wat we van ${p.naam} verkopen komt terug of gaat stuk. De klachten stapelen zich op en een consumentenprogramma belt al.`, opties: [
        {label: `Terugroepen · €${k1}M`, kost: k1, uitleg: "Populariteit −15, reputatie +1. Dit soort klachten komt hoogstens eens per jaar terug; de oorzaak (onderdelen, kwaliteit) blijft tot je die aanpakt.", eff: {reputation: 1, product: {[p.id]: {pop: -15}}}},
        {label: `Stil repareren · €${k2}M`, kost: k2, uitleg: `Kans ${snapKans(55)}%: niemand merkt het. Mislukt: reputatie −6, populariteit −20.`, eff: {kans: 55, succes: {tekst: "De reparaties verlopen stil."}, falen: {reputation: -6, product: {[p.id]: {pop: -20}}}}},
        {label: "Niets doen", uitleg: "Reputatie −3, populariteit −8.", eff: {reputation: -3, product: {[p.id]: {pop: -8}}}}], standaard: 2}); prodLog(p, s, `Defecten ${dp}%: terugroepactie overwogen`); } } }
const garantie = (p, omzet) => omzet * defectPct(p) / 100;
/* 5.1: huisstijl: bedrijfskleuren, thema en logo (generator of PNG) */
const THEMAS = {neon: {label: "Neon"}, corporate: {label: "Corporate", bg: "#0b0f14", panel: "rgba(18,24,32,.9)", panel2: "#18212c", panel3: "#202c3a", line: "#263445", line2: "#3b5068", muted: "#9fb0c4", dim: "#8494a8"},
  terminal: {label: "Terminal", bg: "#020a04", panel: "rgba(6,20,10,.9)", panel2: "#0b2412", panel3: "#103018", line: "#14401f", line2: "#1f6b33", muted: "#9cc8a6", dim: "#7fa889"},
  bloed: {label: "Bloed", bg: "#0e0204", panel: "rgba(30,6,10,.88)", panel2: "#2a0a10", panel3: "#3a0e16", line: "#4a1420", line2: "#7a2030", muted: "#d0a8ae", dim: "#b08890"},
  chroom: {label: "Chroom", bg: "#0d0d10", panel: "rgba(26,26,32,.9)", panel2: "#22222a", panel3: "#2c2c36", line: "#3a3a46", line2: "#5a5a6a", muted: "#b4b4c2", dim: "#9494a4"}};
const LOGO_SYMBOLEN = ["◆", "▲", "⬢", "✦", "☢", "⚙", "✪", "Ω", "Ψ", "⌬", "☠", "⚡"], LOGO_VORMEN = ["zeshoek", "cirkel", "ruit", "schild"];
function actHuisstijl(s, a){ const h = (s.huisstijl ??= {}), kleur = x => typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x);
  if (kleur(a.kleur)) h.kleur = a.kleur; if (kleur(a.accent)) h.accent = a.accent; if (THEMAS[a.thema]) h.thema = a.thema;
  if (a.logo && a.logo.soort === "png"){ if (typeof a.logo.data !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(a.logo.data) || a.logo.data.length > 90000) return {ok: false, msg: "Dat plaatje is te groot of geen afbeelding."}; h.logo = {soort: "png", data: a.logo.data}; }
  else if (a.logo && a.logo.soort === "gen") h.logo = {soort: "gen", symbool: LOGO_SYMBOLEN.includes(a.logo.symbool) ? a.logo.symbool : "◆", vorm: LOGO_VORMEN.includes(a.logo.vorm) ? a.logo.vorm : "zeshoek"};
  else if (a.logo === null) delete h.logo;
  addLog(s, "Huisstijl aangepast"); return {ok: true, msg: "Huisstijl bijgewerkt."}; }
/* 5.2: autopilot per product: prijs volgt de beste prijs, capaciteit volgt de vraag (met een kasbuffer), keuring vanzelf */
const AUTO = {prijs: "Prijs volgt de prijs met de meeste winst (hoogstens 150%, daarboven kost het reputatie)", cap: "Capaciteit volgt de vraag (uitbreiden als je uitverkocht bent en er €20M buffer is, inkrimpen bij veel leegloop)", keuring: "Keuring vanzelf aanvragen"};
function autoTick(s, ctx, p){ const A = p.auto || {}; if (p.status !== "markt" || !(A.prijs || A.cap || A.keuring)) return; const uit = [];
  if (A.keuring && ["nodig", "afgekeurd"].includes(keurStatus(p)) && kanaalVan(p) !== "zwart" && s.cash > keurKost(s) + 10){ const r = actProduct(s, ctx, "keuring", {id: p.id, wijze: "officieel"}); if (r.ok) uit.push("keuring aangevraagd"); }
  if (A.prijs){ const b = besteprijs(s, p), nf = b ? Math.min(b.f, 1.5) : null; if (nf && Math.abs(nf - prijsF(p)) >= 0.05){ const r = actPrijs(s, p.id, nf); if (r.ok) uit.push(`prijs naar ${Math.round(nf * 100)}%`); } } /* nooit boven 150%: daar beginnen woekerprijzen */
  if (A.cap){ const v = vraagNa(p), c = prodCap(s, p);
    if (v > c * 1.05 && s.cash > capKost(s, p) + 20 && c + 15 <= 130){ const r = actProduct(s, ctx, "capaciteit", {id: p.id}); if (r.ok) uit.push(`capaciteit naar ${prodCap(s, p)}`); }
    else if (v < c - 25 && c - 15 >= 45 && (p.capExtra || 0) > 0){ const r = actProduct(s, ctx, "krimpen", {id: p.id}); if (r.ok) uit.push(`capaciteit naar ${prodCap(s, p)}`); } }
  if (uit.length) ctx.rep.push(`Autopilot ${p.naam}: ${uit.join(", ")}`); }
const omschakelKost = s => r1(2 * (DIFF[(s && s.player.difficulty)] || 1));
const nadrukVan = v => v === "" || v == null || isNaN(+v) || +v < 0 || +v > 2 ? null : +v;
function prodSpecs(p){ const names = SPECS[p.aard] || SPECS.consument, F = {kwaliteit: [1, 1, 1], veilig: [0, 2, 0], snel: [0, -1, 0], goedkoop: [-1, -1, 0], innovatief: [2, -1, 0]}[p.focus] || [0, 0, 0];
  const N = [0, 0, 0]; if (p.nadruk != null && p.nadruk >= 0 && p.nadruk <= 2){ N[p.nadruk] = 2; N[(p.nadruk + 1) % 3] = -1; } /* 4.4: nadruk bij het ontwerp: +2 op de gekozen eigenschap, −1 op de volgende */
  if (p.delen) delenVan(p).forEach((d, j) => { N[d[2]] += DEEL_KWAL[deelKwal(p, j)].spec; });
  return names.map((n, i) => ({naam: n, v: clamp(Math.round(p.kwaliteit * 1.6 + (hashN(p.id, i) % 5) - 2 + F[i] + N[i] + (p.trait === "duurzaam" && i === 1 ? 1 : 0) + ((p.tech || 0) >= 3 ? 1 : 0)), 1, 10)})); }
/* 4.6.2: echte productlijnen per schaal. Klein = goedkoop en veel, vlaggenschip = duur en via losse orders (tanks, satellieten, ziekenhuissystemen).
   Omzet in M€, stukprijzen in echte euro's. [meervoud, enkelvoud, prijs, order] */
const STUK_SCHAAL = {
  wapen: {klein: ["pistolen", "pistool", 320], groot: ["aanvalsgeweren", "aanvalsgeweer", 2400], vlag: ["tanks", "tank", 4200000, true]},
  medisch: {klein: ["doses", "dosis", 20], groot: ["behandelingen", "behandeling", 1800], vlag: ["ziekenhuissystemen", "ziekenhuissysteem", 850000, true]},
  implantaat: {klein: ["implantaten", "implantaat", 1600], groot: ["militaire implantaten", "militair implantaat", 25000], vlag: ["volledige lichaamsombouwen", "volledige lichaamsombouw", 600000, true]},
  data: {klein: ["licenties", "licentie", 6], groot: ["bedrijfslicenties", "bedrijfslicentie", 4500], vlag: ["overheidssystemen", "overheidssysteem", 2500000, true]},
  beveiliging: {klein: ["diensten", "dienst", 380], groot: ["bewakingscontracten", "bewakingscontract", 15000], vlag: ["stadscontracten", "stadscontract", 1200000, true]},
  smokkel: {klein: ["ladingen", "lading", 260], groot: ["containers", "container", 18000], vlag: ["konvooien", "konvooi", 400000, true]},
  logistiek: {klein: ["zendingen", "zending", 9], groot: ["containers", "container", 2500], vlag: ["vrachtcontracten", "vrachtcontract", 1500000, true]},
  financieel: {klein: ["rekeningen", "rekening", 4], groot: ["beleggingsfondsen", "beleggingsfonds", 25000], vlag: ["staatsleningen", "staatslening", 5000000, true]},
  orbitaal: {klein: ["ladingplaatsen", "ladingplaats", 8500], groot: ["satellietlanceringen", "satellietlancering", 900000], vlag: ["satellieten", "satelliet", 40000000, true]},
  consument: {klein: ["stuks", "stuk", 12], groot: ["premium apparaten", "premium apparaat", 450], vlag: ["luxemerken", "luxeproduct", 6000]}};
function stukInfo(p){ if (p.stuk && p.stuk.prijs) return {eenheid: p.stuk.eenheid, enkel: p.stuk.enkel, prijs: p.stuk.prijs, order: !!p.stuk.order}; const a = p.aard || aardVan(p.type, p.naam), r = ((STUK_SCHAAL[a] || STUK_SCHAAL.consument)[p.schaal || "klein"]) || (STUK_SCHAAL[a] || STUK_SCHAAL.consument).klein; return {eenheid: r[0], enkel: r[1], prijs: r[2], order: !!r[3]}; }
/* orders: de verwachte omzet blijft gelijk, maar komt in brokken binnen (gemiddeld eens per drie maanden een order) */
const ORDER_KANS = 0.3;
function orderOmzet(s, ctx, p, o){ if (!(o > 0)) return 0; if (kansRol() >= ORDER_KANS) return 0; const I = stukInfo(p), o2 = o / ORDER_KANS, stuks = Math.max(1, Math.round(o2 * 1e6 / Math.max(1, stukPrijs(p))));
  (p.orders ??= []).push({m: ym(s), stuks, bedrag: r1(o2)}); p.orders = p.orders.slice(-6); if (ctx) ctx.rep.push(`Order: ${stuks} ${stuks === 1 ? I.enkel : I.eenheid} ${p.naam} (€${r1(o2)}M)`); return o2; }
const basisPrijs = p => stukInfo(p).prijs * (0.8 + p.kwaliteit * 0.08);
const stukPrijs = p => Math.round(basisPrijs(p) * prijsF(p));
const kostPrijs = p => Math.round(basisPrijs(p) * PROD_KOST * kostFactor(p));
function levensfase(p){
  if (p.status !== "markt") return p.status === "ontwikkeling" ? "In ontwikkeling" : "Wachtrij";
  const h = p.hist || [], trend = h.length >= 3 ? h[h.length - 1].pop - h[h.length - 3].pop : 0, l = p.leeftijd || 0;
  if (l < 3) return "Introductie"; if (l > 30 || (trend <= -6 && l >= 12)) return "Verval"; if (trend >= 4 && l < 18) return "Groei"; return "Volwassen"; }
/* capaciteit: hoeveel van de vraag je kunt leveren, in dezelfde schaal als populariteit (0-100). Een echte grens. */
function prodCap(s, p){ const d = s.divisions.find(x => divNaam(x) === p.divisie); return Math.round(clamp(60 + 6 * ((d && d.level) || 1) + (p.capExtra || 0), 45, 130)); }
const effBereik = (p, s) => s ? Math.min(vraagNa(p), prodCap(s, p)) : vraagNa(p);
const capVast = (s, p) => r1(((p.capExtra || 0) / 15) * 0.3 * (DIFF[s.player.difficulty] || 1)); /* 4.7.6: elke 15 capaciteit boven of onder de basis kost of bespaart €0,3M per maand */
const capKost = (s, p) => r1((5 + (p.capExtra || 0) / 5) * (DIFF[s.player.difficulty] || 1));
function segment(s, p){
  const a = p.aard || aardVan(p.type, p.naam), mijn = (s.producten || []).filter(x => x.status === "markt" && (x.aard || aardVan(x.type, x.naam)) === a);
  const rival = s.rivals.flatMap(r => (r.producten || []).filter(x => x.aard === a).map(x => ({naam: x.naam, wie: r.name, w: x.kwaliteit * x.pop / 100})));
  const eigen = mijn.map(x => ({naam: x.naam, wie: "jij", w: prodGewicht(x, s), id: x.id})), alle = [...eigen, ...rival], tot = alle.reduce((t, x) => t + x.w, 0) || 1;
  const pc = x => Math.round(x.w / tot * 1000) / 10;
  return {aandeel: pc(eigen.find(x => x.id === p.id) || {w: 0}), concurrenten: rival.sort((x, y) => y.w - x.w).slice(0, 3).map(x => ({naam: x.naam, wie: x.wie, pct: pc(x)})), spelers: alle.length};
}
function prodDetail(s, p, omzet){
  const abo = isAbo(p) && p.abo, cap = prodCap(s, p), vraag = vraagNa(p);
  const sp = abo ? Math.max(1, Math.round(omzet * 1e6 / Math.max(1, p.abo * 10000))) : stukPrijs(p), kp = abo ? Math.round(sp * PROD_KOST * kostFactor(p) / prijsF(p)) : kostPrijs(p), afzet = abo ? Math.round(p.abo * 10000) : omzet > 0 ? Math.round(omzet * 1e6 / sp) : 0;
  return {specs: prodSpecs(p), eenheid: abo ? "abonnees" : stukInfo(p).eenheid, enkel: abo ? "abonnee" : stukInfo(p).enkel, order: !abo && stukInfo(p).order ? {kans: Math.round(ORDER_KANS * 100), verwacht: Math.round(prodOmzet(s, p) * 1e6 / Math.max(1, stukPrijs(p)) * 10) / 10, laatste: (p.orders || []).slice(-3).reverse()} : null, perMaand: !!abo, stukPrijs: sp, kostPrijs: kp, marge: Math.round((sp - kp) / sp * 100), afzet, fase: levensfase(p),
    cap, vraag: Math.round(vraag), uitverkocht: vraag > cap, gemist: vraag > cap ? Math.round((vraag - cap) / vraag * 100) : 0, capKost: capKost(s, p), capVast: capVast(s, p), capKrimp: prodCap(s, p) - 15 >= 45, seg: segment(s, p), hist: (p.hist || []).slice(-12), prijsF: prijsF(p), elast: elast(p), segmenten: segmenten(p, s).rows.map(({vol, ...r}) => r), delen: delenVan(p).map((d, i) => { const k = deelKwal(p, i), eigen = eigenDeel(p, i), lv = leverancier(s, p, i), per = (abo ? sp / prijsF(p) : basisPrijs(p)) * PROD_KOST * d[1] * DEEL_KWAL[k].kost * (eigen ? EIGEN_KORTING : 1);
      return {naam: d[0], aandeel: d[1], spec: (SPECS[p.aard] || SPECS.consument)[d[2]], kwal: k, kost: Math.round(per * 100) / 100, eigen, lev: eigen ? "eigen fabriek" : lv ? lv.naam : "eigen werkplaats"}; }), zelfKost: zelfKost(s), arbeid: Math.round((abo ? sp / prijsF(p) : basisPrijs(p)) * PROD_KOST * ARBEID * 100) / 100, omschakel: omschakelKost(s), auto: {...(p.auto || {})}, marketing: {actief: p.mkt ? {...p.mkt, label: MARKETING[p.mkt.kanaal] ? MARKETING[p.mkt.kanaal].label : "Campagne", seg: (SEGMENTEN[p.aard] || SEGMENTEN.consument)[p.mkt.seg][0]} : null, dezeMaand: p.actie === ym(s), opties: Object.entries(MARKETING).map(([k, M]) => ({key: k, label: M.label, kost: M.kost, zwart: !!M.zwart, tekst: M.tekst, seg: M.doel ? (SEGMENTEN[p.aard] || SEGMENTEN.consument)[mktSegIndex(p, M.doel)][0] : null}))}, kanaal: {key: kanaalVan(p), wissel: kanaalWissel(s), opties: Object.entries(KANAAL).map(([k, K]) => ({key: k, label: K.label, vol: Math.round(K.vol(p) * 100), marge: Math.round(K.marge * 100), vast: K.vast, heat: K.heat, zwart: K.zwart || 0, tekst: K.tekst}))}, keuring: KEURING_AARD.has(p.aard) || p.keuring != null ? {status: keurStatus(p), maanden: keurStatus(p) === "bezig" ? p.keuring.maanden : 0, kost: keurKost(s), omkoop: omkoopKost(s), kans: kans2d6(0, keurDoel(p)), omkoopKans: kans2d6(0, 7), instantie: keurInstantie(p)} : null, defect: defectPct(p), garantie: r1(garantie(p, omzet)), garantieEur: Math.round(garantie(p, omzet) * 1e6), defectRisico: Math.max(0, Math.round((defectPct(p) - DEFECT_DREMPEL) * 10) / 10), beste: p.status === "markt" ? besteprijs(s, p) : null};
}
const prodGewicht = (p, s) => keurF(p) * kanaalF(p) * p.kwaliteit * effBereik(p, s) / 100 * prijsF(p) * (s ? vraagFactor(s, p.aard || aardVan(p.type, p.naam)) * regioF(s, p) * patentF(s, p) * techF(s, p) : 1) * (p.trait === "goedkoop" ? 1.15 : 1) * extraF(p, "omzet"); /* 5.11: regio's; 6.13: extra's van een editie */
const prodSterkte = p => bereik(p) / 100 * (0.5 + p.kwaliteit * 0.15);
function prodEffecten(p){ const A = PRODUCT_AARD[p.aard || "consument"] || PRODUCT_AARD.consument, f = prodSterkte(p), out = {};
  for (const [k2, v] of Object.entries(p.eigenEff || A.eff)) out[k2] = Math.round(v * f * 10) / 10; const pr = ((PRIJS[p.prijs || "standaard"] || {}).rep || 0) + (prijsF(p) > 1.5 ? -0.25 : 0); if (pr) out.reputation = Math.round(((out.reputation || 0) + pr) * 10) / 10;
  for (const [k2, v] of Object.entries(traitEffecten(p))) out[k2] = Math.round(((out[k2] || 0) + v) * 10) / 10; return out; }
const productMacht = s => Math.round((s.producten || []).filter(p => p.status === "markt").reduce((a, p) => a + (prodEffecten(p).macht || 0), 0));
const REVIEW_TEKST = {
  5: ["'Het beste in zijn klasse, en dat weten ze.'", "'Hier wordt over tien jaar nog over gepraat.'"],
  4: ["'Doet wat het belooft, en meer.'", "'Een stille favoriet.'"],
  3: ["'Degelijk. Niet spannend.'", "'Prima, als je niet te veel vraagt.'"],
  2: ["'Te duur voor wat het is.'", "'De handleiding is beter dan het product.'"],
  1: ["'Vermijden.'", "'Een rechtszaak in wording.'"],
};
const REVIEWERS = ["Global Wire", "Neon Consumentenbond", "Chroomgids", "De Straatkrant", "Corporate Weekly"];
function maakReview(p){ const st = clamp(Math.round(p.kwaliteit * 0.6 + p.pop / 40), 1, 5); p.review = {sterren: st, tekst: CH(REVIEW_TEKST[st]), bron: CH(REVIEWERS)}; }
function productEffectTick(s){
  const tot = {};
  for (const p of (s.producten || []).filter(x => x.status === "markt")){
    p.aard ??= aardVan(p.type, p.naam); p.prijs ??= "standaard";
    for (const [k2, v] of Object.entries(prodEffecten(p))) tot[k2] = (tot[k2] || 0) + v;
    { const omz = (s.prodomzet || {})[p.id] || 0; p.hist = [...(p.hist || []), {m: ym(s), pop: Math.round(bereik(p)), omzet: r1(omz), riv: rivaalTop(s, p.aard || aardVan(p.type, p.naam)).pop}].slice(-24); } /* 5.16: 24 mnd en de sterkste concurrent */
    p.omzetTotaal = r1((p.omzetTotaal || 0) + ((s.prodomzet || {})[p.id] || 0));
  }
  if (tot.reputation) s.reputation = clamp(s.reputation + tot.reputation);
  if (tot.heat) s.heat = clamp(s.heat + tot.heat);
  if (tot.morale) s.morale = clamp(s.morale + tot.morale);
  if (tot.invloed) s.invloed = r1((s.invloed || 0) + tot.invloed);
  if (tot.zwart) s.accounts.zwart = r1(s.accounts.zwart + tot.zwart);
  for (const f of ["straat", "politie", "stad", "vakbond", "nomaden"]) if (tot[f]) shiftFaction(s, f, tot[f]);
  return tot;
}
const PRODUCT_EVENTS = [
  {aard: ["wapen"], gen: (s, p, land) => ({van: "Head of Security", titel: `${p.naam} gebruikt bij een overval`, tekst: `Bij een overval in ${land} is een ${p.naam} gevonden. Serienummer intact, onze naam erop. De pers heeft het al.`, opties: [
    {label: "Zwijgen", uitleg: "Heat +5, de straat +3.", eff: {heat: 5, factions: {straat: 3}}},
    {label: "Verkoop aan particulieren stoppen", uitleg: `Populariteit −15, heat −3, reputatie +3.`, eff: {product: {[p.id]: {pop: -15}}, heat: -3, reputation: 3}},
    {label: "Persconferentie · €3M", kost: 3, uitleg: `Kans ${snapKans(58)}%: reputatie +3. Mislukt: reputatie −4.`, eff: {kans: 58, succes: {reputation: 3, tekst: "Het verhaal kantelt: legaal product, illegaal gebruik."}, falen: {reputation: -4, tekst: "De woordvoerder zei het verkeerde woord."}}}], standaard: 0})},
  {aard: ["medisch", "beveiliging"], gen: (s, p, land) => ({van: "PR", titel: `${p.naam} redt levens in ${land}`, tekst: `Na een ramp in ${land} blijkt ${p.naam} het verschil te maken. Overal camera's. Dit is het moment om iets te doen, of te verdienen.`, opties: [
    {label: "Gratis leveren · €4M", kost: 4, uitleg: "Reputatie +6, overheden +5, populariteit +10.", eff: {reputation: 6, factions: {stad: 5}, product: {[p.id]: {pop: 10}}}},
    {label: "Prijs verhogen", uitleg: "+€8M, reputatie −4, het product gaat naar premium.", eff: {cash: 8, reputation: -4, product: {[p.id]: {prijs: "premium"}}}},
    {label: "Gewoon doorleveren", uitleg: "Populariteit +6.", eff: {product: {[p.id]: {pop: 6}}}}], standaard: 2})},
  {aard: ["implantaat"], gen: (s, p) => ({van: "R&D", titel: `Bijwerkingen bij ${p.naam}`, tekst: `Gebruikers van ${p.naam} melden hoofdpijn, tics en één geval van spontaan Portugees. Nog geen rechtszaak. Nog niet.`, opties: [
    {label: "Terugroepen", uitleg: "Populariteit −25, €5M, reputatie +2.", eff: {cash: -5, reputation: 2, product: {[p.id]: {pop: -25}}}},
    {label: "Gratis update · €4M", kost: 4, uitleg: "Populariteit +4, reputatie +2.", eff: {reputation: 2, product: {[p.id]: {pop: 4}}}},
    {label: "Ontkennen", uitleg: `Kans ${snapKans(58)}%: niets aan de hand. Mislukt: reputatie −8, heat +4.`, eff: {kans: 58, succes: {tekst: "Het waait over."}, falen: {reputation: -8, heat: 4, product: {[p.id]: {pop: -15}}, tekst: "Een klokkenluider heeft de testrapporten."}}}], standaard: 2})},
  {aard: ["data", "financieel"], gen: (s, p) => ({van: "IT", titel: `Datalek bij ${p.naam}`, tekst: `Klantgegevens van ${p.naam} liggen op een forum. Het lek is gedicht, de schade niet.`, opties: [
    {label: "Melden en excuses", uitleg: "Reputatie −3, toezicht +4.", eff: {reputation: -3, factions: {politie: 4}}},
    {label: "Toedekken", uitleg: `Kans ${snapKans(58)}%: niemand merkt het. Mislukt: reputatie −8, populariteit −15.`, eff: {kans: 58, succes: {tekst: "Stil gebleven."}, falen: {reputation: -8, product: {[p.id]: {pop: -15}}, tekst: "Een journalist had het al."}}}], standaard: 0})},
  {aard: ["smokkel"], gen: (s, p) => ({van: "Logistiek", titel: `Douane onderschept ${p.naam}`, tekst: `Een zending ${p.naam} staat in beslag. De douanier is te koop, de pers misschien ook.`, opties: [
    {label: "Afkopen · €4M zwart", kost: 4, bron: "zwart", uitleg: "Niets aan de hand.", eff: {tekst: "De container is nooit gevonden."}},
    {label: "Laten gaan", uitleg: "Zwart −€6M aan lading, heat +4.", eff: {zwart: -6, heat: 4}}], standaard: 1})},
  {aard: null, gen: (s, p) => ({van: "Marketing", titel: `${p.naam} gaat viraal`, tekst: `Een filmpje met ${p.naam} gaat de wereld rond. Wachtlijsten in drie landen. Dit duurt niet lang, tenzij we iets doen.`, opties: [
    {label: "Productie opschalen · €5M", kost: 5, uitleg: "Populariteit +22.", eff: {product: {[p.id]: {pop: 22}}}},
    {label: "Naar premium", uitleg: "Populariteit +8, en het product gaat naar premium.", eff: {product: {[p.id]: {pop: 8, prijs: "premium"}}}},
    {label: "Laten lopen", uitleg: "Populariteit +10.", eff: {product: {[p.id]: {pop: 10}}}}], standaard: 2})},
  {aard: null, gen: (s, p) => { const g = gangOf(s, s.player.home_district), gn = g ? g.g.naam : "Rode Lotus";
    return {van: "Juridische Zaken", titel: `Namaak van ${p.naam}`, tekst: `Op de zwarte markt liggen kopieën van ${p.naam}, half zo duur en half zo goed. ${gn} zou erachter zitten.`, opties: [
      {label: "Advocaten · €4M", kost: 4, uitleg: `Kans ${snapKans(58)}%: populariteit +8. Mislukt: geld weg.`, eff: {kans: 58, succes: {product: {[p.id]: {pop: 8}}, tekst: "De kopieën verdwijnen uit de etalages."}, falen: {tekst: "Er komen er meer."}}},
      {label: "Negeren", uitleg: "Populariteit −8.", eff: {product: {[p.id]: {pop: -8}}}}], standaard: 1}; }},
  {aard: null, when: (s, p) => s.rivals.length && p.trait !== "gepatenteerd", gen: (s, p) => { const r = s.rivals.find(x => x.sector === p.type) || CH(s.rivals);
    return {van: "R&D", titel: `${r.name} kopieert ${p.naam}`, tekst: `${r.name} lanceert iets dat verdacht veel op ${p.naam} lijkt. Zelfde ontwerp, andere kleur.`, opties: [
      {label: "Rechtszaak · €6M", kost: 6, uitleg: `Kans ${snapKans(58)}%: hun kopie verdwijnt, populariteit +10. Relatie −15.`, eff: {rivaal: {[r.name]: {relatie: -15}}, kans: 58, succes: {product: {[p.id]: {pop: 10}}, tekst: "De rechter is het met ons eens."}, falen: {tekst: "Net anders genoeg, zegt de rechter."}}},
      {label: "Nieuwe versie versnellen", uitleg: "Een nieuwe versie start direct (gratis, 2 maanden), populariteit −6.", eff: {product: {[p.id]: {pop: -6, versie: 2}}}},
      {label: "Laten", uitleg: "Populariteit −10.", eff: {product: {[p.id]: {pop: -10}}}}], standaard: 2}; }},
];
function productEventTick(s, ctx){
  const markt = (s.producten || []).filter(p => p.status === "markt"); if (!markt.length || R() > 0.16) return;
  if ((s.keuzes || []).some(k => String(k.soort).startsWith("prod_"))) return;
  const p = wpick(markt.map(x => [x, 5 + x.pop + (x.trait === "goedkoop" ? 30 : 0)])); p.aard ??= aardVan(p.type, p.naam);
  if (p.gb && p.gb.length && R() < 0.65){ let vrij = p.gb.filter((g, i) => !(p.gbGebruikt || []).includes(i)); if (!vrij.length){ p.gbGebruikt = []; vrij = p.gb; }
    const g = CH(vrij), gi = p.gb.indexOf(g); (p.gbGebruikt ??= []).push(gi);
    addKeuze(s, ctx, {soort: "prod_" + p.id, gm: true, van: g.van, titel: g.titel, tekst: g.tekst, opties: g.opties.map(o => ({label: o.label, uitleg: o.uitleg, kost: o.kost, eff: gbEff(o.eff, p.id)})), standaard: g.opties.length - 1}); prodLog(p, s, g.titel); return; }
  const opts = PRODUCT_EVENTS.filter(e => (!e.aard || e.aard.includes(p.aard)) && (!e.when || e.when(s, p)));
  const e = wpick(opts.map(x => [x, x.aard ? 2.5 : 1])), land = CH(s.districts).name, k = e.gen(s, p, land);
  k.soort = "prod_" + p.id; addKeuze(s, ctx, k); prodLog(p, s, k.titel);
}
function actPrijs(s, id, prijs){
  const p = (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, msg: "Onbekend."};
  const nf = typeof prijs === "number" ? prijs : PRIJS_F[prijs]; if (nf == null || !isFinite(nf)) return {ok: false, msg: "Onbekende prijs."};
  const oud = prijsF(p), f = Math.round(clamp(nf, PRIJS_MIN, PRIJS_MAX) * 100) / 100; if (Math.abs(f - oud) < 0.005) return {ok: false, msg: "Dat is al de prijs."};
  p.prijsF = f; p.prijs = prijsLabel(f);
  let weg = 0; if (isAbo(p) && f > oud && p.abo){ weg = r1(p.abo * clamp((f - oud) * 0.25 * elast(p), 0, 0.2)); p.abo = r1(p.abo - weg); }
  const verschil = Math.round((f - oud) * 100), msg = `${p.naam}: prijs naar €${stukPrijs(p).toLocaleString("nl-NL")} per ${isAbo(p) ? "abonnee per maand" : "stuk"} (${verschil > 0 ? "+" : ""}${verschil}% van de standaardprijs). ${isAbo(p) ? `${weg ? `${Math.round(weg * 10)} abonnees zeggen meteen op. ` : ""}Opzeggers nu ${Math.round(aboChurn(p) * 1000) / 10}% per maand.` : `Vraag nu ${Math.round(vraagNa(p))} (capaciteit ${prodCap(s, p)}).`}`; addLog(s, msg); return {ok: true, msg};
}

/* ===================== 3.0 VRAAG EN AANBOD, PRODUCTEIGENSCHAPPEN, PRODUCTGESCHIEDENIS ===================== */
const AARD_SECTOR = {wapen: ["Weapon Manufacturing"], medisch: ["Biotech"], implantaat: ["Cyberware"], data: ["Media & Data"], beveiliging: ["Private Security"], smokkel: ["Smokkel"], logistiek: ["Logistiek"], financieel: ["Financieel"], orbitaal: ["Orbitaal"], consument: []};
function vraagInit(s){ s.vraag ??= {}; for (const a of Object.keys(PRODUCT_AARD)) s.vraag[a] ??= {idx: 100, trend: 0, hist: [100], reden: ""}; }
function vraagSchok(s, aard, v, reden){ vraagInit(s); const x = s.vraag[aard]; if (!x) return; x.trend += v; x.reden = reden; }
function aanbod(s, aard){
  const eigen = (s.producten || []).filter(p => p.status === "markt" && (p.aard || aardVan(p.type, p.naam)) === aard).reduce((a, p) => a + p.kwaliteit * p.pop / 100, 0);
  const secs = AARD_SECTOR[aard] || [];
  const riv = s.rivals.reduce((a, r) => a + (r.producten || []).filter(p => p.aard === aard).reduce((b, p) => b + p.kwaliteit * p.pop / 100, 0), 0) + (aard === "wapen" ? s.rivals.filter(r => r.status === "oorlog").length * 0.5 : 0);
  const bed = (s.bedrijven || []).filter(b => !b.eigenaar && secs.includes(b.sector)).length * 0.25;
  return {eigen: r1(eigen), anderen: r1(riv + bed), totaal: r1(eigen + riv + bed)};
}
function vraagFactor(s, aard){
  const x = (s.vraag || {})[aard]; if (!x) return 1;
  const sup = aanbod(s, aard).totaal, verz = sup / Math.max(0.5, x.idx / 100 * 4);
  return Math.round(clamp(x.idx / 100 * (1.2 - 0.2 * verz), 0.6, 1.6) * 100) / 100;
}
/* 5.3: echte-wereldtijdlijn. Elk item: datum, kop, tekst, schok (eenmalige trend per soort) en basis (blijvende verschuiving van de normale vraag, eventueel tot een datum). */
const TIJDLIJN = [
  {d: "2005-06", kop: "Videoplatforms exploderen", tekst: "Iedereen filmt alles. Data wordt goud.", schok: {data: 0.05}, basis: {data: 5}},
  {d: "2007-06", kop: "De telefoon wordt een computer", tekst: "Een toestel met alleen een scherm verandert hoe mensen kopen, praten en betalen.", schok: {consument: 0.08, data: 0.05}, basis: {consument: 6, data: 5}},
  {d: "2008-09", kop: "Bankencrisis", tekst: "Een grote bank valt om, de rest wankelt. Krediet droogt op.", schok: {financieel: -0.15, consument: -0.06, logistiek: -0.05}, basis: {financieel: -10}, tot: "2011-12"},
  {d: "2009-01", kop: "Een munt zonder bank", tekst: "Een anonieme programmeur lanceert digitaal geld. Nog lacht iedereen.", schok: {financieel: 0.03}},
  {d: "2011-03", kop: "Kernramp", tekst: "Een tsunami raakt een kerncentrale. Medische vraag piekt, energie wordt politiek.", schok: {medisch: 0.06, beveiliging: 0.03}},
  {d: "2013-06", kop: "Massasurveillance gelekt", tekst: "Een klokkenluider toont wat geheime diensten allemaal opslaan. Privacy is ineens een product.", schok: {data: -0.05, beveiliging: 0.06}, basis: {beveiliging: 4}},
  {d: "2014-06", kop: "Drones voor iedereen", tekst: "Voor een paar honderd euro vlieg je een camera boven de stad.", schok: {consument: 0.05, logistiek: 0.03}, basis: {logistiek: 3}},
  {d: "2015-03", kop: "Dronegevechten", tekst: "In conflictgebieden vechten goedkope drones tegen dure tanks. Legers bestellen massaal.", schok: {wapen: 0.08}, basis: {wapen: 6}},
  {d: "2017-12", kop: "Cryptogekte", tekst: "Digitaal geld stijgt duizenden procenten. Iedereen is belegger.", schok: {financieel: 0.1}, basis: {financieel: 4}, tot: "2018-12"},
  {d: "2018-03", kop: "Datahandel-schandaal", tekst: "Een advieskantoor gebruikte profielen van miljoenen mensen. Regulators worden wakker.", schok: {data: -0.06}},
  {d: "2020-03", kop: "Pandemie", tekst: "Een virus legt de wereld stil. Ziekenhuizen lopen vol, pakketten stromen.", schok: {medisch: 0.2, logistiek: 0.1, consument: -0.08, beveiliging: 0.03}, basis: {medisch: 8, logistiek: 5}, tot: "2022-06"},
  {d: "2020-09", kop: "Dronecombat wordt mainstream", tekst: "Een korte oorlog wordt gewonnen met zwermen goedkope drones. Elke defensiebegroting gaat om.", schok: {wapen: 0.12}, basis: {wapen: 6}},
  {d: "2022-02", kop: "Oorlog in Europa", tekst: "Tanks rollen over een grens. Wapenfabrieken draaien in drie ploegen, toeleveringsketens knappen.", schok: {wapen: 0.15, logistiek: -0.05, financieel: -0.04}, basis: {wapen: 8}},
  {d: "2022-11", kop: "Chatbots voor iedereen", tekst: "Een taalmodel dat praat als een mens gaat live. Honderd miljoen gebruikers in twee maanden.", schok: {data: 0.12}, basis: {data: 8}},
  {d: "2023-06", kop: "De AI-golf", tekst: "Elke bedrijf wil AI. Rekenkracht wordt schaars, chips worden geopolitiek.", schok: {data: 0.1, financieel: 0.04}, basis: {data: 6}},
  {d: "2024-01", kop: "Commerciële ruimtevaart", tekst: "Herbruikbare raketten maken een lancering goedkoper dan een zeecontainer van vroeger.", schok: {orbitaal: 0.1}, basis: {orbitaal: 8}},
  {d: "2026-06", kop: "Humanoïde robots", tekst: "De eerste robots met handen staan in fabrieken en magazijnen.", schok: {consument: 0.06, logistiek: 0.05, implantaat: 0.04}, basis: {logistiek: 4}},
  {d: "2028-03", kop: "Neurale interface voor consumenten", tekst: "Een implantaat dat je telefoon vervangt. De wachtlijst is twee jaar.", schok: {implantaat: 0.15}, basis: {implantaat: 10}},
  {d: "2030-01", kop: "De AI-wet", tekst: "Strenge regels voor algoritmen. Wie niet meedoet, betaalt of verhuist.", schok: {data: -0.08, beveiliging: 0.04}, basis: {data: -4}},
  {d: "2032-05", kop: "Privélegers erkend", tekst: "Een verdrag erkent bedrijfslegers als gewapende partij. Beveiliging wordt soevereiniteit.", schok: {beveiliging: 0.12, wapen: 0.06}, basis: {beveiliging: 8, wapen: 4}},
  {d: "2035-01", kop: "Orbitale fabrieken", tekst: "In een baan om de aarde maken fabrieken wat op aarde niet kan.", schok: {orbitaal: 0.12}, basis: {orbitaal: 8}},
  {d: "2038-01", kop: "Chroom-mode", tekst: "Implantaten zijn mode. Wie geen chroom draagt, valt op.", schok: {implantaat: 0.1, consument: 0.04}, basis: {implantaat: 6}},
  {d: "2040-01", kop: "Corporate steden", tekst: "De eerste stad wordt bestuurd door een bedrijf. Andere volgen.", schok: {beveiliging: 0.08, smokkel: 0.05}, basis: {beveiliging: 5}}];
/* 5.4: corpospanning per continent (zoals world tension): stijgt met de tijd, oorlogen, bendeoorlogen, corpomacht en wereldgebeurtenissen */
const SPANNING_FASEN = [[90, "Corporate zone", "De corporaties regeren. De politie kijkt de andere kant op; heat zakt sneller op je eigen continent."], [70, "Privélegers", "Bedrijven zetten eigen legers op straat. Vraag naar wapens en beveiliging piekt; op je eigen continent zakt heat trager."], [50, "Sancties", "Embargo's en sancties. Staten proberen de corporaties terug te dringen; op je eigen continent zakt heat trager."], [30, "Onrust", "Protesten, stakingen en sabotage. De sfeer wordt grimmig."], [0, "Rustig", "Zaken zoals altijd."]];
const spanningFase = v => SPANNING_FASEN.find(([d]) => v >= d);
const SPANNING_TIJDLIJN = {"2015-03": {"Midden-Oosten": 5}, "2020-09": {"Midden-Oosten": 5, "Azië": 3}, "2022-02": {"Europa": 12}, "2032-05": {"*": 8}, "2040-01": {"*": 10}};
function spanningTick(s, ctx){ const S0 = (s.spanning ??= {}), nu = ym(s); for (const c of CONTINENTS) S0[c.naam] ??= RI(8, 25);
  const contVan = id => (s.districts.find(d => d.id === id) || {}).continent, ev = SPANNING_TIJDLIJN[nu];
  for (const c of CONTINENTS){ const n = c.naam, oud = S0[n];
    let d = (0.18 + 0.05 * (s.tijdperk || 0)) * inst(s, "spanning") + U(-0.2, 0.2); /* 6.8: iets sneller */
    d += Math.min(0.35, (((s.handelWapen || {})[n]) || 0) / 60); /* 6.8: wie wapens verkoopt, warmt het continent op */
    d += s.rivals.filter(r => r.status === "oorlog" && contVan(r.hq) === n).length * 0.4;
    d += (s.gangs || []).filter(g => g.deal === "oorlog" && Object.keys(g.gebied || {}).some(id => contVan(id) === n)).length * 0.2;
    d += s.districts.filter(x => x.control === "player" && x.continent === n).length * 0.03;
    if (ev) d += (ev[n] || 0) + (ev["*"] || 0);
    if (oud > 15) d -= 0.04;
    S0[n] = Math.round(clamp(oud + d, 0, 100) * 10) / 10;
    const f0 = spanningFase(oud), f1 = spanningFase(S0[n]); if (f1[0] > f0[0]){ const ef = spanningEffecten(s, n).filter(e => e.soort === "vraag").map(e => e.t).join(", "); news(s, `${n}: ${f1[1]}`, `De corpospanning in ${n} loopt op tot ${Math.round(S0[n])}. ${f1[2]}${ef ? ` Vraag daar nu: ${ef}.` : ""}`, n, "wereld", true); ctx.rep.push(`Corpospanning ${n}: ${f1[1]}${ef ? ` (${ef})` : ""}`);
      if (n === exportThuis(s)) mail(ctx, s, "Strategie", `Thuiscontinent: ${f1[1]}`, `De corpospanning in ${n} staat op ${Math.round(S0[n])}. ${f1[2]} Wat dit voor ons betekent: ${spanningEffecten(s, n).map(e => e.t).join(", ") || "nog weinig"}. Alles staat bij Wereld → Corpospanning.`, f1[0] >= 70 ? "HOOG" : "NORMAAL"); } } }
/* 5.4.1: Sancties en Privélegers op je thuiscontinent: staten zitten corporaties op de huid (heat zakt trager); Corporate zone: politie kijkt weg */
const spanningThuis = s => (s.spanning || {})[(s.districts.find(x => x.id === s.player.home_district) || {}).continent] || 0;
const spanningHeat = s => { const v = spanningThuis(s); return (v >= 90 ? 1 : v >= 50 ? -0.6 : 0) + (heeftWet(s, "immuniteit") ? 0.8 : 0); };
/* 5.5: straatoorlog en corpomacht. Bij hoge spanning mag je eigen beveiliging de straat op, vecht je om districten zonder oorlogsverklaring en koop je corpowetten met invloed. Meer macht = meer mogen. */
const spanningVan = (s, cont) => (s.spanning || {})[cont] || 0;
/* 6.14: wat een oorlog verklaren kost hangt af van de corpospanning thuis: in een corporate zone is het een corpo-oorlog, zonder rem van de staat */
const oorlogPrijs = s => { const v = spanningThuis(s); return v >= 90 ? {rep: 0, heat: 0, wantrouw: 0, corpo: true} : v >= 70 ? {rep: 2, heat: 1, wantrouw: 2, corpo: false} : {rep: 4, heat: 3, wantrouw: 5, corpo: false}; };
const CORPO_LADDER = [
  {v: 0, naam: "Rustig", kort: "Zaken zoals altijd. De staat houdt de corporaties in toom.", jij: ["Producten, contracten, districten kopen en aanwezigheid opbouwen", "Oorlog verklaren kan, maar de staat let op: reputatie −4, heat +3, andere rivalen worden wantrouwig"], riv: ["Concurreren, lobbyen, headhunten", "Een ultimatum stellen; weiger je, dan is het oorlog"]},
  {v: 30, naam: "Onrust", kort: "Protesten en sabotage. De staat verliest grip op de straat.", jij: ["Wapens en beveiliging verkopen beter, consumentenspul slechter", "Je aandeel in districten groeit makkelijker: de staat telt minder mee"], riv: ["Hetzelfde voordeel als jij"]},
  {v: 50, naam: "Sancties", kort: "Staten slaan terug met embargo's en sancties.", jij: ["Embargo op export: alleen met een smokkelroute verkoop je wapens nog over de grens", "De Privébeveiligingswet kopen: dan mag je al patrouilleren", "Op je thuiscontinent zakt heat trager"], riv: ["Hetzelfde embargo"]},
  {v: 70, naam: "Privélegers", kort: "Corporaties zetten eigen legers op straat.", jij: ["Patrouilles in je districten (macht +2, bendes en rivalen krijgen minder grip)", "Straatgevechten: een district van een rivaal innemen zonder oorlogsverklaring", "Bedrijfsimmuniteit en de Belastingvrije corpozone kopen", "Oorlog verklaren kost minder: reputatie −2, heat +1"], riv: ["Rivalen die je niet mogen, nemen ook districten van jou op straat (hooguit één per maand)"]},
  {v: 90, naam: "Corporate zone", kort: "De corporaties regeren. Corpo-oorlogen: geen staat die ingrijpt.", jij: ["Corpo-oorlog: oorlog verklaren kost geen reputatie en geen heat, andere rivalen vinden het normaal", "Eigen rechtspraak kopen: een razzia lukt half zo vaak", "Heat zakt sneller, het embargo is weg", "Winnen: een corporate zone thuis met 60% dominantie"], riv: ["Vijandige rivalen (relatie onder −40) kunnen jou zelf de oorlog verklaren, zonder ultimatum"]}];
const corpoTrede = v => CORPO_LADDER.slice().reverse().find(x => v >= x.v) || CORPO_LADDER[0];
/* 6.8: alle gevolgen van de spanning op één continent, in gewone taal (voor het tabblad, de header en het nieuws) */
const SPANNING_AARD_LABEL = {wapen: "Wapens", beveiliging: "Beveiliging", smokkel: "Smokkel", medisch: "Medisch", consument: "Consument", financieel: "Financieel", logistiek: "Logistiek"};
function spanningEffecten(s, cont){ const v = spanningVan(s, cont), out = [], thuis = cont === exportThuis(s);
  for (const a of Object.keys(SPANNING_VRAAG)){ const f = spanningVraagF(a, v); if (Math.abs(f - 1) >= 0.03) out.push({t: `${SPANNING_AARD_LABEL[a]} ×${f.toFixed(2)}`, goed: f > 1, soort: "vraag"}); }
  if (v >= 50 && v < 90) out.push({t: "Embargo op export", goed: false, soort: "export"});
  if (thuis && v >= 90) out.push({t: "Heat zakt sneller", goed: true, soort: "heat"}); else if (thuis && v >= 50) out.push({t: "Heat zakt trager", goed: false, soort: "heat"});
  if (v >= patrouilleDrempel(s)) out.push({t: "Patrouilles mogen", goed: true, soort: "macht"});
  if (v >= STRAAT.drempel) out.push({t: "Straatgevechten", goed: null, soort: "macht"});
  if (v >= 30) out.push({t: `Staat ${Math.round(v)}% zwakker`, goed: true, soort: "dom"});
  return out; }
const CORPOWETTEN = {
  beveiliging: {label: "Privébeveiligingswet", fase: 50, inv: 20, cash: 15, macht: 0, uitleg: "Patrouilles mogen al vanaf 50 spanning (Sancties), kosten €0,8M in plaats van €1,5M per maand en geven geen heat."},
  immuniteit: {label: "Bedrijfsimmuniteit", fase: 70, inv: 35, cash: 40, macht: 40, uitleg: "Heat zakt elke maand 0,8 extra."},
  zone: {label: "Belastingvrije corpozone", fase: 70, inv: 40, cash: 50, macht: 50, uitleg: "Winstbelasting 5 procentpunt lager."},
  rechtspraak: {label: "Eigen rechtspraak", fase: 90, inv: 60, cash: 80, macht: 65, uitleg: "Bij heat boven 90 lukt een razzia maar half zo vaak."},
};
const heeftWet = (s, k) => !!(s.wetten || {})[k];
const patrouilleDrempel = s => heeftWet(s, "beveiliging") ? 50 : 70;
const patrouilleMag = (s, d) => !!d && d.control === "player" && spanningVan(s, d.continent) >= patrouilleDrempel(s);
const patrouilleKost = s => heeftWet(s, "beveiliging") ? 0.8 : 1.5;
const patrouilles = s => Object.keys(s.patrouille || {}).filter(id => (s.districts.find(d => d.id === id) || {}).control === "player");
const STRAAT = {kost: 12, drempel: 70};
const straatKost = s => r1(STRAAT.kost * (DIFF[s.player.difficulty] || 1));
function straatKans(s, d){ const r = s.rivals.find(x => x.name === d.control); if (!r) return 0;
  const buur = (d.neighbors || []).filter(n => (s.patrouille || {})[n] && (s.districts.find(x => x.id === n) || {}).control === "player").length;
  return warChance(s, r, 5 + Math.min(3, buur) * 6 + (spanningVan(s, d.continent) >= 90 ? 5 : 0)); }
const straatDoelen = s => s.districts.filter(d => d.control !== "player" && d.control !== "neutral" && spanningVan(s, d.continent) >= STRAAT.drempel && s.rivals.some(r => r.name === d.control && r.hq !== d.id) && reachable(s, "player", d));
function wetStatus(s, k){ const w = CORPOWETTEN[k], thuis = spanningThuis(s), macht = playerPower(s);
  if (heeftWet(s, k)) return {ok: false, reden: "van kracht", actief: true};
  if (thuis < w.fase) return {ok: false, reden: `pas vanaf ${w.fase} spanning op je thuiscontinent (nu ${Math.round(thuis)})`};
  if (macht < w.macht) return {ok: false, reden: `je macht moet minstens ${w.macht} zijn (nu ${macht})`};
  if ((s.invloed || 0) < w.inv) return {ok: false, reden: `${w.inv} invloed nodig (je hebt ${Math.floor(s.invloed || 0)})`};
  if (s.cash < w.cash) return {ok: false, reden: `€${w.cash}M nodig`};
  return {ok: true, reden: ""}; }
function actCorpo(s, ctx, soort, id){
  if (soort === "patrouille"){ const d = s.districts.find(x => x.id === id); if (!d || d.control !== "player") return {ok: false, msg: "Kies een district van jezelf."};
    const P = (s.patrouille ??= {}); if (P[id]){ delete P[id]; addLog(s, `Patrouille in ${d.name} gestopt`); return {ok: true, msg: `Patrouille in ${d.name} gestopt.`}; }
    if (!patrouilleMag(s, d)) return {ok: false, msg: `In ${d.continent} mag dat pas vanaf ${patrouilleDrempel(s)} corpospanning (nu ${Math.round(spanningVan(s, d.continent))}).`};
    P[id] = ym(s); addLog(s, `Patrouille in ${d.name} gestart`);
    return {ok: true, msg: `Eigen beveiliging patrouilleert in ${d.name}: €${patrouilleKost(s)}M per maand, bendes krijgen minder grip, je macht +2${heeftWet(s, "beveiliging") ? "" : ", heat +0,25 per maand"}.`}; }
  if (soort === "straat"){ const d = s.districts.find(x => x.id === id); if (!d || !straatDoelen(s).includes(d)) return {ok: false, msg: `Hier kun je niet op straat vechten. Het district moet van een rivaal zijn (niet hun HQ), aan je gebied grenzen en op een continent met minstens ${STRAAT.drempel} spanning liggen.`};
    const r = s.rivals.find(x => x.name === d.control), kost = straatKost(s); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
    s.cash = r1(s.cash - kost); const kans = straatKans(s, d), roll = rolKans(kans), zone = spanningVan(s, d.continent) >= 90 ? 0.5 : 1;
    addRoll(s, `Straatgevecht om ${d.name} tegen ${r.name}: ${roll.txt} → ${roll.ok ? "GELUKT" : "MISLUKT"}`); let msg;
    if (roll.ok){ d.control = "player"; relShift(r, -15); r.moeheid = clamp(r.moeheid + 8); s.heat = clamp(s.heat + 5 * zone); s.spanning[d.continent] = r1(Math.min(100, spanningVan(s, d.continent) + 1));
      msg = `Onze mensen hebben ${d.name} op straat veroverd. ${r.name} is het district kwijt.`; remember(r, s, "straatgevecht door speler");
      news(s, `Straatgevecht in ${d.name}`, `Gepantserde wagens, rookgranaten, een nacht lang. Bij zonsopgang hangen er andere logo's in ${d.name}.`, d.continent, "wereld", true); }
    else { const l = r1(U(4, 10)); s.cash = r1(s.cash - l); relShift(r, -8); s.heat = clamp(s.heat + 3 * zone); msg = `Het straatgevecht om ${d.name} is mislukt. €${l}M schade en ${r.name} weet wie het was.`; }
    mail(ctx, s, roll.ok ? "Head of Security" : "Juridische Zaken", `Straatgevecht om ${d.name}: ${roll.ok ? "gelukt" : "mislukt"}`, msg + ` (Worp ${roll.txt}.)`, roll.ok ? "NORMAAL" : "HOOG");
    addLog(s, msg); s.accounts.operationeel = s.cash; return {ok: true, msg: msg + ` Worp ${roll.txt}.`}; }
  if (soort === "wet"){ const w = CORPOWETTEN[id]; if (!w) return {ok: false, msg: "Onbekende wet."}; const st = wetStatus(s, id); if (!st.ok) return {ok: false, msg: `${w.label}: ${st.reden}.`};
    s.invloed = r1(s.invloed - w.inv); s.cash = r1(s.cash - w.cash); (s.wetten ??= {})[id] = ym(s); s.accounts.operationeel = s.cash;
    news(s, `${w.label} aangenomen`, `Na een stille stemming en een paar dure diners ligt er een nieuwe wet. ${s.player.corp_name} staat niet in de tekst, maar iedereen weet voor wie hij is.`, "", "wereld", true);
    addLog(s, `Corpowet ${w.label} gekocht (${w.inv} invloed, €${w.cash}M)`); return {ok: true, msg: `${w.label} is van kracht: ${w.uitleg}`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function corpoTick(s, ctx){
  if (spanningThuis(s) >= 90 && !s.rivals.some(r => r.status === "oorlog")){ /* 6.14: corpo-oorlog van een vijandige rivaal, hooguit één tegelijk */
    const r = s.rivals.find(x => x.status === "vrede" && (x.relatie || 0) < -40 && !(x.verdragen || []).length); if (r && kansRol() < 0.04 + (r.aggression || 0) * 0.04){
      r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; r.corpo = true; remember(r, s, "verklaarde de speler een corpo-oorlog");
      mail(ctx, s, r.ceo || r.name, `Corpo-oorlog: ${r.name}`, `Geen ultimatum, geen advocaten. In een corporate zone hoeft dat niet meer. ${r.name} verklaart ${s.player.corp_name} de oorlog. De staat kijkt weg. Vrede kan, bij Rivalen, als je ze genoeg pijn doet of betaalt.`, "KRITIEK");
      news(s, `Corpo-oorlog: ${r.name} tegen ${s.player.corp_name}`, `In de corporate zone verklaart ${r.name} openlijk de oorlog. Niemand belt de politie; die werkt er inmiddels.`, "", "wereld", true); ctx.rep.push(`${r.name} verklaart je een corpo-oorlog`); } }
  if (s.patrouille) s.patrouille = Object.fromEntries(patrouilles(s).map(id => [id, s.patrouille[id]]));
  /* rivalen die je niet mogen vechten bij hoge spanning ook op straat, zonder oorlogsverklaring: hooguit één gevecht per maand */
  for (const r of s.rivals){ if (r.status === "oorlog" || (r.relatie || 0) > -20) continue;
    const doel = playerDistricts(s).filter(d => d.id !== s.player.home_district && spanningVan(s, d.continent) >= STRAAT.drempel && reachable(s, r.name, d));
    if (!doel.length || kansRol() >= 0.03 + (r.aggression || 0) * 0.03) continue;
    const d = CH(doel), pat = !!(s.patrouille || {})[d.id], hit = R() * 100 < rivalHitChance(s, r, pat ? -25 : 0);
    if (hit){ d.control = r.name; if (s.patrouille) delete s.patrouille[d.id]; mail(ctx, s, "Head of Security", `${r.name} neemt ${d.name} op straat`, `Zonder oorlogsverklaring, zonder waarschuwing: privélegers van ${r.name} hebben ${d.name} ingenomen. In deze spanning grijpt niemand in.${pat ? "" : " Een patrouille had het moeilijker gemaakt."}`, "KRITIEK"); ctx.rep.push(`${r.name} neemt ${d.name} op straat`); }
    else { mail(ctx, s, "Head of Security", `Straatgevecht in ${d.name} afgeslagen`, `${r.name} probeerde ${d.name} op straat in te nemen. ${pat ? "Onze patrouille hield stand." : "We hielden stand, deze keer."}`, "NORMAAL"); ctx.rep.push(`Straatgevecht in ${d.name} afgeslagen`); }
    break; } }
/* 5.6: gebied als dominantie. Elk district is verdeeld in aandelen (eigenaar, jij, rivalen, bendes, de staat), net als de zee. Je aandeel groeit door aanwezigheid, patrouilles en buren; continenten en hegemonie tellen aandelen in plaats van eigenaars. */
const DOM_FLIP = 55, DOM_INKOMEN_MIN = 20;
function domDoel(s, d, idx){ const o = {}, sp = spanningVan(s, d.continent), staatF = 1 - sp / 100;
  if (d.control !== "neutral") o[d.control] = 100;
  o.staat = d.control === "neutral" ? 5 + 40 * staatF : 15 * staatF;
  const A = s.aanwezig || {}; if (A[d.id]) o.player = (o.player || 0) + A[d.id];
  const H = handelAanwezig(s, d.continent); if (H) o.player = (o.player || 0) + H; /* 6.8: wie veel verkoopt op een continent, is daar overal aanwezig */
  for (const [rn, RA] of Object.entries(s.rivAanwezig || {})) if (RA[d.id]) o[rn] = (o[rn] || 0) + RA[d.id]; /* 6.2: rivalen bouwen ook aanwezigheid op */
  if ((s.patrouille || {})[d.id] && d.control === "player") o.player = (o.player || 0) + 15;
  const adj = {}; for (const n of d.neighbors || []){ const b = idx ? idx.get(n) : s.districts.find(x => x.id === n); if (b && b.control !== "neutral") adj[b.control] = (adj[b.control] || 0) + 4; }
  for (const [k, v] of Object.entries(adj)) o[k] = (o[k] || 0) + Math.min(12, v);
  for (const r of s.rivals) if (r.hq === d.id) o[r.name] = (o[r.name] || 0) + 20;
  for (const g of s.gangs || []){ const v = (g.gebied || {})[d.id]; if (v >= 5) o["bende:" + g.naam] = v * 0.4; }
  const tot = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / tot * 100])); }
const domVan = (s, d) => d.dom || domDoel(s, d);
const domEigenaar = (s, d) => { const D = domVan(s, d); return d.control === "neutral" ? (D.staat || 0) : (D[d.control] || 0); };
const aanwezigKost = (s, d) => r1(Math.max(2, districtCost(s, d) * 0.15)); /* 6.8: was een kwart van een vestiging */
const AANWEZIG_STAP = 20, HANDEL_MAX = 20;
/* 6.8: concurreren via handel. Je omzet per continent (producten verdeeld over hun markten; wapens/beveiliging/implantaten alleen thuis en waar je een vergunning hebt) geeft je aanwezigheid in elk district daar. */
function productContinenten(s, p){ const aard = p.aard || aardVan(p.type, p.naam);
  if (EXPORT_AARD.includes(aard)){ const L = [exportThuis(s), ...Object.keys(s.exportVergunning || {}).filter(c => !embargo(s, c) || (s.smokkelroute || {})[c])].filter(Boolean); return [...new Set(L)].map(c => [c, 1 / new Set(L).size]); }
  const M = regioMarkten(p).filter(c => REGIO[c]), tw = M.reduce((a, c) => a + REGIO[c].w, 0) || 1; return M.map(c => [c, REGIO[c].w / tw]); }
function handelTick(s){ const H = {}, W = {};
  for (const p of (s.producten || []).filter(x => x.status === "markt")){ const o = ((s.prodomzet || {})[p.id] || 0) + ((s.exportOmzet || {})[p.id] || 0); if (!(o > 0)) continue; const aard = p.aard || aardVan(p.type, p.naam);
    for (const [c, f] of productContinenten(s, p)){ H[c] = (H[c] || 0) + o * f; if (aard === "wapen" || aard === "beveiliging") W[c] = (W[c] || 0) + o * f; } }
  s.handel = Object.fromEntries(Object.entries(H).map(([k, v]) => [k, r1(v)])); s.handelWapen = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, r1(v)])); }
const handelAanwezig = (s, cont) => { const v = (s.handel || {})[cont] || 0; return v > 0 ? Math.min(HANDEL_MAX, Math.round(Math.sqrt(v) * 5 * 10) / 10) : 0; };
const aanwezigMag = (s, d) => !!d && reachable(s, "player", d);
function aandeelInkomen(s){ let geld = 0, n = 0; for (const d of s.districts){ if (d.control === "player" || !d.dom) continue; const v = d.dom.player || 0; if (v >= DOM_INKOMEN_MIN){ geld += incOf(d) * v / 100 * 0.4; n++; } } return {geld: r1(geld), n}; }
function actAanwezig(s, ctx, id){ const d = s.districts.find(x => x.id === id); if (!d) return {ok: false, msg: "Onbekend district."};
  if (!aanwezigMag(s, d)) return {ok: false, msg: `${d.name} grenst niet aan jouw gebied en ligt niet aan een zee die jij beheerst.`};
  const kost = aanwezigKost(s, d); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  const A = (s.aanwezig ??= {}); if ((A[d.id] || 0) >= 150) return {ok: false, msg: `Je aanwezigheid in ${d.name} is al maximaal.`};
  s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash; A[d.id] = Math.min(150, r1((A[d.id] || 0) + AANWEZIG_STAP));
  const r = s.rivals.find(x => x.name === d.control); if (r){ relShift(r, -4); remember(r, s, `speler bouwt aanwezigheid in ${d.name}`); }
  addLog(s, `Aanwezigheid in ${d.name} +${AANWEZIG_STAP} (€${kost}M)`);
  return {ok: true, msg: `Kantoren, sponsoring, mensen op straat: je aanwezigheid in ${d.name} groeit (+${AANWEZIG_STAP}, zakt 5% per maand). ${d.control === "player" ? "Je houdt je greep sterker." : `Boven ${DOM_FLIP}% en meer dan de ${d.control === "neutral" ? "staat" : "eigenaar"}, twee maanden lang, wordt het district van jou.`}${r ? ` ${r.name} vindt het niets: relatie −4.` : ""}`}; }
function domTick(s, ctx){ handelTick(s);
  const idx = new Map(s.districts.map(x => [x.id, x])), hqs = new Set(s.rivals.map(r => r.hq));
  for (const d of s.districts){ const doel = domDoel(s, d, idx), oud = d.dom || doel, nw = {};
    for (const k of new Set([...Object.keys(oud), ...Object.keys(doel)])){ const v = (oud[k] || 0) + ((doel[k] || 0) - (oud[k] || 0)) * 0.4; if (v >= 0.5) nw[k] = Math.round(v * 10) / 10; }
    d.dom = nw; }
  rivAanwezigTick(s, ctx, idx, hqs);
  for (const d of s.districts){ if (d.control === "player" || hqs.has(d.id)){ delete d.domMnd; continue; }
    const pj = d.dom.player || 0, eig = domEigenaar(s, d);
    if (pj >= DOM_FLIP && pj > eig) d.domMnd = (d.domMnd || 0) + 1; else delete d.domMnd;
    if ((d.domMnd || 0) >= 2){ const r = s.rivals.find(x => x.name === d.control), van = d.control; d.control = "player"; delete d.domMnd;
      if (r){ relShift(r, -12); remember(r, s, `verloor ${d.name} aan de dominantie van de speler`); }
      const txt = `${d.name} is van jou: je aandeel (${Math.round(pj)}%) is groter dan dat van ${van === "neutral" ? "de staat" : van}. Zonder één schot.`;
      mail(ctx, s, "Strategie", `${d.name} valt jou toe`, txt + (r ? ` ${r.name} is woedend: relatie −12.` : ""), "NORMAAL"); ctx.rep.push(`${d.name} valt jou toe door dominantie`);
      news(s, `${s.player.corp_name} neemt ${d.name} over`, `Geen tanks, geen bod: gewoon overal hun logo, hun mensen en hun geld. ${d.name} draait nu op ${s.player.corp_name}.`, d.continent, "wereld", true); addLog(s, txt); } }
  if (s.aanwezig) for (const k of Object.keys(s.aanwezig)){ s.aanwezig[k] = r1(s.aanwezig[k] * 0.95); if (s.aanwezig[k] < 1) delete s.aanwezig[k]; } }
/* 5.8: mensen doen echt werk. Taken die je aan iemand in de directie geeft: die persoon doet ze elke maand voor je, met talent (1-5) en loyaliteit. Lage loyaliteit = soms laten liggen. */
const ASSISTENT_TAKEN = {
  facturen: {label: "Facturen betalen", rol: "CFO", re: /\bcfo\b|financ/i, uitleg: "Betaalt elke vervallen factuur zolang er €20M in kas blijft. Talent 4+: onderhandelt 5% korting."},
  budget: {label: "Kas bewaken", rol: "CFO", re: /\bcfo\b|financ/i, uitleg: "Houdt €30M buffer: haalt zwart geld naar operationeel of leent klein bij tekort, lost schuld af bij ruim overschot."},
  prijzen: {label: "Prijzen zetten", rol: "Verkoopchef", re: /verkoop|sales/i, uitleg: "Zet elke maand elk product op de prijs met de meeste winst (nooit boven 150%). Het effect zie je in het maandrapport."},
  werven: {label: "Personeel werven", rol: "HR-manager", re: /\bhr\b|personeel/i, uitleg: "Neemt mensen aan tot je personeel op het nodige niveau is (zolang er €40M in kas blijft)."},
  ontwikkelen: {label: "Producten voorstellen", rol: "Hoofd R&D", re: /r&d|onderzoek/i, uitleg: "Start een nieuw product zodra een divisie plek heeft en er geld is. Talent 4+: middelgrote producten."},
  straat: {label: "Straat bewaken", rol: "Head of Security", re: /security|beveilig/i, uitleg: "Zet patrouilles in districten die een rivaal op straat kan innemen."},
};
const ASSISTENT_ROLLEN = ["CFO", "Verkoopchef", "HR-manager", "Hoofd R&D", "Head of Security"];
const GEHEIMEN = ["Solliciteert stiekem bij een rivaal.", "Heeft een gokschuld.", "Speelt informatie door aan een journalist.", "Was ooit veroordeeld voor fraude.", "Heeft geen geheimen. Verdacht.", "Werkt 's nachts voor een bende."];
const taakDoener = (s, k) => { const T = ASSISTENT_TAKEN[k]; return T ? (s.npcs || []).find(n => !n.verraad && T.re.test(n.role || "")) || null : null; };
const talentVan = n => n ? (n.talent ?? 3) : 0;
const aannemenKost = s => r1(5 * (DIFF[s.player.difficulty] || 1));
function assistentDoet(s, ctx, k){ if (!(s.taken || {})[k]) return null; const n = taakDoener(s, k); if (!n) return null;
  if (n.loyalty < 30 && kansRol() < 0.4){ ctx.rep.push(`${n.name} liet "${ASSISTENT_TAKEN[k].label.toLowerCase()}" liggen (loyaliteit laag)`); return null; } return n; }
function actTaak(s, ctx, k, aan){ const T = ASSISTENT_TAKEN[k]; if (!T) return {ok: false, msg: "Onbekende taak."}; const n = taakDoener(s, k);
  if (aan && !n) return {ok: false, msg: `Niemand in de directie kan dit. Neem een ${T.rol} aan.`};
  (s.taken ??= {})[k] = !!aan; if (!aan) delete s.taken[k];
  return {ok: true, msg: aan ? `${n.name} (${n.role}) doet voortaan: ${T.label.toLowerCase()}.` : `${T.label}: weer zelf doen.`}; }
function actAannemen(s, ctx, rol){ if (!ASSISTENT_ROLLEN.includes(rol)) return {ok: false, msg: "Onbekende functie."};
  if ((s.npcs || []).some(n => !n.verraad && n.role === rol)) return {ok: false, msg: `Je hebt al een ${rol}.`};
  const kost = aannemenKost(s); if (s.cash < kost) return {ok: false, msg: `Werving kost €${kost}M.`};
  const talent = RI(2, 5), n = {name: genCeoNaam(new Set(s.npcs.map(x => x.name))), role: rol, loyalty: RI(45, 65), ambition: RI(20, 75), secret: CH(GEHEIMEN), talent, loon: r1(0.2 + 0.15 * talent), sinds: ym(s)};
  s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash; s.npcs.push(n); addLog(s, `${n.name} aangenomen als ${rol} (talent ${talent})`);
  return {ok: true, msg: `${n.name} begint als ${rol}. Talent ${talent} van 5, loon €${n.loon}M per maand. Geef ${n.name} taken bij Mensen → Assistenten.`}; }
const directieLoon = s => r1((s.npcs || []).filter(n => !n.verraad && n.loon).reduce((a, n) => a + n.loon, 0));
function assistentTick(s, ctx){ if (!s.taken) return; const R0 = [];
  { const n = assistentDoet(s, ctx, "budget"); if (n){
    if (s.cash < 30 && s.accounts.zwart > 5){ const b = Math.floor(Math.min(s.accounts.zwart, 40 - s.cash)); if (b > 0){ const r = actTransfer(s, ctx, "zwart", "operationeel", b); if (r.ok) R0.push(`${n.name}: €${b}M zwart naar operationeel`); } }
    else if (s.cash < 10){ const b = Math.min(30, Math.max(5, loanCap(s))); if (b >= 5){ const r = actLoan(s, b); if (r.ok) R0.push(`${n.name}: lening van €${b}M`); } }
    else if (s.cash > 200 && s.debt > 0){ const b = r1(Math.min(s.debt, s.cash - 150)); const r = actRepay(s, b); if (r.ok) R0.push(`${n.name}: €${b}M schuld afgelost`); } } }
  { const n = assistentDoet(s, ctx, "prijzen"); if (n){ let k = 0; for (const p of (s.producten || []).filter(x => x.status === "markt")){ const b = besteprijs(s, p), nf = b ? Math.min(b.f, 1.5) : null; if (nf && Math.abs(nf - prijsF(p)) >= 0.05 && actPrijs(s, p.id, nf).ok) k++; } if (k) R0.push(`${n.name}: ${k} prijs(en) aangepast`); } }
  { const n = assistentDoet(s, ctx, "werven"); if (n){ const tekort = staffNeed(s) - s.staff.count; if (tekort > 0){ const m = Math.min(50, tekort, Math.floor((s.cash - 40) / 0.4)); if (m > 0 && actStaff(s, "huren", m).ok) R0.push(`${n.name}: ${m} mensen aangenomen`); } } }
  { const n = assistentDoet(s, ctx, "ontwikkelen"); if (n) for (const d of s.divisions){ if ((d.autoDev || {}).aan) continue; const nm = divNaam(d), alle = (s.producten || []).filter(p => p.divisie === nm && p.status !== "teruggeroepen");
    if (alle.length >= maxProducten(d) || alle.some(p => p.status === "ontwikkeling" || p.status === "wachtrij")) continue; const schaal = talentVan(n) >= 4 ? "middel" : "klein", plan = devPlan(s, d, schaal, "standaard", aardVan(d.type, "")), kost = (s.gratisDev || 0) > 0 ? 0 : plan.kost;
    if (s.cash < kost + 40) continue; const r = actProduct(s, ctx, "ontwikkel", {divisie: nm, schaal, focus: "standaard"}); if (r.ok){ R0.push(`${n.name}: nieuw product in ${nm}`); break; } } }
  { const n = assistentDoet(s, ctx, "straat"); if (n) for (const r of s.rivals){ if (r.status === "oorlog" || (r.relatie || 0) > -20) continue; for (const d of playerDistricts(s)) if (d.id !== s.player.home_district && !(s.patrouille || {})[d.id] && patrouilleMag(s, d) && reachable(s, r.name, d) && s.cash > 40){ if (actCorpo(s, ctx, "patrouille", d.id).ok) R0.push(`${n.name}: patrouille in ${d.name}`); } } }
  if (R0.length) ctx.rep.push(...R0); }
/* 5.9: klanten komen naar jou. Staten, legers, bedrijven en syndicaten vragen een levering of een raamcontract aan. Je schrijft in (laag, normaal of hoog geprijsd) tegen rivalen met producten van dezelfde soort; de worp beslist. Syndicaten betalen zwart en geven heat. */
const KLANT_SOORT = {
  staat: {label: "Staat", namen: ["Ministerie van Defensie", "Ministerie van Binnenlandse Zaken", "Grenswacht", "Nationale Gezondheidsdienst", "Havenautoriteit", "Nationale Politie"], aard: ["wapen", "beveiliging", "medisch", "data", "logistiek", "financieel"], rep: true},
  leger: {label: "Leger", namen: ["Generale Staf", "Expeditieleger", "Luchtmacht", "Marine", "Ruimtecommando"], aard: ["wapen", "beveiliging", "orbitaal", "logistiek", "implantaat"], rep: true},
  bedrijf: {label: "Bedrijf", namen: [], aard: Object.keys(PRODUCT_AARD), rep: true},
  syndicaat: {label: "Syndicaat", namen: [], aard: ["wapen", "smokkel", "implantaat", "medisch"], zwart: true, heat: 4},
};
const AANVRAAG_PRIJS = {laag: {label: "Scherp", f: 0.85, mod: 15}, normaal: {label: "Normaal", f: 1, mod: 0}, hoog: {label: "Hoog", f: 1.2, mod: -15}};
const AANVRAAG_MARGE = 0.45; /* 6.0: was 0,55 */
const besteVanAard = (s, aard) => (s.producten || []).filter(p => p.status === "markt" && (p.aard || aardVan(p.type, p.naam)) === aard).sort((a, b) => b.kwaliteit - a.kwaliteit || bereik(b) - bereik(a))[0] || null;
const aanvraagRivalen = (s, aard) => s.rivals.filter(r => (r.producten || []).some(p => p.aard === aard));
/* 6.8.1: een contract voor een bepaald product telt dat product, niet je beste van de soort */
const aanvraagProduct = (s, a) => (a.product && (s.producten || []).find(x => x.id === a.product && x.status === "markt")) || besteVanAard(s, a.aard);
function aanvraagKans(s, a, prijs){ const p = aanvraagProduct(s, a), P = AANVRAAG_PRIJS[prijs] || AANVRAAG_PRIJS.normaal; if (!p) return 0; const K = KLANT_SOORT[a.soort] || {};
  const g = a.gang ? (s.gangs || []).find(x => x.id === a.gang) : null, riv = aanvraagRivalen(s, a.aard).length;
  return snapKans(Math.round(clamp(62 + (p.kwaliteit - 3) * 10 + P.mod + (K.rep ? (s.reputation - 30) / 4 : (g ? g.relatie / 4 : 0)) - riv * 4 - (p.kwaliteit < a.minKwal ? 20 : 0) + (a.product ? 18 : 0), 5, a.product ? 95 : 92))); /* 6.8: betere kansen; 6.8.1: contracten voor zware producten +18 */ }
function maakAanvraag(s, aard0){ const p0 = (s.producten || []).filter(p => p.status === "markt"); if (!p0.length) return null;
  const aard = aard0 || (p0[Math.floor(R() * p0.length)].aard || aardVan(p0[0].type, p0[0].naam)), soorten = Object.keys(KLANT_SOORT).filter(k => KLANT_SOORT[k].aard.includes(aard) && (k !== "syndicaat" || (s.gangs || []).length) && (k !== "bedrijf" || (s.bedrijven || []).some(b => !b.eigenaar)));
  if (!soorten.length) return null; const soort = CH(soorten), K = KLANT_SOORT[soort], land = CH(s.districts.filter(d => d.control !== "player")) || s.districts[0];
  let klant, gang = null; if (soort === "bedrijf") klant = CH((s.bedrijven || []).filter(b => !b.eigenaar)).naam; else if (soort === "syndicaat"){ const g = CH(s.gangs); klant = g.naam; gang = g.id; } else klant = `${CH(K.namen)} (${land.name})`;
  const p = besteVanAard(s, aard), basis = Math.max(1, p ? prodOmzet(s, p) : 2), raam = R() < 0.4, I = p ? stukInfo(p) : {eenheid: "stuks"};
  const a = {id: "a" + hex8(), m: ym(s), soort, klant, gang, aard, raam, minKwal: clamp((p ? p.kwaliteit : 3) + RI(-2, 0), 1, 5), verloopt: 3}; /* 5.10.1/6.8: haalbaar, drie maanden geldig */
  if (raam){ a.maanden = CH([6, 12, 18, 24]); a.perMaand = r1(basis * U(0.3, 0.6)); } else a.bedrag = r1(basis * U(2, 5));
  a.tekst = `${klant} zoekt ${raam ? `een raamcontract voor ${a.maanden} maanden` : "een eenmalige levering"}: ${PRODUCT_AARD[aard].label.toLowerCase()}, minimaal kwaliteit ${a.minKwal}.`;
  return a; }
/* 6.10: bedrijven komen zelf met een leveringscontract: geen kosten vooraf en geen worp, of hoger inzetten voor meer geld */
function bedrijfAanbodTick(s, ctx){ const open = (s.keuzes || []).filter(k => /^bedrijfaanbod_/.test(k.soort || ""));
  if (open.length >= 2 || kansRol() >= clamp(0.25 + (s.reputation - 30) / 200, 0.15, 0.45)) return;
  const L = (s.bedrijven || []).filter(b => !b.eigenaar && !b.contract && b.relatie > -30 && !open.some(k => k.soort === "bedrijfaanbod_" + b.id)); if (!L.length) return;
  const b = CH(L), bedrag = bedrijfOpties(s, b).contract.bedrag, hoog = r1(Math.min(8, bedrag * 1.4)), kans = snapKans(Math.round(clamp(45 + b.relatie / 2 + (s.reputation - 30) / 3, 15, 85)));
  addKeuze(s, ctx, {soort: "bedrijfaanbod_" + b.id, van: b.ceo ? `${b.ceo} (${b.naam})` : b.naam, titel: `${b.naam} wil een leveringscontract`, tekst: `${b.naam} (${b.sector}, ${landNaam(s, b.land)}) wil vast met ons werken: ±€${bedrag}M per maand, zonder kosten vooraf. Tekenen kan meteen. Hoger inzetten kan ook: €${hoog}M per maand, maar dan kunnen ze afhaken.`,
    opties: [{label: `Tekenen (€${bedrag}M/mnd)`, uitleg: "Zeker. Relatie +5.", eff: {stream: {naam: "Contract " + b.naam, bedrag}, bedrijf: {[b.id]: {relatie: 5, contract: true}}}},
      {label: `Hoger inzetten (€${hoog}M/mnd, ${kans}%)`, uitleg: "Lukt het niet, dan haken ze af: relatie −8.", eff: {kans, succes: {stream: {naam: "Contract " + b.naam, bedrag: hoog}, bedrijf: {[b.id]: {relatie: 2, contract: true}}}, falen: {bedrijf: {[b.id]: {relatie: -8}}}}},
      {label: "Afslaan", uitleg: "Relatie −3.", eff: {bedrijf: {[b.id]: {relatie: -3}}}}], standaard: 0});
  ctx.rep.push(`Aanbod: ${b.naam} wil een leveringscontract`); }
function aanvraagTick(s, ctx){ s.aanvragen ??= []; s.contracten ??= []; bedrijfAanbodTick(s, ctx);
  for (const a of s.aanvragen) a.verloopt -= 1; /* 6.8: meer aanvragen, langer geldig */ const weg = s.aanvragen.filter(a => a.verloopt <= 0); for (const a of weg){ const rv = aanvraagRivalen(s, a.aard); contractHist(s, a, "verlopen", rv.length ? CH(rv).name : null); } if (weg.length) ctx.rep.push(`${weg.length} aanvra${weg.length > 1 ? "gen" : "ag"} verlopen`); s.aanvragen = s.aanvragen.filter(a => a.verloopt > 0);
  const nP = (s.producten || []).filter(p => p.status === "markt").length;
  for (let poging = 0; poging < 2; poging++) if (nP && s.aanvragen.length < AANVRAAG_MAX && kansRol() < Math.min(0.8, 0.4 + 0.06 * nP)){ const a = maakAanvraag(s); if (a){ s.aanvragen.push(a); ctx.rep.push(`Aanvraag: ${a.klant}`); mail(ctx, s, "Verkoop", `Aanvraag van ${a.klant}`, a.tekst + " Inschrijven kan bij Bedrijf → Klanten, binnen drie maanden.", "NORMAAL"); } }
  const zwaar = (s.producten || []).filter(x => x.status === "markt" && stukInfo(x).order && !isAbo(x));
  for (const p of zwaar) for (let poging = 0; poging < 2; poging++) if (s.aanvragen.filter(a => a.product === p.id).length < CONTRACT_PER_PRODUCT && kansRol() < (poging ? 0.4 : 0.85)){ /* 6.8.1: 85% per maand, soms twee, tot 3 open per product */ const a = maakContract(s, p); if (a){ s.aanvragen.push(a); ctx.rep.push(`Contractaanvraag: ${a.klant} (${p.naam})`); mail(ctx, s, "Verkoop", `${a.klant} wil ${p.naam}`, a.tekst + " Inschrijven bij Bedrijf → Klanten.", "HOOG"); } }
  for (const c of s.contracten){ const p = besteVanAard(s, c.aard);
    if (!p){ c.over = 0; s.cash = r1(s.cash - c.perMaand * 2); s.reputation = clamp(s.reputation - 5); mail(ctx, s, "Juridische Zaken", `Contract met ${c.klant} verbroken`, `We hebben geen ${PRODUCT_AARD[c.aard].label.toLowerCase()} meer op de markt en kunnen niet leveren. Boete €${r1(c.perMaand * 2)}M, reputatie −5.`, "KRITIEK"); ctx.rep.push(`Contract ${c.klant} verbroken`); continue; }
    if (c.product){ const pp = (s.producten || []).find(x => x.id === c.product); if (pp) (s.prodomzet ??= {})[pp.id] = r1(((s.prodomzet || {})[pp.id] || 0) + c.perMaand); }
    const netto = r1(c.perMaand * AANVRAAG_MARGE); if (c.zwart) s.accounts.zwart = r1(s.accounts.zwart + netto); else s.cash = r1(s.cash + netto); c.over -= 1; c.betaald = r1((c.betaald || 0) + netto);
    if (c.over <= 0){ ctx.rep.push(`Contract ${c.klant} afgerond`); if (!c.zwart) s.reputation = clamp(s.reputation + 1); } }
  const n0 = s.contracten.length; s.contracten = s.contracten.filter(c => c.over > 0); if (s.contracten.length || n0){ const tot = r1(s.contracten.reduce((a, c) => a + c.perMaand * AANVRAAG_MARGE, 0)); if (tot) ctx.rep.push(`Raamcontracten: +€${tot}M netto per maand`); }
  s.accounts.operationeel = s.cash; }
/* 6.11: geschiedenis van alle aanvragen: gewonnen, verloren (aan wie), verlopen, afgewezen */
function contractHist(s, a, uitkomst, wie, bedrag){ const pp = a.product ? (s.producten || []).find(x => x.id === a.product) : null;
  (s.contractHist ??= []).unshift({m: ym(s), klant: a.klant, soort: a.soort, aard: a.aard, product: pp ? pp.naam : null, uitkomst, wie: wie || null, bedrag: r1(bedrag ?? (a.raam ? a.perMaand * a.maanden : a.bedrag) ?? 0), raam: !!a.raam}); s.contractHist = s.contractHist.slice(0, 40); }
function actAanvraag(s, ctx, id, keuze){ const a = (s.aanvragen || []).find(x => x.id === id); if (!a) return {ok: false, msg: "Die aanvraag is er niet meer."};
  if (keuze === "afwijzen"){ s.aanvragen = s.aanvragen.filter(x => x !== a); { const rv = aanvraagRivalen(s, a.aard); contractHist(s, a, "afgewezen", rv.length ? CH(rv).name : null); } if (a.gang){ const g = (s.gangs || []).find(x => x.id === a.gang); if (g) g.relatie = Math.round(g.relatie - 5); } return {ok: true, msg: `Aanvraag van ${a.klant} afgewezen.${a.gang ? " Ze onthouden het: relatie −5." : ""}`}; }
  const P = AANVRAAG_PRIJS[keuze]; if (!P) return {ok: false, msg: "Kies een prijs."}; const p = aanvraagProduct(s, a); if (!p) return {ok: false, msg: `Je hebt geen ${PRODUCT_AARD[a.aard].label.toLowerCase()} op de markt.`};
  const kans = aanvraagKans(s, a, keuze), roll = rolKans(kans), K = KLANT_SOORT[a.soort], riv = aanvraagRivalen(s, a.aard); s.aanvragen = s.aanvragen.filter(x => x !== a);
  addRoll(s, `Inschrijving ${a.klant} (${P.label.toLowerCase()}): ${roll.txt} → ${roll.ok ? "GEWONNEN" : "VERLOREN"}`); let msg;
  if (roll.ok){ if (K.heat) s.heat = clamp(s.heat + K.heat);
    if (a.raam){ const c = {id: a.id, klant: a.klant, aard: a.aard, product: a.product || null, perMaand: r1(a.perMaand * P.f), over: a.maanden, maanden: a.maanden, zwart: !!K.zwart, sinds: ym(s)}; (s.contracten ??= []).push(c); msg = `Gewonnen: raamcontract met ${a.klant}, ${a.maanden} maanden €${c.perMaand}M omzet per maand (±€${r1(c.perMaand * AANVRAAG_MARGE)}M netto${c.zwart ? ", zwart" : ""}). Houd een ${PRODUCT_AARD[a.aard].label.toLowerCase()} op de markt, anders volgt een boete.`; }
    else { const netto = r1(a.bedrag * P.f * AANVRAAG_MARGE); if (a.product){ const pp = (s.producten || []).find(x => x.id === a.product); if (pp){ (s.prodomzet ??= {})[pp.id] = r1(((s.prodomzet || {})[pp.id] || 0) + a.bedrag * P.f); (pp.orders ??= []).push({m: ym(s), stuks: Math.max(1, Math.round(a.bedrag * P.f * 1e6 / Math.max(1, stukPrijs(pp)))), bedrag: r1(a.bedrag * P.f), klant: a.klant}); pp.orders = pp.orders.slice(-6); } } if (K.zwart) s.accounts.zwart = r1(s.accounts.zwart + netto); else s.cash = r1(s.cash + netto); msg = `Gewonnen: levering aan ${a.klant} voor €${r1(a.bedrag * P.f)}M (±€${netto}M netto${K.zwart ? ", zwart" : ""}).`; }
    if (K.rep) s.reputation = clamp(s.reputation + 1); if (a.gang){ const g = (s.gangs || []).find(x => x.id === a.gang); if (g) g.relatie = Math.round(g.relatie + 8); }
    if (K.zwart && kansRol() < 0.15){ s.reputation = clamp(s.reputation - 4); msg += " Een journalist zag de levering: reputatie −4."; } }
  else { const w = riv.length ? CH(riv).name : null; msg = `Verloren: ${a.klant} kiest ${w || "een andere leverancier"}.`; contractHist(s, a, "verloren", w); }
  if (roll.ok) contractHist(s, a, "gewonnen", "jij", (a.raam ? a.perMaand * a.maanden : a.bedrag) * P.f);
  s.accounts.operationeel = s.cash; addLog(s, msg); mail(ctx, s, "Verkoop", `Inschrijving ${a.klant}: ${roll.ok ? "gewonnen" : "verloren"}`, msg + ` (Worp ${roll.txt}.)`, "NORMAAL");
  return {ok: true, msg: msg + ` Worp ${roll.txt}.`}; }
/* 5.10: export en vergunningen. Wapens, beveiliging en implantaten verkopen standaard op je eigen continent; een exportvergunning per ander continent (blijvend) geeft +6% omzet per continent. Bij Sancties of Privélegers (spanning 50-89) ligt daar een embargo: de vergunning telt niet, tenzij je een smokkelroute hebt (zwart geld, heat). */
const EXPORT_AARD = ["wapen", "beveiliging", "implantaat"], EXPORT_BONUS = 0.06;
const exportThuis = s => (s.districts.find(x => x.id === s.player.home_district) || {}).continent;
const embargo = (s, cont) => { const v = spanningVan(s, cont); return v >= 50 && v < 90; };
const vergunningKost = s => r1(15 * (DIFF[s.player.difficulty] || 1) * (1 + 0.25 * Object.keys(s.exportVergunning || {}).length));
const smokkelKost = s => r1(8 * (DIFF[s.player.difficulty] || 1));
function exportExtra(s, p, o){ const out = {legaal: 0, zwart: 0, heat: 0}; if (!(o > 0) || !EXPORT_AARD.includes(p.aard || aardVan(p.type, p.naam))) return out;
  for (const c of Object.keys(s.exportVergunning || {})){ if (c === exportThuis(s)) continue; const b = o * EXPORT_BONUS;
    if (!embargo(s, c)) out.legaal += b; else if ((s.smokkelroute || {})[c]){ out.zwart += b * 0.8; out.heat += 0.3; } }
  return out; }
function actExport(s, ctx, soort, cont){ if (!CONTINENTS.some(c => c.naam === cont) || cont === exportThuis(s)) return {ok: false, msg: "Kies een ander continent dan je thuiscontinent."};
  if (soort === "vergunning"){ if ((s.exportVergunning || {})[cont]) return {ok: false, msg: `Je hebt al een exportvergunning voor ${cont}.`}; const k = vergunningKost(s); if (s.cash < k) return {ok: false, msg: `Een vergunning kost €${k}M.`};
    s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; (s.exportVergunning ??= {})[cont] = ym(s); addLog(s, `Exportvergunning ${cont} (€${k}M)`);
    return {ok: true, msg: `Exportvergunning voor ${cont}: wapens, beveiliging en implantaten verkopen daar nu ook (+${Math.round(EXPORT_BONUS * 100)}% omzet op die producten).${embargo(s, cont) ? " Let op: er ligt nu een embargo; zonder smokkelroute telt de vergunning pas als het embargo voorbij is." : ""}`}; }
  if (soort === "smokkel"){ const S0 = (s.smokkelroute ??= {}); if (S0[cont]){ delete S0[cont]; return {ok: true, msg: `Smokkelroute naar ${cont} gestopt.`}; }
    if (!(s.exportVergunning || {})[cont]) return {ok: false, msg: "Eerst een exportvergunning: zonder klanten daar is er niets te smokkelen."};
    const k = smokkelKost(s); if (s.cash < k) return {ok: false, msg: `Een smokkelroute opzetten kost €${k}M.`}; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; S0[cont] = ym(s); addLog(s, `Smokkelroute ${cont} (€${k}M)`);
    return {ok: true, msg: `Smokkelroute naar ${cont}: tijdens een embargo gaat de handel door, als zwart geld (80%) en met heat.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
/* 5.11: regionale markten. Elk continent heeft een eigen marktgrootte, koopkracht, vraag per soort en concurrenten (rivalen met een hoofdkantoor daar). Per product kies je waar je verkoopt; minder markten = meer focus. Neutraal geijkt: alles verkopen tegen standaardprijs bij gemiddelde vraag = ×1. */
const REGIO = {"Noord-Amerika": {w: 0.24, kk: 1.25}, "Europa": {w: 0.22, kk: 1.2}, "Azië": {w: 0.28, kk: 1.0}, "Midden-Oosten": {w: 0.07, kk: 1.05}, "Zuid-Amerika": {w: 0.07, kk: 0.85}, "Afrika": {w: 0.06, kk: 0.75}, "Oceanië": {w: 0.06, kk: 1.15}};
const REGIO_KK = Object.values(REGIO).reduce((a, r) => a + r.w * r.kk, 0), REGIO_FOCUS = 0.6;
const regioNamen = () => Object.keys(REGIO);
const regioMarkten = p => (p.markten && p.markten.length ? p.markten : regioNamen());
/* 6.8: corpospanning werkt hard op de vraag: wapens en beveiliging tot bijna ×2 in een corporate zone, consument/financieel/logistiek tot ×0,67 */
const SPANNING_VRAAG = {wapen: [25, 70, 1], beveiliging: [25, 90, 1], smokkel: [40, 100, 1], medisch: [50, 200, 1], consument: [40, 150, -1], financieel: [40, 150, -1], logistiek: [40, 150, -1]};
const spanningVraagF = (aard, sp) => { const e = SPANNING_VRAAG[aard]; return e ? Math.max(0.5, 1 + e[2] * Math.max(0, sp - e[0]) / e[1]) : 1; };
function regioVraag(s, c, aard){ const v = ((s.regioVraag || {})[c] || {})[aard] ?? 1; return v * spanningVraagF(aard, spanningVan(s, c)); }
function regioConc(s, c, aard, n){ if (n) return Math.pow(0.85, n[c] || 0); const hqC = r => (s.districts.find(d => d.id === r.hq) || {}).continent; return Math.pow(0.85, s.rivals.filter(r => hqC(r) === c && (r.producten || []).some(x => x.aard === aard)).length); }
const regioTol = (c, p) => clamp(1 + (REGIO[c].kk - REGIO_KK) * (prijsF(p) - 1) * 2, 0.5, 1.5);
const regioCache = new WeakMap(); /* 5.14.1: per tick/render gelijk; sleutel = spel + maand + aard */
function regioBasis(s, aard){ let C = regioCache.get(s); const k = ym(s) + "|" + (s.rivals || []).length; if (!C || C.k !== k){ C = {k, a: {}}; regioCache.set(s, C); }
  const V = s.regioVraag || {}, sig = regioNamen().map(c => ((V[c] || {})[aard] ?? 1) + (SPANNING_VRAAG[aard] ? ":" + spanningVan(s, c) : "")).join(",");
  if (C.a[aard] && C.a[aard].sig === sig) return C.a[aard].d; const n = {}; for (const r of s.rivals || []) if ((r.producten || []).some(x => x.aard === aard)){ const c = (s.districts.find(d => d.id === r.hq) || {}).continent; if (c) n[c] = (n[c] || 0) + 1; }
  const gem = spanningGem(s), alle = regioNamen(), cg = alle.reduce((a, c) => a + REGIO[c].w * regioConc(s, c, aard, n), 0) || 1;
  const d = alle.map(c => ({c, w: REGIO[c].w, v: regioVraag(s, c, aard), conc: regioConc(s, c, aard, n) / cg})); C.a[aard] = {sig, d}; return d; }
function regioDelen(s, p){ const aard = p.aard || aardVan(p.type, p.naam); return regioBasis(s, aard).map(x => ({...x, tol: regioTol(x.c, p)})); }
function regioF(s, p){ if (!s || !s.districts) return 1; const sel = new Set(regioMarkten(p)), D = regioDelen(s, p); let num = 0, selW = 0;
  for (const x of D) if (sel.has(x.c)){ num += x.w * x.v * x.conc * x.tol; selW += x.w; }
  return num * (1 + REGIO_FOCUS * (1 - selW)); }
function regioTick(s, newGame){ const V = (s.regioVraag ??= {}); const nieuw = !Object.keys(V).length;
  for (const c of regioNamen()){ V[c] ??= {}; for (const a of Object.keys(PRODUCT_AARD)){ if (V[c][a] == null){ V[c][a] = nieuw && newGame ? r1(U(0.75, 1.25) * 100) / 100 : 1; continue; } if (!newGame) V[c][a] = Math.round(clamp(V[c][a] + (1 - V[c][a]) * 0.02 + U(-0.03, 0.03), 0.5, 1.6) * 100) / 100; } } }
function actRegio(s, id, c){ const p = (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, msg: "Onbekend product."}; if (!REGIO[c]) return {ok: false, msg: "Onbekend continent."};
  const sel = new Set(regioMarkten(p)); if (sel.has(c)){ if (sel.size <= 1) return {ok: false, msg: "Je moet minstens op één continent verkopen."}; sel.delete(c); } else sel.add(c);
  p.markten = sel.size === regioNamen().length ? null : [...sel]; if (!p.markten) delete p.markten;
  return {ok: true, msg: `${p.naam} verkoopt nu in ${sel.size === regioNamen().length ? "de hele wereld" : [...sel].join(", ")}.`}; }
/* 5.12: toelevering en voorraad. Grondstoffen komen uit één continent; hun prijs volgt de corpospanning daar, oorlogen en wereldgebeurtenissen (chiptekort 2020, energiecrisis 2022). Voorraad = vooruit betalen tegen de prijs van nu; zolang die strekt, kost die grondstof je niets extra. */
const GRONDSTOF = {staal: {label: "Staal", bron: "Azië"}, chips: {label: "Chips", bron: "Azië"}, zeldzaam: {label: "Zeldzame aarden", bron: "Afrika"}, brandstof: {label: "Brandstof", bron: "Midden-Oosten"}, chemie: {label: "Chemicaliën", bron: "Europa"}, biogel: {label: "Biogel", bron: "Noord-Amerika"}, lithium: {label: "Lithium", bron: "Zuid-Amerika"}};
const AARD_GRONDSTOF = {wapen: ["staal", "chips"], beveiliging: ["staal", "chips"], implantaat: ["zeldzaam", "biogel", "chips"], medisch: ["chemie", "biogel"], data: ["chips", "lithium"], logistiek: ["brandstof", "staal"], orbitaal: ["zeldzaam", "brandstof", "lithium"], consument: ["chips", "lithium"], smokkel: ["brandstof"], financieel: ["chips"]};
const GRONDSTOF_SCHOK = {"2008-10": {staal: -0.2, brandstof: -0.3}, "2011-03": {zeldzaam: 0.4}, "2020-09": {chips: 0.6, lithium: 0.2}, "2022-02": {brandstof: 0.7, chemie: 0.3, staal: 0.2}, "2032-05": {staal: 0.3, zeldzaam: 0.3}, "2040-01": {chips: 0.3, biogel: 0.3}};
const grondstoffenVan = p => AARD_GRONDSTOF[p.aard || aardVan(p.type, p.naam)] || ["chips"];
const gsPrijs = (s, m) => (((s.grondstof || {})[m]) || {}).p ?? 1;
const gsVoorraad = (s, m) => ((s.voorraad || {})[m] || {}).mnd || 0;
function gsVerbruik(s, m){ let v = 0; for (const p of (s.producten || []).filter(x => x.status === "markt")){ const L = grondstoffenVan(p); if (L.includes(m)) v += ((s.prodomzet || {})[p.id] || 0) * PROD_KOST * 0.8 / L.length; } return r1(Math.max(0.1, v)); }
const voorraadKost = (s, m, n) => r1(gsVerbruik(s, m) * gsPrijs(s, m) * n);
function grondstofTick(s, ctx){ const G0 = (s.grondstof ??= {}), sch = (s.gsSchok ??= {}), nu = ym(s), E = GRONDSTOF_SCHOK[nu];
  for (const [m, g] of Object.entries(GRONDSTOF)){ const x = (G0[m] ??= {p: 1, hist: []}); if (E && E[m]) sch[m] = (sch[m] || 0) + E[m];
    const oorlog = s.rivals.filter(r => r.status === "oorlog" && (s.districts.find(d => d.id === r.hq) || {}).continent === g.bron).length;
    const doel = 1 + Math.max(0, spanningVan(s, g.bron) - 40) / 100 + (sch[m] || 0) + oorlog * 0.1, oud = x.p;
    x.p = Math.round(clamp(x.p + (doel - x.p) * 0.15 + U(-0.03, 0.03), 0.6, 2.5) * 100) / 100; x.hist = [...(x.hist || []), x.p].slice(-12);
    if (sch[m]){ sch[m] = Math.round(sch[m] * 0.88 * 100) / 100; if (Math.abs(sch[m]) < 0.02) delete sch[m]; }
    if (oud < 1.5 && x.p >= 1.5){ news(s, `Tekort aan ${g.label.toLowerCase()}`, `De prijs van ${g.label.toLowerCase()} uit ${g.bron} schiet omhoog. Fabrieken kopen wat ze kunnen.`, g.bron, "markt", false); ctx.rep.push(`Tekort: ${g.label} ×${x.p}`); } }
  const V = s.voorraad || {}; for (const m of Object.keys(V)){ if ((s.producten || []).some(p => p.status === "markt" && grondstoffenVan(p).includes(m))) V[m].mnd -= 1; if (V[m].mnd <= 0){ delete V[m]; ctx.rep.push(`Voorraad ${GRONDSTOF[m].label.toLowerCase()} op`); } }
  for (const p of s.producten || []){ const L = grondstoffenVan(p); p.matF = Math.round(L.reduce((a, m) => a + (gsVoorraad(s, m) > 0 ? 0 : gsPrijs(s, m)), 0) / L.length * 100) / 100; if (p.matF === 1) delete p.matF; } }
function actVoorraad(s, ctx, m, n){ if (!GRONDSTOF[m]) return {ok: false, msg: "Onbekende grondstof."}; n = Math.round(+n || 0); if (![3, 6, 12].includes(n)) return {ok: false, msg: "Kies 3, 6 of 12 maanden."};
  if (gsVoorraad(s, m) + n > 24) return {ok: false, msg: "Meer dan twee jaar voorraad past niet in je loodsen."};
  const k = voorraadKost(s, m, n); if (s.cash < k) return {ok: false, msg: `Niet genoeg cash (€${k}M nodig).`};
  s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; const V = (s.voorraad ??= {}); V[m] = {mnd: gsVoorraad(s, m) + n, prijs: gsPrijs(s, m), verbruik: gsVerbruik(s, m), sinds: ym(s)};
  for (const p of s.producten || []){ const L = grondstoffenVan(p); if (!L.includes(m)) continue; p.matF = Math.round(L.reduce((a, x) => a + (gsVoorraad(s, x) > 0 ? 0 : gsPrijs(s, x)), 0) / L.length * 100) / 100; }
  addLog(s, `Voorraad ${GRONDSTOF[m].label.toLowerCase()} ${n} mnd (€${k}M)`);
  return {ok: true, msg: `${n} maanden ${GRONDSTOF[m].label.toLowerCase()} ingekocht voor €${k}M (prijs ×${gsPrijs(s, m)}). Zolang de voorraad strekt, kost die grondstof je niets extra, wat de markt ook doet.`}; }
/* 5.13: patenten en namaak. Een patent op de sterkste eigenschap (7+) geeft dat product +8% omzet en licentiegeld van rivalen in dezelfde soort; namakers kun je aanklagen, een licentie geven of negeren. Rivalen patenteren ook: zonder eigen patent in die soort −5% omzet tot je het aanvecht of het afloopt. */
const PATENT_BONUS = 0.08, PATENT_MIN = 7;
const patentKost = s => r1(8 * (DIFF[s.player.difficulty] || 1));
const namaakActief = (s, p) => { const t = s.flags && s.flags["namaak_" + p.id]; return !!t && t > ym(s); };
const eigenPatentIn = (s, aard) => (s.producten || []).some(p => p.patent && p.status === "markt" && (p.aard || aardVan(p.type, p.naam)) === aard);
function patentF(s, p){ const aard = p.aard || aardVan(p.type, p.naam), rp = (s.rivaalPatent || {})[aard];
  return (p.patent && !namaakActief(s, p) ? 1 + PATENT_BONUS : 1) * (rp && rp.tot > ym(s) && !eigenPatentIn(s, aard) ? 0.95 : 1); }
const besteSpec = p => prodSpecs(p).reduce((a, x) => (x.v > a.v ? x : a), {v: 0, naam: ""});
function actPatent(s, ctx, id){ const p = (s.producten || []).find(x => x.id === id); if (!p || p.status !== "markt") return {ok: false, msg: "Alleen een product op de markt kun je patenteren."};
  if (p.patent) return {ok: false, msg: `${p.naam} heeft al een patent op ${p.patent.spec}.`}; const b = besteSpec(p); if (b.v < PATENT_MIN) return {ok: false, msg: `Geen eigenschap is sterk genoeg (beste: ${b.naam} ${b.v}, minstens ${PATENT_MIN} nodig).`};
  const k = patentKost(s); if (s.cash < k) return {ok: false, msg: `Een patent kost €${k}M.`}; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; p.patent = {spec: b.naam, v: b.v, sinds: ym(s)};
  addLog(s, `Patent op ${b.naam} van ${p.naam} (€${k}M)`); news(s, `${s.player.corp_name} patenteert ${b.naam.toLowerCase()}`, `Het octrooi op de ${b.naam.toLowerCase()} van ${p.naam} is toegekend. Concurrenten moeten nu betalen of eromheen werken.`, "", "markt", true);
  return {ok: true, msg: `Patent op ${b.naam} (${b.v}) van ${p.naam}: +${Math.round(PATENT_BONUS * 100)}% omzet en licentiegeld van rivalen met dezelfde soort.`}; }
function patentTick(s, ctx){ const nu = ym(s), hqRiv = aard => s.rivals.filter(r => (r.producten || []).some(x => x.aard === aard));
  let lic = 0; for (const p of (s.producten || []).filter(x => x.patent && x.status === "markt" && !namaakActief(s, x))){ const aard = p.aard || aardVan(p.type, p.naam), R0 = hqRiv(aard); lic += R0.length * 0.2;
    if (R0.length && kansRol() < 0.04){ const r = CH(R0), kans = snapKans(clamp(55 + (heeftFocus(s, "juristen") ? 15 : 0) + (s.reputation - 30) / 4, 15, 90));
      addKeuze(s, ctx, {soort: "patent_" + p.id, van: "Juridische Zaken", titel: `${r.name} kopieert ${p.naam}`, tekst: `${r.name} verkoopt iets dat verdacht veel lijkt op ${p.naam}, inclusief onze gepatenteerde ${p.patent.spec.toLowerCase()}. Wat doen we?`,
        opties: [{label: "Aanklagen · €4M", kost: 4, uitleg: `Kans ${kans}%: schadevergoeding €10-25M. Mislukt: de namaak blijft een jaar (patentvoordeel weg).`, eff: {kans, succes: {cash: RI(10, 25), rivaal: {[r.name]: {relatie: -10}}, tekst: "De rechter is helder: namaak. De schadevergoeding is binnen."}, falen: {flags: {["namaak_" + p.id]: plusMonths(s, 12)}, tekst: "De rechter vindt het verschil groot genoeg. De namaak blijft."}}},
          {label: "Licentie aanbieden", uitleg: "Twee jaar €0,6M per maand, relatie +5. De namaak wordt legaal.", eff: {stream: {naam: `Licentie ${p.naam} (${r.name})`, bedrag: 0.6, maanden: 24}, rivaal: {[r.name]: {relatie: 5}}}},
          {label: "Negeren", uitleg: "Gratis. Een jaar lang geen patentvoordeel voor dit product.", eff: {flags: {["namaak_" + p.id]: plusMonths(s, 12)}}}], standaard: 2}); } }
  if (lic){ lic = r1(lic); s.cash = r1(s.cash + lic); ctx.rep.push(`Licentiegeld patenten: +€${lic}M`); }
  const RP = (s.rivaalPatent ??= {}); for (const a of Object.keys(RP)){ if (RP[a].tot <= nu || s.flags["patentweg_" + a]){ if (s.flags["patentweg_" + a]) ctx.rep.push(`Patent van ${RP[a].rival} vernietigd`); delete RP[a]; delete s.flags["patentweg_" + a]; } }
  const mijnAard = [...new Set((s.producten || []).filter(p => p.status === "markt").map(p => p.aard || aardVan(p.type, p.naam)))].filter(a => !RP[a] && !eigenPatentIn(s, a) && hqRiv(a).length);
  if (mijnAard.length && kansRol() < 0.015){ const a = CH(mijnAard), r = CH(hqRiv(a)); RP[a] = {rival: r.name, tot: plusMonths(s, 36), sinds: nu}; const kans = snapKans(clamp(50 + (heeftFocus(s, "juristen") ? 15 : 0), 15, 90));
    addKeuze(s, ctx, {soort: "rpatent_" + a, van: "Juridische Zaken", titel: `${r.name} patenteert in ${PRODUCT_AARD[a].label.toLowerCase()}`, tekst: `${r.name} heeft een breed patent gekregen. Onze ${PRODUCT_AARD[a].label.toLowerCase()} verkoopt drie jaar 5% minder, tenzij we zelf een patent in die soort hebben of het aanvechten.`,
      opties: [{label: "Aanvechten · €5M", kost: 5, uitleg: `Kans ${kans}%: het patent wordt vernietigd.`, eff: {kans, succes: {flags: {["patentweg_" + a]: true}, rivaal: {[r.name]: {relatie: -6}}, tekst: "Het patent sneuvelt: te breed, te vaag."}, falen: {tekst: "Het patent blijft staan."}}},
        {label: "Accepteren", uitleg: "Drie jaar −5% omzet op die soort (tenzij je zelf patenteert).", eff: {}}], standaard: 1}); } }
/* 5.14: onderzoek. Per soort product drie niveaus: 1 = +5% omzet, 2 = +5% en 8% goedkopere onderdelen, 3 = +5% en +1 op alle eigenschappen (dus sneller een patent). Eén onderzoek tegelijk, betaald per maand. Rivalen onderzoeken mee: hun nieuwe producten worden beter. */
const TECH_NAMEN = {wapen: ["Slimme munitie", "Modulaire chassis", "Exo-gevechtspakken"], beveiliging: ["Gezichtsherkenning", "Drone-zwermen", "Voorspellende politie"], implantaat: ["Neurale interfaces", "Biocompatibel chroom", "Synthetische zenuwen"], medisch: ["Gentherapie", "Bioprinten", "Nano-chirurgie"], data: ["Big data", "Voorspellende AI", "Bewustzijnsmodellen"], logistiek: ["Autonome trucks", "Droneleveringen", "Hyperloop-netwerk"], financieel: ["Algoritmische handel", "Blockchain-clearing", "Quantum-risicomodellen"], orbitaal: ["Herbruikbare raketten", "Orbitale fabrieken", "Ruimtelift"], consument: ["Slimme materialen", "AR-brillen", "Persoonlijke robots"], smokkel: ["Versleutelde routes", "Stealth-containers", "Spookschepen"]};
const TECH_EFFECT = ["+5% omzet", "+5% omzet en 8% goedkopere onderdelen", "+5% omzet en +1 op alle eigenschappen"];
const techNiveau = (s, aard) => ((s.onderzoek || {}).niveau || {})[aard] || 0;
const techF = (s, p) => 1 + 0.05 * techNiveau(s, p.aard || aardVan(p.type, p.naam));
const techKost = (s, n) => r1(15 * n * (DIFF[s.player.difficulty] || 1) * clamp(omvang(s), 1, 4)), techMaanden = n => 4 + 2 * n; /* 6.0: groter bedrijf = duurder onderzoek */
function actOnderzoek(s, ctx, aard){ if (!TECH_NAMEN[aard]) return {ok: false, msg: "Onbekende soort."}; const O = (s.onderzoek ??= {niveau: {}}); if (O.lopend) return {ok: false, msg: `Er loopt al onderzoek: ${O.lopend.naam}.`};
  const n = techNiveau(s, aard) + 1; if (n > 3) return {ok: false, msg: "Deze soort is volledig onderzocht."}; const k = techKost(s, n), m = techMaanden(n), pm = r1(k / m); if (s.cash < pm + 10) return {ok: false, msg: `Niet genoeg cash voor de eerste maand (€${pm}M).`};
  O.lopend = {aard, n, naam: TECH_NAMEN[aard][n - 1], over: m, maanden: m, perMaand: pm, sinds: ym(s)}; addLog(s, `Onderzoek gestart: ${O.lopend.naam}`);
  return {ok: true, msg: `Onderzoek "${O.lopend.naam}" gestart: ${m} maanden, €${pm}M per maand. Daarna: ${TECH_EFFECT[n - 1]} op ${PRODUCT_AARD[aard].label.toLowerCase()}.`}; }
function actOnderzoekStop(s){ const O = s.onderzoek || {}; if (!O.lopend) return {ok: false, msg: "Er loopt geen onderzoek."}; const n = O.lopend.naam; delete O.lopend; return {ok: true, msg: `Onderzoek "${n}" gestopt. Wat al betaald is, is weg.`}; }
function onderzoekTick(s, ctx){ const O = (s.onderzoek ??= {niveau: {}}); O.niveau ??= {};
  if (O.lopend){ const L = O.lopend; if (s.cash >= L.perMaand){ s.cash = r1(s.cash - L.perMaand); L.over -= 1; } else ctx.rep.push(`Onderzoek ${L.naam} staat stil: geen geld`);
    if (L.over <= 0){ O.niveau[L.aard] = L.n; delete O.lopend; ctx.rep.push(`Onderzoek klaar: ${L.naam}`); news(s, `Doorbraak bij ${s.player.corp_name}: ${L.naam.toLowerCase()}`, `Het lab meldt een doorbraak. ${PRODUCT_AARD[L.aard].label} van ${s.player.corp_name}: ${TECH_EFFECT[L.n - 1]}.`, "", "markt", true);
      mail(ctx, s, "Hoofd R&D", `Onderzoek klaar: ${L.naam}`, `Ons onderzoek is af. Voor al onze ${PRODUCT_AARD[L.aard].label.toLowerCase()}: ${TECH_EFFECT[L.n - 1]}.`, "NORMAAL"); } }
  for (const p of s.producten || []){ const t = techNiveau(s, p.aard || aardVan(p.type, p.naam)); if (t) p.tech = t; else delete p.tech; }
  if (s.date.month === 1) for (const r of s.rivals){ const a = SECTOR_AARD[r.sector] || "consument", T = (r.tech ??= {}); if ((T[a] || 0) < 3 && R() < 0.3){ T[a] = (T[a] || 0) + 1; news(s, `${r.name} meldt een doorbraak`, `${r.name} heeft ${TECH_NAMEN[a] ? TECH_NAMEN[a][T[a] - 1].toLowerCase() : "iets nieuws"} onder de knie. Hun volgende producten worden beter.`, "", "markt", false); } } }
/* 5.15: realistische financiën en de beurs. Termijnleningen met vaste rente en looptijd (annuïteit), een balans en kasstroom, en zelf naar de beurs: een deel van de aandelen verkopen voor geld, daarna is dat deel niet meer van jou (je bedrijfswaarde voor de winst telt alleen jouw deel). Elk jaar een aandeelhoudersvergadering. */
const termijnRest = s => r1((s.leningen || []).reduce((a, l) => a + l.rest, 0));
const publiekDeel = s => ((s.beurs || {}).publiek || 0) / 100;
const voorraadWaarde = s => r1(Object.entries(s.voorraad || {}).reduce((a, [m, v]) => a + (v.mnd || 0) * (v.verbruik || 0) * (v.prijs || 1), 0));
const termijnRente = (s, n) => Math.round((0.045 + Math.max(0, 50 - s.reputation) / 600 + (s.heat > 40 ? 0.02 : 0) + (n >= 48 ? 0.01 : 0)) * 1000) / 1000;
function annuiteit(P, rj, n){ const r = rj / 12; return r1(r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n); }
function actTermijn(s, ctx, bedrag, n){ bedrag = Math.round(+bedrag || 0); n = Math.round(+n || 0); if (![12, 24, 48].includes(n)) return {ok: false, msg: "Kies 12, 24 of 48 maanden."};
  if (bedrag < 5) return {ok: false, msg: "Minimaal €5M."}; const cap = loanCap(s); if (bedrag > cap) return {ok: false, msg: `De bank weigert: maximaal €${cap}M.`};
  const rj = termijnRente(s, n), A = annuiteit(bedrag, rj, n); (s.leningen ??= []).push({id: "l" + hex8(), bedrag, rente: rj, looptijd: n, over: n, rest: bedrag, annuiteit: A, sinds: ym(s)});
  s.cash = r1(s.cash + bedrag); s.accounts.operationeel = s.cash; addLog(s, `Termijnlening €${bedrag}M, ${n} mnd, ${Math.round(rj * 1000) / 10}%`);
  return {ok: true, msg: `Termijnlening van €${bedrag}M: ${n} maanden ${Math.round(rj * 1000) / 10}% vast, €${A}M per maand (rente en aflossing samen).`}; }
function termijnTick(s){ let tot = 0; for (const l of s.leningen || []){ const r = l.rente / 12, rente = l.rest * r, af = Math.min(l.rest, l.annuiteit - rente); l.rest = r1(Math.max(0, l.rest - af)); l.over -= 1; tot += rente + af; }
  s.leningen = (s.leningen || []).filter(l => l.over > 0 && l.rest > 0.05); return r1(tot); }
const beursMag = s => bedrijfWaarde(s) >= 500 && s.reputation >= 25;
const beursKoers = s => { const B = s.beurs; return B ? Math.round(100 * bedrijfWaarde(s) / Math.max(1, B.basis)) : 100; };
function actBeurs(s, ctx, soort, pct){ const B = s.beurs; pct = Math.round(+pct || 0); const V = bedrijfWaarde(s);
  if (soort === "ipo"){ if (B) return {ok: false, msg: "Je staat al op de beurs."}; if (!beursMag(s)) return {ok: false, msg: "Een beursgang kan vanaf €500M bedrijfswaarde en reputatie 25."}; if (![10, 20, 30].includes(pct)) return {ok: false, msg: "Kies 10, 20 of 30%."};
    const opbr = r1(V * pct / 100 * 0.9); s.cash = r1(s.cash + opbr); s.accounts.operationeel = s.cash; s.beurs = {publiek: pct, sinds: ym(s), basis: bedrijfWaarde(s), dividend: 0};
    news(s, `${s.player.corp_name} naar de beurs`, `De beursgang van ${s.player.corp_name} haalt €${opbr}M op. ${pct}% van de aandelen is nu in handen van beleggers.`, "", "markt", true); addLog(s, `Beursgang: ${pct}% voor €${opbr}M`);
    return {ok: true, msg: `Beursgang: ${pct}% verkocht voor €${opbr}M (10% onder de waarde, dat is de prijs van een beursgang). Voor de winst telt voortaan jouw deel: ${100 - pct}%.`}; }
  if (!B) return {ok: false, msg: "Je staat niet op de beurs."};
  if (soort === "uitgeven"){ if (![5, 10].includes(pct)) return {ok: false, msg: "Kies 5 of 10%."}; if (B.publiek + pct > 49) return {ok: false, msg: "Boven 49% verlies je de meerderheid. Dat doen we niet."};
    const opbr = r1(V * pct / 100 * 0.95); s.cash = r1(s.cash + opbr); s.accounts.operationeel = s.cash; B.publiek += pct; s.reputation = clamp(s.reputation - 1); addLog(s, `Aandelen uitgegeven: ${pct}% voor €${opbr}M`);
    return {ok: true, msg: `${pct}% nieuwe aandelen voor €${opbr}M. Bestaande beleggers zijn niet blij met de verwatering: reputatie −1. Jouw deel: ${100 - B.publiek}%.`}; }
  if (soort === "terugkopen"){ if (![5, 10].includes(pct)) return {ok: false, msg: "Kies 5 of 10%."}; pct = Math.min(pct, B.publiek); const k = r1(V * pct / 100 * 1.1); if (s.cash < k + 20) return {ok: false, msg: `Terugkopen kost €${k}M (10% boven de waarde).`};
    s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; B.publiek -= pct; addLog(s, `Aandelen teruggekocht: ${pct}% voor €${k}M`); if (B.publiek <= 0){ delete s.beurs; return {ok: true, msg: `Alle aandelen teruggekocht voor €${k}M: je bent weer volledig eigenaar en van de beurs af.`}; }
    return {ok: true, msg: `${pct}% teruggekocht voor €${k}M. Jouw deel: ${100 - B.publiek}%.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function beursTick(s, ctx){ const B = s.beurs; if (!B) return; B.koersHist = [...(B.koersHist || []), beursKoers(s)].slice(-24);
  if (s.date.month === 6){ const V = bedrijfWaarde(s), div = r1(Math.max(1, V * B.publiek / 100 * 0.03)), kr = B.koersHist.length >= 12 ? Math.round((B.koersHist[B.koersHist.length - 1] / B.koersHist[B.koersHist.length - 12] - 1) * 100) : 0;
    addKeuze(s, ctx, {soort: "ava_" + s.date.year, van: "Investor Relations", titel: `Aandeelhoudersvergadering ${s.date.year}`, tekst: `De koers ${kr >= 0 ? "steeg" : "daalde"} ${Math.abs(kr)}% dit jaar. De beleggers (${B.publiek}%) willen weten wat ze krijgen.`,
      opties: [{label: `Dividend · €${div}M`, kost: div, uitleg: "Beleggers tevreden: reputatie +3.", eff: {reputation: 3}}, {label: "Herinvesteren", uitleg: kr >= 10 ? "Met deze groei accepteren ze het: geen gevolgen." : "Ze morren: reputatie −3.", eff: kr >= 10 ? {} : {reputation: -3}},
        {label: "Bonus voor de directie", uitleg: "Je directie +10 loyaliteit, beleggers boos: reputatie −6.", eff: {reputation: -6, loyaliteit: Object.fromEntries((s.npcs || []).map(n => [n.name, 10]))}}], standaard: 1}); } }
/* 5.16: dashboard. Omzet per divisie over tijd, per product naast de sterkste concurrent, en een jaaroverzicht. */
function rivaalTop(s, aard){ let best = {pop: 0, naam: "", wie: ""}; for (const r of s.rivals) for (const x of r.producten || []) if (x.aard === aard && (x.pop || 0) * (x.kwaliteit || 1) > best.pop * (best.kw || 1)) best = {pop: Math.round(x.pop || 0), kw: x.kwaliteit, naam: x.naam, wie: r.name}; return best; }
function divHistTick(s){ const H = (s.divHist ??= {}); for (const d of s.divisions){ const nm = divNaam(d), o = r1(((s.divomzet || {})[nm] || 0) + (s.producten || []).filter(p => p.divisie === nm).reduce((a, p) => a + ((s.prodomzet || {})[p.id] || 0) + ((s.exportOmzet || {})[p.id] || 0), 0));
  H[nm] = [...(H[nm] || []), {m: ym(s), o}].slice(-36); } for (const k of Object.keys(H)) if (!s.divisions.some(d => divNaam(d) === k)) delete H[k]; }
function jaarOverzicht(s){ const J = {}; for (const h of s.history || []){ const y = String(h.m).slice(0, 4); if (!/^\d{4}$/.test(y)) continue; const x = (J[y] ??= {jaar: y, omzet: 0, kosten: 0, netto: 0, mnd: 0}); x.omzet += h.omzet || 0; x.kosten += h.kosten || 0; x.netto += h.netto || 0; x.mnd++; x.kas = h.cash; if (h.waarde != null) x.waarde = h.waarde; }
  return Object.values(J).map(x => ({...x, omzet: r1(x.omzet), kosten: r1(x.kosten), netto: r1(x.netto)})).sort((a, b) => b.jaar.localeCompare(a.jaar)); }
/* 5.17: zelf plannen smeden. Tegen een rivaal of een bende, in drie stappen van twee maanden. Elke stap kost geld en is een worp (macht, crew en karakter van de tegenstander tellen); mislukt een stap, dan is het plan ontdekt: afgebroken, relatie omlaag, heat omhoog. */
const EIGEN_PLAN = {
  prijsoorlog: {label: "Prijsoorlog", doel: "rivaal", stappen: ["leveranciers vastleggen", "verkopers wegkopen", "de prijzen dumpen"], kost: 5, mod: 0, uitleg: "Hun marktaandeel −20%, hun producten −10 populariteit; jouw producten in dezelfde soort +5."},
  overloop: {label: "Mensen wegkopen", doel: "rivaal", stappen: ["teams in kaart brengen", "aanbiedingen onder de tafel", "een heel team overnemen"], kost: 4, mod: 5, uitleg: "Zij verliezen 20% personeel, jij krijgt de helft erbij (zonder wervingskosten); morale +3."},
  laster: {label: "Lastercampagne", doel: "rivaal", stappen: ["vuil verzamelen", "journalisten benaderen", "publiceren"], kost: 3, mod: 5, uitleg: "Hun marktaandeel −10%, moeheid +15; jouw reputatie −2 als het later uitkomt (kleine kans)."},
  sabotage: {label: "Sabotage", doel: "rivaal", stappen: ["depots verkennen", "een bewaker omkopen", "toeslaan"], kost: 6, mod: -5, uitleg: "Zij verliezen €15-30M en hun beste product −15 populariteit. Heat +3."},
  uitroken: {label: "Bende uitroken", doel: "bende", stappen: ["informanten werven", "de politie tippen", "de panden leegvegen"], kost: 5, mod: 0, uitleg: "De bende verliest 30 aanwezigheid in al jouw districten; relatie met hen −20."},
};
const eigenPlanKost = (s, k) => r1(EIGEN_PLAN[k].kost * (DIFF[s.player.difficulty] || 1) * clamp(omvang(s), 0.6, 2.5));
function eigenPlanKans(s, k, doel){ const P = EIGEN_PLAN[k], crew = (s.crew || []).filter(m => crewStatus(s, m) !== "opgepakt"), bonus = (crew.some(m => m.rol === "fixer") ? 10 : 0) + (crew.some(m => m.rol === "speurder") ? 5 : 0) + (crew.some(m => m.rol === "spindokter") && k === "laster" ? 10 : 0);
  if (P.doel === "bende"){ const g = (s.gangs || []).find(x => x.id === doel); return g ? snapKans(clamp(65 + bonus + P.mod + (playerPower(s) - gangKracht(g)) / 2, 25, 90)) : 0; }
  const r = s.rivals.find(x => x.name === doel); if (!r) return 0; return snapKans(clamp(65 + bonus + P.mod + (playerPower(s) - rivalPower(s, r)) / 2 - (r.karakter === "paranoide" ? 10 : 0), 25, 90)); }
function actEigenPlan(s, ctx, k, doel){ const P = EIGEN_PLAN[k]; if (!P) return {ok: false, msg: "Onbekend plan."}; if ((s.eigenPlannen || []).length) return {ok: false, msg: "Je hebt al een plan lopen. Eén tegelijk."};
  const naam = P.doel === "bende" ? ((s.gangs || []).find(x => x.id === doel) || {}).naam : (s.rivals.find(x => x.name === doel) || {}).name; if (!naam) return {ok: false, msg: P.doel === "bende" ? "Kies een bende." : "Kies een rivaal."};
  const kost = eigenPlanKost(s, k); if (s.cash < kost) return {ok: false, msg: `De eerste stap kost €${kost}M.`};
  (s.eigenPlannen ??= []).push({id: "ep" + hex8(), k, doel, naam, stap: 0, volgende: plusMonths(s, 2), sinds: ym(s)}); s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash;
  addLog(s, `Plan gestart: ${P.label} tegen ${naam} (€${kost}M)`);
  return {ok: true, msg: `${P.label} tegen ${naam} is begonnen: ${P.stappen[0]}. Elke twee maanden een stap (€${kost}M, ${eigenPlanKans(s, k, doel)}% kans per stap). Als het slaagt: ${P.uitleg}`}; }
function actEigenPlanStop(s){ const L = s.eigenPlannen || []; if (!L.length) return {ok: false, msg: "Er loopt geen plan."}; const p = L[0]; s.eigenPlannen = []; return {ok: true, msg: `${EIGEN_PLAN[p.k].label} tegen ${p.naam} afgeblazen. Wat al betaald is, is weg.`}; }
function eigenPlanEind(s, ctx, p){ const P = EIGEN_PLAN[p.k], r = s.rivals.find(x => x.name === p.doel), g = (s.gangs || []).find(x => x.id === p.doel); let txt = "";
  if (p.k === "prijsoorlog" && r){ const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.8; for (const x of r.producten || []) x.pop = Math.max(5, (x.pop || 0) - 10); const aard = new Set((r.producten || []).map(x => x.aard)); for (const x of (s.producten || []).filter(y => y.status === "markt" && aard.has(y.aard || aardVan(y.type, y.naam)))) x.pop = Math.round(clamp(x.pop + 5, 3, 95)); relShift(r, -15); txt = `De prijsoorlog tegen ${r.name} is gewonnen: hun klanten lopen weg, hun producten zakken.`; }
  else if (p.k === "overloop" && r){ const n = Math.max(2, Math.round(r.staff * 0.2)); r.staff = Math.max(10, r.staff - n); s.staff.count += Math.round(n / 2); s.morale = clamp(s.morale + 3); relShift(r, -10); txt = `Een heel team van ${r.name} werkt nu voor ons (${Math.round(n / 2)} mensen).`; }
  else if (p.k === "laster" && r){ const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.9; r.moeheid = clamp(r.moeheid + 15); relShift(r, -8); if (kansRol() < 0.15){ s.reputation = clamp(s.reputation - 2); txt = " Een journalist ontdekte wie erachter zat: reputatie −2."; } txt = `De campagne tegen ${r.name} slaat aan.` + txt; }
  else if (p.k === "sabotage" && r){ const l = r1(U(15, 30)); r.cash = r1(r.cash - l); const b = (r.producten || []).sort((a, b2) => (b2.pop || 0) - (a.pop || 0))[0]; if (b) b.pop = Math.max(5, (b.pop || 0) - 15); s.heat = clamp(s.heat + 3); relShift(r, -12); txt = `Brand in een depot van ${r.name}: ±€${l}M schade${b ? `, ${b.naam} ligt even niet in de winkels` : ""}.`; }
  else if (p.k === "uitroken" && g){ for (const d of playerDistricts(s)) if ((g.gebied || {})[d.id] != null) g.gebied[d.id] = Math.max(0, g.gebied[d.id] - 30); g.relatie = Math.round(g.relatie - 20); txt = `${g.naam} is uit onze wijken gerookt.`; }
  else txt = "Het doel bestaat niet meer; het plan is zonder effect afgerond.";
  if (r) remember(r, s, `plan van de speler: ${P.label.toLowerCase()}`); mail(ctx, s, "Je crew", `Gelukt: ${P.label} tegen ${p.naam}`, txt, "NORMAAL"); ctx.rep.push(`Plan gelukt: ${P.label} tegen ${p.naam}`); addLog(s, txt); }
function eigenPlanTick(s, ctx){ for (const p of [...(s.eigenPlannen || [])]){ if (p.volgende > ym(s)) continue; const P = EIGEN_PLAN[p.k], kans = eigenPlanKans(s, p.k, p.doel);
  if (!kans){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); continue; } const roll = rolKans(kans); addRoll(s, `Plan ${P.label} stap ${p.stap + 1}: ${roll.txt} → ${roll.ok ? "GELUKT" : "ONTDEKT"}`);
  if (!roll.ok){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); s.heat = clamp(s.heat + 2); const r = s.rivals.find(x => x.name === p.doel), g = (s.gangs || []).find(x => x.id === p.doel); if (r){ relShift(r, -10); remember(r, s, `ontdekte een plan van de speler (${P.label.toLowerCase()})`); } if (g) g.relatie = Math.round(g.relatie - 10);
    mail(ctx, s, "Juridische Zaken", `Ontdekt: ${P.label} tegen ${p.naam}`, `Bij "${P.stappen[p.stap]}" ging het mis. ${p.naam} weet wat we van plan waren. Het plan is van tafel; relatie −10, heat +2. (Worp ${roll.txt}.)`, "HOOG"); ctx.rep.push(`Plan ontdekt: ${P.label}`); continue; }
  p.stap += 1; if (p.stap >= P.stappen.length){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); eigenPlanEind(s, ctx, p); continue; }
  const kost = eigenPlanKost(s, p.k); if (s.cash < kost){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); ctx.rep.push(`Plan ${P.label} gestopt: geen geld voor de volgende stap`); continue; }
  s.cash = r1(s.cash - kost); p.volgende = plusMonths(s, 2); ctx.rep.push(`Plan ${P.label}: stap ${p.stap} gelukt, nu ${P.stappen[p.stap]} (€${kost}M)`); } }
/* 5.19: de CEO als persoon. Leeftijd, gezondheid en stress; privéleven (partner, kinderen); een opvolger (een kind = dynastie, of iemand uit de directie). Zonder opvolger kiest de raad bij je vertrek een buitenstaander: zware klap, maar het spel gaat door. Rivaliserende CEO's worden ouder, worden vervangen en hebben een persoonlijke relatie met jou. */
function ceoInit(s, d){ if (s.ceo) return s.ceo; const naam = String((d && d.ceo_naam) || "").trim().slice(0, 40);
  s.ceo = {naam: naam || "De CEO", leeftijd: RI(34, 48), gezondheid: RI(78, 92), stress: 20, partner: R() < 0.55, kinderen: RI(0, 2), opvolger: null, generatie: 1}; return s.ceo; }
const ceoLeeftijd = s => Math.floor((s.ceo || {}).leeftijd || 40);
function ceoOpvolgers(s){ const C = s.ceo || {}, L = []; for (let i = 0; i < (C.kinderen || 0); i++) L.push({id: "kind" + i, naam: `Kind ${i + 1} (${C.naam === "De CEO" ? "erfgenaam" : C.naam.split(" ").slice(-1)[0]})`, soort: "dynastie"});
  for (const n of s.npcs || []) if (!n.verraad) L.push({id: "npc:" + n.name, naam: `${n.name} (${n.role})`, soort: "raad"}); return L; }
function actCeo(s, ctx, soort, arg){ const C = ceoInit(s); const pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; }; const m = ym(s);
  if (soort === "vakantie"){ if (C.vakantie === m) return {ok: false, msg: "Je bent deze maand al weg geweest."}; if (!pay(2)) return {ok: false, msg: "Een vakantie kost €2M."}; C.vakantie = m; C.stress = clamp(C.stress - 30); s.morale = clamp(s.morale - 1); return {ok: true, msg: "Twee weken op een privé-eiland zonder netwerk. Stress −30. Het bedrijf mist je even (morale −1)."}; }
  if (soort === "kliniek"){ if (!pay(10)) return {ok: false, msg: "De kliniek kost €10M."}; C.gezondheid = clamp(C.gezondheid + 20); s.heat = clamp(s.heat + 2); return {ok: true, msg: "Nieuwe organen uit een kliniek die niet op de kaart staat. Gezondheid +20, heat +2."}; }
  if (soort === "gezin"){ if (C.gezin === m) return {ok: false, msg: "Je hebt deze maand al tijd voor je gezin gemaakt."}; C.gezin = m; C.stress = clamp(C.stress - 12); s.morale = clamp(s.morale + 1); if (!C.partner && kansRol() < 0.25){ C.partner = true; return {ok: true, msg: "Een avond die uitliep. Je hebt een partner. Stress −12."}; } if (C.partner && C.kinderen < 3 && kansRol() < 0.12){ C.kinderen += 1; return {ok: true, msg: "Er is een kind op komst. Een erfgenaam, als je wilt. Stress −12."}; } return {ok: true, msg: "Een weekend zonder telefoon. Stress −12, morale +1."}; }
  if (soort === "opvolger"){ const o = ceoOpvolgers(s).find(x => x.id === arg); if (!o) return {ok: false, msg: "Kies een opvolger."}; C.opvolger = o; return {ok: true, msg: `${o.naam} is je opvolger (${o.soort === "dynastie" ? "een dynastie" : "uit de directie"}).`}; }
  if (soort === "golf"){ const r = s.rivals.find(x => x.name === arg); if (!r) return {ok: false, msg: "Kies een rivaal."}; if (r.golf === m) return {ok: false, msg: `Je hebt deze maand al met ${r.ceo} gegolfd.`}; if (!pay(1)) return {ok: false, msg: "Golf kost €1M."};
    r.golf = m; r.ceoRel = Math.round(clamp((r.ceoRel || 0) + 10, -100, 100)); relShift(r, 4); return {ok: true, msg: `Achttien holes met ${r.ceo}. Persoonlijke band +10, relatie met ${r.name} +4.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function ceoOpvolging(s, ctx, reden){ const C = s.ceo, o = C.opvolger, oud = C.naam; let txt;
  if (o && o.soort === "dynastie"){ C.naam = `${oud === "De CEO" ? "De nieuwe CEO" : oud.split(" ")[0] + " jr."}`; C.leeftijd = RI(26, 34); C.gezondheid = RI(80, 95); C.stress = 25; C.kinderen = 0; C.partner = false; s.morale = clamp(s.morale - 3); txt = `${oud} ${reden}. ${C.naam} neemt het roer over: de dynastie gaat door.`; }
  else if (o && o.soort === "raad"){ const n = o.id.slice(4); C.naam = n; C.leeftijd = RI(40, 55); C.gezondheid = RI(70, 88); C.stress = 30; C.kinderen = RI(0, 2); C.partner = R() < 0.5; s.npcs = (s.npcs || []).filter(x => x.name !== n); s.morale = clamp(s.morale - 5); txt = `${oud} ${reden}. ${n} wordt CEO, zoals afgesproken. De directie schuift een plek op.`; }
  else { C.naam = genCeoNaam(new Set()); C.leeftijd = RI(42, 58); C.gezondheid = RI(70, 88); C.stress = 35; C.kinderen = 0; C.partner = R() < 0.5; s.morale = clamp(s.morale - 12); s.reputation = clamp(s.reputation - 8); txt = `${oud} ${reden}. Er was geen opvolger: de raad haalt ${C.naam} van buiten. Onrust op de vloer (morale −12) en in de pers (reputatie −8).`; }
  C.opvolger = null; C.generatie = (C.generatie || 1) + 1; mail(ctx, s, "De Raad van Bestuur", "Een nieuwe CEO", txt + " Jij speelt verder als de nieuwe CEO.", "KRITIEK"); news(s, `Nieuwe CEO bij ${s.player.corp_name}`, txt, "", "markt", true); ctx.rep.push(`Nieuwe CEO: ${C.naam}`); addLog(s, txt); }
function ceoTick(s, ctx){ const C = ceoInit(s); C.leeftijd = Math.round((C.leeftijd + 1 / 12) * 1000) / 1000;
  const doel = clamp(15 + s.heat * 0.35 + (s.cash < 0 ? 25 : 0) + (100 - s.morale) * 0.15 + (s.rivals.filter(r => r.status === "oorlog").length * 8) - (C.partner ? 5 : 0), 0, 100); C.stress = Math.round(clamp(C.stress + (doel - C.stress) * 0.15) * 10) / 10;
  const L = ceoLeeftijd(s), daling = (L > 55 ? (L - 55) * 0.06 : 0) + (C.stress > 60 ? (C.stress - 60) * 0.03 : 0) - (C.stress < 30 && L < 55 ? 0.15 : 0); C.gezondheid = Math.round(clamp(C.gezondheid - daling + U(-0.3, 0.3)) * 10) / 10;
  if (C.stress > 75 && kansRol() < 0.05){ C.gezondheid = clamp(C.gezondheid - 12); s.morale = clamp(s.morale - 3); mail(ctx, s, "Huisarts", "Burn-out", `${C.naam} zakte in elkaar in de lift. Gezondheid −12. Rust, zegt de dokter. Ze zeggen het altijd.`, "HOOG"); ctx.rep.push("CEO: burn-out"); }
  if (C.gezondheid <= 0) ceoOpvolging(s, ctx, "overlijdt na een kort ziekbed"); else if (L >= 78 && kansRol() < 0.1) ceoOpvolging(s, ctx, "gaat met pensioen, of wordt daartoe gedwongen");
  for (const r of s.rivals){ r.ceoLeeftijd ??= RI(40, 66); if (s.date.month === 1) r.ceoLeeftijd += 1; r.ceoRel = Math.round((r.ceoRel || 0) * 0.98);
    if (s.date.month === 1 && (r.ceoLeeftijd >= 72 || kansRol() < 0.03)){ const oud = r.ceo; r.ceo = genCeoNaam(new Set(s.rivals.map(x => x.ceo))); r.ceoLeeftijd = RI(38, 55); r.ceoRel = 0; delete r.karakter; geefKarakter(r); news(s, `Nieuwe CEO bij ${r.name}`, `${oud} vertrekt. ${r.ceo} neemt over: ${RIVAAL_KARAKTER[r.karakter].label.toLowerCase()}, zeggen insiders.`, "", "markt", false); ctx.rep.push(`${r.name}: nieuwe CEO ${r.ceo}`); } } }
/* 5.20: eigen moeilijkheid. Vijf schuiven die jij zet, bij het oprichten of later: gebeurtenissen, chaos, corpospanning, heat en de winstdrempel. Een zwaarder spel telt zwaarder in de score; de laagste stand die je ooit had, telt. */
const INSTEL = {events: {label: "Gebeurtenissen", uitleg: "regionale gebeurtenissen en onverwachte rekeningen"}, chaos: {label: "Chaos", uitleg: "nomaden, cyberpsycho's, spookzendingen en ander onheil"}, spanning: {label: "Corpospanning", uitleg: "hoe snel de wereld afglijdt"}, heat: {label: "Heat", uitleg: "hoe snel de politie op je let"}, winst: {label: "Winstdrempel", uitleg: "de bedrijfswaarde die je nodig hebt om te winnen"}};
const INSTEL_NIV = {laag: 0.6, normaal: 1, hoog: 1.4}, INSTEL_WINST = {laag: 0.75, normaal: 1, hoog: 1.3};
const inst = (s, k) => ((((s && s.player) || {}).instel) || {})[k] ?? 1;
const instelNiv = (k, n) => (k === "winst" ? INSTEL_WINST : INSTEL_NIV)[n] ?? 1;
const instelNaam = (s, k) => { const v = inst(s, k), T = k === "winst" ? INSTEL_WINST : INSTEL_NIV; return Object.keys(T).find(n => Math.abs(T[n] - v) < 1e-6) || "normaal"; };
function instelScore(I){ let m = 1; for (const k of ["events", "chaos", "spanning", "heat"]) m += ((I[k] ?? 1) - 1) * 0.25; m += ((I.winst ?? 1) - 1) * 0.4; return Math.round(clamp(m, 0.6, 1.5) * 100) / 100; }
function actInstel(s, k, n){ if (!INSTEL[k]) return {ok: false, msg: "Onbekende instelling."}; if (!(n in (k === "winst" ? INSTEL_WINST : INSTEL_NIV))) return {ok: false, msg: "Kies laag, normaal of hoog."};
  const p = s.player, I = (p.instel ??= {}); I[k] = instelNiv(k, n); const sc = instelScore(I); p.instelScore = Math.min(p.instelScore ?? sc, sc); addLog(s, `Moeilijkheid: ${INSTEL[k].label} ${n}`);
  return {ok: true, msg: `${INSTEL[k].label}: ${n}. Score-vermenigvuldiger nu ×${sc}${p.instelScore < sc ? ` (voor de score telt de laagste ooit: ×${p.instelScore})` : ""}.`}; }
/* 6.1: een hoofd per divisie. Talent 1-5; focus omzet (+2% per talent) of kosten (−3% per talent). Loyaliteit drijft naar 45 + morale/4 (+10 bij een bonus deze maand); onder 25 kan het hoofd vertrekken. */
const hoofdKost = s => r1(4 * (DIFF[s.player.difficulty] || 1));
function hoofdF(d, soort){ const h = d.hoofd; if (!h || h.focus !== soort) return 1; return soort === "omzet" ? 1 + 0.02 * h.talent : 1 - 0.03 * h.talent; }
function actHoofd(s, ctx, div, soort, arg){ const d = s.divisions.find(x => divNaam(x) === div); if (!d) return {ok: false, msg: "Onbekende divisie."};
  if (soort === "aannemen"){ if (d.hoofd) return {ok: false, msg: `${divNaam(d)} heeft al een hoofd.`}; const k = hoofdKost(s); if (s.cash < k) return {ok: false, msg: `Werving kost €${k}M.`};
    const talent = RI(1, 5); d.hoofd = {naam: genCeoNaam(new Set([...(s.npcs || []).map(n => n.name), ...s.divisions.map(x => (x.hoofd || {}).naam)])), talent, loyaliteit: RI(50, 70), loon: r1(0.2 + 0.12 * talent), focus: "omzet", sinds: ym(s)};
    s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; addLog(s, `${d.hoofd.naam} hoofd van ${divNaam(d)} (talent ${talent})`);
    return {ok: true, msg: `${d.hoofd.naam} leidt ${divNaam(d)}: talent ${talent} van 5, €${d.hoofd.loon}M per maand. Focus op omzet (+${2 * talent}%) of kosten (−${3 * talent}%).`}; }
  const h = d.hoofd; if (!h) return {ok: false, msg: "Deze divisie heeft geen hoofd."};
  if (soort === "focus"){ if (!["omzet", "kosten"].includes(arg)) return {ok: false, msg: "Kies omzet of kosten."}; h.focus = arg; return {ok: true, msg: `${h.naam} richt zich op ${arg === "omzet" ? `omzet (+${2 * h.talent}%)` : `kosten (−${3 * h.talent}%)`}.`}; }
  if (soort === "bonus"){ if (h.bonus === ym(s)) return {ok: false, msg: "Deze maand al een bonus gegeven."}; if (s.cash < 1) return {ok: false, msg: "Een bonus kost €1M."}; s.cash = r1(s.cash - 1); h.bonus = ym(s); h.loyaliteit = clamp(h.loyaliteit + 10); return {ok: true, msg: `${h.naam} krijgt een bonus: loyaliteit +10.`}; }
  if (soort === "ontslaan"){ const n = h.naam; delete d.hoofd; s.morale = clamp(s.morale - 1); return {ok: true, msg: `${n} is vertrokken. ${divNaam(d)} heeft geen hoofd meer.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function hoofdTick(s, ctx){ for (const d of s.divisions){ const h = d.hoofd; if (!h) continue; const doel = 45 + s.morale / 4 + (h.bonus === ym(s) ? 10 : 0); h.loyaliteit = Math.round(clamp(h.loyaliteit + (doel - h.loyaliteit) * 0.1 + U(-1.5, 1.5)) * 10) / 10;
  if (h.loyaliteit < 25 && kansRol() < 0.15){ const r = s.rivals.length ? CH(s.rivals).name : "een rivaal"; mail(ctx, s, "HR", `${h.naam} vertrekt`, `${h.naam} (hoofd ${divNaam(d)}) stapt over naar ${r}. Loyaliteit was ${Math.round(h.loyaliteit)}.`, "HOOG"); ctx.rep.push(`${h.naam} vertrekt`); delete d.hoofd; } } }
/* 6.2: rivalen spelen met dezelfde regels. Rijke rivalen bouwen aanwezigheid op in districten naast hun gebied (neutraal, of van jou als ze je niet mogen). Twee maanden ≥55% en groter dan de eigenaar = het district is van hen. Je thuisdistrict en hoofdkantoren vallen nooit zo. */
function rivAanwezigTick(s, ctx, idx, hqs){ const RA = (s.rivAanwezig ??= {});
  for (const r of s.rivals){ const M = (RA[r.name] ??= {}); for (const k of Object.keys(M)){ M[k] = r1(M[k] * 0.95); if (M[k] < 1) delete M[k]; }
    if (r.cash < 120 || kansRol() >= 0.1) continue;
    const eigen = s.districts.filter(d => d.control === r.name), kand = new Set(); for (const d of eigen) for (const n of d.neighbors || []){ const b = idx.get(n); if (!b || hqs.has(b.id) || b.id === s.player.home_district) continue; if (b.control === "neutral" || (b.control === "player" && (r.relatie || 0) < -20)) kand.add(b); }
    if (!kand.size) continue; const L = [...kand], speler = L.filter(d => d.control === "player"), d = speler.length && R() < 0.4 ? CH(speler) : CH(L);
    M[d.id] = Math.min(150, r1((M[d.id] || 0) + 20)); r.cash = r1(r.cash - 10);
    if (d.control === "player" && M[d.id] >= 40 && !(d.rivWaarsch === r.name)){ d.rivWaarsch = r.name; mail(ctx, s, "Strategie", `${r.name} wil ${d.name}`, `${r.name} koopt panden, sponsort clubs en zet mensen op straat in ${d.name}. Wordt hun aandeel groter dan het onze, dan valt het district hen toe. Aanwezigheid opbouwen of een patrouille helpt.`, "HOOG"); } }
  for (const d of s.districts){ if (hqs.has(d.id) || d.id === s.player.home_district || !d.dom) continue; const eig = domEigenaar(s, d);
    let top = null; for (const r of s.rivals) if (r.name !== d.control){ const v = d.dom[r.name] || 0; if (v >= DOM_FLIP && v > eig && (!top || v > top.v)) top = {r, v}; }
    if (!top){ delete d.domRiv; continue; } if ((d.domRiv || {}).naam === top.r.name) d.domRiv.n += 1; else d.domRiv = {naam: top.r.name, n: 1};
    if (d.domRiv.n >= 2){ const van = d.control; d.control = top.r.name; delete d.domRiv; delete d.rivWaarsch;
      if (van === "player"){ if (s.patrouille) delete s.patrouille[d.id]; mail(ctx, s, "Strategie", `${d.name} valt ${top.r.name} toe`, `Hun aandeel in ${d.name} (${Math.round(top.v)}%) is groter dan het onze. Zonder één schot zijn we het district kwijt.`, "KRITIEK"); ctx.rep.push(`${d.name} valt ${top.r.name} toe`); }
      news(s, `${top.r.name} neemt ${d.name} over`, `Overal hun logo, hun mensen, hun geld. ${d.name} draait nu op ${top.r.name}.`, d.continent, "wereld", van === "player"); } } }
/* 6.8: contracten voor zware producten. Tanks, ziekenhuissystemen, satellieten en andere grote stukken verkopen alleen aan legers, staten en bedrijven via een aanvraag; die komen vaak (±50% per maand per product). */
const AANVRAAG_MAX = 6, CONTRACT_PER_PRODUCT = 3;
/* 6.8.1: zelf een zwaar product aanbieden bij legers en staten: één keer per maand per product, levert meteen een contractaanvraag op */
const pitchKost = s => r1(1.5 * (DIFF[s.player.difficulty] || 1));
const pitchMag = (s, p) => !!p && p.status === "markt" && stukInfo(p).order && !isAbo(p) && p.pitch !== ym(s) && (s.aanvragen || []).filter(a => a.product === p.id).length < CONTRACT_PER_PRODUCT;
function actPitch(s, ctx, id){ const p = (s.producten || []).find(x => x.id === id); if (!p || !(p.status === "markt" && stukInfo(p).order && !isAbo(p))) return {ok: false, msg: "Alleen zware producten op de markt kun je zo aanbieden."};
  if (p.pitch === ym(s)) return {ok: false, msg: `${p.naam} is deze maand al aangeboden. Volgende maand weer.`};
  if ((s.aanvragen || []).filter(a => a.product === p.id).length >= CONTRACT_PER_PRODUCT) return {ok: false, msg: `Er liggen al ${CONTRACT_PER_PRODUCT} aanvragen voor ${p.naam} open. Schrijf eerst in.`};
  const k = pitchKost(s); if (s.cash < k) return {ok: false, msg: `Een presentatie kost €${k}M.`};
  const a = maakContract(s, p); if (!a) return {ok: false, msg: "Er is nu niemand om aan te bieden."};
  s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; p.pitch = ym(s); a.minKwal = Math.min(a.minKwal, p.kwaliteit); (s.aanvragen ??= []).push(a); addLog(s, `${p.naam} aangeboden aan ${a.klant} (€${k}M)`);
  return {ok: true, msg: `Demo, diner, een rondleiding door de fabriek: ${a.tekst} Inschrijven kan meteen.`}; }
const CONTRACT_KLANT = {wapen: ["leger", "staat"], beveiliging: ["staat", "leger", "bedrijf"], orbitaal: ["leger", "staat", "bedrijf"], medisch: ["staat", "bedrijf"], implantaat: ["leger", "bedrijf"], data: ["staat", "bedrijf"], financieel: ["staat"], logistiek: ["bedrijf", "staat"], smokkel: ["syndicaat"], consument: ["bedrijf"]};
function maakContract(s, p){ const aard = p.aard || aardVan(p.type, p.naam), soorten = (CONTRACT_KLANT[aard] || ["bedrijf"]).filter(k => (k !== "syndicaat" || (s.gangs || []).length) && (k !== "bedrijf" || (s.bedrijven || []).some(b => !b.eigenaar))); if (!soorten.length) return null;
  const soort = CH(soorten), K = KLANT_SOORT[soort], land = CH(s.districts.filter(d => d.control !== "player")) || s.districts[0]; let klant, gang = null;
  if (soort === "bedrijf") klant = CH((s.bedrijven || []).filter(b => !b.eigenaar)).naam; else if (soort === "syndicaat"){ const g = CH(s.gangs); klant = g.naam; gang = g.id; } else klant = `${CH(K.namen)} (${land.name})`;
  const basis = Math.max(1, prodOmzet(s, {...p, prijsF: 1}) * 1.2), I = stukInfo(p), raam = R() < 0.45, a = {id: "a" + hex8(), m: ym(s), soort, klant, gang, aard, raam, product: p.id, minKwal: clamp(p.kwaliteit + RI(-2, -1), 1, 5), verloopt: 4};
  if (raam){ a.maanden = CH([6, 12, 18]); a.perMaand = r1(basis * U(0.7, 1.1)); } else a.bedrag = r1(basis * U(4, 8));
  const stuks = Math.max(1, Math.round((a.bedrag || a.perMaand) * 1e6 / Math.max(1, stukPrijs(p))));
  a.tekst = `${klant} wil ${raam ? `een raamcontract: ${a.maanden} maanden lang ±${stuks} ${stuks === 1 ? I.enkel : I.eenheid} per maand` : `${stuks} ${stuks === 1 ? I.enkel : I.eenheid}`} van ${p.naam}, minimaal kwaliteit ${a.minKwal}.`; return a; }
const spanningGem = s => { const v = Object.values(s.spanning || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
function tijdlijnTick(s, ctx){ const nu = ym(s), gehad = (s.tijdlijnGehad ??= []), B = (s.vraagBasis ??= {});
  for (const t of TIJDLIJN){ if (t.d > nu || gehad.includes(t.d)) continue; gehad.push(t.d); const recent = mndNr(nu) - mndNr(t.d) <= 2;
    for (const [a, v] of Object.entries(t.basis || {})){ B[a] = (B[a] || 0) + v; if (t.tot) (s.basisTot ??= []).push({a, v, tot: t.tot}); }
    if (recent){ for (const [a, v] of Object.entries(t.schok || {})) vraagSchok(s, a, v, t.kop); news(s, t.kop, t.tekst, "", "wereld", true); ctx.rep.push(`Wereld: ${t.kop}`); } }
  if (s.basisTot) s.basisTot = s.basisTot.filter(x => { if (x.tot > nu) return true; B[x.a] = (B[x.a] || 0) - x.v; return false; }); }
function vraagTick(s){
  vraagInit(s);
  const oorlogen = s.rivals.filter(r => r.status === "oorlog").length + (s.flags.special_oorlog ? 1 : 0), dreig = (s.dreigingen || []).length;
  for (const [a, x] of Object.entries(s.vraag)){
    let drift = ((100 + ((s.vraagBasis || {})[a] || 0) + (a === "wapen" ? spanningGem(s) / 8 : a === "beveiliging" ? spanningGem(s) / 10 : 0)) - x.idx) * 0.03 + U(-0.02, 0.02) * 100 / 100; /* 5.3: normale vraag schuift met de tijdlijn */
    if (a === "wapen") drift += oorlogen * 0.015 + (s.gangs || []).filter(g => g.deal === "oorlog").length * 0.01;
    if (a === "beveiliging") drift += oorlogen * 0.008 + dreig * 0.01;
    if (a === "implantaat" && (s.tijdperk || 0) >= 1) drift += 0.006;
    if (a === "orbitaal" && (s.tijdperk || 0) >= 2) drift += 0.01;
    x.trend = x.trend * 0.6 + drift;
    x.idx = r1(clamp(x.idx * (1 + x.trend), 45, 220)); x.hist = [...(x.hist || []), Math.round(x.idx)].slice(-12);
    if (Math.abs(x.trend) < 0.01) x.reden = "";
  }
}
/* gebeurtenissen in de wereld schuiven de vraag */
const VRAAG_DOOR_EVENT = {storm: [["logistiek", -0.06], ["beveiliging", 0.03]], staking: [["logistiek", -0.05]], blackout: [["data", -0.08], ["logistiek", 0.04]], boom: [["consument", 0.05], ["financieel", 0.04]],
  coup: [["wapen", 0.1], ["beveiliging", 0.06]], akkoord: [["logistiek", 0.06], ["consument", 0.04]], sancties: [["smokkel", 0.12]], virus: [["medisch", 0.15]], cyber: [["beveiliging", 0.1], ["data", -0.04]], implantaat: [["implantaat", -0.08]]};
const VRAAG_DOOR_SPECIAL = {krach: [["financieel", -0.15], ["consument", -0.1]], blackout: [["data", -0.15], ["logistiek", 0.08]], aiwet: [["data", -0.1], ["implantaat", -0.05]], pool: [["logistiek", 0.08]],
  rivalenoorlog: [["wapen", 0.15], ["beveiliging", 0.08]], psychose: [["implantaat", -0.18], ["beveiliging", 0.12], ["medisch", 0.06]], orbitaal: [["orbitaal", 0.2]], signaal: [["data", 0.1]], vluchtelingen: [["medisch", 0.06], ["smokkel", 0.08]]};

const PRODUCT_TRAITS = {
  verslavend: {label: "Verslavend", tekst: "veroudert nauwelijks, maar heat +0,3/mnd", goed: true},
  cult: {label: "Cultstatus", tekst: "populariteit zakt nooit onder 35", goed: true},
  duurzaam: {label: "Duurzaam", tekst: "reputatie +0,2/mnd", goed: true},
  slim: {label: "Slim", tekst: "invloed +0,2/mnd", goed: true},
  gepatenteerd: {label: "Gepatenteerd", tekst: "rivalen kunnen het niet kopiëren, namaak minder vaak", goed: true},
  militair: {label: "Militaire specificatie", tekst: "macht +2, heat +0,3/mnd", goed: true},
  goedkoop: {label: "Goedkoop gemaakt", tekst: "levert 15% meer op, maar vaker bijwerkingen en terugroepacties", goed: false},
  gevoelig: {label: "Storingsgevoelig", tekst: "verliest elk kwartaal populariteit tot er een nieuwe versie is", goed: false},
};
function kiesTrait(p, crit, flop){
  const goed = Object.keys(PRODUCT_TRAITS).filter(k => PRODUCT_TRAITS[k].goed && (k !== "militair" || ["wapen", "beveiliging"].includes(p.aard)) && (k !== "verslavend" || ["implantaat", "medisch", "data", "consument", "smokkel"].includes(p.aard)));
  const slecht = Object.keys(PRODUCT_TRAITS).filter(k => !PRODUCT_TRAITS[k].goed);
  if (crit) return CH(goed);
  if (flop) return R() < 0.6 ? CH(slecht) : null;
  return R() < 0.45 ? (R() < 0.7 ? CH(goed) : CH(slecht)) : null;
}
function prodLog(p, s, tekst){ (p.log ??= []).unshift({m: ym(s), tekst}); p.log = p.log.slice(0, 6); }
function traitEffecten(p){ const t = p.trait, o = {};
  if (t === "verslavend") o.heat = 0.3; if (t === "duurzaam") o.reputation = 0.2; if (t === "slim") o.invloed = 0.2; if (t === "militair"){ o.macht = 2; o.heat = 0.3; } return o; }
function wereldInvloedProducten(s){
  // wapens bewapenen de straat, beveiliging drukt syndicaten terug in je eigen gebied
  const mijn = s.districts.filter(d => d.control === "player").map(d => d.id);
  let wapen = 0, bev = 0;
  for (const p of (s.producten || []).filter(x => x.status === "markt")){ const f = prodSterkte(p); if (p.aard === "wapen") wapen += f; if (p.aard === "beveiliging") bev += f; }
  if (!wapen && !bev) return;
  for (const g of s.gangs || []) for (const land of Object.keys(g.gebied)){
    if (wapen) g.gebied[land] = Math.round(clamp(g.gebied[land] + wapen * 0.6, 0, 95));
    if (bev && mijn.includes(land)) g.gebied[land] = Math.round(clamp(g.gebied[land] - bev * 1.2, 0, 95));
  }
}

/* ===================== 3.0 PRODUCTEN VAN RIVALEN, CATALOGUS, BETER ONTWIKKELEN ===================== */
const PRODUCT_BASIS = {wapen: ["Karabijn", "Smartgun", "Railpistool", "Drone-geweer"], medisch: ["Kweekhuid", "Immuunpatch", "Bloedserum", "Celkuur"], implantaat: ["Optiek", "Reflexchip", "Kunstarm", "Neurolink"],
  data: ["Feed", "Profielbank", "Stream", "Zoekmachine"], beveiliging: ["Wachtdienst", "Bunkerdienst", "Escort", "Cyberwacht"], smokkel: ["Nachtvracht", "Grensdienst", "Stille lijn"], logistiek: ["Express", "Koelvracht", "Dronelijn", "Havendienst"],
  financieel: ["Krediet", "Fonds", "Polis", "Rekening"], orbitaal: ["Satlink", "Orbitlab", "Lanceerdienst"], consument: ["Lijn", "Serie", "Huismerk"]};
const rivalMerk = r => r.name.split(/[\s-]/)[0];
function mkRivalProduct(s, r, aard){
  aard ||= SECTOR_AARD[r.sector] || "consument";
  const used = new Set([...(s.producten || []).map(p => p.naam), ...s.rivals.flatMap(x => (x.producten || []).map(p => p.naam))]); let naam = "";
  for (let i = 0; i < 10; i++){ naam = `${rivalMerk(r)} ${CH(PRODUCT_BASIS[aard] || PRODUCT_BASIS.consument)}${CH(["", " Pro", " X", " 2", " Neo", " Prime", " 9"])}`; if (!used.has(naam)) break; }
  const lv = r.divs[r.sector] || 2;
  return {id: "rp" + hex8(), naam, aard, kwaliteit: clamp(Math.round(1 + lv / 2 + U(-0.6, 0.8)) + (((r.tech || {})[aard] || 0) >= 2 ? 1 : 0), 1, 5), pop: RI(40, 65), sinds: ym(s), leeftijd: 0};
}
function rivalProductInit(s){
  for (const r of s.rivals){ if (r.producten) continue; r.producten = [];
    for (const sec of Object.keys(r.divs)) r.producten.push(mkRivalProduct(s, r, SECTOR_AARD[sec] || "consument"));
    if ((r.divs[r.sector] || 0) >= 3) r.producten.push(mkRivalProduct(s, r, SECTOR_AARD[r.sector] || "consument")); }
}
function rivalProductTick(s){
  rivalProductInit(s);
  for (const r of s.rivals){
    for (const p of r.producten){ p.leeftijd = (p.leeftijd || 0) + 1; const v = (((s.vraag || {})[p.aard]) || {idx: 100}).idx;
      const tgt = 28 + p.kwaliteit * 8 + (v - 100) / 6 - Math.max(0, p.leeftijd - 30) * 0.8; p.pop = Math.round(clamp(p.pop + (tgt - p.pop) * 0.08 + U(-2, 2), 3, 95)); }
    r.producten = r.producten.filter(p => p.pop > 10 || p.leeftijd < 12);
    const max = 2 + Math.floor(Object.values(r.divs).reduce((a, b) => a + b, 0) / 3);
    if (r.producten.length < max && r.cash > 60 && R() < 0.07){
      const opts = [...new Set(Object.keys(r.divs).map(sec => SECTOR_AARD[sec] || "consument"))].sort((a, b) => ((((s.vraag || {})[b]) || {}).idx || 100) - ((((s.vraag || {})[a]) || {}).idx || 100));
      const p = mkRivalProduct(s, r, opts[0]); r.producten.push(p); r.cash = r1(r.cash - 10);
      const mine = (s.producten || []).filter(x => x.status === "markt" && (x.aard || aardVan(x.type, x.naam)) === p.aard); for (const x of mine) x.pop = Math.max(3, x.pop - 4);
      news(s, `${r.name} lanceert ${p.naam}`, `Een nieuw product in ${(PRODUCT_AARD[p.aard] || PRODUCT_AARD.consument).label.toLowerCase()}, kwaliteit ${p.kwaliteit}.${mine.length ? ` Concurrent van jouw ${mine.map(x => x.naam).join(", ")} (populariteit −4).` : ""}`, landNaam(s, r.hq), "markt", mine.length > 0);
    }
  }
}
const rivalProductInkomen = r => (r.producten || []).reduce((a, p) => a + p.kwaliteit * p.pop / 100, 0) * 1.5;

/* ontwikkelen met een focus en een voorspelling */
const DEV_FOCUS = {
  standaard: {label: "Gebalanceerd", tekst: "Geen bijzonderheden."},
  kwaliteit: {label: "Kwaliteit", tekst: "Kwaliteit +1, maar moeilijker (doel +1).", kw: 1, doel: 1},
  snel: {label: "Snel", tekst: "Een maand sneller, maar moeilijker (doel +1).", maanden: -1, doel: 1},
  goedkoop: {label: "Goedkoop", tekst: "40% goedkoper, maar vaak de eigenschap 'goedkoop gemaakt'.", kost: 0.6},
  innovatief: {label: "Innovatief", tekst: "Hit al bij 11 of 12, maar terugroepactie bij 2 of 3. Vaak slim of gepatenteerd.", crit: 11, blunder: 3},
  veilig: {label: "Veilig", tekst: "Nooit een terugroepactie (wordt een flop), vaak duurzaam. Doel +1.", veilig: true, doel: 1},
};
function devKansen(bonus, doel, focus){
  /* 4.1.2: hit vanaf doel+3, een neutrale band (matige start) tot doel−3, flop pas daaronder: de flopkans komt nooit boven 50% */
  const F = DEV_FOCUS[focus] || DEV_FOCUS.standaard, critT = F.crit || 12, blT = F.veilig ? 1 : (F.blunder || 2); let hit = 0, ok = 0, neutraal = 0, flop = 0, terug = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++){ const t = a + b;
    if (t >= critT || t + bonus >= doel + 3) hit++; else if (t <= blT) terug++; else if (t + bonus >= doel) ok++; else if (t + bonus >= doel - 3) neutraal++; else flop++; }
  const p = n => Math.round(n / 36 * 100); return {hit: p(hit), gewoon: p(ok), neutraal: p(neutraal), flop: p(flop), terug: p(terug)};
}
function devPlan(s, d, schaal, focus, aard, beta){
  const sc = PRODUCT_SCHAAL[schaal] || PRODUCT_SCHAAL.klein, F = DEV_FOCUS[focus] || DEV_FOCUS.standaard, k = productKans(s, d, schaal), dif = DIFF[s.player.difficulty] || 1;
  const doel = k.doel + (F.doel || 0), a = PRODUCT_AARD[aard] ? aard : aardVan(d.type, ""), bb = beta ? 1 : 0;
  return {kost: r1(sc.kost * dif * (F.kost || 1) * (beta ? 1.2 : 1)), maanden: Math.max(1, sc.maanden + (F.maanden || 0) - (heeftFocus(s, "rd") ? 1 : 0)) + bb, kw: clamp(1 + Math.floor(d.level / 2) + sc.kw + (F.kw || 0), 1, 5), bonus: k.bonus + bb, doel, beta: !!beta,
    kansen: devKansen(k.bonus + bb, doel, focus), aard: a, markt: vraagFactor(s, a), vraag: Math.round((((s.vraag || {})[a]) || {idx: 100}).idx),
    concurrenten: s.rivals.reduce((n, r) => n + (r.producten || []).filter(p => p.aard === a).length, 0)};
}
function lanceerWorp(s, d, p){
  const F = DEV_FOCUS[p.focus || "standaard"] || DEV_FOCUS.standaard, k = productKans(s, d, p.schaal || "klein"), doel = p.doelOverride || (k.doel + (F.doel || 0)), bonus = k.bonus + (p.beta ? 1 : 0);
  const a = d6(), b = d6(), t = a + b, blunder = !F.veilig && t <= (F.blunder || 2), crit = !blunder && (t >= (F.crit || 12) || t + bonus >= doel + 3), ok = crit || (!blunder && t + bonus >= doel), neutraal = !ok && !blunder && t + bonus >= doel - 3;
  return {ok, crit, blunder, neutraal, nat: t >= (F.crit || 12), txt: `${DICE[a - 1]}${DICE[b - 1]}${bonus ? ` +${bonus}` : ""}${p.beta ? " (bètatest)" : ""} = ${t + bonus}, nodig ${doel}+ (hit ${doel + 3}+)${crit ? " · hit" : blunder ? " · blunder" : neutraal ? " · matige start" : ""}`};
}
function focusTrait(p){
  if (p.focus === "goedkoop" && R() < 0.7) return "goedkoop";
  if (p.focus === "veilig" && R() < 0.4) return "duurzaam";
  if (p.focus === "innovatief" && R() < 0.45) return R() < 0.5 ? "slim" : "gepatenteerd";
  return undefined;
}

/* ===================== 3.0 DUIDELIJKHEID: adviezen, terugverdientijd ===================== */
function upgradePlan(s, d){
  const t = typeOf(s, d.type) || {rev: 8, cost: 5}, dif = DIFF[s.player.difficulty] || 1, kost = upgradeCost(s, d);
  const extraOmzet = t.rev * (Math.pow(d.level + 1, 0.95) - Math.pow(d.level, 0.95)) * marketRevMult(s, d.type) * sectorBonus(s, d.type) * productMult(s, d) * (0.75 + 0.35 * s.morale / 100);
  const extra = (extraOmzet - t.cost * 0.85 * dif * divCostMult(s, d.type)) * 0.8;
  return {kost, extra: r1(extra), terug: extra > 0.2 ? Math.round(kost / extra) : null};
}
function vestigingPlan(s, d){ const kost = districtCost(s, d), extra = r1((incOf(d) - d.upkeep) * 0.8); return {kost, extra, terug: extra > 0.2 ? Math.round(kost / extra) : null}; }
const adviesSleutel = t => String(t).replace(/[\d.,€±%−+]+/g, "#").slice(0, 60);
function adviesTick(s){ const nieuw = {}, T = s.adviesTel || {}; for (const a of adviezen(s)) { const k = adviesSleutel(a.tekst); nieuw[k] = (T[k] || 0) + 1; } s.adviesTel = nieuw; }
function adviezen(s, alles){
  const out = [], add = (prio, tekst, view) => out.push({prio, tekst, view});
  const markt = (s.producten || []).filter(p => p.status === "markt"), dev = (s.producten || []).filter(p => p.status === "ontwikkeling" || p.status === "wachtrij");
  const net = ((s.history || []).slice(-1)[0] || {}).netto;
  if (!markt.length && !dev.length && (s.flags.stappen_weg || maandenGespeeld(s) >= 8)) add(10, "Je verkoopt nog niets. Start je eerste product bij Bedrijf → Productlijn: klein kost €5M en is in 2 maanden klaar, en een divisie met producten verdient meer.", "bedrijf");
  else for (const d of s.divisions) if (!(s.producten || []).some(p => p.divisie === divNaam(d))) add((d.leeg || 0) > 12 ? 9 : 7, (d.leeg || 0) > 12 ? `${divNaam(d)} verkoopt al ${d.leeg} maanden niets: klanten lopen weg, omzet ×${productMult(s, d).toFixed(2)}. Start een product bij Bedrijf → Productlijn.` : `${divNaam(d)} heeft geen producten en draait op ×0,95; na een jaar zonder producten lopen klanten weg. Start er een bij Bedrijf → Productlijn.`, "bedrijf");
  if (s.cash < 0){ const nog = Math.max(1, 3 - (s.flags.negatieve_cash_maanden || 0)), dochter = (s.bedrijven || []).some(b => b.eigenaar === "player" && b.koppeling === "dochter"), aand = (s.bedrijven || []).some(b => !b.eigenaar && b.aandeel > 0);
    add(12, `Cash is negatief: nog ${nog} maand(en) tot faillissement. Snel geld: een lening (Financiën, tot €${Math.max(0, Math.round(loanCap(s)))}M)${s.accounts.zwart > 0 ? `, zwart geld overboeken (€${Math.round(s.accounts.zwart)}M)` : ""}${dochter ? ", een dochter verkopen (Bedrijf)" : ""}${aand ? ", aandelen verkopen (Wereld)" : ""}, of kosten schrappen: personeel, crew of een project.`, "financien"); }
  { const ng = markt.find(p => ["nodig", "afgekeurd"].includes(keurStatus(p)) && keurF(p) < 1); if (ng) add(8, `${ng.naam} is niet goedgekeurd en verkoopt alleen op de grijze markt (${Math.round(KEUR_ZONDER * 100)}% van de afzet). Een keuring kost €${keurKost(s)}M en twee maanden; of verkoop het via de zwarte markt (Details → Verkoop en keuring).`, "bedrijf"); }
  for (const p of markt){ const cap = prodCap(s, p), v = vraagNa(p); if (v > cap){ add(7, `${p.naam} is uitverkocht: ${Math.round((v - cap) / v * 100)}% van de vraag levert niets op. Productie uitbreiden kost €${capKost(s, p)}M (Bedrijf → Productlijn → Details).`, "bedrijf"); break; } }
  if ((s.keuzes || []).length) add(9, `${s.keuzes.length === 1 ? "1 beslissing wacht" : `${s.keuzes.length} beslissingen wachten`} op je. Zonder antwoord kiest het spel na twee maanden zelf, meestal niet in jouw voordeel.`, "overzicht");
  if (net != null && net < -1 && s.cash > 0 && s.cash / -net < 24) add(9, `Je verloor vorige maand €${Math.abs(net)}M. Met €${Math.round(s.cash)}M in kas heb je nog ±${Math.max(1, Math.round(s.cash / -net))} maanden. Snij in crew, personeel of projecten, of lanceer een product.`, "financien");
  if (s.staff.count < staffNeed(s)) add(8, `Onderbezet: ${s.staff.count} mensen voor ${staffNeed(s)} plekken. Divisies draaien op halve kracht en morale lijdt. Neem ${staffNeed(s) - s.staff.count} mensen aan bij Bedrijf (€0,4M p.p.).`, "bedrijf");
  if (s.morale < 40) add(9, `Morale ${Math.round(s.morale)}: onder 10 komt de raad in opstand. Salaris omhoog (Bedrijf), een gunst van de bond (Mensen) of winst draaien helpt.`, "bedrijf");
  { const h = (s.history || []).slice(-7), daling = h.length >= 6 ? r1(h[0].rep - h[h.length - 1].rep) : 0, pers = G.mails ? G.mails.filter(m => /^Journalist/.test(m.van) && m.datum >= ((s.history || []).slice(-6)[0] || {}).m).length : 0;
    const smaad = (s.smaadLog || []).filter(m => mndNr(ym(s)) - mndNr(m) <= 6).length, dl = String(daling).replace(".", ",");
    if (daling >= 6 && (pers >= 2 || s.reputation < 20)) add(8, pers >= 2 ? `Reputatie zakt (−${dl} in 6 maanden) en journalisten citeren interne stukken: misschien lekt er iemand uit je directie. Laat een speurder een directielid natrekken (Crew) of praat met je mensen (Mensen).`
      : smaad && smaad * 3 >= daling / 2 ? `Reputatie zakt (−${dl} in 6 maanden), vooral door ${smaad === 1 ? "een lastercampagne" : `${smaad} lastercampagnes`} van een concurrent. Herstel gaat via een spindokter met de klus Campagne (Crew), producten met een goede naam (medisch, beveiliging) of premium prijzen.`
      : smaad ? `Reputatie zakt (−${dl} in 6 maanden). ${smaad === 1 ? "Een lastercampagne" : `${smaad} lastercampagnes`} van een concurrent verklaren maar een deel; de rest is onduidelijk. Laat een speurder je directie natrekken (Crew), of kijk in Logboek wat er gebeurde.`
      : `Reputatie zakt (−${dl} in 6 maanden). Wat er gebeurde staat in Logboek. Herstel gaat via een spindokter met de klus Campagne (Crew), producten met een goede naam (medisch, beveiliging) of premium prijzen.`, "crew"); }
  { /* 5.6.1: straatoorlog, corpowetten en dominantie in Wat nu? */
    const dreig = []; for (const r of s.rivals){ if (r.status === "oorlog" || (r.relatie || 0) > -20) continue; for (const d of playerDistricts(s)) if (d.id !== s.player.home_district && !(s.patrouille || {})[d.id] && spanningVan(s, d.continent) >= STRAAT.drempel && reachable(s, r.name, d)) dreig.push([r, d]); }
    if (dreig.length){ const [r, d] = dreig[0]; add(8, `${r.name} mag je niet en kan ${d.name} op straat innemen (spanning ${Math.round(spanningVan(s, d.continent))}). Een patrouille maakt dat veel moeilijker: Wereld → Corpospanning.`, "wereld"); }
    const wet = Object.keys(CORPOWETTEN).find(k => wetStatus(s, k).ok); if (wet) add(5, `Corpowet ${CORPOWETTEN[wet].label} kan nu: ${CORPOWETTEN[wet].uitleg} Wereld → Corpospanning.`, "wereld");
    { const exP = (s.producten || []).filter(p => p.status === "markt" && EXPORT_AARD.includes(p.aard || aardVan(p.type, p.naam))); if (exP.length && !Object.keys(s.exportVergunning || {}).length && s.cash > vergunningKost(s) + 50) add(4, `Je verkoopt ${PRODUCT_AARD[exP[0].aard || aardVan(exP[0].type, exP[0].naam)].label.toLowerCase()} alleen op je eigen continent. Een exportvergunning (Bedrijf → Export, €${vergunningKost(s)}M) geeft +${Math.round(EXPORT_BONUS * 100)}% omzet per continent.`, "bedrijf"); }
    { const mijn = [...new Set((s.producten || []).filter(p => p.status === "markt").flatMap(grondstoffenVan))], st = mijn.find(m => gsPrijs(s, m) >= 1.4 && !gsVoorraad(s, m)), go = mijn.find(m => gsPrijs(s, m) <= 0.85 && !gsVoorraad(s, m));
      if (st) add(5, `${GRONDSTOF[st].label} is duur (×${gsPrijs(s, st)}): je productiekosten stijgen. Bij Bedrijf → Toelevering zie je waarom; voorraad helpt pas als de prijs weer zakt.`, "bedrijf");
      else if (go) add(4, `${GRONDSTOF[go].label} is goedkoop (×${gsPrijs(s, go)}). Nu voorraad aanleggen (Bedrijf → Toelevering) zet die prijs vast.`, "bedrijf"); }
    { const pp = (s.producten || []).find(p => p.status === "markt" && !p.patent && besteSpec(p).v >= PATENT_MIN); if (pp && s.cash > patentKost(s) + 30) add(4, `${pp.naam} heeft een sterke ${besteSpec(pp).naam.toLowerCase()} (${besteSpec(pp).v}). Een patent (productblad → Markt, €${patentKost(s)}M) geeft +${Math.round(PATENT_BONUS * 100)}% omzet en licentiegeld.`, "bedrijf"); }
    { const O = s.onderzoek || {}; const aa = [...new Set((s.producten || []).filter(p => p.status === "markt").map(p => p.aard || aardVan(p.type, p.naam)))].find(x => techNiveau(s, x) < 3 && TECH_NAMEN[x]); if (!O.lopend && aa && s.cash > techKost(s, techNiveau(s, aa) + 1) / techMaanden(techNiveau(s, aa) + 1) + 60 && maandenGespeeld(s) >= 6) add(3, `Er loopt geen onderzoek. ${TECH_NAMEN[aa][techNiveau(s, aa)]} geeft ${PRODUCT_AARD[aa].label.toLowerCase()} ${TECH_EFFECT[techNiveau(s, aa)]} (Bedrijf → Onderzoek).`, "bedrijf"); }
    if (s.ceo){ const C = s.ceo, L = Math.floor(C.leeftijd || 40); if (C.stress > 70) add(6, `Je stress is ${Math.round(C.stress)}: kans op een burn-out en je gezondheid zakt. Vakantie of tijd voor je gezin helpt (Mensen → Jij, de CEO).`, "mensen");
      else if (C.gezondheid < 35) add(6, `Je gezondheid is ${Math.round(C.gezondheid)}. Een kliniek (€10M) of minder stress helpt; regel ook een opvolger.`, "mensen");
      if (!C.opvolger && (L >= 58 || C.gezondheid < 40)) add(5, `Je bent ${L} en hebt geen opvolger. Valt je weg, dan haalt de raad een buitenstaander (morale −12, reputatie −8). Wijs iemand aan bij Mensen → Jij, de CEO.`, "mensen"); }
    const av = (s.aanvragen || [])[0]; if (av) add(7, `${av.klant} wil ${av.raam ? "een raamcontract" : "een levering"} (${PRODUCT_AARD[av.aard].label.toLowerCase()}). Inschrijven bij Bedrijf → Klanten, nog ${av.verloopt} maand${av.verloopt > 1 ? "en" : ""}.`, "bedrijf");
    { const dr = s.districts.find(d => d.control === "player" && d.domRiv); if (dr) add(8, `${dr.domRiv.naam} heeft meer aandeel in ${dr.name} dan jij: volgende maand is het district van hen. Bouw aanwezigheid op of zet er een patrouille (Kaart).`, "kaart"); }
    const bijna = s.districts.find(d => (d.domMnd || 0) >= 1); if (bijna) add(6, `${bijna.name} valt je volgende maand toe als je aandeel boven ${DOM_FLIP}% blijft (Kaart).`, "kaart"); }
  if (s.heat > 55) add(9, `Heat ${Math.round(s.heat)}: boven 90 volgt een razzia. Laat een netrunner sporen wissen (Crew), vraag de commissaris om een gunst (Mensen) of gebruik invloed (Kaart).`, "crew");
  const vrijeCrew = (s.crew || []).filter(m => crewStatus(s, m) === "vrij");
  for (const k of (s.klussen || [])){ const m = vrijeCrew.find(x => x.rol === k.rol); if (m){ add(6, `${m.naam} kan de klus "${k.titel}" doen: +€${k.beloning}M, ${kans2d6(crewBonus(s, m, k.gevaar), k.doel, m.trait === "slordig")}% kans.`, "crew"); break; } }
  if (vrijeCrew.length && !out.some(x => x.view === "crew")) add(4, `${vrijeCrew.length} crewlid(en) doen deze maand nog niets. Opdrachten kosten niets extra.`, "crew");
  const ups = s.divisions.filter(d => !s.projects.some(p => p.division === divNaam(d))).map(d => ({d, ...upgradePlan(s, d)})).filter(x => x.terug && x.kost < s.cash - 20).sort((a, b) => a.terug - b.terug)[0];
  if (ups) add(ups.terug <= 18 ? 6 : 3, `${divNaam(ups.d)} uitbreiden naar L${ups.d.level + 1}: €${ups.kost}M, ±+€${ups.extra}M per maand na belasting, terugverdiend in ±${ups.terug} maanden.`, "bedrijf");
  const vest = s.districts.filter(d => d.control === "neutral" && reachable(s, "player", d) && !s.projects.some(p => p.district === d.id)).map(d => ({d, ...vestigingPlan(s, d)})).filter(x => x.terug && x.kost < s.cash - 20).sort((a, b) => a.terug - b.terug)[0];
  if (vest) add(5, `Vestiging in ${vest.d.name}: €${vest.kost}M, ±+€${vest.extra}M per maand, terugverdiend in ±${vest.terug} maanden. Telt ook mee voor dominantie.`, "kaart");
  for (const g of s.gangs || []) if (!g.deal && gangLanden(s, g).length){ add(5, `${g.naam} zit in je gebied zonder afspraak. Vroeg of laat komt er een rekening: bescherming kost €${gangFee(s, g)}M per maand.`, "onderwereld"); break; }
  const best = doelen(s).filter(d => d.id !== "termijn").sort((a, b) => b.pct - a.pct)[0];
  if (best) add(1, `Dichtst bij winst: ${best.naam} (${best.pct}%, ${best.nu}).`, "overzicht");
  /* 4.5.2: een niet-dringend advies dat al drie maanden onveranderd staat, zakt naar "staat al een tijdje" */
  const T = s.adviesTel || {}; for (const a of out){ a.maanden = T[adviesSleutel(a.tekst)] || 0; a.oud = a.maanden >= 3 && a.prio < 9; }
  out.sort((a, b) => b.prio - a.prio); if (alles) return out; return [...out.filter(a => !a.oud).slice(0, 6), ...out.filter(a => a.oud).slice(0, 4)];
}
function adviesCard(st){
  const A = st.adviezen; if (!A.length) return "";
  return `<div class="card advies"><div class="spread"><h3>Wat nu?</h3><span class="dim" style="font-size:13px">op volgorde van belang</span></div>
    <ol class="alist">${A.filter(a => !a.oud).map(a => `<li><span>${esc(a.tekst)}</span>${a.view && a.view !== "overzicht" ? `<button class="btn sm" data-view="${a.view}">Ga</button>` : ""}</li>`).join("")}</ol>
    ${A.some(a => a.oud) ? `<details style="margin-top:6px"><summary class="dim" style="cursor:pointer;font-size:13px">Staat al een tijdje (${A.filter(a => a.oud).length})</summary><ul class="alist dim" style="font-size:13.5px">${A.filter(a => a.oud).map(a => `<li><span>${esc(a.tekst)}</span>${a.view && a.view !== "overzicht" ? `<button class="btn sm" data-view="${a.view}">Ga</button>` : ""}</li>`).join("")}</ul></details>` : ""}</div>`;
}
const SPELREGELS = [
  ["Tijd", "Rechtsboven: ▶ laat de maanden vanzelf lopen, op snelheid 1 (traag) tot 5 (turbo); +1 maand doet er precies één. De tijd pauzeert vanzelf bij een nieuw besluit, een kritieke mail, oorlog, heat boven 85 of een rode kas, en zolang je typt of een venster open hebt. Spatie = afspelen/pauze."],
  ["Opslaan", "Het spel bewaart zichzelf na elke actie. Een opslagpunt (Ctrl+S, Menu → Opslaan of links OPSLAAN) is een vaste kopie van dit moment; via Menu → Laden ga je er later naar terug. Het staat als apart spel in de lijst."],
  ["Een beurt", "Elke beurt is een maand. Je doet wat je wilt (producten, mensen, crew, deals) en klikt dan +1 maand of laat de tijd lopen. Dan rekent de engine omzet, kosten, gebeurtenissen en rivalen uit en stuurt de CFO een rapport."],
  ["Geld", "Omzet komt uit divisies (hoger niveau = meer), producten (kwaliteit × populariteit × markt), gebieden, contracten en klussen. Kosten: divisies, lonen, crew, rente, projecten en winstbelasting. Drie maanden rood = failliet."],
  ["Dobbelstenen", "Elke onzekere actie is 2d6 + bonus tegen een doel. Twee zessen lukt altijd, twee enen nooit. De kans die je vooraf ziet is de echte kans. Elke worp staat in Logboek → Dobbelstenen."],
  ["Morale en heat", "Morale onder 10, twee maanden lang: coup. Heat boven 90, twee maanden lang: razzia. Heat komt vooral uit riskante en illegale divisies (Smokkel, Cyberware, Private Security), die met elk niveau meer aandacht trekken; legale divisies trekken boven niveau 6 geen extra aandacht meer. Het overzicht laat zien waarom ze bewegen en waarschuwt ruim op tijd."],
  ["Stilstand", "Verkoopt een divisie een jaar lang niets, dan lopen klanten naar rivalen: de omzet zakt elke maand verder, tot −20%. Eén product op de markt stopt het meteen."],
  ["Winnen", "Een bedrijfswaarde van €12.400M (10 jaar: €7.200M, eindeloos: €16.800M), 60% op drie continenten, of 3 van de 5 oorspronkelijke rivalen uitgeschakeld. Anders telt na de gekozen speellengte je score. Sta je op de beurs, dan telt alleen jouw deel van de bedrijfswaarde."],
  ["Corporate zone", "Een vierde manier om te winnen: wordt je thuiscontinent een corporate zone (corpospanning 90+) terwijl jij er 60% of meer van de dominantie hebt, dan regeert jouw corporatie daar. Spanning stijgt vanzelf, en sneller door oorlogen, straatgevechten en bendeoorlogen."],
  ["De wereld", "Elk continent heeft een corpospanning (Wereld → Corpospanning): hoe hoger, hoe meer corporaties mogen (patrouilles, straatgevechten, corpowetten), maar ook sancties en duurdere grondstoffen. Districten zijn verdeeld in aandelen; met aanwezigheid neem je ze zonder oorlog over (Kaart)."],
  ["Handel en groei", "Klanten sturen aanvragen en raamcontracten (Bedrijf → Klanten). Exportvergunningen openen continenten voor wapens, beveiliging en implantaten. Grondstoffen kun je vooruit inkopen (Toelevering). Onderzoek en patenten maken je producten sterker. Per product kies je in welke regio's je verkoopt (productblad → Markt)."],
  ["Score", "Bedrijfswaarde telt met de wortel (40 × √waarde), plus dominantie, reputatie, jaren, uitgeschakelde rivalen en status. Winnen ×1,25 plus tempo, termijn uitdienen ×1, verliezen ×0,75 en zonder de waarde van je bedrijf: een verlies scoort dus nooit hoger dan overleven met hetzelfde bedrijf."],
  ["Keuzes", "Keuzemails hebben knoppen; elke optie zegt wat ze kost en doet. Antwoord je niet, dan kiest het spel na twee maanden de standaardoptie."],
];

/* ===================== 3.2 CONCEPTEN: jij beschrijft, de GM ontwerpt, de engine gooit ===================== */
const CONCEPT_SOORT = {product: "Product", dienst: "Dienst", abonnement: "Abonnement", netwerk: "Netwerk"};
const EFF_GRENS = {macht: [0, 3], heat: [-0.5, 1], reputation: [-0.5, 0.6], invloed: [0, 0.5], zwart: [0, 1.2], morale: [-0.3, 0.3], straat: [-0.6, 0.6], politie: [-0.6, 0.6], stad: [-0.6, 0.6], vakbond: [-0.6, 0.6], nomaden: [-0.6, 0.6]};
const cStr = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function conceptPrompt(s, d, tekst){
  const b = Math.ceil(d.level / 2);
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie op de echte wereldkaart (taal: Nederlands, toon: droog, cynisch, corporate-noir). De CEO van ${s.player.corp_name} wil iets nieuws op de markt brengen via de divisie "${divNaam(d)}" (${d.type}, niveau ${d.level}). Zijn eigen omschrijving: "${tekst}".

Ontwerp dit als een echt ding in deze wereld, zo dicht mogelijk bij wat de CEO bedoelt. Bepaal of het een product, een dienst, een abonnement of een netwerk is; geef het een naam (gebruik de naam van de CEO als die er een noemt), een doelgroep en wat het met de wereld doet. Wees eerlijk: groot is duur en moeilijk, illegaal of gewelddadig geeft heat, iets dat mensen redt geeft reputatie. Schrijf daarnaast 2 of 3 gebeurtenissen die later met juist DIT ding kunnen gebeuren (een klant, een incident, de pers, een concurrent, de overheid), elk met 2 of 3 echte keuzes.

Regels en grenzen:
- "kost" 3-60 (M€, opzetten), "maanden" 1-6, "kwaliteit" 1-5, "moeilijkheid" 5-10: bij de lancering gooit de engine 2d6 + ${b} en moet dit getal halen (6 makkelijk, 8 gemiddeld, 10 zeer moeilijk). Moeilijkheid hoort bij hoe gewaagd het idee is, niet bij het budget: met genoeg geld is iets groots niet automatisch riskant. Hoge kwaliteit voor weinig geld kan niet.
- "markt": de soort markt waar het in concurreert, één van: wapen, medisch, implantaat, data, beveiliging, smokkel, logistiek, financieel, orbitaal, consument.
- "effecten": wat het per maand doet bij volle populariteit, alleen deze velden: macht 0..3, heat -0.5..1, reputation -0.5..0.6, invloed 0..0.5, zwart 0..1.2 (M€ zwart geld), morale -0.3..0.3, straat/politie/stad/vakbond/nomaden -0.6..0.6. Laat weg wat niet verandert.
- Gebeurtenis-opties: "kost" (M€ vooraf, 0-40) en "effect" met: cash (-30..20), heat, reputation, morale (-10..10), invloed (0..10), zwart (-20..20), factions {naam: -10..10}, populariteit (-25..25), of een kansworp {"kans": 5-95, "succes": {...}, "falen": {...}}.

Stand van de wereld (alleen voor jou): ${JSON.stringify({cash: Math.round(s.cash), heat: Math.round(s.heat), reputatie: Math.round(s.reputation), tijdperk: TIJDPERKEN[s.tijdperk || 0].naam, divisies: s.divisions.map(x => `${divNaam(x)} (${x.type} L${x.level})`), eigen_producten: (s.producten || []).map(p => p.naam), vraag: Object.fromEntries(Object.entries(s.vraag || {}).map(([k2, v]) => [k2, Math.round(v.idx)])), rivalen: s.rivals.map(r => r.name)})}

Antwoord met alleen JSON:
{"naam": "...", "soort": "product|dienst|abonnement|netwerk", "pitch": "2-4 zinnen in de stem van het hoofd R&D: wat het is en voor wie", "doelgroep": "...", "markt": "...", "kost": 12, "maanden": 3, "moeilijkheid": 7, "kwaliteit": 3, "effecten": {"reputation": 0.3}, "vraag": "welke situatie in de wereld de vraag aanjaagt", "risico": "1 zin", "gebeurtenissen": [{"van": "...", "titel": "...", "tekst": "2-3 zinnen", "opties": [{"label": "...", "uitleg": "wat het kost en doet", "kost": 0, "effect": {"reputation": 3}}]}]}`;
}
function cleanKeuzeEff(e, diep){
  const o = {}, num = (v, lo, hi) => Math.round(clamp(+v || 0, lo, hi) * 10) / 10;
  if (!e || typeof e !== "object") return o;
  if (e.kans != null && !diep){ o.kans = Math.round(clamp(+e.kans || 50, 5, 95)); o.succes = cleanKeuzeEff(e.succes, true); o.falen = cleanKeuzeEff(e.falen, true); return o; }
  if (e.cash) o.cash = num(e.cash, -30, 20);
  for (const k2 of ["heat", "reputation", "morale"]) if (e[k2]) o[k2] = num(e[k2], -10, 10);
  if (e.invloed) o.invloed = num(e.invloed, 0, 10); if (e.zwart) o.zwart = num(e.zwart, -20, 20);
  if (e.populariteit) o.populariteit = Math.round(clamp(+e.populariteit || 0, -25, 25));
  if (e.factions && typeof e.factions === "object"){ o.factions = {}; for (const [n, v] of Object.entries(e.factions)) if (["straat", "politie", "stad", "vakbond", "nomaden"].includes(n)) o.factions[n] = num(v, -10, 10); }
  if (e.tekst) o.tekst = cStr(e.tekst, 200);
  return o;
}
function cleanConcept(r, s, d){
  r = r && typeof r === "object" ? r : {};
  const kost = r1(clamp(+r.kost || 10, 3, 60)), maxKw = clamp(1 + Math.floor(kost / 8) + Math.floor(d.level / 2), 1, 5);
  const kw = Math.round(clamp(+r.kwaliteit || 2, 1, maxKw)), eff = {};
  for (const [k2, [lo, hi]] of Object.entries(EFF_GRENS)) if (r.effecten && r.effecten[k2] != null && isFinite(+r.effecten[k2]) && +r.effecten[k2] !== 0) eff[k2] = Math.round(clamp(+r.effecten[k2], lo, hi) * 10) / 10;
  const gb = (Array.isArray(r.gebeurtenissen) ? r.gebeurtenissen : []).slice(0, 3).map(g => ({van: cStr(g.van || "R&D", 60), titel: cStr(g.titel, 80), tekst: cStr(g.tekst, 500),
    opties: (Array.isArray(g.opties) ? g.opties : []).slice(0, 3).map(o => ({label: cStr(o.label, 60), uitleg: cStr(o.uitleg, 180), kost: r1(clamp(+o.kost || 0, 0, 40)), eff: cleanKeuzeEff(o.effect)})).filter(o => o.label)})).filter(g => g.titel && g.opties.length >= 2);
  return {naam: cStr(r.naam, 40) || nieuwProductNaam(s, d.type), soort: CONCEPT_SOORT[r.soort] ? r.soort : "product", pitch: cStr(r.pitch, 500), doelgroep: cStr(r.doelgroep, 80),
    markt: PRODUCT_AARD[r.markt] ? r.markt : aardVan(d.type, r.naam || ""), kost, maanden: Math.round(clamp(+r.maanden || 3, 1, 6)), doel: Math.round(clamp(Math.max(+r.moeilijkheid || 7, 3 + kw), 5, 10)), kwaliteit: kw, eff,
    vraag: cStr(r.vraag, 140), risico: cStr(r.risico, 200), gebeurtenissen: gb, divisie: divNaam(d)};
}
function conceptKansen(s, c){ const d = s.divisions.find(x => divNaam(x) === c.divisie) || {level: 1}; return devKansen(Math.ceil(d.level / 2) + ((s.crew || []).some(m => m.rol === "spindokter") ? 1 : 0), c.doel, "standaard"); }
function actConcept(s, ctx, c){
  if (!c) return {ok: false, msg: "Er ligt geen concept klaar."};
  const d = s.divisions.find(x => divNaam(x) === c.divisie); if (!d) return {ok: false, msg: "Die divisie bestaat niet meer."};
  const alle = (s.producten || []).filter(p => p.divisie === divNaam(d) && p.status !== "teruggeroepen");
  if (alle.length >= maxProducten(d)) return {ok: false, msg: `${divNaam(d)} draagt al ${maxProducten(d)} producten (inclusief de wachtrij). Haal er een uit de markt of breid de divisie uit.`};
  if ((s.producten || []).some(p => p.naam === c.naam)) return {ok: false, msg: "Die naam bestaat al."};
  const kost = r1(c.kost * (DIFF[s.player.difficulty] || 1)), bezig = alle.some(p => p.status === "ontwikkeling");
  if (bezig && alle.filter(p => p.status === "wachtrij").length >= 3) return {ok: false, msg: "De wachtrij is vol (3)."};
  if (!bezig){ if (s.cash < kost) return {ok: false, msg: `Opzetten kost €${kost}M. Niet genoeg cash.`}; s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash; }
  const p = mkProduct(s, d, c.naam, c.kwaliteit, 0);
  Object.assign(p, {maandenOverride: c.maanden, aard: c.markt, soort: c.soort, pitch: c.pitch, doelgroep: c.doelgroep, eigenEff: c.eff, doelOverride: c.doel, kostOverride: kost, gb: c.gebeurtenissen, schaal: c.kost >= 25 ? "vlag" : c.kost >= 10 ? "groot" : "klein", vraagTekst: c.vraag, risico: c.risico});
  if (bezig) p.status = "wachtrij"; else { p.status = "ontwikkeling"; p.eta = c.maanden; }
  (s.producten ??= []).push(p); prodLog(p, s, `${CONCEPT_SOORT[c.soort]} ontworpen met de GM${bezig ? " (in de wachtrij)" : ""}`);
  const K = conceptKansen(s, c);
  const msg = `${c.naam} ${bezig ? "staat in de wachtrij" : `is in ontwikkeling: €${kost}M, ${c.maanden} maand(en)`}. Bij de lancering: hit ${K.hit}%, gewoon ${K.gewoon}%, matig ${K.neutraal}%, flop ${K.flop}%, terugroepactie ${K.terug}%.`;
  addLog(s, msg); return {ok: true, msg};
}
function gbEff(e, pid){ const o = {...(e || {})}; if (o.populariteit){ o.product = {[pid]: {pop: o.populariteit}}; delete o.populariteit; } if (o.succes) o.succes = gbEff(o.succes, pid); if (o.falen) o.falen = gbEff(o.falen, pid); return o; }
async function gmConcept(divisie, tekst){
  const s = G.game, d = s && s.divisions.find(x => divNaam(x) === divisie); if (!d) return {ok: false, bericht: "Kies een divisie."};
  tekst = cStr(tekst, 600); if (tekst.length < 4) return {ok: false, bericht: "Beschrijf eerst wat je wilt maken."};
  if (!live()) return {ok: false, bericht: "De GM is niet live verbonden. Gebruik 'Handmatig', of vraag het in de Claude-chat."};
  try { const r = await G.sample.json(conceptPrompt(s, d, tekst), {modelTier: "default"}); const c = cleanConcept(r, s, d); c.vraagVan = tekst; (G.concepten ??= {})[divisie] = c; return {ok: true, bericht: `De GM heeft ${c.naam} uitgewerkt. Lees het voorstel en kies.`}; }
  catch(e){ return {ok: false, bericht: sampleErrorText(e)}; }
}

/* ===================== 3.3 DE GM ONTWERPT DIVISIES EN SCHRIJFT VERHAALBOGEN ===================== */
function cleanVerhaalEff(e, s, diep){
  const o = cleanKeuzeEff(e, diep); if (!e || typeof e !== "object") return o;
  if (o.kans != null){ o.succes = cleanVerhaalEff(e.succes, s, true); o.falen = cleanVerhaalEff(e.falen, s, true); return o; }
  const num = (v, lo, hi) => Math.round(clamp(+v || 0, lo, hi));
  if (e.product){ const p = (s.producten || []).find(x => x.naam === String(e.product)); if (p && o.populariteit){ o.product = {[p.id]: {pop: o.populariteit}}; } }
  delete o.populariteit;
  if (e.rivaal && typeof e.rivaal === "object"){ for (const [n, v] of Object.entries(e.rivaal)){ const r = s.rivals.find(x => x.name === n); const rel = typeof v === "object" ? v.relatie : v; if (r && rel) (o.rivaal ??= {})[r.name] = {relatie: num(rel, -15, 15)}; } }
  if (e.loyaliteit && typeof e.loyaliteit === "object"){ for (const [n, v] of Object.entries(e.loyaliteit)) if (s.npcs.some(x => x.name === n)) (o.loyaliteit ??= {})[n] = num(v, -15, 15); }
  return o;
}
function cleanKeuzeGM(k, s){
  k = k && typeof k === "object" ? k : {};
  const opties = (Array.isArray(k.opties) ? k.opties : []).slice(0, 3).map(o => ({label: cStr(o.label, 60), uitleg: cStr(o.uitleg, 200), kost: r1(clamp(+o.kost || 0, 0, 40)), eff: cleanVerhaalEff(o.effect, s)})).filter(o => o.label);
  return {van: cStr(k.van || "Een bekende", 60), titel: cStr(k.titel, 90), tekst: cStr(k.tekst, 700), opties};
}
/* divisie of eigen bedrijfstak in eigen woorden */
function divisiePrompt(s, tekst){
  const soorten = allTypes(s).map(t => { const x = typeOf(s, t); return `${t} (omzet ${x.rev}, kosten ${x.cost}, heat ${x.heat})`; }).join("; ");
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie op de echte wereldkaart (Nederlands, droog, cynisch, corporate-noir). De CEO van ${s.player.corp_name} wil een nieuwe divisie of bedrijfstak. Zijn eigen woorden: "${tekst}".

Kies de best passende bestaande soort, of verzin een nieuwe soort als het echt iets anders is. Bestaande soorten (per niveau per maand, M€): ${soorten}.
Voor een nieuwe soort geef je cijfers per niveau per maand: rev 5-14, cost 3-8 (rev hoogstens cost+7), heat 0-4 (legaal 0-1, grijs 2, illegaal 3-4), vol 0.1-0.5.
Geef ook het eerste product of de eerste dienst van deze divisie, en een kort openingsverhaal: iets dat gebeurt op de dag dat de divisie opent, met 2 of 3 keuzes.
Effecten van product en keuzes volgen deze grenzen. Product: kost 3-60, maanden 1-6, moeilijkheid 5-10, kwaliteit 1-5, markt (wapen, medisch, implantaat, data, beveiliging, smokkel, logistiek, financieel, orbitaal, consument), effecten per maand (macht 0..3, heat -0.5..1, reputation -0.5..0.6, invloed 0..0.5, zwart 0..1.2, morale -0.3..0.3, straat/politie/stad/vakbond/nomaden -0.6..0.6). Keuze-effecten: cash (-30..20), heat, reputation, morale (-10..10), invloed, zwart, factions {naam: -10..10}, of {"kans": 5-95, "succes": {...}, "falen": {...}}; een optie mag "kost" hebben (0-40).

Stand: ${JSON.stringify({cash: Math.round(s.cash), divisies: s.divisions.map(x => `${divNaam(x)} (${x.type} L${x.level})`), land: homeLandNaam(s), tijdperk: TIJDPERKEN[s.tijdperk || 0].naam})}

Antwoord met alleen JSON:
{"naam": "naam van de divisie", "soort": "bestaande of nieuwe soortnaam", "nieuw": false, "cijfers": {"rev": 9, "cost": 5, "heat": 1, "vol": 0.3}, "omschrijving": "2-3 zinnen in de stem van de COO", "product": {"naam": "...", "soort": "product|dienst|abonnement|netwerk", "pitch": "...", "doelgroep": "...", "markt": "...", "kost": 10, "maanden": 2, "moeilijkheid": 7, "kwaliteit": 2, "effecten": {}, "vraag": "...", "risico": "...", "gebeurtenissen": []}, "opening": {"van": "...", "titel": "...", "tekst": "...", "opties": [{"label": "...", "uitleg": "...", "kost": 0, "effect": {}}]}}`;
}
function cleanDivisie(r, s){
  r = r && typeof r === "object" ? r : {};
  const naam = cStr(r.naam, 40) || "Nieuwe divisie";
  let soort = cStr(r.soort, 30), nieuw = !typeOf(s, soort);
  if (!soort) { soort = "Logistiek"; nieuw = false; }
  const c = r.cijfers || {}, cost = clamp(+c.cost || 5, 3, 8), cijfers = {rev: r1(Math.min(clamp(+c.rev || 9, 5, 14), cost + 7)), cost: r1(cost), heat: Math.round(clamp(+c.heat || 0, 0, 4)), vol: Math.round(clamp(+c.vol || 0.3, 0.1, 0.5) * 100) / 100};
  const pseudo = {name: naam, type: soort, level: 1};
  const product = r.product ? cleanConcept(r.product, s, pseudo) : null; if (product) product.divisie = naam;
  const opening = r.opening ? cleanKeuzeGM(r.opening, s) : null;
  return {naam, soort, nieuw, cijfers: nieuw ? cijfers : typeOf(s, soort), omschrijving: cStr(r.omschrijving, 400), product, opening: opening && opening.titel && opening.opties.length >= 2 ? opening : null, vraagVan: ""};
}
async function gmDivisie(tekst){
  const s = G.game; tekst = cStr(tekst, 600); if (tekst.length < 4) return {ok: false, bericht: "Beschrijf eerst wat voor tak je wilt."};
  if (!live()) return {ok: false, bericht: "De GM is niet live verbonden. Kies hieronder een soort uit de lijst."};
  try { const r = await G.sample.json(divisiePrompt(s, tekst), {modelTier: "default"}); const c = cleanDivisie(r, s); c.vraagVan = tekst; G.divConcept = c; return {ok: true, bericht: `De GM heeft ${c.naam} uitgewerkt.`}; }
  catch(e){ return {ok: false, bericht: sampleErrorText(e)}; }
}
function actDivisieConcept(s, ctx, c){
  if (!c) return {ok: false, msg: "Er ligt geen voorstel klaar."};
  if (s.divisions.some(x => divNaam(x) === c.naam) || s.projects.some(p => p.new_name === c.naam)) return {ok: false, msg: "Die naam bestaat al."};
  if (c.nieuw && !typeOf(s, c.soort)){ const r = addCustomType(s, c.soort, c.cijfers, c.omschrijving); if (!r.ok) return {ok: false, msg: r.msg}; }
  const r = actProject(s, "divisie", {type: c.soort, naam: c.naam}); if (!r.ok) return r;
  const proj = s.projects[s.projects.length - 1]; proj.eersteProduct = c.product; proj.opening = c.opening; proj.done_msg = c.omschrijving || proj.done_msg;
  return {ok: true, msg: r.msg + (c.product ? ` Bij de opening staat ${c.product.naam} meteen in de wachtrij.` : "")};
}
function divisieOpening(s, ctx, p, d){
  if (p.eersteProduct){ const c = p.eersteProduct, q = mkProduct(s, d, c.naam, c.kwaliteit, 0);
    Object.assign(q, {status: "wachtrij", maandenOverride: c.maanden, aard: c.markt, soort: c.soort, pitch: c.pitch, doelgroep: c.doelgroep, eigenEff: c.eff, doelOverride: c.doel, kostOverride: r1(c.kost * (DIFF[s.player.difficulty] || 1)), gb: c.gebeurtenissen, schaal: c.kost >= 25 ? "vlag" : c.kost >= 10 ? "groot" : "klein"});
    if (!(s.producten || []).some(x => x.naam === q.naam)){ (s.producten ??= []).push(q); prodLog(q, s, "Eerste product van de nieuwe divisie"); } }
  if (p.opening) addKeuze(s, ctx, {soort: "opening_" + hex8(), gm: true, ...p.opening, standaard: p.opening.opties.length - 1});
}
/* verhaalbogen: de GM schrijft om de paar maanden een volgend hoofdstuk rond jouw bedrijf */
function verhaalPrompt(s){
  const V = s.verhaal || null, laatste = (s.keuzes_klaar || []).find(k => k.soort === "gmverhaal");
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie (Nederlands, droog, cynisch, corporate-noir). Schrijf het volgende hoofdstuk van een verhaal rond het bedrijf van de speler. Gebruik wat er echt is: de producten en diensten, de directie, de crew, de rivalen, de syndicaten, het nieuws. Geen losse grap: een verhaal met mensen, motieven en gevolgen.
${V && !V.klaar ? `Lopende verhaallijn: "${V.boog}". Tot nu toe: ${V.samenvatting}${laatste ? ` De CEO koos vorige keer: "${laatste.gekozen}"${laatste.uitkomst ? ` (${laatste.uitkomst})` : ""}.` : ""} Schrijf hoofdstuk ${(V.hoofdstuk || 1) + 1}. Na 3 of 4 hoofdstukken sluit je af ("laatste": true).` : "Begin een nieuwe verhaallijn die 2 tot 4 hoofdstukken duurt."}
Geef één keuze met 2 of 3 opties die echt verschillen. Effecten volgen deze grenzen: cash (-30..20), heat, reputation, morale (-10..10), invloed (0..10), zwart (-20..20), factions {straat|politie|stad|vakbond|nomaden: -10..10}, rivaal {"exacte rivaalnaam": {"relatie": -15..15}}, loyaliteit {"exacte naam directielid": -15..15}, "product": "exacte productnaam" met "populariteit": -25..25, of een kansworp {"kans": 5-95, "succes": {...}, "falen": {...}}. Een optie mag "kost" hebben (0-40).

Stand: ${JSON.stringify({bedrijf: s.player.corp_name, land: homeLandNaam(s), datum: ym(s), cash: Math.round(s.cash), heat: Math.round(s.heat), reputatie: Math.round(s.reputation), morale: Math.round(s.morale),
    producten: (s.producten || []).filter(p => p.status === "markt").map(p => ({naam: p.naam, vorm: p.soort || "product", pitch: (p.pitch || "").slice(0, 120), populariteit: p.pop})),
    directie: s.npcs.map(n => `${n.name} (${n.role}, ${impression(n)})`), crew: (s.crew || []).map(m => `${m.naam} (${m.rol})`),
    rivalen: s.rivals.map(r => `${r.name} (CEO ${r.ceo}, ${r.status}, relatie ${r.relatie})`), syndicaten: (s.gangs || []).filter(g => gangLanden(s, g).length).map(g => `${g.naam} (${g.leider}, ${g.deal || "geen afspraak"})`),
    nieuws: (s.nieuws || []).slice(0, 5).map(n => n.kop)})}

Antwoord met alleen JSON:
{"boog": "titel van de verhaallijn", "samenvatting": "1-2 zinnen: wat er tot en met dit hoofdstuk gebeurd is", "laatste": false, "keuze": {"van": "wie de mail stuurt", "titel": "...", "tekst": "3-5 zinnen", "opties": [{"label": "...", "uitleg": "wat het kost en doet", "kost": 0, "effect": {}}]}}`;
}
async function verhaalBeurt(s){
  if (!live() || !s || s.status !== "actief") return;
  const n = maandenGespeeld(s); if (n < (s.flags.volgende_verhaal ?? 3) || (s.keuzes || []).some(k => k.soort === "gmverhaal")) return;
  s.flags.volgende_verhaal = n + 2;
  try {
    const r = await G.sample.json(verhaalPrompt(s), {modelTier: "default"}); if (s !== G.game) return; const k = cleanKeuzeGM(r && r.keuze, s); if (!k.titel || k.opties.length < 2) return;
    const boog = cStr(r.boog, 80) || "Een verhaal", nieuw = !s.verhaal || s.verhaal.klaar || s.verhaal.boog !== boog;
    s.verhaal = {boog, samenvatting: cStr(r.samenvatting, 400), hoofdstuk: nieuw ? 1 : (s.verhaal.hoofdstuk || 1) + 1, klaar: !!r.laatste};
    s.flags.volgende_verhaal = n + (s.verhaal.klaar ? RI(4, 6) : RI(2, 3));
    const ctx = Ctx(); addKeuze(s, ctx, {...k, soort: "gmverhaal", gm: true, boog: `${boog} · hoofdstuk ${s.verhaal.hoofdstuk}`, standaard: k.opties.length - 1}); await persist(ctx);
    toast(`Verhaal: ${k.titel}`); render();
  } catch(e){ s.flags.volgende_verhaal = n + 2; }
}

function newGame(d){
  const zaad = zaadNorm(d.zaad) || nieuwZaad(); RNG = seeded("wereld:" + zaad);
  try { const r = newGame0(d); r.s.zaad = zaad; return r; } finally { RNG = Math.random; } }
function newGame0(d){
  const s = migrate(template()), p = s.player, ctx = Ctx();
  p.corp_name = String(d.corp_name || "Naamloos BV").trim().slice(0, 60);
  p.motto = String(d.motto || "").trim().slice(0, 120);
  p.background = String(d.background || "").trim().slice(0, 200);
  p.difficulty = DIFF[d.difficulty] ? d.difficulty : "Realistisch";
  let doctrine = (d.doctrine || []).filter(x => DT[x]);
  if (d.eigen && String(d.eigen.naam || "").trim()){
    const pr = PRESETS[d.eigen.profiel] || PRESETS.gebalanceerd, r = addCustomType(s, d.eigen.naam, pr, d.eigen.omschrijving);
    if (r.ok) doctrine = [r.naam];   /* 4.2.1: een eigen soort is je enige startdivisie */
  }
  doctrine = doctrine.slice(0, 2); if (!doctrine.length) doctrine.push("Logistiek");
  p.doctrine = doctrine.join(" + ");
  const world = genWorld();
  s.districts = clone(world.districts); s.map = clone(world.map); s.city = "Wereld";
  const home = s.districts.some(x => x.id === d.home) ? d.home : "BNL"; p.home_district = home;
  const homeCont = s.districts.find(x => x.id === home).continent;
  for (const r of [{name: "Tessera Holdings", ceo: "Helena Voss", cash: 320, aggression: 0.5, memory: [], sector: "Media & Data"}, {name: "Kovač-Ndiaye Group", ceo: "Idris Bello", cash: 380, aggression: 0.45, memory: [], sector: "Biotech"}]) if (!s.rivals.some(x => x.name === r.name)) s.rivals.push(r);
  { const bezet = new Set(); for (const r of s.rivals){ r.name = genRivaalNaam(r.sector, bezet); bezet.add(r.name); r.ceo = genCeoNaam(new Set(s.rivals.map(x => x.ceo))); r.aggression = r1(clamp(r.aggression + U(-0.12, 0.12), 0.1, 0.8) * 100) / 100; } } /* 5.7: elk spel nieuwe rivalen */
  const hoofd = doctrine.find(t => DT[t]); if (hoofd && !s.rivals.some(r => r.sector === hoofd)) s.rivals[3].sector = hoofd;
  const thuisR = s.rivals.find(r => r.sector === hoofd) || s.rivals[3];
  for (const r of s.rivals){ r.cash = RI(280, 480); r.divs = {[r.sector]: 3}; r.divs[CH(SECTORS.filter(x => x !== r.sector))] = 1; initRival(r); geefKarakter(r); if (!r.kleur) r.kleur = RIVAL_COLORS.find(c => !s.rivals.some(x => x.kleur === c)) || "#cccccc"; }
  for (const m of Object.values(s.market)) for (const r of s.rivals) m.rivals[r.name] ??= 0;
  const pref = {Financieel: "corporate", Logistiek: "haven", Cyberware: "campus", "Media & Data": "nacht", "Private Security": "industrie", "Weapon Manufacturing": "industrie", Biotech: "campus", Smokkel: "haven"};
  const taken = new Set([home, ...s.districts.filter(x => x.neighbors.includes(home)).map(x => x.id)]);
  const usedCont = new Set([homeCont]);
  for (const r of s.rivals){
    let c = r === thuisR ? s.districts.filter(x => !taken.has(x.id) && x.continent === homeCont) : [];
    if (!c.length) c = s.districts.filter(x => !taken.has(x.id) && !usedCont.has(x.continent));
    if (!c.length) c = s.districts.filter(x => !taken.has(x.id)); if (!c.length) c = s.districts.filter(x => x.id !== home);
    const pick = c.find(x => x.arch === pref[r.sector]) || c[Math.floor(R() * c.length)]; r.hq = pick.id; taken.add(pick.id); usedCont.add(pick.continent);
  }
  for (const x of s.districts) x.control = x.id === home ? "player" : ((s.rivals.find(r => r.hq === x.id) || {}).name || "neutral");
  for (const r of s.rivals){ const hq = s.districts.find(x => x.id === r.hq), nb = (hq.neighbors || []).map(id => s.districts.find(x => x.id === id)).filter(x => x && x.control === "neutral" && x.id !== home && !(x.neighbors || []).includes(home)); if (nb.length) CH(nb).control = r.name; }
  const yr = parseInt(d.year, 10); s.date = {year: clamp(isNaN(yr) ? 2004 : yr, 1980, 2100), month: 1};
  [s.cash, s.debt] = ({krap: [80, 0], normaal: [100, 0], ruim: [150, 60]})[d.kapitaal] || [100, 0];
  const lvl = doctrine.length === 1 ? 2 : 1;
  s.divisions = doctrine.map((t, i) => { const eigen = String((i === 0 ? d.divisie_naam : i === 1 ? d.divisie_naam2 : "") || "").trim().slice(0, 40); return {name: eigen || t, type: t, level: lvl}; }); /* 6.6: een naam per divisie */
  if (s.divisions.length === 2 && s.divisions[0].name === s.divisions[1].name) s.divisions[1].name += " 2";
  const c = s.culture;
  c.slogans = String(d.slogan || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 3);
  c.layoff_policy = d.ontslag === "hard" ? "hard" : "normal";
  [c.bonus_cost, c.morale_drift] = ({geen: [0, 0], redelijk: [2, 1], royaal: [5, 2]})[d.bonus] || [0, 0];
  c.heat_decay = ({streng: 3, normaal: 2, geen_vragen: 1})[d.ethiek] ?? 2;
  c.ethics_rules = ({streng: ["Geen illegale deals", "Klokkenluiders worden beschermd"], normaal: ["Niet betrapt worden"], geen_vragen: ["Resultaat telt"]})[d.ethiek] || [];
  if (d.ethiek === "streng") s.reputation += 5;
  if (d.ethiek === "geen_vragen") shiftFaction(s, "straat", 10);
  if (c.layoff_policy === "hard") shiftFaction(s, "vakbond", -15);
  const homeArch = s.districts.find(x => x.id === home).arch; p.startbonus = START_BONUS[homeArch] ? homeArch : null; p.hq_stad = String(d.hq_stad || "").trim().slice(0, 40);
  const sb = p.startbonus;
  if (sb === "haven"){ s.schepen = 1; s.inzet = {}; const z0 = s.districts.find(x => x.id === home).zee; if (z0 && z0.length) s.inzet[z0[0]] = 1; }
  if (sb === "industrie") s.staff.count += 8;
  if (sb === "corporate"){ s.cash += 30; s.reputation += 5; }
  if (sb === "data") s.invloed = 10;
  if (sb === "nacht"){ s.reputation += 8; shiftFaction(s, "straat", 15); }
  if (sb === "sloppen"){ shiftFaction(s, "straat", 25); s.heat += 5; }
  if (sb === "markt"){ s.accounts.zwart += 10; c.heat_decay += 1; }
  if (sb === "villa"){ s.accounts.offshore += 25; s.interest_rate = 0.06; }
  s.bedrijven = genBedrijven(s); s.gangs = genGangs(s); s.nieuws = []; s.relaties = {}; s.keuzes = []; s.keuzes_klaar = [];
  s.sectoren = null; migrate13(s);
  s.crew = []; s.huurmarkt = []; s.klussen = []; s.tijdperk = 0; s.statusNiveau = statusVan(s);
  p.lengte = SPEL_LENGTE[d.lengte] ? d.lengte : "normaal"; s.flags.start_rivalen = s.rivals.map(r => r.name);
  const agr = {Casual: -0.1, Realistisch: 0, Genadeloos: 0.12}[p.difficulty] || 0; for (const r of s.rivals) r.aggression = r1(clamp(r.aggression + agr, 0.05, 0.95) * 100) / 100;
  s.stats = {piekWaarde: 0, bestePlek: 99, hits: 0, flops: 0, aanslagenAf: 0, aanslagenRaak: 0, klussen: 0, oorlogen: 0};
  { const c0 = genKandidaat(s); c0.rol = "fixer"; c0.niveau = 1; c0.trait = "trouw"; c0.loon = crewLoon(s, c0); c0.sinds = ym(s); s.crew.push(c0); }
  marktTick(s); klusTick(s); s.dreigingen = []; regioTick(s, true); startProducten(s); vraagInit(s); rivalProductInit(s);
  news(s, `Nieuwe corporatie: ${p.corp_name}`, `${p.corp_name} vestigt zich in ${s.districts.find(x => x.id === home).name}${p.hq_stad ? " (" + p.hq_stad + ")" : ""}. Doctrine: ${p.doctrine}. De concurrentie kijkt mee.`, homeCont, "markt", true);
  if (d.huisstijl && typeof d.huisstijl === "object") actHuisstijl(s, d.huisstijl); /* 5.17.1: huisstijl uit de setup */
  ceoInit(s, d); for (const r of s.rivals) r.ceoLeeftijd ??= RI(40, 66); /* 5.19 */
  { const I = {}; for (const k of Object.keys(INSTEL)) I[k] = instelNiv(k, d["inst_" + k] || "normaal"); p.instel = I; p.instelScore = instelScore(I); } /* 5.20 */
  s.setup_done = true; s.accounts.operationeel = s.cash;
  const hn = s.districts.find(x => x.id === home).name;
  mail(ctx, s, "Marta Delcourt (CFO)", "Welkom, CEO",
    `Welkom bij ${p.corp_name}.${p.motto ? " " + p.motto : ""}\n\nWe zitten in ${hn}${p.hq_stad ? ", met het hoofdkantoor in " + p.hq_stad : ""}.${p.startbonus ? ` Ons startvoordeel: ${START_BONUS[p.startbonus].naam}. ${START_BONUS[p.startbonus].uitleg}` : ""} ${s.crew[0].naam}, een fixer, staat al op de loonlijst: kijk bij Crew wat die voor ons kan doen. We verkopen nog niets: start onze eerste productlijn bij Bedrijf, of vraag de Assistent. We hebben €${s.cash}M in kas${s.debt ? ` en €${s.debt}M schuld bij de bank` : ""}, ${s.staff.count} mensen op de loonlijst en ${s.divisions.length} divisie(s): ${s.divisions.map(x => x.name).join(", ")}.\n\nElke maand stuur ik u een rapport. Lees het. De rest van uw mail is minder betrouwbaar dan ik.\n\nWat de knoppen niet kunnen, zegt u tegen de Assistent in Comms. U krijgt een voorstel met prijs en kans; u zegt ja of nee, en de dobbelsteen beslist. U kunt ook iedereen in de stad mailen of uw eigen mensen spreken.\n\n— M. Delcourt`, "HOOG");
  addLog(s, `${p.corp_name} opgericht in ${hn}. Doctrine: ${p.doctrine}. Moeilijkheid: ${p.difficulty}.`);
  return {s, ctx};
}

/* ---------- GM: effecten van een goedgekeurde opdracht, binnen grenzen ---------- */
const GM_FLAGS_REMOVABLE = ["cfo_manipuleert", "pr_lekt", "security_verkocht", "lek_intern", "transfer_onderzoek", "white_knight_schuld", "nomad_contract_gebroken"];
function applyGmEffect(s, e){
  if (!e || typeof e !== "object") return [];
  const out = [], num = (v, lo, hi) => clamp(+v || 0, lo, hi);
  if (e.cash){ const v = num(e.cash, -300, 150); s.cash = r1(s.cash + v); out.push(`cash ${v >= 0 ? "+" : ""}${v}`); }
  if (e.zwart){ const v = num(e.zwart, -150, 100); s.accounts.zwart = r1(Math.max(0, s.accounts.zwart + v)); out.push(`zwart ${v >= 0 ? "+" : ""}${v}`); }
  for (const k of ["heat", "reputation", "morale"]) if (e[k]){ const v = num(e[k], -25, 25); s[k] = clamp(s[k] + v); }
  for (const [n, v] of Object.entries(e.factions || {})) if (s.factions[n]) shiftFaction(s, n, num(v, -30, 30));
  for (const [n, v] of Object.entries(e.loyaliteit || {})){ const p = s.npcs.find(x => x.name === n); if (p) p.loyalty = clamp(p.loyalty + num(v, -40, 40)); }
  for (const [n, v] of Object.entries(e.rivaal_agressie || {})){ const r = s.rivals.find(x => x.name === n); if (r) r.aggression = r1(clamp(r.aggression + num(v, -0.3, 0.3), 0, 1) * 100) / 100; }
  for (const [n, v] of Object.entries(e.rivaal_cash || {})){ const r = s.rivals.find(x => x.name === n); if (r) r.cash = r1(Math.max(0, r.cash + num(v, -200, 100))); }
  for (const [n, t] of Object.entries(e.rivaal_geheugen || {})){ const r = s.rivals.find(x => x.name === n); if (r) remember(r, s, String(t).slice(0, 120)); }
  if (e.district && s.districts.some(d => d.id === e.district)) for (const d of s.districts) if (d.id === e.district) d.control = "player";
  for (const f of e.verwijder_flags || []) if (GM_FLAGS_REMOVABLE.includes(f)){
    delete s.flags[f];
    const ht = {cfo_manipuleert: "cfo_boeken", pr_lekt: "pr_lek", security_verkocht: "security_lek"}[f];
    if (ht) s.hidden_truth = s.hidden_truth.filter(h => h.id !== ht);
  }
  for (const n of e.ontslag || []){ const before = s.npcs.length; s.npcs = s.npcs.filter(x => x.name !== n); if (s.npcs.length < before){ s.morale = clamp(s.morale - 2); out.push(`${n} vertrokken`); } }
  if (e.nieuwe_npc && e.nieuwe_npc.name && s.npcs.length < 8){
    const q = e.nieuwe_npc; s.npcs.push({name: String(q.name).slice(0, 40), role: String(q.role || "Adviseur").slice(0, 40), loyalty: num(q.loyalty ?? 55, 0, 100), ambition: num(q.ambition ?? 50, 0, 100), secret: String(q.secret || "Onbekend.").slice(0, 160)});
  }
  if (e.lopend && e.lopend.naam){ const L = e.lopend; s.lopende_effecten.push({naam: String(L.naam).slice(0, 60), maanden: clamp(+L.maanden || 1, 1, 6), effect: {cash: num(L.cash, -20, 20), reputation: num(L.reputation, -3, 3), heat: num(L.heat, -3, 3), morale: num(L.morale, -3, 3)}}); }
  if (e.flag && /^gm_[a-z0-9_]{1,40}$/.test(e.flag)) s.flags[e.flag] = ym(s);
  if (e.divisie_upgrade){ const d = s.divisions.find(x => (x.name || x.type) === e.divisie_upgrade) || null; if (d && d.level < 12){ d.level += 1; out.push(`${d.name || d.type} naar L${d.level}`); } }
  if (e.nieuwe_divisie && e.nieuwe_divisie.name){ const nm = String(e.nieuwe_divisie.name).trim().slice(0, 40), ty = typeOf(s, e.nieuwe_divisie.type) ? e.nieuwe_divisie.type : null;
    if (ty && s.divisions.length < 8 && !s.divisions.some(x => x.name === nm)){ s.divisions.push({name: nm, type: ty, level: 1}); out.push(`nieuwe divisie ${nm}`); } }
  if (e.omzet_bonus && e.omzet_bonus.naam){ s.streams ??= []; const b = r1(clamp(+e.omzet_bonus.bedrag || 0, 0.5, 6));
    const same = s.streams.find(x => x.naam === String(e.omzet_bonus.naam).slice(0, 60));
    if (same) same.bedrag = r1(Math.min(9, same.bedrag + b * 0.6)); else if (s.streams.length < 12) s.streams.push({naam: String(e.omzet_bonus.naam).slice(0, 60), bedrag: b, sinds: ym(s)});
    out.push(`inkomstenbron +€${b}M/mnd`); }
  if (e.omzet_verlies && e.omzet_verlies.naam){ s.streams ??= []; const st0 = s.streams.find(x => x.naam === e.omzet_verlies.naam); if (st0){ st0.bedrag = r1(Math.max(0, st0.bedrag - clamp(+e.omzet_verlies.bedrag || 1, 0.5, 6))); s.streams = s.streams.filter(x => x.bedrag > 0); } }
  if (e.nieuw_product && typeof e.nieuw_product === "object"){ const np = e.nieuw_product; np.focus = DEV_FOCUS[np.focus] ? np.focus : "standaard"; const _np = np, d = s.divisions.find(x => divNaam(x) === np.divisie) || s.divisions.find(x => x.type === np.divisie) || s.divisions[0];
    if (d){ const sc = PRODUCT_SCHAAL[np.schaal] ? np.schaal : "klein", naam = String(np.naam || "").trim().slice(0, 40) || nieuwProductNaam(s, d.type);
      if (!(s.producten || []).some(p => p.naam === naam)){ const p = mkProduct(s, d, naam, 1 + Math.floor(d.level / 2) + PRODUCT_SCHAAL[sc].kw, 0); p.schaal = sc; p.focus = np.focus; p.aard = PRODUCT_AARD[np.aard] ? np.aard : aardVan(d.type, naam);
        if ((s.producten || []).some(x => x.divisie === divNaam(d) && x.status === "ontwikkeling")){ p.status = "wachtrij"; p.betaald = true; } else { p.status = "ontwikkeling"; p.eta = PRODUCT_SCHAAL[sc].maanden; }
        (s.producten ??= []).push(p); out.push(`productlijn ${naam} (${p.status === "wachtrij" ? "in de wachtrij" : "in ontwikkeling"})`); } } }
  if (e.personeel){ const v = Math.round(num(e.personeel, -50, 50)); s.staff.count = Math.max(5, s.staff.count + v); out.push(`personeel ${v >= 0 ? "+" : ""}${v}`); }
  s.accounts.operationeel = s.cash;
  return out;
}

/* =====================================================================
   Opslag: de database van het artifact (alleen de eigenaar leest en
   schrijft), met browseropslag als terugval. Claude kan via dezelfde
   database meelezen en antwoorden als de live verbinding ontbreekt.
   ===================================================================== */
const G = {game: null, mails: [], chats: {}, mode: "laden", gid: null, db: null, sample: null, sampleOff: false, unsub: []};
G.fouten = (() => { try { return JSON.parse(localStorage.getItem("cl_fouten") || "[]"); } catch(_){ return []; } })();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let mailSeq = 0;
const LKEY = "cl_spel_v2", MAX_SLOTS_LOKAAL = 6;
G.tab = Math.random().toString(36).slice(2, 10);

function localLoad(){ try { return JSON.parse(localStorage.getItem(LKEY) || "null"); } catch(e){ return null; } }
function localSave(){ try { localStorage.setItem(LKEY, JSON.stringify({game: pak(G.game), mails: G.mails.slice(0, 300), chats: G.chats})); G.saveFout = false; return true; }
  catch(e){ foutLog("opslaan in de browser", e); if (!G.saveFout) toast("Opslaan in de browser is mislukt (opslag vol?). Exporteer je spel via Logboek, anders ben je je voortgang kwijt bij het sluiten.", true); G.saveFout = true; return false; } }

const Store = {
  async init(){
    setTimeout(() => Store.eregalerij().catch(() => {}), 1500);
    let db = null;
    try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch(e){ db = null; }
    if (!db){ this.useLocal(); return; }
    G.db = db;
    try {
      const ptr = await withTimeout(db.doc("meta/huidig").get(), 10000);
      G.gid = ptr.exists ? ptr.data().gid : null;
      if (!G.gid){ G.gid = "g" + uid(); await db.doc("meta/huidig").set({gid: G.gid}); }
      G.mode = "db"; this.subscribe();
    } catch(e){ G.db = null; this.useLocal(); toast("De online opslag reageert niet. Je spel wordt nu alleen in deze browser bewaard.", true); }
  },
  useLocal(){
    const d = localLoad(); G.mode = "lokaal"; try { G.gid = localStorage.getItem("cl_huidig") || "lokaal"; } catch(e){ G.gid = "lokaal"; }
    if (d){ G.game = d.game; G.mails = d.mails || []; G.chats = d.chats || {}; }
    S.loaded = true; render();
  },
  subscribe(){
    for (const u of G.unsub) u(); G.unsub = [];
    const base = "games/" + G.gid, db = G.db;
    let first = false;
    const timer = setTimeout(() => { if (!first){ S.loadNote = "De opslag reageert traag. Wat je ziet kan verouderd zijn."; render(); } }, 10000);
    G.unsub.push(db.doc(base).onSnapshot(snap => {
      const later = first; first = true; clearTimeout(timer); S.loadNote = "";
      const dt = snap.exists ? snap.data() : null;
      if (later && dt && dt.tab && dt.tab !== G.tab && Date.now() - (G.tabWarn || 0) > 60000){ G.tabWarn = Date.now(); toast("Dit spel is net in een ander tabblad of op een ander apparaat bijgewerkt. Je ziet nu die versie: speel in één venster tegelijk.", true); }
      if (!S.busy) G.game = snap.exists ? clone(snap.data().s) : null;
      if (G.game && G.game.map && G.game.map.kind === "wereld" && !G.game.map.frame && !G.game.map.gedeeld){ migrate(G.game); Store.saveGame().catch(() => {}); }
      S.loaded = true; render();
    }, e => { clearTimeout(timer); S.loaded = true; toast("Opslag niet bereikbaar (" + e.code + ").", true); render(); }));
    G.unsub.push(db.collection(base + "/mails").orderBy("t", "desc").limit(400).onSnapshot(q => {
      const before = G.mails.length;
      G.mails = q.docs.map(d => ({id: d.id, ...d.data()}));
      if (S.loaded && before && G.mails.length > before && !S.busy && !S.expect) toast(`${G.mails.length - before} nieuwe mail(s).`);
      if (!S.busy) render();
    }, () => {}));
    G.unsub.push(db.collection(base + "/chats").onSnapshot(q => {
      const next = {}; for (const d of q.docs) next[d.id] = clone(d.data());
      for (const [k, c] of Object.entries(G.chats)) if (c._pending) next[k] = c;   // eigen schrijfactie nog onderweg
      G.chats = next;
      if (!S.busy) render();
    }, () => {}));
  },
  async saveGame(){
    if (G.mode !== "db") return localSave();
    const body = {s: pak(G.game), bijgewerkt: Date.now(), tab: G.tab}, n = JSON.stringify(body).length;
    if (n > 700000 && G.game){ G.game.log = G.game.log.slice(-100); G.game.nieuws = (G.game.nieuws || []).slice(0, 30); G.game.worpen = G.game.worpen.slice(-40); G.game.keuzes_klaar = (G.game.keuzes_klaar || []).slice(0, 15); }
    await G.db.doc("games/" + G.gid).set(body);
  },
  async backup(){
    const s = G.game; if (!s || !s.setup_done) return; const slot = maandenGespeeld(s) % 3, body = {s: clone(pak(s)), maand: ym(s), t: Date.now()};
    try { if (G.mode === "db") await G.db.doc(`games/${G.gid}/backups/b${slot}`).set(body); else localStorage.setItem("cl_backup_" + slot, JSON.stringify(body)); G.backupFout = null; }
    catch(e){ G.backupFout = ym(s); foutLog("back-up " + ym(s), e); toast("De back-up van deze maand is mislukt" + (G.mode === "db" ? "." : " (browseropslag vol?).") + " Je spel zelf is wel bewaard. Exporteer het voor de zekerheid via Logboek.", true); }
  },
  /* 4.7.8: een divisie die bij een (geschrapte) overname verloren ging, terugzetten uit de back-ups */
  async herstelOvername(){ const s = G.game; if (!s || !s.flags || s.flags.overname_herstel_478) return null;
    if ((s.hostile_bid || {}).uitslag !== "verloren"){ s.flags.overname_herstel_478 = true; return null; }
    let B = []; try { B = await this.backups(); } catch(e){ foutLog("herstel overname", e); }
    const namen = new Set(s.divisions.map(divNaam)), gezet = [];
    for (const b of B.slice().sort((x, y) => x.t - y.t)) for (const d of (b.s.divisions || [])){ const nm = divNaam(d); if (namen.has(nm)) continue;
      s.divisions.push(clone(d)); namen.add(nm); const ps = (b.s.producten || []).filter(p => p.divisie === nm && !(s.producten || []).some(q => q.id === p.id)); (s.producten ??= []).push(...clone(ps));
      gezet.push(`${nm} met ${ps.length} product${ps.length === 1 ? "" : "en"} (back-up van ${b.maand})`); }
    s.flags.overname_herstel_478 = true; if (gezet.length){ addLog(s, "Teruggezet na de geschrapte overname: " + gezet.join(", ")); try { await this.saveGame(); } catch(e){ foutLog("herstel opslaan", e); } }
    return gezet; },
  async backups(){
    const out = [];
    for (const slot of [0, 1, 2]){ let b = null;
      try { if (G.mode === "db"){ const d = await withTimeout(G.db.doc(`games/${G.gid}/backups/b${slot}`).get(), 8000); b = d.exists ? d.data() : null; } else b = JSON.parse(localStorage.getItem("cl_backup_" + slot) || "null"); } catch(e){ foutLog("back-up " + slot + " lezen", e); }
      if (b && b.s) migrate(b.s);
      if (b && b.s) out.push({slot, maand: b.maand, t: b.t, cash: r1(b.s.cash), status: b.s.status, s: b.s}); }
    return out.sort((a, b) => b.t - a.t);
  },
  async eregalerij(){ try { if (G.mode === "db"){ const d = await withTimeout(G.db.doc("meta/eregalerij").get(), 8000); G.eregalerij = d.exists ? (d.data().lijst || []) : []; } else G.eregalerij = JSON.parse(localStorage.getItem("cl_eregalerij") || "[]"); } catch(e){ G.eregalerij = G.eregalerij || []; } },
  async addScore(x){ await this.eregalerij(); G.eregalerij = [...(G.eregalerij || []).filter(y => y.id !== x.id), x].sort((a, b) => b.score - a.score).slice(0, 20);
    try { if (G.mode === "db") await G.db.doc("meta/eregalerij").set({lijst: G.eregalerij}); else localStorage.setItem("cl_eregalerij", JSON.stringify(G.eregalerij)); } catch(e){ foutLog("eregalerij opslaan", e); } },
  async addMails(list){
    const now = Date.now();
    const docs = list.map(m => ({id: "m" + uid() + (mailSeq++), t: now * 100 + (mailSeq % 100), gelezen: false, archief: false, ...m}));
    G.mails = [...docs.slice().reverse(), ...G.mails];
    if (G.mode !== "db"){ localSave(); return docs; }
    const col = G.db.collection("games/" + G.gid + "/mails");
    await Promise.all(docs.map(({id, ...body}) => col.doc(id).set(body)));
    return docs;
  },
  async patchMail(id, patch){
    const m = G.mails.find(x => x.id === id); if (!m) return; Object.assign(m, patch);
    if (G.mode !== "db") return localSave();
    await G.db.doc(`games/${G.gid}/mails/${id}`).update(patch);
  },
  async putChat(c){
    c.berichten = c.berichten.slice(-80); G.chats[c.key] = c;
    if (G.mode !== "db") return localSave();
    c._pending = true;
    try { const {_pending, ...body} = c; await G.db.doc(`games/${G.gid}/chats/${c.key}`).set(clone(body)); }
    finally { delete c._pending; }
  },
  async newGame(){
    const L = await this.slots().catch(() => G.slots || []), nieuw = "g" + uid();
    if (G.mode !== "db" && L.length >= MAX_SLOTS_LOKAAL) return {ok: false, msg: `Je hebt al ${L.length} spellen in deze browser; meer past er niet veilig in. Verwijder er een bij Logboek → Spellen (exporteer het eerst als je het wilt bewaren).`};
    if (G.mode !== "db"){ try { localStorage.setItem("cl_slot_" + G.gid, JSON.stringify({game: pak(G.game), mails: G.mails.slice(0, 300), chats: G.chats})); localStorage.setItem("cl_huidig", nieuw); }
      catch(e){ foutLog("spel bewaren voor een nieuw spel", e); return {ok: false, msg: "Je huidige spel kon niet apart bewaard worden (browseropslag vol?). Er is geen nieuw spel gestart, zodat je niets kwijtraakt. Exporteer of verwijder eerst een spel bij Logboek."}; } }
    G.game = null; G.mails = []; G.chats = {}; G.gid = nieuw;
    L.unshift({gid: nieuw, naam: "", datum: "oprichting", status: "", t: Date.now()}); await this.saveSlots(L).catch(() => {});
    if (G.mode === "db"){ await G.db.doc("meta/huidig").set({gid: G.gid}); this.subscribe(); }
    else localSave();
    return {ok: true};
  },
  /* saveslots: meerdere spellen naast elkaar */
  slotInfo(gid, s){ return {naam: s && s.player ? s.player.corp_name || "" : "", datum: s ? (s.setup_done ? ym(s) : "oprichting") : "", status: s ? s.status || "" : ""}; },
  async slots(){
    let L = [];
    if (G.mode === "db"){
      try { const d = await withTimeout(G.db.doc("meta/slots").get(), 8000); L = d.exists ? (d.data().lijst || []) : []; } catch(e){ return G.slots || []; }
      if (!L.length){ let vorige = null; try { const p = await withTimeout(G.db.doc("meta/huidig").get(), 8000); vorige = p.exists ? p.data().vorige : null; } catch(e){}
        for (const id of [G.gid, vorige].filter(Boolean)){ let info = {naam: "", datum: "", status: ""}; try { const g = await withTimeout(G.db.doc("games/" + id).get(), 8000); if (g.exists) info = this.slotInfo(id, g.data().s); } catch(e){} L.push({gid: id, ...info, t: Date.now()}); }
        await G.db.doc("meta/slots").set({lijst: L}).catch(() => {}); }
    } else { try { L = JSON.parse(localStorage.getItem("cl_slots") || "[]"); } catch(e){} }
    if (!L.some(x => x.gid === G.gid)) L.unshift({gid: G.gid, naam: "", datum: "", status: "", t: Date.now()});
    const cur = L.find(x => x.gid === G.gid); if (cur && G.game) Object.assign(cur, this.slotInfo(G.gid, G.game), {t: Date.now()});
    G.slots = L; return L;
  },
  async saveSlots(L){ G.slots = L; if (G.mode === "db") await G.db.doc("meta/slots").set({lijst: L}); else { try { localStorage.setItem("cl_slots", JSON.stringify(L)); } catch(e){} } },
  async switchSlot(gid){
    if (!gid || gid === G.gid) return false;
    const L = await this.slots(); await this.saveSlots(L).catch(() => {});
    if (G.mode === "db"){ G.gid = gid; G.game = null; G.mails = []; G.chats = {}; await G.db.doc("meta/huidig").set({gid}); this.subscribe(); return true; }
    try { localStorage.setItem("cl_slot_" + G.gid, JSON.stringify({game: pak(G.game), mails: G.mails.slice(0, 300), chats: G.chats}));
      const d = JSON.parse(localStorage.getItem("cl_slot_" + gid) || "null"); G.gid = gid; G.game = d ? d.game : null; G.mails = d ? d.mails || [] : []; G.chats = d ? d.chats || {} : {};
      localStorage.setItem("cl_huidig", gid); localSave(); return true; } catch(e){ toast("Wisselen lukte niet: de browseropslag weigert.", true); return false; }
  },
  /* 6.9: opslagpunt = een vaste kopie van het huidige spel als apart spel in de lijst; laden = wisselen naar die kopie */
  async saveAs(label){ const s = G.game; if (!s || !s.setup_done) return {ok: false, msg: "Er is nog geen spel om op te slaan."};
    const L = await this.slots().catch(() => G.slots || []), nieuw = "g" + uid(), info = this.slotInfo(nieuw, s);
    if (G.mode !== "db"){ if (L.length >= MAX_SLOTS_LOKAAL) return {ok: false, msg: `Er passen ${MAX_SLOTS_LOKAAL} spellen en opslagpunten in deze browser. Verwijder er een via Menu → Laden (of exporteer het eerst bij Logboek).`};
      try { localSave(); localStorage.setItem("cl_slot_" + nieuw, JSON.stringify({game: pak(s), mails: G.mails.slice(0, 120), chats: G.chats})); } catch(e){ foutLog("opslagpunt", e); return {ok: false, msg: "De browseropslag is vol. Verwijder een ouder spel via Menu → Laden of exporteer het bij Logboek."}; } }
    else { await this.saveGame(); await G.db.doc("games/" + nieuw).set({s: pak(s), bijgewerkt: Date.now(), tab: G.tab});
      const col = G.db.collection("games/" + nieuw + "/mails"); await Promise.all(G.mails.slice(0, 80).map(({id, ...body}) => col.doc(id).set(clone(body))));
      await Promise.all(Object.values(G.chats).map(c => { const {_pending, ...body} = c; return G.db.doc(`games/${nieuw}/chats/${c.key}`).set(clone(body)); })); }
    const naam = String(label || "Opslagpunt").slice(0, 40), i = Math.max(0, L.findIndex(x => x.gid === G.gid));
    L.splice(i + 1, 0, {gid: nieuw, ...info, label: naam, opslag: true, t: Date.now()}); await this.saveSlots(L).catch(() => {});
    addLog(s, `Opslagpunt gemaakt: ${naam}`); return {ok: true, label: naam, gid: nieuw}; },
  async renameSlot(gid, label){ const L = await this.slots(), x = L.find(y => y.gid === gid); if (!x) return; x.label = String(label || "").trim().slice(0, 40); await this.saveSlots(L); },
  async deleteSlot(gid){
    if (!gid || gid === G.gid) return false;
    const L = (await this.slots()).filter(x => x.gid !== gid);
    if (G.mode === "db"){ const base = "games/" + gid;
      for (const sub of ["mails", "chats", "backups"]){ try { const q = await withTimeout(G.db.collection(base + "/" + sub).get(), 10000); for (const d of q.docs) await G.db.doc(base + "/" + sub + "/" + d.id).delete(); } catch(e){} }
      try { await G.db.doc(base).delete(); } catch(e){} }
    else { try { localStorage.removeItem("cl_slot_" + gid); } catch(e){} }
    await this.saveSlots(L); return true;
  },
};
function withTimeout(p, ms){ return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({code: "timeout"}), ms))]); }
async function persist(ctx){
  const out = [];
  try {
    await Store.saveGame();
    if (ctx && ctx.mails.length) out.push(...await Store.addMails(ctx.mails));
  } catch(e){
    toast(e && e.code === "quota_exceeded" ? "De opslag is vol. Begin een nieuw spel." : "Opslaan mislukt (" + (e && e.code || "onbekend") + "). Probeer het zo nog eens.", true);
  }
  return out;
}

/* ---------- wat het scherm toont (zoals de CFO het rapporteert) ---------- */
function seeded(str){ let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const labelFaction = v => v <= -50 ? "vijandig" : v <= -15 ? "koel" : v < 15 ? "neutraal" : v < 50 ? "warm" : "bondgenoot";
const impression = n => n.verraad ? "lijkt tevreden" : n.loyalty >= 65 ? "loyaal" : n.loyalty >= 45 ? "tevreden" : n.loyalty >= 30 ? "twijfelt" : "ontevreden";
function pendingDecisions(s){
  const f = s.flags, out = [], zw = s.accounts.zwart || 0;
  if (f.wacht_op_speler_vonk) out.push({arc: "vonk", titel: "Mara Vonk wil een antwoord", tekst: "Financier haar tour, negeer haar, of laat het 'oplossen'. De straat kijkt mee.", opties: [
    {keuze: "sponsor", label: "Tour financieren", kost: 15, uitleg: "€15M. Straat warmer, politie koeler, wat heat."},
    {keuze: "negeren", label: "Negeren", kost: 0, uitleg: "Gratis. 1 tot 3 maanden reputatieschade."},
    {keuze: "uitgeschakeld", label: "Laten oplossen", kost: 10, uitleg: `€10M${zw >= 10 ? " uit zwart geld" : ""}. Veel heat, straat woedend, 35% kans dat het uitlekt.`}]});
  if (f.wacht_op_speler_nomaden_pact) out.push({arc: "nomaden_pact", titel: "Isra biedt een pact aan", tekst: "Toegang tot uw netwerk in ruil voor bescherming op de snelweg.", opties: [
    {keuze: "ja", label: "Pact sluiten", kost: 0, uitleg: "Logistiek en smokkel 20% goedkoper, konvooien helpen. Af en toe een eis. Breken is gevaarlijk."},
    {keuze: "nee", label: "Weigeren", kost: 0, uitleg: "Nomaden koeler. Meer kans op gedoe op de snelweg."}]});
  if (f.wacht_op_speler_hostile_bid) out.push({arc: "hostile_bid", titel: "Vijandig overnamebod", tekst: "U heeft 30 dagen. Kies een verdediging. Een gevecht kost geld; niets doen kost meestal het bedrijf.", opties: [
    {keuze: "niets", label: "Niets doen", kost: 0, uitleg: "Ongeveer 15% kans dat het bod mislukt."},
    {keuze: "investeren", label: "Aandelen terugkopen", kost: "budget", uitleg: "35% + 0,5% per €1M budget."},
    {keuze: "juridisch", label: "Juridische strijd", kost: "budget", uitleg: "35% + 0,67% per €1M budget, +3 heat."},
    {keuze: "white_knight", label: "White knight zoeken", kost: 0, uitleg: "60%, maar daarna sta je bij iemand in het krijt."},
    {keuze: "poison_pill", label: "Poison pill", kost: 0, uitleg: "75%, maar morale -10, reputatie -5 en €50M extra schuld."}]});
  if (f.nomaden_eis && typeof f.nomaden_eis === "object") out.push({arc: "nomaden_eis", titel: "Isra vraagt een gunst", tekst: `€${f.nomaden_eis.bedrag}M, of het pact wordt kouder.`, opties: [
    {keuze: "betalen", label: `Betalen (€${f.nomaden_eis.bedrag}M)`, kost: f.nomaden_eis.bedrag, uitleg: "Houdt de snelweg vriendelijk."},
    {keuze: "weigeren", label: "Laten liggen", kost: 0, uitleg: "Kost nomaden-standing."}]});
  return out;
}

/* ---------- contacten: met wie je kunt chatten en mailen ---------- */
const slug = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
const EXTRA = NETWERK;
function contacts(s){
  const out = [{key: "gm", naam: "Assistent", rol: "Uitvoering · zegt wat het kost en regelt het", soort: "gm", groep: "Uitvoering"}];
  for (const n of s.npcs) out.push({key: "npc-" + slug(n.name), naam: n.name, rol: n.role, soort: "npc", groep: "Directie"});
  for (const r of s.rivals) out.push({key: "riv-" + slug(r.name), naam: r.ceo, rol: "CEO " + r.name, soort: "rivaal", ref: r.name, groep: "Rivalen"});
  for (const [key, naam0, rol, bio, fac] of EXTRA){ const naam = netwerkNaam(s, key, naam0); out.push({key, naam, rol: key === "stad" ? rol + ", " + homeLandNaam(s) : rol, soort: "extra", bio, fac, groep: "Netwerk"}); }
  for (const g of s.gangs || []) out.push({key: "gang-" + g.id, naam: g.leider, rol: g.naam + " · " + g.soort, soort: "gang", ref: g.id, groep: "Onderwereld"});
  return out;
}
function findContact(s, name){
  const n = String(name || "").toLowerCase().trim(); if (!n) return null;
  const list = contacts(s).filter(c => c.soort !== "gm");
  return list.find(c => c.naam.toLowerCase() === n)
    || list.find(c => c.soort === "npc" && (c.rol.toLowerCase() === n || n.includes(c.naam.toLowerCase()) || n.includes("(" + c.rol.toLowerCase() + ")")))
    || list.find(c => n.includes(c.naam.toLowerCase()))
    || null;
}
function chatOf(c){ return G.chats[c.key] ??= {key: c.key, naam: c.naam, berichten: []}; }

/* ---------- wat Claude ziet (de speler ziet dit niet) ---------- */
function worldFacts(s){
  return {
    datum: ym(s), bedrijf: s.player, cash: s.cash, zwart: s.accounts.zwart, offshore: s.accounts.offshore, schuld: s.debt,
    heat: r1(s.heat), reputatie: r1(s.reputation), morale: r1(s.morale),
    personeel: {aantal: s.staff.count, nodig: staffNeed(s), salaris_k_per_jaar: s.staff.avg_salary}, cultuur: s.culture,
    divisies: s.divisions, eigen_soorten: s.custom_types, inkomstenbronnen: s.streams || [], projecten: s.projects.map(p => p.name),
    stad: s.city, districten: s.districts.map(d => ({id: d.id, naam: d.name, continent: d.continent, soort: d.arch, controle: d.control, buren: d.neighbors, kust: d.zee})), zee: seaControl(s), jouw_eskaders: {totaal: s.schepen || 0, inzet: s.inzet || {}},
    rivalen: s.rivals.map(r => ({naam: r.name, ceo: r.ceo, sector: r.sector, hq: r.hq, kas: r.cash, agressie: r.aggression, status: r.status, relatie: r.relatie, macht: rivalPower(s, r), divisies: r.divs, districten: rivalDistricts(s, r).map(d => d.id), verdragen: r.verdragen, geheugen: r.memory.slice(-4)})),
    jouw_macht: playerPower(s), aanbiedingen: s.aanbiedingen,
    directie: s.npcs, facties: Object.fromEntries(Object.entries(s.factions).map(([k, v]) => [k, Math.round(v.standing)])),
    vlaggen: s.flags, verborgen_waarheid: s.hidden_truth.slice(-15),
    startvoordeel: startBonus(s), relaties_netwerk: Object.fromEntries(Object.entries(s.relaties || {}).map(([k2, v]) => [k2, v.v])),
    bedrijven_in_de_wereld: (s.bedrijven || []).map(b => ({naam: b.naam, sector: b.sector, land: b.land, waarde: Math.round(b.waarde), eigenaar: b.eigenaar, jouw_aandeel: b.aandeel, contract: b.contract})),
    onderwereld: (s.gangs || []).map(g => ({naam: g.naam, leider: g.leider, relatie: g.relatie, afspraak: g.deal, gebied: g.gebied})),
    rivaal_producten: s.rivals.map(r => `${r.name}: ${(r.producten || []).map(p => `${p.naam} (${p.aard}, k${p.kwaliteit}, pop ${p.pop})`).join(", ")}`),
    producten: (s.producten || []).map(p => ({naam: p.naam, divisie: p.divisie, soort: p.aard || aardVan(p.type, p.naam), vorm: p.soort || "product", pitch: p.pitch || "", eigenschap: p.trait || null, prijs: p.prijs || "standaard", vraagfactor: vraagFactor(s, p.aard || aardVan(p.type, p.naam)), kwaliteit: p.kwaliteit, populariteit: p.pop, abonnees: isAbo(p) ? Math.round((p.abo || 0) * 10000) : undefined, status: p.status, recensie: p.review ? p.review.sterren : null})), verwachte_aanslagen: (s.dreigingen || []).map(t => `${t.label} door ${t.van}`),
    crew: (s.crew || []).map(m => ({naam: m.naam, rol: m.rol, niveau: m.niveau, status: crewStatus(s, m), eigenschap: traitOf(m.trait).naam})), huurleger: s.huurleger, tijdperk: TIJDPERKEN[s.tijdperk || 0].naam, status: STATUS_LADDER[s.statusNiveau || 0][1],
    verhaallijn: s.verhaal || null,
    wereldnieuws: (s.nieuws || []).slice(0, 8).map(n => `${n.m} ${n.kop}`), open_keuzes: (s.keuzes || []).map(k => k.titel),
    recente_mails: G.mails.slice(0, 8).map(m => `${m.datum} ${m.van}: ${m.onderwerp}`), logboek: s.log.slice(-10),
  };
}
const PROPOSAL_SHAPE = `{"samenvatting": "wat er concreet gebeurt, 1 zin", "kost": 6, "bron": "operationeel", "kans": 60, "risico": "wat er mis kan gaan, 1 zin",
  "succes": {"effect": {"heat": 2}, "mail": {"van": "...", "onderwerp": "...", "tekst": "2-5 zinnen", "prio": "NORMAAL"}},
  "falen": {"effect": {"heat": 5}, "mail": {"van": "...", "onderwerp": "...", "tekst": "2-5 zinnen", "prio": "HOOG"}}}`;
const RULES = `Spelregels voor voorstellen:
- Bedragen in M€ (miljoen euro). Geld is krap. Richtprijzen in deze wereld: agent omkopen 1-5, privédetective 2-6, hacker 4-15, advocaat 3-10, mediacampagne 5-15, intimidatie 2-8, headhunter 1-4 per kandidaat. Niet alles kost geld: een gesprek, een telefoontje of een gunst is gratis. Zet de CEO iemand uit zijn crew in (zie "crew"), dan kost het hooguit 0-2M onkosten, want die mensen staan al op de loonlijst; hun niveau (1-6) maakt de kans groter.
- Noemt de CEO een budget, blijf daarbinnen of verlaag de kans. Kan het niet van de beschikbare cash (of zwart geld bij illegale zaken, "bron": "zwart"), zeg dat in je bericht en geef geen voorstel.
- "kans": geheel getal 5-95, of 100 als er niets mis kan gaan (een gewone aankoop, een loonsverhoging die je gewoon toekent). Grote stappen krijgen lage kansen. Geen gratis winst.
- Illegale acties geven heat, ook bij succes. Snelle winst kost morale, reputatie of geeft juridisch risico.
- Gebruik "verborgen_waarheid", vlaggen en geheimen om onderzoek eerlijk af te handelen: alleen als iets waar is kan een geslaagd onderzoek het vinden, en dat staat dan in de succes-mail. Een ontmaskerde verrader: zet de vlag in "verwijder_flags" (cfo_manipuleert, pr_lekt, security_verkocht).
- Mogelijke effectvelden (laat weg wat niet verandert): cash (-300..150), zwart, heat, reputation, morale (-25..25), factions {naam: -30..30}, loyaliteit {"NPC-naam": -40..40}, personeel (-50..50 gewone medewerkers), ontslag ["NPC-naam"], nieuwe_npc {"name","role","loyalty","ambition","secret"} (een sleutelpersoon aannemen), rivaal_agressie {naam: -0.3..0.3}, rivaal_cash {naam}, rivaal_geheugen {naam: "notitie"}, district "A".."H", verwijder_flags [...], lopend {"naam","maanden","cash","reputation","heat","morale"} (maandelijks terugkerend, bv. een loonsverhoging: cash -2 per maand).
- PRODUCTEN: de divisies verkopen producten (zie "producten"). Vraagt de CEO een nieuw product, een dienst, een abonnement of een productlijn, wijs dan eerst op Bedrijf → Productlijn → "De GM werkt het uit", waar jij het volledig ontwerpt. Wil hij het toch via jou, geef dan bij succes het effect "nieuw_product": {"divisie": "<naam van een bestaande divisie>", "naam": "productnaam", "schaal": "klein"|"groot"|"vlag", "aard": "wapen|medisch|implantaat|data|beveiliging|smokkel|logistiek|financieel|orbitaal|consument", "focus": "standaard|kwaliteit|snel|goedkoop|innovatief|veilig"}. De kost van je voorstel is dan de ontwikkelkost (klein 5, groot 14, vlaggenschip 30, maal de moeilijkheid). Is de divisie al iets aan het ontwikkelen, dan komt het in de wachtrij. De lancering (hit, flop) gooit de engine later zelf; beloof geen uitkomst.
- BLIJVENDE GROEI: bouwt de CEO iets op dat maand na maand geld oplevert (een product, dienst, abonnement, klantengroep, vestiging, contract, prijsmodel, marketing die klanten bindt), geef dan bij succes een blijvend effect, geen eenmalige cash: "omzet_bonus": {"naam": "korte naam van de inkomstenbron", "bedrag": M€ per maand}. Reken realistisch: ongeveer kost/10 per maand (terugverdientijd 8 tot 15 maanden), maximaal 6 per bron. Bouwt het verder op een bestaande bron, gebruik dezelfde naam. Groeit een divisie wezenlijk: "divisie_upgrade": "divisienaam". Een echt nieuwe bedrijfstak: "nieuwe_divisie": {"name", "type"} (type uit de bestaande of eigen soorten). Falen kan een bron kosten: "omzet_verlies": {"naam", "bedrag"}.
- Bestaande inkomstenbronnen van de CEO staan in "inkomstenbronnen"; houd daar rekening mee.
- De kost (vooraf betaald) staat los van de effecten; zet die niet nog eens in cash.`;
function personaFor(s, c){
  if (c.soort === "gm") return `Je bent "de Assistent": de rechterhand van de CEO, die alles regelt wat de knoppen niet doen (onderzoek, deals, omkoping, inkoop, aannemen van sleutelmensen, sabotage). Zakelijk, droog, eerlijk over prijs en risico. Bij elk concreet verzoek doe je een voorstel. Je kent de verborgen waarheid om kansen eerlijk te bepalen, maar je verklapt die NOOIT in je bericht. Bij een vraag beantwoord je alleen wat de CEO ook had kunnen weten.`;
  if (c.soort === "npc"){
    const n = s.npcs.find(x => x.name === c.naam) || {};
    return `Je bent ${n.name}, ${n.role} van ${s.player.corp_name}. Loyaliteit ${Math.round(n.loyalty)}/100, ambitie ${n.ambition}/100. Je geheim: ${n.secret}${n.verraad ? ` Je bent sinds ${n.verraad} heimelijk ontrouw aan het bedrijf; dat ontken je, tenzij je met bewijs wordt klemgezet.` : ""} Gedraag je naar je loyaliteit: laag = kortaf, eisend, zinspeelt op vertrek; hoog = meedenkend en eerlijk. Verklap je geheim niet zomaar. Je kunt zelf iets vragen (opslag, budget, een titel) en de CEO kan je dingen opdragen die binnen jouw rol vallen.`;
  }
  if (c.soort === "rivaal"){
    const r = s.rivals.find(x => x.name === c.ref) || {memory: []};
    return `Je bent ${r.ceo}, CEO van ${r.name} (sector ${r.sector}, kas ongeveer €${Math.round(r.cash)}M, agressie ${r.aggression}). Een concurrent: beleefd, berekenend, nooit gratis. Wat je over deze CEO onthoudt: ${r.memory.slice(-4).join("; ") || "weinig"}. Je kunt deals voorstellen (joint venture, overname van een divisie, een prijsafspraak, een wapenstilstand) met een echte prijs.`;
  }
  if (c.soort === "gang"){ const g = (s.gangs || []).find(x => x.id === c.ref) || {gebied: {}};
    return `Je bent ${g.leider}, leider van ${g.naam} (${g.soort}). ${g.stijl} Jullie relatie met dit bedrijf: ${g.relatie} (-100..100), afspraak: ${g.deal || "geen"}. Waar jullie zitten (aanwezigheid 0-100): ${JSON.stringify(g.gebied)}. Gevaarlijk, zakelijk en beleefd. Je doet deals (bescherming, smokkel, een klus, informatie) met een echte prijs, en je dreigt niet zonder het te menen.`; }
  return `Je bent ${c.naam}, ${c.rol}. ${c.bio || ""}${c.fac ? ` De houding van jouw groep tegenover dit bedrijf: ${Math.round(faction(s, c.fac))} (schaal -100..100).` : ""}${MENS[c.key] ? ` Jouw persoonlijke relatie met de CEO: ${relV(s, c.key)} (-100..100).` : ""}`;
}
function talkPrompt(s, c, convo, kind){
  const fmt = kind === "mail"
    ? `{"onderwerp": "...", "tekst": "je antwoordmail, 2-8 zinnen", "voorstel": null, "stemming": 0}`
    : `{"bericht": "je antwoord, 1-4 zinnen", "voorstel": null, "stemming": 0}`;
  return `Je speelt een personage in CHROME LEDGER, een cyberpunk-bedrijfssimulatie ${s.map && s.map.kind === "wereld" ? "een wereld van rivaliserende megacorporaties, natiestaten die te koop zijn en oceanen vol vrachtroutes" : "de stad " + (s.city || "Meridian Bay")} (rond ${s.date.year}). Taal: Nederlands. Toon: droog, cynisch, corporate-noir. Spreek de CEO aan met "u" tenzij je personage anders zou doen.

${personaFor(s, c)}

Blijf in je rol en speel eerlijk: geen gratis winst, geen gunsten zonder prijs, red de CEO niet en straf niet zonder reden.
Vraagt de CEO om iets dat het spel moet veranderen (geld, mensen aannemen of ontslaan, een deal, omkopen, onderzoek, sabotage, een gunst, loonsverhoging), dan zet je in "voorstel" wat er precies gebeurt, wat het kost en hoe groot de kans is. De CEO zegt daarna ja of nee, en pas dan gooit de engine 2d6 tegen jouw kans (kansen worden afgerond op wat met 2d6 kan: 8, 17, 28, 42, 58, 72, 83, 92%). Jij gooit niet en je vertelt de uitkomst niet. Bij alleen praten of vragen: "voorstel": null. Doe alleen voorstellen binnen de macht van jouw personage.
${RULES}

Stand van de wereld (alleen voor jou, de CEO ziet dit niet):
${JSON.stringify(worldFacts(s))}

${kind === "mail" ? "De mailwisseling:" : "Het gesprek tot nu toe (CEO = de speler):"}
${convo}

Antwoord met alleen JSON in deze vorm:
${fmt}
"voorstel" is null of: ${PROPOSAL_SHAPE}
"stemming": hoe dit gesprek jouw houding tegenover de CEO verandert, geheel getal -3..3.`;
}
function cleanProposal(p){
  if (!p || typeof p !== "object" || !p.samenvatting) return null;
  const txt = (v, n) => String(v ?? "").slice(0, n);
  const mailOf = m => m && m.tekst ? {van: txt(m.van || "CFO", 60), onderwerp: txt(m.onderwerp || "Afgehandeld", 90), tekst: txt(m.tekst, 1500), prio: ["LAAG", "NORMAAL", "HOOG", "KRITIEK"].includes(m.prio) ? m.prio : "NORMAAL"} : null;
  return {samenvatting: txt(p.samenvatting, 240), risico: txt(p.risico, 240),
    kost: r1(clamp(+p.kost || 0, 0, 500)), bron: p.bron === "zwart" ? "zwart" : "operationeel",
    kans: +p.kans >= 100 ? 100 : snapKans(Math.round(clamp(+p.kans || 50, 5, 95))),
    succes: {effect: (p.succes && p.succes.effect) || {}, mail: mailOf(p.succes && p.succes.mail)},
    falen: {effect: (p.falen && p.falen.effect) || {}, mail: mailOf(p.falen && p.falen.mail)}};
}
function moodShift(s, c, v){
  v = Math.round(clamp(+v || 0, -3, 3)); if (!v) return false;
  const ch = chatOf(c), m = ym(s);
  if (!ch.stemming || ch.stemming.maand !== m) ch.stemming = {maand: m, som: 0};
  v = v > 0 ? Math.min(v, 6 - ch.stemming.som) : Math.max(v, -6 - ch.stemming.som); if (!v) return false;
  ch.stemming.som += v;
  if (c.soort === "npc"){ const n = s.npcs.find(x => x.name === c.naam); if (n){ n.loyalty = clamp(n.loyalty + v); return true; } }
  if (c.soort === "rivaal"){ const r = s.rivals.find(x => x.name === c.ref); if (r){ r.aggression = r1(clamp(r.aggression - v * 0.02, 0, 1) * 100) / 100; return true; } }
  if (c.soort === "gang"){ const g = (s.gangs || []).find(x => x.id === c.ref); if (g){ g.relatie = Math.round(clamp(g.relatie + v * 2, -100, 100)); return true; } }
  if (MENS[c.key]){ relShiftP(s, c.key, v * 2); if (c.fac) shiftFaction(s, c.fac, v); return true; }
  if (c.fac){ shiftFaction(s, c.fac, v); return true; }
  return false;
}
function sampleErrorText(e){
  const c = e && e.code;
  if (c === "not_granted" || c === "sampling_disabled" || c === "not_declared"){ G.sampleOff = true; return "Geen toestemming om Claude te gebruiken in dit venster. Herlaad de pagina om het opnieuw te vragen, of laat Claude dit in de chat beantwoorden."; }
  if (c === "rate_limited") return "Even te veel tegelijk. Probeer het over een minuut opnieuw.";
  if (c === "cancelled") return "Afgebroken.";
  return "Geen bruikbaar antwoord ontvangen. Probeer het opnieuw of zeg het iets concreter.";
}
const live = () => !!(G.sample && !G.sampleOff);

/* ---------- een voorstel uitvoeren: de engine gooit ---------- */
async function executeProposal(p){
  const s = G.game;
  if (p.bron === "zwart"){ if (s.accounts.zwart < p.kost) return {ok: false, bericht: `Niet genoeg zwart geld (€${p.kost}M nodig).`}; s.accounts.zwart = r1(s.accounts.zwart - p.kost); }
  else { if (s.cash < p.kost) return {ok: false, bericht: `Niet genoeg cash (€${p.kost}M nodig).`}; s.cash = r1(s.cash - p.kost); }
  let roll = null, ok = true;
  if (p.kans < 100){ const rr = rolKans(p.kans); roll = rr.txt; ok = rr.ok; addRoll(s, `${rr.txt} → ${ok ? "GELUKT" : "MISLUKT"} · ${p.samenvatting}`); }
  const br = ok ? p.succes : p.falen; applyGmEffect(s, br.effect);
  const ctx = Ctx(); if (br.mail) mail(ctx, s, br.mail.van, br.mail.onderwerp, br.mail.tekst, br.mail.prio);
  addLog(s, `${ok ? "Gelukt" : "Mislukt"}: ${p.samenvatting}${p.kost ? ` (€${p.kost}M)` : ""}`);
  S.expect = true; const docs = await persist(ctx); S.expect = false;
  return {ok: true, gelukt: ok, roll, tekst: `${ok ? "Gelukt" : "Mislukt"}${roll != null ? ` (worp ${roll})` : ""}. ${p.samenvatting}`, mail: docs[0] && docs[0].id};
}

/* ---------- chat ---------- */
const YES = /^\s*(ja|jep|jawel|yes|ok[eé]?|akkoord|doe maar|doen|deal|prima|goed zo)\b/i, NO = /^\s*(nee|neen|no|niet doen|laat maar|stop|liever niet)\b/i;
function openProposal(ch){ for (let i = ch.berichten.length - 1; i >= 0; i--){ const b = ch.berichten[i]; if (b.voorstel && b.vstatus === "open") return b; if (b.van === "ik") return null; } return null; }
const GM_SNEL = {watnu: "Wat moet ik nu doen? Geef de drie belangrijkste dingen, met wat het kost en waarom.", maand: "Vat mijn laatste maand samen: wat ging goed, wat ging fout, waar moet ik op letten?", stand: "Hoe sta ik ervoor tegenover mijn rivalen en de doelen?"};
function lokaalAntwoord(s, soort){
  if (soort === "watnu"){ const A = adviezen(s).slice(0, 3); return A.length ? "Uit de cijfers (de GM is niet live): " + A.map((a, i) => `${i + 1}. ${a.tekst}`).join(" ") : "Uit de cijfers: niets dringends. Bouw door waar je sterk staat."; }
  if (soort === "maand"){ const r = s.laatste_rapport; if (!r || !r.maand) return "Er is nog geen maand gespeeld. Klik +1 maand (toets N) of laat de tijd lopen met ▶."; const g = (r.gebeurd || []).slice(0, 6);
    return `Uit het rapport van ${r.maand} (de GM is niet live): omzet €${r.omzet}M, kosten €${r.kosten}M, netto ${r.netto >= 0 ? "+" : "−"}€${Math.abs(r.netto)}M. ${g.length ? "Gebeurd: " + g.join("; ") + "." : "Verder rustig."} Heat ${Math.round(s.heat)}, morale ${Math.round(s.morale)}, cash €${Math.round(s.cash)}M.`; }
  const D = doelen(s).filter(d => d.id !== "termijn").sort((a, b) => b.pct - a.pct)[0]; let plek = ""; try { plek = `Je staat ${wereldVM(s).plek}e op de ranglijst. `; } catch(e){ foutLog("stand voor de GM", e); }
  const r0 = s.rivals.slice().sort((a, b) => rivalPower(s, b) - rivalPower(s, a))[0];
  return `Uit de cijfers (de GM is niet live): ${plek}Dichtst bij winst: ${D.naam} (${D.pct}%, ${D.nu}).${r0 ? ` Sterkste rivaal: ${r0.name} (${r0.status === "oorlog" ? "in oorlog met je" : "relatie " + Math.round(r0.relatie || 0)}).` : ""} Bedrijfswaarde €${Math.round(playerValue(s))}M.`;
}
async function gmSnel(soort){
  const s = G.game; if (!s || !GM_SNEL[soort]) return; if (live()) return chatSend("gm", GM_SNEL[soort]);
  const c = contacts(s).find(x => x.key === "gm"), ch = chatOf(c), t = Date.now();
  ch.berichten.push({id: "b" + uid(), van: "ik", tekst: GM_SNEL[soort], t, maand: ym(s)}, {id: "b" + uid(), van: "zij", tekst: lokaalAntwoord(s, soort), t: t + 1, status: "ok", maand: ym(s), systeem: true});
  await Store.putChat(ch); render();
}
async function inboxOpruimen(s){
  const open = new Set((s.keuzes || []).map(k => k.id)), nu = ym(s);
  const rap = G.mails.filter(m => !m.uit && !m.archief && /^Maandrapport /.test(m.onderwerp)).sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(3);
  const kz = G.mails.filter(m => !m.uit && !m.archief && m.keuze && !open.has(m.keuze) && String(m.datum) < nu);
  const mnd = d => { const [y, mo] = String(d || "0-0").split("-").map(Number); return y * 12 + mo; }, oud = G.mails.filter(m => !m.uit && !m.archief && !(m.keuze && open.has(m.keuze)) && !/^Maandrapport /.test(m.onderwerp) && mnd(nu) - mnd(m.datum) > 6);
  for (const m of [...rap, ...kz, ...oud].slice(0, 25)) await Store.patchMail(m.id, {archief: true, gelezen: true});
}
async function chatSend(key, text){
  const s = G.game, c = contacts(s).find(x => x.key === key); text = String(text || "").trim();
  if (!c || !text) return;
  const ch = chatOf(c), open = openProposal(ch);
  if (open && YES.test(text)) return decideChat(key, open.id, true, text);
  if (open && NO.test(text)) return decideChat(key, open.id, false, text);
  if (open) open.vstatus = "vervallen";
  ch.berichten.push({id: "b" + uid(), van: "ik", tekst: text.slice(0, 2000), t: Date.now(), maand: ym(s)});
  const reply = {id: "b" + uid(), van: "zij", tekst: "", t: Date.now() + 1, status: live() ? "denkt" : "wacht", maand: ym(s)};
  ch.berichten.push(reply);
  await Store.putChat(ch); render();
  if (!live()) return;
  try {
    const convo = ch.berichten.filter(b => b !== reply).slice(-16).map(b => `${b.van === "ik" ? "CEO" : c.naam}: ${b.tekst}${b.voorstel ? ` [voorstel: ${b.voorstel.samenvatting}; ${b.vstatus}]` : ""}${b.uitkomst ? ` [uitkomst: ${b.uitkomst}]` : ""}`).join("\n");
    const res = await G.sample.json(talkPrompt(s, c, convo, "chat"), {modelTier: c.soort === "gm" ? "default" : "quick", cache: false});
    reply.tekst = String((res && (res.bericht || res.tekst)) || "…").slice(0, 2000); reply.status = "ok";
    const p = cleanProposal(res && res.voorstel); if (p){ reply.voorstel = p; reply.vstatus = "open"; }
    if (moodShift(s, c, res && res.stemming)) await Store.saveGame();
  } catch(e){ reply.status = "fout"; reply.tekst = sampleErrorText(e); }
  await Store.putChat(ch); render();
  if (S.sound) blip(990, .05);
}
async function decideChat(key, msgId, yes, typed){
  const s = G.game, c = contacts(s).find(x => x.key === key); if (!c) return;
  const ch = chatOf(c), b = ch.berichten.find(x => x.id === msgId);
  if (!b || b.vstatus !== "open") return toast("Dit voorstel staat niet meer open.", true);
  ch.berichten.push({id: "b" + uid(), van: "ik", tekst: typed || (yes ? "Ja, doen." : "Nee."), t: Date.now(), maand: ym(s)});
  if (!yes){ b.vstatus = "afgewezen"; await Store.putChat(ch); render(); return; }
  const r = await executeProposal(b.voorstel);
  if (!r.ok){ ch.berichten.push({id: "b" + uid(), van: "zij", tekst: r.bericht, t: Date.now() + 1, status: "ok", systeem: true}); await Store.putChat(ch); render(); return; }
  b.vstatus = "uitgevoerd"; b.uitkomst = r.gelukt ? "gelukt" : "mislukt";
  ch.berichten.push({id: "b" + uid(), van: "zij", tekst: r.tekst + (r.mail ? " Details staan in je inbox." : ""), t: Date.now() + 1, status: "ok", systeem: true, worp: r.roll, gelukt: r.gelukt, mail: r.mail});
  await Store.putChat(ch); render();
  if (S.sound) sweep();
}

/* ---------- mail schrijven, iemand antwoordt ---------- */
async function sendMail(aan, onderwerp, tekst, reOf){
  const s = G.game; aan = String(aan || "").trim().slice(0, 80); onderwerp = String(onderwerp || "").trim().slice(0, 90) || "(geen onderwerp)"; tekst = String(tekst || "").trim().slice(0, 3000);
  if (!aan || !tekst) return {ok: false, bericht: "Vul in aan wie en wat je wilt zeggen."};
  const c = findContact(s, aan) || {key: "x-" + slug(aan), naam: aan, rol: "", soort: "extra", bio: "Iemand in deze wereld. Kies een geloofwaardige rol die past bij de naam en de mail."};
  const [sent] = await Store.addMails([{datum: ym(s), van: s.player.corp_name + " (CEO)", aan: c.naam, onderwerp, prio: "NORMAAL", body: tekst, uit: true, gelezen: true}]);
  if (!live()){ await Store.patchMail(sent.id, {wacht: true}); return {ok: true, bericht: "Verzonden. Zonder live verbinding komt het antwoord pas als je Claude in de chat vraagt om mails te beantwoorden."}; }
  (async () => {
    await Store.patchMail(sent.id, {wacht: true}); render();
    try {
      const orig = reOf ? G.mails.find(m => m.id === reOf) : null;
      const convo = (orig ? `Eerdere mail van "${orig.van}" aan de CEO, onderwerp "${orig.onderwerp}":\n${String(orig.body || "").slice(0, 1500)}\n\n` : "") + `Mail van de CEO aan ${c.naam}:\nOnderwerp: ${onderwerp}\n${tekst}`;
      const res = await G.sample.json(talkPrompt(s, c, convo, "mail"), {modelTier: "default", cache: false});
      const p = cleanProposal(res && res.voorstel);
      const ctx = Ctx(); mail(ctx, s, c.naam + (c.rol ? ` (${c.rol})` : ""), String((res && res.onderwerp) || "Re: " + onderwerp).slice(0, 90), String((res && res.tekst) || "…").slice(0, 3000), p ? "HOOG" : "NORMAAL");
      if (p){ ctx.mails[0].voorstel = p; ctx.mails[0].vstatus = "open"; }
      ctx.mails[0].contact = c.key;
      const moved = moodShift(s, c, res && res.stemming);
      S.expect = true; await Store.addMails(ctx.mails); S.expect = false;
      if (moved){ await Store.saveGame(); if (G.chats[c.key]) await Store.putChat(G.chats[c.key]); }
      await Store.patchMail(sent.id, {wacht: false});
      toast(`Antwoord van ${c.naam}.`); if (S.sound) blip(990, .05);
    } catch(e){ toast(sampleErrorText(e), true); }
    render();
  })();
  return {ok: true, bericht: `Mail verstuurd aan ${c.naam}. Het antwoord komt zo binnen.`};
}
async function decideMail(id, yes){
  const m = G.mails.find(x => x.id === id); if (!m || m.vstatus !== "open") return {ok: false, bericht: "Dit voorstel staat niet meer open."};
  if (!yes){ await Store.patchMail(id, {vstatus: "afgewezen"}); return {ok: true, bericht: "Afgewezen."}; }
  const r = await executeProposal(m.voorstel); if (!r.ok) return r;
  await Store.patchMail(id, {vstatus: "uitgevoerd", uitkomst: r.gelukt ? "gelukt" : "mislukt", worp: r.roll});
  if (S.sound) sweep();
  return {ok: true, bericht: r.tekst};
}

/* ---------- eigen soort laten balanceren door de GM ---------- */
async function gmBalanceType(naam, omschrijving, profiel){
  const base = PRESETS[profiel] || PRESETS.gebalanceerd;
  if (!live()) return {stats: base, uitleg: `Profiel ${base.label.toLowerCase()} gebruikt.`};
  const prompt = `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie (Nederlands). De speler wil een eigen soort bedrijf: "${naam}". Omschrijving van de speler: "${omschrijving}". Gekozen profiel: ${base.label} (${base.uitleg}).
Bepaal eerlijke cijfers per niveau per maand, in M€: "rev" omzet (5-14), "cost" kosten (3-8, rev mag hoogstens cost+7 zijn), "heat" (0-4: legaal 0-1, grijs 2, illegaal 3-4), "vol" schommeling (0.1-0.5). Ter vergelijking: Logistiek 7/4/0/0.15, Biotech 9/6/1/0.35, Cyberware 11/7/2/0.4, Smokkel 14/4/4/0.5. Wees streng: wat veel oplevert is riskant of trekt aandacht.
Antwoord met alleen JSON: {"rev": 9, "cost": 5, "heat": 1, "vol": 0.3, "uitleg": "1-2 zinnen in de stem van de CFO, waarom deze cijfers"}`;
  try { const r = await G.sample.json(prompt, {modelTier: "quick"}); return {stats: {rev: r.rev, cost: r.cost, heat: r.heat, vol: r.vol}, uitleg: String(r.uitleg || "").slice(0, 300)}; }
  catch(e){ return {stats: base, uitleg: sampleErrorText(e) + ` Profiel ${base.label.toLowerCase()} gebruikt.`}; }
}

/* ---------- wat het scherm toont ---------- */
function vm(){
  const s = G.game;
  if (!s) return {geen_spel: true, setup_done: false, divisie_types: SECTORS};
  migrate(s);
  const lr = s.laatste_rapport || {}, manip = !!s.flags.cfo_manipuleert;
  const hq = {}; for (const r of s.rivals) (hq[r.hq] ??= []).push(r.name);
  const pd = new Set(s.projects.map(p => p.district).filter(Boolean)), pu = new Set(s.projects.map(p => p.division).filter(Boolean));
  const cons = contacts(s);
  return {
    setup_done: !!s.setup_done, status: s.status, speler: s.player, datum: s.date, maand: ym(s),
    cash: r1(s.cash + (manip ? lr.cash_offset || 0 : 0)), schuld: s.debt, rente: s.interest_rate,
    heat: r1(clamp(s.heat + (manip ? lr.heat_offset || 0 : 0))), reputatie: r1(s.reputation), morale: r1(s.morale),
    spanningThuis: (() => { const c = exportThuis(s), v = Math.round(spanningVan(s, c)); return c ? {cont: c, v, fase: spanningFase(v)[1], kleur: v >= 90 ? "var(--mag)" : v >= 70 ? "var(--red)" : v >= 50 ? "var(--amber)" : v >= 30 ? "var(--cyan)" : "var(--green)"} : null; })(),
    zwart: s.accounts.zwart, offshore: s.accounts.offshore, personeel: s.staff, cultuur: s.culture,
    nodig: staffNeed(s), salaris: Object.keys(SALARY).find(k => SALARY[k] === s.staff.avg_salary) || "eigen",
    divisies: s.divisions.map(d => ({plan: upgradePlan(s, d), naam: d.name || d.type, type: d.type, level: d.level, eigen: !DT[d.type], aandeel: Math.round(((s.market[d.type] || {}).player || 0) * 100), upgrade_kost: upgradeCost(s, d), bezig: pu.has(d.name || d.type)})),
    soorten: allTypes(s).map(n => ({naam: n, ...typeOf(s, n), eigen: !DT[n]})),
    projecten: s.projects,
    districten: s.districts.map(d => ({id: d.id, naam: d.name, controle: d.control, inkomen: d.income, onderhoud: d.upkeep, lore: d.lore || "", hq: hq[d.id] || [], thuis: s.player.home_district === d.id, kost: districtCost(s, d), bezig: pd.has(d.id),
      buren: d.neighbors || [], zee: d.zee || [], bereik: reachable(s, "player", d), continent: d.continent || "", opbrengst: districtYield(s, d)})),
    kaart: mapView(s), vloot: {schepen: s.schepen || 0, vrij: shipsFree(s), max: SHIP_MAX, kost: shipCost(s), inzet: s.inzet || {}}, stad: s.city,
    rivalen: s.rivals.map(r => ({naam: r.name, ceo: r.ceo, sector: r.sector, hq: r.hq, key: "riv-" + slug(r.name), agressie: r.aggression < 0.35 ? "laag" : r.aggression < 0.6 ? "gemiddeld" : "hoog",
      karakter: r.karakter ? RIVAAL_KARAKTER[r.karakter] : null,
      kas_schatting: Math.round(r.cash * (0.7 + 0.6 * seeded(r.name + ym(s))()) / 10) * 10, aandeel: Math.round(((s.market[r.sector] || {rivals: {}}).rivals[r.name] || 0) * 100), geheugen: r.memory.slice(-3), producten: (r.producten || []).map(p => ({naam: p.naam, aard: p.aard, label: (PRODUCT_AARD[p.aard] || {}).label, kwaliteit: p.kwaliteit, pop: p.pop})),
      status: r.status, relatie: r.relatie, macht: rivalPower(s, r), verdragen: r.verdragen, moe: r.moeheid > 55 ? "hoog" : r.moeheid > 25 ? "merkbaar" : "laag",
      vredeKans: peaceChance(s, r, 0), handelKans: tradeChance(s, r), handelBedrag: tradeAmount(s, r),
      districten: rivalDistricts(s, r).map(d => ({id: d.id, naam: d.kort || d.name, hq: d.id === r.hq, vraag: askPrice(s, r, d), bereik: reachable(s, "player", d)})),
      biedt: playerDistricts(s).filter(d => d.id !== s.player.home_district).map(d => ({id: d.id, naam: d.name, bod: bidPrice(s, r, d), kan: r.cash >= bidPrice(s, r, d)})),
      acties: Object.entries(WAR).map(([key, w]) => ({key, label: w.label, uitleg: w.uitleg, kost: r1(w.kost * (DIFF[s.player.difficulty] || 1) * (relV(s, "fixer") >= 50 ? 0.8 : 1)), kans: warChance(s, r, w.mod)}))})),
    macht: {speler: playerPower(s), defensie: s.defensie || 0, defkost: r1(15 * ((s.defensie || 0) + 1) * (DIFF[s.player.difficulty] || 1)), oorlogen: atWar(s).length},
    aanbiedingen: s.aanbiedingen.map(o => ({...o, districtNaam: o.district ? (s.districts.find(d => d.id === o.district) || {}).name : ""})),
    npcs: s.npcs.map(n => ({naam: n.name, rol: n.role, indruk: impression(n), key: "npc-" + slug(n.name)})),
    facties: Object.entries(s.factions).map(([k, v]) => ({naam: k, label: labelFaction(v.standing), waarde: Math.round(v.standing), noot: v.note})),
    facturen: s.invoices, auto_pay: s.auto_pay, lopend: s.lopende_effecten.map(e => e.naam),
    besluiten: pendingDecisions(s),
    mails: G.mails.map(m => ({id: m.id, van: m.van, aan: m.aan, uit: !!m.uit, onderwerp: m.onderwerp, datum: m.datum, prio: m.prio, gelezen: !!m.gelezen, archief: !!m.archief,
      voorstel: m.vstatus === "open", wacht: !!m.wacht, keuze: m.keuze && (s.keuzes || []).some(k => k.id === m.keuze), preview: String(m.body || "").replace(/[#*|`_-]+/g, " ").slice(0, 120).trim()})),
    contacten: cons.map(c => { const ch = G.chats[c.key], last = ch && ch.berichten[ch.berichten.length - 1];
      return {...c, laatste: last ? (last.van === "ik" ? "U: " : "") + (last.tekst || (last.status === "denkt" ? "typt…" : "")) : "", open: !!(ch && openProposal(ch)), bezig: !!(last && (last.status === "denkt" || last.status === "wacht")), t: last ? last.t : 0}; }),
    rapport: lr.maand ? {...lr, mail: (G.mails.find(m => m.onderwerp === "Maandrapport " + lr.maand) || {}).id} : null,
    geschiedenis: s.history || [],
    streams: s.streams || [], invloed: s.invloed || 0, dominantie: dominanceIncome(s, "player"), zeeSterkte: Object.fromEntries(seaControl(s).map(z => [z.id, z.sterkte.player || 0])), regios: regionDominance(s), vergunning: !!s.flags.vergunning,
    invloedActies: INFLUENCE, factieNamen: Object.keys(s.factions), rivaalNamen: s.rivals.map(r => r.name),
    leenruimte: loanCap(s), nieuwe_divisie_kost: newDivCost(s), divisie_types: allTypes(s), contract: s.flags.nomad_contract,
    dochters: (s.bedrijven || []).filter(b => b.eigenaar === "player" && b.koppeling === "dochter").map(b => ({id: b.id, naam: b.naam, sector: b.sector, land: landNaam(s, b.land), waarde: Math.round(b.waarde), bedrag: ((s.streams || []).find(x => x.naam === "Dochter " + b.naam) || {}).bedrag || 0, verkoop: r1(b.waarde * 0.9), samen: s.divisions.some(d => d.type === b.sector) ? `samenvoegen met ${divNaam(s.divisions.find(d => d.type === b.sector))}` : `eigen divisie (${b.sector})`})),
    focus: (s.focus || []).map(k => ({naam: FOCUS[k].naam, tekst: FOCUS[k].tekst})), volgendeFocus: (() => { const mg = maandenGespeeld(s); return mg < 12 ? 12 - mg : (12 - (mg % 12)) % 12 || 12; })(),
    plannen: (s.plannen || []).filter(p => p.ontdekt).map(p => ({titel: p.titel, wie: p.wie, stap: p.stap, van: p.stappen.length, stappen: p.stappen, wanneer: p.volgende, zacht: !!p.zacht, eind: PLAN_SOORT[p.soort].eindTekst, motief: p.motief || ""})),
    zaad: s.zaad || null, huisstijl: s.huisstijl || null, autoStandaard: s.autoStandaard || {}, adviezen: adviezen(s), doelen: doelen(s), scoreNu: score(s), lengte: spelLengte(s), gezondheid: s.gezondheid || null, eind: s.eind || null,
    crewv: crewVM(s), tijd: tijdVM(s), productlijn: productVM(s), projectRisico: projectRisico(s),
    verdedigingInfo: {waarde: verdediging(s, null), macht: playerPower(s), intel: (s.crew || []).some(m => ["speurder", "fixer"].includes(m.rol)), open: (s.dreigingen || []).map(t => ({label: t.label, van: t.van, maand: t.maand}))},
    keuzes: s.keuzes || [], keuzesKlaar: s.keuzes_klaar || [], wereld: wereldVM(s), mensen: mensenVM(s), onderwereld: gangVM(s), startbonus: startBonus(s), hq_stad: s.player.hq_stad || "",
    log: s.log.slice().reverse().map(l => "- " + l).join("\n"), worpen: s.worpen,
  };
}

/* ---------- acties zoals het scherm ze aanroept ---------- */
const API = {
  async "/api/tick"(d){
    const s = G.game; if (!s || s.status !== "actief") return {ok: false, bericht: "Het spel is voorbij."};
    const openChats = Object.values(G.chats).filter(c => openProposal(c) || c.berichten.some(b => b.status === "denkt")).length;
    const openMails = G.mails.filter(m => m.vstatus === "open").length;
    if ((openChats || openMails) && !d.force) return {ok: false, vraag: true, bericht: `Er staan nog ${openChats + openMails} voorstel(len) of gesprekken open. Als je doorgaat, vervallen open voorstellen niet, maar de wereld wacht ook niet.`};
    try { await Store.backup(); } catch(e){ foutLog("back-up voor de maand", e); }
    S.expect = true; const ctx = tick(s); const docs = await persist(ctx); S.expect = false;
    Store.slots().then(L => Store.saveSlots(L)).catch(() => {});
    inboxOpruimen(s).catch(e => foutLog("inbox opruimen", e)); verhaalBeurt(s).catch(() => {}); planGM(s).catch(e => foutLog("plan door de GM", e));
    if (s.status !== "actief" && s.eind) await Store.addScore({id: G.gid + "-" + s.eind.datum, naam: s.player.corp_name, status: s.status, score: s.eind.score, datum: s.eind.datum, moeilijkheid: s.player.difficulty});
    return {ok: true, status: s.status, rapport_mail: docs[ctx.reportIndex] && docs[ctx.reportIndex].id};
  },
  async "/api/factuur"(d){
    const s = G.game;
    if (d.alles !== undefined){ s.auto_pay = !!d.alles; await persist(); return {ok: true, bericht: "Automatisch betalen " + (s.auto_pay ? "aan." : "uit.")}; }
    const r = actInvoice(s, d.id, d.actie); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg};
  },
  async "/api/besluit"(d){ const r = actDecision(G.game, d.arc, d.keuze, d.budget); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/project"(d){ const r = actProject(G.game, d.soort, d); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/personeel"(d){ const r = actStaff(G.game, d.soort, d.aantal); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/soort"(d){
    const {stats, uitleg} = d.gm ? await gmBalanceType(d.naam, d.omschrijving, d.profiel) : {stats: PRESETS[d.profiel] || PRESETS.gebalanceerd, uitleg: ""};
    const r = addCustomType(G.game, d.naam, stats, d.omschrijving); if (r.ok){ await persist(); S.newType = r.naam; }
    const ty = r.ok ? typeOf(G.game, r.naam) : null;
    return {ok: r.ok, bericht: r.ok ? `${r.msg} Omzet ${ty.rev}, kosten ${ty.cost}, heat ${ty.heat} per niveau.${uitleg ? " " + uitleg : ""}` : r.msg};
  },
  async "/api/rivaal"(d){ const s = G.game, ctx = Ctx(); const r = WAR[d.soort] ? actWar(s, ctx, d.naam, d.soort, d.district) : actDiplo(s, ctx, d.naam, d.soort, d); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/invloed"(d){ const r = actInfluence(G.game, d.soort, d.doel); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/vloot"(d){ const r = d.zone ? actDeploy(G.game, d.zone, d.delta) : actShip(G.game); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/beveiliging"(){ const r = actDefense(G.game); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/divisieconcept"(){ const s = G.game, ctx = Ctx(); const r = actDivisieConcept(s, ctx, G.divConcept); if (r.ok){ G.divConcept = null; await persist(ctx); } return {ok: r.ok, bericht: r.msg}; },
  async "/api/concept"(d){ const s = G.game, ctx = Ctx(); const r = actConcept(s, ctx, (G.concepten || {})[d.divisie]); if (r.ok){ delete G.concepten[d.divisie]; await persist(ctx); } return {ok: r.ok, bericht: r.msg}; },
  async "/api/dochter"(d){ const s = G.game, ctx = Ctx(); const r = actDochter(s, d.id, d.actie); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/autodev"(d){ const s = G.game, dv = s.divisions.find(x => divNaam(x) === d.divisie); if (!dv) return {ok: false, bericht: "Onbekende divisie."};
    const A = (dv.autoDev ??= {aan: false, schaal: "klein"}); if (d.aan != null) A.aan = !!d.aan; if (PRODUCT_SCHAAL[d.schaal]) A.schaal = d.schaal; if (d.aard && PRODUCT_AARD[d.aard]) A.aard = d.aard; await persist(Ctx());
    return {ok: true, bericht: `${divNaam(dv)}: automatisch ontwikkelen ${A.aan ? `aan (${PRODUCT_SCHAAL[A.schaal].label.toLowerCase()})` : "uit"}.`}; },
  async "/api/autostandaard"(d){ const s = G.game; if (!AUTO[d.k]) return {ok: false, bericht: "Onbekend."}; (s.autoStandaard ??= {})[d.k] = !!d.aan; if (d.alle) for (const p of s.producten || []) (p.auto ??= {})[d.k] = !!d.aan; await persist(Ctx()); return {ok: true, bericht: `${AUTO[d.k].split(" (")[0]}: ${d.aan ? "aan" : "uit"}${d.alle ? " voor alle producten" : " voor nieuwe producten"}.`}; },
  async "/api/aanwezig"(d){ const s = G.game, ctx = Ctx(); const r = actAanwezig(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/taak"(d){ const s = G.game, ctx = Ctx(); const r = d.rol ? actAannemen(s, ctx, d.rol) : actTaak(s, ctx, d.k, !!d.aan); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/pitch"(d){ const s = G.game, ctx = Ctx(); const r = actPitch(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/editie"(d){ const s = G.game, ctx = Ctx(); const r = actEditie(s, ctx, d.id, (G.edities || {})[d.id]); if (r.ok){ delete G.edities[d.id]; await persist(ctx); } return {ok: r.ok, bericht: r.msg}; },
  async "/api/aanvraag"(d){ const s = G.game, ctx = Ctx(); const r = actAanvraag(s, ctx, d.id, d.keuze); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/export"(d){ const s = G.game, ctx = Ctx(); const r = actExport(s, ctx, d.soort, d.cont); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/regio"(d){ const s = G.game, ctx = Ctx(); const r = actRegio(s, d.id, d.cont); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/voorraad"(d){ const s = G.game, ctx = Ctx(); const r = actVoorraad(s, ctx, d.m, d.n); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/patent"(d){ const s = G.game, ctx = Ctx(); const r = actPatent(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/onderzoek"(d){ const s = G.game, ctx = Ctx(); const r = d.stop ? actOnderzoekStop(s) : actOnderzoek(s, ctx, d.aard); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/termijn"(d){ const s = G.game, ctx = Ctx(); const r = actTermijn(s, ctx, d.bedrag, d.n); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/beurs"(d){ const s = G.game, ctx = Ctx(); const r = actBeurs(s, ctx, d.soort, d.pct); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/eigenplan"(d){ const s = G.game, ctx = Ctx(); const r = d.stop ? actEigenPlanStop(s) : actEigenPlan(s, ctx, d.k, d.doel); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/ceo"(d){ const s = G.game, ctx = Ctx(); const r = actCeo(s, ctx, d.soort, d.arg); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/instel"(d){ const s = G.game, ctx = Ctx(); const r = actInstel(s, d.k, d.n); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/hoofd"(d){ const s = G.game, ctx = Ctx(); const r = actHoofd(s, ctx, d.div, d.soort, d.arg); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/corpo"(d){ const s = G.game, ctx = Ctx(); const r = actCorpo(s, ctx, d.soort, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/huisstijl"(d){ const s = G.game, ctx = Ctx(); const r = actHuisstijl(s, d || {}); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/product"(d){ const s = G.game, ctx = Ctx(); const r = actProduct(s, ctx, d.soort, d); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/missie"(d){ const s = G.game, ctx = Ctx(); const r = actMissie(s, ctx, d.crew, d.missie, d.doel); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/crew"(d){ const s = G.game, ctx = Ctx(); const r = actCrew(s, ctx, d.soort, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/klus"(d){ const s = G.game, ctx = Ctx(); const r = actKlus(s, ctx, d.id, d.crew); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/leger"(d){ const r = actLeger(G.game, d.id); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/keuze"(d){ const s = G.game, ctx = Ctx(); const r = actKeuze(s, ctx, d.id, d.i); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/mens"(d){ const s = G.game, ctx = Ctx(); const r = actMens(s, ctx, d.key, d.soort); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/bedrijf"(d){ const s = G.game, ctx = Ctx(); const r = actBedrijf(s, ctx, d.id, d.soort); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/gang"(d){ const s = G.game, ctx = Ctx(); const r = actGang(s, ctx, d.id, d.soort, d.land); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/aanbod"(d){ const s = G.game, ctx = Ctx(); const r = offerDecide(s, ctx, d.id, d.ja); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/geld"(d){
    const s = G.game, ctx = Ctx();
    const r = d.soort === "transfer" ? actTransfer(s, ctx, d.van, d.naar, d.bedrag) : d.soort === "lening" ? actLoan(s, d.bedrag) : actRepay(s, d.bedrag);
    if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg};
  },
  async "/api/mail/flag"(d){
    const key = d.soort === "archief" ? "archief" : "gelezen";
    const ids = d.ids.filter(id => { const m = G.mails.find(x => x.id === id); return m && !!m[key] !== !!d.waarde; });
    for (const id of ids) await Store.patchMail(id, {[key]: !!d.waarde});
    return {ok: true};
  },
  async "/api/mail/stuur"(d){ return sendMail(d.aan, d.onderwerp, d.tekst, d.re); },
  async "/api/mail/besluit"(d){ return decideMail(d.id, d.ja); },
  async "/api/setup"(d){ const {s, ctx} = newGame(d); G.game = s; await persist(ctx); return {ok: true, bericht: "Bedrijf opgericht."}; },
  async "/api/doorspelen"(){ const s = G.game; if (!s || !s.eind || !(s.status.startsWith("OVERWINNING") || s.status === "EINDE TERMIJN")) return {ok: false, bericht: "Dit spel kan niet verder."};
    s.status = "actief"; s.player.lengte = "eindeloos"; s.flags.doorgespeeld = true; s.flags.gewonnen_op = s.eind.datum; delete s.eind; s.flags.start_rivalen = []; await persist(); return {ok: true, bericht: "Je speelt verder, zonder einddatum. Je score staat al in de eregalerij."}; },
  async "/api/nieuw"(){ const r = await Store.newGame(); if (r && !r.ok) return {ok: false, bericht: r.msg}; S.setup = null; return {ok: true, bericht: "Nieuw spel. Je vorige spel staat bij Logboek → Spellen; daar kun je terugwisselen."}; },
};
async function api(path, body){
  if (path === "/api/state") return vm();
  return API[path] ? API[path](body || {}) : {ok: false, bericht: "Onbekende actie."};
}

/* ---------- bevestigen in de pagina zelf ---------- */
function ask(title, text, ok = "Doorgaan", danger = false){
  return new Promise(res => {
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="askt"><h2 id="askt">${esc(title)}</h2><p style="margin:0 0 16px;white-space:pre-wrap">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-x="0">Annuleren</button><button class="btn ${danger ? "danger" : "primary"}" data-x="1">${esc(ok)}</button></div></div>`;
    const done = v => { m.remove(); document.removeEventListener("keydown", key); res(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    m.addEventListener("click", e => { const b = e.target.closest("[data-x]"); if (b){ e.stopPropagation(); done(b.dataset.x === "1"); } else if (e.target === m) done(false); });
    document.addEventListener("keydown", key);
    document.body.appendChild(m); m.querySelector('[data-x="1"]').focus();
  });
}

/* ---------- voorstelkaart (chat en mail) ---------- */
function propCard(p, status, attrs, extra){
  const st = {open: "", afgewezen: "afgewezen", vervallen: "vervallen", uitgevoerd: extra && extra.uitkomst ? extra.uitkomst : "uitgevoerd"}[status] ?? status;
  return `<div class="prop ${status}">
    <div class="spread"><span class="kpi">VOORSTEL</span>${status !== "open" ? `<span class="tag ${st === "gelukt" ? "ok" : st === "mislukt" ? "KRITIEK" : ""}">${esc(st)}</span>` : ""}</div>
    <div class="ptext">${esc(p.samenvatting)}</div>
    <div class="pstats"><div><span class="kpi">KOST</span><b>${p.kost ? eur(p.kost) : "gratis"}</b>${p.kost && p.bron === "zwart" ? '<span class="dim"> zwart</span>' : ""}</div>
      <div><span class="kpi">KANS</span><b>${p.kans}%</b>${p.kans < 100 ? `<span class="dim"> · 2d6 ≥ ${doelVoor(p.kans)}</span>` : ""}</div><div class="wide"><span class="kpi">RISICO</span><span>${esc(p.risico || "-")}</span></div></div>
    <div class="meter"><i style="width:${p.kans}%"></i></div>
    ${status === "open" ? `<div class="row" style="margin-top:10px"><button class="btn primary sm" data-a="pyes" ${attrs}>Ja, doen${p.kans < 100 ? " · gooi 2d6" : ""}</button><button class="btn sm" data-a="pno" ${attrs}>Nee</button></div>` : ""}
    ${extra && extra.worp != null ? `<div class="mono dim" style="margin-top:6px;font-size:13px">Worp ${extra.worp}</div>` : ""}</div>`;
}

