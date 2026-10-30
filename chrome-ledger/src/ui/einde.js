// Game over of overwinning.

import { t } from '../i18n.js';
import { h, fmtStat, datumLabel } from './dom.js';
import { statWaarde } from '../districts.js';

const STATS = ['geld', 'invloed', 'tech', 'heat', 'personeel', 'gebouwen', 'stad'];

export function eindeVenster(s, ctl) {
  const e = s.einde;
  const gewonnen = e.soort === 'gewonnen';
  return h('div', { class: 'overlay' },
    h('div', { class: `venster einde ${gewonnen ? 'gewonnen' : 'verloren'}`, role: 'dialog', 'aria-modal': 'true' },
      h('h2', {}, t(gewonnen ? 'einde.gewonnen' : 'einde.verloren')),
      h('p', {}, t(`einde.reden.${e.reden}`, { naam: s.corp.naam })),
      h('p', { class: 'klein' }, t('einde.wanneer', { datum: datumLabel(e.jaar, e.deel), beurt: e.beurt })),
      h('div', { class: 'startstats' }, STATS.map((k) => h('div', { class: 'stat' },
        h('span', {}, t(`stat.${k}`)),
        h('strong', {}, k === 'stad' ? `${statWaarde(s, k)}%` : fmtStat(k, statWaarde(s, k)))))),
      h('p', { class: 'klein' }, t('einde.opdrachten', { gelukt: s.opdrachten.gelukt, mislukt: s.opdrachten.mislukt })),
      h('div', { class: 'knoppen' },
        h('button', { type: 'button', class: 'knop primair', onclick: ctl.nieuw }, t('menu.nieuw')),
        h('button', { type: 'button', class: 'knop', onclick: ctl.exporteer }, t('knop.exporteer')),
        h('button', { type: 'button', class: 'knop', onclick: ctl.menu }, t('knop.menu')))));
}
