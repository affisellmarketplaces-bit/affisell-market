/** Client-safe cross-reseller social proof (Discover FOMO). */
export type ProductSocialProofData = {
  activeResellersCount: number
  avgMarginCents: number
  topMarginCents: number
  lastSaleAt: string | null
  lastSaleResellerLabel: string | null
}

export type ProductSocialProofApiResponse = {
  active_resellers_count: number
  avg_margin: number
  top_margin: number
  last_sale_at: string | null
  last_sale_reseller_label: string | null
  last_sale_ago: string | null
}

export const PRODUCT_SOCIAL_PROOF_MIN_RESELLERS = 1

export function emptyProductSocialProof(): ProductSocialProofData {
  return {
    activeResellersCount: 0,
    avgMarginCents: 0,
    topMarginCents: 0,
    lastSaleAt: null,
    lastSaleResellerLabel: null,
  }
}

export function shouldShowProductCrossSocialProof(data: ProductSocialProofData): boolean {
  return (
    data.activeResellersCount >= PRODUCT_SOCIAL_PROOF_MIN_RESELLERS ||
    Boolean(data.lastSaleAt)
  )
}

export function toProductSocialProofApiResponse(
  data: ProductSocialProofData,
  lastSaleAgo: string | null
): ProductSocialProofApiResponse {
  return {
    active_resellers_count: data.activeResellersCount,
    avg_margin: data.avgMarginCents,
    top_margin: data.topMarginCents,
    last_sale_at: data.lastSaleAt,
    last_sale_reseller_label: data.lastSaleResellerLabel,
    last_sale_ago: lastSaleAgo,
  }
}

export function formatRelativeMinutesAgo(
  iso: string | null | undefined,
  locale: "fr" | "en"
): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const diffMin = Math.max(1, Math.floor((Date.now() - t) / 60_000))
  if (diffMin < 60) {
    return locale === "fr" ? `il y a ${diffMin} min` : `${diffMin} min ago`
  }
  const h = Math.floor(diffMin / 60)
  if (h < 24) {
    return locale === "fr" ? `il y a ${h} h` : `${h} h ago`
  }
  const d = Math.floor(h / 24)
  return locale === "fr" ? `il y a ${d} j` : `${d} d ago`
}

/** Show FOMO badge when avg margin is below 80% of top reseller margin. */
export const MARGIN_LEAVE_TABLE_TOP_RATIO = 0.8

export type MarginLeaveOnTableTrigger = {
  leftOnTableCents: number
  topMarginCents: number
}

export function shouldShowMarginLeaveOnTableTrigger(data: ProductSocialProofData): boolean {
  if (data.topMarginCents <= 0 || data.avgMarginCents <= 0) return false
  return data.avgMarginCents < data.topMarginCents * MARGIN_LEAVE_TABLE_TOP_RATIO
}

export function resolveMarginLeaveOnTableTrigger(
  data: ProductSocialProofData
): MarginLeaveOnTableTrigger | null {
  if (!shouldShowMarginLeaveOnTableTrigger(data)) return null
  return {
    leftOnTableCents: data.topMarginCents - data.avgMarginCents,
    topMarginCents: data.topMarginCents,
  }
}

/** FOMO margin gap — 2 decimals (e.g. 23,20€ in FR). */
export function formatMarginLeaveEurFromCents(cents: number, locale: "fr" | "en"): string {
  const value = (cents / 100).toFixed(2)
  if (locale === "fr") return `${value.replace(".", ",")}€`
  return `€${value}`
}

/** Top margin in tooltip — whole euros when exact (e.g. 67€). */
export function formatMarginTopEurFromCents(cents: number, locale: "fr" | "en"): string {
  const whole = cents % 100 === 0
  const value = whole ? String(cents / 100) : (cents / 100).toFixed(2)
  const formatted = locale === "fr" && !whole ? value.replace(".", ",") : value
  return locale === "fr" ? `${formatted}€` : `€${formatted}`
}

export function formatLastSaleAgoLine(
  data: ProductSocialProofData,
  locale: "fr" | "en"
): string | null {
  const ago = formatRelativeMinutesAgo(data.lastSaleAt, locale)
  if (!ago) return null
  if (data.lastSaleResellerLabel) {
    return locale === "fr"
      ? `Vendu ${ago} par ${data.lastSaleResellerLabel}`
      : `Sold ${ago} by ${data.lastSaleResellerLabel}`
  }
  return locale === "fr" ? `Vendu ${ago}` : `Sold ${ago}`
}
