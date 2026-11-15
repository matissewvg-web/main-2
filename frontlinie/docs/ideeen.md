# WO2 Campagnemap & Scenario Generator – Ideeën

Datum: 2026-11-15
Doel: ideeën en specificatie voor Claude Code. Nog niets gebouwd.

---

## 1. Concept

Een digitale campagnelaag boven Flames of War of Battlegroup. Op een strategische kaart kiest elk land per beurt wat het wil veroveren. Elk gevecht krijgt automatisch een scenario, een objective en een tafelmap, gebaseerd op het gebied waar het plaatsvindt. Het gevecht zelf speel je fysiek op tafel.

Kernloop per beurt:

1. Strategische fase: elk land kiest welke aangrenzende regio's het aanvalt.
2. Conflicten bepalen: welke aanvallen leiden tot een gevecht, en wie is aanvaller of verdediger.
3. Genereren: scenario, objective en tafelmap op basis van de doelregio.
4. Gevecht: op tafel uitspelen met FoW of Battlegroup.
5. Uitslag invoeren: de regio wisselt van eigenaar en de gevolgen worden toegepast.
6. Volgende beurt.

Uitgangspunten:
- Gevechten zijn altijd even: beide kanten spelen met dezelfde punten. Voordelen komen uit het scenario en de doctrine, niet uit extra punten.
- De app werkt met beide systemen: per systeem een ruleset-profiel (FoW of Battlegroup).

---

## 2. Startperiode: early, mid of late war

Bij het aanmaken van een campagne kies je de periode. Die bepaalt:
- de startkaart en de frontlijnen
- welke landen meedoen en wie bondgenoot is
- welke theaters actief zijn
- welke doctrines beschikbaar zijn
- welke eenheden en legerlijsten toegelaten zijn (sluit aan bij de FoW-periodes Early, Mid en Late War)
- het eindpunt van de campagne

| Periode | Jaren | Typische theaters | Sfeer |
|---|---|---|---|
| Early war | 1939–1941 | Polen, Frankrijk, Noord-Afrika (begin), Griekenland, Barbarossa | Duitse opmars, lichte tanks, verdedigers zijn slecht voorbereid |
| Mid war | 1942–1943 | Stalingrad, El Alamein, Tunesië, Koersk, Sicilië en Italië | Evenwicht, keerpunt, zware tanks komen op |
| Late war | 1944–1945 | Normandië, Bagration, Italië, Market Garden, Ardennen, Berlijn | Geallieerde overmacht, Duitse verdediging, elite zware tanks |

Instellingen:
- Vaste periode: de hele campagne blijft in één periode.
- Doorlopend: de campagne start in de gekozen periode en schuift na X beurten op naar de volgende (early → mid → late). Doctrines en eenheden schuiven mee.
- Seizoenen tellen door: 1 beurt = 1 maand of 1 seizoen.

---

## 3. Campagnescenario's (startopstellingen)

Kant-en-klare starts per periode, plus een sandbox-optie. Elk campagnescenario heeft een startkaart, facties, doelen en een maximum aantal beurten.

### Early war
- Fall Weiss (Polen 1939): Duitsland vs Polen, kort en snel, Duitsland moet Warschau nemen voor beurt X.
- Fall Gelb (Frankrijk 1940): Duitsland vs Frankrijk, VK, België en Nederland. Doorbraak via de Ardennen, de geallieerden moeten de kust of Parijs houden.
- Operatie Compass (Noord-Afrika 1940–41): VK vs Italië, woestijn, lange bevoorradingslijnen.
- Barbarossa (1941): Duitsland vs USSR, groot front, winter vanaf beurt X geeft de USSR voordelen.

### Mid war
- Fall Blau en Stalingrad (1942): Duitsland vs USSR, stadsgevechten domineren, omsingeling is het doel.
- El Alamein en Tunesië (1942–43): Afrikakorps vs VK en later VS, de geallieerden landen achter het front (Torch).
- Koersk (1943): Duitsland valt een voorbereide verdediging aan, veel versterkte regio's.
- Sicilië en Italië (1943): geallieerde landingen, bergen en verdedigingslinies.

### Late war
- Overlord (Normandië 1944): geallieerden moeten vanaf de stranden uitbreken, bocage-terrein.
- Bagration (1944): grote Sovjet-offensief, Duitsland moet de frontlijn terugtrekken zonder in te storten.
- Market Garden (1944): bruggen-campagne, elke regio met een brug is cruciaal.
- Ardennenoffensief (1944–45): Duitsland valt aan in de winter, slecht weer blokkeert luchtsteun.
- Val van het Rijk (1945): twee fronten richting Berlijn, wedloop tussen de geallieerden.

### Sandbox
- Lege of historische kaart, je kiest zelf facties, periode, doelen en bondgenootschappen.
- What-if-opties: bv. "Sealion" (invasie van Engeland) of "Duitsland en USSR blijven bondgenoot".

---

## 4. Campagnemap

De map bestaat uit regio's (provincies) met vaste buren, technisch een graaf: elke regio weet aan welke regio's ze grenst. Dat is eenvoudiger te bouwen dan een hexkaart en past beter bij "wat wil je veroveren".

- Theaters: Oostfront, West-Europa, Noord-Afrika, Italië. Later uitbreidbaar (Pacific).
- Facties: Duitsland, VS, VK, USSR, Italië, eventueel Polen, Frankrijk, Finland, Japan. Landen zonder speler zijn neutraal of een simpele AI.
- Weergave: kleur per eigenaar, frontlijnen, iconen voor steden, havens, bruggen en hoofdsteden.

Attributen per regio (die sturen later het scenario en de tafelmap):

| Attribuut | Voorbeelden | Waarvoor |
|---|---|---|
| Terreintype | steppe, bocage, woestijn, stad, bos, heuvels/bergen, rivier, strand | tafelmap en terreinset |
| Klimaat / seizoen | sneeuw, modder, zomer, droog | speciale regels, zicht, beweging |
| Infrastructuur | stad, haven, brug, spoorknooppunt, vliegveld | keuze van het objective |
| Waarde | 1 tot 5 overwinningspunten, hoofdstad krijgt een bonus | campagnewinst |
| Bevoorrading | verbonden met eigen hoofdstad of afgesneden | voor- of nadelen in het scenario |
| Versterking | geen, ingegraven, fort, linie (Atlantikwall, Gustav-linie) | verdedigingsscenario's |

---

## 5. Doctrines

Elke factie kiest een doctrine, of krijgt er een volgens de periode. Een doctrine geeft scenario-voordelen en extra strategische opties. Ze geeft nooit extra punten, want gevechten blijven altijd even.

Structuur per doctrine:
- Strategisch effect: iets op de campagnekaart (extra order, sneller bevoorraden, enz.)
- Gevechtseffect: een voordeel in het gegenereerde scenario
- Nadeel: elke doctrine heeft een zwakte, zodat de keuze een afweging is
- Beschikbaar in: early, mid en/of late

### Duitsland
| Doctrine | Strategisch | Gevecht | Nadeel | Periode |
|---|---|---|---|---|
| Blitzkrieg | na een grote overwinning mag je meteen een extra aanval doen vanuit de veroverde regio | aanvaller stelt als tweede op en speelt als eerste | gevechten in afgesneden regio's zijn zwaarder | early, mid |
| Auftragstaktik | één order per beurt mag je na het onthullen nog aanpassen | een eenheid mag een herpositionering doen voor beurt 1 | geen | alle |
| Elastische verdediging | een verloren regio kost minder: je kiest zelf waar je je terugtrekt | verdediger mag eenheden in reserve houden en later binnenbrengen | geen extra aanvallen | mid, late |
| Festung | versterkte steden kunnen niet omsingeld worden | verdediger in de stad krijgt gratis voorbereide posities | eenheden mogen zich niet terugtrekken | late |

### USSR
| Doctrine | Strategisch | Gevecht | Nadeel | Periode |
|---|---|---|---|---|
| Diepe operatie | aanvallen op twee aangrenzende regio's in dezelfde beurt geven samen een bonus | aanvaller krijgt een tweede golf als reserve | zwakke verdediging de beurt erna | mid, late |
| Massa en volharding | een verloren regio mag de volgende beurt meteen terug aangevallen worden | wie vernietigd is, mag één peloton terugbrengen | minder recon-opties | alle |
| Partizanen | bezette Sovjetregio's kunnen vijandelijke bevoorrading verstoren | raid-scenario's achter de linies | geen effect buiten de USSR | mid, late |
| Generaal Winter | in winterbeurten geen modder- of sneeuwnadelen | vijand heeft beperkte beweging in de sneeuw | geen voordeel in de zomer | alle |

### Verenigd Koninkrijk
| Doctrine | Strategisch | Gevecht | Nadeel | Periode |
|---|---|---|---|---|
| Set-piece-aanval | als je een beurt voorbereidt, wordt de aanval daarna sterker | voorbereidend artilleriebombardement | trage opmars, max. 1 aanval per beurt in gebieden waar je voorbereidt | mid, late |
| Woestijnratten | geen bevoorradingsnadeel in de woestijn | flankopstelling mogelijk | geen | early, mid |
| Commando's | raid-orders mogen ook op niet-aangrenzende kustregio's | verrassingsopstelling | kleine gevechten, weinig waarde | alle |

### Verenigde Staten
| Doctrine | Strategisch | Gevecht | Nadeel | Periode |
|---|---|---|---|---|
| Vuurkracht en logistiek | regio's zijn sneller weer bevoorraad | extra artillerie- of luchtsteunbeurt | aanvallen zijn voorspelbaar: de vijand ziet ze bij recon | mid, late |
| Luchtoverwicht | recon is gratis in regio's naast je vliegvelden | luchtsteun in elk gevecht met goed weer | niets bij slecht weer of 's nachts | late |
| Amfibische operaties | landingen op kustregio's zijn mogelijk | strandlandingscenario | zwak als het eerste gevecht verloren gaat | mid, late |

### Italië
| Doctrine | Strategisch | Gevecht | Nadeel | Periode |
|---|---|---|---|---|
| Guerra di rapido corso | mobiele aanvallen in de woestijn | snelle eenheden mogen voor beurt 1 bewegen | zwak in de verdediging | early, mid |
| Bergverdediging | bergregio's tellen als versterkt | voorbereide posities in de heuvels | geen offensief voordeel | mid, late |

### Algemeen (voor elke factie)
- Ingraven: verdedigers beginnen in dekking.
- Recon in kracht: vooraf het scenario van het volgende gevecht zien.
- Totale oorlog (late): extra order per beurt, maar de waarde van eigen regio's daalt.

Uitbreidingsidee: een kleine doctrine-boom. Je start met één basisdoctrine en speelt er elke X beurten of na grote overwinningen een extra optie bij vrij.

---

## 6. Beurtsysteem per land

Een beurt staat voor een maand of seizoen, zodat het seizoen mee verandert (zomer, herfstmodder, winter). Elk land geeft per beurt orders voor aangrenzende regio's.

Volgorde (instelling):
- Simultaan: iedereen geeft verborgen orders, die tegelijk onthuld worden. Geeft ontmoetingsgevechten en verrassing.
- Om de beurt: initiatiefvolgorde per land, gerold of op basis van bevoorrading en doctrine.

Orders:

| Order | Effect |
|---|---|
| Aanvallen | de doelregio wordt een gevecht |
| Versterken | de regio krijgt ingraven of extra reserves in het volgende scenario |
| Verdedigen | verdediger kiest eerst de tafelkant of krijgt voorbereide posities |
| Recon | toont vooraf het terrein en het objective van een regio |
| Bevoorrading | herstelt afgesneden regio's |
| Doctrine-order | speciale order volgens de doctrine (raid, landing, partizanen, ...) |

- Aantal aanvallen per beurt: hangt af van het aantal regio's, de bevoorrading en de doctrine (bv. 1 tot 3).
- Onverdedigde regio zonder vijandelijke speler: automatisch veroverd, of een klein raid-gevecht.
- Twee landen die elkaar op dezelfde grens aanvallen: één ontmoetingsgevecht in plaats van twee gevechten.
- Fog of war: je ziet versterkingen alleen in regio's waar je recon op deed.

---

## 7. Gevecht

Het gevecht vindt altijd plaats in de regio die je probeert te veroveren. Alles wat de generator nodig heeft, komt uit die regio, de orders, de doctrines en de periode.

- Rollen: aanvaller en verdediger volgen uit de orders. Bij een ontmoetingsgevecht zijn beide kanten aanvaller.
- Altijd even: beide kanten krijgen hetzelfde puntentotaal, ingesteld per campagne.
- Voordelen zonder punten: versterking, recon, bevoorrading en doctrine geven scenario-voordelen (ingraven, eerst opstellen, een reserve-eenheid uit een vaste lijst, voorbereidend bombardement, luchtsteun).
- Ruleset-profiel: per systeem de puntenschaal, de namen van missies en hoe de winnaar bepaald wordt (FoW: objectives en morale; Battlegroup: Battle Rating).
- Periode-check: de app toont welke eenheden in deze periode toegelaten zijn.
- Legerlijst per speler: optioneel een vaste lijst per land en periode.

---

## 8. Gevechtsscenario's (generator)

De generator kiest een objective dat past bij de regio en de situatie, via gewogen tabellen. Een stad maakt "Stad zuiveren" veel waarschijnlijker, een rivier "Brug innemen". Elk scenario krijgt een seed, zodat je het later precies opnieuw kunt genereren.

Inputs: terreintype, infrastructuur, orders van beide kanten, versterking, recon, bevoorrading, doctrines, periode, seizoen, vorige uitslag in die regio.

| Scenario | Wanneer waarschijnlijk | Doel |
|---|---|---|
| Doorbraak | aanval op een frontregio | aanvaller moet objectives diep in vijandelijk gebied nemen |
| Ingraven en houden | verdediger heeft versterkt | verdediger houdt de objectives tot de laatste beurt |
| Brug innemen | regio met rivier of brug | controle over de brug aan het einde |
| Brug opblazen | verdediger verliest de regio waarschijnlijk | verdediger moet de genie bij de brug krijgen |
| Stad zuiveren | stedelijke regio | de meeste sectoren of gebouwen bezetten |
| Ontmoetingsgevecht | beide landen vallen elkaar aan | centrale objectives, gelijke opstelling |
| Achterhoede | verdediger verloor de vorige beurt | verdediger moet eenheden van de tafel krijgen |
| Konvooi | regio is afgesneden | konvooi over de tafel krijgen of tegenhouden |
| Raid | onverdedigde of kleine regio, of commando/partizanen-doctrine | snel een doel vernietigen, kleiner gevecht |
| Strandlanding | amfibische order op een kustregio | aanvaller moet de stranduitgangen nemen |
| Luchtlanding | parachutisten-order, bv. Market Garden | verspreide aanvaller moet objectives verzamelen en houden |
| Omsingeling uitbreken | regio is volledig ingesloten | verdediger moet door een tafelrand uitbreken |
| Ontzet | eigen regio ernaast is ingesloten | aanvaller moet een corridor openen naar de ingesloten troepen |
| Tegenaanval | verdediger won de vorige beurt | snelle aanval op een vijand die nog niet is ingegraven |
| Linie doorbreken | versterkte linie (Atlantikwall, Gustav-linie) | aanvaller moet bunkers en mijnenvelden doorbreken |
| Nachtaanval | gekozen of gerold | beperkt zicht, verrassingsvoordeel |

Extra lagen die de generator toevoegt:
- Opstelling: lange tafelzijde, diagonaal, hoeken, verdediger in het midden.
- Tijd en weer: dageraad, nacht, mist, sneeuw, modder, met hun regeleffect.
- Speciale regels: reserves, luchtsteun, voorbereidend bombardement, mijnenvelden, prikkeldraad.
- Doctrine-effecten van beide kanten.
- Aantal beurten en exacte overwinningsvoorwaarden.
- Korte briefing per kant ("Je moet de brug bij X nemen voor de pantsers aankomen"), voor de sfeer.

Gevolgscenario's: als een regio meerdere beurten omstreden blijft, verwijst het volgende gevecht naar het vorige ("de verdediger zit nu in de ruïnes van het dorp").

---

## 9. Tafelmap generator

Maakt een bovenaanzicht van je speeltafel voor de regio van het gevecht, met terrein, objectives en opstelzones op schaal. De kern: hij gebruikt alleen terrein dat je echt hebt.

- Tafelgrootte: instelbaar, bv. 6x4 ft of 4x4 ft, in inch of cm.
- Terreinvoorraad: je voert je fysieke stukken in (bv. 3 bossen, 2 boerderijen, 6 hagen, 1 rivier, 4 ruïnes). De map gebruikt alleen die.
- Terreinsets per regiotype:
  - Steppe: open, enkele dorpjes, ravijnen (balka's)
  - Bocage: hagen, kleine velden, holle wegen
  - Woestijn: wadi's, ruggen, verspreide rotsen
  - Stad: straten, ruïnes, pleinen
  - Bos (bv. Ardennen): dicht bos, paden, open plekken
  - Italië: heuvels, terrassen, dorpjes op heuvels
  - Rivierlandschap: rivier rand tot rand, brug(gen), oevers
  - Strand: zee, strand, duinen, bunkers
- Periode en seizoen: sneeuw- of moddertafel in de winter, ruïnes in steden die al eerder gevechten hadden.
- Plaatsing via grid: de tafel in vakken, terrein geplaatst met regels: geen lege schietbaan van rand tot rand, een minimale afstand tussen stukken, een rivier altijd rand tot rand.
- Koppeling met het scenario: objectives liggen op posities die bij het scenario passen (brug op de rivier, objectives in de stad), en de opstelzones volgen de opstelling.
- Output: printbare SVG of PDF met legenda, maten en de scenario-briefing op één pagina.
- Herrollen: knop om alleen het terrein opnieuw te genereren met dezelfde scenario-seed.

---

## 10. Resultaat terug naar de campagne

Na het gevecht voer je de uitslag in en past de app de kaart aan. Omdat gevechten altijd even zijn, werken de gevolgen via voordelen en kaartpositie, niet via kleinere legers.

| Uitslag | Gevolg op de kaart |
|---|---|
| Grote overwinning aanvaller | regio veroverd, verdediger trekt terug, aanvaller krijgt volgende beurt een extra order |
| Kleine overwinning aanvaller | regio veroverd, maar volgende beurt niet bevoorraad |
| Gelijkspel | regio blijft omstreden, het volgende gevecht daar is een vervolgscenario |
| Overwinning verdediger | regio blijft, verdediger krijgt een tegenaanval-optie |

- Invoer: winnaar, marge (groot of klein), optioneel de verliezen en een opmerking of hoogtepunt.
- Campagnewinst: totaal overwinningspunten van regio's, hoofdsteden innemen, het doel van het campagnescenario halen, of een vast aantal beurten.
- Log: een tijdlijn per beurt met alle gevechten, scenario's, maps en uitslagen.
- Veteranen (optioneel): een eenheid die meerdere gevechten overleeft, krijgt een naam en een kleine bonus.

---

## 11. Voor Claude Code: datamodel

| Entiteit | Belangrijkste velden |
|---|---|
| Campaign | naam, ruleset-profiel, puntentotaal, periode (early/mid/late), doorlopend ja/nee, campagnescenario, huidige beurt, seizoen, winconditie |
| CampaignScenario | naam, periode, startkaart, facties, bondgenootschappen, doelen, max beurten |
| Faction | naam, kleur, speler of AI, hoofdstad, doctrine(s), legerlijst |
| Doctrine | naam, factie, periodes[], strategisch effect, gevechtseffect, nadeel |
| Region | id, naam, theater, buren[], eigenaar, terreintype, infrastructuur[], waarde, versterking, bevoorraad, omstreden |
| Turn | nummer, seizoen, jaar, orders[], gevechten[] |
| Order | factie, type, bronregio, doelregio |
| Battle | regio, aanvaller, verdediger, scenario, tafelmap, uitslag |
| BattleScenario | seed, type, objective, opstelling, tijd/weer, speciale regels, doctrine-effecten, aantal beurten, briefings |
| TableMap | tafelmaat, grid, geplaatste stukken[], objectives[], opstelzones[] |
| TerrainPiece | type, aantal, afmeting |
| RulesetProfile | systeem (FoW/Battlegroup), puntenschaal, missienamen, winbepaling |

---

## 12. Bouwvolgorde (kleinste werkende versie eerst)

1. Regio-graaf met één theater en een kaartweergave met eigenaarskleuren.
2. Campagne aanmaken: periode kiezen en één campagnescenario laden (bv. Overlord).
3. Orders en beurtafhandeling, inclusief conflicten en ontmoetingsgevechten.
4. Gevechtsscenario-generator met gewogen tabellen en seed.
5. Doctrines als modifiers op orders en scenario's.
6. Tafelmap-generator op basis van terreinvoorraad, met SVG-export.
7. Uitslag invoeren, kaart bijwerken, campagnelog.
8. Extra's: meer theaters en campagnescenario's, doorlopende periodes, AI-landen, historische events, doctrine-boom, printbare scenariokaart.

---

## 13. Nog te beslissen

- FoW, Battlegroup of beide vanaf het begin?
- Aantal spelers, en lokaal op één toestel of elk op een eigen toestel?
- Webapp (werkt ook op gsm) of desktop-app?
- Doctrine vast per factie, of zelf kiezen bij de start?
