# T-EXPORT-UTC-01 (27/11/2026, απόφαση Michalis «UTC παντού και στήλη UTC στην εξαγωγή»).
# fieldExportData.js: κάθε χρονοσήμανση σε UTC (ISO 8601) + στήλη ώρας Ελλάδας ΜΕ τη ζώνη της· ημερήσιος κίνδυνος ασθενειών σε
# ημέρα UTC· ονόματα/θέματα αρχείων σε UTC· το email συνοδεύεται ΠΑΝΤΑ από περιγραφή (χρόνος αναφοράς, μεταβλητές του αρχείου,
# γνωστά ζητήματα, τελευταίες αλλαγές συστήματος, σύνδεσμος στο ημερολόγιο). Η περιγραφή διαβάζεται από τα δημόσια αρχεία
# html_files/sag-data-dictionary.json και html_files/sag-changelog.json· αν λείπουν, το email λέει πού βρίσκονται.
import sys, subprocess
P = sys.argv[1]
_raw = open(P, 'rb').read().decode('utf-8')
CRLF = '\r\n' in _raw
s = _raw.replace('\r\n', '\n')   # δουλεύουμε σε LF· γράφεται πίσω με τις αρχικές αλλαγές γραμμής


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, (n, old[:90])
    s = s.replace(old, new)


sub("""** ---- Disease record (T-EXPORT-DISEASE-01, 22/11/2026) -------------------""",
"""** ---- Time reference (T-EXPORT-UTC-01, 27/11/2026) -----------------------
** Every timestamp is UTC, ISO 8601 («2026-10-25T00:30:00Z»). The default layout
** adds a second column with the same instant in Greek time WITH its offset
** («2026-10-25 03:30 +03:00»). Pair mode carries UTC only. Daily disease risk is
** grouped by UTC day. File names / subjects use UTC dates. Before this change the
** export wrote Greek local time without an offset (changelog SC-0002).
** Every email carries a description: time reference, the variables in the file
** (from html_files/sag-data-dictionary.json), known issues and the latest system
** changes (html_files/sag-changelog.json), with a link to the full change log.
**
** ---- Disease record (T-EXPORT-DISEASE-01, 22/11/2026) -------------------""")

sub("""const VALIDATION_VARIABLE = "validationExport";
""", """const VALIDATION_VARIABLE = "validationExport";

// T-EXPORT-UTC-01: χρόνος αναφοράς UTC + περιγραφή που συνοδεύει κάθε εξαγωγή. Τα δύο JSON είναι δημόσια αρχεία ΧΩΡΙΣ
// στοιχεία πελατών (changelog/ στο git). Μορφή αρχείου «UTC-1» = από 27/11/2026.
const EXPORT_FORMAT_VERSION = "UTC-1";
const FILES_BASE = "https://api.tago.io/file/67934c48e8e573000ae5964b/html_files/";
const CHANGELOG_PAGE = FILES_BASE + "sag-changelog.html";
function fmtUtc(t) { return dayjs(t).utc().format("YYYY-MM-DDTHH:mm:ss[Z]"); }
function fmtLocal(t) { return dayjs(t).tz(TZ).format("YYYY-MM-DD HH:mm Z"); }
async function fetchPublicJson(name) {
  try {
    const r = await fetch(FILES_BASE + name + "?t=" + Date.now());
    return r && r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}
/** Το κείμενο που συνοδεύει τα δεδομένα: χρόνος αναφοράς, μεταβλητές του αρχείου, γνωστά ζητήματα, τελευταίες αλλαγές. */
function describeExport(lang, vars, dict, log) {
  const L = [];
  if (lang === "en") {
    L.push("ABOUT THIS FILE (format " + EXPORT_FORMAT_VERSION + ")");
    L.push("Time reference: every timestamp in the \\"UTC time\\" columns is UTC (ISO 8601). The \\"Greek time\\" column shows the same instant in Greek local time with its offset (+02:00 winter, +03:00 summer).");
    L.push("Variable descriptions and the system change log: " + CHANGELOG_PAGE);
    return L.join("\\n");
  }
  L.push("ΣΧΕΤΙΚΑ ΜΕ ΤΟ ΑΡΧΕΙΟ (μορφή " + EXPORT_FORMAT_VERSION + ")");
  L.push("");
  L.push("Χρόνος αναφοράς: κάθε χρονοσήμανση στις στήλες «Χρόνος UTC» είναι σε UTC (ISO 8601, π.χ. 2026-10-25T00:30:00Z). Η στήλη «Ώρα Ελλάδας» δείχνει την ίδια στιγμή σε ώρα Ελλάδας ΜΕ τη ζώνη της (+02:00 χειμώνα, +03:00 καλοκαίρι). Οι ημερήσιες τιμές κινδύνου ασθενειών αφορούν ημέρα UTC.");
  L.push("Εξαγωγές πριν από 27/11/2026 έγραφαν ώρα Ελλάδας χωρίς ζώνη (ημερολόγιο αλλαγών SC-0002, SC-0004).");
  const d = dict && dict.dictionary && dict.dictionary.variables;
  if (d) {
    L.push("");
    L.push("Μεταβλητές σε αυτό το αρχείο:");
    for (const v of vars) {
      const x = d[v];
      if (!x) { L.push("- " + v + ": χωρίς περιγραφή (" + CHANGELOG_PAGE + ")"); continue; }
      let line = "- " + x.label_el + (x.unit ? " (" + x.unit + ")" : "") + " [" + v + "]: " + x.meaning_el + " Συχνότητα: " + x.sampling_el + ".";
      if (x.aggregation_el) line += " Περίοδος: " + x.aggregation_el + ".";
      if (x.known_issue) line += " ⚠ Γνωστό ζήτημα: " + x.known_issue + ".";
      L.push(line);
    }
  } else {
    L.push("");
    L.push("Η περιγραφή των μεταβλητών δεν ήταν διαθέσιμη τη στιγμή της εξαγωγής· βρίσκεται στο " + CHANGELOG_PAGE);
    if (log) log("describeExport: data dictionary unavailable");
  }
  const E = dict && dict.changelog && Array.isArray(dict.changelog.entries) ? dict.changelog.entries : null;
  if (E && E.length) {
    L.push("");
    L.push("Τελευταίες αλλαγές συστήματος (" + E[E.length - 1].id + "):");
    for (const e of E.slice(-5).reverse()) L.push("- " + e.id + " · " + String(e.date_utc).slice(0, 10) + " · " + e.title_el);
  }
  L.push("");
  L.push("Πλήρες ημερολόγιο αλλαγών και περιγραφή δεδομένων: " + CHANGELOG_PAGE);
  return L.join("\\n");
}
""")

# Ζεύγη: UTC μόνο
sub("""      series[i] = { ts: dayjs(arr[i].time).tz(TZ).format("DD-MM-YYYY HH:mm"), value: arr[i].value };""",
    """      series[i] = { ts: fmtUtc(arr[i].time), value: arr[i].value };   // T-EXPORT-UTC-01""")

# Ασθένειες: ημέρα/ώρα UTC
sub("""    const local = dayjs(b.time).tz(TZ);
    const day = local.format("YYYY-MM-DD");
    const hour = local.format("HH");""",
    """    const u = dayjs(b.time).utc();   // T-EXPORT-UTC-01: ημέρα UTC
    const day = u.format("YYYY-MM-DD");
    const hour = u.format("HH");""")
sub("""      dayjs.tz(a.day, TZ).format("DD-MM-YYYY"),""", """      a.day,""")
sub("""      const when = m.datetimeISO ? dayjs(m.datetimeISO).tz(TZ) : dayjs(p.time).tz(TZ);""",
    """      const when = fmtUtc(m.datetimeISO || p.time);""")
sub("""      declRows.push([when.format("DD-MM-YYYY HH:mm"), entry || summary, "", s(m.productText), "", ""]);""",
    """      declRows.push([when, entry || summary, "", s(m.productText), "", ""]);""")
sub("""    const ts = dayjs(p.time).tz(TZ).format("DD-MM-YYYY HH:mm");""", """    const ts = fmtUtc(p.time);""")
sub("""        sprayDate ? dayjs(sprayDate).format("DD-MM-YYYY") : "",""", """        sprayDate ? String(sprayDate).slice(0, 10) : "",""")
sub("""      const when = Number.isFinite(tMin) && tMin > 0 ? dayjs(tMin * 60000).tz(TZ).format("DD-MM-YYYY HH:mm") : "";""",
    """      const when = Number.isFinite(tMin) && tMin > 0 ? fmtUtc(tMin * 60000) : "";""")

# Κείμενα
sub("""    timestamp: "Χρονοσήμανση",
    timestampFor: (label) => `Χρονοσήμανση ${label}`,""",
    """    timestamp: "Χρόνος UTC",
    timestampLocal: "Ώρα Ελλάδας (με ζώνη)",
    timestampFor: (label) => `Χρόνος UTC · ${label}`,""")
sub("""    subject: (field, part, from, to) => `${field} - Εξαγωγή Μετρήσεων ${part} (${from} - ${to})`,
    body: (part) =>
      `Καλησπέρα,\\n\\nΕπισυνάπτεται ${part} των μετρήσεων για το ζητούμενο χρονικό διάστημα.\\n\\nΜε εκτίμηση,\\nCyRIC IoT`,""",
    """    subject: (field, part, from, to) => `${field} - Εξαγωγή Μετρήσεων ${part} (${from} - ${to} UTC)`,
    body: (part, about) =>
      `Καλησπέρα,\\n\\nΕπισυνάπτεται ${part} των μετρήσεων για το ζητούμενο χρονικό διάστημα.\\n\\n${about}\\n\\nΜε εκτίμηση,\\nCyRIC IoT`,""")
sub("""    riskCols: ["Ημερομηνία", "Καλλιέργεια",""", """    riskCols: ["Ημερομηνία (UTC)", "Καλλιέργεια",""")
sub("""    declCols: ["Χρονοσήμανση", "Καταχώρηση", "Ασθένειες / Εχθροί", "Σκεύασμα", "Ημέρες προστασίας", "Ημερομηνία ψεκασμού"],""",
    """    declCols: ["Χρόνος UTC", "Καταχώρηση", "Ασθένειες / Εχθροί", "Σκεύασμα", "Ημέρες προστασίας", "Ημερομηνία ψεκασμού (όπως δηλώθηκε)"],""")
sub("""    timestamp: "Timestamp",
    timestampFor: (label) => `Timestamp ${label}`,""",
    """    timestamp: "UTC time",
    timestampLocal: "Greek time (with offset)",
    timestampFor: (label) => `UTC time · ${label}`,""")
sub("""    subject: (field, part, from, to) => `${field} - Data Export ${part} (${from} - ${to})`,
    body: (part) =>
      `Hello,\\n\\nPlease find attached ${part} of the measurements for the requested time period.\\n\\nKind Regards,\\nCyRIC IoT`,""",
    """    subject: (field, part, from, to) => `${field} - Data Export ${part} (${from} - ${to} UTC)`,
    body: (part, about) =>
      `Hello,\\n\\nPlease find attached ${part} of the measurements for the requested time period.\\n\\n${about}\\n\\nKind Regards,\\nCyRIC IoT`,""")
sub("""    riskCols: ["Date", "Crop",""", """    riskCols: ["Date (UTC)", "Crop",""")
sub("""    declCols: ["Timestamp", "Entry",""", """    declCols: ["UTC time", "Entry",""")

# Διάστημα σε UTC
sub("""    const startDateString = dayjs(startDate).tz(TZ).format("DD-MM-YYYY HH:mm");
    const endDateString = dayjs(endDate).tz(TZ).format("DD-MM-YYYY HH:mm");""",
    """    // T-EXPORT-UTC-01: διάστημα σε UTC (θέμα) · ημερομηνίες UTC (όνομα αρχείου, χωρίς «:»).
    const startDateString = dayjs(startDate).utc().format("YYYY-MM-DD HH:mm");
    const endDateString = dayjs(endDate).utc().format("YYYY-MM-DD HH:mm");
    const startFileDate = dayjs(startDate).utc().format("YYYY-MM-DD");
    const endFileDate = dayjs(endDate).utc().format("YYYY-MM-DD");""")

# Κεφαλίδες: UTC + ώρα Ελλάδας
sub("""        : 1 + d.varList.length;""", """        : 2 + d.varList.length;   // T-EXPORT-UTC-01: Χρόνος UTC + Ώρα Ελλάδας""")
sub("""        headerRow2.push(t.timestamp);
        for (const v of d.varList) headerRow2.push(labels[v] || v);""",
    """        headerRow2.push(t.timestamp);
        headerRow2.push(t.timestampLocal);
        for (const v of d.varList) headerRow2.push(labels[v] || v);""")
sub("""          row.push(iso ? dayjs(iso).tz(TZ).format("DD-MM-YYYY HH:mm") : "");""",
    """          row.push(iso ? fmtUtc(iso) : "");
          row.push(iso ? fmtLocal(iso) : "");""")

# Περιγραφή στο email
sub("""    const emailService = new Services({ token: context.token }).email;""",
    """    // T-EXPORT-UTC-01: η περιγραφή συνοδεύει ΠΑΝΤΑ τα δεδομένα.
    const exportedVars = [];
    for (const d of perDeviceBlocks) if (!d.table) for (const v of d.varList) if (!exportedVars.includes(v)) exportedVars.push(v);
    const [dictionary, changelog] = await Promise.all([fetchPublicJson("sag-data-dictionary.json"), fetchPublicJson("sag-changelog.json")]);
    const about = describeExport(lang, exportedVars, { dictionary, changelog }, (m) => context.log(m));

    const emailService = new Services({ token: context.token }).email;""")
sub("""        const filename = `${safeFieldName}_${startDateString}-${endDateString}_${p.filenameSuffix}.csv`;""",
    """        const filename = `${safeFieldName}_${startFileDate}_${endFileDate}_UTC_${p.filenameSuffix}.csv`;""")
sub("""          message: t.body(p.filenameSuffix),""", """          message: t.body(p.filenameSuffix, about),""")
sub("""module.exports._test = { decodeBundleKey, decodeBundleCrops, buildDiseaseBlocks, cropLabel, parseDeclaration };""",
    """module.exports._test = { decodeBundleKey, decodeBundleCrops, buildDiseaseBlocks, cropLabel, parseDeclaration, describeExport, fmtUtc, fmtLocal };""")

open(P, 'wb').write((s.replace('\n', '\r\n') if CRLF else s).encode('utf-8'))
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
print('node --check', r.returncode, r.stderr[:300])
assert r.returncode == 0
