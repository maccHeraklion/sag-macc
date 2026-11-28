// SAG — DEPLOY PROBE · T-READMETER-02: μετρητής αναγνώσεων (μόνο καταγραφή) σε stationHealth, kbdi, gatewayLiveness · commit 87a781e.
// Πολιτικές 6aad48f0 (gatewayLiveness) + 6b0aa334 (kbdi, stationHealth) ΕΝΕΡΓΕΣ μόνο κατά το ανέβασμα. Παράθυρο hh:25–hh:15 UTC, ποτέ 00:10–00:30. Χωρίς scope = DRY RUN· {dry:false} = ανέβασμα.
// Σημ. 28/11: το download αμέσως μετά το upload μπορεί να δώσει τον ΠΑΛΙΟ κώδικα (FAIL)· ξανατρέξε DRY ~30΄΄ μετά — STOP «δεν είναι ο αναμενόμενος» με LIVE_BEFORE = νέο sha σημαίνει ότι ανέβηκε.
const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

const COMMIT = "87a781e5084832c20462b2f94302dfb82bb073f8";
let DRY_RUN = true;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && (o.dry === false || String(o.dry) === "false")) DRY_RUN = false; } catch (e) { /* dry */ }
const TASKS = [   // expectLiveBefore = το αρχείο του git ΠΡΙΝ την αλλαγή (65b7479)
  { kind: "analysis", id: "6b0a07adb7ab66000c5c2404", path: "analysis/stationHealth.js", eol: "lf", language: "node",
    sha256: "3a45797df47b24e8df5d26ac416ba5b3fb2521302909ee5f27816314d4d672f7", expectLiveBefore: "3776a2fbec044a3e013b17dcc53dd30b48062188db7ba36fd46996ed0ff7315e" },
  { kind: "analysis", id: "681bb24d8ee17b000a2ab2cd", path: "analysis/kbdi.js", eol: "lf", language: "node",
    sha256: "a4cf35bd3ff717883553b9d859bd7eb779ca3f75015cf339d304fc78f8205749", expectLiveBefore: "7e2904a812808d5483388a05829b05333d33147715b89312c47ec00589c508fc" },
  { kind: "analysis", id: "6aaec78ecaa1f0000cb2064c", path: "analysis/gatewayLiveness.js", eol: "lf", language: "node",
    sha256: "c3a51bd6203781a61e8fddc54b388ac99ccffcc764394d4dd5a407805e513e35", expectLiveBefore: "d506e955d93547f0d6cf8904bd9e397b93f2f0d9bb5588b2c5cb5b890713126f" },
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
