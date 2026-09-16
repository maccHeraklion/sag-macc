# Testing runPerTich.js — Overview

This document describes how to develop, test, and validate the indicator
calculation functions inside `runPerTich.js` **without deploying to TagoIO**
or waiting for real sensor data.

---

## Architecture

```
analysis/
  runPerTich.js              # Production code — unchanged logic
                             # Has a TEST MODE EXPORTS block at the bottom
  package.json               # Local deps: moment-timezone, axios, @tago-io/sdk
  test/
    harness.js               # Test runner
    sdk-mock.js              # Minimal @tago-io/sdk stub (no network calls)
    scenarios/
      olive-summer.js        # Sample scenario: olive in hot dry summer
      <your-scenario>.js     # Add more here
  TEST_DATA_GUIDE.md         # How to write mock sensor data (field reference)
  TESTING.md                 # This file
```

---

## How it works

1. `harness.js` intercepts `require('@tago-io/sdk')` with a no-op stub.
2. Sets `RPERTICH_TEST_MODE=true`, which causes `runPerTich.js` to export its
   internal calculation functions instead of a `new Analysis(...)`.
3. Runs each scenario file in `test/scenarios/`, calling the calculation chain
   in the same order as the production analysis loop.
4. Prints a result summary and evaluates assertions.
5. Exits `0` if all assertions pass, `1` if any fail.

### Calculation order (mirrors production loop)

```
VPD         (hourTich)       — shared across crops
  └─ IPSI   (hourTich)       — per crop; consumes VPD + soil + leaf sensors
       └─ BPI (dailyTich)    — per crop; consumes IPSI daily avg + light + temps
GDD         (hourTich + dailyTich) — per crop; per pest base temperature
InfectionHours (hourTich)   — per crop; per fungal pathogen
  └─ FIR    (dailyTich)      — per crop; consumes GDD + InfectionHours + IPSI
IrrigationVolume (hourTich)  — per crop; consumes soil moisture + crop limits
```

Error propagation: if a sensor is missing, the error message bubbles from VPD →
IPSI → BPI. The actual missing sensor is always reported, not an intermediate
indicator name.

---

## Quick start

```sh
# 1. Install local dependencies (only needed once)
cd analysis
npm install

# 2. Run all scenarios
node test/harness.js

# 3. Run a single scenario
node test/harness.js test/scenarios/olive-summer.js
```

Expected output (all assertions passing):

```
════════════════════════════════════════════════════════════
Scenario: Olive (Koroneiki) — hot dry summer
          July fruit development day. High VPD, low soil moisture, no leaf wetness.
────────────────────────────────────────────────────────────
  VPD:              3.XXX kPa
  IPSI:             X.XX / 10
  BPI:              0.XXX
  GDD daily:
    bactrocera_oleae:  XX.XX
    ...
  FIR per pathogen:
    botrytis_cinerea:  0.0000
    ...
  Irrigation:       XXXX L  (X.XX h)

  ✓  VPD is present and > 2.0 kPa (hot dry air)
  ✓  No VPD sensor error
  ...

  ✓ N passed, 0 failed
════════════════════════════════════════════════════════════
TOTAL: N passed, 0 failed
```

---

## Regenerating / validating after changes to runPerTich.js

Whenever you modify a calculation function:

1. Run the harness and check that existing assertions still pass:
   ```sh
   cd analysis && node test/harness.js
   ```
2. If you changed the **formula** (not just a bug fix), update or add an
   assertion that captures the new expected range.
3. If you added a **new indicator variable**, add a scenario that exercises it
   and asserts its output range.
4. Deploy only after the harness exits `0`.

---

## Adding a new scenario

1. Copy `test/scenarios/olive-summer.js` as a starting point.
2. Set `cropParams.cultivation_type_general` and `cultivation_type` to the
   target crop (must exist in `CROP_PROFILE` in `runPerTich.js`).
3. Populate `measurements.data` with realistic sensor values.
   See `TEST_DATA_GUIDE.md` for the full field reference and typical ranges.
4. Define `assertions` that encode what you expect.
5. Run the harness — the new scenario runs automatically.

### Scenario ideas to add

| Scenario | Purpose |
|----------|---------|
| `vine-spring-wet.js` | High humidity + leaf wetness → plasmopara FIR should rise |
| `tomato-missing-soil.js` | Omit soil sensors → expect non-empty `ipsiError` |
| `wheat-winter-cold.js` | T < GDD base temp → daily GDD increment = 0 |
| `olive-saturated-soil.js` | soil_moisture at field capacity → irrigation = 0 |
| `generic-dailytich-only.js` | hourTich=false, dailyTich=true → verify BPI runs, VPD skips |

---

## For AI agents

- The test harness is a plain Node.js script. No test framework required.
- Assertions use plain `check(result) → boolean` functions — easy to generate.
- To add coverage for a new indicator function `calculate_X`:
  1. Verify it is exported in the `TEST MODE EXPORTS` block of `runPerTich.js`.
  2. Add a call to `fns.calculate_X(...)` in `runScenario()` in `harness.js`.
  3. Add it to the `printSummary()` function.
  4. Add a scenario with an assertion on the expected output range.
- The result object shape is documented in `TEST_DATA_GUIDE.md` under
  **Result object shape**.
- All sensor variables follow the TagoIO convention: arrays of `{ value: number }`.
  Scalars (24-h aggregates) are plain numbers.
