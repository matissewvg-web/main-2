# CHROME LEDGER: Execution Plan (voor Claude Code)

Privé hobbyproject, geen publicatie, geen prijs. Beurtgebaseerde cyberpunk-corpo-simulatie in een alt-history Nova Antwerpa (2002 tot 2077+). Alleen UI, tabellen en een kleurvlakkenkaart. Geen art-assets nodig.

---

## 0. Vaste beslissingen (niet opnieuw bespreken)

| Onderwerp | Keuze | Waarom |
|---|---|---|
| Tech | Vanilla HTML/CSS/JS, geen framework, canvas voor kaart | Minste kans op build-problemen |
| Draaien | `python3 -m http.server` in de projectmap, open `localhost:8000` | ES-modules en `fetch()` van JSON werken NIET via dubbelklikken op `index.html` (file://) |
| Data | Alle spelinhoud in `/data/*.json`, nooit hardcoded in logica | Maakt modding en customization gratis |
| Willekeur | Eén seeded RNG (mulberry32), alle randomness daarlangs | Zelfde seed = zelfde wereld, bugs reproduceerbaar |
| Save | localStorage + export/import als JSON-bestand | Geen server nodig |
| Taal | NL eerst, strings in `/data/i18n/nl.json` | EN later toevoegen zonder code te wijzigen |

### Projectstructuur

```
chrome-ledger/
  index.html
  src/
    main.js        (opstart, schermwissel)
    state.js       (één state-object, enige bron van waarheid)
    rng.js         (seeded RNG)
    turn.js        (beurtlus)
    actions.js     (acties uitvoeren, leest actions.json)
    effects.js     (effect-interpreter, zie 2.5)
    map.js         (kaartgeneratie + canvas-render)
    ui/            (schermen: creator, hud, kaart, rapport, events)
    save.js
    modloader.js
  data/
    archetypes.json  sectors.json  culture.json  perks.json  flaws.json
    actions.json  buildings.json  districts.json  rivals.json
    techtree.json  eras.json  mutators.json  winconditions.json
    events/*.json   i18n/nl.json
  mods/             (eigen packs, zelfde structuur als data/)
```

---

## 1. De kaart, concreet

### 1.1 Wat de kaart IS
Een raster van **32 x 20 tegels**. Elke tegel is land of water. Elke landtegel hoort bij precies **één district**. De speler bestuurt districten, niet tegels. Tegels zijn alleen visueel.

### 1.2 Generatie (seed-gebaseerd)
1. Zet water: een rivier (de "Schelde") langs de westkant als brede strook plus havenbekkens met willekeurige uitstulpingen. Dit is de haven.
2. Plaats N district-zaadpunten op landtegels (N = 8, 12 of 16 volgens instelling), met minimale onderlinge afstand.
3. Groei districten via voronoi-op-raster: elke landtegel krijgt het dichtstbijzijnde zaadpunt.
4. Wijs districttypes toe op basis van positie: Haven-type grenst aan water, Zakenkwartier ligt het dichtst bij het midden, Slums liggen aan de rand, enz.
5. Genereer naam uit `districts.json` (naampool per type) tenzij de speler zelf een naam instelde.
6. Bereken buren (aangrenzende districten). Dit bepaalt expansie en rivaliteit: je kan alleen invloed uitbreiden naar buurdistricten van waar je al staat.

### 1.3 Districtstypes (standaardset, aanpasbaar in JSON)
Haven, Oude Stad, Zakenkwartier, Slums, Dataring, Universiteitswijk, Industriezone, Luchthaven, Villawijk, Zwarte Markt, Mediakwartier, Grensstrook.

Per district (0 tot 100 tenzij vermeld):
`bevolking`, `rijkdom`, `criminaliteit`, `loyaliteit` (aan jou), `politie`, `techniveau`, plus `slots` (aantal bouwplaatsen, 4 tot 10) en `invloed` (een lijst: hoeveel % elke factie heeft, som max 100).

### 1.4 Controle-regel (eenvoudig en eerlijk)
- Je **controleert** een district als jouw invloed er **> 50%** is en hoger dan elke rivaal.
- Winvoorwaarde "stad" = controle over > 50% van de totale bevolking, niet van het aantal districten.
- Invloed verschuift per beurt door acties, gebouwen, events en rivalen.

### 1.5 Kaartweergave
Klik op een district: zijpaneel met stats, gebouwen, invloedsbalk per factie. Kaartlagen (knoppen): **Eigenaar, Rijkdom, Criminaliteit, Heat, Loyaliteit, Politie, Tech**. Elke laag is een kleurverloop over de districten.

---

## 2. Customization, concreet

### 2.1 Corpo-creatie (wizard, 6 stappen)
1. **Identiteit:** naam, slogan, hoofdkleur en accentkleur, logo (kies vorm + symbool uit een lijst van 20), HQ-district.
2. **Oprichter** (kies 1, elk met stat-modifiers uit `archetypes.json`): ex-militair, hacker, erfgenaam, smokkelaar, ex-politicus, wetenschapper, mediafiguur, havenbaas.
3. **Sector** (kies 1, bepaalt startproducten en basisinkomen): hardware, biotech, media, beveiliging, havenlogistiek, financiën, energie, informatiehandel.
4. **Cultuur-sliders** (4 assen, -5 tot +5, elk met passieve effecten):
   - Winst ↔ Ethiek (inkomen vs reputatie, heat)
   - Geheimhouding ↔ PR (heat-opbouw vs invloed in media)
   - Centraal ↔ Decentraal (efficiëntie vs loyaliteit/overlopers)
   - Mens ↔ Machine (personeelskost vs automatiseringsrisico)
5. **Perks en gebreken (point-buy):** je hebt 5 punten. Perks kosten punten, gebreken geven punten terug. Voorbeelden: perk "Oude connecties" (+politieke invloed, 2 pt), gebrek "Schuld bij de maffia" (-geld per beurt, +1 pt). Minstens 1 gebrek verplicht.
6. **Overzicht en bevestigen:** toont alle effecten opgeteld.

### 2.2 Wereld-opties (bij nieuw spel)
- Startjaar: 2002 / 2015 / 2030 (laadt de passende startstaat uit `eras.json`)
- Seed (leeg = random), kaartgrootte (8/12/16 districten)
- Aantal rivalen: 2 tot 6
- Tempo: kwartaal-/halfjaar-/jaarbeurten per era (zie 2.6)
- Wereldtoon: grimmig, satirisch of serieus (filtert welke events voorkomen)
- District-namen-editor: hernoem elk district vóór start

### 2.3 Rivalen-editor
Per rivaal: naam, kleur, sector, en **6 sliders (0 tot 10)**: agressie, geheimhouding, expansiedrang, betrouwbaarheid in deals, risicobereidheid, nijd (hoe vaak ze op jou mikken). Presets: De Haai, De Spin, De Gentleman, De Generaal. Of laat ze random genereren op seed.

### 2.4 Mutators en winvoorwaarden
**Mutators (aan/uit):** hardcore heat (sneller game over), geen bailouts, wrede rivalen, permadeath personeel, schaarse tech, volatiele markt, gladde politie (omkoping goedkoper maar dan stuk), geen fast-forward.

**Winvoorwaarden (meerdere aanvinkbaar, eerste die lukt wint):**
- Stad: > 50% bevolking onder controle
- Geld: €10 miljoen eurodollars
- Tech: transcendentie-project (laatste techtree-knoop) afmaken
- Ontsnappen: bouw "Exit" en verlaat de stad
- Redder: breng criminaliteit < 20 en loyaliteit > 70 in alle districten
- Sandbox: geen einde

### 2.5 Modding: effecten als data
Alle events, acties en gebouwen beschrijven hun gevolgen met dezelfde kleine taal, zodat jij zonder code kan uitbreiden:

```json
{
  "id": "ev_havenstaking",
  "titel": "Havenstaking",
  "toon": ["grimmig", "serieus"],
  "van": 2002, "tot": 2077,
  "voorwaarde": [{ "district_type": "Haven", "controle": true }],
  "keuzes": [
    { "tekst": "Betaal de vakbond",
      "effecten": [{ "stat": "geld", "op": "add", "waarde": -5000 },
                   { "district": "Haven", "stat": "loyaliteit", "op": "add", "waarde": 10 }] },
    { "tekst": "Stuur beveiliging",
      "effecten": [{ "stat": "heat", "op": "add", "waarde": 8 },
                   { "district": "Haven", "stat": "loyaliteit", "op": "add", "waarde": -15 }],
      "volgt": "ev_havenstaking_escalatie" }
  ]
}
```

`volgt` maakt event-ketens mogelijk (het verhaal). `effects.js` is de enige plek waar deze taal wordt uitgevoerd.

### 2.6 Tijd en tempo (los van het tijdperk-thema)
Standaard `eras.json`: kwartaalbeurten 2002 tot 2012 (40 beurten), halfjaar 2012 tot 2040 (56), jaar 2040 tot 2077 (37). Totaal ca. 133 beurten. Instelbaar. Fast-forward-knop herhaalt "niets doen" tot er iets gebeurt.

### 2.7 Persoonlijk spelen
- Thema's: neon, grimmige terminal, retro 2002 (CSS-variabelen)
- Export/import van een complete wereld (seed + instellingen) als bestand
- Eigen mod-pack laden via bestandskiezer (werkt ook zonder server)

---

## 3. De stappen

Schatting = aantal sessies met Claude Code, plus jouw testtijd. Stop-regel per mijlpaal staat erbij: als die faalt, niet doorbouwen maar eerst repareren of schrappen.

### Mijlpaal 1: Speelbare kern (1 sessie + 1 uur testen)
**Doel:** een volledig beurtsysteem met creatie, 5 acties en game over.

1. Project opzetten volgens 0, lege schermen, `python3 -m http.server` werkt.
2. `rng.js` + `state.js` + save/load naar localStorage.
3. Corpo-creatie wizard (stap 1 t/m 6) met 3 oprichters, 3 sectoren, 4 sliders, 6 perks, 4 gebreken in JSON.
4. Beurtlus: rapport, 3 actiepunten, event, einde beurt. Resources: Eurodollars, Invloed, Tech, Heat, Personeel.
5. 5 acties: Onderzoek, Expanderen, Sabotage, Lobbyen, Aanwerven (alles uit `actions.json`).
6. 10 events met één keten van 3.
7. Game over: faillissement of heat > 100. Winst: geld-voorwaarde.

**Succesmaatstaf:** je speelt 20 beurten zonder crash en elke beurt voelt als een keuze (niet "klik de beste knop").
**Stop als:** na 20 beurten één actie altijd wint. Dan eerst balans herzien (kosten/effecten in JSON), niet verder.

**Prompt voor Claude Code:**
> Lees CHROME_LEDGER_PLAN.md. Voer enkel Mijlpaal 1 uit. Houd je strikt aan sectie 0 (vanilla JS, JSON-data, seeded RNG, geen frameworks). Bouw stapsgewijs en laat na elke stap iets draaien. Voeg geen features toe die niet in Mijlpaal 1 staan. Als je iets niet kan testen, zeg dat.

**Status M1 (gebouwd):** alles uit stap 1 t/m 7 staat erin. Keuzes die de volgende sessie moet kennen:
- Extra databestanden: `balans.json` (alle economiegetallen + statgrenzen), `mods.json` (weergave van modifiers), `logos.json` (5 vormen, 20 symbolen). Extra code: `src/data.js` (laden + controle), `src/i18n.js`, `tools/sim.mjs` (balans-simulator, `node tools/sim.mjs 300 20`).
- Twee hulpstats naast de vijf resources: **Vestigingen** (`omvang`, wat Expanderen ophoogt) en **Marktdruk** (`druk`, abstracte concurrentie die Sabotage terugdrukt). Marktdruk is een placeholder tot de rivalen in M4; Vestigingen wordt in M2 vervangen door districten.
- Passieve effecten zijn modifiers (`mods`: `inkomen`, `heat_gain`, `kans.sabotage`, ...) die oprichter, sector, cultuur, perks en gebreken optellen. Effecttaal uitgebreid met `kans`/`dan`/`anders`, `vlag`, bereik `{min,max}` en `op: mul|set`; voorwaarden met `stat min/max`, `vlag`, `beurt_min`, `sector`, `oprichter`, `perk`, `gebrek`. `district`-effecten worden in M1 overgeslagen.
- Geen wereld-opties (M2), alleen een seed-veld in de laatste wizardstap. HQ-district wordt opgeslagen maar doet nog niets.
- Simulatie (300 spellen): geen enkele "altijd dezelfde actie"-strategie overleeft 20 beurten beter dan een gemengde strategie; een redelijke mix haalt €10M rond beurt 97 in 64% van de spellen.

### Mijlpaal 2: Kaart, districten, gebouwen (1 tot 2 sessies)
1. `map.js`: generatie volgens 1.2 met seed, canvas-render, klikselectie.
2. District-stats, buurlogica en invloedsbalk (1.3, 1.4).
3. Kaartlagen (1.5).
4. Acties worden district-gebonden (Expanderen mikt op een buurdistrict).
5. Gebouwen bouwen in slots (`buildings.json`): 15 gebouwen met kost, onderhoud en bonus.
6. Wereld-opties: kaartgrootte, seed, districtnamen-editor.

**Succesmaatstaf:** dezelfde seed geeft altijd dezelfde kaart; je kan een district overnemen via buurlogica.

**Status M2 (gebouwd):** stap 1 t/m 6 staan erin. Keuzes die de volgende sessie moet kennen:
- Nieuwe code: `src/map.js` (generatie + canvas), `src/districts.js` (controle, bereik, inkomen, districtverwijzingen), `src/ui/kaart.js` (kaart, lagen, districtpaneel), `src/ui/wereld.js` (wereld-opties). Save-versie is 2; saves van M1 laden niet meer (nette melding in het menu).
- `omvang`/Vestigingen uit M1 is weg. Inkomen = sectorbasis + **markt** (bevolking × rijkdom × jouw aandeel per district, +50% bij controle) + **gebouwen** (15 in `buildings.json`, inkomen geschaald met rijkdom en `type_bonus`). Personeel, onderhoud en heat komen per gebouw.
- Acties: **Expanderen** mikt op een district waar je zit of dat eraan grenst (`doel: "bereikbaar"`); **Bouwen** is nieuw (`soort: "bouwen"`, `doel: "bouwplaats"`, min. 25% invloed en een vrije slot, kost stijgt per gebouw dat je hebt).
- Districten leven: loyaliteit en criminaliteit zakken terug naar hun startwaarde, lokale heat koelt af, jouw invloed groeit bij loyaliteit > 50 en krimpt eronder. Politie remt nieuwe invloed af.
- Er zijn nog geen rivalen: in de invloedsbalk staat naast jou alleen "vrij". `invloed` is per district een object `{factie: %}`, zodat M4 rivalen kan toevoegen zonder datamodelwijziging. Marktdruk blijft de placeholder-concurrentie.
- Effecttaal: `district: "doel" | "hier" | "context" | "hq" | "alle" | "aanwezig" | "controle" | <type>`; voorwaarden `{district_type, controle}` en `{district: {type, controle, aanwezig, stat, min, max}}`. Events met een districtvoorwaarde krijgen dat district als context (`{district}` in de tekst). 4 nieuwe district-events, waaronder de havenstaking uit 2.5.
- Wereld-opties: seed, 8/12/16 districten, namen-editor. Wereldtoon en startjaar staan nog niet in de UI.
- Simulatie: een gemengde strategie wint (geld) rond beurt 85 in 82% van de spellen; een expansiestrategie controleert ~70% van de bevolking maar wint zelden op geld. Dat is de basis voor de "Stad"-winvoorwaarde in M5.
**Stop als:** de kaart er rommelig uitziet of districten onleesbaar klein zijn. Dan eerst rastergrootte of districtaantal aanpassen.

**Status verdiepingsupdate (na M2, op vraag van de speler):** buiten de mijlpaalvolgorde toegevoegd:
- Creatie: 8 stappen. Nieuwe stap **Logo** (12 vormen, 40 symbolen, monogram, 6 vullingen, 5 randen, symboolkleur/-grootte, draaiing, kleurpaletten, willekeurig) en nieuwe stap **Bedrijfsvorm** (`bedrijfsvormen.json`, 7 vormen). Alle 8 oprichters en 8 sectoren uit 2.1, 14 perks en 10 gebreken. Elke keuze toont voordelen en nadelen apart.
- Wereld-opties: wereldtoon (2.2) en moeilijkheid (`moeilijkheid.json`, werkt via modifiers).
- Nieuwe modifiers: `markt_inkomen`, `bouw_kost`, `expansie_kracht`, `gebouw_inkomen.<gebouw-id>`. `modsVan` telt corpo + moeilijkheid + marktfase op.
- **Marktcyclus** (`markt.json`, `src/markt.js`): stabiel, hoogconjunctuur, zeepbel, recessie, crash; elke fase heeft modifiers en laat districten rijker/armer worden.
- **Opdrachten** (`opdrachten.json`, `src/opdrachten.js`): doelen met deadline, beloning en straf, in de bestaande voorwaarde- en effecttaal (`plus` voor relatieve doelen, `context` voor een district).
- **Stadsnieuws** (`nieuws.json`): één kop per beurt.
- 7 nieuwe acties (Witwassen, Bende inhuren, Gebouw verkopen, PR-campagne, Ordehandhaving, Politie omkopen, Hacken), gegroepeerd in Bedrijf en District. Nieuwe doelregels `aanwezig` en `eigen_gebouw`.
- 32 events (18 nieuw, met een keten van 3 en een lening die na 8 beurten terugkomt). Nieuw effect `{ "district": ..., "gebouw": "verwijder" }`.
- Save-versie 3. Simulatie: gemengde strategie wint rond beurt 78 (77%).

### Mijlpaal 3: Personeel (1 sessie)
1. Benoemde personages (naam uit pool, 3 eigenschappen, ambitie, loyaliteit).
2. Sleutelrollen: CFO, Security, Netrunner, PR (elk met passief effect).
3. Events: overlopen, chanteren, promotie, ontslag.
4. Mutator permadeath.

**Succesmaatstaf:** je voelt je aan één personage gehecht of geïrriteerd.
**Stop als:** het enkel extra cijfers zijn zonder verhaal. Dan schrappen.

### Mijlpaal 4: Rivalen-AI (2 sessies, het moeilijkste deel)
1. Rivalen-editor (2.3) en 4 presets.
2. AI-beslissing per beurt: score per mogelijke actie = sliders x situatie (zwakke buren, hun heat, jouw zwakte). Geen magie, gewogen keuze plus ruis uit seed.
3. Verhoudingen: allianties, verraad, vendetta (opgeslagen als een relatiematrix).
4. Rivalen mogen verliezen en verdwijnen.

**Succesmaatstaf:** twee runs met dezelfde rivaal verlopen merkbaar anders.
**Stop als:** rivalen alleen jou aanvallen of alleen niets doen. Dan scoreformule herwegen met logging (laat Claude Code per beurt hun scores printen).

### Mijlpaal 5: Tijdperken, tech, producten, events (2 sessies)
1. `eras.json` met 4 tijdperken en tempo-wissel (2.6).
2. Tech tree met **elkaar uitsluitende doctrines** (bv. cyberware óf drones).
3. Productontwerp: kies 2 tot 3 componenten, stats volgen uit componenten.
4. 60+ events, met tijdperk- en toonfilter.
5. Overige winvoorwaarden uit 2.4.

**Succesmaatstaf:** twee verschillende doctrines geven een echt ander late game.
**Stop als:** één doctrine strikt beter is. Dan bijstellen.

### Mijlpaal 6: Mutators en mods (1 sessie)
1. Alle mutators uit 2.4.
2. `modloader.js`: pack laden via bestandskiezer, valideren, mergen over `data/`.
3. Thema's, export/import van wereld, EN-vertaling.

**Succesmaatstaf:** je voegt zelf een event toe in JSON zonder code aan te raken en het verschijnt in-game.

---

## 4. Kritiek pad en parallel

- **Kritiek pad:** M1 → M2 → M4 → M5. Zonder kaart (M2) is rivaliteit zinloos, zonder rivalen (M4) is het spel solitair.
- **Parallel mogelijk:** M3 (personeel) kan na M1 los van M2 en M4. Events schrijven kan altijd tussendoor.
- **Totaal:** 8 tot 10 sessies met Claude Code, plus testtijd. Reken realistisch op enkele weken, niet dagen.

## 5. Aannames en risico's

| Risico | Gevolg | Tegenmaatregel |
|---|---|---|
| Balans uit de hand | Spel is saai of onverslaanbaar | Alles in JSON, per testronde 1 getal aanpassen, nooit tien tegelijk |
| Claude Code bouwt te veel tegelijk | Kapot en onbegrijpelijk | Elke prompt eindigt met "voer enkel stap X uit" |
| Spel groeit te groot voor één contextvenster | Claude Code vergeet structuur | Houd dit bestand actueel en laat het elke sessie lezen |
| Je verliest interesse na M2 | Half project | Stopmaatstaven bewust gebruiken: stoppen na M2 is oké, M1+M2 is al een speelbaar spel |
| Rivalen-AI blijft onleuk | Spel is na 2 runs dood | M4 mag falen: val terug op simpele scripted rivalen met events |

## 6. Eerste handeling

Open Claude Code in een lege map `chrome-ledger`, zet dit bestand erin, en gebruik de prompt bij Mijlpaal 1.
