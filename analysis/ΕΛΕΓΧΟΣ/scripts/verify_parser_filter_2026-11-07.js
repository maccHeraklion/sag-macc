// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Επαλήθευση φίλτρου parser (T-PARSER-SLIM-01 σε όλους τους αισθητήρες):
// για κάθε συσκευή του scope {names:[...]} (ή ids) μετρά, ΜΕΤΑ τη χρονοσφραγίδα since (ISO), πόσα πακέτα έφτασαν (δείγματα της κύριας
// μεταβλητής) και πόσες εγγραφές συνολικά → εγγραφές/πακέτο, και ποιες μεταβλητές γράφτηκαν (ονόματα μόνο). Scope: {names, since, n}.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "VPF|";
const MAIN = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature", lms01_ls: "leaf_moisture", se0x: "soil_moisture1", lse02: "soil_moisture1", lse01: "soil_moisture", se01: "soil_moisture", sph01: "ph" };
let ids = [], names = [], since = new Date(Date.now() - 3600000).toISOString();
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && Array.isArray(o.ids)) ids = o.ids; if (o && Array.isArray(o.names)) names = o.names; if (o && o.since) since = String(o.since); } catch (e) { /* χωρίς scope */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " since=" + since);
  for (const nm of names) { try { const r = await get(`/device?filter[name]=${encodeURIComponent(nm)}&amount=3&fields=id,name`); const hit = r.find((x) => x.name === nm) || r[0]; if (hit) ids.push(hit.id); else console.log(P + nm + "|ΔΕΝ ΒΡΕΘΗΚΕ"); } catch (e) { console.log(P + nm + "|ERR|" + e.message); } }
  for (const id of ids) {
    try {
      const d = await get(`/device/${id}`); const type = String(tag(d, "type") || ""); const mv = MAIN[type] || "battery";
      const pk = await get(`/device/${id}/data?query=count&variables=${mv}&start_date=${encodeURIComponent(since)}`);
      const all = await get(`/device/${id}/data?query=count&start_date=${encodeURIComponent(since)}`);
      const rows = await get(`/device/${id}/data?qty=60&start_date=${encodeURIComponent(since)}`);
      const vars = Array.from(new Set(rows.map((r) => String(r.variable)))).sort();
      console.log(P + d.name + "|" + type + "|parser=" + (d.payload_decoder ? String(d.payload_decoder).length : 0) + "|πακέτα=" + pk + "|εγγραφές=" + all + "|ανά πακέτο=" + (pk ? (all / pk).toFixed(1) : "-") + "|μεταβλητές(δείγμα 60)=" + vars.join(","));
    } catch (e) { console.log(P + id + "|ERR|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
