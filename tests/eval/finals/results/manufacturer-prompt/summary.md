# Finals three-run evaluation

Dataset: `finals-edited-labels-2026-10-30-v1`. 24 synthetic cases; 72 attempts. Targets revised in commit ef451fd.

Model: `qwen/qwen3-vl-8b-instruct`; temperature 0.0.

| Metric | Run 1 | Run 2 | Run 3 | Pooled attempts |
| --- | --- | --- | --- | --- |
| schema_success | 24/24 (100.0%) | 24/24 (100.0%) | 24/24 (100.0%) | 72/72 (100.0%) |
| field_accuracy | 88/88 (100.0%) | 88/88 (100.0%) | 88/88 (100.0%) | 264/264 (100.0%) |
| text_literal_accuracy | 68/70 (97.14%) | 68/70 (97.14%) | 68/70 (97.14%) | 204/210 (97.14%) |
| text_normalized_accuracy | 70/70 (100.0%) | 70/70 (100.0%) | 70/70 (100.0%) | 210/210 (100.0%) |
| mark_accuracy | 18/18 (100.0%) | 18/18 (100.0%) | 18/18 (100.0%) | 54/54 (100.0%) |
| whole_readable_label_accuracy | 22/22 (100.0%) | 22/22 (100.0%) | 22/22 (100.0%) | 66/66 (100.0%) |
| null_target_match | 8/8 (100.0%) | 8/8 (100.0%) | 8/8 (100.0%) | 24/24 (100.0%) |
| verdict_accuracy | 24/24 (100.0%) | 24/24 (100.0%) | 24/24 (100.0%) | 72/72 (100.0%) |
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
- hidden_text: 6/6 (100.0%)
- normal: 24/24 (100.0%)
- substitution: 12/12 (100.0%)
- wrong_product: 12/12 (100.0%)

## Timing

extraction_seconds includes preprocessing, client setup, network, queue/cold-start wait, inference and response validation; rules_seconds measures offline rules only; file reading excluded

p95 uses nearest rank; failed requests are separate.

| Population | Count | Median (s) | p95 (s) | Min (s) | Max (s) |
| --- | --- | --- | --- | --- | --- |
| successful_extractions | 72 | 3.140814 | 3.496353 | 2.021655 | 4.203352 |
| failed_extractions | 0 | N/A | N/A | N/A | N/A |
| offline_rules | 72 | 0.000164 | 0.000364 | 0.000043 | 0.003576 |

## Cases needing attention

## Provenance and limitations

Expected input SHA-256: `1f72cd146709a4f8cdde6e3c08612346924ccdb67ba808da4ef80ce3754ef910`.
Code base: `7b7014ba661709c168d061d917ca1fa6c17b9cdb`; working-file hashes in JSON.
Prompt SHA-256: `e0c259271fa5e56147f97c85520c40d9449f0e8d59c40644dac5bea061b4b648`.

See execution-notes.md for approval and the revised null-mark policy.

- Repeated synthetic cases are correlated; not real delivery accuracy.
- Saved live mode is not independently attested by the offline scorer.
- No full delivery API, supervisor workflow or initial status measured.
- Targets were revised after observing a previous experiment.
- These results are development/regression evidence, not a holdout.
