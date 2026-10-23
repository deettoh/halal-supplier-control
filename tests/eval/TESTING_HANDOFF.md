# Label dataset handoff for Member 1

Published for extractor/integration testing on 23 October 2026. Nigel reports that the label review has been completed and requests this PR for Member 1 to test. No correction list or named final dataset approver was supplied with that update. The reviewed packet revision 2 **original PNGs and expected-results JSON remain byte-identical**; this PR adds a testing handoff and review receipt without silently changing those inputs.

## Files to use

- `images/L01.png` through `L08.png`: the eight original synthetic package photographs. Send only these image bytes to the extractor.
- `expected_results.json`: visible/null image answers and independent material/certificate fixtures. Image paths in JSON are relative to repository root. The fixed evaluation date is **2026-10-21**; do not replace it with the machine's current date.
- `LABEL_REVIEW.html`: open locally for photo/answer inspection. This page reveals answers; do not use it as model input or as a timed participant's page.
- `review_status.json`: user-reported review receipt and hashes identifying the reviewed inputs. It does not invent a reviewer identity or a live model result.
- `generation_prompts.json` and `../../docs/member2/DATASET_DECLARATION_DRAFT.md`: actual synthetic-image provenance and limitations.
- `run_eval.py` and `RUNNER_GUIDE.md`: the previously merged scorer and saved-prediction format.

The source packet pins its fixture provenance to **8cc3b9f**. This publication was checked against merged main **f334648** (backend-services PR #66), with the same seed JSON, shared four-field extraction model and production rules. The older pending-dependency text inside the frozen expected JSON records the packet's preparation state. `review_status.json` and this handoff record the later review/publication update. The legacy `member_5_approval` flag remains pending because an explicit named final approval was not supplied; this does not prevent Member 1 from testing. Do not request the already completed asset review again merely because of that legacy flag.

## Check out and verify

In a clean development checkout, after committing or preserving your own work:

```powershell
git fetch origin
git switch --track origin/codex/member2-evaluation-labels
uv sync --locked
uv run pytest -q
```

If the local branch already exists, switch to it and fast-forward from its upstream rather than creating it again. Use your normal local environment configuration; no credentials are included in this dataset.

## Collect actual predictions

1. Read each original PNG with the current shared extractor. Main now converts PNG/JPEG inputs into upright JPEG bytes before the request. Preserve the original SHA-256 and record transformed-byte hash, prompt/model/settings and request outcome for the run.
2. For a strict live attempt, use `extract_label(image_bytes, cache={})` with the current API. The empty cache prevents a failed request from being replaced by a prepared label. Keep timeout/schema/request failures in the results. Do not populate the production cache with expected answers and then report them as model accuracy.
3. Save the four actual returned fields under `extracted`. To check verdicts independently of the app, pass that **actual extraction** to `backend.rules.evaluate` with the case's `evaluation_fixture.material`, `.certificate` and `.today`. These are per-case copies; L06/L07 must not mutate shared seed records. Report this as extraction plus offline rules, not a verified full application workflow.
4. Only include `status` when it was observed from an actual backend response. The expected initial statuses are not predictions. Live database uploads also need a controlled fixture/date setup; the shared seed does not itself select the two deliberate certificate exceptions.
5. Use separate saved-prediction files for live, cache and stub modes. For example:

```json
{
  "mode": "live",
  "predictions": [
    {
      "case_id": "L01",
      "extracted": null,
      "error": "actual safe failure message, if this attempt failed"
    }
  ]
}
```

This shape illustrates a failed attempt, not a collected prediction. Replace it with the actual result and add a row for every attempted case. Never copy expected extractions into a file labelled live.

Once actual outputs are saved:

```powershell
uv run python tests/eval/run_eval.py --expected tests/eval/expected_results.json --predictions tmp/member1-live-predictions.json --output tmp/member1-live-report.json
```

The scorer does not call RunPod or establish the origin of saved outputs. Its `live_inference_verified` remains false; final approval/reporting flags must reflect actual evidence. Missing predictions stay visible, and absent verdict/status observations are unavailable rather than invented.

## Scope and results

No RunPod calls, measured accuracy, manual timings, frontend implementation, shared-seed edits or cache changes are included in this PR. Manual participant/facilitator materials remain separate local preparation. The eight images are synthetic, mostly clear and English-only; they do not establish production accuracy. Output concerns document coverage only, never a religious ruling or certificate authenticity.
