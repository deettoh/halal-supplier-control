# Revised-target evaluation execution notes

The user revised L25-L28 mark targets from false to null in commit ef451fd,
restored L11 to Cocoa Powder (excluding quantity), and requested: "ok run the
evals. just like last time." This authorizes the three-pass rerun against
those corrected targets. No further extraction target, fixture or production
rule changes were made. The committed expected-results file is byte-identical
during this experiment; its pending approval fields are preparation metadata.
This execution record captures the subsequent user approval separately.
The offline scorer reads the historical pending flag and therefore reports
dataset_approved=false; that flag does not represent the later chat approval.
No independent Member 1 sign-off is claimed.

The four corrected targets were changed after the earlier experiment was
seen, so this is development/regression evidence using revised labels, not
an untouched holdout. The original planned JSON retains the earlier targets.
Dataset integrity tests permit only the four documented mark corrections.

Before live inference, all 24 revised expected extractions matched production
verdicts and first failing rules. All 24 verdicts, statuses and rule outcomes
are unchanged by the four null corrections. Original images and historical
eight-case results remain unchanged.

An uncached warm-up on historical L01 returned the expected fields after
156.852 seconds. A health request reported a ready worker while it waited.
The warm-up is excluded from the 72 scored attempts and their latency. No
RunPod worker scaling or production extraction settings were changed.

Three sequential passes use the same model, temperature 0, prompt and
production rules with cache disabled, no automatic retries, and a 180-second
request timeout. Per-case timestamps, image hashes, expected-input hash and
executed working-file hashes are retained. code_revision names the base
commit; code_sha256 identifies the exact uncommitted collector used.

Extraction latency includes preprocessing, client setup, network, queue wait,
inference and validation; it excludes file reading and offline rule time.
It is not GPU-only time or the entire application/supervisor workflow.
Initial application status is not measured. Failed attempts retain duration
and count against verdict correctness; matching failures earn no consistency.

Under this revision, mark_accuracy covers the 18 present-mark targets only.
The legacy unreadable_abstention metric covers eight null targets: four
absent marks, two hidden marks, one hidden product and one hidden manufacturer.
The Markdown summary labels it null_target_match. A higher score against the
revised targets must not be presented as an improvement to the unchanged model.

69 offline regression tests passed; lint, formatting and strict type checking
passed for the five changed Python files. Tests cover provenance, invalid
timings, failed-run denominators, unique runs, dataset integrity, rule
compatibility, precise timing and checkpoint/no-overwrite behavior.

## Findings

All 72 requests succeeded with valid extractions. Each run produced 22/24
correct verdicts (91.67%). Both four-field extraction and verdict agreement
across runs were 24/24 (100%), including consistently wrong outputs.
L11 included quantity in product_name, producing substitution instead of
covered. L32 read Sunrise Bakery as the hidden manufacturer, producing
substitution instead of needs_human. L25-L28 match the revised null targets.
Targets, prompt, images and production rules were fixed across all passes.

Use the summary for observed latency and complete score denominators.
Do not compare revised-target percentages to the old-target percentages as
model improvement; only the evaluation convention changed. Any prompt or
parser improvements belong to a separately versioned experiment.
