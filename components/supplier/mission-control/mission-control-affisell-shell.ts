import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

/**
 * Affisell Mission Control — epoxy resin system.
 * Uses global `affisell-epoxy-atmosphere` (body) + `epoxy-surface--light` cards.
 * Brand violet + supplier indigo + AI cyan — not flat purple wash or black/white.
 */

/** Page shell — inherits body epoxy atmosphere (no extra gradient fight) */
export const missionControlCanvas = cn("min-h-[calc(100dvh-3.75rem)] text-foreground")

/** Header, fees bar */
export const missionControlSurface = cn(affisellBrand.epoxySurfaceLight, "rounded-2xl")

/** Hero cards (Trust Ladder, Escrow) */
export const missionControlAffisellCard = cn(
  affisellBrand.epoxySurfaceLight,
  "relative overflow-hidden rounded-3xl"
)

/** Stat / growth / onboarding panels */
export const missionControlPanel = cn(affisellBrand.epoxySurfaceLight, "rounded-2xl")

/** Tool chips, inline pills */
export const missionControlChip = cn(
  affisellBrand.epoxyChip,
  "rounded-xl px-4 py-2.5 text-sm font-medium text-foreground",
  "transition hover:border-brand/25 hover:text-brand dark:hover:text-brand-light"
)

/** Subtle accent washes on hero cards (epoxy already has depth) */
export const missionControlAffisellOverlayViolet =
  "pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_70%_at_100%_0%,rgb(109_40_217/0.07),transparent_55%)]"

export const missionControlAffisellOverlayIndigo =
  "pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_100%,rgb(6_182_212/0.06),transparent_50%)]"

export const missionControlAffisellScanline = cn(
  affisellBrand.gradientBar,
  "pointer-events-none absolute inset-x-0 top-0 z-0 h-px opacity-35"
)

export const missionControlAffisellEyebrow = cn(
  affisellBrand.eyebrowBrand,
  "text-[10px] font-bold uppercase tracking-[0.22em]"
)

export const missionControlHeading = "font-semibold text-foreground"

export const missionControlAffisellSubtext = "text-sm text-muted-foreground"

export const missionControlAffisellMuted = "text-xs font-medium text-muted-foreground"

export const missionControlAffisellInnerPanel = cn(
  "relative z-[1] rounded-2xl border border-brand/12 bg-brand-muted/35 p-4 backdrop-blur-sm",
  "dark:border-brand-light/12 dark:bg-brand-muted/25"
)

export const missionControlAffisellToggle = cn(
  affisellBrand.epoxyChip,
  "relative z-[1] flex size-9 items-center justify-center rounded-full"
)

export const missionControlDivider = "border-border/70"

export const missionControlProgressTrack = "bg-brand-muted/70 dark:bg-brand-muted/35"

export const missionControlStepLocked =
  "border-border/55 bg-muted/25 opacity-90 dark:border-border/40 dark:bg-muted/20"
