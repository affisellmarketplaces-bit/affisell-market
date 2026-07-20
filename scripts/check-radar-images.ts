/**
 * Assert World Radar winners expose unique product images (no category-shared thumbnails).
 * Usage: npx tsx scripts/check-radar-images.ts
 */

import { PRODUCT_POOL } from "../lib/radar/product-pools"
import { getWinnersForCountry } from "../lib/radar/scoring-engine"
import { WORLD_RADAR_COUNTRIES } from "../lib/radar/world-countries"

function checkCountry(code: string): number {
  const cats = WORLD_RADAR_COUNTRIES.find((c) => c.code === code)?.trendingCategories ?? []
  const winners = getWinnersForCountry(code, new Date(), cats)
  const urls = winners.map((w) => w.image).filter((u): u is string => Boolean(u))
  const unique = new Set(urls)
  console.log(`[check-radar-images] ${code}: ${unique.size}/${winners.length} uniques`)
  if (unique.size < 18) {
    console.error("[check-radar-images]", { result: "DUPLICATES_FOUND", country: code, urls })
    process.exit(1)
  }
  return unique.size
}

const poolUrls = PRODUCT_POOL.map((p) => p.imageUrl)
const poolUnique = new Set(poolUrls)
console.log(`[check-radar-images] pool: ${poolUnique.size}/${PRODUCT_POOL.length} uniques`)
if (poolUnique.size !== PRODUCT_POOL.length) {
  const dupes = poolUrls.filter((url, i) => poolUrls.indexOf(url) !== i)
  console.error("[check-radar-images]", { result: "POOL_DUPLICATES", dupes: [...new Set(dupes)] })
  process.exit(1)
}

for (const code of ["FR", "JP", "SA", "US", "DE", "BR"] as const) {
  checkCountry(code)
}

console.log("[check-radar-images] OK - Images uniques")
