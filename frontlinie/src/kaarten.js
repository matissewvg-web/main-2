// Kaarten. Eén regel per regio: id|naam|x|y|terrein|infrastructuur|waarde|versterking[:linienaam]
// terrein: steppe akkers bocage woestijn stad bos heuvels bergen rivier strand moeras
// infra:   stad haven kust brug spoor vliegveld
// versterking: 0 geen, 1 ingegraven, 2 fort, 3 linie
// Buren volgen uit de geometrie (geo.js); `links` voegt verbindingen toe, `cuts` haalt ze weg.

import { EUROPA_GEO } from './europa-geo.js';

function rg(tekst) {
  return tekst.trim().split('\n').map((l) => {
    const [id, naam, x, y, terrein, infra, waarde, fort] = l.trim().split('|');
    const [f, linie] = (fort || '0').split(':');
    return { id, naam, x: +x, y: +y, terrein, infra: infra ? infra.split(',') : [], waarde: +waarde || 1, fort: +f || 0, linie: linie || '' };
  });
}

export const KAARTEN = {
  polen39: {
    naam: 'Polen 1939', theater: 'Oostfront', klimaat: 'gematigd', w: 1000, h: 700, straal: 112,
    regios: rg(`
brandenburg|Brandenburg|70|270|akkers|spoor|1|0
pommeren|Pommeren|150|130|bos|kust|1|0
silezie|Silezië|170|430|heuvels|spoor,stad|2|0
oostpruisen|Oost-Pruisen|540|60|bos|haven,kust|2|1
slowakije|Slowakije|450|630|bergen||1|0
danzig|Danzig en de Corridor|330|90|rivier|haven,kust,brug|2|1
poznan|Poznań|270|270|akkers|stad,spoor|2|0
bydgoszcz|Bydgoszcz|390|190|rivier|brug|1|0
kutno|Kutno aan de Bzura|450|290|rivier|brug|1|0
lodz|Łódź|390|390|stad|stad,spoor|3|0
katowice|Katowice|300|510|stad|stad,spoor|2|1
krakau|Krakau|430|530|heuvels|stad|3|0
mlawa|Mława|560|170|akkers||1|2
warschau|Warschau|590|300|stad|stad,brug,spoor,vliegveld|5|1
radom|Radom|560|430|bos||1|0
przemysl|Przemyśl|610|570|rivier|brug|1|1
lublin|Lublin|700|440|akkers|stad|2|0
bialystok|Białystok|720|180|bos||1|0
brest|Brest-Litovsk|790|320|rivier|brug,spoor|2|2
lwow|Lwów|770|560|heuvels|stad,spoor|3|0
wilno|Wilno|880|90|bos|stad|2|0
pinsk|Pinsk|910|300|moeras||1|0
tarnopol|Tarnopol|910|500|steppe||1|0`),
  },

  west40: {
    naam: 'West-Europa 1940', theater: 'West-Europa', klimaat: 'gematigd', w: 1000, h: 720, straal: 95,
    regios: rg(`
munsterland|Münsterland|880|140|akkers||1|0
rijnland|Rijnland|900|290|heuvels|spoor,stad|2|0
eifel|Eifel|830|410|bos||1|0
saarland|Saarland|880|550|heuvels||1|2:Westwall
gelderland|Grebbelinie|760|100|rivier|brug|1|1
holland|Vesting Holland|620|90|rivier|haven,kust,brug,stad|3|1
brabant|Noord-Brabant|690|190|akkers||1|0
limburg|Maastricht|790|260|rivier|brug|1|0
antwerpen|Antwerpen|590|210|stad|haven,stad|3|1
vlaanderen|Vlaanderen|490|230|akkers|kust|1|0
brussel|Brussel|600|310|stad|stad,spoor|4|0
luik|Luik en Eben-Emael|720|340|rivier|brug|2|2
namen|Namen|630|410|rivier|brug|1|1
ardennen|Ardennen|740|450|bos||1|0
duinkerken|Duinkerken|400|200|strand|haven,kust|2|0
calais|Calais|310|240|strand|haven,kust|2|0
rijsel|Rijsel|480|330|stad|stad|2|0
arras|Arras|390|350|akkers||1|0
somme|Amiens aan de Somme|310|440|rivier|brug|2|0
sedan|Sedan|650|510|rivier|brug|2|1
reims|Reims|530|490|akkers|stad|2|0
maginot|Maginotlinie|780|580|heuvels||1|3:Maginotlinie
rouaan|Rouen aan de Seine|200|520|rivier|brug,haven|2|0
parijs|Parijs|370|570|stad|stad,spoor,brug,vliegveld|5|0
champagne|Troyes|530|620|akkers||1|0
lotharingen|Nancy|680|640|heuvels|stad|2|1`),
  },

  woestijn: {
    naam: 'Noord-Afrika', theater: 'Noord-Afrika', klimaat: 'woestijn', w: 1800, h: 640, straal: 96, tekst: 1.2,
    regios: rg(`
casablanca|Casablanca|70|300|akkers|haven,kust,stad|2|0
oran|Oran|200|240|heuvels|haven,kust|2|0
algiers|Algiers|330|200|heuvels|haven,kust,stad|3|0
constantine|Constantine|450|230|bergen||1|0
tunis|Tunis|570|170|akkers|haven,kust,stad,vliegveld|4|0
kasserine|Kasserine|520|310|bergen||1|0
mareth|Mareth|620|380|woestijn|kust|1|3:Mareth-linie
tripoli|Tripoli|740|410|woestijn|haven,kust,stad|4|0
sirte|Sirte|860|470|woestijn|kust|1|0
elagheila|El Agheila|970|510|woestijn|kust|1|1
benghazi|Benghazi|1030|390|woestijn|haven,kust,stad|3|0
msus|Msus|1090|490|woestijn||1|0
djebel|Djebel Akhdar|1130|350|heuvels|kust|1|0
tobroek|Tobroek|1230|390|woestijn|haven,kust|3|2
birhakeim|Bir Hakeim|1200|500|woestijn||1|1
bardia|Halfaya-pas|1330|430|woestijn|kust|1|1
sidibarrani|Sidi Barrani|1420|460|woestijn|kust|1|0
mersamatruh|Mersa Matruh|1510|480|woestijn|haven,kust|2|0
elalamein|El Alamein|1600|500|woestijn|kust,spoor|2|1
alexandrie|Alexandrië|1690|470|stad|haven,kust,stad|4|0
cairo|Caïro|1740|570|stad|stad,brug,vliegveld|5|0`),
  },

  oostfront: {
    naam: 'Oostfront', theater: 'Oostfront', klimaat: 'oost', w: 1400, h: 1010, straal: 115,
    regios: rg(`
koningsbergen|Oost-Pruisen|120|200|bos|haven,kust,spoor|2|1
warschau|Warschau|100|420|stad|stad,spoor,brug|3|0
lublin|Lublin|130|570|akkers||1|0
roemenie|Roemenië|270|870|heuvels|spoor|3|0
kaunas|Litouwen|260|170|bos||1|0
riga|Riga|340|70|rivier|haven,kust,brug|2|0
brest|Brest-Litovsk|240|440|rivier|brug,spoor|2|2
lwow|Lwów|250|630|heuvels|stad,spoor|2|0
minsk|Minsk|400|330|bos|stad,spoor|3|0
pripjat|Pripjat-moerassen|400|490|moeras||1|0
pskov|Pskov|470|140|bos||1|0
leningrad|Leningrad|600|60|stad|stad,haven,kust,spoor|5|2
novgorod|Novgorod|630|180|moeras||1|0
vitebsk|Vitebsk|530|270|rivier|brug|1|0
smolensk|Smolensk|650|330|bos|stad,spoor|3|0
gomel|Gomel|550|470|rivier|brug|1|0
zjitomir|Zjytomyr|400|630|akkers||1|0
kiev|Kiev|550|610|rivier|stad,brug,spoor|4|1
vinnitsa|Vinnytsja|410|750|akkers||1|0
odessa|Odessa|490|860|steppe|haven,kust,stad|3|1
tichvin|Tichvin|760|90|moeras||1|0
kalinin|Kalinin|840|190|bos|brug|1|0
rzjev|Rzjev|750|250|bos||1|1
vjazma|Vjazma|780|350|bos|spoor|1|0
moskou|Moskou|910|290|stad|stad,spoor,vliegveld|5|2
brjansk|Brjansk|700|460|bos|spoor|1|0
toela|Toela|900|410|stad|stad|2|1
orel|Orjol|830|490|akkers||1|0
koersk|Koersk|800|590|steppe|spoor|2|0
poltava|Poltava|680|680|steppe||1|0
charkov|Charkov|830|700|stad|stad,spoor|4|0
dnjepr|Dnjepropetrovsk|680|790|rivier|brug,stad|2|0
krim|Sebastopol|660|940|heuvels|haven,kust|3|2
stalino|Stalino|860|810|stad|stad,spoor|3|0
voronezj|Voronezj|960|570|rivier|brug,stad|2|0
millerovo|Don-bocht|1010|710|steppe||1|0
rostov|Rostov|990|860|rivier|brug,haven,stad|3|0
kaukasus|Majkop|1070|960|bergen||3|0
kalatsj|Kalatsj|1120|760|rivier|brug|1|0
stalingrad|Stalingrad|1230|720|stad|stad,brug,spoor|5|1
astrachan|Kalmukkensteppe|1300|870|steppe||1|0
tambov|Tambov|1080|440|akkers||1|0
saratov|Saratov|1230|540|steppe|spoor|2|0
gorki|Gorki|1100|270|bos|stad,spoor|3|0`),
  },

  italie: {
    naam: 'Sicilië en Italië', theater: 'Italië', klimaat: 'mediterraan', w: 900, h: 1060, straal: 85,
    regios: rg(`
bizerte|Bizerte|80|930|woestijn|haven,kust|1|0
malta|Malta|330|1000|heuvels|haven,kust,vliegveld|1|2
gela|Gela|290|860|strand|kust|1|0
syracuse|Syracuse|410|880|heuvels|haven,kust|2|0
palermo|Palermo|220|750|heuvels|haven,kust,stad|2|0
catania|Catania|400|770|bergen|kust|2|1:Etna-linie
messina|Messina|470|680|bergen|haven,kust|2|0
calabrie|Calabrië|570|640|bergen|kust|1|0
tarente|Tarente|720|530|akkers|haven,kust|2|0
foggia|Foggia|630|410|akkers|vliegveld|3|0
salerno|Salerno|510|510|strand|kust|2|0
napels|Napels|430|430|stad|haven,kust,stad|4|0
volturno|Volturno|490|340|rivier|brug|1|1
cassino|Monte Cassino|400|280|bergen||2|3:Gustav-linie
ortona|Ortona|560|270|stad|kust|1|3:Gustav-linie
anzio|Anzio|300|300|strand|kust|1|0
rome|Rome|290|200|stad|stad,spoor,vliegveld|5|0
pescara|Pescara|450|170|heuvels|kust|1|0
florence|Florence|230|80|heuvels|stad|3|3:Gotenlinie
ancona|Ancona|400|70|heuvels|haven,kust|1|0`),
    links: [['calabrie', 'tarente']],
    cuts: [['bizerte', 'palermo'], ['bizerte', 'gela'], ['malta', 'gela'], ['malta', 'syracuse']],
  },

  normandie: {
    naam: 'Normandië', theater: 'West-Europa', klimaat: 'gematigd', w: 1100, h: 800, straal: 88,
    regios: rg(`
portland|Portland|430|40|akkers|haven,kust|1|0
portsmouth|Portsmouth|760|40|akkers|haven,kust|1|0
cherbourg|Cherbourg|230|130|stad|haven,kust,stad|4|2
barneville|Barneville|150|240|bocage|kust|1|0
stemere|Sainte-Mère-Église|250|280|bocage||1|0
utah|Utah Beach|340|240|strand|kust|2|3:Atlantikwall
omaha|Omaha Beach|450|235|strand|kust|2|3:Atlantikwall
gold|Gold Beach|560|225|strand|kust|2|3:Atlantikwall
juno|Juno Beach|660|220|strand|kust|2|3:Atlantikwall
sword|Sword Beach|760|230|strand|kust|2|3:Atlantikwall
carentan|Carentan|350|340|moeras|brug|2|0
bayeux|Bayeux|520|320|bocage|stad|2|0
caen|Caen|700|320|stad|stad,brug,vliegveld|5|1
pegasus|Pegasusbrug|810|310|rivier|brug|2|0
stlo|Saint-Lô|410|440|bocage|stad|3|0
caumont|Caumont|510|420|bocage||1|0
tilly|Villers-Bocage|600|400|bocage||2|0
heuvel112|Heuvel 112|690|420|heuvels||2|1
coutances|Coutances|290|470|bocage||1|0
vire|Vire|500|540|bocage||1|0
falaise|Falaise|740|530|akkers|stad|3|0
lisieux|Lisieux|910|400|akkers|spoor|1|0
avranches|Avranches|310|620|bocage|brug|3|0
mortain|Mortain|450|650|heuvels||2|0
argentan|Argentan|800|640|akkers||2|0
bretagne|Bretagne|180|700|bocage||2|0
lemans|Le Mans|640|680|akkers|spoor|1|0`),
    links: [['lemans', 'mortain']],
    cuts: [['portland', 'cherbourg'], ['portland', 'utah'], ['portland', 'omaha'], ['portsmouth', 'sword'], ['portsmouth', 'juno'], ['portsmouth', 'gold'], ['portland', 'portsmouth']],
  },

  marketgarden: {
    naam: 'Hell\'s Highway', theater: 'West-Europa', klimaat: 'gematigd', w: 900, h: 1100, straal: 80,
    regios: rg(`
neerpelt|Neerpelt|400|1035|akkers|brug|1|0
valkenswaard|Valkenswaard|400|935|bos||1|1
eindhoven|Eindhoven|400|835|stad|stad|3|0
best|Best|290|765|bos|brug|1|0
helmond|Helmond|530|800|akkers||1|0
son|Son|415|735|rivier|brug|2|0
sintoedenrode|Sint-Oedenrode|390|650|akkers|brug|1|0
schijndel|Schijndel|280|600|bos||1|0
veghel|Veghel|440|565|rivier|brug|2|0
uden|Uden|530|480|akkers||1|0
denbosch|'s-Hertogenbosch|190|500|stad|stad|2|0
grave|Grave|470|390|rivier|brug|3|0
groesbeek|Groesbeekse Hoogte|610|370|heuvels||2|0
reichswald|Reichswald|730|400|bos||1|1:Westwall
nijmegen|Nijmegen|560|290|stad|stad,brug|5|1
betuwe|Elst|530|200|akkers||1|0
driel|Driel|420|170|rivier||1|0
oosterbeek|Oosterbeek|400|85|bos||2|0
wolfheze|Wolfheze|290|80|bos|spoor|1|0
arnhem|Arnhem|530|105|stad|stad,brug|5|0
zevenaar|Zevenaar|670|140|akkers|spoor|1|0`),
  },

  ardennen: {
    naam: 'Ardennen', theater: 'West-Europa', klimaat: 'gematigd', w: 1100, h: 800, straal: 95,
    regios: rg(`
pruem|Prüm|990|330|bos||1|1:Westwall
bitburg|Bitburg|970|520|heuvels||1|1:Westwall
monschau|Monschau|900|110|bos||1|1
elsenborn|Elsenborn-rug|810|190|heuvels||2|1
malmedy|Malmedy|720|240|bos|brug|1|0
stvith|Sankt Vith|840|330|bos|stad,spoor|3|0
spa|Spa|620|160|bos||2|0
stavelot|Stavelot|630|270|rivier|brug|2|0
luik|Luik|500|80|stad|stad,brug,spoor|4|0
vielsalm|Vielsalm|730|360|bos||1|0
clervaux|Clervaux|850|450|heuvels||1|0
houffalize|Houffalize|690|460|bos|brug|2|0
hotton|Hotton|540|320|bos|brug|1|0
laroche|La Roche|580|420|rivier|brug|1|0
bastogne|Bastogne|690|570|akkers|stad,spoor|5|0
wiltz|Wiltz|810|570|bos||1|0
echternach|Echternach|910|640|rivier|brug|1|0
luxemburg|Luxemburg|800|720|stad|stad|3|0
neufchateau|Neufchâteau|560|660|bos||1|0
marche|Marche|440|400|akkers||2|0
rochefort|Rochefort|390|510|bos||1|0
hoei|Hoei|380|200|rivier|brug|2|0
namen|Namen|240|270|rivier|brug,stad|4|0
dinant|Dinant|260|440|rivier|brug|4|0
givet|Givet|270|600|rivier|brug|2|0
sedan|Sedan|420|730|akkers|spoor|1|0`),
  },

  rijk45: {
    naam: 'Duitsland 1945', theater: 'West-Europa en Oostfront', klimaat: 'gematigd', w: 1320, h: 900, straal: 112,
    regios: rg(`
antwerpen|Antwerpen|80|300|stad|haven,kust|2|0
reims|Reims|60|520|akkers|spoor|1|0
nederland|Nederland|170|160|rivier|brug,kust|2|1
aken|Aken|170|400|stad||1|0
lotharingen|Lotharingen|140|650|heuvels||1|0
elzas|Elzas|190|790|heuvels||1|0
wesel|Wesel|270|240|rivier|brug|2|1
rijnland|Keulen|280|390|stad|stad,brug|3|2:Westwall
remagen|Remagen|340|500|rivier|brug|2|0
saar|Saar-Palts|270|620|heuvels||2|2:Westwall
ruhr|Ruhrgebied|370|300|stad|stad,spoor|5|1
bremen|Bremen|400|130|akkers|haven,kust|2|0
kassel|Kassel|490|390|heuvels||2|0
frankfurt|Frankfurt|450|540|stad|stad,brug|3|0
stuttgart|Stuttgart|420|710|heuvels|stad|2|0
hamburg|Hamburg|540|70|stad|haven,kust,stad|4|0
hannover|Hannover|530|230|akkers|stad|2|0
neurenberg|Neurenberg|620|640|stad|stad|3|0
munchen|München|650|810|stad|stad|3|0
maagdenburg|Maagdenburg|670|290|rivier|brug|2|0
leipzig|Leipzig|700|440|stad|stad|3|0
berlijn|Berlijn|830|250|stad|stad,spoor,vliegveld,brug|5|2
dresden|Dresden|840|450|stad|stad,brug|3|0
praag|Praag|860|610|heuvels|stad|3|0
stettin|Stettin|900|110|rivier|haven,kust,brug|2|1
seelow|Seelower Höhen|950|250|heuvels|brug|2|3:Oderlinie
silezie|Breslau|1010|470|stad|stad|3|2
moravie|Moravië|1000|650|heuvels||1|0
wenen|Wenen|1010|800|stad|stad,brug|4|1
pommeren|Pommeren|1050|90|akkers|kust|1|0
posen|Posen|1100|290|stad||2|0
koningsbergen|Koningsbergen|1220|90|stad|haven,kust|2|3
warschau|Warschau|1240|310|stad|spoor|1|0
krakau|Krakau|1200|540|heuvels|spoor|1|0
boedapest|Boedapest|1140|800|stad|stad,brug|3|0`),
    links: [['koningsbergen', 'warschau']],
    cuts: [['koningsbergen', 'pommeren']],
  },

  europa: {
    naam: 'Europa', theater: 'Alle theaters', klimaat: 'gematigd', w: EUROPA_GEO.w, h: EUROPA_GEO.h, straal: 100, geo: EUROPA_GEO, zeeBereik: 450, paraBereik: 300,
    regios: EUROPA_GEO.regios,
  },
};

export const TERREINEN = {
  steppe: 'Steppe', akkers: 'Akkerland', bocage: 'Bocage', woestijn: 'Woestijn', stad: 'Stad', bos: 'Bos',
  heuvels: 'Heuvels', bergen: 'Bergen', rivier: 'Rivierlandschap', strand: 'Strand', moeras: 'Moeras',
};
export const INFRA = { stad: 'Stad', haven: 'Haven', kust: 'Kust', brug: 'Brug', spoor: 'Spoorknooppunt', vliegveld: 'Vliegveld' };
export const VERSTERKING = ['Geen', 'Ingegraven', 'Fort', 'Linie'];
