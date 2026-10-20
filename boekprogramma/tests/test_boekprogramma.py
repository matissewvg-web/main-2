"""Eén test per "afgerond als"-controle uit SPEC.md. Draai met: python -m pytest"""

import json
import re
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app as webapp  # noqa: E402
from boek import claude, export, opslag, spelling, taal  # noqa: E402

A5_PT = (148 / 25.4 * 72, 210 / 25.4 * 72)  # 419.53 × 595.28 pt
MM_PX = 96 / 25.4                            # WeasyPrint rekent in CSS-pixels


@pytest.fixture
def boekenmap(tmp_path, monkeypatch):
    monkeypatch.setenv("BOEKEN_MAP", str(tmp_path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    return tmp_path


@pytest.fixture
def client(boekenmap):
    webapp.app.testing = True
    return webapp.app.test_client()


@pytest.fixture
def boek(boekenmap):
    return opslag.maak_boek("Het Testboek", "A. Schrijver")


# Stap 2 -----------------------------------------------------------------

def test_stap2_hoofdstuk_aanmaken_geeft_bestand_op_schijf(boek, boekenmap):
    h = opslag.maak_hoofdstuk(boek["id"], "De Reis", "Het begon op een dinsdag.")
    pad = boekenmap / boek["id"] / "hoofdstukken" / f"{h['id']}.md"
    assert pad.read_text(encoding="utf-8") == "# De Reis\n\nHet begon op een dinsdag."
    assert json.loads((boekenmap / boek["id"] / "boek.json").read_text())["hoofdstukken"] == [h["id"]]


def test_volgorde_en_verwijderen(boek, boekenmap):
    ids = [opslag.maak_hoofdstuk(boek["id"], t)["id"] for t in ("Een", "Twee", "Drie")]
    opslag.zet_volgorde(boek["id"], [ids[2], ids[0], ids[1]])
    assert [h["titel"] for h in opslag.lijst_hoofdstukken(boek["id"])] == ["Drie", "Een", "Twee"]
    with pytest.raises(opslag.OngeldigeInvoer):
        opslag.zet_volgorde(boek["id"], ids[:2])
    opslag.verwijder_hoofdstuk(boek["id"], ids[0])
    assert len(list((boekenmap / boek["id"] / "prullenbak").iterdir())) == 1
    assert [h["titel"] for h in opslag.lijst_hoofdstukken(boek["id"])] == ["Drie", "Twee"]


def test_ongeldige_namen_worden_geweigerd(boek):
    for slecht in ("../boek", "a/b", "", "A B"):
        with pytest.raises(opslag.OngeldigeInvoer):
            opslag.lees_hoofdstuk(boek["id"], slecht)


# Stap 3 -----------------------------------------------------------------

def test_stap3_tekst_blijft_staan_na_herstart(client, boekenmap):
    boek_id = client.post("/api/boeken", json={"titel": "Blijvend"}).get_json()["id"]
    h = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]
    r = client.put(f"/api/boeken/{boek_id}/hoofdstukken/{h['id']}",
                   json={"titel": "Begin", "tekst": "Regel één.\nRegel twee."})
    assert r.status_code == 200 and r.get_json()["woorden"] == 4

    # "Programma sluiten": nieuwe client, alleen wat op schijf staat telt.
    webapp.app.testing = True
    nieuw = webapp.app.test_client()
    terug = nieuw.get(f"/api/boeken/{boek_id}/hoofdstukken/{h['id']}").get_json()
    assert terug["titel"] == "Begin" and terug["tekst"] == "Regel één.\nRegel twee."


def test_sendbeacon_post_wordt_ook_opgeslagen(client):
    boek_id = client.post("/api/boeken", json={"titel": "Beacon"}).get_json()["id"]
    h = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]
    r = client.post(f"/api/boeken/{boek_id}/hoofdstukken/{h['id']}",
                    data=json.dumps({"tekst": "Laatste woorden"}), content_type="text/plain")
    assert r.status_code == 200
    assert opslag.lees_hoofdstuk(boek_id, h["id"])["tekst"] == "Laatste woorden"


def test_dagelijkse_versie_wordt_bewaard(boek, boekenmap):
    h = opslag.maak_hoofdstuk(boek["id"], "Versie", "eerste")
    opslag.bewaar_hoofdstuk(boek["id"], h["id"], tekst="tweede")
    opslag.bewaar_hoofdstuk(boek["id"], h["id"], tekst="derde")
    versies = list((boekenmap / boek["id"] / ".versies").glob("*/*.md"))
    assert len(versies) == 1 and versies[0].read_text(encoding="utf-8").endswith("eerste")


def test_andere_websites_worden_geweigerd(client):
    webapp.app.testing = False
    try:
        assert client.get("/api/boeken", headers={"Host": "evil.example"}).status_code == 403
        goed = {"Host": f"127.0.0.1:{webapp.POORT}"}
        assert client.get("/api/boeken", headers=goed).status_code == 200
        assert client.post("/api/boeken", json={"titel": "x"},
                           headers={**goed, "Origin": "https://evil.example"}).status_code == 403
    finally:
        webapp.app.testing = True


# Stap 4 -----------------------------------------------------------------

def test_stap4_opzettelijke_fouten_worden_aangewezen():
    tekst = ("The cat sat on the mat. Yesterday I bought a bike at the stroe. "
             "It was a beatiful day and the sun didn't stop shining on the well-known street.")
    fouten = spelling.controleer(tekst)
    assert [f["woord"] for f in fouten] == ["stroe", "beatiful"]
    for f in fouten:
        assert tekst[f["start"]:f["eind"]] == f["woord"]
    assert "store" in spelling.suggesties("stroe")
    assert "beautiful" in spelling.suggesties("beatiful")


def test_amerikaans_en_brits_engels():
    assert [f["woord"] for f in spelling.controleer("The colour grey", taal="en_US")] == ["colour", "grey"]
    assert spelling.controleer("The colour grey", taal="en_GB") == []
    assert [f["woord"] for f in spelling.controleer("The color", taal="en_GB")] == ["color"]


def test_nederlands_blijft_mogelijk():
    tekst = ("De kat zat op de mat. Gisteren heb ik een fiets gekocht bij de winkle. "
             "Het was een moie dag en de zon scheen op het straatje. Ze aten ideeën en café-taart.")
    assert [f["woord"] for f in spelling.controleer(tekst, taal="nl")] == ["winkle", "moie"]
    assert "winkel" in spelling.suggesties("winkle", "nl")


def test_eigen_woorden_en_posities_na_emoji():
    tekst = "😀 Tharion walked to Valdoria and saw a dragon."
    assert [f["woord"] for f in spelling.controleer(tekst)] == ["Tharion", "Valdoria"]
    assert spelling.controleer(tekst, {"tharion", "Valdoria"}) == []
    eerste = spelling.controleer(tekst)[0]
    assert eerste["start"] == 3  # emoji telt in JavaScript als 2 tekens


def test_taal_per_boek(client):
    boek_id = client.post("/api/boeken", json={"titel": "Taal"}).get_json()["id"]
    assert client.get(f"/api/boeken/{boek_id}").get_json()["taal"] == "en_US"
    url = f"/api/boeken/{boek_id}/spelling"
    assert [f["woord"] for f in client.post(url, json={"tekst": "colour"}).get_json()["fouten"]] == ["colour"]
    assert client.patch(f"/api/boeken/{boek_id}", json={"taal": "en_GB"}).get_json()["taal"] == "en_GB"
    assert client.post(url, json={"tekst": "colour"}).get_json()["fouten"] == []
    sugg = client.get(f"/api/boeken/{boek_id}/spelling/suggesties?woord=recieve").get_json()["suggesties"]
    assert "receive" in sugg
    assert client.patch(f"/api/boeken/{boek_id}", json={"taal": "klingon"}).status_code == 400
    html = client.get(f"/api/boeken/{boek_id}/voorbeeld").get_data(as_text=True)
    assert '<html lang="en-GB">' in html and "<h2>Contents</h2>" in html
    client.patch(f"/api/boeken/{boek_id}", json={"taal": "nl"})
    assert "<h2>Inhoud</h2>" in client.get(f"/api/boeken/{boek_id}/voorbeeld").get_data(as_text=True)


def test_character_namen_tellen_als_goed_gespeld(client):
    boek_id = client.post("/api/boeken", json={"titel": "Namen"}).get_json()["id"]
    client.post(f"/api/boeken/{boek_id}/characters", json={"naam": "Tharion Vel", "bijnamen": "Tharo"})
    fouten = client.post(f"/api/boeken/{boek_id}/spelling",
                         json={"tekst": "Tharion and Tharo and Vel went away."}).get_json()["fouten"]
    assert fouten == []
    client.post(f"/api/boeken/{boek_id}/woordenlijst", json={"woord": "grumpel"})
    assert client.post(f"/api/boeken/{boek_id}/spelling", json={"tekst": "grumpel"}).get_json()["fouten"] == []


# Stap 5 -----------------------------------------------------------------

def test_stap5_herhaald_woord_met_alternatieven():
    tekst = ("He looked at the door. Then he looked at the window. She looked back.\n"
             "It was a quiet evening in the city.")
    resultaat = taal.herhalingen(tekst)
    looked = next(h for h in resultaat if h["woord"] == "looked")
    assert looked["aantal"] == 3 and looked["dichtbij"] == 3
    assert "glanced" in looked["alternatieven"]
    assert resultaat[0]["woord"] == "looked"
    assert all(tekst[p["start"]:p["eind"]].lower() == "looked" for p in looked["posities"])
    assert not any(h["woord"] in ("the", "he", "she", "was") for h in resultaat)


def test_herhalingen_nederlands():
    tekst = ("Hij keek naar de deur. Toen keek hij naar het raam. Ze keek terug.\n"
             "Het was een mooie avond in de stad.")
    resultaat = taal.herhalingen(tekst, taal="nl")
    keek = next(h for h in resultaat if h["woord"] == "keek")
    assert keek["aantal"] == 3 and keek["dichtbij"] == 3
    assert "staarde" in keek["alternatieven"]
    assert resultaat[0]["woord"] == "keek"
    assert all(tekst[p["start"]:p["eind"]].lower() == "keek" for p in keek["posities"])
    assert not any(h["woord"] in ("de", "het", "hij") for h in resultaat)


def test_namen_niet_als_herhaling():
    tekst = "Anna walked. Anna laughed. Anna sang."
    assert taal.herhalingen(tekst, {"Anna"}) == []


# Stap 6 -----------------------------------------------------------------

def _testboek(boek_id):
    opslag.maak_hoofdstuk(boek_id, "Het begin",
                          "Het was koud.\nZe liep de *donkere* straat in.\n***\nDe volgende ochtend **scheen** de zon.\n" * 40)
    opslag.maak_hoofdstuk(boek_id, "Het midden", "## Een tussenkop\nTekst.\n> Een brief\n> van ver weg\nEinde.")
    opslag.maak_hoofdstuk(boek_id, "Het einde", "Zo eindigde het.")


def test_stap6_pdf_is_exact_a5_en_marges_kloppen(boek):
    _testboek(boek["id"])
    opslag.werk_boek_bij(boek["id"], {"export": {"marge_binnen": 22, "marge_buiten": 14,
                                                  "marge_boven": 18, "marge_onder": 20}})
    pdf, paginas = export.maak_pdf(boek["id"])
    assert pdf.startswith(b"%PDF")

    from weasyprint import HTML
    boekmap = opslag.boekpad(boek["id"])
    document = HTML(string=export.maak_html(boek["id"], export.LETTERMAP.as_uri(),
                                            lambda k: (boekmap / "maps" / k["bestand"]).as_uri())).render()
    pdf = document.write_pdf(uncompressed_pdf=True)
    mediaboxen = re.findall(rb"/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]", pdf)
    assert len(mediaboxen) == paginas >= 5
    for b, h in mediaboxen:
        assert float(b) == pytest.approx(A5_PT[0], abs=0.1)
        assert float(h) == pytest.approx(A5_PT[1], abs=0.1)

    for nummer, pagina in enumerate(document.pages, start=1):
        doos = pagina._page_box
        assert doos.margin_top == pytest.approx(18 * MM_PX, abs=0.5)
        assert doos.margin_bottom == pytest.approx(20 * MM_PX, abs=0.5)
        # Rechterpagina's (oneven) hebben de rug links, linkerpagina's rechts.
        links, rechts = (22, 14) if nummer % 2 else (14, 22)
        assert doos.margin_left == pytest.approx(links * MM_PX, abs=0.5)
        assert doos.margin_right == pytest.approx(rechts * MM_PX, abs=0.5)


def test_hoofdstukken_beginnen_op_nieuwe_pagina(boek):
    _testboek(boek["id"])
    from weasyprint import HTML
    document = HTML(string=export.maak_html(boek["id"], export.LETTERMAP.as_uri(), lambda k: "")).render()
    tekst_per_pagina = []
    for pagina in document.pages:
        stukjes = []

        def loop(doos):
            if hasattr(doos, "text"):
                stukjes.append(doos.text)
            for kind in getattr(doos, "children", []):
                loop(kind)
        loop(pagina._page_box)
        tekst_per_pagina.append(" ".join(stukjes))
    for titel in ("Het begin", "Het midden", "Het einde"):
        pagina = next(t for t in tekst_per_pagina if t.lstrip().startswith(titel))
        assert pagina  # de titel staat bovenaan een pagina


def test_opmaakregels():
    html = export.tekst_naar_html("Eerste *schuin* en **vet**.\n\n***\n## Kop\n> citaat\n<script>")
    assert "<em>schuin</em>" in html and "<strong>vet</strong>" in html
    assert 'class="scenewissel"' in html and "<h3>Kop</h3>" in html
    assert "<blockquote><p>citaat</p></blockquote>" in html
    assert "<script>" not in html and "&lt;script&gt;" in html


# Stap 7 -----------------------------------------------------------------

def test_stap7_character_zichtbaar_in_hoofdstuklijst(client):
    boek_id = client.post("/api/boeken", json={"titel": "Wereld"}).get_json()["id"]
    h = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]
    client.put(f"/api/boeken/{boek_id}/hoofdstukken/{h['id']}",
               json={"tekst": "Mira opende de poort. Later zag Mira de zee."})
    r = client.post(f"/api/boeken/{boek_id}/characters", json={
        "naam": "Mira Dal", "leeftijd": "17", "rol": "hoofdpersoon",
        "relaties": [{"met": "Joren", "soort": "broer"}],
        "tijdlijn": [{"wanneer": "jaar 1", "gebeurtenis": "verlaat het dorp"}]})
    assert r.status_code == 201
    c = r.get_json()
    pad = opslag.boekpad(boek_id) / "characters" / f"{c['id']}.json"
    assert json.loads(pad.read_text(encoding="utf-8"))["relaties"] == [{"met": "Joren", "soort": "broer"}]

    lijst = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()
    assert lijst[0]["characters"] == [{"id": c["id"], "naam": "Mira Dal", "aantal": 2}]
    assert client.get(f"/api/boeken/{boek_id}/characters").get_json()[0]["in_hoofdstukken"][0]["id"] == h["id"]


def test_map_importeren_en_koppelen(client, tmp_path):
    import io
    boek_id = client.post("/api/boeken", json={"titel": "Kaart"}).get_json()["id"]
    h = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]
    png = _png()
    k = client.post(f"/api/boeken/{boek_id}/maps", data={"bestand": (io.BytesIO(png), "scherm.png"),
                                                         "titel": "Het rijk"},
                    content_type="multipart/form-data").get_json()
    assert (opslag.boekpad(boek_id) / "maps" / k["bestand"]).read_bytes() == png
    client.patch(f"/api/boeken/{boek_id}/maps/{k['id']}", json={"hoofdstukken": [h["id"]], "in_pdf": True})
    assert client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]["maps"][0]["titel"] == "Het rijk"
    assert client.get(f"/api/boeken/{boek_id}/maps/{k['id']}/afbeelding").data == png
    bad = client.post(f"/api/boeken/{boek_id}/maps", data={"bestand": (io.BytesIO(b"x"), "virus.exe")},
                      content_type="multipart/form-data")
    assert bad.status_code == 400


def _png():
    import struct
    import zlib

    def stuk(soort, data):
        return struct.pack(">I", len(data)) + soort + data + struct.pack(">I", zlib.crc32(soort + data))
    rauw = b"".join(b"\x00" + b"\x40\x80\xc0" * 4 for _ in range(4))
    return (b"\x89PNG\r\n\x1a\n" + stuk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
            + stuk(b"IDAT", zlib.compress(rauw)) + stuk(b"IEND", b""))


# Stap 8 -----------------------------------------------------------------

class NepClaude:
    def __init__(self, antwoord):
        self.antwoord, self.verzoeken = antwoord, []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.verzoeken.append(kwargs)
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text=self.antwoord)],
            usage=SimpleNamespace(input_tokens=100, output_tokens=50,
                                  cache_read_input_tokens=0, cache_creation_input_tokens=2000))


def test_stap8_vraag_geeft_antwoord_in_paneel(client, monkeypatch):
    boek_id = client.post("/api/boeken", json={"titel": "Chat"}).get_json()["id"]
    h = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]

    zonder = client.post(f"/api/boeken/{boek_id}/hoofdstukken/{h['id']}/chat",
                         json={"gesprek": [{"rol": "user", "tekst": "Hoi"}]})
    assert zonder.status_code == 400 and "sleutel" in zonder.get_json()["fout"].lower()

    nep = NepClaude("Het tempo is goed, maar de opening kan sterker.")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(claude, "_client", lambda: nep)
    r = client.post(f"/api/boeken/{boek_id}/hoofdstukken/{h['id']}/chat",
                    json={"gesprek": [{"rol": "user", "tekst": "Hoe is het tempo?"}]})
    assert r.status_code == 200
    assert r.get_json()["antwoord"].startswith("Het tempo")
    assert r.get_json()["gebruik"]["kosten_dollar"] > 0
    verzoek = nep.verzoeken[0]
    assert verzoek["model"] == claude.MODEL
    assert "Hoofdstuk 1" in verzoek["system"][1]["text"]


def test_zin_herschrijven(client, monkeypatch):
    nep = NepClaude("De wind joeg door de straat.\nDe straat lag open voor de wind.\nWind sneed door de straat.")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(claude, "_client", lambda: nep)
    r = client.post("/api/claude/herschrijf", json={"zin": "Het waaide hard in de straat."}).get_json()
    assert len(r["voorstellen"]) == 3


# Stap 9 -----------------------------------------------------------------

def test_stap9_testboek_drie_hoofdstukken_character_en_map(client):
    import io
    boek_id = client.post("/api/boeken", json={"titel": "Eindtest", "auteur": "Test"}).get_json()["id"]
    eerste = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()[0]["id"]
    client.put(f"/api/boeken/{boek_id}/hoofdstukken/{eerste}",
               json={"titel": "Aankomst", "tekst": "Lena stepped off the train. The station was empty.\n" * 30})
    client.post(f"/api/boeken/{boek_id}/hoofdstukken", json={"titel": "De stad", "tekst": "Lena walked through the city. There was a mistkae.\n" * 30})
    client.post(f"/api/boeken/{boek_id}/hoofdstukken", json={"titel": "Vertrek", "tekst": "She left again."})
    client.post(f"/api/boeken/{boek_id}/characters", json={"naam": "Lena"})
    k = client.post(f"/api/boeken/{boek_id}/maps", data={"bestand": (io.BytesIO(_png()), "stad.png")},
                    content_type="multipart/form-data").get_json()
    client.patch(f"/api/boeken/{boek_id}/maps/{k['id']}", json={"hoofdstukken": [eerste], "in_pdf": True})

    lijst = client.get(f"/api/boeken/{boek_id}/hoofdstukken").get_json()
    assert [h["titel"] for h in lijst] == ["Aankomst", "De stad", "Vertrek"]
    assert [bool(h["characters"]) for h in lijst] == [True, True, False]

    tweede = client.get(f"/api/boeken/{boek_id}/hoofdstukken/{lijst[1]['id']}").get_json()
    fouten = client.post(f"/api/boeken/{boek_id}/spelling", json={"tekst": tweede["tekst"]}).get_json()["fouten"]
    assert {f["woord"] for f in fouten} == {"mistkae"}

    r = client.get(f"/api/boeken/{boek_id}/pdf")
    assert r.status_code == 200 and r.mimetype == "application/pdf"
    assert int(r.headers["X-Paginas"]) >= 6  # titel, inhoud, map, 3 hoofdstukken
    assert len(re.findall(rb"/Subtype\s*/Image", r.data)) == 1

    voorbeeld = client.get(f"/api/boeken/{boek_id}/voorbeeld").get_data(as_text=True)
    assert "Afdrukvoorbeeld" in voorbeeld and "size: A5" in voorbeeld
