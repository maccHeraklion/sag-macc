# T-FIELDREG-02 (11/11/2026): πρώτη ζωντανή εκτέλεση — 4 από τα 7 «μακριά» ήταν 15,5–20,8 km, απόσταση που πύλη σε ύψωμα
# καλύπτει. Δύο βαθμίδες: 15–30 km «edge» (ασυνήθιστα μακριά, ήπια σημείωση), > 30 km «far» (σχεδόν σίγουρα λάθος, σήμα στον χάρτη).
import sys, subprocess
A, H = sys.argv[1], sys.argv[2]


def load(p):
    s = open(p, 'rb').read().decode('utf-8')
    assert '\r\n' not in s
    return s


def sub(src, old, new, cnt=1):
    n = src.count(old)
    assert n == cnt, (n, old[:90])
    return src.replace(old, new)


a, h = load(A), load(H)
a = sub(a, "const REG_NEAR_KM = WRONG_FIELD_KM;   // ίδιο όριο με το «λάθος αγρός»",
        "const REG_NEAR_KM = WRONG_FIELD_KM;   // ίδιο όριο με το «λάθος αγρός»\n"
        "const REG_FAR_KM = 30;               // T-FIELDREG-02: 15–30 km = ασυνήθιστα μακριά (edge)· πάνω από αυτό = σχεδόν σίγουρα λάθος (far)")
a = sub(a, "const sum = { n: 0, ok: 0, far: 0, nogw: 0,", "const sum = { n: 0, ok: 0, edge: 0, far: 0, nogw: 0,")
a = sub(a, """      } else {
        rc.v = "far"; sum.far++;""", """      } else {
        if (b.km <= REG_FAR_KM) { rc.v = "edge"; sum.edge++; } else { rc.v = "far"; sum.far++; }""")
a = sub(a, """        sum.list.push(truncName(m.n, 40) + "|" + rc.km + " km|" """, """        sum.list.push(rc.v + "|" + truncName(m.n, 40) + "|" + rc.km + " km|" """)
a = sub(a, "|επιβεβαιωμένες=${rg.ok}|μακριά από την πύλη=${rg.far}|", "|επιβεβαιωμένες=${rg.ok}|15–30 km=${rg.edge}|πάνω από 30 km=${rg.far}|")
a = sub(a, """for (const l of rg.list.slice(0, 15)) console.log("ΚΑΤ|μακριά|" + l);""", """for (const l of rg.list.slice(0, 15)) console.log("ΚΑΤ|" + l);""")

h = sub(h, "  } else if (rc.v === 'far') {\n    h += '<div class=\"note\">⚠ Τα όργανα",
        "  } else if (rc.v === 'edge') {\n"
        "    h += '<div class=\"meta\">Η πλησιέστερη πύλη που ακούει τα όργανα (' + gwLink(rc.g) + ') απέχει ' + regKm(rc.km) + '. Είναι ασυνήθιστα μακριά αλλά εφικτό για πύλη σε ύψωμα· αξίζει έλεγχος αν ο αγρός είναι καινούριος.</div>';\n"
        "    if (rc.a) h += '<div class=\"note\">Η θέση ' + (rc.a === 'tag' ? 'της ετικέτας coordinates' : 'της φόρμας') + ' απέχει μόνο ' + regKm(rc.ak) + ' από την πύλη.</div>';\n"
        "  } else if (rc.v === 'far') {\n    h += '<div class=\"note\">⚠ Τα όργανα")
h = sub(h, "(όριο ' + REG_KM + ' km)", "(πάνω από ' + REG_KM + ' km)")
h = sub(h, "var REG_KM = 15;", "var REG_KM = 30;")

open(A, 'wb').write(a.encode('utf-8'))
open(H, 'wb').write(h.encode('utf-8'))
r = subprocess.run(['node', '--check', A], capture_output=True, text=True)
print('node --check analysis', r.returncode, r.stderr[:300])
assert r.returncode == 0
