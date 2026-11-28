// SAG — DEPLOY PROBE · T-READMETER-03: μετρητής αναγνώσεων (μόνο καταγραφή) σε warehouseSnapshot, subscriptionManage · commit b16d1e7.
// Πολιτική 6b0aa334 ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Παράθυρο hh:25–hh:15 UTC, ποτέ 00:10–00:30. Χωρίς scope = DRY RUN· {dry:false} = ανέβασμα.
// Σημ. 28/11: το download αμέσως μετά το upload μπορεί να δώσει τον ΠΑΛΙΟ κώδικα (FAIL)· ξανατρέξε DRY ~30΄΄ μετά — STOP «δεν είναι ο αναμενόμενος» με LIVE_BEFORE = νέο sha σημαίνει ότι ανέβηκε.
const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

const COMMIT = "b16d1e7bdf6407f0e0e408dbecdc8a5c3b5b6db1";
let DRY_RUN = true;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && (o.dry === false || String(o.dry) === "false")) DRY_RUN = false; } catch (e) { /* dry */ }
const TASKS = [   // expectLiveBefore = το αρχείο του git ΠΡΙΝ την αλλαγή (85ace51)
  { kind: "analysis", id: "6ae086fb889f4a000c4e15ff", path: "analysis/warehouseSnapshot.js", eol: "lf", language: "node",
    sha256: "7b478b849fdee5baabea39fa155941c8bc5fc3df3c0d780ab4786267b8c4765b", expectLiveBefore: "127e8e34e688ef1061330cec258629f34e8aa631760ef484d8767a2e8b6b93ec" },
  { kind: "analysis", id: "6aed920d0120f0000ca8e886", path: "analysis/subscriptionManage.js", eol: "lf", language: "node",
    sha256: "d91a045312230ef923eb6053e5d24fdafef74308cb83af1fc113b1c9aad6ec94", expectLiveBefore: "ec11fee2a386e7ffcfb3dc8ee24730f8ba70a49aae7786320957c70a8ff56cd8" },
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
  const headers = { Authorization: TOKEN, ...(opts.headers || {}) };
  headers["Content-Type"] = "application/json";
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 300));
  return j.result;
}
async function fetchGithub(path) {
  const url = `${REPO_RAW}/${COMMIT}/${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("GitHub " + r.status + " " + url);
  return Buffer.from(await r.arrayBuffer());
}
async function downloadAnalysis(id) {
  const meta = await api(`/analysis/${id}/download`);
  const buf = Buffer.from(await (await fetch(meta.url)).arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf) : buf;
}

(async () => {
  console.log(`=== DEPLOY PROBE · commit ${COMMIT.slice(0, 10)} · ${DRY_RUN ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ"} · ${new Date().toISOString()} ===`);
  for (const t of TASKS) {
    try {
      const raw = await fetchGithub(t.path);
      const body = normalize(raw, t.eol);
      const h = sha(body);
      console.log(`GH|${t.path}|bytes=${body.length}|sha256=${h}`);
      if (t.sha256 && h !== t.sha256) { console.log(`STOP|${t.path}|sha256 ΔΙΑΦΕΡΕΙ από το αναμενόμενο ${t.sha256.slice(0, 12)}… — ΔΕΝ ανεβαίνει`); continue; }
      const liveBefore = await downloadAnalysis(t.id);
      const hb = sha(liveBefore); const hbn = sha(normalize(liveBefore, "lf"));
      console.log(`LIVE_BEFORE|analysis ${t.id}|bytes=${liveBefore.length}|sha256=${hb}|lf=${hbn}`);
      if (t.expectLiveBefore && hb !== t.expectLiveBefore && hbn !== t.expectLiveBefore) { console.log(`STOP|analysis ${t.id}|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος (${t.expectLiveBefore.slice(0, 12)}…) — άλλαξε κάποιος; ΔΕΝ ανεβαίνει`); continue; }
      if (DRY_RUN) { console.log(`DRY|analysis ${t.id}`); continue; }
      await api(`/analysis/${t.id}/upload`, { method: "POST",
        body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: t.language || "node" }) });
      const liveAfter = await downloadAnalysis(t.id);
      const ha = sha(liveAfter);
      console.log(`${ha === h ? "OK" : "FAIL"}|analysis ${t.id}|μετά=${ha.slice(0, 16)}|αναμενόμενο=${h.slice(0, 16)}|bytes=${liveAfter.length}`);
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
