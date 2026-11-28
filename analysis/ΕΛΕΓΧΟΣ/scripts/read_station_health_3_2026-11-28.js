// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Τελευταίο station_health (1 εγγραφή/συσκευή) και τελευταία air_temperature
// για 0023, 00d8, 00c5 — επιβεβαίωση ότι ο σταθμός σιωπά και ότι το stationHealth το έπιασε. ~6 εγγραφές Data Output.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "SH3|";
const DEV = { "681315a0ed3243000a85e3c2": "0023", "6971054abb3d630010741e09": "00d8", "69aed3c9962d2c00097b621f": "00c5" };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; }
(async () => {
  for (const [id, n] of Object.entries(DEV)) {
    const sh = await get(`/device/${id}/data?variable=station_health&qty=1`).catch((e) => [{ err: e.message }]);
    const t = await get(`/device/${id}/data?variable=air_temperature&qty=1`).catch((e) => [{ err: e.message }]);
    const last = await get(`/device/${id}/data?qty=3`).catch((e) => [{ err: e.message }]);
    const s = sh[0] || {}; const checks = s.metadata && s.metadata.checks ? JSON.stringify(s.metadata.checks).slice(0, 500) : JSON.stringify(s).slice(0, 300);
    console.log(P + n + "|health " + (s.time || "-") + " " + (s.value || "-") + "|" + checks);
    console.log(P + n + "|air_temperature τελευταία " + ((t[0] || {}).time || "καμία") + "|τελευταίες εγγραφές: " + last.map((x) => x.variable + "@" + x.time).join(", "));
  }
})().catch((e) => console.log(P + "FATAL|" + e.message));
