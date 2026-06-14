import { cn } from "@/lib/utils"

/**
 * Affisell Mission Control — Indigo Mist palette.
 * Warm violet/indigo surfaces instead of pure black (#000) or white (#fff).
 */

/** Page canvas behind all cards */
export const missionControlCanvas = cn(
  "min-h-[calc(100dvh-3.75rem)]",
  "bg-gradient-to-b from-violet-50/95 via-indigo-50/55 to-violet-100/45",
  "text-violet-950",
  "dark:from-indigo-950 dark:via-violet-950 dark:to-indigo-950 dark:text-violet-50"
)

/** Header, fees bar, secondary panels */
export const missionControlSurface = cn(
  "rounded-2xl border border-violet-200/65",
  "bg-gradient-to-br from-violet-100/45 via-indigo-50/75 to-violet-50/85",
  "shadow-sm backdrop-blur-sm",
  "dark:border-violet-500/20 dark:from-violet-950/55 dark:via-indigo-950/45 dark:to-violet-900/35"
)

/** Primary feature cards (Trust Ladder, Escrow) */
export const missionControlAffisellCard = cn(
  "relative overflow-hidden rounded-3xl",
  "border border-violet-200/70",
  "bg-gradient-to-br from-violet-100/55 via-indigo-50/80 to-violet-50/90",
  "text-violet-950 shadow-sm ring-1 ring-violet-500/[0.07] backdrop-blur-sm",
  "dark:border-violet-500/25 dark:from-violet-950/60 dark:via-indigo-950/50 dark:to-violet-900/40 dark:text-violet-50"
)

/** Smaller stat / growth cards */
export const missionControlPanel = cn(
  "rounded-2xl border border-violet-200/70",
  "bg-gradient-to-br from-violet-50/80 via-indigo-50/60 to-violet-100/50",
  "shadow-sm",
  "dark:border-violet-500/20 dark:from-violet-950/45 dark:via-indigo-950/35 dark:to-violet-950/50"
)

/** Tool chips, inline pills */
export const missionControlChip = cn(
  "rounded-xl border border-violet-200/70",
  "bg-violet-50/80 px-4 py-2.5 text-sm font-medium text-violet-900",
  "shadow-sm transition hover:border-violet-300/80 hover:bg-violet-100/70 hover:text-violet-950",
  "dark:border-violet-500/20 dark:bg-violet-950/40 dark:text-violet-100",
  "dark:hover:border-violet-400/30 dark:hover:bg-violet-900/50"
)

export const missionControlAffisellOverlayViolet =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_100%_0%,rgba(139,92,246,0.12),transparent_55%)]"

export const missionControlAffisellOverlayIndigo =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_100%,rgba(79,70,229,0.09),transparent_50%)]"

export const missionControlAffisellScanline =
  "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent dark:via-violet-400/25"

export const missionControlAffisellEyebrow =
  "text-[10px] font-bold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300"

export const missionControlHeading = "font-semibold text-violet-950 dark:text-violet-50"

export const missionControlAffisellSubtext = "text-sm text-violet-900/65 dark:text-violet-200/75"

export const missionControlAffisellMuted = "text-xs font-medium text-violet-800/55 dark:text-violet-300/70"

export const missionControlAffisellInnerPanel = cn(
  "rounded-2xl border border-violet-200/55 p-4 backdrop-blur-sm",
  "bg-violet-50/60 dark:border-violet-400/15 dark:bg-violet-950/35"
)

export const missionControlAffisellToggle = cn(
  "relative flex size-9 items-center justify-center rounded-full",
  "border border-violet-200/75 bg-violet-50/85 backdrop-blur-md shadow-sm",
  "dark:border-violet-400/20 dark:bg-violet-950/45"
)

export const missionControlDivider = "border-violet-200/55 dark:border-violet-500/15"

export const missionControlProgressTrack = "bg-violet-200/55 dark:bg-violet-500/15"

/** Locked ladder step — mist tint, not grey/white */
export const missionControlStepLocked =
  "border-violet-200/60 bg-violet-50/55 opacity-90 dark:border-violet-400/12 dark:bg-violet-950/30"
