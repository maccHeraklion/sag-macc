// SAG — PROBE ΑΝΑΓΝΩΣΗΣ · 4/11/2026 · Κοκοφοίνικας: σύγκριση με τις μετρήσεις 3 οργάνων του Michalis. Τελευταίες τιμές σόνδας ανά κανάλι, εύρος 14 ημερών, πιο κοντινό δείγμα στις 4 γραμμές του πίνακα. Δεν γράφει τίποτα.
const TOKEN = process.env.T_ANALYSIS_TOKEN; const API = "https://api.us-e1.tago.io";
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const P = "CM|";
const tag = (d, k) => ((d.tags || []).find((t) => String(t.key).toLowerCase() === k.toLowerCase()) || {}).value;
const ROWS = [[33.7, 18.1, 1.18], [36.6, 18.2, 0.97], [43.8, 18.4, 4.5], [54, 18.3, 3.8]];
(async () => {
  console.log(P + "=== " + new Date().toISOString() + " ===");
  try {
    const fields = await get("/device?filter[tags][0][key]=isField&filter[tags][0][value]=yes&amount=200&fields=id,name,tags");
    const f = fields.find((x) => /Κοκοφοίνικα/.test(tag(x, "name") || x.name));
    let devs = {}; try { devs = JSON.parse(tag(f, "devices") || "{}"); } catch (_e) {}
    let conf = {}; try { conf = JSON.parse(tag(f, "configuration") || "{}"); } catch (_e) {}
    console.log(P + "CONF|" + JSON.stringify({ c: conf.cultivation_type, d: conf.soil_depth_count, ref: conf.soil_ref_device, port: conf.soil_port }));
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    for (const [nm, id] of Object.entries(devs)) {
      let d; try { d = await get(`/device/${id}`); } catch (_e) { continue; }
      const ty = String(tag(d, "type") || "");
      if (!/se0x|lse0/.test(ty)) continue;
      console.log(P + "DEV|" + nm + "|" + ty);
      for (const ch of ["1", "2", ""]) {
        const vn = ch === "" ? ["soil_moisture", "temp_soil", "conduct_soil"] : ["soil_moisture" + ch, "soil_temperature" + ch, "conduct_soil" + ch];
        const S = {};
        for (const v of vn) {
          const rows = await get(`/device/${id}/data?variables=${v}&qty=1500&start_date=${since}&ordination=descending`).catch(() => []);
          S[v] = rows;
        }
        const m = S[vn[0]], t = S[vn[1]], c = S[vn[2]];
        if (!m.length || !c.length) continue;
        const byG = {}; for (const r of t) byG[r.group] = Number(r.value);
        const byC = {}; for (const r of c) byC[r.group] = Number(r.value);
        const al = m.map((r) => ({ t: r.time, m: Number(r.value), T: byG[r.group], c: byC[r.group] })).filter((x) => Number.isFinite(x.c));
        const scale = Math.max(...al.map((x) => x.c)) > 50 ? 1000 : 1;
        const st = (a) => a.length ? Math.min(...a).toFixed(2) + "…" + Math.max(...a).toFixed(2) : "—";
        console.log(P + "CH|" + (ch || "0") + "|n=" + al.length + "|κλίμακα=" + scale + "|υγρασία " + st(al.map((x) => x.m)) + "|EC " + st(al.map((x) => x.c / scale)) + "|θ " + st(al.map((x) => x.T).filter(Number.isFinite)));
        console.log(P + "L|" + al.slice(0, 16).map((x) => String(x.t).slice(5, 16).replace("T", " ") + "=" + x.m + "/" + x.T + "/" + (x.c / scale).toFixed(2)).join(" "));
        ROWS.forEach((R, i) => {
          let best = null, bd = 1e9;
          for (const x of al) { const dd = Math.abs(x.m - R[0]) / 2 + Math.abs(x.c / scale - R[2]) * 3 + (Number.isFinite(x.T) ? Math.abs(x.T - R[1]) : 3); if (dd < bd) { bd = dd; best = x; } }
          console.log(P + "NEAR|γραμμή " + (i + 1) + "|" + R.join("/") + "→" + String(best.t).slice(5, 16) + "=" + best.m + "/" + best.T + "/" + (best.c / scale).toFixed(2) + "|απόσταση=" + bd.toFixed(2));
        });
      }
    }
  } catch (e) { console.log(P + "ERR|" + e.message); }
  console.log(P + "=== ΤΕΛΟΣ ===");
})();
