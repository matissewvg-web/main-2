// Rooktest: speelt elke campagne meerdere keren volledig uit met willekeurige (maar geldige) orders
// en willekeurige winnaars, en genereert voor elk gevecht de tafelmap.
import { CAMPAGNES } from '../src/campagnes.js';
import { nieuweCampagne, kaartInfo, onthul, startGevechten, eindeBeurt, tafelVan, stand, factie, planVolgorde, beschikbareOrders, orderDoelen, voegOrderToe, voerUitslagIn, bonusAanval, bonusDoelen, limieten } from '../src/engine.js';
import { tafelSvg } from '../src/tafel.js';
import { maakRng } from '../src/rng.js';
import assert from 'node:assert';

let totGevechten = 0; const types = {};
for (const sc of CAMPAGNES) {
  const info = kaartInfo(sc.kaart, sc.subset);
  for (const r of info.regios) for (const n of info.buren[r.id]) assert(info.buren[n].includes(r.id), `asymmetrisch ${sc.kaart}: ${r.id}-${n}`);
  for (const run of [1, 2, 3]) {
    const rng = maakRng(`sim${run}${sc.id}`);
    const s = nieuweCampagne({ scenarioId: sc.id, seed: `T${run}${sc.id}`, ruleset: run % 2 ? 'fow' : 'bg', doorlopend: run === 3, modus: run === 2 ? 'beurt' : 'simultaan',
      facties: sc.facties.map((f) => ({ id: f.id, speler: run === 1 ? f.speler : 'mens', doctrine: f.doctrine })) });
    let guard = 0;
    while (s.fase !== 'einde' && guard++ < 70) {
      assert.equal(s.fase, 'orders');
      for (const fid of planVolgorde(s)) {
        const lim = limieten(s, fid);
        for (let k = 0; k < lim.orders + 3; k++) {
          const type = rng.kies(k < 3 ? ['aanval', 'aanval', 'landing', 'luchtlanding'] : beschikbareOrders(s, fid));
          if (!beschikbareOrders(s, fid).includes(type)) continue;
          const van = type === 'aanval' ? rng.kies(orderDoelen(s, fid, 'aanval').concat([null])) : null;
          if (type === 'aanval' && !van) continue;
          const doelen = orderDoelen(s, fid, type, van);
          if (doelen.length) voegOrderToe(s, fid, { type, van, naar: rng.kies(doelen) });
        }
        s.klaar[fid] = true;
      }
      onthul(s); startGevechten(s);
      for (let i = 0; i < s.gevechten.length; i++) {
        const g = s.gevechten[i];
        if (g.status !== 'open') continue;
        totGevechten++; types[g.scenario.type] = (types[g.scenario.type] || 0) + 1;
        const m = tafelVan(s, g), svg = tafelSvg(m);
        assert(svg.startsWith('<svg') && !svg.includes('NaN') && !svg.includes('undefined'), `kapotte svg in ${sc.id} ${g.scenario.type}`);
        assert.deepEqual(m, tafelVan(s, g), 'tafelmap niet reproduceerbaar uit seed');
        assert.equal(voerUitslagIn(s, g.id, { winnaar: rng.kans(0.55) ? 'A' : 'V' }), null);
        for (const bo of s.bonus.slice()) { const d = bonusDoelen(s, bo); bonusAanval(s, bo.fid, bo.van, d.length && rng.kans(0.7) ? d[0] : null); }
      }
      assert.equal(eindeBeurt(s), null);
      for (const id of Object.keys(s.regios)) { const e = s.regios[id].eigenaar; assert(e === 'neutraal' || factie(s, e), `onbekende eigenaar ${e}`); }
    }
    assert.equal(s.fase, 'einde', `${sc.id} eindigt niet`);
    assert(JSON.parse(JSON.stringify(s)), 'state niet serialiseerbaar');
    if (run === 1) { const st = stand(s); console.log(`${sc.id.padEnd(14)} ${String(info.regios.length).padStart(2)} regio's  ${String(s.beurt).padStart(2)} beurten  winnaar ${String(s.winnaar.zijde).padEnd(10)} ${st.perFactie.filter((p) => factie(s, p.id).speler === 'mens').map((p) => p.id + ':' + p.regios).join(' ')}`); }
  }
}
console.log(`\n${totGevechten} gevechten met tafelmap. Scenariotypes:`, types);
