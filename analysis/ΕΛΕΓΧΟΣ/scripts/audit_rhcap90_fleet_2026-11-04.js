// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Επανάληψη 50 ημερών: κανόνας v50.176 (μετρημένο υγρό φύλλο υπερισχύει RH) έναντι ίδιου κανόνα με όριο RH ≤ 90 για τις ασθένειες υγρού φύλλου (T-RH-CAP-90-01, απόφαση Michalis).
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const EXP = {"wine_grapes":[0,1,3,34,54,55,60,69,70],"table_grapes":[0,1,3,34,54,55,60,69,70],"raisin_grapes":[0,1,34,54,55,60,69,70],"potato":[2,8,46,48,49,53,54,56,67,68,69],"tomato":[2,3,8,16,46,47,49,53,54,56,67,68,69,75],"eggplant":[2,8,16,46,47,49,53,54,56,67,68,69,75],"onion":[3,17,62],"dry_beans":[3,49,54,56,69],"faba_bean":[3,49],"green_beans":[3,49,54,56,69],"lettuce":[3,49,56],"pepper":[3,8,16,46,47,49,53,54,56,67,68,69,75],"strawberry":[3,20,33,46,49,69],"garlic":[3,17,62],"floriculture_generic":[3],"apple":[4,10,54,55,61,69,70,74],"peach":[5,15,54,55,69,70],"nectarine":[5,15,70],"almond":[5,15,70],"koroneiki":[6,7,14,46,50,51,52,57,64,65,66,73],"watermelon":[9,18,46,47,49,54,56,69,75],"cucumber":[9,18,46,47,49,54,56,69,75],"melon":[9,18,46,47,49,54,56,69,75],"zucchini":[9,18,47,49,54,56,69,75],"mastic_tree":[11,12],"rosemary":[13],"sage":[13],"thyme":[13],"oregano":[13],"apricot":[15,55,69,70],"plum":[15,70],"cherry":[15,54,70],"artichoke":[16,46,49],"sugar_beet":[19,48],"carrot":[21,49,56,75],"cabbage":[22,23,49,54,56],"broccoli":[22,23,49,54,56],"mandarin":[24,30,31,55,63,69,71],"orange":[24,30,31,55,63,69,71],"lemon":[24,30,31,55,63,69,71],"wheat":[25,26,27,29,54,58,59],"barley":[26,27,29,54,58,59],"maize":[26,54,58],"oats":[26,29,58,59],"mint":[28,46],"sunflower":[32,46,49],"fig":[35,55],"pistachio":[36,37],"chestnut":[38,39],"saffron":[40],"currants":[41,42],"carob":[43,44],"bay_laurel":[45],"cotton":[46,56,69],"kiwi":[56,69],"walnut":[61,70,72],"tobacco":[67,69],"pomegranate":[69]};
const PROF = [["plasmopara_viticola",10,27,90,8,["wine_grapes","table_grapes","raisin_grapes"]],["phytophthora_infestans",8,25,90,10,["potato","tomato","eggplant"]],["botrytis_cinerea",5,30,92,10,["wine_grapes","table_grapes","onion","dry_beans","faba_bean","green_beans","lettuce","tomato","pepper","strawberry","garlic","floriculture_generic"]],["venturia_inaequalis",6,26,95,9,["apple"]],["taphrina_deformans",8,20,95,12,["peach","nectarine","almond"]],["colletotrichum_oleae",10,25,70,6,["koroneiki"]],["spilocaea_oleagina",5,20,85,18,["koroneiki"]],["alternaria_solani",24,30,85,8,["tomato","potato","pepper","eggplant"]],["neopestalotiopsis_clavispora",12,32,85,12,["mastic_tree"]],["pseudocercospora_cladosporioides",10,25,85,14,["koroneiki"]],["monilinia_spp",5,30,90,12,["peach","nectarine","apricot","plum","cherry","almond"]],["peronospora_destructor",4,22,95,6,["onion","garlic"]],["pseudoperonospora_cubensis",5,30,95,6,["watermelon","cucumber","melon","zucchini"]],["cercospora_beticola",15,35,90,8,["sugar_beet"]],["alternaria_dauci",14,35,90,8,["carrot"]],["brassica_downy_mildew",8,18,95,6,["cabbage","broccoli"]],["brassica_alternaria",16,30,90,8,["cabbage","broccoli"]],["alternaria_alternata_citrus_abs",15,30,90,8,["mandarin","orange","lemon"]],["zymoseptoria_tritici",5,25,95,20,["wheat"]],["fusarium_graminearum",15,30,90,16,["wheat","barley","maize","oats"]],["puccinia_striiformis",2,20,90,6,["wheat","barley"]],["puccinia_menthae",7,28,90,8,["mint"]],["colletotrichum_gloeosporioides",10,32,90,12,["orange","lemon","mandarin"]],["colletotrichum_acutatum",10,32,90,12,["strawberry"]],["phomopsis_viticola",5,30,95,7,["wine_grapes","table_grapes","raisin_grapes"]],["cerotelium_fici",12,30,95,8,["fig"]],["septoria_pistaciarum",8,28,90,10,["pistachio"]],["phytophthora_xcambivora",5,25,95,6,["chestnut"]],["gloeosporidiella_ribis",5,25,90,8,["currants"]],["pseudocercospora_ceratoniae",15,35,90,10,["carob"]],["pestalotiopsis_uvicola",10,30,85,10,["bay_laurel"]],["xanthomonas_arboricola_pv_juglandis",10,30,95,8,["walnut"]]];
const P = "D5|";
const START = "2026-09-15T00:00:00Z";
const AIR = /^(s2120|em300_th|em320_th|em500|ws|weather)/i;
const dp = (T, RH) => { const a = 17.62, b = 243.12, g = Math.log(RH / 100) + a * T / (b + T); return b * g / (a - g); };
const cache = {};
async function series(id, re) {
  const key = id + re; if (cache[key]) return cache[key];
  const names = {}; for (const r of await get(`/device/${id}/data?qty=120&ordination=descending`)) names[r.variable] = 1;
  const out = {};
  for (const v of Object.keys(names).filter((x) => re.test(x))) { const rows = await get(`/device/${id}/data?variables=${v}&qty=10000&start_date=${START}&ordination=ascending`); out[v] = rows.map((r) => [Date.parse(r.time), Number(r.value)]).filter((x) => Number.isFinite(x[1])); }
  return (cache[key] = out);
}
const lastAt = (s, t, max) => { if (!s) return null; let lo = 0, hi = s.length - 1, b = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= t) { b = m; lo = m + 1; } else hi = m - 1; } return b >= 0 && t - s[b][0] <= max ? s[b][1] : null; };
const day = (t) => new Date(t + 2 * 36e5).toISOString().slice(5, 10);
function hours(A, L) {
  const T = A.air_temperature || A.temperature, H = A.air_humidity || A.humidity, LM = L.leaf_moisture, LT = L.leaf_temperature;
  if (!T || !H) return null;
  const t0 = Date.parse(START), t1 = Date.now(), dt = {}, out = [];
  for (let t = t0 + 21 * 6e4; t < t1; t += 36e5) { const a = lastAt(T, t, 54e5), b = lastAt(LT, t, 54e5); if (a != null && b != null) { const d = day(t); dt[d] = Math.max(dt[d] ?? -99, b - a); } }
  for (let t = t0 + 21 * 6e4; t < t1; t += 36e5) {
    const T0 = lastAt(T, t, 54e5), H0 = lastAt(H, t, 54e5), M0 = lastAt(LM, t, 54e5), L0 = lastAt(LT, t, 54e5);
    if (T0 == null || H0 == null) { out.push(null); continue; }
    const d = day(t), D = dp(T0, Math.max(1, H0)), sh = (dt[d] ?? 99) <= 5;
    let wet = false, meas = false;
    if (M0 != null && M0 > 15) { wet = true; meas = true; } else if (L0 != null && sh && L0 <= D + 0.5) { wet = true; meas = true; } else if (M0 != null && sh) wet = false; else if (T0 - 1.5 <= D) wet = true; else if (H0 >= 90) wet = true;
    out.push({ d, T: T0, H: H0, wet, meas });
  }
  return { out, maxH: Math.max(...H.map((x) => x[1])), n: H.length };
}
function sim(hs, p, mode) {
  let run = 0, hi = 0; const days = {};
  for (const h of hs) {
    if (!h) continue;
    const tok = h.T >= p[1] && h.T <= p[2];
    const ok = tok && h.wet && (h.H >= (mode === "B" ? Math.min(p[3], 90) : p[3]) || h.meas);
    run = ok ? run + 1 : 0; if (run > hi) hi = run; if (run >= p[4]) days[h.d] = 1;
  }
  return { hi, days: Object.keys(days).length };
}
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    const nm = tag(f, "name") || f.name;
    try {
      const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1`))[0];
      if (!b || !b.metadata || !b.metadata.data) continue;
      const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
      const sh = o.shared || {}; const inv = String(((sh.device_inventory || {}).metadata || {}).text || "");
      const ty = {}; for (const e of inv.split("|")) { const a = e.split(":"); if (a[0]) ty[a[0]] = a[2] || ""; }
      const ids = Object.keys(sh).filter((k) => k.startsWith("diag_stats__")).map((k) => k.slice(12));
      const airs = ids.filter((i) => AIR.test(ty[i.slice(-6)] || "")), leafs = ids.filter((i) => /lms01/.test(ty[i.slice(-6)] || ""));
      const cov = [], wetP = {};
      for (const cr of o.crops || []) {
        const crop = String(cr.id).split(":")[1]; const ind = {}; for (const k in cr.indicators || {}) ind[dec(k)] = cr.indicators[k];
        const got = Object.keys(ind).filter((k) => k.startsWith("fir_message_")).map((k) => k.slice(12));
        const exp = (EXP[crop] || []).map((i) => PATH[i]);
        const miss = exp.filter((k) => !got.includes(k)), extra = got.filter((k) => !exp.includes(k));
        const un = got.filter((k) => /^Μη/.test(String(val(ind["fir_message_" + k])))).length;
        cov.push(crop + " αναμ=" + exp.length + " εμφ=" + got.length + " μη_διαθ=" + un + (miss.length ? " ΛΕΙΠΟΥΝ=" + miss.join(",") : "") + (extra.length ? " ΕΠΙΠΛΕΟΝ=" + extra.join(",") : ""));
        for (const p of PROF) if (p[5].includes(crop)) wetP[p[0]] = p;
      }
      if (!Object.keys(wetP).length || !airs.length) continue;
      const A = await series(airs[0], /^(temperature|humidity|air_temperature|air_humidity)$/);
      const L = leafs.length ? await series(leafs[0], /^(leaf_moisture|leaf_temperature)$/) : {};
      const hr = hours(A, L); if (!hr) { console.log(P + "RP|" + nm + "|χωρίς σειρές αέρα"); continue; }
      const hs = hr.out; const v = hs.filter(Boolean);
      const r = Object.values(wetP).filter((p) => p[3] > 90).map((p) => { const c = sim(hs, p, "C"), a = sim(hs, p, "B"); return p[0] + "(" + p[3] + "%/" + p[4] + "ω):v50.176 " + c.days + "δ/μέγ" + c.hi + " → όριο90 " + a.days + "δ/μέγ" + a.hi; });
      if (!r.length) continue;
      console.log(P + "RP|" + nm + "|" + ty[airs[0].slice(-6)] + "|ώρες=" + v.length + "|maxRH=" + hr.maxH + "|RH≥90=" + v.filter((h) => h.H >= 90).length + "|RH≥95=" + v.filter((h) => h.H >= 95).length + "|υγρό=" + v.filter((h) => h.wet).length + "|μετρημένο=" + v.filter((h) => h.meas).length + "|" + r.join(" ; "));
    } catch (e) { console.log(P + "ERR|" + nm + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
