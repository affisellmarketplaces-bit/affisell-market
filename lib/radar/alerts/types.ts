import type { RadarGlobalSnapshot } from ".prisma/client-mi"

export type AlertType =
  | "WINNER_NEW"
  | "WINNER_RISING"
  | "PRICE_WAR"
  | "SATURATION_RISK"
  | "NEW_LISTING"
  | "TRENDING_KEYWORD"

export type Severity = "low" | "medium" | "high" | "critical"

export type AlertMeta = {
  rank?: number | null
  salesEst?: number | null
  oldRank?: number | null
  newRank?: number | null
  rankGain?: number | null
  oldPrice?: number | null
  newPrice?: number | null
  priceDropPct?: number | null
  competitorCount?: number | null
  ageDays?: number | null
  title?: string | null
  url?: string | null
}

export type AlertCheckResult = {
  triggered: boolean
  severity: Severity
  meta: AlertMeta
  title: string
  message: string
}

/** Snapshot shape used by rules (Prisma model or plain objects in tests). */
export type SnapshotLike = Pick<
  RadarGlobalSnapshot,
  | "id"
  | "marketplaceId"
  | "externalId"
  | "title"
  | "price"
  | "category"
  | "country"
  | "day"
  | "rank"
  | "salesEst"
  | "url"
  | "currency"
  | "imageUrl"
  | "crawledAt"
>

export type AlertCheckContext = {
  current: SnapshotLike
  history: SnapshotLike[]
  /** Distinct externalIds with same normalized title in last 48h. */
  saturationSellerCount: number
  trendingKeywords: string[]
}

export interface AlertRule {
  id: string
  type: AlertType
  check: (ctx: AlertCheckContext) => AlertCheckResult | null
}

export type RadarAlertInput = {
  userId?: string | null
  type: AlertType
  severity: Severity
  title: string
  message: string
  productId: string | null
  externalId: string | null
  marketplaceId: string
  country: string | null
  category: string | null
  meta: AlertMeta
}

export type AlertSubscriptionFilters = {
  marketplaces?: string[]
  countries?: string[]
  minSeverity?: Severity
  categories?: string[]
}

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export function decimalToNumber(value: { toString(): string } | number | null | undefined): number {
  if (value == null) return NaN
  if (typeof value === "number") return value
  return Number(value.toString())
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
