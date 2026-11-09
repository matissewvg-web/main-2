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
  // eerste stappen
  await p.evaluate(() => { S.view = "overzicht"; render(); });
  const stap0 = await p.$$eval(".stappen .stapl li", e => e.map(x => x.classList.contains("af")));
  ok(stap0.length === 5 && stap0.every(x => !x), "eerste stappen: 5 open stappen bij de start");
  if (out){ await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({path: out + "/eerste-stappen.png"}); }
  await p.evaluate(() => { S.view = "bedrijf"; render(); });
  // startideeën
  const st = await p.$$eval(".starter [data-a=starter]", e => e.map(x => x.dataset.v));
  ok(st.includes("product") && st.includes("abonnement"), "lege divisie toont startideeën: " + st.join(", "));
  if (out){ await p.evaluate(() => { const el = document.querySelector(".starter"); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/starter.png"}); }
  await p.click('.starter [data-v=abonnement]'); await p.waitForTimeout(300);
  const ab = await p.evaluate(() => G.game.producten.map(x => ({naam: x.naam, soort: x.soort, status: x.status})));
  ok(ab.length === 1 && ab[0].soort === "abonnement" && ab[0].status === "ontwikkeling", "abonnement gestart met één klik: " + JSON.stringify(ab));
  await p.evaluate(() => { S.view = "overzicht"; render(); });
  ok(await p.evaluate(() => document.querySelector(".stappen .stapl li").classList.contains("af")), "stap 1 is afgevinkt na het eerste product");
  await p.click("[data-a=stappenweg]"); await p.waitForTimeout(200); ok(!(await p.$(".stappen")), "Verbergen haalt de kaart weg");
  // abonnees: forceer een gewone lancering en speel 12 maanden
  const verloop = await p.evaluate(async () => { const q = G.game.producten[0]; q.doelOverride = 2; const rij = [];
    for (let i = 0; i < 14; i++){ await API["/api/tick"]({force: true}); const x = G.game.producten.find(y => y.id === q.id); if (!x) return ["weg"]; if (x.status === "markt") rij.push([x.pop, x.abo, x.aboIn, x.aboUit]); if (G.game.status !== "actief") break; }
    return rij; });
  ok(verloop.length >= 8 && verloop.every(r => r[1] != null) && verloop[verloop.length - 1][1] > verloop[0][1], "abonnees groeien na de lancering: " + JSON.stringify(verloop.map(r => r[1])));
  const schok = await p.evaluate(() => { const x = G.game.producten[0], voor = x.abo, voorPop = x.pop; applyChoice(G.game, Ctx(), {product: {[x.id]: {pop: -25}}}); return {voor, na: x.abo, voorPop, naPop: x.pop}; });
  ok(schok.na < schok.voor && schok.na > schok.voor * 0.6, "een schandaal kost abonnees, maar niet allemaal: " + JSON.stringify(schok));
  await p.evaluate(() => { S.view = "bedrijf"; render(); });
  const rij = await p.evaluate(() => [...document.querySelectorAll(".prow .dim")].map(x => x.textContent).find(t => /abonnees/.test(t)) || "");
  ok(/\d+ abonnees \(\+\d+ \/ −\d+ per mnd, [\d.]+% zegt op\)/.test(rij), "productlijn toont abonnees: " + rij.slice(0, 120));
  if (out){ await p.evaluate(() => { const el = [...document.querySelectorAll(".prow")].find(x => /abonnees/.test(x.textContent)); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 200); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/abonnement.png"}); }
  // 3.9: loyaliteit, prijsverhoging, concurrent die abonnees weglokt
  const loy = await p.evaluate(async () => { const x = G.game.producten[0], c0 = aboChurn(x); await API["/api/product"]({soort: "loyaliteit", id: x.id}); const c1 = aboChurn(x), cash0 = G.game.cash; aboTick(G.game, x, Ctx()); const kost = r1(cash0 - G.game.cash);
    const a0 = x.abo; await API["/api/product"]({soort: "prijs", id: x.id, prijs: "premium"}); const a1 = x.abo;
    let k = null; for (let i = 0; i < 400 && !k; i++){ aboTick(G.game, x, Ctx()); k = G.game.keuzes.find(y => y.soort === "abo_" + x.id); }
    return {c0, c1, kost, a0, a1, keuze: k && k.opties.map(o => o.label)}; });
  ok(loy.c1 < loy.c0 && loy.kost > 0, "loyaliteitsprogramma verlaagt opzeggers en kost geld: " + JSON.stringify([loy.c0, loy.c1, loy.kost]));
  ok(loy.a1 < loy.a0 * 0.97 && loy.a1 > loy.a0 * 0.85, "prijsverhoging naar premium kost 3-15% abonnees: " + JSON.stringify([loy.a0, loy.a1]));
  // 4.3 stap 2: vrije prijs met prijsgevoeligheid (deterministisch, geen worpen)
  const prijs = await p.evaluate(async () => { const s = G.game, d = s.divisions[0], q = {id: "tp", naam: "Testding", divisie: divNaam(d), type: d.type, aard: "consument", kwaliteit: 3, pop: 50, status: "markt", soort: "product", leeftijd: 5};
    const a = prijsProef(s, q, 1), b = prijsProef(s, q, 1.5), c = prijsProef(s, q, 0.7), best = besteprijs(s, q), m1 = prijsProef(s, {...q, aard: "medisch"}, 1), m = prijsProef(s, {...q, aard: "medisch"}, 1.5);
    const u1 = prijsProef(s, {...q, pop: 95}, 1), u2 = prijsProef(s, {...q, pop: 95}, 1.1);
    const x = G.game.producten[0], r = await API["/api/product"]({soort: "prijs", id: x.id, f: 1.3}), f1 = x.prijsF, l1 = x.prijs, r2 = await API["/api/product"]({soort: "prijs", id: x.id, f: 9});
    return {a, b, c, best, m1, m, u1, u2, ok: r.ok, f: f1, label: l1, f2: G.game.producten[0].prijsF, ok2: r2.ok}; });
  ok(prijs.b.vraag < prijs.a.vraag && prijs.c.vraag > prijs.a.vraag, "duurder verkoopt minder, goedkoper meer: " + JSON.stringify([prijs.c.vraag, prijs.a.vraag, prijs.b.vraag]));
  ok(prijs.b.stukPrijs > prijs.a.stukPrijs && prijs.c.stukPrijs < prijs.a.stukPrijs, "stukprijs volgt de schuif");
  ok(prijs.best.winst >= prijs.a.winst && prijs.best.winst >= prijs.b.winst && prijs.best.winst >= prijs.c.winst, "beste prijs geeft de meeste winst: " + JSON.stringify(prijs.best));
  ok(prijs.b.winst < prijs.a.winst && prijs.m.winst > prijs.m1.winst, "consumenten haken af bij 150%, medische klanten betalen het: " + JSON.stringify([prijs.a.winst, prijs.b.winst, prijs.m1.winst, prijs.m.winst]));
  ok(prijs.u2.omzet > prijs.u1.omzet, "uitverkocht: een hogere prijs kost geen afzet: " + JSON.stringify([prijs.u1, prijs.u2]));
  // 4.3.3: klantsegmenten (deterministisch)
  const seg = await p.evaluate(() => { const q = {id: "ts", naam: "Testdosis", type: "Biotech", aard: "medisch", kwaliteit: 3, pop: 50, status: "markt", soort: "product", leeftijd: 5};
    const laag = segmenten({...q, prijsF: 0.7}).rows, hoog = segmenten({...q, prijsF: 1.6}).rows, som = laag.reduce((t, x) => t + x.pct, 0);
    const straatL = laag.find(x => x.naam === "Straatklinieken").pct, straatH = hoog.find(x => x.naam === "Straatklinieken").pct, rijkL = laag.find(x => x.naam === "Rijke particulieren").pct, rijkH = hoog.find(x => x.naam === "Rijke particulieren").pct;
    const alle = Object.keys(SEGMENTEN).every(a => SEGMENTEN[a].length === 3 && Math.abs(SEGMENTEN[a].reduce((t, x) => t + x[1], 0) - 1) < 1e-9 && SEGMENTEN[a].every(x => SPECS[a][x[3]]));
    return {som, straatL, straatH, rijkL, rijkH, alle}; });
  ok(seg.alle && seg.som >= 99 && seg.som <= 101, "elk soort heeft drie segmenten die samen de markt vormen");
  ok(seg.straatH < seg.straatL && seg.rijkH > seg.rijkL, "hoge prijs: straatklinieken haken af, rijke particulieren blijven: " + JSON.stringify(seg));
  // 4.4 stap 1: nadruk in het ontwerp en vergelijking met rivalen (deterministisch)
  const nd = await p.evaluate(async () => { const s = G.game, q = {id: "tn", naam: "Testdosis", type: "Biotech", aard: "medisch", kwaliteit: 3, pop: 50, status: "markt", soort: "product", leeftijd: 5};
    const s0 = prodSpecs(q), s1 = prodSpecs({...q, nadruk: 1}), z0 = segmenten(q, null).rows.find(x => x.naam === "Ziekenhuizen").pct, z1 = segmenten({...q, nadruk: 1}, null).rows.find(x => x.naam === "Ziekenhuizen").pct;
    const nep = {rivals: [{name: "Rivaal", producten: [{naam: "Zwak", aard: "medisch", kwaliteit: 1, pop: 50}]}]}, nep2 = {rivals: [{name: "Rivaal", producten: [{naam: "Sterk", aard: "medisch", kwaliteit: 5, pop: 50}]}]};
    const tegenZwak = segmenten(q, nep).tot, tegenSterk = segmenten(q, nep2).tot;
    const d = s.divisions[0], vrij = maxProducten(d) - s.producten.filter(x => x.divisie === divNaam(d) && x.status !== "teruggeroepen").length; s.cash += 200;
    let opgeslagen = null, delenOk = null; if (vrij > 0){ const r = await API["/api/product"]({soort: "ontwikkel", divisie: divNaam(d), schaal: "klein", focus: "standaard", aard: "medisch", nadruk: "2", delen: "premium", naam: "Nadruktest"}); const x = s.producten.find(y => y.naam === "Nadruktest"); opgeslagen = x ? x.nadruk : "geen product: " + r.bericht; delenOk = !!x && x.delen.length === 3 && x.delen.every(z => z.kwal === "premium") && Math.abs(kostFactor(x) - 1.28) < 1e-9; }
    return {s0: s0.map(x => x.v), s1: s1.map(x => x.v), z0, z1, tegenZwak, tegenSterk, vrij, opgeslagen, delenOk}; });
  ok(nd.s1[1] === Math.min(10, nd.s0[1] + 2) && nd.s1[2] === Math.max(1, nd.s0[2] - 1) && nd.s1[0] === nd.s0[0], "nadruk: +2 op de gekozen eigenschap, −1 op de volgende: " + JSON.stringify([nd.s0, nd.s1]));
  ok(nd.z1 > nd.z0, "nadruk op veiligheid: ziekenhuizen kopen een groter deel: " + JSON.stringify([nd.z0, nd.z1]));
  ok(nd.tegenZwak > nd.tegenSterk, "tegen zwakke rivalen verkoop je meer dan tegen sterke: " + JSON.stringify([nd.tegenZwak, nd.tegenSterk]));
  ok(nd.vrij <= 0 || nd.opgeslagen === 2, "nadruk wordt bij ontwikkelen bewaard: " + JSON.stringify(nd.opgeslagen));
  ok(nd.vrij <= 0 || nd.delenOk === true, "onderdelen kiezen bij ontwikkelen (alles premium = kostprijs ×1,28)");
  // 4.4.1: onderdelen (deterministisch)
  const od = await p.evaluate(async () => { const s = G.game, q = {id: "to", naam: "Testwapen", type: "Private Security", aard: "wapen", kwaliteit: 3, pop: 50, status: "markt", soort: "product", leeftijd: 5};
    const f0 = kostFactor(q), k0 = kostPrijs(q), sp0 = prodSpecs({...q, delen: []}).map(x => x.v);
    const qg = {...q, delen: [{kwal: "goedkoop"}]}, qp = {...q, delen: [{kwal: "premium"}]};
    const x = s.producten.find(y => y.status === "markt"), cash0 = s.cash, kp0 = kostPrijs(x), r = await API["/api/product"]({soort: "onderdeel", id: x.id, i: 0, kwal: "premium"}), kp1 = kostPrijs(x), betaald = r1(cash0 - s.cash);
    const lv = leverancier(s, x, 0), nep = {id: lv ? lv.id : "x", naam: lv ? lv.naam : "x"}; s.bedrijven = s.bedrijven.filter(b => b.id !== nep.id); const ctx = Ctx(); leverancierWeg(s, ctx, nep);
    return {f0, k0, kg: kostPrijs(qg), kp: kostPrijs(qp), sp0, spg: prodSpecs(qg).map(x => x.v), spp: prodSpecs(qp).map(x => x.v), ok: r.ok, kp0, kp1, betaald, oms: omschakelKost(s), nieuw: x.delen[0].lev, oud: nep.id, melding: ctx.rep.join(" ")}; });
  ok(Math.abs(od.f0 - 1) < 1e-9, "standaard onderdelen kosten precies wat een product vroeger kostte");
  ok(od.kg < od.k0 && od.kp > od.k0 && od.spg[1] === Math.max(1, od.sp0[1] - 1) && od.spp[1] === Math.min(10, od.sp0[1] + 1), "goedkoop: lagere kostprijs en −1 betrouwbaarheid; premium: hoger en +1: " + JSON.stringify(od));
  ok(od.ok && od.kp1 > od.kp0 && od.betaald === od.oms, "omschakelen op de markt kost geld en verandert de kostprijs: " + JSON.stringify([od.kp0, od.kp1, od.betaald]));
  ok(od.nieuw !== od.oud && /failliet/.test(od.melding), "failliete leverancier wordt vervangen: " + od.melding);
  ok(prijs.ok && prijs.f === 1.3 && prijs.label === "premium" && prijs.f2 === 1.8, "prijs exact instellen, begrensd op 180%: " + JSON.stringify([prijs.f, prijs.label, prijs.f2]));
  ok(loy.keuze && loy.keuze.length === 3, "concurrent lokt abonnees weg: keuze " + JSON.stringify(loy.keuze));
  // overname en koppelen
  const ov = await p.evaluate(async () => { const s = G.game, bd = s.bedrijven.find(x => !x.eigenaar && x.sector === "Biotech") || s.bedrijven.find(x => !x.eigenaar); bd.relatie = 100; bd.aandeel = 30; s.reputation = 90;
    let r; for (let i = 0; i < 30; i++){ s.cash = 5000; r = await API["/api/bedrijf"]({id: bd.id, soort: "overname"}); if (bd.eigenaar === "player") break; }
    const k = s.keuzes.find(x => x.soort === "koppel_" + bd.id); return {naam: bd.naam, sector: bd.sector, bericht: r.bericht, opties: k && k.opties.map(o => o.label), id: k && k.id, divs: s.divisions.length}; });
  ok(ov.opties && ov.opties.some(x => /Samenvoegen|Eigen divisie/.test(x)) && ov.opties.some(x => /dochter/.test(x)) && ov.opties.some(x => /Opknippen/.test(x)), "na de overname kies je hoe je koppelt: " + JSON.stringify(ov.opties));
  ok(/Kies in het overzicht hoe je het koppelt/.test(ov.bericht), "bericht legt uit wat er nu gebeurt");
  const na = await p.evaluate(async id => { const s = G.game, k = s.keuzes.find(x => x.id === id), i = k.opties.findIndex(o => /Eigen divisie|Samenvoegen/.test(o.label)); const r = await API["/api/keuze"]({id, i}); return {r: r.bericht, divs: s.divisions.map(d => `${d.name || d.type} L${d.level}`), prod: s.producten.map(x => x.naam + ":" + x.status)}; }, ov.id);
  ok(na.prod.length >= 2 && /meteen op de markt/.test(na.r), "koppelen brengt de bestseller mee: " + JSON.stringify(na));
  // 4.0: productblad en capaciteit
  await p.evaluate(() => { S.view = "bedrijf"; render(); });
  await p.click("[data-a=prodsheet]"); await p.waitForTimeout(200);
  const blad = await p.evaluate(() => { const el = document.querySelector(".prodblad"); return el && {specs: el.querySelectorAll(".spec").length, tekst: el.textContent}; });
  const tab = async t => { await p.click(`[data-a=prodtab][data-t=${t}]`); await p.waitForTimeout(150); return p.evaluate(() => document.querySelector(".prodblad").textContent); };
  const tMarkt = await tab("markt"), tPrijs = await tab("prijs"), tDelen = await tab("onderdelen"); await tab("overzicht");
  ok(blad && blad.specs === 3 && /Kostprijs/.test(blad.tekst) && /capaciteit/.test(blad.tekst) && /Jouw aandeel/.test(tMarkt) && /KLANTEN/.test(tPrijs) && /ONDERDELEN/.test(tDelen) && !/ONDERDELEN/.test(blad.tekst), "productblad in tabbladen: overzicht, prijs en klanten, onderdelen, markt");
  if (out){ await p.evaluate(() => { const el = document.querySelector(".prodblad"); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 160); }); await p.waitForTimeout(150); await p.screenshot({path: out + "/productblad.png"}); }
  const cap = await p.evaluate(async () => { const s = G.game, x = s.producten.find(y => y.status === "markt" && !isAbo(y)) || s.producten[0]; x.pop = 99; const c0 = prodCap(s, x), w0 = prodGewicht(x, s);
    const adv = adviezen(s).some(a => /uitverkocht/.test(a.tekst)); await API["/api/product"]({soort: "capaciteit", id: x.id}); return {c0, c1: prodCap(s, x), w0, w1: prodGewicht(x, s), adv}; });
  ok(cap.c1 === cap.c0 + 15 && cap.w1 > cap.w0 && cap.adv, "capaciteit is een echte grens en uitbreiden helpt: " + JSON.stringify(cap));
  // 3.10: koers (strategiedag)
  const fc = await p.evaluate(async () => { const s = G.game, m0 = s.maanden; s.maanden = 18; const ctx = Ctx(); focusTick(s, ctx); await persist(ctx); const k = s.keuzes.find(x => x.soort === "focus"); if (!k) return null;
    const i = k.opties.findIndex(o => o.eff.focus === "rd"), d = s.divisions[0], voor = devPlan(s, d, "klein", "standaard", "medisch").maanden; const id = i >= 0 ? "rd" : k.opties[0].eff.focus;
    await API["/api/keuze"]({id: k.id, i: Math.max(0, i)}); const na = devPlan(s, d, "klein", "standaard", "medisch").maanden; s.maanden = m0; S.view = "bedrijf"; render();
    return {opties: k.opties.map(o => o.label), gekozen: id, focus: s.focus, rd: id === "rd" ? [voor, na] : null, kaart: /Koers/.test(document.querySelector("main").textContent)}; });
  ok(fc && fc.opties.length === 3 && fc.focus.includes(fc.gekozen) && fc.kaart && (!fc.rd || fc.rd[1] === Math.max(1, fc.rd[0] - 1)), "strategiedag: kies een koers die blijft: " + JSON.stringify(fc));
  // 3.9: dochters
  const dt = await p.evaluate(async () => { const s = G.game, b = s.bedrijven.find(x => !x.eigenaar); b.eigenaar = "player"; b.aandeel = 100; koppelBedrijf(s, b.id, "dochter"); S.view = "bedrijf"; render();
    const zicht = /Je dochters/.test(document.querySelector("main").textContent), stream0 = s.streams.some(x => x.naam === "Dochter " + b.naam), cash0 = s.cash;
    const r = await API["/api/dochter"]({id: b.id, actie: "verkoop"}); return {zicht, stream0, na: s.streams.some(x => x.naam === "Dochter " + b.naam), winst: r1(s.cash - cash0), eigenaar: b.eigenaar, r: r.bericht}; });
  ok(dt.zicht && dt.stream0 && !dt.na && dt.winst > 0 && !dt.eigenaar, "dochter zichtbaar en te verkopen: " + JSON.stringify(dt));
  // kaart: labels mogen niet overlappen, gebieden met het toetsenbord
  for (const z of [1, 3]){
    await p.evaluate(z => { S.view = "kaart"; S.zoom = z; render(); }, z); await p.waitForTimeout(250);
    const ov = await p.evaluate(() => { const r = [...document.querySelectorAll("svg.map .lbl .dn, svg.map .zn")].map(t => t.getBoundingClientRect()).filter(b => b.width); let n = 0;
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++){ const a = r[i], b = r[j]; if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) n++; } return {labels: r.length, overlap: n}; });
    ok(ov.overlap === 0 && ov.labels > 10, `kaartlabels overlappen niet bij zoom ${z}: ` + JSON.stringify(ov));
    if (out && z === 3) await p.screenshot({path: out + "/kaart-zoom3.png"});
  }
  await p.evaluate(() => { S.zoom = 1; S.dist = null; render(); document.querySelector("g[data-dist][tabindex]").focus(); }); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!S.dist), "een gebied kiezen met Enter werkt");
  await p.evaluate(() => { S.dist = null; render(); });
  // GM op elk scherm
  await p.evaluate(() => { S.view = "kaart"; render(); });
  ok(await p.$(".gmfab") != null, "GM-knop op de kaart");
  await p.keyboard.press("g"); await p.waitForTimeout(200);
  ok(await p.$("#gmtxt") != null && await p.evaluate(() => S.view) === "kaart", "toets G opent de GM zonder de kaart te verlaten");
  await p.fill("#gmtxt", "Wat moet ik nu doen?"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  const gm = await p.evaluate(() => (G.chats.gm || {berichten: []}).berichten.map(b => b.van + ":" + (b.tekst || b.status)));
  ok(gm.some(x => /^ik:Wat moet ik nu doen/.test(x)), "bericht komt in het GM-gesprek: " + JSON.stringify(gm.slice(-2)));
  if (out) await p.screenshot({path: out + "/gm-dock.png"});
  await p.click('[data-a=gmsnel][data-k=watnu]'); await p.waitForTimeout(250);
  const snel = await p.evaluate(() => G.chats.gm.berichten.slice(-1)[0]);
  ok(snel && snel.van === "zij" && /Uit de cijfers/.test(snel.tekst) && /1\./.test(snel.tekst), "Wat nu? antwoordt ook zonder live GM: " + (snel && snel.tekst || "").slice(0, 90));
  await p.click('[data-a=gmsnel][data-k=stand]'); await p.waitForTimeout(250);
  ok(/Dichtst bij winst/.test(await p.evaluate(() => G.chats.gm.berichten.slice(-1)[0].tekst)), "Hoe sta ik ervoor? geeft de stand");
  if (out) await p.screenshot({path: out + "/gm-snel.png"});
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.waitForTimeout(150); ok(!(await p.$(".gmpanel")), "Esc sluit de GM");
  await p.setViewportSize({width: 390, height: 844}); await p.evaluate(() => { S.gmDock = false; S.view = "overzicht"; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
  const stats = await p.$$eval(".stats .stat", e => e.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), x.querySelector(".v").scrollWidth <= x.querySelector(".v").clientWidth + 1]; }));
  ok(stats.length >= 6 && stats.every(([l, r]) => l >= 0 && r <= 390), "statusbalk past op 390 px: " + JSON.stringify(stats.map(x => x.slice(0, 2))));
  if (out) await p.screenshot({path: out + "/mobiel-top.png"}); await p.evaluate(() => { S.gmDock = true; S.view = "overzicht"; render(); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), "GM-paneel past op 390 px");
  if (out) await p.screenshot({path: out + "/gm-dock-mobiel.png"});
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
