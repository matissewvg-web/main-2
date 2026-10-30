// Kleine DOM-helpers en opmaak, gedeeld door alle schermen.

import { t } from '../i18n.js';

export function h(tag, attrs = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinderen.flat(Infinity)) {
    if (kind != null && kind !== false) el.append(kind.nodeType ? kind : String(kind));
  }
  return el;
}

// Mengt twee #rrggbb-kleuren: f = 0 geeft a, f = 1 geeft b.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export function meng(a, b, f) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * Math.min(1, Math.max(0, f))).toString(16).padStart(2, '0')).join('')}`;
}

const NF = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 1 });
export const getal = (n) => NF.format(n);
export const geld = (n) => `€ ${NF.format(Math.round(n))}`;
export const metTeken = (n, f = getal) => (n > 0 ? '+' : n < 0 ? '−' : '±') + f(Math.abs(n));
export const fmtStat = (stat, v) => (stat === 'geld' ? geld(v) : getal(v));
export const datumLabel = (jaar, deel) => t('datum', { jaar, deel });

// Voor deze stats is omhoog slecht.
const SLECHT_OMHOOG = new Set(['heat', 'druk', 'criminaliteit', 'politie']);
const toon = (stat, delta) => ((delta > 0) !== SLECHT_OMHOOG.has(stat) ? 'goed' : 'slecht');

export function wijzigingChips(wijzigingen = {}) {
  return Object.entries(wijzigingen)
    .filter(([, v]) => v)
    .map(([stat, v]) => h('span', { class: `chip ${toon(stat, v)}` },
      `${t(`stat.${stat}`)} ${metTeken(v, stat === 'geld' ? geld : getal)}`));
}

// Wijzigingen in districten: [{ naam, stat, delta }].
export function districtChips(lijst = []) {
  return lijst.map(({ naam, stat, delta }) => h('span', { class: `chip ${toon(stat, delta)}` },
    `${naam}: ${t(`dstat.${stat}`)} ${metTeken(delta)}${stat === 'invloed' ? '%' : ''}`));
}

const GEBOUW_MOD = 'gebouw_inkomen.';

function modLabel(k, data) {
  if (!k.startsWith(GEBOUW_MOD)) return t(`mod.${k}`);
  const id = k.slice(GEBOUW_MOD.length);
  return t('mod.gebouw_inkomen', { gebouw: data.buildings.find((b) => b.id === id)?.naam ?? id });
}

export function modChips(mods, data) {
  return Object.entries(mods).filter(([, v]) => v).map(([k, v]) => {
    const meta = data.mods[k] || (k.startsWith(GEBOUW_MOD) && data.mods[`${GEBOUW_MOD}*`]) || { soort: 'pct', goed: 1 };
    const tekst = meta.soort === 'abs' ? metTeken(v)
      : meta.soort === 'pp' ? t('mod.procentpunt', { waarde: metTeken(Math.round(v * 100)) })
      : `${metTeken(Math.round(v * 100))}%`;
    return h('span', { class: `chip ${Math.sign(v) === meta.goed ? 'goed' : 'slecht'}` }, `${modLabel(k, data)} ${tekst}`);
  });
}

// Alle effecten van een keuze (oprichter, sector, perk, ...) gesplitst in voordelen en nadelen.
export function voorNadeel(bron, data) {
  const chips = [
    ...effectChips(bron.start),
    ...(bron.per_beurt?.length
      ? effectChips(bron.per_beurt).map((c) => { c.prepend(`${t('vn.per_beurt')} `); return c; })
      : []),
    ...modChips(bron.mods || {}, data),
  ];
  const slecht = chips.filter((c) => c.classList.contains('slecht'));
  const goed = chips.filter((c) => !c.classList.contains('slecht'));
  return h('div', { class: 'voor-nadeel' },
    h('div', { class: 'vn voordelen' }, h('span', { class: 'vn-kop' }, `✚ ${t('vn.voordelen')}`),
      goed.length ? goed : h('span', { class: 'klein' }, t('vn.geen'))),
    h('div', { class: 'vn nadelen' }, h('span', { class: 'vn-kop' }, `✖ ${t('vn.nadelen')}`),
      slecht.length ? slecht : h('span', { class: 'klein' }, t('vn.geen'))));
}

// Leesbare voorvertoning van effecttaal (acties, startbonussen, vaste posten).
export function effectChips(effecten = []) {
  return effecten.flatMap((e) => {
    if ('kans' in e) {
      return [h('span', { class: 'chip kans' },
        t('effect.kans', { pct: Math.round(e.kans * 100) }), ' ', effectChips(e.dan),
        e.anders?.length ? [' ', t('effect.anders'), ' ', effectChips(e.anders)] : null)];
    }
    if (!('stat' in e)) return [];
    const ref = e.district ?? e.district_type;
    const refNaam = t(`effect.district.${ref}`) === `effect.district.${ref}` ? ref : t(`effect.district.${ref}`);
    const label = ref != null ? `${refNaam}: ${t(`dstat.${e.stat}`).toLowerCase()}` : t(`stat.${e.stat}`);
    const f = e.stat === 'geld' ? geld : getal;
    if ((e.op ?? 'add') === 'mul') return [h('span', { class: 'chip' }, `${label} ×${getal(e.waarde)}`)];
    if (e.op === 'set') return [h('span', { class: 'chip' }, `${label} = ${f(e.waarde)}`)];
    if (typeof e.waarde === 'object') {
      const { min, max } = e.waarde;
      const midden = (min + max) / 2;
      const tekst = min < 0 && max < 0 ? `−${f(-max)}–${f(-min)}` : `${metTeken(min, f)}–${f(max)}`;
      return [h('span', { class: `chip ${toon(e.stat, midden)}` }, `${label} ${tekst}`)];
    }
    return [h('span', { class: `chip ${toon(e.stat, e.waarde)}` }, `${label} ${metTeken(e.waarde, f)}`)];
  });
}
