# Chrome Ledger

Beurtgebaseerde cyberpunk-corpo-simulatie in Nova Antwerpa, 2002+. Privé hobbyproject. Het volledige plan staat in [CHROME_LEDGER_PLAN.md](CHROME_LEDGER_PLAN.md); Mijlpaal 1 (kern) en 2 (kaart, districten, gebouwen) zijn gebouwd.

## Spelen

```
cd chrome-ledger
python3 -m http.server
```

Open **http://localhost:8000**. Dubbelklikken op `index.html` werkt niet (ES-modules en `fetch()` weigeren `file://`).

Het spel bewaart automatisch in de browser (localStorage). Met *Exporteer save* krijg je een `.json`-bestand dat je via het menu terug kan importeren.

## Balans aanpassen

Alle getallen staan in `data/`. De economie (lonen, marktinkomen, heat-afkoeling, eventkans, ...) staat in `data/balans.json`, de acties in `data/actions.json`, de gebouwen in `data/buildings.json`, de districttypes (naampool, startwaarden, plaatsing op de kaart) in `data/districts.json` en de events in `data/events/`. Pas één getal per testronde aan.

Check daarna met de simulator of geen enkele actie dominant is geworden:

```
node tools/sim.mjs 300 20     # 300 spellen, 20 beurten
node tools/sim.mjs 200 133    # volledige lengte, toont ook winstbeurt
```

## Event toevoegen

Voeg een object toe aan `data/events/basis.json` (of een nieuw bestand, en zet de naam in `data/events/index.json`). De effecttaal staat bovenaan `src/effects.js`. Geef elk event minstens één keuze zonder `vereist`, anders wordt het overgeslagen.
