# Label evaluation

Eight synthetic label photos with expected answers, the scripts that collect
live model predictions and score them, and the results of the live run.

## The live run got every verdict right

The run on 23 October 2026 sent the eight original photos to the RunPod
endpoint with these settings:

- Model `qwen/qwen3-vl-8b-instruct`, temperature 0, extraction prompt SHA-256
  `8becf1b0…7f68f75` (full hash in
  [`results/live-predictions.json`](results/live-predictions.json)).
- Demo cache disabled, so every reading came from the model.
- Rules evaluated against each case's certificate copy on the fixed date
  2026-10-21.

| Metric | Correct | Total | Percent |
|---|---|---|---|
| Valid JSON in the shared schema | 8 | 8 | 100 |
| Visible label fields read correctly | 27 | 27 | 100 |
| Halal mark observed correctly | 7 | 7 | 100 |
| Whole readable labels read correctly | 6 | 6 | 100 |
| Hidden fields left blank (null) | 4 | 5 | 80 |
| Verdicts matching the expected verdict | 8 | 8 | 100 |

The miss was on L04, where the halal mark is covered: the model answered
`false` instead of `null`. The verdict was still `needs_human` (Reading
incomplete), because the other fields were blank and rule R1 failed. The full
report is [`results/live-report.json`](results/live-report.json).

These numbers come from eight AI-generated photos and don't establish
accuracy on camera photos of delivered goods.

## A check by hand took a median of 82 seconds

On 24 October 2026 one team member checked each case once, in order,
against the Sunrise Bakery SAMPLE masterlist and the supplier
certificates, with the five rules written out. Each timing starts at
opening the label photo and stops at writing the verdict.

| Case | L01 | L02 | L03 | L04 | L05 | L06 | L07 | L08 |
|---|---|---|---|---|---|---|---|---|
| Seconds | 112 | 66 | 65 | 59 | 59 | 102 | 98 | 105 |

The median was 82 seconds. Cases decided without the certificate (L02 to L05)
took 59 to 66 seconds, and cases that needed the certificate took 98 to 112.

## Eight synthetic photos with checked answers

`synthetic-labels-2026-10-22-v1` is eight 1254 x 1254 PNG photos in
[`images/`](images/), with their SHA-256 hashes and expected answers in
[`expected_results.json`](expected_results.json).

- Each photo is the unedited output of one call to OpenAI's built-in
  image_gen tool. The prompts are in
  [`generation_prompts.json`](generation_prompts.json).
- The products, brands, suppliers and certificates are fictional records
  from the demo seed. Every package says SAMPLE - FICTIONAL DEMO, and the
  generic HALAL / SAMPLE stamp isn't an official certification logo.
- Codex checked the expected answers against each photo, and a team member
  reported the review complete on 23 October 2026. The approval fields in
  `expected_results.json` still read `pending`, since nobody recorded a
  formal sign-off. A hidden field has the expected value `null`.
- [`.gitattributes`](../../.gitattributes) keeps the photos and the expected
  answers byte-identical on every checkout, since the collector records each
  photo's hash and the scorer records the hash of the expected answers.

The set is small, mostly clear and English only. It has two occluded cases
and no case with a clearly absent halal mark.

## What each case tests

L01 to L07 use Cocoa Powder (material 6) from Silver Valley Ingredients
SAMPLE and certificate 3. L08 uses Wheat Flour (material 1) and certificate 1. All cases
belong to Sunrise Bakery SAMPLE. The expiry and scope failures in L06 and L07
come from evaluation-only copies of certificate 3, so the shared seed is
unchanged.

| Case | Photo or registry condition | Expected verdict | Expected initial status |
|---|---|---|---|
| L01 | Clear label: Cocoa Powder, SilverCocoa, Silver Valley Foods | covered | auto_accepted |
| L02 | Brand ALT SAMPLE BRAND, approved brand SilverCocoa | substitution | pending_review |
| L03 | Manufacturer ALT SAMPLE MAKER, approved maker Silver Valley Foods | substitution | pending_review |
| L04 | Product, brand, manufacturer and mark all covered | needs_human | pending_review |
| L05 | Manufacturer covered, everything else readable | needs_human | pending_review |
| L06 | Clear label, certificate copy expired on 2026-10-20 | not_covered | pending_review |
| L07 | Clear label, certificate copy excludes Cocoa Powder | not_covered | pending_review |
| L08 | Clear Wheat Flour label, certificate 1 expires on 2026-11-30 | expiring | auto_accepted |

## Collect and score predictions

To collect live predictions, set `RUNPOD_ENDPOINT_URL` and `RUNPOD_API_KEY`
in `.env` and run from the repo root:

```bash
# PYTHONPATH=src because only pytest adds src to the import path
PYTHONPATH=src uv run --env-file .env python tests/eval/collect_predictions.py \
  --output tests/eval/results/live-predictions.json
```

The collector reads each original photo through `backend.extract` with the
demo cache disabled and runs the production rules against the case's
certificate copy and date. It records the model, the temperature, the prompt
hash and each photo's hash. A failed request is saved with an error and no
verdict, so it scores as a failure.

To score saved predictions:

```bash
uv run python tests/eval/run_eval.py \
  --expected tests/eval/expected_results.json \
  --predictions tests/eval/results/live-predictions.json \
  --output tests/eval/results/live-report.json
```

Exit code 0 means the report was written, even with wrong predictions, and 2
means an input was invalid or unreadable or the output couldn't be written.

## How the scorer counts

- A predictions file declares one mode: `stub`, `cache` or `live`. The report
  records the SHA-256 of both inputs and `source: saved_predictions`. It sets
  `live_inference_verified: false` because the scorer can't confirm how the
  predictions were made.
- Text fields are compared after Unicode NFC, case folding and whitespace
  collapsing. Punctuation, digits and company suffixes still count, and no
  fuzzy matching is used.
- Field accuracy covers visible fields only. A field with expected value
  `null` earns abstention credit for a `null` answer and counts as a guess for
  anything else.
- Missing predictions, wrong types and request errors earn no credit.
- Verdict accuracy is reported only when the predictions include verdicts. A
  zero denominator gives a percent of `null`.

The tests in `tests/test_eval_runner.py` and
`tests/test_collect_predictions.py` use temporary fixtures and make no model
calls. The live endpoint test is opt-in with
`uv run --env-file .env pytest -m live --run-live`.
