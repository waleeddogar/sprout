# Evaluation and memory framework choices

Sprout already has a TypeScript session controller, Vitest, Playwright and Convex.
The near-term gap is connecting trustworthy session evidence to a parent decision,
not coordinating more agents. This is a documentation/API comparison, not a
performance benchmark or a claim that these frameworks have been integrated.

| Option | What fits Sprout | What remains our responsibility | Decision for this PR |
| --- | --- | --- | --- |
| [Promptfoo](https://www.promptfoo.dev/docs/providers/custom-api/) | A custom JavaScript provider can wrap the evaluator; fixed cases and assertions can compare prompt/model changes | Label quality, held-out cases, cancellation/races and real microphone behavior | Keep the existing Jev calibration for now. Consider Promptfoo when comparing multiple evaluators or Observer prompts; wrap the real API rather than rebuilding it |
| [Langfuse experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk) | Local/hosted datasets and code evaluators support repeatable experiment comparison | Parent consent/data handling, evidence validity and whether a proposed adaptation was delivered | Defer another data service. Local aggregate reports answer the current one-child experiment's technical questions |
| [Pipecat latency observer](https://docs.pipecat.ai/api-reference/server/utilities/observers/user-bot-latency-observer) | Its user-stop to bot-start measurement is the right distinction for conversational response latency | Instrument actual audible playback and interruption on Sprout's WebRTC client | Borrow the measurement distinction, not a replacement voice stack. Generated transcript timing is only a proxy |
| [Graphiti](https://help.getzep.com/graphiti/getting-started/overview) | Temporal knowledge graphs could help represent changing observations and relationships for #29 | Parent review, source validation, rejection, learner ownership and planning bounds | Keep the storage-independent review contract. A graph is not a substitute for accepting or correcting an observation |
| Existing Vitest + Playwright + Convex | Already covers controller races, real browser UI/media lifecycle and persistence contracts | Live provider quality, real child experience, seven-day outcomes | Extend these with diagnostic reporting and a bounded live smoke plan; add no production dependency |

Revisit these choices when there is a concrete need: multiple model candidates
(Promptfoo), multiple people reviewing shared experiment traces (Langfuse), a new
voice transport (Pipecat), or graph queries that the session/evidence model cannot
answer clearly (Graphiti). Introducing them now would add maintenance without
producing the missing parent judgments.

A useful next model evaluation would label answer/support cases, reserve unseen
cases before prompt tuning, and compare premature advancement, unavailable rate
and latency under the same model/prompt conditions. Neither a high answer score
nor a passing scripted session should be called a learning outcome.
