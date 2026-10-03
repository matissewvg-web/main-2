# Pillage Ransack

Campaign map and raid tracker for Pillage Ransack. Up to four kingdoms fight over a procedurally drawn map of 15–25 territories: an island, an archipelago, a mainland coast, an inland sea, twin lands split by a strait, a fjord coast or a peninsula. The map shows who holds what, where everyone raided and who is winning. Logging a raid updates the map, and tapping a territory on the map fills in the raid form. Like Studyover, it stands apart from The Break 5 and just lives in this repo.

## Where it runs

| Device | How | Data |
|---|---|---|
| **Any browser, iPhone, Android** | Open https://claude.ai/artifact/713o1Dh2t4C3TVXNggtPVV and sign in to claude.ai | Synced to your claude.ai account; campaigns can be shared with other players |
| **Offline file** | Open `index.html` directly | This browser only, no sync, one screen |

Back up with **Campaign → Export**. Opened as a file, a campaign lives only in that browser's storage, and clearing site data deletes it.

## Kingdoms and players

- A campaign has **1–4 kingdoms**, each with its own capital, treasury, army, morale and raids. Choose the number when you create a campaign, or add and remove kingdoms later in **Kingdoms**.
- **At one screen** (hot-seat): pick who is playing in **Playing as** at the top, take your turn, hand over.
- **From separate devices** (claude.ai version only): **Campaign → Share this campaign**, then invite players from the artifact's **Share** menu on claude.ai. Each player claims a kingdom in **Kingdoms** and can then only act for that kingdom. Every device's moves are merged, so two players logging raids at the same moment both keep their raids.
- Kingdoms fight over the same land. Control is shared out: a successful raid takes control from whoever holds the territory, and two kingdoms holding a share makes it **contested**. Capitals can be raided and taken, and a fallen capital counts toward the goal for whoever took it. The **first kingdom to conquer the goal share of the realm wins**.

Why four: map colour is how you tell kingdoms apart at a glance, and four colours (crimson, azure, gold, sea green) is the most that stay distinguishable on the parchment for every reader. That was checked with colour-blind simulation and a normal-vision floor; no fifth colour passed. Coats of arms, the legend and the capital banners repeat each kingdom's identity, so colour is never the only cue.

## Customising a kingdom

**Kingdoms → Customise** opens the editor:

- **Name, ruler (title and name), motto.**
- **Colour on the map** from the four map colours. Each kingdom's colour is unique.
- **Coat of arms**: division (plain, per pale, per fess, per bend, quarterly, chevron, saltire), field, second tincture and charge colour from the eight heraldic tinctures, and a charge (wolf, raven, axe, longship, tower, dragon, boar, stag, crown, sun, hammer). The shield previews live; **Roll new arms** suggests one that follows the rule of tincture.
- **Trait**, which bends the rules for that kingdom only:
  - *Reavers*: successful raids take 50% control instead of 40%.
  - *Merchant princes*: 50% more tribute.
  - *Iron walls*: garrisons on your land recover twice as fast, and raids on your land take 10% less control.
  - *Zealots*: failed raids cost half the morale, and morale never falls below 30.
  - *Seafarers*: sea crossings are as quick as land, and raids on coast take 10% more control.
  - *Horde*: 30 more men to start, and conquests lift morale by 15.
- **Capital**: choose from a list or **Pick on map**. It is fixed once raiding starts, because moving it would rewrite the war.
- **Starting gold, men and morale.**

The capital flies the kingdom's banner (in the colour of whoever holds it) and its coat of arms.

## Random maps

- **New random map** (next to the map) rolls a new campaign with the same number of kingdoms as the current one, and a random seed, coastline, size and land settings. A rolled map is only saved once you log a raid on it or press *Keep this map*, so rerolling doesn't pile up campaigns. New maps rise out of the sea from the middle outward.
- **Campaign → New campaign** gives the controls, with a live preview of exactly the map you'll get:
  - Coastline: island, archipelago, mainland coast, inland sea, twin lands, fjord coast, peninsula, or random.
  - Number of kingdoms and territories.
  - Under *Land, borders and riches*, eight settings at three levels each: coastline (smooth, natural, ragged), borders (even, natural, wild), mountains, forests, marshes, rivers, wealth and garrisons. *Surprise me* randomises them.
- The same seed and settings always draw the same map, so a seed can be shared.
- How it is generated: the map is a jittered grid of about 3,800 small cells. A shape field plus noise decides which cells are land, which is what makes fjords, straits, lakes and islets possible. Territories are grown outward from their seats over land and never across water, giving natural, irregular borders. Elevation comes from distance to the sea plus ridges, and decides where mountains go and which way rivers run.

## What's on the map

- **Territories** in political view: unclaimed (grey, tinted by terrain), claimed (shades toward the holder's colour), contested (striped in the rival's colour), conquered (full colour). Roads appear between neighbouring territories one kingdom has conquered.
- **Settlements**: every territory has a seat above its name (harbour, fishing village, mine, watchtower, castle, standing stones, hunting lodge, abbey, market town, mill, village or fen village). A conquered seat flies its owner's pennant; a badly scorched one is shown ruined and burning.
- **Rivers and lakes**: rivers start high and run downhill to the sea, into another river, or into a lake. Inland seas and natural lakes come from the coastline; marshes get ponds.
- **Sea**: islets, longships, a sea serpent on most maps, and dashed sea lanes with a ship wherever landmasses need joining.
- **Views**: Political, Wealth (dim → bright gold by gold value), Resistance (slate shades + shields sized by garrison), Terrain (changes with the season; mountains get snow in winter). In the other views held land keeps an outline in its owner's colour.
- **Raids**: the last 10 raids are drawn along their route, glowing green for success, red for failure, yellow and dashed while under way. The raiding party carries its kingdom's colours. Failed raids scorch the land.
- **Zoom & pan**: mouse wheel, drag, pinch, or + / − / Fit. Names and icons stay readable at every zoom.

## Tracker

- **Territory**: gold, garrison, who holds how much control (a bar per kingdom), raid record, loot, losses, scorching. Rename it, set its status and holder by hand, raid it or raid from it.
- **Raid**: the raiding kingdom, target, starting point (its capital or land it holds), raiders sent, result, men lost, gold taken, notes. The route, its length in leagues and the odds update as you type. Raids *under way* are resolved later from the log.
- **Log**: every raid, newest first, filterable by kingdom. Record results, show a raid on the map, or delete it.
- **Kingdoms**: each kingdom's arms, ruler, trait, capital and standing; play as it, customise it, claim it (shared campaigns), add or remove kingdoms.
- **Campaign**: switch or create campaigns, share one, conquest goal, recruiting and spending for the kingdom you're playing, your own milestones, export/import, and the rules.
- **Timeline**: one column per season, a dot per raid (ringed in the kingdom's colour) and flags for milestones. First blood, conquests, lost territories, fallen capitals, heavy defeats, 25/50/75%, treasury marks and the winner are added automatically. The conquest bar stacks every kingdom's share against the goal.
- **End season** pays each kingdom tribute, recovers garrisons and fades scorch marks. **◂** goes back a season while nothing has been logged in the current one.

## How raids change the map

The rules were never written down, so these are placeholders. They live in `RULES` and `TRAITS` in `engine.js`; change a number and the whole history recalculates.

- Success: +40% control (taken first from whoever else holds a share) and the garrison loses 40%. At 100% the territory is conquered and its garrison is gone. +5 morale, +10 more on a conquest; the kingdom that loses a territory loses 8 morale.
- Failure: −25% of the raider's control there, the land is scorched, the garrison grows 10% (up to 1.5× full strength). −10 morale. Losing a quarter of your army in one raid is a "heavy defeat".
- Contested: two kingdoms hold a share, a raid is under way there, or the holder's own last raid there failed.
- End of season: land pays tribute to whoever holds it (20% of its gold value when conquered, part of that when claimed); garrisons recover 15% of full strength; scorch fades by half a level.

Each campaign is stored as its history (raids, adjustments, seasons) and everything else is recalculated from it. That is also what makes merging two players' moves safe.

## Data format

Exports follow the brief's shape, `{"campaigns": {"<id>": {...}}}`. Each campaign holds:

- `year`, `season`.
- `territories`: `id`, `name`, `position`, `goldValue`, `garrison`, `status`, `terrain`, `conquered`, plus `garrisonBase`, `owner`, `control`, `influence` (each kingdom's share), `damage`, `override`/`overrideBy`.
- `raids`: `id`, `sourceTerritory`, `targetTerritory`, `outcome`, `timestamp` in milliseconds, `losses`, `lootGained`, plus `by` (the raiding kingdom), `warband`, `year`, `season`, `notes`.
- `kingdoms`: `id`, `name`, `ruler`, `motto`, `color`, `arms`, `trait`, `capital`, `start`, `ownerId`, plus derived `treasury`, `army`, `morale`.
- `map`: size, seed, `shape`, and for new maps `engine: 2` with the coastline's `mask` and the `gen` settings, so the same borders redraw.
- `goalPct`, `adjustments`, `milestones`, and sync bookkeeping (`deleted`, `seasonAt`, `settingsAt`, per-item `updatedAt`/`editedAt`).

Import accepts that shape, a list of campaigns, or a single campaign. Saves from the first release become one kingdom whose capital is the old home base, and their maps redraw exactly as before. Hand-written files work too: statuses are kept as hand-set statuses, `garrison` becomes the full-strength garrison, second timestamps become milliseconds, and raids pointing at unknown territories are dropped with a note. Imports always arrive as new campaigns.

From the browser console, `PillageRansack.logRaid({targetTerritory: 't4', outcome: 'success', losses: 3, lootGained: 80, by: 'k2'})` logs a raid without the form.

## Files

- `engine.js`: map generation (the fine-grid generator for new maps, and the first release's per-landmass Voronoi for old ones; no geometry library), kingdoms and traits, the rules, replay, merging, import/export. No DOM, so it runs in Node.
- `app.html`: the page (published as the claude.ai artifact above). Edit this, then republish it.
- `index.html`: generated by `build.mjs` as `app.html` + `engine.js` in one file that opens from disk.
- `test/engine.test.js`, `test/fixtures/v1-campaign.json`: every coastline, rivers, settlements, kingdoms and traits, merging, generation settings, rules, routes, import/export, and a save from the first release.

```bash
node --test pillage-ransack/test/*.test.js   # 35 tests
node pillage-ransack/build.mjs               # rebuild index.html after editing app.html or engine.js
```

## Known limitations

- **Not a game engine.** It records what happened; it doesn't roll dice or decide outcomes. The odds shown are a guide.
- **Placeholder rules and traits** (above). They're untested for balance. If Pillage Ransack has real rules, they replace `RULES`, `TRAITS` and the parts of `replay()` they change.
- **Online play depends on claude.ai sharing.** Players need claude.ai accounts and edit access to the artifact; whether you can grant that depends on your plan's share options. Who may act for which kingdom is enforced by the page, not the server, so it is a game among friends, not a cheat-proof one.
- **Merging is per item.** Raids, adjustments and milestones from every device are kept. Two people editing the same setting at the same time (a kingdom's name, the season) keep whichever save came last.
- **Four kingdoms at most** (see above).
- A synced campaign must stay under 250 KB (roughly 1,000 raids). Past that it keeps saving in the browser and asks you to export.
- Rivers, lakes, islets and ships are scenery; only sea lanes change routes.
- Generating a new map takes about a quarter of a second, so the preview lags a moment behind the sliders.
- Tested in Chromium at desktop and phone sizes, and with two simulated players on a stand-in for claude.ai's storage. Not yet on a physical iPhone, in Safari, or with two real claude.ai accounts.
