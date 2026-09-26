# Sprout

A local, parent-supervised counting prototype. The live tutor handles conversation;
application code owns scene changes and stopping. The longer-term goal is to adapt
lessons from **parent-reviewed evidence**, not to turn live model judgments into
learning facts. Start with the [MVP documentation](docs/README.md).

## Try it

Use Node 24 (`nvm use` if you use nvm) and npm:

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:3000/demo> for a **developer preview without credentials**.
Click Start, try the numbered answers, wait for a scene change, and End lesson.
This uses the real lesson controller and renderer with a synthetic transport and
literal-number evaluator. It does not request a microphone, generate speech, call
providers, or measure learning. Preview exports are marked `synthetic_demo`.

To exercise the separate parent-review/memory contract with synthetic evidence:

```bash
npm run demo:memory
```

It demonstrates pending-review blocking, a corrected supported response, rejection
of an unsupported counting claim, and the exact evidence supplied to a planner.
It does not generate tomorrow's lesson or save a learner profile.

## Run a live lesson

```bash
cp .env.example .env.local
# Set OPENAI_API_KEY and TYPESAFE_API_KEY in .env.local, then restart:
npm run dev
```

Open <http://127.0.0.1:3000>. The configured OpenAI account must have access to the
model/endpoint used in `lib/lesson.ts` and `app/api/live/route.ts`; a key alone is
not a guarantee of access. The Jev model is pinned in `lib/answer.ts` because its
threshold was calibrated against that version. Provider calls may incur usage
charges. Credentials stay on the server; do not prefix them with `NEXT_PUBLIC_`.

Keep the tab visible, allow microphone and playback, and supervise the lesson.
Parent stop releases media immediately. Hiding the tab ends the attempt. The
current lesson wraps at 4:30, requests goodbye at 5:00, ends at about 5:08, and has
an application-enforced six-minute hard limit. Issue #14's longer-duration
experiment is future work, not the current behavior.

After stopping, expand **Parent testing notes** and download diagnostics before
starting again or reloading. Exports include attempt IDs, previous-attempt linkage,
mode, transcript timing, scene events and a truncation count. They are **not** a
full-session recording or an authoritative learning record. Input speaker identity
and output playback remain unverified. Treat live transcripts as private; do not
commit them or attach them to public issues.

## Convex persistence foundation

The session-record schema and functions live in `convex/`. For local MVP development, run
`npm run convex:dev` in a second terminal and select a local deployment when prompted.
The Convex CLI writes the deployment URL to an ignored local environment file and regenerates
`convex/_generated/`. The CLI-generated bindings are committed so tests and typecheck work
without a running deployment. The live lesson records lifecycle, displayed scenes, and child utterances
through Convex. Configure `NEXT_PUBLIC_CONVEX_URL` for the browser recorder; recording failures are
shown while the lesson continues. Full-session audio, generated-versus-delivered conversation timelines, inspection and retry linkage are implemented. Playback attribution remains approximate; support interpretation and parent-reviewed learning observations remain future work.

For development-only Jev diagnostics, open <http://127.0.0.1:3000/?debug=1>.

## Current scope

| Available | Still planned |
| --- | --- |
| Bounded voice lesson, quantities 1–5; durable session/audio records (#4) | Observer integration with those records (#5) |
| App-owned scene commits, stop/failure cleanup | Observer and parent-review UI (#5) |
| Synthetic preview and executable review contract | Evidence-based next lesson and rationale (#6) |
| Unit/browser regression suites and CI | Seven-day history and experiment workflow (#7) |

The memory contract is an implementation foundation and test fixture, **not a
memory feature in the live lesson**. See [the boundary and integration plan](docs/reviewed-memory.md).

## Verify changes

```bash
npm run check                         # lint, types, unit tests, synthetic memory example
npm run build
npx playwright install chromium      # once per machine
npm run test:browser                  # mocked providers + synthetic Chromium microphone
```

On a fresh Linux CI image use `npx playwright install --with-deps chromium`.
Normal CI has no provider credentials. Live calibration/latency scripts are
separate, opt-in experiments; see [testing strategy](docs/testing.md).

## Troubleshooting

- **503 / missing key:** fill `.env.local` and restart. `/demo` needs neither key.
- **502 / authorization:** check account model access; provider details are intentionally not exposed to the browser.
- **Microphone or sound blocked:** allow access/playback for the loopback page, stop, then start a new attempt.
- **Scene stays put:** uncertain or unavailable evaluation leaves the scene unchanged. This is not a recorded wrong answer.
- **Tab switching ends play:** intentional media cleanup; keep the lesson visible.
- **Recording unavailable:** check the local Convex deployment and `NEXT_PUBLIC_CONVEX_URL`. The developer preview intentionally never persists data; adaptive learning remains future work (#5–#7).

This prototype binds to loopback and has no user accounts. The local-request check
is not authentication. Public/multi-family hosting requires a separate deployment
and access-control design; the default starter's public-deploy guidance does not
apply.

For session reliability metrics, bounded live checks and the seven-day product decision,
see [measurement](docs/measurement.md). The [framework comparison](docs/evaluation-frameworks.md)
explains why this contribution extends the existing test stack.

## Live lesson regression testing

See [Reactive simulated-child E2E](scripts/live/REACTIVE.md) for requirements,
scenarios, artifacts and measurement limits. With the local app configured and
running, `npm run test:live:reactive happy-path` runs one scenario;
`npm run test:live:reactive` runs all ten sequentially. These use billed real
GPT-Live/Jev services and supplement deterministic unit/browser tests.
The legacy fixed-timeline command remains `npm run test:live quick_answer`.
