// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 6/11/2026 · Δεύτερος έλεγχος αλγορίθμων ασθενειών: τι κάνει ΣΤΗΝ ΠΡΑΞΗ ο πυρήνας.
// (α) Στόλος τώρα: ανά αγρό/καλλιέργεια IPSI, HS (από το pathogen_hs_basis), πλήθος καρτών ανά βαθμίδα, ανοιχτές υποθέσεις και ηλικία.
// (β) Ιστορικό bundle 14 ημερών σε 4 αγρούς: ανά ώρα η ΠΗΓΗ διαβροχής που αποφάσισε ο πυρήνας, οι υγρές ώρες ημέρας και ο ψηλότερος
//     μετρητής ωρών μόλυνσης — για να συγκριθεί με την προσομοίωση από τα ωμά δείγματα (έκθεση ΥΓΡΟ_ΦΥΛΛΟ…2026-11-06).
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "RL6|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const unpack = (b) => JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
const SRC = { "Βροχή": "R", "Αισθητήρας φύλλου": "S", "Δρόσος (θερμ. φύλλου)": "L", "Δρόσος (εκτίμηση)": "A", "Σχετική υγρασία": "H", "Στεγνό": "n", "Αισθητήρας φύλλου (στεγνό)": "d", "Στεγνό (αβέβαιο)": "u" };
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const now = Date.now();
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  const hist = [];
  const tot = { lv: {}, open: 0, openOld: 0, hs: [] };
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name);
    if (/Ρηγάκη|Πανταλού|ΚΟΥΤΣΑΚ|ΓΡΙΝΙΑΡ/i.test(nm)) hist.push({ f, nm });
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0]; if (!b || !b.metadata || !b.metadata.data) continue;
      const ageH = (now - Date.parse(b.time)) / 3600000; if (ageH > 3) continue;
      const o = unpack(b);
      for (const cr of o.crops || []) {
        const ind = {}; for (const k in cr.indicators || {}) ind[dec(k)] = cr.indicators[k];
        const lv = {}; const open = [];
        for (const k of Object.keys(ind)) {
          if (k.startsWith("fir_message_")) { const w = String(val(ind[k])).split(" ")[0]; lv[w] = (lv[w] || 0) + 1; tot.lv[w] = (tot.lv[w] || 0) + 1; }
          if (k.startsWith("case_")) { try { const c = JSON.parse(String(val(ind[k]))); if (c && c.s === "open") { const d = Math.round((now - Number(c.o) * 60000) / 86400000); open.push(k.slice(5).split("_")[0].slice(0, 6) + ":" + d + "η"); tot.open++; if (d >= 10) tot.openOld++; } } catch (e) { /* όχι JSON */ } }
        }
        const hb = ind.pathogen_hs_basis; const ht = hb && hb.metadata && hb.metadata.text ? String(hb.metadata.text) : ""; const hs = (/HS ([0-9.,]+)/.exec(ht) || [])[1];
        if (hs) tot.hs.push(Number(String(hs).replace(",", ".")));
        console.log(P + "F|" + nm.slice(0, 22) + "/" + String(cr.id).split(":")[1] + "|ipsi=" + val(ind.ipsi) + "|HS=" + (hs || "-") + "(" + val(hb) + ")|" + Object.entries(lv).map(([k, v]) => k.slice(0, 4) + v).join(" ") + "|ανοιχτές=" + open.length + (open.length ? " " + open.join(",") : ""));
      }
    } catch (e) { console.log(P + "ERR|" + nm + "|" + e.message); }
  }
  tot.hs.sort((a, b) => a - b);
  console.log(P + "ΣΥΝΟΛΑ|βαθμίδες=" + JSON.stringify(tot.lv) + "|ανοιχτές υποθέσεις=" + tot.open + "|από αυτές ≥10 ημερών=" + tot.openOld + "|HS n=" + tot.hs.length + " min=" + tot.hs[0] + " διάμεσος=" + tot.hs[tot.hs.length >> 1] + " max=" + tot.hs[tot.hs.length - 1] + "|HS≥1.5: " + tot.hs.filter((x) => x >= 1.5).length + "|HS≥2.5: " + tot.hs.filter((x) => x >= 2.5).length);
  for (const h of hist) {
    try {
      const rows = await get(`/device/${h.f.id}/data?variables=field_bundle&qty=345`);
      const out = [];
      for (const b of rows) { try { const o = unpack(b); const cr = (o.crops || [])[0] || {}; const ind = {}; for (const k in cr.indicators || {}) ind[dec(k)] = cr.indicators[k];
        let mx = 0, mk = ""; for (const k of Object.keys(ind)) { if (k.startsWith("infection_hours_counter_") && !k.startsWith("infection_hours_counter_max_")) { const v = Number(val(ind[k])) || 0; if (v > mx) { mx = v; mk = k.slice(24, 34); } }
        }
        const s = String(val(ind.leaf_wetness_source)); out.push(String(b.time).slice(5, 13).replace("T", " ") + "," + (SRC[s] || "?") + "," + val(ind.leaf_wet_hours_today) + "," + mx + "," + mk + "," + val(ind.leaf_moisture_max_today)); } catch (e) { out.push(String(b.time).slice(5, 13) + ",ERR"); } }
      const z = zlib.deflateRawSync(Buffer.from(out.join(";"), "utf8")).toString("base64");
      console.log(P + "H|" + h.nm + "|rows=" + out.length + "|z=" + z.length);
      for (let k = 0, j = 0; k < z.length; k += 2400, j++) console.log(P + "Z|" + h.nm.slice(0, 8) + "|" + j + "|" + z.slice(k, k + 2400));
    } catch (e) { console.log(P + "ERR|hist " + h.nm + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
