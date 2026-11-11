// Controle (6.4): speelt 60 maanden met alle systemen (assistenten, divisiehoofd, termijnlening, onderzoek, export, klanten, eigen plan, beurs) en zoekt daarna op elk scherm en tabblad naar NaN, undefined, [object Object], Infinity en null.
// Gebruik: node chrome-ledger/tests/alleschermen.js [wereldzaad]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact");
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => { const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await c.route("http://s.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); return r.fulfill({path: path.join(DIR, u)}); });
  await p.goto("http://s.test/"); await p.waitForTimeout(800); await p.mouse.click(5, 5); await p.waitForTimeout(300);
  const res = await p.evaluate(async (seed) => { await API["/api/setup"]({...S.setup, corp_name: "Sweep BV", doctrine: ["Cyberware", "Logistiek"], home: "BNL", zaad: seed}); const s = G.game; s.cash = 800; s.invloed = 80;
    const ctx = Ctx(); for (const k of CONTINENTS) (s.spanning ??= {})[k.naam] = 75;
    for (let i = 0; i < 60 && G.game.status === "actief"; i++){ G.game.morale = Math.max(G.game.morale, 40); G.game.heat = Math.min(G.game.heat, 60); /* 8.7: schermtest, geen balanstest: geen coup of razzia op toeval */
      const g = G.game, cx = Ctx();
      for (const d of g.divisions){ const ps = g.producten.filter(x => x.divisie === divNaam(d)); if (ps.length < maxProducten(d) && !ps.some(x => x.status === "ontwikkeling") && g.cash > 60) actProduct(g, cx, "ontwikkel", {divisie: divNaam(d), schaal: "klein"}); }
      if (i === 5){ actTaak(g, cx, "facturen", true); actAannemen(g, cx, "Verkoopchef"); actTaak(g, cx, "prijzen", true); actHoofd(g, cx, divNaam(g.divisions[0]), "aannemen"); actTermijn(g, cx, 30, 24); }
      if (i === 8){ const a = (g.producten.find(x => x.status === "markt") || {}); if (a.aard) actOnderzoek(g, cx, a.aard); actExport(g, cx, "vergunning", "Noord-Amerika"); }
      for (const a of [...(g.aanvragen || [])]) actAanvraag(g, cx, a.id, "normaal");
      if (i === 12){ const r = g.rivals[0]; actEigenPlan(g, cx, "laster", r.name); actCeo(g, cx, "golf", r.name); }
      if (i === 15 && !g.beurs){ g.cash += 600; actBeurs(g, cx, "ipo", 20); }
      for (const k of [...(g.keuzes || [])]) actKeuze(g, cx, k.id, k.standaard || 0);
      g.heat = Math.min(g.heat, 40);
      await API["/api/tick"]({force: true}); }
    const views = Object.keys(VIEWS), bad = [], check = (wat) => { const t = document.querySelector("main").textContent; for (const w of ["NaN", "undefined", "[object Object]", "Infinity", "null"]) if (t.includes(w)){ const i = t.indexOf(w); bad.push(`${wat}: ${w} … ${t.slice(Math.max(0, i - 60), i + 30).replace(/\s+/g, " ")}`); } };
    for (const v of views){ S.view = v; render(); check(v); }
    S.view = "wereld"; for (const t of ["krant", "nieuws", "bedrijven", "producten", "markten", "spanning"]){ S.wtab = t; render(); check("wereld/" + t); }
    S.view = "bedrijf"; S.ozOpen = S.toelOpen = S.exportOpen = S.epOpen = true; render(); check("bedrijf open");
    for (const pm of G.game.producten.filter(x => x.status === "markt").slice(0, 2)) for (const t of ["overzicht", "prijs", "verkoop", "onderdelen", "markt"]){ S.prodSheet = pm.id; (S.prodTab ??= {})[pm.id] = t; render(); check("product/" + t); }
    S.view = "logboek"; S.instOpen = true; render(); check("logboek open"); toonMenu(); const mt = document.querySelector(".hmenu").textContent; if (/NaN|undefined/.test(mt)) bad.push("menu"); sluitMenu();
    return {status: G.game.status, m: ym(G.game), bad, cash: G.game.cash, waarde: playerValue(G.game)}; }, process.argv[2] || "SWEEP1");
  const fout = res.bad.length || errs.length || res.status !== "actief"; console.log((fout ? "FOUT " : "OK   ") + "alle schermen na 60 maanden: " + JSON.stringify(res)); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close(); process.exit(fout ? 1 : 0); })();
