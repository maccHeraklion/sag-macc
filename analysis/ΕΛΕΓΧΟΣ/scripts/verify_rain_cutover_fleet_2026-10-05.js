// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · αλλαγή ημέρας βροχής 5/10 00:00 Ελλάδας (= 4/10 21:00Z), ΟΛΟΣ Ο ΣΤΟΛΟΣ.
// Ανά περίοδο κρατά την ΚΑΛΥΤΕΡΗ εγγραφή (όπως widget/ανάλυση: v34 > v33, μετά μεγαλύτερη κάλυψη) — οι πολλαπλές
// εγγραφές ίδιας περιόδου είναι σχεδιασμένη αναβάθμιση (μερική → πληρέστερη), όχι σφάλμα.
// Ελέγχει: γέφυρα 4/10, W40 = Σ ημερών, «σήμερα» 5/10 από 21:00Z, ωριαίες 21Z–05Z έναντι ωμών δεδομένων του σταθμού.
// Απαιτεί την πολιτική ανάγνωσης 6ac171e0 ΕΝΕΡΓΗ μόνο όσο τρέχει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const CUT = Date.parse("2026-10-04T21:00:00Z");
async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const recs = (id, v, a, b) => get(`/device/${id}/data?variable=${v}&start_date=${a}&end_date=${b}&qty=500&ordination=ascending`);
const M = (x) => x.metadata || {};
const q = (x) => (M(x).alg === "v34" ? 2 : 1) + (M(x).alg === "v34" ? (Number(M(x).coverage) || 0) : 1);
function best(list) { const by = new Map(); for (const x of list) { const k = M(x).period_start_utc || x.time; const p = by.get(k); if (!p || q(x) > q(p)) by.set(k, x); } return by; }
const f3 = (n) => Number(n).toFixed(3);
(async () => {
  console.log("ΚΣΤ=== ΑΛΛΑΓΗ ΗΜΕΡΑΣ ΒΡΟΧΗΣ · ΣΤΟΛΟΣ · " + new Date().toISOString() + " ===");
  const devs = await get("/device?filter[tags][0][key]=type&filter[tags][0][value]=s2120&amount=200");
  const S = { n: 0, bridge: 0, bridgeDup: 0, bridgePartial: 0, noBridge: [], weekOk: 0, weekBad: [], curOk: 0, curBad: [], hoursMissRaw: [], silent: [] };
  for (const d of devs) {
    S.n++;
    const nm = String(d.name || d.id).replace(/sensecap_s2120_/i, "");
    try {
      const last = await get(`/device/${d.id}/data?qty=1&ordination=descending`);
      const lastMs = last && last[0] ? Date.parse(last[0].time) : null;
      if (!lastMs || Date.now() - lastMs > 6 * 3600e3) { S.silent.push(nm + "@" + (last && last[0] ? last[0].time.slice(5, 16) : "ποτέ")); }
      const days = await recs(d.id, "rain_height_daily", "2026-09-27T00:00:00Z", "2026-10-06T00:00:00Z");
      const bd = best(days);
      const all44 = days.filter(x => M(x).period_start_utc === "2026-10-04T00:00:00.000Z");
      const b44 = bd.get("2026-10-04T00:00:00.000Z");
      if (b44 && M(b44).alg === "v34" && M(b44).period_end_utc === "2026-10-04T21:00:00.000Z") {
        S.bridge++; if (all44.length > 1) S.bridgeDup++; if (M(b44).partial) S.bridgePartial++;
      } else if (lastMs && lastMs > Date.parse("2026-10-04T00:00:00Z")) S.noBridge.push(nm);
      const weeks = await recs(d.id, "rain_height_weekly", "2026-09-27T00:00:00Z", "2026-10-06T00:00:00Z");
      const w = best(weeks).get("2026-09-28T00:00:00.000Z");
      const inW = [...bd.values()].filter(x => { const s = Date.parse(M(x).period_start_utc); return s >= Date.parse("2026-09-28T00:00:00Z") && s < CUT; });
      const sum = inW.reduce((s, x) => s + Number(x.value), 0);
      if (w && M(w).alg === "v34" && Math.abs(Number(w.value) - sum) < 0.01) S.weekOk++;
      else if (w || inW.length) S.weekBad.push(nm + " W40=" + (w ? f3(w.value) + "[" + (M(w).alg || "v33") + " κ" + M(w).coverage + "]" : "—") + " Σ" + inW.length + "=" + f3(sum)
        + " (" + weeks.filter(x => M(x).period_start_utc === "2026-09-28T00:00:00.000Z").map(x => f3(x.value) + "/κ" + M(x).coverage + "/" + String(M(x).calc_at || "").slice(5, 16)).join(" ") + ")");
      const cur = await get(`/device/${d.id}/data?variable=current_rain_height_daily&qty=1&ordination=descending`);
      const c = cur && cur[0];
      if (c && c.group === "current_day_2026-10-05" && M(c).period_start_utc === "2026-10-04T21:00:00.000Z" && Date.now() - Date.parse(c.time) < 4 * 3600e3) S.curOk++;
      else if (lastMs && Date.now() - lastMs < 6 * 3600e3) S.curBad.push(nm + " " + (c ? c.time.slice(5, 16) + " " + c.group + " αρχή " + String(M(c).period_start_utc).slice(5, 16) : "—"));
      // ωριαίες 21Z–05Z: λείπει ώρα ΕΝΩ ο σταθμός έστειλε δεδομένα μέσα σε αυτή;
      const hrs = await recs(d.id, "rain_height_hourly", "2026-10-04T20:00:00Z", "2026-10-05T06:00:00Z");
      const have = new Set(hrs.map(x => M(x).period_start_utc));
      // κάθε uplink του s2120 έχει air_temperature (το «variables=» με start_date γυρίζει 0 σημεία — παγίδα)
      const raw = await recs(d.id, "air_temperature", "2026-10-04T21:00:00Z", "2026-10-05T05:00:00Z");
      const rawH = new Set((raw || []).map(x => new Date(Math.floor(Date.parse(x.time) / 3600e3) * 3600e3).toISOString()));
      const miss = []; for (let t = CUT; t < Date.parse("2026-10-05T05:00:00Z"); t += 3600e3) { const k = new Date(t).toISOString(); if (!have.has(k)) miss.push(k.slice(11, 13) + (rawH.has(k) ? "!" : "")); }
      if (miss.length) S.hoursMissRaw.push(nm + "[" + miss.join(",") + "]");
    } catch (x) { console.log("ΚΣΤERR|" + nm + "|" + x.message); }
  }
  console.log("ΚΣΤ1|σταθμοί " + S.n + " · σιωπηλοί > 6 ω: " + S.silent.length + " " + S.silent.join(" "));
  console.log("ΚΣΤ2|γέφυρα 4/10 v34 00Z–21Z: " + S.bridge + " (με 2+ εγγραφές/αναβάθμιση " + S.bridgeDup + ", καλύτερη μερική " + S.bridgePartial + ") · ΧΩΡΙΣ γέφυρα ενώ έστελναν 4/10: " + S.noBridge.join(" "));
  console.log("ΚΣΤ3|W40 = Σ καλύτερων ημερών: " + S.weekOk + " ✔ · διαφορές: " + (S.weekBad.join(" | ") || "καμία"));
  console.log("ΚΣΤ4|«σήμερα» 5/10 με αρχή 21:00Z και φρέσκο: " + S.curOk + " · προβλήματα (ενεργοί σταθμοί): " + (S.curBad.join(" | ") || "κανένα"));
  console.log("ΚΣΤ5|ωριαίες 21Z–05Z που λείπουν (\"!\" = ο σταθμός ΕΣΤΕΙΛΕ μέσα στην ώρα): " + (S.hoursMissRaw.join(" ") || "καμία"));
  console.log("ΚΣΤ=== ΤΕΛΟΣ ===");
})();
