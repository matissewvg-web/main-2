// De stad leeft: een economische cyclus (data/markt.json) en stadsnieuws (data/nieuws.json).

import { vind, voldaan } from './effects.js';

const NIEUWS_MAX = 12;
const r1 = (v) => Math.round(v * 10) / 10;

export const huidigeFase = (state, data) => vind(data.markt.fasen, state.markt.fase);

// Eén beurt verder in de cyclus. Geeft de nieuwe fase terug als die wisselde, anders null.
export function marktBeurt(state, data, rng) {
  const fase = huidigeFase(state, data);
  // De fase laat de districten langzaam rijker of armer worden.
  for (const d of state.kaart.districten) {
    for (const [stat, v] of Object.entries(fase.district || {})) {
      d.stats[stat] = r1(Math.min(100, Math.max(0, d.stats[stat] + v)));
    }
  }
  state.markt.resterend--;
  if (state.markt.resterend > 0) return null;
  const opties = Object.entries(fase.volgende);
  const [volgende] = rng.gewogen(opties, ([, kans]) => kans);
  const nieuw = vind(data.markt.fasen, volgende);
  state.markt = { fase: nieuw.id, resterend: rng.int(...nieuw.duur) };
  return nieuw.id === fase.id ? null : nieuw;
}

function vulNieuws(tekst, state, rng) {
  const ds = state.kaart.districten;
  return tekst
    .replaceAll('{district}', ds[rng.int(0, ds.length - 1)].naam)
    .replaceAll('{corp}', state.corp.naam);
}

// Eén kop per beurt: een marktwissel heeft voorrang, anders een willekeurig bericht.
export function nieuwsBeurt(state, data, rng, nieuweFase) {
  let item;
  if (nieuweFase) {
    item = { tekst: `${nieuweFase.naam.toUpperCase()}: ${nieuweFase.tekst}`, markt: true };
  } else {
    const recent = new Set(state.nieuws.slice(0, 8).map((n) => n.bron));
    const kandidaten = data.nieuws.map((n, i) => ({ ...n, i }))
      .filter((n) => !recent.has(n.i) && voldaan(state, n.voorwaarde));
    if (!kandidaten.length) return;
    const n = kandidaten[rng.int(0, kandidaten.length - 1)];
    item = { tekst: vulNieuws(n.tekst, state, rng), bron: n.i };
  }
  state.nieuws.unshift({ beurt: state.beurt, jaar: state.jaar, deel: state.deel, ...item });
  state.nieuws.length = Math.min(state.nieuws.length, NIEUWS_MAX);
}
