# Saved-prediction evaluation runner

Implemented 22 October 2026 against merged schema PR #56 at `bf22bce`. This first runner scores JSON files already saved by a caller. It **does not read images, load `env`, call RunPod, run coverage rules or measure time**. The final dataset/seed agreement with Member 5 remains pending.

## Run it

Use the project's locked environment (`uv sync --locked`, as documented in the team setup). In PowerShell at the repo root:

```powershell
.\.venv\Scripts\python.exe tests/eval/run_eval.py --expected PATH_TO_EXPECTED.json --predictions PATH_TO_SAVED_PREDICTIONS.json --output tmp/eval-report.json
```

Replace both input paths with your actual JSON files. The examples below let a reviewer exercise the script without the separate case proposal. Save them under `tmp/expected.json` and `tmp/predictions.json`, then use those paths in the command. Create `tmp/` first if needed. The eight-case dataset/seed proposal remains a separate draft; it is not included in this scorer change. Example or draft scores are wiring/review results, never model-quality results.

Exit code 0 means the report was written, even if predictions were wrong. Exit code 2 means invalid/unreadable input or an unwritable output. The output cannot overwrite either input. Reports use UTF-8 JSON and include hashes of both input files.

## Expected-results input

The runner deliberately consumes the existing review layout, without renaming it into an unagreed final format:

- Top-level `cases` is a nonempty array; each `case_id` is unique.
- `proposed_expected_extraction` contains all four shared keys: `product_name`, `brand`, `manufacturer`, `halal_mark_present`. Nullable values are allowed; wrong types and extra keys are rejected.
- `proposed_expected_verdict` and `proposed_expected_initial_status` may be absent/null when those expectations are not available. Provided values must match the shared enums.
- `member_5_approval` stays `pending` until the dataset is actually agreed. The output approval flag reflects this input declaration; the runner cannot establish teammate agreement.

Minimal expected-results example for exercising the CLI, not approved ground truth:

```json
{
  "member_5_approval": "pending",
  "cases": [
    {
      "case_id": "L01",
      "proposed_expected_extraction": {
        "product_name": "DEMO FLOUR",
        "brand": "SAMPLE BRAND A",
        "manufacturer": "SAMPLE MAKER A",
        "halal_mark_present": true
      },
      "proposed_expected_verdict": "covered",
      "proposed_expected_initial_status": "auto_accepted"
    }
  ]
}
```

Confirm the final expected-results format with Member 5 before collecting the final dataset. Adapt this input boundary explicitly if the agreed format changes.

## Saved-prediction input

Example shape only; the values below are fictional illustrations, not an observed extraction or verdict:

```json
{
  "mode": "stub",
  "predictions": [
    {
      "case_id": "L01",
      "extracted": {
        "product_name": "DEMO FLOUR",
        "brand": "SAMPLE BRAND A",
        "manufacturer": "SAMPLE MAKER A",
        "halal_mark_present": true
      },
      "verdict": "covered",
      "status": "auto_accepted",
      "error": null
    }
  ]
}
```

- Mode must be `stub`, `cache` or `live`. Use a separate file/report for each mode. Optional row-level modes must agree with the file mode.
- `extracted` is the recorded shared-model object, or null on failure. Nonempty `error` text is counted as an upstream failure; it invalidates extraction credit even if a stale object is present. Raw error text is not copied into the report.
- Verdict/status are optional. Without them, verdict/status accuracy is **unavailable**, rather than simulated by duplicating Member 5's rules.
- Duplicate/unknown case IDs and mixed modes reject the input. Missing prediction records remain explicit failures/opportunities in the field/schema scoring population.
- Only a verified live collection can support a live model claim. A file declaring `live` is not proof; every report says `source: saved_predictions` and `live_inference_verified: false`.

## Scores and failure treatment

The report includes correct/total/percent for schema success, normalized four-field accuracy, literal and normalized text accuracy, mark observation, each individual field, whole readable text labels, null abstention, and available verdict/initial-status outcomes.

Text normalization is Unicode NFC, case folding and whitespace trimming/collapse. Punctuation, digits and company suffixes remain significant. Fuzzy matching is not used. The generic mark is an observation, not certificate authenticity or a religious ruling.

Expected nulls are excluded from visible-field accuracy. Valid explicit nulls earn abstention credit; non-null guesses are counted separately. Missing keys, wrong types, absent predictions and upstream errors earn no extraction/abstention credit. Strict shared-model validation prevents coercing a string such as `"true"` into a successful boolean prediction.

A denominator of zero has percent null. Outcomes with no supplied verdict/status observations have correct/total/percent null. Once at least one corresponding outcome is supplied, missing/invalid outcomes remain failures across all cases with that expected outcome. Per-case results show these issues.

Reports contain comparison flags and issue codes, rather than copied raw field/error text or arbitrary input metadata. Keep the original predictions separately for error analysis, with model/prompt/seed/image provenance. The report hashes identify the exact inputs; it does not verify their origin or turn a small synthetic set into production evidence.

## Checks and remaining integration

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check src tests
.\.venv\Scripts\python.exe -m ruff format --check src tests
.\.venv\Scripts\python.exe -m mypy src/backend tests
```

The CLI regression tests use temporary JSON fixtures and no model connection. The team's real endpoint test remains opt-in via `--run-live`; it is skipped in the normal suite. No approved dataset, model benchmark or time-saving measurement was created by these tests.

Next: obtain Member 5's approved cases/rule fixtures, create and inspect the final fictional images, collect actual predictions using the shared extractor and production rules, then score those records and perform the separate timing procedure. Business routes still return 501 in the merged contract scaffold; this runner does not change them. The root README stays deferred.
