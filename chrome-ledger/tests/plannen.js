// Test voor 3.8: plannen van rivalen en syndicaten (start, ontdekken, verstoren, voorbereiden, uitvoeren, GM-tekst).
// Gebruik: node chrome-ledger/tests/plannen.js [map-voor-screenshots]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://plan.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://plan.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Doelwit NV", doctrine: ["Biotech"], home: "BNL", kapitaal: "ruim"}); G.game.cash = 500; G.game.maanden = 20; G.game.rivals[0].relatie = -60; });
  // 1. een plan start en blijft onzichtbaar tot het ontdekt is
  const st = await p.evaluate(() => { const s = G.game; for (let i = 0; i < 50 && !(s.plannen || []).length; i++) planStart(s, Ctx(), 10); const x = s.plannen[0]; return x && {soort: x.soort, wie: x.wie, stappen: x.stappen.length, ontdekt: x.ontdekt, vm: vm().plannen.length}; });
  ok(st && st.stappen === 3 && !st.ontdekt && st.vm === 0, "plan start, onzichtbaar zolang niet ontdekt: " + JSON.stringify(st));
  // 2. niet ontdekt: na drie stappen komt de klap als verrassing
  const v = await p.evaluate(() => { const s = G.game, orig = window.planKansOntdekt; window.planKansOntdekt = () => 0; const ctx = Ctx(), rep0 = s.reputation, cash0 = s.cash, staff0 = s.staff.count;
    for (let i = 0; i < 3; i++){ s.plannen[0] && (s.plannen[0].volgende = ym(s)); planTick(s, ctx, 0); } window.planKansOntdekt = orig;
    return {over: (s.plannen || []).length, mail: ctx.mails.map(m => m.onderwerp), veranderd: s.reputation !== rep0 || s.cash !== cash0 || s.staff.count !== staff0 || (s.lopende_effecten || []).length > 0}; });
  ok(v.over === 0 && v.mail.some(x => /^Te laat ontdekt/.test(x)) && v.veranderd, "onontdekt plan slaat toe met een verrassingsmail: " + JSON.stringify(v.mail));
  // 3. ontdekt: keuze met verstoren, voorbereiden, laten
  const k = await p.evaluate(async () => { const s = G.game; s.plannen = []; for (let i = 0; i < 50 && !s.plannen.length; i++) planStart(s, Ctx(), 10);
    const orig = window.planKansOntdekt; window.planKansOntdekt = () => 1; s.plannen[0].volgende = ym(s); const ctx = Ctx(); planTick(s, ctx, 0); window.planKansOntdekt = orig; await persist(ctx);
    const kz = s.keuzes.find(x => x.soort === "plan_" + s.plannen[0].id); return kz && {titel: kz.titel, opties: kz.opties.map(o => o.label), vm: vm().plannen.length, id: kz.id}; });
  ok(k && /^Ontdekt:/.test(k.titel) && k.opties.length === 3 && k.vm === 1, "ontdekt plan: keuze en zichtbaar bij Rivalen: " + JSON.stringify(k && k.opties));
  await p.evaluate(() => { S.view = "rivalen"; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => /Plannen tegen jou/.test(document.querySelector("main").textContent) && document.querySelectorAll(".planstap li").length === 3), "kaart Plannen tegen jou met de stappen");
  if (out) await p.screenshot({path: out + "/plannen.png"});
  // 4. voorbereiden halveert
  const z = await p.evaluate(async id => { const s = G.game; await API["/api/keuze"]({id, i: 1}); return !!s.plannen[0].zacht; }, k.id);
  ok(z, "voorbereiden zet het plan op half");
  // 5. verstoren met zekere worp stopt het plan
  // de dobbelstenen vastzetten (een natuurlijke 2 is altijd een blunder, ook bij kans 99): d6 leest crypto.getRandomValues
  const vs = await p.evaluate(() => { const s = G.game, x = s.plannen[0], out = [], echt = crypto.getRandomValues; crypto.getRandomValues = a => { a[0] = 3; return a; };
    try { applyChoice(s, Ctx(), {kans: 99, succes: {plan: {id: x.id, actie: "stop"}}, falen: {}}, out); } finally { crypto.getRandomValues = echt; } return {over: s.plannen.length, out}; });
  ok(vs.over === 0 && /verstoord/.test(vs.out.join(" ")), "verstoren met een goede worp stopt het plan: " + JSON.stringify(vs.out));
  // 6. GM schrijft de tekst, binnen grenzen
  const gm = await p.evaluate(async () => { const s = G.game; s.plannen = []; for (let i = 0; i < 50 && !s.plannen.length; i++) planStart(s, Ctx(), 10);
    G.sample = {json: async () => ({titel: "Operatie Stille Zomer ".repeat(10), stappen: ["koopt de havenmeester", "laat een schip zinken", "staat klaar met een nieuwe vloot"], motief: "U nam hun haven af in 2004."})}; G.sampleOff = false;
    await planGM(s); const x = s.plannen[0]; G.sample = null; return {titel: x.titel, len: x.titel.length, stappen: x.stappen, motief: x.motief}; });
  ok(gm.len <= 90 && gm.stappen[1] === "laat een schip zinken" && /haven/.test(gm.motief), "GM-tekst wordt overgenomen en ingekort: " + JSON.stringify(gm).slice(0, 160));
  // 7. lange run zonder fouten
  const run = await p.evaluate(() => { const s = G.game; let n = 0, ok = 0; for (let i = 0; i < 120 && s.status === "actief"; i++){ s.cash = Math.max(s.cash, 300); const ctx = tick(s); n += ctx.rep.filter(x => /^Plan uitgevoerd/.test(x)).length; } return {n, status: s.status, open: (s.plannen || []).length}; });
  ok(run.status !== undefined, "120 maanden met plannen zonder fouten: " + JSON.stringify(run));
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
