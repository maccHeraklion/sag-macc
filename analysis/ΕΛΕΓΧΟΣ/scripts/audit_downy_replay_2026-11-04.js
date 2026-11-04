// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Περονόσπορος: επανάληψη ώρα προς ώρα 50 ημερών (Κουτσάκης, Γρινιαράκης) και ημερήσιοι μετρητές ασθενειών στόλου.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
const PATH = ["plasmopara_viticola", "erysiphe_necator", "phytophthora_infestans", "botrytis_cinerea", "venturia_inaequalis", "taphrina_deformans", "colletotrichum_oleae", "spilocaea_oleagina", "alternaria_solani", "podosphaera_xanthii", "oidium_farinosum", "phytophthora_niederhauserii", "neopestalotiopsis_clavispora", "phytophthora_pythium_root_rot_herbs", "pseudocercospora_cladosporioides", "monilinia_spp", "leveillula_taurica", "peronospora_destructor", "pseudoperonospora_cubensis", "cercospora_beticola", "podosphaera_aphanis", "alternaria_dauci", "brassica_downy_mildew", "brassica_alternaria", "alternaria_alternata_citrus_abs", "zymoseptoria_tritici", "fusarium_graminearum", "puccinia_striiformis", "puccinia_menthae", "blumeria_graminis", "phytophthora_citrophthora", "colletotrichum_gloeosporioides", "plasmopara_halstedii", "colletotrichum_acutatum", "phomopsis_viticola", "cerotelium_fici", "botryosphaeria_panicle_shoot_blight", "septoria_pistaciarum", "cryphonectria_parasitica", "phytophthora_xcambivora", "fusarium_spp_corm_rot", "podosphaera_mors_uvae", "gloeosporidiella_ribis", "pseudoidium_ceratoniae", "pseudocercospora_ceratoniae", "pestalotiopsis_uvicola", "verticillium_dahliae", "phytophthora_capsici", "rhizoctonia_solani", "sclerotinia_sclerotiorum", "bactrocera_oleae", "prays_oleae", "palpita_unionalis", "tuta_absoluta", "myzus_persicae", "ceratitis_capitata", "bemisia_tabaci", "rhynchites_cribripennis", "rhopalosiphum_padi", "sitobion_avenae", "lobesia_botrana", "cydia_pomonella", "thrips_tabaci", "phyllocnistis_citrella", "euphyllura_phillyreae", "saissetia_oleae", "parlatoria_oleae", "phthorimaea_operculella", "leptinotarsa_decemlineata", "tetranychus_urticae", "panonychus_ulmi", "panonychus_citri", "xanthomonas_arboricola_pv_juglandis", "pseudomonas_savastanoi", "erwinia_amylovora", "meloidogyne_incognita"];
const PRE = ['infection_hours_counter_max_','infection_hours_counter_','nematode_dd_accumulated_','nematode_generation_index_','dh_accumulated_','gdd_accumulated_','gdd_daily_','gdd_hourly_','fir_message_','fir_','pei_','case_','last_spray_','spray_protection_end_','inspection_clean_','soilhist_','gdd_seeded_'];
const dec = (k) => { if (!/^[a-z][0-9][0-9]$/.test(k)) return k; const p = PRE[k.charCodeAt(0) - 97], n = PATH[Number(k.slice(1))]; return p && n ? p + n : k; };
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);
const P = "D3|";
const START = "2026-09-15T00:00:00Z";
const REPLAY = [
  { n: "ΚΟΥΤΣΑΚΗΣ", air: "69779a27a6e2fb0011490969", leaf: "67fe9ae85fccdd000a4bdd42", tmin: 5, tmax: 30, rh: 95, req: 6 },
  { n: "ΓΡΙΝΙΑΡΑΚΗΣ", air: "69f1c7b866cc6a00090edc9e", leaf: "69f85a0fb313c5000901d994", tmin: 8, tmax: 25, rh: 90, req: 10 },
];
const dp = (T, RH) => { const a = 17.62, b = 243.12, g = Math.log(RH / 100) + a * T / (b + T); return b * g / (a - g); };
async function series(id, re) {
  const names = {}; for (const r of await get(`/device/${id}/data?qty=120&ordination=descending`)) names[r.variable] = 1;
  const pick = Object.keys(names).filter((v) => re.test(v));
  const out = {};
  for (const v of pick) { const rows = await get(`/device/${id}/data?variables=${v}&qty=10000&start_date=${START}&ordination=ascending`); out[v] = rows.map((r) => [Date.parse(r.time), Number(r.value)]).filter((x) => Number.isFinite(x[1])); }
  return { names: Object.keys(names), out };
}
const lastAt = (s, t, max) => { if (!s) return null; let lo = 0, hi = s.length - 1, b = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (s[m][0] <= t) { b = m; lo = m + 1; } else hi = m - 1; } return b >= 0 && t - s[b][0] <= max ? s[b][1] : null; };
const day = (t) => new Date(t + 2 * 36e5).toISOString().slice(5, 10);
function replay(cfg, A, L) {
  const T = A.temperature || A.air_temperature, H = A.humidity || A.air_humidity, LM = L.leaf_moisture, LT = L.leaf_temperature;
  const c = { h: 0, rh85: 0, rh90: 0, rh95: 0, wet: 0, wetrh: 0, wetNoRh: 0, tok: 0 }; const hist = {};
  const V = { cur: 0, wet: 0, wetOr: 0, rh90: 0, rh85: 0, wet1: 0 }; const runs = {}; const wetDays = {};
  const t0 = Date.parse(START), t1 = Date.now(); const dt = {}; let miss = 0; let gap1 = 0;
  for (let t = t0 + 21 * 6e4; t < t1; t += 36e5) { const T0 = lastAt(T, t, 54e5), L0 = lastAt(LT, t, 54e5); if (T0 != null && L0 != null) { const d = day(t); dt[d] = Math.max(dt[d] ?? -99, L0 - T0); } }
  for (let t = t0 + 21 * 6e4; t < t1; t += 36e5) {
    const T0 = lastAt(T, t, 54e5), H0 = lastAt(H, t, 54e5), M0 = lastAt(LM, t, 54e5), L0 = lastAt(LT, t, 54e5);
    if (T0 == null || H0 == null) { miss++; continue; }
    c.h++; const d = day(t); const b = Math.min(100, Math.floor(H0 / 5) * 5); hist[b] = (hist[b] || 0) + 1;
    const D = dp(T0, Math.max(1, H0)); const sh = (dt[d] ?? 99) <= 5;
    let wet;
    if (M0 != null && M0 > 15) wet = true; else if (L0 != null && sh && L0 <= D + 0.5) wet = true; else if (M0 != null && sh) wet = false; else if (T0 - 1.5 <= D) wet = true; else if (H0 >= 90) wet = true; else wet = false;
    const tok = T0 >= cfg.tmin && T0 <= cfg.tmax;
    if (tok) c.tok++; if (H0 >= 85) c.rh85++; if (H0 >= 90) c.rh90++; if (H0 >= 95) c.rh95++;
    if (wet) { c.wet++; wetDays[d] = (wetDays[d] || 0) + 1; if (H0 >= cfg.rh) c.wetrh++; else c.wetNoRh++; }
    const step = (k, ok) => { V[k] = ok ? V[k] + 1 : 0; const r = (runs[k] = runs[k] || { max: 0, days: {} }); if (V[k] > r.max) r.max = V[k]; if (V[k] >= cfg.req) r.days[d] = 1; };
    step("cur", tok && H0 >= cfg.rh && wet); step("wet", tok && wet); step("wetOr", tok && (wet || H0 >= cfg.rh)); step("rh90", tok && H0 >= 90); step("rh85", tok && H0 >= 85);
    if (tok && wet) { V.wet1++; gap1 = 0; } else if (gap1 < 1 && V.wet1 > 0) gap1++; else { V.wet1 = 0; gap1 = 0; }
    const r1 = (runs.wet1 = runs.wet1 || { max: 0, days: {} }); if (V.wet1 > r1.max) r1.max = V.wet1; if (V.wet1 >= cfg.req) r1.days[d] = 1;
  }
  console.log(P + cfg.n + "|ΣΗΜΕΙΑ|T=" + (T || []).length + " H=" + (H || []).length + " LM=" + (LM ? LM.length : 0) + " LT=" + (LT ? LT.length : 0) + "|χωρίς_μέτρηση_ώρες=" + miss + "|από=" + (T && T[0] ? new Date(T[0][0]).toISOString().slice(0, 16) : "-") + "|έως=" + (T && T.length ? new Date(T[T.length - 1][0]).toISOString().slice(0, 16) : "-"));
  console.log(P + cfg.n + "|ΩΡΕΣ|" + JSON.stringify(c) + "|maxRH=" + Math.max(...H.map((x) => x[1])) + "|RHbins=" + JSON.stringify(hist) + "|LMmax=" + (LM ? Math.max(...LM.map((x) => x[1])) : null));
  for (const k of Object.keys(runs)) console.log(P + cfg.n + "|ΣΕΝΑΡΙΟ|" + k + "|μέγ_συνεχόμενες=" + runs[k].max + "|ημέρες_≥" + cfg.req + "ω=" + Object.keys(runs[k].days).length + "|" + Object.keys(runs[k].days).join(",").slice(0, 300));
  console.log(P + cfg.n + "|ΥΓΡΕΣ_ΩΡΕΣ_ΑΝΑ_ΗΜΕΡΑ|" + Object.entries(wetDays).map(([a, b]) => a + "=" + b).join(" ").slice(0, 900));
}
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  for (const cfg of REPLAY) {
    try {
      const a = await series(cfg.air, /^(temperature|humidity|air_temperature|air_humidity)$/);
      const l = await series(cfg.leaf, /^(leaf_moisture|leaf_temperature)$/);
      console.log(P + cfg.n + "|ΜΕΤΑΒΛΗΤΕΣ|αέρας=" + a.names.filter((x) => /temp|hum|dew/i.test(x)).join(",") + "|φύλλο=" + l.names.filter((x) => /leaf|temp|hum|moist/i.test(x)).join(","));
      replay(cfg, a.out, l.out);
    } catch (e) { console.log(P + cfg.n + "|ERR|" + e.message); }
  }
  const HOST = /cucumber|melon|watermelon|zucchini|tomato|potato|eggplant|grapes/;
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    let c = {}; try { c = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
    const Ls = Array.isArray(c.crops) && c.crops.length ? c.crops : [c];
    if (!Ls.some((x) => HOST.test(String(x.cultivation_type)))) continue;
    const nm = tag(f, "name") || f.name; const agg = {}; let days = 0; const wetH = [];
    const ds = []; for (let d = 1; d <= 50; d++) ds.push(new Date(Date.now() - d * 864e5).toISOString().slice(0, 10));
    for (let i = 0; i < ds.length; i += 10) {
      await Promise.all(ds.slice(i, i + 10).map(async (dd) => {
        try {
          const b = (await get(`/device/${f.id}/data?variables=field_bundle&qty=1&start_date=${dd}T20:00:00Z&end_date=${dd}T21:00:00Z`))[0];
          if (!b || !b.metadata || !b.metadata.data) return; days++;
          const o = JSON.parse(zlib.inflateRawSync(Buffer.from(String(b.metadata.data), "base64")).toString("utf8"));
          for (const cr of o.crops || []) {
            const ind = {}; for (const k in cr.indicators || {}) ind[dec(k)] = cr.indicators[k];
            const w = Number(val(ind.leaf_wet_hours_today)); if (Number.isFinite(w)) wetH.push(w);
            for (const k of Object.keys(ind)) if (k.startsWith("infection_hours_counter_max_")) { const n = k.slice(28), v = Number(val(ind[k])) || 0; const key = String(cr.id).split(":")[1] + "/" + n; const a = (agg[key] = agg[key] || { hi: 0, d6: 0, d1: 0 }); a.hi = Math.max(a.hi, v); if (v >= 6) a.d6++; if (v >= 1) a.d1++; }
          }
        } catch (_e) {}
      }));
    }
    console.log(P + "ΣΤΟΛΟΣ|" + nm + "|ημέρες=" + days + "|cov=" + c.covered_cultivation + "|υγρές_ώρες_μέση=" + (wetH.length ? (wetH.reduce((x, y) => x + y, 0) / wetH.length).toFixed(1) : "-") + "|" + Object.entries(agg).map(([k, a]) => k + ":" + a.hi + "/" + a.d1 + "/" + a.d6).join(" ; ").slice(0, 700));
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
