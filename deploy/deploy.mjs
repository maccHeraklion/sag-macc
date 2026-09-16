#!/usr/bin/env node
/**
 * deploy.mjs — push analysis scripts from this repo to TagoIO (git → TagoIO).
 *
 * This is the OPTIONAL terminal/CI path. The team's PRIMARY path is Claude Code + the TagoIO MCP
 * (see deploy/README.md) — it needs no install and is what everyone already uses.
 *
 * What it does: for each analysis in deploy/manifest.json, reads the repo file and uploads it as the
 * analysis's current script via the TagoIO SDK. It does NOT run analyses and does NOT touch the
 * widget bundle or payload parsers (those are uploaded to Files / assigned per device — see README).
 *
 * Setup:   cd deploy && npm install        (installs @tago-io/sdk)
 *          export ACCOUNT_TOKEN=xxxxx      (or put it in deploy/.env — gitignored)
 * Usage:   node deploy.mjs --list                 list manifest entries
 *          node deploy.mjs --dry-run all          show what WOULD deploy
 *          node deploy.mjs copy_fertility_index   deploy ONE (safe test target)
 *          node deploy.mjs runPerTich uc511_downlink
 *          node deploy.mjs all                    deploy every mapped analysis
 *
 * ⚠ First run: test on a non-critical analysis (copy_fertility_index) and confirm in the TagoIO
 *   console before deploying runPerTich/UC511_downlink. Verify the SDK method name against your
 *   installed @tago-io/sdk version if the upload call throws.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

// --- token (env or deploy/.env) ---
function loadToken() {
  if (process.env.ACCOUNT_TOKEN) return process.env.ACCOUNT_TOKEN.trim();
  const envFile = join(__dirname, ".env");
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("ACCOUNT_TOKEN="));
    if (line) return line.slice("ACCOUNT_TOKEN=".length).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const manifest = JSON.parse(readFileSync(join(__dirname, "manifest.json"), "utf8"));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targets = args.filter((a) => !a.startsWith("--"));

if (args.includes("--list") || args.length === 0) {
  console.log("Analyses in manifest (name → id → file):\n");
  for (const a of manifest.analyses) {
    console.log(`  ${a.id ? "●" : "○"} ${a.name.padEnd(34)} ${a.id || "(no id)"}  ${a.file}`);
  }
  console.log("\nUsage: node deploy.mjs [--dry-run] <all | name...>   (● has id, ○ needs id set)");
  console.log("Widget & parsers are NOT deployed by this script — see deploy/README.md.");
  process.exit(0);
}

const selected =
  targets.includes("all")
    ? manifest.analyses
    : manifest.analyses.filter((a) => targets.includes(a.name) || targets.includes(a.file.replace(/^analysis\//, "").replace(/\.js$/, "")));

if (!selected.length) {
  console.error(`No manifest analyses matched: ${targets.join(", ")}. Run with --list.`);
  process.exit(1);
}

const token = loadToken();
if (!token && !dryRun) {
  console.error("Missing ACCOUNT_TOKEN (env var or deploy/.env). Aborting.");
  process.exit(1);
}

let Resources;
if (!dryRun) {
  try {
    ({ Resources } = require("@tago-io/sdk"));
  } catch {
    console.error("@tago-io/sdk not installed. Run:  cd deploy && npm install");
    process.exit(1);
  }
}

const run = async () => {
  const resources = dryRun ? null : new Resources({ token });
  let ok = 0, skipped = 0, failed = 0;

  for (const a of selected) {
    const abs = join(REPO, a.file);
    if (!existsSync(abs)) { console.log(`  ✗ ${a.name}: file missing (${a.file})`); failed++; continue; }
    if (!a.id) { console.log(`  ○ ${a.name}: no TagoIO id in manifest — skipped`); skipped++; continue; }

    const content = readFileSync(abs, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    if (dryRun) { console.log(`  ~ WOULD deploy ${a.name} (${bytes} b) → ${a.id}`); ok++; continue; }

    try {
      await resources.analysis.uploadScript(a.id, {
        name: a.file.split("/").pop(),
        language: "node",
        content: Buffer.from(content, "utf8").toString("base64"),
      });
      console.log(`  ✓ deployed ${a.name} (${bytes} b) → ${a.id}`);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${a.name}: upload failed — ${e?.message || e}`);
      failed++;
    }
  }

  console.log(`\n${dryRun ? "[dry-run] " : ""}Done. ok=${ok} skipped=${skipped} failed=${failed}`);
  process.exit(failed ? 1 : 0);
};

run();
