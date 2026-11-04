// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Ποιες μεταβλητές γράφει ΣΗΜΕΡΑ ζωντανή συσκευή ανά connector (τελευταίες 300 εγγραφές), για το φίλτρο parser. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "VC|";
const CONN = { lms01: "614afaa58c6ce300184c16fc", s2120: "67adaf5b36089a000a16aa5a", se0x: "685bafd351843b000ad23a36" };
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  for (const [k, c] of Object.entries(CONN)) {
    try {
      const list = await get(`/device?filter[connector]=${c}&amount=60&fields=id`);
      let n = 0; const seen = {};
      for (const d of list) {
        const full = await get(`/device/${d.id}`).catch(() => null);
        if (!full || !full.last_input || Date.now() - Date.parse(full.last_input) > 864e5) continue;
        const rows = await get(`/device/${d.id}/data?qty=300&ordination=descending`).catch(() => []);
        const cnt = {}; const gs = new Set();
        for (const r of rows) { cnt[r.variable] = (cnt[r.variable] || 0) + 1; gs.add(r.group); }
        const pk = Math.max(1, ...Object.values(cnt));
        console.log(P + k + "|" + full.name + "|" + d.id + "|parser=" + String(full.payload_decoder || "").length + "|γραμμές=" + rows.length + "|ομάδες=" + gs.size + "|ανά πακέτο≈" + (rows.length / pk).toFixed(1) + "|" + Object.keys(cnt).sort().join(","));
        if (++n >= 2) break;
      }
    } catch (e) { console.log(P + "ERR|" + k + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
