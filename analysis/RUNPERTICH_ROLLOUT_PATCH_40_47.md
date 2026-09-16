# runPerTich — Rollout & Per‑Patch Enable Guide (PATCH_40..47)

Correctness fixes from the **legacy handoff (2026‑07‑04)**, ported onto the current
`runPerTich.js` (which already carries the `field_bundle` split + crop‑GDD double‑count fix).
Companion to `RUNPERTICH_ROLLOUT.md` (patches 18–39) — same flag system, same deploy sequence.

> **Nothing else changed.** These are the only new kernel behaviours in this batch. The
> declaration‑UX + `action_log` additions ride the existing `PATCH_18/19` handlers.

---

## How the flags work (recap)

| Env var (TagoIO Analysis) | Effect |
|---|---|
| `ENABLE_PATCH_<n> = false` | Disable patch `n`. |
| `ENABLE_PATCH_<n> = true` *(or unset)* | Enable — **all patches default ON**. |
| `ENABLE_PATCH_DISABLE_ALL = true` | Master kill switch — every patch OFF → v1‑equivalent. |

The env loop scans `ENABLE_PATCH_1..50`, so **40–47 are toggleable** without a redeploy.
A rollback takes effect on the **next tick**.

---

## Patch table (recommended canary order, safest first)

| # | PATCH | What it does | New output var | Visible only if / notes |
|---|-------|--------------|----------------|-------------------------|
| 1 | **46** | Monotonic severity colours: Μέτριος blue→**yellow**, Υψηλός yellow→**orange** (green→yellow→orange→red). | — (recolours `fir_message_*`) | Display‑only. Zero numeric change. Safe anytime. |
| 2 | **43** | Pest‑generation confidence → **advisory** while dd‑per‑generation spacings are provisional (never "high"). | — (metadata `confidence`) | Display‑only (badge red→orange for provisional). Safe. |
| 3 | **47** | VPD via **FAO‑56 Eq.12** — pairs es with daily **RH extremes** when present. | — (refines `vpd`) | **No‑op unless** `air_humidity_max` + `air_humidity_min` exist (daily). Falls back to the old formula otherwise. |
| 4 | **44** | **DLI fix** — a pre‑summed `light_intensity_sum` series is no longer re‑multiplied ×3600. | — (corrects BPI light factor) | **No‑op unless** the device sends `light_intensity_sum`. s2120 (`light_intensity`) is unaffected. Large BPI correction on affected fields. |
| 5 | **42** | **Rain‑gauge presence gate** — "no gauge" is no longer read as "permanently dry / never washed off". | — (refines FIR + pesticide PEI) | **No‑op on fields WITH a rain sensor** (`rain_height*`). On no‑gauge fields: infection risk may rise, pesticide protection may fall. |
| 6 | **40** | **BPI blind‑field guard** — no/faulted soil probe caps `f_IPSI ≤ 0.85` + emits a low‑confidence chip. | **`bpi_confidence` = LOW** | **No‑op on fields WITH a working soil probe.** The chip needs a frontend card to be *seen* (data is emitted regardless). Lowers BPI on probe‑less fields. |
| 7 | **41** | **BPI maintenance respiration ∝ standing biomass** (prior `bpi_total_actual`), not same‑day GPP. | — (changes daily BPI growth) | Affects **all** fields with accumulated `bpi_total_actual`. Respiration now dominates on dull days (intended). Watch BPI trends. |
| 8 | **45** | **FIR host‑susceptibility** — missing BPI → `bpiNorm 0.0` (not 0.5); HS weights re‑set to sum to 1.0 (`0.10+0.60+0.30`) so the top "Σοβαρός" band is reachable. | — (changes **all FIR values**) | **Changes pathogen risk numbers across every field.** Highest‑visibility patch — enable last and watch the pathogen alarms. |

**Ordering rationale:** display‑only first (46, 43), then the conditional/no‑op‑on‑most fixes
(47, 44, 42), then the BPI changes (40, 41), and finally **45 which shifts every FIR** — so any
surprise in the pathogen cards is unambiguously attributable to 45.

---

## What testers will actually *see* change

- **45 (R10):** pathogen FIR values shift — e.g. the KEK‑TEST melon `podosphaera_xanthii` FIR
  moves from its current 0.83 under the new weights. **This is the intended correctness fix, not a bug.**
- **46 (R11):** the Μέτριος / Υψηλός badges recolour (blue/yellow → yellow/orange).
- **41 (R1):** BPI daily growth changes on all fields (respiration now scales with biomass).
- **40 (R2):** only on fields **without** a soil‑moisture sensor — BPI drops a little and a
  `bpi_confidence = LOW` chip appears (render it in the BPI card to surface it).
- **43/44/47/42:** no change on a typical s2120 + soil‑probe + rain field until the specific
  input condition applies (provisional pest / pre‑summed lux / RH extremes / no rain gauge).

> On the **KEK‑TEST** field (s2120 with rain, se0x/lse02 soil probe): 44 and 42 are effectively
> no‑ops (it has lux `light_intensity`, not `_sum`, and a rain gauge). 47 depends on whether
> `air_humidity_max/min` are present. 40 is a no‑op (it has a soil probe). So on that field the
> observable changes are mainly **45, 46, 41**.

---

## Deploy sequence (test‑first)

1. **Paste** `analysis/runPerTich.js` into the **test analysis** (`FIELD_TAG_VALUE=yesTEST`).
2. **Canary one at a time**, in the table order, watching the test field 24–48 h between steps:
   ```
   ENABLE_PATCH_45 = false
   ENABLE_PATCH_44 = false
   ENABLE_PATCH_42 = false
   ENABLE_PATCH_41 = false
   ENABLE_PATCH_40 = false
   ENABLE_PATCH_43 = false
   ENABLE_PATCH_47 = false
   ENABLE_PATCH_46 = false
   ```
   Remove a line (or set `=true`) to turn that patch on. All default ON if you set none.
3. **Dormant production** = `ENABLE_PATCH_DISABLE_ALL=true` → 100% v1‑equivalent (40..47 all revert,
   verified: each is fully gated, with `false`/`DISABLE_ALL` restoring the pre‑fix expression).

---

## Rollback
- One patch: `ENABLE_PATCH_<n> = false` (next tick).
- Everything (true v1): `ENABLE_PATCH_DISABLE_ALL = true`.

---

## Also in this batch (not flag‑numbered)
- **`action_log`** — on each spray/inspection declaration the kernel emits a durable **standalone**
  device point (Greek summary + env snapshot: `fir_before_reset`, air temp, RH, rain, IPSI,
  `bpi_efficiency_pct`, product, protection days/end). Rides `PATCH_18/19`; **never** emits a
  valve/irrigation field. **Retain `action_log` in the device bucket** — it's the training dataset.
- **Declaration UX** (widget) — in‑modal *product* + *protection‑days* fields replace the
  `window.prompt`; a read‑only "🛡️ Προστασία ενεργή · έως …" chip is derived from
  `spray_protection_end_*`.
