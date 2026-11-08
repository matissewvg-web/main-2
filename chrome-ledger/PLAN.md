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
3. **Balans:** op doel sinds 4.1 (Casual 86%, Realistisch 34%, Genadeloos 11%), maar abonnementen, dochters en de GM zijn niet op balans getest.
4. **Nog niemand heeft het echt gespeeld sinds de ochtend.** Bots zijn geen spelers.

## Roadmap

Werkwijze: elk uur een ronde (automatisch). Grote punten zijn verdeeld in stappen van één ronde. Elke derde ronde is een opruimronde (bugs, teksten, schermen, tests/mensrun.js). Feedback uit een echte speelronde gaat altijd voor.

| Versie | Wat | Rondes | Status |
|---|---|---|---|
| 4.2 | Levende bedrijvenwereld | 1 | klaar |
| 4.3 | Echte afzet en prijs | 3 | stap 1 klaar (producten eigen omzet), stap 2-3 volgende |
| 4.4 | Geavanceerd productontwerp | 3 | |
| 4.5 | Kwaliteit en aansprakelijkheid | 2 | |
| 4.6 | Marketing en distributie | 2 | |
| 4.7 | Patenten en namaak | 1 | |
| 4.8 | Productdashboard | 1 | |
| 4.9 | Toelevering en voorraad | 2 | |
| 4.10 | Regionale markten | 2 | |
| 4.11 | Realistische financiën | 2 | |
| 4.12 | Mensen per divisie | 2 | |
| 4.13 | Onderzoek | 2 | |
| 4.14 | Zelf plannen smeden | 1 | |
| 5.0 | Klanten komen naar jou (B2B-orders) | 3 | |

### 4.3 Echte afzet en prijs (volgende)
- Stap 1 (klaar in 4.3, na playtest): producten hebben een eigen omzet en 40% productiekosten bovenop de basisomzet van de divisie.
- Stap 2: prijs vrij instelbaar (schuif in euro's per stuk) met prijsgevoeligheid per markt: te duur kost afzet, te goedkoop kost marge.
- Stap 3: klantsegmenten per soort (bv. medisch: ziekenhuizen, rijke particulieren, straatklinieken) met eigen budget, omvang en voorkeur voor eigenschappen. Herbalans, gemeten met 150 spellen.

### 4.4 Geavanceerd productontwerp
- Eigenschappen tellen echt: elk segment weegt de drie eigenschappen anders; jouw score tegen concurrerende producten bepaalt je aandeel per segment.
- Onderdelenlijst: 3-4 onderdelen per product met kosten en leverancier; kostprijs = onderdelen + arbeid.
- Varianten (Basis, Pro, Elite) met eigen prijs, eigenschappen en doelgroep. Prototype en bètatest vóór de lancering. Opvolgers die klanten overnemen van de oude versie.

### 4.5 Kwaliteit en aansprakelijkheid
- Defectpercentage per product, garantiekosten, terugroepacties uit defecten in plaats van één worp. Keuring per markt (medisch, implantaten, wapens).

### 4.6 Marketing en distributie
- Marketingkanalen (reclame, influencers, beurzen, fluistercampagne) en verkoopkanalen (eigen winkels, groothandel, online, zwarte markt) met eigen bereik, marge en heat.

### 4.7 Patenten en namaak
- Patent op een eigenschap; namakers aanklagen; rivalen patenteren ook.

### 4.8 Productdashboard
- Grafieken per product over tijd (afzet, prijs, aandeel, marge, defecten), naast je sterkste concurrent.

### 4.9 Toelevering en voorraad
- Onderdelen via leveranciers (de bedrijven in de wereld, die nu ook failliet kunnen gaan of fuseren); tekorten bij oorlog of sancties; voorraad.

### 4.10 Regionale markten · 4.11 Realistische financiën · 4.12 Mensen per divisie · 4.13 Onderzoek · 4.14 Zelf plannen smeden
- Zie de beschrijvingen in eerdere versies van dit plan; ze schuiven op zonder inhoudelijke wijziging.

### 5.0 Klanten komen naar jou (B2B-orders)
- Inkoopaanvragen van bedrijven, rivalen, staten en syndicaten (aantal, eigenschappen, prijs, deadline); accepteren, onderhandelen of afwijzen; leveren uit capaciteit en voorraad; boetes bij te laat; aanbestedingen tegen rivalen; raamcontracten; riskante klanten. De GM schrijft de klant en het verhaal.

### Doorlopend
- Balans: Realistisch 27-30% winst na 4.1.2 en 4.2 (doel ±35%): opnieuw bekijken na 4.3, want echte afzet verschuift alles.
- Faillissementen van wereldbedrijven kosten de speler soms een contract; nagaan of dat te vaak gebeurt.
- Genadeloos: vroege faillissementen; opnieuw na een playtest.
- Testinfrastructuur: expansie-bot voor hegemonie; tests mogen nooit op toeval falen.

## Gedaan
- 4.3 (na playtest: "producten leveren te weinig op, te veel events en keuzes"): producten eigen omzet en kosten, minder gebeurtenissen/chaos/aanslagen/syndicaatrekeningen, kleine keuzes max 1 per 2 maanden, gewone meldingen in het rapport (2,6 → 1,6 mails/maand), eigen soort = enige startdivisie, Engelse namen herkend. Realistisch 38%.
- 4.2 Levende bedrijvenwereld: maandelijks oprichtingen (naamgenerator per sector), faillissementen na drie slechte maanden, fusies, nieuwe namen, beursgangen, schandalen, CEO-wissels; koers en geschiedenis per bedrijf; contracten verhuizen mee. Test wereld.js.
- Roadmap: 5.0 Klanten komen naar jou (B2B-orders, aanbestedingen, raamcontracten, riskante klanten) toegevoegd op verzoek (8 nov).
- Roadmap uitgebreid (8 nov, op verzoek: "diepere productdetails, advanced"): 4.2 echte afzet en prijs met segmenten, 4.3 geavanceerd productontwerp, 4.4 kwaliteit en aansprakelijkheid, 4.5 marketing en distributie, 4.6 patenten, 4.7 productdashboard, 4.8 toelevering.
- 4.1.1 Kaart Nieuw sinds je vorige bezoek. Terugkerende rondes gepauzeerd op 8 nov (20:45 UTC): de gebruiker gaat spelen. Hervatten met de feedback uit die speelronde bovenaan.
- 4.1 Balans: winstdrempel +10%, eerste strategiedag na een jaar, krappere startcapaciteit, bot breidt capaciteit uit. Realistisch 47% → 34%. Productblad op 390 px gecontroleerd, Verval pas na een jaar.
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
