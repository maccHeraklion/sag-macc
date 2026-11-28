// SAG — PROBE ΕΦΑΡΜΟΓΗΣ T-PARSER-SLIM-02 · 28/11/2026 · Γράφει τον parser ΣΥΣΚΕΥΗΣ (όχι connector) σε αισθητήρες.
// Scope (T_ANALYSIS_DATA): {mode: "dry"|"apply", ids: [...]} ή {mode, all: true}. Πολιτική 6b0a932b ενεργή ΜΟΝΟ κατά την εκτέλεση.
// Κανόνες: κενός → v2 · ακριβώς v1 → v2 · δικός+v1 → δικός + v2 · δικός → δικός + v2 στο τέλος · v2 → τίποτα · άλλο → τίποτα.
// Ποτέ ξενοδοχείο (project=hotel_volta) ή βάνες (uc511). Μετά την εγγραφή ξαναδιαβάζει και συγκρίνει byte-προς-byte.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "AP2|";
const RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc/01e9580/payload_parsers/";
const SCOPE = ["s2120", "lms01_ls", "se0x", "lse01", "lse01_shallow", "lse01_deep", "lse02", "se01", "se02_lb", "em320_th", "em300_th", "sph01"];
const crypto = require("crypto"); const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
const nl = (s) => String(s).replace(/\r\n/g, "\n");
async function api(method, path, body) { const r = await fetch(API + path, { method, headers: { Authorization: TOKEN, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 140)); return j.result; }
const tg = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k) || {}).value;
(async () => {
  let sc = {}; try { const s = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); sc = (Array.isArray(s) ? s[0] : s) || {}; } catch (e) {}
  const mode = sc.mode === "apply" ? "apply" : "dry"; console.log(P + "=== " + new Date().toISOString() + "|" + mode);
  const v1 = nl(await (await fetch(RAW + "device_slim_filter_2026-11-04.js")).text()).trim();
  const v2 = nl(await (await fetch(RAW + "device_slim_filter_v2_2026-11-28.js")).text()).trim();
  if (sha(v2) !== "5c25496d6d33a4c3") { console.log(P + "FATAL|v2 sha " + sha(v2) + " ≠ αναμενόμενο"); return; }
  let ids = Array.isArray(sc.ids) ? sc.ids : [];
  if (sc.all) { const devs = []; for (let page = 1; page <= 10; page++) { const c = await api("GET", `/device?amount=100&page=${page}&fields[]=id&fields[]=tags`); devs.push(...c); if (c.length < 100) break; }
    ids = devs.filter((d) => SCOPE.includes(String(tg(d, "type") || "").toLowerCase()) && tg(d, "project") !== "hotel_volta").map((d) => d.id); }
  const cnt = {}; const bump = (k) => (cnt[k] = (cnt[k] || 0) + 1);
  for (const id of ids) {
    try {
      const d = await api("GET", `/device/${id}`); const type = String(tg(d, "type") || "").toLowerCase();
      if (tg(d, "project") === "hotel_volta" || type === "uc511" || !SCOPE.includes(type)) { bump("εκτός"); console.log(P + "ΕΚΤΟΣ|" + d.name + "|" + type); continue; }
      const raw = d.payload_decoder ? Buffer.from(d.payload_decoder, "base64").toString("utf8") : ""; const code = nl(raw).trim();
      let next = null, st;
      if (!code) { st = "κενός"; next = v2; }
      else if (code === v2) { st = "ήδη_v2"; }
      else if (code === v1) { st = "v1"; next = v2; }
      else if (code.endsWith(v1)) { st = "δικός+v1"; next = code.slice(0, code.length - v1.length).trimEnd() + "\n\n" + v2; }
      else if (code.includes("SAG_DROP") || code.includes("SAG_HOURLY") || code.includes("sagKeepIdx")) { st = "άλλο"; }
      else { st = "δικός"; next = code + "\n\n" + v2; }
      bump(st);
      if (!next) { console.log(P + "ΤΙΠΟΤΑ|" + d.name + "|" + st); continue; }
      if (mode === "dry") { console.log(P + "DRY|" + d.name + "|" + type + "|" + st + "|" + (raw ? sha(raw) : "-") + "→" + sha(next) + "|" + next.length); continue; }
      await api("PUT", `/device/${id}`, { payload_decoder: Buffer.from(next, "utf8").toString("base64") });
      const back = await api("GET", `/device/${id}`); const got = back.payload_decoder ? Buffer.from(back.payload_decoder, "base64").toString("utf8") : "";
      const ok = got === next; bump(ok ? "OK" : "ΑΠΟΚΛΙΣΗ");
      console.log(P + (ok ? "OK" : "ΑΠΟΚΛΙΣΗ") + "|" + d.name + "|" + type + "|" + st + "|" + sha(got) + "|" + got.length);
    } catch (e) { bump("ERR"); console.log(P + "ERR|" + id + "|" + e.message); }
  }
  console.log(P + "ΣΥΝΟΛΟ|" + JSON.stringify(cnt)); console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
