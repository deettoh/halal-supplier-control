# Backend v0.2 phase 1: integration handoff

Implemented scope: named identities, enriched activity, and Hold. Expiry check,
scheduling, renewal_requested action/date, per-SME settings and traceability
export are deferred. Health/OpenAPI/project versions remain 0.1.0: this is not
full v0.2 compliance. No seed.json edits or automatic demo reset are included.

## Frontend owner

- GET /api/people is public and returns id, name, title, role, tenant.
- Every protected business request, including protected image reads, now needs
  X-Demo-Role, X-Demo-Tenant and X-Demo-Person. Person must match role and tenant.
  Missing required headers return 422; mismatched/unknown person returns 403.
- Use the existing people picker contract rather than hardcoded role identities.
  Bakery staff/supervisor are IDs 1/2, caterer 3/4; suppliers 5/6; reviewer 7.
- Activity responses add actor_title, material_name, verdict and supplier_name.
  These are captured when new events are written. Legacy fields remain null
  where never recorded; do not guess human names from old role strings.
- New delivery actions/decisions use validated people's names, including
  decided_by. Certificate events include actor title and supplier name.
- POST /api/deliveries/{id}/decision accepts hold with a nonblank reason and
  next_step=request_certificate or request_product_details. next_step is
  required for hold, forbidden (including explicit null) on accept/reject.
- DeliveryResponse includes next_step (null except on_hold). Hold does not
  change original verdict. GET /api/deliveries?status=on_hold lists held items;
  default pending_review omits them. Held rows can be accepted/rejected;
  holding twice or resolving an already terminal delivery returns 409.
- Show hold reason and next step. Labels: Request current certificate and
  Request product details. Needs review uses the first failed rule's detail.
- Existing frontend/preview has NOT been rewritten in this backend phase.
  Update transport headers, identity context, protected photos, decision
  controls and preview fixtures together before deploying this breaking change.
  JSON contracts and seed examples here are ready for frontend coordination.

Example Hold request:

```json
{"decision":"hold","reason":"Need current documents","next_step":"request_certificate"}
```

Resolve with {"decision":"accept","reason":"Documents reviewed"}; omit
next_step entirely. The original Hold reason remains in its activity event.

## Seed owner: documentation only; seed.json unchanged

Existing seven people already match the contract. No new top-level key is
required. Existing seed rows remain loadable. Seed loader permits these new
optional fields (omission defaults to null):

| Seed record | Fields |
| --- | --- |
| deliveries | next_step |
| activity_log | actor_title, material_name, verdict, supplier_name |

A synthetic held delivery must have status=on_hold, decided_by set to the
supervisor name, a nonblank reason, and next_step equal to one of the two
allowed choices. All other delivery statuses must omit next_step or set null.
Its original verdict/rule_results remain the actual check result, not hold.
To show a historical Hold event after acceptance, keep an on_hold activity row
and a later accepted row with their own reasons/timestamps.

For NEW synthetic log examples, use names/titles from people and the same SME.
Delivery events: material_name and verdict recorded at event time;
supplier_name=null. Certificate events: material_name=null, verdict=null,
supplier_name set to the relevant supplier; actor/title is supplier contact
or registry reviewer. Do not invent named attribution for existing historical
role-only rows. Rows seeded as legacy may leave new fields null.

No renewal_requested_on, expiry action or SME-settings seed shape is defined
or added here. Those require the separately deferred expiry agreement.
The internal received_by/received_title columns preserve the actual uploader
for delayed extraction recovery; seed owner need not populate them. Old
recovery records lacking that information retain their legacy role marker.

## Database and release owner

Startup uses an additive, transactional PostgreSQL upgrade under the existing
startup lock. It adds nullable metadata and expands Hold constraints without
dropping data. It does not guess historical names, recompute verdicts or reset
demo records. Hold requires a valid next step and actor/reason at DB level.
Apply the frontend header update in the same release. The original API
contract's coordinated demo reset is a separate explicit release operation,
not performed automatically by this change. Historical five-rule records
remain a previously documented reset/compatibility concern.

Keep the feature marked partial until expiry semantics/scheduler are agreed
and implemented. Do not bump contract_version to 0.2.0 merely because these
three workstreams are complete. No live RunPod requests are needed for tests.
