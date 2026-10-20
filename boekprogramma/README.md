# Boekschrijfprogramma

Een lokale webapp om in het Nederlands een boek te schrijven en te exporteren naar een nette A5-PDF. Draait op je eigen computer (Windows of Mac) in de browser. Er gaat niets naar internet, behalve als je zelf de Claude-functies aanzet.

## Windows: de .exe

### **[Download Boekschrijfprogramma.exe](https://github.com/matissewvg-web/main-2/releases/download/boekprogramma/Boekschrijfprogramma.exe)**

Eén bestand, niet installeren: zet het waar je wilt (bijvoorbeeld op het bureaublad) en dubbelklik. Het opent in een eigen venster. Python en Pango zitten erin, dus de PDF-export werkt meteen.

- Windows waarschuwt *"Windows heeft uw pc beschermd"* omdat het programma niet ondertekend is: klik *Meer informatie* → *Toch uitvoeren*. Een virusscanner kan zo'n onondertekende .exe soms ten onrechte tegenhouden.
- Starten duurt een paar seconden: de .exe pakt zichzelf eerst uit.
- *PDF opslaan…* vraagt waar je het bestand wilt bewaren. *Afdrukvoorbeeld* opent in je gewone browser.
- Elke wijziging in `boekprogramma/` wordt door GitHub Actions op Windows opnieuw gebouwd en getest (`.github/workflows/boekprogramma-windows.yml`); de link hierboven geeft altijd de nieuwste versie. Je boeken blijven bij een update gewoon staan.
- Zelf bouwen op Windows: `pip install -r requirements.txt -r requirements-exe.txt` en `python bouw_exe.py`.

## Starten zonder .exe

**Windows:** dubbelklik `start-windows.bat`.
**Mac:** dubbelklik `start-mac.command` (de eerste keer: rechtsklik → *Open*, omdat macOS onbekende scripts blokkeert).

De eerste keer maakt het script een Python-omgeving en installeert de onderdelen (een paar minuten). Daarna opent de browser op `http://127.0.0.1:5123`. Laat het zwarte venster open zolang je schrijft; sluit het om te stoppen.

Je hebt **Python 3.10 of nieuwer** nodig (python.org; vink op Windows *Add python.exe to PATH* aan).

Met de hand kan ook:

```
python -m venv .venv
.venv/bin/pip install -r requirements.txt        (Windows: .venv\Scripts\pip ...)
.venv/bin/python app.py
```

### PDF-export: één extra stap

De PDF wordt gemaakt met WeasyPrint. Dat heeft de tekstbibliotheek **Pango** nodig, die pip niet kan installeren.

- **Mac:** installeer [Homebrew](https://brew.sh) en daarna `brew install pango`.
- **Windows:** installeer [MSYS2](https://www.msys2.org), open *MSYS2 MINGW64* en voer uit: `pacman -S mingw-w64-x86_64-pango`. Het startscript vindt het daarna vanzelf in `C:\msys64\mingw64\bin`.

Werkt dat (nog) niet, dan blijft de rest van het programma gewoon werken. Gebruik dan **Export → Afdrukvoorbeeld in de browser** en kies *Opslaan als PDF* met papierformaat A5. Dat geeft dezelfde opmaak, met twee verschillen: de inhoudsopgave heeft geen paginanummers en de eerste pagina van een hoofdstuk krijgt wel een paginanummer.

## Wat het doet

| Onderdeel | |
|---|---|
| **Schrijven** | Hoofdstukken links (slepen of ▲▼ om te ordenen), tekst in het midden, slaat automatisch op terwijl je typt. |
| **Spelling** | Nederlands woordenboek van OpenTaal. Onbekende woorden worden rood onderstreept; klik erop voor suggesties of om het woord aan de woordenlijst van je boek toe te voegen. Namen van je characters tellen automatisch als goed. |
| **Herhalingen** | Woorden die je vaak of kort na elkaar gebruikt, met alternatieven. Klik op een woord in de lijst om het in de tekst aan te wijzen, en op een gemarkeerd woord in de tekst om het te vervangen. |
| **Characters** | Naam, bijnamen, leeftijd, rol, uiterlijk, beschrijving, relaties en tijdlijn. In de hoofdstuklijst zie je wie er in welk hoofdstuk voorkomt (gezocht op naam en bijnaam). |
| **Wereld & maps** | Vrije notities over de wereld. Maps: importeer een afbeelding (bijvoorbeeld een screenshot), koppel hem aan hoofdstukken en zet hem eventueel op een eigen pagina in de PDF. |
| **Export** | A5-PDF met titelpagina, inhoudsopgave, paginanummers, elk hoofdstuk op een nieuwe pagina, gespiegelde marges (binnenmarge aan de rugkant), uitgevulde tekst met Nederlandse woordafbreking. Lettertype Literata wordt meegeleverd, zodat de PDF op elke computer hetzelfde is. |
| **Claude** (optioneel) | Herschrijfvoorstellen voor een zin, en een chatpaneel over het open hoofdstuk. Staat uit tot je een API-sleutel invult onder *Instellingen*. |

### Opmaak in de tekst

```
Elke regel is een alinea.
De eerste alinea na een kop of scènewissel springt niet in, de rest wel.
***
Drie sterretjes op een eigen regel geven een scènewissel.
## Een tussenkop
> Regels met > ervoor worden een ingesprongen citaat (brief, gedicht).
*cursief*, _ook cursief_, **vet**
```

## Waar je boek staat

In de map **Boeken** in je gebruikersmap (`C:\Users\<naam>\Boeken` of `/Users/<naam>/Boeken`). Andere map? Zet de omgevingsvariabele `BOEKEN_MAP`.

```
Boeken/
  instellingen.json            laatst geopende boek, eventueel je Claude-sleutel
  mijn-boek/
    boek.json                  titel, auteur, volgorde, export-instellingen, maps
    hoofdstukken/*.md          elk hoofdstuk als Markdown: "# Titel" en dan de tekst
    characters/*.json
    maps/                      geïmporteerde afbeeldingen
    wereld/*.md
    woordenlijst.txt           woorden die de spelling goed moet rekenen
    .versies/<datum>/          per dag de eerste versie van elk gewijzigd hoofdstuk
    prullenbak/                verwijderde hoofdstukken, characters en maps
```

Het zijn gewone bestanden: je kunt ze openen, kopiëren en in een back-up meenemen. **Maak zelf back-ups** (USB-stick, OneDrive, iCloud). De `.versies`-map beschermt tegen een per ongeluk gewiste alinea, niet tegen een kapotte schijf.

## Eerlijke grenzen

- **Spelling** vindt woorden die niet bestaan. Het vindt geen fouten met bestaande woorden (*word/wordt*, *hun/hen*, *als/dan*), geen zinsbouw en geen stijl.
- **Herhalingen** kijkt naar letterlijk hetzelfde woord: *keek* en *kijkt* tellen apart. De alternatieven komen uit `boek/synoniemen.json` (ongeveer 100 veelgebruikte woorden). Die lijst kun je zelf uitbreiden. Niet elk alternatief past in elke zin.
- **Paginaschatting** in de hoofdstuklijst (250 woorden per pagina) is grof. Het echte aantal staat na het maken van de PDF.
- **Drukwerk:** een drukkerij vraagt vaak afloop (*bleed*) en een omslag apart. Dat maakt dit programma niet. Vraag bij de drukker na welke binnenmarge ze bij jouw paginadikte adviseren.

## Claude: kosten

De Claude-functies gebruiken je eigen API-sleutel van [console.anthropic.com](https://console.anthropic.com) en het model `claude-opus-5-5` ($4 per miljoen tokens in, $20 per miljoen uit). Grofweg:

- een zin herschrijven: minder dan een dollarcent;
- een vraag over een hoofdstuk van 5000 woorden: 4 à 8 dollarcent. Vervolgvragen in hetzelfde gesprek zijn goedkoper, omdat het hoofdstuk dan uit de cache komt.

Na elk verzoek zie je in het paneel hoeveel tokens het kostte en wat dat ongeveer in dollars is. Zet in de console een maandlimiet als je zeker wilt zijn. De sleutel wordt alleen op je eigen computer bewaard, in `instellingen.json` (of zet hem in de omgevingsvariabele `ANTHROPIC_API_KEY`).

## Testen

```
.venv/bin/python -m pytest
```

Elke "afgerond als"-controle uit `SPEC.md` heeft een eigen test in `tests/test_boekprogramma.py`: een hoofdstuk wordt een bestand, tekst overleeft een herstart, opzettelijke spelfouten worden gevonden, een herhaald woord krijgt alternatieven, de PDF is exact A5 met de ingestelde marges, een character verschijnt in de hoofdstuklijst, het chatpaneel geeft een antwoord (met een nagebootste Claude, dus gratis) en een testboek met drie hoofdstukken, een character en een map wordt een PDF.

## Bronnen en licenties

- Woordenboek: [OpenTaal](https://github.com/OpenTaal/opentaal-hunspell), BSD/CC BY 3.0, zie `woordenboek/LICENSE.txt`.
- Lettertype: [Literata](https://github.com/googlefonts/literata), SIL Open Font License, zie `lettertype/OFL.txt`.
