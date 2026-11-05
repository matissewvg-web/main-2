// Gebruik: npm install world-atlas@2.0.2 topojson-client@3.1.0 && node build-world.js world.json
// Kaartdata: Natural Earth via world-atlas (publiek domein / ISC). De uitvoer staat ingebakken in chrome-ledger.html als WORLD_DATA.
// Bouwt de wereldkaart voor Chrome Ledger uit Natural Earth (world-atlas 110m).
const topo = require("world-atlas/countries-110m.json");
const tj = require("topojson-client");
const fs = require("fs");

const T = [
  // id, naam, kort, continent, type, inkomen, onderhoud, lore, landen
  ["USA", "Verenigde Staten", "VS", "Noord-Amerika", "corporate", 12, 7, "Vijftig staten, honderd eigenaren. Washington is een aandeelhoudersvergadering geworden.", ["United States of America"]],
  ["CAN", "Canada", "Canada", "Noord-Amerika", "data", 8, 4, "Koude datacentra, zoet water en grondstoffen. Iedereen wil het, niemand wil er wonen.", ["Canada"]],
  ["GRL", "Groenland", "Groenland", "Noord-Amerika", "industrie", 4, 2, "Smeltend ijs, nieuwe mijnen en een poolroute die elk jaar langer open blijft.", ["Greenland"]],
  ["MEX", "Mexico", "Mexico", "Noord-Amerika", "markt", 8, 4, "Maquiladora's, kartels en een grens die vooral voor mensen dicht zit.", ["Mexico"]],
  ["CAM", "Midden-Amerika", "M-Amerika", "Noord-Amerika", "haven", 6, 3, "Het kanaal, de vrijhandelszones en regeringen die per kwartaal wisselen.", ["Guatemala", "Belize", "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama"]],
  ["CAR", "Caribisch Gebied", "Caribisch", "Noord-Amerika", "villa", 6, 3, "Belastingparadijzen met palmbomen. Het geld van de wereld komt hier uitrusten.", ["Cuba", "Haiti", "Dominican Rep.", "Jamaica", "Bahamas", "Puerto Rico", "Trinidad and Tobago"]],
  ["GCO", "Gran Colombia", "Gran Col.", "Zuid-Amerika", "markt", 7, 3, "Olie, coca en havens aan twee oceanen.", ["Colombia", "Venezuela", "Ecuador", "Guyana", "Suriname"]],
  ["BRA", "Brazilië", "Brazilië", "Zuid-Amerika", "campus", 10, 5, "Het regenwoud is gepatenteerd. São Paulo is groter dan de meeste landen.", ["Brazil"]],
  ["AND", "Andes", "Andes", "Zuid-Amerika", "industrie", 6, 3, "Lithium, koper en mijnwerkers in exoskeletten, aan een kust van vijfduizend kilometer.", ["Peru", "Bolivia", "Chile"]],
  ["CSU", "Cono Sur", "Cono Sur", "Zuid-Amerika", "haven", 7, 3, "Graan, vlees en havens waar banken en kartels dezelfde kantoren delen.", ["Argentina", "Uruguay", "Paraguay", "Falkland Is."]],
  ["UKI", "Britse Eilanden", "Brits", "Europa", "corporate", 9, 5, "De City beheert nog steeds andermans geld. De rest van het eiland betaalt de huur.", ["United Kingdom", "Ireland"]],
  ["BNL", "Benelux", "Benelux", "Europa", "haven", 8, 4, "Dijken, megahavens en een overheid die al lang een joint venture is.", ["Netherlands", "Belgium", "Luxembourg"]],
  ["FRA", "Frankrijk", "Frankrijk", "Europa", "nacht", 9, 5, "Mode, media en kerncentrales. Parijs staakt, de rest exporteert.", ["France"]],
  ["IBE", "Iberië", "Iberië", "Europa", "nacht", 7, 4, "Zon, toerisme en verlaten resorts vol serverracks.", ["Spain", "Portugal"]],
  ["DEU", "Duitsland en Alpen", "Duitsland", "Europa", "industrie", 10, 5, "Precisie-industrie, chemie en Zwitserse kluizen. Alles werkt, alles heeft een prijs.", ["Germany", "Austria", "Switzerland"]],
  ["ITA", "Italië", "Italië", "Europa", "markt", 8, 4, "Design, havens en families die al eeuwen zaken doen zonder contracten.", ["Italy", "Slovenia"]],
  ["SCA", "Scandinavië", "Scandinavië", "Europa", "data", 8, 4, "Koude datacentra en stille fjorden. Hier staan de back-ups van de halve wereld.", ["Norway", "Sweden", "Finland", "Denmark", "Iceland"]],
  ["CEU", "Centraal-Europa", "Centraal-EU", "Europa", "industrie", 7, 3, "De fabrieken van het continent: auto's, drones en goedkope ingenieurs.", ["Poland", "Czechia", "Slovakia", "Hungary"]],
  ["BLK", "Balkan", "Balkan", "Europa", "sloppen", 5, 2, "Smokkelroutes, huurlingen en havens aan drie zeeën.", ["Serbia", "Croatia", "Bosnia and Herz.", "Montenegro", "Kosovo", "Albania", "Macedonia", "Bulgaria", "Romania", "Greece", "Moldova"]],
  ["OEU", "Oost-Europa", "Oost-EU", "Europa", "sloppen", 5, 2, "Bufferzone vol vergeten oorlogen, graan en hackers die geld niet kan kopen.", ["Ukraine", "Belarus", "Estonia", "Latvia", "Lithuania"]],
  ["RUS", "Rusland", "Rusland", "Europa", "industrie", 10, 6, "Gas, metaal en een toendra die elk jaar verder ontdooit. Verhuurd aan wie het meest biedt.", ["Russia"]],
  ["TUR", "Turkije", "Turkije", "Midden-Oosten", "transit", 7, 3, "De brug tussen continenten. Alles wat van oost naar west gaat, betaalt hier tol.", ["Turkey", "Cyprus", "N. Cyprus"]],
  ["LEV", "Levant", "Levant", "Midden-Oosten", "sloppen", 5, 2, "Oude steden, nieuwe muren en een wapenindustrie die nooit stilstaat.", ["Syria", "Lebanon", "Israel", "Palestine", "Jordan", "Iraq"]],
  ["ARB", "Arabië", "Arabië", "Midden-Oosten", "corporate", 11, 6, "Olie werd zonnestroom, zonnestroom werd data. De torens staan er nog steeds.", ["Saudi Arabia", "Yemen", "Oman", "United Arab Emirates", "Qatar", "Kuwait"]],
  ["PER", "Perzië en Kaukasus", "Perzië", "Midden-Oosten", "transit", 7, 3, "Pijpleidingen, bergpassen en een zeestraat die op slot kan.", ["Iran", "Georgia", "Armenia", "Azerbaijan"]],
  ["MAG", "Maghreb", "Maghreb", "Afrika", "data", 7, 3, "Spiegelvelden tot aan de horizon. Wie de stroom heeft, heeft Europa.", ["Morocco", "W. Sahara", "Algeria", "Tunisia", "Libya"]],
  ["NIJ", "Nijlstaten", "Nijl", "Afrika", "transit", 7, 3, "Het kanaal en de rivier. Wie Suez beheert, beheert de wereldhandel.", ["Egypt", "Sudan", "S. Sudan"]],
  ["WAF", "West-Afrika", "W-Afrika", "Afrika", "markt", 7, 3, "Markten, mijnen en kuststeden die elk jaar een miljoen groter worden.", ["Mauritania", "Mali", "Niger", "Senegal", "Gambia", "Guinea-Bissau", "Guinea", "Sierra Leone", "Liberia", "Côte d'Ivoire", "Burkina Faso", "Ghana", "Togo", "Benin"]],
  ["NGA", "Nigeria", "Nigeria", "Afrika", "nacht", 8, 4, "Lagos: veertig miljoen mensen en de luidste media ter wereld.", ["Nigeria"]],
  ["CAF", "Centraal-Afrika", "C-Afrika", "Afrika", "industrie", 6, 3, "Kobalt, coltan en jungle. Elke telefoon begint hier.", ["Chad", "Central African Rep.", "Cameroon", "Gabon", "Eq. Guinea", "Congo", "Dem. Rep. Congo", "Angola"]],
  ["HRN", "Hoorn van Afrika", "Hoorn", "Afrika", "haven", 6, 3, "De zeestraat waar elke vrachtroute langs moet. Tol, piraten en marinebases.", ["Ethiopia", "Eritrea", "Djibouti", "Somalia", "Somaliland", "Kenya", "Uganda"]],
  ["ZOA", "Zuidoost-Afrika", "ZO-Afrika", "Afrika", "haven", 6, 3, "Havens aan de Indische Oceaan en spoorlijnen vol erts.", ["Tanzania", "Rwanda", "Burundi", "Malawi", "Mozambique", "Zambia", "Zimbabwe", "Madagascar"]],
  ["ZAF", "Zuidelijk Afrika", "Z-Afrika", "Afrika", "corporate", 8, 4, "Diamanten, derivaten en een kaap waar twee oceanen botsen.", ["South Africa", "Namibia", "Botswana", "Lesotho", "eSwatini"]],
  ["CAZ", "Centraal-Azië", "C-Azië", "Azië", "transit", 6, 3, "De nieuwe zijderoute: treinen, pijpleidingen en steppen vol drones.", ["Kazakhstan", "Uzbekistan", "Turkmenistan", "Kyrgyzstan", "Tajikistan", "Afghanistan", "Mongolia"]],
  ["PAK", "Pakistan", "Pakistan", "Azië", "industrie", 6, 3, "Havens, wapenfabrieken en een grens die nooit rustig is.", ["Pakistan"]],
  ["IND", "India", "India", "Azië", "data", 10, 5, "Anderhalf miljard mensen, de grootste softwarefabriek ter wereld en overstroomde megasteden.", ["India", "Nepal", "Bhutan", "Bangladesh", "Sri Lanka"]],
  ["CHN", "China", "China", "Azië", "industrie", 12, 6, "De fabriek van de wereld. Honderd miljoen arbeiders, één planning.", ["China", "Taiwan"]],
  ["KOR", "Korea", "Korea", "Azië", "corporate", 9, 5, "Chaebols met privélegers aan de ene kant van de grens, een muur van stilte aan de andere.", ["North Korea", "South Korea"]],
  ["JPN", "Japan", "Japan", "Azië", "corporate", 11, 6, "Torens tot in de wolken en zaibatsu die ouder zijn dan sommige staten.", ["Japan"]],
  ["IDC", "Indochina", "Indochina", "Azië", "haven", 7, 3, "Rivierdelta's, vrijhandelszones en drijvende markten zonder vragen.", ["Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam"]],
  ["INS", "Insulinde", "Insulinde", "Azië", "haven", 8, 4, "Zeventienduizend eilanden en de drukste zeestraat ter wereld.", ["Indonesia", "Malaysia", "Brunei", "Timor-Leste", "Philippines"]],
  ["AUS", "Australië", "Australië", "Oceanië", "villa", 9, 5, "Ommuurde kuststeden en een binnenland vol mijnen en zonnevelden.", ["Australia"]],
  ["PAC", "Pacifische Rand", "Pacifisch", "Oceanië", "markt", 5, 2, "Verre eilanden en belastingparadijzen. Alles wordt hier geregistreerd, niets gecontroleerd.", ["New Zealand", "Papua New Guinea", "Solomon Is.", "Vanuatu", "Fiji", "New Caledonia"]],
];
const SEAS = [
  ["Z1", "Noord-Atlantische Oceaan", 3, [[-40, 45], [-30, 58], [-58, 38], [-18, 52], [-16, 42]]],
  ["Z2", "Zuid-Atlantische Oceaan", 2, [[-22, -20], [-12, -42], [0, -4], [-28, 8], [-48, -40], [-58, -50]]],
  ["Z3", "Caribische Zee", 3, [[-75, 15], [-90, 24]]],
  ["Z4", "Noordzee en Oostzee", 3, [[3, 56], [19, 58]]],
  ["Z5", "Middellandse Zee", 3, [[5, 38.5], [18, 35], [30, 33.5]]],
  ["Z6", "Zwarte Zee", 2, [[34, 43]]],
  ["Z7", "Noordelijke IJszee", 1, [[0, 80], [80, 78], [150, 76], [-150, 74], [-85, 60], [-70, 75], [40, 72]]],
  ["Z8", "Noordelijke Stille Oceaan", 3, [[-150, 35], [168, 42], [-125, 45], [150, 22], [-170, 55], [150, 34]]],
  ["Z9", "Zuidelijke Stille Oceaan", 2, [[-130, -25], [-95, -38], [-160, -5], [-80, -12]]],
  ["Z10", "Indische Oceaan", 3, [[75, -15], [92, -35], [55, -30], [42, -15]]],
  ["Z11", "Arabische Zee", 3, [[63, 14], [52, 26], [39, 19], [50, 12]]],
  ["Z12", "Golf van Bengalen", 2, [[88, 14], [96, 6]]],
  ["Z13", "Zuid-Chinese Zee", 4, [[113, 12], [116, -5], [125, 5]]],
  ["Z14", "Oost-Chinese Zee", 3, [[127, 31], [135, 40]]],
  ["Z15", "Koraal- en Tasmanzee", 2, [[160, -38], [152, -15], [175, -20]]],
  ["Z16", "Zuidelijke Oceaan", 1, [[0, -58], [100, -58], [-120, -58], [170, -58], [-75, -58]]],
];
const INLAND = [[51, 42], [60, 45]]; // Kaspische en Aralzee: geen zeezone

// Robinson-projectie
const RT = [[1, 0], [0.9986, 0.062], [0.9954, 0.124], [0.99, 0.186], [0.9822, 0.248], [0.973, 0.31], [0.96, 0.372], [0.9427, 0.434], [0.9216, 0.4958], [0.8962, 0.5571], [0.8679, 0.6176], [0.835, 0.6769], [0.7986, 0.7346], [0.7597, 0.7903], [0.7186, 0.8435], [0.6732, 0.8936], [0.6213, 0.9394], [0.5722, 0.9761], [0.5322, 1]];
const W = 1000, R = W / (2 * Math.PI * 0.8487), LAT_TOP = 84, LAT_BOT = -58;
function rob(lon, lat){
  const a = Math.min(Math.abs(lat), 90), i = Math.min(17, Math.floor(a / 5)), f = (a - i * 5) / 5;
  const X = RT[i][0] + (RT[i + 1][0] - RT[i][0]) * f, Y = RT[i][1] + (RT[i + 1][1] - RT[i][1]) * f;
  return [0.8487 * R * X * lon * Math.PI / 180, Math.sign(lat) * 1.3523 * R * Y];
}
const [, yTop] = rob(0, LAT_TOP), [, yBot] = rob(0, LAT_BOT);
const PAD = 8, H = Math.round(yTop - yBot + 2 * PAD);
const P = (lon, lat) => { lat = Math.max(LAT_BOT, Math.min(LAT_TOP, lat)); const [x, y] = rob(lon, lat); return [Math.round((W / 2 + x) * 10) / 10, Math.round((PAD + yTop - y) * 10) / 10]; };

// kader: de afgeronde Robinson-vorm tussen LAT_BOT en LAT_TOP
const frame = [];
for (let lat = LAT_BOT; lat <= LAT_TOP; lat += 2) frame.push(P(180, lat));
for (let lat = LAT_TOP; lat >= LAT_BOT; lat -= 2) frame.push(P(-180, lat));

const geoms = topo.objects.countries.geometries;
const byName = {}; geoms.forEach((g, i) => byName[g.properties.name] = i);
const owner = {}; // landindex -> gebied
for (const t of T) for (const n of t[8]){ if (byName[n] === undefined) throw new Error("onbekend land: " + n); owner[byName[n]] = t[0]; }
const missing = geoms.filter((g, i) => owner[i] === undefined).map(g => g.properties.name);
console.error("niet ingedeeld:", missing.join(", "));

// buren via gedeelde grenzen
const nb = tj.neighbors(geoms);
const neighbors = {};
geoms.forEach((g, i) => { const a = owner[i]; if (!a) return; for (const j of nb[i]){ const b = owner[j]; if (b && b !== a){ (neighbors[a] ??= new Set()).add(b); } } });

// zeezones: dichtstbijzijnde ankerpunt (in kaartcoördinaten)
const anchors = []; for (const [id, , , pts] of SEAS) for (const p of pts) anchors.push({id, p: P(p[0], p[1])});
for (const p of INLAND) anchors.push({id: null, p: P(p[0], p[1])});
const zoneAt = (x, y) => { let best = null, bd = 1e9; for (const a of anchors){ const d = (a.p[0] - x) ** 2 + (a.p[1] - y) ** 2; if (d < bd){ bd = d; best = a.id; } } return best; };

// ringen over de datumgrens: zet ze aan één kant, het kader knipt de rest af
const fixRing = ring => { let jump = false; for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) jump = true;
  if (!jump) return ring; const east = ring.filter(p => p[0] > 0).length >= ring.length / 2; return ring.map(([lon, lat]) => [east ? (lon < 0 ? lon + 360 : lon) : (lon > 0 ? lon - 360 : lon), lat]); };
const PX = (lon, lat) => { const sgn = lon > 180 ? 1 : lon < -180 ? -1 : 0; const [x, y] = P(sgn ? lon - sgn * 360 : lon, lat); return sgn ? [Math.round((x + sgn * 2 * (W / 2 - 0)) * 10) / 10, y] : [x, y]; };
const ringPath = ring => { const pts = fixRing(ring).map(([lon, lat]) => PX(lon, lat)); return "M" + pts.map(p => p[0] + " " + p[1]).join("L") + "Z"; };
const out = [], extraD = {GCO: ""};
const isGuiana = poly => poly[0][0][0] < -30;
for (const t of T){
  const [id, naam, kort, cont, arch, inc, upk, lore, names] = t;
  const members = names.map(n => geoms[byName[n]]);
  const merged = tj.merge(topo, members);
  const polys = merged.type === "MultiPolygon" ? merged.coordinates : [merged.coordinates];
  let d = "", best = null, bestA = -1;
  for (const poly of polys){
    if (id === "FRA" && isGuiana(poly)){ for (const ring of poly) extraD.GCO += ringPath(ring); continue; }
    for (const ring of poly) d += ringPath(ring);
    const pts = poly[0].map(([lon, lat]) => P(lon, lat));
    let A = 0, cx = 0, cy = 0; for (let i = 0; i < pts.length; i++){ const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], f = x0 * y1 - x1 * y0; A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
    if (Math.abs(A) > bestA){ bestA = Math.abs(A); best = [cx / (3 * A), cy / (3 * A)]; }
  }
  // kust: grenzen die maar bij één land horen
  const zcount = {};
  for (const g of members){
    const mesh = tj.mesh(topo, topo.objects.countries, (a, b) => a === b && a === g);
    for (const line of mesh.coordinates) for (const [lon, lat] of line){ if (id === "FRA" && lon < -30) continue; const [x, y] = P(lon, lat), z = zoneAt(x, y); if (z) zcount[z] = (zcount[z] || 0) + 1; }
  }
  const zee = Object.entries(zcount).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([z]) => z);
  out.push({id, name: naam, kort, continent: cont, arch, income: inc, upkeep: upk, lore, d, cx: Math.round(best[0]), cy: Math.round(best[1]), neighbors: [...(neighbors[id] || [])].sort(), zee});
}
for (const o of out){ if (extraD[o.id]) o.d += extraD[o.id]; }
const drop = (a, b) => { for (const [x, y] of [[a, b], [b, a]]){ const o = out.find(q => q.id === x); o.neighbors = o.neighbors.filter(n => n !== y); } };
drop("FRA", "BRA"); drop("FRA", "GCO");
// handmatige aanpassingen: label-posities die op de kaart beter liggen
const fix = {USA: [-98, 39], CAN: [-105, 58], RUS: [95, 62], CHN: [104, 34], INS: [114, -1], PAC: [146, -6], CAR: [-74, 19.5], BLK: [22, 43], OEU: [28, 52.5], SCA: [17, 63], ARB: [46, 22], AND: [-70, -16], CSU: [-63, -34], ZOA: [33, -12], HRN: [40, 6]};
for (const o of out) if (fix[o.id]){ const [x, y] = P(...fix[o.id]); o.cx = Math.round(x); o.cy = Math.round(y); }
const LBL = {Z1: [-40, 47], Z2: [-18, -25], Z3: [-77, 14.5], Z4: [2, 58], Z5: [16, 35.5], Z6: [34, 43.5], Z7: [20, 81.5], Z8: [-138, 30], Z9: [-118, -30], Z10: [80, -24], Z11: [62, 16], Z12: [89, 3], Z13: [114, 13], Z14: [126, 25], Z15: [160, -40], Z16: [20, -56]};
const zones = SEAS.map(([id, naam, bonus, pts]) => ({id, naam, bonus, anchors: pts.map(p => P(p[0], p[1])), lx: Math.round(P(...LBL[id])[0]), ly: Math.round(P(...LBL[id])[1])}));
const data = {w: W, h: H, frame, zones, territories: out};
fs.writeFileSync(process.argv[2], JSON.stringify(data));
console.error("grootte", JSON.stringify(data).length, "hoogte", H);
for (const o of out) console.error(o.id, "buren", o.neighbors.join(","), "zee", o.zee.join(","));
