# Chrome Ledger: werkplan

Dit plan wordt elke ronde bijgewerkt: wat af is gaat naar "Gedaan", nieuwe punten uit eigen kritiek komen onderaan "Open" met een datum.

## Spelregels voor mezelf
- **Eerst repareren en verduidelijken, dan pas uitbreiden.** Per ronde hoogstens één nieuw systeem. Elke derde ronde is een opruimronde: bugs, teksten, schermen.
- **Meten, niet gokken.** Elke balanswijziging wordt gemeten met `tests/balans.js` (150 spellen) vóór en na. Cijfers in de README zijn echte metingen, met de steekproefgrootte erbij.
- **Eerlijk over de grenzen.** De testbots zijn geen spelers: ze negeren heat, breiden niet uit naar andere continenten en gebruiken de GM niet. Een goed bot-cijfer betekent niet dat het spel leuk is. De GM-functies zijn alleen met een nagebootste GM getest; echte speelervaring van de gebruiker weegt zwaarder dan elke meting.
- **Niet doen:** engine.js opsplitsen in modules, tests in het artifact stoppen, nieuwe systemen bouwen terwijl een bestaand systeem onduidelijk is.

## Waar het spel nu staat (3.7)
Sterk: veel systemen, een echt einde met eerlijke score, de GM als ontwerper en verteller, saveslots, tests.
Zwak:
1. **Balans is beter maar nog grof.** Moeilijkheid is nog vooral een kostenfactor. Op Casual eindigt nog 21% van de verstandige spellen in een razzia, wat te streng is voor Casual.
2. **Nog veel tegelijk voor een nieuwe speler.** Twaalf tabs en veel knoppen; Eerste stappen en een rustigere inbox helpen, maar of het genoeg is weet ik pas na een playtest.
3. **Online opslag is niet getest.** Mijn tests draaien alleen in browsermodus; de online modus (de db van het artifact) zie ik alleen als jij speelt.
5. **De GM is nog een chatvenster.** Hij vertelt, maar plant niet: rivalen en syndicaten hebben geen eigen verhaal dat over maanden loopt.

## Open (in volgorde)
### Nog over uit 3.7
- Kaartlabels in Europa overlappen bij inzoomen; aria in inbox en kaart.
- "Wat nu?" herhaalt soms wat Eerste stappen al zegt (eerste product): dubbel weglaten zolang de stappenkaart staat. (8 nov)

### 3.8 De GM plant mee
- Snelknoppen in het GM-venster: "Wat nu?", "Wat kost dit?", "Vat mijn maand samen".
- Plannen van rivalen en syndicaten over meerdere maanden (GM schrijft het plan, de engine voert de stappen uit binnen grenzen, met een vaste versie als de GM niet live is). Je kunt ze ontdekken via crew of netwerk en verstoren.

### 3.9 Diepgang waar het al leeft
- Abonnementen: prijsverhoging, gebeurtenis rond opzeggers, loyaliteitsprogramma.
- Dochters-overzicht: overgenomen bedrijven bekijken en later alsnog samenvoegen of verkopen.
- Bedrijfsfocus: een kleine boom met keuzes die elke paar maanden een vaste bonus geven.

### Balans (vervolg)
- Casual: razzia's (21%) te vaak voor het makkelijkste niveau; heat sneller laten zakken op Casual? Meten. (8 nov)
- Lonen en huur per tijdperk laten stijgen, zodat de late game ook druk heeft. (8 nov)
- Genadeloos: vroegste dood in maand 16; bekijken of de eerste twee jaar daar eerlijk zijn. (8 nov)

### Testinfrastructuur (doorlopend)
- Tests mogen niet op toeval falen: concept.js viel om bij een terugroepactie (twee enen). Gerepareerd; andere tests nalopen op hetzelfde. (8 nov)
- Een test voor de online modus met een nagebootste db, zodat opslaan, wisselen van spel en back-ups daar ook gecontroleerd worden. (8 nov)
- Expansie-bot in balans.js om hegemonie echt te meten.
- Een "speel 24 maanden als mens"-run met screenshots per ronde, om zelf kritisch te kijken.

## Gedaan
- 3.7 Rust en eerste stappen: kaart Eerste stappen, kleine meldingen in het maandrapport, statusbalk op de telefoon als raster, leesbare geselecteerde chips.
- 3.6 Opslag die niet stil faalt: saves 75% kleiner, luide back-upfout, maximaal 6 lokale spellen, nooit het oude spel kwijt bij een nieuw spel, foutlog onder Logboek.
- 3.5 Druk uit de wereld: heat-plafond voor legale divisies, stilstand kost klanten, toasts boven de GM-knop. Bot opent geen riskante divisies meer bij hoge heat.
- 3.4 Eerlijk einde: winstdrempel per speellengte, haalbare hegemonie en Marktmeester, score met wortel van de waarde, verlies nooit boven overleven.
- 3.3.1 Na de playtest: abonnees, overname koppelen, startideeën, GM-venster op elk scherm.
- 3.3 De GM ontwerpt divisies en schrijft verhaalbogen.
