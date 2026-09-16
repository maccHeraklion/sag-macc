# AgroGenius / SmartAgro — TagoIO smart-farming platform

A [TagoIO](https://tago.io) solution for agricultural IoT: LoRaWAN field sensors + irrigation
controllers feed a serverless analytics engine, and a React custom widget renders everything as a
per-field dashboard (environment, disease risk, irrigation control, forecast, cultivation log).

This repo holds **three things** that run in different places:

| Part | Where it runs | Folder |
|---|---|---|
| **Custom widget** (the dashboard UI) | TagoIO dashboard iframe (static bundle in TagoIO Files) | `src/` → built to `_dist-sagMain*` |
| **Analyses** (serverless backend) | TagoIO Analyses (Node.js) | `analysis/` |
| **Payload parsers** (uplink decoders) | TagoIO device payload parser | `payload_parsers/` |

> New here? Read **[CONSOLIDATION.md](CONSOLIDATION.md)** (how this baseline was built) and
> **[HANDOVER.md](HANDOVER.md)** first, then **[DEPLOY.md](DEPLOY.md)**.
> Deep implementation notes live in **[CLAUDE.md](CLAUDE.md)** and `analysis/createField.md`.

> ⚠️ **The widget has NO build source.** The deployed dashboard is a **hand-patched compiled bundle**
> (`_dist-sagMain/`), 209 KB vs ~135 KB if rebuilt from `src/`. **Do NOT `npm run build` and deploy** —
> it drops live-only features (rule seconds, hour-range cycles, spray-dose calculator). Edit the bundle
> by hand and re-upload. `src/` is reference only. Details in [CONSOLIDATION.md](CONSOLIDATION.md).

---

## How the pieces fit together

```
LoRaWAN device ──uplink──▶ payload_parser (decodes hex → variables) ──▶ device data (TagoIO)
                                                                              │
                        runPerTich.js (Analysis, per push) ── computes ──────┤
                        indicators → field_bundle variable                   │
                                                                              ▼
                                                          Custom widget (Dashboard.tsx)
                                                          reads variables via onRealtime,
                                                          renders cards + modals
                                                                              │
                          user acts (open valve / set rule / fetch history)   │
                                                                              ▼
                                    widget sendData ──▶ analysis_run = uc511_downlink.js
                                    (valve/rule downlink, or history range fetch)
                                                                              │
                                    uc511_status_check.js (cron) retries unacked downlinks
```

**Data in:** device → payload parser → variables → `runPerTich` packs agronomic indicators
(VPD, IPSI, BPI, GDD, FIR, irrigation volume) into one `field_bundle` variable.

**Data out (display):** the widget subscribes to each field's variables and draws them.

**Commands out:** the widget never talks to hardware directly. It `sendData`s a command variable;
`uc511_downlink` (wired as the widget's `analysis_run`) turns it into a LoRaWAN downlink.

---

## Features and how they relate

| Feature (widget card) | Reads | Writes / triggers | Backend |
|---|---|---|---|
| **Environment / measurements** | sensor timeseries | `history_request` → `history_data` (on-demand range fetch) | `uc511_downlink` history branch |
| **Pathogen / pest risk** | `field_bundle` FIR + `fir_message_*` | — | `runPerTich` FIR model |
| **Irrigation — valves & meters** | `valve_*`, `valve_*_command`, `valve_*_pulse`, `batterypct` | `valve_*_command` / `valve_*_time_command` | `uc511_downlink` → FF1D downlink; ack via `uc511_status_check` |
| **Irrigation — rules (UC511)** | `rule*` (v4) / `plan*` (legacy) | `rule*_set` / `rule*_enable` | `uc511_downlink` → FF55/FF4B downlink |
| **Forecast** | `forecast` (Open-Meteo, in `metadata.hourly*`) | — | fetched upstream into the `forecast` variable |
| **Cultivation calendar** | `field_calendar` (field device) | `field_calendar` (autofill → field device) | — |
| **Configuration** | `configuration` | `configuration` | `runPerTich` reads crop/device setup |

**Provisioning flow** (analyses, run from forms):
`createClient` → `createUserForClient` (RUN portal users + per-field access) →
`createField` (new Field device + cloned dashboard + wired sensors) →
`addSensorsToField` / `removeSensorFromField` (edit an existing field).

**Multi-controller irrigation:** a field can have several UC511 controllers. Commands are stamped
`metadata.target_device`; TagoIO autofill (kept ON so `analysis_run` fires) broadcasts the command
to every controller that declares the variable, so the widget parse loop **and** `uc511_status_check`
ignore broadcast copies whose `target_device` ≠ the controller they landed on. Controllers pick
rules-vs-plans by auto-detecting HW generation from `hw_version`.

---

## Quick start

```sh
npm install
npm run build:production     # → ../_dist-sagMain   (base = TagoIO Files storage/sagMain)
npm run build:staging        # → ../_dist-sagMainStaging
npm start                    # local dev server (localhost:1234)
npm run check:types          # tsc --noEmit
npm test                     # Jest
```

The build output (`_dist-sagMain*`) is what gets copied into TagoIO Files. See **[DEPLOY.md](DEPLOY.md)**
for the full deploy — including which `analysis/*.js` maps to which TagoIO Analysis, the env vars, and
the one-off migrations.

## Repo layout (short)

```
src/                     React custom widget (Dashboard.tsx + modals + config/)
  public/                uc511-feedback-overlay.js (loaded next to the bundle)
analysis/                TagoIO Analyses (backend); *.md rollout notes
payload_parsers/         Per-device uplink decoders (dragino, sensecap, milesight uc511)
_dist-sagMain/           Built production bundle (committed; copied to TagoIO Files)
_dist-sagMainStaging/    Built staging bundle
scripts/                 Bundle upload helper (npm run deploy:*)
CLAUDE.md                Full developer guide (architecture, runPerTich internals)
DEPLOY.md / HANDOVER.md  Deploy steps / onboarding
```

## Conventions

- **All UI text is Greek (el-GR).** Keep new labels Greek.
- The widget makes **no external API calls** — it only uses `window.TagoIO.*` (onStart/onRealtime/sendData).
- TagoIO Files profile id (base URL): `67934c48e8e573000ae5964b` → `storage/sagMain`, `storage/sagMainStaging`.
- Remote of record: **`origin` → github.com/maccHeraklion/sag-macc** (branch `main`). This clean
  baseline supersedes the older `cyriciot/macc-sag` and `cpatsianotakis/macc-custom-widget` repos.
