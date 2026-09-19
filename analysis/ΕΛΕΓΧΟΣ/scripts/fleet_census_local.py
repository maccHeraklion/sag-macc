# -*- coding: utf-8 -*-
"""T-FLEET-CENSUS-01 v2 — diorthoseis meta apo epalithefsi:
   1) to tag `devices` einai ANTIKEIMENO rolos->deviceId, OXI pinakas. .values()
   2) agros = opoiadipote syskevi me tag isField (i timi mporei na einai 'yesKEK')
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
print("SYNOLO=%d | AGROI=%d" % (len(devs), len(fields)))

# soil-salinity capable types (conduct_soil / EC)
EC_TYPES = {"se0x", "lse02", "lse01"}

rows = []
for f in fields:
    raw = one(f, "devices")
    ids, roles, badjson = [], [], False
    try:
        obj = json.loads(raw) if raw else {}
        if isinstance(obj, dict):
            roles = sorted(obj.keys())
            ids = [str(v) for v in obj.values()]
        elif isinstance(obj, list):
            ids = [str(v) for v in obj]
            roles = ["<ΠΙΝΑΚΑΣ>"]
    except Exception:
        badjson = True
    tys, orphan = [], 0
    for i in ids:
        s = byid.get(i)
        if s is None:
            orphan += 1
            continue
        t = one(s, "type")
        if t and t not in tys:
            tys.append(t)
    # role-key convention: generic type key vs full device name
    conv = "τύπος" if all(("_0" not in r and "_" not in r.strip("_") or r in EC_TYPES or r in
                           {"lms01_ls", "em300_th", "em320_th", "outdoor_istation"}) for r in roles) else "ΜΙΚΤΗ"
    generic = [r for r in roles if r in {"lms01_ls", "lse01", "lse02", "se0x", "uc511", "s2120",
                                         "em300_th", "em320_th", "sph01", "uc501"}]
    named = [r for r in roles if r not in generic and r != "<ΠΙΝΑΚΑΣ>"]
    rows.append({"name": one(f, "name") or f["name"], "id": f["id"],
                 "client": one(f, "clientName"), "ft": one(f, "field_type"),
                 "isf": "|".join(vals(f, "isField")),
                 "n": len(ids), "orphan": orphan, "tys": sorted(tys),
                 "ngen": len(generic), "nnamed": len(named), "badjson": badjson,
                 "hascfg": has(f, "configuration"), "ec": sorted(set(tys) & EC_TYPES)})

rows.sort(key=lambda r: r["name"])
print("\n=== D · ANA AGRO (diorthomeno) ===")
for r in rows:
    print("A|%-30s|pel=%-20s|typos_agrou=%-22s|dev=%-2d|orfana=%-2d|EC=%-12s|typoi=%s"
          % (r["name"][:30], r["client"][:20], r["ft"][:22], r["n"], r["orphan"],
             ",".join(r["ec"]) or "—", ",".join(r["tys"]) or "—"))

print("\n=== D2 · SE POSOUS AGROUS YPARXEI KATHE TYPOS (apo %d) ===" % len(rows))
tf = collections.Counter()
for r in rows:
    for t in r["tys"]:
        tf[t] += 1
for t, k in tf.most_common():
    print("T|%-16s| se %2d/%d agrous%s" % (t, k, len(rows), "   <-- ALATOTITA" if t in EC_TYPES else ""))

print("\n=== F · SYMVASI KLEIDION sto tag `devices` ===")
mixed = [r for r in rows if r["ngen"] and r["nnamed"]]
onlynamed = [r for r in rows if r["nnamed"] and not r["ngen"]]
onlygen = [r for r in rows if r["ngen"] and not r["nnamed"]]
print("mono geniko kleidi (lse02, uc511...) = %d agroi" % len(onlygen))
print("mono plires onoma syskevis         = %d agroi" % len(onlynamed))
print("MIKTI symvasi mesa ston idio agro  = %d agroi" % len(mixed))
for r in mixed:
    print("   ! %s (geniko=%d, onomastiko=%d)" % (r["name"], r["ngen"], r["nnamed"]))

print("\n=== G · YGEIA TON DEIKTON ANA AGRO ===")
print("agroi me orfanes anafores se syskeves = %d" % len([r for r in rows if r["orphan"]]))
for r in rows:
    if r["orphan"]:
        print("   ! %-30s orfanes=%d apo %d" % (r["name"][:30], r["orphan"], r["n"]))
print("agroi XORIS tag configuration = %d" % len([r for r in rows if not r["hascfg"]]))
for r in rows:
    if not r["hascfg"]:
        print("   ! %s" % r["name"])
print("agroi me alloiomeno isField = %d" % len([r for r in rows if r["isf"] != "yes"]))
for r in rows:
    if r["isf"] != "yes":
        print("   ! %-30s isField=%s" % (r["name"][:30], r["isf"]))
