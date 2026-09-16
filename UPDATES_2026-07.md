# SmartAgro / AgroGenius — Updates (July 2026)

Reference for the changes made this cycle and exactly what **you** need to do to roll each one out.
All code is on `main` (repo `cyriciot/macc-sag`).

---

## 0. Deployment cheat‑sheet (do these in order)

| # | Artifact | Where it goes | Action |
|---|----------|---------------|--------|
| A | `analysis/runPerTich.js` | TagoIO Analysis (per field) | Paste code into the analysis |
| B | `dist-sagMainStaging/*` (build `index-*.js`) | TagoIO Files → `storage/sagMainStaging/` | Upload, Public, delete old `index-*.js` |
| C | `analysis/migrateFieldBundle2.js` | New TagoIO Analysis | Create + run (see §3) |
| D | `analysis/createUserForClient.js` | New TagoIO Analysis + form | Create + wire form (see §4) |
| E | `analysis/addSensorsToField.js` | New TagoIO Analysis + form | Create + wire form (see §5) |
| F | `analysis/createField.js` | Existing "create field" Analysis | Paste updated code |
| G | `analysis/patchCreateFieldForm.js` | New TagoIO Analysis (run once) | Adds `deviceN_name` + `deviceN_soil` to the create‑field form (see §6) |
| H | `payload_parsers/dragino_lse01_shallow_parser.js`, `_deep_parser.js` | Device payload parser | **Optional** — depth is now tag‑driven (see §7) |
| I | `analysis/runPerTichLegacy.js` | Legacy field Analysis (if used) | Paste updated code (soil‑depth support) |

> **Production frontend:** the same frontend build is promoted by uploading it to `storage/sagMain/`
> and (optionally) using the migration's URL‑update option (§3) to repoint dashboards.

---

## 1. `field_bundle` split — fixes the daily‑tick 10 kB failure

**Problem.** The `field_bundle` is one TagoIO data point, and metadata is capped at **10 kB per point**.
On multi‑crop fields the **daily** tick adds the pathogen block and exceeded the cap (measured 11 264 B
on the 6‑crop test field), so the write was rejected — **pathogens never persisted and the daily
forecast‑cache was lost**. Hourly ticks (~8 kB) were fine.

**What changed.**
- `runPerTich.js` fills `field_bundle` first, then spills the pathogen/pest family
  (`fir_*`, `pest_generation_*`, `pathogen_alert_*`, `infection_hours_counter_*`) into a second point
  **`field_bundle_2`** when it would exceed 9800 B. Small fields never spill (`field_bundle` stays
  identical; `field_bundle_2` is written empty).
- Carry‑forward now reconstructs state from **both** points.
- The dashboard subscribes to `field_bundle_2`, decodes it, and **deep‑merges** it into the bundle.
  No‑op when absent (legacy fields).
- New diagnostic log line each tick: `[field_bundle] primary=…B ext=…B / cap~10240 each …`.

**What you need to do.**
1. Deploy `runPerTich.js` (A) and the frontend bundle (B for staging / `storage/sagMain/` for prod).
2. Run the migration (§3) so each dashboard's widget **subscribes to `field_bundle_2`** — required,
   otherwise the widget never receives the second point.
3. Watch the log line on a **daily** tick: both numbers should be < ~10 180.

---

## 2. Plant‑stress card keeps last value on a skipped tick

**Problem.** IPSI/plant‑stress compute only on the hourly tick. On an off‑schedule / daily‑only run
(`hourTich=false`) the card flashed `Μη διαθέσιμο · Έλλειψη ωριαίου tick` and poisoned its cache.
(There was also a typo: the guard checked `"tich"` but the message says `"tick"`.)

**What changed.** On a merely‑skipped tick, `runPerTich.js` now **emits no `plant_stress`** — the
dashboard's existing sticky‑fallback keeps the last known value. Real sensor faults still show
`Μη διαθέσιμο` with the reason.

**What you need to do.** Deploy `runPerTich.js` (A). Self‑heals after one real hourly tick.

---

## 3. `migrateFieldBundle2.js` — subscribe dashboards to `field_bundle_2` (+ optional URL update)

Idempotent migration. **Selection (most specific wins):**
- `TARGET_DASHBOARD_ID` — one dashboard (use this for a first test).
- `TARGET_TAG_KEY` (+ optional `TARGET_TAG_VALUE`) — only dashboards carrying that tag. **Tag the
  dashboards you want** (e.g. `migrate_bundle2 = yes`), then run globally.
- neither → **all** dashboards.

**Options:**
- `UPDATE_WIDGET_URL=true` + `WIDGET_URL` → repoint the custom widget's iframe URL (default is the
  production `…/storage/sagMain/index.html`). Handy for promoting a build across many dashboards.
- `DRY_RUN=true` → report only, write nothing.

**What you need to do.**
1. Create the analysis, env `ACCOUNT_TOKEN`.
2. Test: `DRY_RUN=true` + `TARGET_DASHBOARD_ID=<one dashboard>` → check the log.
3. Live: set the tag on the dashboards you want, then run with `TARGET_TAG_KEY=migrate_bundle2`
   (optionally `UPDATE_WIDGET_URL=true` to also promote the prod build).

---

## 4. `createUserForClient.js` — new TagoRUN user for an existing client

Creates a run user with the **same `access` tag** the selected client carries, so the client's
existing access policy grants the user its dashboards (no new policy). Password defaults `sag1234`.

**Form scope variables:** `client` (device field), `user_name`, `user_email`, optional `user_password`.

**Form to build** (form widget, `data[].variables = ["client","user_name","user_email"]`, button → this analysis):
```json
{ "type": "device", "variable": "client", "label": "Πελάτης", "required": true,
  "device_filters": [ { "tag_key": "isClient", "tag_value": "yes" } ], "view_field": "name" }
{ "type": "text", "variable": "user_name",  "label": "Όνομα Χρήστη", "required": true }
{ "type": "text", "variable": "user_email", "label": "Email",        "required": true }
```

**What you need to do.** Create the analysis (env `ACCOUNT_TOKEN`) + the form; point the form's button at it.

---

## 5. `addSensorsToField.js` — add sensors to an existing field/dashboard

Companion to `createField`. Resolves the dashboard via the field device's **`fieldId` tag**, finds the
new devices by EUI, applies soil‑depth tags (§6/§7), appends each device's variables to the AgroGenius
custom widget(s) (`data[]` + `display.variables`), refreshes `device_map`, ensures `field_bundle_2`,
and merges the new devices into the field's `devices` tag.
(Subscription cost is **not** auto‑recomputed — adjust the field's `subscriptionCost` tag if needed.)

**Form scope variables:** `field` (device field, `isField=yes`), `devicesNum`, `deviceN` (QR/EUI),
optional `deviceN_name` (alias), optional `deviceN_soil` (Ρηχό/Βαθύ).

**Form to build** (mirror the create‑field form's device block; add these to `data[].variables`:
`field`, `devicesNum`, `device1..deviceN`, `device1_name..`, `device1_soil..`):
```json
{ "type": "device", "variable": "field", "label": "Εγκατάσταση", "required": true,
  "device_filters": [ { "tag_key": "isField", "tag_value": "yes" } ], "view_field": "name" }
{ "type": "number", "variable": "devicesNum", "label": "Αριθμός Νέων Συσκευών" }
{ "type": "qrcode", "variable": "device1", "label": "Συσκευή 1" }
{ "type": "text",   "variable": "device1_name", "label": "Όνομα Συσκευής 1 (προαιρετικό)" }
{ "type": "dropdown", "variable": "device1_soil", "label": "Βάθος Εδάφους (μόνο για lse01)",
  "options": [ { "label": "—", "value": "" }, { "label": "Ρηχό", "value": "shallow" }, { "label": "Βαθύ", "value": "deep" } ] }
```
Replicate the three device fields for each slot.

**What you need to do.** Create the analysis (env `ACCOUNT_TOKEN`) + the form. For deep lse01 probes,
also assign the deep parser (§7).

---

## 6. Update the create‑field form — alias + soil depth (one‑click)

The form needs two new fields per device slot:
- **`deviceN_name`** (text) — friendly alias; blank → the Tago device name is used (already read by
  `createField.js`).
- **`deviceN_soil`** (dropdown) — soil depth for single‑sensor lse01 probes (Ρηχό / Βαθύ); the analysis
  sets the device's `type` tag from it (§7).

**What you need to do — the easy way:** run **`analysis/patchCreateFieldForm.js`** once (env
`ACCOUNT_TOKEN`; optional `DRY_RUN=true` first). It inserts both fields after every `deviceN` QR field,
copies each slot's visibility condition, and subscribes the form to the new variables. Idempotent.
Defaults target dashboard `68f1fa2d46b86e0009bef545`, widget `68f1fa2d46b86e0009bef546` (override with
`FORM_DASHBOARD` / `FORM_WIDGET`).

> If your TagoIO form build rejects `type: "dropdown"`, change `deviceN_soil` to `type: "text"` (the
> analysis accepts `shallow`/`deep` or `Ρηχό`/`Βαθύ`, case‑insensitive).

**Manual alternative** — add `device1_name…`, `device1_soil…` to `data[0].variables` and one pair of
fields per slot (replicate, changing the number and the visibility `value` to `N-1`):
```json
{ "data": { "origin": "6829fa2e30e03a000abbdd41", "bucket": "681ca2d2ed3243000ab2d94b", "variable": "device1_name" },
  "icon": "tag", "id": "sag-device1-name", "label": "Όνομα Συσκευής 1 (προαιρετικό)",
  "show_new_line": true, "type": "text", "fixed_value": "",
  "visibility_conditions": [ { "condition": ">", "field": "p3hBtiqGoUZ6_nwfif9nW", "value": "0" } ] }
{ "data": { "origin": "6829fa2e30e03a000abbdd41", "bucket": "681ca2d2ed3243000ab2d94b", "variable": "device1_soil" },
  "icon": "layer-group", "id": "sag-device1-soil", "label": "Βάθος Εδάφους 1 (μόνο lse01)",
  "show_new_line": true, "type": "dropdown", "fixed_value": "",
  "options": [ { "label": "—", "value": "" }, { "label": "Ρηχό (shallow)", "value": "shallow" }, { "label": "Βαθύ (deep)", "value": "deep" } ],
  "visibility_conditions": [ { "condition": ">", "field": "p3hBtiqGoUZ6_nwfif9nW", "value": "0" } ] }
```

---

## 7. Soil depth — Ρηχό / Βαθύ with one or two devices

**How depth works.** Depth is decided by the **variable‑name suffix**: `_1` = **Ρηχό** (shallow),
`_2` = **Βαθύ** (deep). `se0x`/`lse02` are two‑depth probes (one device → both). `lse01` is single‑depth.

**Two single‑sensor probes as Ρηχό + Βαθύ — tag‑driven, NO parser change needed.**

- **From the form** — pick `deviceN_soil` = Ρηχό/Βαθύ. `createField.js` and `addSensorsToField.js`
  set the device's **`type` tag** to `lse01_shallow` / `lse01_deep` automatically (only lse01‑family
  devices; others skipped). The device keeps its **default parser** (emits bare `soil_moisture` etc.).
- **`runPerTich.js` AND `runPerTichLegacy.js`** — when a device is tagged `lse01_shallow`/`lse01_deep`,
  the read loop pulls its bare `soil_moisture`/`temp_soil`/`conduct_soil`, **remaps them to the `_1`/`_2`
  slot** for all calculations (IPSI/root‑zone), and **re‑publishes** the suffixed value back to the
  device so the dashboard's Ρηχό/Βαθύ cards populate. Fully tag‑driven — the tag does everything.

**What you need to do:** just pick Ρηχό/Βαθύ in the form. That's it. (Redeploy `runPerTich.js` and, if
you use it, `runPerTichLegacy.js`.)

**Optional (cleaner device‑level data):** `payload_parsers/dragino_lse01_shallow_parser.js` /
`_deep_parser.js` make the device emit `_1`/`_2` natively. The read loop handles this case too (no
remap/republish needed), so assigning them is **optional**, not required.

> A single shallow probe left as plain `type: lse01` also works (its bare `soil_moisture` maps to the
> shallow slot by name).

> **Form note:** the depth dropdown can't detect the device type from an EUI at form time, so show it
> for every device slot — the analysis simply ignores it for non‑lse01 devices.

---

## 8. Forecast (OpenMeteo) — no action needed for the split

The `forecast` card variable is **already OpenMeteo** (`provider: open-meteo`, `hourly_epoch` format the
dashboard renders natively). `runPerTich` does **not** write it — a **separate forecast analysis** does.
So switching to the new `runPerTich` can't affect the forecast card. If a field's forecast looks stale,
the fix is to (re)trigger that separate forecast analysis for it — unrelated to these updates.

---

## Files changed / added this cycle

| File | Change |
|------|--------|
| `analysis/runPerTich.js` | field_bundle split; plant_stress skip fix; **tag‑driven soil depth** (remap + republish); size log |
| `analysis/runPerTichLegacy.js` | **tag‑driven soil depth** (remap + republish) |
| `src/Dashboard.tsx` | subscribe + deep‑merge `field_bundle_2`; per‑crop sticky |
| `analysis/createField.js` | soil‑depth form tagging; lse01 depth variants; (alias already supported) |
| `analysis/patchCreateFieldForm.js` | **new** — adds `deviceN_name` + `deviceN_soil` to the form |
| `analysis/migrateFieldBundle2.js` | tag‑scoped selection + widget‑URL update |
| `analysis/createUserForClient.js` | **new** — user for existing client |
| `analysis/addSensorsToField.js` | **new** — add sensors to existing field |
| `payload_parsers/dragino_lse01_shallow_parser.js` / `_deep_parser.js` | **new** — depth‑pinned lse01 (optional; depth is tag‑driven) |
| `dist-sagMainStaging/*` | rebuilt frontend bundle |
