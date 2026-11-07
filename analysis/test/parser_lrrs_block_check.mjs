// T-GWMAP-07 — ΕΛΕΓΧΟΣ: το κοινό μπλοκ λίστας πυλών. Δεν αλλάζει καμία μέτρηση, γράφει τη λίστα στην ΥΠΑΡΧΟΥΣΑ lrrid, δεν ρίχνει ποτέ το uplink. Μεταλλάξεις: κάθε βλάβη πρέπει να πιαστεί.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const NEW = fs.readFileSync(fileURLToPath(new URL("../../payload_parsers/device_lrrs_block_2026-11-07.js", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const T = "2026-11-07T12:00:00.000Z";
const P0 = () => [{ variable: "soil_moisture1", value: 21.5, time: T }, { variable: "lrrid", value: "1000AAAA", time: T, location: { lat: 35, lng: 25 } }];
const P1 = () => [{ variable: "leaf_moisture", value: 12, time: T }];
const up = { DevEUI_uplink: { Lrrid: "1000AAAA", Lrrs: { Lrr: [{ Lrrid: "1000AAAA", LrrRSSI: -90, LrrSNR: 8 }, { Lrrid: "1000BBBB", LrrRSSI: "-110.5", LrrSNR: "χάλια" }, { foo: 1 }] } } };
const L = [["1000AAAA", -90, 8], ["1000BBBB", -110.5, null]];
const run = (src, raw, pl) => new Function("payload", "raw_payload", "console", `${src}\nreturn payload;`)(pl, raw, { log() {}, error() {} });
function check(src) {
  const bad = []; const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(n + " πήρα " + JSON.stringify(a)); };
  const shapes = { "πίνακας actility, κείμενο": [{ variable: "actility_payload", value: JSON.stringify(up) }], "πίνακας actility, αντικείμενο": [{ variable: "actility_payload", value: up }], "σε metadata": [{ variable: "actility_payload", value: "x", metadata: up }], "αντικείμενο": up, "κείμενο": JSON.stringify(up) };
  for (const [n, raw] of Object.entries(shapes)) {
    const o = run(src, raw, P0());
    eq(n + ": ίδιο πλήθος εγγραφών", o.length, 2); eq(n + ": μέτρηση ίδια", o[0], P0()[0]);
    eq(n + ": λίστα στην υπάρχουσα lrrid", o[1].metadata, { lrrs: L }); eq(n + ": κρατά τη θέση", o[1].location, { lat: 35, lng: 25 });
  }
  const m = P0(); m[1].metadata = { x: 1 }; eq("κρατά άλλο metadata", run(src, up, m)[1].metadata, { x: 1, lrrs: L });
  const add = run(src, up, P1()); eq("λείπει η lrrid: προστίθεται μία", [add.length, add[1]?.value, add[1]?.time], [2, "1000AAAA", T]);
  const one = run(src, { DevEUI_uplink: { Lrrid: "1000AAAA", Lrrs: { Lrr: { Lrrid: "1000AAAA", LrrRSSI: -23, LrrSNR: 15 } } } }, P0()); eq("ένα αντικείμενο", one[1].metadata, { lrrs: [["1000AAAA", -23, 15]] });
  for (const [n, raw] of [["κενό", null], ["χαλασμένο", "{oops"], ["αριθμός", 42], ["άγνωστο", { foo: 1 }], ["πίνακας άγνωστος", [{ variable: "x", value: "{oops" }, null]]]) {
    let o; try { o = run(src, raw, P0()); } catch (e) { bad.push(n + ": ΕΡΙΞΕ"); continue; } eq(n + ": τίποτα δεν αλλάζει", o, P0());
  }
  const noList = run(src, { DevEUI_uplink: { Lrrid: "1000AAAA" } }, P0()); eq("χωρίς λίστα, χωρίς metadata", noList, P0());
  try { const s = run(src, up, "κείμενο"); if (s !== "κείμενο") bad.push("άλλαξε payload κείμενο"); } catch (e) { bad.push("ΕΡΙΞΕ με payload κείμενο"); }
  return bad;
}
const r = check(NEW); for (const b of r) console.log("ΑΠΟΤΥΧΙΑ", b);
console.log(r.length ? "ΑΠΟΤΥΧΙΑ" : "ΟΚ");
const MUT = [["o.DevEUI_uplink || ", ""], ["_raw = _obj(_raw);", ""], ["_pick(_obj(_x.value)) || ", ""], [" || _pick(_obj(_x.metadata))", ""], ["(Array.isArray(_lr) ? _lr : (_lr ? [_lr] : []))", "(Array.isArray(_lr) ? _lr : [])"], [".filter((x) => x && x.Lrrid)", ""],
  ["Number.isFinite(Number(x.LrrSNR)) ? Number(x.LrrSNR) : null", "x.LrrSNR"], ["Object.assign({}, _rec.metadata, { lrrs: _ls })", "{ lrrs: _ls }"], ["if (_ref) _rec.time = _ref.time;", ""], ["let _rec = payload.find((x) => x && x.variable === 'lrrid');", "let _rec = null;"], ["if (_ls.length) _rec.metadata", "_rec.metadata"], ["try { return JSON.parse(v); } catch (e) { return null; }", "return JSON.parse(v);"]];
let k = 0; for (const [a, b] of MUT) { if (!NEW.includes(a)) { console.log("ΑΚΥΡΗ", a); process.exitCode = 1; continue; } let bad; try { bad = check(NEW.replace(a, b)); } catch (e) { bad = ["εξαίρεση"]; } if (bad.length) k++; else { console.log("ΕΠΕΖΗΣΕ", a); process.exitCode = 1; } }
console.log(`μεταλλάξεις ${k}/${MUT.length}`); if (r.length) process.exitCode = 1;
