// Φτιάχνει δεδομένα με το ΣΧΗΜΑ του Κοκοφοίνικα: ρύθμιση coir ως μεταβλητή + πακέτο με το στέλεχος configuration του πυρήνα.
const zlib = require("zlib"), fs = require("fs");
const F = "6ae9b170fbc322000ce72f30", S = "6891d4806af6cd000aed7bcf";
const cfg = {version:4,latitude:35.0,longitude:25.0,area:5,soil_type:"coir",soil_texture_class:"coir",irrigation_system:"dripIrrigation",water_quality:"good",cultivation_type_general:"vegetableCrops",cultivation_type:"tomato",sensorShallow_depth_cm:5,sensor_deep_depth_cm:5,covered_cultivation:true,soil_depth_count:2,crops:[{id:"vegetablecrops:tomato:1",cultivation_type_general:"vegetableCrops",cultivation_type:"tomato",periods:{transplantation:{start:"2026-10-03",end:"2026-10-17"}},plants:10,area_m2:5}]};
const now = Date.now(), iso = (ms) => new Date(ms).toISOString();
const bundle = { shared: { configuration: { value: JSON.stringify({ covered_cultivation: "true" }), metadata: { internal: true } }, kernel_version: { value: "v50.171 · 2026-11-03", metadata: {} } },
  crops: [{ id: "vegetablecrops:tomato:1", cultivation_type_general: "vegetableCrops", cultivation_type: "tomato", indicators: {} }] };
const data = zlib.deflateRawSync(Buffer.from(JSON.stringify(bundle))).toString("base64");
const row = (variable, value, ms, device, metadata) => ({ id: variable + ms, variable, value, time: iso(ms), device, origin: device, metadata: metadata || {} });
const series = { soil_moisture1: 31.6, soil_moisture2: 33.2, soil_temperature1: 21.3, soil_temperature2: 21.3, conduct_soil1: 1150, conduct_soil2: 890, fertility_index1: 1, fertility_index2: 1 };
const res = (vars, mk) => ({ result: vars.flatMap(mk) });
const dataArr = [
  { result: [row("configuration", JSON.stringify(cfg), now - 9 * 36e5, F), row("field_bundle", 0, now - 15 * 6e4, F, { schema: { compression: "deflate-raw-base64" }, data })] },
  ...Object.keys(series).map((v) => ({ result: [0, 1, 2, 3, 4, 5].map((i) => row(v, series[v] + i, now - i * 20 * 6e4, S)) })),
];
const widget = { display: { parameters: [{ key: "dashboard_id", value: "6ae9b171babad0000bb4fd54" }, { key: "device_map", value: JSON.stringify({ [S]: "αισθητήρα εδάφους" }) }],
  variables: Object.keys(series).map((variable) => ({ variable, origin: { id: S, bucket: S } })) }, data: dataArr };
fs.writeFileSync("fixture.js", "window.__W=" + JSON.stringify(widget) + ";");
