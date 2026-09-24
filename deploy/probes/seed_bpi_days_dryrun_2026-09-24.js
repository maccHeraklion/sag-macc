// SAG — ΣΠΟΡΑ bpi_total_days (T-BPI-DAYS-01, v50.151) · 24/9/2026 · Michalis
// Για κάθε αγρό (isField=yes) και κάθε καλλιέργεια που έχει ΗΔΗ bpi_total_actual αλλά ΟΧΙ
// bpi_total_days: μετρά πόσες ΔΙΑΚΡΙΤΕΣ ημερήσιες τιμές έχει το bpi_total_actual στο ιστορικό
// (1 σημείο ανά ~20 ώρες, προς τα πίσω, μέχρι να λείψει ή να «ξαναρχίσει») και σπέρνει τον
// αριθμό ως bpi_total_days στο ΤΡΕΧΟΝ bundle (νέο σημείο field_bundle, ίδια bytes + 1 κλειδί).
// DRY_RUN=true: μόνο ανάγνωση και αναφορά. Καμία αλλαγή σε κανένα άλλο κλειδί.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const DRY_RUN = true;
const STEP = 20;        // σημεία bundle ανά βήμα (≈20 ώρες σε ωριαίο ρυθμό)
const MAX_STEPS = 110;  // ≈ 90 ημέρες
const ONLY = null;      // π.χ. "ΚΟΥΤΣΑΚΗΣ" για δοκιμή σε έναν αγρό

async function api(path, opts = {}) {
  const headers = { Authorization: TOKEN, "Content-Type": "application/json" };
  const r = await fetch(API + path, { ...opts, headers });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 200));
  return j.result;
}
async function listFields() {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const rows = await api(`/device?page=${page}&amount=200&fields[]=id&fields[]=name&fields[]=tags`);
    if (!Array.isArray(rows) || !rows.length) break;
    for (const d of rows) if ((d.tags || []).some(t => t.key === "isField" && t.value === "yes")) out.push({ id: d.id, name: d.name });
    if (rows.length < 200) break;
  }
  return out;
}
const unwrap = (v) => (v && typeof v === "object" && "value" in v) ? v.value : v;
function decode(meta) {
  if (!meta || !meta.data || !meta.schema || meta.schema.compression !== "deflate-raw-base64") return null;
  return JSON.parse(zlib.inflateRawSync(Buffer.from(meta.data, "base64")).toString("utf8"));
}
function encode(obj) { return zlib.deflateRawSync(Buffer.from(JSON.stringify(obj), "utf8")).toString("base64"); }
async function bundleAt(id, skip) {
  const rows = await api(`/device/${id}/data?variables=field_bundle&qty=1${skip ? "&skip=" + skip : ""}`);
  const p = Array.isArray(rows) ? rows[0] : null;
  return p ? { time: p.time, meta: p.metadata, obj: decode(p.metadata) } : null;
}
function cropTotals(obj) {
  const out = [];
  for (const c of (obj && Array.isArray(obj.crops) ? obj.crops : [])) {
    const ind = (c && c.indicators) || {};
    const a = Number(unwrap(ind.bpi_total_actual)), p = Number(unwrap(ind.bpi_total_potential));
    const dRaw = unwrap(ind.bpi_total_days);
    out.push({ id: c.id, type: c.cultivation_type, actual: Number.isFinite(a) ? a : null,
      potential: Number.isFinite(p) ? p : null, days: Number.isFinite(Number(dRaw)) ? Number(dRaw) : null });
  }
  return out;
}

(async () => {
  console.log(`=== ΣΠΟΡΑ bpi_total_days · ${DRY_RUN ? "DRY RUN (μόνο ανάγνωση)" : "ΕΓΓΡΑΦΗ"} · ${new Date().toISOString()} ===`);
  const fields = await listFields();
  console.log(`ΑΓΡΟΙ isField=yes: ${fields.length}`);
  if (!fields.length) { console.log("STOP|κανένας αγρός — ο έλεγχος είναι ΑΚΥΡΟΣ, όχι αρνητικός"); return; }
  let reads = 0, seeded = 0, skippedHave = 0, noTotals = 0;
  // Δοκιμή: σέβεται η διαδρομή το skip; (πρώτος αγρός με bundle)
  let skipTested = false;
  for (const f of fields) {
    if (ONLY && String(f.name).indexOf(ONLY) < 0) continue;
    try {
      const cur = await bundleAt(f.id, 0); reads++;
      if (!cur || !cur.obj) { console.log(`ΧΩΡΙΣ BUNDLE|${f.name}`); continue; }
      if (!skipTested) {
        const t24 = await bundleAt(f.id, 24); reads++;
        console.log(`SKIP-TEST|${f.name}|skip=0 → ${cur.time}|skip=24 → ${t24 ? t24.time : "—"}`);
        skipTested = true;
      }
      const totals = cropTotals(cur.obj);
      const todo = totals.filter(t => t.actual !== null && t.days === null);
      const have = totals.filter(t => t.actual !== null && t.days !== null);
      skippedHave += have.length;
      if (!todo.length) { if (!totals.some(t => t.actual !== null)) noTotals++; continue; }
      // Μέτρηση ημερών ανά καλλιέργεια, με ένα κοινό πέρασμα προς τα πίσω
      const last = {}, distinct = {}, stopped = {};
      for (const t of todo) { last[t.id] = t.actual; distinct[t.id] = 1; stopped[t.id] = false; }
      let steps = 0;
      for (let s = 1; s <= MAX_STEPS; s++) {
        if (todo.every(t => stopped[t.id])) break;
        const b = await bundleAt(f.id, s * STEP); reads++; steps++;
        if (!b || !b.obj) { for (const t of todo) stopped[t.id] = true; break; }
        const past = cropTotals(b.obj);
        for (const t of todo) {
          if (stopped[t.id]) continue;
          const pc = past.find(x => x.id === t.id);
          if (!pc || pc.actual === null) { stopped[t.id] = true; continue; }
          if (pc.actual > last[t.id] + 1e-9) { stopped[t.id] = true; continue; }   // παλιότερη τιμή ΜΕΓΑΛΥΤΕΡΗ = επανεκκίνηση
          if (Math.abs(pc.actual - last[t.id]) > 1e-9) { distinct[t.id]++; last[t.id] = pc.actual; }
        }
      }
      for (const t of todo) {
        console.log(`SEED|${f.name}|${t.type || t.id}|actual=${t.actual}|potential=${t.potential}|ημέρες=${distinct[t.id]}|βήματα=${steps}`);
      }
      if (!DRY_RUN) {
        const obj = cur.obj;
        const nowMin = Math.floor(Date.now() / 60000);
        let changed = 0;
        for (const c of obj.crops) {
          const t = todo.find(x => x.id === c.id); if (!t) continue;
          c.indicators.bpi_total_days = { value: distinct[t.id], metadata: { _t: nowMin } };
          changed++;
        }
        if (changed) {
          const data = encode(obj);
          const meta = Object.assign({}, cur.meta, { data });
          await api(`/device/${f.id}/data`, { method: "POST",
            body: JSON.stringify([{ variable: "field_bundle", value: 1, metadata: meta }]) });
          // επαλήθευση: ξαναδιάβασε το τελευταίο
          const chk = await bundleAt(f.id, 0); reads++;
          const ct = chk && chk.obj ? cropTotals(chk.obj) : [];
          const okAll = todo.every(t => { const x = ct.find(y => y.id === t.id); return x && x.days === distinct[t.id]; });
          console.log(`${okAll ? "OK" : "FAIL"}|ΓΡΑΦΤΗΚΕ|${f.name}|${changed} καλλιέργειες|bytes=${data.length}|μετά: ${ct.map(x => (x.type || x.id) + "=" + x.days).join(",")}`);
          if (okAll) seeded += changed;
        }
      }
    } catch (e) { console.log(`ERR|${f.name}|${e.message}`); }
  }
  console.log(`=== ΤΕΛΟΣ · αναγνώσεις=${reads} · είχαν ήδη ημέρες=${skippedHave} · χωρίς σύνολα=${noTotals} · ${DRY_RUN ? "ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΤΗΚΕ" : "σπάρθηκαν=" + seeded} ===`);
})();
