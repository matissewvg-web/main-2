// Test voor 4.4.3: bètatest en varianten (Basis, Pro, Elite). Deterministisch: de dobbelstenen liggen vast.
// Gebruik: node chrome-ledger/tests/varianten.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://var.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://var.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Variant BV", doctrine: ["Biotech"], home: "BNL", kapitaal: "ruim"}); G.game.cash = 500; });
  // 1. bètatest in het plan
  const bp = await p.evaluate(() => { const s = G.game, d = s.divisions[0], a = devPlan(s, d, "klein", "standaard", "medisch", false), b = devPlan(s, d, "klein", "standaard", "medisch", true); return {a, b}; });
  ok(Math.abs(bp.b.kost - Math.round(bp.a.kost * 1.2 * 10) / 10) < 0.11 && bp.b.maanden === bp.a.maanden + 1 && bp.b.bonus === bp.a.bonus + 1 && bp.b.kansen.hit + bp.b.kansen.gewoon >= bp.a.kansen.hit + bp.a.kansen.gewoon, "bètatest: +20% kosten, +1 maand, +1 op de worp, betere kansen: " + JSON.stringify([bp.a.kansen, bp.b.kansen]));
  // 2. een product met bètatest ontwikkelen en lanceren (vaste worp)
  const vast = () => p.evaluate(() => { window.__echt = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 2; return a; }; }); // d6 = 3 → 6
  const los = () => p.evaluate(() => { crypto.getRandomValues = window.__echt; });
  const r1 = await p.evaluate(async () => { const s = G.game, d = s.divisions[0]; const r = await API["/api/product"]({soort: "ontwikkel", divisie: divNaam(d), schaal: "klein", focus: "standaard", aard: "medisch", beta: "ja", naam: "Basisdosis"}); const x = s.producten.find(y => y.naam === "Basisdosis"); return {ok: r.ok, beta: x && x.beta, eta: x && x.eta}; });
  ok(r1.ok && r1.beta === true, "ontwikkelen met bètatest wordt bewaard: " + JSON.stringify(r1));
  await vast(); const l1 = await p.evaluate(async () => { const s = G.game; for (let i = 0; i < 6; i++){ await API["/api/tick"]({force: true}); if (s.producten.find(y => y.naam === "Basisdosis").status === "markt") break; } return {status: s.producten.find(y => y.naam === "Basisdosis").status, rolls: (s.worpen || []).filter(r => /Lancering Basisdosis/.test(r))}; }); await los();
  ok(l1.status === "markt" && /bètatest/.test(JSON.stringify(l1.rolls)), "lancering toont de bètatest in de worp: " + JSON.stringify(l1));
  // 3. variant Pro: kost, ontwikkeling, klanten overnemen
  const v0 = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); x.pop = 60; const c0 = s.cash, r = await API["/api/product"]({soort: "variant", id: x.id, v: "pro"}), q = s.producten.find(y => y.naam === "Basisdosis Pro");
    const dubbel = await API["/api/product"]({soort: "variant", id: x.id, v: "pro"});
    return {ok: r.ok, bericht: r.bericht, betaald: Math.round((c0 - s.cash) * 10) / 10, k: variantKost(s), q: q && {status: q.status, prijsF: q.prijsF, delen: q.delen.map(z => z.kwal), kw: q.kwaliteit, van: q.variantVan === x.id}, kwOud: x.kwaliteit, dubbel: dubbel.ok}; });
  ok(v0.ok && v0.betaald === v0.k && v0.q && v0.q.status === "ontwikkeling" && v0.q.prijsF === 1.25 && v0.q.delen.every(z => z === "premium") && v0.q.van && v0.q.kw === v0.kwOud && v0.dubbel === false, "variant Pro: betaald, in ontwikkeling, 125%, premium onderdelen, geen dubbele: " + JSON.stringify(v0));
  await vast(); const v1 = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"), voor = x.pop; await API["/api/tick"]({force: true}); const q = s.producten.find(y => y.naam === "Basisdosis Pro"); return {status: q.status, start: q.variantStart, voor, na: x.pop, log: (x.log || []).map(l => l.tekst).join(" | ")}; }); await los();
  ok(v1.status === "markt" && v1.start && v1.start.pop === Math.round(v1.start.origineelVoor * 0.6) && /neemt klanten over/.test(v1.log), "bij de lancering neemt de variant klanten over: " + JSON.stringify(v1));
  // 4. scherm
  await p.evaluate(() => { S.view = "bedrijf"; render(); }); const ds = await p.$('[data-a=prodsheet]'); if (ds){ await ds.click(); await p.waitForTimeout(200); }
  const scherm = await p.evaluate(() => { const el = document.querySelector(".prodblad"); return el ? el.textContent : ""; });
  ok(/VARIANT/.test(scherm), "varianten staan op het productblad");
  if (out){ const bl = await p.$('.prodblad'); if (bl) await bl.screenshot({path: out + "/varianten.png"}); }
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close(); process.exit(log.some(l => l.startsWith("FOUT")) || errs.length ? 1 : 0);
})();
