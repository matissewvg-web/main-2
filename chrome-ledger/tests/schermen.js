// Schermtest: oprichting, producten, wachtrij, prijs, back-ups, export/import, effecten, overwinning en mobiel.
// Gebruik: node chrome-ledger/tests/schermen.js chrome-ledger/artifact/chrome-ledger.html <map-voor-screenshots>
const { chromium, devices } = require('playwright');
const fs = require('fs');
const file = process.argv[2], dir = process.argv[3];
const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(file, 'utf8') + '</body></html>';
(async () => {
  const b = await chromium.launch(); const errs = []; const log = [];
  const c = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await c.route('http://art.test/**', (r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({ contentType: 'text/html', body: html }); const f = require('path').join(require('path').dirname(file), u); return fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }); })); await p.goto('http://art.test/'); await p.waitForTimeout(700); await p.mouse.click(5, 5); await p.waitForTimeout(400);
  log.push('boot overlay weg: ' + await p.evaluate(() => !document.querySelector('.boot')));
  await p.keyboard.press('2'); await p.fill('[data-f=corp_name]', 'IJzerwolf Arms'); await p.keyboard.press('Escape'); await p.keyboard.press('3');
  await p.click('[data-chip=lengte][data-v=kort]'); await p.waitForTimeout(150); await p.screenshot({ path: dir + '/a-koers.png' });
  await p.keyboard.press('4'); await p.click('main [data-a=setup]'); await p.waitForSelector('.inbox');
  log.push('producten bij start: ' + await p.evaluate(() => G.game.producten.length) + ' · rivalen: ' + await p.evaluate(() => G.game.rivals.map(r => r.name + "@" + r.hq + "(" + rivalDistricts(G.game, r).length + ")").join(", ")));
  log.push('plek bij start: ' + await p.evaluate(() => { const W = wereldVM(G.game); return W.rang.filter(x => x.soort !== "bedrijf").map(x => x.naam.slice(0, 12) + " " + x.waarde).join(" | "); }));
  // product via UI + wachtrij
  await p.evaluate(() => { S.view = "bedrijf"; render(); });
  await p.click('[data-a=prodnew]'); await p.waitForTimeout(200); await p.click('[data-a=prodnew]'); await p.waitForTimeout(200);
  log.push('na 2x ontwikkelen: ' + await p.evaluate(() => G.game.producten.map(x => x.naam + ":" + x.status).join(", ")));
  // maanden spelen
  for (let i = 0; i < 8; i++){ await p.evaluate(async () => { for (const k of [...G.game.keuzes]) await API["/api/keuze"]({id: k.id, i: k.opties.length - 1}); await API["/api/tick"]({force: true}); }); }
  log.push('na 8 mnd: ' + await p.evaluate(() => G.game.producten.map(x => `${x.naam}:${x.status} ${x.aard||""} pop${x.pop} ${x.review ? x.review.sterren + "★" : ""}`).join(" | ")));
  await p.evaluate(() => { S.view = "bedrijf"; render(); }); await p.waitForTimeout(200);
  const pc = await p.$('[data-a=prod][data-s=prijs][data-p=premium]'); if (pc){ await pc.click(); await p.waitForTimeout(200); log.push('prijs: ' + await p.evaluate(() => G.game.producten.filter(x => x.status === "markt").map(x => x.naam + " " + x.prijs).join(", "))); }
  await p.evaluate(() => { const h = [...document.querySelectorAll('main h2')].find(x => /Productlijn/i.test(x.textContent)); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 80); }); await p.waitForTimeout(150);
  await p.screenshot({ path: dir + '/b-producten.png' });
  // 4.3: productblad met prijsschuif; schuif verplaatsen toont een voorbeeld zonder iets te veranderen
  const ds = await p.$('[data-a=prodsheet]'); if (ds){ await ds.click(); await p.waitForTimeout(200); await p.screenshot({ path: dir + '/b-blad-overzicht.png' }); await p.click('[data-a=prodtab][data-t=prijs]'); await p.waitForTimeout(200); const sl = await p.$('input[data-prijs]');
    if (sl){ const voor = await p.evaluate(() => G.game.producten.find(x => x.status === "markt").prijsF); await sl.evaluate(el => { el.value = 150; el.dispatchEvent(new Event("input", {bubbles: true})); });
      log.push('prijsschuif: ' + await p.evaluate(() => document.querySelector('[id^=pp_]').textContent) + ' · onveranderd ' + (await p.evaluate(() => G.game.producten.find(x => x.status === "markt").prijsF) === voor));
      const bl = await p.$('.prodblad'); await bl.scrollIntoViewIfNeeded(); await bl.screenshot({ path: dir + '/b-prijs.png' });
      const vs = p.viewportSize(); await p.setViewportSize({width: 390, height: 900}); await p.waitForTimeout(200); await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.display = 'none'; const k = document.getElementById('ticker'); if (k) k.style.display = 'none'; }); const bm = await p.$('.prodblad'); await bm.scrollIntoViewIfNeeded(); await bm.screenshot({ path: dir + '/b-prijs-m.png' });
      await p.click('[data-a=prodtab][data-t=onderdelen]'); await p.waitForTimeout(200); const bo = await p.$('.prodblad'); await bo.screenshot({ path: dir + '/b-onderdelen-m.png' });
      log.push('tabs: ' + await p.evaluate(() => [...document.querySelectorAll('[data-a=prodtab]')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' | ')) + ' · onderdelen ' + await p.evaluate(() => document.querySelectorAll('.prodblad [data-s=onderdeel]').length / 3));
      log.push('productblad 390px scrollW ' + await p.evaluate(() => document.documentElement.scrollWidth) + ' · segmenten ' + await p.evaluate(() => document.querySelectorAll('.prodblad .segrow').length)); await p.setViewportSize(vs); await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.display = ''; const k = document.getElementById('ticker'); if (k) k.style.display = ''; }); } else log.push('prijsschuif: ONTBREEKT'); }
  await p.evaluate(() => { S.view = "overzicht"; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(200); await p.screenshot({ path: dir + '/c-overzicht.png', fullPage: true });
  // back-ups
  await p.evaluate(() => { S.view = "logboek"; render(); }); await p.click('[data-a=backups]'); await p.waitForTimeout(300);
  log.push('back-ups: ' + await p.evaluate(() => (S.backups || []).map(x => x.maand).join(", ")));
  const m0 = await p.evaluate(() => ym(G.game));
  const rb = await p.$('[data-a=restore]'); if (rb){ await rb.click(); await p.waitForTimeout(200); await p.click('.modal [data-x="1"]'); await p.waitForTimeout(300); log.push(`terugzetten: ${m0} -> ${await p.evaluate(() => ym(G.game))}`); }
  // export / import
  await p.click('[data-a=export]'); await p.waitForTimeout(200); const len = await p.evaluate(() => document.getElementById('tm_txt').value.length); const exp = await p.evaluate(() => document.getElementById('tm_txt').value);
  await p.screenshot({ path: dir + '/d-export.png' }); await p.click('.modal [data-x="0"]'); log.push('export lengte ' + len);
  await p.evaluate(() => { G.game.cash = 1; });
  await p.click('[data-a=import]'); await p.waitForTimeout(200); await p.fill('#tm_txt', exp); await p.click('.modal [data-x="1"]'); await p.waitForTimeout(300); log.push('import cash terug: ' + await p.evaluate(() => G.game.cash));
  // effecten
  await p.evaluate(() => { S.view = "logboek"; render(); }); await p.click('[data-a=effecten]'); await p.waitForTimeout(100); log.push('rustig: ' + await p.evaluate(() => document.documentElement.classList.contains('rustig')));
  await p.screenshot({ path: dir + '/e-logboek.png', fullPage: true });
  // overwinning forceren
  await p.evaluate(async () => { G.game.cash = 9000; await API["/api/tick"]({force: true}); render(); }); await p.waitForTimeout(400);
  log.push('status: ' + await p.evaluate(() => G.game.status + " score " + (G.game.eind || {}).score + " eregalerij " + (G.eregalerij || []).length));
  await p.screenshot({ path: dir + '/f-gewonnen.png', fullPage: true });
  await p.click('[data-a=doorspelen]'); await p.waitForTimeout(300); log.push('doorspelen: ' + await p.evaluate(() => G.game.status + " " + G.game.player.lengte));
  // mobiel
  const m = await b.newContext({ ...devices['iPhone 13'] }); const mp = await m.newPage(); mp.on('pageerror', e => errs.push('m: ' + e.message));
  await m.route('http://art.test/**', (r => { const u = new URL(r.request().url()).pathname.slice(1); if (!u) return r.fulfill({ contentType: 'text/html', body: html }); const f = require('path').join(require('path').dirname(file), u); return fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }); })); await mp.goto('http://art.test/'); await mp.waitForTimeout(700); await mp.tap('body'); await mp.waitForTimeout(300);
  await mp.evaluate(async () => { await API["/api/setup"]({...S.setup, corp_name: "M", eigen: {naam: "Wapenhandel", profiel: "riskant"}}); await API["/api/product"]({soort: "ontwikkel", divisie: "Wapenhandel", schaal: "klein"}); for (let i = 0; i < 4; i++) await API["/api/tick"]({force: true}); S.view = "overzicht"; render(); });
  await mp.waitForTimeout(200); log.push('mobiel overzicht scrollW ' + await mp.evaluate(() => document.documentElement.scrollWidth)); await mp.screenshot({ path: dir + '/g-m-overzicht.png', fullPage: true });
  await mp.evaluate(() => { S.view = "bedrijf"; render(); }); await mp.waitForTimeout(200); log.push('mobiel bedrijf scrollW ' + await mp.evaluate(() => document.documentElement.scrollWidth));
  console.log(log.join("\n")); console.log('ERRORS', JSON.stringify(errs)); await b.close();
})();
