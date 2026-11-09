// Waar komt reputatieverlies vandaan? Speelt 12 spellen van 24 maanden en telt elke wijziging per bron (functie die hem veroorzaakte).
// Gebruik: node chrome-ledger/tests/repdiag.js
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact");
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => { const b = await chromium.launch(), c = await b.newContext(), p = await c.newPage();
  await c.route("http://mens.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); return r.fulfill({path: path.join(DIR, u)}); });
  await p.goto("http://mens.test/"); await p.waitForTimeout(800);
  const res = await p.evaluate(async (runs) => { const tot = {};
    for (let g = 0; g < runs; g++){
    await API["/api/setup"]({...S.setup, corp_name: "Diag " + g, doctrine: [["Cyberware"],["Biotech"],["Logistiek"]][g%3], home: "BNL"}); const s = G.game;
    let rep = s.reputation; Object.defineProperty(s, "reputation", {get(){ return rep; }, set(v){ const d = v - rep; if (Math.abs(d) > 1e-9){ const st = (new Error().stack || "").split("\n").slice(2, 4).map(l => (l.match(/at (\S+)/) || [])[1]).join("<"); tot[st] = (tot[st] || 0) + d; } rep = v; }, configurable: true, enumerable: true});
    for (let m = 1; m <= 24; m++){ for (const k of [...(s.keuzes || [])]){ const r0 = rep; await API["/api/keuze"]({id: k.id, i: k.standaard || 0}); if (rep !== r0) tot["keuze:" + k.soort.replace(/_.*/, "")] = (tot["keuze:" + k.soort.replace(/_.*/, "")] || 0) + rep - r0; }
      for (const d of s.divisions){ const ps = s.producten.filter(x => x.divisie === divNaam(d)); if (!ps.some(x => x.status === "ontwikkeling" || x.status === "wachtrij") && ps.length < maxProducten(d) && s.cash > 40) actProduct(s, Ctx(), "ontwikkel", {divisie: divNaam(d), schaal: "klein", focus: "veilig"}); }
      await API["/api/tick"]({force: true}); } }
    return Object.entries(tot).sort((a, b) => a[1] - b[1]).map(([k, v]) => k + " " + Math.round(v / runs * 10) / 10); }, 12);
  console.log(res.join("\n")); await b.close(); })();
