# HANDOVER.md — developer onboarding

Everything you need to pick this project up. Pair with **[README.md](README.md)** (overview),
**[DEPLOY.md](DEPLOY.md)** (how to ship), and **[CLAUDE.md](CLAUDE.md)** (deep internals).

## 1. Get the code

```sh
git clone https://github.com/maccHeraklion/sag-macc.git
cd sag-macc
npm install
```

- **Remote of record:** `origin` → `github.com/maccHeraklion/sag-macc`, branch **`main`**. This is
  the clean consolidated baseline (see [CONSOLIDATION.md](CONSOLIDATION.md)). The older
  `cyriciot/macc-sag` and `cpatsianotakis/macc-custom-widget` repos are **superseded — do not use**.
- ⚠️ **Do not `npm run build` to deploy the widget.** The deployed widget is a hand-patched compiled
  bundle in `_dist-sagMain/` with no regenerating source; `src/` is reference only. See
  [CONSOLIDATION.md](CONSOLIDATION.md) → "The widget has NO build source".
- Ask the repo owner for **collaborator access** on GitHub.
- Create a local `.env` (git-ignored) with `ACCOUNT_TOKEN` (and `TAGO_TOKEN` if you use the upload
  script). Never commit it.
- You'll also need a **TagoIO account login** for the profile (Analyses, Files, Devices, Dashboards).

## 2. Mental model (read once)

- The **widget** is a static React bundle rendered inside a TagoIO dashboard iframe. It receives data
  via `window.TagoIO.onRealtime` and sends commands via `window.TagoIO.sendData`. **No REST calls of
  its own** — anything the widget "can't do itself" is done by an **Analysis** it triggers.
- **Analyses** are TagoIO's serverless Node.js functions. Two kinds here:
  - *Continuous:* `runPerTich` (computes `field_bundle` on every device push),
    `uc511_downlink` (the widget's `analysis_run` — sends downlinks, fetches history),
    `uc511_status_check` (retries unacked downlinks).
  - *Provisioning / one-off:* `createField`, `addSensorsToField`, `createUserForClient`, and the
    `migrate*` scripts.
- **Payload parsers** decode raw LoRaWAN hex into named variables at ingest.

Trace a feature end-to-end using the table in [README.md](README.md#features-and-how-they-relate).

## 3. Where things live

| You want to change… | Look in |
|---|---|
| A dashboard card / modal UI | `src/*.tsx` (e.g. `IrrigationModal.tsx`, `MeasurementModal.tsx`) |
| Global state / data parsing | `src/Dashboard.tsx` (~2000 lines; `applyBuckets` is the parser) |
| A sensor variable's label/unit/conversion | `src/config/variablesConfig.ts` |
| Which variables a device type gets | `DEVICE_TYPE_VARIABLES` in `createField.js` + `addSensorsToField.js` (keep in sync) |
| Agronomic indicator math | `analysis/runPerTich.js` (see CLAUDE.md) |
| Valve/rule downlink encoding | `analysis/uc511_downlink.js` |
| Uplink decoding | `payload_parsers/uc511_parser.js` (+ others) |
| The valve-command feedback overlay | `src/public/uc511-feedback-overlay.js` |

## 4. Build & ship

```sh
npm run check:types      # tsc --noEmit — run before committing widget changes
npm test                 # Jest
npm run build:production  && npm run build:staging   # rebuild both bundles
```

Then follow **[DEPLOY.md](DEPLOY.md)**: copy `_dist-sagMain*` into TagoIO Files, paste changed
analyses into their TagoIO Analysis, assign parsers. Commit the rebuilt `_dist-*` bundles too (they
are tracked so anyone can copy them without a local build).

## 5. Gotchas that will bite you

- **All UI text is Greek.** Keep it Greek.
- **Custom-widget SDK is `autoFill` (capital F).** Lowercase `autofill` is a dead no-op. `autoFill`
  must stay ON or the widget's `analysis_run` never fires — but ON means a command is **broadcast** to
  every controller subscribing that variable. Multi-controller commands are disambiguated by
  `metadata.target_device`; readers (widget parse loop + `uc511_status_check`) drop broadcast copies
  whose `target_device` ≠ the device they landed on. Don't "fix" this by turning autofill off.
- **`qty` is per data source, capped at 10000, shared across a device's variables.** A chatty device
  (weather station, ~15 vars/5 min) only reaches back a few days. Deep history uses the on-demand
  `history_request` → `history_data` fetch, not a bigger qty.
- **`selectedDeviceId` is a *sensor* device**, never the field device — don't use it for
  `field_calendar` (a field-level variable routed by autofill).
- **UC511 rules (HW v4) vs plans (legacy)** are auto-detected per controller from `hw_version`
  (major ≥4 → rules). `UC511_HW_GENERATION` env is only the fallback.
- **Windows tooling:** some tools mangle paths containing `uc511` (→ `씑`). If an edit/read of
  `uc511_*.js` fails, copy it to a temp name, edit, copy back (via Git Bash `cp`). Git may warn
  `LF will be replaced by CRLF` — harmless.

## 6. Testing

- Unit tests: `npm test` (Jest + RTL for widget; parser tests under `payload_parsers/test/`,
  analysis tests under `analysis/test/`).
- For live behavior you generally test on a **staging** field dashboard (`storage/sagMainStaging`)
  before production.

## 7. Reference docs in this repo

- `CLAUDE.md` — full architecture + `runPerTich` internals (indicators, crop/pathogen profiles).
- `analysis/createField.md` — field-provisioning analysis details.
- `analysis/RUNPERTICH_ROLLOUT*.md` — indicator-engine rollout history.
- `PROJECT_SPEC.md`, `UX_SPEC.md` — product/UX specs.

## 8. Open items / recently touched

- On-demand history fetch, multi-controller command routing, per-controller rule/plan detection, and
  the valve-feedback ack were the most recent changes — see `git log` for context.
- Deployment is manual; a CI pipeline (build → upload bundle → push analyses) would be a worthwhile
  next investment.
