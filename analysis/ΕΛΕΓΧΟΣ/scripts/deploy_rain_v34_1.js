// SAG — DEPLOY PROBE · ανάλυση βροχής v34.1 (T-RAIN-UNIFIED-01, άγκυρα μερικής κάλυψης στο SDK) · από GitHub raw στο TagoIO.
// Πολιτική 6aad48f03c26e2000bde4710 ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Παράθυρο hh:25–hh:15 UTC.
const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

const COMMIT = "9f7bae7";
const TASK = { id: "690e32179330e4000a5d16e5", path: "analysis/calculate_old_rainHeightSums.js", language: "node",
  sha256: "595b62d9d6f4e94e095c785b66ae6a8c5a88dc78af157dc0b556359cd7c068f5",
  expectLiveBefore: "e94d862326751be0b91d1096d741949bddd4850ff2adf3a2d8342906df5606eb" };

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
async function api(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: TOKEN, "Content-Type": "application/json" } });
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
  console.log(`=== DEPLOY PROBE · v34.1 · commit ${COMMIT} · ${new Date().toISOString()} ===`);
  try {
    const r = await fetch(`${REPO_RAW}/${COMMIT}/${TASK.path}`);
    if (!r.ok) throw new Error("GitHub " + r.status);
    const body = Buffer.from((await r.text()).replace(/\r\n/g, "\n"), "utf8");
    const h = sha(body);
    console.log(`GH|${TASK.path}|bytes=${body.length}|sha256=${h}`);
    if (h !== TASK.sha256) { console.log("STOP|sha256 διαφέρει — ΔΕΝ ανεβαίνει"); return; }
    const before = await downloadAnalysis(TASK.id); const hb = sha(before);
    console.log(`LIVE_BEFORE|bytes=${before.length}|sha256=${hb}`);
    if (hb !== TASK.expectLiveBefore) { console.log("STOP|ο ζωντανός δεν είναι ο αναμενόμενος — ΔΕΝ ανεβαίνει"); return; }
    await api(`/analysis/${TASK.id}/upload`, { method: "POST",
      body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: TASK.language }) });
    const after = await downloadAnalysis(TASK.id); const ha = sha(after);
    console.log(`${ha === h ? "OK" : "FAIL"}|analysis ${TASK.id}|μετά=${ha.slice(0, 16)}|αναμενόμενο=${h.slice(0, 16)}|bytes=${after.length}`);
  } catch (e) { console.log("ERR|" + e.message); }
  console.log("=== ΤΕΛΟΣ ===");
})();
