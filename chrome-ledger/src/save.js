// Opslaan in localStorage, plus export/import als JSON-bestand.

import { VERSIE } from './state.js';

const SLEUTEL = 'chrome-ledger:save';

export function bewaar(state) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('Opslaan mislukt', e);
    return false;
  }
}

// → { state, fout }: state is null als er geen bruikbare save is; fout zegt waarom.
export function probeer() {
  try {
    const tekst = localStorage.getItem(SLEUTEL);
    return { state: tekst ? valideer(JSON.parse(tekst)) : null, fout: null };
  } catch (e) {
    return { state: null, fout: e };
  }
}

export const laad = () => probeer().state;

export function wis() {
  try { localStorage.removeItem(SLEUTEL); } catch { /* niets */ }
}

function valideer(s) {
  if (!s || typeof s !== 'object' || !s.res || !s.corp || typeof s.rng !== 'number') {
    throw new Error('Geen geldige Chrome Ledger-save');
  }
  if (s.versie !== VERSIE) {
    throw Object.assign(new Error(`Save-versie ${s.versie} wordt niet ondersteund (verwacht ${VERSIE})`), { versie: true });
  }
  return s;
}

export function exporteer(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const naam = (state.corp.naam || 'corpo').replace(/[^\w-]+/g, '_');
  a.href = URL.createObjectURL(blob);
  a.download = `chrome-ledger_${naam}_${state.jaar}-K${state.deel}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importeer(bestand) {
  return valideer(JSON.parse(await bestand.text()));
}
