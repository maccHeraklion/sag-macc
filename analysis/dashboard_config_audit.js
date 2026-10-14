// SAG — ΕΛΕΓΧΟΣ ΡΥΘΜΙΣΕΩΝ ΤΑΜΠΛΟ (ΜΟΝΟ ΑΝΑΓΝΩΣΗ) · T-DASH-AUDIT-01 (14/10/2026, εντολή Μιχάλη).
// ΓΙΑΤΙ: η ομογενοποίηση της 16/9 έβαλε στο GitHub τον ΚΩΔΙΚΑ, όχι τη ρύθμιση κάθε ταμπλό (ποιες συσκευές/μεταβλητές
// διαβάζει και γράφει το widget). Αυτή ζει μόνο στο TagoIO και ξέφυγε: 26 ταμπλό έγραφαν το ημερολόγιο ×9, 15 το έχαναν,
// κανένα δεν κατέγραφε εντολές άρδευσης/αναιρέσεις (T-DASH-SRC-01). Αυτή η analysis διαβάζει ΟΛΑ τα ταμπλό με το widget
// sagMain και ελέγχει τους κανόνες της `sagDashRules` — ο ΙΔΙΟΣ κώδικας ελέγχεται τοπικά από τον
// analysis/test/dashboard_config_check.mjs πάνω στα αντίγραφα του deploy/dashboards/.
// ΤΙΠΟΤΑ δεν γράφεται: μόνο αναφορά στο console (πρόθεμα ΤΑΜ). Χρειάζεται πολιτική με Dashboard/Access (ανάγνωση).
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";

// ── ΚΑΝΟΝΕΣ (κοινοί με τον τοπικό ελεγκτή — μην αλλάξεις το όνομα της συνάρτησης) ─────────────────────────────
function sagDashRules(widget) {
  const out = [];
  const add = (level, code, msg) => out.push({ level, code, msg });
  const DOWNLINK = "68deb0d47a8161000a558867";
  const LOGVARS = ["field_calendar", "spray_declaration", "inspection_declaration", "declaration_undo", "action_log"];
  const data = Array.isArray(widget && widget.data) ? widget.data : [];
  const disp = widget && widget.display || {};
  const fieldEntries = data.filter(e => Array.isArray(e.variables) && e.variables.includes("field_bundle"));
  if (fieldEntries.length !== 1) add("CRITICAL", "R3", "field_bundle σε " + fieldEntries.length + " πηγές (πρέπει 1)");
  const fo = fieldEntries[0] && fieldEntries[0].origin;
  // R1: οι μεταβλητές καταγραφών του αγρού υπάρχουν ακριβώς μία φορά (λείπει → η εγγραφή πετιέται σιωπηλά· διπλή → ×N)
  for (const v of LOGVARS) {
    const n = data.filter(e => e.origin === fo && Array.isArray(e.variables) && e.variables.includes(v)).length;
    if (n === 0) add("CRITICAL", "R1", v + ": λείπει από τις πηγές του αγρού — οι εγγραφές του widget χάνονται σιωπηλά");
    else if (n > 1) add("CRITICAL", "R1", v + ": σε " + n + " πηγές — κάθε εγγραφή αποθηκεύεται πολλαπλά");
  }
  // R2: καμία μεταβλητή σε δύο πηγές της ΙΔΙΑΣ συσκευής (autofill → πολλαπλές εγγραφές)
  const seen = {};
  for (const e of data) for (const v of (e.variables || [])) {
    const k = e.origin + "|" + v;
    seen[k] = (seen[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(seen)) if (n > 1) {
    const [o, v] = k.split("|");
    if (!(o === fo && LOGVARS.includes(v))) add("HIGH", "R2", v + " της συσκευής " + o + " σε " + n + " πηγές");
  }
  // R4: με ελεγκτές άρδευσης, οι εντολές πρέπει να περνούν από την UC511_downlink
  const hasCtl = data.some(e => (e.variables || []).some(v => /^(valve_\d+_(time_)?command|rule\d+_set)$/.test(v)));
  if (hasCtl && widget.analysis_run !== DOWNLINK)
    add("CRITICAL", "R4", "υπάρχουν ελεγκτές άρδευσης αλλά analysis_run=" + (widget.analysis_run || "κενό") + " — οι εντολές από το ταμπλό δεν φτάνουν στον ελεγκτή");
  // R5: display.variables με παλιά μορφή origin (αντικείμενο) — μπλοκάρει τις αλλαγές από εργαλεία/API
  const legacy = (Array.isArray(disp.variables) ? disp.variables : []).filter(x => x && typeof x.origin === "object" && x.origin !== null).length;
  if (legacy) add("MEDIUM", "R5", legacy + " γραμμές display.variables με παλιά μορφή origin");
  // R6: bucket διαφορετικό από origin (π.χ. αντίγραφο προτύπου που έδειχνε στον αγρό Α1)
  for (const e of data) if (e.bucket && e.bucket !== e.origin)
    add("HIGH", "R6", "πηγή με origin " + e.origin + " έχει bucket " + e.bucket + " (άλλη συσκευή)");
  // R7: κάθε συσκευή εκτός αγρού να έχει ετικέτα στο device_map
  let dm = {};
  try { const p = (disp.parameters || []).find(x => x && x.key === "device_map"); dm = p ? JSON.parse(p.value || "{}") : {}; } catch (_e) { add("MEDIUM", "R7", "device_map μη αναγνώσιμο"); }
  const origins = [...new Set(data.map(e => e.origin).filter(o => o && o !== fo))];
  const unl = origins.filter(o => !dm[o]);
  if (unl.length) add("LOW", "R7", unl.length + " συσκευές χωρίς ετικέτα στο device_map: " + unl.join(","));
  return out;
}

async function get(p) {
  const r = await fetch(API + p, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(JSON.stringify(j.message || j).slice(0, 120));
  return j.result;
}

(async () => {
  console.log("ΤΑΜ=== ΕΛΕΓΧΟΣ ΡΥΘΜΙΣΕΩΝ ΤΑΜΠΛΟ · " + new Date().toISOString() + " ===");
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let n = 0, clean = 0;
  try {
    let page = 1, dashes = [];
    for (;;) {
      const a = await get(`/dashboard?amount=200&page=${page}&fields=id,label`);
      dashes = dashes.concat(a || []);
      if (!a || a.length < 200) break;
      page++;
    }
    for (const d of dashes) {
      let info;
      try { info = await get(`/dashboard/${d.id}`); } catch (e) { console.log("ΤΑΜERR|" + d.label + "|" + e.message); continue; }
      const wids = [...new Set((info.arrangement || []).map(a => a.widget_id))];
      for (const wid of wids) {
        let w;
        try { w = await get(`/dashboard/${d.id}/widget/${wid}`); } catch (e) { continue; }
        const url = String(w && w.display && w.display.url || "");
        if (!/storage\/sagMain\/index\.html/.test(url)) continue;
        n++;
        const f = sagDashRules(w);
        if (!f.length) { clean++; continue; }
        for (const x of f) counts[x.level]++;
        console.log("ΤΑΜ|" + d.label + " (" + d.id + ")|" + f.map(x => x.level + " " + x.code + ": " + x.msg).join(" ¦ "));
      }
    }
  } catch (e) { console.log("ΤΑΜERR|" + e.message); }
  console.log("ΤΑΜΣ|widget sagMain: " + n + " · χωρίς ευρήματα: " + clean + " · CRITICAL " + counts.CRITICAL + " · HIGH " + counts.HIGH + " · MEDIUM " + counts.MEDIUM + " · LOW " + counts.LOW);
  console.log("ΤΑΜ=== ΤΕΛΟΣ ===");
})();
