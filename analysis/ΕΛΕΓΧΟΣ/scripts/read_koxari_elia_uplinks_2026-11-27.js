// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ΚΟΞΑΡΗ (057C) και ΕΛΙΑ (0138), 27/11/2026.
// Ερώτηση Μιχάλη: με Bluetooth ο σταθμός δείχνει πίεση/κατεύθυνση, στο LoRaWAN όχι — ποιος τα χάνει;
// (1) Ο ΖΩΝΤΑΝΟΣ κώδικας του connector 67adaf5b (κοινός σε όλους τους S2120) έναντι του αποθετηρίου:
//     χειρίζεται το πακέτο 0x4B (κατεύθυνση + ένταση βροχής + πίεση); τι κάνει με άγνωστο αναγνωριστικό;
// (2) Ποιες μεταβλητές φέρνει ΚΑΘΕ uplink (ομάδα) τις τελευταίες 2 ώρες: 057C, 0138 και δύο υγιείς σταθμοί.
// (3) parse_error / sensor_error_event / firmware_version / measure_interval.
// Πολιτικές 6ac171e0 (ανάγνωση s2120) και 6ad63aec (ανάγνωση connectors) ΕΝΕΡΓΕΣ μόνο όσο τρέχει.
// Κόστος Data Output: ≤ ~2.000 εγγραφές.
const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const REPO_RAW = "https://raw.githubusercontent.com/maccHeraklion/sag-macc/main/payload_parsers/sensecap_s210_parser.js";
const CONNECTOR = "67adaf5b36089a000a16aa5a";
const DEVS = { "67fe99b670defa000a954bbe": "ΚΟΞΑΡΗ 057C", "67fe9a063b56fa000ac75c4b": "ΕΛΙΑ 0138" };
const HEALTHY_NAMES = ["sensecap_s2120_0534", "sensecap_s2120_0503"];
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(p.slice(0, 60) + " → " + JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
(async () => {
  console.log("ΚΞ=== ΚΟΞΑΡΗ/ΕΛΙΑ uplinks · " + new Date().toISOString() + " ===");
  // (1) connector
  try {
    const c = await get(`/connector/${CONNECTOR}?fields=["payload_decoder","name","updated_at"]`);
    let code = String(c.payload_decoder || "");
    if (code && !/[;{}()]/.test(code.slice(0, 200))) code = Buffer.from(code, "base64").toString("utf8");
    const norm = (s) => s.replace(/\r\n/g, "\n").trim();
    const repo = await (await fetch(REPO_RAW)).text();
    console.log("ΚΞ1|connector " + (c.name || "") + " · ενημ. " + (c.updated_at || "?") + " · γραμμές " + norm(code).split("\n").length
      + " · sha " + sha(norm(code)) + " · αποθετήριο sha " + sha(norm(repo)) + (norm(code) === norm(repo) ? " · ΙΔΙΟΣ με το αποθετήριο" : " · ΔΙΑΦΕΡΕΙ"));
    if (norm(code) !== norm(repo)) {
      const A = norm(repo).split("\n"), B = norm(code).split("\n"), setA = new Set(A), setB = new Set(B);
      console.log("ΚΞ1|μόνο ζωντανό: " + B.filter((l) => !setA.has(l)).slice(0, 40).map((l) => l.trim()).join(" ⏎ "));
      console.log("ΚΞ1|μόνο αποθετήριο: " + A.filter((l) => !setB.has(l)).slice(0, 25).map((l) => l.trim()).join(" ⏎ "));
    }
    const ids = [...new Set((code.match(/case\s+'([0-9a-fA-F]{2})'/g) || []).map((x) => x.slice(-3, -1)))];
    console.log("ΚΞ1|αναγνωριστικά πακέτων που ξέρει: " + ids.join(","));
  } catch (e) { console.log("ΚΞ1|connector ΣΦΑΛΜΑ " + e.message); }

  // (2) uplinks ανά ομάδα
  const list = Object.entries(DEVS);
  try {
    for (const nm of HEALTHY_NAMES) {
      const d = await get(`/device?filter[name]=${nm}&fields=["id","name"]&amount=1`);
      if (d && d[0]) list.push([d[0].id, "ΥΓΙΗΣ " + nm.slice(-4)]);
    }
  } catch (e) { console.log("ΚΞ2|εύρεση υγιών ΣΦΑΛΜΑ " + e.message); }
  const since = new Date(Date.now() - 2 * 3600000).toISOString();
  for (const [id, nm] of list) {
    try {
      const rows = await get(`/device/${id}/data?start_date=${since}&qty=500&ordination=descending`);
      const by = new Map();
      for (const r of rows || []) {
        const k = r.group || r.serie || r.time;
        const e = by.get(k) || { t: r.time, v: new Set() };
        e.v.add(r.variable + (r.variable === "payload" || r.variable === "parse_error" ? "=" + String(r.value).slice(0, 60) : ""));
        if (r.time < e.t) e.t = r.time;
        by.set(k, e);
      }
      const ups = [...by.values()].sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 14);
      const allVars = new Set((rows || []).map((r) => r.variable));
      console.log("ΚΞ2|" + nm + " · εγγραφές 2ω " + (rows || []).length + " · ομάδες " + by.size + " · μεταβλητές: " + [...allVars].sort().join(","));
      for (const u of ups) console.log("ΚΞ2|" + nm + "|" + u.t.slice(11, 19) + "|" + [...u.v].sort().join(","));
    } catch (e) { console.log("ΚΞ2|" + nm + " ΣΦΑΛΜΑ " + e.message); }
  }
  // (3) σφάλματα / έκδοση
  for (const [id, nm] of Object.entries(DEVS)) {
    for (const v of ["parse_error", "sensor_error_event", "firmware_version", "hardware_version", "measure_interval", "barometric_pressure_hpa", "wind_direction_sensor"]) {
      try {
        const r = await get(`/device/${id}/data?variable=${v}&qty=3&ordination=descending`);
        console.log("ΚΞ3|" + nm + "|" + v + ": " + ((r || []).map((x) => x.time.slice(0, 16) + "=" + JSON.stringify(x.value).slice(0, 50)
          + (x.metadata && Object.keys(x.metadata).length ? " " + JSON.stringify(x.metadata).slice(0, 80) : "")).join(" | ") || "καμία"));
      } catch (e) { console.log("ΚΞ3|" + nm + "|" + v + " ΣΦΑΛΜΑ " + e.message); }
    }
  }
  console.log("ΚΞ=== τέλος ===");
})();
