// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 27/11/2026 · Σταθμοί ΕΛΓΟ — συμπλήρωμα του read_elgo_stations (που έπεσε σε όριο ρυθμού
// μετά τον 3ο σταθμό). Μόνο Οκτώβριος–Νοέμβριος, παύση 400 ms ανά κλήση, μία επανάληψη σε σφάλμα. Κόστος ≈ 10–12 χιλ. εγγραφές.
// Πολιτική 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει. Καμία εγγραφή.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const ST = {
  "Γρίβα": "67f426a236b2df000a053948", "Καστανερή": "67f426da1d7709000abb62b0", "Μελίβοια 1": "683379a2038bf5000a7eaaf3",
  "Μελίβοια 2": "680e7c7822d66f000b008ff6", "Μελίβοια 3": "683379ed697657000a7185e2", "Όρμα": "67fdf9f10c797f000a7b6d09",
  "Σκοτίνα Κάτω": "67f3ece305bd5d000a6ac97b", "Σκοτίνα Πάνω": "67f3ec9f30b56a00090d20d6", "Βρία 1": "680e7bf064c02e000a714dcd", "Βρία 2": "680f51b022d66f000b18bede",
};
const SOIL = { "Γρίβα": "67f4263236b2df000a052c5d", "Καστανερή": "67f4267aa8b5e6000a653fe2", "Σκοτίνα Κάτω": "680e7a2c5ff14c000a9fd72e", "Μελίβοια 1": "680e89d840a654000ac657e9", "Όρμα": "67fdfa1ec587b600093e94f8" };
const WINS = [["2026-10-01T00:00:00Z", "2026-10-31T23:59:59Z"], ["2026-11-01T00:00:00Z", new Date().toISOString()]];
let N = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(p) {
  for (let k = 0; k < 3; k++) {
    await sleep(400 + k * 1500);
    const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
    const j = await r.json().catch(() => ({}));
    if (j.status) { N += Array.isArray(j.result) ? j.result.length : 1; return j.result; }
    if (k === 2) throw new Error(r.status + " " + JSON.stringify(j.message || j).slice(0, 100));
  }
}
const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
async function agg(id, v, interval, fn) { let o = []; for (const [s, e] of WINS) o = o.concat(await get(`/device/${id}/data?` + q({ variable: v, query: "aggregate", interval, function: fn, start_date: s, end_date: e }))); return o; }
const H = (t) => Math.floor(Date.parse(t) / 3600000);
const fmt = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
(async () => {
  console.log("ΕΒ=== ΕΛΓΟ συμπλήρωμα (Οκτ–Νοε) · " + new Date().toISOString() + " ===");
  const hourly = {}, pmax = {};
  for (const [nm, id] of Object.entries(ST)) {
    try {
      const t = await agg(id, "air_temperature", "hour", "avg");
      const hrs = new Map(t.map((r) => [H(r.time), Number(r.value)])); hourly[nm] = hrs;
      const keys = [...hrs.keys()].sort((a, b) => a - b), hod = new Array(24).fill(0), days = new Map();
      for (const k of keys) { const d = new Date(k * 3600000); hod[d.getUTCHours()]++; const dk = d.toISOString().slice(0, 10); days.set(dk, (days.get(dk) || 0) + 1); }
      const total = Math.floor(Date.now() / 3600000) - H("2026-10-01T00:00:00Z");
      let gapMax = 0, gapAt = null; for (let i = 1; i < keys.length; i++) { const g = keys[i] - keys[i - 1] - 1; if (g > gapMax) { gapMax = g; gapAt = keys[i - 1] + 1; } }
      console.log(`ΕΒ1|${nm}|ώρες με θερμ. ${keys.length}/${total} (${Math.round(keys.length / total * 100)} %) · ημέρες 24/24 ${[...days.values()].filter((v) => v === 24).length}/${days.size} · μέγιστο κενό ${gapMax} ω από ${gapAt ? fmt(gapAt * 3600000) : "—"} · ανά ώρα UTC ${hod.join(",")}`);
    } catch (e) { console.log(`ΕΒ1|${nm}|ΣΦ ${e.message}`); }
    try {
      const p = await agg(id, "barometric_pressure_hpa", "day", "max");
      pmax[nm] = new Map(p.map((r) => [r.time.slice(0, 10), Number(r.value)]));
    } catch (e) { console.log(`ΕΒ2|${nm}|ΣΦ ${e.message}`); }
  }
  for (const [a, b] of [["Καστανερή", "Γρίβα"], ["Βρία 1", "Βρία 2"], ["Σκοτίνα Πάνω", "Σκοτίνα Κάτω"], ["Μελίβοια 3", "Μελίβοια 1"], ["Όρμα", "Σκοτίνα Κάτω"]]) {
    const A = hourly[a] || new Map(), B = hourly[b] || new Map(); let n = 0, s = 0; const hd = new Array(24).fill(0), hn = new Array(24).fill(0);
    for (const [k, v] of A) if (B.has(k)) { n++; s += v - B.get(k); const h = new Date(k * 3600000).getUTCHours(); hd[h] += v - B.get(k); hn[h]++; }
    const d = []; const PA = pmax[a] || new Map(), PB = pmax[b] || new Map();
    for (const [k, v] of PA) if (PB.has(k) && v > 850 && PB.get(k) > 850) d.push(v - PB.get(k));
    d.sort((x, y) => x - y);
    console.log(`ΕΒ6|${a} − ${b}|θερμ. μέση διαφορά ${n ? (s / n).toFixed(2) : "—"} °C (${n} ώρες) · 00–05 UTC ${(hd.slice(0, 6).reduce((x, y) => x + y, 0) / Math.max(1, hn.slice(0, 6).reduce((x, y) => x + y, 0))).toFixed(2)} · 10–14 UTC ${(hd.slice(10, 15).reduce((x, y) => x + y, 0) / Math.max(1, hn.slice(10, 15).reduce((x, y) => x + y, 0))).toFixed(2)} · πίεση (ημερ. μέγιστο) διάμεσος διαφοράς ${d.length ? d[Math.floor(d.length / 2)].toFixed(1) : "—"} hPa (${d.length} ημέρες, εύρος ${d.length ? d[0].toFixed(1) + "…" + d[d.length - 1].toFixed(1) : "—"})`);
  }
  for (const [nm, id] of Object.entries(SOIL)) {
    try {
      const out = [];
      for (const v of ["soil_moisture", "temp_soil", "conduct_soil"]) { const a = await agg(id, v, "day", "avg"); out.push(`${v} ${a.length} ημέρες (μηδέν ${a.filter((r) => Number(r.value) === 0).length})`); }
      console.log(`ΕΒ5|${nm}|σόνδα Οκτ–Νοε: ` + out.join(" · "));
    } catch (e) { console.log(`ΕΒ5|${nm}|ΣΦ ${e.message}`); }
  }
  try {   // Βρία 1: θετικές ωριαίες βροχές ανά μήνα (μόνο θετικές = λίγες εγγραφές)
    const pos = await get(`/device/${ST["Βρία 1"]}/data?` + q({ variable: "rain_height_hourly", query: "conditional", function: "gt", value: 0, start_date: "2026-05-01T00:00:00Z", end_date: "2026-05-31T23:59:59Z" }));
    const pos6 = await get(`/device/${ST["Βρία 1"]}/data?` + q({ variable: "rain_height_hourly", query: "conditional", function: "gt", value: 0, start_date: "2026-06-01T00:00:00Z", end_date: "2026-06-30T23:59:59Z" }));
    const smp = await get(`/device/${ST["Βρία 1"]}/data?` + q({ variable: "rain_height_hourly", start_date: "2026-06-10T00:00:00Z", qty: 2, ordination: "ascending" }));
    console.log(`ΕΒ9|Βρία 1|ωριαία βροχή >0: Μάιος ${pos.length}, Ιούνιος ${pos6.length} · δείγμα εγγραφής Ιουνίου: ` + JSON.stringify((smp || []).map((r) => ({ t: r.time, v: r.value, m: r.metadata }))).slice(0, 500));
  } catch (e) { console.log(`ΕΒ9|ΣΦ ${e.message}`); }
  console.log(`ΕΒ=== τέλος · εγγραφές ≈ ${N} ===`);
})();
