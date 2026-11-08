# Chrome Ledger: werkplan

Dit plan wordt elke ronde bijgewerkt: wat af is gaat naar "Gedaan", nieuwe punten uit eigen kritiek komen onderaan "Open" met een datum.

## Spelregels voor mezelf
- **Eerst repareren en verduidelijken, dan pas uitbreiden.** Per ronde hoogstens één nieuw systeem. Elke derde ronde is een opruimronde: bugs, teksten, schermen.
- **Meten, niet gokken.** Elke balanswijziging wordt gemeten met `tests/balans.js` (150 spellen) vóór en na. Cijfers in de README zijn echte metingen, met de steekproefgrootte erbij.
- **Eerlijk over de grenzen.** De testbots zijn geen spelers: ze negeren heat, breiden niet uit naar andere continenten en gebruiken de GM niet. Een goed bot-cijfer betekent niet dat het spel leuk is. De GM-functies zijn alleen met een nagebootste GM getest; echte speelervaring van de gebruiker weegt zwaarder dan elke meting.
- **Niet doen:** engine.js opsplitsen in modules, tests in het artifact stoppen, nieuwe systemen bouwen terwijl een bestaand systeem onduidelijk is.

## Waar het spel nu staat (3.4)
Sterk: veel systemen, een echt einde met eerlijke score, de GM als ontwerper en verteller, saveslots, tests.
Zwak:
1. **Balans hangt aan één knop.** Moeilijkheid is vooral een kostenfactor. Een passieve speler overleeft Casual bijna altijd; op Realistisch eindigt 38% van de verstandige spellen in een razzia.
2. **Te veel tegelijk voor een nieuwe speler.** Twaalf tabs, tientallen knoppen, een volle inbox. De eerste tien minuten zijn zwaar; "starten zonder basis is wazig" zei de playtest.
3. **Opslag en fouten zijn stil.** Een mislukte back-up of een fout in een vangnet merk je niet.
4. **Telefoon** is bruikbaar maar krap: statusbalk kapt af, toasts vallen over de GM-knop.
5. **De GM is nog een chatvenster.** Hij vertelt, maar plant niet: rivalen en syndicaten hebben geen eigen verhaal dat over maanden loopt.

## Open (in volgorde)
### 3.5 Druk uit de wereld (balans)
- Rivalen eten je markt op als je stilstaat (marktaandeel schuift naar wie investeert).
- Lonen en huur stijgen per tijdperk; producten verouderen sneller zonder nieuwe versies.
- Razzia-lek: heat-opbouw tegenover de waarschuwingen nakijken. Ligt het aan de bot (die heat negeert), dan de bot verbeteren en dat zo melden.
- Doel (verstandige bot): Casual ±70%, Realistisch ±35%, Genadeloos ±10% winst; passief Casual overleeft 20 jaar zelden zonder krimp; geen dood vóór maand 24 op Realistisch.

### 3.6 Opslag en fouten
- `backup()` faalt luid (toast + opslagkaart), maximaal 6 lokale slots met een duidelijke melding.
- Kleinere saves: de vaste wereld niet in elke save; meten vóór en na (135 KB start, 194 KB na 20 jaar).
- De 19 lege catch-blokken schrijven naar een foutlog onder Logboek.

### 3.7 Rust en eerste stappen (opruimronde)
- Eerste stappen: een kaart voor de eerste drie maanden met 4 concrete stappen (eerste product, crew inzetten, een contract, volgende maand), die verdwijnt als ze af zijn.
- Inbox rustiger: kleine meldingen gebundeld in het maandrapport.
- Telefoon: statusbalk, roze-op-cyaan chip, toasts boven de GM-knop.
- Kaartlabels in Europa; aria in inbox en kaart.

### 3.8 De GM plant mee
- Snelknoppen in het GM-venster: "Wat nu?", "Wat kost dit?", "Vat mijn maand samen".
- Plannen van rivalen en syndicaten over meerdere maanden (GM schrijft het plan, de engine voert de stappen uit binnen grenzen, met een vaste versie als de GM niet live is). Je kunt ze ontdekken via crew of netwerk en verstoren.

### 3.9 Diepgang waar het al leeft
- Abonnementen: prijsverhoging, gebeurtenis rond opzeggers, loyaliteitsprogramma.
- Dochters-overzicht: overgenomen bedrijven bekijken en later alsnog samenvoegen of verkopen.
- Bedrijfsfocus: een kleine boom met keuzes die elke paar maanden een vaste bonus geven.

### Testinfrastructuur (doorlopend)
- Expansie-bot in balans.js om hegemonie echt te meten.
- Een "speel 24 maanden als mens"-run met screenshots per ronde, om zelf kritisch te kijken.

## Gedaan
- 3.4 Eerlijk einde: winstdrempel per speellengte, haalbare hegemonie en Marktmeester, score met wortel van de waarde, verlies nooit boven overleven.
- 3.3.1 Na de playtest: abonnees, overname koppelen, startideeën, GM-venster op elk scherm.
- 3.3 De GM ontwerpt divisies en schrijft verhaalbogen.
