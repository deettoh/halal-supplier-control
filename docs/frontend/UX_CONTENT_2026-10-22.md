# Whole-system UX and content design

22 October 2026. **Whole-system design specification for review.** Nigel selected **Option 1 — Side-by-side workbench** through the Impeccable comparison page. Nigel has now authorised whole-system implementation here, followed by independent reviews; that authorisation supersedes the earlier written-spec checkpoint. Shared product truth: [PRODUCT.md](../../PRODUCT.md). Source/API dependencies and required files: [readiness map](FRONTEND_READINESS_2026-10-22.md). Main c2e23f5; reference Frontend 27e96f8; new work belongs on codex/frontend-redesign.

## Design intent and evidence

Receiving staff need to record the item at the door without interpreting a certificate policy. Supervisors need enough evidence to decide an exception and explain it. Suppliers need to renew one shared record without losing the product/brand restrictions that determine coverage. Visitors need to understand how those responsibilities connect before entering the demo.

These task definitions are grounded in the team documents, source and Nigel's device/entry decisions. They are not interview findings. The old UI's screenshot styling is an anti-reference; its functions remain requirements. The model reads images, rules check coverage and supervisors decide exceptions. No UI component claims to authenticate a certificate or issue a religious ruling.

Success means a visitor can explain those responsibilities, a staff member can submit the right material/photo and understand the saved result, a supervisor can inspect and record a reasoned decision, and a supplier can publish the intended scope without losing restrictions. These are proposed usability criteria, not observed measurements.

## Audience, tasks and navigation

| Audience | Context | Default destination | Available destinations |
| --- | --- | --- | --- |
| Visitor | Learning the project; judges may need a quick demonstration | Introduction | How it works; Enter demo |
| Receiving staff | Mainly phone; one incoming item and its label | Check delivery | Check delivery; Masterlist; Switch workspace |
| Halal supervisor | Mainly laptop; inspect exceptions and audit outcomes | Review deliveries | Review deliveries; Masterlist; Activity; Switch workspace |
| Supplier | Mainly laptop; maintains their own shared records | Certificates | Certificates and renewal; Switch workspace |

Landing `/` and entry `/demo` are public prototype surfaces. Existing operational paths remain `/check`, `/review`, `/masterlist`, `/activity`, `/certificates`. Returning users may open their valid operational deep link directly; Enter demo itself always opens the confirmed picker. An invalid/missing demo identity leads to the picker, with the requested valid role destination retained. There is no invented signup, administration or business dashboard.

The shell always identifies the current organisation and role. Desktop uses a compact orange navigation region and a light work area. Phone receiving uses an orange header and two clearly labelled destinations; it does not shrink a desktop sidebar into an unlabeled icon rail. Switching workspace is available consistently, opens the same identity picker, and clears the old identity's photo, selected delivery, reason, form and mutation result after the switch. Warn about discarding an unsaved draft when relevant; do not add confirmation to every ordinary navigation.

## Flows and rationale

### Visitor and demo entry

Introduction → Enter demo → choose role → choose the corresponding organisation → Enter workspace → role home.

The picker presents three labelled choices with one-line tasks: **Receiving staff — Check a delivery label**, **Halal supervisor — Review flagged deliveries**, **Supplier — Renew certificate records**. No role is preselected for a first visitor. Staff/supervisor choose Sunrise Bakery SAMPLE or Crescent Caterer SAMPLE. Supplier chooses Golden Grain Supplies SAMPLE or Silver Valley Ingredients SAMPLE. A valid returning selection can be remembered and edited; first-time visitors make both choices explicitly.

The selected role filters valid organisations; changing the role clears an incompatible organisation. Enter workspace enables only when the pair is valid. Helper: **“Sample workspaces. Roles are simulated for this demonstration.”** Use exact seed tenant strings for staff/supervisor and supplier IDs as strings for supplier requests. Never present demo headers as production authentication.

### Receiving

Choose material → inspect approved identity → take/choose photo → inspect or replace whole photo → Check delivery → waiting → recorded result → Check next delivery.

Material is chosen first because it defines the record being compared. Its approved brand, manufacturer and supplier remain visible near the photo, so a similar ingredient from a different supplier is not selected accidentally. Search is labelled and supports the authorised material list; it is not a free-text material creation field.

Photo controls use the browser's camera/file affordance, with a readable preview and replace action. No placeholder photo button masquerades as a real upload. The photo is contained, not cropped; enlargement is available. Show supported formats/limits only after the backend confirms them.

The single primary action is **Check delivery**. Disable duplicate submission while waiting and show **“Reading the label and checking the records…”**. The backend currently exposes no progress events, so there is no invented percentage, staged progress or guaranteed duration. A longer wait can say **“Still checking. Keep this page open.”** Do not automatically retry a POST.

The saved result keeps **Coverage result** and **Delivery status** distinct. All four extracted fields and all R1–R5 results remain available. A compact phone checklist shows the rule label and outcome, with an expandable explanation; it never hides the fact that a rule failed or was not evaluated. On a saved review result, use **“Sent for supervisor review”**, name the reason, and provide **Check next delivery**. An extraction error returned in a saved 201 response is not an upload failure.

Recent staff history remains an intended capability with explicit API support pending. Do not use a supervisor queue request or claim in-memory results survive a reload. Preserve a completed response locally during the current session; persistence/history is a separate backend responsibility.

### Supervisor

Review queue → select a delivery → inspect original photo, approved/read values and checks → choose Accept or Reject → enter reason → Record decision → server confirmation → next pending item or empty queue.

The comparison is the central task. The photo, approved material and extracted/null values are accessible together. Fields are read-only: there is no backend endpoint for editing the model extraction. Describe mismatches in words, with colour as reinforcement. The complete five-rule checklist remains visible/available even when an earlier rule determines the verdict.

Use an unselected **Decision** radio group with **Accept delivery** and **Reject delivery**, a required **Reason** textarea, and a primary **Record decision** button. Both options are equally discoverable; acceptance is not preselected. One stable submit action prevents an accidental click on an immediately committing positive/negative button. A nonblank reason is required for either choice. A final decision is not shown as saved until the POST succeeds.

After success, show the actual returned decision/reason and refresh queue/activity. Preserve the original coverage verdict. A 409 says **“This delivery was already decided. Refresh to see the recorded outcome.”** Refetch and prevent overwriting the recorded decision. A 404 says the record is no longer available to this workspace and offers return to queue. Do not invent decision timestamps.

Decided/auto-accepted history is designed as a secondary view of this workflow, not another application module. Current API support is missing; the mockup can depict labelled example history, but a live view must never substitute the pending list or report unsupported history as empty.

Nigel compared three desktop arrangements within the same C identity and selected **1. Side-by-side workbench** (queue retained; photo and comparison together). **2. Photo-first inspection** and **3. Comparison worksheet** remain unchosen alternatives. The approved north-star image is `.impeccable/mocks/operate/01-review-workbench-v2.png`, mirrored at the launcher's `.impeccable/mocks/comp-1.png`. No new visual-direction choice is needed.

### Masterlist

Open masterlist → search/filter loaded records → inspect approved identity, supplier, coverage and expiry → clear filters or return to current role task.

Use compact filter counts integrated with the table, not a row of oversized KPI cards: All, Covered, Expiring, Not covered. Counts derive from authorised returned records. For Sunrise on 22 October, the seed/rules imply eight records: three covered, five expiring, zero not covered. Do not mix both SMEs into the count.

Columns: Material; Supplier; Approved brand/manufacturer; Coverage; Certificate expiry. Rows retain full names; long fields wrap. On phones, use stacked labelled records instead of requiring an 860px horizontal table. Search the fields actually returned. Certificate number/issuer and certificate-number search remain a documented preservation dependency, not invented material fields or a supplier-only request.

### Supplier certificates and renewal

Inspect active record → Renew certificate → review prefilled fields/scope → edit changes → inspect validation summary → Publish renewal → saved version and refreshed records.

Show the active record first and superseded versions as an expandable history. Active is a version status, not a coverage guarantee. The form has Issuer; Certificate number; Holder name; Expiry date; Products covered; optional Certificate image. Product scope is an editable row/table with **Product** and **Brand restriction (optional)**, not unstructured chips. Helper: **“Leave brand empty to cover any brand of that product.”** Other approved-material checks still apply.

Keep all existing scope rows in the editable draft, including brand restrictions. Add product/remove row are explicit. Removing the last row reveals a validation message because scope cannot be empty. Dates are displayed unambiguously and sent as YYYY-MM-DD. No automatic future date or certificate number is invented by a prefill. A design example may show a user-edited renewal draft, identified as such.

Primary action: **Publish renewal**. Supporting copy: **“The new record replaces the active version. Linked masterlists use it when coverage is recalculated.”** After server success: **“Renewal saved.”** Refetch the supplier records and invalidate affected cached coverage. A linked SME reads the current coverage when it refreshes; the UI does not claim live cross-browser push or that every product is now covered. A failed save preserves the draft and never shows a success toast.

Certificate-image pre-fill is optional and must not distract from the core form. If implemented later, extracted fields are reviewable suggestions and never auto-publish. Existing certificate artwork with an official-looking heading is not approved imagery for this design round.

### Activity

Open activity → read newest-first events → filter the loaded records if needed → inspect actor/role, time, action, delivery reference and reason.

Use a readable chronological record, with date groups and aligned columns. Display canonical `actor`, `role`, `action`, `delivery_id`, `reason`, `created_at`. Unknown action strings get safe readable text; no fabricated verdict/detail/system role is added. A delivery reference is plain text unless an authorised detail/history endpoint supports a destination. Avoid an ornamental timeline that replaces useful columns with dots, giant icons and empty space.

## Content system

The voice is direct, specific and calm. Instructions name the action and object. Success copy names what was saved; uncertain outcomes name what is still unknown. Creativity belongs in composition and evidence handling, not in playful failure messages or clever navigation labels. Keep SAMPLE attached to fictional organisation names. Display dates as `30 Nov 2026`; timestamp displays carry an explicit local zone when needed, while wire timestamps retain their offset.

| Context | Copy |
| --- | --- |
| Landing heading | Know what your documents cover. |
| Landing explanation | Compare delivery labels with your masterlist and supplier records. Flagged deliveries go to your supervisor. |
| Shared renewal section | One renewal. Updated coverage for linked buyers. |
| Responsibility explanation | The model reads the label. Rules check the records. Your supervisor decides exceptions. |
| Demo disclosure | SAMPLE data. Document coverage only; no independent certificate-authenticity decision or religious ruling. |
| Staff heading / instruction | Check a delivery / Choose the material, then photograph its label. |
| Photo helper | Keep the product name, brand and manufacturer readable. |
| Extracted null | Not read. Whether review is needed comes from the returned verdict/status, not from one display value alone. |
| Halal mark true / false / null | Detected / Not detected / Not read. This is an observed field, not an authenticity claim. |
| Covered | Covered by the record on file. |
| Expiring | Covered; certificate expires on {date}. |
| Substitution | Brand or manufacturer differs from the approved material. Show the backend's specific rule detail. |
| Not covered | The record on file does not cover this delivery. Show the backend's specific rule detail. |
| Needs human | Reading incomplete. A supervisor needs to review this delivery. |
| Rule true / false / null | Passed / Failed / Not evaluated |
| Empty pending queue | No deliveries waiting for review. New flagged deliveries will appear here. |
| Empty activity | No activity recorded yet. Checks and decisions will appear here. |
| Search with no matches | No matching materials. Try another name, supplier or brand. / Clear search |
| Missing reason | Enter a reason for this decision. |
| Decision saved | Decision recorded. / Show actual status and reason. |
| Missing product scope | Add at least one product covered by this certificate. |
| Unavailable history | Delivery history is not available right now. / Retry only when a supported read exists. |

## Failure, recovery and interrupted work

| Condition | Feedback and recovery | Boundary |
| --- | --- | --- |
| Read loading | Stable layout with a labelled loading state; no fake empty list | Do not flash an empty state before a response |
| Read fails | “We couldn't load {records}. Try again.” with Retry, retaining valid previous content as stale when possible | 501 additionally makes service unavailability explicit, not a connection fiction |
| Business service is 501 | “This action isn't available in the demo yet.” Keep draft and navigation usable | No silent switch to fixtures or claimed save |
| Validation 422 | Field errors plus linked summary; focus the summary and preserve values | Parse FastAPI's list detail, not raw JSON on screen |
| Wrong role / 403 | “This workspace can't open that view.” Offer the role's home and Switch workspace | No automatic elevation or cross-tenant data fetch |
| Upload fails before a response | Preserve chosen file while mounted; explain the save is unconfirmed | Never promise file persistence after reload |
| Submission timeout / network ambiguity | “We haven't received a result. The delivery may have been saved. Check with your supervisor before submitting again.” | No automatic re-POST or fake status lookup |
| Saved extraction failure | “Saved for supervisor review.” Show returned safe error and null/not-evaluated evidence | 201 saved result, not request failure |
| Photo read fails | Keep extracted fields/checks and a Retry photo action; tell supervisor photo unavailable | A missing photo is not a blank placeholder implying evidence exists |
| Identity switch | Warn if discarding a draft; then reset transient state, isolate cache and ignore stale responses | An old mutation must never be shown under a new organisation |
| Stale decision / 409 | Explain already decided; refetch authoritative result | Never overwrite another recorded result |
| Renewal rejected | Retain full draft, image and scope; focus the error; Retry only on deliberate action | Do not clear restrictions or create fake success |

## Visual and interaction brief carried to Impeccable

- **Own world:** orange navigation, charcoal text and cool light work surfaces. The evidence photo remains the visual subject. The chosen reference is C-evidence-room-v3.png, not the old navy screenshot shell.
- **Signature:** approved and read values share aligned baselines; a selected mismatch is explained in words beside the full label. Selected record changes keep photo and values together. This is a practical inspection surface, not an authenticity/forensics aesthetic.
- **Type exploration:** sturdy narrow display lettering suited to receiving signage, with a readable workhorse sans for body/forms; Barlow Condensed/Barlow are initial candidates, subject to actual mockup measurement later. Body text stays at readable UI sizes. No tiny tracked mono labels as a substitute for hierarchy.
- **Components:** compact navigation, open comparison rows, honest forms and full-width tables. Modest corners, crisp dividers where grouping needs them, and no nested card collage, glass, generic gradient hero, sparkle AI buttons, ornamental charts or fake KPI strip.
- **Colour purpose:** brand orange locates the workspace. Independent semantic colours/labels describe pass, fail, warning and not evaluated; orange alone never means both “selected” and “failure.”
- **Motion:** short selection/focus feedback, with restrained transitions when changing evidence. No auto-advance after a decision, parallax evidence, scroll-jacking, perpetual pulse or inference-progress animation. Reduced motion removes nonessential movement.
- **Responsive intent:** workbench columns reflow before content becomes cramped. On phones, queue and detail become explicit separate views with a return path; on receiving, the material/photo/submit sequence remains one column. The supplier form follows a natural page scroll, not nested scrolling scope rows that hide the publish action.

## Accessibility and review requirements

Targets for implementation: visible labels linked to controls; semantic tables/radio groups/headings; keyboard-operable picker and evidence enlargement; focus restoration to the invoking control; focus to the result/error heading after submission; live announcements for saving and completion; 44px or larger primary touch targets; reflow and zoom; text contrast checks; status words/icons beyond colour; meaningful photo alt text; no text baked into shipping UI images.

These are requirements, not a WCAG conformance result. A generated mockup cannot verify focus order, screen-reader output, keyboard behaviour, actual text contrast or a working backend.

Review checkpoints are bounded: (1) Intent walkthrough of flows/content before images, (2) inspect generated compositions and make one focused correction batch if needed, (3) after an approved build, desktop/phone usability plus Impeccable's independent visual/detector review, followed by its bounded fix/verification process. Do not endlessly regenerate for minor typography artifacts in discussion images.

## Integration and implementation sequence

### Architecture and responsibilities

Keep the current React/Vite/Tailwind plain-JavaScript architecture and operational route names. The proposed package remains under `src/frontend/`; built files go to `src/frontend/dist/public`, preserving the existing build-output convention while removing the broken external Replit workspace path. Development uses an API proxy; production uses the agreed same-origin FastAPI handoff. API paths, `/docs` and `/openapi.json` must not be swallowed by an SPA fallback. Backend serving changes remain coordinated with their owner.

| Unit | Responsibility and interface | Dependencies |
| --- | --- | --- |
| App/router | Public introduction/entry, valid role destinations, route gates, not-found recovery, provider composition | Session; shell; page components |
| Session/identity picker | Validate role/organisation pair, remember demo identity, warn about unsaved draft loss, reset per-workspace transient state | Approved seed identities; no new authentication API |
| API client | Transport canonical JSON/multipart requests, attach captured identity headers, parse FastAPI errors, retrieve authorised image blobs | Configured API origin; existing route/schema contract |
| Query/mutation hooks | Scope read caches by mode/role/tenant; manage stale content and invalidation; preserve outcome only for the initiating identity | API client and session; no business-rule engine |
| Task pages | Orchestrate their one task and route state; show actual responses; keep forms small and focused | Hooks; shared evidence/form/status components |
| Shared evidence | Full photo viewer; approved/read values; required nullable extraction keys; three-state checklist; separate coverage/status labels | Canonical material/delivery data |
| Renewal form | Editable clone of the current record; product/optional-brand rows; required-field/date-format validation; JSON scope serialization | Supplier certificates; API mutation; no issuer whitelist or invented future-expiry policy |
| Explicit design fixtures | Representative schema-validated snapshots for visual work and isolated tests | Production-schema/rule prechecks; visible preview disclosure |

One API boundary serves the app; pages must not each implement transport or map their own enum vocabulary. Pure display formatting can live beside it, while business verdicts remain Python-owned. Body copy/control labels stay semantic, not rasterised into screenshots. Use only the accessible primitives needed by these pages; do not import all old UI scaffolding.

### Data and state behaviour

- Read query keys include **mode, role and tenant**, plus supported query parameters. Capture identity when dispatching a mutation. Do not show its later toast, reset, response or selected file under a different identity. Abort superseded reads where possible; a browser cancellation is not a promise that a server write was cancelled.
- Delivery creation invalidates relevant queue/activity reads after confirmed success; decision success refreshes queue/activity and the selected record's displayed outcome. Renewal success refreshes supplier versions and invalidates cached material coverage. It does not claim another browser instantly received an update.
- Default integration is the backend API. An explicitly labelled design preview may display prepared fixture snapshots; it never silently replaces a failed live request, pretends an arbitrary uploaded photo was read, or evaluates changed certificate scope in JavaScript. Successful write paths are verified with isolated controlled HTTP fixtures until real backend routes exist, then with actual integration.
- A backend request is not automatically live model inference. Show real/stub/cached provenance only when explicitly supported by the backend; otherwise make that unknown. Do not invent a response field or label a server response as live AI merely because HTTP succeeded.
- Keep date-only expiry values as calendar dates, avoiding timezone shifts from local midnight parsing. Keep timestamp offsets intact and display a declared local zone. Relative expiry copy is explanatory; it does not replace `coverage_status` or determine a verdict.
- Fetch returned protected image references using the same captured identity and the configured/approved API origin. Do not invent image endpoints or send identity headers to arbitrary third-party image hosts. Revoke blob/object URLs when replaced or the workspace changes.
- Remember only validated demo identity in browser storage. Do not use localStorage as the authoritative business database, retain old uploads across tenants, or include model/database credentials in public build variables.
- Validate supported field shapes and show useful errors. A reason must be nonblank, not limited to an invented 500 characters. An issuer is editable text; an expired but syntactically valid date is not rejected by a new frontend-only policy. Product/brand scope is never flattened to CSV.

### Verification design

Use focused checks that protect cross-layer behaviour rather than tests that mirror CSS. Before declaring the frontend wired, verify:

1. API/form serialization, including multipart boundaries, numeric material IDs and JSON object scopes with optional/null brand restrictions.
2. Canonical response examples against Pydantic models; five ordered checks including true/false/null; separate coverage and workflow state; missing extraction values without a fabricated verdict.
3. Role/tenant navigation and request isolation, identity switches during reads/writes, reason requirements, unavailable/validation/error states and 409 stale decisions.
4. A controlled browser journey for staff upload/result, supervisor evidence/decision and supplier scope/renewal. HTTP-fixture success is labelled integration preparation, not backend persistence or model accuracy.
5. The actual integrated workflow when Member 4's routes exist, including two linked SMEs after renewal, protected photo access, activity, history permissions and SPA deep links.
6. Reproducible dependency install/build and appropriate existing backend checks; real desktop/phone browser captures, keyboard/focus, zoom/reflow, touch targets, contrast, loading/error states and an independent Impeccable finish review. Targeted corrections are bounded; do not add generic decorative features during polish.

The frontend uses the existing canonical API and plain-JavaScript React/Vite/Tailwind structure. The file map in readiness remains authoritative. Build the portable shell/API boundary, then staff, supervisor/masterlist/activity and supplier workflows in small units. Use explicit schema-validated fixture previews during design; real mode displays real API outcomes. Resolve the missing history, certificate metadata, protected photo/static serving, upload/provenance and reset support with their existing owners. Core business routes are still 501, so no design image is evidence of persistence or working inference.

The operational choice and inline implementation are authorised; execute the saved concrete implementation plan. The eventual release review must exercise a real delivery, exception decision and renewal across linked SMEs, with role/tenant isolation. No frontend backlog item is marked Done by this design document.
