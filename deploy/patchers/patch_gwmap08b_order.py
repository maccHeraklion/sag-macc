# -*- coding: utf-8 -*-
"""T-GWMAP-08b (7/11/2026): στον ζωντανό χάρτη της Κρήτης οι πύλες σκέπαζαν αγρούς με πρόβλημα, γιατί έμπαιναν πάντα από πάνω.
Τώρα μπροστά βγαίνει ό,τι χρειάζεται προσοχή, και οι πύλες χωρίς ταυτοποίηση μένουν πίσω, μικρότερες και πιο αχνές."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
p = sys.argv[1] + '/custom_html_files/sag-map.html'
s = open(p, encoding='utf-8').read().replace('\r\n', '\n')


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


sub(""".pin.mini { display: inline-flex;""", """.pin.gw.p-grey:not(.sel):not(.mini) { transform: scale(.8); opacity: .8; }
.pin.mini { display: inline-flex;""")
sub("""function instrState(d) {
""", """/* Σειρά στον χάρτη: μπροστά ό,τι χρειάζεται προσοχή. Μια ζωντανή πύλη δεν σκεπάζει αγρό με πρόβλημα, μια πύλη χωρίς ταυτοποίηση δεν σκεπάζει κανέναν. */
var PIN_TOP = 5000;
function gwZ(g) { return { g_nowit: 3000, g_sparse: 2000, g_alive: 500, g_unid: -500, g_storage: -1000 }[g.st.k] || 0; }
function fieldsZ(list) { return Math.round(list.reduce(function (a, f) { return Math.max(a, trouble(f)); }, 0) * 1000); }
function instrState(d) {
""")
sub("""isSel, kind ? kind.svg : null), title: label, alt: label, riseOnHover: true });""",
    """isSel, kind ? kind.svg : null), title: label, alt: label,
      zIndexOffset: isSel ? PIN_TOP : fieldsZ(list), riseOnHover: true, riseOffset: PIN_TOP + 1000 });""")
sub("""      title: label, alt: label, zIndexOffset: 1000, riseOnHover: true });""",
    """      title: label, alt: label, zIndexOffset: (!!selGw && selGw === g) ? PIN_TOP : gwZ(g), riseOnHover: true, riseOffset: PIN_TOP + 1000 });""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
