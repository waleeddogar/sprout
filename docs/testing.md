# Testing strategy

Tests should establish application invariants before spending money on a model
experiment. They cannot establish teaching quality or a child's learning outcome.

## Layers and commands

| Layer | Command | What it establishes | What it cannot establish |
| --- | --- | --- | --- |
| Static | `npm run lint`, `npm run typecheck` | Type and source integration | Runtime behavior |
| Unit/contract | `npm test` | Deterministic timing, gates, provider parsing, immutable reviewed evidence | Real WebRTC/provider quality |
| Reproducible example | `npm run demo:memory` | Review → planner-input contract with inspectable synthetic output | Durable persistence or adaptive teaching |
| Browser | `npm run test:browser` | UI, display-before-instruction, cleanup, exports, no-key preview | Speech comprehension, actual provider playback |
| Build | `npm run build` | Production compilation and route generation | Successful live model access |
| Adult synthetic live experiment | `npm run test:jev`, `npm run benchmark:jev`, `npm run test:live` | Behavior and latency of the configured providers on controlled inputs | Validation on children's speech or longitudinal learning |
| Supervised experiment | [Protocol](experiment-protocol.md) | Participation, repair burden and delivered evidence-based adaptation | Population-level efficacy from one child |

`npm run check` combines the first three layers. GitHub Actions additionally builds
and runs browser tests without API secrets. Failures retain only synthetic browser
artifacts for seven days. A green CI run must never be presented as a successful
live voice test. The browser suite starts its own server with empty provider keys
and a fixed Convex fixture URL intercepted by the tests; it never reuses a live
local server.

## Regression priorities

- Thinking pauses, fragmented transcripts and self-correction must not become
  premature praise, correction, or stale scene advancement.
- An old evaluation cannot advance a new scene or mutate an ended attempt.
- A scene is acknowledged only after display; a generated transcript is not proof
  the child heard it. A literal spoken total is not proof of object-by-object counting.
- Parent stop, hidden page, connection failure, permission delay and hard timeout
  release microphone/playback. Late terminal events cannot rewrite closed diagnostics.
- Exports are isolated snapshots, identify their attempt/mode, and disclose lost
  diagnostic events instead of implying completeness.
- A failed Observer run is not an empty successful review. Pending, rejected and
  cross-learner observations cannot reach a planner. A failed/unfinished retry
  blocks planning; corrections preserve original proposals and source links.
- The preview must remain usable with both provider routes blocked and microphone
  access forbidden. Never silently fall back from live to synthetic mode.

Use fake timers for controller races; send provider-shaped events through the
parser where possible. Add a regression reproducing the failure before changing
a timing constant. Test the behavioral boundary, not just a helper's return type.

## Live checks (opt-in, may cost money)

Start the live app with `.env.local` configured before `test:jev` or `test:live`.
These scripts use `BASE_URL` (default `http://127.0.0.1:3000`). The live matrix needs
Playwright and `say`/`ffmpeg` as described in its script; it was authored for a Mac.
The latency script additionally needs `TYPESAFE_API_KEY` in the shell environment
(it does not load `.env.local` itself). Read the script before running it.

Record commit, browser/device, provider/model, prompt version, input fixture,
measured latency, failure and output location. Keep provider credentials and real
child recordings/transcripts out of source control and CI artifacts. Existing
live scripts write under ignored `test-results/`; Playwright uses its own subfolder
so running the browser suite does not erase live experiment evidence.

Provider upgrades require re-running the labeled calibration and correction/pause
matrix before changing `ADVANCE_THRESHOLD`. Do not reuse the same cases both to
choose a threshold and to claim independent evaluation of it.

## Gates for existing and next slices

- **#4 (merged):** preserve regression coverage for durable append/replay, duplicate events, crash before finalization,
  partial audio, upload failure, retry linkage and export/re-import in Convex.
  Bounded diagnostic JSON is not a substitute for this suite.
- **#5:** use the pure review tests as contracts for persistence and parent UI.
  Add authorization, concurrent review/Observer retry, empty review and failure
  recovery tests against the actual adapter.
- **#6:** test bounded three-part plans, source references, support-aware change,
  no-evidence calibration and explicit causal rationale. Verify the planned change
  was delivered before counting it as a useful adaptation.
- **#7:** run the seeded full seven-day flow, including partial/retry, rejection,
  correction, substantial repair and a cosmetic-only non-adaptation. Do not count
  retries as additional successful experiment days.
- **#19 / #16:** instrument model usage and outcome context before comparing new
  domains. Keep observed usage separate from versioned price assumptions.

New domain/interaction experiments (#16/#26) should earn abstractions from real
use. Do not replace the current controller with a general agent framework merely
to make the test harness more generic.

Issue #30 tracks reactive synthetic-speech testing through the real microphone and
live provider path. The no-key demo and mocked CI suite do not implement or replace
that billed experiment. Issue #29 tracks long-term memory architecture; the review
contract adds evidence gates without selecting a graph database or memory vendor.
