"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { CameraIcon, CheckIcon } from "@/components/icons";
import { useFaceDetector } from "@/lib/useFaceDetector";

type CameraState = "requesting" | "granted" | "denied";

const FACE_CHECK_INTERVAL_MS = 45_000;
const TAP_CHALLENGE_MIN_MS = 60_000;
const TAP_CHALLENGE_MAX_MS = 120_000;
const TAP_CHALLENGE_TIMEOUT_MS = 25_000;
const CLIP_DURATION_MS = 12_000;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SessionClient({
  goalId,
  sectionTitle,
  sectionIndex,
  totalSections,
  targetMinutes,
  verifiedMinutesSoFar,
  isFamilyGoal = false,
  paragraphs,
  isBookFinished = false,
  checkpoint,
}: {
  goalId: string;
  sectionTitle: string;
  sectionIndex: number;
  totalSections: number;
  targetMinutes: number;
  verifiedMinutesSoFar: number;
  isFamilyGoal?: boolean;
  paragraphs: string[];
  isBookFinished?: boolean;
  checkpoint: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const verifiedSecondsRef = useRef(0);
  const endingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedRef = useRef(false);
  const autoPromptShownRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [presentNow, setPresentNow] = useState(true);
  const [tapChallenge, setTapChallenge] = useState(false);
  const [challengeRound, setChallengeRound] = useState(0);
  const [verifiedSeconds, setVerifiedSeconds] = useState(0);
  const [ending, setEnding] = useState(false);
  const [recordingClip, setRecordingClip] = useState(false);
  const [endGateOpen, setEndGateOpen] = useState(false);
  const [checkpointAnswer, setCheckpointAnswer] = useState("");

  const { state: detectorState, detectFace } = useFaceDetector();

  // Start the session record regardless of camera outcome.
  useEffect(() => {
    fetch(`/api/goals/${goalId}/session/start`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        sessionIdRef.current = data.sessionId ?? null;
      })
      .catch(() => {});
  }, [goalId]);

  // Request the webcam.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraState("granted");
      })
      .catch(() => {
        if (!cancelled) setCameraState("denied");
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function waitForSessionId(timeoutMs = 5000): Promise<string | null> {
    const start = Date.now();
    while (!sessionIdRef.current && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return sessionIdRef.current;
  }

  async function uploadClip(blob: Blob) {
    const sessionId = await waitForSessionId();
    if (!sessionId) return;
    const form = new FormData();
    form.append("sessionId", sessionId);
    form.append("file", blob, "clip.webm");
    fetch(`/api/goals/${goalId}/session/clip`, { method: "POST", body: form }).catch(() => {});
  }

  // Family mode only: record one short clip at the start of the session (not
  // a continuous stream) so a parent can see their child actually reading.
  useEffect(() => {
    if (!isFamilyGoal || cameraState !== "granted" || recordingStartedRef.current) return;
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    recordingStartedRef.current = true;

    const mimeType = ["video/webm;codecs=vp8,opus", "video/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t)
    );
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      return;
    }
    recorderRef.current = recorder;
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      setRecordingClip(false);
      uploadClip(new Blob(chunks, { type: mimeType ?? "video/webm" }));
    };

    // Kicks off the clip recording as soon as the camera stream is ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecordingClip(true);
    recorder.start();
    const stopHandle = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, CLIP_DURATION_MS);

    return () => clearTimeout(stopHandle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFamilyGoal, cameraState]);

  // Periodic face-presence check (only meaningful once camera + detector are ready).
  useEffect(() => {
    if (cameraState !== "granted" || detectorState !== "ready") return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const result = detectFace(video);
      if (result === true) setPresentNow(true);
      if (result === false) setPresentNow(false);
    }, FACE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cameraState, detectorState, detectFace]);

  // Tap-to-confirm fallback: fires regardless of whether face detection works,
  // so the session stays verifiable even if the camera or model misbehaves.
  // Re-armed via challengeRound each time the previous challenge is resolved.
  useEffect(() => {
    const delay = randomBetween(TAP_CHALLENGE_MIN_MS, TAP_CHALLENGE_MAX_MS);
    const timeoutHandle = setTimeout(() => {
      setTapChallenge(true);
    }, delay);
    return () => clearTimeout(timeoutHandle);
  }, [challengeRound]);

  // While a challenge is showing, mark the user absent if they take too long to tap.
  useEffect(() => {
    if (!tapChallenge) return;
    const failsafeHandle = setTimeout(() => {
      setPresentNow(false);
    }, TAP_CHALLENGE_TIMEOUT_MS);
    return () => clearTimeout(failsafeHandle);
  }, [tapChallenge]);

  function confirmTap() {
    setTapChallenge(false);
    setPresentNow(true);
    setChallengeRound((n) => n + 1);
  }

  // The 1-second timer. Only counts while present and no pending tap challenge.
  useEffect(() => {
    if (cameraState === "requesting") return;
    const interval = setInterval(() => {
      if (presentNow && !tapChallenge && !endingRef.current) {
        verifiedSecondsRef.current += 1;
        setVerifiedSeconds(verifiedSecondsRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cameraState, presentNow, tapChallenge]);

  // Once the target is hit, prompt the checkpoint once — the user can still
  // dismiss it and keep reading; manually clicking "End session" always
  // opens the same gate regardless of this auto-prompt.
  useEffect(() => {
    if (autoPromptShownRef.current || tapChallenge || targetMinutes <= 0) return;
    if (verifiedSeconds >= targetMinutes * 60) {
      autoPromptShownRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEndGateOpen(true);
    }
  }, [verifiedSeconds, targetMinutes, tapChallenge]);

  function requestEndSession() {
    setEndGateOpen(true);
  }

  function dismissEndGate() {
    setEndGateOpen(false);
  }

  async function finishSession() {
    if (!checkpointAnswer.trim() || endingRef.current) return;
    endingRef.current = true;
    setEnding(true);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const verifiedMinutes = Math.round(verifiedSecondsRef.current / 60);
    try {
      if (sessionIdRef.current) {
        await fetch(`/api/goals/${goalId}/session/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current, verifiedMinutes }),
        });
      }
    } finally {
      router.push(`/goal/${goalId}`);
    }
  }

  const totalVerifiedThisSession = Math.floor(verifiedSeconds / 60);
  const projectedTotal = verifiedMinutesSoFar + totalVerifiedThisSession;

  const presence = tapChallenge
    ? { label: "Confirm presence", tone: "warn" as const }
    : presentNow
      ? { label: "Present", tone: "accent" as const }
      : { label: "Away", tone: "warn" as const };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      {/* Slim top bar: section context, presence, timer, end session — stays
          out of the way of the reading itself. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">{sectionTitle}</p>
          <p className="font-mono text-xs text-[var(--color-text-faint)]">
            Section {sectionIndex} of {totalSections}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              presence.tone === "accent"
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "bg-[var(--color-warn)]/15 text-[var(--color-warn)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                presence.tone === "accent" ? "bg-[var(--color-accent)]" : "bg-[var(--color-warn)]"
              }`}
            />
            {presence.label}
          </span>
          <span className="font-mono text-sm tabular-nums text-[var(--color-text)]">
            {formatClock(verifiedSeconds)}
          </span>
          <span className="hidden font-mono text-xs text-[var(--color-text-faint)] sm:inline">
            / {targetMinutes} min ({projectedTotal} so far)
          </span>
          <Button variant="secondary" size="md" onClick={requestEndSession} disabled={ending}>
            {ending ? "Saving…" : "End session"}
          </Button>
        </div>
      </div>

      {/* The book page — the hero of the screen. Extra bottom padding keeps
          the fixed webcam thumbnail from sitting over the last lines. */}
      <div className="flex flex-1 justify-center px-4 pb-28 pt-10 sm:px-8 sm:pb-32 sm:pt-14">
        <div
          className="w-full max-w-[720px] rounded-sm bg-[var(--color-paper)] px-7 py-12 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:px-16 sm:py-16"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isBookFinished ? (
            <div className="text-center">
              <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-paper-muted)]">
                The end
              </p>
              <h1 className="text-3xl font-semibold text-[var(--color-paper-ink)] sm:text-4xl">
                You&rsquo;ve finished this book!
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-[var(--color-paper-ink)]/80">
                Spend this session reviewing what stuck with you most.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-paper-muted)]">
                Section {sectionIndex} of {totalSections}
              </p>
              <h1 className="mb-10 text-3xl font-semibold leading-tight text-[var(--color-paper-ink)] sm:text-4xl">
                {sectionTitle}
              </h1>
              <div className="text-[20px] leading-[1.75] text-[var(--color-paper-ink)] sm:text-[22px]">
                {paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className={`mb-6 last:mb-0 ${
                      i === 0
                        ? "first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[4.2rem] first-letter:leading-[0.8] first-letter:font-semibold"
                        : ""
                    }`}
                  >
                    {p}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Small, always-mounted webcam thumbnail so face detection keeps running. */}
      <div className="fixed bottom-3 right-3 z-20 h-16 w-14 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] sm:bottom-4 sm:right-4 sm:h-28 sm:w-24">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover [transform:scaleX(-1)] ${
            cameraState === "granted" ? "" : "hidden"
          }`}
        />
        {cameraState !== "granted" && (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-1 text-center">
            <CameraIcon width={16} height={16} className="text-[var(--color-text-faint)]" />
            <p className="text-[9px] leading-tight text-[var(--color-text-faint)]">
              {cameraState === "requesting" ? "Requesting…" : "Using taps instead"}
            </p>
          </div>
        )}
        {recordingClip && (
          <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
        )}
      </div>

      {endGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                Before you finish
              </p>
              <p className="text-base font-medium">
                {checkpoint || "Summarize what you focused on this session in a sentence or two."}
              </p>
            </div>
            <textarea
              autoFocus
              value={checkpointAnswer}
              onChange={(e) => setCheckpointAnswer(e.target.value)}
              disabled={ending}
              rows={4}
              placeholder="Type your answer…"
              className="w-full resize-none rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={dismissEndGate} disabled={ending} className="flex-1">
                Keep reading
              </Button>
              <Button
                onClick={finishSession}
                disabled={!checkpointAnswer.trim() || ending}
                className="flex-1"
              >
                {ending ? "Saving…" : "Finish session"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tapChallenge && !endGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-lg)]">
            <p className="text-base font-medium">Still reading?</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Tap to confirm you&rsquo;re still here. The timer is paused until you do.
            </p>
            <Button size="lg" onClick={confirmTap} className="w-full">
              <CheckIcon width={18} height={18} />
              I&rsquo;m here
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
