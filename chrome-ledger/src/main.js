// Opstart en schermwissel.

import { laadData } from './data.js';
import { zetTaal, t } from './i18n.js';
import { staat, zetStaat, maakStaat } from './state.js';
import { voerUit } from './actions.js';
import { eindigBeurt, kiesKeuze, sluitEvent } from './turn.js';
import * as save from './save.js';
import { toonMenu } from './ui/menu.js';
import { toonCreator } from './ui/creator.js';
import { toonSpel } from './ui/hud.js';

const root = document.getElementById('app');
let data;

function naarMenu(fout = null) {
  toonMenu(root, {
    save: save.laad(),
    fout,
    opNieuw: nieuwSpel,
    opVerder: () => {
      const s = save.laad();
      if (!s) return naarMenu(t('menu.fout_laden'));
      zetStaat(s);
      render();
    },
    opImport: async (bestand) => {
      try {
        zetStaat(await save.importeer(bestand));
        save.bewaar(staat());
        render();
      } catch (e) {
        naarMenu(t('menu.fout_import', { fout: e.message }));
      }
    },
  });
}

function nieuwSpel() {
  toonCreator(root, data, {
    opTerug: () => naarMenu(),
    opStart: (corp, seed) => {
      zetStaat(maakStaat(corp, data, seed));
      na();
    },
  });
}

function render() {
  toonSpel(root, data, staat(), ctl);
}

function na() {
  save.bewaar(staat());
  render();
}

const ctl = {
  actie: (id) => { if (voerUit(staat(), data, id)) na(); },
  eindeBeurt: () => { eindigBeurt(staat(), data); na(); },
  kies: (i) => { kiesKeuze(staat(), data, i); na(); },
  verder: () => { sluitEvent(staat(), data); na(); },
  exporteer: () => save.exporteer(staat()),
  menu: () => naarMenu(),
  nieuw: nieuwSpel,
};

try {
  data = await laadData();
  zetTaal(data.i18n);
  document.title = t('app.titel');
  naarMenu();
} catch (e) {
  console.error(e);
  root.replaceChildren(Object.assign(document.createElement('pre'), {
    className: 'fout',
    textContent: `Chrome Ledger kon de speldata niet laden.\n${e.message}`,
  }));
}
