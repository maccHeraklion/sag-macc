// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ΚΟΞΑΡΗ (057C) και ΕΛΙΑ (0138): χάθηκαν πίεση και κατεύθυνση ανέμου.
// Ερώτηση Μιχάλη 12/10: φταίει το λογισμικό μας; Ελέγχει:
//  (1) ΣΤΟΛΟΣ: για κάθε s2120 πότε ήρθε τελευταία πίεση / κατεύθυνση / θερμοκρασία (κοινός connector 67adaf5b → αν
//      φταίει ο connector, χάνονται σε ΟΛΟΥΣ)·
//  (2) 057C και 0138: οι 12 τελευταίες τιμές πίεσης/κατεύθυνσης ΠΡΙΝ σβήσουν (εκφυλισμός;) και ποιες μεταβλητές έχει
//      κάθε μετάδοση πριν και μετά τη διακοπή (λείπει ολόκληρο πακέτο ή μόνο οι δύο τιμές;)·
//  (3) ωμό payload, αν αποθηκεύεται.
// Απαιτεί την πολιτική ανάγνωσης 6ac171e0 (type=s2120) ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const PICK = { "67fe99b670defa000a954bbe": "ΚΟΞΑΡΗ 057C", "67fe9a063b56fa000ac75c4b": "ΕΛΙΑ 0138" };
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const last = (id, v, n, extra) => get(`/device/${id}/data?variable=${v}&qty=${n || 1}&ordination=descending${extra || ""}`);
const lt = async (id, v) => { const a = await last(id, v, 1); return a && a[0] ? a[0].time.slice(5, 16) : "ποτέ"; };
(async () => {
  console.log("ΠΚΑ=== ΠΙΕΣΗ/ΚΑΤΕΥΘΥΝΣΗ · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  const rows = [];
  for (const d of devs) {
    try {
      const t = await lt(d.id, "air_temperature");
      if (t === "ποτέ") continue;
      rows.push(String(d.name).replace(/sensecap_s2120_/i, "") + " θ" + t + " π" + await lt(d.id, "barometric_pressure_hpa") + " κ" + await lt(d.id, "wind_direction_sensor"));
    } catch (x) { rows.push(d.name + " ERR " + x.message); }
  }
  console.log("ΠΚΑΣ|" + rows.join(" | "));
  for (const [id, nm] of Object.entries(PICK)) {
    try {
      const p = await last(id, "barometric_pressure_hpa", 12);
      const k = await last(id, "wind_direction_sensor", 12);
      console.log("ΠΚΑ1|" + nm + "|πίεση: " + (p || []).map(x => x.time.slice(5, 16) + "=" + x.value).join(" "));
      console.log("ΠΚΑ1|" + nm + "|κατεύθυνση: " + (k || []).map(x => x.time.slice(5, 16) + "=" + x.value).join(" "));
      const stop = p && p[0] ? Date.parse(p[0].time) : null;
      // ποιες μεταβλητές έχει κάθε μετάδοση: λίγο πριν τη διακοπή και τώρα
      const win = async (a, b, lab) => {
        // ανά μεταβλητή (το start_date χωρίς «variable=» μπορεί να γυρίσει 0 σημεία — παγίδα), ομαδοποίηση ανά δευτερόλεπτο
        const VARS = ["air_temperature", "air_humidity", "wind_speed_kmh", "wind_direction_sensor", "barometric_pressure_hpa",
          "rain_height", "rain_height_acc", "rain_gauge", "light_intensity", "uv_index", "peak_wind_gust_kmh", "battery", "dew_point"];
        const all = [];
        for (const v of VARS) {
          const r = await get(`/device/${id}/data?variable=${v}&qty=200&ordination=descending&start_date=${new Date(a).toISOString()}&end_date=${new Date(b).toISOString()}`).catch(() => []);
          for (const x of r || []) all.push(x);
        }
        const by = new Map();
        for (const x of all) { const key = x.time.slice(0, 19); if (!by.has(key)) by.set(key, { t: x.time, v: new Set() }); by.get(key).v.add(x.variable); }
        const sig = new Map();
        for (const [, g] of by) { const s = [...g.v].filter(v => !/^(current_)?rain_height_(hourly|daily|weekly|monthly|yearly)$/.test(v)).sort().join(","); if (!sig.has(s)) sig.set(s, { n: 0, first: g.t, last: g.t }); const o = sig.get(s); o.n++; if (g.t < o.first) o.first = g.t; if (g.t > o.last) o.last = g.t; }
        console.log("ΠΚΑ2|" + nm + "|" + lab + "|ομάδες " + by.size + "|" + [...sig.entries()].map(([s, o]) => o.n + "× [" + s + "] " + o.first.slice(5, 16) + "…" + o.last.slice(5, 16)).join(" ║ "));
      };
      if (stop) await win(stop - 3 * 3600e3, stop + 3 * 3600e3, "γύρω από τη διακοπή");
      await win(Date.now() - 3 * 3600e3, Date.now(), "τώρα (3 ω)");
      for (const v of ["payload", "raw_payload", "frame", "fport", "fw_version", "firmware_version", "battery", "bat"]) {
        const a = await last(id, v, 2).catch(() => []);
        if (a && a.length) console.log("ΠΚΑ3|" + nm + "|" + v + ": " + a.map(x => x.time.slice(5, 16) + "=" + String(x.value).slice(0, 80)).join(" ¦ "));
      }
    } catch (x) { console.log("ΠΚΑERR|" + nm + "|" + x.message); }
  }
  console.log("ΠΚΑ=== ΤΕΛΟΣ ===");
})();
