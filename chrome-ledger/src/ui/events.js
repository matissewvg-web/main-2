// Event-venster: keuze maken, daarna de gevolgen lezen.

import { t } from '../i18n.js';
import { h, wijzigingChips, districtChips, getal, geld } from './dom.js';
import { vind, voldaan, eersteOnvoldaan } from '../effects.js';
import { vulIn } from '../turn.js';

function waaromNiet(v) {
  if ('stat' in v && v.min != null) {
    return t('vereist.min', { stat: t(`stat.${v.stat}`), waarde: v.stat === 'geld' ? geld(v.min) : getal(v.min) });
  }
  if ('stat' in v && v.max != null) {
    return t('vereist.max', { stat: t(`stat.${v.stat}`), waarde: v.stat === 'geld' ? geld(v.max) : getal(v.max) });
  }
  return t('vereist.algemeen');
}

export function eventVenster(s, data, ctl) {
  const ev = vind(data.events, s.event.id);
  const titel = vulIn(ev.titel, s);
  const inhoud = [h('h2', {}, titel), h('p', { class: 'event-tekst' }, vulIn(ev.tekst, s))];

  if (s.fase === 'event') {
    inhoud.push(h('div', { class: 'keuzes' }, ev.keuzes.map((k, i) => {
      const kan = voldaan(s, k.vereist);
      return h('button', { type: 'button', class: 'knop keuze', disabled: !kan, onclick: () => ctl.kies(i) },
        vulIn(k.tekst, s),
        kan ? null : h('span', { class: 'reden' }, waaromNiet(eersteOnvoldaan(s, k.vereist))));
    })));
  } else {
    const r = s.event.resultaat;
    const heeftGevolgen = Object.keys(r.wijzigingen).length || r.districten?.length;
    inhoud.push(
      h('p', { class: 'gekozen-keuze' }, '› ', vulIn(ev.keuzes[s.event.keuze].tekst, s)),
      r.teksten.map((tekst) => h('p', {}, tekst)),
      h('div', { class: 'chips' }, heeftGevolgen
        ? [wijzigingChips(r.wijzigingen), districtChips(r.districten)]
        : t('event.geen_gevolgen')),
      h('button', { type: 'button', class: 'knop primair', onclick: ctl.verder }, t('knop.verder')));
  }
  return h('div', { class: 'overlay' },
    h('div', { class: 'venster event', role: 'dialog', 'aria-modal': 'true', 'aria-label': titel }, inhoud));
}
