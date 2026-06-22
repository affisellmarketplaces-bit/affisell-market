"use client"

import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision"

export type PoseCheckResult =
  | { ok: true }
  | { ok: false; message: string }

const SHOULDER_IDX = 11
const HIP_IDX = 23
const NOSE_IDX = 0
const LEFT_WRIST = 15
const RIGHT_WRIST = 16

function visibility(landmarks: PoseLandmarkerResult["landmarks"][number] | undefined, idx: number): number {
  const pt = landmarks?.[idx]
  if (!pt) return 0
  return pt.visibility ?? 0
}

/** Warn when pose reduces IDM-VTON success (face camera, arms down). */
export function evaluatePoseFromLandmarks(
  landmarks: PoseLandmarkerResult["landmarks"][number] | undefined
): PoseCheckResult {
  if (!landmarks || landmarks.length < 25) {
    return { ok: false, message: "Stand fully in frame so we can detect your pose." }
  }

  const noseVis = visibility(landmarks, NOSE_IDX)
  const shoulderVis = Math.min(visibility(landmarks, SHOULDER_IDX), visibility(landmarks, 12))
  const hipVis = Math.min(visibility(landmarks, HIP_IDX), visibility(landmarks, 24))

  if (noseVis < 0.5 || shoulderVis < 0.45 || hipVis < 0.4) {
    return {
      ok: false,
      message: "Face the camera with your upper body visible (head to hips).",
    }
  }

  const leftShoulder = landmarks[SHOULDER_IDX]
  const rightShoulder = landmarks[12]
  const shoulderSpan = Math.abs((rightShoulder?.x ?? 0) - (leftShoulder?.x ?? 0))
  if (shoulderSpan < 0.12) {
    return {
      ok: false,
      message: "Turn to face the camera directly — shoulders should be visible.",
    }
  }

  const leftWrist = landmarks[LEFT_WRIST]
  const rightWrist = landmarks[RIGHT_WRIST]
  const shoulderY = ((leftShoulder?.y ?? 0) + (rightShoulder?.y ?? 0)) / 2
  const wristsHigh =
    (leftWrist && (leftWrist.y ?? 1) < shoulderY - 0.05 && visibility(landmarks, LEFT_WRIST) > 0.4) ||
    (rightWrist && (rightWrist.y ?? 1) < shoulderY - 0.05 && visibility(landmarks, RIGHT_WRIST) > 0.4)

  if (wristsHigh) {
    return {
      ok: false,
      message: "Relax your arms down at your sides for a clearer try-on.",
    }
  }

  return { ok: true }
}

let poseLandmarkerPromise: Promise<import("@mediapipe/tasks-vision").PoseLandmarker> | null = null

async function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision")
      const { PoseLandmarker, FilesetResolver } = vision
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      )
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 1,
      })
    })()
  }
  return poseLandmarkerPromise
}

export async function checkPoseFromImageFile(file: File): Promise<PoseCheckResult> {
  if (typeof window === "undefined") return { ok: true }
  const bitmap = await createImageBitmap(file)
  try {
    const landmarker = await getPoseLandmarker()
    const result = landmarker.detect(bitmap)
    return evaluatePoseFromLandmarks(result.landmarks[0])
  } finally {
    bitmap.close()
  }
}
