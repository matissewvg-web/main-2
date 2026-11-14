/* Chrome Ledger engine, deel engine-wereld.js: wereld: kaart, zee, dominantie, eigen soorten, personeel, rivalen en acties. 7.4: de engine staat in zes bestanden die in deze volgorde laden (kern, wereld, leven, producten, gm, opslag); alles deelt dezelfde globale scope. */
/* ---------- de stad: elke game een andere kaart ---------- */
const VERSION = "11.13";
const MAP_W = 1000, MAP_H = 680;
const RIVAL_COLORS = ["#ff9a1f", "#3d7bff", "#c6ff2e", "#f2f2f2", "#9b5cff", "#ffd400", "#ff4d4d"];
const ARCH = {
  haven: {names: ["Haven", "Dokken", "Kadewijk", "Pier Zeven", "Containerveld"], inc: [5, 7], upk: [2, 2], kust: true, tags: ["haven"], lore: "Docks, containers en smokkel. Goedkope logistiek, een sterke vakbond, en de zee als achterdeur."},
  industrie: {names: ["Staal", "Smeltwijk", "Ovenbuurt", "Ketelveld"], inc: [6, 8], upk: [3, 3], tags: ["industrie"], lore: "Fabrieken en lage lonen. Veel arbeid, veel stof, weinig vragen."},
  corporate: {names: ["Glas", "Torenveld", "Spiegelstad", "Het Atrium"], inc: [9, 11], upk: [5, 6], tags: ["corporate"], lore: "Corpotorens. Prestige, dure grond en privébeveiliging op elke hoek."},
  oud: {names: ["Oude Stad", "Stadhuiswijk", "Grachtengordel", "Het Gerecht"], inc: [4, 6], upk: [2, 2], tags: ["bestuur"], lore: "Politie, bank en bureaucratie. Hier worden vergunningen en kredieten geregeld."},
  transit: {names: ["De Kruising", "Knooppunt", "Spoorhart", "Viaduct"], inc: [7, 9], upk: [3, 3], tags: ["transit"], lore: "Alles komt hier langs: treinen, data, mensen en wat ze bij zich hebben."},
  nacht: {names: ["Neon Mile", "Lichtkwartier", "De Gloed", "Kitschkade"], inc: [7, 9], upk: [3, 4], tags: ["straat", "media"], lore: "Media, nachtleven en vice. Wie hier gezien wordt, bestaat."},
  sloppen: {names: ["Roest", "Kolenkuil", "De Put", "Blikstad"], inc: [2, 4], upk: [1, 1], tags: ["straat"], lore: "Armoede en zwarte markt. Goedkope rekruten, dure fouten."},
  campus: {names: ["Campus", "Laboratoria", "Kennisheuvel", "Instituut"], inc: [5, 7], upk: [2, 3], tags: ["onderzoek"], lore: "Universiteit en labs. Talent, onderzoek en studenten met schulden."},
  data: {names: ["Koelvelden", "Serverpark", "De Stroom"], inc: [7, 9], upk: [4, 4], tags: ["data"], lore: "Datacentra en koeltorens. Wie hier zit, ziet alles langskomen."},
  markt: {names: ["Zwarte Bazaar", "Marktveld", "De Ruil"], inc: [5, 7], upk: [2, 2], tags: ["straat", "handel"], lore: "Handel zonder kassabon. Alles is te koop, ook stilte."},
  villa: {names: ["Heuvelrand", "Lindenhof", "Het Park"], inc: [6, 8], upk: [3, 4], tags: ["elite"], lore: "Villa's achter hekken. Geld, connecties en advocaten met een eigen ingang."},
};
const CITY_NAMES = ["Meridian Bay", "Nieuw-Kaapstad", "Vexholm", "Port Aurel", "Zuiderkap", "Grauwhaven", "Nordmund", "Galeborg", "Lichthaven", "Kalmar Delta", "Ostrava Kust", "Saltmere"];
const SEA_NAMES = ["De Noordgeul", "Olievlakte", "Wrakkenveld", "Zoutkanaal", "Grijze Rede", "De Diepte", "Ankerbank", "Mistgat"];
function shuffleR(a, rng){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function clipHalf(poly, a, b, c){
  const out = [];
  for (let i = 0; i < poly.length; i++){
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const pin = a * P[0] + b * P[1] <= c + 1e-9, qin = a * Q[0] + b * Q[1] <= c + 1e-9;
    if (pin) out.push(P);
    if (pin !== qin){ const t = (c - a * P[0] - b * P[1]) / (a * (Q[0] - P[0]) + b * (Q[1] - P[1])); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
  }
  return out;
}
function cellOf(i, sites, land){
  let poly = land; const [x1, y1] = sites[i];
  for (let j = 0; j < sites.length && poly.length >= 3; j++){
    if (j === i) continue; const [x2, y2] = sites[j];
    poly = clipHalf(poly, x2 - x1, y2 - y1, (x2 * x2 + y2 * y2 - x1 * x1 - y1 * y1) / 2);
  }
  return poly;
}
function centroid(poly){
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++){ const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length], f = x0 * y1 - x1 * y0; A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
  A /= 2; if (Math.abs(A) < 1e-6) return poly[0]; return [cx / (6 * A), cy / (6 * A)];
}
function genDistricts(seed){
  const rng = seeded("stad:" + seed), n = 10 + Math.floor(rng() * 4);
  const list = ["haven", "haven", "industrie", "corporate", "oud", "transit", "nacht", "sloppen", "campus"];
  const extra = ["data", "markt", "villa", "industrie", "sloppen", "transit", "haven", "nacht"];
  while (list.length < n) list.push(extra[Math.floor(rng() * extra.length)]);
  const used = new Set();
  return list.map((a, i) => {
    const A = ARCH[a]; let nm = A.names[0];
    for (let k = 0; k < 12; k++){ nm = A.names[Math.floor(rng() * A.names.length)]; if (!used.has(nm)) break; }
    if (used.has(nm)) nm = nm + " " + ["Noord", "Zuid", "Oost", "West"][i % 4]; used.add(nm);
    return {id: String.fromCharCode(65 + i), name: nm, arch: a, control: "neutral",
      income: A.inc[0] + Math.round(rng() * (A.inc[1] - A.inc[0])), upkeep: A.upk[0] + Math.round(rng() * (A.upk[1] - A.upk[0])), lore: A.lore, tags: [...A.tags]};
  });
}
function genGeometry(seed, districts, city){
  const rng = seeded("geo:" + seed), W = MAP_W, H = MAP_H, n = districts.length;
  const p1 = rng() * 6.28, p2 = rng() * 6.28, bayX = 250 + rng() * 500, bayW = 70 + rng() * 60, bayD = 40 + rng() * 55;
  const coastY = x => 95 + 26 * Math.sin(x / 95 + p1) + 13 * Math.sin(x / 31 + p2) + bayD * Math.exp(-(((x - bayX) / bayW) ** 2));
  const coast = []; for (let x = 0; x <= W; x += 20) coast.push([x, coastY(x)]);
  const land = [...coast, [W, H], [0, H]];
  let sites = [], minD = Math.sqrt(W * (H - 140) / n) * 0.72, tries = 0;
  while (sites.length < n && tries < 8000){
    tries++; const x = 30 + rng() * (W - 60), y = 130 + rng() * (H - 160);
    if (y < coastY(x) + 35) continue;
    if (sites.every(s => Math.hypot(s[0] - x, s[1] - y) > minD)) sites.push([x, y]);
    if (tries % 1500 === 0) minD *= 0.9;
  }
  while (sites.length < n) sites.push([60 + rng() * (W - 120), 260 + rng() * (H - 300)]);
  let cells;
  for (let it = 0; it < 3; it++){ cells = sites.map((_, i) => cellOf(i, sites, land)); sites = cells.map((c, i) => c.length > 2 ? centroid(c) : sites[i]); }
  cells = sites.map((_, i) => cellOf(i, sites, land));
  const xs = [0, Math.round(300 + rng() * 80), Math.round(620 + rng() * 80), W];
  const names = shuffleR([...SEA_NAMES], rng); names[1] = "Baai van " + city.split(/[ -]/)[0];
  const zones = [0, 1, 2].map(k => {
    const top = [[xs[k], 0], [xs[k + 1], 0]], cps = [[xs[k + 1], coastY(xs[k + 1])], ...coast.filter(p => p[0] > xs[k] && p[0] < xs[k + 1]).reverse(), [xs[k], coastY(xs[k])]];
    const poly = [...top, ...cps];
    return {id: "Z" + (k + 1), naam: names[k], bonus: 2 + Math.round(rng()), poly: poly.map(p => [Math.round(p[0]), Math.round(p[1])]), lx: Math.round((xs[k] + xs[k + 1]) / 2), ly: 34};
  });
  const coastal = cells.map(c => { const zs = new Set(); for (const [x, y] of c) if (y <= coastY(x) + 1.5) zs.add(x < xs[1] ? 0 : x < xs[2] ? 1 : 2); return [...zs]; });
  const idx = cells.map((_, i) => i), coastCells = shuffleR(idx.filter(i => coastal[i].length), rng), innerCells = shuffleR(idx.filter(i => !coastal[i].length), rng);
  const order = districts.map((_, i) => i).sort((a, b) => ((ARCH[districts[b].arch] || {}).kust ? 1 : 0) - ((ARCH[districts[a].arch] || {}).kust ? 1 : 0));
  const assign = {};
  for (const di of order){ const kust = (ARCH[districts[di].arch] || {}).kust; assign[di] = kust ? (coastCells.pop() ?? innerCells.pop()) : (innerCells.pop() ?? coastCells.pop()); }
  const shared = (a, b) => { let k = 0; for (const p of a) for (const q of b) if (Math.abs(p[0] - q[0]) < 0.75 && Math.abs(p[1] - q[1]) < 0.75){ k++; break; } return k; };
  const out = {};
  districts.forEach((d, di) => {
    const ci = assign[di], c = cells[ci], cen = centroid(c);
    out[d.id] = {poly: c.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]), cx: Math.round(cen[0]), cy: Math.round(cen[1])};
    d.zee = coastal[ci].map(k => "Z" + (k + 1));
    d.neighbors = districts.filter((e, ei) => ei !== di && shared(c, cells[assign[ei]]) >= 2).map(e => e.id);
  });
  return {seed, city, w: W, h: H, land: land.map(p => [Math.round(p[0]), Math.round(p[1])]), zones, cells: out};
}
const CITY_CACHE = {};
function genCity(seed){
  if (CITY_CACHE[seed]) return CITY_CACHE[seed];
  const city = CITY_NAMES[Math.floor(seeded("naam:" + seed)() * CITY_NAMES.length)];
  const districts = genDistricts(seed), map = genGeometry(seed, districts, city);
  return CITY_CACHE[seed] = {districts, map};
}
function buildMapForExisting(s){
  const NA = {"Haven": "haven", "Staal": "industrie", "Glas": "corporate", "Oude Stad": "oud", "De Kruising": "transit", "Neon Mile": "nacht", "Roest": "sloppen", "Campus": "campus"};
  for (const d of s.districts){ d.arch ??= NA[d.name] || "transit"; d.tags ??= [...(ARCH[d.arch] || ARCH.transit).tags]; }
  s.city ??= "Meridian Bay";
  s.map = genGeometry("oud:" + (s.player.corp_name || "x"), s.districts, s.city);
}
/* 8.0: elke corporatie een eigen kleur: de tint die het verst ligt van alle andere (ook die van de speler); grijs blijft voor neutraal */
function hexHsl(hex){ const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i); if (!m) return null; const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return {h: null, s: 0, l}; const sat = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return {h: (h * 60 + 360) % 360, s: sat, l}; }
function hslHex(h, s2, l){ const c = (1 - Math.abs(2 * l - 1)) * s2, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join(""); }
const hueAfstand = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
function bezetteTinten(s, zonder){ const H = []; const pk = hexHsl(ownerColor(s, "player")); if (pk && pk.h != null && pk.s > 0.25) H.push(pk.h); for (const r of s.rivals || []) if (r !== zonder && r.kleur){ const k = hexHsl(r.kleur); if (k && k.h != null) H.push(k.h); } return H; }
function uniekeKleur(s, zonder){ const H = bezetteTinten(s, zonder); let best = 0, bd = -1; for (let h = 0; h < 360; h += 5){ const d = H.length ? Math.min(...H.map(x => hueAfstand(x, h))) : 180; if (d > bd){ bd = d; best = h; } } return hslHex(best, 0.85, 0.6); }
const KLEUR_MIN_AFSTAND = 24;
function kleurenUniek(s){ if (!Array.isArray(s.rivals)) return; for (const r of s.rivals){ const k = hexHsl(r.kleur), H = bezetteTinten(s, r);
    if (!k || k.h == null || k.s < 0.3 || H.some(x => hueAfstand(x, k.h) < KLEUR_MIN_AFSTAND)) r.kleur = uniekeKleur(s, r); } }
function ownerColor(s, o){ if (o === "player") return (typeof stijlKleuren === "function" && s.huisstijl && (stijlKleuren(s.huisstijl).k || {}).hex) || (s.huisstijl && s.huisstijl.kleur) || "#05d9e8"; /* 6.5: jouw (leesbare) kleur op de kaart */ if (o === "neutral") return "#3a3550"; /* 8.0: neutraal is grijs, geen corporatiekleur */ const r = s.rivals.find(x => x.name === o); return r && r.kleur ? r.kleur : "#8a8aa0"; }

/* --- zee: eskaders, overwicht per zeezone, konvooioorlog en zeeslagen (in de geest van een grand strategy-marine) --- */
const SHIP_MAX = 16, SHIP_POWER = 4;
/* 11.0: meer schepen in één zee helpen steeds minder: een vloot koopt geen zee, ze beschermt je handel */
const vlootKracht = f => SHIP_POWER * (f <= 2 ? f : 2 + Math.sqrt(f - 2) * 1.2);
const shipCost = s => r1(10 * (DIFF[s.player.difficulty] || 1));
const shipsFree = (o) => (o.schepen || 0) - Object.values(o.inzet || {}).reduce((a, b) => a + b, 0);
function navalLevels(s, owner){
  if (owner === "player") return s.divisions.filter(x => x.type === "Logistiek" || x.type === "Smokkel").reduce((a, x) => a + x.level, 0);
  const r = s.rivals.find(x => x.name === owner); return r ? (r.divs.Logistiek || 0) + (r.divs.Smokkel || 0) : 0;
}
function fleetIn(s, owner, z){
  if (owner === "player") return (s.inzet || {})[z] || 0;
  const r = s.rivals.find(x => x.name === owner); return r ? (r.inzet || {})[z] || 0 : 0;
}
function seaControl(s){
  if (!s.map) return [];
  return s.map.zones.map(z => {
    const str = {}, kust = {}, owners = ["player", ...s.rivals.map(r => r.name)], namen = new Set(owners);
    /* 11.0: de kust telt naar wie er echt zit (aandeel in het land: winkels, contracten, vestigingen), niet naar wie het land op papier heeft */
    for (const d of s.districts){ if (!(d.zee || []).includes(z.id)) continue; const w = (d.arch === "haven" ? 3 : 1) * 1.5;
      if (d.dom){ for (const [o, v] of Object.entries(d.dom)) if (namen.has(o)) kust[o] = (kust[o] || 0) + w * v / 100; } else if (d.control !== "neutral") kust[d.control] = (kust[d.control] || 0) + w * 0.6; }
    for (const o of Object.keys(kust)) str[o] = kust[o] * (1 + 0.1 * navalLevels(s, o));
    for (const o of owners){ const f = fleetIn(s, o, z.id); if (f) str[o] = (str[o] || 0) + vlootKracht(f); }
    for (const o of Object.keys(str)) str[o] = Math.round(str[o] * 10) / 10;
    const tot = Object.values(str).reduce((a, b) => a + b, 0); let kand = null;
    for (const [o, v] of Object.entries(str)) if (tot && v / tot > 0.5) kand = o;
    /* 11.0: overwicht moet je twee maanden volhouden; wie het al heeft, houdt het zolang hij boven 50% blijft */
    const H = (s.zeeHeld || {})[z.id], dom = !s.zeeHeld ? kand : kand && H && H.o === kand && H.n >= 2 ? kand : null;
    return {id: z.id, naam: z.naam, bonus: z.bonus, sterkte: str, totaal: tot, dominant: dom, kandidaat: kand, maanden: kand && H && H.o === kand ? H.n : 0, vloten: Object.fromEntries(owners.map(o => [o, fleetIn(s, o, z.id)]).filter(x => x[1]))};
  });
}
function reachable(s, owner, d){
  if (!d) return false; if (d.control === owner || !s.map) return true;
  if (s.districts.some(x => x.control === owner && (d.neighbors || []).includes(x.id))) return true;
  const sea = seaControl(s).filter(z => z.dominant === owner).map(z => z.id);
  return (d.zee || []).some(z => sea.includes(z));
}
function actShip(s){
  if ((s.schepen || 0) >= SHIP_MAX) return {ok: false, msg: `Maximaal ${SHIP_MAX} eskaders.`};
  if (!s.districts.some(d => d.control === "player" && (d.zee || []).length)) return {ok: false, msg: "Je hebt geen kustgebied. Zonder haven geen vloot."};
  const kost = shipCost(s); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  s.cash = r1(s.cash - kost); s.schepen = (s.schepen || 0) + 1; s.accounts.operationeel = s.cash;
  const msg = `Eskader ${s.schepen} te water gelaten: snelle boten, drones en radar. Eenmalig €${kost}M, €1,2M per maand. Wijs het toe aan een zeezone.`;
  addLog(s, msg); return {ok: true, msg};
}
function actDeploy(s, zone, delta){
  if (!s.map.zones.some(z => z.id === zone)) return {ok: false, msg: "Onbekende zeezone."};
  s.inzet ??= {}; const cur = s.inzet[zone] || 0;
  if (delta > 0 && shipsFree(s) < 1) return {ok: false, msg: "Geen vrije eskaders. Bouw er een of haal er een weg uit een andere zone."};
  if (delta < 0 && cur < 1) return {ok: false, msg: "Je hebt daar geen eskaders."};
  s.inzet[zone] = cur + (delta > 0 ? 1 : -1); if (!s.inzet[zone]) delete s.inzet[zone];
  return {ok: true, msg: ""};
}
/* elke maand: rivalen bouwen en verplaatsen, en in oorlog wordt er op zee gevochten */
function navalTick(s, ctx, diff){
  const sc = () => seaControl(s);
  for (const r of s.rivals){
    r.schepen ??= (r.vloot || 0) * 2; r.inzet ??= {};
    const coast = [...new Set(rivalDistricts(s, r).flatMap(d => d.zee || []))];
    if (coast.length && r.schepen < 10 && r.cash > 70 + r.schepen * 10 && R() < 0.12 + r.aggression * 0.1){ r.schepen += 1; r.cash = r1(r.cash - 25); }
    // herverdelen: eigen kusten, in oorlog ook waar de speler domineert
    const want = [...coast];
    if (r.status === "oorlog"){ for (const z of sc()) if (z.dominant === "player" && (coast.includes(z.id) || s.districts.some(d => d.control === "player" && (d.zee || []).includes(z.id)))) want.unshift(z.id); }
    else for (const z of sc()) if ((z.kandidaat === "player" || z.dominant === "player") && (z.sterkte[r.name] || 0) > 0.5 && R() < 0.35 + (r.aggression || 0) * 0.4 - (r.relatie || 0) / 200){ want.unshift(z.id); remember(r, s, `betwist de zee ${z.naam} met de speler`); } /* 11.0: ook in vrede vechten rivalen om de zee als ze er belang hebben */
    r.inzet = {}; if (want.length) for (let i = 0; i < r.schepen; i++){ const z = want[i % want.length]; r.inzet[z] = (r.inzet[z] || 0) + 1; }
  }
  { const oud = s.zeeHeld; s.zeeHeld = {}; for (const z of sc()){ if (!z.kandidaat) continue; const H = (oud || {})[z.id]; s.zeeHeld[z.id] = {o: z.kandidaat, n: H && H.o === z.kandidaat ? Math.min(99, H.n + 1) : (oud ? 1 : 2)};
      if (oud && z.kandidaat === "player" && s.zeeHeld[z.id].n === 2) ctx.rep.push(`Overwicht op ${z.naam}: twee maanden volgehouden`); } } /* 11.0 */
  // konvooioorlog: een vijand die een zee beheerst, knijpt de handel van jouw kustgebieden daar af
  let raid = 0;
  for (const z of sc()){
    const r = s.rivals.find(x => x.name === z.dominant && x.status === "oorlog"); if (!r) continue;
    const hit = s.districts.filter(d => d.control === "player" && (d.zee || []).includes(z.id));
    for (const d of hit) raid += d.income * 0.3;
  }
  if (raid){ raid = r1(raid); s.cash = r1(s.cash - raid); ctx.rep.push(`Konvooiaanvallen: -€${raid}M aan handel`); }
  for (const r of s.rivals.filter(x => x.status === "oorlog")){
    let loss = 0; for (const z of sc()) if (z.dominant === "player") for (const d of rivalDistricts(s, r)) if ((d.zee || []).includes(z.id)) loss += d.income * 0.3;
    if (loss){ r.cash = r1(r.cash - loss); r.moeheid = clamp(r.moeheid + 2); }
  }
}

/* ---------- de wereld: echte kaart (Natural Earth, publiek domein), 43 speelbare gebieden, 16 zeezones ---------- */
const CONTINENTS = [
  {naam: "Noord-Amerika", lore: "Ooit één supermacht, nu een lappendeken van staten waar elke corporatie haar eigen wetten koopt."},
  {naam: "Zuid-Amerika", lore: "Grondstoffen, jungle en havens. Wie de wegen en kusten beheerst, beheerst de rijkdom."},
  {naam: "Europa", lore: "Oude landen, nieuwe eigenaren. Regels die op papier streng zijn en in de praktijk te koop."},
  {naam: "Midden-Oosten", lore: "De kruising van drie continenten: pijpleidingen, zeestraten en geld dat nooit slaapt."},
  {naam: "Afrika", lore: "Het snelst groeiende continent: zonnestroom, megasteden en corporaties die om elke vierkante meter vechten."},
  {naam: "Azië", lore: "Het economische hart van de wereld. Megacorporaties die ouder zijn dan sommige staten."},
  {naam: "Oceanië", lore: "Afgelegen, rijk en goed beveiligd. Waar de elite naartoe vlucht."},
];
let WORLD_CACHE = null;
function genWorld(){
  if (WORLD_CACHE) return WORLD_CACHE;
  const D = WORLD_DATA, frame = D.frame, all = [];
  for (const z of D.zones) for (const a of z.anchors) all.push({z, a});
  const zones = D.zones.map(z => ({id: z.id, naam: z.naam, bonus: z.bonus, lx: z.lx, ly: z.ly, polys: []}));
  all.forEach((x, i) => { const poly = cellOf(i, all.map(y => y.a), frame); if (poly.length > 2) zones.find(z => z.id === x.z.id).polys.push(poly.map(p => [Math.round(p[0]), Math.round(p[1])])); });
  for (const z of zones) z.poly = z.polys[0];
  const districts = D.territories.map(t => ({id: t.id, name: t.name, kort: t.kort, continent: t.continent, arch: t.arch, control: "neutral", income: t.income, upkeep: t.upkeep, lore: t.lore, tags: [...((ARCH[t.arch] || {}).tags || [])], zee: t.zee, neighbors: t.neighbors}));
  const cells = {}; for (const t of D.territories) cells[t.id] = {d: t.d, cx: t.cx, cy: t.cy};
  return WORLD_CACHE = {districts, map: {kind: "wereld", versie: 2, city: "Wereld", w: D.w, h: D.h, frame, continents: CONTINENTS, zones, cells}};
}

/* ---------- dominantie: aandeel per continent en per zee, drempels, opbrengst per beurt ---------- */
const DOM_TIERS = [
  {min: 25, naam: "Voet aan de grond", geld: 0, inv: 1},
  {min: 50, naam: "Dominant", geld: 1, inv: 2},
  {min: 80, naam: "Hegemonie", geld: 2, inv: 4},
];
const SEA_TIERS = [
  {min: 50, naam: "Overwicht", geld: 1, inv: 0},
  {min: 80, naam: "Zeeheerschappij", geld: 2, inv: 1},
];
const SEA_MIN = 6; // zonder echte vloot geen zeeheerschappij
function tierOf(pct, tiers = DOM_TIERS){ let t = null; for (const x of tiers) if (pct >= x.min) t = x; return t; }
function nextTier(pct, tiers = DOM_TIERS){ return tiers.find(x => pct < x.min) || null; }
function regionDominance(s){
  const conts = [...new Set(s.districts.map(d => d.continent).filter(Boolean))];
  const namen = new Set(["player", ...s.rivals.map(r => r.name)]);
  return conts.map(c => {
    const ds = s.districts.filter(d => d.continent === c), tot = ds.reduce((a, d) => a + d.income, 0), by = {};
    for (const d of ds){ if (d.dom){ for (const [o, v] of Object.entries(d.dom)) if (namen.has(o)) by[o] = (by[o] || 0) + d.income * v / 100; } else if (d.control !== "neutral") by[d.control] = (by[d.control] || 0) + d.income; } /* 5.6: aandelen per district */
    const shares = Object.entries(by).map(([o, v]) => ({o, pct: Math.round(v / tot * 100)})).sort((a, b) => b.pct - a.pct);
    return {soort: "continent", id: c, naam: c, totaal: tot, waarde: Math.max(2, Math.round(tot * 0.12)), shares, gebieden: ds.length};
  });
}
function dominanceIncome(s, owner){
  let geld = 0, inv = 0; const regels = [];
  for (const r of regionDominance(s)){
    const sh = r.shares.find(x => x.o === owner), pct = sh ? sh.pct : 0, t = tierOf(pct);
    if (t){ const g = r.waarde * t.geld * gebiedF(s); geld += g; /* 8.2 */ inv += t.inv; regels.push({soort: "continent", naam: r.naam, pct, tier: t.naam, geld: g, inv: t.inv}); }
  }
  for (const z of seaControl(s)){
    const v = z.sterkte[owner] || 0, pct = z.totaal ? Math.round(v / z.totaal * 100) : 0, t = v >= SEA_MIN && z.dominant === owner ? tierOf(pct, SEA_TIERS) : null; /* 11.0: alleen als je het overwicht vasthoudt */
    if (t){ const g = z.bonus * t.geld; geld += g; inv += t.inv; regels.push({soort: "zee", naam: z.naam, pct, tier: t.naam, geld: g, inv: t.inv}); }
  }
  return {geld: r1(geld), inv, regels};
}
/* invloed besteden: een soort politieke macht die je per beurt opbouwt */
const INFLUENCE = {
  pers: {label: "Mediacampagne", kost: 20, uitleg: "Reputatie +5."},
  rust: {label: "Rust in de straat", kost: 20, uitleg: "Heat -8: de juiste mensen kijken even de andere kant op."},
  lobby: {label: "Lobbyen", kost: 25, uitleg: "Een factie naar keuze +15."},
  diplomatie: {label: "Diplomatieke druk", kost: 30, uitleg: "Relatie met een rivaal naar keuze +15."},
  vergunning: {label: "Vergunning op maat", kost: 35, uitleg: "Je volgende vestiging kost geen geld, alleen de opbouwtijd."},
};
function actInfluence(s, kind, target){
  const a = INFLUENCE[kind]; if (!a) return {ok: false, msg: "Onbekende actie."};
  if ((s.invloed || 0) < a.kost) return {ok: false, msg: `Niet genoeg invloed (${a.kost} nodig, je hebt ${Math.floor(s.invloed || 0)}).`};
  let msg;
  if (kind === "pers"){ s.reputation = clamp(s.reputation + 5); msg = "De campagne loopt: reputatie +5."; }
  else if (kind === "rust"){ s.heat = clamp(s.heat - 8); msg = "Een paar telefoontjes later: heat -8."; }
  else if (kind === "lobby"){ if (!s.factions[target]) return {ok: false, msg: "Kies een factie."}; shiftFaction(s, target, 15); msg = `Gelobbyd bij ${target}: +15.`; }
  else if (kind === "diplomatie"){ const r = s.rivals.find(x => x.name === target); if (!r) return {ok: false, msg: "Kies een rivaal."}; relShift(r, 15); msg = `Druk via tussenpersonen: relatie met ${r.name} +15.`; }
  else if (kind === "vergunning"){ if (s.flags.vergunning) return {ok: false, msg: "Je hebt al een vergunning klaarliggen."}; s.flags.vergunning = true; msg = "Vergunning geregeld: je volgende vestiging kost geen geld."; }
  s.invloed = r1(s.invloed - a.kost); addLog(s, `Invloed besteed (${a.kost}): ${msg}`);
  return {ok: true, msg};
}
/* oude verzonnen wereldkaart naar de echte wereld, met bezit en al */
const OLD2REAL = {CAS: "CAN", GML: "CAN", MOJ: "USA", AKF: "USA", GOL: "MEX", AMA: "BRA", RPK: "CSU", AND: "AND", LLC: "BNL", RIJ: "DEU", IBP: "IBE", NDS: "SCA", BTZ: "BLK",
  LAG: "NGA", HRN: "HRN", KAP: "ZAF", SZS: "MAG", NKP: "JPN", HDC: "CHN", MKV: "IDC", BNG: "IND", SIB: "RUS", ZKG: "AUS", TVZ: "PAC"};
function upgradeToRealWorld(s){
  const W = genWorld(), nd = clone(W.districts), conv = id => OLD2REAL[id] || id;
  s.player.home_district = conv(s.player.home_district);
  const home = nd.find(x => x.id === s.player.home_district) || nd.find(x => x.id === "BNL"); s.player.home_district = home.id; home.control = "player";
  for (const d of s.districts) if (d.control !== "neutral"){ const t = nd.find(x => x.id === conv(d.id)); if (t && t.control === "neutral") t.control = d.control; }
  for (const r of s.rivals){
    let t = nd.find(x => x.id === conv(r.hq));
    if (!t || (t.control !== "neutral" && t.control !== r.name)){ const free = nd.filter(x => x.control === "neutral" && x.continent !== home.continent); t = free[Math.floor(R() * free.length)]; }
    if (t){ r.hq = t.id; t.control = r.name; }
    r.kleur = undefined; r.inzet = {};
  }
  for (const p of s.projects){ if (p.district) p.district = conv(p.district); if (p.on_complete && p.on_complete.district_control) p.on_complete.district_control = conv(p.on_complete.district_control); }
  for (const o of s.aanbiedingen || []) if (o.district) o.district = conv(o.district);
  s.districts = nd; s.map = clone(W.map); s.city = "Wereld"; s.inzet = {};
  if (s.log) addLog(s, "De kaart is bijgewerkt naar de echte wereld. Je bezit en je hoofdkantoor zijn meeverhuisd.");
}

/* ---------- eigen bedrijfssoorten & personeel ---------- */
const PRESETS = {
  veilig: {rev: 7, cost: 4, heat: 0, vol: 0.15, label: "Veilig", uitleg: "Stabiel, weinig marge, geen aandacht"},
  gebalanceerd: {rev: 9, cost: 5.5, heat: 1, vol: 0.3, label: "Gebalanceerd", uitleg: "Gemiddeld in alles"},
  groei: {rev: 11, cost: 7, heat: 1, vol: 0.45, label: "Groei", uitleg: "Duur, schommelt, kan veel opleveren"},
  riskant: {rev: 12, cost: 6, heat: 2, vol: 0.5, label: "Riskant", uitleg: "Hoge marge, trekt aandacht"},
  illegaal: {rev: 14, cost: 4, heat: 4, vol: 0.5, label: "Illegaal", uitleg: "Veel geld, veel heat"},
};
function typeOf(s, t){ return DT[t] || (s && s.custom_types ? s.custom_types[t] : undefined); }
function allTypes(s){ return [...SECTORS, ...Object.keys((s && s.custom_types) || {})]; }
function addCustomType(s, naam, stats, omschrijving){
  naam = String(naam || "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (naam.length < 2) return {ok: false, msg: "Geef de soort een naam."};
  if (typeOf(s, naam)) return {ok: false, msg: "Die soort bestaat al."};
  const cost = clamp(+stats.cost || 5, 3, 8), rev = Math.min(clamp(+stats.rev || 9, 5, 14), cost + 7);
  const ty = {rev: r1(rev), cost: r1(cost), heat: Math.round(clamp(+stats.heat || 0, 0, 4)), vol: Math.round(clamp(+stats.vol || 0.3, 0.1, 0.5) * 100) / 100,
    omschrijving: String(omschrijving || "").slice(0, 240), eigen: true};
  s.custom_types ??= {}; s.custom_types[naam] = ty;
  s.market ??= {}; s.market[naam] ??= {size: 100, player: 0, rivals: Object.fromEntries(s.rivals.map(r => [r.name, 0]))};
  if (s.log) addLog(s, `Nieuwe bedrijfssoort: ${naam} (omzet ${ty.rev}, kosten ${ty.cost}, heat ${ty.heat} per niveau).`);
  return {ok: true, msg: `Soort '${naam}' aangemaakt.`, naam};
}
const SALARY = {laag: 24, marktconform: 30, hoog: 36};
const staffNeed = s => Math.round((6 + s.divisions.reduce((a, d) => a + d.level * 4, 0) + s.districts.filter(d => d.control === "player").length) * (npcActive(s, "staf") ? 0.9 : 1));
function staffFactor(s){ const f = s.staff.count / Math.max(1, staffNeed(s)); return f >= 1 ? 1 : 0.45 + 0.55 * f; }
function actStaff(s, kind, n){
  n = Math.round(+n || 0); const hard = s.culture.layoff_policy === "hard";
  if (kind === "huren"){
    if (n < 1 || n > 50) return {ok: false, msg: "Kies tussen 1 en 50 mensen."};
    const cost = r1(n * 0.4); if (s.cash < cost) return {ok: false, msg: `Werving kost €${cost}M. Niet genoeg cash.`};
    s.cash = r1(s.cash - cost); s.staff.count += n; s.accounts.operationeel = s.cash;
    const msg = `${n} mensen aangenomen. Werving €${cost}M; loonkosten stijgen met ≈€${r1(n * s.staff.avg_salary / 120)}M per maand.`; addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "ontslaan"){
    if (n < 1) return {ok: false, msg: "Kies hoeveel mensen."};
    n = Math.min(n, s.staff.count - 5); if (n < 1) return {ok: false, msg: "Onder de 5 mensen is er geen bedrijf meer."};
    const cost = r1(n * (hard ? 0.4 : 1)); if (s.cash < cost) return {ok: false, msg: `Ontslagvergoedingen kosten €${cost}M. Niet genoeg cash.`};
    s.cash = r1(s.cash - cost); s.staff.count -= n; s.accounts.operationeel = s.cash;
    s.morale = clamp(s.morale - Math.ceil(n / 3) * (hard ? 1 : 1.5)); shiftFaction(s, "vakbond", -Math.ceil(n / (hard ? 1 : 2)));
    const msg = `${n} mensen ontslagen. Vergoedingen €${cost}M. De werkvloer heeft het gezien.`; addLog(s, msg); return {ok: true, msg};
  }
  if (SALARY[kind]){
    const old = s.staff.avg_salary, nw = SALARY[kind]; if (old === nw) return {ok: false, msg: "Dat is al het salarisniveau."};
    s.staff.avg_salary = nw;
    if (nw < old){ s.morale = clamp(s.morale - 6); shiftFaction(s, "vakbond", -8); } else s.morale = clamp(s.morale + 3);
    const msg = `Salarisniveau naar ${kind} (gemiddeld €${nw}M per jaar).`; addLog(s, msg); return {ok: true, msg};
  }
  return {ok: false, msg: "Onbekende actie."};
}

/* ---------- rivalen als echte tegenstanders: economie, macht, diplomatie, oorlog ---------- */
const STATUS_LABEL = {vrede: "vrede", oorlog: "oorlog", wapenstilstand: "wapenstilstand"};
function initRival(r){
  r.divs ??= {[r.sector]: 3};
  r.staff ??= 30 + Math.round(R() * 15);
  r.defensie ??= r.aggression > 0.5 ? 1 : 0;
  r.relatie ??= Math.round(15 - r.aggression * 45);
  r.status ??= "vrede"; r.statusMaanden ??= 0; r.moeheid ??= 0; r.verdragen ??= []; r.schepen ??= (r.vloot || 0) * 2; r.inzet ??= {}; r.hebzucht ??= Math.round(U(0.3, 0.8) * 100) / 100;
  return r;
}
const rivalDistricts = (s, r) => s.districts.filter(d => d.control === r.name);
const playerDistricts = s => s.districts.filter(d => d.control === "player");
function playerPower(s){
  const sec = s.divisions.filter(d => d.type === "Private Security").reduce((a, d) => a + d.level, 0) + s.divisions.filter(d => d.type === "Weapon Manufacturing").reduce((a, d) => a + d.level, 0) * 0.5; /* 6.10: een eigen wapenfabriek telt half mee */
  return Math.round(10 + (s.defensie || 0) * 12 + sec * 8 + s.staff.count / 10 + playerDistricts(s).length * 3 + s.reputation / 10 + (npcActive(s, "macht") ? 6 : 0) + (s.flags.alert ? 8 : 0) + legerMacht(s) + productMacht(s) + patrouilles(s).length * 2);
}
function rivalPower(s, r){
  return Math.round(10 + (r.defensie || 0) * 12 + (r.divs["Private Security"] || 0) * 8 + (r.divs["Weapon Manufacturing"] || 0) * 4 + r.staff / 10 + rivalDistricts(s, r).length * 3);
}
const districtValue = d => Math.round(d.income * 10 + 10);
function freeDistricts(s, exclude){ return s.districts.filter(d => d.control === "neutral" && d.id !== exclude); }
function releaseDistricts(s, r, to = "neutral"){ for (const d of s.districts) if (d.control === r.name) d.control = to; }
function relShift(r, v){ r.relatie = Math.round(clamp(r.relatie + v, -100, 100)); }
function atWar(s){ return s.rivals.filter(r => r.status === "oorlog"); }

/* 11.11: strijdkracht per soort in plaats van één machtsgetal. Wat elk bedrijf echt heeft telt: een wapenfabriek met een beveiligingsleger wint een open oorlog van een smokkelaar, maar die kan terugslaan met sabotage en hacks. Kansen hangen van de verhouding af, dus in het begin (als niemand veel heeft) is het vooral geluk. */
const KRACHT_DIV = {militair: {"Private Security": 10, "Weapon Manufacturing": 7, "Orbitaal": 3, "Logistiek": 2}, heimelijk: {"Media & Data": 8, "Smokkel": 8, "Cyberware": 5, "Financieel": 2}, media: {"Media & Data": 8, "Financieel": 3}};
const KRACHT_AARD = {wapen: ["militair", 3], beveiliging: ["militair", 2], implantaat: ["militair", 1], data: ["heimelijk", 2], smokkel: ["heimelijk", 2]};
const KRACHT_LABEL = {militair: "Militair", heimelijk: "Heimelijk", media: "Media"};
function strijdkracht(s, wie){ const P = wie === "player", r = P ? null : wie, k = {militair: 5, heimelijk: 5, media: 5}, uit = {militair: [], heimelijk: [], media: []}, add = (soort, v, wat) => { v = Math.round(v); if (!v) return; k[soort] += v; uit[soort].push([wat, v]); };
  const divs = {}; if (P) for (const d of s.divisions) divs[d.type] = (divs[d.type] || 0) + d.level; else Object.assign(divs, r.divs || {});
  for (const [soort, T] of Object.entries(KRACHT_DIV)) for (const [t, w] of Object.entries(T)) if (divs[t]) add(soort, divs[t] * w, `${t} niveau ${divs[t]}`);
  const prods = P ? (s.producten || []).filter(p => p.status === "markt") : (r.producten || []);
  const per = {}; for (const p of prods){ const aard = p.aard || aardVan(p.type, p.naam), x = KRACHT_AARD[aard]; if (x) per[x[0] + "|" + aard] = (per[x[0] + "|" + aard] || 0) + (p.kwaliteit || 1) * x[1]; }
  for (const [key, v] of Object.entries(per)){ const [soort, aard] = key.split("|"); add(soort, v, `eigen ${PRODUCT_AARD[aard] ? PRODUCT_AARD[aard].label.toLowerCase() : aard} op de markt`); }
  const def = P ? s.defensie || 0 : r.defensie || 0; if (def) add("militair", def * 8, `verdediging niveau ${def}`);
  if (P){ const lm = legerMacht(s); if (lm) add("militair", lm, "huurleger"); const pt = patrouilles(s).length; if (pt) add("militair", pt * 3, `${pt} patrouille${pt === 1 ? "" : "s"}`);
    for (const m of s.crew || []){ if (m.rol === "huurling") add("militair", (m.niveau || 1) * 2, `huurling ${m.naam}`); if (m.rol === "netrunner") add("heimelijk", (m.niveau || 1) * 3, `netrunner ${m.naam}`); if (m.rol === "spindokter") add("media", (m.niveau || 1) * 3, `spindokter ${m.naam}`); }
    add("media", (s.reputation || 0) / 4, "reputatie"); add("militair", playerDistricts(s).length * 2, "eigen gebied (bases)"); }
  else { add("militair", rivalDistricts(s, r).length * 2, "eigen gebied (bases)"); add("media", 8, "pr-afdeling"); }
  return {...k, uit}; }
const WAR_SOORT = {sabotage: "heimelijk", hack: "heimelijk", smaad: "media", overval: "militair", hq: "militair", straat: "militair"};
const krachtVerdediging = (K, soort) => soort === "heimelijk" ? K.heimelijk * 0.7 + K.militair * 0.3 : K[soort]; /* beveiliging helpt ook tegen sabotage */
const krachtKans = (A, D) => 45 * (A - D) / Math.max(1, A + D);
function warChance(s, r, mod, kind = "overval"){ const soort = WAR_SOORT[kind] || "militair", A = strijdkracht(s, "player")[soort], D = krachtVerdediging(strijdkracht(s, r), soort) * (kind === "hq" ? 1.2 : 1); return snapKans(Math.round(clamp(50 + krachtKans(A, D) + mod + (s.flags.fixer_klus ? 15 : 0) + (s.flags["dossier_" + r.name] ? 15 : 0), 5, 90))); }
function rivalHitChance(s, r, mod, kind = "overval"){ const soort = WAR_SOORT[kind] || "militair", A = strijdkracht(s, r)[soort], D = krachtVerdediging(strijdkracht(s, "player"), soort) * (kind === "overval" || kind === "straat" ? 1.1 : 1); return clamp(50 + krachtKans(A, D) + mod, 8, 88); }
const WAR = {
  sabotage: {label: "Sabotage", uitleg: "Brand in een loods, kapotte machines, zendingen die verdwijnen.", kost: 5, mod: 0, heat: 4},
  hack: {label: "Hack", uitleg: "Hun klantdata stelen en verkopen. Hun klanten gaan twijfelen.", kost: 7, mod: -5, heat: 2},
  smaad: {label: "Smaadcampagne", uitleg: "Journalisten met mapjes, anonieme blogs, een lek op het juiste moment.", kost: 3, mod: 10, heat: 1},
  overval: {label: "Gebied overnemen", uitleg: "Hun vestigingen, contacten en mensen in dat land overnemen.", kost: 14, mod: -10, heat: 8, district: true},
  hq: {label: "Aanval op hun HQ", uitleg: "Alles of niets. Lukt het, dan valt hun bedrijf en neem jij hun districten over.", kost: 45, mod: -30, heat: 15},
};
function defeatRival(s, ctx, r, how){
  const loot = r1(Math.max(0, r.cash) * 0.3);
  releaseDistricts(s, r, how === "oorlog" ? "player" : "neutral");
  s.rivals = s.rivals.filter(x => x !== r);
  for (const m of Object.values(s.market)){ m.player += (m.rivals[r.name] || 0) * 0.4; delete m.rivals[r.name]; }
  s.aanbiedingen = s.aanbiedingen.filter(o => o.rival !== r.name);
  if (how === "oorlog"){
    s.cash = r1(s.cash + loot); s.reputation = clamp(s.reputation - 10); s.heat = clamp(s.heat + 15);
    for (const o of s.rivals){ relShift(o, -15); o.aggression = Math.min(1, Math.round((o.aggression + 0.1) * 100) / 100); remember(o, s, `speler vernietigde ${r.name}`); }
    mail(ctx, s, "Journalist", `${r.name} valt na aanval op hoofdkantoor`, `Het hoofdkantoor van ${r.name} is gisteravond overgenomen. ${r.ceo} is onbereikbaar. Bronnen noemen uw bedrijf. De rest van de stad heeft het ook gezien.`, "KRITIEK");
    addLog(s, `${r.name} verslagen in oorlog. Buit €${loot}M, hun districten zijn van ons.`);
  }
}

/* --- jouw zetten tegen of met een rivaal --- */
function actWar(s, ctx, name, kind, districtId){
  const r = s.rivals.find(x => x.name === name), w = WAR[kind];
  if (!r || !w) return {ok: false, msg: "Onbekende actie."};
  if (r.status !== "oorlog") return {ok: false, msg: `Je bent niet in oorlog met ${r.name}. Verklaar eerst de oorlog.`};
  let target = null;
  if (w.district){ target = s.districts.find(d => d.id === districtId && d.control === r.name && d.id !== r.hq); if (!target) return {ok: false, msg: "Kies een district van hen (niet hun HQ)."};
    if (!reachable(s, "player", target)) return {ok: false, msg: `${target.name} grenst niet aan jouw gebied en ligt niet aan een zee die jij beheerst.`}; }
  if (kind === "hq"){ const hqd = s.districts.find(d => d.id === r.hq); if (hqd && !reachable(s, "player", hqd)) return {ok: false, msg: "Hun hoofdkantoor ligt buiten bereik. Je gebied moet eraan grenzen, of je moet de zee ervoor beheersen."}; }
  if (kind === "hq" && rivalDistricts(s, r).length > 1 && strijdkracht(s, r).militair > strijdkracht(s, "player").militair * 0.8) return {ok: false, msg: "Hun HQ is nog te goed beschermd. Neem eerst hun andere districten in of verzwak hun macht."};
  const kost = r1(w.kost * (DIFF[s.player.difficulty] || 1) * (relV(s, "fixer") >= 50 ? 0.8 : 1));
  if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  s.cash = r1(s.cash - kost);
  const kans = warChance(s, r, w.mod, kind), roll = rolKans(kans), ok = roll.ok;
  addRoll(s, `${w.label} tegen ${r.name}: ${roll.txt} → ${ok ? "GELUKT" : "MISLUKT"}`); delete s.flags.fixer_klus; delete s.flags["dossier_" + r.name];
  s.heat = clamp(s.heat + (ok ? w.heat : w.heat / 2)); s.reputation = clamp(s.reputation - 1); relShift(r, -8);
  let msg;
  if (ok){
    r.moeheid = clamp(r.moeheid + 10);
    if (kind === "sabotage"){ const l = r1(U(15, 30)); r.cash = r1(r.cash - l); if (R() < 0.3 && r.divs[r.sector] > 1) r.divs[r.sector] -= 1; msg = `Sabotage bij ${r.name} geslaagd. Schade bij hen ongeveer €${l}M.`; }
    else if (kind === "hack"){ const l = r1(U(8, 16)), g = r1(U(4, 10)); r.cash = r1(r.cash - l); s.cash = r1(s.cash + g);
      const m = s.market[r.sector]; if (m){ m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.85; m.player += 0.03; } msg = `Hack geslaagd. Hun data leverde €${g}M op en hun klanten twijfelen.`; }
    else if (kind === "smaad"){ r.moeheid = clamp(r.moeheid + 6); const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.9; msg = `De campagne tegen ${r.name} slaat aan. Hun klanten en hun eigen mensen worden onrustig.`; }
    else if (kind === "overval"){ target.control = "player"; r.moeheid = clamp(r.moeheid + 15); r.cash = r1(r.cash - 10); msg = `${target.name} is van ons. ${r.name} is een district kwijt.`; }
    else if (kind === "hq"){ defeatRival(s, ctx, r, "oorlog"); msg = `Hun hoofdkantoor is gevallen. ${r.name} bestaat niet meer.`; }
    remember(r, s, `${w.label.toLowerCase()} door speler`);
  } else {
    r.moeheid = clamp(r.moeheid - 5);
    msg = `${w.label} mislukt. ${r.name} weet wie het was.`;
    if (R() < 0.4){ const l = r1(U(5, 15)); s.cash = r1(s.cash - l); msg += ` Ze sloegen direct terug: €${l}M schade.`; }
    remember(r, s, `mislukte ${w.label.toLowerCase()} door speler`);
  }
  mail(ctx, s, ok ? "Head of Security" : "Juridische Zaken", `${w.label} tegen ${r.name}: ${ok ? "gelukt" : "mislukt"}`, msg + ` (Worp ${roll.txt}.)`, ok ? "NORMAAL" : "HOOG");
  addLog(s, msg); s.accounts.operationeel = s.cash;
  return {ok: true, msg: msg + ` Worp ${roll.txt}.`};
}
function peaceChance(s, r, herstel){ return snapKans(Math.round(clamp(20 + r.moeheid * 0.6 + (playerPower(s) - rivalPower(s, r)) * 0.8 + (+herstel || 0) / 2 + r.relatie * 0.2, 5, 95))); }
function tradeChance(s, r){ return snapKans(Math.round(clamp(35 + r.relatie * 0.6 - r.aggression * 25 + r.hebzucht * 10, 5, 95))); }
function tradeAmount(s, r){ const lv = s.divisions.reduce((a, d) => a + d.level, 0) + Object.values(r.divs).reduce((a, b) => a + b, 0); return r1(2 + lv * 0.4); }
const askPrice = (s, r, d) => Math.round(districtValue(d) * (1.6 - r.relatie / 200) * (0.8 + r.hebzucht * 0.5));
const bidPrice = (s, r, d) => Math.round(districtValue(d) * (0.7 + r.relatie / 400) * (1.1 - r.hebzucht * 0.3));
function actDiplo(s, ctx, name, kind, a = {}){
  const r = s.rivals.find(x => x.name === name); if (!r) return {ok: false, msg: "Die rivaal bestaat niet meer."};
  const roll = () => d100();
  if (kind === "oorlog"){
    if (r.status === "oorlog") return {ok: false, msg: "Jullie zijn al in oorlog."};
    let msg = `Oorlog verklaard aan ${r.name}.`;
    if (r.verdragen.length){ r.verdragen = []; s.reputation = clamp(s.reputation - 6); msg += " Het handelsverdrag is verscheurd; de stad onthoudt woordbreuk."; }
    if (r.status === "wapenstilstand"){ s.reputation = clamp(s.reputation - 8); msg += " Je breekt een wapenstilstand."; }
    const OP = oorlogPrijs(s); r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -40); s.reputation = clamp(s.reputation - OP.rep); s.heat = clamp(s.heat + OP.heat); if (OP.corpo){ r.corpo = true; msg += " Een corpo-oorlog: de staat kijkt weg."; }
    for (const o of s.rivals) if (o !== r){ if (OP.wantrouw) relShift(o, -OP.wantrouw); remember(o, s, `speler verklaarde ${r.name} de oorlog`); }
    remember(r, s, "speler verklaarde de oorlog");
    mail(ctx, s, r.ceo, "Zo zij het", `U heeft gekozen. ${r.name} ook. Vanaf vandaag zijn er geen regels meer tussen ons.`, "KRITIEK");
    addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "vrede"){
    if (r.status !== "oorlog") return {ok: false, msg: "Er is geen oorlog om te beëindigen."};
    const h = Math.max(0, Math.round(+a.bedrag || 0)); if (s.cash < h) return {ok: false, msg: `Je hebt geen €${h}M om te bieden.`};
    const kans = peaceChance(s, r, h), w = rolKans(kans), ok = w.ok;
    addRoll(s, `Vredesvoorstel aan ${r.name}${h ? ` (herstel €${h}M)` : ""}: ${w.txt} → ${ok ? "AANVAARD" : "AFGEWEZEN"}`);
    if (ok){ s.cash = r1(s.cash - h); r.cash = r1(r.cash + h); r.status = "wapenstilstand"; r.statusMaanden = 6; r.moeheid = 0; relShift(r, 20);
      mail(ctx, s, r.ceo, "Wapenstilstand", `Zes maanden. Daarna zien we verder. Breek dit en de hele stad weet wat uw woord waard is.`, "HOOG"); }
    else { relShift(r, -3); mail(ctx, s, r.ceo, "Nee", `${r.name} is nog niet klaar met u.`, "HOOG"); }
    const msg = ok ? `Wapenstilstand met ${r.name} voor 6 maanden.` : `${r.name} weigert vrede. (Worp ${w.txt}.)`;
    addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "handel"){
    if (r.status === "oorlog") return {ok: false, msg: "Geen handel in oorlogstijd."};
    if (r.verdragen.length) return {ok: false, msg: "Er loopt al een handelsverdrag."};
    if (r.relatie < -20) return {ok: false, msg: `${r.name} wil niet eens praten. Verbeter eerst de relatie.`};
    const kans = tradeChance(s, r), bedrag = tradeAmount(s, r), w = rolKans(kans), ok = w.ok;
    addRoll(s, `Handelsverdrag met ${r.name}: ${w.txt} → ${ok ? "GETEKEND" : "AFGEWEZEN"}`);
    if (ok){ r.verdragen.push({type: "handel", bedrag, maanden: 12}); relShift(r, 10);
      mail(ctx, s, r.ceo, "Getekend", `Twaalf maanden samenwerking. Beide kanten verdienen er ongeveer €${bedrag}M per maand aan. Laten we het zakelijk houden.`, "NORMAAL"); }
    else relShift(r, -2);
    const msg = ok ? `Handelsverdrag met ${r.name}: +€${bedrag}M per maand, 12 maanden.` : `${r.name} wijst het handelsverdrag af. (Worp ${w.txt}.)`;
    addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "geschenk"){
    const b = Math.round(+a.bedrag || 0); if (b < 1) return {ok: false, msg: "Kies een bedrag."}; if (s.cash < b) return {ok: false, msg: "Niet genoeg cash."};
    s.cash = r1(s.cash - b); r.cash = r1(r.cash + b); const v = Math.min(30, Math.round(b * 0.8)); relShift(r, v);
    if (r.status === "oorlog") r.moeheid = clamp(r.moeheid + v / 2);
    const msg = `€${b}M aan ${r.name} gegeven. Relatie +${v}.`; addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "koop" || kind === "verkoop" || kind === "ruil") return {ok: false, msg: "Landen koop, verkoop of ruil je niet: je wint ze met verkopen, contracten, vestigingen en patrouilles, of je neemt ze in een oorlog."}; /* 11.0 */
  if (kind === "koop"){
    const d = s.districts.find(x => x.id === a.district && x.control === r.name);
    if (!d) return {ok: false, msg: "Kies een district van hen."}; if (d.id === r.hq) return {ok: false, msg: "Hun HQ is niet te koop."};
    if (r.status === "oorlog") return {ok: false, msg: "In oorlog verkopen ze niets. Neem het in, of sluit eerst vrede."};
    const p = askPrice(s, r, d); if (s.cash < p) return {ok: false, msg: `Ze vragen €${p}M. Niet genoeg cash.`};
    s.cash = r1(s.cash - p); r.cash = r1(r.cash + p); d.control = "player"; relShift(r, 3);
    const msg = `${d.name} gekocht van ${r.name} voor €${p}M.`; addLog(s, msg); mail(ctx, s, r.ceo, `Verkocht: ${d.name}`, `Het is van u. De sleutels liggen bij de notaris. Ons personeel trekt zich terug.`); return {ok: true, msg};
  }
  if (kind === "verkoop"){
    const d = s.districts.find(x => x.id === a.district && x.control === "player");
    if (!d) return {ok: false, msg: "Kies een district van jou."}; if (d.id === s.player.home_district) return {ok: false, msg: "Je thuisdistrict verkoop je niet."};
    if (r.status === "oorlog") return {ok: false, msg: "Aan de vijand verkopen? Nee."};
    const p = bidPrice(s, r, d); if (r.cash < p) return {ok: false, msg: `${r.name} heeft het geld niet (ze bieden €${p}M).`};
    s.cash = r1(s.cash + p); r.cash = r1(r.cash - p); d.control = r.name; relShift(r, 4);
    const msg = `${d.name} verkocht aan ${r.name} voor €${p}M.`; addLog(s, msg); return {ok: true, msg};
  }
  if (kind === "ruil"){
    const mine = s.districts.find(x => x.id === a.mijn && x.control === "player"), theirs = s.districts.find(x => x.id === a.hun && x.control === r.name);
    if (!mine || !theirs) return {ok: false, msg: "Kies één district van jou en één van hen."};
    if (mine.id === s.player.home_district || theirs.id === r.hq) return {ok: false, msg: "Thuisdistrict en HQ ruil je niet."};
    if (r.status === "oorlog") return {ok: false, msg: "In oorlog ruilt niemand."};
    const ok = districtValue(mine) * (1 + r.relatie / 200) >= districtValue(theirs) * (1.05 + r.hebzucht * 0.2);
    if (!ok){ const msg = `${r.name} vindt ${mine.name} niet genoeg waard voor ${theirs.name}. Leg er geld bij via een aankoop, of verbeter de relatie.`; return {ok: false, msg}; }
    mine.control = r.name; theirs.control = "player"; relShift(r, 2);
    const msg = `Geruild: ${mine.name} naar ${r.name}, ${theirs.name} naar ons.`; addLog(s, msg); return {ok: true, msg};
  }
  return {ok: false, msg: "Onbekende actie."};
}
function actDefense(s){
  const lvl = s.defensie || 0; if (lvl >= 5) return {ok: false, msg: "Beveiliging staat al op het maximum."};
  const kost = r1(15 * (lvl + 1) * (DIFF[s.player.difficulty] || 1)); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  s.cash = r1(s.cash - kost); s.defensie = lvl + 1; s.accounts.operationeel = s.cash;
  const msg = `Beveiliging naar niveau ${s.defensie}. Eenmalig €${kost}M, voortaan €${s.defensie * 2}M per maand.`; addLog(s, msg); return {ok: true, msg};
}
/* 10.0: onderhandelen met rivalen. Op een handelsverdrag, wapenstilstand of ultimatum kun je twee zetten doen voor je beslist. Het karakter van de CEO, jullie relatie en (bij vrede) hun oorlogsmoeheid bepalen de kans; een mislukte zet kost relatie en soms trekken ze het aanbod in. */
const OFFER_ZET = {
  handel: {meer: {label: "Meer vragen (+30%)", mod: -5}, langer: {label: "Langer vastleggen (18 mnd)", mod: 5}},
  vrede: {langer: {label: "Twaalf maanden in plaats van zes", mod: 0}, compensatie: {label: "Schadevergoeding eisen", mod: -15}},
  ultimatum: {afdingen: {label: "Afdingen (−40%)", mod: -5}, dreigen: {label: "Terugdreigen", mod: 0}},
};
const KARAKTER_ZET = {diplomaat: 15, opportunist: 5, traditioneel: 0, visionair: 0, paranoide: -10, haai: -15};
function offerZetKans(s, o, zet){ const r = s.rivals.find(x => x.name === o.rival), Z = (OFFER_ZET[o.type] || {})[zet]; if (!r || !Z) return 0;
  let k = 50 + Z.mod + (KARAKTER_ZET[r.karakter] || 0) + (r.relatie || 0) / 4 + (o.type === "vrede" ? (r.moeheid || 0) / 3 : 0);
  if (zet === "dreigen"){ const mij = playerPower(s), hun = Math.max(1, rivalPower(s, r)); k = 30 + (mij / hun - 1) * 40 + (KARAKTER_ZET[r.karakter] || 0) / 2; }
  return snapKans(Math.round(clamp(k, 8, 92))); }
function offerZet(s, ctx, id, zet){ const o = (s.aanbiedingen || []).find(x => x.id === id); if (!o) return {ok: false, msg: "Dit aanbod is verlopen."};
  const r = s.rivals.find(x => x.name === o.rival), Z = (OFFER_ZET[o.type] || {})[zet]; if (!r || !Z) return {ok: false, msg: "Daar valt niet over te praten."};
  o.zetten ??= []; if (o.zetten.length >= 2) return {ok: false, msg: `${r.ceo} wil een antwoord, geen nieuwe voorstellen.`}; if (o.zetten.some(z => z.zet === zet)) return {ok: false, msg: "Dat heb je al gevraagd."};
  const kans = offerZetKans(s, o, zet), roll = rolKans(kans); addRoll(s, `Onderhandelen met ${r.name} (${Z.label.toLowerCase()}): ${roll.txt} → ${roll.ok ? "GELUKT" : "NIET"}`);
  const ceo = r.ceo || r.name; let txt, weg = false;
  if (roll.ok){
    if (zet === "meer"){ o.bedrag = r1(o.bedrag * 1.3); txt = `${ceo}: "Goed. €${o.bedrag}M per maand voor allebei, maar dan wil ik geen klachten horen."`; }
    else if (zet === "langer"){ o.maanden = o.type === "vrede" ? 12 : 18; txt = `${ceo}: "${o.maanden} maanden dan. Stabiliteit is ook iets waard."`; }
    else if (zet === "compensatie"){ o.compensatie = r1(Math.min(r.cash * 0.2, 8 + (r.moeheid || 0) / 3)); txt = `${ceo}: "€${o.compensatie}M, en daarmee is het klaar. Niet verder vertellen."`; }
    else if (zet === "afdingen"){ o.bedrag = r1(o.bedrag * 0.6); txt = `${ceo}: "€${o.bedrag}M. Mijn laatste woord."`; }
    else if (zet === "dreigen"){ weg = true; relShift(r, -5); txt = `${ceo} denkt even na en trekt het ultimatum in. "U bent sterker dan ik dacht. We spreken elkaar nog."`; }
  } else {
    relShift(r, -4);
    if (zet === "dreigen"){ weg = true; r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -20); txt = `${ceo}: "Dan weten we waar we staan." Het is oorlog.`; mail(ctx, s, ceo, "Dan oorlog", "U dreigt? Wij doen het gewoon.", "KRITIEK"); }
    else if (zet === "afdingen"){ o.bedrag = r1(o.bedrag * 1.2); txt = `${ceo}: "Afdingen? Nu is het €${o.bedrag}M."`; }
    else if (R() < (r.karakter === "haai" || r.karakter === "paranoide" ? 0.5 : 0.3)){ weg = true; txt = `${ceo}: "Dan niet." Het aanbod is van tafel. Relatie −4.`; }
    else txt = `${ceo}: "Nee. Het aanbod staat zoals het stond." Relatie −4.`; }
  o.zetten.push({zet, ok: roll.ok, txt}); if (weg) s.aanbiedingen = s.aanbiedingen.filter(x => x !== o);
  remember(r, s, `onderhandelde met de speler over ${o.type} (${roll.ok ? "gaf toe" : "gaf niet toe"})`); addLog(s, `Onderhandeling ${r.name}: ${txt}`);
  return {ok: true, msg: `${txt} (${roll.txt}, kans ${kans}%)`}; }
function offerDecide(s, ctx, id, yes){
  const o = s.aanbiedingen.find(x => x.id === id); if (!o) return {ok: false, msg: "Dit aanbod is verlopen."};
  const r = s.rivals.find(x => x.name === o.rival); s.aanbiedingen = s.aanbiedingen.filter(x => x !== o);
  if (!r) return {ok: false, msg: "Die rivaal bestaat niet meer."};
  let msg;
  if (!yes){
    if (o.type === "ultimatum"){ r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -30);
      mail(ctx, s, r.ceo, "Dan niet", "U had de keuze. Vanaf nu is het oorlog.", "KRITIEK"); msg = `Ultimatum van ${r.name} geweigerd. Het is oorlog.`; }
    else { relShift(r, -3); msg = `Aanbod van ${r.name} afgewezen.`; }
    addLog(s, msg); return {ok: true, msg};
  }
  if (o.type === "handel"){ const mnd = o.maanden || 12; r.verdragen.push({type: "handel", bedrag: o.bedrag, maanden: mnd}); relShift(r, 10); msg = `Handelsverdrag met ${r.name}: +€${o.bedrag}M per maand, ${mnd} maanden.`; }
  else if (o.type === "vrede"){ const mnd = o.maanden || 6; r.status = "wapenstilstand"; r.statusMaanden = mnd; r.moeheid = 0; relShift(r, 20); if (o.compensatie){ s.cash = r1(s.cash + o.compensatie); r.cash = r1(r.cash - o.compensatie); } msg = `Wapenstilstand met ${r.name}, ${mnd} maanden.${o.compensatie ? ` Zij betalen €${o.compensatie}M schadevergoeding.` : ""}`; }
  else if (o.type === "ultimatum"){ if (s.cash < o.bedrag) return {ok: false, msg: `Je hebt de €${o.bedrag}M niet.`}; s.cash = r1(s.cash - o.bedrag); r.cash = r1(r.cash + o.bedrag); relShift(r, 15); r.aggression = Math.min(1, r.aggression + 0.03); msg = `€${o.bedrag}M betaald aan ${r.name}. Voor nu is het rustig. Ze weten nu wel dat je betaalt.`; }
  else if (o.type === "district_koop" || o.type === "district_verkoop") return {ok: false, msg: "Landen koop of verkoop je niet meer. Dit aanbod vervalt."}; /* 11.0 */
  else if (o.type === "district_koop"){ const d = s.districts.find(x => x.id === o.district && x.control === "player"); if (!d) return {ok: false, msg: "Dat district is niet meer van jou."}; if (r.cash < o.bedrag) return {ok: false, msg: `${r.name} kan het niet meer betalen.`};
    d.control = r.name; s.cash = r1(s.cash + o.bedrag); r.cash = r1(r.cash - o.bedrag); relShift(r, 4); msg = `${d.name} verkocht aan ${r.name} voor €${o.bedrag}M.`; }
  else if (o.type === "district_verkoop"){ const d = s.districts.find(x => x.id === o.district && x.control === r.name); if (!d) return {ok: false, msg: "Dat district is niet meer van hen."}; if (s.cash < o.bedrag) return {ok: false, msg: `Je hebt de €${o.bedrag}M niet.`};
    d.control = "player"; s.cash = r1(s.cash - o.bedrag); r.cash = r1(r.cash + o.bedrag); relShift(r, 3); msg = `${d.name} gekocht van ${r.name} voor €${o.bedrag}M.`; }
  s.accounts.operationeel = s.cash; addLog(s, msg); return {ok: true, msg};
}

/* --- wat rivalen elke maand zelf doen --- */
function rivalAI(s, ctx, diff){
  const m = ym(s);
  { const pv = playerValue(s), dr = typeof drukF === "function" ? drukF(s) : 1; /* 7.5: rivalen mikken op de leider: wie veel groter is, krijgt ze tegen zich */
    for (const r of s.rivals){ if (pv <= rivalValue(s, r) * 1.5) continue; r.aggression = Math.min(0.9, Math.round((r.aggression + 0.008 * dr) * 1000) / 1000); relShift(r, -0.3 * dr);
      if (!(r.memory || []).some(x => /leider/.test(x.wat || x))) remember(r, s, "speler is de leider; die moet omlaag"); } }
  s.aanbiedingen = s.aanbiedingen.filter(o => {
    if (o.verloopt > m) return true;
    const r = s.rivals.find(x => x.name === o.rival);
    if (o.type === "ultimatum" && r && r.status !== "oorlog"){ r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; relShift(r, -30);
      mail(ctx, s, r.ceo, "U heeft niet betaald", "Dan betaalt u op een andere manier. Vanaf vandaag is het oorlog.", "KRITIEK"); ctx.rep.push(`${r.name} verklaart de oorlog`); }
    return false;
  });
  const addOffer = (r, type, bedrag, district, tekst, onderwerp) => {
    if (s.aanbiedingen.some(o => o.rival === r.name && o.type === type)) return;
    const d = new Date(s.date.year, s.date.month - 1 + 2, 1);
    s.aanbiedingen.push({id: hex8(), rival: r.name, type, bedrag, district: district || null, verloopt: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`});
    mail(ctx, s, r.ceo, onderwerp, tekst, type === "ultimatum" ? "KRITIEK" : "HOOG");
  };
  for (const r of [...s.rivals]){
    initRival(r);
    // economie
    let inc = 0;
    for (const [sec, lv] of Object.entries(r.divs)){ const t = typeOf(s, sec) || {rev: 8, cost: 5}; inc += lv * (t.rev - t.cost) * 0.8; }
    for (const d of rivalDistricts(s, r)) inc += d.income - d.upkeep;
    inc -= r.defensie * 2 + (r.schepen || 0) * 1.2 + (r.status === "oorlog" ? 3 : 0) + r.staff / 8;
    inc += dominanceIncome(s, r.name).geld + rivalProductInkomen(r);
    for (const v of r.verdragen){ inc += v.bedrag; }
    r.cash = r1(r.cash + inc * U(0.8, 1.2) * (RIVAAL_MULT[s.player.difficulty] || 1));
    // verdragen
    for (const v of r.verdragen){ s.cash = r1(s.cash + v.bedrag); relShift(r, 1); v.maanden -= 1; }
    if (r.verdragen.some(v => v.maanden <= 0)){ mail(ctx, s, r.ceo, "Verdrag afgelopen", "Ons handelsverdrag is verlopen. Als u wilt verlengen, weet u me te vinden."); }
    r.verdragen = r.verdragen.filter(v => v.maanden > 0);
    if (r.verdragen.length) ctx.rep.push(`Handel met ${r.name}: +€${r.verdragen.reduce((a, v) => a + v.bedrag, 0)}M`);
    // relatie zakt terug naar hun aard
    const base = 15 - r.aggression * 45; r.relatie = Math.round(r.relatie + (base - r.relatie) * 0.05 + (r.status === "oorlog" ? -2 : 0));
    // status
    if (r.status === "wapenstilstand" && --r.statusMaanden <= 0){ r.status = "vrede"; mail(ctx, s, "Juridische Zaken", `Wapenstilstand met ${r.name} voorbij`, "De wapenstilstand is afgelopen. Formeel is het vrede. In de praktijk is het afwachten."); }
    if (r.status === "oorlog"){
      r.statusMaanden += 1; r.moeheid = clamp(r.moeheid + 6 + (strijdkracht(s, "player").militair > strijdkracht(s, r).militair ? 4 : 0));
      if (r.cash > 60 && r.defensie < 5 && R() < 0.3){ r.defensie += 1; r.cash = r1(r.cash - 25); }
      // aanvallen
      if (R() < 0.35 + r.aggression * 0.3){
        const opts = ["sabotage", "hack", "smaad"]; const mine = playerDistricts(s).filter(d => d.id !== s.player.home_district && reachable(s, r.name, d));
        if (mine.length) opts.push("overval");
        const kind = CH(opts), w = WAR[kind], kans = rivalHitChance(s, r, w.mod, kind), hit = R() * 100 < kans;
        r.cash = r1(r.cash - w.kost * 0.7);
        if (hit){
          let txt;
          if (kind === "sabotage"){ const l = r1(U(10, 22) * diff * clamp(omvang(s), 0.5, 3)); s.cash = r1(s.cash - l); s.morale = clamp(s.morale - 3); txt = `Sabotage door ${r.name}: brand in een loods, €${l}M schade.`; }
          else if (kind === "hack"){ const l = r1(U(6, 14) * diff); s.cash = r1(s.cash - l); for (const d of s.divisions) if (s.market[d.type]) s.market[d.type].player *= 0.93; txt = `${r.name} heeft onze systemen gekraakt. €${l}M weg en klanten twijfelen.`; }
          else if (kind === "smaad"){ s.reputation = clamp(s.reputation - 5); txt = `Een lastercampagne van ${r.name} raakt onze reputatie.`; }
          else { const d = CH(mine); d.control = r.name; txt = `${r.name} heeft ${d.name} ingenomen. Onze mensen zijn eruit gezet.`; }
          mail(ctx, s, "Head of Security", `Aanval: ${w.label.toLowerCase()} door ${r.name}`, txt + " Hun macht tegen de onze bepaalde het.", "KRITIEK");
          ctx.rep.push(txt);
        } else {
          r.moeheid = clamp(r.moeheid + 5);
          mail(ctx, s, "Head of Security", `Aanval afgeslagen`, `${r.name} probeerde een ${w.label.toLowerCase()}. Onze beveiliging hield stand.`, "HOOG");
          ctx.rep.push(`Aanval van ${r.name} afgeslagen`);
        }
      }
      if (r.moeheid > 55 && R() < 0.45) addOffer(r, "vrede", 0, null, `Dit kost ons allebei te veel. Ik stel een wapenstilstand van zes maanden voor. Het aanbod staat tot het einde van volgende maand.`, "Een wapenstilstand?");
      if (r.cash < 0 && R() < 0.5) addOffer(r, "vrede", 0, null, "Laten we eerlijk zijn: niemand wint dit. Wapenstilstand?", "Genoeg");
    } else {
      // vrede: groeien, handelen, dreigen
      const hqs = new Set(s.rivals.map(x => x.hq)), nVest = Object.keys((s.vestiging || {})[r.name] || {}).length;
      const free = nVest >= 6 ? [] : s.districts.filter(d => d.control !== r.name && d.id !== s.player.home_district && !hqs.has(d.id) && !heeftVestiging(s, r.name, d.id) && (d.control === "neutral" || R() < 0.3) && (reachable(s, r.name, d) || R() < 0.25)); /* 11.13: soms ook ver weg */ /* 11.0: ook in andermans land, om het te betwisten */
      if (free.length && maandenGespeeld(s) >= 4 && rivalDistricts(s, r).length < Math.min(10, 3 + Math.floor(maandenGespeeld(s) / 12) * 2) && r.cash > 90 && R() < 0.06 + r.hebzucht * 0.06){
        const d = CH(free), p = districtValue(d) * 0.8;
        if (r.cash > p * 2 && !heeftVestiging(s, r.name, d.id)){ zetVestiging(s, r.name, d.id); r.cash = r1(r.cash - p * 0.6); news(s, `${r.name} opent een vestiging in ${d.name}`, `${r.name} heeft er panden en een kantoor. Het land is nog niet van hen: dat moeten ze winnen van wie er verkoopt en levert.`, d.continent, "markt", (d.neighbors || []).some(n => (s.districts.find(x => x.id === n) || {}).control === "player")); ctx.rep.push(`${r.name} opent een vestiging in ${d.name}`); } /* 11.0: was meteen eigenaar */
      }
      const lv = r.divs[r.sector] || 0, inv = 30 + lv * 15;
      if (lv < 8 && r.cash > inv * 2.5 && R() < 0.15){ r.divs[r.sector] = lv + 1; r.staff += 6; r.cash = r1(r.cash - inv); }
      if (r.relatie > 25 && !r.verdragen.length && R() < 0.1) addOffer(r, "handel", tradeAmount(s, r), null, `Wat zou u zeggen van twaalf maanden samenwerking? Beide kanten ongeveer €${tradeAmount(s, r)}M per maand beter af.`, "Een zakelijk voorstel");
      if (r.status === "vrede" && r.relatie < -45 && r.aggression > 0.45 && R() < 0.2){
        const b = Math.round(10 + r.aggression * 30); addOffer(r, "ultimatum", b, null, `Uw bedrijf zit in de weg. €${b}M voor het einde van volgende maand, en we laten u met rust. Zo niet, dan is het oorlog.`, "Ultimatum");
      }
    }
    if (r.cash < -40){ ctx.rep.push(`${r.name} gaat failliet`); mail(ctx, s, "Journalist", `${r.name} failliet`, `${r.name} is omgevallen. Hun districten liggen open.`, "HOOG"); releaseDistricts(s, r); s.rivals = s.rivals.filter(x => x !== r); s.aanbiedingen = s.aanbiedingen.filter(o => o.rival !== r.name); for (const mk of Object.values(s.market)){ mk.player += (mk.rivals[r.name] || 0) * 0.3; delete mk.rivals[r.name]; } }
  }
  // rivalen onderling
  if (s.rivals.length >= 2 && R() < 0.05){
    const [a, b] = [...s.rivals].sort(() => R() - 0.5), loot = rivalDistricts(s, b).filter(d => d.id !== b.hq);
    if (loot.length && R() * 100 < 50 + krachtKans(strijdkracht(s, a).militair, strijdkracht(s, b).militair * 1.1)){ /* 11.11: wie militair sterker is, wint meestal */ const d = CH(loot); d.control = a.name;
      news(s, `${a.name} neemt ${d.name} over van ${b.name}`, `Een stille oorlog tussen ${a.name} en ${b.name} kost ${b.name} een gebied. Niemand wil commentaar geven.`, d.continent, "oorlog"); ctx.rep.push(`${a.name} neemt ${d.name} van ${b.name}`); }
  }
  // oorlog vreet aan je eigen mensen
  const wars = atWar(s).length; if (wars){ s.morale = clamp(s.morale - wars); s.reputation = clamp(s.reputation - 0.5 * wars); }
}

/* ---------- acties van de speler ---------- */
const loanCap = s => r1(Math.max(0, s.reputation * 4 - s.debt - termijnRest(s) + Math.max(0, s.cash) * 0.5 + (relV(s, "bank") >= 40 ? 50 : 0)));
const vestigingKost = (s, d) => r1(districtCost(s, d) * 0.6 * (d.control !== "neutral" ? 1.3 : 1) * (verWeg(s, d) ? 1.5 : 1)); /* 11.13: ver weg 50% duurder */ /* 11.0: een basis, geen land: goedkoper, in andermans land duurder */
const districtCost = (s, d) => r1((d.upkeep * 8 + d.income * 4) * (s.rivals.some(r => r.hq === d.id) ? 2 : 1) * (DIFF[s.player.difficulty] || 1) * vestigingMult(s) * (1 + 0.12 * Math.max(0, playerDistricts(s).length - 1)));
const upgradeCost = (s, d) => r1(20 * Math.pow(d.level, 1.3) * (DIFF[s.player.difficulty] || 1));
const newDivCost = s => r1(30 * (DIFF[s.player.difficulty] || 1));

function actTransfer(s, ctx, van, naar, amount){
  const A = ["operationeel", "zwart", "offshore"]; amount = +amount;
  if (!A.includes(van) || !A.includes(naar) || van === naar || !(amount > 0)) return {ok: false, msg: "Kies twee verschillende rekeningen en een bedrag."};
  const bal = van === "operationeel" ? s.cash : s.accounts[van];
  if (bal < amount) return {ok: false, msg: `Onvoldoende saldo op ${van}: €${bal}M.`};
  const pct = (5 + RI(0, 10)) / 100, fee = r1(amount * pct);
  if (van === "operationeel") s.cash = r1(s.cash - amount); else s.accounts[van] = r1(s.accounts[van] - amount);
  if (naar === "operationeel") s.cash = r1(s.cash + amount - fee); else s.accounts[naar] = r1(s.accounts[naar] + amount - fee);
  let risk = Math.min(0.6, 0.05 + amount / 400 + s.heat / 300 + ([van, naar].includes("zwart") ? 0.08 : 0));
  if (faction(s, "politie") > 30) risk *= 0.6;
  const roll = rolKans(snapKans(Math.round(risk * 100))), caught = roll.ok;
  addRoll(s, `Controle bij transfer €${amount}M: ${roll.txt} → ${caught ? "GEMELD" : "onopgemerkt"}`);
  let msg = `€${amount}M van ${van} naar ${naar}. Fee ${Math.round(pct * 100)}% (€${fee}M). Controle: ${caught ? "gemeld" : "onopgemerkt"}.`;
  if (caught){
    s.heat = clamp(s.heat + 6 + amount / 20); s.flags.transfer_onderzoek = ym(s);
    mail(ctx, s, "Nordhavn Bank, afdeling Compliance", "Ongebruikelijke transactie", `Wij hebben een transactie van €${amount}M gemeld bij de toezichthouder. Dit is een standaardprocedure. Wij hopen voor u dat het standaard blijft.`, "HOOG");
  }
  s.accounts.operationeel = s.cash; addLog(s, msg);
  return {ok: true, msg};
}
function actLoan(s, amount){
  amount = +amount; const cap = loanCap(s);
  if (!(amount > 0)) return {ok: false, msg: "Vul een bedrag in."};
  if (amount > cap) return {ok: false, msg: `De bank weigert. Maximaal leenbaar nu: €${cap}M.`};
  const nd = s.debt + amount;
  const rate = Math.round((0.06 + Math.max(0, 50 - s.reputation) / 500 + nd / 3000 + (s.heat > 40 ? 0.03 : 0)) * 1000) / 1000;
  s.debt = r1(nd); s.interest_rate = rate; s.cash = r1(s.cash + amount);
  const msg = `Lening €${amount}M. Totale schuld €${s.debt}M tegen ${r1(rate * 100)}% per jaar (≈ €${r1(s.debt * rate / 12)}M rente per maand).`;
  addLog(s, msg); return {ok: true, msg};
}
function actRepay(s, amount){
  amount = Math.min(+amount || 0, s.debt);
  if (amount <= 0 || s.cash < amount) return {ok: false, msg: `Kan niet aflossen. Schuld €${s.debt}M, cash €${s.cash}M.`};
  s.cash = r1(s.cash - amount); s.debt = r1(s.debt - amount);
  const msg = `€${amount}M afgelost. Resterende schuld €${s.debt}M.`; addLog(s, msg); return {ok: true, msg};
}
function actInvoice(s, id, action){
  const inv = s.invoices.find(i => i.id === id); if (!inv) return {ok: false, msg: "Factuur niet gevonden."};
  if (action === "betaal"){
    if (s.cash < inv.amount) return {ok: false, msg: `Onvoldoende cash voor €${inv.amount}M.`};
    s.cash = r1(s.cash - inv.amount); s.invoices = s.invoices.filter(x => x !== inv);
    if (inv.overdue) s.reputation = clamp(s.reputation + 0.5);
    return {ok: true, msg: `${inv.payee} betaald: €${inv.amount}M.`};
  }
  inv.auto_pay = !inv.auto_pay;
  return {ok: true, msg: `${inv.payee}: ${inv.auto_pay ? "wordt automatisch betaald." : "laten we bewust liggen."}`};
}
function actDecision(s, arc, keuze, budget){
  const f = s.flags; budget = Math.max(0, +budget || 0);
  const pay = (amt, black) => {
    if (black && s.accounts.zwart >= amt){ s.accounts.zwart = r1(s.accounts.zwart - amt); return true; }
    if (s.cash < amt) return false; s.cash = r1(s.cash - amt); return true;
  };
  let line;
  if (arc === "vonk" && f.wacht_op_speler_vonk && ["sponsor", "negeren", "uitgeschakeld"].includes(keuze)){
    const c = {sponsor: 15, negeren: 0, uitgeschakeld: 10}[keuze];
    if (!pay(c, keuze === "uitgeschakeld")) return {ok: false, msg: `Niet genoeg geld (€${c}M nodig).`};
    f.vonk_deal = keuze; delete f.wacht_op_speler_vonk;
    line = {sponsor: "We financieren de tour van Mara Vonk.", negeren: "We negeren Mara Vonk.", uitgeschakeld: "Mara Vonk wordt 'opgelost'."}[keuze];
  } else if (arc === "nomaden_pact" && f.wacht_op_speler_nomaden_pact && ["ja", "nee"].includes(keuze)){
    f.nomad_contract = keuze === "ja"; delete f.wacht_op_speler_nomaden_pact;
    line = keuze === "ja" ? "Pact met de nomaden gesloten." : "Pact met de nomaden geweigerd.";
  } else if (arc === "hostile_bid" && f.wacht_op_speler_hostile_bid && DEFENSES[keuze]){
    const b = ["investeren", "juridisch"].includes(keuze) ? budget : 0;
    if (!pay(b)) return {ok: false, msg: `Niet genoeg cash voor een budget van €${b}M.`};
    s.hostile_bid = {verdediging: keuze, budget: b}; delete f.wacht_op_speler_hostile_bid;
    line = `Verdediging tegen het overnamebod: ${keuze}${b ? ` (budget €${b}M)` : ""}.`;
  } else if (arc === "nomaden_eis" && f.nomaden_eis && ["betalen", "weigeren"].includes(keuze)){
    if (keuze === "betalen"){
      const a = f.nomaden_eis.bedrag; if (!pay(a)) return {ok: false, msg: `Niet genoeg cash (€${a}M).`};
      shiftFaction(s, "nomaden", 3); delete f.nomaden_eis; line = `Isra's gunst betaald (€${a}M).`;
    } else { f.nomaden_eis.genegeerd = true; line = "Isra's eis blijft liggen."; }
  } else return {ok: false, msg: "Dit besluit staat niet (meer) open."};
  s.accounts.operationeel = s.cash; addLog(s, line);
  return {ok: true, msg: line + " De gevolgen merk je na de volgende maand."};
}
function actProject(s, kind, a){
  let cost, proj;
  if (kind === "upgrade"){
    const d = s.divisions.find(x => (x.name || x.type) === a.divisie); if (!d) return {ok: false, msg: "Divisie niet gevonden."};
    const nm = d.name || d.type;
    if (s.projects.some(p => p.division === nm)) return {ok: false, msg: "Daar loopt al een uitbreiding."};
    cost = upgradeCost(s, d);
    proj = {name: `Uitbreiding ${nm} naar L${d.level + 1}`, eta_months: 2, cost_per_month: 2, division: nm,
      done_msg: `${nm} draait nu op niveau ${d.level + 1}. Meer omzet, meer kosten, meer aandacht.`, on_complete: {upgrade_division: nm, levels: 1}};
  } else if (kind === "divisie"){
    const type = a.type, nm = String(a.naam || type).trim().slice(0, 40) || type;
    if (!typeOf(s, type)) return {ok: false, msg: "Onbekend type."};
    if (s.divisions.some(x => x.name === nm) || s.projects.some(p => p.new_name === nm)) return {ok: false, msg: "Die naam bestaat al."};
    cost = newDivCost(s);
    proj = {name: `Opstart ${nm} (${type})`, eta_months: 3, cost_per_month: 3, new_name: nm,
      done_msg: `${nm} is operationeel. Klein begin. De concurrentie heeft het gezien.`, on_complete: {new_division: {name: nm, type, level: 1}}};
    if ((typeOf(s, type).heat || 0) >= 3) proj.on_complete.effect = {heat: 4};
  } else if (kind === "district"){
    const d = s.districts.find(x => x.id === a.id);
    if (!d || d.control === "player") return {ok: false, msg: "Dat district is al van jou."};
    if (heeftVestiging(s, "player", d.id)) return {ok: false, msg: `Je hebt al een vestiging in ${d.name}. Meer aandeel komt nu van verkopen, contracten, campagnes en patrouilles.`};
    if (s.rivals.some(r => r.hq === d.id)) return {ok: false, msg: `${d.name} is het hoofdkantoor van ${d.control}. Daar laten ze niemand binnen; dat neem je alleen in een oorlog.`};
    if (s.projects.some(p => p.district === d.id)) return {ok: false, msg: "Daar loopt al een vestiging."};
    cost = s.flags.vergunning ? 0 : vestigingKost(s, d); if (s.flags.vergunning) delete s.flags.vergunning;
    proj = {name: `Vestiging in ${d.name}`, eta_months: 3, cost_per_month: 1, district: d.id,
      done_msg: `We hebben voet aan de grond in ${d.name}: panden, een kantoor, mensen die ons kennen. Het land is nog niet van ons. Dat winnen we met verkopen, contracten en aanwezigheid.`, on_complete: {vestiging: d.id}};
    { const r = s.rivals.find(x => x.name === d.control); if (r){ relShift(r, -6); remember(r, s, `speler opent een vestiging in ${d.name}`); } }
    for (const r of s.rivals) if (r.hq === d.id){ remember(r, s, `speler dringt district ${d.id} binnen`); r.aggression = Math.min(1, r1(r.aggression * 100 + 5) / 100); }
  } else return {ok: false, msg: "Onbekend project."};
  if (s.cash < cost) return {ok: false, msg: `Niet genoeg cash: €${cost}M nodig.`};
  s.cash = r1(s.cash - cost); s.accounts.operationeel = s.cash; proj.kost = cost; s.projects.push(proj);
  addLog(s, `Project gestart: ${proj.name} (€${cost}M + €${proj.cost_per_month}M/maand, ${proj.eta_months} mnd).`);
  const rk = projectRisico(s);
  const extraMensen = kind === "upgrade" || kind === "divisie" ? 4 : kind === "district" ? 1 : 0, nodig = staffNeed(s) + extraMensen; /* 7.3: personeel vooraf melden */
  return {ok: true, msg: `${proj.name} gestart. €${cost}M betaald, klaar over ${proj.eta_months} maanden. Risico: ${rk.vertraging}% vertraging, ${rk.mislukt}% mislukt.${extraMensen && s.staff.count < nodig ? ` Na afloop heb je ${nodig} mensen nodig en je hebt er ${s.staff.count}: neem er op tijd ${nodig - s.staff.count} aan (Bedrijf → Personeel), anders draait alles op halve kracht en zakt de morale.` : ""}`};
}
