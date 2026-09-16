# DEPLOY.md — deploying to TagoIO

Nothing auto-deploys on push. There are **three** deploy targets: the widget bundle, the analyses,
and the payload parsers. Each is a manual copy/paste into the TagoIO console unless noted.

TagoIO Files base for this profile: `https://api.tago.io/file/67934c48e8e573000ae5964b/storage/`

---

## 1. Custom widget (the dashboard UI)

> ⚠️ **NO BUILD STEP.** The deployed widget is a **hand-patched compiled bundle** with no
> regenerating source (see [CONSOLIDATION.md](CONSOLIDATION.md)). **Do NOT run `npm run build` and
> deploy its output** — it would drop live-only features (rule seconds, hour-range cycles, spray-dose
> calculator). To change the widget: **edit `_dist-sagMain/index-7cbd9a4e.js` (and CSS) by hand**,
> then upload. `src/` is reference only, not the build source.

Copy the widget files (the committed `_dist-sagMain/` = the authoritative deployed bundle) into
TagoIO Files:

| Build output | TagoIO Files folder |
|---|---|
| `_dist-sagMain/*` | `storage/sagMain` |
| `_dist-sagMainStaging/*` | `storage/sagMainStaging` |

- Copy **all** files (`index.html`, `index-*.js`, `*.css`, `vendor-*.js`, `echarts-*.js`,
  `uc511-feedback-overlay.js`). The JS filename hash changes each build — replace the old one.
- `index.html` references the hashed bundle **and** `uc511-feedback-overlay.js`; keep both.
- Optional automated upload (if a token is configured in `.env`): `npm run deploy:production` /
  `npm run deploy:staging` (`scripts/deploy_dynamic.js`). Verify it targets the right storage folder.
- The dashboard widget's `display.url` must point at `storage/sagMain/index.html`.

**Verify:** open a field dashboard, confirm the new `index-*.js` hash is served (Network tab).

---

## 2. Analyses (TagoIO Analyses → paste script)

For each file below: open the matching Analysis in the TagoIO console, replace its script with the
repo file, save. Match by purpose/name; two known IDs are noted.

| Repo file | TagoIO Analysis | Trigger | Env vars |
|---|---|---|---|
| `analysis/runPerTich.js` | Indicator engine | per device data push (action) | `ACCOUNT_TOKEN`, `ACCUWEATHER_API_KEY` (opt) |
| `analysis/runPerTichLegacy.js` | Legacy indicator engine | per push (legacy fields) | `ACCOUNT_TOKEN` |
| `analysis/uc511_downlink.js` | **`68deb0d47a8161000a558867`** — widget `analysis_run` | every widget `sendData` | `account_token`, `default_PORT` (opt, 85), `DEMO_MODE` (opt) |
| `analysis/uc511_status_check.js` | **`68fba332f1f181000a1b4dce`** — ack checker | cron (created by uc511_downlink) | `account_token`, `MAX_RETRIES` (3), `MIN_WAIT_MS` (60000), `default_PORT` |
| `analysis/createField.js` | Create field | form submit | `ACCOUNT_TOKEN`, `FORM_DEVICE_ID` (opt), `UC511_HW_GENERATION` (opt fallback) |
| `analysis/addSensorsToField.js` | Add sensors to field | form submit | `ACCOUNT_TOKEN`, `FORM_DEVICE_ID` (opt), `UC511_HW_GENERATION` (opt fallback) |
| `analysis/removeSensorFromField.js` | Remove sensor from field | form submit | `ACCOUNT_TOKEN` |
| `analysis/createClient.js` | Create client | form submit | `ACCOUNT_TOKEN` |
| `analysis/createUserForClient.js` | Create RUN user for client | form submit | `ACCOUNT_TOKEN` |
| `analysis/subscriptionControl.js` | Subscription gating | schedule/action | `ACCOUNT_TOKEN` |

> ⚠️ The two `uc511_*` analyses read the token from env key **`account_token`** (lowercase);
> all the others use **`ACCOUNT_TOKEN`** (uppercase). Don't mix them up.

The widget's `analysis_run` must be set to `uc511_downlink` (`68deb0d4…`). `uc511_downlink` creates a
one-off cron Action (tagged `throttle_group: uc511_ack_check`) that runs `uc511_status_check`, which
deletes the Action when there's nothing left to retry — no manual scheduling needed.

---

## 3. Payload parsers (TagoIO device → Payload Parser)

Assign the matching parser to each device (Device → Payload Parser → paste, or connector default):

| Device type (`type` tag) | Parser |
|---|---|
| `s2120` weather station | `payload_parsers/sensecap_s210_parser.js` |
| `uc511` irrigation controller | `payload_parsers/uc511_parser.js` |
| `lse02` / `se0x` soil | `payload_parsers/dragino_lse02_parser.js` / `dragino_se0x_parseρy.js` |
| `lse01` (single depth) | `dragino_lse01_shallow_parser.js` / `dragino_lse01_deep_parser.js` |
| `sph01` soil pH | `payload_parsers/dragino_sph01_parser.js` |

`uc511_parser.js` decodes valve status, rule (FE53) / plan (FE4C/4D) config, the FE1D
downlink-received echo (`valve_*_command_feedback`), and device info. If you change it, keep the
`valve_*_command_feedback` output — the feedback overlay's step-1 ack depends on it.

---

## 4. One-off migrations (run once per environment, then leave)

Idempotent migrations that retrofit existing dashboards. Run as a normal Analysis. All support
scope + a dry run:

| Migration | Adds |
|---|---|
| `migrateFieldCalendar.js` | `field_calendar` subscription |
| `migrateFieldBundle2.js` | `field_bundle_2` overflow subscription |
| `migrateHistoryVars.js` | `history_request` / `history_data` (range fetch) |
| `migrateControllerRuleVars.js` | rules/plans + `rules_enabled_mask` + `valve_*_command_feedback` per controller |

Common env vars:

| Env | Meaning |
|---|---|
| `ACCOUNT_TOKEN` | required |
| `TARGET_DASHBOARD_ID` | one dashboard only (best first test) |
| `TARGET_TAG_KEY` (+ `TARGET_TAG_VALUE`) | only dashboards with that tag |
| *(neither)* | ALL dashboards |
| `DRY_RUN=true` | report only, write nothing |
| `UC511_HW_GENERATION` | `migrateControllerRuleVars` only — fallback (`v4`/`legacy`) when a controller's `hw_version` can't be read; generation is otherwise auto-detected per controller |

**Recommended:** run with `DRY_RUN=true` + `TARGET_DASHBOARD_ID=<one>` first, read the log, then
drop `DRY_RUN`, then widen to `TARGET_TAG_KEY` or all. Re-running is safe (only adds what's missing).

---

## Environment / secrets

`.env` is git-ignored (holds `ACCOUNT_TOKEN` / `TAGO_TOKEN`). Never commit tokens. Each TagoIO
Analysis keeps its own env vars in the console (not in `.env`).
