// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · Σταθμοί ΕΛΓΟ (Ινστιτούτο Δασικών Ερευνών): έλεγχος των σημείων των ερευνητών.
// Τα ωμά δεδομένα στο TagoIO κρατιούνται 6 μήνες → έλεγχος μόνο για ό,τι υπάρχει (από ~Μάιο/Ιούνιο 2026).
// Υπολογίζει ΜΕΣΑ στο probe και τυπώνει μόνο συνόψεις. Κόστος ≈ 50–60 χιλ. εγγραφές (συναθροίσεις ωρών/ημερών).
// Πολιτική 6ac171e0 (ανάγνωση s2120 + σονδών) ΕΝΕΡΓΗ μόνο όσο τρέχει. Καμία εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ST = [
  ["Βρία 1", "680e7bf064c02e000a714dcd", "680e86e0a44e13000a7195f2"],
  ["Βρία 2", "680f51b022d66f000b18bede", "680e86bd09d547000a435260"],
  ["Γρίβα", "67f426a236b2df000a053948", "67f4263236b2df000a052c5d"],
  ["Καστανερή", "67f426da1d7709000abb62b0", "67f4267aa8b5e6000a653fe2"],
  ["Μελίβοια 1", "683379a2038bf5000a7eaaf3", "680e89d840a654000ac657e9"],
  ["Μελίβοια 2", "680e7c7822d66f000b008ff6", "67a766e6a56e20000ae2821a"],
  ["Μελίβοια 3", "683379ed697657000a7185e2", "68184d91c227a7000ad35e50"],
  ["Όρμα", "67fdf9f10c797f000a7b6d09", "67fdfa1ec587b600093e94f8"],
  ["Σκοτίνα Κάτω", "67f3ece305bd5d000a6ac97b", "680e7a2c5ff14c000a9fd72e"],
  ["Σκοτίνα Πάνω", "67f3ec9f30b56a00090d20d6", "67f3ec04a4ccc0000a1349bd"],
];
const MONTHS = ["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"];
let N = 0;
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  if (Array.isArray(j.result)) N += j.result.length; else N += 1;
  return j.result;
}
const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
const win = (i) => ({ start_date: MONTHS[i] + "T00:00:00.000Z", end_date: new Date(Math.min(Date.parse(MONTHS[i + 1] + "T00:00:00Z") - 1, Date.now())).toISOString() });
async function monthly(id, params) {   // ίδια παράμετροι σε κάθε μήνα (όριο 1 μήνα ανά συνάθροιση)
  let out = [];
  for (let i = 0; i < MONTHS.length - 1; i++) {
    if (Date.parse(MONTHS[i]) > Date.now()) break;
    try { out = out.concat(await get(`/device/${id}/data?` + q(Object.assign({}, params, win(i))))); } catch (e) { out.err = (out.err || "") + MONTHS[i].slice(5, 7) + ":" + e.message.slice(0, 50) + " "; }
  }
  return out;
}
const H = (t) => Math.floor(Date.parse(t) / 3600000);
const fmt = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
(async () => {
  console.log("ΕΛ=== ΣΤΑΘΜΟΙ ΕΛΓΟ · " + new Date().toISOString() + " ===");
  const hourly = {}, pmax = {};
  for (const [nm, id, soil] of ST) {
    // (1) κάλυψη θερμοκρασίας αέρα ανά ώρα UTC (ώρες με ≥1 μέτρηση)
    const t = await monthly(id, { variable: "air_temperature", query: "aggregate", interval: "hour", function: "avg" });
    const hrs = new Map(); for (const r of t) hrs.set(H(r.time), Number(r.value));
    hourly[nm] = hrs;
    const keys = [...hrs.keys()].sort((a, b) => a - b);
    const first = keys[0], last = keys[keys.length - 1];
    const byMonth = {}, hod = new Array(24).fill(0), days = new Map();
    for (const k of keys) { const d = new Date(k * 3600000); const m = d.toISOString().slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; hod[d.getUTCHours()]++; const dk = d.toISOString().slice(0, 10); days.set(dk, (days.get(dk) || 0) + 1); }
    let gapMax = 0, gapAt = null; for (let i = 1; i < keys.length; i++) { const g = keys[i] - keys[i - 1] - 1; if (g > gapMax) { gapMax = g; gapAt = keys[i - 1] + 1; } }
    const nDays = days.size, full = [...days.values()].filter((v) => v === 24).length;
    const totalH = last - first + 1;
    console.log(`ΕΛ1|${nm}|θερμ. αέρα: πρώτη ${first ? fmt(first * 3600000) : "—"} · ώρες με τιμή ${keys.length}/${totalH} (${Math.round(keys.length / totalH * 100)} %) · ημέρες 24/24: ${full}/${nDays} · μέγιστο κενό ${gapMax} ω από ${gapAt ? fmt(gapAt * 3600000) : "—"}${t.err ? " · ΣΦ " + t.err : ""}`);
    console.log(`ΕΛ1|${nm}|ανά μήνα: ` + Object.entries(byMonth).map(([m, v]) => m.slice(5) + "=" + v).join(" ") + ` · ανά ώρα UTC (ημέρες με τιμή, από ${nDays}): ` + hod.join(","));
    // (2) πίεση: ημερήσιο μέγιστο (ανθεκτικό στις πτώσεις) + τιμές εκτός ορίων
    const p = await monthly(id, { variable: "barometric_pressure_hpa", query: "aggregate", interval: "day", function: "max" });
    pmax[nm] = new Map(p.map((r) => [r.time.slice(0, 10), Number(r.value)]));
    const lo = await monthly(id, { variable: "barometric_pressure_hpa", query: "conditional", function: "lt", value: 850 });
    const hi = await monthly(id, { variable: "barometric_pressure_hpa", query: "conditional", function: "gt", value: 1085 });
    const bad = lo.concat(hi).sort((a, b) => (a.time < b.time ? -1 : 1));
    const pv = [...pmax[nm].values()].sort((a, b) => a - b);
    console.log(`ΕΛ2|${nm}|πίεση: διάμεσος ημερ. μεγίστου ${pv.length ? pv[Math.floor(pv.length / 2)] : "—"} hPa (${pv.length} ημέρες) · τιμές <850 ή >1085: ${bad.length}` + (bad.length ? " · " + bad.slice(0, 12).map((r) => fmt(Date.parse(r.time)) + "=" + r.value).join(" | ") + (bad.length > 12 ? " … τελευταία " + fmt(Date.parse(bad[bad.length - 1].time)) + "=" + bad[bad.length - 1].value : "") : ""));
    // (3) επανεκκινήσεις: κάθε εκκίνηση στέλνει έκδοση υλικολογισμικού
    try {
      const fw = await get(`/device/${id}/data?` + q({ variable: "firmware_version", start_date: "2026-05-01T00:00:00Z", qty: 2000, ordination: "ascending" }));
      const bm = {}, bh = new Array(24).fill(0);
      for (const r of fw) { const d = new Date(r.time); bm[r.time.slice(5, 7)] = (bm[r.time.slice(5, 7)] || 0) + 1; bh[d.getUTCHours()]++; }
      console.log(`ΕΛ3|${nm}|επανεκκινήσεις (αναφορές έκδοσης) ${fw.length}: ανά μήνα ` + Object.entries(bm).map(([m, v]) => m + "=" + v).join(" ") + " · ανά ώρα UTC " + bh.join(",") + (fw.length ? " · τελευταία " + fmt(Date.parse(fw[fw.length - 1].time)) + " fw " + fw[fw.length - 1].value : ""));
    } catch (e) { console.log(`ΕΛ3|${nm}|ΣΦ ${e.message}`); }
    // (4) πύλες: σταθμός + σόνδα εδάφους (ίδια θέση)
    for (const [lab, dev] of [["σταθμός", id], ["σόνδα", soil]]) {
      try {
        const g = await get(`/device/${dev}/data?` + q({ variable: "lrrid", qty: 3, ordination: "descending" }));
        const rs = await get(`/device/${dev}/data?` + q({ variable: "lrrrssi", qty: 3, ordination: "descending" }));
        console.log(`ΕΛ4|${nm}|${lab}|` + (g || []).map((r) => fmt(Date.parse(r.time)) + " " + r.value + (r.metadata && r.metadata.lrrs ? " [" + r.metadata.lrrs.map((x) => x[0] + ":" + x[1]).join(" ") + "]" : "")).join(" ‖ ") + " · RSSI " + (rs || []).map((r) => r.value).join(","));
      } catch (e) { console.log(`ΕΛ4|${nm}|${lab}|ΣΦ ${e.message}`); }
    }
    // (5) σόνδα εδάφους: ημερήσια διαθεσιμότητα υγρασίας / θερμοκρασίας / EC
    try {
      const out = [];
      for (const v of ["soil_moisture", "temp_soil", "conduct_soil"]) {
        const a = await monthly(soil, { variable: v, query: "aggregate", interval: "day", function: "avg" });
        const zero = a.filter((r) => Number(r.value) === 0).length;
        const ds = a.map((r) => r.time.slice(0, 10)).sort();
        out.push(`${v} ημέρες ${a.length}${zero ? " (μηδέν " + zero + ")" : ""} ${ds[0] || "—"}→${ds[ds.length - 1] || "—"}`);
      }
      const lastRows = await get(`/device/${soil}/data?` + q({ qty: 12, ordination: "descending" }));
      out.push("τελευταίες: " + (lastRows || []).map((r) => r.variable + "=" + r.value).slice(0, 10).join(","));
      console.log(`ΕΛ5|${nm}|σόνδα|` + out.join(" · "));
    } catch (e) { console.log(`ΕΛ5|${nm}|σόνδα ΣΦ ${e.message}`); }
  }
  // (6) συγκρίσεις ζευγών: θερμοκρασία (κοινές ώρες) και πίεση (κοινές ημέρες)
  for (const [a, b] of [["Καστανερή", "Γρίβα"], ["Βρία 1", "Βρία 2"], ["Σκοτίνα Πάνω", "Σκοτίνα Κάτω"], ["Μελίβοια 1", "Μελίβοια 2"], ["Μελίβοια 3", "Μελίβοια 2"]]) {
    const A = hourly[a], B = hourly[b]; let n = 0, s = 0; const byM = {};
    for (const [k, v] of A) if (B.has(k)) { n++; s += v - B.get(k); const m = new Date(k * 3600000).toISOString().slice(5, 7); (byM[m] = byM[m] || [0, 0]); byM[m][0] += v - B.get(k); byM[m][1]++; }
    const PA = pmax[a], PB = pmax[b]; const d = [];
    for (const [k, v] of PA) if (PB.has(k) && v > 850 && PB.get(k) > 850) d.push(v - PB.get(k));
    d.sort((x, y) => x - y);
    console.log(`ΕΛ6|${a} − ${b}|θερμ.: μέση διαφορά ${n ? (s / n).toFixed(2) : "—"} °C σε ${n} κοινές ώρες (ανά μήνα ${Object.entries(byM).map(([m, x]) => m + ":" + (x[0] / x[1]).toFixed(2)).join(" ")}) · πίεση (ημερ. μέγιστο): διάμεσος διαφοράς ${d.length ? d[Math.floor(d.length / 2)].toFixed(1) : "—"} hPa σε ${d.length} ημέρες, εύρος ${d.length ? d[0].toFixed(1) + "…" + d[d.length - 1].toFixed(1) : "—"}`);
  }
  // (7) άνεμος Καστανερή/Γρίβα: ώρες με μέγιστο 0 και μεγαλύτερη συνεχόμενη σειρά
  for (const [nm, id] of [["Καστανερή", "67f426da1d7709000abb62b0"], ["Γρίβα", "67f426a236b2df000a053948"]]) {
    const w = await monthly(id, { variable: "wind_speed_kmh", query: "aggregate", interval: "hour", function: "max" });
    const ks = w.map((r) => [H(r.time), Number(r.value)]).sort((x, y) => x[0] - y[0]);
    let z = 0, run = 0, best = 0, bestAt = null, startRun = null;
    for (let i = 0; i < ks.length; i++) { if (ks[i][1] === 0) { z++; if (run && ks[i][0] === ks[i - 1][0] + 1) run++; else { run = 1; startRun = ks[i][0]; } if (run > best) { best = run; bestAt = startRun; } } else run = 0; }
    console.log(`ΕΛ7|${nm}|άνεμος: ώρες με μέγιστο 0 km/h ${z}/${ks.length} · μεγαλύτερη σειρά ${best} ώρες από ${bestAt ? fmt(bestAt * 3600000) : "—"}`);
  }
  // (8) VPD ημέρας (KBDI): τελευταίες εγγραφές + μέγιστη υγρασία των ίδιων 24 ωρών
  for (const [nm, id] of [["Καστανερή", "67f426da1d7709000abb62b0"], ["Γρίβα", "67f426a236b2df000a053948"]]) {
    try {
      const v = await get(`/device/${id}/data?` + q({ variable: "vpd1", qty: 3, ordination: "descending" }));
      const parts = [];
      for (const r of v || []) {
        const e = Date.parse(r.time), s = e - 864e5;
        const mx = await get(`/device/${id}/data?` + q({ variable: "air_humidity", query: "max", start_date: new Date(s).toISOString(), end_date: new Date(e).toISOString() }));
        const rh = Number(mx && mx[0] && mx[0].value);
        parts.push(`${fmt(e)} vpd1=${Number(r.value).toFixed(3)} · RHmax24=${rh} → 0,6108×(1−RHmax/100)=${(0.6108 * (1 - rh / 100)).toFixed(3)}`);
      }
      console.log(`ΕΛ8|${nm}|` + parts.join(" ‖ "));
    } catch (e) { console.log(`ΕΛ8|${nm}|ΣΦ ${e.message}`); }
  }
  // (9) βροχή: ποια πεδία υπάρχουν ανά σταθμό από Μάιο
  for (const [nm, id] of [["Βρία 1", "680e7bf064c02e000a714dcd"], ["Βρία 2", "680f51b022d66f000b18bede"], ["Όρμα", "67fdf9f10c797f000a7b6d09"]]) {
    const parts = [];
    for (const v of ["rain_height", "rain_height_acc", "rain_gauge", "rain_height_hourly"]) {
      try {
        const f = await get(`/device/${id}/data?` + q({ variable: v, start_date: "2026-05-01T00:00:00Z", qty: 1, ordination: "ascending" }));
        const l = await get(`/device/${id}/data?` + q({ variable: v, qty: 1, ordination: "descending" }));
        const pos = await monthly(id, { variable: v, query: "conditional", function: "gt", value: 0 });
        parts.push(`${v}: ${f && f[0] ? fmt(Date.parse(f[0].time)) : "—"}→${l && l[0] ? fmt(Date.parse(l[0].time)) : "—"}, θετικές ${pos.length}` + (v === "rain_height_hourly" && f && f[0] && f[0].metadata ? " [" + (f[0].metadata.alg || f[0].metadata.source_variable || "?") + "]" : ""));
      } catch (e) { parts.push(v + " ΣΦ " + e.message.slice(0, 40)); }
    }
    console.log(`ΕΛ9|${nm}|` + parts.join(" · "));
  }
  // (10) τα συγκεκριμένα συμβάντα πίεσης των ερευνητών (εφόσον υπάρχουν ακόμη)
  for (const [nm, id, s, e] of [["Καστανερή 11/10", "67f426da1d7709000abb62b0", "2026-10-11T10:00:00Z", "2026-10-11T23:59:00Z"],
    ["Βρία 1 24/11", "680e7bf064c02e000a714dcd", "2026-11-24T10:00:00Z", "2026-11-24T17:00:00Z"],
    ["Βρία 2 24/11", "680f51b022d66f000b18bede", "2026-11-24T10:00:00Z", "2026-11-24T17:00:00Z"],
    ["Μελίβοια 2 27/7", "680e7c7822d66f000b008ff6", "2026-07-27T00:00:00Z", "2026-07-27T23:59:00Z"]]) {
    try {
      const r = await get(`/device/${id}/data?` + q({ variable: "barometric_pressure_hpa", start_date: s, end_date: e, qty: 400, ordination: "ascending" }));
      let jumps = []; for (let i = 1; i < r.length; i++) { const d = r[i].value - r[i - 1].value; if (Math.abs(d) >= 3) jumps.push(r[i - 1].time.slice(11, 16) + "→" + r[i].time.slice(11, 16) + " " + r[i - 1].value + "→" + r[i].value); }
      const gaps = []; for (let i = 1; i < r.length; i++) { const g = (Date.parse(r[i].time) - Date.parse(r[i - 1].time)) / 60000; if (g > 20) gaps.push(r[i - 1].time.slice(11, 16) + "→" + r[i].time.slice(11, 16)); }
      console.log(`ΕΛ10|${nm}|${r.length} τιμές · άλματα ≥3 hPa: ${jumps.slice(0, 14).join(" | ") || "κανένα"} · κενά >20΄: ${gaps.join(" ") || "κανένα"}`);
    } catch (e) { console.log(`ΕΛ10|${nm}|ΣΦ ${e.message}`); }
  }
  console.log(`ΕΛ=== τέλος · εγγραφές που επιστράφηκαν ≈ ${N} ===`);
})();
