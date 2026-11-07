# -*- coding: utf-8 -*-
"""T-PHASEA-01 (v50.186, 7/11/2026): Φάση Α των κανόνων δεδομένων, εγκεκριμένη από τον Michalis. Διορθώνει σφάλματα χωρίς αγρονομική αλλαγή.
Πυρήνας: Σ2 IPSI που λείπει δεν μετρά ως 0 στον ημερήσιο μέσο· Σ12 το κείμενο «τα μοντέλα δεν την δέχονται» ήταν ψευδές.
Widget: Σ6 κάρτα υγείας, Σ5 παλιά πρόγνωση, Σ7 τίτλος BPI, Σ8 παγετός/καύσωνας στις ειδοποιήσεις, 5γ η ετυμηγορία εδάφους ακολουθεί την απόφαση άρδευσης."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = sys.argv[1]

# ── ΠΥΡΗΝΑΣ (CRLF) ──
p = ROOT + '/analysis/runPerTich.js'
raw = open(p, encoding='utf-8', newline='').read()
assert raw.count('\r\n') > 0 and raw.replace('\r\n', '').count('\n') == 0, 'ο πυρήνας δεν είναι καθαρό CRLF'
s = raw.replace('\r\n', '\n')


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b)


sub("""const SAG_KERNEL_VERSION = 'v50.185 · 2026-11-07';""", """const SAG_KERNEL_VERSION = 'v50.186 · 2026-11-07';""")
sub("""function calculate_BPI(dailyTich, measurements, ipsi, parameters, ipsiError = "") {
""", """// T-PHASEA-01 (v50.186, Σ2): IPSI που λείπει ΔΕΝ μπαίνει στον μέσο της ημέρας. Παλιά μετρούσε ως 0: ο μέσος έπεφτε και το BPI ωραιοποιούνταν
// (12 ώρες κενό: αποδοτικότητα 11 → 20 %). Κανόνας Κ1, άγνωστο ≠ 0. Στον ημερήσιο παλμό η μέρα κλείνει και χωρίς τιμή, αλλιώς ο επόμενος
// μέσος θα απλωνόταν σε δύο ημέρες. Ίδια συμπεριφορά με πριν όταν το IPSI υπάρχει.
function _sagIpsiRunning(ipsiRaw, dailyTich, prevAvg, prevCount) {
  const v = (ipsiRaw === null || ipsiRaw === undefined || ipsiRaw === '') ? NaN : Number(ipsiRaw);
  if (!Number.isFinite(v)) {
    return { emit: dailyTich ? [{ variable: "ipsi_running_count", value: 0 }] : [], dailyAvg: null };
  }
  const baseCount = dailyTich ? 0 : Number(prevCount || 0);
  const baseAvg = dailyTich ? null : prevAvg;
  const newCount = baseCount + 1;
  const newAvg = (baseAvg !== null && Number.isFinite(Number(baseAvg)))
    ? (Number(baseAvg) * baseCount + v) / newCount
    : v;
  // T-BPI-IPSIAVG-01 (v50.140 · έλεγχος Κ3): στο ημερήσιο tick το BPI κρίνει ΤΗ ΧΘΕΣΙΝΗ ημέρα → παίρνει τον μέσο των ~23 ωρών που μόλις
  // μηδενίστηκε, όχι τη μονόωρη τιμή των 03:20. Τις άλλες ώρες παίρνει τον τρέχοντα σωρευτικό. Με < 6 ώρες πέφτει στον τρέχοντα.
  const _prevAvgN = Number(prevAvg), _prevCntN = Number(prevCount || 0);
  const dailyAvg = (dailyTich && Number.isFinite(_prevAvgN) && _prevCntN >= 6) ? _prevAvgN : newAvg;
  return { emit: [{ variable: "ipsi_running_avg", value: Number(newAvg.toFixed(2)) }, { variable: "ipsi_running_count", value: newCount }], dailyAvg };
}

function calculate_BPI(dailyTich, measurements, ipsi, parameters, ipsiError = "") {
""")
a = s.index('          const ipsiVal = Number(ipsi?.[0]?.value ?? 0);\n')
b = s.index('          indicatorsForCrop = [...(indicatorsForCrop ?? []), ...(ipsi ?? [])];\n')
assert 0 < b - a < 2400 and 'measurementsForCrop.data.ipsi_daily_avg = [{ value: _bpiAvg }];' in s[a:b]
s = s[:a] + """          const prevIpsiAvg = getVal(measurementsForCrop, "ipsi_running_avg", null);
          const prevIpsiCount = getVal(measurementsForCrop, "ipsi_running_count", 0);
          const _ipsiRun = _sagIpsiRunning(ipsi?.[0]?.value, dailyTich, prevIpsiAvg, prevIpsiCount);
          indicatorsForCrop.push(..._ipsiRun.emit);
          if (_ipsiRun.dailyAvg !== null) measurementsForCrop.data.ipsi_daily_avg = [{ value: _ipsiRun.dailyAvg }];
""" + s[b:]
sub("""        + ' ωρών (όριο ' + (_stLim / 60).toFixed(1) + ' h) — τα μοντέλα δεν την '
        + 'δέχονται πια ως τρέχουσα.',
""", """        + ' ωρών (όριο ' + (_stLim / 60).toFixed(1) + ' h). Οι υπολογισμοί συνεχίζουν με αυτή την '
        + 'παλιά τιμή, άρα τα αποτελέσματα του αγρού μπορεί να μην ισχύουν.',
""")
open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))

# ── WIDGET (LF) ──
p = ROOT + '/_dist-sagMain/index-7cbd9a4e.js'
s = open(p, encoding='utf-8', newline='').read()
assert '\r\n' not in s
# Σ6: παλιά ή ανύπαρκτη πρόγνωση δεν είναι πράσινο «Λειτουργεί»
sub("""const ROW=(x,ok)=>{const md=x.d.metadata||{};const cl=ok?DOT.green""", """const ROW=(x,ok)=>{/*T-PHASEA-W Σ6*/if(x.k==="forecast_status"&&String(x.d.value)!=="Ενεργή")ok=false;const md=x.d.metadata||{};const cl=ok?DOT.green""")
# Σ5: η κάρτα λέει ότι η πρόγνωση είναι παλιά, και δεν δείχνει περασμένη ώρα σαν επόμενη
sub("""let De=f.hourly_epoch.findIndex(ct=>ct*1e3>=pt);De<0&&(De=0);const Ze=""", """let De=f.hourly_epoch.findIndex(ct=>ct*1e3>=pt);/*T-PHASEA-W Σ5: ίδιο όριο 12 ωρών με τον πυρήνα*/const _fa=(pt-Date.parse((n==null?void 0:n.time)||""))/36e5,staleH=Number.isFinite(_fa)&&_fa>12?Math.round(_fa):0;if(De<0)return{daysCount:0,hoursCount:0,lastUpdate:c,nextDateISO:null,nextMinMax:"—",nextEntry:null,staleH};const Ze=""")
sub("""return{daysCount:0,hoursCount:Fe,lastUpdate:c,nextDateISO:ie,nextMinMax:Es,nextEntry:{""", """return{daysCount:0,hoursCount:Fe,lastUpdate:c,staleH,nextDateISO:ie,nextMinMax:Es,nextEntry:{""")
sub("""e.jsx("div",{className:"card-chip-value",children:c})]},n))})]}):e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"desc muted",st""", """e.jsx("div",{className:"card-chip-value",children:c})]},n))}),Oe.staleH?e.jsx("div",{style:{fontSize:12,color:"#b45309",marginTop:6},children:"Παλιά πρόγνωση: λήψη πριν "+Oe.staleH+" ώρες"}):null]}):e.jsxs(e.Fragment,{children:[e.jsx("p",{className:"desc muted",st""")
# Σ7: η τιμή αφορά το προηγούμενο 24ωρο
sub("""e.jsx("h3",{children:"Συνθήκες ανάπτυξης σήμερα"})""", """e.jsx("h3",{children:"Συνθήκες ανάπτυξης · προηγούμενο 24ωρο"})""")
# Σ8: τα frost_warning/heat_warning δεν τα παράγει κανείς, ο καιρός είναι στα weather_alert_*
sub("""const AK=[["frost_warning","Παγετός"],["heat_warning","Καύσωνας"],""", """const AK=[["weather_alert_frost","Παγετός"],["weather_alert_heat","Καύσωνας"],""")
sub("""const VT=x=>{const md=x.d.metadata||{},v=x.d.value,t=String(md.text||"");let m;if(x.k==="infection_ahead"){""", """const VT=x=>{const md=x.d.metadata||{},v=x.d.value,t=String(md.text||"");let m;if(/^weather_alert_/.test(x.k))return [String(md.label_el||(v==="emergency"?"Έκτακτο":"Προειδοποίηση")),t];if(x.k==="infection_ahead"){""")
# 5γ: μία απόφαση. Ο πυρήνας κρίνει και βροχή, κρύο έδαφος, ποιότητα νερού, άρα η ετυμηγορία δεν του αντιφάσκει.
sub("""else{tone="green";head="Απόφαση αγρού: όχι πότισμα — ριζόστρωμα "+f(b)+", μέσα στον στόχο "+f(zl)+"–"+f(zu)+".";}const wt=""", """else{tone="green";head="Απόφαση αγρού: όχι πότισμα — ριζόστρωμα "+f(b)+", μέσα στον στόχο "+f(zl)+"–"+f(zu)+".";}/*T-PHASEA-W 5γ*/const _ir=(typeof c.irr=="string")?c.irr:"";if((tone==="red"||tone==="orange")&&/^(ΜΗΝ ποτίζετε|Δεν απαιτείται πότισμα|Δεν χρειάζεται άρδευση)/.test(_ir)){tone="blue";head="Απόφαση αγρού: όχι πότισμα τώρα — "+_ir+". Το ριζόστρωμα είναι "+f(b)+", αλλά η απόφαση κρίνει και βροχή, θερμοκρασία εδάφους και ποιότητα νερού.";}else if((tone==="green"||tone==="blue")&&/^Απαιτείται άρδευση/.test(_ir)){tone="orange";head="Απόφαση αγρού: πότισμα — δείτε την κάρτα άρδευσης. Το ριζόστρωμα είναι "+f(b)+", αλλά η απόφαση κρίνει περισσότερα από αυτό το διάγραμμα.";}const wt=""")
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
