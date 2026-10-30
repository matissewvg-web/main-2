// Wereld-opties bij een nieuw spel (plan 2.2):
// seed, kaartgrootte, wereldtoon, moeilijkheid en districtnamen.

import { t } from '../i18n.js';
import { h, voorNadeel } from './dom.js';
import { kaartCanvas, typeKleur } from './kaart.js';
import { genereerKaart } from '../map.js';
import { willekeurigeSeed } from '../rng.js';
import { vind } from '../effects.js';

const GROOTTES = [8, 12, 16];
const TONEN = ['alle', 'grimmig', 'satirisch', 'serieus'];

// w: { seed, grootte, kaart, toon, moeilijkheid } — wordt bijgewerkt en blijft bewaard als je terugkeert.
export function toonWereld(root, data, w, { opVerder, opTerug }) {
  if (!w.kaart) w.kaart = genereerKaart(w.seed, w.grootte, data);
  let geselecteerd = null;
  const typeNaam = (d) => vind(data.districts.types, d.type)?.naam;

  function nieuw() {
    w.kaart = genereerKaart(w.seed, w.grootte, data);
    geselecteerd = null;
    render();
  }

  const canvasMaken = () => kaartCanvas(w.kaart, {
    kleur: (d) => typeKleur(data, d.type),
    geselecteerd,
    opKlik: kies,
    label: t('kaart.label'),
  });

  // Klik op de kaart: naamveld van dat district krijgt focus.
  function kies(id) {
    geselecteerd = id;
    render();
    document.getElementById(`naam-${id}`)?.focus();
  }

  // Alleen de kaart hertekenen, zodat de focus in een naamveld blijft staan.
  function markeer(id) {
    geselecteerd = id;
    const [canvas, teken] = canvasMaken();
    root.querySelector('.kaart-canvas').replaceWith(canvas);
    root.querySelectorAll('.namen li').forEach((li, i) => li.classList.toggle('gekozen', i === id));
    teken();
  }

  function render() {
    const [canvas, teken] = canvasMaken();
    root.replaceChildren(h('div', { class: 'creator wereld' },
      h('header', { class: 'creator-kop' },
        h('h1', {}, t('wereld.titel')),
        h('p', { class: 'klein' }, t('wereld.uitleg'))),
      h('section', { class: 'creator-inhoud wereld-inhoud' },
        h('div', { class: 'wereld-kaart' },
          h('div', { class: 'wereld-opties' },
            h('label', { class: 'veld', for: 'seed' }, h('span', {}, t('wereld.seed')),
              h('input', {
                id: 'seed', type: 'text', maxlength: 32, value: w.seed,
                onchange: (e) => { w.seed = e.target.value.trim() || willekeurigeSeed(); nieuw(); },
              })),
            h('button', { type: 'button', class: 'knop', onclick: () => { w.seed = willekeurigeSeed(); nieuw(); } }, t('wereld.seed_nieuw')),
            h('div', { class: 'veld' }, h('span', {}, t('wereld.grootte')),
              h('div', { class: 'segment', role: 'group', 'aria-label': t('wereld.grootte') }, GROOTTES.map((n) => h('button', {
                type: 'button', class: `knop${w.grootte === n ? ' actief' : ''}`, 'aria-pressed': String(w.grootte === n),
                onclick: () => { w.grootte = n; nieuw(); },
              }, String(n)))))),
          canvas),
        h('div', { class: 'wereld-instellingen' },
          h('div', { class: 'veld' }, h('span', {}, t('wereld.toon')),
            h('div', { class: 'segment', role: 'group', 'aria-label': t('wereld.toon') }, TONEN.map((tn) => h('button', {
              type: 'button', class: `knop${w.toon === tn ? ' actief' : ''}`, 'aria-pressed': String(w.toon === tn),
              onclick: () => { w.toon = tn; render(); },
            }, t(`toon.${tn}`)))),
            h('p', { class: 'hint' }, t('wereld.toon_hint'))),
          h('h3', {}, t('wereld.moeilijkheid')),
          h('div', { class: 'kaarten klein' }, data.moeilijkheid.map((m) => h('button', {
            type: 'button', class: `kaart${w.moeilijkheid === m.id ? ' gekozen' : ''}`, 'aria-pressed': String(w.moeilijkheid === m.id),
            onclick: () => { w.moeilijkheid = m.id; render(); },
          }, h('h4', {}, m.naam), h('p', {}, m.beschrijving), voorNadeel(m, data))))),
        h('div', { class: 'namen' },
          h('h3', {}, t('wereld.namen')),
          h('p', { class: 'hint' }, t('wereld.namen_hint')),
          h('ol', {}, w.kaart.districten.map((d) => h('li', { class: geselecteerd === d.id ? 'gekozen' : '' },
            h('span', { class: 'type-label', style: `--type:${typeKleur(data, d.type)}` }, typeNaam(d)),
            h('input', {
              id: `naam-${d.id}`, type: 'text', maxlength: 28, value: d.naam,
              'aria-label': t('wereld.naam_van', { type: typeNaam(d) }),
              onfocus: () => { if (geselecteerd !== d.id) markeer(d.id); },
              onchange: (e) => {
                d.naam = e.target.value.trim() || d.naam;
                e.target.value = d.naam;
                markeer(d.id);
              },
            })))))),
      h('footer', { class: 'creator-voet' },
        h('button', { type: 'button', class: 'knop', onclick: opTerug }, t('knop.menu')),
        h('span', {}),
        h('button', { type: 'button', class: 'knop primair', onclick: opVerder }, t('knop.volgende')))));
    teken();
  }

  render();
}
