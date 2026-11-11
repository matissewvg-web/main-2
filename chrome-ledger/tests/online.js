// Test voor de online opslag (window.claude.use("db")) met een nagebootste database die herladen overleeft.
// Controleert: compacte saves, geen eindeloze save-lus, herladen, back-ups, inbox opruimen, spellen wisselen, chats.
// Gebruik: node chrome-ledger/tests/online.js
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact");
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
const MOCK = () => {
  const KEY = "__mockdb", load = () => JSON.parse(localStorage.getItem(KEY) || "{}"), store = load(), subs = [];
  window.__writes = []; const save = () => localStorage.setItem(KEY, JSON.stringify(store));
  const notify = p => setTimeout(() => { for (const s of subs) if (s.match(p)) s.fire(); }, 0);
  const kids = col => Object.keys(store).filter(k => k.startsWith(col + "/") && !k.slice(col.length + 1).includes("/"));
  const doc = p => ({
    async get(){ return {exists: p in store, data: () => JSON.parse(JSON.stringify(store[p]))}; },
    async set(o){ store[p] = JSON.parse(JSON.stringify(o)); window.__writes.push(p); save(); notify(p); },
    async update(o){ if (!(p in store)) throw new Error("not-found " + p); Object.assign(store[p], JSON.parse(JSON.stringify(o))); window.__writes.push(p); save(); notify(p); },
    async delete(){ delete store[p]; window.__writes.push("del " + p); save(); notify(p); },
    onSnapshot(cb){ const fire = () => cb({exists: p in store, data: () => JSON.parse(JSON.stringify(store[p]))}); subs.push({match: x => x === p, fire}); setTimeout(fire, 0); return () => {}; }});
  const col = c => { const q = (f, dir, n) => ({limit: m => q(f, dir, m), onSnapshot(cb){ const fire = () => { let ks = kids(c).sort((a, b) => (store[a][f] || 0) - (store[b][f] || 0)); if (dir === "desc") ks.reverse(); if (n) ks = ks.slice(0, n); cb({docs: ks.map(k => ({id: k.slice(c.length + 1), data: () => JSON.parse(JSON.stringify(store[k]))}))}); }; subs.push({match: x => x.startsWith(c + "/"), fire}); setTimeout(fire, 0); return () => {}; }});
    return {doc: id => doc(c + "/" + id), orderBy: (f, dir) => q(f, dir), onSnapshot: q(null, null).onSnapshot, async get(){ return {docs: kids(c).map(k => ({id: k.slice(c.length + 1), data: () => JSON.parse(JSON.stringify(store[k])), ref: doc(k)}))}; }}; };
  window.claude = {use: async n => n === "db" ? {doc, collection: col} : null};
};
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1300, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept()); await c.addInitScript(MOCK);
  await c.route("http://online.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.goto("http://online.test/"); await p.waitForTimeout(1200); await p.mouse.click(5, 5); await p.waitForTimeout(500);
  ok(await p.evaluate(() => G.mode) === "db", "online modus actief");
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Wolk BV", doctrine: ["Biotech"], home: "BNL"}); for (let i = 0; i < 6; i++) await API["/api/tick"]({force: true}); });
  await p.waitForTimeout(800);
  const doc = await p.evaluate(() => { const st = JSON.parse(localStorage.getItem("__mockdb")), d = st["games/" + G.gid]; return {kb: Math.round(JSON.stringify(d).length / 1024), gedeeld: !!(d.s.map && d.s.map.gedeeld), backups: Object.keys(st).filter(k => k.startsWith("games/" + G.gid + "/backups/")).length}; });
  ok(doc.kb < 70 && doc.gedeeld, `online save is compact (${doc.kb} KB, kaart gedeeld)`);
  ok(doc.backups >= 2, `back-ups online: ${doc.backups}`);
  const w0 = await p.evaluate(() => window.__writes.filter(x => x === "games/" + G.gid).length); await p.waitForTimeout(2000);
  const w1 = await p.evaluate(() => window.__writes.filter(x => x === "games/" + G.gid).length);
  ok(w1 === w0, `geen eindeloze save-lus (${w1 - w0} extra schrijfacties in 2 s)`);
  const kaart = await p.evaluate(() => { S.view = "kaart"; render(); return {frame: !!G.game.map.frame, paden: document.querySelectorAll("main svg path, main svg polygon").length}; });
  ok(kaart.frame && kaart.paden > 40, "kaart werkt na een online snapshot: " + JSON.stringify(kaart));
  const inbox = await p.evaluate(() => { const st = JSON.parse(localStorage.getItem("__mockdb")); const ms = Object.entries(st).filter(([k]) => k.startsWith("games/" + G.gid + "/mails/")).map(([, v]) => v);
    return {rapportenOpen: ms.filter(m => /^Maandrapport/.test(m.onderwerp) && !m.archief).length, rapportenArchief: ms.filter(m => /^Maandrapport/.test(m.onderwerp) && m.archief).length}; });
  ok(inbox.rapportenOpen <= 3 && inbox.rapportenArchief >= 2, "oude maandrapporten online gearchiveerd: " + JSON.stringify(inbox));
  await p.evaluate(async () => { await chatSend("gm", "Hallo GM"); });
  await p.reload(); await p.waitForTimeout(1500);
  const na = await p.evaluate(() => ({naam: G.game && G.game.player.corp_name, maand: G.game && ym(G.game), frame: !!(G.game && G.game.map.frame), chat: ((G.chats.gm || {}).berichten || []).some(b => b.tekst === "Hallo GM"), mails: G.mails.length}));
  ok(na.naam === "Wolk BV" && na.frame && na.chat && na.mails > 3, "na herladen: spel, kaart, mail en chat terug: " + JSON.stringify(na));
  const bk = await p.evaluate(async () => { const L = await Store.backups(); return L.length && {n: L.length, kaart: !!L[0].s.map.frame}; });
  ok(bk && bk.kaart, "online back-ups laden met kaart: " + JSON.stringify(bk));
  const sl = await p.evaluate(async () => { const g0 = G.gid; const r = await API["/api/nieuw"](); await new Promise(r => setTimeout(r, 400)); await API["/api/setup"]({...S.setup, corp_name: "Tweede BV", doctrine: ["Logistiek"], home: "BNL"}); await new Promise(r => setTimeout(r, 400));
    const L = await Store.slots(); await Store.switchSlot(g0); await new Promise(r => setTimeout(r, 800)); return {ok: r.ok, n: L.length, terug: G.game && G.game.player.corp_name}; });
  ok(sl.ok && sl.n >= 2 && sl.terug === "Wolk BV", "online spellen wisselen: " + JSON.stringify(sl));
  /* 10.5: een browserstand die verder is dan online wordt aangeboden, en online zetten maakt een apart spel (niets overschreven) */
  const g1 = await p.evaluate(() => { const L = JSON.parse(JSON.stringify(G.game)); L.maanden = (L.maanden ?? L.history.length) + 7; L.cash = 777; localStorage.setItem("cl_spel_v2", JSON.stringify({game: L, mails: [], chats: {}, t: Date.now() + 3600000})); return G.gid; });
  await p.reload(); await p.waitForTimeout(1500);
  const aan = await p.evaluate(() => ({nieuwer: !!S.lokaalNieuwer, knop: !!document.querySelector('[data-a="lokaalonline"]')}));
  ok(aan.nieuwer && aan.knop, "nieuwere browserstand wordt aangeboden: " + JSON.stringify(aan));
  await p.click('[data-a="lokaalonline"]'); await p.waitForTimeout(1500);
  const om = await p.evaluate(g1 => { const st = JSON.parse(localStorage.getItem("__mockdb")); return {anders: G.gid !== g1, cash: G.game && G.game.cash, oudBestaat: !!st["games/" + g1], huidig: st["meta/huidig"].gid === G.gid, kaart: !!document.querySelector("main")}; }, g1);
  ok(om.anders && om.cash === 777 && om.oudBestaat && om.huidig && om.kaart, "browserstand als apart spel online gezet, oud spel bewaard: " + JSON.stringify(om));
  await p.reload(); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !S.lokaalNieuwer && G.game && G.game.cash === 777), "na herladen geen nieuwe vraag en de browserstand speelt verder");
  ok(await p.evaluate(() => (G.fouten || []).length) === 0, "geen fouten in de foutlog: " + JSON.stringify(await p.evaluate(() => G.fouten)));
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
