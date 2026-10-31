// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · Απογραφή μεταβλητών ανά πακέτο (24ω) σε συσκευές με πολλές εγγραφές (31/10/2026).
// Για κάθε συσκευή: πόσα πακέτα (διακριτές ώρες), πόσες εγγραφές ανά μεταβλητή, εγγραφές/πακέτο. Πολιτική 6aa2e0cf. Δεν γράφει.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const DEVS = { "sensecap_s2120_0534": "6818812a6c0953000a1ab9c8", "dragino_lms01_ls_784c": "681861542efa76000b9a73d0",
  "dragino_se0x_5ea7": "69779797803f37000a21342e", "milesight_uc511_7352": "6977947d83514a000bc8092f",
  "milesight_em320_th_3663": "69f1c7b866cc6a00090edc9e" };
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const P = "VC|";
(async () => {
  const end = new Date(), start = new Date(end - 864e5);
  for (const [n, id] of Object.entries(DEVS)) {
    try {
      const recs = await get(`/device/${id}/data?start_date=${start.toISOString()}&end_date=${end.toISOString()}&qty=10000`);
      const times = new Set(), c = {};
      for (const r of recs) { times.add(String(r.time).slice(0, 19)); c[r.variable] = (c[r.variable] || 0) + 1; }
      const vs = Object.entries(c).sort((a, b) => b[1] - a[1]);
      console.log(P + n + "|εγγραφές24ω=" + recs.length + "|πακέτα=" + times.size + "|μεταβλητές=" + vs.length + "|ανά_πακέτο=" + (recs.length / Math.max(1, times.size)).toFixed(1));
      console.log(P + n + "|" + vs.map(([k, v]) => k + "=" + v).join(" "));
    } catch (e) { console.log(P + n + "|ERR " + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
