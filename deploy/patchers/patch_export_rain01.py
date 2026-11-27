# T-EXPORT-RAIN-01 (27/11/2026) · fieldExportData.js: βροχή μετρητή/έντασης στο κύριο μπλοκ του S2120 + διάστημα, κάλυψη
# και ποιότητα κάθε ωριαίας βροχής (μία τιμή ανά ώρα, όπως το ταμπλό). Όλα-ή-τίποτα· CRLF διατηρείται· node --check.
import subprocess, sys, os
P = "analysis/fieldExportData.js"
raw = open(P, "rb").read().decode("utf-8"); crlf = "\r\n" in raw; s = raw.replace("\r\n", "\n")
def sub(a, b):
    global s
    n = s.count(a)
    if n != 1: sys.exit(f"ΑΠΟΤΥΧΙΑ: {n} εμφανίσεις του {a[:70]!r}")
    s = s.replace(a, b)
assert "T-EXPORT-RAIN-01" not in s, "ήδη εφαρμοσμένο"

sub('const EXPORT_FORMAT_VERSION = "UTC-1";', 'const EXPORT_FORMAT_VERSION = "UTC-2";   // UTC-2 (T-EXPORT-RAIN-01): στήλες μετρητή/έντασης βροχής, διάστημα/κάλυψη/ποιότητα ωριαίας βροχής')

sub('''    "light_intensity",
    "rain_height",
  ],''', '''    "light_intensity",
    "rain_height",
    // T-EXPORT-RAIN-01: σταθμοί με μετρητή (firmware 2.0) δεν γράφουν rain_height από 30/3/2026· γράφουν την ένταση ως
    // rain_gauge και τον αθροιστικό μετρητή ως rain_height_acc. Η αύξηση ανά μέτρηση υπολογίζεται εδώ (rain_height_acc_increment).
    "rain_gauge",
    "rain_height_acc",
  ],''')

sub('''    { label: "rainHourly", vars: ["rain_height_hourly"] },''', '''    // T-EXPORT-RAIN-01: withPeriod = μία τιμή ανά ώρα (όπως το ταμπλό) + στήλες διαστήματος, κάλυψης και ποιότητας.
    { label: "rainHourly", vars: ["rain_height_hourly"], withPeriod: true },''')

sub('''/**
 * Union of every variable a family might use.''', '''/**
 * T-EXPORT-RAIN-01 (27/11/2026): columns computed by the export itself, not stored on the device.
 *   rain_height_acc_increment            per-reading rain from the station's cumulative counter (main s2120 block)
 *   rain_hourly_period_start_utc / _end  the hour each hourly rain value covers (hourly rain block)
 *   rain_hourly_coverage                 share of that hour with data (v34 values; empty before 4/10/2026)
 *   rain_hourly_quality                  counter measurement / estimate from intensity, partial hour, v33, backfill
 * Kept in this table so analysis/test/changelog_check.mjs requires a description for each of them.
 */
const DERIVED_EXPORT_VARIABLES = {
  s2120: ["rain_height_acc_increment", "rain_hourly_period_start_utc", "rain_hourly_period_end_utc", "rain_hourly_coverage", "rain_hourly_quality"],
};
const RAIN_HOURLY_META = ["rain_hourly_period_start_utc", "rain_hourly_period_end_utc", "rain_hourly_coverage", "rain_hourly_quality"];
const RAIN_MAX_MMH = 450;          // S2120 range (datasheet 0-450 mm/h) - same plausibility rule as the kernel and the rain analysis
const RAIN_INC_MAX_GAP_MIN = 30;   // an increment is given only across gaps <= 30 min; after a longer gap the rain cannot be placed in time

/** Per-reading rain from the cumulative counter: difference to the previous reading, counter resets handled like the kernel. */
function accIncrementSeries(points) {
  const P = points
    .map((dp) => ({ dp, t: Date.parse(dp.time), v: Number(dp.value) }))
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v))
    .sort((a, b) => a.t - b.t);
  const out = [];
  for (let i = 1; i < P.length; i++) {
    const gapMin = (P[i].t - P[i - 1].t) / 60000;
    if (gapMin <= 0 || gapMin > RAIN_INC_MAX_GAP_MIN) continue;
    let d = P[i].v - P[i - 1].v;
    if (d < -0.001) d = P[i].v;                                                     // counter reset: the new value is the rain since the reset
    if (d > RAIN_MAX_MMH * Math.max(gapMin / 60, 1 / 60) + 0.254) continue;          // physically impossible step: left empty
    out.push({ time: P[i].dp.time, value: Math.round(Math.max(d, 0) * 1000) / 1000 });
  }
  return out;
}

/** The hour an hourly rain record covers (v33 wrote the end as ...:59.999). */
function rainPeriodOf(dp) {
  const m = (dp && dp.metadata) || {};
  const s = Date.parse(m.period_start_utc);
  let e = Date.parse(m.period_end_utc);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  if (e % 1000 === 999) e += 1;
  return { s, e };
}
function rainHourlyRank(dp) {
  const m = (dp && dp.metadata) || {};
  if (m.alg !== "v34") return 1;
  const c = Number(m.coverage);
  return 2 + (Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 1);
}
/** One record per hour, the same preference as the dashboard: v34 over v33, then higher coverage, then the newest. */
function bestHourlyPerPeriod(points) {
  const best = new Map();
  const loose = [];
  for (const dp of points) {
    const p = rainPeriodOf(dp);
    if (!p) { loose.push(dp); continue; }
    const prev = best.get(p.s);
    const r = rainHourlyRank(dp), rp = prev ? rainHourlyRank(prev) : -1;
    if (!prev || r > rp || (r === rp && Date.parse(dp.time) > Date.parse(prev.time))) best.set(p.s, dp);
  }
  return loose.concat([...best.values()]);
}
function rainQualityText(dp, lang) {
  const m = (dp && dp.metadata) || {};
  const en = lang === "en";
  let est;
  if (m.alg === "v34") est = m.status === "estimate";
  else if (m.source_variable === "rain_height_acc") est = false;
  else if (m.source_variable === "rain_height") est = true;
  else return "";
  let s = est ? (en ? "estimate from intensity" : "εκτίμηση από ένταση") : (en ? "counter measurement" : "μέτρηση μετρητή");
  if (m.alg === "v34" && m.partial) s += en ? " · partial hour" : " · μερική ώρα";
  if (m.alg !== "v34") s += en ? " · before 4/10/2026 (v33)" : " · πριν από 4/10/2026 (v33)";
  if (m.backfill) s += (en ? " · backfilled " : " · συμπλήρωση ") + m.backfill;
  return s;
}
function rainCoveragePct(dp) {
  const m = (dp && dp.metadata) || {};
  if (m.alg !== "v34") return "";
  const c = Number(m.coverage);
  return Number.isFinite(c) ? Math.round(Math.max(0, Math.min(1, c)) * 1000) / 10 : "";
}

/**
 * Union of every variable a family might use.''')

sub('''    rain_height: "Βροχόπτωση Μέτρησης (mm)",
    rain_height_hourly: "Βροχόπτωση Ώρας (mm)",''', '''    rain_height: "Βροχόπτωση Μέτρησης (mm)",
    rain_gauge: "Βροχόπτωση Μέτρησης από Ένταση (mm)",
    rain_height_acc: "Μετρητής Βροχής - Αθροιστικός (mm)",
    rain_height_acc_increment: "Βροχόπτωση Μέτρησης από Μετρητή (mm)",
    rain_height_hourly: "Βροχόπτωση Ώρας (mm)",
    rain_hourly_period_start_utc: "Αρχή Ώρας (UTC)",
    rain_hourly_period_end_utc: "Τέλος Ώρας (UTC)",
    rain_hourly_coverage: "Κάλυψη Ώρας (%)",
    rain_hourly_quality: "Ποιότητα Τιμής",''')
sub('''    rain_height: "Rain per Reading (mm)",
    rain_height_hourly: "Rain Hourly (mm)",''', '''    rain_height: "Rain per Reading (mm)",
    rain_gauge: "Rain per Reading from Intensity (mm)",
    rain_height_acc: "Rain Counter - Cumulative (mm)",
    rain_height_acc_increment: "Rain per Reading from Counter (mm)",
    rain_height_hourly: "Rain Hourly (mm)",
    rain_hourly_period_start_utc: "Hour Start (UTC)",
    rain_hourly_period_end_utc: "Hour End (UTC)",
    rain_hourly_coverage: "Hour Coverage (%)",
    rain_hourly_quality: "Value Quality",''')

sub('''      let varListWithData = varList.filter((v) => variables[v] && variables[v].length > 0);''', '''      // T-EXPORT-RAIN-01: βροχή ανά μέτρηση από τον αθροιστικό μετρητή (σταθμοί firmware 2.0).
      if (variables.rain_height_acc && variables.rain_height_acc.length > 1) {
        variables.rain_height_acc_increment = accIncrementSeries(variables.rain_height_acc);
      }
      let varListWithData = varList
        .concat(variables.rain_height_acc_increment ? ["rain_height_acc_increment"] : [])
        .filter((v) => variables[v] && variables[v].length > 0);''')

sub('''        const groupWithData = group.vars.filter((v) => groupValues[v] && groupValues[v].length > 0);''', '''        // T-EXPORT-RAIN-01: μία τιμή ανά ώρα + διάστημα / κάλυψη / ποιότητα από τα metadata της εγγραφής.
        if (group.withPeriod) {
          const src = groupValues[group.vars[0]] || [];
          if (src.length > 0) {
            const kept = bestHourlyPerPeriod(src);
            if (kept.length !== src.length) context.log(`${info.name}: ${group.vars[0]} ${src.length} -> ${kept.length} (μία ανά ώρα)`);
            groupValues[group.vars[0]] = kept;
            const col = (name, fn) => {
              groupValues[name] = kept.map((dp) => ({ time: dp.time, value: fn(dp) })).filter((x) => x.value !== "" && x.value != null);
            };
            col("rain_hourly_period_start_utc", (dp) => { const p = rainPeriodOf(dp); return p ? fmtUtc(p.s) : ""; });
            col("rain_hourly_period_end_utc", (dp) => { const p = rainPeriodOf(dp); return p ? fmtUtc(p.e) : ""; });
            col("rain_hourly_coverage", rainCoveragePct);
            col("rain_hourly_quality", (dp) => rainQualityText(dp, lang));
          }
        }
        const groupVarList = group.withPeriod ? group.vars.concat(RAIN_HOURLY_META) : group.vars;
        const groupWithData = groupVarList.filter((v) => groupValues[v] && groupValues[v].length > 0);''')

sub('''module.exports._test = { decodeBundleKey, decodeBundleCrops, buildDiseaseBlocks, cropLabel, parseDeclaration, describeExport, fmtUtc, fmtLocal };''',
    '''module.exports._test = { decodeBundleKey, decodeBundleCrops, buildDiseaseBlocks, cropLabel, parseDeclaration, describeExport, fmtUtc, fmtLocal,
  accIncrementSeries, bestHourlyPerPeriod, rainQualityText, rainCoveragePct, rainPeriodOf };''')

out = s.replace("\n", "\r\n") if crlf else s
tmp = P + ".tmp_check.js"
open(tmp, "wb").write(out.encode("utf-8"))
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.remove(tmp)
if r.returncode: sys.exit("node --check: " + r.stderr)
open(P, "wb").write(out.encode("utf-8"))
print("ok · CRLF" if crlf else "ok · LF")
