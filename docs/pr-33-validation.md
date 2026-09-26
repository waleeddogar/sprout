# PR 33 local validation

Validated on 2026-09-26 against upstream `707c821` (including #32). The tested
implementation has source tree `6ca2986b5ba44ac803f374742029b63a96e03b5f`,
published in commit `c57000680a2c6c992e1a4d6a63eb8bd3c333455b`. This evidence
document and aggregate JSON were added afterward. Results include upstream tests, not just new tests.

| Check | Result |
| --- | --- |
| `npm run check` | Lint, types, 367 unit tests and the memory example passed |
| `npm run build` | Passed, including `/demo` |
| Full Playwright suite | 16/16 passed, including the new upstream microphone/observer tests |
| Repeated demo UI flow | 5/5 passed: start, answer 1, answer 2, parent stop, download diagnostics |
| Report CLI against those five downloads | 5 complete attempts; 10 evaluated answers; 10 scene advances; no missing or duplicate attempts |
| Legacy live dry run | One 50-second scenario; 80 seconds reserved with startup/cleanup allowance |
| Over-budget dry run | Three default scenarios rejected before browser/provider activity; exit 1 |
| Paid providers / real child / deployed Convex | Not run: this workspace has no configured provider keys or Convex deployment |

## What the browser run actually measured

See the [machine-readable aggregate](evidence/pr33-demo-summary.json). Every input
has `mode: synthetic_demo`. The model/prompt strings identify the configured
controller; **no model was called**. Each run exercised the real lesson controller,
React scene display, stopping and diagnostic download with synthetic answer
buttons. Microphone access threw if requested; all `/api/**` requests were blocked
and the test asserted that none occurred.

- Startup and synthetic finalization were observed in 5/5 attempts.
- All 10 synthetic evaluations were available. Their recorded zero latency is a
  stub value, not a provider benchmark.
- Turn-end to displayed advance: p50 **2,517 ms**, p95 **2,520 ms**, n=10. This includes
  the existing 2,500 ms correction window. It does not justify shortening that
  window: allowing self-correction is intentional behavior.
- Audible response time, cost, learning outcome and parent repair time remain
  `null`. No live success rate, retention improvement or educational benefit was measured.

The earlier repeated batch was interrupted while reconciling upstream changes;
its partial output is excluded. The reported batch was rerun against the stable
implementation in a fresh directory. This is a small reproducibility check, not a
statistical latency study or a before/after performance claim.

## Reproduce

```sh
nvm use
npm ci
npm run check
npm run build
npx playwright install chromium
npm run test:browser
SPROUT_USAGE_OUT=test-results/demo-usage-final npm run test:browser -- tests/browser/demo.spec.ts --repeat-each 5 --workers 1
npm run report:sessions -- test-results/demo-usage-final/*.json --out test-results/demo-summary.json
npm run test:live -- quick_answer --dry-run
```

Use a fresh usage directory. Local environment: Linux, Node **24.19.0**, Chromium
**153.0.8010.0** from `@sparticuz/chromium@153.0.0`, installed outside the repository.
The standard browser download had returned an invalid archive in this workspace.
A temporary Playwright executable-path override selected that binary; the one
upstream test that launches Chromium itself used a local browser-cache link to
the same binary. Neither workaround is committed. CI uses the standard installer.

## Practical effect and remaining evidence

Before this change, the legacy command with no arguments scheduled all **20**
scenarios: **1,482 seconds** of scripted voice across concurrent sessions. It now
schedules **one 50-second** scenario sequentially, with explicit plan limits and a
dry run. Those are calculated workload totals, not observed savings on an invoice.
Dave's reactive command remains available and is the preferred behavior regression
path; both runners now write the same diagnostic summary.

The next missing evidence is a live `happy-path` run on a configured Mac, followed
by the correction/pause cases relevant to the change being evaluated. Record the
result even if it fails. For product value, follow the [seven-day measurement
plan](measurement.md#the-seven-day-decision): willing return, useful delivered
adaptation, and parent repair minutes. The reporting and review contract make
those investigations easier; they do not establish those outcomes themselves.
