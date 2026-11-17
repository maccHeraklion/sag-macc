// Ελεγκτής T-PUBWX-01 · analysis/publicStationSnapshot.js: εκτελεί το ΠΡΑΓΜΑΤΙΚΟ script με ψεύτικο API (fetch)
// και ελέγχει το latest.json που θα ανέβαινε. Σενάρια: βάση v34 + βήματα μετρητή, νέα μέρα χωρίς βάση, μηδενισμός
// μετρητή, αδύνατο βήμα, σιωπηλός σταθμός, εκτίμηση έτους. Τρέξιμο: node analysis/test/public_station_check.cjs
const fs = require("fs"), path = require("path"), vm = require("vm");
const SRC = fs.readFileSync(path.join(__dirname, "..", "publicStationSnapshot.js"), "utf8");

function run(scn) {
  return new Promise((resolve) => {
    let uploaded = null; const logs = [];
    const fakeFetch = async (url, opts = {}) => {
      const u = String(url);
      const ok = (result) => ({ ok: true, json: async () => ({ status: true, result }) });
      if (u.includes("query=last_value")) return ok(scn.last);
      if (u.includes("variables[]=rain_height_acc&start_date")) {
        const from = Date.parse(decodeURIComponent(u.split("start_date=")[1].split("&")[0]));
        return ok(scn.acc.filter((p) => Date.parse(p.time) >= from));
      }
      if (u.endsWith("/files")) {
        const b = opts.body;
        if (b instanceof FormData) {
          if (b.get("multipart_action") === "start") return ok("UP1");
          const f = b.get("file"); uploaded = { name: b.get("filename"), text: await f.text() }; return ok({ ETag: "e" });
        }
        return ok({ file: "x" });
      }
      throw new Error("απρόσμενο " + u);
    };
    const RealDate = Date;
    class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(scn.now); } static now() { return scn.now; } }
    const ctx = { require, process: { env: { T_ANALYSIS_TOKEN: "x" } }, fetch: fakeFetch, FormData, Blob, Buffer, Intl, Date: FakeDate,
      console: { log: (s) => logs.push(s) }, Math, JSON, Number, String, Object, Array, encodeURIComponent, decodeURIComponent };
    vm.runInNewContext(SRC, ctx);
    setTimeout(() => resolve({ json: uploaded && JSON.parse(uploaded.text), name: uploaded && uploaded.name, logs }), 50);
  });
}

const T = (s) => new Date(s).toISOString();
const rec = (variable, value, time, metadata) => ({ variable, value, time: T(time), metadata });
const raw = (time, extra = {}) => [
  rec("air_temperature", 20.2, time), rec("air_humidity", 66, time), rec("dew_point", 13.64, time),
  rec("barometric_pressure_hpa", 1021.3, time), rec("wind_speed_kmh", 5.76, time), rec("peak_wind_gust_kmh", 9.72, time),
  rec("wind_direction_sensor", 222, time), rec("uv_index", 2.4, time), rec("light_intensity", 23737, time),
  rec("rain_gauge", extra.gauge ?? 0, time), rec("rain_height_acc", extra.acc ?? 1.016, time)];
const rainRecs = (dayKey, dayEnd, dVal, mVal, yVal, yStatus = "measured", mCov = 1) => [
  rec("current_rain_height_daily", dVal, dayEnd, { period_key: dayKey, period_end_utc: T(dayEnd), coverage: 1, status: "measured" }),
  rec("current_rain_height_monthly", mVal, dayEnd, { period_key: dayKey.slice(0, 7), period_end_utc: T(dayEnd), coverage: mCov, status: "measured" }),
  rec("current_rain_height_yearly", yVal, dayEnd, { period_key: dayKey.slice(0, 4), period_end_utc: T(dayEnd), coverage: 0.5, status: yStatus, since: "2026-04" })];
const accSeries = (startIso, everyMin, values) => values.map((v, i) => ({ variable: "rain_height_acc", value: v, time: T(Date.parse(startIso) + i * everyMin * 60000) }));

let fail = 0, n = 0;
const eq = (name, got, want) => { n++; const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fail++; console.log("✗", name, "→", JSON.stringify(got), "αντί", JSON.stringify(want)); } };

(async () => {
  // 1. Ήρεμη μέρα: βάση 0 στις 07:05Z, μετρητής σταθερός → 0
  let r = await run({ now: Date.parse("2026-11-17T09:40:00Z"),
    last: raw("2026-11-17T09:33:24Z").concat(rainRecs("2026-11-17", "2026-11-17T07:05:54Z", 0, 1.016, 1.016, "estimate", 0.716)),
    acc: accSeries("2026-11-17T06:40:00Z", 5, Array(36).fill(1.016)) });
  eq("όνομα αρχείου", r.name, "public/epal_platania/latest.json");
  eq("θερμ.", r.json.temperature_c.value, 20.2);
  eq("βροχή σήμερα", r.json.rain_today_mm.mm, 0);
  eq("σήμερα όχι ≥", r.json.rain_today_mm.at_least, false);
  eq("μήνας 1.016 ≥ (κάλυψη 0.716)", [r.json.rain_month_mm.mm, r.json.rain_month_mm.at_least], [1.016, true]);
  eq("έτος εκτίμηση από 2026-04", [r.json.rain_year_mm.estimate, r.json.rain_year_mm.since], [true, "2026-04"]);
  eq("ραγδαιότητα 0", r.json.rain_rate_mmh.value, 0);
  eq("ανάγνωση λίγες εγγραφές", r.json.reads < 60, true);

  // 2. Βρέχει μετά τη βάση: +0,254 ×3 → σήμερα 0.5 + 0.762
  r = await run({ now: Date.parse("2026-11-17T09:40:00Z"),
    last: raw("2026-11-17T09:35:00Z", { gauge: 0.254, acc: 2.778 }).concat(rainRecs("2026-11-17", "2026-11-17T07:05:00Z", 0.5, 3, 10)),
    acc: accSeries("2026-11-17T07:00:00Z", 5, [2.016, 2.016, 2.016, 2.27, 2.524, 2.778]) });
  eq("σήμερα = βάση + βήματα", r.json.rain_today_mm.mm, 1.262);
  eq("μήνας = βάση + βήματα", r.json.rain_month_mm.mm, 3.762);
  eq("ραγδαιότητα 3,048 mm/ώρα", r.json.rain_rate_mmh.value, 3.048);

  // 3. Μόλις άλλαξε η μέρα (00:20 ώρα Ελλάδας = 22:20Z) — βάση της χθεσινής → σήμερα από μεσάνυχτα (22:00Z)
  r = await run({ now: Date.parse("2026-11-17T22:20:00Z"),
    last: raw("2026-11-17T22:18:00Z", { acc: 5.254 }).concat(rainRecs("2026-11-17", "2026-11-17T19:05:00Z", 4, 6, 12)),
    acc: accSeries("2026-11-17T18:40:00Z", 5, Array(41).fill(4)).concat(accSeries("2026-11-17T22:05:00Z", 5, [5, 5.254])) });
  eq("νέα μέρα: μόνο μετά τα μεσάνυχτα (σημείο 22:00 = χθες)", r.json.rain_today_mm.mm, 1.254);
  eq("μήνας συνεχίζει: 6 + όλα μετά 19:05", r.json.rain_month_mm.mm, 7.254);

  // 4. Μηδενισμός μετρητή + αδύνατο βήμα
  r = await run({ now: Date.parse("2026-11-17T09:40:00Z"),
    last: raw("2026-11-17T09:35:00Z").concat(rainRecs("2026-11-17", "2026-11-17T07:05:00Z", 1, 1, 1)),
    acc: accSeries("2026-11-17T07:00:00Z", 5, [80, 80.254, 0.254, 0.508, 900, 900.254]) });
  eq("μηδενισμός μετρά τη νέα τιμή, αδύνατο βήμα πετιέται", r.json.rain_today_mm.mm, 1.762);   // 1 βάση + 0,254 (μηδενισμός) + 0,254 + 0,254· 900 πετιέται· 07:05 ανήκει στη βάση

  // 5. Σιωπηλός σταθμός (> 180΄) → βροχή σήμερα άγνωστη
  r = await run({ now: Date.parse("2026-11-17T15:00:00Z"),
    last: raw("2026-11-17T09:35:00Z").concat(rainRecs("2026-11-17", "2026-11-17T07:05:00Z", 0, 1, 1)),
    acc: accSeries("2026-11-17T07:00:00Z", 5, [1, 1, 1]) });
  eq("σιωπηλός → null", r.json.rain_today_mm.mm, null);
  eq("μήνας ακόμη γνωστός", r.json.rain_month_mm.mm, 1);
  eq("log OK", /^OK\|epal_platania\|/.test(r.logs[0] || ""), true);

  console.log(fail ? `✗ ${fail}/${n} απέτυχαν` : `✓ ${n}/${n}`);
  process.exit(fail ? 1 : 0);
})();
