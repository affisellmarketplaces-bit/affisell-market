"use client"

import { useEffect } from "react"

type Props = {
  imageUrls: readonly string[]
}

function scheduleIdleTask(run: () => void, idleTimeoutMs = 1200, fallbackDelayMs = 280): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: idleTimeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  const t = window.setTimeout(run, fallbackDelayMs)
  return () => window.clearTimeout(t)
}

/** Idle warmup — decode first grid images after hero paint without blocking LCP. */
export function HomeCatalogImageWarmup({ imageUrls }: Props) {
  useEffect(() => {
    if (imageUrls.length === 0) return

    return scheduleIdleTask(() => {
      for (const url of imageUrls) {
        const img = new Image()
        img.decoding = "async"
        img.src = url
      }
    })
  }, [imageUrls])

  return null
}
