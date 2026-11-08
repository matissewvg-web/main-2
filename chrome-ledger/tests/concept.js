// Test voor GM-concepten met een nagebootste GM: beschrijven, ontwerpen, opzetten, lanceren, eigen verhaallijn.
// Gebruik: node chrome-ledger/tests/concept.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
const NEP = {naam: "Trauma Team Platinum", soort: "abonnement", pitch: "Een abonnement op gewapende ambulances. Binnen drie minuten ter plaatse, ongeacht wie er schiet. Wie betaalt, overleeft.", doelgroep: "Rijke burgers en managers",
  markt: "medisch", kost: 999, maanden: 9, moeilijkheid: 2, kwaliteit: 5, effecten: {reputation: 0.5, macht: 9, heat: 0.4, straat: -0.3, onzin: 4}, vraag: "oorlogen en bendegeweld", risico: "Een klant sterft onderweg.",
  gebeurtenissen: [{van: "Meldkamer", titel: "Een klant met schulden", tekst: "Een platinaklant ligt neer in een vuurgevecht, maar zijn betaling is gisteren geweigerd.", opties: [
    {label: "Toch gaan", uitleg: "Reputatie omhoog, het kost je een team.", kost: 2, effect: {reputation: 4, cash: -3, populariteit: 8}},
    {label: "Niet gaan", uitleg: "Regels zijn regels.", effect: {reputation: -6, populariteit: -10, factions: {straat: -5}}},
    {label: "Gokken op de buurt", uitleg: "Snel erin en eruit", effect: {kans: 58, succes: {reputation: 6}, falen: {heat: 5, morale: -4}}}]},
    {van: "PR", titel: "Een documentaire over Trauma Team Platinum", tekst: "Een zender wil meelopen met een ploeg.", opties: [{label: "Ja", uitleg: "Reputatie of schandaal", effect: {kans: 72, succes: {reputation: 5, populariteit: 10}, falen: {reputation: -5}}}, {label: "Nee", uitleg: "Niets", effect: {}}]}]};
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1400, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://concept.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://concept.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(500);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async nep => { await API["/api/setup"]({...S.setup, corp_name: "Trauma Team", doctrine: ["Biotech"], home: "BNL", kapitaal: "ruim"}); G.sample = {json: async () => JSON.parse(JSON.stringify(nep))}; G.sampleOff = false; S.view = "bedrijf"; render(); }, NEP);
  await p.waitForTimeout(300);
  ok(await p.$('[data-a=concept]') !== null, "knop 'De GM werkt het uit' zichtbaar");
  await p.fill('textarea[id^="pc_"]', "Trauma Team abonnement: gewapende ambulances"); await p.click('[data-a=concept]'); await p.waitForTimeout(500);
  const cc = await p.evaluate(() => { const c = Object.values(G.concepten || {})[0]; return c && {naam: c.naam, soort: c.soort, kost: c.kost, maanden: c.maanden, kw: c.kwaliteit, doel: c.doel, eff: c.eff, gb: c.gebeurtenissen.length}; });
  ok(cc && cc.naam === "Trauma Team Platinum" && cc.soort === "abonnement", "concept ontworpen: " + JSON.stringify(cc));
  ok(cc && cc.kost === 60 && cc.maanden === 6 && cc.eff.macht === 3 && !("onzin" in cc.eff) && cc.doel >= 3 + cc.kw, "grenzen bewaakt (kost 60, 6 mnd, macht 3, doel ≥ 3+kwaliteit)");
  if (out){ await p.evaluate(() => { const h = [...document.querySelectorAll('main h2')].find(x => /Productlijn/i.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/concept-voorstel.png"}); }
  const cash0 = await p.evaluate(() => G.game.cash);
  await p.click('[data-a=conceptja]'); await p.waitForTimeout(300);
  const pr = await p.evaluate(() => G.game.producten.map(x => ({naam: x.naam, status: x.status, eta: x.eta, soort: x.soort})));
  ok(pr.some(x => x.naam === "Trauma Team Platinum" && x.status === "ontwikkeling" && x.soort === "abonnement"), "in ontwikkeling: " + JSON.stringify(pr));
  ok(Math.round(cash0 - await p.evaluate(() => G.game.cash)) === 60, "kost betaald");
  await p.evaluate(() => { G.game.producten.find(y => y.naam === "Trauma Team Platinum").focus = "veilig"; }); // geen terugroepactie bij twee enen: de test mag niet op toeval falen
  for (let i = 0; i < 8; i++) await p.evaluate(async () => { for (const k of [...G.game.keuzes]) await API["/api/keuze"]({id: k.id, i: k.opties.length - 1}); await API["/api/tick"]({force: true}); });
  const na = await p.evaluate(() => { const x = G.game.producten.find(y => y.naam === "Trauma Team Platinum"); return x && {status: x.status, pop: x.pop, eff: prodEffecten(x), log: (x.log || []).map(l => l.tekst)}; });
  ok(na && na.status === "markt", "gelanceerd: " + JSON.stringify(na));
  const ev = await p.evaluate(() => { const s = G.game, x = s.producten.find(y => y.naam === "Trauma Team Platinum"); if (!x || x.status !== "markt") return null; const ctx = Ctx(), titels = []; for (let i = 0; i < 60 && !titels.some(t => /schulden|documentaire/.test(t)); i++){ s.keuzes = []; let n = 0; while (!s.keuzes.length && n++ < 200) productEventTick(s, ctx); titels.push(...s.keuzes.map(k => k.titel)); } s.keuzes = s.keuzes.filter(k => /schulden|documentaire/.test(k.titel)); return titels.slice(-3); });
  ok(ev && ev.some(t => /schulden|documentaire/.test(t)), "eigen verhaallijn duikt op: " + JSON.stringify(ev));
  if (ev && ev.length){ const r = await p.evaluate(async () => { const k = G.game.keuzes[0]; return (await API["/api/keuze"]({id: k.id, i: 0})).bericht; }); ok(!!r, "keuze uitgevoerd: " + r); }
  if (out){ await p.evaluate(() => { S.view = "bedrijf"; render(); const h = [...document.querySelectorAll('main h2')].find(x => /Productlijn/i.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(200); await p.screenshot({path: out + "/concept-product.png"}); }
  await p.evaluate(() => { G.sample = null; render(); }); ok(await p.evaluate(() => document.querySelector("details.handmatig") && document.querySelector("details.handmatig").open), "zonder live GM staat Handmatig open");
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
