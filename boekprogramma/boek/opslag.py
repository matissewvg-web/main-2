"""Opslag op schijf.

Elk boek is een map onder de boekenmap (standaard ~/Boeken):

    <boek>/boek.json              titel, auteur, volgorde hoofdstukken, export-instellingen, maps
    <boek>/hoofdstukken/<id>.md   één Markdown-bestand per hoofdstuk ("# Titel" + tekst)
    <boek>/characters/<id>.json   één JSON-bestand per character
    <boek>/maps/<bestand>         geïmporteerde afbeeldingen
    <boek>/wereld/<id>.md         notities over de wereld
    <boek>/woordenlijst.txt       eigen woorden voor de spellingscontrole
    <boek>/.versies/<datum>/      dagelijkse kopie van elk hoofdstuk dat die dag is gewijzigd
    <boek>/prullenbak/            verwijderde hoofdstukken, characters en notities
"""

import datetime
import json
import os
import re
import shutil
import threading
import unicodedata
import uuid
from pathlib import Path

ID_PATROON = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
AFBEELDING_EXTENSIES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

STANDAARD_EXPORT = {
    "lettertype": "Literata",
    "korps": 10.5,            # pt
    "regelafstand": 1.4,
    "marge_boven": 18,        # mm
    "marge_onder": 20,
    "marge_binnen": 20,       # kant van de rug
    "marge_buiten": 15,
    "uitvullen": True,
    "afbreken": True,
    "titelpagina": True,
    "inhoudsopgave": True,
    "hoofdstuk_rechts": False,  # hoofdstuk altijd op een rechterpagina laten beginnen
    "paginanummers": True,
}

_slot = threading.Lock()


class NietGevonden(Exception):
    pass


class OngeldigeInvoer(Exception):
    pass


def boekenmap() -> Path:
    map_ = Path(os.environ.get("BOEKEN_MAP") or Path.home() / "Boeken")
    map_.mkdir(parents=True, exist_ok=True)
    return map_


def _schrijf(pad: Path, inhoud: str) -> None:
    """Schrijf eerst naar een tijdelijk bestand en vervang dan, zodat een
    crash halverwege nooit een half bestand achterlaat."""
    pad.parent.mkdir(parents=True, exist_ok=True)
    tijdelijk = pad.with_name(f".{pad.name}.{uuid.uuid4().hex}.tmp")
    with open(tijdelijk, "w", encoding="utf-8", newline="\n") as f:
        f.write(inhoud)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tijdelijk, pad)


def _lees_json(pad: Path):
    with open(pad, encoding="utf-8") as f:
        return json.load(f)


def _schrijf_json(pad: Path, data) -> None:
    _schrijf(pad, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def maak_id(tekst: str, bestaande) -> str:
    tekst = unicodedata.normalize("NFKD", tekst).encode("ascii", "ignore").decode()
    basis = re.sub(r"[^a-z0-9]+", "-", tekst.lower()).strip("-")[:50] or "naamloos"
    kandidaat, n = basis, 2
    while kandidaat in bestaande:
        kandidaat, n = f"{basis}-{n}", n + 1
    return kandidaat


def controleer_id(id_: str) -> str:
    if not isinstance(id_, str) or not ID_PATROON.match(id_):
        raise OngeldigeInvoer(f"Ongeldige naam: {id_!r}")
    return id_


def _naar_prullenbak(boek: Path, pad: Path) -> None:
    doel = boek / "prullenbak" / f"{datetime.datetime.now():%Y%m%d-%H%M%S}-{pad.name}"
    doel.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(pad), str(doel))


# ---------------------------------------------------------------- boeken

def boekpad(boek_id: str) -> Path:
    pad = boekenmap() / controleer_id(boek_id)
    if not (pad / "boek.json").is_file():
        raise NietGevonden("Boek bestaat niet")
    return pad


def lees_boek(boek_id: str) -> dict:
    data = _lees_json(boekpad(boek_id) / "boek.json")
    data["id"] = boek_id
    data.setdefault("hoofdstukken", [])
    data.setdefault("maps", [])
    data["export"] = {**STANDAARD_EXPORT, **data.get("export", {})}
    return data


def _bewaar_boek(boek_id: str, data: dict) -> None:
    data = {k: v for k, v in data.items() if k != "id"}
    _schrijf_json(boekpad(boek_id) / "boek.json", data)


def lijst_boeken() -> list:
    boeken = []
    for pad in sorted(boekenmap().iterdir()):
        if (pad / "boek.json").is_file() and ID_PATROON.match(pad.name):
            data = _lees_json(pad / "boek.json")
            boeken.append({"id": pad.name, "titel": data.get("titel", pad.name),
                           "auteur": data.get("auteur", "")})
    return boeken


def maak_boek(titel: str, auteur: str = "") -> dict:
    titel = (titel or "").strip() or "Naamloos boek"
    with _slot:
        bestaande = {p.name for p in boekenmap().iterdir()}
        boek_id = maak_id(titel, bestaande)
        pad = boekenmap() / boek_id
        for sub in ("hoofdstukken", "characters", "maps", "wereld"):
            (pad / sub).mkdir(parents=True, exist_ok=True)
        _schrijf_json(pad / "boek.json", {"titel": titel, "auteur": auteur.strip(),
                                          "hoofdstukken": [], "maps": [],
                                          "export": dict(STANDAARD_EXPORT)})
    return lees_boek(boek_id)


def werk_boek_bij(boek_id: str, wijzigingen: dict) -> dict:
    with _slot:
        data = lees_boek(boek_id)
        for sleutel in ("titel", "auteur"):
            if sleutel in wijzigingen:
                data[sleutel] = str(wijzigingen[sleutel]).strip()
        if "export" in wijzigingen:
            export = data["export"]
            for sleutel, waarde in wijzigingen["export"].items():
                if sleutel not in STANDAARD_EXPORT:
                    continue
                standaard = STANDAARD_EXPORT[sleutel]
                if isinstance(standaard, bool):
                    export[sleutel] = bool(waarde)
                elif isinstance(standaard, (int, float)):
                    try:
                        export[sleutel] = float(waarde)
                    except (TypeError, ValueError):
                        raise OngeldigeInvoer(f"{sleutel} moet een getal zijn")
                else:
                    export[sleutel] = str(waarde)
        _bewaar_boek(boek_id, data)
    return lees_boek(boek_id)


# ---------------------------------------------------------- hoofdstukken

def _hoofdstukpad(boek_id: str, hoofdstuk_id: str) -> Path:
    return boekpad(boek_id) / "hoofdstukken" / f"{controleer_id(hoofdstuk_id)}.md"


def _parse_markdown(inhoud: str, standaard_titel: str):
    inhoud = inhoud.replace("\r\n", "\n")
    regels = inhoud.split("\n")
    if regels and regels[0].startswith("# "):
        titel = regels[0][2:].strip()
        tekst = "\n".join(regels[1:]).lstrip("\n")
    else:
        titel, tekst = standaard_titel, inhoud
    return titel, tekst


def tel_woorden(tekst: str) -> int:
    return len(re.findall(r"\w+(?:['’-]\w+)*", tekst))


def lees_hoofdstuk(boek_id: str, hoofdstuk_id: str) -> dict:
    pad = _hoofdstukpad(boek_id, hoofdstuk_id)
    if not pad.is_file():
        raise NietGevonden("Hoofdstuk bestaat niet")
    titel, tekst = _parse_markdown(pad.read_text(encoding="utf-8"), hoofdstuk_id)
    return {"id": hoofdstuk_id, "titel": titel, "tekst": tekst, "woorden": tel_woorden(tekst)}


def lijst_hoofdstukken(boek_id: str) -> list:
    """Hoofdstukken in de volgorde van boek.json. Bestanden die er wel staan maar
    niet in de volgorde (bijvoorbeeld zelf in de map gezet) komen achteraan."""
    boek = lees_boek(boek_id)
    map_ = boekpad(boek_id) / "hoofdstukken"
    op_schijf = sorted(p.stem for p in map_.glob("*.md") if ID_PATROON.match(p.stem))
    volgorde = [h for h in boek["hoofdstukken"] if h in op_schijf]
    volgorde += [h for h in op_schijf if h not in volgorde]
    return [lees_hoofdstuk(boek_id, h) for h in volgorde]


def maak_hoofdstuk(boek_id: str, titel: str = "", tekst: str = "") -> dict:
    with _slot:
        boek = lees_boek(boek_id)
        titel = (titel or "").strip() or f"Hoofdstuk {len(boek['hoofdstukken']) + 1}"
        map_ = boekpad(boek_id) / "hoofdstukken"
        bestaande = {p.stem for p in map_.glob("*.md")} | set(boek["hoofdstukken"])
        hoofdstuk_id = maak_id(titel, bestaande)
        _schrijf(map_ / f"{hoofdstuk_id}.md", f"# {titel}\n\n{tekst}")
        boek["hoofdstukken"].append(hoofdstuk_id)
        _bewaar_boek(boek_id, boek)
    return lees_hoofdstuk(boek_id, hoofdstuk_id)


def _maak_versie(boek_id: str, pad: Path) -> None:
    """Bewaar per dag de eerste versie van een hoofdstuk voordat het die dag
    voor het eerst wordt overschreven."""
    doel = boekpad(boek_id) / ".versies" / f"{datetime.date.today():%Y-%m-%d}" / pad.name
    if pad.is_file() and not doel.exists():
        doel.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pad, doel)


def bewaar_hoofdstuk(boek_id: str, hoofdstuk_id: str, titel=None, tekst=None) -> dict:
    with _slot:
        huidig = lees_hoofdstuk(boek_id, hoofdstuk_id)
        titel = huidig["titel"] if titel is None else (str(titel).strip() or huidig["titel"])
        tekst = huidig["tekst"] if tekst is None else str(tekst).replace("\r\n", "\n")
        pad = _hoofdstukpad(boek_id, hoofdstuk_id)
        _maak_versie(boek_id, pad)
        _schrijf(pad, f"# {titel}\n\n{tekst}")
    return lees_hoofdstuk(boek_id, hoofdstuk_id)


def verwijder_hoofdstuk(boek_id: str, hoofdstuk_id: str) -> None:
    with _slot:
        pad = _hoofdstukpad(boek_id, hoofdstuk_id)
        if not pad.is_file():
            raise NietGevonden("Hoofdstuk bestaat niet")
        _naar_prullenbak(boekpad(boek_id), pad)
        boek = lees_boek(boek_id)
        boek["hoofdstukken"] = [h for h in boek["hoofdstukken"] if h != hoofdstuk_id]
        for m in boek["maps"]:
            m["hoofdstukken"] = [h for h in m.get("hoofdstukken", []) if h != hoofdstuk_id]
        _bewaar_boek(boek_id, boek)


def zet_volgorde(boek_id: str, volgorde: list) -> list:
    with _slot:
        aanwezig = [h["id"] for h in lijst_hoofdstukken(boek_id)]
        if sorted(volgorde) != sorted(aanwezig):
            raise OngeldigeInvoer("De nieuwe volgorde bevat niet precies alle hoofdstukken")
        boek = lees_boek(boek_id)
        boek["hoofdstukken"] = list(volgorde)
        _bewaar_boek(boek_id, boek)
    return volgorde


# ------------------------------------------------------------ characters

CHARACTER_VELDEN = ("naam", "bijnamen", "leeftijd", "rol", "uiterlijk", "beschrijving",
                    "relaties", "tijdlijn")


def _schoon_character(data: dict) -> dict:
    naam = str(data.get("naam", "")).strip()
    if not naam:
        raise OngeldigeInvoer("Een character heeft een naam nodig")
    bijnamen = data.get("bijnamen", [])
    if isinstance(bijnamen, str):
        bijnamen = bijnamen.split(",")
    relaties = [{"met": str(r.get("met", "")).strip(), "soort": str(r.get("soort", "")).strip()}
                for r in data.get("relaties", []) if isinstance(r, dict)]
    tijdlijn = [{"wanneer": str(t.get("wanneer", "")).strip(),
                 "gebeurtenis": str(t.get("gebeurtenis", "")).strip()}
                for t in data.get("tijdlijn", []) if isinstance(t, dict)]
    return {
        "naam": naam,
        "bijnamen": [b.strip() for b in bijnamen if str(b).strip()],
        "leeftijd": str(data.get("leeftijd", "")).strip(),
        "rol": str(data.get("rol", "")).strip(),
        "uiterlijk": str(data.get("uiterlijk", "")).strip(),
        "beschrijving": str(data.get("beschrijving", "")).strip(),
        "relaties": [r for r in relaties if r["met"] or r["soort"]],
        "tijdlijn": [t for t in tijdlijn if t["wanneer"] or t["gebeurtenis"]],
    }


def lijst_characters(boek_id: str) -> list:
    map_ = boekpad(boek_id) / "characters"
    uit = []
    for pad in sorted(map_.glob("*.json")):
        if ID_PATROON.match(pad.stem):
            uit.append({"id": pad.stem, **_lees_json(pad)})
    return sorted(uit, key=lambda c: c.get("naam", "").lower())


def bewaar_character(boek_id: str, data: dict, character_id: str = None) -> dict:
    schoon = _schoon_character(data)
    with _slot:
        map_ = boekpad(boek_id) / "characters"
        if character_id is None:
            character_id = maak_id(schoon["naam"], {p.stem for p in map_.glob("*.json")})
        elif not (map_ / f"{controleer_id(character_id)}.json").is_file():
            raise NietGevonden("Character bestaat niet")
        _schrijf_json(map_ / f"{character_id}.json", schoon)
    return {"id": character_id, **schoon}


def verwijder_character(boek_id: str, character_id: str) -> None:
    pad = boekpad(boek_id) / "characters" / f"{controleer_id(character_id)}.json"
    if not pad.is_file():
        raise NietGevonden("Character bestaat niet")
    _naar_prullenbak(boekpad(boek_id), pad)


def characters_per_hoofdstuk(boek_id: str) -> dict:
    """Welke characters komen in welk hoofdstuk voor? Gezocht op naam en
    bijnamen, als heel woord, hoofdletterongevoelig."""
    characters = lijst_characters(boek_id)
    uit = {}
    for h in lijst_hoofdstukken(boek_id):
        tekst = h["titel"] + "\n" + h["tekst"]
        gevonden = []
        for c in characters:
            namen = [c["naam"], *c.get("bijnamen", [])]
            # Bij "Anna de Vries" telt ook alleen de voornaam.
            namen += [n.split()[0] for n in namen if " " in n]
            treffers = sum(len(re.findall(rf"(?<!\w){re.escape(n)}(?!\w)", tekst, re.IGNORECASE))
                           for n in set(namen) if n)
            if treffers:
                gevonden.append({"id": c["id"], "naam": c["naam"], "aantal": treffers})
        uit[h["id"]] = gevonden
    return uit


# ------------------------------------------------------------------ maps

def lijst_maps(boek_id: str) -> list:
    return lees_boek(boek_id)["maps"]


def importeer_map(boek_id: str, bestandsnaam: str, inhoud: bytes, titel: str = "") -> dict:
    extensie = Path(bestandsnaam).suffix.lower()
    if extensie not in AFBEELDING_EXTENSIES:
        raise OngeldigeInvoer("Alleen afbeeldingen (png, jpg, webp, gif) kunnen als map")
    with _slot:
        boek = lees_boek(boek_id)
        titel = (titel or Path(bestandsnaam).stem).strip()
        map_id = maak_id(titel, {m["id"] for m in boek["maps"]})
        bestand = f"{map_id}{extensie}"
        doel = boekpad(boek_id) / "maps" / bestand
        doel.parent.mkdir(parents=True, exist_ok=True)
        doel.write_bytes(inhoud)
        kaart = {"id": map_id, "titel": titel, "bestand": bestand,
                 "hoofdstukken": [], "in_pdf": False}
        boek["maps"].append(kaart)
        _bewaar_boek(boek_id, boek)
    return kaart


def werk_map_bij(boek_id: str, map_id: str, wijzigingen: dict) -> dict:
    with _slot:
        boek = lees_boek(boek_id)
        kaart = next((m for m in boek["maps"] if m["id"] == map_id), None)
        if kaart is None:
            raise NietGevonden("Map bestaat niet")
        if "titel" in wijzigingen:
            kaart["titel"] = str(wijzigingen["titel"]).strip() or kaart["titel"]
        if "hoofdstukken" in wijzigingen:
            bekend = set(boek["hoofdstukken"])
            kaart["hoofdstukken"] = [h for h in wijzigingen["hoofdstukken"] if h in bekend]
        if "in_pdf" in wijzigingen:
            kaart["in_pdf"] = bool(wijzigingen["in_pdf"])
        _bewaar_boek(boek_id, boek)
    return kaart


def map_bestand(boek_id: str, map_id: str) -> Path:
    kaart = next((m for m in lijst_maps(boek_id) if m["id"] == map_id), None)
    if kaart is None:
        raise NietGevonden("Map bestaat niet")
    return boekpad(boek_id) / "maps" / kaart["bestand"]


def verwijder_map(boek_id: str, map_id: str) -> None:
    with _slot:
        pad = map_bestand(boek_id, map_id)
        if pad.is_file():
            _naar_prullenbak(boekpad(boek_id), pad)
        boek = lees_boek(boek_id)
        boek["maps"] = [m for m in boek["maps"] if m["id"] != map_id]
        _bewaar_boek(boek_id, boek)


# ---------------------------------------------------------------- wereld

def lijst_notities(boek_id: str) -> list:
    map_ = boekpad(boek_id) / "wereld"
    uit = []
    for pad in sorted(map_.glob("*.md")):
        if ID_PATROON.match(pad.stem):
            titel, tekst = _parse_markdown(pad.read_text(encoding="utf-8"), pad.stem)
            uit.append({"id": pad.stem, "titel": titel, "tekst": tekst})
    return sorted(uit, key=lambda n: n["titel"].lower())


def bewaar_notitie(boek_id: str, titel: str, tekst: str, notitie_id: str = None) -> dict:
    titel = (titel or "").strip() or "Naamloze notitie"
    with _slot:
        map_ = boekpad(boek_id) / "wereld"
        map_.mkdir(exist_ok=True)
        if notitie_id is None:
            notitie_id = maak_id(titel, {p.stem for p in map_.glob("*.md")})
        elif not (map_ / f"{controleer_id(notitie_id)}.md").is_file():
            raise NietGevonden("Notitie bestaat niet")
        _schrijf(map_ / f"{notitie_id}.md", f"# {titel}\n\n{tekst}")
    return {"id": notitie_id, "titel": titel, "tekst": tekst}


def verwijder_notitie(boek_id: str, notitie_id: str) -> None:
    pad = boekpad(boek_id) / "wereld" / f"{controleer_id(notitie_id)}.md"
    if not pad.is_file():
        raise NietGevonden("Notitie bestaat niet")
    _naar_prullenbak(boekpad(boek_id), pad)


# ----------------------------------------------------------- woordenlijst

def lees_woordenlijst(boek_id: str) -> set:
    pad = boekpad(boek_id) / "woordenlijst.txt"
    if not pad.is_file():
        return set()
    return {w.strip() for w in pad.read_text(encoding="utf-8").splitlines() if w.strip()}


def voeg_toe_aan_woordenlijst(boek_id: str, woord: str) -> set:
    woord = woord.strip()
    if not woord or len(woord) > 80 or any(c.isspace() for c in woord):
        raise OngeldigeInvoer("Voeg één woord tegelijk toe")
    with _slot:
        woorden = lees_woordenlijst(boek_id) | {woord}
        _schrijf(boekpad(boek_id) / "woordenlijst.txt",
                 "\n".join(sorted(woorden, key=str.lower)) + "\n")
    return woorden


# ------------------------------------------------------------ instellingen

def lees_instellingen() -> dict:
    pad = boekenmap() / "instellingen.json"
    return _lees_json(pad) if pad.is_file() else {}


def bewaar_instellingen(wijzigingen: dict) -> dict:
    with _slot:
        data = {**lees_instellingen(), **wijzigingen}
        data = {k: v for k, v in data.items() if v not in (None, "")}
        _schrijf_json(boekenmap() / "instellingen.json", data)
    return data
