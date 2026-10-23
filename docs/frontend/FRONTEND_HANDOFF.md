# Continue the frontend from GitHub

## Current motion update — 23 October 2026

Continue on **codex/landing-refinement**, which incorporates main **aec5d32** (the team's merged frontend PR #69 and frontend-serving PR #73). Nigel approved the two image concepts and their implementation. **PR #72 was intentionally closed by Nigel**; this update does not reopen it or merge the branch into main. The earlier checkpoint below is historical.

Implemented the short landing with layered evidence sheets and Photo/Record/Compare controls, orange navigation/light surfaces, smooth section scrolling, guarded navigation transitions with a static/reduced-motion fallback, linked comparison rows, photo docking, and confirmed delivery/renewal receipts. Phone evidence controls remain reachable and scroll to the selected sheet. No new dependencies or raster assets were added; original upload bytes, protected image headers, roles and business rules are unchanged. New files: `components/landing-evidence.jsx`, `lib/motion.js`, `styles/motion.css` and their focused tests under `src/frontend/src/`.

Latest checks: **71 frontend tests passed**, lint and production build passed; **257 Python tests passed /114 skipped**, including **11** frontend mount/preview checks. Independent review found a superseded-navigation race and a removed supplier spacing override; the race has two RED→GREEN integration regressions, and supplier spacing was restored and checked in the browser. One detector pass reported zero findings. Prepared-mode browser checks covered the landing, phone delivery result, supervisor field highlighting and supplier renewal; focus and absence of horizontal overflow were inspected at actual CSS widths 1440 and 480. Reduced-motion behavior is covered by source inspection and focused tests; native media emulation was unavailable. Native snapshot compositing, real inference, shared PostgreSQL and deployed acceptance are separate checks.

A small Windows compatibility fix normalizes StaticFiles path separators so missing `/api/...` paths keep JSON 404 responses instead of returning the SPA HTML. The failure was reproduced on this workstation and verified after the fix; API business behavior is unchanged. Keep design images, external plans and review scratch outside this repository. Existing minor field-error links and activity/decision copy refinements remain deferred.

The CI-configured Ruff E/F/I check and full formatting check pass. An additional all-rules Ruff scan reports four pre-existing style findings in unchanged `src/backend/extract.py` (PLC0414 twice) and `src/backend/rules.py` (SIM114 twice); these were not silently fixed as part of frontend work.

## Earlier frontend checkpoint

Completed 23 October 2026 on **codex/frontend-redesign**. Latest main **7c556ff** is integrated, including Malaysia business dates, the explicit manual demo-reset command and PostgreSQL CI coverage; original **Frontend / 27e96f8** is untouched. Implementation and independent review fixes are included. The personal branch was consolidated during PR cleanup so intermediate design artifacts and duplicate plates do not remain in its new commit history.

Published for team review in **[PR #69](https://github.com/deettoh/halal-supplier-control/pull/69)**. All seven implementation tasks are complete; deployment and real-service acceptance remain the next team stage. No merge to main was performed.

Start with [DEVELOPMENT.md](DEVELOPMENT.md), [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md) and [REVIEW_2026-10-23.md](REVIEW_2026-10-23.md). Required implementation files are under `src/frontend`; the package/lockfile is standalone and does not require Replit's workspace catalogue. Design tokens live in `src/frontend/src/styles/`. Review reports and actual desktop/phone screenshots are committed under `docs/frontend/reviews/2026-10-23/`. Intermediate design-tool files, root design briefs, implementation plans and duplicate source plates are excluded; shipping photographs remain in `src/frontend/public/media/`.

All seven routes and three roles are implemented. Confirmed design is C Evidence Room, orange navigation/light work areas, Halal Supplier Control branding, judge-facing introduction followed by a role/organisation picker, phone staff and laptop supervisor/supplier flows. Do not re-open direction selection or rebuild the teammate's reference branch.

Latest local checks: **53 frontend tests passed**, lint/build passed; after integrating PR #71, **250 Python tests passed /114 skipped**, Ruff check/format and mypy passed. Four preview-fixture checks confirm exact JPEG hashes and unchanged rule outputs. Shipping labels are full-resolution progressive JPEGs, about 9 times smaller; prepared selection preserves MIME type and bytes. Isolated actual HTTP smoke uses SQLite and failed-extraction stub; real RunPod/deployed PostgreSQL/deployment are unverified. Prepared preview is explicit and never an automatic live fallback.

Remaining team work is deployment acceptance: configure SPA hosting and API proxy, run the shared PostgreSQL/real-inference workflow, review missing history/provenance API needs, and record actual measurements separately. The frontend does not supply persistent staff history, an all/decided-deliveries query, certificate-image prefill, or production authentication. Three minor copy/accessibility improvements are explicitly deferred in the review record. No merge to main, live board edit or teammate message has been made.

The independent visual verdict resolved both material fixes; the code review's three Important findings have RED-to-GREEN regressions. Do not rerun the design detector during a continuation merely to resume context: it already ran once, with zero findings. No open material review fix remains.
