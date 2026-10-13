// Ελεγκτής T-RAIN-CUST-01 (widget): οι 5 κάρτες βροχής του πελάτη. Εκτελεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα του bundle.
// Χρήση: node analysis/test/widget_rain_customer_check.mjs [bundle.js]
import fs from "node:fs";
const w = fs.readFileSync(process.argv[2] || new URL("../../_dist-sagMain/index-7cbd9a4e.js", import.meta.url), "utf8");
const f = []; const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) f.push(m); };
const a = w.indexOf("const sagRainClosedRe="), b = w.indexOf("function kt(t,s){", a);
const H = new Function(w.slice(a, b) + "\nreturn {sagRainT, sagRainH, sagRainFlag, sagRainHide};")();
// history push: real snippet from kt
const i0 = w.indexOf('if(Number.isFinite(o)&&Number.isFinite(v)){const x=b[m]?{...b[m]}:{},F=d.trim()==="rain_gauge"');
const i1 = w.indexOf("b[m]=x}", i0) + "b[m]=x}".length;
const push = new Function("b", "m", "d", "u", "o", "v", "sagRainH", w.slice(i0, i1) + "\nreturn b;");
const now = Date.now();
let hist = {};
push(hist, "dev", "rain_gauge", {}, now - 10 * 6e4, 0.254, H.sagRainH);
push(hist, "dev", "rain_gauge", {}, now - 5 * 6e4, 0.5, H.sagRainH);
const h = hist.dev;
ok(!h.rain_gauge && h.rain_height.length === 2, "rain_gauge αποθηκεύεται ως rain_height");
ok(h.rain_height_rate.length === 2 && h.rain_height_rate[1].v === 6, "ραγδαιότητα = 0,5 × 12 = 6 mm/h");
push(hist, "dev2", "rain_height", {}, now, 0.127, H.sagRainH);
ok(hist.dev2.rain_height_rate[0].v === 0.127 * 12, "fw 1.13: rain_height → ραγδαιότητα ×12");
push(hist, "dev3", "air_temperature", {}, now, 20, H.sagRainH);
ok(!hist.dev3.rain_height_rate && hist.dev3.air_temperature.length === 1, "άλλες μεταβλητές ανέγγιχτες");
ok(H.sagRainFlag("rain_height_rate", null, now - 40 * 6e4, "6.00 mm/h").startsWith("—"), "ραγδαιότητα 40΄ πριν → «—»");
ok(H.sagRainFlag("rain_height", null, now - 10 * 6e4, "0.500 mm") === "0.500 mm", "5λεπτο 10΄ πριν → τιμή");
ok(H.sagRainFlag("current_rain_height_daily", { alg: "v34", status: "measured" }, now - 2 * 36e5, "1.00 mm") === "1.00 mm", "βροχή ημέρας αμετάβλητη");
ok(["current_rain_height_weekly", "rain_height_hourly", "rain_height_daily", "rain_height_weekly", "rain_height_monthly", "rain_height_yearly"].every(x => H.sagRainHide.has(x))
   && !["current_rain_height_daily", "current_rain_height_monthly", "current_rain_height_yearly", "rain_height", "rain_height_rate"].some(x => H.sagRainHide.has(x)), "κρυφά: ακριβώς τα 6, ορατά τα 5");
ok(['label:"🌧 Βροχή ημέρας"', 'label:"🌧 Βροχή μήνα"', 'label:"🌧 Βροχή έτους"', 'label:"🌧 Ραγδαιότητα βροχής",defaultUnit:"mm/h"', 'label:"🌧 Βροχή τελευταίου 5λέπτου"'].every(x => w.includes(x)), "ετικέτες των 5");
process.exit(f.length ? 1 : 0);
