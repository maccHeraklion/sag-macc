// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Τρέχουσα εικόνα ασθενειών ανά αγρό: καλλιέργειες, πόσες ασθένειες/εχθροί παρακολουθούνται, κατάσταση περονοσπόρων.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const DOWNY = /plasmopara|peronospora|phytophthora_infestans|phytophthora_capsici|brassica_downy|bremia/;
const P = "DS|";
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  console.log(P + "ΑΓΡΟΙ=" + fields.length);
  let first = true;
  for (const f of fields) {
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
      const nm = tag(f, "name") || f.name;
      if (!b || !b.metadata || !b.metadata.data) { console.log(P + nm + "|ΧΩΡΙΣ_BUNDLE"); continue; }
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      const sh = {}; for (const k in o.shared || {}) sh[dec(k)] = o.shared[k];
      const age = Math.round((Date.now() - Date.parse(b.time)) / 36e5);
      const parts = [];
      for (const cr of o.crops || []) {
        const ind = {}; for (const k in cr.indicators || {}) ind[dec(k)] = cr.indicators[k];
        const msgs = Object.keys(ind).filter((k) => k.startsWith("fir_message_"));
        const lv = {}; const dn = [];
        for (const k of msgs) { const v = String(val(ind[k])); lv[v.split(" ")[0]] = (lv[v.split(" ")[0]] || 0) + 1; if (DOWNY.test(k)) { const n = k.slice(12); dn.push(n + "=" + v.split(" ")[0] + "/fir" + val(ind["fir_" + n]) + "/h" + val(ind["infection_hours_counter_" + n]) + "/max" + val(ind["infection_hours_counter_max_" + n])); } }
        const ctr = Object.keys(ind).filter((k) => k.startsWith("infection_hours_counter_") && !k.includes("_max_")).length;
        const gdd = Object.keys(ind).filter((k) => k.startsWith("gdd_accumulated_")).length;
        parts.push(cr.cultivation_type + "{msg=" + msgs.length + ",ctr=" + ctr + ",gdd=" + gdd + ",lv=" + JSON.stringify(lv) + ",ims=" + val(ind.infection_model_status) + ",gps=" + val(ind.gdd_pest_status) + ",dn=[" + dn.join(";") + "]}");
      }
      console.log(P + nm + "|" + age + "h|cov=" + val(sh.covered_cultivation) + "|ims=" + val(sh.infection_model_status) + "|gps=" + val(sh.gdd_pest_status) + "|src=" + val(sh.leaf_wetness_source) + "|T=" + val(sh.air_temperature) + "|RH=" + val(sh.air_humidity) + "|" + parts.join(" "));
      if (first && /κουτσ/i.test(nm)) { first = false; console.log(P + "SHAREDKEYS|" + Object.keys(sh).join(",").slice(0, 1800)); }
    } catch (e) { console.log(P + "ERR|" + f.id + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})();
