"use client"

import type { CSSProperties } from "react"

import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import { cn } from "@/lib/utils"

type Props = {
  name: string
  style?: StoreNameBadgeStyle
  accent?: string
  primary?: string
  className?: string
  /** h1 vs inline preview */
  size?: "store" | "preview"
}

export function StoreNameBadge({
  name,
  style = "parallelogram",
  accent = "#7c3aed",
  primary = "#18181b",
  className,
  size = "store",
}: Props) {
  const textClass =
    size === "store"
      ? "text-xl font-bold tracking-tight sm:text-2xl"
      : "text-sm font-bold tracking-tight"

  if (style === "classic") {
    return (
      <h1 className={cn("truncate text-zinc-900 dark:text-zinc-50", textClass, className)}>{name}</h1>
    )
  }

  const bandBase = cn(
    "affisell-store-name-badge relative inline-block max-w-full",
    `affisell-store-name-badge--${style}`,
    size === "preview" && "scale-90 origin-left"
  )

  return (
    <div
      className={cn(bandBase, className)}
      style={{ "--badge-accent": accent, "--badge-primary": primary } as CSSProperties}
    >
      {style === "quantum-fold" ? (
        <span className="affisell-store-name-badge__shadow" aria-hidden />
      ) : null}
      <h1 className={cn("affisell-store-name-badge__label relative z-[1] truncate", textClass)}>{name}</h1>
    </div>
  )
}
