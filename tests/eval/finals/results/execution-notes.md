# Revised-target evaluation execution notes

Commit ef451fd changes the L25-L28 mark targets from false to null and
restores L11 to Cocoa Powder without the quantity. The team then ran three
passes against those targets, with no other change to extraction targets,
fixtures or production rules. The committed expected-results file stays
byte-identical across the runs, and its pending approval fields are
preparation metadata. The offline scorer reads that pending flag and reports
dataset_approved=false, which predates the team's approval of the targets.
The team lead accepted the L25-L28 false-to-null change when approving PR #80.

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
commit, and code_sha256 identifies the exact collector used.

Extraction latency includes preprocessing, client setup, network, queue wait,
inference and validation. It excludes file reading and offline rule time.
It is not GPU-only time or the entire application/supervisor workflow.
Initial application status is not measured. Failed attempts retain duration
and count against verdict correctness. A case with failed attempts earns no
consistency credit.

Under this revision, mark_accuracy covers the 18 present-mark targets only.
The legacy unreadable_abstention metric covers eight null targets: four
absent marks, two hidden marks, one hidden product and one hidden manufacturer.
The Markdown summary labels it null_target_match. A higher score against the
revised targets must not be presented as an improvement to the unchanged model.

69 offline regression tests passed. Lint, formatting and strict type checking
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
model improvement, because only the evaluation convention changed. Any prompt
or parser improvements belong to a separately versioned experiment.
