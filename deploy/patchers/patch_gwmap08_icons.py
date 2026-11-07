# -*- coding: utf-8 -*-
"""T-GWMAP-08 (7/11/2026, εντολή Michalis): σύμβολα χάρτη στόλου. Το σχέδιο λέει ΤΙ είναι, το χρώμα ΠΩΣ είναι.
Το σήμα στη γωνία μπαίνει μόνο όταν κάτι δεν πάει καλά, ώστε η κατάσταση να μη στηρίζεται μόνο στο χρώμα.
Το είδος βγαίνει από τα όργανα της εγγραφής, όχι από το όνομα (παγίδα «Ηλεκτροβάνα 1»)."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
p = sys.argv[1] + '/custom_html_files/sag-map.html'
s = open(p, encoding='utf-8').read().replace('\r\n', '\n')


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


# ── CSS ──
sub(""".pin { width: 26px; height: 26px; border-radius: 50%;""", """.pin { width: 28px; height: 28px; border-radius: 50%;""")
sub(""".pin.gw { border-radius: 5px; width: 28px; height: 28px; border-color: #111; }
""", """.pin.gw { border-radius: 5px; width: 30px; height: 30px; border-color: #111; }
.pin svg { width: 18px; height: 18px; display: block; }
.pin.gw svg { width: 21px; height: 21px; }
.pin.mini { display: inline-flex; flex: none; width: 22px; height: 22px; box-shadow: none; }
.pin.mini svg { width: 14px; height: 14px; }
""")

# ── είδη ──
sub("""/* Από τον πίνακα στόλου (Ε5): άγνωστη σοβαρότητα""", """/* T-GWMAP-08: τι είναι το σημείο. Τα σχέδια είναι σταθερά, γράφονται ως έχουν στην πινέζα. */
var KIND = {
  field: { k: 'field', w: 'Αγρός', d: 'αγρός με αισθητήρες', svg: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-9" fill="none"/><path d="M12 13C12 8.5 8.5 6 4 6c0 4.5 3.5 7 8 7z"/><path d="M12 10c0-3.5 3-6 8-6 0 4-3.5 6-8 6z"/></svg>' },
  station: { k: 'station', w: 'Σταθμός καιρού', d: 'μόνο σταθμός καιρού', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 19.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10a4.75 4.75 0 0 1-.5 9.5z"/></svg>' },
  valve: { k: 'valve', w: 'Βάνα', d: 'βάνα χωρίς αισθητήρες εδάφους ή φύλλου', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c3.6 4.7 6.7 8 6.7 12a6.7 6.7 0 0 1-13.4 0c0-4 3.1-7.3 6.7-12z"/></svg>' },
  none: { k: 'none', w: 'Χωρίς όργανο', d: 'εγγραφή χωρίς όργανο', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="4 3.4"><circle cx="12" cy="12" r="7.5"/></svg>' }
};
var GW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="10" r="2.3" fill="currentColor" stroke="none"/><path d="M12 12v10"/><path d="M8 6a6 6 0 0 0 0 8M16 6a6 6 0 0 1 0 8"/><path d="M4.6 2.6a10.6 10.6 0 0 0 0 14.8M19.4 2.6a10.6 10.6 0 0 1 0 14.8"/></svg>';

/* Από τον πίνακα στόλου (Ε5): άγνωστη σοβαρότητα""")
sub("""function instrState(d) {
""", """/* Από τα όργανα, ποτέ από το όνομα. Αισθητήρας εδάφους, φύλλου ή αέρα κάνει την εγγραφή αγρό, όποια άλλα όργανα κι αν έχει.
   Άγνωστος τύπος μένει αγρός: το συνηθέστερο είδος, και δεν κρύβει τίποτα αφού το χρώμα μένει το ίδιο. */
function kindOf(devs) {
  var ts = (devs || []).map(function (d) { return String(d.t == null ? '' : d.t).toLowerCase(); });
  if (!ts.length) return KIND.none;
  if (ts.some(function (t) { return /lse0|se0|lms01|em3|sph01|aglwpp/.test(t); })) return KIND.field;
  if (ts.some(function (t) { return /uc5|ws558/.test(t); })) return KIND.valve;
  if (ts.every(function (t) { return /s2120/.test(t); })) return KIND.station;
  return KIND.field;
}
/* Το σήμα στη γωνία: κενά ή σιωπή υπερισχύουν, αλλιώς η ίδια η κατάσταση. Όταν όλα είναι εντάξει δεν μπαίνει τίποτα. */
function badgeOf(s, ss) {
  if (ss) return ss.ic;
  return (s.c === 'ok' || s.k === 'nocalc' || s.k === 'noinst') ? null : s.ic;
}
function instrState(d) {
""")
sub("""rec: rec, devs: devs, dc: (md && md.dc) || 0, keys: keys,""", """rec: rec, devs: devs, kind: kindOf(devs), dc: (md && md.dc) || 0, keys: keys,""")

# ── πινέζες ──
sub("""function pinIcon(s, cls, text, sub, suspect, selected) {
  var html = '<div class="pin ' + cls + ' p-' + s.c + (selected ? ' sel' : '') + '">' + esc(text)
""", """function pinIcon(s, cls, text, sub, suspect, selected, glyph) {
  var html = '<div class="pin ' + cls + ' p-' + s.c + (selected ? ' sel' : '') + '">' + (glyph || esc(text))
""")
sub("""  var size = cls === 'grp' ? 32 : (cls === 'gw' ? 28 : 26);
""", """  var size = cls === 'grp' ? 32 : (cls === 'gw' ? 30 : 28);
""")
sub("""    var single = list.length === 1 && grp.fields.length === 1, s, sub = null, text;
""", """    var single = list.length === 1 && grp.fields.length === 1, s, sub = null, text, kind = null;
""")
sub("""    if (single) { s = primaryState(list[0]); text = s.ic; var ss = subState(list[0]); sub = ss ? ss.ic : null; }
    else { s = groupState(list); text = String(list.length); }
    var label = single ? (list[0].name + ': ' + s.w) :""", """    if (single) { s = primaryState(list[0]); kind = list[0].kind; text = kind.w; sub = badgeOf(s, subState(list[0])); }
    else { s = groupState(list); text = String(list.length); sub = badgeOf(s, null); }
    var label = single ? (kind.w + ' ' + list[0].name + ': ' + s.w) :""")
sub("""icon: pinIcon(s, single ? 'f' : 'grp', text, sub, grp.suspect, isSel), title: label""", """icon: pinIcon(s, single ? 'f' : 'grp', text, sub, grp.suspect, isSel, kind ? kind.svg : null), title: label""")
sub("""icon: pinIcon(g.st, 'gw', g.st.ic, null, g.posKind === 'suspect', !!selGw && selGw === g),""", """icon: pinIcon(g.st, 'gw', 'Πύλη', badgeOf(g.st, null), g.posKind === 'suspect', !!selGw && selGw === g, GW_SVG),""")

# ── υπόμνημα ──
sub("""  var h = items.map(function (s) { return '<div class="i">' + chip(s) + '</div>'; }).join('');
""", """  var mini = function (cls, svg, w) { return '<div class="i"><span class="pin mini ' + cls + ' p-grey">' + svg + '</span> ' + esc(w) + '</div>'; };
  var h = '<div class="i"><b>Το σχέδιο λέει τι είναι:</b></div>' + mini('gw', GW_SVG, 'πύλη')
    + [KIND.field, KIND.station, KIND.valve, KIND.none].map(function (k) { return mini('f', k.svg, k.d); }).join('')
    + '<div class="i"><b>Το χρώμα λέει πώς είναι:</b></div>'
    + items.map(function (s) { return '<div class="i">' + chip(s) + '</div>'; }).join('');
""")
sub("""    + '<div class="i">στρογγυλή πινέζα: αγρός</div><div class="i">τετράγωνη πινέζα: πύλη</div><div class="i">αριθμός στην πινέζα: εγγραφές στο ίδιο σημείο</div><div class="i">! : ύποπτη θέση</div>'
""", """    + '<div class="i">σήμα στη γωνία: κάτι δεν πάει καλά· χωρίς σήμα, κανένα θέμα</div><div class="i">αριθμός στην πινέζα: εγγραφές στο ίδιο σημείο</div><div class="i">! : ύποπτη θέση</div>'
""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
