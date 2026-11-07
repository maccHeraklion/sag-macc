// SAG — DEPLOY PROBE · T-GWMAP-10: κατάσταση εκτός δικτύου · gatewayLiveness + html_files/sag-map.html · commit 0f8129e. Πολιτική 6aad48f0 ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Χωρίς scope = DRY RUN· {dry:false} = ανέβασμα.
const zlib = require("zlib"); const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const PUB = "https://api.tago.io/file/67934c48e8e573000ae5964b/";
const COMMIT = "0f8129e4ce0ec8e827bffd2940900ce1c41bd7eb"; const AID = "6aaec78ecaa1f0000cb2064c"; const TARGET = "html_files/sag-map.html"; const CT = "text/html";
const W_AN = "1967b4cc7067c9593dad70e7ad77a4361abc5bdc44c916979d14646cc9dc20f0", B_AN = "58fb1b7151d2fa106e639fa2b676f2c1ef1d1bde1fa926066a811266f4631ce6";
const W_F = "252f90c521b75be767234f196ccb98bc12fcd38a93b101381a6ba341636e67e0", B_F = "efc5809c50367d8272866afa2c095049aac1138f77544f3d584d190ea9886e52";
let DRY = true; try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && (o.dry === false || String(o.dry) === "false")) DRY = false; } catch (e) { /* dry */ }
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex"); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, opts = {}) { const headers = { Authorization: TOKEN, ...(opts.headers || {}) }; if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json"; const r = await fetch(API + path, { ...opts, headers }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 300)); return j.result; }
async function gh(p) { const r = await fetch(`https://raw.githubusercontent.com/maccHeraklion/sag-macc/${COMMIT}/${p}`); if (!r.ok) throw new Error("GitHub " + r.status); return Buffer.from(Buffer.from(await r.arrayBuffer()).toString("utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n"), "utf8"); }
async function liveAn() { const m = await api(`/analysis/${AID}/download`); const b = Buffer.from(await (await fetch(m.url)).arrayBuffer()); return (b[0] === 0x1f && b[1] === 0x8b) ? zlib.gunzipSync(b) : b; }
async function pub() { const r = await fetch(PUB + TARGET + "?nocache=" + Date.now() + Math.random().toString(36).slice(2), { redirect: "follow", cache: "no-store" }); return { buf: Buffer.from(await r.arrayBuffer()), ct: String(r.headers.get("content-type") || "") }; }
(async () => {
  console.log("=== DEPLOY GW10 · " + (DRY ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ") + " · " + new Date().toISOString());
  const a = await gh("analysis/gatewayLiveness.js"), f = await gh("custom_html_files/sag-map.html");
  console.log("GH|analysis " + sha(a).slice(0, 16) + "|σελίδα " + sha(f).slice(0, 16)); if (sha(a) !== W_AN || sha(f) !== W_F) { console.log("STOP|hash GitHub"); return; }
  const la = await liveAn(), lf = await pub(); console.log("LIVE_BEFORE|analysis " + sha(la).slice(0, 16) + "|σελίδα " + sha(lf.buf).slice(0, 16)); if (sha(la) !== B_AN || sha(lf.buf) !== B_F) { console.log("STOP|ζωντανό διαφορετικό"); return; }
  if (DRY) { console.log("DRY|όλα έτοιμα"); console.log("=== ΤΕΛΟΣ"); return; }
  await api(`/analysis/${AID}/upload`, { method: "POST", body: JSON.stringify({ file: a.toString("base64"), file_name: "script.js", language: "node" }) });
  const ha = sha(await liveAn()); console.log((ha === W_AN ? "OK" : "FAIL") + "|analysis " + ha.slice(0, 16));
  const f1 = new FormData(); f1.append("multipart_action", "start"); f1.append("filename", TARGET); f1.append("public", "true"); f1.append("contentType", CT); const id = await api("/files", { method: "POST", body: f1 });
  const f2 = new FormData(); f2.append("multipart_action", "upload"); f2.append("filename", TARGET); f2.append("public", "true"); f2.append("upload_id", id); f2.append("part", "1"); f2.append("file", new Blob([f], { type: CT }), TARGET); const part = await api("/files", { method: "POST", body: f2 });
  await api("/files", { method: "POST", body: JSON.stringify({ multipart_action: "end", filename: TARGET, public: true, upload_id: id, parts: [{ ETag: part.ETag, PartNumber: 1 }] }) });
  for (let i = 1; i <= 5; i++) { const v = await pub(); const ok = sha(v.buf) === W_F && v.ct.toLowerCase().startsWith(CT); console.log((ok ? "OK" : "WAIT") + "|σελίδα bytes=" + v.buf.length + "|ct=" + v.ct + "|δοκιμή " + i); if (ok) break; await sleep(15000); }
  console.log("=== ΤΕΛΟΣ");
})().catch((e) => console.log("ERR|" + e.message));
