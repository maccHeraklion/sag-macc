# CONSOLIDATION.md — how this baseline was built (2026-09-16)

This repo (`maccHeraklion/sag-macc`) is a **clean baseline** created to end months of
untracked, out-of-band changes. Three developers had been editing TagoIO directly (analyses in the
console, the widget bundle by hand) without committing. This baseline captures **what is actually
deployed on TagoIO right now** as the single source of truth going forward.

> **Golden rule from here on:** git is the source of truth, TagoIO is a deploy target. Never edit an
> analysis in the TagoIO console or patch a widget bundle without committing the same change here.

## Where each part came from

| Part | Source of truth used | How verified |
|---|---|---|
| **Analyses** | **Downloaded live from TagoIO** by ID (not the hand-copied folder) | see below |
| **Payload parsers** | "Changes by others" folder (last uploaded) | size/name reconciled |
| **Widget bundle** (`_dist-sagMain/`) | Deployed compiled files | byte-compared to repo build |
| Everything else (`src/`, other analyses, config) | Prior `macc-sag` repo | unchanged |

### Analyses — verified against LIVE TagoIO (not the folder)
A folder of files ("Changes by others") was provided as "the last uploaded versions," but on
inspection **it was unreliable** (one file was a mislabeled/broken script, others differed from
live). So every analysis with a known ID was **downloaded from the live account** and that is what
was committed:

| Analysis | ID | Committed file | Verification |
|---|---|---|---|
| runPerTich (indicator engine) | `6898958ea9fc0d000a382484` | `analysis/runPerTich.js` | ⚠ live download capped at 1 MiB (file is ~1.24 MB); folder copy kept after confirming identity (all engine signatures present, syntax-valid, size matches). **Byte-verify manually if in doubt.** |
| UC511_downlink | `68deb0d47a8161000a558867` | `analysis/uc511_downlink.js` | live == folder (byte markers matched) |
| setFieldParametersFromDeviceData | `68fe925b3607df0010ef833c` | `analysis/setFieldParametersFromDeviceData.js` | rewritten from **live** (folder differed); syntax-checked |
| KEKFlood (Infobip SMS flood alert) | `69468d1f8b9939001044697f` | `analysis/KEKFlood.js` | rewritten from **live** (folder copy was a broken/mislabeled file) |
| SAG — Έλεγχος δηλωμένου εδάφους (READ-ONLY audit) | `6aa2d24f2f585a000b90b1a1` | `analysis/sag_declared_soil_check_readonly.js` | rewritten from **live** (folder differed). Runtime `node-rt2025`; uses `process.env.T_ANALYSIS_TOKEN` |

Other analyses (`createField.js`, `addSensorsToField.js`, `removeSensorFromField.js`,
`createClient.js`, `createUserForClient.js`, `uc511_status_check.js`, `runPerTichLegacy.js`,
`subscriptionControl.js`, the `migrate*.js`) were **not** among the others' changes and are carried
over from the prior repo unchanged. If any of these were also edited live, download and re-commit.

### Payload parsers
Deployed parsers taken from the folder; the Greek-typo filename `dragino_se0x_parseρy.js` was removed
and replaced by `dragino_se0x_parser.js`. New: `dragino_se01_parser.js`,
`dragino_se02_parser.js` (KEK 2-depth parser, "ΕΚΔΟΣΗ 2", 3/9/2026). The older
`dragino_lse01*_parser.js` / `dragino_lse02_parser.js` are retained for reference — **verify which
parser each device connector actually uses** before deleting any.

## ⚠ The widget has NO build source (deliberate)

The deployed dashboard widget is a **hand-patched compiled bundle**. `_dist-sagMain/index-7cbd9a4e.js`
is **209 KB deployed vs ~135 KB if rebuilt from `src/`** — same filename, different content. All
widget changes were made by editing the compiled file directly (with Claude Code), never through the
Vite build. Features that exist **only** in the deployed bundle, not in `src/`:

- Rule duration in **seconds** (not just minutes)
- **Hour-range "cycles"** rule generation (Από/Έως + every N minutes → multiple rules)
- Expanded **spray-dose calculator**

**Decision (owner, 2026-09-16): keep this model.** The authoritative widget is
`_dist-sagMain/` (the compiled bundle). Future widget changes are made **by hand on the bundle**, not
by `npm run build`.

- ✅ To change the widget: edit `_dist-sagMain/index-7cbd9a4e.js` (and CSS) directly, re-upload to
  TagoIO Files `storage/sagMain`, commit the changed bundle here.
- ❌ **Do NOT `npm run build` and deploy the output** — it would drop the three features above.
- `src/` is retained as **reference only** (it explains ~90% of the bundle's logic and is where the
  history-fetch + multi-controller features came from), but it is **not** the build source of the
  deployed bundle.

## Deployment quick reference
See **[DEPLOY.md](DEPLOY.md)**. In short: analyses → paste into the matching TagoIO Analysis (or push
via the TagoIO MCP `upload_analysis_script`); widget → copy `_dist-sagMain/*` into TagoIO Files
`storage/sagMain`; parsers → assign per device.

## Follow-ups worth doing
- Byte-verify `runPerTich.js` against live once (it exceeded the MCP 1 MiB download cap here).
- Confirm parser→connector assignments and prune the duplicate `lse0x`/`se0x` parser names.
- Consider a small git→TagoIO deploy script for analyses (MCP `upload_analysis_script`) so no one
  edits analyses live again.
