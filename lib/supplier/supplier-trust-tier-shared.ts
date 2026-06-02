/** Client-safe supplier trust ladder — no Prisma. */

export const SUPPLIER_TRUST_TIERS = ["NONE", "SPARK", "FORGE", "ORBITAL"] as const
export type SupplierTrustTier = (typeof SUPPLIER_TRUST_TIERS)[number]

export type SupplierTrustMetrics = {
  successfulOrders: number
  rating: number
  disputeRate: number
  shippingSla48h: number
}

export type SupplierTrustThreshold = {
  minOrders: number
  minRating: number
  maxDisputeRate: number
  minShippingSla: number
}

export const SUPPLIER_TRUST_THRESHOLDS: Record<
  Exclude<SupplierTrustTier, "NONE">,
  SupplierTrustThreshold
> = {
  SPARK: {
    minOrders: 500,
    minRating: 4.4,
    maxDisputeRate: 0.03,
    minShippingSla: 0.88,
  },
  FORGE: {
    minOrders: 25_000,
    minRating: 4.6,
    maxDisputeRate: 0.02,
    minShippingSla: 0.93,
  },
  ORBITAL: {
    minOrders: 1_000_000,
    minRating: 4.7,
    maxDisputeRate: 0.015,
    minShippingSla: 0.95,
  },
}

export type SupplierTrustTierMeta = {
  id: Exclude<SupplierTrustTier, "NONE">
  labelFr: string
  labelEn: string
  shortFr: string
  shortEn: string
  tooltipFr: string
  tooltipEn: string
  order: number
}

export const SUPPLIER_TRUST_TIER_META: Record<
  Exclude<SupplierTrustTier, "NONE">,
  SupplierTrustTierMeta
> = {
  SPARK: {
    id: "SPARK",
    labelFr: "Affisell Spark",
    labelEn: "Affisell Spark",
    shortFr: "Spark",
    shortEn: "Spark",
    tooltipFr:
      "Niveau I · 500+ commandes réussies, avis solides et expédition fiable — fournisseur en progression.",
    tooltipEn:
      "Tier I · 500+ successful orders, strong reviews and reliable shipping — rising supplier.",
    order: 1,
  },
  FORGE: {
    id: "FORGE",
    labelFr: "Affisell Forge",
    labelEn: "Affisell Forge",
    shortFr: "Forge",
    shortEn: "Forge",
    tooltipFr:
      "Niveau II · 25 000+ commandes, note ≥ 4,6 et SLA expédition premium — partenaire de confiance.",
    tooltipEn:
      "Tier II · 25,000+ orders, 4.6+ rating and premium ship SLA — trusted partner.",
    order: 2,
  },
  ORBITAL: {
    id: "ORBITAL",
    labelFr: "Affisell Orbital",
    labelEn: "Affisell Orbital",
    shortFr: "Orbital",
    shortEn: "Orbital",
    tooltipFr:
      "Niveau III · 1 M+ commandes traitées avec succès, excellence avis & logistique — badge bleu certifié.",
    tooltipEn:
      "Tier III · 1M+ successful orders, review & logistics excellence — certified blue badge.",
    order: 3,
  },
}

const TIER_RANK: Record<SupplierTrustTier, number> = {
  NONE: 0,
  SPARK: 1,
  FORGE: 2,
  ORBITAL: 3,
}

function meetsThreshold(metrics: SupplierTrustMetrics, threshold: SupplierTrustThreshold): boolean {
  return (
    metrics.successfulOrders >= threshold.minOrders &&
    metrics.rating >= threshold.minRating &&
    metrics.disputeRate <= threshold.maxDisputeRate &&
    metrics.shippingSla48h >= threshold.minShippingSla
  )
}

/** Highest tier the supplier qualifies for (ORBITAL → FORGE → SPARK). */
export function resolveSupplierTrustTier(metrics: SupplierTrustMetrics): SupplierTrustTier {
  if (meetsThreshold(metrics, SUPPLIER_TRUST_THRESHOLDS.ORBITAL)) return "ORBITAL"
  if (meetsThreshold(metrics, SUPPLIER_TRUST_THRESHOLDS.FORGE)) return "FORGE"
  if (meetsThreshold(metrics, SUPPLIER_TRUST_THRESHOLDS.SPARK)) return "SPARK"
  return "NONE"
}

export function isSupplierTrustTier(value: string | null | undefined): value is SupplierTrustTier {
  return SUPPLIER_TRUST_TIERS.includes(value as SupplierTrustTier)
}

export function coerceSupplierTrustTier(
  tier: string | null | undefined,
  isVerifiedSupplier?: boolean
): SupplierTrustTier {
  if (isSupplierTrustTier(tier) && tier !== "NONE") return tier
  if (isVerifiedSupplier) return "FORGE"
  return "NONE"
}

export function nextTrustTier(current: SupplierTrustTier): Exclude<SupplierTrustTier, "NONE"> | null {
  if (current === "ORBITAL") return null
  if (current === "FORGE") return "ORBITAL"
  if (current === "SPARK") return "FORGE"
  return "SPARK"
}

export function trustTierRank(tier: SupplierTrustTier): number {
  return TIER_RANK[tier]
}

export type TrustTierProgress = {
  current: SupplierTrustTier
  next: Exclude<SupplierTrustTier, "NONE"> | null
  ordersProgress: number
  ordersTarget: number
  ratingProgress: number
  ratingTarget: number
}

export function buildTrustTierProgress(
  metrics: SupplierTrustMetrics,
  current: SupplierTrustTier
): TrustTierProgress {
  const next = nextTrustTier(current)
  if (!next) {
    return {
      current,
      next: null,
      ordersProgress: metrics.successfulOrders,
      ordersTarget: SUPPLIER_TRUST_THRESHOLDS.ORBITAL.minOrders,
      ratingProgress: metrics.rating,
      ratingTarget: SUPPLIER_TRUST_THRESHOLDS.ORBITAL.minRating,
    }
  }
  const threshold = SUPPLIER_TRUST_THRESHOLDS[next]
  return {
    current,
    next,
    ordersProgress: metrics.successfulOrders,
    ordersTarget: threshold.minOrders,
    ratingProgress: metrics.rating,
    ratingTarget: threshold.minRating,
  }
}

export function formatTrustOrderCount(n: number, locale: "fr" | "en"): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return locale === "fr" ? `${v.toFixed(v >= 10 ? 0 : 1)} M` : `${v.toFixed(v >= 10 ? 0 : 1)}M`
  }
  if (n >= 1_000) {
    const v = n / 1_000
    return locale === "fr" ? `${v.toFixed(v >= 100 ? 0 : 1)} k` : `${v.toFixed(v >= 100 ? 0 : 1)}k`
  }
  return n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US")
}
