/** Bound scheduled provider time before starting any paid voice sessions. */
export function liveRunPlan(args: string[], scenarios: Record<string, { seconds: number }>) {
  const requested: string[] = [];
  let repeat = 1;
  let maxSeconds = 180;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--repeat") repeat = Number(args[++i]);
    else if (arg === "--max-seconds") maxSeconds = Number(args[++i]);
    else if (Object.hasOwn(scenarios, arg)) requested.push(arg);
    else throw new Error(`Unknown scenario or option: ${arg}`);
  }
  if (
    !Number.isSafeInteger(repeat) ||
    repeat < 1 ||
    repeat > 100 ||
    !Number.isSafeInteger(maxSeconds) ||
    maxSeconds < 1
  )
    throw new Error("Repeat must be 1–100 and max-seconds a positive integer.");
  const names = requested.length ? [...new Set(requested)] : ["quick_answer"];
  const runs = names.flatMap(name =>
    Array.from({ length: repeat }, (_, i) => ({ name, label: `${name}-${i + 1}`, seconds: scenarios[name].seconds })),
  );
  // Include the bounded startup and finalization wait, not only scripted speech.
  const reservedSeconds = runs.reduce((sum, run) => sum + run.seconds + 30, 0);
  if (reservedSeconds > maxSeconds)
    throw new Error(
      `Plan reserves ${reservedSeconds}s, exceeding --max-seconds ${maxSeconds}. Select fewer runs or explicitly raise the limit.`,
    );
  return { dryRun, maxSeconds, reservedSeconds, runs };
}
