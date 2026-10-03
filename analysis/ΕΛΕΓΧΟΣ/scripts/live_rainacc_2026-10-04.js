// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ζωντανή δοκιμή της λογικής T-RAIN-ACC-01 (v50.158) με ΑΥΤΟΥΣΙΟ κώδικα πυρήνα.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
function mkDev(id) { return { async getData(q) {
  const p = new URLSearchParams(); p.set("variable", q.variables[0]);
  for (const k of ["end_date", "start_date", "qty", "ordination", "query"]) if (q[k] !== undefined) p.set(k, String(q[k]));
  const r = await fetch(API + "/device/" + id + "/data?" + p.toString(), { headers: { Authorization: TOKEN } });
  const j = await r.json(); if (!j.status) throw new Error(JSON.stringify(j.message)); return j.result; } }; }
const _SAG_RAIN_MAX_MMH = 450;          // όριο οργάνου S2120 (datasheet 0–450 mm/h): έλεγχος ευλογοφάνειας
const _SAG_RAIN_ACC_FRESH_MIN = 180;    // τελευταία τιμή παλαιότερη → σιωπηλός σταθμός, όχι «μηδέν βροχή»
async function _sagAccPointAtOrBefore(device, iso) {
  const r = await device.getData({ variables: ['rain_height_acc'], end_date: iso, qty: 1, ordination: 'descending' });
  const e = Array.isArray(r) && r.length ? r[0] : null;
  if (!e) return null;
  const v = Number(e.value), t = Date.parse(e.time);
  return (Number.isFinite(v) && Number.isFinite(t)) ? { v, t } : null;
}
async function _sagRainFromCounter(device, startISO, endISO, endPt, maxLeadMin) {
  try {
    const endMs = Date.parse(endISO), startMs = Date.parse(startISO);
    const e = (endPt !== undefined) ? endPt : await _sagAccPointAtOrBefore(device, endISO);
    if (!e) return { ok: false, why: 'χωρίς μετρητή', end: null };
    if ((endMs - e.t) / 60000 > _SAG_RAIN_ACC_FRESH_MIN) return { ok: false, why: 'σιωπηλός σταθμός', end: e };
    const st = await _sagAccPointAtOrBefore(device, startISO);
    if (!st) return { ok: false, why: 'καμία τιμή πριν το παράθυρο', end: e };
    if ((startMs - st.t) / 60000 > maxLeadMin) return { ok: false, why: 'κενό πριν το παράθυρο', end: e };
    let mm = e.v - st.v, resets = 0, dropped = 0;
    if (mm < -0.001) {
      // Μηδενισμός μέσα στο παράθυρο: άθροισμα θετικών βημάτων· μετά τον μηδενισμό μετρά η νέα τιμή.
      const ser = await device.getData({ variables: ['rain_height_acc'], start_date: new Date(st.t).toISOString(),
        end_date: endISO, qty: 2000, ordination: 'ascending' });
      const P = (Array.isArray(ser) ? ser : []).map(x => ({ v: Number(x.value), t: Date.parse(x.time) }))
        .filter(x => Number.isFinite(x.v) && Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
      mm = 0;
      for (let i = 1; i < P.length; i++) {
        const dh = Math.max((P[i].t - P[i - 1].t) / 3600000, 1 / 60);
        let d = P[i].v - P[i - 1].v;
        if (d < -0.001) { resets++; d = P[i].v; }
        if (d > _SAG_RAIN_MAX_MMH * dh + 0.254) { dropped++; continue; }   // αδύνατο βήμα: απορρίπτεται
        if (d > 0) mm += d;
      }
      if (resets === 0) return { ok: false, why: 'αρνητική διαφορά χωρίς μηδενισμό', end: e };
    }
    const spanH = Math.max((e.t - st.t) / 3600000, 1 / 60);
    if (!(mm >= 0) || mm > _SAG_RAIN_MAX_MMH * spanH + 0.254) return { ok: false, why: 'αδύνατη τιμή μετρητή', end: e };
    return { ok: true, mm: Math.round(mm * 1000) / 1000, resets, dropped, end: e };
  } catch (x) { return { ok: false, why: 'ανάγνωση απέτυχε', end: null }; }
}


const C = [
  ["049e Ανώγεια 24ω ως 1/10 21:00Z", "684c342a13af9d000a77bef3", "2026-09-30T21:00:00Z", "2026-10-01T21:00:00Z", 180],
  ["049e 24ω ως 2/10 21:00Z", "684c342a13af9d000a77bef3", "2026-10-01T21:00:00Z", "2026-10-02T21:00:00Z", 180],
  ["047c Μπότζης 1ω ως 1/10 03:21Z", "684c4e48cc1cd8000a10ddb9", "2026-10-01T02:21:00Z", "2026-10-01T03:21:00Z", 30],
  ["047c Μπότζης 24ω ως 1/10 21:00Z", "684c4e48cc1cd8000a10ddb9", "2026-09-30T21:00:00Z", "2026-10-01T21:00:00Z", 180],
  ["03A4 Α2 1ω ως 3/10 11:21Z", "681c8f237a6e41000a900c8d", "2026-10-03T10:21:00Z", "2026-10-03T11:21:00Z", 30],
  ["04A4 Β3 24ω ως 3/10 21:00Z (κενό 181΄)", "681c8f9c4f9c59000a0e3368", "2026-10-02T21:00:00Z", "2026-10-03T21:00:00Z", 180],
  ["0495 fw1.13 (χωρίς μετρητή)", "6797626820ac9d000954e70d", "2026-10-02T21:00:00Z", "2026-10-03T21:00:00Z", 180],
  ["05AA σιωπηλός", "680e7c9a0feb8c000a70a6c8", "2026-10-02T21:00:00Z", "2026-10-03T21:00:00Z", 180],
];
(async () => {
  console.log("=== ΖΩΝΤΑΝΗ ΔΟΚΙΜΗ T-RAIN-ACC-01 · " + new Date().toISOString() + " ===");
  for (const [n, id, st, en, lead] of C) {
    try { const r = await _sagRainFromCounter(mkDev(id), st, en, undefined, lead); console.log("L|" + n + "|" + JSON.stringify({ ok: r.ok, mm: r.mm, why: r.why, resets: r.resets, dropped: r.dropped, end: r.end && new Date(r.end.t).toISOString() })); }
    catch (e) { console.log("L|" + n + "|ERR " + e.message); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
