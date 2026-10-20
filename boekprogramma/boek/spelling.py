"""Nederlandse spellingscontrole met het OpenTaal-woordenboek (hunspell-formaat),
gelezen door spylls (hunspell in pure Python, dus geen C-bibliotheek nodig).

Let op: dit vindt woorden die niet bestaan. Het vindt geen fouten in zinsbouw,
geen verkeerd gebruikte bestaande woorden (word/wordt, hun/hen) en geen stijl.
"""

import re
import threading
from functools import lru_cache
from pathlib import Path

WOORDENBOEK = Path(__file__).resolve().parent.parent / "woordenboek" / "nl"
WOORD = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")

_woordenboek = None
_laden = threading.Lock()


def woordenboek():
    global _woordenboek
    if _woordenboek is None:
        with _laden:
            if _woordenboek is None:
                from spylls.hunspell import Dictionary
                _woordenboek = Dictionary.from_files(str(WOORDENBOEK))
    return _woordenboek


def laad_op_achtergrond() -> None:
    """Het woordenboek laden duurt een paar seconden; doe dat bij het opstarten."""
    threading.Thread(target=woordenboek, daemon=True).start()


@lru_cache(maxsize=200_000)
def _bestaat(woord: str) -> bool:
    wb = woordenboek()
    if wb.lookup(woord):
        return True
    if "-" in woord:
        return all(wb.lookup(deel) for deel in woord.split("-") if deel)
    return False


def _utf16_lengte(tekst: str) -> int:
    return len(tekst.encode("utf-16-le")) // 2


def controleer(tekst: str, eigen_woorden=()) -> list:
    """Geef de foute woorden met hun positie terug. Posities zijn in UTF-16-
    eenheden, zodat ze in de browser direct op de tekst passen."""
    eigen = {w.lower() for w in eigen_woorden}
    fouten = []
    vorige, utf16 = 0, 0
    for m in WOORD.finditer(tekst):
        woord = m.group().replace("’", "'")
        if len(woord) < 2 or woord.lower() in eigen or _bestaat(woord):
            continue
        utf16 += _utf16_lengte(tekst[vorige:m.start()])
        lengte = _utf16_lengte(m.group())
        fouten.append({"start": utf16, "eind": utf16 + lengte, "woord": m.group()})
        vorige, utf16 = m.end(), utf16 + lengte
    return fouten


@lru_cache(maxsize=2_000)
def suggesties(woord: str, maximum: int = 6) -> list:
    uit = []
    for s in woordenboek().suggest(woord.replace("’", "'")):
        if s not in uit:
            uit.append(s)
        if len(uit) >= maximum:
            break
    return uit
