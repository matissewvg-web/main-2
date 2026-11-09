// Diepe playtest (4.7): speelt 36 maanden als een mens met alle productknoppen: eigen soort wapens, pistolen en tanks,
// prijs, nadruk, onderdelen, bètatest, keuring, kanalen, marketing, varianten, uitbreiden. Logt cijfers en maakt screenshots.
// Gebruik: node chrome-ledger/tests/diepeplay.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1400, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://diep.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); return r.fulfill({path: path.join(DIR, u)}); });
  await p.goto("http://diep.test/"); await p.waitForTimeout(800); await p.mouse.click(5, 5); await p.waitForTimeout(300);
  const start = await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "IJzerwerk NV", eigen: {naam: "Weapon manufacturing", profiel: "gebalanceerd"}, home: "BNL", difficulty: "Realistisch"}); const s = G.game; return {cash: s.cash, div: s.divisions.map(d => `${divNaam(d)} (${d.type} L${d.level})`), aard: aardVan(s.divisions[0].type, "")}; });
  log.push("START " + JSON.stringify(start));
  const shot = async (naam, view, extra) => { if (!out) return; await p.evaluate(([v, e]) => { S.view = v; S.mailBody = null; if (e) Object.assign(S, e); render(); window.scrollTo(0, 0); }, [view, extra || null]); await p.waitForTimeout(200); await p.screenshot({path: `${out}/${naam}.png`, fullPage: true}); };
  for (let m = 1; m <= 36; m++){
    const r = await p.evaluate(async (m) => { const s = G.game, d = s.divisions[0], dn = divNaam(d), A = (soort, a) => API["/api/product"]({soort, ...a}), uit = [];
      for (const k of [...(s.keuzes || [])]) await API["/api/keuze"]({id: k.id, i: k.standaard || 0});
      const ps = () => s.producten.filter(x => x.divisie === dn && x.status !== "teruggeroepen");
      if (m === 1){ const x = await A("ontwikkel", {divisie: dn, naam: "Pistool P9", schaal: "klein", focus: "standaard", aard: "wapen", nadruk: "1", delen: "standaard", beta: "ja"}); uit.push("ontwikkel P9: " + x.bericht); }
      if (m === 6 && s.cash > 40){ const x = await A("ontwikkel", {divisie: dn, naam: "Tank T-90X", schaal: "vlag", focus: "kwaliteit", aard: "wapen", nadruk: "0", delen: "premium"}); uit.push("ontwikkel tank: " + x.bericht); }
      for (const x of s.producten.filter(y => y.status === "markt")){
        if (["nodig", "afgekeurd"].includes(keurStatus(x)) && s.cash > 15){ const r = await A("keuring", {id: x.id, wijze: "officieel"}); uit.push("keuring " + x.naam + ": " + r.bericht); }
        if (!x.prijsGezet){ const best = besteprijs(s, x); if (best && Math.abs(best.f - prijsF(x)) >= 0.05){ const r = await A("prijs", {id: x.id, f: best.f}); uit.push("prijs " + x.naam + ": " + r.bericht); } x.prijsGezet = true; }
        if (m % 4 === 0 && x.actie !== ym(s) && s.cash > 20){ const r = await A("campagne", {id: x.id, mk: "influencers"}); uit.push("campagne " + x.naam + ": " + r.bericht); }
      }
      const p9 = s.producten.find(y => y.naam === "Pistool P9");
      if (m === 14 && p9 && p9.status === "markt"){ const r = await A("variant", {id: p9.id, v: "basis"}); uit.push("variant: " + r.bericht); }
      if (m === 20 && p9 && p9.status === "markt"){ const r = await A("kanaal", {id: p9.id, k: "eigen"}); uit.push("kanaal: " + r.bericht); }
      const up = typeof actUpgrade === "function" ? null : null;
      await API["/api/tick"]({force: true});
      const lr = s.laatste_rapport || {};
      return {m: ym(s), cash: r1(s.cash), netto: lr.netto, omzet: lr.omzet, heat: Math.round(s.heat), rep: Math.round(s.reputation), status: s.status,
        prod: s.producten.map(x => `${x.naam}[${x.status}${x.status === "markt" ? ` ${keurStatus(x)} pop${x.pop} €${(s.prodomzet || {})[x.id] || 0}M` : ""}${x.orders && x.orders.length ? ` orders:${x.orders.map(o => o.stuks + "x€" + o.bedrag + "M").join(",")}` : ""}]`).join(" "), uit}; }, m);
    log.push(JSON.stringify(r));
    if ([6, 18, 36].includes(m)){ await shot(`d${m}-overzicht`, "overzicht"); const id = await p.evaluate(() => (G.game.producten.find(x => x.status === "markt") || {}).id); if (id){ for (const t of ["overzicht", "prijs", "verkoop", "onderdelen"]) await shot(`d${m}-blad-${t}`, "bedrijf", {prodSheet: id, prodTab: {[id]: t}}); } await shot(`d${m}-inbox`, "inbox"); }
    if (r.status !== "actief") break;
  }
  const eind = await p.evaluate(() => { const s = G.game; return {detail: s.producten.filter(x => x.status === "markt").map(x => { const D = prodDetail(s, x, (s.prodomzet || {})[x.id] || prodOmzet(s, x)); return {naam: x.naam, stuk: D.stukPrijs, kost: D.kostPrijs, afzet: D.afzet, eenheid: D.eenheid, order: D.order, defect: D.defect, kanaal: D.kanaal.key, keur: D.keuring && D.keuring.status}; }), advies: adviezen(s).map(a => (a.oud ? "[oud] " : "") + a.tekst.slice(0, 110)), rapport: ((G.mails || []).find(m => /^Maandrapport/.test(m.onderwerp)) || {}).body}; });
  log.push("EIND " + JSON.stringify(eind.detail)); log.push("ADVIES " + JSON.stringify(eind.advies)); log.push("RAPPORT\n" + eind.rapport);
  if (out){ await p.setViewportSize({width: 390, height: 900}); await shot("d36-mobiel-bedrijf", "bedrijf"); }
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
})();
