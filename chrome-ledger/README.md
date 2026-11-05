# Chrome Ledger

## Versie 1.0 (claude.ai-artifact)

De hoofdversie draait als artifact in de browser, ook op je gsm: `artifact/chrome-ledger.html`, gepubliceerd op https://claude.ai/artifact/G1Mgzkv5m1xg2BVrcuvUCq. Elke game speelt in een willekeurig gegenereerde stad met een gebiedskaart, zeezones en zeedominantie, rivalen met een eigen economie (oorlog, vrede, handel, districten ruilen), chat en mail met iedereen in de stad, personeel, eigen bedrijfssoorten en een live GM die kosten en kansen bepaalt; de engine gooit de dobbelsteen. Je spel wordt online bewaard en is alleen voor jou.

Hieronder staat de oudere lokale versie (Python-engine met een scherm op je eigen pc). Die heeft de 1.0-functies niet.

## Lokale versie

Tekst-simulatie: je runt een corporatie in de cyberpunkstad Meridian Bay, maand per maand. Er is een eigen scherm met inbox, kaart en financiën. Claude is de Game Master voor alles wat niet met een knop kan, en een Python-engine gooit de dobbelstenen, zodat niemand de uitkomsten kan voorkoken.

## Starten
1. Installeer Python 3.8 of nieuwer (Windows: vink **Add to PATH** aan). Er zijn geen extra pakketten nodig.
2. **Windows:** dubbelklik `Start Chrome Ledger.bat`. **Mac/Linux:** `./start.sh`. Of in een terminal: `python tools/ui.py`.
3. Je browser opent het spel op `http://localhost:8765`. Het draait alleen op je eigen pc. Sluit het venster met de zwarte terminal om te stoppen.

### Op je gsm (iPhone of Android)
Het spel draait op je pc; je gsm is het scherm. Je pc en gsm moeten op **dezelfde wifi** zitten.
1. Dubbelklik `Start voor gsm.bat` (Mac/Linux: `python3 tools/ui.py --gsm`).
2. Het venster toont een link zoals `http://192.168.1.20:8765/?k=3fa91c`. Open die in Safari of Chrome op je gsm.
3. iPhone: tik op de deel-knop en kies **Zet op beginscherm**. Dan heb je een app-icoon en speelt het schermvullend.
4. Windows vraagt de eerste keer om netwerktoegang: kies **Privénetwerken**.

De code in de link zorgt dat alleen jij kunt spelen, niet iemand anders op dezelfde wifi. Laat de pc aan en het venster open zolang je speelt.

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
