// SAG — ΜΟΝΟ ΑΝΑΓΝΩΣΗ · 19/10/2026 · δύο δουλειές, ΤΙΠΟΤΑ δεν γράφεται:
// (Α) ΕΠ4: επαλήθευση T-GWID-03 στους SE0X/SE01 — πακέτα μετά τις 17:44:33 UTC: lrrid με location, 0 parse_error,
//     ίδιο πλήθος εγγραφών με το προηγούμενο πακέτο της ίδιας συσκευής.
// (Β) ΑΥ: απογραφή πεδίων ανά connector — για κάθε connector, η πιο πρόσφατα ενεργή συσκευή: ποιες μεταβλητές γράφει
//     κάθε πακέτο, πόσες ενεργές συσκευές (24 ω) και διάστημα μεταξύ πακέτων. Η ταξινόμηση «άχρηστο» γίνεται ΕΚΤΟΣ TagoIO.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
const SINCE = Date.parse("2026-10-19T17:44:33Z");
const GW = ["685bafd351843b000ad23a36", "69293aaf4da767000a1cc2f1"];
async function api(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(p.slice(0, 60) + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
const packets = (rows) => {
  const m = new Map();
  for (const r of rows || []) { if (!m.has(r.time)) m.set(r.time, []); m.get(r.time).push(r); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
};
const devsOf = async (c) => (await api(`/device?amount=200&filter[connector]=${c}&fields[]=id&fields[]=name&fields[]=last_input`)) || [];
async function verify() {
  for (const c of GW) {
    const devs = (await devsOf(c)).filter((d) => d.last_input && Date.parse(d.last_input) >= SINCE);
    let ok = 0, bad = 0; const notes = [];
    for (const d of devs) {
      const p = packets(await api(`/device/${d.id}/data?qty=60`));
      const after = p.filter(([t]) => Date.parse(t) >= SINCE), before = p.filter(([t]) => Date.parse(t) < SINCE);
      if (!after.length) continue;
      const g = after[0][1], prev = before.length ? before[0][1] : null;
      const id = g.find((x) => x.variable === "lrrid");
      const err = g.filter((x) => x.variable === "parse_error").length;
      const pos = g.filter((x) => x.variable === "lrrlat" || x.variable === "lrrlon").length;
      const same = !prev || prev.length === g.length;
      const good = id && id.location && !err && !pos && same;
      if (good) ok++; else bad++;
      if (!good || notes.length < 3) notes.push(`${d.name}|${after[0][0]}|εγγραφές=${g.length}${prev ? "/πριν " + prev.length : ""}|lrrid=${id ? id.value : "—"}|location=${id && id.location ? JSON.stringify(id.location.coordinates || id.location) : "—"}|parse_error=${err}|lrrlat/lon=${pos}`);
    }
    console.log(`ΕΠ4|ΑΠΟΤΕΛΕΣΜΑ|${c}|έστειλαν μετά=${devs.length}|σωστά=${ok}|προβλήματα=${bad}`);
    for (const n of notes.slice(0, 8)) console.log("ΕΠ4|ΔΕΙΓΜΑ|" + n);
  }
}
async function audit() {
  const conns = (await api(`/integration/connector?amount=100&fields[]=id&fields[]=name`)) || [];
  console.log(`ΑΥ|CONNECTORS=${conns.length}`);
  let k = 0;
  for (const c of conns) {
    let devs = [];
    try { devs = await devsOf(c.id); } catch (e) { console.log(`ΑΥ|${String(++k).padStart(2, "0")}|${c.name}|ΣΦΑΛΜΑ λίστας ${e.message}`); continue; }
    const act = devs.filter((d) => d.last_input && Date.now() - Date.parse(d.last_input) < 864e5).sort((a, b) => (a.last_input < b.last_input ? 1 : -1));
    if (!act.length) { console.log(`ΑΥ|${String(++k).padStart(2, "0")}|${c.name}|${c.id}|συσκευές=${devs.length}|ενεργές24ω=0`); continue; }
    let p = [];
    try { p = packets(await api(`/device/${act[0].id}/data?qty=100`)); } catch (e) { console.log(`ΑΥ|${String(++k).padStart(2, "0")}|${c.name}|ΣΦΑΛΜΑ δεδομένων ${e.message}`); continue; }
    const g = p.length ? p[0][1] : [];
    const gap = p.length > 1 ? Math.round((Date.parse(p[0][0]) - Date.parse(p[1][0])) / 6e4) : null;
    console.log(`ΑΥ|${String(++k).padStart(2, "0")}|${c.name}|${c.id}|συσκευές=${devs.length}|ενεργές24ω=${act.length}|δείγμα=${act[0].name}|εγγραφές/πακέτο=${g.length}|διάστημα≈${gap}′|vars=${g.map((x) => x.variable).sort().join(",")}`);
  }
}
(async () => {
  console.log("ΣΤ2|== " + new Date().toISOString());
  try { await verify(); } catch (e) { console.log("ΕΠ4|ΣΦΑΛΜΑ|" + e.message); }
  try { await audit(); } catch (e) { console.log("ΑΥ|ΣΦΑΛΜΑ|" + e.message); }
  console.log("ΣΤ2|== ΤΕΛΟΣ");
})();
