/** Circular / alternative commerce modes on supplier catalog products. */

export const PRODUCT_OFFER_MODES = [
  "STANDARD",
  "REFURBISHED",
  "SECOND_HAND",
  "WHOLESALE_ONLY",
  "DONATION",
] as const

export type ProductOfferMode = (typeof PRODUCT_OFFER_MODES)[number]

export const DEFAULT_PRODUCT_OFFER_MODE: ProductOfferMode = "STANDARD"

export const WHOLESALE_DEFAULT_MOQ = 10

const OFFER_MODE_SET = new Set<string>(PRODUCT_OFFER_MODES)

export function isProductOfferMode(value: string): value is ProductOfferMode {
  return OFFER_MODE_SET.has(value)
}

export function parseProductOfferMode(raw: unknown, fallback: ProductOfferMode = DEFAULT_PRODUCT_OFFER_MODE): ProductOfferMode {
  if (typeof raw !== "string") return fallback
  const up = raw.trim().toUpperCase().replace(/-/g, "_")
  return isProductOfferMode(up) ? up : fallback
}

/** URL facet slug → DB enum. */
export function parseOfferFacetValue(raw: string): ProductOfferMode | null {
  const map: Record<string, ProductOfferMode> = {
    refurbished: "REFURBISHED",
    second_hand: "SECOND_HAND",
    seconde_main: "SECOND_HAND",
    wholesale: "WHOLESALE_ONLY",
    gros: "WHOLESALE_ONLY",
    donation: "DONATION",
    don: "DONATION",
  }
  const key = raw.trim().toLowerCase()
  return map[key] ?? null
}

export function offerFacetSlug(mode: ProductOfferMode): string | null {
  const map: Record<ProductOfferMode, string | null> = {
    STANDARD: null,
    REFURBISHED: "refurbished",
    SECOND_HAND: "second_hand",
    WHOLESALE_ONLY: "wholesale",
    DONATION: "donation",
  }
  return map[mode]
}

export function offerModeFromLegacyFlags(isRefurbished?: boolean | null): ProductOfferMode {
  return isRefurbished ? "REFURBISHED" : DEFAULT_PRODUCT_OFFER_MODE
}

/** Keep legacy boolean in sync for existing queries. */
export function syncIsRefurbished(offerMode: ProductOfferMode): boolean {
  return offerMode === "REFURBISHED"
}

export function minCatalogPriceCents(offerMode: ProductOfferMode): number {
  return offerMode === "DONATION" ? 0 : 100
}

export function normalizeMinOrderQuantity(offerMode: ProductOfferMode, raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < 1) {
    return offerMode === "WHOLESALE_ONLY" ? WHOLESALE_DEFAULT_MOQ : 1
  }
  if (offerMode === "WHOLESALE_ONLY") return Math.max(2, Math.min(9999, n))
  return Math.max(1, Math.min(9999, n))
}

export function validateOfferModePublish(
  offerMode: ProductOfferMode,
  minOrderQuantity: number
): string | null {
  if (offerMode === "WHOLESALE_ONLY" && minOrderQuantity < 2) {
    return "wholesale_moq_min_2"
  }
  return null
}

export function resolvePurchaseMinQty(offerMode: ProductOfferMode, minOrderQuantity: number): number {
  if (offerMode === "WHOLESALE_ONLY") return Math.max(2, minOrderQuantity)
  return 1
}

import type { AppLocale } from "@/lib/i18n-locale"

export type OfferModeBadge = {
  label: string
  shortLabel: string
  tone: string
  icon: string
}

export function offerModeBadge(mode: ProductOfferMode, locale: AppLocale = "fr"): OfferModeBadge | null {
  const fr: Record<ProductOfferMode, OfferModeBadge | null> = {
    STANDARD: null,
    REFURBISHED: {
      label: "Reconditionné certifié",
      shortLabel: "Reconditionné",
      tone: "border-teal-500/40 bg-teal-500/15 text-teal-100",
      icon: "♻️",
    },
    SECOND_HAND: {
      label: "Seconde main",
      shortLabel: "Seconde main",
      tone: "border-amber-500/40 bg-amber-500/15 text-amber-100",
      icon: "🔄",
    },
    WHOLESALE_ONLY: {
      label: "Vente en gros uniquement",
      shortLabel: "Gros",
      tone: "border-indigo-500/40 bg-indigo-500/15 text-indigo-100",
      icon: "📦",
    },
    DONATION: {
      label: "À donner",
      shortLabel: "Don",
      tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
      icon: "🎁",
    },
  }
  const en: Record<ProductOfferMode, OfferModeBadge | null> = {
    STANDARD: null,
    REFURBISHED: {
      label: "Certified refurbished",
      shortLabel: "Refurbished",
      tone: "border-teal-500/40 bg-teal-500/15 text-teal-100",
      icon: "♻️",
    },
    SECOND_HAND: {
      label: "Second hand",
      shortLabel: "Pre-owned",
      tone: "border-amber-500/40 bg-amber-500/15 text-amber-100",
      icon: "🔄",
    },
    WHOLESALE_ONLY: {
      label: "Wholesale only",
      shortLabel: "Bulk",
      tone: "border-indigo-500/40 bg-indigo-500/15 text-indigo-100",
      icon: "📦",
    },
    DONATION: {
      label: "Free to give",
      shortLabel: "Donation",
      tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
      icon: "🎁",
    },
  }
  return (locale === "fr" ? fr : en)[mode]
}

export function isDonationListing(offerMode: ProductOfferMode, priceCents: number): boolean {
  return offerMode === "DONATION" && priceCents <= 0
}
