// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 7/11/2026 · Τι απέγιναν τα όργανα της πύλης 10013732 (εκτός από 4/11): ποια σίγησαν, ποια πέρασαν σε άλλη πύλη, και πόσα πακέτα χάνουν. Δεν γράφει τίποτα, δεν διαβάζει ετικέτες, δεν τυπώνει θέσεις.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "G14|"; const O = "6a98855ca06e41000bfae024"; const NET = "5ede22a7427104001c248b08"; const CODE = "10013732"; const H = 3600000;
const OUT = Date.UTC(2026, 10, 4, 7, 25); const BEFORE_H = 72;
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120)); return j.result; }
const gr = (ms) => { const d = new Date(ms + 2 * H); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
function tally(rows) { const c = {}; for (const r of rows) { const k = String(r.value); c[k] = (c[k] || 0) + 1; } return Object.keys(c).sort((a, b) => c[b] - c[a]).map((k) => k + "×" + c[k]).join(" ") || "-"; }
function maxGap(times, a, b) { const t = [a, ...times.slice().sort((x, y) => x - y), b]; let m = 0; for (let i = 1; i < t.length; i++) m = Math.max(m, t[i] - t[i - 1]); return Math.round(m / H * 10) / 10; }
(async () => {
  const now = Date.now(); console.log(P + "=== " + new Date(now).toISOString());
  const rows = await get(`/device/${O}/data?variables[]=gateway_row&qty=60`); const g = rows.find((r) => String(r.value) === CODE); const gm = (g || {}).metadata || {};
  console.log(P + "ΚΑΡΤΑ|" + (g ? "κατάσταση " + gm.state + "|αισθητήρες " + gm.sensors + "|ηλικία ω " + gm.age_h + "|αγροί " + JSON.stringify((gm.fields || []).map((x) => x.f + ":" + x.k)) : "καμία κάρτα"));
  const st = await get(`/device/${O}/data?variables[]=gateway_heard_state&qty=1`); const h = ((st[0] || {}).metadata || {}).h || {};
  const keys = Object.keys(h).filter((k) => h[k][CODE] !== undefined); console.log(P + "ΜΝΗΜΗ|όργανα με αυτή την πύλη " + keys.length + "|σύνολο μνήμης " + Object.keys(h).length);
  const fieldOf = {}; const map = await get(`/device/${O}/data?variables[]=map_field&qty=130`); const seenF = new Set();
  for (const r of map) { const m = r.metadata || {}; if (seenF.has(m.i)) continue; seenF.add(m.i); for (const d of m.dv || []) { const k = String(d.i).slice(-10); (fieldOf[k] = fieldOf[k] || new Set()).add(String(m.n)); if (d.g === CODE || (d.gs || []).some((x) => x[0] === CODE)) { if (!keys.includes(k)) keys.push(k); } } }
  const devs = []; for (let page = 1; page <= 4; page++) { const c = await get(`/device?amount=200&page=${page}&fields[]=id&fields[]=name&fields[]=last_input&filter[network]=${NET}`); devs.push(...c); if (c.length < 200) break; }
  console.log(P + "ΣΥΣΚΕΥΕΣ ΔΙΚΤΥΟΥ|" + devs.length);
  const t0 = new Date(OUT - BEFORE_H * H).toISOString(), t1 = new Date(now).toISOString(); const beforeDays = BEFORE_H / 24, afterDays = (now - OUT) / (24 * H);
  for (const d of devs.filter((x) => keys.includes(String(x.id).slice(-10)))) {
    const k = String(d.id).slice(-10), li = Date.parse(d.last_input || 0) || 0; const r = await get(`/device/${d.id}/data?variables[]=lrrid&start_date=${t0}&end_date=${t1}&qty=3000`);
    const pre = r.filter((x) => Date.parse(x.time) < OUT), post = r.filter((x) => Date.parse(x.time) >= OUT), onCode = r.filter((x) => String(x.value) === CODE).map((x) => Date.parse(x.time));
    const other = Object.keys(h[k] || {}).filter((c) => c !== CODE).map((c) => c + "@" + gr(h[k][c] * H)).join(" ") || "-"; const fields = [...(fieldOf[k] || [])].join(" + ") || "-";
    console.log(P + "ΟΡΓΑΝΟ|" + String(d.name).slice(-28) + "|αγρός " + fields + "|τελευταία είσοδος " + (li ? gr(li) : "-") + "|σιωπή ω " + (li ? Math.round((now - li) / H * 10) / 10 : "-") + "|τελευταίο από 3732 " + (onCode.length ? gr(Math.max(...onCode)) : "-") + "|πακέτα/ημ πριν " + Math.round(pre.length / beforeDays) + "|μετά " + Math.round(post.length / afterDays) + "|μέγιστο κενό μετά ω " + maxGap(post.map((x) => Date.parse(x.time)), OUT, now) + "|πύλες πριν " + tally(pre) + "|πύλες μετά " + tally(post) + "|μνήμη " + other);
  }
  const silent = devs.filter((d) => { const li = Date.parse(d.last_input || 0) || 0; return li && now - li > 6 * H && now - li < 14 * 24 * H; }).sort((a, b) => Date.parse(a.last_input) - Date.parse(b.last_input));
  for (const d of silent) { const li = Date.parse(d.last_input), k = String(d.id).slice(-10); console.log(P + "ΣΙΩΠΗΛΟ|" + String(d.name).slice(-28) + "|αγρός " + ([...(fieldOf[k] || [])].join(" + ") || "-") + "|τελευταία είσοδος " + gr(li) + "|απόσταση από βλάβη ω " + Math.round((li - OUT) / H * 10) / 10 + "|στη μνήμη 3732 " + (keys.includes(k) ? "ναι" : "όχι")); }
  console.log(P + "ΣΥΝΟΛΟ ΣΙΩΠΗΛΩΝ 6ω–14ημ|" + silent.length); console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
