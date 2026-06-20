import { cn } from "@/lib/utils"

export type StorefrontPdpBrandClasses = {
  pageShell: string
  pageGlow: string
  categoryBadge: string
  ctaPrimary: string
  ctaPrimarySticky: string
  ctaSecondary: string
  chipSelected: string
  chipSelectedRing: string
  /** Color dots — ring only; never theme background fill. */
  swatchSelectedRing: string
  accentText: string
  accentIcon: string
  partnerHighlight: string
  cardGlowOrb: string
  cardGlowOrbTeal: string
  titleAccentBar: string
  priceCard: string
  priceCardLabel: string
  priceCardOrb: string
  mobilePanel: string
  mobileCategoryBadge: string
  stickyBar: string
  stickyPrice: string
  stickySecondaryBtn: string
}

const AFFISELL_PDP_BRAND: StorefrontPdpBrandClasses = {
  pageShell:
    "bg-gradient-to-b from-zinc-100/95 via-white to-violet-100/45 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/30",
  pageGlow:
    "bg-[radial-gradient(ellipse_115%_70%_at_50%_-12%,rgba(139,92,246,0.14),transparent_52%)] dark:bg-[radial-gradient(ellipse_115%_70%_at_50%_-12%,rgba(139,92,246,0.22),transparent_55%)]",
  categoryBadge:
    "rounded-full bg-violet-600/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  ctaPrimary:
    "relative flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-violet-600 to-fuchsia-600 text-[15px] font-semibold text-white shadow-md shadow-violet-500/25 transition hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50 lg:rounded-full lg:text-base lg:shadow-lg dark:shadow-violet-900/40",
  ctaPrimarySticky:
    "h-10 shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 text-xs font-bold text-white shadow-lg shadow-violet-500/25 sm:h-11 sm:px-5 sm:text-sm",
  ctaSecondary:
    "relative flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-violet-300/60 bg-white text-[15px] font-semibold text-zinc-900 shadow-sm transition hover:bg-violet-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/40 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-violet-950/40 lg:rounded-full lg:border-violet-300/45 lg:px-4 lg:text-left lg:shadow-[0_0_0_1px_rgba(139,92,246,0.07),0_10px_36px_-14px_rgba(124,58,237,0.42)] lg:ring-1 lg:ring-white/70 lg:backdrop-blur-md",
  chipSelected:
    "border-violet-600 bg-violet-600 text-white shadow-sm dark:border-violet-500 dark:bg-violet-600",
  chipSelectedRing: "border-violet-600 ring-2 ring-violet-400/35 dark:border-violet-400",
  swatchSelectedRing:
    "scale-105 border-zinc-900 shadow-md ring-2 ring-violet-500/40 ring-offset-2 ring-offset-white dark:border-white dark:ring-violet-400/50 dark:ring-offset-zinc-950",
  accentText: "font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400",
  accentIcon: "text-violet-600 dark:text-violet-400",
  partnerHighlight:
    "rounded-lg border border-violet-200/70 bg-violet-50/70 px-3 py-2 text-[11px] leading-relaxed text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-100 lg:rounded-xl lg:text-xs",
  cardGlowOrb:
    "pointer-events-none absolute -left-1/4 top-[-4.5rem] hidden h-[26rem] w-[26rem] rounded-full bg-violet-500/[0.2] blur-3xl dark:bg-violet-600/[0.14] sm:left-[-8%] sm:top-[-5rem] lg:block",
  cardGlowOrbTeal:
    "pointer-events-none absolute right-[-12%] top-[18%] hidden h-[20rem] w-[20rem] rounded-full bg-teal-400/16 blur-3xl dark:bg-teal-500/10 sm:right-[-6%] lg:block",
  titleAccentBar:
    "pointer-events-none absolute -left-3 top-0 hidden h-full w-0.5 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-transparent opacity-80 lg:block",
  priceCard:
    "listing-price-card-sheen relative max-w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white via-violet-50/30 to-white p-4 shadow-sm dark:border-zinc-700/80 dark:from-zinc-900 dark:via-violet-950/20 dark:to-zinc-950 sm:p-5",
  priceCardLabel: "text-[11px] font-semibold tracking-[0.08em] text-violet-700/90 dark:text-violet-300/90",
  priceCardOrb:
    "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/10",
  mobilePanel:
    "scroll-mt-20 space-y-3.5 rounded-2xl border border-violet-200/40 bg-gradient-to-b from-white via-violet-50/25 to-white p-3.5 shadow-[0_20px_50px_-28px_rgba(91,33,217,0.28)] ring-1 ring-violet-500/10 dark:border-violet-900/35 dark:from-zinc-950 dark:via-violet-950/15 dark:to-zinc-950 dark:ring-violet-400/10",
  mobileCategoryBadge:
    "inline-block rounded-full bg-violet-600/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  stickyBar:
    "mx-auto flex max-w-3xl items-center gap-2 rounded-[1.35rem] border border-violet-200/50 bg-white/92 px-2.5 py-2 shadow-[0_16px_48px_-12px_rgba(91,33,217,0.35)] ring-1 ring-violet-500/10 backdrop-blur-2xl dark:border-violet-900/40 dark:bg-zinc-950/92 dark:ring-violet-400/15 sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2.5",
  stickyPrice: "text-sm font-bold tabular-nums text-violet-700 dark:text-violet-400 sm:text-base",
  stickySecondaryBtn:
    "hidden h-10 shrink-0 rounded-full border border-violet-400/60 bg-white px-3 text-xs font-bold text-violet-800 sm:inline-flex dark:bg-zinc-900 dark:text-violet-200",
}

const STOREFRONT_PDP_BRAND: StorefrontPdpBrandClasses = {
  pageShell: "affisell-storefront-pdp-shell",
  pageGlow: "affisell-storefront-pdp-page-glow",
  categoryBadge: "store-pdp-category-badge rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
  ctaPrimary: "store-pdp-cta-primary relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 lg:h-14 lg:rounded-full lg:text-base",
  ctaPrimarySticky:
    "store-pdp-cta-primary h-10 shrink-0 rounded-full px-4 text-xs font-bold sm:h-11 sm:px-5 sm:text-sm",
  ctaSecondary:
    "store-pdp-cta-secondary relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 lg:h-14 lg:rounded-full lg:px-4 lg:text-left",
  chipSelected: "store-pdp-chip-selected border-2 text-white shadow-sm",
  chipSelectedRing: "store-pdp-chip-selected ring-2 ring-[color-mix(in_srgb,var(--store-accent,#7c3aed)_35%,transparent)]",
  swatchSelectedRing:
    "scale-105 border-[var(--store-accent,#7c3aed)] shadow-md ring-2 ring-[color-mix(in_srgb,var(--store-accent,#7c3aed)_35%,transparent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950",
  accentText: "store-pdp-accent-text font-medium underline-offset-2 hover:underline",
  accentIcon: "store-pdp-accent-icon",
  partnerHighlight: "store-pdp-partner-highlight rounded-lg px-3 py-2 text-[11px] leading-relaxed lg:rounded-xl lg:text-xs",
  cardGlowOrb: "affisell-storefront-pdp-orb affisell-storefront-pdp-orb--left",
  cardGlowOrbTeal: "affisell-storefront-pdp-orb affisell-storefront-pdp-orb--right",
  titleAccentBar: "affisell-storefront-pdp-title-bar pointer-events-none absolute -left-3 top-0 hidden h-full w-0.5 rounded-full opacity-80 lg:block",
  priceCard: "store-pdp-price-card listing-price-card-sheen relative max-w-full overflow-hidden rounded-2xl border border-zinc-200/80 p-4 shadow-sm dark:border-zinc-700/80 sm:p-5",
  priceCardLabel: "store-pdp-price-card-label text-[11px] font-semibold tracking-[0.08em]",
  priceCardOrb: "affisell-storefront-pdp-price-orb pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl",
  mobilePanel: "store-pdp-mobile-panel scroll-mt-20 space-y-3.5 rounded-2xl border p-3.5",
  mobileCategoryBadge:
    "store-pdp-category-badge inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]",
  stickyBar:
    "store-pdp-sticky-bar mx-auto flex max-w-3xl items-center gap-2 rounded-[1.35rem] border bg-white/92 px-2.5 py-2 backdrop-blur-2xl sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2.5",
  stickyPrice: "store-pdp-accent-text text-sm font-bold tabular-nums sm:text-base",
  stickySecondaryBtn:
    "store-pdp-sticky-secondary hidden h-10 shrink-0 rounded-full border bg-white px-3 text-xs font-bold sm:inline-flex dark:bg-zinc-900",
}

/** Buyer PDP tokens — Affisell marketplace vs affiliate storefront (`/shops/:slug`). */
export function storefrontPdpBrandClasses(branded: boolean): StorefrontPdpBrandClasses {
  return branded ? STOREFRONT_PDP_BRAND : AFFISELL_PDP_BRAND
}

export function storefrontPdpChipClass(
  brand: StorefrontPdpBrandClasses,
  selected: boolean,
  base: string
): string {
  return cn(base, selected && brand.chipSelected)
}
