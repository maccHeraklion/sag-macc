// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 3/11/2026 · Πώς αντιστοιχίζονται σήμερα οι αισθητήρες εδάφους σε ρηχό/βαθύ.
// Για κάθε αγρό: βάθη/δηλώσεις της φόρμας (configuration), κάθε συνδεδεμένη συσκευή εδάφους με τύπο (ετικέτα type),
// τελευταία 4 ψηφία EUI, και ΠΟΙΑ κανάλια υγρασίας έστειλε τις τελευταίες 72 ω (γυμνό / 1 / 2) με τιμή.
// Πολιτική 6aa2e0cf. Δεν γράφει τίποτα. Δεν τυπώνει πλήρη EUI.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "SDM|";
const SOIL = /^(lse01|lse01_shallow|lse01_deep|lse02|se0x|se01|se02)$/;
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  const since = new Date(Date.now() - 72 * 3600e3).toISOString();
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const sum = { fields: fields.length, withSoil: 0, combos: {} };
    for (const f of fields) {
      let conf = {}; try { conf = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
      let devs = {}; try { devs = JSON.parse(tag(f, "devices") || "{}"); } catch (_e) {}
      const rows = [];
      for (const [nm, id] of Object.entries(devs)) {
        let d; try { d = await get(`/device/${id}`); } catch (e) { continue; }
        const ty = String(tag(d, "type") || "");
        if (!SOIL.test(ty)) continue;
        const eui = String(tag(d, "eui") || "").slice(-4);
        const ch = {};
        for (const v of ["soil_moisture", "soil_moisture1", "soil_moisture2"]) {
          try {
            const x = await get(`/device/${id}/data?variables=${v}&qty=1&start_date=${since}`);
            if (Array.isArray(x) && x[0]) ch[v.replace("soil_moisture", "") || "γ"] = Number(x[0].value);
          } catch (_e) {}
        }
        rows.push(ty + "[" + eui + "]{" + Object.entries(ch).map(([k, v]) => k + "=" + v).join(",") + "}");
      }
      if (!rows.length) continue;
      sum.withSoil++;
      const combo = rows.map((r) => r.replace(/\[.*$/, "") + ":" + (r.match(/\{(.*)\}/)[1].split(",").filter(Boolean).map((s) => s.split("=")[0]).join("+") || "—")).sort().join(" & ");
      sum.combos[combo] = (sum.combos[combo] || 0) + 1;
      console.log(P + "F|" + (tag(f, "name") || f.name) + "|ρηχό=" + conf.sensorShallow_depth_cm + "|βαθύ=" + conf.sensor_deep_depth_cm
        + "|count=" + conf.soil_depth_count + "|ref=" + (conf.soil_ref_device ? "ναι" : "—") + "|" + rows.join(" "));
    }
    console.log(P + "SUM|αγροί=" + sum.fields + "|με έδαφος=" + sum.withSoil);
    for (const [k, n] of Object.entries(sum.combos).sort((a, b) => b[1] - a[1])) console.log(P + "COMBO|" + n + "|" + k);
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
