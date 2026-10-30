// Corpo-creatie: wizard (plan 2.1), uitgebreid met logo-bouwer en bedrijfsvorm.

import { t } from '../i18n.js';
import { h, geld, getal, modChips, effectChips, fmtStat, voorNadeel } from './dom.js';
import { logoSvg, STANDAARD_LOGO } from './logo.js';
import { berekenMods, bronnen, vind } from '../effects.js';
import { maakStaat } from '../state.js';
import { maakRng, seedNaarGetal } from '../rng.js';
import { kaartCanvas, typeKleur } from './kaart.js';

const STAPPEN = ['identiteit', 'logo', 'vorm', 'oprichter', 'sector', 'cultuur', 'perks', 'overzicht'];
const STAP_PERKS = STAPPEN.indexOf('perks');
const TOON_STATS = ['geld', 'invloed', 'tech', 'heat', 'personeel'];

export function nieuwConcept(data, kaart) {
  const startHq = kaart.districten.find((d) => d.type === 'oude_stad') ?? kaart.districten[0];
  return {
    naam: '',
    slogan: '',
    kleur: '#ff2a6d',
    accent: '#05d9e8',
    logo: { ...STANDAARD_LOGO },
    hq: startHq.id,
    vorm: data.bedrijfsvormen[0].id,
    oprichter: data.archetypes[0].id,
    sector: data.sectors[0].id,
    cultuur: Object.fromEntries(data.culture.map((a) => [a.id, 0])),
    perks: [],
    gebreken: [],
  };
}

// c: het concept uit nieuwConcept(); blijft bewaard als je terug naar de wereld-opties gaat.
export function toonCreator(root, data, kaart, c, { opStart, opTerug }) {
  let stap = 0;
  let voetEl;
  let hqKaart = null;
  let voorbeeldEl;

  const punten = () => data.balans.perkpunten
    + c.gebreken.reduce((a, id) => a + vind(data.flaws, id).punten, 0)
    - c.perks.reduce((a, id) => a + vind(data.perks, id).kost, 0);

  function foutIn(i) {
    if (i === 0 && !c.naam.trim()) return t('creator.fout_naam');
    if (i === STAP_PERKS && !c.gebreken.length) return t('creator.fout_gebrek');
    if (i === STAP_PERKS && punten() < 0) return t('creator.fout_punten');
    return null;
  }
  const eersteFout = (tot) => {
    for (let i = 0; i < tot; i++) if (foutIn(i)) return i;
    return -1;
  };

  function ga(i) {
    const blok = eersteFout(i);
    stap = blok >= 0 ? blok : i;
    render();
    root.querySelector('.creator-inhoud')?.scrollIntoView({ block: 'start' });
  }

  function render() {
    hqKaart = null;
    voorbeeldEl = null;
    root.replaceChildren(h('div', { class: 'creator' },
      h('header', { class: 'creator-kop' },
        h('h1', {}, t('creator.titel')),
        h('ol', { class: 'stappen' }, STAPPEN.map((s, i) => h('li', {},
          h('button', {
            type: 'button',
            class: i === stap ? 'actief' : i < stap ? 'klaar' : '',
            onclick: () => ga(i),
          }, `${i + 1}. ${t(`creator.stap.${s}`)}`))))),
      h('section', { class: 'creator-inhoud' }, RENDER[STAPPEN[stap]]()),
      (voetEl = voet())));
    hqKaart?.();
  }

  // Alleen voorbeeld en voet vernieuwen, zodat een tekstveld zijn focus houdt.
  function ververs() {
    const nieuw = voet();
    voetEl.replaceWith(nieuw);
    voetEl = nieuw;
    if (voorbeeldEl) {
      const v = voorbeeld();
      voorbeeldEl.replaceWith(v);
      voorbeeldEl = v;
    }
  }

  function voet() {
    const fout = foutIn(stap);
    const laatste = stap === STAPPEN.length - 1;
    return h('footer', { class: 'creator-voet' },
      h('button', { type: 'button', class: 'knop', onclick: () => (stap === 0 ? opTerug() : ga(stap - 1)) }, t('knop.terug')),
      h('span', { class: 'fout' }, fout || ''),
      laatste
        ? h('button', { type: 'button', class: 'knop primair', disabled: eersteFout(STAPPEN.length) >= 0, onclick: start }, t('creator.oprichten'))
        : h('button', { type: 'button', class: 'knop primair', disabled: !!fout, onclick: () => ga(stap + 1) }, t('knop.volgende')));
  }

  function start() {
    if (eersteFout(STAPPEN.length) >= 0) return;
    opStart(structuredClone({ ...c, naam: c.naam.trim(), slogan: c.slogan.trim() }));
  }

  // Kleine kaart om het hoofdkwartier aan te klikken.
  function hqKiezer() {
    const [canvas, teken] = kaartCanvas(kaart, {
      kleur: (d) => (d.id === c.hq ? c.kleur : typeKleur(data, d.type)),
      geselecteerd: c.hq,
      hq: c.hq,
      opKlik: (id) => { c.hq = id; render(); },
      label: t('kaart.label'),
    });
    hqKaart = teken;
    return canvas;
  }

  function voorbeeld() {
    return h('div', { class: 'voorbeeld', style: `--corp:${c.kleur};--corp-accent:${c.accent}` },
      logoSvg(c.logo, c.kleur, c.accent, 112),
      h('div', { class: 'voorbeeld-tekst' },
        h('div', { class: 'voorbeeld-naam' }, c.naam.trim() || t('creator.naamloos')),
        h('div', { class: 'voorbeeld-slogan' }, c.slogan.trim() || '…'),
        h('div', { class: 'voorbeeld-klein' }, logoSvg(c.logo, c.kleur, c.accent, 44), logoSvg(c.logo, c.kleur, c.accent, 24))));
  }

  const veld = (label, invoer) => h('label', { class: 'veld' }, h('span', {}, label), invoer);

  function keuzeKaart(gekozen, onclick, ...inhoud) {
    return h('button', { type: 'button', class: `kaart${gekozen ? ' gekozen' : ''}`, 'aria-pressed': String(gekozen), onclick }, ...inhoud);
  }

  // Rij knoppen voor één logo-eigenschap; toon(optie) geeft de inhoud van een knop.
  function optieRij(label, lijst, sleutel, toon = (o) => o.naam) {
    return h('div', { class: 'logo-rij' },
      h('h3', {}, label),
      h('div', { class: 'opties', role: 'group', 'aria-label': label }, lijst.map((o) => {
        const id = o.id ?? o;
        const gekozen = c.logo[sleutel] === id;
        return h('button', {
          type: 'button', class: `optie${gekozen ? ' gekozen' : ''}`, 'aria-pressed': String(gekozen), title: o.naam ?? id,
          onclick: () => { c.logo[sleutel] = id; render(); },
        }, toon(o));
      })));
  }

  function willekeurigLogo() {
    const rng = maakRng({ rng: seedNaarGetal(`${Date.now()}`) });
    const kies = (lijst) => lijst[rng.int(0, lijst.length - 1)];
    const L = data.logos;
    const palet = kies(L.paletten);
    c.kleur = palet.kleur;
    c.accent = palet.accent;
    c.logo = {
      vorm: kies(L.vormen).id, symbool: kies(L.symbolen), monogram: '',
      vulling: kies(L.vullingen).id, rand: kies(L.randen).id, symboolKleur: kies(L.symboolkleuren).id,
      grootte: 'normaal', draaiing: kies([0, 0, 0, 15, 45]),
    };
    render();
  }

  const RENDER = {
    identiteit() {
      voorbeeldEl = voorbeeld();
      return h('div', { class: 'stap-identiteit' },
        h('div', { class: 'velden' },
          veld(t('creator.naam'), h('input', {
            id: 'corp-naam', type: 'text', maxlength: 40, value: c.naam, placeholder: t('creator.naam_voorbeeld'),
            oninput: (e) => { c.naam = e.target.value; ververs(); },
          })),
          veld(t('creator.slogan'), h('input', {
            id: 'corp-slogan', type: 'text', maxlength: 80, value: c.slogan, placeholder: t('creator.slogan_voorbeeld'),
            oninput: (e) => { c.slogan = e.target.value; ververs(); },
          })),
          h('div', { class: 'kleuren' },
            veld(t('creator.kleur'), h('input', { id: 'kleur', type: 'color', value: c.kleur, oninput: (e) => { c.kleur = e.target.value; ververs(); }, onchange: render })),
            veld(t('creator.accent'), h('input', { id: 'accent', type: 'color', value: c.accent, oninput: (e) => { c.accent = e.target.value; ververs(); }, onchange: render }))),
          h('div', { class: 'paletten', role: 'group', 'aria-label': t('creator.paletten') }, data.logos.paletten.map((p) => h('button', {
            type: 'button', class: 'palet', title: p.naam,
            onclick: () => { c.kleur = p.kleur; c.accent = p.accent; render(); },
          }, h('i', { style: `background:${p.kleur}` }), h('i', { style: `background:${p.accent}` }), p.naam))),
          veld(t('creator.hq'), h('select', { id: 'hq', onchange: (e) => { c.hq = Number(e.target.value); render(); } },
            kaart.districten.map((d) => h('option', { value: d.id, selected: d.id === c.hq },
              `${d.naam} (${vind(data.districts.types, d.type)?.naam})`)))),
          h('p', { class: 'hint' }, t('creator.hq_hint', { pct: data.balans.hq_invloed }))),
        h('div', { class: 'identiteit-rechts' }, voorbeeldEl, hqKiezer()));
    },

    logo() {
      voorbeeldEl = voorbeeld();
      const L = data.logos;
      const mini = (wijziging) => logoSvg({ ...c.logo, ...wijziging }, c.kleur, c.accent, 34);
      return h('div', { class: 'stap-logo' },
        h('div', { class: 'logo-links' },
          voorbeeldEl,
          h('button', { type: 'button', class: 'knop', onclick: willekeurigLogo }, t('creator.logo_willekeurig')),
          h('label', { class: 'veld' }, h('span', {}, t('creator.monogram')),
            h('input', {
              id: 'monogram', type: 'text', maxlength: 3, value: c.logo.monogram, placeholder: t('creator.monogram_voorbeeld'),
              oninput: (e) => { c.logo.monogram = e.target.value; ververs(); },
            })),
          h('p', { class: 'hint' }, t('creator.monogram_hint')),
          h('label', { class: 'veld' }, h('span', {}, t('creator.draaiing', { graden: c.logo.draaiing })),
            h('input', {
              id: 'draaiing', type: 'range', min: 0, max: 90, step: 5, value: c.logo.draaiing,
              oninput: (e) => { c.logo.draaiing = Number(e.target.value); ververs(); }, onchange: render,
            }))),
        h('div', { class: 'logo-rechts' },
          optieRij(t('creator.vorm'), L.vormen, 'vorm', (o) => mini({ vorm: o.id })),
          optieRij(t('creator.vulling'), L.vullingen, 'vulling', (o) => [mini({ vulling: o.id }), h('span', {}, o.naam)]),
          optieRij(t('creator.rand'), L.randen, 'rand', (o) => [mini({ rand: o.id }), h('span', {}, o.naam)]),
          h('div', { class: `logo-rij${c.logo.monogram.trim() ? ' gedimd' : ''}` },
            h('h3', {}, t('creator.symbool')),
            h('div', { class: 'symbolen' }, L.symbolen.map((s) => h('button', {
              type: 'button', class: `symbool-knop${c.logo.symbool === s ? ' gekozen' : ''}`, 'aria-pressed': String(c.logo.symbool === s),
              onclick: () => { c.logo.symbool = s; c.logo.monogram = ''; render(); },
            }, s)))),
          optieRij(t('creator.symboolkleur'), L.symboolkleuren, 'symboolKleur'),
          optieRij(t('creator.grootte'), L.groottes, 'grootte')));
    },

    vorm() {
      return h('div', {},
        h('p', { class: 'stap-uitleg' }, t('creator.uitleg.vorm')),
        h('div', { class: 'kaarten' }, data.bedrijfsvormen.map((v) => keuzeKaart(c.vorm === v.id, () => { c.vorm = v.id; render(); },
          h('h3', {}, v.naam),
          h('p', {}, v.beschrijving),
          voorNadeel(v, data)))));
    },

    oprichter() {
      return h('div', {},
        h('p', { class: 'stap-uitleg' }, t('creator.uitleg.oprichter')),
        h('div', { class: 'kaarten' }, data.archetypes.map((a) => keuzeKaart(c.oprichter === a.id, () => { c.oprichter = a.id; render(); },
          h('h3', {}, a.naam),
          h('p', {}, a.beschrijving),
          voorNadeel(a, data)))));
    },

    sector() {
      return h('div', {},
        h('p', { class: 'stap-uitleg' }, t('creator.uitleg.sector')),
        h('div', { class: 'kaarten' }, data.sectors.map((s) => keuzeKaart(c.sector === s.id, () => { c.sector = s.id; render(); },
          h('h3', {}, s.naam),
          h('p', {}, s.beschrijving),
          h('p', { class: 'klein' }, t('creator.basisinkomen', { waarde: geld(s.basisinkomen) })),
          h('p', { class: 'klein' }, t('creator.producten', { lijst: s.producten.join(', ') })),
          voorNadeel(s, data)))));
    },

    cultuur() {
      return h('div', { class: 'assen' }, data.culture.map((as) => {
        const effect = h('div', { class: 'chips' });
        const waarde = h('output', {});
        const toon = () => {
          const v = c.cultuur[as.id];
          waarde.textContent = v > 0 ? `+${v}` : String(v);
          const m = Object.fromEntries(Object.entries(as.per_punt).map(([k, p]) => [k, Math.round(p * v * 1000) / 1000]));
          effect.replaceChildren(...modChips(m, data));
          if (!v) effect.append(h('span', { class: 'chip' }, t('creator.neutraal')));
        };
        toon();
        return h('div', { class: 'as' },
          h('div', { class: 'as-labels' }, h('span', {}, as.links), waarde, h('span', {}, as.rechts)),
          h('input', {
            id: `as-${as.id}`, type: 'range', min: -5, max: 5, step: 1, value: c.cultuur[as.id],
            'aria-label': `${as.links} – ${as.rechts}`,
            oninput: (e) => { c.cultuur[as.id] = Number(e.target.value); toon(); },
          }),
          h('p', { class: 'hint' }, as.uitleg),
          effect);
      }));
    },

    perks() {
      const wissel = (lijst, id) => {
        const i = lijst.indexOf(id);
        if (i >= 0) lijst.splice(i, 1); else lijst.push(id);
        render();
      };
      const p = punten();
      return h('div', { class: 'stap-perks' },
        h('p', { class: `punten${p < 0 ? ' slecht' : ''}` }, t('creator.punten', { punten: p, totaal: data.balans.perkpunten })),
        h('h3', {}, t('creator.perks')),
        h('div', { class: 'kaarten klein' }, data.perks.map((pk) => keuzeKaart(c.perks.includes(pk.id), () => wissel(c.perks, pk.id),
          h('h4', {}, pk.naam, h('span', { class: 'prijs slecht' }, t('creator.kost_pt', { pt: pk.kost }))),
          h('p', {}, pk.beschrijving),
          voorNadeel(pk, data)))),
        h('h3', {}, t('creator.gebreken')),
        h('div', { class: 'kaarten klein' }, data.flaws.map((g) => keuzeKaart(c.gebreken.includes(g.id), () => wissel(c.gebreken, g.id),
          h('h4', {}, g.naam, h('span', { class: 'prijs goed' }, t('creator.geeft_pt', { pt: g.punten }))),
          h('p', {}, g.beschrijving),
          voorNadeel(g, data)))));
    },

    overzicht() {
      voorbeeldEl = voorbeeld();
      const proef = maakStaat(c, data, kaart);
      const mods = berekenMods(c, data);
      const vast = bronnen(c, data).filter((b) => b.per_beurt?.length);
      const naam = (lijst, id) => vind(lijst, id)?.naam;
      return h('div', { class: 'stap-overzicht' },
        voorbeeldEl,
        h('dl', { class: 'samenvatting' },
          h('dt', {}, t('creator.stap.vorm')), h('dd', {}, naam(data.bedrijfsvormen, c.vorm)),
          h('dt', {}, t('creator.stap.oprichter')), h('dd', {}, naam(data.archetypes, c.oprichter)),
          h('dt', {}, t('creator.stap.sector')), h('dd', {}, naam(data.sectors, c.sector)),
          h('dt', {}, t('creator.hq')), h('dd', {}, kaart.districten[c.hq]?.naam),
          h('dt', {}, t('creator.stap.cultuur')), h('dd', {}, data.culture.map((a) => {
            const v = c.cultuur[a.id];
            return h('div', {}, v === 0 ? t('creator.as_neutraal', { links: a.links, rechts: a.rechts })
              : t('creator.as_waarde', { kant: v < 0 ? a.links : a.rechts, waarde: Math.abs(v) }));
          })),
          h('dt', {}, t('creator.perks')), h('dd', {}, c.perks.map((id) => naam(data.perks, id)).join(', ') || '—'),
          h('dt', {}, t('creator.gebreken')), h('dd', {}, c.gebreken.map((id) => naam(data.flaws, id)).join(', ') || '—')),
        h('h3', {}, t('creator.startpositie')),
        h('div', { class: 'startstats' }, TOON_STATS.map((s) => h('div', { class: 'stat' },
          h('span', {}, t(`stat.${s}`)), h('strong', {}, fmtStat(s, proef.res[s]))))),
        h('p', { class: 'klein' }, t('creator.basisinkomen', { waarde: geld(vind(data.sectors, c.sector).basisinkomen) })),
        h('h3', {}, t('creator.totale_mods')),
        Object.keys(mods).length ? voorNadeel({ mods }, data) : h('p', {}, t('creator.geen_mods')),
        vast.length ? [h('h3', {}, t('creator.vaste_posten')), h('div', { class: 'chips' },
          vast.map((b) => [h('span', { class: 'klein' }, `${b.naam}:`), effectChips(b.per_beurt)]))] : null,
        h('h3', {}, t('creator.doel')),
        h('p', {}, data.winconditions.filter((w) => w.actief).map((w) => w.beschrijving).join(' ')),
        h('p', { class: 'klein' }, t('creator.verlies', { heat: getal(data.balans.heat_max), beurten: data.balans.schuld_beurten })));
    },
  };

  render();
}
