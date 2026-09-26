import { ANSWER_QUESTION, ANSWER_QUESTION_ID, answerState } from "./answer";
import type { Scene } from "./lesson";
import { jevConnection } from "./jev-connection.mjs";

// Server-only. Asks TypeSafe's Jev the single Noul question defined in
// lib/answer.ts. The credential and every provider response body stay here.

export { OPENROUTER_JEV_MODEL, jevConnection } from "./jev-connection.mjs";
/**
 * Pinned rather than `jev-latest`, so the tuned threshold cannot shift when a
 * new release ships. `jev-latest` resolved to this version on 2026-09-23.
 */
export { JEV_MODEL } from "./answer";

export type JevOutcome =
  | { ok: true; probability: number; model: string }
  | { ok: false; reason: "unconfigured" | "rejected" | "unreadable" | "unreachable" };

export { answerState } from "./answer";

function readNoul(body: unknown): number | null {
  const response = body as { answers?: Record<string, { noul?: unknown }> } | null;
  const noul = response?.answers?.[ANSWER_QUESTION_ID]?.noul;
  return typeof noul === "number" && Number.isFinite(noul) && noul >= 0 && noul <= 1 ? noul : null;
}

export async function evaluateCount(scene: Scene, utterance: string, signal: AbortSignal): Promise<JevOutcome> {
  const connection = jevConnection();
  if (!connection) return { ok: false, reason: "unconfigured" };
  let response: Response;
  try {
    response = await fetch(connection.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${connection.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: connection.model,
        state: answerState(scene, utterance),
        questions: { [ANSWER_QUESTION_ID]: ANSWER_QUESTION },
      }),
      signal,
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  // Provider bodies can echo the state; never forward or log them.
  if (!response.ok) return { ok: false, reason: "rejected" };
  const body: unknown = await response.json().catch(() => null);
  const probability = readNoul(body);
  if (probability === null) return { ok: false, reason: "unreadable" };
  const model = (body as { model?: unknown }).model;
  return { ok: true, probability, model: typeof model === "string" ? model : connection.model };
}
