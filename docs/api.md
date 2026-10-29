# API reference

The FastAPI app in `src/backend/main.py` serves the JSON API under `/api`.
FastAPI's generated `/docs` page and `/openapi.json` are the executable
reference, and the request and response models are in
`src/backend/schemas.py`. Business logic is in `src/backend/services.py`.

## Identify the caller with demo headers

Every business route needs `X-Demo-Role` (`staff`, `supervisor`,
`supplier` or `reviewer`) and `X-Demo-Tenant`. For staff and supervisors the tenant is the
SME name, for example `Sunrise Bakery SAMPLE`. For a supplier it is the
supplier ID as a string, for example `1`. These headers simulate Orbyte's
login and aren't authentication.

The services check both the role and ownership: materials, deliveries and
activity are filtered by the SME, and supplier routes take the supplier ID
from the header.

Certificate routes for suppliers and registry reviewers also require
`X-Demo-Person`, validated against the seeded person's role and tenant.
Hakim is supplier `1`, person `5`; Priya is supplier `2`, person `6`;
Nadia is reviewer `registry`, person `7`. A mismatch returns
`403 {"detail": "Demo person not permitted"}`. These are simulated identities.
The global person picker, delivery identity and enriched log fields are
scheduled separately in task 5.1; they are not implemented by task 4.1.

## Routes under `/api`

| Method | Path | Role | Request | Success |
|---|---|---|---|---|
| GET | `/api/health` | none | - | 200, works without a database |
| GET | `/api/materials` | staff, supervisor | - | 200, the SME's materials with computed coverage |
| POST | `/api/deliveries` | staff | multipart `material_id`, `image` | 201, the checked delivery |
| GET | `/api/deliveries` | supervisor | `status=pending_review` | 200, the SME's review queue |
| POST | `/api/deliveries/{id}/decision` | supervisor | JSON `decision` (`accept` or `reject`), `reason` | 200, the updated delivery |
| GET | `/api/activity` | supervisor | - | 200, the SME's activity log, newest first |
| GET | `/api/certificates` | supplier | - | 200, the supplier's active, superseded, pending and rejected certificates |
| POST | `/api/certificates` | supplier | multipart `issuer`, `cert_no`, `holder_name`, `expiry_date`, `scope`, optional `image` | 201, a pending renewal; coverage unchanged |
| POST | `/api/certificates/extract` | supplier | multipart `image` | 501, not implemented |
| GET | `/api/deliveries/{id}/image` | staff, supervisor | - | 200, JPEG of the SME's delivery photo |
| GET | `/api/certificates/{id}/image` | staff, supervisor, supplier, reviewer | - | 200, JPEG for the owning supplier, a linked SME or registry reviewer |
| GET | `/api/registry/renewals` | reviewer | - | 200, pending renewals oldest first with current certificate and supplier name |
| POST | `/api/registry/renewals/{id}/decision` | reviewer | JSON `decision` (`verify` or `reject`), nonblank `note` | 200, updated certificate |

To recount the routes, run `grep -cE '^@app\.(get|post)' src/backend/main.py`.

List responses are plain JSON arrays with no pagination. IDs are positive
integers and dates use `YYYY-MM-DD`. Certificate expiry and the 60-day
warning use today's date in `Asia/Kuala_Lumpur`. Audit timestamps are UTC
with a `Z` suffix. Fields typed as nullable are still present in every
response.

## Failures return a status and a `detail` message

| Status | Cause |
|---|---|
| 403 | Role not allowed, or person does not match role and tenant |
| 404 | Unknown record or one owned by another SME or supplier |
| 409 | Delivery already decided/still processing, pending renewal already exists, or renewal already reviewed |
| 413 | Upload larger than 10 MiB |
| 422 | Missing or invalid headers, fields or image |
| 501 | `POST /api/certificates/extract` |
| 503 | Database unavailable |

A request rejected with 403, 404, 413 or 422 writes no records and no activity
rows.

## A delivery check saves the photo before calling the model

A delivery check runs in these steps:

1. Validate the role, the material's ownership and the photo. The photo must
   be a PNG or JPEG of at most 10 MiB.
2. Save the photo as JPEG with an internal marker, so the row stays out of the
   review queue while the model runs.
3. Call `backend.extract.extract_label` with a 180-second timeout and no
   retries. The database connection is released during the call.
4. Re-read the material and the supplier's active certificate, then run rules
   R1 to R5 from `backend.rules`.
5. Save the reading, the five rule results, the verdict, the status and an
   activity row in one transaction.

| Verdict | Status |
|---|---|
| `covered`, `expiring` | `auto_accepted` |
| `substitution`, `not_covered`, `needs_human` | `pending_review` |

If the model call fails, the delivery is still saved with 201, verdict
`needs_human`, a sanitized `error` message, R1 failed and R2 to R5 not
evaluated.
For the prepared demo photos, a failed call falls back to a stored reading in
`src/backend/demo_cache.json`, keyed by the SHA-256 of the uploaded bytes. A
reading that arrives after the 180-second deadline is discarded unless it
matches the stored reading, and it can't overwrite a supervisor's decision.

## Five rules decide the verdict

Every delivery has five rule results, R1 to R5 in order. `passed` is `true`,
`false` or `null`, where `null` means the rule wasn't evaluated, for example
because the label couldn't be read. `detail` gives the reason.

| Rule | Check | Verdict if it fails |
|---|---|---|
| R1 | Product, brand and manufacturer read from the label | `needs_human` |
| R2 | Brand and manufacturer match the masterlist (rapidfuzz score of 90 or more) | `substitution` |
| R3 | The certificate scope covers the product and brand | `not_covered` |
| R4 | The certificate hasn't expired | `not_covered` |
| R5 | The issuer is on the recognised list | `not_covered` |

The first failing rule sets the verdict. When all five pass and the certificate
expires within 60 days, the verdict is `expiring`.

## Decisions and renewals commit with their activity rows

A decision needs `accept` or `reject` and a nonblank reason. The delivery row
is locked, and the decision and its activity row commit together.

A supplier submission locks the supplier, saves a `pending` certificate and
writes `certificate_submitted` to each linked SME's log. It never changes
coverage. Only one pending renewal per supplier is allowed (409 on a second).
The reviewer queue returns `{renewal, current, supplier_name}`; `current` can
be null. Reviewer decisions need a nonblank note. Verification makes the
renewal active and supersedes the old active certificate; rejection keeps
the old certificate and marks the renewal rejected. Each decision and its
per-SME activity rows commit atomically. Concurrent reviews have one winner;
subsequent decisions return 409. Unknown IDs return 404. Certificate responses
include nullable `review_note` and `reviewed_by` (the reviewer's name).

A submission with its JSON `scope` field looks like this:

```javascript
const data = new FormData();
data.append("issuer", "SAMPLE Food Certification Council");
data.append("cert_no", "SAMPLE-GGS-2027-001");
data.append("holder_name", "Golden Grain Supplies SAMPLE");
data.append("expiry_date", "2027-11-30");
data.append("scope", JSON.stringify([{ product_name: "Wheat Flour", brand: "GoldenMill" }]));
await fetch("/api/certificates", {
  method: "POST",
  headers: { "X-Demo-Role": "supplier", "X-Demo-Tenant": "1", "X-Demo-Person": "5" },
  body: data, // the browser sets the multipart boundary
});
```

Issuer and holder name allow 200 characters and the certificate number 100.

## Activity actions

Activity `action` is one of `auto_accepted`, `pending_review`, `accepted`,
`rejected`, `certificate_submitted`, `certificate_renewed` or
`certificate_rejected`. The API, seed loader and database enforce this list.
Certificate submission rows name the supplier contact; verification and
rejection rows name the reviewer and retain the note as `reason`. Each
certificate event writes to every linked SME. Delivery actors remain roles
until task 5.1. See [the frontend handoff](registry-renewal-review.md).

## Photos are stored and served as JPEG

Uploads accept PNG or JPEG. `backend.images` stores them as JPEG at quality 85
with full resolution, upright orientation and transparency flattened onto
white. The model gets the same encoding resized to at most 1280 pixels. The
image routes return `image/jpeg` with `no-store` and `nosniff` headers. They
need the demo headers, so a browser fetches them and displays a blob URL.
