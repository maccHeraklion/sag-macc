// SAG — DEPLOY PROBE · ανέβασμα από το GitHub (sag-macc) στο TagoIO, ΜΕΣΑ από analysis.
//
// Γιατί υπάρχει: το MCP ανεβάζει scripts ΜΟΝΟ έως 1 MiB. Ο πυρήνας είναι ~1,32 MB.
// Αυτό το script (~9 KB) ανεβαίνει στην analysis-ανιχνευτή `6aa2d24f2f585a000b90b1a1`
// (node-rt2025), τραβά το αρχείο από το δημόσιο GitHub raw σε ΚΑΡΦΩΜΕΝΟ commit, ελέγχει
// sha256 ΚΑΙ δείκτες παρουσίας/απουσίας, ανεβάζει, και ξανακατεβάζει για επαλήθευση.
// Πολιτική `6aad48f03c26e2000bde4710` ΕΝΕΡΓΗ μόνο κατά το deploy.
//
// ΔΕΙΚΤΕΣ ΑΠΟΥΣΙΑΣ (από 19/9): δεν αρκεί να υπάρχει ό,τι πρόσθεσα — πρέπει να ΛΕΙΠΕΙ ό,τι
// αφαίρεσα. Χωρίς αυτό, μια μισοεφαρμοσμένη διόρθωση περνά ως επιτυχία.

const zlib = require("zlib");
const crypto = require("crypto");

const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc";

// ── ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΑΝΑ DEPLOY ────────────────────────────────────────────────
const COMMIT = "b3652fe3ff5ea7348c3776c8a2d0f9d7060a56ad";
const DRY_RUN = false;
const TASKS = [
  { kind: "analysis", id: "6898958ea9fc0d000a382484", path: "analysis/runPerTich.js",
    eol: "crlf", language: "node",
    sha256: "661b622589f59e536f9710f0ca5c1b9c909628f6d4f3aa5cd5a917bb68e8b74b",
    expectLiveBefore: "ad049a0502ad4aa25b96d1b86395072912d33e7cc064998764add06c682cf6e4",
    markers: [
      "const SAG_KERNEL_VERSION = 'v50.147",
      "T-ECSHIELD-TEXT-02 (v50.147",
      // η ΟΥΣΙΑ της διόρθωσης: ο φρουρός συνόρου μέσα στη φάση (α)
      "if (_sagShielded(_victims[_i].k)) _batch = 1;",
      "if (!_sagShielded(_victims[_i].k)) { let _q = _i;",
      "if (_batch > 1) _batch = Math.min(128, _batch * 2);",
      // οι προηγούμενες εκδόσεις ΔΕΝ πρέπει να έχουν χαθεί (σωρευτικό ανέβασμα)
      "T-METHODCARD-01 (v50.146",
      "T-TEXTDIET-01 (v50.145",
      "T-ECSHIELD-TEXT-01 (v50.144",
      "T-FLEET-HEALTH-01 (v50.143",
    ],
    absent: [
      // η ΠΑΛΙΑ γραμμή της φάσης (α), αυτή που κατάπινε την ασπίδα σε παρτίδα
      "const _end = Math.min(_victims.length, _i + _batch);",
      // εγγύηση v50.146: αυτά ΔΕΝ μπήκαν ποτέ στη λίστα μεθόδου (κουβαλούν δράση)
      "    'irrigation_dose_basis',",
      "    'irrigation_area_basis',",
    ] },
];
// ────────────────────────────────────────────────────────────────────────────

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
// Οι δείκτες κρίνονται πάνω στο κείμενο ΧΩΡΙΣ τερματικά γραμμής, ώστε CRLF/LF να μη μετρά.
const flat = (b) => b.toString("utf8").replace(/\r\n/g, "\n");
function checkMarkers(body, markers, absent) {
  const s = flat(body);
  const present = (markers || []).map((m) => (s.includes(m) ? "✔" : "✗ΛΕΙΠΕΙ:") + m.slice(0, 30));
  const gone = (absent || []).map((m) => (s.includes(m) ? "✗ΥΠΑΡΧΕΙ ΑΚΟΜΗ:" : "✔απών:") + m.slice(0, 30));
  const okP = (markers || []).every((m) => s.includes(m));
  const okA = (absent || []).every((m) => !s.includes(m));
  return { present, gone, ok: okP && okA };
}

(async () => {
  console.log(`=== DEPLOY πυρήνας v50.147 · commit ${COMMIT.slice(0, 10)} · ${DRY_RUN ? "DRY RUN" : "ΑΝΕΒΑΣΜΑ"} · ${new Date().toISOString()} ===`);
  for (const t of TASKS) {
    try {
      const raw = await fetchGithub(t.path);
      const body = normalize(raw, t.eol);
      const h = sha(body);
      console.log(`GH|${t.path}|bytes=${body.length}|sha256=${h}`);
      if (t.sha256 && h !== t.sha256) {
        console.log(`STOP|${t.path}|sha256 ΔΙΑΦΕΡΕΙ από το αναμενόμενο ${t.sha256.slice(0, 12)}… — ΔΕΝ ανεβαίνει`);
        continue;
      }
      const mk = checkMarkers(body, t.markers, t.absent);
      console.log(`ΔΕΙΚΤΕΣ|${mk.present.join(",")}`);
      console.log(`ΑΠΟΝΤΑ|${mk.gone.join(",")}`);
      if (!mk.ok) { console.log(`STOP|${t.path}|οι δείκτες ΔΕΝ επαληθεύονται — ΔΕΝ ανεβαίνει`); continue; }

      const liveBefore = await downloadAnalysis(t.id);
      const hb = sha(liveBefore);
      console.log(`LIVE_BEFORE|bytes=${liveBefore.length}|sha256=${hb}`);
      if (t.expectLiveBefore && hb !== t.expectLiveBefore) {
        console.log(`STOP|analysis ${t.id}|ο ζωντανός ΔΕΝ είναι ο αναμενόμενος (${t.expectLiveBefore.slice(0, 12)}…) — άλλαξε κάποιος; ΔΕΝ ανεβαίνει`);
        continue;
      }
      if (DRY_RUN) { console.log(`DRY|analysis ${t.id}`); continue; }
      await api(`/analysis/${t.id}/upload`, { method: "POST",
        body: JSON.stringify({ file: body.toString("base64"), file_name: "script.js", language: t.language || "node" }) });
      const liveAfter = await downloadAnalysis(t.id);
      const ha = sha(liveAfter);
      console.log(`${ha === h ? "OK" : "FAIL"}|analysis ${t.id}|μετά=${ha}|bytes=${liveAfter.length}`);
      // Οι δείκτες ΞΑΝΑ, πάνω στα ΖΩΝΤΑΝΑ bytes — όχι σε αυτά που νομίζω ότι έστειλα.
      const mk2 = checkMarkers(liveAfter, t.markers, t.absent);
      console.log(`ΜΕΤΑ ΔΕΙΚΤΕΣ|${mk2.present.join(",")}`);
      console.log(`ΜΕΤΑ ΑΠΟΝΤΑ|${mk2.gone.join(",")}`);
    } catch (e) { console.log(`ERR|${t.path}|${e.message}`); }
  }
  console.log("=== ΤΕΛΟΣ ===");
})();
