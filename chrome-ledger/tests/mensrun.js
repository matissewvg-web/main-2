// Gebruik: node chrome-ledger/tests/mensrun.js <map-voor-screenshots>
// Speel 24 maanden zoals een mens (eerste stappen volgen, standaardkeuzes), met screenshots om kritisch naar te kijken.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => { const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1400, height: 900}}), p = await c.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://mens.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); return r.fulfill({path: path.join(DIR, u)}); });
  await p.goto("http://mens.test/"); await p.waitForTimeout(800); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Mens BV", doctrine: ["Cyberware"], home: "BNL"}); S.view = "bedrijf"; render(); });
  await p.click('.starter [data-v=product]'); await p.waitForTimeout(200);
  const log = [];
  for (let m = 1; m <= 24; m++){
    await p.evaluate(async () => { const s = G.game; for (const k of [...(s.keuzes || [])]) await API["/api/keuze"]({id: k.id, i: k.standaard || 0});
      const c = (s.crew || []).find(x => crewStatus(s, x) === "vrij"), k = (s.klussen || []).find(x => c && x.rol === c.rol); if (c && k) actKlus(s, Ctx(), k.id, c.id);
      for (const d of s.divisions){ const ps = s.producten.filter(x => x.divisie === divNaam(d)); if (!ps.some(x => x.status === "ontwikkeling" || x.status === "wachtrij") && ps.length < maxProducten(d) && s.cash > 40) actProduct(s, Ctx(), "ontwikkel", {divisie: divNaam(d), schaal: "klein", focus: "veilig"}); }
      await API["/api/tick"]({force: true}); });
    const st = await p.evaluate(() => ({rep: Math.round(G.game.reputation * 10) / 10, lek: Object.keys(G.game.flags).filter(k => /manipuleert|lekt|verkocht/.test(k) && G.game.flags[k]), m: ym(G.game), cash: Math.round(G.game.cash), heat: Math.round(G.game.heat), morale: Math.round(G.game.morale), status: G.game.status, prod: G.game.producten.filter(x => x.status === "markt").length, inbox: G.mails.filter(x => !x.archief && !x.gelezen).length, advies: adviezen(G.game).slice(0, 2).map(a => a.tekst.slice(0, 70))}));
    log.push(JSON.stringify(st));
    if (out && [3, 12, 24].includes(m)){ for (const v of ["overzicht", "bedrijf", "inbox"]){ await p.evaluate(v => { S.view = v; S.mailBody = null; render(); window.scrollTo(0, 0); }, v); await p.waitForTimeout(150); await p.screenshot({path: `${out}/m${m}-${v}.png`}); } }
    if (st.status !== "actief") break;
  }
  console.log(log.join("\n")); console.log("errs", errs); await b.close(); })();
