import type { TrendingKeyword } from "@/lib/radar/crawler/types"

/** Curated FR GMC trends — shown when Serper/SerpAPI keys are absent (never expose env errors). */
export const FR_TRENDING_KEYWORDS_FALLBACK: TrendingKeyword[] = [
  { keyword: "coque magsafe iphone 15", volume: 18400, growth: 78 },
  { keyword: "led strip rgb wifi", volume: 22100, growth: 92 },
  { keyword: "shapewear ventre plat", volume: 15600, growth: 64 },
  { keyword: "gourde inox 1 litre", volume: 9800, growth: 55 },
  { keyword: "tapis de marche pliable", volume: 11200, growth: 71 },
  { keyword: "airfryer sans huile 5l", volume: 24500, growth: 88 },
]

export function trendingKeywordsFrFallback(seeds: string[]): TrendingKeyword[] {
  if (seeds.length === 0) return FR_TRENDING_KEYWORDS_FALLBACK
  const hay = seeds.map((s) => s.toLowerCase())
  const matched = FR_TRENDING_KEYWORDS_FALLBACK.filter((row) =>
    hay.some((seed) => row.keyword.includes(seed) || seed.split(" ").some((w) => row.keyword.includes(w)))
  )
  return matched.length > 0 ? matched : FR_TRENDING_KEYWORDS_FALLBACK
}
