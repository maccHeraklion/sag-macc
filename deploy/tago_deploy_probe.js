// SAG — DEPLOY PROBE · ανέβασμα από το GitHub (sag-macc) στο TagoIO, ΜΕΣΑ από analysis.
//
// Γιατί υπάρχει: το MCP κατεβάζει/ανεβάζει scripts ΜΟΝΟ έως 1 MiB και δεν ανεβάζει Files.
// Ο πυρήνας runPerTich είναι ~1,26 MB. Αυτό το script ανεβαίνει (είναι ~5 KB) στην analysis-
// ανιχνευτή `6aa2d24f2f585a000b90b1a1` (runtime node-rt2025), η οποία τραβά το αρχείο από το
// δημόσιο GitHub raw σε ΚΑΡΦΩΜΕΝΟ commit, ελέγχει sha256, το ανεβάζει με το ΔΙΚΟ της token και
// ξανακατεβάζει για επαλήθευση. Χρειάζεται την πολιτική «[Analysis] SAG deploy από GitHub» ΕΝΕΡΓΗ
// (upload_script στον πυρήνα, file/upload στα storage/sagMain/ και html_files/). Μετά το deploy η
// πολιτική ΑΠΕΝΕΡΓΟΠΟΙΕΙΤΑΙ (active:false) — ο ανιχνευτής ξαναγίνεται μόνο-ανάγνωσης.
//
// Χρήση (από Claude Code + TagoIO MCP):
//   1. Συμπλήρωσε το TASKS (commit sha + expected sha256 του ΑΚΡΙΒΟΥΣ byte-περιεχομένου που θα
//      ανέβει: πυρήνας = CRLF χωρίς BOM · widget/φόρμα = LF χωρίς BOM).
//   2. upload_analysis_script → 6aa2d24f… με αυτό το αρχείο.  3. Ενεργοποίηση πολιτικής.
//   4. run_analysis.  5. read_analysis_console → κάθε γραμμή «OK|…».  6. Πολιτική active:false.
//   Ανεβάσματα ΜΟΝΟ hh:25–hh:15 UTC, ΠΟΤΕ 00:10–00:30 UTC (ημερήσιο tick).
//
// Line endings: το GitHub raw δίνει το blob όπως είναι στο index (LF). Το `eol` κάθε task
// κανονικοποιεί ΠΡΙΝ το hash: "crlf" για τον πυρήνα (το μητρώο μετρά «0 γυμνά LF»), "lf" για τα άλλα.

const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

// ── ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΑΝΑ DEPLOY ────────────────────────────────────────────────
const COMMIT = "0000000000000000000000000000000000000000"; // git sha του commit στο main
const DRY_RUN = true;   // true = μόνο κατέβασμα από GitHub + hash, ΚΑΝΕΝΑ ανέβασμα
const TASKS = [
  // { kind: "analysis", id: "6898958ea9fc0d000a382484", path: "analysis/runPerTich.js",
  //   eol: "crlf", language: "node", sha256: "<sha256 του CRLF αρχείου>" },
  // { kind: "file", target: "storage/sagMain/index-7cbd9a4e.js", path: "_dist-sagMain/index-7cbd9a4e.js",
  //   eol: "lf", public: true, sha256: "<sha256 του LF αρχείου>" },
  // { kind: "file", target: "html_files/configuration.html", path: "custom_html_files/configuration.html",
  //   eol: "lf", public: true, sha256: "<sha256 του LF αρχείου>" },
];
// ────────────────────────────────────────────────────────────────────────────

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const normalize = (buf, eol) => {
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);          // χωρίς BOM
  s = s.replace(/\r\n/g, "\n");
  if (eol === "crlf") s = s.replace(/\n/g, "\r\n");
  return Buffer.from(s, "utf8");
};
async function api(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Authorization: TOKEN, "Content-Type": "application/json", ...(opts.headers || {}) } });
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
  // Σωστή διαδρομή (μετρημένο 15/9 και 18/9): GET /analysis/{id}/download → { url, size, size_unit }.
  // Το /analysis/{id}/script ΔΕΝ υπάρχει («Route Not Found»).
  const meta = await api(`/analysis/${id}/download`);
  const url = typeof meta === "string" ? meta : meta.url;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf) : buf;
}

(async () => {
  console.log(`=== DEPLOY PROBE · commit ${COMMIT.slice(0, 10)} · ${DRY_RUN ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ"} · ${new Date().toISOString()} ===`);
  if (!TASKS.length) { console.log("ERR|κενό TASKS"); return; }
  for (const t of TASKS) {
    try {
      const raw = await fetchGithub(t.path);
      const body = normalize(raw, t.eol);
      const h = sha(body);
      const lines = body.toString("utf8").split("\n").length;
      console.log(`GH|${t.path}|bytes=${body.length}|lines=${lines}|sha256=${h}`);
      if (t.sha256 && h !== t.sha256) { console.log(`STOP|${t.path}|sha256 ΔΙΑΦΕΡΕΙ από το αναμενόμενο ${t.sha256.slice(0, 12)}… — ΔΕΝ ανεβαίνει`); continue; }
      if (DRY_RUN) { console.log(`DRY|${t.path}|θα ανέβαινε σε ${t.kind === "analysis" ? "analysis " + t.id : "file " + t.target}`); continue; }
      if (t.kind === "analysis") {
        const before = sha(await downloadAnalysis(t.id));
        await api(`/analysis/${t.id}/upload`, { method: "POST",
          body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: t.language || "node" }) });
        const after = sha(await downloadAnalysis(t.id));
        console.log(`${after === h ? "OK" : "FAIL"}|analysis ${t.id}|πριν=${before.slice(0, 12)}|μετά=${after.slice(0, 12)}|αναμενόμενο=${h.slice(0, 12)}`);
      } else if (t.kind === "file") {
        await api(`/files`, { method: "POST",
          body: JSON.stringify([{ filename: t.target, file: body.toString("base64"), public: t.public !== false }]) });
        const list = await api(`/files?path=${encodeURIComponent(t.target.replace(/[^/]+$/, ""))}`);
        const entry = (list.files || list || []).find(f => (f.filename || f.name || "").endsWith(t.target.split("/").pop()));
        console.log(`${entry && entry.size === body.length ? "OK" : "CHECK"}|file ${t.target}|size=${entry ? entry.size : "?"}|αναμενόμενο=${body.length}`);
      }
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
