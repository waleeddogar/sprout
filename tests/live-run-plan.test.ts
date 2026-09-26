import { expect, it } from "vitest";
import { liveRunPlan } from "../lib/live-run-plan";
const scenarios = { quick_answer: { seconds: 50 }, long: { seconds: 375 } };
it("defaults to one short run with startup/cleanup allowance", () => {
  expect(liveRunPlan([], scenarios)).toMatchObject({ reservedSeconds: 80, runs: [{ name: "quick_answer" }] });
});
it("rejects invalid arguments and excessive plans before starting providers", () => {
  for (const args of [
    ["missing"],
    ["--repeat"],
    ["--repeat", "0"],
    ["--repeat", "100000"],
    ["long"],
    ["--max-seconds", "NaN"],
  ])
    expect(() => liveRunPlan(args, scenarios)).toThrow();
});
it("allows deliberate bounded repeats and dry runs in either argument order", () => {
  expect(liveRunPlan(["--dry-run", "--repeat", "2", "quick_answer", "--max-seconds", "160"], scenarios)).toMatchObject({
    dryRun: true,
    reservedSeconds: 160,
    runs: [{ label: "quick_answer-1" }, { label: "quick_answer-2" }],
  });
});
