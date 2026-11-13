/* Chrome Ledger engine, deel engine-kern.js: kern: constanten, mails, gebeurtenissen, markt, verhaalbogen en de maand. 7.4: de engine staat in zes bestanden die in deze volgorde laden (kern, wereld, leven, producten, gm, opslag); alles deelt dezelfde globale scope. */
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
  "Smokkel": {rev: 13, cost: 5, heat: 4, vol: 0.50}, /* 7.0: was 14/4, de marge liep weg */
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
/* 12.0: ook fouten die nergens opgevangen worden, komen in de foutlog (Logboek), zodat ze te melden zijn */
try { window.addEventListener("unhandledrejection", e => { try { foutLog("onverwacht", e.reason || e); } catch(_){} }); window.addEventListener("error", e => { try { if (e && e.error) foutLog("onverwacht", e.error); } catch(_){} }); } catch(_){}
function foutLog(waar, e){
  const f = {t: new Date().toISOString().slice(0, 16).replace("T", " "), waar, fout: String((e && e.message) || e).slice(0, 200)};
  G.fouten = [f, ...(G.fouten || [])].slice(0, 30);
  try { console.warn("[Chrome Ledger]", waar, e); localStorage.setItem("cl_fouten", JSON.stringify(G.fouten)); } catch(_){}
  return f;
}
/* 3.6: de wereldkaart komt altijd uit WORLD_DATA; ze hoeft niet in elke save (was 75% van de grootte) */
const pak = s => s && s.map && s.map.kind === "wereld" && s.map.versie === 2 && s.map.frame ? {...s, map: {kind: "wereld", versie: 2, gedeeld: true}} : s;
function migrate(s){
  if (s.producten && s.divisions && s.flags && !s.flags.cap_herstel_117 && typeof capMax === "function"){ s.flags.cap_herstel_117 = true; let terug = 0; const dif = (typeof DIFF !== "undefined" && s.player && DIFF[s.player.difficulty]) || 1;
    for (const p of s.producten){ const vrij = capMax(s, p) - capBasis(s, p), nodig = Math.ceil(Math.max(0, vrij) / 15) * 15; let e = p.capExtra || 0; while (e > nodig){ e -= 15; terug += (5 + e / 5) * dif; } if (e !== (p.capExtra || 0)){ p.capExtra = e; } }
    if (terug > 0){ terug = Math.round(terug * 10) / 10; s.cash = Math.round((s.cash + terug) * 10) / 10; if (s.accounts) s.accounts.operationeel = s.cash; (s.log ??= []).push(`${s.date ? s.date.year + "-" + String(s.date.month).padStart(2, "0") : ""} · Terugbetaald: €${terug}M voor productie-uitbreidingen boven het maximum, die niets deden (11.7)`); } } /* 11.7 */
  if (s.districts && s.player && !s.vestiging){ s.vestiging = {}; const hqs = new Set((s.rivals || []).map(r => r.hq)), m = s.date ? `${s.date.year}-${String(s.date.month).padStart(2, "0")}` : "";
    for (const d of s.districts){ if (d.control === "neutral" || hqs.has(d.id) || d.id === s.player.home_district) continue; ((s.vestiging[d.control] ??= {}))[d.id] = m; } } /* 11.0: gekochte landen hebben een vestiging als basis */
  if (Array.isArray(s.aanbiedingen)) s.aanbiedingen = s.aanbiedingen.filter(o => o.type !== "district_koop" && o.type !== "district_verkoop");
  if (Array.isArray(s.streams) && typeof stromenSamen === "function") stromenSamen(s);
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
  /* 4.7.9, 4.7.10 en 6.11.1 waren eenmalige reparaties van één save; die zijn toegepast en in 7.0 uit de engine gehaald */
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
  if (typeof kleurenUniek === "function") kleurenUniek(s); /* 8.0 */
  if (typeof rivSectorOpruimen === "function") rivSectorOpruimen(s); /* 8.6 */
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
    const sec = typeof kiesSector === "function" ? kiesSector(s) : CH(SECTORS), naam = genRivaalNaam(sec, new Set([...s.rivals.map(r => r.name), ...(s.flags.start_rivalen || [])]));
    if (!s.rivals.some(r => r.name === naam)){
      const free = s.districts.filter(d => d.control === "neutral"), hqs = new Set(s.rivals.map(r => r.hq)), afsplits = s.districts.filter(d => d.control !== "player" && d.control !== "neutral" && !hqs.has(d.id)), home = free.length ? CH(free) : afsplits.length ? CH(afsplits) : null; /* 8.0: elke nieuwkomer krijgt een plek op de kaart (desnoods een afsplitsing van een rivaal) */
      const nr = initRival({name: naam, ceo: CH(RIVAL_CEO_NAMEN.filter(x => !s.rivals.some(r => r.ceo === x))), cash: RI(80, 300),
        aggression: r1(U(0.2, 0.7) * 10) / 10, memory: [], hq: home ? home.id : null, sector: sec, divs: {[sec]: 2}});
      s.rivals.push(nr); nr.kleur = uniekeKleur(s, nr); if (home) home.control = naam;
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

/* 7.0: marktslijtage. Een divisie die niet vernieuwt (geen product jonger dan 3 jaar, niets in ontwikkeling, geen uitbreiding in 2 jaar) verliest elke maand marktpositie; wie investeert, krijgt het langzaam terug. De snelheid hangt af van het niveau: zo kost niets doen op den duur alles. */
const GEBIED_NIVEAU = {Casual: 0.9, Realistisch: 0.75, Genadeloos: 0.7}; /* 8.2: gebied levert minder op; de strijd om controle is er vooral om je markt */
const gebiedF = s => GEBIED_NIVEAU[(s && s.player || {}).difficulty] ?? 0.75;
const DRUK = {Casual: 0.5, Realistisch: 1, Genadeloos: 1.6}, SLIJT = 0.004, SLIJT_MIN = 0.3;
const drukF = s => DRUK[s.player.difficulty] ?? 1;
function divVernieuwt(s, d){ const nm = divNaam(d), nu = mndNr(ym(s));
  if (d.upM && nu - mndNr(d.upM) < 24) return true;
  if ((s.projects || []).some(p => p.on_complete && p.on_complete.upgrade_division === nm)) return true;
  return (s.producten || []).some(p => p.divisie === nm && ((p.status === "markt" && (p.leeftijd || 0) < 36) || p.status === "ontwikkeling" || p.editieBezig || p.verbetering)); }
function slijtTick(s, ctx){ for (const d of s.divisions){ const oud = d.slijt ?? 1, vers = divVernieuwt(s, d);
    d.slijt = Math.round(clamp(vers ? oud + 0.02 : oud - SLIJT * drukF(s), SLIJT_MIN, 1) * 1000) / 1000;
    if (!vers && oud >= 0.9 && d.slijt < 0.9) mail(ctx, s, "Strategie", `${divNaam(d)} raakt achterop`, `Al lang geen nieuw product, geen editie en geen uitbreiding bij ${divNaam(d)}. Concurrenten lopen ons voorbij: de divisie verkoopt nog ${Math.round(d.slijt * 100)}% van wat ze kon, en het zakt elke maand. Een nieuw product, een editie of een uitbreiding keert het.`, "HOOG"); } }
/* ---------- de maand ---------- */
function tick(s){
  migrate(s);
  const ctx = Ctx(), diff = DIFF[s.player.difficulty] || 1, played = ym(s), start = s.cash, rep = ctx.rep, gz = gezondheidStart(s); ctx.inTick = true;
  let rev = 0, cost = 0, heatAdd = 0; const lines = [], sf = staffFactor(s), need = staffNeed(s);
  for (const d of s.divisions){
    const t = typeOf(s, d.type) || {rev: 6, cost: 4, heat: 1, vol: 0.3};
    const eff = (d.efficiency || 1) * (0.75 + 0.35 * s.morale / 100) * sf;
    const r = t.rev * Math.pow(d.level, 0.95) * eff * (1 + U(-t.vol, t.vol)) * marketRevMult(s, d.type) * sectorBonus(s, d.type) * sectorMult(s, d.type) * productMult(s, d) * hoofdF(d, "omzet") * (d.slijt ?? 1); /* 7.0: marktslijtage */
    const c = t.cost * 0.85 * d.level * diff * divCostMult(s, d.type) * hoofdF(d, "kosten"); /* 6.1: divisiehoofd */
    rev += r; cost += c; heatAdd += t.heat * Math.pow(t.heat <= 1 ? Math.min(d.level, 6) : d.level, t.heat >= 3 ? 0.9 : 0.75) * 0.5; /* 7.0: riskante sectoren worden echt heet bij groei */
    lines.push(`| ${d.name || d.type} (${d.type} L${d.level}) | ${r1(r)} | ${r1(c)} |`); (s.divomzet ??= {})[d.name || d.type] = r1(r);
    const mk = opMarkt(s, d); if (mk.length){ let po = 0, pk = 0, zw = 0, vk = 0; for (const p of mk){ const K = KANAAL[kanaalVan(p)]; let o = prodOmzet(s, p) * eff; if (stukInfo(p).order && !isAbo(p)) o = 0; /* 6.8: zware producten (tanks, satellieten, ...) verkopen niet aan het publiek, alleen via contracten */ (s.prodomzet ??= {})[p.id] = r1(o); pk += prodKost(p, o);
        { const ex = exportExtra(s, p, o); if (ex.legaal || ex.zwart){ po += ex.legaal; zw += ex.zwart; heatAdd += ex.heat; pk += prodKost(p, ex.legaal + ex.zwart); (s.exportOmzet ??= {})[p.id] = r1(ex.legaal + ex.zwart); } } /* 5.10 */
        if (K.zwart){ zw += o * K.zwart; po += o * (1 - K.zwart); if (o > 0 && !ctx.journo && kansRol() < 0.04){ ctx.journo = true; s.reputation = clamp(s.reputation - 3); heatAdd += 3; mail(ctx, s, "Journalist", `${p.naam} op de zwarte markt`, `Een reportage volgt een lading ${p.naam} van een kofferbak in een steeg tot een bende. Uw naam staat erbij. Reputatie −3, heat +3.`, "HOOG"); } } else po += o; /* 5.0: zwarte markt is een echt risico */ vk += K.vast * diff + capVast(s, p); heatAdd += K.heat; }
      rev += po; cost += pk + vk; lines.push(`| Producten ${d.name || d.type} (${mk.length}) | ${r1(po)} | ${r1(pk + vk)} |`);
      if (zw){ s.accounts.zwart = r1((s.accounts.zwart || 0) + zw); lines.push(`| Zwarte markt ${d.name || d.type} (naar zwart geld) | ${r1(zw)} | 0 |`); } }
  }
  for (const d of s.districts) if (d.control === "player"){ rev += incOf(d) * gebiedF(s) * U(0.85, 1.15); cost += d.upkeep; } /* 8.2: minder winst uit gebied */
  let streamRev = 0; for (const x of s.streams || []) streamRev += x.bedrag * (0.75 + 0.35 * s.morale / 100) * sf * U(0.85, 1.12);
  if (streamRev){ rev += streamRev; lines.push(`| Eigen inkomstenbronnen (${(s.streams || []).length}) | ${r1(streamRev)} | 0 |`); }
  for (const x of s.streams || []) if (x.maanden != null && --x.maanden <= 0) ctx.rep.push(`${x.naam} loopt af`);
  s.streams = (s.streams || []).filter(x => x.maanden == null || x.maanden > 0);
  for (const b of s.bedrijven || []) if (b.contract && !(s.streams || []).some(x => x.naam === "Contract " + b.naam)) b.contract = false; /* 7.0: afgelopen leveringscontract */
  stromenSamen(s);
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
  { const pv = playerValue(s), tz = pv > 300 ? r1(Math.log10(pv / 300) * 1.2 * (typeof drukF === "function" ? drukF(s) : 1)) : 0; /* 7.5: een groot bedrijf trekt toezicht */
    if (tz > 0){ s.heat = clamp(s.heat + tz); gz.hDelen.push(["Toezicht op een groot bedrijf", tz]); } }
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
    if (oc.upgrade_division) for (const d of s.divisions) if ((d.name || d.type) === oc.upgrade_division){ d.level += oc.levels || 1; d.upM = ym(s); }
    if ((oc.upgrade_division || oc.new_division) && s.staff.count < staffNeed(s)){ const t = staffNeed(s) - s.staff.count; mail(ctx, s, "HR", `${t} mensen tekort`, `${p.name} is klaar, maar we hebben nu ${staffNeed(s)} mensen nodig en er werken er ${s.staff.count}. Onderbezet draait alles op halve kracht, we maken verlies en de morale zakt; twee maanden morale onder 10 en de raad zet je af. Neem ${t} mensen aan bij Bedrijf → Personeel.`, "HOOG"); } /* 7.3 */
    if (oc.vestiging || oc.district_control){ const id = oc.vestiging || oc.district_control; if (s.districts.some(d => d.id === id)) zetVestiging(s, "player", id); } /* 11.0: een vestiging is een basis, het land win je */
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
  specialTick(s, ctx); crisisTick(s, ctx); hypeTick(s, ctx); productTick(s, ctx); slijtTick(s, ctx); { const pe = productEffectTick(s); if (pe.heat) gz.hDelen.push(["Producten", r1(pe.heat)]); if (pe.morale) gz.mDelen.push(["Producten", r1(pe.morale)]); } productEventTick(s, ctx); tijdlijnTick(s, ctx); spanningTick(s, ctx); corpoTick(s, ctx); domTick(s, ctx); assistentTick(s, ctx); aanvraagTick(s, ctx); regioTick(s); grondstofTick(s, ctx); patentTick(s, ctx); onderzoekTick(s, ctx); beursTick(s, ctx); eigenPlanTick(s, ctx); ceoTick(s, ctx); hoofdTick(s, ctx); vraagTick(s); rivalProductTick(s); wereldInvloedProducten(s); eraTick(s, ctx); if (s.date.month === 12) jaarTick(s, ctx); marktTick(s); klusTick(s);
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
  if (s.flags.hoge_heat >= 2 && R() < 0.4 * (heeftWet(s, "rechtspraak") ? 0.5 : 1)){ if (razzia(s, ctx)) status = "RAZZIA / VERVOLGING"; } /* 7.2: pas de derde razzia is het einde */
  else if (s.heat > 75 && !s.flags.dossier){ s.flags.dossier = true; mail(ctx, s, "Juridische Zaken", "Er wordt een dossier opgebouwd", `Een bevriende griffier zegt dat ons dossier dikker wordt. Boven 90 heat, twee maanden lang, volgt een razzia${(s.razzias || 0) ? ` (we hadden er al ${s.razzias}; de derde is het einde)` : ""}. Snelste weg omlaag: een juridisch offensief (Overzicht → Gezondheid), een gunst van de commissaris of sporen laten wissen.`, "KRITIEK"); }
  if (s.heat < 65) delete s.flags.dossier;
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

