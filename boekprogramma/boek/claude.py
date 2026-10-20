"""Optionele Claude-koppeling: zinsuggesties en een chatpaneel over het open hoofdstuk.

Werkt alleen met een eigen API-sleutel (console.anthropic.com). Elk verzoek kost
geld; het antwoord bevat daarom het tokengebruik en een kostenschatting.
"""

import os

from . import opslag

MODEL = "claude-opus-5-5"
PRIJS_INVOER = 4.00 / 1_000_000     # dollar per token
PRIJS_UITVOER = 20.00 / 1_000_000
PRIJS_CACHE_LEZEN = 0.20 / 1_000_000
PRIJS_CACHE_SCHRIJVEN = PRIJS_INVOER * 1.25

TAALNAAM = {"en_US": "Amerikaans-Engels", "en_GB": "Brits-Engels", "nl": "Nederlands"}


def basis(taal):
    return (
        f"Je helpt een schrijver met een boek in het {TAALNAAM.get(taal, 'Engels')}. "
        "De schrijver schrijft zelf; jij geeft feedback en voorstellen, je schrijft geen hele "
        "passages over. Leg uit en antwoord in het Nederlands, kort en concreet; voorbeeldzinnen "
        "en herschreven zinnen staan in de taal van het boek. Respecteer de stijl en stem van "
        "de schrijver."
    )


class GeenSleutel(Exception):
    pass


def sleutel():
    return os.environ.get("ANTHROPIC_API_KEY") or opslag.lees_instellingen().get("anthropic_api_key")


def beschikbaar() -> bool:
    return bool(sleutel())


def _client():
    if not beschikbaar():
        raise GeenSleutel("Geen API-sleutel ingesteld (Instellingen).")
    import anthropic
    return anthropic.Anthropic(api_key=sleutel())


def _vraag(system, messages, max_tokens, effort):
    response = _client().beta.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
        output_config={"effort": effort},
        # Weigert het model een verzoek, dan probeert de API het zelf op een ander model.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        tekst = "Claude wilde hier niet op antwoorden."
    else:
        tekst = "".join(b.text for b in response.content if b.type == "text").strip()
    u = response.usage
    gelezen = getattr(u, "cache_read_input_tokens", 0) or 0
    geschreven = getattr(u, "cache_creation_input_tokens", 0) or 0
    kosten = (u.input_tokens * PRIJS_INVOER + u.output_tokens * PRIJS_UITVOER
              + gelezen * PRIJS_CACHE_LEZEN + geschreven * PRIJS_CACHE_SCHRIJVEN)
    return tekst, {"invoer": u.input_tokens + gelezen + geschreven, "uitvoer": u.output_tokens,
                   "kosten_dollar": round(kosten, 4)}


def herschrijf_zin(zin: str, context: str = "", taal: str = "en_US") -> dict:
    vraag = (f"Context (de alinea eromheen):\n{context}\n\n" if context else "") + (
        f"Geef drie alternatieven voor deze zin in het {TAALNAAM.get(taal, 'Engels')}, elk op een "
        f"eigen regel, zonder nummering of uitleg. Houd de betekenis gelijk en maak de taal "
        f"levendiger of preciezer.\n\n"
        f"Zin: {zin}")
    tekst, gebruik = _vraag(basis(taal), [{"role": "user", "content": vraag}], 1000, "low")
    voorstellen = [r.strip(" -•\t") for r in tekst.splitlines() if r.strip(" -•\t")][:3]
    return {"voorstellen": voorstellen, "gebruik": gebruik}


def chat(hoofdstuk: dict, gesprek: list, taal: str = "en_US") -> dict:
    system = [
        {"type": "text", "text": basis(taal)},
        {"type": "text",
         "text": f"Het hoofdstuk dat open staat heet \"{hoofdstuk['titel']}\":\n\n{hoofdstuk['tekst']}",
         # Het hoofdstuk blijft gelijk tijdens een gesprek; zo betaal je het maar één keer vol.
         "cache_control": {"type": "ephemeral"}},
    ]
    messages = [{"role": b["rol"], "content": str(b["tekst"])} for b in gesprek
                if b.get("rol") in ("user", "assistant") and str(b.get("tekst", "")).strip()]
    if not messages or messages[-1]["role"] != "user":
        raise ValueError("Het gesprek moet eindigen met een vraag")
    tekst, gebruik = _vraag(system, messages, 4000, "medium")
    return {"antwoord": tekst, "gebruik": gebruik}
