/* Chrome Ledger engine, deel engine-leven.js: levende wereld: bedrijven, mensen, onderwereld, dobbelstenen, tijd en crew. 7.4: de engine staat in zes bestanden die in deze volgorde laden (kern, wereld, leven, producten, gm, opslag); alles deelt dezelfde globale scope. */
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
/* 7.0: na een fusie hadden twee contracten dezelfde naam en betaalden ze allebei; samenvoegen tot één (het hoogste bedrag) */
function stromenSamen(s){ const L = s.streams || [], gezien = new Map(), uit = []; for (const x of L){ const o = gezien.get(x.naam); if (!o){ gezien.set(x.naam, x); uit.push(x); } else if (x.bedrag > o.bedrag) Object.assign(o, x); } if (uit.length !== L.length) s.streams = uit; }
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

