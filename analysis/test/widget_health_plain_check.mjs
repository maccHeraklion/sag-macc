// Ελεγκτής widget · T-HEALTH-PLAIN-01: «Υγεία εγκατάστασης» μόνο για όργανα/δεδομένα (θέμα = μόνο βλάβη),
// «Ειδοποιήσεις για τον αγρό» για καιρό/ασθένειες, «Πώς υπολογίστηκαν» χωρίς ωμά κλειδιά και συντομεύσεις.
// Εξάγει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα των τριών καρτών από το bundle και τον ΕΚΤΕΛΕΙ με τα δεδομένα του Ρηγάκη
// (στιγμιότυπα 13/10) και με σενάρια βλαβών. Κάθε μετάλλαξη πρέπει να σκοτώνεται.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const WID = fs.readFileSync(path.join(here, "..", "..", "_dist-sagMain", "index-7cbd9a4e.js"), "utf8");

const e = { jsx: (t, p) => ({ t, p }), jsxs: (t, p) => ({ t, p }) };
const flat = (x) => x == null || x === false ? "" : typeof x === "string" || typeof x === "number" ? String(x) + " "
  : Array.isArray(x) ? x.map(flat).join("") : flat(x.p && x.p.children);
const find = (x, pred) => { if (!x || typeof x !== "object") return null; if (Array.isArray(x)) { for (const y of x) { const r = find(y, pred); if (r) return r; } return null; }
  if (pred(x)) return x; return find(x.p && x.p.children, pred); };

// δεδομένα Ρηγάκη (στιγμιότυπα 13/10/2026 23:18)
const INF_TXT = "ΠΡΟΓΝΩΣΗ, ΟΧΙ ΜΕΤΡΗΣΗ: οι επόμενες ώρες δίνουν έως 12 συνεχόμενες ώρες με υγρασία και θερμοκρασία μέσα στο εύρος μόλυνσης για: Γλοιοσπόριο / Ανθράκνωση Ελιάς (Colletotrichum acutatum). Ο ΚΙΝΔΥΝΟΣ ΣΤΙΣ ΚΑΡΤΕΣ ΔΕΝ ΑΛΛΑΖΕΙ — αυτός βγαίνει από μετρημένες ώρες υγρού φύλλου. Χρησιμοποιήστε το μόνο για να προλάβετε: προστατευτικός ψεκασμός θέλει να στεγνώσει πριν τη βροχή.";
const RAIN_TXT = "Η πρόγνωση δίνει συνολικά 17,9 mm βροχής μέσα στις επόμενες 25 ώρες, με αρχή γύρω στις Τρί 23:00. Η ΔΟΣΗ ΑΡΔΕΥΣΗΣ ΔΕΝ ΑΛΛΑΖΕΙ — υπολογίζεται ΜΟΝΟ από μετρήσεις, γιατί η βροχή μπορεί να μην πέσει. Αν θέλετε, αναβάλετε το πότισμα και δείτε αύριο τι έδειξε ο βροχόμετρος· το σύστημα θα το λάβει υπόψη μόνο του μόλις η βροχή ΜΕΤΡΗΘΕΙ.";
const MC = ["met_reference_source: Χωρίς μετεωρολογικό σταθμό: οι θερμοκρασίες έρχονται από τον αισθητήρα κόμης.",
  "citrusfruits orange:2/leaf_wetness_source: Φύλλωμα ΣΤΕΓΝΟ. Από σκιασμένο αισθητήρα φύλλου. Υγρές ώρες σήμερα: 0.",
  "citrusfruits orange:2/pathogen_hs_basis: Ευπάθεια φυτού (HS 1.05): πλήρης.",
  "olive koroneiki:1/soil_moisture_rootzone: Σταθμισμένη κατά FAO-56. Δύο βάθη: 30 cm (40 %) + 60 cm (60 %). Ρίζα: 150 cm.",
  "olive koroneiki:1/bpi_comparability: Δείτε το BPI μόνο ως τάση του ίδιου αγρού στον χρόνο. Για σύγκριση μεταξύ αγρών χρησιμοποιήστε το DLI.",
  "olive koroneiki:1/pathogen_analysis_status: Λείπει η υγρασία φύλλου για 2 μύκητες.",
  "crop_stage: ΥΔΑΤΙΚΟ στάδιο (FAO-56) — καθορίζει τη δόση άρδευσης, ΔΕΝ είναι φαινολογία."].join("\n");
const v = (value, color, text, extra) => ({ value, metadata: Object.assign({}, color ? { color } : {}, text ? { text } : {}, extra || {}) });
const RIG = () => ({
  infection_ahead: v("1 παθογόνο ευνοείται", "orange", INF_TXT, { count: 1 }),
  met_reference_source: v("Αισθητήρας κόμης", "orange", null, { _m: 1 }),
  leaf_wetness_source: v("Αισθητήρας φύλλου", "orange", null, { _m: 1 }),
  infection_model_status: v("Ενεργές · 6 μύκητες · μέγ. 5 ω", "green"),
  gdd_crop_status: v("Ενεργές · 464 °C·ημ από 1/1", "green"),
  gdd_pest_status: v("Ενεργές · 7 εχθροί", "green"),
  soil_profile_status: v("Έδαφος: Αργιλοπηλώδες (Clay Loam)", "green"),
  soil_temp_source: v("Μετρημένη", "green"),
  soil_ec_status: v("Χωρίς δήλωση λίπανσης", "grey", null, { _s: 1, _t: Date.now() / 6e4 - 1200 }),
  soil_ece1: v(1.08, "grey", "Όργανο 0,29 dS/m (ρηχό) — εκχύλισμα κορεσμού 1,08", { unit: "dS/m" }),
  salinity_stress: v("Καμία", "green"),
  rain_ahead: v("17,9 mm βροχής μπροστά", "blue", RAIN_TXT),
  forecast_status: v("Ενεργή", "green"),
  ipsi_primary_cause: v("Καμία κυρίαρχη αιτία", "grey", "Δεν εντοπίζεται συγκεκριμένη αιτία καταπόνησης."),
  bpi_daily_status: v("Ελαφρώς υψηλή θερμοκρασία", "grey"),
  soil_depth_divergence: v(1.26, "green", null, { unit: "% κ.ό." }),
  sensor_faults: v("Όργανα: 3 — όλα λειτουργούν", "green"),
  device_battery: v("Μπαταρίες εντάξει", "green", "x"),
  measurement_age: v("Σταθμός 12΄ · Έδαφος 30΄", "green"),
  avg_window_status: v("Πλήρη 24ωρα · 9 μεγέθη", "green"),
  sensor_quality: v("Μετρήσεις: όλες έγκυρες", "green", null, { _trunc: 1 }),
  soil_moisture_limits_status: v("Εντάξει", "grey"),
  measurement_sources: v("Ένα όργανο ανά μέγεθος", "grey", "0:a"),
  irrigation_area_basis: v("20 στρ. καλλιέργειας", "grey", "Η συνιστώμενη ποσότητα άρδευσης αφορά μόνο τα δηλωμένα 20.000 m² αυτής της καλλιέργειας (σύνολο αγρού: 22.000 m²)."),
  irrigation_dose_basis: v("ECw μετρημένη · απόδοση τυπική", "green", "Αλατότητα νερού 0,8 dS/m (από τη μέτρησή σας). Απόδοση δικτύου 90 % (τυπική τιμή του συστήματος άρδευσης). Και οι δύο μπαίνουν στα λίτρα: δόση = ανάγκη × (1 + έκπλυση) ÷ απόδοση."),
  soil_depth_basis: v("Δύο βάθη: 30 cm (40 %) + 60 cm (60 %)", "green", null, { _m: 1 }),
  pathogen_hs_basis: v("πλήρης", "green", null, { _m: 1 }),
  bpi_comparability: v("Μόνο ως τάση", "grey", null, { _m: 1 }),
  kernel_version: v("v50.160 · 2026-10-05", "grey", "Έκδοση του συστήματος υπολογισμών."),
  pathogen_analysis_status: v("Ενεργή", "green", null, { _m: 1 }),
  soil_moisture_rootzone: v(31.31, "green", null, { unit: "% κ.ό.", _m: 1 }),
  crop_stage: v("Ανάπτυξη φυλλώματος", "green", null, { _mp: 1 }),
  field_method_card: v(7, "grey", MC),
});

function run(w) {
  const f = []; const ok = (c, m) => { if (!c) f.push(m); };
  try {
    const a = w.indexOf("(()=>{let RM;try{RM=re}"); const b = w.indexOf(',e.jsxs("div",{className:"card",id:"varsCard"', a);
    if (a < 0 || b < 0) throw new Error("δεν βρέθηκαν οι κάρτες");
    const seg = w.slice(a, b);
    ok((seg.match(/T-HEALTH-PLAIN-01/g) || []).length === 3, "Δ0 τρεις κάρτες με σήμανση");
    const R = (re, src) => new Function("re", "e", "_sagSrcTxt9", "_sagBat9", "_sagInv9", "return [" + seg + "];")(re, e, src === undefined ? "Θερμοκρασία αέρα: σταθμός" : src, { "a1": "92 %" }, { "a1": { n: "Σταθμός" } });
    const card = (out, id) => out.find(c => c && c.p && c.p.id === id) || null;
    const sum = (c) => flat(find(c, x => x.t === "summary"));
    const txt = (c) => flat(c).replace(/\s+/g, " ");

    // ── Ρηγάκης ──
    const out = R(RIG());
    const H = card(out, "healthCard"), A = card(out, "alertsCard"), B = card(out, "basisCard");
    ok(H && A && B, "Ρ0 υπάρχουν και οι τρεις κάρτες");
    ok(/όλα λειτουργούν/.test(sum(H)) && !/θέμα/.test(sum(H)), "Ρ1 Ρηγάκης: «όλα λειτουργούν», κανένα θέμα (" + sum(H) + ")");
    ok(/Παρακολούθηση ασθενειών Λειτουργεί · παρακολουθούνται 6 ασθένειες από μύκητες/.test(txt(H)), "Ρ2 μοντέλο μολύνσεων σε απλά λόγια (" + txt(H).slice(0, 400) + ")");
    ok(!/μέγ\.|Ενεργές ·|°C·ημ/.test(txt(H)), "Ρ3 χωρίς «μέγ. 5 ω» / «Ενεργές ·» / «°C·ημ»");
    ok(/Παρακολούθηση εντόμων Λειτουργεί · παρακολουθούνται 7 εχθροί/.test(txt(H)), "Ρ4 έντομα σε απλά λόγια");
    ok(!/κόμης|Προληπτικό|Βροχή|Αλατότητα|Κύρια αιτία|Κατάσταση ανάπτυξης|Ρηχό έναντι/.test(txt(H)), "Ρ5 η υγεία ΔΕΝ έχει καιρό/άλατα/μεθοδολογία");
    ok(/Λειτουργούν κανονικά/.test(txt(H)) && /Ποιο όργανο μετρά τι Θερμοκρασία αέρα: σταθμός/.test(txt(H)), "Ρ6 ομάδα «Λειτουργούν κανονικά» + ποιο όργανο μετρά τι");
    ok(/Σταθμός: 92 %/.test(txt(H)), "Ρ7 μπαταρίες με όνομα οργάνου");
    ok(/2 ειδοποιήσεις/.test(sum(A)), "Ρ8 ειδοποιήσεις: πρόγνωση μόλυνσης + βροχή (" + sum(A) + ")");
    ok(/Καιρός που ευνοεί ασθένειες Ευνοϊκός για 1 ασθένεια/.test(txt(A)) && /έως 12 συνεχόμενες ώρες/.test(txt(A)) && /Γλοιοσπόριο \/ Ανθράκνωση Ελιάς/.test(txt(A)), "Ρ9 πρόγνωση μόλυνσης σε απλά λόγια (" + txt(A).slice(0, 300) + ")");
    ok(/Βροχή τις επόμενες ώρες 17,9 mm/.test(txt(A)) && /επόμενες 25 ώρες, με αρχή γύρω στις Τρί 23:00\. Η δόση νερού αλλάζει μόνο/.test(txt(A)), "Ρ10 βροχή σε απλά λόγια");
    ok(!/Καμία|Χωρίς δήλωση λίπανσης|1,26/.test(txt(A)), "Ρ11 πράσινα/γκρι (άλατα «Καμία», λίπανση, ρηχό-βαθύ) δεν είναι ειδοποιήσεις");
    ok(/Για ποια έκταση είναι η δόση 20 στρέμματα καλλιέργειας/.test(txt(B)), "Ρ12 έκταση χωρίς «στρ.»");
    ok(/Υγρασία στη ζώνη των ριζών 31,3 %/.test(txt(B)), "Ρ13 υγρασία ριζών «31,3 %» (" + txt(B).slice(0, 600) + ")");
    ok(/Θερμοκρασία και υγρασία αέρα από αισθητήρα μέσα στο φύλλωμα Δεν υπάρχει μετεωρολογικός σταθμός/.test(txt(B)), "Ρ14 πηγή θερμοκρασιών σε απλά λόγια");
    ok(/Το βρέξιμο του φύλλου φαίνεται από αισθητήρα φύλλου/.test(txt(B)), "Ρ15 πηγή βρεξίματος φύλλου");
    ok(/Αλατότητα νερού και απόδοση δικτύου νερό: μετρημένο · δίκτυο: τυπική τιμή/.test(txt(B)) && !/δόση =/.test(txt(B)), "Ρ16 δόση χωρίς ECw και χωρίς τύπο");
    ok(/Βάθη αισθητήρων υγρασίας εδάφους Δύο βάθη: 30 cm \+ 60 cm /.test(txt(B)), "Ρ24 βάθη χωρίς τα βάρη στάθμισης «(40 %)»");
    ok(/Τύπος εδάφους Αργιλοπηλώδες/.test(txt(B)) && /Στάδιο καλλιέργειας για το πότισμα Ανάπτυξη φυλλώματος/.test(txt(B)), "Ρ17 έδαφος + στάδιο");
    const fv = find(B, x => typeof x.p?.children === "string" && /^Έκδοση υπολογισμών/.test(x.p.children));
    ok(fv && fv.p.children === "Έκδοση υπολογισμών: v50.160", "Ρ18 έκδοση μόνο ως υποσημείωση «v50.160»");
    ok(!/Τι λείπει/.test(txt(B)), "Ρ19 μοντέλο παθογόνων «Ενεργή» → καμία γραμμή");
    const ALLT = txt(H) + txt(A) + txt(B);
    ok(!/orange:2|koroneiki|citrusfruits|Μέθοδος \(ημερήσια|συσσωρευτ|δεν χώρεσαν|κ\.ό\.|στρ\.|°C·ημ/.test(ALLT), "Ρ20 καμία ωμή γραμμή/συντόμευση");
    ok(!/\b(BPI|DLI|IPSI|GDD|HS|ECw|ECe|FAO|PTQ)\b|ET₀/.test(ALLT), "Ρ21 κανένα αρκτικόλεξο (" + (ALLT.match(/\b(BPI|DLI|IPSI|GDD|HS|ECw|ECe|FAO|PTQ)\b|ET₀/) || [""])[0] + ")");
    ok(!/[a-z]+_[a-z_]+/.test(ALLT), "Ρ22 κανένα κλειδί με «_» (" + (ALLT.match(/[a-z]+_[a-z_]+/) || [""])[0] + ")");
    ok(!/[Α-ΩΆΈΉΊΌΎΏ]{5,}/.test(ALLT), "Ρ23 χωρίς φωνές με κεφαλαία (" + (ALLT.match(/[Α-ΩΆΈΉΊΌΎΏ]{5,}/) || [""])[0] + ")");

    // ── σενάρια ──
    const S = (patch, src) => { const r = RIG(); Object.assign(r, patch); for (const k of Object.keys(patch)) if (patch[k] === null) delete r[k]; return R(r, src); };
    let o = S({ infection_model_status: v("Σε παύση — παλιά μέτρηση", "orange", "Οι ώρες μόλυνσης ΔΕΝ ανανεώνονται αυτή την ώρα.") });
    ok(/1 θέμα/.test(sum(card(o, "healthCard"))) && /Παρακολούθηση ασθενειών Σε παύση — παλιά μέτρηση Οι ώρες μόλυνσης/.test(txt(card(o, "healthCard"))), "Σ1 μοντέλο σε παύση → 1 θέμα με εξήγηση");
    o = S({ sensor_faults: v("1 όργανο χρειάζεται επέμβαση", "red", "Σόνδα: σιωπή 30 ω."), device_battery: v("1 όργανο με μπαταρία που τελειώνει", "orange", "x — αλλάξτε") });
    ok(/2 θέματα/.test(sum(card(o, "healthCard"))), "Σ2 βλάβη οργάνου + μπαταρία → 2 θέματα");
    const H2 = txt(card(o, "healthCard"));
    ok(H2.indexOf("Όργανα αγρού") < H2.indexOf("Λειτουργούν κανονικά"), "Σ3 τα θέματα πάνω από τα εντάξει");
    o = S({ irrigation_dose_basis: v("ECw τυπική · απόδοση τυπική", "orange", "Αλατότητα νερού 1 dS/m (Η ΜΕΤΡΗΣΗ ΣΑΣ 3220 dS/m ΑΓΝΟΗΘΗΚΕ).") });
    ok(/1 θέμα/.test(sum(card(o, "healthCard"))) && /Στοιχεία άρδευσης στη φόρμα/.test(txt(card(o, "healthCard"))), "Σ4 λάθος μέτρηση στη φόρμα → θέμα");
    ok(!/Στοιχεία άρδευσης/.test(txt(H)), "Σ5 σωστά στοιχεία άρδευσης → όχι στην υγεία");
    o = S({ avg_window_status: v("Ελλιπή 24ωρα: 1 από 9 μεγέθη", "yellow", "λίγες μετρήσεις") });
    ok(/1 θέμα/.test(sum(card(o, "healthCard"))), "Σ6 κίτρινο = θέμα");
    o = S({ met_reference_source: v("Αισθητήρας κόμης", "green", null), infection_ahead: null, rain_ahead: null });
    ok(card(o, "alertsCard") === null, "Σ7 τίποτα για ειδοποίηση → καμία κάρτα ειδοποιήσεων");
    ok(/αισθητήρα μέσα στο φύλλωμα/.test(txt(card(o, "basisCard"))) && !/Δεν υπάρχει μετεωρολογικός/.test(txt(card(o, "basisCard"))), "Σ8 θερμοκήπιο (πράσινο) → χωρίς προειδοποίηση για τη δόση");
    o = S({ infection_ahead: v("2 παθογόνα ευνοούνται", "orange", "Άλλη μορφή κειμένου πυρήνα.", { count: 2 }) });
    ok(/Ευνοϊκός για 2 ασθένειες Άλλη μορφή κειμένου πυρήνα/.test(txt(card(o, "alertsCard"))), "Σ9 άγνωστη μορφή κειμένου → φαίνεται αυτούσιο");
    o = S({ irrigation_warning: { value: "ΑΚΑΤΑΛΛΗΛΟ ΝΕΡΟ: η αλατότητα υπερβαίνει το όριο" } });
    ok(/Νερό άρδευσης ΑΚΑΤΑΛΛΗΛΟ ΝΕΡΟ/.test(txt(card(o, "alertsCard"))), "Σ10 προειδοποίηση άρδευσης χωρίς χρώμα → φαίνεται");
    o = S({ frost_warning: v("Παγετός απόψε", "red", "Ελάχιστη -1 °C") , salinity_stress: v("Μέτρια", "orange", "άλατα") });
    ok(/4 ειδοποιήσεις/.test(sum(card(o, "alertsCard"))) && /Παγετός Παγετός απόψε/.test(txt(card(o, "alertsCard"))), "Σ11 παγετός + άλατα → ειδοποιήσεις");
    o = S({ pathogen_analysis_status: v("Ενεργή — χωρίς έδαφος", "orange", null, { _m: 1 }) });
    ok(/Τι λείπει για τις ασθένειες Ενεργή — χωρίς έδαφος Λείπει η υγρασία φύλλου για 2 μύκητες/.test(txt(card(o, "basisCard"))), "Σ12 τι λείπει για τις ασθένειες, από την κάρτα μεθόδου");
    o = S({ leaf_wetness_source: v("Στεγνό", "green") });
    ok(/φαίνεται από εκτίμηση από την υγρασία του αέρα/.test(txt(card(o, "basisCard"))), "Σ13 χωρίς αισθητήρα φύλλου → εκτίμηση");
    const empty = R({}, "");
    ok(empty.every(x => x === null), "Σ14 κενός αγρός → καμία κάρτα");
    o = S({ soil_depth_divergence: v(9.4, "orange", "Διαφορά (12,5 % στα 30 cm έναντι 21,9 % στα 60 cm).") });
    ok(/Ρηχό και βαθύ στρώμα εδάφους διαφέρουν ρηχό 12,5 % · βαθύ 21,9 %/.test(txt(card(o, "alertsCard"))), "Σ15 ρηχό/βαθύ σε απλή μορφή");
  } catch (x) { f.push("εκτέλεση: " + x.message); }
  return f;
}
const base = run(WID);
if (base.length) { console.log("ΑΠΟΤΥΧΙΑ ΒΑΣΗΣ:\n  " + base.join("\n  ")); process.exit(1); }
console.log("ΒΑΣΗ: όλοι οι έλεγχοι πέρασαν");
const MUT = [
  ["m1 η πηγή θερμοκρασιών ξαναγίνεται «θέμα»", '["irrigation_dose_basis","Στοιχεία άρδευσης στη φόρμα",1]', '["irrigation_dose_basis","Στοιχεία άρδευσης στη φόρμα",1],["met_reference_source","Πηγή"]'],
  ["m2 μοντέλο μολύνσεων ωμό", 'if(k==="infection_model_status"){', "if(0){"],
  ["m3 πράσινα στις ειδοποιήσεις", 'return c!=="green"&&c!=="grey"', 'return c!=="grey"'],
  ["m4 πρόγνωση μόλυνσης ωμή", "(h&&p)?", "(0)?"],
  ["m5 «Ενεργή» μοντέλο παθογόνων φαίνεται", '.filter(x=>!(x.k==="pathogen_analysis_status"&&String(x.d.value)==="Ενεργή"))', ""],
  ["m6 «στρ.» μένει", '["irrigation_area_basis","Για ποια έκταση είναι η δόση",v=>PL(v),1]', '["irrigation_area_basis","Για ποια έκταση είναι η δόση",v=>String(v),1]'],
  ["m7 υγρασία ριζών ωμή", '["soil_moisture_rootzone","Υγρασία στη ζώνη των ριζών",v=>N1(v," %"),0]', '["soil_moisture_rootzone","Υγρασία στη ζώνη των ριζών",v=>String(v),0]'],
  ["m8 σωστά στοιχεία άρδευσης στην υγεία", ".filter(x=>!(x.po&&!BADC(CO(x.d))))", ""],
  ["m9 προειδοποίηση δόσης και σε θερμοκήπιο", 'String(md.color)==="orange"?"Δεν υπάρχει', '1?"Δεν υπάρχει'],
  ["m10 κίτρινο δεν μετρά", 'const BADC=c=>c==="red"||c==="orange"||c==="yellow";', 'const BADC=c=>c==="red"||c==="orange";'],
  ["m11 βροχή ωμή", 'r?"Η πρόγνωση δίνει "', '0?"Η πρόγνωση δίνει "'],
  ["m12 τύπος δόσης μένει", '.replace(/:\\s*δόση\\s*=.*$/,".")', ""],
  ["m13 έκδοση με ημερομηνία", '+String(KV.value).split(" ")[0]', "+String(KV.value)"],
  ["m14 πλήθος ασθενειών χάνεται", 'n?"Ευνοϊκός για "', '0?"Ευνοϊκός για "'],
  ["m15 εντάξει με χρώμα «θέματος»", "const BAD=ALL.filter(x=>BADC(CO(x.d)));", "const BAD=ALL.filter(x=>CO(x.d)!==\"green\");"],
  ["m16 κείμενο άγνωστης μορφής χάνεται", 'μόνο με όσα μετρηθούν στον αγρό.":t]}', 'μόνο με όσα μετρηθούν στον αγρό.":""]}'],
  ["m17 χωρίς «ποιο όργανο μετρά τι»", 'SRC?INF("measurement_sources"', 'null?INF("measurement_sources"'],
  ["m19 βάρη στάθμισης στα βάθη", String.raw`v=>PL(String(v).replace(/\s*\(\d+ %\)/g,""))`, "v=>PL(v)"],
  ["m18 βρέξιμο φύλλου ωμό", 'v=>LW[String(v)]||PL(v)', "v=>PL(v)"],
];
let killed = 0;
for (const [name, a, b] of MUT) {
  const n = WID.split(a).length - 1;
  if (n !== 1) { console.log("  ΜΗ ΕΦΑΡΜΟΣΙΜΗ " + name + " (βρέθηκε " + n + ")"); continue; }
  const r = run(WID.replace(a, b));
  if (r.length) { killed++; console.log("  σκοτώθηκε " + name + " <- " + r[0]); } else console.log("  ΕΠΕΖΗΣΕ " + name);
}
console.log("ΜΕΤΑΛΛΑΞΕΙΣ " + killed + "/" + MUT.length);
if (killed !== MUT.length) process.exit(1);
