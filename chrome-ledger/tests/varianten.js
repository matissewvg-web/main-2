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
  await vast(); const v1 = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.naam === "Basisdosis"), voor = x.pop; await API["/api/tick"]({force: true}); const q = s.producten.find(y => y.naam === "Basisdosis Pro"); return {status: q.status, start: q.variantStart, voor, na: x.pop, log: (x.log || []).map(l => l.tekst).join(" | ")}; }); await los();
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
  const wm = await p.evaluate(() => { const s = G.game, oud = JSON.parse(JSON.stringify(s)); delete oud.flags.herstel_wm_479; oud.hostile_bid = {uitslag: "verloren"}; oud.divisions = oud.divisions.filter(d => !/weapon/i.test(d.name || d.type));
    migrate(oud); const d = oud.divisions.find(x => x.name === "Weapon manufacturing"), ps = oud.producten.filter(x => x.divisie === "Weapon manufacturing"); oud.history = [{omzet: 30}];
    const om = ps.map(x => r1(prodOmzet(oud, x))); return {d: !!d, level: d && d.level, n: ps.length, namen: ps.map(x => x.naam), units: ps.map(x => stukInfo(x).eenheid), keur: ps.every(x => keurStatus(x) === "ok"), eigen: ps.every(x => x.delen.every(y => y.eigen)), om, dubbel: (migrate(oud), oud.divisions.filter(x => x.name === "Weapon manufacturing").length)}; });
  ok(wm.d && wm.level === 5 && wm.n === 7 && wm.keur && wm.eigen && wm.dubbel === 1 && wm.om.every(x => x > 0), "Weapon manufacturing terug met 7 producten, gekeurd en eigen fabriek: " + JSON.stringify(wm));
  const z = await p.evaluate(async () => { const s = G.game, oud = JSON.parse(JSON.stringify(s)); delete oud.flags.herstel_wm_479; delete oud.flags.herstel_wm_4710; oud.hostile_bid = {uitslag: "verloren"}; oud.divisions = oud.divisions.filter(d => !/weapon/i.test(d.name || d.type)); oud.gratisDev = 0;
    migrate(oud); const n1 = oud.producten.filter(x => x.divisie === "Weapon manufacturing").length, c1 = oud.cash; migrate(oud); const d = oud.divisions.find(x => x.name === "Weapon manufacturing");
    const n2 = oud.producten.filter(x => x.divisie === "Weapon manufacturing").length, extra = Math.round((oud.cash - c1) * 10) / 10; migrate(oud);
    G.game.gratisDev = 1; const c0 = G.game.cash, dv = G.game.divisions[0], r = await API["/api/product"]({soort: "ontwikkel", divisie: divNaam(dv), schaal: "vlag", focus: "standaard", naam: "Gratis Test"}); const betaald = Math.round((c0 - G.game.cash) * 10) / 10;
    return {n1, n2, level: d.level, extra, gratis: oud.gratisDev, ok: r.ok, betaald, over: G.game.gratisDev, nogmaals: oud.cash === c1 + 60 ? "ok" : oud.cash}; });
  ok(z.n1 === 7 && z.n2 === 0 && z.level === 6 && z.extra === 60 && z.gratis === 5 && (!z.ok || (z.betaald === 0 && z.over === 0)), "wapenlijn zelf bouwen: producten weg, niveau 6, +€60M, 5 gratis ontwikkelingen die echt niets kosten: " + JSON.stringify(z));
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
    const kand = playerDistricts(c).filter(d => d.id !== c.player.home_district && reachable(c, r.name, d)); const adv = adviezen(c).some(x => /op straat innemen/.test(x.tekst)); const oud = window.kansRol; window.kansRol = () => 0; corpoTick(c, ctx); window.kansRol = oud;
    return {kand: kand.length, adv, rep: ctx.rep.filter(x => /straat|Straat/.test(x))}; });
  ok(ct.kand >= 1 && ct.adv && ct.rep.length === 1, "rivalen vechten bij hoge spanning ook op straat (hooguit één per maand), Wat nu? waarschuwt: " + JSON.stringify(ct));
  // 5.6 gebied als dominantie
  const dm = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(G.game)), ctx = Ctx(); c.cash = 900; c.aanwezig = {}; for (const d of c.districts){ delete d.dom; delete d.domMnd; }
    domTick(c, ctx); const thuis = c.districts.find(d => d.id === c.player.home_district), thuisPct = Math.round(thuis.dom.player), cont0 = (regionDominance(c).find(r => r.id === thuis.continent).shares.find(x => x.o === "player") || {}).pct || 0;
    const nb = c.districts.find(d => (thuis.neighbors || []).includes(d.id) && d.control === "neutral"); if (!nb) return {geenBuur: true, thuisPct};
    for (const g of c.gangs || []) if (g.gebied) delete g.gebied[nb.id]; const k0 = c.cash, a1 = actAanwezig(c, ctx, nb.id); for (let i = 0; i < 4; i++) actAanwezig(c, ctx, nb.id); const betaald = Math.round((k0 - c.cash) * 10) / 10;
    const ver = c.districts.find(d => d.control === "neutral" && !reachable(c, "player", d)), nee = ver ? actAanwezig(c, ctx, ver.id).ok : false;
    const pcts = []; let m = 0; for (; m < 8 && nb.control !== "player"; m++){ domTick(c, ctx); pcts.push(Math.round(nb.dom.player)); }
    const cont1 = (regionDominance(c).find(r => r.id === thuis.continent).shares.find(x => x.o === "player") || {}).pct || 0;
    return {thuisPct, cont0, cont1, a1: a1.ok, betaald, kost: aanwezigKost(c, nb), nee, van: nb.control, maanden: m, pcts, melding: ctx.rep.filter(x => /dominantie/.test(x)), ink: aandeelInkomen(c)}; });
  const dmUI = await p.evaluate(() => { const thuis = G.game.player.home_district; S.view = "kaart"; S.dist = thuis; S.zone = null; render(); const t = document.querySelector("main").textContent; S.dist = null; render(); return /DOMINANTIE IN DIT DISTRICT/.test(t); });
  ok(dm.geenBuur ? dm.thuisPct >= 60 : (dm.thuisPct >= 60 && dm.a1 && dm.betaald > 0 && !dm.nee && dm.van === "player" && dm.maanden <= 7 && dm.melding.length === 1 && dm.cont1 > dm.cont0) && dmUI,
    "gebied als dominantie: aandelen per district, aanwezigheid kopen, neutraal district valt je toe na twee maanden boven 55%, continent telt aandelen, kaart toont dominantie: " + JSON.stringify(dm));
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
    const e = maakAanvraag(c); e.raam = false; e.bedrag = 10; delete e.maanden; delete e.perMaand; e.soort = "staat"; c.aanvragen.push(e); const cash0 = c.cash, r1 = actAanvraag(c, ctx, e.id, "normaal"), winst = Math.round((c.cash - cash0) * 10) / 10;
    const f = maakAanvraag(c); f.raam = true; f.maanden = 6; f.perMaand = 4; delete f.bedrag; f.soort = "staat"; c.aanvragen.push(f); actAanvraag(c, ctx, f.id, "hoog"); const con = c.contracten.find(x => x.id === f.id);
    const cash1 = c.cash; window.kansRol = () => 0.99; aanvraagTick(c, Ctx()); const maand = Math.round((c.cash - cash1) * 10) / 10;
    for (const p of c.producten) if ((p.aard || aardVan(p.type, p.naam)) === f.aard) p.status = "teruggeroepen"; const rep0 = c.reputation; const ctx4 = Ctx(); aanvraagTick(c, ctx4); window.kansRol = oud;
    return {n1, k, r1: r1.ok, winst, con: con ? {perMaand: con.perMaand, over: con.over} : null, maand, verbroken: ctx4.rep.some(x => /verbroken/.test(x)), repDaling: Math.round((rep0 - c.reputation) * 10) / 10, over: c.contracten.length}; });
  await p.evaluate(() => { crypto.getRandomValues = window.__echt9; });
  const klUI = await p.evaluate(() => { const s = G.game, a = maakAanvraag(s); (s.aanvragen ??= []).push(a); S.view = "bedrijf"; render(); const t = document.querySelector("main").textContent; s.aanvragen = s.aanvragen.filter(x => x !== a); render(); return /Klanten/.test(t) && /Scherp/.test(t) && /Afwijzen/.test(t); });
  ok(kl.n1 === 1 && kl.k[0] > kl.k[2] && kl.k[0] >= kl.k[1] && kl.k[1] >= kl.k[2] && kl.r1 && kl.winst === 5.5 && kl.con && kl.con.perMaand === 4.8 && kl.maand === 2.6 && kl.verbroken && kl.repDaling >= 5 && kl.over === 0 && klUI,
    "klanten komen naar jou: aanvraag verschijnt, scherp geeft meer kans dan hoog, levering betaalt 55% marge, raamcontract betaalt elke maand, zonder product verbroken met boete, kaart op Bedrijf: " + JSON.stringify(kl));
  ok(/VERKOOP/.test(verkoop) && /KEURING/.test(verkoop), "tabblad Verkoop en keuring");
  ok(/VARIANT/.test(scherm), "varianten staan op het productblad");
  if (out){ const bl = await p.$('.prodblad'); if (bl) await bl.screenshot({path: out + "/verkoop.png"}); }
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close(); process.exit(log.some(l => l.startsWith("FOUT")) || errs.length ? 1 : 0);
})();
