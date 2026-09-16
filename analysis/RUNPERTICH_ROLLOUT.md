# runPerTich legacy_v2 — Rollout & Per‑Patch Enable Guide

Companion to `analysis/runPerTich.js`. Source handoff:
`admin/SAG_legacy_v2_ICT_delivery_2026-06-17/`.

The kernel is the v1 base + 13 additive, flag‑gated patches: **18, 19, 20, 21, 22, 23,
25, 26, 27, 28, 29, 30**. `field_bundle` schema is unchanged, so dashboards keep working.

---

## How the flags work

All control is via the **TagoIO Analysis → Environment Variables** tab (no redeploy to
toggle). Keys this build reads:

| Env var | Effect |
|---|---|
| `ENABLE_PATCH_<n> = false` | Disable patch `n`. |
| `ENABLE_PATCH_<n> = true` *(or unset)* | Enable patch `n` — **patches default ON**. |
| `ENABLE_PATCH_DISABLE_ALL = true` | **Master kill switch** — disables every patch + the declaration handlers → true v1‑equivalent behaviour. |
| `FIELD_TAG_VALUE = yesTEST` | Point this code at test fields (`isField:yesTEST`). Default is `yes` (production). |

**Key rule:** `DISABLE_ALL=true` overrides everything — you **cannot** enable an
individual patch while it's set. So:
- **Dormant production deploy** → use `ENABLE_PATCH_DISABLE_ALL=true`.
- **Staged enabling on the test analysis** → do **NOT** set `DISABLE_ALL`. Instead set all
  patches you aren't ready for to `=false`, and enable one by setting its
  `ENABLE_PATCH_<n>=true`.

**To enable a patch** = set `ENABLE_PATCH_<n> = true` (or delete its `=false`).
**To roll one back** = set `ENABLE_PATCH_<n> = false`. Takes effect next tick.

---

## Deploy sequence

1. **Back up** the current production analysis (keep the old version pinned for rollback).
2. **Production analysis — dormant:** set `ENABLE_PATCH_DISABLE_ALL=true`, paste
   `runPerTich.js`. Confirm one tick runs clean (`sag_run_health`, no error spike) and the
   dashboards look identical to today. Output = v1‑equivalent.
3. **Test analysis — staged canary** (`FIELD_TAG_VALUE=yesTEST`, no `DISABLE_ALL`): set the
   12 patches dormant, then enable one at a time per the table below, watching the test field
   48–72 h after each.

   Dormant‑via‑individual env set (paste all, then flip one to `true` to enable it):
   ```
   ENABLE_PATCH_18=false
   ENABLE_PATCH_19=false
   ENABLE_PATCH_20=false
   ENABLE_PATCH_21=false
   ENABLE_PATCH_22=false
   ENABLE_PATCH_23=false
   ENABLE_PATCH_25=false
   ENABLE_PATCH_26=false
   ENABLE_PATCH_27=false
   ENABLE_PATCH_28=false
   ENABLE_PATCH_29=false
   ENABLE_PATCH_30=false
   ```
4. **Widen to production:** once a patch + its UI are validated on the test field, enable the
   same flag on the production analysis (remove `DISABLE_ALL` there and mirror the validated
   per‑patch flag set).

---

## Patch table (recommended order, safest first)

| Order | Patch | What it does | New variables | Front‑end before enabling? |
|---|---|---|---|---|
| 1 | **25** | Foliar‑engine guards (prevent /0 → NaN FIR). Defensive. | — | **No** — safe anytime |
| 2 | **21** | Freeze FIR/InfectionHours when air‑temp/RH sensor is qa_fault/qa_stuck (no false alerts). | — | **No** |
| 3 | **22** | «Ενεργή Υπενθύμιση» self‑expires after 72 h of mild conditions. | — | **No** |
| 4 | **20** | Irrigation soil‑moisture QA gate: faulty sensor → safe no‑op + fault flag. | `irrigation_sensor_fault` | Works without UI; a fault notice card is nicer |
| 5 | **19** | Spray‑coverage countdown «…για ακόμα Χ ημέρες». | `protection_days_left` (metadata on `fir_message_*`) | Display‑only; needs the countdown text rendered to be visible |
| 6 | **18** | Inspection «έγινε έλεγχος (καθαρό)» resets that disease's FIR/GDD accumulator. | (resets existing) | **Needs** the «👁️ Επιθεώρησα» button **and** the `inspection_declaration` input registered on the device — otherwise it never fires |
| 7 | **23** | Insect «Γενιά N» generation model + phase + diapause. | `pest_generation_<key>` | **Needs** the «Γενιά N» card (else raw key shows) |
| 8 | **26** | +3 foliar pathogens + erysiphe host‑fix. | `fir_<k>`, `infection_hours_counter_<k>` | **Needs** Greek labels for the new pathogens |
| 9 | **27** | +3 foliar pathogens. | same | **Needs** Greek labels |
| 10 | **28** | +2 foliar pathogens. | same | **Needs** Greek labels |
| 11 | **29** | **Open‑Meteo forecast fetcher** (keyless, 1×/day/field; needs field lat/lon). Sensor calcs untouched. **New outbound HTTP.** | `om_*`, `forecast_tmin/tmax/rain_day1..7` | Optional (forecast view) |
| 12 | **30** | **Frost & heat alerts** from the OM forecast (per crop + stage). **Requires PATCH_29.** | `weather_alert_frost`, `weather_alert_heat` | **Needs** alert cards |

---

## Front‑end grouping (quick reference)

- **Group A — enable now, zero UI work, no farmer‑visible risk:** **25, 21, 22**
  (purely internal/defensive — nothing new to render).
- **Group B — works without UI, small card improves it:** **20** (fault notice), **19**
  (countdown text). Enabling is safe; the new value just isn't shown until rendered.
- **Group C — enable only AFTER the matching UI ships** (else farmers see snake_case keys /
  empty cards): **23** (Γενιά N), **26/27/28** (new pathogen Greek labels), **30** (alert cards).
- **Group D — prerequisites:**
  - **18** needs the inspection button + the `inspection_declaration` device input variable
    (register it like `spray_declaration`). Harmless but inert until then.
  - **29** must be enabled **before 30**; confirm a live fetch returns sane `om_*`/`forecast_*`
    (compare to sensors ~1 week) before turning on 30. Confirm TagoIO allows the outbound
    Open‑Meteo HTTP call.

---

## Rollback
- One patch: `ENABLE_PATCH_<n> = false` (next tick).
- Everything (true v1): `ENABLE_PATCH_DISABLE_ALL = true`.
- Hard rollback: repin the previous analysis script version in TagoIO.
