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
true means a visible generic halal mark; false means no visible mark on a
fully visible label; null means the mark/field is hidden and cannot be read.
Do not infer a hidden field from brand familiarity or packaging appearance.

## Rule dependency: required before task 4.3

Targets follow API contract v0.2: R2 checks the product name and R6 checks the
halal mark. Current branch rules still have v0.1 R2 and R1-R5 only. Do not
rewrite expected answers to fit that older implementation. Missing v0.2 rules
will give misleading verdict scores even if extraction is correct. The fixed
fixture date is 2026-10-30; the unchanged active flour certificate expires on
2026-11-30, so normal flour deliveries are expiring, not covered.

No model inference, live accuracy, timings or repeatability results have been
collected for this set. Human image/ground-truth approval remains pending;
approving the initial editing style does not approve all 24 final cases.

## Review and run

Open review.html locally to inspect each image and its expected fields.
Check spelling, readability, absent versus hidden marks, and absence of
duplicate text revealing hidden fields. Obtain Member 1's verdict agreement.
Record human sign-off only after it actually occurs, before collecting model
predictions. Do not adjust ground truth to match predictions.

After the R2/R6 changes merge, collect three live runs with distinct output
paths from the repository root (PowerShell):

```powershell
$env:PYTHONPATH='src'
uv run --env-file .env python tests/eval/collect_predictions.py --expected tests/eval/finals/expected_results.json --output tests/eval/finals/results/run-1-predictions.json
uv run python tests/eval/run_eval.py --expected tests/eval/finals/expected_results.json --predictions tests/eval/finals/results/run-1-predictions.json --output tests/eval/finals/results/run-1-report.json
```

Repeat for run-2 and run-3. The collector disables the demo cache. Report
extraction, verdicts, null abstention, failed requests and per-case verdict
consistency separately. The collector tests extraction plus offline rules,
not the full delivery API or supervisor workflow, and it does not provide
per-check timing measurements. Keep the original eight-image results separate
from finals results and include dataset IDs/denominators in the report.

## Asset preparation validation

On 30 October 2026, the dataset integrity tests and existing evaluation
runner/collector/seed-scope tests passed: 51 tests. Both current collector
and scorer accept the 24-case input. Shared field validation, PNG CRCs, image
hashes/dimensions, source grouping, category counts and preservation of the
pre-generation target plan were checked. This verifies asset packaging and
tool compatibility, not label-reading accuracy or v0.2 rule correctness.
