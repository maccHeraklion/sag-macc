// SAG — ΜΟΝΟ ΑΝΑΓΝΩΣΗ · 19/10/2026 · ΑΠΟΓΡΑΦΗ ΠΕΔΙΩΝ ΑΝΑ CONNECTOR (v2: ξεκινά από τις ΔΙΚΕΣ ΜΑΣ συσκευές, όχι από τον
// δημόσιο κατάλογο connectors της TagoIO). Για κάθε connector με ενεργή συσκευή (24 ω): οι μεταβλητές του τελευταίου
// πακέτου 2 συσκευών, πλήθος ενεργών, διάστημα πακέτων. ΤΙΠΟΤΑ δεν γράφεται.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
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
(async () => {
  console.log("ΑΥ2|== " + new Date().toISOString());
  let devs = [];
  for (let page = 1; page <= 5; page++) {
    const c = await api(`/device?amount=200&page=${page}&fields[]=id&fields[]=name&fields[]=connector&fields[]=last_input`);
    devs = devs.concat(c || []);
    if (!c || c.length < 200) break;
  }
  const by = new Map();
  for (const d of devs) { if (!by.has(d.connector)) by.set(d.connector, []); by.get(d.connector).push(d); }
  console.log(`ΑΥ2|ΣΥΣΚΕΥΕΣ=${devs.length}|CONNECTORS=${by.size}`);
  let k = 0;
  for (const [cid, list] of by) {
    let name = "?";
    try { name = (await api(`/integration/connector/${cid}?fields[]=name`)).name; } catch (e) { name = "(όνομα: " + e.message.slice(0, 40) + ")"; }
    const act = list.filter((d) => d.last_input && Date.now() - Date.parse(d.last_input) < 864e5).sort((a, b) => (a.last_input < b.last_input ? 1 : -1));
    const tag = `ΑΥ2|${String(++k).padStart(2, "0")}|${name}|${cid}|συσκευές=${list.length}|ενεργές24ω=${act.length}`;
    if (!act.length) { console.log(tag); continue; }
    for (const d of act.slice(0, 2)) {
      let p = [];
      try { p = packets(await api(`/device/${d.id}/data?qty=100`)); } catch (e) { console.log(`${tag}|${d.name}|ΣΦΑΛΜΑ ${e.message.slice(0, 60)}`); continue; }
      const g = p.length ? p[0][1] : [];
      const gap = p.length > 1 ? Math.round((Date.parse(p[0][0]) - Date.parse(p[1][0])) / 6e4) : null;
      console.log(`${tag}|δείγμα=${d.name}|εγγραφές/πακέτο=${g.length}|διάστημα≈${gap}′|vars=${g.map((x) => x.variable).sort().join(",")}`);
    }
  }
  console.log("ΑΥ2|== ΤΕΛΟΣ");
})().catch((e) => console.log("ΑΥ2|ΣΦΑΛΜΑ|" + e.message));
