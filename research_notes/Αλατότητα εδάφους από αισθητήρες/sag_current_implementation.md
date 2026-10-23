# SAG: how soil salinity is currently computed and displayed (local repo, kernel v50.161)

Scope and method: a read-only review of the local clone (`sag-macc`, branch `main`). Nothing was run against TagoIO or the network. Kernel version string: `SAG_KERNEL_VERSION = 'v50.161 · 2026-10-14'` ([analysis/runPerTich.js:8](analysis/runPerTich.js)). Every "source" below is a repo-relative file path plus a line number. For the minified widget bundle, which has only 10 physical lines, the reference is the physical line plus a byte offset found with `grep -b`. The local files may differ from what is live on TagoIO, so treat these notes as describing the repo.

## 1. Parsers: which EC variables they emit, and in what units

### Takeaway
All three Dragino parsers pass the raw bulk soil EC through unchanged as `conduct_soil` / `conduct_soil1..4`. The stored number is always µS/cm, but the unit label differs: Greek "μS/cm" (SE01), micro-sign "µS/cm" (SE0X) and the wrong label "mS/m" (SE02). Only SE02 also computes a shadow pore-water EC (`pore_water_ec1/2`, `salt_diff_depth`), and neither the kernel nor the widget reads it.

### Cited Findings
- **SE01** (single probe): emits `soil_moisture` (%), `temp_soil` (°C) and `conduct_soil` = bytes 8–9 as an integer, labelled `'μS/cm'` — [payload_parsers/dragino_se01_parser.js:46-51](payload_parsers/dragino_se01_parser.js). A byte dump shows the "μ" is the Greek letter U+03BC (`316 274`), not the micro sign U+00B5.
- **SE0X** (multi-probe, up to 4 channels): emits `soil_temperature{ch}` (°C), `soil_moisture{ch}` (%) and `conduct_soil{ch}` = raw bytes, labelled `'µS/cm'` with the micro sign U+00B5. The comment reads "Raw bulk conductivity in µS/cm" — [payload_parsers/dragino_se0x_parser.js:84-94](payload_parsers/dragino_se0x_parser.js). Raw mode (`mod≠0`) emits `raw_dielectric_{ch}`, `raw_water_{ch}` and `raw_conduct_{ch}` — [dragino_se0x_parser.js:124-130](payload_parsers/dragino_se0x_parser.js).
- In SE0X ("Δρόμος Β", 8/9/2026), the in-parser Hilhorst chain was removed. It used SOIL_OFFSET 3.2, a fixed ε_w = 80 and an undocumented ×1000·(2/3) factor, and published `fertility_index{ch}`. A measured sample showed `conduct_soil1` = 292 µS/cm against `fertility_index1` = 3,364.5 (11.5×). The decision recorded in the file: "the parser measures; the kernel judges" — [dragino_se0x_parser.js:1-5, 96-121](payload_parsers/dragino_se0x_parser.js).
- **SE02** (two depths, KEK field): emits `soil_moisture1/2` (%), `soil_temperature1/2` (°C) and `conduct_soil1/2` = bytes 8–9 / 14–15, but labels the unit **`'mS/m'`** — [dragino_se02_parser.js:136-151](payload_parsers/dragino_se02_parser.js). The parser's own comment admits the stored value is really µS/cm and calls the 'mS/m' label a deliberate, known inconsistency that was never fixed — [dragino_se02_parser.js:58-65](payload_parsers/dragino_se02_parser.js).
- SE02 adds shadow variables `pore_water_ec1/2` (in µS/cm) and `salt_diff_depth` = p2 − p1, emitted only when both depths pass the gate — [dragino_se02_parser.js:155-171](payload_parsers/dragino_se02_parser.js). Its header says nobody reads them, neither the kernel nor the dashboard — [dragino_se02_parser.js:8-13](payload_parsers/dragino_se02_parser.js).
- SE02's `poreEC()` constants differ from the kernel's:
  - ε0 = 4.1, with a comment that 3.2 applies to sandy soils and 1.8 to organic ones.
  - MIN_MOISTURE_PCT = 15, and EC_MAX = 20000 µS/cm.
  - A **fixed** ε_w = 78.45 (water at 25 °C), justified by the claim that "Dragino gives the conductivity ALREADY referred to 25 °C ('with temperature compensate')".
  - A guard of ε > ε0 + **1.0**, where the kernel uses +0.1.
  - No second temperature correction.
  — [dragino_se02_parser.js:40-86](payload_parsers/dragino_se02_parser.js).
- A string search found zero occurrences of `pore_water_ec` in the widget bundle (`_dist-sagMain/index-7cbd9a4e.js`). Of the kernel's EC variables, the per-depth chain covers only channels 1 and 2 (`_SAG_EC_CHANNELS`) — [analysis/runPerTich.js:11189-11192](analysis/runPerTich.js).

### Inferences
- The same physical quantity (raw bulk EC in µS/cm) carries three different unit labels depending on the parser. The widget's conversion table keys on `"µS/cm"` (U+00B5), so the SE01 label (U+03BC) and the SE02 label (`mS/m`) do not match it. The kernel ignores the labels and assumes µS/cm, which matches the stored values.
- There are two independent Hilhorst implementations in the repo: the kernel's and SE02's shadow. They use different ε_w (temperature-dependent vs. fixed 25 °C) and different temperature handling, so they will disagree.

### Gaps
- Whether the live TagoIO parsers match these local files was not checked; network access was excluded by the brief.
- Whether the Dragino firmware actually reports EC already compensated to 25 °C is asserted only in an SE02 parser comment. The local repo contains no datasheet citation.

## 2. Kernel EC chain: `_sagEcChain`, its constants, and the per-depth outputs

### Takeaway
The kernel (T-ECCHAIN-01, v50.119) converts raw bulk EC into three quantities:
- `soil_ec_raw` (µS/cm), the raw bulk reading;
- `soil_ec_pore`, pore-water EC from Hilhorst 2000 with Topp 1980 permittivity and a 2 %/°C correction to 25 °C;
- `soil_ece`, estimated saturation-extract EC computed as σ_p·θ/θ_s, where θ_s comes from a soil-texture lookup table.

It suppresses output when θ ≤ 15 % and treats raw EC < 30 µS/cm in moist soil as a dead instrument.

### Cited Findings
- Design rationale: the parser does not know field, soil or crop, so the physics moved into the kernel. The parser's 2/3 factor was confirmed arbitrary by the owner on 7/9/2026 — [analysis/runPerTich.js:11099-11107](analysis/runPerTich.js).
- The three quantities as documented in the code: bulk EC depends on moisture; pore EC is "the water the root tastes" (Hilhorst 2000); EC_e is the only one comparable with Maas & Hoffman 1977 limits — [runPerTich.js:11109-11114](analysis/runPerTich.js).
- The cited formulas — [runPerTich.js:11116-11124](analysis/runPerTich.js):
  - Hilhorst 2000 SSSAJ 64:1922 Eq.14: σ_p = ε_p·σ_b/(ε_b − ε_0), with ε_0 = 4.1 "as average", valid for u > 0.10.
  - Topp 1980: ε = 3.03 + 9.3θ + 146θ² − 76.7θ³.
  - Permittivity of water: ε_w = 80.3 − 0.37(T − 20).
  - Correction to 25 °C: EC25 = EC_T/(1 + 0.02(T − 25)), per Rhoades et al. 1999 / FAO 48.
  - Dilution to saturation: EC_e = EC_pore·θ/θ_sat.
- Constants:
  - `_SAG_EC_EPS0 = 4.1` — [runPerTich.js:11125](analysis/runPerTich.js).
  - `_SAG_EC_MIN_VWC = 0.15`, chosen above Hilhorst's 0.10 because the denominator (ε_b − 4.1) is 2.0 at θ = 0.10 versus 4.8 at 0.15. The code's example: 1.0 dS/m bulk gives 38.9 dS/m pore EC at 12 % — [runPerTich.js:11126-11132](analysis/runPerTich.js).
  - `_SAG_EC_DEAD_US = 30` µS/cm, chosen empirically. In the 7/9/2026 fleet data, healthy readings ran 78–790 µS/cm and suspect ones were 14–17. The rationale given: 30 µS/cm at 20 % VWC gives 0.39 dS/m pore EC, which is implausible for Crete, where the stated range is 1–5 dS/m — [runPerTich.js:11133-11143](analysis/runPerTich.js).
- How `_sagEcChain(ecBulk_uS, vwc_pct, tC, sat_pct)` works — [runPerTich.js:11145-11183](analysis/runPerTich.js):
  1. bulk = µS/cm ÷ 1000, giving dS/m.
  2. A missing temperature defaults to 25 °C.
  3. ec25 = bulk/(1 + 0.02(T − 25)), applied only if the factor is > 0.2.
  4. If θ ≤ 0.15, it returns with `why` = "moisture below 15 % — Hilhorst does not apply".
  5. ε_b comes from Topp. If ε_b ≤ 4.2, it returns "permittivity too low".
  6. pore = ε_w(T)·ec25/(ε_b − 4.1).
  7. If θ_s is missing, it returns pore only, with `why` = "no soil texture — EC_e not computed".
  8. Otherwise ece = pore·θ/θ_s.
- **Where θ_s comes from**: `SOIL_PROFILE[key].hydraulics.saturation` (% v/v, citing Rawls 1982). Values: sand 39, then 40, 42, 45, 49, 48, 44, 50, 49, 43, 52, 51, and calcareous_clay 52 — [runPerTich.js:4490-4512, 4886-4900](analysis/runPerTich.js); grep hits for `saturation:` at 4509, 4540, 4571, 4605, 4636, 4667, 4701, 4732, 4763, 4797, 4828, 4859, 4893. The key is resolved by `_sagSoilKeyOf`, which tries `soil_texture_class` first, then `soil_type`, `soil_profile` and `soil`. Legacy group keys alias to group representatives (sandy→sandy_loam and so on) — [runPerTich.js:4905-4931](analysis/runPerTich.js).
- **Per-depth outputs** (`_sagEcIndicators`, field level, called once per field with the tolerance of the most sensitive crop via `_sagEcFieldTol`) — [runPerTich.js:11340-11463](analysis/runPerTich.js); call site [runPerTich.js:19800-19802](analysis/runPerTich.js):
  - **Channels**: if any `conduct_soil1/2` exists, the bare `conduct_soil` is ignored as a duplicate. Otherwise it is used with `soil_moisture` / `temp_soil` — [11365-11369](analysis/runPerTich.js).
  - **Dead-instrument gate** (θ > 15 % and raw < 30): emits `soil_ec_raw{n}` (µS/cm) and `soil_ece{n}` = null with an explanatory text, and adds the channel to `_deadCh` — [11376-11393](analysis/runPerTich.js).
  - `soil_ec_raw{n}` = the unmodified instrument value, `unit: 'µS/cm'`, with no text. It is described as the only value comparable with a handheld meter pushed into the same soil — [11400-11409](analysis/runPerTich.js).
  - `soil_ec_pore{n}` = pore EC to 2 decimals, `unit: 'dS/m'`, emitted when it is non-null — [11410-11415](analysis/runPerTich.js).
  - `soil_ece{n}` = ECe to 2 decimals, `unit: 'dS/m'`, colour always grey (T-ECVERDICT-01, v50.142: instantaneous, no verdict colour). It carries metadata `tol` = the crop limit as a number (T-ECTOL-01). Its text reads "Instrument X dS/m … Νερό ρίζας Y. In saturation extract Z dS/m, limit L (instantaneous — the verdict is made once a day…)" — [11416-11439](analysis/runPerTich.js).
  - `soil_salinity_status`: "Το όργανο δεν μετράει" if any channel is dead. Otherwise "Στιγμιαία ένδειξη" (grey), carrying the worst ECe across channels and a calibration guide: "Instrument reading ↔ handheld IN SOIL · Pore water ↔ meter in LIQUID (drainage) · Salinity ↔ saturation extract" — [11441-11460](analysis/runPerTich.js).
  - `_bad` / `_warn` (ECe > tol, ECe > 0.8·tol) are computed at [11423-11424](analysis/runPerTich.js) but no longer used, since the colour is always grey.
- Since T-ECFIELD-01 these keys live in the bundle's `shared` section. Any copies left in crop boxes are deleted (`_SAG_EC_MOVED`) — [runPerTich.js:13791-13803](analysis/runPerTich.js).
- Time series: `soil_ece1/2`, `soil_ec_pore1/2`, `soil_ec_ref1/2`, `soil_ec_ratio` and `soil_ec_conc` are written as series. Null values are explicitly **not** written, so as not to fake zeros — [runPerTich.js:14292-14306](analysis/runPerTich.js).
- Multi-device fields: `conduct_soil*` from several devices is combined as a **running mean** before the chain. A divergence flag `_sagDivergeEc` is set when hi/lo ≥ 2.5 and hi ≥ 200 µS/cm — [runPerTich.js:14530-14540](analysis/runPerTich.js); constants `_SAG_EC_DIVERGE_RATIO = 2.5` and `_SAG_EC_DIVERGE_MIN = 200` at [runPerTich.js:15608-15609](analysis/runPerTich.js).

### Inferences
- Temperature is handled twice: the 2 %/°C division plus a temperature-dependent ε_w. This is internally consistent only if the probe reports **uncompensated** EC. The SE02 parser comment claims Dragino already reports EC at 25 °C ([dragino_se02_parser.js:47-57](payload_parsers/dragino_se02_parser.js)). If that claim is true, the kernel double-corrects for temperature. A fleet-statistics attempt (4/10/2026) could not settle this. Only 1 of 47 channels gave a stable slope, and the kernel was left at 2 %/°C for all probes (per the project memory note `ec-tempcomp-not-measurable`, which refers to `analysis/ΕΛΕΓΧΟΣ/ΚΑΤΑΤΑΞΗ_ΣΟΝΔΩΝ_EC_2026-10-04.md`). This is an open issue, not a confirmed bug.
- ε_b is computed by Topp from the **probe-reported VWC**, which the probe itself derived from its own permittivity reading. The kernel therefore inverts one generic calibration to recover a quantity the probe measured directly. SE0X/SE02 raw mode exposes the dielectric constant, but the kernel does not use it.
- ε_0 = 4.1 applies to every soil. SE02's own comment notes 3.2 for sandy and 1.8 for organic soils.
- The ECe = σ_p·θ/θ_s dilution assumes conservative salts, with no dissolution or precipitation between field moisture and saturation. Many Cretan soils are calcareous or contain gypsum, and θ_s is a texture-class table value, not a measurement.

### Gaps
- No validation of `_sagEcChain` against lab saturation-extract ECe exists in the files reviewed.
- The tolerance or uncertainty of the Topp/Hilhorst steps is not propagated anywhere in the code.

## 3. Daily reference (`_sagEcRefIndicators`) and daily verdict (`_sagEcDailyVerdict`)

### Takeaway
Once a day the kernel takes, for each depth, the pore-water EC of the **driest sample** in the 24 h window as a "pre-irrigation reference" (`soil_ec_ref1/2`). It judges accumulation from the ratio of the worst depth's reference to the declared fertigation EC, using provisional bands 0.7 / 1.5 / 2.0. Two things override that ratio verdict: a plausibility guard on the declared EC values, and the crop's ECe limit.

### Cited Findings
- **Reference (T-ECREF-01, v50.141)**: hourly runs keep `ec_ref_state`, which holds, per channel, the sample with minimum θ (θ, σ_w and T from the same sample). On the daily tick (00:20→00:20 UTC) it emits `soil_ec_ref{n}` = σ_w of the driest sample (dS/m), with text "Pore water (depth) at the driest sample of the 24 h…", and then resets the window. Further rules — [runPerTich.js:11193-11249](analysis/runPerTich.js):
  - The ref chain is called with `sat = NaN`, because θ_s is not needed for σ_w.
  - A dead instrument contributes no sample.
  - The first window, with no previous state, emits nothing.
- The ref series has a daily TTL (`/^soil_ec_ref/ → _SAG_TTL_DAILY_H`), and `ec_ref_state` / `ec_ref_hist` are immortal internal state — [runPerTich.js:13473, 13537](analysis/runPerTich.js).
- **Verdict (T-ECRATIO-01 + T-ECVERDICT-01, v50.142)**, documented at [runPerTich.js:11251-11264](analysis/runPerTich.js) and implemented at [runPerTich.js:11265-11334](analysis/runPerTich.js):
  - **Basis**: the pre-irrigation reference, not the instantaneous bulk EC, because "one irrigation = false accumulation" (audit 18/9, K15).
  - **Dead instrument** (`a.dead`): `soil_ec_status` = "Το όργανο δεν μετράει" and `salinity_stress` = "Μη διαθέσιμο", both grey — [11268-11274](analysis/runPerTich.js).
  - `refF = max(ref1, ref2)`, commented "worst depth" — [11275-11277](analysis/runPerTich.js).
  - **Trend**: an `ec_ref_hist` ring holds one value per day for 8 days. With at least 6 values, the trend is the mean of the last 3 versus the previous 3, in % — [11279-11288](analysis/runPerTich.js).
  - Every status text gets the suffix `' ⚠ Μη βαθμονομημένο όργανο.'` ("uncalibrated instrument") — [11289, 11332](analysis/runPerTich.js).
  - **Guard**: lo = min(fert, ecw) and hi = max(fert, ecw), with hi set only when fert is declared. If refF < 0.7·lo or refF > 2·hi, then `soil_ec_ratio` = null with an orange "check EC declarations" message, and the status becomes "Ελέγξτε τις δηλώσεις EC" (orange) — [11290-11299, 11311-11314](analysis/runPerTich.js).
  - **Ratios**: `soil_ec_ratio` = refF/fert with a zone label, and `soil_ec_conc` = refF/ecw ("CF"), both unitless — [11300-11305](analysis/runPerTich.js).
  - **Status bands** — [11307-11325](analysis/runPerTich.js):

    | Condition | Status | Colour |
    |---|---|---|
    | No reference | "Αναμονή αναφοράς" | grey |
    | No fertigation EC declared | "Χωρίς δήλωση λίπανσης" | grey |
    | R < 0.7 | "Χωρίς συσσώρευση" (nutrients leaching, reduce leaching) | green |
    | 0.7 ≤ R < 1.5 | "Χωρίς συσσώρευση" | green |
    | 1.5 ≤ R < 2 | "Παρακολούθηση" | orange |
    | R ≥ 2 | "Συσσώρευση αλάτων" (leach with plain water) | red |

  - The bands are labelled **provisional**: "Phase A plan §A4, OK Michalis 19/9, revision on 14-day acceptance" — [11256-11258, 11260](analysis/runPerTich.js).
  - **Crop-limit override**: if `eceEst > eceMax`, the status becomes "Πάνω από το όριο της καλλιέργειας" (red), with "→ leaching with good-quality water; laboratory confirmation" — [11326-11331](analysis/runPerTich.js).
- **Call site (daily tick only)** — [runPerTich.js:18465-18571](analysis/runPerTich.js):
  - `fert` = `fieldConfig.fert_ecw_dsm` and `ecw` = `fieldConfig.water_ecw_dsm`, each accepted only within 0.05–15 dS/m.
  - `eceMax` = the minimum `max_tolerance_ECe` over the field's crops.
  - The dead-instrument flag is recomputed for each pair (`conduct_soil1/soil_moisture1`, `conduct_soil2/2`, bare) — [18564-18566](analysis/runPerTich.js).
- **Ordering**: the ref function runs before the daily block, so the verdict sees today's reference. If none was emitted today, it falls back to the previous bundle's `soil_ec_ref{n}` — [18465-18467, 18557-18561](analysis/runPerTich.js).
- A legacy `ec_hist` (8 days of raw e1/e2/pH) is still maintained, but its trends "no longer judge" — [18478-18488, 18551-18553](analysis/runPerTich.js).
- The bundle shield protects `soil_ec_status` and `salinity_*` from being dropped when the bundle is trimmed for size — [runPerTich.js:13984, 14033, 14074-14107](analysis/runPerTich.js).

### Inferences
- The ratio verdict uses the pre-irrigation reference (σ_w at minimum θ), but the crop-limit override and Ks use the **instantaneous** ECe from whatever sample is current at the daily tick (`_eceW`, see §4). The two parts of the same verdict therefore rest on different sampling bases.
- The ratio compares pore-water EC with fertigation-solution EC. This is a concentration factor, not an ECe, and its bands are explicitly provisional.

### Gaps
- No record was found in these files of whether the provisional bands were revised after the 14-day acceptance period.

## 4. Worst-depth logic (T-ECWORST-01), the ×2.5 fallback and divergence suspension

### Takeaway
Since v50.155 the daily verdict and Ks use the higher of the shallow and deep ECe, with no weighting by root depth or sensor depth. If the shallow chain fails for any reason, the code falls back to bulk EC × 2.5, and that value is then labelled as if moisture were missing. If co-located probes disagree by 2.5× or more, the verdict is suspended.

### Cited Findings
- `_eceChain` = `_sagEcChain(e1, …)`, using the moisture and temperature that match the channel e1 came from (numbered or bare). θ_s comes from `SOIL_PROFILE[_sagSoilKeyOf(fieldConfig)].hydraulics.saturation` — [runPerTich.js:18499-18511](analysis/runPerTich.js).
- **The ×2.5 fallback**: `_eceEst(uS)` returns the chain value only if the chain succeeded **and** the argument equals e1; otherwise it returns `(uS/1000)*2.5`. The label `_eceHow` says "(ενδεικτικά ×2,5 — λείπει μέτρηση υγρασίας)" ("indicative ×2.5 — moisture measurement missing"). The comment justifies keeping it so that a field is never left without any estimate — [runPerTich.js:18512-18526](analysis/runPerTich.js).
- **T-ECWORST-01** ("εντολή Μιχάλη 24/9"; the Koutsakis example: shallow 1.2 / deep 2.0, limit 2.5) — [runPerTich.js:18527-18531](analysis/runPerTich.js):
  - `_eceChain2` is computed only when numbered channels exist.
  - `_eceW` = deep if it is non-null and greater than shallow (or shallow is null); otherwise shallow if non-null; otherwise the ×2.5 estimate of e1.
- **Divergence suspension** (T-DIVERGENCE-EC-01): if `measurements.data._sagDivergeEc` is non-empty, `soil_ec_status` = "Σε αναστολή — τα όργανα διαφωνούν" (grey) and neither the verdict nor Ks is emitted — [runPerTich.js:18538-18550](analysis/runPerTich.js). The flag is set during the multi-device merge at a ratio ≥ 2.5 with hi ≥ 200 µS/cm — [runPerTich.js:14530-14538, 15608-15609](analysis/runPerTich.js).

### Inferences
- The ×2.5 fallback fires whenever `_sagEcChain(e1).ece` is null, which happens when:
  - θ ≤ 15 % (dry soil);
  - the soil texture key is missing or unknown, so θ_s is NaN;
  - ε_b is too low;
  - moisture is truly missing.

  In all of these cases the text says "moisture measurement missing", which is wrong for the first two. The ×2.5 is also applied to bulk EC that is **not** temperature-corrected, and is used in exactly the dry-soil conditions the chain declared invalid. The resulting estimate can still trigger the red "above crop limit" override and a Ks < 1.
- Worst-depth = max(ECe1, ECe2), and the ratio verdict likewise uses max(ref1, ref2). Neither looks at `_sagRootDepthMm` or the sensor depths. A deep sensor sitting below the active root zone, or a salt bulge at the leaching front, can drive the field verdict. Soil moisture, by contrast, uses FAO root-zone weighting (§6).
- With multiple devices, EC and moisture are averaged separately before the non-linear chain is applied. The chain of the averages is not the average of the chains.

### Gaps
- None of the code reviewed checks whether the deep sensor is inside or outside the root zone.

## 5. `salinity_ks` / `salinity_stress`, the effect on the irrigation dose, and crop limits

### Takeaway
Ks is the Maas–Hoffman linear decline from FAO-56 Eq. 83, using the worst-depth ECe and a slope b chosen by tolerance class, not by crop. It is used **only in message text and colour**, not in ETc or the dose. Salinity affects the irrigation dose only through a leaching requirement computed from the declared or class-default **irrigation-water ECw**. Measured soil EC never changes the dose.

### Cited Findings
- **Ks (T-SALT-KS-01)** — [runPerTich.js:18573-18600](analysis/runPerTich.js):
  - It is computed only when eceMax is finite, e1 is non-null and the instrument is not dead.
  - b = 14 if eceMax < 1.5, 10 if < 3, 7 if < 6, otherwise 4 (%/dS·m). The comment calls this "representative value of the FAO-29 tolerance category".
  - Ks = 1 − b(ECe − ECe_max)/100 above the limit, clamped to 0–1.
  - Outputs: `salinity_ks` (internal, 3 decimals) and `salinity_stress` = "Καμία" (≥ 0.995), "Ήπια" (≥ 0.9, green), "Μέτρια" (≥ 0.75, orange) or "Σοβαρή" (red), plus " — εκτίμηση −X%". The text advises leaching with good-quality water, "NOT simply more water of the same quality".
- **How Ks is used downstream**: the previous day's `salinity_ks` is read back from the bundle — [runPerTich.js:13095-13097](analysis/runPerTich.js). It is used only in `_sagStressWhy`, which adds "osmotic pressure from salts (−X%)" when Ks < 0.9 — [13084-13087](analysis/runPerTich.js). It also turns an "Ιδανικό" (ideal) `plant_stress` card yellow, with a pointer to the salinity card, when Ks < 0.75 — [13152](analysis/runPerTich.js). Lines [13154, 13209, 13214](analysis/runPerTich.js) cover the remaining uses. No other use of `salinity_ks` / `_ksNow` was found by grep.
- **Leaching requirement in the dose** — [runPerTich.js:7973-8025](analysis/runPerTich.js):
  - `ece_max` = the crop's `max_tolerance_ECe`.
  - `ecw` = form `water_ecw_dsm` if it is within 0.05–15, otherwise `WATER_PROFILE[water_quality].waterECw`.
  - LR = min(ECw/(5·ECe_max − ECw), 1). If 5·ECe_max ≤ ECw, irrigation is blocked ("ΑΚΑΤΑΛΛΗΛΟ ΝΕΡΟ").
  - `grossIrrigationLiters = target·(1 + LR)/efficiency`.
  - The dashboard basis card reports "ECw μετρημένη" (measured) or "ECw τυπική" (typical) — [8146-8151](analysis/runPerTich.js).
- `WATER_PROFILE` class defaults: excellent 0.5, good 1.2, marginal 2.2, poor 3.5 dS/m — [runPerTich.js:4935-4959](analysis/runPerTich.js).
- **Crop `max_tolerance_ECe` values (dS/m)**, by CROP_PROFILE line:

  | Group | Crop: ECe limit [line] |
  |---|---|
  | Olive | koroneiki 2.7 (lowered from 4.7 in v50.140, citing Maas–Hoffman/FAO-29) [365] |
  | Vines | wine_grapes 1.2 [397]; table_grapes 1.5 (was 2.0) [414]; raisin_grapes 1.8 [431] |
  | Cereals | wheat 6.0 [451]; barley 8.0 [468]; maize 1.7 [485]; oats 4.0 [502] |
  | Citrus | orange, lemon, mandarin 1.7 each [522, 539, 556] |
  | Stone fruit | peach 1.7 [576]; nectarine 1.6 [593]; apricot 2.0 [610]; plum 1.9 [627]; cherry 1.4 [644] |
  | Pome | apple 1.8 [664] |
  | Subtropical | kiwi 1.2 [684]; pomegranate 3.5 [701]; fig 2.8 [718] |
  | Nuts | almond 2.8 [738]; pistachio 4.2 [755]; walnut 1.5 [772]; chestnut 1.0 [789] |
  | Industrial | cotton 7.7 [809]; tobacco 2.0 [826]; sunflower 4.8 [843]; sugar_beet 7.7 [860] |
  | Vegetables | onion 1.2 [880]; watermelon 2.2 [897]; potato 1.7 [914]; dry/green beans 1.0 [931, 948]; faba 1.6 [997]; cabbage 1.8 [1015]; lettuce 1.3 [1032]; carrot 1.0 [1049]; cucumber 2.5 [1069]; tomato 2.5 [1087]; eggplant 1.5 [1105]; pepper 1.5 [1123]; strawberry 1.0 [1141]; garlic 1.2 [1159]; zucchini 2.0 [1177]; melon 2.2 [1195]; broccoli 2.8 [1213] |
  | Mediterranean specialties | saffron 2.5 [1233]; mastic 5.0 [1250]; oregano 3.2 [1267]; thyme 3.8 [1284]; rosemary 4.2 [1301]; sage 3.5 [1318]; mint 2.0 [1335]; bay laurel 4.2 [1352]; currants 1.0 [1369]; carob 4.8 [1386]; artichoke 5.3 [1403] |
  | Ornamentals | floriculture_generic 1.5 [1424] |

  Source: [analysis/runPerTich.js](analysis/runPerTich.js). There is no per-crop slope b field; the slope comes only from the class rule at line 18577.

### Inferences
- The measured soil salinity chain never feeds back into the water balance or the litres. This agrees with the project memory note `fao56-what-actually-uses-what`, which says only the form's ECw moves the dose.
- The gross-dose expression `target·(1+LR)/eff` differs from the common `net/(1−LR)` form. Our understanding of the usual FAO-29 practice is that `(1+LR)` under-states the dose as LR grows. This is an inference: the code does not cite which form it intends.
- The leaching requirement uses only the irrigation-water ECw. Neither `fert_ecw_dsm` (the fertigation solution, which is what actually reaches the drip line) nor measured soil ECe enters it.
- Ks with a class-based b is coarse. For example, every crop with a limit between 1.5 and 3 gets b = 10, although published slopes inside that range differ. Treat this as an inference to check against FAO-29 Table 4.

### Gaps
- The `max_tolerance_ECe` values were not checked against FAO-29 here; that belongs to another researcher's scope. Some entries carry FAO-29 comments (olive, table grapes, orange, lemon); most do not.

## 6. Root-depth functions and whether salinity uses them

### Takeaway
`_sagRootDepthMm` and `_sagRootZoneMoisture` give soil moisture a FAO-56 40-30-20-10 root-zone weighting across the two sensor depths. **None of the salinity code uses them.**

### Cited Findings
- `_SAG_FAO_EXTRACTION = [0.40, 0.30, 0.20, 0.10]` ("FAO-56 §7, per quarter of depth") — [runPerTich.js:10953](analysis/runPerTich.js).
- `_sagRootDepthMm`: reads the crop's `root_depth_curve` at the current stage key, falling back to full_canopy, then initial, then 200 mm — [runPerTich.js:11032-11040](analysis/runPerTich.js).
- `_sagSensorDepthCm`: reads the form keys `sensorShallow_depth_cm` / `sensor_deep_depth_cm` first, then aliases, with defaults of 20/50 cm (T-DEPTHNAME-01) — [runPerTich.js:11042-11056](analysis/runPerTich.js).
- `_sagRootZoneMoisture`: assigns each quarter of the root depth to the nearer sensor and sums the extraction weights. It returns the weighted value, the weights, the depths, divergence and a "basis" text — [runPerTich.js:11058-11097](analysis/runPerTich.js). It is used for irrigation and the root-zone indicators — [7438, 11569, 11908, 19355](analysis/runPerTich.js). The same logic appears for 24 h means in `_sagRootZone24h` — [10978-10995](analysis/runPerTich.js).
- The salinity functions (`_sagEcChain`, `_sagEcIndicators`, `_sagEcRefIndicators`, `_sagEcDailyVerdict`, and the T-ECWORST block at 18465-18600) reference none of `_sagRootDepthMm`, `_sagSensorDepthCm`, `_sagRootZoneMoisture` or `_SAG_FAO_EXTRACTION` (verified by reading [11145-11463](analysis/runPerTich.js) and [18465-18600](analysis/runPerTich.js)).

### Inferences
- Moisture is judged on a root-zone-weighted basis, while salinity is judged on worst-depth max. The same two sensors are interpreted with two different spatial models.

### Gaps
- None.

## 7. Widget (`_dist-sagMain/index-7cbd9a4e.js`): the salinity card, the status card, labels, units and formatting

### Takeaway
The sidebar tile for `conduct_soil1/2` is **replaced** by a "🧂 Αλατότητα εδάφους Ρηχό/Βαθύ" card. Its main value is the instantaneous `soil_ece` in "X,XX dS/m", with a sub-line "νερό ρίζας X,XX · όργανο N µS/cm". The daily verdict (`soil_ec_status`) and `salinity_stress` appear only in an alerts list, and only when their colour is orange or red. `soil_ec_ref`, `soil_ec_ratio` and `soil_ec_conc` are subscribed to but never rendered.

### Cited Findings
- **Variable labels and unit families** (physical line 1):

  | Variable(s) | Label | Unit family |
  |---|---|---|
  | `conduct_soil`, `conduct_soil1`–`4` | "🌾 Αγωγιμότητα εδάφους (Ρηχό/Βαθύ/3/4)" | `H.conductivity` |
  | `soil_ece`, `soil_ece1/2` | "🧂 Αλατότητα εδάφους (Ρηχό/Βαθύ)" | `H.salinity` |
  | `soil_salinity_status` | "🧂 Κατάσταση αλατότητας" | — |
  | `soil_ec_raw*` | "🔬 Ένδειξη οργάνου (Ρηχό/Βαθύ) (ακατέργαστη)" | `H.conductivity` |
  | `soil_ec_pore*` | "💧 Αγωγιμότητα νερού πόρων (Ρηχό/Βαθύ)" | `H.salinity` |

  Source: [_dist-sagMain/index-7cbd9a4e.js line 1](_dist-sagMain/index-7cbd9a4e.js).
- **Unit families**: `conductivity` has defaultUnit **"mS/cm"**, with conversions `"µS/cm": t=>t`, `"mS/cm": t=>t/1e3`, `"dS/m": t=>t/1e3`. `salinity` has defaultUnit **"dS/m"**, with conversions `"dS/m": t=>t`, `"mS/cm": t=>t`, `"µS/cm": t=>t*1e3` — [index-7cbd9a4e.js line 1](_dist-sagMain/index-7cbd9a4e.js), in the `conductivity:{defaultUnit:"mS/cm"…}` block.
- A second label table (the device-measurements list) says `conduct_soil1: "Αγωγιμότητα εδάφους ρηχά (µS/cm)"` and the same for `conduct_soil2` "βαθιά", even though the conductivity family's default display unit is mS/cm — [index-7cbd9a4e.js line 2, byte ≈48200-48460](_dist-sagMain/index-7cbd9a4e.js).
- **Salinity card helper** `sagEceCard(vn)` — [index-7cbd9a4e.js line 2, byte ≈24554-25740](_dist-sagMain/index-7cbd9a4e.js):
  - It matches `/^conduct_soil([1-4]?)$/` and reads `soil_ece{q}` from `sagEceBox` (the merged latest values, set by `sagEceSet(n)` at line 10, byte ≈15190).
  - If ECe is null: it returns `{t:null, v:null, sub: reason}`, where the reason is parsed from the text after "Χωρίς συγκρίσιμη τιμή: ". The tile then keeps its conductivity title and value, with the reason as the sub-line.
  - Otherwise: title `"🧂 Αλατότητα εδάφους" + " Ρηχό"/" Βαθύ"`, value `sagEceF9(e9,2)+" dS/m"` (el-GR, exactly 2 decimals), sub-line `"νερό ρίζας " + pore (2 dp)` and `"όργανο " + raw (0 dp) + " µS/cm"` joined with " · ".
- The card is used in both measurement grids: the main sidebar (`_E9=sagEceCard(j)`, line 2 byte ≈83702) and the per-device grid (line 2 byte ≈93043). The sub-line is drawn at fontSize 11 and opacity 0.75 — [index-7cbd9a4e.js line 2, byte ≈83950-84400](_dist-sagMain/index-7cbd9a4e.js).
- **Click-through chart**: clicking `conduct_soil1/2` opens the `soil_ece1/2` history, titled "🧂 Αλατότητα εδάφους Βαθύ/Ρηχό — device", in unit "dS/m". When the metadata has `tol`, a dashed horizontal line labelled "Όριο καλλιέργειας" ("crop limit") is drawn — [index-7cbd9a4e.js line 10, byte ≈35976-36700](_dist-sagMain/index-7cbd9a4e.js).
- **Status / alerts card**: a list of `[key, label]` pairs includes `["salinity_stress","Άλατα στο έδαφος"]`, `["soil_ec_status","Αλατότητα εδάφους"]` and `["soil_depth_divergence",…]`. Rows are kept only when the colour is **not "green" and not "grey"** — [index-7cbd9a4e.js line 10, byte ≈62200-62900](_dist-sagMain/index-7cbd9a4e.js). This is the only occurrence of `soil_ec_status` and of `salinity_stress` in the bundle; each string occurs once.
- **Subscriptions without rendering**: `soil_ece1/2`, `soil_ec_pore1/2`, `soil_ec_ref1/2`, `soil_ec_ratio` and `soil_ec_conc` appear in the realtime variable list `Ra` — [line 2 byte ≈121700-122100](_dist-sagMain/index-7cbd9a4e.js). `soil_ec_ref` occurs only there (2 occurrences). `soil_ec_ratio` and `soil_ec_conc` occur once each, only there. `salinity_ks` occurs 0 times and `pore_water_ec` 0 times.
- The bundle contains no "εργαστ" (laboratory) string; there is no calibration UI.

### Inferences
- **"Νερό ρίζας"** ("root water") is the widget and kernel label for σ_p (pore-water EC at one probe's depth, from a generic Hilhorst/Topp model). It is not a root-zone quantity and not a measured soil-solution sample. The daily verdict also uses "Νερό ρίζας" for max(ref1, ref2).
- The same label "Αλατότητα εδάφους" names two different things: the **instantaneous ECe tile** in the sidebar and the **daily verdict row** in the alerts card. Only the tile is always visible.
- Grey and green states are never shown in the alerts list. These include "Αναμονή αναφοράς", "Χωρίς δήλωση λίπανσης", "Σε αναστολή — τα όργανα διαφωνούν", "Το όργανο δεν μετράει" (grey) and "Χωρίς συσσώρευση" (green), together with the appended "⚠ Μη βαθμονομημένο όργανο". A farmer or agronomist therefore sees no suspension, dead-instrument or uncalibrated notice through `soil_ec_status`. The dead-instrument case still reaches the tile through the null-ECe reason text.
- Formatting implies more precision than the method has: 2 fixed decimals in dS/m for ECe and pore EC, and no ± or uncertainty band anywhere.
- The units are mixed on screen. Raw bulk EC is shown as µS/cm in the tile sub-line, and the device label also says (µS/cm), but the conductivity family's default display unit is mS/cm. ECe and pore EC are in dS/m.

### Gaps
- The bundle is hand-patched and minified, so byte offsets are approximate locators, not stable line numbers.
- The widget's per-dashboard settings are not in git (per the project memory note `dashboard-config-audit-2026-10-14`), so which tiles each dashboard actually shows could not be checked locally.

## 8. Form `custom_html_files/configuration.html`: salinity-related inputs

### Takeaway
The agronomist enters the soil texture, a water-quality class, an optional measured ECw of the irrigation water, an optional measured EC of the fertigation mix at the dripper (each with a measurement date), and the two sensor depths. There is no field for a lab soil analysis (ECe, saturation percentage, θ_s), a per-probe calibration factor or offset, or the soil's ε_0.

### Cited Findings
- **Soil type**: `<select id="soil_type">`, hint "determines how much water the field holds" — [configuration.html:326-330](custom_html_files/configuration.html). It is saved as `soil_texture_class` (the USDA fine texture), with `SOIL_GROUP_DEFAULT` mapping legacy groups — [configuration.html:984, 2170-2173, 2603-2604](custom_html_files/configuration.html).
- **Water quality class**: `<select id="water_quality">` — [configuration.html:337-340](custom_html_files/configuration.html). This maps to `WATER_PROFILE` in the kernel.
- **Sensor depths**: `sensor_deep_depth_cm` ("Βάθος Αισθητήρα (Βαθύ) (cm)", placeholder 30) and `sensorShallow_depth_cm` ("Ρηχό", placeholder 10) — [configuration.html:507-514](custom_html_files/configuration.html). The kernel defaults are 20/50 cm when these are blank — [runPerTich.js:11055](analysis/runPerTich.js).
- **Collapsible "Αλατότητα νερού — αν έχεις ανάλυση"** ("water salinity — if you have an analysis") — [configuration.html:520-548](custom_html_files/configuration.html):
  - `water_ecw_dsm`: "EC νερού άρδευσης / έκπλυσης (dS/m) — αυτή μπαίνει στον υπολογισμό έκπλυσης" (this one goes into the leaching calculation), with hint "if the analysis gives μS/cm, divide by 1,000". Plus a date, `water_ecw_measured_on`.
  - `fert_ecw_dsm`: "EC μείγματος λίπανσης στον σταλάκτη (dS/m)" (EC of the fertigation mix at the dripper), with "leave blank if no fertigation". Plus a date, `fert_ecw_measured_on`.
  - A comment notes that form v19 (18/9/2026, Phase A step 1) added these keys — [530-532](custom_html_files/configuration.html).
- Saved keys — [configuration.html:2231, 2234, 3042-3043](custom_html_files/configuration.html).
- **Unit sanity rules** (`_SAG_UNIT_RULES`), with "the same limits as the kernel" — [configuration.html:2350-2389](custom_html_files/configuration.html):
  - A value between 50 and 15000 is suggested as µS/cm, with a "use v/1000" button.
  - Below 0.05 gives a warning.
  - Between 15 and 50 gives an "ambiguous unit" warning.
- The measurement dates are stored but not read by any kernel code found by grep. `water_ecw_measured_on` / `fert_ecw_measured_on` do not appear in [analysis/runPerTich.js](analysis/runPerTich.js); grep for `ecw` in the kernel hit only lines 7984-8151, 11291-11313 and 18569.

### Inferences
- The kernel has no way to take a laboratory ECe of the soil (or a paired handheld reading) and correct the probe chain. The only calibration aid is the text guide inside `soil_salinity_status` ([runPerTich.js:11456-11459](analysis/runPerTich.js)), and the widget has no dedicated render path for that.
- The age of an ECw or fertigation-EC declaration is recorded but never used, for example to warn that a measurement is stale.

### Gaps
- It was not checked whether any dashboard's live form version differs from the local `configuration.html`.

## 9. Concrete weaknesses and inconsistencies (summary for the comparison report)

### Takeaway
The pipeline is carefully guarded against false greens (dead-instrument gate, θ ≥ 15 % gate, divergence suspension, provisional verdict bands). Its main weaknesses:
- generic, uncalibrated physics with no lab hook;
- inconsistent units and labels;
- a misleading "νερό ρίζας" name;
- worst-depth logic that ignores the root zone;
- a mislabelled ×2.5 fallback;
- instantaneous and pre-irrigation bases mixed in one verdict;
- no uncertainty shown;
- salinity that never reaches the water-balance dose except through declared ECw.

### Cited Findings
1. **Naming "νερό ρίζας"**: used for single-depth σ_p in the kernel text ([runPerTich.js:11436](analysis/runPerTich.js)), in the daily verdict for max(ref1, ref2) ([11313, 11317, 11320](analysis/runPerTich.js)) and in the widget sub-line ("νερό ρίζας X,XX", [index-7cbd9a4e.js line 2 ≈25551](_dist-sagMain/index-7cbd9a4e.js)). It is neither root-zone weighted nor a measured solution.
2. **Mixed and incorrect unit labels**:
   - SE01 `'μS/cm'` uses Greek μ ([dragino_se01_parser.js:51](payload_parsers/dragino_se01_parser.js)).
   - SE0X uses `'µS/cm'` ([dragino_se0x_parser.js:94](payload_parsers/dragino_se0x_parser.js)).
   - SE02 uses `'mS/m'` for µS/cm values ([dragino_se02_parser.js:142, 151, 58-65](payload_parsers/dragino_se02_parser.js)).
   - The widget's conductivity default is mS/cm, while the device label says µS/cm ([index-7cbd9a4e.js line 1; line 2 ≈48200](_dist-sagMain/index-7cbd9a4e.js)).
   - The kernel texts mix µS/cm (raw) with dS/m (bulk/pore/ECe) ([runPerTich.js:11384, 11398, 11554-11555](analysis/runPerTich.js)).
3. **No lab calibration hook**: there is no form field and no kernel factor or offset for probe EC, θ_s or ε_0 ([configuration.html:507-548](custom_html_files/configuration.html); [runPerTich.js:11125, 11156-11183](analysis/runPerTich.js)). The status text hard-codes "⚠ Μη βαθμονομημένο όργανο" ([runPerTich.js:11289](analysis/runPerTich.js)).
4. **Worst depth ignores root depth and sensor depth**: `refF = Math.max(...refs)` ([runPerTich.js:11277](analysis/runPerTich.js)) and `_eceW` = max of the two chains ([18527-18531](analysis/runPerTich.js)), while moisture uses FAO weighting ([11058-11097](analysis/runPerTich.js)).
5. **×2.5 fallback is mislabelled and over-reaches**: it fires on any chain failure (dry soil, missing texture), not only on missing moisture; it uses bulk EC without temperature correction; and it can still produce a red override and Ks ([runPerTich.js:18510-18531, 18576-18600](analysis/runPerTich.js)).
6. **Mixed temporal bases**: the ratio verdict uses the pre-irrigation minimum-θ reference ([11193-11249](analysis/runPerTich.js)), while the crop-limit override and Ks use the instantaneous ECe at the daily tick ([18527-18531, 18578](analysis/runPerTich.js)).
7. **Possible double temperature compensation**: the kernel applies 2 %/°C plus ε_w(T) to every probe ([runPerTich.js:11161-11163, 11175](analysis/runPerTich.js)), while the SE02 parser says Dragino EC is already at 25 °C ([dragino_se02_parser.js:47-57](payload_parsers/dragino_se02_parser.js)). The question is unresolved.
8. **Duplicate and dead physics**: SE02 shadow `pore_water_ec*` uses different constants (fixed ε_w 78.45, guard +1.0) and nothing reads it ([dragino_se02_parser.js:8-13, 40-86](payload_parsers/dragino_se02_parser.js)). `_bad` / `_warn` in `_sagEcIndicators` are computed but unused ([runPerTich.js:11423-11424](analysis/runPerTich.js)).
9. **Uncertainty not shown**: 2 fixed decimals in the widget ([index-7cbd9a4e.js line 2 ≈25500](_dist-sagMain/index-7cbd9a4e.js)) and `toFixed(2)` in the kernel ([runPerTich.js:11413, 11425](analysis/runPerTich.js)), with no ± or confidence. Grey and green states, including the "uncalibrated" suffix, are hidden by the alerts filter ([index-7cbd9a4e.js line 10 ≈62700](_dist-sagMain/index-7cbd9a4e.js)).
10. **Provisional bands**: R thresholds 0.7 / 1.5 / 2.0 are marked provisional pending a 14-day review ([runPerTich.js:11256-11260](analysis/runPerTich.js)).
11. **Ks slope by class, not crop**, and Ks is not used in ETc or the dose ([runPerTich.js:18577, 13095-13097](analysis/runPerTich.js)).
12. **Dose uses only declared ECw**: no fertigation EC and no measured soil salinity. The gross dose is `target·(1+LR)/eff` ([runPerTich.js:7988-8025](analysis/runPerTich.js)).
13. **Fixed generic parameters**: ε_0 = 4.1 for all soils ([runPerTich.js:11125](analysis/runPerTich.js)); θ_s from a texture class table ([4490-4900](analysis/runPerTich.js)); Topp's universal curve applied to probe-reported VWC ([11149-11153](analysis/runPerTich.js)).
14. **Averaging before non-linear physics** in multi-device fields: separate running means of EC and θ ([runPerTich.js:14530-14540](analysis/runPerTich.js)).
15. **Channel coverage mismatch**: the widget labels `conduct_soil3/4` (line 1), but the kernel EC chain handles only channels 1 and 2 ([runPerTich.js:11189-11192](analysis/runPerTich.js)).
16. **Measurement dates of ECw and fertigation EC are stored but unused** ([configuration.html:537-545, 3042-3043](custom_html_files/configuration.html)).

### Inferences
- For an external-practice comparison, the closest established analogues of each part of the SAG chain are:
  - Hilhorst's pore-water EC (as used by commercial FDR/TDR vendors);
  - ECe dilution via θ/θ_s;
  - the FAO-29 / Maas–Hoffman threshold-slope model;
  - the FAO-29 leaching requirement.

  Where SAG departs from typical practice: no site-specific calibration against saturation-extract samples, generic ε_0 and θ_s, the worst-depth rule instead of a root-zone-weighted ECe, and no displayed uncertainty.

### Gaps
- Nothing in this local review shows how the chain performs on real fleet data, for example ECe values against lab analyses. That would need TagoIO data or a lab dataset, which were outside this read-only, local-only scope.
