# Timing procedure

The test set is all 32 cases, L01-L32, run three times, which gives 96 delivery checks across three rounds.

## 1. Fix the test conditions first

Set up each session with these conditions:

- Separately time the reviews those checks require, which are 66 planned reviews for the 22 review cases. Record any unavailable review caused by an incorrect automatic acceptance. Don't manufacture a replacement result.
- Use the deployed app in live mode and screen-record on the app phone. Keep the same phone, browser, network and participant where possible.
- Confirm the latest expected results, SME settings, test date and deployed version before testing. Check that Hold works before timing Hold reviews.
- Use an isolated demo/test database. The database owner must prepare L06 with an expired selected certificate and L07 with Cocoa Powder excluded from scope. Restore the normal certificate context before other cases. Fixture preparation is outside the timing.
- Complete one unmeasured practice/warm-up. Verify worker readiness from logs/state evidence, record worker state for each attempt and report confirmed cold or unverified attempts separately. Do not infer cold/warm state from duration alone.
- Use fresh camera photos.

## 2. Time each delivery check from the blank page

Before recording, log in as staff and clear the previous material, photo and result.

1. Start screen recording on the ready, blank Check a delivery page, before choosing the material. Begin immediately.
2. Find/select the material, capture the label, confirm the photo and submit.
3. Stop recording as soon as the actual Coverage result appears.
4. Record the verdict, displayed error line and whether the result matches the expected answer.

Delivery-check time is the full video duration in seconds. It includes selection, photography, submission and waiting, and excludes login and supervisor review.

## 3. Time each review from the first look at the evidence

Use the deliveries created above. An independent checker keeps the expected decision/rubric hidden from the reviewer until afterwards.

1. Log in as supervisor and prepare the assigned delivery's review details without beginning the review.
2. Start screen recording, then begin examining the evidence.
3. Examine the evidence, decide Accept/Reject/Hold, and enter the reason and required next step.
4. Stop recording as soon as the app confirms the decision was saved. Then verify the saved outcome.

Review time is the full video duration in seconds. Exclude waiting for people/suppliers. Time a later decision on a held delivery separately. Report reviews of extraction-failure records separately.

## 4. Report delivery and review times separately

Maintain separate delivery and review tables:

| Case/round | SME | Worker state | Full video duration (seconds) | Expected | Actual | Error line | Match? / video / notes |
|---|---|---|---|---|---|---|---|

Apply these reporting rules:

- The measured time is the full, unedited video length, including recording-control time. Follow the same recording start and stop procedure for every attempt.
- Retain slow, incorrect and failed attempts. Do not retry to replace an unfavourable result.
- A correct completed check requires the expected verdict and no extraction error. In particular, Needs review with a model error is not a successful match for L04/L05.
- The model timeout is 180 seconds, and a timeout may produce a saved Needs review result with an error. Record that failure. If no verdict appears, mark the attempt incomplete.
- Note photo-quality problems as possible mismatch causes. If logs show unexpected cached fallback, report it separately.
- Calculate each case's median, then the median across cases. Keep delivery and supervisor results separate, with completion, match and failure counts.
- Report the 32-case app median separately. Compare the historical 82 s only with the L01-L08 subset, using correct, error-free warm observations and only if all eight cases are represented. To calculate the reduction, use (82 − matched app median) ÷ 82 × 100%. Label it descriptive, since the manual baseline used one person, one laptop run and five rules, and this study uses fresh phone captures and six rules.
