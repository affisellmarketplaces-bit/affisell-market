"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import donaAvatarCircleAsset from "../../public/dona-avatar-circle.webp"

/** Bundled + public path — works even when proxy skipped static files before fix. */
export const DONA_AVATAR_CIRCLE_SRC =
  typeof donaAvatarCircleAsset === "string"
    ? donaAvatarCircleAsset
    : donaAvatarCircleAsset.src

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
