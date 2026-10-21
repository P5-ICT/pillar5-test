"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Brief } from "@/components/Brief";
import { Header, type SaveState } from "@/components/Header";
import { Interlude } from "@/components/Interlude";
import { Landing } from "@/components/Landing";
import { Results } from "@/components/Results";
import { SectionA } from "@/components/SectionA";
import { SectionB } from "@/components/SectionB";
import {
  ApiError, getAttempt, getConfig, removeFile, saveAnswer, startAttempt, studentToken, submitAttempt, uploadFile,
} from "@/lib/api";
import { useCountdown } from "@/lib/useCountdown";
import type { AttemptState, FileInfo, PublicConfig } from "@/lib/types";

type Screen = "loading" | "offline" | "intro" | "brief" | "test" | "results";
type Step = "A" | "move" | "B";

const UI_KEY = "p5.ui";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

function numberKeys(answers: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(answers)) out[Number(k)] = v;
  return out;
}

/** Try a request a few times when the network or server hiccups. A 4xx answer is final. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw last;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [step, setStep] = useState<Step>("A");
  const [qi, setQi] = useState(0);
  const [save, setSave] = useState<SaveState>("saved");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const failedRef = useRef<Map<number, number>>(new Map());

  /* ---------- load ---------- */
  const applyState = useCallback((state: AttemptState, token: string, restoreUi: boolean) => {
    tokenRef.current = token;
    setAttempt(state);
    setAnswers(numberKeys(state.answers));
    setFiles(state.files);
    if (state.status === "submitted") {
      setScreen("results");
      return;
    }
    if (restoreUi) {
      try {
        const ui = JSON.parse(localStorage.getItem(UI_KEY) ?? "null");
        if (ui && (ui.step === "A" || ui.step === "move" || ui.step === "B")) setStep(ui.step);
        if (ui && Number.isInteger(ui.qi)) setQi(Math.min(Math.max(ui.qi, 0), (state.questions?.length ?? 1) - 1));
      } catch {
        /* a missing or broken saved position just starts at question 1 */
      }
    }
    setScreen("test");
  }, []);

  const boot = useCallback(async () => {
    setScreen("loading");
    getConfig().then(setConfig).catch(() => {});
    const token = studentToken.get();
    if (!token) {
      setScreen("intro");
      return;
    }
    try {
      applyState(await getAttempt(token), token, true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setScreen("offline");
        return;
      }
      studentToken.set(null);
      setScreen("intro");
    }
  }, [applyState]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    document.body.classList.toggle("stagey", ["loading", "offline", "intro", "brief"].includes(screen));
  }, [screen]);

  useEffect(() => {
    if (screen !== "test") return;
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ step, qi }));
    } catch {
      /* ignore */
    }
  }, [screen, step, qi]);

  /* ---------- start ---------- */
  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const { token, attempt: state } = await startAttempt(first.trim(), last.trim());
      studentToken.set(token);
      setStep("A");
      setQi(0);
      applyState(state, token, false);
    } catch (e) {
      setStartError(messageOf(e));
    } finally {
      setStarting(false);
    }
  }

  /* ---------- answers: saved to the server as they are chosen ---------- */
  async function refreshFromServer() {
    if (!tokenRef.current) return;
    try {
      applyState(await getAttempt(tokenRef.current), tokenRef.current, false);
    } catch {
      /* the next action will show the problem */
    }
  }

  function pick(questionId: number, choice: number) {
    setAnswers((a) => ({ ...a, [questionId]: choice }));
    setSave("saving");
    // One at a time, in order, so a quick change of mind can never arrive out of order.
    queueRef.current = queueRef.current.then(async () => {
      try {
        await withRetry(() => saveAnswer(tokenRef.current!, questionId, choice));
        failedRef.current.delete(questionId);
        if (failedRef.current.size === 0) setSave("saved");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          await refreshFromServer(); // time is up or already submitted
        } else {
          failedRef.current.set(questionId, choice);
          setSave("error");
        }
      }
    });
  }

  function retryFailed() {
    const pending = Array.from(failedRef.current.entries());
    for (const [questionId, choice] of pending) pick(questionId, choice);
  }

  /* ---------- files ---------- */
  async function addFiles(list: File[]) {
    if (!tokenRef.current) return;
    setUploading(true);
    const notes: string[] = [];
    for (const file of list) {
      try {
        const result = await uploadFile(tokenRef.current, file);
        setFiles(result.files);
        if (result.skipped?.length) {
          notes.push(`From ${file.name}, these were skipped because they are not code files: ${result.skipped.join(", ")}.`);
        }
      } catch (e) {
        notes.push(messageOf(e));
      }
    }
    setFileNote(notes.length ? notes.join(" ") : null);
    setUploading(false);
  }

  async function dropFile(id: number) {
    if (!tokenRef.current) return;
    try {
      const result = await removeFile(tokenRef.current, id);
      setFiles(result.files);
      setFileNote(null);
    } catch (e) {
      setFileNote(messageOf(e));
    }
  }

  /* ---------- submit ---------- */
  async function submit() {
    if (submitting || !tokenRef.current) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await queueRef.current; // let any answer still being saved finish first
      for (const [questionId, choice] of Array.from(failedRef.current.entries())) {
        try {
          await saveAnswer(tokenRef.current, questionId, choice);
          failedRef.current.delete(questionId);
        } catch {
          /* the submit below shows the real problem if the server is unreachable */
        }
      }
      const state = await withRetry(() => submitAttempt(tokenRef.current!));
      try {
        localStorage.removeItem(UI_KEY);
      } catch {
        /* ignore */
      }
      applyState(state, tokenRef.current, false);
    } catch (e) {
      setSubmitError(messageOf(e));
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = useCountdown(
    screen === "test" ? attempt?.deadline_at ?? null : null,
    screen === "test" ? attempt?.server_time ?? null : null,
    () => {
      submit();
    },
  );

  /* ---------- render ---------- */
  const questions = attempt?.questions ?? [];
  const answered = Object.keys(answers).length;
  const showHeader = screen === "test" || screen === "results";

  return (
    <>
      {showHeader && (
        <Header
          hud={
            screen === "test"
              ? {
                  remainingMs: remaining,
                  answered,
                  total: questions.length,
                  onSectionB: step === "B",
                  save,
                  onRetry: retryFailed,
                }
              : undefined
          }
        />
      )}
      <main className="wrap">
        {screen === "loading" && <div className="loading">Loading...</div>}

        {screen === "offline" && (
          <div className="stage">
            <div className="card">
              <h1 className="card-h">We could not reach the server</h1>
              <p className="sub">Check your internet connection. Your test is safe and your time is kept by the server.</p>
              <button className="btn block" onClick={boot}>Try again</button>
            </div>
          </div>
        )}

        {screen === "intro" && (
          <Landing first={first} last={last} setFirst={setFirst} setLast={setLast} onContinue={() => setScreen("brief")} />
        )}

        {screen === "brief" && (
          <Brief first={first.trim()} config={config} starting={starting} error={startError} onStart={start} onBack={() => setScreen("intro")} />
        )}

        {screen === "test" && attempt && step === "A" && (
          <SectionA
            questions={questions}
            answers={answers}
            index={qi}
            setIndex={(i) => {
              setQi(i);
              window.scrollTo(0, 0);
            }}
            onPick={pick}
            onFinish={() => {
              setStep("move");
              window.scrollTo(0, 0);
            }}
          />
        )}

        {screen === "test" && attempt && step === "move" && (
          <Interlude
            questions={questions}
            answers={answers}
            planMinutes={attempt.section_b?.plan_minutes ?? 90}
            onStartB={() => {
              setStep("B");
              window.scrollTo(0, 0);
            }}
            onReview={() => {
              setStep("A");
              window.scrollTo(0, 0);
            }}
          />
        )}

        {screen === "test" && attempt && step === "B" && attempt.section_b && (
          <SectionB
            section={attempt.section_b}
            files={files}
            maxFiles={attempt.limits.max_files}
            maxTotalBytes={attempt.limits.max_total_bytes}
            extensions={config?.allowed_extensions ?? ["py", "html", "js", "css", "txt", "json"]}
            note={fileNote}
            uploading={uploading}
            answered={answered}
            total={questions.length}
            submitting={submitting}
            submitError={submitError}
            onFiles={addFiles}
            onRemove={dropFile}
            onBack={() => {
              setStep("A");
              window.scrollTo(0, 0);
            }}
            onSubmit={submit}
          />
        )}

        {screen === "results" && attempt && <Results attempt={attempt} />}
      </main>
    </>
  );
}
