# Chrome Ledger

Tekst-simulatie: je runt een corporatie in de cyberpunkstad Meridian Bay, maand per maand. Claude is de Game Master; een Python-engine gooit de dobbelstenen, zodat de GM niets kan voorkoken.

## Spelen
1. Python 3.8 of nieuwer (geen extra pakketten).
2. Open deze map in Claude Code en zeg **"start"**.
3. Claude stelt de setup-vragen, daarna speel je in vrije tekst. Handige commando's: `/status`, `/inbox`, `/kaart`, `/beurt`, `/rivalen`, `/save`.

## Mappen
- `CLAUDE.md` — de regels voor de Game Master
- `tools/sim.py` — engine en commando's (`python tools/sim.py` toont ze allemaal)
- `tools/world.py` — facturen, markt, facties, personeel, chaos, geruchten, verhaallijnen
- `game/state.json` — de huidige stand · `game/state.template.json` — lege start
- `game/inbox/` — mails · `game/map.md` — kaart · `game/log.md` — logboek · `game/rolls.txt` — elke dobbelsteenworp
- `game/events_custom.json` — eigen events · `game/saves/` — backups
