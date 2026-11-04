// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Κουτσάκης/Γρινιαράκης: ρύθμιση καλλιέργειας, όργανα, τι σειρές υπάρχουν.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);

const P = "D2|";
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    const nm = tag(f, "name") || f.name;
    if (!/ΚΟΥΤΣΑΚΗΣ|ΓΡΙΝΙΑΡΑΚΗΣ/.test(nm)) continue;
    console.log(P + "ΑΓΡΟΣ|" + nm + "|" + f.id);
    let c = {}; try { c = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
    const L = Array.isArray(c.crops) && c.crops.length ? c.crops : [c];
    for (const x of L) console.log(P + "CFG|" + JSON.stringify({ g: x.cultivation_type_general, t: x.cultivation_type, v: x.cultivar || x.variety, cov: x.covered_cultivation ?? c.covered_cultivation, plant: x.planting_date || x.sowing_date, pest: x.last_pesticide_key, pdate: x.last_pesticide_date }));
    const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
    const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
    console.log(P + "CROPKEYS|" + Object.keys(o.crops[0]).join(",") + "|" + JSON.stringify({ id: o.crops[0].id, n: o.crops[0].name }));
    const ind = {}; for (const k in o.crops[0].indicators) ind[dec(k)] = o.crops[0].indicators[k];
        for (const k of Object.keys(ind).filter((k) => k.startsWith("fir_message_"))) console.log(P + "MSG|" + k.slice(12) + "|" + val(ind[k]) + "|fir=" + val(ind["fir_" + k.slice(12)]));
    for (const k of ["leaf_wetness_source", "leaf_wetness_weight", "leaf_wet_hours_today", "leaf_moisture_max_today", "leaf_moisture_hours_gt15_today", "leaf_sensor_dt_max_today", "leaf_sensor_placement", "pathogen_analysis_status", "infection_model_status"]) console.log(P + "IND|" + k + "=" + String(JSON.stringify(ind[k] ?? null)).slice(0, 170));
    console.log(P + "INV|" + String(JSON.stringify(o.shared.device_inventory ?? null)).slice(0, 700));
    const ids = Object.keys(o.shared).filter((k) => k.startsWith("diag_stats__")).map((k) => k.slice(12));
    for (const id of ids) {
      const d = await get(`/device/${id}`).catch(() => ({}));
      const rows = await get(`/device/${id}/data?variables=temperature,humidity,air_temperature,air_humidity,leaf_moisture,leaf_temperature,dew_point&qty=3000&ordination=descending`).catch((e) => []);
      const by = {}; for (const r of rows) { const a = (by[r.variable] = by[r.variable] || { n: 0, last: r.time, first: r.time, lo: 1e9, hi: -1e9 }); a.n++; a.first = r.time; const v = Number(r.value); if (Number.isFinite(v)) { a.lo = Math.min(a.lo, v); a.hi = Math.max(a.hi, v); } }
      console.log(P + "DEV|" + id + "|" + (d.name || "?") + "|type=" + tag(d, "type") + "|" + JSON.stringify(by).replace(/2026-/g, "").replace(/:\d\d\.\d+Z/g, ""));
    }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
