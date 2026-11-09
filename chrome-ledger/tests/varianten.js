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
  // 7. scherm
  await p.evaluate(() => { S.view = "bedrijf"; render(); }); const ds = await p.$('[data-a=prodsheet]'); if (ds){ await ds.click(); await p.waitForTimeout(200); }
  const scherm = await p.evaluate(() => { const el = document.querySelector(".prodblad"); return el ? el.textContent : ""; });
  await p.click('[data-a=prodtab][data-t=verkoop]'); await p.waitForTimeout(150); const verkoop = await p.evaluate(() => document.querySelector(".prodblad").textContent);
  ok(/VERKOOP/.test(verkoop) && /KEURING/.test(verkoop), "tabblad Verkoop en keuring");
  ok(/VARIANT/.test(scherm), "varianten staan op het productblad");
  if (out){ const bl = await p.$('.prodblad'); if (bl) await bl.screenshot({path: out + "/verkoop.png"}); }
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close(); process.exit(log.some(l => l.startsWith("FOUT")) || errs.length ? 1 : 0);
})();
