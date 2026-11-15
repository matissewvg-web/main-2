// Gevechtsscenario-generator: gewogen tabellen + lagen, volledig bepaald door context en seed.
import { maakRng } from './rng.js';

export const RULESETS = {
  fow: {
    naam: 'Flames of War', punten: 100, opties: [50, 75, 100, 125, 150], eenheid: 'punten',
    winst: 'Je wint door een objective te houden aan het begin van je eigen beurt, of doordat de formatie van de tegenstander breekt.',
    marge: 'Voor de campagne telt alleen wie won. Haalt niemand zijn doel voor de laatste beurt, dan houdt de verdediger de regio.',
    reserve: 'Reserves volgens de regels van de missie; komen aan via de aangegeven rand.',
    nacht: 'Gebruik de nachtregels (Night Fighting): werp voor de zichtafstand.',
    ingegraven: 'Infanterie en geschut beginnen in Foxholes en Gone to Ground.',
  },
  bg: {
    naam: 'Battlegroup', punten: 500, opties: [350, 500, 750, 1000, 1500], eenheid: 'punten',
    winst: 'Je wint zodra het totaal aan getrokken chits van de tegenstander zijn Battle Rating overschrijdt. Een objective innemen dwingt de tegenstander een chit te trekken.',
    marge: 'Voor de campagne telt alleen wie won. Breken beide kanten in dezelfde beurt of is de beurtlimiet bereikt, dan houdt de verdediger de regio.',
    reserve: 'Reserves komen aan volgens de scenarioregels (worp per beurt) via de aangegeven rand.',
    nacht: 'Gebruik de nachtregels: beperkt zicht en geen luchtsteun.',
    ingegraven: 'Infanterie en geschut beginnen in versterkte posities (dug-in) en op Ambush Fire.',
  },
};

// obj = sleutel voor de plaatsing van objectives op de tafelmap (tafel.js)
export const SCENARIOTYPES = {
  doorbraak: { naam: 'Doorbraak', wanneer: 'aanval op een frontregio', obj: 'diep', opst: [['lang', 3], ['diagonaal', 2], ['kort', 1]], beurten: [6, 8], fow: 'Breakthrough', bg: 'Attack / Counter-Attack',
    doel: 'De aanvaller moet objectives diep in vijandelijk gebied innemen.',
    winA: 'Houd vanaf beurt 3 aan het begin van je beurt één van de twee objectives in de diepe zone.', winV: 'Houd beide objectives vrij tot het einde van beurt {n}.',
    regels: ['reserves_v'],
    brA: 'De linie van {V} bij {R} is dun. Stoot door, negeer wat op je flanken blijft staan en neem de kruispunten achter het front.', brV: '{A} breekt door bij {R}. Je hoofdmacht is onderweg: houd de toegangen dicht tot je reserves er zijn.' },
  houden: { naam: 'Ingraven en houden', wanneer: 'verdediger heeft versterkt', obj: 'houden', opst: [['lang', 4], ['kort', 1]], beurten: [6, 8], fow: 'No Retreat', bg: 'Defence Line',
    doel: 'De verdediger houdt de objectives tot de laatste beurt.',
    winA: 'Houd aan het begin van je beurt één objective zonder vijand binnen 4″ / 10 cm.', winV: 'Houd beide objectives tot het einde van beurt {n}.',
    regels: ['ingegraven_v', 'mijnen1', 'reserves_v'],
    brA: '{V} heeft zich ingegraven rond {R}. Het wordt een frontale aanval: vind het zwakke punt en zet daar alles op.', brV: 'Je stellingen bij {R} zijn klaar. Geen stap terug: elke beurt die je wint, is een beurt voor het front achter je.' },
  bruginnemen: { naam: 'Brug innemen', wanneer: 'regio met rivier of brug', obj: 'brug', opst: [['lang', 5], ['kort', 1]], beurten: [6, 8], fow: 'Bridgehead', bg: 'Bridge Assault',
    doel: 'Controle over de brug aan het einde van het gevecht.',
    winA: 'Heb aan het einde van beurt {n} een eenheid op of binnen 4″ / 10 cm van de brug en geen vijand daar.', winV: 'Verhinder dat: houd zelf de brug of betwist hem aan het einde van beurt {n}.',
    regels: ['rivier', 'reserves_v'],
    brA: 'De brug bij {R} moet heel in onze handen komen, voor de pantsers aankomen. Snelheid boven alles.', brV: 'Zonder de brug bij {R} staat {A} stil voor het water. Houd hem, en hou de oever vrij.' },
  brugopblazen: { naam: 'Brug opblazen', wanneer: 'verdediger verliest de regio waarschijnlijk', obj: 'brug', opst: [['lang', 4], ['kort', 1]], beurten: [5, 7], fow: 'Bridgehead (variant)', bg: 'Bridge Demolition',
    doel: 'De verdediger moet zijn genie bij de brug krijgen en hem opblazen.',
    winA: 'De brug staat nog aan het einde van beurt {n}, of je houdt hem met een eenheid erop.', winV: 'Houd een genie-eenheid (of een infanterie-eenheid als je geen genie hebt) twee volle beurten aaneen tegen de brug. Dan gaat hij de lucht in.',
    regels: ['rivier', 'genie'],
    brA: '{V} trekt zich terug over de rivier bij {R} en wil de brug vernietigen. Neem hem intact.', brV: 'We kunnen {R} niet houden. Breng de genie naar de brug en blaas hem op voor {A} eroverheen rolt.' },
  stad: { naam: 'Stad zuiveren', wanneer: 'stedelijke regio', obj: 'sectoren', opst: [['kort', 2], ['hoeken', 2], ['lang', 2]], beurten: [7, 9], fow: 'City Fight / Free-for-All', bg: 'Urban Assault',
    doel: 'De meeste sectoren of gebouwen bezetten.',
    winA: 'Bezit aan het einde van beurt {n} meer sectoren dan de verdediger.', winV: 'Bezit aan het einde van beurt {n} minstens evenveel sectoren als de aanvaller.',
    regels: ['sectoren', 'puin'],
    brA: 'Huis voor huis door {R}. Tanks alleen met infanterie ernaast; elke kelder kan een antitankploeg verbergen.', brV: 'Elke straat in {R} is een schietbaan, elk blok een fort. Laat {A} betalen voor iedere gevel.' },
  ontmoeting: { naam: 'Ontmoetingsgevecht', wanneer: 'beide landen vallen elkaar aan', obj: 'centraal', opst: [['lang', 3], ['diagonaal', 2], ['hoeken', 2]], beurten: [6, 8], fow: 'Free-for-All / Encounter', bg: 'Meeting Engagement',
    doel: 'Centrale objectives, gelijke opstelling: beide kanten zijn aanvaller.',
    winA: 'Houd aan het begin van je beurt een objective op de helft van de tegenstander.', winV: 'Houd aan het begin van je beurt een objective op de helft van de tegenstander.',
    regels: ['reserves_beide', 'gelijk'],
    brA: 'Onze voorhoede botst bij {R} op die van {V}. Niemand is ingegraven. Wie eerst het kruispunt heeft, bepaalt het gevecht.', brV: 'Onze voorhoede botst bij {R} op die van {A}. Niemand is ingegraven. Wie eerst het kruispunt heeft, bepaalt het gevecht.' },
  achterhoede: { naam: 'Achterhoede', wanneer: 'verdediger verloor de vorige beurt', obj: 'rand_v', opst: [['lang', 3], ['kort', 2]], beurten: [6, 7], fow: 'Rearguard', bg: 'Rearguard Action',
    doel: 'De verdediger moet zijn eenheden van de tafel krijgen.',
    winA: 'Vernietig of houd meer dan de helft van de vijandelijke eenheden op tafel aan het einde van beurt {n}.', winV: 'Breng minstens de helft van je eenheden via je eigen rand van tafel. Vanaf beurt 3 mag je per beurt één eenheid afvoeren.',
    regels: ['aftocht'],
    brA: '{V} is op de terugtocht bij {R}. Zit erbovenop: wat nu ontsnapt, staat morgen weer voor je.', brV: 'Het front is gebroken. Jouw taak bij {R}: de vijand ophouden en daarna zelf wegkomen, in die volgorde.' },
  konvooi: { naam: 'Konvooi', wanneer: 'regio is afgesneden', obj: 'konvooi', opst: [['lang', 3], ['hoeken', 1]], beurten: [6, 7], fow: 'Convoy (eigen missie)', bg: 'Supply Column',
    doel: 'Een konvooi over de tafel krijgen, of tegenhouden.',
    winA: 'Vernietig of blokkeer het konvooi: minder dan de helft van de voertuigen haalt de overkant.', winV: 'Breng minstens de helft van de 4 konvooivoertuigen via de weg naar de uitgang.',
    regels: ['konvooi'],
    brA: '{R} is afgesneden en teert op wat er nog doorheen glipt. Onderschep de colonne.', brV: 'De troepen in {R} zitten zonder brandstof en munitie. Dit konvooi moet erdoor, wat het ook kost.' },
  raid: { naam: 'Raid', wanneer: 'kleine of onverdedigde regio, commando\'s of partizanen', obj: 'doelwitten', opst: [['hoeken', 2], ['kort', 2], ['midden', 2]], beurten: [5, 6], fow: 'Raid (halve punten)', bg: 'Raid',
    doel: 'Snel een doel vernietigen. Kleiner gevecht.', klein: true,
    winA: 'Vernietig 2 van de 3 doelwitten (eindig je beweging ertegen en blijf een volle beurt) en verlaat de tafel voor het einde van beurt {n}.', winV: 'Behoud minstens 2 doelwitten.',
    regels: ['halvepunten', 'schildwachten'],
    brA: 'Snel erin, snel eruit. De doelen bij {R} zijn licht bewaakt, maar de versterking is dichtbij.', brV: 'Een rustige nacht bij {R}, dachten we. Sla alarm en houd ze weg van de depots tot de reserve er is.' },
  strandlanding: { naam: 'Strandlanding', wanneer: 'amfibische order op een kustregio', obj: 'uitgangen', opst: [['strand', 1]], beurten: [7, 8], fow: 'Hit the Beach', bg: 'Beach Assault',
    doel: 'De aanvaller moet de stranduitgangen nemen.',
    winA: 'Houd aan het einde van beurt {n} twee van de drie stranduitgangen.', winV: 'Houd aan het einde van beurt {n} minstens twee stranduitgangen.',
    regels: ['landing', 'bombardement', 'bunkers', 'draad', 'mijnen1'],
    brA: 'De klep gaat neer op het strand van {R}. Blijf niet liggen op het zand: de uitgangen door de duinen zijn de enige weg.', brV: 'Ze komen. Alles wat op het strand van {R} blijft liggen, is geen gevaar meer. Houd de uitgangen dicht.' },
  luchtlanding: { naam: 'Luchtlanding', wanneer: 'parachutisten-order', obj: 'verzamel', opst: [['verspreid', 1]], beurten: [6, 8], fow: 'Airborne Assault (eigen missie)', bg: 'Airborne Drop',
    doel: 'Een verspreide aanvaller moet objectives verzamelen en houden.',
    winA: 'Houd aan het einde van beurt {n} twee van de drie objectives.', winV: 'Houd aan het einde van beurt {n} minstens twee objectives.',
    regels: ['drop', 'geenzwaar', 'reserves_v'],
    brA: 'Groen licht boven {R}. Je landt verspreid: verzamel, neem de doelen en houd ze tot de grondtroepen aansluiten.', brV: 'Parachutes boven {R}. Ze zijn licht bewapend en nog niet verzameld: sla toe voor ze zich ingraven.' },
  uitbreken: { naam: 'Omsingeling uitbreken', wanneer: 'regio is volledig ingesloten', obj: 'uitbraak', opst: [['midden', 3], ['lang', 1]], beurten: [6, 7], fow: 'Breakout (eigen missie)', bg: 'Breakout',
    doel: 'De ingesloten verdediger moet door een tafelrand uitbreken.',
    winA: 'Laat minder dan een derde van de vijandelijke eenheden ontsnappen.', winV: 'Breng minstens een derde van je eenheden via de uitbraakrand van tafel voor het einde van beurt {n}.',
    regels: ['uitbraak', 'schaars'],
    brA: 'De ketel rond {R} zit dicht. Ze zullen het vannacht of morgen proberen: houd de ring gesloten.', brV: 'We zijn omsingeld bij {R} en de voorraad raakt op. Eén richting, alles tegelijk: breek uit.' },
  ontzet: { naam: 'Ontzet', wanneer: 'eigen regio ernaast is ingesloten', obj: 'corridor', opst: [['kort', 3], ['lang', 2]], beurten: [6, 8], fow: 'Relief (eigen missie)', bg: 'Relief Column',
    doel: 'De aanvaller moet een corridor openen naar de ingesloten troepen.',
    winA: 'Heb aan het einde van beurt {n} een onafgebroken reeks eenheden of een vrije weg van je eigen rand tot het ontzet-objective.', winV: 'Houd de corridor dicht tot het einde van beurt {n}.',
    regels: ['corridor', 'reserves_v'],
    brA: 'Onze mannen naast {R} zitten ingesloten. Sla een corridor en houd hem open; morgen kan het te laat zijn.', brV: 'Ze proberen de ketel te ontzetten via {R}. Zolang deze weg dicht blijft, is de buit van ons.' },
  tegenaanval: { naam: 'Tegenaanval', wanneer: 'verdediger won de vorige beurt', obj: 'snel', opst: [['lang', 3], ['diagonaal', 2]], beurten: [5, 7], fow: 'Counterattack', bg: 'Counter-Attack',
    doel: 'Snelle aanval op een vijand die nog niet is ingegraven.',
    winA: 'Houd aan het begin van je beurt een objective in de zone van de verdediger.', winV: 'Houd beide objectives tot het einde van beurt {n}.',
    regels: ['nietingegraven_v', 'verspreid_v'],
    brA: 'Hun aanval is vastgelopen en ze staan nog in het open veld bij {R}. Nu terugslaan, voor ze graven.', brV: 'De aanval is afgeslagen en nu komen ze zelf. Niemand is ingegraven: maak een linie van wat je hebt.' },
  linie: { naam: 'Linie doorbreken', wanneer: 'versterkte linie', obj: 'bunkers', opst: [['lang', 1]], beurten: [7, 9], fow: 'Fortified Assault / No Retreat', bg: 'Fortified Line',
    doel: 'De aanvaller moet bunkers en mijnenvelden doorbreken.',
    winA: 'Houd aan het einde van beurt {n} een objective achter de bunkerlinie, of schakel alle bunkers uit.', winV: 'Houd beide objectives achter de linie tot het einde van beurt {n}.',
    regels: ['bunkers', 'mijnen2', 'draad', 'ingegraven_v', 'bombardement'],
    brA: 'De {L} bij {R}: beton, draad en mijnen. Genie voorop, rook op de schietgaten, en dan door de bres.', brV: 'De {L} is gebouwd voor deze dag. Laat ze in het draad hangen en schiet ze van de mijnenvelden.' },
  nacht: { naam: 'Nachtaanval', wanneer: 'gekozen of gerold', obj: 'diep', opst: [['lang', 3], ['kort', 1]], beurten: [6, 7], fow: 'Breakthrough bij nacht', bg: 'Night Attack',
    doel: 'Beperkt zicht, verrassingsvoordeel voor de aanvaller.',
    winA: 'Houd aan het begin van je beurt een objective in de zone van de verdediger.', winV: 'Houd beide objectives tot het einde van beurt {n}.',
    regels: ['nacht', 'verrassing'],
    brA: 'Geen artillerie vooraf, geen lichten, geen geluid. Bij {R} sluipen we tot op handgranaatafstand.', brV: 'Het is te stil bij {R}. Verdubbel de wachtposten; wie vuurt, verraadt zijn positie.' },
};

export const OPSTELLINGEN = {
  lang: 'Lange tafelzijden: elk een strook langs de eigen lange rand.',
  kort: 'Korte tafelzijden: elk een strook langs de eigen korte rand, het gevecht loopt over de lengte van de tafel.',
  diagonaal: 'Diagonaal: elk een driehoek in tegenoverliggende hoeken.',
  hoeken: 'Hoeken: elk een tafelkwart, schuin tegenover elkaar.',
  midden: 'Verdediger in het midden, aanvaller vanaf beide korte randen.',
  strand: 'Strand: de aanvaller komt vanaf de zeerand, de verdediger staat achter de duinen.',
  verspreid: 'Verspreid: de aanvaller landt in dropzones, de verdediger staat rond de objectives en langs zijn rand.',
};

const REGELTEKST = {
  reserves_v: 'Reserves: de verdediger houdt minstens een derde van zijn leger in reserve.',
  reserves_beide: 'Reserves: beide kanten houden een derde van hun leger in reserve.',
  gelijk: 'Niemand is ingegraven. Werp wie eerst opstelt; die speelt ook de eerste beurt.',
  ingegraven_v: 'De verdediger begint ingegraven.',
  nietingegraven_v: 'De verdediger begint niet ingegraven en mag in beurt 1 niet graven.',
  verspreid_v: 'De verdediger stelt eerst op, elke eenheid minstens 8″ / 20 cm van een andere eigen eenheid.',
  mijnen1: 'Eén mijnenveld voor de verdediger.',
  mijnen2: 'Twee mijnenvelden voor de verdediger.',
  draad: 'Twee stroken prikkeldraad voor de verdediger.',
  bunkers: 'Bunkers: zie de tafelmap. Elke bunker is een versterkte MG- of antitankpost zonder puntenkost.',
  bombardement: 'Voorbereidend bombardement: vóór beurt 1 werpt de aanvaller voor elke vijandelijke eenheid op tafel; op 5+ begint die vastgepind.',
  rivier: 'De rivier is alleen over te steken via de brug en de doorwaadbare plaats.',
  genie: 'Elke infanterie-eenheid met genie- of pioniersregel telt als genie.',
  sectoren: 'Sectoren: elk gemarkeerd gebouw of blok is een sector. Je bezit een sector als alleen jij er eenheden in of tegen hebt.',
  puin: 'Straten vol puin: voertuigen buiten de weg bewegen als in moeilijk terrein.',
  aftocht: 'De verdediger stelt alles op tafel op, geen reserves. De aanvaller speelt de eerste beurt.',
  konvooi: 'Konvooi: 4 vrachtwagens (geen puntenkost) starten bij de ingang en volgen de weg. Ze schieten niet en tellen niet als eenheid.',
  halvepunten: 'Klein gevecht: beide kanten spelen met de helft van het puntentotaal.',
  schildwachten: 'De verdediger stelt eerst op. De aanvaller kiest daarna zijn rand en speelt de eerste beurt.',
  landing: 'Landing: de aanvaller komt in golven vanaf de zeerand. Golf 1 in beurt 1, de rest als reserve.',
  drop: 'Dropzones: plaats elke eenheid in een dropzone en verschuif haar 2D6″ (×2,5 cm) in een willekeurige richting. Wie buiten de tafel landt, komt als reserve.',
  geenzwaar: 'De aanvaller heeft geen tanks of zwaar geschut op tafel; die komen pas als reserve vanaf beurt 4.',
  uitbraak: 'De uitbraakrand staat op de tafelmap. De verdediger speelt de eerste beurt.',
  schaars: 'Munitie is schaars: de artillerie van de verdediger mag maar om de beurt vuren.',
  corridor: 'Het ontzet-objective ligt aan de rand van de verdediger. De ingesloten troepen zelf doen niet mee.',
  nacht: 'Nacht tot en met beurt 3; werp daarna elke beurt: op 5+ wordt het licht.',
  verrassing: 'Verrassing: de verdediger mag in beurt 1 niet bewegen en vuurt als vastgepind.',
};

function vul(t, m) { return t.replace(/\{(\w+)\}/g, (_, k) => (m[k] !== undefined ? m[k] : '')); }

// Gewichten per scenariotype voor een gegeven context. Los te testen.
export function scenarioGewichten(c) {
  const r = c.regio, V = c.V || {}, A = c.A || {};
  const brug = r.infra.includes('brug') || r.terrein === 'rivier';
  const w = {};
  if (c.soort === 'ontmoeting') return { ontmoeting: 1 };
  if (c.soort === 'raid') return { raid: 1 };
  if (c.soort === 'landing') return { strandlanding: 1 };
  if (c.soort === 'luchtlanding') return { luchtlanding: 1 };
  const mag = (t) => !((V.doctrines || []).includes('festung') && (t === 'achterhoede' || t === 'brugopblazen'));
  w.doorbraak = 3 + (r.fort === 0 ? 2 : 0);
  w.houden = (r.fort >= 1 || V.versterkt || V.verdedigt) ? 3 + r.fort + (V.versterkt ? 2 : 0) + (V.verdedigt ? 1 : 0) : 0.5;
  w.bruginnemen = brug ? 6 : 0;
  w.brugopblazen = brug && mag('brugopblazen') ? (V.afgesneden || V.verloorVorige ? 4 : 1) : 0;
  w.stad = r.terrein === 'stad' ? 8 : (r.infra.includes('stad') ? 2 : 0);
  w.achterhoede = V.verloorVorige && mag('achterhoede') && r.fort < 2 ? 4 : 0;
  w.konvooi = V.afgesneden && !V.ingesloten ? 6 : 0;
  w.raid = r.waarde <= 1 && r.fort === 0 && !V.versterkt ? 1 : 0;
  w.uitbreken = V.ingesloten ? 9 : 0;
  w.ontzet = c.ontzet ? 8 : 0;
  w.tegenaanval = A.tegenaanval ? 7 : 0;
  w.linie = r.fort >= 3 ? 10 : 0;
  w.nacht = 1;
  if (r.fort >= 3) { w.doorbraak = 0.5; w.raid = 0; }
  if (c.omstreden > 0) { w.stad *= 1.5; w.houden += 1; }
  return w;
}

function tijdEnWeer(c, type, rng) {
  const g = c.grond || 'normaal';
  let tijd = rng.gewogen([{ k: 'dag', w: 60 }, { k: 'dageraad', w: 16 }, { k: 'schemer', w: 10 }, { k: 'nacht', w: type === 'raid' ? 20 : 4 }]).k;
  if (type === 'nacht') tijd = 'nacht';
  if (type === 'strandlanding') tijd = 'dageraad';
  const weerOpties = g === 'sneeuw' ? [{ k: 'sneeuwval', w: 30 }, { k: 'bewolkt', w: 40 }, { k: 'helder', w: 20 }, { k: 'mist', w: 10 }]
    : g === 'modder' ? [{ k: 'regen', w: 45 }, { k: 'bewolkt', w: 35 }, { k: 'mist', w: 10 }, { k: 'helder', w: 10 }]
      : g === 'droog' ? [{ k: 'helder', w: 70 }, { k: 'stofstorm', w: 12 }, { k: 'bewolkt', w: 18 }]
        : [{ k: 'helder', w: 45 }, { k: 'bewolkt', w: 30 }, { k: 'regen', w: 12 }, { k: 'mist', w: 13 }];
  let weer = rng.gewogen(weerOpties).k;
  if (c.geenLucht && weer === 'helder') weer = 'bewolkt';
  const eff = [];
  const TIJD = { dag: 'Dag', dageraad: 'Dageraad', schemer: 'Schemer', nacht: 'Nacht' };
  const WEER = { helder: 'helder', bewolkt: 'bewolkt', regen: 'regen', mist: 'mist', sneeuwval: 'sneeuwval', stofstorm: 'stofstorm' };
  if (tijd === 'dageraad') eff.push('Dageraad: beurt 1 en 2 gelden als nacht, daarna is het licht.');
  if (tijd === 'schemer') eff.push('Schemer: vanaf beurt 5 geldt nacht.');
  if (tijd === 'nacht' && type !== 'nacht') eff.push('Nacht: het hele gevecht gelden de nachtregels. ' + RULESETS[c.ruleset].nacht);
  if (weer === 'mist') eff.push('Mist: zicht maximaal 16″ / 40 cm tot en met beurt 3. Geen luchtsteun.');
  if (weer === 'regen') eff.push('Regen: geen luchtsteun. Voertuigen buiten de weg bewegen 2″ / 5 cm trager.');
  if (weer === 'sneeuwval') eff.push('Sneeuwval: zicht maximaal 24″ / 60 cm. Geen luchtsteun.');
  if (weer === 'stofstorm') eff.push('Stofstorm: zicht maximaal 16″ / 40 cm in beurt 1 tot 3. Geen luchtsteun.');
  if (g === 'sneeuw') eff.push('Sneeuw: open terrein is moeilijk terrein voor wielvoertuigen; infanterie beweegt 2″ / 5 cm trager.');
  if (g === 'modder') eff.push('Modder: buiten de weg bewegen voertuigen als in moeilijk terrein en lopen ze vast op een 1.');
  if (g === 'droog') eff.push('Droog en stoffig: voertuigen die meer dan de helft van hun beweging doen, verliezen hun verborgen status.');
  const lucht = !(tijd === 'nacht' || weer !== 'helder' && weer !== 'bewolkt' || c.geenLucht);
  return { tijd, weer, tijdNaam: TIJD[tijd], weerNaam: WEER[weer], effecten: eff, luchtKan: lucht, slechtWeer: weer !== 'helder' && weer !== 'bewolkt' };
}

// Voordelen zonder punten: uit versterking, orders, bevoorrading en doctrines van beide kanten.
function voordelen(c, type, tw, rng) {
  const A = c.A, V = c.V, r = c.regio;
  const vA = [], vV = [];
  const zetA = (bron, tekst) => vA.push({ bron, tekst });
  const zetV = (bron, tekst) => vV.push({ bron, tekst });
  const ont = type === 'ontmoeting';
  const winterWeer = c.grond === 'sneeuw' || c.grond === 'modder';

  if (!ont) {
    if (r.fort === 1) zetV('Versterking', 'Ingegraven: infanterie en geschut van de verdediger beginnen ingegraven.');
    if (r.fort === 2) zetV('Versterking', 'Fort: ingegraven, plus één bunker en één strook prikkeldraad.');
    if (r.fort >= 3 && type !== 'linie') zetV('Versterking', (r.linie || 'Linie') + ': ingegraven, twee bunkers, een mijnenveld en prikkeldraad.');
    if (V.versterkt) zetV('Order: versterken', 'Eén extra eenheid uit de vaste reservelijst komt als reserve aan vanaf beurt 2.');
    if (V.verdedigt) zetV('Order: verdedigen', 'De verdediger kiest de tafelkant en krijgt voorbereide posities voor één eenheid.');
    if (V.recon) zetV('Recon', 'De verdediger zag de aanval komen: hij mag na de opstelling van de aanvaller één eenheid verplaatsen.');
    if (A.recon) zetA('Order: recon', 'De aanvaller kent het terrein: de verdediger stelt eerst en volledig op, zonder verborgen eenheden.');
    if (A.steun) zetA('Gezamenlijke aanval', 'Een bondgenoot valt mee aan: één eenheid mag via een flankrand binnenkomen vanaf beurt 2.');
    if (A.voorbereid) { zetA('Set-piece', 'Voorbereide aanval: voorbereidend bombardement en één extra eenheid uit de vaste reservelijst.'); }
    if (A.diepFlank) zetA('Diepe operatie', 'Gekoppelde aanvallen: één eenheid mag via een flankrand binnenkomen vanaf beurt 2.');
    if (V.afgesneden && !V.altijdBevoorraad) zetA('Bevoorrading', 'De verdediger is afgesneden: zijn artillerie vuurt maar om de beurt en hij heeft geen luchtsteun.');
    if (A.afgesneden) zetV('Bevoorrading', 'De aanvaller valt aan vanuit een afgesneden regio: zijn reserves komen een beurt later.');
    if (A.zwak) zetV('Vastgelopen aanval', 'De aanvaller heeft zich hier net stukgelopen: de verdediger mag één eenheid in hinderlaag houden.');
  }
  if (c.omstreden > 0) zetV('Vervolggevecht', 'De verdediger kent het slagveld: hij plaatst één objective 6″ / 15 cm naar keuze.');

  // doctrines aanvaller
  const hA = (d) => (A.doctrines || []).includes(d), hV = (d) => (V.doctrines || []).includes(d);
  if (hA('blitzkrieg') && !ont) {
    if (A.afgesneden) zetV('Blitzkrieg (nadeel)', 'De speerpunt staat droog: de verdediger mag één eenheid in hinderlaag houden.');
    else zetA('Blitzkrieg', 'De aanvaller stelt als tweede op en speelt de eerste beurt.');
  }
  if (hV('blitzkrieg') && V.afgesneden && !ont) zetA('Blitzkrieg (nadeel)', 'De afgesneden verdediger wordt verrast: de aanvaller mag één eenheid in hinderlaag houden.');
  if (hA('auftragstaktik')) zetA('Auftragstaktik', 'Eén eenheid mag zich vóór beurt 1 herpositioneren binnen de opstelzone.');
  if (hV('auftragstaktik')) zetV('Auftragstaktik', 'Eén eenheid mag zich vóór beurt 1 herpositioneren binnen de opstelzone.');
  if (hV('elastisch') && !ont) zetV('Elastische verdediging', 'Tot de helft van het leger mag in reserve blijven en komt via de eigen rand binnen.');
  if (hV('festung') && !ont) {
    if (r.terrein === 'stad' || r.infra.includes('stad')) zetV('Festung', 'Gratis voorbereide posities voor alle infanterie en geschut.');
    zetA('Festung (nadeel)', 'De verdediger mag geen eenheid vrijwillig van tafel halen.');
  }
  if (hA('diepeoperatie') && !ont) zetA('Diepe operatie', 'Tweede golf: één vernietigde eenheid komt één keer terug als reserve via de eigen rand.');
  if (hV('diepeoperatie') && V.vielNetAan && !ont) zetA('Diepe operatie (nadeel)', 'De verdediger viel vorige beurt aan en is niet ingegraven, ook niet door versterking.');
  if (hA('massa')) zetA('Massa en volharding', 'Eén vernietigd peloton komt één keer terug vanaf de eigen tafelrand.');
  if (hV('massa')) zetV('Massa en volharding', 'Eén vernietigd peloton komt één keer terug vanaf de eigen tafelrand.');
  if (hA('partizanen') && A.thuis) zetA('Partizanen', 'Eén vijandelijke reserve komt een beurt later aan.');
  if (hV('partizanen') && V.thuis && !ont) zetV('Partizanen', 'Eén vijandelijke reserve komt een beurt later aan.');
  if (winterWeer) {
    if (hA('winter')) zetA('Generaal Winter', 'Geen weernadelen voor jou; de vijand beweegt door open terrein als door moeilijk terrein.');
    if (hV('winter')) zetV('Generaal Winter', 'Geen weernadelen voor jou; de vijand beweegt door open terrein als door moeilijk terrein.');
  }
  if (r.terrein === 'woestijn') {
    if (hA('woestijnratten')) zetA('Woestijnratten', 'Eén eenheid mag via een flankrand binnenkomen vanaf beurt 2.');
    if (hV('woestijnratten')) zetV('Woestijnratten', 'Eén eenheid mag via een flankrand binnenkomen vanaf beurt 2.');
  }
  if (hA('commandos') && type === 'raid') zetA('Commando\'s', 'Je kiest de tafelrand en stelt verborgen op; de verdediger mag in beurt 1 niet vuren op meer dan 8″ / 20 cm.');
  if (hA('vuurkracht')) zetA('Vuurkracht en logistiek', 'Eén keer per gevecht een extra artillerie- of luchtsteunbeurt.');
  if (hV('vuurkracht')) zetV('Vuurkracht en logistiek', 'Eén keer per gevecht een extra artillerie- of luchtsteunbeurt.');
  if (tw.luchtKan) {
    if (hA('luchtoverwicht')) zetA('Luchtoverwicht', 'Luchtsteun elke beurt, zonder puntenkost.');
    if (hV('luchtoverwicht')) zetV('Luchtoverwicht', 'Luchtsteun elke beurt, zonder puntenkost.');
  }
  if (hA('amfibisch') && type === 'strandlanding') zetA('Amfibische operaties', 'Scheepsgeschut: het voorbereidend bombardement pint op 4+ in plaats van 5+.');
  if (hA('rapido')) zetA('Guerra di rapido corso', 'Je snelle eenheden (verkenning, lichte tanks, gemotoriseerd) doen vóór beurt 1 een volledige beweging.');
  if (hA('cavalerie')) zetA('Cavalerie en snelle troepen', 'Je snelle eenheden (cavalerie, verkenning, lichte tanks) doen vóór beurt 1 een volledige beweging.');
  if (hV('cavalerie') && r.fort === 0 && !ont) zetA('Cavalerie (nadeel)', 'De verdediger is niet ingegraven.');
  if (hV('waterlinie') && r.terrein === 'rivier' && !ont) zetV('Waterlinie', 'Inundaties: voertuigen van de aanvaller bewegen buiten de weg als door moeilijk terrein.');
  const mottiTerrein = ['bos', 'moeras'].includes(r.terrein) || c.grond === 'sneeuw';
  if (hA('motti') && mottiTerrein) zetA('Motti-tactiek', 'Eén eenheid blijft in hinderlaag en mag vanaf beurt 2 via een flankrand binnenkomen.');
  if (hV('motti') && mottiTerrein) zetV('Motti-tactiek', 'Eén eenheid blijft in hinderlaag en mag vanaf beurt 2 via een flankrand binnenkomen.');
  if (hV('rapido') && r.fort === 0 && !ont) zetA('Rapido (nadeel)', 'De verdediger is niet ingegraven.');
  if (hV('bergverdediging') && ['heuvels', 'bergen'].includes(r.terrein) && !ont) zetV('Bergverdediging', 'Voorbereide posities op elke heuvel in de opstelzone.');
  if (hV('methodisch') && !ont) zetV('Methodische strijd', 'Een extra mijnenveld en één voorgeregistreerd artilleriedoel.');
  if (hV('ingraven') && !ont && r.fort === 0 && V.heleBeurt) zetV('Ingraven', 'Infanterie en geschut beginnen ingegraven en verborgen.');
  if (hA('reconinkracht') && !ont) zetA('Recon in kracht', 'Na de opstelling van de verdediger mag je één eigen eenheid verplaatsen.');
  if (c.geenLucht) { zetA('Weer', 'Geen luchtsteun deze beurt.'); zetV('Weer', 'Geen luchtsteun deze beurt.'); }
  return { vA, vV };
}

export function genereerScenario(c, seed) {
  const rng = maakRng('scn:' + seed);
  const gew = scenarioGewichten(c);
  let type = c.forceType;
  if (!type) type = rng.gewogen(Object.entries(gew).map(([k, w]) => ({ k, w }))).k;
  const T = SCENARIOTYPES[type];
  const opst = rng.gewogen(T.opst.map(([k, w]) => ({ k, w }))).k;
  const beurten = rng.int(T.beurten[0], T.beurten[1]);
  const tw = tijdEnWeer(c, type, rng);
  const { vA, vV } = voordelen(c, type, tw, rng);
  const m = { A: c.A.naam, V: c.V.naam, R: c.regio.naam, n: beurten, L: c.regio.linie || 'linie' };

  const regels = T.regels.map((k) => REGELTEKST[k]);
  if (type === 'nacht') regels.push(RULESETS[c.ruleset].nacht);
  const fortExtra = { bunkers: 0, mijnen: 0, draad: 0 };
  if (type === 'linie') { fortExtra.bunkers = 3; fortExtra.mijnen = 2; fortExtra.draad = 2; }
  else if (type === 'strandlanding') { fortExtra.bunkers = c.regio.fort >= 3 ? 3 : 2; fortExtra.mijnen = 1; fortExtra.draad = 2; }
  else if (type === 'houden') { fortExtra.mijnen = 1; }
  if (type !== 'linie' && type !== 'ontmoeting' && type !== 'strandlanding') {
    if (c.regio.fort === 2) { fortExtra.bunkers += 1; fortExtra.draad += 1; }
    if (c.regio.fort >= 3) { fortExtra.bunkers += 2; fortExtra.mijnen += 1; fortExtra.draad += 1; }
  }
  if ((c.V.doctrines || []).includes('methodisch') && type !== 'ontmoeting') fortExtra.mijnen += 1;

  // Wie stelt eerst op, wie begint
  let volgorde = 'De verdediger stelt eerst op. De aanvaller speelt de eerste beurt.';
  if (type === 'ontmoeting') volgorde = 'Werp: de winnaar stelt eerst één eenheid op, daarna om de beurt. De winnaar speelt de eerste beurt.';
  if (type === 'uitbreken') volgorde = 'De aanvaller (de ring) stelt eerst op. De verdediger speelt de eerste beurt.';
  if (type === 'achterhoede') volgorde = 'De verdediger stelt alles op. De aanvaller speelt de eerste beurt.';

  let verwijzing = '';
  if (c.omstreden > 0) {
    verwijzing = c.ruine ? `Dit is gevecht ${c.omstreden + 1} om ${c.regio.naam}. De verdediger zit nu in de ruïnes van het vorige gevecht.`
      : `Dit is gevecht ${c.omstreden + 1} om ${c.regio.naam}. Wrakken en kraters van het vorige gevecht liggen er nog: leg 2 extra stukken puin of krater neer.`;
  } else if (c.vorigeTekst) verwijzing = c.vorigeTekst;

  const klein = !!T.klein;
  const rs = RULESETS[c.ruleset];
  return {
    seed, type, naam: T.naam, doel: T.doel, obj: T.obj,
    opstelling: opst, opstellingTekst: OPSTELLINGEN[opst], volgorde,
    tijd: tw.tijd, weer: tw.weer, tijdNaam: tw.tijdNaam, weerNaam: tw.weerNaam, grond: c.grond || 'normaal',
    effecten: tw.effecten, luchtKan: tw.luchtKan,
    regels, voordelenA: vA, voordelenV: vV,
    beurten, winA: vul(T.winA, m), winV: vul(T.winV, m),
    briefingA: vul(T.brA, m), briefingV: vul(T.brV, m), verwijzing,
    analoog: c.ruleset === 'fow' ? T.fow : T.bg, ruleset: c.ruleset,
    punten: klein ? Math.round(c.punten / 2) : c.punten, klein,
    winst: rs.winst, marge: rs.marge, reserve: rs.reserve,
    fortExtra, gewichten: gew,
    ruine: !!c.ruine || c.omstreden > 0,
  };
}

// Kansverdeling voor "recon in kracht" en de recon-order: wat is hier waarschijnlijk?
export function scenarioKansen(c) {
  const g = scenarioGewichten(c);
  const tot = Object.values(g).reduce((s, x) => s + x, 0) || 1;
  return Object.entries(g).filter(([, w]) => w > 0).map(([k, w]) => ({ type: k, naam: SCENARIOTYPES[k].naam, kans: w / tot })).sort((a, b) => b.kans - a.kans);
}
