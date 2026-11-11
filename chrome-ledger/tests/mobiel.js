// 11.2: de gsm. Scroll, menu en opengeklapte blokken blijven staan als het scherm ververst; niets loopt buiten het scherm; de opslagknop staat in de kop.
// Gebruik: node chrome-ledger/tests/mobiel.js
const { chromium, devices } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact");
const html = '<!doctype html><html><head><meta charset=utf8><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({...devices["iPhone 13"], deviceScaleFactor: 1}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://m.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); return r.fulfill({path: path.join(DIR, u)}); });
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.goto("http://m.test/"); await p.waitForTimeout(1200); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Gsm BV", doctrine: ["Weapon Manufacturing"], home: "BNL"}); for (let i = 0; i < 4; i++) await API["/api/tick"]({force: true}); localSet("gezien_versie", VERSIES[0][0]); S.view = "overzicht"; render(); });
  await p.waitForTimeout(500);
  // scroll van de pagina blijft staan bij een nieuwe render
  const sc = await p.evaluate(() => { const se = document.scrollingElement; se.scrollTop = 700; const voor = se.scrollTop; render(); return {voor, na: se.scrollTop, hoog: se.scrollHeight > innerHeight + 700}; });
  ok(sc.hoog && sc.voor > 600 && Math.abs(sc.na - sc.voor) <= 2, "scroll blijft staan als het scherm ververst: " + JSON.stringify(sc));
  // ook na een maand verder
  const sc2 = await p.evaluate(async () => { const se = document.scrollingElement; se.scrollTop = 500; const voor = se.scrollTop; await act("/api/tick", {force: true}); await new Promise(r => setTimeout(r, 300)); return {voor, na: se.scrollTop, view: S.view}; });
  ok(Math.abs(sc2.na - sc2.voor) <= 2 && sc2.view === "overzicht", "na een maand verder hetzelfde scherm en dezelfde plek: " + JSON.stringify(sc2));
  // menu bovenaan (horizontaal) blijft staan
  const nv = await p.evaluate(() => { const n = document.querySelector("nav"); n.scrollLeft = 200; const voor = n.scrollLeft; render(); return {voor, na: document.querySelector("nav").scrollLeft}; });
  ok(nv.voor > 50 && Math.abs(nv.na - nv.voor) <= 2, "menu bovenaan houdt zijn plek: " + JSON.stringify(nv));
  // opengeklapte blokken blijven open
  const dt = await p.evaluate(() => { S.view = "bedrijf"; render(); const d = document.querySelector("main details"); if (!d) return {geen: true}; d.open = true; const k = d.querySelector("summary").textContent; render(); const d2 = [...document.querySelectorAll("main details")].find(x => x.querySelector("summary").textContent === k); return {open: !!(d2 && d2.open)}; });
  ok(dt.geen || dt.open, "opengeklapt blok blijft open: " + JSON.stringify(dt));
  // ander scherm: begint bovenaan dat scherm
  const nw = await p.evaluate(() => { const se = document.scrollingElement; se.scrollTop = 900; goView("contracten"); const nvt = document.querySelector("nav").getBoundingClientRect().top; return {top: se.scrollTop, nvt: Math.round(nvt)}; });
  ok(nw.top < 900 && nw.nvt >= -1, "nieuw scherm begint bovenaan: " + JSON.stringify(nw));
  // niets loopt buiten het scherm
  const views = await p.evaluate(() => Object.keys(VIEWS)), over = {};
  for (const v of views){ const x = await p.evaluate(v => { S.view = v; render(); document.querySelectorAll("main details").forEach(d => d.open = true); const W = document.documentElement.clientWidth, out = [];
      for (const el of document.querySelectorAll("main *")){ const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; let q = el.parentElement, clip = false; while (q && q.tagName !== "MAIN"){ if (/(auto|scroll|hidden)/.test(getComputedStyle(q).overflowX)){ clip = true; break; } q = q.parentElement; } if (!clip && r.right > W + 1) out.push(el.tagName + " " + (el.textContent || "").trim().slice(0, 30)); }
      return out.slice(0, 3); }, v); if (x.length) over[v] = x; }
  ok(!Object.keys(over).length, "op 390 px loopt niets buiten het scherm: " + JSON.stringify(over));
  // opslagknop
  const sv = await p.evaluate(async () => { const k = document.querySelector('.top [data-a="opslaan"]'); if (!k) return {knop: false}; const n0 = (await Store.slots()).length; k.click(); await new Promise(r => setTimeout(r, 600)); return {knop: true, n0, n1: (await Store.slots()).length}; });
  ok(sv.knop && sv.n1 === sv.n0 + 1, "opslagknop in de kop maakt een opslagpunt: " + JSON.stringify(sv));
  const kop = await p.evaluate(() => Math.round(document.querySelector(".top").getBoundingClientRect().height));
  ok(kop <= 250, `kop op de gsm is compact (${kop} px)`);
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
