"use client"

import type { OfferModeBadge } from "@/lib/product-offer-mode"
import { cn } from "@/lib/utils"

type Props = {
  badge: OfferModeBadge
  variant?: "overlay" | "inline"
  className?: string
}

export function ProductOfferBadge({ badge, variant = "overlay", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-tight",
        badge.tone,
        variant === "overlay" &&
          "affisell-premium-overlay-badge absolute left-2 top-2 z-10 border-white/25 px-2.5 py-1 text-[9px] sm:text-[10px]",
        className
      )}
    >
      <span aria-hidden>{badge.icon}</span>
      {badge.shortLabel}
    </span>
  )
}
