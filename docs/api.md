# API reference

The FastAPI app in `src/backend/main.py` serves the JSON API under `/api`.
FastAPI's generated `/docs` page and `/openapi.json` are the executable
reference, and the request and response models are in
`src/backend/schemas.py`. Business logic is in `src/backend/services.py`.

## Identify the caller with two headers

Every business route needs `X-Demo-Role` (`staff`, `supervisor` or
`supplier`) and `X-Demo-Tenant`. For staff and supervisors the tenant is the
SME name, for example `Sunrise Bakery SAMPLE`. For a supplier it is the
supplier ID as a string, for example `1`. These headers simulate Orbyte's
login and aren't authentication.

The services check both the role and ownership: materials, deliveries and
activity are filtered by the SME, and supplier routes take the supplier ID
from the header.

## Eleven routes under `/api`

| Method | Path | Role | Request | Success |
|---|---|---|---|---|
| GET | `/api/health` | none | - | 200, works without a database |
| GET | `/api/materials` | staff, supervisor | - | 200, the SME's materials with computed coverage |
| POST | `/api/deliveries` | staff | multipart `material_id`, `image` | 201, the checked delivery |
| GET | `/api/deliveries` | supervisor | `status=pending_review` | 200, the SME's review queue |
| POST | `/api/deliveries/{id}/decision` | supervisor | JSON `decision` (`accept` or `reject`), `reason` | 200, the updated delivery |
| GET | `/api/activity` | supervisor | - | 200, the SME's activity log, newest first |
| GET | `/api/certificates` | supplier | - | 200, the supplier's active and superseded certificates |
| POST | `/api/certificates` | supplier | multipart `issuer`, `cert_no`, `holder_name`, `expiry_date`, `scope`, optional `image` | 201, the new active certificate |
| POST | `/api/certificates/extract` | supplier | multipart `image` | 501, not implemented |
| GET | `/api/deliveries/{id}/image` | staff, supervisor | - | 200, JPEG of the SME's delivery photo |
| GET | `/api/certificates/{id}/image` | staff, supervisor, supplier | - | 200, JPEG for the owning supplier or a linked SME |

To recount the routes, run `grep -cE '^@app\.(get|post)' src/backend/main.py`.

List responses are plain JSON arrays with no pagination. IDs are positive
integers and dates use `YYYY-MM-DD`. Certificate expiry and the 60-day
warning use today's date in `Asia/Kuala_Lumpur`. Audit timestamps are UTC
with a `Z` suffix. Fields typed as nullable are still present in every
response.

## Failures return a status and a `detail` message

| Status | Cause |
|---|---|
| 403 | The role isn't allowed on this route |
| 404 | Unknown record or one owned by another SME or supplier |
| 409 | A decision on a delivery that is already decided or still being checked |
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

A renewal locks the supplier, marks the active certificate `superseded`,
inserts the new one as `active`, and writes one `certificate_renewed` row per
linked SME. All four steps run in one transaction. Coverage is computed on
every read, so each linked SME sees the renewal at once. A renewal request with
its JSON `scope` field looks like this:

```javascript
const data = new FormData();
data.append("issuer", "SAMPLE Food Certification Council");
data.append("cert_no", "SAMPLE-GGS-2027-001");
data.append("holder_name", "Golden Grain Supplies SAMPLE");
data.append("expiry_date", "2027-11-30");
data.append("scope", JSON.stringify([{ product_name: "Wheat Flour", brand: "GoldenMill" }]));
await fetch("/api/certificates", {
  method: "POST",
  headers: { "X-Demo-Role": "supplier", "X-Demo-Tenant": "1" },
  body: data, // the browser sets the multipart boundary
});
```

Issuer and holder name allow 200 characters and the certificate number 100.

## The activity log has five actions

Activity `action` is one of `auto_accepted`, `pending_review`, `accepted`,
`rejected` or `certificate_renewed`. The API, the seed loader and a
database constraint enforce this list. The demo headers carry no individual
user, so the actor is `staff`, `supervisor` or `supplier:{id}`.

## Photos are stored and served as JPEG

Uploads accept PNG or JPEG. `backend.images` stores them as JPEG at quality 85
with full resolution, upright orientation and transparency flattened onto
white. The model gets the same encoding resized to at most 1280 pixels. The
image routes return `image/jpeg` with `no-store` and `nosniff` headers. They
need the demo headers, so a browser fetches them and displays a blob URL.
