// SAG · ΔΙΑΓΝΩΣΗ GATEWAYS — ΜΟΝΟ ΑΝΑΓΝΩΣΗ (19/9/2026)
//
// ΕΡΩΤΗΜΑ: «γιατί ο πίνακας Στόλος Gateways τα δείχνει ΟΛΑ άγνωστα;»
//
// ΑΠΑΝΤΗΣΗ (μετρημένη 15:09 UTC): 33 συσκευές gateway · **0** με δική τους μεταβλητή ποτέ ·
// 12 χωρίς καμία εγγραφή ποτέ · η μόνη μεταβλητή που υπάρχει είναι `location` σε 21 συσκευές,
// ΟΛΕΣ με ταυτόσημο last_input 2026-09-06T20:59:28.856Z — μία ομαδική εγγραφή της ανάλυσης
// fieldLocationUpdate (last_run 20:59:47, ίδιο λεπτό). Κανένα gateway δεν μίλησε ποτέ στο TagoIO.
//
// ΓΙΑΤΙ ΕΙΝΑΙ ΑΔΥΝΑΤΟ ΝΑ ΒΓΕΙ ΠΡΑΣΙΝΟ: η σελίδα gateway-board.html ορίζει
// NOT_LIFE_SIGNS = ['location','gateway_config'] (σωστά: ό,τι γράφουμε εμείς δεν είναι σημάδι
// ζωής) — αλλά το widget είναι δεμένο ΜΟΝΟ σε αυτές τις δύο. Άρα η statusOf() δεν βρίσκει ποτέ
// τίποτα και κάθε gateway βγαίνει «άγνωστη» ΕΞ ΟΡΙΣΜΟΥ.
//
// ΓΙΑΤΙ «(ΧΩΡΙΣ ΟΝΟΜΑ)»: το `gateway_config` δεν γράφτηκε ΠΟΤΕ. Τα ονόματα υπάρχουν στις
// ΕΤΙΚΕΤΕΣ (comment/eui/manufacturer/type) — που ένα widget δεν διαβάζει.
const TOKEN = process.env.T_ANALYSIS_TOKEN;
const API = "https://api.us-e1.tago.io";
async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: TOKEN } });
  const j = await r.json().catch(() => ({}));
  if (!j.status) throw new Error(path + " -> " + JSON.stringify(j.message || j).slice(0, 140));
  return j.result;
}
(async () => {
  console.log("=== GATEWAY DIAG · " + new Date().toISOString() + " ===");
  let devs = [];
  try {
    devs = await api("/device?amount=200&fields[]=id&fields[]=name&fields[]=last_input&fields[]=tags"
      + "&filter[tags][0][key]=is_gateway&filter[tags][0][value]=yes");
  } catch (e) { console.log("ERR|devices: " + e.message); return; }
  console.log("GATEWAYS|" + devs.length);
  const now = Date.now();
  let noneOwn = 0, withOwn = 0, silent = 0;
  const varTally = new Map();
  let i = 0;
  const rows = [];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < devs.length) {
      const d = devs[i++];
      const t = (k) => ((d.tags || []).find(x => x.key === k) || {}).value || "";
      let vars = new Map();
      try {
        // ΧΩΡΙΣ φίλτρο μεταβλητής: ό,τι ΥΠΑΡΧΕΙ στη συσκευή
        const r = await api(`/device/${d.id}/data?qty=50`);
        for (const p of (r || [])) {
          const prev = vars.get(p.variable);
          if (!prev || Date.parse(p.time) > Date.parse(prev)) vars.set(p.variable, p.time);
        }
      } catch (e) { /* αγνοείται */ }
      for (const k of vars.keys()) varTally.set(k, (varTally.get(k) || 0) + 1);
      const own = [...vars.keys()].filter(k => k !== "location" && k !== "gateway_config");
      if (own.length) withOwn++; else noneOwn++;
      const liMs = d.last_input ? Date.parse(d.last_input) : NaN;
      const ageD = Number.isFinite(liMs) ? Math.round((now - liMs) / 86400000 * 10) / 10 : null;
      if (ageD == null || ageD > 7) silent++;
      rows.push({ n: d.name, man: t("manufacturer"), typ: t("type"), dep: t("deployedGateway"),
        li: d.last_input || "ΠΟΤΕ", age: ageD, all: [...vars.keys()].join(","), own: own.join(",") });
    }
  }));
  rows.sort((a, b) => String(a.man).localeCompare(String(b.man)) || String(a.n).localeCompare(String(b.n)));
  for (const r of rows.slice(0, 40)) {
    console.log(`G|${r.n}|${r.man}/${r.typ}|deployed=${r.dep}|last_input=${r.li}|ηλικία=${r.age}ημ`
      + `|μεταβλητές=[${r.all || "ΚΑΜΙΑ"}]|ΔΙΚΕΣ ΤΟΥ=[${r.own || "ΚΑΜΙΑ"}]`);
  }
  console.log("VARS|" + [...varTally.entries()].map(([k, v]) => k + ":" + v).join(" · "));
  console.log(`SUMMARY|gateways=${devs.length}|με ΔΙΚΗ ΤΟΥΣ μεταβλητή=${withOwn}|ΜΟΝΟ φόρμα=${noneOwn}`
    + `|χωρίς καμία εγγραφή >7 ημ=${silent}`);
  console.log("=== ΤΕΛΟΣ ===");
})();
