# -*- coding: utf-8 -*-
# T-GWMAP-05 (7/11/2026, εντολή Μιχάλη): «να φαίνονται όλες οι πύλες που ακούν κάθε όργανο».
# gatewayLiveness: μνήμη 7 ημερών όργανο → πύλες, χωρίς νέες ωριαίες αναγνώσεις. sag-map.html: δείχνει όλες.
import sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = sys.argv[1]


def apply(path, subs):
    s = open(path, encoding='utf-8').read().replace('\r\n', '\n')
    for a, b in subs:
        assert s.count(a) == 1, 'ΛΕΙΠΕΙ: ' + a[:70]
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8', newline='\n').write(s)


apply(ROOT + '/analysis/gatewayLiveness.js', [
    ("""// ═══ T-GWMAP-04 (ΤΕΛΟΣ) ═""", """/* T-GWMAP-05 (7/11/2026) · ΟΛΕΣ ΟΙ ΠΥΛΕΣ ΑΝΑ ΟΡΓΑΝΟ. Το lrrid κάθε πακέτου λέει ΜΙΑ πύλη, την καλύτερη εκείνης της στιγμής. Όργανο
   που το ακούνε δύο πύλες εναλλάσσεται, και ο χάρτης έδειχνε μόνο την τελευταία. Κρατάμε μνήμη 7 ημερών όργανο → πύλη → ώρα τελευταίου
   πακέτου, από τις αναγνώσεις που γίνονται ήδη: 0 νέες ωριαίες. Μόνο η πρώτη εκτέλεση διαβάζει βαθιά, μία φορά, για να γεμίσει. */
const HEARD_TTL_H = 168;            // ώρες: πύλη που δεν παρέδωσε τόσο καιρό φεύγει από το όργανο
const HEARD_MAX_CHARS = 9000;       // όριο μεγέθους της εγγραφής μνήμης
const HEARD_SEED_QTY = 150;         // εγγραφές lrrid ανά όργανο, μόνο στην πρώτη εκτέλεση
const heardKey = (id) => String(id).slice(-10);
const hourOf = (t) => Math.floor(new Date(t).getTime() / 36e5);
function noteHeard(heard, id, code, time) {
  const h = hourOf(time);
  if (code === undefined || code === null || code === "" || !Number.isFinite(h)) return;
  const k = heardKey(id), c = String(code), e = heard[k] || (heard[k] = {});
  if (!(e[c] >= h)) e[c] = h;
}
function pruneHeard(heard, now) {
  const cut = hourOf(now) - HEARD_TTL_H;
  for (const k of Object.keys(heard)) {
    for (const c of Object.keys(heard[k])) if (heard[k][c] < cut) delete heard[k][c];
    if (!Object.keys(heard[k]).length) delete heard[k];
  }
  // Αν ξεπεράσει το όριο φεύγουν πρώτα οι παλιότερες συνδέσεις, ποτέ η πιο πρόσφατη ενός οργάνου.
  while (JSON.stringify(heard).length > HEARD_MAX_CHARS) {
    let bk = null, bc = null, bh = Infinity;
    for (const k of Object.keys(heard)) {
      const cs = Object.keys(heard[k]);
      if (cs.length < 2) continue;
      const newest = Math.max(...cs.map((c) => heard[k][c]));
      for (const c of cs) if (heard[k][c] < bh && heard[k][c] < newest) { bh = heard[k][c]; bk = k; bc = c; }
    }
    if (bk === null) break;
    delete heard[bk][bc];
  }
  return heard;
}
/* Οι ΑΛΛΕΣ πύλες ενός οργάνου: [[κωδικός, ώρες από το τελευταίο πακέτο]], νεότερη πρώτα, χωρίς την τρέχουσα. */
function heardList(heard, id, latest, now) {
  const e = (heard && heard[heardKey(id)]) || {}, nowH = hourOf(now);
  return Object.keys(e).filter((c) => c !== String(latest)).sort((a, b) => e[b] - e[a]).map((c) => [c, Math.max(0, nowH - e[c])]);
}
// ═══ T-GWMAP-04 (ΤΕΛΟΣ) ═"""),
    ("""  while (md.dv.length && !fits()) { md.dv.pop(); md.dc = (md.dc || 0) + 1; }
""", """  for (const d of md.dv) delete d.gs;   // πρώτα φεύγουν οι παλιότερες πύλες, μετά τα ίδια τα όργανα
  if (fits()) return md;
  while (md.dv.length && !fits()) { md.dv.pop(); md.dc = (md.dc || 0) + 1; }
"""),
    ("""function buildMapFieldRows({ fields, devs, typeOf, gwOf, now }) {""", """function buildMapFieldRows({ fields, devs, typeOf, gwOf, heard, now }) {"""),
    ("""      return { i: x.id.slice(-6), n: String(d.name || x.name || ""), t: (typeOf && typeOf.get(x.id)) || null,
        h: Number.isFinite(h) ? Math.round(Math.max(0, h) * 10) / 10 : null, g: (gwOf && gwOf.get(x.id)) || null };
""", """      let g = (gwOf && gwOf.get(x.id)) || null;
      const gs = heardList(heard, x.id, g, now);
      if (!g && gs.length) g = gs.shift()[0];   // δεν ρωτήθηκε σε αυτή την εκτέλεση: η πιο πρόσφατη γνωστή πύλη
      const row = { i: x.id.slice(-6), n: String(d.name || x.name || ""), t: (typeOf && typeOf.get(x.id)) || null,
        h: Number.isFinite(h) ? Math.round(Math.max(0, h) * 10) / 10 : null, g };
      if (gs.length) row.gs = gs;
      return row;
"""),
    ("""  const st = await loadState(); reads++;
""", """  const st = await loadState(); reads++;
  // T-GWMAP-05: null = η ανάγνωση απέτυχε, άρα ΔΕΝ ξαναγράφουμε τη μνήμη (κενή μνήμη δεν είναι το ίδιο με άγνωστη).
  let heard = null;
  try {
    const hr = await api(`/device/${OVERSEER}/data?variables[]=gateway_heard_state&qty=1`); reads++;
    const hm = hr && hr[0] && hr[0].metadata && hr[0].metadata.h;
    heard = hm && typeof hm === "object" ? hm : {};
  } catch (e) { console.log("ΠΥΛΕΣ ΟΡΓΑΝΩΝ|σφάλμα ανάγνωσης μνήμης"); }
  const heardSeed = !!heard && !Object.keys(heard).length;
"""),
    ("""      stillKnown.push(id);
      const key = String(idRow.value);
""", """      stillKnown.push(id);
      if (heard) for (const x of rows || []) if (x && x.variable === "lrrid") noteHeard(heard, id, x.value, x.time);
      const key = String(idRow.value);
"""),
    ("""  // 3β · T-GWID-02: θέση από τη μνήμη""", """  // 3α · T-GWMAP-05: μία φορά, όταν η μνήμη είναι κενή, διαβάζουμε το ιστορικό lrrid ώστε ο χάρτης να δείξει αμέσως όλες τις πύλες.
  if (heardSeed && stillKnown.length) {
    let si = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (si < stillKnown.length) {
        const id = stillKnown[si++];
        try {
          const hist = await api(`/device/${id}/data?variables[]=lrrid&qty=${HEARD_SEED_QTY}`); reads++;
          for (const x of hist || []) noteHeard(heard, id, x.value, x.time);
        } catch (e) { /* το όργανο θα γεμίσει σταδιακά */ }
      }
    }));
    console.log(`ΠΥΛΕΣ ΟΡΓΑΝΩΝ|πρώτη σπορά|${stillKnown.length} όργανα`);
  }

  // 3β · T-GWID-02: θέση από τη μνήμη"""),
    ("""    const mapRows = fieldRecs.length ? buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), now }) : [];
""", """    if (heard) pruneHeard(heard, now);
    const mapRows = fieldRecs.length ? buildMapFieldRows({ fields: fieldRecs, devs, typeOf, gwOf: mapGatewayOf(gw), heard, now }) : [];
"""),
    ("""  } catch (e) { console.log("ΧΑΡΤΗΣ|σφάλμα " + ((e && e.name) || "άγνωστο")); }
""", """  } catch (e) { console.log("ΧΑΡΤΗΣ|σφάλμα " + ((e && e.name) || "άγνωστο")); }
  // Χωριστή εγγραφή: αν απορριφθεί η μνήμη, ο χάρτης έχει ήδη γραφτεί.
  try {
    if (heard) {
      await api(`/device/${OVERSEER}/data`, { method: "POST", body: JSON.stringify([{ variable: "gateway_heard_state",
        value: Object.keys(heard).length, metadata: { h: heard } }]) });
      const multi = Object.keys(heard).filter((k) => Object.keys(heard[k]).length > 1).length;
      console.log(`ΠΥΛΕΣ ΟΡΓΑΝΩΝ|όργανα=${Object.keys(heard).length}|με πάνω από μία πύλη=${multi}|χαρακτήρες=${JSON.stringify(heard).length}`);
    }
  } catch (e) { console.log("ΠΥΛΕΣ ΟΡΓΑΝΩΝ|σφάλμα εγγραφής " + ((e && e.name) || "άγνωστο")); }
"""),
])

apply(ROOT + '/custom_html_files/sag-map.html', [
    ("""      g: d.g || null, q: !!o.q, l: !!o.l, b: o.b || null };
  });
  Object.keys(fd).forEach(function (k) {""", """      g: d.g || null, gs: (Array.isArray(d.gs) ? d.gs : []).filter(function (x) { return Array.isArray(x) && x[0]; }),
      q: !!o.q, l: !!o.l, b: o.b || null };
  });
  Object.keys(fd).forEach(function (k) {"""),
    ("""      var g = d.g ? byCode[d.g] : null;
      if (!g) return;
      (g.heard[f.key] = g.heard[f.key] || { f: f, devs: [], k: 0 }).devs.push(d);
      g.heard[f.key].k = g.heard[f.key].devs.length;
      f.gws[g.key] = g;
    });
""", """      /* T-GWMAP-05: ΟΛΕΣ οι πύλες που παρέδωσαν πακέτο του οργάνου, όχι μόνο η τελευταία. */
      [d.g].concat((d.gs || []).map(function (x) { return x[0]; })).forEach(function (code) {
        var g = code ? byCode[code] : null;
        if (!g) return;
        (g.heard[f.key] = g.heard[f.key] || { f: f, devs: [], k: 0 }).devs.push(d);
        g.heard[f.key].k = g.heard[f.key].devs.length;
        f.gws[g.key] = g;
      });
    });
"""),
    ("""      var g = null;
      Object.keys(f.gws).forEach(function (k) { if (f.gws[k].code === d.g) g = f.gws[k]; });
      var gtxt = g ? (/^Πύλη /.test(g.name) ? '' : 'πύλη ') + '<button type="button" class="link" data-sel="gw" data-key="' + esc(g.key) + '">' + esc(g.name) + '</button>'
        : (d.g ? 'πύλη ' + esc(d.g) : 'άγνωστη πύλη');
""", """      var gOf = function (code) {
        var g = null;
        Object.keys(f.gws).forEach(function (k) { if (f.gws[k].code === code) g = f.gws[k]; });
        return g ? (/^Πύλη /.test(g.name) ? '' : 'πύλη ') + '<button type="button" class="link" data-sel="gw" data-key="' + esc(g.key) + '">' + esc(g.name) + '</button>' : 'πύλη ' + esc(code);
      };
      var gtxt = d.g ? gOf(d.g) : 'άγνωστη πύλη';
      if (d.gs && d.gs.length) gtxt += ' · επίσης: ' + d.gs.map(function (x) { return gOf(x[0]) + ' (' + esc(ageWords(x[1])) + ')'; }).join(', ');
"""),
    ("""  if (f.dc) h += '<div class="note">' + plural(f.dc, 'όργανο', 'όργανα') + ' δεν χώρεσαν στην εγγραφή (τα πιο υγιή).</div>';
""", """  if (f.dc) h += '<div class="note">' + plural(f.dc, 'όργανο', 'όργανα') + ' δεν χώρεσαν στην εγγραφή (τα πιο υγιή).</div>';
  if (f.devs.some(function (d) { return d.g; })) h += '<div class="note">Φαίνονται οι πύλες που παρέδωσαν πακέτο τις τελευταίες 7 ημέρες. Μια πύλη που ακούει το όργανο αλλά δεν είναι ποτέ η καλύτερη δεν καταγράφεται.</div>';
"""),
])
print('ok')
