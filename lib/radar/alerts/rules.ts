import type {
  AlertCheckContext,
  AlertCheckResult,
  AlertRule,
  SnapshotLike,
} from "@/lib/radar/alerts/types"
import { decimalToNumber, normalizeTitle } from "@/lib/radar/alerts/types"

const DAY_MS = 24 * 60 * 60 * 1000

function ageDays(current: SnapshotLike, history: SnapshotLike[]): number {
  const times = [current.crawledAt, ...history.map((h) => h.crawledAt)].map((d) => d.getTime())
  const first = Math.min(...times)
  return Math.max(0, (Date.now() - first) / DAY_MS)
}

function snapshotTime(h: SnapshotLike): number {
  const day = "day" in h && h.day instanceof Date ? h.day.getTime() : NaN
  if (Number.isFinite(day)) return day
  return h.crawledAt.getTime()
}

function historyInWindow(history: SnapshotLike[], days: number): SnapshotLike[] {
  // Inclusive calendar-day window: today and the previous (days-1) UTC days.
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))
  return history
    .filter((h) => snapshotTime(h) >= start.getTime())
    .sort((a, b) => snapshotTime(a) - snapshotTime(b))
}

function checkWinnerNew(ctx: AlertCheckContext): AlertCheckResult | null {
  const { current, history } = ctx
  const rank = current.rank
  const salesEst = current.salesEst ?? 0
  if (rank == null || rank > 20 || salesEst <= 500) return null

  const age = ageDays(current, history)
  if (age >= 30) return null

  const severity = salesEst > 2000 ? "critical" : "high"
  const ageRounded = Math.max(0, Math.round(age))
  return {
    triggered: true,
    severity,
    meta: {
      rank,
      salesEst,
      ageDays: ageRounded,
      title: current.title,
      url: current.url,
    },
    title: `Nouveau winner: ${current.title}`,
    message: `🔥 Nouveau winner détecté: ${current.title} #${rank} sur ${current.marketplaceId} ${current.country} - score demande ${salesEst}, signal apparu il y a ${ageRounded} jours`,
  }
}

export function checkWinnerRising(ctx: AlertCheckContext): AlertCheckResult | null {
  const { current, history } = ctx
  const newRank = current.rank
  if (newRank == null || newRank > 50) return null

  const window = historyInWindow(history, 7)
  // Prefer oldest in window as baseline (rank before the rise)
  const baseline = window[0] ?? [...history].sort((a, b) => snapshotTime(a) - snapshotTime(b))[0]
  if (!baseline || baseline.id === current.id) {
    // Single-row schema: use previousRank if encoded in history duplicate with older crawledAt — skip
    return null
  }
  const oldRank = baseline.rank
  if (oldRank == null) return null

  const gain = oldRank - newRank
  if (gain < 30) return null

  const severity = gain > 50 ? "high" : "medium"
  return {
    triggered: true,
    severity,
    meta: {
      oldRank,
      newRank,
      rankGain: gain,
      title: current.title,
      url: current.url,
    },
    title: `Winner rising: ${current.title}`,
    message: `📈 Rising: ${current.title} #${oldRank} → #${newRank} (+${gain} places) sur ${current.marketplaceId} ${current.country}`,
  }
}

export function checkPriceWar(ctx: AlertCheckContext): AlertCheckResult | null {
  const { current, history } = ctx
  const newPrice = decimalToNumber(current.price)
  if (!Number.isFinite(newPrice) || newPrice <= 0) return null

  const window = historyInWindow(
    history.filter((h) => h.id !== current.id),
    7
  )
  if (window.length === 0) return null

  const prices = window.map((h) => decimalToNumber(h.price)).filter((n) => Number.isFinite(n) && n > 0)
  if (prices.length === 0) return null

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  if (avg <= 0) return null

  const dropPct = ((avg - newPrice) / avg) * 100
  if (dropPct < 15) return null

  const severity = dropPct > 30 ? "high" : "medium"
  const dropRounded = Math.round(dropPct)
  return {
    triggered: true,
    severity,
    meta: {
      oldPrice: Math.round(avg * 100) / 100,
      newPrice,
      priceDropPct: dropRounded,
      title: current.title,
      url: current.url,
    },
    title: `Guerre de prix: ${current.title}`,
    message: `⚠️ Guerre de prix sur ${current.title}: -${dropRounded}% en 7j (${Math.round(avg * 100) / 100} → ${newPrice}) sur ${current.marketplaceId}`,
  }
}

function checkSaturationRisk(ctx: AlertCheckContext): AlertCheckResult | null {
  const { current, saturationSellerCount } = ctx
  if (saturationSellerCount < 5) return null

  return {
    triggered: true,
    severity: "medium",
    meta: {
      competitorCount: saturationSellerCount,
      title: current.title,
      url: current.url,
    },
    title: `Saturation: ${normalizeTitle(current.title).slice(0, 60)}`,
    message: `🟡 Risque saturation: ${saturationSellerCount} sellers proches de « ${current.title} » en 48h sur ${current.marketplaceId} ${current.country}`,
  }
}

function checkNewListing(ctx: AlertCheckContext): AlertCheckResult | null {
  const { current, history, trendingKeywords } = ctx
  const ageMs = Date.now() - Math.min(
    current.crawledAt.getTime(),
    ...history.map((h) => h.crawledAt.getTime())
  )
  if (ageMs > DAY_MS) return null

  const haystack = `${current.title} ${current.category ?? ""}`.toLowerCase()
  const matched = trendingKeywords.find((k) => haystack.includes(k.toLowerCase()))
  const categoryTrending =
    Boolean(matched) ||
    (current.category != null &&
      trendingKeywords.some((k) => current.category!.toLowerCase().includes(k.toLowerCase())))

  if (!categoryTrending && trendingKeywords.length > 0) return null
  // If no trends available, still fire low early-signal for brand-new listings
  if (!categoryTrending && trendingKeywords.length === 0) {
    // require explicit first-seen (no older history)
    if (history.some((h) => h.id !== current.id)) return null
  } else if (!categoryTrending) {
    return null
  }

  return {
    triggered: true,
    severity: "low",
    meta: {
      title: current.title,
      url: current.url,
      rank: current.rank,
    },
    title: `New listing: ${current.title}`,
    message: `✨ Nouveau listing (24h) dans une catégorie tendance: ${current.title} sur ${current.marketplaceId} ${current.country}`,
  }
}

export const ALERT_RULES: AlertRule[] = [
  { id: "winner_new", type: "WINNER_NEW", check: checkWinnerNew },
  { id: "winner_rising", type: "WINNER_RISING", check: checkWinnerRising },
  { id: "price_war", type: "PRICE_WAR", check: checkPriceWar },
  { id: "saturation_risk", type: "SATURATION_RISK", check: checkSaturationRisk },
  { id: "new_listing", type: "NEW_LISTING", check: checkNewListing },
]
