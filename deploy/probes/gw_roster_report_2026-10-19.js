// SAG — ΑΝΑΦΟΡΑ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) 19/10/2026: ποια είναι τα gateways «χωρίς ταυτοποίηση» του χάρτη, και γιατί.
// Ίδια λογική σύνδεσης με το gateway-board (T-GWMAP-03): κάρτα δικτύου (LRR) ↔ συσκευή καταλόγου έως 200 m.
// + ΕΠ2: επανάληψη επαλήθευσης SE0X/SE01 (T-GWID-01). ΤΙΠΟΤΑ δεν γράφεται.
const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const OV = "6a98855ca06e41000bfae024";
async function api(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(p.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
function distM(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLa = (b.lat - a.lat) * toR, dLo = (b.lng - a.lng) * toR;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function roster() {
  const rr = await api(`/device/${OV}/data?variables[]=gateway_roster&qty=1`);
  const list = (((rr || [])[0] || {}).metadata || {}).list || [];
  const rows = await api(`/device/${OV}/data?variables[]=gateway_row&qty=80`);
  const net = new Map();
  for (const r of rows || []) { const p = net.get(r.value); if (!p || r.time > p.time) net.set(r.value, r); }
  const cards = [...net.values()].map((r) => ({ id: r.value, loc: r.metadata && r.metadata.location, state: r.metadata && r.metadata.state, n: r.metadata && r.metadata.sensors }));
  // σύνδεση: άπληστα, πλησιέστερα ζεύγη πρώτα
  const pairs = [];
  for (const c of cards) if (c.loc) for (const g of list) if (g.lat != null) {
    const d = distM({ lat: c.loc.lat, lng: c.loc.lng }, { lat: g.lat, lng: g.lng });
    if (d <= 200) pairs.push({ c, g, d });
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedC = new Set(), usedG = new Map();
  for (const p of pairs) { if (usedC.has(p.c.id) || usedG.has(p.g.id)) continue; usedC.add(p.c.id); usedG.set(p.g.id, p); }
  console.log(`ΣΤ|00|ΚΑΤΑΛΟΓΟΣ=${list.length}|ΚΑΡΤΕΣ ΔΙΚΤΥΟΥ=${cards.length}|ΕΝΩΘΗΚΑΝ=${usedG.size}|ΧΩΡΙΣ ΤΑΥΤΟΠΟΙΗΣΗ=${list.length - usedG.size}`);
  for (const c of cards) console.log(`ΣΤ|01|ΚΑΡΤΑ|${c.id}|${c.state}|αισθ=${c.n}|θέση=${c.loc ? c.loc.lat + "," + c.loc.lng : "—"}|ενώθηκε=${usedC.has(c.id) ? (list.find((g) => usedG.get(g.id) && usedG.get(g.id).c.id === c.id) || {}).name : "ΟΧΙ"}`);
  let k = 10;
  for (const g of list) {
    if (usedG.has(g.id)) { console.log(`ΣΤ|02|ΕΝΩΜΕΝΟ|${g.name}|${g.dev}|↔ ${usedG.get(g.id).c.id} (${Math.round(usedG.get(g.id).d)} m)`); continue; }
    let near = null;
    if (g.lat != null) for (const c of cards) if (c.loc) { const d = distM({ lat: c.loc.lat, lng: c.loc.lng }, { lat: g.lat, lng: g.lng }); if (!near || d < near.d) near = { id: c.id, d }; }
    const why = g.storage ? "ΑΠΟΘΗΚΗ (όχι deployedGateway=yes)" : g.lat == null ? "ΧΩΡΙΣ ΘΕΣΗ (ετικέτα coordinates)" : "ΕΓΚΑΤΕΣΤΗΜΕΝΟ, κανένας αισθητήρας με lrrid κοντά";
    console.log(`ΣΤ|${k++}|ΧΩΡΙΣ|${why}|${g.name}|${g.dev}|θέση=${g.lat != null ? g.lat + "," + g.lng : "—"}|πλησιέστερη κάρτα=${near ? near.id + " " + (near.d / 1000).toFixed(1) + " km" : "—"}`);
  }
}
const SINCE = Date.parse("2026-10-19T16:17:00Z");
const C = [
  { id: "685bafd351843b000ad23a36", want: "cc12d6cf4a7130b9227a74f6d633b65196df50b19ba7b2917bf2a97ba3b165b8", old: "bd5211ef56f04fe9" },
  { id: "69293aaf4da767000a1cc2f1", want: "996ae048dbe84e76b262875348145579b456f7abd1a407bc42f62b2d7db6ce21", old: "5eeaa071270a4e96" },
];
const VARS = ["lrrid", "soil_moisture1", "soil_moisture", "soil_temperature1", "temp_soil", "conduct_soil1", "conduct_soil", "battery", "parse_error"];
async function verify() {
  for (const c of C) {
    try {
      const k = await api(`/integration/connector/${c.id}?fields[]=name&fields[]=payload_decoder`);
      const code = Buffer.from(String(k.payload_decoder || ""), "base64").toString("utf8").replace(/\r\n/g, "\n");
      const h = crypto.createHash("sha256").update(code, "utf8").digest("hex");
      console.log(`ΕΠ2|CONNECTOR|${k.name}|sha=${h.slice(0, 16)}|${h === c.want ? "ΑΚΡΙΒΩΣ ο αναμενόμενος" : h.startsWith(c.old) ? "ΑΚΟΜΗ ο ΠΑΛΙΟΣ" : "ΔΙΑΦΟΡΕΤΙΚΟΣ"}`);
    } catch (e) { console.log("ΕΠ2|CONNECTOR ΣΦΑΛΜΑ|" + c.id + "|" + e.message); }
    let devs = [];
    try { devs = await api(`/device?amount=100&filter[connector]=${c.id}&fields[]=id&fields[]=name&fields[]=last_input`); } catch (e) { console.log("ΕΠ2|ΛΙΣΤΑ ΣΦΑΛΜΑ|" + e.message); }
    const fresh = (devs || []).filter((d) => d.last_input && Date.parse(d.last_input) >= SINCE);
    let ok = 0, noL = 0, err = 0, unread = 0; const bad = [];
    for (const d of fresh) {
      let rows;
      try { rows = await api(`/device/${d.id}/data?${VARS.map((v) => "variables[]=" + v).join("&")}&qty=30`); } catch (e) { unread++; continue; }
      const after = (rows || []).filter((r) => Date.parse(r.time) >= SINCE);
      const hasL = after.some((r) => r.variable === "lrrid");
      const hasM = after.some((r) => r.variable !== "lrrid" && r.variable !== "parse_error");
      const hasE = after.some((r) => r.variable === "parse_error");
      if (hasE) { err++; bad.push(d.name + " parse_error"); } else if (hasL && hasM) ok++; else { noL++; bad.push(d.name + ": " + after.map((r) => r.variable).join(",")); }
    }
    console.log(`ΕΠ2|ΑΠΟΤΕΛΕΣΜΑ|${c.id}|συσκευές=${(devs || []).length}|έστειλαν μετά=${fresh.length}|μετρήσεις+lrrid=${ok}|χωρίς lrrid=${noL}|parse_error=${err}|δεν διαβάστηκαν=${unread}`);
    for (const s of bad.slice(0, 8)) console.log("ΕΠ2|ΠΡΟΒΛΗΜΑ|" + s.slice(0, 300));
  }
}
(async () => {
  console.log("ΣΤ|== " + new Date().toISOString());
  try { await roster(); } catch (e) { console.log("ΣΤ|ΣΦΑΛΜΑ|" + e.message); }
  try { await verify(); } catch (e) { console.log("ΕΠ2|ΣΦΑΛΜΑ|" + e.message); }
  console.log("ΣΤ|== ΤΕΛΟΣ");
})();
