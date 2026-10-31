# Seed data

`seed.json` holds the fictional demo data: 2 suppliers, 4 certificates, 16
materials across Sunrise Bakery SAMPLE and Crescent Caterer SAMPLE, and 7
people. The certificate images in `certificates/` are AI-generated PNGs
marked SAMPLE.

To recount the rows, run:

```bash
python3 -c 'import json; print({k: len(v) for k, v in json.load(open("src/seed/seed.json")).items()})'
```

Startup loads this file into empty tables, and the demo reset loads it into
all tables (see [the database guide](../../docs/database.md)). When the file
is missing, startup skips seeding, and it stops when the file fails
validation.

## The file has seven arrays

The top-level object has `suppliers`, `certificates`, `materials`,
`deliveries`, `activity_log`, `people` and `sme_settings`.
An omitted array counts as empty.
Every row needs a positive integer `id`, unique within its array, and unknown
fields are rejected. Dates use `YYYY-MM-DD`, and timestamps need a timezone.

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

- People need `id`, `name`, `title`, `role` and `tenant`. The role is
  `staff`, `supervisor`, `supplier` or `reviewer`. The reviewer's tenant is
  `registry`, and a supplier contact's tenant is the supplier ID as a string.
  The `X-Demo-Person` header names one of these people.
- `sme_settings` holds one row per SME, with `id`, `tenant`,
  `recognised_issuers`, `match_threshold` and `expiry_warning_days`.
  Tenant names match the material and people records exactly. Issuer names
  must be nonblank, the threshold is from 0 to 100, and the warning window
  is a nonnegative whole number of days. Duplicate tenants are rejected.
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
  one of `auto_accepted`, `pending_review`, `accepted`, `rejected`,
  `certificate_submitted`, `certificate_renewed` or `certificate_rejected`. A
  row without `created_at` gets the startup time in UTC.

## Startup loads rows once and fills missing photos

- Startup fills only empty tables and loads them in dependency order within
  one transaction. IDs must match existing parent rows, and the loader
  doesn't remap them.
- Settings are an exception to the empty-table rule: startup inserts missing
  SME policies by tenant, retaining existing policies and database edits.
- On every startup, a certificate with no stored photo gets its PNG when the
  seed ID, supplier ID and certificate number all match.
- Startup advances the PostgreSQL ID sequences past the seeded IDs, so new
  uploads get fresh IDs.
- Startup rolls back the whole load on a missing parent, an unreadable PNG or
  a failed constraint.

## Per-SME rule settings (Task 5.4)

| SME | Recognised issuers | Match threshold | Expiry warning days |
| --- | --- | --- | --- |
| Sunrise Bakery SAMPLE | SAMPLE Food Certification Council | 90 | 60 |
| Crescent Caterer SAMPLE | SAMPLE Food Certification Council | 90 | 45 |

Live delivery checks and masterlist coverage read the requesting SME's row
from the `sme_settings` database table. R2 uses its threshold for brand and
manufacturer, R5 uses its issuer list, and the expiring verdict uses its
warning window. Product matching, rule priority and R6 are unchanged.
Masterlist coverage still excludes the delivery-photo mark check.

Changing seed JSON does not overwrite a policy already in the database.
Startup backfills missing policies; an explicit demo reset restores seed
policies. Missing or invalid policies return 503 instead of silently using
another SME's settings. Existing delivery verdicts remain historical results.

Offline callers may pass a validated `RuleSettings` to `rules.evaluate`.
If omitted, the material must have a known `tenant`; evaluation loads that
tenant's policy from this seed file. There is no global policy fallback.
The new policy module and seed are included in future evaluation source
hashes. Previously recorded evaluation artifacts are not rewritten.

Policy storage is separate from the manual expiry check described in
[the API guide](../../docs/api.md#manual-expiry-check). There is no settings
editor or scheduler.

Certificate seed rows may omit `renewal_requested_on` (defaults to null) or
set an ISO date for a historical request. Activity rows may use
`renewal_requested` with the reviewer name/title and supplier name, leaving
delivery ID, material and verdict null. The existing seed records are not
changed or pre-marked by the expiry implementation.
