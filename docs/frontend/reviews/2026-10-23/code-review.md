# Independent whole-branch code review

Reviewed 23 October 2026. Base `f3346488af05c8f3ad6129a12e9de6ff2124a2cf`; head `771bb73dd5d14ebac64a14fed92e946594c46186`. Fresh `git fetch origin` succeeded; `origin/main` remains `f334648`. Review was read-only except for this requested report. No branch/index/source changes, browser automation, or subagent dispatch.

Requirements: `docs/superpowers/plans/2026-10-22-frontend-redesign.md`, `docs/frontend/UX_CONTENT_2026-10-22.md`, current schemas/routes, and the execution ledger. The ledger contains completed-task evidence and no separate Ruling lines. Backend/README changes inherited from main were treated as contract context, not authored frontend changes.

## Strengths

- One canonical transport preserves structured scope, original upload bytes, nullable extraction, ordered three-state rule results, and separate coverage/workflow status. It prevents identity headers going to an unapproved image origin and rejects redirects.
- Workspace remounts, independent query clients, captured request identity, abort signals, mutation epochs, and revoked object URLs form a coherent isolation design. Role-inappropriate routes do not initiate protected reads.
- Live mode is the default; failures stay failures. Prepared examples require an exact photo hash/material pair or exact renewal payload. The UI discloses simulated identity, prepared outcomes, and unknown inference provenance.
- Supplier renewal preserves every scope row, treats a blank brand as null, retains rejected drafts, and matches the merged PNG/JPEG/10 MiB contract. No frontend issuer whitelist or independent coverage algorithm was introduced.
- Existing tests exercise useful behavior, including saved incomplete extraction, unsupported uploads, cross-workspace late saves, and disappearing conflict rows. Independent run: **7 test files / 48 tests passed**.
- Calendar expiry formatting never constructs a timezone-sensitive Date; activity explicitly uses Asia/Kuala_Lumpur. Source includes phone reflow, text wrapping, visible labels, semantic tables, and reduced-motion rules.

## Issues

### Critical

None found.

### Important

1. **[P2] A late decision response destroys the next delivery's draft.**
   - Location: `src/frontend/src/pages/review.jsx:28–30`, with selection/reset at `:46–52`.
   - Trigger: submit the decision for delivery #102, leave it while the request is pending, select #104, and start a new reason. When #102 returns, `onSuccess` unconditionally selects #102 and replaces the displayed record.
   - Impact: the keyed DecisionForm for #104 unmounts and its new reason is lost without confirmation. This can happen on ordinary slow connections; workspace epochs do not help because both records are in the same workspace.
   - Evidence: an in-memory Node/jsdom probe using the actual Review component printed `beforeFirstResponse Cocoa Powder · Delivery #104 SECOND DRAFT`, then `afterFirstResponse Cocoa Powder · Delivery #102 secondDraftVisible false` after resolving the first request. Existing tests cover switching workspaces, not switching deliveries during a save.
   - Fix: capture delivery identity and a selection/operation token at submission. Refresh shared queries after completion, but apply selected-record state, errors, and blocking only if that operation still owns the current selection. Alternatively, prevent changing selection while saving with a clear explanation. Add delayed success and delayed conflict regressions while another delivery has a draft.

2. **[P2] Browser Back/Forward silently discards unsaved drafts.**
   - Location: `src/frontend/src/lib/navigation.jsx:10–13`; `src/frontend/src/lib/session.jsx:118–126`; route consumption in `src/frontend/src/App.jsx:21`.
   - Trigger: enter the supplier workspace from the picker, edit a renewal field, then use browser Back (or the equivalent mobile gesture). The router immediately unmounts the form. `AppLink` only guards clicks, and `beforeunload` does not run for same-document history navigation.
   - Impact: renewal fields, delivery photos, and supervisor reasons can be discarded despite the draft-protection behavior offered by app navigation. Returning Forward does not restore them.
   - Evidence: actual App/jsdom history traversal after editing issuer to `UNSAVED ISSUER` returned `{"path":"/demo","confirmCalls":0,"issuerFieldPresent":false}`. Forward recreated issuer `SAMPLE Food Certification Council`, still with zero confirmation calls.
   - Fix: guard history transitions as well as programmatic/link navigation, or preserve route drafts in workspace-scoped state until deliberate discard. Cancellation must retain both the route and the draft. Cover Back/Forward and a pending submission without replaying a POST.

3. **[P2] New prepared deliveries use the superseded certificate after renewal.**
   - Location: `src/frontend/src/lib/preview/gateway.js:128–131`; fixture generation in `tests/frontend/generate_preview.py:140–142`.
   - Trigger: publish supplier 1's prepared renewal, return to staff, and check the exact prepared Wheat Flour photo for material 1 (or its linked SME equivalent).
   - Impact: the masterlist correctly shows Covered with expiry 30 Nov 2027, but the newly created delivery returns Expiring and R4 says `Certificate expiry: 2026-11-30.` The preview's central shared-renewal workflow contradicts itself. Existing historical delivery results should remain unchanged, but a new check must use the currently selected prepared registry state.
   - Evidence: executed the actual gateway through Vite SSR. After renewal, material 1 returned `coverage_status: covered`, `certificate_expiry_date: 2027-11-30`; the subsequent new delivery returned `verdict: expiring` and the old R4 expiry. `createDelivery` always copies the single baseline response; it never selects by `store.renewed`.
   - Fix: generate delivery snapshots for supported renewal combinations using the canonical Python rules and select the appropriate prepared snapshot, as already done for materials. Alternatively reject post-renewal checks as an unsupported prepared scenario with an explicit explanation. Do not add JavaScript coverage logic. Test both SMEs and preservation of pre-renewal delivery verdicts.

### Minor

1. **[P3] Validation summaries do not lead users to the affected field.**
   - Location: `src/frontend/src/components/request-state.jsx:41–48`, consumed by the supplier form at `src/frontend/src/pages/certificates.jsx:174`.
   - Trigger: submit a long renewal with an empty product name or receive a field-specific 422.
   - Impact: the focused summary names the error, but its entries are plain text, and affected controls have neither linked messages nor `aria-invalid`. With eight or more scope rows, a keyboard/screen-reader user must search the form again. The binding UX document explicitly calls for field errors plus a linked summary.
   - Fix: supply field target IDs from the form, link summary entries to them, and associate each control with its current error. Preserve backend field paths without guessing arbitrary DOM IDs.

## Review-focus disposition

1. **Switching role/tenant during reads/writes:** inspected session/provider lifecycle, query keys/signals, mutation epoch check, and object URL ownership. Existing late-success tests pass. No cross-workspace leak found. Same-workspace selection has Important issue 1; browser history has issue 2.
2. **Saved needs_human with nullable evidence:** canonical rule_results is always an ordered five-element array; individual `passed` values and `extracted` can be null. Successful 201 stays success, the result displays saved review/error details, and false/null display distinctly. Existing transport and page tests pass.
3. **Unsupported prepared inputs:** exact hash/material checks and exact renewal comparisons reject unsupported photos/scopes/images. No hidden live fallback or browser coverage engine found. A supported input after a registry transition exposes Important issue 3.
4. **Competing supervisor / 409:** the selected decision is blocked and the authoritative pending queue is refetched; a disappearing row retains the conflict explanation rather than pretending to save. The backend has no decided-detail read, so the UI does not fabricate the competing outcome. Original verdict/time are not overwritten by frontend logic. Existing two conflict tests and preview invariant tests pass.
5. **Timezone / long mobile content:** date-only formatting is structurally timezone-safe and covered by a test. Reviewed responsive grid changes, wrapping and supplier scope controls. Actual 390px/zoom/contrast judgments are assigned to the independent visual/usability reviewers and are not claimed from jsdom or CSS inspection.

## Verification and recommendations

- Independently ran `pnpm --dir src/frontend test --run`: **48 passed**, exit 0.
- Ran the actual prepared gateway via Vite SSR to reproduce issue 3; ran actual React components in in-memory jsdom probes to reproduce issues 1 and 2. No probe files were added. Early probe attempts needed missing jsdom globals; those harness errors are not product findings.
- Inspected frontend runtime/config/CI, router/session/gateways, all task pages and shared components, responsive styles, fixture generation/contract tests, and the relevant merged backend schemas/routes. Read the test suites alongside those implementations.
- `git diff --check` found only extra terminal blank lines in `.env.example` and `.node-version`; omitted as nonfunctional formatting noise.
- Did not repeat the author's build, Python suite, Ruff/mypy, or real HTTP smoke. Those remain author-reported evidence, not this reviewer's independent results. Running the frontend tests did not alter tracked source.
- Fix the three Important issues and add focused regressions. Keep pending outcome handling tied to both workspace identity and the active record/route. Complete the final design/review documentation and record reviewer dispositions before presenting the branch as finished.

## Declined to judge

- Live RunPod quality, model accuracy, cache provenance, and latency: no real model call was authorized/performed in this review; the frontend correctly calls the source unreported.
- Production PostgreSQL concurrency and deployment reliability: independent runtime/deployment evidence is required; the reviewed local smoke used SQLite.
- Production authentication and authorization strength: the agreed demo headers deliberately simulate identity; replacement with real auth is outside this frontend task.
- Production SPA mounting, reverse proxy, CORS, TLS, and deep-link hosting: the frontend build/output and runbook handoff are present, but host configuration belongs to the deployment/backend owner and is explicitly pending.
- Persistent staff history, decided-delivery lookup, and certificate metadata absent from material responses: the canonical API does not expose these capabilities; inventing requests would violate the plan. Existing explicit unavailable states are acceptable within this contract.
- Showing the authoritative competing decision after 409: current API exposes only the pending collection, so disappearance plus conflict explanation is the available truthful behavior; adding a detail/history endpoint requires the backend owner.
- Real-time queue/activity push or a polling SLA: the plan does not establish one, and route remounts re-read data. No claim of automatically synchronized separate browser sessions is approved by this review.
- Certificate-image extraction/pre-fill and server reset: explicitly stretch/unsupported; core manual renewal and preview reset are implemented.
- HEIC or other upload formats and more than 10 MiB: the merged backend supports PNG/JPEG within the stated limit; the frontend correctly follows it.
- Visual fidelity of binary assets, real browser layout/contrast, mobile gestures beyond route semantics, and screen-reader output: assigned to separate visual/usability reviewers; no CUA/browser access was used here.
- Final DESIGN.md, design.json, review synthesis and refreshed memory: parent explicitly identified these as forthcoming after independent reviews. Their absence at this checkpoint is unfinished delivery work, not a separate code defect.
- Backend/README changes inherited from main, evaluation data approval, and live board status: outside authored frontend scope and team ownership; this review makes no completion claim for them.
- Cosmetic test formatting and terminal blank lines: no meaningful user impact; not promoted to actionable findings.

## Assessment

**Ready to merge? With fixes.**

The branch has a sound contract boundary and substantial working coverage. Fix the three reproduced lifecycle/preview defects before merge: two can lose or replace current user work, and one contradicts the shared-renewal demonstration. Production hosting and real-model/PostgreSQL validation remain explicit release dependencies.
