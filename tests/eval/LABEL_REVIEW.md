# Fictional label dataset - teammate review

**23 October handoff:** Nigel reports the review is complete and Member 1 requests a testing PR. Use [TESTING_HANDOFF.md](TESTING_HANDOFF.md) and [review_status.json](review_status.json) for the current status. Original photo and expected-results bytes are preserved; the legacy approval flag is not silently changed. The preparation/review-request text below records the earlier packet stage.

**Packet revision 2**, refreshed against merged main **8cc3b9f** (PRs #60/#62). Dataset identity and all eight original image bytes are unchanged; fixture/code/seed references are refreshed. Send **label-review-v2.zip**; keep the earlier ZIP as historical. Human finished-asset approval remains pending.

This packet contains eight AI-generated synthetic package photographs and expected answers visually checked by Codex for the agreed evaluation scenarios. It is prepared for human teammate review, not a live-model result. All labels disclose SAMPLE / FICTIONAL DEMO; their generic HALAL / SAMPLE circle is not an official certificate mark.

## Open and review

Open **LABEL_REVIEW.html** after extracting the review ZIP. Keep the images folder next to it. Each case shows its actual image, expected extraction values, registry references, certificate override and expected initial verdict/status. Click an image for full resolution. Machine-readable answers are in **expected_results.json**; generation prompts/provenance are in **generation_prompts.json**.

Please check:

1. The three expected text values match what is actually visible, including spelling and capitalization. For an obscured value the answer is null; never infer it from seed knowledge.
2. L04 has all target content and the mark region covered. Its mark answer is null (not observable), not false (confirmed absent). L05 has only the manufacturer value covered.
3. The generic HALAL / SAMPLE stamp is visible in the other seven photos. It indicates an observed fictional printed mark only.
4. Material, supplier, certificate and fixed **2026-10-21** date references match the seed and intended case. L06/L07 use independent evaluation-only certificate copies.
5. Expected initial statuses follow the agreed workflow; actual backend transitions still require integration testing.

Reply with agreed changes or approval, naming case IDs. Member 5's earlier case/format/date agreement is already recorded. Approval of this finished asset set is recorded separately; do not replace the dataset-approval flag with approved until that review occurs.

## Case map

| Case | Photo difference / registry context | Expected verdict / initial status |
| --- | --- | --- |
| L01 | Clear Cocoa Powder / SilverCocoa / Silver Valley Foods; valid certificate 3 | covered / auto_accepted |
| L02 | Brand ALT SAMPLE BRAND; approved brand remains SilverCocoa | substitution / pending_review |
| L03 | Manufacturer ALT SAMPLE MAKER; approved maker remains Silver Valley Foods | substitution / pending_review |
| L04 | Product, brand, manufacturer and mark region fully obscured | needs_human / pending_review |
| L05 | Manufacturer value obscured; other fields/mark readable | needs_human / pending_review |
| L06 | Clear label; evaluation copy of certificate 3 expires 2026-10-20 | not_covered / pending_review |
| L07 | Clear label; evaluation copy of certificate 3 excludes Cocoa Powder | not_covered / pending_review |
| L08 | Wheat Flour / GoldenMill / Golden Grain Foods; certificate 1 expires 2026-11-30 (40-day warning) | expiring / auto_accepted |

L01-L07 use material 6, supplier 2 and base certificate 3. L08 uses material 1, supplier 1 and certificate 1. Tenant: Sunrise Bakery SAMPLE. Each case has a different generated photograph. The expiry/scope failures are registry conditions and are intentionally not written on the product images.

## Using the files

- Supply only the original images/L01.png through images/L08.png to the extractor. The review page and this document reveal answers and are not evaluation inputs.
- The expected-results file keeps the agreed proposed_expected_extraction / proposed_expected_verdict / proposed_expected_initial_status keys for compatibility with the merged scorer. The values are expected answers, not collected predictions.
- For rule prechecks, select the referenced material/base certificate, deep-copy the certificate independently for each case, and apply its evaluation_certificate_override. Do not alter the shared seed or reuse an overridden certificate across cases.
- Seed/API/loader/rules now share product/brand object scope. L07 removes Cocoa Powder while preserving remaining brand restrictions. L02 fails R2 and R3; first failure stays R2. Backend reset/fixture selection and status transitions are not implemented by this packet.
- Files are native PNG outputs; record any conversion/preprocessing and confirm MIME handling with Member 1 before live collection. Do not change extensions without converting bytes. Keep original image hashes as the dataset identity.
- The images are AI-generated mock photographs, not camera captures of physical products. This small, mostly clear, English-only set does not establish production accuracy. It contains two occlusion cases and no dedicated clearly-absent-mark case.
- No RunPod calls, live predictions, measured accuracy or manual timing are included. For manual timing give the participant unannotated photos and the same source records; this review page contains answers. Record participant familiarity.

The convenience ZIP includes a read-only copy of src/seed/seed.json under reference/seed.json for standalone review. This reference is not an alternative production seed. Retain the exact file/hash and approved fixed date when reporting results.

## Historical review request prepared on 22 October

Send the reviewer ZIP to Member 5 (and Members 1/4 for integration review) with this message:

> Please review label-review-v2.zip, open LABEL_REVIEW.html, and check L01-L08 against the visible/null expected fields and registry context. Photos and intended results are unchanged; revision 2 aligns fixtures with merged main 8cc3b9f and structured scope. Please reply using REVIEW_REPLY_TEMPLATE.md with approval of the finished asset set or corrections by case ID. Your earlier case/format/date agreement is already recorded. This is not a live accuracy result.

Codex has prepared this message and has not sent it. Record the actual reply/reference before changing member_5_approval.

## Separate participant pack

The separately prepared **manual-participant-v2.zip** has unannotated originals, complete per-case registry cards and a blank response sheet. It excludes this answer-bearing reviewer page and the facilitator key. That timing kit remains separate local preparation and is not part of this label-testing PR; Member 1 does not need it to test the extractor. Actual timing observations remain empty.
