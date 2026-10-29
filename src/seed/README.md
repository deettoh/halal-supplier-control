# Seed data

`seed.json` holds the fictional demo data: 2 suppliers, 4 certificates and 16
materials across Sunrise Bakery SAMPLE and Crescent Caterer SAMPLE. The
certificate images in `certificates/` are AI-generated PNGs marked SAMPLE.

To recount the rows, run:

```bash
python3 -c 'import json; print({k: len(v) for k, v in json.load(open("src/seed/seed.json")).items()})'
```

Startup loads this file into empty tables, and the demo reset loads it into
all tables (see [the database guide](../../docs/database.md)). Startup skips
seeding when the file is missing and stops when the file fails validation.

## The file has five arrays

The top-level object has `suppliers`, `certificates`, `materials`,
`deliveries` and `activity_log`. An omitted array counts as empty. Every row
needs a positive integer `id`, unique within its array, and unknown fields
are rejected. Dates use `YYYY-MM-DD`, and timestamps need a timezone.

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
    "image_file": "certificates/sample-certificate.png"
  }],
  "materials": [{
    "id": 1,
    "tenant": "SAMPLE Bakery",
    "name": "Flour",
    "supplier_id": 1,
    "approved_brand": "SAMPLE Brand",
    "approved_manufacturer": "SAMPLE Maker"
  }]
}
```

- `scope` is a list of `{product_name, brand}` objects. A `null` brand means
  no brand restriction for that product. A plain product-name string is also
  accepted and becomes an object with a `null` brand.
- `image_file` is optional, relative to this folder, and must be a `.png`
  inside it. Startup stores that PNG in PostgreSQL as JPEG and sets `image`
  to `/api/certificates/{id}/image`. The PNG in the repo stays unchanged.
- Deliveries also need `tenant`, `material_id`, `extracted` (or `null`), the
  six ordered `rule_results`, `verdict`, `status` and an image. A decided
  delivery needs `decided_by` and a `reason`.
- Activity rows need `tenant`, `actor`, `role` and `action`. The action is
  one of `auto_accepted`, `pending_review`, `accepted`, `rejected` or
  `certificate_renewed`. A row without `created_at` gets the startup time in
  UTC.

## Startup loads rows once and fills missing photos

- Startup fills only empty tables and loads them in dependency order within
  one transaction. IDs must match existing parent rows, and the loader
  doesn't remap them.
- On every startup, a certificate with no stored photo gets its PNG when the
  seed ID, supplier ID and certificate number all match.
- Startup advances the PostgreSQL ID sequences past the seeded IDs, so new
  uploads get fresh IDs.
- Startup rolls back the whole load on a missing parent, an unreadable PNG or
  a failed constraint.
