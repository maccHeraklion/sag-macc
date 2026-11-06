// Ελεγκτής W-COVERAGE-01 (4/11/2026): η γραμμή «Καλύπτονται N» στους Συναγερμούς Παθογόνων.
// Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ βοηθό του widget με τις τιμές που μετρήθηκαν στον στόλο στις 4/11
// (audit_downy_fleet_2026-11-04) και διασταυρώνει τον χάρτη ξενιστών/ειδών με τον πραγματικό πυρήνα.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const corePath = path.join(here, "..", "runPerTich.js");
const req = createRequire(corePath);
const PP = (() => {
  const src = fs.readFileSync(corePath, "utf8").replace(/\r\n/g, "\n");
  const shim = (m) => (m === "@tago-io/sdk" ? req("./test/sdk-mock.js") : req(m));
  const mod = { exports: {} };
  return new Function("require", "module", "exports", "process", "console", "__dirname", "__filename", src + "\nreturn PATHOGEN_PROFILE;")(
    shim, mod, mod.exports, { env: { RPERTICH_TEST_MODE: "true" }, exit() {}, on() {} }, { log() {}, warn() {}, error() {} }, path.dirname(corePath), corePath);
})();
function cut(src, a, b, label) {
  const i = src.indexOf(a); if (i < 0) throw new Error(label + ": δεν βρέθηκε η αρχή");
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error(label + ": δεν βρέθηκε το τέλος");
  return src.slice(i, j + b.length);
}
const msgs = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) r["fir_message_" + k] = { value: v }; return r; };
const LOW = "Χαμηλός κίνδυνος", NA = "Μη διαθέσιμο";
const CUKE = ["podosphaera_xanthii", "pseudoperonospora_cubensis", "botrytis_cinerea", "verticillium_dahliae", "phytophthora_capsici", "sclerotinia_sclerotiorum", "meloidogyne_incognita", "myzus_persicae", "bemisia_tabaci", "tetranychus_urticae"];
const TOM = ["phytophthora_infestans", "botrytis_cinerea", "alternaria_solani", "leveillula_taurica", "verticillium_dahliae", "phytophthora_capsici", "sclerotinia_sclerotiorum", "meloidogyne_incognita", "tuta_absoluta", "myzus_persicae", "bemisia_tabaci", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae"];
const all = (l, v) => Object.fromEntries(l.map((k) => [k, v]));
function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const bt = cut(w, 'bt=[{key:"plasmopara_viticola"', "}]", "κατάλογος");
    const hm = cut(w, 'sagHostMap={"plasmopara_viticola"', "]}", "ξενιστές");
    const km = cut(w, 'sagKindMap={"bactrocera_oleae"', "}", "είδη");
    const helpers = cut(w, "/* W-COVERAGE-01 */sagHostX9=", 'return t},', "βοηθοί").replace(/,$/, "");
    const H = new Function("const " + bt + "," + hm + "," + km + ";let " + helpers + ";\nreturn {bt,sagHostMap,sagHostX9,sagKindMap,sagCov9,sagCovTxt9};")();
    const CU = "vegetableCrops:cucumber", TO = "vegetableCrops:tomato", ZU = "vegetableCrops:zucchini";
    const T = (re, hk) => H.sagCovTxt9(H.sagCov9(re, hk));

    ok(T(msgs(all(CUKE, LOW)), CU) === "Καλύπτονται 10: 7 ασθένειες · 3 έντομα και ακάρεα", "Α1 Κουτσάκης αγγούρι (" + T(msgs(all(CUKE, LOW)), CU) + ")");
    ok(T(msgs(all(TOM, LOW)), TO) === "Καλύπτονται 14: 8 ασθένειες · 6 έντομα και ακάρεα", "Α2 Γρινιαράκης ντομάτα (" + T(msgs(all(TOM, LOW)), TO) + ")");
    const c3 = H.sagCov9(msgs(all(TOM, NA)), TO);
    ok(c3 && c3.d === 0 && c3.p === 0 && c3.u === 14, "Α3 όλα «Μη διαθέσιμο» δεν μετρούν ως κάλυψη");
    ok(/^Δεν καλύπτεται τώρα/.test(H.sagCovTxt9(c3)) && /14 χωρίς μετρήσεις τώρα/.test(H.sagCovTxt9(c3)), "Α4 κείμενο χωρίς κάλυψη (" + H.sagCovTxt9(c3) + ")");
    const z = all(["podosphaera_xanthii", "pseudoperonospora_cubensis", "botrytis_cinerea", "myzus_persicae", "bemisia_tabaci", "tetranychus_urticae"], LOW);
    ok(T(msgs(z), ZU) === "Καλύπτονται 6: 3 ασθένειες · 3 έντομα και ακάρεα · 3 χωρίς υπολογισμό τώρα", "Α5 ΚΕΚ κολοκύθι χωρίς έδαφος (" + T(msgs(z), ZU) + ")");
    ok(H.sagCov9({ fir_message_plasmopara_viticola: { value: LOW } }, CU).d === 0, "Α6 παθογόνο άλλης καλλιέργειας δεν μετρά");
    ok(H.sagCovTxt9(H.sagCov9({}, "")) === "" && H.sagCov9({}, "") === null, "Α7 χωρίς δεδομένα και χωρίς καλλιέργεια: καμία γραμμή");
    ok(H.sagCov9({ fir_message_myzus_persicae: { value: "" } }, CU).p === 0, "Α8 κενή τιμή δεν μετρά");
    ok(H.sagCov9(msgs(all(CUKE, "Νηματώδεις: καμία ένδειξη")), CU).d === 7, "Α9 κείμενο νηματωδών μετρά");

    // διασταύρωση με τον πραγματικό πυρήνα
    const keys = []; for (const c of Object.values(PP)) for (const [k, p] of Object.entries(c)) keys.push([k, p]);
    ok(keys.length === H.bt.length, "Β1 ίδιος αριθμός παθογόνων πυρήνα/widget (" + keys.length + "/" + H.bt.length + ")");
    const miss = keys.filter(([k, p]) => p.type === "GDD_Pest" && !["i", "m"].includes(H.sagKindMap[k])).map((x) => x[0]);
    ok(miss.length === 0, "Β2 όλοι οι εχθροί του πυρήνα μετρούν ως έντομα/ακάρεα (λείπουν: " + miss.join(",") + ")");
    const wrong = keys.filter(([k, p]) => p.type !== "GDD_Pest" && ["i", "m"].includes(H.sagKindMap[k])).map((x) => x[0]);
    ok(wrong.length === 0, "Β3 καμία ασθένεια ως έντομο (" + wrong.join(",") + ")");
    const hostBad = [];
    for (const [k, p] of keys) {
      const a = (p.crops || []).map((e) => e.cultivation_type_general + ":" + e.cultivation_type).sort().join("|");
      const b = (H.sagHostMap[k] || H.sagHostX9[k] || []).slice().sort().join("|");
      if (a !== b) hostBad.push(k);
    }
    ok(hostBad.length <= 1, "Β4 χάρτης ξενιστών = πυρήνας (διαφέρουν: " + hostBad.join(",") + ")");

    // καλωδίωση
    ok(w.includes('e.jsx("div",{id:"pathoCoverage"') && w.includes("const _c9=sagCov9(re,_hk9);if(!_c9)return null;") && w.includes("children:sagCovTxt9(_c9)"), "Γ1 γραμμή στην κάρτα παθογόνων");
    ok(w.indexOf("id:\"pathoCoverage\"") > w.indexOf("Υπόμνημα: 🐛") && w.indexOf("id:\"pathoCoverage\"") < w.indexOf('id:"pathoList"'), "Γ2 θέση κάτω από το υπόμνημα");
    ok(w.includes('if(k==="infection_model_status"){const _c9=sagCov9(RM,_hk9);') && !w.includes("μύκητ/.exec(v)"), "Γ3 η κάρτα υγείας δεν διαβάζει τον διπλό αριθμό του πυρήνα");
    ok(w.includes('color:_c9.d+_c9.p===0||_c9.u?"#b45309":"#15803d"'), "Γ4 πορτοκαλί όταν κάτι λείπει");
    ok(w.includes("if(_hk9&&sagHostMap[f.key]&&sagHostMap[f.key].indexOf(_hk9)<0)continue;"), "Γ5 οι συναγερμοί δεν άλλαξαν");
  } catch (e) { f.push("ΕΞΑΙΡΕΣΗ " + e.message); }
  return f;
}
const base = run(WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ\n" + base.join("\n")); process.exit(1); }
console.log("ΒΑΣΗ ΠΕΡΑΣΕ");
const M = [
  ["M1 μετρά και τα Μη διαθέσιμο", 'if(/^Μη διαθέσιμ/.test(String(m.value))){u++;continue}', 'if(/^Μη διαθέσιμ/.test(String(m.value))){u++}'],
  ["M2 ακάρεα ως ασθένειες", 'q==="i"||q==="m"?p++:d++', 'q==="i"?p++:d++'],
  ["M3 αγνοεί την καλλιέργεια", "if(hk&&hm&&!ih)continue;const m=R", "const m=R"],
  ["M3β χωρίς χάρτη εδάφους", "hm=sagHostMap[k]||sagHostX9[k]", "hm=sagHostMap[k]"],
  ["M4 δεν μετρά τα χωρίς υπολογισμό", "{if(ih)w++;continue}", "{continue}"],
  ["M5 ενικός/πληθυντικός", 'c.d+(c.d===1?" ασθένεια":" ασθένειες")', 'c.d+" ασθένεια"'],
  ["M6 κείμενο «χωρίς κάλυψη»", '"Δεν καλύπτεται τώρα καμία ασθένεια ή εχθρός"', '""'],
  ["M7 γραμμή με λάθος μεταβλητή", "const _c9=sagCov9(re,_hk9);if(!_c9)return null;", "const _c9=sagCov9({},_hk9);return null;"],
  ["M8 επαναφορά διπλού αριθμού", 'if(k==="infection_model_status"){const _c9=sagCov9(RM,_hk9);', 'if(k==="infection_model_status"){m=/(\\d+)\\s*μύκητ/.exec(v);const _c9=sagCov9(RM,_hk9);'],
  ["M9 χρώμα", '_c9.d+_c9.p===0||_c9.u?"#b45309":"#15803d"', '"#15803d"'],
  ["M10 χωρίς διαχωριστικό", 'a.join(" · ")', 'a.join(" ")'],
];
let bad = 0;
for (const [n, a, b] of M) {
  if (WID.split(a).length !== 2) { console.log("ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ " + n); bad++; continue; }
  const r = run(WID.replace(a, b));
  console.log((r.length ? "ΣΚΟΤΩΘΗΚΕ " : "ΕΠΕΖΗΣΕ ") + n + (r.length ? "" : ""));
  if (!r.length) bad++;
}
console.log(bad ? "ΑΠΟΤΥΧΙΑ μεταλλάξεων: " + bad : "ΟΛΑ ΟΚ · " + M.length + " μεταλλάξεις");
process.exit(bad ? 1 : 0);
