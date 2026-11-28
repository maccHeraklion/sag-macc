# T-READMETER-02 (28/11/2026, εντολή Μιχάλη «κάνε και τον μετρητή αναγνώσεων στις άλλες αναλύσεις»).
# Μετρητής αναγνώσεων ΜΟΝΟ καταγραφή (όπως T-READMETER-01 σε πυρήνα και βροχή) σε stationHealth, kbdi, gatewayLiveness.
# Μετρά κλήσεις ανάγνωσης δεδομένων, εγγραφές που επέστρεψε η πλατφόρμα, και χωριστά τα ερωτήματα συνάθροισης (κλήσεις + γραμμές).
# Η απάντηση επιστρέφεται αυτούσια· σφάλμα ΔΕΝ καταπίνεται· κανένα αποτέλεσμα/εγγραφή δεν αλλάζει. Όλα-ή-τίποτα, node --check.
import subprocess, sys, os

def patch(path, subs, marker):
    raw = open(path, "rb").read().decode("utf-8"); crlf = "\r\n" in raw; s = raw.replace("\r\n", "\n")
    assert marker not in s, f"{path}: ήδη εφαρμοσμένο"
    for a, b in subs:
        n = s.count(a)
        if n != 1: sys.exit(f"ΑΠΟΤΥΧΙΑ {path}: {n} εμφανίσεις του {a[:80]!r}")
        s = s.replace(a, b)
    out = s.replace("\n", "\r\n") if crlf else s
    tmp = path + ".tmp_check.js"; open(tmp, "wb").write(out.encode("utf-8"))
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.remove(tmp)
    if r.returncode: sys.exit(f"node --check {path}: " + r.stderr)
    return out

M = "T-READMETER-02"
RM_CORE = '''// ---------- T-READMETER-02 (28/11/2026): μετρητής αναγνώσεων — ΜΟΝΟ καταγραφή, δεν αλλάζει κανένα αποτέλεσμα ----------
// calls = κλήσεις ανάγνωσης δεδομένων · recs = εγγραφές που επέστρεψε η πλατφόρμα · agg/aggRows = ερωτήματα συνάθροισης και γραμμές τους.
const _RM = { calls: 0, recs: 0, agg: 0, aggRows: 0, byKey: new Map() };
function _rmCount(key, isAgg, r) {
  try {
    const n = Array.isArray(r) ? r.length : (r == null ? 0 : 1);
    _RM.calls++; if (isAgg) { _RM.agg++; _RM.aggRows += n; } else _RM.recs += n;
    const e = _RM.byKey.get(key) || [0, 0]; e[0]++; e[1] += n; _RM.byKey.set(key, e);
  } catch (_e) { /* μόνο καταγραφή */ }
}
function _rmLine() {
  const top = [..._RM.byKey.entries()].sort((a, b) => b[1][1] - a[1][1]).slice(0, 8).map(([k, v]) => k + " " + v[1] + "/" + v[0]);
  return "[T-READMETER-02] αναγνώσεις: " + _RM.recs + " εγγραφές σε " + (_RM.calls - _RM.agg) + " κλήσεις · ερωτήματα συνάθροισης " + _RM.agg +
    " (" + _RM.aggRows + " γραμμές) · ανά είδος (εγγραφές/κλήσεις): " + top.join(" · ");
}
'''

# ---------------- stationHealth (REST, node-rt2025) ----------------
P1 = "analysis/stationHealth.js"
o1 = patch(P1, [
  ('''// ---------- REST (node-rt2025) ----------
const API = "https://api.us-e1.tago.io";''',
   RM_CORE + '''
// ---------- REST (node-rt2025) ----------
const API = "https://api.us-e1.tago.io";'''),
  ('''      getDeviceData: (id, q) => call("GET", `/device/${id}/data?` + qs({ variable: q.variables[0], query: q.query, interval: q.interval, function: q.function,
        start_date: q.start_date, end_date: q.end_date, qty: q.qty, ordination: q.ordination })),''',
   '''      getDeviceData: async (id, q) => {
        const r = await call("GET", `/device/${id}/data?` + qs({ variable: q.variables[0], query: q.query, interval: q.interval, function: q.function,
          start_date: q.start_date, end_date: q.end_date, qty: q.qty, ordination: q.ordination }));
        _rmCount(q.variables[0] + (q.query ? "·" + q.query + (q.function ? ":" + q.function : "") : ""), !!q.query, r);   // T-READMETER-02
        return r;
      },'''),
  ('''  run(restClient(process.env.T_ANALYSIS_TOKEN), Date.now(), (m) => console.log(m))
    .catch((e) => console.log("stationHealth: σφάλμα " + (e && e.message ? e.message : e)));''',
   '''  run(restClient(process.env.T_ANALYSIS_TOKEN), Date.now(), (m) => console.log(m))
    .catch((e) => console.log("stationHealth: σφάλμα " + (e && e.message ? e.message : e)))
    .finally(() => { try { console.log(_rmLine()); } catch (_e) { /* μόνο καταγραφή */ } });'''),
], M)

# ---------------- kbdi (SDK Device) ----------------
P2 = "analysis/kbdi.js"
o2 = patch(P2, [
  ('''// ---------- δεδομένα ----------
async function hourlyAgg(''',
   RM_CORE + '''function _rmWrap(device) {
  const raw = device.getData.bind(device);
  device.getData = async function (q) {
    const r = await raw(q);
    _rmCount((q && q.variables ? q.variables.join("+") : "?") + (q && q.query ? "·" + q.query + (q.function ? ":" + q.function : "") : ""), !!(q && q.query), r);
    return r;
  };
  return device;
}

// ---------- δεδομένα ----------
async function hourlyAgg('''),
  ('''      const device = new Device({ token: await Utils.getTokenByName(account, info.id) });''',
   '''      const device = _rmWrap(new Device({ token: await Utils.getTokenByName(account, info.id) }));   // T-READMETER-02'''),
  ('''  context.log(`KBDI ${KBDI_VERSION}: ${devices.length} σταθμοί · ${total} εγγραφές`);''',
   '''  context.log(`KBDI ${KBDI_VERSION}: ${devices.length} σταθμοί · ${total} εγγραφές`);
  try { context.log(_rmLine()); } catch (_e) { /* μόνο καταγραφή */ }'''),
], M)

# ---------------- gatewayLiveness (REST api()) ----------------
P3 = "analysis/gatewayLiveness.js"
o3 = patch(P3, [
  ('''async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}''',
   RM_CORE + '''async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  // T-READMETER-02: μόνο αναγνώσεις δεδομένων συσκευών (GET …/data), μόνο καταγραφή
  if ((!opts.method || opts.method === "GET") && /\\/device\\/[^/]+\\/data(\\?|$)/.test(path)) {
    const vs = [...path.matchAll(/variables\\[\\]=([^&]+)/g)].map((m) => m[1]).join("+") || "?";
    _rmCount(vs + (/[?&]query=/.test(path) ? "·query" : ""), /[?&]query=/.test(path), j.result);
  }
  return j.result;
}'''),
  ('''  console.log("══ gatewayLiveness · ΤΕΛΟΣ ══");''',
   '''  try { console.log(_rmLine()); } catch (_e) { /* μόνο καταγραφή */ }
  console.log("══ gatewayLiveness · ΤΕΛΟΣ ══");'''),
], M)

for p, o in ((P1, o1), (P2, o2), (P3, o3)):
    open(p, "wb").write(o.encode("utf-8"))
print("ok · 3 αρχεία")
