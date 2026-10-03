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
  const baseIdx = geo.index.get(c.kingdoms[0].capital);
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
      const base = c.territories.find((t) => t.id === c.kingdoms[0].capital);
      assert.equal(base.status, 'conquered');
      assert.equal(base.owner, c.kingdoms[0].id);
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
  const from = geo.index.get(c.kingdoms[0].capital);
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
  const base = c.territories.find((t) => t.id === c.kingdoms[0].capital);
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
  const statuses = new Set(c.territories.filter((t) => t.id !== c.kingdoms[0].capital).map((t) => t.status));
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
  assert.equal(c.kingdoms.length, 1, 'an older file becomes one kingdom');
  assert.equal(c.kingdoms[0].capital, 't2', 'the conquered territory becomes home');
  assert.ok(c.raids.every((r) => r.by === c.kingdoms[0].id));
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
  const file = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'v1-campaign.json'), 'utf8'));
  const raw = Object.values(file.campaigns)[0];
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
        if (shape === 'archipelago' || shape === 'strait') assert.ok(geo.landCount >= 2, shape + ' has more than one landmass');
        assert.ok(geo.seaLanes.length >= geo.landCount - 1, 'sea lanes join every landmass');
      }
    }
  }
});

test('archipelago islands never touch (first-release generator)', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const c = E.newCampaign({ seed, count: 22, shape: 'archipelago', engine: 1, now: T0 });
    assert.equal(c.map.engine, undefined, 'engine 1 map');
    assert.equal(c.kingdoms.length, 1);
    assert.ok(connected(E.buildGeometry(c)));
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
  for (let i = 0; i < 60; i++) {
    const a = E.newCampaign({ seed: 'r' + i, count: 18, now: T0 });
    const b = E.newCampaign({ seed: 'r' + i, count: 18, now: T0 });
    assert.equal(a.map.shape, b.map.shape);
    assert.deepEqual(a.territories, b.territories);
    shapes.add(a.map.shape);
  }
  assert.equal(shapes.size, E.SHAPES.length, 'every coastline turns up');
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
    if (t.id === c.kingdoms[0].capital) return assert.equal(f, 'home');
    assert.ok(E.FEATURES[f], f + ' is a known seat');
    if (t.garrisonBase >= 85) assert.equal(f, 'castle');
    if (t.terrain === 'coast' && t.garrisonBase < 85) assert.ok(['harbour', 'fishing'].includes(f));
    if (t.terrain === 'mountains' && t.garrisonBase < 85) assert.ok(['mine', 'watchtower'].includes(f));
  });
});

test('campaigns get a name from their richest territory', () => {
  const c = E.newCampaign({ seed: 'named', count: 20, now: T0 });
  const prize = c.territories.filter((t) => t.id !== c.kingdoms[0].capital).sort((a, b) => b.goldValue - a.goldValue)[0];
  assert.ok(c.name.includes(prize.name), c.name);
  assert.equal(E.newCampaign({ seed: 'named', count: 20, name: 'Mine', now: T0 }).name, 'Mine');
});

test('every coastline survives export and import', () => {
  for (const shape of E.SHAPES) {
    const c = E.newCampaign({ seed: 'io-' + shape, count: 20, shape, now: T0 });
    const back = E.parseImport(E.exportJSON([c])).campaigns[0];
    assert.deepEqual(back.map, c.map);
    assert.deepEqual(E.buildGeometry(back).shapes.map((s) => s.points.length), E.buildGeometry(c).shapes.map((s) => s.points.length));
  }
  const broken = JSON.parse(E.exportJSON([E.newCampaign({ seed: 'bad', count: 16, shape: 'archipelago', now: T0 })]));
  const only = Object.values(broken.campaigns)[0];
  only.map.mask = 'nope';
  const res = E.parseImport(JSON.stringify(broken));
  assert.equal(res.campaigns[0].map.shape, 'island');
  assert.ok(res.warnings.some((w) => /coastline/.test(w)));
  assert.ok(E.buildGeometry(res.campaigns[0]).shapes.every((s) => s.points.length >= 3));
});


/* ---------- kingdoms ---------- */

function war(n, extra) {
  const c = E.newCampaign(Object.assign({ seed: 'war' + n, count: 20, kingdoms: n, shape: 'mainland', now: T0 }, extra));
  c.kingdoms.forEach((k) => (k.trait = 'none'));
  return c;
}

test('kingdoms get distinct capitals, colours and ids, spread apart', () => {
  for (const n of [2, 3, 4]) {
    const c = war(n);
    assert.equal(c.kingdoms.length, n);
    assert.equal(new Set(c.kingdoms.map((k) => k.capital)).size, n);
    assert.equal(new Set(c.kingdoms.map((k) => k.color)).size, n);
    assert.equal(new Set(c.kingdoms.map((k) => k.id)).size, n);
    const geo = E.buildGeometry(c);
    const [a, b] = c.kingdoms.map((k) => geo.index.get(k.capital));
    assert.ok(!geo.adjacency[a].has(b), 'first two capitals do not border each other');
    for (const k of c.kingdoms) {
      assert.ok(E.TRAITS[k.trait] && E.CHARGES[k.arms.charge] && E.DIVISIONS[k.arms.division] && E.TINCTURES[k.arms.field]);
      assert.equal(c.territories.find((t) => t.id === k.capital).owner, k.id);
    }
  }
  assert.equal(E.newCampaign({ seed: 'many', count: 20, kingdoms: 9, now: T0 }).kingdoms.length, E.MAX_KINGDOMS);
});

test('a rival can contest and then take conquered land', () => {
  const c = war(2);
  const [k1, k2] = c.kingdoms;
  const target = c.territories.find((t) => !c.kingdoms.some((k) => k.capital === t.id));
  for (let i = 0; i < 3; i++) raid(c, target, 'success', { by: k1.id });
  let d = E.replay(c).territories.get(target.id);
  assert.equal(d.status, 'conquered');
  assert.equal(d.owner, k1.id);
  raid(c, target, 'success', { by: k2.id });
  d = E.replay(c).territories.get(target.id);
  assert.equal(d.status, 'contested', 'two kingdoms hold a share');
  assert.deepEqual(d.inf, { [k1.id]: 60, [k2.id]: 40 });
  raid(c, target, 'success', { by: k2.id });
  raid(c, target, 'success', { by: k2.id });
  const r = E.replay(c);
  d = r.territories.get(target.id);
  assert.equal(d.owner, k2.id);
  assert.equal(d.status, 'conquered');
  assert.equal(r.kingdoms.get(k2.id).conquered, 1);
  assert.equal(r.kingdoms.get(k1.id).conquered, 0);
  assert.ok(r.milestones.some((m) => m.kingdom === k1.id && /slips/.test(m.label)), 'the loser gets a milestone');
});

test('taking an enemy capital is a milestone and counts toward the goal', () => {
  const c = war(2);
  const [k1, k2] = c.kingdoms;
  const cap = c.territories.find((t) => t.id === k2.capital);
  for (let i = 0; i < 3; i++) raid(c, cap, 'success', { by: k1.id });
  const r = E.replay(c);
  assert.equal(r.territories.get(cap.id).owner, k1.id);
  assert.equal(r.kingdoms.get(k2.id).capitalHeld, false);
  assert.equal(r.kingdoms.get(k1.id).conquered, 1);
  assert.ok(r.milestones.some((m) => /capital.*falls to/.test(m.label)));
  // A kingdom can't raid its own capital.
  raid(c, cap, 'success', { by: k2.id, id: 'self' });
  assert.equal(E.replay(c).territories.get(cap.id).owner, k1.id);
});

test('each kingdom keeps its own treasury, army and morale', () => {
  const c = war(2);
  const [k1, k2] = c.kingdoms;
  const t = c.territories.find((x) => !c.kingdoms.some((k) => k.capital === x.id));
  raid(c, t, 'success', { by: k2.id, losses: 7, lootGained: 90 });
  c.adjustments.push({ id: 'a1', kingdom: k1.id, year: 1, season: 'spring', timestamp: ++clock, treasury: 15, army: 0, morale: 0 });
  const r = E.replay(c);
  assert.equal(r.kingdoms.get(k2.id).treasury, E.DEFAULT_START.treasury + 90);
  assert.equal(r.kingdoms.get(k2.id).army, E.DEFAULT_START.army - 7);
  assert.equal(r.kingdoms.get(k1.id).treasury, E.DEFAULT_START.treasury + 15);
  assert.equal(r.kingdoms.get(k1.id).army, E.DEFAULT_START.army);
});

test('traits change the rules for their kingdom only', () => {
  const c = war(2);
  const [k1, k2] = c.kingdoms;
  const free = c.territories.filter((x) => !c.kingdoms.some((k) => k.capital === x.id));
  k1.trait = 'reavers';
  raid(c, free[0], 'success', { by: k1.id });
  raid(c, free[1], 'success', { by: k2.id });
  let r = E.replay(c);
  assert.equal(r.territories.get(free[0].id).control, 50, 'reavers take 50%');
  assert.equal(r.territories.get(free[1].id).control, 40);

  k2.trait = 'horde';
  assert.equal(E.replay(c).kingdoms.get(k2.id).army, E.DEFAULT_START.army + 30);

  k1.trait = 'zealots';
  for (let i = 0; i < 8; i++) raid(c, free[2], 'failure', { by: k1.id });
  assert.equal(E.replay(c).kingdoms.get(k1.id).morale, 30, 'zealot morale floor');

  const m = war(2);
  m.kingdoms[0].trait = 'merchants';
  const before = E.replay(m).kingdoms.get(m.kingdoms[0].id).treasury;
  m.season = 'summer';
  const capGold = m.territories.find((t) => t.id === m.kingdoms[0].capital).goldValue;
  assert.equal(E.replay(m).kingdoms.get(m.kingdoms[0].id).treasury - before, Math.round(capGold * E.RULES.tributeRate * 1.5));

  const w = war(2);
  const [a, b] = w.kingdoms;
  b.trait = 'ironwall';
  const land = w.territories.find((x) => !w.kingdoms.some((k) => k.capital === x.id));
  raid(w, land, 'success', { by: b.id });
  raid(w, land, 'success', { by: a.id });
  assert.equal(E.replay(w).territories.get(land.id).inf[a.id], 30, 'iron walls blunt an attack on held land');
});

/* ---------- multiplayer sync ---------- */

test('merging two devices keeps both players’ raids and respects deletions', () => {
  const base = war(2);
  const [k1, k2] = base.kingdoms;
  const free = base.territories.filter((x) => !base.kingdoms.some((k) => k.capital === x.id));
  const shared = raid(base, free[0], 'success', { by: k1.id });
  const a = JSON.parse(JSON.stringify(base));
  const b = JSON.parse(JSON.stringify(base));
  raid(a, free[1], 'success', { by: k1.id, id: 'ra' });
  raid(b, free[2], 'failure', { by: k2.id, id: 'rb' });
  // b deletes the shared raid; a resolves nothing.
  b.raids = b.raids.filter((r) => r.id !== shared.id);
  b.deleted = [shared.id];
  const m1 = E.mergeCampaigns(a, b);
  const m2 = E.mergeCampaigns(b, a);
  for (const m of [m1, m2]) {
    assert.deepEqual(m.raids.map((r) => r.id).sort(), ['ra', 'rb']);
    assert.deepEqual(m.deleted, [shared.id]);
  }
  assert.deepEqual(E.replay(m1).territories.get(free[1].id), E.replay(m2).territories.get(free[1].id));
});

test('merging keeps the newest season, settings, names and kingdom edits', () => {
  const base = war(2);
  const a = JSON.parse(JSON.stringify(base));
  const b = JSON.parse(JSON.stringify(base));
  b.season = 'summer';
  b.seasonAt = T0 + 10;
  a.name = 'Renamed on A';
  a.settingsAt = T0 + 20;
  a.territories[3].name = 'Newname';
  a.territories[3].editedAt = T0 + 5;
  b.territories[4].override = 'conquered';
  b.territories[4].editedAt = T0 + 6;
  b.kingdoms[1].name = 'Changed on B';
  b.kingdoms[1].updatedAt = T0 + 7;
  a.players = [E.newPlayer('', a.kingdoms[0].id, { id: 'pa', userId: 'u_alice', now: T0 + 8 })];
  const m = E.mergeCampaigns(a, b);
  assert.equal(m.season, 'summer');
  assert.equal(m.name, 'Renamed on A');
  assert.equal(m.territories[3].name, 'Newname');
  assert.equal(m.territories[4].override, 'conquered');
  assert.equal(m.kingdoms[1].name, 'Changed on B');
  assert.equal(m.players.find((p) => p.id === 'pa').userId, 'u_alice');
  // A resolved raid (newer edit) wins over the copy still under way.
  const c1 = JSON.parse(JSON.stringify(base));
  const r = raid(c1, c1.territories.find((x) => !c1.kingdoms.some((k) => k.capital === x.id)), 'ongoing', { by: c1.kingdoms[0].id });
  const c2 = JSON.parse(JSON.stringify(c1));
  Object.assign(c2.raids.find((x) => x.id === r.id), { outcome: 'success', updatedAt: T0 + 99 });
  assert.equal(E.mergeCampaigns(c1, c2).raids.find((x) => x.id === r.id).outcome, 'success');
  assert.equal(E.mergeCampaigns(c2, c1).raids.find((x) => x.id === r.id).outcome, 'success');
});

test('raid ids are unique so simultaneous players never collide', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(E.nextRaidId());
  assert.equal(ids.size, 500);
});

/* ---------- generation options ---------- */

test('generation options shape the map', () => {
  const count = (gen, terr) => {
    let n = 0;
    for (const s of ['g1', 'g2', 'g3']) n += E.newCampaign({ seed: s, count: 25, shape: 'mainland', gen, now: T0 }).territories.filter((t) => t.terrain === terr).length;
    return n;
  };
  assert.ok(count({ mountains: 2 }, 'mountains') > count({ mountains: 0 }, 'mountains'), 'more mountains');
  assert.ok(count({ forests: 2 }, 'forest') > count({ forests: 0 }, 'forest'), 'more forest');
  const gold = (wealth) => E.newCampaign({ seed: 'rich', count: 20, shape: 'island', gen: { wealth }, now: T0 }).territories.reduce((s, t) => s + t.goldValue, 0);
  assert.ok(gold(2) > gold(1) && gold(1) > gold(0), 'wealth scales gold');
  const rivers = (r) => E.buildGeometry(E.newCampaign({ seed: 'wet', count: 22, shape: 'island', gen: { rivers: r }, now: T0 })).rivers.length;
  assert.ok(rivers(2) > rivers(0), 'more rivers');
  assert.deepEqual(E.normGen({ rough: 7, borders: '2' }), Object.assign({}, E.GEN_DEFAULTS, { borders: 2 }));
});

test('older single-player saves import as one kingdom and redraw the same map', () => {
  const v1 = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'v1-campaign.json'), 'utf8');
  const { campaigns } = E.parseImport(v1);
  const c = campaigns[0];
  assert.equal(c.kingdoms.length, 1);
  const raw = JSON.parse(v1);
  const old = Object.values(raw.campaigns)[0];
  assert.equal(c.kingdoms[0].capital, old.baseTerritory);
  assert.equal(c.map.engine, undefined, 'stays on the first-release geometry');
  assert.ok(connected(E.buildGeometry(c)));
  const r = E.replay(c);
  assert.equal(r.treasury, old.treasury, 'same treasury as the old save');
  assert.equal(r.army, old.army);
  for (const t of old.territories) assert.equal(c.territories.find((x) => x.id === t.id).status, t.status);
});


/* ---------- players ---------- */

test('extra players are spread over the kingdoms as teams', () => {
  const c = E.newCampaign({ seed: 'teams', count: 20, kingdoms: 3, players: ['Ragnar', 'Lisa', 'Tom', 'Sigrid', 'Ulf', ' ', 'Bo'], now: T0 });
  assert.equal(c.players.length, 6, 'blank names are skipped');
  const per = c.kingdoms.map((k) => E.playersOf(c, k.id).map((p) => p.name));
  assert.deepEqual(per, [['Ragnar', 'Sigrid'], ['Lisa', 'Ulf'], ['Tom', 'Bo']]);
  const many = E.newCampaign({ seed: 'crowd', count: 20, kingdoms: 2, players: Array.from({ length: 30 }, (_, i) => 'P' + i), now: T0 });
  assert.equal(many.players.length, E.MAX_PLAYERS);
});

test('who may play a kingdom', () => {
  const c = E.newCampaign({ seed: 'who', count: 20, kingdoms: 2, players: ['Anna', 'Ben'], now: T0 });
  const [k1, k2] = c.kingdoms;
  assert.ok(E.kingdomPlayable(c, k1.id, null), 'at one screen anyone plays anything');
  assert.ok(E.kingdomPlayable(c, k1.id, 'u_x'), 'named players without accounts leave a kingdom open');
  c.players.push(E.newPlayer('', k2.id, { userId: 'u_bob', now: T0 }));
  c.players.push(E.newPlayer('', k2.id, { userId: 'u_cat', now: T0 }));
  assert.ok(E.kingdomPlayable(c, k2.id, 'u_bob'));
  assert.ok(E.kingdomPlayable(c, k2.id, 'u_cat'), 'co-rulers both play');
  assert.ok(!E.kingdomPlayable(c, k2.id, 'u_dan'), 'others are locked out');
});

test('version 2 owners become players, and rosters merge across devices', () => {
  const c = E.newCampaign({ seed: 'old-owner', count: 18, kingdoms: 2, now: T0 });
  const raw = JSON.parse(JSON.stringify(c));
  delete raw.players;
  raw.version = 2;
  raw.kingdoms[1].ownerId = 'u_bob';
  const back = E.normalizeCampaign(raw).campaign;
  assert.equal(back.players.length, 1);
  assert.equal(back.players[0].userId, 'u_bob');
  assert.equal(back.players[0].kingdom, raw.kingdoms[1].id);
  assert.equal(back.kingdoms[1].ownerId, undefined);

  const a = JSON.parse(JSON.stringify(c));
  const b = JSON.parse(JSON.stringify(c));
  a.players.push(E.newPlayer('Lisa', c.kingdoms[0].id, { id: 'pl', now: T0 + 1 }));
  b.players.push(E.newPlayer('Tom', c.kingdoms[1].id, { id: 'pt', now: T0 + 2 }));
  let m = E.mergeCampaigns(a, b);
  assert.deepEqual(m.players.map((p) => p.name).sort(), ['Lisa', 'Tom']);
  // Tom switches sides on one device; Lisa leaves on the other.
  const b2 = JSON.parse(JSON.stringify(m));
  Object.assign(b2.players.find((p) => p.id === 'pt'), { kingdom: c.kingdoms[0].id, updatedAt: T0 + 9 });
  const a2 = JSON.parse(JSON.stringify(m));
  a2.players = a2.players.filter((p) => p.id !== 'pl');
  a2.deleted = (a2.deleted || []).concat(['pl']);
  m = E.mergeCampaigns(a2, b2);
  assert.deepEqual(m.players.map((p) => [p.name, p.kingdom]), [['Tom', c.kingdoms[0].id]]);
});

test('raids remember which player logged them', () => {
  const c = E.newCampaign({ seed: 'logger', count: 18, kingdoms: 2, players: ['Anna', 'Ben'], now: T0 });
  const t = c.territories.find((x) => !c.kingdoms.some((k) => k.capital === x.id));
  raid(c, t, 'success', { by: c.kingdoms[1].id, playerId: c.players[1].id });
  const back = E.parseImport(E.exportJSON([c])).campaigns[0];
  assert.equal(back.raids[0].playerId, c.players[1].id);
  assert.deepEqual(back.players, c.players);
});
