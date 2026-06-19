"use client"

import { useMemo } from "react"

import {
  resolveProductVideoEmbed,
  type ProductVideoEmbedKind,
} from "@/lib/product-playable-video"
import { cn } from "@/lib/utils"

type Props = {
  url: string
  className?: string
  /** Native `<video>` only — gallery uses shopper-initiated playback. */
  autoPlay?: boolean
  title?: string
}

const IFRAME_ALLOW: Record<Exclude<ProductVideoEmbedKind, "direct">, string> = {
  youtube:
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
  vimeo: "autoplay; fullscreen; picture-in-picture",
}

export function ProductVideoPlayer({
  url,
  className,
  autoPlay = false,
  title = "Product video",
}: Props) {
  const embed = useMemo(() => resolveProductVideoEmbed(url), [url])

  if (!embed) {
    return (
      <p className={cn("p-3 text-xs text-zinc-500 dark:text-zinc-400", className)}>
        Video unavailable — check the link format (YouTube, Vimeo, or MP4).
      </p>
    )
  }

  if (embed.kind === "youtube" || embed.kind === "vimeo") {
    return (
      <iframe
        title={title}
        src={embed.src}
        className={cn("aspect-video w-full bg-black", className)}
        allow={IFRAME_ALLOW[embed.kind]}
        allowFullScreen
        loading="lazy"
      />
    )
  }

  return (
    <video
      src={embed.src}
      className={cn("aspect-video w-full bg-black object-contain", className)}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}
