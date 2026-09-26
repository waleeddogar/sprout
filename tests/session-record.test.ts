import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseProviderEvent } from "../lib/events";
import { LessonSession, type Transport } from "../lib/session";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function attempt(previousAttemptId?: string) {
  const transport: Transport = {
    start: vi.fn(async () => {}),
    send: vi.fn(),
    setOutputBlocked: vi.fn(),
    stopMedia: vi.fn(),
    close: vi.fn(),
  };
  const session = new LessonSession(
    transport,
    async () => ({ status: "unavailable", reason: "test", latencyMs: 0 }),
    vi.fn(),
    undefined,
    undefined,
    undefined,
    { previousAttemptId, mode: "synthetic_demo" },
  );
  void session.start();
  session.receive({ type: "session.started" });
  session.displayed(0);
  return { session, transport };
}

it("links attempts with unique IDs even when started on the same clock tick", () => {
  const first = attempt().session;
  first.end("parent_stop");
  const retry = attempt(first.attemptId).session;
  expect(retry.attemptId).not.toBe(first.attemptId);
  expect(retry.report("test")).toMatchObject({
    schemaVersion: 1,
    mode: "synthetic_demo",
    previousAttemptId: first.attemptId,
  });
  first.dispose();
  retry.dispose();
});

it("records one finalization and ignores duplicate or contradictory terminal events", () => {
  const { session, transport } = attempt();
  session.end("parent_stop");
  session.receive({ type: "session.closed", reason: "done", usage: { seconds: 5 } });
  const report = session.report("test");
  session.receive({ type: "session.closed", reason: "late", usage: { seconds: 100 } });
  session.receive({ type: "transcript", speaker: "child", delta: "late", startMs: 0, endMs: 100 });
  expect(session.report("test")).toEqual(report);
  expect(session.events.filter(event => event.type === "connection.finalized")).toHaveLength(1);
  expect(transport.close).toHaveBeenCalledOnce();
});

it("does not append late usage after the transport finalization deadline", () => {
  const { session } = attempt();
  session.end("parent_stop");
  vi.advanceTimersByTime(1500);
  const report = session.report("test");
  session.receive({ type: "session.closed", usage: { seconds: 100 } });
  expect(session.report("test")).toEqual(report);
});

it("exports nested copies and declares diagnostics truncation", () => {
  const { session } = attempt();
  session.log("nested", { support: ["hint"] });
  const report = session.report("test");
  (report.events.at(-1)!.detail as { support: string[] }).support.push("mutated");
  expect(session.events.at(-1)!.detail).toEqual({ support: ["hint"] });
  const initial = session.events.length;
  for (let index = 0; index < 8002; index++) session.log("synthetic", index);
  expect(session.events).toHaveLength(8000);
  expect(session.report("test").droppedEvents).toBe(initial + 2);
  session.dispose();
});

it.each([
  [NaN, 10],
  [0, Infinity],
  [-1, 10],
  [10, 9],
  [Infinity, Infinity],
])("rejects invalid provider timing %s → %s", (start_ms, end_ms) => {
  expect(parseProviderEvent({ type: "session.input_transcript.delta", delta: "three", start_ms, end_ms })).toBeNull();
});
