"use client"

import type { CSSProperties } from "react"

import { BoutiqueTitleFontLink } from "@/components/boutique/boutique-title-font-link"
import {
  buildBoutiqueTitleSegments,
  getBoutiqueTitleFontPreset,
  type BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import type { HauteGammeTypography } from "@/lib/boutique/haute-gamme-themes-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeLabel: string
  typography: BoutiqueTitleTypography
  prefixWord?: string
  className?: string
  heroTypography?: HauteGammeTypography
}

export function BoutiqueStoreTitle({
  storeLabel,
  typography,
  prefixWord = "Boutique",
  className,
  heroTypography,
}: Props) {
  const font = getBoutiqueTitleFontPreset(typography.fontId)
  const { segments, ariaLabel } = buildBoutiqueTitleSegments({
    storeLabel,
    typography,
    prefixWord,
  })

  const titleStyle: CSSProperties = {
    fontFamily: font.family,
    fontWeight: heroTypography?.heroWeight ?? font.weight,
    letterSpacing: heroTypography?.heroTracking ?? font.letterSpacing,
    fontStyle: heroTypography?.heroItalic ? "italic" : undefined,
  }

  return (
    <>
      <BoutiqueTitleFontLink fontId={typography.fontId} />
      <h1
        className={cn(
          "text-balance text-4xl tracking-tight sm:text-5xl lg:text-6xl",
          !heroTypography && "font-bold",
          className
        )}
        style={titleStyle}
        aria-label={ariaLabel}
      >
        {segments.map((segment, index) => {
          if (segment.variant === "prefix") {
            return (
              <span key={index} style={{ color: "var(--boutique-header-word)" }}>
                {segment.text}
              </span>
            )
          }
          return (
            <span
              key={index}
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--boutique-header-accent-from), var(--boutique-header-accent-to))",
              }}
            >
              {segment.text}
            </span>
          )
        })}
      </h1>
    </>
  )
}
