# Assessment A — independent design and UX review

Method: independent spawned Assessment A (`frontend_visual_review`), completed without reading detector output or Assessment B. Target: `src/frontend/src/App.jsx` and its complete operational frontend. Review date: 23 Oct 2026.

## Design-specificity verdict — recorded before detector

The design is authored for this product. The full delivered-label photo, aligned approved/read values, five ordered coverage checks and separate original verdict/current workflow status give it a recognisable inspection purpose. The orange rail and narrow, sturdy lettering carry the chosen Evidence Room direction throughout the roles. This is not an interchangeable metrics dashboard. The first viewport remembers the actual evidence and the decision task, rather than decorative statistics.

The approved 1536×1024 workbench is strongly reproduced. Final comp-diff reports **0.9262 / match** (rounded 93%); 36 regions are match and 20 drift, with no missing or contradicted regions. I inspected the final side-by-side and paired crops for navigation ground, wordmark, review navigation, manufacturer comparison and disabled decision button. The drift is predominantly real font rendering, semantic copy and coherent library icons, not a replacement composition. The separate finish report records the element matrix and sampled ground values.

## Scope and evidence

Read PRODUCT.md, UX_CONTENT_2026-10-22.md, the operational surface/direction contract, build state/spec, review packet, hero/final comp-diff evidence and primary comparison, decision, responsive, certificate and error-state source. Opened the approved comp and chosen C concept, plus every required capture in the packet: desktop, mobile, user-1440/1280/1600, landing, supplier, receiving result, partial review, masterlist, HTTP decision, shared renewal and 503 failure. All show valid content appropriate to their stated dimensions. Historical HTTP filenames are phone captures, as the packet explicitly says. The supplier capture's PNG-only helper is older than current source, which now accepts and labels PNG or JPEG; it is not a current finding.

Created my own fresh background IAB tab at 127.0.0.1:5173. Walked introduction → picker → staff/Sunrise → material selection → exact prepared changed-brand photo → result #500 → supervisor/Sunrise queue → expanded failed R3 → decision and reason ready state. Result focus moved to “Sent for supervisor review”; the new delivery appeared in the supervisor queue. I did not submit the decision. This exercised explicitly labelled prepared state, not database persistence or model inference. Supplier and actual HTTP states were reviewed from supplied captures and source, not independently submitted again. My tab was closed. No viewport changes, overlay injection, detector invocation, source/index/HEAD edits or claims of participant testing.

No separate QUALITY BAR card was supplied or located in the packet. The explicitly approved comp is the primary visual authority; no missing benchmark has been invented.

## Heuristic scores

These are reviewer judgments under Impeccable's requested rubric, not measured usability results. All ten apply to the operational application.

| # | Nielsen heuristic | Score /4 | Deciding evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Explicit loading/result/status; ready-state decision hint remains stale. |
| 2 | Match between system and real world | 4 | Material, delivered label, certificate scope and supervisor reasons match the task; document coverage is kept separate from religious/authenticity claims. |
| 3 | User control and freedom | 3 | Replace/remove photo, return to queue, workspace switching and preserved editable renewal scope; no universal undo claim. |
| 4 | Consistency and standards | 3 | One shell, semantic statuses and form language; checklist disclosure affordance is weaker than other disclosures. |
| 5 | Error prevention | 3 | Decision and reason gate, approved-material context, explicit preview boundaries and renewal instructions. |
| 6 | Recognition rather than recall | 3 | Evidence stays beside approved values; detailed failure reasons have no visible expansion cue. |
| 7 | Flexibility and efficiency | 2 | Searchable material selection and compact workbench; limited accelerators, phone comparison labels need refinement. |
| 8 | Aesthetic and minimalist design | 3 | Evidence-led hierarchy and restrained task surfaces; no decorative KPI strip. |
| 9 | Error recovery | 3 | Useful retry/error states and safe uncertainty; recovery assessed from source/captures, not every live failure exercised. |
| 10 | Help and documentation | 3 | Contextual photo/scope/reason instructions and landing explanation; rule explanations need a discoverable entry. |
| **Total** | | **30/40 — Good** | Two focused P2 corrections; no P0/P1 found in this review. |

## Priority findings

### A1 — P2: failure explanations look like static rows

**Evidence:** All desktop and phone evidence captures show R1–R5 as an unadorned checklist. `components/delivery-evidence.jsx:18` puts each reason inside closed `details`; `styles/review.css:268` makes the summary a grid and removes its native marker. There is no replacement chevron or “details” cue. In my fresh tab, clicking R3 revealed “Product or brand is not included in certificate scope.” That explanation existed but was visually undiscoverable.

**Effect:** A first-time supervisor can see Failed yet miss the backend's reason before recording a consequential decision. The accessibility tree exposes expanded/collapsed state, so this is a visual discoverability failure rather than proof of a screen-reader failure.

**Fix:** Add a consistent visible expansion cue and open-state treatment to each rule row, or expose failed/not-evaluated reasons by default. Preserve the five-rule order and backend detail. Do not alter the verdict.

**Route:** Intent `/journey` + `/articulate`; Impeccable clarify/harden. H6, H10.

### A2 — P2: comparison labels break words at intended widths

**Evidence:** `user-1280.png` splits Manufacturer into “Manufactur” and “er”; `receiving-result-mobile.png` and `review-partial-mobile.png` strand its final letter. The fixed comparison layout reserves 24% for labels (`styles/review.css:217`) and 27% on small screens (`styles/responsive.css:714`), while all cells use `overflow-wrap:anywhere` (`styles/review.css:225`). The 1536 paired manufacturer crop remains readable; the problem appears at the actual smaller laptop and phone layouts.

**Effect:** The comparison's key label becomes harder to scan precisely where receiving staff use the product. This is recoverable, not a task blocker or horizontal-overflow claim.

**Fix:** Protect ordinary row-label words from mid-word breaking and give labels sufficient space at intermediate/phone widths; if necessary use a compact row header spanning the approved/read pair. Preserve the approved/read association and allow long actual values to wrap.

**Route:** Intent `/transpose` + `/include`; Impeccable adapt/typeset. H7, H8.

## Cognitive load

Single task focus, grouping, hierarchy, one decision at a time and co-located context hold. No memory bridge is required between photo, values and decision on the approved laptop workbench. Local strict-checklist strains are: five rule rows, eight material options when the picker opens, and the insufficiently signalled rule disclosure. This is moderate local load, not a reason to remove canonical checks or arbitrarily cap the seed list. Searchable material recognition and optional prepared examples already reduce the choice burden. The ten renewal scope rows are data to maintain, not ten competing calls to action; keeping the current record beside the editable form is useful.

## Cognitive walkthrough and emotional journey

| Task segment | Judgment | Evidence |
|---|---|---|
| Introduction → role/organisation → workspace | Pass | The role describes its action; organisation follows role; entry is enabled when valid. |
| Staff choose material → select photo → check | Pass | Approved brand/manufacturer remain visible; prepared-mode limitation is stated; result names saved preview state and focuses the outcome. |
| Supervisor choose exception → compare evidence | Hesitation | Clear mismatch and five statuses, but A1 hides the explanation's entry point. |
| Supervisor choose decision + give reason | Pass, minor copy issue | The button enables only after both; original coverage remains separate. I did not submit. |
| Supplier inspect record → maintain scope → publish | Source/capture assessment | Current/previous records and ten editable scope rows are preserved; actual completion not independently claimed. |

The landing begins with an understandable promise and a concrete label example. A flagged result introduces appropriate concern without implying religious authority. Seeing the mismatch beside its photo provides reassurance; the hidden rule detail is the main emotional valley. The staff endpoint names the supervisor handoff and the retained delivery number. The supervisor endpoint should retain the same explicit confirmation already represented in the provided saved-state evidence.

## Strengths to preserve

- The label is a real, fully visible evidence subject with enlargement, not a decorative thumbnail; approved/read values remain aligned with it.
- Original document coverage, later acceptance/rejection and three-state checks are visibly distinct, including Not read versus Not evaluated.
- Supplier renewal keeps structured product/optional-brand scope and makes the shared-registry benefit concrete without invented accuracy or authenticity claims.

## Persona risks and minor observations

**First-time supervisor:** A1 can conceal the reason they should inspect before deciding. **Phone receiving staff:** A2 interrupts reading of a critical comparison label; the material/photo/check sequence itself remains coherent. **Supplier maintaining a long record on a laptop:** ten prefilled scope rows and natural page scrolling are appropriate; do not replace them with a small nested scrolling box during repairs.

P3: after I selected Reject and entered a complete reason, Record decision enabled, but the hint still said “Choose a decision and enter a reason.” Make it conditional or remove it in the ready state. This is minor and is not a third material finish demand.

No deceptive urgency, consent manipulation or unsupported commercial performance claims were observed. Status words accompany semantic colours. This is not an accessibility-conformance claim; participant research and real model-accuracy measurements remain outside this assessment.

## Recommended actions

Apply one bounded correction batch for A1 and A2. Recheck their affected desktop/phone states, keyboard expansion and comparison associations; do not reopen the chosen world or composition. The minor decision hint can be adjusted in that batch if safe. Then score these fixes rather than launching another general polish hunt.

Questions skipped: implementation and focused review were already authorised; no unresolved preference.
