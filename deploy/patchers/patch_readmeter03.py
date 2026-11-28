# T-READMETER-03 (28/11/2026, εντολή Μιχάλη «ξεκίνα με τον μετρητή»): ίδιος μετρητής αναγνώσεων με το T-READMETER-02
# στις warehouseSnapshot και subscriptionManage. ΜΟΝΟ καταγραφή στο console· η απάντηση επιστρέφεται αυτούσια, σφάλμα δεν
# καταπίνεται, εγγραφές POST/PUT και λίστες συσκευών/ταμπλό/χρηστών δεν μετρούν. Όλα-ή-τίποτα, node --check.
import subprocess, sys, os, re
src2 = open("deploy/patchers/patch_readmeter02.py", "rb").read().decode("utf-8").replace("\r\n", "\n")
RM_CORE = re.search(r"RM_CORE = '''(.*?)'''", src2, re.S).group(1).replace("T-READMETER-02", "T-READMETER-03")
API_OLD_TAIL = '''  return j.result;
}'''
HOOK = '''  // T-READMETER-03: μόνο αναγνώσεις δεδομένων συσκευών (GET …/data), μόνο καταγραφή
  if ((!opts.method || opts.method === "GET") && /\/device\/[^/]+\/data(\?|$)/.test(path)) {
    const vs = [...path.matchAll(/variables\[\]=([^&]+)/g)].map((m) => m[1]).join("+") || "?";
    _rmCount(vs + (/[?&]query=/.test(path) ? "·query" : ""), /[?&]query=/.test(path), j.result);
  }
  return j.result;
}'''

def patch(path, subs):
    raw = open(path, "rb").read().decode("utf-8"); crlf = "\r\n" in raw; s = raw.replace("\r\n", "\n")
    assert "T-READMETER-03" not in s, f"{path}: ήδη εφαρμοσμένο"
    for a, b in subs:
        n = s.count(a)
        if n != 1: sys.exit(f"ΑΠΟΤΥΧΙΑ {path}: {n} εμφανίσεις του {a[:80]!r}")
        s = s.replace(a, b)
    out = s.replace("\n", "\r\n") if crlf else s
    tmp = path + ".tmp_check.js"; open(tmp, "wb").write(out.encode("utf-8"))
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.remove(tmp)
    if r.returncode: sys.exit(f"node --check {path}: " + r.stderr)
    return out

def api_sub(errlen):
    head = '''async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, ''' + errlen + '''));
'''
    return (head + API_OLD_TAIL, RM_CORE + head + HOOK)

P1 = "analysis/warehouseSnapshot.js"
o1 = patch(P1, [api_sub("140"),
  ('''})().catch((e) => {
  console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
  console.log("══ warehouseSnapshot · ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
});''', '''})().catch((e) => {
  console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
  console.log("══ warehouseSnapshot · ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
}).finally(() => { try { console.log(_rmLine()); } catch (_e) { /* μόνο καταγραφή */ } });''')])

P2 = "analysis/subscriptionManage.js"
o2 = patch(P2, [api_sub("160"),
  ('''  main().catch((e) => {
    console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
    console.log("══ ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
  });''', '''  main().catch((e) => {
    console.log("ΣΦΑΛΜΑ|" + ((e && e.message) || e));
    console.log("══ ΤΕΛΟΣ ΜΕ ΣΦΑΛΜΑ ══");
  }).finally(() => { try { console.log(_rmLine()); } catch (_e) { /* μόνο καταγραφή */ } });''')])

for p, o in ((P1, o1), (P2, o2)): open(p, "wb").write(o.encode("utf-8"))
print("ok · 2 αρχεία")
