# Dataset declaration - draft input for Member 1

Updated 23 October 2026. Nigel reports that the finished label review is complete and Member 1 requests a testing PR. The original packet revision 2 photos and expected-results JSON are preserved; review_status.json records the report without inventing the reviewer identity or changing the legacy final-approval flag. No live-model evaluation or manual timing has been performed. Member 1 assembles the team's final technology/declaration submission.

## Actual asset inventory and creation

- Dataset: synthetic-labels-2026-10-22-v1, eight cases L01-L08 and eight distinct photographs at tests/eval/images/L01.png through L08.png.
- Every file is a 1254 x 1254 native PNG, copied byte-for-byte from the built-in image-generation output. Image SHA-256s, sizes, fixture references and review state are in tests/eval/expected_results.json.
- Creator workflow: Codex prepared prompts from the agreed case/seed plan, used the **OpenAI built-in image_gen tool** once independently for each image, and visually transcribed/checked the visible or obscured fields. No physical camera photographs, external source images, manual pixel edits or format conversions were used. The image tool did not surface a model ID; do not invent one.
- Exact eight prompts are recorded in tests/eval/generation_prompts.json. Codex also helped write the preparation documents, scoring script and tests; this is actual AI-tool use to disclose in the team's full record.
- Fictional product, brand, manufacturer, SME, supplier and issuer records derive from the team's synthetic seed. Every package displays SAMPLE - FICTIONAL DEMO. The generic HALAL / SAMPLE circle is not a real certification logo; no JAKIM logo or real customer records are used.

## Ground truth and context

All eight originals were visually checked by Codex against product_name, brand, manufacturer and halal_mark_present. All covered regions remain null rather than being filled from seed knowledge. L04 conceals the entire label and mark area; L05 conceals only the manufacturer's value. Nigel reported completion of that review on 23 October. No correction list or named final approval was relayed; the published review receipt records exactly that evidence.

The fixed evaluation date is 2026-10-21, confirmed by Member 5. Initial seed origin was PR #59/main 7667f4b. Packet revision 2 uses structured scope from PR #62 and code/seed main 8cc3b9f, with current and prior hashes recorded in the expected answers. All original photo bytes and intended outcomes are unchanged. L06/L07 use independent evaluation-only certificate copies for expiry/scope; shared seed records are unchanged. Eight expected label inputs match intended verdicts using production rules; this is fixture verification, not model accuracy. Initial workflow statuses remain expected, not observed.

## Limitations and proposed declaration

> The prototype evaluation set consists of eight AI-generated synthetic package photographs with fictional demo records. It includes clear labels, changed brand/manufacturer, full and partial occlusion, and certificate expiry/scope contexts. Expected image fields were visually checked by Codex, and Nigel reported the finished review complete on 23 October. The final report must retain the actual review/approval evidence and input hashes. The set is small, mostly clear, English-only and not a sample of real supplier deliveries. The generic marks do not establish certificate authenticity or a religious ruling. No live extraction accuracy or time-saving result is claimed by creation of this dataset.

There is no dedicated clearly-absent-mark image, natural motion-blur study or production distribution in this set. No held-out split has been selected yet; record any tuning/held-out decision before prompt work. Repeated calls are not additional independent images. Save preprocessing/cache provenance and modes when actual predictions are collected. Do not assert a dataset license, model-training permission or production accuracy that has not been established.

This draft is ready as review input; it has not been sent to Member 1 by Codex. Finalize human review state, actual collected results/modes, prompt versions and any preprocessing before submission.
