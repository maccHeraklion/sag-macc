// SAG — DEPLOY PROBE · T-GWMAP-08: σύμβολα χάρτη στόλου · μόνο html_files/sag-map.html · commit 87697db. Πολιτική 6aad48f0 ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Χωρίς scope = DRY RUN· {dry:false} = ανέβασμα.
const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const PUB = "https://api.tago.io/file/67934c48e8e573000ae5964b/";
const COMMIT = "87697dbd4a506ff040337ab5c649a0d70835d737"; const TARGET = "html_files/sag-map.html"; const CT = "text/html";
const W_F = "0529da4af6f52699ccb9656a3cad6ae654c3dd4bc10bfa878ccc518a08f7dc14", B_F = "306b48860c4c86ad15283b23ababa9f27e3b1bd3372cc3d4be461207b9b4a5c8";
let DRY = true; try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && (o.dry === false || String(o.dry) === "false")) DRY = false; } catch (e) { /* dry */ }
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex"); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, opts = {}) { const headers = { Authorization: TOKEN, ...(opts.headers || {}) }; if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json"; const r = await fetch(API + path, { ...opts, headers }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 300)); return j.result; }
async function gh(p) { const r = await fetch(`https://raw.githubusercontent.com/maccHeraklion/sag-macc/${COMMIT}/${p}`); if (!r.ok) throw new Error("GitHub " + r.status); return Buffer.from(Buffer.from(await r.arrayBuffer()).toString("utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n"), "utf8"); }
async function pub() { const r = await fetch(PUB + TARGET + "?nocache=" + Date.now() + Math.random().toString(36).slice(2), { redirect: "follow", cache: "no-store" }); return { buf: Buffer.from(await r.arrayBuffer()), ct: String(r.headers.get("content-type") || "") }; }
(async () => {
  console.log("=== DEPLOY GW8 · " + (DRY ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ") + " · " + new Date().toISOString());
  const f = await gh("custom_html_files/sag-map.html"); console.log("GH|σελίδα " + sha(f).slice(0, 16)); if (sha(f) !== W_F) { console.log("STOP|hash GitHub"); return; }
  const lf = await pub(); console.log("LIVE_BEFORE|σελίδα " + sha(lf.buf).slice(0, 16)); if (sha(lf.buf) !== B_F) { console.log("STOP|ζωντανό διαφορετικό"); return; }
  if (DRY) { console.log("DRY|όλα έτοιμα"); console.log("=== ΤΕΛΟΣ"); return; }
  const f1 = new FormData(); f1.append("multipart_action", "start"); f1.append("filename", TARGET); f1.append("public", "true"); f1.append("contentType", CT); const id = await api("/files", { method: "POST", body: f1 });
  const f2 = new FormData(); f2.append("multipart_action", "upload"); f2.append("filename", TARGET); f2.append("public", "true"); f2.append("upload_id", id); f2.append("part", "1"); f2.append("file", new Blob([f], { type: CT }), TARGET); const part = await api("/files", { method: "POST", body: f2 });
  await api("/files", { method: "POST", body: JSON.stringify({ multipart_action: "end", filename: TARGET, public: true, upload_id: id, parts: [{ ETag: part.ETag, PartNumber: 1 }] }) });
  for (let i = 1; i <= 5; i++) { const v = await pub(); const ok = sha(v.buf) === W_F && v.ct.toLowerCase().startsWith(CT); console.log((ok ? "OK" : "WAIT") + "|σελίδα bytes=" + v.buf.length + "|ct=" + v.ct + "|δοκιμή " + i); if (ok) break; await sleep(15000); }
  console.log("=== ΤΕΛΟΣ");
})().catch((e) => console.log("ERR|" + e.message));
