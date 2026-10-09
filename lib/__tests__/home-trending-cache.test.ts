import { readFileSync } from "node:fs"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Wiring of the Home "Tendances" cache in lib/public-home-cache.ts (Lot 1A): it must wrap the loader that THROWS, never
 * the "Safe" one, keep a legitimate empty list cacheable, and leave every other cache of that file exactly as it was.
 * The generic mechanics (bucket, single-flight, logs) are covered by home-bucket-cache.test.ts.
 */

vi.mock("server-only", () => ({}))

const cacheFake = vi.hoisted(() => {
  const store = new Map<string, string>()
  const created: { keyParts: string[]; options: { revalidate?: number | false; tags?: string[] } }[] = []
  function unstable_cache<T>(
    cb: () => Promise<T>,
    keyParts: string[],
    options: { revalidate?: number | false; tags?: string[] }
  ) {
    created.push({ keyParts, options })
    const key = keyParts.join(",")
    return async (): Promise<T> => {
      if (store.has(key)) return JSON.parse(store.get(key)!) as T
      const result = await cb()
      store.set(key, JSON.stringify(result))
      return result
    }
  }
  return { store, created, unstable_cache }
})
vi.mock("next/cache", () => ({ unstable_cache: cacheFake.unstable_cache }))
vi.mock("@/lib/business-log", () => ({ logBusiness: () => {} }))

const loaders = vi.hoisted(() => ({
  throwing: vi.fn(),
  safe: vi.fn(),
}))
vi.mock("@/lib/home-marketplace-data", () => ({ loadHomeBestSellers7d: loaders.throwing }))
vi.mock("@/lib/public-home-data", () => ({
  loadHomeBestSellers7dSafe: loaders.safe,
  loadFeaturedShopsSafe: vi.fn(),
  loadHomeMarketplaceStatsSafe: vi.fn(),
}))
vi.mock("@/lib/buyer-premium-discover.server", () => ({ loadBuyerDiscoverCards: vi.fn() }))

import { HOME_CACHE_BUCKET_MS, __resetHomeBucketCacheForTests } from "@/lib/home-bucket-cache"
import {
  loadHomeBestSellers7dBucketed,
  loadHomeBestSellers7dBucketedSafe,
  loadHomeBestSellers7dCached,
} from "@/lib/public-home-cache"

// Caches created while the module was imported (the two module-level ones), captured before any test resets the fake.
const cachesCreatedAtImport = cacheFake.created.map((c) => ({ ...c }))

const NOW = new Date("2026-10-09T12:00:00.000Z")
const BUCKET = Math.floor(NOW.getTime() / HOME_CACHE_BUCKET_MS)

const card = (id: string) => ({
  listingId: `l-${id}`,
  productId: id,
  name: `Product ${id}`,
  imageUrl: null,
  priceCents: 2500,
  compareAtCents: null,
  soldCount: 7,
  marginCents: 1000,
  deliveryMin: null,
  deliveryMax: null,
  stock: 10,
  freeShipping: false,
  commissionPct: 20,
  averageRating: 4.5,
  reviewCount: 12,
  storeName: "Store",
  isBestSeller: true,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  cacheFake.store.clear()
  cacheFake.created.length = 0
  loaders.throwing.mockReset()
  loaders.safe.mockReset()
  __resetHomeBucketCacheForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("loadHomeBestSellers7dBucketed", () => {
  it("wraps the loader that throws, with the limit, and never the Safe one", async () => {
    loaders.throwing.mockResolvedValue([card("a")])

    await expect(loadHomeBestSellers7dBucketed(3)).resolves.toEqual([card("a")])

    expect(loaders.throwing).toHaveBeenCalledTimes(1)
    expect(loaders.throwing).toHaveBeenCalledWith(3)
    expect(loaders.safe).not.toHaveBeenCalled()
  })

  it("uses its own key (version, limit, 300 s bucket), a 900 s expiry and its own tag", async () => {
    loaders.throwing.mockResolvedValue([])

    await loadHomeBestSellers7dBucketed(3)

    expect(cacheFake.created).toEqual([
      { keyParts: ["home-best-sellers-v1", "3", String(BUCKET)], options: { revalidate: 900, tags: ["home-best-sellers"] } },
    ])
    expect(cacheFake.created[0]!.keyParts).not.toContain("home-best-sellers-7d") // not the Bento key
  })

  it("serves a HIT without running the loader, with the same structure (what the widget reads is unchanged)", async () => {
    loaders.throwing.mockResolvedValue([card("a"), card("b")])

    const first = await loadHomeBestSellers7dBucketed(3)
    const second = await loadHomeBestSellers7dBucketed(3)

    expect(loaders.throwing).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
    expect(second.map((c) => [c.listingId, c.name, c.imageUrl, c.soldCount])).toEqual([
      ["l-a", "Product a", null, 7],
      ["l-b", "Product b", null, 7],
    ])
  })

  it("caches a legitimate empty list", async () => {
    loaders.throwing.mockResolvedValue([])

    await expect(loadHomeBestSellers7dBucketed(3)).resolves.toEqual([])
    await expect(loadHomeBestSellers7dBucketed(3)).resolves.toEqual([])

    expect(loaders.throwing).toHaveBeenCalledTimes(1)
  })

  it("rejects when the loader fails and stores nothing", async () => {
    const boom = Object.assign(new Error("Server has closed the connection."), { code: "P1017" })
    loaders.throwing.mockRejectedValue(boom)

    await expect(loadHomeBestSellers7dBucketed(3)).rejects.toBe(boom)

    expect(cacheFake.store.size).toBe(0)
  })
})

describe("loadHomeBestSellers7dBucketedSafe", () => {
  it("falls back to [] on failure, logs like the old Safe loader, and the failure is NOT cached as []", async () => {
    const boom = new Error("connection reset")
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    loaders.throwing.mockRejectedValueOnce(boom).mockResolvedValue([card("a")])

    await expect(loadHomeBestSellers7dBucketedSafe(3)).resolves.toEqual([])
    expect(logged).toHaveBeenCalledWith("[public-home] loadHomeBestSellers7d failed:", boom)
    expect(cacheFake.store.size).toBe(0)

    // Same bucket, right after: the loader is asked again and the real list comes back (a cached [] would hide it).
    await expect(loadHomeBestSellers7dBucketedSafe(3)).resolves.toEqual([card("a")])
    expect(loaders.throwing).toHaveBeenCalledTimes(2)
  })

  it("returns a legitimate empty list as is, without logging an error, and keeps it cached", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    loaders.throwing.mockResolvedValue([])

    await expect(loadHomeBestSellers7dBucketedSafe(3)).resolves.toEqual([])
    await expect(loadHomeBestSellers7dBucketedSafe(3)).resolves.toEqual([])

    expect(logged).not.toHaveBeenCalled()
    expect(loaders.throwing).toHaveBeenCalledTimes(1)
  })
})

describe("the other caches of lib/public-home-cache.ts are untouched", () => {
  it("module-level caches keep their key, 60 s expiry and tag", () => {
    expect(cachesCreatedAtImport).toEqual([
      { keyParts: ["home-marketplace-stats"], options: { revalidate: 60, tags: ["home-bento"] } },
      { keyParts: ["buyer-discover-cards"], options: { revalidate: 60, tags: ["home-bento"] } },
    ])
  })

  it("the Bento best-sellers cache still wraps the Safe loader under its own key", async () => {
    loaders.safe.mockResolvedValue([])

    await loadHomeBestSellers7dCached(4)

    expect(cacheFake.created).toEqual([
      { keyParts: ["home-best-sellers-7d", "4"], options: { revalidate: 60, tags: ["home-bento"] } },
    ])
    expect(loaders.safe).toHaveBeenCalledWith(4)
    expect(loaders.throwing).not.toHaveBeenCalled()
  })

  it("the Safe loader is referenced exactly where it was before (import + the Bento cache): no new use", () => {
    const source = readFileSync("lib/public-home-cache.ts", "utf8")
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

    expect(code.match(/loadHomeBestSellers7dSafe/g)).toHaveLength(2)
    expect(code).toMatch(/load:\s*\(\)\s*=>\s*loadHomeBestSellers7d\(limit\)/)
    expect(code).not.toMatch(/\bafter\(/)
  })
})
