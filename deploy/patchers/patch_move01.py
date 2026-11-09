# T-MOVE-01 (10/11/2026, Michalis: «όταν ένας αισθητήρας βγαίνει από έναν αγρό και δηλώνεται σε έναν άλλον ... σβήνονται οι
# αναφορές στους παλιούς» · απόφαση 9/11 «δηλωμένα κοινόχρηστα»).
#  addSensorsToField: μετά την προσθήκη στον νέο αγρό, το όργανο φεύγει από ΚΑΘΕ άλλο αγρό (ετικέτα devices + όλα τα widget του
#  ταμπλό εκτός των καρτελών βανών) και βγαίνει από την αποθήκη. ΕΞΑΙΡΕΣΕΙΣ: όργανο με ετικέτα shared_instrument=yes (δηλωμένο
#  κοινόχρηστο) και ελεγκτές βανών uc5xx (Κώστας). Λειτουργία shared_audit: λίστα οργάνων σε ≥2 αγρούς· με apply σημαίνει τα
#  αδήλωτα (όχι ελεγκτές) ως κοινόχρηστα — έτσι τίποτα από όσα υπάρχουν σήμερα δεν αλλάζει.
#  removeSensorFromField: καθαρίζει ΟΛΑ τα widget του ταμπλό (όχι μόνο το AgroGenius), εκτός των καρτελών βανών.
# Τα αρχεία είναι CRLF· δουλεύουμε σε LF και γράφουμε CRLF.
import sys, subprocess
ADD, REM = sys.argv[1], sys.argv[2]


def load(p):
    b = open(p, 'rb').read().decode('utf-8')
    assert '\r\n' in b
    return b.replace('\r\n', '\n')


def save(p, s):
    assert '\r' not in s
    open(p, 'wb').write(s.replace('\n', '\r\n').encode('utf-8'))
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    print('node --check', p, r.returncode, r.stderr[:300])
    assert r.returncode == 0


def sub(src, old, new, cnt=1):
    n = src.count(old)
    assert n == cnt, (n, old[:90])
    return src.replace(old, new)


# Κοινός κώδικας (ίδιος στα δύο αρχεία, όπως τα υπόλοιπα «mirrors»).
COMMON = r'''
/* ---------- T-MOVE-01 (10/11/2026): ένα όργανο σε ΕΝΑΝ αγρό ----------
   Κύριο σημείο της ανάθεσης = η ετικέτα devices του αγρού. Όταν ένα όργανο δηλώνεται σε νέο αγρό, φεύγει από κάθε άλλον:
   ετικέτα devices, πηγές δεδομένων και device_map ΟΛΩΝ των widget του ταμπλό του. Η κατάσταση του πυρήνα για το όργανο στον
   παλιό αγρό σβήνει μόνη της (T-DEVSTATE-PRUNE-01). Η θέση του οργάνου είναι η θέση του αγρού του, άρα αλλάζει μαζί.
   ΕΞΑΙΡΕΣΕΙΣ: (α) δηλωμένο κοινόχρηστο όργανο — ετικέτα shared_instrument=yes στη συσκευή (π.χ. ο σταθμός του ξενοδοχείου
   σε όλες τις ζώνες)· (β) ελεγκτές βανών uc5xx και widget των καρτελών βανών (valvesControl/valvesRules) — ανήκουν στον Κώστα,
   δεν αγγίζονται, μόνο αναφέρονται. */
const SHARED_TAG = "shared_instrument";
const VALVE_WIDGET_RE = /valvesControl|valvesRules/;
const tagVal = (tags, key) => ((tags || []).find((t) => t && t.key === key) || {}).value;
const devTypeOf = (dev) => String(((dev?.tags || []).find((t) => String(t?.key).toLowerCase() === "type") || {}).value || "").toLowerCase();
const isController = (dev) => /^uc5\d\d/.test(devTypeOf(dev));
const isSharedInstrument = (dev) => (dev?.tags || []).some((t) => t && t.key === SHARED_TAG && /^(yes|ναι|true|1)$/i.test(String(t.value || "").trim()));

// Ο χάρτης name → id της ετικέτας devices· null όταν η ετικέτα υπάρχει αλλά δεν διαβάζεται (τότε ΔΕΝ ξαναγράφεται).
function devicesMapOf(tags) {
  const raw = tagVal(tags, "devices");
  if (!raw) return {};
  try { const m = JSON.parse(raw); return m && typeof m === "object" && !Array.isArray(m) ? m : null; } catch { return null; }
}

// Όλοι οι αγροί (συσκευές isField=yes), σε σελίδες.
async function listFieldDevices() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const r = await account.devices.list({ page, amount: 200, fields: ["id", "name", "tags"], filter: { tags: [{ key: "isField", value: "yes" }] } });
    const arr = Array.isArray(r) ? r : [];
    out.push(...arr);
    if (arr.length < 200) break;
  }
  return out;
}

// Βγάζει τα ids από ΟΛΑ τα widget ενός ταμπλό, εκτός από τα widget βανών. Επιστρέφει { touched, valve }.
async function stripDevicesFromDashboard(dashboardId, ids) {
  const res = { touched: 0, valve: 0 };
  if (!dashboardId || !ids.size) return res;
  let info;
  try { info = await account.dashboards.info(dashboardId); } catch (e) { console.log(`T-MOVE-01: ταμπλό ${dashboardId} δεν διαβάστηκε: ${e && e.message}`); return res; }
  for (const slot of (info?.arrangement || [])) {
    const wid = slot?.widget_id;
    if (!wid) continue;
    let widget;
    try { widget = await account.dashboards.widgets.info(dashboardId, wid); } catch { continue; }
    const refs = JSON.stringify(widget || {});
    if (![...ids].some((id) => refs.includes(id))) continue;
    if (VALVE_WIDGET_RE.test(String(widget?.display?.url || ""))) { res.valve += 1; console.log(`T-MOVE-01: widget βανών ${wid} ΔΕΝ αγγίχτηκε (Κώστας)`); continue; }
    let changed = removeSensorsFromWidget(widget, ids);
    if (widget.display && (widget.display.parameters || []).some((p) => p?.key === "device_map")) {
      const map = readDeviceMapParam(widget.display);
      let pruned = false;
      for (const rid of ids) if (rid in map) { delete map[rid]; pruned = true; }
      if (pruned) { upsertDisplayParameter(widget.display, "device_map", JSON.stringify(map)); changed = true; }
    }
    if (!changed) continue;
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      res.touched += 1;
      console.log(`T-MOVE-01: widget ${wid} καθαρίστηκε`);
    } catch (e) {
      console.log(`T-MOVE-01: αποτυχία στο widget ${wid}: ${e && e.message}`);
    }
  }
  return res;
}
'''

REMOVE_FN = r'''
// Strip every data[]/display.variables entry belonging to a removed origin id. Returns true if changed.
function removeSensorsFromWidget(widget, removedIds) {
  let changed = false;
  if (Array.isArray(widget.data)) {
    const before = widget.data.length;
    widget.data = widget.data.filter((d) => !removedIds.has(String(d.origin)));
    if (widget.data.length !== before) changed = true;
  }
  if (widget.display && Array.isArray(widget.display.variables)) {
    const dv = widget.display.variables;
    const before = dv.length;
    widget.display.variables = dv.filter((v) => !removedIds.has(String(v?.origin?.id || v?.origin)));
    if (widget.display.variables.length !== before) changed = true;
  }
  return changed;
}
'''

# ───────────────────────── addSensorsToField ─────────────────────────
a = load(ADD)
a = sub(a, """ * Subscription cost is NOT auto-recomputed here""",
""" * T-MOVE-01 (10/11/2026): an instrument belongs to ONE field. After adding, each new device is removed from every OTHER
 * field (devices tag + all dashboard widgets except the valve tabs) and its storage tags are dropped. Exceptions: devices
 * tagged shared_instrument=yes (declared shared) and uc5xx valve controllers (Κώστας). Scope {shared_audit:true[, apply:true]}
 * lists instruments in ≥2 fields; with apply it tags the undeclared ones (not controllers) as shared.
 *
 * Subscription cost is NOT auto-recomputed here""")
a = sub(a, "/* ---------- main ---------- */", REMOVE_FN.strip('\n') + "\n" + COMMON + r'''
// Η ετικέτα αποθήκης φεύγει από όργανο που μπαίνει σε αγρό (όπως στο createField). Πάντα με φρέσκια ανάγνωση ετικετών.
async function dropStorageTags(dev) {
  try {
    const info = await account.devices.info(dev.id);
    const tags = info?.tags || [];
    const kept = tags.filter((t) => !(t.key === "storage" || String(t.key).startsWith("storage")));
    if (kept.length === tags.length) return false;
    await account.devices.edit(dev.id, { tags: kept });
    console.log(`T-MOVE-01: ${dev.name || dev.id} βγήκε από την αποθήκη`);
    return true;
  } catch (e) { console.log(`T-MOVE-01: ετικέτα αποθήκης ${dev.id}: ${e && e.message}`); return false; }
}

// Βγάζει τα όργανα από κάθε άλλο αγρό. Επιστρέφει αναφορά για το μήνυμα της φόρμας.
async function moveOutOfOtherFields(targetFieldId, devices) {
  const rep = { moved: [], shared: [], controllers: [], valve: 0, refs: [], skipped: [] };
  if (!devices.length) return rep;
  const fields = await listFieldDevices();
  const byId = new Map(devices.map((d) => [String(d.id), d]));
  for (const f of fields) {
    if (!f || String(f.id) === String(targetFieldId)) continue;
    const m0 = devicesMapOf(f.tags);
    const here = m0 ? [...new Set(Object.values(m0).map(String))].filter((id) => byId.has(id)) : [];
    if (!here.length) { if (m0 === null) rep.skipped.push(f.name); continue; }
    const move = new Set();
    for (const id of here) {
      const d = byId.get(id);
      if (isController(d)) rep.controllers.push(`${d.name || id} → και στον «${f.name}»`);
      else if (isSharedInstrument(d)) rep.shared.push(`${d.name || id} → και στον «${f.name}»`);
      else move.add(id);
    }
    if (!move.size) continue;
    // Φρέσκια ανάγνωση του παλιού αγρού πριν γραφτεί (καμία απώλεια ετικέτας από παλιά λίστα).
    const fi = await account.devices.info(f.id);
    const map = devicesMapOf(fi?.tags);
    if (map === null) { rep.skipped.push(f.name); continue; }
    for (const [k, v] of Object.entries(map)) if (move.has(String(v))) delete map[k];
    const tags = (fi.tags || []).filter((t) => t.key !== "devices");
    tags.push({ key: "devices", value: JSON.stringify(map) });
    await account.devices.edit(f.id, { tags });
    const st = await stripDevicesFromDashboard(tagVal(fi.tags, "fieldId"), move);
    rep.valve += st.valve;
    for (const id of move) {
      const d = byId.get(id);
      rep.moved.push(`${d.name || id} από «${f.name}»`);
      const cfg = String(tagVal(fi.tags, "configuration") || "") + String(tagVal(fi.tags, "irrigation_zones") || "");
      if (cfg.includes(id)) rep.refs.push(`«${f.name}»`);
    }
    console.log(`T-MOVE-01: «${f.name}» −${move.size} όργανα · widget ${st.touched} · βανών ${st.valve}`);
  }
  return rep;
}

// Λειτουργία ελέγχου: όργανα δηλωμένα σε ≥2 αγρούς. apply=true → τα αδήλωτα (όχι ελεγκτές) γίνονται shared_instrument=yes.
async function sharedAudit(apply) {
  const fields = await listFieldDevices();
  const mem = {};
  for (const f of fields) {
    const m = devicesMapOf(f.tags) || {};
    for (const id of new Set(Object.values(m).map(String))) (mem[id] = mem[id] || []).push(f.name);
  }
  const multi = Object.entries(mem).filter(([, fs]) => fs.length > 1);
  let ctrl = 0, decl = 0, undecl = 0, tagged = 0;
  for (const [id, fs] of multi) {
    let info;
    try { info = await account.devices.info(id); } catch { console.log(`ΚΟΙΝΟ|${id}|δεν βρέθηκε|${fs.length} αγροί`); continue; }
    const kind = isController(info) ? "ελεγκτής (Κώστας)" : isSharedInstrument(info) ? "δηλωμένο" : "ΧΩΡΙΣ ΔΗΛΩΣΗ";
    if (kind.startsWith("ελεγκ")) ctrl++; else if (kind === "δηλωμένο") decl++; else undecl++;
    console.log(`ΚΟΙΝΟ|${info.name}|${devTypeOf(info) || "?"}|${kind}|${fs.length} αγροί: ${fs.join(" ; ")}`);
    if (apply && kind === "ΧΩΡΙΣ ΔΗΛΩΣΗ") {
      const tags = (info.tags || []).filter((t) => t.key !== SHARED_TAG);
      tags.push({ key: SHARED_TAG, value: "yes" });
      await account.devices.edit(id, { tags });
      tagged++;
    }
  }
  console.log(`ΚΟΙΝΑ ΟΡΓΑΝΑ|αγροί=${fields.length}|σε ≥2 αγρούς=${multi.length}|ελεγκτές=${ctrl}|δηλωμένα=${decl}|χωρίς δήλωση=${undecl}|σημάνθηκαν τώρα=${tagged}${apply ? "" : " (ΔΟΚΙΜΗ)"}`);
}

/* ---------- main ---------- */''')

a = sub(a, """  console.log(`UC511 generation fallback: ${DEFAULT_UC511_GEN} (per-controller auto-detect from hw_version)`);
""", """  console.log(`UC511 generation fallback: ${DEFAULT_UC511_GEN} (per-controller auto-detect from hw_version)`);

  // T-MOVE-01: λειτουργία ελέγχου κοινών οργάνων (μόνο με run_analysis· η φόρμα στέλνει πάντα πίνακα με variable).
  const _sc0 = Array.isArray(scope) ? scope[0] : scope;
  if (_sc0 && _sc0.shared_audit) return sharedAudit(_sc0.apply === true || String(_sc0.apply) === "true");
""")

a = sub(a, """  console.log(`Done. Added ${foundDevices.length} device(s) to ${fieldInfo.name}; updated ${widgetsTouched} widget(s).`);
""", """  console.log(`Done. Added ${foundDevices.length} device(s) to ${fieldInfo.name}; updated ${widgetsTouched} widget(s).`);

  // T-MOVE-01: έξοδος από την αποθήκη + αφαίρεση από τους παλιούς αγρούς (ΜΕΤΑ την επιτυχή προσθήκη).
  const _instr = foundDevices.filter((d) => !isController(d));
  for (const d of _instr) await dropStorageTags(d);
  let mv = { moved: [], shared: [], controllers: [], valve: 0, refs: [], skipped: [] };
  try { mv = await moveOutOfOtherFields(fieldDeviceId, foundDevices); } catch (e) { mv.skipped.push("σφάλμα: " + (e && e.message)); console.log(`T-MOVE-01: σφάλμα ${e && e.message}`); }
  const extra = [];
  if (mv.moved.length) extra.push(`Μεταφέρθηκαν: ${mv.moved.join(", ")} (σβήστηκαν από τους παλιούς αγρούς και τα ταμπλό τους).`);
  if (mv.shared.length) extra.push(`Κοινόχρηστα, έμειναν και αλλού: ${mv.shared.join(", ")}.`);
  if (mv.controllers.length) extra.push(`Ελεγκτές βανών, ΔΕΝ αφαιρέθηκαν από τον παλιό αγρό: ${mv.controllers.join(", ")}.`);
  if (mv.valve) extra.push(`${mv.valve} widget βανών στους παλιούς αγρούς δεν αγγίχτηκαν.`);
  if (mv.refs.length) extra.push(`Ελέγξτε τη φόρμα παραμετροποίησης (αισθητήρας απόφασης ή ζώνες) στους: ${[...new Set(mv.refs)].join(", ")}.`);
  if (mv.skipped.length) extra.push(`Δεν ελέγχθηκαν: ${mv.skipped.join(", ")}.`);
  const warnMove = mv.controllers.length || mv.valve || mv.refs.length || mv.skipped.length;
  const tail = extra.length ? " " + extra.join(" ") : "";
""")

a = sub(a, """      `Προστέθηκαν ${foundDevices.length} συσκευές στον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget AgroGenius για ενημέρωση.`
    );
  } else if (notFound > 0) {
    await sendValidation(
      "warning",
      `Προστέθηκαν ${foundDevices.length} συσκευές (${deviceNames}) στον αγρό «${fieldInfo.name}». ${notFound} EUI δεν αντιστοιχήθηκαν.`
    );
  } else {
    await sendValidation(
      "success",
      `Προστέθηκαν ${foundDevices.length} συσκευές (${deviceNames}) στον αγρό «${fieldInfo.name}».`
    );""", """      `Προστέθηκαν ${foundDevices.length} συσκευές στον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget AgroGenius για ενημέρωση.` + tail
    );
  } else if (notFound > 0) {
    await sendValidation(
      "warning",
      `Προστέθηκαν ${foundDevices.length} συσκευές (${deviceNames}) στον αγρό «${fieldInfo.name}». ${notFound} EUI δεν αντιστοιχήθηκαν.` + tail
    );
  } else {
    await sendValidation(
      warnMove ? "warning" : "success",
      `Προστέθηκαν ${foundDevices.length} συσκευές (${deviceNames}) στον αγρό «${fieldInfo.name}».` + tail
    );""")
save(ADD, a)

# ───────────────────────── removeSensorFromField ─────────────────────────
r = load(REM)
r = sub(r, """ * It does NOT delete the device, wipe its data, or recompute subscriptionCost.""",
""" * T-MOVE-01 (10/11/2026): step 3 now strips the devices from ALL widgets of the dashboard (not only the AgroGenius one),
 * except the valve tabs (valvesControl/valvesRules — Κώστας), which are only reported.
 *
 * It does NOT delete the device, wipe its data, or recompute subscriptionCost.""")
r = sub(r, "/* ---------- main ---------- */", COMMON.lstrip('\n') + "\n/* ---------- main ---------- */")
r = sub(r, """  // Strip from the AgroGenius custom widget(s) on the dashboard.
  const info = await account.dashboards.info(dashboardId);
  let widgetsTouched = 0;
  for (const slot of (info?.arrangement || [])) {
    const wid = slot?.widget_id;
    if (!wid) continue;
    let widget;
    try { widget = await account.dashboards.widgets.info(dashboardId, wid); } catch { continue; }
    if (!widgetReadsFieldBundle(widget)) continue; // only the AgroGenius custom widget
    let changed = removeSensorsFromWidget(widget, removedIds);
    if (widget.display) {
      // Prune the removed ids from THIS widget's existing device_map (id → name), keeping the
      // display names of the devices that remain.
      const map = readDeviceMapParam(widget.display);
      for (const rid of removedIds) delete map[rid];
      upsertDisplayParameter(widget.display, "device_map", JSON.stringify(map));
      changed = true;
    }
    if (!changed) continue;
    try {
      await account.dashboards.widgets.edit(dashboardId, wid, widget);
      widgetsTouched += 1;
      console.log(`Updated widget ${wid} (removed origins, device_map refreshed).`);
    } catch (e) {
      console.log(`Failed to edit widget ${wid}: ${e && e.message}`);
    }
  }
""", """  // T-MOVE-01: από ΟΛΑ τα widget του ταμπλό (όχι μόνο το AgroGenius), εκτός των καρτελών βανών.
  const _st = await stripDevicesFromDashboard(dashboardId, removedIds);
  const widgetsTouched = _st.touched;
  const _valveNote = _st.valve ? ` ${_st.valve} widget βανών δεν αγγίχτηκαν (Κώστας).` : "";
""")
r = sub(r, """      `Οι συσκευές αφαιρέθηκαν από τον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget AgroGenius για ενημέρωση.`""",
           """      `Οι συσκευές αφαιρέθηκαν από τον αγρό «${fieldInfo.name}», αλλά δεν βρέθηκε widget με αυτές για ενημέρωση.` + _valveNote""")
r = sub(r, """      `Αφαιρέθηκαν ${foundDevices.length} συσκευές (${label}) από τον αγρό «${fieldInfo.name}». Οι συσκευές και τα δεδομένα τους δεν διαγράφηκαν.`""",
           """      `Αφαιρέθηκαν ${foundDevices.length} συσκευές (${label}) από τον αγρό «${fieldInfo.name}». Οι συσκευές και τα δεδομένα τους δεν διαγράφηκαν.` + _valveNote""")
save(REM, r)
print('OK')
