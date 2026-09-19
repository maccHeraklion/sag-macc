# -*- coding: utf-8 -*-
"""T-PROFILE-AUDIT-01 — ELEGXOS OMOIOGENEIAS *KAI* PLIROTITAS ANA PROFIL AGROU.

TO ZITOUMENO (Michalis): ola ta organa kai oi agroi na exoun ENIAIA kai SOSTA
settings — tags, connectors, parsers, analysi. I MONI epitrepti diaforopoiisi
einai o SKOPOS tou agrou:

  * AGRONOMIA   — plires: threpsi + fytoprostasia + ardefsi
  * XENODOXEIO  — gkazon/ktiria (Volta): ardefsi/perivallon, OXI threpsi/fytoprostasia
  * ARDEFSI     — mono ardefsi (Lenta): oute threpsi oute fytoprostasia
  * KAIROS      — mono meteorologika gia prognosi (Cretaweather)

KRISIMO: stis treis teleftaies periptoseis i apousia threpsis/fytoprostasias
DEN EINAI ELLEIPSI. Den mas zitithike. O elegxos DEN prepei na tis kataggelei.

DEN grafei tipota. Diavazei ta idi katevasmena metadedomena.
"""
import io, json, re, collections

D = (u"C:/Users/Katharak/.claude/projects/"
     u"C--Users-Katharak-OneDrive---------------------------------------------MACC/"
     u"ad4c898f-7248-42d1-ae26-0fbb1495c807/tool-results/")
FILES = ["mcp-tagoio-search_devices-1789854569296.txt",
         "mcp-tagoio-search_devices-1789854576783.txt"]
ROW = re.compile(r"^\|\s*([0-9a-f]{24})\s*\|(.*)\|\s*([0-9a-f]{24})\s*\|\s*([0-9a-f]{24})\s*\|\s*$")

devs = []
for fn in FILES:
    for line in io.open(D + fn, encoding="utf-8"):
        m = ROW.match(line.rstrip("\n"))
        if not m:
            continue
        mid = m.group(2)
        i = mid.rfind("|")
        tg = mid[i + 1:].strip().strip("`").strip()
        try:
            tags = json.loads(tg) if tg and tg != "[]" else []
        except Exception:
            tags = []
        devs.append({"id": m.group(1), "name": mid[:i].strip(), "tags": tags,
                     "net": m.group(3), "con": m.group(4)})

def vals(d, k): return [str(t.get("value", "")) for t in d["tags"] if t.get("key") == k]
def one(d, k):
    v = vals(d, k)
    return v[0] if v else ""
def has(d, k): return any(t.get("key") == k for t in d["tags"])

byid = {d["id"]: d for d in devs}
fields = [d for d in devs if has(d, "isField")]

# --- to prototypo connector ana typo (apo tin apografi 21:50) -----------------
STD_CON = {
    "uc511": "68e2531b23e14b000afdf5dd", "s2120": "67adaf5b36089a000a16aa5a",
    "lse01": "69293aaf4da767000a1cc2f1", "lse02": "67adaadd576be9000ab220a6",
    "se0x": "685bafd351843b000ad23a36", "lms01_ls": "614afaa58c6ce300184c16fc",
    "em320_th": "69a84538b7bbe8000917aefc", "em300_th": "655dd4ecda081c000e77e0fc",
    "sph01": "69f1ad1236f05f000a1157e0", "uc501": "695e94cb5a1ac0000a0c0d9b",
}
EC   = {"se0x", "lse02", "lse01"}          # agogimotita -> alatotita
SOIL = {"se0x", "lse02", "lse01"}          # ygrasia/thermokrasia edafous
LEAF = {"lms01_ls"}                        # fyllo -> fytoprostasia
AIR  = {"s2120", "em320_th", "em300_th"}   # aeras / kairos
VALVE = {"uc511", "uc501"}                 # ardefsi

def types_of(f):
    try:
        obj = json.loads(one(f, "devices") or "{}")
    except Exception:
        return None, []
    ids = list(obj.values()) if isinstance(obj, dict) else list(obj)
    tys = []
    for i in ids:
        s = byid.get(str(i))
        if s:
            t = one(s, "type")
            if t:
                tys.append(t)
    return ids, tys

def classify(f, tys):
    """Profil apo ta DEDOMENA. To xenodoxeio DEN prokyptei apo aisthitires —
       einai epixeirimatiki plirofia, oxi texniki. To simeiono ANTI na to manteψo."""
    cl = one(f, "clientName")
    s = set(tys)
    if "ΔΙΑΜΟΝΗ ΣΤΟ VOLTA" in cl:
        return "ΞΕΝΟΔΟΧΕΙΟ", "από τον πελάτη"
    if cl in ("Cretaweather",) and not (s & SOIL) and not (s & VALVE):
        return "ΚΑΙΡΟΣ", "μόνο μετεωρολογικός"
    if not (s & SOIL) and not (s & LEAF) and (s & VALVE):
        return "ΑΡΔΕΥΣΗ", "βάνα χωρίς αγρονομικούς αισθητήρες"
    if not (s & SOIL) and not (s & LEAF) and not (s & VALVE) and (s & AIR):
        return "ΚΑΙΡΟΣ", "μόνο αισθητήρας αέρα"
    if not tys:
        return "ΑΓΝΩΣΤΟ", "καμία συσκευή δεν αναγνωρίστηκε"
    return "ΑΓΡΟΝΟΜΙΑ", "έχει έδαφος ή φύλλο"

# ti APAITEITAI ana profil (True = apaiteitai, False = DEN apaiteitai kai DEN einai elleipsi)
NEEDS = {
    "ΑΓΡΟΝΟΜΙΑ": dict(config=True, crops=True, soil=True, air=True, leaf=True,  ec=True,  valve=False),
    "ΞΕΝΟΔΟΧΕΙΟ": dict(config=True, crops=False, soil=False, air=False, leaf=False, ec=False, valve=True),
    "ΑΡΔΕΥΣΗ":    dict(config=True, crops=False, soil=False, air=False, leaf=False, ec=False, valve=True),
    "ΚΑΙΡΟΣ":     dict(config=False, crops=False, soil=False, air=True, leaf=False, ec=False, valve=False),
    "ΑΓΝΩΣΤΟ":    dict(config=False, crops=False, soil=False, air=False, leaf=False, ec=False, valve=False),
}

rows = []
for f in fields:
    name = one(f, "name") or f["name"]
    ids, tys = types_of(f)
    prof, why = classify(f, tys)
    need = NEEDS[prof]
    s = set(tys)
    gaps, notes = [], []

    # --- BASIKI OMOIOGENEIA: isxyei gia KATHE profil ---
    if vals(f, "isField") != ["yes"]:
        gaps.append("isField=" + "|".join(vals(f, "isField")))
    if len(set(vals(f, "access"))) > 1:
        gaps.append("access ΣΥΓΚΡΟΥΣΗ: " + " / ".join(sorted(set(vals(f, "access")))))
    if not one(f, "coordinates"):
        gaps.append("χωρίς coordinates")
    if ids is None:
        gaps.append("το tag devices ΔΕΝ είναι έγκυρο JSON")
    elif not ids:
        gaps.append("κενό devices")
    else:
        orph = [i for i in ids if str(i) not in byid]
        if orph:
            gaps.append("%d ορφανές αναφορές συσκευών" % len(orph))
        # sympasi kleidion
        try:
            obj = json.loads(one(f, "devices") or "{}")
            keys = list(obj.keys()) if isinstance(obj, dict) else []
        except Exception:
            keys = []
        gen = [k for k in keys if k in STD_CON]
        nam = [k for k in keys if k not in STD_CON]
        if gen and nam:
            gaps.append("ΜΙΚΤΗ σύμβαση στο devices (%d γενικά + %d ονομαστικά)" % (len(gen), len(nam)))
        # connector ektos protypou
        for i in ids:
            sdev = byid.get(str(i))
            if not sdev:
                continue
            t = one(sdev, "type")
            if t in STD_CON and sdev["con"] != STD_CON[t]:
                gaps.append("%s εκτός πρότυπου connector" % sdev["name"])

    # --- PLIROTITA ANA PROFIL ---
    cfg_raw = one(f, "configuration")
    if need["config"] and not cfg_raw:
        gaps.append("χωρίς configuration")
    crops = []
    if cfg_raw:
        try:
            crops = json.loads(cfg_raw).get("crops", []) or []
        except Exception:
            gaps.append("configuration μη αναγνώσιμο")
    if need["crops"] and not crops:
        gaps.append("χωρίς καλλιέργεια (crops) — δεν βγαίνει θρέψη/φυτοπροστασία")
    if need["soil"] and not (s & SOIL):
        gaps.append("χωρίς αισθητήρα εδάφους")
    if need["leaf"] and not (s & LEAF):
        gaps.append("χωρίς αισθητήρα φύλλου — η φυτοπροστασία θα είναι ελλιπής")
    if need["ec"] and not (s & EC):
        gaps.append("χωρίς αγωγιμότητα — δεν βγαίνει αλατότητα")
    if need["air"] and not (s & AIR):
        gaps.append("χωρίς αισθητήρα αέρα")
    if need["valve"] and not (s & VALVE):
        notes.append("δεν βρέθηκε βάνα (ίσως εκτός devices)")

    # oti DEN apaiteitai gia to profil to leme RITA, gia na min to psaxnei kaneis
    skipped = [k for k in ("crops", "soil", "leaf", "ec") if not need[k]]

    rows.append(dict(name=name, client=one(f, "clientName"), prof=prof, why=why,
                     tys=sorted(set(tys)), gaps=gaps, notes=notes, skipped=skipped,
                     ncrops=len(crops)))

rows.sort(key=lambda r: (r["prof"], r["name"]))

print("=== T-PROFILE-AUDIT-01 · ΠΛΗΡΟΤΗΤΑ ΑΝΑ ΠΡΟΦΙΛ · %d ΑΓΡΟΙ ===\n" % len(rows))
cnt = collections.Counter(r["prof"] for r in rows)
for p, n in cnt.most_common():
    print("  %-12s %d αγροί" % (p, n))

for prof in ["ΑΓΡΟΝΟΜΙΑ", "ΞΕΝΟΔΟΧΕΙΟ", "ΑΡΔΕΥΣΗ", "ΚΑΙΡΟΣ", "ΑΓΝΩΣΤΟ"]:
    sel = [r for r in rows if r["prof"] == prof]
    if not sel:
        continue
    need = NEEDS[prof]
    print("\n" + "=" * 74)
    print("ΠΡΟΦΙΛ %s — %d αγροί" % (prof, len(sel)))
    print("  ΑΠΑΙΤΕΙΤΑΙ: " + ", ".join(k for k in need if need[k]))
    off = [k for k in need if not need[k]]
    print("  ΔΕΝ ΑΠΑΙΤΕΙΤΑΙ (και ΔΕΝ είναι έλλειψη): " + (", ".join(off) or "—"))
    print("=" * 74)
    clean = [r for r in sel if not r["gaps"]]
    dirty = [r for r in sel if r["gaps"]]
    print("  ΕΝΤΑΞΕΙ: %d/%d" % (len(clean), len(sel)))
    for r in dirty:
        print("\n  ✗ %s  (%s)" % (r["name"], r["client"][:28]))
        print("      τύποι: %s" % (",".join(r["tys"]) or "—"))
        for g in r["gaps"]:
            print("      → %s" % g)
        for n in r["notes"]:
            print("      · %s" % n)
    if clean:
        print("\n  ✓ χωρίς εύρημα: " + ", ".join(r["name"] for r in clean))
