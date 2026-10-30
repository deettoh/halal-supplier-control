# API reference

The FastAPI app in `src/backend/main.py` serves the JSON API under `/api`.
FastAPI's `/docs` page and `/openapi.json` are the generated
reference, and the request and response models are in
`src/backend/schemas.py`. Business logic is in `src/backend/services.py`.

## Identify the caller with demo headers

Every business route needs `X-Demo-Role` (`staff`, `supervisor`, `supplier`
or `reviewer`) and `X-Demo-Tenant`. For staff and supervisors the tenant is
the SME name, for example `Sunrise Bakery SAMPLE`. For a supplier it is the
supplier ID as a string, for example `1`, and for the registry reviewer it is
`registry`. These headers simulate Orbyte's login and aren't authentication.

The route dependencies check the role, and the services check ownership by
filtering materials, deliveries and activity to the caller's SME and by taking
a supplier's ID from the `X-Demo-Tenant` header.

Supplier and reviewer requests also need `X-Demo-Person`, the ID of a person
in the `people` list in `src/seed/seed.json`. The backend returns 403 when
that person's role and tenant don't match the other two headers.

## Thirteen routes under `/api`

| Method | Path | Role | Request | Success |
|---|---|---|---|---|
| GET | `/api/health` | none | - | 200, available without a database |
| GET | `/api/materials` | staff, supervisor | - | 200, the SME's materials with computed coverage |
| POST | `/api/deliveries` | staff | multipart `material_id`, `image` | 201, the checked delivery |
| GET | `/api/deliveries` | supervisor | `status=pending_review` | 200, the SME's review queue |
| POST | `/api/deliveries/{id}/decision` | supervisor | JSON `decision` (`accept` or `reject`), `reason` | 200, the updated delivery |
| GET | `/api/activity` | supervisor | - | 200, the SME's activity log, newest first |
| GET | `/api/certificates` | supplier | - | 200, the supplier's active, superseded, pending and rejected certificates |
| POST | `/api/certificates` | supplier | multipart `issuer`, `cert_no`, `holder_name`, `expiry_date`, `scope`, optional `image` | 201, the pending renewal |
| POST | `/api/certificates/extract` | supplier | multipart `image` | 200, either the certificate fields from the photo or a null `extracted` with an `error` message |
| GET | `/api/deliveries/{id}/image` | staff, supervisor | - | 200, JPEG of the SME's delivery photo |
| GET | `/api/certificates/{id}/image` | staff, supervisor, supplier, reviewer | - | 200, JPEG for the owning supplier, a linked SME or the registry reviewer |
| GET | `/api/registry/renewals` | reviewer | - | 200, pending renewals, oldest first, each with the current certificate and the supplier name |
| POST | `/api/registry/renewals/{id}/decision` | reviewer | JSON `decision` (`verify` or `reject`), nonblank `note` | 200, the updated certificate |

To recount the routes, run `grep -cE '^@app\.(get|post)' src/backend/main.py`.

List responses are plain JSON arrays with no pagination. IDs are positive
integers and dates use `YYYY-MM-DD`. Certificate expiry and the 60-day
warning use today's date in `Asia/Kuala_Lumpur`. Audit timestamps are UTC
with a `Z` suffix. Fields typed as nullable are still present in every
response.

## Failures return a status and a `detail` message

| Status | Cause |
|---|---|
| 403 | A role not allowed on this route or a person who doesn't match the role and tenant |
| 404 | Unknown record or one owned by another SME or supplier |
| 409 | A decision on a delivery already decided or still being checked, a second pending renewal, or a decision on a renewal already reviewed |
| 413 | Upload larger than 10 MiB |
| 422 | Missing or invalid headers, fields or image |
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
   R1 to R6 from `backend.rules`.
5. Save the reading, the six rule results, the verdict, the status and an
   activity row in one transaction.

| Verdict | Status |
|---|---|
| `covered`, `expiring` | `auto_accepted` |
| `substitution`, `not_covered`, `needs_human` | `pending_review` |

If the model call fails, the delivery is still saved with 201, verdict
`needs_human`, a sanitized `error` message, R1 failed and R2 to R6 not
evaluated.
When the call fails on a prepared demo photo, the backend falls back to a
stored reading in `src/backend/demo_cache.json`, keyed by the SHA-256 of the
uploaded bytes. A reading that arrives after the 180-second timeout is
discarded unless it matches the stored reading, and it can't overwrite a
supervisor's decision.

## Six rules decide the verdict

Every delivery has six rule results, R1 to R6 in order. `passed` is `true`,
`false` or `null`, where `null` means the rule wasn't evaluated, for example
because the label couldn't be read. `detail` gives the reason.

| Rule | Check | Verdict if it fails |
|---|---|---|
| R1 | Product, brand and manufacturer read from the label | `needs_human` |
| R2 | The product matches the material name after case folding, whitespace collapsing and dropping a trailing pack size such as `200 G`. The brand and the manufacturer each match the masterlist (rapidfuzz score of 90 or more) | `substitution` |
| R3 | The certificate scope covers the product and brand, with the product matched the same way as in R2 | `not_covered` |
| R4 | The certificate hasn't expired | `not_covered` |
| R5 | The issuer is on the recognised list | `not_covered` |
| R6 | The label shows a halal mark | `needs_human` |

The first failing rule sets the verdict. When all six pass and the certificate
expires within 60 days, the verdict is `expiring`.

## Decisions and renewals commit with their activity rows

A decision needs `accept` or `reject` and a nonblank reason. The delivery row
is locked, and the decision and its activity row commit together.

A supplier submission locks the supplier, saves the renewal as `pending` and
writes a `certificate_submitted` row to each linked SME's log. Coverage stays
the same until a reviewer verifies the renewal. A supplier with a pending
renewal gets 409 on a second submission.

The reviewer queue lists each pending renewal as `{renewal, current,
supplier_name}`, oldest first, where `current` is the active certificate or
`null`. A reviewer decision needs `verify` or `reject` and a nonblank note.
Verifying makes the renewal active and supersedes the old certificate.
Rejecting marks the renewal rejected and keeps the old certificate active. The
backend locks the supplier, so one of two concurrent decisions wins and the
other gets 409. The decision and its activity rows commit together.
Certificate responses also have two nullable fields, the reviewer's note in
`review_note` and the reviewer's name in `reviewed_by`.

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

## The activity log has seven actions

Activity `action` is one of `auto_accepted`, `pending_review`, `accepted`,
`rejected`, `certificate_submitted`, `certificate_renewed` or
`certificate_rejected`. The API, the seed loader and a database constraint
enforce this list. For a delivery event, the actor is `staff` or
`supervisor`. A certificate event writes one row to each linked SME. The
actor is the supplier contact's name for a submission and the reviewer's name
for a decision, and a decision row has the reviewer's note as its `reason`.

## Photos are stored and served as JPEG

The upload routes accept PNG or JPEG. `backend.images` stores each delivery or
renewal photo as JPEG at quality 85 with full resolution, upright orientation
and transparency flattened onto white. The model gets the same encoding resized
so the longest side is at most 1280 pixels. The image routes return
`image/jpeg` with `no-store` and `nosniff` headers. They need the demo headers,
so a browser fetches each image and displays it through an object URL.
