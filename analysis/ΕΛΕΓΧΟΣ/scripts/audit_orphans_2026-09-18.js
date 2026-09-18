// ΣΑΡΩΣΗ ΟΡΦΑΝΩΝ — βρίσκει ΜΗΧΑΝΙΚΑ τις «κρυφές πύλες»:
//  Α · ο πυρήνας ΠΑΡΑΓΕΙ μεταβλητή που το widget δεν ξέρει να δείξει
//  Β · το widget ΞΕΡΕΙ μεταβλητή που ο πυρήνας δεν παράγει ποτέ
//  Γ · η ΦΟΡΜΑ γράφει κλειδί που η λευκή λίστα κόβει
//  Δ · ο πυρήνας ΔΙΑΒΑΖΕΙ κλειδί ρύθμισης που η φόρμα δεν γράφει ποτέ
//  Ε · το προφίλ ΥΠΟΣΧΕΤΑΙ συνάρτηση/μηχανισμό που δεν υπάρχει στον κώδικα
'use strict';
const fs=require('fs');
const K=fs.readFileSync('C:/Users/Katharak/OneDrive - ΕΠΙΜΕΛΗΤΗΡΙΟ ΗΡΑΚΛΕΙΟΥ/Επιφάνεια εργασίας/MACC/analysis/runPerTich.js','utf8');
const W=fs.readFileSync('C:/Users/Katharak/OneDrive - ΕΠΙΜΕΛΗΤΗΡΙΟ ΗΡΑΚΛΕΙΟΥ/Επιφάνεια εργασίας/MACC/_dist-sagMain/index-7cbd9a4e.js','utf8');
const F=fs.readFileSync('C:/Users/Katharak/OneDrive - ΕΠΙΜΕΛΗΤΗΡΙΟ ΗΡΑΚΛΕΙΟΥ/Επιφάνεια εργασίας/MACC/custom_html_files/configuration.html','utf8');
const A=fs.readFileSync('C:/Users/Katharak/OneDrive - ΕΠΙΜΕΛΗΤΗΡΙΟ ΗΡΑΚΛΕΙΟΥ/Επιφάνεια εργασίας/MACC/analysis/setFieldParametersFromDeviceData.js','utf8');
const uniq=a=>[...new Set(a)].sort();
const P=(t,arr)=>{ console.log('\n'+t+'  ['+arr.length+']');
  if(!arr.length) console.log('   — κανένα —');
  else for(let i=0;i<arr.length;i+=4) console.log('   '+arr.slice(i,i+4).map(x=>x.padEnd(28)).join('')); };

// ── ΤΙ ΠΑΡΑΓΕΙ Ο ΠΥΡΗΝΑΣ ─────────────────────────────────────────────────
const emitted=new Set();
for (const m of K.matchAll(/variable:\s*'([a-z0-9_]+)'/g)) emitted.add(m[1]);
// δυναμικά: `name${suffix}` -> επεκτείνουμε σε 1..4 και σε ''
for (const m of K.matchAll(/variable:\s*'([a-z0-9_]+)'\s*\+\s*c\.n/g))
  for (const s of ['','1','2']) emitted.add(m[1]+s);
for (const m of K.matchAll(/variable:\s*`([a-z0-9_]+)\$\{[^}]*\}`/g))
  for (const s of ['','1','2','3','4']) emitted.add(m[1]+s);
for (const m of K.matchAll(/variable:\s*'([a-z0-9_]+)'\s*\+\s*[A-Za-z_$]/g)) emitted.add(m[1]+'*');

// ── ΤΙ ΞΕΡΕΙ ΤΟ WIDGET ───────────────────────────────────────────────────
const known=new Set();
for (const m of W.matchAll(/([a-z0-9_]{3,}):\{label:"/g)) known.add(m[1]);

// ── Α · παράγονται αλλά δεν εμφανίζονται ─────────────────────────────────
const INTERNAL=/^(_|ec_hist|nematode_|soilcal_|salinity_ks|ipsi_running|field_bundle|declaration_|last_spray_|infection_hours_counter_|pesticide_washoff|fir_|pei_|crop_stage|parse_error)/;
// ΔΙΟΡΘΩΣΗ 8/9: το «έχει ετικέτα στον χάρτη» ΔΕΝ είναι το σωστό κριτήριο.
// Δείγμα 10 από τα 85 «ορφανά» (soil_moisture_rootzone, et0_mm_day,
// irrigation_message, plant_stress, sensor_faults, device_battery,
// kernel_version, field_journal, salinity_stress, soil_ec_status) βρέθηκαν
// ΟΛΑ μέσα στο widget — απλώς τα χειρίζεται ειδικός κώδικας, όχι ο χάρτης
// ετικετών. Σωστό κριτήριο: το όνομα ΔΕΝ ΥΠΑΡΧΕΙ ΠΟΥΘΕΝΑ στο widget.
const noLabel=uniq([...emitted].filter(v=>!v.endsWith('*') && !INTERNAL.test(v)
  && !known.has(v) && W.indexOf(v)<0));
// ── Β · το widget ξέρει αλλά κανείς δεν παράγει ──────────────────────────
const SENSOR=/^(conduct_soil|soil_moisture|soil_temperature|temp_soil|fertility_index|air_|leaf_|rain_|wind_|battery|humidity|temperature|pressure|light_|dew_|valve_|water_|ph$|soil_ph|barometric|uv_|co2|pm[0-9]|raw_|ds18b20|mod$|i_flag)/;
const neverMade=uniq([...known].filter(v=>!emitted.has(v) && !SENSOR.test(v) && K.indexOf(v)<0));

// ── Γ · η φόρμα γράφει, η λευκή λίστα κόβει ──────────────────────────────
const bp=F.slice(F.indexOf('function buildPayload'), F.indexOf('function buildPayload')+9000);
const formKeys=uniq([...bp.matchAll(/^\s{4}([a-z_0-9]+):/gm)].map(m=>m[1]));
const rk=A.slice(A.indexOf('const ROOT_KEYS'), A.indexOf('const PROTECTED_KEYS'));
const rootKeys=new Set([...rk.matchAll(/"([a-z_0-9]+)"/g)].map(m=>m[1]));
const cut=formKeys.filter(k=>!rootKeys.has(k) && k!=='crops');

// ── Δ · ο πυρήνας διαβάζει, η φόρμα δεν γράφει ───────────────────────────
const cfgRead=new Set();
for (const m of K.matchAll(/(?:parameters|fieldConfig|configuration|cropParams)\??\.\s*([a-z_][a-z0-9_]{2,})/g)) cfgRead.add(m[1]);
const KNOWN_INTERNAL=new Set(['crops','periods','id','name','data','value','length','map','filter','find','some','every','push','indexOf','includes','toFixed','slice','split','join','trim','replace','match','test','forEach','keys','entries','stage','timezone','now','cultivation_variety','last_pesticide_key','last_pesticide_date','field_history','wound_history','nematode_field_history','soil_profile','soil','latitude_deg','stone_fraction','drip_fw_fraction','plantation_year','total_plants','covered_cultivation']);
const askedNotAsked=uniq([...cfgRead].filter(k=>!formKeys.includes(k) && !rootKeys.has(k) && !KNOWN_INTERNAL.has(k) && !/_period$/.test(k)));

// ── Ε · υποσχέσεις του προφίλ χωρίς υλοποίηση ────────────────────────────
const promises=[];
for (const m of K.matchAll(/"kernel ([A-Za-z_]+)\(\)"/g)){
  const fn=m[1];
  const decl=new RegExp('function\\s+'+fn+'\\s*\\(').test(K);
  if(!decl) promises.push(fn+'() — αναφέρεται στο προφίλ, ΔΕΝ ΥΠΑΡΧΕΙ');
}
for (const nm of ['start_event_cascade','dd_reset_triggers']){
  const uses=(K.match(new RegExp(nm,'g'))||[]).length;
  if (uses<=1) promises.push(nm+' — δηλώνεται στο προφίλ, ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ ποτέ');
}

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ΣΑΡΩΣΗ ΟΡΦΑΝΩΝ — ΟΛΕΣ ΟΙ ΚΟΜΜΕΝΕΣ ΡΟΕΣ ΜΕ ΜΙΑ ΜΑΤΙΑ                 ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('πυρήνας: '+emitted.size+' μεταβλητές · widget: '+known.size+' ετικέτες · φόρμα: '+formKeys.length+' κλειδιά · λευκή λίστα: '+rootKeys.size);
P('Α · ΠΑΡΑΓΟΝΤΑΙ ΑΛΛΑ ΔΕΝ ΥΠΑΡΧΟΥΝ ΠΟΥΘΕΝΑ ΣΤΟ WIDGET (ο αγρότης δεν τις βλέπει ΠΟΤΕ)', noLabel);
P('Β · ΤΟ WIDGET ΤΙΣ ΞΕΡΕΙ ΑΛΛΑ ΚΑΝΕΙΣ ΔΕΝ ΤΙΣ ΠΑΡΑΓΕΙ (νεκρές ετικέτες)', neverMade);
P('Γ · Η ΦΟΡΜΑ ΤΙΣ ΓΡΑΦΕΙ, Η ΛΕΥΚΗ ΛΙΣΤΑ ΤΙΣ ΚΟΒΕΙ', cut);
P('Δ · Ο ΠΥΡΗΝΑΣ ΤΙΣ ΔΙΑΒΑΖΕΙ, Η ΦΟΡΜΑ ΔΕΝ ΤΙΣ ΓΡΑΦΕΙ', askedNotAsked);
console.log('\nΕ · ΥΠΟΣΧΕΣΕΙΣ ΤΟΥ ΠΡΟΦΙΛ ΧΩΡΙΣ ΥΛΟΠΟΙΗΣΗ  ['+promises.length+']');
promises.forEach(x=>console.log('   · '+x));
console.log('\nΣΥΝΟΛΟ ΚΟΜΜΕΝΩΝ ΡΟΩΝ: '+(noLabel.length+neverMade.length+cut.length+askedNotAsked.length+promises.length));
