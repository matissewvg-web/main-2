/* Chrome Ledger engine, deel engine-producten.js: producten en economie: lineup, plannen, focus, doelen, gezondheid, vraag, contracten, adviezen. 7.4: de engine staat in zes bestanden die in deze volgorde laden (kern, wereld, leven, producten, gm, opslag); alles deelt dezelfde globale scope. */
/* ===================== 2.1 PRODUCTEN: de lineup van elke divisie ===================== */
const PRODUCT_NAMEN = {
  "Biotech": ["Regen-X huidkweek", "NeuroCalm", "Synthetisch bloed S2", "Gentherapie Kit", "Immuno-patch", "Leverkweek L4"],
  "Cyberware": ["Optiek Mk I", "Reflexbooster R7", "Subdermaal pantser", "Neurale link NL-2", "Kunsthand Pro", "Spraakchip Babel"],
  "Logistiek": ["Containerlijn Noord", "Dronekoerier D3", "Koelketen 24/7", "Expresroute", "Havenservice", "Nachtvracht"],
  "Media & Data": ["Nieuwsfeed Puls", "Advertentienet", "Datakluis", "Streamingdienst Neon", "Profielenbank", "Trendradar"],
  "Private Security": ["Objectbewaking", "Persoonsbeveiliging", "Escortdienst", "Cyberwacht", "Snelle respons", "Bunkerservice"],
  "Financieel": ["Microkrediet", "Offshore-rekening", "Risicofonds Kraken", "Valutadesk", "Polis Zorgeloos", "Cryptobewaring"],
  "Smokkel": ["Grenspakket", "Stille vracht", "Papierwerk", "Nachtroute", "Containerkoppeling", "Diplomatieke koffer"],
  "Weapon Manufacturing": ["Dienstpistool P9", "Sniper Longshot", "Pantserset Bastion", "Gevechtsdrone Horzel", "Tank Mammoet", "Gevechtsvliegtuig Valk"],
  "Orbitaal": ["Satellietdienst", "Microzwaartekracht-lab", "Orbitale opslag", "Lanceerslot"],
};
const PRODUCT_WOORDEN = [
  [/wapen|weapon|arms|gun|firearm|ammo|munitie|munition|defensi|defen[cs]e|geweer|rifle|militair|military/i, ["Pistool P9", "Smartgun S-3", "Railgun Donder", "Monodraad-mes", "Drone-geweer DG", "Pantservest K4", "Granaatwerper GL-6"]],
  [/drone/i, ["Bezorgdrone B1", "Bewakingsdrone Oog", "Zwermset 12", "Vrachtdrone Ezel", "Racedrone Spits"]],
  [/drug|pharma|medic|zorg|kliniek|clinic|health|trauma|ambulance/i, ["Pijnstiller Nul", "Slaapmiddel Zacht", "Focuspil F", "Kliniekpakket", "Stimulant Rood"]],
  [/auto|voertuig|motor|vervoer|taxi/i, ["Stadsauto Mier", "Pantserwagen", "Motor Kraai", "Robottaxi", "Vrachtwagen Os"]],
  [/voed|food|eten|drank|restaur/i, ["Synthvlees", "Eiwitreep", "Energiedrank Volt", "Algenburger", "Kweekvis"]],
  [/mode|kleding|textiel/i, ["Lichtjas", "Kogelwerend pak", "Neonlijn", "Slimme stof", "Streetlijn"]],
  [/game|entertain|muziek|film|club/i, ["VR-arena", "Neurogame", "Clubnacht", "Livestream Gloed", "Platenlabel"]],
  [/energie|stroom|solar|zon|kern/i, ["Zonnepark", "Batterijbank", "Microreactor", "Stroomabonnement", "Netbalans"]],
  [/ai|robot|software|tech/i, ["Assistent-AI", "Fabrieksrobot", "Beveiligingssoftware", "Vertaalmodel", "Robotarm R2"]],
];
const PRODUCT_SCHAAL = {
  klein: {label: "Klein product", kost: 5, maanden: 2, doel: 6, kw: 0, flop: 0},
  groot: {label: "Grote lancering", kost: 14, maanden: 3, doel: 7, kw: 1, flop: 8},
  vlag: {label: "Vlaggenschip", kost: 30, maanden: 4, doel: 8, kw: 2, flop: 15},
};
function productNamen(type){ if (PRODUCT_NAMEN[type]) return PRODUCT_NAMEN[type]; const kw = PRODUCT_WOORDEN.find(([re]) => re.test(type)); return kw ? kw[1] : ["Basis", "Pro", "Elite", "X", "Mk II", "Nova"].map(x => `${type} ${x}`); }
function nieuwProductNaam(s, type){ const used = new Set((s.producten || []).map(p => p.naam)); return productNamen(type).find(x => !used.has(x)) || `${type} ${RI(2, 9)}${CH(["00", "X", "S", "Pro"])}`; }
function mkProduct(s, d, naam, kw, pop){ return {id: "p" + hex8(), naam: naam || nieuwProductNaam(s, d.type), divisie: d.name || d.type, type: d.type, kwaliteit: clamp(Math.round(kw), 1, 5), pop: Math.round(pop), leeftijd: 0, sinds: ym(s), status: "markt", delen: [0, 1, 2].map(() => ({kwal: "standaard", eigen: true})), auto: {...(s.autoStandaard || {})}}; } /* 4.7.5: standaard alles uit de eigen fabriek */
const divNaam = d => d.name || d.type;
const opMarkt = (s, d) => (s.producten || []).filter(p => p.divisie === divNaam(d) && p.status === "markt");
const maxProducten = d => 2 + d.level;
/* 4.4.3: varianten van een product op de markt: andere prijs, onderdelen en kwaliteit; ze nemen een deel van de klanten van het origineel over */
const VARIANT = {basis: {label: "Basis", f: 0.8, delen: "goedkoop", kw: -1, tekst: "goedkoper (80%), goedkope onderdelen, kwaliteit −1: voor prijsbewuste klanten"},
  pro: {label: "Pro", f: 1.25, delen: "premium", kw: 0, tekst: "duurder (125%), premium onderdelen: voor wie op eigenschappen let"},
  elite: {label: "Elite", f: 1.6, delen: "premium", kw: 1, tekst: "veel duurder (160%), premium onderdelen, kwaliteit +1: voor de koopkrachtige top"}};
const variantKost = s => r1(PRODUCT_SCHAAL.klein.kost * 0.5 * (DIFF[s.player.difficulty] || 1));
const leegStraf = d => clamp(((d.leeg || 0) - 12) * 0.006, 0, 0.2);
function productMult(s, d){ const ps = opMarkt(s, d); if (!ps.length) return Math.round((0.95 - leegStraf(d)) * 100) / 100; return 1; }
/* 4.3: elk product levert zijn eigen omzet; productie kost een vaste prijs per stuk (PROD_KOST × de standaardprijs) */
const PROD_KOST = 0.45;
/* 4.3 stap 2: vrije prijs. prijsF = prijs ten opzichte van de standaardprijs (0,6 tot 1,8). Een duurder product verkoopt minder
   (prijsgevoeligheid per markt; hogere kwaliteit maakt klanten minder gevoelig), de kostprijs per stuk blijft gelijk. */
const ELAST = {wapen: 0.95, medisch: 0.6, implantaat: 0.85, data: 1.3, beveiliging: 0.7, smokkel: 0.75, logistiek: 1.35, financieel: 1.2, orbitaal: 0.7, consument: 1.55};
const PRIJS_F = {budget: 0.8, standaard: 1, premium: 1.35}, PRIJS_MIN = 0.6, PRIJS_MAX = 1.8;
const prijsF = p => clamp(p.prijsF ?? PRIJS_F[p.prijs || "standaard"] ?? 1, PRIJS_MIN, PRIJS_MAX);
const prijsLabel = f => f <= 0.85 ? "budget" : f >= 1.25 ? "premium" : "standaard";
const elast = p => Math.round((ELAST[p.aard || aardVan(p.type, p.naam)] ?? 1.2) * clamp(1.2 - 0.05 * (p.kwaliteit || 3), 0.9, 1.15) * 100) / 100;
/* 4.3.3: klantsegmenten. Elk soort product heeft drie groepen klanten met een eigen deel van de markt, een eigen prijsgevoeligheid (em × de basis)
   en een eigenschap waar ze op letten (index in SPECS). Een product dat op die eigenschap uitblinkt verkoopt meer in dat segment. */
const SEGMENTEN = {
  wapen: [["Legers en staten", 0.35, 0.6, 0], ["Bendes en huurlingen", 0.4, 1.2, 2], ["Particulieren", 0.25, 1.4, 1]],
  medisch: [["Ziekenhuizen", 0.45, 0.6, 1], ["Rijke particulieren", 0.3, 0.4, 2], ["Straatklinieken", 0.25, 2.0, 0]],
  implantaat: [["Corporate elite", 0.3, 0.4, 0], ["Klinieken", 0.45, 1.0, 1], ["Ripperdocs op straat", 0.25, 1.8, 2]],
  data: [["Corporaties", 0.45, 0.7, 1], ["Overheden", 0.25, 0.8, 0], ["Consumenten", 0.3, 1.6, 2]],
  beveiliging: [["Corporaties", 0.45, 0.8, 1], ["Rijke particulieren", 0.3, 0.6, 2], ["Gemeenten", 0.25, 1.4, 0]],
  smokkel: [["Syndicaten", 0.45, 0.8, 2], ["Zwarte markt", 0.35, 1.3, 1], ["Nomaden", 0.2, 1.0, 0]],
  logistiek: [["Webwinkels", 0.45, 1.4, 0], ["Industrie", 0.35, 0.8, 1], ["Overheid", 0.2, 0.7, 2]],
  financieel: [["Particulieren", 0.5, 1.3, 2], ["MKB", 0.3, 1.0, 1], ["Vermogenden", 0.2, 0.5, 0]],
  orbitaal: [["Satellietbedrijven", 0.45, 0.8, 1], ["Staten", 0.3, 0.6, 0], ["Start-ups", 0.25, 1.6, 2]],
  consument: [["Massamarkt", 0.55, 1.4, 1], ["Trendvolgers", 0.25, 0.8, 0], ["Bewuste kopers", 0.2, 0.9, 2]]};
/* 4.4: per segment telt ook hoe je scoort tegen de producten van rivalen in dezelfde markt (hun gemiddelde op die eigenschap) */
function rivaalSpecs(s, a){ return s ? s.rivals.flatMap(r => (r.producten || []).filter(x => x.aard === a).map(x => ({naam: x.naam, wie: r.name, specs: prodSpecs({id: x.naam, kwaliteit: x.kwaliteit, aard: a})}))) : []; }
function segmenten(p, s = (typeof G !== "undefined" && G.game) || null){ const a = p.aard || aardVan(p.type, p.naam), specs = prodSpecs({...p, aard: a}), gem = specs.reduce((t, x) => t + x.v, 0) / 3, E = elast(p), f = prijsF(p), RS = rivaalSpecs(s, a);
  const rows = (SEGMENTEN[a] || SEGMENTEN.consument).map(([naam, aandeel, em, v]) => { const rg = RS.length ? RS.reduce((t, x) => t + x.specs[v].v, 0) / RS.length : null, best = RS.length ? RS.reduce((b, x) => x.specs[v].v > b.specs[v].v ? x : b) : null;
    const fit = clamp(1 + (specs[v].v - gem) * 0.07, 0.75, 1.3) * (rg == null ? 1 : clamp(1 + (specs[v].v - rg) * 0.04, 0.85, 1.15)), mk = p.mkt && p.mkt.seg === (SEGMENTEN[a] || SEGMENTEN.consument).findIndex(x => x[0] === naam) ? p.mkt.f : 1, vol = aandeel * fit * mk * Math.exp(-E * em * (f - 1));
    return {naam, aandeel, em, wil: specs[v].naam, score: specs[v].v, rivaal: rg == null ? null : Math.round(rg * 10) / 10, beste: best ? {naam: best.naam, wie: best.wie, v: best.specs[v].v} : null, fit: Math.round(fit * 100) / 100, gevoelig: Math.round(E * em * 100) / 100, vol}; });
  const tot = rows.reduce((t, x) => t + x.vol, 0) || 1; for (const r of rows) r.pct = Math.round(r.vol / tot * 100); return {rows, tot}; }
const volF = p => clamp(segmenten(p).tot, 0.15, 1.6);
const prodKost = (p, omzet) => omzet * PROD_KOST * kostFactor(p) / (prijsF(p) * KANAAL[kanaalVan(p)].marge) + garantie(p, omzet); /* productie + garantie (4.5) */
function prijsProef(s, p, f){ const q = {...p, prijsF: clamp(f, PRIJS_MIN, PRIJS_MAX)}, o = prodOmzet(s, q); return {f: q.prijsF, stukPrijs: stukPrijs(q), omzet: r1(o), winst: r1(o - prodKost(q, o)), w: o - prodKost(q, o), vraag: Math.round(vraagNa(q)), cap: prodCap(s, q), churn: isAbo(q) ? Math.round(aboChurn(q) * 1000) / 10 : null}; }
function besteprijs(s, p){ let best = null; for (let f = PRIJS_MIN; f <= PRIJS_MAX + 1e-9; f += 0.05){ const x = prijsProef(s, p, Math.round(f * 100) / 100); if (!best || x.w > best.w + 1e-6) best = x; } return best; }
function prodOmzet(s, p){ const d = s.divisions.find(x => divNaam(x) === p.divisie); if (!d) return 0; return (5 + 3 * Math.pow(d.level, 0.8)) * prodGewicht(p, s) * 0.17; }
/* vraag na de prijs: losse producten verkopen minder bij een hogere prijs; bij abonnementen werkt de prijs via opzeggers en nieuwe klanten */
const vraagNa = p => isAbo(p) ? bereik(p) : bereik(p) * volF(p);
function productKans(s, d, schaal){ const sc = PRODUCT_SCHAAL[schaal]; const b = Math.ceil(d.level / 2) + ((s.crew || []).some(m => m.rol === "spindokter") ? 1 : 0); return {bonus: b, doel: sc.doel, kans: kans2d6(b, sc.doel)}; }
function actProduct(s, ctx, soort, a){
  const pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; };
  const m = ym(s), dif = DIFF[s.player.difficulty] || 1; let msg;
  if (soort === "ontwikkel"){
    const d = s.divisions.find(x => divNaam(x) === a.divisie); if (!d) return {ok: false, msg: "Kies een divisie."};
    const sc = PRODUCT_SCHAAL[a.schaal]; if (!sc) return {ok: false, msg: "Kies een schaal."};
    const alle = (s.producten || []).filter(p => p.divisie === divNaam(d) && p.status !== "teruggeroepen");
    if (alle.length >= maxProducten(d)) return {ok: false, msg: `${divNaam(d)} kan op niveau ${d.level} maximaal ${maxProducten(d)} producten dragen (inclusief de wachtrij). Haal er een uit de markt of breid de divisie uit.`};
    const focus = DEV_FOCUS[a.focus] ? a.focus : "standaard", F = DEV_FOCUS[focus], aardK = PRODUCT_AARD[a.aard] ? a.aard : null, beta = a.beta === true || a.beta === "ja", plan = devPlan(s, d, a.schaal, focus, aardK || aardVan(d.type, a.naam || ""), beta);
    const gratis = (s.gratisDev || 0) > 0, kost = gratis ? 0 : plan.kost, bezig = false; /* 4.7.11: geen wachtrij meer, alles start meteen */ /* 4.7.10: gratis ontwikkelingen */
    if (bezig){ if (alle.filter(p => p.status === "wachtrij").length >= 3) return {ok: false, msg: "De wachtrij is vol (3)."};
      const naamW = String(a.naam || "").trim().slice(0, 40) || nieuwProductNaam(s, d.type); if ((s.producten || []).some(p => p.naam === naamW)) return {ok: false, msg: "Die naam bestaat al."};
      const q = mkProduct(s, d, naamW, plan.kw, 0); q.status = "wachtrij"; q.schaal = a.schaal; q.focus = focus; q.nadruk = nadrukVan(a.nadruk); if (beta) q.beta = true; if (DEEL_KWAL[a.delen] && a.delen !== "standaard") q.delen = [0, 1, 2].map(() => ({kwal: a.delen, eigen: true})); q.aard = aardK || aardVan(d.type, naamW); if (a.vorm === "abonnement") q.soort = "abonnement"; (s.producten ??= []).push(q);
      if (gratis){ q.kostOverride = 0; s.gratisDev -= 1; }
      const msgW = `${naamW} staat in de wachtrij van ${divNaam(d)}. Het start vanzelf als het vorige product gelanceerd is; ${gratis ? `gratis (nog ${s.gratisDev} gratis)` : `dan wordt €${kost}M betaald`}.`; addLog(s, msgW); return {ok: true, msg: msgW}; }
    const naam = String(a.naam || "").trim().slice(0, 40) || nieuwProductNaam(s, d.type);
    if ((s.producten || []).some(p => p.naam === naam)) return {ok: false, msg: "Die naam bestaat al."};
    if (!pay(kost)) return {ok: false, msg: `Dit kost €${kost}M. Niet genoeg cash.`}; if (gratis) s.gratisDev -= 1;
    const p = mkProduct(s, d, naam, plan.kw, 0); p.status = "ontwikkeling"; p.eta = plan.maanden; p.schaal = a.schaal; p.focus = focus; p.nadruk = nadrukVan(a.nadruk); if (beta) p.beta = true; if (DEEL_KWAL[a.delen] && a.delen !== "standaard") p.delen = [0, 1, 2].map(() => ({kwal: a.delen, eigen: true})); p.aard = aardK || aardVan(d.type, naam); if (a.vorm === "abonnement") p.soort = "abonnement"; (s.producten ??= []).push(p);
    const K = devPlan(s, d, a.schaal, focus, p.aard, beta).kansen; prodLog(p, s, `Ontwikkeling gestart (${PRODUCT_SCHAAL[a.schaal].label.toLowerCase()}, focus ${F.label.toLowerCase()})`);
    msg = `${naam} in ontwikkeling bij ${divNaam(d)}: €${kost}M, ${plan.maanden} maanden. Bij de lancering: hit ${K.hit}%, gewoon ${K.gewoon}%, matig ${K.neutraal}%, flop ${K.flop}%, terugroepactie ${K.terug}%.`;
  } else {
    const p = (s.producten || []).find(x => x.id === a.id); if (!p) return {ok: false, msg: "Onbekend product."};
    if (soort === "campagne"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (p.actie === m) return {ok: false, msg: "Deze maand al een campagne gehad."};
      const M = MARKETING[a.mk] || MARKETING.reclame, mk = MARKETING[a.mk] ? a.mk : "reclame", k = M.kost;
      if (M.zwart){ if ((s.accounts.zwart || 0) < k) return {ok: false, msg: `Een fluistercampagne kost €${k}M zwart geld.`}; s.accounts.zwart = r1(s.accounts.zwart - k); } else if (!pay(k)) return {ok: false, msg: `${M.label} kost €${k}M.`};
      const pop = mk === "fluister" && ILLEGAAL.has(p.aard) ? 12 : M.pop; p.actie = m; p.pop = clamp(p.pop + pop, 0, 95); if (M.heat) s.heat = clamp(s.heat + M.heat);
      const si = mktSegIndex(p, M.doel), seg = si >= 0 ? (SEGMENTEN[p.aard] || SEGMENTEN.consument)[si][0] : null; if (si >= 0) p.mkt = {seg: si, f: M.f, maanden: M.maanden, kanaal: mk};
      prodLog(p, s, `${M.label}${seg ? ` (${seg.toLowerCase()})` : ""}`); msg = `${M.label} voor ${p.naam}: populariteit nu ${p.pop}${seg ? `, ${M.maanden} maanden meer afzet bij ${seg.toLowerCase()}` : ""}${M.heat ? `, heat +${M.heat}` : ""}.`; }
    else if (soort === "verbeter"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (p.kwaliteit >= 5) return {ok: false, msg: "Beter wordt het niet."}; if (p.verbetering) return {ok: false, msg: "Er loopt al een verbetering."};
      const kost = r1(8 * dif); if (!pay(kost)) return {ok: false, msg: `Een nieuwe versie kost €${kost}M.`}; p.verbetering = 2; msg = `Versie ${p.kwaliteit + 1} van ${p.naam} in ontwikkeling: €${kost}M, 2 maanden.`; }
    else if (soort === "prijs"){ const rr = actPrijs(s, p.id, a.f != null ? +a.f : a.prijs); if (rr.ok) prodLog(p, s, `Prijs: €${stukPrijs(p).toLocaleString("nl-NL")} per ${isAbo(p) ? "abonnee" : "stuk"} (${PRIJS[p.prijs].label.toLowerCase()})`); return rr; }
    else if (soort === "kanaal"){ if (!KANAAL[a.k]) return {ok: false, msg: "Onbekend kanaal."}; if (kanaalVan(p) === a.k) return {ok: false, msg: "Dat is al zo."};
      const k = p.status === "markt" ? kanaalWissel(s) : 0; if (k && !pay(k)) return {ok: false, msg: `Wisselen kost €${k}M.`}; p.kanaal = a.k; prodLog(p, s, `Verkoop via ${KANAAL[a.k].label.toLowerCase()}`);
      msg = `${p.naam} verkoopt nu via ${KANAAL[a.k].label.toLowerCase()}${k ? ` (€${k}M om over te stappen)` : ""}.${a.k === "zwart" ? " Heat +0,4 per maand; de helft van de omzet komt als zwart geld binnen." : ""}`; }
    else if (soort === "keuring"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; const st = keurStatus(p); if (st === "ok") return {ok: false, msg: "Al goedgekeurd."}; if (st === "bezig") return {ok: false, msg: "De keuring loopt al."};
      if (a.wijze === "omkopen"){ const k = omkoopKost(s), zw = (s.accounts.zwart || 0) >= k; if (zw) s.accounts.zwart = r1(s.accounts.zwart - k); else if (!pay(k)) return {ok: false, msg: `Omkopen kost €${k}M.`};
        const r = rol2d6(0, 7); addRoll(s, `Keurder omkopen voor ${p.naam}: ${r.txt} → ${r.ok ? "GELUKT" : "MISLUKT"}`);
        if (r.ok){ p.keuring = "ok"; vergunning(s, p); s.heat = clamp(s.heat + 3); prodLog(p, s, "Goedgekeurd (met een envelop)"); msg = `${keurInstantie(p)} stempelt ${p.naam} goed (${r.txt}). €${k}M${zw ? " zwart" : ""}, heat +3.`; }
        else { s.heat = clamp(s.heat + 6); s.reputation = clamp(s.reputation - 4); prodLog(p, s, "Omkoping mislukt"); msg = `De keurder weigert en praat (${r.txt}). €${k}M weg, heat +6, reputatie −4. Een officiële keuring kan nog.`; } }
      else { const k = keurKost(s); if (!pay(k)) return {ok: false, msg: `Een keuring kost €${k}M.`}; p.keuring = {maanden: 2}; prodLog(p, s, "Keuring aangevraagd"); msg = `Keuring van ${p.naam} aangevraagd bij ${keurInstantie(p)}: €${k}M, 2 maanden, ${kans2d6(0, keurDoel(p))}% kans.`; } }
    else if (soort === "variant"){ const V = VARIANT[a.v]; if (!V) return {ok: false, msg: "Onbekende variant."}; if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (p.variantVan) return {ok: false, msg: "Maak varianten van het origineel."};
      const d = s.divisions.find(x => divNaam(x) === p.divisie); if (!d) return {ok: false, msg: "Geen divisie."}; const alle = s.producten.filter(x => x.divisie === p.divisie && x.status !== "teruggeroepen");
      if (alle.length >= maxProducten(d)) return {ok: false, msg: `${p.divisie} draagt maximaal ${maxProducten(d)} producten. Haal er een uit de markt of breid de divisie uit.`};
      const naam = `${p.naam} ${V.label}`; if (s.producten.some(x => x.naam === naam)) return {ok: false, msg: "Die variant bestaat al."};
      const k = variantKost(s); if (!pay(k)) return {ok: false, msg: `Een variant kost €${k}M.`};
      const q = mkProduct(s, d, naam, clamp(p.kwaliteit + V.kw, 1, 5), 0); Object.assign(q, {status: "ontwikkeling", eta: 1, schaal: "klein", focus: "veilig", doelOverride: 5, aard: p.aard, soort: p.soort, nadruk: p.nadruk ?? null, delen: [0, 1, 2].map(() => ({kwal: V.delen, eigen: true})), prijsF: V.f, prijs: prijsLabel(V.f), variantVan: p.id, trait: p.trait ?? null});
      s.producten.push(q); prodLog(p, s, `Variant ${V.label} in ontwikkeling`); prodLog(q, s, `Variant van ${p.naam}`); msg = `${naam} in ontwikkeling: €${k}M, 1 maand. Bij de lancering neemt het klanten over van ${p.naam}.`; }
    else if (soort === "auto"){ if (!AUTO[a.k]) return {ok: false, msg: "Onbekend."}; (p.auto ??= {})[a.k] = !!a.aan && a.aan !== "0" && a.aan !== "false"; msg = `Autopilot ${p.naam}: ${AUTO[a.k].split(" (")[0].toLowerCase()} ${p.auto[a.k] ? "aan" : "uit"}.`; }
    else if (soort === "zelfmaken"){ const idx = a.i === "alle" ? delenVan(p).map((_, j) => j).filter(j => !eigenDeel(p, j)) : [+a.i].filter(j => delenVan(p)[j] && !eigenDeel(p, j));
      if (!idx.length) return {ok: false, msg: "Dat maak je al zelf."}; const k = r1(zelfKost(s) * idx.length); if (!pay(k)) return {ok: false, msg: `Zelf maken kost €${k}M (€${zelfKost(s)}M per onderdeel).`};
      const kp0 = kostPrijs(p); for (const j of idx){ leverancier(s, p, j); p.delen[j].eigen = true; p.delen[j].lev = null; } prodLog(p, s, `Eigen productie: ${idx.map(j => delenVan(p)[j][0].toLowerCase()).join(", ")}`);
      msg = `${p.naam}: ${idx.length === 1 ? delenVan(p)[idx[0]][0].toLowerCase() + " komt" : `${idx.length} onderdelen komen`} nu uit je eigen fabriek (€${k}M). Kostprijs €${kp0} → €${kostPrijs(p)} per stuk, geen leverancier meer.`; }
    else if (soort === "onderdeel"){ const i = +a.i, D = delenVan(p)[i]; if (!D || !DEEL_KWAL[a.kwal]) return {ok: false, msg: "Onbekend onderdeel."}; if (deelKwal(p, i) === a.kwal) return {ok: false, msg: "Dat is al zo."};
      const k = p.status === "markt" ? omschakelKost(s) : 0; if (k && !pay(k)) return {ok: false, msg: `Omschakelen kost €${k}M.`}; const kp0 = kostPrijs(p); leverancier(s, p, i); p.delen[i].kwal = a.kwal;
      const sp = prodSpecs(p).find(x => x.naam === (SPECS[p.aard] || SPECS.consument)[D[2]]);
      msg = `${p.naam}: ${D[0].toLowerCase()} nu ${DEEL_KWAL[a.kwal].label.toLowerCase()}${k ? ` (omschakelen €${k}M)` : ""}. Kostprijs €${kp0} → €${kostPrijs(p)} per stuk, ${sp.naam.toLowerCase()} ${sp.v}/10.`; prodLog(p, s, `${D[0]}: ${DEEL_KWAL[a.kwal].label.toLowerCase()}`); }
    else if (soort === "krimpen"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; if (prodCap(s, p) - 15 < 45) return {ok: false, msg: "Kleiner dan 45 kan niet; haal het product anders uit de markt."};
      const terug = (p.capExtra || 0) > 0 ? r1((5 + ((p.capExtra || 0) - 15) / 5) * (DIFF[s.player.difficulty] || 1)) : 0; /* een betaalde uitbreiding terugdraaien: investering terug */
      p.capExtra = (p.capExtra || 0) - 15; if (terug){ s.cash = r1(s.cash + terug); s.accounts.operationeel = s.cash; } prodLog(p, s, "Productie ingekrompen");
      msg = `Productielijn van ${p.naam} ingekrompen: capaciteit nu ${prodCap(s, p)} (vraag ${Math.round(vraagNa(p))}).${terug ? ` De €${terug}M van de uitbreiding komt terug.` : ""} Vaste kosten van de lijn nu ${capVast(s, p) >= 0 ? `€${capVast(s, p)}M` : `€${-capVast(s, p)}M bespaard`} per maand.`; }
    else if (soort === "capaciteit"){ if (p.status !== "markt") return {ok: false, msg: "Het staat niet op de markt."}; const k = capKost(s, p); if (!pay(k)) return {ok: false, msg: `Productie uitbreiden kost €${k}M.`}; p.capExtra = (p.capExtra || 0) + 15; msg = `Productielijn van ${p.naam} uitgebreid: capaciteit nu ${prodCap(s, p)} (vraag ${Math.round(vraagNa(p))}). Vaste kosten van de lijn nu €${capVast(s, p)}M per maand.`; }
    else if (soort === "loyaliteit"){ if (!isAbo(p)) return {ok: false, msg: "Alleen voor abonnementen."}; p.loyaal = !p.loyaal; msg = p.loyaal ? `Loyaliteitsprogramma voor ${p.naam}: €${loyKost(p)}M per maand, opzeggers −1,2 procentpunt.` : `Loyaliteitsprogramma van ${p.naam} gestopt.`; }
    else if (soort === "stop"){ s.producten = s.producten.filter(x => x !== p); msg = `${p.naam} is uit de markt gehaald.`; }
    else return {ok: false, msg: "Onbekende actie."};
  }
  addLog(s, msg); return {ok: true, msg};
}
/* 5.2.1: automatisch ontwikkelen per divisie: is er een vrije plek, geen ontwikkeling bezig en genoeg kas (kosten + €30M buffer), dan start de divisie zelf een product */
function autoDevTick(s, ctx){ for (const d of s.divisions){ const A = d.autoDev; if (!A || !A.aan) continue; const nm = divNaam(d), alle = (s.producten || []).filter(p => p.divisie === nm && p.status !== "teruggeroepen");
  if (alle.length >= maxProducten(d) || alle.some(p => p.status === "ontwikkeling" || p.status === "wachtrij")) continue;
  const aard = A.aard || aardVan(d.type, ""), schaal = PRODUCT_SCHAAL[A.schaal] ? A.schaal : "klein", plan = devPlan(s, d, schaal, "standaard", aard), kost = (s.gratisDev || 0) > 0 ? 0 : plan.kost;
  if (s.cash < kost + 30) continue; const r = actProduct(s, ctx, "ontwikkel", {divisie: nm, schaal, focus: "standaard", aard}); if (r.ok) ctx.rep.push(`Automatisch ontwikkelen ${nm}: ${r.msg.split(":")[0]}`); } }
function productTick(s, ctx){
  s.producten ??= []; autoDevTick(s, ctx);
  for (const d of s.divisions){ const had = (d.leeg || 0) > 12; d.leeg = opMarkt(s, d).length ? 0 : (d.leeg || 0) + 1; if (d.leeg === 13) mail(ctx, s, "Verkoop", `${divNaam(d)} verkoopt al een jaar niets`, `Klanten van ${divNaam(d)} stappen over naar rivalen die wel iets nieuws hebben. Zolang we niets op de markt hebben, zakt de omzet van deze divisie elke maand verder, tot −20%. Eén product stopt het meteen.`, "HOOG"); }
  const namen = new Set(s.divisions.map(divNaam)); s.producten = s.producten.filter(p => namen.has(p.divisie));
  for (const d of s.divisions){ const nm = divNaam(d);
    for (const q of s.producten.filter(p => p.divisie === nm && p.status === "wachtrij")){
    const sc = PRODUCT_SCHAAL[q.schaal || "klein"], F = DEV_FOCUS[q.focus || "standaard"] || DEV_FOCUS.standaard, kost = q.betaald ? 0 : q.kostOverride != null ? q.kostOverride : r1(sc.kost * (DIFF[s.player.difficulty] || 1) * (F.kost || 1) * (q.beta ? 1.2 : 1));
    if (s.cash < kost + 10){ if (!q.wachtgeld) ctx.rep.push(`${q.naam} wacht in de rij op €${kost}M`); q.wachtgeld = true; continue; }
    s.cash = r1(s.cash - kost); q.status = "ontwikkeling"; q.eta = (q.maandenOverride || Math.max(1, sc.maanden + (F.maanden || 0))) + 1 + (q.beta ? 1 : 0); delete q.wachtgeld; ctx.rep.push(`Productie gestart: ${q.naam}${kost ? ` (€${kost}M)` : ""}`); } }
  for (const p of [...s.producten]){
    const d = s.divisions.find(x => divNaam(x) === p.divisie);
    if (p.status === "wachtrij") continue;
    if (p.status === "ontwikkeling"){
      if (--p.eta > 0) continue;
      const r = lanceerWorp(s, d, p); addRoll(s, `Lancering ${p.naam}: ${r.txt} → ${r.crit ? "HIT" : r.ok ? "GELUKT" : r.neutraal ? "MATIG" : r.blunder ? "TERUGGEROEPEN" : "FLOP"}`);
      const sc = PRODUCT_SCHAAL[p.schaal || "klein"]; p.status = "markt"; p.sinds = ym(s); p.leeftijd = 0;
      if (r.crit){ (s.stats ??= {}).hits = (s.stats.hits || 0) + 1; if (r.nat) p.kwaliteit = clamp(p.kwaliteit + 1, 1, 5); p.pop = r.nat ? 85 : RI(72, 82); mail(ctx, s, "Marketing", `${p.naam} is een hit`, `De lancering van ${p.naam} (${r.txt}) overtreft alles. Wachtlijsten, recensies, kopieën op de zwarte markt binnen een week.`, "NORMAAL"); news(s, `${p.naam} van ${s.player.corp_name} is een hit`, `Het nieuwe product van ${divNaam(d)} gaat de deur uit sneller dan het gemaakt wordt.`, "", "markt", true); }
      else if (r.ok){ p.pop = RI(55, 72); mail(ctx, s, "Marketing", `${p.naam} gelanceerd`, `${p.naam} ligt in de winkels (${r.txt}). Goede start, populariteit ${p.pop}.`, "NORMAAL"); }
      else if (r.neutraal){ p.pop = RI(38, 50); mail(ctx, s, "Marketing", `${p.naam}: rustige start`, `${p.naam} ligt in de winkels (${r.txt}). Geen hit, geen flop: populariteit ${p.pop}. Een campagne kan het een duw geven.`, "NORMAAL"); }
      else if (r.blunder){ s.producten = s.producten.filter(x => x !== p); s.reputation = clamp(s.reputation - 5); const k2 = r1(sc.kost * 0.3); s.cash = r1(s.cash - k2);
        mail(ctx, s, "Juridische Zaken", `Terugroepactie: ${p.naam}`, `${p.naam} (${r.txt}) blijkt een fout te hebben die we niet mochten missen. Alles moet terug. €${k2}M aan kosten, reputatie −5, en de pers heeft foto's.`, "KRITIEK"); ctx.rep.push(`Terugroepactie ${p.naam}`); continue; }
      else { (s.stats ??= {}).flops = (s.stats.flops || 0) + 1; p.pop = RI(15, 28) + (sc.flop || 0); p.kwaliteit = Math.max(1, p.kwaliteit - 1); mail(ctx, s, "Marketing", `${p.naam} flopt`, `De lancering van ${p.naam} (${r.txt}) valt tegen: populariteit ${p.pop}. Een campagne of een nieuwe versie kan het redden. Of je haalt het uit de markt.`, "HOOG"); ctx.rep.push(`${p.naam} flopt`); }
      if (KEURING_AARD.has(p.aard || aardVan(p.type, p.naam)) && p.keuring === undefined){ const o = p.variantVan && s.producten.find(x => x.id === p.variantVan); p.keuring = "nodig"; }
      if (p.variantVan){ const o = s.producten.find(x => x.id === p.variantVan); if (o && o.status === "markt"){ p.pop = Math.round(clamp(o.pop * 0.6, 3, 95)); p.variantStart = {pop: p.pop, origineelVoor: o.pop}; o.pop = Math.round(clamp(o.pop * 0.88, 3, 95)); prodLog(o, s, `${p.naam} neemt klanten over (populariteit −12%)`); } }
      if (heeftFocus(s, "merk")) p.pop = Math.round(clamp(p.pop + 6, 3, 95));
      if (isAbo(p)) p.abo = Math.round(p.pop * 0.5);
      p.aard ??= aardVan(p.type, p.naam); p.prijs ??= "standaard"; if (p.trait === undefined){ const ft = focusTrait(p); p.trait = ft !== undefined ? ft : kiesTrait(p, r.crit, !r.ok && !r.neutraal); } maakReview(p);
      prodLog(p, s, r.crit ? `Lancering: een hit (${p.review.sterren}★)` : r.ok ? `Gelanceerd (${p.review.sterren}★)` : r.neutraal ? `Rustige lancering (${p.review.sterren}★)` : `Lancering geflopt (${p.review.sterren}★)`); if (p.trait) prodLog(p, s, `Eigenschap: ${PRODUCT_TRAITS[p.trait].label}`); continue;
    }
    keuringTick(s, ctx, p); defectTick(s, ctx, p); mktTick(p); autoTick(s, ctx, p); editieTick(s, ctx, p);
    if (p.verbetering && --p.verbetering <= 0){ delete p.verbetering; const r = rol2d6(Math.ceil(d.level / 2), 8); addRoll(s, `Nieuwe versie ${p.naam}: ${r.txt} → ${r.ok ? "GELUKT" : "MISLUKT"}`);
      if (r.ok){ p.kwaliteit = clamp(p.kwaliteit + 1, 1, 5); p.pop = clamp(p.pop + 10, 0, 95); p.leeftijd = 0; maakReview(p); if (KEURING_AARD.has(p.aard || aardVan(p.type, p.naam)) && kanaalVan(p) !== "zwart") p.keuring = "nodig"; /* 4.7.2: nieuwe editie, nieuwe keuring */ if (p.trait === "gevoelig") p.trait = null; prodLog(p, s, `Versie ${p.kwaliteit}`); mail(ctx, s, "R&D", `${p.naam} versie ${p.kwaliteit}`, `De nieuwe versie is klaar (${r.txt}). Kwaliteit ${p.kwaliteit}, en de klanten merken het.${p.keuring === "nodig" ? " Let op: een nieuwe editie moet opnieuw gekeurd worden; tot dan alleen de grijze markt." : ""}`, "NORMAAL"); }
      else mail(ctx, s, "R&D", `Nieuwe versie ${p.naam} mislukt`, `Het ontwikkelteam kreeg het niet werkend (${r.txt}). Het geld is op, het product blijft zoals het was.`, "HOOG"); }
    p.leeftijd = (p.leeftijd || 0) + 1;
    const idx = ((s.sectoren || {})[p.type] || {idx: 100}).idx, tgt = 28 + p.kwaliteit * 8 + (idx - 100) / 3 - Math.max(0, p.leeftijd - 24) * (p.trait === "verslavend" || p.soort === "abonnement" ? 0.25 : 0.8) + ((((s.vraag || {})[p.aard] || {}).idx || 100) - 100) / 6;
    p.pop = Math.round(clamp(p.pop + (tgt - p.pop) * 0.08 + U(-2, 2), p.trait === "cult" ? 35 : 3, 95));
    if (isAbo(p)) aboTick(s, p, ctx);
    if (p.trait === "gevoelig" && p.leeftijd % 3 === 0 && !p.verbetering) p.pop = Math.max(3, p.pop - 5);
  }

}
function startProducten(s){ s.producten = []; }

/* ===================== 2.1 DOELWIT: fixers en huurlingen die op jou worden gezet ===================== */
const DREIG = [
  {id: "sabotage", label: "sabotage", door: "huurlingen", w: 3},
  {id: "data", label: "datadiefstal", door: "een netrunner", w: 3},
  {id: "ontvoering", label: "ontvoering", door: "huurlingen", w: 1.5, when: s => (s.crew || []).some(m => crewStatus(s, m) === "vrij" || crewStatus(s, m) === "bezig")},
  {id: "omkoping", label: "omkoping van je crew", door: "een fixer", w: 1.5, when: s => (s.crew || []).some(m => m.loyaliteit < 55 && m.trait !== "trouw")},
  {id: "rd", label: "inbraak bij R&D", door: "een fixer", w: 2, when: s => (s.producten || []).some(p => p.status === "ontwikkeling" || p.verbetering) || s.projects.length},
  {id: "smaad", label: "lastercampagne", door: "een fixer", w: 2},
];
function verdediging(s, t){
  const cr = (s.crew || []).filter(m => ["vrij", "bezig"].includes(crewStatus(s, m)));
  let v = Math.floor(playerPower(s) / 25) + (t && t.extra || 0);
  if (cr.some(m => m.rol === "huurling")) v += 1;
  if (t && t.type === "data" && cr.some(m => m.rol === "netrunner")) v += 1;
  if (t && t.type === "smaad" && cr.some(m => m.rol === "spindokter")) v += 1;
  if (t && t.type === "omkoping" && cr.some(m => m.rol === "speurder")) v += 1;
  return v;
}

/* ===================== 3.8 PLANNEN: rivalen en syndicaten die over maanden iets tegen je opbouwen ===================== */
const PLAN_SOORT = {
  prijsoorlog: {titel: (w) => `${w} bereidt een prijsoorlog voor`, stappen: ["koopt stilletjes leveranciers op", "werft verkopers weg bij concurrenten", "dumpt de prijzen"], eindTekst: "4 maanden minder omzet en je producten verliezen populariteit",
    eind(s, p, f){ (s.lopende_effecten ??= []).push({naam: `Prijsoorlog van ${p.wie}`, maanden: 4, effect: {cash: -r1(4 * omvang(s) * f)}}); for (const x of (s.producten || []).filter(x => x.status === "markt")) x.pop = Math.round(clamp(x.pop - 8 * f, 3, 95)); return `${p.wie} dumpt de prijzen: vier maanden lang verliezen we omzet en klanten.`; }},
  personeel: {titel: (w) => `${w} wil je mensen`, stappen: ["brengt je teams in kaart", "doet aanbiedingen onder de tafel", "haalt een heel team weg"], eindTekst: "je verliest personeel, morale en loyaliteit van je directie",
    eind(s, p, f){ const n = Math.max(2, Math.round(s.staff.count * 0.1 * f)); s.staff.count = Math.max(5, s.staff.count - n); s.morale = clamp(s.morale - 6 * f); const np = s.npcs[0]; if (np) np.loyalty = clamp(np.loyalty - 15 * f); return `${p.wie} heeft ${n} mensen weggekocht. De rest kijkt rond.`; }},
  laster: {titel: (w) => `${w} bouwt een lastercampagne`, stappen: ["verzamelt vuil over je bedrijf", "benadert journalisten", "publiceert"], eindTekst: "reputatie omlaag, heat omhoog",
    eind(s, p, f){ s.reputation = clamp(s.reputation - 8 * f); s.heat = clamp(s.heat + 4 * f); (s.lopende_effecten ??= []).push({naam: `Laster van ${p.wie}`, maanden: 2, effect: {reputation: -1 * f}}); return `De artikelen staan online. ${p.wie} ontkent alles, met een glimlach.`; }},
  contract: {titel: (w, b) => `${w} wil je contract met ${b}`, stappen: ["praat met je contractpartner", "biedt meer dan jij", "neemt het contract over"], eindTekst: "je verliest een leveringscontract",
    eind(s, p, f){ const st = (s.streams || []).find(x => x.naam === "Contract " + p.doel); if (!st || f < 1){ if (f < 1) return `${p.doel} bleef bij ons, omdat we op tijd beter boden. Het kostte wel wat goodwill bij ${p.wie}.`; return PLAN_SOORT.laster.eind(s, p, f); }
      s.streams = s.streams.filter(x => x !== st); const b = (s.bedrijven || []).find(x => x.naam === p.doel); if (b){ b.contract = false; b.relatie = Math.round(clamp(b.relatie - 20, -100, 100)); } return `${p.doel} levert voortaan aan ${p.wie}. Ons contract (€${st.bedrag}M per maand) is weg.`; }},
  sabotage: {titel: (w) => `${w} plant een aanslag op je depots`, stappen: ["verkent je depots", "koopt een bewaker om", "slaat toe"], eindTekst: "cash weg en je beste product raakt beschadigd",
    eind(s, p, f){ const k = r1(10 * omvang(s) * f); s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; s.heat = clamp(s.heat + 2); const best = (s.producten || []).filter(x => x.status === "markt").sort((a, b) => b.pop - a.pop)[0]; if (best) best.pop = Math.round(clamp(best.pop - 15 * f, 3, 95));
      return `Brand in een depot. €${k}M schade${best ? `, en ${best.naam} ligt een maand niet in de winkels` : ""}.`; }},
};
function planKansOntdekt(s){ return clamp(0.2 + ((s.crew || []).some(m => ["speurder", "fixer"].includes(m.rol) && crewStatus(s, m) !== "opgepakt") ? 0.3 : 0) + (relV(s, "fixer") >= 30 ? 0.15 : 0), 0, 0.8); }
function planStart(s, ctx, diff){
  if ((s.plannen ??= []).length || maandenGespeeld(s) < 8 || R() > 0.07 * diff) return;
  const riv = s.rivals.filter(r => r.status === "oorlog" || (r.relatie || 0) < -10 || r.aggression > 0.6), gangs = (s.gangs || []).filter(g => g.deal === "oorlog" || g.relatie < -30);
  const opties = [...riv.map(r => [{r}, 2]), ...gangs.map(g => [{g}, 1])]; if (!opties.length) return;
  const o = wpick(opties); let soort, wie, doel = null;
  if (o.g){ soort = "sabotage"; wie = o.g.naam; }
  else { wie = o.r.name; const contract = (s.streams || []).find(x => /^Contract /.test(x.naam)); soort = CH(["prijsoorlog", "personeel", "laster", ...(contract ? ["contract"] : [])]); if (soort === "contract") doel = contract.naam.slice(9); }
  const T = PLAN_SOORT[soort];
  s.plannen.push({id: "pl" + hex8(), soort, wie, doel, gang: !!o.g, titel: T.titel(wie, doel), stappen: T.stappen.slice(), stap: 0, volgende: plusMonths(s, 2), ontdekt: false, sinds: ym(s)});
}
function planTick(s, ctx, diff){
  planStart(s, ctx, diff);
  for (const p of [...(s.plannen || [])]){
    if (p.volgende > ym(s)) continue;
    p.stap += 1; p.volgende = plusMonths(s, 2);
    if (p.stap >= p.stappen.length){
      const f = p.zacht ? 0.5 : 1, txt = PLAN_SOORT[p.soort].eind(s, p, f); s.plannen = s.plannen.filter(x => x !== p);
      const r = s.rivals.find(x => x.name === p.wie); if (r) remember(r, s, `${p.titel}: uitgevoerd`);
      mail(ctx, s, p.ontdekt ? "Head of Security" : "Anoniem", p.ontdekt ? `${p.titel}: het is zover` : `Te laat ontdekt: ${p.titel}`, `${txt}${p.zacht ? " We waren voorbereid: het had erger kunnen zijn." : ""}${p.ontdekt ? "" : " Niemand had het zien aankomen. Een speurder of fixer in je crew hoort zulke dingen eerder."}`, "HOOG");
      ctx.rep.push(`Plan uitgevoerd: ${p.titel}`); continue; }
    if (!p.ontdekt && R() < planKansOntdekt(s)){
      p.ontdekt = true; const kosten = r1(5 * omvang(s)), kans = snapKans(clamp(45 + ((s.crew || []).some(m => m.rol === "huurling") ? 10 : 0) + ((s.crew || []).some(m => m.rol === "speurder") ? 10 : 0) + (relV(s, "fixer") >= 30 ? 10 : 0), 20, 85));
      addKeuze(s, ctx, {soort: "plan_" + p.id, van: "Je crew", titel: `Ontdekt: ${p.titel}`, tekst: `${p.wie} is bezig. Stap ${p.stap} van ${p.stappen.length}: ${p.stappen[p.stap - 1]}. Volgende stap: ${p.stappen[p.stap]}. Als het plan slaagt: ${PLAN_SOORT[p.soort].eindTekst}.${p.gm && p.motief ? " Waarom: " + p.motief : ""}`, opties: [
        {label: `Verstoren · €${kosten}M`, kost: kosten, uitleg: `Kans ${kans}% dat het plan stopt. Mislukt het, dan weten ze dat we het weten: heat +3 en ze versnellen.`, eff: {kans, succes: {plan: {id: p.id, actie: "stop"}}, falen: {heat: 3, plan: {id: p.id, actie: "haast"}}}},
        {label: "Voorbereiden · €3M", kost: 3, uitleg: "Het plan gaat door, maar de klap is half zo groot.", eff: {plan: {id: p.id, actie: "zacht"}}},
        {label: "Laten gebeuren", uitleg: `Gratis. Over ${2 * (p.stappen.length - p.stap)} maanden: ${PLAN_SOORT[p.soort].eindTekst}.`, eff: {}}], standaard: 2}); }
  }
}
function planActie(s, o, out){
  const p = (s.plannen || []).find(x => x.id === o.id); if (!p) return;
  if (o.actie === "stop"){ s.plannen = s.plannen.filter(x => x !== p); const r = s.rivals.find(x => x.name === p.wie); if (r){ remember(r, s, `${p.titel}: verstoord door de speler`); relShift(r, -5); } out.push(`${p.titel}: verstoord. ${p.wie} moet opnieuw beginnen.`); }
  else if (o.actie === "zacht"){ p.zacht = true; out.push("We zijn voorbereid: de klap wordt half zo groot."); }
  else if (o.actie === "haast"){ p.volgende = ym(s); out.push(`${p.wie} weet dat we het weten en versnelt.`); }
}
function planPrompt(s, p){
  return `Je bent de Game Master van CHROME LEDGER (Nederlands, droog, cynisch, corporate-noir). ${p.wie} ${p.gang ? "(een syndicaat)" : "(een rivaliserende corporatie)"} begint een plan tegen ${s.player.corp_name}. Het soort plan ligt vast: ${p.soort} (${PLAN_SOORT[p.soort].eindTekst}). Schrijf er een geloofwaardige titel bij, ${p.stappen.length} korte stappen (3-8 woorden, wat ze doen) en een motief van 1 zin, passend bij wat ze over de speler onthouden.
Context: ${JSON.stringify({rivaal_geheugen: ((s.rivals.find(r => r.name === p.wie) || {}).memory || []).slice(-4), speler_producten: (s.producten || []).filter(x => x.status === "markt").map(x => x.naam).slice(0, 5), doel: p.doel})}
Antwoord met alleen JSON: {"titel": "...", "stappen": ["...", "...", "..."], "motief": "..."}`;
}
async function planGM(s){
  if (!live()) return; const p = (s.plannen || []).find(x => !x.gm); if (!p) return; p.gm = true;
  try { const r = await G.sample.json(planPrompt(s, p), {modelTier: "quick"}); if (s !== G.game) return;
    if (r && cStr(r.titel, 90)) p.titel = cStr(r.titel, 90);
    if (r && Array.isArray(r.stappen) && r.stappen.length === p.stappen.length) p.stappen = r.stappen.map((x, i) => cStr(x, 80) || p.stappen[i]);
    if (r && r.motief) p.motief = cStr(r.motief, 200); await persist(Ctx()); }
  catch(e){ foutLog("plan door de GM", e); }
}

/* ===================== 3.10 BEDRIJFSFOCUS: eens per jaar een strategiedag, één vaste koers erbij ===================== */
const FOCUS = {
  lean: {naam: "Lean", tekst: "Alle vaste kosten −5%."},
  juristen: {naam: "Juristen in huis", tekst: "Divisies trekken 10% minder heat."},
  merk: {naam: "Merkbouwer", tekst: "Lanceringen starten 6 punten populairder."},
  talent: {naam: "Talentmagneet", tekst: "De loyaliteit van je directie blijft hoger (+5 doel)."},
  rd: {naam: "Snelle R&D", tekst: "Nieuwe producten zijn een maand eerder klaar (minimaal 1)."},
  abo: {naam: "Abonnementshuis", tekst: "Opzeggers −0,6 procentpunt per maand op elk abonnement."},
  kas: {naam: "Huisbankier", tekst: "Rente op je schuld −2 procentpunt."},
};
const heeftFocus = (s, id) => (s.focus || []).includes(id);
function focusTick(s, ctx){
  const mg = maandenGespeeld(s); if (mg < 12 || mg % 12 !== 0 || (s.keuzes || []).some(k => k.soort === "focus")) return;
  const vrij = Object.keys(FOCUS).filter(k => !heeftFocus(s, k)); if (!vrij.length) return;
  const keus = []; while (keus.length < Math.min(3, vrij.length)){ const k = CH(vrij); if (!keus.includes(k)) keus.push(k); }
  addKeuze(s, ctx, {soort: "focus", van: "Raad van Bestuur", titel: "Strategiedag: welke koers houden we vast?", tekst: `Eens per jaar kiest de raad één koers die blijft. Je hebt er nu ${(s.focus || []).length}${(s.focus || []).length ? ": " + s.focus.map(k => FOCUS[k].naam).join(", ") : ""}. Kies er een bij.`,
    opties: keus.map(k => ({label: FOCUS[k].naam, uitleg: FOCUS[k].tekst + " Blijvend.", eff: {focus: k}})), standaard: 0});
}
function dreigTick(s, ctx, diff){
  s.dreigingen ??= [];
  for (const t of [...s.dreigingen]) if (t.maand <= ym(s)) resolveDreiging(s, ctx, t, diff);
  const vijand = s.rivals.filter(r => r.status === "oorlog" || r.relatie < -30), gangs = (s.gangs || []).filter(g => g.deal === "oorlog");
  const p = 0.025 + 0.035 * vijand.length + 0.035 * gangs.length + (s.statusNiveau || 0) * 0.02 + (s.heat > 50 ? 0.03 : 0);   /* 4.2.1: minder aanslagen */
  if (maandenGespeeld(s) < 3 || R() > p * diff) return;
  const kandidaten = [...vijand.map(r => [{soort: "rivaal", r}, 3]), ...gangs.map(g => [{soort: "gang", g}, 2]), ...s.rivals.filter(r => !vijand.includes(r)).map(r => [{soort: "rivaal", r}, 0.5]), [{soort: "onbekend"}, 1]];
  const o = wpick(kandidaten), ty = wpick(DREIG.filter(x => !x.when || x.when(s)).map(x => [x, x.w]));
  const van = o.soort === "rivaal" ? o.r.name : o.soort === "gang" ? o.g.naam : "een onbekende opdrachtgever";
  const kracht = o.soort === "rivaal" ? clamp(Math.round(rivalPower(s, o.r) / 18), 1, 5) : o.soort === "gang" ? clamp(Math.round(gangKracht(o.g) / 14), 1, 5) : RI(1, 3);
  const t = {id: "d" + hex8(), type: ty.id, label: ty.label, door: ty.door, van, kracht, maand: plusMonths(s, 1)};
  const crewIntel = (s.crew || []).some(m => ["speurder", "fixer"].includes(m.rol) && crewStatus(s, m) !== "opgepakt");
  const warn = crewIntel ? 0.65 : 0.2 + (relV(s, "fixer") >= 30 ? 0.3 : 0);
  if (R() < warn){
    s.dreigingen.push(t); const af = r1(3 * kracht * diff), doel0 = 8 + verdediging(s, t);
    addKeuze(s, ctx, {soort: "dreig_" + t.id, van: crewIntel ? "Je crew" : "Zes (fixer)", titel: `Er is een opdracht op ons gezet`,
      tekst: `Via via: ${van} heeft ${ty.door} ingehuurd voor ${ty.label} tegen ons. Het gebeurt volgende maand. Hun sterkte: ${kracht}. Nu moeten ze 2d6+${kracht} ≥ ${doel0} gooien (${kans2d6(kracht, doel0)}% kans).`, opties: [
      {label: "Crew en beveiliging klaarzetten", uitleg: `Gratis. Verdediging +2 (hun kans ${kans2d6(kracht, doel0 + 2)}%).`, eff: {dreiging: {id: t.id, extra: 2}, tekst: "Iedereen weet wat er komt."}},
      {label: "Extra beveiliging · €4M", kost: 4, uitleg: `Verdediging +3 (hun kans ${kans2d6(kracht, doel0 + 3)}%).`, eff: {dreiging: {id: t.id, extra: 3}, tekst: "Extra ploegen, extra camera's, een paar honden."}},
      {label: `De opdracht afkopen · €${af}M`, kost: af, uitleg: "Via een fixer de klus overbieden. Het gaat niet door.", eff: {dreiging: {id: t.id, annuleer: true}, tekst: "De huurlingen hebben een betere aanbieding gekregen. Van ons."}},
      {label: "Niets doen", uitleg: `Hun kans blijft ${kans2d6(kracht, doel0)}%.`, eff: {}}], standaard: 3});
  } else { t.verrassing = true; resolveDreiging(s, ctx, t, diff); }
}
function resolveDreiging(s, ctx, t, diff){
  s.dreigingen = (s.dreigingen || []).filter(x => x.id !== t.id);
  s.keuzes = (s.keuzes || []).filter(k => k.soort !== "dreig_" + t.id);
  const doel = 8 + verdediging(s, t), r = rol2d6(t.kracht, doel);
  addRoll(s, `Aanslag (${t.label}) in opdracht van ${t.van}: ${r.txt} → ${r.ok ? "RAAK" : "AFGESLAGEN"}`);
  const rv = s.rivals.find(x => x.name === t.van);
  if (!r.ok){
    (s.stats ??= {}).aanslagenAf = (s.stats.aanslagenAf || 0) + 1;
    if (rv){ relShift(rv, -5); remember(rv, s, `${t.label} tegen de speler mislukte`); }
    for (const m of (s.crew || []).filter(m => m.rol === "huurling" && crewStatus(s, m) !== "opgepakt")) m.xp += 1;
    mail(ctx, s, "Head of Security", `Aanslag afgeslagen: ${t.label}`, `${t.door[0].toUpperCase() + t.door.slice(1)}, ingehuurd door ${t.van}, probeerden ${t.label}. Hun worp: ${r.txt}. Onze verdediging hield.${t.verrassing ? " We zagen het niet aankomen, en toch." : ""}`, "HOOG");
    ctx.rep.push(`Aanslag van ${t.van} afgeslagen`); return;
  }
  let txt;
  if (t.type === "sabotage"){ const l = r1(RI(4, 10) * diff * clamp(omvang(s), 0.5, 3)); s.cash = r1(s.cash - l); const pr = CH((s.producten || []).filter(p => p.status === "markt")); if (pr) pr.pop = Math.max(3, pr.pop - 10);
    txt = `Brand in een productiehal: €${l}M schade${pr ? `, en ${pr.naam} is een maand slecht leverbaar (populariteit −10)` : ""}.`; }
  else if (t.type === "data"){ const d = CH(s.divisions); const l = r1(RI(2, 5)); s.cash = r1(s.cash - l); if (d && s.market[d.type]) s.market[d.type].player *= 0.9; if (rv && d && s.market[d.type]) s.market[d.type].rivals[rv.name] = (s.market[d.type].rivals[rv.name] || 0) + 0.02;
    txt = `Klantdata en ontwerpen van ${d ? divNaam(d) : "het bedrijf"} zijn gestolen. Marktaandeel −10%, €${l}M aan herstel.`; }
  else if (t.type === "ontvoering"){ const m = CH((s.crew || []).filter(x => ["vrij", "bezig"].includes(crewStatus(s, x)))); if (m){ m.uit = plusMonths(s, 2); m.uitReden = "ontvoerd"; m.loyaliteit = clamp(m.loyaliteit - 10);
      const lg = r1(4 + m.niveau * 2);
      addKeuze(s, ctx, {soort: "losgeld_" + m.id, van: "Onbekend nummer", titel: `${m.naam} is ontvoerd`, tekst: `We hebben ${m.naam}. €${lg}M en je krijgt je mens terug, heel. Anders over twee maanden, misschien.`, opties: [
        {label: `Losgeld · €${lg}M`, kost: lg, uitleg: "Meteen terug, loyaliteit +15.", eff: {crew_vrij: m.id, tekst: `${m.naam} is terug, met een verhaal.`}},
        {label: "Wachten", uitleg: "Twee maanden kwijt, loyaliteit −15.", eff: {crew_loy: {[m.id]: -15}}}], standaard: 1});
      txt = `${m.naam} is van straat geplukt.`; } else { s.morale = clamp(s.morale - 3); txt = "Een poging tot ontvoering op het hoofdkantoor. Iedereen is bang. Morale −3."; } }
  else if (t.type === "omkoping"){ const m = (s.crew || []).filter(x => x.loyaliteit < 55 && x.trait !== "trouw").sort((a, b) => a.loyaliteit - b.loyaliteit)[0];
    if (m){ s.crew = s.crew.filter(x => x !== m); txt = `${m.naam} (${CREW_ROLLEN[m.rol].label}) is omgekocht en vertrokken${rv ? ` naar ${rv.name}` : ""}.`; } else { txt = "Ze probeerden je crew om te kopen. Niemand ging mee, deze keer."; } }
  else if (t.type === "rd"){ const p = (s.producten || []).find(x => x.status === "ontwikkeling" || x.verbetering);
    if (p){ if (p.status === "ontwikkeling") p.eta += 2; else p.verbetering += 2; txt = `Inbraak bij R&D: de plannen van ${p.naam} zijn gestolen en het werk ligt twee maanden terug.`; }
    else { const pj = s.projects[0]; if (pj){ pj.eta_months += 1; txt = `Inbraak bij een bouwproject: ${pj.name} loopt een maand vertraging op.`; } else { s.cash = r1(s.cash - 4); txt = "Inbraak bij R&D: €4M aan apparatuur weg."; } } }
  else { s.reputation = clamp(s.reputation - 5); txt = "Een lastercampagne: anonieme dossiers, nepinterviews, een hashtag. Reputatie −5."; }
  (s.stats ??= {}).aanslagenRaak = (s.stats.aanslagenRaak || 0) + 1;
  if (rv) remember(rv, s, `liet ${t.label} uitvoeren tegen de speler`);
  mail(ctx, s, "Head of Security", `Aanslag: ${t.label}`, `${txt}\n\nUitgevoerd door ${t.door}, in opdracht van ${t.van}. Hun worp: ${r.txt}.${t.verrassing ? " We zagen het niet aankomen: met een speurder of fixer in je crew hoor je dit soort dingen vaker van tevoren." : ""}`, "KRITIEK");
  ctx.rep.push(`Aanslag (${t.label}) door ${t.van}`);
}

/* ===================== 2.1 PROJECTEN KUNNEN MISLUKKEN ===================== */
function projectDoel(s){ return 5 + (s.heat > 50 ? 1 : 0) + (s.morale < 40 ? 1 : 0); }
function projectRisico(s){ const d = projectDoel(s); return {vertraging: 100 - kans2d6(0, d) - 3, mislukt: 3, doel: d}; }
function migrate21(s){
  if (!s.player || !s.districts || !s.setup_done) return;
  s.dreigingen ??= [];
  if (!s.producten){ startProducten(s); }
}

/* ===================== 2.2 DOEL, SCORE EN EINDE ===================== */
const SPEL_LENGTE = {kort: {label: "10 jaar", maanden: 120}, normaal: {label: "20 jaar", maanden: 240}, eindeloos: {label: "Eindeloos", maanden: 0}};
const WIN_WAARDE = 8000, HEG_PCT = 60, HEG_N = 3, RIVAAL_DOEL = 3, CZ_PCT = 60; /* 6.3: corporate zone */
const WIN_LENGTE = {kort: 0.9, normaal: 1.55, eindeloos: 2.1}; /* 5.0: was 0,8 / 1,38 / 1,9; het spel was na de kostenverlagingen te makkelijk. 5.6.1: hoger (1,8) testte geen verschil, dus zo gelaten */
const winWaardeVoor = lengte => Math.round(WIN_WAARDE * (WIN_LENGTE[lengte] || 1) / 100) * 100;
const winWaarde = s => Math.round(winWaardeVoor(s.player.lengte) * inst(s, "winst") / 100) * 100;
const RIVAAL_MULT = {Casual: 0.85, Realistisch: 1, Genadeloos: 1.2};
const SCORE_MULT = {Casual: 0.8, Realistisch: 1, Genadeloos: 1.4};
const spelLengte = s => (SPEL_LENGTE[s.player.lengte] || SPEL_LENGTE.normaal).maanden;
function contPcts(s){ return regionDominance(s).map(r => ({naam: r.naam, pct: (r.shares.find(x => x.o === "player") || {}).pct || 0})).sort((a, b) => b.pct - a.pct); }
function rivalenWeg(s){ const st = s.flags.start_rivalen || []; return {weg: st.filter(n => !s.rivals.some(r => r.name === n)).length, van: st.length}; }
function doelen(s){
  const w = playerValue(s), WW = winWaarde(s), cp = contPcts(s), heg = cp.filter(c => c.pct >= HEG_PCT).length, rw = rivalenWeg(s), RD = Math.min(RIVAAL_DOEL, rw.van), L = spelLengte(s), n = maandenGespeeld(s);
  const out = [
    {id: "economisch", naam: "Economische overwinning", tekst: `Bedrijfswaarde van €${WW}M`, pct: Math.round(clamp(w / WW * 100, 0, 100)), klaar: w >= WW, nu: `€${Math.round(w)}M`},
    {id: "hegemonie", naam: "Hegemonie", tekst: `${HEG_PCT}% of meer op ${HEG_N} continenten`, pct: Math.round(clamp(cp.slice(0, HEG_N).reduce((a, c) => a + Math.min(HEG_PCT, c.pct), 0) / (HEG_PCT * HEG_N) * 100, 0, 100)), klaar: heg >= HEG_N, nu: cp.slice(0, 3).map(c => `${c.naam} ${c.pct}%`).join(", ")},
    {id: "uitschakeling", naam: "Marktmeester", tekst: `${RD} van de ${rw.van} oorspronkelijke rivalen uitgeschakeld (overgenomen, failliet of kapotgemaakt)`, pct: RD ? Math.round(clamp(rw.weg / RD, 0, 1) * 100) : 0, klaar: RD > 0 && rw.weg >= RD, nu: `${rw.weg} van ${RD}`},
  ];
  { const thuis = (s.districts.find(x => x.id === s.player.home_district) || {}).continent, sp = spanningVan(s, thuis), aand = (cp.find(c => c.naam === thuis) || {}).pct || 0; /* 6.3: corporate zone */
    out.push({id: "corpzone", naam: "Corporate zone", tekst: `${thuis} wordt een corporate zone (spanning 90+) en jij hebt er ${CZ_PCT}% of meer`, pct: Math.round(clamp(Math.min(sp / 90, aand / CZ_PCT), 0, 1) * 100), /* 6.4: de zwakste voorwaarde telt */ klaar: sp >= 90 && aand >= CZ_PCT, nu: `spanning ${Math.round(sp)}, aandeel ${aand}%`}); }
  if (L) out.push({id: "termijn", naam: "Einde van de termijn", tekst: `Na ${L / 12} jaar telt je score`, pct: Math.round(clamp(n / L * 100, 0, 100)), klaar: n >= L, nu: `nog ${Math.max(0, L - n)} maanden`});
  return out;
}
function score(s, einde){
  const cp = contPcts(s), rw = rivalenWeg(s);
  /* 3.4: waarde telt met de wortel, zodat de rest meetelt; wie verliest, verliest ook de waarde van zijn bedrijf */
  const dom = cp.reduce((a, c) => a + (c.pct >= 80 ? 400 : c.pct >= HEG_PCT ? 250 : c.pct >= 25 ? 60 : 0), 0), n = maandenGespeeld(s);
  const verloren = !!einde && !einde.startsWith("OVERWINNING") && einde !== "EINDE TERMIJN", gewonnen = !!einde && einde.startsWith("OVERWINNING");
  const L = spelLengte(s) || 240, delen = [[verloren ? "Bedrijfswaarde (verloren met het bedrijf)" : "Bedrijfswaarde (40 × √waarde)", verloren ? 0 : Math.round(40 * Math.sqrt(Math.max(0, playerValue(s))))], ["Dominantie", dom], ["Reputatie", Math.round(s.reputation * 6)],
    ["Jaren overleefd", Math.round(n / 12 * 60)], ["Rivalen uitgeschakeld", rw.weg * 300], ["Status", (s.statusNiveau || 0) * 120]];
  if (gewonnen && n < L) delen.push(["Tempo (maanden voor het einde × 6)", (L - n) * 6]);
  const basis = delen.reduce((a, [, v]) => a + v, 0), mult = Math.round((SCORE_MULT[s.player.difficulty] || 1) * (s.player.instelScore ?? 1) * 100) / 100;
  const eind = !einde ? 1 : gewonnen ? 1.25 : einde === "EINDE TERMIJN" ? 1 : 0.75;
  return {delen, basis, mult, eind, totaal: Math.round(basis * mult * eind)};
}
function eindCheck(s){
  const d = doelen(s).find(x => x.klaar && x.id !== "termijn");
  if (d) return "OVERWINNING: " + ({economisch: "ECONOMISCHE MACHT", hegemonie: "HEGEMONIE", uitschakeling: "MARKTMEESTER", corpzone: "CORPORATE ZONE"}[d.id] || d.naam.toUpperCase());
  if (doelen(s).some(x => x.id === "termijn" && x.klaar)) return "EINDE TERMIJN";
  return "actief";
}
function statsTick(s){
  const st = s.stats ??= {piekWaarde: 0, bestePlek: 99, hits: 0, flops: 0, aanslagenAf: 0, aanslagenRaak: 0, klussen: 0, oorlogen: 0};
  st.piekWaarde = Math.max(st.piekWaarde, playerValue(s)); st.piekCash = Math.max(st.piekCash || 0, s.cash);
  try { st.bestePlek = Math.min(st.bestePlek, wereldVM(s).plek); } catch(e){ foutLog("beste plek bijhouden", e); }
}
function eindRapport(s, ctx, status){
  const sc = score(s, status), st = s.stats || {};
  s.eind = {status, score: sc.totaal, delen: sc.delen, mult: sc.mult, eindMult: sc.eind, datum: ym(s), maanden: maandenGespeeld(s), waarde: playerValue(s), stats: {...st}};
  const tabel = sc.delen.map(([k2, v]) => `| ${k2} | ${v} |`).join("\n");
  mail(ctx, s, "Raad van Bestuur", `Eindrapport: ${status}`, `# Eindrapport ${s.player.corp_name}\n\n**${status}** na ${Math.floor(maandenGespeeld(s) / 12)} jaar en ${maandenGespeeld(s) % 12} maanden.\n\n| Onderdeel | Punten |\n|---|---|\n${tabel}\n| Moeilijkheid (${s.player.difficulty}) | ×${sc.mult} |\n| ${status.startsWith("OVERWINNING") ? "Overwinning" : status === "EINDE TERMIJN" ? "Termijn uitgediend" : "Verloren"} | ×${sc.eind} |\n| **Score** | **${sc.totaal}** |\n\n` +
    `Hoogste waarde: €${Math.round(st.piekWaarde || 0)}M · beste plek op de ranglijst: ${st.bestePlek < 99 ? st.bestePlek : "-"} · producthits: ${st.hits || 0} · flops: ${st.flops || 0} · aanslagen afgeslagen: ${st.aanslagenAf || 0} van ${(st.aanslagenAf || 0) + (st.aanslagenRaak || 0)}.`, "KRITIEK");
}

/* ===================== 2.2 GEZONDHEID: waarom morale en heat bewegen ===================== */
/* 7.2: een razzia is een zware klap, geen direct einde. De derde is het einde. */
const RAZZIA_MAX = 3;
function razzia(s, ctx){ s.razzias = (s.razzias || 0) + 1; s.flags.hoge_heat = 0; if (s.razzias >= RAZZIA_MAX) return true;
  const boete = r1(Math.max(15, (Math.max(0, s.cash) + (s.accounts.offshore || 0)) * 0.12)), zw = r1(s.accounts.zwart || 0);
  s.cash = r1(s.cash - boete); s.accounts.zwart = 0; s.accounts.operationeel = s.cash;
  const d = s.divisions.slice().sort((a, b) => ((typeOf(s, b.type) || {}).heat || 0) * b.level - ((typeOf(s, a.type) || {}).heat || 0) * a.level)[0]; let dl = "";
  if (d && d.level > 1){ d.level -= 1; dl = ` ${divNaam(d)} zakt naar niveau ${d.level}: machines verzegeld, mensen opgepakt.`; }
  s.reputation = clamp(s.reputation - 10); s.morale = clamp(s.morale - 10); s.heat = 50;
  const txt = `Om zes uur 's ochtends staan er busjes voor de deur. Boete €${boete}M${zw ? `, al het zwarte geld (€${zw}M) in beslag genomen` : ""}.${dl} Reputatie −10, morale −10. Heat staat weer op 50. Dit was razzia ${s.razzias} van ${RAZZIA_MAX}: de ${RAZZIA_MAX === s.razzias + 1 ? "volgende" : `${RAZZIA_MAX}e`} is het einde.`;
  mail(ctx, s, "Juridische Zaken", `Razzia ${s.razzias} van ${RAZZIA_MAX}`, txt, "KRITIEK"); ctx.rep.push(`Razzia ${s.razzias} van ${RAZZIA_MAX}`); news(s, `Inval bij ${s.player.corp_name}`, `Justitie valt binnen bij ${s.player.corp_name}. Dozen met dossiers gaan naar buiten.`, homeLandNaam(s), "wereld", true); addLog(s, `Razzia ${s.razzias}: boete €${boete}M${zw ? `, zwart €${zw}M kwijt` : ""}${dl}`); return false; }
/* 7.2: heat-prognose: hoe snel stijgt het, wanneer is het 90, wat is de grootste bron */
function heatPrognose(s){ const g = (s.gezondheid || {}).heat, d = g ? r1(g.naar - g.van) : 0, bron = g ? (g.delen || []).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0] : null;
  return {delta: d, maanden: d > 0.2 && s.heat < 90 ? Math.ceil((90 - s.heat) / d) : null, bron: bron ? bron[0] : null, razzias: s.razzias || 0, max: RAZZIA_MAX}; }
/* 7.2: juridisch offensief: advocaten, lobby en een paar diners. Kost meer naarmate je groter bent; eens per vier maanden. */
const offensiefKost = s => r1(Math.max(6, 6 + playerValue(s) / 400) * (DIFF[s.player.difficulty] || 1));
function actOffensief(s, ctx){ const m = ym(s); if (s.flags.offensief && mndNr(m) - mndNr(s.flags.offensief) < 4) return {ok: false, msg: `Het vorige offensief was in ${s.flags.offensief}. Advocaten hebben ook rust nodig: wacht tot vier maanden later.`};
  const k = offensiefKost(s); if (s.cash < k) return {ok: false, msg: `Een juridisch offensief kost €${k}M.`};
  s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; s.flags.offensief = m; const h0 = s.heat; s.heat = clamp(s.heat - 12); addLog(s, `Juridisch offensief: heat ${Math.round(h0)} → ${Math.round(s.heat)} (€${k}M)`);
  return {ok: true, msg: `Advocaten, lobbyisten en een paar diners: heat ${Math.round(h0)} → ${Math.round(s.heat)} (€${k}M). Volgende kan over vier maanden.`}; }
function gezondheidStart(s){ return {m0: s.morale, h0: s.heat, mDelen: [], hDelen: []}; }
function gezondheidEind(s, g, ctx){
  const rest = (v0, v1, delen) => { const d = r1(v1 - v0 - delen.reduce((a, [, v]) => a + v, 0)); return Math.abs(d) >= 0.5 ? [...delen, ["Gebeurtenissen, keuzes en oorlog", d]] : delen; };
  s.gezondheid = {morale: {van: r1(g.m0), naar: r1(s.morale), delen: rest(g.m0, s.morale, g.mDelen).map(([k2, v]) => [k2, r1(v)])}, heat: {van: r1(g.h0), naar: r1(s.heat), delen: rest(g.h0, s.heat, g.hDelen).map(([k2, v]) => [k2, r1(v)])}};
  const f = s.flags;
  if (s.morale < 30 && !(f.waarsch_morale)){ f.waarsch_morale = true; mail(ctx, s, "HR", "Morale is gevaarlijk laag", `Morale staat op ${Math.round(s.morale)}. Onder de 10 komt de raad in opstand: twee maanden zo en u bent uw bedrijf kwijt.\n\nWat helpt: salaris naar marktconform of hoog (Bedrijf), bonussen in de cultuur, winst draaien, een oorlog beëindigen, Bram Oosterhout om een gunst vragen (Mensen), of een directielid laten promoveren.`, "KRITIEK"); }
  if (s.morale >= 40) delete f.waarsch_morale;
  if (s.heat > 65 && !(f.waarsch_heat)){ f.waarsch_heat = true; mail(ctx, s, "Juridische Zaken", "Heat wordt gevaarlijk", `Heat staat op ${Math.round(s.heat)}. Boven de 90 volgt een razzia: twee maanden zo en het is voorbij.\n\nWat helpt: een netrunner sporen laten wissen of een spindokter een schandaal laten begraven (Crew), de commissaris om een gunst vragen (Mensen), invloed besteden aan 'Rust in de straat' (Kaart), minder smokkel en illegale klussen, of een strengere ethiek.`, "KRITIEK"); }
  if (s.heat <= 55) delete f.waarsch_heat;
}

function migrate22(s){
  if (!s.player || !s.setup_done) return;
  s.player.lengte ??= "normaal"; s.maanden ??= (s.history || []).length; vraagInit(s); rivalProductInit(s);
  s.flags.start_rivalen ??= s.rivals.slice(0, 3).map(r => r.name);
  s.stats ??= {piekWaarde: 0, bestePlek: 99, hits: 0, flops: 0, aanslagenAf: 0, aanslagenRaak: 0, klussen: 0, oorlogen: 0};
  s.log = (s.log || []).slice(-200); s.nieuws = (s.nieuws || []).slice(0, 50);
}

/* ===================== 2.2 LEVENDE PRODUCTEN: aard, prijs, recensies, gebeurtenissen ===================== */
const PRODUCT_AARD = {
  wapen: {label: "Wapen", eff: {macht: 2.5, heat: 0.5, straat: 0.4, politie: -0.3}, tekst: "geeft macht en aanzien op straat, trekt aandacht van de politie"},
  medisch: {label: "Medisch", eff: {reputation: 0.3, stad: 0.3}, tekst: "verbetert je reputatie en je band met overheden"},
  implantaat: {label: "Implantaat", eff: {straat: 0.3, reputation: 0.1, heat: 0.15}, tekst: "populair op straat, met een randje risico"},
  data: {label: "Data en media", eff: {invloed: 0.3}, tekst: "levert invloed op: wie de feeds heeft, heeft de mensen"},
  beveiliging: {label: "Beveiliging", eff: {macht: 2, politie: 0.2}, tekst: "maakt je sterker tegen aanvallen en aanslagen"},
  smokkel: {label: "Smokkelwaar", eff: {zwart: 0.8, heat: 0.4, politie: -0.2}, tekst: "levert zwart geld op en heat"},
  logistiek: {label: "Logistiek", eff: {vakbond: 0.2, morale: 0.1}, tekst: "veel banen: de bond en je mensen merken het"},
  financieel: {label: "Financieel", eff: {reputation: 0.1, stad: 0.1, invloed: 0.1}, tekst: "geeft je bedrijf gewicht in de kantoren waar het telt"},
  orbitaal: {label: "Orbitaal", eff: {invloed: 0.4, reputation: 0.2}, tekst: "prestige en invloed"},
  consument: {label: "Consumentenproduct", eff: {reputation: 0.15}, tekst: "bekendheid bij het grote publiek"},
};
const SECTOR_AARD = {"Biotech": "medisch", "Cyberware": "implantaat", "Logistiek": "logistiek", "Media & Data": "data", "Private Security": "beveiliging", "Financieel": "financieel", "Smokkel": "smokkel", "Orbitaal": "orbitaal", "Weapon Manufacturing": "wapen"};
function aardVan(type, naam){
  if (SECTOR_AARD[type]) return SECTOR_AARD[type];
  const t = `${type} ${naam || ""}`;
  if (/wapen|weapon|arms|gun|firearm|ammo|munitie|munition|defensi|defen[cs]e|geweer|pistool|rifle|militair|military/i.test(t)) return "wapen";
  if (/implant|cyber|prothes|neur|chrome|chroom/i.test(t)) return "implantaat";
  if (/logist|transport|freight|shipping|cargo|vracht|haven/i.test(t)) return "logistiek";
  if (/financ|bank|crypto|invest|verzeker|insurance/i.test(t)) return "financieel";
  if (/orbit|space|ruimte|satelliet|satellite|raket|rocket/i.test(t)) return "orbitaal";
  if (/drug|pharma|medic|zorg|kliniek|clinic|health|bio|trauma|ambulance/i.test(t)) return "medisch";
  if (/drone|bewak|beveilig|security|guard|merc|huurling/i.test(t)) return "beveiliging";
  if (/data|media|game|ai|software|stream|nieuws/i.test(t)) return "data";
  if (/smokkel|zwart|contraband/i.test(t)) return "smokkel";
  return "consument";
}
/* 3.3.1: abonnementen draaien op abonnees, niet op populariteit */
const isAbo = p => !!p && p.soort === "abonnement";
function bereik(p){ return isAbo(p) && p.abo != null ? clamp(Math.round(p.abo), 0, 110) : p.pop; }
function aboChurn(p){ const pr = clamp((prijsF(p) - 1) * 0.03 * elast(p), -0.01, 0.03);
  return clamp(0.055 - 0.007 * p.kwaliteit + pr - (p.loyaal ? 0.012 : 0) - (G.game && heeftFocus(G.game, "abo") ? 0.006 : 0) + (p.trait === "gevoelig" ? 0.01 : 0) - (p.trait === "verslavend" ? 0.015 : 0) - (p.trait === "cult" ? 0.01 : 0), 0.012, 0.09); }
const loyKost = p => r1(0.5 + (p.abo || 0) / 50);
function aboTick(s, p, ctx){ if (p.abo == null) p.abo = Math.round(p.pop * 0.8);
  if (p.loyaal){ const k = loyKost(p); s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; }
  if (ctx && p.abo > 15 && R() < 0.03 && !(s.keuzes || []).some(k => k.soort === "abo_" + p.id)){ const tb = r1(2 + p.abo / 20), gm = r1(p.abo / 12);
    addKeuze(s, ctx, {soort: "abo_" + p.id, van: "Klantenservice", titel: `Een concurrent lokt abonnees van ${p.naam} weg`, tekst: `Een rivaal biedt onze ${Math.round(p.abo * 10000).toLocaleString("nl-NL")} abonnees drie maanden gratis als ze overstappen. De opzeggingen lopen al binnen.`, opties: [
      {label: `Tegenbod · €${tb}M`, kost: tb, uitleg: "Een korting voor wie blijft. Bijna iedereen blijft (−2%).", eff: {product: {[p.id]: {abo: -2}}}},
      {label: `Gratis maand voor iedereen · −€${gm}M`, uitleg: "Een maand inkomsten weg, maar maar 4% vertrekt en het product wordt populairder (+5).", eff: {cash: -gm, product: {[p.id]: {abo: -4, pop: 5}}}},
      {label: "Laten gaan", uitleg: "Ongeveer 12% van je abonnees vertrekt.", eff: {product: {[p.id]: {abo: -12}}}}], standaard: 2}); }
  const vf = vraagFactor(s, p.aard || aardVan(p.type, p.naam)), inn = r1(p.pop / 100 * (4 + Math.max(0, 8 - (p.leeftijd || 0)) * 0.5) * vf * volF(p)), uit = r1(p.abo * aboChurn(p));
  p.abo = r1(clamp(p.abo - uit + inn, 0, 140)); p.aboIn = inn; p.aboUit = uit; }
const PRIJS = {budget: {label: "Budget", pop: 12, gewicht: 0.8, rep: -0.05}, standaard: {label: "Standaard", pop: 0, gewicht: 1, rep: 0}, premium: {label: "Premium", pop: -10, gewicht: 1.35, rep: 0.1}};

/* ===================== 4.0 ECHTE PRODUCTEN: eigenschappen, prijs per stuk, marge, afzet, levensfase, marktaandeel, capaciteit ===================== */
const STUK = {wapen: {eenheid: "stuks", prijs: 320}, medisch: {eenheid: "doses", prijs: 20}, implantaat: {eenheid: "implantaten", prijs: 1600}, data: {eenheid: "licenties", prijs: 6},
  beveiliging: {eenheid: "diensten", prijs: 380}, smokkel: {eenheid: "ladingen", prijs: 260}, logistiek: {eenheid: "zendingen", prijs: 9}, financieel: {eenheid: "rekeningen", prijs: 4},
  orbitaal: {eenheid: "ladingplaatsen", prijs: 8500}, consument: {eenheid: "stuks", prijs: 12}};
const SPECS = {wapen: ["Vuurkracht", "Betrouwbaarheid", "Onopvallendheid"], medisch: ["Werkzaamheid", "Veiligheid", "Herstel"], implantaat: ["Prestatie", "Afstoting", "Levensduur"],
  data: ["Bereik", "Nauwkeurigheid", "Privacy"], beveiliging: ["Reactietijd", "Dekking", "Discretie"], smokkel: ["Snelheid", "Onzichtbaarheid", "Volume"], logistiek: ["Snelheid", "Betrouwbaarheid", "Bereik"],
  financieel: ["Rendement", "Risico", "Gemak"], orbitaal: ["Lading", "Precisie", "Kosten"], consument: ["Design", "Gemak", "Duurzaamheid"]};
function hashN(str, i){ let h = 7; for (const ch of String(str) + ":" + i) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
/* 4.4.1: onderdelenlijst. Per soort drie onderdelen (deel van de kostprijs, gekoppelde eigenschap, sectoren van mogelijke leveranciers); de rest (20%) is arbeid.
   Goedkoop: −30% kosten, −1 op die eigenschap. Premium: +35% kosten, +1. Standaard kost precies wat een product vóór 4.4.1 kostte. */
const ONDERDELEN = {
  wapen: [["Loop en mechaniek", 0.35, 1, ["Weapon Manufacturing", "Private Security", "Cyberware"]], ["Munitie en lading", 0.25, 0, ["Weapon Manufacturing", "Private Security", "Smokkel"]], ["Behuizing en demping", 0.2, 2, ["Weapon Manufacturing", "Cyberware"]]],
  medisch: [["Werkzame stof", 0.4, 0, ["Biotech"]], ["Zuivering en tests", 0.25, 1, ["Biotech"]], ["Nazorgpakket", 0.15, 2, ["Biotech", "Logistiek"]]],
  implantaat: [["Neurale chip", 0.4, 0, ["Cyberware"]], ["Biocompatibele coating", 0.25, 1, ["Biotech"]], ["Voeding en behuizing", 0.15, 2, ["Cyberware"]]],
  data: [["Servers en opslag", 0.35, 0, ["Media & Data"]], ["Datasets", 0.25, 1, ["Media & Data"]], ["Versleuteling", 0.2, 2, ["Media & Data", "Cyberware"]]],
  beveiliging: [["Voertuigen en drones", 0.35, 0, ["Private Security", "Logistiek"]], ["Sensoren en camera's", 0.25, 1, ["Cyberware"]], ["Training en screening", 0.2, 2, ["Private Security"]]],
  smokkel: [["Voertuigen", 0.35, 0, ["Logistiek"]], ["Valse papieren", 0.25, 1, ["Smokkel", "Media & Data"]], ["Opslag en containers", 0.2, 2, ["Logistiek"]]],
  logistiek: [["Voertuigen en brandstof", 0.4, 0, ["Logistiek"]], ["Tracking en software", 0.2, 1, ["Media & Data"]], ["Depots", 0.2, 2, ["Logistiek"]]],
  financieel: [["Rekenkracht", 0.3, 0, ["Media & Data"]], ["Compliance en verzekering", 0.3, 1, ["Financieel"]], ["App en klantenservice", 0.2, 2, ["Media & Data"]]],
  orbitaal: [["Lanceerraket", 0.45, 0, ["Orbitaal", "Logistiek"]], ["Navigatie", 0.2, 1, ["Cyberware"]], ["Brandstof", 0.15, 2, ["Orbitaal", "Logistiek"]]],
  consument: [["Ontwerp en materiaal", 0.35, 0, ["Cyberware", "Media & Data"]], ["Elektronica", 0.25, 1, ["Cyberware"]], ["Verpakking en levering", 0.2, 2, ["Logistiek"]]]};
const ARBEID = 0.2, DEEL_KWAL = {goedkoop: {label: "Goedkoop", kost: 0.7, spec: -1}, standaard: {label: "Standaard", kost: 1, spec: 0}, premium: {label: "Premium", kost: 1.35, spec: 1}};
const delenVan = p => ONDERDELEN[p.aard || aardVan(p.type, p.naam)] || ONDERDELEN.consument;
const deelKwal = (p, i) => DEEL_KWAL[((p.delen || [])[i] || {}).kwal] ? p.delen[i].kwal : "standaard";
const EIGEN_KORTING = 0.85, zelfKost = s => r1(4 * (DIFF[(s && s.player.difficulty)] || 1)); /* 4.7.4: onderdelen zelf maken: eenmalige investering, daarna 15% goedkoper en geen leverancier */
const eigenDeel = (p, i) => !!((p.delen || [])[i] || {}).eigen;
const kostFactor = p => extraF(p, "kosten") * (ARBEID + delenVan(p).reduce((t, d, i) => t + d[1] * DEEL_KWAL[deelKwal(p, i)].kost * (eigenDeel(p, i) ? EIGEN_KORTING : 1), 0) * (p.matF ?? 1) * ((p.tech || 0) >= 2 ? 0.92 : 1)); /* 5.12: grondstofprijzen werken op het onderdelendeel; 5.14: onderzoek niveau 2 −8% */
function leverancier(s, p, i){ if (!s) return null; const D = delenVan(p)[i], x = ((p.delen ??= [])[i] ??= {kwal: "standaard"}), B = s.bedrijven || []; if (x.eigen) return null;
  let b = x.lev && B.find(y => y.id === x.lev); if (!b){ const pool = B.filter(y => D[3].includes(y.sector)), lijst = pool.length ? pool : B; b = lijst.length ? lijst[hashN(p.id, i) % lijst.length] : null; x.lev = b ? b.id : null; }
  return b; }
function leverancierWeg(s, ctx, b){ for (const p of s.producten || []) (p.delen || []).forEach((x, i) => { if (x && x.lev === b.id){ x.lev = null; const nb = leverancier(s, p, i); if (ctx) ctx.rep.push(`Leverancier ${b.naam} van ${p.naam} failliet; ${nb ? nb.naam : "de eigen werkplaats"} neemt het over`); } }); }
/* 4.5: defecten. Percentage per product: basis per soort × kwaliteit × onderdelen × eigenschap × bètatest. Garantie kost dat percentage van de omzet;
   boven 5% defecten kan elke maand een terugroepactie nodig zijn. */
const DEFECT_BASIS = {wapen: 2, medisch: 1.5, implantaat: 3, data: 1, beveiliging: 1.5, smokkel: 4, logistiek: 2, financieel: 0.5, orbitaal: 3, consument: 3};
const DEFECT_DEEL = {goedkoop: 1.5, standaard: 1, premium: 0.7};
function defectDelen(p){ return delenVan(p).reduce((t, d, i) => t + d[1] * DEFECT_DEEL[deelKwal(p, i)], 0) / 0.8; }
function defectPct(p){ const a = p.aard || aardVan(p.type, p.naam), q = clamp(1.6 - 0.2 * (p.kwaliteit || 3), 0.6, 1.4), tr = p.trait === "gevoelig" ? 1.6 : p.trait === "goedkoop" ? 1.5 : 1;
  return Math.round((DEFECT_BASIS[a] ?? 2) * q * defectDelen(p) * tr * (p.beta ? 0.85 : 1) * extraF(p, "betrouwbaar") * 10) / 10; }
const DEFECT_DREMPEL = 5;
/* 6.13: edities. Een product krijgt een opvolger (Editie 2, 3, ...): je bespreekt met de GM wat er beter of bij moet, de engine rekent kosten, duur en kans. Bij de lancering blijft het hetzelfde product (contracten, geschiedenis), met een nieuwe naam, extra's en een sprong in kwaliteit. */
const EXTRA_SOORT = {omzet: {label: "Meer verkoop", uitleg: "+6% omzet", f: 1.06}, populariteit: {label: "Hype", uitleg: "+6 populariteit bij de lancering", pop: 6}, betrouwbaar: {label: "Betrouwbaarder", uitleg: "−15% defecten", f: 0.85}, kosten: {label: "Goedkoper te maken", uitleg: "−6% productiekosten", f: 0.94}, imago: {label: "Beter imago", uitleg: "reputatie +2 bij de lancering", rep: 2}};
const EXTRA_MAX = 8, ROMEINS = ["", "", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function extraF(p, soort){ const n = (p && p.extras || []).filter(x => x.soort === soort).length; if (!n) return 1; const E = EXTRA_SOORT[soort]; return E && E.f ? Math.pow(E.f, n) : 1; }
const editieNr = p => p.editie || 1;
const basisNaam = p => p.basisNaam || String(p.naam || "").replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)$/, "");
function editieKosten(s, p, v){ const dif = DIFF[s.player.difficulty] || 1, sch = {klein: 0.7, groot: 1, vlag: 1.6}[p.schaal || "groot"] || 1, ne = v.extras.length, kw = v.kwPlus;
  const d = s.divisions.find(x => divNaam(x) === p.divisie) || {level: 1};
  return {kost: r1((6 + 4 * ne + 10 * kw) * dif * sch), maanden: clamp(2 + kw + Math.floor(ne / 2), 2, 6), doel: 6 + kw + (ne >= 3 ? 1 : 0), bonus: Math.ceil(d.level / 2)}; }
function editieKans(s, p, v){ const k = editieKosten(s, p, v); return kans2d6(k.bonus, k.doel); }
const EXTRA_WOORD = [[/goedko|kosten|efficie|productie|sneller te maken|lean/i, "kosten"], [/betrouw|robuust|sterk|duurza|defect|veilig|bescherm|licht|comfort/i, "betrouwbaar"], [/hype|marketing|design|camo|stijl|kleur|look|merk|limited|luxe/i, "populariteit"], [/imago|ethisch|schoon|groen|legaal|transparant/i, "imago"]];
function editieVoorstelLokaal(s, p, tekst){ const delen = String(tekst || "").split(/,|;|\n|\ben\b|\+/i).map(x => x.trim()).filter(x => x.length >= 3).slice(0, 4);
  const extras = (delen.length ? delen : [tekst || "Nieuwe functies"]).map(x => { const w = EXTRA_WOORD.find(([re]) => re.test(x)); return {naam: cStr(x[0].toUpperCase() + x.slice(1), 50), uitleg: "", soort: w ? w[1] : "omzet"}; });
  const kwPlus = p.kwaliteit >= 5 ? 0 : /beter|upgrade|generatie|kwaliteit|krachtig|sterker|geavanceerd|pro\b/i.test(tekst) ? 1 : 0;
  const n = editieNr(p) + 1; return {naam: `${basisNaam(p)} ${ROMEINS[n] || n}`, pitch: `Editie ${n} van ${basisNaam(p)}: ${extras.map(e => e.naam.toLowerCase()).join(", ")}.`, extras, kwPlus, risico: "Een nieuwe editie moet opnieuw gekeurd worden en de vorige editie verdwijnt uit de schappen.", lokaal: true}; }
function cleanEditie(r, s, p){ r = r && typeof r === "object" ? r : {}; const n = editieNr(p) + 1;
  const extras = (Array.isArray(r.extras) ? r.extras : []).slice(0, 4).map(x => ({naam: cStr(x && x.naam, 50), uitleg: cStr(x && x.uitleg, 160), soort: EXTRA_SOORT[x && x.soort] ? x.soort : "omzet"})).filter(x => x.naam);
  return {naam: cStr(r.naam, 40) || `${basisNaam(p)} ${ROMEINS[n] || n}`, pitch: cStr(r.pitch, 500), extras: extras.length ? extras : [{naam: "Nieuwe functies", uitleg: "", soort: "omzet"}], kwPlus: Math.round(clamp(+r.kwaliteit_plus || 0, 0, Math.min(2, 5 - p.kwaliteit))), risico: cStr(r.risico, 200)}; }
function editiePrompt(s, p, tekst){ const n = editieNr(p) + 1;
  return `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie (taal: Nederlands, toon: droog, cynisch, corporate-noir). De CEO van ${s.player.corp_name} wil editie ${n} van een bestaand product: "${p.naam}" (${PRODUCT_AARD[p.aard || aardVan(p.type, p.naam)].label}, kwaliteit ${p.kwaliteit}/5, schaal ${p.schaal || "groot"}${p.pitch ? `, nu: ${cStr(p.pitch, 300)}` : ""}${(p.extras || []).length ? `, heeft al: ${p.extras.map(x => x.naam).join(", ")}` : ""}).
Wat de CEO wil: "${tekst}"
Werk dit uit tot een opvolger, zo dicht mogelijk bij wat de CEO bedoelt. Geef 1 tot 4 extra's: concrete nieuwe dingen of verbeteringen. Elke extra krijgt één soort effect: "omzet" (meer verkoop), "populariteit" (hype bij de lancering), "betrouwbaar" (minder defecten), "kosten" (goedkoper te maken) of "imago" (reputatie). "kwaliteit_plus" 0, 1 of 2: alleen 2 als het echt een nieuwe generatie is. Kosten en duur rekent de engine zelf.
Antwoord met alleen JSON: {"naam": "naam van editie ${n} (meestal de oude naam met ${ROMEINS[n] || n}, of een nieuwe als de CEO dat wil)", "pitch": "2-3 zinnen in de stem van het hoofd R&D", "extras": [{"naam": "...", "uitleg": "één zin", "soort": "omzet|populariteit|betrouwbaar|kosten|imago"}], "kwaliteit_plus": 1, "risico": "één zin"}`; }
async function gmEditie(id, tekst){ const s = G.game, p = s && (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, bericht: "Onbekend product."};
  tekst = cStr(tekst, 600); if (tekst.length < 3) return {ok: false, bericht: "Zeg eerst wat er in de nieuwe editie moet."};
  let v; if (live()){ try { v = cleanEditie(await G.sample.json(editiePrompt(s, p, tekst), {modelTier: "default"}), s, p); } catch(e){ return {ok: false, bericht: sampleErrorText(e)}; } } else v = editieVoorstelLokaal(s, p, tekst);
  v.vraagVan = tekst; v.voor = p.id; (G.edities ??= {})[p.id] = v; return {ok: true, bericht: `${live() ? "De GM" : "R&D"} heeft ${v.naam} uitgewerkt. Lees het voorstel en kies.`}; }
function actEditie(s, ctx, id, v){ const p = (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, msg: "Onbekend product."}; if (!v) return {ok: false, msg: "Er ligt geen voorstel klaar."};
  if (p.status !== "markt") return {ok: false, msg: "Alleen een product op de markt krijgt een nieuwe editie."}; if (p.editieBezig) return {ok: false, msg: `${p.naam} heeft al een editie in ontwikkeling.`}; if (p.verbetering) return {ok: false, msg: "Er loopt al een nieuwe versie."};
  const k = editieKosten(s, p, v); if (s.cash < k.kost) return {ok: false, msg: `Editie ${editieNr(p) + 1} kost €${k.kost}M.`}; s.cash = r1(s.cash - k.kost); s.accounts.operationeel = s.cash;
  p.editieBezig = {naam: cStr(v.naam, 40), pitch: cStr(v.pitch, 500), extras: (v.extras || []).slice(0, 4).map(x => ({naam: cStr(x.naam, 50), uitleg: cStr(x.uitleg, 160), soort: EXTRA_SOORT[x.soort] ? x.soort : "omzet"})), kwPlus: Math.round(clamp(+v.kwPlus || 0, 0, Math.min(2, 5 - p.kwaliteit))), over: k.maanden, doel: k.doel, bonus: k.bonus, kost: k.kost, sinds: ym(s)};
  prodLog(p, s, `Editie ${editieNr(p) + 1} in ontwikkeling: ${p.editieBezig.naam}`); addLog(s, `${p.naam}: editie ${editieNr(p) + 1} (${p.editieBezig.naam}) in ontwikkeling, €${k.kost}M, ${k.maanden} maanden`);
  return {ok: true, msg: `${p.editieBezig.naam} in ontwikkeling: €${k.kost}M, ${k.maanden} maanden, ${kans2d6(k.bonus, k.doel)}% kans dat alles lukt. Tot dan verkoopt ${p.naam} gewoon door.`}; }
function editieTick(s, ctx, p){ const E = p.editieBezig; if (!E || --E.over > 0) return; delete p.editieBezig;
  const r = rol2d6(E.bonus || 1, E.doel || 7), oud = p.naam, n = editieNr(p) + 1; addRoll(s, `Editie ${n} van ${oud}: ${r.txt} → ${r.ok ? "GELUKT" : "HALF"}`);
  const extras = r.ok ? E.extras : E.extras.slice(0, 1), kw = r.ok ? E.kwPlus : 0;
  p.basisNaam ??= basisNaam(p); p.editie = n; p.naam = E.naam || p.naam; if (E.pitch) p.pitch = E.pitch;
  p.extras = [...(p.extras || []), ...extras.map(x => ({...x, editie: n}))].slice(-EXTRA_MAX); p.kwaliteit = clamp(p.kwaliteit + kw, 1, 5);
  const pop = 10 + extras.reduce((a, x) => a + (EXTRA_SOORT[x.soort].pop || 0), 0) + (r.crit ? 8 : 0), rep = extras.reduce((a, x) => a + (EXTRA_SOORT[x.soort].rep || 0), 0);
  p.pop = clamp(p.pop + pop, 0, 95); if (rep) s.reputation = clamp(s.reputation + rep); p.leeftijd = 0; if (p.trait === "gevoelig") p.trait = null; maakReview(p);
  if (KEURING_AARD.has(p.aard || aardVan(p.type, p.naam)) && kanaalVan(p) !== "zwart") p.keuring = "nodig";
  (p.edities ??= []).push({n, naam: p.naam, m: ym(s), extras: extras.map(x => x.naam), kw: p.kwaliteit, ok: r.ok});
  prodLog(p, s, `Editie ${n}: ${p.naam}${r.ok ? "" : " (half gelukt)"}`);
  const txt = r.ok ? `${p.naam} ligt in de winkel (${r.txt}). Nieuw: ${extras.map(x => x.naam.toLowerCase()).join(", ")}${kw ? `, kwaliteit nu ${p.kwaliteit}` : ""}. Populariteit +${pop}${rep ? `, reputatie +${rep}` : ""}.`
    : `${p.naam} is uit, maar niet alles zat erin (${r.txt}): alleen ${extras.map(x => x.naam.toLowerCase()).join(", ")}, geen sprong in kwaliteit. Populariteit +${pop}.`;
  mail(ctx, s, "R&D", `${p.naam}: editie ${n}`, txt + (p.keuring === "nodig" ? " Een nieuwe editie moet opnieuw gekeurd worden." : ""), r.ok ? "NORMAAL" : "HOOG"); ctx.rep.push(`${p.naam}: editie ${n}${r.ok ? "" : " (half)"}`);
  if (r.ok) news(s, `${s.player.corp_name} lanceert ${p.naam}`, `De opvolger van ${oud === p.naam ? "het origineel" : oud}. ${extras.length ? "Nieuw: " + extras.map(x => x.naam.toLowerCase()).join(", ") + "." : ""}`, "", "markt", true); }
/* 4.5.1: keuring. Medisch, implantaten en wapens mogen pas overal verkocht worden na een keuring; daarvoor alleen de grijze markt (60% van de afzet).
   Producten van vóór 4.5.1 (zonder veld) gelden als gekeurd. */
const KEURING_AARD = new Set(["medisch", "implantaat", "wapen"]), KEUR_ZONDER = 0.6;
/* 4.6: verkoopkanalen per product. vol = afzet, marge = opbrengst per stuk (geen tussenhandel), vast = M€ per maand, heat per maand. */
const DIGITAAL = new Set(["data", "financieel", "consument"]), ILLEGAAL = new Set(["wapen", "smokkel", "implantaat"]);
const KANAAL = {
  groothandel: {label: "Groothandel", vol: () => 1, marge: 1, vast: 0, heat: 0, tekst: "Distributeurs nemen alles af en verkopen het door. Geen gedoe, geen extra marge."},
  eigen: {label: "Eigen winkels", vol: () => 0.9, marge: 1.15, vast: 1.5, heat: 0, tekst: "Je eigen winkels en verkopers: geen tussenhandel (+15% opbrengst per stuk), minder bereik, €1,5M vaste kosten per maand."},
  online: {label: "Online", vol: p => DIGITAAL.has(p.aard) ? 1.15 : 0.85, marge: 1.05, vast: 0.5, heat: 0, tekst: "Webwinkel en platforms: sterk voor data, financiële en consumentenproducten (+15% afzet), zwak voor de rest (−15%). €0,5M per maand."},
  zwart: {label: "Zwarte markt", vol: p => ILLEGAAL.has(p.aard) ? 1.25 : 0.8, marge: 1, vast: 0, heat: 0.4, zwart: 0.5, tekst: "Via fixers en kofferbakken: geen keuring nodig, sterk voor wapens, smokkelwaar en implantaten (+25%), zwak voor de rest (−20%). De helft van de omzet komt als zwart geld binnen. Heat +0,4 per maand."}};
/* 4.6.1: marketingkanalen. Een campagne geeft populariteit en een paar maanden extra afzet in één klantsegment:
   doel "gevoelig" = het prijsgevoeligste segment, "koopkrachtig" = het minst prijsgevoelige. */
const MARKETING = {
  reclame: {label: "Reclame", kost: 3, pop: 12, doel: null, f: 1, maanden: 0, tekst: "Posters, spots, billboards: populariteit +12 bij iedereen."},
  influencers: {label: "Influencers", kost: 3, pop: 8, doel: "gevoelig", f: 1.4, maanden: 4, tekst: "Gezichten met volgers: populariteit +8 en 4 maanden 40% meer afzet in het prijsgevoeligste segment."},
  beurs: {label: "Beurs", kost: 5, pop: 5, doel: "koopkrachtig", f: 1.5, maanden: 6, tekst: "Een stand, een diner, handdrukken: populariteit +5 en 6 maanden 50% meer afzet bij de koopkrachtigste, minst prijsgevoelige klanten."},
  fluister: {label: "Fluistercampagne", kost: 2, zwart: true, pop: 8, doel: "gevoelig", f: 1.3, maanden: 4, heat: 2, tekst: "Via de straat, betaald met zwart geld: populariteit +8 (wapens, smokkelwaar en implantaten +12), 4 maanden 30% meer afzet in het prijsgevoeligste segment, heat +2."}};
function mktSegIndex(p, doel){ const L = SEGMENTEN[p.aard || aardVan(p.type, p.naam)] || SEGMENTEN.consument; if (!doel) return -1; let best = 0; L.forEach((x, i) => { if (doel === "gevoelig" ? x[2] > L[best][2] : x[2] < L[best][2]) best = i; }); return best; }
function mktTick(p){ if (p.mkt && --p.mkt.maanden <= 0) delete p.mkt; }
const kanaalVan = p => KANAAL[p.kanaal] ? p.kanaal : "groothandel";
const kanaalF = p => { const K = KANAAL[kanaalVan(p)]; return K.vol(p) * K.marge; };
const kanaalWissel = s => r1(1 * (DIFF[(s && s.player.difficulty)] || 1));
const keurStatus = p => p.keuring == null ? "ok" : typeof p.keuring === "object" ? "bezig" : p.keuring;
const keurF = p => keurStatus(p) === "ok" || kanaalVan(p) === "zwart" ? 1 : KEUR_ZONDER;
const keurKost = s => r1(4 * (DIFF[(s && s.player.difficulty)] || 1)), omkoopKost = s => r1(2 * (DIFF[(s && s.player.difficulty)] || 1));
const keurDoel = p => 5 + (defectPct(p) > 3 ? 1 : 0) /* 6.8: was 6; ±83% i.p.v. 72% */ + (defectPct(p) > DEFECT_DREMPEL ? 1 : 0) - ((p.kwaliteit || 3) >= 4 ? 1 : 0);
const keurInstantie = p => ({medisch: "het geneesmiddelenbureau", implantaat: "de keuringsdienst voor implantaten", wapen: "de wapeninspectie"})[p.aard] || "de keurder";
/* 4.7.2: een goedkeuring is permanent, maar geldt alleen voor deze editie: een nieuw product, een variant of een nieuwe versie wordt opnieuw gekeurd */
function vergunning(s, p){ }
function keuringTick(s, ctx, p){ if (keurStatus(p) !== "bezig" || --p.keuring.maanden > 0) return;
  const r = rol2d6(0, keurDoel(p)); addRoll(s, `Keuring ${p.naam}: ${r.txt} → ${r.ok ? "GOEDGEKEURD" : "AFGEKEURD"}`);
  if (r.ok){ p.keuring = "ok"; vergunning(s, p); prodLog(p, s, "Goedgekeurd"); mail(ctx, s, "Juridische Zaken", `${p.naam} goedgekeurd`, `${keurInstantie(p)[0].toUpperCase() + keurInstantie(p).slice(1)} keurt ${p.naam} goed (${r.txt}). Vanaf nu overal in de winkel.`, "NORMAAL"); }
  else { p.keuring = "afgekeurd"; prodLog(p, s, "Afgekeurd"); mail(ctx, s, "Juridische Zaken", `${p.naam} afgekeurd`, `${keurInstantie(p)[0].toUpperCase() + keurInstantie(p).slice(1)} keurt ${p.naam} af (${r.txt}).${defectPct(p) > 3 ? ` Ze wijzen op het aantal defecten (${defectPct(p)}%).` : ""} We mogen opnieuw aanvragen; betere onderdelen of een nieuwe versie helpen.`, "HOOG"); } }
function kansRol(){ return R(); } /* eigen functie zodat tests de kans kunnen vastzetten */
function defectTick(s, ctx, p){ if (p.status !== "markt") return; { const dp = defectPct(p); if (dp > DEFECT_DREMPEL && kansRol() < (dp - DEFECT_DREMPEL) / 100 && !(s.keuzes || []).some(k => k.soort === "defect_" + p.id) && (!p.defectLaatst || mndNr(ym(s)) - mndNr(p.defectLaatst) >= 12)){ p.defectLaatst = ym(s); const k1 = r1(Math.max(2, (s.prodomzet || {})[p.id] || 2) * 1.5), k2 = r1(k1 / 3);
      addKeuze(s, ctx, {soort: "defect_" + p.id, van: "Kwaliteitsdienst", titel: `Te veel defecten bij ${p.naam}`, tekst: `${dp}% van wat we van ${p.naam} verkopen komt terug of gaat stuk. De klachten stapelen zich op en een consumentenprogramma belt al.`, opties: [
        {label: `Terugroepen · €${k1}M`, kost: k1, uitleg: "Populariteit −15, reputatie +1. Dit soort klachten komt hoogstens eens per jaar terug; de oorzaak (onderdelen, kwaliteit) blijft tot je die aanpakt.", eff: {reputation: 1, product: {[p.id]: {pop: -15}}}},
        {label: `Stil repareren · €${k2}M`, kost: k2, uitleg: `Kans ${snapKans(55)}%: niemand merkt het. Mislukt: reputatie −6, populariteit −20.`, eff: {kans: 55, succes: {tekst: "De reparaties verlopen stil."}, falen: {reputation: -6, product: {[p.id]: {pop: -20}}}}},
        {label: "Niets doen", uitleg: "Reputatie −3, populariteit −8.", eff: {reputation: -3, product: {[p.id]: {pop: -8}}}}], standaard: 2}); prodLog(p, s, `Defecten ${dp}%: terugroepactie overwogen`); } } }
const garantie = (p, omzet) => omzet * defectPct(p) / 100;
/* 5.1: huisstijl: bedrijfskleuren, thema en logo (generator of PNG) */
const THEMAS = {neon: {label: "Neon"}, corporate: {label: "Corporate", bg: "#0b0f14", panel: "rgba(18,24,32,.9)", panel2: "#18212c", panel3: "#202c3a", line: "#263445", line2: "#3b5068", muted: "#9fb0c4", dim: "#8494a8"},
  terminal: {label: "Terminal", bg: "#020a04", panel: "rgba(6,20,10,.9)", panel2: "#0b2412", panel3: "#103018", line: "#14401f", line2: "#1f6b33", muted: "#9cc8a6", dim: "#7fa889"},
  bloed: {label: "Bloed", bg: "#0e0204", panel: "rgba(30,6,10,.88)", panel2: "#2a0a10", panel3: "#3a0e16", line: "#4a1420", line2: "#7a2030", muted: "#d0a8ae", dim: "#b08890"},
  chroom: {label: "Chroom", bg: "#0d0d10", panel: "rgba(26,26,32,.9)", panel2: "#22222a", panel3: "#2c2c36", line: "#3a3a46", line2: "#5a5a6a", muted: "#b4b4c2", dim: "#9494a4"}};
const LOGO_SYMBOLEN = ["◆", "▲", "⬢", "✦", "☢", "⚙", "✪", "Ω", "Ψ", "⌬", "☠", "⚡"], LOGO_VORMEN = ["zeshoek", "cirkel", "ruit", "schild"];
function actHuisstijl(s, a){ const h = (s.huisstijl ??= {}), kleur = x => typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x);
  if (kleur(a.kleur)) h.kleur = a.kleur; if (kleur(a.accent)) h.accent = a.accent; if (THEMAS[a.thema]) h.thema = a.thema;
  if (a.logo && a.logo.soort === "png"){ if (typeof a.logo.data !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(a.logo.data) || a.logo.data.length > 90000) return {ok: false, msg: "Dat plaatje is te groot of geen afbeelding."}; h.logo = {soort: "png", data: a.logo.data}; }
  else if (a.logo && a.logo.soort === "gen") h.logo = {soort: "gen", symbool: LOGO_SYMBOLEN.includes(a.logo.symbool) ? a.logo.symbool : "◆", vorm: LOGO_VORMEN.includes(a.logo.vorm) ? a.logo.vorm : "zeshoek"};
  else if (a.logo === null) delete h.logo;
  addLog(s, "Huisstijl aangepast"); return {ok: true, msg: "Huisstijl bijgewerkt."}; }
/* 5.2: autopilot per product: prijs volgt de beste prijs, capaciteit volgt de vraag (met een kasbuffer), keuring vanzelf */
const AUTO = {prijs: "Prijs volgt de prijs met de meeste winst (hoogstens 150%, daarboven kost het reputatie)", cap: "Capaciteit volgt de vraag (uitbreiden als je uitverkocht bent en er €20M buffer is, inkrimpen bij veel leegloop)", keuring: "Keuring vanzelf aanvragen"};
function autoTick(s, ctx, p){ const A = p.auto || {}; if (p.status !== "markt" || !(A.prijs || A.cap || A.keuring)) return; const uit = [];
  if (A.keuring && ["nodig", "afgekeurd"].includes(keurStatus(p)) && kanaalVan(p) !== "zwart" && s.cash > keurKost(s) + 10){ const r = actProduct(s, ctx, "keuring", {id: p.id, wijze: "officieel"}); if (r.ok) uit.push("keuring aangevraagd"); }
  if (A.prijs){ const b = besteprijs(s, p), nf = b ? Math.min(b.f, 1.5) : null; if (nf && Math.abs(nf - prijsF(p)) >= 0.05){ const r = actPrijs(s, p.id, nf); if (r.ok) uit.push(`prijs naar ${Math.round(nf * 100)}%`); } } /* nooit boven 150%: daar beginnen woekerprijzen */
  if (A.cap){ const v = vraagNa(p), c = prodCap(s, p);
    if (v > c * 1.05 && s.cash > capKost(s, p) + 20 && c + 15 <= 130){ const r = actProduct(s, ctx, "capaciteit", {id: p.id}); if (r.ok) uit.push(`capaciteit naar ${prodCap(s, p)}`); }
    else if (v < c - 25 && c - 15 >= 45 && (p.capExtra || 0) > 0){ const r = actProduct(s, ctx, "krimpen", {id: p.id}); if (r.ok) uit.push(`capaciteit naar ${prodCap(s, p)}`); } }
  if (uit.length) ctx.rep.push(`Autopilot ${p.naam}: ${uit.join(", ")}`); }
const omschakelKost = s => r1(2 * (DIFF[(s && s.player.difficulty)] || 1));
const nadrukVan = v => v === "" || v == null || isNaN(+v) || +v < 0 || +v > 2 ? null : +v;
function prodSpecs(p){ const names = SPECS[p.aard] || SPECS.consument, F = {kwaliteit: [1, 1, 1], veilig: [0, 2, 0], snel: [0, -1, 0], goedkoop: [-1, -1, 0], innovatief: [2, -1, 0]}[p.focus] || [0, 0, 0];
  const N = [0, 0, 0]; if (p.nadruk != null && p.nadruk >= 0 && p.nadruk <= 2){ N[p.nadruk] = 2; N[(p.nadruk + 1) % 3] = -1; } /* 4.4: nadruk bij het ontwerp: +2 op de gekozen eigenschap, −1 op de volgende */
  if (p.delen) delenVan(p).forEach((d, j) => { N[d[2]] += DEEL_KWAL[deelKwal(p, j)].spec; });
  return names.map((n, i) => ({naam: n, v: clamp(Math.round(p.kwaliteit * 1.6 + (hashN(p.id, i) % 5) - 2 + F[i] + N[i] + (p.trait === "duurzaam" && i === 1 ? 1 : 0) + ((p.tech || 0) >= 3 ? 1 : 0)), 1, 10)})); }
/* 4.6.2: echte productlijnen per schaal. Klein = goedkoop en veel, vlaggenschip = duur en via losse orders (tanks, satellieten, ziekenhuissystemen).
   Omzet in M€, stukprijzen in echte euro's. [meervoud, enkelvoud, prijs, order] */
const STUK_SCHAAL = {
  wapen: {klein: ["pistolen", "pistool", 320], groot: ["aanvalsgeweren", "aanvalsgeweer", 2400], vlag: ["tanks", "tank", 4200000, true]},
  medisch: {klein: ["doses", "dosis", 20], groot: ["behandelingen", "behandeling", 1800], vlag: ["ziekenhuissystemen", "ziekenhuissysteem", 850000, true]},
  implantaat: {klein: ["implantaten", "implantaat", 1600], groot: ["militaire implantaten", "militair implantaat", 25000], vlag: ["volledige lichaamsombouwen", "volledige lichaamsombouw", 600000, true]},
  data: {klein: ["licenties", "licentie", 6], groot: ["bedrijfslicenties", "bedrijfslicentie", 4500], vlag: ["overheidssystemen", "overheidssysteem", 2500000, true]},
  beveiliging: {klein: ["diensten", "dienst", 380], groot: ["bewakingscontracten", "bewakingscontract", 15000], vlag: ["stadscontracten", "stadscontract", 1200000, true]},
  smokkel: {klein: ["ladingen", "lading", 260], groot: ["containers", "container", 18000], vlag: ["konvooien", "konvooi", 400000, true]},
  logistiek: {klein: ["zendingen", "zending", 9], groot: ["containers", "container", 2500], vlag: ["vrachtcontracten", "vrachtcontract", 1500000, true]},
  financieel: {klein: ["rekeningen", "rekening", 4], groot: ["beleggingsfondsen", "beleggingsfonds", 25000], vlag: ["staatsleningen", "staatslening", 5000000, true]},
  orbitaal: {klein: ["ladingplaatsen", "ladingplaats", 8500], groot: ["satellietlanceringen", "satellietlancering", 900000], vlag: ["satellieten", "satelliet", 40000000, true]},
  consument: {klein: ["stuks", "stuk", 12], groot: ["premium apparaten", "premium apparaat", 450], vlag: ["luxemerken", "luxeproduct", 6000]}};
function stukInfo(p){ if (p.stuk && p.stuk.prijs) return {eenheid: p.stuk.eenheid, enkel: p.stuk.enkel, prijs: p.stuk.prijs, order: !!p.stuk.order}; const a = p.aard || aardVan(p.type, p.naam), r = ((STUK_SCHAAL[a] || STUK_SCHAAL.consument)[p.schaal || "klein"]) || (STUK_SCHAAL[a] || STUK_SCHAAL.consument).klein; return {eenheid: r[0], enkel: r[1], prijs: r[2], order: !!r[3]}; }
/* orders: de verwachte omzet blijft gelijk, maar komt in brokken binnen (gemiddeld eens per drie maanden een order) */
const ORDER_KANS = 0.3;
function orderOmzet(s, ctx, p, o){ if (!(o > 0)) return 0; if (kansRol() >= ORDER_KANS) return 0; const I = stukInfo(p), o2 = o / ORDER_KANS, stuks = Math.max(1, Math.round(o2 * 1e6 / Math.max(1, stukPrijs(p))));
  (p.orders ??= []).push({m: ym(s), stuks, bedrag: r1(o2)}); p.orders = p.orders.slice(-6); if (ctx) ctx.rep.push(`Order: ${stuks} ${stuks === 1 ? I.enkel : I.eenheid} ${p.naam} (€${r1(o2)}M)`); return o2; }
const basisPrijs = p => stukInfo(p).prijs * (0.8 + p.kwaliteit * 0.08);
const stukPrijs = p => Math.round(basisPrijs(p) * prijsF(p));
const kostPrijs = p => Math.round(basisPrijs(p) * PROD_KOST * kostFactor(p));
function levensfase(p){
  if (p.status !== "markt") return p.status === "ontwikkeling" ? "In ontwikkeling" : "Wachtrij";
  const h = p.hist || [], trend = h.length >= 3 ? h[h.length - 1].pop - h[h.length - 3].pop : 0, l = p.leeftijd || 0;
  if (l < 3) return "Introductie"; if (l > 30 || (trend <= -6 && l >= 12)) return "Verval"; if (trend >= 4 && l < 18) return "Groei"; return "Volwassen"; }
/* capaciteit: hoeveel van de vraag je kunt leveren, in dezelfde schaal als populariteit (0-100). Een echte grens. */
function prodCap(s, p){ const d = s.divisions.find(x => divNaam(x) === p.divisie); return Math.round(clamp(60 + 6 * ((d && d.level) || 1) + (p.capExtra || 0), 45, 130)); }
const effBereik = (p, s) => s ? Math.min(vraagNa(p), prodCap(s, p)) : vraagNa(p);
const capVast = (s, p) => r1(((p.capExtra || 0) / 15) * 0.3 * (DIFF[s.player.difficulty] || 1)); /* 4.7.6: elke 15 capaciteit boven of onder de basis kost of bespaart €0,3M per maand */
const capKost = (s, p) => r1((5 + (p.capExtra || 0) / 5) * (DIFF[s.player.difficulty] || 1));
function segment(s, p){
  const a = p.aard || aardVan(p.type, p.naam), mijn = (s.producten || []).filter(x => x.status === "markt" && (x.aard || aardVan(x.type, x.naam)) === a);
  const rival = s.rivals.flatMap(r => (r.producten || []).filter(x => x.aard === a).map(x => ({naam: x.naam, wie: r.name, w: x.kwaliteit * x.pop / 100})));
  const eigen = mijn.map(x => ({naam: x.naam, wie: "jij", w: prodGewicht(x, s), id: x.id})), alle = [...eigen, ...rival], tot = alle.reduce((t, x) => t + x.w, 0) || 1;
  const pc = x => Math.round(x.w / tot * 1000) / 10;
  return {aandeel: pc(eigen.find(x => x.id === p.id) || {w: 0}), concurrenten: rival.sort((x, y) => y.w - x.w).slice(0, 3).map(x => ({naam: x.naam, wie: x.wie, pct: pc(x)})), spelers: alle.length};
}
function prodDetail(s, p, omzet){
  const abo = isAbo(p) && p.abo, cap = prodCap(s, p), vraag = vraagNa(p);
  const sp = abo ? Math.max(1, Math.round(omzet * 1e6 / Math.max(1, p.abo * 10000))) : stukPrijs(p), kp = abo ? Math.round(sp * PROD_KOST * kostFactor(p) / prijsF(p)) : kostPrijs(p), afzet = abo ? Math.round(p.abo * 10000) : omzet > 0 ? Math.round(omzet * 1e6 / sp) : 0;
  return {specs: prodSpecs(p), eenheid: abo ? "abonnees" : stukInfo(p).eenheid, enkel: abo ? "abonnee" : stukInfo(p).enkel, order: !abo && stukInfo(p).order ? {kans: Math.round(ORDER_KANS * 100), verwacht: Math.round(prodOmzet(s, p) * 1e6 / Math.max(1, stukPrijs(p)) * 10) / 10, laatste: (p.orders || []).slice(-3).reverse()} : null, perMaand: !!abo, stukPrijs: sp, kostPrijs: kp, marge: Math.round((sp - kp) / sp * 100), afzet, fase: levensfase(p),
    cap, vraag: Math.round(vraag), uitverkocht: vraag > cap, gemist: vraag > cap ? Math.round((vraag - cap) / vraag * 100) : 0, capKost: capKost(s, p), capVast: capVast(s, p), capKrimp: prodCap(s, p) - 15 >= 45, seg: segment(s, p), hist: (p.hist || []).slice(-12), prijsF: prijsF(p), elast: elast(p), segmenten: segmenten(p, s).rows.map(({vol, ...r}) => r), delen: delenVan(p).map((d, i) => { const k = deelKwal(p, i), eigen = eigenDeel(p, i), lv = leverancier(s, p, i), per = (abo ? sp / prijsF(p) : basisPrijs(p)) * PROD_KOST * d[1] * DEEL_KWAL[k].kost * (eigen ? EIGEN_KORTING : 1);
      return {naam: d[0], aandeel: d[1], spec: (SPECS[p.aard] || SPECS.consument)[d[2]], kwal: k, kost: Math.round(per * 100) / 100, eigen, lev: eigen ? "eigen fabriek" : lv ? lv.naam : "eigen werkplaats"}; }), zelfKost: zelfKost(s), arbeid: Math.round((abo ? sp / prijsF(p) : basisPrijs(p)) * PROD_KOST * ARBEID * 100) / 100, omschakel: omschakelKost(s), auto: {...(p.auto || {})}, marketing: {actief: p.mkt ? {...p.mkt, label: MARKETING[p.mkt.kanaal] ? MARKETING[p.mkt.kanaal].label : "Campagne", seg: (SEGMENTEN[p.aard] || SEGMENTEN.consument)[p.mkt.seg][0]} : null, dezeMaand: p.actie === ym(s), opties: Object.entries(MARKETING).map(([k, M]) => ({key: k, label: M.label, kost: M.kost, zwart: !!M.zwart, tekst: M.tekst, seg: M.doel ? (SEGMENTEN[p.aard] || SEGMENTEN.consument)[mktSegIndex(p, M.doel)][0] : null}))}, kanaal: {key: kanaalVan(p), wissel: kanaalWissel(s), opties: Object.entries(KANAAL).map(([k, K]) => ({key: k, label: K.label, vol: Math.round(K.vol(p) * 100), marge: Math.round(K.marge * 100), vast: K.vast, heat: K.heat, zwart: K.zwart || 0, tekst: K.tekst}))}, keuring: KEURING_AARD.has(p.aard) || p.keuring != null ? {status: keurStatus(p), maanden: keurStatus(p) === "bezig" ? p.keuring.maanden : 0, kost: keurKost(s), omkoop: omkoopKost(s), kans: kans2d6(0, keurDoel(p)), omkoopKans: kans2d6(0, 7), instantie: keurInstantie(p)} : null, defect: defectPct(p), garantie: r1(garantie(p, omzet)), garantieEur: Math.round(garantie(p, omzet) * 1e6), defectRisico: Math.max(0, Math.round((defectPct(p) - DEFECT_DREMPEL) * 10) / 10), beste: p.status === "markt" ? besteprijs(s, p) : null};
}
const prodGewicht = (p, s) => keurF(p) * kanaalF(p) * p.kwaliteit * effBereik(p, s) / 100 * prijsF(p) * (s ? vraagFactor(s, p.aard || aardVan(p.type, p.naam)) * regioF(s, p) * patentF(s, p) * techF(s, p) : 1) * (p.trait === "goedkoop" ? 1.15 : 1) * extraF(p, "omzet"); /* 5.11: regio's; 6.13: extra's van een editie */
const prodSterkte = p => bereik(p) / 100 * (0.5 + p.kwaliteit * 0.15);
function prodEffecten(p){ const A = PRODUCT_AARD[p.aard || "consument"] || PRODUCT_AARD.consument, f = prodSterkte(p), out = {};
  for (const [k2, v] of Object.entries(p.eigenEff || A.eff)) out[k2] = Math.round(v * f * 10) / 10; const pr = ((PRIJS[p.prijs || "standaard"] || {}).rep || 0) + (prijsF(p) > 1.5 ? -0.25 : 0); if (pr) out.reputation = Math.round(((out.reputation || 0) + pr) * 10) / 10;
  for (const [k2, v] of Object.entries(traitEffecten(p))) out[k2] = Math.round(((out[k2] || 0) + v) * 10) / 10; return out; }
const productMacht = s => Math.round((s.producten || []).filter(p => p.status === "markt").reduce((a, p) => a + (prodEffecten(p).macht || 0), 0));
const REVIEW_TEKST = {
  5: ["'Het beste in zijn klasse, en dat weten ze.'", "'Hier wordt over tien jaar nog over gepraat.'"],
  4: ["'Doet wat het belooft, en meer.'", "'Een stille favoriet.'"],
  3: ["'Degelijk. Niet spannend.'", "'Prima, als je niet te veel vraagt.'"],
  2: ["'Te duur voor wat het is.'", "'De handleiding is beter dan het product.'"],
  1: ["'Vermijden.'", "'Een rechtszaak in wording.'"],
};
const REVIEWERS = ["Global Wire", "Neon Consumentenbond", "Chroomgids", "De Straatkrant", "Corporate Weekly"];
function maakReview(p){ const st = clamp(Math.round(p.kwaliteit * 0.6 + p.pop / 40), 1, 5); p.review = {sterren: st, tekst: CH(REVIEW_TEKST[st]), bron: CH(REVIEWERS)}; }
function productEffectTick(s){
  const tot = {};
  for (const p of (s.producten || []).filter(x => x.status === "markt")){
    p.aard ??= aardVan(p.type, p.naam); p.prijs ??= "standaard";
    for (const [k2, v] of Object.entries(prodEffecten(p))) tot[k2] = (tot[k2] || 0) + v;
    { const omz = (s.prodomzet || {})[p.id] || 0; p.hist = [...(p.hist || []), {m: ym(s), pop: Math.round(bereik(p)), omzet: r1(omz), riv: rivaalTop(s, p.aard || aardVan(p.type, p.naam)).pop}].slice(-24); } /* 5.16: 24 mnd en de sterkste concurrent */
    p.omzetTotaal = r1((p.omzetTotaal || 0) + ((s.prodomzet || {})[p.id] || 0));
  }
  if (tot.reputation) s.reputation = clamp(s.reputation + tot.reputation);
  if (tot.heat) s.heat = clamp(s.heat + tot.heat);
  if (tot.morale) s.morale = clamp(s.morale + tot.morale);
  if (tot.invloed) s.invloed = r1((s.invloed || 0) + tot.invloed);
  if (tot.zwart) s.accounts.zwart = r1(s.accounts.zwart + tot.zwart);
  for (const f of ["straat", "politie", "stad", "vakbond", "nomaden"]) if (tot[f]) shiftFaction(s, f, tot[f]);
  return tot;
}
const PRODUCT_EVENTS = [
  {aard: ["wapen"], gen: (s, p, land) => ({van: "Head of Security", titel: `${p.naam} gebruikt bij een overval`, tekst: `Bij een overval in ${land} is een ${p.naam} gevonden. Serienummer intact, onze naam erop. De pers heeft het al.`, opties: [
    {label: "Zwijgen", uitleg: "Heat +5, de straat +3.", eff: {heat: 5, factions: {straat: 3}}},
    {label: "Verkoop aan particulieren stoppen", uitleg: `Populariteit −15, heat −3, reputatie +3.`, eff: {product: {[p.id]: {pop: -15}}, heat: -3, reputation: 3}},
    {label: "Persconferentie · €3M", kost: 3, uitleg: `Kans ${snapKans(58)}%: reputatie +3. Mislukt: reputatie −4.`, eff: {kans: 58, succes: {reputation: 3, tekst: "Het verhaal kantelt: legaal product, illegaal gebruik."}, falen: {reputation: -4, tekst: "De woordvoerder zei het verkeerde woord."}}}], standaard: 0})},
  {aard: ["medisch", "beveiliging"], gen: (s, p, land) => ({van: "PR", titel: `${p.naam} redt levens in ${land}`, tekst: `Na een ramp in ${land} blijkt ${p.naam} het verschil te maken. Overal camera's. Dit is het moment om iets te doen, of te verdienen.`, opties: [
    {label: "Gratis leveren · €4M", kost: 4, uitleg: "Reputatie +6, overheden +5, populariteit +10.", eff: {reputation: 6, factions: {stad: 5}, product: {[p.id]: {pop: 10}}}},
    {label: "Prijs verhogen", uitleg: "+€8M, reputatie −4, het product gaat naar premium.", eff: {cash: 8, reputation: -4, product: {[p.id]: {prijs: "premium"}}}},
    {label: "Gewoon doorleveren", uitleg: "Populariteit +6.", eff: {product: {[p.id]: {pop: 6}}}}], standaard: 2})},
  {aard: ["implantaat"], gen: (s, p) => ({van: "R&D", titel: `Bijwerkingen bij ${p.naam}`, tekst: `Gebruikers van ${p.naam} melden hoofdpijn, tics en één geval van spontaan Portugees. Nog geen rechtszaak. Nog niet.`, opties: [
    {label: "Terugroepen", uitleg: "Populariteit −25, €5M, reputatie +2.", eff: {cash: -5, reputation: 2, product: {[p.id]: {pop: -25}}}},
    {label: "Gratis update · €4M", kost: 4, uitleg: "Populariteit +4, reputatie +2.", eff: {reputation: 2, product: {[p.id]: {pop: 4}}}},
    {label: "Ontkennen", uitleg: `Kans ${snapKans(58)}%: niets aan de hand. Mislukt: reputatie −8, heat +4.`, eff: {kans: 58, succes: {tekst: "Het waait over."}, falen: {reputation: -8, heat: 4, product: {[p.id]: {pop: -15}}, tekst: "Een klokkenluider heeft de testrapporten."}}}], standaard: 2})},
  {aard: ["data", "financieel"], gen: (s, p) => ({van: "IT", titel: `Datalek bij ${p.naam}`, tekst: `Klantgegevens van ${p.naam} liggen op een forum. Het lek is gedicht, de schade niet.`, opties: [
    {label: "Melden en excuses", uitleg: "Reputatie −3, toezicht +4.", eff: {reputation: -3, factions: {politie: 4}}},
    {label: "Toedekken", uitleg: `Kans ${snapKans(58)}%: niemand merkt het. Mislukt: reputatie −8, populariteit −15.`, eff: {kans: 58, succes: {tekst: "Stil gebleven."}, falen: {reputation: -8, product: {[p.id]: {pop: -15}}, tekst: "Een journalist had het al."}}}], standaard: 0})},
  {aard: ["smokkel"], gen: (s, p) => ({van: "Logistiek", titel: `Douane onderschept ${p.naam}`, tekst: `Een zending ${p.naam} staat in beslag. De douanier is te koop, de pers misschien ook.`, opties: [
    {label: "Afkopen · €4M zwart", kost: 4, bron: "zwart", uitleg: "Niets aan de hand.", eff: {tekst: "De container is nooit gevonden."}},
    {label: "Laten gaan", uitleg: "Zwart −€6M aan lading, heat +4.", eff: {zwart: -6, heat: 4}}], standaard: 1})},
  {aard: null, gen: (s, p) => ({van: "Marketing", titel: `${p.naam} gaat viraal`, tekst: `Een filmpje met ${p.naam} gaat de wereld rond. Wachtlijsten in drie landen. Dit duurt niet lang, tenzij we iets doen.`, opties: [
    {label: "Productie opschalen · €5M", kost: 5, uitleg: "Populariteit +22.", eff: {product: {[p.id]: {pop: 22}}}},
    {label: "Naar premium", uitleg: "Populariteit +8, en het product gaat naar premium.", eff: {product: {[p.id]: {pop: 8, prijs: "premium"}}}},
    {label: "Laten lopen", uitleg: "Populariteit +10.", eff: {product: {[p.id]: {pop: 10}}}}], standaard: 2})},
  {aard: null, gen: (s, p) => { const g = gangOf(s, s.player.home_district), gn = g ? g.g.naam : "Rode Lotus";
    return {van: "Juridische Zaken", titel: `Namaak van ${p.naam}`, tekst: `Op de zwarte markt liggen kopieën van ${p.naam}, half zo duur en half zo goed. ${gn} zou erachter zitten.`, opties: [
      {label: "Advocaten · €4M", kost: 4, uitleg: `Kans ${snapKans(58)}%: populariteit +8. Mislukt: geld weg.`, eff: {kans: 58, succes: {product: {[p.id]: {pop: 8}}, tekst: "De kopieën verdwijnen uit de etalages."}, falen: {tekst: "Er komen er meer."}}},
      {label: "Negeren", uitleg: "Populariteit −8.", eff: {product: {[p.id]: {pop: -8}}}}], standaard: 1}; }},
  {aard: null, when: (s, p) => s.rivals.length && p.trait !== "gepatenteerd", gen: (s, p) => { const r = s.rivals.find(x => x.sector === p.type) || CH(s.rivals);
    return {van: "R&D", titel: `${r.name} kopieert ${p.naam}`, tekst: `${r.name} lanceert iets dat verdacht veel op ${p.naam} lijkt. Zelfde ontwerp, andere kleur.`, opties: [
      {label: "Rechtszaak · €6M", kost: 6, uitleg: `Kans ${snapKans(58)}%: hun kopie verdwijnt, populariteit +10. Relatie −15.`, eff: {rivaal: {[r.name]: {relatie: -15}}, kans: 58, succes: {product: {[p.id]: {pop: 10}}, tekst: "De rechter is het met ons eens."}, falen: {tekst: "Net anders genoeg, zegt de rechter."}}},
      {label: "Nieuwe versie versnellen", uitleg: "Een nieuwe versie start direct (gratis, 2 maanden), populariteit −6.", eff: {product: {[p.id]: {pop: -6, versie: 2}}}},
      {label: "Laten", uitleg: "Populariteit −10.", eff: {product: {[p.id]: {pop: -10}}}}], standaard: 2}; }},
];
function productEventTick(s, ctx){
  const markt = (s.producten || []).filter(p => p.status === "markt"); if (!markt.length || R() > 0.16) return;
  if ((s.keuzes || []).some(k => String(k.soort).startsWith("prod_"))) return;
  const p = wpick(markt.map(x => [x, 5 + x.pop + (x.trait === "goedkoop" ? 30 : 0)])); p.aard ??= aardVan(p.type, p.naam);
  if (p.gb && p.gb.length && R() < 0.65){ let vrij = p.gb.filter((g, i) => !(p.gbGebruikt || []).includes(i)); if (!vrij.length){ p.gbGebruikt = []; vrij = p.gb; }
    const g = CH(vrij), gi = p.gb.indexOf(g); (p.gbGebruikt ??= []).push(gi);
    addKeuze(s, ctx, {soort: "prod_" + p.id, gm: true, van: g.van, titel: g.titel, tekst: g.tekst, opties: g.opties.map(o => ({label: o.label, uitleg: o.uitleg, kost: o.kost, eff: gbEff(o.eff, p.id)})), standaard: g.opties.length - 1}); prodLog(p, s, g.titel); return; }
  const opts = PRODUCT_EVENTS.filter(e => (!e.aard || e.aard.includes(p.aard)) && (!e.when || e.when(s, p)));
  const e = wpick(opts.map(x => [x, x.aard ? 2.5 : 1])), land = CH(s.districts).name, k = e.gen(s, p, land);
  k.soort = "prod_" + p.id; addKeuze(s, ctx, k); prodLog(p, s, k.titel);
}
function actPrijs(s, id, prijs){
  const p = (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, msg: "Onbekend."};
  const nf = typeof prijs === "number" ? prijs : PRIJS_F[prijs]; if (nf == null || !isFinite(nf)) return {ok: false, msg: "Onbekende prijs."};
  const oud = prijsF(p), f = Math.round(clamp(nf, PRIJS_MIN, PRIJS_MAX) * 100) / 100; if (Math.abs(f - oud) < 0.005) return {ok: false, msg: "Dat is al de prijs."};
  p.prijsF = f; p.prijs = prijsLabel(f);
  let weg = 0; if (isAbo(p) && f > oud && p.abo){ weg = r1(p.abo * clamp((f - oud) * 0.25 * elast(p), 0, 0.2)); p.abo = r1(p.abo - weg); }
  const verschil = Math.round((f - oud) * 100), msg = `${p.naam}: prijs naar €${stukPrijs(p).toLocaleString("nl-NL")} per ${isAbo(p) ? "abonnee per maand" : "stuk"} (${verschil > 0 ? "+" : ""}${verschil}% van de standaardprijs). ${isAbo(p) ? `${weg ? `${Math.round(weg * 10)} abonnees zeggen meteen op. ` : ""}Opzeggers nu ${Math.round(aboChurn(p) * 1000) / 10}% per maand.` : `Vraag nu ${Math.round(vraagNa(p))} (capaciteit ${prodCap(s, p)}).`}`; addLog(s, msg); return {ok: true, msg};
}

/* ===================== 3.0 VRAAG EN AANBOD, PRODUCTEIGENSCHAPPEN, PRODUCTGESCHIEDENIS ===================== */
const AARD_SECTOR = {wapen: ["Weapon Manufacturing"], medisch: ["Biotech"], implantaat: ["Cyberware"], data: ["Media & Data"], beveiliging: ["Private Security"], smokkel: ["Smokkel"], logistiek: ["Logistiek"], financieel: ["Financieel"], orbitaal: ["Orbitaal"], consument: []};
function vraagInit(s){ s.vraag ??= {}; for (const a of Object.keys(PRODUCT_AARD)) s.vraag[a] ??= {idx: 100, trend: 0, hist: [100], reden: ""}; }
function vraagSchok(s, aard, v, reden){ vraagInit(s); const x = s.vraag[aard]; if (!x) return; x.trend += v; x.reden = reden; }
function aanbod(s, aard){
  const eigen = (s.producten || []).filter(p => p.status === "markt" && (p.aard || aardVan(p.type, p.naam)) === aard).reduce((a, p) => a + p.kwaliteit * p.pop / 100, 0);
  const secs = AARD_SECTOR[aard] || [];
  const riv = s.rivals.reduce((a, r) => a + (r.producten || []).filter(p => p.aard === aard).reduce((b, p) => b + p.kwaliteit * p.pop / 100, 0), 0) + (aard === "wapen" ? s.rivals.filter(r => r.status === "oorlog").length * 0.5 : 0);
  const bed = (s.bedrijven || []).filter(b => !b.eigenaar && secs.includes(b.sector)).length * 0.25;
  return {eigen: r1(eigen), anderen: r1(riv + bed), totaal: r1(eigen + riv + bed)};
}
function vraagFactor(s, aard){
  const x = (s.vraag || {})[aard]; if (!x) return 1;
  const sup = aanbod(s, aard).totaal, verz = sup / Math.max(0.5, x.idx / 100 * 4);
  return Math.round(clamp(x.idx / 100 * (1.2 - 0.2 * verz), 0.6, 1.6) * 100) / 100;
}
/* 5.3: echte-wereldtijdlijn. Elk item: datum, kop, tekst, schok (eenmalige trend per soort) en basis (blijvende verschuiving van de normale vraag, eventueel tot een datum). */
const TIJDLIJN = [
  {d: "2005-06", kop: "Videoplatforms exploderen", tekst: "Iedereen filmt alles. Data wordt goud.", schok: {data: 0.05}, basis: {data: 5}},
  {d: "2007-06", kop: "De telefoon wordt een computer", tekst: "Een toestel met alleen een scherm verandert hoe mensen kopen, praten en betalen.", schok: {consument: 0.08, data: 0.05}, basis: {consument: 6, data: 5}},
  {d: "2008-09", kop: "Bankencrisis", tekst: "Een grote bank valt om, de rest wankelt. Krediet droogt op.", schok: {financieel: -0.15, consument: -0.06, logistiek: -0.05}, basis: {financieel: -10}, tot: "2011-12"},
  {d: "2009-01", kop: "Een munt zonder bank", tekst: "Een anonieme programmeur lanceert digitaal geld. Nog lacht iedereen.", schok: {financieel: 0.03}},
  {d: "2011-03", kop: "Kernramp", tekst: "Een tsunami raakt een kerncentrale. Medische vraag piekt, energie wordt politiek.", schok: {medisch: 0.06, beveiliging: 0.03}},
  {d: "2013-06", kop: "Massasurveillance gelekt", tekst: "Een klokkenluider toont wat geheime diensten allemaal opslaan. Privacy is ineens een product.", schok: {data: -0.05, beveiliging: 0.06}, basis: {beveiliging: 4}},
  {d: "2014-06", kop: "Drones voor iedereen", tekst: "Voor een paar honderd euro vlieg je een camera boven de stad.", schok: {consument: 0.05, logistiek: 0.03}, basis: {logistiek: 3}},
  {d: "2015-03", kop: "Dronegevechten", tekst: "In conflictgebieden vechten goedkope drones tegen dure tanks. Legers bestellen massaal.", schok: {wapen: 0.08}, basis: {wapen: 6}},
  {d: "2017-12", kop: "Cryptogekte", tekst: "Digitaal geld stijgt duizenden procenten. Iedereen is belegger.", schok: {financieel: 0.1}, basis: {financieel: 4}, tot: "2018-12"},
  {d: "2018-03", kop: "Datahandel-schandaal", tekst: "Een advieskantoor gebruikte profielen van miljoenen mensen. Regulators worden wakker.", schok: {data: -0.06}},
  {d: "2020-03", kop: "Pandemie", tekst: "Een virus legt de wereld stil. Ziekenhuizen lopen vol, pakketten stromen.", schok: {medisch: 0.2, logistiek: 0.1, consument: -0.08, beveiliging: 0.03}, basis: {medisch: 8, logistiek: 5}, tot: "2022-06"},
  {d: "2020-09", kop: "Dronecombat wordt mainstream", tekst: "Een korte oorlog wordt gewonnen met zwermen goedkope drones. Elke defensiebegroting gaat om.", schok: {wapen: 0.12}, basis: {wapen: 6}},
  {d: "2022-02", kop: "Oorlog in Europa", tekst: "Tanks rollen over een grens. Wapenfabrieken draaien in drie ploegen, toeleveringsketens knappen.", schok: {wapen: 0.15, logistiek: -0.05, financieel: -0.04}, basis: {wapen: 8}},
  {d: "2022-11", kop: "Chatbots voor iedereen", tekst: "Een taalmodel dat praat als een mens gaat live. Honderd miljoen gebruikers in twee maanden.", schok: {data: 0.12}, basis: {data: 8}},
  {d: "2023-06", kop: "De AI-golf", tekst: "Elke bedrijf wil AI. Rekenkracht wordt schaars, chips worden geopolitiek.", schok: {data: 0.1, financieel: 0.04}, basis: {data: 6}},
  {d: "2024-01", kop: "Commerciële ruimtevaart", tekst: "Herbruikbare raketten maken een lancering goedkoper dan een zeecontainer van vroeger.", schok: {orbitaal: 0.1}, basis: {orbitaal: 8}},
  {d: "2026-06", kop: "Humanoïde robots", tekst: "De eerste robots met handen staan in fabrieken en magazijnen.", schok: {consument: 0.06, logistiek: 0.05, implantaat: 0.04}, basis: {logistiek: 4}},
  {d: "2028-03", kop: "Neurale interface voor consumenten", tekst: "Een implantaat dat je telefoon vervangt. De wachtlijst is twee jaar.", schok: {implantaat: 0.15}, basis: {implantaat: 10}},
  {d: "2030-01", kop: "De AI-wet", tekst: "Strenge regels voor algoritmen. Wie niet meedoet, betaalt of verhuist.", schok: {data: -0.08, beveiliging: 0.04}, basis: {data: -4}},
  {d: "2032-05", kop: "Privélegers erkend", tekst: "Een verdrag erkent bedrijfslegers als gewapende partij. Beveiliging wordt soevereiniteit.", schok: {beveiliging: 0.12, wapen: 0.06}, basis: {beveiliging: 8, wapen: 4}},
  {d: "2035-01", kop: "Orbitale fabrieken", tekst: "In een baan om de aarde maken fabrieken wat op aarde niet kan.", schok: {orbitaal: 0.12}, basis: {orbitaal: 8}},
  {d: "2038-01", kop: "Chroom-mode", tekst: "Implantaten zijn mode. Wie geen chroom draagt, valt op.", schok: {implantaat: 0.1, consument: 0.04}, basis: {implantaat: 6}},
  {d: "2040-01", kop: "Corporate steden", tekst: "De eerste stad wordt bestuurd door een bedrijf. Andere volgen.", schok: {beveiliging: 0.08, smokkel: 0.05}, basis: {beveiliging: 5}}];
/* 5.4: corpospanning per continent (zoals world tension): stijgt met de tijd, oorlogen, bendeoorlogen, corpomacht en wereldgebeurtenissen */
const SPANNING_FASEN = [[90, "Corporate zone", "De corporaties regeren. De politie kijkt de andere kant op; heat zakt sneller op je eigen continent."], [70, "Privélegers", "Bedrijven zetten eigen legers op straat. Vraag naar wapens en beveiliging piekt; op je eigen continent zakt heat trager."], [50, "Sancties", "Embargo's en sancties. Staten proberen de corporaties terug te dringen; op je eigen continent zakt heat trager."], [30, "Onrust", "Protesten, stakingen en sabotage. De sfeer wordt grimmig."], [0, "Rustig", "Zaken zoals altijd."]];
const spanningFase = v => SPANNING_FASEN.find(([d]) => v >= d);
const SPANNING_TIJDLIJN = {"2015-03": {"Midden-Oosten": 5}, "2020-09": {"Midden-Oosten": 5, "Azië": 3}, "2022-02": {"Europa": 12}, "2032-05": {"*": 8}, "2040-01": {"*": 10}};
function spanningTick(s, ctx){ const S0 = (s.spanning ??= {}), nu = ym(s); for (const c of CONTINENTS) S0[c.naam] ??= RI(8, 25);
  const contVan = id => (s.districts.find(d => d.id === id) || {}).continent, ev = SPANNING_TIJDLIJN[nu];
  for (const c of CONTINENTS){ const n = c.naam, oud = S0[n];
    let d = (0.18 + 0.05 * (s.tijdperk || 0)) * inst(s, "spanning") + U(-0.2, 0.2); /* 6.8: iets sneller */
    d += Math.min(0.35, (((s.handelWapen || {})[n]) || 0) / 60); /* 6.8: wie wapens verkoopt, warmt het continent op */
    d += s.rivals.filter(r => r.status === "oorlog" && contVan(r.hq) === n).length * 0.4;
    d += (s.gangs || []).filter(g => g.deal === "oorlog" && Object.keys(g.gebied || {}).some(id => contVan(id) === n)).length * 0.2;
    d += s.districts.filter(x => x.control === "player" && x.continent === n).length * 0.03;
    if (ev) d += (ev[n] || 0) + (ev["*"] || 0);
    if (oud > 15) d -= 0.04;
    S0[n] = Math.round(clamp(oud + d, 0, 100) * 10) / 10;
    const f0 = spanningFase(oud), f1 = spanningFase(S0[n]); if (f1[0] > f0[0]){ const ef = spanningEffecten(s, n).filter(e => e.soort === "vraag").map(e => e.t).join(", "); news(s, `${n}: ${f1[1]}`, `De corpospanning in ${n} loopt op tot ${Math.round(S0[n])}. ${f1[2]}${ef ? ` Vraag daar nu: ${ef}.` : ""}`, n, "wereld", true); ctx.rep.push(`Corpospanning ${n}: ${f1[1]}${ef ? ` (${ef})` : ""}`);
      if (n === exportThuis(s)) mail(ctx, s, "Strategie", `Thuiscontinent: ${f1[1]}`, `De corpospanning in ${n} staat op ${Math.round(S0[n])}. ${f1[2]} Wat dit voor ons betekent: ${spanningEffecten(s, n).map(e => e.t).join(", ") || "nog weinig"}. Alles staat bij Wereld → Corpospanning.`, f1[0] >= 70 ? "HOOG" : "NORMAAL"); } } }
/* 5.4.1: Sancties en Privélegers op je thuiscontinent: staten zitten corporaties op de huid (heat zakt trager); Corporate zone: politie kijkt weg */
const spanningThuis = s => (s.spanning || {})[(s.districts.find(x => x.id === s.player.home_district) || {}).continent] || 0;
const spanningHeat = s => { const v = spanningThuis(s); return (v >= 90 ? 1 : v >= 50 ? -0.6 : 0) + (heeftWet(s, "immuniteit") ? 0.8 : 0); };
/* 5.5: straatoorlog en corpomacht. Bij hoge spanning mag je eigen beveiliging de straat op, vecht je om districten zonder oorlogsverklaring en koop je corpowetten met invloed. Meer macht = meer mogen. */
const spanningVan = (s, cont) => (s.spanning || {})[cont] || 0;
/* 6.14: wat een oorlog verklaren kost hangt af van de corpospanning thuis: in een corporate zone is het een corpo-oorlog, zonder rem van de staat */
const oorlogPrijs = s => { const v = spanningThuis(s); return v >= 90 ? {rep: 0, heat: 0, wantrouw: 0, corpo: true} : v >= 70 ? {rep: 2, heat: 1, wantrouw: 2, corpo: false} : {rep: 4, heat: 3, wantrouw: 5, corpo: false}; };
const CORPO_LADDER = [
  {v: 0, naam: "Rustig", kort: "Zaken zoals altijd. De staat houdt de corporaties in toom.", jij: ["Producten, contracten, districten kopen en aanwezigheid opbouwen", "Oorlog verklaren kan, maar de staat let op: reputatie −4, heat +3, andere rivalen worden wantrouwig"], riv: ["Concurreren, lobbyen, headhunten", "Een ultimatum stellen; weiger je, dan is het oorlog"]},
  {v: 30, naam: "Onrust", kort: "Protesten en sabotage. De staat verliest grip op de straat.", jij: ["Wapens en beveiliging verkopen beter, consumentenspul slechter", "Je aandeel in districten groeit makkelijker: de staat telt minder mee"], riv: ["Hetzelfde voordeel als jij"]},
  {v: 50, naam: "Sancties", kort: "Staten slaan terug met embargo's en sancties.", jij: ["Embargo op export: alleen met een smokkelroute verkoop je wapens nog over de grens", "De Privébeveiligingswet kopen: dan mag je al patrouilleren", "Op je thuiscontinent zakt heat trager"], riv: ["Hetzelfde embargo"]},
  {v: 70, naam: "Privélegers", kort: "Corporaties zetten eigen legers op straat.", jij: ["Patrouilles in je districten (macht +2, bendes en rivalen krijgen minder grip)", "Straatgevechten: een district van een rivaal innemen zonder oorlogsverklaring", "Bedrijfsimmuniteit en de Belastingvrije corpozone kopen", "Oorlog verklaren kost minder: reputatie −2, heat +1"], riv: ["Rivalen die je niet mogen, nemen ook districten van jou op straat (hooguit één per maand)"]},
  {v: 90, naam: "Corporate zone", kort: "De corporaties regeren. Corpo-oorlogen: geen staat die ingrijpt.", jij: ["Corpo-oorlog: oorlog verklaren kost geen reputatie en geen heat, andere rivalen vinden het normaal", "Eigen rechtspraak kopen: een razzia lukt half zo vaak", "Heat zakt sneller, het embargo is weg", "Winnen: een corporate zone thuis met 60% dominantie"], riv: ["Vijandige rivalen (relatie onder −40) kunnen jou zelf de oorlog verklaren, zonder ultimatum"]}];
const corpoTrede = v => CORPO_LADDER.slice().reverse().find(x => v >= x.v) || CORPO_LADDER[0];
/* 6.8: alle gevolgen van de spanning op één continent, in gewone taal (voor het tabblad, de header en het nieuws) */
const SPANNING_AARD_LABEL = {wapen: "Wapens", beveiliging: "Beveiliging", smokkel: "Smokkel", medisch: "Medisch", consument: "Consument", financieel: "Financieel", logistiek: "Logistiek"};
function spanningEffecten(s, cont){ const v = spanningVan(s, cont), out = [], thuis = cont === exportThuis(s);
  for (const a of Object.keys(SPANNING_VRAAG)){ const f = spanningVraagF(a, v); if (Math.abs(f - 1) >= 0.03) out.push({t: `${SPANNING_AARD_LABEL[a]} ×${f.toFixed(2)}`, goed: f > 1, soort: "vraag"}); }
  if (v >= 50 && v < 90) out.push({t: "Embargo op export", goed: false, soort: "export"});
  if (thuis && v >= 90) out.push({t: "Heat zakt sneller", goed: true, soort: "heat"}); else if (thuis && v >= 50) out.push({t: "Heat zakt trager", goed: false, soort: "heat"});
  if (v >= patrouilleDrempel(s)) out.push({t: "Patrouilles mogen", goed: true, soort: "macht"});
  if (v >= STRAAT.drempel) out.push({t: "Straatgevechten", goed: null, soort: "macht"});
  if (v >= 30) out.push({t: `Staat ${Math.round(v)}% zwakker`, goed: true, soort: "dom"});
  return out; }
const CORPOWETTEN = {
  beveiliging: {label: "Privébeveiligingswet", fase: 50, inv: 20, cash: 15, macht: 0, uitleg: "Patrouilles mogen al vanaf 50 spanning (Sancties), kosten €0,8M in plaats van €1,5M per maand en geven geen heat."},
  immuniteit: {label: "Bedrijfsimmuniteit", fase: 70, inv: 35, cash: 40, macht: 40, uitleg: "Heat zakt elke maand 0,8 extra."},
  zone: {label: "Belastingvrije corpozone", fase: 70, inv: 40, cash: 50, macht: 50, uitleg: "Winstbelasting 5 procentpunt lager."},
  rechtspraak: {label: "Eigen rechtspraak", fase: 90, inv: 60, cash: 80, macht: 65, uitleg: "Bij heat boven 90 lukt een razzia maar half zo vaak."},
};
const heeftWet = (s, k) => !!(s.wetten || {})[k];
const patrouilleDrempel = s => heeftWet(s, "beveiliging") ? 50 : 70;
const patrouilleMag = (s, d) => !!d && d.control === "player" && spanningVan(s, d.continent) >= patrouilleDrempel(s);
const patrouilleKost = s => heeftWet(s, "beveiliging") ? 0.8 : 1.5;
const patrouilles = s => Object.keys(s.patrouille || {}).filter(id => (s.districts.find(d => d.id === id) || {}).control === "player");
const STRAAT = {kost: 12, drempel: 70};
const straatKost = s => r1(STRAAT.kost * (DIFF[s.player.difficulty] || 1));
function straatKans(s, d){ const r = s.rivals.find(x => x.name === d.control); if (!r) return 0;
  const buur = (d.neighbors || []).filter(n => (s.patrouille || {})[n] && (s.districts.find(x => x.id === n) || {}).control === "player").length;
  return warChance(s, r, 5 + Math.min(3, buur) * 6 + (spanningVan(s, d.continent) >= 90 ? 5 : 0)); }
const straatDoelen = s => s.districts.filter(d => d.control !== "player" && d.control !== "neutral" && spanningVan(s, d.continent) >= STRAAT.drempel && s.rivals.some(r => r.name === d.control && r.hq !== d.id) && reachable(s, "player", d));
function wetStatus(s, k){ const w = CORPOWETTEN[k], thuis = spanningThuis(s), macht = playerPower(s);
  if (heeftWet(s, k)) return {ok: false, reden: "van kracht", actief: true};
  if (thuis < w.fase) return {ok: false, reden: `pas vanaf ${w.fase} spanning op je thuiscontinent (nu ${Math.round(thuis)})`};
  if (macht < w.macht) return {ok: false, reden: `je macht moet minstens ${w.macht} zijn (nu ${macht})`};
  if ((s.invloed || 0) < w.inv) return {ok: false, reden: `${w.inv} invloed nodig (je hebt ${Math.floor(s.invloed || 0)})`};
  if (s.cash < w.cash) return {ok: false, reden: `€${w.cash}M nodig`};
  return {ok: true, reden: ""}; }
function actCorpo(s, ctx, soort, id){
  if (soort === "patrouille"){ const d = s.districts.find(x => x.id === id); if (!d || d.control !== "player") return {ok: false, msg: "Kies een district van jezelf."};
    const P = (s.patrouille ??= {}); if (P[id]){ delete P[id]; addLog(s, `Patrouille in ${d.name} gestopt`); return {ok: true, msg: `Patrouille in ${d.name} gestopt.`}; }
    if (!patrouilleMag(s, d)) return {ok: false, msg: `In ${d.continent} mag dat pas vanaf ${patrouilleDrempel(s)} corpospanning (nu ${Math.round(spanningVan(s, d.continent))}).`};
    P[id] = ym(s); addLog(s, `Patrouille in ${d.name} gestart`);
    return {ok: true, msg: `Eigen beveiliging patrouilleert in ${d.name}: €${patrouilleKost(s)}M per maand, bendes krijgen minder grip, je macht +2${heeftWet(s, "beveiliging") ? "" : ", heat +0,25 per maand"}.`}; }
  if (soort === "straat"){ const d = s.districts.find(x => x.id === id); if (!d || !straatDoelen(s).includes(d)) return {ok: false, msg: `Hier kun je niet op straat vechten. Het district moet van een rivaal zijn (niet hun HQ), aan je gebied grenzen en op een continent met minstens ${STRAAT.drempel} spanning liggen.`};
    const r = s.rivals.find(x => x.name === d.control), kost = straatKost(s); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
    s.cash = r1(s.cash - kost); const kans = straatKans(s, d), roll = rolKans(kans), zone = spanningVan(s, d.continent) >= 90 ? 0.5 : 1;
    addRoll(s, `Straatgevecht om ${d.name} tegen ${r.name}: ${roll.txt} → ${roll.ok ? "GELUKT" : "MISLUKT"}`); let msg;
    if (roll.ok){ d.control = "player"; relShift(r, -15); r.moeheid = clamp(r.moeheid + 8); s.heat = clamp(s.heat + 5 * zone); s.spanning[d.continent] = r1(Math.min(100, spanningVan(s, d.continent) + 1));
      msg = `Onze mensen hebben ${d.name} op straat veroverd. ${r.name} is het district kwijt.`; remember(r, s, "straatgevecht door speler");
      news(s, `Straatgevecht in ${d.name}`, `Gepantserde wagens, rookgranaten, een nacht lang. Bij zonsopgang hangen er andere logo's in ${d.name}.`, d.continent, "wereld", true); }
    else { const l = r1(U(4, 10)); s.cash = r1(s.cash - l); relShift(r, -8); s.heat = clamp(s.heat + 3 * zone); msg = `Het straatgevecht om ${d.name} is mislukt. €${l}M schade en ${r.name} weet wie het was.`; }
    mail(ctx, s, roll.ok ? "Head of Security" : "Juridische Zaken", `Straatgevecht om ${d.name}: ${roll.ok ? "gelukt" : "mislukt"}`, msg + ` (Worp ${roll.txt}.)`, roll.ok ? "NORMAAL" : "HOOG");
    addLog(s, msg); s.accounts.operationeel = s.cash; return {ok: true, msg: msg + ` Worp ${roll.txt}.`}; }
  if (soort === "wet"){ const w = CORPOWETTEN[id]; if (!w) return {ok: false, msg: "Onbekende wet."}; const st = wetStatus(s, id); if (!st.ok) return {ok: false, msg: `${w.label}: ${st.reden}.`};
    s.invloed = r1(s.invloed - w.inv); s.cash = r1(s.cash - w.cash); (s.wetten ??= {})[id] = ym(s); s.accounts.operationeel = s.cash;
    news(s, `${w.label} aangenomen`, `Na een stille stemming en een paar dure diners ligt er een nieuwe wet. ${s.player.corp_name} staat niet in de tekst, maar iedereen weet voor wie hij is.`, "", "wereld", true);
    addLog(s, `Corpowet ${w.label} gekocht (${w.inv} invloed, €${w.cash}M)`); return {ok: true, msg: `${w.label} is van kracht: ${w.uitleg}`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function corpoTick(s, ctx){
  if (spanningThuis(s) >= 90 && !s.rivals.some(r => r.status === "oorlog")){ /* 6.14: corpo-oorlog van een vijandige rivaal, hooguit één tegelijk */
    const r = s.rivals.find(x => x.status === "vrede" && (x.relatie || 0) < -40 && !(x.verdragen || []).length); if (r && kansRol() < 0.04 + (r.aggression || 0) * 0.04){
      r.status = "oorlog"; r.statusMaanden = 0; r.moeheid = 0; r.corpo = true; remember(r, s, "verklaarde de speler een corpo-oorlog");
      mail(ctx, s, r.ceo || r.name, `Corpo-oorlog: ${r.name}`, `Geen ultimatum, geen advocaten. In een corporate zone hoeft dat niet meer. ${r.name} verklaart ${s.player.corp_name} de oorlog. De staat kijkt weg. Vrede kan, bij Rivalen, als je ze genoeg pijn doet of betaalt.`, "KRITIEK");
      news(s, `Corpo-oorlog: ${r.name} tegen ${s.player.corp_name}`, `In de corporate zone verklaart ${r.name} openlijk de oorlog. Niemand belt de politie; die werkt er inmiddels.`, "", "wereld", true); ctx.rep.push(`${r.name} verklaart je een corpo-oorlog`); } }
  if (s.patrouille) s.patrouille = Object.fromEntries(patrouilles(s).map(id => [id, s.patrouille[id]]));
  /* rivalen die je niet mogen vechten bij hoge spanning ook op straat, zonder oorlogsverklaring: hooguit één gevecht per maand */
  for (const r of s.rivals){ if (r.status === "oorlog" || (r.relatie || 0) > -20) continue;
    const doel = playerDistricts(s).filter(d => d.id !== s.player.home_district && spanningVan(s, d.continent) >= STRAAT.drempel && reachable(s, r.name, d));
    if (!doel.length || kansRol() >= 0.03 + (r.aggression || 0) * 0.03) continue;
    const d = CH(doel), pat = !!(s.patrouille || {})[d.id], hit = R() * 100 < rivalHitChance(s, r, pat ? -25 : 0);
    if (hit){ d.control = r.name; if (s.patrouille) delete s.patrouille[d.id]; mail(ctx, s, "Head of Security", `${r.name} neemt ${d.name} op straat`, `Zonder oorlogsverklaring, zonder waarschuwing: privélegers van ${r.name} hebben ${d.name} ingenomen. In deze spanning grijpt niemand in.${pat ? "" : " Een patrouille had het moeilijker gemaakt."}`, "KRITIEK"); ctx.rep.push(`${r.name} neemt ${d.name} op straat`); }
    else { mail(ctx, s, "Head of Security", `Straatgevecht in ${d.name} afgeslagen`, `${r.name} probeerde ${d.name} op straat in te nemen. ${pat ? "Onze patrouille hield stand." : "We hielden stand, deze keer."}`, "NORMAAL"); ctx.rep.push(`Straatgevecht in ${d.name} afgeslagen`); }
    break; } }
/* 5.6: gebied als dominantie. Elk district is verdeeld in aandelen (eigenaar, jij, rivalen, bendes, de staat), net als de zee. Je aandeel groeit door aanwezigheid, patrouilles en buren; continenten en hegemonie tellen aandelen in plaats van eigenaars. */
const DOM_FLIP = 55, DOM_INKOMEN_MIN = 20;
function domDoel(s, d, idx){ const o = {}, sp = spanningVan(s, d.continent), staatF = 1 - sp / 100;
  if (d.control !== "neutral") o[d.control] = 100;
  o.staat = d.control === "neutral" ? 5 + 40 * staatF : 15 * staatF;
  const A = s.aanwezig || {}; if (A[d.id]) o.player = (o.player || 0) + A[d.id];
  const H = handelAanwezig(s, d.continent); if (H) o.player = (o.player || 0) + H; /* 6.8: wie veel verkoopt op een continent, is daar overal aanwezig */
  for (const [rn, RA] of Object.entries(s.rivAanwezig || {})) if (RA[d.id]) o[rn] = (o[rn] || 0) + RA[d.id]; /* 6.2: rivalen bouwen ook aanwezigheid op */
  if ((s.patrouille || {})[d.id] && d.control === "player") o.player = (o.player || 0) + 15;
  const adj = {}; for (const n of d.neighbors || []){ const b = idx ? idx.get(n) : s.districts.find(x => x.id === n); if (b && b.control !== "neutral") adj[b.control] = (adj[b.control] || 0) + 4; }
  for (const [k, v] of Object.entries(adj)) o[k] = (o[k] || 0) + Math.min(12, v);
  for (const r of s.rivals) if (r.hq === d.id) o[r.name] = (o[r.name] || 0) + 20;
  for (const g of s.gangs || []){ const v = (g.gebied || {})[d.id]; if (v >= 5) o["bende:" + g.naam] = v * 0.4; }
  const tot = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / tot * 100])); }
const domVan = (s, d) => d.dom || domDoel(s, d);
const domEigenaar = (s, d) => { const D = domVan(s, d); return d.control === "neutral" ? (D.staat || 0) : (D[d.control] || 0); };
const aanwezigKost = (s, d) => r1(Math.max(2, districtCost(s, d) * 0.15)); /* 6.8: was een kwart van een vestiging */
const AANWEZIG_STAP = 20, HANDEL_MAX = 20;
/* 6.8: concurreren via handel. Je omzet per continent (producten verdeeld over hun markten; wapens/beveiliging/implantaten alleen thuis en waar je een vergunning hebt) geeft je aanwezigheid in elk district daar. */
function productContinenten(s, p){ const aard = p.aard || aardVan(p.type, p.naam);
  if (EXPORT_AARD.includes(aard)){ const L = [exportThuis(s), ...Object.keys(s.exportVergunning || {}).filter(c => !embargo(s, c) || (s.smokkelroute || {})[c])].filter(Boolean); return [...new Set(L)].map(c => [c, 1 / new Set(L).size]); }
  const M = regioMarkten(p).filter(c => REGIO[c]), tw = M.reduce((a, c) => a + REGIO[c].w, 0) || 1; return M.map(c => [c, REGIO[c].w / tw]); }
function handelTick(s){ const H = {}, W = {};
  for (const p of (s.producten || []).filter(x => x.status === "markt")){ const o = ((s.prodomzet || {})[p.id] || 0) + ((s.exportOmzet || {})[p.id] || 0); if (!(o > 0)) continue; const aard = p.aard || aardVan(p.type, p.naam);
    for (const [c, f] of productContinenten(s, p)){ H[c] = (H[c] || 0) + o * f; if (aard === "wapen" || aard === "beveiliging") W[c] = (W[c] || 0) + o * f; } }
  s.handel = Object.fromEntries(Object.entries(H).map(([k, v]) => [k, r1(v)])); s.handelWapen = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, r1(v)])); }
const handelAanwezig = (s, cont) => { const v = (s.handel || {})[cont] || 0; return v > 0 ? Math.min(HANDEL_MAX, Math.round(Math.sqrt(v) * 5 * 10) / 10) : 0; };
const aanwezigMag = (s, d) => !!d && reachable(s, "player", d);
function aandeelInkomen(s){ let geld = 0, n = 0; for (const d of s.districts){ if (d.control === "player" || !d.dom) continue; const v = d.dom.player || 0; if (v >= DOM_INKOMEN_MIN){ geld += incOf(d) * v / 100 * 0.4; n++; } } return {geld: r1(geld), n}; }
function actAanwezig(s, ctx, id){ const d = s.districts.find(x => x.id === id); if (!d) return {ok: false, msg: "Onbekend district."};
  if (!aanwezigMag(s, d)) return {ok: false, msg: `${d.name} grenst niet aan jouw gebied en ligt niet aan een zee die jij beheerst.`};
  const kost = aanwezigKost(s, d); if (s.cash < kost) return {ok: false, msg: `Niet genoeg cash (€${kost}M nodig).`};
  const A = (s.aanwezig ??= {}); if ((A[d.id] || 0) >= 150) return {ok: false, msg: `Je aanwezigheid in ${d.name} is al maximaal.`};
  s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash; A[d.id] = Math.min(150, r1((A[d.id] || 0) + AANWEZIG_STAP));
  const r = s.rivals.find(x => x.name === d.control); if (r){ relShift(r, -4); remember(r, s, `speler bouwt aanwezigheid in ${d.name}`); }
  addLog(s, `Aanwezigheid in ${d.name} +${AANWEZIG_STAP} (€${kost}M)`);
  return {ok: true, msg: `Kantoren, sponsoring, mensen op straat: je aanwezigheid in ${d.name} groeit (+${AANWEZIG_STAP}, zakt 5% per maand). ${d.control === "player" ? "Je houdt je greep sterker." : `Boven ${DOM_FLIP}% en meer dan de ${d.control === "neutral" ? "staat" : "eigenaar"}, twee maanden lang, wordt het district van jou.`}${r ? ` ${r.name} vindt het niets: relatie −4.` : ""}`}; }
function domTick(s, ctx){ handelTick(s);
  const idx = new Map(s.districts.map(x => [x.id, x])), hqs = new Set(s.rivals.map(r => r.hq));
  for (const d of s.districts){ const doel = domDoel(s, d, idx), oud = d.dom || doel, nw = {};
    for (const k of new Set([...Object.keys(oud), ...Object.keys(doel)])){ const v = (oud[k] || 0) + ((doel[k] || 0) - (oud[k] || 0)) * 0.4; if (v >= 0.5) nw[k] = Math.round(v * 10) / 10; }
    d.dom = nw; }
  rivAanwezigTick(s, ctx, idx, hqs);
  for (const d of s.districts){ if (d.control === "player" || hqs.has(d.id)){ delete d.domMnd; continue; }
    const pj = d.dom.player || 0, eig = domEigenaar(s, d);
    if (pj >= DOM_FLIP && pj > eig) d.domMnd = (d.domMnd || 0) + 1; else delete d.domMnd;
    if ((d.domMnd || 0) >= 2){ const r = s.rivals.find(x => x.name === d.control), van = d.control; d.control = "player"; delete d.domMnd;
      if (r){ relShift(r, -12); remember(r, s, `verloor ${d.name} aan de dominantie van de speler`); }
      const txt = `${d.name} is van jou: je aandeel (${Math.round(pj)}%) is groter dan dat van ${van === "neutral" ? "de staat" : van}. Zonder één schot.`;
      mail(ctx, s, "Strategie", `${d.name} valt jou toe`, txt + (r ? ` ${r.name} is woedend: relatie −12.` : ""), "NORMAAL"); ctx.rep.push(`${d.name} valt jou toe door dominantie`);
      news(s, `${s.player.corp_name} neemt ${d.name} over`, `Geen tanks, geen bod: gewoon overal hun logo, hun mensen en hun geld. ${d.name} draait nu op ${s.player.corp_name}.`, d.continent, "wereld", true); addLog(s, txt); } }
  if (s.aanwezig) for (const k of Object.keys(s.aanwezig)){ s.aanwezig[k] = r1(s.aanwezig[k] * 0.95); if (s.aanwezig[k] < 1) delete s.aanwezig[k]; } }
/* 5.8: mensen doen echt werk. Taken die je aan iemand in de directie geeft: die persoon doet ze elke maand voor je, met talent (1-5) en loyaliteit. Lage loyaliteit = soms laten liggen. */
const ASSISTENT_TAKEN = {
  facturen: {label: "Facturen betalen", rol: "CFO", re: /\bcfo\b|financ/i, uitleg: "Betaalt elke vervallen factuur zolang er €20M in kas blijft. Talent 4+: onderhandelt 5% korting."},
  budget: {label: "Kas bewaken", rol: "CFO", re: /\bcfo\b|financ/i, uitleg: "Houdt €30M buffer: haalt zwart geld naar operationeel of leent klein bij tekort, lost schuld af bij ruim overschot."},
  prijzen: {label: "Prijzen zetten", rol: "Verkoopchef", re: /verkoop|sales/i, uitleg: "Zet elke maand elk product op de prijs met de meeste winst (nooit boven 150%). Het effect zie je in het maandrapport."},
  werven: {label: "Personeel werven", rol: "HR-manager", re: /\bhr\b|personeel/i, uitleg: "Neemt mensen aan tot je personeel op het nodige niveau is (zolang er €40M in kas blijft)."},
  ontwikkelen: {label: "Producten voorstellen", rol: "Hoofd R&D", re: /r&d|onderzoek/i, uitleg: "Start een nieuw product zodra een divisie plek heeft en er geld is. Talent 4+: middelgrote producten."},
  straat: {label: "Straat bewaken", rol: "Head of Security", re: /security|beveilig/i, uitleg: "Zet patrouilles in districten die een rivaal op straat kan innemen."},
};
const ASSISTENT_ROLLEN = ["CFO", "Verkoopchef", "HR-manager", "Hoofd R&D", "Head of Security"];
const GEHEIMEN = ["Solliciteert stiekem bij een rivaal.", "Heeft een gokschuld.", "Speelt informatie door aan een journalist.", "Was ooit veroordeeld voor fraude.", "Heeft geen geheimen. Verdacht.", "Werkt 's nachts voor een bende."];
const taakDoener = (s, k) => { const T = ASSISTENT_TAKEN[k]; return T ? (s.npcs || []).find(n => !n.verraad && T.re.test(n.role || "")) || null : null; };
const talentVan = n => n ? (n.talent ?? 3) : 0;
const aannemenKost = s => r1(5 * (DIFF[s.player.difficulty] || 1));
function assistentDoet(s, ctx, k){ if (!(s.taken || {})[k]) return null; const n = taakDoener(s, k); if (!n) return null;
  if (n.loyalty < 30 && kansRol() < 0.4){ ctx.rep.push(`${n.name} liet "${ASSISTENT_TAKEN[k].label.toLowerCase()}" liggen (loyaliteit laag)`); return null; } return n; }
function actTaak(s, ctx, k, aan){ const T = ASSISTENT_TAKEN[k]; if (!T) return {ok: false, msg: "Onbekende taak."}; const n = taakDoener(s, k);
  if (aan && !n) return {ok: false, msg: `Niemand in de directie kan dit. Neem een ${T.rol} aan.`};
  (s.taken ??= {})[k] = !!aan; if (!aan) delete s.taken[k];
  return {ok: true, msg: aan ? `${n.name} (${n.role}) doet voortaan: ${T.label.toLowerCase()}.` : `${T.label}: weer zelf doen.`}; }
function actAannemen(s, ctx, rol){ if (!ASSISTENT_ROLLEN.includes(rol)) return {ok: false, msg: "Onbekende functie."};
  if ((s.npcs || []).some(n => !n.verraad && n.role === rol)) return {ok: false, msg: `Je hebt al een ${rol}.`};
  const kost = aannemenKost(s); if (s.cash < kost) return {ok: false, msg: `Werving kost €${kost}M.`};
  const talent = RI(2, 5), n = {name: genCeoNaam(new Set(s.npcs.map(x => x.name))), role: rol, loyalty: RI(45, 65), ambition: RI(20, 75), secret: CH(GEHEIMEN), talent, loon: r1(0.2 + 0.15 * talent), sinds: ym(s)};
  s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash; s.npcs.push(n); addLog(s, `${n.name} aangenomen als ${rol} (talent ${talent})`);
  return {ok: true, msg: `${n.name} begint als ${rol}. Talent ${talent} van 5, loon €${n.loon}M per maand. Geef ${n.name} taken bij Mensen → Assistenten.`}; }
const directieLoon = s => r1((s.npcs || []).filter(n => !n.verraad && n.loon).reduce((a, n) => a + n.loon, 0));
function assistentTick(s, ctx){ if (!s.taken) return; const R0 = [];
  { const n = assistentDoet(s, ctx, "budget"); if (n){
    if (s.cash < 30 && s.accounts.zwart > 5){ const b = Math.floor(Math.min(s.accounts.zwart, 40 - s.cash)); if (b > 0){ const r = actTransfer(s, ctx, "zwart", "operationeel", b); if (r.ok) R0.push(`${n.name}: €${b}M zwart naar operationeel`); } }
    else if (s.cash < 10){ const b = Math.min(30, Math.max(5, loanCap(s))); if (b >= 5){ const r = actLoan(s, b); if (r.ok) R0.push(`${n.name}: lening van €${b}M`); } }
    else if (s.cash > 200 && s.debt > 0){ const b = r1(Math.min(s.debt, s.cash - 150)); const r = actRepay(s, b); if (r.ok) R0.push(`${n.name}: €${b}M schuld afgelost`); } } }
  { const n = assistentDoet(s, ctx, "prijzen"); if (n){ let k = 0; for (const p of (s.producten || []).filter(x => x.status === "markt")){ const b = besteprijs(s, p), nf = b ? Math.min(b.f, 1.5) : null; if (nf && Math.abs(nf - prijsF(p)) >= 0.05 && actPrijs(s, p.id, nf).ok) k++; } if (k) R0.push(`${n.name}: ${k} prijs(en) aangepast`); } }
  { const n = assistentDoet(s, ctx, "werven"); if (n){ const tekort = staffNeed(s) - s.staff.count; if (tekort > 0){ const m = Math.min(50, tekort, Math.floor((s.cash - 40) / 0.4)); if (m > 0 && actStaff(s, "huren", m).ok) R0.push(`${n.name}: ${m} mensen aangenomen`); } } }
  { const n = assistentDoet(s, ctx, "ontwikkelen"); if (n) for (const d of s.divisions){ if ((d.autoDev || {}).aan) continue; const nm = divNaam(d), alle = (s.producten || []).filter(p => p.divisie === nm && p.status !== "teruggeroepen");
    if (alle.length >= maxProducten(d) || alle.some(p => p.status === "ontwikkeling" || p.status === "wachtrij")) continue; const schaal = talentVan(n) >= 4 ? "middel" : "klein", plan = devPlan(s, d, schaal, "standaard", aardVan(d.type, "")), kost = (s.gratisDev || 0) > 0 ? 0 : plan.kost;
    if (s.cash < kost + 40) continue; const r = actProduct(s, ctx, "ontwikkel", {divisie: nm, schaal, focus: "standaard"}); if (r.ok){ R0.push(`${n.name}: nieuw product in ${nm}`); break; } } }
  { const n = assistentDoet(s, ctx, "straat"); if (n) for (const r of s.rivals){ if (r.status === "oorlog" || (r.relatie || 0) > -20) continue; for (const d of playerDistricts(s)) if (d.id !== s.player.home_district && !(s.patrouille || {})[d.id] && patrouilleMag(s, d) && reachable(s, r.name, d) && s.cash > 40){ if (actCorpo(s, ctx, "patrouille", d.id).ok) R0.push(`${n.name}: patrouille in ${d.name}`); } } }
  if (R0.length) ctx.rep.push(...R0); }
/* 5.9: klanten komen naar jou. Staten, legers, bedrijven en syndicaten vragen een levering of een raamcontract aan. Je schrijft in (laag, normaal of hoog geprijsd) tegen rivalen met producten van dezelfde soort; de worp beslist. Syndicaten betalen zwart en geven heat. */
const KLANT_SOORT = {
  staat: {label: "Staat", namen: ["Ministerie van Defensie", "Ministerie van Binnenlandse Zaken", "Grenswacht", "Nationale Gezondheidsdienst", "Havenautoriteit", "Nationale Politie"], aard: ["wapen", "beveiliging", "medisch", "data", "logistiek", "financieel"], rep: true},
  leger: {label: "Leger", namen: ["Generale Staf", "Expeditieleger", "Luchtmacht", "Marine", "Ruimtecommando"], aard: ["wapen", "beveiliging", "orbitaal", "logistiek", "implantaat"], rep: true},
  bedrijf: {label: "Bedrijf", namen: [], aard: Object.keys(PRODUCT_AARD), rep: true},
  syndicaat: {label: "Syndicaat", namen: [], aard: ["wapen", "smokkel", "implantaat", "medisch"], zwart: true, heat: 4},
};
const AANVRAAG_PRIJS = {laag: {label: "Scherp", f: 0.85, mod: 15}, normaal: {label: "Normaal", f: 1, mod: 0}, hoog: {label: "Hoog", f: 1.2, mod: -15}};
const AANVRAAG_MARGE = 0.45; /* 6.0: was 0,55 */
const besteVanAard = (s, aard) => (s.producten || []).filter(p => p.status === "markt" && (p.aard || aardVan(p.type, p.naam)) === aard).sort((a, b) => b.kwaliteit - a.kwaliteit || bereik(b) - bereik(a))[0] || null;
const aanvraagRivalen = (s, aard) => s.rivals.filter(r => (r.producten || []).some(p => p.aard === aard));
/* 6.8.1: een contract voor een bepaald product telt dat product, niet je beste van de soort */
const aanvraagProduct = (s, a) => (a.product && (s.producten || []).find(x => x.id === a.product && x.status === "markt")) || besteVanAard(s, a.aard);
function aanvraagKans(s, a, prijs){ const p = aanvraagProduct(s, a), P = AANVRAAG_PRIJS[prijs] || AANVRAAG_PRIJS.normaal; if (!p) return 0; const K = KLANT_SOORT[a.soort] || {};
  const g = a.gang ? (s.gangs || []).find(x => x.id === a.gang) : null, riv = aanvraagRivalen(s, a.aard).length;
  const rk = aanvraagRivalen(s, a.aard).reduce((m, r) => Math.max(m, ...(r.producten || []).filter(x => x.aard === a.aard).map(x => x.kwaliteit || 1)), 0);
  return snapKans(Math.round(clamp(52 + (p.kwaliteit - 3) * 10 + P.mod + (K.rep ? (s.reputation - 30) / 4 : (g ? g.relatie / 4 : 0)) - riv * 2 - Math.max(0, rk - p.kwaliteit) * 8 - (p.kwaliteit < a.minKwal ? 20 : 0) + (a.product ? 6 : 0), 5, 92))); /* 7.0: moeilijker; de beste rivaal telt */ }
/* 7.0: mag je leveren? Wapens, beveiliging en implantaten naar een ander continent vragen een exportvergunning; bij een embargo alleen via een smokkelroute (zwart, heat) */
function contractToegang(s, a){ if (!a || !a.cont || !EXPORT_AARD.includes(a.aard) || a.cont === exportThuis(s)) return {ok: true, via: "legaal"};
  const verg = !!(s.exportVergunning || {})[a.cont], emb = embargo(s, a.cont), sm = !!(s.smokkelroute || {})[a.cont];
  if (verg && !emb) return {ok: true, via: "legaal"};
  if (sm && verg) return {ok: true, via: "smokkel", reden: `embargo op ${a.cont}: alleen via je smokkelroute (zwart geld, heat +2)`};
  return {ok: false, reden: emb ? `embargo op ${a.cont}: je hebt een vergunning én een smokkelroute nodig` : `exportvergunning voor ${a.cont} nodig (Bedrijf → Export)`}; }
/* 7.0: wanbetaling: in onrustige gebieden kan een klant stoppen met betalen */
function wanbetaalKans(s, c){ if (!c || (!c.cont && c.soort !== "syndicaat")) return 0; if (c.soort === "syndicaat") return 0.02; const v = c.cont ? spanningVan(s, c.cont) : 0; return c.soort === "bedrijf" ? 0.005 : v >= 70 ? 0.03 : v >= 50 ? 0.015 : 0.003; }
function maakAanvraag(s, aard0){ const p0 = (s.producten || []).filter(p => p.status === "markt"); if (!p0.length) return null;
  const aard = aard0 || (p0[Math.floor(R() * p0.length)].aard || aardVan(p0[0].type, p0[0].naam)), soorten = Object.keys(KLANT_SOORT).filter(k => KLANT_SOORT[k].aard.includes(aard) && (k !== "syndicaat" || (s.gangs || []).length) && (k !== "bedrijf" || (s.bedrijven || []).some(b => !b.eigenaar)));
  if (!soorten.length) return null; const soort = CH(soorten), K = KLANT_SOORT[soort], land = CH(s.districts.filter(d => d.control !== "player")) || s.districts[0];
  let klant, gang = null; if (soort === "bedrijf") klant = CH((s.bedrijven || []).filter(b => !b.eigenaar)).naam; else if (soort === "syndicaat"){ const g = CH(s.gangs); klant = g.naam; gang = g.id; } else klant = `${CH(K.namen)} (${land.name})`;
  const p = besteVanAard(s, aard), basis = Math.max(1, p ? prodOmzet(s, p) : 2), raam = R() < 0.4, I = p ? stukInfo(p) : {eenheid: "stuks"};
  const bed = soort === "bedrijf" ? (s.bedrijven || []).find(b => b.naam === klant) : null, cont = soort === "syndicaat" ? null : bed ? (s.districts.find(d => d.id === bed.land) || {}).continent || null : land.continent;
  const a = {id: "a" + hex8(), m: ym(s), soort, klant, gang, aard, raam, cont, minKwal: clamp((p ? p.kwaliteit : 3) + RI(-1, 1), 1, 5), verloopt: 3}; /* 7.0: klant heeft een continent; kwaliteit soms boven de jouwe */
  if (raam){ a.maanden = CH([6, 12, 18, 24]); a.perMaand = r1(basis * U(0.3, 0.6)); } else a.bedrag = r1(basis * U(2, 5));
  a.tekst = `${klant} zoekt ${raam ? `een raamcontract voor ${a.maanden} maanden` : "een eenmalige levering"}: ${PRODUCT_AARD[aard].label.toLowerCase()}, minimaal kwaliteit ${a.minKwal}.`;
  return a; }
/* 6.10: bedrijven komen zelf met een leveringscontract: geen kosten vooraf en geen worp, of hoger inzetten voor meer geld */
function bedrijfAanbodTick(s, ctx){ const open = (s.keuzes || []).filter(k => /^bedrijfaanbod_/.test(k.soort || ""));
  if (!(s.producten || []).some(p => p.status === "markt")) return; /* 7.0: zonder iets te leveren geen leveringscontract */
  if (open.length >= 2 || kansRol() >= clamp(0.18 + (s.reputation - 30) / 250, 0.1, 0.35)) return;
  const L = (s.bedrijven || []).filter(b => !b.eigenaar && !b.contract && b.relatie > -30 && !open.some(k => k.soort === "bedrijfaanbod_" + b.id)); if (!L.length) return;
  const b = CH(L), bedrag = bedrijfOpties(s, b).contract.bedrag, hoog = r1(Math.min(8, bedrag * 1.4)), kans = snapKans(Math.round(clamp(45 + b.relatie / 2 + (s.reputation - 30) / 3, 15, 85))), duur = RI(18, 36); /* 7.0: met looptijd */
  addKeuze(s, ctx, {soort: "bedrijfaanbod_" + b.id, van: b.ceo ? `${b.ceo} (${b.naam})` : b.naam, titel: `${b.naam} wil een leveringscontract`, tekst: `${b.naam} (${b.sector}, ${landNaam(s, b.land)}) wil ${duur} maanden met ons werken: ±€${bedrag}M per maand, zonder kosten vooraf. Tekenen kan meteen. Hoger inzetten kan ook: €${hoog}M per maand, maar dan kunnen ze afhaken.`,
    opties: [{label: `Tekenen (€${bedrag}M/mnd)`, uitleg: "Zeker. Relatie +5.", eff: {stream: {naam: "Contract " + b.naam, bedrag, maanden: duur}, bedrijf: {[b.id]: {relatie: 5, contract: true}}}},
      {label: `Hoger inzetten (€${hoog}M/mnd, ${kans}%)`, uitleg: "Lukt het niet, dan haken ze af: relatie −8.", eff: {kans, succes: {stream: {naam: "Contract " + b.naam, bedrag: hoog, maanden: duur}, bedrijf: {[b.id]: {relatie: 2, contract: true}}}, falen: {bedrijf: {[b.id]: {relatie: -8}}}}},
      {label: "Afslaan", uitleg: "Relatie −3.", eff: {bedrijf: {[b.id]: {relatie: -3}}}}], standaard: 2}); /* 7.0: zonder antwoord geen deal */
  ctx.rep.push(`Aanbod: ${b.naam} wil een leveringscontract`); }
function aanvraagTick(s, ctx){ s.aanvragen ??= []; s.contracten ??= []; bedrijfAanbodTick(s, ctx);
  for (const a of s.aanvragen) a.verloopt -= 1; /* 6.8: meer aanvragen, langer geldig */ const weg = s.aanvragen.filter(a => a.verloopt <= 0); for (const a of weg){ const rv = aanvraagRivalen(s, a.aard); contractHist(s, a, "verlopen", rv.length ? CH(rv).name : null); } if (weg.length) ctx.rep.push(`${weg.length} aanvra${weg.length > 1 ? "gen" : "ag"} verlopen`); s.aanvragen = s.aanvragen.filter(a => a.verloopt > 0);
  const nP = (s.producten || []).filter(p => p.status === "markt").length;
  for (let poging = 0; poging < (s.reputation >= 55 ? 2 : 1); poging++) if (nP && s.aanvragen.length < AANVRAAG_MAX && kansRol() < (poging ? 0.25 : Math.min(0.55, 0.25 + 0.04 * nP))){ /* 7.0: minder, de tweede pas bij een goede naam */ const a = maakAanvraag(s); if (a){ s.aanvragen.push(a); ctx.rep.push(`Aanvraag: ${a.klant}`); mail(ctx, s, "Verkoop", `Aanvraag van ${a.klant}`, a.tekst + " Inschrijven kan bij Bedrijf → Klanten, binnen drie maanden.", "NORMAAL"); } }
  const zwaar = (s.producten || []).filter(x => x.status === "markt" && stukInfo(x).order && !isAbo(x));
  for (const p of zwaar) if (s.aanvragen.filter(a => a.product === p.id).length < CONTRACT_PER_PRODUCT && kansRol() < 0.35){ /* 7.0: 35% per maand, tot 2 open per product */ const a = maakContract(s, p); if (a){ s.aanvragen.push(a); ctx.rep.push(`Contractaanvraag: ${a.klant} (${p.naam})`); mail(ctx, s, "Verkoop", `${a.klant} wil ${p.naam}`, a.tekst + " Inschrijven bij Bedrijf → Klanten.", "HOOG"); } }
  for (const c of s.contracten){ const p = besteVanAard(s, c.aard);
    if (!p){ c.over = 0; s.cash = r1(s.cash - c.perMaand * 2); s.reputation = clamp(s.reputation - 5); mail(ctx, s, "Juridische Zaken", `Contract met ${c.klant} verbroken`, `We hebben geen ${PRODUCT_AARD[c.aard].label.toLowerCase()} meer op de markt en kunnen niet leveren. Boete €${r1(c.perMaand * 2)}M, reputatie −5.`, "KRITIEK"); ctx.rep.push(`Contract ${c.klant} verbroken`); continue; }
    if (kansRol() < wanbetaalKans(s, c)){ const rest = r1(c.perMaand * c.over); c.over = 0; c.wanbetaald = true; mail(ctx, s, "Financiën", `${c.klant} betaalt niet meer`, `${c.klant} stopt met betalen${c.cont ? ` (${c.cont}, spanning ${Math.round(spanningVan(s, c.cont))})` : ""}. Het contract is dood; de resterende €${rest}M omzet zien we niet meer. Zo gaat dat in onrustige gebieden.`, "HOOG"); ctx.rep.push(`${c.klant} betaalt niet meer`); continue; }
    if (c.product){ const pp = (s.producten || []).find(x => x.id === c.product); if (pp) (s.prodomzet ??= {})[pp.id] = r1(((s.prodomzet || {})[pp.id] || 0) + c.perMaand); }
    const netto = r1(c.perMaand * AANVRAAG_MARGE); if (c.zwart) s.accounts.zwart = r1(s.accounts.zwart + netto); else s.cash = r1(s.cash + netto); c.over -= 1; c.betaald = r1((c.betaald || 0) + netto);
    if (c.over <= 0){ ctx.rep.push(`Contract ${c.klant} afgerond`); if (!c.zwart) s.reputation = clamp(s.reputation + 1); } }
  const n0 = s.contracten.length; s.contracten = s.contracten.filter(c => c.over > 0); if (s.contracten.length || n0){ const tot = r1(s.contracten.reduce((a, c) => a + c.perMaand * AANVRAAG_MARGE, 0)); if (tot) ctx.rep.push(`Raamcontracten: +€${tot}M netto per maand`); }
  s.accounts.operationeel = s.cash; }
/* 6.11: geschiedenis van alle aanvragen: gewonnen, verloren (aan wie), verlopen, afgewezen */
function contractHist(s, a, uitkomst, wie, bedrag){ const pp = a.product ? (s.producten || []).find(x => x.id === a.product) : null;
  (s.contractHist ??= []).unshift({m: ym(s), klant: a.klant, soort: a.soort, aard: a.aard, product: pp ? pp.naam : null, uitkomst, wie: wie || null, bedrag: r1(bedrag ?? (a.raam ? a.perMaand * a.maanden : a.bedrag) ?? 0), raam: !!a.raam}); s.contractHist = s.contractHist.slice(0, 40); }
function actAanvraag(s, ctx, id, keuze){ const a = (s.aanvragen || []).find(x => x.id === id); if (!a) return {ok: false, msg: "Die aanvraag is er niet meer."};
  if (keuze === "afwijzen"){ s.aanvragen = s.aanvragen.filter(x => x !== a); { const rv = aanvraagRivalen(s, a.aard); contractHist(s, a, "afgewezen", rv.length ? CH(rv).name : null); } if (a.gang){ const g = (s.gangs || []).find(x => x.id === a.gang); if (g) g.relatie = Math.round(g.relatie - 5); } return {ok: true, msg: `Aanvraag van ${a.klant} afgewezen.${a.gang ? " Ze onthouden het: relatie −5." : ""}`}; }
  const P = AANVRAAG_PRIJS[keuze]; if (!P) return {ok: false, msg: "Kies een prijs."}; const p = aanvraagProduct(s, a); if (!p) return {ok: false, msg: `Je hebt geen ${PRODUCT_AARD[a.aard].label.toLowerCase()} op de markt.`};
  const T = contractToegang(s, a); if (!T.ok) return {ok: false, msg: `Leveren aan ${a.klant} mag niet: ${T.reden}.`};
  const kans = aanvraagKans(s, a, keuze), roll = rolKans(kans), K0 = KLANT_SOORT[a.soort], K = T.via === "smokkel" ? {...K0, zwart: true, heat: (K0.heat || 0) + 2} : K0, riv = aanvraagRivalen(s, a.aard); s.aanvragen = s.aanvragen.filter(x => x !== a);
  addRoll(s, `Inschrijving ${a.klant} (${P.label.toLowerCase()}): ${roll.txt} → ${roll.ok ? "GEWONNEN" : "VERLOREN"}`); let msg;
  if (roll.ok){ if (K.heat) s.heat = clamp(s.heat + K.heat);
    if (a.raam){ const c = {id: a.id, klant: a.klant, soort: a.soort, cont: a.cont || null, aard: a.aard, product: a.product || null, perMaand: r1(a.perMaand * P.f), over: a.maanden, maanden: a.maanden, zwart: !!K.zwart, sinds: ym(s)}; (s.contracten ??= []).push(c); msg = `Gewonnen: raamcontract met ${a.klant}, ${a.maanden} maanden €${c.perMaand}M omzet per maand (±€${r1(c.perMaand * AANVRAAG_MARGE)}M netto${c.zwart ? ", zwart" : ""}). Houd een ${PRODUCT_AARD[a.aard].label.toLowerCase()} op de markt, anders volgt een boete.`; }
    else { const netto = r1(a.bedrag * P.f * AANVRAAG_MARGE); if (a.product){ const pp = (s.producten || []).find(x => x.id === a.product); if (pp){ (s.prodomzet ??= {})[pp.id] = r1(((s.prodomzet || {})[pp.id] || 0) + a.bedrag * P.f); (pp.orders ??= []).push({m: ym(s), stuks: Math.max(1, Math.round(a.bedrag * P.f * 1e6 / Math.max(1, stukPrijs(pp)))), bedrag: r1(a.bedrag * P.f), klant: a.klant}); pp.orders = pp.orders.slice(-6); } } if (K.zwart) s.accounts.zwart = r1(s.accounts.zwart + netto); else s.cash = r1(s.cash + netto); msg = `Gewonnen: levering aan ${a.klant} voor €${r1(a.bedrag * P.f)}M (±€${netto}M netto${K.zwart ? ", zwart" : ""}).`; }
    if (K.rep) s.reputation = clamp(s.reputation + 1); if (a.gang){ const g = (s.gangs || []).find(x => x.id === a.gang); if (g) g.relatie = Math.round(g.relatie + 8); }
    if (K.zwart && kansRol() < 0.15){ s.reputation = clamp(s.reputation - 4); msg += " Een journalist zag de levering: reputatie −4."; } }
  else { const w = riv.length ? CH(riv).name : null; msg = `Verloren: ${a.klant} kiest ${w || "een andere leverancier"}.`; contractHist(s, a, "verloren", w); }
  if (roll.ok) contractHist(s, a, "gewonnen", "jij", (a.raam ? a.perMaand * a.maanden : a.bedrag) * P.f);
  s.accounts.operationeel = s.cash; addLog(s, msg); mail(ctx, s, "Verkoop", `Inschrijving ${a.klant}: ${roll.ok ? "gewonnen" : "verloren"}`, msg + ` (Worp ${roll.txt}.)`, "NORMAAL");
  return {ok: true, msg: msg + ` Worp ${roll.txt}.`}; }
/* 5.10: export en vergunningen. Wapens, beveiliging en implantaten verkopen standaard op je eigen continent; een exportvergunning per ander continent (blijvend) geeft +6% omzet per continent. Bij Sancties of Privélegers (spanning 50-89) ligt daar een embargo: de vergunning telt niet, tenzij je een smokkelroute hebt (zwart geld, heat). */
const EXPORT_AARD = ["wapen", "beveiliging", "implantaat"], EXPORT_BONUS = 0.06;
const exportThuis = s => (s.districts.find(x => x.id === s.player.home_district) || {}).continent;
const embargo = (s, cont) => { const v = spanningVan(s, cont); return v >= 50 && v < 90; };
const vergunningKost = s => r1(15 * (DIFF[s.player.difficulty] || 1) * (1 + 0.25 * Object.keys(s.exportVergunning || {}).length));
const smokkelKost = s => r1(8 * (DIFF[s.player.difficulty] || 1));
function exportExtra(s, p, o){ const out = {legaal: 0, zwart: 0, heat: 0}; if (!(o > 0) || !EXPORT_AARD.includes(p.aard || aardVan(p.type, p.naam))) return out;
  for (const c of Object.keys(s.exportVergunning || {})){ if (c === exportThuis(s)) continue; const b = o * EXPORT_BONUS;
    if (!embargo(s, c)) out.legaal += b; else if ((s.smokkelroute || {})[c]){ out.zwart += b * 0.8; out.heat += 0.3; } }
  return out; }
function actExport(s, ctx, soort, cont){ if (!CONTINENTS.some(c => c.naam === cont) || cont === exportThuis(s)) return {ok: false, msg: "Kies een ander continent dan je thuiscontinent."};
  if (soort === "vergunning"){ if ((s.exportVergunning || {})[cont]) return {ok: false, msg: `Je hebt al een exportvergunning voor ${cont}.`}; const k = vergunningKost(s); if (s.cash < k) return {ok: false, msg: `Een vergunning kost €${k}M.`};
    s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; (s.exportVergunning ??= {})[cont] = ym(s); addLog(s, `Exportvergunning ${cont} (€${k}M)`);
    return {ok: true, msg: `Exportvergunning voor ${cont}: wapens, beveiliging en implantaten verkopen daar nu ook (+${Math.round(EXPORT_BONUS * 100)}% omzet op die producten).${embargo(s, cont) ? " Let op: er ligt nu een embargo; zonder smokkelroute telt de vergunning pas als het embargo voorbij is." : ""}`}; }
  if (soort === "smokkel"){ const S0 = (s.smokkelroute ??= {}); if (S0[cont]){ delete S0[cont]; return {ok: true, msg: `Smokkelroute naar ${cont} gestopt.`}; }
    if (!(s.exportVergunning || {})[cont]) return {ok: false, msg: "Eerst een exportvergunning: zonder klanten daar is er niets te smokkelen."};
    const k = smokkelKost(s); if (s.cash < k) return {ok: false, msg: `Een smokkelroute opzetten kost €${k}M.`}; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; S0[cont] = ym(s); addLog(s, `Smokkelroute ${cont} (€${k}M)`);
    return {ok: true, msg: `Smokkelroute naar ${cont}: tijdens een embargo gaat de handel door, als zwart geld (80%) en met heat.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
/* 5.11: regionale markten. Elk continent heeft een eigen marktgrootte, koopkracht, vraag per soort en concurrenten (rivalen met een hoofdkantoor daar). Per product kies je waar je verkoopt; minder markten = meer focus. Neutraal geijkt: alles verkopen tegen standaardprijs bij gemiddelde vraag = ×1. */
const REGIO = {"Noord-Amerika": {w: 0.24, kk: 1.25}, "Europa": {w: 0.22, kk: 1.2}, "Azië": {w: 0.28, kk: 1.0}, "Midden-Oosten": {w: 0.07, kk: 1.05}, "Zuid-Amerika": {w: 0.07, kk: 0.85}, "Afrika": {w: 0.06, kk: 0.75}, "Oceanië": {w: 0.06, kk: 1.15}};
const REGIO_KK = Object.values(REGIO).reduce((a, r) => a + r.w * r.kk, 0), REGIO_FOCUS = 0.6;
const regioNamen = () => Object.keys(REGIO);
const regioMarkten = p => (p.markten && p.markten.length ? p.markten : regioNamen());
/* 6.8: corpospanning werkt hard op de vraag: wapens en beveiliging tot bijna ×2 in een corporate zone, consument/financieel/logistiek tot ×0,67 */
const SPANNING_VRAAG = {wapen: [25, 70, 1], beveiliging: [25, 90, 1], smokkel: [40, 100, 1], medisch: [50, 200, 1], consument: [40, 150, -1], financieel: [40, 150, -1], logistiek: [40, 150, -1]};
const spanningVraagF = (aard, sp) => { const e = SPANNING_VRAAG[aard]; return e ? Math.max(0.5, 1 + e[2] * Math.max(0, sp - e[0]) / e[1]) : 1; };
function regioVraag(s, c, aard){ const v = ((s.regioVraag || {})[c] || {})[aard] ?? 1; return v * spanningVraagF(aard, spanningVan(s, c)); }
function regioConc(s, c, aard, n){ if (n) return Math.pow(0.85, n[c] || 0); const hqC = r => (s.districts.find(d => d.id === r.hq) || {}).continent; return Math.pow(0.85, s.rivals.filter(r => hqC(r) === c && (r.producten || []).some(x => x.aard === aard)).length); }
const regioTol = (c, p) => clamp(1 + (REGIO[c].kk - REGIO_KK) * (prijsF(p) - 1) * 2, 0.5, 1.5);
const regioCache = new WeakMap(); /* 5.14.1: per tick/render gelijk; sleutel = spel + maand + aard */
function regioBasis(s, aard){ let C = regioCache.get(s); const k = ym(s) + "|" + (s.rivals || []).length; if (!C || C.k !== k){ C = {k, a: {}}; regioCache.set(s, C); }
  const V = s.regioVraag || {}, sig = regioNamen().map(c => ((V[c] || {})[aard] ?? 1) + (SPANNING_VRAAG[aard] ? ":" + spanningVan(s, c) : "")).join(",");
  if (C.a[aard] && C.a[aard].sig === sig) return C.a[aard].d; const n = {}; for (const r of s.rivals || []) if ((r.producten || []).some(x => x.aard === aard)){ const c = (s.districts.find(d => d.id === r.hq) || {}).continent; if (c) n[c] = (n[c] || 0) + 1; }
  const gem = spanningGem(s), alle = regioNamen(), cg = alle.reduce((a, c) => a + REGIO[c].w * regioConc(s, c, aard, n), 0) || 1;
  const d = alle.map(c => ({c, w: REGIO[c].w, v: regioVraag(s, c, aard), conc: regioConc(s, c, aard, n) / cg})); C.a[aard] = {sig, d}; return d; }
function regioDelen(s, p){ const aard = p.aard || aardVan(p.type, p.naam); return regioBasis(s, aard).map(x => ({...x, tol: regioTol(x.c, p)})); }
function regioF(s, p){ if (!s || !s.districts) return 1; const sel = new Set(regioMarkten(p)), D = regioDelen(s, p); let num = 0, selW = 0;
  for (const x of D) if (sel.has(x.c)){ num += x.w * x.v * x.conc * x.tol; selW += x.w; }
  return num * (1 + REGIO_FOCUS * (1 - selW)); }
function regioTick(s, newGame){ const V = (s.regioVraag ??= {}); const nieuw = !Object.keys(V).length;
  for (const c of regioNamen()){ V[c] ??= {}; for (const a of Object.keys(PRODUCT_AARD)){ if (V[c][a] == null){ V[c][a] = nieuw && newGame ? r1(U(0.75, 1.25) * 100) / 100 : 1; continue; } if (!newGame) V[c][a] = Math.round(clamp(V[c][a] + (1 - V[c][a]) * 0.02 + U(-0.03, 0.03), 0.5, 1.6) * 100) / 100; } } }
function actRegio(s, id, c){ const p = (s.producten || []).find(x => x.id === id); if (!p) return {ok: false, msg: "Onbekend product."}; if (!REGIO[c]) return {ok: false, msg: "Onbekend continent."};
  const sel = new Set(regioMarkten(p)); if (sel.has(c)){ if (sel.size <= 1) return {ok: false, msg: "Je moet minstens op één continent verkopen."}; sel.delete(c); } else sel.add(c);
  p.markten = sel.size === regioNamen().length ? null : [...sel]; if (!p.markten) delete p.markten;
  return {ok: true, msg: `${p.naam} verkoopt nu in ${sel.size === regioNamen().length ? "de hele wereld" : [...sel].join(", ")}.`}; }
/* 5.12: toelevering en voorraad. Grondstoffen komen uit één continent; hun prijs volgt de corpospanning daar, oorlogen en wereldgebeurtenissen (chiptekort 2020, energiecrisis 2022). Voorraad = vooruit betalen tegen de prijs van nu; zolang die strekt, kost die grondstof je niets extra. */
const GRONDSTOF = {staal: {label: "Staal", bron: "Azië"}, chips: {label: "Chips", bron: "Azië"}, zeldzaam: {label: "Zeldzame aarden", bron: "Afrika"}, brandstof: {label: "Brandstof", bron: "Midden-Oosten"}, chemie: {label: "Chemicaliën", bron: "Europa"}, biogel: {label: "Biogel", bron: "Noord-Amerika"}, lithium: {label: "Lithium", bron: "Zuid-Amerika"}};
const AARD_GRONDSTOF = {wapen: ["staal", "chips"], beveiliging: ["staal", "chips"], implantaat: ["zeldzaam", "biogel", "chips"], medisch: ["chemie", "biogel"], data: ["chips", "lithium"], logistiek: ["brandstof", "staal"], orbitaal: ["zeldzaam", "brandstof", "lithium"], consument: ["chips", "lithium"], smokkel: ["brandstof"], financieel: ["chips"]};
const GRONDSTOF_SCHOK = {"2008-10": {staal: -0.2, brandstof: -0.3}, "2011-03": {zeldzaam: 0.4}, "2020-09": {chips: 0.6, lithium: 0.2}, "2022-02": {brandstof: 0.7, chemie: 0.3, staal: 0.2}, "2032-05": {staal: 0.3, zeldzaam: 0.3}, "2040-01": {chips: 0.3, biogel: 0.3}};
const grondstoffenVan = p => AARD_GRONDSTOF[p.aard || aardVan(p.type, p.naam)] || ["chips"];
const gsPrijs = (s, m) => (((s.grondstof || {})[m]) || {}).p ?? 1;
const gsVoorraad = (s, m) => ((s.voorraad || {})[m] || {}).mnd || 0;
function gsVerbruik(s, m){ let v = 0; for (const p of (s.producten || []).filter(x => x.status === "markt")){ const L = grondstoffenVan(p); if (L.includes(m)) v += ((s.prodomzet || {})[p.id] || 0) * PROD_KOST * 0.8 / L.length; } return r1(Math.max(0.1, v)); }
const voorraadKost = (s, m, n) => r1(gsVerbruik(s, m) * gsPrijs(s, m) * n);
function grondstofTick(s, ctx){ const G0 = (s.grondstof ??= {}), sch = (s.gsSchok ??= {}), nu = ym(s), E = GRONDSTOF_SCHOK[nu];
  for (const [m, g] of Object.entries(GRONDSTOF)){ const x = (G0[m] ??= {p: 1, hist: []}); if (E && E[m]) sch[m] = (sch[m] || 0) + E[m];
    const oorlog = s.rivals.filter(r => r.status === "oorlog" && (s.districts.find(d => d.id === r.hq) || {}).continent === g.bron).length;
    const doel = 1 + Math.max(0, spanningVan(s, g.bron) - 40) / 100 + (sch[m] || 0) + oorlog * 0.1, oud = x.p;
    x.p = Math.round(clamp(x.p + (doel - x.p) * 0.15 + U(-0.03, 0.03), 0.6, 2.5) * 100) / 100; x.hist = [...(x.hist || []), x.p].slice(-12);
    if (sch[m]){ sch[m] = Math.round(sch[m] * 0.88 * 100) / 100; if (Math.abs(sch[m]) < 0.02) delete sch[m]; }
    if (oud < 1.5 && x.p >= 1.5){ news(s, `Tekort aan ${g.label.toLowerCase()}`, `De prijs van ${g.label.toLowerCase()} uit ${g.bron} schiet omhoog. Fabrieken kopen wat ze kunnen.`, g.bron, "markt", false); ctx.rep.push(`Tekort: ${g.label} ×${x.p}`); } }
  const V = s.voorraad || {}; for (const m of Object.keys(V)){ if ((s.producten || []).some(p => p.status === "markt" && grondstoffenVan(p).includes(m))) V[m].mnd -= 1; if (V[m].mnd <= 0){ delete V[m]; ctx.rep.push(`Voorraad ${GRONDSTOF[m].label.toLowerCase()} op`); } }
  for (const p of s.producten || []){ const L = grondstoffenVan(p); p.matF = Math.round(L.reduce((a, m) => a + (gsVoorraad(s, m) > 0 ? 0 : gsPrijs(s, m)), 0) / L.length * 100) / 100; if (p.matF === 1) delete p.matF; } }
function actVoorraad(s, ctx, m, n){ if (!GRONDSTOF[m]) return {ok: false, msg: "Onbekende grondstof."}; n = Math.round(+n || 0); if (![3, 6, 12].includes(n)) return {ok: false, msg: "Kies 3, 6 of 12 maanden."};
  if (gsVoorraad(s, m) + n > 24) return {ok: false, msg: "Meer dan twee jaar voorraad past niet in je loodsen."};
  const k = voorraadKost(s, m, n); if (s.cash < k) return {ok: false, msg: `Niet genoeg cash (€${k}M nodig).`};
  s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; const V = (s.voorraad ??= {}); V[m] = {mnd: gsVoorraad(s, m) + n, prijs: gsPrijs(s, m), verbruik: gsVerbruik(s, m), sinds: ym(s)};
  for (const p of s.producten || []){ const L = grondstoffenVan(p); if (!L.includes(m)) continue; p.matF = Math.round(L.reduce((a, x) => a + (gsVoorraad(s, x) > 0 ? 0 : gsPrijs(s, x)), 0) / L.length * 100) / 100; }
  addLog(s, `Voorraad ${GRONDSTOF[m].label.toLowerCase()} ${n} mnd (€${k}M)`);
  return {ok: true, msg: `${n} maanden ${GRONDSTOF[m].label.toLowerCase()} ingekocht voor €${k}M (prijs ×${gsPrijs(s, m)}). Zolang de voorraad strekt, kost die grondstof je niets extra, wat de markt ook doet.`}; }
/* 5.13: patenten en namaak. Een patent op de sterkste eigenschap (7+) geeft dat product +8% omzet en licentiegeld van rivalen in dezelfde soort; namakers kun je aanklagen, een licentie geven of negeren. Rivalen patenteren ook: zonder eigen patent in die soort −5% omzet tot je het aanvecht of het afloopt. */
const PATENT_BONUS = 0.08, PATENT_MIN = 7;
const patentKost = s => r1(8 * (DIFF[s.player.difficulty] || 1));
const namaakActief = (s, p) => { const t = s.flags && s.flags["namaak_" + p.id]; return !!t && t > ym(s); };
const eigenPatentIn = (s, aard) => (s.producten || []).some(p => p.patent && p.status === "markt" && (p.aard || aardVan(p.type, p.naam)) === aard);
function patentF(s, p){ const aard = p.aard || aardVan(p.type, p.naam), rp = (s.rivaalPatent || {})[aard];
  return (p.patent && !namaakActief(s, p) ? 1 + PATENT_BONUS : 1) * (rp && rp.tot > ym(s) && !eigenPatentIn(s, aard) ? 0.95 : 1); }
const besteSpec = p => prodSpecs(p).reduce((a, x) => (x.v > a.v ? x : a), {v: 0, naam: ""});
function actPatent(s, ctx, id){ const p = (s.producten || []).find(x => x.id === id); if (!p || p.status !== "markt") return {ok: false, msg: "Alleen een product op de markt kun je patenteren."};
  if (p.patent) return {ok: false, msg: `${p.naam} heeft al een patent op ${p.patent.spec}.`}; const b = besteSpec(p); if (b.v < PATENT_MIN) return {ok: false, msg: `Geen eigenschap is sterk genoeg (beste: ${b.naam} ${b.v}, minstens ${PATENT_MIN} nodig).`};
  const k = patentKost(s); if (s.cash < k) return {ok: false, msg: `Een patent kost €${k}M.`}; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; p.patent = {spec: b.naam, v: b.v, sinds: ym(s)};
  addLog(s, `Patent op ${b.naam} van ${p.naam} (€${k}M)`); news(s, `${s.player.corp_name} patenteert ${b.naam.toLowerCase()}`, `Het octrooi op de ${b.naam.toLowerCase()} van ${p.naam} is toegekend. Concurrenten moeten nu betalen of eromheen werken.`, "", "markt", true);
  return {ok: true, msg: `Patent op ${b.naam} (${b.v}) van ${p.naam}: +${Math.round(PATENT_BONUS * 100)}% omzet en licentiegeld van rivalen met dezelfde soort.`}; }
function patentTick(s, ctx){ const nu = ym(s), hqRiv = aard => s.rivals.filter(r => (r.producten || []).some(x => x.aard === aard));
  let lic = 0; for (const p of (s.producten || []).filter(x => x.patent && x.status === "markt" && !namaakActief(s, x))){ const aard = p.aard || aardVan(p.type, p.naam), R0 = hqRiv(aard); lic += R0.length * 0.2;
    if (R0.length && kansRol() < 0.04){ const r = CH(R0), kans = snapKans(clamp(55 + (heeftFocus(s, "juristen") ? 15 : 0) + (s.reputation - 30) / 4, 15, 90));
      addKeuze(s, ctx, {soort: "patent_" + p.id, van: "Juridische Zaken", titel: `${r.name} kopieert ${p.naam}`, tekst: `${r.name} verkoopt iets dat verdacht veel lijkt op ${p.naam}, inclusief onze gepatenteerde ${p.patent.spec.toLowerCase()}. Wat doen we?`,
        opties: [{label: "Aanklagen · €4M", kost: 4, uitleg: `Kans ${kans}%: schadevergoeding €10-25M. Mislukt: de namaak blijft een jaar (patentvoordeel weg).`, eff: {kans, succes: {cash: RI(10, 25), rivaal: {[r.name]: {relatie: -10}}, tekst: "De rechter is helder: namaak. De schadevergoeding is binnen."}, falen: {flags: {["namaak_" + p.id]: plusMonths(s, 12)}, tekst: "De rechter vindt het verschil groot genoeg. De namaak blijft."}}},
          {label: "Licentie aanbieden", uitleg: "Twee jaar €0,6M per maand, relatie +5. De namaak wordt legaal.", eff: {stream: {naam: `Licentie ${p.naam} (${r.name})`, bedrag: 0.6, maanden: 24}, rivaal: {[r.name]: {relatie: 5}}}},
          {label: "Negeren", uitleg: "Gratis. Een jaar lang geen patentvoordeel voor dit product.", eff: {flags: {["namaak_" + p.id]: plusMonths(s, 12)}}}], standaard: 2}); } }
  if (lic){ lic = r1(lic); s.cash = r1(s.cash + lic); ctx.rep.push(`Licentiegeld patenten: +€${lic}M`); }
  const RP = (s.rivaalPatent ??= {}); for (const a of Object.keys(RP)){ if (RP[a].tot <= nu || s.flags["patentweg_" + a]){ if (s.flags["patentweg_" + a]) ctx.rep.push(`Patent van ${RP[a].rival} vernietigd`); delete RP[a]; delete s.flags["patentweg_" + a]; } }
  const mijnAard = [...new Set((s.producten || []).filter(p => p.status === "markt").map(p => p.aard || aardVan(p.type, p.naam)))].filter(a => !RP[a] && !eigenPatentIn(s, a) && hqRiv(a).length);
  if (mijnAard.length && kansRol() < 0.015){ const a = CH(mijnAard), r = CH(hqRiv(a)); RP[a] = {rival: r.name, tot: plusMonths(s, 36), sinds: nu}; const kans = snapKans(clamp(50 + (heeftFocus(s, "juristen") ? 15 : 0), 15, 90));
    addKeuze(s, ctx, {soort: "rpatent_" + a, van: "Juridische Zaken", titel: `${r.name} patenteert in ${PRODUCT_AARD[a].label.toLowerCase()}`, tekst: `${r.name} heeft een breed patent gekregen. Onze ${PRODUCT_AARD[a].label.toLowerCase()} verkoopt drie jaar 5% minder, tenzij we zelf een patent in die soort hebben of het aanvechten.`,
      opties: [{label: "Aanvechten · €5M", kost: 5, uitleg: `Kans ${kans}%: het patent wordt vernietigd.`, eff: {kans, succes: {flags: {["patentweg_" + a]: true}, rivaal: {[r.name]: {relatie: -6}}, tekst: "Het patent sneuvelt: te breed, te vaag."}, falen: {tekst: "Het patent blijft staan."}}},
        {label: "Accepteren", uitleg: "Drie jaar −5% omzet op die soort (tenzij je zelf patenteert).", eff: {}}], standaard: 1}); } }
/* 5.14: onderzoek. Per soort product drie niveaus: 1 = +5% omzet, 2 = +5% en 8% goedkopere onderdelen, 3 = +5% en +1 op alle eigenschappen (dus sneller een patent). Eén onderzoek tegelijk, betaald per maand. Rivalen onderzoeken mee: hun nieuwe producten worden beter. */
const TECH_NAMEN = {wapen: ["Slimme munitie", "Modulaire chassis", "Exo-gevechtspakken"], beveiliging: ["Gezichtsherkenning", "Drone-zwermen", "Voorspellende politie"], implantaat: ["Neurale interfaces", "Biocompatibel chroom", "Synthetische zenuwen"], medisch: ["Gentherapie", "Bioprinten", "Nano-chirurgie"], data: ["Big data", "Voorspellende AI", "Bewustzijnsmodellen"], logistiek: ["Autonome trucks", "Droneleveringen", "Hyperloop-netwerk"], financieel: ["Algoritmische handel", "Blockchain-clearing", "Quantum-risicomodellen"], orbitaal: ["Herbruikbare raketten", "Orbitale fabrieken", "Ruimtelift"], consument: ["Slimme materialen", "AR-brillen", "Persoonlijke robots"], smokkel: ["Versleutelde routes", "Stealth-containers", "Spookschepen"]};
const TECH_EFFECT = ["+5% omzet", "+5% omzet en 8% goedkopere onderdelen", "+5% omzet en +1 op alle eigenschappen"];
const techNiveau = (s, aard) => ((s.onderzoek || {}).niveau || {})[aard] || 0;
const techF = (s, p) => 1 + 0.05 * techNiveau(s, p.aard || aardVan(p.type, p.naam));
const techKost = (s, n) => r1(15 * n * (DIFF[s.player.difficulty] || 1) * clamp(omvang(s), 1, 4)), techMaanden = n => 4 + 2 * n; /* 6.0: groter bedrijf = duurder onderzoek */
function actOnderzoek(s, ctx, aard){ if (!TECH_NAMEN[aard]) return {ok: false, msg: "Onbekende soort."}; const O = (s.onderzoek ??= {niveau: {}}); if (O.lopend) return {ok: false, msg: `Er loopt al onderzoek: ${O.lopend.naam}.`};
  const n = techNiveau(s, aard) + 1; if (n > 3) return {ok: false, msg: "Deze soort is volledig onderzocht."}; const k = techKost(s, n), m = techMaanden(n), pm = r1(k / m); if (s.cash < pm + 10) return {ok: false, msg: `Niet genoeg cash voor de eerste maand (€${pm}M).`};
  O.lopend = {aard, n, naam: TECH_NAMEN[aard][n - 1], over: m, maanden: m, perMaand: pm, sinds: ym(s)}; addLog(s, `Onderzoek gestart: ${O.lopend.naam}`);
  return {ok: true, msg: `Onderzoek "${O.lopend.naam}" gestart: ${m} maanden, €${pm}M per maand. Daarna: ${TECH_EFFECT[n - 1]} op ${PRODUCT_AARD[aard].label.toLowerCase()}.`}; }
function actOnderzoekStop(s){ const O = s.onderzoek || {}; if (!O.lopend) return {ok: false, msg: "Er loopt geen onderzoek."}; const n = O.lopend.naam; delete O.lopend; return {ok: true, msg: `Onderzoek "${n}" gestopt. Wat al betaald is, is weg.`}; }
function onderzoekTick(s, ctx){ const O = (s.onderzoek ??= {niveau: {}}); O.niveau ??= {};
  if (O.lopend){ const L = O.lopend; if (s.cash >= L.perMaand){ s.cash = r1(s.cash - L.perMaand); L.over -= 1; } else ctx.rep.push(`Onderzoek ${L.naam} staat stil: geen geld`);
    if (L.over <= 0){ O.niveau[L.aard] = L.n; delete O.lopend; ctx.rep.push(`Onderzoek klaar: ${L.naam}`); news(s, `Doorbraak bij ${s.player.corp_name}: ${L.naam.toLowerCase()}`, `Het lab meldt een doorbraak. ${PRODUCT_AARD[L.aard].label} van ${s.player.corp_name}: ${TECH_EFFECT[L.n - 1]}.`, "", "markt", true);
      mail(ctx, s, "Hoofd R&D", `Onderzoek klaar: ${L.naam}`, `Ons onderzoek is af. Voor al onze ${PRODUCT_AARD[L.aard].label.toLowerCase()}: ${TECH_EFFECT[L.n - 1]}.`, "NORMAAL"); } }
  for (const p of s.producten || []){ const t = techNiveau(s, p.aard || aardVan(p.type, p.naam)); if (t) p.tech = t; else delete p.tech; }
  if (s.date.month === 1) for (const r of s.rivals){ const a = SECTOR_AARD[r.sector] || "consument", T = (r.tech ??= {}); if ((T[a] || 0) < 3 && R() < 0.3){ T[a] = (T[a] || 0) + 1; news(s, `${r.name} meldt een doorbraak`, `${r.name} heeft ${TECH_NAMEN[a] ? TECH_NAMEN[a][T[a] - 1].toLowerCase() : "iets nieuws"} onder de knie. Hun volgende producten worden beter.`, "", "markt", false); } } }
/* 5.15: realistische financiën en de beurs. Termijnleningen met vaste rente en looptijd (annuïteit), een balans en kasstroom, en zelf naar de beurs: een deel van de aandelen verkopen voor geld, daarna is dat deel niet meer van jou (je bedrijfswaarde voor de winst telt alleen jouw deel). Elk jaar een aandeelhoudersvergadering. */
const termijnRest = s => r1((s.leningen || []).reduce((a, l) => a + l.rest, 0));
const publiekDeel = s => ((s.beurs || {}).publiek || 0) / 100;
const voorraadWaarde = s => r1(Object.entries(s.voorraad || {}).reduce((a, [m, v]) => a + (v.mnd || 0) * (v.verbruik || 0) * (v.prijs || 1), 0));
const termijnRente = (s, n) => Math.round((0.045 + Math.max(0, 50 - s.reputation) / 600 + (s.heat > 40 ? 0.02 : 0) + (n >= 48 ? 0.01 : 0)) * 1000) / 1000;
function annuiteit(P, rj, n){ const r = rj / 12; return r1(r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n); }
function actTermijn(s, ctx, bedrag, n){ bedrag = Math.round(+bedrag || 0); n = Math.round(+n || 0); if (![12, 24, 48].includes(n)) return {ok: false, msg: "Kies 12, 24 of 48 maanden."};
  if (bedrag < 5) return {ok: false, msg: "Minimaal €5M."}; const cap = loanCap(s); if (bedrag > cap) return {ok: false, msg: `De bank weigert: maximaal €${cap}M.`};
  const rj = termijnRente(s, n), A = annuiteit(bedrag, rj, n); (s.leningen ??= []).push({id: "l" + hex8(), bedrag, rente: rj, looptijd: n, over: n, rest: bedrag, annuiteit: A, sinds: ym(s)});
  s.cash = r1(s.cash + bedrag); s.accounts.operationeel = s.cash; addLog(s, `Termijnlening €${bedrag}M, ${n} mnd, ${Math.round(rj * 1000) / 10}%`);
  return {ok: true, msg: `Termijnlening van €${bedrag}M: ${n} maanden ${Math.round(rj * 1000) / 10}% vast, €${A}M per maand (rente en aflossing samen).`}; }
function termijnTick(s){ let tot = 0; for (const l of s.leningen || []){ const r = l.rente / 12, rente = l.rest * r, af = Math.min(l.rest, l.annuiteit - rente); l.rest = r1(Math.max(0, l.rest - af)); l.over -= 1; tot += rente + af; }
  s.leningen = (s.leningen || []).filter(l => l.over > 0 && l.rest > 0.05); return r1(tot); }
const beursMag = s => bedrijfWaarde(s) >= 500 && s.reputation >= 25;
const beursKoers = s => { const B = s.beurs; return B ? Math.round(100 * bedrijfWaarde(s) / Math.max(1, B.basis)) : 100; };
function actBeurs(s, ctx, soort, pct){ const B = s.beurs; pct = Math.round(+pct || 0); const V = bedrijfWaarde(s);
  if (soort === "ipo"){ if (B) return {ok: false, msg: "Je staat al op de beurs."}; if (!beursMag(s)) return {ok: false, msg: "Een beursgang kan vanaf €500M bedrijfswaarde en reputatie 25."}; if (![10, 20, 30].includes(pct)) return {ok: false, msg: "Kies 10, 20 of 30%."};
    const opbr = r1(V * pct / 100 * 0.9); s.cash = r1(s.cash + opbr); s.accounts.operationeel = s.cash; s.beurs = {publiek: pct, sinds: ym(s), basis: bedrijfWaarde(s), dividend: 0};
    news(s, `${s.player.corp_name} naar de beurs`, `De beursgang van ${s.player.corp_name} haalt €${opbr}M op. ${pct}% van de aandelen is nu in handen van beleggers.`, "", "markt", true); addLog(s, `Beursgang: ${pct}% voor €${opbr}M`);
    return {ok: true, msg: `Beursgang: ${pct}% verkocht voor €${opbr}M (10% onder de waarde, dat is de prijs van een beursgang). Voor de winst telt voortaan jouw deel: ${100 - pct}%.`}; }
  if (!B) return {ok: false, msg: "Je staat niet op de beurs."};
  if (soort === "uitgeven"){ if (![5, 10].includes(pct)) return {ok: false, msg: "Kies 5 of 10%."}; if (B.publiek + pct > 49) return {ok: false, msg: "Boven 49% verlies je de meerderheid. Dat doen we niet."};
    const opbr = r1(V * pct / 100 * 0.95); s.cash = r1(s.cash + opbr); s.accounts.operationeel = s.cash; B.publiek += pct; s.reputation = clamp(s.reputation - 1); addLog(s, `Aandelen uitgegeven: ${pct}% voor €${opbr}M`);
    return {ok: true, msg: `${pct}% nieuwe aandelen voor €${opbr}M. Bestaande beleggers zijn niet blij met de verwatering: reputatie −1. Jouw deel: ${100 - B.publiek}%.`}; }
  if (soort === "terugkopen"){ if (![5, 10].includes(pct)) return {ok: false, msg: "Kies 5 of 10%."}; pct = Math.min(pct, B.publiek); const k = r1(V * pct / 100 * 1.1); if (s.cash < k + 20) return {ok: false, msg: `Terugkopen kost €${k}M (10% boven de waarde).`};
    s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; B.publiek -= pct; addLog(s, `Aandelen teruggekocht: ${pct}% voor €${k}M`); if (B.publiek <= 0){ delete s.beurs; return {ok: true, msg: `Alle aandelen teruggekocht voor €${k}M: je bent weer volledig eigenaar en van de beurs af.`}; }
    return {ok: true, msg: `${pct}% teruggekocht voor €${k}M. Jouw deel: ${100 - B.publiek}%.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function beursTick(s, ctx){ const B = s.beurs; if (!B) return; B.koersHist = [...(B.koersHist || []), beursKoers(s)].slice(-24);
  if (s.date.month === 6){ const V = bedrijfWaarde(s), div = r1(Math.max(1, V * B.publiek / 100 * 0.03)), kr = B.koersHist.length >= 12 ? Math.round((B.koersHist[B.koersHist.length - 1] / B.koersHist[B.koersHist.length - 12] - 1) * 100) : 0;
    addKeuze(s, ctx, {soort: "ava_" + s.date.year, van: "Investor Relations", titel: `Aandeelhoudersvergadering ${s.date.year}`, tekst: `De koers ${kr >= 0 ? "steeg" : "daalde"} ${Math.abs(kr)}% dit jaar. De beleggers (${B.publiek}%) willen weten wat ze krijgen.`,
      opties: [{label: `Dividend · €${div}M`, kost: div, uitleg: "Beleggers tevreden: reputatie +3.", eff: {reputation: 3}}, {label: "Herinvesteren", uitleg: kr >= 10 ? "Met deze groei accepteren ze het: geen gevolgen." : "Ze morren: reputatie −3.", eff: kr >= 10 ? {} : {reputation: -3}},
        {label: "Bonus voor de directie", uitleg: "Je directie +10 loyaliteit, beleggers boos: reputatie −6.", eff: {reputation: -6, loyaliteit: Object.fromEntries((s.npcs || []).map(n => [n.name, 10]))}}], standaard: 1}); } }
/* 5.16: dashboard. Omzet per divisie over tijd, per product naast de sterkste concurrent, en een jaaroverzicht. */
function rivaalTop(s, aard){ let best = {pop: 0, naam: "", wie: ""}; for (const r of s.rivals) for (const x of r.producten || []) if (x.aard === aard && (x.pop || 0) * (x.kwaliteit || 1) > best.pop * (best.kw || 1)) best = {pop: Math.round(x.pop || 0), kw: x.kwaliteit, naam: x.naam, wie: r.name}; return best; }
function divHistTick(s){ const H = (s.divHist ??= {}); for (const d of s.divisions){ const nm = divNaam(d), o = r1(((s.divomzet || {})[nm] || 0) + (s.producten || []).filter(p => p.divisie === nm).reduce((a, p) => a + ((s.prodomzet || {})[p.id] || 0) + ((s.exportOmzet || {})[p.id] || 0), 0));
  H[nm] = [...(H[nm] || []), {m: ym(s), o}].slice(-36); } for (const k of Object.keys(H)) if (!s.divisions.some(d => divNaam(d) === k)) delete H[k]; }
function jaarOverzicht(s){ const J = {}; for (const h of s.history || []){ const y = String(h.m).slice(0, 4); if (!/^\d{4}$/.test(y)) continue; const x = (J[y] ??= {jaar: y, omzet: 0, kosten: 0, netto: 0, mnd: 0}); x.omzet += h.omzet || 0; x.kosten += h.kosten || 0; x.netto += h.netto || 0; x.mnd++; x.kas = h.cash; if (h.waarde != null) x.waarde = h.waarde; }
  return Object.values(J).map(x => ({...x, omzet: r1(x.omzet), kosten: r1(x.kosten), netto: r1(x.netto)})).sort((a, b) => b.jaar.localeCompare(a.jaar)); }
/* 5.17: zelf plannen smeden. Tegen een rivaal of een bende, in drie stappen van twee maanden. Elke stap kost geld en is een worp (macht, crew en karakter van de tegenstander tellen); mislukt een stap, dan is het plan ontdekt: afgebroken, relatie omlaag, heat omhoog. */
const EIGEN_PLAN = {
  prijsoorlog: {label: "Prijsoorlog", doel: "rivaal", stappen: ["leveranciers vastleggen", "verkopers wegkopen", "de prijzen dumpen"], kost: 5, mod: 0, uitleg: "Hun marktaandeel −20%, hun producten −10 populariteit; jouw producten in dezelfde soort +5."},
  overloop: {label: "Mensen wegkopen", doel: "rivaal", stappen: ["teams in kaart brengen", "aanbiedingen onder de tafel", "een heel team overnemen"], kost: 4, mod: 5, uitleg: "Zij verliezen 20% personeel, jij krijgt de helft erbij (zonder wervingskosten); morale +3."},
  laster: {label: "Lastercampagne", doel: "rivaal", stappen: ["vuil verzamelen", "journalisten benaderen", "publiceren"], kost: 3, mod: 5, uitleg: "Hun marktaandeel −10%, moeheid +15; jouw reputatie −2 als het later uitkomt (kleine kans)."},
  sabotage: {label: "Sabotage", doel: "rivaal", stappen: ["depots verkennen", "een bewaker omkopen", "toeslaan"], kost: 6, mod: -5, uitleg: "Zij verliezen €15-30M en hun beste product −15 populariteit. Heat +3."},
  uitroken: {label: "Bende uitroken", doel: "bende", stappen: ["informanten werven", "de politie tippen", "de panden leegvegen"], kost: 5, mod: 0, uitleg: "De bende verliest 30 aanwezigheid in al jouw districten; relatie met hen −20."},
};
const eigenPlanKost = (s, k) => r1(EIGEN_PLAN[k].kost * (DIFF[s.player.difficulty] || 1) * clamp(omvang(s), 0.6, 2.5));
function eigenPlanKans(s, k, doel){ const P = EIGEN_PLAN[k], crew = (s.crew || []).filter(m => crewStatus(s, m) !== "opgepakt"), bonus = (crew.some(m => m.rol === "fixer") ? 10 : 0) + (crew.some(m => m.rol === "speurder") ? 5 : 0) + (crew.some(m => m.rol === "spindokter") && k === "laster" ? 10 : 0);
  if (P.doel === "bende"){ const g = (s.gangs || []).find(x => x.id === doel); return g ? snapKans(clamp(65 + bonus + P.mod + (playerPower(s) - gangKracht(g)) / 2, 25, 90)) : 0; }
  const r = s.rivals.find(x => x.name === doel); if (!r) return 0; return snapKans(clamp(65 + bonus + P.mod + (playerPower(s) - rivalPower(s, r)) / 2 - (r.karakter === "paranoide" ? 10 : 0), 25, 90)); }
function actEigenPlan(s, ctx, k, doel){ const P = EIGEN_PLAN[k]; if (!P) return {ok: false, msg: "Onbekend plan."}; if ((s.eigenPlannen || []).length) return {ok: false, msg: "Je hebt al een plan lopen. Eén tegelijk."};
  const naam = P.doel === "bende" ? ((s.gangs || []).find(x => x.id === doel) || {}).naam : (s.rivals.find(x => x.name === doel) || {}).name; if (!naam) return {ok: false, msg: P.doel === "bende" ? "Kies een bende." : "Kies een rivaal."};
  const kost = eigenPlanKost(s, k); if (s.cash < kost) return {ok: false, msg: `De eerste stap kost €${kost}M.`};
  (s.eigenPlannen ??= []).push({id: "ep" + hex8(), k, doel, naam, stap: 0, volgende: plusMonths(s, 2), sinds: ym(s)}); s.cash = r1(s.cash - kost); s.accounts.operationeel = s.cash;
  addLog(s, `Plan gestart: ${P.label} tegen ${naam} (€${kost}M)`);
  return {ok: true, msg: `${P.label} tegen ${naam} is begonnen: ${P.stappen[0]}. Elke twee maanden een stap (€${kost}M, ${eigenPlanKans(s, k, doel)}% kans per stap). Als het slaagt: ${P.uitleg}`}; }
function actEigenPlanStop(s){ const L = s.eigenPlannen || []; if (!L.length) return {ok: false, msg: "Er loopt geen plan."}; const p = L[0]; s.eigenPlannen = []; return {ok: true, msg: `${EIGEN_PLAN[p.k].label} tegen ${p.naam} afgeblazen. Wat al betaald is, is weg.`}; }
function eigenPlanEind(s, ctx, p){ const P = EIGEN_PLAN[p.k], r = s.rivals.find(x => x.name === p.doel), g = (s.gangs || []).find(x => x.id === p.doel); let txt = "";
  if (p.k === "prijsoorlog" && r){ const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.8; for (const x of r.producten || []) x.pop = Math.max(5, (x.pop || 0) - 10); const aard = new Set((r.producten || []).map(x => x.aard)); for (const x of (s.producten || []).filter(y => y.status === "markt" && aard.has(y.aard || aardVan(y.type, y.naam)))) x.pop = Math.round(clamp(x.pop + 5, 3, 95)); relShift(r, -15); txt = `De prijsoorlog tegen ${r.name} is gewonnen: hun klanten lopen weg, hun producten zakken.`; }
  else if (p.k === "overloop" && r){ const n = Math.max(2, Math.round(r.staff * 0.2)); r.staff = Math.max(10, r.staff - n); s.staff.count += Math.round(n / 2); s.morale = clamp(s.morale + 3); relShift(r, -10); txt = `Een heel team van ${r.name} werkt nu voor ons (${Math.round(n / 2)} mensen).`; }
  else if (p.k === "laster" && r){ const m = s.market[r.sector]; if (m) m.rivals[r.name] = (m.rivals[r.name] || 0) * 0.9; r.moeheid = clamp(r.moeheid + 15); relShift(r, -8); if (kansRol() < 0.15){ s.reputation = clamp(s.reputation - 2); txt = " Een journalist ontdekte wie erachter zat: reputatie −2."; } txt = `De campagne tegen ${r.name} slaat aan.` + txt; }
  else if (p.k === "sabotage" && r){ const l = r1(U(15, 30)); r.cash = r1(r.cash - l); const b = (r.producten || []).sort((a, b2) => (b2.pop || 0) - (a.pop || 0))[0]; if (b) b.pop = Math.max(5, (b.pop || 0) - 15); s.heat = clamp(s.heat + 3); relShift(r, -12); txt = `Brand in een depot van ${r.name}: ±€${l}M schade${b ? `, ${b.naam} ligt even niet in de winkels` : ""}.`; }
  else if (p.k === "uitroken" && g){ for (const d of playerDistricts(s)) if ((g.gebied || {})[d.id] != null) g.gebied[d.id] = Math.max(0, g.gebied[d.id] - 30); g.relatie = Math.round(g.relatie - 20); txt = `${g.naam} is uit onze wijken gerookt.`; }
  else txt = "Het doel bestaat niet meer; het plan is zonder effect afgerond.";
  if (r) remember(r, s, `plan van de speler: ${P.label.toLowerCase()}`); mail(ctx, s, "Je crew", `Gelukt: ${P.label} tegen ${p.naam}`, txt, "NORMAAL"); ctx.rep.push(`Plan gelukt: ${P.label} tegen ${p.naam}`); addLog(s, txt); }
function eigenPlanTick(s, ctx){ for (const p of [...(s.eigenPlannen || [])]){ if (p.volgende > ym(s)) continue; const P = EIGEN_PLAN[p.k], kans = eigenPlanKans(s, p.k, p.doel);
  if (!kans){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); continue; } const roll = rolKans(kans); addRoll(s, `Plan ${P.label} stap ${p.stap + 1}: ${roll.txt} → ${roll.ok ? "GELUKT" : "ONTDEKT"}`);
  if (!roll.ok){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); s.heat = clamp(s.heat + 2); const r = s.rivals.find(x => x.name === p.doel), g = (s.gangs || []).find(x => x.id === p.doel); if (r){ relShift(r, -10); remember(r, s, `ontdekte een plan van de speler (${P.label.toLowerCase()})`); } if (g) g.relatie = Math.round(g.relatie - 10);
    mail(ctx, s, "Juridische Zaken", `Ontdekt: ${P.label} tegen ${p.naam}`, `Bij "${P.stappen[p.stap]}" ging het mis. ${p.naam} weet wat we van plan waren. Het plan is van tafel; relatie −10, heat +2. (Worp ${roll.txt}.)`, "HOOG"); ctx.rep.push(`Plan ontdekt: ${P.label}`); continue; }
  p.stap += 1; if (p.stap >= P.stappen.length){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); eigenPlanEind(s, ctx, p); continue; }
  const kost = eigenPlanKost(s, p.k); if (s.cash < kost){ s.eigenPlannen = s.eigenPlannen.filter(x => x !== p); ctx.rep.push(`Plan ${P.label} gestopt: geen geld voor de volgende stap`); continue; }
  s.cash = r1(s.cash - kost); p.volgende = plusMonths(s, 2); ctx.rep.push(`Plan ${P.label}: stap ${p.stap} gelukt, nu ${P.stappen[p.stap]} (€${kost}M)`); } }
/* 5.19: de CEO als persoon. Leeftijd, gezondheid en stress; privéleven (partner, kinderen); een opvolger (een kind = dynastie, of iemand uit de directie). Zonder opvolger kiest de raad bij je vertrek een buitenstaander: zware klap, maar het spel gaat door. Rivaliserende CEO's worden ouder, worden vervangen en hebben een persoonlijke relatie met jou. */
function ceoInit(s, d){ if (s.ceo) return s.ceo; const naam = String((d && d.ceo_naam) || "").trim().slice(0, 40);
  s.ceo = {naam: naam || "De CEO", leeftijd: RI(34, 48), gezondheid: RI(78, 92), stress: 20, partner: R() < 0.55, kinderen: RI(0, 2), opvolger: null, generatie: 1}; return s.ceo; }
const ceoLeeftijd = s => Math.floor((s.ceo || {}).leeftijd || 40);
function ceoOpvolgers(s){ const C = s.ceo || {}, L = []; for (let i = 0; i < (C.kinderen || 0); i++) L.push({id: "kind" + i, naam: `Kind ${i + 1} (${C.naam === "De CEO" ? "erfgenaam" : C.naam.split(" ").slice(-1)[0]})`, soort: "dynastie"});
  for (const n of s.npcs || []) if (!n.verraad) L.push({id: "npc:" + n.name, naam: `${n.name} (${n.role})`, soort: "raad"}); return L; }
function actCeo(s, ctx, soort, arg){ const C = ceoInit(s); const pay = k => { if (s.cash < k) return false; s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; return true; }; const m = ym(s);
  if (soort === "vakantie"){ if (C.vakantie === m) return {ok: false, msg: "Je bent deze maand al weg geweest."}; if (!pay(2)) return {ok: false, msg: "Een vakantie kost €2M."}; C.vakantie = m; C.stress = clamp(C.stress - 30); s.morale = clamp(s.morale - 1); return {ok: true, msg: "Twee weken op een privé-eiland zonder netwerk. Stress −30. Het bedrijf mist je even (morale −1)."}; }
  if (soort === "kliniek"){ if (!pay(10)) return {ok: false, msg: "De kliniek kost €10M."}; C.gezondheid = clamp(C.gezondheid + 20); s.heat = clamp(s.heat + 2); return {ok: true, msg: "Nieuwe organen uit een kliniek die niet op de kaart staat. Gezondheid +20, heat +2."}; }
  if (soort === "gezin"){ if (C.gezin === m) return {ok: false, msg: "Je hebt deze maand al tijd voor je gezin gemaakt."}; C.gezin = m; C.stress = clamp(C.stress - 12); s.morale = clamp(s.morale + 1); if (!C.partner && kansRol() < 0.25){ C.partner = true; return {ok: true, msg: "Een avond die uitliep. Je hebt een partner. Stress −12."}; } if (C.partner && C.kinderen < 3 && kansRol() < 0.12){ C.kinderen += 1; return {ok: true, msg: "Er is een kind op komst. Een erfgenaam, als je wilt. Stress −12."}; } return {ok: true, msg: "Een weekend zonder telefoon. Stress −12, morale +1."}; }
  if (soort === "opvolger"){ const o = ceoOpvolgers(s).find(x => x.id === arg); if (!o) return {ok: false, msg: "Kies een opvolger."}; C.opvolger = o; return {ok: true, msg: `${o.naam} is je opvolger (${o.soort === "dynastie" ? "een dynastie" : "uit de directie"}).`}; }
  if (soort === "golf"){ const r = s.rivals.find(x => x.name === arg); if (!r) return {ok: false, msg: "Kies een rivaal."}; if (r.golf === m) return {ok: false, msg: `Je hebt deze maand al met ${r.ceo} gegolfd.`}; if (!pay(1)) return {ok: false, msg: "Golf kost €1M."};
    r.golf = m; r.ceoRel = Math.round(clamp((r.ceoRel || 0) + 10, -100, 100)); relShift(r, 4); return {ok: true, msg: `Achttien holes met ${r.ceo}. Persoonlijke band +10, relatie met ${r.name} +4.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function ceoOpvolging(s, ctx, reden){ const C = s.ceo, o = C.opvolger, oud = C.naam; let txt;
  if (o && o.soort === "dynastie"){ C.naam = `${oud === "De CEO" ? "De nieuwe CEO" : oud.split(" ")[0] + " jr."}`; C.leeftijd = RI(26, 34); C.gezondheid = RI(80, 95); C.stress = 25; C.kinderen = 0; C.partner = false; s.morale = clamp(s.morale - 3); txt = `${oud} ${reden}. ${C.naam} neemt het roer over: de dynastie gaat door.`; }
  else if (o && o.soort === "raad"){ const n = o.id.slice(4); C.naam = n; C.leeftijd = RI(40, 55); C.gezondheid = RI(70, 88); C.stress = 30; C.kinderen = RI(0, 2); C.partner = R() < 0.5; s.npcs = (s.npcs || []).filter(x => x.name !== n); s.morale = clamp(s.morale - 5); txt = `${oud} ${reden}. ${n} wordt CEO, zoals afgesproken. De directie schuift een plek op.`; }
  else { C.naam = genCeoNaam(new Set()); C.leeftijd = RI(42, 58); C.gezondheid = RI(70, 88); C.stress = 35; C.kinderen = 0; C.partner = R() < 0.5; s.morale = clamp(s.morale - 12); s.reputation = clamp(s.reputation - 8); txt = `${oud} ${reden}. Er was geen opvolger: de raad haalt ${C.naam} van buiten. Onrust op de vloer (morale −12) en in de pers (reputatie −8).`; }
  C.opvolger = null; C.generatie = (C.generatie || 1) + 1; mail(ctx, s, "De Raad van Bestuur", "Een nieuwe CEO", txt + " Jij speelt verder als de nieuwe CEO.", "KRITIEK"); news(s, `Nieuwe CEO bij ${s.player.corp_name}`, txt, "", "markt", true); ctx.rep.push(`Nieuwe CEO: ${C.naam}`); addLog(s, txt); }
function ceoTick(s, ctx){ const C = ceoInit(s); C.leeftijd = Math.round((C.leeftijd + 1 / 12) * 1000) / 1000;
  const doel = clamp(15 + s.heat * 0.35 + (s.cash < 0 ? 25 : 0) + (100 - s.morale) * 0.15 + (s.rivals.filter(r => r.status === "oorlog").length * 8) - (C.partner ? 5 : 0), 0, 100); C.stress = Math.round(clamp(C.stress + (doel - C.stress) * 0.15) * 10) / 10;
  const L = ceoLeeftijd(s), daling = (L > 55 ? (L - 55) * 0.06 : 0) + (C.stress > 60 ? (C.stress - 60) * 0.03 : 0) - (C.stress < 30 && L < 55 ? 0.15 : 0); C.gezondheid = Math.round(clamp(C.gezondheid - daling + U(-0.3, 0.3)) * 10) / 10;
  if (C.stress > 75 && kansRol() < 0.05){ C.gezondheid = clamp(C.gezondheid - 12); s.morale = clamp(s.morale - 3); mail(ctx, s, "Huisarts", "Burn-out", `${C.naam} zakte in elkaar in de lift. Gezondheid −12. Rust, zegt de dokter. Ze zeggen het altijd.`, "HOOG"); ctx.rep.push("CEO: burn-out"); }
  if (C.gezondheid <= 0) ceoOpvolging(s, ctx, "overlijdt na een kort ziekbed"); else if (L >= 78 && kansRol() < 0.1) ceoOpvolging(s, ctx, "gaat met pensioen, of wordt daartoe gedwongen");
  for (const r of s.rivals){ r.ceoLeeftijd ??= RI(40, 66); if (s.date.month === 1) r.ceoLeeftijd += 1; r.ceoRel = Math.round((r.ceoRel || 0) * 0.98);
    if (s.date.month === 1 && (r.ceoLeeftijd >= 72 || kansRol() < 0.03)){ const oud = r.ceo; r.ceo = genCeoNaam(new Set(s.rivals.map(x => x.ceo))); r.ceoLeeftijd = RI(38, 55); r.ceoRel = 0; delete r.karakter; geefKarakter(r); news(s, `Nieuwe CEO bij ${r.name}`, `${oud} vertrekt. ${r.ceo} neemt over: ${RIVAAL_KARAKTER[r.karakter].label.toLowerCase()}, zeggen insiders.`, "", "markt", false); ctx.rep.push(`${r.name}: nieuwe CEO ${r.ceo}`); } } }
/* 5.20: eigen moeilijkheid. Vijf schuiven die jij zet, bij het oprichten of later: gebeurtenissen, chaos, corpospanning, heat en de winstdrempel. Een zwaarder spel telt zwaarder in de score; de laagste stand die je ooit had, telt. */
const INSTEL = {events: {label: "Gebeurtenissen", uitleg: "regionale gebeurtenissen en onverwachte rekeningen"}, chaos: {label: "Chaos", uitleg: "nomaden, cyberpsycho's, spookzendingen en ander onheil"}, spanning: {label: "Corpospanning", uitleg: "hoe snel de wereld afglijdt"}, heat: {label: "Heat", uitleg: "hoe snel de politie op je let"}, winst: {label: "Winstdrempel", uitleg: "de bedrijfswaarde die je nodig hebt om te winnen"}};
const INSTEL_NIV = {laag: 0.6, normaal: 1, hoog: 1.4}, INSTEL_WINST = {laag: 0.75, normaal: 1, hoog: 1.3};
const inst = (s, k) => ((((s && s.player) || {}).instel) || {})[k] ?? 1;
const instelNiv = (k, n) => (k === "winst" ? INSTEL_WINST : INSTEL_NIV)[n] ?? 1;
const instelNaam = (s, k) => { const v = inst(s, k), T = k === "winst" ? INSTEL_WINST : INSTEL_NIV; return Object.keys(T).find(n => Math.abs(T[n] - v) < 1e-6) || "normaal"; };
function instelScore(I){ let m = 1; for (const k of ["events", "chaos", "spanning", "heat"]) m += ((I[k] ?? 1) - 1) * 0.25; m += ((I.winst ?? 1) - 1) * 0.4; return Math.round(clamp(m, 0.6, 1.5) * 100) / 100; }
function actInstel(s, k, n){ if (!INSTEL[k]) return {ok: false, msg: "Onbekende instelling."}; if (!(n in (k === "winst" ? INSTEL_WINST : INSTEL_NIV))) return {ok: false, msg: "Kies laag, normaal of hoog."};
  const p = s.player, I = (p.instel ??= {}); I[k] = instelNiv(k, n); const sc = instelScore(I); p.instelScore = Math.min(p.instelScore ?? sc, sc); addLog(s, `Moeilijkheid: ${INSTEL[k].label} ${n}`);
  return {ok: true, msg: `${INSTEL[k].label}: ${n}. Score-vermenigvuldiger nu ×${sc}${p.instelScore < sc ? ` (voor de score telt de laagste ooit: ×${p.instelScore})` : ""}.`}; }
/* 6.1: een hoofd per divisie. Talent 1-5; focus omzet (+2% per talent) of kosten (−3% per talent). Loyaliteit drijft naar 45 + morale/4 (+10 bij een bonus deze maand); onder 25 kan het hoofd vertrekken. */
const hoofdKost = s => r1(4 * (DIFF[s.player.difficulty] || 1));
function hoofdF(d, soort){ const h = d.hoofd; if (!h || h.focus !== soort) return 1; return soort === "omzet" ? 1 + 0.02 * h.talent : 1 - 0.03 * h.talent; }
function actHoofd(s, ctx, div, soort, arg){ const d = s.divisions.find(x => divNaam(x) === div); if (!d) return {ok: false, msg: "Onbekende divisie."};
  if (soort === "aannemen"){ if (d.hoofd) return {ok: false, msg: `${divNaam(d)} heeft al een hoofd.`}; const k = hoofdKost(s); if (s.cash < k) return {ok: false, msg: `Werving kost €${k}M.`};
    const talent = RI(1, 5); d.hoofd = {naam: genCeoNaam(new Set([...(s.npcs || []).map(n => n.name), ...s.divisions.map(x => (x.hoofd || {}).naam)])), talent, loyaliteit: RI(50, 70), loon: r1(0.2 + 0.12 * talent), focus: "omzet", sinds: ym(s)};
    s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; addLog(s, `${d.hoofd.naam} hoofd van ${divNaam(d)} (talent ${talent})`);
    return {ok: true, msg: `${d.hoofd.naam} leidt ${divNaam(d)}: talent ${talent} van 5, €${d.hoofd.loon}M per maand. Focus op omzet (+${2 * talent}%) of kosten (−${3 * talent}%).`}; }
  const h = d.hoofd; if (!h) return {ok: false, msg: "Deze divisie heeft geen hoofd."};
  if (soort === "focus"){ if (!["omzet", "kosten"].includes(arg)) return {ok: false, msg: "Kies omzet of kosten."}; h.focus = arg; return {ok: true, msg: `${h.naam} richt zich op ${arg === "omzet" ? `omzet (+${2 * h.talent}%)` : `kosten (−${3 * h.talent}%)`}.`}; }
  if (soort === "bonus"){ if (h.bonus === ym(s)) return {ok: false, msg: "Deze maand al een bonus gegeven."}; if (s.cash < 1) return {ok: false, msg: "Een bonus kost €1M."}; s.cash = r1(s.cash - 1); h.bonus = ym(s); h.loyaliteit = clamp(h.loyaliteit + 10); return {ok: true, msg: `${h.naam} krijgt een bonus: loyaliteit +10.`}; }
  if (soort === "ontslaan"){ const n = h.naam; delete d.hoofd; s.morale = clamp(s.morale - 1); return {ok: true, msg: `${n} is vertrokken. ${divNaam(d)} heeft geen hoofd meer.`}; }
  return {ok: false, msg: "Onbekende actie."}; }
function hoofdTick(s, ctx){ for (const d of s.divisions){ const h = d.hoofd; if (!h) continue; const doel = 45 + s.morale / 4 + (h.bonus === ym(s) ? 10 : 0); h.loyaliteit = Math.round(clamp(h.loyaliteit + (doel - h.loyaliteit) * 0.1 + U(-1.5, 1.5)) * 10) / 10;
  if (h.loyaliteit < 25 && kansRol() < 0.15){ const r = s.rivals.length ? CH(s.rivals).name : "een rivaal"; mail(ctx, s, "HR", `${h.naam} vertrekt`, `${h.naam} (hoofd ${divNaam(d)}) stapt over naar ${r}. Loyaliteit was ${Math.round(h.loyaliteit)}.`, "HOOG"); ctx.rep.push(`${h.naam} vertrekt`); delete d.hoofd; } } }
/* 6.2: rivalen spelen met dezelfde regels. Rijke rivalen bouwen aanwezigheid op in districten naast hun gebied (neutraal, of van jou als ze je niet mogen). Twee maanden ≥55% en groter dan de eigenaar = het district is van hen. Je thuisdistrict en hoofdkantoren vallen nooit zo. */
function rivAanwezigTick(s, ctx, idx, hqs){ const RA = (s.rivAanwezig ??= {});
  for (const r of s.rivals){ const M = (RA[r.name] ??= {}); for (const k of Object.keys(M)){ M[k] = r1(M[k] * 0.95); if (M[k] < 1) delete M[k]; }
    if (r.cash < 120 || kansRol() >= 0.1) continue;
    const eigen = s.districts.filter(d => d.control === r.name), kand = new Set(); for (const d of eigen) for (const n of d.neighbors || []){ const b = idx.get(n); if (!b || hqs.has(b.id) || b.id === s.player.home_district) continue; if (b.control === "neutral" || (b.control === "player" && (r.relatie || 0) < -20)) kand.add(b); }
    if (!kand.size) continue; const L = [...kand], speler = L.filter(d => d.control === "player"), d = speler.length && R() < 0.4 ? CH(speler) : CH(L);
    M[d.id] = Math.min(150, r1((M[d.id] || 0) + 20)); r.cash = r1(r.cash - 10);
    if (d.control === "player" && M[d.id] >= 40 && !(d.rivWaarsch === r.name)){ d.rivWaarsch = r.name; mail(ctx, s, "Strategie", `${r.name} wil ${d.name}`, `${r.name} koopt panden, sponsort clubs en zet mensen op straat in ${d.name}. Wordt hun aandeel groter dan het onze, dan valt het district hen toe. Aanwezigheid opbouwen of een patrouille helpt.`, "HOOG"); } }
  for (const d of s.districts){ if (hqs.has(d.id) || d.id === s.player.home_district || !d.dom) continue; const eig = domEigenaar(s, d);
    let top = null; for (const r of s.rivals) if (r.name !== d.control){ const v = d.dom[r.name] || 0; if (v >= DOM_FLIP && v > eig && (!top || v > top.v)) top = {r, v}; }
    if (!top){ delete d.domRiv; continue; } if ((d.domRiv || {}).naam === top.r.name) d.domRiv.n += 1; else d.domRiv = {naam: top.r.name, n: 1};
    if (d.domRiv.n >= 2){ const van = d.control; d.control = top.r.name; delete d.domRiv; delete d.rivWaarsch;
      if (van === "player"){ if (s.patrouille) delete s.patrouille[d.id]; mail(ctx, s, "Strategie", `${d.name} valt ${top.r.name} toe`, `Hun aandeel in ${d.name} (${Math.round(top.v)}%) is groter dan het onze. Zonder één schot zijn we het district kwijt.`, "KRITIEK"); ctx.rep.push(`${d.name} valt ${top.r.name} toe`); }
      news(s, `${top.r.name} neemt ${d.name} over`, `Overal hun logo, hun mensen, hun geld. ${d.name} draait nu op ${top.r.name}.`, d.continent, "wereld", van === "player"); } } }
/* 6.8: contracten voor zware producten. Tanks, ziekenhuissystemen, satellieten en andere grote stukken verkopen alleen aan legers, staten en bedrijven via een aanvraag; die komen vaak (±50% per maand per product). */
const AANVRAAG_MAX = 6, CONTRACT_PER_PRODUCT = 2;
/* 6.8.1: zelf een zwaar product aanbieden bij legers en staten: één keer per maand per product, levert meteen een contractaanvraag op */
const pitchKost = s => r1(1.5 * (DIFF[s.player.difficulty] || 1));
const pitchMag = (s, p) => !!p && p.status === "markt" && stukInfo(p).order && !isAbo(p) && p.pitch !== ym(s) && (s.aanvragen || []).filter(a => a.product === p.id).length < CONTRACT_PER_PRODUCT;
function actPitch(s, ctx, id){ const p = (s.producten || []).find(x => x.id === id); if (!p || !(p.status === "markt" && stukInfo(p).order && !isAbo(p))) return {ok: false, msg: "Alleen zware producten op de markt kun je zo aanbieden."};
  if (p.pitch === ym(s)) return {ok: false, msg: `${p.naam} is deze maand al aangeboden. Volgende maand weer.`};
  if ((s.aanvragen || []).filter(a => a.product === p.id).length >= CONTRACT_PER_PRODUCT) return {ok: false, msg: `Er liggen al ${CONTRACT_PER_PRODUCT} aanvragen voor ${p.naam} open. Schrijf eerst in.`};
  const k = pitchKost(s); if (s.cash < k) return {ok: false, msg: `Een presentatie kost €${k}M.`};
  const a = maakContract(s, p); if (!a) return {ok: false, msg: "Er is nu niemand om aan te bieden."};
  s.cash = r1(s.cash - k); s.accounts.operationeel = s.cash; p.pitch = ym(s); a.minKwal = Math.min(a.minKwal, p.kwaliteit); (s.aanvragen ??= []).push(a); addLog(s, `${p.naam} aangeboden aan ${a.klant} (€${k}M)`);
  return {ok: true, msg: `Demo, diner, een rondleiding door de fabriek: ${a.tekst} Inschrijven kan meteen.`}; }
const CONTRACT_KLANT = {wapen: ["leger", "staat"], beveiliging: ["staat", "leger", "bedrijf"], orbitaal: ["leger", "staat", "bedrijf"], medisch: ["staat", "bedrijf"], implantaat: ["leger", "bedrijf"], data: ["staat", "bedrijf"], financieel: ["staat"], logistiek: ["bedrijf", "staat"], smokkel: ["syndicaat"], consument: ["bedrijf"]};
function maakContract(s, p){ const aard = p.aard || aardVan(p.type, p.naam), soorten = (CONTRACT_KLANT[aard] || ["bedrijf"]).filter(k => (k !== "syndicaat" || (s.gangs || []).length) && (k !== "bedrijf" || (s.bedrijven || []).some(b => !b.eigenaar))); if (!soorten.length) return null;
  const soort = CH(soorten), K = KLANT_SOORT[soort], land = CH(s.districts.filter(d => d.control !== "player")) || s.districts[0]; let klant, gang = null, bedL = null;
  if (soort === "bedrijf"){ const b = CH((s.bedrijven || []).filter(b => !b.eigenaar)); klant = b.naam; bedL = b.land; } else if (soort === "syndicaat"){ const g = CH(s.gangs); klant = g.naam; gang = g.id; } else klant = `${CH(K.namen)} (${land.name})`;
  const cont = soort === "syndicaat" ? null : bedL ? (s.districts.find(d => d.id === bedL) || {}).continent || null : land.continent;
  const basis = Math.max(1, prodOmzet(s, {...p, prijsF: 1}) * 1.2), I = stukInfo(p), raam = R() < 0.45, a = {id: "a" + hex8(), m: ym(s), soort, klant, gang, aard, raam, cont, product: p.id, minKwal: clamp(p.kwaliteit + RI(-1, 1), 1, 5), verloopt: 4}; /* 7.0: moeilijker, met continent */
  if (raam){ a.maanden = CH([6, 12, 18]); a.perMaand = r1(basis * U(0.7, 1.1)); } else a.bedrag = r1(basis * U(4, 8));
  const stuks = Math.max(1, Math.round((a.bedrag || a.perMaand) * 1e6 / Math.max(1, stukPrijs(p))));
  a.tekst = `${klant} wil ${raam ? `een raamcontract: ${a.maanden} maanden lang ±${stuks} ${stuks === 1 ? I.enkel : I.eenheid} per maand` : `${stuks} ${stuks === 1 ? I.enkel : I.eenheid}`} van ${p.naam}, minimaal kwaliteit ${a.minKwal}.`; return a; }
const spanningGem = s => { const v = Object.values(s.spanning || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
function tijdlijnTick(s, ctx){ const nu = ym(s), gehad = (s.tijdlijnGehad ??= []), B = (s.vraagBasis ??= {});
  for (const t of TIJDLIJN){ if (t.d > nu || gehad.includes(t.d)) continue; gehad.push(t.d); const recent = mndNr(nu) - mndNr(t.d) <= 2;
    for (const [a, v] of Object.entries(t.basis || {})){ B[a] = (B[a] || 0) + v; if (t.tot) (s.basisTot ??= []).push({a, v, tot: t.tot}); }
    if (recent){ for (const [a, v] of Object.entries(t.schok || {})) vraagSchok(s, a, v, t.kop); news(s, t.kop, t.tekst, "", "wereld", true); ctx.rep.push(`Wereld: ${t.kop}`); } }
  if (s.basisTot) s.basisTot = s.basisTot.filter(x => { if (x.tot > nu) return true; B[x.a] = (B[x.a] || 0) - x.v; return false; }); }
function vraagTick(s){
  vraagInit(s);
  const oorlogen = s.rivals.filter(r => r.status === "oorlog").length + (s.flags.special_oorlog ? 1 : 0), dreig = (s.dreigingen || []).length;
  for (const [a, x] of Object.entries(s.vraag)){
    let drift = ((100 + ((s.vraagBasis || {})[a] || 0) + (a === "wapen" ? spanningGem(s) / 8 : a === "beveiliging" ? spanningGem(s) / 10 : 0)) - x.idx) * 0.03 + U(-0.02, 0.02) * 100 / 100; /* 5.3: normale vraag schuift met de tijdlijn */
    if (a === "wapen") drift += oorlogen * 0.015 + (s.gangs || []).filter(g => g.deal === "oorlog").length * 0.01;
    if (a === "beveiliging") drift += oorlogen * 0.008 + dreig * 0.01;
    if (a === "implantaat" && (s.tijdperk || 0) >= 1) drift += 0.006;
    if (a === "orbitaal" && (s.tijdperk || 0) >= 2) drift += 0.01;
    x.trend = x.trend * 0.6 + drift;
    x.idx = r1(clamp(x.idx * (1 + x.trend), 45, 220)); x.hist = [...(x.hist || []), Math.round(x.idx)].slice(-12);
    if (Math.abs(x.trend) < 0.01) x.reden = "";
  }
}
/* gebeurtenissen in de wereld schuiven de vraag */
const VRAAG_DOOR_EVENT = {storm: [["logistiek", -0.06], ["beveiliging", 0.03]], staking: [["logistiek", -0.05]], blackout: [["data", -0.08], ["logistiek", 0.04]], boom: [["consument", 0.05], ["financieel", 0.04]],
  coup: [["wapen", 0.1], ["beveiliging", 0.06]], akkoord: [["logistiek", 0.06], ["consument", 0.04]], sancties: [["smokkel", 0.12]], virus: [["medisch", 0.15]], cyber: [["beveiliging", 0.1], ["data", -0.04]], implantaat: [["implantaat", -0.08]]};
const VRAAG_DOOR_SPECIAL = {krach: [["financieel", -0.15], ["consument", -0.1]], blackout: [["data", -0.15], ["logistiek", 0.08]], aiwet: [["data", -0.1], ["implantaat", -0.05]], pool: [["logistiek", 0.08]],
  rivalenoorlog: [["wapen", 0.15], ["beveiliging", 0.08]], psychose: [["implantaat", -0.18], ["beveiliging", 0.12], ["medisch", 0.06]], orbitaal: [["orbitaal", 0.2]], signaal: [["data", 0.1]], vluchtelingen: [["medisch", 0.06], ["smokkel", 0.08]]};

const PRODUCT_TRAITS = {
  verslavend: {label: "Verslavend", tekst: "veroudert nauwelijks, maar heat +0,3/mnd", goed: true},
  cult: {label: "Cultstatus", tekst: "populariteit zakt nooit onder 35", goed: true},
  duurzaam: {label: "Duurzaam", tekst: "reputatie +0,2/mnd", goed: true},
  slim: {label: "Slim", tekst: "invloed +0,2/mnd", goed: true},
  gepatenteerd: {label: "Gepatenteerd", tekst: "rivalen kunnen het niet kopiëren, namaak minder vaak", goed: true},
  militair: {label: "Militaire specificatie", tekst: "macht +2, heat +0,3/mnd", goed: true},
  goedkoop: {label: "Goedkoop gemaakt", tekst: "levert 15% meer op, maar vaker bijwerkingen en terugroepacties", goed: false},
  gevoelig: {label: "Storingsgevoelig", tekst: "verliest elk kwartaal populariteit tot er een nieuwe versie is", goed: false},
};
function kiesTrait(p, crit, flop){
  const goed = Object.keys(PRODUCT_TRAITS).filter(k => PRODUCT_TRAITS[k].goed && (k !== "militair" || ["wapen", "beveiliging"].includes(p.aard)) && (k !== "verslavend" || ["implantaat", "medisch", "data", "consument", "smokkel"].includes(p.aard)));
  const slecht = Object.keys(PRODUCT_TRAITS).filter(k => !PRODUCT_TRAITS[k].goed);
  if (crit) return CH(goed);
  if (flop) return R() < 0.6 ? CH(slecht) : null;
  return R() < 0.45 ? (R() < 0.7 ? CH(goed) : CH(slecht)) : null;
}
function prodLog(p, s, tekst){ (p.log ??= []).unshift({m: ym(s), tekst}); p.log = p.log.slice(0, 6); }
function traitEffecten(p){ const t = p.trait, o = {};
  if (t === "verslavend") o.heat = 0.3; if (t === "duurzaam") o.reputation = 0.2; if (t === "slim") o.invloed = 0.2; if (t === "militair"){ o.macht = 2; o.heat = 0.3; } return o; }
function wereldInvloedProducten(s){
  // wapens bewapenen de straat, beveiliging drukt syndicaten terug in je eigen gebied
  const mijn = s.districts.filter(d => d.control === "player").map(d => d.id);
  let wapen = 0, bev = 0;
  for (const p of (s.producten || []).filter(x => x.status === "markt")){ const f = prodSterkte(p); if (p.aard === "wapen") wapen += f; if (p.aard === "beveiliging") bev += f; }
  if (!wapen && !bev) return;
  for (const g of s.gangs || []) for (const land of Object.keys(g.gebied)){
    if (wapen) g.gebied[land] = Math.round(clamp(g.gebied[land] + wapen * 0.6, 0, 95));
    if (bev && mijn.includes(land)) g.gebied[land] = Math.round(clamp(g.gebied[land] - bev * 1.2, 0, 95));
  }
}

/* ===================== 3.0 PRODUCTEN VAN RIVALEN, CATALOGUS, BETER ONTWIKKELEN ===================== */
const PRODUCT_BASIS = {wapen: ["Karabijn", "Smartgun", "Railpistool", "Drone-geweer"], medisch: ["Kweekhuid", "Immuunpatch", "Bloedserum", "Celkuur"], implantaat: ["Optiek", "Reflexchip", "Kunstarm", "Neurolink"],
  data: ["Feed", "Profielbank", "Stream", "Zoekmachine"], beveiliging: ["Wachtdienst", "Bunkerdienst", "Escort", "Cyberwacht"], smokkel: ["Nachtvracht", "Grensdienst", "Stille lijn"], logistiek: ["Express", "Koelvracht", "Dronelijn", "Havendienst"],
  financieel: ["Krediet", "Fonds", "Polis", "Rekening"], orbitaal: ["Satlink", "Orbitlab", "Lanceerdienst"], consument: ["Lijn", "Serie", "Huismerk"]};
const rivalMerk = r => r.name.split(/[\s-]/)[0];
function mkRivalProduct(s, r, aard){
  aard ||= SECTOR_AARD[r.sector] || "consument";
  const used = new Set([...(s.producten || []).map(p => p.naam), ...s.rivals.flatMap(x => (x.producten || []).map(p => p.naam))]); let naam = "";
  for (let i = 0; i < 10; i++){ naam = `${rivalMerk(r)} ${CH(PRODUCT_BASIS[aard] || PRODUCT_BASIS.consument)}${CH(["", " Pro", " X", " 2", " Neo", " Prime", " 9"])}`; if (!used.has(naam)) break; }
  const lv = r.divs[r.sector] || 2;
  return {id: "rp" + hex8(), naam, aard, kwaliteit: clamp(Math.round(1 + lv / 2 + U(-0.6, 0.8)) + (((r.tech || {})[aard] || 0) >= 2 ? 1 : 0), 1, 5), pop: RI(40, 65), sinds: ym(s), leeftijd: 0};
}
function rivalProductInit(s){
  for (const r of s.rivals){ if (r.producten) continue; r.producten = [];
    for (const sec of Object.keys(r.divs)) r.producten.push(mkRivalProduct(s, r, SECTOR_AARD[sec] || "consument"));
    if ((r.divs[r.sector] || 0) >= 3) r.producten.push(mkRivalProduct(s, r, SECTOR_AARD[r.sector] || "consument")); }
}
function rivalProductTick(s){
  rivalProductInit(s);
  for (const r of s.rivals){
    for (const p of r.producten){ p.leeftijd = (p.leeftijd || 0) + 1; const v = (((s.vraag || {})[p.aard]) || {idx: 100}).idx;
      const tgt = 28 + p.kwaliteit * 8 + (v - 100) / 6 - Math.max(0, p.leeftijd - 30) * 0.8; p.pop = Math.round(clamp(p.pop + (tgt - p.pop) * 0.08 + U(-2, 2), 3, 95)); }
    r.producten = r.producten.filter(p => p.pop > 10 || p.leeftijd < 12);
    const max = 2 + Math.floor(Object.values(r.divs).reduce((a, b) => a + b, 0) / 3);
    if (r.producten.length < max && r.cash > 60 && R() < 0.07){
      const opts = [...new Set(Object.keys(r.divs).map(sec => SECTOR_AARD[sec] || "consument"))].sort((a, b) => ((((s.vraag || {})[b]) || {}).idx || 100) - ((((s.vraag || {})[a]) || {}).idx || 100));
      const p = mkRivalProduct(s, r, opts[0]); r.producten.push(p); r.cash = r1(r.cash - 10);
      const mine = (s.producten || []).filter(x => x.status === "markt" && (x.aard || aardVan(x.type, x.naam)) === p.aard); for (const x of mine) x.pop = Math.max(3, x.pop - 4);
      news(s, `${r.name} lanceert ${p.naam}`, `Een nieuw product in ${(PRODUCT_AARD[p.aard] || PRODUCT_AARD.consument).label.toLowerCase()}, kwaliteit ${p.kwaliteit}.${mine.length ? ` Concurrent van jouw ${mine.map(x => x.naam).join(", ")} (populariteit −4).` : ""}`, landNaam(s, r.hq), "markt", mine.length > 0);
    }
  }
}
const rivalProductInkomen = r => (r.producten || []).reduce((a, p) => a + p.kwaliteit * p.pop / 100, 0) * 1.5;

/* ontwikkelen met een focus en een voorspelling */
const DEV_FOCUS = {
  standaard: {label: "Gebalanceerd", tekst: "Geen bijzonderheden."},
  kwaliteit: {label: "Kwaliteit", tekst: "Kwaliteit +1, maar moeilijker (doel +1).", kw: 1, doel: 1},
  snel: {label: "Snel", tekst: "Een maand sneller, maar moeilijker (doel +1).", maanden: -1, doel: 1},
  goedkoop: {label: "Goedkoop", tekst: "40% goedkoper, maar vaak de eigenschap 'goedkoop gemaakt'.", kost: 0.6},
  innovatief: {label: "Innovatief", tekst: "Hit al bij 11 of 12, maar terugroepactie bij 2 of 3. Vaak slim of gepatenteerd.", crit: 11, blunder: 3},
  veilig: {label: "Veilig", tekst: "Nooit een terugroepactie (wordt een flop), vaak duurzaam. Doel +1.", veilig: true, doel: 1},
};
function devKansen(bonus, doel, focus){
  /* 4.1.2: hit vanaf doel+3, een neutrale band (matige start) tot doel−3, flop pas daaronder: de flopkans komt nooit boven 50% */
  const F = DEV_FOCUS[focus] || DEV_FOCUS.standaard, critT = F.crit || 12, blT = F.veilig ? 1 : (F.blunder || 2); let hit = 0, ok = 0, neutraal = 0, flop = 0, terug = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++){ const t = a + b;
    if (t >= critT || t + bonus >= doel + 3) hit++; else if (t <= blT) terug++; else if (t + bonus >= doel) ok++; else if (t + bonus >= doel - 3) neutraal++; else flop++; }
  const p = n => Math.round(n / 36 * 100); return {hit: p(hit), gewoon: p(ok), neutraal: p(neutraal), flop: p(flop), terug: p(terug)};
}
function devPlan(s, d, schaal, focus, aard, beta){
  const sc = PRODUCT_SCHAAL[schaal] || PRODUCT_SCHAAL.klein, F = DEV_FOCUS[focus] || DEV_FOCUS.standaard, k = productKans(s, d, schaal), dif = DIFF[s.player.difficulty] || 1;
  const doel = k.doel + (F.doel || 0), a = PRODUCT_AARD[aard] ? aard : aardVan(d.type, ""), bb = beta ? 1 : 0;
  return {kost: r1(sc.kost * dif * (F.kost || 1) * (beta ? 1.2 : 1)), maanden: Math.max(1, sc.maanden + (F.maanden || 0) - (heeftFocus(s, "rd") ? 1 : 0)) + bb, kw: clamp(1 + Math.floor(d.level / 2) + sc.kw + (F.kw || 0), 1, 5), bonus: k.bonus + bb, doel, beta: !!beta,
    kansen: devKansen(k.bonus + bb, doel, focus), aard: a, markt: vraagFactor(s, a), vraag: Math.round((((s.vraag || {})[a]) || {idx: 100}).idx),
    concurrenten: s.rivals.reduce((n, r) => n + (r.producten || []).filter(p => p.aard === a).length, 0)};
}
function lanceerWorp(s, d, p){
  const F = DEV_FOCUS[p.focus || "standaard"] || DEV_FOCUS.standaard, k = productKans(s, d, p.schaal || "klein"), doel = p.doelOverride || (k.doel + (F.doel || 0)), bonus = k.bonus + (p.beta ? 1 : 0);
  const a = d6(), b = d6(), t = a + b, blunder = !F.veilig && t <= (F.blunder || 2), crit = !blunder && (t >= (F.crit || 12) || t + bonus >= doel + 3), ok = crit || (!blunder && t + bonus >= doel), neutraal = !ok && !blunder && t + bonus >= doel - 3;
  return {ok, crit, blunder, neutraal, nat: t >= (F.crit || 12), txt: `${DICE[a - 1]}${DICE[b - 1]}${bonus ? ` +${bonus}` : ""}${p.beta ? " (bètatest)" : ""} = ${t + bonus}, nodig ${doel}+ (hit ${doel + 3}+)${crit ? " · hit" : blunder ? " · blunder" : neutraal ? " · matige start" : ""}`};
}
function focusTrait(p){
  if (p.focus === "goedkoop" && R() < 0.7) return "goedkoop";
  if (p.focus === "veilig" && R() < 0.4) return "duurzaam";
  if (p.focus === "innovatief" && R() < 0.45) return R() < 0.5 ? "slim" : "gepatenteerd";
  return undefined;
}

/* ===================== 3.0 DUIDELIJKHEID: adviezen, terugverdientijd ===================== */
function upgradePlan(s, d){
  const t = typeOf(s, d.type) || {rev: 8, cost: 5}, dif = DIFF[s.player.difficulty] || 1, kost = upgradeCost(s, d);
  const extraOmzet = t.rev * (Math.pow(d.level + 1, 0.95) - Math.pow(d.level, 0.95)) * marketRevMult(s, d.type) * sectorBonus(s, d.type) * productMult(s, d) * (0.75 + 0.35 * s.morale / 100);
  const extra = (extraOmzet - t.cost * 0.85 * dif * divCostMult(s, d.type)) * 0.8;
  return {kost, extra: r1(extra), terug: extra > 0.2 ? Math.round(kost / extra) : null};
}
function vestigingPlan(s, d){ const kost = districtCost(s, d), extra = r1((incOf(d) - d.upkeep) * 0.8); return {kost, extra, terug: extra > 0.2 ? Math.round(kost / extra) : null}; }
const adviesSleutel = t => String(t).replace(/[\d.,€±%−+]+/g, "#").slice(0, 60);
function adviesTick(s){ const nieuw = {}, T = s.adviesTel || {}; for (const a of adviezen(s)) { const k = adviesSleutel(a.tekst); nieuw[k] = (T[k] || 0) + 1; } s.adviesTel = nieuw; }
function adviezen(s, alles){
  const out = [], add = (prio, tekst, view) => out.push({prio, tekst, view});
  const markt = (s.producten || []).filter(p => p.status === "markt"), dev = (s.producten || []).filter(p => p.status === "ontwikkeling" || p.status === "wachtrij");
  const net = ((s.history || []).slice(-1)[0] || {}).netto;
  { const hp = heatPrognose(s); if (hp.maanden && hp.maanden <= 8) add(hp.maanden <= 3 ? 10 : 8, `Heat stijgt ${hp.delta}/mnd${hp.bron ? ` (vooral: ${hp.bron.toLowerCase()})` : ""}: over ±${hp.maanden} ${hp.maanden === 1 ? "maand" : "maanden"} zit je op 90, en twee maanden boven 90 geeft een razzia${hp.razzias ? ` (je had er al ${hp.razzias} van ${hp.max})` : ""}. Juridisch offensief (Overzicht → Gezondheid), een gunst van de commissaris of sporen wissen.`, "overzicht"); } /* 7.2 */
  for (const d of s.divisions){ const sl = d.slijt ?? 1; if (sl < 0.9 && !divVernieuwt(s, d)) add(sl < 0.6 ? 9 : 6, `${divNaam(d)} raakt achterop: ze verkoopt nog ${Math.round(sl * 100)}% van wat ze kon en het zakt elke maand. Een nieuw product, een editie of een uitbreiding keert het.`, "bedrijf"); } /* 7.0 */
  if (!markt.length && !dev.length && (s.flags.stappen_weg || maandenGespeeld(s) >= 8)) add(10, "Je verkoopt nog niets. Start je eerste product bij Bedrijf → Productlijn: klein kost €5M en is in 2 maanden klaar, en een divisie met producten verdient meer.", "bedrijf");
  else for (const d of s.divisions) if (!(s.producten || []).some(p => p.divisie === divNaam(d))) add((d.leeg || 0) > 12 ? 9 : 7, (d.leeg || 0) > 12 ? `${divNaam(d)} verkoopt al ${d.leeg} maanden niets: klanten lopen weg, omzet ×${productMult(s, d).toFixed(2)}. Start een product bij Bedrijf → Productlijn.` : `${divNaam(d)} heeft geen producten en draait op ×0,95; na een jaar zonder producten lopen klanten weg. Start er een bij Bedrijf → Productlijn.`, "bedrijf");
  if (s.cash < 0){ const nog = Math.max(1, 3 - (s.flags.negatieve_cash_maanden || 0)), dochter = (s.bedrijven || []).some(b => b.eigenaar === "player" && b.koppeling === "dochter"), aand = (s.bedrijven || []).some(b => !b.eigenaar && b.aandeel > 0);
    add(12, `Cash is negatief: nog ${nog} maand(en) tot faillissement. Snel geld: een lening (Financiën, tot €${Math.max(0, Math.round(loanCap(s)))}M)${s.accounts.zwart > 0 ? `, zwart geld overboeken (€${Math.round(s.accounts.zwart)}M)` : ""}${dochter ? ", een dochter verkopen (Bedrijf)" : ""}${aand ? ", aandelen verkopen (Wereld)" : ""}, of kosten schrappen: personeel, crew of een project.`, "financien"); }
  { const ng = markt.find(p => ["nodig", "afgekeurd"].includes(keurStatus(p)) && keurF(p) < 1); if (ng) add(8, `${ng.naam} is niet goedgekeurd en verkoopt alleen op de grijze markt (${Math.round(KEUR_ZONDER * 100)}% van de afzet). Een keuring kost €${keurKost(s)}M en twee maanden; of verkoop het via de zwarte markt (Details → Verkoop en keuring).`, "bedrijf"); }
  for (const p of markt){ const cap = prodCap(s, p), v = vraagNa(p); if (v > cap){ add(7, `${p.naam} is uitverkocht: ${Math.round((v - cap) / v * 100)}% van de vraag levert niets op. Productie uitbreiden kost €${capKost(s, p)}M (Bedrijf → Productlijn → Details).`, "bedrijf"); break; } }
  if ((s.keuzes || []).length) add(9, `${s.keuzes.length === 1 ? "1 beslissing wacht" : `${s.keuzes.length} beslissingen wachten`} op je. Zonder antwoord kiest het spel na twee maanden zelf, meestal niet in jouw voordeel.`, "overzicht");
  if (net != null && net < -1 && s.cash > 0 && s.cash / -net < 24) add(9, `Je verloor vorige maand €${Math.abs(net)}M. Met €${Math.round(s.cash)}M in kas heb je nog ±${Math.max(1, Math.round(s.cash / -net))} maanden. Snij in crew, personeel of projecten, of lanceer een product.`, "financien");
  if (s.staff.count < staffNeed(s)) add(8, `Onderbezet: ${s.staff.count} mensen voor ${staffNeed(s)} plekken. Divisies draaien op halve kracht en morale lijdt. Neem ${staffNeed(s) - s.staff.count} mensen aan bij Bedrijf (€0,4M p.p.).`, "bedrijf");
  if (s.morale < 40) add(9, `Morale ${Math.round(s.morale)}: onder 10 komt de raad in opstand. Salaris omhoog (Bedrijf), een gunst van de bond (Mensen) of winst draaien helpt.`, "bedrijf");
  { const h = (s.history || []).slice(-7), daling = h.length >= 6 ? r1(h[0].rep - h[h.length - 1].rep) : 0, pers = G.mails ? G.mails.filter(m => /^Journalist/.test(m.van) && m.datum >= ((s.history || []).slice(-6)[0] || {}).m).length : 0;
    const smaad = (s.smaadLog || []).filter(m => mndNr(ym(s)) - mndNr(m) <= 6).length, dl = String(daling).replace(".", ",");
    if (daling >= 6 && (pers >= 2 || s.reputation < 20)) add(8, pers >= 2 ? `Reputatie zakt (−${dl} in 6 maanden) en journalisten citeren interne stukken: misschien lekt er iemand uit je directie. Laat een speurder een directielid natrekken (Crew) of praat met je mensen (Mensen).`
      : smaad && smaad * 3 >= daling / 2 ? `Reputatie zakt (−${dl} in 6 maanden), vooral door ${smaad === 1 ? "een lastercampagne" : `${smaad} lastercampagnes`} van een concurrent. Herstel gaat via een spindokter met de klus Campagne (Crew), producten met een goede naam (medisch, beveiliging) of premium prijzen.`
      : smaad ? `Reputatie zakt (−${dl} in 6 maanden). ${smaad === 1 ? "Een lastercampagne" : `${smaad} lastercampagnes`} van een concurrent verklaren maar een deel; de rest is onduidelijk. Laat een speurder je directie natrekken (Crew), of kijk in Logboek wat er gebeurde.`
      : `Reputatie zakt (−${dl} in 6 maanden). Wat er gebeurde staat in Logboek. Herstel gaat via een spindokter met de klus Campagne (Crew), producten met een goede naam (medisch, beveiliging) of premium prijzen.`, "crew"); }
  { /* 5.6.1: straatoorlog, corpowetten en dominantie in Wat nu? */
    const dreig = []; for (const r of s.rivals){ if (r.status === "oorlog" || (r.relatie || 0) > -20) continue; for (const d of playerDistricts(s)) if (d.id !== s.player.home_district && !(s.patrouille || {})[d.id] && spanningVan(s, d.continent) >= STRAAT.drempel && reachable(s, r.name, d)) dreig.push([r, d]); }
    if (dreig.length){ const [r, d] = dreig[0]; add(8, `${r.name} mag je niet en kan ${d.name} op straat innemen (spanning ${Math.round(spanningVan(s, d.continent))}). Een patrouille maakt dat veel moeilijker: Wereld → Corpospanning.`, "wereld"); }
    const wet = Object.keys(CORPOWETTEN).find(k => wetStatus(s, k).ok); if (wet) add(5, `Corpowet ${CORPOWETTEN[wet].label} kan nu: ${CORPOWETTEN[wet].uitleg} Wereld → Corpospanning.`, "wereld");
    { const exP = (s.producten || []).filter(p => p.status === "markt" && EXPORT_AARD.includes(p.aard || aardVan(p.type, p.naam))); if (exP.length && !Object.keys(s.exportVergunning || {}).length && s.cash > vergunningKost(s) + 50) add(4, `Je verkoopt ${PRODUCT_AARD[exP[0].aard || aardVan(exP[0].type, exP[0].naam)].label.toLowerCase()} alleen op je eigen continent. Een exportvergunning (Bedrijf → Export, €${vergunningKost(s)}M) geeft +${Math.round(EXPORT_BONUS * 100)}% omzet per continent.`, "bedrijf"); }
    { const mijn = [...new Set((s.producten || []).filter(p => p.status === "markt").flatMap(grondstoffenVan))], st = mijn.find(m => gsPrijs(s, m) >= 1.4 && !gsVoorraad(s, m)), go = mijn.find(m => gsPrijs(s, m) <= 0.85 && !gsVoorraad(s, m));
      if (st) add(5, `${GRONDSTOF[st].label} is duur (×${gsPrijs(s, st)}): je productiekosten stijgen. Bij Bedrijf → Toelevering zie je waarom; voorraad helpt pas als de prijs weer zakt.`, "bedrijf");
      else if (go) add(4, `${GRONDSTOF[go].label} is goedkoop (×${gsPrijs(s, go)}). Nu voorraad aanleggen (Bedrijf → Toelevering) zet die prijs vast.`, "bedrijf"); }
    { const pp = (s.producten || []).find(p => p.status === "markt" && !p.patent && besteSpec(p).v >= PATENT_MIN); if (pp && s.cash > patentKost(s) + 30) add(4, `${pp.naam} heeft een sterke ${besteSpec(pp).naam.toLowerCase()} (${besteSpec(pp).v}). Een patent (productblad → Markt, €${patentKost(s)}M) geeft +${Math.round(PATENT_BONUS * 100)}% omzet en licentiegeld.`, "bedrijf"); }
    { const O = s.onderzoek || {}; const aa = [...new Set((s.producten || []).filter(p => p.status === "markt").map(p => p.aard || aardVan(p.type, p.naam)))].find(x => techNiveau(s, x) < 3 && TECH_NAMEN[x]); if (!O.lopend && aa && s.cash > techKost(s, techNiveau(s, aa) + 1) / techMaanden(techNiveau(s, aa) + 1) + 60 && maandenGespeeld(s) >= 6) add(3, `Er loopt geen onderzoek. ${TECH_NAMEN[aa][techNiveau(s, aa)]} geeft ${PRODUCT_AARD[aa].label.toLowerCase()} ${TECH_EFFECT[techNiveau(s, aa)]} (Bedrijf → Onderzoek).`, "bedrijf"); }
    if (s.ceo){ const C = s.ceo, L = Math.floor(C.leeftijd || 40); if (C.stress > 70) add(6, `Je stress is ${Math.round(C.stress)}: kans op een burn-out en je gezondheid zakt. Vakantie of tijd voor je gezin helpt (Mensen → Jij, de CEO).`, "mensen");
      else if (C.gezondheid < 35) add(6, `Je gezondheid is ${Math.round(C.gezondheid)}. Een kliniek (€10M) of minder stress helpt; regel ook een opvolger.`, "mensen");
      if (!C.opvolger && (L >= 58 || C.gezondheid < 40)) add(5, `Je bent ${L} en hebt geen opvolger. Valt je weg, dan haalt de raad een buitenstaander (morale −12, reputatie −8). Wijs iemand aan bij Mensen → Jij, de CEO.`, "mensen"); }
    const av = (s.aanvragen || [])[0]; if (av) add(7, `${av.klant} wil ${av.raam ? "een raamcontract" : "een levering"} (${PRODUCT_AARD[av.aard].label.toLowerCase()}). Inschrijven bij Bedrijf → Klanten, nog ${av.verloopt} maand${av.verloopt > 1 ? "en" : ""}.`, "bedrijf");
    { const dr = s.districts.find(d => d.control === "player" && d.domRiv); if (dr) add(8, `${dr.domRiv.naam} heeft meer aandeel in ${dr.name} dan jij: volgende maand is het district van hen. Bouw aanwezigheid op of zet er een patrouille (Kaart).`, "kaart"); }
    const bijna = s.districts.find(d => (d.domMnd || 0) >= 1); if (bijna) add(6, `${bijna.name} valt je volgende maand toe als je aandeel boven ${DOM_FLIP}% blijft (Kaart).`, "kaart"); }
  if (s.heat > 55) add(9, `Heat ${Math.round(s.heat)}: boven 90 volgt een razzia. Laat een netrunner sporen wissen (Crew), vraag de commissaris om een gunst (Mensen) of gebruik invloed (Kaart).`, "crew");
  const vrijeCrew = (s.crew || []).filter(m => crewStatus(s, m) === "vrij");
  for (const k of (s.klussen || [])){ const m = vrijeCrew.find(x => x.rol === k.rol); if (m){ add(6, `${m.naam} kan de klus "${k.titel}" doen: +€${k.beloning}M, ${kans2d6(crewBonus(s, m, k.gevaar), k.doel, m.trait === "slordig")}% kans.`, "crew"); break; } }
  if (vrijeCrew.length && !out.some(x => x.view === "crew")) add(4, `${vrijeCrew.length} crewlid(en) doen deze maand nog niets. Opdrachten kosten niets extra.`, "crew");
  const ups = s.divisions.filter(d => !s.projects.some(p => p.division === divNaam(d))).map(d => ({d, ...upgradePlan(s, d)})).filter(x => x.terug && x.kost < s.cash - 20).sort((a, b) => a.terug - b.terug)[0];
  if (ups) add(ups.terug <= 18 ? 6 : 3, `${divNaam(ups.d)} uitbreiden naar L${ups.d.level + 1}: €${ups.kost}M, ±+€${ups.extra}M per maand na belasting, terugverdiend in ±${ups.terug} maanden.`, "bedrijf");
  const vest = s.districts.filter(d => d.control === "neutral" && reachable(s, "player", d) && !s.projects.some(p => p.district === d.id)).map(d => ({d, ...vestigingPlan(s, d)})).filter(x => x.terug && x.kost < s.cash - 20).sort((a, b) => a.terug - b.terug)[0];
  if (vest) add(5, `Vestiging in ${vest.d.name}: €${vest.kost}M, ±+€${vest.extra}M per maand, terugverdiend in ±${vest.terug} maanden. Telt ook mee voor dominantie.`, "kaart");
  for (const g of s.gangs || []) if (!g.deal && gangLanden(s, g).length){ add(5, `${g.naam} zit in je gebied zonder afspraak. Vroeg of laat komt er een rekening: bescherming kost €${gangFee(s, g)}M per maand.`, "onderwereld"); break; }
  const best = doelen(s).filter(d => d.id !== "termijn").sort((a, b) => b.pct - a.pct)[0];
  if (best) add(1, `Dichtst bij winst: ${best.naam} (${best.pct}%, ${best.nu}).`, "overzicht");
  /* 4.5.2: een niet-dringend advies dat al drie maanden onveranderd staat, zakt naar "staat al een tijdje" */
  const T = s.adviesTel || {}; for (const a of out){ a.maanden = T[adviesSleutel(a.tekst)] || 0; a.oud = a.maanden >= 3 && a.prio < 9; }
  out.sort((a, b) => b.prio - a.prio); if (alles) return out; return [...out.filter(a => !a.oud).slice(0, 6), ...out.filter(a => a.oud).slice(0, 4)];
}
function adviesCard(st){
  const A = st.adviezen; if (!A.length) return "";
  return `<div class="card advies"><div class="spread"><h3>Wat nu?</h3><span class="dim" style="font-size:13px">op volgorde van belang</span></div>
    <ol class="alist">${A.filter(a => !a.oud).map(a => `<li><span>${esc(a.tekst)}</span>${a.view && a.view !== "overzicht" ? `<button class="btn sm" data-view="${a.view}">Ga</button>` : ""}</li>`).join("")}</ol>
    ${A.some(a => a.oud) ? `<details style="margin-top:6px"><summary class="dim" style="cursor:pointer;font-size:13px">Staat al een tijdje (${A.filter(a => a.oud).length})</summary><ul class="alist dim" style="font-size:13.5px">${A.filter(a => a.oud).map(a => `<li><span>${esc(a.tekst)}</span>${a.view && a.view !== "overzicht" ? `<button class="btn sm" data-view="${a.view}">Ga</button>` : ""}</li>`).join("")}</ul></details>` : ""}</div>`;
}
const SPELREGELS = [
  ["Tijd", "Rechtsboven: ▶ laat de maanden vanzelf lopen, op snelheid 1 (traag) tot 5 (turbo); +1 maand doet er precies één. De tijd pauzeert vanzelf bij een nieuw besluit, een kritieke mail, oorlog, heat boven 85 of een rode kas, en zolang je typt of een venster open hebt. Spatie = afspelen/pauze."],
  ["Razzia", "Heat boven 90, twee maanden lang, geeft elke maand kans op een razzia: een boete, al je zwart geld kwijt, je heetste divisie een niveau omlaag, reputatie en morale −10, heat terug naar 50. De derde razzia is het einde. Overzicht → Gezondheid toont wanneer je op 90 zit en waar de heat vandaan komt; een juridisch offensief haalt er 12 af."],
  ["Opslaan", "Het spel bewaart zichzelf na elke actie. Een opslagpunt (Ctrl+S, Menu → Opslaan of links OPSLAAN) is een vaste kopie van dit moment; via Menu → Laden ga je er later naar terug. Het staat als apart spel in de lijst."],
  ["Een beurt", "Elke beurt is een maand. Je doet wat je wilt (producten, mensen, crew, deals) en klikt dan +1 maand of laat de tijd lopen. Dan rekent de engine omzet, kosten, gebeurtenissen en rivalen uit en stuurt de CFO een rapport."],
  ["Geld", "Omzet komt uit divisies (hoger niveau = meer), producten (kwaliteit × populariteit × markt), gebieden, contracten en klussen. Kosten: divisies, lonen, crew, rente, projecten en winstbelasting. Drie maanden rood = failliet."],
  ["Dobbelstenen", "Elke onzekere actie is 2d6 + bonus tegen een doel. Twee zessen lukt altijd, twee enen nooit. De kans die je vooraf ziet is de echte kans. Elke worp staat in Logboek → Dobbelstenen."],
  ["Morale en heat", "Morale onder 10, twee maanden lang: coup. Heat boven 90, twee maanden lang: razzia. Heat komt vooral uit riskante en illegale divisies (Smokkel, Cyberware, Private Security), die met elk niveau meer aandacht trekken; legale divisies trekken boven niveau 6 geen extra aandacht meer. Het overzicht laat zien waarom ze bewegen en waarschuwt ruim op tijd."],
  ["Stilstand", "Verkoopt een divisie een jaar lang niets, dan lopen klanten naar rivalen: de omzet zakt elke maand verder, tot −20%. Eén product op de markt stopt het meteen."],
  ["Winnen", "Een bedrijfswaarde van €12.400M (10 jaar: €7.200M, eindeloos: €16.800M), 60% op drie continenten, of 3 van de 5 oorspronkelijke rivalen uitgeschakeld. Anders telt na de gekozen speellengte je score. Sta je op de beurs, dan telt alleen jouw deel van de bedrijfswaarde."],
  ["Corporate zone", "Een vierde manier om te winnen: wordt je thuiscontinent een corporate zone (corpospanning 90+) terwijl jij er 60% of meer van de dominantie hebt, dan regeert jouw corporatie daar. Spanning stijgt vanzelf, en sneller door oorlogen, straatgevechten en bendeoorlogen."],
  ["De wereld", "Elk continent heeft een corpospanning (Wereld → Corpospanning): hoe hoger, hoe meer corporaties mogen (patrouilles, straatgevechten, corpowetten), maar ook sancties en duurdere grondstoffen. Districten zijn verdeeld in aandelen; met aanwezigheid neem je ze zonder oorlog over (Kaart)."],
  ["Handel en groei", "Klanten sturen aanvragen en raamcontracten (Bedrijf → Klanten). Exportvergunningen openen continenten voor wapens, beveiliging en implantaten. Grondstoffen kun je vooruit inkopen (Toelevering). Onderzoek en patenten maken je producten sterker. Per product kies je in welke regio's je verkoopt (productblad → Markt)."],
  ["Score", "Bedrijfswaarde telt met de wortel (40 × √waarde), plus dominantie, reputatie, jaren, uitgeschakelde rivalen en status. Winnen ×1,25 plus tempo, termijn uitdienen ×1, verliezen ×0,75 en zonder de waarde van je bedrijf: een verlies scoort dus nooit hoger dan overleven met hetzelfde bedrijf."],
  ["Keuzes", "Keuzemails hebben knoppen; elke optie zegt wat ze kost en doet. Antwoord je niet, dan kiest het spel na twee maanden de standaardoptie."],
];

