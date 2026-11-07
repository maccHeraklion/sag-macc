// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Έλεγχος παλμού μετά από ανέβασμα: έκδοση πυρήνα, πλήθη, σφάλματα, διάρκεια, και τα ωριαία πακέτα αν υπάρχουν. Δεν γράφει τίποτα, δεν τυπώνει θέσεις.
const zlib = require("zlib"); const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "V1|"; const O = "6a98855ca06e41000bfae024";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const s = (await get(`/device/${O}/data?variables[]=fleet_summary&qty=2`)); for (const r of s) { const m = r.metadata || {}; console.log(P + "ΣΥΝΟΨΗ|" + r.time + "|τιμή " + r.value + "|πυρήνας " + m.kernel + "|tick " + JSON.stringify(m.tick) + "|ms " + m.ms + "|reads " + JSON.stringify(m.reads) + "|σφάλματα " + (m.errors || []).length + "|κλειδιά " + Object.keys(m).slice(0, 14).join(",")); }
  const hp = await get(`/device/${O}/data?variables[]=sag_hour_packet&qty=12`);
  console.log(P + "ΠΑΚΕΤΑ|" + hp.length); if (hp.length) {
    const t0 = hp[0].metadata.t, set = hp.filter((r) => r.metadata.t === t0); let all = []; for (const r of set) all = all.concat(JSON.parse(zlib.inflateRawSync(Buffer.from(r.metadata.z, "base64")).toString("utf8")).r);
    const m = set[0].metadata; console.log(P + "ΠΑΛΜΟΣ|ώρα " + m.h + "|μέρη " + set.length + "|όργανα " + all.length + "|αναγνώσεις " + m.reads + "|εγγραφές " + m.rows + "|παραλείφθηκαν " + m.skipped + "|μέγιστο μέρος " + Math.max(...set.map((r) => r.metadata.z.length)));
    const c = {}; for (const a of all) { const k = a.y + ":" + a.c; c[k] = (c[k] || 0) + 1; } console.log(P + "ΚΛΑΣΕΙΣ|" + JSON.stringify(c));
    for (const y of ["s2120", "em320_th", "se0x", "lse01", "lms01_ls"]) { const a = all.find((x) => x.y === y && x.n > 0); if (a) console.log(P + "ΔΕΙΓΜΑ|" + JSON.stringify(a).slice(0, 420)); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
