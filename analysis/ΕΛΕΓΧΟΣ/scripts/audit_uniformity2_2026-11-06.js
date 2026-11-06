// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 6/11/2026 · Δεύτερος έλεγχος ομοιομορφίας (UNI7), μετά την έγκριση Μιχάλη για τα 2, 3, 4, 6.
// part 0 — ΑΓΡΟΙ: κλειδιά της φόρμας ρύθμισης (JSON.parse(value), όχι τιμές), έκδοση φόρμας, ετικέτες (κλειδιά· τιμή ΜΟΝΟ για
//          field_purpose/coordinates/isField), ποιες συσκευές, ποιες σιωπούν.
// part 1 — ΣΥΣΚΕΥΕΣ: τύπος, ενεργή, μήκος parser, connector, ηλικία τελευταίου πακέτου, ΠΟΙΑ ΠΥΛΗ τις ακούει (lrrid, όχι θέση),
//          εγγραφές ανά πακέτο (για το φίλτρο parser), ποιες δεν ανήκουν σε κανέναν αγρό (ξενοδοχείο κ.ά.).
// ΔΕΝ τυπώνει τιμές ετικετών συσκευών ούτε την ετικέτα access. Έξοδος συμπιεσμένη, scope {part: 0|1}.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "UNI7|";
let PART = 0; try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && Number.isFinite(Number(o.part))) PART = Number(o.part); } catch (e) { /* χωρίς scope */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const MAIN = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature", lms01_ls: "leaf_moisture", se0x: "soil_moisture1", lse02: "soil_moisture1", lse01: "soil_moisture", lse01_shallow: "soil_moisture", lse01_deep: "soil_moisture", se01: "soil_moisture", se02: "soil_moisture1" };
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { err: String(e.message).slice(0, 60) }; } } })); return out; }
function keysDeep(o, depth) { if (!o || typeof o !== "object") return []; const out = []; for (const k of Object.keys(o)) { const v = o[k]; if (Array.isArray(v)) out.push(k + "[]" + (v.length && typeof v[0] === "object" ? "{" + Object.keys(v[0]).join(",") + "}" : "")); else if (v && typeof v === "object" && depth > 0) out.push(k + "{" + keysDeep(v, depth - 1).join(",") + "}"); else out.push(k); } return out; }
(async () => {
  const now = Date.now(); const d24 = new Date(now - 86400000).toISOString();
  const allFields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags,active,last_input");
  allFields.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  let out;
  if (PART === 0) {
    const F = await pool(allFields, 6, async (f) => {
      const o = { id: f.id.slice(-6), n: String(tag(f, "name") || f.name), act: !!f.active, tk: (f.tags || []).map((t) => String(t.key)), fp: tag(f, "field_purpose") || null, co: tag(f, "coordinates") || null, fid: !!tag(f, "fieldId") };
      let dv = {}; try { dv = JSON.parse(tag(f, "devices") || "{}"); } catch (e) { const ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; ids.forEach((x, i) => { dv["?" + i] = x; }); o.dvRaw = true; }
      o.dv = Object.fromEntries(Object.entries(dv).map(([k, v]) => [k, String(v).slice(-6)]));
      try { const c = (await get(`/device/${f.id}/data?variables=configuration&qty=1`))[0];
        if (c) { o.ca = Math.round((now - Date.parse(c.time)) / 86400000); o.ck = Object.keys(c.metadata || {}).sort();
          let v = c.value; try { v = typeof v === "string" ? JSON.parse(v) : v; } catch (e) { o.cvParse = "ΟΧΙ JSON (" + String(c.value).length + " χαρ.)"; }
          if (v && typeof v === "object") { o.fk = keysDeep(v, 1); o.fv = v.form_version ?? v.formVersion ?? v.version ?? v._v ?? v.schema ?? null; if (Array.isArray(v.crops)) o.nc = v.crops.length; } } } catch (e) { o.ce = String(e.message).slice(0, 60); }
      return o; });
    out = { t: new Date(now).toISOString(), F };
  } else {
    const inField = {}; for (const f of allFields) { let dv = {}; try { dv = JSON.parse(tag(f, "devices") || "{}"); } catch (e) { (String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []).forEach((x) => { dv[x] = x; }); } for (const id of Object.values(dv)) { (inField[String(id)] = inField[String(id)] || []).push(String(tag(f, "name") || f.name).slice(0, 22)); } }
    const all = await get("/device?amount=500");   // η λίστα δεν γυρνά connector/parser/last_input με fields= — ανά συσκευή παρακάτω
    const devs = all.filter((d) => tag(d, "isField") !== "yes");
    const R = await pool(devs, 8, async (d0) => {
      const d = await get(`/device/${d0.id}`);
      const type = String(tag(d, "type") || "");
      const o = { id: d.id.slice(-6), n: d.name, t: type, a: !!d.active, p: d.payload_decoder ? String(d.payload_decoder).length : 0, c: String(d.connector || "").slice(-6), li: d.last_input ? Math.round((now - Date.parse(d.last_input)) / 3600000) : null, f: inField[d.id] || [] };
      if (o.li !== null && o.li < 72) {
        try { const g = (await get(`/device/${d.id}/data?variables=lrrid&qty=1`))[0]; if (g) { o.gw = String(g.value).slice(-6); o.rssi = g.metadata && g.metadata.lrrrssi !== undefined ? g.metadata.lrrrssi : undefined; } } catch (e) { o.gwE = 1; }
        const mv = MAIN[type]; if (mv) { try { o.n24 = await get(`/device/${d.id}/data?query=count&variables=${mv}&start_date=${d24}`); o.all24 = await get(`/device/${d.id}/data?query=count&start_date=${d24}`); } catch (e) { o.n24 = "ERR"; } }
      }
      return o; });
    out = { t: new Date(now).toISOString(), D: R, nAll: all.length };
  }
  const z = zlib.deflateRawSync(Buffer.from(JSON.stringify(out), "utf8")).toString("base64");
  const chunks = Math.ceil(z.length / 2400);
  console.log(P + "HDR|" + new Date(now).toISOString() + "|part=" + PART + "|z=" + z.length + "|chunks=" + chunks);
  for (let j = 0; j < chunks; j++) console.log(P + "Z|" + PART + "|" + j + "|" + z.slice(j * 2400, (j + 1) * 2400));
  console.log(P + "=== ΤΕΛΟΣ part " + PART);
})().catch((e) => console.log(P + "FATAL|" + e.message));
