# Finals three-run evaluation

Dataset: `finals-edited-labels-2026-10-30-v1`. 24 synthetic cases; 72 attempts. Targets revised in commit ef451fd.

Model: `qwen/qwen3-vl-8b-instruct`; temperature 0.0.

| Metric | Run 1 | Run 2 | Run 3 | Pooled attempts |
| --- | --- | --- | --- | --- |
| schema_success | 24/24 (100.0%) | 24/24 (100.0%) | 24/24 (100.0%) | 72/72 (100.0%) |
| field_accuracy | 87/88 (98.86%) | 87/88 (98.86%) | 87/88 (98.86%) | 261/264 (98.86%) |
| text_literal_accuracy | 68/70 (97.14%) | 68/70 (97.14%) | 68/70 (97.14%) | 204/210 (97.14%) |
| text_normalized_accuracy | 69/70 (98.57%) | 69/70 (98.57%) | 69/70 (98.57%) | 207/210 (98.57%) |
| mark_accuracy | 18/18 (100.0%) | 18/18 (100.0%) | 18/18 (100.0%) | 54/54 (100.0%) |
| whole_readable_label_accuracy | 21/22 (95.45%) | 21/22 (95.45%) | 21/22 (95.45%) | 63/66 (95.45%) |
| null_target_match | 7/8 (87.5%) | 7/8 (87.5%) | 7/8 (87.5%) | 21/24 (87.5%) |
| verdict_accuracy | 22/24 (91.67%) | 22/24 (91.67%) | 22/24 (91.67%) | 66/72 (91.67%) |
| initial_status_accuracy | Not measured | Not measured | Not measured | Not measured |

Per user revision, absent and hidden marks both target null. Legacy unreadable_abstention scores all null targets, including clearly absent marks. mark_accuracy covers present marks only.

`null_target_match` is the legacy scorer's `unreadable_abstention` metric.

## Repeatability

- literal_extraction_consistent: 24/24 (100.0%)
- normalized_extraction_consistent: 24/24 (100.0%)
- verdict_consistent: 24/24 (100.0%)

## Verdicts by scenario (pooled attempts)

- absent_mark: 12/12 (100.0%)
- hidden_mark: 6/6 (100.0%)
- hidden_text: 3/6 (50.0%)
- normal: 21/24 (87.5%)
- substitution: 12/12 (100.0%)
- wrong_product: 12/12 (100.0%)

## Timing

extraction_seconds includes preprocessing, client setup, network, queue/cold-start wait, inference and response validation; rules_seconds measures offline rules only; file reading excluded

p95 uses nearest rank; failed requests are separate.

| Population | Count | Median (s) | p95 (s) | Min (s) | Max (s) |
| --- | --- | --- | --- | --- | --- |
| successful_extractions | 72 | 2.458114 | 3.967106 | 2.111466 | 4.870199 |
| failed_extractions | 0 | N/A | N/A | N/A | N/A |
| offline_rules | 72 | 0.000077 | 0.000272 | 0.000044 | 0.000337 |

## Cases needing attention

### L11 (normal)

Expected: `{"product_name": "Cocoa Powder", "brand": "SilverCocoa", "manufacturer": "Silver Valley Foods", "halal_mark_present": true}`; verdict `covered`.

- Run 1: `{"product_name": "Cocoa Powder 200 G", "brand": "SilverCocoa", "manufacturer": "Silver Valley Foods", "halal_mark_present": true}`; verdict `substitution`; error `None`.
- Run 2: `{"product_name": "Cocoa Powder 200 G", "brand": "SilverCocoa", "manufacturer": "Silver Valley Foods", "halal_mark_present": true}`; verdict `substitution`; error `None`.
- Run 3: `{"product_name": "Cocoa Powder 200 G", "brand": "SilverCocoa", "manufacturer": "Silver Valley Foods", "halal_mark_present": true}`; verdict `substitution`; error `None`.

### L32 (hidden_text)

Expected: `{"product_name": "Cocoa Powder", "brand": "SilverCocoa", "manufacturer": null, "halal_mark_present": true}`; verdict `needs_human`.

- Run 1: `{"product_name": "Cocoa Powder", "brand": "SilverCocoa", "manufacturer": "Sunrise Bakery", "halal_mark_present": true}`; verdict `substitution`; error `None`.
- Run 2: `{"product_name": "Cocoa Powder", "brand": "SilverCocoa", "manufacturer": "Sunrise Bakery", "halal_mark_present": true}`; verdict `substitution`; error `None`.
- Run 3: `{"product_name": "Cocoa Powder", "brand": "SilverCocoa", "manufacturer": "Sunrise Bakery", "halal_mark_present": true}`; verdict `substitution`; error `None`.

## Provenance and limitations

Expected input SHA-256: `1f72cd146709a4f8cdde6e3c08612346924ccdb67ba808da4ef80ce3754ef910`.
Code base: `ef451fdf5b8acca43a32044041a1dd40d1faaacf`; working-file hashes in JSON.
Prompt SHA-256: `8becf1b0a009fd997ec3e90f247923953f35968964363162d2e7ba3707f68f75`.

See execution-notes.md for approval and the revised null-mark policy.

- Repeated synthetic cases are correlated; not real delivery accuracy.
- Saved live mode is not independently attested by the offline scorer.
- No full delivery API, supervisor workflow or initial status measured.
- Targets were revised after observing a previous experiment.
- These results are development/regression evidence, not a holdout.
