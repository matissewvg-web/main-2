// Test voor 3.3 met een nagebootste GM: divisie in eigen woorden, opening met eerste product en verhaal, en verhaalbogen over meerdere hoofdstukken.
// Gebruik: node chrome-ledger/tests/verhaal.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1400, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://verhaal.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://verhaal.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(500);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async () => {
    await API["/api/setup"]({...S.setup, corp_name: "Trauma Team", doctrine: ["Biotech"], home: "BNL", kapitaal: "ruim"}); G.game.cash = 300;
    window.__prompts = [];
    G.sample = {json: async prompt => { window.__prompts.push(prompt);
      if (/nieuwe divisie of bedrijfstak/.test(prompt)) return {naam: "Luchtwacht", soort: "Luchtambulance", nieuw: true, cijfers: {rev: 30, cost: 1, heat: 9, vol: 2}, omschrijving: "Gepantserde vtol's boven de stad. Wie belt, wordt opgehaald. Wie niet betaalt, wordt gezien.",
        product: {naam: "Luchtwacht Goud", soort: "abonnement", pitch: "Binnen vier minuten een vtol boven je dak.", markt: "medisch", kost: 15, maanden: 2, moeilijkheid: 7, kwaliteit: 3, effecten: {reputation: 0.4}, gebeurtenissen: []},
        opening: {van: "COO", titel: "De eerste vlucht", tekst: "Bij de openingsvlucht staat de pers klaar. En een concurrent.", opties: [{label: "Live uitzenden", uitleg: "Gok", effect: {kans: 72, succes: {reputation: 5}, falen: {reputation: -5}}}, {label: "Stil openen", uitleg: "Niets", effect: {}}]}};
      const hs = (prompt.match(/Schrijf hoofdstuk (\d)/) || [0, 1])[1];
      return {boog: "De verdwenen piloot", samenvatting: "Een piloot van Luchtwacht is verdwenen na een nachtvlucht.", laatste: false,
        keuze: {van: "Head of Security", titel: `Hoofdstuk ${hs}: een spoor`, tekst: "Er is een spoor naar " + G.game.rivals[0].name + ".", opties: [
          {label: "Laten zoeken · €3k", uitleg: "Kost geld", kost: 3, effect: {kans: 58, succes: {reputation: 3, rivaal: {[G.game.rivals[0].name]: {relatie: -30}}}, falen: {heat: 2}}},
          {label: "Laten rusten", uitleg: "Morale daalt", effect: {morale: -3, loyaliteit: {[G.game.npcs[0].name]: 50}}}]}};
    }}; G.sampleOff = false; S.view = "bedrijf"; render(); });
  await p.waitForTimeout(300);
  await p.fill("#dc_txt", "een eigen ambulancevloot met gepantserde vtol's"); await p.click("[data-a=divconcept]"); await p.waitForTimeout(500);
  const dc = await p.evaluate(() => G.divConcept && {naam: G.divConcept.naam, soort: G.divConcept.soort, nieuw: G.divConcept.nieuw, cijfers: G.divConcept.cijfers, product: G.divConcept.product && G.divConcept.product.naam, opening: !!G.divConcept.opening});
  ok(dc && dc.nieuw && dc.cijfers.rev <= dc.cijfers.cost + 7 && dc.cijfers.cost >= 3 && dc.cijfers.heat <= 4, "divisie ontworpen, cijfers binnen grenzen: " + JSON.stringify(dc));
  if (out){ await p.evaluate(() => { const h = [...document.querySelectorAll("main h3")].find(x => /Nieuwe divisie/.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 80); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/divisie-voorstel.png"}); }
  await p.click("[data-a=divconceptja]"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => G.game.projects.some(x => x.new_name === "Luchtwacht" && x.eersteProduct) && !!typeOf(G.game, "Luchtambulance")), "project gestart, nieuwe soort aangemaakt");
  // een project kan vertraging oplopen of mislukken; dat hoort bij het spel, maar de test mag er niet op falen
  await p.evaluate(async () => { const pj = G.game.projects.find(x => x.new_name === "Luchtwacht"); pj.gerold = true; /* projectworp overslaan: geen vertraging of mislukking in de test */ for (let i = 0; i < 10 && !G.game.divisions.some(d => d.name === "Luchtwacht"); i++){ const q = G.game.projects.find(x => x.new_name === "Luchtwacht"); if (q){ q.eta_months = Math.min(q.eta_months, 1); } await API["/api/tick"]({force: true}); } });
  const na = await p.evaluate(() => ({div: G.game.divisions.map(d => d.name), prod: G.game.producten.map(x => x.naam + ":" + x.status), opening: G.game.keuzes.concat([]).map(k => k.titel).concat((G.game.keuzes_klaar || []).map(k => k.titel))}));
  ok(na.div.includes("Luchtwacht") && na.prod.some(x => x.startsWith("Luchtwacht Goud")) && na.opening.includes("De eerste vlucht"), "geopend met eerste product en openingsverhaal: " + JSON.stringify(na));
  // verhaalboog
  await p.evaluate(async () => { G.game.keuzes = G.game.keuzes.filter(k => k.soort !== "gmverhaal"); G.game.verhaal = null; G.game.flags.volgende_verhaal = 0; await API["/api/tick"]({force: true}); }); await p.waitForTimeout(600);
  const h1 = await p.evaluate(() => { const k = G.game.keuzes.find(x => x.soort === "gmverhaal"); return k && {titel: k.titel, boog: k.boog, eff: k.opties[1].eff}; });
  ok(h1 && /Hoofdstuk 1/.test(h1.titel) && /hoofdstuk 1/.test(h1.boog), "hoofdstuk 1 verschijnt: " + JSON.stringify(h1));
  ok(h1 && h1.eff.loyaliteit && Object.values(h1.eff.loyaliteit)[0] === 15, "grenzen in het verhaal bewaakt (loyaliteit 50 → 15)");
  await p.evaluate(() => { S.view = "overzicht"; render(); }); const keff = await p.$$eval(".keff", e => e.map(x => x.textContent));
  ok(keff.some(t => /Lukt: reputatie \+3, relatie .* -15\. Mislukt: heat \+2\./.test(t)) && keff.some(t => /morale -3, loyaliteit .* \+15/.test(t)), "verhaalkeuzes tonen wat ze doen: " + JSON.stringify(keff));
  if (out){ await p.evaluate(() => { S.view = "overzicht"; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(200); await p.screenshot({path: out + "/verhaal-hoofdstuk.png"}); }
  await p.evaluate(async () => { const k = G.game.keuzes.find(x => x.soort === "gmverhaal"); await API["/api/keuze"]({id: k.id, i: 1}); G.game.flags.volgende_verhaal = 0; await API["/api/tick"]({force: true}); }); await p.waitForTimeout(600);
  const h2 = await p.evaluate(() => ({k: (G.game.keuzes.find(x => x.soort === "gmverhaal") || {}).titel, v: G.game.verhaal, prompt: window.__prompts[window.__prompts.length - 1]}));
  ok(/Hoofdstuk 2/.test(h2.k || "") && h2.v.hoofdstuk === 2 && /Laten rusten/.test(h2.prompt) && /De verdwenen piloot/.test(h2.prompt), "hoofdstuk 2 gaat door op de keuze van hoofdstuk 1");
  await p.evaluate(() => { G.sample = null; S.view = "bedrijf"; render(); }); ok(await p.evaluate(() => [...document.querySelectorAll("details.handmatig")].every(d => d.open)), "zonder live GM staat Handmatig open");
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
