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
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Variant BV", doctrine: ["Biotech"], home: "BNL", kapitaal: "ruim"}); G.game.cash = 500; window._autoK = (G.game.autoStandaard || {}).keuring; G.game.autoStandaard = {}; });
  ok(await p.evaluate(() => window._autoK === true), "nieuw spel: autopilot-keuring staat standaard aan"); /* 5.4.1: auto-keuring hier uit, zodat de keuringstests de handmatige weg testen */
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
  await vast(); const v1 = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"), voor = x.pop; s.cash = Math.max(s.cash, 300); s.accounts.operationeel = s.cash; /* geen wachtrij door toevallig weinig cash */ for (let i = 0; i < 4; i++){ await API["/api/tick"]({force: true}); const q0 = s.producten.find(y => y.naam === "Basisdosis Pro"); if (!q0 || q0.status !== "ontwikkeling") break; } /* een toevallige inbraak bij R&D kan twee maanden vertragen */ const q = s.producten.find(y => y.naam === "Basisdosis Pro"); return {status: q.status, eta: q.eta, cash: s.cash, xs: x.status, start: q.variantStart, voor, na: x.pop, log: (x.log || []).map(l => l.tekst).join(" | ")}; }); await los();
  ok(v1.status === "markt" && v1.start && v1.start.pop === Math.round(v1.start.origineelVoor * 0.6) && /neemt klanten over/.test(v1.log), "bij de lancering neemt de variant klanten over: " + JSON.stringify(v1));
  // 4. keuring (4.5.1): na de lancering niet gekeurd, 60% van de afzet; officieel keuren met vaste worp; omkopen
  const k0 = await p.evaluate(() => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"), q = s.producten.find(y => y.naam === "Basisdosis Pro"); const g1 = prodGewicht(x, s), st = keurStatus(x); const ok = {...x, keuring: "ok"}; return {st, stPro: keurStatus(q), ratio: Math.round(g1 / prodGewicht(ok, s) * 100) / 100}; });
  ok(k0.st === "nodig" && k0.stPro === "nodig" && k0.ratio === 0.6, "na de lancering niet gekeurd: 60% van de afzet: " + JSON.stringify(k0));
  await vast(); const k1 = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"), c0 = s.cash; const r = await API["/api/product"]({soort: "keuring", id: x.id, wijze: "officieel"}); const na1 = keurStatus(x), betaald = Math.round((c0 - s.cash) * 10) / 10;
    await API["/api/tick"]({force: true}); await API["/api/tick"]({force: true}); return {ok: r.ok, na1, betaald, kost: keurKost(s), eind: keurStatus(x), worp: (s.worpen || []).filter(w => /Keuring Basisdosis/.test(w))}; }); await los();
  ok(k1.ok && k1.na1 === "bezig" && k1.betaald === k1.kost && k1.eind === "ok" && k1.worp.length === 1, "officiële keuring: betaald, twee maanden, goedgekeurd met de worp in het logboek: " + JSON.stringify(k1));
  await p.evaluate(() => { window.__echt = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 3; return a; }; }); // d6 = 4 → 8
  const vg = await p.evaluate(() => { const s = G.game, q = s.producten.find(y => y.naam === "Basisdosis Pro"); const st = keurStatus(q), lic = !!(s.vergunning || {}).medisch;
    const oud = {flags: {}, producten: [{naam: "Oud", aard: "wapen", keuring: "afgekeurd"}, {naam: "Bezig", aard: "medisch", keuring: {maanden: 1}}]}; try { migrate(oud); } catch(e){} return {st, lic, migr: oud.producten.map(x => keurStatus(x)), vlag: oud.flags.keur_471}; });
  ok(vg.st === "nodig" && vg.migr.every(x => x === "ok") && vg.vlag, "keuring per editie: de variant blijft ongekeurd tot hij zelf gekeurd is; oude saves eenmalig alles gekeurd: " + JSON.stringify(vg));
  await p.evaluate(() => { window.__echt2 = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 5; return a; }; }); // dubbel zes
  const nv = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"), kw = x.kwaliteit; x.keuring = "ok"; x.verbetering = 1; await API["/api/tick"]({force: true}); return {kw0: kw, kw1: x.kwaliteit, st: keurStatus(x)}; });
  await p.evaluate(() => { crypto.getRandomValues = window.__echt2; });
  ok(nv.kw1 === Math.min(5, nv.kw0 + 1) && (nv.kw0 >= 5 || nv.st === "nodig"), "nieuwe versie = nieuwe editie: opnieuw keuren: " + JSON.stringify(nv));
  const k2 = await p.evaluate(async () => { const s = G.game, q = s.producten.find(y => y.naam === "Basisdosis Pro"), h0 = s.heat; s.accounts.zwart = 0; s.vergunning = {}; q.keuring = "nodig"; const r = await API["/api/product"]({soort: "keuring", id: q.id, wijze: "omkopen"}); return {ok: r.ok, st: keurStatus(q), heat: Math.round((s.heat - h0) * 10) / 10}; });
  await los(); ok(k2.ok && k2.st === "ok" && k2.heat >= 3, "keurder omkopen (vaste worp 8): meteen goedgekeurd, heat omhoog: " + JSON.stringify(k2));
  // 5. verkoopkanalen (4.6)
  const kn = await p.evaluate(() => { const q = {id: "tk", naam: "Test", aard: "wapen", kwaliteit: 3, pop: 50, status: "markt"}; return {gh: kanaalF(q), eigen: kanaalF({...q, kanaal: "eigen"}), zwWapen: kanaalF({...q, kanaal: "zwart"}), zwMed: kanaalF({...q, aard: "medisch", kanaal: "zwart"}),
    online: kanaalF({...q, aard: "data", kanaal: "online"}), keurZw: keurF({...q, keuring: "nodig", kanaal: "zwart"}), keurGh: keurF({...q, keuring: "nodig"}), kostGh: prodKost(q, 10), kostEigen: prodKost({...q, kanaal: "eigen"}, 10)}; });
  ok(kn.gh === 1 && Math.abs(kn.eigen - 1.035) < 1e-9 && kn.zwWapen === 1.25 && kn.zwMed === 0.8 && Math.abs(kn.online - 1.2075) < 1e-9 && kn.keurZw === 1 && kn.keurGh === 0.6 && kn.kostEigen < kn.kostGh, "kanalen: groothandel 1, eigen ×1,035 en lagere kosten per omzet, zwart sterk voor wapens en zonder keuring: " + JSON.stringify(kn));
  await vast(); const zw = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); x.keuring = "nodig"; const c0 = s.cash, r = await API["/api/product"]({soort: "kanaal", id: x.id, k: "zwart"}), betaald = Math.round((c0 - s.cash) * 10) / 10;
    const z0 = s.accounts.zwart || 0; await API["/api/tick"]({force: true}); const o = (s.prodomzet || {})[x.id] || 0; const rap = (G.mails || []).find(m => /^Maandrapport/.test(m.onderwerp)), regel = rap ? (String(rap.body).split("\n").find(l => /Zwarte markt/.test(l)) || "") : ""; return {ok: r.ok, betaald, wissel: kanaalWissel(s), kanaal: x.kanaal, erbij: Math.round(((s.accounts.zwart || 0) - z0) * 100) / 100, helft: Math.round(o * 0.5 * 100) / 100, regel}; }); await los();
  ok(zw.ok && zw.betaald === zw.wissel && zw.kanaal === "zwart" && zw.erbij > 0 && /Zwarte markt/.test(zw.regel) && Math.abs(parseFloat(zw.regel.split("|")[2]) - zw.helft) <= 0.11, "zwarte markt: overstappen kost geld, de helft van de omzet wordt zwart geld: " + JSON.stringify(zw));
  // 6. marketingkanalen (4.6.1)
  const mk = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); x.actie = null; delete x.mkt; x.kanaal = "groothandel"; x.keuring = "ok";
    const straat0 = segmenten(x, s).rows.find(r => r.naam === "Straatklinieken").pct, p0 = x.pop; const r = await API["/api/product"]({soort: "campagne", id: x.id, mk: "influencers"});
    const straat1 = segmenten(x, s).rows.find(r => r.naam === "Straatklinieken").pct, nogeens = await API["/api/product"]({soort: "campagne", id: x.id, mk: "reclame"});
    const q = s.producten.find(y => y.naam === "Basisdosis Pro"); q.actie = null; s.accounts.zwart = 0; const zonder = await API["/api/product"]({soort: "campagne", id: q.id, mk: "fluister"}); s.accounts.zwart = 5; const h0 = s.heat, met = await API["/api/product"]({soort: "campagne", id: q.id, mk: "fluister"});
    const beursSeg = SEGMENTEN.medisch[mktSegIndex(x, "koopkrachtig")][0]; const m0 = x.mkt.maanden; for (let i = 0; i < m0; i++) mktTick(x);
    return {ok: r.ok, pop: x.pop - p0, seg: x.mkt ? "nog actief" : "afgelopen", straat0, straat1, nogeens: nogeens.ok, zonder: zonder.ok, met: met.ok, zwart: s.accounts.zwart, heat: Math.round((s.heat - h0) * 10) / 10, beursSeg, m0}; });
  ok(mk.ok && mk.pop === 8 && mk.straat1 > mk.straat0 && mk.nogeens === false, "influencers: populariteit +8, meer afzet bij straatklinieken, één campagne per maand: " + JSON.stringify(mk));
  ok(mk.zonder === false && mk.met === true && mk.zwart === 3 && mk.heat >= 2, "fluistercampagne: alleen met zwart geld, kost heat");
  ok(mk.beursSeg === "Rijke particulieren" && mk.m0 === 4 && mk.seg === "afgelopen", "beurs richt zich op de koopkrachtigsten; een campagne loopt af na zijn maanden");
  // 8. compensatie (4.7.3): bestaande save krijgt eenmalig €100M, een nieuw spel niet
  const cp = await p.evaluate(() => { const s = G.game, oud = JSON.parse(JSON.stringify(s)); delete oud.flags.compensatie_473; const c0 = oud.cash; migrate(oud); const c1 = oud.cash; migrate(oud); return {erbij: Math.round((c1 - c0) * 10) / 10, tweede: Math.round((oud.cash - c1) * 10) / 10, nieuw: !!s.flags.compensatie_473}; });
  ok(cp.erbij === 100 && cp.tweede === 0 && cp.nieuw, "compensatie: oude save eenmalig +€100M, nieuw spel niet: " + JSON.stringify(cp));
  // 9. zelf maken (4.7.4)
  const zm = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); x.delen = [0, 1, 2].map(() => ({kwal: "standaard", eigen: false})); s.cash += 50; const c0 = s.cash, k0 = kostPrijs(x), f0 = kostFactor(x);
    const r = await API["/api/product"]({soort: "zelfmaken", id: x.id, i: "alle"}), nogeens = await API["/api/product"]({soort: "zelfmaken", id: x.id, i: "0"});
    const D = prodDetail(s, x, 1); return {ok: r.ok, betaald: Math.round((c0 - s.cash) * 10) / 10, per: zelfKost(s), k0, k1: kostPrijs(x), f0, f1: kostFactor(x), alleEigen: x.delen.every(d => d.eigen && !d.lev), lev: D.delen.map(d => d.lev), nogeens: nogeens.ok}; });
  ok(zm.ok && zm.betaald === Math.round(zm.per * 3 * 10) / 10 && zm.f1 < zm.f0 && zm.alleEigen && zm.lev.every(l => l === "eigen fabriek") && zm.nogeens === false, "alles zelf maken: drie keer de investering, lagere kostprijs, geen leveranciers meer: " + JSON.stringify(zm));
  const st = await p.evaluate(() => { const s = G.game, d = s.divisions[0], q = mkProduct(s, d, "Standaardtest", 3, 50); const oud = JSON.parse(JSON.stringify(s)); delete oud.flags.eigen_475; oud.producten.forEach(x => x.delen = [{kwal: "premium"}]); migrate(oud); return {nieuw: q.delen.every(x => x.eigen), oud: oud.producten.every(x => x.delen.length === 3 && x.delen.every(y => y.eigen)), kwalBewaard: oud.producten.every(x => x.delen[0].kwal === "premium")}; });
  ok(st.nieuw && st.oud && st.kwalBewaard, "standaard eigen fabriek; oude save eenmalig omgezet (keuzes bewaard): " + JSON.stringify(st));
  const kr = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); x.capExtra = 0; const c0 = prodCap(s, x), r = await API["/api/product"]({soort: "krimpen", id: x.id}); const c1 = prodCap(s, x), v1 = capVast(s, x);
    let n = 0; while ((await API["/api/product"]({soort: "krimpen", id: x.id})).ok && n < 10) n++; const min = prodCap(s, x); x.capExtra = 0; return {ok: r.ok, c0, c1, v1, min, n}; });
  ok(kr.ok && kr.c1 === kr.c0 - 15 && kr.v1 < 0 && kr.min >= 45, "inkrimpen: −15 capaciteit, vaste kosten omlaag, nooit onder 45: " + JSON.stringify(kr));
  const tr = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); x.capExtra = 0; s.cash += 20; const c0 = s.cash; await API["/api/product"]({soort: "capaciteit", id: x.id}); const c1 = s.cash; await API["/api/product"]({soort: "krimpen", id: x.id}); return {betaald: Math.round((c0 - c1) * 10) / 10, terug: Math.round((s.cash - c1) * 10) / 10, cap: x.capExtra}; });
  ok(tr.betaald > 0 && tr.terug === tr.betaald && tr.cap === 0, "uitbreiding terugdraaien geeft de investering terug: " + JSON.stringify(tr));
  const ov = await p.evaluate(() => { const s = G.game, oud = JSON.parse(JSON.stringify(s)); delete oud.flags.overname_477; const weg = oud.divisions[0], n0 = oud.divisions.length; oud.divisions = oud.divisions.slice(1); oud.arcs = [{id: "hostile_bid", stage: 1, next_in: 2}]; oud.flags.wacht_op_speler_hostile_bid = true;
    migrate(oud); const terug = oud.divisions.find(d => (d.name || d.type) === (weg.name || weg.type)); return {terug: !!terug, n: oud.divisions.length === n0, arc: oud.arcs.some(a => a.id === "hostile_bid"), wacht: !!oud.flags.wacht_op_speler_hostile_bid, start: ARCS.hostile_bid.start}; });
  ok(ov.terug && ov.n && !ov.arc && !ov.wacht && ov.start === 0, "overnamebod weg; verloren divisie komt terug met haar producten: " + JSON.stringify(ov));
  const hb = await p.evaluate(async () => { const s = G.game, d = s.divisions[0], nm = divNaam(d), n0 = s.producten.filter(x => x.divisie === nm).length; await Store.backup();
    s.divisions = s.divisions.filter(x => x !== d); s.producten = s.producten.filter(x => x.divisie !== nm); s.hostile_bid = {uitslag: "verloren"}; delete s.flags.overname_herstel_478;
    const r = await Store.herstelOvername(); const terug = s.divisions.some(x => divNaam(x) === nm), n1 = s.producten.filter(x => x.divisie === nm).length, tweede = await Store.herstelOvername(); return {r, terug, n0, n1, tweede}; });
  ok(hb.terug && hb.n1 === hb.n0 && hb.n0 > 0 && hb.r && hb.r.length === 1 && hb.tweede === null, "verloren divisie komt met al haar producten terug uit de back-up, maar één keer: " + JSON.stringify(hb));
  // 4.7.9/4.7.10: eenmalige reparaties van één save zijn in 7.0 uit de engine gehaald, en hun tests ook
  const od = await p.evaluate(() => { const s = G.game, d = s.divisions[0], q = mkProduct(s, d, "Ordertank", 3, 60); Object.assign(q, {aard: "wapen", schaal: "vlag"}); const echt = window.kansRol;
    window.kansRol = () => 0; const ctx = Ctx(), a = orderOmzet(s, ctx, q, 3); window.kansRol = () => 0.9; const b2 = orderOmzet(s, Ctx(), q, 3); window.kansRol = echt;
    return {met: Math.round(a * 10) / 10, zonder: b2, orders: (q.orders || []).length, stuks: (q.orders || [{}])[0].stuks, melding: ctx.rep.join(" ")}; });
  ok(od.met === 10 && od.zonder === 0 && od.orders === 1 && od.stuks >= 1 && /Order:/.test(od.melding), "orders: met een order de omzet van ±3 maanden in één keer, zonder order niets (vaste kans): " + JSON.stringify(od));
  // 5.1 huisstijl
  const hs = await p.evaluate(async () => { const r1_ = await API["/api/huisstijl"]({kleur: "#ffaa00", accent: "#00ff88", thema: "terminal", logo: {soort: "gen", symbool: "☢", vorm: "schild"}});
    S.view = "bedrijf"; S.hsOpen = true; render(); const css = getComputedStyle(document.documentElement), cyan = css.getPropertyValue("--cyan").trim(), bg = css.getPropertyValue("--bg").trim(), kop = !!document.querySelector(".brand .brandlogo svg"), kaart = !!document.querySelector(".huisstijl svg");
    const png = "data:image/png;base64," + btoa("x".repeat(60)), r2 = await API["/api/huisstijl"]({logo: {soort: "png", data: png}}), r3 = await API["/api/huisstijl"]({logo: {soort: "png", data: "javascript:alert(1)"}}), r4 = await API["/api/huisstijl"]({kleur: "rood"});
    render(); const img = !!document.querySelector(".brand .brandlogo img"); return {ok: r1_.ok, cyan, bg, kop, kaart, png: r2.ok, slecht: r3.ok, kleurBlijft: G.game.huisstijl.kleur, img, thema: G.game.huisstijl.thema}; });
  ok(hs.ok && hs.cyan === "#ffaa00" && hs.bg === "#020a04" && hs.kop && hs.kaart && hs.png && hs.slecht === false && hs.kleurBlijft === "#ffaa00" && hs.img, "huisstijl: kleuren en thema in het scherm, logo in de kopregel, PNG ja, onzin nee: " + JSON.stringify(hs));
  if (out){ await p.evaluate(async () => { await API["/api/huisstijl"]({logo: {soort: "gen", symbool: "☢", vorm: "schild"}}); S.view = "bedrijf"; S.hsOpen = true; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(200); await p.screenshot({path: out + "/huisstijl.png"}); }
  await p.evaluate(async () => { G.game.huisstijl = {}; render(); });
  // 5.2 autopilot
  const ap = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"); s.cash += 100; x.keuring = "nodig"; x.kanaal = "groothandel"; x.prijsF = 0.6; x.pop = 95; x.capExtra = -15; x.auto = {};
    await API["/api/product"]({soort: "auto", id: x.id, k: "prijs", aan: true}); await API["/api/product"]({soort: "auto", id: x.id, k: "cap", aan: true}); await API["/api/product"]({soort: "auto", id: x.id, k: "keuring", aan: true});
    const c0 = prodCap(s, x), v0 = Math.round(vraagNa(x)), ctx = Ctx(); autoTick(s, ctx, x); const best = besteprijs(s, x);
    const std = await API["/api/autostandaard"]({k: "prijs", aan: true}), nieuw = mkProduct(s, s.divisions[0], "Autonieuw", 3, 50); s.autoStandaard = {};
    return {aan: x.auto, keur: keurStatus(x), f: x.prijsF, c0, c1: prodCap(s, x), v0, melding: ctx.rep.join(" "), nieuw: nieuw.auto.prijs === true, std: std.ok}; });
  ok(ap.aan.prijs && ap.aan.cap && ap.aan.keuring && ap.keur === "bezig" && ap.f > 0.6 && ap.f <= 1.5 && ap.c1 > ap.c0 && /Autopilot/.test(ap.melding) && ap.nieuw, "autopilot: keuring aangevraagd, prijs omhoog naar de beste, capaciteit erbij bij uitverkocht, standaard voor nieuwe producten: " + JSON.stringify(ap));
  const ad = await p.evaluate(async () => { const s = G.game; s.cash += 200; const d = { name: "Autolab", type: s.divisions[0].type, level: 3, efficiency: 1 }; s.divisions.push(d);
    const r = await API["/api/autodev"]({divisie: "Autolab", aan: true, schaal: "groot"}); const ctx = Ctx(); autoDevTick(s, ctx); const n1 = s.producten.filter(x => x.divisie === "Autolab").length, sch = (s.producten.find(x => x.divisie === "Autolab") || {}).schaal;
    autoDevTick(s, Ctx()); const n2 = s.producten.filter(x => x.divisie === "Autolab").length; s.divisions = s.divisions.filter(x => x !== d); s.producten = s.producten.filter(x => x.divisie !== "Autolab"); return {ok: r.ok, n1, n2, sch, melding: ctx.rep.join(" ")}; });
  ok(ad.ok && ad.n1 === 1 && ad.n2 === 1 && ad.sch === "groot" && /Automatisch ontwikkelen/.test(ad.melding), "automatisch ontwikkelen: start één product op de gekozen schaal, niet twee tegelijk: " + JSON.stringify(ad));
  // 5.3 tijdlijn
  const tl = await p.evaluate(() => { const s = JSON.parse(JSON.stringify(G.game)); s.tijdlijnGehad = []; s.vraagBasis = {}; s.basisTot = []; s.nieuws = []; s.date = {year: 2020, month: 4};
    const ctx = Ctx(); tijdlijnTick(s, ctx); const wapen = s.vraagBasis.wapen, med = s.vraagBasis.medisch, fin = s.vraagBasis.financieel || 0, nieuws = ctx.rep.filter(x => /Wereld:/.test(x)); s.date = {year: 2023, month: 1}; tijdlijnTick(s, Ctx());
    return {wapen, med, fin, nieuws, medNa: s.vraagBasis.medisch, wapenNa: s.vraagBasis.wapen, aantal: s.tijdlijnGehad.length}; });
  ok(tl.wapen === 6 && tl.med === 8 && tl.fin === 0 && tl.nieuws.length === 1 && /Pandemie/.test(tl.nieuws[0]) && tl.medNa === 0 && tl.wapenNa === 20, "tijdlijn: oude gebeurtenissen stil verwerkt, de recente pandemie in het nieuws, tijdelijke trends lopen af, blijvende stapelen: " + JSON.stringify(tl));
  // 5.4 corpospanning
  const sp = await p.evaluate(() => { const s = JSON.parse(JSON.stringify(G.game)); s.spanning = {}; s.nieuws = []; s.date = {year: 2022, month: 2}; const ctx = Ctx(); spanningTick(s, ctx); const eu0 = s.spanning.Europa;
    const n = Object.keys(s.spanning).length; s.spanning.Europa = 49.95; const ctx2 = Ctx(); s.date = {year: 2022, month: 3}; spanningTick(s, ctx2); S.view = "wereld"; S.wtab = "spanning"; render(); const kaart = /Corpospanning/.test(document.querySelector("main").textContent);
    return {n, eu0, fase: spanningFase(s.spanning.Europa)[1], melding: ctx2.rep.join(" "), kaart, gem: Math.round(spanningGem(s))}; });
  ok(sp.n === 7 && sp.eu0 >= 20 && sp.kaart && (sp.fase === "Sancties" ? /Sancties/.test(sp.melding) : true), "corpospanning: elk continent een waarde, oorlog in Europa telt mee, nieuwe fase in het nieuws, tabblad Corpospanning: " + JSON.stringify(sp));
  await p.evaluate(() => { S.view = "bedrijf"; render(); });
  // 7. scherm
  await p.evaluate(() => { S.view = "bedrijf"; render(); }); const ds = await p.$('[data-a=prodsheet]'); if (ds){ await ds.click(); await p.waitForTimeout(200); }
  const scherm = await p.evaluate(() => { const el = document.querySelector(".prodblad"); return el ? el.textContent : ""; });
  await p.click('[data-a=prodtab][data-t=verkoop]'); await p.waitForTimeout(150); const verkoop = await p.evaluate(() => document.querySelector(".prodblad").textContent);
  // 5.5 straatoorlog en corpomacht
  await p.evaluate(() => { window.__echt5 = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 5; return a; }; }); // dubbel zes: gelukt
  const cm = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); for (const k of CONTINENTS) (c.spanning ??= {})[k.naam] = 40; c.cash = 500; c.invloed = 100; c.patrouille = {}; c.wetten = {};
    const thuis = c.districts.find(d => d.id === c.player.home_district), te = actCorpo(c, ctx, "patrouille", thuis.id);
    for (const k of CONTINENTS) c.spanning[k.naam] = 75; const m0 = playerPower(c), pa = actCorpo(c, ctx, "patrouille", thuis.id), m1 = playerPower(c);
    const r = c.rivals[0], nb = c.districts.find(d => (thuis.neighbors || []).includes(d.id) && d.id !== r.hq && d.control !== "player"); let straat = null;
    if (nb){ nb.control = r.name; const k = straatKans(c, nb), doel = straatDoelen(c).includes(nb), res = actCorpo(c, ctx, "straat", nb.id); straat = {doel, kans: k, ok: res.ok, van: nb.control}; }
    const h0 = spanningHeat(c); c.defensie = 6; const w1 = actCorpo(c, ctx, "wet", "immuniteit"), w2 = actCorpo(c, ctx, "wet", "rechtspraak"), h1 = spanningHeat(c);
    const kort = actCorpo(c, ctx, "wet", "zone");
    return {te: te.ok, pa: pa.ok, n: patrouilles(c).length, m0, m1, straat, w1: w1.ok, w2: w2.ok, w2msg: w2.msg, dh: Math.round((h1 - h0) * 10) / 10, wetten: Object.keys(c.wetten), inv: c.invloed}; });
  await p.evaluate(() => { crypto.getRandomValues = window.__echt5; });
  const cmUI = await p.evaluate(() => { const oud = G.game.spanning; G.game.spanning = Object.fromEntries(CONTINENTS.map(k => [k.naam, 75])); S.view = "wereld"; S.wtab = "spanning"; render(); const t = document.querySelector("main").textContent; G.game.spanning = oud; render(); return /Corpomacht/.test(t) && /Privébeveiligingswet/.test(t) && /PATROUILLES/.test(t); });
  ok(!cm.te && cm.pa && cm.n === 1 && cm.m1 === cm.m0 + 2 && (!cm.straat || (cm.straat.doel && cm.straat.ok && cm.straat.van === "player")) && cm.w1 && !cm.w2 && /90/.test(cm.w2msg) && cm.dh === 0.8 && cm.wetten.includes("zone") && cmUI,
    "straatoorlog en corpomacht: patrouille pas bij genoeg spanning, macht +2, straatgevecht verovert een district, corpowetten met drempels, tab toont Corpomacht: " + JSON.stringify(cm));
  const ct = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); for (const k of CONTINENTS) (c.spanning ??= {})[k.naam] = 80; const r = c.rivals[0]; r.status = "vrede"; r.relatie = -60; const hq = c.districts.find(d => d.id === r.hq), buur = c.districts.find(d => (hq.neighbors || []).includes(d.id) && d.id !== c.player.home_district); if (buur) buur.control = "player";
    const kand = playerDistricts(c).filter(d => d.id !== c.player.home_district && reachable(c, r.name, d)); const adv = adviezen(c, true).some(x => /op straat innemen/.test(x.tekst)); const oud = window.kansRol; window.kansRol = () => 0; corpoTick(c, ctx); window.kansRol = oud;
    return {kand: kand.length, adv, rep: ctx.rep.filter(x => /straat|Straat/.test(x))}; });
  ok((ct.kand === 0) || (ct.kand >= 1 && ct.adv && ct.rep.length === 1), "rivalen vechten bij hoge spanning ook op straat (hooguit één per maand), Wat nu? waarschuwt: " + JSON.stringify(ct));
  // 5.6 gebied als dominantie
  const dm = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 900; c.aanwezig = {}; c.rivAanwezig = {}; for (const d of c.districts){ delete d.dom; delete d.domMnd; delete d.domRiv; }
    domTick(c, ctx); const thuis = c.districts.find(d => d.id === c.player.home_district), thuisPct = Math.round(thuis.dom.player), cont0 = (regionDominance(c).find(r => r.id === thuis.continent).shares.find(x => x.o === "player") || {}).pct || 0;
    const nb = c.districts.find(d => (thuis.neighbors || []).includes(d.id) && d.control === "neutral"); if (!nb) return {geenBuur: true, thuisPct};
    for (const g of c.gangs || []) if (g.gebied) delete g.gebied[nb.id]; for (const q of c.rivals) q.producten = []; c.contractHist = []; c.vestiging = {}; /* 11.0: zonder concurrentie in dat land, zodat de test niet van de wereld afhangt */ const kaal = campagneStap(c, nb); c.contracten = [...(c.contracten || []), {cont: nb.continent, over: 24, perMaand: 6, klant: "Test", id: "tst"}]; /* 11.0: een contract daar geeft wortels */ zetVestiging(c, "player", nb.id); const k0 = c.cash, a1 = actAanwezig(c, ctx, nb.id); for (let i = 0; i < 7; i++) actAanwezig(c, ctx, nb.id); const betaald = Math.round((k0 - c.cash) * 10) / 10;
    const ver = c.districts.find(d => d.control === "neutral" && !reachable(c, "player", d)), nee = ver ? actAanwezig(c, ctx, ver.id).ok : false;
    const pcts = []; let m = 0; for (; m < 8 && nb.control !== "player"; m++){ domTick(c, ctx); pcts.push(Math.round(nb.dom.player)); if (nb.control !== "player") actAanwezig(c, ctx, nb.id); } /* 11.0: elke maand blijven werken */
    const cont1 = (regionDominance(c).find(r => r.id === thuis.continent).shares.find(x => x.o === "player") || {}).pct || 0;
    const geenKoop = actDiplo(c, ctx, (c.rivals[0] || {}).name, "koop", {district: (c.districts.find(d => d.control === (c.rivals[0] || {}).name && d.id !== c.rivals[0].hq) || {}).id});
    return {thuisPct, cont0, cont1, a1: a1.ok, betaald, kost: aanwezigKost(c, nb), nee, van: nb.control, maanden: m, pcts, melding: ctx.rep.filter(x => /dominantie/.test(x)), ink: aandeelInkomen(c), kaal, maxCamp: Math.max(...Object.values(c.aanwezig || {}), 0), geenKoop: geenKoop && !geenKoop.ok}; });
  const dmUI = await p.evaluate(() => { const thuis = G.game.player.home_district; S.view = "kaart"; S.dist = thuis; S.zone = null; render(); const t = document.querySelector("main").textContent; S.dist = null; render(); return /DOMINANTIE IN DIT DISTRICT/.test(t); });
  ok(dm.geenBuur ? dm.thuisPct >= 40 : (dm.thuisPct >= 40 && dm.a1 && dm.betaald > 0 && !dm.nee && dm.van === "player" && dm.maanden <= 7 && dm.melding.length === 1 && dm.cont1 > dm.cont0 && dm.kaal <= 12 && dm.maxCamp <= 40 && dm.geenKoop) && dmUI,
    "gebied als dominantie (11.0: een vestiging is een basis, campagnes versterken, kopen kan niet): aandelen per district, neutraal district valt je toe na twee maanden boven 55%, continent telt aandelen, kaart toont dominantie: " + JSON.stringify(dm));
  // 5.7 elk spel een nieuwe wereld
  const wz = await p.evaluate(() => { const set = {...S.setup, corp_name: "Zaad BV", doctrine: ["Biotech"], home: "BNL"}, sig = s => JSON.stringify([s.rivals.map(r => [r.name, r.ceo, r.karakter, r.hq]), s.bedrijven.map(b => [b.naam, b.land])]);
    const a = newGame({...set, zaad: "neon-77"}).s, b = newGame({...set, zaad: "NEON77"}).s, c = newGame({...set, zaad: "ANDERS1"}).s, d = newGame(set).s, e = newGame(set).s;
    const namen = a.rivals.map(r => r.name), kar = a.rivals.every(r => RIVAAL_KARAKTER[r.karakter]);
    return {zaad: a.zaad, gelijk: sig(a) === sig(b), anders: sig(a) !== sig(c), auto: d.zaad && d.zaad.length === 6 && d.zaad !== e.zaad, autoAnders: sig(d) !== sig(e), uniek: new Set(namen).size === namen.length, kar, namen, randomNa: Math.random !== RNG ? "fout" : "ok"}; });
  ok(wz.zaad === "NEON77" && wz.gelijk && wz.anders && wz.auto && wz.autoAnders && wz.uniek && wz.kar && wz.randomNa === "ok", "elk spel een nieuwe wereld: zelfde zaad = zelfde rivalen, CEO's, karakters en bedrijven; ander of geen zaad = andere wereld: " + JSON.stringify(wz));
  // 5.8 assistenten
  const as = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 500; c.taken = {}; c.npcs = c.npcs.filter(n => !/verkoop|\bhr\b/i.test(n.role));
    const zonder = actTaak(c, ctx, "prijzen", true).ok, h1 = actAannemen(c, ctx, "Verkoopchef"), dubbel = actAannemen(c, ctx, "Verkoopchef").ok, vc = c.npcs.find(n => n.role === "Verkoopchef"); vc.loyalty = 70;
    const met = actTaak(c, ctx, "prijzen", true).ok, pm = c.producten.find(x => x.status === "markt"); let prijsVoor = null, prijsNa = null;
    if (pm){ actPrijs(c, pm.id, 0.6); prijsVoor = prijsF(pm); }
    actAannemen(c, ctx, "HR-manager"); c.npcs.find(n => n.role === "HR-manager").loyalty = 70; actTaak(c, ctx, "werven", true); c.staff.count = Math.max(5, staffNeed(c) - 10); const st0 = c.staff.count;
    assistentTick(c, ctx); if (pm) prijsNa = prijsF(pm); const st1 = c.staff.count;
    const cfo = taakDoener(c, "facturen"); cfo.loyalty = 70; actTaak(c, ctx, "facturen", true); c.auto_pay = false; c.invoices = [{id: "t1", payee: "Testleverancier", amount: 5, due_in: 1, overdue: 0, auto_pay: false, note: "", soort: "vast"}]; const ctx2 = Ctx(); invoicesTick(c, ctx2, 1);
    const betaald = !c.invoices.some(x => x.id === "t1"), cfoRep = ctx2.rep.filter(x => x.startsWith(cfo.name));
    vc.loyalty = 10; const oud = window.kansRol; window.kansRol = () => 0; const ctx3 = Ctx(); assistentTick(c, ctx3); window.kansRol = oud;
    return {zonder, h1: h1.ok, talent: vc.talent, loon: vc.loon, dubbel, met, prijsVoor, prijsNa, st0, st1, betaald, cfoRep, liggen: ctx3.rep.some(x => /liet/.test(x)), loonTot: directieLoon(c)}; });
  const asUI = await p.evaluate(() => { S.view = "mensen"; render(); const t = document.querySelector("main").textContent; return /Assistenten/.test(t) && /Facturen betalen/.test(t) && /Verkoopchef aannemen/.test(t); });
  ok(!as.zonder && as.h1 && as.talent >= 2 && as.loon > 0 && !as.dubbel && as.met && (as.prijsVoor == null || as.prijsNa !== as.prijsVoor) && as.st1 > as.st0 && as.betaald && as.cfoRep.length === 1 && as.liggen && as.loonTot > 0 && asUI,
    "assistenten: aannemen met talent en loon, taken delegeren (prijzen, werven, facturen), lage loyaliteit laat liggen, Mensen toont Assistenten: " + JSON.stringify(as));
  // 5.9 klanten komen naar jou
  await p.evaluate(() => { window.__echt9 = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 5; return a; }; });
  const kl = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.aanvragen = []; c.contracten = []; c.cash = 300;
    const oud = window.kansRol; window.kansRol = () => 0; aanvraagTick(c, ctx); window.kansRol = oud; const n1 = c.aanvragen.length, a0 = c.aanvragen[0];
    if (a0) a0.minKwal = 1; c.reputation = 40; const k = a0 ? [aanvraagKans(c, a0, "laag"), aanvraagKans(c, a0, "normaal"), aanvraagKans(c, a0, "hoog")] : [];
    const e = maakAanvraag(c); delete e.pakket; delete e.wens; for (const r of c.rivals) r.producten = (r.producten || []).filter(x => x.aard !== e.aard); e.raam = false; e.bedrag = 10; e.minKwal = 1; delete e.maanden; delete e.perMaand; e.soort = "staat"; c.aanvragen.push(e); const cash0 = c.cash, r1 = actAanvraag(c, ctx, e.id, "normaal"), winst = Math.round((c.cash - cash0) * 10) / 10;
    const f = maakAanvraag(c); delete f.pakket; f.raam = true; f.maanden = 6; f.perMaand = 4; delete f.bedrag; f.soort = "staat"; f.minKwal = 1; c.aanvragen.push(f); actAanvraag(c, ctx, f.id, "hoog"); const con = c.contracten.find(x => x.id === f.id);
    const cash1 = c.cash; window.kansRol = () => 0.99; aanvraagTick(c, Ctx()); const maand = Math.round((c.cash - cash1) * 10) / 10;
    for (const p of c.producten) if ((p.aard || aardVan(p.type, p.naam)) === f.aard) p.status = "teruggeroepen"; const rep0 = c.reputation; const ctx4 = Ctx(); aanvraagTick(c, ctx4); window.kansRol = oud;
    return {n1, k, r1: r1.ok, winst, con: con ? {perMaand: con.perMaand, over: con.over} : null, maand, verbroken: ctx4.rep.some(x => /verbroken/.test(x)), repDaling: Math.round((rep0 - c.reputation) * 10) / 10, over: c.contracten.length}; });
  await p.evaluate(() => { crypto.getRandomValues = window.__echt9; });
  const klUI = await p.evaluate(() => { const s = G.game, a = maakAanvraag(s); (s.aanvragen ??= []).push(a); S.view = "contracten"; render(); const t = document.querySelector("main").textContent; s.aanvragen = s.aanvragen.filter(x => x !== a); render(); return /Open aanvragen/.test(t) && /Scherp/.test(t) && /Afwijzen/.test(t); });
  ok(kl.n1 >= 1 && kl.k[0] > kl.k[2] && kl.k[0] >= kl.k[1] && kl.k[1] >= kl.k[2] && kl.r1 && kl.winst === 4.5 && kl.con && kl.con.perMaand === 4.8 && kl.maand === 2.2 && kl.verbroken && kl.repDaling >= 5 && kl.over === 0 && klUI,
    "klanten komen naar jou: aanvraag verschijnt, scherp geeft meer kans dan hoog, levering betaalt 45% marge, raamcontract betaalt elke maand, zonder product verbroken met boete, kaart op Bedrijf: " + JSON.stringify(kl));
  // 5.10 export en vergunningen
  const ex = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 500; c.exportVergunning = {}; c.smokkelroute = {}; const pm = c.producten.find(x => x.status === "markt"); if (!pm) return {geen: true}; pm.aard = "wapen";
    const thuis = exportThuis(c), ander = CONTINENTS.find(k => k.naam !== thuis).naam; for (const k of CONTINENTS) (c.spanning ??= {})[k.naam] = 20;
    const e0 = exportExtra(c, pm, 10), thuisNee = actExport(c, ctx, "vergunning", thuis).ok, k1 = vergunningKost(c), v = actExport(c, ctx, "vergunning", ander).ok, k2 = vergunningKost(c), e1 = exportExtra(c, pm, 10);
    c.spanning[ander] = 60; const e2 = exportExtra(c, pm, 10), sm = actExport(c, ctx, "smokkel", ander).ok, e3 = exportExtra(c, pm, 10); c.spanning[ander] = 95; const e4 = exportExtra(c, pm, 10);
    pm.aard = "medisch"; const e5 = exportExtra(c, pm, 10);
    return {e0, thuisNee, k1, k2, v, e1, e2, sm, e3, e4, e5}; });
  const exUI = await p.evaluate(() => { const s = G.game, pm = s.producten.find(x => x.status === "markt"); if (!pm) return true; const oud = pm.aard; pm.aard = "wapen"; S.view = "bedrijf"; render(); const t = document.querySelector("main").textContent; pm.aard = oud; render(); return /Export/.test(t) && /Vergunning ·/.test(t); });
  ok(ex.geen || (ex.e0.legaal === 0 && !ex.thuisNee && ex.v && ex.k2 > ex.k1 && Math.abs(ex.e1.legaal - 0.6) < 1e-9 && ex.e2.legaal === 0 && ex.e2.zwart === 0 && ex.sm && Math.abs(ex.e3.zwart - 0.48) < 1e-9 && ex.e3.heat === 0.3 && Math.abs(ex.e4.legaal - 0.6) < 1e-9 && ex.e5.legaal === 0) && exUI,
    "export: vergunning per continent +6%, duurder per vergunning, embargo bij spanning 50-89 tenzij smokkelroute (zwart, heat), alleen wapens/beveiliging/implantaten, kaart op Bedrijf: " + JSON.stringify(ex));
  // 5.11 regionale markten
  const rg = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); delete c.regioVraag; regioTick(c); const pm = c.producten.find(x => x.status === "markt"); if (!pm) return {geen: true}; delete pm.markten;
    const een = Object.values(c.regioVraag).every(v => Object.values(v).every(x => x === 1)); const oudP = pm.prijsF; pm.prijsF = 1; const f1 = regioF(c, pm);
    pm.prijsF = 1.5; const f15 = regioF(c, pm); const D = regioDelen(c, pm), naRijk = D.find(x => x.c === "Noord-Amerika").tol, afr = D.find(x => x.c === "Afrika").tol;
    pm.prijsF = 1; c.regioVraag["Afrika"][pm.aard || aardVan(pm.type, pm.naam)] = 0.3; const voor = regioF(c, pm), r1 = actRegio(c, pm.id, "Afrika"), na = regioF(c, pm), mk = (pm.markten || []).length;
    for (const k of regioNamen()) if (k !== "Europa" && regioMarkten(pm).includes(k)) actRegio(c, pm.id, k); const laatste = actRegio(c, pm.id, "Europa").ok, nu = regioMarkten(pm);
    for (const k of regioNamen()) if (!regioMarkten(pm).includes(k)) actRegio(c, pm.id, k); const terug = pm.markten == null;
    const n = newGame({...S.setup, corp_name: "Regio BV", doctrine: ["Biotech"], home: "BNL", zaad: "REGIO1"}).s, varieert = new Set(Object.values(n.regioVraag).map(v => v.medisch)).size > 1;
    return {een, f1: Math.round(f1 * 1000) / 1000, f15: Math.round(f15 * 100) / 100, naRijk, afr, voor: Math.round(voor * 1000) / 1000, na: Math.round(na * 1000) / 1000, r1: r1.ok, mk, laatste, nu, terug, varieert}; });
  const rgUI = await p.evaluate(() => { const pm = G.game.producten.find(x => x.status === "markt"); if (!pm) return true; S.view = "bedrijf"; S.prodSheet = pm.id; (S.prodTab ??= {})[pm.id] = "markt"; render(); return /REGIO'S/.test(document.querySelector("main").textContent); });
  ok(rg.geen || (rg.een && rg.f1 === 1 && rg.f15 > 0.9 && rg.f15 < 1.1 && rg.naRijk > 1 && rg.afr < 1 && rg.r1 && rg.mk === 6 && rg.na > rg.voor && !rg.laatste && rg.nu.length === 1 && rg.terug && rg.varieert), "regionale markten: neutraal ×1 bij alles verkopen, rijk/arm per prijs, slechte regio laten vallen loont door focus, minstens één markt, nieuw spel varieert per continent: " + JSON.stringify(rg) + " ui " + rgUI);
  // 5.12 toelevering en voorraad
  const gs = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); delete c.grondstof; delete c.gsSchok; c.voorraad = {}; c.cash = 900; for (const k of CONTINENTS) (c.spanning ??= {})[k.naam] = 20;
    const pm = c.producten.find(x => x.status === "markt"); if (!pm) return {geen: true}; pm.aard = "wapen"; delete pm.matF; const kf0 = kostFactor(pm);
    grondstofTick(c, Ctx()); const p0 = gsPrijs(c, "chips"); c.date = {year: 2020, month: 9}; const ctx = Ctx(); grondstofTick(c, ctx); const pS = gsPrijs(c, "chips");
    for (let i = 0; i < 6; i++){ c.date.month = 10 + (i % 2); grondstofTick(c, Ctx()); } const pNa = gsPrijs(c, "chips");
    c.spanning["Azië"] = 95; for (let i = 0; i < 25; i++) grondstofTick(c, Ctx()); const staal = gsPrijs(c, "staal"), mf = pm.matF, kf1 = kostFactor(pm);
    (c.prodomzet ??= {})[pm.id] = 10; const k3 = voorraadKost(c, "staal", 3), cash0 = c.cash, v = actVoorraad(c, Ctx(), "staal", 3), betaald = Math.round((cash0 - c.cash) * 10) / 10, mfV = pm.matF, te = actVoorraad(c, Ctx(), "staal", 12).ok && actVoorraad(c, Ctx(), "staal", 12).ok;
    const c2 = JSON.parse(JSON.stringify(c)); c2.voorraad = {staal: {mnd: 3, prijs: 1}}; for (let i = 0; i < 3; i++) grondstofTick(c2, Ctx()); const op = !(c2.voorraad || {}).staal;
    return {p0, pS, pNa, staal, mf, kf0: Math.round(kf0 * 100) / 100, kf1: Math.round(kf1 * 100) / 100, k3, betaald, v: v.ok, mfV, te, op}; });
  ok(gs.geen || (Math.abs(gs.p0 - 1) < 0.06 && gs.pS > gs.p0 && gs.pNa > gs.p0 && gs.staal > 1.3 && gs.kf1 > gs.kf0 && gs.v && gs.betaald === gs.k3 && gs.mfV < gs.mf && !gs.te && gs.op), "toelevering: grondstof rond ×1, chiptekort 2020, spanning op het broncontinent maakt duurder en kost meer, voorraad betaalt vooruit en verlaagt de kosten, max 24 mnd, raakt op: " + JSON.stringify(gs));
  // 5.13 patenten en namaak
  const pt = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 500; c.keuzes = []; c.rivaalPatent = {}; c.flags = {...c.flags}; const pm = c.producten.find(x => x.status === "markt"); if (!pm) return {geen: true};
    delete pm.patent; pm.kwaliteit = 5; pm.nadruk = 0; const aard = pm.aard || aardVan(pm.type, pm.naam), b = besteSpec(pm); if (b.v < PATENT_MIN) return {laag: b};
    const w0 = prodGewicht(pm, c), r = actPatent(c, ctx, pm.id), w1 = prodGewicht(pm, c), dubbel = actPatent(c, ctx, pm.id).ok;
    const riv = c.rivals[0]; riv.producten = [...(riv.producten || []), {naam: "Kopie", aard, kwaliteit: 3, pop: 40}];
    const cash0 = c.cash, oud = window.kansRol; let i = 0; window.kansRol = () => (i++ === 0 ? 0 : 0.99); const ctx2 = Ctx(); patentTick(c, ctx2); window.kansRol = oud;
    const lic = Math.round((c.cash - cash0) * 10) / 10, k = c.keuzes.find(x => x.soort === "patent_" + pm.id);
    if (k) actKeuze(c, Ctx(), k.id, 2); const naNegeren = patentF(c, pm);
    const q = c.producten.find(x => x !== pm && x.status === "markt") || pm; const a2 = q.aard || aardVan(q.type, q.naam); delete q.patent; c.rivaalPatent[a2] = {rival: riv.name, tot: "2099-01"}; const metRiv = q === pm ? null : patentF(c, q), beschermd = eigenPatentIn(c, a2);
    c.flags["patentweg_" + a2] = true; patentTick(c, Ctx()); const weg = !c.rivaalPatent[a2]; const q2 = {...pm, id: "pq2", aard: "wapen"}; delete q2.patent; c.rivaalPatent.wapen = {rival: riv.name, tot: "2099-01"}; const wp = patentF(c, q2);
    return {r: r.ok, w: Math.round(w1 / w0 * 100) / 100, dubbel, lic, keuze: !!k, opties: k && k.opties.map(o => o.label), naNegeren, metRiv, beschermd, weg, wp}; });
  const ptUI = await p.evaluate(() => { const pm = G.game.producten.find(x => x.status === "markt"); if (!pm) return true; S.view = "bedrijf"; S.prodSheet = pm.id; (S.prodTab ??= {})[pm.id] = "markt"; render(); return /PATENT/.test(document.querySelector("main").textContent); });
  ok(pt.geen || pt.laag || (pt.r && pt.w === 1.08 && !pt.dubbel && pt.lic >= 0.2 && pt.keuze && pt.opties.length === 3 && pt.naNegeren === 1 && (pt.metRiv == null || pt.metRiv === (pt.beschermd ? 1 : 0.95)) && pt.weg && pt.wp === 0.95) && ptUI, "patenten: +8% omzet, licentiegeld, namaak als keuze (negeren = een jaar geen voordeel), rivaalpatent −5% tot vernietigd: " + JSON.stringify(pt));
  // 5.14 onderzoek
  const oz = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 900; c.onderzoek = {niveau: {}}; const pm = c.producten.find(x => x.status === "markt"); if (!pm) return {geen: true}; delete pm.tech; const aard = pm.aard || aardVan(pm.type, pm.naam);
    const w0 = prodGewicht(pm, c), kf0 = kostFactor(pm), sp0 = prodSpecs(pm).map(x => x.v);
    if (!onderzoekMag(c, aard)) return {geen: true}; window.__oz = crypto.getRandomValues; crypto.getRandomValues = x => { x[0] = 5; return x; };
    const r1 = actOnderzoek(c, ctx, aard), dubbel = actOnderzoek(c, ctx, "wapen").ok, m = c.onderzoek.lopend.maanden, cash0 = c.cash; for (let i = 0; i < m; i++) onderzoekTick(c, Ctx()); crypto.getRandomValues = window.__oz;
    const betaald = Math.round((cash0 - c.cash) * 10) / 10, n1 = techNiveau(c, aard), w1 = prodGewicht(pm, c);
    c.onderzoek.niveau[aard] = 3; onderzoekTick(c, Ctx()); const kf3 = kostFactor(pm), sp3 = prodSpecs(pm).map(x => x.v), vol = actOnderzoek(c, ctx, aard).ok;
    const r = c.rivals[0]; r.tech = {[SECTOR_AARD[r.sector] || "consument"]: 2}; const rp = mkRivalProduct(c, r, SECTOR_AARD[r.sector] || "consument");
    actOnderzoek(c, ctx, "wapen"); const stop = actOnderzoekStop(c).ok && !c.onderzoek.lopend;
    return {r1: r1.ok, dubbel, m, betaald, kost: techKost(c, 1, aard), n1, w: Math.round(w1 / w0 * 100) / 100, kf: Math.round(kf3 / kf0 * 100) / 100, spec: sp3.every((v, i) => v >= sp0[i]) && sp3.some((v, i) => v > sp0[i]), vol, rpKw: rp.kwaliteit, stop}; });
  const ozUI = await p.evaluate(() => { S.view = "bedrijf"; S.ozOpen = true; render(); const t = document.querySelector("main").textContent; S.ozOpen = false; render(); return /Onderzoek/.test(t) && /mnd ×/.test(t); });
  ok(oz.geen || (oz.r1 && !oz.dubbel && Math.abs(oz.betaald - oz.kost) < 0.5 && oz.n1 === 1 && oz.w === 1.05 && oz.kf < 1 && oz.spec && oz.vol && oz.rpKw >= 2 && oz.stop) && ozUI, "onderzoek: één tegelijk, per maand betaald, niveau 1 +5% omzet, niveau 2 goedkoper, niveau 3 betere eigenschappen, daarna kan niveau 4, rivalen beter, stoppen kan: " + JSON.stringify(oz));
  // 5.15 financiën en beurs
  const fb = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.reputation = 50; c.heat = 5; c.leningen = []; delete c.beurs; c.keuzes = []; c.cash = 100;
    const cap0 = loanCap(c), cash0 = c.cash, t = actTermijn(c, ctx, 60, 24), cap1 = loanCap(c), w0 = bedrijfWaarde(c); let betaald = 0; for (let i = 0; i < 24; i++) betaald += termijnTick(c);
    const klaar = !(c.leningen || []).length, rente = Math.round((betaald - 60) * 10) / 10, fout = actTermijn(c, ctx, 60, 36).ok;
    const ipoNee = actBeurs(c, ctx, "ipo", 20).ok; c.cash = 900; const V = bedrijfWaarde(c), pv0 = playerValue(c), ipo = actBeurs(c, ctx, "ipo", 20), V1 = bedrijfWaarde(c), pv1 = playerValue(c);
    const u1 = actBeurs(c, ctx, "uitgeven", 10).ok, u2 = actBeurs(c, ctx, "uitgeven", 10).ok, u3 = actBeurs(c, ctx, "uitgeven", 10).ok, pub = c.beurs.publiek, tk = actBeurs(c, ctx, "terugkopen", 10).ok, pub2 = c.beurs.publiek;
    c.date = {year: 2010, month: 6}; beursTick(c, ctx); const ava = c.keuzes.some(k => /^ava_/.test(k.soort));
    return {t: t.ok, lening: Math.round((c.cash - cash0) * 10) / 10, cap0, cap1, klaar, rente, fout, ipoNee, V, pv0, V1, pv1, ipo: ipo.ok, u1, u2, u3, pub, tk, pub2, ava}; });
  const fbUI = await p.evaluate(() => { S.view = "financien"; render(); const t = document.querySelector("main").textContent; return /Balans/.test(t) && /Termijnlening/.test(t) && /Beurs/.test(t) && /Kasstroom|Boekhouding/.test(t); });
  ok(fb.t && fb.cap1 < fb.cap0 && fb.klaar && fb.rente > 0 && fb.rente < 10 && !fb.fout && !fb.ipoNee && fb.pv0 === fb.V && fb.ipo && fb.V1 > fb.V && fb.pv1 < fb.pv0 && fb.u1 && fb.u2 && !fb.u3 && fb.pub === 40 && fb.tk && fb.pub2 === 30 && fb.ava && fbUI,
    "financiën en beurs: termijnlening met annuïteit (rente betaald, leenruimte lager), beursgang geeft geld maar jouw deel telt, max 49% publiek, terugkopen, aandeelhoudersvergadering in juni, scherm Financiën: " + JSON.stringify(fb));
  // 5.16 dashboard
  const db = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.divHist = {}; c.divomzet = {}; const pm = c.producten.find(x => x.status === "markt"); if (!pm) return {geen: true}; c.prodomzet = {[pm.id]: 3};
    divHistTick(c); c.prodomzet[pm.id] = 4.5; c.date = {...c.date, month: (c.date.month % 12) + 1}; divHistTick(c); const reeks = c.divHist[pm.divisie].map(x => x.o);
    c.history = [{m: "2009-11", omzet: 10, kosten: 8, netto: 2, cash: 50, waarde: 300}, {m: "2009-12", omzet: 12, kosten: 9, netto: 3, cash: 53, waarde: 320}, {m: "2010-01", omzet: 14, kosten: 10, netto: 4, cash: 57}];
    const J = jaarOverzicht(c); const top = rivaalTop(c, pm.aard || aardVan(pm.type, pm.naam));
    return {reeks, J, top: top.pop >= 0}; });
  const dbUI = await p.evaluate(() => { const s = G.game, oudH = s.divHist, oudHi = s.history; const d = divNaam(s.divisions[0]); s.divHist = {[d]: [{m: "a", o: 1}, {m: "b", o: 2}, {m: "c", o: 3}]}; s.history = [...(s.history || []), {m: "2005-01", omzet: 5, kosten: 4, netto: 1, cash: 10, waarde: 100}];
    S.view = "financien"; render(); const t = document.querySelector("main").textContent, svg = !!document.querySelector("main svg polyline"); s.divHist = oudH; s.history = oudHi; render(); return /Omzet per divisie/.test(t) && /Jaaroverzicht/.test(t) && svg; });
  ok(db.geen || (db.reeks.join() === "3,4.5" && db.J.length === 2 && db.J[0].jaar === "2010" && db.J[1].omzet === 22 && db.J[1].waarde === 320 && db.J[0].waarde == null && db.top) && dbUI, "dashboard: omzet per divisie per maand, jaaroverzicht per jaar (met waarde aan het eind), grafieken op Financiën: " + JSON.stringify(db));
  // 5.17 eigen plannen
  await p.evaluate(() => { window.__echt17 = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 5; return a; }; });
  const ep = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 500; c.eigenPlannen = []; const r = c.rivals[0], m = c.market[r.sector]; if (m) m.rivals[r.name] = 0.3; const rel0 = r.relatie;
    const kans = eigenPlanKans(c, "prijsoorlog", r.name), cash0 = c.cash, a = actEigenPlan(c, ctx, "prijsoorlog", r.name), betaald = Math.round((cash0 - c.cash) * 10) / 10, dubbel = actEigenPlan(c, ctx, "laster", r.name).ok;
    for (let i = 0; i < 3; i++){ (c.eigenPlannen[0] || {}).volgende = ym(c); eigenPlanTick(c, Ctx()); } const klaar = !c.eigenPlannen.length, aandeel = m ? Math.round(m.rivals[r.name] * 100) / 100 : null;
    return {kans, a: a.ok, betaald, kost: eigenPlanKost(c, "prijsoorlog"), dubbel, klaar, aandeel, relDaling: rel0 - r.relatie, geenBende: actEigenPlan(c, ctx, "uitroken", "bestaat-niet").ok}; });
  await p.evaluate(() => { crypto.getRandomValues = a => { a[0] = 0; return a; }; });
  const ep2 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 500; c.eigenPlannen = []; c.heat = 10; const r = c.rivals[1] || c.rivals[0], rel0 = r.relatie; actEigenPlan(c, ctx, "sabotage", r.name); c.eigenPlannen[0].volgende = ym(c); const ctx2 = Ctx(); eigenPlanTick(c, ctx2);
    return {weg: !c.eigenPlannen.length, heat: c.heat, rel: rel0 - r.relatie, rep: ctx2.rep.some(x => /ontdekt/.test(x))}; });
  await p.evaluate(() => { crypto.getRandomValues = window.__echt17; });
  const epUI = await p.evaluate(() => { S.view = "rivalen"; S.epOpen = true; render(); const t = document.querySelector("main").textContent; S.epOpen = false; render(); return /Zelf een plan smeden/.test(t) && /Prijsoorlog/.test(t); });
  ok(ep.kans >= 25 && ep.a && ep.betaald === ep.kost && !ep.dubbel && ep.klaar && (ep.aandeel == null || ep.aandeel === 0.24) && ep.relDaling >= 15 && !ep.geenBende && ep2.weg && ep2.heat >= 12 && ep2.rel >= 10 && ep2.rep && epUI,
    "eigen plannen: drie stappen met worpen, eerste stap vooraf betaald, één tegelijk, gelukte prijsoorlog kost hen 20% aandeel, mislukte stap = ontdekt (heat, relatie), kaart bij Rivalen: " + JSON.stringify([ep, ep2]));
  // 5.17.1 huisstijl bij het oprichten
  const hs1 = await p.evaluate(() => { const set = {...S.setup, corp_name: "Stijl BV", doctrine: ["Biotech"], home: "BNL", huisstijl: {kleur: "#123456", accent: "nee", thema: "bloed", logo: {soort: "gen", symbool: "◆", vorm: "cirkel"}}};
    const n = newGame(set).s, kaart = setupHuisstijl({corp_name: "Stijl BV", huisstijl: set.huisstijl});
    return {h: n.huisstijl, kaart: /Hoofdkleur/.test(kaart) && /THEMA/.test(kaart) && /LOGO/.test(kaart)}; });
  ok(hs1.h && hs1.h.kleur === "#123456" && !hs1.h.accent && hs1.h.thema === "bloed" && hs1.h.logo.vorm === "cirkel" && hs1.kaart, "huisstijl bij het oprichten: kleuren, thema en logo uit de setup komen in het spel (ongeldige kleur genegeerd): " + JSON.stringify(hs1));
  // 5.17.2 hoofdmenu
  const autoMenu = await p.evaluate(() => !!document.querySelector(".hmenu"));
  await p.evaluate(() => toonMenu()); await p.waitForTimeout(100);
  const mn1 = await p.evaluate(() => { const o = document.querySelector(".hmenu"); return o ? o.textContent : ""; });
  await p.click('.hmenu [data-a="menuladen"]'); await p.waitForTimeout(150);
  const mn2 = await p.evaluate(() => ({slots: document.querySelectorAll(".hmenu .hslots .opt").length, nu: /nu/.test((document.querySelector(".hmenu .hslots") || {}).textContent || "")}));
  await p.click('.hmenu .hknoppen > [data-a="menudoor"]'); await p.waitForFunction(() => !document.querySelector(".hmenu"), null, {timeout: 5000}).catch(() => {});
  const mn3 = await p.evaluate(() => ({weg: !document.querySelector(".hmenu"), open: S.menuOpen, sessie: sessionStorage.getItem("cl_menu")}));
  await p.evaluate(() => toonMenu()); await p.keyboard.press("Escape"); await p.waitForFunction(() => !document.querySelector(".hmenu"), null, {timeout: 5000}).catch(() => {}); const esc = await p.evaluate(() => !document.querySelector(".hmenu"));
  ok(!autoMenu && /Doorgaan/.test(mn1) && /Nieuw spel/.test(mn1) && /Laden/.test(mn1) && mn2.slots >= 1 && mn2.nu && mn3.weg && !mn3.open && mn3.sessie === "1" && esc, "hoofdmenu: Doorgaan, Nieuw spel, Laden met save slots; sluiten met Doorgaan of Escape; niet automatisch in tests: " + JSON.stringify({autoMenu, mn2, mn3, esc}));
  // 5.18 krant van de maand
  const krt = await p.evaluate(() => { const s = G.game, oud = s.nieuws; const nu = ym(s), r = s.rivals[0];
    s.nieuws = [{m: nu, kop: "Doorbraak bij jou", tekst: "x", regio: "", soort: "markt", jij: true}, {m: nu, kop: `${r.name} breidt uit`, tekst: "y", regio: "", soort: "markt", jij: false}, {m: nu, kop: "Staking in Europa", tekst: "z", regio: "Europa", soort: "wereld", jij: false}, {m: "1999-01", kop: "Oud nieuws", tekst: "", regio: "", soort: "wereld", jij: false}];
    const K = krantData(); S.view = "wereld"; S.wtab = "krant"; render(); const t = document.querySelector("main").textContent; S.view = "overzicht"; render(); const teaser = /Lees de krant/.test(document.querySelector("main").textContent); s.nieuws = oud; render();
    return {kop: K.kop.kop, riv: K.riv.map(n => n.kop), wereld: K.wereld.map(n => n.kop), oud: /Oud nieuws/.test(t), mast: /NEON NEWS 24/.test(t) && /Corpospanning/.test(t), teaser}; });
  ok(krt.kop === "Doorbraak bij jou" && krt.riv.length === 1 && krt.wereld[0] === "Staking in Europa" && !krt.oud && krt.mast && krt.teaser, "krant: kop uit je eigen nieuws, rubrieken rivalen/wereld, alleen recent nieuws, krant bij Wereld en een teaser op het overzicht: " + JSON.stringify(krt));
  // 5.19 de CEO als persoon
  const ce = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); delete c.ceo; c.cash = 300; const C = ceoInit(c, {ceo_naam: "Mira Kade"}); const naam0 = C.naam, l0 = C.leeftijd;
    C.stress = 80; const v = actCeo(c, ctx, "vakantie").ok, st1 = C.stress, nogeens = actCeo(c, ctx, "vakantie").ok;
    c.morale = 60; const m0 = c.morale; C.gezondheid = 0.1; C.stress = 90; C.opvolger = null; c.date = {...c.date, month: 5}; ceoTick(c, Ctx()); const zonder = {naam: C.naam, gen: C.generatie, morale: Math.round(m0 - c.morale)};
    C.kinderen = 1; const opv = actCeo(c, ctx, "opvolger", "kind0").ok; C.gezondheid = 0.1; C.stress = 90; ceoTick(c, Ctx()); const dyn = {naam: C.naam, gen: C.generatie, leeftijd: Math.floor(C.leeftijd)};
    const r = c.rivals[0]; r.relatie = 0; r.ceoRel = 0; delete r.golf; c.cash = 300; const rel0 = r.relatie, golf = actCeo(c, ctx, "golf", r.name).ok, band = r.ceoRel, relUp = r.relatie - rel0; r.ceoLeeftijd = 80; const oudCeo = r.ceo; c.date = {...c.date, month: 1}; ceoTick(c, Ctx());
    C.stress = 85; C.opvolger = null; C.leeftijd = 60; const adv = adviezen(c, true).map(x => x.tekst).join(" | "), advOk = /stress is 85/.test(adv) && /geen opvolger/.test(adv);
    return {naam0, l0, v, st1, nogeens, zonder, opv, dyn, golf, band, relUp, advOk, nieuweCeo: r.ceo !== oudCeo && r.ceoLeeftijd < 60}; });
  const ceUI = await p.evaluate(() => { S.view = "mensen"; render(); const t = document.querySelector("main").textContent; return /Jij, de CEO/.test(t) && /GEZONDHEID/.test(t) && /Andere CEO/.test(t); });
  ok(ce.naam0 === "Mira Kade" && ce.l0 >= 34 && ce.v && ce.st1 === 50 && !ce.nogeens && ce.zonder.naam !== "Mira Kade" && ce.zonder.gen === 2 && ce.zonder.morale >= 12 && ce.opv && / jr\.$/.test(ce.dyn.naam) && ce.dyn.gen === 3 && ce.dyn.leeftijd <= 34 && ce.golf && ce.band === 10 && ce.relUp === 4 && ce.nieuweCeo && ce.advOk && ceUI,
    "CEO als persoon: naam uit de setup, vakantie tegen stress, overlijden zonder opvolger = buitenstaander, met kind = dynastie, golfen met rivaal-CEO's, oude rivaal-CEO's worden vervangen: " + JSON.stringify(ce));
  // 5.20 eigen moeilijkheid
  const im = await p.evaluate(() => { const n = newGame({...S.setup, corp_name: "Moeilijk BV", doctrine: ["Biotech"], home: "BNL", inst_winst: "hoog", inst_chaos: "laag"}).s;
    const ww = winWaarde(n), basis = winWaardeVoor(n.player.lengte), sc0 = n.player.instelScore, m0 = score(n).mult;
    const a = actInstel(n, "heat", "hoog"), sc1 = instelScore(n.player.instel), b = actInstel(n, "heat", "laag"), scMin = n.player.instelScore, fout = actInstel(n, "heat", "extreem").ok;
    const oud = JSON.parse(JSON.stringify(G.game)); delete oud.player.instel; delete oud.player.instelScore;
    return {ww, basis, sc0, m0, a: a.ok, sc1, scMin, fout, oudInst: inst(oud, "heat"), oudMult: score(oud).mult === (SCORE_MULT[oud.player.difficulty] || 1)}; });
  const imUI = await p.evaluate(() => { S.view = "logboek"; S.instOpen = true; render(); const t = document.querySelector("main").textContent; S.instOpen = false; return /Eigen moeilijkheid/.test(t) && /Winstdrempel/.test(t); });
  ok(im.ww === Math.round(im.basis * 1.3 / 100) * 100 && im.sc0 === 1.02 && im.m0 === 1.02 && im.a && im.sc1 === 1.12 && im.scMin === 0.92 && !im.fout && im.oudInst === 1 && im.oudMult && imUI,
    "eigen moeilijkheid: winstdrempel en score-vermenigvuldiger volgen de schuiven, de laagste stand telt, oude saves ongewijzigd, kaart bij Logboek: " + JSON.stringify(im));
  // 5.21 spiekbriefje en rondleiding
  const sp21 = await p.evaluate(() => { const uit = {}; for (const v of ["overzicht", "bedrijf", "wereld", "kaart", "financien", "logboek"]){ S.view = v; render(); uit[v] = !!document.querySelector(`details.spiek[data-spiek="${v}"]`); } S.view = "overzicht"; render(); return uit; });
  await p.evaluate(() => { delete G.game.flags.tour; try { localStorage.removeItem("cl_tour_" + G.gid); } catch(e){} toonTour(0); }); await p.waitForTimeout(100);
  const t1 = await p.evaluate(() => ({titel: (document.querySelector(".tour h4") || {}).textContent, doel: !!document.querySelector(".tourdoel")}));
  for (let i = 0; i < 5; i++){ await p.click('.tour [data-a="tourvolgende"]'); await p.waitForTimeout(80); }
  const t2 = await p.evaluate(() => ({weg: !document.querySelector(".tour"), flag: G.game.flags.tour === true, geenDoel: !document.querySelector(".tourdoel"), nodig: tourNodig()}));
  ok(Object.values(sp21).every(Boolean) && /Wat nu/.test(t1.titel) && t1.doel && t2.weg && t2.flag && t2.geenDoel && !t2.nodig, "spiekbriefje op elk scherm en rondleiding in vijf stappen (daarna niet meer): " + JSON.stringify({sp21, t1, t2}));
  // 6.1 divisiehoofd
  const hd = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 200; const d = c.divisions[0], nm = divNaam(d); delete d.hoofd;
    const f0 = [hoofdF(d, "omzet"), hoofdF(d, "kosten")], a = actHoofd(c, ctx, nm, "aannemen"), dubbel = actHoofd(c, ctx, nm, "aannemen").ok, t = d.hoofd.talent, f1 = hoofdF(d, "omzet");
    actHoofd(c, ctx, nm, "focus", "kosten"); const f2 = [hoofdF(d, "omzet"), hoofdF(d, "kosten")]; const b = actHoofd(c, ctx, nm, "bonus").ok, b2 = actHoofd(c, ctx, nm, "bonus").ok;
    d.hoofd.loyaliteit = 10; c.morale = 0; const oud = window.kansRol; window.kansRol = () => 0; hoofdTick(c, Ctx()); window.kansRol = oud;
    return {f0, a: a.ok, dubbel, t, f1: Math.round(f1 * 100) / 100, f2: f2.map(x => Math.round(x * 100) / 100), b, b2, weg: !d.hoofd}; });
  const hdUI = await p.evaluate(() => { S.view = "bedrijf"; render(); return /Hoofd aannemen|hoofd · talent/.test(document.querySelector("main").textContent); });
  ok(hd.f0.join() === "1,1" && hd.a && !hd.dubbel && hd.f1 === Math.round((1 + 0.02 * hd.t) * 100) / 100 && hd.f2[0] === 1 && hd.f2[1] === Math.round((1 - 0.03 * hd.t) * 100) / 100 && hd.b && !hd.b2 && hd.weg && hdUI, "divisiehoofd: aannemen met talent, focus omzet of kosten, bonus één keer per maand, lage loyaliteit = vertrek: " + JSON.stringify(hd));
  // 6.2 rivalen bouwen aanwezigheid op
  const ra = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), r = c.rivals[0], hq = c.districts.find(d => d.id === r.hq); r.relatie = -50; r.cash = 0;
    const buren = (hq.neighbors || []).map(id => c.districts.find(d => d.id === id)).filter(d => d && d.id !== c.player.home_district && d.continent === hq.continent && !c.rivals.some(q => q.hq === d.id)); /* 11.0: winkels en contracten tellen per continent */
    const neu = buren[0], mijn = buren[1] || null; if (!neu) return {geen: true}; neu.control = "neutral"; if (mijn) mijn.control = "player"; const thuis = c.districts.find(d => d.id === c.player.home_district);
    c.rivAanwezig = {[r.name]: {[neu.id]: 150, ...(mijn ? {[mijn.id]: 300} : {}), [thuis.id]: 500}}; for (const d of c.districts){ delete d.dom; delete d.domRiv; } c.aanwezig = {}; for (const q of c.rivals) if (q !== r) q.producten = []; c.producten = []; c.contracten = [];
    c.vestiging = {[r.name]: {[neu.id]: "x", ...(mijn ? {[mijn.id]: "x"} : {}), [thuis.id]: "x"}}; r.producten = Array.from({length: 4}, () => ({pop: 100, kwaliteit: 5})); for (const g of c.gangs || []) if (g.gebied){ delete g.gebied[neu.id]; if (mijn) delete g.gebied[mijn.id]; } c.contractHist = Array.from({length: 12}, () => ({cont: hq.continent, wie: r.name, uitkomst: "verloren", m: ym(c)})); /* 11.0: rivalen winnen met vestigingen, winkels en contracten */
    const oud = window.kansRol; window.kansRol = () => 0.99; const ctx = Ctx(); for (let i = 0; i < 12; i++) domTick(c, ctx); window.kansRol = oud;
    return {pneu: Math.round((neu.dom || {})[r.name] || 0), pmijn: mijn ? Math.round((mijn.dom || {})[r.name] || 0) : null, neu: neu.control === r.name, mijn: mijn ? mijn.control === r.name : null, thuis: thuis.control === "player", mail: ctx.mails.some(m => /toe$/.test(m.onderwerp || m.subject || "")) || ctx.rep.some(x => /valt .* toe/.test(x))}; });
  ok(ra.geen || (ra.neu && (ra.mijn === null || ra.mijn) && ra.thuis && (ra.mijn === null || ra.mail)), "rivalen met dezelfde regels: hun aanwezigheid neemt een neutraal district en een district van jou over, je thuisdistrict nooit: " + JSON.stringify(ra));
  // 6.3 corporate zone
  const cz = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), thuis = c.districts.find(d => d.id === c.player.home_district).continent; c.cash = 50; c.debt = 0;
    for (const k of CONTINENTS) (c.spanning ??= {})[k.naam] = 30; const d0 = doelen(c).find(x => x.id === "corpzone"), e0 = eindCheck(c);
    c.spanning[thuis] = 95; for (const d of c.districts) if (d.continent === thuis){ d.control = "player"; delete d.dom; } const d1 = doelen(c).find(x => x.id === "corpzone"), e1 = eindCheck(c);
    return {d0: d0 && d0.klaar, pct0: d0 && d0.pct, d1: d1 && d1.klaar, e0, e1}; });
  ok(cz.d0 === false && cz.pct0 < 100 && cz.d1 && cz.e1 === "OVERWINNING: CORPORATE ZONE" && cz.e0 !== "OVERWINNING: CORPORATE ZONE", "corporate zone: nieuwe overwinning bij spanning 90+ op je thuiscontinent en 60% dominantie: " + JSON.stringify(cz));
  // 6.5 kleuren altijd leesbaar
  const kls = await p.evaluate(() => { const oud = G.game.huisstijl ? JSON.parse(JSON.stringify(G.game.huisstijl)) : null, cs = () => getComputedStyle(document.documentElement), rgbv = n => cs().getPropertyValue(n).trim();
    const test = (h) => { G.game.huisstijl = h; render(); pasStijlToe(h); const bg = hexRgb((THEMAS[h.thema || "neon"] || {}).bg || "#06020e"), c = hexRgb(rgbv("--cyan")), m = hexRgb(rgbv("--mag")), onC = hexRgb(rgbv("--on-cyan")), onM = hexRgb(rgbv("--on-mag"));
      return {c: Math.round(contrast(c, bg) * 10) / 10, m: Math.round(contrast(m, bg) * 10) / 10, opC: Math.round(contrast(onC, c) * 10) / 10, opM: Math.round(contrast(onM, m) * 10) / 10, rgb: rgbv("--cyan-rgb"), glow: /rgba/.test(rgbv("--glow-c"))}; };
    const donker = test({kleur: "#101820", accent: "#200010", thema: "bloed"}), licht = test({kleur: "#fff36b", accent: "#ff2a6d", thema: "chroom"}), normaal = test({kleur: "#05d9e8", accent: "#ff2a6d"});
    const noot = /lichter gemaakt/.test(kleurNoot({kleur: "#101820", thema: "bloed"})), kaart = ownerColor(G.game, "player");
    G.game.huisstijl = oud || {}; if (!oud) delete G.game.huisstijl; pasStijlToe(G.game.huisstijl); render(); return {donker, licht, normaal, noot, kaart}; });
  ok([kls.donker, kls.licht, kls.normaal].every(x => x.c >= 4.5 && x.m >= 4.5 && x.opC >= 4.5 && x.opM >= 3 && x.glow) && kls.donker.rgb !== "5,217,232" && kls.noot && /^#[0-9a-f]{6}$/i.test(kls.kaart), "kleuren: hoofd- en accentkleur kleuren alles en blijven leesbaar (contrast ≥ 4,5 op elk thema, tekst op knoppen zwart of wit): " + JSON.stringify(kls));
  // 6.6 zwart, gelijk accent en twee divisienamen
  const zw66 = await p.evaluate(() => { const K = stijlKleuren({kleur: "#000000", accent: "#000000", thema: "chroom"}), k = K.k.rgb, a = K.a.rgb, pan = hexRgb(THEMAS.chroom.panel3);
    const grijs = stijlKleuren({kleur: "#333333", thema: "neon"}).k.rgb, rood = stijlKleuren({kleur: "#5a0010", thema: "bloed"}).k.rgb, gelijk = stijlKleuren({kleur: "#ff0000", accent: "#ff1010"}), anders = stijlKleuren({kleur: "#ff0000", accent: "#0040ff"});
    const n = newGame({...S.setup, corp_name: "Twee BV", doctrine: ["Logistiek", "Biotech"], home: "BNL", divisie_naam: "Havenlijn", divisie_naam2: "Genlab"}).s, n2 = newGame({...S.setup, corp_name: "Dubbel BV", doctrine: ["Logistiek", "Biotech"], home: "BNL", divisie_naam: "Kern", divisie_naam2: "Kern"}).s;
    return {neutraal: k[0] === k[1] && k[1] === k[2], licht: k[0] > 200, accentAnders: Math.hypot(k[0] - a[0], k[1] - a[1], k[2] - a[2]) >= 110, verschoven: !!K.a.verschoven, ck: Math.round(contrast(k, pan) * 10) / 10, ca: Math.round(contrast(a, pan) * 10) / 10,
      grijsNeutraal: grijs[0] === grijs[1] && grijs[1] === grijs[2], roodBlijftRood: rood[0] > rood[1] + 60 && rood[0] > rood[2] + 40, gelijkVerschoven: !!gelijk.a.verschoven, andersNiet: !anders.a.verschoven, namen: n.divisions.map(d => d.name), dubbel: n2.divisions.map(d => d.name)}; });
  ok(zw66.neutraal && zw66.licht && zw66.accentAnders && zw66.verschoven && zw66.ck >= 4.5 && zw66.ca >= 4.5 && zw66.grijsNeutraal && zw66.roodBlijftRood && zw66.gelijkVerschoven && zw66.andersNiet && zw66.namen.join() === "Havenlijn,Genlab" && zw66.dubbel.join() === "Kern,Kern 2",
    "zwart en gelijke kleuren: zwart wordt neutraal zilver (geen roze), te gelijk accent wordt een andere kleur, donkerrood blijft rood, twee divisies krijgen elk hun naam: " + JSON.stringify(zw66));
  // 6.7 effecten
  const fx = await p.evaluate(async () => { const oudR = S.rustig; S.rustig = false; document.documentElement.classList.remove("rustig");
    S.view = "overzicht"; render(); S.view = "bedrijf"; render(); const wissel = document.getElementById("main").classList.contains("viewin"); render(); const zelfde = document.getElementById("main").classList.contains("viewin") || document.getElementById("main").classList.contains("tabin");
    S.view = "wereld"; S.wtab = "nieuws"; render(); S.wtab = "krant"; render(); const tab = document.getElementById("main").classList.contains("tabin");
    const c0 = G.game.cash; G.game.cash = c0 + 50; render(); const op = !!document.querySelector(".top .stat .v.op"); G.game.cash = c0; render(); const neer = !!document.querySelector(".top .stat .v.neer");
    const knop = document.querySelector('[data-view="inbox"]'), r = knop.getBoundingClientRect(); knop.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true, clientX: r.left + 5, clientY: r.top + 5, button: 0})); const golf = !!document.querySelector(".klikgolf");
    maandScan(); const scan = !!document.querySelector(".maandscan");
    S.rustig = true; document.documentElement.classList.add("rustig"); S.view = "kaart"; render(); const rustig = !document.getElementById("main").classList.contains("viewin");
    S.rustig = oudR; document.documentElement.classList.toggle("rustig", !!oudR); S.view = "overzicht"; render(); return {wissel, zelfde, tab, op, neer, golf, scan, rustig}; });
  ok(fx.wissel && !fx.zelfde && fx.tab && fx.op && fx.neer && fx.golf && fx.scan && fx.rustig, "effecten: animatie bij een ander scherm of tabblad (niet bij elke klik), cijfers lichten op bij een verandering, klikgolf, maandscan, uit met EFFECTEN UIT: " + JSON.stringify(fx));
  // 6.8 zware producten alleen via contracten, meer aanvragen
  await p.evaluate(() => { window.__echt68 = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 5; return a; }; });
  const zp = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.aanvragen = []; c.contracten = []; c.cash = 500; c.reputation = 40; const d = c.divisions[0];
    const t = mkProduct(c, d, "Testtank", 4, 60); t.aard = "wapen"; t.schaal = "vlag"; c.producten.push(t); const order = stukInfo(t).order;
    const oud = window.kansRol; window.kansRol = () => 0; const ctx = Ctx(); aanvraagTick(c, ctx); window.kansRol = oud; const ca = c.aanvragen.filter(a => a.product === t.id), alg = c.aanvragen.filter(a => !a.product).length;
    const a0 = ca[0]; let gewonnen = null; if (a0){ a0.raam = false; a0.bedrag = 20; a0.cont = null; a0.minKwal = 1; for (const r of c.rivals) r.producten = (r.producten || []).filter(x => x.aard !== "wapen"); delete a0.maanden; delete a0.perMaand; c.prodomzet = {}; const r = actAanvraag(c, Ctx(), a0.id, "normaal"); gewonnen = {ok: r.ok, omzet: (c.prodomzet || {})[t.id], orders: (t.orders || []).length}; }
    t.status = "markt"; const voor = c.aanvragen.filter(x => x.product === t.id).length; c.cash = 100; const pr = actPitch(c, Ctx(), t.id), pr2 = actPitch(c, Ctx(), t.id), na = c.aanvragen.filter(x => x.product === t.id), nieuw = na[na.length - 1];
    c.producten = c.producten.filter(x => x === t || (x.aard || aardVan(x.type, x.naam)) !== "wapen"); const kansC = aanvraagKans(c, {...nieuw, minKwal: 1}, "normaal"), kansA = aanvraagKans(c, {...nieuw, product: null, minKwal: 1}, "normaal");
    const pitch = {ok: pr.ok, tweede: pr2.ok, erbij: na.length - voor, cash: c.cash, kansC, kansA, minK: nieuw && nieuw.minKwal <= t.kwaliteit};
    return {pitch, order, contract: ca.length, klant: a0 && a0.soort, tekst: a0 && a0.tekst, alg, gewonnen, max: AANVRAAG_MAX, doel: keurDoel({...t, kwaliteit: 3})}; });
  await p.evaluate(() => { crypto.getRandomValues = window.__echt68; });
  ok(zp.order && zp.contract === 1 && ["leger", "staat"].includes(zp.klant) && /Testtank/.test(zp.tekst) && zp.alg === 1 && zp.gewonnen && zp.gewonnen.ok && zp.gewonnen.omzet === 20 && zp.gewonnen.orders === 1 && zp.max === 6 && zp.doel <= 6 && zp.pitch.ok && !zp.pitch.tweede && zp.pitch.erbij === 1 && zp.pitch.kansC >= zp.pitch.kansA && zp.pitch.minK, "zware producten: alleen via contracten van legers/staten, die vaak komen; gewonnen levering telt als omzet van het product; tot 2 aanvragen per maand; keuring makkelijker: " + JSON.stringify(zp));
  // 6.8 handel geeft dominantie, aanwezigheid goedkoper, spanning werkt hard
  const hdom = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); const thuis = exportThuis(c), d = c.districts.find(x => x.continent === thuis && x.control !== "player");
    c.aanwezig = {}; c.patrouille = {}; c.handel = {}; const zonder = domDoel(c, d).player || 0;
    c.handel = {[thuis]: 36}; const met = domDoel(c, d).player || 0, h = handelAanwezig(c, thuis);
    const p1 = (c.producten || []).find(x => x.status === "markt"); let verdeeld = null; if (p1){ c.prodomzet = {[p1.id]: 20}; handelTick(c); verdeeld = Object.values(c.handel).reduce((a, b) => a + b, 0); }
    c.spanning[thuis] = 95; const ef = spanningEffecten(c, thuis).map(e => e.t).join("|");
    return {zonder, met, h, verdeeld, kost: aanwezigKost(c, d), cost: districtCost(c, d), w: spanningVraagF("wapen", 95), cons: spanningVraagF("consument", 95), rust: spanningVraagF("wapen", 20), ef, kop: !!document.querySelector(".spstat")}; });
  ok(hdom.zonder === 0 && hdom.met > 10 && hdom.h === 20 && (hdom.verdeeld == null || Math.abs(hdom.verdeeld - 20) < 0.3) && hdom.kost <= Math.max(2, hdom.cost * 0.15) + 0.05 && hdom.w > 1.8 && hdom.cons < 0.7 && hdom.rust === 1 && /Wapens ×/.test(hdom.ef) && /Heat zakt sneller/.test(hdom.ef) && /Straatgevechten/.test(hdom.ef) && hdom.kop, "omzet op een continent geeft aanwezigheid in elk district daar; aanwezigheid kopen is goedkoper; corpospanning verdubbelt bijna de wapenvraag en drukt consument; effecten per continent en in de header: " + JSON.stringify(hdom));
  // 6.9 simulatiesnelheid en opslagpunten
  const tijd0 = await p.evaluate(() => { document.querySelectorAll(".tour,.hmenu,.modal").forEach(x => x.remove()); S.menuOpen = false; S.help = false; if (document.activeElement) document.activeElement.blur(); localSet("simniet", JSON.stringify(["besluit", "kritiek", "gevaar"])); simSnelheid(5); simStart(); return {m: ym(G.game), ctl: !!document.querySelector(".simctl.loopt .simbar")}; });
  await p.waitForFunction(m => ym(G.game) !== m, tijd0.m, {timeout: 8000}).catch(() => {});
  const tijd = await p.evaluate(async m0 => { const m1 = ym(G.game); simStop(null); const stil = ym(G.game); await new Promise(r => setTimeout(r, 900)); const na = ym(G.game);
    const v = simSnap(); v.besluit = new Set(); localSet("simniet", "[]"); const nep = {...S.state, besluiten: [{arc: "x", titel: "Testbesluit"}]}; const oud = S.state, mw = G.game.maatwerk; G.game.maatwerk = null; S.state = nep; const reden = simReden(v); S.state = oud; G.game.maatwerk = mw; /* een speciale opdracht pauzeert ook; hier testen we het besluit */
    const md = document.createElement("div"); md.className = "modal"; document.body.appendChild(md); const bezet = simBezet(); md.remove();
    const r = await Store.saveAs("Testpunt"); const L = await Store.slots(); const punt = L.find(x => x.gid === r.gid);
    return {m0, m1, stil: stil === na, reden: reden && reden.tekst, soort: reden && reden.soort, bezet, ok: r.ok, punt: punt && {label: punt.label, opslag: punt.opslag, datum: punt.datum}, nu: ym(G.game), knop: !!document.querySelector('[data-a="opslaan"]')}; }, tijd0.m);
  ok(tijd0.ctl && tijd.m1 !== tijd.m0 && tijd.stil && /Testbesluit/.test(tijd.reden || "") && tijd.soort === "besluit" && tijd.bezet && tijd.ok && tijd.punt && tijd.punt.opslag && tijd.punt.datum === tijd.nu && tijd.knop, "tijd loopt vanzelf op snelheid 5, stopt bij pauze, pauzeert bij een nieuw besluit en als er een venster open is; opslagpunt komt als apart spel in de lijst: " + JSON.stringify({tijd0, tijd}));
  // 6.10 Weapon Manufacturing als standaardsoort, oude eigen soort wordt omgezet
  const wmx = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.custom_types = {...(c.custom_types || {}), "Weapon manufacturing": {rev: 9, cost: 5.5, heat: 1, vol: 0.3, eigen: true}};
    c.market["Weapon manufacturing"] = {size: 100, player: 3, rivals: {}}; c.divisions.push({name: "Weapon manufacturing", type: "Weapon manufacturing", level: 6, efficiency: 1});
    const pp = mkProduct(c, c.divisions[c.divisions.length - 1], "Tank X", 3, 50); c.producten.push(pp); migrate(c);
    const d = c.divisions.find(x => x.name === "Weapon manufacturing"); return {std: !!DT["Weapon Manufacturing"], type: d.type, ptype: pp.type, eigen: !!(c.custom_types || {})["Weapon manufacturing"], markt: !!c.market["Weapon Manufacturing"] && !c.market["Weapon manufacturing"], aard: aardVan("Weapon Manufacturing", "Tank X"), keuze: (S.state.divisie_types || []).includes("Weapon Manufacturing") || SECTORS.includes("Weapon Manufacturing")}; });
  ok(wmx.std && wmx.type === "Weapon Manufacturing" && wmx.ptype === "Weapon Manufacturing" && !wmx.eigen && wmx.markt && wmx.aard === "wapen" && wmx.keuze, "Weapon Manufacturing is een standaardsoort; een oude eigen soort met die naam wordt omgezet (divisie, producten, markt): " + JSON.stringify(wmx));
  // 6.10 bedrijven komen zelf met een leveringscontract
  const baan = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.keuzes = []; for (const b of c.bedrijven || []){ b.contract = false; b.eigenaar = b.eigenaar === "player" ? null : b.eigenaar; } c.reputation = 40;
    const oud = window.kansRol; window.kansRol = () => 0; const ctx = Ctx(); bedrijfAanbodTick(c, ctx); window.kansRol = oud;
    const k = (c.keuzes || []).find(x => /^bedrijfaanbod_/.test(x.soort)); if (!k) return {k: false, n: (c.bedrijven || []).length};
    const id = k.soort.slice(14), voor = (c.streams || []).length; applyChoice(c, Ctx(), k.opties[0].eff); const b = c.bedrijven.find(x => x.id === id);
    return {k: true, opties: k.opties.length, contract: b.contract, stream: (c.streams || []).length - voor, std: k.standaard}; });
  ok(baan.k && baan.opties === 3 && baan.contract && baan.stream === 1 && baan.std === 2, "bedrijven bieden zelf een leveringscontract aan; tekenen geeft meteen een inkomstenbron, zonder antwoord geen deal: " + JSON.stringify(baan));
  // 6.12 concepten en halve invoer overleven een herlaad
  const cpt = await p.evaluate(() => { S.view = "overzicht"; render(); const dv = divNaam(G.game.divisions[0]); (G.concepten ??= {})[dv] = {naam: "Armor Test", pitch: "vesten en helmen", vraagVan: "armor"}; S.keep.pc_test = "half getypt"; render();
    const opgeslagen = !!localGet("concept_" + G.gid); S._conceptGid = null; G.concepten = undefined; S.keep = {}; render();
    const terug = ((G.concepten || {})[dv] || {}).naam, keep = S.keep.pc_test; delete G.concepten[dv]; delete S.keep.pc_test; render(); return {opgeslagen, terug, keep, leeg: !localGet("concept_" + G.gid) || !/Armor Test/.test(localGet("concept_" + G.gid))}; });
  ok(cpt.opgeslagen && cpt.terug === "Armor Test" && cpt.keep === "half getypt" && cpt.leeg, "een concept van de GM en half ingevulde velden overleven een herlaad of update: " + JSON.stringify(cpt));
  // 6.13 edities (sequels) van een product
  const edi = await p.evaluate(async () => { const s = G.game, d = s.divisions[0]; const pr = mkProduct(s, d, "Vest Alpha", 3, 50); Object.assign(pr, {aard: "wapen", schaal: "groot", keuring: "ok"}); s.producten.push(pr); s.cash = 500;
    const sOff = G.sampleOff; G.sampleOff = true; const ra = await gmEditie(pr.id, "lichtere platen, woestijncamo en goedkoper te maken, betere generatie"); G.sampleOff = sOff;
    const v = G.edities[pr.id]; const k0 = kostFactor(pr), cash0 = s.cash; const r2 = actEditie(s, Ctx(), pr.id, v); 
    pr.editieBezig.over = 1; window.__e = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 5; return a; }; editieTick(s, Ctx(), pr); crypto.getRandomValues = window.__e;
    S.view = "bedrijf"; S.prodSheet = pr.id; (S.prodTab ??= {})[pr.id] = "editie"; render(); const ui = /EDITIE 2/.test(document.querySelector("main").textContent); S.prodSheet = null; render();
    const uit = {ok1: ra.ok, soorten: v.extras.map(x => x.soort), kwPlus: v.kwPlus, ok2: r2.ok, betaald: r1(cash0 - s.cash), naam: pr.naam, editie: pr.editie, extras: (pr.extras || []).length, kw: pr.kwaliteit, goedkoper: kostFactor(pr) < k0, keuring: pr.keuring, ui};
    s.producten = s.producten.filter(x => x !== pr); return uit; });
  ok(edi.ok1 && edi.soorten.includes("kosten") && edi.soorten.includes("betrouwbaar") && edi.soorten.includes("populariteit") && edi.kwPlus === 1 && edi.ok2 && edi.betaald > 0 && edi.naam === "Vest Alpha II" && edi.editie === 2 && edi.extras >= 3 && edi.kw === 4 && edi.goedkoper && edi.keuring === "nodig" && edi.ui, "edities: voorstel uit je tekst, extra's met effect, ontwikkelen kost geld, lancering geeft Editie 2 met nieuwe naam, kwaliteit en een nieuwe keuring: " + JSON.stringify(edi));
  // 6.14 corpomacht-ladder en corpo-oorlogen
  const lad = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), th = exportThuis(c); c.spanning ??= {}; for (const r of c.rivals){ r.status = "vrede"; r.verdragen = []; }
    c.spanning[th] = 20; const p0 = oorlogPrijs(c); c.spanning[th] = 75; const p1 = oorlogPrijs(c); c.spanning[th] = 95; const p2 = oorlogPrijs(c);
    const r0 = c.rivals[0], rep0 = c.reputation, h0 = c.heat; actDiplo(c, Ctx(), r0.name, "oorlog"); const corpo = r0.corpo === true && c.reputation === rep0 && c.heat === h0;
    r0.status = "vrede"; const r1v = c.rivals[1]; r1v.relatie = -80; const ctx = Ctx(), oud = window.kansRol; window.kansRol = () => 0; corpoTick(c, ctx); window.kansRol = oud; const tegen = c.rivals.filter(r => r.status === "oorlog" && r.corpo).length;
    const o = G.game.spanning; G.game.spanning = {...(o || {}), [exportThuis(G.game)]: 95}; S.view = "wereld"; S.wtab = "spanning"; render(); const t = document.querySelector("main").textContent; S.view = "rivalen"; render(); const t2 = document.querySelector("main").textContent; G.game.spanning = o; render();
    return {p0, p1, p2, corpo, tegen, ui: /Corpomacht: hoeveel mogen corporaties/.test(t) && /CORPO-OORLOGEN/.test(t) && /Nu van kracht/.test(t), kort: /CORPOMACHT/.test(t2) && /corpo-oorlog/.test(t2)}; });
  ok(lad.p0.rep === 4 && lad.p1.rep === 2 && lad.p2.rep === 0 && lad.p2.corpo && lad.corpo && lad.tegen === 1 && lad.ui && lad.kort, "corpomacht-ladder: oorlog verklaren wordt goedkoper met de spanning, in een corporate zone een corpo-oorlog zonder reputatie of heat, vijandige rivalen verklaren jou dan zelf de oorlog; kader op Corpospanning en Rivalen: " + JSON.stringify(lad));
  // 7.0 fundament: slijtage, dubbele contracten, exportregels voor contracten, wanbetaling
  const fu = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), d = c.divisions[0]; c.producten = []; c.projects = []; d.upM = null; d.slijt = 1; for (let i = 0; i < 12; i++) slijtTick(c, Ctx()); const slijt12 = d.slijt;
    const pr = mkProduct(c, d, "Nieuw", 3, 50); c.producten.push(pr); slijtTick(c, Ctx()); const herstel = d.slijt > slijt12;
    c.streams = [{naam: "Contract X", bedrag: 2}, {naam: "Contract X", bedrag: 3}, {naam: "Contract Y", bedrag: 1}]; stromenSamen(c); const stromen = c.streams.map(x => x.naam + ":" + x.bedrag).join(",");
    const thuis = exportThuis(c), ander = CONTINENTS.map(x => x.naam).find(n => n !== thuis); c.exportVergunning = {}; c.smokkelroute = {}; c.spanning ??= {}; c.spanning[ander] = 20;
    const a = {aard: "wapen", cont: ander, soort: "staat"}, t0 = contractToegang(c, a); c.exportVergunning[ander] = "2000-01"; const t1 = contractToegang(c, a); c.spanning[ander] = 60; const t2 = contractToegang(c, a); c.smokkelroute[ander] = "2000-01"; const t3 = contractToegang(c, a);
    const thuisOk = contractToegang(c, {aard: "wapen", cont: thuis}).ok, medOk = contractToegang(c, {aard: "medisch", cont: ander}).ok;
    c.spanning[ander] = 75; const w = wanbetaalKans(c, {soort: "leger", cont: ander}), wOud = wanbetaalKans(c, {klant: "oud"});
    return {slijt12, herstel, stromen, t0: t0.ok, t1: t1.ok, t2: t2.ok, t3: t3.via, thuisOk, medOk, w, wOud}; });
  ok(fu.slijt12 < 0.99 && fu.herstel && fu.stromen === "Contract X:3,Contract Y:1" && !fu.t0 && fu.t1 && !fu.t2 && fu.t3 === "smokkel" && fu.thuisOk && fu.medOk && fu.w === 0.03 && fu.wOud === 0, "7.0: een divisie die niet vernieuwt slijt en herstelt met een nieuw product; dubbele contracten samengevoegd; wapens exporteren vraagt een vergunning, bij embargo een smokkelroute; wanbetaling in onrustige gebieden, oude contracten veilig: " + JSON.stringify(fu));
  // 7.2 razzia als klap, prognose, juridisch offensief
  const rz = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.cash = 200; c.accounts.zwart = 30; c.razzias = 0; const d = c.divisions[0]; d.level = 3; const ctx = Ctx();
    const eind1 = razzia(c, ctx); const na = {cash: c.cash, zw: c.accounts.zwart, lvl: d.level, heat: c.heat, n: c.razzias}; razzia(c, ctx); const eind3 = razzia(c, ctx);
    const c2 = JSON.parse(JSON.stringify(G.game)); c2.heat = 70; c2.cash = 500; c2.flags.offensief = null; const o1 = actOffensief(c2, Ctx()), h = c2.heat, o2 = actOffensief(c2, Ctx());
    c2.gezondheid = {heat: {van: 60, naar: 66, delen: [["Divisies", 5], ["Producten", 1]]}}; c2.heat = 66; const hp = heatPrognose(c2);
    return {eind1, na, eind3, o1: o1.ok, h, o2: o2.ok, hp}; });
  ok(!rz.eind1 && rz.na.cash < 200 && rz.na.zw === 0 && rz.na.lvl === 2 && rz.na.heat === 50 && rz.na.n === 1 && rz.eind3 && rz.o1 && rz.h === 58 && !rz.o2 && rz.hp.maanden === 4 && rz.hp.bron === "Divisies", "7.2: een razzia is een klap (boete, zwart geld weg, divisie een niveau omlaag, heat 50), de derde is het einde; juridisch offensief −12 eens per vier maanden; prognose wanneer heat 90 is: " + JSON.stringify(rz));
  // 7.5 druk groeit met je waarde
  const dk = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); const r = c.rivals[0]; r.aggression = 0.3; r.cash = 10; c.cash = 20000; const a0 = r.aggression; rivalAI(c, Ctx(), 1); return {a0, a1: r.aggression, groot: playerValue(c) > rivalValue(c, r) * 1.5}; });
  ok(dk.groot && dk.a1 > dk.a0, "7.5: wie veel groter is dan een rivaal, maakt die agressiever: " + JSON.stringify(dk));
  // 7.7 contracten deel 2: langer als tegenbod, kwaliteitsplicht, productplicht
  const c7 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.aanvragen = []; c.contracten = []; c.cash = 500; const d = c.divisions[0];
    const pr = mkProduct(c, d, "Vest K", 3, 60); Object.assign(pr, {aard: "wapen", schaal: "groot", keuring: "ok"}); c.producten.push(pr);
    const a = {id: "aT1", m: ym(c), soort: "staat", klant: "Testministerie", aard: "wapen", raam: true, maanden: 12, perMaand: 2, product: pr.id, minKwal: 3, verloopt: 3, cont: null}; c.aanvragen.push(a); for (const r of c.rivals) r.producten = (r.producten || []).filter(x => x.aard !== "wapen");
    const oud = window.kansRol; window.kansRol = () => 0; window.__e7 = crypto.getRandomValues; crypto.getRandomValues = x => { x[0] = 5; return x; };
    const r = actAanvraag(c, Ctx(), "aT1", "lang"); crypto.getRandomValues = window.__e7; const con = c.contracten[0] || {};
    const eenm = {id: "aT2", soort: "staat", klant: "X", aard: "wapen", raam: false, bedrag: 5, verloopt: 3}; c.aanvragen.push(eenm); const r2 = actAanvraag(c, Ctx(), "aT2", "lang");
    pr.kwaliteit = 2; const cash0 = c.cash; window.kansRol = () => 0.99; const ctx = Ctx(); aanvraagTick(c, ctx); aanvraagTick(c, ctx); const boete = cash0 > c.cash - con.perMaand * 2 * AANVRAAG_MARGE; aanvraagTick(c, ctx); const opgezegd = con.over === 0;
    const c2 = JSON.parse(JSON.stringify(c)); c2.contracten = [{id: "k", klant: "Y", aard: "wapen", product: pr.id, perMaand: 1, over: 6, maanden: 6}]; const pr2 = c2.producten.find(x => x.id === pr.id); pr2.status = "uit"; const pr3 = mkProduct(c2, d, "Ander wapen", 4, 50); Object.assign(pr3, {aard: "wapen", keuring: "ok"}); c2.producten.push(pr3); aanvraagTick(c2, Ctx()); window.kansRol = oud;
    return {ok: r.ok, mnd: con.maanden, min: con.minKwal, r2: r2.ok, boete, opgezegd, verbroken: c2.contracten.length === 0 || c2.contracten[0].over === 0}; });
  ok(c7.ok && c7.mnd === 18 && c7.min === 3 && !c7.r2 && c7.boete && c7.opgezegd && c7.verbroken, "7.7: tegenbod 'langer' geeft 50% meer maanden; onder de afgesproken kwaliteit boetes en na drie maanden opzegging; een contract voor een product breekt als dat product weg is, ook als er een ander wapen is: " + JSON.stringify(c7));
  // 8.0 unieke kleuren en iedereen op de kaart
  const k8 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)); c.huisstijl = {...(c.huisstijl || {}), kleur: "#ff9a1f"}; for (const r of c.rivals) r.kleur = "#cccccc"; c.rivals[0].kleur = "#ff9a1f"; kleurenUniek(c);
    const H = [ownerColor(c, "player"), ...c.rivals.map(r => r.kleur)].map(k => hexHsl(k).h), min = Math.min(...H.flatMap((a, i) => H.slice(i + 1).map(b => hueAfstand(a, b))));
    S.view = "kaart"; render(); const leg = document.querySelectorAll(".corpleg").length; S.view = "overzicht"; render(); return {min, leg, n: G.game.rivals.length, neutraal: ownerColor(c, "neutral")}; });
  ok(k8.min >= 24 && k8.leg === k8.n + 2 && k8.neutraal === "#3a3550", "8.0: elke corporatie een eigen kleur ver van de andere (ook van de speler), neutraal grijs, legenda met iedereen op de kaart: " + JSON.stringify(k8));
  // 8.1 controle door concurrentie
  const vc = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), r = c.rivals[0], cont = (c.districts.find(x => x.id === r.hq) || {}).continent, d = c.districts.find(x => x.continent === cont && x.control !== r.name && x.id !== c.player.home_district && !c.rivals.some(q => q.hq === x.id)) || c.districts.find(x => x.control !== r.name);
    c.aanwezig = {}; c.rivAanwezig = {}; c.patrouille = {}; c.contracten = []; c.contractHist = []; c.producten = []; r.producten = []; handelTick(c); const voor = domDoel(c, d);
    r.producten = [{naam: "X", aard: "wapen", pop: 80, kwaliteit: 5}]; handelTick(c); const metWinkel = domDoel(c, d);
    r.producten = []; c.contracten = [{cont: d.continent, over: 6, perMaand: 9, klant: "k", aard: "wapen"}]; handelTick(c); const metContract = domDoel(c, d);
    return {basis: EIGEN_BASIS, rivVoor: Math.round(voor[r.name] || 0), rivWinkel: Math.round(metWinkel[r.name] || 0), jijVoor: Math.round(voor.player || 0), jijContract: Math.round(metContract.player || 0)}; });
  ok(vc.basis === 55 && vc.rivWinkel > vc.rivVoor && vc.jijContract > vc.jijVoor, "8.1: bezit is een basis (55); winkels van een rivaal en jouw contracten met klanten op een continent vergroten het aandeel daar: " + JSON.stringify(vc));
  // 8.4 klik wacht als het spel bezig is; onderhandelen, lobby; spanning escaleert
  const c84 = await p.evaluate(async () => { const s = G.game; s.aanvragen ??= []; const d = s.divisions[0], pr = mkProduct(s, d, "Kist 84", 4, 60); Object.assign(pr, {aard: "logistiek", schaal: "groot", keuring: "ok"}); s.producten.push(pr);
    const a = {id: "a84", m: ym(s), soort: "bedrijf", klant: "Testbedrijf", aard: "logistiek", raam: false, bedrag: 4, verloopt: 3, cont: null, minKwal: 1}; s.aanvragen.push(a);
    S.busy = true; setTimeout(() => { S.busy = false; }, 300); const r = await act("/api/onderhandel", {id: "a84"}, {silent: true}); const onder = !!(G.game.aanvragen.find(x => x.id === "a84") || {}).onder;
    G.game.invloed = 10; const k0 = aanvraagKans(G.game, G.game.aanvragen.find(x => x.id === "a84"), "normaal"); const l = await act("/api/lobby", {id: "a84"}, {silent: true}); const k1 = aanvraagKans(G.game, G.game.aanvragen.find(x => x.id === "a84"), "normaal"); const lob = !!(G.game.aanvragen.find(x => x.id === "a84") || {}).lobby;
    G.game.aanvragen = G.game.aanvragen.filter(x => x.id !== "a84"); G.game.producten = G.game.producten.filter(x => x !== pr);
    const c = JSON.parse(JSON.stringify(G.game)), th = exportThuis(c); for (const k of CONTINENTS) c.spanning[k.naam] = 20; const laag = {...c.spanning}; c.spanning[th] = 65; const v0 = c.spanning[th]; for (let i = 0; i < 12; i++) spanningTick(c, Ctx());
    return {r: !!(r && r.ok), onder, l: !!(l && l.ok), lob, k0, k1, stijg: Math.round((c.spanning[th] - v0) * 10) / 10}; });
  ok(c84.r && c84.onder && c84.l && c84.k1 >= c84.k0 && c84.lob && c84.stijg >= 3, "8.4: een klik terwijl het spel bezig is wacht en gaat dan door; onderhandelen en lobby werken (+kans); spanning boven 60 escaleert snel: " + JSON.stringify(c84));
  // 8.5 de klant vergelijkt; enige aanbieder = zeker
  const v85 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), d = c.divisions[0], pr = mkProduct(c, d, "Uniek", 3, 60); Object.assign(pr, {aard: "orbitaal", keuring: "ok"}); c.producten = [pr]; for (const r of c.rivals) r.producten = (r.producten || []).filter(x => x.aard !== "orbitaal");
    const a = {id: "m1", soort: "staat", klant: "K", aard: "orbitaal", raam: false, bedrag: 5, minKwal: 1, verloopt: 3, cont: null}; c.aanvragen = [a]; const mono = aanvraagVergelijk(c, a, "hoog");
    const r = c.rivals[0]; r.producten = [...(r.producten || []), {naam: "Conc", aard: "orbitaal", kwaliteit: 4, pop: 50}]; const met = ["laag", "normaal", "hoog"].map(k => aanvraagKans(c, a, k));
    a.rivPrijs = {[r.name]: 15}; const vv = aanvraagVergelijk(c, a, "normaal"), uit = actAanvraag(c, Ctx(), "m1", "normaal");
    return {mono: mono.mono, monoKans: mono.kans, met, jij: vv.jij, hun: rivBodBasis(c, r, a).basis + 15, uit: uit.msg.slice(0, 60)}; });
  ok(v85.mono && v85.monoKans === 100 && v85.met[0] >= v85.met[1] && v85.met[1] >= v85.met[2] && (v85.met[0] > v85.met[2] || v85.met[0] === 0 || v85.met[2] === 100) && ((v85.jij >= v85.hun) === /Gewonnen/.test(v85.uit)), "8.5: enige aanbieder wint altijd; met een concurrent vergelijkt de klant de biedingen (scherp > normaal > hoog) en de hoogste wint: " + JSON.stringify(v85));
  // 8.6 rivalen blijven bij hun vak, uitbreiden met een reden, opvolgers
  const r86 = await p.evaluate(() => { const {s: n} = newGame({corp_name: "Vak", doctrine: ["Biotech"], home: "BNL", difficulty: "Realistisch", kapitaal: "normaal", lengte: "normaal", ontslag: "normaal", bonus: "geen", ethiek: "normaal"});
    const vakOk = n.rivals.every(r => Object.keys(r.divs).every(k => verwant(r, k)));
    const c = JSON.parse(JSON.stringify(G.game)), r = c.rivals[0]; r.sector = "Cyberware"; r.divs = {"Cyberware": 3, "Weapon Manufacturing": 1}; r.divReden = {}; r.sectorNet = false; r.producten = [{id: "x1", naam: "Raar Tank", aard: "wapen", kwaliteit: 3, pop: 50}, {id: "x2", naam: "Goed Oog", aard: "implantaat", kwaliteit: 3, pop: 50}];
    rivSectorOpruimen(c); const opgeruimd = !r.divs["Weapon Manufacturing"] && !r.producten.some(p => p.aard === "wapen") && Object.keys(r.divs).every(k => verwant(r, k));
    const pr = mkProduct(c, c.divisions[0], "Alleen Medisch", 4, 70); Object.assign(pr, {aard: "medisch", keuring: "ok"}); c.producten = [pr]; c.prodomzet = {[pr.id]: 20}; for (const q of c.rivals) q.producten = (q.producten || []).filter(x => x.aard !== "medisch");
    r.cash = 900; r.expM = null; delete r.divs["Biotech"]; const oudR = RNG; RNG = () => 0; rivUitbreiding(c, r); RNG = oudR;
    return {vakOk, opgeruimd, uitgebreid: !!r.divs["Biotech"], reden: (r.divReden || {})["Biotech"] || ""}; });
  ok(r86.vakOk && r86.opgeruimd && r86.uitgebreid && /alleen/.test(r86.reden), "8.6: rivalen starten in verwante sectoren, losse vreemde divisies (en hun producten) verdwijnen, en ze breiden uit met een reden (bv. jij hebt een markt alleen): " + JSON.stringify(r86));
  // 8.7/9.0 vakgebied en niveau: niet op slot, wel duurder; zeldzaamheid
  const v87 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), d = c.divisions[0]; d.type = "Biotech"; d.level = 1; c.cash = 900; c.gratisDev = 0;
    const inVak = devPlan(c, d, "klein", "standaard", "medisch"), buiten = devPlan(c, d, "klein", "standaard", "wapen"), vlag1 = devPlan(c, d, "vlag", "standaard", "medisch"); d.level = 3; const vlag3 = devPlan(c, d, "vlag", "standaard", "medisch"); d.level = 1;
    const tank = actProduct(c, Ctx(), "ontwikkel", {divisie: divNaam(d), schaal: "klein", aard: "wapen"});
    c.divisions = [d]; const kIn = techKost(c, 1, "medisch"), kUit = techKost(c, 1, "wapen"), ozWapen = actOnderzoek(c, Ctx(), "wapen").ok;
    const tel = {}; for (let i = 0; i < 4000; i++){ const k = kiesSector(c); tel[k] = (tel[k] || 0) + 1; }
    return {tank: tank.ok, duurder: buiten.kost > inVak.kost * 2, kwLager: buiten.kw < inVak.kw || inVak.kw === 1, flag: buiten.buitenVak, vlagDuur: vlag1.kost > vlag3.kost && vlag1.doel > vlag3.doel, kUit: kUit > kIn * 1.5, ozWapen, log: tel["Logistiek"], cyber: tel["Cyberware"], wm: tel["Weapon Manufacturing"]}; });
  ok(v87.tank && v87.duurder && v87.kwLager && v87.flag && v87.vlagDuur && v87.kUit && v87.ozWapen && v87.log > v87.cyber * 2 && v87.log > v87.wm * 2, "8.7/9.0: buiten het vak en onder het niveau kan, maar duurder en moeilijker; onderzoek buiten je vak dubbel zo duur; logistiek komt veel vaker voor dan cyberware en wapenmakers: " + JSON.stringify(v87));
  // 9.2 contractgesprekken
  const g92 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), d = c.divisions[0], pr = mkProduct(c, d, "Gesprek X", 4, 60); Object.assign(pr, {aard: "logistiek", keuring: "ok"}); c.producten = [pr];
    const a = {id: "g1", soort: "staat", klant: "Testklant", aard: "logistiek", raam: true, maanden: 12, perMaand: 2, minKwal: 1, verloopt: 3, cont: null, persona: "wantrouwig"}; c.aanvragen = [a];
    const s0 = bodScore(c, a, "normaal"); const r1x = actGesprek(c, Ctx(), "g1", "vraag"), r2 = actGesprek(c, Ctx(), "g1", "garantie"), r3 = actGesprek(c, Ctx(), "g1", "druk"), r4 = actGesprek(c, Ctx(), "g1", "korting");
    const s1 = bodScore(c, a, "normaal"); return {ok: r1x.ok && r2.ok && r3.ok, vierde: r4.ok, bekend: !!a.gesprek.bekend, beurten: a.gesprek.beurten.length, effecten: a.gesprek.beurten.map(b => b.effect), s0, s1, garantie: !!a.gesprek.garantie}; });
  ok(g92.ok && !g92.vierde && g92.bekend && g92.beurten === 3 && g92.effecten[1] === 12 && g92.effecten[2] === -10 && g92.s1 === g92.s0 + 2 && g92.garantie, "9.2: een gesprek van drie beurten; vragen onthult de klant, garantie past bij een wantrouwige klant (+12), druk zetten niet (−10); het bod verandert mee: " + JSON.stringify(g92));
  // 9.2b zelf iets zeggen in een gesprek
  const g92b = await p.evaluate(async () => { const s = G.game, d = s.divisions[0], pr = mkProduct(s, d, "Praat X", 4, 60); Object.assign(pr, {aard: "logistiek", keuring: "ok"}); s.producten.push(pr); s.aanvragen ??= [];
    s.aanvragen.push({id: "g2", soort: "staat", klant: "Praatklant", aard: "logistiek", raam: true, maanden: 12, perMaand: 2, minKwal: 1, verloopt: 3, cont: null, persona: "wantrouwig"});
    const sOff = G.sampleOff; G.sampleOff = true; const r = await gmGesprek("g2", "Wij geven volledige garantie: gaat er iets mis, dan vervangen we het."); G.sampleOff = sOff;
    const a = G.game.aanvragen.find(x => x.id === "g2"), b = (a.gesprek || {beurten: []}).beurten[0] || {}; G.game.aanvragen = G.game.aanvragen.filter(x => x.id !== "g2"); G.game.producten = G.game.producten.filter(x => x !== pr);
    return {ok: r.ok, zet: b.zet, wij: b.wij, effect: b.effect}; });
  ok(g92b.ok && g92b.zet === "garantie" && /volledige garantie/.test(g92b.wij || "") && g92b.effect === 12, "9.2b: zelf iets zeggen: het spel herkent de bedoeling (garantie) en je eigen woorden staan in het gesprek: " + JSON.stringify(g92b));
  ok(/VERKOOP/.test(verkoop) && /KEURING/.test(verkoop), "tabblad Verkoop en keuring");
  ok(/VARIANT/.test(scherm), "varianten staan op het productblad");
  if (out){ const bl = await p.$('.prodblad'); if (bl) await bl.screenshot({path: out + "/verkoop.png"}); }
  // 10.1 klantrelaties en 10.2 capaciteit
  const klr = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(), oud = window.kansRol; window.kansRol = () => 0.99; c.cash = 500; c.klanten = {};
    const p = c.producten.find(x => x.status === "markt"); if (!p) return {geen: true}; const aard = p.aard || aardVan(p.type, p.naam);
    const a = {id: "t1", klant: "Testleger (Nergens)", soort: "staat", aard, product: p.id, minKwal: 1, cont: null, raam: true, perMaand: 1, maanden: 12, verloopt: 3};
    const b0 = bodScore(c, a, "normaal");
    c.contracten = [{id: "t1", klant: a.klant, soort: "staat", aard, product: p.id, perMaand: 1, over: 1, maanden: 12, sinds: ym(c)}]; aanvraagTick(c, ctx);
    const band1 = (c.klanten[a.klant] || {}).band, b1 = bodScore(c, a, "normaal");
    const vrij0 = effBereik(p, c), cap = prodCap(c, p), groot = r1((cap + 20) / LAST_PER_M);
    c.contracten = [{id: "t2", klant: "Grootafnemer BV", soort: "bedrijf", aard, product: p.id, perMaand: groot, over: 6, maanden: 6, sinds: ym(c)}];
    const vrij1 = effBereik(p, c), k0 = c.cash; aanvraagTick(c, ctx); const tekort = (c.klanten["Grootafnemer BV"] || {}).band, mel = ctx.rep.some(x => /niet geleverd/.test(x));
    c.klanten["Boos Ministerie (X)"] = {band: -40, log: []}; const weg = pasTerugKlantToe(c, {klant: "Boos Ministerie (X)", tekst: "x", aard}, ["staat"]);
    window.kansRol = () => 0; c.aanvragen = []; c.klanten["Trouwe Marine (Y)"] = {band: 30, soort: "leger", cont: "Europa", aarden: [aard], log: []}; const terug = pasTerugKlantToe(c, {klant: "Iemand (Z)", tekst: "Iemand (Z) zoekt iets", aard, soort: "staat"}, ["leger", "staat"]);
    window.kansRol = oud; return {band1, b0, b1, vrij0: Math.round(vrij0), vrij1: Math.round(vrij1), tekort, mel, weg: weg === null, terug: terug && terug.klant, terugTekst: terug && terug.tekst}; });
  const klrUI = await p.evaluate(() => { S.view = "contracten"; render(); const t = document.querySelector("main").textContent; return /Klanten/.test(t) && /Klanten onthouden/.test(t); });
  ok(klr.geen || (klr.band1 >= 12 && klr.b1 > klr.b0 && klr.vrij1 === 0 && klr.vrij0 > 0 && klr.tekort < 0 && klr.mel && klr.weg && klr.terug === "Trouwe Marine (Y)" && /Trouwe Marine/.test(klr.terugTekst)) && klrUI,
    "klantrelaties en capaciteit: netjes afgerond = tevreden en sterker bod, contracten nemen capaciteit, tekort = boete en bozere klant, wantrouwen = geen aanvraag, tevreden klant komt terug: " + JSON.stringify(klr));
  // 10.0 onderhandelen met rivalen
  const ond = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(), r = c.rivals[0], oud = window.rolKans; r.status = "vrede"; r.relatie = 0; r.cash = 300;
    c.aanbiedingen = [{id: "h1", rival: r.name, type: "handel", bedrag: 2, verloopt: "2999-01"}, {id: "u1", rival: r.name, type: "ultimatum", bedrag: 20, verloopt: "2999-01"}];
    window.rolKans = () => ({ok: true, txt: "test"}); const k = offerZetKans(c, c.aanbiedingen[0], "meer"), z1 = offerZet(c, ctx, "h1", "meer"), z2 = offerZet(c, ctx, "h1", "langer"), z3 = offerZet(c, ctx, "h1", "meer"), b = c.aanbiedingen[0].bedrag, m = c.aanbiedingen[0].maanden;
    const ja = offerDecide(c, ctx, "h1", true), verdrag = r.verdragen.slice(-1)[0];
    window.rolKans = () => ({ok: false, txt: "test"}); const d = offerZet(c, ctx, "u1", "dreigen"); window.rolKans = oud;
    return {k, z1: z1.ok, z2: z2.ok, z3: z3.ok, b, m, ja: ja.ok, verdrag, oorlog: r.status === "oorlog", ultWeg: !c.aanbiedingen.some(o => o.id === "u1")}; });
  ok(ond.k > 0 && ond.z1 && ond.z2 && !ond.z3 && ond.b === 2.6 && ond.m === 18 && ond.ja && ond.verdrag && ond.verdrag.bedrag === 2.6 && ond.verdrag.maanden === 18 && ond.oorlog && ond.ultWeg,
    "onderhandelen met rivalen: twee zetten, meer en langer komen in het verdrag, mislukt dreigen = oorlog: " + JSON.stringify(ond));
  // 11.4 speciale opdrachten
  const mwt = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(), oud = window.rolKans, oudK = window.kansRol; c.cash = 500; c.maatwerk = null;
    const m = maakMaatwerk(c); if (!m) return {geen: true}; c.maatwerk = m; const stap = [];
    window.kansRol = () => 0.99; window.rolKans = () => ({ok: true, txt: "test"});
    stap.push(actMaatwerk(c, ctx, "luisteren").ok && c.maatwerk.fase); maatwerkTick(c, ctx); stap.push(c.maatwerk.fase);
    const kD = maatwerkKans(c, c.maatwerk, "degelijk"), vroeg = actMaatwerk(c, ctx, "aannemen").ok;
    stap.push(actMaatwerk(c, ctx, "degelijk").ok && c.maatwerk.fase); const k0 = c.cash; maatwerkTick(c, ctx); stap.push(c.maatwerk.fase); const voorschot = r1(c.cash - k0);
    const bij = actMaatwerk(c, ctx, "bijpraten").ok, bij2 = actMaatwerk(c, ctx, "bijpraten").ok;
    for (let i = 0; i < 10 && c.maatwerk.fase === "bouw"; i++) maatwerkTick(c, ctx); stap.push(c.maatwerk.fase);
    const band = (c.klanten[m.klant] || {}).band, n0 = c.producten.length; c.divisions.forEach(d => d.level = 5); const op = actMaatwerk(c, ctx, "opnemen", "Testontwerp X");
    const nieuw = c.producten.find(x => x.naam === "Testontwerp X");
    c.maatwerk = maakMaatwerk(c); for (let i = 0; i < 3 && c.maatwerk; i++) maatwerkTick(c, ctx); const verlopen = !c.maatwerk;
    window.rolKans = oud; window.kansRol = oudK; return {stap, kD, vroeg, voorschot, prijs: m.prijs, bij, bij2, band, op: op.ok, opMsg: op.msg, nieuw: nieuw && {status: nieuw.status, aard: nieuw.aard}, weg: !c.maatwerk, verlopen}; });
  const mwUI = await p.evaluate(() => { const c = G.game, oud = c.maatwerk; c.maatwerk = maakMaatwerk(c); S.view = "contracten"; render(); const t = document.querySelector("main").textContent, knop = !!document.querySelector('[data-a="maatwerk"][data-z="luisteren"]'); c.maatwerk = oud; render(); return /Speciale opdracht/.test(t) && knop; });
  ok(mwt.geen || (mwt.stap.join() === "luistert,ontwerp,beoordeelt,bouw,geleverd" && mwt.kD > 0 && !mwt.vroeg && mwt.voorschot > 0 && mwt.bij && !mwt.bij2 && mwt.band >= 15 && mwt.op && mwt.nieuw && mwt.nieuw.status === "ontwikkeling" && mwt.weg && mwt.verlopen) && mwUI,
    "speciale opdracht: kennismaken, ontwerp, akkoord met voorschot, bouwen met bijpraten, leveren, opnemen in assortiment; zonder antwoord haken ze af: " + JSON.stringify(mwt));
  // 11.5 productdiepgang en diepere contracten
  const pd = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(), oudK = window.kansRol; c.cash = 500; const p = c.producten.find(x => x.status === "markt"); if (!p) return {geen: true};
    const v0 = prodSpecs(p)[1].v, r = actProduct(c, ctx, "specverbeter", {id: p.id, i: 1}), dubbel = actProduct(c, ctx, "specverbeter", {id: p.id, i: 0}).ok;
    for (let i = 0; i < 2; i++){ p.specBezig.over > 1 ? (p.specBezig.over -= 1) : null; } p.specBezig.over = 1; window.kansRol = () => 0.99; productTick(c, ctx); const v1 = prodSpecs(p)[1].v;
    const a = {id: "w1", klant: "Wenser", soort: "staat", aard: p.aard, product: p.id, minKwal: 1, raam: false, bedrag: 5, verloopt: 3};
    a.wens = {i: 1, naam: "x", min: v1}; const bOk = bodScore(c, a, "normaal"); a.wens = {i: 1, naam: "x", min: v1 + 2}; const bNee = bodScore(c, a, "normaal"); delete a.wens; const b0 = bodScore(c, a, "normaal");
    const con = {id: "e1", klant: "Evaluant", soort: "staat", aard: p.aard, product: p.id, perMaand: 1, over: 6, maanden: 12, sinds: ym(c)}; c.contracten = [con]; window.kansRol = () => 0; const oR = window.R; 
    contractEvaluatie(c, ctx, con); const soort = con.eval && con.eval.soort; let res = null; if (soort === "verlengen" || soort === "uitbreiden"){ const pm = con.perMaand, ov = con.over; res = actContractEval(c, ctx, "e1", "ja"); res = {ok: res.ok, langer: con.over > ov, meer: con.perMaand > pm}; }
    const con2 = {id: "e2", klant: "Klager", soort: "staat", aard: p.aard, product: p.id, perMaand: 2, over: 6, maanden: 12, tekort: 1, sinds: ym(c)}; c.contracten.push(con2); contractEvaluatie(c, ctx, con2); const k2 = con2.eval && con2.eval.soort, kr = actContractEval(c, ctx, "e2", "ja"), nogeens = actContractEval(c, ctx, "e2", "ja").ok;
    window.kansRol = oudK; return {v0, v1, r: r.ok, dubbel, bOk, bNee, b0, soort, res, k2, korting: con2.perMaand, kr: kr.ok, nogeens}; });
  ok(pd.geen || (pd.r && !pd.dubbel && pd.v1 === Math.min(10, pd.v0 + 2) && pd.bOk === pd.b0 + 8 && pd.bNee < pd.b0 && (pd.soort === "verlengen" ? pd.res.langer : pd.soort === "uitbreiden" ? pd.res.meer : true) && pd.k2 === "klacht" && pd.korting === 1.8 && pd.kr && !pd.nogeens),
    "productdiepgang en contracten: gerichte verbetering +2, wens telt mee in het bod, evaluatie biedt verlenging of uitbreiding, klacht met korting: " + JSON.stringify(pd));
  // 11.6 thema van het spel, modegolf, crises, pakketten
  const u6 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(), oudK = window.kansRol; c.cash = 900; const p = c.producten.find(x => x.status === "markt"); if (!p) return {geen: true};
    const f0 = hypeF(c, p); c.hype = {aard: p.aard, f: 0.2, over: 3}; const f1 = hypeF(c, p); delete c.hype; const geenDesign = typeof DESIGN_STIJL === "undefined" && !actProduct(c, ctx, "design", {id: p.id, stijl: "neon"}).ok;
    window.kansRol = () => 0; c.maanden = 30; c.flags.crises_gehad = ["pandemie", "energie"]; delete c.crisis; crisisTick(c, ctx); const start = c.crisis && c.crisis.id, fase0 = crisisFase(c).naam, wv = crisisVraag(c, "wapen");
    for (let i = 0; i < 3; i++) crisisTick(c, ctx); const fase1 = crisisFase(c) && crisisFase(c).naam, wv1 = crisisVraag(c, "wapen");
    for (let i = 0; i < 30 && c.crisis; i++) crisisTick(c, ctx); const klaar = !c.crisis, opnieuw = (crisisTick(c, ctx), !!c.crisis);
    c.crisis = {id: "wo3", fase: 1, over: 5, conts: []}; c.aanvragen = []; window.kansRol = () => 0.3; aanvraagTick(c, Ctx()); const crisisOrder = c.aanvragen.some(a => a.crisis); delete c.crisis;
    window.kansRol = () => 0; delete c.hype; c.maanden = 30; hypeTick(c, ctx); const golf = !!(c.hype && PRODUCT_AARD[c.hype.aard]); window.kansRol = oudK;
    const a = maakAanvraag(c, p.aard); if (!a) return {geen2: true}; a.soort = "leger"; a.aard = p.aard; a.pakket = null; maakPakket(c, a); const delen = pakketDelen(c, a), eigenAlles = delen.every(x => !x.onder), geenAndere = PAKKET_COMBO.leger.filter(x => x !== p.aard && besteVanAard(c, x)).length === 0;
    const b2 = {...a, id: "pk1", raam: false, bedrag: 5, verloopt: 3, pakket: [{aard: p.aard, deel: 0.5}, {aard: Object.keys(PRODUCT_AARD).find(x => !besteVanAard(c, x)) || "orbitaal", deel: 0.5}]}; c.aanvragen.push(b2); const geblokt = !actAanvraag(c, Ctx(), "pk1", "normaal").ok;
    return {f0, f1, geenDesign, start, fase0, wv, fase1, wv1, klaar, opnieuw, crisisOrder, golf, pakket: !!a.pakket && a.pakket.length >= 2, som: a.pakket ? r1(a.pakket.reduce((t, x) => t + x.deel, 0)) : 1, eigenAlles, geenAndere, geblokt}; });
  const thema = await p.evaluate(async () => { const s = G.game, oud = JSON.parse(JSON.stringify(s.huisstijl || {})), cs = () => getComputedStyle(document.documentElement);
    await API["/api/huisstijl"]({thema: "ijs"}); render(); const bgIjs = cs().getPropertyValue("--bg").trim();
    await API["/api/huisstijl"]({eigen: {bg: "#101010", panel: "#203040", tekst: "#222222"}}); render(); const eigenBg = cs().getPropertyValue("--bg").trim(), tekst = cs().getPropertyValue("--text").trim();
    await API["/api/huisstijl"]({font: "terminal", hoeken: "rond", dichtheid: "compact", scan: false, glow: false}); render(); const cl = document.documentElement.classList, kl = ["ui-font-terminal", "ui-hoek-rond", "ui-dicht-compact", "ui-geenscan", "ui-geenglow"].every(x => cl.contains(x));
    const fout = (await API["/api/huisstijl"]({font: "comic"}), s.huisstijl.font === "terminal");
    S.menuThema = true; toonMenu(); const menu = !!document.querySelector('.hmenu .themapaneel [data-a="hsthema"][data-t="synthwave"]'); sluitMenu(); S.menuThema = false;
    s.huisstijl = oud; render(); return {bgIjs, eigenBg, tekst, kl, fout, menu, hersteld: !cl.contains("ui-font-terminal")}; });
  ok(u6.geen || u6.geen2 || (u6.f1 > u6.f0 && u6.geenDesign && u6.start === "wo3" && u6.fase0 === "Mobilisatie" && u6.wv === 25 && u6.fase1 === "Oorlog" && u6.wv1 === 60 && u6.klaar && !u6.opnieuw && u6.crisisOrder && u6.golf && (u6.pakket ? u6.eigenAlles && u6.som === 1 : u6.geenAndere) && u6.geblokt),
    "modegolf per soort, geen productontwerp meer, WO3 in fases met vraag en crisisorders, pakketcontracten alleen met eigen goederen: " + JSON.stringify(u6));
  ok(thema.bgIjs === "#020b14" && thema.eigenBg === "#101010" && thema.tekst && thema.tekst !== "#222222" && thema.kl && thema.fout && thema.menu && thema.hersteld,
    "thema van het spel: kant-en-klaar, eigen kleuren (tekst blijft leesbaar), lettertype, hoeken, dichtheid en effecten, ook via het menu: " + JSON.stringify(thema));
  // 11.7 huisstijl staat niet altijd open
  const hsd = await p.evaluate(async () => { const open = () => !!(document.querySelector("details.huisstijl") || {}).open; S.hsOpen = false;
    S.menuThema = true; toonMenu(); document.querySelector('.hmenu [data-a="hsui"][data-k="dichtheid"][data-v="normaal"]').click(); await new Promise(r => setTimeout(r, 300)); sluitMenu(); S.menuThema = false;
    goView("bedrijf"); const naMenu = open(); hsOpenZet(); render(); const zelf = open(); goView("overzicht"); goView("bedrijf"); const naWissel = open(); return {naMenu, zelf, naWissel}; });
  ok(!hsd.naMenu && hsd.zelf && !hsd.naWissel, "huisstijl op Bedrijf staat dicht, ook na een themawijziging via het menu; open terwijl je ermee bezig bent: " + JSON.stringify(hsd));
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close(); process.exit(log.some(l => l.startsWith("FOUT")) || errs.length ? 1 : 0);
})();
