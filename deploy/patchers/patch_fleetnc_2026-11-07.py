# -*- coding: utf-8 -*-
# T-FLEET-NC-01 (v50.188): ο πίνακας στόλου βλέπει τα όργανα και στις εγγραφές χωρίς ρύθμιση φόρμας.
# Πυρήνας CRLF, σελίδα Εποπτείας LF. Κάθε αντικατάσταση count==1, μετά node --check.
import subprocess, sys, tempfile, os
sys.stdout.reconfigure(encoding='utf-8')
CORE = 'analysis/runPerTich.js'
FLEET = 'custom_html_files/sag-fleet.html'

s = open(CORE, encoding='utf-8', newline='').read()
assert '\r\n' in s and s.count('\n') == s.count('\r\n'), 'ο πυρήνας δεν είναι καθαρό CRLF'
assert 'T-FLEET-NC-01' not in s, 'ήδη εφαρμοσμένο'
def sub(a, b):
    global s
    a = a.replace('\n', '\r\n'); b = b.replace('\n', '\r\n')
    assert s.count(a) == 1, (s.count(a), a[:70])
    s = s.replace(a, b)

sub("const SAG_KERNEL_VERSION = 'v50.187 · 2026-11-07';", "const SAG_KERNEL_VERSION = 'v50.188 · 2026-11-07';")
sub("  _SAG_FLEET.length = 0;   // T-FLEET-REPORT-01\n", "  _SAG_FLEET.length = 0;   // T-FLEET-REPORT-01\n  _SAG_NC_ALL = null;      // T-FLEET-NC-01\n")
sub("""// ── T-FLEET-HEALTH-01 (v50.143 · 19/9/2026) · ΥΓΕΙΑ ΣΥΣΤΗΜΑΤΟΣ ΣΤΟΝ ΠΙΝΑΚΑ ──
""", """/* ══ T-FLEET-NC-01 (v50.188 · 7/11/2026) · ΤΑ ΟΡΓΑΝΑ ΤΩΝ ΕΓΓΡΑΦΩΝ ΧΩΡΙΣ ΡΥΘΜΙΣΗ ═══
   ΤΟ ΕΥΡΗΜΑ (7/11): όποια εγγραφή δεν έχει ρύθμιση φόρμας έμπαινε στον πίνακα με κενή λίστα
   οργάνων, άρα η σιωπή της δεν κρινόταν ποτέ. 11 ζώνες του ξενοδοχείου έδειχναν ΕΝΤΑΞΕΙ με
   τα όργανά τους σιωπηλά 85 ώρες, και ένας νεκρός σταθμός καιρού θα έδειχνε το ίδιο.
   Μόνο ο πίνακας στόλου αλλάζει. Τίποτα δεν υπολογίζεται και τίποτα δεν γράφεται σε αγρό.
   ΜΙΑ λίστα συσκευών ανά εκτέλεση, και μόνο αν υπάρχει τέτοια εγγραφή. Αν αποτύχει, μένει ό,τι
   ίσχυε (κενή λίστα) και ο κύκλος συνεχίζει. */
let _SAG_NC_ALL = null;
function _sagNcIds(devices) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') { Object.values(v).forEach(walk); return; }
    const s = String(v == null ? '' : v).trim();
    if (/^[0-9a-f]{24}$/i.test(s) && out.indexOf(s) < 0) out.push(s);
  };
  walk(devices);
  return out;
}
function _sagNcRows(ids, all, nowMs) {
  const out = [];
  for (const id of ids) {
    const e = all.get(id);
    if (!e) continue;
    const t = e.li ? new Date(e.li).getTime() : NaN;
    out.push({ n: e.n, i: id.slice(-6), h: Number.isFinite(t) ? Math.round((nowMs - t) / 360000) / 10 : null,
      q: 0, b: null, l: 0, t: e.t });
  }
  return out;
}
async function _sagNcInventory(account, devices, nowMs) {
  const ids = _sagNcIds(devices);
  if (!ids.length) return [];
  if (!_SAG_NC_ALL) {
    const all = new Map();
    try {
      for (let page = 1; page <= 20; page++) {
        const b = await account.devices.list({ page, amount: 100, fields: ['id', 'name', 'tags', 'last_input'] });
        if (!Array.isArray(b) || !b.length) break;
        for (const d of b) {
          const ty = (d.tags || []).find((x) => x && x.key === 'type');
          all.set(String(d.id), { n: d.name, li: d.last_input || null, t: (ty && ty.value) || null });
        }
        if (b.length < 100) break;
      }
    } catch (_eNcL) { console.log('[T-FLEET-NC-01] η λίστα συσκευών απέτυχε: ' + (_eNcL && _eNcL.message)); }
    _SAG_NC_ALL = all;
  }
  return _sagNcRows(ids, _SAG_NC_ALL, nowMs);
}

// ── T-FLEET-HEALTH-01 (v50.143 · 19/9/2026) · ΥΓΕΙΑ ΣΥΣΤΗΜΑΤΟΣ ΣΤΟΝ ΠΙΝΑΚΑ ──
""")
sub("""            const _ncPurpose = _sagFieldPurpose(fields[i]);
            _SAG_FLEET.push({ f: fieldName, i: String(fields[i]?.id || '').slice(-6), y: null, x: null,
              d: [], k: [], v: [], a: [], z: [],
""", """            const _ncPurpose = _sagFieldPurpose(fields[i]);
            const _ncInv = await _sagNcInventory(account, devices, Date.now());   // T-FLEET-NC-01
            _SAG_FLEET.push({ f: fieldName, i: String(fields[i]?.id || '').slice(-6), y: null, x: null,
              d: _ncInv, k: [], v: [], a: [], z: [],
""")
open(CORE, 'w', encoding='utf-8', newline='').write(s)

h = open(FLEET, encoding='utf-8', newline='').read()
assert '\r\n' not in h, 'η σελίδα δεν είναι καθαρό LF'
def subh(a, b):
    global h
    assert h.count(a) == 1, (h.count(a), a[:70])
    h = h.replace(a, b)
subh("""  if (r.nc) return 'Δεν έχει ρύθμιση στη φόρμα — δεν υπολογίζεται τίποτα γι\\' αυτόν τον αγρό';
""", """  /* W-FLEET-NC-01: η σιωπή οργάνου προηγείται της έλλειψης ρύθμισης. Σταθμός και αυτοματισμός δεν έχουν ρύθμιση από σχεδιασμό. */
  var ncDead = (r.d || []).some(function (d) { return d.q || (Number.isFinite(d.h) && d.h > 48); });
  if (r.nc && !ncDead && (r.p || 'agronomy') === 'agronomy') return 'Δεν έχει ρύθμιση στη φόρμα — δεν υπολογίζεται τίποτα γι\\' αυτόν τον αγρό';
""")
subh("""  if (r.nc) h.push('<span class="bad">Χωρίς ρύθμιση στη φόρμα</span>');
""", """  if (r.nc && (r.p || 'agronomy') === 'agronomy') h.push('<span class="bad">Χωρίς ρύθμιση στη φόρμα</span>');
""")
open(FLEET, 'w', encoding='utf-8', newline='').write(h)
subprocess.run(['node', '--check', CORE], check=True)
print('ok')
