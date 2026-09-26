import { describe, expect, it } from "vitest";
import {
  EvidenceReview,
  preparePlannerInput,
  type Observation,
  type Proposal,
  type ReviewSource,
} from "../lib/reviewed-memory";

const observation = (): Observation => ({
  quantity: 3,
  behavior: "quantity_identification",
  description: "Said three for the displayed group.",
  support: ["No help observed; nearby speaker identity remains unverified."],
  uncertainty: ["No count sequence observed."],
});
const source = (sessionId = "session-1", learnerId = "synthetic-learner"): ReviewSource => ({
  sessionId,
  learnerId,
  finalized: true,
  exchanges: [{ id: "exchange-1", sceneId: "butterfly-garden", atMs: 1200 }],
});
const proposal = (id = "proposal-1"): Proposal => ({ id, exchangeIds: ["exchange-1"], observation: observation() });
const at = "2026-09-25T12:00:00.000Z";
function ready(proposals = [proposal()], sessionId = "session-1", learnerId = "synthetic-learner") {
  const review = new EvidenceReview(source(sessionId, learnerId));
  review.setAnalysis({ status: "ready", runId: "observer-1", proposals });
  return review;
}
function accepted(sessionId = "session-1", learnerId = "synthetic-learner") {
  const review = ready(undefined, sessionId, learnerId);
  review.decide({ proposalId: "proposal-1", outcome: "accepted", reviewedAt: at });
  review.complete({ level: "verified", note: "" });
  return review;
}

describe("parent-reviewed memory boundary", () => {
  it("requires finalized sessions and resolvable timestamped exchanges", () => {
    expect(() => new EvidenceReview({ ...source(), finalized: false })).toThrow(/Finalize/);
    expect(() => new EvidenceReview({ ...source(), exchanges: [{ id: "x", sceneId: "s", atMs: NaN }] })).toThrow(
      /timing/,
    );
    expect(() => ready([{ ...proposal(), exchangeIds: ["missing"] }])).toThrow(/source exchanges/);
    expect(() => ready([{ ...proposal(), exchangeIds: [] }])).toThrow(/source exchanges/);
    expect(() => ready([proposal(), proposal()])).toThrow(/unique/);
  });

  it.each(["pending", "running", "failed"] as const)(
    "blocks %s analysis instead of treating it as empty evidence",
    status => {
      const review = new EvidenceReview(source());
      review.setAnalysis({ status });
      expect(() => review.complete({ level: "verified", note: "" })).toThrow(/Analysis must succeed/);
      expect(() => preparePlannerInput("synthetic-learner", [review])).toThrow(/incomplete/);
    },
  );

  it("requires all proposals to be reviewed and the repair level acknowledged", () => {
    const review = ready([proposal("a"), proposal("b")]);
    review.decide({ proposalId: "a", outcome: "accepted", reviewedAt: at });
    expect(() => review.complete({ level: "verified", note: "" })).toThrow(/every proposal/);
    expect(() => preparePlannerInput("synthetic-learner", [review])).toThrow(/incomplete/);
    review.decide({ proposalId: "b", outcome: "rejected", reviewedAt: at, reason: "Unsupported conclusion." });
    expect(() => preparePlannerInput("synthetic-learner", [review])).toThrow(/incomplete/);
    review.complete({ level: "light_correction", note: "Rejected unsupported proposal." });
    const input = preparePlannerInput("synthetic-learner", [review]);
    expect(input.evidence.map(item => item.proposalId)).toEqual(["a"]);
    expect(input.evidence[0].sources).toEqual(source().exchanges);
  });

  it("uses corrections while preserving the original proposal, support and uncertainty", () => {
    const review = ready();
    const corrected = { ...observation(), support: ["Parent supplied the total before this response."] };
    review.decide({ proposalId: "proposal-1", outcome: "corrected", reviewedAt: at, observation: corrected });
    review.complete({ level: "substantial_repair", note: "Parent added missing assistance." });
    const input = preparePlannerInput("synthetic-learner", [review]);
    expect(input.evidence[0].observation).toEqual(corrected);
    expect(input.evidence[0].repair.level).toBe("substantial_repair");
    const analysis = review.snapshot().analysis;
    expect(analysis.status === "ready" && analysis.proposals[0].observation).toEqual(observation());
    expect(input.evidence[0]).toMatchObject({ sessionId: "session-1", runId: "observer-1", proposalId: "proposal-1" });
  });

  it("can retry failed analysis but commits successful proposals and decisions idempotently", () => {
    const review = new EvidenceReview(source());
    review.setAnalysis({ status: "failed" });
    const analysis = { status: "ready" as const, runId: "observer-1", proposals: [proposal()] };
    review.setAnalysis(analysis);
    review.setAnalysis(analysis);
    expect(() => review.setAnalysis({ ...analysis, runId: "observer-2" })).toThrow(/cannot be replaced/);
    const decision = { proposalId: "proposal-1", outcome: "accepted" as const, reviewedAt: at };
    review.decide(decision);
    review.decide(decision);
    expect(review.snapshot().decisions).toHaveLength(1);
    expect(() => review.decide({ ...decision, outcome: "rejected", reason: "Changed mind" })).toThrow(/overwritten/);
  });

  it("requires explicit acknowledgement of an empty successful review", () => {
    const review = ready([]);
    expect(() => preparePlannerInput("synthetic-learner", [review])).toThrow(/incomplete/);
    review.complete({ level: "verified", note: "No usable evidence in this partial session." });
    expect(review.snapshot().emptyAcknowledged).toBe(true);
    expect(preparePlannerInput("synthetic-learner", [review])).toMatchObject({ mode: "calibration", evidence: [] });
  });

  it("uses calibration when everything was rejected or there is no history", () => {
    const review = ready();
    review.decide({ proposalId: "proposal-1", outcome: "rejected", reviewedAt: at, reason: "Unclear scene context." });
    review.complete({ level: "verified", note: "" });
    expect(preparePlannerInput("synthetic-learner", [review]).mode).toBe("calibration");
    expect(preparePlannerInput("synthetic-learner", []).mode).toBe("calibration");
  });

  it("blocks an unfinished technical retry without sealing earlier reviews", () => {
    const first = accepted();
    const retry = new EvidenceReview(source("retry-1"));
    retry.setAnalysis({ status: "failed" });
    expect(() => preparePlannerInput("synthetic-learner", [first, retry])).toThrow(/incomplete/);
    expect(first.snapshot().sealed).toBe(false);
  });

  it("rejects cross-learner and duplicate-session inputs", () => {
    expect(() => preparePlannerInput("other-learner", [accepted()])).toThrow(/mix learners/);
    expect(() => preparePlannerInput("synthetic-learner", [accepted(), accepted()])).toThrow(/Duplicate session/);
  });

  it.each([0, 6, 2.5, NaN, Infinity])("rejects quantity %s in proposals and corrections", quantity => {
    const invalid = { ...observation(), quantity };
    expect(() => ready([{ ...proposal(), observation: invalid }])).toThrow(/1–5/);
    expect(() =>
      ready().decide({ proposalId: "proposal-1", outcome: "corrected", reviewedAt: at, observation: invalid }),
    ).toThrow(/1–5/);
  });

  it("isolates every snapshot from later caller mutation", () => {
    const original = source();
    const review = new EvidenceReview(original);
    original.exchanges[0].sceneId = "mutated";
    const proposed = proposal();
    review.setAnalysis({ status: "ready", runId: "observer-1", proposals: [proposed] });
    proposed.observation.description = "Mutated proposal";
    review.decide({ proposalId: "proposal-1", outcome: "accepted", reviewedAt: at });
    review.complete({ level: "verified", note: "" });
    const input = preparePlannerInput("synthetic-learner", [review]);
    input.evidence[0].observation.description = "Mutated plan input";
    review.snapshot().source.exchanges[0].sceneId = "also mutated";
    expect(review.plannerEvidence()[0].observation.description).toBe(observation().description);
    expect(review.plannerEvidence()[0].sources[0].sceneId).toBe("butterfly-garden");
    expect(review.snapshot().sealed).toBe(true);
    expect(() => review.complete({ level: "substantial_repair", note: "Rewrite history" })).toThrow(/overwritten/);
  });
});
