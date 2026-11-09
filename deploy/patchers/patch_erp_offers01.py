# T-ERP-OFFERS-01 (9/11/2026, Michalis «προχώρα με τις προσφορές»): προσφορές με αποθήκευση στο erpRegistry.
import sys, subprocess
P = sys.argv[1]
s = open(P, 'rb').read().decode('utf-8').replace('\r\n', '\n')


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, (n, old[:80])
    s = s.replace(old, new)


sub('const VERSION = "erpRegistry v1.2 · 2026-11-09";', 'const E_OFF = "6af236dd90b4a2000cfadc76";         // Entity «ERP · Προσφορές»\nconst VERSION = "erpRegistry v1.3 · 2026-11-09";')

OFFERS = r'''
/* ── Προσφορές (T-ERP-OFFERS-01) ─────────────────────────────────────────────────────────────────── */
const OFF_N = { draft: "Πρόχειρη", sent: "Στάλθηκε", accepted: "Αποδεκτή", rejected: "Απορρίφθηκε", cancelled: "Ακυρώθηκε" };
const OFF_NEXT = { draft: ["sent", "cancelled"], sent: ["accepted", "rejected", "cancelled"], accepted: [], rejected: ["draft"], cancelled: ["draft"] };
const LINE_KINDS = ["eq", "svc", "subpk", "subi", "addon", "plan", "other"];
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const r2 = (v) => Math.round(v * 100) / 100;
function cleanLines(v) {
  const errors = [], out = [];
  const a = Array.isArray(v) ? v : [];
  if (!a.length) errors.push("Η προσφορά χρειάζεται τουλάχιστον ένα είδος.");
  if (a.length > 200) errors.push("Πάνω από 200 γραμμές.");
  a.slice(0, 200).forEach((x, i) => {
    const q = num(x && x.q), price = num(x && x.price), renew = x && x.renew != null && x.renew !== "" ? num(x.renew) : 0;
    const cost = x && x.cost != null && x.cost !== "" ? num(x.cost) : null;
    const n = trim(x && x.n, 200), kind = LINE_KINDS.indexOf(String(x && x.kind)) >= 0 ? String(x.kind) : "other";
    if (!n) errors.push("Γραμμή " + (i + 1) + ": χωρίς περιγραφή.");
    if (!(q > 0 && q <= 10000)) errors.push("Γραμμή " + (i + 1) + " («" + n + "»): ποσότητα εκτός ορίων.");
    if (!(price >= 0 && price <= 1e6)) errors.push("Γραμμή " + (i + 1) + " («" + n + "»): μη έγκυρη τιμή.");
    if (!(renew >= 0 && renew <= 1e6)) errors.push("Γραμμή " + (i + 1) + " («" + n + "»): μη έγκυρη ανανέωση.");
    out.push({ k: trim(x && x.k, 60), sku: trim(x && x.sku, 60), n, kind, q, price: r2(price), renew: r2(renew), cost: cost != null && Number.isFinite(cost) && cost >= 0 ? r2(cost) : null });
  });
  return { lines: out, errors };
}
// Τα σύνολα υπολογίζονται ΠΑΝΤΑ εδώ από τις γραμμές — ποτέ δεν εμπιστευόμαστε σύνολα της σελίδας.
function offerTotals(lines, discount) {
  const d = Math.min(Math.max(num(discount) || 0, 0), 50);
  const net = lines.reduce((s, l) => s + l.q * l.price, 0), base = net * (1 - d / 100);
  const goods = lines.filter((l) => l.kind !== "subpk"), gBase = goods.reduce((s, l) => s + l.q * l.price, 0) * (1 - d / 100);
  const cost = goods.some((l) => l.cost == null) ? null : goods.reduce((s, l) => s + l.q * l.cost, 0);
  return { net: r2(net), discount: d, disc: r2(net - base), base: r2(base), vat: r2(base * 0.24), gross: r2(base * 1.24),
    renew: r2(lines.reduce((s, l) => s + l.q * l.renew, 0)), cost: cost == null ? null : r2(cost), margin: cost == null ? null : r2(gBase - cost) };
}
function normalizeOffer(input, partial) {
  const d = input || {}, row = {}, errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(d, k);
  if (!partial || has("title")) row.title = trim(d.title, 100);
  if (!partial || has("template")) row.template = trim(d.template, 60);
  if (!partial || has("notes")) row.notes = String(d.notes == null ? "" : d.notes).slice(0, 5000);
  if (!partial || has("area")) { const a = d.area === "" || d.area == null ? null : num(d.area); if (a != null && !(a >= 0 && a <= 100000)) errors.push("Μη έγκυρη έκταση."); row.area = a; }
  if (!partial || has("installments")) { const n = Math.round(num(d.installments) || 1); if ([1, 3, 6, 12].indexOf(n) < 0) errors.push("Δόσεις: 1, 3, 6 ή 12."); row.installments = n; }
  if (!partial || has("valid_until")) { const v = trim(d.valid_until, 10); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push("Μη έγκυρη ημερομηνία ισχύος."); row.valid_until = v; }
  if (!partial || has("discount")) { const x = num(d.discount) || 0; if (x < 0 || x > 50) errors.push("Η έκπτωση πρέπει να είναι 0–50 %."); row.discount = x; }
  if (!partial || has("lines")) { const cl = cleanLines(d.lines); errors.push(...cl.errors); row.lines = cl.lines; }
  return { row, errors };
}
async function allOffers() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await api(`/entity/${E_OFF}/data?amount=500&page=${page}`);
    const rows = Array.isArray(r) ? r : [];
    out.push(...rows.map((o) => Object.assign({}, o, { lines: o.lines && Array.isArray(o.lines.list) ? o.lines.list : [] })));
    if (rows.length < 500) break;
  }
  return out;
}
function nextOfferNumber(all, year) {
  let mx = 0; for (const o of all) { const m = String(o.number || "").match(/^ΠΡ-(\d{4})-(\d+)$/); if (m && Number(m[1]) === year) mx = Math.max(mx, Number(m[2])); }
  return "ΠΡ-" + year + "-" + String(mx + 1).padStart(4, "0");
}
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
async function runOfferCommand(m, actor, cmd) {
  const op = String(m.op || "");
  const custs = await allCustomers();
  const offs = await allOffers();
  const byId = (id) => offs.find((o) => String(o.id) === String(id));
  const custOk = (id) => custs.find((c) => String(c.id) === String(id) && c.status !== "archived");
  if (op === "offer.create" || op === "offer.copy") {
    let input = m.data || {}, cid = m.customer_id || (m.data && m.data.customer_id);
    const src = op === "offer.copy" ? byId(m.id) : null;
    if (op === "offer.copy") {
      if (!src) return { ok: false, msg: "Η προσφορά δεν βρέθηκε." };
      input = { title: src.title, template: src.template, notes: src.notes, area: src.area, installments: src.installments, discount: src.discount, lines: src.lines, valid_until: "" };
      cid = m.customer_id || src.customer_id;
    }
    const c = custOk(cid); if (!c) return { ok: false, msg: "Διαλέξτε ενεργό πελάτη από το μητρώο." };
    const { row, errors } = normalizeOffer(input, false);
    if (errors.length) return { ok: false, msg: errors.join(" ") };
    const year = new Date().getUTCFullYear();
    Object.assign(row, { number: nextOfferNumber(offs, year), customer_id: String(c.id), customer_name: c.name, status: "draft", revision: 1,
      valid_until: row.valid_until || addDays(30), totals: offerTotals(row.lines, row.discount), version: 1, updated_by: actor });
    await insertRows(E_OFF, [row]);
    const fresh = (await allOffers()).find((o) => o.number === row.number);
    await audit({ ref_type: "offer", ref_id: fresh ? String(fresh.id) : row.number, action: src ? "copy" : "create", actor,
      changes: { number: [null, row.number], customer: [null, c.name], gross: [null, row.totals.gross] }, note: src ? "Αντίγραφο της " + src.number : "", cmd_id: cmd });
    return { ok: true, msg: "Αποθηκεύτηκε η προσφορά " + row.number + " για «" + c.name + "» (" + row.totals.gross.toFixed(2) + " € με ΦΠΑ).", id: fresh ? fresh.id : null, kind: "offer" };
  }
  const cur = byId(m.id); if (!cur) return { ok: false, msg: "Η προσφορά δεν βρέθηκε." };
  if (m.base_version != null && Number(m.base_version) !== Number(cur.version || 1))
    return { ok: false, msg: "Η προσφορά άλλαξε στο μεταξύ από άλλον χρήστη (" + (cur.updated_by || "—") + "). Ανανεώστε και ξαναδοκιμάστε." };
  if (op === "offer.update") {
    if (["accepted", "cancelled", "rejected"].indexOf(cur.status) >= 0) return { ok: false, msg: "Η προσφορά είναι «" + OFF_N[cur.status] + "»· για αλλαγές φτιάξτε αντίγραφο." };
    const { row, errors } = normalizeOffer(m.data, true);
    if (m.data && m.data.customer_id && String(m.data.customer_id) !== String(cur.customer_id)) {
      const c = custOk(m.data.customer_id);
      if (!c) errors.push("Διαλέξτε ενεργό πελάτη."); else { row.customer_id = String(c.id); row.customer_name = c.name; }
    }
    if (errors.length) return { ok: false, msg: errors.join(" ") };
    const lines = row.lines || cur.lines, disc = row.discount != null ? row.discount : cur.discount;
    row.totals = offerTotals(lines, disc);
    const newRev = cur.status === "sent";   // αλλαγή σε σταλμένη = νέα έκδοση, ξανά πρόχειρη
    const upd = Object.assign({ id: cur.id }, row, { version: Number(cur.version || 1) + 1, updated_by: actor },
      newRev ? { revision: Number(cur.revision || 1) + 1, status: "draft", sent_at: "" } : {});
    await editRows(E_OFF, [upd]);
    await audit({ ref_type: "offer", ref_id: String(cur.id), action: newRev ? "revision" : "update", actor,
      changes: { gross: [cur.totals ? cur.totals.gross : null, row.totals.gross], lines: [cur.lines.length, lines.length] }, note: "", cmd_id: cmd });
    return { ok: true, msg: (newRev ? "Νέα έκδοση " + (Number(cur.revision || 1) + 1) + " της " : "Αποθηκεύτηκε η ") + cur.number + " (" + row.totals.gross.toFixed(2) + " € με ΦΠΑ).", id: cur.id, kind: "offer" };
  }
  if (op === "offer.status") {
    const to = String(m.status || "");
    if ((OFF_NEXT[cur.status] || []).indexOf(to) < 0) return { ok: false, msg: "Δεν επιτρέπεται η αλλαγή «" + (OFF_N[cur.status] || cur.status) + "» → «" + (OFF_N[to] || to) + "»." };
    const now = new Date().toISOString(), upd = { id: cur.id, status: to, version: Number(cur.version || 1) + 1, updated_by: actor };
    if (to === "sent") upd.sent_at = now;
    if (to === "accepted" || to === "rejected") upd.decided_at = now;
    if (to === "draft") { upd.revision = Number(cur.revision || 1) + 1; upd.sent_at = ""; upd.decided_at = ""; }
    await editRows(E_OFF, [upd]);
    await audit({ ref_type: "offer", ref_id: String(cur.id), action: "status", actor, changes: { status: [cur.status, to] }, note: trim(m.note, 500), cmd_id: cmd });
    return { ok: true, msg: cur.number + ": «" + (OFF_N[cur.status] || cur.status) + "» → «" + OFF_N[to] + "».", id: cur.id, kind: "offer" };
  }
  return { ok: false, msg: "Άγνωστη εντολή «" + op + "»." };
}
'''
sub("/* ── Στιγμιότυπο για τη σελίδα ─", OFFERS + "\n/* ── Στιγμιότυπο για τη σελίδα ─")

sub("""async function runCommand(m) {
  const op = String(m.op || ""), actor = trim(m.actor, 100) || "γραφείο", cmd = trim(m.cmd_id, 60);
  const all = await allCustomers();""", """async function runCommand(m) {
  const op = String(m.op || ""), actor = trim(m.actor, 100) || "γραφείο", cmd = trim(m.cmd_id, 60);
  if (op.indexOf("offer.") === 0) return runOfferCommand(m, actor, cmd);
  const all = await allCustomers();""")

sub("""  const aud = await recentAudit(300);
  const payload = { v: VERSION, t: new Date().toISOString(),""", """  const aud = await recentAudit(300);
  const offs = await allOffers().catch((e) => { console.log("ΠΡΟΣΦΟΡΕΣ|" + e.message); return []; });
  const payload = { v: VERSION, t: new Date().toISOString(), offers: offs,""")

i = s.index("  // Τα παλιά στιγμιότυπα σβήνονται:")
j = s.index("  console.log(`ΔΗΜΟΣΙΕΥΣΗ|")
s = s[:i] + "  // Η Εποπτεία είναι immutable: τα παλιά στιγμιότυπα δεν σβήνονται (2 εγγραφές ανά εντολή, αμελητέο).\n" + s[j:]
sub("console.log(`ΔΗΜΟΣΙΕΥΣΗ|πελάτες=${all.length}|ιστορικό=${aud.length}|bytes=${z.length}`);", "console.log(`ΔΗΜΟΣΙΕΥΣΗ|πελάτες=${all.length}|προσφορές=${offs.length}|ιστορικό=${aud.length}|bytes=${z.length}`);")
sub("metadata: { v: VERSION, z, n: all.length, a: aud.length } }];", "metadata: { v: VERSION, z, n: all.length, o: offs.length, a: aud.length } }];")
sub("""metadata: { cmd_id: String(m.cmd_id || ""), ok: !!res.ok, msg: res.msg, id: res.id || null } };""",
    """metadata: { cmd_id: String(m.cmd_id || ""), ok: !!res.ok, msg: res.msg, id: res.id || null, kind: res.kind || "customer" } };""")

open(P, 'wb').write(s.encode('utf-8'))
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
print('node --check', r.returncode, r.stderr[:300])
