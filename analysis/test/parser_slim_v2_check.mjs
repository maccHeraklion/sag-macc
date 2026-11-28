// Ελεγκτής T-PARSER-SLIM-02: το φίλτρο συσκευής κρατά κάθε μέτρηση, κόβει μόνο τα πεδία χωρίς αναγνώστη και γράφει τους
// τρεις δείκτες μόνο στα πρώτα 10 λεπτά κάθε ώρας (UTC). Δείγματα πακέτων = πραγματικά ονόματα μεταβλητών (απογραφή 28/11).
import fs from "node:fs";
const SRC = fs.readFileSync(new URL("../../payload_parsers/device_slim_filter_v2_2026-11-28.js", import.meta.url), "utf8");
const run = (src, payload, minute) => {
  const FakeDate = class extends Date { constructor(...a) { super(...(a.length ? a : [Date.UTC(2026, 10, 28, 9, minute, 0)])); } };
  return new Function("payload", "Date", src + "\nreturn payload;")(payload.map((v) => ({ variable: v, value: 1 })), FakeDate).map((x) => x.variable);
};
const S2120 = ["air_temperature", "air_humidity", "light_intensity", "uv_index", "wind_speed_kmh", "wind_speed_kmh2", "wind_direction_sensor", "rain_gauge", "rain_height_acc", "rain_height",
  "barometric_pressure_hpa", "peak_wind_gust_kmh", "dew_point", "battery", "wind_chill", "thw_indexC", "heat_index", "ismband", "lrralt", "lrruuid", "sensor_error_event", "hardware_version", "firmware_version", "lrrid", "lrrrssi", "lrrsnr"];
const LMS01 = ["leaf_temperature", "leaf_moisture", "bat", "message_type", "interrupt_flag", "tempc_ds18b20", "payload", "late", "lrrid", "channel", "lrrsnr", "lrrrssi", "time", "fport", "deveui", "lrrlon", "lrrlat"];
const SE0X = ["conduct_soil2", "soil_moisture2", "soil_temperature2", "conduct_soil1", "soil_moisture1", "soil_temperature1", "i_flag", "mod", "ds18b20", "battery", "payloaddecodederror", "lrrid", "channel"];
const KEEP = {
  s2120: ["air_temperature", "air_humidity", "light_intensity", "uv_index", "wind_speed_kmh", "wind_direction_sensor", "rain_gauge", "rain_height_acc", "rain_height", "barometric_pressure_hpa", "peak_wind_gust_kmh", "dew_point", "battery", "sensor_error_event", "hardware_version", "firmware_version", "lrrid", "lrrrssi", "lrrsnr"],
  lms01: ["leaf_temperature", "leaf_moisture", "bat", "lrrid", "lrrsnr", "lrrrssi", "lrrlon", "lrrlat"],
  se0x: ["conduct_soil2", "soil_moisture2", "soil_temperature2", "conduct_soil1", "soil_moisture1", "soil_temperature1", "battery", "lrrid"],
};
const IDX = ["wind_chill", "thw_indexC", "heat_index"];
function checkStrict(src) {
  const f = [];
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) f.push(m + ": " + JSON.stringify(a) + " ≠ " + JSON.stringify(b)); };
  eq(run(src, S2120, 30), KEEP.s2120, "S2120 στο :30 (χωρίς δείκτες)");
  eq(run(src, S2120, 5).sort(), [...KEEP.s2120, ...IDX].sort(), "S2120 στο :05 (με δείκτες)");
  eq(run(src, S2120, 9).filter((v) => IDX.includes(v)), IDX, "S2120 στο :09 κρατά δείκτες");
  eq(run(src, S2120, 10).filter((v) => IDX.includes(v)), [], "S2120 στο :10 κόβει δείκτες");
  eq(run(src, LMS01, 30), KEEP.lms01, "LMS01");
  eq(run(src, SE0X, 30), KEEP.se0x, "SE0X");
  eq(run(src, ["valve_1", "valve_1_pulse", "batterypct"], 30), ["valve_1", "valve_1_pulse", "batterypct"], "ξένη συσκευή αμετάβλητη");
  eq(run(src, ["AIR_TEMPERATURE", "ISMBAND"], 30), ["AIR_TEMPERATURE"], "κεφαλαία");
  // μη πίνακας: δεν σκάει
  try { new Function("payload", "Date", src + "\nreturn payload;")(null, Date); } catch (e) { f.push("null payload: " + e.message); }
  return f;
}
const base = checkStrict(SRC);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ βάσης:\n" + base.join("\n")); process.exit(1); }
console.log("βάση ✔");
const MUT = [
  ["όριο λεπτών 10→60", (s) => s.replace("getUTCMinutes() < 10", "getUTCMinutes() < 60")],
  ["όριο λεπτών 10→0", (s) => s.replace("getUTCMinutes() < 10", "getUTCMinutes() < 0")],
  ["χωρίς πεζά", (s) => s.replace("String(x.variable).toLowerCase()", "String(x.variable)")],
  ["κόβει dew_point", (s) => s.replace('"deveui",', '"deveui", "dew_point",')],
  ["κόβει lrrid", (s) => s.replace('"deveui",', '"deveui", "lrrid",')],
  ["κόβει rain_height", (s) => s.replace('"deveui",', '"deveui", "rain_height",')],
  ["δεν κόβει payload", (s) => s.replace('"payload", ', "")],
  ["δεν κόβει wind_speed_kmh2", (s) => s.replace('"wind_speed_kmh2", ', "")],
  ["δείκτες πάντα", (s) => s.replace("if (!sagKeepIdx && SAG_HOURLY", "if (false && SAG_HOURLY")],
  ["δείκτες ποτέ", (s) => s.replace("if (!sagKeepIdx && SAG_HOURLY", "if (SAG_HOURLY")],
  ["κόβει την ξένη συσκευή", (s) => s.replace('"deveui",', '"deveui", "valve_1",')],
  ["τοπική ώρα αντί UTC", (s) => s.replace("getUTCMinutes()", "getMinutes() + 30")],
];
let killed = 0;
for (const [n, m] of MUT) { const s2 = m(SRC); if (s2 === SRC) { console.log("ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΕΦΑΡΜΟΣΤΗΚΕ: " + n); process.exit(1); } const r = checkStrict(s2); if (r.length) killed++; else console.log("ΕΠΕΖΗΣΕ: " + n); }
console.log("μεταλλάξεις " + killed + "/" + MUT.length);
process.exit(killed === MUT.length ? 0 : 1);
