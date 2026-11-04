// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · (1) κύκλος πυρήνα (2) αγροί που έπεσαν στην εφεδρεία ×2,5 στο τελευταίο πακέτο (3) συσκευές LMS01 για το φίλτρο parser:
// σε ποιο αγρό ανήκουν, αν έχουν ήδη parser συσκευής, ποιες μεταβλητές γράφει το τελευταίο πακέτο. Πολιτική 6aa2e0cf. Δεν γράφει τίποτα.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "XL|"; const FLEET = "6a98855ca06e41000bfae024"; const LMS = "614afaa58c6ce300184c16fc";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=1`)) {
      const m = e.metadata || {};
      console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms);
    }
  } catch (e) { console.log(P + "ERR fleet|" + e.message); }
  const owner = {}; let nb = 0, x25 = 0; const hits = [], grey = {};
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    for (const f of fields) {
      let devs = {}; try { devs = JSON.parse(tag(f, "devices") || "{}"); } catch (_e) {}
      for (const id of Object.values(devs)) (owner[id] = owner[id] || []).push(tag(f, "name") || f.name);
      try {
        const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
        if (!b || !b.metadata || !b.metadata.data) continue;
        nb++;
        const s = zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8");
        const o = JSON.parse(s); const sh = o.shared || {};
        const st = sh.soil_ec_status; const stv = st && typeof st === "object" ? st.value : st; if (stv) grey[stv] = (grey[stv] || 0) + 1;
        if (s.includes("×2,5")) { x25++; hits.push(tag(f, "name") || f.name); }
      } catch (e) { console.log(P + "ERR|" + f.name + "|" + e.message); }
    }
    console.log(P + "X25|πακέτα=" + nb + "|με ×2,5=" + x25 + "|" + hits.join(", ").slice(0, 400));
    console.log(P + "EC_STATUS|" + JSON.stringify(grey).slice(0, 500));
  } catch (e) { console.log(P + "ERR|" + e.message); }
  try {
    const list = await get(`/device?filter[connector]=${LMS}&amount=100&fields=id,name,last_input,active`);
    const rows = [];
    for (const d of list) {
      const full = await get(`/device/${d.id}`).catch(() => ({}));
      rows.push({ id: d.id, n: d.name, a: d.active, li: String(d.last_input || full.last_input || "").slice(0, 16), own: (owner[d.id] || []).length, pd: full.payload_decoder ? String(full.payload_decoder).length : 0 });
    }
    rows.sort((a, b) => a.own - b.own || (b.li > a.li ? 1 : -1));
    console.log(P + "LMS|σύνολο=" + rows.length + "|χωρίς αγρό=" + rows.filter((x) => !x.own).length + "|με parser=" + rows.filter((x) => x.pd).length);
    for (const x of rows.slice(0, 8)) console.log(P + "D|" + x.id + "|" + x.n + "|ενεργή=" + x.a + "|" + x.li + "|αγροί=" + x.own + "|parser=" + x.pd);
    const live = rows.find((x) => x.li >= new Date(Date.now() - 864e5).toISOString().slice(0, 16));
    if (live) {
      const d = await get(`/device/${live.id}/data?qty=80&ordination=descending`);
      const g = d[0] && d[0].group; const vs = d.filter((r) => r.group === g).map((r) => r.variable);
      console.log(P + "VARS|" + live.n + "|" + vs.length + "|" + vs.sort().join(","));
    }
  } catch (e) { console.log(P + "ERR lms|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
