// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Κοκοφοίνικας, σόνδα dragino_se0x_3aad: όλη η σειρά υγρασία/θερμοκρασία/αγωγιμότητα ανά θύρα από 21/10, για τον δείκτη EC/θ². Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "CS|"; const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const f = fields.find((x) => /Κοκοφοίνικα/.test(tag(x, "name") || x.name));
    const devs = JSON.parse(tag(f, "devices") || "{}"); const id = devs["dragino_se0x_3aad"];
    const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
    const sh = JSON.parse(require("zlib").inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8")).shared || {};
    console.log(P + "EC_STATUS|" + JSON.stringify(sh.soil_ec_status || null).slice(0, 300));
    for (const ch of ["1", "2"]) {
      const get3 = (v) => get(`/device/${id}/data?variables=${v}${ch}&qty=2000&start_date=2026-10-21T00:00:00Z&ordination=ascending`);
      const [m, t, c] = [await get3("soil_moisture"), await get3("soil_temperature"), await get3("conduct_soil")];
      const T = {}, C = {}; for (const r of t) T[r.group] = Number(r.value); for (const r of c) C[r.group] = Number(r.value) / 1000;
      const al = m.map((r) => [String(r.time).slice(5, 16).replace("T", " "), Number(r.value), T[r.group], C[r.group]]).filter((x) => Number.isFinite(x[3]));
      console.log(P + "N|" + ch + "|" + al.length + "|πρώτο=" + (al[0] || [])[0] + "|τελευταίο=" + (al[al.length - 1] || [])[0]);
      for (let i = 0; i < al.length; i += 30) console.log(P + "S" + ch + "|" + al.slice(i, i + 30).map((x) => x[0].slice(3) + "," + x[1] + "," + x[2] + "," + x[3].toFixed(2)).join(";"));
    }
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
