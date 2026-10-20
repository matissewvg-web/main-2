"""Spellingscontrole met hunspell-woordenboeken, gelezen door spylls (hunspell in
pure Python, dus geen C-bibliotheek nodig).

    en_US  Engels (VS), SCOWL       woordenboek/en_US.*
    en_GB  Engels (VK, -ise), SCOWL woordenboek/en_GB.*
    nl     Nederlands, OpenTaal     woordenboek/nl.*

Let op: dit vindt woorden die niet bestaan. Het vindt geen fouten in zinsbouw,
geen verkeerd gebruikte bestaande woorden (their/there, word/wordt) en geen stijl.
"""

import re
import threading
from functools import lru_cache
from pathlib import Path

WOORDENBOEKEN = Path(__file__).resolve().parent.parent / "woordenboek"
TALEN = {"en_US": "Engels (VS)", "en_GB": "Engels (VK)", "nl": "Nederlands"}
STANDAARDTAAL = "en_US"
WOORD = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")

_woordenboeken = {}
_laden = threading.Lock()


def _taal(taal):
    return taal if taal in TALEN else STANDAARDTAAL


def woordenboek(taal=STANDAARDTAAL):
    taal = _taal(taal)
    if taal not in _woordenboeken:
        with _laden:
            if taal not in _woordenboeken:
                from spylls.hunspell import Dictionary
                _woordenboeken[taal] = Dictionary.from_files(str(WOORDENBOEKEN / taal))
    return _woordenboeken[taal]


def laad_op_achtergrond(taal=STANDAARDTAAL) -> None:
    """Een woordenboek laden duurt even; doe dat bij het opstarten."""
    threading.Thread(target=woordenboek, args=(taal,), daemon=True).start()


@lru_cache(maxsize=200_000)
def _bestaat(woord: str, taal: str) -> bool:
    wb = woordenboek(taal)
    if wb.lookup(woord):
        return True
    if "-" in woord:
        return all(wb.lookup(deel) for deel in woord.split("-") if deel)
    return False


def _utf16_lengte(tekst: str) -> int:
    return len(tekst.encode("utf-16-le")) // 2


def controleer(tekst: str, eigen_woorden=(), taal=STANDAARDTAAL) -> list:
    """Geef de foute woorden met hun positie terug. Posities zijn in UTF-16-
    eenheden, zodat ze in de browser direct op de tekst passen."""
    taal = _taal(taal)
    eigen = {w.lower() for w in eigen_woorden}
    fouten = []
    vorige, utf16 = 0, 0
    for m in WOORD.finditer(tekst):
        woord = m.group().replace("’", "'")
        if len(woord) < 2 or woord.lower() in eigen or _bestaat(woord, taal):
            continue
        utf16 += _utf16_lengte(tekst[vorige:m.start()])
        lengte = _utf16_lengte(m.group())
        fouten.append({"start": utf16, "eind": utf16 + lengte, "woord": m.group()})
        vorige, utf16 = m.end(), utf16 + lengte
    return fouten


@lru_cache(maxsize=2_000)
def suggesties(woord: str, taal: str = STANDAARDTAAL, maximum: int = 6) -> list:
    uit = []
    for s in woordenboek(taal).suggest(woord.replace("’", "'")):
        if s not in uit:
            uit.append(s)
        if len(uit) >= maximum:
            break
    return uit
