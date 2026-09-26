import { describe, expect, it } from "vitest";
import { distribution, sessionMetrics, summarizeSessions } from "../lib/session-metrics";

const report = (overrides = {}) => ({
  schemaVersion: 1,
  attemptId: "attempt-a",
  mode: "live",
  droppedEvents: 0,
  model: "test-model",
  promptVersion: "test-prompt",
  events: [
    { at: 0, type: "attempt.started" },
    { at: 200, type: "lesson.started" },
    {
      at: 300,
      type: "answer.evaluated",
      detail: { sceneIndex: 0, version: "a", decision: "ADVANCE", latency_ms: 100, utterance: "private transcript" },
    },
    {
      at: 400,
      type: "answer.evaluated",
      detail: { sceneIndex: 1, version: "b", decision: "STALE", stale: true, latency_ms: 9000 },
    },
    {
      at: 500,
      type: "answer.evaluated",
      detail: { sceneIndex: 1, version: "c", decision: "UNAVAILABLE", latency_ms: 200 },
    },
    { at: 600, type: "advance.displayed", detail: { turn_end_to_display_ms: 250 } },
    { at: 1000, type: "lesson.ended" },
    { at: 1100, type: "connection.finalized" },
  ],
  ...overrides,
});

describe("session reporting", () => {
  it("uses explicit denominators and excludes stale answers from availability and latency", () => {
    const cohort = summarizeSessions([report()]).cohorts[0];
    expect(cohort.startupSuccess).toEqual({ numerator: 1, denominator: 1, value: 1 });
    expect(cohort.evaluatorUnavailable).toEqual({ numerator: 1, denominator: 2, value: 0.5 });
    expect(cohort.evaluatorLatencyMs).toEqual({ n: 2, p50: 100, p95: 200, max: 200 });
    expect(cohort.staleEvaluationsExcluded).toBe(1);
    expect(cohort.turnEndToDisplayMs.p50).toBe(250);
  });
  it("deduplicates repeated exports without inflating participation", () => {
    const result = summarizeSessions([report(), report()]);
    expect(result.duplicateExportsExcluded).toBe(1);
    expect(result.cohorts[0].attempts).toBe(1);
    expect(() => summarizeSessions([report(), report({ events: [] })])).toThrow(/Conflicting/);
  });
  it("keeps demo, models and prompts in separate cohorts", () => {
    const inputs = [
      report(),
      report({ attemptId: "b", mode: "synthetic_demo" }),
      report({ attemptId: "c", model: "other" }),
      report({ attemptId: "d", promptVersion: "other" }),
    ];
    expect(summarizeSessions(inputs).cohorts).toHaveLength(4);
  });
  it("excludes truncated and legacy exports from rates but preserves observed failures", () => {
    const result = summarizeSessions([
      report({ droppedEvents: 2, events: [{ at: 10, type: "recording.failed" }] }),
      report({ attemptId: "b", schemaVersion: undefined, droppedEvents: undefined }),
    ]);
    expect(result.cohorts[0]).toMatchObject({
      excludedIncompleteExports: 2,
      observedRecordingFailureAttempts: 1,
      startupSuccess: { denominator: 0, value: null },
      evaluatorLatencyMs: { n: 0, p95: null },
    });
  });
  it("does not count an in-progress export as a failed startup", () => {
    const cohort = summarizeSessions([report({ events: [{ at: 0, type: "attempt.started" }] })]).cohorts[0];
    expect(cohort.unfinishedExports).toBe(1);
    expect(cohort.startupSuccess.denominator).toBe(0);
  });
  it("counts failed startup and unconfirmed shutdown separately", () => {
    const cohort = summarizeSessions([
      report({
        events: [
          { at: 0, type: "attempt.started" },
          { at: 20, type: "provider.error" },
          { at: 30, type: "lesson.ended" },
        ],
      }),
    ]).cohorts[0];
    expect(cohort.startupSuccess.value).toBe(0);
    expect(cohort.confirmedFinalization.value).toBe(0);
    expect(cohort.observedProviderFailureAttempts).toBe(1);
  });
  it("keeps distinct scene evaluations and ignores duplicate callbacks", () => {
    const event = {
      at: 10,
      type: "answer.evaluated",
      detail: { sceneIndex: 0, version: "a", decision: "STAY", latency_ms: 10 },
    };
    expect(
      sessionMetrics(report({ events: [event, event, { ...event, detail: { ...event.detail, sceneIndex: 1 } }] }))
        .evaluations,
    ).toBe(2);
  });
  it("never publishes transcripts, identifiers or unsupported outcome estimates", () => {
    const result = summarizeSessions([report()]);
    expect(JSON.stringify(result)).not.toMatch(/private transcript|attempt-a/);
    expect(result.cohorts[0]).toMatchObject({
      audibleResponseLatencyMs: null,
      cost: null,
      learningOutcome: null,
      parentRepairMinutes: null,
    });
  });
  it("rejects malformed exports instead of returning reassuring zeroes", () => {
    for (const input of [
      null,
      {},
      report({ schemaVersion: 2 }),
      report({ droppedEvents: -1 }),
      report({ events: [{ at: NaN, type: "lesson.started" }] }),
    ])
      expect(() => sessionMetrics(input)).toThrow();
  });
  it("documents nearest-rank percentiles and missing data", () => {
    expect(distribution([])).toEqual({ n: 0, p50: null, p95: null, max: null });
    expect(distribution([4, 1, 3, 2])).toEqual({ n: 4, p50: 2, p95: 4, max: 4 });
  });
});
