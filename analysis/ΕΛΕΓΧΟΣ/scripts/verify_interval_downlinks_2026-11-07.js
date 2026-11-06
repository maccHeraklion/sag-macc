// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Επαλήθευση downlink ρυθμού αποστολής (T-UPLINK-UNIFORM-01):
// για κάθε συσκευή του scope {ids:[...]} τυπώνει τις τελευταίες N χρονοσφραγίδες της κύριας μεταβλητής και τα κενά σε λεπτά,
// ώστε να φανεί αν άλλαξε ο ρυθμός μετά την εντολή. Scope: {ids: ["<24hex>", ...], n: 10}. Χωρίς scope: οι 4 δοκιμαστικές.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "VINT|";
const MAIN = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature", lms01_ls: "leaf_moisture", se0x: "soil_moisture1", lse02: "soil_moisture1", lse01: "soil_moisture", se01: "soil_moisture", sph01: "ph" };
const DEFAULT_IDS = ["681c8f3d4f9c59000a0e267a", "68186154c227a7000ad5ae99", "67f4263236b2df000a052c5d", "681859265e2146000a8f48cd"];
let ids = DEFAULT_IDS, N = 10, names = [];
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && Array.isArray(o.ids) && o.ids.length) ids = o.ids; if (o && Array.isArray(o.names) && o.names.length) names = o.names; if (o && Number(o.n) > 0) N = Number(o.n); } catch (e) { /* χωρίς scope */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  if (names.length) { ids = []; for (const nm of names) { try { const r = await get(`/device?filter[name]=${encodeURIComponent(nm)}&amount=3&fields=id,name`); const hit = r.find((x) => x.name === nm) || r[0]; if (hit) ids.push(hit.id); else console.log(P + nm + "|ΔΕΝ ΒΡΕΘΗΚΕ"); } catch (e) { console.log(P + nm + "|ERR|" + e.message); } } }
  for (const id of ids) {
    try {
      const d = await get(`/device/${id}`); const type = String(tag(d, "type") || ""); const mv = MAIN[type] || "battery";
      const rows = await get(`/device/${id}/data?variables=${mv}&qty=${N}`);
      const ts = rows.map((r) => Date.parse(r.time)).sort((a, b) => b - a);
      const gaps = []; for (let i = 0; i + 1 < ts.length; i++) gaps.push(Math.round((ts[i] - ts[i + 1]) / 60000));
      console.log(P + d.name + "|" + type + "|last=" + (ts[0] ? new Date(ts[0]).toISOString().slice(11, 19) : "-") + "|κενά(λεπτά, πρόσφατο→παλιό)=" + gaps.join(",") + "|last_input=" + String(d.last_input).slice(11, 19));
    } catch (e) { console.log(P + id + "|ERR|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
