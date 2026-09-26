/**
 * Runs scripted voice scenarios against the REAL GPT-Live-1 session (billed per
 * second) and writes readable timelines to test-results/live-matrix/.
 *
 * Speech is macOS `say` text-to-speech mixed by ffmpeg and fed to Chromium as a
 * fake microphone. It is adult synthetic speech on a fixed timeline that cannot
 * react to Sprout, so it probes model control behavior, not preschool speech.
 *
 * Usage: start `npm run dev`, then `npm run test:live [scenario ...] [--repeat N]`.
 * BASE_URL defaults to http://127.0.0.1:3000; LIVE_OUT overrides the output directory.
 */
import { liveRunPlan } from "../lib/live-run-plan.ts";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { SCENARIOS } from "./live/scenarios.mjs";
import { runFixedTimeline } from "./live/fixed-timeline.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.LIVE_OUT ?? "test-results/live-matrix";

let plan;
try {
  plan = liveRunPlan(process.argv.slice(2), SCENARIOS);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(JSON.stringify(plan, null, 2));
if (plan.dryRun) process.exit(0);
// Preflight before opening any paid sessions. This harness currently needs macOS.
if (process.platform !== "darwin")
  throw new Error(
    "Live speech fixtures require macOS say and ffmpeg. Use --dry-run to inspect a plan on other platforms.",
  );
execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
execFileSync("say", ["-v", "?"], { stdio: "ignore" });
mkdirSync(OUT, { recursive: true });
let revision = "unknown";
try {
  revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  /* outside a checkout */
}
writeFileSync(
  `${OUT}/run-plan.json`,
  JSON.stringify(
    {
      ...plan,
      revision,
      startedAt: new Date().toISOString(),
      stimulus: "fixed-timeline synthetic adult speech; live providers",
      baseUrl: BASE_URL,
    },
    null,
    2,
  ),
);
// Sequential sessions keep the planned workload bounded and avoid provider contention.
for (const { name, label } of plan.runs) {
  try {
    console.log(await runFixedTimeline(name, SCENARIOS[name], { out: OUT, baseUrl: BASE_URL, label }));
  } catch (error) {
    mkdirSync(`${OUT}/${label}`, { recursive: true });
    writeFileSync(`${OUT}/${label}/failure.json`, JSON.stringify({ error: String(error) }, null, 2));
    console.error(`${label} FAILED: ${error}`);
    process.exitCode = 1;
    break;
  }
}
