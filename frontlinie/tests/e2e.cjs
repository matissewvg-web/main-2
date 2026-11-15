// Browsertest: speelt via de echte interface een hot-seat-campagne en maakt screenshots.
// Gebruik: node tests/e2e.cjs [map voor screenshots]
const { chromium } = require('playwright');
const path = require('path');
const uit = process.argv[2] || path.join(__dirname, '..', 'docs');
const shots = process.argv.includes('--shots');

(async () => {
  const browser = await chromium.launch();
  const fouten = [];
  const nieuw = async (viewport, scheme) => {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme || 'light', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) fouten.push(m.text()); });
    page.on('pageerror', (e) => fouten.push('pageerror: ' + e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'frontlinie.html'));
    return page;
  };
  const klik = (page, tekst) => page.locator('button', { hasText: tekst }).first().click();
  const foto = async (page, naam, full) => { if (shots) await page.screenshot({ path: path.join(uit, naam + '.png'), fullPage: !!full }); };

  const page = await nieuw({ width: 1440, height: 900 });
  await foto(page, '01-start');
  // elke campagne: wizard openen en kaart tonen
  for (const tab of ['Heel Europa', 'Operaties 1939–41', 'Operaties 1942–43', 'Operaties 1944–45']) {
    await klik(page, tab);
    const n = await page.locator('.scnknop').count();
    for (let i = 0; i < n; i++) {
      await page.locator('.scnknop').nth(i).click();
      const titel = await page.locator('main.nieuw h1').innerText();
      if (shots) await page.locator('.kaartrol').screenshot({ path: path.join(uit, 'kaart-' + titel.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png') });
      await klik(page, 'Terug');
      await klik(page, tab);
    }
  }
  // Market Garden, alle landen mens
  await klik(page, 'Operaties 1944–45');
  await page.locator('.scnknop', { hasText: 'Market Garden' }).click();
  await foto(page, '02-nieuw');
  await klik(page, 'Start de campagne');
  await foto(page, '03-campagne');
  const speelBeurt = async (maxOrders) => {
    // plan voor elke mens: klik alle ordertypes af tot de limiet
    for (let guard = 0; guard < 12; guard++) {
      if (!(await page.locator('.planner').count())) { // zelfde speler, volgend land: de planner staat al open
        const plan = page.locator('button', { hasText: 'Plan de orders van' });
        if (!(await plan.count())) break;
        await plan.first().click();
      }
      for (const type of ['Luchtlanding', 'Aanvallen', 'Versterken', 'Verdedigen']) {
        for (let k = 0; k < maxOrders; k++) {
          const b = page.locator('.ordknop', { hasText: type });
          if (!(await b.count()) || await b.first().isDisabled()) break;
          if (!(await b.first().evaluate((el) => el.classList.contains('aan')))) await b.first().click();
          let kan = page.locator('svg.kaart .rg.kan');
          if (!(await kan.count())) break;
          await kan.first().click({ force: true });
          if (type === 'Aanvallen') { kan = page.locator('svg.kaart .rg.kan'); if (await kan.count()) await kan.first().click({ force: true }); }
          if (await page.locator('.planner .fout').count()) break;
        }
      }
      if (guard === 0 && shots) await foto(page, '04-orders');
      await klik(page, 'Klaar met');
    }
    await klik(page, 'Onthul de orders');
    if (shots) await foto(page, '05-onthuld');
    await klik(page, "Genereer de scenario's");
    if (shots) await foto(page, '06-gevechten');
    let eerste = true;
    for (let guard = 0; guard < 20; guard++) {
      const open = page.locator('.gev.open button', { hasText: 'Scenario en tafelmap' });
      const afzien = page.locator('button', { hasText: 'Zie ervan af' });
      if (await afzien.count()) { await afzien.first().click(); continue; }
      if (!(await open.count())) break;
      await open.first().click();
      if (!(await page.locator('.vel .tafel svg').count())) throw new Error('geen tafelmap op het blad');
      if (eerste && shots) { await foto(page, '07-gevecht', true); eerste = false; }
      await klik(page, 'Herrol het terrein');
      await page.locator('.keuze').nth(guard % 2).click();
      await klik(page, 'Bevestig');
    }
    await klik(page, 'Sluit de beurt af');
  };
  for (let b = 0; b < 3; b++) { if (await page.locator('.banner').count()) break; await speelBeurt(3); }
  for (const t of ['Stand', 'Landen', 'Log', 'Tafel', 'Regels']) { await page.locator('.tab', { hasText: t }).click(); if (shots) await foto(page, '08-tab-' + t.toLowerCase(), true); }
  await klik(page, 'Ongedaan maken').catch(() => {});
  // Europa 1938 op de echte kaart
  await klik(page, 'Campagnes');
  await klik(page, 'Heel Europa');
  await page.locator('.scnknop', { hasText: 'Europa 1938' }).click();
  await foto(page, '12-europa-nieuw', true);
  await klik(page, 'Start de campagne');
  await foto(page, '13-europa-campagne');
  // tekenen: sleep Duits gebied Frankrijk in en controleer dat de regio volgt
  await klik(page, 'Teken gebied');
  const vak = await page.locator('.kaartlaag').boundingBox();
  const telFra = async () => page.evaluate(() => { const o = JSON.parse(localStorage.getItem('frontlinie.v1')); const c = Object.values(o.campagnes).find((x) => x.scenarioId === 'europa1938'); return [c.regios.lotharingen.eigenaar, c.regios.parijs.eigenaar, (c.verf || '').length]; });
  const voor = await telFra();
  const pt = async (id) => page.evaluate((rid) => { const el = document.querySelector('.kaartlaag svg [data-id="' + rid + '"]'); const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, id);
  // omlijn Lotharingen: een lus rond de regio, bij loslaten wordt hij gevuld
  const vakL = await page.evaluate(() => { const el = document.querySelector('.kaartlaag svg [data-id="lotharingen"]'); el.scrollIntoView({ block: 'center', inline: 'center' }); const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2]; });
  await page.mouse.move(vakL[0] + vakL[2], vakL[1]); await page.mouse.down();
  for (let i = 1; i <= 48; i++) { const a = i / 48 * Math.PI * 2; await page.mouse.move(vakL[0] + Math.cos(a) * vakL[2], vakL[1] + Math.sin(a) * vakL[3]); if (i === 30) await foto(page, '15a-omlijnen'); }
  await page.mouse.up();
  await foto(page, '15-getekend');
  const na = await telFra();
  if (voor[0] !== 'fra' || na[0] !== 'dui') fouten.push('tekenen: Lotharingen volgt de tekening niet: ' + JSON.stringify([voor, na]));
  if (na[1] !== 'fra') fouten.push('tekenen: Parijs is onterecht van eigenaar gewisseld');
  await klik(page, 'Klaar met tekenen');
  await speelBeurt(2);
  await foto(page, '14-europa-na-beurt');
  // herladen: campagne staat er nog
  await page.reload();
  if (!(await page.locator('button', { hasText: 'Verder spelen' }).count())) throw new Error('campagne niet bewaard na herladen');
  // los scenario
  await klik(page, 'Los scenario genereren');
  for (const type of ['linie', 'strandlanding', 'stad', 'bruginnemen', 'konvooi', 'luchtlanding', 'uitbreken']) {
    await page.selectOption('#l-type', type);
    if (shots) await page.locator('.tafel svg').screenshot({ path: path.join(uit, 'tafel-' + type + '.png') });
  }
  await foto(page, '09-los', true);
  // telefoon, donker
  const mob = await nieuw({ width: 400, height: 860 }, 'dark');
  await foto(mob, '10-mobiel-start', true);
  const breed = await mob.evaluate(() => document.documentElement.scrollWidth);
  if (breed > 401) fouten.push('pagina scrolt horizontaal op telefoon: ' + breed);
  await mob.locator('.scnknop', { hasText: 'Europa 1941' }).click();
  await klik(mob, 'Start de campagne');
  await foto(mob, '11-mobiel-campagne', true);
  const breed2 = await mob.evaluate(() => document.documentElement.scrollWidth);
  if (breed2 > 401) fouten.push('campagnescherm scrolt horizontaal op telefoon: ' + breed2);
  await browser.close();
  if (fouten.length) { console.error('FOUTEN:\n' + fouten.join('\n')); process.exit(1); }
  console.log('e2e in orde');
})().catch((e) => { console.error(e); process.exit(1); });
