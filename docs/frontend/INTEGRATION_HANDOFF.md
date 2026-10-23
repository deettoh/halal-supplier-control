# Frontend integration handoff — 23 October 2026

The full frontend is implemented on `codex/frontend-redesign`. Member 3's `Frontend` branch at `27e96f8` remains a reference and is untouched. Main **95ab738** (including PR #70's uv packaging) was fetched, inspected and integrated into this personal branch. The evaluation checkout and deferred root README were not authored or reset by this work.

## API compatibility

`src/frontend/src/lib/api/` is the only transport boundary. Every request captures `X-Demo-Role` and `X-Demo-Tenant` from its starting workspace. Query caches include mode, role and tenant; switching workspaces remounts the scoped provider and discards late mutation messages. Protected photos are fetched with headers, displayed through object URLs and revoked on replacement/unmount.

| UI action | Current backend |
| --- | --- |
| Materials/coverage | GET `/api/materials` |
| Staff upload | POST `/api/deliveries`, multipart numeric `material_id` and original `image` |
| Supervisor pending queue | GET `/api/deliveries?status=pending_review` |
| Supervisor decision | POST `/api/deliveries/{id}/decision`, JSON `decision`, trimmed nonblank `reason` |
| SME activity | GET `/api/activity` |
| Supplier records | GET `/api/certificates` |
| Supplier renewal | POST `/api/certificates`, flat multipart fields and JSON-encoded structured `scope` |
| Stored certificate photo | GET `/api/certificates/{id}/image`, **both demo headers required** |
| Stored delivery photo | GET `/api/deliveries/{id}/image`, **both demo headers required** |

Image paths were confirmed by Nigel's teammate update and the merged contract. Both upload forms accept PNG/JPEG up to 10 MiB; the backend validates/decodes and stores JPEG. The browser never resizes or converts submitted evidence. Issuer/holder limits are 200; certificate number 100. Scope retains every `{product_name, brand}` row; blank brand becomes null, not a dropped row or CSV string.

Saved 201 `needs_human` is a successful saved-for-review result, including nullable extraction and check states. `false` and `null` checks remain distinct. Original coverage and later acceptance/rejection are separate. Activity uses the current fixed action vocabulary. POST requests are not automatically retried. A 409/404 decision conflict refreshes and blocks the stale decision, including when its row disappears.

## Deliberate backend/deployment boundaries

- Persistent staff history and a supervisor all/decided-deliveries query are not provided. The UI says so; it retains the current visit's returned record and never invents a history endpoint. Decided history is available only in explicitly prepared preview.
- Material responses omit certificate number/issuer. Masterlist search uses only supported material/supplier/brand/manufacturer fields.
- Certificate extraction/pre-fill remains stretch/501 and is not presented as a working core feature.
- Inference responses do not distinguish live/cache provenance. The interface says **Inference source unreported**. An HTTP success is not proof of live model accuracy.
- Production SPA hosting, API proxy/CORS, PostgreSQL and real RunPod availability need deployment-owner verification. Demo headers are simulated identity.
- No database reset endpoint is invented. The preview reset affects only prepared examples in its own tab.

## Verification evidence

At this checkpoint: **52 frontend tests**, lint and frozen install passed; production build passed with operational routes split into separate chunks. Updated merged Python checks: **231 passed / 105 skipped**, Ruff check/format and mypy passed. Skips include explicit PostgreSQL/live opt-ins; no real RunPod or PostgreSQL test was run.

Browser checks covered landing/picker; original-byte upload; saved incomplete extraction; protected delivery and seed certificate photos; reason-required decision; actual activity; supplier scope preservation/renewal; both linked SME masterlists; role/tenant isolation; keyboard material selection; photo Escape/focus return; phone reflow and desktop workbench. Prepared preview and actual HTTP checks are separate evidence.

HTTP checks ran the merged FastAPI routes/services against disposable SQLite, with an explicit extraction failure stub and no model call. A delivery was saved, reviewed/rejected with a reason and logged. Supplier renewal used native keyboard date input and updated Crescent to 8 covered materials. A separate actual no-database response showed the 503 recovery UI without any prepared fallback. This establishes local HTTP compatibility, not deployed PostgreSQL, authenticated production access or model accuracy.

Design review evidence and final reviewer dispositions are recorded in `REVIEW_2026-10-23.md`. The implemented design tokens and layouts are in `src/frontend/src/styles/`. Intermediate design documents and tool outputs were removed from the published branch during PR cleanup; the app builds without them.

## Board handoff

These exact historical Member 3 titles have implementation and local evidence ready for review:

- **Vite + React + Tailwind skeleton with the role switcher (Receiving Staff or Halal Supervisor for either SME, or the Supplier)**
- **Delivery check, Review and Activity log screens and the supplier renewal form, on mock JSON in the frozen shape**
- **Delivery check screen wired (material picker, photo upload, verdict, rule checklist)**
- **Review screen wired (masterlist coverage, queue, accept or reject with a reason)**
- **Activity log screen wired**
- **Supplier renewal form wired (current certificate shown, renewed fields submitted)**

The first two can be marked Done after team review of this branch. The four wiring cards have local HTTP evidence; their shared deployed-backend acceptance remains pending. The user updates the inaccessible live board. No board change or teammate message was sent by Codex.

