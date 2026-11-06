// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 6/11/2026 · Έλεγχος ΟΜΟΙΟΜΟΡΦΙΑΣ στόλου (οδηγία Μιχάλη: ενιαία αντιμετώπιση όλων των
// αγρών, συσκευών και υποσυστημάτων· αγρός αναφοράς ο Γρινιαράκης). Για κάθε αγρό: ηλικία bundle, έκδοση πυρήνα που το έγραψε,
// κλειδιά δεικτών ανά καλλιέργεια (για υπολείμματα παλιών καταστάσεων), ονόματα ετικετών και κλειδιά της ρύθμισης (ΟΧΙ τιμές),
// και για κάθε συσκευή: τύπος, αν έχει δικό της parser (μόνο μήκος), connector/network, ηλικία τελευταίου πακέτου, δείγματα 24ώρου.
// ΔΕΝ τυπώνει τιμές ετικετών συσκευών (περιέχουν κλειδιά). Έξοδος συμπιεσμένη· τέσσερα αυτοτελή μέρη, scope {part: 0..3}.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "UNI6|"; const PARTS = 4;
let PART = 0; try { const sc = JSON.parse(process.env.T_ANALYSIS_DATA || "null"); const o = Array.isArray(sc) ? sc[0] : sc; if (o && Number.isFinite(Number(o.part))) PART = Number(o.part); } catch (e) { /* χωρίς scope */ }
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const unpack = (b) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
const MAIN = { s2120: "air_temperature", em300_th: "temperature", em320_th: "temperature", lms01_ls: "leaf_moisture", se0x: "soil_moisture1", lse02: "soil_moisture1", lse01: "soil_moisture", lse01_shallow: "soil_moisture", lse01_deep: "soil_moisture" };
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { err: String(e.message).slice(0, 60) }; } } })); return out; }
(async () => {
  const now = Date.now(); const d24 = new Date(now - 86400000).toISOString();
  const allFields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  allFields.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const fields = allFields.filter((f, i) => i % PARTS === PART);   // κάθε μέρος είναι αυτοτελές
  const devIds = new Set();
  const F = await pool(fields, 6, async (f) => {
    const o = { n: String(tag(f, "name") || f.name), tk: (f.tags || []).map((t) => String(t.key)).sort() };
    const ids = String(tag(f, "devices") || "").match(/[0-9a-f]{24}/g) || []; o.dv = ids; ids.forEach((x) => devIds.add(x));
    try { const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
      if (b && b.metadata && b.metadata.data) { o.ba = Math.round((now - Date.parse(b.time)) / 60000); o.bs = String(b.metadata.data).length; const u = unpack(b);
        o.kv = val((u.shared || {}).kernel_version); o.sh = Object.keys(u.shared || {}).map(dec).sort();
        o.cr = (u.crops || []).map((c) => ({ id: String(c.id), k: Object.keys(c.indicators || {}).map(dec).sort() })); } } catch (e) { o.be = String(e.message).slice(0, 60); }
    try { const c = (await get(`/device/${f.id}/data?variables=configuration&qty=1`))[0]; if (c) { o.ca = Math.round((now - Date.parse(c.time)) / 86400000); o.ck = Object.keys(c.metadata || {}).sort(); o.fv = (c.metadata || {}).form_version ?? (c.metadata || {}).formVersion ?? null; } } catch (e) { o.ce = String(e.message).slice(0, 60); }
    return o; });
  const D = {}; const ids = Array.from(devIds);
  const R = await pool(ids, 8, async (id) => {
    const d = await get(`/device/${id}`); const type = String(tag(d, "type") || "");
    const o = { n: d.name, t: type, a: !!d.active, p: d.payload_decoder ? String(d.payload_decoder).length : 0, c: String(d.connector || "").slice(-6), w: String(d.network || "").slice(-6), li: d.last_input ? Math.round((now - Date.parse(d.last_input)) / 3600000) : null, tk: (d.tags || []).map((t) => String(t.key)).sort().join(",") };
    const mv = MAIN[type]; if (mv) { try { o.n24 = await get(`/device/${id}/data?query=count&variables=${mv}&start_date=${d24}`); } catch (e) { o.n24 = "ERR"; } }
    return o; });
  ids.forEach((id, i) => { D[id.slice(-6)] = R[i]; });
  F.forEach((f) => { if (f && f.dv) f.dv = f.dv.map((x) => x.slice(-6)); });
  const z = zlib.deflateRawSync(Buffer.from(JSON.stringify({ t: new Date(now).toISOString(), F, D }), "utf8")).toString("base64");
  const chunks = Math.ceil(z.length / 2400);
  console.log(P + "HDR|" + new Date(now).toISOString() + "|fields=" + F.length + "/" + allFields.length + "|devices=" + ids.length + "|z=" + z.length + "|chunks=" + chunks + "|part=" + PART + "/" + PARTS);
  for (let j = 0; j < chunks; j++) console.log(P + "Z|" + PART + "|" + j + "|" + z.slice(j * 2400, (j + 1) * 2400));
  console.log(P + "=== ΤΕΛΟΣ part " + PART);
})().catch((e) => console.log(P + "FATAL|" + e.message));
