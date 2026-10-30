// Opdrachtenpaneel: aangeboden opdrachten aanvaarden of weigeren, lopende opdrachten volgen.

import { t } from '../i18n.js';
import { h, geld, getal, effectChips } from './dom.js';
import { vind } from '../effects.js';
import { doelBereikt } from '../opdrachten.js';
import { statWaarde } from '../districts.js';

const fmt = (stat, v) => (stat === 'geld' ? geld(v) : `${getal(v)}${stat === 'stad' ? '%' : ''}`);

// Leesbare tekst voor één doelvoorwaarde.
function beschrijf(v, s, data) {
  if (v.plus != null) {
    return t('doel.plus', { stat: t(`stat.${v.stat}`), plus: fmt(v.stat, v.plus), nu: fmt(v.stat, statWaarde(s, v.stat)) });
  }
  if ('stat' in v) {
    const nu = fmt(v.stat, statWaarde(s, v.stat));
    return v.min != null
      ? t('doel.min', { stat: t(`stat.${v.stat}`), waarde: fmt(v.stat, v.min), nu })
      : t('doel.max', { stat: t(`stat.${v.stat}`), waarde: fmt(v.stat, v.max), nu });
  }
  if ('district_type' in v) {
    const type = vind(data.districts.types, String(v.district_type).toLowerCase().replace(/\s+/g, '_'))?.naam ?? v.district_type;
    return t(v.controle ? 'doel.controle_type' : 'doel.aanwezig_type', { type });
  }
  if (v.district) {
    const f = v.district;
    const d = s.kaart.districten[f.id];
    const naam = d?.naam ?? '?';
    if (!f.stat) return t('doel.district', { naam });
    const nu = d ? (f.stat === 'invloed' ? d.invloed.speler || 0 : d.stats[f.stat]) : 0;
    const pct = f.stat === 'invloed' ? '%' : '';
    return f.min != null
      ? t('doel.district_min', { naam, stat: t(`dstat.${f.stat}`).toLowerCase(), waarde: `${f.min}${pct}`, nu: `${getal(Math.round(nu))}${pct}` })
      : t('doel.district_max', { naam, stat: t(`dstat.${f.stat}`).toLowerCase(), waarde: `${f.max}${pct}`, nu: `${getal(Math.round(nu))}${pct}` });
  }
  return t('doel.onbekend');
}

// Een aangeboden opdracht heeft nog geen vast doel: toon het doel uit de definitie, met het juiste district.
function doelVan(x, def) {
  return (def.doel || []).map((v) => (v.district?.context ? { district: { ...v.district, id: x.district } } : v));
}

function opdrachtKaart(x, s, data, knoppen) {
  const def = vind(data.opdrachten, x.id);
  const actief = 'deadline' in x;
  const bereikt = actief && doelBereikt(s, x);
  const doelen = actief ? x.doel : doelVan(x, def);
  return h('article', { class: `opdracht${bereikt ? ' bereikt' : ''}` },
    h('div', { class: 'opdracht-kop' },
      h('h3', {}, x.titel),
      h('span', { class: 'klein' }, actief
        ? t('opdracht.nog', { n: Math.max(0, x.deadline - s.beurt) })
        : t('opdracht.termijn', { n: x.termijn }))),
    h('p', { class: 'klein' }, x.opdrachtgever),
    actief ? null : h('p', { class: 'opdracht-tekst' }, x.tekst),
    h('ul', { class: 'doelen' }, doelen.map((v) => h('li', {}, beschrijf(v, s, data)))),
    bereikt ? h('p', { class: 'goed klein' }, t('opdracht.bereikt')) : null,
    h('div', { class: 'chips' }, h('span', { class: 'klein' }, t('opdracht.beloning')), effectChips(def.beloning)),
    def.straf?.length ? h('div', { class: 'chips' }, h('span', { class: 'klein' }, t('opdracht.straf')), effectChips(def.straf)) : null,
    knoppen);
}

export function opdrachtenPaneel(s, data, ctl) {
  const o = s.opdrachten;
  const vol = o.actief.length >= data.balans.opdrachten_max;
  return h('section', { class: 'paneel opdrachten' },
    h('h2', {}, t('opdracht.titel'), h('span', { class: 'teller' }, `${o.actief.length}/${data.balans.opdrachten_max}`)),
    o.actief.length
      ? o.actief.map((x) => opdrachtKaart(x, s, data, null))
      : h('p', { class: 'klein' }, t('opdracht.geen_actief')),
    o.aangeboden.length ? [
      h('h3', {}, t('opdracht.aanbod')),
      o.aangeboden.map((x, i) => opdrachtKaart(x, s, data, h('div', { class: 'opdracht-knoppen' },
        vol ? h('span', { class: 'reden' }, t('opdracht.vol')) : h('span', {}),
        h('button', { type: 'button', class: 'knop', onclick: () => ctl.weiger(i) }, t('opdracht.weiger')),
        h('button', { type: 'button', class: 'knop primair', disabled: vol || s.fase !== 'acties', onclick: () => ctl.aanvaard(i) }, t('opdracht.aanvaard'))))),
    ] : h('p', { class: 'klein' }, t('opdracht.geen_aanbod')),
    h('p', { class: 'klein' }, t('opdracht.score', { gelukt: o.gelukt, mislukt: o.mislukt })));
}
