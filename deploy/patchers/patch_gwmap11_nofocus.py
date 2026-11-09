# T-GWMAP-11 (9/11/2026, Michalis): κλικ πάνω στον χάρτη δεν ξαναεστιάζει ούτε κυλά τη σελίδα. Η εστίαση στην πύλη γίνεται με κουμπί.
import sys
P = sys.argv[1]
s = open(P, 'rb').read().decode('utf-8')
assert '\r\n' not in s
def sub(old, new, cnt=1):
    global s
    n = s.count(old); assert n == cnt, (n, old[:80]); s = s.replace(old, new)

sub("#mapveil span {", ".maphint { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 790; border: 1px solid var(--line2);\n  background: var(--s2); color: var(--tx); font: inherit; font-size: .82rem; padding: 6px 12px; border-radius: 999px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.18); }\n.maphint:hover { border-color: var(--accent); }\n#mapveil span {")
sub('        <div id="mapveil" hidden>', '        <button type="button" id="panelHint" class="maphint" hidden>Λεπτομέρειες ↓</button>\n        <div id="mapveil" hidden>')
# Κλικ σε πινέζα: ο χάρτης μένει όπου τον έχει ο χρήστης, η σελίδα δεν κυλά.
sub("m.on('click', function () { select_(single ? { kind: 'field', key: list[0].key } : { kind: 'group', key: grp.key }); reveal('panel'); });",
    "m.on('click', function () { UI.userMoved = true; select_(single ? { kind: 'field', key: list[0].key } : { kind: 'group', key: grp.key }, { fromMap: true }); });")
sub("m.on('click', function () { select_({ kind: 'gw', key: g.key }); reveal('panel'); });",
    "m.on('click', function () { UI.userMoved = true; select_({ kind: 'gw', key: g.key }, { fromMap: true }); });")
sub("""function select_(s) {
  var same = UI.sel && UI.sel.kind === s.kind && UI.sel.key === s.key;
  UI.sel = s;
  renderPanel();
  if (s.kind === 'gw' && !same) frameGateway(byKey(MODEL.gws, s.key));
  drawMap(visible(MODEL, UI.flt));
  /* Στο κινητό ο χάρτης έρχεται στην κορυφή: το πλαίσιο αρχίζει ακριβώς κάτω του, άρα φαίνονται και οι γραμμές και τα στοιχεία. */
  if (window.innerWidth <= 900) {""", """/* T-GWMAP-11 (9/11): επιλογή ΑΠΟ ΤΟΝ ΧΑΡΤΗ δεν κουνά ούτε τον χάρτη ούτε τη σελίδα· ένα κουμπί πάνω στον χάρτη οδηγεί στις
   λεπτομέρειες. Επιλογή από τη λίστα (κάτω από τον χάρτη) τον φέρνει στο στοιχείο, όπως πριν. */
function hint(show) { var b = $('panelHint'); if (b) b.hidden = !show; }
function select_(s, o) {
  var fromMap = !!(o && o.fromMap);
  var same = UI.sel && UI.sel.kind === s.kind && UI.sel.key === s.key;
  UI.sel = s;
  renderPanel();
  if (s.kind === 'gw' && !same && !fromMap) frameGateway(byKey(MODEL.gws, s.key));
  drawMap(visible(MODEL, UI.flt));
  hint(fromMap);
  if (fromMap) return;
  /* Στο κινητό ο χάρτης έρχεται στην κορυφή: το πλαίσιο αρχίζει ακριβώς κάτω του, άρα φαίνονται και οι γραμμές και τα στοιχεία. */
  if (window.innerWidth <= 900) {""")
sub("""  if (!obj) {
    UI.sel = null;
""", """  if (!obj) {
    UI.sel = null; hint(false);
""")
# Κουμπί εστίασης στο πλαίσιο της πύλης (η ακτίνα/οι αγροί της, κατ' απαίτηση).
sub("""    + (g.posWhy ? ' (' + esc(g.posWhy) + ')' : '') + '</div>';
  h += '<h3>Επιβεβαιωμένη λήψη (""", """    + (g.posWhy ? ' (' + esc(g.posWhy) + ')' : '') + '</div>';
  if (g.p) h += '<div class="meta"><button type="button" class="btn" data-frame>Εστίαση του χάρτη στην πύλη</button></div>';
  h += '<h3>Επιβεβαιωμένη λήψη (""")
sub("""  var t = e.target.closest ? e.target.closest('[data-sel],[data-close]') : null;
  if (!t) return;
""", """  var t = e.target.closest ? e.target.closest('[data-sel],[data-close],[data-frame],#panelHint') : null;
  if (!t) return;
  if (t.id === 'panelHint') { hint(false); reveal('panel'); return; }
  if (t.hasAttribute('data-frame')) { if (UI.sel && UI.sel.kind === 'gw') frameGateway(byKey(MODEL.gws, UI.sel.key)); reveal('map'); return; }
""")
open(P, 'wb').write(s.encode('utf-8'))
print('ok')
