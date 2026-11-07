# -*- coding: utf-8 -*-
"""T-GWMAP-10b (7/11/2026): ο κωδικός του ThingPark (ετικέτα network_lrrid) ενώνει πύλη καταλόγου και πύλη δικτύου πριν από τη σύγκριση θέσης.
Βρέθηκε στον ζωντανό χάρτη: οι 7 πύλες που βγήκαν από την αποθήκη δεν έχουν θέση, άρα η γέφυρα θέσης δεν τις ένωνε και μετρούσαν δύο φορές."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
p = sys.argv[1] + '/custom_html_files/sag-map.html'
s = open(p, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


sub("""  var pairs = [];
  nets.forEach(function (n) {
    if (!n.p) return;
""", """  /* T-GWMAP-10b: ο κωδικός του ThingPark είναι σίγουρη ταύτιση, άρα προηγείται της θέσης. */
  ros.forEach(function (r) {
    if (!r.lrr) return;
    var n = nets.filter(function (x) { return x.code === r.lrr && !x.linkedRoster; })[0];
    if (!n) return;
    n.linkedRoster = true; r.merged = true;
    n.storage = r.storage; n.conflict = r.conflict; n.dev = r.dev; n.off = r.off; n.lrr = r.lrr;
    if (!n.nameSure) { n.name = r.name; n.nameGuess = ''; }
  });
  var pairs = [];
  nets.forEach(function (n) {
    if (!n.p) return;
""")
sub("""    ros.forEach(function (r) {
      if (!r.p) return;
      var d = distKm(n.p, r.p) * 1000;
""", """    ros.forEach(function (r) {
      if (!r.p || r.merged || n.linkedRoster) return;
      var d = distKm(n.p, r.p) * 1000;
""")
sub("""  if (g.off) h += '<div class="meta">Τελευταίο πακέτο στο ThingPark: '""", """  if (g.lrr && !g.code && !g.off) h += '<div class="meta">Κωδικός στο ThingPark <span class="mono">' + esc(g.lrr) + '</span> · κανένα όργανό μας δεν δηλώνει ότι περνά από αυτήν</div>';
  if (g.off) h += '<div class="meta">Τελευταίο πακέτο στο ThingPark: '""")
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
