// Het spelscherm: kop, bronnen, kaart, districtpaneel, acties, rapport, logboek, plus vensters.

import { t } from '../i18n.js';
import {
  h, geld, getal, metTeken, wijzigingChips, districtChips, effectChips, datumLabel,
} from './dom.js';
import { logoSvg } from './logo.js';
import { rapportPaneel } from './rapport.js';
import { eventVenster } from './events.js';
import { eindeVenster } from './einde.js';
import { kaartPaneel, districtPaneel } from './kaart.js';
import { controleer } from '../actions.js';
import { brutoInkomen, kosten, personeelNodig } from '../turn.js';
import { modsVan } from '../state.js';
import { bronnen, vind } from '../effects.js';
import { afgeleid, gebouwInkomen } from '../districts.js';

// ui: { geselecteerd: district-id, laag, gebouw: gebouw-id }
export function toonSpel(root, data, s, ui, ctl) {
  const mods = modsVan(s, data);
  const logScroll = root.querySelector('.logboek ol')?.scrollTop ?? 0;
  const [kaartEl, tekenKaart] = kaartPaneel(s, data, ui, ctl);
  root.replaceChildren(h('div', { class: 'spel', style: `--corp:${s.corp.kleur};--corp-accent:${s.corp.accent}` },
    kop(s, ctl),
    bronnenBalk(s, data, mods),
    h('div', { class: 'raster' },
      kaartEl,
      districtPaneel(s, data, ui.geselecteerd, ctl),
      actiePaneel(s, data, mods, ui, ctl),
      rapportPaneel(s, data),
      logPaneel(s)),
    (s.fase === 'event' || s.fase === 'resultaat') && s.event ? eventVenster(s, data, ctl) : null,
    s.fase === 'einde' && s.einde ? eindeVenster(s, ctl) : null));
  tekenKaart();
  const ol = root.querySelector('.logboek ol');
  if (ol) ol.scrollTop = logScroll;
  root.querySelector('.overlay .knop:not([disabled])')?.focus();
}

function kop(s, ctl) {
  return h('header', { class: 'spel-kop' },
    h('div', { class: 'merk' },
      logoSvg(s.corp.logo, s.corp.kleur, s.corp.accent, 44),
      h('div', {},
        h('div', { class: 'corp-naam' }, s.corp.naam),
        s.corp.slogan ? h('div', { class: 'corp-slogan' }, s.corp.slogan) : null)),
    h('div', { class: 'datum' },
      h('strong', {}, datumLabel(s.jaar, s.deel)),
      h('span', {}, t('kop.beurt', { beurt: s.beurt })),
      h('span', { class: 'seed', title: t('kop.seed_uitleg') }, t('kop.seed', { seed: s.seed }))),
    h('div', { class: 'knoppen' },
      h('button', { type: 'button', class: 'knop', onclick: ctl.exporteer }, t('knop.exporteer')),
      h('button', { type: 'button', class: 'knop', onclick: ctl.menu }, t('knop.menu'))));
}

function prognose(s, data, mods) {
  const { bruto } = brutoInkomen(s, data, mods);
  const { lonen, onderhoud } = kosten(s, data, mods);
  const vast = bronnen(s.corp, data).flatMap((b) => b.per_beurt || [])
    .filter((e) => e.stat === 'geld' && typeof e.waarde === 'number')
    .reduce((a, e) => a + e.waarde, 0);
  return bruto - lonen - onderhoud + vast;
}

function bronnenBalk(s, data, mods) {
  const b = data.balans;
  const r = s.res;
  const af = afgeleid(s);
  const nodig = personeelNodig(s, data);
  const netto = prognose(s, data, mods);
  const vrij = s.kaart.districten.filter((d) => d.invloed.speler >= b.bouw_min_invloed)
    .reduce((a, d) => a + d.slots - d.gebouwen.length, 0);
  const tegel = (stat, waarde, sub, extra = '') => h('div', { class: `bron ${extra}`, title: t(`uitleg.${stat}`) },
    h('span', { class: 'bron-label' }, t(`stat.${stat}`)),
    h('strong', {}, waarde),
    h('span', { class: 'bron-sub' }, sub));
  const heatPct = Math.min(100, (r.heat / b.heat_max) * 100);
  return h('section', { class: 'bronnen' },
    tegel('geld', geld(r.geld), t('bron.prognose', { waarde: metTeken(netto, geld) }), netto < 0 ? 'alarm' : ''),
    tegel('invloed', getal(r.invloed), t('bron.max', { max: 100 })),
    tegel('tech', getal(r.tech), t('bron.tech', { pct: getal(Math.round(r.tech * b.tech_inkomen * (1 + (mods.tech_inkomen || 0)) * 100)) })),
    h('div', { class: `bron heat ${r.heat >= b.heat_waarschuwing ? 'alarm' : ''}`, title: t('uitleg.heat') },
      h('span', { class: 'bron-label' }, t('stat.heat')),
      h('strong', {}, `${getal(r.heat)} / ${b.heat_max}`),
      h('span', { class: 'meter' }, h('span', { style: `width:${heatPct}%` }))),
    tegel('personeel', getal(r.personeel), t('bron.nodig', { nodig }), r.personeel < nodig ? 'alarm' : ''),
    tegel('gebouwen', getal(af.gebouwen), t('bron.gebouwen', { vrij })),
    tegel('druk', getal(r.druk), t('bron.druk', { pct: getal(Math.round(r.druk * b.druk_inkomen)) })),
    tegel('stad', `${af.stad}%`, t('bron.stad', { n: af.controle })));
}

function redenTekst(c, data) {
  if (c.ok || c.reden === 'fase') return null;
  if (c.reden === 'kost') return t('actie.reden.kost', { stat: t(`stat.${c.stat}`) });
  return t(`actie.reden.${c.reden}`, { min: data.balans.bouw_min_invloed });
}

function doelRegel(s, data, a, ui, ctl) {
  if (!a.doel) return null;
  const d = s.kaart.districten[ui.geselecteerd];
  const regel = h('p', { class: 'doel' }, t('actie.doel', { naam: d ? d.naam : t('actie.geen_doel') }));
  if (a.soort !== 'bouwen') return regel;
  const g = vind(data.buildings, ui.gebouw);
  return [regel,
    h('label', { class: 'gebouw-keuze' }, h('span', {}, t('actie.gebouw')),
      h('select', { id: 'gebouw-keuze', onchange: (e) => ctl.gebouw(e.target.value) },
        data.buildings.map((def) => h('option', { value: def.id, selected: def.id === ui.gebouw },
          `${def.naam} (${geld(def.kost)})`)))),
    g ? h('p', { class: 'klein' }, g.beschrijving, ' ',
      t('actie.gebouw_info', {
        inkomen: geld(d ? gebouwInkomen(g, d, data.balans) : g.inkomen),
        onderhoud: geld(g.onderhoud), personeel: g.personeel,
      })) : null,
    g?.per_beurt?.length ? h('div', { class: 'chips' }, h('span', { class: 'klein' }, t('creator.per_beurt')), effectChips(g.per_beurt)) : null];
}

function actiePaneel(s, data, mods, ui, ctl) {
  const b = data.balans;
  const pips = Array.from({ length: b.actiepunten }, (_, i) => h('span', { class: `pip${i < s.ap ? ' vol' : ''}` }));
  const laatste = s.laatsteActie;
  return h('section', { class: 'paneel acties' },
    h('div', { class: 'acties-kop' },
      h('h2', {}, t('acties.titel')),
      h('div', { class: 'pips', title: t('acties.ap', { ap: s.ap }) }, pips)),
    laatste ? h('div', { class: 'laatste' },
      h('strong', {}, laatste.titel), ' ',
      laatste.teksten.map((tekst) => h('span', { class: 'laatste-tekst' }, tekst, ' ')),
      h('div', { class: 'chips' }, wijzigingChips(laatste.wijzigingen), districtChips(laatste.districten))) : null,
    h('div', { class: 'actie-lijst' }, data.actions.map((a) => {
      const opties = { district: ui.geselecteerd, gebouw: ui.gebouw };
      const c = controleer(s, data, a, mods, opties);
      const reden = redenTekst(c, data);
      return h('article', { class: `actie${c.ok ? '' : ' uit'}` },
        h('div', { class: 'actie-kop' },
          h('span', { class: 'icoon', 'aria-hidden': 'true' }, a.icoon || '•'),
          h('h3', {}, a.naam),
          h('span', { class: 'kost' }, Object.entries(c.kost).map(([k, v]) =>
            h('span', {}, k === 'geld' ? geld(v) : `${t(`stat.${k}`)} ${getal(v)}`)))),
        h('p', {}, a.beschrijving),
        doelRegel(s, data, a, ui, ctl),
        h('div', { class: 'chips' }, effectChips(a.effecten)),
        h('div', { class: 'actie-voet' },
          reden ? h('span', { class: 'reden' }, reden) : h('span', {}),
          h('button', { type: 'button', class: 'knop', disabled: !c.ok, onclick: () => ctl.actie(a.id) }, t('knop.uitvoeren'))));
    })),
    h('div', { class: 'einde-beurt' },
      s.ap > 0 ? h('span', { class: 'klein' }, t('acties.nog_ap', { ap: s.ap })) : h('span', {}),
      h('button', { type: 'button', class: 'knop primair', disabled: s.fase !== 'acties', onclick: ctl.eindeBeurt }, t('knop.einde_beurt'))));
}

function logPaneel(s) {
  return h('section', { class: 'paneel logboek' },
    h('h2', {}, t('log.titel')),
    s.logboek.length ? h('ol', {}, s.logboek.map((l) => h('li', { class: `log-${l.soort}` },
      h('div', { class: 'log-kop' },
        h('span', { class: 'log-datum' }, datumLabel(l.jaar, l.deel)),
        h('strong', {}, l.soort === 'rapport' ? t('log.rapport', { netto: metTeken(l.netto, geld) }) : l.titel)),
      l.keuze ? h('div', { class: 'log-keuze' }, `› ${l.keuze}`) : null,
      l.teksten?.length ? h('div', { class: 'log-tekst' }, l.teksten.join(' ')) : null,
      h('div', { class: 'chips' },
        wijzigingChips(l.soort === 'rapport'
          ? Object.fromEntries(Object.entries(l.wijzigingen).filter(([k]) => k !== 'geld'))
          : l.wijzigingen),
        districtChips(l.districten)))))
      : h('p', { class: 'klein' }, t('log.leeg')));
}
