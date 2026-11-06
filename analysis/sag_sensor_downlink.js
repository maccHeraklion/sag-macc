/* SAG — sag_sensor_downlink (T-UPLINK-UNIFORM-01, 7/11/2026, Michalis)
 *
 * Στέλνει downlink ΡΥΘΜΟΥ ΑΠΟΣΤΟΛΗΣ σε ΑΙΣΘΗΤΗΡΕΣ αγρών με τον ίδιο μηχανισμό που χρησιμοποιούν οι βάνες
 * (Utils.sendDownlink → middleware του δικτύου, με ρητό FPort). Ο μηχανισμός των παραμέτρων συσκευής
 * (`downlink`/`port`) δοκιμάστηκε 6/11 22:21 UTC στον sensecap_s2120_0503: παραδόθηκε (sent=true) αλλά η συσκευή
 * ΔΕΝ άλλαξε ρυθμό σε 6 πακέτα — πιθανότατα το FPort δεν περνά. Γι' αυτό χρειάζεται analysis με ACCOUNT_TOKEN.
 *
 * ΠΟΤΕ σε βάνες (uc511/uc501), ελεγκτές φωτισμού, ξενοδοχείο, σταθμούς καιρού των Δήμων. Οι εντολές προέρχονται
 * από τα επίσημα εγχειρίδια (επαληθευμένες 7/11):
 *   • SenseCAP S2120: 00 89 00 <id_L> <id_H> <min_L> <min_H> <crc_L> <crc_H>, CRC-16/KERMIT, FPort 2, λεπτά.
 *     Παράδειγμα εγχειριδίου 10 λεπτά = 00890011220A0038B4 (ο υπολογισμός εδώ το αναπαράγει ακριβώς).
 *   • Dragino (LMS01/LSE01/SE01/SE02/LSE02/SPH01): 01 + 3 bytes δευτερόλεπτα (big-endian), οποιοδήποτε FPort (2).
 *   • Milesight EM320/EM300: ff02 <UINT16 LE s> (collect) + ff03 <UINT16 LE s> (report), FPort 85.
 *
 * ΠΕΡΙΒΑΛΛΟΝ: ACCOUNT_TOKEN (account token με δικαιώματα devices/network — το βάζει ο Μιχάλης στην κονσόλα).
 * RUNTIME: node-rt2025 (χωρίς SDK — ό,τι κάνει το Utils.sendDownlink του SDK γίνεται εδώ με fetch:
 *   device info → network middleware_endpoint → device token (serie_number + last_authorization) →
 *   POST https://<middleware>/downlink {device, authorization, payload, port, confirmed}).
 *
 * SCOPE (από run_analysis του MCP έρχεται object ή [object]; από φόρμα έρχεται [{variable,value}]):
 *   { "devices": ["sensecap_s2120_0503", ...],   // ονόματα συσκευών (ακριβή) ή 24-hex ids
 *     "minutes": 10,                             // ρυθμός-στόχος σε λεπτά (1..1440)
 *     "confirm": true }                          // χωρίς confirm:true → ΜΟΝΟ προσομοίωση (τυπώνει τι θα έστελνε)
 *   Προαιρετικά: { "payload": "HEX", "port": 2 } για ρητή εντολή (παρακάμπτει τον υπολογισμό — για δοκιμές).
 *
 * ΕΞΟΔΟΣ: console (prefix SDL|) — μία γραμμή ανά συσκευή με όνομα, τύπο, εντολή, FPort, αποτέλεσμα middleware.
 */
const API = "https://api.us-e1.tago.io";
const PFX = "SDL|";
const ALLOWED_TYPES = ["s2120", "lms01_ls", "lse01", "lse01_shallow", "lse01_deep", "lse02", "se0x", "se01", "se02", "em320_th", "em300_th", "sph01"];
const DENY_NAME = /uc5|ws558|volta|lwl02|am107|talkpool|mclimate|greenprojects|_0298$|_03C4$|_0495$|_04F8$/i;
// Σταθμοί καιρού Δήμων (απόφαση Michalis: δεν πειράζουμε τις ρυθμίσεις τους) + ξενοδοχείο.
const DENY_EXACT = new Set(["sensecap_s2120_047e", "sensecap_s2120_049e", "sensecap_s2120_0138", "sensecap_s2120_057C", "sensecap_s2120_04e8", "sensecap_s2120_00d8-1", "milesight_em300_th_7768"]);

function crc16Kermit(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ 0x8408) : (crc >>> 1);
  }
  return crc & 0xffff;
}
const hex = (arr) => arr.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

function buildCommand(type, minutes) {
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m < 1 || m > 1440) throw new Error("minutes εκτός ορίων 1..1440");
  const sec = m * 60;
  if (type === "s2120") {
    const body = [0x00, 0x89, 0x00, 0x11, 0x22, m & 0xff, (m >> 8) & 0xff];
    const c = crc16Kermit(body);
    return { payload: hex(body.concat([c & 0xff, (c >> 8) & 0xff])), port: 2, desc: m + " λεπτά (SenseCAP, CRC-16/KERMIT)" };
  }
  if (type === "em320_th" || type === "em300_th") {
    const lo = sec & 0xff, hi = (sec >> 8) & 0xff;
    return { payload: hex([0xff, 0x02, lo, hi, 0xff, 0x03, lo, hi]), port: 85, desc: sec + " s collect+report (Milesight)" };
  }
  // Dragino: TDC σε δευτερόλεπτα, 3 bytes big-endian.
  if (sec > 0xffffff) throw new Error("TDC πολύ μεγάλο");
  return { payload: hex([0x01, (sec >> 16) & 0xff, (sec >> 8) & 0xff, sec & 0xff]), port: 2, desc: sec + " s TDC (Dragino)" };
}

function parseScope(scope) {
  let o = scope;
  if (Array.isArray(o)) {
    if (o.length && o[0] && typeof o[0] === "object" && "variable" in o[0]) {
      const m = {};
      for (const it of o) m[String(it.variable)] = it.value;
      o = m;
    } else o = o[0] || {};
  }
  if (!o || typeof o !== "object") o = {};
  let devices = o.devices;
  if (typeof devices === "string") { try { devices = JSON.parse(devices); } catch (e) { devices = devices.split(/[,\s]+/).filter(Boolean); } }
  return {
    devices: Array.isArray(devices) ? devices.map(String) : [],
    minutes: o.minutes,
    confirm: o.confirm === true || String(o.confirm).toLowerCase() === "true",
    payload: o.payload ? String(o.payload).replace(/\s+/g, "").toUpperCase() : null,
    port: o.port != null ? Number(o.port) : null,
  };
}

async function api(token, path, opts) {
  const r = await fetch(API + path, Object.assign({ headers: Object.assign({ Authorization: token, "Content-Type": "application/json" }, (opts && opts.headers) || {}) }, opts || {}));
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error("API " + path.split("?")[0] + ": " + JSON.stringify(j.message || j).slice(0, 160));
  return j.result;
}

async function resolveDevice(token, ref) {
  if (/^[0-9a-f]{24}$/i.test(ref)) return api(token, "/device/" + ref);
  const list = await api(token, "/device?filter[name]=" + encodeURIComponent(ref) + "&amount=20&fields=id,name");
  const exact = (list || []).filter((d) => d.name === ref);
  if (exact.length !== 1) throw new Error("όνομα «" + ref + "»: " + exact.length + " ακριβείς αντιστοιχίες");
  return api(token, "/device/" + exact[0].id);
}

// Ό,τι κάνει το Utils.sendDownlink του @tago-io/sdk.
async function sendDownlink(token, dev, cmd) {
  if (!dev.network) throw new Error("η συσκευή δεν έχει δίκτυο");
  const net = await api(token, "/integration/network/" + dev.network + "?fields=id,name,middleware_endpoint");
  if (!net || !net.middleware_endpoint) throw new Error("το δίκτυο δεν έχει middleware_endpoint");
  const toks = await api(token, "/device/token/" + dev.id + "?page=1&amount=20&fields=name,serie_number,last_authorization");
  const t = (toks || []).find((x) => x.serie_number && x.last_authorization);
  if (!t) throw new Error("κανένα token συσκευής με serie_number + last_authorization (η συσκευή δεν έχει εξουσιοδότηση δικτύου)");
  const r = await fetch("https://" + net.middleware_endpoint + "/downlink", {
    method: "POST", headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ device: t.serie_number, authorization: t.last_authorization, payload: cmd.payload, port: cmd.port, confirmed: !!cmd.confirmed }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("middleware " + r.status + ": " + txt.slice(0, 160));
  return txt.slice(0, 160);
}

function readEnv() {
  try {
    const e = JSON.parse(process.env.T_ANALYSIS_ENV || "null");
    if (Array.isArray(e)) { const h = e.find((x) => x && x.key === "ACCOUNT_TOKEN"); return h ? h.value : null; }
    if (e && typeof e === "object") return e.ACCOUNT_TOKEN || null;
  } catch (err) { /* κενό */ }
  return null;
}

(async () => {
  const token = readEnv();
  if (!token) return console.log(PFX + "FATAL|λείπει ACCOUNT_TOKEN στο περιβάλλον του analysis");
  let scope = null; try { scope = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); } catch (e) { scope = null; }
  const s = parseScope(scope);
  console.log(PFX + "=== " + new Date().toISOString() + " | συσκευές=" + s.devices.length + " | λεπτά=" + s.minutes + " | confirm=" + s.confirm + (s.payload ? " | ρητή εντολή " + s.payload + "/" + s.port : ""));
  if (!s.devices.length) return console.log(PFX + "FATAL|κενό scope.devices");
  if (!s.payload && !(Number(s.minutes) > 0)) return console.log(PFX + "FATAL|χρειάζεται minutes ή payload");
  if (s.payload && !/^[0-9A-F]+$/.test(s.payload)) return console.log(PFX + "FATAL|payload όχι hex");

  let ok = 0, fail = 0, skipped = 0;
  for (const ref of s.devices) {
    try {
      const d = await resolveDevice(token, ref);
      const type = String(((d.tags || []).find((t) => t.key === "type") || {}).value || "");
      if (DENY_EXACT.has(d.name) || DENY_NAME.test(d.name) || ALLOWED_TYPES.indexOf(type) < 0) {
        skipped++; console.log(PFX + d.name + "|" + (type || "χωρίς τύπο") + "|ΠΑΡΑΛΕΙΨΗ (εκτός λίστας αισθητήρων αγρών)"); continue;
      }
      const cmd = s.payload ? { payload: s.payload, port: Number.isFinite(s.port) ? s.port : 2, desc: "ρητή" } : buildCommand(type, s.minutes);
      if (!s.confirm) { console.log(PFX + d.name + "|" + type + "|ΠΡΟΣΟΜΟΙΩΣΗ|" + cmd.payload + "|FPort " + cmd.port + "|" + cmd.desc); continue; }
      const res = await sendDownlink(token, d, { payload: cmd.payload, port: cmd.port, confirmed: false });
      ok++;
      console.log(PFX + d.name + "|" + type + "|ΣΤΑΛΘΗΚΕ|" + cmd.payload + "|FPort " + cmd.port + "|" + cmd.desc + "|" + res);
    } catch (e) {
      fail++; console.log(PFX + ref + "|ΣΦΑΛΜΑ|" + String(e && e.message ? e.message : e).slice(0, 200));
    }
  }
  console.log(PFX + "=== ΤΕΛΟΣ | στάλθηκαν " + ok + " | σφάλματα " + fail + " | παραλείψεις " + skipped + (s.confirm ? "" : " | ΠΡΟΣΟΜΟΙΩΣΗ — τίποτα δεν στάλθηκε"));
})().catch((e) => console.log(PFX + "FATAL|" + (e && e.message ? e.message : e)));
