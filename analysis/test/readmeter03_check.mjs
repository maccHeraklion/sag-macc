// Ελεγκτής T-READMETER-03 (28/11/2026) — μετρητής αναγνώσεων σε warehouseSnapshot και subscriptionManage. ΜΟΝΟ καταγραφή:
// ίδια απάντηση · σφάλμα δεν καταπίνεται · μετρώνται μόνο GET …/data (όχι POST/PUT, όχι λίστες) · σύνοψη σε κάθε τέλος εκτέλεσης.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (f) => fs.readFileSync(path.join(here, "..", f), "utf8").replace(/\r\n/g, "\n");
const SRC = { wh: rd("warehouseSnapshot.js"), sm: rd("subscriptionManage.js") };
const START = "// ---------- T-READMETER-03", END = "\n  return j.result;\n}\n";
const cut = (s) => { const a = s.indexOf(START), b = s.indexOf(END, a); if (a < 0 || b < 0) throw new Error("δεν βρέθηκε ο μετρητής"); return s.slice(a, b + END.length); };

async function verifyOne(k, s) {
  const f = []; const eq = (g, e, m) => { if (g !== e) f.push(k + " " + m + ": " + g + " ≠ " + e); };
  try {
    const code = cut(s); let res = [{ v: 1 }, { v: 2 }];
    const mk = (ok) => async () => ({ json: async () => (ok ? { status: true, result: res } : { status: false }) });
    const { api, _RM, _rmLine } = new Function("fetch", "API", "TOKEN", code + "\nreturn { api, _RM, _rmLine };")(mk(true), "https://x", "t");
    eq(await api("/device/abc/data?variables[]=warehouse_summary&qty=1"), res, "ίδια απάντηση");
    eq(_RM.recs, 2, "εγγραφές"); eq([..._RM.byKey.keys()][0], "warehouse_summary", "κλειδί");
    await api("/device/abc/data", { method: "POST", body: "[]" });
    await api("/dashboard/x", { method: "PUT", body: "{}" });
    await api("/device?page=1&amount=200"); await api("/run/users?page=1");
    eq(_RM.calls, 1, "μόνο αναγνώσεις δεδομένων");
    res = [{ v: 9 }]; await api("/device/abc/data?variables[]=x&query=max");
    eq(_RM.agg, 1, "συνάθροιση"); eq(_RM.recs, 2, "συνάθροιση όχι στις εγγραφές");
    if (!/^\[T-READMETER-03\] αναγνώσεις: 2 εγγραφές σε 1 κλήσεις · ερωτήματα συνάθροισης 1 \(1 γραμμές\)/.test(_rmLine())) f.push(k + " γραμμή: " + _rmLine());
    const bad = new Function("fetch", "API", "TOKEN", code + "\nreturn { api };")(mk(false), "https://x", "t");
    let threw = false; try { await bad.api("/device/a/data?variables[]=v"); } catch (e) { threw = true; }
    eq(threw, true, "σφάλμα δεν καταπίνεται");
  } catch (e) { f.push(k + ": " + e.message); }
  if (!/\}\)\.finally\(\(\) => \{ try \{ console\.log\(_rmLine\(\)\); \} catch \(_e\) \{ \/\* μόνο καταγραφή \*\/ \} \}\);/.test(s)) f.push(k + " χωρίς σύνοψη στο τέλος");
  return f;
}
const verify = async (S) => [...(await verifyOne("WH", S.wh)), ...(await verifyOne("SM", S.sm))];

const base = await verify(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ βάσης:\n" + base.join("\n")); process.exit(1); }
console.log("βάση ✔ (2 αναλύσεις)");
const sub = (k, a, b) => (S) => ({ ...S, [k]: S[k].replace(a, b) });
const both = (a, b) => (S) => ({ wh: S.wh.replace(a, b), sm: S.sm.replace(a, b) });
const MUT = [
  ["WH μετρά και POST", sub("wh", '(!opts.method || opts.method === "GET") && ', "")],
  ["SM μετρά και POST", sub("sm", '(!opts.method || opts.method === "GET") && ', "")],
  ["WH μετρά λίστες", sub("wh", "/\\/device\\/[^/]+\\/data(\\?|$)/.test(path)", "/\\/device/.test(path)")],
  ["SM μετρά λίστες", sub("sm", "/\\/device\\/[^/]+\\/data(\\?|$)/.test(path)", "/./.test(path)")],
  ["WH χωρίς σύνοψη", sub("wh", "}).finally(() => { try { console.log(_rmLine()); }", "}).finally(() => { try { void 0; }")],
  ["SM χωρίς σύνοψη", sub("sm", "}).finally(() => { try { console.log(_rmLine()); }", "}).finally(() => { try { void 0; }")],
  ["συνάθροιση ως εγγραφές", both("if (isAgg) { _RM.agg++; _RM.aggRows += n; } else _RM.recs += n;", "_RM.recs += n;")],
  ["λάθος πλήθος", both("const n = Array.isArray(r) ? r.length : (r == null ? 0 : 1);", "const n = 1;")],
  ["SM άλλη απάντηση", sub("sm", "_rmCount(vs + (/[?&]query=/.test(path) ? \"·query\" : \"\"), /[?&]query=/.test(path), j.result);\n  }\n  return j.result;", "_rmCount(vs + (/[?&]query=/.test(path) ? \"·query\" : \"\"), /[?&]query=/.test(path), j.result);\n  }\n  return j.result && j.result.slice ? j.result.slice() : j.result;")],
];
let killed = 0;
for (const [n, m] of MUT) { const S2 = m(SRC); if (JSON.stringify(S2) === JSON.stringify(SRC)) { console.log("ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + n); process.exit(1); } if ((await verify(S2)).length) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n); }
console.log("μεταλλάξεις " + killed + "/" + MUT.length); process.exit(killed === MUT.length ? 0 : 1);
