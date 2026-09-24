// SAG — ΣΠΟΡΑ bpi_total_days / bpi_total_since / bpi_total_days_floor (T-BPI-SINCE-01, v50.152) · 24/9/2026 · Michalis
// Ομάδα Α (η αρχή βρέθηκε μέσα στο ιστορικό): days=N, since=σήμερα−(N−1) ημέρες (τοπική ημερομηνία).
// Ομάδα Β (το ιστορικό τελειώνει πριν την αρχή): days=N (κάτω όριο), floor=1, ΧΩΡΙΣ since.
// Μόνο το ΤΡΕΧΟΝ bundle ξαναγράφεται ως νέο σημείο field_bundle με +2/3 κλειδιά· τίποτα άλλο δεν αλλάζει.
const zlib = require("zlib");
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const DRY_RUN = false;
const STEP = 20, MAX_STEPS = 110;
const ONLY = null;
const TZ_OFFSET_H = 3;   // Europe/Athens τον Σεπτέμβριο (EEST) — μόνο για την ημερομηνία αρχής της ομάδας Α

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
    const a = Number(unwrap(ind.bpi_total_actual));
    out.push({ id: c.id, type: c.cultivation_type, actual: Number.isFinite(a) ? a : null,
      days: Number.isFinite(Number(unwrap(ind.bpi_total_days))) ? Number(unwrap(ind.bpi_total_days)) : null,
      since: unwrap(ind.bpi_total_since) || null, floor: Number(unwrap(ind.bpi_total_days_floor)) === 1 });
  }
  return out;
}
const localISO = (ms) => new Date(ms + TZ_OFFSET_H * 3600e3).toISOString().slice(0, 10);

(async () => {
  console.log(`=== ΣΠΟΡΑ v2 · ${DRY_RUN ? "DRY RUN" : "ΕΓΓΡΑΦΗ"} · ${new Date().toISOString()} ===`);
  const fields = await listFields();
  console.log(`ΑΓΡΟΙ isField=yes: ${fields.length}`);
  if (!fields.length) { console.log("STOP|κανένας αγρός — ΑΚΥΡΟΣ έλεγχος"); return; }
  let reads = 0, seeded = 0, have = 0, fails = 0;
  for (const f of fields) {
    if (ONLY && String(f.name).indexOf(ONLY) < 0) continue;
    try {
      const cur = await bundleAt(f.id, 0); reads++;
      if (!cur || !cur.obj) continue;
      const totals = cropTotals(cur.obj);
      const todo = totals.filter(t => t.actual !== null && t.days === null);
      have += totals.filter(t => t.actual !== null && t.days !== null).length;
      if (!todo.length) continue;
      const last = {}, distinct = {}, stopped = {}, reason = {};
      for (const t of todo) { last[t.id] = t.actual; distinct[t.id] = 1; stopped[t.id] = false; reason[t.id] = "max"; }
      for (let s = 1; s <= MAX_STEPS; s++) {
        if (todo.every(t => stopped[t.id])) break;
        const b = await bundleAt(f.id, s * STEP); reads++;
        if (!b || !b.obj) { for (const t of todo) if (!stopped[t.id]) { stopped[t.id] = true; reason[t.id] = "end"; } break; }
        const past = cropTotals(b.obj);
        for (const t of todo) {
          if (stopped[t.id]) continue;
          const pc = past.find(x => x.id === t.id);
          if (!pc || pc.actual === null) { stopped[t.id] = true; reason[t.id] = "absent"; continue; }
          if (pc.actual > last[t.id] + 1e-9) { stopped[t.id] = true; reason[t.id] = "reset"; continue; }
          if (Math.abs(pc.actual - last[t.id]) > 1e-9) { distinct[t.id]++; last[t.id] = pc.actual; }
        }
      }
      const nowMin = Math.floor(Date.now() / 60000);
      const plan = todo.map(t => {
        const floor = reason[t.id] === "end" || reason[t.id] === "max";
        const since = floor ? null : localISO(Date.now() - (distinct[t.id] - 1) * 86400e3);
        return { t, days: distinct[t.id], floor, since };
      });
      for (const p of plan) console.log(`PLAN|${f.name}|${p.t.type || p.t.id}|ημέρες=${p.days}|${p.floor ? "ΤΟΥΛΑΧΙΣΤΟΝ (ιστορικό τελειώνει)" : "από " + p.since}|λόγος=${reason[p.t.id]}`);
      if (DRY_RUN) continue;
      const obj = cur.obj; let changed = 0;
      for (const c of obj.crops) {
        const p = plan.find(x => x.t.id === c.id); if (!p) continue;
        c.indicators.bpi_total_days = { value: p.days, metadata: { _t: nowMin } };
        if (p.floor) c.indicators.bpi_total_days_floor = { value: 1, metadata: { _t: nowMin } };
        else c.indicators.bpi_total_since = { value: p.since, metadata: { _t: nowMin } };
        changed++;
      }
      const data = encode(obj);
      const meta = Object.assign({}, cur.meta, { data });
      await api(`/device/${f.id}/data`, { method: "POST", body: JSON.stringify([{ variable: "field_bundle", value: 1, metadata: meta }]) });
      const chk = await bundleAt(f.id, 0); reads++;
      const ct = chk && chk.obj ? cropTotals(chk.obj) : [];
      const okAll = plan.every(p => { const x = ct.find(y => y.id === p.t.id); return x && x.days === p.days && x.floor === p.floor && (p.floor ? !x.since : x.since === p.since); });
      console.log(`${okAll ? "OK" : "FAIL"}|ΓΡΑΦΤΗΚΕ|${f.name}|${changed} καλλ.|bytes=${data.length}|μετά: ${ct.filter(x => x.actual !== null).map(x => (x.type || x.id) + "=" + x.days + (x.floor ? "≥" : "") + (x.since ? "@" + x.since : "")).join(",")}`);
      if (okAll) seeded += changed; else fails++;
    } catch (e) { console.log(`ERR|${f.name}|${e.message}`); fails++; }
  }
  console.log(`=== ΤΕΛΟΣ · αναγνώσεις=${reads} · είχαν ήδη=${have} · ${DRY_RUN ? "ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΤΗΚΕ" : "σπάρθηκαν=" + seeded + " · αποτυχίες=" + fails} ===`);
})();
