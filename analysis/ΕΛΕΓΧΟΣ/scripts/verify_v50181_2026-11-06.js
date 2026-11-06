// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 6/11/2026 · Επαλήθευση v50.181 (T-BOTRYTIS-HOSTS-01): πυρήνας, σφάλματα, βοτρύτης ανά αγρό/καλλιέργεια
// (όλοι οι αγροί τώρα + ιστορικό 72 ωρών στον Κουτσάκη), βοτρύτης ανά αγρό, και οι κάρτες που άλλαξαν με v50.179.
const zlib = require("zlib"); const crypto = require("crypto");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const P = "V181|"; const FLEET = "6a98855ca06e41000bfae024"; const CORE = "6898958ea9fc0d000a382484";
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
const KEYS = ["botrytis_cinerea", "pseudoperonospora_cubensis"];
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const txt = (x) => (x && typeof x === "object" && x.metadata && x.metadata.text ? String(x.metadata.text).slice(0, 110) : "");
const unpack = (b) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  try {
    for (const e of await get(`/device/${FLEET}/data?variables=fleet_summary&qty=3`)) { const m = e.metadata || {}; console.log(P + "FLEET|" + e.time + "|kernel=" + m.kernel + "|computed=" + m.computed + "/" + m.total + "|errors=" + JSON.stringify(m.errors || []).slice(0, 200) + "|ms=" + m.ms); }
    const meta = await get(`/analysis/${CORE}/download`); let buf = Buffer.from(await (await fetch(meta.url)).arrayBuffer()); if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    console.log(P + "CORE|bytes=" + buf.length + "|sha256=" + crypto.createHash("sha256").update(buf).digest("hex") + "|" + (/SAG_KERNEL_VERSION = '([^']+)'/.exec(buf.toString("utf8")) || [])[1]);
  } catch (e) { console.log(P + "ERR|" + e.message); }
  const cnt = {}; let kouts = null;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    const nm = tag(f, "name") || f.name;
    if (/ΚΟΥΤΣΑΚ/i.test(nm) || /ΚΟΥΤΣΑΚ/i.test(f.name)) kouts = f;
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; if (!b || !b.metadata || !b.metadata.data) continue;
      const o = unpack(b);
      for (const cr of o.crops || []) {
        const ind = {}; for (const k in cr.indicators || {}) ind[dec(k)] = cr.indicators[k];
        const crop = String(cr.id).split(":")[1];
        const all = Object.keys(ind).filter((k) => k.startsWith("fir_message_")).length;
        const parts = [];
        for (const k of KEYS) { const m = ind["fir_message_" + k]; if (!m) continue; const v = String(val(m)); cnt[k + "=" + v.split(" ")[0]] = (cnt[k + "=" + v.split(" ")[0]] || 0) + 1;
          parts.push(k.split("_")[0].slice(0, 6) + "." + k.split("_")[1].slice(0, 5) + "=" + v.split(" ")[0] + " h" + val(ind["infection_hours_counter_" + k]) + "/mx" + val(ind["infection_hours_counter_max_" + k]) + " «" + txt(m) + "»"); }
        if (parts.length) console.log(P + "F|" + nm + "/" + crop + "|" + String(b.time).slice(11, 16) + "|κάρτες=" + all + "|B64=" + String(b.metadata.data).length + "|src=" + val(ind.leaf_wetness_source) + "|" + parts.join(" ; ").slice(0, 500));
      }
    } catch (e) { console.log(P + "ERR|" + f.id + "|" + e.message); }
  }
  console.log(P + "ΣΥΝΟΛΑ|" + JSON.stringify(cnt));
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
