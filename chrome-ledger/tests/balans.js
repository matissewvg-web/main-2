// Balanstest voor Chrome Ledger: speelt veel spellen met simpele strategieën en toont de uitkomsten.
// Gebruik: node chrome-ledger/tests/balans.js [spellen per strategie] [moeilijkheid]
// Vereist Playwright met Chromium. Draait de engine direct (zonder opslag), dus snel.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact");
const N = +(process.argv[2] || 20), DIFF = process.argv[3] || "Realistisch", LENGTE = process.argv[4] || "normaal";

function pagina(){
  const html = fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8");
  return '<!doctype html><html><head><meta charset=utf8></head><body>' + html + "</body></html>";
}

const STRATEGIE = `const LENGTE = "${LENGTE}";

const KIES = {headhunt: 1, opslag: 1, cao: 0, klant: 0, subsidie: 0, sponsor: 1, interview: 0, data: 1, tip: 0, vreemdeling: 1, sekte: 1, klokkenluider: 0, isra_vracht: 1, diner_rivaal: 0};
function kiesKeuzes(s, ctx, slim){
  for (const k of [...(s.keuzes || [])]){
    let i = k.standaard || 0;
    if (slim){
      if (k.soort && k.soort.startsWith("dreig_")) i = 0;
      else if (k.soort && k.soort.startsWith("gang_")) i = 1;
      else if (k.soort && k.soort.startsWith("special_")) i = k.opties.length - 1;
      else if (k.soort && k.soort.startsWith("prod_")) i = 1;
      else if (k.soort && k.soort.startsWith("plan_")) i = s.cash > 60 ? 0 : 1;
      else if (KIES[k.soort] != null) i = KIES[k.soort];
      if (k.opties[i] && k.opties[i].kost && s.cash < k.opties[i].kost + 30) i = k.standaard || 0;
    }
    actKeuze(s, ctx, k.id, i);
  }
}
function geldZorg(s){
  if (s.cash < 30 && s.accounts.zwart > 15) actTransfer(s, Ctx(), "zwart", "operationeel", Math.floor(Math.min(s.accounts.zwart, 40)));
  if (s.cash < 8) actLoan(s, Math.min(30, Math.max(5, loanCap(s))));
  if (s.cash > 160 && s.debt > 0) actRepay(s, Math.min(s.debt, s.cash - 120));
}
function verstandig(s, ctx, agressief){
  kiesKeuzes(s, ctx, true); geldZorg(s);
  const m = ym(s);
  // morale en heat bewaken
  if (s.morale < 50 && s.staff.avg_salary < SALARY.hoog) actStaff(s, s.staff.avg_salary < SALARY.marktconform ? "marktconform" : "hoog");
  if (s.morale < 40) for (const n of s.npcs) actMens(s, ctx, "npc-" + slug(n.name), "bonus");
  if (s.morale > 75 && s.staff.avg_salary > SALARY.marktconform) actStaff(s, "marktconform");
  if (s.heat > 45){ actMens(s, ctx, "politie", "gunst"); if ((s.invloed || 0) >= 20) actInfluence(s, "rust"); }
  // personeel op peil
  const tekort = staffNeed(s) - s.staff.count; if (tekort > 0 && s.cash > 20) actStaff(s, "huren", Math.min(tekort, 10));
  // crew
  const rollen = ["netrunner", "fixer", "huurling"];
  const netto = ((s.history || []).slice(-1)[0] || {}).netto || 0;
  if (s.crew.length < Math.min(3, crewMax(s)) && s.cash > 90 && netto > 4){ const k = s.huurmarkt.find(x => rollen.includes(x.rol) && !s.crew.some(c => c.rol === x.rol)); if (k) actCrew(s, ctx, "huren", k.id); }
  for (const k of [...s.klussen]){ const c = s.crew.find(x => x.rol === k.rol && crewStatus(s, x) === "vrij"); if (c) actKlus(s, ctx, k.id, c.id); }
  for (const c of s.crew){ if (crewStatus(s, c) !== "vrij") continue;
    if (c.rol === "netrunner") actMissie(s, ctx, c.id, s.heat > 25 ? "sporen" : "datadiefstal", s.rivals[0] && s.rivals[0].name);
    else if (c.rol === "fixer") actMissie(s, ctx, c.id, "spullen");
    else if (c.rol === "huurling"){ const war = atWar(s)[0]; if (war) actMissie(s, ctx, c.id, "overval", war.name); else actMissie(s, ctx, c.id, "beveiligen"); } }
  // syndicaten: bescherming waar ze zitten
  for (const g of s.gangs || []) if (!g.deal && gangLanden(s, g).length && g.relatie > -40) actGang(s, ctx, g.id, "bescherming");
  // producten
  for (const d of s.divisions){ const ps = (s.producten || []).filter(p => p.divisie === divNaam(d));
    for (const p of ps) if (p.status === "markt" && p.pop < 35 && s.cash > 40) actProduct(s, ctx, "campagne", {id: p.id});
    for (const p of ps) if (p.status === "markt" && bereik(p) > prodCap(s, p) && s.cash > capKost(s, p) + 50) actProduct(s, ctx, "capaciteit", {id: p.id});
    if (ps.length < maxProducten(d) && !ps.some(p => p.status === "ontwikkeling") && s.cash > 60) actProduct(s, ctx, "ontwikkel", {divisie: divNaam(d), schaal: s.cash > 140 ? "groot" : "klein"});
    const oud = ps.find(p => p.status === "markt" && p.leeftijd > 30 && !p.verbetering && p.kwaliteit < 5); if (oud && s.cash > 80) actProduct(s, ctx, "verbeter", {id: oud.id}); }
  // groeien
  const d0 = s.divisions.slice().sort((a, b) => a.level - b.level)[0];
  if (d0 && s.cash > upgradeCost(s, d0) + 50 && !s.projects.some(p => p.division === divNaam(d0)) && !(s.heat > 50 && (typeOf(s, d0.type) || {}).heat >= 2)) actProject(s, "upgrade", {divisie: divNaam(d0)});
  const vrij = s.districts.filter(d => d.control === "neutral" && reachable(s, "player", d) && !s.projects.some(p => p.district === d.id)).sort((a, b) => b.income - a.income)[0];
  if (vrij && s.cash > districtCost(s, vrij) + 60) actProject(s, "district", {id: vrij.id});
  if (s.divisions.length < 3 && s.cash > newDivCost(s) + 90) { const opts = SECTORS.filter(t => !s.divisions.some(d => d.type === t) && (s.heat < 30 || (typeOf(s, t) || {}).heat <= 1)); if (opts.length) actProject(s, "divisie", {type: CH(opts), naam: "Bot " + s.divisions.length}); }
  // bedrijven: contracten en aandelen
  if (s.cash > 90){ const b = (s.bedrijven || []).filter(b => !b.eigenaar && !b.contract).sort((a, b) => bedrijfOpties(s, b).contract.kost - bedrijfOpties(s, a).contract.kost).pop(); if (b && bedrijfOpties(s, b).contract.kost < s.cash - 60) actBedrijf(s, ctx, b.id, "contract"); }
  // agressief: oorlog tegen de zwakste rivaal
  if (agressief && maandenGespeeld(s) > 30){
    const war = atWar(s)[0];
    if (!war){ const r = s.rivals.slice().sort((a, b) => rivalPower(s, a) - rivalPower(s, b))[0]; if (r && playerPower(s) > rivalPower(s, r) + 5 && s.cash > 80 && r.status === "vrede") actDiplo(s, ctx, r.name, "oorlog"); }
    else {
      const doel = s.districts.find(d => d.control === war.name && d.id !== war.hq && reachable(s, "player", d));
      if (s.cash > 60) actWar(s, ctx, war.name, doel ? "overval" : (rivalDistricts(s, war).length <= 1 ? "hq" : "sabotage"), doel && doel.id);
      if (war.moeheid > 70 && s.morale < 40) actDiplo(s, ctx, war.name, "vrede", {bedrag: 10});
    }
    for (const o of [...(s.aanbiedingen || [])]) if (o.type === "vrede" && s.morale < 40) offerDecide(s, ctx, o.id, true);
  }
  if (s.defensie < 2 && s.cash > 120) actDefense(s);
}
function passief(s, ctx){ kiesKeuzes(s, ctx, false); geldZorg(s); for (const o of [...(s.aanbiedingen || [])]) if (o.type === "vrede" || o.type === "handel") offerDecide(s, ctx, o.id, true); }
async function run(strat, n, diff){
  const homes = ["BNL", "USA", "JPN", "BRA", "NGA", "ARB", "AUS", "DEU", "IND", "MEX"], docs = [["Logistiek"], ["Biotech"], ["Cyberware"], ["Financieel"], ["Media & Data"], ["Private Security", "Smokkel"]];
  const out = [];
  for (let i = 0; i < n; i++){
    const {s} = newGame({corp_name: "Bot " + i, doctrine: docs[i % docs.length], home: homes[i % homes.length], difficulty: diff, kapitaal: "normaal", lengte: LENGTE, ontslag: "normaal", bonus: "geen", ethiek: "normaal"});
    G.game = s; const ctx = Ctx();
    let derde = 0, weg = 0, prS = 0, dvS = 0, nP = 0, nM = 0;
    while (s.status === "actief" && maandenGespeeld(s) < 300){
      if (maandenGespeeld(s) % 6 === 0){ const cp = contPcts(s); derde = Math.max(derde, (cp[2] || {pct: 0}).pct); weg = Math.max(weg, rivalenWeg(s).weg); }
      try { if (strat === "passief") passief(s, ctx); else verstandig(s, ctx, strat === "agressief"); } catch(e){ out.push({fout: String(e && e.stack || e).slice(0, 300)}); break; }
      tick(s); ctx.mails.length = 0;
      { const mk = (s.producten || []).filter(x => x.status === "markt"); prS += mk.reduce((t, x) => t + ((s.prodomzet || {})[x.id] || 0), 0); dvS += s.divisions.reduce((t, d) => t + ((s.divomzet || {})[d.name || d.type] || 0), 0); nP += mk.length; nM++; }
    }
    out.push({prodPct: Math.round(prS / Math.max(1, prS + dvS) * 100), prodN: Math.round(nP / Math.max(1, nM) * 10) / 10, status: s.status, maanden: maandenGespeeld(s), waarde: playerValue(s), cash: Math.round(s.cash), score: s.eind ? s.eind.score : null, derde, weg, heatGesch: (s.history || []).slice(-8).map(h => Math.round(h.heat)), heatDelen: s.gezondheid && s.gezondheid.heat && s.gezondheid.heat.delen, divs: s.divisions.map(d => d.type + d.level).join(","), morale: Math.round(s.morale), heat: Math.round(s.heat)});
  }
  return out;
}
`;

(async () => {
  const b = await chromium.launch(), ctx = await b.newContext(), p = await ctx.newPage(), fouten = [];
  p.on("pageerror", e => fouten.push(e.message));
  await ctx.route("http://balans.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1);
    if (!u || u === "index.html") return r.fulfill({contentType: "text/html", body: pagina()});
    const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://balans.test/"); await p.waitForTimeout(800);
  await p.evaluate(STRATEGIE + "; window.__run = run;");
  const med = a => { const x = a.slice().sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : 0; };
  for (const strat of ["passief", "verstandig", "agressief"]){
    const t0 = Date.now(), res = await p.evaluate(([a, n, d]) => window.__run(a, n, d), [strat, N, DIFF]);
    const ok = res.filter(r => !r.fout), eind = {};
    for (const r of ok) eind[r.status] = (eind[r.status] || 0) + 1;
    console.log(`\n== ${strat} · ${DIFF} · ${ok.length} spellen · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log("  einde:  ", Object.entries(eind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / ok.length * 100)}%`).join(" · "));
    console.log("  maanden: mediaan", med(ok.map(r => r.maanden)), "· min", Math.min(...ok.map(r => r.maanden)), "· max", Math.max(...ok.map(r => r.maanden)));
    console.log("  waarde:  mediaan", med(ok.map(r => r.waarde)), "· max", Math.max(...ok.map(r => r.waarde)));
    console.log("  producten: mediaan aandeel in divisie-omzet", med(ok.map(r => r.prodPct)) + "% · gemiddeld", med(ok.map(r => r.prodN)), "op de markt");
    console.log("  score:   mediaan", med(ok.map(r => r.score || 0)), "· max", Math.max(...ok.map(r => r.score || 0)));
    console.log("  hegemonie: mediaan beste 3e continent", med(ok.map(r => r.derde)) + "% · ≥60%:", ok.filter(r => r.derde >= 60).length, "· ≥80%:", ok.filter(r => r.derde >= 80).length, "| rivalen weg: mediaan", med(ok.map(r => r.weg)), "· max", Math.max(...ok.map(r => r.weg)));
    const per = {}; for (const r of ok) (per[r.status.startsWith("OVERWINNING") ? "winst" : r.status] ??= []).push(r.score || 0);
    console.log("  score per einde:", Object.entries(per).map(([k, v]) => `${k} ${med(v)}`).join(" · "));
    const err = res.filter(r => r.fout); if (err.length) console.log("  FOUTEN:", err.length, err[0].fout);
  }
  if (process.env.VROEG){ const res = await p.evaluate(([a, n, d]) => window.__run(a, n, d), ["verstandig", 100, DIFF]); const v = res.filter(r => r.maanden < 30); console.log("vroeg dood:", v.length, "van", res.length); for (const r of v.slice(0, 10)) console.log(r.maanden, r.status, r.divs, "cash", r.cash, "heat", r.heat, "morale", r.morale); }
  if (process.env.DIAG){ const res = await p.evaluate(([a, n, d]) => window.__run(a, n, d), ["verstandig", 60, DIFF]); for (const r of res.filter(r => /RAZZIA/.test(r.status)).slice(0, 12)) console.log(r.maanden, r.divs, JSON.stringify(r.heatGesch), JSON.stringify(r.heatDelen)); }
  if (fouten.length) console.log("\nPAGINAFOUTEN:", fouten.slice(0, 5));
  await b.close();
})();
