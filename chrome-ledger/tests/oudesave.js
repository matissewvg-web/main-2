// Controle (6.4): haalt alle velden van na 5.0 uit een spel (zoals een oude save), toont elk scherm, speelt 6 maanden en controleert dat alles vanzelf wordt aangemaakt zonder fouten.
// Gebruik: node chrome-ledger/tests/oudesave.js
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact");
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => { const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await c.route("http://s.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); return r.fulfill({path: path.join(DIR, u)}); });
  await p.goto("http://s.test/"); await p.waitForTimeout(800); await p.mouse.click(5, 5); await p.waitForTimeout(300);
  const res = await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Oud BV", doctrine: ["Biotech"], home: "BNL"}); for (let i = 0; i < 12; i++) await API["/api/tick"]({force: true});
    const s = G.game; for (const k of ["spanning", "regioVraag", "grondstof", "gsSchok", "voorraad", "onderzoek", "ceo", "wetten", "patrouille", "aanwezig", "rivAanwezig", "aanvragen", "contracten", "exportVergunning", "smokkelroute", "rivaalPatent", "leningen", "beurs", "eigenPlannen", "taken", "divHist", "huisstijl", "autoStandaard", "zaad"]) delete s[k];
    delete s.player.instel; delete s.player.instelScore; for (const d of s.districts){ delete d.dom; delete d.domMnd; delete d.domRiv; } for (const d of s.divisions){ delete d.hoofd; delete d.autoDev; }
    for (const p of s.producten || []){ delete p.matF; delete p.tech; delete p.patent; delete p.markten; delete p.auto; p.hist = (p.hist || []).map(h => ({m: h.m, pop: h.pop, omzet: h.omzet})); }
    for (const r of s.rivals){ delete r.karakter; delete r.tech; delete r.ceoLeeftijd; delete r.ceoRel; } s.history = (s.history || []).map(h => { const x = {...h}; delete x.waarde; return x; });
    const bad = [], check = w => { const t = document.querySelector("main").textContent; for (const x of ["NaN", "undefined", "[object Object]"]) if (t.includes(x)) bad.push(w + ": " + x); };
    for (const v of Object.keys(VIEWS)){ S.view = v; render(); check(v + " vóór"); }
    const w0 = playerValue(s); for (let i = 0; i < 6; i++) await API["/api/tick"]({force: true});
    for (const v of Object.keys(VIEWS)){ S.view = v; render(); check(v + " na"); }
    S.view = "wereld"; for (const t of ["krant", "spanning", "markten"]){ S.wtab = t; render(); check("wereld/" + t); } S.view = "financien"; render(); check("financien");
    return {status: G.game.status, w0, w1: playerValue(G.game), bad, nieuw: {spanning: !!G.game.spanning, ceo: !!G.game.ceo, regio: !!G.game.regioVraag, grondstof: !!G.game.grondstof}}; });
  const fout = res.bad.length || errs.length || res.status !== "actief" || !Object.values(res.nieuw).every(Boolean); console.log((fout ? "FOUT " : "OK   ") + "oude save werkt: " + JSON.stringify(res)); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close(); process.exit(fout ? 1 : 0); })();
