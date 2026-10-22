# API contract 0.1.0

These are the agreed wire formats for the MVP. All core workflows are
implemented; certificate extraction remains a stretch scaffold.
The executable reference is FastAPI `/docs`, backed by `/openapi.json`.

## Requests and responses

Every business endpoint requires `X-Demo-Role` (`staff`, `supervisor`, or
`supplier`) and `X-Demo-Tenant`. For staff/supervisor, tenant is the SME
identifier. For supplier, it is that supplier's ID encoded as a string.
These headers simulate platform identity; they are not secure authentication.
Services enforce tenant/supplier ownership as well as role gates.
These demo headers still simulate platform identity.

| Method | Path | Request | Success response | Role |
| --- | --- | --- | --- | --- |
| GET | `/api/materials` | Headers | 200 array of MaterialResponse | staff/supervisor |
| POST | `/api/deliveries` | Multipart material_id + image | 201 DeliveryResponse | staff |
| GET | `/api/deliveries` | status=pending_review (default) | 200 array of DeliveryResponse | supervisor |
| POST | `/api/deliveries/{id}/decision` | JSON decision + reason | 200 DeliveryResponse | supervisor |
| GET | `/api/activity` | Headers | 200 array of ActivityResponse | supervisor |
| GET | `/api/certificates` | Headers | 200 array of CertificateResponse | supplier |
| POST | `/api/certificates` | Multipart certificate fields | 201 CertificateResponse | supplier |
| POST | `/api/certificates/extract` | Multipart image (stretch) | 200 CertificateExtractResponse | supplier |

GET routes have no request body. IDs are positive integers. Responses use
plain arrays, not `{items: [...]}` wrappers. No pagination is defined yet.
Dates use YYYY-MM-DD; timestamps include a timezone, preferably UTC `Z`.
Response fields typed as nullable are still required unless a default is
explicitly declared. This keeps frontend handling predictable.

## Choices made explicit for team review

- **Label schema:** four required nullable fields: `product_name`, `brand`,
  `manufacturer`, and `halal_mark_present`. The first three are strings;
  `halal_mark_present` is a boolean. This retains the PDF's four-field draft.
  `backend.schemas.LabelExtraction` owns the definition; the existing
  `backend.extract.LabelExtraction` import remains compatible.
- **Rule results:** always five entries, R1 through R5 in order. `passed` is
  true, false, or null. Null means not evaluated (for example no readable
  label or no certificate); `detail` explains why. This extends the draft's
  boolean checklist rather than falsely reporting an unchecked rule as a pass.
  For example, after a model timeout R1 is false (extraction failed), while
  R2 is null with detail "Not evaluated: label extraction failed". Null is
  neither a pass nor a confirmed mismatch; the delivery needs human review.
- **Scope shape:** an array of `{product_name, brand}` objects. `brand` may
  be omitted/null to mean no brand restriction for that product. The rules
  match normalized product names and any explicit certificate brand
  restriction. Fuzzy comparison belongs to R2's brand/manufacturer check.
- **Renewal upload:** flat multipart fields `issuer`, `cert_no`, `holder_name`,
  `expiry_date`, `scope`, plus optional binary `image`. The `scope` field is
  JSON text in the form; the response contains a normal JSON array. This lets
  the supplier send fields and an image in one request.
  Issuer and holder name are limited to 200 characters; certificate number
  to 100, matching the database. Longer fields return 422 before any write.
- **Images:** response `image` is a URL/path reference, not base64 data.
  GET `/api/deliveries/{id}/image` serves the JPEG to staff/supervisor of its
  SME. GET `/api/certificates/{id}/image` serves the JPEG to its owning supplier or
  staff/supervisor of a linked SME. Unknown/not-owned/missing images return
  404. Both image routes require the same demo headers. Browser clients
  should fetch with those headers and display a blob URL.
- **Coverage:** MaterialResponse uses `coverage_status` and nullable
  `certificate_expiry_date`. Coverage is computed, not persisted.
- **Decisions:** JSON `decision` is `accept` or `reject`, with a required,
  nonblank `reason`. The response is the updated full DeliveryResponse.
  Unknown/not-owned deliveries should produce 404; already-resolved ones 409.
- **Delivery fields:** include image, created_at, decided_by, and reason in
  addition to the draft's fields so the review queue can display the evidence.
- **Extraction failure:** delivery creation still returns 201 with
  `needs_human`, `pending_review`, a safe `error`, and nullable extraction
  values; an upstream model failure must not masquerade as a rejected upload.
- **Automatic acceptance:** covered and expiring map to auto_accepted;
  substitution, not_covered, and needs_human map to pending_review. Actual
  transitions are enforced by the service workflows.
- **Stretch extraction:** returns `{extracted, error}` and never creates a
  certificate. All extracted certificate fields can be null for correction.
  Request validation does not establish document coverage or halal status.

Certificate renewal from browser JavaScript:

```javascript
const data = new FormData();
data.append("issuer", "SAMPLE Issuer");
data.append("cert_no", "SAMPLE-001");
data.append("holder_name", "SAMPLE Supplier");
data.append("expiry_date", "2027-12-31");
data.append("scope", JSON.stringify([
  { product_name: "Flour", brand: "SAMPLE Brand" }
]));
// data.append("image", selectedFile); // optional
await fetch("/api/certificates", {
  method: "POST",
  headers: { "X-Demo-Role": "supplier", "X-Demo-Tenant": "1" },
  body: data
});
```

Let the browser set multipart Content-Type including its boundary.

## Errors and implementation status

HTTP errors use `{detail: "message"}`. Validation errors use FastAPI's
`{detail: [{loc, msg, type, ...}]}` shape, returning 422. Wrong permitted
role returns 403; missing/invalid header values return 422. Required reasons
are validated. Certificate uploads use PNG; delivery uploads accept PNG or
JPEG. Images must decode correctly and be at most 10 MiB (413 when larger).
Both are stored/served as JPEG. Invalid images and invalid supplier IDs return
422 with `{detail: "message"}`; FastAPI schema validation retains its list-shaped
detail. `/docs` documents both 422 response shapes.

GET materials, deliveries, activity and certificates use real database reads.
JPEG retrieval routes return stored bytes with access checks. Reads never call
RunPod or write activity rows. Database unavailability returns 503 with a safe
error message. Health and API documentation remain available without a
configured database.

Delivery creation saves photo evidence before its blocking model call, with
an internal error marker until processing completes. This row is excluded
from the queue during the 180-second extraction window. A decision attempted
before completion returns 409 without a write. After completion or timeout,
normal verdict/status rules apply. Main's validated demo-cache result can
still be used after an endpoint timeout, unless a supervisor has already
resolved the deadline fallback. The demo cache is keyed by original upload
bytes; JPEG storage conversion does not change cache lookup. An interrupted
worker's fallback also becomes reviewable once that deadline expires.
A late result cannot undo a
supervisor decision. The public status vocabulary is unchanged.

Decision writes and their logs are atomic. Renewal locks the supplier row,
supersedes its active certificate, inserts the new active certificate, and
logs each distinct linked SME in one transaction. The demo actor is `staff`
or `supervisor` for those roles and `supplier:{id}` for supplier renewals;
there is no authenticated person identifier in the two-header demo contract.

Only POST `/api/certificates/extract` still returns 501. No certificate
extractor is available yet. See [the service guide](backend-services.md).

## Integration boundaries

- Frontend: use the documented form fields and JSON responses.
- Extraction: import LabelExtraction from schemas; return structured fields.
- Rules: use shared verdict/rule vocabulary; return a complete checklist.
- Backend: services enforce role and tenant/supplier ownership, transactions,
  and audit records. Renewal changes coverage for linked SMEs immediately
  because coverage is recomputed on each read.
- Database: SQLAlchemy models, startup initialization and PNG seed backfill
  are already implemented. Read APIs reuse them.

Run `uv run pytest -q`, `uv run ruff check --select E,F,I src tests`,
`uv run ruff format --check src tests`, and `uv run mypy src/backend tests` before merging. No merge or remote push is performed
by simply editing these files.
