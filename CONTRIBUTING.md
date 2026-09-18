# CONTRIBUTING — how the team works on sag-macc

Three people work on this project. Until now, changes were made directly on TagoIO (analyses in the
console, the widget bundle by hand) **without committing**, and the repos drifted. This file is the
agreement that stops that. **If you use Claude Code, point it here first.**

## The one rule
**Git (`github.com/maccHeraklion/sag-macc`, branch `main`) is the source of truth. TagoIO is a deploy
target.** Every change to an analysis, the widget bundle, or a parser must be **committed here** — and
you deploy *from* the repo, never the other way around. No more editing live without a commit.

## Everyday flow
1. `git pull` (always start current).
2. Make the change **in the repo** (edit the file under `analysis/`, `_dist-sagMain/`,
   `payload_parsers/`).
3. Commit (small, described, subject ending in the author's name: `- Κώστας` or `- Michalis`,
   whichever account you are working from). **Push immediately** — don't batch
   local-only commits, `origin/main` should reflect the change the same session it was made.
4. **Deploy from the repo** using `deploy/manifest.json` — see `deploy/README.md`:
   - **Preferred:** Claude Code + TagoIO MCP (`upload_analysis_script` for analyses; Files upload for
     the widget). No install, no local token.
   - **Or:** `cd deploy && npm install && node deploy.mjs <name>` (terminal/CI).
5. Verify on TagoIO (`get_analysis` shows a fresh `updated_at`, or check the dashboard).

## Before you upload anything to TagoIO
`git pull`, then open **`deploy/DEPLOY_LOG.md`**: its first line says whether someone is uploading
right now (🔴) or the system is free (🟢). Set it to 🔴 with your name + what you upload, push, upload,
then set it back to 🟢 and push. That is how the three of us avoid overwriting each other.

## Hard don'ts
- ❌ Don't edit an analysis in the TagoIO console without committing the same change here.
- ❌ Don't `npm run build` and deploy the widget. **The widget has NO build source** — it's a
  hand-patched compiled bundle (`_dist-sagMain/`). Edit the bundle by hand, commit, upload. `src/` is
  reference only. (Details: `CONSOLIDATION.md`.)
- ❌ Don't run a `migrate*` analysis casually — they're one-off; read their env flags first.
- ❌ Don't hardcode tokens/keys. They live in each analysis's TagoIO env vars and in a gitignored
  `.env`.

## Where things are
| Need | File |
|---|---|
| Why the repo looks like this / what was consolidated | `CONSOLIDATION.md` |
| Deploy steps + manifest | `deploy/README.md`, `deploy/manifest.json` |
| Onboarding | `HANDOVER.md` |
| Architecture & internals | `README.md`, `CLAUDE.md` |
| Deploy targets per artifact | `DEPLOY.md` |

## Claude Code notes
- Read `CLAUDE.md` (auto-loaded) and `CONSOLIDATION.md` before changing the widget.
- To deploy: read `deploy/manifest.json`, then use the TagoIO MCP `upload_analysis_script` with the
  mapped `id`. Only deploy committed files.
- The TagoIO custom-widget MCP flow / skill (`upload_custom_widget_code`) is **not** used here — this
  widget is a self-hosted iframe bundle, not a TagoIO-hosted `.tsx` widget.
