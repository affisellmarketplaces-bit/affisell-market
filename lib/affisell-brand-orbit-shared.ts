/**
 * Affisell Orbital — unified violet/indigo band system (hero, trust rail, footer, catalog).
 * Safe for `"use client"` (no Prisma).
 */

/** Deep orbital gradient — footer shell + footer bookend ribbon. */
export const brandOrbitDeepShell =
  "bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#1E3A8A]"

/** Live hero gradient — brighter, pairs with HeroGradientBg. */
export const brandOrbitHeroShell =
  "relative overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-700 via-indigo-800 to-sky-900 text-white shadow-xl"

export const brandOrbitFooterShell = `relative mt-auto shrink-0 overflow-hidden border-t border-white/20 ${brandOrbitDeepShell} text-zinc-300 backdrop-blur-xl`

/** Thin trust band — nav strip + footer bookend (same visual language). */
export const brandOrbitTrustStripShell =
  "relative overflow-hidden border-t border-white/10 bg-gradient-to-r from-[#312E81] via-[#4338CA]/95 to-[#1E3A8A] text-violet-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"

export const brandOrbitTrustStripShimmer =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.07)_50%,transparent_65%)]"

export const brandOrbitTrustStripText =
  "flex min-w-0 items-center gap-1.5 text-xs font-medium text-violet-50/95"

export const brandOrbitTrustStripLink =
  "shrink-0 font-semibold text-violet-100 underline-offset-2 transition hover:text-white hover:underline"

export const brandOrbitTrustStripDismiss =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-violet-100/80 transition hover:bg-white/10 hover:text-white"

/** Catalog / department rail — orbital glass on light pages. */
export const brandOrbitRailShell =
  "relative overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-600/[0.07] via-white/95 to-indigo-500/[0.08] p-3 shadow-sm shadow-violet-950/5 dark:border-violet-500/30 dark:from-[#1E1B4B]/75 dark:via-violet-950/45 dark:to-indigo-950/35"

export const brandOrbitRailGlow =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_50%,rgba(139,92,246,0.14),transparent)]"

export const brandOrbitRailEyebrow =
  "text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-800/90 dark:text-violet-200/90"

export const brandOrbitRailHint =
  "text-[11px] text-violet-900/75 dark:text-violet-200/80"

export const brandOrbitPillActive =
  "border-violet-500 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30"

export const brandOrbitPillIdle =
  "border-white/80 bg-white/75 text-zinc-700 hover:border-violet-300 hover:bg-white dark:border-violet-800/55 dark:bg-violet-950/45 dark:text-violet-100 dark:hover:border-violet-500/45"

/** Storefront header trust rail — subtle orbital tint on platform shops. */
export const brandOrbitStorefrontTrustRail =
  "border-t border-violet-400/20 bg-gradient-to-r from-violet-600/[0.06] via-white/95 to-indigo-500/[0.06] dark:border-violet-700/35 dark:from-violet-950/50 dark:via-zinc-950/92 dark:to-indigo-950/40"

export const brandOrbitGridOverlay = "pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02]"
