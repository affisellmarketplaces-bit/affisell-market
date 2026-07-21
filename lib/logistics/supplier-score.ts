/**
 * Supplier delivery trust — promised vs actual honesty loop.
 * Distinct from lib/trust-score.ts (Lightning Stripe / dispute scoring).
 */

export type SupplierMetricsInput = {
  totalOrders: number
  onTimeDeliveries: number
  avgDeliveryDays: number
  promisedVsActualDelta: number
  disputeRate: number
  responseTimeAvg: number
  deliveryScore?: number
}

export type SupplierBadge = {
  label: string
  color: "gold" | "green" | "gray" | "orange" | "red"
  boost: number
  tier: "top" | "reliable" | "standard" | "risk" | "avoid"
}

export function calculateTrustScore(metrics: SupplierMetricsInput): number {
  let score = 75

  const onTimeRate =
    metrics.totalOrders > 0 ? metrics.onTimeDeliveries / metrics.totalOrders : 1
  score += (onTimeRate - 0.8) * 100

  if (metrics.promisedVsActualDelta > 2) score -= 15
  if (metrics.promisedVsActualDelta < 0) score += 10

  score -= metrics.disputeRate * 100

  if (metrics.responseTimeAvg > 0 && metrics.responseTimeAvg < 60) score += 5
  if (metrics.responseTimeAvg > 1440) score -= 10

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function getSupplierBadge(trustScore: number): SupplierBadge {
  if (trustScore >= 90) {
    return { label: "🏆 Top Fournisseur", color: "gold", boost: 30, tier: "top" }
  }
  if (trustScore >= 80) {
    return { label: "✅ Fiable", color: "green", boost: 15, tier: "reliable" }
  }
  if (trustScore >= 60) {
    return { label: "⚖️ Standard", color: "gray", boost: 0, tier: "standard" }
  }
  if (trustScore >= 40) {
    return { label: "⚠️ Risque", color: "orange", boost: -20, tier: "risk" }
  }
  return { label: "🔴 Éviter", color: "red", boost: -50, tier: "avoid" }
}

export function calculateDeliveryScore(promised: number, actual: number): number {
  if (actual <= promised) return 100
  if (actual <= promised + 1) return 80
  if (actual <= promised + 3) return 50
  return 20
}

export function formatTrustTooltip(metrics: {
  trustScore: number
  totalOrders: number
  onTimeDeliveries: number
  promisedVsActualDelta: number
}): string {
  const onTimePct =
    metrics.totalOrders > 0
      ? Math.round((metrics.onTimeDeliveries / metrics.totalOrders) * 100)
      : 100
  const delta = metrics.promisedVsActualDelta
  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}j`
  return `${onTimePct}% livraisons à l'heure — ${metrics.totalOrders} commandes — Écart moyen ${deltaLabel}`
}

/** Ranking blend for quote comparator: trust 60% + delivery score 40%. */
export function quoteVisibilityRank(args: {
  trustScore: number
  deliveryDays: number
  country: string
  getDeliveryScore: (days: number, country: string) => { score: number }
}): number {
  const deliveryScore = args.getDeliveryScore(args.deliveryDays, args.country).score
  return args.trustScore * 0.6 + deliveryScore * 0.4
}

export function isSuspiciousLowRater(args: {
  reviewCount: number
  onesCount: number
}): boolean {
  return args.reviewCount >= 5 && args.onesCount / args.reviewCount >= 0.8
}
