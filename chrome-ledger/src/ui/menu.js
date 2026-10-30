// Hoofdmenu: nieuw spel, verder spelen, save importeren.

import { t } from '../i18n.js';
import { h, datumLabel } from './dom.js';
import { logoSvg } from './logo.js';

export function toonMenu(root, { save, fout, opNieuw, opVerder, opImport }) {
  const bestand = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true,
    onchange: (e) => e.target.files[0] && opImport(e.target.files[0]),
  });
  root.replaceChildren(h('div', { class: 'menu' },
    h('h1', { class: 'titel' }, 'CHROME', h('span', {}, 'LEDGER')),
    h('p', { class: 'ondertitel' }, t('menu.ondertitel')),
    h('div', { class: 'menu-knoppen' },
      save ? h('button', { type: 'button', class: 'knop primair groot', onclick: opVerder },
        logoSvg(save.corp.logo, save.corp.kleur, save.corp.accent, 28),
        t('menu.verder', { naam: save.corp.naam, datum: datumLabel(save.jaar, save.deel) })) : null,
      h('button', { type: 'button', class: `knop groot${save ? '' : ' primair'}`, onclick: opNieuw }, t('menu.nieuw')),
      h('button', { type: 'button', class: 'knop groot', onclick: () => bestand.click() }, t('menu.importeer')),
      bestand),
    save ? h('p', { class: 'klein' }, t('menu.overschrijft')) : null,
    fout ? h('p', { class: 'fout' }, fout) : null));
}
