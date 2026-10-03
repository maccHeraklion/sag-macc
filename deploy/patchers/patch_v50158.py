# -*- coding: utf-8 -*-
"""Πυρήνας v50.158 · T-RAIN-ACC-01 (Α3 του ελέγχου μετεωρολογικών, εντολή Μιχάλη «πρέπει να διορθώσουμε τα λάθη
και να κάνουμε λογικούς ελέγχους στα πάντα»).

ΕΠΙΒΕΒΑΙΩΜΕΝΟ ΖΩΝΤΑΝΑ 3/10: στους 26 σταθμούς S2120 με firmware 2.x ο πυρήνας ΔΕΝ έβλεπε καμία βροχή
(Μπότζης 1/10 και Α2 Σταυρακάκης 3/10: «Δρόσος (εκτίμηση)» / «Στεγνό» μέσα σε δυνατή βροχή). Το `sum` στο
`rain_height` επιστρέφει 0 και όχι «τίποτα», οπότε η εφεδρεία δεν ενεργοποιούνταν· και η εφεδρεία ήταν λάθος
μέγεθος (ρυθμός, όχι ποσότητα).
Ο βαθμονομημένος μετρητής `rain_height_acc` συμφωνεί με το Αστεροσκοπείο στα Ανώγεια (0,87) → πηγή αλήθειας.

Νέο: η 24ωρη και η ωριαία βροχή βγαίνουν ΠΡΩΤΑ από τη διαφορά του μετρητή, με λογικούς ελέγχους:
  · σιωπηλός σταθμός (τελευταία τιμή > 3 ω) → όχι ποσότητα·
  · καμία τιμή πριν το παράθυρο, ή κενό > 3 ω (24ωρο) / 30΄ (ωριαίο) → όχι ποσότητα·
  · μηδενισμός μετρητή (αρνητική διαφορά) → άθροισμα θετικών βημάτων από τη σειρά·
  · βήμα ή σύνολο πάνω από 450 mm/h (όριο κατασκευαστή) → απορρίπτεται.
Αν ο μετρητής δεν δίνει έγκυρη τιμή, ισχύει η ΠΑΛΙΑ διαδρομή αυτούσια (σταθμοί fw 1.13).
Καμία αγρονομική σταθερά· το 450 mm/h είναι όριο οργάνου (έλεγχος ευλογοφάνειας). Καμία βάνα.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.157 · 2026-10-04';",
    "const SAG_KERNEL_VERSION = 'v50.158 · 2026-10-04';", "έκδοση v50.158")

# 1 · οι βοηθοί, δίπλα στο ρολόι της εκτέλεσης
sub("function _sagRunClock() {\n",
    "// ── T-RAIN-ACC-01 (v50.158) · Η ΒΡΟΧΗ ΑΠΟ ΤΟΝ ΜΕΤΡΗΤΗ ──────────────────────────\n"
    "// Ο S2120 με firmware 2.x στέλνει σωρευτικό μετρητή βροχής (`rain_height_acc`, βήμα 0,254 mm, βαθμονομημένος στο\n"
    "// πεδίο). Το `rain_gauge` είναι ΡΥΘΜΟΣ από το διάστημα ανατροπών — το άθροισμά του δεν είναι βροχή (μετρημένο 3/10:\n"
    "// ×2,7 του μετρητή· ο μετρητής = 0,87 του Αστεροσκοπείου στα Ανώγεια). Βροχή παραθύρου = τιμή μετρητή στο τέλος −\n"
    "// τιμή στην αρχή, με λογικούς ελέγχους. Επιστρέφει { ok, mm } ή { ok:false, why }.\n"
    "const _SAG_RAIN_MAX_MMH = 450;          // όριο οργάνου S2120 (datasheet 0–450 mm/h): έλεγχος ευλογοφάνειας\n"
    "const _SAG_RAIN_ACC_FRESH_MIN = 180;    // τελευταία τιμή παλαιότερη → σιωπηλός σταθμός, όχι «μηδέν βροχή»\n"
    "async function _sagAccPointAtOrBefore(device, iso) {\n"
    "  const r = await device.getData({ variables: ['rain_height_acc'], end_date: iso, qty: 1, ordination: 'descending' });\n"
    "  const e = Array.isArray(r) && r.length ? r[0] : null;\n"
    "  if (!e) return null;\n"
    "  const v = Number(e.value), t = Date.parse(e.time);\n"
    "  return (Number.isFinite(v) && Number.isFinite(t)) ? { v, t } : null;\n"
    "}\n"
    "async function _sagRainFromCounter(device, startISO, endISO, endPt, maxLeadMin) {\n"
    "  try {\n"
    "    const endMs = Date.parse(endISO), startMs = Date.parse(startISO);\n"
    "    const e = (endPt !== undefined) ? endPt : await _sagAccPointAtOrBefore(device, endISO);\n"
    "    if (!e) return { ok: false, why: 'χωρίς μετρητή', end: null };\n"
    "    if ((endMs - e.t) / 60000 > _SAG_RAIN_ACC_FRESH_MIN) return { ok: false, why: 'σιωπηλός σταθμός', end: e };\n"
    "    const st = await _sagAccPointAtOrBefore(device, startISO);\n"
    "    if (!st) return { ok: false, why: 'καμία τιμή πριν το παράθυρο', end: e };\n"
    "    if ((startMs - st.t) / 60000 > maxLeadMin) return { ok: false, why: 'κενό πριν το παράθυρο', end: e };\n"
    "    let mm = e.v - st.v, resets = 0, dropped = 0;\n"
    "    if (mm < -0.001) {\n"
    "      // Μηδενισμός μέσα στο παράθυρο: άθροισμα θετικών βημάτων· μετά τον μηδενισμό μετρά η νέα τιμή.\n"
    "      const ser = await device.getData({ variables: ['rain_height_acc'], start_date: new Date(st.t).toISOString(),\n"
    "        end_date: endISO, qty: 2000, ordination: 'ascending' });\n"
    "      const P = (Array.isArray(ser) ? ser : []).map(x => ({ v: Number(x.value), t: Date.parse(x.time) }))\n"
    "        .filter(x => Number.isFinite(x.v) && Number.isFinite(x.t)).sort((a, b) => a.t - b.t);\n"
    "      mm = 0;\n"
    "      for (let i = 1; i < P.length; i++) {\n"
    "        const dh = Math.max((P[i].t - P[i - 1].t) / 3600000, 1 / 60);\n"
    "        let d = P[i].v - P[i - 1].v;\n"
    "        if (d < -0.001) { resets++; d = P[i].v; }\n"
    "        if (d > _SAG_RAIN_MAX_MMH * dh + 0.254) { dropped++; continue; }   // αδύνατο βήμα: απορρίπτεται\n"
    "        if (d > 0) mm += d;\n"
    "      }\n"
    "      if (resets === 0) return { ok: false, why: 'αρνητική διαφορά χωρίς μηδενισμό', end: e };\n"
    "    }\n"
    "    const spanH = Math.max((e.t - st.t) / 3600000, 1 / 60);\n"
    "    if (!(mm >= 0) || mm > _SAG_RAIN_MAX_MMH * spanH + 0.254) return { ok: false, why: 'αδύνατη τιμή μετρητή', end: e };\n"
    "    return { ok: true, mm: Math.round(mm * 1000) / 1000, resets, dropped, end: e };\n"
    "  } catch (x) { return { ok: false, why: 'ανάγνωση απέτυχε', end: null }; }\n"
    "}\n"
    "\n"
    "function _sagRunClock() {\n",
    "βοηθοί μετρητή βροχής")

# 2 · 24ωρο: πρώτα ο μετρητής· η παλιά διαδρομή ΜΟΝΟ αν ο μετρητής δεν έδωσε έγκυρη τιμή
sub("        let totalRain;\n"
    "        try {\n"
    "          totalRain = await device.getData({\n"
    "            variables: [\"rain_height\"],\n"
    "            query: \"sum\",\n"
    "            start_date: start,\n"
    "            end_date: now,\n"
    "          });\n"
    "        }\n",
    "        // T-RAIN-ACC-01 (v50.158): ΠΡΩΤΑ ο βαθμονομημένος μετρητής. Η διαδρομή από κάτω (ρυθμός) μένει\n"
    "        // ΜΟΝΟ για σταθμούς χωρίς μετρητή (firmware 1.13) — ζωντανά 3/10 έδινε 0 στους 26 με μετρητή.\n"
    "        let _accEnd;\n"
    "        try { _accEnd = await _sagAccPointAtOrBefore(device, now); } catch (e) { _accEnd = null; }\n"
    "        const _accDay = _accEnd ? await _sagRainFromCounter(device, start, now, _accEnd, 180) : { ok: false, why: 'χωρίς μετρητή' };\n"
    "        if (_accEnd && !_accDay.ok) {\n"
    "          console.log(`[${info?.name || value}] T-RAIN-ACC-01: μετρητής βροχής 24ω ΑΚΥΡΟΣ (${_accDay.why}) — καμία ποσότητα από τον μετρητή.`);\n"
    "        }\n"
    "        let totalRain;\n"
    "        if (_accDay.ok) {\n"
    "          totalRain = [{ variable: rainKey, value: parseFloat(_accDay.mm.toFixed(2)), unit: \"mm\" }];\n"
    "          if (_accDay.mm > 0 || _accDay.resets || _accDay.dropped) {\n"
    "            console.log(`[${info?.name || value}] T-RAIN-ACC-01: βροχή 24ω από μετρητή ${_accDay.mm.toFixed(2)} mm`\n"
    "              + (_accDay.resets ? ` · μηδενισμοί ${_accDay.resets}` : '') + (_accDay.dropped ? ` · απορρίφθηκαν ${_accDay.dropped} αδύνατα βήματα` : ''));\n"
    "          }\n"
    "        } else\n"
    "        try {\n"
    "          totalRain = await device.getData({\n"
    "            variables: [\"rain_height\"],\n"
    "            query: \"sum\",\n"
    "            start_date: start,\n"
    "            end_date: now,\n"
    "          });\n"
    "        }\n",
    "24ωρο: μετρητής πρώτα")
sub("        const _rainEmpty = !Array.isArray(totalRain) || totalRain.length === 0\n"
    "          || !Number.isFinite(Number(totalRain[0]?.value));\n"
    "        if (_rainEmpty) {\n",
    "        const _rainEmpty = !_accDay.ok && (!Array.isArray(totalRain) || totalRain.length === 0\n"
    "          || !Number.isFinite(Number(totalRain[0]?.value)));\n"
    "        if (_accDay.ok) { /* T-RAIN-ACC-01: η ποσότητα ήρθε από τον μετρητή */ }\n"
    "        else if (_rainEmpty) {\n",
    "24ωρο: η παλιά εφεδρεία μόνο χωρίς μετρητή")

# 3 · ωριαίο: πρώτα ο μετρητής (ίδιο σημείο τέλους, ανοχή κενού 30΄)
sub("        try {\n"
    "          const _h1 = await device.getData({\n",
    "        // T-RAIN-ACC-01: ωριαία βροχή από τον μετρητή (ίδιο σημείο τέλους, κενό πριν την ώρα ≤ 30΄).\n"
    "        if (_accEnd) {\n"
    "          const _accH = await _sagRainFromCounter(device, moment(now).subtract(1, 'hours').toISOString(), now, _accEnd, 30);\n"
    "          if (_accH.ok) deviceData.rain_height_hourly = _accH.mm;\n"
    "        }\n"
    "        if (deviceData.rain_height_hourly === undefined && !_accDay.ok) try {\n"
    "          const _h1 = await device.getData({\n",
    "ωριαίο: μετρητής πρώτα")
sub("        if (deviceData.rain_height_hourly === undefined) {\n"
    "          try {\n"
    "            const _g1 = await device.getData({\n",
    "        if (deviceData.rain_height_hourly === undefined && !_accDay.ok) {\n"
    "          try {\n"
    "            const _g1 = await device.getData({\n",
    "ωριαίο: εφεδρεία ρυθμού μόνο χωρίς μετρητή")

out = s.replace("\n", "\r\n").encode("utf-8"); assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
