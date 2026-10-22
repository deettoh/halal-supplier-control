# Startup seed format

The fictional dataset merged from main is at `src/seed/seed.json`.
Missing file means skip seeding; an existing but invalid file fails startup.
The JSON supplies certificate `image_file` paths. All four demo PNGs are
committed under `src/seed/certificates/` and loaded into PostgreSQL at startup.
Missing PNGs are allowed; later startups fill photos for existing matching
certificates whose `image_bytes` is still null. Existing photos are preserved.

The top-level object accepts five arrays: `suppliers`, `certificates`,
`materials`, `deliveries`, and `activity_log`. Omitted arrays default to empty.
Each row needs an explicit positive integer `id`, unique within its array.
Fields match the database and shared API contract; unknown fields are rejected.
Dates use YYYY-MM-DD; supplied timestamps require a timezone.

The seed uses `{product_name, brand}` scope objects. Rules check the product
and any explicit brand restriction; a null brand means no brand restriction.
For compatibility, the loader also accepts product-name strings and converts
them to scope objects with a null brand.

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
    "image_file": "images/sample-certificate.png"
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

`image_file` is optional and relative to seed.json. It must stay within the
seed directory and use a `.png` extension. Missing files are skipped; present
files must have a PNG signature. The bytes are stored in PostgreSQL and `image`
is set to the future `/api/certificates/{id}/image` URL (or deliveries URL).
The image endpoints enforce SME/supplier access and return PNG bytes. No
`image_content_type` field is needed: image responses will use `image/png`.
Actual image decoding/resizing is not performed by the loader.
Without `image_file`, certificates may omit the image. Reference-only rows
may use `image`, which stores text and does not load any file.

On every startup, missing certificate photos are filled from available seed
PNGs, including when the certificates table is populated. The existing row
must match the seed ID, supplier ID and certificate number. Only null
`image_bytes` is filled; stored photos and other fields are left unchanged.
This is a startup action, not a continuous file watcher. For a new certificate
added after the table was populated, use the normal backend workflow; this
photo backfill does not insert new rows into populated tables.

Deliveries additionally require `tenant`, `material_id`, `extracted`, the five
ordered `rule_results`, `verdict`, `status`, and an image reference/file.
`extracted` may be null, otherwise it follows the current four-field
LabelExtraction. `error`, `decided_by`, `reason`, and `created_at` are optional;
terminal decisions must satisfy the database's actor/reason constraint.

Activity rows require `tenant`, `actor`, `role`, and `action`.
`delivery_id`, `reason`, and `created_at` are optional. Omitted timestamps
are assigned UTC startup time; use explicit timestamps for historical demos.

Each nonempty table skips row insertion (apart from the photo fill above).
Empty tables receive their supplied rows in dependency order, inside one
transaction. Therefore IDs in seed data
must match any existing parent records; the loader does not silently remap,
merge, or replace them. A missing parent, invalid existing PNG or failed
constraint rolls back all inserts and photo fills from that attempt.
PostgreSQL startup workers use a transaction
advisory lock to prevent duplicate concurrent seeding.

PostgreSQL ID sequences advance past seeded IDs without moving an already
higher sequence backwards. This lets later uploads obtain new IDs safely.
This loader is initial setup, not a reset or a tool for editing populated data.
