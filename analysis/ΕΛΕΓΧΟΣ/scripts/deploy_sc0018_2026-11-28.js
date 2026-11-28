// SAG — DEPLOY PROBE · SC-0018 (T-OM-CITY-01): δημόσιο ημερολόγιο αλλαγών html_files/sag-changelog.json · commit 6f0d765.
// Πολιτική 6aad48f0 (html_files) ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Χωρίς scope = DRY RUN· {dry:false} = ανέβασμα.
// Η ανάλυση 67ff75b5 (om-city-v2) ανέβηκε ήδη με MCP upload_analysis_script· εδώ μόνο το δημόσιο αρχείο.
const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PUBLIC_FILE_BASE = "https://api.tago.io/file/67934c48e8e573000ae5964b/";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

const COMMIT = "6f0d76573091d5360f1358f84e06eda22d01c57b";
let DRY_RUN = true;
try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && (o.dry === false || String(o.dry) === "false")) DRY_RUN = false; } catch (e) { /* dry */ }
const TASKS = [   // expectLiveBefore = δημόσιο SC-0017 (28/11 13:12)
  { kind: "file", target: "html_files/sag-changelog.json", path: "changelog/system_changelog.json", eol: "lf", contentType: "application/json",
    sha256: "1a9fbc172ef530ddf68fcbb46cec6a9554fa252566ac26a5b5d63c436bc4a0bd", expectLiveBefore: "019a5fdd3787a39f36b63518263b55c0816e4eb552d38919d48b089e8c45332f" },
];

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalize = (buf, eol) => {
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
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
  const meta = await api(`/analysis/${id}/download`);
  const buf = Buffer.from(await (await fetch(meta.url)).arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf) : buf;
}
async function fetchPublicFile(target) {
  const r = await fetch(PUBLIC_FILE_BASE + target + "?nocache=" + Date.now() + Math.random().toString(36).slice(2), { redirect: "follow", cache: "no-store" });
  return { buf: Buffer.from(await r.arrayBuffer()), ct: String(r.headers.get("content-type") || "") };
}
async function uploadFileMultipart(target, body, contentType, isPublic = true) {
  const fdStart = new FormData();
  fdStart.append("multipart_action", "start"); fdStart.append("filename", target); fdStart.append("public", JSON.stringify(isPublic)); fdStart.append("contentType", contentType);
  const uploadID = await api("/files", { method: "POST", body: fdStart });
  const fdPart = new FormData();
  fdPart.append("multipart_action", "upload"); fdPart.append("filename", target); fdPart.append("public", JSON.stringify(isPublic));
  fdPart.append("upload_id", uploadID); fdPart.append("part", "1"); fdPart.append("file", new Blob([body], { type: contentType }), target);
  const part = await api("/files", { method: "POST", body: fdPart });
  const done = await api("/files", { method: "POST", body: JSON.stringify({ multipart_action: "end", filename: target, public: isPublic, upload_id: uploadID, parts: [{ ETag: part.ETag, PartNumber: 1 }] }) });
  return { uploadID, done };
}
async function verifyPublicFile(target, body, contentType) {
  let v = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { buf: got, ct } = await fetchPublicFile(target);
    const okBytes = got.length === body.length && sha(got) === sha(body);
    const okType = ct.toLowerCase().startsWith(contentType.toLowerCase());
    v = { okBytes, okType, ct, bytes: got.length, attempt };
    if (okBytes && okType) return v;
    console.log(`WAIT|file ${target}|δοκιμή ${attempt}: bytes=${got.length}/${body.length} — πιθανό CDN cache, ξανά σε 15 s`);
    await sleep(15000);
  }
  return v;
}

(async () => {
  console.log(`=== DEPLOY PROBE · commit ${COMMIT.slice(0, 10)} · ${DRY_RUN ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ"} · ${new Date().toISOString()} ===`);
  for (const t of TASKS) {
    try {
      const body = normalize(await fetchGithub(t.path), t.eol);
      const h = sha(body);
      console.log(`GH|${t.path}|bytes=${body.length}|sha256=${h}`);
      if (t.sha256 && h !== t.sha256) { console.log(`STOP|${t.path}|sha256 ΔΙΑΦΕΡΕΙ από το αναμενόμενο ${t.sha256.slice(0, 12)}… — ΔΕΝ ανεβαίνει`); continue; }
      if (t.kind === "analysis") {
        const liveBefore = await downloadAnalysis(t.id);
        const hb = sha(liveBefore), hbn = sha(normalize(liveBefore, "lf"));
        console.log(`LIVE_BEFORE|analysis ${t.id}|bytes=${liveBefore.length}|sha256=${hb}|lf=${hbn}`);
        if (t.expectLiveBefore && hb !== t.expectLiveBefore && hbn !== t.expectLiveBefore) { console.log(`STOP|analysis ${t.id}|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος (${t.expectLiveBefore.slice(0, 12)}…) — ΔΕΝ ανεβαίνει`); continue; }
        if (DRY_RUN) { console.log(`DRY|analysis ${t.id}`); continue; }
        await api(`/analysis/${t.id}/upload`, { method: "POST", body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: t.language || "node" }) });
        const ha = sha(await downloadAnalysis(t.id));
        console.log(`${ha === h ? "OK" : "FAIL"}|analysis ${t.id}|μετά=${ha.slice(0, 16)}|αναμενόμενο=${h.slice(0, 16)}`);
      } else {
        const before = await fetchPublicFile(t.target);
        const hb = sha(before.buf);
        console.log(`LIVE_BEFORE|file ${t.target}|bytes=${before.buf.length}|sha256=${hb}|content-type=${before.ct}`);
        if (t.expectLiveBefore && hb !== t.expectLiveBefore) { console.log(`STOP|file ${t.target}|το ζωντανό ΔΕΝ είναι το αναμενόμενο — ΔΕΝ ανεβαίνει`); continue; }
        if (DRY_RUN) { console.log(`DRY|file ${t.target}`); continue; }
        await uploadFileMultipart(t.target, body, t.contentType, true);
        const v = await verifyPublicFile(t.target, body, t.contentType);
        console.log(`${v.okBytes && v.okType ? "OK" : "FAIL"}|file ${t.target}|bytes=${v.bytes}/${body.length}|content-type=${v.ct}|δοκιμές=${v.attempt}`);
      }
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
