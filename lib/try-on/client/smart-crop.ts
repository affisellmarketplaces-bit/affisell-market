"use client"

export type SmartCropResult = {
  blob: Blob
  cropped: boolean
}

const TORSO_PAD = 0.08

/** Crop to torso region when full-body detected — reduces IDM-VTON latency ~40%. */
export async function smartCropUserPhoto(file: File): Promise<SmartCropResult> {
  if (typeof window === "undefined") {
    return { blob: file, cropped: false }
  }

  try {
    const vision = await import("@mediapipe/tasks-vision")
    const { PoseLandmarker, FilesetResolver } = vision
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    )
    const landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
    })

    const bitmap = await createImageBitmap(file)
    try {
      const result = landmarker.detect(bitmap)
      const lm = result.landmarks[0]
      if (!lm || lm.length < 25) {
        return { blob: file, cropped: false }
      }

      const xs = [11, 12, 23, 24].map((i) => lm[i]?.x).filter((v): v is number => typeof v === "number")
      const ys = [0, 11, 12, 23, 24].map((i) => lm[i]?.y).filter((v): v is number => typeof v === "number")
      if (xs.length < 2 || ys.length < 2) {
        return { blob: file, cropped: false }
      }

      const minX = Math.max(0, Math.min(...xs) - TORSO_PAD)
      const maxX = Math.min(1, Math.max(...xs) + TORSO_PAD)
      const minY = Math.max(0, Math.min(...ys) - TORSO_PAD)
      const maxY = Math.min(1, Math.max(...ys) + TORSO_PAD)

      const spanY = maxY - minY
      if (spanY > 0.92) {
        return { blob: file, cropped: false }
      }

      const canvas = document.createElement("canvas")
      const sx = Math.floor(minX * bitmap.width)
      const sy = Math.floor(minY * bitmap.height)
      const sw = Math.max(1, Math.floor((maxX - minX) * bitmap.width))
      const sh = Math.max(1, Math.floor((maxY - minY) * bitmap.height))
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext("2d")
      if (!ctx) return { blob: file, cropped: false }
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      )
      if (!blob) return { blob: file, cropped: false }
      return { blob, cropped: true }
    } finally {
      bitmap.close()
      landmarker.close()
    }
  } catch (err) {
    console.warn("[try-on]", {
      result: "smart_crop_fallback",
      message: err instanceof Error ? err.message : String(err),
    })
    return { blob: file, cropped: false }
  }
}
