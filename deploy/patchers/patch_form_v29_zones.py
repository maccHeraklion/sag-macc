# -*- coding: utf-8 -*-
"""T-ZONES-01 · φόρμα v29 (3/11/2026, Michalis: ζώνες άρδευσης — φάση 1, χωρίς βάνες).
  Φ1 νέα ενότητα «Ζώνες άρδευσης (προαιρετικό)» κάτω από τις καλλιέργειες: κάθε ζώνη = όνομα + αισθητήρες εδάφους του
     αγρού (από τη λίστα soil_sensors που γράφει ο πυρήνας v50.170 — τώρα με ΟΛΕΣ τις σόνδες) + καλλιέργειες με τα m²
     τους μέσα στη ζώνη. Μια ζώνη μπορεί να έχει πολλές καλλιέργειες· μια καλλιέργεια πολλές ζώνες.
  Φ2 αποθήκευση irrigation_zones = [{n, s:[id|id:2], c:[[cropId, m²]]}] (ζώνες χωρίς όνομα ή καλλιέργεια δεν
     αποθηκεύονται)· φόρτωση· καθαρισμός σε αλλαγή αγρού· ανανέωση ΜΟΝΟ όταν αλλάζουν σόνδες/καλλιέργειες (όχι ενώ γράφει).
  Φ3 προειδοποιήσεις (όχι φραγμός): ζώνη χωρίς καλλιέργεια· καλλιέργεια σε >1 ζώνες χωρίς m².
  Φ4 αισθητήρας απόφασης: μόνο σόνδες στο ίδιο βάθος (c:1) όταν η λίστα το δηλώνει· δεκτό και το «:2» (δύο σημεία).
Ονόματα χρηστών/συσκευών μόνο ως textContent/value. count==1, LF, node --check σε κάθε inline script."""
import io, sys, subprocess, hashlib, os, re, tempfile
sys.stdout.reconfigure(encoding="utf-8")
P = "custom_html_files/configuration.html"
raw = io.open(P, "rb").read(); assert raw[:3] != b"\xef\xbb\xbf"
s = raw.decode("utf-8"); crlf = "\r\n" in s; s = s.replace("\r\n", "\n")
print("ΠΡΙΝ", hashlib.sha256(raw).hexdigest())
assert "T-DEPTH1-03" in s and "T-ZONES-01" not in s

ZJS = r"""/* v29 · T-ZONES-01: ζώνες άρδευσης (φάση 1, χωρίς βάνες). Κατάσταση στη μνήμη: state.zones = [{n, s:[id], c:{cropId: m²}}].
   Ονόματα χρηστών/συσκευών ΜΟΝΟ ως textContent/value. */
function _sagZonePoints(){
  try{
    const row = state.lastDataMap && state.lastDataMap.soil_sensors;
    const l = (row && row.metadata && Array.isArray(row.metadata.list)) ? row.metadata.list : [];
    return l.filter(function(x){ return x && typeof x.i === 'string' && /^[0-9a-f]{24}(:2)?$/.test(x.i) && x.n != null && String(x.n) !== ''; });
  }catch(e){ return []; }
}
function _sagZoneCrops(){
  try{
    return readCropsFromUI().map(function(c, i){
      const gen = c.cultivation_type_general, t = c.cultivation_variety || c.cultivation_type;
      const nm = (CULTIVATION_TYPES[gen] || {})[t] || (CULTIVATION_TYPES[gen] || {})[c.cultivation_type] || t || '';
      return { id: c.id, ok: !!c.cultivation_type, label: '#' + (i + 1) + ' ' + nm };
    }).filter(function(c){ return c.ok; });
  }catch(e){ return []; }
}
function _sagZonesFromConf(list){
  return (Array.isArray(list) ? list : []).slice(0, 20).map(function(z){
    const c = {};
    (Array.isArray(z && z.c) ? z.c : []).forEach(function(x){ if (Array.isArray(x) && x[0] != null) c[String(x[0])] = (x[1] != null ? String(x[1]) : ''); });
    return { n: String((z && z.n) || ''), s: (Array.isArray(z && z.s) ? z.s : []).map(String), c: c };
  });
}
function readZonesFromUI(){
  const ids = {}; _sagZoneCrops().forEach(function(c){ ids[c.id] = 1; });
  return (Array.isArray(state.zones) ? state.zones : []).map(function(z){
    return { n: String(z.n || '').trim().slice(0, 40), s: (z.s || []).slice(0, 10),
      c: Object.keys(z.c || {}).filter(function(id){ return ids[id]; }).map(function(id){
        const a = numOrNull(z.c[id]); return (a !== null && a > 0) ? [id, a] : [id]; }) };
  }).filter(function(z){ return z.n && z.c.length; });
}
function _sagZonesKey(){ return JSON.stringify([_sagZonePoints().map(function(p){ return p.i + p.n; }), _sagZoneCrops().map(function(c){ return c.id + c.label; })]); }
function _sagZonesMaybeRefresh(){ try{ const k = _sagZonesKey(); if (k !== state._zonesKey) _sagZonesRender(); }catch(e){} }
function _sagZoneAdd(){
  state.zones = Array.isArray(state.zones) ? state.zones : [];
  if (state.zones.length >= 20) return;
  state.zones.push({ n: '', s: [], c: {} }); state.dirty = true; _sagZonesRender();
}
function _sagZonesRender(){
  const wrap = $('zonesList'); if (!wrap) return;
  try{
    state.zones = Array.isArray(state.zones) ? state.zones : [];
    const pts = _sagZonePoints(), crops = _sagZoneCrops();
    state._zonesKey = _sagZonesKey();
    wrap.innerHTML = '';
    const el = function(tag, txt, css){ const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (css) e.style.cssText = css; return e; };
    state.zones.forEach(function(z, zi){
      const box = el('div', null, 'border:1px solid #dbe8f7; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:6px');
      const nm = document.createElement('input'); nm.type = 'text'; nm.maxLength = 40; nm.placeholder = 'Όνομα ζώνης (π.χ. Γκαζόν βόρειο)';
      nm.value = z.n || ''; nm.oninput = function(){ z.n = nm.value; state.dirty = true; };
      box.appendChild(nm);
      box.appendChild(el('div', 'Αισθητήρες εδάφους της ζώνης', 'font-weight:600; font-size:.9rem; margin-top:4px'));
      if (!pts.length) box.appendChild(el('div', 'Η λίστα των αισθητήρων του αγρού εμφανίζεται μετά τον επόμενο ωριαίο υπολογισμό. Χωρίς αισθητήρα η ζώνη παίρνει τον μέσο όρο του αγρού.', 'font-size:.85rem; color:#64748b'));
      pts.forEach(function(p){
        const lb = el('label', null, 'display:flex; gap:6px; align-items:center; font-size:.9rem');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = z.s.indexOf(p.i) >= 0;
        cb.onchange = function(){ const k = z.s.indexOf(p.i); if (cb.checked && k < 0) z.s.push(p.i); if (!cb.checked && k >= 0) z.s.splice(k, 1); state.dirty = true; };
        lb.appendChild(cb); lb.appendChild(el('span', String(p.n))); box.appendChild(lb);
      });
      box.appendChild(el('div', 'Καλλιέργειες της ζώνης και m² μέσα στη ζώνη', 'font-weight:600; font-size:.9rem; margin-top:4px'));
      if (!crops.length) box.appendChild(el('div', 'Προσθέστε πρώτα καλλιέργειες στον αγρό.', 'font-size:.85rem; color:#64748b'));
      crops.forEach(function(c){
        const lb = el('div', null, 'display:flex; gap:6px; align-items:center; font-size:.9rem');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = Object.prototype.hasOwnProperty.call(z.c, c.id);
        const ar = document.createElement('input'); ar.type = 'text'; ar.setAttribute('inputmode', 'decimal'); ar.placeholder = 'm²'; ar.style.width = '90px';
        ar.value = cb.checked ? String(z.c[c.id] || '') : ''; ar.disabled = !cb.checked;
        cb.onchange = function(){ if (cb.checked) z.c[c.id] = ar.value || ''; else delete z.c[c.id]; ar.disabled = !cb.checked; state.dirty = true; };
        ar.oninput = function(){ if (cb.checked) z.c[c.id] = ar.value; state.dirty = true; };
        lb.appendChild(cb); lb.appendChild(el('span', c.label, 'flex:1')); lb.appendChild(ar); box.appendChild(lb);
      });
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'btn ghost'; rm.textContent = 'Αφαίρεση ζώνης';
      rm.onclick = function(){ state.zones.splice(zi, 1); state.dirty = true; _sagZonesRender(); };
      box.appendChild(rm);
      wrap.appendChild(box);
    });
  }catch(e){ console.warn('[zones] render', e); }
}
function _sagSoilRefList(){"""

SUBS = [
  ('          <button id="btnAddCrop" class="btn ghost" type="button">+ Προσθήκη καλλιέργειας</button>\n        </div>\n      </div>\n',
   '          <button id="btnAddCrop" class="btn ghost" type="button">+ Προσθήκη καλλιέργειας</button>\n        </div>\n      </div>\n'
   '      <!-- v29 · T-ZONES-01: ζώνες άρδευσης (φάση 1, χωρίς βάνες) -->\n'
   '      <div class="field">\n'
   '        <label>Ζώνες άρδευσης (προαιρετικό)</label>\n'
   '        <div class="muted" style="font-size:.85rem; margin-bottom:6px">Ζώνη είναι ό,τι ποτίζεται μαζί (μία βάνα ή γραμμή). Μπορεί να έχει μία ή περισσότερες καλλιέργειες και δικούς της αισθητήρες εδάφους. Για κάθε ζώνη το σύστημα υπολογίζει υγρασία και λίτρα με τους αισθητήρες της και τα m² κάθε καλλιέργειας μέσα της. Χωρίς ζώνες όλα μένουν όπως είναι.</div>\n'
   '        <div id="zonesList" style="display:flex; flex-direction:column; gap:10px;"></div>\n'
   '        <div class="map-actions" style="margin-top:10px">\n'
   '          <button id="btnAddZone" class="btn ghost" type="button" onclick="_sagZoneAdd()">+ Προσθήκη ζώνης</button>\n'
   '        </div>\n'
   '      </div>\n', "Φ1 ενότητα"),
  ("function _sagSoilRefList(){", ZJS, "Φ1β κώδικας ζωνών"),
  ("    return l.filter(function(x){ return x && typeof x.i === 'string' && /^[0-9a-f]{24}$/.test(x.i) && x.n != null && String(x.n) !== ''; });\n  }catch(e){ return []; }\n}\nfunction _sagSoilRefRender(){",
   "    /* v29 · T-ZONES-01: η λίστα έχει πλέον ΟΛΕΣ τις σόνδες· αισθητήρας απόφασης = μόνο όσες μετρούν στο ίδιο βάθος (c:1). */\n"
   "    const _hasC = l.some(function(x){ return x && Object.prototype.hasOwnProperty.call(x, 'c'); });\n"
   "    return l.filter(function(x){ return x && typeof x.i === 'string' && /^[0-9a-f]{24}(:2)?$/.test(x.i) && x.n != null && String(x.n) !== '' && (!_hasC || x.c === 1); });\n  }catch(e){ return []; }\n}\nfunction _sagSoilRefRender(){",
   "Φ4 αισθητήρας απόφασης"),
  ("    crops,\n", "    crops,\n    irrigation_zones: readZonesFromUI(),   /* v29 · T-ZONES-01 */\n", "Φ2 αποθήκευση"),
  ("  _sagSoilRefRender();   /* v25 · T-SOILREF-02: η λίστα σονδών μπορεί να φτάσει σε οποιοδήποτε πακέτο */\n",
   "  _sagSoilRefRender();   /* v25 · T-SOILREF-02: η λίστα σονδών μπορεί να φτάσει σε οποιοδήποτε πακέτο */\n"
   "  _sagZonesMaybeRefresh();   /* v29 · T-ZONES-01: μόνο αν άλλαξαν σόνδες/καλλιέργειες */\n", "Φ2β ανανέωση με δεδομένα"),
  ("        state.soilRefConf = conf.soil_ref_device || ''; _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n",
   "        state.soilRefConf = conf.soil_ref_device || ''; _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n"
   "        state.zones = _sagZonesFromConf(conf.irrigation_zones); _sagZonesRender();   /* v29 · T-ZONES-01 */\n", "Φ2γ φόρτωση"),
  ("        state.soilRefConf = ''; { const _sr = $('soil_ref_device'); if (_sr) _sr.dataset.touched = ''; } _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n",
   "        state.soilRefConf = ''; { const _sr = $('soil_ref_device'); if (_sr) _sr.dataset.touched = ''; } _sagSoilRefRender();   /* v25 · T-SOILREF-02 */\n"
   "        state.zones = []; _sagZonesRender();   /* v29 · T-ZONES-01 */\n", "Φ2δ καθαρισμός"),
  ("$('btnAddCrop').onclick = ()=> {",
   "/* v29 · T-ZONES-01: οι ζώνες ακολουθούν τις καλλιέργειες (προσθήκη/αφαίρεση/αλλαγή είδους). */\n"
   "$('cropsList').addEventListener('change', function(){ setTimeout(_sagZonesMaybeRefresh, 0); });\n"
   "$('cropsList').addEventListener('click', function(){ setTimeout(_sagZonesMaybeRefresh, 0); });\n"
   "$('btnAddCrop').addEventListener('click', function(){ setTimeout(_sagZonesMaybeRefresh, 0); });\n"
   "$('btnAddCrop').onclick = ()=> {", "Φ2ε ακολουθία καλλιεργειών"),
  ("  /* v27 · T-DEPTH1-02: δύο βάθη → το βαθύ πρέπει να είναι βαθύτερα από το ρηχό",
   "  /* v29 · T-ZONES-01: ζώνες — προειδοποιήσεις, όχι φραγμός. */\n"
   "  (function(){\n"
   "    const zs = Array.isArray(state.zones) ? state.zones : [];\n"
   "    const ids = {}; _sagZoneCrops().forEach(function(c){ ids[c.id] = c.label; });\n"
   "    const cnt = {};\n"
   "    zs.forEach(function(z){\n"
   "      const n = String(z.n || '').trim(), cs = Object.keys(z.c || {}).filter(function(id){ return ids[id]; });\n"
   "      if ((n || (z.s || []).length || cs.length) && (!n || !cs.length))\n"
   "        msgs.push('Η ζώνη <b>' + (n ? n.replace(/[<>&]/g, '') : '(χωρίς όνομα)') + '</b> χρειάζεται όνομα και τουλάχιστον μία καλλιέργεια — αλλιώς δεν αποθηκεύεται.');\n"
   "      cs.forEach(function(id){ cnt[id] = (cnt[id] || 0) + 1; });\n"
   "    });\n"
   "    Object.keys(cnt).forEach(function(id){\n"
   "      if (cnt[id] < 2) return;\n"
   "      const miss = zs.some(function(z){ return z.c && Object.prototype.hasOwnProperty.call(z.c, id) && !(numOrNull(z.c[id]) > 0); });\n"
   "      if (miss) msgs.push('Η καλλιέργεια <b>' + String(ids[id]).replace(/[<>&]/g, '') + '</b> είναι σε ' + cnt[id] + ' ζώνες: δηλώστε τα m² της σε κάθε ζώνη, αλλιώς δεν βγαίνουν λίτρα ανά ζώνη.');\n"
   "    });\n"
   "  })();\n"
   "  /* v27 · T-DEPTH1-02: δύο βάθη → το βαθύ πρέπει να είναι βαθύτερα από το ρηχό", "Φ3 προειδοποιήσεις"),
]
for old, new, label in SUBS:
    c = s.count(old); assert c == 1, f"{label}: βρέθηκε {c} φορές"; s = s.replace(old, new); print("  OK", label)
for i, sc in enumerate(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)):
    fd, tmp = tempfile.mkstemp(suffix=".js"); os.write(fd, sc.encode("utf-8")); os.close(fd)
    r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True); os.unlink(tmp)
    assert r.returncode == 0, f"node --check script {i}: " + r.stderr[:300]
out = (s.replace("\n", "\r\n") if crlf else s).encode("utf-8"); io.open(P, "wb").write(out)
print("ΜΕΤΑ", hashlib.sha256(out).hexdigest(), len(out), "CRLF" if crlf else "LF")
