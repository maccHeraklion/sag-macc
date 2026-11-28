// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Ποια ταμπλό/widgets δείχνουν μεταβλητές που προτείνεται να κοπούν από τον
// parser (οι ρυθμίσεις widgets δεν είναι στο git). Διαβάζει μόνο ρυθμίσεις ταμπλό/widgets, όχι δεδομένα· επιπλέον λίστα S2120 που ακόμη
// γράφουν πεδία δικτύου (count από 8/11, ~1 εγγραφή Data Output/ερώτημα). Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "WV|";
const CAND = ["wind_speed_kmh2", "wind_chill", "thw_indexc", "heat_index", "message_type", "interrupt_flag", "tempc_ds18b20", "payload", "late", "channel", "time", "fport", "deveui",
  "i_flag", "s_flag", "mod", "ds18b20", "payloaddecodederror", "sensor_mode", "layer_variable1", "hardware_version", "firmware_version", "sensor_error_event", "ismband", "lrralt", "lrruuid", "map_field", "fleet_field", "gateway_row"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) { for (let k = 0; k < 4; k++) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); if (r.status === 429) { await sleep(1500 * (k + 1)); continue; } const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; } throw new Error("429"); }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
function vars(o, out) { if (!o || typeof o !== "object") return out; for (const [k, v] of Object.entries(o)) { if (k === "variables" && Array.isArray(v)) v.forEach((s) => typeof s === "string" ? out.add(s) : s && s.variable && out.add(s.variable)); else if (k === "variable" && typeof v === "string") out.add(v); else if (typeof v === "object") vars(v, out); } return out; }
(async () => {
  const t0 = Date.now(); console.log(P + "=== " + new Date().toISOString());
  const dbs = []; for (let page = 1; page <= 5; page++) { const c = await get(`/dashboard?amount=100&page=${page}&fields[]=id&fields[]=label`); dbs.push(...c); if (c.length < 100) break; }
  const info = await pool(dbs, 8, (d) => get(`/dashboard/${d.id}`));
  const wjobs = []; let dErr = 0; dbs.forEach((d, k) => { const i = info[k]; if (!i || i.err) { dErr++; return; } for (const a of i.arrangement || []) if (a.widget_id) wjobs.push({ d, wid: a.widget_id }); });
  console.log(P + "ΤΑΜΠΛΟ|" + dbs.length + "|σφάλματα " + dErr + "|widgets " + wjobs.length + (dErr ? "|1ο σφάλμα " + (info.find((x) => x && x.err) || {}).err : ""));
  const ws = await pool(wjobs, 10, (j) => get(`/dashboard/${j.d.id}/widget/${j.wid}`));
  const hits = {}; let wErr = 0, firstErr = ""; const allVars = new Set();
  wjobs.forEach((j, k) => { const w = ws[k]; if (!w || w.err) { wErr++; firstErr = firstErr || (w && w.err); return; } const vs = vars(w, new Set()); vs.forEach((v) => allVars.add(v));
    for (const c of CAND) if (vs.has(c)) (hits[c] = hits[c] || []).push(String(j.d.label).slice(0, 30) + " / " + String(w.label || w.type || "").slice(0, 25)); });
  console.log(P + "WIDGETS|διαβάστηκαν " + (wjobs.length - wErr) + "|σφάλματα " + wErr + (firstErr ? "|" + firstErr : "") + "|διακριτές μεταβλητές " + allVars.size + "|" + Math.round((Date.now() - t0) / 1000) + "s");
  for (const c of CAND) console.log(P + "ΜΕΤΑΒΛΗΤΗ|" + c + "|widgets " + (hits[c] || []).length + "|" + (hits[c] || []).slice(0, 8).join(" ; "));
  // S2120 που ακόμη γράφουν ismband (χωρίς φίλτρο parser)
  const devs = []; for (let page = 1; page <= 10; page++) { const c = await get(`/device?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=connector&fields[]=tags`); devs.push(...c); if (c.length < 100) break; }
  const s21 = devs.filter((d) => ((d.tags || []).find((t) => t.key === "type") || {}).value === "s2120");
  const cnt = await pool(s21, 10, (d) => get(`/device/${d.id}/data?query=count&variable=ismband&start_date=2026-11-08T00:00:00.000Z&end_date=${new Date().toISOString()}`).then(Number));
  s21.forEach((d, k) => { if (cnt[k] > 0) { const tg = (key) => ((d.tags || []).find((t) => t.key === key) || {}).value || "-"; console.log(P + "S2120_ΧΩΡΙΣ_ΦΙΛΤΡΟ|" + d.id + "|" + d.name + "|ismband από 8/11 " + cnt[k] + "|project " + tg("project") + "|client " + (tg("client") !== "-" ? "ναι" : "-") + "|storage " + tg("storage")); } });
  console.log(P + "=== ΤΕΛΟΣ|" + Math.round((Date.now() - t0) / 1000) + "s");
})().catch((e) => console.log(P + "FATAL|" + e.message));
