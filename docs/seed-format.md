# Startup seed format

The fictional dataset merged from main is at `src/seed/seed.json`.
Missing file means skip seeding; an existing but invalid file fails startup.
The JSON supplies certificate image references, but no image assets yet.

The top-level object accepts five arrays: `suppliers`, `certificates`,
`materials`, `deliveries`, and `activity_log`. Omitted arrays default to empty.
Each row needs an explicit positive integer `id`, unique within its array.
Fields match the database and shared API contract; unknown fields are rejected.
Dates use YYYY-MM-DD; supplied timestamps require a timezone.

Certificate scope also accepts product-name strings, as used by the merged
Member 5 seed. The loader normalizes each string to a `{product_name, brand}`
object with a null brand. Rules accept both string and structured scope lists.

Minimal fictional format example (not the final seed dataset):

```json
{
  "suppliers": [{"id": 1, "name": "SAMPLE Supplier"}],
  "certificates": [{
    "id": 1,
    "supplier_id": 1,
    "issuer": "SAMPLE Issuer",
    "cert_no": "SAMPLE-001",
    "holder_name": "SAMPLE Supplier",
    "expiry_date": "2027-12-31",
    "scope": [{"product_name": "Flour", "brand": "SAMPLE Brand"}],
    "status": "active",
    "image_file": "images/sample-certificate.png",
    "image_content_type": "image/png"
  }],
  "materials": [{
    "id": 1,
    "tenant": "bakery",
    "name": "Flour",
    "supplier_id": 1,
    "approved_brand": "SAMPLE Brand",
    "approved_manufacturer": "SAMPLE Maker"
  }]
}
```

`image_file` is optional, relative to seed.json, and must stay within the seed
directory. When supplied, it requires `image_content_type` (`image/png`,
`image/jpeg`, or `image/webp`); the referenced nonempty bytes are stored in
PostgreSQL. File/type pairing is validated; actual image decoding/resizing is
not performed by the loader. Without `image_file`, certificates may omit
the image. Existing reference-only seed rows may use the legacy `image` field.

Deliveries additionally require `tenant`, `material_id`, `extracted`, the five
ordered `rule_results`, `verdict`, `status`, and an image reference/file.
`extracted` may be null, otherwise it follows the current four-field
LabelExtraction. `error`, `decided_by`, `reason`, and `created_at` are optional;
terminal decisions must satisfy the database's actor/reason constraint.

Activity rows require `tenant`, `actor`, `role`, and `action`.
`delivery_id`, `reason`, and `created_at` are optional. Omitted timestamps
are assigned UTC startup time; use explicit timestamps for historical demos.

Each nonempty table is left untouched. Empty tables receive their supplied
rows in dependency order, inside one transaction. Therefore IDs in seed data
must match any existing parent records; the loader does not silently remap,
merge, or replace them. A missing parent/file or failed constraint rolls back
all inserts from that attempt. PostgreSQL startup workers use a transaction
advisory lock to prevent duplicate concurrent seeding.

PostgreSQL ID sequences advance past seeded IDs without moving an already
higher sequence backwards. This lets later uploads obtain new IDs safely.
This loader is initial setup, not a reset or a tool for editing populated data.
