# Whole-system design review — round 1

22 October 2026. **Image mockups and UX/content design, not an implemented application.** C's orange navigation and light work areas stay fixed. Nigel selected **Option 1 — Side-by-side workbench** through the comparison page. Written whole-system-spec approval and the implementation plan remain ahead. Work is isolated on codex/frontend-redesign, based on main c2e23f5; the teammate's Frontend branch remains untouched.

## What is ready to review

The [whole-system UX/content draft](UX_CONTENT_2026-10-22.md) covers landing/entry, receiving/result states, supervisor queue/decision/history, masterlist, activity, supplier renewal, navigation, failures and device adaptations. The [readiness map](FRONTEND_READINESS_2026-10-22.md) retains required files and backend dependencies. [Canonical example validation](DESIGN_VALIDATION_2026-10-22.json) checks the examples against the actual Python schemas/rules, not browser simulation.

Eight current operational mockups are listed in [the manifest](CURRENT_MOCKUPS_2026-10-22.json). Exact built-in ImageGen prompts, source metadata and embedded prompt provenance are under `.impeccable/mocks/operate/`. Current images are the files below; earlier unversioned drafts are historical. The existing C-evidence-room-v3.png remains the selected landing direction reference.

## One working-layout choice

All three options contain the same evidence, rules, decision controls, role identity and colour system. Only their arrangement changes. **Option 1 is now selected**: it keeps the queue and comparison visible during repeated exception handling. The recorded human answer is `.impeccable/operate-composition-answer.json`. Do not ask this layout question again.

| Option | Structure | Trade-off | Current image |
| --- | --- | --- | --- |
| 1 — Side-by-side workbench | Persistent queue; full label beside approved/read comparison; decision section below | Most efficient for repeated review on a laptop; narrow screens need queue/detail separation | [View option 1](../../.impeccable/mocks/operate/01-review-workbench-v2.png) |
| 2 — Photo-first inspection | Queue return/selector above a larger photograph; compact comparison/checks/action alongside | Better for small label printing; an extra step returns to the full queue | [View option 2](../../.impeccable/mocks/operate/02-review-photo-first-v2.png) |
| 3 — Comparison worksheet | Broad comparison table first; photograph and checks/action below | Immediate text comparison; original photo has less initial prominence | [View option 3](../../.impeccable/mocks/operate/03-review-worksheet-v2.png) |

The local Impeccable comparison page was `http://127.0.0.1:51566/`, terminal session 82707. All three 1536 × 1024 comps loaded; the human answered workbench and the chooser exited successfully. Its recorded answer is authoritative even if the local URL expires. The approved image has top-level launcher aliases `comp-1.png` and the required `comp-1.png.json` sidecar. Three recognised comp entries with one approval passed the gate; Impeccable is now at **spec**. Do not restart the comparison.

## Other roles and shared screens

| Screen | What to assess | Current image |
| --- | --- | --- |
| Phone receiving | Clear material/approved identity; full label preview; two replacement choices; one Check delivery action; labelled navigation | [View receiving](../../.impeccable/mocks/operate/04-receiving-phone-v2.png) |
| Supplier renewal | Current/previous record; structured product/brand scope; readable form and publish action; only supplier navigation | [View supplier](../../.impeccable/mocks/operate/05-supplier-renewal-v2.png) |
| Demo entry | Role then valid organisation; simulated-role disclosure; one Enter workspace action | [View entry](../../.impeccable/mocks/operate/06-demo-entry.png) |
| Masterlist | Full seed identity, compact coverage filters, expiry information and persistent search label | [View masterlist](../../.impeccable/mocks/operate/07-masterlist-v2.png) |
| Activity | Readable chronological event fields, reason and record reference; no invented system role or detail field | [View activity](../../.impeccable/mocks/operate/08-activity.png) |

The phone comp is 853 × 1844 pixels, approximately the aspect of a 390 × 844 viewport. It is a generated discussion image, not a measured CSS/browser capture. Header, action and navigation must remain readable at actual phone size; full-photo enlargement remains a required accessible control in the implementation even though its explicit affordance is absent in this comp.

## Intent Evaluate — concept checkpoint

Method: expert cognitive walkthrough of the written flows and visual inspection of every generated/corrected image, with schema/rule checks on representative authored data. No participant research, interactive prototype, keyboard/screen-reader testing, live inference or persistence test occurred. This is not the formal post-build Impeccable critique/detector run; that is still required after implementation.

### Anti-pattern verdict

Current concepts visibly disclose SAMPLE/preview status and avoid fabricated accuracy, speed, customers, official endorsement and an authenticity claim. There is no forced registration, fake urgency, gamification, decorative analytics dashboard or silent simulated success in the proposed flows. This is a concept-level assessment; actual runtime behaviour is untested.

### Priority findings and disposition

| Priority | Finding and user impact | Heuristic / route | Disposition |
| --- | --- | --- | --- |
| P1 | Initial supplier image invented global Suppliers, Products, Masterlists, Activity and Settings destinations, implying access/features outside supplier scope | H4 consistency, H5 prevention / Journey | Removed in supplier v2; only Certificates and Switch workspace remain |
| P1 | Initial decision captions implied acceptance proves an identity match; a supervisor can accept an exception with a reason | H2 real-world meaning / Articulate | Corrected in workbench v2; removed entirely beneath the options in final photo-first/worksheet v2 |
| P1 | Generated R2 text initially included product, and a worksheet put a halal-mark observation under approved material | H2, H4 / Articulate | R2 now brand/manufacturer only; observed mark is separate from approved-material data in the alternatives; no mark requirement is invented |
| P1 | Generic null copy initially implied any unread field forces needs_human; rules allow null halal_mark_present without that verdict | H2, H5 / Articulate | UX copy corrected and actual-rule assertion added; backend verdict/status remains authoritative |
| P2 | Original phone composition was too dense and duplicated photo replacement actions | H8 minimalism / Journey, Include | Reworked to a phone aspect and two replacement actions. Actual type, scrolling and sticky-region behaviour still need browser verification |
| P2 | The phone companion lacks an explicit Open photo affordance; relying on an unexplained image tap would hide enlargement | H6 recognition / Journey, Include | Open photo remains an explicit implementation requirement in the UX draft; do not omit it or rasterise this omission into the app |
| P2 | Initial search had no persistent visible label; date context repeated in five rows, with undeclared sort controls and bulky filter pills | H5, H8 / Articulate, Impeccable | Masterlist v2 adds the label, shows date context once, removes sorting affordances and simplifies filters |
| P2 | Current API cannot supply persisted staff/decided history, some masterlist certificate metadata or protected photos; business handlers are 501 | H1, H9 / Blueprint | Unresolved team integration dependencies, retained explicitly; not represented as completed functions |
| P3 | Generated typography, subtle tonal shading and a few dense checklist phrases are discussion-image limitations | H8 / Impeccable | Exact UI copy, readable type, flat agreed colour fields and semantic controls must be implemented and reviewed. No additional aesthetic regeneration is justified now |

### Heuristic verdicts at this scope

| Heuristic | Concept verdict and limit |
| --- | --- |
| H1 — Visibility | Holds in the pictured distinction between coverage and workflow status. Waiting/save outcomes are specified, not executed |
| H2 — Real-world language | Holds after the material copy corrections; original verdict and supervisor decision stay separate |
| H3 — Control/freedom | Specified: workspace switching, draft warning, return paths and reset of transient state. Runtime behaviour not assessed |
| H4 — Consistency | Holds at image level after supplier scope correction; frame, identity, controls and evidence align |
| H5 — Prevention | Required reason, unselected decisions and explicit scope rows are visible/specified. Validation is not interactive yet |
| H6 — Recognition | Strained by the phone photo-enlargement affordance still to add; approved/read comparison is a strength |
| H7 — Efficiency | Depends on the chosen arrangement; option 1 retains the next item, option 2 adds a queue-return step |
| H8 — Minimalism | Improved by removing extra modules, duplicate photo controls and large metric/filter cards; actual typography remains to verify |
| H9 — Recovery | Read/save errors, ambiguous POST timeout and stale decision are specified. Backend/interactive execution not assessed |
| H10 — Help | Photo guidance, scope explanation, rule outcomes and mode boundaries exist. Actual assistive presentation not assessed |

### Cognitive walkthrough

| Task | Goal/action visibility | Understanding | Feedback | Result at this scope |
| --- | --- | --- | --- | --- |
| Enter a role/organisation | Three roles and two valid organisation choices are visible | Each role names its task; selected pair is summarised | Enter workspace and intended role destination are explicit | Flow mapped; navigation untested |
| Check a delivery | Material and photo precede the single Check delivery action | Approved identity and readable-label guidance explain the input | Waiting and saved/failed result states are specified | Form concept ready; runtime/result layout still needs build verification |
| Decide an exception | Photo, comparison and all five rules lead to a labelled decision/reason area | Acceptance is not a coverage guarantee | Server confirmation and 409 recovery are specified | Comparison can be judged visually; save/concurrency untested |
| Publish a renewal | Active record, editable fields/scope and Publish renewal are visible | Optional brand restrictions remain explicit; active means current version | Actual saved record/refetch is specified; universal coverage not promised | Form concept ready; persistence/cross-SME recalculation untested |

Positive patterns to protect: full photographic evidence; readable approved-versus-observed values; five independent check results; no default acceptance; preserved brand restrictions; visible identity; compact real counts; a quiet activity record without fabricated charts.

Recommended actions: review the written whole-system specification, carry the Open photo requirement into the phone build, write the concrete implementation plan, then implement against canonical fixtures/APIs. The operational composition is selected. Engage Intent Evaluate again on the working flows and Impeccable's formal critique/finish review after desktop and phone captures exist. Do not treat this concept checkpoint as a completed usability or accessibility test.

## Engineering handoff and board status

No page code, frontend package, working API integration or deployment has been created in this round. Preview examples were validated using the production schemas/rules: changed brand = substitution with R1–R5 true/false/false/true/true; Sunrise material counts 8 total, 3 covered, 5 expiring, 0 not covered on 22 October; expiry warning 39 days. Authored delivery/activity IDs and timestamps are examples, not seeded/live records.

No frontend implementation card is ready for Done. **“Contract reviewed at /docs, with every screen's field confirmed to exist”** still lacks the documented API support. **“Delivery check, Review and Activity log screens and the supplier renewal form, on mock JSON in the frozen shape”** has design/fixture preparation only; it is not an interactive screen implementation. No live board change was made.

The remaining user checkpoint is review of the written whole-system design specification before implementation planning. The composition choice has already arrived and is saved. The architectural brainstorming workflow explicitly requires review of the written spec before writing the implementation plan; no second palette/layout decision is requested. Implementation and full usability/visual verification follow that review.
