import { expect, it, vi } from "vitest";
import { DemoTransport, evaluateDemoAnswer } from "../lib/demo-transport";
import { LessonSession } from "../lib/session";

it("emits distinct synthetic turns, finalizes, and ignores answers after stop", async () => {
  const events = vi.fn();
  const transport = new DemoTransport();
  await transport.start(events);
  transport.answer(3);
  transport.answer(2);
  expect(events.mock.calls.map(([event]) => event.type)).toEqual(["session.started", "transcript", "transcript"]);
  expect(events.mock.calls[2][0].startMs - events.mock.calls[1][0].endMs).toBeGreaterThan(2500);
  transport.stopMedia();
  transport.answer(1);
  expect(events).toHaveBeenCalledTimes(3);
  transport.send({ type: "session.close", event_id: "close" });
  await Promise.resolve();
  expect(events).toHaveBeenLastCalledWith({ type: "session.closed", reason: "demo" });
});

it("evaluates only literal preview numbers, with cancellation", async () => {
  const abort = new AbortController();
  expect(await evaluateDemoAnswer({ sceneIndex: 0, utterance: "1" }, abort.signal)).toMatchObject({ probability: 1 });
  expect(await evaluateDemoAnswer({ sceneIndex: 0, utterance: "5" }, abort.signal)).toMatchObject({ probability: 0 });
  expect(await evaluateDemoAnswer({ sceneIndex: 0, utterance: "one" }, abort.signal)).toMatchObject({ probability: 0 });
  abort.abort();
  expect(await evaluateDemoAnswer({ sceneIndex: 0, utterance: "1" }, abort.signal)).toMatchObject({
    status: "unavailable",
  });
});

it("drives the real controller through display, revised answer, advance and stop", async () => {
  vi.useFakeTimers();
  const transport = new DemoTransport();
  const session = new LessonSession(transport, evaluateDemoAnswer, vi.fn(), undefined, undefined, undefined, {
    mode: "synthetic_demo",
  });
  try {
    await session.start();
    session.displayed(0);
    transport.answer(5);
    await vi.advanceTimersByTimeAsync(4000);
    expect(session.snapshot.sceneIndex).toBe(0);
    transport.answer(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(session.snapshot.sceneIndex).toBe(1);
    session.displayed(1);
    transport.answer(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(session.snapshot.sceneIndex).toBe(2);
    session.end("parent_stop");
    await vi.advanceTimersByTimeAsync(0);
    expect(session.snapshot.reason).toBe("parent_stop");
    expect(session.events.filter(event => event.type === "connection.finalized")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    session.dispose();
    vi.useRealTimers();
  }
});
