# Chrome Ledger: werkplan

Dit plan wordt elke ronde bijgewerkt: wat af is gaat naar "Gedaan", nieuwe punten uit eigen kritiek komen onderaan "Open" met een datum.

## Spelregels voor mezelf
- **Eerst repareren en verduidelijken, dan pas uitbreiden.** Per ronde hoogstens één nieuw systeem. Elke derde ronde is een opruimronde: bugs, teksten, schermen.
- **Meten, niet gokken.** Elke balanswijziging wordt gemeten met `tests/balans.js` (150 spellen) vóór en na. Cijfers in de README zijn echte metingen, met de steekproefgrootte erbij.
- **Eerlijk over de grenzen.** De testbots zijn geen spelers: ze negeren heat, breiden niet uit naar andere continenten en gebruiken de GM niet. Een goed bot-cijfer betekent niet dat het spel leuk is. De GM-functies zijn alleen met een nagebootste GM getest; echte speelervaring van de gebruiker weegt zwaarder dan elke meting.
- **Niet doen:** engine.js opsplitsen in modules, tests in het artifact stoppen, nieuwe systemen bouwen terwijl een bestaand systeem onduidelijk is.

## Waar het spel nu staat (3.10)
Sterk: veel systemen, een echt einde met eerlijke score, de GM als ontwerper en verteller, saveslots, tests (ook online opslag).
Zwak:
1. **Producten zijn nog abstract.** Een product is kwaliteit × populariteit × een vermenigvuldiger op de divisie-omzet. Je ziet geen prijs per stuk, afzet, marge, marktaandeel of capaciteit. De gebruiker wil het "realistischer en gedetailleerder".
2. **De economie is een model op divisieniveau**, niet op productniveau: omzet komt van de divisie, producten tillen die op. Echte afzet × prijs vraagt een herbalans.
3. **Balans:** Realistisch 43% winst (doel ±35%) sinds de koersen; Genadeloos vroege faillissementen; abonnementen, dochters en de GM niet op balans getest.
4. **Nog niemand heeft het echt gespeeld sinds de ochtend.** Bots zijn geen spelers.

## Roadmap (in volgorde)
### 4.1 Balans na 4.0 (volgende)
- Realistisch staat op 46% (doel ±35%): koersen zwakker of later, capaciteit krapper bij de start? Meten met 150 spellen.
- Een bot die abonnementen en capaciteit gebruikt; Genadeloos opnieuw meten.
- Productblad op de telefoon controleren (smalle kolommen).

### 4.2 Echte afzet
- Omzet van een product = afzet × prijs, kosten = afzet × kostprijs + vaste kosten. Prijs vrij instelbaar met prijsgevoeligheid per markt. De divisie levert basisomzet, producten de rest. Grote herbalans, gemeten.

### 4.3 Toelevering en voorraad
- Onderdelen en grondstoffen per soort via leveranciers (de bedrijven in de wereld). Tekorten bij oorlog, sancties of een failliete leverancier. Voorraad aanleggen of uitverkocht raken.

### 4.4 Regionale markten
- Producten verkopen per continent met eigen vraag; importheffingen en sancties uit wereldgebeurtenissen; een nieuwe markt openen kost vergunning en marketing.

### 4.5 Realistische financiën
- Balans (bezittingen en schulden), afschrijving op investeringen, kasstroomoverzicht, een kredietrating die je rente bepaalt, aandeelhouders die dividend verwachten.

### 4.6 Mensen per divisie
- Een hoofd per divisie met eigen eigenschappen, teams en salarisschalen per land, cao's.

### 4.7 Onderzoek
- Technologie per sector die eigenschappen van producten verbetert en nieuwe soorten producten vrijspeelt.

### 4.8 Zelf plannen smeden
- Het spiegelbeeld van Plannen tegen jou: over maanden een prijsoorlog, laster of overname tegen een rivaal opbouwen.

### Doorlopend
- Elke derde ronde een opruimronde met tests/mensrun.js en screenshots.
- Genadeloos: 8% failliet vóór maand 30; opnieuw na een playtest.
- Testinfrastructuur: expansie-bot voor hegemonie; tests mogen nooit op toeval falen.

## Gedaan
- 4.0 Echte producten: productblad (eigenschappen, prijs/kostprijs/marge, afzet, levensfase, marktaandeel, 12 maanden omzet), capaciteit als echte grens met uitbreiden, abonnees als echte aantallen. Uitroepen in Wat nu? bij uitverkocht.
- 3.10 Koers (strategiedag eens per jaar, 7 vaste koersen) en aanloop (geen vertrek in 6 maanden, geen verraad in 12). verhaal.js valt niet meer om op projectvertraging.
- 3.9.2 Na een mensrun: advies bij zakkende reputatie (lek), bij negatieve cash (hoeveel maanden, waar snel geld), oude mail naar archief, geen absurde speelruimte-melding meer. tests/mensrun.js toegevoegd.
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
