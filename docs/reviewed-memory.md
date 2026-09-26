# Reviewed memory: executable boundary and integration plan

## What is implemented

`lib/reviewed-memory.ts` is a small, provider/storage-independent domain boundary
for #5/#6. `scripts/memory-demo.mjs` exercises it with synthetic data. The live
lesson does not yet call it. #4's durable session records are now implemented;
an Observer adapter must validate source references against those records.

The separate `/demo` route exercises the existing controller and renderer without
providers. It is a developer preview of scene control, not a simulation of tutor
quality or the memory loop. Both examples are explicitly synthetic.

## Boundaries

| Component | Owns | Must not do |
| --- | --- | --- |
| BrowserTransport / DemoTransport | Deliver normalized events and manage resources | Approve durable learning claims |
| LessonSession | Timing, answer gate, bounded scene commits, stopping | Treat Jev probability as learning evidence |
| Session repository (#4) | Canonical delivered events, recording, stable source IDs, finalization | Promote generated/unplayed speech to delivered evidence |
| Future Observer (#5) | Propose concrete observations from finalized sources | Review its own proposals |
| EvidenceReview | Validate source links/scope; retain proposals; record parent decisions and repair | Authenticate a parent or persist data by itself |
| preparePlannerInput | Gate all supplied attempts; snapshot only accepted/corrected evidence | Retrieve unreviewed proposals or infer mastery |
| Future planner (#6) | Bounded pedagogical intent and causal rationale | Script every utterance or expand the learning scope |

These are responsibilities, not a request to introduce seven services. Keep them
in the same application until a concrete operational need justifies separation.
The existing `Transport` and `EvaluateAnswer` interfaces already provide useful
seams. Keep provider SDKs, Convex and React out of the pure review module.

## Contract behavior

1. Start from a finalized session with an explicit learner/session identity and
   timestamped exchange IDs that cite displayed scenes. Both complete and partial
   attempts can provide evidence; completeness is decided upstream.
2. Pending/running/failed analysis blocks review completion and planning. A failed
   analysis may retry. A successfully committed proposal batch can be replayed
   exactly, but a different batch cannot overwrite it.
3. Proposals must reference exchanges in that session, remain in quantities 1–5,
   and preserve description, support and uncertainty. Quantity identification and
   counting aloud have distinct types; neither implies mastery.
4. Record accept, correction, or rejection. Original proposals stay intact.
   Repeating an identical decision is idempotent; changing a recorded decision
   fails. A future editable UI can hold a draft before submitting its final decision.
5. Complete review only after every proposal has a decision, including a repair
   level. A genuinely empty successful analysis needs explicit acknowledgement.
6. Supply every relevant attempt to `preparePlannerInput`, including technical
   retries. Any incomplete review blocks the entire batch. Duplicate sessions and
   another learner's evidence fail rather than being silently filtered.
7. The returned snapshot contains accepted/corrected observations, source scene
   references and timestamps, review decisions and repair levels. No evidence
   yields `calibration`, not pretend personalization. Inputs and outputs are copied
   so caller mutation cannot rewrite the committed history.

The helper cannot prove that the caller supplied the complete history, that a
scene really appeared, that the reviewer is the parent, or that an observation
is semantically true. Its TypeScript contract is **not an API JSON parser**. Validate
untrusted payloads and enforce ownership in the future server adapter. Free-text
support/description is data, never an instruction to a future model.

## Persistence and planning integration

Keep the proposed Convex stack. Build on the merged #4 storage/recording implementation; do not
substitute localStorage diagnostics for durable learner memory.

The #5 adapter should store source records, immutable proposal batches and parent
decisions separately. Use unique session/run/proposal identities for retry safety,
server-side ownership checks, and transactions for concurrent review completion.
Hydrate the pure contract from validated records; never accept a browser-supplied
`reviewed: true` flag as authority. Validate source references against the canonical
record, not against an Observer-supplied list of exchanges.

The #6 adapter must load all relevant attempts in stable order and check pending
analysis/review **before** any recency or top-k selection. Store the exact evidence
snapshot with the generated plan and its rationale atomically. `preparePlannerInput`
seals only its in-memory objects: it is not a database transaction or a successful
model plan. On failure discard that candidate; retain the durable review for retry.
Later corrections must not silently rewrite an already-generated plan.

A subsequent planner output validator should require warm-up/main/fresh-example
structure, bounded quantities/support, valid evidence IDs and a causal explanation
of what changed. That planner is intentionally not fabricated in this contribution.

## Roadmap alignment (reviewed 2026-09-26)

| Existing issue | Contribution / next step |
| --- | --- |
| #4 trustworthy session records | Versioned diagnostic exports, attempt linkage, truncation disclosure and terminal-event regression tests assist debugging; durable storage/audio is implemented upstream |
| #5 Observer and review | Executable review rules and failure/retry/correction fixtures; integrate with real sources and parent UI next |
| #6 tomorrow's lesson | Tested planner-input gate and provenance; actual plan generation/delivery verification remains |
| #7 seven-day experiment | Reproducible setup/CI and synthetic memory example; full experiment workflow still required |
| #19 instrumentation | Identify synthetic vs live attempts; durable usage, costs and outcome instrumentation remains |
| #16 domains / #26 direct interactions | Preserve deterministic state and adapter seams; extend only after concrete experiments |
| #14 duration / #17 interests / #18 progress | Preserve existing sequencing; interests, participation, evidence and mastery remain distinct |
| #25 avatar / #27 onboarding | Defer until core tutoring/evidence experiments justify product expansion |

None of these issues is closed by this foundation. In particular, there is still
no parent-review screen, live learner memory,
next-lesson generator, or validated seven-day experiment.
