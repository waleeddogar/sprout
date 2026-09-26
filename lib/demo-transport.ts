import type { EvaluateAnswer } from "./answer";
import type { ClientCommand, ProviderEvent } from "./events";
import { sceneAt } from "./lesson";
import type { Transport } from "./session";

/** A deterministic developer preview: no microphone, provider, speech or fetch. */
export class DemoTransport implements Transport {
  private onEvent?: (event: ProviderEvent) => void;
  private stopped = false;
  private turnAt = 0;

  async start(onEvent: (event: ProviderEvent) => void) {
    if (this.stopped) return;
    this.onEvent = onEvent;
    onEvent({ type: "session.started" });
  }

  answer(quantity: number) {
    if (this.stopped || !this.onEvent || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) return;
    // Synthetic transcript clock: each button is a distinct complete utterance,
    // even when clicked rapidly. Wall-clock controller timing is unchanged.
    const at = (this.turnAt += 3000);
    this.onEvent({ type: "transcript", speaker: "child", delta: String(quantity), startMs: at, endMs: at });
  }

  send(command: ClientCommand) {
    if (command.type === "session.close")
      queueMicrotask(() => this.onEvent?.({ type: "session.closed", reason: "demo" }));
  }

  setOutputBlocked() {}
  stopMedia() {
    this.stopped = true;
  }
  close() {
    this.stopMedia();
  }
}

/** Buttons provide a number, not interpreted speech. Never use this for real voice. */
export const evaluateDemoAnswer: EvaluateAnswer = async ({ sceneIndex, utterance }, signal) => {
  if (signal.aborted) return { status: "unavailable", reason: "cancelled", latencyMs: 0 };
  const answer = utterance.trim();
  return {
    status: "evaluated",
    model: "synthetic-demo",
    latencyMs: 0,
    probability: /^[1-5]$/.test(answer) && Number(answer) === sceneAt(sceneIndex).quantity ? 1 : 0,
  };
};
