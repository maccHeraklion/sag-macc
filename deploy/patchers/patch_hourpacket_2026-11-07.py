# -*- coding: utf-8 -*-
"""T-HOURPACKET-01 (v50.187, 7/11/2026): Φάση Β των κανόνων δεδομένων, εγκεκριμένη από τον Michalis. Ωριαίο πακέτο ανά όργανο, ΣΚΙΩΔΕΣ.
Κανένα μοντέλο δεν το διαβάζει. Γράφεται συμπιεσμένο στη συσκευή εποπτείας, όχι στο field_bundle, άρα δεν αγγίζει ταμπλό ή πελάτη."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = sys.argv[1]
p = ROOT + '/analysis/runPerTich.js'
raw = open(p, encoding='utf-8', newline='').read()
assert raw.count('\r\n') > 0 and raw.replace('\r\n', '').count('\n') == 0, 'ο πυρήνας δεν είναι καθαρό CRLF'
s = raw.replace('\r\n', '\n')


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b)


sub("""const SAG_KERNEL_VERSION = 'v50.186 · 2026-11-07';""", """const SAG_KERNEL_VERSION = 'v50.187 · 2026-11-07';""")
sub("""/* ══ T-PHASE0B-01 (v50.183 · 7/11/2026) · Η ΩΡΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΟΛΑ ΤΑ ΔΕΙΓΜΑΤΑ ΤΟΥ ΦΥΛΛΟΥ ══
""", """/* ══ T-HOURPACKET-01 (v50.187 · 7/11/2026) · ΩΡΙΑΙΟ ΠΑΚΕΤΟ ΑΝΑ ΟΡΓΑΝΟ, ΣΚΙΩΔΕΣ ══════════════════
   Φάση Β του reports/ΚΑΝΟΝΕΣ_ΔΕΔΟΜΕΝΩΝ_ΠΡΟΤΑΣΗ_2026-11-07.md, έγκριση Michalis 7/11. ΚΑΝΕΝΑ μοντέλο δεν το διαβάζει: μετρά πόσο θα
   διέφεραν οι κανόνες, για τη σύγκριση της Φάσης Γ. Μία ανάγνωση ανά όργανο και κλειστή ώρα, ίδια συνάρτηση για όλους τους τύπους.
   Κλειστή ώρα [h-1, h): 24 τέτοιες ώρες κάνουν ακριβώς μία ημέρα Ελλάδας (απόφαση 4), και το ίδιο όργανο κρίνεται μία φορά ανά ώρα.
   Λήγει μόνο του: ο στόχος είναι η σύγκριση, όχι μόνιμο κόστος ανάγνωσης. */
const _SAG_HP_UNTIL = Date.parse('2026-11-16T00:00:00Z');
const _SAG_HP_BUDGET_MS = 150000;   // πάνω από αυτό ο παλμός δεν διαβάζει άλλα πακέτα: το σκιώδες δεν καθυστερεί ποτέ τις συμβουλές
const _SAG_HP_MAX_CHARS = 8000;
const _SAG_HP_LEAF_WET = 15;        // ίδιο όριο υγρού φύλλου με τον πυρήνα σήμερα (leaf_moisture > 15)
const _SAG_HP_RH_WET = 90;
const _SAG_HP_REF_HOUR = 6;         // απόφαση 6: παράθυρο αναφοράς 05:00–07:00 Ελλάδας, κλείνει με την ώρα 06
const _SAG_HP_TYPES = {
  s2120: { step: 5, vars: ['air_temperature', 'air_humidity', 'light_intensity'], air: ['air_temperature', 'air_humidity'], light: 'light_intensity' },
  em300_th: { step: 10, vars: ['temperature', 'humidity'], air: ['temperature', 'humidity'] },
  em320_th: { step: 10, vars: ['temperature', 'humidity'], air: ['temperature', 'humidity'] },
  se0x: { step: 20, vars: ['soil_moisture1', 'soil_moisture2', 'conduct_soil1', 'conduct_soil2', 'soil_temperature1', 'soil_temperature2'],
    soil: [['soil_moisture1', 'conduct_soil1', 'soil_temperature1', '1'], ['soil_moisture2', 'conduct_soil2', 'soil_temperature2', '2']] },
  lse02: { step: 20, vars: ['soil_moisture1', 'soil_moisture2', 'conduct_soil1', 'conduct_soil2', 'soil_temperature1', 'soil_temperature2'],
    soil: [['soil_moisture1', 'conduct_soil1', 'soil_temperature1', '1'], ['soil_moisture2', 'conduct_soil2', 'soil_temperature2', '2']] },
  lse01: { step: 20, vars: ['soil_moisture', 'conduct_soil', 'temp_soil'], soil: [['soil_moisture', 'conduct_soil', 'temp_soil', '1']] },
  lms01_ls: { step: 20, vars: ['leaf_moisture', 'leaf_temperature'], leaf: 'leaf_moisture' },
};
const _SAG_HP = [];
const _SAG_HP_SEEN = new Set();
const _SAG_HP_COST = { reads: 0, rows: 0, skipped: 0 };
function _sagHpReset() { _SAG_HP.length = 0; _SAG_HP_SEEN.clear(); _SAG_HP_COST.reads = 0; _SAG_HP_COST.rows = 0; _SAG_HP_COST.skipped = 0; }
function _sagHpType(t) { const s = String(t || ''); return /^lse01/.test(s) ? 'lse01' : (_SAG_HP_TYPES[s] ? s : null); }
function _sagGreekHour(ms) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', hour12: false }).format(new Date(ms))) % 24;
}
// [τελευταία, μέσος, διάμεσος, ελάχιστο, μέγιστο, πλήθος]
function _sagHpStats(arr) {
  const ok = (arr || []).filter((x) => x && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
  if (!ok.length) return null;
  const vs = ok.map((x) => x.v).sort((a, b) => a - b), n = vs.length;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return [r3(ok[n - 1].v), r3(vs.reduce((a, b) => a + b, 0) / n), r3(n % 2 ? vs[(n - 1) / 2] : (vs[n / 2 - 1] + vs[n / 2]) / 2), r3(vs[0]), r3(vs[n - 1]), n];
}
// Ο αναμενόμενος ρυθμός διαβάζεται από τα δεδομένα του οργάνου. Με λιγότερα από 3 δείγματα δεν βγαίνει, και ισχύει το βήμα του τύπου.
function _sagHpExpected(ts, defStep) {
  const t = [...ts].sort((a, b) => a - b), g = [];
  for (let i = 1; i < t.length; i++) g.push((t[i] - t[i - 1]) / 60000);
  g.sort((a, b) => a - b);
  const step = (t.length >= 3 && g.length) ? g[(g.length - 1) >> 1] : defStep;
  return Math.max(1, Math.min(12, Math.round(60 / Math.max(step, 1))));
}
// Πίνακας §3 της πρότασης. 'f' πλήρης, 'p' μερική με σήμανση, 'u' άγνωστη. 1 από 2 δείγματα μένει μερική: ο πίνακας δεν το καλύπτει.
function _sagHpClass(n, exp) {
  const row = exp >= 9 ? [9, 4] : exp >= 4 ? [5, 2] : exp === 3 ? [3, 2] : exp === 2 ? [2, 1] : [1, 1];
  return n >= row[0] ? 'f' : (n >= row[1] ? 'p' : 'u');
}
// Απόφαση 2: η ώρα είναι υγρή με τουλάχιστον τα μισά δείγματα υγρά. Κάτω από 2 δείγματα η ώρα είναι άγνωστη, όχι στεγνή (Κ1).
function _sagHourWet(wet, n) { return n < 2 ? null : (wet * 2 >= n ? 1 : 0); }
// Κ4: φως με βάρος τον χρόνο. Κάθε διάστημα μετρά το πολύ δύο βήματα, αλλιώς ένα κενό θα γινόταν σιωπηλά «φως». [lux·ώρες, καλυμμένα λεπτά]
function _sagHpLight(arr, stepMin) {
  const ok = (arr || []).filter((x) => x && Number.isFinite(x.v)).sort((a, b) => a.t - b.t);
  if (ok.length < 2) return null;
  let sum = 0, min = 0;
  for (let i = 1; i < ok.length; i++) {
    const dt = (ok[i].t - ok[i - 1].t) / 60000;
    if (dt <= 0 || dt > 2 * stepMin) continue;
    sum += (ok[i].v + ok[i - 1].v) / 2 * dt / 60; min += dt;
  }
  return [Math.round(sum), Math.round(min)];
}
function _sagHpVapour(T, RH) { return 0.6108 * Math.exp(17.27 * T / (T + 237.3)) * RH / 100; }
function _sagHpDew(e) { const l = Math.log(e / 0.6108); return 237.3 * l / (17.27 - l); }
// Από τη λίστα δειγμάτων στην εγγραφή του οργάνου. by: χάρτης χρόνος → {μεταβλητή: τιμή}. ref: η ώρα κλείνει το πρωινό παράθυρο αναφοράς.
function _sagHpBuild(cfg, by, h0, h1, refFrom, ecChain) {
  const inH = [...by.keys()].filter((t) => t >= h0 && t < h1).sort((a, b) => a - b);
  const col = (v, from, to) => [...by.keys()].filter((t) => t >= from && t < to).sort((a, b) => a - b)
    .map((t) => ({ t, v: by.get(t)[v] })).filter((x) => Number.isFinite(x.v));
  const e = _sagHpExpected(inH, cfg.step), o = { e, n: inH.length, c: _sagHpClass(inH.length, e) };
  if (inH.length) o.a = Math.round((h1 - inH[inH.length - 1]) / 60000);
  const ch = {};
  for (const v of cfg.vars) { const st = _sagHpStats(col(v, h0, h1)); if (st) ch[v] = st; }
  o.ch = ch;
  if (cfg.air) {
    const [tv, hv] = cfg.air, pairs = inH.map((t) => by.get(t)).filter((p) => Number.isFinite(p[tv]) && Number.isFinite(p[hv]) && p[hv] > 0);
    if (pairs.length) {
      // Σημείο δρόσου από μέσο τάσης ατμών, ανά δείγμα του ίδιου οργάνου (Κ5, Κ6). VPD από τους ωριαίους μέσους T, RH (§4).
      const eMean = pairs.reduce((a, p) => a + _sagHpVapour(p[tv], p[hv]), 0) / pairs.length;
      const tM = pairs.reduce((a, p) => a + p[tv], 0) / pairs.length, hM = pairs.reduce((a, p) => a + p[hv], 0) / pairs.length;
      o.td = Math.round(_sagHpDew(eMean) * 100) / 100;
      o.vpd = Math.round(Math.max(0, _sagHpVapour(tM, 100) * (1 - hM / 100)) * 1000) / 1000;
      const w = pairs.filter((p) => p[hv] >= _SAG_HP_RH_WET).length;
      o.rw = [w, pairs.length, _sagHourWet(w, pairs.length)];
    }
  }
  if (cfg.light) { const l = _sagHpLight(col(cfg.light, h0, h1), cfg.step); if (l) o.li = l; }
  if (cfg.leaf) {
    const l = col(cfg.leaf, h0, h1).filter((x) => x.v >= 0 && x.v <= 100), w = l.filter((x) => x.v > _SAG_HP_LEAF_WET).length;
    if (l.length) o.lw = [w, l.length, _sagHourWet(w, l.length)];
  }
  if (cfg.soil) {
    for (const [mv, cv, tv, k] of cfg.soil) {
      // Κ5: ο τύπος της EC δεν είναι γραμμικός, άρα ανά δείγμα και μετά στατιστικό.
      const pore = (from, to) => [...by.keys()].filter((t) => t >= from && t < to).map((t) => {
        const p = by.get(t), m = p[mv], c = p[cv];
        if (!Number.isFinite(m) || !Number.isFinite(c) || (m > _SAG_EC_MIN_VWC * 100 && c < _SAG_EC_DEAD_US)) return null;
        const r = ecChain(c, m, p[tv], NaN);
        return r && r.pore !== null ? { t, v: r.pore } : null;
      }).filter(Boolean);
      const ps = _sagHpStats(pore(h0, h1));
      if (ps) o['p' + k] = ps;
      if (refFrom !== null) {
        const rm = _sagHpStats(col(mv, refFrom, h1)), rp = _sagHpStats(pore(refFrom, h1));
        if (rm) o['r' + k] = [rm[2], rm[5]];
        if (rp) o['q' + k] = [rp[2], rp[5]];
      }
    }
  }
  return o;
}
async function _sagHourPacket(device, typeName, devId, devName, fieldName, nowIso) {
  try {
    const cfgType = _sagHpType(typeName);
    if (!cfgType || _SAG_HP_SEEN.has(devId)) return;
    const end = Date.parse(String(nowIso || ''));
    if (!Number.isFinite(end) || end >= _SAG_HP_UNTIL) return;
    _SAG_HP_SEEN.add(devId);
    if (_SAG_RUN_NOW && Date.now() - Date.parse(_SAG_RUN_NOW) > _SAG_HP_BUDGET_MS) { _SAG_HP_COST.skipped++; return; }
    const cfg = _SAG_HP_TYPES[cfgType], h1 = Math.floor(end / 3600000) * 3600000, h0 = h1 - 3600000;
    const refFrom = (cfg.soil && _sagGreekHour(h0) === _SAG_HP_REF_HOUR) ? h0 - 3600000 : null;
    const rows = await device.getData({ variables: cfg.vars, start_date: new Date(refFrom === null ? h0 : refFrom).toISOString(),
      end_date: new Date(h1).toISOString(), qty: 300 });
    _SAG_HP_COST.reads++; _SAG_HP_COST.rows += (rows || []).length;
    const by = new Map();
    for (const r of (rows || [])) {
      const t = Date.parse(String(r && r.time || '')), v = (r && r.value !== null && r.value !== '') ? Number(r.value) : NaN;
      if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
      if (!by.has(t)) by.set(t, {});
      by.get(t)[r.variable] = v;
    }
    _SAG_HP.push(Object.assign({ i: String(devId).slice(-6), d: String(devName || '').slice(-24), y: cfgType, f: String(fieldName || '').slice(0, 40) },
      _sagHpBuild(cfg, by, h0, h1, refFrom, _sagEcChain)));
  } catch (_eHp) { /* σκιώδες: ποτέ δεν επηρεάζει τον κύκλο */ }
}
// Μέρη όσο χωρούν σε μία εγγραφή. Όργανο που δεν χωρά μόνο του δεν θα συμβεί ποτέ, αλλά τότε γράφεται όπως είναι, αντί να χαθεί σιωπηλά.
function _sagHpParts(rows, t, h0, ver) {
  const out = []; let i = 0;
  while (i < rows.length) {
    let k = Math.min(30, rows.length - i), z = '';
    for (;;) {
      z = zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, t, h: h0, k: ver, r: rows.slice(i, i + k) }), 'utf8')).toString('base64');
      if (z.length <= _SAG_HP_MAX_CHARS || k === 1) break;
      k = Math.ceil(k / 2);
    }
    out.push({ n: k, z }); i += k;
  }
  return out;
}
/* ══ T-HOURPACKET-01 (ΤΕΛΟΣ) ══ */

/* ══ T-PHASE0B-01 (v50.183 · 7/11/2026) · Η ΩΡΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΟΛΑ ΤΑ ΔΕΙΓΜΑΤΑ ΤΟΥ ΦΥΛΛΟΥ ══
""")
sub("""  _SAG_SHADOW.length = 0;  // T-SHADOW-HOUR-01
""", """  _SAG_SHADOW.length = 0;  // T-SHADOW-HOUR-01
  _sagHpReset();           // T-HOURPACKET-01
""")
sub("""    if (typeName === "em300_th" || typeName === "em320_th") {
      let avgArr;
""", """    // T-HOURPACKET-01: σκιώδες, μόνο στον ωριαίο παλμό, μία φορά ανά όργανο. Δεν γράφει στο deviceData.
    if (hourTich) await _sagHourPacket(device, typeName, value, info?.name || value, fieldName, now);

    if (typeName === "em300_th" || typeName === "em320_th") {
      let avgArr;
""")
sub("""      await _fbDev.sendData(_rows);
      if (_fbFiles.some(x => !x.c)) {""", """      // T-HOURPACKET-01: συμπιεσμένο, στη συσκευή εποπτείας, ποτέ στο field_bundle.
      if (hourTich && _SAG_HP.length) {
        try {
          const _hpT = new Date().toISOString(), _hpH = new Date(Math.floor(Date.now() / 3600000) * 3600000 - 3600000).toISOString();
          const _hpParts = _sagHpParts(_SAG_HP, _hpT, _hpH, SAG_KERNEL_VERSION);
          _hpParts.forEach((_p, _i) => _rows.push({ variable: 'sag_hour_packet', value: _p.n,
            metadata: { z: _p.z, part: _i + 1, of: _hpParts.length, t: _hpT, h: _hpH,
              reads: _SAG_HP_COST.reads, rows: _SAG_HP_COST.rows, skipped: _SAG_HP_COST.skipped } }));
          console.log('[T-HOURPACKET-01] όργανα ' + _SAG_HP.length + ' · εγγραφές ανάγνωσης ' + _SAG_HP_COST.rows + ' · παραλείφθηκαν ' + _SAG_HP_COST.skipped);
        } catch (_eHp2) { console.log('[T-HOURPACKET-01] δεν γράφτηκε: ' + (_eHp2 && _eHp2.message)); }
      }
      await _fbDev.sendData(_rows);
      if (_fbFiles.some(x => !x.c)) {""")
open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))
print('ok')
