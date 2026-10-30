// Kaartweergave (plan 1.5): canvas met lagen, legenda en het districtpaneel.

import { t } from '../i18n.js';
import { h, geld, getal, meng } from './dom.js';
import { tekenKaart, districtOp } from '../map.js';
import { vind } from '../effects.js';
import {
  aandeel, controleert, bezet, bereikbaar, gebouwInkomen, marktInkomen,
} from '../districts.js';

export const LAGEN = ['eigenaar', 'rijkdom', 'criminaliteit', 'heat', 'loyaliteit', 'politie', 'techniveau'];
const STATS = ['bevolking', 'rijkdom', 'criminaliteit', 'loyaliteit', 'politie', 'techniveau', 'heat'];

// Canvas-kleuren (canvas kan geen CSS-variabelen lezen zonder omweg).
const LAAG_KLEUR = {
  rijkdom: '#f2c14e', criminaliteit: '#ff4d5e', heat: '#ff8a3d',
  loyaliteit: '#3ef08a', politie: '#4d8bff', techniveau: '#05d9e8',
};
const KLEUREN = {
  water: '#0a2238', golf: '#16405f', grens: '#06070d', kust: '#4a8db5',
  selectie: '#ffffff', tekst: '#f1f2ff', schaduw: '#05060c', leeg: '#191c38',
};


export const typeKleur = (data, type) => meng(KLEUREN.leeg, vind(data.districts.types, type)?.kleur || '#555555', 0.75);

export function districtKleur(d, laag, corpKleur, data) {
  if (laag === 'eigenaar') {
    const basis = typeKleur(data, d.type);
    return controleert(d) ? meng(basis, corpKleur, 0.9) : meng(basis, corpKleur, (aandeel(d) / 100) * 0.75);
  }
  return meng(KLEUREN.leeg, LAAG_KLEUR[laag], 0.12 + (0.88 * Math.min(100, d.stats[laag])) / 100);
}

let herteken = null;
addEventListener('resize', () => herteken?.());

// Canvas met klikselectie. Geeft [canvas, teken] terug; roep teken() aan zodra het in de DOM staat.
export function kaartCanvas(kaart, { kleur, geselecteerd, hq, opKlik, label }) {
  const canvas = h('canvas', { class: 'kaart-canvas', role: 'img', 'aria-label': label });
  canvas.addEventListener('click', (e) => {
    const id = districtOp(canvas, kaart, e.clientX, e.clientY);
    if (id != null) opKlik?.(id);
  });
  canvas.addEventListener('mousemove', (e) => {
    canvas.style.cursor = districtOp(canvas, kaart, e.clientX, e.clientY) != null ? 'pointer' : 'default';
  });
  const teken = () => tekenKaart(canvas, kaart, { kleur, geselecteerd, hq, kleuren: KLEUREN });
  herteken = teken;
  return [canvas, teken];
}

export function kaartPaneel(s, data, ui, ctl) {
  const [canvas, teken] = kaartCanvas(s.kaart, {
    kleur: (d) => districtKleur(d, ui.laag, s.corp.kleur, data),
    geselecteerd: ui.geselecteerd,
    hq: s.corp.hq,
    opKlik: ctl.selecteer,
    label: t('kaart.label'),
  });
  const legenda = ui.laag === 'eigenaar'
    ? h('div', { class: 'legenda' },
      h('span', {}, h('i', { style: `background:${s.corp.kleur}` }), t('legenda.controle')),
      h('span', {}, h('i', { style: `background:${meng(KLEUREN.leeg, s.corp.kleur, 0.45)}` }), t('legenda.aanwezig')),
      h('span', {}, h('i', { class: 'neutraal' }), t('legenda.neutraal')),
      h('span', {}, '★ ', t('legenda.hq')), h('span', {}, '▦ ', t('legenda.gebouwen')))
    : h('div', { class: 'legenda' },
      h('span', {}, '0'),
      h('i', { class: 'verloop', style: `background:linear-gradient(90deg, ${meng(KLEUREN.leeg, LAAG_KLEUR[ui.laag], 0.12)}, ${LAAG_KLEUR[ui.laag]})` }),
      h('span', {}, '100'));
  const el = h('section', { class: 'paneel kaart-paneel' },
    h('div', { class: 'lagen', role: 'group', 'aria-label': t('kaart.lagen') }, LAGEN.map((l) => h('button', {
      type: 'button', class: `laag${ui.laag === l ? ' actief' : ''}`, 'aria-pressed': String(ui.laag === l),
      onclick: () => ctl.laag(l),
    }, t(`laag.${l}`)))),
    canvas,
    legenda);
  return [el, teken];
}

function statusVan(s, d) {
  if (controleert(d)) return ['controle', {}];
  if (aandeel(d) > 0) return ['aanwezig', { pct: getal(aandeel(d)) }];
  if (bereikbaar(s.kaart, d)) return ['bereikbaar', {}];
  return ['buiten', {}];
}

export function districtPaneel(s, data, id, ctl) {
  const d = s.kaart.districten[id];
  if (!d) return h('section', { class: 'paneel district' }, h('p', { class: 'klein' }, t('district.kies')));
  const type = vind(data.districts.types, d.type);
  const [status, vars] = statusVan(s, d);
  const mijn = aandeel(d);
  const vrij = Math.max(0, 100 - bezet(d));
  const telling = {};
  for (const g of d.gebouwen) telling[g.type] = (telling[g.type] || 0) + 1;

  return h('section', { class: 'paneel district' },
    h('div', { class: 'district-kop' },
      h('h2', {}, d.naam),
      h('span', { class: 'type-label', style: `--type:${typeKleur(data, d.type)}` }, type?.naam),
      d.id === s.corp.hq ? h('span', { class: 'chip goed' }, `★ ${t('district.hq')}`) : null),
    h('p', { class: `status status-${status}` }, t(`district.status.${status}`, vars)),
    h('h3', {}, t('district.invloed')),
    h('div', { class: 'invloedsbalk', role: 'img', 'aria-label': t('district.balk_label', { jij: getal(mijn), vrij: getal(vrij) }) },
      mijn ? h('span', { class: 'deel jij', style: `width:${mijn}%;background:${s.corp.kleur}` }) : null,
      h('span', { class: 'deel vrij', style: `width:${vrij}%` }),
      h('span', { class: 'drempel', title: t('district.drempel') })),
    h('div', { class: 'balk-labels' },
      h('span', {}, t('district.jij', { naam: s.corp.naam, pct: getal(mijn) })),
      h('span', {}, t('district.vrij', { pct: getal(vrij) }))),
    h('dl', { class: 'dstats' }, STATS.map((st) => [
      h('dt', {}, t(`dstat.${st}`)),
      h('dd', {}, h('span', { class: 'mini' }, h('span', { style: `width:${Math.min(100, d.stats[st])}%`, class: `mini-${st}` })), h('b', {}, getal(Math.round(d.stats[st])))),
    ])),
    h('p', { class: 'klein' }, t('district.markt', { waarde: geld(marktInkomen(d, data.balans)) })),
    h('h3', {}, t('district.bouwplaatsen', { bezet: d.gebouwen.length, totaal: d.slots })),
    d.gebouwen.length
      ? h('ul', { class: 'gebouwlijst' }, Object.entries(telling).map(([tid, n]) => {
        const def = vind(data.buildings, tid);
        return h('li', {}, h('span', {}, `${def?.naam ?? tid}${n > 1 ? ` ×${n}` : ''}`),
          h('span', { class: 'klein' }, t('district.per_beurt', { waarde: geld(n * gebouwInkomen(def, d, data.balans)) })));
      }))
      : h('p', { class: 'klein' }, t('district.geen_gebouwen')),
    h('h3', {}, t('district.buren')),
    h('div', { class: 'chips' }, d.buren.map((b) => h('button', {
      type: 'button', class: 'chip knopchip', onclick: () => ctl.selecteer(b),
    }, s.kaart.districten[b].naam))));
}
