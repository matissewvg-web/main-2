"""Start het boekschrijfprogramma in een eigen venster. Dit is het startpunt van de .exe.

    Boekschrijfprogramma.exe                    venster openen
    Boekschrijfprogramma.exe --zelftest LOG     controleren of alles in de .exe werkt (voor CI)
"""

import json
import os
import socket
import sys
import tempfile
import threading
import traceback
import urllib.request
import webbrowser
from pathlib import Path

BASIS = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
VOORKEURPOORT = 5123


def _bereid_pango_voor():
    """In de .exe zitten Pango en fontconfig (voor WeasyPrint) in de map gtk/."""
    gtk = BASIS / "gtk"
    if gtk.is_dir():
        os.environ["WEASYPRINT_DLL_DIRECTORIES"] = str(gtk)
        # Ook de afhankelijkheden van Pango moeten in deze map gevonden worden. Achteraan in
        # PATH, zodat andere onderdelen (venster, .NET) nooit een MSYS2-DLL oppikken.
        os.environ["PATH"] = os.environ.get("PATH", "") + os.pathsep + str(gtk)
        if hasattr(os, "add_dll_directory"):
            os.add_dll_directory(str(gtk))
    fonts = BASIS / "fonts"
    if (fonts / "fonts.conf").is_file():
        os.environ["FONTCONFIG_PATH"] = str(fonts)
        os.environ["FONTCONFIG_FILE"] = str(fonts / "fonts.conf")


def _logpad():
    return Path(os.environ.get("BOEKEN_MAP") or Path.home() / "Boeken") / "boekprogramma.log"


def _logbestand():
    """Een .exe zonder consolevenster heeft geen stdout; schrijf naar een logbestand.
    faulthandler schrijft daar ook naartoe als het programma hard vastloopt."""
    if sys.stdout is None or sys.stderr is None:
        _logpad().parent.mkdir(parents=True, exist_ok=True)
        log = open(_logpad(), "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = log
        import faulthandler
        faulthandler.enable(log)
    import datetime
    print(f"\n--- start {datetime.datetime.now():%Y-%m-%d %H:%M:%S}, {sys.platform}, "
          f"Python {sys.version.split()[0]}", flush=True)


def _meld_fout(tekst):
    """Laat een foutmelding zien in plaats van stil te verdwijnen."""
    print(tekst, flush=True)
    bericht = (f"Het boekschrijfprogramma kon niet starten.\n\n{tekst[-1500:]}\n\n"
               f"Details staan in:\n{_logpad()}")
    try:
        if sys.platform == "win32":
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, bericht, "Boekschrijfprogramma", 0x10)
        else:
            print(bericht, file=sys.__stderr__ or sys.stderr)
    except Exception:
        pass


def _is_ons_programma(poort):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{poort}/api/boeken", timeout=1) as r:
            return "boeken" in json.load(r)
    except Exception:
        return False


def _poort_vrij(poort):
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", poort))
            return True
        except OSError:
            return False


def _kies_poort():
    """(poort, draait_al). Draait het programma al, dan openen we alleen een venster."""
    if _is_ons_programma(VOORKEURPOORT):
        return VOORKEURPOORT, True
    if _poort_vrij(VOORKEURPOORT):
        return VOORKEURPOORT, False
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1], False


class Api:
    """Functies die de pagina via window.pywebview.api kan aanroepen."""

    # Alleen methodes zijn voor de pagina; pywebview slaat attributen met _ over.
    # (Een venster als gewoon attribuut zou pywebview helemaal doorlopen.)
    def __init__(self, poort):
        self._poort = poort
        self._venster = None

    def pdf_opslaan(self, boek_id):
        import webview
        from boek import export, opslag
        try:
            inhoud, paginas = export.maak_pdf(boek_id)
        except export.ExportFout as fout:
            return {"fout": str(fout)}
        naam = f"{opslag.maak_id(opslag.lees_boek(boek_id)['titel'], set())}.pdf"
        soort = getattr(getattr(webview, "FileDialog", None), "SAVE", None) or webview.SAVE_DIALOG
        keuze = self._venster.create_file_dialog(soort, save_filename=naam,
                                                file_types=("PDF (*.pdf)",))
        if not keuze:
            return {"geannuleerd": True}
        pad = Path(keuze if isinstance(keuze, str) else keuze[0])
        if pad.suffix.lower() != ".pdf":
            pad = pad.with_suffix(".pdf")
        pad.write_bytes(inhoud)
        return {"pad": str(pad), "paginas": paginas}

    def open_in_browser(self, pad):
        if isinstance(pad, str) and pad.startswith("/api/"):
            webbrowser.open(f"http://127.0.0.1:{self._poort}{pad}")


def _start_server(poort):
    os.environ["BOEK_POORT"] = str(poort)
    import app
    from boek import spelling
    from werkzeug.serving import make_server
    spelling.laad_op_achtergrond()
    server = make_server("127.0.0.1", poort, app.app, threaded=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _bewaar_open_wijziging(venster):
    """Haal tekst op die nog niet automatisch is opgeslagen en sla die direct op."""
    try:
        data = venster.evaluate_js("JSON.stringify(wijzigingVoorSluiten())")
        data = json.loads(data) if isinstance(data, str) else data
        if data:
            from boek import opslag
            opslag.bewaar_hoofdstuk(data["boek"], data["id"], data["titel"], data["tekst"])
    except Exception:
        traceback.print_exc()


def _met_venster(url, api):
    import webview
    if hasattr(webview, "settings"):
        webview.settings["ALLOW_DOWNLOADS"] = True
    venster = webview.create_window("Boekschrijfprogramma", url, js_api=api,
                                    width=1400, height=900, min_size=(900, 600))
    api._venster = venster
    klaar = threading.Event()

    def bij_sluiten():
        if klaar.is_set():
            return True

        def bewaar_en_sluit():
            _bewaar_open_wijziging(venster)
            klaar.set()
            venster.destroy()
        # Sluiten even uitstellen, zodat de laatste woorden worden opgeslagen.
        threading.Thread(target=bewaar_en_sluit, daemon=True).start()
        return False

    venster.events.closing += bij_sluiten
    webview.start(gui="edgechromium" if sys.platform == "win32" else None)


def _zonder_venster(url):
    """Terugval als het ingebouwde venster (Edge WebView2) niet werkt: de browser."""
    webbrowser.open(url)
    try:
        import tkinter as tk
        root = tk.Tk()
        root.title("Boekschrijfprogramma")
        root.geometry("380x140")
        tk.Label(root, text="Het boekschrijfprogramma draait in je browser.\n"
                            "Sluit dit venster om te stoppen.", pady=16).pack()
        knoppen = tk.Frame(root)
        knoppen.pack()
        tk.Button(knoppen, text="Openen in browser", command=lambda: webbrowser.open(url)).pack(side="left", padx=6)
        tk.Button(knoppen, text="Stoppen", command=root.destroy).pack(side="left", padx=6)
        root.mainloop()
    except Exception:
        traceback.print_exc()
        threading.Event().wait()


def zelftest(logpad):
    """Maak een testboek, controleer spelling en maak een PDF, met wat er in de .exe zit."""
    regels = []
    try:
        os.environ["BOEKEN_MAP"] = tempfile.mkdtemp(prefix="boek-zelftest-")
        _bereid_pango_voor()
        regels.append(f"WEASYPRINT_DLL_DIRECTORIES={os.environ.get('WEASYPRINT_DLL_DIRECTORIES')}")
        from boek import export, opslag, spelling, taal
        boek = opslag.maak_boek("Zelftest", "CI")
        opslag.maak_hoofdstuk(boek["id"], "One", "I bought a bike at the stroe.\n***\nHe looked. She looked. We looked.")
        opslag.maak_hoofdstuk(boek["id"], "Twee", "Het einde.")
        fouten = [f["woord"] for f in spelling.controleer("I bought a bike at the stroe.")]
        assert fouten == ["stroe"], fouten
        assert "store" in spelling.suggesties("stroe")
        assert spelling.controleer("The colour grey", taal="en_GB") == []
        assert [f["woord"] for f in spelling.controleer("bij de winkle", taal="nl")] == ["winkle"]
        assert any(h["woord"] == "looked" for h in taal.herhalingen("He looked. She looked. We looked."))
        assert any(h["woord"] == "keek" for h in taal.herhalingen("Hij keek. Ze keek. Wij keek.", taal="nl"))
        regels.append("spelling en herhalingen: OK")

        pdf, paginas = export.maak_pdf(boek["id"])
        from weasyprint import HTML
        doc = HTML(string=export.maak_html(boek["id"], export.LETTERMAP.as_uri(), lambda k: "")).render()
        breedte_mm = doc.pages[0].width * 25.4 / 96
        hoogte_mm = doc.pages[0].height * 25.4 / 96
        assert pdf.startswith(b"%PDF") and paginas >= 4, paginas
        assert abs(breedte_mm - 148) < 0.1 and abs(hoogte_mm - 210) < 0.1, (breedte_mm, hoogte_mm)
        regels.append(f"PDF: OK, {paginas} pagina's, {breedte_mm:.1f} x {hoogte_mm:.1f} mm, {len(pdf)} bytes")

        os.environ["BOEK_POORT"] = "5199"
        import app
        app.app.testing = True
        c = app.app.test_client()
        assert c.get("/").status_code == 200 and b"Boekschrijfprogramma" in c.get("/").data
        assert c.get("/static/app.js").status_code == 200
        assert c.get("/lettertype/Literata.ttf").status_code == 200
        regels.append("webserver en bestanden: OK")

        import webview  # noqa: F401
        if sys.platform == "win32":
            from webview.platforms import winforms  # noqa: F401  (laadt .NET en WebView2)
        regels.append("venster (pywebview): OK")
        regels.append("ZELFTEST GESLAAGD")
        code = 0
    except Exception:
        regels.append(traceback.format_exc())
        regels.append("ZELFTEST MISLUKT")
        code = 1
    Path(logpad).write_text("\n".join(regels) + "\n", encoding="utf-8")
    return code


def main():
    if "--zelftest" in sys.argv:
        i = sys.argv.index("--zelftest")
        logpad = sys.argv[i + 1] if len(sys.argv) > i + 1 else "zelftest.txt"
        sys.exit(zelftest(logpad))

    _logbestand()
    try:
        _bereid_pango_voor()
        poort, draait_al = _kies_poort()
        server = None if draait_al else _start_server(poort)
        print(f"server op poort {poort}{' (draaide al)' if draait_al else ''}", flush=True)
    except Exception:
        _meld_fout(traceback.format_exc())
        sys.exit(1)
    url = f"http://127.0.0.1:{poort}/"
    try:
        try:
            _met_venster(url, Api(poort))
        except Exception:
            print("venster werkt niet, terugval naar de browser:", flush=True)
            traceback.print_exc()
            _zonder_venster(url)
    except Exception:
        _meld_fout(traceback.format_exc())
    finally:
        if server:
            server.shutdown()
        print("--- gestopt", flush=True)


if __name__ == "__main__":
    main()
