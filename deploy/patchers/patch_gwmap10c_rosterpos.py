# -*- coding: utf-8 -*-
"""T-GWMAP-10c (7/11/2026): παρενέργεια της 10b, βρέθηκε στον ζωντανό χάρτη. Όταν το δίκτυο δίνει θέση που κρίνεται άγνωστη (κοινή με άλλη πύλη),
η ένωση με κωδικό έχανε τη δηλωμένη θέση του καταλόγου και η πύλη έμενε χωρίς πινέζα. Η θέση του καταλόγου καλύπτει το κενό."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
p = sys.argv[1] + '/custom_html_files/sag-map.html'
s = open(p, encoding='utf-8', newline='').read().replace('\r\n', '\n')
a = """    n.storage = r.storage; n.conflict = r.conflict; n.dev = r.dev; n.off = r.off; n.lrr = r.lrr;
"""
assert s.count(a) == 1
s = s.replace(a, a + """    if (!n.p && r.p) { n.p = r.p; n.posKind = 'ok'; n.posWhy = ''; n.sharedP = null; }
""")
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
