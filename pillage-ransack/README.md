# Pillage Ransack

Campaign map and raid tracker for Pillage Ransack. A procedurally drawn map of 15–25 territories (an island, an archipelago or a stretch of mainland coast) shows what you hold, where you raided and how the war is going; logging a raid in the tracker updates the map, and tapping a territory on the map fills in the raid form. Like Studyover, it stands apart from The Break 5 and just lives in this repo.

## Where it runs

| Device | How | Data |
|---|---|---|
| **Any browser, iPhone, Android** | Open https://claude.ai/artifact/713o1Dh2t4C3TVXNggtPVV and sign in to claude.ai | Synced to your claude.ai account |
| **Offline file** | Open `index.html` directly | This browser only, no sync |

Back up with **Campaign → Export**. Opened as a file, a campaign lives only in that browser's storage, and clearing site data deletes it.

## Random maps

- **New random map** (next to the map) rolls a whole new campaign: random seed, coastline and size. Roll as often as you like; a rolled map is only saved once you log a raid on it or press *Keep this map*, so rerolling doesn't pile up campaigns.
- **Campaign → New campaign** gives you the controls: coastline (island, archipelago, mainland coast, or random), 15–25 territories, the seed, and a live preview of exactly the map you'll get. The same seed, coastline and size always draw the same map, so a seed can be shared.
- **Coastlines**: *Island* is one landmass with bays and headlands. *Archipelago* is 2–4 islands of different sizes joined by sea lanes (raids can cross them; a crossing counts a quarter longer). *Mainland coast* runs a coastline across the map at a random angle with the land carrying on off the edges.
- Every map also gets terrain (mountains, hills, forest, grassland, marsh, coast), names, gold values, garrisons, a home base on a landing beach and a campaign name after its richest prize.

## What's on the map

- **Territories**: unclaimed (grey, tinted by terrain), claimed (shades toward red as control rises), contested (red stripes), conquered (full red). Home base has the keep.
- **Settlements**: every territory has a seat drawn above its name: harbour, fishing village, mine, watchtower, castle, standing stones, hunting lodge, abbey, market town, mill, village or fen village, chosen from its terrain, wealth and garrison. The Territory tab and the hover card name it.
- **Rivers and lakes**: 2–4 rivers start in the mountains and hills and run downhill along borders to the sea, into another river, or into a lake where the ground gives them nowhere lower. Marshes get ponds.
- **Sea**: offshore islets, a longship or two and, on most maps, a sea serpent. Sea lanes between islands carry a small ship.
- **Views**: Political, Wealth (dim → bright gold by gold value), Resistance (slate shades + shield size by current garrison), Terrain (changes colour with the season; mountains get snow in winter). Forests mix broadleaf and pine; mountains vary in size.
- **Raids**: the last 10 raids are drawn as paths along the overland route from where they set out. Green glow + flag = success, red + cross = failure, yellow dashed = under way, with a raiding party marching along it. A new raid animates out to its target. Failed raids leave scorch marks that fade over a few seasons.
- **Trade routes** (toggle): every land border as a dotted road between territory centres. There are no trading rules yet; this is the connection graph routes are planned on.
- **Zoom & pan**: mouse wheel, drag, pinch, or the + / − / Fit buttons. Names and icons stay readable at every zoom.
- **Planning**: in *Plan raid*, the frontier next to your land is outlined, the target pulses, and the route and its length in leagues are drawn. Odds compare raiders sent with the garrison times the terrain's defence.

## Tracker

- **Territory**: gold value, garrison now and at full strength, your control, raid record, loot taken, men lost, scorch level. Rename it, set its status by hand, plan a raid on it or raid from it.
- **Plan raid**: target, starting point, raiders sent, result (under way / success / failure), men lost, gold taken, notes. Raids *under way* are resolved later from the log.
- **Raid log**: every raid, newest first. Record the result of a raid under way, show it on the map, or delete it.
- **Campaign**: switch or create campaigns (name, size, map seed), conquest goal and starting gold/army/morale, recruiting and spending, your own milestones, export/import, and the rules.
- **Timeline**: one column per season with a dot for every raid and flags for milestones. First blood, conquests, heavy defeats, 25/50/75% of the realm, treasury marks and reaching the goal are added automatically. The conquest bar counts conquered territories (home not counted) against your goal.
- **End season** applies tribute, garrison recovery and scorch fading. **◂** goes back a season while nothing has been logged in the current one.

## How raids change the map

The rules were not written down anywhere, so these are placeholders. They live in `RULES` at the top of `engine.js`; change a number and the whole history recalculates.

- Success: +40% control, garrison loses 40%. At 100% the territory is conquered and its garrison is gone. +5 morale, +10 more on a conquest.
- Failure: −25% control, the land is scorched, the garrison grows 10% (up to 1.5× full strength). −10 morale. Losing a quarter of your army in one raid is a "heavy defeat".
- Contested: a raid is under way there, or your last raid there failed while you still held some control.
- End of season: conquered land pays 20% of its gold value as tribute, claimed land part of that by control; garrisons recover 15% of full strength; scorch fades by half a level.

The campaign is stored as its history (raids, adjustments, seasons) and everything else is recalculated from it, so deleting or resolving a raid can't leave the map out of step with the log.

## Data format

Exports follow the brief's shape, `{"campaigns": {"<id>": {...}}}`, with each campaign holding `year`, `season`, `territories` (`id`, `name`, `position`, `goldValue`, `garrison`, `status`, `terrain`, `conquered`, plus `garrisonBase`, `control`, `damage`, `override`) and `raids` (`id`, `sourceTerritory`, `targetTerritory`, `outcome`, `timestamp` in milliseconds, `losses`, `lootGained`, plus `warband`, `year`, `season`, `notes`). Extra fields: `map` (size, seed and coastline: `shape` plus `rx`/`ry` for an island, `islands` for an archipelago, `coast` for a mainland, so the same borders redraw), `baseTerritory`, `start`, `treasury`, `army`, `morale`, `goalPct`, `adjustments`, `milestones`.

Import accepts that shape, a list of campaigns, or a single campaign. Hand-written files work too: statuses are kept as hand-set statuses, `garrison` becomes the full-strength garrison, second timestamps become milliseconds, and raids pointing at unknown territories are dropped with a note. Imports always arrive as new campaigns.

From the browser console (or another script on the page), `PillageRansack.logRaid({targetTerritory: 't4', outcome: 'success', losses: 3, lootGained: 80})` logs a raid without the form.

## Files

- `engine.js`: map generation (Voronoi by half-plane clipping per landmass, no library; coastlines, rivers, sea lanes, settlements), the rules, replay, import/export. No DOM, so it runs in Node.
- `app.html`: the page (published as the claude.ai artifact above). Edit this, then republish it.
- `index.html`: generated by `build.mjs`: `app.html` + `engine.js` in one file that opens from disk.
- `test/engine.test.js`: map generation for all three coastlines, rivers, settlements, rules, routes, import/export.

```bash
node --test pillage-ransack/test/*.test.js   # 25 tests
node pillage-ransack/build.mjs               # rebuild index.html after editing app.html or engine.js
```

## Known limitations

- **Not a game engine.** It records what happened; it doesn't roll dice or decide outcomes. The odds shown are a guide.
- **Placeholder rules** (above). If Pillage Ransack has real rules, they replace `RULES` and the parts of `replay()` they change.
- **No real-time co-editing.** Two devices editing one campaign at the same moment: the last save wins.
- A synced campaign must stay under 250 KB (roughly 1,000 raids). Past that it keeps saving in the browser and asks you to export.
- Rivers, lakes, islets and ships are scenery. They don't change raids, routes or gold (only sea lanes do).
- Archipelago islands are kept far enough apart that their coasts never touch, so they come out smaller than a single island and their names are smaller too; zoom in.
- Tested in Chromium at desktop and phone sizes; not yet on a physical iPhone or in Safari.
