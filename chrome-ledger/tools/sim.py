#!/usr/bin/env python3
"""CHROME LEDGER engine. De GM (Claude) bewerkt state.json; deze engine doet economie,
rivalen, events, mails en rapport. Jij hebt geen invloed op de dobbelstenen.

Gebruik: python tools/sim.py <commando>
  tick                         speel een maand (alleen als status 'actief' is)
  roll <NdM+X>                 dobbelsteen, wordt gelogd in game/rolls.txt
  status                       korte stand
  inbox [alles]                ongelezen mails tonen en als gelezen markeren
  kaart                        districten, controle en rivalen-HQ's
  rivalen                      wat het bedrijf over rivalen weet (cash is een schatting)
  transfer <van> <naar> <k€>   geld tussen operationeel/zwart/offshore (fee + controlerisico)
  lening <k€>                  lening bij de bank in de Oude Stad
  aflossen <k€>                schuld aflossen
  check                        state.json controleren na handmatige bewerking
  save                         backup naar game/saves/
  load <bestand>               save terugzetten (huidige stand wordt eerst bewaard)
  nieuw                        nieuw spel (huidige stand wordt eerst bewaard)
"""
import ast, datetime, json, os, random, re, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # Windows-console: € en ë
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(ROOT, "game")
STATE = os.path.join(G, "state.json")
TEMPLATE = os.path.join(G, "state.template.json")
INBOX = os.path.join(G, "inbox")
LOG = os.path.join(G, "log.md")
MAP = os.path.join(G, "map.md")
SAVES = os.path.join(G, "saves")
CUSTOM = os.path.join(G, "events_custom.json")
ROLLS = os.path.join(G, "rolls.txt")

DIFF = {"Casual": 0.8, "Realistisch": 1.0, "Genadeloos": 1.3}
ACCOUNTS = ("operationeel", "zwart", "offshore")

# Divisie-types: omzet per niveau/maand, kosten per niveau/maand, heat per niveau, volatiliteit
DIVISION_TYPES = {
    "Biotech":          {"rev": 9, "cost": 6, "heat": 1, "vol": 0.35},
    "Cyberware":        {"rev": 11, "cost": 7, "heat": 2, "vol": 0.40},
    "Logistiek":        {"rev": 7, "cost": 4, "heat": 0, "vol": 0.15},
    "Media & Data":     {"rev": 8, "cost": 4, "heat": 1, "vol": 0.30},
    "Private Security": {"rev": 8, "cost": 5, "heat": 2, "vol": 0.20},
    "Financieel":       {"rev": 10, "cost": 5, "heat": 1, "vol": 0.45},
    "Smokkel":          {"rev": 14, "cost": 4, "heat": 4, "vol": 0.50},
}

# Events: prob = kans per maand (0-1), when = voorwaarde, effect = wijzigingen, rest = mail.
# Faction-modifiers: vakbond en politie veranderen de kans (zie event_prob).
EVENTS = [
    {"id": "staking", "prob": 0.07, "when": "morale < 45 or vakbond < -40",
     "effect": {"cash_pct": -0.04, "morale": -5, "reputation": -3},
     "from": "HR", "subject": "Wilde staking in {district}", "prio": "HOOG",
     "body": "Morale is te laag. De ploeg legt het werk neer. Elke dag stilstand kost geld. De vakbond wil praten, niet drinken."},
    {"id": "audit", "prob": 0.08, "when": "heat > 35",
     "effect": {"cash_pct": -0.06, "heat": -8, "reputation": -2},
     "from": "Juridische Zaken", "subject": "Onaangekondigde inspectie", "prio": "HOOG",
     "body": "De toezichthouder staat in de lobby met een rechter-commissaris en veel tijd. Boetes volgen. Als je heat hoog blijft, komt hij terug."},
    {"id": "datalek", "prob": 0.05, "when": "True",
     "effect": {"reputation": -6, "cash": -15},
     "from": "Head of Security", "subject": "Datalek, bron onbekend", "prio": "HOOG",
     "body": "Klantgegevens zijn te koop op een forum. Ik weet nog niet of het intern of extern is. Vertrouw niemand met toegang tot de serverkamer."},
    {"id": "beurspiek", "prob": 0.07, "when": "True",
     "effect": {"cash_pct": 0.05, "reputation": 2},
     "from": "CFO", "subject": "Markt trekt aan", "prio": "NORMAAL",
     "body": "Sector-optimisme verhoogt de omzet. Het gaat vanzelf weer weg. Houd cash, geen illusies."},
    {"id": "recessie", "prob": 0.05, "when": "True",
     "effect": {"cash_pct": -0.05, "morale": -2},
     "from": "CFO", "subject": "Kredietmarkt droogt op", "prio": "HOOG",
     "body": "Banken sluiten de kraan. Omzet daalt, schulden niet."},
    {"id": "talent", "prob": 0.06, "when": "reputation > 40",
     "effect": {"morale": 4, "reputation": 1},
     "from": "HR", "subject": "Een toptalent solliciteert", "prio": "NORMAAL",
     "body": "Een ex-onderzoeker van een rivaal wil bij ons werken. Salaris is niet laag. Motieven ook niet duidelijk."},
    {"id": "schandaal", "prob": 0.05, "when": "heat > 25",
     "effect": {"reputation": -10, "heat": 5},
     "from": "PR", "subject": "Journalist weet iets", "prio": "HOOG",
     "body": "Een freelancer belt over een 'patroon in de cijfers'. We kunnen bellen, betalen of zwijgen. Alle drie hebben een prijs."},
    {"id": "sabotage", "prob": 0.06, "when": "max_agressie > 0.5",
     "effect": {"cash": -20, "morale": -3},
     "from": "Anoniem", "subject": "Brand in magazijn", "prio": "HOOG",
     "body": "Geen dodelijke slachtoffers. Wel een brief: 'dit was maar een proefrun.'"},
]


# ---------- bestanden ----------
def load(path=STATE):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(s, path=STATE):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)  # nooit een half geschreven state.json


def clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


def ym(s):
    return f"{s['date']['year']}-{s['date']['month']:02d}"


# ---------- dobbelstenen ----------
def roll(spec, why=""):
    m = re.fullmatch(r"(\d+)d(\d+)([+-]\d+)?", spec.replace(" ", ""))
    if not m or int(m.group(1)) < 1 or int(m.group(2)) < 1:
        print("Gebruik: roll 2d6+1 [reden]")
        return None
    n, d, mod = int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)
    rolls = [random.randint(1, d) for _ in range(n)]
    total = sum(rolls) + mod
    line = f"{spec}: {rolls} {mod:+d} = {total}"
    print(line)
    try:
        when = ym(load()) if os.path.exists(STATE) else "-"
        os.makedirs(G, exist_ok=True)
        with open(ROLLS, "a", encoding="utf-8") as f:
            f.write(f"{datetime.datetime.now():%Y-%m-%d %H:%M:%S} | spel {when} | {line}{' | ' + why if why else ''}\n")
    except Exception:
        pass
    return total


# ---------- mails ----------
def add_mail(s, frm, subject, body, prio="NORMAAL", to=None):
    os.makedirs(INBOX, exist_ok=True)
    y, mth = s["date"]["year"], s["date"]["month"]
    slug = re.sub(r"[^a-z0-9]+", "-", subject.lower()).strip("-")[:40] or "mail"
    name = f"{y}-{mth:02d}_{slug}.md"
    n = 2
    while os.path.exists(os.path.join(INBOX, name)):
        name = f"{y}-{mth:02d}_{slug}-{n}.md"
        n += 1
    with open(os.path.join(INBOX, name), "w", encoding="utf-8") as f:
        f.write(f"**Van:** {frm}\n**Aan:** {to or s['player']['title']}\n**Datum:** {y}-{mth:02d}\n"
                f"**Onderwerp:** {subject}\n**Prioriteit:** {prio}\n\n{body}\n")
    return name


def advance_date(s):
    d = s["date"]
    d["month"] += 1
    if d["month"] > 12:
        d["month"] = 1
        d["year"] += 1


def apply_effect(s, eff):
    s["cash"] = round(s["cash"] + eff.get("cash", 0) + s["cash"] * eff.get("cash_pct", 0), 1)
    for k in ("heat", "morale", "reputation"):
        if k in eff:
            s[k] = clamp(s[k] + eff[k])
    for fac, delta in eff.get("factions", {}).items():
        world.shift_faction(s, fac, delta)
    for k, v in eff.get("flags", {}).items():
        s["flags"][k] = v


# ---------- voorwaarden voor events (veilig, geen vrije Python) ----------
_ALLOWED = (ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.USub,
            ast.Compare, ast.Gt, ast.Lt, ast.GtE, ast.LtE, ast.Eq, ast.NotEq, ast.In, ast.NotIn,
            ast.Name, ast.Load, ast.Constant, ast.Subscript, ast.BinOp, ast.Add, ast.Sub,
            ast.Mult, ast.Div, ast.Index if hasattr(ast, "Index") else ast.Constant)


def cond_context(s):
    ctx = {k: s.get(k, 0) for k in ("cash", "debt", "heat", "reputation", "morale")}
    ctx.update({k: v.get("standing", 0) for k, v in s.get("factions", {}).items()})
    ctx.update({
        "year": s["date"]["year"], "month": s["date"]["month"],
        "staff": s["staff"]["count"], "flags": s.get("flags", {}),
        "divisies": [d["type"] for d in s.get("divisions", [])],
        "districten": [d["id"] for d in s.get("districts", []) if d.get("control") == "player"],
        "max_agressie": max([r["aggression"] for r in s.get("rivals", [])] or [0]),
        "zwart": s.get("accounts", {}).get("zwart", 0), "offshore": s.get("accounts", {}).get("offshore", 0),
        "True": True, "False": False,
    })
    return ctx


def check_cond(expr, s):
    """Voorbeelden: 'heat > 35', 'morale < 45 or vakbond < -40', '"Cyberware" in divisies',
    'flags["nomad_contract"] == True', '"G" in districten'."""
    if expr in (None, "", True):
        return True
    tree = ast.parse(str(expr), mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED):
            raise ValueError(f"niet toegestaan in voorwaarde: {type(node).__name__}")
    ctx = cond_context(s)
    flags = ctx["flags"]

    class _Flags(dict):
        def __missing__(self, k):
            return None
    ctx["flags"] = _Flags(flags)
    return bool(eval(compile(tree, "<voorwaarde>", "eval"), {"__builtins__": {}}, ctx))


def event_prob(s, e, diff):
    p = e["prob"] * diff
    if e.get("id") == "staking":
        p *= 1.5 if world.faction(s, "vakbond") < -30 else (0.6 if world.faction(s, "vakbond") > 30 else 1)
    if e.get("id") == "audit":
        p *= 0.5 if world.faction(s, "politie") > 30 else (1.4 if world.faction(s, "politie") < -30 else 1)
    return p


def load_custom_events():
    if not os.path.exists(CUSTOM):
        return [], []
    errors = []
    try:
        with open(CUSTOM, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as ex:
        return [], [f"events_custom.json is geen geldige JSON: {ex}"]
    out = []
    for i, e in enumerate(data if isinstance(data, list) else []):
        missing = [k for k in ("prob", "from", "subject", "body") if k not in e]
        if missing:
            errors.append(f"custom event #{i} ({e.get('id', '?')}) mist: {', '.join(missing)}")
            continue
        e.setdefault("effect", {})
        e.setdefault("when", "True")
        out.append(e)
    return out, errors


# ---------- kaart ----------
def map_status(s):
    hq = {}
    for r in s["rivals"]:
        hq.setdefault(r.get("hq"), []).append(r["name"])
    lines = ["| ID | Naam | Controle | Rivalen-HQ | Inkomen/onderhoud |", "|---|---|---|---|---|"]
    for d in s["districts"]:
        c = d.get("control", "neutral")
        mark = {"player": "`*` jij", "neutral": "-", "contested": "`?` betwist"}.get(c, f"`x` {c}")
        thuis = " (thuis)" if s["player"].get("home_district") == d["id"] else ""
        lines.append(f"| {d['id']} | {d['name']}{thuis} | {mark} | {', '.join(hq.get(d['id'], [])) or '-'} | "
                     f"{d.get('income', 0)} / {d.get('upkeep', 0)} |")
    return "\n".join(lines)


def update_map(s):
    if not os.path.exists(MAP):
        return
    with open(MAP, encoding="utf-8") as f:
        txt = f.read()
    block = f"<!-- STATUS (automatisch, niet bewerken) -->\n*Stand {ym(s)}*\n\n{map_status(s)}\n<!-- /STATUS -->"
    if "<!-- STATUS" in txt:
        txt = re.sub(r"<!-- STATUS.*?<!-- /STATUS -->", lambda _: block, txt, flags=re.S)
    else:
        txt = txt.rstrip() + "\n\n## Huidige stand\n" + block + "\n"
    with open(MAP, "w", encoding="utf-8") as f:
        f.write(txt)


# ---------- de maand ----------
def tick():
    if not os.path.exists(STATE):
        print("Geen state.json. Draai 'python tools/sim.py nieuw'.")
        return
    s = load()
    if not s.get("setup_done"):
        print("Setup niet klaar. Doe eerst de setup.")
        return
    if s.get("status", "actief") != "actief":
        print(f"GAME OVER: {s['status']}. Er wordt niet meer getickt. "
              f"Laad een save ('load <bestand>') of begin opnieuw ('nieuw').")
        return
    problems = validate(s)
    if problems:
        print("state.json heeft fouten, eerst oplossen:\n- " + "\n- ".join(problems))
        return
    diff = DIFF.get(s["player"].get("difficulty", "Realistisch"), 1.0)
    world.migrate(s)
    played = ym(s)
    rep = []
    start_cash = s["cash"]

    # 1. Divisies
    rev = cost = heat_add = 0.0
    lines = []
    for d in s["divisions"]:
        t = DIVISION_TYPES.get(d["type"], {"rev": 6, "cost": 4, "heat": 1, "vol": 0.3})
        lvl = d["level"]
        eff = d.get("efficiency", 1.0) * (0.6 + 0.4 * s["morale"] / 100)
        swing = 1 + random.uniform(-t["vol"], t["vol"])
        r = t["rev"] * lvl * eff * swing * world.market_rev_mult(s, d["type"])
        c = t["cost"] * lvl * diff * world.division_cost_mult(s, d["type"])
        rev += r
        cost += c
        heat_add += t["heat"] * lvl * 0.5
        lines.append(f"| {d.get('name', d['type'])} ({d['type']} L{lvl}) | {round(r, 1)} | {round(c, 1)} |")
    for dist in s["districts"]:
        if dist.get("control") == "player":
            rev += dist.get("income", 0) * random.uniform(0.85, 1.15)
            cost += dist.get("upkeep", 0)
    payroll = s["staff"]["count"] * s["staff"]["avg_salary"] / 12.0 * 0.1
    cost += payroll + s["culture"].get("bonus_cost", 0)
    interest = s["debt"] * s["interest_rate"] / 12.0
    cost += interest
    proj_cost = sum(p.get("cost_per_month", 0) for p in s["projects"])
    cost += proj_cost

    net = round(rev - cost, 1)
    s["cash"] = round(s["cash"] + net, 1)

    # 2. Heat, morale, reputatie
    s["heat"] = clamp(s["heat"] + heat_add - s["culture"].get("heat_decay", 2))
    morale_drift = s["culture"].get("morale_drift", 0) + (1 if net > 0 else -2)
    if s["culture"].get("layoff_policy") == "hard":
        morale_drift -= 2
    s["morale"] = clamp(s["morale"] + morale_drift + random.uniform(-2, 2))
    s["reputation"] = clamp(s["reputation"] + (0.5 if net > 0 else -1) - s["heat"] / 60.0)

    # 3. Projecten
    for p in list(s["projects"]):
        p["eta_months"] -= 1
        if p["eta_months"] <= 0:
            s["projects"].remove(p)
            add_mail(s, "COO", f"Project klaar: {p['name']}", p.get("done_msg", "Opgeleverd. Kijk wat het oplevert."))
            rep.append(f"Project klaar: {p['name']}")
            oc = p.get("on_complete", {})
            if "new_division" in oc:
                s["divisions"].append(oc["new_division"])
            if "upgrade_division" in oc:
                for d in s["divisions"]:
                    if d.get("name") == oc["upgrade_division"]:
                        d["level"] += oc.get("levels", 1)
            if "district_control" in oc:
                for dd in s["districts"]:
                    if dd["id"] == oc["district_control"]:
                        dd["control"] = "player"
            apply_effect(s, oc.get("effect", {}))

    # 4. Rivalen
    for r in s["rivals"]:
        r["cash"] = round(r["cash"] * (1 + random.uniform(-0.03, 0.06)), 1)
        if s["heat"] > 40:
            r["memory"].append(f"{played}: speler heeft hoge heat")
            r["memory"] = r["memory"][-12:]
            r["aggression"] = round(clamp(r["aggression"] + 0.05, 0, 1), 2)
        if random.random() < 0.1 + r["aggression"] * 0.12:
            move = random.choice(["overname-bod", "spionage", "prijsoorlog", "lobby"])
            if move == "overname-bod" and r["cash"] > s["cash"] * 1.5 and s["cash"] < 50:
                add_mail(s, r["ceo"], "Vriendelijk voorstel", f"{r['name']} biedt aan je bedrijf te 'redden'. Lees tussen de regels. Dit is een bod, geen vriendschap.", "HOOG")
                s["flags"]["reddingsbod_" + r["name"]] = played
                rep.append(f"{r['name']} doet overname-bod")
            elif move == "spionage":
                add_mail(s, "Head of Security", f"Spionageactiviteit door {r['name']}?", "Ongeautoriseerde toegang tot een testserver. Ik kan het niet bewijzen. Nog niet.", "NORMAAL")
                s["flags"]["spionage_" + r["name"]] = played
            elif move == "prijsoorlog":
                s["cash"] = round(s["cash"] - random.randint(3, 10) * diff, 1)
                r["cash"] = round(r["cash"] - random.randint(3, 10), 1)
                rep.append(f"Prijsoorlog met {r['name']}")
            elif move == "lobby":
                s["reputation"] = clamp(s["reputation"] - 2)
                rep.append(f"{r['name']} lobbyt tegen je")

    # 5. Events
    custom, errors = load_custom_events()
    for err in errors:
        print("LET OP:", err)
    for e in EVENTS + custom:
        try:
            ok = check_cond(e.get("when", "True"), s)
        except Exception as ex:
            print(f"LET OP: voorwaarde van event '{e.get('id', e['subject'])}' klopt niet ({ex}); overgeslagen.")
            continue
        if ok and random.random() < event_prob(s, e, diff):
            apply_effect(s, e["effect"])
            dist = random.choice(s["districts"])["name"]
            subj = e["subject"].replace("{district}", dist)
            add_mail(s, e["from"], subj, e["body"].replace("{district}", dist), e.get("prio", "NORMAAL"))
            rep.append(f"Event: {subj}")

    # 5b. Wereldlaag: facturen, markt, facties, personeel, chaos, geruchten, verhaalbogen
    world.world_tick(s, diff, add_mail, rep)

    # 6. Faalcondities
    status = "actief"
    if s["cash"] < 0:
        s["flags"]["negatieve_cash_maanden"] = s["flags"].get("negatieve_cash_maanden", 0) + 1
        left = 3 - s["flags"]["negatieve_cash_maanden"]
        add_mail(s, "CFO", "Cash is negatief",
                 "We betalen onze leveranciers met rente. "
                 + (f"Nog {left} maand(en) zo en de rechtbank beslist voor ons." if left > 0 else "Het is op."), "KRITIEK")
        if s["flags"]["negatieve_cash_maanden"] >= 3:
            status = "FAILLIET"
    else:
        s["flags"]["negatieve_cash_maanden"] = 0
    if s["morale"] < 10 and random.random() < 0.3:
        status = "COUP IN DE RAAD"
    elif s["morale"] < 20:
        add_mail(s, "Anoniem", "De raad vergadert zonder u", "Drie bestuursleden lunchten gisteren samen. U stond niet op de lijst.", "HOOG")
    if s["heat"] > 90 and random.random() < 0.25:
        status = "RAZZIA / VERVOLGING"
    elif s["heat"] > 75:
        add_mail(s, "Juridische Zaken", "Er wordt een dossier opgebouwd",
                 "Een bevriende griffier zegt dat ons dossier dikker wordt. Bij de huidige heat is een inval een kwestie van tijd.", "KRITIEK")
    if s["flags"].pop("overgenomen", False):
        status = "OVERGENOMEN"
    s["status"] = status
    if status != "actief":
        add_mail(s, "Raad van Bestuur", f"Einde: {status}",
                 f"Per {played} is het voorbij. Status: {status}. Het archief wordt verzegeld.", "KRITIEK")

    # 7. Rapport (de CFO schrijft het; een corrupte CFO kleurt het)
    shown = {"cash": s["cash"], "net": net, "heat": s["heat"]}
    if s["flags"].get("cfo_manipuleert"):
        shown["cash"] = round(s["cash"] * random.uniform(1.05, 1.2) + random.uniform(2, 8), 1)
        shown["net"] = round(net + abs(net) * random.uniform(0.1, 0.3) + random.uniform(1, 4), 1)
        shown["heat"] = clamp(s["heat"] - random.uniform(3, 8))
    risks = [x for x in [
        "Cash laag" if shown["cash"] < 30 else None,
        "Heat hoog" if shown["heat"] > 40 else None,
        "Morale laag" if s["morale"] < 40 else None,
        "Reputatie zwak" if s["reputation"] < 30 else None,
        "Schuld" if s["debt"] > shown["cash"] else None,
        "Achterstallige facturen" if any(i["overdue"] for i in s["invoices"]) else None,
    ] if x][:3] or ["Geen acute risico's. Verdacht."]
    projects = "; ".join(f"{p['name']} ({p['eta_months']} mnd)" for p in s["projects"]) or "geen"
    waiting = [k.replace("wacht_op_speler_", "") for k, v in s["flags"].items() if k.startswith("wacht_op_speler_") and v]
    report = (
        f"# Maandrapport {played}\n\n"
        f"*Bedragen in k€ (duizend euro). Opgesteld door de CFO.*\n\n"
        f"| Item | Waarde |\n|---|---|\n"
        f"| Cash | {shown['cash']} (was {start_cash}) |\n"
        f"| Omzet | {round(rev, 1)} |\n"
        f"| Kosten | {round(cost, 1)} (lonen {round(payroll, 1)}, rente {round(interest, 1)}, projecten {round(proj_cost, 1)}) |\n"
        f"| Netto (voor facturen) | {shown['net']} |\n"
        f"| Schuld | {s['debt']} |\n"
        f"| Open facturen | {len(s['invoices'])} (€{round(sum(i['amount'] for i in s['invoices']), 1)}k) |\n"
        f"| Zwart / offshore | {s['accounts'].get('zwart', 0)} / {s['accounts'].get('offshore', 0)} |\n"
        f"| Heat | {round(shown['heat'], 1)} |\n"
        f"| Reputatie | {round(s['reputation'], 1)} |\n"
        f"| Morale | {round(s['morale'], 1)} |\n"
        f"| Status | {status} |\n\n"
        + (f"| Divisie | Omzet | Kosten |\n|---|---|---|\n" + "\n".join(lines) + "\n\n" if lines else "")
        + f"**Projecten:** {projects}\n\n"
        f"**Top risico's:** {', '.join(risks)}\n\n"
        f"**Gebeurd:** {'; '.join(rep) if rep else 'Niets noemenswaards.'}\n"
        + (f"\n**Wacht op uw besluit:** {', '.join(waiting)}\n" if waiting else "")
    )
    mail = add_mail(s, "CFO", f"Maandrapport {played}", report, "NORMAAL")
    # wat de speler 'weet': het scherm toont cijfers zoals de CFO ze rapporteert
    s["laatste_rapport"] = {"maand": played, "mail": mail, "netto": shown["net"], "omzet": round(rev, 1),
                            "kosten": round(cost, 1), "cash_offset": round(shown["cash"] - s["cash"], 1),
                            "heat_offset": round(shown["heat"] - s["heat"], 1), "gebeurd": rep}
    if status == "actief":
        advance_date(s)
    save(s)
    update_map(s)
    print(report)
    if s["flags"].get("cfo_manipuleert"):
        print(f"[GM-ONLY] Rapport is gekleurd door de CFO. Echte cash {s['cash']}, netto {net}, heat {round(s['heat'], 1)}. "
              "Toon de speler het rapport, niet deze regel.")


# ---------- spelerscommando's ----------
def status():
    s = load()
    out = {k: s[k] for k in ("date", "cash", "debt", "heat", "reputation", "morale", "status") if k in s}
    out["accounts"] = {k: s.get("accounts", {}).get(k, 0) for k in ("zwart", "offshore")}
    out["divisies"] = [f"{d.get('name', d['type'])} L{d['level']}" for d in s.get("divisions", [])]
    out["projecten"] = [f"{p['name']} ({p['eta_months']} mnd)" for p in s.get("projects", [])]
    out["wacht_op_speler"] = [k[16:] for k, v in s.get("flags", {}).items() if k.startswith("wacht_op_speler_") and v]
    print(json.dumps(out, indent=2, ensure_ascii=False))


def inbox(show_all=False):
    s = load()
    read = set(s.get("inbox_read", []))
    files = sorted(f for f in os.listdir(INBOX) if f.endswith(".md")) if os.path.isdir(INBOX) else []
    if show_all:
        for f in files:
            print(("  " if f in read else "* ") + f)
        return
    new = [f for f in files if f not in read]
    if not new:
        print("Geen ongelezen mail.")
        return
    order = {"KRITIEK": 0, "HOOG": 1, "NORMAAL": 2, "LAAG": 3}

    def prio(fn):
        with open(os.path.join(INBOX, fn), encoding="utf-8") as fh:
            m = re.search(r"\*\*Prioriteit:\*\* (\w+)", fh.read())
        return order.get(m.group(1) if m else "NORMAAL", 2)
    for f in sorted(new, key=lambda x: (prio(x), x)):
        with open(os.path.join(INBOX, f), encoding="utf-8") as fh:
            print(f"----- {f} -----\n{fh.read()}")
    s["inbox_read"] = sorted(read | set(new))
    save(s)


def kaart():
    s = load()
    if os.path.exists(MAP):
        with open(MAP, encoding="utf-8") as f:
            m = re.search(r"```.*?```", f.read(), flags=re.S)
            if m:
                print(m.group(0).strip("`").strip("\n"))
    print()
    print(map_status(s))


def rivalen():
    s = load()
    for r in s["rivals"]:
        est = r["cash"] * random.uniform(0.7, 1.3)
        agr = "laag" if r["aggression"] < 0.35 else ("gemiddeld" if r["aggression"] < 0.6 else "hoog")
        share = s.get("market", {}).get(r.get("sector", ""), {}).get("rivals", {}).get(r["name"], 0)
        print(f"## {r['name']} (CEO {r['ceo']})")
        print(f"- Sector: {r.get('sector', '?')} (marktaandeel ~{round(share * 100)}%) · HQ district {r.get('hq', '?')}")
        print(f"- Kas: schatting €{round(est / 10) * 10}k (onbetrouwbaar) · Agressie: {agr}")
        if r.get("memory"):
            print(f"- Wat ze over ons onthouden: {'; '.join(r['memory'][-3:])}")
        print()


def transfer(src, dst, amount):
    s = load()
    world.migrate(s)
    src, dst, amount = src.lower(), dst.lower(), float(amount)
    if src not in ACCOUNTS or dst not in ACCOUNTS or src == dst or amount <= 0:
        print(f"Gebruik: transfer <van> <naar> <k€>, rekeningen: {', '.join(ACCOUNTS)}")
        return
    bal = s["cash"] if src == "operationeel" else s["accounts"][src]
    if bal < amount:
        print(f"Onvoldoende saldo op {src}: {bal}")
        return
    fee_pct = (5 + random.randint(0, 10)) / 100  # 5-15%
    fee = round(amount * fee_pct, 1)
    if src == "operationeel":
        s["cash"] = round(s["cash"] - amount, 1)
    else:
        s["accounts"][src] = round(s["accounts"][src] - amount, 1)
    if dst == "operationeel":
        s["cash"] = round(s["cash"] + amount - fee, 1)
    else:
        s["accounts"][dst] = round(s["accounts"][dst] + amount - fee, 1)
    s["accounts"]["operationeel"] = s["cash"]
    # controlerisico: hoger bij grote bedragen, hoge heat, zwart geld
    risk = min(0.6, 0.05 + amount / 400 + s["heat"] / 300 + (0.08 if "zwart" in (src, dst) else 0))
    if world.faction(s, "politie") > 30:
        risk *= 0.6
    r = random.random()
    caught = r < risk
    msg = f"Transfer {amount} k€ {src} -> {dst}. Fee {round(fee_pct * 100)}% = {fee} k€. Controle: rol {r:.2f} vs kans {risk:.2f}"
    if caught:
        s["heat"] = clamp(s["heat"] + 6 + amount / 20)
        s["flags"]["transfer_onderzoek"] = ym(s)
        add_mail(s, "Bank Oude Stad, afdeling Compliance", "Ongebruikelijke transactie",
                 f"Wij hebben een transactie van €{amount}k gemeld bij de toezichthouder. Dit is een standaardprocedure. Wij hopen voor u dat het standaard blijft.", "HOOG")
        msg += " -> GEMELD (heat omhoog)"
    else:
        msg += " -> onopgemerkt"
    save(s)
    print(msg)


def lening(amount):
    s = load()
    amount = float(amount)
    cap = round(max(0, s["reputation"] * 4 - s["debt"] + max(0, s["cash"]) * 0.5), 1)
    if amount <= 0:
        print("Gebruik: lening <k€>")
        return
    if amount > cap:
        print(f"De bank weigert. Maximaal leenbaar nu: €{cap}k (hangt af van reputatie, schuld en kas).")
        return
    new_debt = s["debt"] + amount
    rate = round(0.06 + max(0, (50 - s["reputation"])) / 500 + new_debt / 3000 + (0.03 if s["heat"] > 40 else 0), 3)
    # nieuwe rente geldt voor de hele schuld (herfinanciering)
    s["debt"] = round(new_debt, 1)
    s["interest_rate"] = rate
    s["cash"] = round(s["cash"] + amount, 1)
    save(s)
    print(f"Lening €{amount}k verstrekt. Totale schuld €{s['debt']}k tegen {round(rate * 100, 1)}% per jaar "
          f"(≈ €{round(s['debt'] * rate / 12, 1)}k rente per maand).")


def aflossen(amount):
    s = load()
    amount = min(float(amount), s["debt"])
    if amount <= 0 or s["cash"] < amount:
        print(f"Kan niet aflossen. Schuld €{s['debt']}k, cash €{s['cash']}k.")
        return
    s["cash"] = round(s["cash"] - amount, 1)
    s["debt"] = round(s["debt"] - amount, 1)
    save(s)
    print(f"€{amount}k afgelost. Resterende schuld €{s['debt']}k.")


# ---------- controle & saves ----------
def validate(s):
    p = []
    for k in ("date", "player", "cash", "debt", "heat", "reputation", "morale", "staff", "culture", "divisions", "districts", "rivals", "npcs", "flags"):
        if k not in s:
            p.append(f"ontbrekende sleutel: {k}")
    if p:
        return p
    for k in ("cash", "debt", "heat", "reputation", "morale", "interest_rate"):
        if not isinstance(s.get(k, 0), (int, float)):
            p.append(f"{k} moet een getal zijn")
    if s["player"].get("difficulty") not in DIFF:
        p.append(f"player.difficulty moet een van {list(DIFF)} zijn")
    for d in s["divisions"]:
        if d.get("type") not in DIVISION_TYPES:
            p.append(f"divisie '{d.get('name')}' heeft onbekend type '{d.get('type')}' (kies uit {list(DIVISION_TYPES)} of voeg het toe in sim.py)")
        if not isinstance(d.get("level"), (int, float)) or d["level"] < 1:
            p.append(f"divisie '{d.get('name')}' heeft geen geldig level")
    for pr in s.get("projects", []):
        if "name" not in pr or not isinstance(pr.get("eta_months"), (int, float)):
            p.append(f"project {pr} mist name of eta_months")
    ids = [d.get("id") for d in s["districts"]]
    if len(ids) != len(set(ids)):
        p.append("dubbele district-id's")
    for r in s["rivals"]:
        for k in ("name", "ceo", "cash", "aggression"):
            if k not in r:
                p.append(f"rivaal {r.get('name', '?')} mist {k}")
    hb = s.get("hostile_bid")
    if hb and hb.get("verdediging") not in (None, *world.DEFENSES):
        p.append(f"hostile_bid.verdediging moet een van {list(world.DEFENSES)} zijn")
    vd = s["flags"].get("vonk_deal")
    if vd and vd not in ("sponsor", "negeren", "uitgeschakeld"):
        p.append("flags.vonk_deal moet sponsor, negeren of uitgeschakeld zijn")
    for e in load_custom_events()[1]:
        p.append(e)
    for e in load_custom_events()[0]:
        try:
            check_cond(e.get("when", "True"), s)
        except Exception as ex:
            p.append(f"custom event '{e.get('id', e['subject'])}': voorwaarde klopt niet ({ex})")
    return p


def check():
    s = load()
    p = validate(s)
    print("state.json is in orde." if not p else "Problemen:\n- " + "\n- ".join(p))


def make_save(quiet=False):
    os.makedirs(SAVES, exist_ok=True)
    s = load()
    base = f"save_{ym(s)}_{datetime.datetime.now():%Y%m%d-%H%M%S}"
    name, n = base + ".json", 2
    while os.path.exists(os.path.join(SAVES, name)):
        name, n = f"{base}-{n}.json", n + 1
    shutil.copy(STATE, os.path.join(SAVES, name))
    if not quiet:
        print("Opgeslagen:", name)
    return name


def load_save(name):
    path = name if os.path.isabs(name) else os.path.join(SAVES, os.path.basename(name))
    if not os.path.exists(path):
        print("Niet gevonden. Beschikbaar:\n" + "\n".join(sorted(os.listdir(SAVES))) if os.path.isdir(SAVES) else "Geen saves.")
        return
    load(path)  # controleer dat het geldige JSON is
    if os.path.exists(STATE):
        print("Huidige stand bewaard als", make_save(quiet=True))
    shutil.copy(path, STATE)
    print("Geladen:", os.path.basename(path))


def nieuw():
    if os.path.exists(STATE):
        print("Huidige stand bewaard als", make_save(quiet=True))
    shutil.copy(TEMPLATE, STATE)
    old = os.path.join(SAVES, f"oud_spel_{datetime.datetime.now():%Y%m%d-%H%M%S}")
    mails = [f for f in os.listdir(INBOX) if f.endswith(".md")] if os.path.isdir(INBOX) else []
    if mails or os.path.exists(LOG):
        os.makedirs(os.path.join(old, "inbox"), exist_ok=True)
        for f in mails:
            shutil.move(os.path.join(INBOX, f), os.path.join(old, "inbox", f))
        if os.path.exists(LOG):
            shutil.copy(LOG, os.path.join(old, "log.md"))
    with open(LOG, "w", encoding="utf-8") as f:
        f.write("# Log\n\n*(Nieuw spel. Zeg tegen Claude: \"start\".)*\n")
    if os.path.exists(MAP):
        with open(MAP, encoding="utf-8") as f:
            txt = f.read()
        txt = re.sub(r"<!-- STATUS.*?<!-- /STATUS -->",
                     "<!-- STATUS (automatisch, niet bewerken) -->\n*(Nog geen stand, wordt ingevuld na de eerste maand.)*\n<!-- /STATUS -->",
                     txt, flags=re.S)
        with open(MAP, "w", encoding="utf-8") as f:
            f.write(txt)
    print(f"Nieuw spel klaargezet. Oude inbox en log staan in game/saves/{os.path.basename(old)}/.")


if __name__ == "__main__":
    a = sys.argv[1:]
    cmd = a[0] if a else ""
    try:
        if cmd == "tick":
            tick()
        elif cmd == "roll":
            roll(a[1] if len(a) > 1 else "1d20", " ".join(a[2:]))
        elif cmd == "status":
            status()
        elif cmd == "inbox":
            inbox(show_all=len(a) > 1 and a[1] == "alles")
        elif cmd == "kaart":
            kaart()
        elif cmd == "rivalen":
            rivalen()
        elif cmd == "transfer" and len(a) == 4:
            transfer(a[1], a[2], a[3])
        elif cmd == "lening" and len(a) == 2:
            lening(a[1])
        elif cmd == "aflossen" and len(a) == 2:
            aflossen(a[1])
        elif cmd in ("check", "reset-check"):
            check()
        elif cmd == "save":
            make_save()
        elif cmd == "load" and len(a) == 2:
            load_save(a[1])
        elif cmd == "nieuw":
            nieuw()
        else:
            print(__doc__)
    except json.JSONDecodeError as ex:
        print(f"state.json is kapot (geen geldige JSON): {ex}. Laad een save met 'load <bestand>'.")
        sys.exit(1)
