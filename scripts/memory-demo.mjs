// Synthetic contract example only. No credentials, child data, model or database.
// Node 24 executes erasable TypeScript; no extra runner dependency is needed.
import assert from "node:assert/strict";
import { EvidenceReview, preparePlannerInput } from "../lib/reviewed-memory.ts";

const review = new EvidenceReview({
  sessionId: "synthetic-day-1",
  learnerId: "synthetic-learner",
  finalized: true,
  exchanges: [{ id: "exchange-1", sceneId: "three-butterflies", atMs: 1500 }],
});
const observation = {
  quantity: 3,
  behavior: "quantity_identification",
  description: "Said three for the displayed group.",
  support: ["Support not yet checked."],
  uncertainty: ["No count sequence observed."],
};
review.setAnalysis({
  status: "ready",
  runId: "synthetic-observer-v1",
  proposals: [
    { id: "supported-total", exchangeIds: ["exchange-1"], observation },
    {
      id: "unsupported-counting",
      exchangeIds: ["exchange-1"],
      observation: { ...observation, behavior: "counting_aloud_with_total" },
    },
  ],
});
assert.throws(() => preparePlannerInput("synthetic-learner", [review]), /incomplete/);
review.decide({
  proposalId: "supported-total",
  outcome: "corrected",
  reviewedAt: "2026-09-25T12:00:00.000Z",
  observation: { ...observation, support: ["Parent supplied the total before the response."] },
});
review.decide({
  proposalId: "unsupported-counting",
  outcome: "rejected",
  reviewedAt: "2026-09-25T12:00:00.000Z",
  reason: "A correct total does not establish counting aloud.",
});
review.complete({ level: "light_correction", note: "Added help context and rejected unsupported counting." });
const input = preparePlannerInput("synthetic-learner", [review]);
assert.equal(input.evidence.length, 1);
assert.equal(input.evidence[0].decision.outcome, "corrected");
console.log("Synthetic memory boundary: pending blocked → correction retained → rejection excluded.");
console.log(JSON.stringify(input, null, 2));
console.log("This is planner INPUT, not an adaptive lesson or a claim of learning.");
