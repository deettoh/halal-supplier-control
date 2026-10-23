# Frontend source and compatibility audit

22 October 2026, Asia/Kuala_Lumpur. Preparation for Nigel's newly authorized frontend responsibility. No application code, shared API, seed, evaluation asset or README was changed by this audit. No merge, push, PR, deployment or board edit was made.

## Verified GitHub and local state

- Fetch succeeded. `origin/main`: **c2e23f52e348cdc88652e62c4b921afca636a8e2**. [PR #63](https://github.com/deettoh/halal-supplier-control/pull/63) is merged and adds a 180-second extraction timeout, no retries and a safe `ExtractionError`. CI reports success for this revision.
- `origin/Frontend`: **27e96f8ea540916fe1fdc6376a2b6cae7161f966**. Its change relative to its merge base adds only `src/frontend/`; it is based on an older main. Do not use its older backend/seed tree as current implementation.
- `origin/feat/implement-backend-services`: **99a7a66**, with no new service implementation beyond that older base. Branch names do not prove completed features.
- GitHub REST returned **no open PRs** at this inspection. The connected GitHub plugin returned 422/access failure, so authenticated Git and read-only REST were used. This is a timestamped inspection, not a monitor.
- The working checkout remains `codex/member2-evaluation-labels` at **8cc3b9f**. Fetch updated remote references, not the checkout. Existing WIP and the three staged documentation snapshots remain in place.
- Separate source exports are under ignored `tmp/frontend-audit-20261022/main/` and `frontend/`. Inventory hashes, OpenAPI, HTTP checks, GitHub status and preservation snapshots are in that directory. The inventory contains 41 main files and 111 files in the older Frontend tree, including binary/lock metadata.

## Review basis and limits

Read the current backend modules, schemas, rules, database/startup/loader, seed, tests, API/database/seed/RunPod guides, package/build/CI configuration, and all custom frontend pages/components/API/session/demo code. Inventoried all 55 UI primitives and their imports/exports; inspected the primitives used by the application. Unused generic primitives are not evidence of implemented product features and need not be copied into the rebuild. Lockfiles and binary assets were inventoried rather than treated as authored product logic.

Reread project memory, local guidance, the current daily plan, revision review, preparation/evidence/pitch/schema/RunPod handoffs and evaluation/manual procedures. Read the four retained updated team-document text extractions under `tmp/review-20261021-v2/`; the current Checklist and Job Split PDF hashes still match that review. Reread and visually inspected all nine pages of the Domain 2 brief. The Architecture/Project Brief PDFs still in Downloads are older copies with different hashes, so they do not supersede the retained updated extractions. The 103-row TSV was reread; it remains a historical Backlog export, not current board state. All seven supplied frontend screenshots were inspected as visual references.

No frontend dependency install, build or browser run was performed. Findings about React rendering are source-derived unless expressly marked as screenshot observations. Existing backend tests were run on the exact fetched main export using the root's existing Python environment; no environment file was loaded and no live-service flags were supplied.

Source conflicts are explicit: the brief's prose sends every non-covered verdict to review, while its warning table and canonical contract auto-accept `expiring`; use the latter intended status mapping and verify actual routes later. The PDFs name Qwen2.5-VL-7B/3B, while current source and RunPod notes name Qwen3-VL-8B; the frontend must display actual returned behavior, not a model name inferred from a dated PDF. The original UI ownership has been superseded by Nigel's direct assignment; deployment ownership is still unresolved.

## Functions to preserve

| Area | Existing intended function | Rebuild boundary |
| --- | --- | --- |
| Landing | Newly requested by the leader | User confirmed: introduce judges/new visitors, then “Enter demo” |
| Receiving | Pick material, take/upload label photo, submit, see result/checklist | Staff mainly use phones; backend owns extraction and verdict |
| Supervisor review | Pending queue, photo, extracted fields, checklist, accept/reject and reason | Supervisors mainly use laptops; require explicit recorded result and handle stale decisions |
| Masterlist | Material/supplier/approved brand/manufacturer, coverage, search/filter | Render canonical material fields; additional certificate metadata is a contract gap |
| Activity | Newest-first actor, role, action, time and decision context | Use actual returned reason/delivery reference; do not expect an undocumented `detail` field |
| Supplier | Current/superseded records and form renewal | Suppliers mainly use laptops; preserve structured product AND brand scope |
| Identity | Two SME staff/supervisor personas and two suppliers | Retain demo disclosure, role-specific navigation and separated tenant data |
| History/demo controls | Recent staff deliveries, decided history, reset and canned scenarios | Preserve intended capability through agreed API support or clearly isolated previews; currently unsupported by live routes |

## Compatibility findings

Priorities below are audit priorities, not current GitHub board labels.

| Priority | Evidence | Implication and required response |
| --- | --- | --- |
| P1 | Frontend `package.json` has sixteen `catalog:` versions, with no catalog/workspace manifest or JS lockfile in the committed export. `vite.config.js` requires `PORT` and `BASE_PATH`, imports Replit runtime plugins, and `.replit-artifact/artifact.toml` points to `artifacts/halal-supplier-control/dist/public`. | The copied frontend is not a self-contained package for this repository. Recreate a small reproducible package in `src/frontend/`, retain the agreed stack, use portable build settings and one lockfile. This does not require replacing the backend or abandoning Replit deployment. |
| P1 | `types.js`, `check.jsx` and `masterlist.jsx` expect `brand`, `manufacturer`, `coverage`, `coverage_detail` and a nested `certificate`. Canonical MaterialResponse returns `approved_brand`, `approved_manufacturer`, `coverage_status` and `certificate_expiry_date`. | Direct live rendering can fail or lose approved values/statuses. Use canonical fields. Certificate number/issuer/search by certificate number require an explicitly agreed response extension; the supplier-only list cannot be fetched by an SME to fill the gap. |
| P1 | `delivery-detail.jsx` expects `image_url`, `material_name`, `supplier_name`, `created_by` and nested `decision`. Canonical response has `image`, `material_id`, flat `decided_by` and `reason`, and no decision timestamp. | Resolve material/supplier display through the authorized material list, render the actual image/decision fields and omit unknown actor/time metadata. Do not fabricate a decision time or rename the backend silently. |
| P1 | `client.js` sends renewal scope with `input.scope.join(',')`; certificate cards and chip input expect strings. Backend accepts JSON text containing objects `{product_name, brand}`. | Current CSV is rejected with 422. A direct canonical object response would also be incompatible with string rendering. Use a product/optional-brand scope editor and JSON multipart serialization. Never drop brand restrictions. |
| P1 | `useDeliveries` is enabled for staff, is called by Shell and Check, and the demo permits staff history. Backend GET deliveries is supervisor-only and only supports pending review, including when no status is supplied. | Staff GET returns 403. The existing decided tab cannot retrieve its history. Preserve these desired functions in the integration plan, with Member 4 supplying agreed history access; do not invent a status parameter or expose another role's records. |
| P1 | `Checklist` uses truthiness (`r.passed ? ... : ...`). | Canonical null/not evaluated is incorrectly painted as a failed rule. Render true, false and null separately, while retaining all R1–R5 details and first-failure priority. |
| P1 | Browser `demo.js` approximates fuzzy matching by stripping suffixes/punctuation and sorting tokens. Python uses normalized `rapidfuzz.ratio`. Demo R3 checks the selected material instead of the extracted product, ignores brand restrictions, and uses false for skipped checks. | Browser success is not evidence of production-rule behavior. Do not carry this rules implementation into the new frontend. Use schema-shaped fixed fixtures for previews and production backend results for actual checks. |
| P1 | Demo extraction defaults to approved material values regardless of the uploaded image unless a canned case is selected. Browser localStorage is the persistence layer in demo mode. | Clearly label preview/simulated behavior. An image upload and plausible result do not establish model inference, backend persistence or measured accuracy. Do not silently fall back from an API failure to simulation. |
| P1 | `main.py` still has eight 501 business handlers. Image URLs named by the loader have no GET route; FastAPI also has no SPA/static mount or deep-link fallback. | Working UI integration needs Member 4's business/image routes plus the deployment owner's static-build handoff. Store versus serve are different milestones. Keep API errors separate from SPA fallback so they cannot return index.html as fake JSON. |
| P2 | Activity UI reads `a.detail`; API provides `reason` and `delivery_id`. Frontend demos allow `system`, which the shared ActivityResponse role does not. | Render supported audit content; preserve unknown action text safely. Do not add an unsupported role to shared data. Exact action-name vocabulary still needs the backend owner's implementation. |
| P2 | `CertCard` and renewal copy imply every buyer is immediately covered. A newly submitted certificate may still be expired, exclude a product/brand or have an unrecognized issuer. | Success copy should say the registry was updated and linked coverage recalculated, then show actual returned/refetched statuses. Publishing is not a universal coverage guarantee. |
| P2 | Detail photos use `object-cover` in a small square. File inputs advertise any image/PDF, while stored-photo docs specify PNG and the extractor declares all bytes JPEG. Preview object URLs are not revoked. | Preserve the whole label with accessible enlargement. Coordinate supported upload formats/normalization with Members 1/4, fetch protected photos with appropriate identity, and release object URLs. A normal `<img>` cannot send custom demo headers. |
| P2 | Review reason/selection and supplier form/success/file state are not reset consistently when the organisation changes. Stored sessions are parsed without validation. | Clear transient state per identity; separate request caches and ignore stale responses after a switch. Prevent a reason or certificate file from carrying into the next organisation. |
| P2 | Multiple renewal labels are not linked to field IDs, search relies on a placeholder, zoom is constrained by `maximum-scale=1`, animation has no reduced-motion handling, and some error cases appear as empty lists. | Provide persistent accessible names, zoom/reflow, keyboard/focus handling, reduced motion, distinct loading/empty/error states and retry guidance. These are source findings; a browser accessibility review is still required. |

The frontend seed's suppliers/materials match main, but certificate scope is the older string-list format and certificate file metadata differs. Keep one canonical seed source rather than another frontend copy that drifts.

## Fresh verification

On main **c2e23f5**: `python -m pytest -q` completed with **141 passed, 31 skipped in 10.99 seconds**. The 31 skips are opt-in live/PostgreSQL cases and PostgreSQL-only behavior on SQLite. No GPU/model call or live PostgreSQL test ran. No new lint/type/build claims are made by this audit.

| Probe with appropriate demo context | Observed HTTP status |
| --- | ---: |
| Health | 200 |
| Materials / supervisor pending queue | 501 / 501 |
| Staff delivery-list read | 403 |
| Supervisor list with `status=accepted` | 422 |
| Supplier renewal with current frontend CSV scope | 422 |
| Supplier renewal with canonical JSON object scope | 501 (request format accepted; workflow unimplemented) |
| Certificate / delivery image references | 404 / 404 |
| Frontend `/` / `/review` on FastAPI | 404 / 404 |

These in-process contract probes do not prove deployment, persistence, permissions across actual tenant records or complete workflows. The corrected JSON probe did not create a certificate.

## UX and content brief carried forward

The durable shared brief is [PRODUCT.md](../../PRODUCT.md). User-confirmed: a judge/new-visitor introduction with “Enter demo”; receiving on phones; supervisor/supplier work on laptops; preserve functions while replacing the disliked visual styling. The screenshots do not bind the new palette or composition.

The introduction should explain the receiving problem, the image/rules/supervisor responsibilities and the shared-renewal mechanism using honest synthetic examples. It must not advertise unmeasured accuracy, time savings, official integration or certificate authenticity. Operational content should lead with the next action, keep original coverage verdict and later delivery decision distinct, explain missing readings and state whether a save actually succeeded. Final copy and page hierarchy remain proposals for discussion.

Before implementation, choose the visual direction with the team, prepare the architectural design/spec and a reviewable implementation plan, and isolate the work from existing evaluation WIP. Use latest main as the integration base; use `Frontend` as feature/reference evidence. Coordinate minimal backend gaps with Member 4 without taking over their business logic. Preserve the existing stack and template directories.

The eventual focused review must cover desktop and phone layouts; keyboard, zoom, contrast and readable evidence; empty/error/slow/inference-failure states; organisation switches; required reasons and 409 stale decisions; canonical request/response fixtures; SPA/API routing; and a real backend workflow when available. Static previews must remain labelled as previews.

## Board handoff and next action

**No frontend implementation card is ready for Done from this audit.** In particular, **Contract reviewed at /docs, with every screen's field confirmed to exist** remains incomplete because the missing history and display-field support is now documented. The four screen-wired tasks require actual supported API behavior; the role-switcher/skeleton card requires a reproducible build. No live board was changed.

The user subsequently chose polished image mockups before building, selected **C — Evidence Room**, removed partner branding, confirmed the role/organisation entry picker and chose **orange navigation with light work areas**. [Whole-system readiness](FRONTEND_READINESS_2026-10-22.md) records the fresh fetch at the same revisions, Member 3 backlog cross-check, full screen/API scope and proposed file map. Next: develop the whole-system design/spec and operational screen mockups, then the implementation plan. Ask one material question at a time; do not re-ask confirmed choices.
