// Frontlinie: de app. Eén state per campagne, alles in localStorage, hot-seat op één toestel.
import { KAARTEN, TERREINEN, INFRA, VERSTERKING } from './kaarten.js';
import { CAMPAGNES, FACTIES, PERIODES, ZIJDEN, EENHEDEN, campagneVan } from './campagnes.js';
import { DOCTRINES, doctrineVan, doctrinesVoor } from './doctrines.js';
import { nieuweSeed } from './rng.js';
import { RULESETS, SCENARIOTYPES, genereerScenario } from './scenario.js';
import { genereerTafel, tafelSvg, STUKKEN, STANDAARD_VOORRAAD, STANDAARD_TAFEL } from './tafel.js';
import { kaartInfo, kaartVan, nieuweCampagne, losBezitOp, datumVan, grondVan, GRONDNAAM, LENGTES, factie, zijdeVan, regiosVan, heeftDoc, limieten, beschikbareOrders, orderDoelen, telling, voegOrderToe, verwijderOrder, ORDERTYPES, voorspel, zietVersterking, effectieveFort, actieveFacties, klimaatVan, planVolgorde, volgendePlanner, bekendeAanvallen, onthul, vervangOrder, startGevechten, tafelVan, voerUitslagIn, bonusDoelen, bonusAanval, herrolTerrein, kiesTweedeDoctrine, wisselDoctrine, stand, kanBeurtEindigen, eindeBeurt, veteraanBonus } from './engine.js';
import { kaartSvg, esc, ORDERCODE } from './ui-kaart.js';
import { scenarioBlad } from './ui-blad.js';

const SLEUTEL = 'frontlinie.v1';
const INGEBED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const opslag = { campagnes: {}, voorraad: Object.assign({}, STANDAARD_VOORRAAD), tafel: Object.assign({}, STANDAARD_TAFEL) };
let opslagWerkt = true;
function laad() { try { const t = localStorage.getItem(SLEUTEL); if (t) Object.assign(opslag, JSON.parse(t)); } catch (e) { opslagWerkt = false; } }
function bewaar() { try { localStorage.setItem(SLEUTEL, JSON.stringify(opslag)); } catch (e) { opslagWerkt = false; } }

const ui = { scherm: 'start', cid: null, tab: 'beurt', sel: null, plannend: null, orderType: null, orderVan: null, auftrag: null, gevecht: null, zoom: 1, melding: '', bevestig: null, undo: null, nieuw: null, los: null, uitslag: null, exportTekst: '', galerij: 'europa' };
const C = () => opslag.campagnes[ui.cid];
let wortel = null;

function muteer(fn) { ui.undo = JSON.stringify(C()); const r = fn(C()); bewaar(); return r; }
const knop = (a, tekst, extra = '', kl = '') => `<button type="button" class="knop ${kl}" data-a="${a}" ${extra}>${tekst}</button>`;
const chip = (t, kl = '') => `<span class="chip ${kl}">${t}</span>`;
const stip = (kleur) => `<span class="stip" style="background:${kleur}"></span>`;
const facNaam = (s, id) => { const f = factie(s, id); return f ? `${stip(f.kleur)}${esc(f.naam)}` : `${stip(FACTIES.neutraal.kleur)}Neutraal`; };
const docNamen = (f) => f.doctrines.map((d) => doctrineVan(d).naam).join(' + ');

// ═════════ kop ═════════
function kop() {
  const s = ui.scherm !== 'start' && ui.scherm !== 'nieuw' && ui.scherm !== 'los' ? C() : null;
  let midden = '';
  if (s) {
    const d = datumVan(s), info = kaartVan(s), g = grondVan(info.klimaat, d.maand);
    midden = `<div class="kopinfo"><b>${esc(s.naam)}</b>${chip(`Beurt ${s.beurt} van ${s.maxBeurten}`)}${chip(esc(d.label))}${info.geo ? '' : chip(GRONDNAAM[g], g === 'normaal' ? '' : 'let')}${chip(PERIODES[s.periode].naam)}</div>`;
  }
  return `<header class="kop geen-print"><button type="button" class="merk" data-a="naarStart">FRONTLINIE</button>${midden}<div class="kopknoppen">${s && ui.undo ? knop('undo', 'Ongedaan maken') : ''}${ui.scherm !== 'start' ? knop('naarStart', 'Campagnes') : ''}</div></header>`;
}

// ═════════ start ═════════
function pseudo(sc, bezit, facties) {
  const b = bezit || losBezitOp(sc), regios = {};
  for (const [id, e] of Object.entries(b)) regios[id] = { eigenaar: e, fort: undefined };
  const fs = (facties || sc.facties.map((f) => f.id)).map((id) => { const basis = sc.facties.find((x) => x.id === id) || {}; return { id, kleur: FACTIES[id].kleur, zijde: basis.zijde || FACTIES[id].zijde, hoofdstad: basis.hoofdstad || null }; });
  return { kaart: sc.kaart, subset: sc.subset || null, regios, facties: fs, doel: sc.doel || null };
}
function startScherm() {
  const opgeslagen = Object.values(opslag.campagnes).sort((a, b) => b.gemaakt - a.gemaakt);
  const lijst = opgeslagen.map((s) => {
    const sc = campagneVan(s.scenarioId), d = datumVan(s);
    const weg = ui.bevestig === 'wis:' + s.id;
    return `<li class="rij"><div><b>${esc(s.naam)}</b><p class="stil">${esc(sc.naam)} · ${RULESETS[s.ruleset].naam}, ${s.punten} punten · ${s.fase === 'einde' ? 'afgelopen' : `beurt ${s.beurt} van ${s.maxBeurten}, ${esc(d.label)}`}</p></div>
      <div class="knoppen">${weg ? `${knop('wisJa', 'Ja, verwijder', `data-id="${s.id}"`, 'gevaar')}${knop('annuleer', 'Nee')}` : `${knop('open', 'Verder spelen', `data-id="${s.id}"`, 'hoofd')}${knop('exporteer', 'Exporteer', `data-id="${s.id}"`)}${knop('wis', 'Verwijder', `data-id="${s.id}"`)}`}</div></li>`;
  }).join('');
  const tabs = [['europa', 'Heel Europa'], ['early', 'Operaties 1939–41'], ['mid', 'Operaties 1942–43'], ['late', 'Operaties 1944–45']];
  const zichtbaar = CAMPAGNES.filter((c) => (ui.galerij === 'europa' ? c.europa : !c.europa && c.periode === ui.galerij));
  const kaarten = zichtbaar.map((sc) => `<li class="scn"><button type="button" class="scnknop" data-a="kies" data-id="${sc.id}">
      <div class="minikaart">${kaartSvg(pseudo(sc), { klein: true })}</div>
      <div class="scntekst"><p class="oog">${esc(sc.ondertitel)}</p><h3>${esc(sc.naam)}</h3><p>${esc(sc.tekst)}</p>
      <p class="chips">${sc.facties.filter((f) => f.speler !== 'passief').map((f) => `<span class="chip">${stip(FACTIES[f.id].kleur)}${FACTIES[f.id].kort}</span>`).join('')}${chip(`${sc.doel ? sc.doel.voor : sc.maxBeurten} beurten`)}${chip(`1 beurt = 1 ${LENGTES[sc.lengte]}`)}</p></div></button></li>`).join('');
  return `<main class="start">
  <section class="intro"><div><h1>Je campagne op de kaart, je gevecht op tafel.</h1>
    <p>Elk land kiest per beurt welke regio het aanvalt. Frontlinie maakt van elk gevecht een scenario met objective, briefing en tafelmap, opgebouwd uit het terrein dat je echt hebt. Jullie spelen het uit met Flames of War of Battlegroup en voeren de uitslag in. Beide kanten spelen altijd met dezelfde punten.</p>
    <div class="knoppen">${knop('naarLos', 'Los scenario genereren', '', 'hoofd')}</div></div>
    <ol class="lus"><li><b>Orders.</b> Elk land kiest verborgen wat het aanvalt, versterkt of verkent.</li><li><b>Conflicten.</b> Wie valt wie aan, en wie verdedigt.</li><li><b>Scenario.</b> Objective, opstelling, weer en tafelmap uit de doelregio.</li><li><b>Gevecht.</b> Op tafel, met gelijke punten.</li><li><b>Uitslag.</b> De regio wisselt van eigenaar, met gevolgen.</li></ol></section>
  ${opgeslagen.length ? `<section><h2>Jouw campagnes</h2><ul class="rijen">${lijst}</ul></section>` : ''}
  ${ui.exportTekst ? exportVak() : ''}
  <section><h2>Nieuwe campagne</h2>
    <div class="tabs" role="tablist">${tabs.map(([id, n]) => `<button type="button" role="tab" aria-selected="${ui.galerij === id}" class="tab${ui.galerij === id ? ' aan' : ''}" data-a="galerij" data-id="${id}">${n}</button>`).join('')}</div>
    ${ui.galerij !== 'europa' ? `<p class="stil">${PERIODES[ui.galerij].naam}. ${PERIODES[ui.galerij].sfeer} Een afgebakende operatie op een eigen kaart.</p>` : '<p class="stil">De hele kaart van Europa met alle landen. Kies een startdatum, verdeel de landen over de spelers en speel. Landen zonder speler verdedigen alleen.</p>'}
    <ul class="galerij">${kaarten}</ul></section>
  <section class="import"><h2>Campagne importeren</h2><p class="stil">Plak hier een geëxporteerde campagne om verder te spelen op dit toestel.</p>
    <textarea id="importveld" rows="3" placeholder='{"v":1, ...}' aria-label="Geëxporteerde campagne"></textarea><div class="knoppen">${knop('importeer', 'Importeer')}</div>${ui.melding ? `<p class="fout">${esc(ui.melding)}</p>` : ''}
    ${opslagWerkt ? '' : '<p class="fout">Dit toestel bewaart niets (privévenster of geblokkeerde opslag). Exporteer je campagne voor je afsluit.</p>'}</section>
</main>`;
}
function exportVak() {
  return `<section class="export"><h2>Export</h2><p class="stil">Kopieer deze tekst en bewaar hem, of plak hem op een ander toestel bij Importeren.</p><textarea id="exportveld" rows="4" readonly aria-label="Export">${esc(ui.exportTekst)}</textarea>
  <div class="knoppen">${knop('kopieerExport', 'Kopieer')}${INGEBED ? '' : knop('downloadExport', 'Download bestand')}${knop('sluitExport', 'Sluiten')}</div></section>`;
}

// ═════════ nieuwe campagne ═════════
function beginNieuw(id) {
  const sc = campagneVan(id), rs = 'fow';
  ui.nieuw = { scenarioId: id, naam: sc.naam, ruleset: rs, punten: RULESETS[rs].punten, modus: 'simultaan', mist: true, doorlopend: !!sc.europa, lengte: sc.lengte, maxBeurten: sc.maxBeurten, geenDoel: false,
    bezit: losBezitOp(sc), verf: sc.facties[0].id,
    facties: sc.facties.map((b) => ({ id: b.id, zijde: b.zijde || FACTIES[b.id].zijde, speler: b.speler === 'passief' ? 'passief' : 'mens', wie: -1, doctrine: b.doctrine || FACTIES[b.id].doctrine || doctrinesVoor(b.id, sc.periode)[0].id })) };
  // standaard: één speler per zijde
  const n = ui.nieuw, zijden = [...new Set(n.facties.filter((f) => f.speler === 'mens').map((f) => f.zijde))];
  n.spelers = zijden.map((_, i) => 'Speler ' + (i + 1));
  for (const f of n.facties) if (f.speler === 'mens') f.wie = zijden.indexOf(f.zijde);
  ui.scherm = 'nieuw';
}
function nieuwScherm() {
  const n = ui.nieuw, sc = campagneVan(n.scenarioId);
  const ps = pseudo(sc, n.bezit, n.facties.map((f) => f.id));
  for (const f of ps.facties) f.zijde = n.facties.find((x) => x.id === f.id).zijde;
  const rij = (f, i) => {
    const docs = doctrinesVoor(f.id, sc.periode), d = docs.find((x) => x.id === f.doctrine) || docs[0], F = FACTIES[f.id];
    const telt = Object.values(n.bezit).filter((e) => e === f.id).length;
    return `<li class="facrij"><div class="fackop"><span>${stip(F.kleur)}<b>${esc(F.naam)}</b></span><span class="stil">${telt} regio's</span></div>
      <div class="facvelden">
        <label>Bestuurd door<select id="sp-${f.id}" data-c="nf" data-i="${i}" data-veld="wie" data-num="1"><option value="-1" ${f.wie < 0 ? 'selected' : ''}>Niemand</option>${n.spelers.map((sp, k) => `<option value="${k}" ${f.wie === k ? 'selected' : ''}>${esc(sp)}</option>`).join('')}</select></label>
        ${sc.sandbox ? `<label>Zijde<select id="zij-${f.id}" data-c="nf" data-i="${i}" data-veld="zijde">${Object.entries(ZIJDEN).map(([z, zn]) => `<option value="${z}" ${f.zijde === z ? 'selected' : ''}>${zn}</option>`).join('')}</select></label>` : ''}
        <label>Doctrine<select id="doc-${f.id}" data-c="nf" data-i="${i}" data-veld="doctrine">${docs.map((x) => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(x.naam)}</option>`).join('')}</select></label></div>
      <p class="doctekst"><b>Kaart:</b> ${esc(d.strat)} <b>Gevecht:</b> ${esc(d.gevecht)} <b>Nadeel:</b> ${esc(d.nadeel)}</p>
      <p class="doctekst"><b>Leger op tafel:</b> ${esc(F.leger)}</p></li>`;
  };
  const spelers = n.facties.map((f, i) => [f, i]).filter(([f]) => f.speler === 'mens'), passief = n.facties.map((f, i) => [f, i]).filter(([f]) => f.speler !== 'mens');
  const rsOpt = Object.entries(RULESETS).map(([id, r]) => `<option value="${id}" ${n.ruleset === id ? 'selected' : ''}>${r.naam}</option>`).join('');
  const zijden = new Set(spelers.map(([f]) => f.zijde).filter((z) => z !== 'neutraal'));
  const fout = spelers.length < 2 ? 'Geef minstens twee landen een speler.' : zijden.size < 2 ? 'De landen met een speler moeten over minstens twee zijden verdeeld zijn.' : '';
  const spelerVak = `<ul class="spelers">${n.spelers.map((sp, k) => { const l = n.facties.filter((f) => f.wie === k); return `<li><input type="text" id="spn-${k}" data-c="ns" data-i="${k}" value="${esc(sp)}" aria-label="Naam van speler ${k + 1}"><span class="stil">${l.length ? l.map((f) => stip(FACTIES[f.id].kleur) + esc(FACTIES[f.id].naam)).join(', ') : 'nog geen land'}</span></li>`; }).join('')}</ul>
    <div class="knoppen">${n.spelers.length < 8 ? knop('spelerPlus', 'Speler erbij', '', 'mini') : ''}${n.spelers.length > 2 ? knop('spelerMin', 'Laatste speler weg', '', 'mini') : ''}</div>`;
  return `<main class="nieuw">
  <section class="kaartvak"><p class="oog">${esc(sc.ondertitel)}</p><h1>${esc(sc.naam)}</h1><p>${esc(sc.tekst)}</p>
    ${sc.doel && !n.geenDoel ? `<p class="doelregel"><b>Doel.</b> ${esc(sc.doel.tekst)} Lukt dat niet, dan wint de andere zijde.</p>` : `<p class="doelregel"><b>Doel.</b> De zijde met de meeste overwinningspunten na ${n.maxBeurten} beurten wint.</p>`}
    <div class="kaartrol past"><div>${kaartSvg(ps, {})}</div></div>
    ${sc.sandbox ? `<label class="inlijn">Klik op een regio om haar te geven aan <select id="n-verf" data-c="n" data-veld="verf">${n.facties.map((f) => `<option value="${f.id}" ${n.verf === f.id ? 'selected' : ''}>${esc(FACTIES[f.id].naam)}</option>`).join('')}</select></label>` : ''}
    ${legenda()}</section>
  <section class="paneel"><h2>Wie speelt mee?</h2><p class="stil">Geef elke speler een naam en kies hieronder per land wie het bestuurt. Eén speler mag meerdere landen besturen. Landen zonder speler doen niets.</p>
    ${spelerVak}
    <h2>Landen met een speler</h2><ul class="facrijen">${spelers.map(([f, i]) => rij(f, i)).join('') || '<li class="stil">Nog geen land gekozen.</li>'}</ul>
    ${passief.length ? `<details ${spelers.length < 2 ? 'open' : ''}><summary>Landen zonder speler (${passief.length})</summary><p class="stil">Ze geven geen orders en doen niets uit zichzelf. Val je er één aan, dan speelt een tegenstander zijn leger. Een neutraal land dat wordt aangevallen, kiest de andere kant.</p><ul class="facrijen">${passief.map(([f, i]) => rij(f, i)).join('')}</ul></details>` : ''}
    <h2>Instellingen</h2>
    <div class="veldgrid">
      <label class="breed">Naam van de campagne<input type="text" id="n-naam" data-c="n" data-veld="naam" value="${esc(n.naam)}"></label>
      <label>Systeem<select id="n-rs" data-c="n" data-veld="ruleset">${rsOpt}</select></label>
      <label>Punten per kant<select id="n-pt" data-c="n" data-veld="punten" data-num="1">${RULESETS[n.ruleset].opties.map((p) => `<option ${p === n.punten ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label>Volgorde<select id="n-mod" data-c="n" data-veld="modus"><option value="simultaan" ${n.modus === 'simultaan' ? 'selected' : ''}>Simultaan, verborgen orders</option><option value="beurt" ${n.modus === 'beurt' ? 'selected' : ''}>Om de beurt, op initiatief</option></select></label>
      ${sc.sandbox ? `<label>Eén beurt is<select id="n-len" data-c="n" data-veld="lengte">${['maand', 'seizoen'].map((l) => `<option value="${l}" ${n.lengte === l ? 'selected' : ''}>een ${LENGTES[l]}</option>`).join('')}</select></label>
      <label>Aantal beurten<input type="number" id="n-max" min="2" max="60" data-c="n" data-veld="maxBeurten" data-num="1" value="${n.maxBeurten}"></label>` : ''}
      <label class="vink breed"><input type="checkbox" id="n-mist" data-c="n" data-veld="mist" ${n.mist ? 'checked' : ''}> Fog of war: je ziet vijandelijke versterkingen pas na recon</label>
      <label class="vink breed"><input type="checkbox" id="n-door" data-c="n" data-veld="doorlopend" ${n.doorlopend ? 'checked' : ''}> De periode volgt de kalender: Mid war vanaf 1942, Late war vanaf 1944</label>
      ${sc.sandbox && sc.doel ? `<label class="vink breed"><input type="checkbox" id="n-doel" data-c="n" data-veld="geenDoel" ${n.geenDoel ? 'checked' : ''}> Zonder scenariodoel: speel op overwinningspunten</label>` : ''}
    </div>
    ${fout ? `<p class="fout">${fout}</p>` : ''}
    <div class="knoppen">${knop('startCampagne', 'Start de campagne', fout ? 'disabled' : '', 'hoofd')}${knop('naarStart', 'Terug')}</div>
  </section></main>`;
}
function legenda() {
  return `<p class="legenda stil"><span>★ hoofdstad</span><span>cijfer = waarde</span><span>S stad</span><span>H haven</span><span>B brug</span><span>T spoor</span><span>V vliegveld</span><span>▲ versterking</span><span class="leg-doel">gele ring = campagnedoel</span><span class="leg-arc">gearceerd = niet bevoorraad</span><span class="leg-oms">oranje rand = omstreden</span></p>`;
}

// ═════════ campagne ═════════
function kaartOpties(s) {
  const o = { selectie: ui.sel, pijlen: [], merktekens: [], gevechten: [] };
  const zetOrders = (fid, lijst) => { for (const ord of lijst || []) { if (ord.type === 'aanval') o.pijlen.push({ van: ord.van, naar: ord.naar, fid }); else o.merktekens.push({ regio: ord.naar, code: ORDERCODE[ord.type], fid }); } };
  if (s.fase === 'orders' || (s.fase === 'onthuld' && ui.auftrag)) {
    const fid = ui.plannend || (ui.auftrag && ui.auftrag.fid);
    if (fid) {
      o.toonFort = (id) => zietVersterking(s, fid, id);
      const eigen = (s.orders[fid] || []).filter((_, i) => !(ui.auftrag && ui.auftrag.index === i));
      zetOrders(fid, eigen);
      if (s.fase === 'orders') for (const a of bekendeAanvallen(s, fid)) { if (a.van) o.pijlen.push({ van: a.van, naar: a.naar, fid: a.fid }); else o.merktekens.push({ regio: a.naar, code: ORDERCODE[a.type], fid: a.fid }); }
      if (ui.orderType) {
        if (ui.orderType === 'aanval' && !ui.orderVan) o.kiesbaar = orderDoelen(s, fid, 'aanval').filter((id) => !eigen.some((x) => x.type === 'aanval' && x.van === id));
        else { o.kiesbaar = orderDoelen(s, fid, ui.orderType, ui.orderVan); o.bron = ui.orderVan; }
      }
    } else { o.toonFort = (id) => !s.mist || !factie(s, s.regios[id].eigenaar); o.fortVraag = ''; }
  } else if (s.fase === 'onthuld') {
    for (const f of s.facties) zetOrders(f.id, s.orders[f.id]);
  } else {
    for (const g of s.gevechten) { o.gevechten.push({ regio: g.regio, open: g.status === 'open' }); if (g.van && g.status === 'open') o.pijlen.push({ van: g.van, naar: g.regio, fid: g.aanvaller }); }
  }
  return o;
}
function regioKaart(s) {
  if (!ui.sel || !s.regios[ui.sel]) return '<p class="stil regiokaart">Klik op een regio voor de details.</p>';
  const info = kaartVan(s), r = info.opId[ui.sel], rs = s.regios[ui.sel];
  const kijker = ui.plannend, zie = kijker ? zietVersterking(s, kijker, r.id) : (s.fase !== 'orders' || !s.mist || !factie(s, rs.eigenaar));
  const fort = effectieveFort(s, r.id);
  let extra = '';
  if (kijker && zijdeVan(s, rs.eigenaar) !== zijdeVan(s, kijker) && factie(s, rs.eigenaar) && zie) {
    const k = voorspel(s, kijker, r.id, null, 'aanval').slice(0, 4);
    extra = `<p><b>Waarschijnlijk scenario bij een aanval:</b> ${k.map((x) => `${esc(x.naam)} ${Math.round(x.kans * 100)}%`).join(', ')}.</p>`;
  }
  return `<div class="regiokaart"><h3>${esc(r.naam)}</h3><p class="chips">${chip(facNaam(s, rs.eigenaar))}${chip(TERREINEN[r.terrein])}${chip(`waarde ${r.waarde}`)}${r.infra.filter((x) => x !== 'kust').map((x) => chip(INFRA[x])).join('')}${r.infra.includes('kust') ? chip('kust') : ''}</p>
    <dl class="feiten smal"><div><dt>Versterking</dt><dd>${zie ? `${VERSTERKING[fort]}${rs.linie && fort >= 1 ? ' (' + esc(rs.linie) + ')' : ''}` : 'onbekend, doe recon'}</dd></div>
    <div><dt>Bevoorrading</dt><dd>${rs.gesloten ? 'gesloten gebied' : rs.bev ? 'bevoorraad' : rs.ingesloten ? 'ingesloten' : 'afgesneden'}${rs.afgesnedenSinds ? `, capituleert na beurt ${rs.afgesnedenSinds + s.capitulatieNa - 1}` : ''}</dd></div>
    <div><dt>Gevechten hier</dt><dd>${rs.gevechten}${rs.omstreden ? ', nu omstreden' : ''}${rs.ruine ? ', in puin' : ''}</dd></div>
    <div><dt>Grenst aan</dt><dd>${info.buren[r.id].map((n) => esc(info.opId[n].naam)).join(', ') || 'niets over land'}</dd></div></dl>
    ${rs.vorige ? `<p class="stil">Laatste gevecht: beurt ${rs.vorige.beurt}, ${esc(rs.vorige.scenario)}${rs.vorige.winnaar ? ', gewonnen door ' + esc(factie(s, rs.vorige.winnaar).naam) : ', onbeslist'}.</p>` : ''}${extra}</div>`;
}
function orderTekst(s, o) {
  const info = kaartVan(s);
  return `${ORDERTYPES[o.type].naam}${o.van ? ' vanuit ' + esc(info.opId[o.van].naam) : ''} ${o.type === 'aanval' ? 'op' : '→'} ${esc(info.opId[o.naar].naam)}`;
}
function instructie(s) {
  const fid = ui.plannend || (ui.auftrag && ui.auftrag.fid);
  if (!fid) return s.fase === 'gevechten' ? 'Rood kruis: open gevecht. Grijs kruis: afgehandeld.' : '';
  if (!ui.orderType) return 'Kies rechts een order en klik dan op de kaart.';
  if (ui.orderType === 'aanval') return ui.orderVan ? 'Klik op de regio die je aanvalt.' : 'Klik op de eigen regio van waaruit je aanvalt.';
  return `${ORDERTYPES[ui.orderType].naam}: klik op een oplichtende regio.`;
}

function tabBeurt(s) {
  const info = kaartVan(s);
  if (s.fase === 'einde') {
    const st = stand(s);
    return `<div class="banner"><p class="oog">Campagne voorbij</p><h2>${s.winnaar.zijde ? ZIJDEN[s.winnaar.zijde] + ' winnen' : 'Onbeslist'}</h2><p>${esc(s.winnaar.reden)}</p></div>${standTabel(s, st)}`;
  }
  if (s.fase === 'orders') {
    if (ui.plannend) return orderBouwer(s, ui.plannend);
    const volg = planVolgorde(s), nu = volgendePlanner(s);
    const rijen = volg.map((id) => factie(s, id)).map((f) => `<li class="rij smal"><span>${facNaam(s, f.id)}${f.spelerNaam ? ` <span class="stil">${esc(f.spelerNaam)}</span>` : ''}</span>${s.klaar[f.id] ? chip('orders klaar', 'ok') : chip('moet nog plannen')}</li>`).join('');
    return `<h2>Strategische fase</h2><p class="stil">${s.modus === 'simultaan' ? 'Iedereen geeft verborgen orders; ze worden tegelijk onthuld.' : `Om de beurt, op initiatief: ${volg.map((id) => esc(factie(s, id).naam)).join(', ')}. Wie later plant, ziet de aanvallen van wie al klaar is.`}</p>
      <ul class="rijen">${rijen}</ul>
      ${nu ? `<div class="doorgeef"><p>Geef het toestel aan <b>${esc(factie(s, nu).spelerNaam || 'de speler van ' + factie(s, nu).naam)}</b>.</p>${knop('plan', `Plan de orders van ${esc(factie(s, nu).naam)}`, `data-id="${nu}"`, 'hoofd')}</div>` : `<div class="doorgeef"><p>Alle orders liggen klaar.</p>${knop('onthul', 'Onthul de orders', '', 'hoofd')}</div>`}`;
  }
  if (s.fase === 'onthuld') {
    if (ui.auftrag) return orderBouwer(s, ui.auftrag.fid);
    const perFactie = s.initiatief.filter((fid) => factie(s, fid).speler === 'mens').map((fid) => {
      const f = factie(s, fid), l = s.orders[fid] || [];
      const magAuf = f.speler === 'mens' && heeftDoc(f, 'auftragstaktik') && !s.auftragGebruikt[fid] && l.length;
      return `<li class="blok"><h3>${facNaam(s, fid)}</h3>${l.length ? `<ol class="orders">${l.map((o, i) => `<li><span class="code">${ORDERCODE[o.type]}</span>${orderTekst(s, o)}${magAuf ? knop('auftrag', 'vervang', `data-id="${fid}" data-i="${i}"`, 'mini') : ''}</li>`).join('')}</ol>` : '<p class="stil">Geen orders.</p>'}${magAuf ? '<p class="stil">Auftragstaktik: je mag één order vervangen.</p>' : ''}</li>`;
    }).join('');
    const gev = s.voorstel.gevechten.map((g) => `<li>${g.soort === 'bezetting' ? `${esc(factie(s, g.aanvaller).naam)} bezet ${esc(info.opId[g.regio].naam)} zonder gevecht` : `<b>${esc(info.opId[g.regio].naam)}</b>: ${g.soort === 'ontmoeting' ? 'ontmoetingsgevecht tussen' : { aanval: 'aanval van', landing: 'landing van', luchtlanding: 'luchtlanding van', raid: 'raid van' }[g.soort]} ${esc(factie(s, g.aanvaller).naam)} ${g.soort === 'ontmoeting' ? 'en' : 'op'} ${esc(factie(s, g.verdediger).naam)}${g.steun.length ? ', met steun van ' + g.steun.map((x) => esc(factie(s, x).naam)).join(' en ') : ''}`}</li>`).join('');
    return `<h2>Orders onthuld</h2><ul class="blokken">${perFactie}</ul><h3>Dit worden de gevechten</h3>${gev ? `<ul class="lijst">${gev}</ul>` : '<p class="stil">Niemand valt aan: een rustige beurt.</p>'}
      ${s.voorstel.berichten.map((m) => `<p class="stil">${esc(m)}</p>`).join('')}<div class="knoppen">${knop('startGevechten', 'Genereer de scenario\'s', '', 'hoofd')}</div>`;
  }
  // gevechten
  const kaarten = s.gevechten.map((g) => {
    if (g.soort === 'bezetting') return `<li class="gev klaar"><div><b>${esc(info.opId[g.regio].naam)}</b><p class="stil">${esc(factie(s, g.aanvaller).naam)} bezet de regio zonder gevecht.</p></div></li>`;
    const u = g.uitslag;
    const ut = u ? `Gewonnen door ${esc(factie(s, u.winnaar === 'A' ? g.aanvaller : g.verdediger).naam)}` : '';
    return `<li class="gev ${g.status === 'open' ? 'open' : 'klaar'}"><div><p class="oog">${esc(info.opId[g.regio].naam)}${g.bonus ? ' · Blitzkrieg' : ''}</p><b>${esc(g.scenario.naam)}</b><p>${facNaam(s, g.aanvaller)} tegen ${facNaam(s, g.verdediger)}</p>${u ? `<p class="stil">${ut}</p>` : ''}</div>
      <div class="knoppen">${knop('openGevecht', g.status === 'open' ? 'Scenario en tafelmap' : 'Bekijk', `data-id="${g.id}"`, g.status === 'open' ? 'hoofd' : '')}</div></li>`;
  }).join('');
  const bonus = s.bonus.map((bo) => {
    const d = bonusDoelen(s, bo);
    return `<div class="doorgeef"><p><b>Blitzkrieg.</b> ${esc(factie(s, bo.fid).naam)} mag vanuit ${esc(info.opId[bo.van].naam)} meteen doorstoten.</p><div class="knoppen">${d.map((id) => knop('bonus', `Val ${esc(info.opId[id].naam)} aan`, `data-fid="${bo.fid}" data-van="${bo.van}" data-naar="${id}"`, 'hoofd')).join('')}${knop('bonus', 'Zie ervan af', `data-fid="${bo.fid}" data-van="${bo.van}" data-naar=""`)}</div></div>`;
  }).join('');
  const open = s.gevechten.filter((g) => g.status === 'open').length;
  return `<h2>Gevechten van beurt ${s.beurt}</h2>${s.gevechten.length ? `<ul class="gevechten">${kaarten}</ul>` : '<p class="stil">Geen gevechten deze beurt.</p>'}${bonus}
    <div class="knoppen">${knop('eindeBeurt', open ? `Nog ${open} gevecht${open > 1 ? 'en' : ''} open` : 'Sluit de beurt af', kanBeurtEindigen(s) ? '' : 'disabled', 'hoofd')}</div>`;
}

function orderBouwer(s, fid) {
  const f = factie(s, fid), lim = limieten(s, fid), lijst = s.orders[fid] || [];
  const eigen = ui.auftrag ? lijst.filter((_, i) => i !== ui.auftrag.index) : lijst;
  const tel = telling(s, fid, eigen), bekend = s.fase === 'orders' ? bekendeAanvallen(s, fid) : [];
  const info = kaartVan(s);
  const types = beschikbareOrders(s, fid).map((t) => {
    const n = t === 'aanval' ? orderDoelen(s, fid, 'aanval').length : orderDoelen(s, fid, t).length;
    return `<button type="button" class="ordknop${ui.orderType === t ? ' aan' : ''}" data-a="orderType" data-id="${t}" ${n ? '' : 'disabled'} title="${esc(ORDERTYPES[t].tekst)}"><span class="code">${ORDERCODE[t]}</span>${ORDERTYPES[t].naam}</button>`;
  }).join('');
  return `<div class="planner"><p class="oog">${ui.auftrag ? 'Auftragstaktik: vervang één order' : `Geheim: alleen voor ${esc(f.spelerNaam || 'deze speler')}`}</p><h2>${facNaam(s, fid)}</h2>
    <p class="stil">${esc(docNamen(f))}</p>
    <p class="tellers">${chip(`Orders ${tel.orders} van ${lim.orders}`, tel.orders >= lim.orders ? 'let' : '')}${chip(`Aanvallen ${tel.aanvallen} van ${lim.aanvallen}`, tel.aanvallen >= lim.aanvallen ? 'let' : '')}</p>
    ${bekend.length ? `<p class="let-tekst"><b>Verkenning meldt:</b> ${bekend.map((a) => `${esc(factie(s, a.fid).naam)} valt ${esc(info.opId[a.naar].naam)} aan`).join('; ')}.</p>` : ''}
    <div class="ordknoppen">${types}</div>
    ${ui.orderType ? `<p class="uitleg">${esc(ORDERTYPES[ui.orderType].tekst)} ${esc(instructie(s))}</p>` : '<p class="uitleg">Kies een order, klik dan op de kaart.</p>'}
    ${ui.melding ? `<p class="fout">${esc(ui.melding)}</p>` : ''}
    <h3>Jouw orders</h3>${eigen.length ? `<ol class="orders">${lijst.map((o, i) => (ui.auftrag && ui.auftrag.index === i ? '' : `<li><span class="code">${ORDERCODE[o.type]}</span>${orderTekst(s, o)}${ui.auftrag ? '' : knop('wisOrder', 'wis', `data-i="${i}"`, 'mini')}</li>`)).join('')}</ol>` : '<p class="stil">Nog geen orders.</p>'}
    <div class="knoppen">${ui.auftrag ? knop('auftragStop', 'Annuleer') : knop('planKlaar', 'Klaar met ' + esc(f.naam), '', 'hoofd')}</div></div>`;
}

function standTabel(s, st) {
  const max = Math.max(1, ...st.perFactie.map((p) => p.vp));
  return `<table class="tabel"><thead><tr><th>Land</th><th>Zijde</th><th class="num">Regio's</th><th class="num">Punten</th><th></th></tr></thead><tbody>
    ${st.perFactie.slice().sort((a, b) => b.vp - a.vp).map((p) => `<tr><td>${facNaam(s, p.id)}</td><td>${ZIJDEN[p.zijde]}</td><td class="num">${p.regios}</td><td class="num">${p.vp}</td><td class="balk"><span style="width:${Math.round(p.vp / max * 100)}%;background:${factie(s, p.id).kleur}"></span></td></tr>`).join('')}
    </tbody></table><p class="chips">${Object.entries(st.perZijde).map(([z, v]) => chip(`${ZIJDEN[z]}: ${v} punten`)).join('')}</p>`;
}
function tabStand(s) {
  const st = stand(s);
  const doel = s.doel ? `<div class="doelvak"><h3>Campagnedoel</h3><p>${esc(s.doel.tekst)}</p><p class="chips">${st.doel.lijst.map((r) => chip(`${r.binnen ? '✓' : '○'} ${esc(r.naam)}`, r.binnen ? 'ok' : '')).join('')}</p><p class="stil">${st.doel.heeft} van de ${st.doel.nodig} nodige regio's in handen van de ${ZIJDEN[s.doel.zijde]}. Nog ${Math.max(0, s.maxBeurten - s.beurt + 1)} beurt${s.maxBeurten - s.beurt + 1 === 1 ? '' : 'en'}.</p></div>`
    : `<div class="doelvak"><h3>Campagnedoel</h3><p>De zijde met de meeste overwinningspunten na beurt ${s.maxBeurten} wint.</p></div>`;
  return `<h2>Stand</h2>${doel}${standTabel(s, st)}<p class="stil">Een regio telt voor haar waarde; een hoofdstad telt 3 extra. Een geslaagde raid levert losse punten op.</p>`;
}
function tabLanden(s) {
  return `<h2>Landen</h2><ul class="blokken">${s.facties.slice().sort((a, b) => (a.speler === 'mens' ? 0 : 1) - (b.speler === 'mens' ? 0 : 1)).map((f) => {
    const lim = limieten(s, f.id), vrij = doctrinesVoor(f.id, s.periode).filter((d) => !f.doctrines.includes(d.id));
    const docs = f.doctrines.map((id, i) => { const d = doctrineVan(id); return `<div class="doc"><b>${esc(d.naam)}</b>${f.magWisselen && i === 0 && vrij.length ? ` <select id="wd-${f.id}" data-c="wisselDoc" data-id="${f.id}" aria-label="Andere doctrine"><option value="">andere kiezen…</option>${vrij.map((x) => `<option value="${x.id}">${esc(x.naam)}</option>`).join('')}</select>` : ''}<p><b>Kaart:</b> ${esc(d.strat)} <b>Gevecht:</b> ${esc(d.gevecht)} <b>Nadeel:</b> ${esc(d.nadeel)}</p></div>`; }).join('');
    const tweede = f.slots >= 2 && f.doctrines.length < 2 && vrij.length ? `<label class="tweede">Tweede doctrine vrijgespeeld<select id="td-${f.id}" data-c="tweedeDoc" data-id="${f.id}"><option value="">kies…</option>${vrij.map((x) => `<option value="${x.id}">${esc(x.naam)}</option>`).join('')}</select></label>` : '';
    const vets = f.veteranen.map((v, i) => `<li><span><b>${esc(v.naam)}</b> · ${v.gevechten} gevecht${v.gevechten === 1 ? '' : 'en'} · <span class="stil">${veteraanBonus(v)}</span></span><span class="knoppen">${knop('vetPlus', '+1 gevecht', `data-id="${f.id}" data-i="${i}"`, 'mini')}${knop('vetWeg', 'wis', `data-id="${f.id}" data-i="${i}"`, 'mini')}</span></li>`).join('');
    return `<li class="blok${f.verslagen ? ' uit' : ''}"><div class="fackop"><h3>${facNaam(s, f.id)}${f.speler === 'mens' && f.spelerNaam ? ` <span class="stil">${esc(f.spelerNaam)}</span>` : ''}</h3><span class="chips">${chip(ZIJDEN[f.zijde])}${f.verslagen ? chip('verslagen', 'let') : chip(`${lim.orders} orders, ${lim.aanvallen} aanvallen`)}</span></div>
      <label class="inlijn">Wie speelt <select id="sp2-${f.id}" data-c="spelerWissel" data-id="${f.id}"><option value="mens" ${f.speler === 'mens' ? 'selected' : ''}>Een speler</option><option value="passief" ${f.speler !== 'mens' ? 'selected' : ''}>Niemand: verdedigt alleen</option></select></label>
      <p class="doctekst"><b>Leger op tafel:</b> ${esc(f.leger || FACTIES[f.id].leger)}</p>
      ${docs}${tweede}
      <details><summary>Veteranen (${f.veteranen.length})</summary><ul class="vets">${vets}</ul><div class="inlijn"><input type="text" id="vet-${f.id}" placeholder="Naam van de eenheid" aria-label="Naam van de eenheid">${knop('vetNieuw', 'Voeg toe', `data-id="${f.id}"`, 'mini')}</div><p class="stil">Geef een eenheid die een gevecht overleeft een naam. Vanaf 3 gevechten krijgt ze een herworp.</p></details>
      ${(EENHEDEN[s.periode] || {})[f.id] ? `<details><summary>Periode-check</summary><p>${esc(EENHEDEN[s.periode][f.id])}</p></details>` : ''}</li>`;
  }).join('')}</ul>`;
}
function tabLog(s) {
  return `<h2>Campagnelog</h2>${s.log.slice().reverse().map((b) => `<section class="logblok"><h3>Beurt ${b.beurt} <span class="stil">${esc(b.datum)}</span></h3><ul>${b.items.map((i) => `<li class="log-${i.soort}">${esc(i.tekst)}</li>`).join('')}</ul></section>`).join('')}`;
}
function voorraadVelden(tafel, voorraad, c) {
  const presets = [['72x48 inch', 72, 48, 'inch'], ['48x48 inch', 48, 48, 'inch'], ['180x120 cm', 180, 120, 'cm'], ['120x120 cm', 120, 120, 'cm']];
  return `<div class="veldgrid"><label>Breedte<input type="number" id="${c}-b" min="24" max="400" data-c="${c}" data-veld="b" value="${tafel.b}"></label><label>Diepte<input type="number" id="${c}-h" min="24" max="300" data-c="${c}" data-veld="h" value="${tafel.h}"></label>
    <label>Eenheid<select id="${c}-e" data-c="${c}" data-veld="eenheid"><option value="inch" ${tafel.eenheid === 'inch' ? 'selected' : ''}>inch</option><option value="cm" ${tafel.eenheid === 'cm' ? 'selected' : ''}>cm</option></select></label></div>
    <p class="knoppen">${presets.map(([n, b, h, e]) => knop('tafelPreset', n.replace('x', ' × '), `data-b="${b}" data-h="${h}" data-e="${e}" data-c="${c}"`, 'mini')).join('')}</p>
    <h3>Terreinvoorraad</h3><p class="stil">Vul in wat er in je kast ligt. De tafelmap gebruikt nooit meer dan dit.</p>
    <div class="voorraad">${Object.entries(STUKKEN).map(([t, d]) => `<label><span>${esc(d.naam)}</span><input type="number" id="${c}-v-${t}" min="0" max="60" data-c="${c}v" data-veld="${t}" value="${voorraad[t] || 0}"></label>`).join('')}</div>`;
}
function tabTafel(s) {
  return `<h2>Tafel en terrein</h2>${voorraadVelden(s.tafel, s.voorraad, 'ct')}<h3>Bewaren en delen</h3><div class="knoppen">${knop('exporteer', 'Exporteer deze campagne', `data-id="${s.id}"`)}</div>${ui.exportTekst ? exportVak() : ''}`;
}
function tabRegels(s) {
  const rs = RULESETS[s.ruleset];
  return `<h2>Regels in het kort</h2>
    <details open><summary>Orders</summary><ul class="lijst">${Object.entries(ORDERTYPES).map(([t, o]) => `<li><span class="code">${ORDERCODE[t]}</span><b>${o.naam}.</b> ${esc(o.tekst)}</li>`).join('')}</ul><p class="stil">Een land krijgt 3 orders per beurt (4 vanaf 10 regio's) en 2 tot 3 aanvallen. De zijde met het campagnedoel valt één keer extra aan. Twee landen die elkaar over dezelfde grens aanvallen, spelen één ontmoetingsgevecht.</p></details>
    <details><summary>Uitslag en gevolgen</summary><table class="tabel"><tbody><tr><th>De aanvaller wint</th><td>De regio is veroverd. Een versterking in de regio is weg.</td></tr><tr><th>De verdediger wint</th><td>De regio blijft. De verdediger krijgt volgende beurt een tegenaanval-optie op de regio waaruit de aanval kwam.</td></tr><tr><th>Onbeslist</th><td>Telt als winst voor de verdediger. Een nieuw gevecht in dezelfde regio is een vervolgscenario.</td></tr></tbody></table>
      <p class="stil">Je voert alleen in wie won. Een regio die ${s.capitulatieNa} beurten afgesneden is van elke bron, capituleert. Een land zonder speler geeft geen orders; wordt het aangevallen, dan speelt een tegenstander zijn leger. Na drie gewonnen gevechten of vijf beurten kies je een tweede doctrine.</p></details>
    <details><summary>Scenario's</summary><table class="tabel"><thead><tr><th>Scenario</th><th>Wanneer</th><th>Doel</th></tr></thead><tbody>${Object.values(SCENARIOTYPES).map((t) => `<tr><th>${t.naam}</th><td>${esc(t.wanneer)}</td><td>${esc(t.doel)}</td></tr>`).join('')}</tbody></table></details>
    <details><summary>Alle doctrines</summary><ul class="lijst">${DOCTRINES.map((d) => `<li><b>${esc(d.naam)}</b> <span class="stil">${d.landen.includes('*') ? 'elk land' : d.landen.filter((x) => FACTIES[x]).map((x) => FACTIES[x].kort).join(', ')} · ${d.periodes.map((p) => PERIODES[p].naam.split(' ')[0].toLowerCase()).join(', ')}</span><br>Kaart: ${esc(d.strat)} Gevecht: ${esc(d.gevecht)} Nadeel: ${esc(d.nadeel)}</li>`).join('')}</ul></details>`;
}

function campagneScherm() {
  const s = C();
  if (ui.gevecht) return gevechtScherm(s);
  const tabs = [['beurt', 'Beurt'], ['stand', 'Stand'], ['landen', 'Landen'], ['log', 'Log'], ['tafel', 'Tafel'], ['regels', 'Regels']];
  const inhoud = { beurt: tabBeurt, stand: tabStand, landen: tabLanden, log: tabLog, tafel: tabTafel, regels: tabRegels }[ui.tab](s);
  const bezit = s.facties.filter((f) => !f.verslagen).map((f) => `<span>${stip(f.kleur)}${esc(f.kort)} ${regiosVan(s, f.id).length}</span>`).join('');
  return `<main class="camp">
  <section class="kaartvak"><div class="kaartbalk"><p class="instructie">${esc(instructie(s))}</p><div class="knoppen">${knop('zoom', '−', 'data-d="-1" aria-label="Zoom uit"', 'mini')}${knop('zoom', '+', 'data-d="1" aria-label="Zoom in"', 'mini')}</div></div>
    <div class="kaartrol${ui.zoom === 1 ? ' past' : ''}"><div style="width:${Math.round(ui.zoom * 100)}%">${kaartSvg(s, kaartOpties(s))}</div></div>
    <p class="bezit">${bezit}</p>${regioKaart(s)}${legenda()}</section>
  <section class="paneel"><div class="tabs" role="tablist">${tabs.map(([id, n]) => `<button type="button" role="tab" aria-selected="${ui.tab === id}" class="tab${ui.tab === id ? ' aan' : ''}" data-a="tab" data-id="${id}">${n}</button>`).join('')}</div><div class="tabinhoud">${inhoud}</div></section>
</main>`;
}

// ═════════ gevecht ═════════
function bladActies(metHerrol) {
  return `<div class="knoppen geen-print">${metHerrol ? knop('herrol', 'Herrol het terrein') : ''}${knop('kopieerSvg', 'Kopieer de tafelmap als SVG')}${INGEBED ? '' : knop('downloadSvg', 'Download SVG') + knop('print', 'Print dit blad')}</div>`;
}
function gevechtScherm(s) {
  const g = s.gevechten.find((x) => x.id === ui.gevecht), info = kaartVan(s);
  const A = factie(s, g.aanvaller), V = factie(s, g.verdediger), tm = tafelVan(s, g), u = ui.uitslag || (ui.uitslag = { keuze: '' });
  const blad = scenarioBlad(g.scenario, tm, { oog: `${s.naam} · beurt ${s.beurt} · ${datumVan(s).label} · ${info.opId[g.regio].naam}`, A, V, periode: s.periode, acties: bladActies(g.status === 'open') });
  let onder;
  if (g.status === 'open') {
    const zonder = [A, V].filter((f) => f.speler !== 'mens').map((f) => `${esc(f.naam)} heeft geen speler: een tegenstander van ${esc(f === A ? V.naam : A.naam)} speelt dit leger.`).join(' ');
    onder = `<section class="uitslag geen-print"><h2>Wie won?</h2>${zonder ? `<p>${zonder}</p>` : ''}<div class="keuzes" role="radiogroup" aria-label="Winnaar">${[['A', A], ['V', V]].map(([k, f]) => `<button type="button" role="radio" aria-checked="${u.keuze === k}" class="keuze${u.keuze === k ? ' aan' : ''} k${k}" data-a="kiesUitslag" data-id="${k}">${stip(f.kleur)}${esc(f.naam)} wint</button>`).join('')}</div>
      <p class="stil">Onbeslist na de laatste beurt? ${g.scenario.type === 'ontmoeting' ? 'Werp een dobbelsteen om de winnaar.' : 'Dan houdt de verdediger de regio.'}</p>
      <div class="knoppen">${knop('bevestigUitslag', 'Bevestig', u.keuze ? '' : 'disabled', 'hoofd')}${knop('sluitGevecht', 'Terug naar de kaart')}</div></section>`;
  } else {
    onder = `<section class="uitslag geen-print"><h2>Uitslag</h2><p>Gewonnen door ${esc((g.uitslag.winnaar === 'A' ? A : V).naam)}.</p><div class="knoppen">${knop('sluitGevecht', 'Terug naar de kaart', '', 'hoofd')}</div></section>`;
  }
  return `<main class="bladscherm">${blad}${onder}</main>`;
}

// ═════════ los scenario ═════════
function beginLos() {
  ui.los = ui.los || { terrein: 'bocage', infra: { stad: true, brug: false }, fort: 0, type: '', ruleset: 'fow', punten: 100, grond: 'normaal', periode: 'late', facA: 'vs', facV: 'dui', docA: 'vuurkracht', docV: 'elastisch', versterkt: false, verdedigt: false, afgesneden: false, omstreden: false, seed: nieuweSeed(), rol: 0, regio: 'Los gevecht' };
  ui.scherm = 'los';
}
function losScenario() {
  const l = ui.los, T = l.type ? SCENARIOTYPES[l.type] : null;
  const soort = l.type === 'ontmoeting' ? 'ontmoeting' : l.type === 'raid' ? 'raid' : l.type === 'strandlanding' ? 'landing' : l.type === 'luchtlanding' ? 'luchtlanding' : 'aanval';
  const infra = Object.keys(l.infra).filter((k) => l.infra[k]);
  const ctx = { regio: { naam: l.regio || 'Los gevecht', terrein: l.terrein, infra, waarde: 2, fort: +l.fort, linie: '' }, soort, forceType: T ? l.type : undefined, ruleset: l.ruleset, punten: +l.punten, periode: l.periode, grond: l.grond, omstreden: l.omstreden ? 1 : 0, ruine: !!l.omstreden,
    A: { naam: FACTIES[l.facA].naam, doctrines: l.docA ? [l.docA] : [] }, V: { naam: FACTIES[l.facV].naam, doctrines: l.docV ? [l.docV] : [], versterkt: l.versterkt, verdedigt: l.verdedigt, afgesneden: l.afgesneden, heleBeurt: true } };
  const scn = genereerScenario(ctx, l.seed);
  const tm = genereerTafel({ tafel: opslag.tafel, voorraad: opslag.voorraad, terrein: l.terrein, scenario: scn, infraBrug: l.infra.brug }, l.seed + (l.rol ? '~' + l.rol : ''));
  return { scn, tm };
}
function losScherm() {
  const l = ui.los, { scn, tm } = losScenario();
  const sel = (id, veld, opties, waarde) => `<select id="${id}" data-c="l" data-veld="${veld}">${opties.map(([v, n]) => `<option value="${v}" ${String(v) === String(waarde) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const facOpt = Object.keys(FACTIES).filter((f) => f !== 'neutraal').map((f) => [f, FACTIES[f].naam]);
  const docOpt = (fid) => [['', 'geen']].concat(doctrinesVoor(fid, l.periode).map((d) => [d.id, d.naam]));
  const blad = scenarioBlad(scn, tm, { oog: `Los scenario · ${l.regio || 'Los gevecht'}`, A: { id: l.facA, naam: FACTIES[l.facA].naam, kleur: FACTIES[l.facA].kleur, leger: FACTIES[l.facA].leger }, V: { id: l.facV, naam: FACTIES[l.facV].naam, kleur: FACTIES[l.facV].kleur, leger: FACTIES[l.facV].leger }, periode: l.periode, acties: bladActies(true) });
  return `<main class="losscherm"><section class="paneel geen-print"><h1>Los scenario</h1><p class="stil">Zonder campagne: kies het gebied en de situatie, en krijg een scenario met tafelmap. Dezelfde seed geeft altijd hetzelfde resultaat.</p>
    <div class="veldgrid">
      <label class="breed">Naam van de plek<input type="text" id="l-regio" data-c="l" data-veld="regio" value="${esc(l.regio)}"></label>
      <label>Terrein${sel('l-ter', 'terrein', Object.entries(TERREINEN), l.terrein)}</label>
      <label>Versterking${sel('l-fort', 'fort', VERSTERKING.map((n, i) => [i, n]), l.fort)}</label>
      <label>Scenario${sel('l-type', 'type', [['', 'Laat de tabel kiezen']].concat(Object.entries(SCENARIOTYPES).map(([k, t]) => [k, t.naam])), l.type)}</label>
      <label>Grond${sel('l-grond', 'grond', Object.entries(GRONDNAAM), l.grond)}</label>
      <label>Periode${sel('l-per', 'periode', Object.entries(PERIODES).map(([k, p]) => [k, p.naam]), l.periode)}</label>
      <label>Systeem${sel('l-rs', 'ruleset', Object.entries(RULESETS).map(([k, r]) => [k, r.naam]), l.ruleset)}</label>
      <label>Punten per kant<input type="number" id="l-pt" min="10" max="5000" data-c="l" data-veld="punten" value="${l.punten}"></label>
      <label>Aanvaller${sel('l-fa', 'facA', facOpt, l.facA)}</label><label>Doctrine aanvaller${sel('l-da', 'docA', docOpt(l.facA), l.docA)}</label>
      <label>Verdediger${sel('l-fv', 'facV', facOpt, l.facV)}</label><label>Doctrine verdediger${sel('l-dv', 'docV', docOpt(l.facV), l.docV)}</label>
      <fieldset class="breed"><legend>In de regio</legend>${[['stad', 'Stad'], ['brug', 'Brug of rivier']].map(([k, n]) => `<label class="vink"><input type="checkbox" id="l-i-${k}" data-c="li" data-veld="${k}" ${l.infra[k] ? 'checked' : ''}> ${n}</label>`).join('')}</fieldset>
      <fieldset class="breed"><legend>Situatie</legend>${[['versterkt', 'Verdediger gaf een versterk-order'], ['verdedigt', 'Verdediger gaf een verdedig-order'], ['afgesneden', 'Verdediger is afgesneden'], ['omstreden', 'Vervolggevecht in dezelfde regio']].map(([k, n]) => `<label class="vink"><input type="checkbox" id="l-s-${k}" data-c="l" data-veld="${k}" ${l[k] ? 'checked' : ''}> ${n}</label>`).join('')}</fieldset>
      <label>Seed<input type="text" id="l-seed" class="mono" data-c="l" data-veld="seed" value="${esc(l.seed)}"></label>
    </div>
    <div class="knoppen">${knop('losNieuw', 'Nieuw scenario', '', 'hoofd')}</div>
    <details><summary>Tafel en terreinvoorraad</summary>${voorraadVelden(opslag.tafel, opslag.voorraad, 'gt')}</details></section>
    ${blad}</main>`;
}

// ═════════ tekenen en acties ═════════
function teken() {
  const y = window.scrollY;
  const scherm = { start: startScherm, nieuw: nieuwScherm, campagne: campagneScherm, los: losScherm }[ui.scherm]();
  wortel.innerHTML = kop() + scherm;
  window.scrollTo(0, y);
}
function naarBoven() { window.scrollTo(0, 0); }
function kopieer(tekst, el) {
  const klaar = () => { if (el) { const oud = el.textContent; el.textContent = 'Gekopieerd'; setTimeout(() => { el.textContent = oud; }, 1400); } };
  try { navigator.clipboard.writeText(tekst).then(klaar, () => { const v = document.getElementById('exportveld'); if (v) v.select(); }); } catch (e) { const v = document.getElementById('exportveld'); if (v) v.select(); }
}
function download(naam, tekst, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([tekst], { type })); a.download = naam; document.body.appendChild(a); a.click(); a.remove();
}
function huidigeSvg() { const el = wortel.querySelector('.tafel svg'); return el ? el.outerHTML : ''; }
function resetPlan() { ui.orderType = null; ui.orderVan = null; ui.melding = ''; }

const ACT = {
  naarStart() { ui.scherm = 'start'; ui.gevecht = null; ui.plannend = null; ui.auftrag = null; ui.undo = null; ui.melding = ''; ui.exportTekst = ''; resetPlan(); naarBoven(); },
  galerij(d) { ui.galerij = d.id; },
  kies(d) { beginNieuw(d.id); naarBoven(); },
  naarLos() { beginLos(); naarBoven(); },
  open(d) { ui.cid = d.id; ui.scherm = 'campagne'; ui.tab = 'beurt'; ui.sel = null; ui.gevecht = null; ui.plannend = null; ui.undo = null; ui.exportTekst = ''; const st = opslag.campagnes[d.id]; ui.zoom = st.kaart === 'europa' && !st.subset ? 1.5 : 1; naarBoven(); },
  wis(d) { ui.bevestig = 'wis:' + d.id; },
  wisJa(d) { delete opslag.campagnes[d.id]; ui.bevestig = null; bewaar(); },
  annuleer() { ui.bevestig = null; },
  exporteer(d) { ui.exportTekst = JSON.stringify(opslag.campagnes[d.id]); },
  sluitExport() { ui.exportTekst = ''; },
  kopieerExport(d, el) { kopieer(ui.exportTekst, el); return false; },
  downloadExport() { download('frontlinie-campagne.json', ui.exportTekst, 'application/json'); return false; },
  importeer() {
    const veld = document.getElementById('importveld');
    try {
      const s = JSON.parse(veld.value);
      if (!s || s.v !== 1 || !s.regios || !s.facties || !campagneVan(s.scenarioId)) throw new Error('vorm');
      if (opslag.campagnes[s.id]) s.id = s.id + 'i' + Date.now().toString(36);
      opslag.campagnes[s.id] = s; bewaar(); ui.melding = '';
    } catch (e) { ui.melding = 'Dit is geen geldige Frontlinie-export. Plak de volledige tekst, van { tot en met }.'; }
  },
  spelerPlus() { ui.nieuw.spelers.push('Speler ' + (ui.nieuw.spelers.length + 1)); },
  spelerMin() { const k = ui.nieuw.spelers.length - 1; ui.nieuw.spelers.pop(); for (const f of ui.nieuw.facties) if (f.wie === k) { f.wie = -1; f.speler = 'passief'; } },
  startCampagne() {
    const n = ui.nieuw;
    const s = nieuweCampagne({ scenarioId: n.scenarioId, naam: n.naam.trim() || campagneVan(n.scenarioId).naam, ruleset: n.ruleset, punten: n.punten, modus: n.modus, mist: n.mist, doorlopend: n.doorlopend,
      lengte: n.lengte, maxBeurten: n.maxBeurten, geenDoel: n.geenDoel, bezit: n.bezit, tafel: opslag.tafel, voorraad: opslag.voorraad, facties: n.facties.map((f) => ({ id: f.id, zijde: f.zijde, speler: f.speler, spelerNaam: f.wie >= 0 ? (n.spelers[f.wie].trim() || 'Speler ' + (f.wie + 1)) : '', doctrine: f.doctrine })) });
    opslag.campagnes[s.id] = s; bewaar(); ACT.open({ id: s.id });
  },
  tab(d) { ui.tab = d.id; ui.melding = ''; },
  zoom(d) { ui.zoom = Math.max(1, Math.min(3.5, ui.zoom + 0.5 * +d.d)); },
  regio(d) {
    if (ui.scherm === 'nieuw') { const n = ui.nieuw; if (campagneVan(n.scenarioId).sandbox) n.bezit[d.id] = n.verf; return; }
    if (ui.scherm !== 'campagne') return;
    const s = C(), fid = ui.plannend || (ui.auftrag && ui.auftrag.fid);
    ui.sel = d.id; ui.melding = '';
    if (!fid || !ui.orderType) return;
    const lijst = (s.orders[fid] || []).filter((_, i) => !(ui.auftrag && ui.auftrag.index === i));
    if (ui.orderType === 'aanval' && !ui.orderVan) {
      if (orderDoelen(s, fid, 'aanval').includes(d.id) && !lijst.some((x) => x.type === 'aanval' && x.van === d.id)) ui.orderVan = d.id;
      return;
    }
    if (ui.orderType === 'aanval' && s.regios[d.id].eigenaar === fid && orderDoelen(s, fid, 'aanval').includes(d.id)) { ui.orderVan = d.id; return; }
    if (!orderDoelen(s, fid, ui.orderType, ui.orderVan).includes(d.id)) return;
    const o = { type: ui.orderType, van: ui.orderVan, naar: d.id };
    const fout = ui.auftrag ? muteer((st) => vervangOrder(st, fid, ui.auftrag.index, o)) : muteer((st) => voegOrderToe(st, fid, o));
    if (fout) ui.melding = fout; else { ui.orderVan = null; if (ui.auftrag) { ui.auftrag = null; ui.orderType = null; } }
  },
  plan(d) { ui.plannend = d.id; ui.tab = 'beurt'; ui.sel = null; ui.undo = null; resetPlan(); },
  orderType(d) { ui.orderType = ui.orderType === d.id ? null : d.id; ui.orderVan = null; ui.melding = ''; },
  wisOrder(d) { muteer((s) => verwijderOrder(s, ui.plannend, +d.i)); },
  planKlaar() {
    const s = C(), wie = factie(s, ui.plannend).spelerNaam;
    muteer((st) => { st.klaar[ui.plannend] = true; });
    const nu = volgendePlanner(s); // volgende land van dezelfde speler: meteen door, zonder het toestel door te geven
    ui.plannend = nu && wie && factie(s, nu).spelerNaam === wie ? nu : null;
    ui.sel = null; ui.undo = null; resetPlan(); naarBoven();
  },
  onthul() { muteer((s) => onthul(s)); ui.undo = null; },
  auftrag(d) { ui.auftrag = { fid: d.id, index: +d.i }; resetPlan(); },
  auftragStop() { ui.auftrag = null; resetPlan(); },
  startGevechten() { muteer((s) => startGevechten(s)); ui.undo = null; ui.sel = null; },
  openGevecht(d) { ui.gevecht = d.id; ui.uitslag = null; naarBoven(); },
  sluitGevecht() { ui.gevecht = null; ui.uitslag = null; naarBoven(); },
  herrol() { if (ui.scherm === 'los') ui.los.rol++; else muteer((s) => herrolTerrein(s, ui.gevecht)); },
  kiesUitslag(d) { ui.uitslag.keuze = d.id; },
  bevestigUitslag() {
    const w = ui.uitslag.keuze;
    muteer((s) => voerUitslagIn(s, ui.gevecht, { winnaar: w }));
    ui.gevecht = null; ui.uitslag = null; naarBoven();
  },
  bonus(d) { muteer((s) => bonusAanval(s, d.fid, d.van, d.naar || null)); },
  eindeBeurt() { const fout = muteer((s) => eindeBeurt(s)); if (fout) ui.melding = fout; ui.sel = null; naarBoven(); },
  undo() { if (ui.undo) { opslag.campagnes[ui.cid] = JSON.parse(ui.undo); ui.undo = null; ui.gevecht = null; ui.auftrag = null; resetPlan(); bewaar(); } },
  vetNieuw(d) { const v = document.getElementById('vet-' + d.id); if (v && v.value.trim()) muteer((s) => factie(s, d.id).veteranen.push({ naam: v.value.trim().slice(0, 40), gevechten: 1 })); },
  vetPlus(d) { muteer((s) => { factie(s, d.id).veteranen[+d.i].gevechten++; }); },
  vetWeg(d) { muteer((s) => { factie(s, d.id).veteranen.splice(+d.i, 1); }); },
  tafelPreset(d) { const t = d.c === 'ct' ? C().tafel : opslag.tafel; t.b = +d.b; t.h = +d.h; t.eenheid = d.e; if (d.c === 'ct') { opslag.tafel = Object.assign({}, t); } bewaar(); },
  losNieuw() { ui.los.seed = nieuweSeed(); ui.los.rol = 0; },
  kopieerSvg(d, el) { kopieer(huidigeSvg(), el); return false; },
  downloadSvg() { download('tafelmap.svg', huidigeSvg(), 'image/svg+xml'); return false; },
  print() { window.print(); return false; },
};

// formuliervelden: data-c = doel, data-veld = sleutel
const VELD = {
  n(el, w) { const n = ui.nieuw; n[el.dataset.veld] = w; if (el.dataset.veld === 'ruleset') n.punten = RULESETS[w].punten; },
  nf(el, w) { const f = ui.nieuw.facties[+el.dataset.i]; f[el.dataset.veld] = w; if (el.dataset.veld === 'wie') f.speler = w >= 0 ? 'mens' : 'passief'; },
  ns(el, w) { ui.nieuw.spelers[+el.dataset.i] = String(w).slice(0, 30); },
  l(el, w) { const l = ui.los; l[el.dataset.veld] = w; if (el.dataset.veld === 'ruleset') l.punten = RULESETS[w].punten; if (['facA', 'periode'].includes(el.dataset.veld) && !doctrinesVoor(l.facA, l.periode).some((x) => x.id === l.docA)) l.docA = ''; if (['facV', 'periode'].includes(el.dataset.veld) && !doctrinesVoor(l.facV, l.periode).some((x) => x.id === l.docV)) l.docV = ''; },
  li(el, w) { ui.los.infra[el.dataset.veld] = w; },
  u(el, w) { ui.uitslag[el.dataset.veld] = w; return false; },
  ct(el, w) { const s = C(); s.tafel[el.dataset.veld] = el.dataset.veld === 'eenheid' ? w : Math.max(24, +w || 24); opslag.tafel = Object.assign({}, s.tafel); bewaar(); },
  ctv(el, w) { const s = C(); s.voorraad[el.dataset.veld] = Math.max(0, +w || 0); opslag.voorraad = Object.assign({}, s.voorraad); bewaar(); },
  gt(el, w) { opslag.tafel[el.dataset.veld] = el.dataset.veld === 'eenheid' ? w : Math.max(24, +w || 24); bewaar(); },
  gtv(el, w) { opslag.voorraad[el.dataset.veld] = Math.max(0, +w || 0); bewaar(); },
  spelerWissel(el, w) { muteer((s) => { const f = factie(s, el.dataset.id); f.speler = w; if (w === 'mens' && !f.spelerNaam) f.spelerNaam = 'Speler van ' + f.naam; if (s.fase === 'orders') { s.orders[f.id] = []; s.klaar[f.id] = w !== 'mens'; } }); },
  tweedeDoc(el, w) { if (w) muteer((s) => kiesTweedeDoctrine(s, el.dataset.id, w)); },
  wisselDoc(el, w) { if (w) muteer((s) => wisselDoctrine(s, el.dataset.id, 0, w)); },
};

export function startApp(el) {
  wortel = el; laad();
  wortel.addEventListener('click', (e) => {
    const k = e.target.closest('[data-a]');
    if (!k || k.disabled) return;
    const r = ACT[k.dataset.a] && ACT[k.dataset.a](k.dataset, k, e);
    if (r !== false) teken();
  });
  wortel.addEventListener('change', (e) => {
    const el2 = e.target, c = el2.dataset && el2.dataset.c;
    if (!c || !VELD[c]) return;
    let w = el2.type === 'checkbox' ? el2.checked : el2.value;
    if (el2.dataset.num || (el2.type === 'number' && c !== 'ct' && c !== 'gt' && c !== 'ctv' && c !== 'gtv')) w = +w || 0;
    if (VELD[c](el2, w) !== false) teken();
  });
  teken();
}
