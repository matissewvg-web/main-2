// Het kwartaalrapport bovenaan elke beurt.

import { t } from '../i18n.js';
import { h, geld, metTeken, wijzigingChips, datumLabel } from './dom.js';

function nieuwsBlok(s) {
  const nu = (s.nieuws || []).filter((n) => n.beurt === s.beurt);
  if (!nu.length) return null;
  return h('div', { class: 'nieuws' },
    h('span', { class: 'nieuws-kop' }, t('rapport.nieuws')),
    nu.map((n) => h('p', { class: n.markt ? 'markt-nieuws' : '' }, n.tekst)));
}

export function rapportPaneel(s, data) {
  const r = s.rapport;
  const titel = h('h2', {}, t('rapport.titel', { datum: datumLabel(r.jaar, r.deel) }));
  if (r.welkom) {
    return h('section', { class: 'paneel rapport' }, titel,
      h('p', {}, t('rapport.welkom', { naam: s.corp.naam })),
      s.corp.slogan ? h('p', { class: 'slogan' }, `“${s.corp.slogan}”`) : null,
      h('p', { class: 'klein' }, t('rapport.welkom_uitleg', { ap: data.balans.actiepunten })));
  }
  const overig = { ...r.wijzigingen };
  delete overig.geld;
  return h('section', { class: 'paneel rapport' }, titel,
    nieuwsBlok(s),
    h('table', { class: 'posten' },
      h('tbody', {}, r.posten.map((p) => h('tr', {},
        h('td', {}, p.sleutel ? t(p.sleutel) : p.naam),
        h('td', { class: p.waarde < 0 ? 'slecht' : 'goed' }, metTeken(p.waarde, geld))))),
      h('tfoot', {}, h('tr', {},
        h('th', {}, t('rapport.netto')),
        h('th', { class: r.netto < 0 ? 'slecht' : 'goed' }, metTeken(r.netto, geld))))),
    Object.keys(overig).length ? h('div', { class: 'chips' }, wijzigingChips(overig)) : null,
    r.meldingen.length ? h('ul', { class: 'meldingen' }, r.meldingen.map((m) =>
      h('li', { class: m.soort }, t(m.sleutel, m.vars)))) : null);
}
