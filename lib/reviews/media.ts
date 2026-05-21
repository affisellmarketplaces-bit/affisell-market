import type { Prisma } from "@prisma/client"

import type { ReviewMediaItem } from "@/lib/reviews/types"

export function parseReviewMedia(raw: unknown): ReviewMediaItem[] {
  if (!Array.isArray(raw)) return []
  const out: ReviewMediaItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const type = o.type === "video" ? "video" : o.type === "image" ? "image" : null
    const url = typeof o.url === "string" ? o.url.trim() : ""
    if (!type || !url) continue
    out.push({
      type,
      url,
      blurhash: typeof o.blurhash === "string" ? o.blurhash : undefined,
      width: typeof o.width === "number" ? o.width : undefined,
      height: typeof o.height === "number" ? o.height : undefined,
      duration: typeof o.duration === "number" ? o.duration : undefined,
      muxPlaybackId: typeof o.muxPlaybackId === "string" ? o.muxPlaybackId : undefined,
    })
  }
  return out.slice(0, 6)
}

export function mediaToJson(media: ReviewMediaItem[]): Prisma.InputJsonValue {
  return media as unknown as Prisma.InputJsonValue
}

export function legacyImagesToMedia(images: string[]): ReviewMediaItem[] {
  return images
    .filter((u) => typeof u === "string" && u.trim())
    .slice(0, 6)
    .map((url) => ({ type: "image" as const, url: url.trim() }))
}

export function reviewHasUgc(media: ReviewMediaItem[], images: string[]): boolean {
  return media.some((m) => m.type === "image" || m.type === "video") || images.length > 0
}
