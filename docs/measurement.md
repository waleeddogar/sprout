# Measuring whether Sprout is worth another session

The immediate product question is whether a parent can get through a session,
trust the evidence, and use it to make the next session better. Faster evaluator
calls are useful only if the lesson remains patient and accurate.

## What this PR makes measurable

Export **Download attempt diagnostics** after a session has ended, then run:

```sh
npm run report:sessions -- test-results/day-1.json test-results/day-2.json --out test-results/session-report.json
```

The command runs locally. Its output contains aggregate counts and timings, not
transcripts, notes, child identifiers or attempt IDs. Keep raw exports private.
Do not mix mocked provider runs with real runs: a mocked browser test exercises
the live controller and can still have `mode: live`. The report knows the recorded
mode, model and prompt; it cannot authenticate how the recording was produced.

| Signal | Calculation | Decision it supports |
| --- | --- | --- |
| Startup success | Ended, complete exports with `lesson.started` / ended, complete exports | Find setup failures before interpreting non-participation |
| Confirmed finalization | Ended exports with `connection.finalized` / ended exports | Investigate sessions whose provider shutdown was not confirmed |
| Evaluator unavailable | Non-stale `UNAVAILABLE` decisions / all non-stale resolved decisions | Identify reliability problems before adjusting answer thresholds |
| Evaluator latency | Recorded `latency_ms`, p50/p95 and sample count | Check provider response time independently of the controller's waiting policy |
| Turn end to display | Recorded `advance.displayed.turn_end_to_display_ms` | Detect slow visual advancement; this covers advances only |
| Recording failures | Attempts with an observed `recording.failed` | Find sessions that need evidence repair before Observer review |

Rates exclude truncated and legacy exports whose completeness is unknown.
Unfinished snapshots are reported separately and do not count as failed startups.
Repeated attempt IDs are deduplicated; conflicting snapshots fail with a request
to select one. Evaluation identity includes scene and answer version. Stale
results are excluded from availability/latency and counted separately. Percentiles
use nearest rank, with sample counts; p95 from a few turns is not an SLA estimate.

Missing data is `null`, never a zero-cost or zero-latency claim. Generated text is
not evidence of audible playback. Cost needs metered usage and dated prices;
learning and parent repair time need observations this diagnostic does not record.
Confirmed finalization is a provider event, not an invoice audit. Recording failure
counts are observed failures, not proof that every other recording is complete.

## The seven-day decision

Use the existing [experiment protocol](experiment-protocol.md). Alongside the
technical report, record one row per day (keep retries under that same day):

| Field | Record |
| --- | --- |
| Participation | Willing / declined / unavailable; distinguish technical failure |
| Planned adaptation | Reviewed evidence reference, actual change in challenge or support |
| Delivered adaptation | What actually happened; parent judgment of usefulness |
| Parent effort | Minutes reviewing/repairing, plus verified/light/substantial repair |
| Confounds | Prompt, model or code changes; interruption or unusual support |

The product outcomes are willing return, useful delivered adaptations, and parent
repair burden. This PR provides technical denominators and a review contract; it
does **not** yet collect these parent judgments or implement the adaptive planner.
No numeric success threshold is invented here: the parent/builder should choose
one before the experiment, then report the counts even when the result disappoints.
Do not call a shorter session an improvement without knowing why it ended.

## Bounded live smoke test

On a Mac with `say`, `ffmpeg`, Playwright Chromium and the live app configured:

```sh
npm run test:live -- quick_answer --dry-run
npm run test:live -- quick_answer --max-seconds 80
```

The default is now one 50-second scenario, not the whole matrix. Planning reserves
another 30 seconds per run for startup/cleanup, rejects plans over the explicit
limit, and executes sequentially. This limits planned workload, **not provider
billing**: network/cleanup overhead and provider shutdown can differ. Failures
stop subsequent runs and produce a nonzero exit. A scene must appear within 20
seconds; opening the page alone does not count as a started lesson.

Each run writes its diagnostic export, aggregate report and existing timeline.
`run-plan.json` records the revision, timestamp, scenario plan and base URL. Use a
fresh `LIVE_OUT` directory per experiment to retain earlier results. Review failure
artifacts as well as successful runs. For behavior regression, prefer Dave's [reactive harness](../scripts/live/REACTIVE.md),
merged in #32: `npm run test:live:reactive happy-path`. It now receives the same
aggregate report automatically. The `--max-seconds` option above applies only to
the legacy fixed-timeline command. Neither harness validates preschool speech.

See [framework choices](evaluation-frameworks.md) and [local evidence](pr-33-validation.md).
