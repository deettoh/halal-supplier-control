# Backend services

`main.py` handles HTTP validation, demo role gates and JPEG responses.
`services.py` implements scoped queries and workflows. The existing five
SQLAlchemy tables, shared Pydantic response models, and public statuses are
unchanged.

## Implemented core routes

| Route | Behavior |
| --- | --- |
| GET `/api/materials` | SME masterlist; compute coverage from active certificate, scope/brand, expiry and issuer |
| POST `/api/deliveries` | Staff PNG/JPEG upload, durable evidence, extraction, R1-R5, verdict/status and activity |
| GET `/api/deliveries` | Supervisor's SME pending-review queue, excluding unfinished extraction |
| POST `/api/deliveries/{id}/decision` | Supervisor accept/reject with reason; lock delivery and commit decision plus activity atomically |
| GET `/api/activity` | SME audit history, newest first |
| GET `/api/certificates` | Supplier's own active and superseded certificates |
| POST `/api/certificates` | Lock supplier, supersede old active row, insert renewal and log each distinct linked SME atomically |

GET `/api/deliveries/{id}/image` serves stored JPEGs to staff/supervisor of the
owning SME. GET `/api/certificates/{id}/image` serves JPEGs to its supplier or
staff/supervisor of a linked SME. Unknown/not-owned/no-photo records return
404. Headers include `no-store` and `nosniff`. Browser clients fetch with
the demo headers and display a blob URL; a bare image URL cannot supply those
headers by itself.

POST `/api/certificates/extract` remains 501: it is stretch and no certificate
extractor has been supplied. All other business routes have real services.

## Delivery processing and the review gate

1. Validate the staff role, PNG/JPEG decoding, 10 MiB limit, and ownership.
2. Save JPEG photo bytes and a traceable fallback before calling RunPod.
3. Release the database connection while the plain `def` route calls
   `extract_label` in a FastAPI worker thread.
4. Re-read the current material and active certificate, then evaluate R1-R5.
5. Save extraction, full checklist, verdict/status and `delivery_checked`
   activity. Covered/expiring are auto-accepted; others are pending review.

The user confirmed that supervisors wait until extraction completes or times
out. The extractor now configures 180 seconds with zero retries. The service
uses that same window and an internal error marker on the provisional row;
it is hidden from the review queue, and premature decisions return 409.
No `processing` public status or extra table is introduced.

ExtractionError messages are documented as safe by the extractor and stored
as error text. ValidationError/ValueError text is sanitized because it may
contain secret input. Model failures return 201 with `needs_human`, a saved
JPEG, an error, and R1 false/R2-R5 not evaluated.

If a worker terminates, its stored fallback becomes reviewable after the
180-second deadline. A delayed uncached result is discarded after that
deadline. Main's validated demo-cache result is retained even after an
endpoint timeout, but cannot overwrite an existing supervisor decision. When a
supervisor resolves an interrupted worker's fallback, recovery check and
decision activity rows are committed together. Reads do not write activity.
The SDK's network timeout is not a background-job system or forceful thread
cancellation; the database review gate enforces the logical deadline even
if an upstream call takes longer to return.

## Ownership, transactions and audit

All business routes enforce the demo role. Materials, deliveries and activity
are filtered by the SME header. Supplier routes use a positive supplier ID
from `X-Demo-Tenant`, never an ID in the form. Unknown/not-owned material or
delivery IDs return 404. Repeated decisions return 409. Invalid roles,
reasons, ownership or images do not change business records or create logs.

Renewal locks the supplier row and flushes superseded status before inserting
the new active certificate, preserving the one-active-certificate constraint.
There is one renewal log per distinct linked SME, not per material. No renewal
log or certificate change survives a failed transaction. Every material read
uses the latest active certificate, so linked SMEs see renewal immediately.

Demo actors use role labels (`staff`, `supervisor`) or `supplier:{id}`. These
headers simulate identity; the contract supplies no individual user ID.

## Architecture alignment and remaining scope

Compared with `Halal Supplier Control - Architecture.pdf` (Oct 20, 2026),
especially diagrams on pages 5-6 and routes/statuses on pages 7-9:

- Role gates, tenant isolation, computed coverage, ordered checklist,
  auto-acceptance mapping, review-after-extraction, reason validation,
  renewal versioning and per-SME audit follow the agreed contract.
- Image-serving routes and PostgreSQL BYTEA implement the agreed photo
  persistence addition. PNG seed paths use `image_file`.
- The current model `qwen/qwen3-vl-8b-instruct` is retained by explicit user
  confirmation on Oct 22; the PDF's older Qwen2.5-VL choice is superseded.
- The timeout gap was resolved by integrating origin/main: 180 seconds,
  no automatic retries, safe ExtractionError. Main's JPEG preprocessing
  (1280-pixel maximum, quality 85, upright orientation) and model settings
  are retained.
- Main's cache fallback is integrated. Cache keys hash the original uploaded
  bytes, not the JPEG stored in PostgreSQL. The committed demo cache is
  currently empty; only explicitly populated matching images can use it.
  Unmatched failures follow the confirmed human-review fallback.
- The PDF's demo reset command would explicitly restore seed records before
  a presentation (and remove demo uploads/decisions/logs). It is not ordinary
  startup and is outside this service change. No reset was run or added.

## Validation

Tests use SQLite by default and unique PostgreSQL schemas with `--run-db`;
no public database records are changed. Coverage includes tenant boundaries,
photo bytes, live computed coverage, extraction errors and secret redaction,
in-progress decision rejection, expired-worker recovery, late responses,
role/reason checks, repeated decisions, renewal rollback, and PostgreSQL
concurrent decisions/renewals. Oversized certificate fields fail validation
before writes; empty model choice lists use the saved human-review fallback.
All model calls in these tests are mocked;
real RunPod availability and Replit deployment are not established by them.

## PNG sources, JPEG storage

Certificate source files and seed paths remain PNG. Certificate uploads use
PNG; delivery uploads accept PNG or JPEG. `images.py` stores both as JPEG at
quality 85, preserving resolution, correcting orientation, and flattening
transparency onto white. Model resizing stays in main's extractor.

Startup converts existing stored PNGs inside the same transaction/startup
lock, even if seed.json is absent. It skips existing JPEGs so repeated startups
do not repeatedly recompress them. Invalid stored images fail startup and
roll back all changes. No source PNG file or unrelated record is replaced.
The protected photo endpoints consistently return `image/jpeg`.
