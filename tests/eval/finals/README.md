# Finals label evaluation assets

24 cases, L09 to L32, prepared on 30 October 2026. The original eight cases
and their results in tests/eval/ are unchanged. These are fictional labels
made by editing AI-generated source images.

## What is in this set

| Cases | Category | Count |
| --- | --- | --- |
| L09-L16 | Normal delivery (2 covered, 6 expiring) | 8 |
| L17-L20 | Wrong product, same approved brand and manufacturer | 4 |
| L21-L24 | Changed brand or manufacturer, one field at a time | 4 |
| L25-L28 | Halal mark clearly absent, text readable | 4 |
| L29-L30 | Entire mark area covered, mark value null | 2 |
| L31 | Product name fully hidden, product value null | 1 |
| L32 | Manufacturer fully hidden, manufacturer value null | 1 |

11 source files and 8 related packaging families produced these 24 cases.
L09 to L11 reuse the three previews the team approved, and the other 21 cases
are new edits. L28 had one extra edit that removed brand-like motifs left in
its upper strip.

The 24 cases aren't 24 independent photographs, and repeated inference runs
aren't extra images. The source and family IDs group correlated cases, so
keep related variants on the same side of any development and holdout split.
The set has no untouched holdout, and every case is a development case.

The seed has Cocoa Powder for Sunrise Bakery only, so cocoa cases use that
SME. Flour cases cover Sunrise Bakery and Crescent Caterer. SME names on the
packaging are customer lines, not manufacturers or brands. The deliberately
wrong brands and manufacturers are fictional substitutions, not seed entries.
All visible certification marks are generic SAMPLE marks, and the addresses,
barcodes, dates and nutrition figures are fictional.

## Expected answers were written first

`expected_results.planned.json` holds the target plan written before the 21
new edits were generated. `expected_results.json` keeps the same verdict and
status targets, keeps the extraction targets except the L25 to L28 mark values
and adds visual-review records, file hashes and dimensions. Its
`ground_truth_plan_sha256` links the plan.
`generation_prompts.json` records the edit prompts, and `source_manifest.json`
records the source file hashes and packaging families. The source images are
AI-generated and aren't committed.
The preparation files `expected_results.json`,
`expected_results.planned.json` and `review.html` still describe them as
online sources. The results pin the hash of `expected_results.json`, which
pins the plan through `ground_truth_plan_sha256`.

The product name excludes a separately printed quantity such as 200 G. Commit
ef451fd sets the mark target policy, where `true` means a visible generic mark
and `null` means no visible mark. `null` covers both the clearly absent marks
(L25 to L28) and the hidden marks (L29 and L30). The original plan keeps the
earlier convention of `false` for an absent mark. The production schema also
accepts `false`. A hidden text field is `null` even when the brand or package
is familiar.

The scorer calls every null-target match `unreadable_abstention`. Here that
includes the four clearly absent marks, so the summary labels the metric
`null_target_match`. `mark_accuracy` covers present-mark targets only and
isn't accuracy on absent marks.

## Every expected extraction gives the predeclared verdict

With the production rules, including the product check in R2 and the
halal-mark check in R6, all 24 expected extractions produce the predeclared
verdict, initial status and first failing rule. The L11 target stays Cocoa
Powder without the quantity, so a prediction that includes the quantity
counts as an error.

The integrity tests in `tests/test_finals_eval_dataset.py` allow exactly the
four mark corrections in commit ef451fd and reject any other change to the
plan. The team made the earlier set of three runs, and the team lead then
accepted the L25 to L28 false-to-null change when approving PR #80, which
carries those results.
`expected_results.json` stays byte-identical across the runs, including its
`pending` review fields from preparation. The approval and run context are in
the results notes.

## Run the evaluation three times and summarize the results

The collector refuses to overwrite a predictions file, so set `out` to a new
folder for each set of runs. With RunPod credentials in `.env`, run from the
repository root:

```bash
export PYTHONPATH=src
expected=tests/eval/finals/expected_results.json
out=tests/eval/finals/results/next-run
mkdir -p "$out"
for run in 1 2 3; do
  uv run --env-file .env python tests/eval/collect_predictions.py \
    --expected "$expected" --output "$out/run-$run-predictions.json" \
    || break
  uv run python tests/eval/run_eval.py --expected "$expected" \
    --predictions "$out/run-$run-predictions.json" \
    --output "$out/run-$run-report.json" || break
done
uv run python tests/eval/summarize_runs.py --expected "$expected" \
  --predictions "$out"/run-{1,2,3}-predictions.json --output-dir "$out"
```

The collector disables both the cache and retries. It saves each case as it
completes. An interrupted run has `completed_at` set to `null`. Keep it and
pick a new output path for the next run. The summary needs three completed
runs with distinct IDs, matching expected-answer, image, prompt and code
hashes, and the same model and temperature. A case with a failed request or
an invalid schema in any run earns no consistency credit, and failed requests
stay in the verdict denominator.

`extraction_seconds` covers preprocessing, client setup, network, queue and
cold-start wait, inference and response validation for each image, and
excludes reading the file. `rules_seconds` times the offline rules on their
own. Successful and failed requests are timed as separate populations, and
p95 uses the nearest rank. These times cover neither a full delivery API call
nor the supervisor's workflow, and the initial application status isn't
measured. The original eight-photo run recorded no per-image model latency,
and the manual-check timing is a separate measurement.

The current set of runs, with the manufacturer prompt, is in
[results/manufacturer-prompt/summary.md](results/manufacturer-prompt/summary.md).
Reports for the earlier set of runs: [combined Markdown](results/summary.md),
[combined JSON](results/summary.json), and
[execution context](results/execution-notes.md).
The raw predictions and per-run reports are next to each summary. The 24 cases
run three times give 72 attempts. Both sets of runs are development and
regression runs made after the targets were revised with earlier outputs in
view. They don't measure accuracy on a holdout set or on delivered goods.

## 51 tests checked the assets before the runs

On 30 October 2026, 51 tests passed, covering the dataset integrity checks and
the evaluation runner, collector and seed-scope tests. The collector and
scorer both accept the 24-case input. The checks cover shared field
validation, PNG CRCs, image hashes and dimensions, source grouping, category
counts and the unchanged pre-generation target plan. They show that the
assets are packaged correctly and that the tools accept them. They don't
measure label-reading accuracy or v0.2 rule correctness.
