/**
 * World Radar mock catalog — V2 scoring engine (culturally differentiated).
 * Kept export names for seed/store compatibility.
 */

import { getWinnersForCountry, getWeekNumber } from "@/lib/radar/scoring-engine"
import { getWorldCountry } from "@/lib/radar/world-countries"
import type { WorldCountryDef } from "@/lib/radar/world-countries"

export type MockWinnerSeed = {
  title: string
  source: string
  category: string
  price: number
  growthRate: number
  searches: number
  competition: number
  image: string
  productId?: string
  isNew?: boolean
  isHot?: boolean
  isLocalWinner?: boolean
  lastWeekRank?: number | null
  finalScore?: number
  supplierLabel?: string
}

export { getWeekNumber }

export function buildMockWinnersForCountry(
  countryCode: string,
  limit = 20,
  date = new Date(),
  trendingCategories: string[] = []
): Array<{
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
  productId: string
  isNew: boolean
  isHot: boolean
  isLocalWinner: boolean
  lastWeekRank: number | null
  finalScore: number
  supplierLabel: string
}> {
  const code = countryCode.toUpperCase()
  const country = getWorldCountry(code)
  const cats =
    trendingCategories.length > 0 ? trendingCategories : (country?.trendingCategories ?? [])

  return getWinnersForCountry(code, date, cats)
    .slice(0, limit)
    .map((w) => ({
      countryCode: w.countryCode,
      rank: w.rank,
      title: w.title,
      image: w.image,
      source: w.source,
      price: w.price,
      currency: w.currency,
      growthRate: w.growthRate,
      searches: w.searches,
      competition: w.competition,
      trendingScore: w.trendingScore,
      category: w.category,
      productId: w.productId,
      isNew: w.isNew,
      isHot: w.isHot,
      isLocalWinner: w.isLocalWinner,
      lastWeekRank: w.lastWeekRank,
      finalScore: w.finalScore,
      supplierLabel: w.supplierLabel,
    }))
}

const COUNTRY_TRENDING: Record<string, Array<{ keyword: string; growthRate: number; volume: number }>> = {
  FR: [
    { keyword: "airfryer 5l", growthRate: 88, volume: 24500 },
    { keyword: "shapewear", growthRate: 67, volume: 15600 },
    { keyword: "coque magsafe", growthRate: 78, volume: 18400 },
    { keyword: "tapis marche", growthRate: 72, volume: 11200 },
    { keyword: "sérum glass skin", growthRate: 91, volume: 9800 },
  ],
  JP: [
    { keyword: "加湿器 かわいい", growthRate: 112, volume: 18400 },
    { keyword: "弁当箱", growthRate: 78, volume: 12300 },
    { keyword: "美顔器 EMS", growthRate: 94, volume: 15600 },
    { keyword: "アニメネオン", growthRate: 106, volume: 8900 },
    { keyword: "MagSafe ケース", growthRate: 88, volume: 21000 },
  ],
  SA: [
    { keyword: "عباية سفر", growthRate: 124, volume: 9800 },
    { keyword: "مكواة عباية", growthRate: 118, volume: 7200 },
    { keyword: "سجادة صلاة ذكية", growthRate: 97, volume: 5400 },
    { keyword: "معطر عود", growthRate: 86, volume: 8100 },
    { keyword: "فانوس رمضان", growthRate: 132, volume: 11200 },
  ],
  US: [
    { keyword: "stanley tumbler dupe", growthRate: 156, volume: 52000 },
    { keyword: "walking pad", growthRate: 124, volume: 27400 },
    { keyword: "car detailing kit", growthRate: 98, volume: 18600 },
    { keyword: "shapewear", growthRate: 118, volume: 38000 },
    { keyword: "led strip lights", growthRate: 102, volume: 42000 },
  ],
  DE: [
    { keyword: "heißluftfritteuse", growthRate: 92, volume: 19800 },
    { keyword: "fahrradlicht", growthRate: 74, volume: 9100 },
    { keyword: "bambus besteck", growthRate: 68, volume: 6400 },
    { keyword: "monitorarm", growthRate: 71, volume: 7800 },
    { keyword: "yogamatte", growthRate: 58, volume: 10200 },
  ],
  BR: [
    { keyword: "cinta modeladora", growthRate: 138, volume: 35200 },
    { keyword: "arco de balões", growthRate: 121, volume: 21800 },
    { keyword: "prancha cerâmica", growthRate: 99, volume: 17600 },
    { keyword: "mixer portátil", growthRate: 83, volume: 12400 },
    { keyword: "projetor galaxia", growthRate: 91, volume: 9800 },
  ],
}

function jitter(value: number, pct = 0.08): number {
  const delta = value * pct * (Math.random() * 2 - 1)
  return Math.max(1, Math.round(value + delta))
}

export function buildMockTrendingForCountry(countryCode: string): Array<{
  countryCode: string
  keyword: string
  growthRate: number
  volume: number | null
}> {
  const code = countryCode.toUpperCase()
  const base = COUNTRY_TRENDING[code] ?? COUNTRY_TRENDING.FR
  return base.slice(0, 5).map((row) => ({
    countryCode: code,
    keyword: row.keyword,
    growthRate: jitter(row.growthRate, 0.04),
    volume: jitter(row.volume, 0.05),
  }))
}

export function localizeGenericTemplates(_country: WorldCountryDef): MockWinnerSeed[] {
  return []
}
