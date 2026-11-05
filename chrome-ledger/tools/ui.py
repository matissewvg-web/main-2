#!/usr/bin/env python3
"""CHROME LEDGER — schermversie. Start: python tools/ui.py  (opent je browser)
Opties: --port 8765  --host 127.0.0.1  --no-browser

Alles draait lokaal: een kleine webserver (alleen Python-standaardbibliotheek) die
dezelfde engine gebruikt als de commandoregel (sim.py / world.py). De GM (Claude)
kan tegelijk in game/ werken: het scherm ververst vanzelf als er iets verandert."""
import contextlib, io, json, os, random, re, sys, threading, time, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sim
import world

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "ui", "index.html")
ICON = os.path.join(HERE, "ui", "icon.png")
LAN_KEY = None  # gezet in --gsm modus: alleen wie de link met code heeft, mag spelen
ORDERS = os.path.join(sim.G, "opdrachten.json")
LOCK = threading.Lock()

FAIL_PREFIX = ("Gebruik", "Onvoldoende", "De bank weigert", "Kan niet", "Niet gevonden", "Geen ", "GAME OVER",
               "Setup niet", "state.json heeft fouten", "state.json is kapot")


# ---------- hulpjes ----------
def run_cli(fn, *args):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        fn(*args)
    out = buf.getvalue().strip()
    return {"ok": not out.startswith(FAIL_PREFIX), "bericht": out}


def load_orders():
    if not os.path.exists(ORDERS):
        return []
    try:
        with open(ORDERS, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_orders(o):
    tmp = ORDERS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(o, f, indent=2, ensure_ascii=False)
    os.replace(tmp, ORDERS)


def append_log(s, line):
    with open(sim.LOG, "a", encoding="utf-8") as f:
        f.write(f"- **{sim.ym(s)}** · {line}\n")


def version():
    paths = [sim.STATE, sim.INBOX, ORDERS, sim.LOG, sim.ROLLS]
    return max([os.path.getmtime(p) for p in paths if os.path.exists(p)] or [0])


def parse_mail(fn):
    with open(os.path.join(sim.INBOX, fn), encoding="utf-8") as f:
        txt = f.read()
    head, _, body = txt.partition("\n\n")
    meta = dict(re.findall(r"\*\*(\w+):\*\* (.*)", head))
    return meta, body.strip()


def label_faction(v):
    return ("vijandig" if v <= -50 else "koel" if v <= -15 else "neutraal" if v < 15 else "warm" if v < 50 else "bondgenoot")


def npc_impression(n):
    if n.get("verraad"):
        return "lijkt tevreden"  # wie verraadt, laat dat niet zien
    l = n.get("loyalty", 50)
    return "loyaal" if l >= 65 else "tevreden" if l >= 45 else "twijfelt" if l >= 30 else "ontevreden"


def diff_of(s):
    return sim.DIFF.get(s["player"].get("difficulty", "Realistisch"), 1.0)


def loan_cap(s):
    return round(max(0, s["reputation"] * 4 - s["debt"] + max(0, s["cash"]) * 0.5), 1)


def district_cost(s, d):
    c = d.get("upkeep", 0) * 8 + d.get("income", 0) * 4
    if any(r.get("hq") == d["id"] for r in s["rivals"]):
        c *= 2
    return round(c * diff_of(s), 1)


def upgrade_cost(s, d):
    return round(15 * d["level"] * diff_of(s), 1)


NEW_DIV_COST = 30


# ---------- wat de speler mag zien ----------
def pending_decisions(s):
    out = []
    f = s.get("flags", {})
    zwart = s.get("accounts", {}).get("zwart", 0)
    if f.get("wacht_op_speler_vonk"):
        out.append({"arc": "vonk", "titel": "Mara Vonk wil een antwoord",
                    "tekst": "Financier haar tour, negeer haar, of laat het 'oplossen'. De straat kijkt mee.",
                    "opties": [
                        {"keuze": "sponsor", "label": "Tour financieren", "kost": 15,
                         "uitleg": "€15k. Straat warmer, politie koeler, wat heat."},
                        {"keuze": "negeren", "label": "Negeren", "kost": 0,
                         "uitleg": "Gratis. 1 tot 3 maanden reputatieschade."},
                        {"keuze": "uitgeschakeld", "label": "Laten oplossen", "kost": 10,
                         "uitleg": f"€10k{' uit zwart geld' if zwart >= 10 else ''}. Veel heat, straat woedend, 35% kans dat het uitlekt."},
                    ]})
    if f.get("wacht_op_speler_nomaden_pact"):
        out.append({"arc": "nomaden_pact", "titel": "Isra biedt een pact aan",
                    "tekst": "Toegang tot uw netwerk in ruil voor bescherming op de Ringweg.",
                    "opties": [
                        {"keuze": "ja", "label": "Pact sluiten", "kost": 0,
                         "uitleg": "Logistiek en smokkel 20% goedkoper, konvooien helpen. Af en toe een eis. Breken is gevaarlijk."},
                        {"keuze": "nee", "label": "Weigeren", "kost": 0,
                         "uitleg": "Nomaden koeler. Meer kans op gedoe op de Ringweg."},
                    ]})
    if f.get("wacht_op_speler_hostile_bid"):
        out.append({"arc": "hostile_bid", "titel": "Vijandig overnamebod",
                    "tekst": "U heeft 30 dagen. Kies een verdediging. Een gevecht kost geld; niets doen kost meestal het bedrijf.",
                    "opties": [
                        {"keuze": "niets", "label": "Niets doen", "kost": 0, "uitleg": "Ongeveer 15% kans dat het bod mislukt."},
                        {"keuze": "investeren", "label": "Aandelen terugkopen", "kost": "budget", "uitleg": "35% + 0,5% per €1k budget."},
                        {"keuze": "juridisch", "label": "Juridische strijd", "kost": "budget", "uitleg": "35% + 0,67% per €1k budget, +3 heat."},
                        {"keuze": "white_knight", "label": "White knight zoeken", "kost": 0, "uitleg": "60%, maar daarna sta je bij iemand in het krijt."},
                        {"keuze": "poison_pill", "label": "Poison pill", "kost": 0, "uitleg": "75%, maar morale -10, reputatie -5 en €50k extra schuld."},
                    ]})
    eis = f.get("nomaden_eis")
    if isinstance(eis, dict):
        out.append({"arc": "nomaden_eis", "titel": "Isra vraagt een gunst",
                    "tekst": f"€{eis['bedrag']}k, of het pact wordt kouder.",
                    "opties": [
                        {"keuze": "betalen", "label": f"Betalen (€{eis['bedrag']}k)", "kost": eis["bedrag"], "uitleg": "Houdt de Ringweg vriendelijk."},
                        {"keuze": "weigeren", "label": "Laten liggen", "kost": 0, "uitleg": "Kost nomaden-standing."},
                    ]})
    known = {"vonk", "nomaden_pact", "hostile_bid"}
    for k, v in f.items():
        if k.startswith("wacht_op_speler_") and v and k[16:] not in known:
            out.append({"arc": k[16:], "titel": f"Besluit nodig: {k[16:]}", "tekst": "Dit loopt via de GM. Stuur een opdracht.", "opties": []})
    return out


def public_state():
    if not os.path.exists(sim.STATE):
        return {"geen_spel": True}
    s = sim.load()
    world.migrate(s)
    f = s.get("flags", {})
    lr = s.get("laatste_rapport", {})
    manip = bool(f.get("cfo_manipuleert"))
    cash = round(s["cash"] + (lr.get("cash_offset", 0) if manip else 0), 1)
    heat = round(sim.clamp(s["heat"] + (lr.get("heat_offset", 0) if manip else 0)), 1)
    read = set(s.get("inbox_read", []))
    arch = set(s.get("inbox_archief", []))
    mails = []
    if os.path.isdir(sim.INBOX):
        files = [x for x in os.listdir(sim.INBOX) if x.endswith(".md")]
        files.sort(key=lambda x: (x[:7], os.path.getmtime(os.path.join(sim.INBOX, x)), x), reverse=True)
        for fn in files:
            try:
                meta, body = parse_mail(fn)
            except Exception:
                continue
            mails.append({"id": fn, "van": meta.get("Van", "?"), "onderwerp": meta.get("Onderwerp", fn),
                          "datum": meta.get("Datum", fn[:7]), "prio": meta.get("Prioriteit", "NORMAAL"),
                          "gelezen": fn in read, "archief": fn in arch,
                          "preview": re.sub(r"[#*|`_-]+", " ", body)[:120].strip()})
    hq = {}
    for r in s["rivals"]:
        hq.setdefault(r.get("hq"), []).append(r["name"])
    pending_proj = {p.get("district") for p in s["projects"] if p.get("district")}
    pending_up = {p.get("division") for p in s["projects"] if p.get("division")}
    districts = []
    for d in s["districts"]:
        districts.append({"id": d["id"], "naam": d["name"], "controle": d.get("control", "neutral"),
                          "inkomen": d.get("income", 0), "onderhoud": d.get("upkeep", 0), "lore": d.get("lore", ""),
                          "hq": hq.get(d["id"], []), "thuis": s["player"].get("home_district") == d["id"],
                          "kost": district_cost(s, d), "bezig": d["id"] in pending_proj})
    ym = sim.ym(s)
    rivals = []
    for r in s["rivals"]:
        rng = random.Random(f"{r['name']}|{ym}")
        share = s["market"].get(r.get("sector", ""), {}).get("rivals", {}).get(r["name"], 0)
        rivals.append({"naam": r["name"], "ceo": r["ceo"], "sector": r.get("sector", "?"), "hq": r.get("hq", "?"),
                       "agressie": "laag" if r["aggression"] < 0.35 else "gemiddeld" if r["aggression"] < 0.6 else "hoog",
                       "kas_schatting": round(r["cash"] * rng.uniform(0.7, 1.3) / 10) * 10,
                       "aandeel": round(share * 100), "geheugen": r.get("memory", [])[-3:]})
    divisions = []
    for d in s["divisions"]:
        m = s["market"].get(d["type"], {})
        divisions.append({"naam": d.get("name", d["type"]), "type": d["type"], "level": d["level"],
                          "aandeel": round(m.get("player", 0) * 100), "upgrade_kost": upgrade_cost(s, d),
                          "bezig": d.get("name", d["type"]) in pending_up})
    rolls = []
    if os.path.exists(sim.ROLLS):
        with open(sim.ROLLS, encoding="utf-8") as fh:
            rolls = fh.read().splitlines()[-40:]
    log = ""
    if os.path.exists(sim.LOG):
        with open(sim.LOG, encoding="utf-8") as fh:
            log = fh.read()
    return {
        "versie": version(), "setup_done": bool(s.get("setup_done")), "status": s.get("status", "actief"),
        "speler": s["player"], "datum": s["date"], "maand": ym,
        "cash": cash, "schuld": s["debt"], "rente": s["interest_rate"], "heat": heat,
        "reputatie": round(s["reputation"], 1), "morale": round(s["morale"], 1),
        "zwart": s["accounts"].get("zwart", 0), "offshore": s["accounts"].get("offshore", 0),
        "personeel": s["staff"], "cultuur": s["culture"],
        "divisies": divisions, "projecten": s["projects"], "districten": districts, "rivalen": rivals,
        "npcs": [{"naam": n["name"], "rol": n.get("role", ""), "indruk": npc_impression(n)} for n in s.get("npcs", [])],
        "facties": [{"naam": k, "label": label_faction(v.get("standing", 0)), "waarde": round(v.get("standing", 0)), "noot": v.get("note", "")}
                    for k, v in s["factions"].items()],
        "facturen": [{k: i.get(k) for k in ("id", "payee", "amount", "due_in", "overdue", "note", "auto_pay")} for i in s["invoices"]],
        "auto_pay": s.get("auto_pay", True), "lopend": [e["naam"] for e in s.get("lopende_effecten", [])],
        "besluiten": pending_decisions(s), "mails": mails, "opdrachten": load_orders(),
        "rapport": {k: lr.get(k) for k in ("maand", "mail", "netto", "omzet", "kosten", "gebeurd")} if lr else None,
        "leenruimte": loan_cap(s), "nieuwe_divisie_kost": round(NEW_DIV_COST * diff_of(s), 1),
        "divisie_types": list(sim.DIVISION_TYPES), "moeilijkheden": list(sim.DIFF),
        "contract": f.get("nomad_contract"), "log": log, "worpen": rolls,
    }


# ---------- acties ----------
def act_mail_get(s_unused, q):
    fn = os.path.basename(q.get("id", ""))
    if not fn.endswith(".md") or not os.path.exists(os.path.join(sim.INBOX, fn)):
        return {"ok": False, "bericht": "Mail niet gevonden."}
    meta, body = parse_mail(fn)
    s = sim.load()
    read = set(s.get("inbox_read", []))
    if fn not in read:
        s["inbox_read"] = sorted(read | {fn})
        sim.save(s)
    return {"ok": True, "id": fn, "meta": meta, "body": body}


def act_mail_flag(d):
    s = sim.load()
    ids = [os.path.basename(x) for x in d.get("ids", [])]
    key = "inbox_archief" if d.get("soort") == "archief" else "inbox_read"
    cur = set(s.get(key, []))
    cur = cur | set(ids) if d.get("waarde", True) else cur - set(ids)
    s[key] = sorted(cur)
    sim.save(s)
    return {"ok": True}


def act_order(d):
    tekst = str(d.get("tekst", "")).strip()
    if not tekst:
        return {"ok": False, "bericht": "Lege opdracht."}
    s = sim.load()
    o = load_orders()
    o.append({"id": "%08x" % random.getrandbits(32), "maand": sim.ym(s), "tekst": tekst[:4000],
              "context": str(d.get("context", ""))[:300], "status": "open", "antwoord": "",
              "tijd": time.strftime("%Y-%m-%d %H:%M")})
    save_orders(o)
    return {"ok": True, "bericht": "Opdracht staat klaar voor de GM."}


def act_order_cancel(d):
    o = load_orders()
    for x in o:
        if x["id"] == d.get("id") and x["status"] == "open":
            x["status"] = "ingetrokken"
    save_orders(o)
    return {"ok": True}


def act_tick(d):
    open_orders = [x for x in load_orders() if x["status"] == "open"]
    if open_orders and not d.get("force"):
        return {"ok": False, "vraag": True,
                "bericht": f"Er staan {len(open_orders)} opdracht(en) open voor de GM. Als je nu doorgaat, gebeuren die deze maand niet."}
    before = sim.load()
    res = run_cli(sim.tick)
    if not res["ok"]:
        return res
    s = sim.load()
    res["bericht"] = "\n".join(l for l in res["bericht"].splitlines() if not l.startswith("[GM-ONLY]"))
    res["rapport_mail"] = s.get("laatste_rapport", {}).get("mail")
    res["nieuw"] = len([m for m in os.listdir(sim.INBOX) if m.endswith(".md")]) - len(before.get("inbox_read", []))
    res["status"] = s.get("status")
    return res


def act_invoice(d):
    s = sim.load()
    world.migrate(s)
    inv = next((i for i in s["invoices"] if i["id"] == d.get("id")), None)
    if d.get("alles") is not None:
        s["auto_pay"] = bool(d["alles"])
        sim.save(s)
        return {"ok": True, "bericht": "Automatisch betalen " + ("aan." if s["auto_pay"] else "uit.")}
    if not inv:
        return {"ok": False, "bericht": "Factuur niet gevonden."}
    if d.get("actie") == "betaal":
        if s["cash"] < inv["amount"]:
            return {"ok": False, "bericht": f"Onvoldoende cash voor €{inv['amount']}k."}
        s["cash"] = round(s["cash"] - inv["amount"], 1)
        s["invoices"].remove(inv)
        if inv.get("overdue"):
            s["reputation"] = sim.clamp(s["reputation"] + 0.5)
        msg = f"{inv['payee']} betaald: €{inv['amount']}k."
    else:
        inv["auto_pay"] = not inv.get("auto_pay", True)
        msg = f"{inv['payee']}: " + ("wordt automatisch betaald." if inv["auto_pay"] else "laten we bewust liggen.")
    s["accounts"]["operationeel"] = s["cash"]
    sim.save(s)
    return {"ok": True, "bericht": msg}


def act_decision(d):
    s = sim.load()
    world.migrate(s)
    f = s["flags"]
    arc, keuze = d.get("arc"), d.get("keuze")
    budget = max(0.0, float(d.get("budget") or 0))

    def pay(amount, prefer_black=False):
        if prefer_black and s["accounts"].get("zwart", 0) >= amount:
            s["accounts"]["zwart"] = round(s["accounts"]["zwart"] - amount, 1)
            return True
        if s["cash"] < amount:
            return False
        s["cash"] = round(s["cash"] - amount, 1)
        return True

    if arc == "vonk" and f.get("wacht_op_speler_vonk") and keuze in ("sponsor", "negeren", "uitgeschakeld"):
        cost = {"sponsor": 15, "negeren": 0, "uitgeschakeld": 10}[keuze]
        if not pay(cost, prefer_black=keuze == "uitgeschakeld"):
            return {"ok": False, "bericht": f"Niet genoeg geld (€{cost}k nodig)."}
        f["vonk_deal"] = keuze
        f.pop("wacht_op_speler_vonk")
        line = {"sponsor": "We financieren de tour van Mara Vonk.", "negeren": "We negeren Mara Vonk.",
                "uitgeschakeld": "Mara Vonk wordt 'opgelost'."}[keuze]
    elif arc == "nomaden_pact" and f.get("wacht_op_speler_nomaden_pact") and keuze in ("ja", "nee"):
        f["nomad_contract"] = keuze == "ja"
        f.pop("wacht_op_speler_nomaden_pact")
        line = "Pact met de nomaden gesloten." if keuze == "ja" else "Pact met de nomaden geweigerd."
    elif arc == "hostile_bid" and f.get("wacht_op_speler_hostile_bid") and keuze in world.DEFENSES:
        b = budget if keuze in ("investeren", "juridisch") else 0
        if not pay(b):
            return {"ok": False, "bericht": f"Niet genoeg cash voor een budget van €{b}k."}
        s["hostile_bid"] = {"verdediging": keuze, "budget": b}
        f.pop("wacht_op_speler_hostile_bid")
        line = f"Verdediging tegen het overnamebod: {keuze}" + (f" (budget €{b}k)" if b else "") + "."
    elif arc == "nomaden_eis" and isinstance(f.get("nomaden_eis"), dict) and keuze in ("betalen", "weigeren"):
        if keuze == "betalen":
            amount = f["nomaden_eis"]["bedrag"]
            if not pay(amount):
                return {"ok": False, "bericht": f"Niet genoeg cash (€{amount}k)."}
            world.shift_faction(s, "nomaden", 3)
            f.pop("nomaden_eis")
            line = f"Isra's gunst betaald (€{amount}k)."
        else:
            line = "Isra's eis blijft liggen."
            f["nomaden_eis"]["genegeerd"] = True
    else:
        return {"ok": False, "bericht": "Dit besluit staat niet (meer) open."}
    s["accounts"]["operationeel"] = s["cash"]
    sim.save(s)
    append_log(s, line)
    return {"ok": True, "bericht": line + " De gevolgen merk je na de volgende maand."}


def act_project(d):
    s = sim.load()
    world.migrate(s)
    kind = d.get("soort")
    if kind == "upgrade":
        div = next((x for x in s["divisions"] if x.get("name", x["type"]) == d.get("divisie")), None)
        if not div:
            return {"ok": False, "bericht": "Divisie niet gevonden."}
        name = div.get("name", div["type"])
        if any(p.get("division") == name for p in s["projects"]):
            return {"ok": False, "bericht": "Daar loopt al een uitbreiding."}
        cost = upgrade_cost(s, div)
        proj = {"name": f"Uitbreiding {name} naar L{div['level'] + 1}", "eta_months": 2, "cost_per_month": 2,
                "division": name, "done_msg": f"{name} draait nu op niveau {div['level'] + 1}. Meer omzet, meer kosten, meer aandacht.",
                "on_complete": {"upgrade_division": name, "levels": 1}}
    elif kind == "divisie":
        typ = d.get("type")
        name = str(d.get("naam") or typ).strip()[:40]
        if typ not in sim.DIVISION_TYPES:
            return {"ok": False, "bericht": "Onbekend type."}
        if any(x.get("name") == name for x in s["divisions"]) or any(p.get("new_name") == name for p in s["projects"]):
            return {"ok": False, "bericht": "Die naam bestaat al."}
        cost = round(NEW_DIV_COST * diff_of(s), 1)
        proj = {"name": f"Opstart {name} ({typ})", "eta_months": 3, "cost_per_month": 3, "new_name": name,
                "done_msg": f"{name} is operationeel. Klein begin. De concurrentie heeft het gezien.",
                "on_complete": {"new_division": {"name": name, "type": typ, "level": 1}}}
        if typ == "Smokkel":
            proj["on_complete"]["effect"] = {"heat": 4}
    elif kind == "district":
        dist = next((x for x in s["districts"] if x["id"] == d.get("id")), None)
        if not dist or dist.get("control") == "player":
            return {"ok": False, "bericht": "Dat district is al van jou of bestaat niet."}
        if any(p.get("district") == dist["id"] for p in s["projects"]):
            return {"ok": False, "bericht": "Daar loopt al een vestiging."}
        cost = district_cost(s, dist)
        proj = {"name": f"Vestiging in {dist['name']}", "eta_months": 3, "cost_per_month": 1, "district": dist["id"],
                "done_msg": f"We hebben voet aan de grond in {dist['name']}. Panden, contacten, een paar mensen die ons kennen.",
                "on_complete": {"district_control": dist["id"]}}
        for r in s["rivals"]:
            if r.get("hq") == dist["id"]:
                r["memory"].append(f"{sim.ym(s)}: speler dringt district {dist['id']} binnen")
                r["memory"] = r["memory"][-12:]
                r["aggression"] = round(min(1, r["aggression"] + 0.05), 2)
    else:
        return {"ok": False, "bericht": "Onbekend project."}
    if s["cash"] < cost:
        return {"ok": False, "bericht": f"Niet genoeg cash: €{cost}k nodig."}
    s["cash"] = round(s["cash"] - cost, 1)
    s["accounts"]["operationeel"] = s["cash"]
    s["projects"].append(proj)
    sim.save(s)
    append_log(s, f"Project gestart: {proj['name']} (€{cost}k + €{proj['cost_per_month']}k/maand, {proj['eta_months']} mnd).")
    return {"ok": True, "bericht": f"{proj['name']} gestart. €{cost}k betaald, klaar over {proj['eta_months']} maanden."}


def act_setup(d):
    s = sim.load(sim.TEMPLATE)
    world.migrate(s)
    p = s["player"]
    p["corp_name"] = str(d.get("corp_name") or "Naamloos BV").strip()[:60]
    p["motto"] = str(d.get("motto") or "").strip()[:120]
    p["background"] = str(d.get("background") or "").strip()[:200]
    p["difficulty"] = d.get("difficulty") if d.get("difficulty") in sim.DIFF else "Realistisch"
    doctrine = [x for x in d.get("doctrine", []) if x in sim.DIVISION_TYPES][:2] or ["Logistiek"]
    p["doctrine"] = " + ".join(doctrine)
    home = d.get("home") if d.get("home") in [x["id"] for x in s["districts"]] else "A"
    p["home_district"] = home
    for dist in s["districts"]:
        if dist["id"] == home:
            dist["control"] = "player"
        nm = str((d.get("namen") or {}).get(dist["id"], "")).strip()
        if nm:
            dist["name"] = nm[:30]
    try:
        year = int(d.get("year") or 2004)
    except ValueError:
        year = 2004
    s["date"] = {"year": max(1980, min(2100, year)), "month": 1}
    kap = d.get("kapitaal", "normaal")
    s["cash"], s["debt"] = {"krap": (80, 0), "normaal": (100, 0), "ruim": (150, 60)}.get(kap, (100, 0))
    lvl = 2 if len(doctrine) == 1 else 1
    s["divisions"] = [{"name": (d.get("divisie_naam") or "").strip()[:40] or t, "type": t, "level": lvl} if i == 0
                      else {"name": t, "type": t, "level": lvl} for i, t in enumerate(doctrine)]
    c = s["culture"]
    c["slogans"] = [x.strip() for x in str(d.get("slogan") or "").split("\n") if x.strip()][:3]
    c["layoff_policy"] = "hard" if d.get("ontslag") == "hard" else "normal"
    bonus = d.get("bonus", "geen")
    c["bonus_cost"], c["morale_drift"] = {"geen": (0, 0), "redelijk": (2, 1), "royaal": (5, 2)}.get(bonus, (0, 0))
    ethiek = d.get("ethiek", "normaal")
    c["heat_decay"] = {"streng": 3, "normaal": 2, "geen_vragen": 1}.get(ethiek, 2)
    c["ethics_rules"] = {"streng": ["Geen illegale deals", "Klokkenluiders worden beschermd"],
                         "normaal": ["Niet betrapt worden"], "geen_vragen": ["Resultaat telt"]}.get(ethiek, [])
    if ethiek == "streng":
        s["reputation"] += 5
    if ethiek == "geen_vragen":
        world.shift_faction(s, "straat", 10)
    if c["layoff_policy"] == "hard":
        world.shift_faction(s, "vakbond", -15)
    s["setup_done"] = True
    s["status"] = "actief"
    s["accounts"]["operationeel"] = s["cash"]
    sim.save(s)
    for x in os.listdir(sim.INBOX) if os.path.isdir(sim.INBOX) else []:
        if x.endswith(".md"):
            os.remove(os.path.join(sim.INBOX, x))
    home_name = next(x["name"] for x in s["districts"] if x["id"] == home)
    sim.add_mail(s, "Marta Delcourt (CFO)", "Welkom, CEO",
                 f"Welkom bij {p['corp_name']}.{(' ' + p['motto']) if p['motto'] else ''}\n\n"
                 f"We zitten in {home_name}. We hebben €{s['cash']}k in kas"
                 f"{(' en €%sk schuld bij de bank' % s['debt']) if s['debt'] else ''}, "
                 f"{s['staff']['count']} mensen op de loonlijst en {len(s['divisions'])} divisie(s): "
                 f"{', '.join(x['name'] for x in s['divisions'])}.\n\n"
                 "Elke maand stuur ik u een rapport. Lees het. De rest van uw mail is minder betrouwbaar dan ik.\n\n"
                 "— M. Delcourt", "HOOG")
    with open(sim.LOG, "w", encoding="utf-8") as fh:
        fh.write(f"# Log\n\n- **{sim.ym(s)}** · {p['corp_name']} opgericht in {home_name}. Doctrine: {p['doctrine']}. "
                 f"Moeilijkheid: {p['difficulty']}.\n")
    sim.update_map(s)
    return {"ok": True, "bericht": "Bedrijf opgericht."}


def act_money(d):
    kind = d.get("soort")
    if kind == "transfer":
        return run_cli(sim.transfer, str(d.get("van")), str(d.get("naar")), str(d.get("bedrag")))
    if kind == "lening":
        return run_cli(sim.lening, str(d.get("bedrag")))
    if kind == "aflossen":
        return run_cli(sim.aflossen, str(d.get("bedrag")))
    return {"ok": False, "bericht": "Onbekend."}


POST = {
    "/api/mail/flag": act_mail_flag, "/api/opdracht": act_order, "/api/opdracht/intrekken": act_order_cancel,
    "/api/tick": act_tick, "/api/factuur": act_invoice, "/api/besluit": act_decision,
    "/api/project": act_project, "/api/setup": act_setup, "/api/geld": act_money,
    "/api/save": lambda d: run_cli(sim.make_save),
    "/api/nieuw": lambda d: run_cli(sim.nieuw) if d.get("zeker") else {"ok": False, "bericht": "Bevestiging nodig."},
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def allowed(self, q=None):
        if not LAN_KEY or self.client_address[0] in ("127.0.0.1", "::1"):
            return True
        if q and q.get("k") == LAN_KEY:
            return True
        return f"cl={LAN_KEY}" in (self.headers.get("Cookie") or "")

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/icon.png" and os.path.exists(ICON):
                with open(ICON, "rb") as f:
                    return self.send(200, f.read(), "image/png")
            if not self.allowed(q):
                return self.send(403, "Geen toegang. Gebruik de link met code die op je pc staat.".encode("utf-8"), "text/plain; charset=utf-8")
            if u.path in ("/", "/index.html"):
                with open(INDEX, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                if LAN_KEY and q.get("k") == LAN_KEY:
                    self.send_header("Set-Cookie", f"cl={LAN_KEY}; Max-Age=31536000; Path=/; SameSite=Strict")
                self.end_headers()
                return self.wfile.write(data)
            if u.path == "/api/state":
                with LOCK:
                    return self.send(200, public_state())
            if u.path == "/api/versie":
                return self.send(200, {"versie": version()})
            if u.path == "/api/mail":
                with LOCK:
                    return self.send(200, act_mail_get(None, q))
            self.send(404, {"ok": False, "bericht": "Niet gevonden"})
        except Exception as ex:
            self.send(500, {"ok": False, "bericht": f"Fout: {ex}"})

    def do_POST(self):
        u = urlparse(self.path)
        fn = POST.get(u.path)
        if not fn:
            return self.send(404, {"ok": False, "bericht": "Niet gevonden"})
        if not self.allowed():
            return self.send(403, {"ok": False, "bericht": "Geen toegang"})
        # alleen verzoeken van de eigen pagina (geen andere sites die je spel bewerken)
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != self.headers.get("Host"):
            return self.send(403, {"ok": False, "bericht": "Verboden"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            d = json.loads(self.rfile.read(n) or b"{}") if n else {}
            with LOCK:
                return self.send(200, fn(d))
        except json.JSONDecodeError:
            self.send(400, {"ok": False, "bericht": "Ongeldige invoer"})
        except Exception as ex:
            self.send(500, {"ok": False, "bericht": f"Fout: {ex}"})


def lan_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # er wordt niets verstuurd; zo vind je het eigen netwerkadres
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


def load_key():
    """Vaste toegangscode per spelmap, zodat de link op je gsm blijft werken."""
    path = os.path.join(sim.G, ".gsm_code")
    try:
        with open(path, encoding="utf-8") as f:
            k = f.read().strip()
            if k:
                return k
    except OSError:
        pass
    k = "%06x" % random.SystemRandom().getrandbits(24)
    with open(path, "w", encoding="utf-8") as f:
        f.write(k)
    return k


def main():
    global LAN_KEY
    a = sys.argv[1:]
    gsm = "--gsm" in a
    host = a[a.index("--host") + 1] if "--host" in a else ("0.0.0.0" if gsm else "127.0.0.1")
    if gsm:
        LAN_KEY = load_key()
    port = int(a[a.index("--port") + 1]) if "--port" in a else 8765
    if not os.path.exists(sim.STATE):
        run_cli(sim.nieuw)
    for p in range(port, port + 20):
        try:
            srv = ThreadingHTTPServer((host, p), Handler)
            break
        except OSError:
            continue
    else:
        print("Geen vrije poort gevonden.")
        return
    url = f"http://{'localhost' if host in ('127.0.0.1', '0.0.0.0') else host}:{p}/"
    print(f"CHROME LEDGER draait op {url}  (stoppen: Ctrl+C)")
    if gsm:
        ip = lan_ip()
        print("\n  OP JE GSM (zelfde wifi als deze pc), open in Safari of Chrome:\n")
        print(f"     http://{ip or '<ip-van-deze-pc>'}:{p}/?k={LAN_KEY}\n")
        print("  iPhone: deel-knop > 'Zet op beginscherm' voor een app-icoon.")
        print("  Laat dit venster open en de pc aan zolang je speelt.")
        print("  Windows vraagt misschien om toegang: kies 'Privénetwerken'.\n")
    if "--no-browser" not in a:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nGestopt.")


if __name__ == "__main__":
    main()
