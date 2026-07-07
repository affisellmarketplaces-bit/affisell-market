"use client"

import { useEffect } from "react"

import { scheduleIdleTask } from "@/lib/schedule-idle-task"

type Props = {
  imageUrls: readonly string[]
}

/** Idle warmup — decode first grid images after hero paint without blocking TBT. */
export function HomeCatalogImageWarmup({ imageUrls }: Props) {
  useEffect(() => {
    if (imageUrls.length === 0) return

    return scheduleIdleTask(() => {
      for (const url of imageUrls) {
        const img = new Image()
        img.decoding = "async"
        img.src = url
      }
    }, 1800, 500)
  }, [imageUrls])

  return null
}
