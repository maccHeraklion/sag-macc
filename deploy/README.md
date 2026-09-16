# Deploy runbook — git → TagoIO

`deploy/manifest.json` is the **single source of truth**: it maps every repo file to its TagoIO
target (analysis ID, widget files, parser notes). Both deploy methods below use it.

There are **two ways** to deploy. Pick per situation:

## Method A (recommended) — Claude Code + TagoIO MCP  ✅

Best for this team: everyone already uses Claude Code, it needs **no install and no local token**, and
it uses TagoIO's own tested upload path. **Does it make sense to deploy via MCP? Yes** — it's the
right primary method here; the standalone script (Method B) is only for unattended/CI use.

In a Claude Code session connected to the TagoIO MCP (`tago-macc`), just say what to deploy, e.g.:

> "Deploy `analysis/uc511_downlink.js` to TagoIO using the id in `deploy/manifest.json`."

Claude will read the file and call **`upload_analysis_script`** with the manifest's `id`. To verify,
ask it to `get_analysis` / `download_analysis_script` and diff. For the widget, ask it to upload the
`_dist-sagMain/*` files to Files `storage/sagMain`.

Rules for Claude/you when using MCP:
- Only deploy files that are **committed** (git = source of truth).
- Use the **exact id** from `deploy/manifest.json`. Never create a new analysis by accident.
- After deploy, verify (`get_analysis` shows a fresh `updated_at`).

## Method B (optional) — the terminal/CI script

For unattended deploys. Uploads **analyses only** (not the widget or parsers).

```sh
cd deploy
npm install                       # installs @tago-io/sdk (adjust version if the upload call errors)
export ACCOUNT_TOKEN=xxxxx        # or create deploy/.env with ACCOUNT_TOKEN=... (gitignored)

node deploy.mjs --list                    # show manifest
node deploy.mjs --dry-run all             # preview
node deploy.mjs copy_fertility_index      # deploy ONE (safe test target) — verify in TagoIO first
node deploy.mjs runPerTich uc511_downlink # deploy specific
node deploy.mjs all                       # deploy all mapped analyses
```

> ⚠️ First run: deploy `copy_fertility_index` and confirm in the TagoIO console before touching
> `runPerTich`/`UC511_downlink`. `uploadScript` replaces the analysis's current script (it does not
> run it). If the upload call throws, verify the method against your installed `@tago-io/sdk`.

## The widget (NOT in the script)

The widget is a **hand-patched compiled bundle — no build step** (see `../CONSOLIDATION.md`). To
deploy it: edit `_dist-sagMain/index-7cbd9a4e.js` (and CSS) by hand, commit, then upload the
`_dist-sagMain/*` files to TagoIO Files **`storage/sagMain`** — via the TagoIO UI or by asking Claude
Code to upload them through the MCP. **Never `npm run build` and deploy** — it drops live-only
features. `index.html` already references `index-7cbd9a4e.js`, so keep that filename.

## Payload parsers (NOT in the script)

Assigned per **device** (Device → Payload Parser in TagoIO). Update the parser text there (or via
MCP) from `../payload_parsers/*`. Confirm which parser each connector uses before pruning duplicates.

## Golden rules
1. **git is the source of truth; TagoIO is a deploy target.** Never edit an analysis in the console
   or patch a bundle without committing the same change to `maccHeraklion/sag-macc`.
2. Deploy **only committed** files.
3. Migrations (`migrate*`) are **one-off** — deploy the code if you must, but running them is a
   separate, deliberate act (see each migration's env flags).
