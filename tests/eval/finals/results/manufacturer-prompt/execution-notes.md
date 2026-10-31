# Manufacturer-prompt evaluation execution record

Branch: test/rerun-eval. Code revision: 7b7014ba661709c168d061d917ca1fa6c17b9cdb.
The team ran three live passes on this branch. The extraction prompt
now explicitly excludes customer / Supplied to names from manufacturer.
Existing pack-size normalization in R2/R3 remains in place. No prompt, rule,
expected-answer or image edits were made during collection. Existing baseline
results and untracked plan-docs drafts were left untouched.

105 extraction/rule/evaluation regression tests passed. Preflight confirmed
all 24 expected verdicts match production rules. Expected, image/code and raw
prediction hashes were verified. Exact working-code hashes and UTC run times
are saved with the raw predictions. The expected input is unchanged from HEAD.

One uncached historical L01 warm-up timed out at the 180-second request limit.
Health then reported a ready worker, and a second uncached L01 warm-up
succeeded in 3.579 seconds. Both are excluded from scored requests and latency. No worker
scaling settings were changed. The 72 scored attempts are three sequential
passes of 24 cases, cache disabled, temperature 0, with no automatic retries.

Scored request errors: 0/72.
Median extraction was 3.141 s, and nearest-rank p95 was 3.496 s.
Extraction includes preprocessing, client setup, network, queue wait, inference
and validation. Offline rule time is recorded separately. This does not measure
the full application workflow or initial delivery status.

All three runs matched 24/24 expected verdicts, all normalized visible fields
and all null targets. Both literal extraction and verdict repeatability were
100%. Literal text exact-match was 204/210 (97.14%); case/whitespace-normalized
text match was 210/210. L11 no longer includes quantity in its product field,
and L32 returns null for the hidden manufacturer. There were no normalized
field mismatches. See raw predictions for the remaining literal differences.
Present-mark accuracy covers present targets only. Null-target accuracy
includes both absent marks and hidden fields. Initial status is not evaluated.

This is development/regression evidence on 24 correlated synthetic cases,
not 72 independent photos or real-world accuracy evidence. Targets were
previously revised after seeing an earlier experiment. Preparation-era approval
flags in the committed input remain unchanged. Baseline and current
rules/prompts both differ, so aggregate improvement versus the old baseline
is not attributed solely to a prompt change.
The manufacturer sentence in the prompt (commit 5e38c06) was written after L32
failed in the earlier run, so L32 passing here isn't evidence that the prompt
works on labels it wasn't written for.
