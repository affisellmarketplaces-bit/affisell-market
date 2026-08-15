"use client"

import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  nameBadge?: StoreNameBadgeStyle
  accent?: string
  primary?: string
  align?: StorefrontHeaderBrandAlign
  className?: string
}

/** Cinematic store title on the Veo hero loop (CSS overlay — crisp on all devices). */
export function StorefrontHeroVideoNameOverlay({
  storeName,
  nameBadge = "parallelogram",
  accent = "#7c3aed",
  primary = "#18181b",
  align = "left",
  className,
}: Props) {
  const label = storeName.trim()
  if (!label) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex px-4 pb-4 sm:px-6 sm:pb-5 md:pb-6",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        align === "left" && "justify-start",
        className
      )}
      aria-hidden
    >
      <div className="affisell-hero-video-brand max-w-[min(100%,42rem)]">
        <StoreNameBadge
          name={label}
          style={nameBadge}
          accent={accent}
          primary={primary}
          size="hero"
        />
      </div>
    </div>
  )
}
