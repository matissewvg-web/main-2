# Chrome Ledger

Tekst-simulatie: je runt een corporatie in de cyberpunkstad Meridian Bay, maand per maand. Er is een eigen scherm met inbox, kaart en financiën. Claude is de Game Master voor alles wat niet met een knop kan, en een Python-engine gooit de dobbelstenen, zodat niemand de uitkomsten kan voorkoken.

## Starten
1. Installeer Python 3.8 of nieuwer (Windows: vink **Add to PATH** aan). Er zijn geen extra pakketten nodig.
2. **Windows:** dubbelklik `Start Chrome Ledger.bat`. **Mac/Linux:** `./start.sh`. Of in een terminal: `python tools/ui.py`.
3. Je browser opent het spel op `http://localhost:8765`. Het draait alleen op je eigen pc. Sluit het venster met de zwarte terminal om te stoppen.

De eerste keer richt je je bedrijf op in het scherm. Daarna:
- **Inbox**: lezen, archiveren, zoeken, en reageren op een mail. Een reactie gaat als opdracht naar de GM.
- **Overzicht**: het laatste maandrapport en besluiten die op je wachten (Mara Vonk, het nomadenpact, een overnamebod).
- **Kaart**: klik op een district om er een vestiging te openen of iets anders te regelen.
- **Bedrijf**: divisies uitbreiden of starten, projecten, directie en facties.
- **Financiën**: facturen betalen of bewust laten liggen, lenen, aflossen, en geld verschuiven naar zwart of offshore.
- **Volgende maand**: de engine speelt de maand en de CFO stuurt een rapport.

## De GM (Claude)
Wat geen knop heeft (omkopen, een journalist bellen, een rivaal saboteren of iemand ontslaan), schrijf je als **opdracht**. Open dan Claude Code in deze map en zeg **"verwerk opdrachten"**. Claude zegt wat het kost, gooit de dobbelstenen en antwoordt met een mail die meteen in je scherm verschijnt. Je kunt ook helemaal zonder scherm spelen: open Claude Code hier en zeg "start".

## Mappen
- `tools/ui.py` + `tools/ui/index.html` — het scherm
- `tools/sim.py` — engine en commando's (`python tools/sim.py` toont ze)
- `tools/world.py` — facturen, markt, facties, personeel, chaos, geruchten, verhaallijnen
- `CLAUDE.md` — de regels voor de Game Master
- `game/state.json` — de stand · `game/inbox/` — mails · `game/opdrachten.json` — opdrachten aan de GM
- `game/map.md` — kaart · `game/log.md` — logboek · `game/rolls.txt` — elke dobbelsteenworp · `game/saves/` — backups
