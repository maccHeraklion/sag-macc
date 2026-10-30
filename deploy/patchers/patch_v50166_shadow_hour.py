# -*- coding: utf-8 -*-
"""T-SHADOW-HOUR-01 · πυρήνας v50.166 (31/10, Michalis: «ναι προχώρα με τη Φάση 1 και τη σκιώδη Φάση 2»).

ΣΚΙΩΔΗΣ σύγκριση «τελευταία τιμή» (ό,τι χρησιμοποιεί σήμερα ο πυρήνας: last_item στον ωριαίο κύκλο) έναντι «ωριαίος μέσος
ΑΝΑ ΠΑΚΕΤΟ υπολογισμένων τιμών» για τους αισθητήρες εδάφους δύο βαθών (se0x / lse02): υγρασία θ1/θ2 και EC στη ρίζα 1/2
(Hilhorst ΑΝΑ ΠΑΚΕΤΟ με θ/T του ίδιου πακέτου — ποτέ μέσοι εισόδων). ΔΕΝ αλλάζει ΚΑΜΙΑ συμβουλή, κανένα λίτρο, καμία σταθερά:
μόνο διαβάζει και καταγράφει. Κόστος (όρια λογαριασμού 31/10: έξοδος 91 %, αποθήκευση 96 %): μία ανάγνωση ανά αισθητήρα
εδάφους ανά ώρα (≤ 18 εγγραφές), ΜΙΑ εγγραφή ανά ώρα για όλο τον στόλο στη συσκευή εποπτείας (sag_shadow_hourly, συμπιεσμένη),
τίποτα στο field_bundle. Σβήνει ΜΟΝΟ του στις 8/11/2026 00:00 UTC (7 ημέρες).
count==1, CRLF όπως το αρχείο, node --check, όλα-ή-τίποτα."""
import io, sys, subprocess, hashlib, os, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "analysis/runPerTich.js"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-SHADOW-HOUR-01" not in s, "ήδη εφαρμοσμένο"

SHADOW = r"""const _SAG_FLEET = [];
// ── T-SHADOW-HOUR-01 (v50.166 · 31/10/2026) · ΣΚΙΩΔΗΣ: «ΤΕΛΕΥΤΑΙΑ ΤΙΜΗ» ΕΝΑΝΤΙ «ΩΡΙΑΙΟΥ ΜΕΣΟΥ ΑΝΑ ΠΑΚΕΤΟ» ──
// Michalis 31/10: «αν λαμβάνουμε σήμα κάθε 20 λεπτά και υπολογίζουμε ανά ώρα … μήπως πρέπει να πάρουμε τους μέσους όρους
// 3 μετρήσεων ανά ώρα … σε κάθε περίπτωση το αποτέλεσμα πρέπει να είναι διαφανές και να εξηγείται».
// Σήμερα ο ωριαίος κύκλος παίρνει ΜΟΝΟ το τελευταίο πακέτο (last_item) — έως ~20΄ παλιό, χωρίς να το λέει. Εδώ ΜΕΤΡΑΜΕ,
// χωρίς να αλλάζουμε τίποτα, πόσο θα διέφερε ο ωριαίος μέσος. Κανόνας: ο υπολογισμός γίνεται ΑΝΑ ΠΑΚΕΤΟ (θ, σ, T του
// ΙΔΙΟΥ πακέτου — ο τύπος Hilhorst δεν είναι γραμμικός και το πότισμα ανακατεύει βρεγμένη και στεγνή φάση) και ΜΕΤΑ ο μέσος.
// [τελευταία, μέσος, n, ελάχιστο, μέγιστο] ανά κανάλι · a = ηλικία του τελευταίου πακέτου σε λεπτά τη στιγμή του κύκλου.
const _SAG_SHADOW_UNTIL = Date.parse('2026-11-08T00:00:00Z');   // 7 ημέρες, μετά σβήνει μόνο του
const _SAG_SHADOW = [];
function _sagShadowStats(arr) {
  const ok = (arr || []).filter(x => x && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
  if (!ok.length) return null;
  let sum = 0, mn = Infinity, mx = -Infinity;
  for (const x of ok) { sum += x.v; if (x.v < mn) mn = x.v; if (x.v > mx) mx = x.v; }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return [r3(ok[ok.length - 1].v), r3(sum / ok.length), ok.length, r3(mn), r3(mx)];
}
async function _sagShadowRead(device, fieldName, devName, nowIso) {
  try {
    const end = Date.parse(String(nowIso || ''));
    if (!Number.isFinite(end) || end >= _SAG_SHADOW_UNTIL) return;
    const rows = await device.getData({
      variables: ['soil_moisture1', 'soil_moisture2', 'conduct_soil1', 'conduct_soil2',
                  'soil_temperature1', 'soil_temperature2'],
      start_date: new Date(end - 3600000).toISOString(), end_date: new Date(end).toISOString(), qty: 60 });
    const by = new Map();
    for (const r of (rows || [])) {
      const t = Date.parse(String(r && r.time || ''));
      const v = Number(r && r.value);
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
      if (!by.has(t)) by.set(t, {});
      by.get(t)[r.variable] = v;
    }
    const ts = [...by.keys()].sort((a, b) => a - b);
    if (!ts.length) return;
    const out = { f: String(fieldName || '').slice(0, 40), d: String(devName || '').slice(-24),
      a: Math.round((end - ts[ts.length - 1]) / 60000) };
    for (const n of ['1', '2']) {
      const th = [], ec = [];
      for (const t of ts) {
        const p = by.get(t), m = p['soil_moisture' + n], c = p['conduct_soil' + n];
        if (Number.isFinite(m)) th.push({ t, v: m });
        if (Number.isFinite(m) && Number.isFinite(c) && !(m > _SAG_EC_MIN_VWC * 100 && c < _SAG_EC_DEAD_US)) {
          const k = _sagEcChain(c, m, p['soil_temperature' + n], NaN);
          if (k.pore !== null) ec.push({ t, v: k.pore });
        }
      }
      const sm = _sagShadowStats(th), se = _sagShadowStats(ec);
      if (sm) out['m' + n] = sm;
      if (se) out['e' + n] = se;
    }
    if (out.m1 || out.m2 || out.e1 || out.e2) _SAG_SHADOW.push(out);
  } catch (_eSh) { /* σκιώδες: ποτέ δεν επηρεάζει τον κύκλο */ }
}
// ── End T-SHADOW-HOUR-01 ─────────────────────────────────────────────────"""

SUBS = [
    ("const SAG_KERNEL_VERSION = 'v50.165 · 2026-10-29';",
     "const SAG_KERNEL_VERSION = 'v50.166 · 2026-10-31';   // T-SHADOW-HOUR-01 (σκιώδες, καμία αλλαγή συμβουλής) ·", "Ε έκδοση"),
    ("const _SAG_FLEET = [];", SHADOW, "Σ1 σκιώδης συσσωρευτής + ανάγνωση"),
    ("  _SAG_FLEET.length = 0;   // T-FLEET-REPORT-01\n",
     "  _SAG_FLEET.length = 0;   // T-FLEET-REPORT-01\n  _SAG_SHADOW.length = 0;  // T-SHADOW-HOUR-01\n", "Σ2 μηδενισμός ανά εκτέλεση"),
    ("      _devRejects.push(..._sagScreenDevice(deviceData, info?.name || value, fieldName));\n"
     "      data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);\n"
     "    }\n\n"
     "    // ─────────────────────────────────────────────\n"
     "    // TYPE: lse01 → water_soil avg (24h)",
     "      // T-SHADOW-HOUR-01: σκιώδης μέτρηση (μόνο ανάγνωση, μόνο στον ωριαίο κύκλο, έως 8/11).\n"
     "      if (hourTich) await _sagShadowRead(device, fieldName, info?.name || value, now);\n"
     "      _devRejects.push(..._sagScreenDevice(deviceData, info?.name || value, fieldName));\n"
     "      data = _sagMergeDeviceData(data, deviceData, info?.name || value, fieldName, value);\n"
     "    }\n\n"
     "    // ─────────────────────────────────────────────\n"
     "    // TYPE: lse01 → water_soil avg (24h)", "Σ3 κλήση στους αισθητήρες δύο βαθών"),
    ("      await _fbDev.sendData(_rows);\n",
     "      // T-SHADOW-HOUR-01: ΜΙΑ συμπιεσμένη εγγραφή/ώρα για όλο τον στόλο (τμήματα των 25) — όχι στο field_bundle.\n"
     "      if (hourTich && _SAG_SHADOW.length) {\n"
     "        try {\n"
     "          const _shT = new Date().toISOString();\n"
     "          for (let _i = 0, _k = Math.ceil(_SAG_SHADOW.length / 25); _i < _k; _i++) {\n"
     "            const _part = _SAG_SHADOW.slice(_i * 25, _i * 25 + 25);\n"
     "            const _z = zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, t: _shT, k: SAG_KERNEL_VERSION,\n"
     "              p: _i + 1, of: _k, r: _part }), 'utf8')).toString('base64');\n"
     "            _rows.push({ variable: 'sag_shadow_hourly', value: _part.length,\n"
     "              metadata: { z: _z, part: _i + 1, of: _k, t: _shT } });\n"
     "          }\n"
     "        } catch (_eSh) { console.log('[T-SHADOW-HOUR-01] δεν γράφτηκε: ' + (_eSh && _eSh.message)); }\n"
     "      }\n"
     "      await _fbDev.sendData(_rows);\n", "Σ4 εγγραφή στη συσκευή εποπτείας"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"
    s = s.replace(old, new); print("  OK", label)
fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, s.encode("utf-8")); os.close(fd)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
assert r.returncode == 0, "node --check: " + r.stderr[:400]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8")
io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
