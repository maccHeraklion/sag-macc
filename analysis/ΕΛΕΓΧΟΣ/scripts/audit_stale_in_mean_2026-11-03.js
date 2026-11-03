// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 3/11/2026 · Κύμα 2: σε ποιους αγρούς όργανο παλιότερο από 6 ω μπαίνει στον μέσο όρο μαζί με φρέσκο, και πόσο τον μετακινεί.
// Το παράθυρο 24 ω και τα 6 ω είναι του ελέγχου εδώ, όχι αλλαγή στον πυρήνα. Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "SIM|";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const VARS = ["soil_moisture1", "soil_moisture2", "soil_moisture", "soil_temperature1", "soil_temperature2", "air_temperature", "air_humidity", "temperature", "humidity", "leaf_temperature"];
const H = 36e5, now = Date.now();
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  let nf = 0, multi = 0, hit = 0; const fields = new Set();
  try {
    const list = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const cache = {};
    for (const f of list) {
      nf++;
      let devs = {}; try { devs = JSON.parse(tag(f, "devices") || "{}"); } catch (_e) {}
      const ids = Object.entries(devs); if (ids.length < 2) continue;
      let conf = {}; try { conf = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
      const by = {};
      for (const [name, id] of ids) {
        if (!cache[id]) {
          cache[id] = {};
          for (const v of VARS) {
            try { const r = (await get(`/device/${id}/data?variables=${v}&qty=1&ordination=descending`))[0]; if (r) cache[id][v] = { v: Number(r.value), t: Date.parse(r.time) }; } catch (_e) {}
          }
        }
        for (const v of VARS) { const x = cache[id][v]; if (x && Number.isFinite(x.v) && now - x.t <= 24 * H) (by[v] = by[v] || []).push({ name, a: (now - x.t) / H, v: x.v }); }
      }
      let isMulti = false;
      for (const v of VARS) {
        const L = by[v] || []; if (L.length < 2) continue; isMulti = true;
        const fresh = L.filter((x) => x.a <= 6), old = L.filter((x) => x.a > 6);
        if (!old.length || !fresh.length) continue;
        hit++; fields.add(f.id);
        const m = (a) => a.reduce((s, x) => s + x.v, 0) / a.length;
        console.log(P + "F|" + (tag(f, "name") || f.name) + "|" + v + "|ref=" + (conf.soil_ref_device ? "ναι" : "όχι") + "|όλα=" + m(L).toFixed(2) + "|φρέσκα=" + m(fresh).toFixed(2) + "|διαφορά=" + (m(L) - m(fresh)).toFixed(2) + "|παλιά=" + old.map((x) => x.name.slice(-4) + ":" + x.a.toFixed(1) + "ω=" + x.v).join(","));
      }
      if (isMulti) multi++;
    }
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "SUM|αγροί=" + nf + "|με πολλά όργανα ίδιας μεταβλητής=" + multi + "|περιπτώσεις=" + hit + "|αγροί με παλιό όργανο=" + fields.size);
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
