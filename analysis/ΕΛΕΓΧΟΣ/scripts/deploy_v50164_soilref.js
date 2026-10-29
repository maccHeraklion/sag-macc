// SAG — DEPLOY PROBE · ΠΥΡΗΝΑΣ v50.164 (T-SOILREF-01: ένας αισθητήρας απόφασης για το έδαφος, όχι μέσος όρος) · commit 8436485 · από GitHub raw στο TagoIO.
// Πολιτική 6aad48f03c26e2000bde4710 ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Παράθυρο hh:25–hh:15 UTC, ποτέ 00:10–00:30.
// ΑΥΤΟ είναι το script που έτρεξε στις 29/10 16:52 UTC (OK, μετά = c02e5df7…).
const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

const COMMIT = "8436485952a3e6d3c5df9de2fa0b4bc0127c348f";
const TASKS = [
  { kind: "analysis", id: "6898958ea9fc0d000a382484", path: "analysis/runPerTich.js",
    eol: "crlf", language: "node", sha256: "c02e5df793190d8491a5f7bed7be7d834b41166009ff95b23114a86b248ae3f4",
    expectLiveBefore: "3248e5c94d06f8fc85d1224f3a5965c7afc2c54051f0544cf36c63077335d2b9" },
];
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const normalize = (buf, eol) => {
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.replace(/\r\n/g, "\n");
  if (eol === "crlf") s = s.replace(/\n/g, "\r\n");
  return Buffer.from(s, "utf8");
};
async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json", ...(opts.headers || {}) };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 300));
  return j.result;
}
async function downloadAnalysis(id) {
  const meta = await api(`/analysis/${id}/download`);
  const buf = Buffer.from(await (await fetch(meta.url)).arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf) : buf;
}
(async () => {
  console.log(`=== DEPLOY PROBE · commit ${COMMIT.slice(0, 10)} · ΑΝΕΒΑΣΜΑ · ${new Date().toISOString()} ===`);
  for (const t of TASKS) {
    try {
      const r = await fetch(`${REPO_RAW}/${COMMIT}/${t.path}`);
      if (!r.ok) throw new Error("GitHub " + r.status);
      const body = normalize(Buffer.from(await r.arrayBuffer()), t.eol);
      const h = sha(body);
      console.log(`GH|${t.path}|bytes=${body.length}|sha256=${h}`);
      if (h !== t.sha256) { console.log(`STOP|${t.path}|sha256 ΔΙΑΦΕΡΕΙ — ΔΕΝ ανεβαίνει`); continue; }
      const liveBefore = await downloadAnalysis(t.id);
      const hb = sha(liveBefore);
      console.log(`LIVE_BEFORE|analysis ${t.id}|bytes=${liveBefore.length}|sha256=${hb}`);
      if (hb !== t.expectLiveBefore) { console.log(`STOP|analysis ${t.id}|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος — ΔΕΝ ανεβαίνει`); continue; }
      await api(`/analysis/${t.id}/upload`, { method: "POST",
        body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: t.language || "node" }) });
      const ha = sha(await downloadAnalysis(t.id));
      console.log(`${ha === h ? "OK" : "FAIL"}|analysis ${t.id}|μετά=${ha.slice(0, 16)}|αναμενόμενο=${h.slice(0, 16)}`);
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
