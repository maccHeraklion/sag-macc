# -*- coding: utf-8 -*-
"""T-SOILREF-04 (29/10, Michalis: «Ο μέσος όρος μένει μόνο μέχρι να δηλωθεί αισθητήρας απόφασης στη φόρμα»):
  Φ  φόρμα v25 (δεν έχει ανέβει): «Αυτόματα — ο πιο ξηρός» → «Δεν έχει δηλωθεί — μέσος όρος όλων» + σημειώματα.
  S  sync v15 (δεν έχει ανέβει): σχόλιο κεφαλίδας.
  W  widget W-EC-PERDEV-02: σόνδα χωρίς μέτρηση υγρασίας → «χωρίς μέτρηση υγρασίας από αυτόν τον αισθητήρα» (όχι το
     παραπλανητικό «υγρασία κάτω από 15 %», που ο τύπος έβγαζε για NaN).
count==1, EOL όπως το αρχείο, node --check, όλα-ή-τίποτα (ανά αρχείο)."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
def patch(path, subs, check):
    raw = io.open(path, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
    s = raw.decode("utf-8"); crlf = "\r\n" in s
    if crlf: s = s.replace("\r\n", "\n")
    print("ΠΡΙΝ", path, hashlib.sha256(raw).hexdigest()[:16])
    for old, new, label in subs:
        c = s.count(old); assert c == 1, f"{path} · {label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
    for i, sc in enumerate(check(s)):
        fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
        assert r.returncode == 0, f"node --check {path} [{i}]: " + r.stderr[:300]
    out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")
    io.open(path, "wb").write(out)
    print("ΜΕΤΑ", path, hashlib.sha256(out).hexdigest(), len(out))
html_scripts = lambda s: re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)
patch("custom_html_files/configuration.html", [
    ('<option value="">Αυτόματα — ο πιο ξηρός</option></select>', '<option value="">Δεν έχει δηλωθεί — μέσος όρος όλων</option></select>', "Φ1 επιλογή (HTML)"),
    ("o0.textContent = 'Αυτόματα — ο πιο ξηρός';", "o0.textContent = 'Δεν έχει δηλωθεί — μέσος όρος όλων';", "Φ2 επιλογή (απόδοση)"),
    ("δεν μετρά πια σε αυτό το βάθος — ισχύει ο πιο ξηρός. Επιλέξτε ξανά και αποθηκεύστε.'",
     "δεν μετρά πια σε αυτό το βάθος — ισχύει ο μέσος όρος. Επιλέξτε ξανά και αποθηκεύστε.'", "Φ3 σημείωμα: δήλωση που λείπει"),
    ("+ 'και η αλατότητα· οι άλλοι φαίνονται χωριστά στις μετρήσεις. «Αυτόματα» = ο πιο ξηρός, ώστε να μη διψάσει κανένα τμήμα.');",
     "+ 'και η αλατότητα· οι άλλοι φαίνονται χωριστά στις μετρήσεις. Χωρίς δήλωση χρησιμοποιείται ο μέσος όρος όλων· αν η '\n"
     "       + 'δηλωμένη σόνδα δεν δώσει πρόσφατη μέτρηση ή κριθεί χαλασμένη, το σύστημα γυρίζει προσωρινά στον μέσο όρο.');", "Φ4 σημείωμα"),
    ("πυρήνας (μεταβλητή soil_sensors, μόνο όταν αλλάζει). Ο πυρήνας ΔΕΝ βγάζει μέσο όρο σονδών (T-SOILREF-01): χωρίς\n   δήλωση αποφασίζει ο πιο ξηρός, ώστε να μη διψάσει κανένα τμήμα. Ονόματα συσκευών μόνο ως textContent. */",
     "πυρήνας (μεταβλητή soil_sensors, μόνο όταν αλλάζει). T-SOILREF-04: χωρίς δήλωση ο πυρήνας κρατά τον μέσο όρο των\n   σονδών· με δήλωση αποφασίζει η δηλωμένη (αν είναι υγιής και πρόσφατη). Ονόματα συσκευών μόνο ως textContent. */", "Φ5 σχόλιο"),
], lambda s: html_scripts(s))
patch("analysis/setFieldParametersFromDeviceData.js", [
    (" ** v50.164+ ΔΕΝ βγάζει μέσο όρο σονδών εδάφους — αποφασίζει ο δηλωμένος, αλλιώς ο πιο ξηρός).",
     " ** v50.165: χωρίς δήλωση ο μέσος όρος των σονδών· με δήλωση η δηλωμένη, αν είναι υγιής και πρόσφατη — T-SOILREF-04).", "S1 κεφαλίδα"),
], lambda s: [s])
patch("_dist-sagMain/index-7cbd9a4e.js", [
    ("const mt=sagEceMT9(q),th=sagEceLast9(DV,dv,mt[0]),tc=sagEceLast9(DV,dv,mt[1]);",
     "const mt=sagEceMT9(q),th=sagEceLast9(DV,dv,mt[0]),tc=sagEceLast9(DV,dv,mt[1]);/* W-EC-PERDEV-02 */if(!Number.isFinite(th))return{t:t9,v:\"—\",sub:\"χωρίς μέτρηση υγρασίας από αυτόν τον αισθητήρα\"};", "W1 χωρίς υγρασία ≠ «κάτω από 15 %»"),
], lambda s: [s])
