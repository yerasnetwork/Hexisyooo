"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { CameraIcon, CheckIcon, ShieldIcon } from "@/components/icons";
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
  weekTitle,
  targetMinutes,
  verifiedMinutesSoFar,
  isFamilyGoal = false,
  content = null,
  isBookFinished = false,
}: {
  goalId: string;
  weekTitle: string;
  targetMinutes: number;
  verifiedMinutesSoFar: number;
  isFamilyGoal?: boolean;
  content?: string | null;
  isBookFinished?: boolean;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const verifiedSecondsRef = useRef(0);
  const endingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [presentNow, setPresentNow] = useState(true);
  const [tapChallenge, setTapChallenge] = useState(false);
  const [challengeRound, setChallengeRound] = useState(0);
  const [verifiedSeconds, setVerifiedSeconds] = useState(0);
  const [ending, setEnding] = useState(false);
  const [recordingClip, setRecordingClip] = useState(false);

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

  async function endSession() {
    if (endingRef.current) return;
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
          <div className="mt-4 flex max-h-[38vh] flex-col overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <span className="mb-2 text-xs font-medium text-[var(--color-text-faint)]">
              Today&rsquo;s material
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
              {content}
            </p>
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
        <Button variant="secondary" size="lg" onClick={endSession} disabled={ending}>
          {ending ? "Saving…" : "End session"}
        </Button>
      </div>

      {tapChallenge && (
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
