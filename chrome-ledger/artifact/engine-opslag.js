/* Chrome Ledger engine, deel engine-opslag.js: opslag, wat het scherm toont, chat, mail en de acties van het scherm. 7.4: de engine staat in zes bestanden die in deze volgorde laden (kern, wereld, leven, producten, gm, opslag); alles deelt dezelfde globale scope. */
/* =====================================================================
   Opslag: de database van het artifact (alleen de eigenaar leest en
   schrijft), met browseropslag als terugval. Claude kan via dezelfde
   database meelezen en antwoorden als de live verbinding ontbreekt.
   ===================================================================== */
const G = {game: null, mails: [], chats: {}, mode: "laden", gid: null, db: null, sample: null, sampleOff: false, unsub: []};
G.fouten = (() => { try { return JSON.parse(localStorage.getItem("cl_fouten") || "[]"); } catch(_){ return []; } })();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let mailSeq = 0;
const LKEY = "cl_spel_v2", MAX_SLOTS_LOKAAL = 6;
G.tab = Math.random().toString(36).slice(2, 10);

function localLoad(){ try { return JSON.parse(localStorage.getItem(LKEY) || "null"); } catch(e){ return null; } }
function localSave(){ try { localStorage.setItem(LKEY, JSON.stringify({game: pak(G.game), mails: G.mails.slice(0, 300), chats: G.chats})); G.saveFout = false; return true; }
  catch(e){ foutLog("opslaan in de browser", e); if (!G.saveFout) toast("Opslaan in de browser is mislukt (opslag vol?). Exporteer je spel via Logboek, anders ben je je voortgang kwijt bij het sluiten.", true); G.saveFout = true; return false; } }

const Store = {
  async init(){
    setTimeout(() => Store.eregalerij().catch(() => {}), 1500);
    let db = null;
    try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch(e){ db = null; }
    if (!db){ this.useLocal(); return; }
    G.db = db;
    try {
      const ptr = await withTimeout(db.doc("meta/huidig").get(), 10000);
      G.gid = ptr.exists ? ptr.data().gid : null;
      if (!G.gid){ G.gid = "g" + uid(); await db.doc("meta/huidig").set({gid: G.gid}); }
      G.mode = "db"; this.subscribe();
    } catch(e){ G.db = null; this.useLocal(); toast("De online opslag reageert niet. Je spel wordt nu alleen in deze browser bewaard.", true); }
  },
  useLocal(){
    const d = localLoad(); G.mode = "lokaal"; try { G.gid = localStorage.getItem("cl_huidig") || "lokaal"; } catch(e){ G.gid = "lokaal"; }
    if (d){ G.game = d.game; G.mails = d.mails || []; G.chats = d.chats || {}; }
    S.loaded = true; render();
  },
  subscribe(){
    for (const u of G.unsub) u(); G.unsub = [];
    const base = "games/" + G.gid, db = G.db;
    let first = false;
    const timer = setTimeout(() => { if (!first){ S.loadNote = "De opslag reageert traag. Wat je ziet kan verouderd zijn."; render(); } }, 10000);
    G.unsub.push(db.doc(base).onSnapshot(snap => {
      const later = first; first = true; clearTimeout(timer); S.loadNote = "";
      const dt = snap.exists ? snap.data() : null;
      if (later && dt && dt.tab && dt.tab !== G.tab && Date.now() - (G.tabWarn || 0) > 60000){ G.tabWarn = Date.now(); toast("Dit spel is net in een ander tabblad of op een ander apparaat bijgewerkt. Je ziet nu die versie: speel in één venster tegelijk.", true); }
      if (!S.busy) G.game = snap.exists ? clone(snap.data().s) : null;
      if (G.game && G.game.map && G.game.map.kind === "wereld" && !G.game.map.frame && !G.game.map.gedeeld){ migrate(G.game); Store.saveGame().catch(() => {}); }
      S.loaded = true; render();
    }, e => { clearTimeout(timer); S.loaded = true; toast("Opslag niet bereikbaar (" + e.code + ").", true); render(); }));
    G.unsub.push(db.collection(base + "/mails").orderBy("t", "desc").limit(400).onSnapshot(q => {
      const before = G.mails.length;
      G.mails = q.docs.map(d => ({id: d.id, ...d.data()}));
      if (S.loaded && before && G.mails.length > before && !S.busy && !S.expect) toast(`${G.mails.length - before} nieuwe mail(s).`);
      if (!S.busy) render();
    }, () => {}));
    G.unsub.push(db.collection(base + "/chats").onSnapshot(q => {
      const next = {}; for (const d of q.docs) next[d.id] = clone(d.data());
      for (const [k, c] of Object.entries(G.chats)) if (c._pending) next[k] = c;   // eigen schrijfactie nog onderweg
      G.chats = next;
      if (!S.busy) render();
    }, () => {}));
  },
  async saveGame(){
    if (G.mode !== "db") return localSave();
    const body = {s: pak(G.game), bijgewerkt: Date.now(), tab: G.tab}, n = JSON.stringify(body).length;
    if (n > 700000 && G.game){ G.game.log = G.game.log.slice(-100); G.game.nieuws = (G.game.nieuws || []).slice(0, 30); G.game.worpen = G.game.worpen.slice(-40); G.game.keuzes_klaar = (G.game.keuzes_klaar || []).slice(0, 15); }
    await G.db.doc("games/" + G.gid).set(body);
  },
  async backup(){
    const s = G.game; if (!s || !s.setup_done) return; const slot = maandenGespeeld(s) % 3, body = {s: clone(pak(s)), maand: ym(s), t: Date.now()};
    try { if (G.mode === "db") await G.db.doc(`games/${G.gid}/backups/b${slot}`).set(body); else localStorage.setItem("cl_backup_" + slot, JSON.stringify(body)); G.backupFout = null; }
    catch(e){ G.backupFout = ym(s); foutLog("back-up " + ym(s), e); toast("De back-up van deze maand is mislukt" + (G.mode === "db" ? "." : " (browseropslag vol?).") + " Je spel zelf is wel bewaard. Exporteer het voor de zekerheid via Logboek.", true); }
  },
  /* 4.7.8: een divisie die bij een (geschrapte) overname verloren ging, terugzetten uit de back-ups */
  async herstelOvername(){ const s = G.game; if (!s || !s.flags || s.flags.overname_herstel_478) return null;
    if ((s.hostile_bid || {}).uitslag !== "verloren"){ s.flags.overname_herstel_478 = true; return null; }
    let B = []; try { B = await this.backups(); } catch(e){ foutLog("herstel overname", e); }
    const namen = new Set(s.divisions.map(divNaam)), gezet = [];
    for (const b of B.slice().sort((x, y) => x.t - y.t)) for (const d of (b.s.divisions || [])){ const nm = divNaam(d); if (namen.has(nm)) continue;
      s.divisions.push(clone(d)); namen.add(nm); const ps = (b.s.producten || []).filter(p => p.divisie === nm && !(s.producten || []).some(q => q.id === p.id)); (s.producten ??= []).push(...clone(ps));
      gezet.push(`${nm} met ${ps.length} product${ps.length === 1 ? "" : "en"} (back-up van ${b.maand})`); }
    s.flags.overname_herstel_478 = true; if (gezet.length){ addLog(s, "Teruggezet na de geschrapte overname: " + gezet.join(", ")); try { await this.saveGame(); } catch(e){ foutLog("herstel opslaan", e); } }
    return gezet; },
  async backups(){
    const out = [];
    for (const slot of [0, 1, 2]){ let b = null;
      try { if (G.mode === "db"){ const d = await withTimeout(G.db.doc(`games/${G.gid}/backups/b${slot}`).get(), 8000); b = d.exists ? d.data() : null; } else b = JSON.parse(localStorage.getItem("cl_backup_" + slot) || "null"); } catch(e){ foutLog("back-up " + slot + " lezen", e); }
      if (b && b.s) migrate(b.s);
      if (b && b.s) out.push({slot, maand: b.maand, t: b.t, cash: r1(b.s.cash), status: b.s.status, s: b.s}); }
    return out.sort((a, b) => b.t - a.t);
  },
  async eregalerij(){ try { if (G.mode === "db"){ const d = await withTimeout(G.db.doc("meta/eregalerij").get(), 8000); G.eregalerij = d.exists ? (d.data().lijst || []) : []; } else G.eregalerij = JSON.parse(localStorage.getItem("cl_eregalerij") || "[]"); } catch(e){ G.eregalerij = G.eregalerij || []; } },
  async addScore(x){ await this.eregalerij(); G.eregalerij = [...(G.eregalerij || []).filter(y => y.id !== x.id), x].sort((a, b) => b.score - a.score).slice(0, 20);
    try { if (G.mode === "db") await G.db.doc("meta/eregalerij").set({lijst: G.eregalerij}); else localStorage.setItem("cl_eregalerij", JSON.stringify(G.eregalerij)); } catch(e){ foutLog("eregalerij opslaan", e); } },
  async addMails(list){
    const now = Date.now();
    const docs = list.map(m => ({id: "m" + uid() + (mailSeq++), t: now * 100 + (mailSeq % 100), gelezen: false, archief: false, ...m}));
    G.mails = [...docs.slice().reverse(), ...G.mails];
    if (G.mode !== "db"){ localSave(); return docs; }
    const col = G.db.collection("games/" + G.gid + "/mails");
    await Promise.all(docs.map(({id, ...body}) => col.doc(id).set(body)));
    return docs;
  },
  async patchMail(id, patch){
    const m = G.mails.find(x => x.id === id); if (!m) return; Object.assign(m, patch);
    if (G.mode !== "db") return localSave();
    await G.db.doc(`games/${G.gid}/mails/${id}`).update(patch);
  },
  async putChat(c){
    c.berichten = c.berichten.slice(-80); G.chats[c.key] = c;
    if (G.mode !== "db") return localSave();
    c._pending = true;
    try { const {_pending, ...body} = c; await G.db.doc(`games/${G.gid}/chats/${c.key}`).set(clone(body)); }
    finally { delete c._pending; }
  },
  async newGame(){
    const L = await this.slots().catch(() => G.slots || []), nieuw = "g" + uid();
    if (G.mode !== "db" && L.length >= MAX_SLOTS_LOKAAL) return {ok: false, msg: `Je hebt al ${L.length} spellen in deze browser; meer past er niet veilig in. Verwijder er een bij Logboek → Spellen (exporteer het eerst als je het wilt bewaren).`};
    if (G.mode !== "db"){ try { localStorage.setItem("cl_slot_" + G.gid, JSON.stringify({game: pak(G.game), mails: G.mails.slice(0, 300), chats: G.chats})); localStorage.setItem("cl_huidig", nieuw); }
      catch(e){ foutLog("spel bewaren voor een nieuw spel", e); return {ok: false, msg: "Je huidige spel kon niet apart bewaard worden (browseropslag vol?). Er is geen nieuw spel gestart, zodat je niets kwijtraakt. Exporteer of verwijder eerst een spel bij Logboek."}; } }
    G.game = null; G.mails = []; G.chats = {}; G.gid = nieuw;
    L.unshift({gid: nieuw, naam: "", datum: "oprichting", status: "", t: Date.now()}); await this.saveSlots(L).catch(() => {});
    if (G.mode === "db"){ await G.db.doc("meta/huidig").set({gid: G.gid}); this.subscribe(); }
    else localSave();
    return {ok: true};
  },
  /* saveslots: meerdere spellen naast elkaar */
  slotInfo(gid, s){ return {naam: s && s.player ? s.player.corp_name || "" : "", datum: s ? (s.setup_done ? ym(s) : "oprichting") : "", status: s ? s.status || "" : ""}; },
  async slots(){
    let L = [];
    if (G.mode === "db"){
      try { const d = await withTimeout(G.db.doc("meta/slots").get(), 8000); L = d.exists ? (d.data().lijst || []) : []; } catch(e){ return G.slots || []; }
      if (!L.length){ let vorige = null; try { const p = await withTimeout(G.db.doc("meta/huidig").get(), 8000); vorige = p.exists ? p.data().vorige : null; } catch(e){}
        for (const id of [G.gid, vorige].filter(Boolean)){ let info = {naam: "", datum: "", status: ""}; try { const g = await withTimeout(G.db.doc("games/" + id).get(), 8000); if (g.exists) info = this.slotInfo(id, g.data().s); } catch(e){} L.push({gid: id, ...info, t: Date.now()}); }
        await G.db.doc("meta/slots").set({lijst: L}).catch(() => {}); }
    } else { try { L = JSON.parse(localStorage.getItem("cl_slots") || "[]"); } catch(e){} }
    if (!L.some(x => x.gid === G.gid)) L.unshift({gid: G.gid, naam: "", datum: "", status: "", t: Date.now()});
    const cur = L.find(x => x.gid === G.gid); if (cur && G.game) Object.assign(cur, this.slotInfo(G.gid, G.game), {t: Date.now()});
    G.slots = L; return L;
  },
  async saveSlots(L){ G.slots = L; if (G.mode === "db") await G.db.doc("meta/slots").set({lijst: L}); else { try { localStorage.setItem("cl_slots", JSON.stringify(L)); } catch(e){} } },
  async switchSlot(gid){
    if (!gid || gid === G.gid) return false;
    const L = await this.slots(); await this.saveSlots(L).catch(() => {});
    if (G.mode === "db"){ G.gid = gid; G.game = null; G.mails = []; G.chats = {}; await G.db.doc("meta/huidig").set({gid}); this.subscribe(); return true; }
    try { localStorage.setItem("cl_slot_" + G.gid, JSON.stringify({game: pak(G.game), mails: G.mails.slice(0, 300), chats: G.chats}));
      const d = JSON.parse(localStorage.getItem("cl_slot_" + gid) || "null"); G.gid = gid; G.game = d ? d.game : null; G.mails = d ? d.mails || [] : []; G.chats = d ? d.chats || {} : {};
      localStorage.setItem("cl_huidig", gid); localSave(); return true; } catch(e){ toast("Wisselen lukte niet: de browseropslag weigert.", true); return false; }
  },
  /* 6.9: opslagpunt = een vaste kopie van het huidige spel als apart spel in de lijst; laden = wisselen naar die kopie */
  async saveAs(label){ const s = G.game; if (!s || !s.setup_done) return {ok: false, msg: "Er is nog geen spel om op te slaan."};
    const L = await this.slots().catch(() => G.slots || []), nieuw = "g" + uid(), info = this.slotInfo(nieuw, s);
    if (G.mode !== "db"){ if (L.length >= MAX_SLOTS_LOKAAL) return {ok: false, msg: `Er passen ${MAX_SLOTS_LOKAAL} spellen en opslagpunten in deze browser. Verwijder er een via Menu → Laden (of exporteer het eerst bij Logboek).`};
      try { localSave(); localStorage.setItem("cl_slot_" + nieuw, JSON.stringify({game: pak(s), mails: G.mails.slice(0, 120), chats: G.chats})); } catch(e){ foutLog("opslagpunt", e); return {ok: false, msg: "De browseropslag is vol. Verwijder een ouder spel via Menu → Laden of exporteer het bij Logboek."}; } }
    else { await this.saveGame(); await G.db.doc("games/" + nieuw).set({s: pak(s), bijgewerkt: Date.now(), tab: G.tab});
      const col = G.db.collection("games/" + nieuw + "/mails"); await Promise.all(G.mails.slice(0, 80).map(({id, ...body}) => col.doc(id).set(clone(body))));
      await Promise.all(Object.values(G.chats).map(c => { const {_pending, ...body} = c; return G.db.doc(`games/${nieuw}/chats/${c.key}`).set(clone(body)); })); }
    const naam = String(label || "Opslagpunt").slice(0, 40), i = Math.max(0, L.findIndex(x => x.gid === G.gid));
    L.splice(i + 1, 0, {gid: nieuw, ...info, label: naam, opslag: true, t: Date.now()}); await this.saveSlots(L).catch(() => {});
    addLog(s, `Opslagpunt gemaakt: ${naam}`); return {ok: true, label: naam, gid: nieuw}; },
  async renameSlot(gid, label){ const L = await this.slots(), x = L.find(y => y.gid === gid); if (!x) return; x.label = String(label || "").trim().slice(0, 40); await this.saveSlots(L); },
  async deleteSlot(gid){
    if (!gid || gid === G.gid) return false;
    const L = (await this.slots()).filter(x => x.gid !== gid);
    if (G.mode === "db"){ const base = "games/" + gid;
      for (const sub of ["mails", "chats", "backups"]){ try { const q = await withTimeout(G.db.collection(base + "/" + sub).get(), 10000); for (const d of q.docs) await G.db.doc(base + "/" + sub + "/" + d.id).delete(); } catch(e){} }
      try { await G.db.doc(base).delete(); } catch(e){} }
    else { try { localStorage.removeItem("cl_slot_" + gid); } catch(e){} }
    await this.saveSlots(L); return true;
  },
};
function withTimeout(p, ms){ return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({code: "timeout"}), ms))]); }
async function persist(ctx){
  const out = [];
  try {
    await Store.saveGame();
    if (ctx && ctx.mails.length) out.push(...await Store.addMails(ctx.mails));
  } catch(e){
    toast(e && e.code === "quota_exceeded" ? "De opslag is vol. Begin een nieuw spel." : "Opslaan mislukt (" + (e && e.code || "onbekend") + "). Probeer het zo nog eens.", true);
  }
  return out;
}

/* ---------- wat het scherm toont (zoals de CFO het rapporteert) ---------- */
function seeded(str){ let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const labelFaction = v => v <= -50 ? "vijandig" : v <= -15 ? "koel" : v < 15 ? "neutraal" : v < 50 ? "warm" : "bondgenoot";
const impression = n => n.verraad ? "lijkt tevreden" : n.loyalty >= 65 ? "loyaal" : n.loyalty >= 45 ? "tevreden" : n.loyalty >= 30 ? "twijfelt" : "ontevreden";
function pendingDecisions(s){
  const f = s.flags, out = [], zw = s.accounts.zwart || 0;
  if (f.wacht_op_speler_vonk) out.push({arc: "vonk", titel: "Mara Vonk wil een antwoord", tekst: "Financier haar tour, negeer haar, of laat het 'oplossen'. De straat kijkt mee.", opties: [
    {keuze: "sponsor", label: "Tour financieren", kost: 15, uitleg: "€15M. Straat warmer, politie koeler, wat heat."},
    {keuze: "negeren", label: "Negeren", kost: 0, uitleg: "Gratis. 1 tot 3 maanden reputatieschade."},
    {keuze: "uitgeschakeld", label: "Laten oplossen", kost: 10, uitleg: `€10M${zw >= 10 ? " uit zwart geld" : ""}. Veel heat, straat woedend, 35% kans dat het uitlekt.`}]});
  if (f.wacht_op_speler_nomaden_pact) out.push({arc: "nomaden_pact", titel: "Isra biedt een pact aan", tekst: "Toegang tot uw netwerk in ruil voor bescherming op de snelweg.", opties: [
    {keuze: "ja", label: "Pact sluiten", kost: 0, uitleg: "Logistiek en smokkel 20% goedkoper, konvooien helpen. Af en toe een eis. Breken is gevaarlijk."},
    {keuze: "nee", label: "Weigeren", kost: 0, uitleg: "Nomaden koeler. Meer kans op gedoe op de snelweg."}]});
  if (f.wacht_op_speler_hostile_bid) out.push({arc: "hostile_bid", titel: "Vijandig overnamebod", tekst: "U heeft 30 dagen. Kies een verdediging. Een gevecht kost geld; niets doen kost meestal het bedrijf.", opties: [
    {keuze: "niets", label: "Niets doen", kost: 0, uitleg: "Ongeveer 15% kans dat het bod mislukt."},
    {keuze: "investeren", label: "Aandelen terugkopen", kost: "budget", uitleg: "35% + 0,5% per €1M budget."},
    {keuze: "juridisch", label: "Juridische strijd", kost: "budget", uitleg: "35% + 0,67% per €1M budget, +3 heat."},
    {keuze: "white_knight", label: "White knight zoeken", kost: 0, uitleg: "60%, maar daarna sta je bij iemand in het krijt."},
    {keuze: "poison_pill", label: "Poison pill", kost: 0, uitleg: "75%, maar morale -10, reputatie -5 en €50M extra schuld."}]});
  if (f.nomaden_eis && typeof f.nomaden_eis === "object") out.push({arc: "nomaden_eis", titel: "Isra vraagt een gunst", tekst: `€${f.nomaden_eis.bedrag}M, of het pact wordt kouder.`, opties: [
    {keuze: "betalen", label: `Betalen (€${f.nomaden_eis.bedrag}M)`, kost: f.nomaden_eis.bedrag, uitleg: "Houdt de snelweg vriendelijk."},
    {keuze: "weigeren", label: "Laten liggen", kost: 0, uitleg: "Kost nomaden-standing."}]});
  return out;
}

/* ---------- contacten: met wie je kunt chatten en mailen ---------- */
const slug = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
const EXTRA = NETWERK;
function contacts(s){
  const out = [{key: "gm", naam: "Assistent", rol: "Uitvoering · zegt wat het kost en regelt het", soort: "gm", groep: "Uitvoering"}];
  for (const n of s.npcs) out.push({key: "npc-" + slug(n.name), naam: n.name, rol: n.role, soort: "npc", groep: "Directie"});
  for (const r of s.rivals) out.push({key: "riv-" + slug(r.name), naam: r.ceo, rol: "CEO " + r.name, soort: "rivaal", ref: r.name, groep: "Rivalen"});
  for (const [key, naam0, rol, bio, fac] of EXTRA){ const naam = netwerkNaam(s, key, naam0); out.push({key, naam, rol: key === "stad" ? rol + ", " + homeLandNaam(s) : rol, soort: "extra", bio, fac, groep: "Netwerk"}); }
  for (const g of s.gangs || []) out.push({key: "gang-" + g.id, naam: g.leider, rol: g.naam + " · " + g.soort, soort: "gang", ref: g.id, groep: "Onderwereld"});
  return out;
}
function findContact(s, name){
  const n = String(name || "").toLowerCase().trim(); if (!n) return null;
  const list = contacts(s).filter(c => c.soort !== "gm");
  return list.find(c => c.naam.toLowerCase() === n)
    || list.find(c => c.soort === "npc" && (c.rol.toLowerCase() === n || n.includes(c.naam.toLowerCase()) || n.includes("(" + c.rol.toLowerCase() + ")")))
    || list.find(c => n.includes(c.naam.toLowerCase()))
    || null;
}
function chatOf(c){ return G.chats[c.key] ??= {key: c.key, naam: c.naam, berichten: []}; }

/* ---------- wat Claude ziet (de speler ziet dit niet) ---------- */
function worldFacts(s){
  return {
    datum: ym(s), bedrijf: s.player, cash: s.cash, zwart: s.accounts.zwart, offshore: s.accounts.offshore, schuld: s.debt,
    heat: r1(s.heat), reputatie: r1(s.reputation), morale: r1(s.morale),
    personeel: {aantal: s.staff.count, nodig: staffNeed(s), salaris_k_per_jaar: s.staff.avg_salary}, cultuur: s.culture,
    divisies: s.divisions, eigen_soorten: s.custom_types, inkomstenbronnen: s.streams || [], projecten: s.projects.map(p => p.name),
    stad: s.city, districten: s.districts.map(d => ({id: d.id, naam: d.name, continent: d.continent, soort: d.arch, controle: d.control, buren: d.neighbors, kust: d.zee})), zee: seaControl(s), jouw_eskaders: {totaal: s.schepen || 0, inzet: s.inzet || {}},
    rivalen: s.rivals.map(r => ({naam: r.name, ceo: r.ceo, sector: r.sector, hq: r.hq, kas: r.cash, agressie: r.aggression, status: r.status, relatie: r.relatie, macht: rivalPower(s, r), divisies: r.divs, districten: rivalDistricts(s, r).map(d => d.id), verdragen: r.verdragen, geheugen: r.memory.slice(-4)})),
    jouw_macht: playerPower(s), aanbiedingen: s.aanbiedingen,
    directie: s.npcs, facties: Object.fromEntries(Object.entries(s.factions).map(([k, v]) => [k, Math.round(v.standing)])),
    vlaggen: s.flags, verborgen_waarheid: s.hidden_truth.slice(-15),
    startvoordeel: startBonus(s), relaties_netwerk: Object.fromEntries(Object.entries(s.relaties || {}).map(([k2, v]) => [k2, v.v])),
    bedrijven_in_de_wereld: (s.bedrijven || []).map(b => ({naam: b.naam, sector: b.sector, land: b.land, waarde: Math.round(b.waarde), eigenaar: b.eigenaar, jouw_aandeel: b.aandeel, contract: b.contract})),
    onderwereld: (s.gangs || []).map(g => ({naam: g.naam, leider: g.leider, relatie: g.relatie, afspraak: g.deal, gebied: g.gebied})),
    rivaal_producten: s.rivals.map(r => `${r.name}: ${(r.producten || []).map(p => `${p.naam} (${p.aard}, k${p.kwaliteit}, pop ${p.pop})`).join(", ")}`),
    producten: (s.producten || []).map(p => ({naam: p.naam, divisie: p.divisie, soort: p.aard || aardVan(p.type, p.naam), vorm: p.soort || "product", pitch: p.pitch || "", eigenschap: p.trait || null, prijs: p.prijs || "standaard", vraagfactor: vraagFactor(s, p.aard || aardVan(p.type, p.naam)), kwaliteit: p.kwaliteit, populariteit: p.pop, abonnees: isAbo(p) ? Math.round((p.abo || 0) * 10000) : undefined, status: p.status, recensie: p.review ? p.review.sterren : null})), verwachte_aanslagen: (s.dreigingen || []).map(t => `${t.label} door ${t.van}`),
    crew: (s.crew || []).map(m => ({naam: m.naam, rol: m.rol, niveau: m.niveau, status: crewStatus(s, m), eigenschap: traitOf(m.trait).naam})), huurleger: s.huurleger, tijdperk: TIJDPERKEN[s.tijdperk || 0].naam, status: STATUS_LADDER[s.statusNiveau || 0][1],
    verhaallijn: s.verhaal || null,
    wereldnieuws: (s.nieuws || []).slice(0, 8).map(n => `${n.m} ${n.kop}`), open_keuzes: (s.keuzes || []).map(k => k.titel),
    recente_mails: G.mails.slice(0, 8).map(m => `${m.datum} ${m.van}: ${m.onderwerp}`), logboek: s.log.slice(-10),
  };
}
const PROPOSAL_SHAPE = `{"samenvatting": "wat er concreet gebeurt, 1 zin", "kost": 6, "bron": "operationeel", "kans": 60, "risico": "wat er mis kan gaan, 1 zin",
  "succes": {"effect": {"heat": 2}, "mail": {"van": "...", "onderwerp": "...", "tekst": "2-5 zinnen", "prio": "NORMAAL"}},
  "falen": {"effect": {"heat": 5}, "mail": {"van": "...", "onderwerp": "...", "tekst": "2-5 zinnen", "prio": "HOOG"}}}`;
const RULES = `Spelregels voor voorstellen:
- Bedragen in M€ (miljoen euro). Geld is krap. Richtprijzen in deze wereld: agent omkopen 1-5, privédetective 2-6, hacker 4-15, advocaat 3-10, mediacampagne 5-15, intimidatie 2-8, headhunter 1-4 per kandidaat. Niet alles kost geld: een gesprek, een telefoontje of een gunst is gratis. Zet de CEO iemand uit zijn crew in (zie "crew"), dan kost het hooguit 0-2M onkosten, want die mensen staan al op de loonlijst; hun niveau (1-6) maakt de kans groter.
- Noemt de CEO een budget, blijf daarbinnen of verlaag de kans. Kan het niet van de beschikbare cash (of zwart geld bij illegale zaken, "bron": "zwart"), zeg dat in je bericht en geef geen voorstel.
- "kans": geheel getal 5-95, of 100 als er niets mis kan gaan (een gewone aankoop, een loonsverhoging die je gewoon toekent). Grote stappen krijgen lage kansen. Geen gratis winst.
- Illegale acties geven heat, ook bij succes. Snelle winst kost morale, reputatie of geeft juridisch risico.
- Gebruik "verborgen_waarheid", vlaggen en geheimen om onderzoek eerlijk af te handelen: alleen als iets waar is kan een geslaagd onderzoek het vinden, en dat staat dan in de succes-mail. Een ontmaskerde verrader: zet de vlag in "verwijder_flags" (cfo_manipuleert, pr_lekt, security_verkocht).
- Mogelijke effectvelden (laat weg wat niet verandert): cash (-300..150), zwart, heat, reputation, morale (-25..25), factions {naam: -30..30}, loyaliteit {"NPC-naam": -40..40}, personeel (-50..50 gewone medewerkers), ontslag ["NPC-naam"], nieuwe_npc {"name","role","loyalty","ambition","secret"} (een sleutelpersoon aannemen), rivaal_agressie {naam: -0.3..0.3}, rivaal_cash {naam}, rivaal_geheugen {naam: "notitie"}, district "A".."H", verwijder_flags [...], lopend {"naam","maanden","cash","reputation","heat","morale"} (maandelijks terugkerend, bv. een loonsverhoging: cash -2 per maand).
- PRODUCTEN: de divisies verkopen producten (zie "producten"). Vraagt de CEO een nieuw product, een dienst, een abonnement of een productlijn, wijs dan eerst op Bedrijf → Productlijn → "De GM werkt het uit", waar jij het volledig ontwerpt. Wil hij het toch via jou, geef dan bij succes het effect "nieuw_product": {"divisie": "<naam van een bestaande divisie>", "naam": "productnaam", "schaal": "klein"|"groot"|"vlag", "aard": "wapen|medisch|implantaat|data|beveiliging|smokkel|logistiek|financieel|orbitaal|consument", "focus": "standaard|kwaliteit|snel|goedkoop|innovatief|veilig"}. De kost van je voorstel is dan de ontwikkelkost (klein 5, groot 14, vlaggenschip 30, maal de moeilijkheid). Is de divisie al iets aan het ontwikkelen, dan komt het in de wachtrij. De lancering (hit, flop) gooit de engine later zelf; beloof geen uitkomst.
- BLIJVENDE GROEI: bouwt de CEO iets op dat maand na maand geld oplevert (een product, dienst, abonnement, klantengroep, vestiging, contract, prijsmodel, marketing die klanten bindt), geef dan bij succes een blijvend effect, geen eenmalige cash: "omzet_bonus": {"naam": "korte naam van de inkomstenbron", "bedrag": M€ per maand}. Reken realistisch: ongeveer kost/10 per maand (terugverdientijd 8 tot 15 maanden), maximaal 6 per bron. Bouwt het verder op een bestaande bron, gebruik dezelfde naam. Groeit een divisie wezenlijk: "divisie_upgrade": "divisienaam". Een echt nieuwe bedrijfstak: "nieuwe_divisie": {"name", "type"} (type uit de bestaande of eigen soorten). Falen kan een bron kosten: "omzet_verlies": {"naam", "bedrag"}.
- Bestaande inkomstenbronnen van de CEO staan in "inkomstenbronnen"; houd daar rekening mee.
- De kost (vooraf betaald) staat los van de effecten; zet die niet nog eens in cash.`;
function personaFor(s, c){
  if (c.soort === "gm") return `Je bent "de Assistent": de rechterhand van de CEO, die alles regelt wat de knoppen niet doen (onderzoek, deals, omkoping, inkoop, aannemen van sleutelmensen, sabotage). Zakelijk, droog, eerlijk over prijs en risico. Bij elk concreet verzoek doe je een voorstel. Je kent de verborgen waarheid om kansen eerlijk te bepalen, maar je verklapt die NOOIT in je bericht. Bij een vraag beantwoord je alleen wat de CEO ook had kunnen weten.`;
  if (c.soort === "npc"){
    const n = s.npcs.find(x => x.name === c.naam) || {};
    return `Je bent ${n.name}, ${n.role} van ${s.player.corp_name}. Loyaliteit ${Math.round(n.loyalty)}/100, ambitie ${n.ambition}/100. Je geheim: ${n.secret}${n.verraad ? ` Je bent sinds ${n.verraad} heimelijk ontrouw aan het bedrijf; dat ontken je, tenzij je met bewijs wordt klemgezet.` : ""} Gedraag je naar je loyaliteit: laag = kortaf, eisend, zinspeelt op vertrek; hoog = meedenkend en eerlijk. Verklap je geheim niet zomaar. Je kunt zelf iets vragen (opslag, budget, een titel) en de CEO kan je dingen opdragen die binnen jouw rol vallen.`;
  }
  if (c.soort === "rivaal"){
    const r = s.rivals.find(x => x.name === c.ref) || {memory: []};
    return `Je bent ${r.ceo}, CEO van ${r.name} (sector ${r.sector}, kas ongeveer €${Math.round(r.cash)}M, agressie ${r.aggression}). Een concurrent: beleefd, berekenend, nooit gratis. Wat je over deze CEO onthoudt: ${r.memory.slice(-4).join("; ") || "weinig"}. Je kunt deals voorstellen (joint venture, overname van een divisie, een prijsafspraak, een wapenstilstand) met een echte prijs.`;
  }
  if (c.soort === "gang"){ const g = (s.gangs || []).find(x => x.id === c.ref) || {gebied: {}};
    return `Je bent ${g.leider}, leider van ${g.naam} (${g.soort}). ${g.stijl} Jullie relatie met dit bedrijf: ${g.relatie} (-100..100), afspraak: ${g.deal || "geen"}. Waar jullie zitten (aanwezigheid 0-100): ${JSON.stringify(g.gebied)}. Gevaarlijk, zakelijk en beleefd. Je doet deals (bescherming, smokkel, een klus, informatie) met een echte prijs, en je dreigt niet zonder het te menen.`; }
  return `Je bent ${c.naam}, ${c.rol}. ${c.bio || ""}${c.fac ? ` De houding van jouw groep tegenover dit bedrijf: ${Math.round(faction(s, c.fac))} (schaal -100..100).` : ""}${MENS[c.key] ? ` Jouw persoonlijke relatie met de CEO: ${relV(s, c.key)} (-100..100).` : ""}`;
}
function talkPrompt(s, c, convo, kind){
  const fmt = kind === "mail"
    ? `{"onderwerp": "...", "tekst": "je antwoordmail, 2-8 zinnen", "voorstel": null, "stemming": 0}`
    : `{"bericht": "je antwoord, 1-4 zinnen", "voorstel": null, "stemming": 0}`;
  return `Je speelt een personage in CHROME LEDGER, een cyberpunk-bedrijfssimulatie ${s.map && s.map.kind === "wereld" ? "een wereld van rivaliserende megacorporaties, natiestaten die te koop zijn en oceanen vol vrachtroutes" : "de stad " + (s.city || "Meridian Bay")} (rond ${s.date.year}). Taal: Nederlands. Toon: droog, cynisch, corporate-noir. Spreek de CEO aan met "u" tenzij je personage anders zou doen.

${personaFor(s, c)}

Blijf in je rol en speel eerlijk: geen gratis winst, geen gunsten zonder prijs, red de CEO niet en straf niet zonder reden.
Vraagt de CEO om iets dat het spel moet veranderen (geld, mensen aannemen of ontslaan, een deal, omkopen, onderzoek, sabotage, een gunst, loonsverhoging), dan zet je in "voorstel" wat er precies gebeurt, wat het kost en hoe groot de kans is. De CEO zegt daarna ja of nee, en pas dan gooit de engine 2d6 tegen jouw kans (kansen worden afgerond op wat met 2d6 kan: 8, 17, 28, 42, 58, 72, 83, 92%). Jij gooit niet en je vertelt de uitkomst niet. Bij alleen praten of vragen: "voorstel": null. Doe alleen voorstellen binnen de macht van jouw personage.
${RULES}

Stand van de wereld (alleen voor jou, de CEO ziet dit niet):
${JSON.stringify(worldFacts(s))}

${kind === "mail" ? "De mailwisseling:" : "Het gesprek tot nu toe (CEO = de speler):"}
${convo}

Antwoord met alleen JSON in deze vorm:
${fmt}
"voorstel" is null of: ${PROPOSAL_SHAPE}
"stemming": hoe dit gesprek jouw houding tegenover de CEO verandert, geheel getal -3..3.`;
}
function cleanProposal(p){
  if (!p || typeof p !== "object" || !p.samenvatting) return null;
  const txt = (v, n) => String(v ?? "").slice(0, n);
  const mailOf = m => m && m.tekst ? {van: txt(m.van || "CFO", 60), onderwerp: txt(m.onderwerp || "Afgehandeld", 90), tekst: txt(m.tekst, 1500), prio: ["LAAG", "NORMAAL", "HOOG", "KRITIEK"].includes(m.prio) ? m.prio : "NORMAAL"} : null;
  return {samenvatting: txt(p.samenvatting, 240), risico: txt(p.risico, 240),
    kost: r1(clamp(+p.kost || 0, 0, 500)), bron: p.bron === "zwart" ? "zwart" : "operationeel",
    kans: +p.kans >= 100 ? 100 : snapKans(Math.round(clamp(+p.kans || 50, 5, 95))),
    succes: {effect: (p.succes && p.succes.effect) || {}, mail: mailOf(p.succes && p.succes.mail)},
    falen: {effect: (p.falen && p.falen.effect) || {}, mail: mailOf(p.falen && p.falen.mail)}};
}
function moodShift(s, c, v){
  v = Math.round(clamp(+v || 0, -3, 3)); if (!v) return false;
  const ch = chatOf(c), m = ym(s);
  if (!ch.stemming || ch.stemming.maand !== m) ch.stemming = {maand: m, som: 0};
  v = v > 0 ? Math.min(v, 6 - ch.stemming.som) : Math.max(v, -6 - ch.stemming.som); if (!v) return false;
  ch.stemming.som += v;
  if (c.soort === "npc"){ const n = s.npcs.find(x => x.name === c.naam); if (n){ n.loyalty = clamp(n.loyalty + v); return true; } }
  if (c.soort === "rivaal"){ const r = s.rivals.find(x => x.name === c.ref); if (r){ r.aggression = r1(clamp(r.aggression - v * 0.02, 0, 1) * 100) / 100; return true; } }
  if (c.soort === "gang"){ const g = (s.gangs || []).find(x => x.id === c.ref); if (g){ g.relatie = Math.round(clamp(g.relatie + v * 2, -100, 100)); return true; } }
  if (MENS[c.key]){ relShiftP(s, c.key, v * 2); if (c.fac) shiftFaction(s, c.fac, v); return true; }
  if (c.fac){ shiftFaction(s, c.fac, v); return true; }
  return false;
}
function sampleErrorText(e){
  const c = e && e.code;
  if (c === "not_granted" || c === "sampling_disabled" || c === "not_declared"){ G.sampleOff = true; return "Geen toestemming om Claude te gebruiken in dit venster. Herlaad de pagina om het opnieuw te vragen, of laat Claude dit in de chat beantwoorden."; }
  if (c === "rate_limited") return "Even te veel tegelijk. Probeer het over een minuut opnieuw.";
  if (c === "cancelled") return "Afgebroken.";
  return "Geen bruikbaar antwoord ontvangen. Probeer het opnieuw of zeg het iets concreter.";
}
const live = () => !!(G.sample && !G.sampleOff);

/* ---------- een voorstel uitvoeren: de engine gooit ---------- */
async function executeProposal(p){
  const s = G.game;
  if (p.bron === "zwart"){ if (s.accounts.zwart < p.kost) return {ok: false, bericht: `Niet genoeg zwart geld (€${p.kost}M nodig).`}; s.accounts.zwart = r1(s.accounts.zwart - p.kost); }
  else { if (s.cash < p.kost) return {ok: false, bericht: `Niet genoeg cash (€${p.kost}M nodig).`}; s.cash = r1(s.cash - p.kost); }
  let roll = null, ok = true;
  if (p.kans < 100){ const rr = rolKans(p.kans); roll = rr.txt; ok = rr.ok; addRoll(s, `${rr.txt} → ${ok ? "GELUKT" : "MISLUKT"} · ${p.samenvatting}`); }
  const br = ok ? p.succes : p.falen; applyGmEffect(s, br.effect);
  const ctx = Ctx(); if (br.mail) mail(ctx, s, br.mail.van, br.mail.onderwerp, br.mail.tekst, br.mail.prio);
  addLog(s, `${ok ? "Gelukt" : "Mislukt"}: ${p.samenvatting}${p.kost ? ` (€${p.kost}M)` : ""}`);
  S.expect = true; const docs = await persist(ctx); S.expect = false;
  return {ok: true, gelukt: ok, roll, tekst: `${ok ? "Gelukt" : "Mislukt"}${roll != null ? ` (worp ${roll})` : ""}. ${p.samenvatting}`, mail: docs[0] && docs[0].id};
}

/* ---------- chat ---------- */
const YES = /^\s*(ja|jep|jawel|yes|ok[eé]?|akkoord|doe maar|doen|deal|prima|goed zo)\b/i, NO = /^\s*(nee|neen|no|niet doen|laat maar|stop|liever niet)\b/i;
function openProposal(ch){ for (let i = ch.berichten.length - 1; i >= 0; i--){ const b = ch.berichten[i]; if (b.voorstel && b.vstatus === "open") return b; if (b.van === "ik") return null; } return null; }
const GM_SNEL = {watnu: "Wat moet ik nu doen? Geef de drie belangrijkste dingen, met wat het kost en waarom.", maand: "Vat mijn laatste maand samen: wat ging goed, wat ging fout, waar moet ik op letten?", stand: "Hoe sta ik ervoor tegenover mijn rivalen en de doelen?"};
function lokaalAntwoord(s, soort){
  if (soort === "watnu"){ const A = adviezen(s).slice(0, 3); return A.length ? "Uit de cijfers (de GM is niet live): " + A.map((a, i) => `${i + 1}. ${a.tekst}`).join(" ") : "Uit de cijfers: niets dringends. Bouw door waar je sterk staat."; }
  if (soort === "maand"){ const r = s.laatste_rapport; if (!r || !r.maand) return "Er is nog geen maand gespeeld. Klik +1 maand (toets N) of laat de tijd lopen met ▶."; const g = (r.gebeurd || []).slice(0, 6);
    return `Uit het rapport van ${r.maand} (de GM is niet live): omzet €${r.omzet}M, kosten €${r.kosten}M, netto ${r.netto >= 0 ? "+" : "−"}€${Math.abs(r.netto)}M. ${g.length ? "Gebeurd: " + g.join("; ") + "." : "Verder rustig."} Heat ${Math.round(s.heat)}, morale ${Math.round(s.morale)}, cash €${Math.round(s.cash)}M.`; }
  const D = doelen(s).filter(d => d.id !== "termijn").sort((a, b) => b.pct - a.pct)[0]; let plek = ""; try { plek = `Je staat ${wereldVM(s).plek}e op de ranglijst. `; } catch(e){ foutLog("stand voor de GM", e); }
  const r0 = s.rivals.slice().sort((a, b) => rivalPower(s, b) - rivalPower(s, a))[0];
  return `Uit de cijfers (de GM is niet live): ${plek}Dichtst bij winst: ${D.naam} (${D.pct}%, ${D.nu}).${r0 ? ` Sterkste rivaal: ${r0.name} (${r0.status === "oorlog" ? "in oorlog met je" : "relatie " + Math.round(r0.relatie || 0)}).` : ""} Bedrijfswaarde €${Math.round(playerValue(s))}M.`;
}
async function gmSnel(soort){
  const s = G.game; if (!s || !GM_SNEL[soort]) return; if (live()) return chatSend("gm", GM_SNEL[soort]);
  const c = contacts(s).find(x => x.key === "gm"), ch = chatOf(c), t = Date.now();
  ch.berichten.push({id: "b" + uid(), van: "ik", tekst: GM_SNEL[soort], t, maand: ym(s)}, {id: "b" + uid(), van: "zij", tekst: lokaalAntwoord(s, soort), t: t + 1, status: "ok", maand: ym(s), systeem: true});
  await Store.putChat(ch); render();
}
async function inboxOpruimen(s){
  const open = new Set((s.keuzes || []).map(k => k.id)), nu = ym(s);
  const rap = G.mails.filter(m => !m.uit && !m.archief && /^Maandrapport /.test(m.onderwerp)).sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(3);
  const kz = G.mails.filter(m => !m.uit && !m.archief && m.keuze && !open.has(m.keuze) && String(m.datum) < nu);
  const mnd = d => { const [y, mo] = String(d || "0-0").split("-").map(Number); return y * 12 + mo; }, oud = G.mails.filter(m => !m.uit && !m.archief && !(m.keuze && open.has(m.keuze)) && !/^Maandrapport /.test(m.onderwerp) && mnd(nu) - mnd(m.datum) > 6);
  for (const m of [...rap, ...kz, ...oud].slice(0, 25)) await Store.patchMail(m.id, {archief: true, gelezen: true});
}
async function chatSend(key, text){
  const s = G.game, c = contacts(s).find(x => x.key === key); text = String(text || "").trim();
  if (!c || !text) return;
  const ch = chatOf(c), open = openProposal(ch);
  if (open && YES.test(text)) return decideChat(key, open.id, true, text);
  if (open && NO.test(text)) return decideChat(key, open.id, false, text);
  if (open) open.vstatus = "vervallen";
  ch.berichten.push({id: "b" + uid(), van: "ik", tekst: text.slice(0, 2000), t: Date.now(), maand: ym(s)});
  const reply = {id: "b" + uid(), van: "zij", tekst: "", t: Date.now() + 1, status: live() ? "denkt" : "wacht", maand: ym(s)};
  ch.berichten.push(reply);
  await Store.putChat(ch); render();
  if (!live()) return;
  try {
    const convo = ch.berichten.filter(b => b !== reply).slice(-16).map(b => `${b.van === "ik" ? "CEO" : c.naam}: ${b.tekst}${b.voorstel ? ` [voorstel: ${b.voorstel.samenvatting}; ${b.vstatus}]` : ""}${b.uitkomst ? ` [uitkomst: ${b.uitkomst}]` : ""}`).join("\n");
    const res = await G.sample.json(talkPrompt(s, c, convo, "chat"), {modelTier: c.soort === "gm" ? "default" : "quick", cache: false});
    reply.tekst = String((res && (res.bericht || res.tekst)) || "…").slice(0, 2000); reply.status = "ok";
    const p = cleanProposal(res && res.voorstel); if (p){ reply.voorstel = p; reply.vstatus = "open"; }
    if (moodShift(s, c, res && res.stemming)) await Store.saveGame();
  } catch(e){ reply.status = "fout"; reply.tekst = sampleErrorText(e); }
  await Store.putChat(ch); render();
  if (S.sound) blip(990, .05);
}
async function decideChat(key, msgId, yes, typed){
  const s = G.game, c = contacts(s).find(x => x.key === key); if (!c) return;
  const ch = chatOf(c), b = ch.berichten.find(x => x.id === msgId);
  if (!b || b.vstatus !== "open") return toast("Dit voorstel staat niet meer open.", true);
  ch.berichten.push({id: "b" + uid(), van: "ik", tekst: typed || (yes ? "Ja, doen." : "Nee."), t: Date.now(), maand: ym(s)});
  if (!yes){ b.vstatus = "afgewezen"; await Store.putChat(ch); render(); return; }
  const r = await executeProposal(b.voorstel);
  if (!r.ok){ ch.berichten.push({id: "b" + uid(), van: "zij", tekst: r.bericht, t: Date.now() + 1, status: "ok", systeem: true}); await Store.putChat(ch); render(); return; }
  b.vstatus = "uitgevoerd"; b.uitkomst = r.gelukt ? "gelukt" : "mislukt";
  ch.berichten.push({id: "b" + uid(), van: "zij", tekst: r.tekst + (r.mail ? " Details staan in je inbox." : ""), t: Date.now() + 1, status: "ok", systeem: true, worp: r.roll, gelukt: r.gelukt, mail: r.mail});
  await Store.putChat(ch); render();
  if (S.sound) sweep();
}

/* ---------- mail schrijven, iemand antwoordt ---------- */
async function sendMail(aan, onderwerp, tekst, reOf){
  const s = G.game; aan = String(aan || "").trim().slice(0, 80); onderwerp = String(onderwerp || "").trim().slice(0, 90) || "(geen onderwerp)"; tekst = String(tekst || "").trim().slice(0, 3000);
  if (!aan || !tekst) return {ok: false, bericht: "Vul in aan wie en wat je wilt zeggen."};
  const c = findContact(s, aan) || {key: "x-" + slug(aan), naam: aan, rol: "", soort: "extra", bio: "Iemand in deze wereld. Kies een geloofwaardige rol die past bij de naam en de mail."};
  const [sent] = await Store.addMails([{datum: ym(s), van: s.player.corp_name + " (CEO)", aan: c.naam, onderwerp, prio: "NORMAAL", body: tekst, uit: true, gelezen: true}]);
  if (!live()){ await Store.patchMail(sent.id, {wacht: true}); return {ok: true, bericht: "Verzonden. Zonder live verbinding komt het antwoord pas als je Claude in de chat vraagt om mails te beantwoorden."}; }
  (async () => {
    await Store.patchMail(sent.id, {wacht: true}); render();
    try {
      const orig = reOf ? G.mails.find(m => m.id === reOf) : null;
      const convo = (orig ? `Eerdere mail van "${orig.van}" aan de CEO, onderwerp "${orig.onderwerp}":\n${String(orig.body || "").slice(0, 1500)}\n\n` : "") + `Mail van de CEO aan ${c.naam}:\nOnderwerp: ${onderwerp}\n${tekst}`;
      const res = await G.sample.json(talkPrompt(s, c, convo, "mail"), {modelTier: "default", cache: false});
      const p = cleanProposal(res && res.voorstel);
      const ctx = Ctx(); mail(ctx, s, c.naam + (c.rol ? ` (${c.rol})` : ""), String((res && res.onderwerp) || "Re: " + onderwerp).slice(0, 90), String((res && res.tekst) || "…").slice(0, 3000), p ? "HOOG" : "NORMAAL");
      if (p){ ctx.mails[0].voorstel = p; ctx.mails[0].vstatus = "open"; }
      ctx.mails[0].contact = c.key;
      const moved = moodShift(s, c, res && res.stemming);
      S.expect = true; await Store.addMails(ctx.mails); S.expect = false;
      if (moved){ await Store.saveGame(); if (G.chats[c.key]) await Store.putChat(G.chats[c.key]); }
      await Store.patchMail(sent.id, {wacht: false});
      toast(`Antwoord van ${c.naam}.`); if (S.sound) blip(990, .05);
    } catch(e){ toast(sampleErrorText(e), true); }
    render();
  })();
  return {ok: true, bericht: `Mail verstuurd aan ${c.naam}. Het antwoord komt zo binnen.`};
}
async function decideMail(id, yes){
  const m = G.mails.find(x => x.id === id); if (!m || m.vstatus !== "open") return {ok: false, bericht: "Dit voorstel staat niet meer open."};
  if (!yes){ await Store.patchMail(id, {vstatus: "afgewezen"}); return {ok: true, bericht: "Afgewezen."}; }
  const r = await executeProposal(m.voorstel); if (!r.ok) return r;
  await Store.patchMail(id, {vstatus: "uitgevoerd", uitkomst: r.gelukt ? "gelukt" : "mislukt", worp: r.roll});
  if (S.sound) sweep();
  return {ok: true, bericht: r.tekst};
}

/* ---------- eigen soort laten balanceren door de GM ---------- */
async function gmBalanceType(naam, omschrijving, profiel){
  const base = PRESETS[profiel] || PRESETS.gebalanceerd;
  if (!live()) return {stats: base, uitleg: `Profiel ${base.label.toLowerCase()} gebruikt.`};
  const prompt = `Je bent de Game Master van CHROME LEDGER, een cyberpunk-bedrijfssimulatie (Nederlands). De speler wil een eigen soort bedrijf: "${naam}". Omschrijving van de speler: "${omschrijving}". Gekozen profiel: ${base.label} (${base.uitleg}).
Bepaal eerlijke cijfers per niveau per maand, in M€: "rev" omzet (5-14), "cost" kosten (3-8, rev mag hoogstens cost+7 zijn), "heat" (0-4: legaal 0-1, grijs 2, illegaal 3-4), "vol" schommeling (0.1-0.5). Ter vergelijking: Logistiek 7/4/0/0.15, Biotech 9/6/1/0.35, Cyberware 11/7/2/0.4, Smokkel 14/4/4/0.5. Wees streng: wat veel oplevert is riskant of trekt aandacht.
Antwoord met alleen JSON: {"rev": 9, "cost": 5, "heat": 1, "vol": 0.3, "uitleg": "1-2 zinnen in de stem van de CFO, waarom deze cijfers"}`;
  try { const r = await G.sample.json(prompt, {modelTier: "quick"}); return {stats: {rev: r.rev, cost: r.cost, heat: r.heat, vol: r.vol}, uitleg: String(r.uitleg || "").slice(0, 300)}; }
  catch(e){ return {stats: base, uitleg: sampleErrorText(e) + ` Profiel ${base.label.toLowerCase()} gebruikt.`}; }
}

/* ---------- wat het scherm toont ---------- */
function vm(){
  const s = G.game;
  if (!s) return {geen_spel: true, setup_done: false, divisie_types: SECTORS};
  migrate(s);
  const lr = s.laatste_rapport || {}, manip = !!s.flags.cfo_manipuleert;
  const hq = {}; for (const r of s.rivals) (hq[r.hq] ??= []).push(r.name);
  const pd = new Set(s.projects.map(p => p.district).filter(Boolean)), pu = new Set(s.projects.map(p => p.division).filter(Boolean));
  const cons = contacts(s);
  return {
    setup_done: !!s.setup_done, status: s.status, speler: s.player, datum: s.date, maand: ym(s),
    cash: r1(s.cash + (manip ? lr.cash_offset || 0 : 0)), schuld: s.debt, rente: s.interest_rate,
    heat: r1(clamp(s.heat + (manip ? lr.heat_offset || 0 : 0))), reputatie: r1(s.reputation), morale: r1(s.morale),
    spanningThuis: (() => { const c = exportThuis(s), v = Math.round(spanningVan(s, c)); return c ? {cont: c, v, fase: spanningFase(v)[1], kleur: v >= 90 ? "var(--mag)" : v >= 70 ? "var(--red)" : v >= 50 ? "var(--amber)" : v >= 30 ? "var(--cyan)" : "var(--green)"} : null; })(),
    zwart: s.accounts.zwart, offshore: s.accounts.offshore, personeel: s.staff, cultuur: s.culture,
    nodig: staffNeed(s), salaris: Object.keys(SALARY).find(k => SALARY[k] === s.staff.avg_salary) || "eigen",
    divisies: s.divisions.map(d => ({plan: upgradePlan(s, d), naam: d.name || d.type, type: d.type, level: d.level, eigen: !DT[d.type], aandeel: Math.round(((s.market[d.type] || {}).player || 0) * 100), slijt: Math.round((d.slijt ?? 1) * 100), vernieuwt: divVernieuwt(s, d), upgrade_kost: upgradeCost(s, d), bezig: pu.has(d.name || d.type)})),
    soorten: allTypes(s).map(n => ({naam: n, ...typeOf(s, n), eigen: !DT[n]})),
    projecten: s.projects,
    districten: s.districts.map(d => ({id: d.id, naam: d.name, controle: d.control, inkomen: d.income, onderhoud: d.upkeep, lore: d.lore || "", hq: hq[d.id] || [], thuis: s.player.home_district === d.id, kost: districtCost(s, d), bezig: pd.has(d.id),
      buren: d.neighbors || [], zee: d.zee || [], bereik: reachable(s, "player", d), continent: d.continent || "", opbrengst: districtYield(s, d)})),
    kaart: mapView(s), vloot: {schepen: s.schepen || 0, vrij: shipsFree(s), max: SHIP_MAX, kost: shipCost(s), inzet: s.inzet || {}}, stad: s.city,
    rivalen: s.rivals.map(r => ({naam: r.name, ceo: r.ceo, sector: r.sector, hq: r.hq, key: "riv-" + slug(r.name), sectoren: Object.entries(r.divs || {}).map(([k, v]) => ({k, lv: v, reden: (r.divReden || {})[k] || (k === r.sector ? "kernsector" : "")})), /* 8.6 */ agressie: r.aggression < 0.35 ? "laag" : r.aggression < 0.6 ? "gemiddeld" : "hoog",
      karakter: r.karakter ? RIVAAL_KARAKTER[r.karakter] : null,
      kas_schatting: Math.round(r.cash * (0.7 + 0.6 * seeded(r.name + ym(s))()) / 10) * 10, aandeel: Math.round(((s.market[r.sector] || {rivals: {}}).rivals[r.name] || 0) * 100), geheugen: r.memory.slice(-3), producten: (r.producten || []).map(p => ({naam: p.naam, aard: p.aard, label: (PRODUCT_AARD[p.aard] || {}).label, kwaliteit: p.kwaliteit, pop: p.pop})),
      status: r.status, relatie: r.relatie, macht: rivalPower(s, r), verdragen: r.verdragen, moe: r.moeheid > 55 ? "hoog" : r.moeheid > 25 ? "merkbaar" : "laag",
      vredeKans: peaceChance(s, r, 0), handelKans: tradeChance(s, r), handelBedrag: tradeAmount(s, r),
      districten: rivalDistricts(s, r).map(d => ({id: d.id, naam: d.kort || d.name, hq: d.id === r.hq, vraag: askPrice(s, r, d), bereik: reachable(s, "player", d)})),
      biedt: playerDistricts(s).filter(d => d.id !== s.player.home_district).map(d => ({id: d.id, naam: d.name, bod: bidPrice(s, r, d), kan: r.cash >= bidPrice(s, r, d)})),
      acties: Object.entries(WAR).map(([key, w]) => ({key, label: w.label, uitleg: w.uitleg, kost: r1(w.kost * (DIFF[s.player.difficulty] || 1) * (relV(s, "fixer") >= 50 ? 0.8 : 1)), kans: warChance(s, r, w.mod)}))})),
    macht: {speler: playerPower(s), defensie: s.defensie || 0, defkost: r1(15 * ((s.defensie || 0) + 1) * (DIFF[s.player.difficulty] || 1)), oorlogen: atWar(s).length},
    aanbiedingen: s.aanbiedingen.map(o => ({...o, districtNaam: o.district ? (s.districts.find(d => d.id === o.district) || {}).name : ""})),
    npcs: s.npcs.map(n => ({naam: n.name, rol: n.role, indruk: impression(n), key: "npc-" + slug(n.name)})),
    facties: Object.entries(s.factions).map(([k, v]) => ({naam: k, label: labelFaction(v.standing), waarde: Math.round(v.standing), noot: v.note})),
    facturen: s.invoices, auto_pay: s.auto_pay, lopend: s.lopende_effecten.map(e => e.naam),
    besluiten: pendingDecisions(s),
    mails: G.mails.map(m => ({id: m.id, van: m.van, aan: m.aan, uit: !!m.uit, onderwerp: m.onderwerp, datum: m.datum, prio: m.prio, gelezen: !!m.gelezen, archief: !!m.archief,
      voorstel: m.vstatus === "open", wacht: !!m.wacht, keuze: m.keuze && (s.keuzes || []).some(k => k.id === m.keuze), preview: String(m.body || "").replace(/[#*|`_-]+/g, " ").slice(0, 120).trim()})),
    contacten: cons.map(c => { const ch = G.chats[c.key], last = ch && ch.berichten[ch.berichten.length - 1];
      return {...c, laatste: last ? (last.van === "ik" ? "U: " : "") + (last.tekst || (last.status === "denkt" ? "typt…" : "")) : "", open: !!(ch && openProposal(ch)), bezig: !!(last && (last.status === "denkt" || last.status === "wacht")), t: last ? last.t : 0}; }),
    rapport: lr.maand ? {...lr, mail: (G.mails.find(m => m.onderwerp === "Maandrapport " + lr.maand) || {}).id} : null,
    geschiedenis: s.history || [],
    streams: s.streams || [], invloed: s.invloed || 0, dominantie: dominanceIncome(s, "player"), zeeSterkte: Object.fromEntries(seaControl(s).map(z => [z.id, z.sterkte.player || 0])), regios: regionDominance(s), vergunning: !!s.flags.vergunning,
    invloedActies: INFLUENCE, factieNamen: Object.keys(s.factions), rivaalNamen: s.rivals.map(r => r.name),
    leenruimte: loanCap(s), nieuwe_divisie_kost: newDivCost(s), divisie_types: allTypes(s), contract: s.flags.nomad_contract,
    dochters: (s.bedrijven || []).filter(b => b.eigenaar === "player" && b.koppeling === "dochter").map(b => ({id: b.id, naam: b.naam, sector: b.sector, land: landNaam(s, b.land), waarde: Math.round(b.waarde), bedrag: ((s.streams || []).find(x => x.naam === "Dochter " + b.naam) || {}).bedrag || 0, verkoop: r1(b.waarde * 0.9), samen: s.divisions.some(d => d.type === b.sector) ? `samenvoegen met ${divNaam(s.divisions.find(d => d.type === b.sector))}` : `eigen divisie (${b.sector})`})),
    focus: (s.focus || []).map(k => ({naam: FOCUS[k].naam, tekst: FOCUS[k].tekst})), volgendeFocus: (() => { const mg = maandenGespeeld(s); return mg < 12 ? 12 - mg : (12 - (mg % 12)) % 12 || 12; })(),
    plannen: (s.plannen || []).filter(p => p.ontdekt).map(p => ({titel: p.titel, wie: p.wie, stap: p.stap, van: p.stappen.length, stappen: p.stappen, wanneer: p.volgende, zacht: !!p.zacht, eind: PLAN_SOORT[p.soort].eindTekst, motief: p.motief || ""})),
    heatPrognose: heatPrognose(s), offensief: {kost: offensiefKost(s), klaar: !s.flags.offensief || mndNr(ym(s)) - mndNr(s.flags.offensief) >= 4},
    zaad: s.zaad || null, huisstijl: s.huisstijl || null, autoStandaard: s.autoStandaard || {}, adviezen: adviezen(s), doelen: doelen(s), scoreNu: score(s), lengte: spelLengte(s), gezondheid: s.gezondheid || null, eind: s.eind || null,
    crewv: crewVM(s), tijd: tijdVM(s), productlijn: productVM(s), projectRisico: projectRisico(s),
    verdedigingInfo: {waarde: verdediging(s, null), macht: playerPower(s), intel: (s.crew || []).some(m => ["speurder", "fixer"].includes(m.rol)), open: (s.dreigingen || []).map(t => ({label: t.label, van: t.van, maand: t.maand}))},
    keuzes: s.keuzes || [], keuzesKlaar: s.keuzes_klaar || [], wereld: wereldVM(s), mensen: mensenVM(s), onderwereld: gangVM(s), startbonus: startBonus(s), hq_stad: s.player.hq_stad || "",
    log: s.log.slice().reverse().map(l => "- " + l).join("\n"), worpen: s.worpen,
  };
}

/* ---------- acties zoals het scherm ze aanroept ---------- */
const API = {
  async "/api/tick"(d){
    const s = G.game; if (!s || s.status !== "actief") return {ok: false, bericht: "Het spel is voorbij."};
    const openChats = Object.values(G.chats).filter(c => openProposal(c) || c.berichten.some(b => b.status === "denkt")).length;
    const openMails = G.mails.filter(m => m.vstatus === "open").length;
    if ((openChats || openMails) && !d.force) return {ok: false, vraag: true, bericht: `Er staan nog ${openChats + openMails} voorstel(len) of gesprekken open. Als je doorgaat, vervallen open voorstellen niet, maar de wereld wacht ook niet.`};
    try { await Store.backup(); } catch(e){ foutLog("back-up voor de maand", e); }
    S.expect = true; const ctx = tick(s); const docs = await persist(ctx); S.expect = false;
    Store.slots().then(L => Store.saveSlots(L)).catch(() => {});
    inboxOpruimen(s).catch(e => foutLog("inbox opruimen", e)); verhaalBeurt(s).catch(() => {}); planGM(s).catch(e => foutLog("plan door de GM", e));
    if (s.status !== "actief" && s.eind) await Store.addScore({id: G.gid + "-" + s.eind.datum, naam: s.player.corp_name, status: s.status, score: s.eind.score, datum: s.eind.datum, moeilijkheid: s.player.difficulty});
    return {ok: true, status: s.status, rapport_mail: docs[ctx.reportIndex] && docs[ctx.reportIndex].id};
  },
  async "/api/factuur"(d){
    const s = G.game;
    if (d.alles !== undefined){ s.auto_pay = !!d.alles; await persist(); return {ok: true, bericht: "Automatisch betalen " + (s.auto_pay ? "aan." : "uit.")}; }
    const r = actInvoice(s, d.id, d.actie); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg};
  },
  async "/api/besluit"(d){ const r = actDecision(G.game, d.arc, d.keuze, d.budget); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/project"(d){ const r = actProject(G.game, d.soort, d); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/personeel"(d){ const r = actStaff(G.game, d.soort, d.aantal); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/soort"(d){
    const {stats, uitleg} = d.gm ? await gmBalanceType(d.naam, d.omschrijving, d.profiel) : {stats: PRESETS[d.profiel] || PRESETS.gebalanceerd, uitleg: ""};
    const r = addCustomType(G.game, d.naam, stats, d.omschrijving); if (r.ok){ await persist(); S.newType = r.naam; }
    const ty = r.ok ? typeOf(G.game, r.naam) : null;
    return {ok: r.ok, bericht: r.ok ? `${r.msg} Omzet ${ty.rev}, kosten ${ty.cost}, heat ${ty.heat} per niveau.${uitleg ? " " + uitleg : ""}` : r.msg};
  },
  async "/api/rivaal"(d){ const s = G.game, ctx = Ctx(); const r = WAR[d.soort] ? actWar(s, ctx, d.naam, d.soort, d.district) : actDiplo(s, ctx, d.naam, d.soort, d); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/invloed"(d){ const r = actInfluence(G.game, d.soort, d.doel); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/vloot"(d){ const r = d.zone ? actDeploy(G.game, d.zone, d.delta) : actShip(G.game); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/beveiliging"(){ const r = actDefense(G.game); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/divisieconcept"(){ const s = G.game, ctx = Ctx(); const r = actDivisieConcept(s, ctx, G.divConcept); if (r.ok){ G.divConcept = null; await persist(ctx); } return {ok: r.ok, bericht: r.msg}; },
  async "/api/concept"(d){ const s = G.game, ctx = Ctx(); const r = actConcept(s, ctx, (G.concepten || {})[d.divisie]); if (r.ok){ delete G.concepten[d.divisie]; await persist(ctx); } return {ok: r.ok, bericht: r.msg}; },
  async "/api/dochter"(d){ const s = G.game, ctx = Ctx(); const r = actDochter(s, d.id, d.actie); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/autodev"(d){ const s = G.game, dv = s.divisions.find(x => divNaam(x) === d.divisie); if (!dv) return {ok: false, bericht: "Onbekende divisie."};
    const A = (dv.autoDev ??= {aan: false, schaal: "klein"}); if (d.aan != null) A.aan = !!d.aan; if (PRODUCT_SCHAAL[d.schaal]) A.schaal = d.schaal; if (d.aard && PRODUCT_AARD[d.aard]) A.aard = d.aard; await persist(Ctx());
    return {ok: true, bericht: `${divNaam(dv)}: automatisch ontwikkelen ${A.aan ? `aan (${PRODUCT_SCHAAL[A.schaal].label.toLowerCase()})` : "uit"}.`}; },
  async "/api/autostandaard"(d){ const s = G.game; if (!AUTO[d.k]) return {ok: false, bericht: "Onbekend."}; (s.autoStandaard ??= {})[d.k] = !!d.aan; if (d.alle) for (const p of s.producten || []) (p.auto ??= {})[d.k] = !!d.aan; await persist(Ctx()); return {ok: true, bericht: `${AUTO[d.k].split(" (")[0]}: ${d.aan ? "aan" : "uit"}${d.alle ? " voor alle producten" : " voor nieuwe producten"}.`}; },
  async "/api/aanwezig"(d){ const s = G.game, ctx = Ctx(); const r = actAanwezig(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/taak"(d){ const s = G.game, ctx = Ctx(); const r = d.rol ? actAannemen(s, ctx, d.rol) : actTaak(s, ctx, d.k, !!d.aan); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/pitch"(d){ const s = G.game, ctx = Ctx(); const r = actPitch(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/editie"(d){ const s = G.game, ctx = Ctx(); const r = actEditie(s, ctx, d.id, (G.edities || {})[d.id]); if (r.ok){ delete G.edities[d.id]; await persist(ctx); } return {ok: r.ok, bericht: r.msg}; },
  async "/api/offensief"(){ const s = G.game, ctx = Ctx(); const r = actOffensief(s, ctx); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/onderhandel"(d){ const s = G.game, ctx = Ctx(); const r = actOnderhandel(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/lobby"(d){ const s = G.game, ctx = Ctx(); const r = actLobby(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/aanvraag"(d){ const s = G.game, ctx = Ctx(); const r = actAanvraag(s, ctx, d.id, d.keuze); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/export"(d){ const s = G.game, ctx = Ctx(); const r = actExport(s, ctx, d.soort, d.cont); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/regio"(d){ const s = G.game, ctx = Ctx(); const r = actRegio(s, d.id, d.cont); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/voorraad"(d){ const s = G.game, ctx = Ctx(); const r = actVoorraad(s, ctx, d.m, d.n); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/patent"(d){ const s = G.game, ctx = Ctx(); const r = actPatent(s, ctx, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/onderzoek"(d){ const s = G.game, ctx = Ctx(); const r = d.stop ? actOnderzoekStop(s) : actOnderzoek(s, ctx, d.aard); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/termijn"(d){ const s = G.game, ctx = Ctx(); const r = actTermijn(s, ctx, d.bedrag, d.n); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/beurs"(d){ const s = G.game, ctx = Ctx(); const r = actBeurs(s, ctx, d.soort, d.pct); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/eigenplan"(d){ const s = G.game, ctx = Ctx(); const r = d.stop ? actEigenPlanStop(s) : actEigenPlan(s, ctx, d.k, d.doel); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/ceo"(d){ const s = G.game, ctx = Ctx(); const r = actCeo(s, ctx, d.soort, d.arg); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/instel"(d){ const s = G.game, ctx = Ctx(); const r = actInstel(s, d.k, d.n); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/hoofd"(d){ const s = G.game, ctx = Ctx(); const r = actHoofd(s, ctx, d.div, d.soort, d.arg); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/corpo"(d){ const s = G.game, ctx = Ctx(); const r = actCorpo(s, ctx, d.soort, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/huisstijl"(d){ const s = G.game, ctx = Ctx(); const r = actHuisstijl(s, d || {}); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/product"(d){ const s = G.game, ctx = Ctx(); const r = actProduct(s, ctx, d.soort, d); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/missie"(d){ const s = G.game, ctx = Ctx(); const r = actMissie(s, ctx, d.crew, d.missie, d.doel); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/crew"(d){ const s = G.game, ctx = Ctx(); const r = actCrew(s, ctx, d.soort, d.id); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/klus"(d){ const s = G.game, ctx = Ctx(); const r = actKlus(s, ctx, d.id, d.crew); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/leger"(d){ const r = actLeger(G.game, d.id); if (r.ok) await persist(); return {ok: r.ok, bericht: r.msg}; },
  async "/api/keuze"(d){ const s = G.game, ctx = Ctx(); const r = actKeuze(s, ctx, d.id, d.i); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/mens"(d){ const s = G.game, ctx = Ctx(); const r = actMens(s, ctx, d.key, d.soort); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/bedrijf"(d){ const s = G.game, ctx = Ctx(); const r = actBedrijf(s, ctx, d.id, d.soort); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/gang"(d){ const s = G.game, ctx = Ctx(); const r = actGang(s, ctx, d.id, d.soort, d.land); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/aanbod"(d){ const s = G.game, ctx = Ctx(); const r = offerDecide(s, ctx, d.id, d.ja); if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg}; },
  async "/api/geld"(d){
    const s = G.game, ctx = Ctx();
    const r = d.soort === "transfer" ? actTransfer(s, ctx, d.van, d.naar, d.bedrag) : d.soort === "lening" ? actLoan(s, d.bedrag) : actRepay(s, d.bedrag);
    if (r.ok) await persist(ctx); return {ok: r.ok, bericht: r.msg};
  },
  async "/api/mail/flag"(d){
    const key = d.soort === "archief" ? "archief" : "gelezen";
    const ids = d.ids.filter(id => { const m = G.mails.find(x => x.id === id); return m && !!m[key] !== !!d.waarde; });
    for (const id of ids) await Store.patchMail(id, {[key]: !!d.waarde});
    return {ok: true};
  },
  async "/api/mail/stuur"(d){ return sendMail(d.aan, d.onderwerp, d.tekst, d.re); },
  async "/api/mail/besluit"(d){ return decideMail(d.id, d.ja); },
  async "/api/setup"(d){ const {s, ctx} = newGame(d); G.game = s; await persist(ctx); return {ok: true, bericht: "Bedrijf opgericht."}; },
  async "/api/doorspelen"(){ const s = G.game; if (!s || !s.eind || !(s.status.startsWith("OVERWINNING") || s.status === "EINDE TERMIJN")) return {ok: false, bericht: "Dit spel kan niet verder."};
    s.status = "actief"; s.player.lengte = "eindeloos"; s.flags.doorgespeeld = true; s.flags.gewonnen_op = s.eind.datum; delete s.eind; s.flags.start_rivalen = []; await persist(); return {ok: true, bericht: "Je speelt verder, zonder einddatum. Je score staat al in de eregalerij."}; },
  async "/api/nieuw"(){ const r = await Store.newGame(); if (r && !r.ok) return {ok: false, bericht: r.msg}; S.setup = null; return {ok: true, bericht: "Nieuw spel. Je vorige spel staat bij Logboek → Spellen; daar kun je terugwisselen."}; },
};
async function api(path, body){
  if (path === "/api/state") return vm();
  return API[path] ? API[path](body || {}) : {ok: false, bericht: "Onbekende actie."};
}

/* ---------- bevestigen in de pagina zelf ---------- */
function ask(title, text, ok = "Doorgaan", danger = false){
  return new Promise(res => {
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="askt"><h2 id="askt">${esc(title)}</h2><p style="margin:0 0 16px;white-space:pre-wrap">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-x="0">Annuleren</button><button class="btn ${danger ? "danger" : "primary"}" data-x="1">${esc(ok)}</button></div></div>`;
    const done = v => { m.remove(); document.removeEventListener("keydown", key); res(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    m.addEventListener("click", e => { const b = e.target.closest("[data-x]"); if (b){ e.stopPropagation(); done(b.dataset.x === "1"); } else if (e.target === m) done(false); });
    document.addEventListener("keydown", key);
    document.body.appendChild(m); m.querySelector('[data-x="1"]').focus();
  });
}

/* ---------- voorstelkaart (chat en mail) ---------- */
function propCard(p, status, attrs, extra){
  const st = {open: "", afgewezen: "afgewezen", vervallen: "vervallen", uitgevoerd: extra && extra.uitkomst ? extra.uitkomst : "uitgevoerd"}[status] ?? status;
  return `<div class="prop ${status}">
    <div class="spread"><span class="kpi">VOORSTEL</span>${status !== "open" ? `<span class="tag ${st === "gelukt" ? "ok" : st === "mislukt" ? "KRITIEK" : ""}">${esc(st)}</span>` : ""}</div>
    <div class="ptext">${esc(p.samenvatting)}</div>
    <div class="pstats"><div><span class="kpi">KOST</span><b>${p.kost ? eur(p.kost) : "gratis"}</b>${p.kost && p.bron === "zwart" ? '<span class="dim"> zwart</span>' : ""}</div>
      <div><span class="kpi">KANS</span><b>${p.kans}%</b>${p.kans < 100 ? `<span class="dim"> · 2d6 ≥ ${doelVoor(p.kans)}</span>` : ""}</div><div class="wide"><span class="kpi">RISICO</span><span>${esc(p.risico || "-")}</span></div></div>
    <div class="meter"><i style="width:${p.kans}%"></i></div>
    ${status === "open" ? `<div class="row" style="margin-top:10px"><button class="btn primary sm" data-a="pyes" ${attrs}>Ja, doen${p.kans < 100 ? " · gooi 2d6" : ""}</button><button class="btn sm" data-a="pno" ${attrs}>Nee</button></div>` : ""}
    ${extra && extra.worp != null ? `<div class="mono dim" style="margin-top:6px;font-size:13px">Worp ${extra.worp}</div>` : ""}</div>`;
}


