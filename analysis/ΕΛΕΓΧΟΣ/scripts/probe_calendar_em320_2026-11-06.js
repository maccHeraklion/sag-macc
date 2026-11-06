// SAG — PROBE ΑΝΑΓΝΩΣΗΣ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · 6/11/2026 · (α) ημερολόγιο Κουτσάκη/Γρινιαράκη από 15/10 (δηλωμένοι ψεκασμοί
// έναντι των απότομων διαβροχών 16–17 ω)· (β) τι μεταβλητές στέλνουν τα em320_3552 και em320_2647 (Β1, Β4).
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io"; const P = "CAL6|";
async function get(path) { const r = await fetch(API + path, { headers: { Authorization: TOKEN } }); const j = await r.json().catch(() => ({})); if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140)); return j.result; }
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
(async () => {
  console.log(P + "=== " + new Date().toISOString());
  const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
  for (const f of fields) {
    const nm = String(tag(f, "name") || f.name);
    if (!/ΚΟΥΤΣΑΚ|ΓΡΙΝΙΑΡ/i.test(nm)) continue;
    try {
      const r = await get(`/device/${f.id}/data?variable=field_calendar&start_date=2026-10-15T00:00:00Z&qty=60&ordination=ascending`);
      console.log(P + "CAL|" + nm + "|εγγραφές=" + r.length);
      for (const e of r) { const m = e.metadata || {}; console.log(P + "E|" + nm.slice(0, 12) + "|γράφτηκε " + String(e.time).slice(0, 16) + "|ημ/νία " + String(m.datetimeISO || "").slice(0, 16) + "|" + String(e.value).slice(0, 160)); }
    } catch (e) { console.log(P + "ERR|" + nm + "|" + e.message); }
  }
  for (const n of ["em320_3552", "em320_2647"]) {
    try {
      const ds = await get(`/device?filter[name]=*${n}*&amount=5&fields=id,name,last_input`);
      for (const d of ds) {
        const r = await get(`/device/${d.id}/data?qty=60`);
        const vars = {}; for (const e of r) { if (!vars[e.variable]) vars[e.variable] = String(e.time).slice(0, 16) + "=" + String(e.value).slice(0, 12); }
        console.log(P + "DEV|" + d.name + "|last_input=" + String(d.last_input).slice(0, 16) + "|" + Object.entries(vars).map(([k, v]) => k + "@" + v).join(" ; ").slice(0, 900));
      }
    } catch (e) { console.log(P + "ERR|" + n + "|" + e.message); }
  }
  console.log(P + "=== ΤΕΛΟΣ");
})().catch((e) => console.log(P + "FATAL|" + e.message));
