"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceDetector } from "@mediapipe/tasks-vision";

type DetectorState = "loading" | "ready" | "unavailable";

const PACKAGE_VERSION = "1.2.3";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${PACKAGE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

/**
 * Loads MediaPipe's short-range face detector from a CDN (no model weights
 * committed to the repo). Scoped to one question only: is a human face
 * currently present in front of the camera. Not used for identity, gaze, or
 * content analysis.
 */
export function useFaceDetector() {
  const detectorRef = useRef<FaceDetector | null>(null);
  const [state, setState] = useState<DetectorState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { FaceDetector: FaceDetectorClass, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        const detector = await FaceDetectorClass.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  /** Returns true/false when a reading could be taken, or null if the detector isn't ready. */
  function detectFace(video: HTMLVideoElement): boolean | null {
    const detector = detectorRef.current;
    if (state !== "ready" || !detector || video.readyState < 2) return null;
    try {
      const result = detector.detectForVideo(video, performance.now());
      return result.detections.length > 0;
    } catch {
      return null;
    }
  }

  return { state, detectFace };
}
