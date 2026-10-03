# -*- coding: utf-8 -*-
"""Πυρήνας v50.157 · T-WXCLEAR-01 (Α1 του ελέγχου μετεωρολογικών 4/10, εντολή Μιχάλη «προχώρα με την Α1»).
Οι προειδοποιήσεις από πρόγνωση (καύσωνας, παγετός, βροχή μπροστά, μόλυνση μπροστά) και η
ζεστή νύχτα γράφονταν ΜΟΝΟ όταν ίσχυαν και δεν έσβηναν ποτέ ρητά:
  · ο πυρήνας τις ξαναγέμιζε από το προηγούμενο bundle — 50 ώρες για τα weather_alert_*, γιατί
    ο κανόνας λήξης έψαχνε το ΠΑΛΙΟ όνομα (frost|heat)_warning·
  · το widget τις κρατά στο localStorage και τις ξαναβάζει ΟΣΟ λείπουν από το bundle — για πάντα.
Τώρα, με ΕΓΚΥΡΗ πρόγνωση και καμία προειδοποίηση, γράφεται το κλειδί με κενή τιμή (όπως ήδη το
emitIrrigationState). Η κενή τιμή εμποδίζει τη μεταφορά-εμπρός, αντικαθιστά την cache του widget,
και το widget την παραλείπει (κάρτα συναγερμών `!S.value`, κάρτα υγείας `value!==null`).
Χωρίς έγκυρη πρόγνωση: μεταφορά όπως πριν, αλλά πλέον 12 ω· όταν λήξει ένας ΠΡΑΓΜΑΤΙΚΟΣ
συναγερμός, μένει «ταφόπλακα» κενής τιμής ώστε η cache του widget να μη τον αναστήσει.
Καμία αγρονομική σταθερά, κανένα κατώφλι, καμία αλλαγή σε δόση/βάνες.
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.156 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.157 · 2026-10-04';", "έκδοση v50.157")

# 1 · κανόνας λήξης: το ΣΗΜΕΡΙΝΟ όνομα των κλειδιών (κρατιέται και το παλιό, αβλαβές)
sub("  [/^(frost|heat)_warning$/, _SAG_TTL_HOURLY_H],\n",
    "  // T-WXCLEAR-01 (v50.157): τα κλειδιά μετονομάστηκαν σε weather_alert_* στη v50.131 (T-WXALERT-01)\n"
    "  // και ο κανόνας έμεινε με το παλιό όνομα — έπαιρναν την προεπιλογή των 50 ωρών. Μετρημένο 3/10:\n"
    "  // «Καύσωνας» στον Κουτσάκη με πρόγνωση 16-18 °C.\n"
    "  [/^(weather_alert_(frost|heat)|(frost|heat)_warning)$/, _SAG_TTL_HOURLY_H],\n",
    "TTL weather_alert_* 12 ω")

# 2 · ταφόπλακα στη λήξη πραγματικού συναγερμού (μόνο για όσα κρατά η cache του widget)
sub("const _SAG_TTL_DEFAULT_H = 50;\n",
    "const _SAG_TTL_DEFAULT_H = 50;\n"
    "// T-WXCLEAR-01 (v50.157): το widget κρατά τα weather_alert_* στο localStorage και τα ξαναβάζει\n"
    "// ΟΣΟ λείπουν από το bundle. Αν ένας πραγματικός συναγερμός απλώς εξαφανιζόταν στη λήξη, η\n"
    "// cache θα τον ανέσταινε για πάντα. Στη λήξη μένει κενή τιμή, που η cache αποθηκεύει στη θέση του.\n"
    "const _SAG_WX_TOMBSTONE = /^weather_alert_(frost|heat)$/;\n",
    "σταθερά ταφόπλακας")
sub("  if (ageH > ttl) { stats.dropped.push(key); return null; }\n",
    "  if (ageH > ttl) {\n"
    "    stats.dropped.push(key);\n"
    "    // T-WXCLEAR-01: ταφόπλακα ΜΙΑ φορά — η ίδια η ταφόπλακα (κενή τιμή) λήγει κανονικά.\n"
    "    if (_SAG_WX_TOMBSTONE.test(key) && e.value !== null && e.value !== undefined && e.value !== '')\n"
    "      return { value: null, metadata: { _t: nowMin } };\n"
    "    return null;\n"
    "  }\n",
    "ταφόπλακα στο _sagCarryEntry")

# 3 · βοηθός: ρητό σβήσιμο όταν η πρόγνωση είναι έγκυρη
sub("// ── Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΠΡΟΓΝΩΣΗΣ · ΠΑΝΤΑ, ΚΑΙ ΟΤΑΝ ΛΕΙΠΕΙ ─────────────────\n",
    "// ── T-WXCLEAR-01 (v50.157) · Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΠΟΥ ΔΕΝ ΙΣΧΥΕΙ ΣΒΗΝΕΙ ΡΗΤΑ ──────\n"
    "// Οι συναρτήσεις παραπάνω επιστρέφουν [] όταν δεν υπάρχει προειδοποίηση. Το [] σημαίνει «λείπει»,\n"
    "// και ό,τι λείπει το ξαναγεμίζει η μεταφορά-εμπρός από το προηγούμενο bundle (και η cache του\n"
    "// widget, για πάντα). Με ΕΓΚΥΡΗ πρόγνωση το «καμία προειδοποίηση» είναι ΑΠΑΝΤΗΣΗ, όχι έλλειψη:\n"
    "// γράφεται κενή τιμή. Χωρίς έγκυρη πρόγνωση ΔΕΝ ξέρουμε — μένει η μεταφορά (12 ω).\n"
    "// Οι ίδιες οι συναρτήσεις ΔΕΝ αλλάζουν: το push του παγετού διαβάζει το [0] τους απευθείας.\n"
    "function _sagWxClear(fcs, items, key) {\n"
    "  const out = Array.isArray(items) ? items : [];\n"
    "  if (!fcs || !fcs.ok) return out;\n"
    "  if (out.some(x => x && x.variable === key)) return out;\n"
    "  return out.concat([{ variable: key, value: null, metadata: {} }]);\n"
    "}\n"
    "\n"
    "// ── Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΠΡΟΓΝΩΣΗΣ · ΠΑΝΤΑ, ΚΑΙ ΟΤΑΝ ΛΕΙΠΕΙ ─────────────────\n",
    "βοηθός _sagWxClear")

# 4 · σημεία κλήσης — επίπεδο αγρού
sub("            ..._sagFrostIndicators(_sagFcOf(measurements)),\n",
    "            // T-WXCLEAR-01: με έγκυρη πρόγνωση χωρίς παγετό γράφεται κενή τιμή.\n"
    "            ..._sagWxClear(_sagFcOf(measurements), _sagFrostIndicators(_sagFcOf(measurements)),\n"
    "              'weather_alert_frost'),\n",
    "παγετός → _sagWxClear")
sub("            ..._sagRainAheadIndicators(_sagFcOf(measurements)),\n",
    "            ..._sagWxClear(_sagFcOf(measurements), _sagRainAheadIndicators(_sagFcOf(measurements)),\n"
    "              'rain_ahead'),   // T-WXCLEAR-01\n",
    "βροχή μπροστά → _sagWxClear")

# 5 · σημεία κλήσης — ανά καλλιέργεια
sub("            for (const _hw of _sagHeatIndicators(_sagFcOf(measurementsForCrop), _cpProf)) {\n",
    "            // T-WXCLEAR-01: με έγκυρη πρόγνωση χωρίς ζέστη γράφεται κενή τιμή.\n"
    "            for (const _hw of _sagWxClear(_sagFcOf(measurementsForCrop),\n"
    "                   _sagHeatIndicators(_sagFcOf(measurementsForCrop), _cpProf), 'weather_alert_heat')) {\n",
    "καύσωνας → _sagWxClear")
sub("            for (const _ia of _sagInfectionAheadIndicators(\n"
    "                   _sagFcOf(measurementsForCrop), cropParams, PATHOGEN_PROFILE, _already)) {\n",
    "            for (const _ia of _sagWxClear(_sagFcOf(measurementsForCrop), _sagInfectionAheadIndicators(\n"
    "                   _sagFcOf(measurementsForCrop), cropParams, PATHOGEN_PROFILE, _already),\n"
    "                   'infection_ahead')) {   // T-WXCLEAR-01\n",
    "μόλυνση μπροστά → _sagWxClear")

# 6 · push καύσωνα: η κενή τιμή ΔΕΝ είναι συναγερμός
sub("            const _hts = _all.filter(x => x && x.variable === 'weather_alert_heat');\n",
    "            // T-WXCLEAR-01: η κενή τιμή (σβήσιμο) ΔΕΝ είναι συναγερμός — αλλιώς push «null».\n"
    "            const _hts = _all.filter(x => x && x.variable === 'weather_alert_heat' && x.value);\n",
    "push καύσωνα αγνοεί κενή τιμή")

# 7 · ζεστή νύχτα: ημερήσια, σβήνει όταν η μετρημένη ελάχιστη είναι κάτω από το όριο
sub("          threshold_critical: nt.critical,\n"
    "        }\n"
    "      });\n"
    "    }\n"
    "  }\n"
    "  // ── End E1 ",
    "          threshold_critical: nt.critical,\n"
    "        }\n"
    "      });\n"
    "    } else if (nt) {\n"
    "      // T-WXCLEAR-01 (v50.157): μετρημένη ελάχιστη κάτω από το όριο = ΑΠΑΝΤΗΣΗ «όχι ζεστή νύχτα».\n"
    "      // Χωρίς αυτό η χθεσινή προειδοποίηση έμενε 50 ώρες πάνω από μια δροσερή νύχτα.\n"
    "      bpiIndicators.push({ variable: \"night_temp_warning\", value: null, metadata: {} });\n"
    "    }\n"
    "  }\n"
    "  // ── End E1 ",
    "ζεστή νύχτα σβήνει")

out = s.replace("\n", "\r\n").encode("utf-8"); assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
