# -*- coding: utf-8 -*-
"""T-GWMAP-09 (7/11/2026, εντολή Michalis): δικό του σύμβολο στο ξενοδοχείο. Εδώ, και μόνο εδώ, το είδος βγαίνει από τον πελάτη,
γιατί οι ζώνες του έχουν τα ίδια όργανα με έναν αγρό. Ομάδα εγγραφών ίδιου είδους δείχνει το σχέδιο και το πλήθος στη γωνία.
Αλλάζει μόνο η εμφάνιση του χάρτη: καμία ρύθμιση, ετικέτα ή συσκευή του ξενοδοχείου δεν αγγίζεται."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
p = sys.argv[1] + '/custom_html_files/sag-map.html'
s = open(p, encoding='utf-8').read().replace('\r\n', '\n')


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


sub(""".pin.mini { display: inline-flex;""", """.pin.grp svg { width: 20px; height: 20px; }
.pin .cnt { position: absolute; right: -7px; bottom: -7px; min-width: 15px; height: 15px; border-radius: 8px; background: #fff; color: #111;
  font-size: 9px; font-style: normal; display: flex; align-items: center; justify-content: center; padding: 0 2px; border: 1px solid #111; }
.pin.mini { display: inline-flex;""")
sub("""  none: { k: 'none', w: 'Χωρίς όργανο',""", """  hotel: { k: 'hotel', w: 'Ξενοδοχείο', d: 'ζώνη ξενοδοχείου', svg: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7.5" cy="11" r="2.4"/><path d="M2.5 5.5h2.2V14H11V8.5h7.5a3 3 0 0 1 3 3v8h-2.2v-3H4.7v3H2.5z"/></svg>' },
  none: { k: 'none', w: 'Χωρίς όργανο',""")
sub("""function kindOf(devs) {
  var ts = (devs || []).map(function (d) { return String(d.t == null ? '' : d.t).toLowerCase(); });
""", """var HOTEL_CLIENT = /volta/i;
function kindOf(devs, client) {
  if (HOTEL_CLIENT.test(String(client == null ? '' : client))) return KIND.hotel;
  var ts = (devs || []).map(function (d) { return String(d.t == null ? '' : d.t).toLowerCase(); });
""")
sub("""/* Το σήμα στη γωνία: κενά ή σιωπή""", """/* Ομάδα στο ίδιο σημείο: το σχέδιο μένει μόνο όταν όλες οι εγγραφές είναι ίδιου είδους, αλλιώς φαίνεται σκέτος αριθμός. */
function groupKind(list) {
  return list.every(function (f) { return f.kind === list[0].kind; }) ? list[0].kind : null;
}
/* Το σήμα στη γωνία: κενά ή σιωπή""")
sub("""rec: rec, devs: devs, kind: kindOf(devs), dc:""", """rec: rec, devs: devs, kind: kindOf(devs, md ? md.c : ''), dc:""")
sub("""function buildFields(raw) {
""", """/* Εγγραφή χωρίς πελάτη που έχει το ίδιο όνομα με ζώνη του ξενοδοχείου είναι κι αυτή ζώνη του (Ανατολικός Δρόμος, 7/11). */
function markHotelTwins(fields) {
  var names = {};
  fields.forEach(function (f) { if (f.kind === KIND.hotel) names[fold(f.name)] = 1; });
  fields.forEach(function (f) { if (!f.client && names[fold(f.name)]) f.kind = KIND.hotel; });
}
function buildFields(raw) {
""")
sub("""    if (used.indexOf(raw.fleet[k]) < 0) out.push(makeField(null, raw.fleet[k], newest));
  });
  return out;
""", """    if (used.indexOf(raw.fleet[k]) < 0) out.push(makeField(null, raw.fleet[k], newest));
  });
  markHotelTwins(out);
  return out;
""")
sub("""function pinIcon(s, cls, text, sub, suspect, selected, glyph) {""", """function pinIcon(s, cls, text, sub, suspect, selected, glyph, cnt) {""")
sub("""(suspect ? '<i class="sus">!</i>' : '') + '</div>';""", """(suspect ? '<i class="sus">!</i>' : '') + (cnt ? '<i class="cnt">' + cnt + '</i>' : '') + '</div>';""")
sub("""else { s = groupState(list); text = String(list.length); sub = badgeOf(s, null); }""", """else { s = groupState(list); text = String(list.length); sub = badgeOf(s, null); kind = groupKind(list); }""")
sub("""isSel, kind ? kind.svg : null), title: label""", """isSel, kind ? kind.svg : null, (!single && kind) ? list.length : null), title: label""")
sub("""[KIND.field, KIND.station, KIND.valve, KIND.none].map(""", """[KIND.field, KIND.hotel, KIND.station, KIND.valve, KIND.none].map(""")
sub("""<div class="i">αριθμός στην πινέζα: εγγραφές στο ίδιο σημείο</div>""", """<div class="i">αριθμός: εγγραφές στο ίδιο σημείο· σκέτος αριθμός όταν είναι διαφορετικού είδους</div>""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
