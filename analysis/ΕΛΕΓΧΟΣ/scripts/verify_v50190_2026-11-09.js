// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 9/11/2026 · Επαλήθευση v50.190 στον στόλο (πρόθεμα V190): έκδοση/σφάλματα/διάρκεια κύκλου,
// ανά αγρό οροφή υγρασιομέτρου (rh_instrument_ceiling), κολλημένος αισθητήρας φύλλου, κάρτες βλάβης οργάνων με τα νέα κείμενα,
// πλήθος καρτών ασθενειών ανά καλλιέργεια (σύγκριση με τα αναμενόμενα γίνεται τοπικά). Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "V190|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const txt = (x) => (x && typeof x === "object" && x.metadata && x.metadata.text ? String(x.metadata.text) : "");
const LVL = { "Χαμηλός κίνδυνος": "L", "Μέτριος κίνδυνος": "M", "Υψηλός κίνδυνος": "H", "Σοβαρός κίνδυνος": "S", "Μη διαθέσιμο": "N", "Σε παρακολούθηση": "W" };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  for (const e of await get(`/device/6a98855ca06e41000bfae024/data?variables=fleet_summary&qty=2`)) { const m = e.metadata || {}; console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 300) + "|ms=" + m.ms); }
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; if (!b || !b.metadata || !b.metadata.data) continue;
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      const sh = o.shared || {}; const parts = []; let ceil = null, stuck = null;
      for (const cr of o.crops || []) {
        const ind = cr.indicators || {}; const g = (k) => (k in ind ? ind[k] : sh[k]);
        if (g("rh_instrument_ceiling") !== undefined) ceil = val(g("rh_instrument_ceiling"));
        if (g("leaf_sensor_stuck_dry") !== undefined) stuck = val(g("leaf_sensor_stuck_dry"));
        const ks = Object.keys(ind).filter((k) => /^i\d\d$/.test(k) || k.startsWith("fir_message_"));
        const lv = {}; for (const k of ks) { const l = LVL[String(val(ind[k]))] || "?"; lv[l] = (lv[l] || 0) + 1; }
        parts.push(String(cr.id).split(":")[1] + "[" + ks.length + " " + JSON.stringify(lv) + "]");
      }
      const sf = sh.sensor_faults || (o.crops && o.crops[0] && o.crops[0].indicators && o.crops[0].indicators.sensor_faults);
      const sft = txt(sf);
      const flags = (/κορεσμό/.test(sft) ? " ΟΡΟΦΗ" : "") + (/ποτέ νερό/.test(sft) ? " ΚΟΛΛΗΜΕΝΟΣ" : "");
      console.log(P + "F|" + String(tag(f, "name") || f.name).slice(0, 26) + "|age=" + Math.round((Date.now() - Date.parse(b.time)) / 6e4) + "|ceil=" + ceil + "|stuck=" + stuck + "|faults=" + String(val(sf)).slice(0, 40) + flags + "|" + parts.join(" "));
    } catch (e) { console.log(P + "ERR|" + f.id + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
