// Test voor saveslots: twee spellen maken, wisselen, hernoemen en verwijderen (browseropslag).
// Gebruik: node chrome-ledger/tests/spellen.js [map-voor-screenshot]
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "artifact"), out = process.argv[2];
const html = '<!doctype html><html><head><meta charset=utf8></head><body>' + fs.readFileSync(path.join(DIR, "chrome-ledger.html"), "utf8") + "</body></html>";
(async () => {
  const b = await chromium.launch(), c = await b.newContext({viewport: {width: 1400, height: 900}}), p = await c.newPage(), errs = [], log = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await c.route("http://spel.test/**", r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({contentType: "text/html", body: html}); const f = path.join(DIR, u); return fs.existsSync(f) ? r.fulfill({path: f}) : r.fulfill({status: 404, body: ""}); });
  await p.goto("http://spel.test/"); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(500);
  const ok = (v, t) => log.push((v ? "OK   " : "FOUT ") + t);
  await p.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "Alfa Holding"}); await API["/api/tick"]({force: true}); await API["/api/tick"]({force: true}); });
  const alfa = await p.evaluate(() => ({gid: G.gid, datum: ym(G.game)}));
  await p.evaluate(async () => { await API["/api/nieuw"](); await API["/api/setup"]({...S.setup, corp_name: "Beta Corp", home: "JPN"}); await API["/api/tick"]({force: true}); });
  const beta = await p.evaluate(() => ({gid: G.gid, naam: G.game.player.corp_name}));
  ok(beta.gid !== alfa.gid && beta.naam === "Beta Corp", `nieuw spel heeft eigen id (${beta.naam})`);
  await p.evaluate(() => { G.slots = null; S.view = "logboek"; render(); }); await p.waitForTimeout(400);
  const lijst = await p.evaluate(() => (G.slots || []).map(x => `${x.naam}|${x.datum}`)); ok(lijst.length === 2, "twee spellen in de lijst: " + lijst.join(", "));
  if (out) await p.screenshot({path: out + "/spellen.png", fullPage: true});
  await p.click(`[data-a=slot][data-s=wissel][data-g="${alfa.gid}"]`); await p.waitForTimeout(400);
  const na = await p.evaluate(() => ({naam: G.game && G.game.player.corp_name, datum: G.game && ym(G.game), mails: G.mails.length}));
  ok(na.naam === "Alfa Holding" && na.datum === alfa.datum, `gewisseld naar Alfa (${na.naam}, ${na.datum}, ${na.mails} mails)`);
  await p.evaluate(() => { S.view = "logboek"; render(); }); await p.waitForTimeout(200);
  await p.click(`[data-a=slot][data-s=naam][data-g="${beta.gid}"]`); await p.fill("#nm_in", "Mijn tweede run"); await p.click('.modal [data-x="1"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(g => (G.slots.find(x => x.gid === g) || {}).label, beta.gid) === "Mijn tweede run", "hernoemd");
  await p.click(`[data-a=slot][data-s=wissel][data-g="${beta.gid}"]`); await p.waitForTimeout(400);
  ok(await p.evaluate(() => G.game.player.corp_name) === "Beta Corp", "terug naar Beta");
  await p.evaluate(() => { S.view = "logboek"; render(); }); await p.waitForTimeout(200);
  await p.click(`[data-a=slot][data-s=weg][data-g="${alfa.gid}"]`); await p.waitForTimeout(200); await p.click('.modal [data-x="1"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(g => !G.slots.some(x => x.gid === g) && !localStorage.getItem("cl_slot_" + g), alfa.gid), "Alfa verwijderd");
  ok(await p.evaluate(() => G.game.player.corp_name) === "Beta Corp", "huidig spel onaangetast");
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => G.game && G.game.player.corp_name) === "Beta Corp", "na herladen nog steeds Beta");
  console.log(log.join("\n")); console.log("FOUTEN OP DE PAGINA:", JSON.stringify(errs)); await b.close();
  if (log.some(l => l.startsWith("FOUT")) || errs.length) process.exit(1);
})();
