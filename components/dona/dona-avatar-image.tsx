"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

/** Official Captain Dona bubble crop (256×256, circular alpha). */
export const DONA_AVATAR_CIRCLE_SRC = "/dona-avatar-circle.webp"

type DonaAvatarImageProps = {
  className?: string
  alt?: string
  loading?: "lazy" | "eager"
  fallbackClassName?: string
}

/** Avatar with 💜 fallback when the static asset 404s in prod. */
export function DonaAvatarImage({
  className,
  alt = "Dona",
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
    // eslint-disable-next-line @next/next/no-img-element -- static public asset + onError fallback
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
