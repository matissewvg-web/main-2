// Facties, periodes en kant-en-klare campagnescenario's.

import { EUROPA_GEO } from './europa-geo.js';

// leger: wat zet je op tafel? Landen zonder eigen Flames of War-leger krijgen een logisch alternatief.
export const FACTIES = {
  dui: { naam: 'Duitsland', kort: 'DUI', kleur: '#7c8791', zijde: 'as', doctrine: 'blitzkrieg', hoofdstad: 'berlijn', leger: 'Eigen Duitse lijsten in elke periode.' },
  ita: { naam: 'Italië', kort: 'ITA', kleur: '#3f9c8c', zijde: 'as', doctrine: 'rapido', hoofdstad: 'rome', leger: 'Eigen Italiaanse lijsten (Early en Mid war). Late war: Duits materieel voor de RSI.' },
  vk: { naam: 'Verenigd Koninkrijk', kort: 'VK', kleur: '#c9993a', zijde: 'geallieerd', doctrine: 'setpiece', hoofdstad: 'londen', leger: 'Eigen Britse lijsten in elke periode.' },
  vs: { naam: 'Verenigde Staten', kort: 'VS', kleur: '#6a9a45', zijde: 'geallieerd', doctrine: 'vuurkracht', leger: 'Eigen Amerikaanse lijsten (Mid en Late war).' },
  ussr: { naam: 'Sovjet-Unie', kort: 'USSR', kleur: '#c8503f', zijde: 'geallieerd', doctrine: 'massa', hoofdstad: 'moskou', leger: 'Eigen Sovjet-lijsten in elke periode.' },
  fra: { naam: 'Frankrijk', kort: 'FRA', kleur: '#4f7fc8', zijde: 'geallieerd', doctrine: 'methodisch', hoofdstad: 'parijs', leger: 'Eigen Franse lijst in Early war. Daarna Vrije Fransen: speel een Amerikaanse lijst (Sherman, M10, halftracks).' },
  pol: { naam: 'Polen', kort: 'POL', kleur: '#b85a86', zijde: 'geallieerd', doctrine: 'cavalerie', hoofdstad: 'warschau', leger: 'Eigen Poolse lijst in Early war. Daarna een Britse lijst (1e Pantserdivisie) of een Sovjet-lijst (Volksleger).' },
  ben: { naam: 'België en Nederland', kort: 'BENE', kleur: '#e08a3c', zijde: 'geallieerd', doctrine: 'waterlinie', leger: 'Geen eigen leger: speel een Franse Early war-infanterielijst met pantserwagens en licht antitankgeschut, zonder middelzware tanks.' },
  bel: { naam: 'België', kort: 'BEL', kleur: '#b98b5e', zijde: 'neutraal', doctrine: 'methodisch', hoofdstad: 'belgie', leger: 'Geen eigen leger: speel een Franse Early war-infanterielijst. T-13 en T-15 tellen als lichte Franse tankjagers en tanks, 47 mm antitank blijft.' },
  ned: { naam: 'Nederland', kort: 'NED', kleur: '#e08a3c', zijde: 'neutraal', doctrine: 'waterlinie', hoofdstad: 'nederland', leger: 'Geen eigen leger: speel een Franse of Britse Early war-infanterielijst zonder tanks, met pantserwagens (Landsverk) en licht antitankgeschut.' },
  den: { naam: 'Denemarken', kort: 'DEN', kleur: '#a8556a', zijde: 'neutraal', doctrine: 'waterlinie', hoofdstad: 'denemarken', leger: 'Geen eigen leger: speel een kleine Britse Early war-infanterielijst zonder tanks, met fietsinfanterie en 20 mm geschut.' },
  noo: { naam: 'Noorwegen', kort: 'NOO', kleur: '#8d6fb0', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'zuidnoorwegen', leger: 'Geen eigen leger: speel een Britse Early war-infanterielijst zonder tanks en met weinig artillerie.' },
  zwe: { naam: 'Zweden', kort: 'ZWE', kleur: '#3f6aa0', zijde: 'neutraal', doctrine: 'winter', hoofdstad: 'zuidzweden', leger: 'Geen eigen leger: speel een Duitse infanterielijst met Panzer 38(t) (de Zweedse Strv m/41 is dezelfde tank) en Bofors-geschut.' },
  fin: { naam: 'Finland', kort: 'FIN', kleur: '#9ec3df', zijde: 'neutraal', doctrine: 'motti', hoofdstad: 'finland', leger: 'Finse lijsten als je ze hebt. Anders: een Duitse infanterielijst met buitgemaakte Sovjet-tanks (T-26, T-34) en StuG.' },
  bal: { naam: 'Baltische staten', kort: 'BALT', kleur: '#8a9a5b', zijde: 'neutraal', doctrine: 'cavalerie', hoofdstad: 'letland', leger: 'Geen eigen leger: speel een Poolse Early war-infanterielijst met enkele lichte tanks (Vickers, FT) en cavalerie.' },
  tsj: { naam: 'Tsjecho-Slowakije', kort: 'TSJ', kleur: '#6fb3b8', zijde: 'geallieerd', doctrine: 'methodisch', hoofdstad: 'bohemen', leger: 'Geen eigen leger: speel een Duitse Early war-lijst met alleen Panzer 35(t) en 38(t), Tsjechisch geschut en veel bunkers.' },
  zwi: { naam: 'Zwitserland', kort: 'ZWI', kleur: '#d7d2c4', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'zwitserland', leger: 'Geen eigen leger: speel een Duitse infanterielijst met Panzer 38(t) (Panzer 39) en veel bunkers en bergtroepen.' },
  hon: { naam: 'Hongarije', kort: 'HON', kleur: '#7fa37a', zijde: 'neutraal', doctrine: 'cavalerie', hoofdstad: 'hongarije', leger: 'Hongaarse lijsten als je ze hebt (Toldi, Turán, Zrínyi). Anders: een Duitse lijst met lichte en middelzware tanks, zonder Tiger of Panther.' },
  roe: { naam: 'Roemenië', kort: 'ROE', kleur: '#d2c26a', zijde: 'neutraal', doctrine: 'cavalerie', hoofdstad: 'walachije', leger: 'Roemeense lijsten als je ze hebt (R-2, R35, TACAM). Anders: een Duitse infanterielijst met Panzer 35(t) en later Panzer IV en StuG.' },
  joe: { naam: 'Joegoslavië', kort: 'JOEG', kleur: '#9a7fb8', zijde: 'neutraal', doctrine: 'partizanen', hoofdstad: 'servie', leger: 'Geen eigen leger: speel een Franse Early war-infanterielijst (R35 en FT waren ook Joegoslavisch). Late war: een Sovjet-infanterielijst voor de partizanen.' },
  bul: { naam: 'Bulgarije', kort: 'BUL', kleur: '#5f7d52', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'bulgarije', leger: 'Geen eigen leger: speel een Duitse lijst met ouder materieel: Panzer 35(t) en 38(t), later Panzer IV en StuG.' },
  gri: { naam: 'Griekenland', kort: 'GRI', kleur: '#7fb0e0', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'athene', leger: 'Griekse lijst als je die hebt. Anders: een Britse Early war-infanterielijst met bergartillerie en vrijwel geen tanks.' },
  alb: { naam: 'Albanië', kort: 'ALB', kleur: '#a05c4b', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'albanie', leger: 'Geen eigen leger: speel een kleine Italiaanse infanterielijst zonder tanks.' },
  tur: { naam: 'Turkije', kort: 'TUR', kleur: '#8f3f58', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'anatolie', leger: 'Geen eigen leger: speel een Sovjet Early war-lijst (Turkije reed met T-26) of later een Britse lijst met Valentine en Stuart.' },
  spa: { naam: 'Spanje', kort: 'SPA', kleur: '#b7b08a', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'madrid', leger: 'Geen eigen leger: speel een Duitse of Italiaanse Early war-lijst met Panzer I, CV33 en buitgemaakte T-26.' },
  por: { naam: 'Portugal', kort: 'POR', kleur: '#4f9a6a', zijde: 'neutraal', doctrine: 'bergverdediging', hoofdstad: 'portugal', leger: 'Geen eigen leger: speel een kleine Britse infanterielijst zonder tanks.' },
  ier: { naam: 'Ierland', kort: 'IER', kleur: '#7fbf7f', zijde: 'neutraal', doctrine: 'partizanen', hoofdstad: 'ierland', leger: 'Geen eigen leger: speel een kleine Britse Early war-infanterielijst zonder tanks, met enkele pantserwagens.' },
  neutraal: { naam: 'Niemandsland', kort: '—', kleur: '#b4b2a6', zijde: 'neutraal', leger: '' },
};
export const ZIJDEN = { as: 'As', geallieerd: 'Geallieerden', sovjet: 'Sovjetblok', neutraal: 'Neutraal' };
export function periodeVanJaar(jaar) { return jaar <= 1941 ? 'early' : jaar <= 1943 ? 'mid' : 'late'; }

export const PERIODES = {
  early: { naam: 'Early war', jaren: '1939–1941', sfeer: 'Duitse opmars, lichte tanks, verdedigers zijn slecht voorbereid.' },
  mid: { naam: 'Mid war', jaren: '1942–1943', sfeer: 'Evenwicht en keerpunt, de zware tanks komen op.' },
  late: { naam: 'Late war', jaren: '1944–1945', sfeer: 'Geallieerde overmacht, Duitse verdediging, elite zware tanks.' },
};
export const PERIODE_VOLGORDE = ['early', 'mid', 'late'];

// Periode-check: typisch materieel per land. Geen legerlijst, wel een toets of je lijst in de periode past.
export const EENHEDEN = {
  early: {
    dui: 'Panzer I, II, 35(t)/38(t), vroege III en IV (kort kanon), 3,7 cm PaK, 8,8 cm Flak, Stuka. Geen Tiger of Panther.',
    ita: 'L3-tankettes, M11/39 en M13/40, Bersaglieri, 47 mm geschut.',
    vk: 'Matilda I en II, Cruiser A9–A13, Vickers Mk VI, 2-ponder, Bren Carrier. In de woestijn ook Crusader I.',
    vs: 'Nog niet in de strijd: alleen als what-if (M3 Stuart, M2 Medium).',
    ussr: 'T-26, BT-5/BT-7, T-28; vanaf 1941 kleine aantallen T-34/76 en KV-1. 45 mm antitank.',
    fra: 'Char B1 bis, Somua S35, Hotchkiss H35/H39, Renault R35, 25 mm en 47 mm antitank.',
    pol: '7TP, TKS-tankettes, cavaleriebrigades, 37 mm Bofors, wz. 35-antitankgeweer.',
    ben: 'T-13 en T-15, Landsverk-pantserwagens, 47 mm antitank, fietsinfanterie.',
  },
  mid: {
    dui: 'Panzer III (lang), Panzer IV F2/G, StuG III, Marder, eerste Tigers; vanaf Koersk ook Panther en Ferdinand.',
    ita: 'M14/41, Semovente 75/18, Bersaglieri, Folgore-parachutisten.',
    vk: 'Crusader, Grant, Sherman, Valentine, Churchill, 6-ponder, 25-ponder.',
    vs: 'M3 Lee, M4 Sherman, M3 Stuart, M10, halftracks, 105 mm houwitser.',
    ussr: 'T-34/76, KV-1, T-70, SU-76, SU-122 en SU-152, Katjoesja, 76 mm ZiS-3.',
    fra: 'Vrije Fransen met Brits of Amerikaans materieel.',
    pol: 'Poolse eenheden in Brits verband (Brits materieel).',
    ben: 'Niet actief als eigen leger in deze periode.',
  },
  late: {
    dui: 'Panzer IV H/J, Panther, Tiger I, Königstiger, StuG, Jagdpanzer IV, Hetzer, Panzerfaust, Nebelwerfer.',
    ita: 'RSI-eenheden met Duits materieel, of co-belligerenten met geallieerd materieel.',
    vk: 'Sherman en Firefly, Cromwell, Churchill, Comet (1945), 17-ponder, Typhoon.',
    vs: 'M4 Sherman (75 en 76 mm), M10, M18, M36, M24 Chaffee; in 1945 Pershing. P-47 luchtsteun.',
    ussr: 'T-34/85, IS-2, SU-85/100, ISU-122/152, Katjoesja, Il-2 Sturmovik.',
    fra: 'Vrije Fransen: Sherman, M10, halftracks.',
    pol: 'Poolse 1e Pantserdivisie (Sherman, Cromwell) of het Poolse Volksleger (T-34).',
    ben: 'Brigade Piron en Prinses Irene Brigade met Brits materieel.',
  },
};

const OOST_KOERSK = ['koningsbergen', 'warschau', 'lublin', 'roemenie', 'kaunas', 'riga', 'brest', 'lwow', 'minsk', 'pripjat', 'pskov', 'novgorod', 'vitebsk', 'smolensk', 'gomel', 'zjitomir', 'kiev', 'vinnitsa', 'odessa', 'brjansk', 'orel', 'poltava', 'charkov', 'dnjepr', 'krim', 'stalino'];
const EUROPA_VASTELAND = ['bretagne', 'normandie', 'noordfrankrijk', 'parijs', 'aquitanie', 'zuidfrankrijk', 'provence', 'lagelanden', 'lotharingen', 'rijnland', 'noordduitsland', 'denemarken', 'noorwegen', 'beieren', 'berlijn', 'saksen', 'bohemen', 'oostenrijk', 'polen', 'oostpruisen', 'warschau'];

export const CAMPAGNES = [
  // ───────── Early war ─────────
  { id: 'fallweiss', naam: 'Fall Weiss', ondertitel: 'Polen, september 1939', periode: 'early', kaart: 'polen39',
    jaar: 1939, maand: 9, dag: 1, lengte: 'week', maxBeurten: 6,
    tekst: 'Kort en snel. Duitsland valt van drie kanten binnen en moet Warschau nemen voor de klok afloopt. Polen wint tijd met rivierlinies en tegenaanvallen.',
    facties: [
      { id: 'dui', bronnen: ['brandenburg', 'silezie', 'oostpruisen'], doctrine: 'blitzkrieg', beurt1Aanvallen: 3 },
      { id: 'pol', hoofdstad: 'warschau', doctrine: 'ingraven' },
    ],
    bezit: { dui: ['brandenburg', 'pommeren', 'silezie', 'oostpruisen', 'slowakije'], pol: 'rest' },
    doel: { zijde: 'as', regios: ['warschau'], min: 1, voor: 6, tekst: 'Duitsland moet Warschau bezetten vóór het einde van beurt 6.' },
    events: [{ beurt: 3, type: 'sluit', regios: ['wilno', 'pinsk', 'tarnopol'], tekst: '17 september: het Rode Leger trekt Oost-Polen binnen. Wilno, Pinsk en Tarnopol vallen weg.' }] },

  { id: 'fallgelb', naam: 'Fall Gelb', ondertitel: 'Frankrijk en de Lage Landen, mei 1940', periode: 'early', kaart: 'west40',
    jaar: 1940, maand: 5, dag: 10, lengte: 'week', maxBeurten: 7,
    tekst: 'De sikkelsnede. Duitsland breekt door de Ardennen naar de kust; de geallieerden moeten de Kanaalhavens of Parijs houden.',
    facties: [
      { id: 'dui', bronnen: ['rijnland', 'munsterland'], doctrine: 'blitzkrieg', para: true, gratisPara: 1, beurt1Aanvallen: 3 },
      { id: 'fra', hoofdstad: 'parijs', doctrine: 'methodisch' },
      { id: 'vk', bronnen: ['duinkerken', 'calais'], doctrine: 'reconinkracht' },
      { id: 'ben', hoofdstad: 'brussel', doctrine: 'ingraven', speler: 'passief' },
    ],
    bezit: { dui: ['munsterland', 'rijnland', 'eifel', 'saarland'], ben: ['gelderland', 'holland', 'brabant', 'limburg', 'antwerpen', 'vlaanderen', 'brussel', 'luik', 'namen', 'ardennen'], vk: ['duinkerken', 'calais', 'arras', 'rijsel'], fra: 'rest' },
    doel: { zijde: 'as', regios: ['parijs', 'duinkerken', 'calais'], min: 3, voor: 7, tekst: 'Duitsland moet Parijs, Duinkerken en Calais bezetten vóór het einde van beurt 7.' } },

  { id: 'compass', naam: 'Operatie Compass', ondertitel: 'Noord-Afrika, december 1940', periode: 'early', kaart: 'woestijn',
    subset: ['tripoli', 'sirte', 'elagheila', 'benghazi', 'msus', 'djebel', 'tobroek', 'birhakeim', 'bardia', 'sidibarrani', 'mersamatruh', 'elalamein', 'alexandrie', 'cairo'],
    jaar: 1940, maand: 12, dag: 9, lengte: 'maand', maxBeurten: 5,
    tekst: 'Een kleine Britse woestijnmacht tegen een groot Italiaans leger. Lange bevoorradingslijnen: wie te ver doorstoot, staat droog.',
    facties: [
      { id: 'vk', hoofdstad: 'cairo', doctrine: 'woestijnratten' },
      { id: 'ita', hoofdstad: 'tripoli', doctrine: 'rapido' },
    ],
    bezit: { vk: ['mersamatruh', 'elalamein', 'alexandrie', 'cairo'], ita: 'rest' },
    doel: { zijde: 'geallieerd', regios: ['tobroek', 'benghazi', 'elagheila'], min: 3, voor: 4, tekst: 'Het VK moet Tobroek, Benghazi en El Agheila bezetten vóór het einde van beurt 4.' },
    events: [{ beurt: 4, type: 'bonus', factie: 'ita', tekst: 'Maart 1941: het Afrikakorps komt aan in Tripoli. Italië krijgt deze beurt een extra order.' }] },

  { id: 'barbarossa', naam: 'Barbarossa', ondertitel: 'Sovjet-Unie, juni 1941', periode: 'early', kaart: 'oostfront',
    jaar: 1941, maand: 6, dag: 22, lengte: 'maand', maxBeurten: 7,
    tekst: 'Een enorm front. Duitsland heeft tot de winter: vanaf november ligt er sneeuw en keert Generaal Winter zich tegen de aanvaller.',
    facties: [
      { id: 'dui', bronnen: ['koningsbergen', 'warschau', 'lublin', 'roemenie'], doctrine: 'blitzkrieg', beurt1Aanvallen: 3 },
      { id: 'ussr', hoofdstad: 'moskou', bronnen: ['moskou', 'gorki', 'saratov', 'stalingrad'], doctrine: 'winter' },
    ],
    bezit: { dui: ['koningsbergen', 'warschau', 'lublin', 'roemenie'], ussr: 'rest' },
    doel: { zijde: 'as', regios: ['riga', 'minsk', 'smolensk', 'kiev', 'leningrad', 'moskou'], min: 3, voor: 7, tekst: 'Duitsland moet 3 van de 6 steden Riga, Minsk, Smolensk, Kiev, Leningrad en Moskou bezetten vóór het einde van beurt 7.' } },

  // ───────── Mid war ─────────
  { id: 'fallblau', naam: 'Fall Blau en Stalingrad', ondertitel: 'Zuid-Rusland, juni 1942', periode: 'mid', kaart: 'oostfront',
    jaar: 1942, maand: 6, dag: 28, lengte: 'maand', maxBeurten: 8,
    tekst: 'De stoot naar de Wolga en de olie. Stadsgevechten domineren; wie de ander afsnijdt, wint. Afgesneden regio\'s capituleren na drie beurten.',
    facties: [
      { id: 'dui', bronnen: ['koningsbergen', 'warschau', 'lublin', 'roemenie'], doctrine: 'blitzkrieg' },
      { id: 'ussr', hoofdstad: 'moskou', bronnen: ['moskou', 'gorki', 'saratov'], doctrine: 'massa' },
    ],
    bezit: { dui: [...OOST_KOERSK, 'rzjev', 'vjazma', 'koersk'], ussr: 'rest' },
    doel: { zijde: 'as', regios: ['stalingrad', 'kaukasus', 'rostov'], min: 3, voor: 7, tekst: 'Duitsland moet Stalingrad, Rostov en Majkop bezetten vóór het einde van beurt 7.' } },

  { id: 'alamein', naam: 'El Alamein en Tunesië', ondertitel: 'Noord-Afrika, oktober 1942', periode: 'mid', kaart: 'woestijn',
    jaar: 1942, maand: 10, dag: 23, lengte: 'maand', maxBeurten: 8,
    tekst: 'Montgomery tegen Rommel. In beurt 2 landen de Amerikanen achter het front (Torch) en bezetten de Duitsers Tunesië.',
    facties: [
      { id: 'vk', hoofdstad: 'cairo', doctrine: 'setpiece' },
      { id: 'vs', bronnen: ['casablanca', 'oran', 'algiers'], doctrine: 'vuurkracht', later: true },
      { id: 'dui', bronnen: ['tripoli', 'tunis'], doctrine: 'auftragstaktik' },
      { id: 'ita', hoofdstad: 'tripoli', bronnen: ['tripoli', 'tunis'], doctrine: 'rapido', speler: 'passief' },
    ],
    bezit: { vk: ['elalamein', 'alexandrie', 'cairo'], dui: ['mersamatruh', 'sidibarrani', 'bardia', 'tobroek', 'birhakeim', 'djebel', 'msus', 'benghazi'], ita: ['elagheila', 'sirte', 'tripoli', 'mareth'], neutraal: 'rest' },
    doel: { zijde: 'geallieerd', regios: ['tripoli', 'tunis'], min: 2, voor: 8, tekst: 'De geallieerden moeten Tripoli en Tunis bezetten vóór het einde van beurt 8.' },
    events: [{ beurt: 2, type: 'overdracht', regios: ['casablanca', 'oran', 'algiers', 'constantine'], naar: 'vs', tekst: 'November 1942, operatie Torch: de Amerikanen landen in Marokko en Algerije.' },
      { beurt: 2, type: 'overdracht', regios: ['tunis', 'kasserine'], naar: 'dui', tekst: 'De Duitsers vliegen troepen over naar Tunesië.' }] },

  { id: 'koersk', naam: 'Koersk', ondertitel: 'Operatie Zitadelle, juli 1943', periode: 'mid', kaart: 'oostfront',
    jaar: 1943, maand: 7, dag: 5, lengte: 'maand', maxBeurten: 5,
    tekst: 'Duitsland valt een voorbereide verdediging aan: de saillant zit vol mijnenvelden en antitankgordels. Mislukt het, dan rolt het Sovjet-tegenoffensief.',
    facties: [
      { id: 'dui', bronnen: ['koningsbergen', 'warschau', 'lublin', 'roemenie'], doctrine: 'auftragstaktik' },
      { id: 'ussr', hoofdstad: 'moskou', bronnen: ['moskou', 'gorki', 'saratov', 'stalingrad'], doctrine: 'diepeoperatie' },
    ],
    bezit: { dui: OOST_KOERSK, ussr: 'rest' },
    fort: { koersk: 3, voronezj: 2, toela: 1, vjazma: 1, orel: 1, charkov: 1 }, linies: { koersk: 'Koersk-saillant' },
    doel: { zijde: 'as', regios: ['koersk', 'voronezj'], min: 2, voor: 4, tekst: 'Duitsland moet Koersk en Voronezj bezetten vóór het einde van beurt 4.' } },

  { id: 'sicilie', naam: 'Sicilië en Italië', ondertitel: 'Operatie Husky, juli 1943', periode: 'mid', kaart: 'italie',
    jaar: 1943, maand: 7, dag: 10, lengte: 'maand', maxBeurten: 11,
    tekst: 'Landingen, bergen en verdedigingslinies. In beurt 3 capituleert Italië en nemen de Duitsers alles over.',
    facties: [
      { id: 'vs', bronnen: ['bizerte'], doctrine: 'amfibisch', para: true, beurt1Aanvallen: 2 },
      { id: 'vk', bronnen: ['malta'], doctrine: 'setpiece', landing: true, beurt1Aanvallen: 2 },
      { id: 'dui', bronnen: ['florence', 'ancona'], doctrine: 'elastisch' },
      { id: 'ita', hoofdstad: 'rome', doctrine: 'bergverdediging', speler: 'passief' },
    ],
    bezit: { vs: ['bizerte'], vk: ['malta'], ita: ['palermo', 'gela', 'syracuse', 'calabrie', 'tarente', 'rome'], dui: 'rest' },
    doel: { zijde: 'geallieerd', regios: ['napels', 'foggia', 'rome'], min: 3, voor: 11, tekst: 'De geallieerden moeten Napels, Foggia en Rome bezetten vóór het einde van beurt 11.' },
    events: [{ beurt: 3, type: 'wapenstilstand', van: 'ita', naar: 'dui', tekst: 'September 1943: Italië capituleert. De Duitsers bezetten alle Italiaanse stellingen.' }] },

  // ───────── Late war ─────────
  { id: 'overlord', naam: 'Overlord', ondertitel: 'Normandië, 6 juni 1944', periode: 'late', kaart: 'normandie',
    jaar: 1944, maand: 6, dag: 6, lengte: 'week', maxBeurten: 11,
    tekst: 'Vijf stranden, luchtlandingen op de flanken en daarna de bocage. De geallieerden moeten uitbreken voor de zomer voorbij is.',
    facties: [
      { id: 'vs', bronnen: ['portland'], doctrine: 'amfibisch', para: true, gratisPara: 1, beurt1Aanvallen: 2 },
      { id: 'vk', bronnen: ['portsmouth'], doctrine: 'setpiece', landing: true, para: true, gratisPara: 1, beurt1Aanvallen: 3 },
      { id: 'dui', bronnen: ['lisieux', 'lemans', 'bretagne'], doctrine: 'elastisch' },
    ],
    bezit: { vs: ['portland'], vk: ['portsmouth'], dui: 'rest' },
    doel: { zijde: 'geallieerd', regios: ['cherbourg', 'caen', 'stlo', 'avranches', 'falaise'], min: 5, voor: 11, tekst: 'De geallieerden moeten Cherbourg, Caen, Saint-Lô, Avranches en Falaise bezetten vóór het einde van beurt 11.' } },

  { id: 'bagration', naam: 'Bagration', ondertitel: 'Wit-Rusland, juni 1944', periode: 'late', kaart: 'oostfront',
    jaar: 1944, maand: 6, dag: 22, lengte: 'maand', maxBeurten: 5,
    tekst: 'Het grote Sovjet-zomeroffensief. Duitsland moet het front terugnemen zonder dat Heeresgruppe Mitte instort.',
    facties: [
      { id: 'ussr', hoofdstad: 'moskou', bronnen: ['moskou', 'gorki', 'saratov', 'kiev'], doctrine: 'diepeoperatie', beurt1Aanvallen: 3 },
      { id: 'dui', bronnen: ['koningsbergen', 'warschau', 'lublin', 'roemenie'], doctrine: 'festung' },
    ],
    bezit: { dui: ['koningsbergen', 'warschau', 'lublin', 'roemenie', 'kaunas', 'riga', 'brest', 'lwow', 'minsk', 'pripjat', 'pskov', 'vitebsk'], ussr: 'rest' },
    fort: { vitebsk: 2, minsk: 1, pskov: 1 },
    doel: { zijde: 'geallieerd', regios: ['minsk', 'brest', 'kaunas', 'lublin', 'lwow'], min: 4, voor: 4, tekst: 'De Sovjet-Unie moet 4 van de 5 regio\'s Minsk, Brest-Litovsk, Litouwen, Lublin en Lwów bezetten vóór het einde van beurt 4.' } },

  { id: 'marketgarden', naam: 'Market Garden', ondertitel: 'Nederland, 17 september 1944', periode: 'late', kaart: 'marketgarden',
    jaar: 1944, maand: 9, dag: 17, lengte: 'dag', maxBeurten: 9, capitulatieNa: 5, paraOveral: true,
    tekst: 'Een bruggencampagne. Parachutisten nemen de bruggen, het XXX Corps moet over één weg naar Arnhem voor ze zonder munitie zitten.',
    facties: [
      { id: 'vk', bronnen: ['neerpelt'], doctrine: 'reconinkracht', para: true, gratisPara: 1 },
      { id: 'vs', doctrine: 'luchtoverwicht', para: true, gratisPara: 2, later: true },
      { id: 'dui', bronnen: ['denbosch', 'reichswald', 'zevenaar', 'wolfheze'], doctrine: 'auftragstaktik' },
    ],
    bezit: { vk: ['neerpelt'], dui: 'rest' },
    doel: { zijde: 'geallieerd', regios: ['son', 'grave', 'nijmegen', 'arnhem'], min: 4, voor: 9, tekst: 'De geallieerden moeten de bruggen bij Son, Grave, Nijmegen en Arnhem bezetten vóór het einde van beurt 9.' } },

  { id: 'ardennen', naam: 'Ardennenoffensief', ondertitel: 'Wacht am Rhein, december 1944', periode: 'late', kaart: 'ardennen',
    jaar: 1944, maand: 12, dag: 16, lengte: 'week', maxBeurten: 6,
    tekst: 'Duitsland valt aan in de sneeuw. Zolang het bewolkt blijft, vliegt er niets; daarna beheersen de jachtbommenwerpers de wegen.',
    facties: [
      { id: 'dui', bronnen: ['pruem', 'bitburg'], doctrine: 'auftragstaktik', beurt1Aanvallen: 3 },
      { id: 'vs', bronnen: ['luik', 'sedan', 'luxemburg', 'namen'], doctrine: 'vuurkracht' },
    ],
    bezit: { dui: ['pruem', 'bitburg'], vs: 'rest' },
    doel: { zijde: 'as', regios: ['dinant', 'namen', 'hoei', 'givet', 'luik'], min: 2, voor: 5, tekst: 'Duitsland moet 2 Maasovergangen (Dinant, Namen, Hoei, Givet of Luik) bezetten vóór het einde van beurt 5.' },
    events: [{ beurt: 1, type: 'weer', geenLucht: 2, tekst: 'Laaghangende bewolking boven de Ardennen: geen luchtsteun in beurt 1 en 2.' },
      { beurt: 3, type: 'tekst', tekst: '23 december: het klaart op. De geallieerde luchtmacht vliegt weer.' }] },

  { id: 'valvanhetrijk', naam: 'Val van het Rijk', ondertitel: 'Duitsland, februari 1945', periode: 'late', kaart: 'rijk45',
    jaar: 1945, maand: 2, dag: 1, lengte: 'tweeweken', maxBeurten: 8,
    tekst: 'Twee fronten richting Berlijn. De geallieerden winnen samen, maar wie de Rijksdag neemt, strijkt de eer op: de stand per land beslist de wedloop.',
    facties: [
      { id: 'vs', bronnen: ['reims'], doctrine: 'vuurkracht' },
      { id: 'vk', bronnen: ['antwerpen'], doctrine: 'setpiece' },
      { id: 'ussr', bronnen: ['warschau', 'krakau', 'boedapest'], doctrine: 'diepeoperatie' },
      { id: 'dui', hoofdstad: 'berlijn', doctrine: 'festung' },
    ],
    bezit: { vs: ['reims', 'aken', 'lotharingen', 'elzas'], vk: ['antwerpen'], ussr: ['warschau', 'krakau', 'boedapest', 'posen'], dui: 'rest' },
    doel: { zijde: 'geallieerd', regios: ['berlijn'], min: 1, voor: 8, tekst: 'De geallieerden moeten Berlijn bezetten vóór het einde van beurt 8.' } },

];

// ───────── Europa: 1938, 1941, 1945 ─────────
const DUITS = ['rijnland', 'noordduitsland', 'berlijn', 'saksen', 'beieren', 'oostenrijk', 'oostpruisen', 'pommeren', 'silezie', 'masuren'];
const BRITS = ['schotland', 'noordengeland', 'wales', 'londen'];
const ITALIAANS = ['noorditalie', 'rome', 'zuiditalie', 'sicilie', 'sardinie'];
const SOVJET38 = ['minsk', 'kiev', 'odessa', 'charkov', 'donbas', 'krim', 'leningrad', 'karelie', 'pskov', 'smolensk', 'moskou', 'orel', 'voronezj', 'rostov', 'stalingrad', 'kaukasus', 'gorki', 'vologda', 'saratov', 'astrachan', 'transkaukasie'];
const SOVJET41 = [...SOVJET38, 'estland', 'letland', 'litouwen', 'westwitrusland', 'lwow', 'bessarabie'];
const NEUTRAAL = { spa: ['madrid', 'catalonie', 'andalusie', 'noordspanje'], por: ['portugal'], ier: ['ierland'], zwe: ['zuidzweden', 'noordzweden'], zwi: ['zwitserland'], tur: ['istanbul', 'anatolie', 'oostturkije'] };
const BRONNEN = { vk: ['londen', 'egypte'], fra: ['parijs', 'algerije'], ita: ['rome', 'tripoli'] };
// bezit: {land: [regio's]}, zijden: {zijde: [landen]}, spelers: wie orders geeft; de rest verdedigt alleen.
// Een regio staat voor al haar provincies.
const provinciesVan = (lijst) => lijst.flatMap((id) => EUROPA_GEO.regios.filter((r) => r.ouder === id).map((r) => r.id));
function europaStart(o) {
  o.bezit = Object.fromEntries(Object.entries(o.bezit).map(([f, lijst]) => [f, provinciesVan(lijst)]));
  if (o.subset) o.subset = provinciesVan(o.subset);
  // losse provincies die van een ander land zijn dan de rest van hun regio
  for (const [f, lijst] of Object.entries(o.los || {})) { for (const k of Object.keys(o.bezit)) o.bezit[k] = o.bezit[k].filter((id) => !lijst.includes(id)); o.bezit[f] = o.bezit[f].concat(lijst); }
  const zijdeVan = {};
  for (const [z, lijst] of Object.entries(o.zijden)) for (const f of lijst) zijdeVan[f] = z;
  const facties = Object.keys(o.bezit).map((id) => Object.assign({ id, zijde: zijdeVan[id] || 'neutraal', speler: o.spelers.includes(id) ? 'mens' : 'passief', hoofdstad: FACTIES[id].hoofdstad || null, doctrine: (o.doctrines || {})[id] || FACTIES[id].doctrine, landing: true },
    BRONNEN[id] ? { bronnen: BRONNEN[id] } : {}, (o.extra || {})[id] || {}));
  facties.sort((a, b) => (a.speler === 'mens' ? 0 : 1) - (b.speler === 'mens' ? 0 : 1));
  return { id: o.id, naam: o.naam, ondertitel: o.ondertitel, periode: periodeVanJaar(o.jaar), kaart: 'europa', sandbox: true, europa: true, jaar: o.jaar, maand: o.maand, dag: 1, lengte: o.lengte, maxBeurten: o.maxBeurten, tekst: o.tekst, facties, bezit: o.bezit, subset: o.subset, doel: o.doel, fort: o.fort };
}
CAMPAGNES.unshift(
  europaStart({ id: 'europa1938', naam: 'Europa 1938', ondertitel: 'Herfst 1938, na de Anschluss', jaar: 1938, maand: 9, lengte: 'seizoen', maxBeurten: 16,
    tekst: 'De grenzen van München. Duitsland heeft Oostenrijk ingelijfd, Tsjecho-Slowakije staat er nog, de Sovjet-Unie kijkt toe. Wie valt eerst wie aan?',
    spelers: ['dui', 'ita', 'vk', 'fra', 'ussr', 'pol'], zijden: { as: ['dui', 'ita'], geallieerd: ['vk', 'fra', 'pol', 'tsj'], sovjet: ['ussr'] }, doctrines: { ussr: 'massa', vk: 'commandos' },
    los: { pol: ['danzig'] },
    bezit: Object.assign({ dui: DUITS, ita: [...ITALIAANS, 'tripoli', 'cyrenaica'], vk: [...BRITS, 'egypte', 'palestina', 'irak'], fra: ['parijs', 'normandie', 'noordfrankrijk', 'lotharingen', 'aquitanie', 'lyon', 'provence', 'marokko', 'algerije', 'tunesie', 'levant'],
      ussr: SOVJET38, pol: ['westpolen', 'warschau', 'krakau', 'oostpolen', 'westwitrusland', 'lwow'], tsj: ['bohemen', 'slowakije'], bel: ['belgie'], ned: ['nederland'], den: ['denemarken'], noo: ['zuidnoorwegen', 'noordnoorwegen'], fin: ['finland', 'lapland'], bal: ['estland', 'letland', 'litouwen'],
      hon: ['hongarije'], roe: ['walachije', 'transsylvanie', 'bessarabie'], joe: ['kroatie', 'bosnie', 'servie', 'macedonie'], bul: ['bulgarije'], gri: ['saloniki', 'athene'], alb: ['albanie'] }, NEUTRAAL) }),
  europaStart({ id: 'europa1941', naam: 'Europa 1941', ondertitel: 'Juni 1941, aan de vooravond van Barbarossa', jaar: 1941, maand: 6, lengte: 'seizoen', maxBeurten: 14,
    tekst: 'De As beheerst het vasteland van de Atlantische kust tot de Boeg. Het Britse Rijk staat alleen in het westen, en in het oosten wacht het Rode Leger.',
    spelers: ['dui', 'ita', 'vk', 'ussr'], zijden: { as: ['dui', 'ita', 'hon', 'roe', 'bul', 'fin'], geallieerd: ['vk', 'ussr'] }, doctrines: { ussr: 'winter', vk: 'woestijnratten', fra: 'ingraven' },
    bezit: Object.assign({ dui: [...DUITS, 'bohemen', 'slowakije', 'westpolen', 'warschau', 'krakau', 'oostpolen', 'denemarken', 'zuidnoorwegen', 'noordnoorwegen', 'nederland', 'belgie', 'parijs', 'normandie', 'noordfrankrijk', 'lotharingen', 'aquitanie', 'servie', 'bosnie', 'saloniki', 'athene'],
      ita: [...ITALIAANS, 'tripoli', 'cyrenaica', 'albanie', 'kroatie'], vk: [...BRITS, 'egypte', 'palestina', 'irak'], ussr: SOVJET41,
      fra: ['lyon', 'provence', 'marokko', 'algerije', 'tunesie', 'levant'], hon: ['hongarije'], roe: ['walachije', 'transsylvanie'], bul: ['bulgarije', 'macedonie'], fin: ['finland', 'lapland'] }, NEUTRAAL),
    extra: { fra: { hoofdstad: null, bronnen: ['lyon', 'algerije'] } } }),
  europaStart({ id: 'europa1945', naam: 'Europa 1945', ondertitel: 'Januari 1945, het Rijk in het nauw', jaar: 1945, maand: 1, lengte: 'maand', maxBeurten: 6,
    tekst: 'De geallieerden staan aan de Rijn en de Weichsel. Duitsland verdedigt met wat het nog heeft; de vraag is wie Berlijn bereikt.',
    spelers: ['dui', 'vs', 'vk', 'ussr'], zijden: { as: ['dui', 'hon'], geallieerd: ['vs', 'vk', 'ussr', 'fra', 'roe', 'bul', 'joe'] }, doctrines: { dui: 'festung', ussr: 'diepeoperatie', vk: 'setpiece', vs: 'vuurkracht', fra: 'ingraven', roe: 'ingraven', hon: 'elastisch' },
    bezit: Object.assign({ dui: [...DUITS, 'bohemen', 'slowakije', 'westpolen', 'warschau', 'krakau', 'denemarken', 'zuidnoorwegen', 'noordnoorwegen', 'nederland', 'noorditalie', 'kroatie'], hon: ['hongarije'],
      vs: ['normandie', 'lotharingen', 'rome', 'zuiditalie', 'sicilie', 'sardinie'], vk: [...BRITS, 'noordfrankrijk', 'belgie', 'athene', 'saloniki', 'egypte', 'palestina', 'irak', 'tripoli', 'cyrenaica'],
      fra: ['parijs', 'lyon', 'provence', 'aquitanie', 'marokko', 'algerije', 'tunesie', 'levant'], ussr: [...SOVJET41, 'oostpolen'], roe: ['walachije', 'transsylvanie'], bul: ['bulgarije'], joe: ['servie', 'macedonie', 'bosnie'], alb: ['albanie'], fin: ['finland', 'lapland'] }, NEUTRAAL),
    extra: { vs: { bronnen: ['normandie', 'zuiditalie'], para: true }, vk: { para: true } },
    doel: { zijde: 'geallieerd', regios: ['berlijn'], min: 1, voor: 6, tekst: 'De geallieerden moeten Berlijn bezetten vóór het einde van beurt 6.' } }),
  europaStart({ id: 'sealion', naam: 'What-if: Seelöwe', ondertitel: 'Invasie van Engeland, september 1940', jaar: 1940, maand: 9, lengte: 'maand', maxBeurten: 6,
    subset: ['schotland', 'noordengeland', 'wales', 'londen', 'ierland', 'normandie', 'noordfrankrijk', 'parijs', 'belgie', 'nederland'],
    tekst: 'De invasie die nooit kwam. Duitsland moet het Kanaal over en Londen nemen voor de herfststormen.',
    spelers: ['dui', 'vk'], zijden: { as: ['dui'], geallieerd: ['vk'] }, doctrines: { vk: 'ingraven' },
    bezit: { dui: ['normandie', 'noordfrankrijk', 'parijs', 'belgie', 'nederland'], vk: BRITS, ier: ['ierland'] },
    extra: { dui: { hoofdstad: null, bronnen: ['parijs', 'belgie'], para: true, gratisPara: 1 }, vk: { bronnen: ['londen', 'noordengeland'] } }, fort: { wales: 1 },
    doel: { zijde: 'as', regios: ['londen'], min: 1, voor: 6, tekst: 'Duitsland moet Londen bezetten vóór het einde van beurt 6.' } }),
);

export function campagneVan(id) { return CAMPAGNES.find((c) => c.id === id); }
