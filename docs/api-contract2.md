# API contract v0.2 (finals)

The API changes for the finals, agreed by the whole team on 29 Oct 2026. This file is the source of truth: build the backend to it, and keep the frontend preview data in `src/frontend/src/lib/preview/` matching it.

- **Changing it:** ask Member 1 first. Member 1 updates this file and posts the change in the group chat, and the owner of that part tells Member 2.
- **What changes for existing callers:** `rule_results` grows from 5 items to 6, `actor` and `decided_by` hold names instead of roles, every request needs the `X-Demo-Person` header, and a supplier renewal now waits as `pending`. Everything else in v0.2 adds to v0.1.
- **Version:** `contract_version` in `/api/health` becomes `0.2.0` once every part is merged.
- **First deploy:** the live database holds deliveries saved with 5 rule results, which the v0.2 response model rejects, and log rows that name roles instead of people. Member 1 runs the demo reset after the first deploy.

| Part | Backend | Screens | Built |
| --- | --- | --- | --- |
| 1. Rule results | Member 1 | Member 2 | Day 1 |
| 2. Named people and the log | Member 5 | Member 2 | Day 1 |
| 3. Renewal review | Member 4 | Member 2 | Backend Day 1, screens Day 2 |
| 4. Hold with a next step | Member 4 | Member 2 | Day 3 |
| 5. Expiry check | Member 5 | Member 2 | Day 3 |

---

## 1. Rule results: R2 product check and R6 halal mark

**Owner:** Member 1. **Screen:** Member 2 (verdict and review screens).

| What | v0.1 | v0.2 |
| --- | --- | --- |
| `RuleName` | `R1` to `R5` | `R1` to `R6` |
| `rule_results` | Exactly 5 items, R1 to R5 in order | Exactly 6 items, R1 to R6 in order |
| `Verdict` values | Unchanged | Unchanged. No new verdict |

**R2** now also checks that the label's product matches the chosen material. When it fails, the detail names what failed:

```json
{"rule": "R2", "passed": false,
 "detail": "Product mismatch: label says \"Semolina\", approved material is \"Wheat Flour\"."}
```

**Current product matching (31 Oct amendment):** R2 and R3 case-fold text,
collapse whitespace and remove a trailing pack size, such as `200 G`, `1 kg`
or `500 ml`, before comparing product names. For example, `Cocoa Powder 200 G`
matches `Cocoa Powder`; `Semolina` still does not match `Wheat Flour`. This
records the already merged product-matching behaviour, not a new rule change.

**Per-SME policy:** the backend reads `recognised_issuers`, `match_threshold`
and `expiry_warning_days` from the requesting SME's persisted settings.
R2 applies the threshold to brand/manufacturer, R5 uses the issuer list, and
an otherwise covered certificate is `expiring` inside that SME's warning
window. The seed uses threshold 90 for both SMEs, with 60 days for Sunrise
Bakery and 45 for Crescent Caterer. Product matching and rule priority do
not become fuzzy. The delivery verdict is stored; current material coverage
is recomputed on reads and does not fail R6 because no label photo exists.

The brand and manufacturer failures keep their scores, for example `"Brand score 62.0 is below 90."`. If more than one part fails, the detail lists each one.

**R6** checks for a halal mark on the label:

| `halal_mark_present` | R6 `passed` | R6 `detail` |
| --- | --- | --- |
| `true` | `true` | `Halal mark visible on label.` |
| `false` or `null` | `false` | `No halal mark visible, supervisor review required.` |
| R1 failed | `null` | `Not evaluated: label information incomplete.` |

**Which verdict wins.** The first failing rule decides, in order R1 to R6:

| First failing rule | Verdict | Status |
| --- | --- | --- |
| R1 | `needs_human` | `pending_review` |
| R2 | `substitution` | `pending_review` |
| R3, R4 or R5 | `not_covered` | `pending_review` |
| R6 | `needs_human` | `pending_review` |

So a wrong product with no halal mark is still `substitution`. R6 doesn't affect masterlist coverage.

**On screen:** `needs_human` can now come from R1 or R6. Show it as "Needs review", with the `detail` of the first rule whose `passed` isn't `true`. Don't use a fixed message.

---

## 2. Named people and the log

**Owner:** Member 5. **Screens:** Member 2 (person picker, header bar, activity log).

### People in the seed

There's a new top-level `people` list in `src/seed/seed.json`. The names are fictional, as with the rest of the seed.

```json
"people": [
  {"id": 1, "name": "Aina",     "title": "Receiving staff",   "role": "staff",      "tenant": "Sunrise Bakery SAMPLE"},
  {"id": 2, "name": "Farid",    "title": "Halal supervisor",  "role": "supervisor", "tenant": "Sunrise Bakery SAMPLE"},
  {"id": 3, "name": "Mei Ling", "title": "Receiving staff",   "role": "staff",      "tenant": "Crescent Caterer SAMPLE"},
  {"id": 4, "name": "Ravi",     "title": "Halal supervisor",  "role": "supervisor", "tenant": "Crescent Caterer SAMPLE"},
  {"id": 5, "name": "Hakim",    "title": "Supplier contact",  "role": "supplier",   "tenant": "1"},
  {"id": 6, "name": "Priya",    "title": "Supplier contact",  "role": "supplier",   "tenant": "2"},
  {"id": 7, "name": "Nadia",    "title": "Registry reviewer", "role": "reviewer",   "tenant": "registry"}
]
```

Each `tenant` uses the same values as v0.1: the SME name for staff and supervisors, and the supplier ID for suppliers. The registry reviewer gets `registry`.

### The person header

| Header | v0.1 | v0.2 |
| --- | --- | --- |
| `X-Demo-Role` | Required | Required, and gains the value `reviewer` |
| `X-Demo-Tenant` | Required | Required |
| `X-Demo-Person` | None | **New and required:** the person's `id`, for example `1` |

The backend checks that the person exists and that their role and tenant match the other two headers. If not, it returns `403 {"detail": "Demo person not permitted"}`.

### New route for the picker

`GET /api/people` needs no demo headers, since it's what the demo entry page uses to log in. It returns the list above:

```json
[{"id": 1, "name": "Aina", "title": "Receiving staff", "role": "staff", "tenant": "Sunrise Bakery SAMPLE"}]
```

The picker then shows people instead of roles, and the frontend stops hardcoding the organisation list in `lib/session.jsx`.

### Log rows

`ActivityResponse` keeps every v0.1 field. Two fields change meaning and four fields are new:

| Field | v0.1 | v0.2 |
| --- | --- | --- |
| `actor` | Role or `supplier:1` | Person's name, for example `Aina` |
| `actor_title` | None | **New:** person's title, for example `Receiving staff` |
| `material_name` | None | **New:** `Cocoa Powder`, or `null` for certificate events |
| `verdict` | None | **New:** delivery verdict, or `null` for certificate events |
| `supplier_name` | None | **New:** supplier's name for certificate events, otherwise `null` |
| `decided_by` (on deliveries) | Role | Person's name |

From these the screen builds "Aina, receiving staff, checked Cocoa Powder, Covered".

---

## 3. Renewal review by the registry reviewer

**Owner:** Member 4. **Screens:** Member 2 (reviewer page, supplier page).

### Certificate states

| Status | Meaning |
| --- | --- |
| `pending` | **New:** submitted by the supplier, waiting for the reviewer, with no effect on any SME |
| `active` | Current certificate; the one-active-per-supplier rule stays |
| `superseded` | Replaced by a verified renewal |
| `rejected` | **New:** turned down by the reviewer, with no effect on any SME |

`CertificateResponse` gains `review_note` (`string | null`) and `reviewed_by` (`string | null`, the reviewer's name).

### Supplier routes (existing, changed)

- **`POST /api/certificates`** saves the renewal as `pending` and changes nothing else. If the supplier already has a pending renewal, it returns `409 {"detail": "A renewal is already waiting for review"}`.
- **`GET /api/certificates`** also returns the supplier's `pending` and `rejected` certificates, with the reviewer's note.

### Reviewer routes (new, role `reviewer`)

**`GET /api/registry/renewals`** lists the pending renewals, oldest first, each next to the certificate it would replace:

```json
[{"renewal": {"id": 5, "status": "pending", "...": "..."},
  "current": {"id": 1, "status": "active", "...": "..."},
  "supplier_name": "Golden Grain Supplies SAMPLE"}]
```

`current` is `null` if the supplier has no active certificate.

**`POST /api/registry/renewals/{id}/decision`** takes this body:

```json
{"decision": "verify", "note": "Matches the issuer's certificate"}
```

| `decision` | Effect |
| --- | --- |
| `verify` | Renewal becomes `active`, and the old active certificate becomes `superseded` |
| `reject` | Renewal becomes `rejected`, and the old certificate stays `active` |

- `note` is required for both decisions.
- The route returns the updated certificate.
- It returns `404` if the renewal is not found, and `409 {"detail": "Renewal already reviewed"}` if it isn't pending.

**`GET /api/certificates/{id}/image`** also allows the `reviewer` role.

### Log entries for each linked SME

| Event | `action` | `actor` | `reason` |
| --- | --- | --- | --- |
| Supplier submits | `certificate_submitted` (new) | Supplier contact's name | `null` |
| Reviewer verifies | `certificate_renewed` (existing) | Reviewer's name | Reviewer's note |
| Reviewer rejects | `certificate_rejected` (new) | Reviewer's name | Reviewer's note |

---

## 4. Hold with a next step

**Owner:** Member 4. **Screens:** Member 2 (review screen, delivery lists). Built on Day 3.

| What | v0.1 | v0.2 |
| --- | --- | --- |
| `decision` in `POST /api/deliveries/{id}/decision` | `accept`, `reject` | `accept`, `reject`, `hold` |
| `next_step` in the same body | None | **New:** required for `hold` and not allowed otherwise: `request_certificate` or `request_product_details` |
| `DeliveryStatus` | 4 values | Adds `on_hold` |
| `DeliveryResponse` | | Gains `next_step` (`string | null`) |
| `GET /api/deliveries?status=` | `pending_review` only | `pending_review` (default) or `on_hold` |
| Activity `action` | | Adds `on_hold`, with the reason |

**Example body:**

```json
{"decision": "hold", "next_step": "request_certificate", "reason": "Label shows a new pack design; asking the supplier for the current certificate"}
```

**Status rules:**

- `pending_review` can go to `accepted`, `rejected` or `on_hold`.
- `on_hold` can go to `accepted` or `rejected`.
- Holding a delivery that's already on hold returns `409`.

Only supervisors can hold, and a reason is required, as with accept and reject.

**Labels for the two next steps:** "Request current certificate" and "Request product details".

---

## 5. Expiry check

**Owner:** Member 5. **Screen:** Member 2 (one button). Built on Day 3.

**`POST /api/registry/expiry-check`** runs the check now, for the demo. It is restricted to a validated `reviewer` identity and needs no request body. **31 Oct user-approved amendment:** execution is manual through the reviewer button only; no scheduler is required or installed. It returns:

```json
{"certificates_checked": 3, "requests_created": 1}
```

- **What it does:** for each active certificate that falls inside a linked SME's own warning window, it writes a `renewal_requested` log entry (new action) to that SME. Days remaining must be between zero and that SME's `expiry_warning_days`, inclusive: certificates expiring today qualify; certificates already expired before today are skipped even if still marked active.
- **On the certificate:** `renewal_requested_on` (`date | null`, new) is set, and the supplier page shows "Renewal requested on 31 Oct 2026".
- **Running it twice creates nothing new**, because a certificate whose `renewal_requested_on` is already set is skipped.
- **Counts:** `certificates_checked` counts active certificates examined, including already requested or out-of-window records. `requests_created` counts shared certificate requests, not SME log rows. One qualifying certificate shared by two qualifying SMEs creates one request and two log entries. Multiple materials in the same SME do not duplicate its entry.
- **Scope of deduplication:** all qualifying SMEs get their log before the certificate is marked requested. If another SME's window starts later, that certificate remains skipped; there is no later per-SME request under this certificate-level policy.
- **Recorded identity:** request logs use the reviewer's name/title and the supplier name. `material_name`, `verdict` and `delivery_id` are null. The reason identifies the certificate and its expiry.
- **Persistence:** the request date uses the Malaysian calendar. The date and log rows commit together; PostgreSQL row locks prevent concurrent duplicate requests. Missing or invalid linked-SME settings return 503 and roll back the operation.
- **No activation or messaging:** this records a request, not a replacement certificate. It sends no external message and does not approve, activate or supersede a certificate. Unlinked certificates produce no request.

---

## New values in v0.2

| Type | Adds |
| --- | --- |
| `RuleName` | `R6` |
| `DemoRole` | `reviewer` |
| `CertificateStatus` | `pending`, `rejected` |
| `DeliveryStatus` | `on_hold` |
| `ActivityAction` | `certificate_submitted`, `certificate_rejected`, `on_hold`, `renewal_requested` |
| Decision values | `hold` (deliveries); `verify` and `reject` (renewals) |
| Header | `X-Demo-Person` |
| Routes | `GET /api/people`, `GET /api/registry/renewals`, `POST /api/registry/renewals/{id}/decision`, `POST /api/registry/expiry-check` |

The database check constraints in `db.py` that list these values need the same additions.
