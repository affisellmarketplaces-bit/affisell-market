"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import donaAvatarCircleAsset from "../../public/dona-avatar-circle.webp"
import donaAvatarCircle2xAsset from "../../public/dona-avatar-circle@2x.webp"

function bundledAssetSrc(asset: string | { src: string }): string {
  return typeof asset === "string" ? asset : asset.src
}

/** Bundled + public path — works even when proxy skipped static files before fix. */
export const DONA_AVATAR_CIRCLE_SRC = bundledAssetSrc(donaAvatarCircleAsset)
export const DONA_AVATAR_CIRCLE_2X_SRC = bundledAssetSrc(donaAvatarCircle2xAsset)
export const DONA_AVATAR_CIRCLE_SRCSET = `${DONA_AVATAR_CIRCLE_SRC} 1x, ${DONA_AVATAR_CIRCLE_2X_SRC} 2x`

type DonaAvatarImageProps = {
  className?: string
  alt?: string
  loading?: "lazy" | "eager"
  fallbackClassName?: string
}

/** Avatar with 💜 fallback when the asset fails to load. */
export function DonaAvatarImage({
  className,
  alt = "",
  loading = "lazy",
  fallbackClassName,
}: DonaAvatarImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={cn("flex items-center justify-center text-2xl", fallbackClassName, className)}
        aria-hidden
      >
        💜
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- bundled static asset + onError fallback
    <img
      src={DONA_AVATAR_CIRCLE_SRC}
      srcSet={DONA_AVATAR_CIRCLE_SRCSET}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => {
        console.warn("[dona-avatar] circle asset missing — emoji fallback")
        setFailed(true)
      }}
    />
  )
}
