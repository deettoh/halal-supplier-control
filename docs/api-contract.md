# API contract 0.1.0

This branch proposes concrete wire formats for the draft architecture.
Review and merge it before parallel work. It is not yet an implemented MVP.
The executable reference is FastAPI `/docs`, backed by `/openapi.json`.

## Requests and responses

Every business endpoint requires `X-Demo-Role` (`staff`, `supervisor`, or
`supplier`) and `X-Demo-Tenant`. For staff/supervisor, tenant is the SME
identifier. For supplier, it is that supplier's ID encoded as a string.
These headers simulate platform identity; they are not secure authentication.
The later backend must resolve ownership, not just trust a claimed role.

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

- **Label schema:** retain the existing four required nullable fields.
  `backend.schemas.LabelExtraction` owns the definition; the existing
  `backend.extract.LabelExtraction` import remains compatible.
- **Rule results:** always five entries, R1 through R5 in order. `passed` is
  true, false, or null. Null means not evaluated (for example no readable
  label or no certificate); `detail` explains why. This extends the draft's
  boolean checklist rather than falsely reporting an unchecked rule as a pass.
- **Scope shape:** an array of `{product_name, brand}` objects. `brand` may
  be omitted/null to mean no brand restriction for that product. The rules
  owner must implement the agreed matching semantics; no fuzzy scope matcher
  is included here.
- **Renewal upload:** flat multipart fields `issuer`, `cert_no`, `holder_name`,
  `expiry_date`, `scope`, plus optional binary `image`. The `scope` field is
  JSON text in the form; the response contains a normal JSON array. This lets
  the supplier send fields and an image in one request.
- **Images:** response `image` is a URL/path reference, not base64 data.
  It must be served with suitable tenant/supplier access checks later.
- **Coverage:** MaterialResponse uses `coverage_status` and nullable
  `certificate_expiry_date`. Coverage is computed, not persisted.
- **Decisions:** JSON `decision` is `accept` or `reject`, with a required,
  nonblank `reason`. The response is the updated full DeliveryResponse.
  Unknown/not-owned deliveries should produce 404; already-resolved ones 409.
- **Delivery fields:** include image, created_at, decided_by, and reason in
  addition to the draft's fields so the review queue can display the evidence.
- **Extraction failure:** future delivery creation still returns 201 with
  `needs_human`, `pending_review`, a safe `error`, and nullable extraction
  values; an upstream model failure must not masquerade as a rejected upload.
- **Automatic acceptance:** covered and expiring map to auto_accepted;
  substitution, not_covered, and needs_human map to pending_review. Actual
  transitions and cross-field business validation belong to the backend/rules.
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

## Errors and scaffold behavior

HTTP errors use `{detail: "message"}`. Validation errors use FastAPI's
`{detail: [{loc, msg, type, ...}]}` shape, returning 422. Wrong permitted
role returns 403; missing/invalid header values return 422. Required reasons
are validated, but upload bytes are not decoded/checked by this scaffold.

Every valid business request currently returns 501. This keeps unfinished
features visible without a database, RunPod, audit log, or fabricated success.
Frontend developers can construct fixtures using response models, but the
scaffold is not a functioning end-to-end demo. Do not publish it over a
working backend without intentionally integrating the route declarations.

## Integration boundaries

- Frontend: use the documented form fields and JSON responses.
- Extraction: import LabelExtraction from schemas; return structured fields.
- Rules: use shared verdict/rule vocabulary; return a complete checklist.
- Backend: replace 501 handlers while retaining signatures and response
  models; enforce role AND tenant/supplier ownership and write audit records.
  Renewal must supersede the old version and update linked SMEs atomically.
- Database work is deliberately excluded from this branch.

Run `uv run pytest -q`, `uv run ruff check src tests`, and
`uv run mypy src tests` before merging. No merge or remote push is performed
by simply editing these files.
