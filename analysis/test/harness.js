#!/usr/bin/env node
/**
 * runPerTich.js — local test harness
 *
 * Runs indicator calculation scenarios without a TagoIO connection.
 * The TagoIO SDK is replaced with a stub before the module is loaded.
 *
 * Usage:
 *   node analysis/test/harness.js                    # run all scenarios
 *   node analysis/test/harness.js scenarios/foo.js   # run one scenario
 *
 * For the test runner to work, two conditions must hold:
 *   1. node_modules are installed: cd analysis && npm install
 *   2. runPerTich.js has the TEST MODE EXPORTS block at the bottom
 *
 * Exit code: 0 = all pass, 1 = one or more assertions failed.
 */

'use strict';

const Module = require('module');
const path   = require('path');
const fs     = require('fs');

// ─── 1. Intercept @tago-io/sdk BEFORE requiring runPerTich ───────────────────
const sdkMockPath = path.join(__dirname, 'sdk-mock.js');
const originalLoad = Module._load.bind(Module);
Module._load = function interceptLoad(request, parent, isMain) {
  if (request === '@tago-io/sdk') {
    return require(sdkMockPath);
  }
  return originalLoad(request, parent, isMain);
};

// ─── 2. Enable test-mode exports ─────────────────────────────────────────────
process.env.RPERTICH_TEST_MODE = 'true';

// ─── 3. Load runPerTich (now exports calculation functions) ──────────────────
const fns = require('../runPerTich');

const REQUIRED_FNS = [
  'calculate_VPD', 'calculate_IPSI', 'calculate_BPI',
  'calculate_GDD', 'calculate_InfectionHours', 'calculate_FIR',
  'calculate_IrrigationVolume',
];
for (const name of REQUIRED_FNS) {
  if (typeof fns[name] !== 'function') {
    console.error(`ERROR: ${name} was not exported. Check the TEST MODE EXPORTS block in runPerTich.js.`);
    process.exit(2);
  }
}

// ─── 4. Collect scenario files ───────────────────────────────────────────────
const scenarioArg = process.argv[2];
let scenarioFiles;

if (scenarioArg) {
  const abs = path.isAbsolute(scenarioArg)
    ? scenarioArg
    : path.join(process.cwd(), scenarioArg);
  scenarioFiles = [abs];
} else {
  const dir = path.join(__dirname, 'scenarios');
  scenarioFiles = fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => path.join(dir, f));
}

if (scenarioFiles.length === 0) {
  console.log('No scenario files found. Add .js files to analysis/test/scenarios/.');
  process.exit(0);
}

// ─── 5. Run scenarios ─────────────────────────────────────────────────────────
let totalPassed = 0;
let totalFailed = 0;

for (const file of scenarioFiles) {
  const scenario = require(file);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Scenario: ${scenario.name}`);
  if (scenario.description) console.log(`          ${scenario.description}`);
  console.log('─'.repeat(60));

  let scenarioPassed = 0;
  let scenarioFailed = 0;

  try {
    const result = runScenario(fns, scenario);

    printSummary(result);

    if (Array.isArray(scenario.assertions) && scenario.assertions.length > 0) {
      console.log('');
      for (const assertion of scenario.assertions) {
        try {
          const ok = assertion.check(result);
          if (ok) {
            console.log(`  ✓  ${assertion.description}`);
            scenarioPassed++;
          } else {
            console.log(`  ✗  ${assertion.description}`);
            scenarioFailed++;
          }
        } catch (err) {
          console.log(`  ✗  ${assertion.description}  [threw: ${err.message}]`);
          scenarioFailed++;
        }
      }
    } else {
      console.log('  (no assertions defined — inspect output above)');
    }
  } catch (err) {
    console.error(`  SCENARIO ERROR: ${err.message}`);
    console.error(err.stack);
    scenarioFailed++;
  }

  totalPassed += scenarioPassed;
  totalFailed += scenarioFailed;
  const icon = scenarioFailed === 0 ? '✓' : '✗';
  console.log(`\n  ${icon} ${scenarioPassed} passed, ${scenarioFailed} failed`);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
console.log('═'.repeat(60));
process.exit(totalFailed > 0 ? 1 : 0);

// ─── Core runner ─────────────────────────────────────────────────────────────

/**
 * Run the full indicator calculation chain for a scenario.
 *
 * @param {object} fns         - exported functions from runPerTich
 * @param {object} scenario    - scenario definition (see TEST_DATA_GUIDE.md)
 * @returns {IndicatorResult}
 */
function runScenario(fns, scenario) {
  const { measurements, cropParams, ticks = {} } = scenario;
  const { hourTich = true, dailyTich = false } = ticks;

  // Shallow-clone measurements so infection hours injection doesn't mutate the scenario
  const meas = { ...measurements, data: { ...measurements.data } };

  // Step 1 — VPD (shared across crops for this field)
  const { vpdData, vpdError } = fns.calculate_VPD(hourTich, meas, cropParams);

  // Step 2 — IPSI (per crop; receives upstream VPD error for propagation)
  const { ipsi, ipsiError } = fns.calculate_IPSI(hourTich, meas, vpdData, cropParams, vpdError);

  // Step 3 — BPI (daily; receives upstream IPSI error for propagation)
  const { bpi, bpiIndicators, bpiContext, bpiError } =
    fns.calculate_BPI(dailyTich, meas, ipsi, cropParams, ipsiError);

  // Step 4 — GDD (hourly increment + daily accumulation)
  const gdd = fns.calculate_GDD(hourTich, dailyTich, meas, cropParams);

  // Step 5 — Infection hours (hourly; must run before FIR)
  const infectionHours = fns.calculate_InfectionHours(hourTich, meas, cropParams);

  // Inject infection hours back into measurements so FIR can read them
  for (const ih of (infectionHours || [])) {
    meas.data[ih.variable] = [{ value: ih.value }];
  }

  // Step 6 — FIR (daily field infection risk per pathogen)
  const fir = fns.calculate_FIR(dailyTich, meas, ipsi, cropParams);

  // Step 7 — Irrigation volume recommendation
  const irrigationVolume = fns.calculate_IrrigationVolume(hourTich, meas, ipsi, cropParams);

  return {
    vpd: vpdData,     vpdError,
    ipsi,             ipsiError,
    bpi,              bpiIndicators, bpiContext, bpiError,
    gdd,
    infectionHours,
    fir,
    irrigationVolume,
  };
}

/** Print a human-readable indicator summary to stdout. */
function printSummary(r) {
  const v = (arr, name) => arr?.find(x => x.variable === name)?.value;

  const fmt = (val, digits = 3) =>
    val === undefined || val === null ? 'N/A' : Number(val).toFixed(digits);

  console.log(`  VPD:              ${fmt(v(r.vpd, 'vpd'), 3)} kPa${r.vpdError ? `  [!] ${r.vpdError}` : ''}`);
  console.log(`  IPSI:             ${fmt(v(r.ipsi, 'ipsi'), 2)} / 10${r.ipsiError ? `  [!] ${r.ipsiError}` : ''}`);
  console.log(`  BPI:              ${fmt(v(r.bpi, 'bpi'), 3)}${r.bpiError ? `  [!] ${r.bpiError}` : ''}`);

  const gddDaily = (r.gdd || []).filter(x => x.variable.startsWith('gdd_daily_'));
  if (gddDaily.length) {
    console.log(`  GDD daily:`);
    for (const g of gddDaily) {
      console.log(`    ${g.variable.replace('gdd_daily_', '')}:  ${fmt(g.value, 2)}`);
    }
  }

  const firEntries = (r.fir || []);
  if (firEntries.length) {
    console.log(`  FIR per pathogen:`);
    for (const f of firEntries) {
      console.log(`    ${f.variable.replace('fir_', '')}:  ${fmt(f.value, 4)}`);
    }
  }

  const liters = v(r.irrigationVolume, 'grossIrrigationLiters');
  const hours  = v(r.irrigationVolume, 'irrigationDurationHours');
  console.log(`  Irrigation:       ${fmt(liters, 0)} L  (${fmt(hours, 2)} h)`);
}
