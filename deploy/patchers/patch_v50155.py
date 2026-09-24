# -*- coding: utf-8 -*-
"""Πυρήνας v50.155 · T-CARD-COHERENCE-01 (εντολή Μιχάλη 24/9, κάρτα υγείας Κουτσάκη).
Έξι συμπαγείς αλλαγές, καμία αγρονομική σταθερά:
  T-ECWORST-01     η ημερήσια κρίση αλατότητας από το ΧΕΙΡΟΤΕΡΟ βάθος (εγκρίθηκε ρητά)
  T-FCTEXT-02      παλιά πρόγνωση = θέμα πλατφόρμας, όχι οδηγίες για ετικέτες στον αγρότη
  T-METCOVERED-01  αισθητήρας κόμης σε καλυμμένη καλλιέργεια = πράσινο, σωστό όργανο
  T-ACCUMNUM-01    οι τρεις «ενεργές» γραμμές λένε αριθμό (βαθμοημέρες από πότε, εχθροί, μύκητες/μέγ. ώρες)
  T-BPI-SOILTXT-01 «Ζεστό/Κρύο έδαφος» λέει τι μέτρησε και με τι το σύγκρινε (Topt ΑΜΕΤΑΒΛΗΤΟ)
CRLF, count==1, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf" and raw.count(b"\n") == raw.count(b"\r\n")
s = raw.decode("utf-8").replace("\r\n", "\n"); print("ΠΡΙΝ sha256", hashlib.sha256(raw).hexdigest()[:16], "bytes", len(raw))
def sub(old, new, label):
    global s; c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)

sub("const SAG_KERNEL_VERSION = 'v50.154 · 2026-09-24';",
    "const SAG_KERNEL_VERSION = 'v50.155 · 2026-09-24';", "έκδοση v50.155")

# ── T-ECWORST-01 ─────────────────────────────────────────────────────────────
sub("            const _eceHow = _eceFromChain\n"
    "              ? ' (από μετρημένη υγρασία, Hilhorst 2000)'\n"
    "              : ' (ενδεικτικά ×2,5 — λείπει μέτρηση υγρασίας)';\n",
    "            const _eceHow = _eceFromChain\n"
    "              ? ' (από μετρημένη υγρασία, Hilhorst 2000)'\n"
    "              : ' (ενδεικτικά ×2,5 — λείπει μέτρηση υγρασίας)';\n"
    "            // T-ECWORST-01 (v50.155, εντολή Μιχάλη 24/9): η ημερήσια κρίση από το ΧΕΙΡΟΤΕΡΟ βάθος — όπως ήδη το νερό ρίζας (refF = max). Ως τώρα το βαθύ ECe δεν έμπαινε σε καμία κρίση (Κουτσάκης: ρηχό 1,2 / βαθύ 2,0, όριο 2,5).\n"
    "            const _eceChain2 = (e2 === null || !_ecNum1) ? null : _sagEcChain(e2, _nE('soil_moisture2'), _nE('soil_temperature2'), _ecSatE).ece;\n"
    "            const _eceW = (_eceChain2 !== null && (_eceChain === null || _eceChain2 > _eceChain)) ? { v: _eceChain2, el: 'βαθύ', how: ' (βαθύ, από μετρημένη υγρασία, Hilhorst 2000)' }\n"
    "              : (_eceChain !== null ? { v: _eceChain, el: 'ρηχό', how: ' (ρηχό, από μετρημένη υγρασία, Hilhorst 2000)' }\n"
    "              : { v: (e1 !== null ? _eceEst(e1) : NaN), el: 'ρηχό', how: _eceHow });\n",
    "T-ECWORST-01 επιλογή χειρότερου βάθους")
sub("                eceMax: _eceMax, eceEst: (e1 !== null ? _eceEst(e1) : NaN), eceHow: _eceHow,\n",
    "                eceMax: _eceMax, eceEst: _eceW.v, eceHow: _eceW.how,   // T-ECWORST-01\n",
    "T-ECWORST-01 κρίση ημέρας")
sub("                const _eceNow = _eceEst(e1);\n",
    "                const _eceNow = _eceW.v;   // T-ECWORST-01: χειρότερο βάθος\n",
    "T-ECWORST-01 Ks")
sub("                      ? 'Maas-Hoffman (FAO-29/56): ECe~' + _eceNow.toFixed(1) + _eceHow\n",
    "                      ? 'Maas-Hoffman (FAO-29/56): ECe~' + _eceNow.toFixed(1) + _eceW.how\n",
    "T-ECWORST-01 κείμενο κόκκινο")
sub("                      : 'ECe~' + _eceNow.toFixed(1) + _eceHow + ' ≤ όριο ' + _eceMax + ' dS/m της πιο ευαίσθητης καλλιέργειας.' } });\n",
    "                      : 'ECe~' + _eceNow.toFixed(1) + _eceW.how + ' ≤ όριο ' + _eceMax + ' dS/m της πιο ευαίσθητης καλλιέργειας.' } });\n",
    "T-ECWORST-01 κείμενο πράσινο")

# ── T-FCTEXT-02 ──────────────────────────────────────────────────────────────
sub("    return [{ variable: 'forecast_status', value: 'Μη διαθέσιμη',\n"
    "      metadata: { color: 'grey',\n"
    "        text: 'Δεν υπάρχει έγκυρη πρόγνωση για αυτόν τον αγρό: '\n",
    "    // T-FCTEXT-02 (v50.155): παλιά πρόγνωση = θέμα πλατφόρμας. Ο αγρός ΕΧΕΙ πρόγνωση — δεν του ζητάμε να ελέγξει ετικέτες και analyses.\n"
    "    if (fcs && Number.isFinite(fcs.ageH) && fcs.ageH > _SAG_FORECAST_MAX_AGE_H) {\n"
    "      return [{ variable: 'forecast_status', value: 'Παλιά πρόγνωση',\n"
    "        metadata: { color: 'grey',\n"
    "          text: 'Τελευταία λήψη πριν ' + Math.round(fcs.ageH) + ' ώρες, όριο ' + _SAG_FORECAST_MAX_AGE_H\n"
    "            + ' ώρες. Η πλατφόρμα την ανανεώνει δύο φορές την ημέρα (00:03 και 12:03) — δεν χρειάζεται ενέργεια από τον αγρό. '\n"
    "            + 'Μέχρι τότε δεν βγαίνουν προειδοποιήσεις παγετού ή καύσωνα.' } }];\n"
    "    }\n"
    "    return [{ variable: 'forecast_status', value: 'Μη διαθέσιμη',\n"
    "      metadata: { color: 'grey',\n"
    "        text: 'Δεν υπάρχει έγκυρη πρόγνωση για αυτόν τον αγρό: '\n",
    "T-FCTEXT-02 παλιά πρόγνωση")

# ── T-METCOVERED-01 ──────────────────────────────────────────────────────────
sub("function _sagMetSourceIndicators(data) {\n",
    "function _sagMetSourceIndicators(data, covered) {   // T-METCOVERED-01 (v50.155): covered = καλυμμένη καλλιέργεια\n",
    "T-METCOVERED-01 υπογραφή")
sub("    metadata: { color: s === 'station' ? 'green' : 'orange',\n"
    "      text: s === 'station'\n"
    "        ? 'Οι θερμοκρασίες αναφοράς προέρχονται από τον μετεωρολογικό σταθμό.'\n"
    "        : 'Χωρίς μετεωρολογικό σταθμό: οι θερμοκρασίες έρχονται από τον αισθητήρα '\n",
    "    metadata: { color: (s === 'station' || covered) ? 'green' : 'orange',\n"
    "      text: s === 'station'\n"
    "        ? 'Οι θερμοκρασίες αναφοράς προέρχονται από τον μετεωρολογικό σταθμό.'\n"
    "        : covered\n"
    "        ? 'Καλυμμένη καλλιέργεια: οι θερμοκρασίες αναφοράς από τον αισθητήρα κόμης — το σωστό όργανο μέσα σε θερμοκήπιο, όπου δεν υπάρχει «έκθεση 2 m».'   // T-METCOVERED-01\n"
    "        : 'Χωρίς μετεωρολογικό σταθμό: οι θερμοκρασίες έρχονται από τον αισθητήρα '\n",
    "T-METCOVERED-01 κείμενο")
sub("            ..._sagMetSourceIndicators(measurements?.data),\n",
    "            ..._sagMetSourceIndicators(measurements?.data, !!fieldConfig?.covered_cultivation),   // T-METCOVERED-01\n",
    "T-METCOVERED-01 κλήση")

# ── T-ACCUMNUM-01 ────────────────────────────────────────────────────────────
sub("    { variable: \"gdd_season_key\", value: _seasonKey, metadata: { internal: true } },\n"
    "    _cgOk,\n"
    "  ];\n",
    "    { variable: \"gdd_season_key\", value: _seasonKey, metadata: { internal: true } },\n"
    "    // T-ACCUMNUM-01 (v50.155): «ενεργές» χωρίς αριθμό δεν λέει τίποτα — πόσες βαθμοημέρες, από πότε.\n"
    "    Object.assign(_cgOk, { value: 'Ενεργές · ' + Math.round(newAccum) + ' °C·ημ'\n"
    "      + (function () { try { const d = _sagSeasonStartDate(_seasonKey); return d ? ' από ' + d.getDate() + '/' + (d.getMonth() + 1) : ''; } catch (_e) { return ''; } })() }),\n"
    "  ];\n",
    "T-ACCUMNUM-01 βαθμοημέρες καλλιέργειας")
sub("          : { variable: 'gdd_pest_status', value: 'Βαθμοημέρες εχθρών: ενεργές',\n"
    "              metadata: { color: 'green' } };\n",
    "          : { variable: 'gdd_pest_status',   // T-ACCUMNUM-01: πόσοι εχθροί παρακολουθούνται\n"
    "              value: (function () { const n = gddIndicators.filter(x => x && typeof x.variable === 'string' && x.variable.indexOf(GDD_ACCUMULATED_PREFIX) === 0).length; return 'Ενεργές · ' + n + (n === 1 ? ' εχθρός' : ' εχθροί'); })(),\n"
    "              metadata: { color: 'green' } };\n",
    "T-ACCUMNUM-01 εχθροί")
sub("    : { variable: 'infection_model_status', value: 'Ώρες μόλυνσης: ενεργές',\n"
    "        metadata: { color: 'green' } });\n",
    "    : _ihOk);\n",
    "T-ACCUMNUM-01 μύκητες (push)")
sub("  indicators.push(_ihFrozen\n"
    "    ? { variable: 'infection_model_status', value: 'Σε παύση — παλιά μέτρηση',\n",
    "  const _ihOk = { variable: 'infection_model_status', value: 'Ώρες μόλυνσης: ενεργές', metadata: { color: 'green' } };   // T-ACCUMNUM-01: η τιμή συμπληρώνεται μετά τον βρόχο\n"
    "  indicators.push(_ihFrozen\n"
    "    ? { variable: 'infection_model_status', value: 'Σε παύση — παλιά μέτρηση',\n",
    "T-ACCUMNUM-01 μύκητες (δήλωση)")
sub("      indicators.push({ variable: _fbDhKey, value: parseFloat(_fbNew.toFixed(2)) });\n"
    "    }\n"
    "  }\n"
    "\n"
    "  return indicators;\n"
    "}\n",
    "      indicators.push({ variable: _fbDhKey, value: parseFloat(_fbNew.toFixed(2)) });\n"
    "    }\n"
    "  }\n"
    "  // T-ACCUMNUM-01 (v50.155): πόσοι μύκητες παρακολουθούνται και ο ψηλότερος μετρητής ωρών.\n"
    "  if (!_ihFrozen) { const _c = indicators.filter(x => x && typeof x.variable === 'string' && x.variable.indexOf(INFECTION_HOURS_COUNTER_PREFIX) === 0);\n"
    "    const _m = _c.reduce((a, x) => Math.max(a, Number(x.value) || 0), 0);\n"
    "    _ihOk.value = 'Ενεργές · ' + _c.length + (_c.length === 1 ? ' μύκητας' : ' μύκητες') + ' · μέγ. ' + Math.round(_m) + ' ω'; }\n"
    "\n"
    "  return indicators;\n"
    "}\n",
    "T-ACCUMNUM-01 μύκητες (τιμή)")

# ── T-BPI-SOILTXT-01 ─────────────────────────────────────────────────────────
sub("      diagnosis = _soilHot\n"
    "        ? { code: \"ROOT_HEAT\", message: \"Περιορισμός: Ζεστό Έδαφος (Ρίζα)\", color: \"#e67e22\" }\n"
    "        : { code: \"ROOT_STRESS\", message: \"Περιορισμός: Κρύο Έδαφος (Ρίζα)\", color: \"#f1c40f\" };\n",
    "      // T-BPI-SOILTXT-01 (v50.155): η κρίση λέει ΤΙ μέτρησε και ΜΕ ΤΙ το σύγκρινε — αλλιώς «Ζεστό έδαφος» δίπλα σε «27,3 °C μετρημένη» διαβάζεται ως αντίφαση. Το όριο ΔΕΝ αλλάζει.\n"
    "      const _soilTxt = 'Μέσος 24ώρου εδάφους ' + soilTemp_avg.toFixed(1) + ' °C, ' + (_soilHot ? 'πάνω' : 'κάτω') + ' από το βέλτιστο ' + _soilTrap.opt.toFixed(0) + ' °C της καλλιέργειας. Μετρά στην ανάπτυξη (BPI)· η ανάγκη για νερό κρίνεται χωριστά.';\n"
    "      diagnosis = _soilHot\n"
    "        ? { code: \"ROOT_HEAT\", message: \"Περιορισμός: Ζεστό Έδαφος (Ρίζα)\", color: \"#e67e22\", text: _soilTxt }\n"
    "        : { code: \"ROOT_STRESS\", message: \"Περιορισμός: Κρύο Έδαφος (Ρίζα)\", color: \"#f1c40f\", text: _soilTxt };\n",
    "T-BPI-SOILTXT-01")

out = s.replace("\n", "\r\n").encode("utf-8"); assert out.count(b"\n") == out.count(b"\r\n")
tmp = P.replace(".js", ".check.js"); io.open(tmp, "wb").write(out)
r = subprocess.run(["node", "--check", tmp], capture_output=True); os.remove(tmp)
if r.returncode: print(r.stderr.decode("utf-8", "replace")); raise SystemExit("node --check ΑΠΕΤΥΧΕ")
io.open(P, "wb").write(out); chk = io.open(P, "rb").read(); assert chk.count(b"\n") == chk.count(b"\r\n")
print("ΜΕΤΑ sha256", hashlib.sha256(chk).hexdigest(), "bytes", len(chk), "CRLF", chk.count(b"\r\n"))
