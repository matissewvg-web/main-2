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
| 4.3 | Echte afzet en prijs | 3 | klaar (4.3, 4.3.2, 4.3.3); volgende ronde is een opruimronde |
| 4.3.4 | Opruimronde | 1 | klaar |
| 4.4 | Geavanceerd productontwerp | 3 | stap 1-2 klaar (nadruk, rivalen, onderdelen), opruimronde 4.4.2 klaar; volgende: stap 3 varianten/prototype/opvolgers (4.4.3) |
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
- Stap 2 (klaar in 4.3.2): prijsschuif 60-180% met prijsgevoeligheid per markt, vaste kostprijs per stuk, beste-prijsknop, woekerprijs kost reputatie.
- Stap 3 (klaar in 4.3.3): drie klantsegmenten per soort met marktdeel, prijsgevoeligheid en voorkeurseigenschap; producten 38% van de omzet (was 32%), productie 45%, lagere stukprijzen voor realistische aantallen. Balans 41% → 43%.

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
- (8 nov, kritische blik) **Bedragen per product zijn nog te klein om echt te voelen**: een logistiek product in het eerste jaar verkoopt ±18 zendingen voor €0,9k per maand. Dat is precies de klacht uit de playtest ("geen realistische bedragen"). In stap 3 de aantallen opschalen (honderden tot duizenden per maand, lagere prijs per stuk waar dat past) zonder de economie te verschuiven.
- (8 nov) Grootste verliesoorzaak van de verstandige bot op Realistisch is razzia/vervolging (37%), niet faillissement (3%). Heat is voor een voorzichtige speler misschien te streng, of de bot negeert heat te veel: nagaan met een speler, niet alleen met de bot.
- (8 nov, laat) Segmenten tellen al voor afzet en prijs, maar rivalen hebben nog geen eigen segmentkeuze en de bot kijkt er niet naar. 4.4 (eigenschappen per segment, varianten) bouwt hierop: dan pas wordt "voor wie maak je dit?" een echte keuze.
- (8 nov, laat) Productomzet blijft klein naast de basisomzet van een divisie (een product €1-3k tegen een divisie €8-15k). De omzet volledig naar producten verschuiven raakt de start (die draait zonder producten) en vraagt een eigen ronde met metingen.
- (9 nov) Les uit de opruimronde: één verborgen willekeurige straf (laster) was goed voor 10 procentpunt winkans. Andere willekeurige straffen zonder tegenzet nalopen met hetzelfde spoor (repdiag): keuzes rond producten (−2,7 in 2 jaar), verhaallijnen (−3), chaos (−2,5).
- (9 nov, 4.4.2) Kritische blik: het Wat nu?-blok noemt elke maand dezelfde crewklus en dezelfde uitbreiding; na een paar maanden lees je er overheen. Adviezen die al drie maanden onveranderd staan, inklappen of rouleren.
- (9 nov, 4.4.2) Toasts (meldingen rechtsonder) liggen bij elke actie over de inhoud, ook over Wat nu?. Kleiner maken of bovenaan zetten op brede schermen.
- (opgelost in 4.4.2) Het productblad is op 390 px ±1600 px lang geworden (eigenschappen, economie, prijs, klanten, onderdelen, markt, productie, omzet). Opdelen in tabbladen: Overzicht · Prijs en klanten · Onderdelen.
- (opgelost in 4.4.2) Onderdelen kiezen gebeurt nu pas op het productblad, na de start van de ontwikkeling. Een snelle keuze in het ontwikkelformulier (alles goedkoop, standaard, premium) zou het ontwerp in één stap maken.
- (opgelost in 4.4.2) Het ontwikkelformulier heeft nu Focus én Nadruk; focus "veilig" en nadruk "Veiligheid" lijken op elkaar maar doen iets anders (aanpak van de ontwikkeling tegenover een eigenschap). In de volgende opruimronde Focus hernoemen naar Aanpak.
- (9 nov, 4.4) Nadruk is netto +1 eigenschapspunt: bewust een kleine beloning voor een keuze, maar zo blijft elke nadruk beter dan evenwichtig. Bij de varianten (4.4.2) nagaan of evenwichtig een eigen voordeel moet krijgen.
- (9 nov) Mensrun: een Cyberware-start verdient na twee jaar ±€5k per maand, uitbreiden naar L3 is pas in 21 maanden terugverdiend. De eerste jaren hebben weinig spannende keuzes; nagaan na een echte speelronde.

## Gedaan
- 4.4.2 Opruimronde (9 nov, nacht): productblad in tabbladen (S.prodTab per product), onderdelen-snelkeuze bij ontwikkelen, Focus → Aanpak, nieuwCard max 4 versies, 4.3-tekst gecorrigeerd (40%). Mensrun: reputatie 29 → 21 in 2 jaar (was 30 → 11), cash 101 → 300.
- 4.4.1 Onderdelen en leveranciers (9 nov, nacht): ONDERDELEN per soort met gekoppelde eigenschap en leverancierssectoren, goedkoop/standaard/premium, kostFactor in kostprijs en productiekosten, leverancier uit s.bedrijven met vervanging bij faillissement (ook in maandrapport). Vier vaste tests. Balans 46%.
- 4.4 stap 1 (9 nov, nacht): nadruk in het ontwerp (+2/−1) met uitleg wie meer of minder koopt, segmenten vergelijken met het gemiddelde van rivaalproducten (×0,85 tot ×1,15). Vier vaste tests. Balans 47%.
- 4.3.4 Opruimronde (9 nov, nacht): mensrun van 24 maanden liet reputatie zakken van 30 naar 11 zonder lek; oorzaak met een spoor op elke wijziging: willekeurige laster van alle rivalen (−12 in 2 jaar). Laster nu alleen van de concurrent in je sector of in oorlog, eerlijk advies, winstdrempel ×1,38 (€11.000k) om de balans terug te zetten (55% → 45%). Productuitleg ingeklapt, marktaandeel zonder tilde, plannen.js deterministisch (oorzaak: dubbel 1 is altijd een blunder).
- 4.3.3 Klanten en echte aantallen (8 nov, laat): segmenten per soort, Details → Klanten (op 390 px als lijst, een tabel paste niet), productomzet ×1,31 met productie 45%, stukprijzen omlaag. balans.js meet nu het productaandeel. Twee vaste tests voor segmenten.
- 4.3.2 Zelf je prijs bepalen (8 nov, avond): prijsschuif met live voorbeeld in het productblad, prijsgevoeligheid per markt en kwaliteit, kostprijs per stuk vast, uitverkocht = gratis prijsruimte, abonnementen via instroom en opzeggers. Productgebeurtenissen die naar premium zetten werden eerst een val (bot 44% → 34%); gevoeligheid verzacht, daarna 42%. Zes vaste tests in playtest.js, schermtest met schuif.
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
