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

export function laad() {
  try {
    const tekst = localStorage.getItem(SLEUTEL);
    return tekst ? valideer(JSON.parse(tekst)) : null;
  } catch (e) {
    console.warn('Laden mislukt', e);
    return null;
  }
}

export function wis() {
  try { localStorage.removeItem(SLEUTEL); } catch { /* niets */ }
}

function valideer(s) {
  if (!s || typeof s !== 'object' || !s.res || !s.corp || typeof s.rng !== 'number') {
    throw new Error('Geen geldige Chrome Ledger-save');
  }
  if (s.versie !== VERSIE) throw new Error(`Save-versie ${s.versie} wordt niet ondersteund (verwacht ${VERSIE})`);
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
