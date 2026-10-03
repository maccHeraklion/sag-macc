// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · ζωντανοί έλεγχοι Ζ1–Ζ8 του ελέγχου μετεωρολογικών 4/10.
// Πολιτική 6ac171e063d4f4000b05d9e5 (προσωρινή: access+get_data σε type=s2120 και isField=yes).
// ΚΑΜΙΑ εγγραφή. Μία γραμμή ανά σταθμό, για να χωρά στο console (64 KiB / 200 εγγραφές).
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const KOUTSAKIS = "699733fae43c8b000aafec9f";
const ST = {
  "680e7c9a0feb8c000a70a6c8":"05AA","681315a0ed3243000a85e3c2":"0023","6a313a9bb99739000d4aafa9":"0068","6a2bb332bf4706000c79e7fc":"0089",
  "69aed3c9962d2c00097b621f":"00c5","6971054abb3d630010741e09":"00d8","679762659c7a230009672585":"00d8-1","67fe9a063b56fa000ac75c4b":"0138",
  "6a313c16c4325f000c1e0072":"01db","6a313eebd5cee5000c01c612":"01f3","67976266de3d260009528afe":"0298","681c8f237a6e41000a900c8d":"03A4",
  "6797626662b2a00009f635e6":"03b2","6a313e76bf4706000cb0ef12":"03bb","679762679a6427000982b13d":"03C4","67fd6001d2bacd000aed390e":"03D4",
  "67a0fb407a6e1b0009348600":"03F1","681c8f5c8ee17b000a45de39":"03FC","680e7c7822d66f000b008ff6":"0401","6797832265ba050009c7d668":"0425",
  "67fdf9f10c797f000a7b6d09":"0445","684c4e48cc1cd8000a10ddb9":"047c","684c39adfcf7b1000a8dd206":"047e","6797626820ac9d000954e70d":"0495",
  "684c342a13af9d000a77bef3":"049e","681c8f9c4f9c59000a0e3368":"04A4","67f3ec9f30b56a00090d20d6":"04c5","680e7bf064c02e000a714dcd":"04e0",
  "684c458bcd7675000a9ae991":"04e8","6797626920ac9d000954e710":"04F8","681c8f3d4f9c59000a0e267a":"0503","67f426a236b2df000a053948":"0509",
  "67f3ece305bd5d000a6ac97b":"0514","683379a2038bf5000a7eaaf3":"052A","6818812a6c0953000a1ab9c8":"0534","681c8f825e2146000a16693b":"053E",
  "683379ed697657000a7185e2":"054F","680e8a1c40a654000ac660de":"0571","67fe99b670defa000a954bbe":"057C","67f426da1d7709000abb62b0":"058B",
  "67a7655b29c214000a93fe2c":"05B6","680f51b022d66f000b18bede":"06e9",
};
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}
const rd = (id, v, qty) => get(`/device/${id}/data?variables=${v}&qty=${qty}`).catch(e => ({ err: e.message }));
const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const r2 = (x, d = 2) => (x === null || x === undefined || !Number.isFinite(x)) ? "-" : Number(x.toFixed(d));
const athDay = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(5, 10);   // EEST (+3) έως 25/10
const SINCE = Date.parse("2026-09-27T00:00:00Z");

(async () => {
  console.log("=== ΑΝΑΓΝΩΣΗ ΚΑΙΡΟΥ · " + new Date().toISOString() + " ===");
  // ── Ζ1 · bundle Κουτσάκη ──
  try {
    const b = await rd(KOUTSAKIS, "field_bundle", 3);
    if (b.err) console.log("Z1|ERR|" + b.err);
    for (const e of (Array.isArray(b) ? b : [])) {
      const d = e.metadata && e.metadata.data;
      let o = null; try { o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(d), "base64")).toString("utf8")); } catch (x) {}
      if (!o) { console.log("Z1|" + e.time + "|δεν αποσυμπιέζεται"); continue; }
      const sh = o.shared || {}; const crops = o.crops || [];
      const pick = (x) => x ? JSON.stringify({ v: x.value, c: x.metadata && x.metadata.color, s: x.metadata && x.metadata._s, t: x.metadata && x.metadata._t, tx: String((x.metadata && x.metadata.text) || "").slice(0, 90) }) : "—";
      console.log("Z1|" + e.time + "|frost=" + pick(sh.weather_alert_frost) + "|rain_ahead=" + pick(sh.rain_ahead) + "|fc=" + pick(sh.forecast_status) + "|crops=" + crops.length);
      for (const c of crops) { const i = c.indicators || {}; console.log("Z1c|" + e.time + "|" + c.id + "|heat=" + pick(i.weather_alert_heat) + "|inf=" + pick(i.infection_ahead) + "|bpi=" + pick(i.bpi_message) + "|night=" + pick(i.night_temp_warning)); }
    }
  } catch (x) { console.log("Z1|ERR|" + x.message); }

  // ── Ζ2–Ζ7 · σταθμοί ──
  for (const [id, nm] of Object.entries(ST)) {
    try {
      const [acc, gau, rh, fw, at, pr] = await Promise.all([
        rd(id, "rain_height_acc", nm === "049e" ? 3000 : 1200), rd(id, "rain_gauge", 600), rd(id, "rain_height", 600),
        rd(id, "firmware_version", 1), rd(id, "air_temperature", 200), rd(id, "barometric_pressure_hpa", 30)]);
      const A = Array.isArray(acc) ? acc.map(x => ({ t: Date.parse(x.time), v: Number(x.value) })).filter(x => Number.isFinite(x.v)).sort((a, b) => a.t - b.t) : [];
      const G = Array.isArray(gau) ? gau : []; const RH = Array.isArray(rh) ? rh : [];
      const T = Array.isArray(at) ? at.map(x => Date.parse(x.time)).sort((a, b) => a - b) : [];
      const gaps = []; for (let i = 1; i < T.length; i++) gaps.push((T[i] - T[i - 1]) / 60000);
      const dlt = med(gaps);
      const strT = Array.isArray(at) ? at.filter(x => typeof x.value === "string").length : 0;
      const negT = Array.isArray(at) ? at.filter(x => Number(x.value) < 0).length : 0;
      // κβάντο rain_gauge (Ζ5): πολλαπλάσια 0,127 (parser ×5/60) ή 1,524 (mm/h ωμό)
      const gz = [...G, ...RH].map(x => Number(x.value)).filter(v => Number.isFinite(v) && v > 0);
      const q127 = gz.filter(v => Math.abs(v / 0.127 - Math.round(v / 0.127)) < 0.02).length;
      const q1524 = gz.filter(v => Math.abs(v / 1.524 - Math.round(v / 1.524)) < 0.02).length;
      // μετρητής: αρνητικά βήματα, μέγιστο βήμα, σύνολα ανά τοπική ημέρα από 27/9
      let neg = 0, maxStep = 0, maxAt = ""; const day = {};
      for (let i = 1; i < A.length; i++) {
        const d = A[i].v - A[i - 1].v;
        if (d < -0.001) neg++;
        if (d > maxStep) { maxStep = d; maxAt = new Date(A[i].t).toISOString().slice(5, 16); }
        if (d > 0 && A[i].t >= SINCE) { const k = athDay(A[i].t); day[k] = (day[k] || 0) + d; }
      }
      const days = Object.entries(day).map(([k, v]) => k + ":" + r2(v, 1)).join(",");
      const P = Array.isArray(pr) ? med(pr.map(x => Number(x.value)).filter(Number.isFinite)) : null;
      const fwv = Array.isArray(fw) && fw[0] ? fw[0].value : "-";
      console.log(`ST|${nm}|fw=${fwv}|Δ=${r2(dlt, 1)}′|acc=${A.length}(${A.length ? r2(A[0].v, 1) + "→" + r2(A[A.length - 1].v, 1) : "-"} από ${A.length ? new Date(A[0].t).toISOString().slice(5, 13) : "-"})|gauge=${G.length}|rh=${RH.length}|q.127=${q127}/${gz.length} q1.524=${q1524}|neg=${neg}|max=${r2(maxStep)}@${maxAt}|T str=${strT} neg=${negT}|P=${r2(P, 1)}|ημ:${days}`);
      if (nm === "049e" || nm === "047c" || nm === "04A4") {
        const big = []; for (let i = 1; i < A.length; i++) { const d = A[i].v - A[i - 1].v; if (d > 1 && A[i].t >= SINCE) big.push(new Date(A[i].t + 3 * 3600e3).toISOString().slice(5, 16) + "+" + r2(d, 1) + "/" + r2((A[i].t - A[i - 1].t) / 60000, 0) + "′"); }
        console.log(`BIG|${nm}|${big.length}|${big.slice(0, 60).join(" ")}`);
      }
    } catch (x) { console.log("ST|" + nm + "|ERR|" + x.message); }
  }
  // ── Ζ8 · sum χωρίς εγγραφές σε σταθμό με μετρητή ──
  try {
    const s = await get(`/device/684c342a13af9d000a77bef3/data?variables=rain_height&query=sum&start_date=${encodeURIComponent(new Date(Date.now() - 864e5).toISOString())}`).catch(e => ({ err: e.message }));
    console.log("Z8|sum(rain_height) 049e 24ω → " + JSON.stringify(s).slice(0, 200));
  } catch (x) { console.log("Z8|ERR|" + x.message); }
  console.log("=== ΤΕΛΟΣ ===");
})();
