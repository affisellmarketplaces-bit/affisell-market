"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import donaAvatarCircleAsset from "../../public/dona-avatar-circle.webp"
import donaAvatarCircle2xAsset from "../../public/dona-avatar-circle@2x.webp"
import donaAvatarPortraitAsset from "../../public/dona-avatar-portrait.webp"
import donaAvatarPortrait2xAsset from "../../public/dona-avatar-portrait@2x.webp"

function bundledAssetSrc(asset: string | { src: string }): string {
  return typeof asset === "string" ? asset : asset.src
}

/** Face-only — chat micro bubbles. */
export const DONA_AVATAR_CIRCLE_SRC = bundledAssetSrc(donaAvatarCircleAsset)
export const DONA_AVATAR_CIRCLE_2X_SRC = bundledAssetSrc(donaAvatarCircle2xAsset)
export const DONA_AVATAR_CIRCLE_SRCSET = `${DONA_AVATAR_CIRCLE_SRC} 1x, ${DONA_AVATAR_CIRCLE_2X_SRC} 2x`

/** Full portrait with CAPTAIN DONA · AFFISELL badge — FAB + headers. */
export const DONA_AVATAR_PORTRAIT_SRC = bundledAssetSrc(donaAvatarPortraitAsset)
export const DONA_AVATAR_PORTRAIT_2X_SRC = bundledAssetSrc(donaAvatarPortrait2xAsset)
export const DONA_AVATAR_PORTRAIT_SRCSET = `${DONA_AVATAR_PORTRAIT_SRC} 1x, ${DONA_AVATAR_PORTRAIT_2X_SRC} 2x`

export type DonaAvatarVariant = "portrait" | "circle"

const VARIANT_ASSETS: Record<
  DonaAvatarVariant,
  { src: string; srcSet: string; warnLabel: string }
> = {
  portrait: {
    src: DONA_AVATAR_PORTRAIT_SRC,
    srcSet: DONA_AVATAR_PORTRAIT_SRCSET,
    warnLabel: "portrait asset missing — emoji fallback",
  },
  circle: {
    src: DONA_AVATAR_CIRCLE_SRC,
    srcSet: DONA_AVATAR_CIRCLE_SRCSET,
    warnLabel: "circle asset missing — emoji fallback",
  },
}

type DonaAvatarImageProps = {
  className?: string
  alt?: string
  loading?: "lazy" | "eager"
  fallbackClassName?: string
  /** portrait = badge visible (default) · circle = face-only micro bubbles */
  variant?: DonaAvatarVariant
}

/** Avatar with 💜 fallback when the asset fails to load. */
export function DonaAvatarImage({
  className,
  alt = "",
  loading = "lazy",
  fallbackClassName,
  variant = "portrait",
}: DonaAvatarImageProps) {
  const [failed, setFailed] = useState(false)
  const assets = VARIANT_ASSETS[variant]
  const frameClass = variant === "portrait" ? "dona-avatar-brand-frame" : undefined

  if (failed) {
    return (
      <span
        className={cn(
          "flex items-center justify-center text-2xl",
          frameClass,
          fallbackClassName,
          className
        )}
        aria-hidden
      >
        💜
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- bundled static asset + onError fallback
    <img
      src={assets.src}
      srcSet={assets.srcSet}
      alt={alt}
      loading={loading}
      decoding="async"
      className={cn(frameClass, className)}
      onError={() => {
        console.warn("[dona-avatar]", assets.warnLabel)
        setFailed(true)
      }}
    />
  )
}
