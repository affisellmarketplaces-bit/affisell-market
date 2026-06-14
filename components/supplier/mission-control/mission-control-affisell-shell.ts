import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

/**
 * Affisell Mission Control — epoxy + **dosed color hierarchy**.
 *
 * Tier 1 (focus)  — 1 accent per bloc : nom boutique, KPI chiffré, badge actif, CTA urgent
 * Tier 2 (struct) — eyebrows, bordures, rails : muted + teinte 50–70 %
 * Tier 3 (sem.)   — amber/red urgent, emerald OK, sky Orbital, badges tier
 */

/** Page shell — inherits body epoxy atmosphere */
export const missionControlCanvas = cn("min-h-[calc(100dvh-3.75rem)] text-foreground")

/** Header — supplier accent dosé (see `.mission-control-header-surface`) */
export const missionControlHeaderSurface = cn(
  affisellBrand.epoxySurfaceLight,
  "mission-control-header-surface relative overflow-hidden rounded-2xl"
)

/** Fees bar, secondary panels */
export const missionControlSurface = cn(affisellBrand.epoxySurfaceLight, "rounded-2xl")

/** Hero cards — sheen epoxy, overlays légers */
export const missionControlHeroCard = cn(
  affisellBrand.epoxySurfaceLight,
  "mission-control-hero-card relative overflow-hidden rounded-3xl"
)

export const missionControlHeroCardDelayed = cn(missionControlHeroCard, "mission-control-hero-card--delayed")

/** @deprecated alias */
export const missionControlAffisellCard = missionControlHeroCard

export const missionControlPanel = cn(affisellBrand.epoxySurfaceLight, "rounded-2xl")

export const missionControlChip = cn(
  affisellBrand.epoxyChip,
  "rounded-xl px-4 py-2.5 text-sm font-medium text-foreground",
  "transition hover:border-border hover:bg-muted/30"
)

/** —— Color tiers —— */

/** Tier 1 : point focal unique (nom boutique, gros chiffre) */
export const missionControlAccentFocus = "font-semibold text-foreground"

/** Tier 1 variant : une touche supplier sur le focus principal header */
export const missionControlAccentFocusSupplier =
  "font-semibold text-supplier/90 dark:text-supplier-light/90"

/** Tier 2 : eyebrows / labels */
export const missionControlHeaderEyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"

export const missionControlAffisellEyebrow =
  "text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground"

/** Tier 2 : icônes secondaires (hover → couleur) */
export const missionControlIconMuted =
  "text-muted-foreground/70 transition group-hover:text-supplier/80 dark:group-hover:text-supplier-light/80"

/** Tier 2 : micro-pill status (pas de fond brand plein) */
export const missionControlStatusPill = cn(
  "inline-flex items-center gap-1.5 rounded-full border border-border/80",
  "bg-muted/20 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
)

/** Tier 2 : tuile KPI escrow — fond neutre, accent = icône seulement */
export const missionControlMetricTile = cn(
  "flex min-w-[7.5rem] flex-1 flex-col rounded-2xl border border-border/70",
  "bg-muted/15 px-3 py-2.5 backdrop-blur-md"
)

export const missionControlMetricTileLabel =
  "mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"

export const missionControlMetricTileValue =
  "text-lg font-bold tabular-nums tracking-tight text-foreground"

export const missionControlMetricIcon = {
  brand: "text-brand/75 dark:text-brand-light/75",
  supplier: "text-supplier/75 dark:text-supplier-light/75",
  success: "text-emerald-600/80 dark:text-emerald-400/80",
} as const

/** Tier 2 : overlays hero (très légers) */
export const missionControlAffisellOverlayViolet =
  "pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_90%_70%_at_100%_0%,rgb(109_40_217/0.04),transparent_55%)]"

export const missionControlAffisellOverlayIndigo =
  "pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_80%_60%_at_0%_100%,rgb(79_70_229/0.04),transparent_50%)]"

export const missionControlAffisellScanline = cn(
  affisellBrand.gradientBar,
  "pointer-events-none absolute inset-x-0 top-0 z-[1] h-px opacity-20"
)

export const missionControlHeading = "font-semibold text-foreground"

export const missionControlAffisellSubtext = "text-sm text-muted-foreground"

export const missionControlAffisellMuted = "text-xs font-medium text-muted-foreground"

export const missionControlAffisellInnerPanel = cn(
  "relative z-[2] rounded-2xl border border-border/70 bg-muted/15 p-4 backdrop-blur-sm"
)

export const missionControlAffisellToggle = cn(
  affisellBrand.epoxyChip,
  "relative z-[2] flex size-9 items-center justify-center rounded-full"
)

/** Tier 2 : toggle ouvert — bordure seule, pas de glow brand */
export const missionControlAffisellToggleOpen = "border-border bg-muted/25 shadow-none"

export const missionControlDivider = "border-border/70"

export const missionControlProgressTrack = "bg-muted/40 dark:bg-muted/25"

/** Tier 2 : fills progress — opacité réduite */
export const missionControlProgressFillOrders = "bg-gradient-to-r from-supplier/70 to-brand/60"
export const missionControlProgressFillRating = "bg-gradient-to-r from-amber-400/70 to-orange-400/60"

export const missionControlStepLocked =
  "border-border/55 bg-muted/20 opacity-90 dark:border-border/40 dark:bg-muted/15"

/** Tier 1 CTA header — neutre, supplier au hover */
export const missionControlPrimaryCta = cn(
  "border-border/80 bg-background/50 text-foreground",
  "hover:border-supplier/35 hover:bg-supplier-muted/40 hover:text-supplier",
  "dark:hover:border-supplier-light/25 dark:hover:bg-supplier-muted/25 dark:hover:text-supplier-light"
)

/** Tier 3 : accent sémantique Orbital */
export const missionControlSemanticOrbital = "text-sky-700/90 dark:text-sky-300/90"

/** Tier 3 : KPI % weekly goal */
export const missionControlKpiHighlight = "font-bold tabular-nums text-supplier/85 dark:text-supplier-light/85"

/** Tier 3 : barre weekly goal */
export const missionControlKpiBar = "text-supplier/60 dark:text-supplier-light/55"

/** Barre latérale header — dosée */
export const missionControlHeaderRail =
  "pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-full bg-gradient-to-b from-supplier/50 via-brand/35 to-ai/30"
