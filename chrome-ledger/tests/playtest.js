// Test voor 3.3.1 (na de playtest): abonnees, overname koppelen, startideeën in een lege divisie, de GM op elk scherm.
// Gebruik: node chrome-ledger/tests/playtest.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1400, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://playtest.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://playtest.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(500);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Abo Corp", doctrine: ["Biotech"], home: "BNL", kapitaal: "ruim"}); G.game.cash = 2000; S.view = "bedrijf"; render(); });
  await p.waitForTimeout(300);
  // startideeën
  const st = await p.$$eval(".starter [data-a=starter]", e => e.map(x => x.dataset.v));
  ok(st.includes("product") && st.includes("abonnement"), "lege divisie toont startideeën: " + st.join(", "));
  if (out){ await p.evaluate(() => { const el = document.querySelector(".starter"); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/starter.png"}); }
  await p.click('.starter [data-v=abonnement]'); await p.waitForTimeout(300);
  const ab = await p.evaluate(() => G.game.producten.map(x => ({naam: x.naam, soort: x.soort, status: x.status})));
  ok(ab.length === 1 && ab[0].soort === "abonnement" && ab[0].status === "ontwikkeling", "abonnement gestart met één klik: " + JSON.stringify(ab));
  // abonnees: forceer een gewone lancering en speel 12 maanden
  const verloop = await p.evaluate(async () => { const q = G.game.producten[0]; q.doelOverride = 2; const rij = [];
    for (let i = 0; i < 14; i++){ await API["/api/tick"]({force: true}); const x = G.game.producten.find(y => y.id === q.id); if (!x) return ["weg"]; if (x.status === "markt") rij.push([x.pop, x.abo, x.aboIn, x.aboUit]); if (G.game.status !== "actief") break; }
    return rij; });
  ok(verloop.length >= 8 && verloop.every(r => r[1] != null) && verloop[verloop.length - 1][1] > verloop[0][1], "abonnees groeien na de lancering: " + JSON.stringify(verloop.map(r => r[1])));
  const schok = await p.evaluate(() => { const x = G.game.producten[0], voor = x.abo, voorPop = x.pop; applyChoice(G.game, Ctx(), {product: {[x.id]: {pop: -25}}}); return {voor, na: x.abo, voorPop, naPop: x.pop}; });
  ok(schok.na < schok.voor && schok.na > schok.voor * 0.6, "een schandaal kost abonnees, maar niet allemaal: " + JSON.stringify(schok));
  await p.evaluate(() => { S.view = "bedrijf"; render(); });
  const rij = await p.evaluate(() => [...document.querySelectorAll(".prow .dim")].map(x => x.textContent).find(t => /abonnees/.test(t)) || "");
  ok(/k abonnees \(\+[\d.]+k \/ −[\d.]+k per mnd, [\d.]+% zegt op\)/.test(rij), "productlijn toont abonnees: " + rij.slice(0, 120));
  if (out){ await p.evaluate(() => { const el = [...document.querySelectorAll(".prow")].find(x => /abonnees/.test(x.textContent)); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/abonnement.png"}); }
  // overname en koppelen
  const ov = await p.evaluate(async () => { const s = G.game, bd = s.bedrijven.find(x => !x.eigenaar && x.sector === "Biotech") || s.bedrijven.find(x => !x.eigenaar); bd.relatie = 100; bd.aandeel = 30; s.reputation = 90;
    let r; for (let i = 0; i < 30; i++){ s.cash = 5000; r = await API["/api/bedrijf"]({id: bd.id, soort: "overname"}); if (bd.eigenaar === "player") break; }
    const k = s.keuzes.find(x => x.soort === "koppel_" + bd.id); return {naam: bd.naam, sector: bd.sector, bericht: r.bericht, opties: k && k.opties.map(o => o.label), id: k && k.id, divs: s.divisions.length}; });
  ok(ov.opties && ov.opties.some(x => /Samenvoegen|Eigen divisie/.test(x)) && ov.opties.some(x => /dochter/.test(x)) && ov.opties.some(x => /Opknippen/.test(x)), "na de overname kies je hoe je koppelt: " + JSON.stringify(ov.opties));
  ok(/Kies in het overzicht hoe je het koppelt/.test(ov.bericht), "bericht legt uit wat er nu gebeurt");
  const na = await p.evaluate(async id => { const s = G.game, k = s.keuzes.find(x => x.id === id), i = k.opties.findIndex(o => /Eigen divisie|Samenvoegen/.test(o.label)); const r = await API["/api/keuze"]({id, i}); return {r: r.bericht, divs: s.divisions.map(d => `${d.name || d.type} L${d.level}`), prod: s.producten.map(x => x.naam + ":" + x.status)}; }, ov.id);
  ok(na.prod.length >= 2 && /meteen op de markt/.test(na.r), "koppelen brengt de bestseller mee: " + JSON.stringify(na));
  // GM op elk scherm
  await p.evaluate(() => { S.view = "kaart"; render(); });
  ok(await p.$(".gmfab") != null, "GM-knop op de kaart");
  await p.keyboard.press("g"); await p.waitForTimeout(200);
  ok(await p.$("#gmtxt") != null && await p.evaluate(() => S.view) === "kaart", "toets G opent de GM zonder de kaart te verlaten");
  await p.fill("#gmtxt", "Wat moet ik nu doen?"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  const gm = await p.evaluate(() => (G.chats.gm || {berichten: []}).berichten.map(b => b.van + ":" + (b.tekst || b.status)));
  ok(gm.some(x => /^ik:Wat moet ik nu doen/.test(x)), "bericht komt in het GM-gesprek: " + JSON.stringify(gm.slice(-2)));
  if (out) await p.screenshot({path: out + "/gm-dock.png"});
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.waitForTimeout(150); ok(!(await p.$(".gmpanel")), "Esc sluit de GM");
  await p.setViewportSize({width: 390, height: 844}); await p.evaluate(() => { S.gmDock = true; S.view = "overzicht"; render(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), "GM-paneel past op 390 px");
  if (out) await p.screenshot({path: out + "/gm-dock-mobiel.png"});
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
