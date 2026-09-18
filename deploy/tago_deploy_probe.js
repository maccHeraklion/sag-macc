// SAG — DEPLOY PROBE · ανέβασμα από το GitHub (sag-macc) στο TagoIO, ΜΕΣΑ από analysis.
//
// Γιατί υπάρχει: το MCP κατεβάζει/ανεβάζει scripts ΜΟΝΟ έως 1 MiB και δεν ανεβάζει Files.
// Ο πυρήνας runPerTich είναι ~1,26 MB. Αυτό το script ανεβαίνει (είναι ~8 KB) στην analysis-
// ανιχνευτή `6aa2d24f2f585a000b90b1a1` (runtime node-rt2025), η οποία τραβά το αρχείο από το
// δημόσιο GitHub raw σε ΚΑΡΦΩΜΕΝΟ commit, ελέγχει sha256, το ανεβάζει με το ΔΙΚΟ της token και
// ξανακατεβάζει/ελέγχει για επαλήθευση. Χρειάζεται την πολιτική «[Analysis] SAG deploy από GitHub»
// (`6aad48f03c26e2000bde4710`) ΕΝΕΡΓΗ μόνο κατά το deploy.
//
// ══ ΠΑΓΙΔΑ 18/9/2026 (μητρώο #223) — ΓΙΑΤΙ ΤΑ FILES ΑΝΕΒΑΙΝΟΥΝ ΜΕ MULTIPART ΚΑΙ ΟΧΙ BASE64 ══
// Το `POST /files` με base64 (SDK uploadBase64) ΔΕΝ δέχεται content type: το αρχείο σερβίρεται ως
// `application/octet-stream` και ο browser το ΚΑΤΕΒΑΖΕΙ αντί να το ανοίξει. Έτσι έσπασε η φόρμα
// configuration.html για ~1 ώρα. Μόνο το multipart (`multipart_action: start/upload/end`) δηλώνει
// `contentType`. Και μετά από ΚΑΘΕ ανέβασμα Files γίνεται HEAD στη δημόσια διεύθυνση: αν το
// Content-Type δεν είναι το αναμενόμενο, το probe τυπώνει FAIL — δεν θεωρείται επιτυχία.
//
// Χρήση (Claude Code + TagoIO MCP): συμπλήρωσε COMMIT/TASKS (sha256 του ΑΚΡΙΒΟΥΣ byte-περιεχομένου:
// πυρήνας = CRLF χωρίς BOM · widget/φόρμα = LF χωρίς BOM) → upload_analysis_script στο 6aa2d24f…
// → πολιτική active:true → run_analysis → read_analysis_console (κάθε task «OK|…») → active:false.
// Ανεβάσματα ΜΟΝΟ hh:25–hh:15 UTC, ΠΟΤΕ 00:10–00:30 UTC (ημερήσιο tick).

const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PUBLIC_FILE_BASE = "https://api.tago.io/file/67934c48e8e573000ae5964b/"; // + <path> (302 → files.us-e1)
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

// ── ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΑΝΑ DEPLOY ────────────────────────────────────────────────
const COMMIT = "0000000000000000000000000000000000000000"; // git sha του commit στο main
const DRY_RUN = true;   // true = μόνο κατέβασμα από GitHub + hash, ΚΑΝΕΝΑ ανέβασμα
const TASKS = [
  // { kind: "analysis", id: "6898958ea9fc0d000a382484", path: "analysis/runPerTich.js",
  //   eol: "crlf", language: "node", sha256: "<sha256 του CRLF αρχείου>",
  //   expectLiveBefore: "<sha256 του ζωντανού που περιμένουμε να αντικαταστήσουμε>" },
  // { kind: "file", target: "storage/sagMain/index-7cbd9a4e.js", path: "_dist-sagMain/index-7cbd9a4e.js",
  //   eol: "lf", contentType: "text/javascript", sha256: "<sha256 του LF αρχείου>" },
  // { kind: "file", target: "html_files/configuration.html", path: "custom_html_files/configuration.html",
  //   eol: "lf", contentType: "text/html", sha256: "<sha256 του LF αρχείου>" },
];
// ────────────────────────────────────────────────────────────────────────────

const CONTENT_TYPE_BY_EXT = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml" };
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const normalize = (buf, eol) => {
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);          // χωρίς BOM
  s = s.replace(/\r\n/g, "\n");
  if (eol === "crlf") s = s.replace(/\n/g, "\r\n");
  return Buffer.from(s, "utf8");
};
async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
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
  // Σωστή διαδρομή (μετρημένο 15/9 και 18/9): GET /analysis/{id}/download → { url, size }.
  const meta = await api(`/analysis/${id}/download`);
  const buf = Buffer.from(await (await fetch(meta.url)).arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf) : buf;
}
/* Multipart upload (ίδιο πρωτόκολλο με SDK Files.uploadFile): start (με contentType) → upload part 1 → end.
   Μονοκόμματο: τα αρχεία μας είναι < 5 MB, άρα ένα μέρος. */
async function uploadFileMultipart(target, body, contentType, isPublic = true) {
  const fdStart = new FormData();
  fdStart.append("multipart_action", "start");
  fdStart.append("filename", target);
  fdStart.append("public", JSON.stringify(isPublic));
  fdStart.append("contentType", contentType);
  const uploadID = await api("/files", { method: "POST", body: fdStart });
  const fdPart = new FormData();
  fdPart.append("multipart_action", "upload");
  fdPart.append("filename", target);
  fdPart.append("public", JSON.stringify(isPublic));
  fdPart.append("upload_id", uploadID);
  fdPart.append("part", "1");
  fdPart.append("file", new Blob([body], { type: contentType }), target);
  const part = await api("/files", { method: "POST", body: fdPart });
  const done = await api("/files", { method: "POST",
    body: JSON.stringify({ multipart_action: "end", filename: target, public: isPublic, upload_id: uploadID,
      parts: [{ ETag: part.ETag, PartNumber: 1 }] }) });
  return { uploadID, done };
}
async function verifyPublicFile(target, body, contentType) {
  const r = await fetch(PUBLIC_FILE_BASE + target, { redirect: "follow", cache: "no-store" });
  const got = Buffer.from(await r.arrayBuffer());
  const ct = String(r.headers.get("content-type") || "");
  const okBytes = got.length === body.length && sha(got) === sha(body);
  const okType = ct.toLowerCase().startsWith(contentType.toLowerCase());
  return { okBytes, okType, ct, bytes: got.length };
}

(async () => {
  console.log(`=== DEPLOY PROBE · commit ${COMMIT.slice(0, 10)} · ${DRY_RUN ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ"} · ${new Date().toISOString()} ===`);
  if (!TASKS.length) { console.log("ERR|κενό TASKS"); return; }
  for (const t of TASKS) {
    try {
      const raw = await fetchGithub(t.path);
      const body = normalize(raw, t.eol);
      const h = sha(body);
      console.log(`GH|${t.path}|bytes=${body.length}|lines=${body.toString("utf8").split("\n").length}|sha256=${h}`);
      if (t.sha256 && h !== t.sha256) { console.log(`STOP|${t.path}|sha256 ΔΙΑΦΕΡΕΙ από το αναμενόμενο ${t.sha256.slice(0, 12)}… — ΔΕΝ ανεβαίνει`); continue; }
      if (t.kind === "analysis") {
        const liveBefore = await downloadAnalysis(t.id);
        const hb = sha(liveBefore);
        console.log(`LIVE_BEFORE|analysis ${t.id}|bytes=${liveBefore.length}|sha256=${hb}`);
        if (t.expectLiveBefore && hb !== t.expectLiveBefore) { console.log(`STOP|analysis ${t.id}|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος (${t.expectLiveBefore.slice(0, 12)}…) — άλλαξε κάποιος; ΔΕΝ ανεβαίνει`); continue; }
        if (DRY_RUN) { console.log(`DRY|analysis ${t.id}`); continue; }
        await api(`/analysis/${t.id}/upload`, { method: "POST",
          body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: t.language || "node" }) });
        const liveAfter = await downloadAnalysis(t.id);
        const ha = sha(liveAfter);
        console.log(`${ha === h ? "OK" : "FAIL"}|analysis ${t.id}|μετά=${ha.slice(0, 16)}|αναμενόμενο=${h.slice(0, 16)}|bytes=${liveAfter.length}`);
      } else if (t.kind === "file") {
        const ct = t.contentType || CONTENT_TYPE_BY_EXT[t.target.split(".").pop().toLowerCase()] || "application/octet-stream";
        if (DRY_RUN) { console.log(`DRY|file ${t.target}|contentType=${ct}`); continue; }
        const up = await uploadFileMultipart(t.target, body, ct, t.public !== false);
        console.log(`UPLOADED|${t.target}|upload_id=${String(up.uploadID).slice(0, 24)}|${JSON.stringify(up.done).slice(0, 100)}`);
        const v = await verifyPublicFile(t.target, body, ct);
        console.log(`${v.okBytes && v.okType ? "OK" : "FAIL"}|file ${t.target}|bytes=${v.bytes}/${body.length} ${v.okBytes ? "✔" : "✗"}|content-type=${v.ct} ${v.okType ? "✔" : "✗ (αναμενόμενο " + ct + ")"}`);
      }
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
