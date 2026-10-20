"""Taalsuggesties zonder AI: herhaalde woorden per hoofdstuk aanwijzen.

Twee soorten herhaling:
- vaak: een woord komt in het hoofdstuk opvallend vaak voor;
- dichtbij: hetzelfde woord staat binnen een paar zinnen opnieuw.

Woorden worden niet tot hun stam teruggebracht: "looked" en "looks" tellen apart.
"""

import json
import re
from collections import defaultdict
from pathlib import Path

HIER = Path(__file__).parent
SYNONIEMEN = {
    "en": json.loads((HIER / "synoniemen-en.json").read_text(encoding="utf-8")),
    "nl": json.loads((HIER / "synoniemen.json").read_text(encoding="utf-8")),
}
WOORD = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*")

# Functiewoorden die je niet kunt (of hoeft te) vermijden.
STOPWOORDEN = {
    "en": set("""
the a an and or but nor so yet for of in on at to from by with without about above below
into onto out over under up down off through between among against around before after
behind beyond during until since toward towards within upon near across along
i me my mine myself you your yours yourself he him his himself she her hers herself
it its itself we us our ours ourselves they them their theirs themselves
this that these those there here who whom whose which what where when why how
is am are was were be been being have has had having do does did done
will would shall should can could may might must
not no yes all any some each every both either neither one ones other another such
than too also as if because while though although whether
i'm i've i'd i'll you're you've you'd you'll he's he'd he'll she's she'd she'll
it's we're we've we'd we'll they're they've they'd they'll that's there's
don't doesn't didn't isn't aren't wasn't weren't won't wouldn't can't couldn't
shouldn't hasn't haven't hadn't let's oh okay ok
""".split()),
    "nl": set("""
de het een en of in op aan van voor met naar bij uit om tot door over onder tegen tussen
achter na zonder sinds langs binnen buiten boven beneden af mee toe heen terug
ik je jij u hij zij ze we wij mij me mijn jouw jou uw zijn haar hun hen ons onze jullie
zich zichzelf elkaar men iemand niemand iedereen alles niets
dit dat die deze daar hier er waar wanneer hoe wat wie welke welk waarom
was waren is ben bent wordt werd werden worden word geweest wezen
had hadden hebben heeft heb hebt gehad
kan kon konden kunnen kunt zou zouden zal zullen zult moet moest moesten moeten
wil wilde wilden willen wou mag mocht mochten mogen
niet geen ook al wel dan als zo te nog maar want omdat dus toch of hoewel terwijl
nu net pas zelfs ja nee oké
""".split()),
}

DICHTBIJ_WOORDEN = 40   # binnen zoveel woorden telt een herhaling als "dichtbij"
VAAK_MINIMUM = 5         # minstens zo vaak in het hoofdstuk
VAAK_PER_WOORDEN = 300   # en minstens één keer per zoveel woorden


def _taalgroep(taal: str) -> str:
    return "nl" if str(taal).startswith("nl") else "en"


def _utf16_posities(tekst: str):
    """Zet Python-indexen om naar UTF-16-indexen (zoals JavaScript telt)."""
    if all(ord(c) < 0x10000 for c in tekst):
        return lambda i: i
    kaart, n = [], 0
    for c in tekst:
        kaart.append(n)
        n += 2 if ord(c) >= 0x10000 else 1
    kaart.append(n)
    return lambda i: kaart[i]


def herhalingen(tekst: str, negeer=(), taal: str = "en_US") -> list:
    groep = _taalgroep(taal)
    stopwoorden, synoniemen = STOPWOORDEN[groep], SYNONIEMEN[groep]
    negeer = {n.lower() for n in negeer}
    naar_utf16 = _utf16_posities(tekst)
    voorkomens = defaultdict(list)   # woord -> [(woordnummer, start, eind)]
    totaal = 0
    for m in WOORD.finditer(tekst):
        totaal += 1
        woord = m.group().lower().replace("’", "'")
        if len(woord) < 3 or woord in stopwoorden or woord in negeer:
            continue
        voorkomens[woord].append((totaal, m.start(), m.end()))

    drempel = max(VAAK_MINIMUM, totaal // VAAK_PER_WOORDEN)
    uit = []
    for woord, lijst in voorkomens.items():
        dichtbij = set()
        for (n1, s1, e1), (n2, s2, e2) in zip(lijst, lijst[1:]):
            if n2 - n1 <= DICHTBIJ_WOORDEN:
                dichtbij.update({(s1, e1), (s2, e2)})
        if len(lijst) < drempel and not dichtbij:
            continue
        uit.append({
            "woord": woord,
            "aantal": len(lijst),
            "dichtbij": len(dichtbij),
            "posities": [{"start": naar_utf16(s), "eind": naar_utf16(e),
                          "dichtbij": (s, e) in dichtbij} for _, s, e in lijst],
            "alternatieven": synoniemen.get(woord, []),
        })
    # Eerst wat het meest opvalt: dichtbij herhaald, dan vaak gebruikt.
    uit.sort(key=lambda h: (-h["dichtbij"], -h["aantal"], h["woord"]))
    return uit
