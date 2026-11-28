// SAG — ΑΠΟΓΡΑΦΗ ΑΝΑΛΥΣΕΩΝ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 28/11/2026 · εντολή Μιχάλη «ξεκίνα με τη λίστα των αναλύσεων εκτός git».
// Για ΚΑΘΕ ανάλυση του λογαριασμού: κατεβάζει τον ζωντανό κώδικα και τυπώνει ΜΟΝΟ περίληψη — sha (LF), μέγεθος, αν ταυτίζεται
// με το αρχείο του git (για όσες έχουν), πλήθος σημείων ανάγνωσης/εγγραφής, downlink/διαγραφές/δημιουργίες, ονόματα μεταβλητών
// περιβάλλοντος (ΟΧΙ τιμές) και την πρώτη γραμμή σχολίου (χωρίς email). ΔΕΝ τυπώνει κώδικα, ΔΕΝ γράφει τίποτα, ΔΕΝ τρέχει αναλύσεις.
// Πολιτική προσωρινή (analysis: access + download_script) ΕΝΕΡΓΗ μόνο κατά την εκτέλεση. Κόστος: 0 αναγνώσεις δεδομένων.
const zlib = require("zlib"); const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "INV|";
const RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc/710ed6f41c7224754711574b5f55e18859260ed1/";
const GIT = {
  "6898958ea9fc0d000a382484": "analysis/runPerTich.js", "6aee5cd199c27e000b74c686": "analysis/sag_sensor_downlink.js",
  "68deb0d47a8161000a558867": "analysis/uc511_downlink.js", "68fba332f1f181000a1b4dce": "analysis/uc511_status_check.js",
  "68fe925b3607df0010ef833c": "analysis/setFieldParametersFromDeviceData.js", "6982277e9b69cb000946d225": "analysis/forecast.js",
  "69468d1f8b9939001044697f": "analysis/KEKFlood.js", "6aa2d24f2f585a000b90b1a1": "(probe)", "6af22c0c934136000d5cbedb": "analysis/erpRegistry.js",
  "6aaec78ecaa1f0000cb2064c": "analysis/gatewayLiveness.js", "6aed920d0120f0000ca8e886": "analysis/subscriptionManage.js",
  "6ae086fb889f4a000c4e15ff": "analysis/warehouseSnapshot.js", "68f1f881383cb400096c9b45": "analysis/createField.js",
  "6a4f5a00c1b8d1000dbd2025": "analysis/addSensorsToField.js", "6a4f635fc1b8d1000dbf1d38": "analysis/removeSensorFromField.js",
  "68380ee0c4cfb6000a7728d7": "analysis/createClient.js", "6a4e09150b39b5000b1e9b0b": "analysis/createUserForClient.js",
  "683ef4c4872ac3000a8d7c10": "analysis/addDevice.js", "6877561c8c9608000a4e62f9": "analysis/addGateway.js",
  "681e2290d3c9ea000a86f998": "analysis/subscriptionControl.js", "6a6b1483e4b1e5000bd58cce": "analysis/migrateControllerRuleVars.js",
  "6a4b706b0b39b5000b93024b": "analysis/migrateFieldBundle2.js", "6a6125a51471ac000c617ed7": "analysis/migrateFieldCalendar.js",
  "6a63111db06dab000c41275e": "analysis/migrateHistoryVars.js", "6a884b5ce36742000c656d04": "analysis/fieldExportData.js",
  "690e32179330e4000a5d16e5": "analysis/calculate_old_rainHeightSums.js", "69f3a43b9a0b2400098258fb": "analysis/copy_fertility_index.js",
  "6a4b8eb893aca2000c9dd812": "analysis/patchCreateFieldForm.js", "681bb24d8ee17b000a2ab2cd": "analysis/kbdi.js",
  "6b0a07adb7ab66000c5c2404": "analysis/stationHealth.js", "6b0a94b25f1d14000ccac2b5": "analysis/readGuard.js",
  "6afc2101be967e000c280f41": "analysis/publicStationSnapshot.js",
};
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);
const lf = (s) => String(s).replace(/^﻿/, "").replace(/\r\n/g, "\n");
async function api(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(String(JSON.stringify(j.message || j)).slice(0, 120)); return j.result; }
async function download(id) { const m = await api(`/analysis/${id}/download`); const b = Buffer.from(await (await fetch(m.url)).arrayBuffer()); return ((b[0] === 0x1f && b[1] === 0x8b) ? zlib.gunzipSync(b) : b).toString("utf8"); }
const cnt = (s, re) => (s.match(re) || []).length;
function summary(src) {
  const s = lf(src);
  const reads = cnt(s, /\.getData\(|getDeviceData\(|\/data\?|\.find\(\s*\{\s*variables|\bquery\s*:\s*["'](?:last|aggregate|sum|avg|max|min|count)/g);
  const writes = cnt(s, /\.sendData\(|sendDeviceData\(|method\s*:\s*["']POST["'][^\n]*\/data|\/data["'`][^\n]*POST/g);
  const flags = [];
  if (/sendDownlink|\/downlink|downlink\s*\(/i.test(s)) flags.push("downlink");
  if (/\.delete\(|method\s*:\s*["']DELETE|deleteDeviceData|\.deleteData\(/.test(s)) flags.push("ΔΙΑΓΡΑΦΕΣ");
  if (/devices\.create\(|dashboards\.create\(|POST["'`][^\n]*\/device["'`]|\/dashboard["'`][^\n]*POST|run\.userCreate|\/run\/users/.test(s)) flags.push("δημιουργίες");
  if (/accuweather|open-meteo|api\.openweathermap|thingpark|actility/i.test(s)) flags.push("εξωτερικό API");
  if (/hotel_volta|Volta|Diamoni/i.test(s)) flags.push("ξενοδοχείο");
  const env = [...new Set([...s.matchAll(/key\s*===?\s*["']([A-Z0-9_]{3,40})["']/g), ...s.matchAll(/getOptionalEnv\([^,]+,\s*["']([A-Z0-9_]{3,40})["']/g)].map((m) => m[1]))].slice(0, 8);
  let head = ""; for (const line of s.split("\n").slice(0, 25)) { const t = line.replace(/^\s*(\/\/+|\/?\*+|#)\s?/, "").trim(); if (t.length > 12 && /[A-Za-zΑ-Ωα-ω]{4}/.test(t) && !/^(const|let|var|import|require|use strict|function)\b/.test(t)) { head = t; break; } }
  head = head.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{20,}/gi, "<id>").slice(0, 110);
  return { bytes: Buffer.byteLength(s), sha: sha(s), lines: s.split("\n").length, reads, writes, flags, env, head, s };
}
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const list = []; for (let page = 1; page <= 5; page++) { const r = await api(`/analysis?amount=100&page=${page}&fields[]=id&fields[]=name&fields[]=active&fields[]=last_run&fields[]=runtime`); list.push(...r); if (r.length < 100) break; }
  const tally = { git_ίδιο: 0, git_διαφέρει: 0, εκτός_git: 0, σφάλμα: 0 };
  for (const a of list) {
    try {
      const x = summary(await download(a.id));
      let g = "ΕΚΤΟΣ GIT";
      if (GIT[a.id] === "(probe)") g = "probe";
      else if (GIT[a.id]) { const raw = await (await fetch(RAW + encodeURI(GIT[a.id]))).text(); const gs = sha(lf(raw)); g = gs === x.sha ? "git=ζωντανό" : "git≠ζωντανό(" + gs + ")"; }
      tally[g === "ΕΚΤΟΣ GIT" ? "εκτός_git" : g === "git=ζωντανό" ? "git_ίδιο" : g === "probe" ? "git_ίδιο" : "git_διαφέρει"]++;
      console.log(P + [a.id, a.active ? "ενεργή" : "ανενεργή", a.runtime, String(a.last_run || "ποτέ").slice(0, 10), a.name.slice(0, 60), g, x.bytes + "B/" + x.lines + "γρ", "sha " + x.sha,
        "αναγν " + x.reads, "εγγρ " + x.writes, x.flags.join("+") || "-", "env " + (x.env.join(",") || "-"), "«" + x.head + "»"].join("|"));
    } catch (e) { tally["σφάλμα"]++; console.log(P + a.id + "|" + a.name + "|ΣΦΑΛΜΑ " + e.message); }
  }
  console.log(P + "ΣΥΝΟΛΟ|" + list.length + " αναλύσεις|" + JSON.stringify(tally));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
