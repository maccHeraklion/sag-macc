// Ελεγκτής T-HOURPACKET-01 (v50.187, 7/11/2026): ωριαίο πακέτο ανά όργανο, σκιώδες. Τρέχει το πραγματικό μπλοκ του πυρήνα με ψεύτικη συσκευή. Μεταλλάξεις: κάθε βλάβη πρέπει να πιαστεί.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import zlib from "node:zlib"; import vm from "node:vm";
const here = path.dirname(fileURLToPath(import.meta.url));
const K0 = fs.readFileSync(path.join(here, "..", "runPerTich.js"), "utf8").replace(/\r\n/g, "\n");
const blockOf = (K) => { const a = K.indexOf("const _SAG_HP_UNTIL"), b = K.indexOf("/* ══ T-HOURPACKET-01 (ΤΕΛΟΣ)"); if (a < 0 || b < 0) throw new Error("δεν βρέθηκε το μπλοκ"); return K.slice(a, b); };
const load = (K, runNow) => { const sb = { Intl, Date, Math, Number, String, JSON, Map, Set, Buffer, Object, zlib, console: { log() {} }, _SAG_RUN_NOW: runNow ?? null, _SAG_EC_MIN_VWC: 0.15, _SAG_EC_DEAD_US: 30, _sagEcChain: (c, m) => ({ pore: c / m }) }; vm.createContext(sb); vm.runInContext(blockOf(K) + "\nglobalThis.X={_sagHpStats,_sagHpExpected,_sagHpClass,_sagHourWet,_sagHpLight,_sagHpBuild,_sagHourPacket,_sagHpParts,_sagHpType,_sagGreekHour,_sagHpReset,_SAG_HP,_SAG_HP_TYPES,_SAG_HP_COST,_sagHpDew,_sagHpVapour};", sb); return sb.X; };
const H = 3600000, h1 = Date.parse("2026-11-07T12:00:00Z"), h0 = h1 - H;
const series = (vars, stepMin, from, to, fn) => { const r = []; for (let t = from; t < to; t += stepMin * 60000) for (const v of vars) r.push({ variable: v, value: fn(v, t), time: new Date(t).toISOString() }); return r; };
const toBy = (rows) => { const m = new Map(); for (const r of rows) { const t = Date.parse(r.time); if (!m.has(t)) m.set(t, {}); m.get(t)[r.variable] = Number(r.value); } return m; };

async function check(K) {
  const bad = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(n + ": πήρα " + JSON.stringify(a) + " αντί " + JSON.stringify(b)); }; const ok = (n, c) => { if (!c) bad.push(n); };
  let X; try { X = load(K); } catch (e) { return ["φόρτωση: " + e.message]; }
  /* πίνακας §3 */
  for (const [n, e, c] of [[12, 12, "f"], [9, 12, "f"], [8, 12, "p"], [4, 12, "p"], [3, 12, "u"], [0, 12, "u"], [6, 6, "f"], [5, 6, "f"], [4, 6, "p"], [2, 6, "p"], [1, 6, "u"], [3, 3, "f"], [2, 3, "p"], [1, 3, "u"], [2, 2, "f"], [1, 2, "p"], [0, 2, "u"], [1, 1, "f"], [0, 1, "u"]]) eq(`κλάση ${n}/${e}`, X._sagHpClass(n, e), c);
  /* απόφαση 2 */
  for (const [w, n, r] of [[2, 3, 1], [1, 3, 0], [3, 3, 1], [0, 3, 0], [1, 2, 1], [0, 2, 0], [1, 1, null], [0, 0, null], [3, 6, 1], [2, 6, 0]]) eq(`υγρή ώρα ${w}/${n}`, X._sagHourWet(w, n), r);
  /* στατιστικά */
  eq("στατιστικά", X._sagHpStats([{ t: 3, v: 1 }, { t: 1, v: 9 }, { t: 2, v: 2 }]), [1, 4, 2, 1, 9, 3]); eq("άρτιο πλήθος", X._sagHpStats([{ t: 1, v: 1 }, { t: 2, v: 3 }])[2], 2); eq("κενό", X._sagHpStats([]), null);
  eq("βήμα από δεδομένα", X._sagHpExpected([0, 5, 10, 15].map((m) => m * 60000), 20), 12); eq("δύο δείγματα: βήμα τύπου", X._sagHpExpected([0, 300000], 20), 3); eq("κενό στη μέση δεν αλλάζει το βήμα", X._sagHpExpected([0, 5, 10, 50, 55].map((m) => m * 60000), 5), 12);
  /* φως */
  eq("φως με βάρος χρόνου", X._sagHpLight([{ t: 0, v: 100 }, { t: 30 * 60000, v: 100 }], 30), [50, 30]); eq("το κενό δεν γίνεται φως", X._sagHpLight([{ t: 0, v: 100 }, { t: 5 * 60000, v: 100 }, { t: 45 * 60000, v: 100 }], 5), [8, 5]); eq("ένα δείγμα", X._sagHpLight([{ t: 0, v: 1 }], 5), null);
  /* ώρα Ελλάδας */
  eq("χειμώνας", X._sagGreekHour(Date.parse("2026-11-07T04:30:00Z")), 6); eq("καλοκαίρι", X._sagGreekHour(Date.parse("2026-07-07T03:30:00Z")), 6); eq("μεσάνυχτα", X._sagGreekHour(Date.parse("2026-11-07T22:30:00Z")), 0);
  eq("τύποι", ["s2120", "se0x", "lse02", "lse01", "lse01_deep", "lms01_ls", "em320_th", "em300_th", "uc511", "sph01", null].map(X._sagHpType), ["s2120", "se0x", "lse02", "lse01", "lse01", "lms01_ls", "em320_th", "em300_th", null, null, null]);
  /* σταθμός */
  const T = X._SAG_HP_TYPES, S = T.s2120;
  let o = X._sagHpBuild(S, toBy(series(S.vars, 5, h0, h1, (v) => ({ air_temperature: 20, air_humidity: 50, light_intensity: 1000 })[v])), h0, h1, null, null);
  eq("σταθμός πλήθος", [o.e, o.n, o.c], [12, 12, "f"]); eq("ηλικία", o.a, 5); eq("κανάλι", o.ch.air_temperature, [20, 20, 20, 20, 20, 12]); ok("VPD ≈ 1,17", Math.abs(o.vpd - 1.169) < 0.01); ok("δρόσος ≈ 9,3", Math.abs(o.td - 9.26) < 0.1); eq("όχι υγρή από RH", o.rw, [0, 12, 0]); eq("φως", o.li, [917, 55]);
  o = X._sagHpBuild(S, toBy(series(S.vars, 5, h0, h1, (v, t) => (v === "air_humidity" ? ((t - h0) / 300000 < 6 ? 95 : 60) : 15))), h0, h1, null, null); eq("RH: μισά πάνω από όριο", o.rw, [6, 12, 1]);
  /* σιωπηλό όργανο: γράφεται ως άγνωστο, δεν εξαφανίζεται */
  o = X._sagHpBuild(S, new Map(), h0, h1, null, null); eq("σιωπηλό", [o.n, o.c, o.a, o.ch], [0, "u", undefined, {}]);
  /* εκτός παραθύρου δεν μετρά */
  o = X._sagHpBuild(S, toBy(series(S.vars, 5, h0 - H, h0, () => 1).concat(series(S.vars, 5, h1, h1 + H, () => 1))), h0, h1, null, null); eq("μόνο η κλειστή ώρα", o.n, 0);
  /* φύλλο */
  const L = T.lms01_ls; const leaf = (vals) => toBy(vals.map((v, i) => ({ variable: "leaf_moisture", value: v, time: new Date(h0 + i * 20 * 60000).toISOString() })));
  eq("2 από 3", X._sagHpBuild(L, leaf([30, 30, 5]), h0, h1, null, null).lw, [2, 3, 1]); eq("1 από 3", X._sagHpBuild(L, leaf([30, 5, 5]), h0, h1, null, null).lw, [1, 3, 0]); eq("ένα δείγμα: άγνωστη", X._sagHpBuild(L, leaf([30]), h0, h1, null, null).lw, [1, 1, null]); eq("όριο 15 δεν είναι υγρό", X._sagHpBuild(L, leaf([15, 15, 15]), h0, h1, null, null).lw, [0, 3, 0]); eq("άκυρη τιμή", X._sagHpBuild(L, leaf([130, 30, 30]), h0, h1, null, null).lw, [2, 2, 1]);
  /* έδαφος, αναφορά */
  const So = T.se0x, ec = (c, m) => ({ pore: c / m });
  const soil = toBy(series(So.vars, 20, h0 - H, h1, (v, t) => (v.startsWith("soil_moisture") ? (t < h0 ? 20 : 30) : v.startsWith("conduct") ? 600 : 18)));
  o = X._sagHpBuild(So, soil, h0, h1, null, ec); eq("EC ανά δείγμα", o.p1, [20, 20, 20, 20, 20, 3]); ok("χωρίς αναφορά εκτός παραθύρου", o.r1 === undefined);
  o = X._sagHpBuild(So, soil, h0, h1, h0 - H, ec); eq("αναφορά: διάμεσος δύο ωρών", o.r1, [25, 6]); eq("αναφορά EC", o.q1, [25, 6]); eq("ωριαίος μένει στην ώρα", o.ch.soil_moisture1[5], 3);
  const dead = toBy(series(So.vars, 20, h0, h1, (v) => (v.startsWith("soil_moisture") ? 30 : v.startsWith("conduct") ? 5 : 18))); o = X._sagHpBuild(So, dead, h0, h1, null, ec); ok("νεκρό κανάλι EC", o.p1 === undefined);
  /* ανάγνωση */
  const calls = []; const dev = (rows) => ({ getData: async (q) => { calls.push(q); return rows; } }); const now = "2026-11-07T12:21:00.000Z";
  X._sagHpReset(); await X._sagHourPacket(dev(series(S.vars, 5, h0, h1, () => 20)), "s2120", "abcdef123456", "ΣΤΑΘΜΟΣ", "Αγρός", now);
  eq("παράθυρο ανάγνωσης", [calls[0].start_date, calls[0].end_date], ["2026-11-07T11:00:00.000Z", "2026-11-07T12:00:00.000Z"]); eq("εγγραφή", [X._SAG_HP.length, X._SAG_HP[0].i, X._SAG_HP[0].y, X._SAG_HP[0].f], [1, "123456", "s2120", "Αγρός"]); eq("κόστος", [X._SAG_HP_COST.reads, X._SAG_HP_COST.rows], [1, 36]);
  await X._sagHourPacket(dev([]), "s2120", "abcdef123456", "ΣΤΑΘΜΟΣ", "Άλλος αγρός", now); eq("ίδιο όργανο σε δεύτερο αγρό: μία φορά", [X._SAG_HP.length, calls.length], [1, 1]);
  await X._sagHourPacket(dev([]), "uc511", "b", "ΒΑΝΑ", "Αγρός", now); eq("βάνα εκτός", X._SAG_HP.length, 1);
  await X._sagHourPacket({ getData: async () => { throw new Error("x"); } }, "s2120", "c", "Χ", "Α", now); eq("σφάλμα δεν ρίχνει τον κύκλο", X._SAG_HP.length, 1);
  await X._sagHourPacket(dev([]), "s2120", "d", "Χ", "Α", "2026-11-16T00:00:00.000Z"); eq("λήγει μόνο του", X._SAG_HP.length, 1);
  calls.length = 0; X._sagHpReset(); await X._sagHourPacket(dev([]), "se0x", "e", "Σ", "Α", "2026-11-07T05:21:00.000Z"); eq("αναφορά: δύο ώρες, κλείνει 07:00 Ελλάδας", calls[0].start_date, "2026-11-07T03:00:00.000Z");
  calls.length = 0; X._sagHpReset(); await X._sagHourPacket(dev([]), "s2120", "f", "Σ", "Α", "2026-11-07T05:21:00.000Z"); eq("σταθμός χωρίς αναφορά", calls[0].start_date, "2026-11-07T04:00:00.000Z");
  const Y = load(K, new Date(Date.now() - 200000).toISOString()); await Y._sagHourPacket(dev([]), "s2120", "g", "Σ", "Α", now); eq("όριο χρόνου", [Y._SAG_HP.length, Y._SAG_HP_COST.skipped], [0, 1]);
  /* μέρη */
  const many = Array.from({ length: 95 }, (_, i) => ({ i: "x" + i, d: "dragino_" + i, ch: Object.fromEntries(Array.from({ length: 24 }, (_, j) => ["c" + j, [Math.random(), Math.random(), Math.random()]])) }));
  const parts = X._sagHpParts(many, "t", "h", "v"); ok("μέρη κάτω από το όριο", parts.length > 4 && parts.every((p) => p.z.length <= 8000)); eq("δεν χάνεται όργανο", parts.reduce((a, p) => a + p.n, 0), 95);
  const back = parts.flatMap((p) => JSON.parse(zlib.inflateRawSync(Buffer.from(p.z, "base64")).toString("utf8")).r); eq("αποσυμπίεση", back.map((r) => r.i), many.map((r) => r.i));
  /* σκιώδες: κανένα μοντέλο δεν το διαβάζει */
  const outside = K.replace(blockOf(K), ""); ok("ο βρόχος καλεί", outside.includes("if (hourTich) await _sagHourPacket(device, typeName, value, info?.name || value, fieldName, now);")); ok("μηδενίζεται ανά παλμό", outside.includes("_sagHpReset();")); ok("γράφεται στην εποπτεία", outside.includes("variable: 'sag_hour_packet'"));
  ok("κανένας άλλος δεν διαβάζει το πακέτο", (outside.match(/_SAG_HP\b/g) || []).length === 3 && !/deviceData\.[a-z_]*hour_packet/.test(outside));
  return bad;
}
const r = await check(K0); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ ωριαίο πακέτο");
const MUT = [["const row = exp >= 9 ? [9, 4]", "const row = exp >= 9 ? [8, 4]"], ["exp >= 4 ? [5, 2]", "exp >= 4 ? [4, 2]"], ["exp === 3 ? [3, 2]", "exp === 3 ? [2, 2]"], ["n < 2 ? null : (wet * 2 >= n ? 1 : 0)", "n < 2 ? 0 : (wet * 2 >= n ? 1 : 0)"], ["wet * 2 >= n ? 1 : 0", "wet > 0 ? 1 : 0"], ["wet * 2 >= n ? 1 : 0", "wet * 2 > n ? 1 : 0"], ["if (dt <= 0 || dt > 2 * stepMin) continue;", ""], ["(t.length >= 3 && g.length) ? g[(g.length - 1) >> 1] : defStep", "g.length ? g[(g.length - 1) >> 1] : defStep"], ["filter((t) => t >= h0 && t < h1).sort", "filter((t) => t >= h0).sort"], ["x.v > _SAG_HP_LEAF_WET", "x.v >= _SAG_HP_LEAF_WET"], ["filter((x) => x.v >= 0 && x.v <= 100)", "filter((x) => x.v >= 0)"], ["p[hv] >= _SAG_HP_RH_WET", "p[hv] > 95"], ["|| (m > _SAG_EC_MIN_VWC * 100 && c < _SAG_EC_DEAD_US)) return null;", ") return null;"], ["if (rm) o['r' + k] = [rm[2], rm[5]];", "if (rm) o['r' + k] = [rm[1] + 1, rm[5]];"], ["cfg.soil && _sagGreekHour(h0) === _SAG_HP_REF_HOUR", "_sagGreekHour(h0) === _SAG_HP_REF_HOUR"], ["const _SAG_HP_REF_HOUR = 6;", "const _SAG_HP_REF_HOUR = 7;"], ["|| _SAG_HP_SEEN.has(devId)", ""], ["if (!Number.isFinite(end) || end >= _SAG_HP_UNTIL) return;", "if (!Number.isFinite(end)) return;"], ["> _SAG_HP_BUDGET_MS) { _SAG_HP_COST.skipped++; return; }", "> _SAG_HP_BUDGET_MS) { _SAG_HP_COST.skipped++; }"], ["h1 = Math.floor(end / 3600000) * 3600000", "h1 = end"], ["k = Math.ceil(k / 2);", "break;"], ["timeZone: 'Europe/Athens'", "timeZone: 'UTC'"], ["return /^lse01/.test(s) ? 'lse01' :", "return"], ["o.td = Math.round(_sagHpDew(eMean) * 100) / 100;", "o.td = tM;"]];
let k = 0; for (const [a, b] of MUT) { if (!K0.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } let bad; try { bad = await check(K0.replace(a, b)); } catch (e) { bad = ["εξαίρεση"]; } if (bad.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
