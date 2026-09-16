# Catalog Schema — costing_list

This document describes the data model, storage format, and versioning strategy for the product catalog used by `costing_list_editor.html` and `offer_maker.html`.

---

## TagoIO variable

| Field | Value |
|---|---|
| Variable name | `costing_list` |
| `value` | `"catalog_v4"` (or `"catalog_v3"` for older saves) |
| `metadata.cl` | base64-encoded zlib-compressed JSON (v4) |
| `metadata.v` | schema version (4) |
| `metadata.u` | ISO timestamp of last save |
| `metadata.ic` | item count |
| `metadata.pc` | packet count |

---

## Schema versions

### v4 (current, compressed — ~6 KB for 171 items)

Saved to `metadata.cl` as a **base64-encoded zlib-compressed** JSON string.
Compression: browser `CompressionStream('deflate')` on save, `DecompressionStream('deflate')` on load.

```json
{
  "v": 4,
  "u": "2025-01-01T00:00:00.000Z",
  "c": "EUR",
  "g": { "n": "MACC", "e": "...", "p": "...", "w": "...", "vat": "...", "a": "...", "vr": 0.24 },
  "ct": ["Αγρομετεωρολογία", "Έξυπνη Άρδευση"],
  "in": ["Αμπελουργία", "Ελαιοκαλλιέργεια"],
  "vn": ["Davis", "Campbell"],
  "i": [
    ["SKU001", 0, 0, 0, 1200.00, "Περιγραφή προϊόντος"],
    ["SKU002", 1, 1, 1, 350.00, "Άλλο προϊόν", "https://manual.url", "Εσωτ. σημείωση", "sub_abc123"]
  ],
  "pk": [
    {
      "id": "pkt_xyz",
      "n": "Βασικό Πακέτο",
      "ds": "Περιγραφή πακέτου",
      "en": true,
      "it": [{ "sku": "SKU001", "q": 1 }, { "sku": "SKU002", "q": 2 }]
    }
  ],
  "sb": [
    { "id": "sub_abc123", "n": "Ετήσια Συνδρομή", "pr": 180.00, "ds": "Πλατφόρμα + υποστήριξη" }
  ]
}
```

#### Item array positions
| Pos | Field | Type | Notes |
|---|---|---|---|
| 0 | `sku` | string | Unique product code |
| 1 | `cat` | int | Index into `ct[]` (categories) |
| 2 | `ind` | int | Index into `in[]` (industries/applications) |
| 3 | `ven` | int | Index into `vn[]` (vendors) |
| 4 | `pr` | number | Price in EUR |
| 5 | `d` | string | Description (Greek) |
| 6 | `mu` | string | Manual URL (optional) |
| 7 | `nt` | string | Internal notes (optional) |
| 8 | `sb` | string | Subscription ID reference (optional) |

Trailing optional positions are omitted when empty.

### v3 (internal working format)

Used as the **in-memory working format** by both widgets after loading. Also written to `metadata.cl` as a plain JSON object by older saves.

```json
{
  "v": 3,
  "u": "ISO timestamp",
  "c": "EUR",
  "g": { "n": "", "e": "", "p": "", "w": "", "vat": "", "a": "", "vr": 0.24 },
  "i": [{ "sku": "", "cat": "", "ind": "", "ven": "", "pr": 0, "d": "", "mu": "", "nt": "", "sb": "" }],
  "pk": [{ "id": "", "n": "", "ds": "", "en": true, "it": [{ "sku": "", "q": 1 }] }],
  "sb": [{ "id": "", "n": "", "pr": 0, "ds": "" }]
}
```

### v2 (old verbose, read-only)

The original format from the seed file `costing_list_seed_v2.json`. Stored as `metadata.costing_list` (object, ~96 KB). Both widgets can read this and normalize it to v3 internally, but will never write it.

---

## General data (`g`)

| Key | Description |
|---|---|
| `n` | Company name |
| `e` | Email |
| `p` | Phone |
| `w` | Website |
| `vat` | VAT number (ΑΦΜ) |
| `a` | Address |
| `vr` | VAT rate (e.g. `0.24` = 24%) |

---

## Subscriptions (`sb`)

Each subscription is a recurring service fee associated with one or more products.

| Key | Description |
|---|---|
| `id` | Unique string ID (e.g. `"sub_abc123"`) |
| `n` | Name (Greek) |
| `pr` | Price in EUR (per period) |
| `ds` | Description (Greek) |

Products reference a subscription via the item `sb` field (subscription ID string).

**offer_maker behavior**: When a product with a `sb` reference is added to a quote, the corresponding subscription line is automatically added to the quote (once, even if multiple items share the same subscription).

---

## Load priority (both widgets)

1. `metadata.cl` as **string** → inflate (zlib) → parse JSON → normalize (v4 or v3)
2. `metadata.cl` as **object** → normalize as v3
3. `metadata.costing_list` as object/string → normalize as v2/v3
4. `value` as JSON string → normalize

---

## Seed files

| File | Format | Size | Notes |
|---|---|---|---|
| `costing_list_seed_v2.json` | v2 verbose | ~96 KB | Original, read-only reference |
| `costing_list_seed_v4.json` | v4 compressed | ~6.3 KB | Use this to seed TagoIO |

To seed: send `costing_list_seed_v4.json` as a TagoIO data point for the `costing_list` variable.
