# Whole-system frontend readiness

22 October 2026. Preparation and scope confirmation requested by Nigel before further design or implementation. This records what is understood, what files will be needed, and what integration still depends on the team. It is not a completed screen specification or implementation plan.

## Confirmed brief

- Design the whole frontend, covering the public introduction and every existing role's work.
- Use **C — Evidence Room**, with **orange navigation and light work areas**. Use Halal Supplier Control as the sole interface brand.
- Landing: introduce the project to judges/new visitors; Enter demo opens a simple role and organisation picker.
- Staff mainly use phones. Supervisors and suppliers mainly use laptops; all screens must remain usable at smaller widths.
- Preserve shared-registry behaviour, role/organisation switching and the old branch's intended functions. Redesign the presentation.
- Continue from the same Intent brief in [PRODUCT.md](../../PRODUCT.md) through Impeccable. Both skills are available. Image mockups precede implementation; the selected landing concept is a direction reference, not a design of the whole system.
- Ask material questions one at a time. README remains deferred. Backend, inference, rules and video responsibilities remain with their existing owners.

## Repository confirmation

Fresh `git fetch origin` succeeded during this confirmation. Main remains **c2e23f52e348cdc88652e62c4b921afca636a8e2**; Frontend remains **27e96f8ea540916fe1fdc6376a2b6cae7161f966**. Read-only GitHub REST also found no open pull requests and the main `checks` run completed successfully. Evidence: ignored `tmp/frontend-audit-20261022/readiness-github-status.json`.

The local evaluation checkout remains **8cc3b9f** on `codex/member2-evaluation-labels`. Fetching did not merge newer main or switch this checkout. Existing evaluation work, README and staged snapshots are preserved. Future application work should use an isolated task branch based on freshly fetched main, with Frontend supplying functional reference.

**Subsequent user-confirmed branch separation:** created local **codex/frontend-redesign** from main **c2e23f5**, in the attached managed worktree **C:\Users\nigel\.codex\worktrees\frontend-redesign\Halal Supplier Control**. The teammate's `Frontend` remains reference-only and unchanged at **27e96f8**. Primary evaluation work stays in its original checkout. Fresh Python baseline in the new worktree: **141 passed, 31 skipped in 10.81s**. Planning/context files and the selected C mockup are copied there for continuity; no application code, commit or push has been made. The new branch is local until published.

The prior [source audit](FRONTEND_AUDIT_2026-10-22.md) read the backend application, shared schemas, rules, extraction, database/startup/seed, tests and configuration; the custom frontend screens, components, client, hooks, session and demo implementation; the current repository guides and team/competition documents; and all seven supplied screenshots. All repository files were inventoried, including unused generic UI primitives, binary assets and lock metadata. This is an application/contract review, not a claim that every line of unused third-party-style scaffolding or dependency metadata needs to be copied or has been independently validated.

This confirmation reread the current contract and source, build setup, route/role handling and Member 3's export. Main still has no committed `src/frontend/`; the older Frontend branch adds that directory. Its Replit package cannot be transplanted unchanged: it contains unresolved `catalog:` dependencies without their workspace catalogue, Replit build assumptions and incompatible demo response shapes.

The source audit's test run on this exact main revision was **141 passed, 31 skipped**. The later isolated-worktree baseline independently returned the same counts, as recorded above. The skips and live-service limits are recorded in the audit. No frontend build, browser workflow, live model or live PostgreSQL verification has occurred.

## Complete screen and workflow scope

Paths below retain existing operational URLs; `/demo` is a proposed path for the newly confirmed entry picker. Layouts remain to be drafted.

| Surface | User and device priority | Functions to cover | Backend binding or dependency |
| --- | --- | --- | --- |
| Landing `/` | Judges/new visitors, phone and laptop | Explain receiving, deterministic coverage checks, supervisor decisions and shared renewal; clearly mark SAMPLE data; Enter demo | Static product content, with no invented performance or authenticity claims |
| Demo entry `/demo` | All visitors | Pick Staff/Supervisor with one of the two SMEs, or Supplier with its organisation; enter the appropriate workspace | Existing demo headers; approved seed identities, no new production-authentication system |
| Shared app shell | All roles | Orange navigation, current organisation/role, valid destinations, role switch, explicit data/mode context | Scope requests/cache by role and tenant; clear selection, reason, upload and response state when identity changes |
| Delivery check `/check` | Receiving staff, phone first | Find material; see approved identity; take/upload and inspect full label photo; submit once; see original verdict, saved workflow status, four extracted fields and R1–R5; start next check | GET materials, POST deliveries. Persisted recent staff history needs an agreed API extension |
| Review `/review` | Supervisor, laptop first | Pending queue; compare uncropped photo, approved identity and extracted fields; inspect five checks and safe extraction error; accept/reject with required reason; show confirmed outcome; decided history | GET deliveries with pending_review; POST decision. Decided/auto-accepted history is not supported by the current list contract |
| Masterlist `/masterlist` | Staff and supervisor | Search/filter materials; supplier, approved brand/manufacturer, coverage and expiry; full information on phones | GET materials. Certificate number/issuer display and certificate-number search need response support; do not call supplier-only APIs as an SME |
| Activity `/activity` | Supervisor, laptop first | Newest-first actor, role, action, timestamp, delivery reference and reason; distinct empty/loading/error states | GET activity. Use supported fields; action vocabulary is established by backend implementation, not an invented detail field |
| Certificates `/certificates` | Supplier, laptop first | Own active/superseded records; prefilled renewal fields; editable product/optional-brand scope; optional image; validation; submit and show actual saved record | GET/POST certificates; multipart scope must be JSON text containing objects. Refresh records and linked coverage after successful renewal |
| Shared evidence and states | All relevant screens | Full photo and enlargement; pass/fail/not evaluated; readable missing values; loading, slow operation, failure, retry, success, stale decision and unavailable service | Use real response/error semantics, including 403/404/409/422/501. An extraction failure saved as 201 needs_human is a successful save for review |
| Demo controls / stretch | Demo facilitator and supplier | Keep reset/scenario intent in the scope inventory; optional certificate-image pre-fill | Reset/scenario APIs do not exist. Isolated previews must be labelled; do not fabricate a live endpoint. Certificate extraction is stretch and never publishes without supplier review |

The complete design package must show the operational screens, key detail/form states, phone receiving journey and laptop review/renewal journey. A landing-page mockup alone does not satisfy this scope. No extra dashboard, admin area or unrelated business module is assumed.

## Compatibility rules already understood

1. **Backend owns the outcome.** The model reads the photo, Python rules evaluate document coverage, and the supervisor decides flagged deliveries. Do not reuse the older browser's alternative rule engine or derive a plausible extraction from the selected material.
2. **Use canonical fields.** Materials use `approved_brand`, `approved_manufacturer`, `coverage_status` and `certificate_expiry_date`. Deliveries use `image`, `material_id`, flat `decided_by` and `reason`. Resolve material/supplier names from the authorised material list; do not invent nested delivery or certificate objects.
3. **Keep uncertainty visible.** All four extraction keys are required but may be null. R1–R5 remain ordered; `passed` can be true, false or null. Null is not a failed comparison.
4. **Keep verdict and decision distinct.** Covered/expiring are intended to be auto-accepted; substitution/not_covered/needs_human require review. A later acceptance changes workflow status, not the original coverage verdict. Show what the backend actually returns.
5. **Preserve structured renewal scope.** Send a JSON-encoded array such as `[{"product_name":"Flour","brand":"SAMPLE Brand"}]` inside multipart FormData. Null/omitted brand means unrestricted brand for that product. Do not flatten scope to comma-separated strings. Let the browser set the multipart boundary.
6. **Respect identity.** Every business request carries X-Demo-Role and X-Demo-Tenant. Staff cannot read the supervisor-only queue; suppliers see their own records. Frontend navigation does not substitute for server ownership checks.
7. **Keep operating modes honest.** SAMPLE identities/data can run against the real backend. A fixture preview is a different mode, clearly labelled. Never silently substitute fixtures after a real request fails; never count preview, stub or cache results as live inference.
8. **Use the existing architecture.** React/Vite/Tailwind, plain JavaScript, under `src/frontend/`; FastAPI and PostgreSQL remain authoritative. The browser never connects directly to PostgreSQL or stores a model credential.

## Backend and deployment dependencies

These are team implementation questions, not missing visual preferences from Nigel. Existing owners should resolve them alongside frontend work; this document does not authorise changes to their APIs or send them a message.

| Dependency | Current evidence | Needed for completion | Owner/boundary |
| --- | --- | --- | --- |
| Core workflows | All eight business handlers, including stretch extraction, return 501 | Implement material reads, delivery creation/review/decision, activity and certificate reads/renewals with ownership and persistence | Member 4, with existing inference/rules modules from Members 1/5 |
| Staff and decided history | GET deliveries permits supervisor/pending_review only | Agree explicit access and list/filter behaviour for recent staff results and decided/auto-accepted records | Member 4; do not invent query parameters |
| Masterlist certificate metadata | MaterialResponse has expiry, not certificate number or issuer | Agree minimal response support to preserve the old display/search function | Member 4 |
| Photo access | Stored image references have no GET handlers; demo identity uses custom headers | Serve authorised delivery/certificate photos; agree authenticated fetch/blob or another explicit access mechanism | Member 4; a plain img element cannot add demo headers |
| Upload handling | Existing UI accepts broad formats; storage specifies PNG; extractor currently declares JPEG | Agree supported formats/limits and decoding/normalisation, while retaining the team's native PNG evaluation assets | Members 1/4 |
| Inference provenance | No per-response mode field is defined | Establish how real, stub and cached results are disclosed; do not add an assumed response field | Members 1/4 |
| Static app and deep links | FastAPI `/` and `/review` currently return 404 | Agree build output location, serve assets and SPA links, preserve API errors, configure frontend CI/build | Backend plus deployment owner; PDF/tracker ownership conflict remains unresolved |
| Reset and canned cases | Older browser supports them; no backend API is defined | Agree safe facilitator procedure/API if needed; keep isolated preview controls explicit meanwhile | Backend/deployment owners; do not mutate shared seed from the UI |

Contract-format compatibility is understood and can guide design. **Working end-to-end compatibility is not yet verified or achievable with the current 501 handlers.** Full functional completion must include resolving the dependencies, not quietly dropping those functions.

## Frontend file map

This is the intended implementation boundary and file inventory. Names can be refined in the full specification; these files have not been created as application code.

| Location | Required purpose |
| --- | --- |
| `src/frontend/package.json` and one package-manager lockfile | Reproducible scripts and real dependency versions; distinguish runtime/dev dependencies; keep only used packages |
| `src/frontend/vite.config.js` | Portable dev/build setup, API proxy during development and agreed production base/output; remove dependence on a missing Replit workspace catalogue |
| `src/frontend/index.html`, `jsconfig.json`, `.env.example` | Entry document, alias/editor settings and public build configuration; no secrets, zoom restriction or partner branding |
| `src/frontend/public/` | Product favicon and approved static assets; not a public copy of protected delivery uploads |
| `src/frontend/src/main.jsx`, `App.jsx`, `index.css` | React bootstrap/providers, routes/role entry, orange/light tokens, typography, responsive rules and accessible focus/motion |
| `src/frontend/src/pages/landing.jsx`, `demo-entry.jsx` | New introduction and confirmed role/organisation entry flow |
| `src/frontend/src/pages/check.jsx`, `review.jsx`, `masterlist.jsx`, `activity.jsx`, `certificates.jsx`, `not-found.jsx` | The complete operational screen set and valid recovery route |
| `src/frontend/src/components/` | Shared shell/identity picker, delivery evidence, checklist/status, photo input/viewer, scope editor, request states and error boundary |
| `src/frontend/src/components/ui/` | Only necessary accessible primitives, styled for the chosen direction; copying all 55 old primitives is not required |
| `src/frontend/src/lib/api/client.js`, `hooks.js`, `session.jsx`, `types.js` | Canonical requests/errors and JSDoc shapes, role/tenant-aware queries/mutations, validated demo identity and safe state changes |
| Separate frontend preview fixtures | Schema-shaped examples for design/preview verification; no duplicate Python rules, simulated live success or drifting copy of the seed |
| Frontend test configuration and focused tests | Contract/serialization, role/tenant isolation, three-state checklist, decision reason/conflict, renewal scope and critical user journeys; final placement/tooling in implementation plan |

Existing outside files read as constraints: `src/backend/main.py`, `schemas.py`, `rules.py`, `extract.py`, `db.py`, `startup.py`, `seed.py`; `src/seed/`; `docs/api-contract.md`, `database.md`, `seed-format.md`; `.env.example`, `compose.yaml`, `pyproject.toml`, `runpod/README.md`, and `.github/workflows/ci.yml`. Integration may require reviewed backend-serving/CI/deployment changes by the relevant owner. It does not require rewriting their modules or moving the organiser's directories.

## Member 3 backlog cross-check

Reread `SDC Hackathon Todo - Backlog.tsv`: **103 total records, 14 assigned to YiHong-12**. Every exported record says Backlog. This is a historical snapshot, not live board status; descriptions/comments and newer changes are unavailable in it.

| Exact exported title | Treatment in this assignment |
| --- | --- |
| Contract reviewed at /docs, with every screen's field confirmed to exist | Audit identifies missing support; not ready for Done |
| Vite + React + Tailwind skeleton with the role switcher (Receiving Staff or Halal Supervisor for either SME, or the Supplier) | Core rebuild and entry/switching scope |
| Delivery check, Review and Activity log screens and the supplier renewal form, on mock JSON in the frozen shape | Core whole-system screen drafts; fixtures must match merged schemas |
| Delivery check screen wired (material picker, photo upload, verdict, rule checklist) | Core receiving integration |
| Review screen wired (masterlist coverage, queue, accept or reject with a reason) | Core supervisor/masterlist integration |
| Activity log screen wired | Core audit-record integration |
| Supplier renewal form wired (current certificate shown, renewed fields submitted) | Core supplier integration |
| Own the demo route and lead the dry runs | Build the complete route; dry runs coordinated with Member 3/team |
| Orbyte › Halal Supplier Control header and organisation switcher | Historical task title only: user removes partner branding; keep organisation switching |
| Video script following the segment table in the job split doc | Remains Member 3's video work |
| Record the video on the deployed URL, never localhost, with the narrator doing the voice-over | Remains Member 3's video work; functioning deployed frontend is a dependency |
| Captions, edit and 1080p export; upload and confirm the link plays while logged out | Remains Member 3's video work |
| Screenshots for the pitch | Capture implemented, reviewed screens later; concept images are not workflow proof |
| Stretch: certificate pre-fill on the renewal form | Optional after core renewal and backend support; not required to finish the core |

The leader's newly requested landing and confirmed entry picker are additional surfaces. They do not replace any core operational task.

## Next stage and completion evidence

There is enough user input to prepare the whole-system design package now. No skill/plugin upload is required. New material product ambiguities should be raised one at a time; API/deployment dependencies above must remain explicit.

Subsequent design work is ready in the [whole-system specification](UX_CONTENT_2026-10-22.md) and [round-one review](DESIGN_REVIEW_2026-10-22.md): every role's journeys/content/states/architecture, eight operational mockups and the human-selected side-by-side workbench. The isolated branch is established. Next: obtain Nigel's written-spec feedback, write the concrete implementation plan, create the portable package, build against validated fixtures and the merged contract, integrate supported APIs, and finish with focused phone/laptop usability and visual review. No application code is implemented yet.

Completion needs a reproducible frontend build; appropriate contract/backend/frontend checks; an actual delivery, supervisor decision and supplier-renewal journey against supported backend routes; correct cross-SME coverage refresh; role/tenant separation; readable photo evidence; keyboard/zoom/touch/contrast review; and honest loading/error/mode states. Pending real services must be reported rather than represented as working.

**Board handoff:** no additional implementation task is ready for Done from this confirmation. In particular, “Contract reviewed at /docs, with every screen's field confirmed to exist” is still pending missing screen support. No live board change, application implementation, commit, push or PR was made.
