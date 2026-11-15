"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { BookIcon, CameraIcon, CheckIcon, ShieldIcon } from "@/components/icons";
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

/** Splits into paragraph/list blocks on blank lines, preserving line breaks within each block. */
function splitContentBlocks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function SessionClient({
  goalId,
  weekTitle,
  targetMinutes,
  verifiedMinutesSoFar,
  isFamilyGoal = false,
  content = null,
  isBookFinished = false,
  checkpoint,
}: {
  goalId: string;
  weekTitle: string;
  targetMinutes: number;
  verifiedMinutesSoFar: number;
  isFamilyGoal?: boolean;
  content?: string | null;
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

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] px-6 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-faint)]">
          <ShieldIcon width={16} height={16} className="text-[var(--color-accent)]" />
          {weekTitle}
        </span>
        <span className="font-mono text-xs text-[var(--color-text-faint)]">
          {projectedTotal} / {targetMinutes} min target
        </span>
      </div>

      {isBookFinished ? (
        <div className="mt-4 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-4 text-sm text-[var(--color-text)]">
          You&rsquo;ve finished this book! Spend this session reviewing what stuck with you most.
        </div>
      ) : (
        content && (
          <div className="mt-4 flex max-h-[48vh] flex-col overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-2">
              <BookIcon width={18} height={18} className="text-[var(--color-accent)]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                Today&rsquo;s material
              </span>
            </div>
            <div className="flex flex-col gap-4 text-base leading-7 text-[var(--color-text)]">
              {splitContentBlocks(content).map((block, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {block}
                </p>
              ))}
            </div>
          </div>
        )
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
            presentNow && !tapChallenge
              ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
              : "bg-[var(--color-warn)]/15 text-[var(--color-warn)]"
          }`}
        >
          {tapChallenge
            ? "Quick check — tap below to confirm you're still here"
            : presentNow
              ? "We can see you — timer running"
              : "We can't see you — come back!"}
        </div>

        <div className="font-mono text-7xl font-semibold tabular-nums sm:text-8xl">
          {formatClock(verifiedSeconds)}
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Verified reading time this session</p>

        <div className="relative h-40 w-52 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {cameraState === "granted" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover [transform:scaleX(-1)]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
              <CameraIcon width={22} height={22} className="text-[var(--color-text-faint)]" />
              <p className="text-xs text-[var(--color-text-faint)]">
                {cameraState === "requesting"
                  ? "Requesting camera…"
                  : "Camera unavailable — we'll use periodic taps to verify you're here."}
              </p>
            </div>
          )}
        </div>
        {recordingClip && (
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-faint)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-danger)]" />
            Recording a short clip for your parent…
          </p>
        )}
      </div>

      <div className="flex justify-center pb-4">
        <Button variant="secondary" size="lg" onClick={requestEndSession} disabled={ending}>
          {ending ? "Saving…" : "End session"}
        </Button>
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
