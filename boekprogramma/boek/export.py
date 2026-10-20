"""Het boek als A5-pagina's: HTML met CSS voor drukwerk, en met WeasyPrint naar PDF.

Opmaakregels in de hoofdstuktekst:
    elke regel        een alinea (de eerste na een kop of scènewissel springt niet in)
    *** of * * *      scènewissel
    ## Kop            tussenkop in een hoofdstuk
    > tekst           citaat, brief of gedicht (ingesprongen)
    *cursief*  _cursief_  **vet**
"""

import html
import re
from pathlib import Path

from . import opslag

A5_BREEDTE, A5_HOOGTE = 148, 210  # mm
LETTERMAP = Path(__file__).resolve().parent.parent / "lettertype"
LETTERTYPES = {
    "Literata": '"Literata", Georgia, serif',
    "Georgia": "Georgia, serif",
    "Times New Roman": '"Times New Roman", Times, serif',
    "Palatino": '"Palatino Linotype", Palatino, "Book Antiqua", serif',
    "Garamond": '"EB Garamond", Garamond, serif',
}
SCENEWISSEL = re.compile(r"^\s*(\*\s*\*\s*\*|-{3,}|#)\s*$")


class ExportFout(Exception):
    pass


def _inline(tekst: str) -> str:
    tekst = html.escape(tekst, quote=False)
    tekst = re.sub(r"\*\*(?=\S)(.+?)(?<=\S)\*\*", r"<strong>\1</strong>", tekst)
    tekst = re.sub(r"(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])", r"<em>\1</em>", tekst)
    tekst = re.sub(r"(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)", r"<em>\1</em>", tekst)
    return tekst


def tekst_naar_html(tekst: str) -> str:
    uit, citaat = [], []

    def sluit_citaat():
        if citaat:
            uit.append("<blockquote>" + "".join(f"<p>{c}</p>" for c in citaat) + "</blockquote>")
            citaat.clear()

    for regel in tekst.replace("\r\n", "\n").split("\n"):
        if regel.startswith(">"):
            citaat.append(_inline(regel[1:].strip()))
            continue
        sluit_citaat()
        if not regel.strip():
            continue
        if SCENEWISSEL.match(regel):
            uit.append('<p class="scenewissel">*&#8195;*&#8195;*</p>')
        elif regel.startswith("## "):
            uit.append(f"<h3>{_inline(regel[3:].strip())}</h3>")
        else:
            uit.append(f"<p>{_inline(regel.strip())}</p>")
    sluit_citaat()
    return "\n".join(uit)


def css(instellingen: dict, lettermap_url: str) -> str:
    e = instellingen
    letter = LETTERTYPES.get(e["lettertype"], LETTERTYPES["Literata"])
    tekstvlak_hoogte = A5_HOOGTE - e["marge_boven"] - e["marge_onder"]
    paginanummer = "counter(page)" if e["paginanummers"] else "none"
    return f"""
@font-face {{ font-family: "Literata"; font-style: normal; font-weight: 400; src: url("{lettermap_url}/Literata.ttf"); }}
@font-face {{ font-family: "Literata"; font-style: normal; font-weight: 700; src: url("{lettermap_url}/Literata.ttf"); }}
@font-face {{ font-family: "Literata"; font-style: italic; font-weight: 400; src: url("{lettermap_url}/Literata-Italic.ttf"); }}
@font-face {{ font-family: "Literata"; font-style: italic; font-weight: 700; src: url("{lettermap_url}/Literata-Italic.ttf"); }}

@page {{
  size: A5;
  margin: {e["marge_boven"]}mm {e["marge_buiten"]}mm {e["marge_onder"]}mm {e["marge_binnen"]}mm;
  @bottom-center {{ content: {paginanummer}; font-family: {letter}; font-size: {e["korps"] * 0.85:.2f}pt; }}
}}
@page :left {{ margin-left: {e["marge_buiten"]}mm; margin-right: {e["marge_binnen"]}mm; }}
@page :right {{ margin-left: {e["marge_binnen"]}mm; margin-right: {e["marge_buiten"]}mm; }}
@page voorwerk {{ @bottom-center {{ content: none; }} }}
@page kaart {{ @bottom-center {{ content: none; }} }}
@page :nth(1 of hoofdstuk) {{ @bottom-center {{ content: none; }} }}

html {{ font-family: {letter}; font-size: {e["korps"]}pt; line-height: {e["regelafstand"]}; }}
body {{ margin: 0; color: #000; }}
p {{ margin: 0; text-indent: 1.5em; orphans: 2; widows: 2;
     text-align: {"justify" if e["uitvullen"] else "left"};
     hyphens: {"auto" if e["afbreken"] else "manual"}; }}
h2 + p, h3 + p, .scenewissel + p, blockquote + p, p:first-child {{ text-indent: 0; }}
h3 {{ font-size: 1em; font-weight: 600; margin: 1.4em 0 0.6em; break-after: avoid; }}
.scenewissel {{ text-align: center; text-indent: 0; margin: 0.8em 0; break-after: avoid; }}
blockquote {{ margin: 0.8em 1.5em; font-style: italic; }}
blockquote p {{ text-indent: 0; }}
em {{ font-style: italic; }}
strong {{ font-weight: 700; }}

.titelpagina {{ page: voorwerk; text-align: center; padding-top: 30%; break-after: page; }}
.titelpagina h1 {{ font-size: 2.2em; font-weight: 500; line-height: 1.2; margin: 0 0 1em; hyphens: manual; }}
.titelpagina .auteur {{ font-size: 1.2em; text-indent: 0; text-align: center; }}

.inhoudsopgave {{ page: voorwerk; break-before: page; break-after: page; }}
.inhoudsopgave h2 {{ font-size: 1.3em; font-weight: 500; margin: 0 0 1.5em; }}
.inhoudsopgave ol {{ list-style: none; padding: 0; margin: 0; }}
.inhoudsopgave li {{ margin: 0 0 0.4em; }}
.inhoudsopgave a {{ color: inherit; text-decoration: none; }}
.inhoudsopgave a::after {{ content: leader(".") target-counter(attr(href), page); }}

.hoofdstuk {{ page: hoofdstuk; break-before: {"right" if e["hoofdstuk_rechts"] else "page"}; }}
.hoofdstuk > h2 {{ font-size: 1.5em; font-weight: 500; text-align: center; hyphens: manual;
                   margin: 25% 0 2em; line-height: 1.25; }}

.kaart {{ page: kaart; break-before: page; text-align: center; }}
.kaart img {{ max-width: 100%; max-height: {tekstvlak_hoogte - 12}mm; object-fit: contain; }}
.kaart .onderschrift {{ text-align: center; text-indent: 0; font-size: 0.85em; margin-top: 0.5em; }}

@media screen {{
  body {{ background: #ddd; }}
  .scherm-uitleg {{ font: 14px/1.4 system-ui, sans-serif; max-width: 148mm; margin: 1em auto;
                   background: #fffbe6; padding: 0.8em 1em; border: 1px solid #e6d98c; }}
}}
@media print {{ .scherm-uitleg {{ display: none; }} }}
"""


def maak_html(boek_id: str, lettermap_url: str, map_url, voor_browser: bool = False) -> str:
    boek = opslag.lees_boek(boek_id)
    e = boek["export"]
    hoofdstukken = opslag.lijst_hoofdstukken(boek_id)
    kaarten = [m for m in boek["maps"] if m.get("in_pdf")]
    delen = []

    if voor_browser:
        delen.append('<div class="scherm-uitleg"><b>Afdrukvoorbeeld.</b> Druk op Ctrl+P '
                     '(Mac: Cmd+P), kies <i>Opslaan als PDF</i>, papierformaat A5, '
                     'marges <i>Standaard</i>, en zet <i>Kopteksten en voetteksten</i> uit. '
                     'Paginanummers in de inhoudsopgave werken alleen in de echte PDF-export.</div>')
    if e["titelpagina"]:
        auteur = f'<p class="auteur">{html.escape(boek.get("auteur", ""))}</p>' if boek.get("auteur") else ""
        delen.append(f'<section class="titelpagina"><h1>{html.escape(boek["titel"])}</h1>{auteur}</section>')
    if e["inhoudsopgave"] and hoofdstukken:
        regels = "".join(f'<li><a href="#h-{h["id"]}">{html.escape(h["titel"])}</a></li>'
                         for h in hoofdstukken)
        delen.append(f'<section class="inhoudsopgave"><h2>Inhoud</h2><ol>{regels}</ol></section>')

    geplaatst = set()
    for h in hoofdstukken:
        for k in kaarten:
            if h["id"] in k.get("hoofdstukken", []) and k["id"] not in geplaatst:
                geplaatst.add(k["id"])
                delen.append(f'<section class="kaart"><img src="{map_url(k)}" alt="">'
                             f'<p class="onderschrift">{html.escape(k["titel"])}</p></section>')
        delen.append(f'<section class="hoofdstuk" id="h-{h["id"]}"><h2>{html.escape(h["titel"])}</h2>'
                     f'{tekst_naar_html(h["tekst"])}</section>')

    return (f'<!doctype html><html lang="nl"><head><meta charset="utf-8">'
            f'<title>{html.escape(boek["titel"])}</title><style>{css(e, lettermap_url)}</style></head>'
            f'<body>{"".join(delen)}</body></html>')


def maak_pdf(boek_id: str):
    """Geeft (pdf-bytes, aantal pagina's) terug."""
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as fout:
        raise ExportFout(
            "WeasyPrint werkt nog niet op deze computer (op Windows ontbreekt meestal GTK/Pango, "
            "zie README). Gebruik zolang het afdrukvoorbeeld en kies 'Opslaan als PDF'. "
            f"Technische melding: {fout}")
    boekmap = opslag.boekpad(boek_id)
    document = HTML(string=maak_html(boek_id, LETTERMAP.as_uri(),
                                     lambda k: (boekmap / "maps" / k["bestand"]).as_uri()),
                    base_url=str(boekmap)).render()
    return document.write_pdf(), len(document.pages)
