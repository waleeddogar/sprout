/**
 * Executable review/planner boundary for issues #5 and #6, independent of the
 * voice controller, model provider and future Convex adapter. This is NOT a
 * database or an Observer: callers supply finalized, validated source records.
 */
export type Observation = {
  quantity: number;
  behavior: "quantity_identification" | "counting_aloud_with_total" | "uncertain";
  description: string;
  support: string[];
  uncertainty: string[];
};

export type Exchange = { id: string; sceneId: string; atMs: number };
export type ReviewSource = {
  sessionId: string;
  learnerId: string;
  finalized: boolean;
  exchanges: Exchange[];
};
export type Proposal = { id: string; exchangeIds: string[]; observation: Observation };
export type Decision =
  | { proposalId: string; outcome: "accepted"; reviewedAt: string }
  | { proposalId: string; outcome: "corrected"; reviewedAt: string; observation: Observation }
  | { proposalId: string; outcome: "rejected"; reviewedAt: string; reason: string };
export type Analysis =
  { status: "pending" | "running" | "failed" } | { status: "ready"; runId: string; proposals: Proposal[] };
export type Repair = { level: "verified" | "light_correction" | "substantial_repair"; note: string };
export type ReviewedEvidence = {
  id: string;
  learnerId: string;
  sessionId: string;
  runId: string;
  proposalId: string;
  decision: Decision;
  sources: Exchange[];
  observation: Observation;
  repair: Repair;
};
export type PlannerInput = {
  version: 1;
  learnerId: string;
  mode: "calibration" | "reviewed_evidence";
  scope: { minQuantity: 1; maxQuantity: 5 };
  reviewedSessionIds: string[];
  evidence: ReviewedEvidence[];
};

const copy = <T>(value: T): T => structuredClone(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validateObservation(observation: Observation) {
  assert(
    Number.isInteger(observation.quantity) && observation.quantity >= 1 && observation.quantity <= 5,
    "Observation must stay within quantities 1–5.",
  );
  assert(
    ["quantity_identification", "counting_aloud_with_total", "uncertain"].includes(observation.behavior),
    "Unknown observed behavior.",
  );
  assert(nonempty(observation.description), "Describe the concrete observation.");
  assert(Array.isArray(observation.support) && observation.support.every(nonempty), "Invalid support context.");
  assert(
    Array.isArray(observation.uncertainty) && observation.uncertainty.every(nonempty),
    "Invalid uncertainty context.",
  );
}

/**
 * One finalized attempt, one committed analysis and append-only parent decisions.
 * All incoming/outgoing values are copied so edits cannot silently rewrite history.
 * Parent authentication, storage transactions and complete-history loading belong
 * to the adapter; this class deliberately cannot establish those guarantees.
 */
export class EvidenceReview {
  private readonly source: ReviewSource;
  private analysis: Analysis = { status: "pending" };
  private decisions = new Map<string, Decision>();
  private repair?: Repair;
  private emptyAcknowledged = false;
  private sealed = false;

  constructor(source: ReviewSource) {
    assert(source.finalized === true, "Finalize the session before creating a review.");
    assert(nonempty(source.sessionId) && nonempty(source.learnerId), "Session and learner IDs are required.");
    assert(
      new Set(source.exchanges.map(exchange => exchange.id)).size === source.exchanges.length,
      "Exchange IDs must be unique within the session.",
    );
    for (const exchange of source.exchanges) {
      assert(nonempty(exchange.id) && nonempty(exchange.sceneId), "Exchange and displayed-scene IDs are required.");
      assert(Number.isFinite(exchange.atMs) && exchange.atMs >= 0, "Exchange timing must be finite and nonnegative.");
    }
    this.source = copy(source);
  }

  setAnalysis(analysis: Analysis) {
    // A successful Observer retry can be replayed, but cannot replace the batch
    // being reviewed. A new run requires an explicit future revision workflow.
    if (this.analysis.status === "ready") {
      assert(JSON.stringify(analysis) === JSON.stringify(this.analysis), "Committed analysis cannot be replaced.");
      return;
    }
    assert(["pending", "running", "failed", "ready"].includes(analysis.status), "Unknown analysis state.");
    if (analysis.status === "ready") {
      assert(nonempty(analysis.runId), "An analysis run ID is required.");
      assert(
        new Set(analysis.proposals.map(proposal => proposal.id)).size === analysis.proposals.length,
        "Proposal IDs must be unique.",
      );
      const exchangeIds = new Set(this.source.exchanges.map(exchange => exchange.id));
      for (const proposal of analysis.proposals) {
        assert(nonempty(proposal.id), "A proposal ID is required.");
        assert(
          proposal.exchangeIds.length > 0 &&
            new Set(proposal.exchangeIds).size === proposal.exchangeIds.length &&
            proposal.exchangeIds.every(id => exchangeIds.has(id)),
          "Every proposal must cite actual source exchanges.",
        );
        validateObservation(proposal.observation);
      }
    }
    this.analysis = copy(analysis);
  }

  decide(decision: Decision) {
    assert(this.analysis.status === "ready", "Analysis must succeed before parent review.");
    assert(
      this.analysis.proposals.some(proposal => proposal.id === decision.proposalId),
      "Unknown proposal.",
    );
    assert(["accepted", "corrected", "rejected"].includes(decision.outcome), "Unknown review decision.");
    assert(
      nonempty(decision.reviewedAt) && Number.isFinite(Date.parse(decision.reviewedAt)),
      "Review time is required.",
    );
    if (decision.outcome === "corrected") validateObservation(decision.observation);
    if (decision.outcome === "rejected") assert(nonempty(decision.reason), "Give a rejection reason.");
    const previous = this.decisions.get(decision.proposalId);
    if (previous) {
      assert(JSON.stringify(previous) === JSON.stringify(decision), "A recorded decision cannot be overwritten.");
      return;
    }
    assert(!this.sealed, "This review has already been used for planning.");
    this.decisions.set(decision.proposalId, copy(decision));
  }

  complete(repair: Repair) {
    assert(this.analysis.status === "ready", "Analysis must succeed before completing review.");
    assert(this.decisions.size === this.analysis.proposals.length, "Review every proposal first.");
    assert(
      ["verified", "light_correction", "substantial_repair"].includes(repair.level) && typeof repair.note === "string",
      "Record the parent's repair level.",
    );
    if (this.repair) {
      assert(JSON.stringify(this.repair) === JSON.stringify(repair), "Completed review cannot be overwritten.");
      return;
    }
    this.repair = copy(repair);
    // An empty successful analysis still needs this explicit parent acknowledgement.
    this.emptyAcknowledged = this.analysis.proposals.length === 0;
  }

  snapshot() {
    return copy({
      source: this.source,
      analysis: this.analysis,
      decisions: [...this.decisions.values()],
      repair: this.repair,
      emptyAcknowledged: this.emptyAcknowledged,
      sealed: this.sealed,
    });
  }

  /** Safe to inspect, but cannot return pending/rejected observations as evidence. */
  plannerEvidence(): ReviewedEvidence[] {
    assert(this.analysis.status === "ready" && this.repair, "Parent review is incomplete.");
    const { runId, proposals } = this.analysis;
    return proposals.flatMap(proposal => {
      const decision = this.decisions.get(proposal.id)!;
      if (decision.outcome === "rejected") return [];
      return [
        copy({
          id: JSON.stringify([this.source.sessionId, runId, proposal.id]),
          learnerId: this.source.learnerId,
          sessionId: this.source.sessionId,
          runId,
          proposalId: proposal.id,
          decision,
          sources: proposal.exchangeIds.map(id => this.source.exchanges.find(exchange => exchange.id === id)!),
          observation: decision.outcome === "corrected" ? decision.observation : proposal.observation,
          repair: this.repair!,
        }),
      ];
    });
  }

  seal() {
    this.plannerEvidence(); // Cannot seal a failed/pending analysis or unfinished review.
    this.sealed = true;
  }
}

/**
 * Supply EVERY relevant attempt (including partial sessions/retries), oldest first.
 * No top-k retrieval until all reviews are checked. Persist the returned snapshot
 * with the eventual plan in the same transaction; it is input, not a lesson plan.
 */
export function preparePlannerInput(learnerId: string, reviews: readonly EvidenceReview[]): PlannerInput {
  assert(nonempty(learnerId), "A learner ID is required.");
  const sessions = reviews.map(review => review.snapshot().source);
  assert(
    sessions.every(source => source.learnerId === learnerId),
    "Cannot mix learners' evidence.",
  );
  assert(new Set(sessions.map(source => source.sessionId)).size === sessions.length, "Duplicate session review.");
  // Validate the entire batch before sealing any of it.
  const evidence = reviews.flatMap(review => review.plannerEvidence());
  reviews.forEach(review => review.seal());
  return {
    version: 1,
    learnerId,
    mode: evidence.length ? "reviewed_evidence" : "calibration",
    scope: { minQuantity: 1, maxQuantity: 5 },
    reviewedSessionIds: sessions.map(source => source.sessionId),
    evidence,
  };
}
