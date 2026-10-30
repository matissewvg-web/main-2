// Laadt alle spelinhoud uit /data. `haal` is vervangbaar zodat tools/sim.mjs
// dezelfde data via het bestandssysteem kan lezen.

import { stelGrenzenIn } from './effects.js';

const BESTANDEN = [
  'balans', 'archetypes', 'sectors', 'culture', 'perks', 'flaws',
  'actions', 'buildings', 'districts', 'winconditions', 'logos', 'mods',
  'bedrijfsvormen', 'markt', 'moeilijkheid', 'opdrachten', 'nieuws',
];

async function haalJson(pad) {
  const r = await fetch(pad);
  if (!r.ok) throw new Error(`${pad}: ${r.status}`);
  return r.json();
}

export async function laadData(haal = haalJson, basis = 'data') {
  const data = {};
  await Promise.all(BESTANDEN.map(async (naam) => {
    data[naam] = await haal(`${basis}/${naam}.json`);
  }));
  const index = await haal(`${basis}/events/index.json`);
  const packs = await Promise.all(index.map((f) => haal(`${basis}/events/${f}`)));
  data.events = packs.flat();
  data.i18n = await haal(`${basis}/i18n/nl.json`);
  stelGrenzenIn(data.balans.grenzen);
  controleerData(data);
  return data;
}

// Fouten in JSON vroeg melden in de console, in plaats van midden in een spel.
function controleerData(data) {
  const ids = new Set();
  for (const ev of data.events) {
    if (ids.has(ev.id)) console.warn(`Dubbel event-id: ${ev.id}`);
    ids.add(ev.id);
  }
  for (const ev of data.events) {
    if (!ev.keuzes?.length) console.warn(`Event zonder keuzes: ${ev.id}`);
    else if (ev.keuzes.every((k) => k.vereist?.length)) {
      console.warn(`${ev.id}: elke keuze heeft een vereiste; geef minstens één keuze zonder 'vereist'`);
    }
    for (const k of ev.keuzes || []) {
      if (k.volgt && !ids.has(k.volgt)) console.warn(`${ev.id}: volgt onbekend event ${k.volgt}`);
    }
  }
}
