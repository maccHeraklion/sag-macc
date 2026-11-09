/* ══════════ T-ERP-CRM-01 (9/11/2026) · ΜΗΤΡΩΟ ΠΕΛΑΤΩΝ ΜΕ ΑΠΟΘΗΚΕΥΣΗ ══════════
   Μέσα στο TagoIO: το μενού δείχνει ΜΟΝΟ ενότητες με πραγματικά δεδομένα (απόφαση Michalis 9/11)· οι υπόλοιπες επιστρέφουν
   όταν αποκτήσουν αποθήκευση. Οι πελάτες έρχονται από το Entity «ERP · Πελάτες» (στιγμιότυπο `erp_customers`) και κάθε
   αλλαγή στέλνεται ως εντολή `erp_cmd` → analysis erpRegistry (έλεγχος, ιστορικό) → απάντηση `erp_cmd_result`. */
const IN_TAGO = !!(window.TagoIO && window.parent !== window);
const NAV_LIVE = new Set(['dash', 'customers', 'subs', 'installs', 'fleet', 'stock', 'catalog', 'equipment']);
function navView() { return IN_TAGO ? NAV.map(([g, items]) => [g, items.filter(([k]) => NAV_LIVE.has(k))]).filter(([g, it]) => it.length) : NAV; }
let REG = null, ACTOR = 'γραφείο', REG_T = '';
const PENDING = {};
const KIND_N = { client: 'Πελάτης', partner: 'Συνεργάτης', test: 'Δοκιμαστικός' };
const ACT_N = { create: 'Δημιουργία', update: 'Αλλαγή', archive: 'Αρχειοθέτηση', restore: 'Επαναφορά', note: 'Σημείωση', import: 'Εισαγωγή' };
const FLD_N = { name: 'Επωνυμία', kind: 'Είδος', status: 'Κατάσταση', vat: 'ΑΦΜ', tax_office: 'ΔΟΥ', activity: 'Δραστηριότητα', address: 'Διεύθυνση',
  city: 'Πόλη', postcode: 'ΤΚ', region: 'Περιοχή', phone: 'Τηλέφωνο', mobile: 'Κινητό', email: 'Email', website: 'Ιστοσελίδα', contacts: 'Επαφές',
  partner: 'Συνεργάτης', source: 'Προέλευση', labels: 'Ετικέτες', notes: 'Σημειώσεις', legacy_device_id: 'Συσκευή TagoIO' };
const regAll = () => (REG && REG.customers) || [];
const regById = id => regAll().find(c => String(c.id) === String(id) || (c.legacy_device_id && String(c.legacy_device_id) === String(id)));
const instOf = c => c && c.legacy_device_id ? INST.filter(x => String(x.c) === String(c.legacy_device_id)) : [];
const fdt = d => d ? new Date(d).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
function afmOk(v) { const s = String(v || '').replace(/\s+/g, ''); if (!/^\d{9}$/.test(s) || /^0{9}$/.test(s)) return false; let sum = 0; for (let i = 0; i < 8; i++) sum += +s[i] * Math.pow(2, 8 - i); return (sum % 11) % 10 === +s[8]; }
function custIssues(c) {
  const out = [];
  if (!c.vat) out.push('Λείπει ΑΦΜ'); else if (!afmOk(c.vat)) out.push('Μη έγκυρος ΑΦΜ');
  if (!c.email && !c.phone && !c.mobile && !(c.contacts || []).some(x => x.phone || x.email)) out.push('Χωρίς στοιχεία επικοινωνίας');
  if (!c.city && !c.address) out.push('Χωρίς διεύθυνση');
  return out;
}

// Το erpRegistry συμπιέζει με deflateRaw (Node zlib.deflateRawSync), όχι με zlib-deflate όπως το costing_list.
async function inflateRaw(b64) { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()); }
async function liveRegistry(src) {
  try {
    const recs = findAll(src, 'erp_customers').sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
    if (recs.length && recs[0].metadata && recs[0].metadata.z && String(recs[0].time || '') !== REG_T) {
      REG = await inflateRaw(recs[0].metadata.z); REG_T = String(recs[0].time || '');
      for (const c of regAll()) { const old = c.legacy_device_id && CUST.find(x => String(x.id) === String(c.legacy_device_id)); if (old) old.n = c.name; }
    }
    for (const r of findAll(src, 'erp_cmd_result')) {
      const m = r.metadata || {}, p = PENDING[m.cmd_id];
      if (!p) continue;
      delete PENDING[m.cmd_id]; clearTimeout(p.to);
      toast(m.msg || (m.ok ? 'Αποθηκεύτηκε' : 'Απορρίφθηκε'));
      if (m.ok) { closeD(); if (m.id && p.reopen) setTimeout(() => dCust(m.id), 400); }
      else { const e = $('#ferr'); if (e) { e.textContent = m.msg; e.style.display = 'flex'; } const bt = $('#fsave'); if (bt) { bt.disabled = false; bt.textContent = 'Αποθήκευση'; } }
    }
    if (REG && ['customers', 'dash'].includes(ST.page) && !$('#drw').classList.contains('on')) go(ST.page);
  } catch (e) { console.warn('registry', e); }
}
function sendCmd(op, payload, label) {
  if (!IN_TAGO) { toast('Η αποθήκευση γίνεται μόνο μέσα στο TagoIO'); return false; }
  const cmd_id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const meta = Object.assign({ cmd_id, op, actor: ACTOR }, payload);
  PENDING[cmd_id] = { label, reopen: true,
    to: setTimeout(() => { if (PENDING[cmd_id]) { delete PENDING[cmd_id]; toast('Δεν ήρθε επιβεβαίωση σε 40″ — η αλλαγή μπορεί να έχει γίνει· ανανεώστε τη σελίδα.'); const bt = $('#fsave'); if (bt) { bt.disabled = false; bt.textContent = 'Αποθήκευση'; } } }, 40000) };
  try { window.TagoIO.sendData([{ variable: 'erp_cmd', value: op, metadata: meta }]); } catch (e) { toast('Αποτυχία αποστολής: ' + e.message); return false; }
  return true;
}

/* ── Λίστα πελατών ── */
const _custDemo = PAGES.customers;
PAGES.customers = function () {
  if (!IN_TAGO) return _custDemo();
  if (!REG) return ph('CRM', 'Πελάτες', 'Φόρτωση μητρώου…') + '<div class="card"><div class="empty">Περιμένω το μητρώο πελατών από το TagoIO…</div></div>';
  ST.f.cf = ST.f.cf || 'active';
  const f = ST.f.cf, q = String(ST.f.cq || '').toLowerCase();
  const all = regAll();
  const L = all.filter(c => (f === 'all' || (f === 'archived' ? c.status === 'archived' : c.status !== 'archived' && (f === 'active' ? c.kind !== 'test' : f === 'issues' ? custIssues(c).length : c.kind === f))))
    .filter(c => !q || [c.code, c.name, c.vat, c.email, c.phone, c.mobile, c.city, c.region, (c.labels || []).join(' '), (c.contacts || []).map(x => x.n).join(' ')].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'el'));
  const cnt = k => all.filter(c => k === 'archived' ? c.status === 'archived' : c.status !== 'archived' && (k === 'active' ? c.kind !== 'test' : k === 'issues' ? custIssues(c).length : c.kind === k)).length;
  return ph('CRM', 'Πελάτες', all.filter(c => c.status !== 'archived').length + ' ενεργές καρτέλες · μητρώο με αποθήκευση και ιστορικό αλλαγών', `<button class="btn p" onclick="custForm()">+ Νέος πελάτης</button>`) +
    `<div class="toolbar"><input class="inp" id="cq" placeholder="Αναζήτηση: επωνυμία, ΑΦΜ, τηλέφωνο, email, πόλη, ετικέτα…" value="${esc(ST.f.cq || '')}" style="min-width:280px;flex:1;max-width:420px" oninput="ST.f.cq=this.value;clearTimeout(window.__cq);window.__cq=setTimeout(()=>{go('customers');const e=$('#cq');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},250)">
     ${seg('cf', [['active', 'Ενεργοί (' + cnt('active') + ')'], ['partner', 'Συνεργάτες (' + cnt('partner') + ')'], ['test', 'Δοκιμαστικοί (' + cnt('test') + ')'], ['issues', 'Ελλιπή στοιχεία (' + cnt('issues') + ')'], ['archived', 'Αρχείο (' + cnt('archived') + ')'], ['all', 'Όλοι']], 'customers')}</div>
     <div class="card">${tbl(['Κωδ.', 'Επωνυμία', 'ΑΦΜ', 'Επικοινωνία', 'Περιοχή', '#Εγκατ.', '#Ετήσια ανανέωση', 'Τελ. αλλαγή'], L.map(c => {
      const ii = instOf(c), iss = custIssues(c);
      return `<tr class="c" onclick="dCust('${c.id}')"><td class="mono">${esc(c.code || '')}</td><td><b>${esc(c.name || '—')}</b> ${c.kind !== 'client' ? b(KIND_N[c.kind] || c.kind, 'info') : ''}${c.status === 'archived' ? ' ' + b('Αρχείο', '') : ''}${(c.labels || []).map(l => ' ' + b(esc(l), /ΑΦΜ/.test(l) ? 'warn' : '', 1)).join('')}${iss.length ? `<div class="sub warn">${iss.join(' · ')}</div>` : ''}</td>
       <td class="mono">${esc(c.vat || '—')}</td><td>${esc(c.mobile || c.phone || '')}${c.email ? `<div class="sub">${esc(c.email)}</div>` : ''}${!c.mobile && !c.phone && !c.email ? '—' : ''}</td>
       <td>${esc(c.city || c.region || '—')}</td><td class="num">${ii.length}</td><td class="num">${ii.length ? eur0(ii.filter(x => x.step >= 7).reduce((s, x) => s + renewOf(x), 0)) : '—'}</td><td class="sub">${fdt(c.updated_at)}</td></tr>`;
    }), q ? 'Κανένας πελάτης δεν ταιριάζει στην αναζήτηση' : 'Κανένας πελάτης σε αυτή την κατηγορία')}</div>`;
};

/* ── Καρτέλα πελάτη ── */
const _dCustDemo = dCust;
dCust = function (id, tab) {
  const c = IN_TAGO ? regById(id) : null;
  if (!c) return _dCustDemo(id);
  tab = tab || 'info';
  const ii = instOf(c), iss = custIssues(c), aud = ((REG && REG.audit) || []).filter(a => a.ref_type === 'customer' && String(a.ref_id) === String(c.id));
  const tabs = [['info', 'Στοιχεία'], ['contacts', 'Επαφές (' + (c.contacts || []).length + ')'], ['inst', 'Εγκαταστάσεις (' + ii.length + ')'], ['hist', 'Ιστορικό (' + aud.length + ')']];
  const val = v => v ? esc(v) : '<span class="sub">—</span>';
  let body = `<div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap">${b(KIND_N[c.kind] || c.kind, c.kind === 'client' ? 'ok' : 'info')}${c.status === 'archived' ? b('Αρχειοθετημένος', 'bad') : b('Ενεργός', 'ok')}${(c.labels || []).map(l => b(esc(l), /ΑΦΜ/.test(l) ? 'warn' : '', 1)).join('')}<span class="sp"></span><span class="sub mono">${esc(c.code || '')} · έκδοση ${c.version || 1}</span></div>
   ${iss.length ? `<div class="alert">${iss.join(' · ')}. Συμπληρώστε τα με «Επεξεργασία».</div>` : ''}
   <div class="seg" style="margin-bottom:14px">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" onclick="dCust('${c.id}','${k}')">${n}</button>`).join('')}</div>`;
  if (tab === 'info') body += `<div class="sec">Ταυτότητα</div>${kv([['Επωνυμία', val(c.name)], ['Δραστηριότητα', val(c.activity)], ['ΑΦΜ', c.vat ? esc(c.vat) + (afmOk(c.vat) ? ' ' + b('έγκυρος', 'ok', 1) : ' ' + b('μη έγκυρος', 'bad', 1)) : val('')], ['ΔΟΥ', val(c.tax_office)]])}
    <div class="sec">Επικοινωνία</div>${kv([['Τηλέφωνο', c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : val('')], ['Κινητό', c.mobile ? `<a href="tel:${esc(c.mobile)}">${esc(c.mobile)}</a>` : val('')], ['Email', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : val('')], ['Ιστοσελίδα', val(c.website)]])}
    <div class="sec">Διεύθυνση</div>${kv([['Οδός', val(c.address)], ['Πόλη / ΤΚ', val([c.city, c.postcode].filter(Boolean).join(' '))], ['Περιοχή', val(c.region)]])}
    <div class="sec">Εμπορικά</div>${kv([['Συνεργάτης', val(c.partner)], ['Προέλευση', val(c.source)], ['Ετήσια ανανέωση', ii.length ? eur(ii.filter(x => x.step >= 7).reduce((s, x) => s + renewOf(x), 0)) : val('')]])}
    ${c.notes ? `<div class="sec">Σημειώσεις</div><div style="white-space:pre-wrap;font-size:13.5px">${esc(c.notes)}</div>` : ''}
    <div class="sec">Σύστημα</div>${kv([['Δημιουργία', fdt(c.created_at)], ['Τελευταία αλλαγή', fdt(c.updated_at) + (c.updated_by ? ' · ' + esc(c.updated_by) : '')], ['Συσκευή TagoIO', c.legacy_device_id ? '<span class="mono">' + esc(c.legacy_device_id) + '</span>' : '<span class="sub">— (νέος πελάτης, δεν έχει ακόμη συσκευή)</span>']])}`;
  if (tab === 'contacts') body += tbl(['Όνομα', 'Ρόλος', 'Τηλέφωνο', 'Email'], (c.contacts || []).map(x => `<tr><td><b>${esc(x.n || '—')}</b></td><td>${esc(x.role || '')}</td><td>${x.phone ? `<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : ''}</td><td>${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ''}</td></tr>`), 'Καμία επαφή — προσθέστε από «Επεξεργασία»');
  if (tab === 'inst') body += tbl(['Εγκατάσταση', 'Πακέτο', 'Συνδρομή'], ii.map(x => `<tr class="c" onclick="dInst('${x.id}')"><td>${esc(x.n)}<div class="sub">${CAT[x.cat] ? CAT[x.cat].n : ''}</div></td><td>${prod(x.plan) ? esc(prod(x.plan).n) : '—'}</td><td>${b(...subSt(x))}</td></tr>`), c.legacy_device_id ? 'Καμία εγκατάσταση' : 'Οι εγκαταστάσεις συνδέονται όταν ο πελάτης αποκτήσει συσκευή στο TagoIO');
  if (tab === 'hist') body += `<div style="display:grid;gap:10px">${aud.map(a => {
      const ch = a.changes || {}, rows = a.action === 'note' ? '' : Object.keys(ch).filter(k => FLD_N[k] && Array.isArray(ch[k])).map(k => `<div class="sub">${FLD_N[k]}: <s>${esc(fmtV(ch[k][0]))}</s> → <b>${esc(fmtV(ch[k][1]))}</b></div>`).join('');
      return `<div class="card" style="padding:10px 12px"><div class="row" style="gap:8px">${b(a.action === 'note' ? esc((ch.kind || 'Σημείωση')) : (ACT_N[a.action] || a.action), a.action === 'archive' ? 'bad' : a.action === 'note' ? 'info' : 'ok', 1)}<span class="sp"></span><span class="sub">${fdt(a.t)} · ${esc(a.actor || '—')}</span></div>${a.note ? `<div style="white-space:pre-wrap;margin-top:6px">${esc(a.note)}</div>` : ''}${rows}</div>`;
    }).join('') || '<div class="empty">Χωρίς ιστορικό</div>'}</div>`;
  const foot = `<button class="btn" onclick="closeD()">Κλείσιμο</button><span class="sp"></span>` +
    (c.status === 'archived' ? `<button class="btn" onclick="custArchive('${c.id}',false)">Επαναφορά</button>` : `<button class="btn" onclick="custArchive('${c.id}',true)">Αρχειοθέτηση</button>`) +
    `<button class="btn" onclick="noteForm('${c.id}')">+ Σημείωση</button><button class="btn p" onclick="custForm('${c.id}')">Επεξεργασία</button>`;
  openD('Πελάτες', c.name || '—', body, foot);
};
function fmtV(v) { if (v == null || v === '') return '—'; if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? (x.n || x.email || x.phone || '') : x).filter(Boolean).join(', ') || '—'; if (typeof v === 'object') return JSON.stringify(v); return KIND_N[v] || ({ active: 'Ενεργός', archived: 'Αρχείο' })[v] || String(v); }

/* ── Φόρμα νέου / επεξεργασίας ── */
const CF = [['name', 'Επωνυμία *'], ['activity', 'Δραστηριότητα'], ['vat', 'ΑΦΜ'], ['tax_office', 'ΔΟΥ'], ['phone', 'Τηλέφωνο'], ['mobile', 'Κινητό'], ['email', 'Email'], ['website', 'Ιστοσελίδα'],
  ['address', 'Διεύθυνση'], ['city', 'Πόλη'], ['postcode', 'ΤΚ'], ['region', 'Περιοχή'], ['partner', 'Συνεργάτης / μεταπωλητής'], ['source', 'Προέλευση (πώς μας βρήκε)']];
let CF_CONTACTS = [];
function custForm(id) {
  const c = id ? regById(id) : null, v = k => esc(c && c[k] != null ? (Array.isArray(c[k]) ? c[k].join(', ') : c[k]) : '');
  CF_CONTACTS = c ? (c.contacts || []).map(x => Object.assign({}, x)) : [];
  const inp = (k, n, extra = '') => `<div class="fld"><label for="f_${k}">${n}</label><input id="f_${k}" value="${v(k)}" ${extra}></div>`;
  const body = `<div class="alert bad" id="ferr" style="display:none"></div>
    <div class="sec">Ταυτότητα</div>${inp('name', 'Επωνυμία *', 'maxlength="100"')}
    <div class="f2"><div class="fld"><label for="f_kind">Είδος</label>${sel('f_kind', [['client', 'Πελάτης'], ['partner', 'Συνεργάτης / μεταπωλητής'], ['test', 'Δοκιμαστικός (εκτός χρέωσης)']], c ? c.kind : 'client')}</div>${inp('activity', 'Δραστηριότητα')}</div>
    <div class="f2">${inp('vat', 'ΑΦΜ', 'inputmode="numeric" maxlength="9" oninput="afmHint()"')}${inp('tax_office', 'ΔΟΥ')}</div><div class="sub" id="afmh" style="margin:-6px 0 10px"></div>
    <div class="sec">Επικοινωνία</div><div class="f2">${inp('phone', 'Τηλέφωνο', 'inputmode="tel"')}${inp('mobile', 'Κινητό', 'inputmode="tel"')}${inp('email', 'Email', 'type="email"')}${inp('website', 'Ιστοσελίδα')}</div>
    <div class="sec">Διεύθυνση</div>${inp('address', 'Οδός και αριθμός')}<div class="f2">${inp('city', 'Πόλη')}${inp('postcode', 'ΤΚ', 'inputmode="numeric" maxlength="6"')}</div>${inp('region', 'Περιοχή / Περιφερειακή ενότητα')}
    <div class="sec">Εμπορικά</div><div class="f2">${inp('partner', 'Συνεργάτης / μεταπωλητής')}${inp('source', 'Προέλευση (πώς μας βρήκε)')}</div>${inp('labels', 'Ετικέτες (χωρισμένες με κόμμα)')}
    <div class="sec">Επαφές</div><div id="fcon"></div><button class="btn" type="button" onclick="CF_CONTACTS.push({});drawContacts()">+ Επαφή</button>
    <div class="sec">Σημειώσεις</div><div class="fld"><textarea id="f_notes" rows="4" maxlength="5000">${v('notes')}</textarea></div>`;
  openD('Πελάτες', c ? 'Επεξεργασία · ' + (c.name || '') : 'Νέος πελάτης', body,
    `<button class="btn" onclick="${c ? `dCust('${c.id}')` : 'closeD()'}">Άκυρο</button><span class="sp"></span><button class="btn p" id="fsave" onclick="custSave(${c ? `'${c.id}'` : 'null'})">Αποθήκευση</button>`);
  drawContacts(); afmHint();
}
function drawContacts() {
  const el = $('#fcon'); if (!el) return;
  el.innerHTML = CF_CONTACTS.map((x, i) => `<div class="card" style="padding:10px;margin-bottom:8px"><div class="f2">
    <div class="fld"><label>Όνομα</label><input value="${esc(x.n || '')}" oninput="CF_CONTACTS[${i}].n=this.value"></div>
    <div class="fld"><label>Ρόλος</label><input value="${esc(x.role || '')}" placeholder="π.χ. γεωπόνος, λογιστήριο" oninput="CF_CONTACTS[${i}].role=this.value"></div>
    <div class="fld"><label>Τηλέφωνο</label><input value="${esc(x.phone || '')}" inputmode="tel" oninput="CF_CONTACTS[${i}].phone=this.value"></div>
    <div class="fld"><label>Email</label><input value="${esc(x.email || '')}" type="email" oninput="CF_CONTACTS[${i}].email=this.value"></div></div>
    <button class="btn" type="button" onclick="CF_CONTACTS.splice(${i},1);drawContacts()">Αφαίρεση επαφής</button></div>`).join('') || '<div class="sub" style="margin-bottom:8px">Καμία επαφή.</div>';
}
function afmHint() { const e = $('#f_vat'), h = $('#afmh'); if (!e || !h) return; const v = e.value.replace(/\s+/g, ''); h.innerHTML = !v ? '' : afmOk(v) ? '<span class="ok">✓ Έγκυρος ΑΦΜ</span>' : '<span class="bad">✕ Ο ΑΦΜ δεν είναι έγκυρος (9 ψηφία με σωστό ψηφίο ελέγχου)</span>'; }
function custCollect() {
  const d = {}; for (const [k] of CF) { const e = $('#f_' + k); if (e) d[k] = e.value.trim(); }
  d.kind = $('#f_kind').value; d.labels = ($('#f_labels').value || '').split(',').map(x => x.trim()).filter(Boolean); d.notes = $('#f_notes').value;
  d.contacts = CF_CONTACTS.map(x => ({ n: String(x.n || '').trim(), role: String(x.role || '').trim(), phone: String(x.phone || '').trim(), email: String(x.email || '').trim().toLowerCase() })).filter(x => x.n || x.phone || x.email);
  return d;
}
function custValidate(d) {
  const e = [];
  if (!d.name) e.push('Η επωνυμία είναι υποχρεωτική.');
  if (d.vat && !afmOk(d.vat)) e.push('Ο ΑΦΜ δεν είναι έγκυρος.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.push('Το email δεν είναι έγκυρο.');
  for (const [k, n] of [['phone', 'Τηλέφωνο'], ['mobile', 'Κινητό']]) if (d[k] && !/^\+?[\d\s()-]{6,20}$/.test(d[k])) e.push(n + ': μόνο ψηφία, κενά, + ( ) -.');
  if (d.postcode && !/^\d{3}\s?\d{2}$/.test(d.postcode)) e.push('Ο ΤΚ πρέπει να έχει 5 ψηφία.');
  const dup = d.vat && regAll().find(c => c.vat === d.vat && c.status !== 'archived' && !(custSave._id && String(c.id) === String(custSave._id)));
  if (dup) e.push('Υπάρχει ήδη ενεργός πελάτης με αυτόν τον ΑΦΜ: «' + dup.name + '».');
  return e;
}
function custSave(id) {
  custSave._id = id;
  const d = custCollect(), errs = custValidate(d), el = $('#ferr');
  if (errs.length) { el.textContent = errs.join(' '); el.style.display = 'flex'; el.scrollIntoView({ block: 'nearest' }); return; }
  el.style.display = 'none';
  let ok;
  if (id) {
    const c = regById(id), ch = {};
    for (const k of Object.keys(d)) { const a = JSON.stringify(c[k] == null ? (Array.isArray(d[k]) ? [] : '') : c[k]), b2 = JSON.stringify(d[k]); if (a !== b2) ch[k] = d[k]; }
    if (!Object.keys(ch).length) { toast('Καμία αλλαγή'); dCust(id); return; }
    ok = sendCmd('customer.update', { id: c.id, base_version: c.version || 1, data: ch }, 'Αποθήκευση');
  } else ok = sendCmd('customer.create', { data: d }, 'Δημιουργία');
  if (ok) { const bt = $('#fsave'); bt.disabled = true; bt.textContent = 'Αποθήκευση…'; }
}
function custArchive(id, on) {
  const c = regById(id); if (!c) return;
  if (!confirm((on ? 'Αρχειοθέτηση' : 'Επαναφορά') + ' του πελάτη «' + c.name + '»;' + (on ? '\nΔεν διαγράφεται τίποτα· μπορεί να επανέλθει από το «Αρχείο».' : ''))) return;
  if (sendCmd(on ? 'customer.archive' : 'customer.restore', { id: c.id, base_version: c.version || 1 }, on ? 'Αρχειοθέτηση' : 'Επαναφορά')) toast('Αποστολή…');
}
function noteForm(id) {
  const c = regById(id); if (!c) return;
  openD('Πελάτες · ' + (c.name || ''), 'Νέα σημείωση', `<div class="alert bad" id="ferr" style="display:none"></div><div class="fld"><label for="n_kind">Είδος</label>${sel('n_kind', ['σημείωση', 'τηλεφώνημα', 'επίσκεψη', 'email', 'συνάντηση', 'παράπονο'].map(x => [x, x[0].toUpperCase() + x.slice(1)]))}</div>
    <div class="fld"><label for="n_text">Κείμενο</label><textarea id="n_text" rows="6" maxlength="5000" placeholder="Τι ειπώθηκε, τι συμφωνήθηκε, επόμενο βήμα…"></textarea></div>`,
    `<button class="btn" onclick="dCust('${c.id}','hist')">Άκυρο</button><span class="sp"></span><button class="btn p" id="fsave" onclick="noteSave('${c.id}')">Καταχώριση</button>`);
}
function noteSave(id) {
  const t = $('#n_text').value.trim(); if (!t) { const e = $('#ferr'); e.textContent = 'Γράψτε κείμενο.'; e.style.display = 'flex'; return; }
  if (sendCmd('customer.note', { id, note: t, kind: $('#n_kind').value }, 'Σημείωση')) { const bt = $('#fsave'); bt.disabled = true; bt.textContent = 'Καταχώριση…'; }
}

/* ── Πίνακας ελέγχου μόνο με πραγματικά δεδομένα ── */
const _dashDemo = PAGES.dash;
PAGES.dash = function () {
  if (!IN_TAGO) return _dashDemo();
  const all = regAll().filter(c => c.status !== 'archived'), act = all.filter(c => c.kind !== 'test');
  const issues = act.filter(c => custIssues(c).length), live = INST.filter(x => ['ok', 'warn'].includes(subSt(x)[1]));
  const exp = INST.filter(x => x.step >= 7 && x.end && days(x.end) <= 30).sort((a, b) => days(a.end) - days(b.end));
  const stockV = UNITS.some(u => u.st === 'Απόθεμα' && prod(u.k) && prod(u.k).cost != null) ? UNITS.filter(u => u.st === 'Απόθεμα').reduce((s, u) => s + ((prod(u.k) || {}).cost || 0), 0) : null;
  const aud = ((REG && REG.audit) || []).slice(0, 12);
  return ph('Επισκόπηση', 'Πίνακας ελέγχου', new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · μόνο πραγματικά δεδομένα', `<button class="btn p" onclick="custForm()">+ Νέος πελάτης</button>`) +
    `<div class="grid g4">${kpi('Ενεργοί πελάτες', REG ? act.length : '…', REG ? (all.length - act.length) + ' δοκιμαστικοί' : 'φόρτωση μητρώου')}${kpi('Εγκαταστάσεις σε λειτουργία', live.length, INST.length + ' συνολικά')}${kpi('Ετήσιες ανανεώσεις (ARR)', eur0(arr()), 'από τις ενεργές συνδρομές')}${kpi('Λήξεις 30 ημερών', exp.length, exp.length ? 'πρώτη: ' + esc(exp[0].n) : 'καμία', exp.length ? 'warn' : '')}</div>
    <div class="grid g4" style="margin-top:14px">${kpi('Καρτέλες με ελλείψεις', REG ? issues.length : '…', 'ΑΦΜ, επικοινωνία ή διεύθυνση', issues.length ? 'warn' : '')}${kpi('Αξία αποθέματος (κόστος)', m0(stockV), (lowStock().length === 1 ? '1 είδος' : lowStock().length + ' είδη') + ' κάτω από το ελάχιστο')}${kpi('Τιμοκατάλογος', LIVE ? LIVE.n + ' είδη' : '—', LIVE && LIVE.u ? 'ενημέρωση ' + fd(LIVE.u) : '')}${kpi('Τελευταία αλλαγή μητρώου', aud.length ? fdt(aud[0].t) : '—', aud.length ? esc(aud[0].actor || '') : '')}</div>
    <div class="grid g21" style="margin-top:14px"><div class="card"><div class="hd"><h3>Τελευταίες κινήσεις μητρώου</h3><span class="sp"></span><button class="btn" onclick="go('customers')">Όλοι οι πελάτες</button></div><div class="bd">${tbl(['Πότε', 'Πελάτης', 'Ενέργεια', 'Από'], aud.map(a => { const c = regById(a.ref_id); return `<tr class="c" onclick="dCust('${esc(a.ref_id)}','hist')"><td class="sub">${fdt(a.t)}</td><td>${esc(c ? c.name : '—')}</td><td>${a.action === 'note' ? esc((a.changes || {}).kind || 'Σημείωση') : (ACT_N[a.action] || a.action)}</td><td>${esc(a.actor || '—')}</td></tr>`; }), 'Καμία κίνηση ακόμη')}</div></div>
    <div class="card"><div class="hd"><h3>Χρειάζονται συμπλήρωση</h3></div><div class="bd">${tbl(['Πελάτης', 'Τι λείπει'], issues.slice(0, 12).map(c => `<tr class="c" onclick="custForm('${c.id}')"><td>${esc(c.name)}</td><td class="sub warn">${custIssues(c).join(' · ')}</td></tr>`), 'Όλες οι καρτέλες είναι πλήρεις')}</div></div></div>`;
};
if (IN_TAGO) {
  wizard = function () { toast('Νέα εγκατάσταση: από τη φόρμα «Εισαγωγή Εγκατάστασης» του TagoIO.'); };
  try { if (typeof TagoIO.onSyncUserInformation === 'function') TagoIO.onSyncUserInformation(u => { if (u && (u.name || u.email)) ACTOR = String(u.name || u.email).slice(0, 100); }); } catch (e) { /* προαιρετικό */ }
}
