#!/usr/bin/env python3
"""Wereldlaag voor CHROME LEDGER: euro-rekeningen, facturen, marktaandeel/concurrentie,
facties (nomaden), personeel (NPC-loyaliteit), geruchten, lopende effecten en meerfasige
verhaalbogen (Mara Vonk, nomadenpact, vijandig bod).
Wordt aangeroepen vanuit sim.py (tick). Alle bedragen in k€ (duizend euro)."""
import random

SECTORS = ["Biotech", "Cyberware", "Logistiek", "Media & Data", "Private Security", "Financieel", "Smokkel"]


def clamp(x, lo=0, hi=100):
    return max(lo, min(hi, x))


def stamp(s):
    return f"{s['date']['year']}-{s['date']['month']:02d}"


# ---------- migratie: oudere state.json aanvullen ----------
def migrate(s):
    s.setdefault("currency", "EUR (k€)")
    s.setdefault("accounts", {"operationeel": None, "zwart": 0, "offshore": 0})
    for k in ("zwart", "offshore"):
        s["accounts"].setdefault(k, 0)
    s.setdefault("invoices", [])
    for inv in s["invoices"]:
        inv.setdefault("id", "%08x" % random.getrandbits(32))
        inv.setdefault("auto_pay", True)
        inv.setdefault("overdue", 0)
    s.setdefault("auto_pay", True)
    s.setdefault("arcs", [])
    s.setdefault("hidden_truth", [])
    s.setdefault("lopende_effecten", [])
    s.setdefault("projects", [])
    s.setdefault("divisions", [])
    s.setdefault("flags", {})
    s.setdefault("factions", {
        "nomaden": {"standing": 0, "note": "Clans buiten de Ringweg. Respect, geen vriendschap."},
        "vakbond": {"standing": 0, "note": "Haven/Staal. Onderhandelt hard, staakt sneller."},
        "politie": {"standing": 0, "note": "Oude Stad. Koopbaar, maar de prijs stijgt."},
        "stad": {"standing": 0, "note": "Gemeenteraad. Vergunningen en subsidies."},
        "straat": {"standing": 0, "note": "Roest/Neon. Wie je ook bent, zij weten het eerder."},
    })
    s.setdefault("market", {sec: {"size": 100.0, "player": 0.0,
                                  "rivals": {r["name"]: 0.0 for r in s["rivals"]}} for sec in SECTORS})
    for sec in SECTORS:
        m = s["market"].setdefault(sec, {"size": 100.0, "player": 0.0, "rivals": {}})
        for r in s["rivals"]:
            m["rivals"].setdefault(r["name"], 0.0)
    for r in s["rivals"]:
        r.setdefault("sector", random.choice(SECTORS))
        r.setdefault("memory", [])
    for n in s.get("npcs", []):
        n.setdefault("loyalty", 50)
        n.setdefault("ambition", 50)
    # oude saves: silverhand-arc heet nu 'vonk'
    for a in s["arcs"]:
        if a.get("id") == "silverhand":
            a["id"] = "vonk"
    for old, new in (("wacht_op_speler_silverhand", "wacht_op_speler_vonk"), ("silverhand_deal", "vonk_deal")):
        if old in s["flags"]:
            s["flags"][new] = s["flags"].pop(old)
    return s


def faction(s, name):
    return s["factions"].get(name, {}).get("standing", 0)


def shift_faction(s, name, delta):
    f = s["factions"].setdefault(name, {"standing": 0, "note": ""})
    f["standing"] = clamp(f["standing"] + delta, -100, 100)


def add_lingering(s, name, months, effect):
    """Effect dat elke maand terugkomt (bv. boycot): effect = {cash, reputation, heat, morale}."""
    s["lopende_effecten"].append({"naam": name, "maanden": months, "effect": effect})


def lingering_tick(s, rep, diff):
    still = []
    for e in s["lopende_effecten"]:
        eff = e["effect"]
        s["cash"] = round(s["cash"] + eff.get("cash", 0) * (diff if eff.get("cash", 0) < 0 else 1), 1)
        for k in ("reputation", "heat", "morale"):
            if k in eff:
                s[k] = clamp(s[k] + eff[k])
        e["maanden"] -= 1
        rep.append(f"Lopend: {e['naam']}")
        if e["maanden"] > 0:
            still.append(e)
    s["lopende_effecten"] = still


# ---------- rekeningen ----------
RECURRING = [
    ("Netbeheer Meridian Energie", 1.5, 3.0, "Elektriciteit en datacenter-koeling."),
    ("Vastgoedfonds Glas BV", 2.5, 6.0, "Huur van kantoor- en labruimte."),
    ("Advocatenkantoor De Wit & Partners", 1.0, 4.0, "Maandelijkse retainer, 'voor het geval dat'."),
    ("Verzekeraar Argos-Bloom", 1.0, 2.5, "Premie bedrijfsaansprakelijkheid. Met uitsluitingen."),
]


def _invoice(s, payee, amount, due_in, note, tag="vast"):
    s["invoices"].append({"id": "%08x" % random.getrandbits(32), "payee": payee, "amount": round(amount, 1), "due_in": due_in,
                          "note": note, "tag": tag, "overdue": 0, "auto_pay": True})


def invoices_tick(s, add_mail, rep, diff):
    scale = 0.55 * max(1, len(s["divisions"])) ** 0.5
    for payee, lo, hi, note in RECURRING:
        if random.random() < 0.4:
            _invoice(s, payee, random.uniform(lo, hi) * scale * diff, 2, note)
    if random.random() < 0.25:
        payee = random.choice(["Beveiligingsbureau Falk", "Consultants Meridian & Zoon",
                               "Gemeente: leges en heffingen", "Schadeherstel BV 'Snelle Jan'",
                               "Cleaning crew (geen vragen)"])
        amount = random.uniform(1, 8) * scale * diff
        if payee.startswith("Gemeente") and faction(s, "stad") < -30:
            amount *= 1.5  # de stad weet je te vinden
        _invoice(s, payee, amount, 1, "Onverwacht, wel verplicht.", "incidenteel")
    paid, late = 0.0, 0.0
    still = []
    for inv in s["invoices"]:
        inv.setdefault("auto_pay", True)
        inv["due_in"] -= 1
        if inv["due_in"] > 0:
            still.append(inv)
            continue
        if s["auto_pay"] and inv["auto_pay"] and s["cash"] >= inv["amount"]:
            s["cash"] = round(s["cash"] - inv["amount"], 1)
            paid += inv["amount"]
            continue
        inv["overdue"] += 1
        fee = round(inv["amount"] * 0.08, 1)
        inv["amount"] = round(inv["amount"] + fee, 1)
        late += fee
        s["reputation"] = clamp(s["reputation"] - 1.5)
        if inv["overdue"] == 2:
            add_mail(s, inv["payee"], f"Aanmaning: {inv['payee']}",
                     f"Tweede herinnering. Openstaand: €{inv['amount']}k. Daarna volgt de deurwaarder, niet de sympathie.", "HOOG")
        if inv["overdue"] == 4:
            s["reputation"] = clamp(s["reputation"] - 4)
            s["flags"]["deurwaarder_" + inv["payee"]] = True
            rep.append(f"Deurwaarder voor {inv['payee']}")
            add_mail(s, "Deurwaarder Claes", "Beslag op bedrijfsmiddelen",
                     f"Namens {inv['payee']} leg ik beslag. €{inv['amount']}k, binnen de week.", "KRITIEK")
        if inv["overdue"] >= 5:
            # beslag: de deurwaarder neemt wat er is
            take = min(max(s["cash"], 0), inv["amount"])
            s["cash"] = round(s["cash"] - take, 1)
            inv["amount"] = round(inv["amount"] - take, 1)
            if take:
                rep.append(f"Beslag gelegd: €{round(take, 1)}k")
            if inv["amount"] <= 0:
                continue
        still.append(inv)
    s["invoices"] = still
    if paid:
        rep.append(f"Facturen betaald: €{round(paid, 1)}k")
    if late:
        rep.append(f"Boete/rente achterstallig: €{round(late, 1)}k")
    return paid, late


# ---------- marktaandeel & concurrentie ----------
def market_tick(s, add_mail, rep, diff):
    for sec, m in s["market"].items():
        m["size"] = max(50.0, m["size"] * (1 + random.uniform(-0.03, 0.04)))
        pl_lvl = sum(d["level"] for d in s["divisions"] if d["type"] == sec)
        pl_target = min(0.5, pl_lvl * 0.07 * (0.6 + s["reputation"] / 250.0))
        m["player"] += (pl_target - m["player"]) * 0.2
        for r in s["rivals"]:
            tgt = 0.30 if r["sector"] == sec else 0.04
            tgt *= (0.7 + 0.6 * random.random()) * (1 + r["aggression"] * 0.4)
            m["rivals"][r["name"]] = m["rivals"].get(r["name"], 0) + (tgt - m["rivals"].get(r["name"], 0)) * 0.15
        total = m["player"] + sum(m["rivals"].values())
        if total > 0.92:  # normaliseren; er blijft altijd 'overig'
            f = 0.92 / total
            m["player"] *= f
            for k in m["rivals"]:
                m["rivals"][k] *= f
    for r in s["rivals"]:
        sec = r["sector"]
        if random.random() < 0.12 + r["aggression"] * 0.1:
            move = random.choice(["headhunt", "gezamenlijk", "dumping", "smaad", "licentiebod"])
            r["cash"] = round(r["cash"] - random.uniform(2, 8), 1)  # agressie kost ook hen geld
            if move == "headhunt" and s["npcs"]:
                n = random.choice(s["npcs"])
                add_mail(s, r["ceo"], "Koffie?",
                         f"Hoorde dat {n['name']} ({n['role']}) ontevreden is. Ik heb altijd plek voor talent. Dit mailtje bestaat niet.", "NORMAAL")
                n["loyalty"] = clamp(n["loyalty"] - random.randint(3, 10))
                n.setdefault("benaderd_door", r["name"])
                rep.append(f"{r['name']} probeert {n['name']} weg te kopen")
            elif move == "gezamenlijk":
                add_mail(s, r["ceo"], f"Joint venture {sec}",
                         f"{r['name']} stelt een gezamenlijk project voor in {sec}. Winst delen, risico's delen, geheimen niet.", "NORMAAL")
                s["flags"]["jv_aanbod_" + r["name"]] = stamp(s)
            elif move == "dumping":
                s["market"][sec]["player"] *= 0.9
                rep.append(f"{r['name']} dumpt prijzen in {sec}")
            elif move == "smaad":
                s["reputation"] = clamp(s["reputation"] - 3)
                add_mail(s, "PR", "Campagne tegen ons",
                         f"Anonieme blogs wijzen naar {r['name']}. Natuurlijk zonder bewijs. Natuurlijk effectief.", "HOOG")
            elif move == "licentiebod":
                add_mail(s, r["ceo"], "Licentie aanbod",
                         f"{r['name']} wil technologie van ons licentiëren. Prijs vraagt u maar. Dat is zelden goed nieuws.", "NORMAAL")
    # tegenslag bij rivalen (anders vallen ze nooit om)
    for r in s["rivals"]:
        if random.random() < 0.04:
            loss = round(r["cash"] * random.uniform(0.2, 0.5), 1)
            r["cash"] = round(r["cash"] - loss, 1)
            r.setdefault("problemen", []).append(stamp(s))
            if random.random() < 0.6:
                add_mail(s, "Journalist", f"Problemen bij {r['name']}?",
                         f"Bronnen spreken over een mislukt project bij {r['name']}. Cijfers ontbreken. Paniek niet.", "NORMAAL")
    for r in list(s["rivals"]):
        if r["cash"] < 30 and random.random() < 0.25:
            s["rivals"].remove(r)
            for m in s["market"].values():
                gone = m["rivals"].pop(r["name"], 0)
                m["player"] += gone * 0.3
            add_mail(s, "Journalist", f"{r['name']} failliet",
                     f"{r['name']} is omgevallen. Bezittingen worden verkocht. Wie het eerst belt, krijgt de beste stukken.", "HOOG")
            s["flags"]["faillissement_" + r["name"]] = stamp(s)
            rep.append(f"{r['name']} gaat failliet (kans!)")
    if random.random() < 0.04:
        naam = random.choice(["Kestrel Dynamics", "Nova-Linde GmbH", "Pallas Bio", "Zenith Haven Co", "Roest & Zonen", "Helix Mutual"])
        if naam not in [r["name"] for r in s["rivals"]]:
            sec = random.choice(SECTORS)
            s["rivals"].append({"name": naam, "ceo": random.choice(["Ilse Verhoeven", "Chen Wei", "Rafael Ortega", "Dr. Vos"]),
                                "cash": random.randint(80, 300), "aggression": round(random.uniform(0.2, 0.7), 2),
                                "memory": [], "hq": random.choice("ABCDEFGH"), "sector": sec})
            for m in s["market"].values():
                m["rivals"][naam] = 0.0
            add_mail(s, "Marktonderzoek", f"Nieuwe speler: {naam}",
                     f"Nieuwkomer in {sec}. Geld uit onduidelijke bron. Dat is gewoonlijk een signaal.", "NORMAAL")
            rep.append(f"Nieuwe concurrent: {naam}")


def market_rev_mult(s, div_type):
    """Omzetvermenigvuldiger per divisie op basis van marktaandeel vs. rivalen."""
    m = s.get("market", {}).get(div_type)
    if not m:
        return 1.0
    top_riv = max(m["rivals"].values()) if m["rivals"] else 0
    adv = m["player"] - top_riv * 0.6
    return max(0.6, min(1.5, 1.0 + adv))


def division_cost_mult(s, div_type):
    """Kostenvermenigvuldiger: nomadencontract maakt logistiek goedkoper."""
    if div_type in ("Logistiek", "Smokkel") and s["flags"].get("nomad_contract") is True:
        return 0.8
    return 1.0


# ---------- facties ----------
def faction_tick(s, add_mail, rep):
    f = s["factions"]
    if s["flags"].get("nomad_contract_gebroken") and s["flags"].get("nomad_contract") is True:
        s["flags"]["nomad_contract"] = False
        shift_faction(s, "nomaden", -60)
        add_mail(s, "Nomadenleider Isra", "Het pact",
                 "U heeft uw woord teruggenomen. Wij nemen niets terug. Niet vandaag, wel ooit.", "KRITIEK")
        rep.append("Nomadenpact gebroken")
    for k, v in f.items():
        v["standing"] = clamp(v["standing"] * 0.97, -100, 100)
    if s["morale"] < 40:
        shift_faction(s, "vakbond", -3)
    if s["heat"] > 40:
        shift_faction(s, "politie", -2)
        shift_faction(s, "stad", -1)
    if any(d.get("control") == "player" and d["id"] in ("G", "F") for d in s["districts"]):
        shift_faction(s, "straat", 1)
    if s["flags"].get("nomad_contract") is True:
        shift_faction(s, "nomaden", 1)  # houdt het contract warm, niet gratis: zie chaos 'nomaden_eis'
    if faction(s, "vakbond") < -40 and random.random() < 0.15:
        s["morale"] = clamp(s["morale"] - 4)
        add_mail(s, "HR", "Vakbond dreigt met acties",
                 "De vakbond heeft een stakingskas en een lijst grieven. Wij staan bovenaan beide.", "HOOG")


# ---------- personeel: loyaliteit, ambitie en wat er dan gebeurt ----------
def npc_tick(s, add_mail, rep):
    for n in list(s.get("npcs", [])):
        target = 15 + s["morale"] * 0.5 - (n["ambition"] - 50) * 0.3
        n["loyalty"] = round(clamp(n["loyalty"] + (target - n["loyalty"]) * 0.05 + random.uniform(-1.5, 1.5)), 1)
        risk = (35 - n["loyalty"]) / 100 + n["ambition"] / 400 if n["loyalty"] < 35 else 0
        if risk <= 0 or random.random() > risk:
            continue
        role = n.get("role", "").lower()
        # ambitieuze, ontrouwe mensen gaan niet weg, die gaan werken voor zichzelf
        if n["ambition"] >= 60 and not n.get("verraad"):
            n["verraad"] = stamp(s)
            if "cfo" in role:
                s["flags"]["cfo_manipuleert"] = n["name"]
                s["hidden_truth"].append({"id": "cfo_boeken", "waar": True, "inhoud": f"{n['name']} kleurt de maandrapporten en roomt af."})
            elif "pr" in role:
                s["flags"]["pr_lekt"] = n["name"]
                s["hidden_truth"].append({"id": "pr_lek", "waar": True, "inhoud": f"{n['name']} lekt structureel aan de pers."})
            elif "security" in role:
                s["flags"]["security_verkocht"] = n["name"]
                s["hidden_truth"].append({"id": "security_lek", "waar": True, "inhoud": f"{n['name']} verkoopt toegang aan derden."})
            else:
                s["flags"]["verraad_" + n["name"]] = stamp(s)
            continue
        s["npcs"].remove(n)
        to = n.get("benaderd_door") or (random.choice(s["rivals"])["name"] if s["rivals"] else "onbekend")
        add_mail(s, n["name"], "Mijn ontslag",
                 f"Na rijp beraad stop ik als {n['role']}, per direct. Ik dank u voor de kansen. Mijn badge ligt bij de receptie.", "HOOG")
        add_mail(s, "HR", f"Vertrek {n['role']}",
                 f"{n['name']} is weg. Volgens de wandelgangen naar {to}. Wat er in het hoofd van {n['name']} zat, gaat mee.", "HOOG")
        s["morale"] = clamp(s["morale"] - 3)
        s["flags"]["vacature_" + n["role"]] = stamp(s)
        for r in s["rivals"]:
            if r["name"] == to:
                r["memory"].append(f"{stamp(s)}: nam {n['name']} ({n['role']}) over")
                r["memory"] = r["memory"][-12:]
        rep.append(f"{n['name']} ({n['role']}) neemt ontslag")
    # lopend verraad heeft gevolgen
    if s["flags"].get("cfo_manipuleert") and random.random() < 0.5:
        stolen = round(random.uniform(1, 4), 1)
        s["cash"] = round(s["cash"] - stolen, 1)
    if s["flags"].get("pr_lekt") and random.random() < 0.25:
        s["reputation"] = clamp(s["reputation"] - 3)
        add_mail(s, "Journalist", "Vraag om reactie",
                 "Ik heb interne notulen van uw laatste directievergadering. Wilt u reageren voor publicatie? Morgen gaat het online.", "HOOG")
    if s["flags"].get("security_verkocht") and random.random() < 0.15:
        s["cash"] = round(s["cash"] - random.uniform(5, 15), 1)
        add_mail(s, "IT", "Inbraak zonder braaksporen",
                 "Iemand is binnengekomen met een geldige badge. De logs van die nacht zijn gewist. Netjes gewist.", "HOOG")


# ---------- nomaden & rare gebeurtenissen (onvoorspelbaar) ----------
def chaos_tick(s, add_mail, rep, diff):
    if random.random() > 0.35:
        return
    n = faction(s, "nomaden")
    contract = s["flags"].get("nomad_contract") is True
    broken = bool(s["flags"].get("nomad_contract_gebroken"))
    table = [
        ("nomaden_konvooi", 3),
        ("nomaden_ruil", 2),
        ("nomaden_conflict", (5 if broken else 2) if n < 10 else 0),
        ("nomaden_eis", 3 if contract else 0),
        ("cyberpsycho", 2 if any(d["type"] == "Cyberware" for d in s["divisions"]) else 0.5),
        ("spookzending", 1.5),
        ("heimwee_ai", 1),
        ("sekte_roest", 1.5),
        ("overstroming", 1),
        ("dode_cfo_brief", 0 if s["flags"].get("dode_cfo_pakket") else 1),
        ("slimme_vreemdeling", 1.5),
        ("stroomstoring", 1.5),
        ("gemeentelijk_feest", 1),
        ("tip_van_straat", 2),
    ]
    tot = sum(w for _, w in table)
    r = random.uniform(0, tot)
    acc = 0
    pick = table[0][0]
    for name, w in table:
        acc += w
        if w and r <= acc:
            pick = name
            break
    dist = random.choice(s["districts"])["name"]

    def eff(cash=0, rep_=0, mor=0, heat=0, nom=0):
        s["cash"] = round(s["cash"] + cash * diff, 1)
        s["reputation"] = clamp(s["reputation"] + rep_)
        s["morale"] = clamp(s["morale"] + mor)
        s["heat"] = clamp(s["heat"] + heat)
        shift_faction(s, "nomaden", nom)

    if pick == "nomaden_konvooi":
        if n >= 15 or contract:
            eff(cash=6, nom=3)
            add_mail(s, "Logistiek", "Konvooi uit de woestenij",
                     "Een nomaden-konvooi van de Zwarte Kraai-clan levert onderdelen. Geen papieren. Wel korting. Ze willen terugbetaling in gunsten.", "NORMAAL")
        elif n <= -15:
            eff(cash=-12, nom=-2)
            add_mail(s, "Head of Security", "Konvooi blokkeert de Ringweg",
                     "Een clan blokkeert onze leveringen. Ze eisen tol. Ik raad niet aan om met een pistool te onderhandelen. Ik raad niets aan.", "HOOG")
        else:
            eff(cash=-3)
            add_mail(s, "Logistiek", "Konvooi op de Ringweg",
                     "Een nomaden-konvooi vertraagt onze vrachtwagens. Geen vijandigheid, nog niet. Gewoon aanwezigheid.", "LAAG")
    elif pick == "nomaden_ruil":
        eff(nom=2)
        add_mail(s, "Anoniem", "Ruilvoorstel van de clan",
                 "Een nomadenvrouw (kenteken onleesbaar) biedt een koffer 'gekalibreerde onderdelen'. Ze wil data in ruil. Welke data staat er niet bij.", "NORMAAL")
        s["hidden_truth"].append({"id": "ruil", "waar": random.choice([True, False]), "bron": "nomaden"})
    elif pick == "nomaden_conflict":
        eff(cash=-15, nom=-6, heat=3)
        add_mail(s, "Head of Security", "Clan viel depot aan",
                 f"De Zwarte Kraai raakte een depot in {dist}. Er is niets gestolen dat we kunnen opsommen. Maar iemand wilde een boodschap afgeven.", "HOOG")
    elif pick == "nomaden_eis":
        amount = round(random.uniform(3, 8) * diff, 1)
        s["flags"]["nomaden_eis"] = {"bedrag": amount, "sinds": stamp(s)}
        add_mail(s, "Nomadenleider Isra", "Een gunst",
                 f"Het pact is goud waard, toch? Een van onze trucks staat in beslag in de Haven. €{amount}k of een telefoontje naar de juiste persoon. Ik wacht niet lang.", "HOOG")
    elif pick == "cyberpsycho":
        eff(cash=-8, rep_=-4, mor=-3, heat=2)
        add_mail(s, "Head of Security", "Cyberware-incident in " + dist,
                 "Een gebruiker van implantaten is losgeslagen. Drie gewonden, één dode. Pers belt. Of het onze implantaten waren, weet ik nog niet. De pers wacht daar niet op.", "HOOG")
        s["flags"]["cyberpsycho_incident"] = s["flags"].get("cyberpsycho_incident", 0) + 1
    elif pick == "spookzending":
        eff(rep_=-1)
        add_mail(s, "IT", "Pirate-signaal op ons interne netwerk",
                 "Een stem leest woordelijk onze managementnotulen voor. Of iemand heeft een bug geplant, of iemand in de directie praat.", "HOOG")
        s["flags"]["lek_intern"] = True
    elif pick == "heimwee_ai":
        eff(mor=2)
        add_mail(s, "IT", "Het planningssysteem stelt vragen",
                 "Het oude planningssysteem begint te antwoorden in volzinnen. Het vraagt of 'de bezoeker uit 1997' nog leeft. We hebben niemand uit 1997.", "LAAG")
    elif pick == "sekte_roest":
        eff(mor=-2, rep_=-1)
        add_mail(s, "HR", "Medewerkers vertrekken naar de Kerk van Chroom",
                 "Een sekte in Roest rekruteert onze operators. Ze zeggen 'vlees is tijdelijk'. Dat is niet ons loonbeleid.", "NORMAAL")
    elif pick == "overstroming":
        eff(cash=-9)
        add_mail(s, "COO", "Overstroming in " + dist,
                 "Stormvloed. Magazijnen onder water. Verzekeraar vermeldt 'artikel 7'. Dat artikel bestaat niet.", "HOOG")
    elif pick == "dode_cfo_brief":
        add_mail(s, "Notaris Hubrecht", "Afgifte van een brief",
                 "Een voormalig CFO van een rivaal is overleden. Hij liet instructies na dat dit pakket naar u gaat. Ik open het niet.", "HOOG")
        s["flags"]["dode_cfo_pakket"] = True
        target = random.choice(s["rivals"])["name"] if s["rivals"] else "een rivaal"
        s["hidden_truth"].append({"id": "dode_cfo", "waar": True, "inhoud": f"bewijs van illegaal handelen bij {target}"})
    elif pick == "slimme_vreemdeling":
        add_mail(s, "Receptie", "Vreemdeling vraagt naar u",
                 "Een man zonder naam wil u persoonlijk spreken. Hij betaalt contant voor een kop koffie en weigert te verklaren wat hij wil.", "NORMAAL")
        s["hidden_truth"].append({"id": "vreemdeling", "waar": random.choice([True, False]), "bron": "onbekend"})
    elif pick == "stroomstoring":
        eff(cash=-4, mor=-1)
        add_mail(s, "COO", "Stroomstoring in " + dist, "Twee uur duisternis. Noodgenerator weigerde. De monteur zegt dat hij 'dit pas hoort bij sluiting'.", "NORMAAL")
    elif pick == "gemeentelijk_feest":
        eff(rep_=2, cash=-2)
        add_mail(s, "PR", "Gemeente vraagt sponsoring",
                 "Een stadsfeest in de Oude Stad zoekt een hoofdsponsor. Een kans, een kostenpost, en een bom aan fotografen.", "LAAG")
    elif pick == "tip_van_straat":
        add_mail(s, "Anoniem", "Tip: iemand praat over u in Roest",
                 "Een bron beweert dat een rivaal een sabotage plant. Of dit waar is, weten we niet. De bron vraagt €2k.", "NORMAAL")
        s["hidden_truth"].append({"id": "tip", "waar": random.random() < 0.5, "bron": "straat"})


def nomad_demand_tick(s, add_mail, rep):
    """Een onbeantwoorde eis van de nomaden kost na een maand standing."""
    eis = s["flags"].get("nomaden_eis")
    if not isinstance(eis, dict):
        return
    if eis.get("sinds") == stamp(s):
        return
    s["flags"].pop("nomaden_eis")
    shift_faction(s, "nomaden", -12)
    add_mail(s, "Nomadenleider Isra", "Genoteerd",
             "U had het druk. Wij onthouden wie het druk heeft.", "NORMAAL")
    rep.append("Nomaden-eis genegeerd")


# ---------- geruchten (onbetrouwbaar) ----------
RUMORS = [
    ("rivaal_fusie", "Gerucht: twee rivalen bespreken een fusie."),
    ("overheid_regels", "Gerucht: de stad schrijft nieuwe regels voor implantaten."),
    ("vonk_terug", "Gerucht: Mara Vonk is terug in Neon Mile. Iemand zag de vuist met de bliksem op een muur."),
    ("nomaden_pact", "Gerucht: nomadenclans sluiten een pact en gaan de Ringweg tolheffen."),
    ("ceo_verdwenen", "Gerucht: de CEO van een rivaal is verdwenen. Of op vakantie."),
    ("bank_wankelt", "Gerucht: de bank in de Oude Stad staat er slechter voor dan ze zegt."),
    ("mol", "Gerucht: een rivaal heeft iemand binnen in uw bedrijf."),
]


def rumor_tick(s, add_mail):
    if random.random() < 0.3:
        rid, txt = random.choice(RUMORS)
        truth = random.random() < 0.55
        if rid == "mol":
            truth = bool(s["flags"].get("security_verkocht") or s["flags"].get("pr_lekt") or s["flags"].get("cfo_manipuleert")) or random.random() < 0.2
        s["hidden_truth"].append({"id": rid, "waar": truth, "datum": stamp(s)})
        add_mail(s, "Gerucht (bron onbekend)", "Gerucht in de lift", txt + " Betrouwbaarheid: onbekend.", "LAAG")


# ---------- verhaalbogen ----------
# Een stage met "gm_decision" zet flag wacht_op_speler_<arc>. De boog staat stil
# tot de GM die flag verwijdert en de keuze vastlegt (zie CLAUDE.md).
# Een stage met "resolve" roept RESOLVERS[arc] aan: die rekent de keuze door.
ARCS = {
    "vonk": {
        "start_chance": 0.05,
        "stages": [
            {"delay": 2, "from": "Receptie", "subject": "Graffiti op de HQ-muur",
             "body": "Iemand heeft 'JULLIE ETEN DE STAD OP' op de muur gespoten. Signatuur: een vuist die een bliksemschicht vasthoudt. De schoonmaakploeg vraagt overuren.",
             "effect": {"reputation": -1}},
            {"delay": 2, "from": "PR", "subject": "Illegaal concert in Neon Mile",
             "body": "Mara Vonk, frontvrouw van punkband Kortsluiting, speelde gisteren op het dak van een parkeergarage. Het refrein was onze bedrijfsnaam, gevolgd door een woord dat ik hier niet typ. Tweehonderd telefoons filmden mee.",
             "effect": {"reputation": -3, "heat": 2}, "flag": "vonk_concert"},
            {"delay": 3, "from": "Mara Vonk", "subject": "Een voorstel, geen verzoek",
             "body": "Je hebt het nummer gehoord. Er komen er meer. Twee opties: je financiert mijn volgende tour en ik zing over iemand anders, of je wordt mijn album. Geen contract, geen advocaten. - M.V.",
             "effect": {}, "flag": "vonk_keuze", "gm_decision": True},
            {"delay": 2, "from": "Straat", "subject": "Neon Mile heeft besloten",
             "body": "", "effect": {}, "resolve": True},
        ],
    },
    "nomaden_pact": {
        "start_chance": 0.04,
        "stages": [
            {"delay": 2, "from": "Logistiek", "subject": "Clans verzamelen aan de Ringweg",
             "body": "Meerdere clans staan stil bij het knooppunt. Geen aanvallen, geen vragen. Iemand ziet een zwarte vlag met een kraai.",
             "effect": {}, "flag": "nomaden_verzameling"},
            {"delay": 3, "from": "Nomadenleider Isra", "subject": "Een uitnodiging",
             "body": "We hebben uw bedrijf gezien. We vragen geen vriendschap. We vragen toegang tot uw netwerk, in ruil voor bescherming op de Ringweg.",
             "effect": {}, "flag": "nomaden_aanbod", "gm_decision": True},
            {"delay": 1, "from": "Nomadenleider Isra", "subject": "Ons antwoord op uw antwoord",
             "body": "", "effect": {}, "resolve": True},
        ],
    },
    "hostile_bid": {
        "start_chance": 0.03,
        "stages": [
            {"delay": 3, "from": "Marktwacht", "subject": "Ongewone aandelenaankopen",
             "body": "Iemand koopt stilletjes onze aandelen op. De bron is een holding in een belastingparadijs. De namen zijn geen namen.",
             "effect": {"reputation": -1}},
            {"delay": 3, "from": "Advocaat De Wit", "subject": "Formeel overnamebod ontvangen",
             "body": "Een 'vriendelijk' overnamebod ligt op tafel. U heeft 30 dagen. Een verdediging kost geld. Niets doen kost de baan.",
             "effect": {"heat": 1}, "flag": "overnamebod", "gm_decision": True},
            {"delay": 1, "from": "Advocaat De Wit", "subject": "Uitslag overnamestrijd",
             "body": "", "effect": {}, "resolve": True},
        ],
    },
}


def _resolve_vonk(s, add_mail, rep, diff):
    deal = s["flags"].get("vonk_deal", "negeren")
    if deal == "sponsor":
        shift_faction(s, "straat", 15)
        shift_faction(s, "politie", -5)
        s["heat"] = clamp(s["heat"] + 5)
        s["reputation"] = clamp(s["reputation"] + 2)
        body = ("Kortsluiting speelt een nieuw nummer. Het gaat over de burgemeester. Uw logo hangt klein naast het podium. "
                "Neon Mile vindt u ineens minder erg. De politie vindt u ineens interessanter.")
    elif deal == "uitgeschakeld":
        shift_faction(s, "straat", -25)
        s["heat"] = clamp(s["heat"] + 15)
        if random.random() < 0.35:
            s["reputation"] = clamp(s["reputation"] - 15)
            s["flags"]["vonk_schandaal"] = stamp(s)
            add_lingering(s, "Boycot na Vonk-schandaal", 3, {"reputation": -1, "morale": -1})
            body = ("Mara Vonk is van de straat. En iemand heeft een opname van een telefoontje vanuit ons gebouw. "
                    "Het staat op elke muur in Roest. Dit gaat niet over.")
            rep.append("Vonk-zaak lekt uit")
        else:
            s["hidden_truth"].append({"id": "vonk_spoor", "waar": True, "inhoud": "Er bestaat ergens een spoor naar de opdrachtgever."})
            body = ("Kortsluiting heeft het laatste concert afgezegd. Niemand weet waarom. Neon Mile is stil, "
                    "en stil is in Neon Mile nooit een goed teken.")
    else:
        months = random.randint(1, 3)
        add_lingering(s, "Vonk zingt over ons", months, {"reputation": -2})
        body = ("Het nieuwe album heet naar ons bedrijf. Het staat op elke radio die niet van ons is. "
                f"Verwacht {months} maand(en) reputatieschade.")
    return body


def _resolve_nomaden(s, add_mail, rep, diff):
    if s["flags"].get("nomad_contract") is True:
        shift_faction(s, "nomaden", 20)
        return ("Het pact staat. Onze trucks rijden voortaan veilig over de Ringweg, en uw logistiek wordt goedkoper. "
                "Wij vragen soms een gunst. Wie weigert, merkt dat de Ringweg lang is.")
    shift_faction(s, "nomaden", -10)
    s["flags"]["nomad_contract"] = False
    return "U heeft nee gezegd. Dat is uw goed recht. De Ringweg is ook van ons. Rij voorzichtig."


DEFENSES = {
    # basiskans op afslaan, extra per k€ budget, neveneffecten
    "niets": (0.15, 0.0),
    "investeren": (0.35, 1 / 200),
    "white_knight": (0.60, 0.0),
    "juridisch": (0.35, 1 / 150),
    "poison_pill": (0.75, 0.0),
}


def _resolve_bid(s, add_mail, rep, diff):
    d = s.get("hostile_bid") or {}
    defense = d.get("verdediging", "niets")
    if defense not in DEFENSES:
        defense = "niets"
    budget = float(d.get("budget", 0) or 0)
    base, per_k = DEFENSES[defense]
    chance = base + budget * per_k + (s["reputation"] - 30) / 300 + (0.05 if s["cash"] > 150 else 0)
    chance = max(0.05, min(0.92, chance / diff ** 0.5))
    roll = random.random()
    won = roll < chance
    d.update({"kans": round(chance, 2), "rol": round(roll, 2), "uitslag": "afgeslagen" if won else "verloren"})
    s["hostile_bid"] = d
    rep.append(f"Overnamestrijd ({defense}): rol {roll:.2f} vs kans {chance:.2f} -> {'afgeslagen' if won else 'verloren'}")
    if defense == "white_knight":
        s["flags"]["white_knight_schuld"] = d.get("white_knight", True)
    if defense == "poison_pill":
        s["morale"] = clamp(s["morale"] - 10)
        s["reputation"] = clamp(s["reputation"] - 5)
        s["debt"] = round(s["debt"] + 50, 1)
    if defense == "juridisch":
        s["heat"] = clamp(s["heat"] + 3)
    if won:
        return (f"Het bod is van tafel (verdediging: {defense}). De kopers trekken zich terug, voor nu. "
                "Ze hebben wel geleerd hoe we reageren.")
    if s["player"].get("difficulty") == "Casual" and s["divisions"]:
        biggest = max(s["divisions"], key=lambda x: x["level"])
        s["divisions"].remove(biggest)
        s["cash"] = round(s["cash"] * 0.7, 1)
        return (f"We verliezen de strijd gedeeltelijk. De kopers nemen divisie '{biggest.get('name', biggest['type'])}' "
                "en 30% van de kas mee als schikking. U blijft CEO van wat er over is.")
    s["flags"]["overgenomen"] = True
    return ("De aandeelhouders hebben gekozen. Morgen staat er een andere naam op de deur. "
            "Uw badge werkt tot middernacht.")


RESOLVERS = {"vonk": _resolve_vonk, "nomaden_pact": _resolve_nomaden, "hostile_bid": _resolve_bid}


def arcs_tick(s, add_mail, rep, diff=1.0):
    active_ids = {a["id"] for a in s["arcs"]}
    done = s["flags"].get("arcs_done", [])
    for aid, arc in ARCS.items():
        if aid not in active_ids and aid not in done and random.random() < arc["start_chance"]:
            s["arcs"].append({"id": aid, "stage": 0, "next_in": arc["stages"][0]["delay"]})
            rep.append(f"Verhaallijn gestart: {aid}")
    for a in list(s["arcs"]):
        if a["id"] not in ARCS:
            s["arcs"].remove(a)
            continue
        if s["flags"].get("wacht_op_speler_" + a["id"]):
            rep.append(f"Verhaallijn {a['id']} wacht op een keuze van de CEO")
            continue
        a["next_in"] -= 1
        if a["next_in"] > 0:
            continue
        stage = ARCS[a["id"]]["stages"][a["stage"]]
        body = stage["body"]
        if stage.get("resolve"):
            body = RESOLVERS[a["id"]](s, add_mail, rep, diff)
        add_mail(s, stage["from"], stage["subject"], body, "HOOG" if stage.get("gm_decision") or stage.get("resolve") else "NORMAAL")
        e = stage.get("effect", {})
        s["reputation"] = clamp(s["reputation"] + e.get("reputation", 0))
        s["heat"] = clamp(s["heat"] + e.get("heat", 0))
        if stage.get("flag"):
            s["flags"][stage["flag"]] = stamp(s)
        if stage.get("gm_decision"):
            s["flags"]["wacht_op_speler_" + a["id"]] = True
        a["stage"] += 1
        if a["stage"] >= len(ARCS[a["id"]]["stages"]):
            s["arcs"].remove(a)
            s["flags"].setdefault("arcs_done", []).append(a["id"])
            rep.append(f"Verhaallijn afgerond: {a['id']}")
        else:
            a["next_in"] = ARCS[a["id"]]["stages"][a["stage"]]["delay"]


# ---------- hoofdingang ----------
def world_tick(s, diff, add_mail, rep):
    migrate(s)
    s["accounts"]["operationeel"] = s["cash"]
    lingering_tick(s, rep, diff)
    invoices_tick(s, add_mail, rep, diff)
    market_tick(s, add_mail, rep, diff)
    faction_tick(s, add_mail, rep)
    npc_tick(s, add_mail, rep)
    nomad_demand_tick(s, add_mail, rep)
    chaos_tick(s, add_mail, rep, diff)
    rumor_tick(s, add_mail)
    arcs_tick(s, add_mail, rep, diff)
    s["accounts"]["operationeel"] = s["cash"]
    s["hidden_truth"] = s["hidden_truth"][-30:]
