# Chrome Ledger

## Versie 1.0 (claude.ai-artifact)

De hoofdversie draait als artifact in de browser, ook op je gsm: `artifact/chrome-ledger.html` (scherm), `artifact/engine.js` (spelregels, opslag, acties) en `artifact/world-data.js` (kaartdata), gepubliceerd op https://claude.ai/artifact/G1Mgzkv5m1xg2BVrcuvUCq. Je bouwt een megacorporatie op de echte wereldkaart in cyberpunkstijl (Natural Earth-grenzen, 43 speelbare gebieden, 16 zeezones) en kiest bij de start op welk continent en in welk gebied je begint. Op zee bouw je eskaders en verdeel je ze over de zeezones: wie het overwicht heeft, verdient eraan en bereikt elke kust; in oorlog volgen zeeslagen en konvooiaanvallen. De kaartdata wordt gebouwd met `artifact/build-world.js`. Verder: rivalen met een eigen economie (oorlog, vrede, handel, districten ruilen), chat en mail met iedereen in de stad, personeel, eigen bedrijfssoorten en een live GM die kosten en kansen bepaalt; de engine gooit de dobbelsteen. Je spel wordt online bewaard en is alleen voor jou.

### Versies
- **3.5 Druk uit de wereld:** legale divisies trekken boven niveau 6 geen extra heat meer (voorheen werd elk groot bedrijf vroeg of laat opgepakt); een divisie die een jaar niets verkoopt verliest klanten, tot −20% omzet. Gemeten (verstandige bot, 150 spellen Realistisch / 100 andere): Casual 79% winst, Realistisch 42% winst en 23% razzia (was 35% en 38%), Genadeloos 12%. Passief op Casual haalt nog 64% de termijn (was bijna altijd). Een deel van de razzia-daling komt van de testbot, die nu geen riskante divisies meer opent als hij al heat heeft.
- **3.4 Eerlijk einde:** de winstdrempel hangt af van de speellengte (€4.800k / €8.000k / €12.000k). Hegemonie is 60% op drie continenten en Marktmeester is 3 van de 5 oorspronkelijke rivalen uitschakelen; voorheen viel in 100% van de testspellen alleen de economische overwinning. Score: waarde telt als 40 × √waarde, plus tempo bij snel winnen; verliezen kost de waarde van je bedrijf en geeft ×0,75. Gemeten mediaan (verstandige bot, Realistisch): winst 7104, termijn 5018, razzia 863, failliet 300. Handgecontroleerd: overgenomen op €7.900k scoort 885, de termijn halen op €4.000k scoort 3.910.
- **3.3.1 Na de playtest:** abonnementen draaien op abonnees (aantrekkingskracht bepaalt de instroom, kwaliteit en prijs de opzeggers; trager maar stabieler). Na een geslaagde overname kies je hoe je het koppelt: samenvoegen, eigen divisie, dochter of opknippen; het bedrijf brengt zijn bestseller mee. Een lege divisie legt uit hoe ze geld maakt en geeft twee startideeën met één klik. De GM zit op elk scherm (knop GM of toets G). Fout opgelost: een zwak eerste product verlaagde de omzet onder die van een lege divisie.
- **3.3 De GM ontwerpt en vertelt:** een nieuwe divisie of eigen bedrijfstak beschrijf je in je eigen woorden (bv. "een eigen ambulancevloot met gepantserde vtol's"). De GM kiest een bestaande soort of verzint een nieuwe met eigen cijfers binnen vaste grenzen, ontwerpt het eerste product of de eerste dienst (start vanzelf bij de opening) en schrijft een openingsverhaal. Om de paar maanden schrijft de GM een volgend hoofdstuk van een verhaalboog rond jouw bedrijf, met je echte producten, mensen, crew en rivalen; je keuze stuurt het volgende hoofdstuk. Keuzes die de GM schrijft tonen nu precies wat ze doen (bij lukken en mislukken).
- **3.2.1 Eerlijker begin:** facturen, gebeurtenissen, chaos, aanslagen, prijsoorlogen en beschermgeld schalen mee met je omzet, zodat een starter niet als een megacorp geraakt wordt.
- **3.2 Jij beschrijft, de GM ontwerpt:** iets nieuws maken begint met je eigen woorden (product, dienst, abonnement of netwerk). De GM ontwerpt naam, vorm, doelgroep, markt, kosten, duur, moeilijkheid, effecten per maand en 2-3 eigen verhaallijnen; de engine bewaakt de grenzen en gooit. De oude keuzemenu's staan onder Handmatig.
- **3.1 Spellen naast elkaar:** saveslots bij Logboek → Spellen: wisselen, hernoemen en verwijderen; elk spel heeft zijn eigen mail, chats en back-ups.
- **3.0 Af, levend en met een einde:** winnen (€8.000k, 80% op drie continenten of alle rivalen weg) of na 10/20 jaar een score, eindrapport en eregalerij. Wat nu?-kaart, gezondheid van morale en heat, terugverdientijden, spelregels in het hulpvenster. Vraag en aanbod per productsoort, levende producten (aard, prijs, eigenschap, recensies, eigen gebeurtenissen en geschiedenis), rivalen met eigen productlijnen, productcatalogus met filter, ontwikkelen met soort, focus en voorspelde kansen, productiewachtrij, start zonder producten. Vijf rivalen die groter beginnen. Economie herzien (afnemende meeropbrengst, progressieve belasting, heat-evenwicht) en een fout gerepareerd waardoor de speeltijd na 48 maanden stilstond. Back-ups, export/import, rustiger scherm. Het bestand is opgesplitst in drie delen.
- **2.1 Producten en doelwit:** productlijn per divisie (kwaliteit, populariteit, omzet; ontwikkelen, campagnes, nieuwe versies; lanceringen kunnen floppen of teruggeroepen worden). Projecten kunnen vertragen of mislukken. Rivalen en syndicaten zetten fixers en huurlingen op je (sabotage, datadiefstal, ontvoering, omkoping, inbraak, laster), met verdediging en vooraf waarschuwen via je crew. Oprichting met zoom tot landniveau en landknoppen.
- **2.0 Crew, tijd en dobbelstenen:** de d100 is vervangen door 2d6 + bonus tegen een doel (twee zessen altijd raak, twee enen nooit). Crew op de loonlijst (netrunner, fixer, huurling, dealmaker, spindokter, speurder): opdrachten kosten verder niets en wie slaagt groeit. Klussen van fixers, huurlegers, bijzondere wereldgebeurtenissen, tijdperken, status, opvolgers in je netwerk, nieuwe CEO's, startups en faillissementen. Veel acties goedkoper.
- **1.4 Comfort en oprichting:** de oprichting is fase 0 in het spelscherm zelf (land, bedrijf, koers, registreren). Sneltoetsen: 1-9, 0 en − voor de tabs, N volgende maand, A Assistent, J/K door mail, / zoeken, M kaartmodus, Esc sluiten, ? overzicht.
- **1.3 Onderwereld:** elf syndicaten met eigen gebied. Bescherming, partnerschap, geschenken of verdrijven (d100). Afpersing als keuzemail, bendeoorlogen die de economie van een land raken, kaartmodus Onderwereld.
- **1.2 Mensen:** relaties met netwerk en directie, met acties zonder Assistent (diner, cadeau, gunst, druk). Drempels geven gunsten en vaste voordelen. Keuzemails met knoppen in plaats van losse flavor-mails.
- **1.1 Wereld:** wereldnieuws, ranglijst van alle bedrijven met waarde, markten per sector, 25 bedrijven voor contracten, aandelen en overnames, gebeurtenissen per land, startvoordeel per soort land en "wat het oplevert" per gebied.

Gepland: 3.6 opslag en foutlog, 3.7 bedrijfsfocus, 3.8 onderzoek, 3.9 meer comfort.

### Tests
- `node chrome-ledger/tests/balans.js 150 Realistisch [kort|normaal|eindeloos]` speelt 150 spellen per strategie (passief, verstandig, agressief) en toont eindes, speelduur, waarde, score per einde, hoe ver spelers komen richting hegemonie en hoeveel rivalen ze uitschakelen.
- `node chrome-ledger/tests/concept.js` test GM-concepten met een nagebootste GM (ontwerp, grenzen, opzetten, lancering, eigen verhaallijn).
- `node chrome-ledger/tests/verhaal.js` test de GM-divisie en de verhaalbogen met een nagebootste GM.
- `node chrome-ledger/tests/playtest.js` test abonnees, overname koppelen, startideeën en het GM-venster.
- `node chrome-ledger/tests/spellen.js` test de saveslots (maken, wisselen, hernoemen, verwijderen, herladen).
- `node chrome-ledger/tests/schermen.js chrome-ledger/artifact/chrome-ledger.html <map>` klikt de belangrijkste schermen door op desktop en mobiel en maakt screenshots.

Balans (3.5, verstandige bot): Casual 79% winst, Realistisch 42% (24% failliet, 23% razzia), Genadeloos 12%. Werkplan en open punten: `PLAN.md`. Vroegste faillissement op Realistisch rond maand 33. Een passieve speler wint nooit: 30% failliet, 34% coup, de rest haalt het einde van de termijn met een lage score. De eerdere ±43% kwam uit een te kleine steekproef.

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
