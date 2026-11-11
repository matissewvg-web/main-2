/* Chrome Ledger engine, deel engine-gm.js: de GM: concepten, divisies, verhaalbogen en effecten. 7.4: de engine staat in zes bestanden die in deze volgorde laden (kern, wereld, leven, producten, gm, opslag); alles deelt dezelfde globale scope. */
/* ===================== 3.2 CONCEPTEN: jij beschrijft, de GM ontwerpt, de engine gooit ===================== */
const CONCEPT_SOORT = {product: "Product", dienst: "Dienst", abonnement: "Abonnement", netwerk: "Netwerk"};
const EFF_GRENS = {macht: [0, 3], heat: [-0.5, 1], reputation: [-0.5, 0.6], invloed: [0, 0.5], zwart: [0, 1.2], morale: [-0.3, 0.3], straat: [-0.6, 0.6], politie: [-0.6, 0.6], stad: [-0.6, 0.6], vakbond: [-0.6, 0.6], nomaden: [-0.6, 0.6]};
const cStr = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
function conceptPrompt(s, d, tekst){
  const b = Math.ceil(d.level / 2);
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie op de echte wereldkaart (taal: Nederlands, toon: droog, cynisch, corporate-noir). De CEO van ${s.player.corp_name} wil iets nieuws op de markt brengen via de divisie "${divNaam(d)}" (${d.type}, niveau ${d.level}). Zijn eigen omschrijving: "${tekst}".

Ontwerp dit als een echt ding in deze wereld, zo dicht mogelijk bij wat de CEO bedoelt. Bepaal of het een product, een dienst, een abonnement of een netwerk is; geef het een naam (gebruik de naam van de CEO als die er een noemt), een doelgroep en wat het met de wereld doet. Wees eerlijk: groot is duur en moeilijk, illegaal of gewelddadig geeft heat, iets dat mensen redt geeft reputatie. Schrijf daarnaast 2 of 3 gebeurtenissen die later met juist DIT ding kunnen gebeuren (een klant, een incident, de pers, een concurrent, de overheid), elk met 2 of 3 echte keuzes.

Regels en grenzen:
- "kost" 3-60 (M€, opzetten), "maanden" 1-6, "kwaliteit" 1-5, "moeilijkheid" 5-10: bij de lancering gooit de engine 2d6 + ${b} en moet dit getal halen (6 makkelijk, 8 gemiddeld, 10 zeer moeilijk). Moeilijkheid hoort bij hoe gewaagd het idee is, niet bij het budget: met genoeg geld is iets groots niet automatisch riskant. Hoge kwaliteit voor weinig geld kan niet.
- "markt": de soort markt waar het in concurreert, één van: wapen, medisch, implantaat, data, beveiliging, smokkel, logistiek, financieel, orbitaal, consument.
- "effecten": wat het per maand doet bij volle populariteit, alleen deze velden: macht 0..3, heat -0.5..1, reputation -0.5..0.6, invloed 0..0.5, zwart 0..1.2 (M€ zwart geld), morale -0.3..0.3, straat/politie/stad/vakbond/nomaden -0.6..0.6. Laat weg wat niet verandert.
- Gebeurtenis-opties: "kost" (M€ vooraf, 0-40) en "effect" met: cash (-30..20), heat, reputation, morale (-10..10), invloed (0..10), zwart (-20..20), factions {naam: -10..10}, populariteit (-25..25), of een kansworp {"kans": 5-95, "succes": {...}, "falen": {...}}.

Stand van de wereld (alleen voor jou): ${JSON.stringify({cash: Math.round(s.cash), heat: Math.round(s.heat), reputatie: Math.round(s.reputation), tijdperk: TIJDPERKEN[s.tijdperk || 0].naam, divisies: s.divisions.map(x => `${divNaam(x)} (${x.type} L${x.level})`), eigen_producten: (s.producten || []).map(p => p.naam), vraag: Object.fromEntries(Object.entries(s.vraag || {}).map(([k2, v]) => [k2, Math.round(v.idx)])), rivalen: s.rivals.map(r => r.name)})}

Antwoord met alleen JSON:
{"naam": "...", "soort": "product|dienst|abonnement|netwerk", "pitch": "2-4 zinnen in de stem van het hoofd R&D: wat het is en voor wie", "doelgroep": "...", "markt": "...", "kost": 12, "maanden": 3, "moeilijkheid": 7, "kwaliteit": 3, "effecten": {"reputation": 0.3}, "vraag": "welke situatie in de wereld de vraag aanjaagt", "risico": "1 zin", "gebeurtenissen": [{"van": "...", "titel": "...", "tekst": "2-3 zinnen", "opties": [{"label": "...", "uitleg": "wat het kost en doet", "kost": 0, "effect": {"reputation": 3}}]}]}`;
}
function cleanKeuzeEff(e, diep){
  const o = {}, num = (v, lo, hi) => Math.round(clamp(+v || 0, lo, hi) * 10) / 10;
  if (!e || typeof e !== "object") return o;
  if (e.kans != null && !diep){ o.kans = Math.round(clamp(+e.kans || 50, 5, 95)); o.succes = cleanKeuzeEff(e.succes, true); o.falen = cleanKeuzeEff(e.falen, true); return o; }
  if (e.cash) o.cash = num(e.cash, -30, 20);
  for (const k2 of ["heat", "reputation", "morale"]) if (e[k2]) o[k2] = num(e[k2], -10, 10);
  if (e.invloed) o.invloed = num(e.invloed, 0, 10); if (e.zwart) o.zwart = num(e.zwart, -20, 20);
  if (e.populariteit) o.populariteit = Math.round(clamp(+e.populariteit || 0, -25, 25));
  if (e.factions && typeof e.factions === "object"){ o.factions = {}; for (const [n, v] of Object.entries(e.factions)) if (["straat", "politie", "stad", "vakbond", "nomaden"].includes(n)) o.factions[n] = num(v, -10, 10); }
  if (e.tekst) o.tekst = cStr(e.tekst, 200);
  return o;
}
function cleanConcept(r, s, d){
  r = r && typeof r === "object" ? r : {};
  const kost = r1(clamp(+r.kost || 10, 3, 60)), maxKw = clamp(1 + Math.floor(kost / 8) + Math.floor(d.level / 2), 1, 5);
  const kw = Math.round(clamp(+r.kwaliteit || 2, 1, maxKw)), eff = {};
  for (const [k2, [lo, hi]] of Object.entries(EFF_GRENS)) if (r.effecten && r.effecten[k2] != null && isFinite(+r.effecten[k2]) && +r.effecten[k2] !== 0) eff[k2] = Math.round(clamp(+r.effecten[k2], lo, hi) * 10) / 10;
  const gb = (Array.isArray(r.gebeurtenissen) ? r.gebeurtenissen : []).slice(0, 3).map(g => ({van: cStr(g.van || "R&D", 60), titel: cStr(g.titel, 80), tekst: cStr(g.tekst, 500),
    opties: (Array.isArray(g.opties) ? g.opties : []).slice(0, 3).map(o => ({label: cStr(o.label, 60), uitleg: cStr(o.uitleg, 180), kost: r1(clamp(+o.kost || 0, 0, 40)), eff: cleanKeuzeEff(o.effect)})).filter(o => o.label)})).filter(g => g.titel && g.opties.length >= 2);
  return {naam: cStr(r.naam, 40) || nieuwProductNaam(s, d.type), soort: CONCEPT_SOORT[r.soort] ? r.soort : "product", pitch: cStr(r.pitch, 500), doelgroep: cStr(r.doelgroep, 80),
    markt: PRODUCT_AARD[r.markt] ? r.markt : aardVan(d.type, r.naam || ""), kost, maanden: Math.round(clamp(+r.maanden || 3, 1, 6)), doel: Math.round(clamp(Math.max(+r.moeilijkheid || 7, 3 + kw), 5, 10)), kwaliteit: kw, eff,
    vraag: cStr(r.vraag, 140), risico: cStr(r.risico, 200), gebeurtenissen: gb, divisie: divNaam(d)};
}
function conceptKansen(s, c){ const d = s.divisions.find(x => divNaam(x) === c.divisie) || {level: 1}; return devKansen(Math.ceil(d.level / 2) + ((s.crew || []).some(m => m.rol === "spindokter") ? 1 : 0), c.doel, "standaard"); }
function actConcept(s, ctx, c){
  if (!c) return {ok: false, msg: "Er ligt geen concept klaar."};
  const d = s.divisions.find(x => divNaam(x) === c.divisie); if (!d) return {ok: false, msg: "Die divisie bestaat niet meer."};
  const alle = (s.producten || []).filter(p => p.divisie === divNaam(d) && p.status !== "teruggeroepen");
  if (alle.length >= maxProducten(d)) return {ok: false, msg: `${divNaam(d)} draagt al ${maxProducten(d)} producten (inclusief de wachtrij). Haal er een uit de markt of breid de divisie uit.`};
  if ((s.producten || []).some(p => p.naam === c.naam)) return {ok: false, msg: "Die naam bestaat al."};
  const kost = r1(c.kost * (DIFF[s.player.difficulty] || 1)), bezig = alle.some(p => p.status === "ontwikkeling");
  if (bezig && alle.filter(p => p.status === "wachtrij").length >= 3) return {ok: false, msg: "De wachtrij is vol (3)."};
  if (!bezig){ if (s.cash < kost) return {ok: false, msg: `Opzetten kost €${kost}M. Niet genoeg cash.`}; s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash; }
  const p = mkProduct(s, d, c.naam, c.kwaliteit, 0);
  Object.assign(p, {maandenOverride: c.maanden, aard: c.markt, soort: c.soort, pitch: c.pitch, doelgroep: c.doelgroep, eigenEff: c.eff, doelOverride: c.doel, kostOverride: kost, gb: c.gebeurtenissen, schaal: c.kost >= 25 ? "vlag" : c.kost >= 10 ? "groot" : "klein", vraagTekst: c.vraag, risico: c.risico});
  if (bezig) p.status = "wachtrij"; else { p.status = "ontwikkeling"; p.eta = c.maanden; }
  (s.producten ??= []).push(p); prodLog(p, s, `${CONCEPT_SOORT[c.soort]} ontworpen met de GM${bezig ? " (in de wachtrij)" : ""}`);
  const K = conceptKansen(s, c);
  const msg = `${c.naam} ${bezig ? "staat in de wachtrij" : `is in ontwikkeling: €${kost}M, ${c.maanden} maand(en)`}. Bij de lancering: hit ${K.hit}%, gewoon ${K.gewoon}%, matig ${K.neutraal}%, flop ${K.flop}%, terugroepactie ${K.terug}%.`;
  addLog(s, msg); return {ok: true, msg};
}
function gbEff(e, pid){ const o = {...(e || {})}; if (o.populariteit){ o.product = {[pid]: {pop: o.populariteit}}; delete o.populariteit; } if (o.succes) o.succes = gbEff(o.succes, pid); if (o.falen) o.falen = gbEff(o.falen, pid); return o; }
async function gmConcept(divisie, tekst){
  const s = G.game, d = s && s.divisions.find(x => divNaam(x) === divisie); if (!d) return {ok: false, bericht: "Kies een divisie."};
  tekst = cStr(tekst, 600); if (tekst.length < 4) return {ok: false, bericht: "Beschrijf eerst wat je wilt maken."};
  if (!live()) return {ok: false, bericht: "De GM is niet live verbonden. Gebruik 'Handmatig', of vraag het in de Claude-chat."};
  try { const r = await G.sample.json(conceptPrompt(s, d, tekst), {modelTier: "default"}); const c = cleanConcept(r, s, d); c.vraagVan = tekst; (G.concepten ??= {})[divisie] = c; return {ok: true, bericht: `De GM heeft ${c.naam} uitgewerkt. Lees het voorstel en kies.`}; }
  catch(e){ return {ok: false, bericht: sampleErrorText(e)}; }
}

/* ===================== 3.3 DE GM ONTWERPT DIVISIES EN SCHRIJFT VERHAALBOGEN ===================== */
function cleanVerhaalEff(e, s, diep){
  const o = cleanKeuzeEff(e, diep); if (!e || typeof e !== "object") return o;
  if (o.kans != null){ o.succes = cleanVerhaalEff(e.succes, s, true); o.falen = cleanVerhaalEff(e.falen, s, true); return o; }
  const num = (v, lo, hi) => Math.round(clamp(+v || 0, lo, hi));
  if (e.product){ const p = (s.producten || []).find(x => x.naam === String(e.product)); if (p && o.populariteit){ o.product = {[p.id]: {pop: o.populariteit}}; } }
  delete o.populariteit;
  if (e.rivaal && typeof e.rivaal === "object"){ for (const [n, v] of Object.entries(e.rivaal)){ const r = s.rivals.find(x => x.name === n); const rel = typeof v === "object" ? v.relatie : v; if (r && rel) (o.rivaal ??= {})[r.name] = {relatie: num(rel, -15, 15)}; } }
  if (e.loyaliteit && typeof e.loyaliteit === "object"){ for (const [n, v] of Object.entries(e.loyaliteit)) if (s.npcs.some(x => x.name === n)) (o.loyaliteit ??= {})[n] = num(v, -15, 15); }
  return o;
}
function cleanKeuzeGM(k, s){
  k = k && typeof k === "object" ? k : {};
  const opties = (Array.isArray(k.opties) ? k.opties : []).slice(0, 3).map(o => ({label: cStr(o.label, 60), uitleg: cStr(o.uitleg, 200), kost: r1(clamp(+o.kost || 0, 0, 40)), eff: cleanVerhaalEff(o.effect, s)})).filter(o => o.label);
  return {van: cStr(k.van || "Een bekende", 60), titel: cStr(k.titel, 90), tekst: cStr(k.tekst, 700), opties};
}
/* divisie of eigen bedrijfstak in eigen woorden */
function divisiePrompt(s, tekst){
  const soorten = allTypes(s).map(t => { const x = typeOf(s, t); return `${t} (omzet ${x.rev}, kosten ${x.cost}, heat ${x.heat})`; }).join("; ");
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie op de echte wereldkaart (Nederlands, droog, cynisch, corporate-noir). De CEO van ${s.player.corp_name} wil een nieuwe divisie of bedrijfstak. Zijn eigen woorden: "${tekst}".

Kies de best passende bestaande soort, of verzin een nieuwe soort als het echt iets anders is. Bestaande soorten (per niveau per maand, M€): ${soorten}.
Voor een nieuwe soort geef je cijfers per niveau per maand: rev 5-14, cost 3-8 (rev hoogstens cost+7), heat 0-4 (legaal 0-1, grijs 2, illegaal 3-4), vol 0.1-0.5.
Geef ook het eerste product of de eerste dienst van deze divisie, en een kort openingsverhaal: iets dat gebeurt op de dag dat de divisie opent, met 2 of 3 keuzes.
Effecten van product en keuzes volgen deze grenzen. Product: kost 3-60, maanden 1-6, moeilijkheid 5-10, kwaliteit 1-5, markt (wapen, medisch, implantaat, data, beveiliging, smokkel, logistiek, financieel, orbitaal, consument), effecten per maand (macht 0..3, heat -0.5..1, reputation -0.5..0.6, invloed 0..0.5, zwart 0..1.2, morale -0.3..0.3, straat/politie/stad/vakbond/nomaden -0.6..0.6). Keuze-effecten: cash (-30..20), heat, reputation, morale (-10..10), invloed, zwart, factions {naam: -10..10}, of {"kans": 5-95, "succes": {...}, "falen": {...}}; een optie mag "kost" hebben (0-40).

Stand: ${JSON.stringify({cash: Math.round(s.cash), divisies: s.divisions.map(x => `${divNaam(x)} (${x.type} L${x.level})`), land: homeLandNaam(s), tijdperk: TIJDPERKEN[s.tijdperk || 0].naam})}

Antwoord met alleen JSON:
{"naam": "naam van de divisie", "soort": "bestaande of nieuwe soortnaam", "nieuw": false, "cijfers": {"rev": 9, "cost": 5, "heat": 1, "vol": 0.3}, "omschrijving": "2-3 zinnen in de stem van de COO", "product": {"naam": "...", "soort": "product|dienst|abonnement|netwerk", "pitch": "...", "doelgroep": "...", "markt": "...", "kost": 10, "maanden": 2, "moeilijkheid": 7, "kwaliteit": 2, "effecten": {}, "vraag": "...", "risico": "...", "gebeurtenissen": []}, "opening": {"van": "...", "titel": "...", "tekst": "...", "opties": [{"label": "...", "uitleg": "...", "kost": 0, "effect": {}}]}}`;
}
function cleanDivisie(r, s){
  r = r && typeof r === "object" ? r : {};
  const naam = cStr(r.naam, 40) || "Nieuwe divisie";
  let soort = cStr(r.soort, 30), nieuw = !typeOf(s, soort);
  if (!soort) { soort = "Logistiek"; nieuw = false; }
  const c = r.cijfers || {}, cost = clamp(+c.cost || 5, 3, 8), cijfers = {rev: r1(Math.min(clamp(+c.rev || 9, 5, 14), cost + 7)), cost: r1(cost), heat: Math.round(clamp(+c.heat || 0, 0, 4)), vol: Math.round(clamp(+c.vol || 0.3, 0.1, 0.5) * 100) / 100};
  const pseudo = {name: naam, type: soort, level: 1};
  const product = r.product ? cleanConcept(r.product, s, pseudo) : null; if (product) product.divisie = naam;
  const opening = r.opening ? cleanKeuzeGM(r.opening, s) : null;
  return {naam, soort, nieuw, cijfers: nieuw ? cijfers : typeOf(s, soort), omschrijving: cStr(r.omschrijving, 400), product, opening: opening && opening.titel && opening.opties.length >= 2 ? opening : null, vraagVan: ""};
}
async function gmDivisie(tekst){
  const s = G.game; tekst = cStr(tekst, 600); if (tekst.length < 4) return {ok: false, bericht: "Beschrijf eerst wat voor tak je wilt."};
  if (!live()) return {ok: false, bericht: "De GM is niet live verbonden. Kies hieronder een soort uit de lijst."};
  try { const r = await G.sample.json(divisiePrompt(s, tekst), {modelTier: "default"}); const c = cleanDivisie(r, s); c.vraagVan = tekst; G.divConcept = c; return {ok: true, bericht: `De GM heeft ${c.naam} uitgewerkt.`}; }
  catch(e){ return {ok: false, bericht: sampleErrorText(e)}; }
}
function actDivisieConcept(s, ctx, c){
  if (!c) return {ok: false, msg: "Er ligt geen voorstel klaar."};
  if (s.divisions.some(x => divNaam(x) === c.naam) || s.projects.some(p => p.new_name === c.naam)) return {ok: false, msg: "Die naam bestaat al."};
  if (c.nieuw && !typeOf(s, c.soort)){ const r = addCustomType(s, c.soort, c.cijfers, c.omschrijving); if (!r.ok) return {ok: false, msg: r.msg}; }
  const r = actProject(s, "divisie", {type: c.soort, naam: c.naam}); if (!r.ok) return r;
  const proj = s.projects[s.projects.length - 1]; proj.eersteProduct = c.product; proj.opening = c.opening; proj.done_msg = c.omschrijving || proj.done_msg;
  return {ok: true, msg: r.msg + (c.product ? ` Bij de opening staat ${c.product.naam} meteen in de wachtrij.` : "")};
}
function divisieOpening(s, ctx, p, d){
  if (p.eersteProduct){ const c = p.eersteProduct, q = mkProduct(s, d, c.naam, c.kwaliteit, 0);
    Object.assign(q, {status: "wachtrij", maandenOverride: c.maanden, aard: c.markt, soort: c.soort, pitch: c.pitch, doelgroep: c.doelgroep, eigenEff: c.eff, doelOverride: c.doel, kostOverride: r1(c.kost * (DIFF[s.player.difficulty] || 1)), gb: c.gebeurtenissen, schaal: c.kost >= 25 ? "vlag" : c.kost >= 10 ? "groot" : "klein"});
    if (!(s.producten || []).some(x => x.naam === q.naam)){ (s.producten ??= []).push(q); prodLog(q, s, "Eerste product van de nieuwe divisie"); } }
  if (p.opening) addKeuze(s, ctx, {soort: "opening_" + hex8(), gm: true, ...p.opening, standaard: p.opening.opties.length - 1});
}
/* verhaalbogen: de GM schrijft om de paar maanden een volgend hoofdstuk rond jouw bedrijf */
function verhaalPrompt(s){
  const V = s.verhaal || null, laatste = (s.keuzes_klaar || []).find(k => k.soort === "gmverhaal");
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie (Nederlands, droog, cynisch, corporate-noir). Schrijf het volgende hoofdstuk van een verhaal rond het bedrijf van de speler. Gebruik wat er echt is: de producten en diensten, de directie, de crew, de rivalen, de syndicaten, het nieuws. Geen losse grap: een verhaal met mensen, motieven en gevolgen.
${V && !V.klaar ? `Lopende verhaallijn: "${V.boog}". Tot nu toe: ${V.samenvatting}${laatste ? ` De CEO koos vorige keer: "${laatste.gekozen}"${laatste.uitkomst ? ` (${laatste.uitkomst})` : ""}.` : ""} Schrijf hoofdstuk ${(V.hoofdstuk || 1) + 1}. Na 3 of 4 hoofdstukken sluit je af ("laatste": true).` : "Begin een nieuwe verhaallijn die 2 tot 4 hoofdstukken duurt."}
Geef één keuze met 2 of 3 opties die echt verschillen. Effecten volgen deze grenzen: cash (-30..20), heat, reputation, morale (-10..10), invloed (0..10), zwart (-20..20), factions {straat|politie|stad|vakbond|nomaden: -10..10}, rivaal {"exacte rivaalnaam": {"relatie": -15..15}}, loyaliteit {"exacte naam directielid": -15..15}, "product": "exacte productnaam" met "populariteit": -25..25, of een kansworp {"kans": 5-95, "succes": {...}, "falen": {...}}. Een optie mag "kost" hebben (0-40).

Stand: ${JSON.stringify({bedrijf: s.player.corp_name, land: homeLandNaam(s), datum: ym(s), cash: Math.round(s.cash), heat: Math.round(s.heat), reputatie: Math.round(s.reputation), morale: Math.round(s.morale),
    producten: (s.producten || []).filter(p => p.status === "markt").map(p => ({naam: p.naam, vorm: p.soort || "product", pitch: (p.pitch || "").slice(0, 120), populariteit: p.pop})),
    directie: s.npcs.map(n => `${n.name} (${n.role}, ${impression(n)})`), crew: (s.crew || []).map(m => `${m.naam} (${m.rol})`),
    rivalen: s.rivals.map(r => `${r.name} (CEO ${r.ceo}, ${r.status}, relatie ${r.relatie})`), syndicaten: (s.gangs || []).filter(g => gangLanden(s, g).length).map(g => `${g.naam} (${g.leider}, ${g.deal || "geen afspraak"})`),
    nieuws: (s.nieuws || []).slice(0, 5).map(n => n.kop)})}

Antwoord met alleen JSON:
{"boog": "titel van de verhaallijn", "samenvatting": "1-2 zinnen: wat er tot en met dit hoofdstuk gebeurd is", "laatste": false, "keuze": {"van": "wie de mail stuurt", "titel": "...", "tekst": "3-5 zinnen", "opties": [{"label": "...", "uitleg": "wat het kost en doet", "kost": 0, "effect": {}}]}}`;
}
async function verhaalBeurt(s){
  if (!live() || !s || s.status !== "actief") return;
  const n = maandenGespeeld(s); if (n < (s.flags.volgende_verhaal ?? 3) || (s.keuzes || []).some(k => k.soort === "gmverhaal")) return;
  s.flags.volgende_verhaal = n + 2;
  try {
    const r = await G.sample.json(verhaalPrompt(s), {modelTier: "default"}); if (s !== G.game) return; const k = cleanKeuzeGM(r && r.keuze, s); if (!k.titel || k.opties.length < 2) return;
    const boog = cStr(r.boog, 80) || "Een verhaal", nieuw = !s.verhaal || s.verhaal.klaar || s.verhaal.boog !== boog;
    s.verhaal = {boog, samenvatting: cStr(r.samenvatting, 400), hoofdstuk: nieuw ? 1 : (s.verhaal.hoofdstuk || 1) + 1, klaar: !!r.laatste};
    s.flags.volgende_verhaal = n + (s.verhaal.klaar ? RI(4, 6) : RI(2, 3));
    const ctx = Ctx(); addKeuze(s, ctx, {...k, soort: "gmverhaal", gm: true, boog: `${boog} · hoofdstuk ${s.verhaal.hoofdstuk}`, standaard: k.opties.length - 1}); await persist(ctx);
    toast(`Verhaal: ${k.titel}`); render();
  } catch(e){ s.flags.volgende_verhaal = n + 2; }
}

function newGame(d){
  const zaad = zaadNorm(d.zaad) || nieuwZaad(); RNG = seeded("wereld:" + zaad);
  try { const r = newGame0(d); r.s.zaad = zaad; return r; } finally { RNG = Math.random; } }
function newGame0(d){
  const s = migrate(template()), p = s.player, ctx = Ctx();
  p.corp_name = String(d.corp_name || "Naamloos BV").trim().slice(0, 60);
  p.motto = String(d.motto || "").trim().slice(0, 120);
  p.background = String(d.background || "").trim().slice(0, 200);
  p.difficulty = DIFF[d.difficulty] ? d.difficulty : "Realistisch";
  let doctrine = (d.doctrine || []).filter(x => DT[x]);
  if (d.eigen && String(d.eigen.naam || "").trim()){
    const pr = PRESETS[d.eigen.profiel] || PRESETS.gebalanceerd, r = addCustomType(s, d.eigen.naam, pr, d.eigen.omschrijving);
    if (r.ok) doctrine = [r.naam];   /* 4.2.1: een eigen soort is je enige startdivisie */
  }
  doctrine = doctrine.slice(0, 2); if (!doctrine.length) doctrine.push("Logistiek");
  p.doctrine = doctrine.join(" + ");
  const world = genWorld();
  s.districts = clone(world.districts); s.map = clone(world.map); s.city = "Wereld";
  const home = s.districts.some(x => x.id === d.home) ? d.home : "BNL"; p.home_district = home;
  const homeCont = s.districts.find(x => x.id === home).continent;
  for (const r of [{name: "Tessera Holdings", ceo: "Helena Voss", cash: 320, aggression: 0.5, memory: [], sector: "Media & Data"}, {name: "Kovač-Ndiaye Group", ceo: "Idris Bello", cash: 380, aggression: 0.45, memory: [], sector: "Biotech"}]) if (!s.rivals.some(x => x.name === r.name)) s.rivals.push(r);
  { const bezet = new Set(); for (const r of s.rivals){ r.name = genRivaalNaam(r.sector, bezet); bezet.add(r.name); r.ceo = genCeoNaam(new Set(s.rivals.map(x => x.ceo))); r.aggression = r1(clamp(r.aggression + U(-0.12, 0.12), 0.1, 0.8) * 100) / 100; } } /* 5.7: elk spel nieuwe rivalen */
  const hoofd = doctrine.find(t => DT[t]); if (hoofd && !s.rivals.some(r => r.sector === hoofd)) s.rivals[3].sector = hoofd;
  const thuisR = s.rivals.find(r => r.sector === hoofd) || s.rivals[3];
  for (const r of s.rivals){ r.cash = RI(280, 480); r.divs = {[r.sector]: 3}; { const v = CH(SECTOR_VERWANT[r.sector] || SECTORS.filter(x => x !== r.sector)); r.divs[v] = 1; r.divReden = {[r.sector]: "kernsector", [v]: "verwante sector"}; r.sectorNet = true; } /* 8.6 */ initRival(r); geefKarakter(r); if (!r.kleur) r.kleur = RIVAL_COLORS.find(c => !s.rivals.some(x => x.kleur === c)) || "#cccccc"; }
  for (const m of Object.values(s.market)) for (const r of s.rivals) m.rivals[r.name] ??= 0;
  const pref = {Financieel: "corporate", Logistiek: "haven", Cyberware: "campus", "Media & Data": "nacht", "Private Security": "industrie", "Weapon Manufacturing": "industrie", Biotech: "campus", Smokkel: "haven"};
  const taken = new Set([home, ...s.districts.filter(x => x.neighbors.includes(home)).map(x => x.id)]);
  const usedCont = new Set([homeCont]);
  for (const r of s.rivals){
    let c = r === thuisR ? s.districts.filter(x => !taken.has(x.id) && x.continent === homeCont) : [];
    if (!c.length) c = s.districts.filter(x => !taken.has(x.id) && !usedCont.has(x.continent));
    if (!c.length) c = s.districts.filter(x => !taken.has(x.id)); if (!c.length) c = s.districts.filter(x => x.id !== home);
    const pick = c.find(x => x.arch === pref[r.sector]) || c[Math.floor(R() * c.length)]; r.hq = pick.id; taken.add(pick.id); usedCont.add(pick.continent);
  }
  for (const x of s.districts) x.control = x.id === home ? "player" : ((s.rivals.find(r => r.hq === x.id) || {}).name || "neutral");
  for (const r of s.rivals){ const hq = s.districts.find(x => x.id === r.hq), nb = (hq.neighbors || []).map(id => s.districts.find(x => x.id === id)).filter(x => x && x.control === "neutral" && x.id !== home && !(x.neighbors || []).includes(home)); if (nb.length) CH(nb).control = r.name; }
  const yr = parseInt(d.year, 10); s.date = {year: clamp(isNaN(yr) ? 2004 : yr, 1980, 2100), month: 1};
  [s.cash, s.debt] = ({krap: [80, 0], normaal: [100, 0], ruim: [150, 60]})[d.kapitaal] || [100, 0];
  const lvl = doctrine.length === 1 ? 2 : 1;
  s.divisions = doctrine.map((t, i) => { const eigen = String((i === 0 ? d.divisie_naam : i === 1 ? d.divisie_naam2 : "") || "").trim().slice(0, 40); return {name: eigen || t, type: t, level: lvl}; }); /* 6.6: een naam per divisie */
  if (s.divisions.length === 2 && s.divisions[0].name === s.divisions[1].name) s.divisions[1].name += " 2";
  const c = s.culture;
  c.slogans = String(d.slogan || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 3);
  c.layoff_policy = d.ontslag === "hard" ? "hard" : "normal";
  [c.bonus_cost, c.morale_drift] = ({geen: [0, 0], redelijk: [2, 1], royaal: [5, 2]})[d.bonus] || [0, 0];
  c.heat_decay = ({streng: 3, normaal: 2, geen_vragen: 1})[d.ethiek] ?? 2;
  c.ethics_rules = ({streng: ["Geen illegale deals", "Klokkenluiders worden beschermd"], normaal: ["Niet betrapt worden"], geen_vragen: ["Resultaat telt"]})[d.ethiek] || [];
  if (d.ethiek === "streng") s.reputation += 5;
  if (d.ethiek === "geen_vragen") shiftFaction(s, "straat", 10);
  if (c.layoff_policy === "hard") shiftFaction(s, "vakbond", -15);
  const homeArch = s.districts.find(x => x.id === home).arch; p.startbonus = START_BONUS[homeArch] ? homeArch : null; p.hq_stad = String(d.hq_stad || "").trim().slice(0, 40);
  const sb = p.startbonus;
  if (sb === "haven"){ s.schepen = 1; s.inzet = {}; const z0 = s.districts.find(x => x.id === home).zee; if (z0 && z0.length) s.inzet[z0[0]] = 1; }
  if (sb === "industrie") s.staff.count += 8;
  if (sb === "corporate"){ s.cash += 30; s.reputation += 5; }
  if (sb === "data") s.invloed = 10;
  if (sb === "nacht"){ s.reputation += 8; shiftFaction(s, "straat", 15); }
  if (sb === "sloppen"){ shiftFaction(s, "straat", 25); s.heat += 5; }
  if (sb === "markt"){ s.accounts.zwart += 10; c.heat_decay += 1; }
  if (sb === "villa"){ s.accounts.offshore += 25; s.interest_rate = 0.06; }
  s.bedrijven = genBedrijven(s); s.gangs = genGangs(s); s.nieuws = []; s.relaties = {}; s.keuzes = []; s.keuzes_klaar = [];
  s.sectoren = null; migrate13(s);
  s.crew = []; s.huurmarkt = []; s.klussen = []; s.tijdperk = 0; s.statusNiveau = statusVan(s);
  p.lengte = SPEL_LENGTE[d.lengte] ? d.lengte : "normaal"; s.flags.start_rivalen = s.rivals.map(r => r.name);
  const agr = {Casual: -0.1, Realistisch: 0, Genadeloos: 0.12}[p.difficulty] || 0; for (const r of s.rivals) r.aggression = r1(clamp(r.aggression + agr, 0.05, 0.95) * 100) / 100;
  s.stats = {piekWaarde: 0, bestePlek: 99, hits: 0, flops: 0, aanslagenAf: 0, aanslagenRaak: 0, klussen: 0, oorlogen: 0};
  { const c0 = genKandidaat(s); c0.rol = "fixer"; c0.niveau = 1; c0.trait = "trouw"; c0.loon = crewLoon(s, c0); c0.sinds = ym(s); s.crew.push(c0); }
  marktTick(s); klusTick(s); s.dreigingen = []; regioTick(s, true); startProducten(s); vraagInit(s); rivalProductInit(s);
  news(s, `Nieuwe corporatie: ${p.corp_name}`, `${p.corp_name} vestigt zich in ${s.districts.find(x => x.id === home).name}${p.hq_stad ? " (" + p.hq_stad + ")" : ""}. Doctrine: ${p.doctrine}. De concurrentie kijkt mee.`, homeCont, "markt", true);
  if (d.huisstijl && typeof d.huisstijl === "object") actHuisstijl(s, d.huisstijl); /* 5.17.1: huisstijl uit de setup */
  ceoInit(s, d); for (const r of s.rivals) r.ceoLeeftijd ??= RI(40, 66); /* 5.19 */
  { const I = {}; for (const k of Object.keys(INSTEL)) I[k] = instelNiv(k, d["inst_" + k] || "normaal"); p.instel = I; p.instelScore = instelScore(I); } /* 5.20 */
  s.setup_done = true; s.accounts.operationeel = s.cash;
  const hn = s.districts.find(x => x.id === home).name;
  mail(ctx, s, "Marta Delcourt (CFO)", "Welkom, CEO",
    `Welkom bij ${p.corp_name}.${p.motto ? " " + p.motto : ""}\n\nWe zitten in ${hn}${p.hq_stad ? ", met het hoofdkantoor in " + p.hq_stad : ""}.${p.startbonus ? ` Ons startvoordeel: ${START_BONUS[p.startbonus].naam}. ${START_BONUS[p.startbonus].uitleg}` : ""} ${s.crew[0].naam}, een fixer, staat al op de loonlijst: kijk bij Crew wat die voor ons kan doen. We verkopen nog niets: start onze eerste productlijn bij Bedrijf, of vraag de Assistent. We hebben €${s.cash}M in kas${s.debt ? ` en €${s.debt}M schuld bij de bank` : ""}, ${s.staff.count} mensen op de loonlijst en ${s.divisions.length} divisie(s): ${s.divisions.map(x => x.name).join(", ")}.\n\nElke maand stuur ik u een rapport. Lees het. De rest van uw mail is minder betrouwbaar dan ik.\n\nWat de knoppen niet kunnen, zegt u tegen de Assistent in Comms. U krijgt een voorstel met prijs en kans; u zegt ja of nee, en de dobbelsteen beslist. U kunt ook iedereen in de stad mailen of uw eigen mensen spreken.\n\n— M. Delcourt`, "HOOG");
  addLog(s, `${p.corp_name} opgericht in ${hn}. Doctrine: ${p.doctrine}. Moeilijkheid: ${p.difficulty}.`);
  return {s, ctx};
}

/* ---------- GM: effecten van een goedgekeurde opdracht, binnen grenzen ---------- */
const GM_FLAGS_REMOVABLE = ["cfo_manipuleert", "pr_lekt", "security_verkocht", "lek_intern", "transfer_onderzoek", "white_knight_schuld", "nomad_contract_gebroken"];
function applyGmEffect(s, e){
  if (!e || typeof e !== "object") return [];
  const out = [], num = (v, lo, hi) => clamp(+v || 0, lo, hi);
  if (e.cash){ const v = num(e.cash, -300, 150); s.cash = r1(s.cash + v); out.push(`cash ${v >= 0 ? "+" : ""}${v}`); }
  if (e.zwart){ const v = num(e.zwart, -150, 100); s.accounts.zwart = r1(Math.max(0, s.accounts.zwart + v)); out.push(`zwart ${v >= 0 ? "+" : ""}${v}`); }
  for (const k of ["heat", "reputation", "morale"]) if (e[k]){ const v = num(e[k], -25, 25); s[k] = clamp(s[k] + v); }
  for (const [n, v] of Object.entries(e.factions || {})) if (s.factions[n]) shiftFaction(s, n, num(v, -30, 30));
  for (const [n, v] of Object.entries(e.loyaliteit || {})){ const p = s.npcs.find(x => x.name === n); if (p) p.loyalty = clamp(p.loyalty + num(v, -40, 40)); }
  for (const [n, v] of Object.entries(e.rivaal_agressie || {})){ const r = s.rivals.find(x => x.name === n); if (r) r.aggression = r1(clamp(r.aggression + num(v, -0.3, 0.3), 0, 1) * 100) / 100; }
  for (const [n, v] of Object.entries(e.rivaal_cash || {})){ const r = s.rivals.find(x => x.name === n); if (r) r.cash = r1(Math.max(0, r.cash + num(v, -200, 100))); }
  for (const [n, t] of Object.entries(e.rivaal_geheugen || {})){ const r = s.rivals.find(x => x.name === n); if (r) remember(r, s, String(t).slice(0, 120)); }
  if (e.district && s.districts.some(d => d.id === e.district)) for (const d of s.districts) if (d.id === e.district) d.control = "player";
  for (const f of e.verwijder_flags || []) if (GM_FLAGS_REMOVABLE.includes(f)){
    delete s.flags[f];
    const ht = {cfo_manipuleert: "cfo_boeken", pr_lekt: "pr_lek", security_verkocht: "security_lek"}[f];
    if (ht) s.hidden_truth = s.hidden_truth.filter(h => h.id !== ht);
  }
  for (const n of e.ontslag || []){ const before = s.npcs.length; s.npcs = s.npcs.filter(x => x.name !== n); if (s.npcs.length < before){ s.morale = clamp(s.morale - 2); out.push(`${n} vertrokken`); } }
  if (e.nieuwe_npc && e.nieuwe_npc.name && s.npcs.length < 8){
    const q = e.nieuwe_npc; s.npcs.push({name: String(q.name).slice(0, 40), role: String(q.role || "Adviseur").slice(0, 40), loyalty: num(q.loyalty ?? 55, 0, 100), ambition: num(q.ambition ?? 50, 0, 100), secret: String(q.secret || "Onbekend.").slice(0, 160)});
  }
  if (e.lopend && e.lopend.naam){ const L = e.lopend; s.lopende_effecten.push({naam: String(L.naam).slice(0, 60), maanden: clamp(+L.maanden || 1, 1, 6), effect: {cash: num(L.cash, -20, 20), reputation: num(L.reputation, -3, 3), heat: num(L.heat, -3, 3), morale: num(L.morale, -3, 3)}}); }
  if (e.flag && /^gm_[a-z0-9_]{1,40}$/.test(e.flag)) s.flags[e.flag] = ym(s);
  if (e.divisie_upgrade){ const d = s.divisions.find(x => (x.name || x.type) === e.divisie_upgrade) || null; if (d && d.level < 12){ d.level += 1; out.push(`${d.name || d.type} naar L${d.level}`); } }
  if (e.nieuwe_divisie && e.nieuwe_divisie.name){ const nm = String(e.nieuwe_divisie.name).trim().slice(0, 40), ty = typeOf(s, e.nieuwe_divisie.type) ? e.nieuwe_divisie.type : null;
    if (ty && s.divisions.length < 8 && !s.divisions.some(x => x.name === nm)){ s.divisions.push({name: nm, type: ty, level: 1}); out.push(`nieuwe divisie ${nm}`); } }
  if (e.omzet_bonus && e.omzet_bonus.naam){ s.streams ??= []; const b = r1(clamp(+e.omzet_bonus.bedrag || 0, 0.5, 6));
    const same = s.streams.find(x => x.naam === String(e.omzet_bonus.naam).slice(0, 60));
    if (same) same.bedrag = r1(Math.min(9, same.bedrag + b * 0.6)); else if (s.streams.length < 12) s.streams.push({naam: String(e.omzet_bonus.naam).slice(0, 60), bedrag: b, sinds: ym(s)});
    out.push(`inkomstenbron +€${b}M/mnd`); }
  if (e.omzet_verlies && e.omzet_verlies.naam){ s.streams ??= []; const st0 = s.streams.find(x => x.naam === e.omzet_verlies.naam); if (st0){ st0.bedrag = r1(Math.max(0, st0.bedrag - clamp(+e.omzet_verlies.bedrag || 1, 0.5, 6))); s.streams = s.streams.filter(x => x.bedrag > 0); } }
  if (e.nieuw_product && typeof e.nieuw_product === "object"){ const np = e.nieuw_product; np.focus = DEV_FOCUS[np.focus] ? np.focus : "standaard"; const _np = np, d = s.divisions.find(x => divNaam(x) === np.divisie) || s.divisions.find(x => x.type === np.divisie) || s.divisions[0];
    if (d){ const sc = PRODUCT_SCHAAL[np.schaal] ? np.schaal : "klein", naam = String(np.naam || "").trim().slice(0, 40) || nieuwProductNaam(s, d.type);
      if (!(s.producten || []).some(p => p.naam === naam)){ const p = mkProduct(s, d, naam, 1 + Math.floor(d.level / 2) + PRODUCT_SCHAAL[sc].kw, 0); p.schaal = sc; p.focus = np.focus; p.aard = PRODUCT_AARD[np.aard] ? np.aard : aardVan(d.type, naam);
        if ((s.producten || []).some(x => x.divisie === divNaam(d) && x.status === "ontwikkeling")){ p.status = "wachtrij"; p.betaald = true; } else { p.status = "ontwikkeling"; p.eta = PRODUCT_SCHAAL[sc].maanden; }
        (s.producten ??= []).push(p); out.push(`productlijn ${naam} (${p.status === "wachtrij" ? "in de wachtrij" : "in ontwikkeling"})`); } } }
  if (e.personeel){ const v = Math.round(num(e.personeel, -50, 50)); s.staff.count = Math.max(5, s.staff.count + v); out.push(`personeel ${v >= 0 ? "+" : ""}${v}`); }
  s.accounts.operationeel = s.cash;
  return out;
}

