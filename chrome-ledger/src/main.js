// Opstart en schermwissel: menu → wereld-opties → corpo-creatie → spel.

import { laadData } from './data.js';
import { zetTaal, t } from './i18n.js';
import { staat, zetStaat, maakStaat } from './state.js';
import { voerUit } from './actions.js';
import { eindigBeurt, kiesKeuze, sluitEvent } from './turn.js';
import { willekeurigeSeed } from './rng.js';
import * as save from './save.js';
import { toonMenu } from './ui/menu.js';
import { toonWereld } from './ui/wereld.js';
import { toonCreator, nieuwConcept } from './ui/creator.js';
import { toonSpel } from './ui/hud.js';
import { aanvaard, weiger } from './opdrachten.js';

const root = document.getElementById('app');
let data;
// Schermkeuzes die niet in de save horen: geselecteerd district, kaartlaag, gekozen gebouwen.
const ui = { geselecteerd: null, laag: 'eigenaar', gebouw: null, verkoop: null };

function naarMenu(fout = null) {
  const { state: bewaard, fout: saveFout } = save.probeer();
  toonMenu(root, {
    save: bewaard,
    fout: fout ?? (saveFout?.versie ? t('menu.fout_versie') : null),
    opNieuw: nieuwSpel,
    opVerder: () => {
      const s = save.laad();
      if (!s) return naarMenu(t('menu.fout_laden'));
      speel(s);
    },
    opImport: async (bestand) => {
      try {
        const s = await save.importeer(bestand);
        speel(s);
        save.bewaar(s);
      } catch (e) {
        naarMenu(e.versie ? t('menu.fout_versie') : t('menu.fout_import', { fout: e.message }));
      }
    },
  });
}

function nieuwSpel() {
  const wereld = { seed: willekeurigeSeed(), grootte: 12, kaart: null, toon: 'alle', moeilijkheid: 'normaal' };
  // Het corpo-concept blijft bewaard als je terug naar de wereld gaat; bij een
  // andere kaart kiest het opnieuw een standaard-HQ.
  let concept = null;
  let conceptKaart = null;
  const naarWereld = () => toonWereld(root, data, wereld, {
    opTerug: () => naarMenu(),
    opVerder: naarCreator,
  });
  const naarCreator = () => {
    if (!concept) concept = nieuwConcept(data, wereld.kaart);
    else if (conceptKaart !== wereld.kaart) concept.hq = nieuwConcept(data, wereld.kaart).hq;
    conceptKaart = wereld.kaart;
    toonCreator(root, data, wereld.kaart, concept, {
      opTerug: naarWereld,
      opStart: (corp) => {
        speel(maakStaat(corp, data, wereld.kaart, wereld));
        save.bewaar(staat());
      },
    });
  };
  naarWereld();
}

function speel(s) {
  zetStaat(s);
  ui.geselecteerd = s.corp.hq;
  ui.gebouw ??= data.buildings[0].id;
  render();
}

function render() {
  // Het te verkopen gebouw volgt het geselecteerde district.
  const d = staat().kaart.districten[ui.geselecteerd];
  if (!d?.gebouwen.some((g) => g.type === ui.verkoop)) ui.verkoop = d?.gebouwen[0]?.type ?? null;
  toonSpel(root, data, staat(), ui, ctl);
}

function na() {
  save.bewaar(staat());
  render();
}

const ctl = {
  actie: (id) => {
    const gebouw = id === 'verkopen' ? ui.verkoop : ui.gebouw;
    if (voerUit(staat(), data, id, { district: ui.geselecteerd, gebouw })) na();
  },
  eindeBeurt: () => { eindigBeurt(staat(), data); na(); },
  kies: (i) => { kiesKeuze(staat(), data, i); na(); },
  verder: () => { sluitEvent(staat(), data); na(); },
  selecteer: (id) => { ui.geselecteerd = id; render(); },
  laag: (l) => { ui.laag = l; render(); },
  gebouw: (id) => { ui.gebouw = id; render(); },
  verkoop: (id) => { ui.verkoop = id; render(); },
  aanvaard: (i) => { if (aanvaard(staat(), data, i)) na(); },
  weiger: (i) => { weiger(staat(), i); na(); },
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
