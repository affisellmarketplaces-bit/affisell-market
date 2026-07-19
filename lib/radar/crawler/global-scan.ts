import "server-only"

import { crawlBestSellers } from "@/lib/radar/crawler/category-crawler"
import { RADAR_SCAN_CATEGORIES } from "@/lib/radar/crawler/types"
import { isShopeeCountry } from "@/lib/radar/connectors/shopee"
import { acquireCronLock, releaseCronLock } from "@/lib/radar/cron-lock"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { isRadarEnabled } from "@/lib/radar/gate"
import { utcDay } from "@/lib/radar/writers/product-writer"
import { upsertProductSnapshot } from "@/lib/radar/writers/product-writer"
import { upsertStandardProductFromSnapshot } from "@/lib/radar/writers/standard-product-writer"

/** Default cross-country set for price comparison (override via RADAR_COUNTRIES). */
export const DEFAULT_RADAR_COUNTRIES = ["FR", "US", "MX", "DE", "GB"] as const

const COUNTRY_LOCK_TTL_SEC = 280

export type CountryCrawlResult = {
  country: string
  snapshots: number
  products: number
  new: number
  updated: number
  errors: string[]
  skipped?: boolean
  reason?: string
  lockBackend?: "redis" | "memory"
}

export type RadarGlobalScanResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  scanned: number
  new: number
  updated: number
  errors: number
  countries: string[]
  jobs: CountryCrawlResult[]
  /** Present when TikTok/Serper keys are absent — Amazon/local still ran. */
  degraded?: boolean
  missingOptional?: string[]
}

export function parseRadarCountries(raw?: string | null): string[] {
  const fromEnv = process.env.RADAR_COUNTRIES?.trim()
  const source = raw?.trim() || fromEnv || DEFAULT_RADAR_COUNTRIES.join(",")
  const list = source
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c))
  const unique = [...new Set(list)]
  return unique.length > 0 ? unique : [...DEFAULT_RADAR_COUNTRIES]
}

/** Marketplaces to crawl for a country (Shopee only on SEA hosts). */
export function marketplacesForCountry(country: string): string[] {
  const cc = country.trim().toUpperCase()
  const base = ["tiktok_shop", "amazon"]
  if (isShopeeCountry(cc)) return [...base, "shopee"]
  return base
}

function missingOptionalCrawlerKeys(): string[] {
  const keys = ["TIKTOK_CRAWLER_ACCESS_TOKEN", "SERPER_API_KEY"] as const
  return keys.filter((k) => !process.env[k]?.trim())
}

function countryLockKey(country: string, day = utcDay()): string {
  return `radar:global-scan:${country.toUpperCase()}:${day.toISOString().slice(0, 10)}`
}

/**
 * Parallel country jobs via Promise.allSettled — one failure does not abort others.
 * Exported for unit tests with a mock crawlFn.
 */
export async function runParallelCountryCrawls(
  countries: string[],
  crawlFn: (country: string) => Promise<CountryCrawlResult>
): Promise<CountryCrawlResult[]> {
  const settled = await Promise.allSettled(countries.map((c) => crawlFn(c)))
  return settled.map((result, i) => {
    const country = countries[i] ?? "??"
    if (result.status === "fulfilled") return result.value
    const message = result.reason instanceof Error ? result.reason.message : "unknown"
    console.error("[radar/global-scan]", { country, result: "country_rejected", message })
    return {
      country,
      snapshots: 0,
      products: 0,
      new: 0,
      updated: 0,
      errors: [message],
    }
  })
}

/**
 * Crawl TikTok + Amazon (+ Shopee if SEA) for one country, upsert snapshots + StandardProduct.
 */
export async function crawlForCountry(country: string): Promise<CountryCrawlResult> {
  const cc = country.trim().toUpperCase() || "US"
  const errors: string[] = []
  let snapshots = 0
  let products = 0
  let created = 0
  let updated = 0

  const lockKey = countryLockKey(cc)
  const lock = await acquireCronLock(lockKey, COUNTRY_LOCK_TTL_SEC)
  if (!lock.acquired) {
    console.log("[radar/global-scan]", {
      country: cc,
      result: "skipped_lock",
      backend: lock.backend,
    })
    return {
      country: cc,
      snapshots: 0,
      products: 0,
      new: 0,
      updated: 0,
      errors: [],
      skipped: true,
      reason: "lock_held",
      lockBackend: lock.backend,
    }
  }

  try {
    for (const marketplaceId of marketplacesForCountry(cc)) {
      for (const category of RADAR_SCAN_CATEGORIES) {
        try {
          const rows = await crawlBestSellers(marketplaceId, category, cc)
          for (const p of rows) {
            try {
              const snap = await upsertProductSnapshot({
                marketplaceId: p.marketplaceId,
                externalId: p.externalId,
                title: p.title,
                price: p.price,
                category: p.category ?? category,
                country: p.country || cc,
                rank: p.rank,
                salesEst: p.salesEst,
                url: p.url,
                currency: p.currency,
                imageUrl: p.imageUrl,
                crawledAt: p.crawledAt,
              })
              snapshots += 1
              if (snap.created) created += 1
              else updated += 1

              const std = await upsertStandardProductFromSnapshot({
                marketplaceId: p.marketplaceId,
                externalId: p.externalId,
                title: p.title,
                price: p.price,
                currency: p.currency,
                imageUrl: p.imageUrl,
                country: p.country || cc,
                url: p.url,
                day: snap.day,
                sales: p.salesEst,
                rank: p.rank,
              })
              if (std) products += 1
            } catch (rowErr) {
              const message = rowErr instanceof Error ? rowErr.message : "row_failed"
              errors.push(`${marketplaceId}/${category}: ${message}`)
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "marketplace_failed"
          errors.push(`${marketplaceId}/${category}: ${message}`)
          console.error("[radar/global-scan]", {
            country: cc,
            marketplaceId,
            category,
            result: "marketplace_failed",
            message,
          })
        }
      }
    }

    console.log("[radar/global-scan]", {
      country: cc,
      snapshots,
      products,
      errors: errors.length,
      lockBackend: lock.backend,
    })

    return {
      country: cc,
      snapshots,
      products,
      new: created,
      updated,
      errors,
      lockBackend: lock.backend,
    }
  } finally {
    await releaseCronLock(lockKey)
  }
}

/** Shared global scan used by cron + authenticated Force Scan — parallel countries. */
export async function runRadarGlobalScan(opts?: {
  countries?: string[]
}): Promise<RadarGlobalScanResult> {
  if (!isRadarEnabled()) {
    console.log("[radar/global-scan]", { result: "skipped_disabled" })
    return {
      ok: true,
      skipped: true,
      reason: "RADAR_ENABLED=false",
      scanned: 0,
      new: 0,
      updated: 0,
      errors: 0,
      countries: [],
      jobs: [],
    }
  }

  if (!resolveRadarDatabaseUrl()) {
    console.log("[radar/global-scan]", { result: "skipped_no_db" })
    return {
      ok: true,
      skipped: true,
      reason: "no_database_url",
      scanned: 0,
      new: 0,
      updated: 0,
      errors: 0,
      countries: [],
      jobs: [],
    }
  }

  const countries = opts?.countries?.length
    ? [...new Set(opts.countries.map((c) => c.toUpperCase()))]
    : parseRadarCountries()

  const missingOptional = missingOptionalCrawlerKeys()
  if (missingOptional.length > 0) {
    console.log("[radar/global-scan]", {
      result: "degraded_mode",
      missingOptional,
      countries,
      note: "Parallel country crawl continues with available sources",
    })
  }

  const jobs = await runParallelCountryCrawls(countries, crawlForCountry)

  const scanned = jobs.reduce((s, j) => s + j.snapshots, 0)
  const created = jobs.reduce((s, j) => s + j.new, 0)
  const updated = jobs.reduce((s, j) => s + j.updated, 0)
  const errorCount = jobs.reduce((s, j) => s + j.errors.length, 0)

  console.log("[radar/global-scan]", {
    result: "done",
    countries,
    scanned,
    new: created,
    updated,
    errors: errorCount,
    jobs: jobs.map((j) => ({
      country: j.country,
      snapshots: j.snapshots,
      products: j.products,
      errors: j.errors.length,
      skipped: j.skipped,
    })),
    degraded: missingOptional.length > 0,
  })

  return {
    ok: true,
    scanned,
    new: created,
    updated,
    errors: errorCount,
    countries,
    jobs,
    ...(missingOptional.length > 0
      ? { degraded: true, missingOptional }
      : {}),
  }
}
