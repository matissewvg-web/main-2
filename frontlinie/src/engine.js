// Campagne-engine: kaartstaat, orders, conflicten, bevoorrading, uitslagen, AI en winst.
// Alles is een pure bewerking op één state-object, zodat opslaan = JSON en testen = node.
import { KAARTEN } from './kaarten.js';
import { FACTIES, PERIODES, PERIODE_VOLGORDE, ZIJDEN, campagneVan, periodeVanJaar } from './campagnes.js';
import { doctrineVan, doctrinesVoor } from './doctrines.js';
import { bouwCellen, afstandPt } from './geo.js';
import { maakRng, nieuweSeed } from './rng.js';
import { genereerScenario, scenarioKansen, RULESETS } from './scenario.js';
import { genereerTafel, STANDAARD_VOORRAAD, STANDAARD_TAFEL } from './tafel.js';

// ───────── kaart ─────────
const kaartCache = {};
export function kaartInfo(kaartId, subset) {
  const sleutel = kaartId + '|' + (subset ? subset.join(',') : '');
  if (kaartCache[sleutel]) return kaartCache[sleutel];
  const k = KAARTEN[kaartId];
  const regios = subset ? k.regios.filter((r) => subset.includes(r.id)) : k.regios;
  const opId = Object.fromEntries(regios.map((r) => [r.id, r]));
  let buren, cellen = null, bbox, links;
  if (k.geo) {
    // echte kaart: omtrekken en buren komen uit de gegenereerde geodata
    buren = {};
    for (const r of regios) buren[r.id] = (k.geo.buren[r.id] || []).filter((n) => opId[n]);
    links = k.geo.zeelinks.filter(([a, b]) => opId[a] && opId[b]);
    if (subset) {
      const xs = regios.map((r) => r.x), ys = regios.map((r) => r.y), m = 190;
      const x0 = Math.max(0, Math.min(...xs) - m), y0 = Math.max(0, Math.min(...ys) - m);
      bbox = { x: x0, y: y0, w: Math.min(k.w, Math.max(...xs) + m) - x0, h: Math.min(k.h, Math.max(...ys) + m) - y0 };
    } else bbox = { x: 0, y: 0, w: k.w, h: k.h };
  } else {
    const geo = bouwCellen(regios, k.w, k.h, k.straal);
    buren = geo.buren; cellen = geo.cellen;
    for (const [a, b] of k.links || []) if (opId[a] && opId[b] && !buren[a].includes(b)) { buren[a].push(b); buren[b].push(a); }
    for (const [a, b] of k.cuts || []) if (opId[a] && opId[b]) { buren[a] = buren[a].filter((x) => x !== b); buren[b] = buren[b].filter((x) => x !== a); }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of Object.values(cellen)) for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    bbox = { x: x0 - 14, y: y0 - 14, w: x1 - x0 + 28, h: y1 - y0 + 28 };
    links = (k.links || []).filter(([a, b]) => opId[a] && opId[b]);
  }
  const info = { id: kaartId, naam: k.naam, theater: k.theater, klimaat: k.klimaat, geo: k.geo || null, regios, opId, cellen, buren, links, bbox,
    zeeBereik: k.zeeBereik || 0.42 * Math.max(k.w, k.h), paraBereik: k.paraBereik || 0.3 * Math.hypot(k.w, k.h) };
  kaartCache[sleutel] = info;
  return info;
}
// Op de Europakaart hangt het klimaat van de regio af: Russische winter, woestijn, Middellandse Zee.
export function klimaatVan(info, regioId) {
  if (!info.geo || !regioId) return info.klimaat;
  const r = info.opId[regioId], k = KAARTEN[info.id];
  if (r.terrein === 'woestijn') return 'woestijn';
  if (r.x > k.w * 0.6 && r.y < k.h * 0.68) return 'oost';
  if (r.y > k.h * 0.7) return 'mediterraan';
  return 'gematigd';
}
export function kaartVan(state) { return kaartInfo(state.kaart, state.subset); }

// ───────── tijd en weer ─────────
export const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const LENGTES = { dag: 'dag', week: 'week', tweeweken: 'twee weken', maand: 'maand', seizoen: 'seizoen' };
export function datumVan(state, beurt) {
  const n = (beurt || state.beurt) - 1, s = state.start;
  const d = new Date(Date.UTC(s.jaar, s.maand - 1, s.dag));
  if (state.lengte === 'dag') d.setUTCDate(d.getUTCDate() + n);
  else if (state.lengte === 'week') d.setUTCDate(d.getUTCDate() + 7 * n);
  else if (state.lengte === 'tweeweken') d.setUTCDate(d.getUTCDate() + 14 * n);
  else { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n * (state.lengte === 'seizoen' ? 3 : 1)); }
  const maand = d.getUTCMonth() + 1, jaar = d.getUTCFullYear();
  const seizoen = [12, 1, 2].includes(maand) ? 'winter' : maand <= 5 ? 'lente' : maand <= 8 ? 'zomer' : 'herfst';
  const label = state.lengte === 'seizoen' ? `${seizoen} ${jaar}` : ['dag', 'week', 'tweeweken'].includes(state.lengte) ? `${d.getUTCDate()} ${MAANDEN[maand - 1]} ${jaar}` : `${MAANDEN[maand - 1]} ${jaar}`;
  return { jaar, maand, dag: d.getUTCDate(), seizoen, label };
}
export function grondVan(klimaat, maand) {
  if (klimaat === 'woestijn') return 'droog';
  if (klimaat === 'oost') return [11, 12, 1, 2, 3].includes(maand) ? 'sneeuw' : [4, 10].includes(maand) ? 'modder' : 'normaal';
  if (klimaat === 'mediterraan') return [11, 12, 1, 2, 3].includes(maand) ? 'modder' : [6, 7, 8].includes(maand) ? 'droog' : 'normaal';
  return [12, 1, 2].includes(maand) ? 'sneeuw' : [11, 3].includes(maand) ? 'modder' : 'normaal';
}
export const GRONDNAAM = { normaal: 'vaste grond', sneeuw: 'sneeuw', modder: 'modder', droog: 'droog en stoffig' };

// ───────── basis ─────────
export function factie(state, id) { return state.facties.find((f) => f.id === id) || null; }
export function zijdeVan(state, fid) { const f = factie(state, fid); return f ? f.zijde : 'neutraal'; }
export function regiosVan(state, fid) { return Object.keys(state.regios).filter((id) => state.regios[id].eigenaar === fid); }
export function heeftDoc(f, id) { return !!f && f.doctrines.includes(id); }
export function vijandig(state, fid, regioId) {
  const rs = state.regios[regioId];
  return !rs.gesloten && zijdeVan(state, rs.eigenaar) !== zijdeVan(state, fid);
}
function logRegel(state, soort, tekst) {
  let blok = state.log[state.log.length - 1];
  if (!blok || blok.beurt !== state.beurt) { blok = { beurt: state.beurt, datum: datumVan(state).label, items: [] }; state.log.push(blok); }
  blok.items.push({ soort, tekst });
}

export function losBezitOp(sc) {
  const info = kaartInfo(sc.kaart, sc.subset), uit = {};
  let rest = null;
  for (const [fid, lijst] of Object.entries(sc.bezit)) {
    if (lijst === 'rest') rest = fid; else for (const id of lijst) if (info.opId[id]) uit[id] = fid;
  }
  for (const r of info.regios) if (!uit[r.id]) uit[r.id] = rest || 'neutraal';
  return uit;
}

export function nieuweCampagne(cfg) {
  const sc = campagneVan(cfg.scenarioId);
  const info = kaartInfo(sc.kaart, sc.subset);
  const bezit = Object.assign({}, cfg.bezit || losBezitOp(sc));
  const periode = cfg.periode || sc.periode;
  const facties = cfg.facties.map((fc) => {
    const basis = sc.facties.find((f) => f.id === fc.id) || {}, F = FACTIES[fc.id];
    const geldig = doctrinesVoor(fc.id, periode).map((d) => d.id);
    const doc = geldig.includes(fc.doctrine) ? fc.doctrine : (geldig.includes(basis.doctrine) ? basis.doctrine : geldig[0]);
    return { id: fc.id, naam: F.naam, kort: F.kort, kleur: F.kleur, zijde: fc.zijde || basis.zijde || F.zijde, speler: fc.speler || basis.speler || 'mens', spelerNaam: fc.spelerNaam || '', leger: F.leger || '',
      doctrines: [doc], slots: 1, zeges: 0, hoofdstad: basis.hoofdstad || null, bronnen: basis.bronnen ? basis.bronnen.slice() : null,
      para: !!basis.para, gratisPara: basis.gratisPara || 0, landing: !!basis.landing || !!sc.sandbox, beurt1Aanvallen: basis.beurt1Aanvallen || 0, later: !!basis.later,
      extraOrders: 0, bonusVP: 0, tegenaanval: null, herkans: [], geenLanding: 0, voorbereid: {}, vielAan: 0, verloor: 0, verslagen: false, veteranen: [] };
  });
  const ids = new Set(facties.map((f) => f.id));
  const regios = {};
  for (const r of info.regios) {
    const eig = ids.has(bezit[r.id]) ? bezit[r.id] : 'neutraal';
    regios[r.id] = { eigenaar: eig, start: eig, fort: sc.fort && sc.fort[r.id] !== undefined ? sc.fort[r.id] : r.fort, linie: (sc.linies && sc.linies[r.id]) || r.linie,
      omstreden: 0, gevechten: 0, ruine: false, versterkt: 0, verdedigd: 0, luchtbrug: 0, verstoord: 0, geenBev: 0, recon: {}, afgesnedenSinds: 0, gehoudenSinds: 0, gesloten: false, vorige: null, bev: true, ingesloten: false };
  }
  for (const f of facties) {
    const eigen = info.regios.filter((r) => regios[r.id].eigenaar === f.id);
    if (f.hoofdstad && !info.opId[f.hoofdstad]) f.hoofdstad = null;
    if (f.bronnen) f.bronnen = f.bronnen.filter((b) => info.opId[b]);
    if (!f.bronnen || !f.bronnen.length) {
      if (f.hoofdstad && regios[f.hoofdstad].eigenaar === f.id) f.bronnen = [f.hoofdstad];
      else { const havens = eigen.filter((r) => r.infra.includes('haven')); f.bronnen = (havens.length ? havens : eigen).map((r) => r.id); }
    }
  }
  const doel = sc.doel && !cfg.geenDoel ? Object.assign({}, sc.doel) : null;
  const state = {
    v: 1, id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), naam: cfg.naam || sc.naam, gemaakt: Date.now(),
    ruleset: cfg.ruleset || 'fow', punten: cfg.punten || RULESETS[cfg.ruleset || 'fow'].punten,
    scenarioId: sc.id, kaart: sc.kaart, subset: sc.subset || null, periode, doorlopend: !!cfg.doorlopend,
    start: { jaar: sc.jaar, maand: sc.maand, dag: sc.dag }, lengte: cfg.lengte || sc.lengte, maxBeurten: doel ? doel.voor : (cfg.maxBeurten || sc.maxBeurten),
    beurt: 1, fase: 'orders', modus: cfg.modus || 'simultaan', mist: cfg.mist !== false,
    seed: cfg.seed || nieuweSeed(), facties, regios, orders: {}, klaar: {}, voorstel: null, gevechten: [], bonus: [], log: [], teller: 0,
    doel, events: sc.events || [], capitulatieNa: sc.capitulatieNa || 3, paraOveral: !!sc.paraOveral, geenLuchtTot: 0,
    tafel: Object.assign({}, cfg.tafel || STANDAARD_TAFEL), voorraad: Object.assign({}, cfg.voorraad || STANDAARD_VOORRAAD), winnaar: null,
  };
  logRegel(state, 'event', `Campagne "${state.naam}" begint: ${sc.ondertitel}.`);
  pasEventsToe(state, 1);
  herberekenBevoorrading(state);
  startOrderFase(state);
  return state;
}

// ───────── bevoorrading ─────────
export function altijdBevoorraad(state, regioId) {
  const info = kaartVan(state), r = info.opId[regioId], rs = state.regios[regioId], f = factie(state, rs.eigenaar);
  if (!f) return true;
  if (heeftDoc(f, 'festung') && rs.fort >= 1 && (r.terrein === 'stad' || r.infra.includes('stad'))) return true;
  if (heeftDoc(f, 'woestijnratten') && r.terrein === 'woestijn') return true;
  return false;
}
export function herberekenBevoorrading(state) {
  const info = kaartVan(state);
  const bereikt = new Set();
  for (const z of new Set(state.facties.map((f) => f.zijde))) {
    const eigen = (id) => zijdeVan(state, state.regios[id].eigenaar) === z;
    const gezien = new Set(), rij = [];
    for (const f of state.facties) if (f.zijde === z) for (const b of f.bronnen) if (eigen(b) && !gezien.has(b)) { gezien.add(b); rij.push(b); }
    let nieuw = true;
    while (nieuw) {
      while (rij.length) {
        const id = rij.shift();
        for (const n of info.buren[id]) if (!gezien.has(n) && eigen(n)) { gezien.add(n); rij.push(n); }
      }
      nieuw = false; // over zee: eigen kustregio's binnen bereik van een bevoorrade eigen haven
      const havens = [...gezien].filter((id) => info.opId[id].infra.includes('haven'));
      for (const r of info.regios) {
        if (gezien.has(r.id) || !eigen(r.id) || !r.infra.includes('kust')) continue;
        if (havens.some((h) => afstandPt(info.opId[h], r) <= info.zeeBereik)) { gezien.add(r.id); rij.push(r.id); nieuw = true; }
      }
    }
    for (const id of gezien) bereikt.add(id);
  }
  for (const r of info.regios) {
    const rs = state.regios[r.id];
    if (!factie(state, rs.eigenaar)) { rs.bev = true; rs.ingesloten = false; rs.verbonden = true; continue; }
    const altijd = altijdBevoorraad(state, r.id);
    rs.verbonden = bereikt.has(r.id) || altijd;
    let bev = rs.verbonden;
    if (rs.luchtbrug >= state.beurt) bev = true;
    if (rs.verstoord >= state.beurt || rs.geenBev >= state.beurt) bev = altijd;
    rs.bev = bev;
    const z = zijdeVan(state, rs.eigenaar);
    rs.ingesloten = !rs.verbonden && info.buren[r.id].every((n) => zijdeVan(state, state.regios[n].eigenaar) !== z);
  }
}

// ───────── orders ─────────
export const ORDERTYPES = {
  aanval: { naam: 'Aanvallen', tekst: 'De doelregio wordt een gevecht.', bron: true, aanval: true },
  landing: { naam: 'Landing', tekst: 'Amfibische aanval op een kustregio binnen bereik van een eigen haven.', aanval: true },
  luchtlanding: { naam: 'Luchtlanding', tekst: 'Parachutisten landen in een vijandelijke regio.', aanval: true },
  raid: { naam: 'Raid', tekst: 'Klein gevecht op een kustregio: sloopt versterking en verstoort de bevoorrading.' },
  versterk: { naam: 'Versterken', tekst: 'De regio krijgt een extra reserve in het volgende gevecht daar.' },
  verdedig: { naam: 'Verdedigen', tekst: 'Je kiest deze beurt de tafelkant en krijgt voorbereide posities.' },
  recon: { naam: 'Recon', tekst: 'Toont versterking en waarschijnlijk scenario van een vijandelijke regio.' },
  bevoorraad: { naam: 'Bevoorrading', tekst: 'Herstelt een afgesneden regio tot en met de volgende beurt.' },
  partizanen: { naam: 'Partizanen', tekst: 'Verstoort de bevoorrading van een bezette regio.' },
  voorbereid: { naam: 'Aanval voorbereiden', tekst: 'Val deze regio volgende beurt aan met een bombardement en een extra reserve.' },
};

export function effectieveFort(state, regioId) {
  const info = kaartVan(state), r = info.opId[regioId], rs = state.regios[regioId], f = factie(state, rs.eigenaar);
  let fort = rs.fort;
  if (f && heeftDoc(f, 'bergverdediging') && fort === 0 && ['heuvels', 'bergen'].includes(r.terrein)) fort = 1;
  if (f && heeftDoc(f, 'waterlinie') && fort === 0 && r.terrein === 'rivier') fort = 1;
  if (f && heeftDoc(f, 'motti') && fort === 0 && ['bos', 'moeras'].includes(r.terrein)) fort = 1;
  if (f && heeftDoc(f, 'methodisch') && fort >= 1) fort = Math.min(3, fort + 1);
  return fort;
}

export function limieten(state, fid) {
  const f = factie(state, fid), eigen = regiosVan(state, fid), info = kaartVan(state);
  const bevN = eigen.filter((id) => state.regios[id].bev).length;
  let orders = 3 + Math.min(4, Math.floor(eigen.length / 10)) + f.extraOrders + (heeftDoc(f, 'totaleoorlog') ? 1 : 0);
  if (f.hoofdstad && state.regios[f.hoofdstad].eigenaar !== fid) orders -= 1;
  orders = Math.max(2, orders);
  // de zijde met het campagnedoel is de aanvaller van het scenario en krijgt één aanval extra
  let aanvallen = Math.min(5, 2 + Math.floor(bevN / 12)) + (state.doel && state.doel.zijde === f.zijde ? 1 : 0);
  if (bevN === 0) aanvallen = 1;
  if (['setpiece', 'elastisch', 'methodisch'].some((d) => heeftDoc(f, d))) aanvallen = Math.min(aanvallen, 2);
  if (heeftDoc(f, 'rapido') && eigen.some((id) => info.opId[id].terrein === 'woestijn')) aanvallen += 1;
  if (heeftDoc(f, 'cavalerie') && eigen.some((id) => ['steppe', 'akkers'].includes(info.opId[id].terrein))) aanvallen += 1;
  if (state.beurt === 1 && f.beurt1Aanvallen) { aanvallen = Math.max(aanvallen, f.beurt1Aanvallen); orders = Math.max(orders, f.beurt1Aanvallen); }
  return { orders, aanvallen };
}

export function beschikbareOrders(state, fid) {
  const f = factie(state, fid), uit = ['aanval'];
  if (heeftDoc(f, 'amfibisch') || f.landing) uit.push('landing');
  if (f.para) uit.push('luchtlanding');
  if (heeftDoc(f, 'commandos')) uit.push('raid');
  uit.push('versterk', 'verdedig');
  if (!heeftDoc(f, 'massa')) uit.push('recon');
  uit.push('bevoorraad');
  if (heeftDoc(f, 'partizanen')) uit.push('partizanen');
  if (heeftDoc(f, 'setpiece')) uit.push('voorbereid');
  return uit;
}

function eigenHavens(state, fid) {
  const info = kaartVan(state);
  return regiosVan(state, fid).filter((id) => info.opId[id].infra.includes('haven'));
}
// Geldige doelen voor een ordertype. Voor 'aanval' zonder `van`: de mogelijke bronregio's.
export function orderDoelen(state, fid, type, van) {
  const info = kaartVan(state), f = factie(state, fid), eigen = regiosVan(state, fid);
  const alle = info.regios.map((r) => r.id);
  switch (type) {
    case 'aanval':
      if (!van) return eigen.filter((id) => info.buren[id].some((n) => vijandig(state, fid, n)));
      return info.buren[van].filter((n) => vijandig(state, fid, n));
    case 'landing': {
      if (f.geenLanding >= state.beurt) return [];
      const havens = eigenHavens(state, fid);
      return alle.filter((id) => vijandig(state, fid, id) && info.opId[id].infra.includes('kust') && havens.some((h) => afstandPt(info.opId[h], info.opId[id]) <= info.zeeBereik));
    }
    case 'raid': {
      const havens = eigenHavens(state, fid);
      return alle.filter((id) => vijandig(state, fid, id) && factie(state, state.regios[id].eigenaar) && info.opId[id].infra.includes('kust') && havens.some((h) => afstandPt(info.opId[h], info.opId[id]) <= info.zeeBereik));
    }
    case 'luchtlanding': {
      const z = f.zijde, basis = alle.filter((id) => zijdeVan(state, state.regios[id].eigenaar) === z);
      return alle.filter((id) => vijandig(state, fid, id) && factie(state, state.regios[id].eigenaar) && (state.paraOveral || basis.some((b) => afstandPt(info.opId[b], info.opId[id]) <= info.paraBereik)));
    }
    case 'versterk': case 'verdedig': return eigen;
    case 'bevoorraad': return eigen.filter((id) => !state.regios[id].bev);
    case 'recon': return alle.filter((id) => vijandig(state, fid, id) && factie(state, state.regios[id].eigenaar) && info.buren[id].some((n) => zijdeVan(state, state.regios[n].eigenaar) === f.zijde));
    case 'voorbereid': return alle.filter((id) => vijandig(state, fid, id) && info.buren[id].some((n) => state.regios[n].eigenaar === fid));
    case 'partizanen': return alle.filter((id) => vijandig(state, fid, id) && state.regios[id].start === fid && factie(state, state.regios[id].eigenaar));
    default: return [];
  }
}

function isGratis(state, fid, o, eerdere) {
  const f = factie(state, fid), info = kaartVan(state);
  if (o.type === 'aanval' && f.herkans.some((h) => h.regio === o.naar && h.beurt === state.beurt)) return true;
  if (o.type === 'luchtlanding' && state.beurt === 1 && eerdere.filter((x) => x.type === 'luchtlanding').length < f.gratisPara) return true;
  if (o.type === 'bevoorraad' && heeftDoc(f, 'vuurkracht')) return true;
  if (o.type === 'recon' && heeftDoc(f, 'luchtoverwicht') && info.buren[o.naar].some((n) => state.regios[n].eigenaar === fid && info.opId[n].infra.includes('vliegveld'))) return true;
  return false;
}
export function telling(state, fid, orders) {
  let n = 0, aanvallen = 0;
  orders.forEach((o, i) => {
    if (isGratis(state, fid, o, orders.slice(0, i))) return;
    n++; if (ORDERTYPES[o.type].aanval) aanvallen++;
  });
  return { orders: n, aanvallen };
}
// null = toegestaan, anders de reden waarom niet
export function orderFout(state, fid, o, bestaande) {
  const lim = limieten(state, fid), f = factie(state, fid);
  if (!beschikbareOrders(state, fid).includes(o.type)) return 'Deze order heb je niet.';
  if (!orderDoelen(state, fid, o.type, o.van).includes(o.naar)) return 'Ongeldig doel.';
  if (o.type === 'aanval') {
    if (state.regios[o.van].eigenaar !== fid) return 'Je valt aan vanuit een eigen regio.';
    if (bestaande.some((x) => x.type === 'aanval' && x.van === o.van)) return 'Vanuit deze regio vertrekt al een aanval.';
  }
  if (bestaande.some((x) => x.type === o.type && x.naar === o.naar)) return 'Die order heb je al gegeven.';
  if (ORDERTYPES[o.type].aanval && bestaande.some((x) => ORDERTYPES[x.type].aanval && x.naar === o.naar)) return 'Je valt die regio al aan.';
  if (o.type === 'raid' && bestaande.some((x) => x.type === 'raid')) return 'Hoogstens één raid per beurt.';
  const na = telling(state, fid, bestaande.concat([o]));
  if (o.type === 'luchtlanding' && !isGratis(state, fid, o, bestaande) && bestaande.filter((x, i) => x.type === 'luchtlanding' && !isGratis(state, fid, x, bestaande.slice(0, i))).length >= 1) return 'Hoogstens één luchtlanding per beurt.';
  if (na.aanvallen > lim.aanvallen) return `Hoogstens ${lim.aanvallen} aanval${lim.aanvallen > 1 ? 'len' : ''} deze beurt.`;
  if (na.orders > lim.orders) return `Hoogstens ${lim.orders} orders deze beurt.`;
  return f ? null : 'Onbekend land.';
}
export function voegOrderToe(state, fid, o) {
  const lijst = state.orders[fid] || (state.orders[fid] = []);
  const fout = orderFout(state, fid, o, lijst);
  if (fout) return fout;
  lijst.push({ type: o.type, van: o.van || null, naar: o.naar });
  return null;
}
export function verwijderOrder(state, fid, i) { (state.orders[fid] || []).splice(i, 1); }

// Context voor de scenario-generator; ook gebruikt voor de voorspelling bij recon.
function bouwContext(state, g) {
  const info = kaartVan(state), r = info.opId[g.regio], rs = state.regios[g.regio];
  const A = factie(state, g.aanvaller), V = factie(state, g.verdediger), d = datumVan(state), b = state.beurt;
  const bron = g.van ? state.regios[g.van] : null;
  const zA = A.zijde;
  return {
    regio: { naam: r.naam, terrein: r.terrein, infra: r.infra, waarde: r.waarde, fort: g.soort === 'ontmoeting' ? 0 : effectieveFort(state, g.regio), linie: rs.linie },
    soort: g.soort === 'bezetting' ? 'aanval' : g.soort, ruleset: state.ruleset, punten: state.punten, periode: state.periode,
    grond: grondVan(klimaatVan(info, g.regio), d.maand), seizoen: d.seizoen, geenLucht: state.geenLuchtTot >= b,
    omstreden: rs.omstreden, ruine: rs.ruine,
    ontzet: info.buren[g.regio].some((n) => zijdeVan(state, state.regios[n].eigenaar) === zA && state.regios[n].ingesloten),
    A: { naam: A.naam, doctrines: A.doctrines, afgesneden: !!bron && g.soort === 'aanval' && !bron.bev, recon: (rs.recon[A.id] || 0) >= b, steun: (g.steun || []).length > 0,
      voorbereid: A.voorbereid[g.regio] === b - 1, tegenaanval: !!A.tegenaanval && A.tegenaanval.regio === g.regio && A.tegenaanval.beurt === b, diepFlank: !!g.diepFlank,
      zwak: !!rs.vorige && rs.vorige.beurt === b - 1 && rs.vorige.verliezer === A.id, thuis: rs.start === A.id },
    V: { naam: V ? V.naam : 'Neutraal', doctrines: V ? V.doctrines : [], versterkt: rs.versterkt >= b, verdedigt: rs.verdedigd === b, afgesneden: !rs.bev, altijdBevoorraad: altijdBevoorraad(state, g.regio),
      ingesloten: rs.ingesloten, verloorVorige: !!V && V.verloor === b - 1, vielNetAan: !!V && V.vielAan === b - 1, heleBeurt: rs.gehoudenSinds < b,
      recon: !!bron && !!V && (bron.recon[V.id] || 0) >= b, thuis: rs.start === g.verdediger },
  };
}
export function voorspel(state, fid, naar, van, type) {
  const eig = state.regios[naar].eigenaar;
  if (!factie(state, eig)) return [];
  const soort = type === 'landing' ? 'landing' : type === 'luchtlanding' ? 'luchtlanding' : type === 'raid' ? 'raid' : 'aanval';
  return scenarioKansen(bouwContext(state, { regio: naar, aanvaller: fid, verdediger: eig, van: van || null, soort, steun: [] }));
}
// Mag deze factie de versterking van een regio zien? (fog of war)
export function zietVersterking(state, fid, regioId) {
  if (!state.mist || !fid) return true;
  const rs = state.regios[regioId], f = factie(state, fid);
  if (zijdeVan(state, rs.eigenaar) === f.zijde) return true;
  return (rs.recon[fid] || 0) >= state.beurt || heeftDoc(f, 'reconinkracht') && kaartVan(state).buren[regioId].some((n) => state.regios[n].eigenaar === fid);
}

// ───────── beurtverloop ─────────
export function actieveFacties(state) { return state.facties.filter((f) => !f.verslagen && (regiosVan(state, f.id).length > 0 || (f.para && f.later))); }
export function startOrderFase(state) {
  state.fase = 'orders'; state.orders = {}; state.klaar = {}; state.voorstel = null; state.gevechten = []; state.bonus = []; state.blitzGebruikt = {};
  const rng = maakRng(`${state.seed}:init:${state.beurt}`);
  state.initiatief = rng.schud(actieveFacties(state).map((f) => f.id));
  // landen zonder speler geven geen orders: ze verdedigen alleen
  for (const f of actieveFacties(state)) if (f.speler !== 'mens') { state.orders[f.id] = []; state.klaar[f.id] = true; }
}
// Volgorde waarin mensen plannen: "vuurkracht" eerst (voorspelbaar), in beurtmodus volgens initiatief.
export function planVolgorde(state) {
  const mensen = actieveFacties(state).filter((f) => f.speler === 'mens');
  const rang = (f) => (heeftDoc(f, 'vuurkracht') ? -100 : 0) + state.initiatief.indexOf(f.id);
  mensen.sort((a, b) => rang(a) - rang(b));
  // landen van dezelfde speler na elkaar, zodat het toestel maar één keer per speler rondgaat
  const spelers = [...new Set(mensen.map((f) => f.spelerNaam || f.id))];
  return spelers.flatMap((sp) => mensen.filter((f) => (f.spelerNaam || f.id) === sp)).map((f) => f.id);
}
export function volgendePlanner(state) { return planVolgorde(state).find((id) => !state.klaar[id]) || null; }
// Aanvallen van de vijand die deze factie tijdens het plannen al kent.
export function bekendeAanvallen(state, fid) {
  const z = zijdeVan(state, fid), uit = [];
  for (const f of state.facties) {
    if (f.zijde === z || !state.klaar[f.id]) continue;
    if (state.modus === 'beurt' || heeftDoc(f, 'vuurkracht')) for (const o of state.orders[f.id] || []) if (ORDERTYPES[o.type].aanval) uit.push({ fid: f.id, van: o.van, naar: o.naar, type: o.type });
  }
  return uit;
}

function bepaalGevechten(state) {
  const rng = maakRng(`${state.seed}:conf:${state.beurt}`);
  const aanvallen = [], berichten = [], gevechten = [];
  for (const fid of state.initiatief) for (const o of state.orders[fid] || []) {
    if (!ORDERTYPES[o.type].aanval && o.type !== 'raid') continue;
    if (!vijandig(state, fid, o.naar)) continue;
    aanvallen.push({ fid, type: o.type, van: o.van, naar: o.naar });
  }
  const gedaan = new Set();
  // twee landen die elkaar over dezelfde grens aanvallen: één ontmoetingsgevecht
  for (const a of aanvallen) {
    if (gedaan.has(a) || a.type !== 'aanval') continue;
    const eig = state.regios[a.naar].eigenaar;
    const b = aanvallen.find((x) => !gedaan.has(x) && x.type === 'aanval' && x.fid === eig && x.van === a.naar && x.naar === a.van);
    if (!b) continue;
    gedaan.add(a); gedaan.add(b);
    gevechten.push({ soort: 'ontmoeting', regio: rng.kans(0.5) ? a.naar : b.naar, aanvaller: a.fid, verdediger: b.fid, van: a.van, inzetA: a.naar, inzetV: b.naar, steun: [] });
  }
  for (const a of aanvallen) {
    if (gedaan.has(a)) continue;
    const z = zijdeVan(state, a.fid);
    const ontm = gevechten.find((g) => g.soort === 'ontmoeting' && (g.inzetA === a.naar || g.inzetV === a.naar));
    if (ontm) {
      const kant = ontm.inzetA === a.naar ? ontm.aanvaller : ontm.verdediger;
      if (zijdeVan(state, kant) === z && kant !== a.fid && a.type !== 'raid') ontm['steun' + (kant === ontm.aanvaller ? '' : 'V')] = (ontm['steun' + (kant === ontm.aanvaller ? '' : 'V')] || []).concat([a.fid]);
      else berichten.push(`${factie(state, a.fid).naam}: de aanval op ${kaartVan(state).opId[a.naar].naam} vervalt, daar wordt al gevochten.`);
      continue;
    }
    const bestaand = gevechten.find((g) => g.regio === a.naar);
    if (bestaand) {
      if (zijdeVan(state, bestaand.aanvaller) === z && a.type !== 'raid' && bestaand.soort !== 'raid' && bestaand.aanvaller !== a.fid) { if (!bestaand.steun.includes(a.fid)) bestaand.steun.push(a.fid); }
      else berichten.push(`${factie(state, a.fid).naam}: de aanval op ${kaartVan(state).opId[a.naar].naam} vervalt, daar wordt al gevochten.`);
      continue;
    }
    const eig = state.regios[a.naar].eigenaar;
    if (!factie(state, eig)) { if (a.type !== 'raid') gevechten.push({ soort: 'bezetting', regio: a.naar, aanvaller: a.fid, verdediger: eig, van: a.van, steun: [] }); continue; }
    gevechten.push({ soort: a.type === 'aanval' ? 'aanval' : a.type, regio: a.naar, aanvaller: a.fid, verdediger: eig, van: a.van, steun: [] });
  }
  return { gevechten, berichten };
}

export function onthul(state) {
  for (const f of actieveFacties(state)) if (!state.orders[f.id]) state.orders[f.id] = [];
  state.voorstel = bepaalGevechten(state);
  state.fase = 'onthuld';
  state.auftragGebruikt = {};
}
// Auftragstaktik: na het onthullen één order vervangen.
export function vervangOrder(state, fid, index, nieuw) {
  const f = factie(state, fid);
  if (state.fase !== 'onthuld' || !heeftDoc(f, 'auftragstaktik') || state.auftragGebruikt[fid]) return 'Niet mogelijk.';
  const lijst = state.orders[fid].slice(); lijst.splice(index, 1);
  const fout = orderFout(state, fid, nieuw, lijst);
  if (fout) return fout;
  lijst.push({ type: nieuw.type, van: nieuw.van || null, naar: nieuw.naar });
  state.orders[fid] = lijst; state.auftragGebruikt[fid] = true;
  state.voorstel = bepaalGevechten(state);
  return null;
}

function maakGevecht(state, v) {
  const g = Object.assign({ id: 'g' + state.beurt + '-' + (++state.teller), beurt: state.beurt, steun: [], status: 'open', uitslag: null, auto: false }, v);
  if (g.soort !== 'bezetting') {
    const ctx = bouwContext(state, g);
    g.seed = `${state.seed}-${g.id}`;
    g.terreinSeed = g.seed;
    g.scenario = genereerScenario(ctx, g.seed);
    g.terrein = kaartVan(state).opId[g.regio].terrein;
    g.infraBrug = kaartVan(state).opId[g.regio].infra.includes('brug');
  }
  return g;
}
export function tafelVan(state, g) {
  return genereerTafel({ tafel: state.tafel, voorraad: state.voorraad, terrein: g.terrein, scenario: g.scenario, infraBrug: g.infraBrug }, g.terreinSeed);
}

export function startGevechten(state) {
  const info = kaartVan(state), b = state.beurt;
  // niet-gevechtsorders eerst: ze beïnvloeden bevoorrading en scenario's
  for (const fid of state.initiatief) {
    const f = factie(state, fid), lijst = state.orders[fid] || [];
    if (lijst.length) logRegel(state, 'order', `${f.naam}: ${lijst.map((o) => ORDERTYPES[o.type].naam.toLowerCase() + ' ' + info.opId[o.naar].naam).join(', ')}.`);
    else logRegel(state, 'order', `${f.naam}: geen orders.`);
    for (const o of lijst) {
      const rs = state.regios[o.naar];
      if (o.type === 'versterk') rs.versterkt = b + 1;
      if (o.type === 'verdedig') rs.verdedigd = b;
      if (o.type === 'recon') rs.recon[fid] = b + 1;
      if (o.type === 'bevoorraad') rs.luchtbrug = b + 1;
      if (o.type === 'partizanen') rs.verstoord = b + 1;
      if (o.type === 'voorbereid') f.voorbereid[o.naar] = b;
      if (ORDERTYPES[o.type].aanval) f.vielAan = b;
    }
  }
  // een neutraal land dat wordt aangevallen, kiest de kant van de vijand van de aanvaller
  for (const v of state.voorstel.gevechten) {
    const V = factie(state, v.verdediger), A = factie(state, v.aanvaller);
    if (!V || V.zijde !== 'neutraal') continue;
    const zijden = new Set(state.facties.map((f) => f.zijde));
    const voorkeur = A.zijde === 'as' ? ['geallieerd', 'sovjet'] : ['as', 'geallieerd', 'sovjet'];
    const naar = voorkeur.find((z) => z !== A.zijde && zijden.has(z));
    if (naar) { V.zijde = naar; logRegel(state, 'event', `${V.naam} wordt aangevallen door ${A.naam} en sluit zich aan bij de ${ZIJDEN[naar]}.`); }
  }
  herberekenBevoorrading(state);
  for (const m of state.voorstel.berichten) logRegel(state, 'kaart', m);
  // diepe operatie: twee aanvalsdoelen die aan elkaar grenzen
  for (const f of state.facties) {
    if (!heeftDoc(f, 'diepeoperatie')) continue;
    const mijn = state.voorstel.gevechten.filter((g) => g.aanvaller === f.id && g.soort === 'aanval');
    for (const g of mijn) if (mijn.some((h) => h !== g && info.buren[g.regio].includes(h.regio))) g.diepFlank = true;
  }
  state.gevechten = [];
  for (const v of state.voorstel.gevechten) {
    const g = maakGevecht(state, v);
    state.gevechten.push(g);
    if (g.soort === 'bezetting') {
      wisselEigenaar(state, g.regio, g.aanvaller);
      g.status = 'klaar'; g.uitslag = { winnaar: 'A' };
      logRegel(state, 'kaart', `${factie(state, g.aanvaller).naam} bezet ${info.opId[g.regio].naam} zonder slag of stoot.`);
    }
  }
  state.fase = 'gevechten';
  herberekenBevoorrading(state);
}

function wisselEigenaar(state, regioId, naar) {
  const rs = state.regios[regioId];
  rs.eigenaar = naar; rs.fort = 0; rs.versterkt = 0; rs.verdedigd = 0; rs.gehoudenSinds = state.beurt; rs.afgesnedenSinds = 0; rs.omstreden = 0; rs.luchtbrug = 0;
}
// De uitslag is alleen: wie won. 'A' = aanvaller, 'V' = verdediger (ook bij een onbeslist gevecht).
export function voerUitslagIn(state, gevechtId, uitslag) {
  const g = state.gevechten.find((x) => x.id === gevechtId);
  if (!g || g.status !== 'open') return 'Dit gevecht is al afgehandeld.';
  const info = kaartVan(state), b = state.beurt, A = factie(state, g.aanvaller), V = factie(state, g.verdediger), naam = info.opId[g.regio].naam;
  const wint = uitslag.winnaar === 'A' ? 'A' : 'V';
  g.uitslag = { winnaar: wint }; g.status = 'klaar';
  const rs = state.regios[g.regio];
  rs.gevechten++; rs.gevochten = b;
  if (info.opId[g.regio].terrein === 'stad' || info.opId[g.regio].infra.includes('stad')) rs.ruine = true;
  let tekst = `${naam}: ${g.scenario.naam}, ${A.naam} tegen ${V.naam}. `;

  const verover = (winnaar, verliezer, regioId) => {
    wisselEigenaar(state, regioId, winnaar.id);
    verliezer.verloor = b; winnaar.zeges++;
    if (heeftDoc(winnaar, 'blitzkrieg') && g.soort !== 'luchtlanding' && !g.bonus && !state.blitzGebruikt[winnaar.id]) { state.blitzGebruikt[winnaar.id] = true; state.bonus.push({ fid: winnaar.id, van: regioId }); }
    if (heeftDoc(verliezer, 'massa')) verliezer.herkans.push({ regio: regioId, beurt: b + 1 });
    if (heeftDoc(verliezer, 'elastisch')) {
      const terug = info.buren[regioId].filter((n) => state.regios[n].eigenaar === verliezer.id).sort((x, y) => info.opId[y].waarde - info.opId[x].waarde)[0];
      if (terug && state.regios[terug].fort < 1) { state.regios[terug].fort = 1; tekst += `De achterhoede van ${verliezer.naam} graaft zich in bij ${info.opId[terug].naam}. `; }
    }
  };

  if (g.soort === 'raid') {
    if (wint === 'A') { rs.fort = Math.max(0, rs.fort - 1); rs.verstoord = b + 1; A.bonusVP += 1; A.zeges++; tekst += 'De raid slaagt: versterking gesloopt, bevoorrading verstoord. '; }
    else tekst += 'De raid wordt afgeslagen. ';
  } else if (g.soort === 'ontmoeting') {
    if (wint === 'A') { verover(A, V, g.inzetA); tekst += `${A.naam} wint het ontmoetingsgevecht en neemt ${info.opId[g.inzetA].naam}. `; }
    else { verover(V, A, g.inzetV); tekst += `${V.naam} wint het ontmoetingsgevecht en neemt ${info.opId[g.inzetV].naam}. `; }
  } else if (wint === 'A') {
    verover(A, V, g.regio);
    tekst += `${A.naam} wint en verovert de regio. `;
  } else {
    A.verloor = b; rs.omstreden++; V.zeges++;
    if (g.van && state.regios[g.van].eigenaar === A.id) V.tegenaanval = { regio: g.van, beurt: b + 1 };
    if (g.soort === 'landing' && heeftDoc(A, 'amfibisch')) A.geenLanding = b + 1;
    tekst += `${V.naam} houdt stand${g.van ? ' en krijgt een tegenaanval-optie' : ''}. `;
  }
  rs.vorige = { beurt: b, winnaar: wint === 'A' ? A.id : V.id, verliezer: wint === 'A' ? V.id : A.id, scenario: g.scenario.naam };
  logRegel(state, 'gevecht', tekst.trim());
  // doctrine-boom: tweede doctrine na drie gewonnen gevechten
  for (const f of [A, V]) if (f.slots < 2 && f.zeges >= 3) { f.slots = 2; logRegel(state, 'event', `${f.naam} heeft drie gevechten gewonnen en mag een tweede doctrine kiezen.`); }
  herberekenBevoorrading(state);
  return null;
}

export function bonusDoelen(state, bo) {
  if (state.regios[bo.van].eigenaar !== bo.fid) return [];
  const bezig = new Set(state.gevechten.filter((g) => g.status === 'open').map((g) => g.regio));
  return kaartVan(state).buren[bo.van].filter((n) => vijandig(state, bo.fid, n) && !bezig.has(n) && factie(state, state.regios[n].eigenaar))
    .sort((a, b) => kaartVan(state).opId[b].waarde - kaartVan(state).opId[a].waarde);
}
export function bonusAanval(state, fid, van, naar) {
  const bo = state.bonus.find((x) => x.fid === fid && x.van === van);
  if (!bo) return 'Geen bonusaanval beschikbaar.';
  state.bonus = state.bonus.filter((x) => x !== bo);
  if (!naar) return null; // afgezien
  if (!bonusDoelen(state, bo).includes(naar)) return 'Ongeldig doel.';
  const g = maakGevecht(state, { soort: 'aanval', regio: naar, aanvaller: fid, verdediger: state.regios[naar].eigenaar, van, steun: [], bonus: true });
  state.gevechten.push(g);
  logRegel(state, 'order', `Blitzkrieg: ${factie(state, fid).naam} stoot meteen door naar ${kaartVan(state).opId[naar].naam}.`);
  return null;
}
export function herrolTerrein(state, gevechtId) {
  const g = state.gevechten.find((x) => x.id === gevechtId);
  g.terreinRol = (g.terreinRol || 0) + 1; g.terreinSeed = g.seed + '~' + g.terreinRol;
}

export function kiesTweedeDoctrine(state, fid, docId) {
  const f = factie(state, fid);
  if (f.slots < 2 || f.doctrines.length >= 2) return;
  const opties = doctrinesVoor(fid, state.periode).filter((d) => !f.doctrines.includes(d.id));
  const keuze = docId ? opties.find((d) => d.id === docId) : opties[0];
  if (keuze) { f.doctrines.push(keuze.id); logRegel(state, 'event', `${f.naam} neemt een tweede doctrine: ${keuze.naam}.`); }
}

function pasEventsToe(state, beurt) {
  const info = kaartVan(state);
  for (const e of state.events) {
    if (e.beurt !== beurt) continue;
    if (e.type === 'overdracht' && factie(state, e.naar)) for (const id of e.regios) if (info.opId[id]) { wisselEigenaar(state, id, e.naar); state.regios[id].start = e.naar; }
    if (e.type === 'sluit') for (const id of e.regios) if (info.opId[id]) { state.regios[id].eigenaar = 'neutraal'; state.regios[id].gesloten = true; }
    if (e.type === 'wapenstilstand' && factie(state, e.van) && factie(state, e.naar)) { for (const id of regiosVan(state, e.van)) { const fort = state.regios[id].fort; wisselEigenaar(state, id, e.naar); state.regios[id].fort = fort; } factie(state, e.van).verslagen = true; }
    if (e.type === 'bonus' && factie(state, e.factie)) factie(state, e.factie).extraOrders += 1;
    if (e.type === 'weer') state.geenLuchtTot = beurt + (e.geenLucht || 1) - 1;
    logRegel(state, 'event', e.tekst);
  }
}

export function stand(state) {
  const info = kaartVan(state), hoofdsteden = new Set(state.facties.map((f) => f.hoofdstad).filter(Boolean));
  const perFactie = state.facties.map((f) => {
    const eigen = regiosVan(state, f.id);
    let vp = f.bonusVP;
    for (const id of eigen) {
      let w = info.opId[id].waarde + (hoofdsteden.has(id) ? 3 : 0);
      if (heeftDoc(f, 'totaleoorlog') && state.regios[id].start === f.id) w = Math.max(1, w - 1);
      vp += w;
    }
    return { id: f.id, naam: f.naam, zijde: f.zijde, regios: eigen.length, vp };
  });
  const perZijde = {};
  for (const p of perFactie) perZijde[p.zijde] = (perZijde[p.zijde] || 0) + p.vp;
  let doel = null;
  if (state.doel) {
    const heeft = state.doel.regios.filter((id) => zijdeVan(state, state.regios[id].eigenaar) === state.doel.zijde);
    doel = { heeft: heeft.length, nodig: state.doel.min, lijst: state.doel.regios.map((id) => ({ id, naam: info.opId[id].naam, binnen: heeft.includes(id) })) };
  }
  return { perFactie, perZijde, doel };
}

export function kanBeurtEindigen(state) { return state.fase === 'gevechten' && state.gevechten.every((g) => g.status !== 'open') && state.bonus.length === 0; }

export function eindeBeurt(state) {
  if (!kanBeurtEindigen(state)) return 'Nog niet alle gevechten zijn afgehandeld.';
  const info = kaartVan(state), b = state.beurt;
  herberekenBevoorrading(state);
  // afgesneden regio's: teller en capitulatie
  for (const r of info.regios) {
    const rs = state.regios[r.id];
    if (rs.gevochten !== b) rs.omstreden = 0;
    if (!factie(state, rs.eigenaar)) continue;
    if (rs.verbonden) { rs.afgesnedenSinds = 0; continue; }
    if (!rs.afgesnedenSinds) rs.afgesnedenSinds = b;
    if (b - rs.afgesnedenSinds + 1 >= state.capitulatieNa && rs.luchtbrug < b) {
      const z = zijdeVan(state, rs.eigenaar), telling2 = {};
      for (const n of info.buren[r.id]) { const e = state.regios[n].eigenaar; if (factie(state, e) && zijdeVan(state, e) !== z) telling2[e] = (telling2[e] || 0) + 1; }
      const naar = Object.keys(telling2).sort((x, y) => telling2[y] - telling2[x])[0];
      if (naar) { const oud = factie(state, rs.eigenaar); wisselEigenaar(state, r.id, naar); oud.verloor = b; logRegel(state, 'kaart', `${r.naam} is ${state.capitulatieNa} beurten afgesneden en capituleert voor ${factie(state, naar).naam}.`); }
    }
  }
  for (const f of state.facties) {
    f.extraOrders = 0;
    f.herkans = f.herkans.filter((h) => h.beurt > b);
    if (f.tegenaanval && f.tegenaanval.beurt <= b) f.tegenaanval = null;
    for (const k of Object.keys(f.voorbereid)) if (f.voorbereid[k] < b) delete f.voorbereid[k];
    if (!f.verslagen && !f.later && regiosVan(state, f.id).length === 0) { f.verslagen = true; logRegel(state, 'event', `${f.naam} is verslagen.`); }
    if (f.later && regiosVan(state, f.id).length > 0) f.later = false;
    if (f.slots < 2 && b >= 5 && f.speler === 'mens') { f.slots = 2; logRegel(state, 'event', `${f.naam} mag na vijf beurten een tweede doctrine kiezen.`); }
  }
  // winst?
  const st = stand(state);
  const speelt = (z) => state.facties.some((f) => f.zijde === z && f.speler === 'mens');
  const levend = new Set(state.facties.filter((f) => f.speler === 'mens' && regiosVan(state, f.id).length > 0).map((f) => f.zijde));
  const zijdenMetSpeler = [...new Set(state.facties.map((f) => f.zijde))].filter(speelt);
  if (state.doel && st.doel.heeft >= st.doel.nodig) state.winnaar = { zijde: state.doel.zijde, reden: 'Het campagnedoel is gehaald.' };
  else if (levend.size === 1 && zijdenMetSpeler.length > 1) state.winnaar = { zijde: [...levend][0], reden: 'De tegenstander heeft geen regio\'s meer.' };
  else if (b >= state.maxBeurten) {
    if (state.doel) { const top = Object.entries(st.perZijde).filter(([z]) => z !== state.doel.zijde && speelt(z)).sort((x, y) => y[1] - x[1]); state.winnaar = { zijde: top.length ? top[0][0] : null, reden: 'Het campagnedoel is niet op tijd gehaald.' }; }
    else { const top = Object.entries(st.perZijde).filter(([z]) => speelt(z)).sort((x, y) => y[1] - x[1]); state.winnaar = top.length > 1 && top[0][1] === top[1][1] ? { zijde: null, reden: 'Gelijke stand in overwinningspunten.' } : { zijde: top[0][0], reden: 'De meeste overwinningspunten na de laatste beurt.' }; }
  }
  if (state.winnaar) {
    state.fase = 'einde';
    logRegel(state, 'event', state.winnaar.zijde ? `De campagne is voorbij: ${ZIJDEN[state.winnaar.zijde]} winnen. ${state.winnaar.reden}` : `De campagne eindigt onbeslist. ${state.winnaar.reden}`);
    return null;
  }
  state.beurt = b + 1;
  // doorlopende periode
  if (state.doorlopend) {
    const nieuw = periodeVanJaar(datumVan(state).jaar);
    if (PERIODE_VOLGORDE.indexOf(nieuw) > PERIODE_VOLGORDE.indexOf(state.periode)) {
      state.periode = nieuw;
      logRegel(state, 'event', `De oorlog schuift op naar ${PERIODES[state.periode].naam} (${PERIODES[state.periode].jaren}). Doctrines en toegelaten eenheden schuiven mee.`);
      for (const f of state.facties) {
        const geldig = doctrinesVoor(f.id, state.periode).map((d) => d.id);
        const weg = f.doctrines.filter((d) => !geldig.includes(d));
        if (!weg.length) continue;
        f.doctrines = f.doctrines.filter((d) => geldig.includes(d));
        if (!f.doctrines.length) f.doctrines = [geldig[0]];
        f.magWisselen = f.speler === 'mens';
        logRegel(state, 'event', `${f.naam}: ${weg.map((d) => doctrineVan(d).naam).join(', ')} bestaat niet meer in deze periode. Nieuwe doctrine: ${doctrineVan(f.doctrines[0]).naam}.`);
      }
    }
  }
  pasEventsToe(state, state.beurt);
  herberekenBevoorrading(state);
  startOrderFase(state);
  return null;
}

export function wisselDoctrine(state, fid, index, docId) {
  const f = factie(state, fid);
  if (!doctrinesVoor(fid, state.periode).some((d) => d.id === docId) || f.doctrines.includes(docId)) return;
  f.doctrines[index] = docId; f.magWisselen = false;
}

// Veteranen (optioneel): een eenheid die gevechten overleeft, krijgt een naam en een kleine bonus.
export function veteraanBonus(v) { return v.gevechten >= 5 ? 'Elite: één herworp per gevecht en +1 op moraal.' : v.gevechten >= 3 ? 'Veteraan: één herworp per gevecht.' : 'Nog geen bonus (vanaf 3 gevechten).'; }
