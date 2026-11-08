// Φάση 1Β: η σελίδα ERP μέσα στο TagoIO φτιάχνει πελάτες/εγκαταστάσεις από subs_chunk/subs_summary και fleet_field,
// χρεώνει σύνδεση LoRaWAN ανά όργανο (ελάχιστο 3 σήματα, κλίμακα 3/8/48) και σβήνει τις πλασματικές συναλλαγές.
// Εκτέλεση: node analysis/test/erp_live_fleet_check.js  (συνθετικά δεδομένα, δεν καλεί το TagoIO)
const fs = require('fs'), zlib = require('zlib');
const head = { u: '2026-01-01T00:00:00Z', ct: ['Αισθητήρες', 'Συνδρομές'], in: ['Γενικής Χρήσης'], vn: ['Milesight', 'MACC'] };
const items = [['UC511-DI-868M', 0, 0, 0, 100, 'Ελεγκτής UC511'], ['TAGO-Actility 3', 1, 0, 1, 10, 'LoRaWAN 3'], ['TAGO-Actility 8', 1, 0, 1, 18, 'LoRaWAN 8'], ['TAGO-Actility 48', 1, 0, 1, 48, 'LoRaWAN 48']];
const v4 = { v: 4, u: head.u, c: 'EUR', ct: head.ct, in: head.in, vn: head.vn, i: items, pk: [], sb: [] };
const cl = zlib.deflateSync(Buffer.from(JSON.stringify(v4))).toString('base64');
const G = '1794098278760';
const cItems = [{ k: 'c', i: 'c1', n: 'Πελάτης Α', m: 'a@x.gr', p: '69' }, { k: 'c', i: 'c2', n: 'Ξενοδοχείο Β' }];
const fItems = [
  { k: 'f', i: 'aaaaaa111111', n: 'Αγρός 1', c: 'c1', s: 'active', e: '2027-03-01', cost: '120', list: '150', u: ['Χρήστης'], cat: 'field', sg: [['lse01', 2, 3, 3], ['s2120', 1, 8, 8]] },
  { k: 'f', i: 'bbbbbb222222', n: 'Ζώνη 2', c: 'c2', s: 'paused', e: '', cat: 'landscape', sg: [['uc511', 1, 2, 3], ['?', 1, null, null]], sh: [['s2120', 'Αγρός 1', 1]] },
  { k: 'f', i: 'dddddd444444', n: 'Δοκιμές', c: 'c1', s: 'active', e: '', cat: 'field', sg: [], sh: [['s2120', 'Αγρός 1', 0]], tst: 1 },
  { k: 'f', i: 'cccccc333333', n: 'Ορφανός', c: '', s: 'active', e: '2026-12-01', cat: 'weird', sg: [], sh: [['lse01', 'Αγρός 1', 0], ['uc511', 'Ζώνη 2', 2]], dup: 1 },
];
const rows = [
  { variable: 'subs_summary', group: G, time: '2026-11-08T00:37:58Z', metadata: { parts: 2, pricing: [{ n: 'subscriptionPricingNumbers', p: { sense: 59, sagFull: 219 } }, { n: 'itemsPricingNumbers', p: { sense: 1 } }] } },
  { variable: 'subs_summary', group: '1700000000000', time: '2023-01-01T00:00:00Z', metadata: { parts: 1 } },
  { variable: 'subs_chunk', group: G, metadata: { part: 1, parts: 2, items: fItems } },
  { variable: 'subs_chunk', group: G, metadata: { part: 0, parts: 2, items: cItems } },
  { variable: 'subs_chunk', group: '1700000000000', metadata: { part: 0, parts: 1, items: [{ k: 'c', i: 'old', n: 'Παλιός' }] } },
  { variable: 'fleet_field', time: '2026-11-08T00:21:00Z', metadata: { severity: 3, state: 'ΕΠΙΣΚΕΨΗ', text: JSON.stringify({ i: 'aaaaaa111111'.slice(-6) }) } },
  { variable: 'fleet_field', time: '2026-11-07T00:21:00Z', metadata: { severity: 0, state: 'ΕΝΤΑΞΕΙ', text: JSON.stringify({ i: 'aaaaaa111111'.slice(-6) }) } },
  { variable: 'fleet_field', time: '2026-11-08T00:21:00Z', metadata: { severity: 1, state: 'ΓΡΑΦΕΙΟ', text: JSON.stringify({ i: 'bbbbbb222222'.slice(-6) }) } },
  { variable: 'costing_list', value: 'catalog_v4', metadata: { cl, v: 4 } },
  { variable: 'warehouse_summary', group: 'W2', time: '2026-11-08T21:17:50Z', metadata: { parts: 2, total: 3, free: 2, in_field: 1 } },
  { variable: 'warehouse_summary', group: 'W1', time: '2026-11-01T00:00:00Z', metadata: { parts: 1 } },
  { variable: 'warehouse_chunk', group: 'W2', metadata: { part: 1, parts: 2, items: [{ i: 'w3', n: 'weird_zz9_0001', t: 'zz9', c: '2026-10-03', x: 1, l: new Date().toISOString(), k: 'σχόλιο' }, { i: 'w4', n: 'dragino_lms01_ls_cccc', t: 'lms01_ls', c: '2026-10-04' }] } },
  { variable: 'warehouse_chunk', group: 'W2', metadata: { part: 0, parts: 2, items: [{ i: 'w1', n: 'dragino_se0x_aaaa', t: 'se0x', c: '2026-10-01' }, { i: 'w2', n: 'milesight_uc511_bbbb', t: 'uc511', c: '2026-10-02', f: [{ f: 'Αγρός 1', c: 'Πελάτης Α' }] }] } },
  { variable: 'warehouse_chunk', group: 'W1', metadata: { part: 0, parts: 1, items: [{ i: 'old1', n: 'old', t: 'se0x' }] } },
];
const js = fs.readFileSync(__dirname + '/../../reports/demo/kentro_diaxeirisis_demo.html', 'utf8').match(/<script>([\s\S]*)<\/script>/)[1].replace('"use strict";', '');
const el = () => ({ innerHTML: '', textContent: '', value: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {}, dataset: {} });
const EE = {}; global.__E = EE;
global.document = { querySelector: (s) => EE[s] || (EE[s] = el()), querySelectorAll: () => [], documentElement: { dataset: {} }, addEventListener() {} };
global.matchMedia = () => ({ matches: false }); global.window = { scrollTo() {} };
global.__ROWS = rows;
let bad = 0;
global.__ok = (name, cond, extra) => { console.log((cond ? 'ok  ' : 'ΛΑΘΟΣ ') + name + (extra !== undefined ? ' · ' + extra : '')); if (!cond) bad++; };
eval(js + `;(async()=>{
 const fakeBefore=INV.length+OFFERS.length+UNITS.length;
 await liveAll([{id:'w',data:__ROWS}]);
 __ok('πραγματικοί πελάτες, όχι οι πλασματικοί, και «χωρίς πελάτη» για τον ορφανό', CUST.length===3&&CUST[0].id==='c1'&&CUST.some(c=>c.id==='_nc')&&!CUST.some(c=>c.id==='old'), CUST.map(c=>c.id).join(','));
 __ok('εγκαταστάσεις από το νεότερο σύνολο', INST.length===4, INST.length);
 const tz=inst('dddddd444444');dInst('dddddd444444');__ok('δοκιμαστική: σημείωση, μηδενική ανανέωση, χωρίς αίτημα', /Δοκιμαστική εγγραφή/.test(tz.note)&&renewOf(tz)===0&&!TICK.some(t=>t.i==='dddddd444444')&&/Δοκιμαστική εγγραφή: δεν χρεώνεται/.test(__E['#dbd'].innerHTML)&&!/Κανένα δικό της/.test(__E['#dbd'].innerHTML));
 const a=inst('aaaaaa111111'),z=inst('bbbbbb222222'),o=inst('cccccc333333');
 __ok('περίπτωση: αγρός / ξενοδοχείο / άγνωστη → αγρός', a.cat==='field'&&z.cat==='landscape'&&o.cat==='field');
 __ok('LoRaWAN: 2×lse01 (κλίμακα 3) + 1×S2120 (κλίμακα 8) = 2×40 + 72', Math.abs(renewOf(a)-(2*40+72))<0.01, renewOf(a));
 __ok('ελεγκτής βανών 2 σήματα → κλίμακα 3 · άγνωστο όργανο δεν χρεώνεται, σημειώνεται', Math.abs(renewOf(z)-40)<0.01&&z.miss===1, renewOf(z)+' / '+z.miss);
 __ok('πίνακας στόλου: νεότερη εγγραφή ΕΠΙΣΚΕΨΗ → αίτημα', a.h==='visit'&&TICK.filter(t=>t.k==='Βλάβη').length===1&&TICK.find(t=>t.k==='Βλάβη').i==='aaaaaa111111');
 __ok('κοινό όργανο με άλλον πελάτη → αίτημα απόφασης, μόνο εκεί', TICK.filter(t=>t.k==='Αίτημα').length===1&&TICK.find(t=>t.k==='Αίτημα').i==='bbbbbb222222');
 __ok('καλυμμένη εγγραφή: σημείωση, μηδενική ανανέωση', /διπλοεγγραφή/.test(o.note)&&renewOf(o)===0&&o.dup===1);
 dInst('bbbbbb222222');__ok('καρτέλα: κοινό όργανο και πού χρεώνεται', /s2120 → χρεώνεται στο «Αγρός 1»/.test(__E['#dbd'].innerHTML)&&/θέλει απόφαση/.test(__E['#dbd'].innerHTML));
 dInst('cccccc333333');__ok('καρτέλα καλυμμένης: χωρίς δικά της όργανα', /Κανένα δικό της/.test(__E['#dbd'].innerHTML)&&!/θέλει απόφαση/.test(__E['#dbd'].innerHTML));
 __ok('κοινό με άλλον πελάτη ΜΕ απόφαση: «αποφασισμένο», χωρίς αίτημα', /uc511 → χρεώνεται στο «Ζώνη 2».{0,40}αποφασισμένο/.test(__E['#dbd'].innerHTML)&&!TICK.some(t=>t.i==='cccccc333333'));
 dInst('aaaaaa111111');__ok('καρτέλα χωρίς κοινά: καμία γραμμή κοινών', !/Κοινά όργανα/.test(__E['#dbd'].innerHTML));
 __ok('ΓΡΑΦΕΙΟ → γραφείο, χωρίς αίτημα', z.h==='office');
 __ok('παύση φαίνεται στην καρτέλα', /παύση/.test(z.note));
 __ok('πλασματικές συναλλαγές σβηστές', fakeBefore>0&&INV.length+OFFERS.length+UNITS.filter(u=>!u.live).length+PO.length+BILLS.length+VISITS.length+LEADS.length===0);
 __ok('τιμές TagoIO μόνο από τη συσκευή subscriptionPricing', prod('sp_sense').price===59&&prod('sp_sagFull').price===219);
 __ok('ένδειξη', /Ζωντανά: 2 πελάτες · 4 εγκαταστάσεις [(]1 με όλα τα όργανα και σε άλλη εγγραφή[)] · 1 δοκιμαστικές · αποθήκη 3 ελεύθερα · τιμοκατάλογος 4 είδη/.test(__E['.demo'].textContent), __E['.demo'].textContent);
 __ok('αποθήκη: μόνο το νεότερο πλήρες σύνολο', UNITS.length===4&&!UNITS.some(u=>u.sn==='old1'), UNITS.map(u=>u.sn).join(','));
 __ok('αποθήκη: ελεύθερο SE0X = 1 διαθέσιμο', stockOf('se0x')===1&&stockOf('lms01')===1);
 __ok('αποθήκη: δηλωμένο σε αγρό → εγκατεστημένο στη σωστή εγκατάσταση', UNITS.find(u=>u.sn==='w2').st==='Εγκατεστημένο'&&UNITS.find(u=>u.sn==='w2').inst==='aaaaaa111111');
 __ok('αποθήκη: άγνωστο μοντέλο → δικό του είδος, όχι σφάλμα', !!prod('lt_zz9')&&stockOf('lt_zz9')===1);
 __ok('εγκατεστημένα ανά είδος από τις εγκαταστάσεις (sg)', LIVEI.lse01===2&&LIVEI.s2120===1&&LIVEI.uc511===1, JSON.stringify(LIVEI));
 __ok('σημείο αναπαραγγελίας μηδέν στα ζωντανά (καμία ψεύτικη «Παραγγελία»)', EQ.every(p=>!p.min));
 __ok('κινήσεις: καταχωρήσεις από το TagoIO', MOVES.length===4&&MOVES.every(m=>m.k==='Καταχώρηση'));
 go('stock');__ok('απόθεμα: μόνο είδη με όργανα', /Ζωντανά από το TagoIO: 3 όργανα/.test(__E['#content'].innerHTML)&&!/Θερμοστατική κεφαλή/.test(__E['#content'].innerHTML));
 go('units');__ok('μονάδες: όνομα συσκευής, εκπομπή στην αποθήκη, ανενεργό', /dragino_se0x_aaaa/.test(__E['#content'].innerHTML)&&/εκπέμπει ενώ είναι στην αποθήκη/.test(__E['#content'].innerHTML)&&/ανενεργό στο TagoIO/.test(__E['#content'].innerHTML));
 dUnit('w3');__ok('καρτέλα μονάδας: τελευταίο σήμα και σχόλιο', /Τελευταίο σήμα/.test(__E['#dbd'].innerHTML)&&/σχόλιο/.test(__E['#dbd'].innerHTML));
 for(const u of UNITS){dUnit(u.sn);if(/undefined|NaN|object Object/.test(__E['#dbd'].innerHTML))__ok('καρτέλα μονάδας '+u.sn,false)}
 for(const p of Object.keys(PAGES)){go(p);const h=__E['#content'].innerHTML;if(/undefined|NaN|object Object/.test(h)){__ok('σελίδα '+p,false,(h.match(/.{40}(undefined|NaN|object Object).{20}/)||[''])[0])}}
 __ok('όλες οι σελίδες χωρίς undefined/NaN', true);
 for(const x of INST){dInst(x.id);const h=__E['#dbd'].innerHTML;if(/undefined|NaN|object Object/.test(h))__ok('καρτέλα '+x.n,false,(h.match(/.{40}(undefined|NaN|object Object).{20}/)||[''])[0])}
 dInst('aaaaaa111111');__ok('καρτέλα: όργανα, σήματα, χρέωση TagoIO, χρήστες', /2× lse01 · 3 σήματα → κλίμακα 3/.test(__E['#dbd'].innerHTML)&&/1× s2120 · 8 σήματα → κλίμακα 8/.test(__E['#dbd'].innerHTML)&&/120 · κατάλογος 150/.test(__E['#dbd'].innerHTML)&&/Χρήστης/.test(__E['#dbd'].innerHTML));
 for(const c of CUST){dCust(c.id);if(/undefined|NaN|object Object/.test(__E['#dbd'].innerHTML))__ok('πελάτης '+c.n,false)}
 const n1=INST.length,p1=PROD.length;await liveAll([{data:__ROWS}]);__ok('δεύτερη φόρτωση χωρίς διπλά', INST.length===n1&&PROD.length===p1&&TICK.length===2);
 await liveAll([{data:__ROWS.filter(r=>r.variable!=='costing_list')}]);__ok('φόρτωση χωρίς τιμοκατάλογο χωρίς διπλά', INST.length===n1&&PROD.length===p1, PROD.length+' / '+p1);
 await liveAll([{data:[{variable:'fleet_field',time:'2026-11-08T01:21:00Z',metadata:{severity:0,text:JSON.stringify({i:'111111'})}}]}]);__ok('νέα εγγραφή στόλου μόνη της → ξαναϋπολογίζει', inst('aaaaaa111111').h==='ok'&&TICK.length===1&&TICK[0].k==='Αίτημα');
 console.log(__bad()?'ΑΠΟΤΥΧΙΑ':'erp_live_fleet_check: όλα εντάξει');if(__bad())process.exit(1)})().catch(e=>{console.error(e);process.exit(1)})`);
function __bad() { return bad; }
