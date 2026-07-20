/**
 * World Radar V2 — country-differentiated scoring + weekly challenger rotation.
 * Client-safe.
 */

import {
  PRODUCT_POOL,
  resolveProductImage,
  resolveProductTitle,
  type ProductArchetype,
} from "@/lib/radar/product-pools"
import { getWorldCountry } from "@/lib/radar/world-countries"

export type ScoredCountryWinner = {
  productId: string
  countryCode: string
  rank: number
  title: string
  image: string | null
  source: string
  price: number
  currency: string
  growthRate: number
  searches: number
  competition: number
  trendingScore: number
  category: string
  finalScore: number
  isNew: boolean
  isHot: boolean
  isLocalWinner: boolean
  lastWeekRank: number | null
  supplierLabel: string
}

const SEARCH_BASE: Record<string, [number, number]> = {
  US: [15_000, 45_000],
  CA: [8_000, 22_000],
  UK: [10_000, 28_000],
  DE: [9_000, 25_000],
  FR: [8_000, 24_000],
  JP: [10_000, 30_000],
  KR: [8_000, 22_000],
  BR: [12_000, 35_000],
  MX: [7_000, 20_000],
  AU: [6_000, 18_000],
  SA: [4_000, 14_000],
  AE: [3_500, 12_000],
  MA: [2_000, 8_000],
  EG: [2_500, 9_000],
  IN: [10_000, 32_000],
  ID: [6_000, 18_000],
  VN: [4_000, 12_000],
  NG: [2_000, 7_000],
  ZA: [2_500, 8_000],
  CN: [12_000, 40_000],
}

const PRICE_MULT: Record<string, number> = {
  US: 1.4,
  CA: 1.3,
  AU: 1.4,
  NZ: 1.35,
  CH: 1.5,
  UK: 1.25,
  JP: 1.2,
  KR: 1.2,
  SG: 1.25,
  AE: 1.15,
  DE: 1.1,
  FR: 1.05,
  NL: 1.1,
  SE: 1.15,
  MA: 0.6,
  EG: 0.55,
  IN: 0.55,
  NG: 0.5,
  ID: 0.6,
  VN: 0.55,
  BR: 0.85,
  MX: 0.75,
  CO: 0.7,
  AR: 0.65,
  CN: 0.7,
  ZA: 0.65,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** ISO week number (1–53). */
export function getWeekNumber(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function affinityOf(product: ProductArchetype, country: string): number {
  return product.culturalAffinity[country] ?? 0.12
}

export function scoreProductForCountry(
  product: ProductArchetype,
  country: string,
  date = new Date(),
  trendingCategories: string[] = []
): number {
  const code = country.toUpperCase()
  const week = getWeekNumber(date)
  const month = date.getMonth() + 1
  const affinity = affinityOf(product, code)

  const baseScore = product.arbitragePotential
  const culturalBoost = affinity * 18
  /** Hard cultural gate — MENA items must not top JP and vice versa */
  const culturalPenalty = affinity < 0.28 ? -14 : affinity < 0.45 ? -5 : 0
  const seasonalityBoost = product.seasonality.includes(month) ? 10 : 0
  const categoryBoost = trendingCategories.includes(product.category) ? 12 : 0
  const randomVariance =
    Math.sin(hashString(`${product.id}:${code}:${week}`)) * 8
  const trendingBoost =
    product.tags.includes("tiktok_viral") && ["US", "BR", "FR", "JP", "MX"].includes(code)
      ? 5
      : 0

  return clamp(
    baseScore +
      culturalBoost +
      culturalPenalty +
      seasonalityBoost +
      categoryBoost +
      randomVariance +
      trendingBoost,
    65,
    98
  )
}

function growthFromScore(score: number, productId: string, country: string, week: number): number {
  const jitter = (hashString(`g:${productId}:${country}:${week}`) % 100) / 100
  if (score >= 95) return Math.round(180 + jitter * 70)
  if (score >= 85) return Math.round(90 + jitter * 80)
  return Math.round(40 + jitter * 50)
}

function searchesFor(country: string, affinity: number, productId: string, week: number): number {
  const [lo, hi] = SEARCH_BASE[country] ?? [3_000, 12_000]
  const span = hi - lo
  const seed = (hashString(`s:${productId}:${country}:${week}`) % 1000) / 1000
  return Math.round(lo + span * (0.35 + affinity * 0.5) * (0.7 + seed * 0.3))
}

function priceFor(product: ProductArchetype, country: string): number {
  const mult = PRICE_MULT[country] ?? 1
  const raw = product.basePrice * mult
  // JPY / KRW feel like integers
  if (country === "JP" || country === "KR") return Math.round(raw * 100)
  return Math.round(raw * 100) / 100
}

function competitionFromScore(score: number, productId: string, country: string): number {
  const n = 2 + (hashString(`c:${productId}:${country}`) % 18)
  if (score >= 90) return Math.min(n, 5)
  if (score >= 80) return Math.min(n, 12)
  return n
}

function supplierLabel(score: number): string {
  if (score > 90) return "✅ 3 fournisseurs EU - 4j"
  if (score >= 80) return "✅ 2 fournisseurs"
  return "⚠️ 1 fournisseur"
}

function sourceLabel(product: ProductArchetype, country: string): string {
  if (product.tags.includes("tiktok_viral")) return `Signaux social ${country}`
  if (product.tags.includes("amazon_best")) return `Signaux e-commerce ${country}`
  return `Signaux search ${country}`
}

type Ranked = { product: ProductArchetype; score: number }

function rankPool(
  country: string,
  date: Date,
  pool: ProductArchetype[],
  trendingCategories: string[]
): Ranked[] {
  const scored = pool.map((product) => ({
    product,
    score: scoreProductForCountry(product, country, date, trendingCategories),
    affinity: affinityOf(product, country),
  }))
  // Prefer culturally coherent SKUs when the pool is large enough
  const fit = scored.filter((r) => r.affinity >= 0.28)
  const use = fit.length >= 24 ? fit : scored
  return use
    .map(({ product, score }) => ({ product, score }))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
}

function pickChallengers(
  ranked: Ranked[],
  country: string,
  week: number,
  stableIds: Set<string>
): Ranked[] {
  const challengerBand = ranked.slice(14, 40).filter((r) => !stableIds.has(r.product.id))
  if (challengerBand.length === 0) return ranked.slice(14, 20)

  const countryHash = hashString(country) % 25
  const offset = (week + countryHash) % Math.max(1, challengerBand.length)
  const picked: Ranked[] = []
  for (let i = 0; i < 6; i++) {
    const row = challengerBand[(offset + i * 3) % challengerBand.length]
    if (row && !picked.some((p) => p.product.id === row.product.id)) picked.push(row)
  }
  // fill if duplicates
  for (const row of challengerBand) {
    if (picked.length >= 6) break
    if (!picked.some((p) => p.product.id === row.product.id)) picked.push(row)
  }
  return picked.slice(0, 6)
}

function toWinner(
  row: Ranked,
  country: string,
  date: Date,
  rank: number,
  isNew: boolean,
  lastWeekRank: number | null
): ScoredCountryWinner {
  const week = getWeekNumber(date)
  const code = country.toUpperCase()
  const currency = getWorldCountry(code)?.currency ?? "USD"
  const affinity = affinityOf(row.product, code)
  const growthRate = growthFromScore(row.score, row.product.id, code, week)
  const searches = searchesFor(code, affinity, row.product.id, week)
  const competition = competitionFromScore(row.score, row.product.id, code)
  const isLocalWinner = affinity >= 0.85

  return {
    productId: row.product.id,
    countryCode: code,
    rank,
    title: resolveProductTitle(row.product, code),
    image: resolveProductImage(row.product),
    source: sourceLabel(row.product, code),
    price: priceFor(row.product, code),
    currency,
    growthRate,
    searches,
    competition,
    trendingScore: Math.round(row.score),
    category: row.product.category,
    finalScore: Math.round(row.score * 10) / 10,
    isNew,
    isHot: growthRate > 150,
    isLocalWinner,
    lastWeekRank,
    supplierLabel: supplierLabel(row.score),
  }
}

/**
 * 14 evergreen stables + 6 weekly challengers — culturally unique per country.
 */
export function getWinnersForCountry(
  country: string,
  date = new Date(),
  trendingCategories: string[] = []
): ScoredCountryWinner[] {
  const code = country.toUpperCase()
  // Full pool + category boost (not hard filter) → cultural identity without overlap collapse
  const pool = PRODUCT_POOL
  const ranked = rankPool(code, date, pool, trendingCategories)
  const stables = ranked.slice(0, 14)
  const stableIds = new Set(stables.map((s) => s.product.id))
  const week = getWeekNumber(date)
  const challengers = pickChallengers(ranked, code, week, stableIds)

  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 7)
  const prevRanked = rankPool(code, prevDate, pool, trendingCategories)
  const prevRankMap = new Map(prevRanked.map((r, i) => [r.product.id, i + 1]))

  const combined = [
    ...stables.map((r) => ({ row: r, isNew: false })),
    ...challengers.map((r) => ({ row: r, isNew: true })),
  ]

  // Re-sort by score for display order but keep isNew flags
  combined.sort((a, b) => b.row.score - a.row.score)

  return combined.map((entry, index) =>
    toWinner(
      entry.row,
      code,
      date,
      index + 1,
      entry.isNew,
      prevRankMap.get(entry.row.product.id) ?? null
    )
  )
}

/** Diff helper for tests — unique product ids between countries. */
export function countDistinctProductIds(a: ScoredCountryWinner[], b: ScoredCountryWinner[]): number {
  const setB = new Set(b.map((w) => w.productId))
  return a.filter((w) => !setB.has(w.productId)).length
}

export function getPoolSize(): number {
  return PRODUCT_POOL.length
}
