// Run: node --test pillage-ransack/test
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T0 = 1_700_000_000_000;

function connected(geo) {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    for (const j of geo.adjacency[queue.shift()]) {
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === geo.sites.length;
}

// A fresh campaign with home and two neighbours picked out.
function fixture() {
  const c = E.newCampaign({ seed: 'fixture', count: 18, now: T0 });
  const geo = E.buildGeometry(c);
  const baseIdx = geo.index.get(c.baseTerritory);
  const near = [...geo.adjacency[baseIdx]].map((i) => c.territories[i]);
  return { c, geo, a: near[0], b: near[1] };
}

let clock = T0;
function raid(c, target, outcome, extra) {
  const r = Object.assign(
    { id: E.nextRaidId(c), sourceTerritory: 'base', targetTerritory: target.id, outcome, timestamp: ++clock, losses: 0, lootGained: 0, warband: 20, year: c.year, season: c.season, notes: '' },
    extra
  );
  c.raids.push(r);
  return r;
}

test('maps have the requested number of connected, non-empty territories', () => {
  for (const count of [15, 20, 25]) {
    for (const seed of ['alpha', 'beta', 'gamma', 'delta']) {
      const c = E.newCampaign({ seed: seed + count, count, now: T0 });
      assert.equal(c.territories.length, count);
      assert.equal(new Set(c.territories.map((t) => t.id)).size, count, 'unique ids');
      assert.equal(new Set(c.territories.map((t) => t.name)).size, count, 'unique names');
      const geo = E.buildGeometry(c);
      for (const s of geo.shapes) assert.ok(s.points.length >= 3 && s.area > 500, 'territory has area');
      assert.ok(connected(geo), 'every territory reachable over land');
      for (const t of c.territories) {
        assert.ok(E.TERRAINS.includes(t.terrain));
        assert.ok(t.goldValue > 0 && t.garrisonBase > 0);
      }
      const base = c.territories.find((t) => t.id === c.baseTerritory);
      assert.equal(base.status, 'conquered');
    }
  }
});

test('territory count is clamped to 15-25', () => {
  assert.equal(E.newCampaign({ seed: 'x', count: 3, now: T0 }).territories.length, 15);
  assert.equal(E.newCampaign({ seed: 'x', count: 99, now: T0 }).territories.length, 25);
});

test('the same seed draws the same map', () => {
  const a = E.newCampaign({ seed: 'same', count: 20, now: T0 });
  const b = E.newCampaign({ seed: 'same', count: 20, now: T0 });
  assert.deepEqual(a.territories, b.territories);
  assert.deepEqual(E.buildGeometry(a).shapes[3].points, E.buildGeometry(b).shapes[3].points);
});

test('routes follow shared borders', () => {
  const { c, geo } = fixture();
  const from = geo.index.get(c.baseTerritory);
  for (let to = 0; to < c.territories.length; to++) {
    const route = E.findRoute(geo, from, to);
    assert.equal(route[0], from);
    assert.equal(route[route.length - 1], to);
    for (let i = 1; i < route.length; i++) assert.ok(geo.adjacency[route[i - 1]].has(route[i]), 'consecutive steps share a border');
  }
});

test('three successful raids conquer a territory and clear its garrison', () => {
  const { c, a } = fixture();
  raid(c, a, 'success', { lootGained: 50, losses: 2 });
  let r = E.replay(c);
  assert.equal(r.territories.get(a.id).control, 40);
  assert.equal(r.territories.get(a.id).status, 'claimed');
  assert.equal(r.territories.get(a.id).garrison, Math.round(a.garrisonBase * 0.6));
  raid(c, a, 'success');
  raid(c, a, 'success');
  r = E.replay(c);
  const d = r.territories.get(a.id);
  assert.equal(d.control, 100);
  assert.equal(d.status, 'conquered');
  assert.equal(d.garrison, 0);
  assert.equal(r.conquered, 1);
  assert.equal(r.treasury, E.DEFAULT_START.treasury + 50);
  assert.equal(r.army, E.DEFAULT_START.army - 2);
  assert.equal(r.morale, Math.min(100, E.DEFAULT_START.morale + 3 * 5 + 10));
  assert.ok(r.milestones.some((m) => m.kind === 'victory' && /falls/.test(m.label)));
});

test('a failed raid on held land makes it contested and scorched', () => {
  const { c, a, b } = fixture();
  raid(c, a, 'success');
  raid(c, a, 'failure', { losses: 30 });
  const r = E.replay(c);
  const d = r.territories.get(a.id);
  assert.equal(d.control, 15);
  assert.equal(d.status, 'contested');
  assert.equal(d.damage, 1);
  assert.ok(r.milestones.some((m) => m.kind === 'defeat' && /Heavy defeat/.test(m.label)));
  // A failure on untouched land scorches it but leaves it unclaimed.
  raid(c, b, 'failure');
  assert.equal(E.replay(c).territories.get(b.id).status, 'unclaimed');
  assert.equal(E.replay(c).territories.get(b.id).damage, 1);
});

test('a raid under way contests the target and keeps its men in the field', () => {
  const { c, a } = fixture();
  const r0 = raid(c, a, 'ongoing', { warband: 25 });
  let r = E.replay(c);
  assert.equal(r.territories.get(a.id).status, 'contested');
  assert.equal(r.inField, 25);
  assert.equal(r.army, E.DEFAULT_START.army, 'no losses until resolved');
  r0.outcome = 'success';
  r0.losses = 4;
  r = E.replay(c);
  assert.equal(r.territories.get(a.id).status, 'claimed');
  assert.equal(r.inField, 0);
  assert.equal(r.army, E.DEFAULT_START.army - 4);
});

test('deleting a raid recalculates the map', () => {
  const { c, a } = fixture();
  raid(c, a, 'success');
  raid(c, a, 'success');
  raid(c, a, 'success');
  assert.equal(E.replay(c).territories.get(a.id).status, 'conquered');
  c.raids.splice(1, 1);
  assert.equal(E.replay(c).territories.get(a.id).status, 'claimed');
});

test('ending a season pays tribute, restores garrisons and fades scorch marks', () => {
  const { c, a, b } = fixture();
  raid(c, a, 'success');
  raid(c, a, 'success');
  raid(c, a, 'success');
  raid(c, b, 'failure');
  const before = E.replay(c);
  c.season = 'summer';
  const after = E.replay(c);
  const base = c.territories.find((t) => t.id === c.baseTerritory);
  const tribute = Math.round(a.goldValue * E.RULES.tributeRate) + Math.round(base.goldValue * E.RULES.tributeRate);
  assert.equal(after.treasury - before.treasury, tribute);
  assert.equal(after.territories.get(b.id).damage, 1 - E.RULES.damageHealPerSeason);
  const g = before.territories.get(b.id).garrison;
  assert.ok(g >= b.garrisonBase, 'garrison stiffened after repelling the raid');
  assert.equal(after.territories.get(b.id).garrison, g, 'no regen above full strength');
});

test('garrisons recover over seasons after a successful raid', () => {
  const { c, a } = fixture();
  raid(c, a, 'success');
  const weakened = E.replay(c).territories.get(a.id).garrison;
  c.season = 'summer';
  const next = E.replay(c).territories.get(a.id).garrison;
  assert.equal(next, Math.min(a.garrisonBase, weakened + Math.max(1, Math.round(a.garrisonBase * E.RULES.regenPerSeason))));
});

test('a status set by hand wins over the log and counts toward progress', () => {
  const { c, a } = fixture();
  a.override = 'conquered';
  const r = E.replay(c);
  assert.equal(r.territories.get(a.id).status, 'conquered');
  assert.equal(r.conquered, 1);
  assert.ok(r.progressPct > 0);
});

test('adjustments change gold, men and morale', () => {
  const { c } = fixture();
  c.adjustments.push({ id: 'a1', year: 1, season: 'spring', timestamp: ++clock, treasury: -40, army: 10, morale: 200 });
  const r = E.replay(c);
  assert.equal(r.treasury, E.DEFAULT_START.treasury - 40);
  assert.equal(r.army, E.DEFAULT_START.army + 10);
  assert.equal(r.morale, 100, 'morale is capped');
});

test('raid odds compare raiders with the garrison times terrain defence', () => {
  assert.equal(E.raidOdds(60, 40, 'grassland').label, 'Favourable');
  assert.equal(E.raidOdds(40, 40, 'grassland').label, 'Even');
  assert.equal(E.raidOdds(40, 40, 'mountains').label, 'Risky');
  assert.equal(E.raidOdds(10, 40, 'mountains').label, 'Grim');
  assert.equal(E.raidOdds(5, 0, 'forest').label, 'Undefended');
});

test('the example campaign shows every territory state', () => {
  const c = E.exampleCampaign(T0);
  const statuses = new Set(c.territories.filter((t) => t.id !== c.baseTerritory).map((t) => t.status));
  for (const s of E.STATUSES) assert.ok(statuses.has(s), 'has a ' + s + ' territory');
  assert.ok(c.territories.some((t) => t.damage > 0), 'has a scorched territory');
  assert.ok(c.raids.some((r) => r.outcome === 'ongoing'));
});

test('export then import round-trips a campaign', () => {
  const c = E.exampleCampaign(T0);
  const json = E.exportJSON([c]);
  const parsed = JSON.parse(json);
  assert.ok(parsed.campaigns[c.id], 'keyed by campaign id like the spec');
  const { campaigns, warnings } = E.parseImport(json);
  assert.equal(warnings.length, 0);
  const back = campaigns[0];
  assert.equal(back.id, c.id);
  assert.deepEqual(back.raids, c.raids);
  assert.deepEqual(back.territories, c.territories);
  assert.equal(back.updatedAt, c.updatedAt, 'keeps updatedAt so devices can compare versions');
  const r1 = E.replay(c);
  const r2 = E.replay(back);
  assert.equal(r2.treasury, r1.treasury);
  assert.equal(r2.progressPct, r1.progressPct);
});

test('imports the hand-written format from the brief', () => {
  const brief = {
    campaigns: {
      campaign_id: {
        year: 1,
        season: 'spring',
        territories: [
          { id: 't1', name: 'Northern Valley', position: { x: 150 + 200, y: 200 + 100 }, goldValue: 150, garrison: 40, status: 'unclaimed', terrain: 'grassland', conquered: false },
          { id: 't2', name: 'Harbour', position: { x: 600, y: 340 }, goldValue: 90, garrison: 20, status: 'conquered', terrain: 'coast', conquered: true },
          { id: 't3', name: 'Fenmoor', position: { x: 460, y: 460 }, goldValue: 60, garrison: 15, status: 'contested', terrain: 'marsh', conquered: false },
        ],
        raids: [
          { id: 'r1', sourceTerritory: 'base', targetTerritory: 't1', outcome: 'success', timestamp: 1234567890, losses: 5, lootGained: 120 },
          { id: 'r2', sourceTerritory: 'base', targetTerritory: 'nowhere', outcome: 'success', timestamp: 1234567891, losses: 1, lootGained: 1 },
        ],
      },
    },
  };
  const { campaigns, warnings } = E.parseImport(JSON.stringify(brief));
  const c = campaigns[0];
  assert.equal(c.id, 'campaign_id');
  assert.equal(c.baseTerritory, 't2', 'the conquered territory becomes home');
  assert.equal(c.raids.length, 1);
  assert.equal(c.raids[0].timestamp, 1234567890 * 1000, 'seconds become milliseconds');
  assert.equal(c.territories[0].garrisonBase, 40);
  assert.equal(c.territories.find((t) => t.id === 't3').status, 'contested', 'hand-set status is kept');
  assert.equal(c.territories.find((t) => t.id === 't1').status, 'claimed', 'raid applied');
  assert.ok(warnings.some((w) => /left out/.test(w)));
  assert.ok(warnings.some((w) => /home/.test(w)));
  const geo = E.buildGeometry(c);
  assert.ok(geo.shapes.every((s) => s.points.length >= 3));
});

test('imported totals without a starting point are kept', () => {
  const c = E.exampleCampaign(T0);
  const raw = JSON.parse(JSON.stringify(c));
  delete raw.start;
  delete raw.version;
  raw.treasury = 999;
  raw.army = 44;
  const back = E.normalizeCampaign(raw).campaign;
  const r = E.replay(back);
  assert.equal(r.treasury, 999);
  assert.equal(r.army, 44);
});

test('bad imports explain what is wrong', () => {
  assert.throws(() => E.parseImport('{nope'), /not valid JSON/);
  assert.throws(() => E.parseImport('{"hello": 1}'), /No campaigns found/);
  assert.throws(() => E.parseImport(JSON.stringify({ territories: [{ id: 'a', position: { x: 1, y: 1 } }] })), /needs between 2/);
  assert.throws(() => E.parseImport(JSON.stringify({ territories: [{ id: 'a' }, { id: 'b' }] })), /needs a position/);
});

test('every coastline shape gives a connected, fully visible map', () => {
  for (const shape of E.SHAPES) {
    for (const count of [15, 20, 25]) {
      for (const seed of ['one', 'two', 'three']) {
        const c = E.newCampaign({ seed: shape + seed + count, count, shape, now: T0 });
        assert.equal(c.map.shape, shape);
        assert.equal(c.territories.length, count);
        const geo = E.buildGeometry(c);
        assert.ok(connected(geo), shape + ' ' + seed + ' ' + count + ' is connected');
        for (const s of geo.shapes) {
          assert.ok(s.points.length >= 3 && s.area > 500, 'territory has area');
          assert.ok(s.centroid[0] > 10 && s.centroid[0] < 990 && s.centroid[1] > 10 && s.centroid[1] < 690, 'label is on the map');
        }
        if (shape === 'archipelago') {
          assert.ok(geo.landCount >= 2, 'more than one island');
          assert.ok(geo.seaLanes.length >= geo.landCount - 1, 'sea lanes join every island');
        } else assert.equal(geo.seaLanes.length, 0);
      }
    }
  }
});

test('archipelago islands never touch', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const c = E.newCampaign({ seed, count: 22, shape: 'archipelago', now: T0 });
    const isl = c.map.islands;
    for (let i = 0; i < isl.length; i++) {
      for (let j = i + 1; j < isl.length; j++) {
        const d = Math.hypot(isl[i].cx - isl[j].cx, isl[i].cy - isl[j].cy);
        assert.ok(d > Math.max(isl[i].rx, isl[i].ry) * 1.22 + Math.max(isl[j].rx, isl[j].ry) * 1.22, 'islands ' + i + ' and ' + j + ' keep a channel between them');
      }
    }
  }
});

test('a random coastline comes from the seed', () => {
  const shapes = new Set();
  for (let i = 0; i < 30; i++) {
    const a = E.newCampaign({ seed: 'r' + i, count: 18, now: T0 });
    const b = E.newCampaign({ seed: 'r' + i, count: 18, now: T0 });
    assert.equal(a.map.shape, b.map.shape);
    assert.deepEqual(a.territories, b.territories);
    shapes.add(a.map.shape);
  }
  assert.equal(shapes.size, 3, 'all three shapes turn up');
});

test('rivers flow downhill to the sea, a lake or another river', () => {
  let total = 0;
  for (const shape of E.SHAPES) {
    for (const seed of ['x', 'y', 'z']) {
      const c = E.newCampaign({ seed, count: 22, shape, now: T0 });
      const geo = E.buildGeometry(c);
      for (const r of geo.rivers) {
        assert.ok(['sea', 'lake', 'join'].includes(r.end));
        assert.ok(r.points.length >= 12, 'no stub rivers');
        total++;
      }
      assert.equal(geo.lakes.length, geo.rivers.filter((r) => r.end === 'lake').length);
    }
  }
  assert.ok(total >= 9, 'maps have rivers (' + total + ')');
});

test('every territory has a seat that suits it', () => {
  const c = E.newCampaign({ seed: 'seats', count: 25, now: T0 });
  const geo = E.buildGeometry(c);
  c.territories.forEach((t, i) => {
    const f = E.territoryFeature(c, t, geo.shapes[i].coastLength);
    if (t.id === c.baseTerritory) return assert.equal(f, 'home');
    assert.ok(E.FEATURES[f], f + ' is a known seat');
    if (t.garrisonBase >= 85) assert.equal(f, 'castle');
    if (t.terrain === 'coast' && t.garrisonBase < 85) assert.ok(['harbour', 'fishing'].includes(f));
    if (t.terrain === 'mountains' && t.garrisonBase < 85) assert.ok(['mine', 'watchtower'].includes(f));
  });
});

test('campaigns get a name from their richest territory', () => {
  const c = E.newCampaign({ seed: 'named', count: 20, now: T0 });
  const prize = c.territories.filter((t) => t.id !== c.baseTerritory).sort((a, b) => b.goldValue - a.goldValue)[0];
  assert.ok(c.name.includes(prize.name), c.name);
  assert.equal(E.newCampaign({ seed: 'named', count: 20, name: 'Mine', now: T0 }).name, 'Mine');
});

test('archipelago and mainland maps survive export and import', () => {
  for (const shape of ['archipelago', 'mainland']) {
    const c = E.newCampaign({ seed: 'io-' + shape, count: 20, shape, now: T0 });
    const back = E.parseImport(E.exportJSON([c])).campaigns[0];
    assert.deepEqual(back.map, c.map);
    assert.deepEqual(E.buildGeometry(back).shapes.map((s) => s.points.length), E.buildGeometry(c).shapes.map((s) => s.points.length));
  }
  const broken = JSON.parse(E.exportJSON([E.newCampaign({ seed: 'bad', count: 16, shape: 'archipelago', now: T0 })]));
  const only = Object.values(broken.campaigns)[0];
  only.map.islands = 'nope';
  only.map.rx = 0;
  const res = E.parseImport(JSON.stringify(broken));
  assert.equal(res.campaigns[0].map.shape, 'island');
  assert.ok(E.buildGeometry(res.campaigns[0]).shapes.every((s) => s.points.length >= 3));
});
