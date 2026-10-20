# Boekschrijfprogramma: spec

Status: stap 1 t/m 9 gebouwd en getest (zie onderaan).

## Doel

Een lokale webapp waarmee ik in het Nederlands een boek schrijf en exporteer naar een nette A5-PDF.

- Ik wil geen Word gebruiken. Ik schrijf zelf, het programma ondersteunt het schrijven en de export.
- Schrijven is de prioriteit. Maps en tekenen zijn extra.
- Het programma wordt gebouwd met Claude Code.

## Beslissingen

- Vorm: lokale webapp, draait in de browser, werkt op Windows en Mac.
- Backend: Python (Flask). Frontend: HTML/CSS/JavaScript zonder bouwstap.
- Taal van het boek: Nederlands.
- Export: A5 via HTML/CSS (`@page { size: A5; }`) en WeasyPrint naar PDF. Terugval: afdrukvoorbeeld in de browser.
- Spellingscorrectie: Nederlands woordenboek van OpenTaal (hunspell-formaat), gelezen met spylls.
- Opslag: hoofdstukken als Markdown, characters als JSON, maps als afbeeldingen met koppeling aan hoofdstukken in `boek.json`.

## Harde eisen

- Prio 1: hoofdstukken schrijven en ordenen, A5-PDF-export met nette opmaak, Nederlandse spellingscorrectie.
- Prio 2: suggesties voor geavanceerdere taal, verdere opmaak, characters en wereldopbouw, maps (eerst screenshot importeren).
- Buiten scope: Word-export, ePub, samenwerking met anderen, tekenen.

## Open punten: zo zijn ze ingevuld

- [x] **Webapp of desktopprogramma:** webapp. Start met een dubbelklik op een script; luistert alleen op `127.0.0.1`.
- [x] **Aantal pagina's per boek:** bleek niet nodig voor de opzet. De PDF loopt door zo lang als het boek is. Wat wel van de dikte afhangt is de binnenmarge bij gebonden drukwerk; die is instelbaar (standaard 20 mm binnen, 15 mm buiten). Vraag de drukker om advies voor jouw dikte.
- [x] **Claude API:** zit erin, maar staat uit tot je een eigen sleutel invult. Elk antwoord toont het tokengebruik en de geschatte kosten. Model: `claude-opus-5-5`.

## Uitvoeringsplan en controle

| Stap | Wat | Afgerond als | Test |
|---|---|---|---|
| 0 | Voorbereiding | programma start | `start-windows.bat` / `start-mac.command` |
| 1 | Spec vastleggen | `SPEC.md` bestaat | dit bestand |
| 2 | Opslag | een hoofdstuk aanmaken geeft een bestand op schijf | `test_stap2_…` |
| 3 | Schrijfscherm, automatisch opslaan | tekst blijft staan na sluiten | `test_stap3_…` |
| 4 | Spellingscorrectie | opzettelijke fouten worden aangewezen | `test_stap4_…` |
| 5 | Taalsuggesties: herhaalde woorden met alternatieven | een herhaald woord wordt aangewezen met alternatieven | `test_stap5_…` |
| 6 | A5-PDF-export | PDF is exact A5 en de marges kloppen | `test_stap6_…` |
| 7 | Characters en maps | een character opslaan en zien in de hoofdstuklijst | `test_stap7_…` |
| 8 | Claude-chatpaneel | een vraag geeft een antwoord in het paneel | `test_stap8_…` (nagebootste Claude) |
| 9 | Testboek: 3 hoofdstukken, 1 character, 1 map | PDF klopt en spelling werkt | `test_stap9_…` |

Daarnaast met de hand in een echte browser nagelopen: typen, rode onderstreping, klikken op een fout en vervangen, herhalingen markeren, herladen, character en map toevoegen, PDF maken.

## Risico's en grenzen

- Spelling vangt geen fouten in zinsbouw of logica, en geen bestaande woorden op de verkeerde plek (*word/wordt*).
- Herhalingen werkt op letterlijke woordvormen; de synoniemenlijst is klein (± 100 woorden) en uitbreidbaar.
- WeasyPrint heeft op Windows een extra installatie (Pango via MSYS2) nodig. Zonder die stap werkt alleen het afdrukvoorbeeld.
- Claude-knop: niet getest tegen de echte API in deze sessie (geen sleutel). De aanroep volgt de SDK; test de eerste keer met een kleine vraag en kijk naar de getoonde kosten.

## Later

- Tekenen van maps.
- Stam-herkenning bij herhalingen (*keek/kijkt*).
- Lopende kopteksten (boektitel links, hoofdstuktitel rechts).
