// Ελεγκτής T-RAIN-UNIFIED-W-01 (widget): η βροχή στο μέσο της περιόδου, μία εγγραφή ανά περίοδο (v34 > v33),
// «≥ / ≈ / από / —» στις τιμές, ετικέτα ανά αποστολή, χωρίς «Σύνολο» στα τρέχοντα. Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα
// του bundle (βοηθητικά + βρόχος διπλοτύπων). Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const W = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");

function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  const a = w.indexOf("const sagRainClosedRe="), b = w.indexOf("function kt(t,s){", a);
  if (a < 0 || b < 0) return ["W0 δεν βρέθηκαν τα βοηθητικά"];
  let H; try { H = new Function(w.slice(a, b) + "\nreturn {sagRainT, sagRainH, sagRainFlag};")(); } catch (e) { return ["W0 φόρτωση: " + e.message]; }
  const loopA = w.indexOf("for(let o=0;o<u.length;o++){const v=u[o],x=d[d.length-1];"), loopB = w.indexOf("}const m=d.length>B?", loopA);
  if (loopA < 0 || loopB < 0) return ["W1 δεν βρέθηκε ο βρόχος διπλοτύπων"];
  const dedupe = new Function("u", "const d=[];" + w.slice(loopA, loopB + 1) + "\nreturn d;");
  // ίδια διαδρομή με το kt: t από sagRainT, εγγραφή από sagRainH, ταξινόμηση, διπλότυπα
  const hist = (variable, recs) => dedupe(recs.map(u => { const o = H.sagRainT(variable, u, Date.parse(u.time)); return H.sagRainH(variable, u, o, Number(u.value)); }).sort((x, y) => x.t - y.t));
  const v33 = { time: "2026-10-04T00:00:12.000Z", value: 0, metadata: { period_start_utc: "2026-10-03T00:00:00.000Z", period_end_utc: "2026-10-03T23:59:59.999Z", source_variable: "rain_height_acc" } };
  const h1 = hist("rain_height_daily", [v33]);
  ok(h1.length === 1 && new Date(h1[0].t).toISOString() === "2026-10-03T12:00:00.000Z", "W1α v33 ημέρα 3/10 στο μέσο της (όχι 4/10 00:00)");
  const v34a = { time: "2026-10-03T12:00:00.000Z", value: 2, metadata: { alg: "v34", period_start_utc: "2026-10-03T00:00:00.000Z", period_end_utc: "2026-10-04T00:00:00.000Z", coverage: 0.5, partial: true, status: "measured" } };
  const v34b = { ...v34a, value: 3, metadata: { ...v34a.metadata, coverage: 1, partial: false } };
  const h2 = hist("rain_height_daily", [v34b, v33, v34a]);
  ok(h2.length === 1 && h2[0].v === 3, "W1β ίδια περίοδος: μία τιμή, η v34 με την πλήρη κάλυψη (" + JSON.stringify(h2.map(x => x.v)) + ")");
  const h3 = hist("air_temperature", [{ time: "2026-10-03T12:00:00.000Z", value: 1 }, { time: "2026-10-03T12:00:00.000Z", value: 2 }]);
  ok(h3.length === 1 && h3[0].v === 2, "W1γ άλλες μεταβλητές: αμετάβλητη συμπεριφορά (κερδίζει η τελευταία)");
  const now = Date.now();
  ok(H.sagRainFlag("current_rain_height_daily", { alg: "v34", status: "measured" }, now - 5 * 36e5, "1.00 mm").startsWith("—"), "W2α σιωπηλός σταθμός (5 ω) → «—»");
  ok(H.sagRainFlag("current_rain_height_daily", { alg: "v34", status: "measured" }, now - 2 * 36e5, "1.00 mm") === "1.00 mm", "W2β φρέσκια μέτρηση → ως έχει");
  ok(H.sagRainFlag("rain_height_daily", { alg: "v34", partial: true, status: "measured" }, now, "1.00 mm") === "≥ 1.00 mm", "W2γ μερική → «≥»");
  ok(H.sagRainFlag("current_rain_height_daily", { alg: "v34", status: "estimate" }, now, "6.00 mm") === "≈ 6.00 mm (εκτίμηση)", "W2δ εκτίμηση → «≈ … (εκτίμηση)»");
  ok(H.sagRainFlag("current_rain_height_yearly", { alg: "v34", partial: true, status: "measured", since: "2026-03" }, now, "76.1 mm") === "≥ 76.1 mm · από 03/2026", "W2ε φέτος μερικό → «· από 03/2026»");
  ok(H.sagRainFlag("air_temperature", { alg: "v34", partial: true }, now - 9e9, "20 °C") === "20 °C", "W2στ άλλες μεταβλητές ανέγγιχτες");
  ok(w.includes('w=T(j),k=w?sagRainFlag(j,w.m,w.t,B(j,w.v)):"—"') && w.includes('const $=k?sagRainFlag(N,k.m,k.t,T(N,k.v)):"—"') && w.includes('S=c?sagRainFlag(n,c.metadata,Date.parse(c.time),Ya(n,c.value)):"—"'), "W2ζ καλωδίωση στις τρεις οθόνες");
  ok(w.includes('M.push(sagRainH(d,u,o,v))') && w.includes('const o=sagRainT(d,u,Date.parse('), "W1δ καλωδίωση στο ιστορικό");
  ok(w.includes('rain_height:{label:"🌧 Βροχή ανά αποστολή (εκτίμηση ρυθμού)"') && !w.includes("(5λεπτο)"), "W3 ετικέτα ανά αποστολή");
  ok(["Σήμερα", "Αυτή την εβδομάδα", "Αυτό τον μήνα", "Φέτος"].every(x => w.includes('(' + x + ')",...H.rain_height,showSum:!1}')), "W4 χωρίς «Σύνολο» στα τρέχοντα");
  return f;
}
const base = run(W);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 τέλος αντί μέσου", "return Math.floor((a+z)/2)}catch{return o}}", "return z}catch{return o}}"],
  ["m2 διπλότυπα όπως πριν", "!x||x.t!==v.t?d.push(v):((v.q||0)>=(x.q||0)&&(d[d.length-1]=v))}", "!x||x.t!==v.t?d.push(v):d[d.length-1]=v}"],
  ["m3 χωρίς «—» σιωπής", "Date.now()-tms>4*36e5", "Date.now()-tms>4*36e9"],
  ["m4 χωρίς «≥»", '(m.partial?"≥ ":est?"≈ ":"")', '(est?"≈ ":"")'],
  ["m5 χωρίς «από»", 'm.partial&&m.since?" · από "', 'false?" · από "'],
  ["m6 κεντρική κάρτα χωρίς σήμανση", 'S=c?sagRainFlag(n,c.metadata,Date.parse(c.time),Ya(n,c.value)):"—"', 'S=c?Ya(n,c.value):"—"'],
  ["m7 «Σύνολο» στο φέτος", '(Φέτος)",...H.rain_height,showSum:!1}', '(Φέτος)",...H.rain_height}'],
  ["m8 v33 κερδίζει", 'h.q=2+(Number(m.coverage)||0)', 'h.q=0'],
];
let k = 0;
for (const [n, a, b] of MUT) {
  if (!W.includes(a)) { console.log("ΑΝΕΦΑΡΜΟΣΤΗ " + n); process.exit(1); }
  let r; try { r = run(W.replace(a, b)); } catch (e) { r = ["εξαίρεση: " + e.message]; }
  if (r.length) { k++; console.log("  σκοτώθηκε " + n + " <- " + r[0].slice(0, 90)); } else console.log("  ΕΠΕΖΗΣΕ    " + n);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + k + "/" + MUT.length);
process.exit(k === MUT.length ? 0 : 1);
