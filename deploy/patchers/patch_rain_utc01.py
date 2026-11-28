# T-RAIN-UTC-01 (28/11/2026, απόφαση Μιχάλη «Ναι στη βροχή σε UTC, ο πυρήνας αργότερα» + «Από 1/12 μόνο»).
# Βροχή (690e3217) και KBDI (681bb24d): ημέρα / εβδομάδα / μήνας / έτος σε UTC από Τρίτη 1/12/2026 00:00 UTC.
# Κανόνας ίδιος με την αλλαγή της 5/10: η περίοδος του νέου συστήματος που περιέχει την αλλαγή ξεκινά στην αρχή της
# παλιάς περιόδου (ώρα Ελλάδας) που την περιέχει, ώστε κάθε ώρα να μετρά ακριβώς μία φορά και καμία παλιά εγγραφή να μη
# διπλομετρηθεί:  ημέρα 1/12 = 30/11 22:00Z → 2/12 00:00Z (26 ω) · εβδομάδα W49 = 29/11 22:00Z → 7/12 00:00Z ·
# Δεκέμβριος = 30/11 22:00Z → 1/1/2027 00:00Z · έτος 2026 = 1/1/2026 00:00Z → 1/1/2027 00:00Z. Οι ώρες δεν αλλάζουν.
# Τίποτα παλιό δεν ξαναγράφεται ούτε σβήνεται (οι σταθμοί είναι immutable). RAIN_ALG μένει 'v34' (οι καταναλωτές το κατατάσσουν).
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

M = "T-RAIN-UTC-01"
P1 = "analysis/calculate_old_rainHeightSums.js"
o1 = patch(P1, [
  (''' * Το παλαιότερο ιστορικό (εγγραφές v33) ΔΕΝ σβήνεται ούτε ξαναγράφεται.''',
   ''' * 11. UTC ΑΠΟ 1/12 (v34.5, 28/11/2026 · T-RAIN-UTC-01, απόφαση Μιχάλη «χρόνος αναφοράς UTC», SC-0006/SC-0017):
 *     ημέρα / εβδομάδα / μήνας / έτος σε UTC από Τρίτη 1/12/2026 00:00 UTC. Η περίοδος που περιέχει την αλλαγή
 *     ξεκινά στην αρχή της αντίστοιχης περιόδου ώρας Ελλάδας: ημέρα 1/12 = 30/11 22:00Z–2/12 00:00Z (26 ω), εβδομάδα
 *     W49 = 29/11 22:00Z–7/12 00:00Z, Δεκέμβριος = 30/11 22:00Z–1/1/2027 00:00Z. Οι εγγραφές 5/10–30/11 μένουν σε ώρα Ελλάδας.
 *
 * Το παλαιότερο ιστορικό (εγγραφές v33) ΔΕΝ σβήνεται ούτε ξαναγράφεται.'''),
  ('''const RAIN_VERSION = "v34.4 · 2026-11-27";''', '''const RAIN_VERSION = "v34.5 · 2026-11-28";'''),
  ('''const DEFAULT_CUTOVER = "2026-10-04T21:00:00.000Z";   // Δευτέρα 5/10/2026 00:00 ώρα Ελλάδας''',
   '''const DEFAULT_CUTOVER = "2026-10-04T21:00:00.000Z";   // Δευτέρα 5/10/2026 00:00 ώρα Ελλάδας
const DEFAULT_UTC_FROM = "2026-12-01T00:00:00.000Z";  // T-RAIN-UTC-01: Τρίτη 1/12/2026 00:00 UTC — από εδώ περίοδοι σε UTC
let UTC_FROM_MS = Date.parse(DEFAULT_UTC_FROM);       // RAIN_UTC_FROM στο περιβάλλον = άλλη ημερομηνία· «off» = ποτέ'''),
  ('''function periodContaining(unit, ms, TZ, cutMs) {
  const u = UNITS[unit];''',
   '''function periodContaining(unit, ms, TZ, cutMs) {
  // T-RAIN-UTC-01: από την αρχή της παλιάς περιόδου που περιέχει το UTC_FROM και μετά → περίοδοι UTC· η πρώτη
  // περίοδος UTC (αυτή που περιέχει το UTC_FROM) ξεκινά στην αρχή εκείνης της παλιάς περιόδου.
  if (unit !== 'hour' && Number.isFinite(UTC_FROM_MS) && cutMs < UTC_FROM_MS) {
    const old = periodContainingTz(unit, UTC_FROM_MS, TZ, cutMs);
    if (ms >= old.s) {
      const u2 = UNITS[unit];
      const st = moment.utc(Math.max(ms, UTC_FROM_MS)).startOf(u2);
      const e = st.clone().add(1, unit === 'week' ? 'week' : u2).valueOf();
      const first = st.valueOf() <= UTC_FROM_MS && e > UTC_FROM_MS;   // η περίοδος που περιέχει την αλλαγή
      const s = first ? old.s : st.valueOf();
      const key = unit === 'week' ? st.format('GGGG-[W]WW') : unit === 'day' ? st.format('YYYY-MM-DD')
        : unit === 'month' ? st.format('YYYY-MM') : st.format('YYYY');
      // st0 = πραγματική αρχή (για previousPeriod): στην πρώτη, εκείνη της παλιάς περιόδου (π.χ. έτος 2026 → πριν = 2025)
      return { unit, s, e, st0: first ? old.st0 : s, key, utc: true };
    }
  }
  return periodContainingTz(unit, ms, TZ, cutMs);
}
function periodContainingTz(unit, ms, TZ, cutMs) {
  const u = UNITS[unit];'''),
  ('''    if (!moment.tz.zone(TZ) || !Number.isFinite(cutMs)) return console.log("Άκυρο RAIN_TZ / RAIN_CUTOVER");''',
   '''    if (!moment.tz.zone(TZ) || !Number.isFinite(cutMs)) return console.log("Άκυρο RAIN_TZ / RAIN_CUTOVER");
    { const uf = String(getOptionalEnv(context, "RAIN_UTC_FROM", DEFAULT_UTC_FROM)); UTC_FROM_MS = uf === "off" ? NaN : Date.parse(uf); }   // T-RAIN-UTC-01'''),
  ('''    console.log(`Βροχή ${RAIN_VERSION} · ${TZ} από ${iso(cutMs)} · σταθμοί ${list.length}`);''',
   '''    console.log(`Βροχή ${RAIN_VERSION} · ${TZ} από ${iso(cutMs)} · UTC από ${Number.isFinite(UTC_FROM_MS) ? iso(UTC_FROM_MS) : "—"} · σταθμοί ${list.length}`);'''),
  ('''module.exports = { computeForDevice, periodContaining, previousPeriod,''',
   '''module.exports = { computeForDevice, periodContaining, periodContainingTz, setUtcFrom: (ms) => { UTC_FROM_MS = ms; }, previousPeriod,'''),
], M)

P2 = "analysis/kbdi.js"
o2 = patch(P2, [
  ('''const KBDI_VERSION = "kbdi-v2 · 2026-11-28";''', '''const KBDI_VERSION = "kbdi-v2.1 · 2026-11-28";'''),
  ('''const CUTOVER_MS = Date.parse("2026-10-04T21:00:00.000Z");   // ίδιο με τον υπολογισμό βροχής (v34)''',
   '''const CUTOVER_MS = Date.parse("2026-10-04T21:00:00.000Z");   // ίδιο με τον υπολογισμό βροχής (v34)
const UTC_FROM_MS = Date.parse("2026-12-01T00:00:00.000Z");   // T-RAIN-UTC-01: ημέρες UTC από 1/12, ίδιο με τη βροχή v34.5'''),
  ('''function dayContaining(ms) {
  const st = moment.tz(ms, TZ).startOf("day");''',
   '''function dayContaining(ms) {
  // T-RAIN-UTC-01: ίδια όρια με τη βροχή v34.5 — από 30/11 22:00Z ημέρες UTC· η 1/12 = 30/11 22:00Z → 2/12 00:00Z.
  const old = dayContainingTz(UTC_FROM_MS);
  if (ms >= old.s) {
    const st = moment.utc(Math.max(ms, UTC_FROM_MS)).startOf("day");
    const e = st.clone().add(1, "day").valueOf();
    return { s: st.valueOf() === UTC_FROM_MS ? old.s : st.valueOf(), e, key: st.format("YYYY-MM-DD") };
  }
  return dayContainingTz(ms);
}
function dayContainingTz(ms) {
  const st = moment.tz(ms, TZ).startOf("day");'''),
], M)

for p, o in ((P1, o1), (P2, o2)): open(p, "wb").write(o.encode("utf-8"))
print("ok · 2 αρχεία")
