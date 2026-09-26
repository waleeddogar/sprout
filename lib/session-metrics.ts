/** Numbers derived from diagnostic events, not assessments of a learner. */
type Event = { at: number; type: string; detail?: unknown };
type Report = {
  schemaVersion?: number;
  attemptId?: string;
  mode?: string;
  model?: string;
  promptVersion?: string;
  droppedEvents?: number;
  events: Event[];
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseDiagnostic(value: unknown): Report {
  if (!record(value) || !Array.isArray(value.events)) throw new Error("Expected a diagnostic export with events.");
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1)
    throw new Error("Unsupported diagnostic version.");
  if (value.attemptId !== undefined && (typeof value.attemptId !== "string" || !value.attemptId.trim()))
    throw new Error("Invalid attempt identity.");
  if (
    value.droppedEvents !== undefined &&
    (!Number.isInteger(value.droppedEvents) || !nonnegative(value.droppedEvents))
  )
    throw new Error("Invalid dropped-event count.");
  for (const event of value.events)
    if (!record(event) || !nonnegative(event.at) || typeof event.type !== "string")
      throw new Error("Invalid diagnostic event.");
  for (const key of ["mode", "model", "promptVersion"])
    if (value[key] !== undefined && typeof value[key] !== "string") throw new Error(`Invalid ${key}.`);
  return value as Report;
}

export function distribution(values: number[]) {
  const sorted = values.filter(nonnegative).toSorted((a, b) => a - b);
  const percentile = (p: number) => (sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] : null);
  return { n: sorted.length, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) ?? null };
}

export function sessionMetrics(raw: unknown) {
  const report = parseDiagnostic(raw);
  const events = report.events.toSorted((a, b) => a.at - b.at);
  const first = (type: string) => events.find(event => event.type === type);
  const started = first("lesson.started");
  const ended = first("lesson.ended");
  // Old exports do not disclose truncation. Never silently treat them as complete.
  const complete = report.schemaVersion === 1 && report.droppedEvents === 0;
  const resolved = events.filter(event => event.type === "answer.evaluated" && record(event.detail));
  const decisions = new Map<string, Record<string, unknown>>();
  for (const event of resolved) {
    const detail = event.detail as Record<string, unknown>;
    const key = JSON.stringify([detail.sceneIndex, detail.version]);
    if (typeof detail.version === "string" && !decisions.has(key)) decisions.set(key, detail);
  }
  const all = [...decisions.values()];
  const current = all.filter(detail => detail.stale !== true && detail.decision !== "STALE");
  const valid = current.filter(detail => ["ADVANCE", "STAY", "UNAVAILABLE"].includes(String(detail.decision)));
  const samples = (items: Record<string, unknown>[], key: string) =>
    complete ? items.map(item => item[key]).filter(nonnegative) : [];
  const displays = events
    .filter(event => event.type === "advance.displayed" && record(event.detail))
    .map(event => event.detail as Record<string, unknown>);
  return {
    // Keep identity for local deduplication only; aggregate reports omit it.
    attemptId: report.attemptId ?? null,
    mode: report.mode === "synthetic_demo" ? "synthetic_demo" : report.mode === "live" ? "live" : "unknown",
    model: report.model ?? "unknown",
    promptVersion: report.promptVersion ?? "unknown",
    complete,
    started: Boolean(started),
    ended: Boolean(ended),
    startupMs: complete && started && first("attempt.started") ? started.at - first("attempt.started")!.at : null,
    durationMs: complete && started && ended ? ended.at - started.at : null,
    finalized: Boolean(first("connection.finalized")),
    recordingFailed: Boolean(first("recording.failed")),
    providerFailed: Boolean(first("provider.error")),
    evaluations: valid.length,
    unavailable: valid.filter(detail => detail.decision === "UNAVAILABLE").length,
    stale: all.length - current.length,
    evaluatorLatencyMs: samples(valid, "latency_ms"),
    turnEndToDisplayMs: samples(displays, "turn_end_to_display_ms"),
  };
}

const ratio = (numerator: number, denominator: number) => ({
  numerator,
  denominator,
  value: denominator ? numerator / denominator : null,
});

/** Compare matching cohorts; never pool a demo with live usage or different prompts. */
export function summarizeSessions(raw: unknown[]) {
  const seen = new Map<string, string>();
  let duplicates = 0;
  const sessions = raw.map(sessionMetrics).filter(session => {
    if (!session.attemptId) return true;
    const fingerprint = JSON.stringify(session);
    const previous = seen.get(session.attemptId);
    if (previous !== undefined) {
      if (previous !== fingerprint) throw new Error("Conflicting exports for the same attempt; select one snapshot.");
      duplicates++;
      return false;
    }
    seen.set(session.attemptId, fingerprint);
    return true;
  });
  const groups = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = JSON.stringify([session.mode, session.model, session.promptVersion]);
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  return {
    schemaVersion: 1,
    imported: raw.length,
    duplicateExportsExcluded: duplicates,
    unidentifiableExports: sessions.filter(session => !session.attemptId).length,
    cohorts: [...groups.values()].map(group => {
      const complete = group.filter(session => session.complete);
      const ended = complete.filter(session => session.ended);
      const evaluations = complete.reduce((sum, session) => sum + session.evaluations, 0);
      const unavailable = complete.reduce((sum, session) => sum + session.unavailable, 0);
      return {
        mode: group[0].mode,
        model: group[0].model,
        promptVersion: group[0].promptVersion,
        attempts: group.length,
        completeDiagnosticExports: complete.length,
        excludedIncompleteExports: group.length - complete.length,
        observedRecordingFailureAttempts: group.filter(session => session.recordingFailed).length,
        observedProviderFailureAttempts: group.filter(session => session.providerFailed).length,
        unfinishedExports: complete.length - ended.length,
        startupSuccess: ratio(ended.filter(session => session.started).length, ended.length),
        confirmedFinalization: ratio(ended.filter(session => session.finalized).length, ended.length),
        evaluatorUnavailable: ratio(unavailable, evaluations),
        staleEvaluationsExcluded: complete.reduce((sum, session) => sum + session.stale, 0),
        startupMs: distribution(complete.map(session => session.startupMs).filter(nonnegative)),
        activeDurationMs: distribution(complete.map(session => session.durationMs).filter(nonnegative)),
        evaluatorLatencyMs: distribution(complete.flatMap(session => session.evaluatorLatencyMs)),
        turnEndToDisplayMs: distribution(complete.flatMap(session => session.turnEndToDisplayMs)),
        // Neither diagnostic silence nor session length proves these outcomes.
        audibleResponseLatencyMs: null,
        cost: null,
        learningOutcome: null,
        parentRepairMinutes: null,
      };
    }),
  };
}
