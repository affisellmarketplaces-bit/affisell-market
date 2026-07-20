/** Shared types for World Radar — safe to import from client components. */
export type SupplierMatchDto = {
  count: number
  sampleNames: string[]
}

export type ArbitrageDto = {
  score: number
  tier: "or" | "argent" | "bronze" | "none"
  label: string
  hint: string
}

export type SaturationDto = {
  index: number
  tier: "vierge" | "tot" | "sature"
  label: string
  emoji: string
  daysUntilSaturation: number | null
  prediction: string | null
  barPercent: number
}

export type WorldRadarWinnerDto = {
  id: string
  countryCode: string
  rank: number
  title: string
  image: string | null
  source: string
  price: number | null
  currency: string
  growthRate: number | null
  searches: number | null
  competition: number | null
  trendingScore: number
  category: string | null
  /** Moat 1 — Arbitrage Score™ */
  arbitrage?: ArbitrageDto
  /** Moat 2 — Saturation Index */
  saturation?: SaturationDto
  /** Moat 3 — Affisell FR supplier match */
  supplierMatch?: SupplierMatchDto
}

export type WorldRadarTrendingDto = {
  id: string
  keyword: string
  growthRate: number
  volume: number | null
}

export type WorldRadarCountryDto = {
  code: string
  name: string
  flag: string
  region: string
  currency: string
  enabled: boolean
  productCount: number
  lastScanAt: string | null
  isLive: boolean
}

export type WorldRadarPayload = {
  winners: WorldRadarWinnerDto[]
  trendingKeywords: WorldRadarTrendingDto[]
  country: WorldRadarCountryDto
  lastScanAt: string | null
  isLive: boolean
  source: "cache" | "scan" | "mock"
}

export type WorldRadarCountriesPayload = {
  countries: WorldRadarCountryDto[]
  byRegion: Record<string, WorldRadarCountryDto[]>
  total: number
}

export const WORLD_RADAR_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export function isCountryScanLive(lastScanAt: Date | string | null | undefined): boolean {
  if (!lastScanAt) return false
  const ts = typeof lastScanAt === "string" ? new Date(lastScanAt).getTime() : lastScanAt.getTime()
  return Date.now() - ts < 60 * 60 * 1000
}

export function formatRelativeScanFr(lastScanAt: Date | string | null | undefined): string {
  if (!lastScanAt) return "jamais"
  const ts = typeof lastScanAt === "string" ? new Date(lastScanAt).getTime() : lastScanAt.getTime()
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000))
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}
