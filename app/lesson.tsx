"use client";

import { useEffect, useRef, useState } from "react";
import { fetchEvaluateAnswer } from "@/lib/answer";
import { ConvexSessionRecorder } from "@/lib/convex-session-recorder";
import { BrowserTransport } from "@/lib/browser-transport";
import { DemoTransport, evaluateDemoAnswer } from "@/lib/demo-transport";
import { OBJECTS, objectName, sceneAt } from "@/lib/lesson";
import { LessonSession, type Diagnostic, type Snapshot } from "@/lib/session";
import { SessionInspector } from "./session-inspector";
import type { DurableSessionRef, SessionRecordReader } from "@/lib/session-recorder";
import { JevDiagnostics } from "./jev-diagnostics";

function Scene({ index }: { index: number }) {
  const scene = sceneAt(index);
  return (
    <div className="scene" data-scene={scene.id} role="img" aria-label={`A group of ${objectName(scene)} to count`}>
      {Array.from({ length: scene.quantity }, (_, position) => (
        <span aria-hidden="true" key={`${scene.id}-${position}`}>
          {OBJECTS[scene.object].emoji}
        </span>
      ))}
    </div>
  );
}

export default function Lesson({ debug, demo = false }: { debug: boolean; demo?: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [diagnosticEvents, setDiagnosticEvents] = useState<readonly Diagnostic[]>([]);
  const [endedAttempt, setEndedAttempt] = useState<{ ref?: DurableSessionRef; reader: SessionRecordReader } | null>(
    null,
  );
  const audio = useRef<HTMLAudioElement>(null);
  const session = useRef<LessonSession | null>(null);
  const preview = useRef<DemoTransport | null>(null);
  const live = snapshot !== null && snapshot.status !== "ended";

  useEffect(() => {
    const hide = () => {
      if (document.hidden) session.current?.dispose();
    };
    const leave = () => session.current?.dispose();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      session.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!snapshot || !["active", "wrapping", "goodbye"].includes(snapshot.status)) return;
    const current = session.current;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => current?.displayed(snapshot.sceneIndex));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [snapshot]);

  function start(retryOf?: DurableSessionRef) {
    if (!audio.current || (session.current && session.current.snapshot.status !== "ended")) return;
    session.current?.dispose();
    const recorder = demo ? undefined : new ConvexSessionRecorder();
    preview.current = demo ? new DemoTransport() : null;
    const previousAttemptId = session.current?.attemptId;
    setEndedAttempt(null);
    const current = new LessonSession(
      preview.current ?? new BrowserTransport(audio.current),
      demo ? evaluateDemoAnswer : fetchEvaluateAnswer,
      snapshot => {
        if (session.current === current) {
          setSnapshot(snapshot);
          if (snapshot.status === "ended" && recorder)
            setEndedAttempt({ ref: snapshot.durableSessionRef, reader: recorder });
        }
      },
      () => {
        if (session.current === current) setDiagnosticEvents([...current.events]);
      },
      recorder,
      retryOf,
      { mode: demo ? "synthetic_demo" : "live", previousAttemptId },
    );
    session.current = current;
    setDiagnosticEvents([]);
    void current.start();
  }
  function download() {
    if (!session.current) return;
    const report = session.current.report(navigator.userAgent);
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sprout-attempt-${session.current.createdAt}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className={live ? "sprout live" : "sprout"}>
      <audio ref={audio} aria-hidden="true" />
      {snapshot?.recordingError && (
        <p role="alert" className="error">
          {snapshot.recordingError}
        </p>
      )}
      <header className="brand">
        <span aria-hidden="true">✳</span> sprout
      </header>
      {demo && (
        <p className="demo-banner">Developer preview · Synthetic answers · No microphone, voice, or API calls</p>
      )}
      {live ? (
        <>
          <button className="end-button" onClick={() => session.current?.end("parent_stop")}>
            End lesson
          </button>
          <section className="play-space" aria-label="Counting garden">
            <div className="character" role="img" aria-label="Sprout">
              <span className="leaf">🌱</span>
              <span className="face">◡</span>
            </div>
            {snapshot.status === "starting" ? (
              <p className="connecting" role="status">
                Getting ready to play…
              </p>
            ) : (
              <Scene index={snapshot.sceneIndex} />
            )}
            {demo && snapshot.status === "active" && (
              <section className="demo-controls" aria-label="Synthetic answers">
                <p>Try a number, then wait for the scene. Use End lesson when finished.</p>
                {[1, 2, 3, 4, 5].map(quantity => (
                  <button key={quantity} onClick={() => preview.current?.answer(quantity)}>
                    Try {quantity}
                  </button>
                ))}
              </section>
            )}
          </section>
        </>
      ) : (
        <section className="welcome">
          <div className="character" role="img" aria-label="Sprout">
            <span className="leaf">🌱</span>
            <span className="face">◡</span>
          </div>
          <p className="eyebrow">A LITTLE TIME TO WONDER</p>
          <h1>{snapshot ? "Bye for now." : "Small discoveries.\nTogether."}</h1>
          {snapshot?.error ? (
            <p className="error" role="alert">
              {snapshot.error}
            </p>
          ) : (
            <p className="intro">
              {snapshot
                ? "The microphone and voice playback are off."
                : demo
                  ? "Explore the counting scenes with scripted number buttons. This preview does not evaluate speech or demonstrate learning."
                  : "A gentle counting adventure with Sprout. Just your voice, a few little friends, and room to think."}
            </p>
          )}
          {snapshot?.reason === "page_hidden" && (
            <p className="parent-note">
              The lesson ended because the page was hidden. Keep this window open during play.
            </p>
          )}
          <button className="start-button" onClick={() => start()}>
            {snapshot ? "Start a new lesson" : "Start counting together"}
            <span aria-hidden="true">↗</span>
          </button>
          <div className="parent-note">
            <p>For a parent and child · About 5 minutes · Quantities 1–5</p>
            <p hidden={demo}>
              Stay together, allow the microphone, and keep this tab visible. Sprout is an AI voice; audio is sent to
              OpenAI during play and retained in Sprout’s private session record for review. You can end at any time.
            </p>
            {!demo && (
              <p>
                <a href="/demo">Try the developer preview without API keys</a>
              </p>
            )}
          </div>
          {endedAttempt && (
            <SessionInspector
              key={endedAttempt.ref ?? "unavailable"}
              sessionRef={endedAttempt.ref}
              reader={endedAttempt.reader}
              onRetry={ref => start(ref)}
            />
          )}
          {snapshot && (
            <details className="diagnostics">
              <summary>Parent testing notes · Prototype diagnostics</summary>
              <p>
                Ended: {snapshot.reason?.replaceAll("_", " ")}. Download approximate transcripts, displayed scenes,
                timing, and connection events before starting again. These stay in this tab and are lost on reload. The
                private durable session record includes full-session audio when recording succeeds. No learning
                assessment is saved.
              </p>
              <button className="download-button" onClick={download}>
                Download attempt diagnostics
              </button>
            </details>
          )}
        </section>
      )}
      {!live && <footer>One small adventure at a time.</footer>}
      {debug && <JevDiagnostics events={diagnosticEvents} />}
    </main>
  );
}
