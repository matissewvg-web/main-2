// Regio's van de Europakaart. Landnamen volgen Natural Earth (world-atlas).
// Een land met meerdere regio's wordt verdeeld rond de opgegeven steden (lon, lat).
// id|naam|landen (;)|lon,lat of leeg|terrein|infra|waarde|versterking[:linie]
export const REGIOTEKST = `
schotland|Schotland|United Kingdom;Isle of Man|-4,56.8|heuvels|haven,kust|2|0
noordengeland|Midlands|United Kingdom;Isle of Man|-2,53.8|stad|stad,spoor,haven,kust|3|0
wales|Wales|United Kingdom;Isle of Man|-3.6,51.6|heuvels|haven,kust|2|0
londen|Londen|United Kingdom;Isle of Man|0,51.7|stad|stad,haven,kust,vliegveld|5|1
ierland|Ierland|Ireland||akkers|haven,kust|1|0
parijs|Parijs|France|2.35,48.8|stad|stad,spoor,brug,vliegveld|5|0
normandie|Normandië|France|-1.6,48.3|bocage|haven,kust|2|0
noordfrankrijk|Rijsel|France|2.8,50.3|akkers|haven,kust,stad|2|0
lotharingen|Lotharingen|France|6.3,48.6|heuvels|stad|2|2:Maginotlinie
aquitanie|Aquitanië|France|-0.3,44.8|akkers|haven,kust|2|0
lyon|Lyon|France|4.3,45.6|heuvels|stad,spoor|3|0
provence|Provence|France|5.9,43.7|heuvels|haven,kust|2|0
madrid|Castilië|Spain|-3.7,40.2|heuvels|stad,spoor|4|0
catalonie|Catalonië|Spain|0.6,41.5|heuvels|stad,haven,kust|3|0
andalusie|Andalusië|Spain|-4.8,37.5|bergen|haven,kust|2|0
noordspanje|Asturië|Spain|-5.5,42.9|bergen|haven,kust|2|0
portugal|Portugal|Portugal||akkers|haven,kust,stad|2|0
belgie|België|Belgium;Luxembourg||rivier|stad,brug,haven,kust|3|1
nederland|Nederland|Netherlands||rivier|haven,kust,brug,stad|3|1
rijnland|Ruhr|Germany|7.3,51|stad|stad,spoor,brug|4|1:Westwall
noordduitsland|Hamburg|Germany|10,53.4|akkers|haven,kust,stad|3|0
berlijn|Berlijn|Germany|13.4,52.6|stad|stad,spoor,vliegveld|5|1
saksen|Saksen|Germany|12.2,50.9|stad|stad,spoor|3|0
beieren|Beieren|Germany|11.2,48.6|heuvels|stad|3|0
denemarken|Denemarken|Denmark||akkers|haven,kust|1|0
zuidnoorwegen|Oslo|Norway|9.5,60.6|bergen|haven,kust,stad|2|0
noordnoorwegen|Narvik|Norway|17,68.3|bergen|haven,kust|2|0
zuidzweden|Stockholm|Sweden|15.5,58.6|bos|stad,haven,kust|3|0
noordzweden|Kiruna|Sweden|18.5,65|bos|spoor|2|0
finland|Helsinki|Finland;Åland|25.5,61.8|bos|haven,kust,stad|3|1:Mannerheimlinie
lapland|Lapland|Finland;Åland|26.5,67.3|bos||1|0
estland|Estland|Estonia||bos|haven,kust|1|0
letland|Letland|Latvia||bos|haven,kust,stad|1|0
litouwen|Litouwen|Lithuania||bos|stad|1|0
pommeren|Pommeren|Poland|15.8,53.7|bos|haven,kust|2|0
silezie|Silezië|Poland|16.8,51|stad|stad,spoor|3|0
masuren|Masuren|Poland|20.8,53.8|bos||1|1
westpolen|Poznań|Poland|18,52.7|akkers|stad,spoor|2|0
warschau|Warschau|Poland|21,52.2|stad|stad,spoor,brug|4|0
krakau|Krakau|Poland|20,50.1|heuvels|stad,spoor|3|0
oostpolen|Lublin|Poland|22.9,51.2|akkers|stad|1|0
bohemen|Bohemen|Czechia||heuvels|stad,spoor|3|2:Tsjechische grensforten
slowakije|Slowakije|Slovakia||bergen||1|0
oostenrijk|Oostenrijk|Austria;Liechtenstein||bergen|stad,spoor|3|0
zwitserland|Zwitserland|Switzerland||bergen|stad|2|2:Réduit
hongarije|Hongarije|Hungary||steppe|stad,brug|3|0
walachije|Walachije|Romania|26,44.5|akkers|stad,spoor,haven,kust|4|0
transsylvanie|Transsylvanië|Romania|24,46.6|bergen|stad|2|0
bessarabie|Bessarabië|Moldova||steppe||1|0
kroatie|Kroatië|Croatia;Slovenia||bergen|haven,kust,stad|2|0
bosnie|Bosnië|Bosnia and Herz.;Montenegro||bergen||1|0
servie|Servië|Serbia;Kosovo||heuvels|stad,brug|3|0
macedonie|Macedonië|Macedonia||bergen||1|0
albanie|Albanië|Albania||bergen|haven,kust|1|0
saloniki|Saloniki|Greece|22.8,40.7|bergen|haven,kust|2|1:Metaxaslinie
athene|Athene|Greece|23,38|bergen|haven,kust,stad|3|0
bulgarije|Bulgarije|Bulgaria||heuvels|stad,haven,kust|2|0
istanbul|Istanbul|Turkey|28.6,40.7|stad|stad,haven,kust,brug|4|1
anatolie|Anatolië|Turkey|33,39.2|heuvels|stad,spoor|3|0
oostturkije|Oost-Turkije|Turkey|39.5,39|bergen||1|0
westwitrusland|Brest|Belarus|25.2,53.2|moeras||1|0
minsk|Minsk|Belarus|28.6,53.8|bos|stad,spoor|3|0
lwow|Galicië|Ukraine|24.6,49.5|heuvels|stad,spoor|2|0
kiev|Kiev|Ukraine|30.5,50.3|rivier|stad,brug,spoor|4|1
odessa|Odessa|Ukraine|30.6,47|steppe|haven,kust,stad|3|0
charkov|Charkov|Ukraine|35.8,49.8|steppe|stad,spoor|3|0
donbas|Donbas|Ukraine|37.8,48|stad|stad,spoor|3|0
oostpruisen|Oost-Pruisen|Russia|21,54.7|bos|haven,kust,stad|2|1
krim|Krim|Russia;Ukraine|34.2,45.2|heuvels|haven,kust|2|2
leningrad|Leningrad|Russia|30.5,59.8|stad|stad,haven,kust,spoor|5|2
karelie|Karelië|Russia|33.5,65.5|bos|haven,kust,spoor|2|0
pskov|Novgorod|Russia|30,57.2|moeras||1|0
smolensk|Smolensk|Russia|32.6,54.7|bos|stad,spoor|2|0
moskou|Moskou|Russia|37.6,55.8|stad|stad,spoor,vliegveld|5|2
orel|Koersk|Russia|36.3,52.3|steppe|spoor|2|0
voronezj|Voronezj|Russia|40,51.2|rivier|brug,stad|2|0
rostov|Rostov|Russia|40.5,47.3|rivier|brug,haven,kust,stad|3|0
stalingrad|Stalingrad|Russia|44.5,48.8|stad|stad,brug,spoor|5|1
kaukasus|Kaukasus|Russia|42.5,44.4|bergen||3|0
gorki|Gorki|Russia|44,56.6|bos|stad,spoor|3|0
vologda|Archangelsk|Russia|40.5,61.5|bos|haven,kust|1|0
saratov|Saratov|Russia|46.5,52.2|steppe|spoor|2|0
astrachan|Astrachan|Russia|47,46.3|steppe||1|0
transkaukasie|Bakoe|Georgia;Armenia;Azerbaijan||bergen|haven,kust|4|0
noorditalie|Milaan|Italy;San Marino|10,45.3|akkers|stad,spoor|4|0
rome|Rome|Italy;San Marino;Vatican|12.6,42.2|stad|stad,kust,vliegveld|4|0
zuiditalie|Napels|Italy|15.9,40.5|bergen|haven,kust|2|0
sicilie|Sicilië|Italy|14,37.5|heuvels|haven,kust|1|0
sardinie|Sardinië|Italy|9,40|bergen|haven,kust|1|0
marokko|Marokko|Morocco||bergen|haven,kust,stad|2|0
algerije|Algerije|Algeria||heuvels|haven,kust,stad|2|0
tunesie|Tunesië|Tunisia||akkers|haven,kust,stad,vliegveld|2|0
tripoli|Tripoli|Libya|13.5,32|woestijn|haven,kust,stad|2|0
cyrenaica|Cyrenaica|Libya|22,31.5|woestijn|haven,kust|2|1
egypte|Egypte|Egypt||woestijn|haven,kust,stad,brug|4|0
levant|Syrië|Syria;Lebanon||heuvels|haven,kust|1|0
palestina|Palestina|Israel;Palestine;Jordan||woestijn|haven,kust|1|0
irak|Irak|Iraq||woestijn|spoor|2|0
`;
// Zeestraten die als gewone grens tellen
export const ZEELINKS = [['messina', 'calabrie'], ['denemarken', 'malmo'], ['gibraltar', 'tanger'], ['estland', 'finland'], ['dover', 'calais']];
// Regio's waarvan het label niet op het zwaartepunt past: lon, lat
export const LABELS = { zuidnoorwegen: [8.6, 60.8], noordnoorwegen: [15.5, 67.6], kroatie: [16, 45.6], athene: [22.3, 38.2], londen: [-0.3, 51.9], egypte: [29.5, 30.3], algerije: [3, 35], marokko: [-6, 33.5], tripoli: [14, 31.3], cyrenaica: [22, 31], tunesie: [9.5, 35], irak: [42.5, 34], palestina: [36.2, 31.3], levant: [38, 35], transkaukasie: [45, 41.3], anatolie: [33, 39], oostturkije: [40, 39], istanbul: [28.6, 40.2], portugal: [-8, 39.6], denemarken: [9.3, 56.1], noordzweden: [17.5, 64.6], zuidzweden: [15, 58.8], finland: [25.5, 62], lapland: [26.5, 67.2], karelie: [33.5, 65], vologda: [41, 61.5] };
