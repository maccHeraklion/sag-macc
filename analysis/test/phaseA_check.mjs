// Ελεγκτής T-PHASEA-01 (v50.186, 7/11/2026): Φάση Α των κανόνων δεδομένων. Τρέχει τη δική του συνάρτηση του πυρήνα και το πραγματικό κομμάτι του widget. Μεταλλάξεις: κάθε βλάβη πρέπει να πιαστεί.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const K0 = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8").replace(/\r\n/g, "\n");
const W0 = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");
const fnOf = (src, name) => { const s = src.indexOf("function " + name + "("); if (s < 0) throw new Error("δεν βρέθηκε " + name); let d = 0; for (let j = src.indexOf("{", s); j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) return src.slice(s, j + 1); } throw new Error("δεν έκλεισε"); };
/* Η ετυμηγορία είναι βέλος μέσα στο bundle: κόβεται από το όνομά της ως το επόμενο βέλος. */
const verdictOf = (w) => { const a = w.indexOf("_sagSoilVerdict9=(c)=>"), b = w.indexOf(",_sagChk7=l.useMemo", a); if (a < 0 || b < 0) throw new Error("δεν βρέθηκε η ετυμηγορία"); const f10 = (x, d) => (x == null || !Number.isFinite(x) ? "—" : String(Math.round(x * 10) / 10).replace(".", ",")); return new Function("_sagF10", "return (" + w.slice(a + "_sagSoilVerdict9=".length, b) + ");")(f10); };

function check(K, W) {
  const bad = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(n + ": πήρα " + JSON.stringify(a) + " αντί " + JSON.stringify(b)); }; const ok = (n, c) => { if (!c) bad.push(n); };
  let R; try { R = new Function("return (" + fnOf(K, "_sagIpsiRunning") + ");")(); } catch (e) { return ["πυρήνας: " + e.message]; }
  const em = (r) => Object.fromEntries(r.emit.map((x) => [x.variable, x.value]));
  /* Σ2 */
  eq("κενή ώρα δεν γράφει τίποτα", R(undefined, false, 5, 4), { emit: [], dailyAvg: null }); eq("null", R(null, false, 5, 4), { emit: [], dailyAvg: null }); eq("κενό κείμενο", R("", false, 5, 4), { emit: [], dailyAvg: null }); eq("σκουπίδι", R("x", false, 5, 4), { emit: [], dailyAvg: null });
  eq("ημερήσιος παλμός χωρίς τιμή κλείνει την ημέρα", R(undefined, true, 5, 20), { emit: [{ variable: "ipsi_running_count", value: 0 }], dailyAvg: null });
  eq("το μηδέν είναι τιμή", em(R(0, false, 6, 1)), { ipsi_running_avg: 3, ipsi_running_count: 2 });
  /* ίδιο αποτέλεσμα με πριν όταν υπάρχει IPSI */
  eq("πρώτη ώρα", em(R(4, false, null, 0)), { ipsi_running_avg: 4, ipsi_running_count: 1 }); eq("σωρευτικός", em(R(8, false, 4, 1)), { ipsi_running_avg: 6, ipsi_running_count: 2 }); eq("τρέχων", R(8, false, 4, 1).dailyAvg, 6);
  eq("παλμός: χθεσινός μέσος", R(2, true, 5, 23).dailyAvg, 5); eq("παλμός: μηδενίζει", em(R(2, true, 5, 23)), { ipsi_running_avg: 2, ipsi_running_count: 1 }); eq("παλμός με λίγες ώρες", R(2, true, 5, 5).dailyAvg, 2);
  /* 12 άγνωστες ώρες δεν ρίχνουν τον μέσο */
  let a = null, c = 0; for (let h = 0; h < 24; h++) { const r = R(h % 2 ? undefined : 6, false, a, c); for (const x of r.emit) { if (x.variable === "ipsi_running_avg") a = x.value; else c = x.value; } } eq("κενά στη μέση", [a, c], [6, 12]);
  ok("η κλήση στον βρόχο", K.includes("_sagIpsiRunning(ipsi?.[0]?.value, dailyTich, prevIpsiAvg, prevIpsiCount)")); ok("το daily avg μένει όταν υπάρχει", K.includes("if (_ipsiRun.dailyAvg !== null) measurementsForCrop.data.ipsi_daily_avg")); ok("έμεινε η παλιά γραμμή", !K.includes("ipsi?.[0]?.value ?? 0"));
  /* Σ12 */
  ok("ψευδές κείμενο", !/δέχονται πια/.test(K)); ok("αληθινό κείμενο", K.includes("Οι υπολογισμοί συνεχίζουν με αυτή την"));
  /* Σ6 */
  ok("Σ6", W.includes('if(x.k==="forecast_status"&&String(x.d.value)!=="Ενεργή")ok=false;'));
  /* Σ5 */
  ok("Σ5 όριο", W.includes("_fa>12?Math.round(_fa):0")); ok("Σ5 όχι περασμένη ώρα", !W.includes("De<0&&(De=0)") && W.includes('if(De<0)return{daysCount:0,hoursCount:0,lastUpdate:c,nextDateISO:null,nextMinMax:"—",nextEntry:null,staleH}')); ok("Σ5 κάρτα", W.includes('Oe.staleH?e.jsx("div"') && W.includes("lastUpdate:c,staleH,nextDateISO:ie"));
  /* Σ7 */
  ok("Σ7", !W.includes("Συνθήκες ανάπτυξης σήμερα") && W.includes("Συνθήκες ανάπτυξης · προηγούμενο 24ωρο"));
  /* Σ8 */
  ok("Σ8 κλειδιά", W.includes('const AK=[["weather_alert_frost","Παγετός"],["weather_alert_heat","Καύσωνας"],') && !W.includes('"frost_warning"')); ok("Σ8 κείμενο", W.includes('if(/^weather_alert_/.test(x.k))return [String(md.label_el||'));
  /* 5γ */
  let V; try { V = verdictOf(W); } catch (e) { return bad.concat("widget: " + e.message); }
  const C = (o) => V(Object.assign({ zl: 20, zu: 30, st: 24, rz: 15, last: 15 }, o));
  eq("χωρίς απόφαση πυρήνα μένει ΠΟΤΙΣΜΑ", C({}).tone, "red"); ok("ΠΟΤΙΣΜΑ", /ΠΟΤΙΣΜΑ/.test(C({}).head));
  for (const t of ["ΜΗΝ ποτίζετε — κρύο έδαφος", "ΜΗΝ ποτίζετε — ακατάλληλο νερό", "ΜΗΝ ποτίζετε — υπερβολικό νερό", "Δεν απαιτείται πότισμα — βροχή 9.0mm (ωφέλιμη: 6.0mm)", "Δεν χρειάζεται άρδευση"]) { const v = C({ irr: t }); eq("ανταποκρίνεται: " + t, v.tone, "blue"); ok("χωρίς ΠΟΤΙΣΜΑ: " + t, !/ΠΟΤΙΣΜΑ/.test(v.head) && v.head.includes(t)); }
  eq("σημείο ποτίσματος με κρύο έδαφος", C({ rz: 23, irr: "ΜΗΝ ποτίζετε — κρύο έδαφος" }).tone, "blue");
  eq("συμφωνούν: πότισμα", C({ irr: "Απαιτείται άρδευση" }).tone, "red"); eq("συμφωνούν: όχι", C({ rz: 25, irr: "Δεν χρειάζεται άρδευση" }).tone, "green");
  eq("πυρήνας ναι, διάγραμμα όχι", C({ rz: 25, irr: "Απαιτείται άρδευση" }).tone, "orange"); eq("πυρήνας ναι, πάνω από στόχο", C({ rz: 35, irr: "Απαιτείται άρδευση" }).tone, "orange"); ok("το κείμενο δείχνει την κάρτα", /κάρτα άρδευσης/.test(C({ rz: 25, irr: "Απαιτείται άρδευση" }).head));
  eq("άλλο κείμενο δεν αλλάζει", C({ irr: "Άρδευση: δεν υπολογίζεται" }).tone, "red");
  return bad;
}
const r = check(K0, W0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ Φάση Α");
const KM = [['const v = (ipsiRaw === null || ipsiRaw === undefined || ipsiRaw === \'\') ? NaN : Number(ipsiRaw);', "const v = Number(ipsiRaw ?? 0);"], ["ipsiRaw === null || ipsiRaw === undefined || ipsiRaw === ''", "ipsiRaw === undefined"], ['emit: dailyTich ? [{ variable: "ipsi_running_count", value: 0 }] : [], dailyAvg: null', "emit: [], dailyAvg: null"], ["const baseCount = dailyTich ? 0 : Number(prevCount || 0);", "const baseCount = Number(prevCount || 0);"], ["_prevCntN >= 6) ? _prevAvgN : newAvg", "_prevCntN >= 6) ? newAvg : newAvg"], ["if (_ipsiRun.dailyAvg !== null) measurementsForCrop", "measurementsForCrop"], ["Οι υπολογισμοί συνεχίζουν με αυτή την", "τα μοντέλα δεν την δέχονται πια"]];
const WM = [['if(x.k==="forecast_status"&&String(x.d.value)!=="Ενεργή")ok=false;', ""], ["_fa>12?Math.round(_fa):0", "_fa>120?Math.round(_fa):0"], ['if(De<0)return{daysCount:0,hoursCount:0,lastUpdate:c,nextDateISO:null,nextMinMax:"—",nextEntry:null,staleH};', "De<0&&(De=0);"], ["lastUpdate:c,staleH,nextDateISO:ie", "lastUpdate:c,nextDateISO:ie"], ["Συνθήκες ανάπτυξης · προηγούμενο 24ωρο", "Συνθήκες ανάπτυξης σήμερα"], ['["weather_alert_frost","Παγετός"]', '["frost_warning","Παγετός"]'], ["if(/^weather_alert_/.test(x.k))return [String(md.label_el||", 'if(0)return [String(md.label_el||'], ['(tone==="red"||tone==="orange")&&/^(ΜΗΝ', '(tone==="red")&&/^(ΜΗΝ'], ["ΜΗΝ ποτίζετε|Δεν απαιτείται πότισμα|Δεν χρειάζεται άρδευση", "ΜΗΝ ποτίζετε|Δεν απαιτείται πότισμα"], ['tone="blue";head="Απόφαση αγρού: όχι πότισμα τώρα', 'head="Απόφαση αγρού: όχι πότισμα τώρα'], ['(tone==="green"||tone==="blue")&&/^Απαιτείται', '(tone==="green")&&/^Απαιτείται'], ['else if((tone==="green"||tone==="blue")&&/^Απαιτείται άρδευση/.test(_ir))', "else if(0)"]];
let k = 0; const tot = KM.length + WM.length; for (const [src, muts, f] of [[K0, KM, (m) => [m, W0]], [W0, WM, (m) => [K0, m]]]) for (const [a, b] of muts) { if (!src.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } let bad; try { bad = check(...f(src.replace(a, b))); } catch (e) { bad = ["εξαίρεση"]; } if (bad.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${tot}`); if (r.length) process.exitCode = 1;
