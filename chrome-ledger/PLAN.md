# Chrome Ledger: werkplan

Dit plan wordt elke ronde bijgewerkt: wat af is gaat naar "Gedaan", nieuwe punten uit eigen kritiek komen onderaan "Open" met een datum.

## Spelregels voor mezelf
- **Eerst repareren en verduidelijken, dan pas uitbreiden.** Per ronde hoogstens één nieuw systeem. Elke derde ronde is een opruimronde: bugs, teksten, schermen.
- **Meten, niet gokken.** Elke balanswijziging wordt gemeten met `tests/balans.js` (150 spellen) vóór en na. Cijfers in de README zijn echte metingen, met de steekproefgrootte erbij.
- **Eerlijk over de grenzen.** De testbots zijn geen spelers: ze negeren heat, breiden niet uit naar andere continenten en gebruiken de GM niet. Een goed bot-cijfer betekent niet dat het spel leuk is. De GM-functies zijn alleen met een nagebootste GM getest; echte speelervaring van de gebruiker weegt zwaarder dan elke meting.
- **Niet doen:** engine.js opsplitsen in modules, tests in het artifact stoppen, nieuwe systemen bouwen terwijl een bestaand systeem onduidelijk is.

## Waar het spel nu staat (3.8)
Sterk: veel systemen, een echt einde met eerlijke score, de GM als ontwerper en verteller, saveslots, tests.
Zwak:
1. **Balans is beter maar nog grof.** Moeilijkheid is nog vooral een kostenfactor. Op Casual eindigt nog 21% van de verstandige spellen in een razzia, wat te streng is voor Casual.
2. **Nog veel tegelijk voor een nieuwe speler.** Twaalf tabs en veel knoppen; Eerste stappen en een rustigere inbox helpen, maar of het genoeg is weet ik pas na een playtest.
3. **Online opslag is getest met een nagebootste database**, niet met de echte. Kleine verschillen in hoe de echte db werkt, merk ik pas als jij speelt.
5. **Plannen tegen jou zijn nog sjablonen.** Vijf vaste soorten; de GM kleurt de tekst, maar bedenkt nog geen eigen soort plan. Pas na een playtest weten we of ze vaak genoeg of te vaak komen (nu ±1 per 14 maanden zodra iemand vijandig is).

## Open (in volgorde)
### 3.9 Diepgang waar het al leeft
- Bedrijfsfocus: een kleine boom met keuzes die elke paar maanden een vaste bonus geven.

### Balans (vervolg)
- Genadeloos: vroegste dood in maand 16; bekijken of de eerste twee jaar daar eerlijk zijn. (8 nov)

### Kleine punten
- Plannen: jij kunt nog geen eigen plan tegen een rivaal opzetten (spiegelbeeld). Mogelijk 4.x. (8 nov)

### Testinfrastructuur (doorlopend)
- De testbot gebruikt geen abonnementen, dochters of de GM: die onderdelen zijn alleen functioneel getest, niet op balans. Een bot-variant die abonnementen kiest. (8 nov)
- Tests mogen niet op toeval falen: concept.js viel om bij een terugroepactie (twee enen). Gerepareerd; andere tests nalopen op hetzelfde. (8 nov)
- Expansie-bot in balans.js om hegemonie echt te meten.
- Een "speel 24 maanden als mens"-run met screenshots per ronde, om zelf kritisch te kijken.

## Gedaan
- 3.9.1 Online-test met nagebootste db (alles groen), lonen +6% per tijdperk.
- 3.9 Abonnementen (loyaliteit, prijsverhoging, weglokken) en een overzicht van je dochters met opnemen of verkopen.
- 3.8.1 Opruimen: automatisch archiveren van oude rapporten en afgehandelde keuzes, GM-venster duwt de inhoud opzij, Casual minder heat (razzia 22% → 13%, winst 87%: aan de makkelijke kant, bewust).
- 3.8 Plannen tegen jou: vijf soorten plannen van rivalen en syndicaten over zes maanden, ontdekken via crew en netwerk, verstoren/voorbereiden/laten, GM-tekst, kaart bij Rivalen, test plannen.js.
- 3.7.1 De GM antwoordt altijd: snelknoppen met eigen antwoord zonder live GM, kaartnamen zonder overlap, kaart met het toetsenbord, geen dubbel advies.
- 3.7 Rust en eerste stappen: kaart Eerste stappen, kleine meldingen in het maandrapport, statusbalk op de telefoon als raster, leesbare geselecteerde chips.
- 3.6 Opslag die niet stil faalt: saves 75% kleiner, luide back-upfout, maximaal 6 lokale spellen, nooit het oude spel kwijt bij een nieuw spel, foutlog onder Logboek.
- 3.5 Druk uit de wereld: heat-plafond voor legale divisies, stilstand kost klanten, toasts boven de GM-knop. Bot opent geen riskante divisies meer bij hoge heat.
- 3.4 Eerlijk einde: winstdrempel per speellengte, haalbare hegemonie en Marktmeester, score met wortel van de waarde, verlies nooit boven overleven.
- 3.3.1 Na de playtest: abonnees, overname koppelen, startideeën, GM-venster op elk scherm.
- 3.3 De GM ontwerpt divisies en schrijft verhaalbogen.
