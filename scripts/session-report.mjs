// Local-only analysis: raw transcripts are read, never copied into the output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { summarizeSessions } from "../lib/session-metrics.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--out");
if (at < 1 || at !== args.length - 2 || !args[at + 1]) {
  console.error("Usage: npm run report:sessions -- diagnostics.json [...] --out test-results/session-report.json");
  process.exit(1);
}
try {
  const inputs = args.slice(0, at).map(path => resolve(path));
  const out = resolve(args[at + 1]);
  if (inputs.includes(out)) throw new Error("Output must not overwrite an input.");
  const summary = summarizeSessions(inputs.map(path => JSON.parse(readFileSync(path, "utf8"))));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Report failed");
  process.exitCode = 1;
}
