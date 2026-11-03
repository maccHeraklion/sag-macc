// SAG — DEPLOY PROBE · T-DEPTH1-01: ΠΥΡΗΝΑΣ v50.167 + SYNC v16 + ΦΟΡΜΑ v26 + WIDGET W-DEPTH1-01 («ένα βάθος αισθητήρα εδάφους») · commit 068c4c4 · από GitHub raw στο TagoIO.
// Πολιτική 6aad48f03c26e2000bde4710 ΕΝΕΡΓΗ μόνο κατά το ανέβασμα. Παράθυρο hh:25–hh:15 UTC, ποτέ 00:10–00:30.
const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PUBLIC_FILE_BASE = "https://api.tago.io/file/67934c48e8e573000ae5964b/";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

const COMMIT = "068c4c43f2ef6ef9c12a85e74a5789ca65853d66";
const DRY_RUN = false;
const TASKS = [
  { kind: "analysis", id: "6898958ea9fc0d000a382484", path: "analysis/runPerTich.js",
    eol: "crlf", language: "node", sha256: "42727bdad9933a36acdbdf27c97ae0d541e1b7e4aca2e82fc2530f05416a7cc2",
    expectLiveBefore: "348fa227ff3a4bbe99a457cf09700e868ed0992df4a92f8c81d26379a3a98310" },
  { kind: "analysis", id: "68fe925b3607df0010ef833c", path: "analysis/setFieldParametersFromDeviceData.js",
    eol: "lf", language: "node", sha256: "5e54d2f753b0a1f48498622888f8c9429dc4eb0acb17da682cde2ed28c9be220",
    expectLiveBefore: "169cbcf90dd7eee60a1b966337994a99640f215ad0d7c088497da6e6ef9c7584" },
  { kind: "file", target: "html_files/configuration.html", path: "custom_html_files/configuration.html",
    eol: "lf", contentType: "text/html", sha256: "1be20cc71c8c3b294ed66ac5c453d81f5a557971b933cad906048388ceda71a3",
    expectLiveBefore: "f5b369c632f625072cf9a8c16c9c8c816e9379872c3b95bfec5c54b4508ce7ab" },
  { kind: "file", target: "storage/sagMain/index-7cbd9a4e.js", path: "_dist-sagMain/index-7cbd9a4e.js",
    eol: "lf", contentType: "text/javascript", sha256: "a1debe34b17c70aacca27783842c337e64b222539d466d7782fc744b39b1a615",
    expectLiveBefore: "98b15104a6db56c409a7d98fddc13e75e94f00b090446c413aaa99239dc8d000" },
];

const CONTENT_TYPE_BY_EXT = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml" };
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
  const r = await fetch(PUBLIC_FILE_BASE + target + "?nocache=" + Date.now() + Math.random().toString(36).slice(2),
    { redirect: "follow", cache: "no-store" });
  return { buf: Buffer.from(await r.arrayBuffer()), ct: String(r.headers.get("content-type") || "") };
}
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
        const before = await fetchPublicFile(t.target);
        const hb = sha(before.buf);
        console.log(`LIVE_BEFORE|file ${t.target}|bytes=${before.buf.length}|sha256=${hb}|content-type=${before.ct}`);
        if (t.expectLiveBefore && hb !== t.expectLiveBefore) { console.log(`STOP|file ${t.target}|το ζωντανό ΔΕΝ είναι το αναμενόμενο (${t.expectLiveBefore.slice(0, 12)}…) — ΔΕΝ ανεβαίνει`); continue; }
        if (DRY_RUN) { console.log(`DRY|file ${t.target}|contentType=${ct}`); continue; }
        const up = await uploadFileMultipart(t.target, body, ct, t.public !== false);
        console.log(`UPLOADED|${t.target}|upload_id=${String(up.uploadID).slice(0, 24)}|${JSON.stringify(up.done).slice(0, 100)}`);
        const v = await verifyPublicFile(t.target, body, ct);
        console.log(`${v.okBytes && v.okType ? "OK" : "FAIL"}|file ${t.target}|bytes=${v.bytes}/${body.length} ${v.okBytes ? "✔" : "✗"}|content-type=${v.ct} ${v.okType ? "✔" : "✗ (αναμενόμενο " + ct + ")"}|δοκιμές=${v.attempt}`);
      }
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
