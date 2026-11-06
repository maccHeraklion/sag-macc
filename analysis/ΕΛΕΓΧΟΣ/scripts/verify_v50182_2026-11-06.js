// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 6/11/2026 · Επαλήθευση v50.182 (T-PHASE0-01): πυρήνας, σφάλματα, κατάσταση μοντέλου
// μόλυνσης («Ν μύκητες» χωρίς διπλή μέτρηση), κάρτα τοποθέτησης αισθητήρα φύλλου (νέα τιμή «Εκτός χώρου ή βλάβη»), πηγή διαβροχής,
// χθεσινό μέγιστο, και δείγμα κειμένων με ώρες.
const zlib = require("zlib"); const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "V182|";
const FLEET = "6a98855ca06e41000bfae024"; const CORE = "6898958ea9fc0d000a382484";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const unpack = (b) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=3`)) { const m = e.metadata || {}; console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms); }
    const meta = await get(`/analysis/${CORE}/download`); let buf = Buffer.from(await (await fetch(meta.url)).arrayBuffer()); if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    console.log(P + "CORE|bytes=" + buf.length + "|sha256=" + crypto.createHash("sha256").update(buf).digest("hex") + "|" + (/SAG_KERNEL_VERSION = '([^']+)'/.exec(buf.toString("utf8")) || [])[1]);
  } catch (e) { console.log(P + "ERR|" + e.message); }
  const now = Date.now(); const st = {}, pl = {}, src = {}; let maxB = 0, nHours = 0; const samples = [];
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name);
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; if (!b || !b.metadata || !b.metadata.data) continue;
      if ((now - Date.parse(b.time)) / 3600000 > 1.2) continue;
      maxB = Math.max(maxB, String(b.metadata.data).length);
      const o = unpack(b); const cr = (o.crops || [])[0] || {}; const ind = cr.indicators || {};
      const s = String(val(ind.infection_model_status)); const k = s.split(" ·")[0].split(" —")[0]; st[k] = (st[k] || 0) + 1;
      const p = String(val(ind.leaf_sensor_placement)); pl[p] = (pl[p] || 0) + 1;
      const w = String(val(ind.leaf_wetness_source)); src[w] = (src[w] || 0) + 1;
      const nCnt = Object.keys(ind).filter((x) => /^b[0-9][0-9]$/.test(x)).length;
      const m = /(\d+) μύκητ/.exec(s);
      if (m && Number(m[1]) !== nCnt) console.log(P + "COUNT_MISMATCH|" + nm + "|" + s + "|μετρητές=" + nCnt);
      if (p !== "undefined" && p !== "Σωστή τοποθέτηση") console.log(P + "PLACE|" + nm.slice(0, 26) + "|" + p + "|dtmax=" + val(ind.leaf_sensor_dt_max_today) + "|yday=" + val(ind.leaf_sensor_dt_max_yday) + "|src=" + w + "|" + String((ind.leaf_sensor_placement && ind.leaf_sensor_placement.metadata && ind.leaf_sensor_placement.metadata.text) || "").slice(0, 120));
      for (const cc of o.crops || []) for (const x of Object.keys(cc.indicators || {})) { if (!/^i[0-9][0-9]$/.test(x)) continue; const t = String((cc.indicators[x].metadata && cc.indicators[x].metadata.text) || ""); if (/\dω (υγρά φύλλα|ευνοϊκός καιρός)/.test(t)) { nHours++; if (samples.length < 6) samples.push(nm.slice(0, 16) + ": " + String(val(cc.indicators[x])).split(" ")[0] + " «" + t.slice(0, 70) + "»"); } }
      if (ind.leaf_sensor_dt_max_yday !== undefined && samples.length < 9 && /Ρηγάκη|ΚΟΥΤΣΑΚ|Κοτσύφ/.test(nm)) samples.push(nm.slice(0, 16) + " yday=" + val(ind.leaf_sensor_dt_max_yday) + " today=" + val(ind.leaf_sensor_dt_max_today) + " status=" + s);
    } catch (e) { console.log(P + "ERR|" + nm + "|" + e.message); }
  }
  console.log(P + "ΣΥΝΟΛΑ|κατάσταση " + JSON.stringify(st) + "|τοποθέτηση " + JSON.stringify(pl) + "|πηγή " + JSON.stringify(src) + "|μέγιστο bundle " + maxB + "|κάρτες με ώρες στο κείμενο " + nHours);
  for (const s of samples) console.log(P + "S|" + s);
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
