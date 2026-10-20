"""Bouw Boekschrijfprogramma.exe met PyInstaller (draai dit op Windows).

    pip install -r requirements.txt -r requirements-exe.txt
    python bouw_exe.py

Staan de mappen gtk/ (Pango-DLL's) en fonts/ (fontconfig) hiernaast, dan gaan
die mee in de .exe, zodat de PDF-export zonder extra installatie werkt. De
GitHub Actions-workflow vult ze vanuit MSYS2.
"""

import os
import sys
from pathlib import Path

import PyInstaller.__main__

HIER = Path(__file__).resolve().parent
os.chdir(HIER)


def maak_icoon(pad: Path) -> bool:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return False
    grootte = 256
    beeld = Image.new("RGBA", (grootte, grootte), (0, 0, 0, 0))
    teken = ImageDraw.Draw(beeld)
    teken.rounded_rectangle((16, 16, 240, 240), radius=44, fill=(138, 75, 42))
    teken.rounded_rectangle((60, 52, 196, 204), radius=10, fill=(255, 253, 249))
    teken.rectangle((60, 52, 78, 204), fill=(225, 205, 190))
    letter = ImageFont.truetype(str(HIER / "lettertype" / "Literata.ttf"), 112)
    teken.text((137, 130), "B", font=letter, fill=(138, 75, 42), anchor="mm")
    beeld.save(pad, sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    return True


def main():
    sep = os.pathsep
    args = [
        "desktop.py",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name", "Boekschrijfprogramma",
        "--add-data", f"static{sep}static",
        "--add-data", f"lettertype{sep}lettertype",
        "--add-data", f"woordenboek{sep}woordenboek",
        "--add-data", f"boek/synoniemen.json{sep}boek",
        "--collect-data", "weasyprint",
        "--collect-data", "pyphen",
        "--collect-submodules", "spylls",
        "--collect-submodules", "webview",
        "--hidden-import", "app",
    ]
    for map_ in ("gtk", "fonts"):
        if (HIER / map_).is_dir():
            args += ["--add-binary" if map_ == "gtk" else "--add-data", f"{map_}{sep}{map_}"]
        elif sys.platform == "win32":
            print(f"Let op: map {map_}/ ontbreekt; de PDF-export werkt dan alleen met een eigen Pango-installatie.")
    icoon = HIER / "build" / "icoon.ico"
    icoon.parent.mkdir(exist_ok=True)
    if maak_icoon(icoon):
        args += ["--icon", str(icoon)]
    PyInstaller.__main__.run(args)


if __name__ == "__main__":
    main()
