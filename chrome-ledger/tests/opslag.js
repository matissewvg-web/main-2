// Test voor 3.6: compacte saves, luide back-upfout, maximaal 6 lokale spellen, foutlog, export en import.
// Gebruik: node chrome-ledger/tests/opslag.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://opslag.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://opslag.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Opslag BV", doctrine: ["Logistiek"], home: "BNL"}); for (let i = 0; i < 3; i++) await API["/api/tick"]({force: true}); });
  const maat = await p.evaluate(() => ({kb: Math.round(localStorage.getItem("cl_spel_v2").length / 1024), kaart: JSON.parse(localStorage.getItem("cl_spel_v2")).game.map}));
  ok(maat.kb < 60 && maat.kaart.gedeeld, `save is klein (${maat.kb} KB) en de kaart wordt gedeeld`);
  await p.reload(); await p.waitForTimeout(900);
  const na = await p.evaluate(() => ({naam: G.game.player.corp_name, zones: G.game.map.zones.length, cellen: Object.keys(G.game.map.cells).length, kaart: !!document.querySelector("#main")}));
  ok(na.naam === "Opslag BV" && na.zones > 10 && na.cellen > 20, "na herladen is de kaart terug: " + JSON.stringify(na));
  await p.evaluate(() => { S.view = "kaart"; render(); }); ok(await p.evaluate(() => document.querySelectorAll("main svg path, main svg polygon").length > 40), "de kaart tekent na herladen");
  // back-up faalt luid
  const bf = await p.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v){ if (String(k).startsWith("cl_backup_")) throw new Error("QuotaExceededError (test)"); return orig.call(this, k, v); };
    await API["/api/tick"]({force: true}); Storage.prototype.setItem = orig; S.view = "logboek"; render(); return {fout: G.backupFout, log: (G.fouten || [])[0], toast: [...document.querySelectorAll(".toast *")].map(x => x.textContent).join(" | ")}; });
  ok(bf.fout && /back-up/.test(bf.log.waar) && /back-up van deze maand is mislukt/.test(bf.toast), "mislukte back-up: melding en foutlog: " + JSON.stringify(bf.log));
  ok(await p.evaluate(() => /back-up van .* is mislukt/.test(document.querySelector("main").textContent) && /Foutlog \(\d+\)/.test(document.querySelector("main").textContent)), "opslagkaart toont de fout en de foutlog");
  if (out){ await p.evaluate(() => { const el = [...document.querySelectorAll("main h3")].find(h => /Opslag en back-ups/.test(h.textContent)); el.closest(".card").querySelector("details").open = true; window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/opslag.png"}); }
  // back-up terugzetten werkt met compacte back-ups
  const bk = await p.evaluate(async () => { await API["/api/tick"]({force: true}); const L = await Store.backups(); return {n: L.length, kaart: L[0] && L[0].s.map && !!L[0].s.map.frame}; });
  ok(bk.n >= 1 && bk.kaart, "back-ups laden met kaart: " + JSON.stringify(bk));
  // export en import
  const ex = await p.evaluate(async () => { const txt = JSON.stringify({chromeLedger: VERSION, t: Date.now(), game: pak(G.game)}); const g = migrate(JSON.parse(txt).game); return {kb: Math.round(txt.length / 1024), kaart: !!g.map.frame, naam: g.player.corp_name}; });
  ok(ex.kb < 80 && ex.kaart && ex.naam === "Opslag BV", "export is klein en importeert met kaart: " + JSON.stringify(ex));
  // maximaal 6 spellen
  const sl = await p.evaluate(async () => { const res = []; for (let i = 0; i < 7; i++){ const r = await API["/api/nieuw"](); res.push(r.ok); if (r.ok) await API["/api/setup"]({...S.setup, corp_name: "Slot " + i, doctrine: ["Biotech"], home: "BNL"}); } return {res, n: (await Store.slots()).length, laatste: (await API["/api/nieuw"]()).bericht}; });
  ok(sl.n === 6 && sl.res.filter(x => !x).length >= 1 && /al 6 spellen/.test(sl.laatste), "maximaal 6 spellen: " + JSON.stringify(sl));
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
