# Finals label evaluation assets

24 cases, L09-L32, prepared on 30 October 2026. The original eight cases and
their results in tests/eval/ remain unchanged. These are AI-edited fictional
labels on user-supplied online source photographs, not real delivery records.

## What is in this set

| Cases | Category | Count |
| --- | --- | --- |
| L09-L16 | Normal delivery (2 covered, 6 expiring) | 8 |
| L17-L20 | Wrong product, same approved brand/manufacturer | 4 |
| L21-L24 | Changed brand or manufacturer, one field at a time | 4 |
| L25-L28 | Halal mark clearly absent, text readable | 4 |
| L29-L30 | Entire mark area covered; mark value null | 2 |
| L31 | Product name fully hidden; product value null | 1 |
| L32 | Manufacturer fully hidden; manufacturer value null | 1 |

11 source files and 8 related packaging families produced these 24 cases.
L09-L11 reuse the three user-approved previews; 21 additional edits were made.
L28 received one correction to remove residual brand-like upper-strip motifs.
Do not describe these as 24 independent source photographs, nor count repeated
inference runs as additional independent images. Source/family IDs group
correlated cases; do not split related variants across development/holdout.
No untouched holdout is claimed: these are reviewable development cases.

The seed has Cocoa Powder for Sunrise Bakery only, so cocoa cases use that
SME. Flour cases cover Sunrise Bakery and Crescent Caterer. SME names on the
packaging are customer lines, not manufacturers or brands. Deliberately wrong
brands/manufacturers are fictional substitutions, not new seed entries.
All visible certification marks are generic SAMPLE marks. Supporting
addresses, barcodes, dates and nutrition figures are fictional.

## Expected answers were written first

expected_results.planned.json preserves the original target plan written
before generating the 21 new edits. expected_results.json retains those exact
extraction/verdict/status targets, adding visual-review records, file hashes
and dimensions after generation. Its ground_truth_plan_sha256 links the plan.
generation_prompts.json records the actual edit prompts; source_manifest.json
records source file hashes and packaging-family provenance. Original source
URLs/creators/licenses were not supplied; source files are not redistributed
in this repository. Generated edits are not proof of source usage rights.

Product name excludes separately printed quantity (for example 200 G).
Commit ef451fd records the user's revised mark-target policy: true means a
visible generic mark; null means no positive visible mark, covering both
clearly absent marks (L25-L28) and hidden marks (L29-L30). The original plan
preserves the previous false-for-absent convention. The production schema
still accepts false; only evaluation targets changed. Hidden text remains
null. Do not infer hidden fields from brand or packaging familiarity.

The legacy scorer calls all null-target matches unreadable_abstention.
For this revision that includes four clearly absent marks, so the summary
labels it null_target_match. mark_accuracy now covers present-mark targets
only; it must not be described as accuracy on both present and absent marks.

## Rule compatibility and review

Production includes product-aware R2 and halal-mark R6. All 24 revised
expected extractions produce the predeclared verdict, initial status and
first failing rule. L11 stays Cocoa Powder, excluding quantity. Its previous
quantity-in-name prediction remains an error rather than a revised target.

The original planned JSON is preserved. Integrity tests permit exactly the
four mark corrections in commit ef451fd and reject other unrecorded changes.
The user approved the corrected evaluation and requested a three-pass rerun.
The committed expected-results file is kept byte-identical throughout this
experiment, including preparation-era pending review metadata. Current
approval and execution context are recorded separately in results notes.
Member 1's independent sign-off is not claimed.

## Run and summarize

From the repository root in PowerShell, with RunPod credentials in .env:

```powershell
$env:PYTHONPATH='src'
foreach ($run in 1..3) {
    $predictions = "tests/eval/finals/results/run-$run-predictions.json"
    $report = "tests/eval/finals/results/run-$run-report.json"
    uv run --env-file .env python tests/eval/collect_predictions.py --expected tests/eval/finals/expected_results.json --output $predictions
    if ($LASTEXITCODE -ne 0) { throw "Collection failed: run $run" }
    uv run python tests/eval/run_eval.py --expected tests/eval/finals/expected_results.json --predictions $predictions --output $report
    if ($LASTEXITCODE -ne 0) { throw "Scoring failed: run $run" }
}
uv run python tests/eval/summarize_runs.py --expected tests/eval/finals/expected_results.json --predictions tests/eval/finals/results/run-1-predictions.json tests/eval/finals/results/run-2-predictions.json tests/eval/finals/results/run-3-predictions.json --output-dir tests/eval/finals/results
```

The collector disables cache and retries, saves each completed case, and
refuses to overwrite predictions. An interrupted run has completed_at=null;
retain it and select a fresh output path for another run. The summary requires
three distinct completed run IDs, matching expected/image hashes and matching
model/prompt/code hashes. Three matching failures earn no consistency credit.
Failed requests remain in the verdict denominator.

Per-image extraction_seconds includes preprocessing, client setup, network,
queue/cold-start wait, inference and response validation, excluding file read.
rules_seconds measures offline rules separately. Successful and failed
requests have separate latency populations; p95 uses nearest rank. These are
not complete delivery API or supervisor workflow timings. Initial application
status is not measured. The original eight-photo batch had no per-image model
latency; manual-check timing is a different measurement.

Reports: [combined Markdown](results/summary.md),
[combined JSON](results/summary.json), and
[execution context](results/execution-notes.md).
Raw predictions and individual reports are retained alongside these.
24 cases repeated three times are 72 attempts, not independent photographs.
This is a development/regression rerun following target revision after earlier
outputs were seen; no untouched holdout or real delivery accuracy is claimed.

## Asset preparation validation

On 30 October 2026, the dataset integrity tests and existing evaluation
runner/collector/seed-scope tests passed: 51 tests. Both current collector
and scorer accept the 24-case input. Shared field validation, PNG CRCs, image
hashes/dimensions, source grouping, category counts and preservation of the
pre-generation target plan were checked. This verifies asset packaging and
tool compatibility, not label-reading accuracy or v0.2 rule correctness.
