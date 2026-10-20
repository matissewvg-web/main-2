"""Boekschrijfprogramma: start met `python app.py` en open http://127.0.0.1:5123"""

import io
import os
import sys
import threading
import webbrowser
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_file, send_from_directory

from boek import claude, export, opslag, spelling, taal

HIER = Path(__file__).resolve().parent
POORT = int(os.environ.get("BOEK_POORT", "5123"))

app = Flask(__name__, static_folder=str(HIER / "static"), static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 40 * 1024 * 1024  # maps tot 40 MB


@app.before_request
def _alleen_eigen_pagina():
    """Andere websites in je browser mogen niet bij je boek: weiger verzoeken met
    een vreemde Host (DNS-rebinding) of een vreemde Origin."""
    toegestaan = {f"127.0.0.1:{POORT}", f"localhost:{POORT}"}
    if not app.testing and request.host not in toegestaan:
        abort(403)
    origin = request.headers.get("Origin")
    if origin and origin.split("://", 1)[-1] != request.host:
        abort(403)


@app.errorhandler(opslag.NietGevonden)
def _niet_gevonden(fout):
    return jsonify(fout=str(fout)), 404


@app.errorhandler(opslag.OngeldigeInvoer)
def _ongeldig(fout):
    return jsonify(fout=str(fout)), 400


def _json():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise opslag.OngeldigeInvoer("Verwacht JSON")
    return data


@app.get("/")
def index():
    return send_from_directory(HIER / "static", "index.html")


@app.get("/lettertype/<path:naam>")
def lettertype(naam):
    return send_from_directory(HIER / "lettertype", naam)


# ------------------------------------------------------------- boeken

@app.get("/api/boeken")
def boeken():
    return jsonify(boeken=opslag.lijst_boeken(), map=str(opslag.boekenmap()),
                   laatste=opslag.lees_instellingen().get("laatste_boek"),
                   claude=claude.beschikbaar())


@app.post("/api/boeken")
def nieuw_boek():
    data = _json()
    boek = opslag.maak_boek(data.get("titel", ""), data.get("auteur", ""))
    opslag.maak_hoofdstuk(boek["id"], "Hoofdstuk 1")
    return jsonify(boek), 201


@app.get("/api/boeken/<boek_id>")
def boek(boek_id):
    opslag.bewaar_instellingen({"laatste_boek": boek_id})
    data = opslag.lees_boek(boek_id)
    data["map"] = str(opslag.boekpad(boek_id))
    return jsonify(data)


@app.patch("/api/boeken/<boek_id>")
def boek_bijwerken(boek_id):
    return jsonify(opslag.werk_boek_bij(boek_id, _json()))


# ------------------------------------------------------- hoofdstukken

@app.get("/api/boeken/<boek_id>/hoofdstukken")
def hoofdstukken(boek_id):
    per_hoofdstuk = opslag.characters_per_hoofdstuk(boek_id)
    kaarten = opslag.lijst_maps(boek_id)
    uit = []
    for h in opslag.lijst_hoofdstukken(boek_id):
        uit.append({"id": h["id"], "titel": h["titel"], "woorden": h["woorden"],
                    "characters": per_hoofdstuk.get(h["id"], []),
                    "maps": [{"id": k["id"], "titel": k["titel"]} for k in kaarten
                             if h["id"] in k.get("hoofdstukken", [])]})
    return jsonify(uit)


@app.post("/api/boeken/<boek_id>/hoofdstukken")
def nieuw_hoofdstuk(boek_id):
    data = _json()
    return jsonify(opslag.maak_hoofdstuk(boek_id, data.get("titel", ""), data.get("tekst", ""))), 201


@app.put("/api/boeken/<boek_id>/volgorde")
def volgorde(boek_id):
    return jsonify(opslag.zet_volgorde(boek_id, _json().get("volgorde", [])))


@app.get("/api/boeken/<boek_id>/hoofdstukken/<hoofdstuk_id>")
def hoofdstuk(boek_id, hoofdstuk_id):
    return jsonify(opslag.lees_hoofdstuk(boek_id, hoofdstuk_id))


@app.route("/api/boeken/<boek_id>/hoofdstukken/<hoofdstuk_id>", methods=["PUT", "POST"])
def hoofdstuk_bewaren(boek_id, hoofdstuk_id):
    # POST is er voor navigator.sendBeacon bij het sluiten van het venster.
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        raise opslag.OngeldigeInvoer("Verwacht JSON")
    return jsonify(opslag.bewaar_hoofdstuk(boek_id, hoofdstuk_id, data.get("titel"), data.get("tekst")))


@app.delete("/api/boeken/<boek_id>/hoofdstukken/<hoofdstuk_id>")
def hoofdstuk_verwijderen(boek_id, hoofdstuk_id):
    opslag.verwijder_hoofdstuk(boek_id, hoofdstuk_id)
    return "", 204


# ---------------------------------------------------------- spelling

def _eigen_woorden(boek_id):
    woorden = set(opslag.lees_woordenlijst(boek_id))
    for c in opslag.lijst_characters(boek_id):
        for naam in [c["naam"], *c.get("bijnamen", [])]:
            woorden.update(naam.split())
    return woorden


@app.post("/api/boeken/<boek_id>/spelling")
def spellingscontrole(boek_id):
    tekst = str(_json().get("tekst", ""))
    return jsonify(fouten=spelling.controleer(tekst, _eigen_woorden(boek_id),
                                              opslag.lees_boek(boek_id)["taal"]))


@app.get("/api/boeken/<boek_id>/spelling/suggesties")
def spelling_suggesties(boek_id):
    woord = request.args.get("woord", "").strip()[:80]
    taal_ = opslag.lees_boek(boek_id)["taal"]
    return jsonify(suggesties=spelling.suggesties(woord, taal_) if woord else [])


@app.get("/api/talen")
def talen():
    return jsonify(spelling.TALEN)


@app.post("/api/boeken/<boek_id>/woordenlijst")
def woordenlijst(boek_id):
    return jsonify(woorden=sorted(opslag.voeg_toe_aan_woordenlijst(boek_id, str(_json().get("woord", "")))))


@app.post("/api/boeken/<boek_id>/herhalingen")
def herhalingen(boek_id):
    namen = set()
    for c in opslag.lijst_characters(boek_id):
        for naam in [c["naam"], *c.get("bijnamen", [])]:
            namen.update(naam.split())
    return jsonify(herhalingen=taal.herhalingen(str(_json().get("tekst", "")), namen,
                                                opslag.lees_boek(boek_id)["taal"]))


# -------------------------------------------------------- characters

@app.get("/api/boeken/<boek_id>/characters")
def characters(boek_id):
    per_hoofdstuk = opslag.characters_per_hoofdstuk(boek_id)
    titels = {h["id"]: h["titel"] for h in opslag.lijst_hoofdstukken(boek_id)}
    uit = []
    for c in opslag.lijst_characters(boek_id):
        c["in_hoofdstukken"] = [{"id": h, "titel": titels[h]} for h, lijst in per_hoofdstuk.items()
                                if any(x["id"] == c["id"] for x in lijst)]
        uit.append(c)
    return jsonify(uit)


@app.post("/api/boeken/<boek_id>/characters")
def nieuw_character(boek_id):
    return jsonify(opslag.bewaar_character(boek_id, _json())), 201


@app.put("/api/boeken/<boek_id>/characters/<character_id>")
def character_bewaren(boek_id, character_id):
    return jsonify(opslag.bewaar_character(boek_id, _json(), character_id))


@app.delete("/api/boeken/<boek_id>/characters/<character_id>")
def character_verwijderen(boek_id, character_id):
    opslag.verwijder_character(boek_id, character_id)
    return "", 204


# -------------------------------------------------------------- maps

@app.get("/api/boeken/<boek_id>/maps")
def maps(boek_id):
    return jsonify(opslag.lijst_maps(boek_id))


@app.post("/api/boeken/<boek_id>/maps")
def map_importeren(boek_id):
    bestand = request.files.get("bestand")
    if bestand is None or not bestand.filename:
        raise opslag.OngeldigeInvoer("Kies een afbeelding")
    return jsonify(opslag.importeer_map(boek_id, bestand.filename, bestand.read(),
                                        request.form.get("titel", ""))), 201


@app.patch("/api/boeken/<boek_id>/maps/<map_id>")
def map_bijwerken(boek_id, map_id):
    return jsonify(opslag.werk_map_bij(boek_id, map_id, _json()))


@app.get("/api/boeken/<boek_id>/maps/<map_id>/afbeelding")
def map_afbeelding(boek_id, map_id):
    pad = opslag.map_bestand(boek_id, map_id)
    if not pad.is_file():
        abort(404)
    return send_file(pad)


@app.delete("/api/boeken/<boek_id>/maps/<map_id>")
def map_verwijderen(boek_id, map_id):
    opslag.verwijder_map(boek_id, map_id)
    return "", 204


# ------------------------------------------------------------ wereld

@app.get("/api/boeken/<boek_id>/wereld")
def wereld(boek_id):
    return jsonify(opslag.lijst_notities(boek_id))


@app.post("/api/boeken/<boek_id>/wereld")
def nieuwe_notitie(boek_id):
    data = _json()
    return jsonify(opslag.bewaar_notitie(boek_id, data.get("titel", ""), str(data.get("tekst", "")))), 201


@app.put("/api/boeken/<boek_id>/wereld/<notitie_id>")
def notitie_bewaren(boek_id, notitie_id):
    data = _json()
    return jsonify(opslag.bewaar_notitie(boek_id, data.get("titel", ""), str(data.get("tekst", "")), notitie_id))


@app.delete("/api/boeken/<boek_id>/wereld/<notitie_id>")
def notitie_verwijderen(boek_id, notitie_id):
    opslag.verwijder_notitie(boek_id, notitie_id)
    return "", 204


# ------------------------------------------------------------ export

@app.get("/api/boeken/<boek_id>/voorbeeld")
def voorbeeld(boek_id):
    html = export.maak_html(boek_id, "/lettertype",
                            lambda k: f"/api/boeken/{boek_id}/maps/{k['id']}/afbeelding",
                            voor_browser=True)
    return html, 200, {"Content-Type": "text/html; charset=utf-8"}


@app.get("/api/boeken/<boek_id>/pdf")
def pdf(boek_id):
    try:
        inhoud, paginas = export.maak_pdf(boek_id)
    except export.ExportFout as fout:
        return jsonify(fout=str(fout)), 503
    titel = opslag.lees_boek(boek_id)["titel"]
    antwoord = send_file(io.BytesIO(inhoud), mimetype="application/pdf",
                         as_attachment=request.args.get("download") == "1",
                         download_name=f"{opslag.maak_id(titel, set())}.pdf")
    antwoord.headers["X-Paginas"] = str(paginas)
    return antwoord


# ------------------------------------------------------------ claude

@app.get("/api/instellingen")
def instellingen():
    s = claude.sleutel() or ""
    return jsonify(claude=bool(s), sleutel_einde=s[-4:] if s else "",
                   via_omgeving=bool(os.environ.get("ANTHROPIC_API_KEY")),
                   model=claude.MODEL, map=str(opslag.boekenmap()))


@app.put("/api/instellingen")
def instellingen_bewaren():
    data = _json()
    if "anthropic_api_key" in data:
        opslag.bewaar_instellingen({"anthropic_api_key": str(data["anthropic_api_key"]).strip() or None})
    return instellingen()


def _claude(functie, *args):
    try:
        return jsonify(functie(*args))
    except claude.GeenSleutel as fout:
        return jsonify(fout=str(fout)), 400
    except ValueError as fout:
        return jsonify(fout=str(fout)), 400
    except Exception as fout:  # netwerk, sleutel ongeldig, tegoed op, ...
        return jsonify(fout=f"Claude gaf een fout: {fout}"), 502


@app.post("/api/claude/herschrijf")
def claude_herschrijf():
    data = _json()
    zin = str(data.get("zin", "")).strip()
    if not zin:
        raise opslag.OngeldigeInvoer("Selecteer eerst een zin")
    boek_id = data.get("boek")
    taal_ = opslag.lees_boek(boek_id)["taal"] if boek_id else spelling.STANDAARDTAAL
    return _claude(claude.herschrijf_zin, zin[:2000], str(data.get("context", ""))[:4000], taal_)


@app.post("/api/boeken/<boek_id>/hoofdstukken/<hoofdstuk_id>/chat")
def claude_chat(boek_id, hoofdstuk_id):
    gesprek = _json().get("gesprek", [])
    return _claude(claude.chat, opslag.lees_hoofdstuk(boek_id, hoofdstuk_id), gesprek,
                   opslag.lees_boek(boek_id)["taal"])


def main():
    spelling.laad_op_achtergrond()
    adres = f"http://127.0.0.1:{POORT}"
    print(f"\n  Boekschrijfprogramma draait op {adres}\n  Boeken staan in {opslag.boekenmap()}\n"
          "  Sluit dit venster (of Ctrl+C) om te stoppen.\n")
    if "--geen-browser" not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open(adres)).start()
    # Alleen bereikbaar vanaf deze computer.
    app.run(host="127.0.0.1", port=POORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
