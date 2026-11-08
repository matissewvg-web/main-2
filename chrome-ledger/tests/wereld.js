// Test voor 4.2: levende bedrijvenwereld (oprichtingen, faillissementen, fusies, nieuwe namen, beursgangen, schandalen, contracten die meeverhuizen).
// Gebruik: node chrome-ledger/tests/wereld.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message));
  await c.route("http://wereld.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://wereld.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(300);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  const r = await p.evaluate(async () => {
    await API["/api/setup"]({...S.setup, corp_name: "Kijker BV", doctrine: ["Logistiek"], home: "BNL"}); const s = G.game, start = s.bedrijven.length, namen0 = new Set(s.bedrijven.map(b => b.naam));
    const tel = {}; let minB = 99, maxB = 0; const orig = window.news; window.news = function(s2, kop, ...rest){ const t = kop || ""; const k = /failliet/.test(t) ? "failliet" : /^Nieuwkomer/.test(t) ? "nieuw" : /^Fusie/.test(t) ? "fusie" : / heet voortaan /.test(t) ? "naam" : /naar de beurs/.test(t) ? "beurs" : /^Schandaal/.test(t) ? "schandaal" : null; if (k) tel[k] = (tel[k] || 0) + 1; return orig(s2, kop, ...rest); };
    for (let i = 0; i < 120 && s.status === "actief"; i++){ s.cash = Math.max(s.cash, 300); s.morale = Math.max(s.morale, 60); s.heat = Math.min(s.heat, 30); tick(s); minB = Math.min(minB, s.bedrijven.length); maxB = Math.max(maxB, s.bedrijven.length); }
    window.news = orig;
    const nieuweNamen = s.bedrijven.filter(b => !namen0.has(b.naam)).length, metLog = s.bedrijven.filter(b => (b.log || []).length).length, groei = s.bedrijven.map(b => b.groei).filter(x => x != null);
    return {start, nu: s.bedrijven.length, minB, maxB, tel, nieuweNamen, metLog, groeiBereik: [Math.min(...groei), Math.max(...groei)], status: s.status};
  });
  ok(r.minB >= 15 && r.maxB <= 40, `aantal bedrijven blijft tussen 15 en 40: ${r.minB}-${r.maxB} (start ${r.start}, nu ${r.nu})`);
  ok(["failliet", "nieuw", "fusie", "naam", "beurs", "schandaal"].filter(k => r.tel[k]).length >= 4, "in 10 jaar gebeurt van alles: " + JSON.stringify(r.tel));
  ok(r.nieuweNamen >= 5 && r.metLog >= 5, `nieuwe namen en geschiedenis: ${r.nieuweNamen} nieuwe namen, ${r.metLog} bedrijven met geschiedenis`);
  ok(r.groeiBereik[0] < 0 && r.groeiBereik[1] > 0, "groeiers en krimpers: " + JSON.stringify(r.groeiBereik));
  // contract verhuist mee bij een nieuwe naam
  const cn = await p.evaluate(() => { const s = G.game, b = s.bedrijven.find(x => !x.eigenaar); b.contract = true; (s.streams ??= []).push({naam: "Contract " + b.naam, bedrag: 2, sinds: ym(s)}); const oud = b.naam;
    b.naam = bedrijfNaam(s, b.sector); hernoemStroom(s, oud, b.naam); return s.streams.some(x => x.naam === "Contract " + b.naam) && !s.streams.some(x => x.naam === "Contract " + oud); });
  ok(cn, "contract verhuist mee bij een nieuwe naam");
  await p.evaluate(() => { S.view = "wereld"; S.wtab = "bedrijven"; S.bedrijf = null; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
  const tx = await p.evaluate(() => document.querySelector("main").textContent); ok(/De wereld leeft/.test(tx), "uitleg bij Wereld → Bedrijven" + (/De wereld leeft/.test(tx) ? "" : ": " + tx.slice(0, 300)));
  if (out){ await p.evaluate(() => { S.bedrijf = (G.game.bedrijven.find(b => (b.log || []).length) || {}).id; render(); }); await p.waitForTimeout(200); await p.screenshot({path: out + "/wereld-bedrijven.png"}); }
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
