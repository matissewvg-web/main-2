// Corpo-creatie: wizard in 6 stappen (plan 2.1).

import { t } from '../i18n.js';
import { h, geld, getal, modChips, effectChips, fmtStat } from './dom.js';
import { logoSvg } from './logo.js';
import { berekenMods, bronnen, vind } from '../effects.js';
import { maakStaat } from '../state.js';
import { willekeurigeSeed } from '../rng.js';

const STAPPEN = ['identiteit', 'oprichter', 'sector', 'cultuur', 'perks', 'overzicht'];
const TOON_STATS = ['geld', 'invloed', 'tech', 'heat', 'personeel'];

export function toonCreator(root, data, { opStart, opTerug }) {
  const c = {
    naam: '',
    slogan: '',
    kleur: '#ff2a6d',
    accent: '#05d9e8',
    logo: { vorm: data.logos.vormen[2].id, symbool: data.logos.symbolen[0] },
    hq: data.districts.types[0].id,
    oprichter: data.archetypes[0].id,
    sector: data.sectors[0].id,
    cultuur: Object.fromEntries(data.culture.map((a) => [a.id, 0])),
    perks: [],
    gebreken: [],
  };
  let stap = 0;
  let seed = '';
  let voetEl;
  let voorbeeldEl;

  const punten = () => data.balans.perkpunten
    + c.gebreken.reduce((a, id) => a + vind(data.flaws, id).punten, 0)
    - c.perks.reduce((a, id) => a + vind(data.perks, id).kost, 0);

  function foutIn(i) {
    if (i === 0 && !c.naam.trim()) return t('creator.fout_naam');
    if (i === 4 && !c.gebreken.length) return t('creator.fout_gebrek');
    if (i === 4 && punten() < 0) return t('creator.fout_punten');
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
  }

  function render() {
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
  }

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
      h('button', { type: 'button', class: 'knop', onclick: () => (stap === 0 ? opTerug() : ga(stap - 1)) },
        stap === 0 ? t('knop.menu') : t('knop.terug')),
      h('span', { class: 'fout' }, fout || ''),
      laatste
        ? h('button', { type: 'button', class: 'knop primair', disabled: eersteFout(STAPPEN.length) >= 0, onclick: start }, t('creator.oprichten'))
        : h('button', { type: 'button', class: 'knop primair', disabled: !!fout, onclick: () => ga(stap + 1) }, t('knop.volgende')));
  }

  function start() {
    if (eersteFout(STAPPEN.length) >= 0) return;
    opStart(structuredClone({ ...c, naam: c.naam.trim(), slogan: c.slogan.trim() }), seed.trim() || willekeurigeSeed());
  }

  function voorbeeld() {
    return h('div', { class: 'voorbeeld', style: `--corp:${c.kleur};--corp-accent:${c.accent}` },
      logoSvg(c.logo, c.kleur, c.accent, 96),
      h('div', {},
        h('div', { class: 'voorbeeld-naam' }, c.naam.trim() || t('creator.naamloos')),
        h('div', { class: 'voorbeeld-slogan' }, c.slogan.trim() || '…')));
  }

  function veld(label, invoer) {
    return h('label', { class: 'veld' }, h('span', {}, label), invoer);
  }

  function kaart(gekozen, onclick, ...inhoud) {
    return h('button', { type: 'button', class: `kaart${gekozen ? ' gekozen' : ''}`, 'aria-pressed': String(gekozen), onclick }, ...inhoud);
  }

  const RENDER = {
    identiteit() {
      voorbeeldEl = voorbeeld();
      return h('div', { class: 'stap-identiteit' },
        h('div', { class: 'velden' },
          veld(t('creator.naam'), h('input', {
            type: 'text', maxlength: 40, value: c.naam, placeholder: t('creator.naam_voorbeeld'),
            oninput: (e) => { c.naam = e.target.value; ververs(); },
          })),
          veld(t('creator.slogan'), h('input', {
            type: 'text', maxlength: 80, value: c.slogan, placeholder: t('creator.slogan_voorbeeld'),
            oninput: (e) => { c.slogan = e.target.value; ververs(); },
          })),
          h('div', { class: 'kleuren' },
            veld(t('creator.kleur'), h('input', { type: 'color', value: c.kleur, oninput: (e) => { c.kleur = e.target.value; ververs(); } })),
            veld(t('creator.accent'), h('input', { type: 'color', value: c.accent, oninput: (e) => { c.accent = e.target.value; ververs(); } }))),
          veld(t('creator.hq'), h('select', { onchange: (e) => { c.hq = e.target.value; } },
            data.districts.types.map((d) => h('option', { value: d.id, selected: d.id === c.hq }, d.naam)))),
          h('p', { class: 'hint' }, t('creator.hq_hint'))),
        h('div', { class: 'logo-kiezer' },
          voorbeeldEl,
          h('h3', {}, t('creator.vorm')),
          h('div', { class: 'vormen' }, data.logos.vormen.map((v) => h('button', {
            type: 'button', title: v.naam, class: `logo-knop${c.logo.vorm === v.id ? ' gekozen' : ''}`,
            onclick: () => { c.logo.vorm = v.id; render(); },
          }, logoSvg({ vorm: v.id, symbool: '' }, c.kleur, c.accent, 36)))),
          h('h3', {}, t('creator.symbool')),
          h('div', { class: 'symbolen' }, data.logos.symbolen.map((s) => h('button', {
            type: 'button', class: `symbool-knop${c.logo.symbool === s ? ' gekozen' : ''}`,
            onclick: () => { c.logo.symbool = s; render(); },
          }, s)))));
    },

    oprichter() {
      voorbeeldEl = null;
      return h('div', { class: 'kaarten' }, data.archetypes.map((a) => kaart(c.oprichter === a.id, () => { c.oprichter = a.id; render(); },
        h('h3', {}, a.naam),
        h('p', {}, a.beschrijving),
        h('div', { class: 'chips' }, effectChips(a.start), modChips(a.mods, data)))));
    },

    sector() {
      voorbeeldEl = null;
      return h('div', { class: 'kaarten' }, data.sectors.map((s) => kaart(c.sector === s.id, () => { c.sector = s.id; render(); },
        h('h3', {}, s.naam),
        h('p', {}, s.beschrijving),
        h('p', { class: 'klein' }, t('creator.basisinkomen', { waarde: geld(s.basisinkomen) })),
        h('p', { class: 'klein' }, t('creator.producten', { lijst: s.producten.join(', ') })),
        h('div', { class: 'chips' }, effectChips(s.start), modChips(s.mods, data)))));
    },

    cultuur() {
      voorbeeldEl = null;
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
            type: 'range', min: -5, max: 5, step: 1, value: c.cultuur[as.id],
            'aria-label': `${as.links} – ${as.rechts}`,
            oninput: (e) => { c.cultuur[as.id] = Number(e.target.value); toon(); },
          }),
          h('p', { class: 'hint' }, as.uitleg),
          effect);
      }));
    },

    perks() {
      voorbeeldEl = null;
      const wissel = (lijst, id) => {
        const i = lijst.indexOf(id);
        if (i >= 0) lijst.splice(i, 1); else lijst.push(id);
        render();
      };
      const p = punten();
      return h('div', { class: 'stap-perks' },
        h('p', { class: `punten${p < 0 ? ' slecht' : ''}` }, t('creator.punten', { punten: p, totaal: data.balans.perkpunten })),
        h('h3', {}, t('creator.perks')),
        h('div', { class: 'kaarten klein' }, data.perks.map((pk) => kaart(c.perks.includes(pk.id), () => wissel(c.perks, pk.id),
          h('h4', {}, pk.naam, h('span', { class: 'prijs slecht' }, t('creator.kost_pt', { pt: pk.kost }))),
          h('p', {}, pk.beschrijving),
          h('div', { class: 'chips' }, effectChips(pk.start), modChips(pk.mods, data))))),
        h('h3', {}, t('creator.gebreken')),
        h('div', { class: 'kaarten klein' }, data.flaws.map((g) => kaart(c.gebreken.includes(g.id), () => wissel(c.gebreken, g.id),
          h('h4', {}, g.naam, h('span', { class: 'prijs goed' }, t('creator.geeft_pt', { pt: g.punten }))),
          h('p', {}, g.beschrijving),
          h('div', { class: 'chips' }, effectChips(g.start),
            g.per_beurt?.length ? [t('creator.per_beurt'), effectChips(g.per_beurt)] : null,
            modChips(g.mods, data))))));
    },

    overzicht() {
      voorbeeldEl = voorbeeld();
      const proef = maakStaat(c, data, 'voorbeeld');
      const mods = berekenMods(c, data);
      const vast = bronnen(c, data).filter((b) => b.per_beurt?.length);
      const naam = (lijst, id) => vind(lijst, id)?.naam;
      return h('div', { class: 'stap-overzicht' },
        voorbeeldEl,
        h('dl', { class: 'samenvatting' },
          h('dt', {}, t('creator.stap.oprichter')), h('dd', {}, naam(data.archetypes, c.oprichter)),
          h('dt', {}, t('creator.stap.sector')), h('dd', {}, naam(data.sectors, c.sector)),
          h('dt', {}, t('creator.hq')), h('dd', {}, naam(data.districts.types, c.hq)),
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
        h('div', { class: 'chips' }, Object.keys(mods).length ? modChips(mods, data) : t('creator.geen_mods')),
        vast.length ? [h('h3', {}, t('creator.vaste_posten')), h('div', { class: 'chips' },
          vast.map((b) => [h('span', { class: 'klein' }, `${b.naam}:`), effectChips(b.per_beurt)]))] : null,
        h('h3', {}, t('creator.doel')),
        h('p', {}, data.winconditions.filter((w) => w.actief).map((w) => w.beschrijving).join(' ')),
        h('p', { class: 'klein' }, t('creator.verlies', { heat: getal(data.balans.heat_max), beurten: data.balans.schuld_beurten })),
        veld(t('creator.seed'), h('input', {
          type: 'text', maxlength: 32, value: seed, placeholder: t('creator.seed_leeg'),
          oninput: (e) => { seed = e.target.value; },
        })));
    },
  };

  render();
}
