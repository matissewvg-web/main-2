// Regeltests voor de engine en de generators.
import assert from 'node:assert';
import { CAMPAGNES } from '../src/campagnes.js';
import { nieuweCampagne, kaartVan, onthul, startGevechten, voerUitslagIn, eindeBeurt, voegOrderToe, limieten, orderDoelen, herberekenBevoorrading, zietVersterking, vervangOrder, tafelVan, stand, bonusAanval, factie, datumVan, grondVan } from '../src/engine.js';
import { doctrinesVoor } from '../src/doctrines.js';
import { FACTIES } from '../src/campagnes.js';
import { genereerScenario, scenarioGewichten, SCENARIOTYPES } from '../src/scenario.js';
import { genereerTafel, STUKKEN, STANDAARD_VOORRAAD } from '../src/tafel.js';

let n = 0;
const test = (naam, fn) => { fn(); n++; console.log('ok  ' + naam); };
const nieuw = (id, extra = {}) => { const sc = CAMPAGNES.find((c) => c.id === id); const cfg = Object.assign({ scenarioId: id, seed: 'TEST', facties: sc.facties.map((f) => ({ id: f.id, speler: 'mens', doctrine: f.doctrine })) }, extra); if (!cfg.facties) cfg.facties = sc.facties.map((f) => ({ id: f.id, speler: f.speler, doctrine: f.doctrine })); return nieuweCampagne(cfg); };
const klaar = (s) => { onthul(s); startGevechten(s); };

test('twee landen die elkaar over dezelfde grens aanvallen: één ontmoetingsgevecht', () => {
  const s = nieuw('compass');
  assert.equal(voegOrderToe(s, 'vk', { type: 'aanval', van: 'mersamatruh', naar: 'sidibarrani' }), null);
  assert.equal(voegOrderToe(s, 'ita', { type: 'aanval', van: 'sidibarrani', naar: 'mersamatruh' }), null);
  klaar(s);
  assert.equal(s.gevechten.length, 1);
  assert.equal(s.gevechten[0].scenario.type, 'ontmoeting');
  const g = s.gevechten[0];
  voerUitslagIn(s, g.id, { winnaar: g.aanvaller === 'vk' ? 'A' : 'V' });
  assert.equal(s.regios.sidibarrani.eigenaar, 'vk');
  assert.equal(s.regios.mersamatruh.eigenaar, 'vk');
});

test('de aanvaller wint: regio veroverd en meteen bevoorraad', () => {
  const s = nieuw('compass');
  voegOrderToe(s, 'vk', { type: 'aanval', van: 'mersamatruh', naar: 'sidibarrani' });
  klaar(s); voerUitslagIn(s, s.gevechten[0].id, { winnaar: 'A' });
  assert.equal(s.regios.sidibarrani.eigenaar, 'vk');
  assert.equal(eindeBeurt(s), null);
  assert.equal(s.regios.sidibarrani.bev, true);
});

test('de verdediger wint: een nieuw gevecht in dezelfde regio is een vervolgscenario', () => {
  const s = nieuw('fallweiss');
  voegOrderToe(s, 'dui', { type: 'aanval', van: 'silezie', naar: 'katowice' });
  klaar(s); voerUitslagIn(s, s.gevechten[0].id, { winnaar: 'V' }); eindeBeurt(s);
  assert.equal(s.regios.katowice.omstreden, 1);
  voegOrderToe(s, 'dui', { type: 'aanval', van: 'silezie', naar: 'katowice' });
  klaar(s);
  assert.match(s.gevechten[0].scenario.verwijzing, /gevecht 2 om Katowice/);
});

test('overwinning verdediger: tegenaanval-optie maakt een tegenaanval-scenario mogelijk', () => {
  const s = nieuw('fallweiss');
  voegOrderToe(s, 'dui', { type: 'aanval', van: 'silezie', naar: 'katowice' });
  klaar(s); voerUitslagIn(s, s.gevechten[0].id, { winnaar: 'V' }); eindeBeurt(s);
  assert.deepEqual(factie(s, 'pol').tegenaanval, { regio: 'silezie', beurt: 2 });
  voegOrderToe(s, 'pol', { type: 'aanval', van: 'katowice', naar: 'silezie' });
  klaar(s);
  assert(s.gevechten[0].scenario.gewichten.tegenaanval > 0);
});

test('bevoorrading: wie van zijn bron is afgesneden, capituleert na drie beurten', () => {
  const s = nieuw('fallblau');
  for (const id of kaartVan(s).buren.krim) s.regios[id].eigenaar = 'ussr';
  herberekenBevoorrading(s);
  assert.equal(s.regios.krim.bev, false);
  assert.equal(s.regios.krim.ingesloten, true);
  for (let i = 0; i < 3; i++) { klaar(s); eindeBeurt(s); }
  assert.equal(s.regios.krim.eigenaar, 'ussr');
});

test('ingesloten regio geeft het scenario Omsingeling uitbreken een hoog gewicht', () => {
  const g = scenarioGewichten({ regio: { terrein: 'steppe', infra: [], fort: 0, waarde: 2 }, soort: 'aanval', omstreden: 0, A: {}, V: { afgesneden: true, ingesloten: true } });
  assert(g.uitbreken > g.doorbraak);
});

test('orderlimiet en dubbele orders worden geweigerd', () => {
  const s = nieuw('compass');
  assert.equal(voegOrderToe(s, 'vk', { type: 'aanval', van: 'mersamatruh', naar: 'sidibarrani' }), null);
  assert.match(voegOrderToe(s, 'vk', { type: 'aanval', van: 'mersamatruh', naar: 'sidibarrani' }), /al/);
  assert.match(voegOrderToe(s, 'vk', { type: 'aanval', van: 'cairo', naar: 'tobroek' }), /Ongeldig/);
});

test('Overlord: landingen en luchtlandingen op dag 1, stranden worden over zee bevoorraad', () => {
  const s = nieuw('overlord');
  assert(orderDoelen(s, 'vs', 'landing').includes('utah'));
  assert.equal(voegOrderToe(s, 'vs', { type: 'landing', naar: 'utah' }), null);
  assert.equal(voegOrderToe(s, 'vs', { type: 'landing', naar: 'omaha' }), null);
  assert.equal(voegOrderToe(s, 'vs', { type: 'luchtlanding', naar: 'stemere' }), null);
  klaar(s);
  const types = s.gevechten.map((g) => g.scenario.type).sort();
  assert.deepEqual(types, ['luchtlanding', 'strandlanding', 'strandlanding']);
  for (const g of s.gevechten) voerUitslagIn(s, g.id, { winnaar: 'A' });
  eindeBeurt(s);
  assert.equal(s.regios.utah.bev, true);
});

test('fog of war: versterking pas zichtbaar na recon', () => {
  const s = nieuw('fallweiss');
  assert.equal(zietVersterking(s, 'dui', 'warschau'), false);
  voegOrderToe(s, 'dui', { type: 'recon', naar: 'mlawa' });
  klaar(s);
  assert.equal(zietVersterking(s, 'dui', 'mlawa'), true);
});

test('Auftragstaktik: na het onthullen één order vervangen', () => {
  const s = nieuw('koersk');
  voegOrderToe(s, 'dui', { type: 'aanval', van: 'orel', naar: 'koersk' });
  onthul(s);
  assert.equal(vervangOrder(s, 'dui', 0, { type: 'aanval', van: 'charkov', naar: 'koersk' }), null);
  assert.equal(s.voorstel.gevechten[0].van, 'charkov');
  assert.notEqual(vervangOrder(s, 'dui', 0, { type: 'versterk', naar: 'orel' }), null);
});

test('Blitzkrieg: één bonusaanval per beurt na een gewonnen aanval', () => {
  const s = nieuw('fallweiss');
  voegOrderToe(s, 'dui', { type: 'aanval', van: 'silezie', naar: 'katowice' });
  klaar(s); voerUitslagIn(s, s.gevechten[0].id, { winnaar: 'A' });
  assert.equal(s.bonus.length, 1);
  assert.equal(bonusAanval(s, 'dui', 'katowice', 'krakau'), null);
  assert.equal(s.gevechten.length, 2);
  assert.equal(s.gevechten[1].bonus, true);
});

test('campagnedoel beslist de winnaar', () => {
  const s = nieuw('fallweiss');
  s.regios.warschau.eigenaar = 'dui';
  klaar(s); eindeBeurt(s);
  assert.equal(s.winnaar.zijde, 'as');
  assert.equal(stand(s).doel.heeft, 1);
});

test('seizoenen: sneeuw in de Russische winter, modder in de herfst', () => {
  const s = nieuw('barbarossa');
  assert.equal(grondVan('oost', datumVan(s, 1).maand), 'normaal');
  assert.equal(grondVan('oost', datumVan(s, 5).maand), 'modder');
  assert.equal(grondVan('oost', datumVan(s, 7).maand), 'sneeuw');
});

test('scenario en tafelmap zijn exact reproduceerbaar uit de seed', () => {
  const ctx = { regio: { naam: 'Test', terrein: 'rivier', infra: ['brug'], waarde: 2, fort: 1, linie: '' }, soort: 'aanval', ruleset: 'bg', punten: 500, periode: 'late', grond: 'modder', omstreden: 0, A: { naam: 'A', doctrines: ['blitzkrieg'] }, V: { naam: 'V', doctrines: ['ingraven'], heleBeurt: true } };
  assert.deepEqual(genereerScenario(ctx, 'S1'), genereerScenario(ctx, 'S1'));
  assert.notDeepEqual(genereerScenario(ctx, 'S1'), genereerScenario(ctx, 'S2'));
});

test('elk scenariotype levert een tafelmap die nooit meer terrein gebruikt dan je hebt', () => {
  const voorraad = { bos: 2, heuvel: 1, gebouw: 2, haag: 3, veld: 1, rivier: 1, brug: 1, weg: 1 };
  for (const type of Object.keys(SCENARIOTYPES)) for (const terrein of ['steppe', 'bocage', 'stad', 'woestijn', 'rivier', 'strand']) for (const tafel of [{ b: 72, h: 48, eenheid: 'inch' }, { b: 120, h: 120, eenheid: 'cm' }]) {
    const soort = type === 'ontmoeting' ? 'ontmoeting' : type === 'raid' ? 'raid' : type === 'strandlanding' ? 'landing' : type === 'luchtlanding' ? 'luchtlanding' : 'aanval';
    const scn = genereerScenario({ regio: { naam: 'T', terrein, infra: [], waarde: 2, fort: 0, linie: '' }, soort, forceType: type, ruleset: 'fow', punten: 100, periode: 'mid', grond: 'normaal', omstreden: 0, A: { naam: 'A', doctrines: [] }, V: { naam: 'V', doctrines: [] } }, type + terrein);
    const m = genereerTafel({ tafel, voorraad, terrein, scenario: scn }, type + terrein);
    for (const [t, aantal] of Object.entries(m.gebruikt)) assert(aantal <= (voorraad[t] || 0), `${type}/${terrein}: ${aantal}× ${t}, voorraad ${voorraad[t] || 0}`);
    const tel = {}; for (const st of m.stukken) tel[st.type] = (tel[st.type] || 0) + 1;
    for (const [t, aantal] of Object.entries(tel)) assert(aantal <= (voorraad[t] || 0), `${type}/${terrein}: ${aantal} geplaatste ${t}`);
    for (const st of m.stukken) assert(st.x > 0 && st.y > 0 && st.x < m.B && st.y < m.H && STUKKEN[st.type], 'stuk buiten de tafel');
    for (const o of m.objectives) assert(o.x >= 0 && o.x <= m.B && o.y >= 0 && o.y <= m.H, 'objective buiten de tafel');
    if (scn.obj === 'brug') assert(m.rivier && m.objectives.length >= 1, 'brugscenario zonder rivier of objective');
  }
});

test('een rivier loopt altijd van rand tot rand', () => {
  for (let i = 0; i < 40; i++) {
    const m = genereerTafel({ tafel: { b: 72, h: 48, eenheid: 'inch' }, voorraad: STANDAARD_VOORRAAD, terrein: 'rivier', scenario: { type: 'bruginnemen', obj: 'brug', opstelling: i % 2 ? 'lang' : 'kort', fortExtra: {}, grond: 'normaal' } }, 'r' + i);
    const p = m.rivier.punten, a = p[0], b = p[p.length - 1];
    assert((a.x === 0 && b.x === m.B) || (a.y === 0 && b.y === m.H));
  }
});

test('Europa 1938: echte kaart, historische grenzen, elk land speelbaar', () => {
  const s = nieuw('europa1938');
  const info = kaartVan(s);
  assert(info.regios.length > 380, 'te weinig provincies: ' + info.regios.length);
  for (const id of ['silezie', 'pommeren', 'oostenrijk', 'oostpruisen', 'danzig', 'dresden', 'linz']) assert.equal(s.regios[id].eigenaar, 'dui', id);
  assert.equal(s.regios.bohemen.eigenaar, 'tsj'); assert.equal(s.regios.brno.eigenaar, 'tsj');
  assert.equal(s.regios.lwow.eigenaar, 'pol');
  assert(info.buren.messina.includes('calabrie'), 'de Straat van Messina is een grens');
  assert(!info.buren.londen.includes('rijsel'), 'het Kanaal is geen landgrens');
  const grens = info.regios.some((r) => s.regios[r.id].eigenaar === 'dui' && info.buren[r.id].some((n) => s.regios[n].eigenaar === 'pol'));
  assert(grens, 'Duitsland en Polen grenzen niet aan elkaar');
  for (const r of info.regios) assert(info.buren[r.id].length > 0 || r.infra.includes('kust'), 'provincie zonder buren en zonder kust: ' + r.id);
  for (const r of info.regios) assert(r.d && r.d.startsWith('M'), 'regio zonder omtrek: ' + r.id);
});

test('elk land heeft in elke periode een doctrine en een leger voor op tafel', () => {
  for (const [id, F] of Object.entries(FACTIES)) {
    if (id === 'neutraal') continue;
    assert(F.leger && F.leger.length > 20, 'geen leger voor ' + id);
    for (const p of ['early', 'mid', 'late']) assert(doctrinesVoor(id, p).length >= 2, `${id} heeft te weinig doctrines in ${p}`);
    assert(['early', 'mid', 'late'].some((p) => doctrinesVoor(id, p).some((d) => d.landen.includes(id))), id + ' heeft geen eigen doctrine');
    assert(doctrinesVoor(id, 'late').some((d) => d.id === F.doctrine) || doctrinesVoor(id, 'early').some((d) => d.id === F.doctrine), id + ': standaarddoctrine bestaat niet');
  }
});

test('een land zonder speler geeft geen orders, maar verdedigt wel; een neutraal land kiest dan partij', () => {
  const s = nieuw('europa1938', { facties: null });
  const tsj = factie(s, 'tsj'), ned = factie(s, 'ned');
  assert.equal(ned.speler, 'passief'); assert.equal(ned.zijde, 'neutraal');
  assert.equal(s.klaar.ned, true);
  const info = kaartVan(s), grens = (land) => { for (const r of info.regios) if (s.regios[r.id].eigenaar === 'dui') for (const n of info.buren[r.id]) if (s.regios[n].eigenaar === land && !gebruikt.has(r.id)) { gebruikt.add(r.id); return { type: 'aanval', van: r.id, naar: n }; } };
  const gebruikt = new Set();
  assert.equal(voegOrderToe(s, 'dui', grens('ned')), null);
  assert.equal(voegOrderToe(s, 'dui', grens('tsj')), null);
  klaar(s);
  assert.equal(s.gevechten.length, 2);
  assert.equal(factie(s, 'ned').zijde, 'geallieerd');
  assert.equal(tsj.zijde, 'geallieerd');
  for (const g of s.gevechten) assert(g.scenario && g.status === 'open');
});

test('de periode volgt de kalender', () => {
  const s = nieuw('europa1941', { facties: null, doorlopend: true });
  assert.equal(s.periode, 'early');
  for (let i = 0; i < 3; i++) { klaar(s); eindeBeurt(s); }
  assert.equal(datumVan(s).jaar, 1942);
  assert.equal(s.periode, 'mid');
});

console.log(`\n${n} regeltests in orde`);
