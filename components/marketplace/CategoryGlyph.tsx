"use client"

import { resolveCategoryGlyphMeta } from "@/lib/category-glyph-meta"
import { cn } from "@/lib/utils"

const SIZE_CLASS = {
  xs: { box: "h-6 w-6 rounded-md", icon: "h-3 w-3", stroke: 2.25 },
  sm: { box: "h-7 w-7 rounded-lg", icon: "h-3.5 w-3.5", stroke: 2.25 },
  md: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4", stroke: 2.25 },
  lg: { box: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]", stroke: 2.25 },
} as const

type Props = {
  name: string
  slug?: string
  fullPath?: string
  /** Legacy emoji from DB — ignored when a glyph resolves. */
  icon?: string
  size?: keyof typeof SIZE_CLASS
  className?: string
  /** Dark glass sheet (mobile category drawer). */
  inSheet?: boolean
  /** "soft": calm brand-tinted tile; "bare": outline icon only (category pills). */
  tone?: "vivid" | "soft" | "bare"
}

export function CategoryGlyph({
  name,
  slug,
  fullPath,
  size = "sm",
  className,
  inSheet = false,
  tone = "vivid",
}: Props) {
  const meta = resolveCategoryGlyphMeta({ name, slug, fullPath })
  const Icon = meta.icon
  const s = SIZE_CLASS[size]

  if (tone === "bare") {
    // Outline icon only — colour comes from the parent (`currentColor`).
    return <Icon className={cn("shrink-0", s.icon, className)} strokeWidth={1.75} aria-hidden />
  }

  if (tone === "soft") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center ring-1 transition-transform duration-200 group-hover:scale-105",
          inSheet
            ? "bg-white/10 text-violet-200 ring-white/15"
            : "bg-violet-100/80 text-violet-700 ring-violet-200/70 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800/60",
          s.box,
          className
        )}
        aria-hidden
      >
        <Icon className={s.icon} strokeWidth={s.stroke} />
      </span>
    )
  }

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br",
        "ring-1 ring-white/25 dark:ring-white/15",
        "shadow-md transition-transform duration-200 group-hover:scale-105",
        meta.gradient,
        meta.glow,
        inSheet && "ring-white/20 shadow-lg shadow-black/20",
        s.box,
        className
      )}
      aria-hidden
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]"
        )}
      />
      <Icon className={cn("relative text-white drop-shadow-sm", s.icon)} strokeWidth={s.stroke} />
    </span>
  )
}
