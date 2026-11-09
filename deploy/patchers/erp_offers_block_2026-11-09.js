/* ══════════ T-ERP-OFFERS-01 (9/11/2026) · ΠΡΟΣΦΟΡΕΣ ΜΕ ΑΠΟΘΗΚΕΥΣΗ ══════════
   Κάθε προσφορά ανήκει σε πελάτη του μητρώου, έχει αριθμό ΠΡ-ΕΤΟΣ-ΝΝΝΝ, έκδοση και κατάσταση. Τα σύνολα τα υπολογίζει
   ο server (erpRegistry) από τις γραμμές. Η φόρμα είναι η γνωστή φόρμα προτύπων με τον πραγματικό τιμοκατάλογο. */
NAV_LIVE.add('offers');
const OFF_N = { draft: 'Πρόχειρη', sent: 'Στάλθηκε', accepted: 'Αποδεκτή', rejected: 'Απορρίφθηκε', cancelled: 'Ακυρώθηκε' };
const OFF_T = { draft: '', sent: 'info', accepted: 'ok', rejected: 'bad', cancelled: 'bad' };
const KIND_LN = { plan: 'Πακέτο', addon: 'Πρόσθετο', svc: 'Υπηρεσία', eq: 'Εξοπλισμός', subi: 'Συνδρομή δικτύου', subpk: 'Συνδρομή TagoIO', other: 'Άλλο' };
const regOffers = () => (REG && REG.offers) || [];
const offById = id => regOffers().find(o => String(o.id) === String(id));
const offOpen = o => o.status === 'draft' || o.status === 'sent';
let OF_EXTRA = [];

const _offersDemo = PAGES.offers;
PAGES.offers = function () {
  if (!IN_TAGO) return _offersDemo();
  if (!REG) return ph('Πωλήσεις', 'Προσφορές', 'Φόρτωση…') + '<div class="card"><div class="empty">Περιμένω τα δεδομένα από το TagoIO…</div></div>';
  ST.f.of = ST.f.of || 'open';
  const f = ST.f.of, q = String(ST.f.oq || '').toLowerCase(), all = regOffers();
  const inF = o => f === 'all' || (f === 'open' ? offOpen(o) : o.status === f);
  const L = all.filter(inF).filter(o => !q || [o.number, o.customer_name, o.title].join(' ').toLowerCase().includes(q))
    .sort((a, b) => String(b.number).localeCompare(String(a.number)));
  const cnt = k => all.filter(o => k === 'all' || (k === 'open' ? offOpen(o) : o.status === k)).length;
  const openV = all.filter(offOpen).reduce((s, o) => s + ((o.totals || {}).gross || 0), 0);
  return ph('Πωλήσεις', 'Προσφορές', cnt('open') + ' ανοιχτές · ' + eur0(openV) + ' με ΦΠΑ · τα σύνολα υπολογίζονται από τον server', `<button class="btn p" onclick="offerFormLive()">+ Νέα προσφορά</button>`) +
    `<div class="toolbar"><input class="inp" id="oqq" placeholder="Αναζήτηση: αριθμός, πελάτης, τίτλος…" value="${esc(ST.f.oq || '')}" style="min-width:240px;flex:1;max-width:380px" oninput="ST.f.oq=this.value;clearTimeout(window.__oq);window.__oq=setTimeout(()=>{go('offers');const e=$('#oqq');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},250)">
     ${seg('of', [['open', 'Ανοιχτές (' + cnt('open') + ')'], ['draft', 'Πρόχειρες (' + cnt('draft') + ')'], ['sent', 'Σταλμένες (' + cnt('sent') + ')'], ['accepted', 'Αποδεκτές (' + cnt('accepted') + ')'], ['rejected', 'Απορρίφθηκαν (' + cnt('rejected') + ')'], ['all', 'Όλες']], 'offers')}</div>
     <div class="card">${tbl(['Αριθμός', 'Πελάτης', 'Τίτλος', 'Ισχύς έως', '#Σύνολο με ΦΠΑ', '#Ανανέωση / έτος', 'Κατάσταση', ''], L.map(o => {
      const t = o.totals || {}, exp = o.status === 'sent' && o.valid_until && days(o.valid_until) < 0;
      return `<tr class="c" onclick="dOfferLive('${o.id}')"><td class="mono">${esc(o.number)}${o.revision > 1 ? ' <span class="sub">έκδ. ' + o.revision + '</span>' : ''}</td><td>${esc(o.customer_name || '—')}</td><td>${esc(o.title || '')}</td>
       <td class="${exp ? 'bad' : ''}">${fd(o.valid_until)}${exp ? ' · έληξε' : ''}</td><td class="num">${eur(t.gross)}</td><td class="num">${t.renew ? eur(t.renew) : '—'}</td><td>${b(OFF_N[o.status] || o.status, OFF_T[o.status])}</td>
       <td>${o.status === 'draft' ? `<button class="btn s" onclick="event.stopPropagation();offerStatus('${o.id}','sent')">Αποστολή</button>` : o.status === 'sent' ? `<button class="btn s" onclick="event.stopPropagation();offerStatus('${o.id}','accepted')">Αποδοχή</button>` : ''}</td></tr>`;
    }), q ? 'Καμία προσφορά δεν ταιριάζει' : 'Καμία προσφορά σε αυτή την κατηγορία')}</div>`;
};

function dOfferLive(id) {
  const o = offById(id); if (!o) { toast('Η προσφορά δεν βρέθηκε'); return; }
  const t = o.totals || {}, c = regById(o.customer_id), aud = ((REG && REG.audit) || []).filter(a => a.ref_type === 'offer' && String(a.ref_id) === String(o.id));
  const body = `<div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap">${b(OFF_N[o.status] || o.status, OFF_T[o.status])}${o.template && prod(o.template) ? b('Πρότυπο: ' + esc(prod(o.template).n), '', 1) : ''}${o.area ? b(o.area + ' στρ.', '', 1) : ''}<span class="sp"></span><span class="sub">έκδοση ${o.revision || 1} · ισχύς έως ${fd(o.valid_until)}</span></div>
    ${kv([['Πελάτης', c ? `<a href="#" onclick="dCust('${c.id}');return false">${esc(c.name)}</a>` : esc(o.customer_name || '—')], ['Τίτλος', esc(o.title || '—')], ['Πληρωμή', o.installments > 1 ? o.installments + ' άτοκες δόσεις των ' + eur((t.gross || 0) / o.installments) : 'Εφάπαξ']])}
    <div class="sec">Είδη</div>${tbl(['Είδος', '#Ποσ.', '#Τιμή', '#Σύνολο', '#Ανανέωση'], (o.lines || []).map(l => `<tr><td>${esc(l.n)}<div class="sub">${KIND_LN[l.kind] || ''}${l.sku ? ' · ' + esc(l.sku) : ''}</div></td><td class="num">${l.q}</td><td class="num">${eur(l.price)}</td><td class="num">${eur(l.price * l.q)}</td><td class="num">${l.renew ? eur(l.renew * l.q) : '—'}</td></tr>`))}
    <div style="margin-top:12px">${kv([['Καθαρή αξία', eur(t.net)], ['Έκπτωση ' + (t.discount || 0) + ' %', '−' + eur(t.disc)], ['ΦΠΑ 24 %', eur(t.vat)], ['<b>Σύνολο</b>', '<b>' + eur(t.gross) + '</b>'], ['Ανανέωση από 2ο έτος', t.renew ? eur(t.renew) + ' / έτος' : '—'], ['Κόστος υλικού & υπηρεσιών (εσωτερικό)', t.cost == null ? '<span class="sub">λείπει κόστος σε κάποιο είδος</span>' : eur(t.cost)], ['Περιθώριο (εσωτερικό)', t.margin == null ? '—' : eur(t.margin)]])}</div>
    ${o.notes ? `<div class="sec">Σημειώσεις</div><div style="white-space:pre-wrap">${esc(o.notes)}</div>` : ''}
    <div class="sec">Ιστορικό</div>${tbl(['Πότε', 'Ενέργεια', 'Από'], aud.map(a => `<tr><td class="sub">${fdt(a.t)}</td><td>${a.action === 'status' && a.changes && a.changes.status ? (OFF_N[a.changes.status[0]] || '') + ' → ' + (OFF_N[a.changes.status[1]] || '') : ({ create: 'Δημιουργία', update: 'Αλλαγή', revision: 'Νέα έκδοση', copy: 'Αντίγραφο' })[a.action] || a.action}${a.note ? '<div class="sub">' + esc(a.note) + '</div>' : ''}</td><td>${esc(a.actor || '—')}</td></tr>`), 'Χωρίς ιστορικό')}`;
  const nb = (to, n, cls) => `<button class="btn ${cls || ''}" onclick="offerStatus('${o.id}','${to}')">${n}</button>`;
  const foot = `<button class="btn" onclick="closeD()">Κλείσιμο</button><button class="btn" onclick="offerPrint('${o.id}')">Εκτύπωση / PDF</button><button class="btn" onclick="offerCopy('${o.id}')">Αντίγραφο</button><span class="sp"></span>` +
    (o.status === 'draft' ? nb('cancelled', 'Ακύρωση') + `<button class="btn" onclick="offerFormLive('${o.id}')">Επεξεργασία</button>` + nb('sent', 'Σημείωση ως σταλμένη', 'p') : '') +
    (o.status === 'sent' ? nb('rejected', 'Απορρίφθηκε') + `<button class="btn" onclick="offerFormLive('${o.id}')">Νέα έκδοση</button>` + nb('accepted', 'Αποδεκτή', 'p') : '') +
    (o.status === 'rejected' || o.status === 'cancelled' ? nb('draft', 'Επαναφορά ως πρόχειρη') : '');
  openD('Πωλήσεις · Προσφορές', o.number + ' · ' + (o.customer_name || ''), body, foot);
}
const _dOfferDemo = dOffer;
dOffer = function (k) { return (IN_TAGO && typeof k === 'string') ? dOfferLive(k) : _dOfferDemo(k); };

function offerFormLive(id, cid) {
  const o = id ? offById(id) : null;
  const custs = regAll().filter(c => c.status !== 'archived').sort((a, b) => String(a.name).localeCompare(String(b.name), 'el'));
  if (!custs.length) { toast('Το μητρώο πελατών δεν έχει φορτώσει ακόμη'); return; }
  offerForm();   // η γνωστή φόρμα προτύπων με τον πραγματικό τιμοκατάλογο
  $('#dtt').textContent = o ? (o.status === 'sent' ? 'Νέα έκδοση · ' : 'Επεξεργασία · ') + o.number : 'Νέα προσφορά';
  const oc = $('#oc'); oc.innerHTML = custs.map(c => `<option value="${c.id}">${esc(c.name)}${c.code ? ' · ' + esc(c.code) : ''}</option>`).join(''); oc.value = o ? o.customer_id : (cid || custs[0].id);
  const box = document.createElement('div');
  box.innerHTML = `<div class="sec">Στοιχεία προσφοράς</div><div class="alert bad" id="ferr" style="display:none"></div><div class="f2"><div class="fld"><label for="otitle">Τίτλος</label><input id="otitle" maxlength="100" placeholder="π.χ. Φυτοπροστασία θερμοκηπίου 4 στρ."></div>
    <div class="fld"><label for="ovalid">Ισχύς έως</label><input id="ovalid" type="date"></div></div><div class="fld"><label for="onotes">Σημειώσεις προς τον πελάτη</label><textarea id="onotes" rows="3" maxlength="5000"></textarea></div><div id="oextra"></div>`;
  $('#osum').parentNode.insertBefore(box, $('#osum'));
  OF_EXTRA = [];
  if (o) {
    $('#otitle').value = o.title || ''; $('#ovalid').value = o.valid_until || ''; $('#onotes').value = o.notes || '';
    if ($('#od')) $('#od').value = (o.totals || {}).discount || o.discount || 0; if ($('#oi')) $('#oi').value = String(o.installments || 1);
    if ($('#oar')) $('#oar').value = o.area || ''; if ($('#otpl') && o.template) $('#otpl').value = o.template;
    for (const l of o.lines || []) { const i = $$('#dbd input[data-k]').find(x => x.dataset.k === l.k); if (i) i.value = l.q; else OF_EXTRA.push(Object.assign({}, l)); }
  } else { const d = new Date(Date.now() + 30 * 864e5); $('#ovalid').value = d.toISOString().slice(0, 10); }
  drawExtra(); ofSum();
  $('#dft').innerHTML = `<button class="btn" onclick="${o ? `dOfferLive('${o.id}')` : 'closeD()'}">Άκυρο</button><span class="sp"></span><button class="btn p" id="fsave" onclick="offerSaveLive(${o ? `'${o.id}'` : 'null'})">${o && o.status === 'sent' ? 'Αποθήκευση νέας έκδοσης' : 'Αποθήκευση'}</button>`;
}
function drawExtra() {
  const el = $('#oextra'); if (!el) return;
  el.innerHTML = OF_EXTRA.length ? `<div class="alert info">Είδη της προσφοράς που δεν υπάρχουν πια στον τιμοκατάλογο· κρατούν την τιμή της προσφοράς.</div>` + tbl(['Είδος', '#Τιμή', '#Ποσ.', ''], OF_EXTRA.map((l, i) => `<tr><td>${esc(l.n)}</td><td class="num">${eur(l.price)}</td><td class="num"><input class="inp" style="width:62px;height:30px" type="number" min="0" value="${l.q}" oninput="OF_EXTRA[${i}].q=+this.value||0"></td><td><button class="btn s" onclick="OF_EXTRA.splice(${i},1);drawExtra()">Αφαίρεση</button></td></tr>`)) : '';
}
function offerCollect() {
  const lines = ofLines().map(([k, q]) => { const p = prod(k) || {}; const c = costOf(k); return { k, sku: p.sku || '', n: p.n || k, kind: p.kind || 'other', q, price: p.price || 0, renew: p.renew || 0, cost: c == null ? null : c }; })
    .concat(OF_EXTRA.filter(l => l.q > 0));
  return { customer_id: $('#oc').value, title: $('#otitle').value.trim(), valid_until: $('#ovalid').value, template: ($('#otpl') || {}).value || '',
    area: ($('#oar') || {}).value || '', discount: +(($('#od') || {}).value) || 0, installments: +(($('#oi') || {}).value) || 1, notes: $('#onotes').value, lines };
}
function offerSaveLive(id) {
  const d = offerCollect(), el = $('#ferr'), errs = [];
  if (!d.lines.length) errs.push('Πρόσθεσε τουλάχιστον ένα είδος.');
  if (d.discount < 0 || d.discount > 50) errs.push('Η έκπτωση πρέπει να είναι 0–50 %.');
  if (d.lines.some(l => !(l.price >= 0))) errs.push('Υπάρχει είδος χωρίς τιμή.');
  if (errs.length) { el.textContent = errs.join(' '); el.style.display = 'flex'; el.scrollIntoView({ block: 'nearest' }); return; }
  el.style.display = 'none';
  const o = id ? offById(id) : null;
  const ok = o ? sendCmd('offer.update', { id: o.id, base_version: o.version || 1, data: d }, 'Αποθήκευση προσφοράς') : sendCmd('offer.create', { customer_id: d.customer_id, data: d }, 'Νέα προσφορά');
  if (ok) { const bt = $('#fsave'); bt.disabled = true; bt.textContent = 'Αποθήκευση…'; }
}
function offerStatus(id, to) {
  const o = offById(id); if (!o) return;
  const q = { sent: 'Σημείωση της ' + o.number + ' ως σταλμένης στον πελάτη;', accepted: 'Ο πελάτης αποδέχτηκε την ' + o.number + ';', rejected: 'Ο πελάτης απέρριψε την ' + o.number + ';', cancelled: 'Ακύρωση της ' + o.number + ';', draft: 'Επαναφορά της ' + o.number + ' ως πρόχειρης (νέα έκδοση);' }[to];
  if (!confirm(q)) return;
  if (sendCmd('offer.status', { id: o.id, base_version: o.version || 1, status: to }, 'Κατάσταση')) toast('Αποστολή…');
}
function offerCopy(id) {
  const o = offById(id); if (!o) return;
  if (!confirm('Νέα πρόχειρη προσφορά με τα ίδια είδη για τον ίδιο πελάτη;')) return;
  if (sendCmd('offer.copy', { id: o.id }, 'Αντίγραφο')) toast('Αποστολή…');
}
// Εκτύπωση για τον πελάτη: ΧΩΡΙΣ κόστος/περιθώριο. Από τον διάλογο εκτύπωσης «Αποθήκευση ως PDF».
function offerPrint(id) {
  const o = offById(id); if (!o) return;
  const c = regById(o.customer_id) || {}, t = o.totals || {}, e2 = v => esc(v == null ? '' : v);
  const rows = (o.lines || []).map(l => `<tr><td>${e2(l.n)}${l.sku ? `<div class="s">${e2(l.sku)}</div>` : ''}</td><td class="n">${l.q}</td><td class="n">${eur(l.price)}</td><td class="n">${eur(l.price * l.q)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="el"><head><meta charset="utf-8"><title>${e2(o.number)} · ${e2(o.customer_name)}</title><style>
    body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2433;margin:28px 34px}h1{font-size:20px;margin:0}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f7a52;padding-bottom:12px;margin-bottom:16px}
    .s{color:#667085;font-size:11.5px}.box{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}.box div{background:#f6f8f7;border-radius:8px;padding:10px 12px}table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border-bottom:1px solid #e4e7ec;text-align:left;vertical-align:top}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#667085}.n{text-align:right;white-space:nowrap}.tot{margin-left:auto;width:320px;margin-top:12px}.tot td{border:0;padding:4px 8px}.g td{font-weight:700;font-size:15px;border-top:2px solid #1d2433}
    .note{margin-top:16px;white-space:pre-wrap}.foot{margin-top:28px;color:#667085;font-size:11.5px;border-top:1px solid #e4e7ec;padding-top:10px}@media print{body{margin:14mm}}</style></head><body>
    <div class="top"><div><h1>Οικονομική προσφορά</h1><div class="s">Smart AgroGenius · MACC</div></div><div style="text-align:right"><b>${e2(o.number)}</b>${o.revision > 1 ? ' · έκδοση ' + o.revision : ''}<div class="s">Ημερομηνία ${fd(o.updated_at || o.created_at)} · ισχύς έως ${fd(o.valid_until)}</div></div></div>
    <div class="box"><div><div class="s">Προς</div><b>${e2(c.name || o.customer_name)}</b>${c.vat ? `<div>ΑΦΜ ${e2(c.vat)}${c.tax_office ? ' · ΔΟΥ ' + e2(c.tax_office) : ''}</div>` : ''}${c.address || c.city ? `<div>${e2([c.address, c.postcode, c.city].filter(Boolean).join(', '))}</div>` : ''}${c.email ? `<div>${e2(c.email)}</div>` : ''}${c.phone || c.mobile ? `<div>${e2(c.mobile || c.phone)}</div>` : ''}</div>
    <div><div class="s">Αφορά</div><b>${e2(o.title || (o.template && prod(o.template) ? prod(o.template).n : 'Εξοπλισμός και υπηρεσίες'))}</b>${o.area ? `<div>Έκταση ${o.area} στρ.</div>` : ''}<div>Πληρωμή: ${o.installments > 1 ? o.installments + ' άτοκες δόσεις των ' + eur((t.gross || 0) / o.installments) : 'εφάπαξ'}</div></div></div>
    <table><thead><tr><th>Περιγραφή</th><th class="n">Ποσ.</th><th class="n">Τιμή μονάδας</th><th class="n">Αξία</th></tr></thead><tbody>${rows}</tbody></table>
    <table class="tot"><tr><td>Καθαρή αξία</td><td class="n">${eur(t.net)}</td></tr>${t.discount ? `<tr><td>Έκπτωση ${t.discount} %</td><td class="n">−${eur(t.disc)}</td></tr>` : ''}<tr><td>ΦΠΑ 24 %</td><td class="n">${eur(t.vat)}</td></tr><tr class="g"><td>Σύνολο</td><td class="n">${eur(t.gross)}</td></tr>${t.renew ? `<tr><td>Ετήσια ανανέωση από το 2ο έτος</td><td class="n">${eur(t.renew)} + ΦΠΑ</td></tr>` : ''}</table>
    ${o.notes ? `<div class="note">${e2(o.notes)}</div>` : ''}<div class="foot">Οι τιμές ισχύουν έως ${fd(o.valid_until)}. Η προσφορά είναι ενδεικτική ως προς τις ποσότητες· οριστικοποιείται μετά την αυτοψία του αγρού.</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('Ο browser μπλόκαρε το νέο παράθυρο· επιτρέψτε τα αναδυόμενα για την εκτύπωση.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
