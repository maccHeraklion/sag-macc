// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · Κατάσταση parser συσκευής πριν το T-PARSER-SLIM-02.
// Για κάθε αισθητήρα (τύποι SCOPE, όχι ξενοδοχείο, όχι βάνες) κατατάσσει τον parser: κενός · v1 (ακριβώς το φίλτρο 7/11) ·
// δικός + v1 στο τέλος · δικός χωρίς φίλτρο · άλλο με SAG_DROP. Τυπώνει sha256 του σημερινού για ασφαλή αντικατάσταση. Δεν γράφει.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "PS|";
const RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc/01e9580/payload_parsers/";
const SCOPE = ["s2120", "lms01_ls", "se0x", "lse01", "lse01_shallow", "lse01_deep", "lse02", "se01", "se02_lb", "em320_th", "em300_th", "sph01"];
const crypto = require("crypto"); const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
const nl = (s) => String(s).replace(/\r\n/g, "\n");
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; }
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ err: e.message })); } })); return out; }
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const v1 = nl(await (await fetch(RAW + "device_slim_filter_2026-11-04.js")).text()).trim();
  const v2 = nl(await (await fetch(RAW + "device_slim_filter_v2_2026-11-28.js")).text()).trim();
  console.log(P + "ΑΝΑΦΟΡΑ|v1 " + sha(v1) + " " + v1.length + "|v2 " + sha(v2) + " " + v2.length);
  const devs = []; for (let page = 1; page <= 10; page++) { const c = await get(`/device?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=tags&fields[]=type`); devs.push(...c); if (c.length < 100) break; }
  const tg = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k) || {}).value;
  const cand = devs.filter((d) => SCOPE.includes(String(tg(d, "type") || "").toLowerCase()));
  const hotel = cand.filter((d) => tg(d, "project") === "hotel_volta");
  const tgt = cand.filter((d) => tg(d, "project") !== "hotel_volta");
  const info = await pool(tgt, 8, (d) => get(`/device/${d.id}`));
  const st = {}; const lines = [];
  tgt.forEach((d, k) => { const i = info[k]; if (!i || i.err) { (st.ERR = st.ERR || []).push(d.name); return; }
    const raw = i.payload_decoder ? Buffer.from(i.payload_decoder, "base64").toString("utf8") : ""; const code = nl(raw).trim();
    let s; if (!code) s = "κενός"; else if (code === v1) s = "v1"; else if (code === v2) s = "v2"; else if (code.endsWith(v1)) s = "δικός+v1"; else if (code.includes("SAG_DROP")) s = "άλλο_SAG_DROP"; else s = "δικός";
    (st[s] = st[s] || []).push(d.name); lines.push(d.id + ":" + String(d.name).slice(-14) + ":" + tg(d, "type") + ":" + s + ":" + (raw ? sha(raw) : "-") + ":" + code.length + ":" + (tg(d, "storage") || "-")); });
  console.log(P + "ΣΥΝΟΛΟ|υποψήφιοι " + cand.length + "|ξενοδοχείο (εκτός) " + hotel.length + " " + hotel.map((d) => d.name).join(",") + "|στόχοι " + tgt.length);
  for (const [k, v] of Object.entries(st)) console.log(P + "ΚΑΤΑΣΤΑΣΗ|" + k + "|" + v.length + (k !== "v1" && k !== "κενός" ? "|" + v.join(",") : ""));
  for (let i = 0; i < lines.length; i += 12) console.log(P + "ΣΥΣΚ|" + lines.slice(i, i + 12).join(" "));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
