import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildMockWinnersForCountry } from "@/lib/radar/world-mock-catalog"
import { classifyLiveEventsSource } from "@/lib/radar/live-types"
import {
  classifyWinnersOrigin,
  isRealWinnerSource,
  noticeForSource,
  radarBadgeKind,
  radarPayloadFlags,
} from "@/lib/radar/world-radar-types"

/**
 * World Radar / globe: what a payload says about its own data must be true.
 * (Before: the generator's payload said `isLive: true` and "scanned now", the cache path replaced scanned rows with generated
 * ones, a country scanned with the generator was stamped as freshly scanned, and the globe called itself LIVE while 40 % of its
 * events were generated.)
 */

const HOUR = 60 * 60 * 1000

describe("provenance helpers (pure)", () => {
  it("only the real providers' labels count as real", () => {
    expect(isRealWinnerSource("Affisell")).toBe(true)
    expect(isRealWinnerSource("Google")).toBe(true)
    expect(isRealWinnerSource("Amazon")).toBe(false) // an older seed wrote marketplace names on generated rows
    expect(isRealWinnerSource("Signaux social FR")).toBe(false) // the legacy generated label
    expect(isRealWinnerSource("Démo · signaux simulés (social) FR")).toBe(false)
    expect(isRealWinnerSource(null)).toBe(false)
  })

  it("classifies a set of winners: empty and unverified rows are simulated, never live", () => {
    expect(classifyWinnersOrigin([])).toBe("mock")
    expect(classifyWinnersOrigin([{ source: "Affisell" }, { source: "Affisell" }])).toBe("live")
    expect(classifyWinnersOrigin([{ source: "Google" }])).toBe("live")
    expect(classifyWinnersOrigin([{ source: "Amazon" }, { source: "TikTok" }])).toBe("mock")
    expect(classifyWinnersOrigin([{ source: "Affisell" }, { source: "Signaux search DE" }])).toBe("mixed")
  })

  it("the generator labels every row as simulated, in every country", () => {
    for (const code of ["FR", "US", "JP", "SA", "BR", "DE"]) {
      const winners = buildMockWinnersForCountry(code, 20)
      expect(winners).toHaveLength(20)
      expect(winners.every((w) => !isRealWinnerSource(w.source))).toBe(true)
      expect(winners.every((w) => /^Démo/.test(w.source))).toBe(true)
      expect(classifyWinnersOrigin(winners)).toBe("mock")
    }
  })

  it("isLive needs real data AND a fresh scan; a simulated payload is never live, even with a fresh date", () => {
    const fresh = new Date(Date.now() - 10 * 60 * 1000)
    const stale = new Date(Date.now() - 3 * HOUR)
    expect(radarPayloadFlags("live", fresh)).toEqual({ isLive: true, isDemo: false, dataNotice: null })
    expect(radarPayloadFlags("live", stale).isLive).toBe(false)
    expect(radarPayloadFlags("live", null).isLive).toBe(false)
    for (const source of ["mock", "demo", "mixed"] as const) {
      expect(radarPayloadFlags(source, fresh).isLive).toBe(false)
      expect(radarPayloadFlags(source, fresh).isDemo).toBe(true)
    }
    expect(noticeForSource("mock")).toBe("mock")
    expect(noticeForSource("demo")).toBe("demo")
    expect(noticeForSource("mixed")).toBe("mixed")
    expect(noticeForSource("live")).toBeNull()
  })

  it("the terminal badge is 'live' only for real and fresh data; a demo flag wins over a scan date", () => {
    expect(radarBadgeKind(null)).toBe("cache")
    expect(radarBadgeKind(undefined)).toBe("cache")
    expect(radarBadgeKind({ isLive: true, isDemo: false })).toBe("live")
    expect(radarBadgeKind({ isLive: false, isDemo: false })).toBe("cache")
    expect(radarBadgeKind({ isLive: false, isDemo: true })).toBe("demo")
    // even a (wrongly) live-flagged payload is shown as demo when the server says it is not real data
    expect(radarBadgeKind({ isLive: true, isDemo: true })).toBe("demo")
    // an old API answer without the new fields never shows as demo, and is live only if the server said so
    expect(radarBadgeKind({ isLive: true })).toBe("live")
  })

  it("live globe events: live only when none is generated", () => {
    expect(classifyLiveEventsSource([])).toBe("demo")
    expect(classifyLiveEventsSource([{ synthetic: true }, { synthetic: true }])).toBe("demo")
    expect(classifyLiveEventsSource([{ synthetic: false }, {}])).toBe("live")
    // 60 % real used to be called "live"
    expect(classifyLiveEventsSource([{}, {}, {}, { synthetic: true }, { synthetic: true }])).toBe("mixed")
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// The store, with the radar database, the scanner and the enrichment mocked (no network, no database)
// ---------------------------------------------------------------------------------------------------------------------

type Row = {
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
  createdAt: Date
}

function row(i: number, source: string, createdAt = new Date()): Row {
  return {
    id: `r${i}`,
    countryCode: "DE",
    rank: i,
    title: `Real title ${i}`,
    image: null,
    source,
    price: 10 + i,
    currency: "EUR",
    growthRate: 50,
    searches: 1000,
    competition: 3,
    trendingScore: 90 - i,
    category: null,
    createdAt,
  }
}

type Setup = {
  dbUrl?: string
  cachedRows?: Row[]
  lastScanAt?: Date | null
  scan?: { winners: Array<Record<string, unknown>>; trending?: unknown[] } | "throw"
}

async function loadStore(setup: Setup) {
  vi.resetModules()
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      radarWinner: { deleteMany: vi.fn(), createMany: vi.fn() },
      radarTrendingKeyword: { deleteMany: vi.fn(), createMany: vi.fn() },
      radarCountry: { upsert: vi.fn() },
    })
  })
  vi.doMock("@/lib/radar/env", () => ({ resolveRadarDatabaseUrl: () => setup.dbUrl ?? "postgres://radar.invalid/db" }))
  vi.doMock("@/lib/prisma-radar", () => ({
    getRadarDb: () => ({
      radarCountry: {
        count: async () => 1,
        findUnique: async () => (setup.lastScanAt === undefined ? null : { lastScanAt: setup.lastScanAt, productCount: setup.cachedRows?.length ?? 0 }),
        findMany: async () => [],
        upsert: vi.fn(),
      },
      radarWinner: { findMany: async () => setup.cachedRows ?? [] },
      radarTrendingKeyword: { findMany: async () => [] },
      $transaction: transaction,
    }),
  }))
  vi.doMock("@/lib/radar/enrich-winners.server", () => ({
    enrichWorldRadarWinners: async (w: unknown[]) => w, // identity: what goes in must come out
  }))
  const scanFn = vi.fn(async () => {
    if (setup.scan === "throw") throw new Error("scan failed")
    const scan = setup.scan ?? { winners: [] }
    return {
      winners: scan.winners,
      trending: scan.trending ?? [],
      scannedAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * HOUR),
    }
  })
  vi.doMock("@/lib/radar/world-scanner", () => ({ runWorldRadarScan: scanFn }))
  const store = await import("@/lib/radar/world-radar-store.server")
  return { store, transaction, scanFn }
}

function scannedWinner(i: number, source: string) {
  return {
    countryCode: "DE",
    rank: i,
    title: `Scanned ${i}`,
    image: null,
    source,
    price: null,
    currency: "EUR",
    growthRate: 40,
    searches: 2000,
    competition: 8,
    trendingScore: 70,
    category: null,
  }
}

describe("World Radar store — truthful provenance (mocked database and scanner)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.doUnmock("@/lib/radar/env")
    vi.doUnmock("@/lib/prisma-radar")
    vi.doUnmock("@/lib/radar/enrich-winners.server")
    vi.doUnmock("@/lib/radar/world-scanner")
    vi.restoreAllMocks()
  })

  it("the generator's payload is simulated: source mock, never live, no scan date, banner code", async () => {
    const { store } = await loadStore({ dbUrl: "", scan: "throw" })
    const payload = await store.getWorldRadarPayload("DE")
    expect(payload.source).toBe("mock")
    expect(payload.servedFrom).toBe("mock")
    expect(payload.isLive).toBe(false) // it used to be true
    expect(payload.isDemo).toBe(true)
    expect(payload.dataNotice).toBe("mock")
    expect(payload.lastScanAt).toBeNull() // it used to be "now"
    expect(payload.country.lastScanAt).toBeNull()
    expect(payload.country.isLive).toBe(false)
    expect(payload.winners.length).toBeGreaterThan(0)
    expect(payload.winners.every((w) => w.synthetic === true)).toBe(true)
  })

  it("a cold scan that only produced generated rows is served as mock and is NOT persisted or stamped as scanned", async () => {
    const { store, transaction, scanFn } = await loadStore({
      scan: { winners: [scannedWinner(1, "Démo · signaux simulés (search) DE"), scannedWinner(2, "Démo · signaux simulés (social) DE")] },
    })
    const payload = await store.getWorldRadarPayload("DE")
    expect(scanFn).toHaveBeenCalledTimes(1)
    expect(transaction).not.toHaveBeenCalled()
    expect(payload.source).toBe("mock")
    expect(payload.isLive).toBe(false)
    expect(payload.lastScanAt).toBeNull()
  })

  it("a real scan is live, served from 'scan', persisted, and keeps the scanned rows (no mock overwrite)", async () => {
    const { store, transaction } = await loadStore({
      scan: { winners: [scannedWinner(1, "Google"), scannedWinner(2, "Google")] },
    })
    const payload = await store.getWorldRadarPayload("DE")
    expect(payload.source).toBe("live")
    expect(payload.servedFrom).toBe("scan")
    expect(payload.isLive).toBe(true)
    expect(payload.isDemo).toBe(false)
    expect(payload.dataNotice).toBeNull()
    expect(payload.winners.map((w) => w.title)).toEqual(["Scanned 1", "Scanned 2"])
    expect(payload.winners.every((w) => w.synthetic === false)).toBe(true)
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it("a cache hit of real rows keeps them: withMoats no longer replaces non-FR data with generated rows", async () => {
    const { store, scanFn } = await loadStore({
      cachedRows: [row(1, "Google"), row(2, "Google"), row(3, "Google")],
      lastScanAt: new Date(Date.now() - 20 * 60 * 1000),
    })
    const payload = await store.getWorldRadarPayload("DE")
    expect(scanFn).not.toHaveBeenCalled()
    expect(payload.servedFrom).toBe("cache")
    expect(payload.source).toBe("live")
    expect(payload.isLive).toBe(true)
    expect(payload.winners.map((w) => w.title)).toEqual(["Real title 1", "Real title 2", "Real title 3"])
  })

  it("a stale real cache is still real data but no longer 'live'", async () => {
    const { store } = await loadStore({
      cachedRows: [row(1, "Affisell")],
      lastScanAt: new Date(Date.now() - 3 * HOUR),
    })
    const payload = await store.getWorldRadarPayload("DE")
    expect(payload.source).toBe("live")
    expect(payload.isLive).toBe(false)
    expect(payload.isDemo).toBe(false)
  })

  it("cached rows whose source is not a real provider (older generated rows) are not served as a cache hit", async () => {
    const { store, scanFn } = await loadStore({
      cachedRows: [row(1, "Amazon"), row(2, "Signaux social DE")],
      lastScanAt: new Date(),
      scan: { winners: [scannedWinner(1, "Google")] },
    })
    const payload = await store.getWorldRadarPayload("DE")
    expect(scanFn).toHaveBeenCalledTimes(1)
    expect(payload.servedFrom).toBe("scan")
    expect(payload.winners.map((w) => w.title)).toEqual(["Scanned 1"])
  })

  it("older generated rows with no real scan available end up as an explicit mock payload, not a 'live' cache", async () => {
    const { store } = await loadStore({
      cachedRows: [row(1, "Amazon"), row(2, "TikTok")],
      lastScanAt: new Date(),
      scan: "throw",
    })
    const payload = await store.getWorldRadarPayload("DE")
    expect(payload.source).toBe("mock")
    expect(payload.isLive).toBe(false)
    expect(payload.lastScanAt).toBeNull()
  })

  it("an unknown country falls back to the generator and says so", async () => {
    const { store } = await loadStore({ dbUrl: "" })
    const payload = await store.getWorldRadarPayload("ZZ")
    expect(payload.source).toBe("mock")
    expect(payload.isLive).toBe(false)
  })

  it("persistWorldRadarScan refuses to store generated rows", async () => {
    const { store, transaction } = await loadStore({})
    await store.persistWorldRadarScan({
      countryCode: "DE",
      winners: buildMockWinnersForCountry("DE", 5),
      trending: [],
      scannedAt: new Date(),
      expiresAt: new Date(Date.now() + HOUR),
    })
    expect(transaction).not.toHaveBeenCalled()
  })

  it("the countries list without a radar database lists markets but claims no scan: no date, no counts, never live", async () => {
    const { store } = await loadStore({ dbUrl: "" })
    const payload = await store.getWorldRadarCountriesPayload()
    expect(payload.source).toBe("mock")
    expect(payload.total).toBeGreaterThanOrEqual(30)
    expect(payload.countries.every((c) => c.isLive === false && c.lastScanAt === null && c.productCount === 0)).toBe(true)
  })

  it("the cron reports a generated-only scan as not persisted", async () => {
    const { store } = await loadStore({
      scan: { winners: [scannedWinner(1, "Démo · signaux simulés (search) DE")] },
    })
    const results = await store.scanAndPersistCountries(["DE"])
    expect(results).toEqual([{ country: "DE", winners: 1, ok: true, origin: "mock", persisted: false }])
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// The globe aggregator
// ---------------------------------------------------------------------------------------------------------------------

function orderRow(i: number, country: string | null) {
  return {
    id: `o${i}`,
    createdAt: new Date(Date.now() - i * 60_000),
    sellingPriceCents: 2500,
    shippingAddress: country ? { country, city: "Somewhere" } : null,
    affiliateProductId: null,
    product: { id: `p${i}`, name: `Product ${i}`, images: [], categories: ["Home"], sourceUrl: null, videoAdUrl: null },
  }
}

async function loadAggregator(orders: unknown[]) {
  vi.resetModules()
  vi.doMock("@/lib/prisma", () => ({
    prisma: {
      order: { findMany: async () => orders, groupBy: async () => [] },
      product: { findMany: async () => [] },
      affiliateProduct: { findMany: async () => [] },
    },
  }))
  return import("@/lib/radar/live-aggregator")
}

describe("globe live events — provenance of what is returned", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.doUnmock("@/lib/prisma")
    vi.restoreAllMocks()
  })

  it("no order, no import: every event is generated, flagged, and the source is 'demo'", async () => {
    const { aggregateRadarLiveEvents } = await loadAggregator([])
    const res = await aggregateRadarLiveEvents()
    expect(res.source).toBe("demo")
    expect(res.events.length).toBeGreaterThan(0)
    expect(res.events.every((e) => e.synthetic === true && e.locationSource === "estimated")).toBe(true)
    expect(res.syntheticCount).toBe(res.events.length)
  })

  it("a few real orders padded with generated events: 'mixed', real ones unflagged, generated ones flagged", async () => {
    const { aggregateRadarLiveEvents } = await loadAggregator([orderRow(1, "DE"), orderRow(2, "FR"), orderRow(3, null)])
    const res = await aggregateRadarLiveEvents()
    expect(res.source).toBe("mixed")
    const real = res.events.filter((e) => !e.synthetic)
    expect(real).toHaveLength(3)
    expect(res.syntheticCount).toBe(res.events.length - 3)
    expect(real.find((e) => e.id === "sale_o1")?.locationSource).toBe("order")
    // an order with no shipping country is pinned on a default city: that pin is an estimate
    expect(real.find((e) => e.id === "sale_o3")?.locationSource).toBe("estimated")
  })

  it("enough real orders (no padding): 'live', nothing generated", async () => {
    const orders = Array.from({ length: 14 }, (_, i) => orderRow(i + 1, "FR"))
    const { aggregateRadarLiveEvents } = await loadAggregator(orders)
    const res = await aggregateRadarLiveEvents()
    expect(res.source).toBe("live")
    expect(res.syntheticCount).toBe(0)
    expect(res.events.every((e) => e.synthetic === false)).toBe(true)
  })
})
