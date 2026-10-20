"use strict";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const staat = {
  boekId: null,
  boek: null,
  hoofdstukken: [],
  huidig: null,          // {id, titel, tekst}
  vorigeTekst: "",
  fouten: [],            // spelling: {start, eind, woord}
  herhalingen: [],
  actieveHerhaling: null,
  gesprek: [],
  kosten: 0,
  claude: false,
};

async function api(methode, url, body) {
  const opties = { method: methode, headers: {} };
  if (body instanceof FormData) opties.body = body;
  else if (body !== undefined) {
    opties.headers["Content-Type"] = "application/json";
    opties.body = JSON.stringify(body);
  }
  const r = await fetch(url, opties);
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.fout || `Fout ${r.status}`);
  return data;
}
const boekUrl = (pad = "") => `/api/boeken/${staat.boekId}${pad}`;

function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.nu = (...a) => { clearTimeout(t); return fn(...a); };
  d.stop = () => clearTimeout(t);
  return d;
}

function meld(tekst) { $("#opslagstatus").textContent = tekst; }

// ------------------------------------------------------------ tabs

$$("#tabs button").forEach((b) => b.addEventListener("click", () => toonTab(b.dataset.tab)));
function toonTab(naam) {
  $$("#tabs button").forEach((b) => b.classList.toggle("actief", b.dataset.tab === naam));
  $$(".tab").forEach((t) => t.classList.toggle("actief", t.id === `tab-${naam}`));
  if (naam === "characters") laadCharacters();
  if (naam === "wereld") { laadNotities(); laadMaps(); }
  if (naam === "export") vulExport();
  if (naam === "instellingen") laadInstellingen();
  if (naam === "schrijven") laadHoofdstuklijst();
}
$$(".subtabs button").forEach((b) => b.addEventListener("click", () => {
  $$(".subtabs button").forEach((x) => x.classList.toggle("actief", x === b));
  $$(".paneel").forEach((p) => p.classList.toggle("actief", p.id === `paneel-${b.dataset.paneel}`));
  if (b.dataset.paneel === "herhalingen") zoekHerhalingen.nu();
  if (b.dataset.paneel !== "herhalingen") { staat.actieveHerhaling = null; tekenAchtergrond(); }
}));

// ----------------------------------------------------------- boeken

async function laadBoeken(kies) {
  const data = await api("GET", "/api/boeken");
  staat.claude = data.claude;
  let boeken = data.boeken;
  if (!boeken.length) {
    const nieuw = await api("POST", "/api/boeken", { titel: "Mijn boek" });
    boeken = [{ id: nieuw.id, titel: nieuw.titel }];
  }
  const keuze = $("#boekkeuze");
  keuze.innerHTML = boeken.map((b) => `<option value="${esc(b.id)}">${esc(b.titel)}</option>`).join("");
  const id = [kies, data.laatste, boeken[0].id].find((x) => x && boeken.some((b) => b.id === x));
  keuze.value = id;
  await openBoek(id);
}
$("#boekkeuze").addEventListener("change", (e) => openBoek(e.target.value));

async function openBoek(id) {
  await bewaar.nu();
  staat.boekId = id;
  staat.boek = await api("GET", boekUrl());
  staat.huidig = null;
  await laadHoofdstuklijst();
  if (staat.hoofdstukken.length) await openHoofdstuk(staat.hoofdstukken[0].id);
  else toonLeeg();
  toonClaude();
}

// ------------------------------------------------------ hoofdstukken

async function laadHoofdstuklijst() {
  if (!staat.boekId) return;
  staat.hoofdstukken = await api("GET", boekUrl("/hoofdstukken"));
  tekenHoofdstuklijst();
}

function tekenHoofdstuklijst() {
  const lijst = $("#hoofdstuklijst");
  lijst.innerHTML = staat.hoofdstukken.map((h, i) => `
    <li draggable="true" data-id="${esc(h.id)}" class="${staat.huidig && staat.huidig.id === h.id ? "actief" : ""}">
      <div class="naam"><b>${i + 1}. ${esc(h.titel)}</b>
        <span><span class="pijlen"><button data-op="-1" title="Omhoog">▲</button><button data-op="1" title="Omlaag">▼</button></span>
        <span class="aantal">${h.woorden.toLocaleString("nl-NL")}</span></span></div>
      ${(h.characters.length || h.maps.length) ? `<div class="labels">
        ${h.characters.map((c) => `<span class="label" title="${c.aantal}× genoemd">${esc(c.naam)}</span>`).join("")}
        ${h.maps.map((m) => `<span class="label map" title="Map">🗺 ${esc(m.titel)}</span>`).join("")}</div>` : ""}
    </li>`).join("");
  const totaal = staat.hoofdstukken.reduce((s, h) => s + h.woorden, 0);
  $("#totaal").textContent = `${staat.hoofdstukken.length} hoofdstukken · ${totaal.toLocaleString("nl-NL")} woorden · ± ${Math.max(1, Math.round(totaal / 250))} A5-pagina's`;
}

$("#hoofdstuklijst").addEventListener("click", async (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const op = e.target.closest("button[data-op]");
  if (op) {
    e.stopPropagation();
    const ids = staat.hoofdstukken.map((h) => h.id);
    const i = ids.indexOf(li.dataset.id), j = i + Number(op.dataset.op);
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return zetVolgorde(ids);
  }
  if (!staat.huidig || li.dataset.id !== staat.huidig.id) openHoofdstuk(li.dataset.id);
});

let gesleept = null;
$("#hoofdstuklijst").addEventListener("dragstart", (e) => { gesleept = e.target.closest("li")?.dataset.id; });
$("#hoofdstuklijst").addEventListener("dragover", (e) => {
  e.preventDefault();
  $$("#hoofdstuklijst li").forEach((li) => li.classList.toggle("sleep-boven", li === e.target.closest("li")));
});
$("#hoofdstuklijst").addEventListener("drop", (e) => {
  e.preventDefault();
  const doel = e.target.closest("li")?.dataset.id;
  $$("#hoofdstuklijst li").forEach((li) => li.classList.remove("sleep-boven"));
  if (!gesleept || !doel || gesleept === doel) return;
  const ids = staat.hoofdstukken.map((h) => h.id).filter((id) => id !== gesleept);
  ids.splice(ids.indexOf(doel), 0, gesleept);
  zetVolgorde(ids);
});

async function zetVolgorde(ids) {
  await api("PUT", boekUrl("/volgorde"), { volgorde: ids });
  staat.hoofdstukken.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  tekenHoofdstuklijst();
}

$("#nieuw-hoofdstuk").addEventListener("click", async () => {
  await bewaar.nu();
  const h = await api("POST", boekUrl("/hoofdstukken"), {});
  await laadHoofdstuklijst();
  await openHoofdstuk(h.id);
  $("#titel").select();
});

$("#hoofdstuk-verwijderen").addEventListener("click", async () => {
  if (!staat.huidig) return;
  if (!confirm(`"${staat.huidig.titel}" verwijderen? Het bestand gaat naar de prullenbak-map van het boek.`)) return;
  bewaar.stop();
  await api("DELETE", boekUrl(`/hoofdstukken/${staat.huidig.id}`));
  staat.huidig = null;
  await laadHoofdstuklijst();
  if (staat.hoofdstukken.length) openHoofdstuk(staat.hoofdstukken[0].id);
  else toonLeeg();
});

function toonLeeg() {
  $("#titel").value = "";
  $("#tekst").value = "";
  $("#tekst").disabled = $("#titel").disabled = true;
  staat.fouten = []; staat.herhalingen = [];
  tekenAchtergrond(); tekenSpellinglijst(); tekenHerhalingen();
}

async function openHoofdstuk(id) {
  await bewaar.nu();
  const h = await api("GET", boekUrl(`/hoofdstukken/${id}`));
  staat.huidig = { id: h.id, titel: h.titel, tekst: h.tekst };
  staat.vorigeTekst = h.tekst;
  staat.fouten = []; staat.herhalingen = []; staat.actieveHerhaling = null;
  staat.gesprek = []; tekenChat();
  $("#tekst").disabled = $("#titel").disabled = false;
  $("#titel").value = h.titel;
  $("#tekst").value = h.tekst;
  $("#tekst").scrollTop = 0;
  telWoorden();
  tekenHoofdstuklijst();
  tekenAchtergrond();
  meld("Opgeslagen");
  controleerSpelling.nu();
  zoekHerhalingen.nu();
}

// ------------------------------------------------------ automatisch opslaan

let opslaanBezig = Promise.resolve();
const bewaar = debounce(() => {
  if (!staat.huidig || !staat.huidig.vuil) return opslaanBezig;
  const h = staat.huidig;
  const gegevens = { titel: h.titel, tekst: h.tekst };
  h.vuil = false;
  meld("Opslaan…");
  opslaanBezig = opslaanBezig.then(() => api("PUT", boekUrl(`/hoofdstukken/${h.id}`), gegevens))
    .then((r) => {
      meld(h.vuil ? "Niet opgeslagen…" : `Opgeslagen ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`);
      const item = staat.hoofdstukken.find((x) => x.id === h.id);
      if (item) { item.titel = r.titel; item.woorden = r.woorden; tekenHoofdstuklijst(); }
    })
    .catch((e) => { h.vuil = true; meld(`⚠ Niet opgeslagen: ${e.message}`); });
  return opslaanBezig;
}, 700);

function opslaanBijSluiten() {
  const h = staat.huidig;
  if (!h || !h.vuil) return;
  // text/plain: sendBeacon weigert in sommige browsers application/json.
  const blob = new Blob([JSON.stringify({ titel: h.titel, tekst: h.tekst })], { type: "text/plain" });
  if (navigator.sendBeacon(boekUrl(`/hoofdstukken/${h.id}`), blob)) h.vuil = false;
}
window.addEventListener("pagehide", opslaanBijSluiten);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") opslaanBijSluiten(); });
window.addEventListener("beforeunload", opslaanBijSluiten);

// Voor het .exe-venster: geeft tekst terug die nog niet is opgeslagen, zodat het
// programma die bij het sluiten zelf kan bewaren.
function wijzigingVoorSluiten() {
  const h = staat.huidig;
  if (!h || !h.vuil) return null;
  h.vuil = false;
  return { boek: staat.boekId, id: h.id, titel: h.titel, tekst: h.tekst };
}
const inVenster = () => Boolean(window.pywebview && window.pywebview.api);

$("#titel").addEventListener("input", (e) => {
  if (!staat.huidig) return;
  staat.huidig.titel = e.target.value;
  staat.huidig.vuil = true;
  meld("Niet opgeslagen…");
  bewaar();
});

$("#tekst").addEventListener("input", (e) => {
  if (!staat.huidig) return;
  const nieuw = e.target.value;
  verschuifMarkeringen(staat.vorigeTekst, nieuw);
  staat.vorigeTekst = nieuw;
  staat.huidig.tekst = nieuw;
  staat.huidig.vuil = true;
  meld("Niet opgeslagen…");
  telWoorden();
  tekenAchtergrond();
  bewaar();
  controleerSpelling();
  zoekHerhalingen();
  verbergPopup();
});

function telWoorden() {
  const n = (staat.huidig?.tekst.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
  $("#woorden").textContent = `${n.toLocaleString("nl-NL")} woorden`;
}

// Houd onderstrepingen op hun plek terwijl je typt, tot de volgende controle.
function verschuifMarkeringen(oud, nieuw) {
  let p = 0;
  const max = Math.min(oud.length, nieuw.length);
  while (p < max && oud[p] === nieuw[p]) p++;
  let s = 0;
  while (s < max - p && oud[oud.length - 1 - s] === nieuw[nieuw.length - 1 - s]) s++;
  const eindOud = oud.length - s, delta = nieuw.length - oud.length;
  const pas = (m) => {
    if (m.eind <= p) return m;
    if (m.start >= eindOud) return { ...m, start: m.start + delta, eind: m.eind + delta };
    return null;
  };
  staat.fouten = staat.fouten.map(pas).filter(Boolean);
  for (const h of staat.herhalingen) h.posities = h.posities.map(pas).filter(Boolean);
}

// ------------------------------------------------- tekst met markeringen

const tekst = $("#tekst"), achtergrond = $("#achtergrond");
tekst.addEventListener("scroll", () => { achtergrond.scrollTop = tekst.scrollTop; });

function tekenAchtergrond() {
  const t = tekst.value;
  const markeringen = staat.fouten.map((f, i) => ({ start: f.start, eind: f.eind, klasse: "fout", i }));
  const actief = staat.herhalingen.find((h) => h.woord === staat.actieveHerhaling);
  if (actief) for (const p of actief.posities) markeringen.push({ start: p.start, eind: p.eind, klasse: `herhaling${p.dichtbij ? " dichtbij" : ""}` });
  markeringen.sort((a, b) => a.start - b.start);
  let html = "", pos = 0;
  for (const m of markeringen) {
    if (m.start < pos) continue;
    html += esc(t.slice(pos, m.start)) + `<mark class="${m.klasse}" data-start="${m.start}">${esc(t.slice(m.start, m.eind))}</mark>`;
    pos = m.eind;
  }
  achtergrond.innerHTML = html + esc(t.slice(pos)) + "\n​";
  achtergrond.scrollTop = tekst.scrollTop;
}

function scrollNaar(start) {
  const mark = achtergrond.querySelector(`mark[data-start="${start}"]`);
  if (mark) tekst.scrollTop = Math.max(0, mark.offsetTop - tekst.clientHeight / 3);
}

function vervang(start, eind, nieuw) {
  tekst.focus();
  tekst.setSelectionRange(start, eind);
  // execCommand houdt Ctrl+Z werkend; setRangeText is de terugval.
  if (!document.execCommand("insertText", false, nieuw)) {
    tekst.setRangeText(nieuw, start, eind, "end");
    tekst.dispatchEvent(new Event("input"));
  }
}

// ------------------------------------------------------------ spelling

let spellingVolgnummer = 0;
const controleerSpelling = debounce(async () => {
  if (!staat.huidig) return;
  const nr = ++spellingVolgnummer, gecontroleerd = tekst.value;
  try {
    const { fouten } = await api("POST", boekUrl("/spelling"), { tekst: gecontroleerd });
    if (nr !== spellingVolgnummer || tekst.value !== gecontroleerd) return controleerSpelling();
    staat.fouten = fouten;
    tekenAchtergrond();
    tekenSpellinglijst();
  } catch (e) { $("#spellinglijst").innerHTML = `<li>${esc(e.message)}</li>`; }
}, 1200);

function tekenSpellinglijst() {
  const per = new Map();
  for (const f of staat.fouten) {
    if (!per.has(f.woord)) per.set(f.woord, []);
    per.get(f.woord).push(f);
  }
  $("#spellinglijst").innerHTML = per.size
    ? [...per].map(([w, l]) => `<li data-start="${l[0].start}" style="cursor:pointer"><b>${esc(w)}</b> <span class="sub">${l.length > 1 ? `${l.length}×` : ""}</span></li>`).join("")
    : `<li class="sub">Geen onbekende woorden gevonden.</li>`;
}
$("#spellinglijst").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-start]");
  if (!li) return;
  const f = staat.fouten.find((x) => x.start === Number(li.dataset.start));
  if (!f) return;
  scrollNaar(f.start);
  tekst.focus();
  tekst.setSelectionRange(f.start, f.eind);
});

// Klik op een onderstreept of gemarkeerd woord: popup met keuzes.
tekst.addEventListener("click", (e) => {
  if (tekst.selectionStart !== tekst.selectionEnd) return;
  const c = tekst.selectionStart;
  const fout = staat.fouten.find((f) => f.start <= c && c <= f.eind);
  if (fout) return spellingPopup(fout, e.clientX, e.clientY);
  const actief = staat.herhalingen.find((h) => h.woord === staat.actieveHerhaling);
  const plek = actief?.posities.find((p) => p.start <= c && c <= p.eind);
  if (plek && actief.alternatieven.length) return herhalingPopup(actief, plek, e.clientX, e.clientY);
  verbergPopup();
});

const popup = $("#popup");
function toonPopup(html, x, y) {
  popup.innerHTML = html;
  popup.hidden = false;
  const b = popup.getBoundingClientRect();
  popup.style.left = `${Math.min(x, innerWidth - b.width - 8)}px`;
  popup.style.top = `${Math.min(y + 14, innerHeight - b.height - 8)}px`;
}
function verbergPopup() { popup.hidden = true; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") verbergPopup(); });
document.addEventListener("mousedown", (e) => { if (!popup.contains(e.target) && e.target !== tekst) verbergPopup(); });

async function spellingPopup(fout, x, y) {
  toonPopup(`<div class="sub">Suggesties laden…</div>`, x, y);
  let suggesties = [];
  try { ({ suggesties } = await api("GET", `/api/spelling/suggesties?woord=${encodeURIComponent(fout.woord)}`)); } catch { }
  if (tekst.value.slice(fout.start, fout.eind) !== fout.woord) return verbergPopup();
  toonPopup(
    (suggesties.length ? suggesties.map((s) => `<button data-s="${esc(s)}">${esc(s)}</button>`).join("") : `<div class="sub">Geen suggesties</div>`) +
    `<hr><button data-actie="toevoegen">“${esc(fout.woord)}” toevoegen aan woordenlijst</button>
     <button data-actie="negeren">Negeren</button>`, x, y);
  popup.onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    verbergPopup();
    if (b.dataset.s !== undefined) return vervang(fout.start, fout.eind, b.dataset.s);
    if (b.dataset.actie === "toevoegen") await api("POST", boekUrl("/woordenlijst"), { woord: fout.woord });
    staat.fouten = staat.fouten.filter((f) => b.dataset.actie === "toevoegen" ? f.woord.toLowerCase() !== fout.woord.toLowerCase() : f !== fout);
    tekenAchtergrond(); tekenSpellinglijst();
  };
}

// --------------------------------------------------------- herhalingen

const zoekHerhalingen = debounce(async () => {
  if (!staat.huidig || !$("#paneel-herhalingen").classList.contains("actief")) return;
  const gezocht = tekst.value;
  const { herhalingen } = await api("POST", boekUrl("/herhalingen"), { tekst: gezocht });
  if (tekst.value !== gezocht) return zoekHerhalingen();
  staat.herhalingen = herhalingen;
  if (!herhalingen.some((h) => h.woord === staat.actieveHerhaling)) staat.actieveHerhaling = null;
  tekenHerhalingen();
  tekenAchtergrond();
}, 2500);

function tekenHerhalingen() {
  const lijst = $("#herhalinglijst");
  if (!staat.herhalingen.length) { lijst.innerHTML = `<li class="sub">Geen opvallende herhalingen.</li>`; return; }
  lijst.innerHTML = staat.herhalingen.slice(0, 40).map((h) => `
    <li data-woord="${esc(h.woord)}" class="${h.woord === staat.actieveHerhaling ? "actief" : ""}">
      <b>${esc(h.woord)}</b> <span class="sub">${h.aantal}×${h.dichtbij ? ` · ${h.dichtbij} kort na elkaar` : ""}</span>
      ${h.woord === staat.actieveHerhaling ? `<div class="sub">${h.alternatieven.length
        ? `Alternatieven: ${h.alternatieven.map(esc).join(", ")}<br>Klik op een gemarkeerd woord in de tekst om het te vervangen.`
        : "Geen alternatieven in de lijst. Herschrijf de zin of laat het woord weg."}</div>` : ""}
    </li>`).join("");
}
$("#herhalinglijst").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-woord]");
  if (!li) return;
  staat.actieveHerhaling = staat.actieveHerhaling === li.dataset.woord ? null : li.dataset.woord;
  tekenHerhalingen();
  tekenAchtergrond();
  const h = staat.herhalingen.find((x) => x.woord === staat.actieveHerhaling);
  if (h) scrollNaar((h.posities.find((p) => p.dichtbij) || h.posities[0]).start);
});

function herhalingPopup(h, plek, x, y) {
  const origineel = tekst.value.slice(plek.start, plek.eind);
  const keuzes = h.alternatieven.filter((a) => !a.startsWith("("));
  const hoofdletter = (s) => origineel[0] === origineel[0].toUpperCase() ? s[0].toUpperCase() + s.slice(1) : s;
  toonPopup(`<div class="sub">Vervang “${esc(origineel)}” door:</div>` +
    keuzes.map((a) => `<button data-s="${esc(hoofdletter(a))}">${esc(hoofdletter(a))}</button>`).join("") +
    h.alternatieven.filter((a) => a.startsWith("(")).map((a) => `<div class="sub">${esc(a)}</div>`).join(""), x, y);
  popup.onclick = (e) => {
    const b = e.target.closest("button[data-s]");
    if (!b) return;
    verbergPopup();
    if (tekst.value.slice(plek.start, plek.eind) === origineel) vervang(plek.start, plek.eind, b.dataset.s);
  };
}

// --------------------------------------------------------------- claude

function toonClaude() {
  $("#claude-uit").hidden = staat.claude;
  $("#claude-aan").hidden = !staat.claude;
}

function zinBijCursor() {
  let s = tekst.selectionStart, e = tekst.selectionEnd;
  const t = tekst.value;
  if (s === e) {
    while (s > 0 && !/[.!?\n]/.test(t[s - 1])) s--;
    while (e < t.length && !/[.!?\n]/.test(t[e])) e++;
    if (e < t.length && t[e] !== "\n") e++;
    while (s < e && /\s/.test(t[s])) s++;
  }
  const regelStart = t.lastIndexOf("\n", s - 1) + 1;
  const regelEind = t.indexOf("\n", e) === -1 ? t.length : t.indexOf("\n", e);
  return { start: s, eind: e, zin: t.slice(s, e), context: t.slice(regelStart, regelEind) };
}

$("#herschrijf").addEventListener("click", async () => {
  const sel = zinBijCursor();
  if (!sel.zin.trim()) { $("#voorstellen").innerHTML = `<p class="uitleg">Zet de cursor in een zin of selecteer tekst.</p>`; return; }
  $("#voorstellen").innerHTML = `<p class="uitleg">Claude denkt na over: “${esc(sel.zin)}”</p>`;
  try {
    const r = await api("POST", "/api/claude/herschrijf", { zin: sel.zin, context: sel.context });
    telKosten(r.gebruik);
    $("#voorstellen").innerHTML = `<p class="uitleg">Klik om “${esc(sel.zin.slice(0, 60))}${sel.zin.length > 60 ? "…" : ""}” te vervangen:</p>` +
      r.voorstellen.map((v) => `<div class="voorstel">${esc(v)}</div>`).join("");
    $$("#voorstellen .voorstel").forEach((el, i) => el.addEventListener("click", () => {
      if (tekst.value.slice(sel.start, sel.eind) !== sel.zin) { alert("De tekst is intussen veranderd. Vraag opnieuw."); return; }
      vervang(sel.start, sel.eind, r.voorstellen[i]);
      $("#voorstellen").innerHTML = "";
    }));
  } catch (e) { $("#voorstellen").innerHTML = `<p class="uitleg">${esc(e.message)}</p>`; }
});

function tekenChat() {
  $("#chat").innerHTML = staat.gesprek.map((b) => `<div class="bericht ${b.rol}">${esc(b.tekst)}</div>`).join("");
}
$("#chatform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const vraag = $("#chatvraag").value.trim();
  if (!vraag || !staat.huidig) return;
  await bewaar.nu();
  staat.gesprek.push({ rol: "user", tekst: vraag });
  $("#chatvraag").value = "";
  tekenChat();
  $("#chat").insertAdjacentHTML("beforeend", `<div class="bericht assistant uitleg">Claude leest het hoofdstuk…</div>`);
  try {
    const r = await api("POST", boekUrl(`/hoofdstukken/${staat.huidig.id}/chat`), { gesprek: staat.gesprek });
    staat.gesprek.push({ rol: "assistant", tekst: r.antwoord });
    telKosten(r.gebruik);
  } catch (err) {
    staat.gesprek.pop();
    $("#chatvraag").value = vraag;
    alert(err.message);
  }
  tekenChat();
});
$("#chatvraag").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatform").requestSubmit(); }
});
$("#chat-wissen").addEventListener("click", () => { staat.gesprek = []; tekenChat(); });

function telKosten(g) {
  staat.kosten += g.kosten_dollar;
  $("#kosten").textContent = `Laatste verzoek: ${g.invoer.toLocaleString("nl-NL")} tokens in, ${g.uitvoer.toLocaleString("nl-NL")} uit, ± $${g.kosten_dollar.toFixed(3)}. Deze sessie: ± $${staat.kosten.toFixed(2)}.`;
}

// ----------------------------------------------------------- characters

let characters = [], huidigCharacter = null;

async function laadCharacters() {
  characters = await api("GET", boekUrl("/characters"));
  $("#characterlijst").innerHTML = characters.map((c) => `
    <li data-id="${esc(c.id)}" class="${huidigCharacter === c.id ? "actief" : ""}"><b>${esc(c.naam)}</b>
      <div class="sub">${[c.rol, c.in_hoofdstukken.length && `in ${c.in_hoofdstukken.length} hoofdstuk${c.in_hoofdstukken.length > 1 ? "ken" : ""}`].filter(Boolean).map(esc).join(" · ")}</div></li>`).join("")
    || `<li class="sub">Nog geen characters.</li>`;
}
$("#characterlijst").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) openCharacter(characters.find((c) => c.id === li.dataset.id));
});
$("#nieuw-character").addEventListener("click", () => openCharacter(null));

function rijRelatie(r = {}) {
  return `<div class="rij"><input name="met" placeholder="met wie" list="characternamen" value="${esc(r.met || "")}">
    <input name="soort" placeholder="soort relatie (zus, vijand…)" value="${esc(r.soort || "")}">
    <button type="button" class="klein" data-weg>×</button></div>`;
}
function rijTijdlijn(t = {}) {
  return `<div class="rij"><input name="wanneer" placeholder="wanneer" value="${esc(t.wanneer || "")}" style="max-width:140px">
    <input name="gebeurtenis" placeholder="wat gebeurt er" value="${esc(t.gebeurtenis || "")}">
    <button type="button" class="klein" data-weg>×</button></div>`;
}

function openCharacter(c) {
  huidigCharacter = c ? c.id : null;
  const f = $("#characterform");
  f.hidden = false;
  $("#character-leeg").hidden = true;
  f.reset();
  f.naam.value = c?.naam || "";
  f.bijnamen.value = (c?.bijnamen || []).join(", ");
  for (const veld of ["leeftijd", "rol", "uiterlijk", "beschrijving"]) f[veld].value = c?.[veld] || "";
  $("#relaties").innerHTML = (c?.relaties || []).map(rijRelatie).join("");
  $("#tijdlijn").innerHTML = (c?.tijdlijn || []).map(rijTijdlijn).join("");
  $("#character-hoofdstukken").textContent = c
    ? (c.in_hoofdstukken.length ? `Komt voor in: ${c.in_hoofdstukken.map((h) => h.titel).join(", ")}` : "Komt nog in geen enkel hoofdstuk voor.")
    : "";
  $("#character-verwijderen").hidden = !c;
  if (!document.getElementById("characternamen")) document.body.insertAdjacentHTML("beforeend", `<datalist id="characternamen"></datalist>`);
  $("#characternamen").innerHTML = characters.map((x) => `<option value="${esc(x.naam)}">`).join("");
  $$("#characterlijst li").forEach((li) => li.classList.toggle("actief", li.dataset.id === huidigCharacter));
  f.naam.focus();
}
$("#relatie-erbij").addEventListener("click", () => $("#relaties").insertAdjacentHTML("beforeend", rijRelatie()));
$("#tijdlijn-erbij").addEventListener("click", () => $("#tijdlijn").insertAdjacentHTML("beforeend", rijTijdlijn()));
$("#characterform").addEventListener("click", (e) => { if (e.target.matches("[data-weg]")) e.target.closest(".rij").remove(); });

$("#characterform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    naam: f.naam.value, bijnamen: f.bijnamen.value, leeftijd: f.leeftijd.value, rol: f.rol.value,
    uiterlijk: f.uiterlijk.value, beschrijving: f.beschrijving.value,
    relaties: $$("#relaties .rij").map((r) => ({ met: r.querySelector("[name=met]").value, soort: r.querySelector("[name=soort]").value })),
    tijdlijn: $$("#tijdlijn .rij").map((r) => ({ wanneer: r.querySelector("[name=wanneer]").value, gebeurtenis: r.querySelector("[name=gebeurtenis]").value })),
  };
  try {
    const c = huidigCharacter
      ? await api("PUT", boekUrl(`/characters/${huidigCharacter}`), data)
      : await api("POST", boekUrl("/characters"), data);
    huidigCharacter = c.id;
    await laadCharacters();
    openCharacter(characters.find((x) => x.id === c.id));
    meld(`Character "${c.naam}" opgeslagen`);
  } catch (err) { alert(err.message); }
});
$("#character-verwijderen").addEventListener("click", async () => {
  if (!huidigCharacter || !confirm("Dit character verwijderen?")) return;
  await api("DELETE", boekUrl(`/characters/${huidigCharacter}`));
  huidigCharacter = null;
  $("#characterform").hidden = true;
  $("#character-leeg").hidden = false;
  laadCharacters();
});

// ------------------------------------------------------- wereld & maps

let notities = [], huidigeNotitie = null, kaarten = [], huidigeKaart = null;

async function laadNotities() {
  notities = await api("GET", boekUrl("/wereld"));
  $("#notitielijst").innerHTML = notities.map((n) => `<li data-id="${esc(n.id)}" class="${n.id === huidigeNotitie ? "actief" : ""}">${esc(n.titel)}</li>`).join("")
    || `<li class="sub">Nog geen notities.</li>`;
}
function openNotitie(n) {
  huidigeNotitie = n ? n.id : null;
  $("#mapdetail").hidden = true;
  const f = $("#notitieform");
  f.hidden = false;
  f.titel.value = n?.titel || "";
  f.tekst.value = n?.tekst || "";
  $("#notitie-verwijderen").hidden = !n;
  $$("#notitielijst li").forEach((li) => li.classList.toggle("actief", li.dataset.id === huidigeNotitie));
  f.titel.focus();
}
$("#notitielijst").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) openNotitie(notities.find((n) => n.id === li.dataset.id));
});
$("#nieuwe-notitie").addEventListener("click", () => openNotitie(null));
$("#notitieform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = { titel: e.target.titel.value, tekst: e.target.tekst.value };
  const n = huidigeNotitie ? await api("PUT", boekUrl(`/wereld/${huidigeNotitie}`), data) : await api("POST", boekUrl("/wereld"), data);
  huidigeNotitie = n.id;
  await laadNotities();
  meld("Notitie opgeslagen");
});
$("#notitie-verwijderen").addEventListener("click", async () => {
  if (!huidigeNotitie || !confirm("Deze notitie verwijderen?")) return;
  await api("DELETE", boekUrl(`/wereld/${huidigeNotitie}`));
  huidigeNotitie = null;
  $("#notitieform").hidden = true;
  laadNotities();
});

async function laadMaps() {
  kaarten = await api("GET", boekUrl("/maps"));
  $("#maplijst").innerHTML = kaarten.map((k) => `<li data-id="${esc(k.id)}" class="${k.id === huidigeKaart ? "actief" : ""}">🗺 ${esc(k.titel)}
    <div class="sub">${k.hoofdstukken.length ? `${k.hoofdstukken.length} hoofdstuk(ken)` : "niet gekoppeld"}${k.in_pdf ? " · in PDF" : ""}</div></li>`).join("");
}
$("#mapform").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const k = await api("POST", boekUrl("/maps"), new FormData(e.target));
    e.target.reset();
    await laadMaps();
    openKaart(k);
  } catch (err) { alert(err.message); }
});
$("#maplijst").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) openKaart(kaarten.find((k) => k.id === li.dataset.id));
});
async function openKaart(k) {
  huidigeKaart = k.id;
  $("#notitieform").hidden = true;
  $("#mapdetail").hidden = false;
  $("#map-titel").value = k.titel;
  $("#map-afbeelding").src = boekUrl(`/maps/${k.id}/afbeelding`);
  $("#map-in-pdf").checked = k.in_pdf;
  if (!staat.hoofdstukken.length) await laadHoofdstuklijst();
  $("#map-hoofdstukken").innerHTML = staat.hoofdstukken.map((h) =>
    `<label class="vink"><input type="checkbox" value="${esc(h.id)}" ${k.hoofdstukken.includes(h.id) ? "checked" : ""}> ${esc(h.titel)}</label>`).join("");
  $$("#maplijst li").forEach((li) => li.classList.toggle("actief", li.dataset.id === huidigeKaart));
}
$("#map-opslaan").addEventListener("click", async () => {
  await api("PATCH", boekUrl(`/maps/${huidigeKaart}`), {
    titel: $("#map-titel").value,
    in_pdf: $("#map-in-pdf").checked,
    hoofdstukken: $$("#map-hoofdstukken input:checked").map((i) => i.value),
  });
  await laadMaps();
  meld("Map opgeslagen");
});
$("#map-verwijderen").addEventListener("click", async () => {
  if (!confirm("Deze map verwijderen?")) return;
  await api("DELETE", boekUrl(`/maps/${huidigeKaart}`));
  huidigeKaart = null;
  $("#mapdetail").hidden = true;
  laadMaps();
});

// --------------------------------------------------------------- export

async function vulExport() {
  staat.boek = await api("GET", boekUrl());
  const f = $("#exportform");
  f.titel.value = staat.boek.titel;
  f.auteur.value = staat.boek.auteur || "";
  for (const [k, v] of Object.entries(staat.boek.export)) {
    if (!f[k]) continue;
    if (f[k].type === "checkbox") f[k].checked = v; else f[k].value = v;
  }
}
async function bewaarExport() {
  const f = $("#exportform");
  const exportInst = {};
  for (const k of Object.keys(staat.boek.export)) {
    if (!f[k]) continue;
    exportInst[k] = f[k].type === "checkbox" ? f[k].checked : f[k].value;
  }
  staat.boek = await api("PATCH", boekUrl(), { titel: f.titel.value, auteur: f.auteur.value, export: exportInst });
  $(`#boekkeuze option[value="${staat.boekId}"]`).textContent = staat.boek.titel;
}
$("#exportform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#exportstatus");
  status.className = "uitleg";
  status.textContent = "PDF maken…";
  try {
    await bewaar.nu();
    await bewaarExport();
    const r = await fetch(boekUrl("/pdf"));
    if (!r.ok) throw new Error((await r.json()).fout);
    const url = URL.createObjectURL(await r.blob());
    status.innerHTML = `Klaar: ${r.headers.get("X-Paginas")} pagina's A5. ` + (inVenster()
      ? `<button type="button" class="klein" id="pdf-opslaan">PDF opslaan…</button>`
      : `<a href="${boekUrl("/pdf?download=1")}">PDF downloaden</a>`);
    $("#pdf-opslaan")?.addEventListener("click", async () => {
      const r2 = await window.pywebview.api.pdf_opslaan(staat.boekId);
      if (r2.fout) alert(r2.fout);
      else if (r2.pad) meld(`PDF opgeslagen: ${r2.pad}`);
    });
    $("#pdfvoorbeeld").hidden = false;
    $("#pdfvoorbeeld").src = url;
  } catch (err) {
    status.className = "uitleg fout";
    status.textContent = err.message;
  }
});
$("#voorbeeld").addEventListener("click", async () => {
  await bewaar.nu();
  await bewaarExport();
  if (inVenster()) window.pywebview.api.open_in_browser(boekUrl("/voorbeeld"));
  else window.open(boekUrl("/voorbeeld"), "_blank");
});

// --------------------------------------------------------- instellingen

async function laadInstellingen() {
  const i = await api("GET", "/api/instellingen");
  staat.claude = i.claude;
  $("#boekenmap").textContent = i.map;
  $("#sleutelstatus").textContent = i.claude
    ? `Claude staat aan (sleutel eindigt op …${i.sleutel_einde}${i.via_omgeving ? ", uit ANTHROPIC_API_KEY" : ""}). Model: ${i.model}.`
    : "Claude staat uit: geen sleutel ingesteld.";
  toonClaude();
}
$("#sleutelform").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("PUT", "/api/instellingen", { anthropic_api_key: e.target.sleutel.value });
  e.target.reset();
  laadInstellingen();
});
$("#sleutel-wissen").addEventListener("click", async () => {
  await api("PUT", "/api/instellingen", { anthropic_api_key: "" });
  laadInstellingen();
});
$("#nieuwboekform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = await api("POST", "/api/boeken", { titel: e.target.titel.value, auteur: e.target.auteur.value });
  e.target.reset();
  await laadBoeken(b.id);
  toonTab("schrijven");
});

laadBoeken().catch((e) => meld(`⚠ ${e.message}`));
