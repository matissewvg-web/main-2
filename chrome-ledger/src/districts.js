// Districtregels (plan 1.3 en 1.4): invloed per factie, controle, bereik, inkomen.
// Een district: { id, naam, type, buren: [ids], stats: {bevolking, rijkdom, criminaliteit,
// loyaliteit, politie, techniveau, heat}, basis: {...}, slots, invloed: {factie: %}, gebouwen: [{type}] }

export const SPELER = 'speler';

// Plan 1.4: controle = meer dan 50% invloed én meer dan elke andere factie.
export const CONTROLE_DREMPEL = 50;

const vindId = (lijst, id) => lijst.find((x) => x.id === id);
const r1 = (v) => Math.round(v * 10) / 10;

export const aandeel = (d, factie = SPELER) => d.invloed[factie] || 0;
export const bezet = (d) => Object.values(d.invloed).reduce((a, b) => a + b, 0);
export const aanwezig = (d) => aandeel(d) > 0;

export function controleur(d) {
  let beste = null;
  let max = 0;
  let gelijk = false;
  for (const [f, v] of Object.entries(d.invloed)) {
    if (v > max) { beste = f; max = v; gelijk = false; } else if (v === max) gelijk = true;
  }
  return max > CONTROLE_DREMPEL && !gelijk ? beste : null;
}
export const controleert = (d) => controleur(d) === SPELER;

// Je breidt alleen uit naar districten waar je al staat of die daaraan grenzen.
export const bereikbaar = (kaart, d) => aanwezig(d) || d.buren.some((i) => aanwezig(kaart.districten[i]));

export function zetAandeel(d, waarde, factie = SPELER) {
  const anderen = bezet(d) - aandeel(d, factie);
  const v = r1(Math.min(100 - anderen, Math.max(0, waarde)));
  if (v > 0) d.invloed[factie] = v;
  else delete d.invloed[factie];
}

// 'Haven', 'haven' en 'Oude Stad' → type-id.
const typeId = (ref) => String(ref).toLowerCase().trim().replace(/\s+/g, '_');
export const isType = (d, ref) => d.type === typeId(ref);

export function districtWaarde(d, stat) {
  if (stat === 'invloed') return aandeel(d);
  if (stat === 'gebouwen') return d.gebouwen.length;
  if (stat === 'slots') return d.slots;
  return d.stats[stat];
}

// Districten die passen bij een filter { type, controle, aanwezig, stat, min, max },
// beste kandidaat eerst (meeste invloed van de speler, dan laagste id).
export function filterDistricten(state, f) {
  const ds = state.kaart?.districten || [];
  return ds.filter((d) => {
    if (f.type && !isType(d, f.type)) return false;
    if (f.controle != null && controleert(d) !== f.controle) return false;
    if (f.aanwezig != null && aanwezig(d) !== f.aanwezig) return false;
    if (f.stat) {
      const w = districtWaarde(d, f.stat);
      if ((f.min != null && w < f.min) || (f.max != null && w > f.max)) return false;
    }
    return true;
  }).sort((a, b) => aandeel(b) - aandeel(a) || a.id - b.id);
}

// Voorwaarde → districtfilter, of null als het geen districtvoorwaarde is.
export function alsDistrictFilter(v) {
  if ('district_type' in v) return { type: v.district_type, controle: v.controle, aanwezig: v.aanwezig };
  if (v.district && typeof v.district === 'object') return v.district;
  return null;
}

// Verwijzing in een effect → lijst districten.
// 'doel' | 'hier' | 'context' = het district van de actie/het gebouw/het event,
// 'hq', 'alle', 'aanwezig', 'controle', of een type ('Haven').
export function zoekDistricten(state, ref, contextId) {
  const ds = state.kaart?.districten;
  if (!ds) return [];
  const ctx = contextId != null ? ds[contextId] : null;
  switch (ref) {
    case 'doel': case 'hier': case 'context': return ctx ? [ctx] : [];
    case 'hq': return ds[state.corp.hq] ? [ds[state.corp.hq]] : [];
    case 'alle': return ds;
    case 'aanwezig': return ds.filter(aanwezig);
    case 'controle': return ds.filter(controleert);
    default: {
      if (ctx && isType(ctx, ref)) return [ctx];
      const kandidaten = filterDistricten(state, { type: ref });
      return kandidaten.length ? [kandidaten[0]] : [];
    }
  }
}

// Afgeleide stats die acties en voorwaarden kunnen gebruiken naast state.res.
export function afgeleid(state) {
  const ds = state.kaart?.districten || [];
  const totaal = ds.reduce((a, d) => a + d.stats.bevolking, 0) || 1;
  const onder = ds.filter(controleert);
  return {
    gebouwen: ds.reduce((a, d) => a + d.gebouwen.length, 0),
    districten: ds.filter(aanwezig).length,
    controle: onder.length,
    stad: Math.round((100 * onder.reduce((a, d) => a + d.stats.bevolking, 0)) / totaal),
  };
}

export function statWaarde(state, stat) {
  return stat in state.res ? state.res[stat] : afgeleid(state)[stat];
}

export function* alleGebouwen(state, data) {
  for (const d of state.kaart?.districten || []) {
    for (const g of d.gebouwen) yield { d, g, def: vindId(data.buildings, g.type) };
  }
}

// Bruto-inkomen van één gebouw in een district, vóór tech/druk/modifiers.
export function gebouwInkomen(def, d, balans) {
  return def.inkomen
    * (balans.gebouw_rijkdom_basis + d.stats.rijkdom * balans.gebouw_rijkdom_factor)
    * (1 + (def.type_bonus?.[d.type] || 0));
}

// Marktinkomen uit je aandeel in een district, vóór tech/druk/modifiers.
export function marktInkomen(d, balans) {
  const a = aandeel(d) / 100;
  if (!a) return 0;
  const m = (d.stats.bevolking / 100) * (d.stats.rijkdom / 100) * balans.markt_factor * a;
  return controleert(d) ? m * (1 + balans.controle_bonus) : m;
}

// Kan dit gebouw hier? → null of een reden-sleutel.
export function bouwProbleem(d, def, balans) {
  if (aandeel(d) < balans.bouw_min_invloed) return 'te_weinig_invloed';
  if (d.gebouwen.length >= d.slots) return 'vol';
  if (def.alleen_types && !def.alleen_types.includes(d.type)) return 'verkeerd_type';
  if (def.max_per_district && d.gebouwen.filter((g) => g.type === def.id).length >= def.max_per_district) return 'max_gebouw';
  return null;
}
