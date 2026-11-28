// Ελεγκτής T-READMETER-02 (28/11/2026) — μετρητής αναγνώσεων σε stationHealth, kbdi, gatewayLiveness. ΜΟΝΟ καταγραφή:
// (α) η απάντηση επιστρέφεται αυτούσια (ίδιο αντικείμενο) · (β) σφάλμα ανάγνωσης δεν καταπίνεται · (γ) μετρώνται μόνο αναγνώσεις
// δεδομένων (όχι εγγραφές POST, όχι λίστες συσκευών) · (δ) συναθροίσεις χωριστά · (ε) η σύνοψη τυπώνεται στο τέλος κάθε εκτέλεσης.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (f) => fs.readFileSync(path.join(here, "..", f), "utf8").replace(/\r\n/g, "\n");
const SRC = { sh: rd("stationHealth.js"), kb: rd("kbdi.js"), gw: rd("gatewayLiveness.js") };
const START = "// ---------- T-READMETER-02";
const cut = (s, endMark) => { const a = s.indexOf(START), b = s.indexOf(endMark, a); if (a < 0 || b < 0) throw new Error("δεν βρέθηκε " + endMark.slice(0, 30)); return s.slice(a, b + endMark.length); };
const arr = () => [{ value: 1 }, { value: 2 }, { value: 3 }];

async function verify(S) {
  const f = []; const eq = (g, e, m) => { if (g !== e) f.push(m + ": " + g + " ≠ " + e); };
  // ---- stationHealth: restClient με ψεύτικο fetch
  try {
    const code = cut(S.sh, "\n  };\n}\n");
    const mk = (res) => async (url, o) => ({ status: 200, headers: { get: () => null }, json: async () => res(url, o) });
    let payload = arr();
    const fetchOk = mk(() => ({ status: true, result: payload }));
    const { restClient, _RM, _rmLine } = new Function("fetch", code + "\nreturn { restClient, _RM, _rmLine };")(fetchOk);
    const R = restClient("t");
    const got = await R.devices.getDeviceData("d", { variables: ["air_temperature"], qty: 3 });
    eq(got, payload, "SH ίδια απάντηση");
    eq(_RM.recs, 3, "SH εγγραφές"); eq(_RM.calls, 1, "SH κλήσεις");
    payload = [{ value: 9 }];
    await R.devices.getDeviceData("d", { variables: ["air_temperature"], query: "max" });
    eq(_RM.agg, 1, "SH συνάθροιση"); eq(_RM.recs, 3, "SH συνάθροιση όχι στις εγγραφές"); eq(_RM.aggRows, 1, "SH γραμμές συνάθροισης");
    await R.devices.sendDeviceData("d", [{ variable: "x", value: 1 }]);
    eq(_RM.calls, 2, "SH η εγγραφή δεν μετρά");
    if (!/^\[T-READMETER-02\] αναγνώσεις: 3 εγγραφές σε 1 κλήσεις · ερωτήματα συνάθροισης 1 \(1 γραμμές\)/.test(_rmLine())) f.push("SH γραμμή: " + _rmLine());
    const bad = new Function("fetch", code + "\nreturn { restClient };")(mk(() => ({ status: false, message: "x" }))).restClient("t");
    let threw = false; try { await bad.devices.getDeviceData("d", { variables: ["v"] }); } catch (e) { threw = true; }
    eq(threw, true, "SH σφάλμα δεν καταπίνεται");
  } catch (e) { f.push("SH: " + e.message); }
  // ---- kbdi: _rmWrap σε ψεύτικη συσκευή
  try {
    const code = cut(S.kb, "\n  return device;\n}\n");
    const { _rmWrap, _RM } = new Function(code + "\nreturn { _rmWrap, _RM };")();
    const out = arr();
    const dev = _rmWrap({ getData: async () => out });
    eq(await dev.getData({ variables: ["kbdi1"], qty: 20 }), out, "KB ίδια απάντηση");
    await dev.getData({ variables: ["air_temperature"], query: "aggregate", function: "max" });
    eq(_RM.recs, 3, "KB εγγραφές"); eq(_RM.agg, 1, "KB συνάθροιση"); eq(_RM.aggRows, 3, "KB γραμμές συνάθροισης");
    const dev2 = _rmWrap({ getData: async () => { throw new Error("απέτυχε"); } });
    let threw = false; try { await dev2.getData({ variables: ["v"] }); } catch (e) { threw = true; }
    eq(threw, true, "KB σφάλμα δεν καταπίνεται"); eq(_RM.calls, 2, "KB αποτυχημένη δεν μετρά");
  } catch (e) { f.push("KB: " + e.message); }
  // ---- gatewayLiveness: api() με ψεύτικο fetch
  try {
    const code = cut(S.gw, "\n  return j.result;\n}\n");
    let res = arr();
    const fetchF = async () => ({ json: async () => ({ status: true, result: res }) });
    const { api, _RM } = new Function("fetch", "API", "TOKEN", code + "\nreturn { api, _RM };")(fetchF, "https://x", "t");
    eq(await api("/device/abc/data?variables[]=lrrid&variables[]=lrrlat&qty=3"), res, "GW ίδια απάντηση");
    eq(_RM.recs, 3, "GW εγγραφές"); eq([..._RM.byKey.keys()][0], "lrrid+lrrlat", "GW κλειδί μεταβλητών");
    await api("/device/abc/data", { method: "POST", body: "[]" });
    await api("/device?amount=100&page=1");
    eq(_RM.calls, 1, "GW μόνο αναγνώσεις δεδομένων");
    res = [{ value: 5 }];
    await api("/device/abc/data?variables[]=x&query=max");
    eq(_RM.agg, 1, "GW συνάθροιση"); eq(_RM.recs, 3, "GW συνάθροιση όχι στις εγγραφές");
    const bad = new Function("fetch", "API", "TOKEN", code + "\nreturn { api };")(async () => ({ json: async () => ({ status: false }) }), "https://x", "t");
    let threw = false; try { await bad.api("/device/a/data?variables[]=v"); } catch (e) { threw = true; }
    eq(threw, true, "GW σφάλμα δεν καταπίνεται");
  } catch (e) { f.push("GW: " + e.message); }
  // ---- σύνοψη στο τέλος κάθε εκτέλεσης
  if (!/\.finally\(\(\) => \{ try \{ console\.log\(_rmLine\(\)\); \}/.test(S.sh)) f.push("SH χωρίς σύνοψη");
  if (!/context\.log\(_rmLine\(\)\)/.test(S.kb)) f.push("KB χωρίς σύνοψη");
  if (!/_rmWrap\(new Device\(/.test(S.kb)) f.push("KB η συσκευή δεν τυλίγεται");
  if (!/console\.log\(_rmLine\(\)\); \} catch \(_e\) \{ \/\* μόνο καταγραφή \*\/ \}\n  console\.log\("══ gatewayLiveness · ΤΕΛΟΣ ══"\)/.test(S.gw)) f.push("GW χωρίς σύνοψη");
  return f;
}

const base = await verify(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ βάσης:\n" + base.join("\n")); process.exit(1); }
console.log("βάση ✔ (3 αναλύσεις)");
const sub = (k, a, b) => (S) => ({ ...S, [k]: S[k].replace(a, b) });
const MUT = [
  ["SH επιστρέφει άλλο", sub("sh", "        return r;\n      },", "        return r && r.slice ? r.slice() : r;\n      },")],
  ["SH συνάθροιση ως εγγραφές", sub("sh", "!!q.query, r);   // T-READMETER-02", "false, r);   // T-READMETER-02")],
  ["SH χωρίς σύνοψη", sub("sh", ".finally(() => { try { console.log(_rmLine()); }", ".finally(() => { try { void 0; }")],
  ["KB καταπίνει σφάλμα", sub("kb", "    const r = await raw(q);", "    let r; try { r = await raw(q); } catch (_e) { r = []; }")],
  ["KB δεν τυλίγεται", sub("kb", "_rmWrap(new Device(", "(new Device(")],
  ["KB μετρά γραμμές συνάθροισης ως εγγραφές", sub("kb", "if (isAgg) { _RM.agg++; _RM.aggRows += n; } else _RM.recs += n;", "if (isAgg) { _RM.agg++; _RM.aggRows += n; } _RM.recs += n;")],
  ["GW μετρά και τα POST", sub("gw", '(!opts.method || opts.method === "GET") && ', "")],
  ["GW μετρά και λίστες συσκευών", sub("gw", "/\\/device\\/[^/]+\\/data(\\?|$)/.test(path)", "/\\/device/.test(path)")],
  ["GW χωρίς σύνοψη", sub("gw", '  try { console.log(_rmLine()); } catch (_e) { /* μόνο καταγραφή */ }\n  console.log("══ gatewayLiveness · ΤΕΛΟΣ ══");', '  console.log("══ gatewayLiveness · ΤΕΛΟΣ ══");')],
  ["κοινό: λάθος πλήθος", (S) => { const r = (s) => s.replace("const n = Array.isArray(r) ? r.length : (r == null ? 0 : 1);", "const n = 1;"); return { sh: r(S.sh), kb: r(S.kb), gw: r(S.gw) }; }],
];
let killed = 0;
for (const [n, m] of MUT) { const S2 = m(SRC); if (JSON.stringify(S2) === JSON.stringify(SRC)) { console.log("ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + n); process.exit(1); } if ((await verify(S2)).length) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n); }
console.log("μεταλλάξεις " + killed + "/" + MUT.length); process.exit(killed === MUT.length ? 0 : 1);
