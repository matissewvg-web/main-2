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

## Masterroadmap (alles: oude lijst + nieuwe wensen + eigen ideeën)

Werkwijze: elk uur een ronde, één stap per ronde, elke derde ronde een opruimronde. Feedback uit een speelronde gaat altijd voor. Doorwerken tot de weeklimiet op is, daarna verder waar het stopte. Bestaande saves blijven werken (migrate, nooit iets kwijt). Herkomst: [oud] = stond al op de roadmap, [wens] = gevraagd op 10 nov, [idee] = eigen voorstel.

| # | Versie | Wat | Herkomst | Rondes |
|---|---|---|---|---|
| 1 | 5.0 ✓ | Opruimen: woordkeuze kwaliteit/eigenschappen, zwarte markt als echt risico (razzia's, journalisten), verhaalkeuzes compacter op het overzicht, ordertest met vaste kans, varianten.js 50 keer met foutmeldingen, kleine kosten in miljoenen nalopen (omkopen, aannemen), balans terug naar ±40% met iets wat de speler zelf stuurt | [oud] | 1 |
| 2 | 5.1 ✓ | Eigen huisstijl: bedrijfskleuren, thema van het scherm, logo uit een generator (symbool + initialen) of eigen PNG (verkleind, in de save) | [wens] | 1 |
| 3 | 5.2 | Slimme automatisering: autopilot per product (prijs volgt de beste prijs, capaciteit volgt de vraag binnen een budget, keuring vanzelf) en per divisie (automatisch ontwikkelen als er plek is) | [wens] | 2 |
| 4 | 5.3 | Echte-wereldtijdlijn: trends per jaar die vraag en kansen verschuiven (smartphones 2007, crisis 2008, crypto 2009/2017, drones en dronegevechten 2015-2020, pandemie 2020, AI-golf 2023, commerciële ruimtevaart, daarna cyberpunk: implantaten, privélegers, AI-wetten) | [wens] | 2 |
| 5 | 5.4 | Corpospanning per regio (zoals world tension in HOI4): elke regio 0-100, stijgt met de tijd, oorlogen, wapenverkoop en corpomacht; drempels openen sancties, embargo's, privélegers en corporate zones | [wens] | 2 |
| 6 | 5.5 | Straatoorlog en corpomacht: bij hoge spanning eigen beveiliging op straat, gebieden bevechten, corpowetten kopen; meer macht = meer mogen | [wens] | 2 |
| 7 | 5.6 | Gebied als dominantie: invloedsaandelen per district (speler, rivalen, bendes, staat) zoals op zee; inkomsten, heat en hegemonie volgen je aandeel | [wens] | 3 |
| 8 | 5.7 | Elk spel een nieuwe wereld: rivalen en wereldbedrijven gegenereerd (namen, sectoren, CEO's met karakter, startposities), met een zaad om een wereld te delen | [wens] | 1 |
| 9 | 5.8 | Mensen doen echt werk (neemt 4.12 Mensen per divisie mee): directie en personeel als assistenten met taken (CFO betaalt facturen en bewaakt het budget, verkoopchef zet prijzen, R&D stelt producten voor, HR werft), met talent, loon en loyaliteit; taken delegeren of zelf doen; een hoofd per divisie | [wens]+[oud] | 2 |
| 10 | 5.9 | Klanten komen naar jou (was 5.0): inkoopaanvragen van staten, legers, bedrijven en syndicaten; aanbestedingen tegen rivalen; raamcontracten; riskante klanten | [oud] | 3 |
| 11 | 5.10 | Export en vergunningen: wapens en implantaten per regio een exportvergunning, embargo's uit de corpospanning, smokkel als uitweg | [idee] | 1 |
| 12 | 5.11 | Regionale markten (was 4.10): vraag, prijzen, keuring en concurrenten per continent; je kiest waar je verkoopt | [oud] | 2 |
| 13 | 5.12 | Toelevering en voorraad (was 4.9): grondstoffen per regio, tekorten bij oorlog en sancties, voorraad aanleggen, leveranciers als je niet alles zelf maakt | [oud] | 2 |
| 14 | 5.13 | Patenten en namaak (was 4.7): patent op een eigenschap, namakers aanklagen, rivalen patenteren ook | [oud] | 1 |
| 15 | 5.14 | Onderzoek (was 4.13): technologieboom per soort (betere onderdelen, nieuwe productlijnen zoals mechs, nieuwe markten), rivalen onderzoeken mee | [oud] | 2 |
| 16 | 5.15 | Realistische financiën en de beurs (was 4.11 + idee): balans, kasstroom, afschrijving, leningen met looptijd; zelf naar de beurs, aandelen uitgeven of terugkopen, aandeelhoudersvergaderingen (iets wat je zelf stuurt, in plaats van het geschrapte overnamebod) | [oud]+[idee] | 2 |
| 17 | 5.16 | Productdashboard en statistieken (was 4.8): grafieken per product en per divisie over tijd, naast je sterkste concurrent; jaaroverzicht | [oud] | 1 |
| 18 | 5.17 | Zelf plannen smeden (was 4.14): zelf een plan tegen een rival of bende opzetten over maanden, met stappen, kansen en tegenzetten | [oud] | 1 |
| 19 | 5.18 | Krant van de maand: één pagina met de wereldtrends, jouw nieuws, rivalen en de corpospanning, in de stijl van de stad | [idee] | 1 |
| 20 | 5.19 | De CEO als persoon: leeftijd, gezondheid, reputatie, privéleven, opvolging (een dynastie of een coup), en rivaliserende CEO's met een eigen relatie tot jou | [idee] | 2 |
| 21 | 5.20 | Eigen moeilijkheid: schuiven voor gebeurtenissen, chaos, corpospanning en winstdrempel, zodat jij bepaalt hoe hard het spel is | [idee] | 1 |
| 22 | 5.21 | Uitleg en begin: een korte rondleiding van 5 stappen bij een nieuw spel, en een spiekbriefje per scherm | [idee] | 1 |

Totaal ±40 rondes (plus de opruimrondes daartussen, ±13). Met de weeklimiet van de gebruiker is dat enkele weken werk. De volgorde zet eerst wat je meteen merkt (opruimen, huisstijl, automatisering), dan de grote wereldsystemen (tijdlijn, spanning, straat, dominantie), dan de diepte (mensen, B2B, markten, toelevering) en tot slot de afwerking.

Grootste risico's: 5.6 (dominantie) raakt kaart, oorlog en hegemonie tegelijk; 5.11 (regionale markten) raakt de hele producteconomie. Beide met extra tests en direct een opruimronde erna.

### Doorlopend (elke ronde in het achterhoofd)
- Balans: verstandige bot op Realistisch ±40%; nu ±58%, te makkelijk na de kostenverlagingen.
- Reputatie zakt in lange spellen snel (wapenbedrijf 28 → 3 in 2 jaar): oorzaken nalopen met repdiag.
- Het begin is traag (±€5M winst per maand de eerste jaren).
- Tests mogen nooit op toeval falen.

## Roadmap (4.x, deels afgerond)

Werkwijze: elk uur een ronde (automatisch). Grote punten zijn verdeeld in stappen van één ronde. Elke derde ronde is een opruimronde (bugs, teksten, schermen, tests/mensrun.js). Feedback uit een echte speelronde gaat altijd voor.

| Versie | Wat | Rondes | Status |
|---|---|---|---|
| 4.2 | Levende bedrijvenwereld | 1 | klaar |
| 4.3 | Echte afzet en prijs | 3 | klaar (4.3, 4.3.2, 4.3.3); volgende ronde is een opruimronde |
| 4.3.4 | Opruimronde | 1 | klaar |
| 4.4 | Geavanceerd productontwerp | 3 | klaar (4.4 nadruk en rivalen, 4.4.1 onderdelen, 4.4.2 opruimen, 4.4.3 varianten en bètatest) |
| 4.5 | Kwaliteit en aansprakelijkheid | 2 | klaar (4.5 defecten, 4.5.1 keuring, 4.5.2 opruimen) |
| 4.6 | Marketing en distributie | 2 | klaar (4.6 verkoopkanalen, 4.6.1 marketingkanalen); volgende: opruimronde 4.6.2 |
| 4.7 | Patenten en namaak | 1 | na 4.6.2 |
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
- (9 nov, 4.4.3) Varianten en het origineel zitten elkaar nu alleen bij de lancering in de weg (−12%). Daarna verkopen ze los van elkaar; echte kannibalisatie (zelfde segment, zelfde klanten) hoort bij 4.10 regionale markten of een aparte ronde.
- (9 nov, 4.5.1) Keuring is nu één keer voor de hele wereld. "Per markt" (per land of continent een eigen keuring, strenger in de EU, laks in vrijhavens) hoort bij 4.10 regionale markten.
- (9 nov, 4.5.1) De bot keurt altijd; een speler die het vergeet verliest 40% afzet op die producten. Na een echte speelronde nagaan of het advies in Wat nu? genoeg opvalt.
- (9 nov, 4.5) Garantie is nu een klein bedrag (1-4% van de productomzet, vaak tientallen euro's per maand). Merkbaar wordt het pas bij goedkope onderdelen en lage kwaliteit. Na een speelronde nagaan of defecten vaker in het nieuws of in mails moeten opduiken.
- (opgelost in 4.5) Bij 4.5 de onderdelen laten meetellen: goedkope onderdelen geven meer defecten en terugroepacties, premium minder. Dan krijgt goedkoop een echte prijs naast −1 eigenschap.
- (9 nov, 4.7) Kleine bedragen in miljoenen (agent omkopen €1-5M, personeel aannemen €0,4M p.p.) zijn wat groot; na een speelronde kijken of die schaal klopt of dat lonen en kleine kosten apart omlaag moeten.
- (9 nov, 4.7) Orders: nog geen test met vaste kansRol; toevoegen in de volgende ronde. Ook: de bot maakt geen vlaggenschepen, dus orders zijn niet in de balans gemeten.
- (9 nov, 4.6.1) "Zakelijk" bleek niet te kloppen als doel van een beurs: bij medische producten is het minst prijsgevoelige segment rijke particulieren. Doel heet nu koopkrachtig. Segmentnamen en -gedrag nog eens nalopen per soort (zijn de em-waarden logisch?).
- (9 nov, 4.6) varianten.js gaf één keer 8 van de 11 controles (test halverwege gestopt, foutmelding niet bewaard); 26 runs daarna allemaal goed. Mogelijk een zeldzame uitzondering in de tick bij vaste dobbelstenen. Bij de volgende opruimronde 50 runs met stderr bewaren.
- (9 nov, 4.6) Het kwaliteitsblok zegt "lage kwaliteit" terwijl de eigenschappen 5/4/3 tonen: kwaliteit (1-5) en eigenschappen (1-10) lopen uiteen door nadruk en onderdelen. Woordkeuze aanpassen ("basiskwaliteit 2").
- (9 nov, 4.6) De zwarte markt is voor een medisch product nu een snelle uitweg uit de keuring (80% afzet, geen €4k). Later laten meewegen in razzia's of journalisten, zodat het een echt risico is en niet alleen heat.
- (9 nov, 4.5.2) Verhaalkeuzes (Mara Vonk, salarisgesprek) staan op het overzicht direct onder Wat nu? met grote kaarten; met drie tegelijk duwt dat de rest ver naar beneden. Compacter tonen of in Inbox houden met één regel op het overzicht.
- (opgelost in 4.5.2) Kritische blik: het Wat nu?-blok noemt elke maand dezelfde crewklus en dezelfde uitbreiding; na een paar maanden lees je er overheen. Adviezen die al drie maanden onveranderd staan, inklappen of rouleren.
- (opgelost in 4.5.2) Toasts (meldingen rechtsonder) liggen bij elke actie over de inhoud, ook over Wat nu?. Kleiner maken of bovenaan zetten op brede schermen.
- (opgelost in 4.4.2) Het productblad is op 390 px ±1600 px lang geworden (eigenschappen, economie, prijs, klanten, onderdelen, markt, productie, omzet). Opdelen in tabbladen: Overzicht · Prijs en klanten · Onderdelen.
- (opgelost in 4.4.2) Onderdelen kiezen gebeurt nu pas op het productblad, na de start van de ontwikkeling. Een snelle keuze in het ontwikkelformulier (alles goedkoop, standaard, premium) zou het ontwerp in één stap maken.
- (opgelost in 4.4.2) Het ontwikkelformulier heeft nu Focus én Nadruk; focus "veilig" en nadruk "Veiligheid" lijken op elkaar maar doen iets anders (aanpak van de ontwikkeling tegenover een eigenschap). In de volgende opruimronde Focus hernoemen naar Aanpak.
- (9 nov, 4.4) Nadruk is netto +1 eigenschapspunt: bewust een kleine beloning voor een keuze, maar zo blijft elke nadruk beter dan evenwichtig. Bij de varianten (4.4.2) nagaan of evenwichtig een eigen voordeel moet krijgen.
- (9 nov) Mensrun: een Cyberware-start verdient na twee jaar ±€5k per maand, uitbreiden naar L3 is pas in 21 maanden terugverdiend. De eerste jaren hebben weinig spannende keuzes; nagaan na een echte speelronde.

## Gedaan
- 5.1 Huisstijl (11 nov, nacht): THEMAS (neon, corporate, terminal, bloed, chroom), hoofd- en accentkleur via CSS-variabelen, logo-generator (vorm, symbool, initialen als SVG) of eigen afbeelding (canvas 96×96, data-URL ≤90 kB, alleen png/jpeg/webp), logo in de kopregel, kaart bovenaan Bedrijf. Test in varianten.js. Nieuwe spellen krijgen de herstel-vlaggen van 4.7.x meteen (geen per ongeluk teruggezette wapendivisie).
- 5.0 Opruimen (11 nov, 03:00): zwarte markt 4%/mnd/product journalist (rep −3, heat +3), overzicht max 2 besluiten + ingeklapt, basiskwaliteit-woordkeuze, winstdrempel ×1,55 (€12.400M; ×1,7 gaf 51%, nauwelijks verschil: verlies komt van razzia's), ordertest met vaste kansRol. Balans 52%.
- 4.7.1-4.7.3 (9 nov, op verzoek na spelen): keuring permanent per editie (variant en nieuwe versie opnieuw keuren), oude saves eenmalig alles gekeurd. Kosten: cashdiag liet zien dat facturen/gebeurtenissen/chaos/bendes ±46% van de inkomsten opaten (€87M van €187M in 2 jaar); facturen ×0,58 en minder vaak, negatieve gebeurtenissen en chaos ×0,7, kas-percentage hoogstens over 3 maanden omzet, Facturen betaald en Netto na facturen in het rapport. Chaos groeit mee (8% → 25% kans, halve → volle schade over 10 jaar). Oude saves eenmalig +€100M. Balans verstandig Realistisch 58% (te makkelijk volgens het doel van ±35-40%, bewust zo gelaten na de klacht; later bijsturen met iets wat de speler wel kan beïnvloeden).
- 4.7 Miljoenen en echte productlijnen (9 nov, op verzoek): k€ → M€ overal (regex over 413 bedragen, stukprijzen in echte euro's apart gehouden), STUK_SCHAAL per soort en schaal, orders voor vlaggenschepen (orderOmzet, ORDER_KANS 0,3, kansRol), komma-pass na render. Balans 43%. Rondes gepauzeerd tot woensdag 11 nov (weeklimiet gebruiker).
- 4.6.1 Marketingkanalen (9 nov, ochtend): MARKETING reclame/influencers/beurs/fluister, p.mkt {seg, f, maanden} telt in segmenten(), mktTick, mktSegIndex (gevoelig = hoogste em, koopkrachtig = laagste em). Blok Marketing in Prijs en klanten. .prijzen breekt nu af (flex-wrap). Drie tests in varianten.js.
- 4.6 Verkoopkanalen (9 nov, ochtend): KANAAL groothandel/eigen/online/zwart met vol, marge, vast, heat en zwart deel; kanaalF in prodGewicht, marge in prodKost, zwarte markt negeert keuring; zwart geld en vaste kosten in de tick met eigen rapportregel. Tabblad Verkoop en keuring. Tests in varianten.js (vaste dobbelstenen, controle op de rapportregel).
- 4.5.2 Opruimronde (9 nov, ochtend): adviesTick telt per advies (sleutel zonder getallen) hoeveel maanden het staat; ≥3 en prio < 9 zakt naar Staat al een tijdje. Toasts rechtsboven ≥900 px, 3,5 s, klik sluit. Mensrun 24 maanden: reputatie 29, cash €294k, geen fouten. adviezen per maand maakt de balanstest ±30% trager (40 spellen: 18 → 25 s), acceptabel.
- 4.5.1 Keuring (9 nov, ochtend): KEURING_AARD (medisch, implantaat, wapen), keurF 0,6 in prodGewicht, keuringTick met worp (doel 6 ± defecten/kwaliteit), omkopen, variant erft goedkeuring, oude producten gelden als gekeurd. Advies in Wat nu?, badge op de productlijn. Bot keurt officieel. Balans 46%.
- 4.5 Defecten en garantie (9 nov, ochtend): DEFECT_BASIS per soort, defectPct, garantie in prodKost, defectTick (kansRol voor deterministische tests) met terugroepkeuze boven 5%, max 1×/jaar. Kwaliteitsblok op het productblad. Balans 47%. varianten.js deterministisch gemaakt (vergelijkt met de waarde op het moment van lancering).
- 4.4.3 Varianten en bètatest (9 nov, vroeg): VARIANT basis/pro/elite (prijs, onderdelen, kwaliteit), variant leent 60% populariteit en origineel −12%, bètatest in devPlan/lanceerWorp/wachtrij. Eerste versie gaf een variant een volledige lanceringsworp voor half geld (populariteit 55-72): uit te buiten, aangepast naar lenen. tests/varianten.js.
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
