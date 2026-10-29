# Task 4.1: registry renewal review handoff

Backend contract: supplied API contract v0.2, section 3. Task 4.1 is implemented;
the reviewer/supplier UI and preview gateway still need Member 2's integration.
`/api/health` stays at 0.1.0 until all v0.2 parts merge.

## Identity prerequisite

The people table and seven contract identities are seeded. Supplier certificate
routes and reviewer routes require `X-Demo-Person` as well as role and tenant.
Supplier 1: role `supplier`, tenant `1`, person `5` (Hakim).
Supplier 2: role `supplier`, tenant `2`, person `6` (Priya).
Reviewer: role `reviewer`, tenant `registry`, person `7` (Nadia).
Unknown/mismatched people get 403 `Demo person not permitted`.

This is shared groundwork for 5.1, not the completed named-log feature.
Task 5.1 must add GET /api/people, global person validation, the person picker,
and enriched delivery/activity fields. Staff/supervisor requests still use the
existing two-header contract in this intermediate branch.

## Frontend work for Member 2

- Pass the selected person ID in X-Demo-Person, including image fetches.
- POST /api/certificates returns pending. Show "Submitted for review";
  never claim it is live or refresh buyers as covered just from submission.
- GET /api/certificates includes pending/rejected and review_note/reviewed_by.
- GET /api/registry/renewals returns oldest first, with renewal, current
  (nullable) and supplier_name. Reviewer may fetch certificate image URLs.
- POST /api/registry/renewals/{id}/decision accepts verify/reject plus a
  nonblank note and returns the updated certificate. Display 409 conflicts
  then reload the list; display 404 for a missing renewal.
- Verification alone updates linked coverage. Rejection leaves it unchanged.
- The preview gateway must mirror pending -> active/rejected and add reviewer
  operations. Its existing immediate-publish behavior is a Phase 1 fixture.
  Example payloads are in src/lib/preview/renewal-review.json, relative to
  src/frontend. The existing preview screens are not evidence of live 4.1.

## Persistence and verification

Startup upgrades existing PostgreSQL review fields/constraints transactionally
under the existing advisory lock. It seeds people only when their table is
empty. No reset is needed for this isolated feature. Task 1.2's six-rule
response change still needs the coordinated demo reset described in v0.2.

Tests use SQLite and disposable PostgreSQL schemas, never public data. They
cover pending/verify/reject across both SMEs, named audit events, ownership,
required notes, conflicts, photo access, atomic rollback and concurrent writes.
No RunPod calls, live deployment or production reset are needed for 4.1.

## Frontend validation note

Frontend lint passes. The existing JavaScript suite passes 80 of 81 tests
with one thread worker. The navigation test for cancelling Back and restoring
a supplier draft fails while the page remains at "Opening workspace..." and
the test waits for "Issuer". This also reproduces in isolation; a longer
command-line test deadline does not fix the missing-label wait. No frontend
application code was changed for 4.1. Member 2 should investigate this
separately from the registry screen integration.
