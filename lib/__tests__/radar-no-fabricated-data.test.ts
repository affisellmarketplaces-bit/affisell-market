import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HOT_SPIKE_SALES_PER_HOUR, pinColor } from "@/lib/radar/live-pin"
import { computeSaturation } from "@/lib/radar/saturation"
import { buildMockTrendingForCountry, isGeneratedTrendingKeyword } from "@/lib/radar/world-mock-catalog"
import { isCountrySelectable, trendingForSource } from "@/lib/radar/world-radar-types"

/**
 * Review #22 / #23 / #24 — nothing fabricated under a LIVE badge.
 *
 *  #22  the "Trending Keywords" of a live payload were the hand-typed list re-jittered with Math.random; the Affisell and Serper
 *       rows carried constants (growth 55, searches 8000, competition 3 / 8) and the saturation "prediction" ran on them.
 *  #23  the globe sidebar showed "+137 %" and a "24 h curve" that are pure functions of an order id, next to a real sale.
 *  #24  the country picker locked every never-scanned country as "Analysis in progress", including all 31 when the radar
 *       database is unreachable.
 */

const ROOT = process.cwd()
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8")
const HOUR = 60 * 60 * 1000

// ---------------------------------------------------------------------------------------------------------------------
// #22 — scanner
// ---------------------------------------------------------------------------------------------------------------------

type ScannerSetup = {
  affisellRows?: Array<{ rank: number | null; title: string; price: number; salesEst: number | null }>
  serperConfigured?: boolean
  serperKeywords?: Array<{ keyword: string; volume: number; growth: number }>
}

async function loadScanner(setup: ScannerSetup) {
  vi.resetModules()
  vi.doMock("@/lib/radar/affisell-fr-catalog.server", () => ({
    loadAffisellFrRadarWinners: async () =>
      (setup.affisellRows ?? []).map((r, i) => ({
        id: `a${i}`,
        title: r.title,
        marketplaceId: "affisell_fr",
        country: "FR",
        price: r.price,
        currency: "EUR",
        rank: r.rank,
        salesEst: r.salesEst,
        imageUrl: null,
        url: null,
        crawledAt: new Date(),
      })),
  }))
  vi.doMock("@/lib/radar/crawler/serper-client", () => ({ isSerperConfigured: () => setup.serperConfigured === true }))
  vi.doMock("@/lib/radar/google/trends-watcher", () => ({ getTrendingKeywords: async () => setup.serperKeywords ?? [] }))
  return import("@/lib/radar/world-scanner")
}

describe("#22 scanner: no generated trending, no constant-filled metrics", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.doUnmock("@/lib/radar/affisell-fr-catalog.server")
    vi.doUnmock("@/lib/radar/crawler/serper-client")
    vi.doUnmock("@/lib/radar/google/trends-watcher")
    vi.restoreAllMocks()
  })

  it("with no trending source, the scan returns NO trending keywords (it used to return the hand-typed list with Math.random jitter)", async () => {
    const scanner = await loadScanner({
      affisellRows: Array.from({ length: 6 }, (_, i) => ({ rank: i + 1, title: `Affisell ${i}`, price: 20, salesEst: 4 })),
      serperConfigured: false,
    })
    const scan = await scanner.runWorldRadarScan("FR")
    expect(scan.winners.every((w) => w.source === "Affisell")).toBe(true)
    expect(scan.trending).toEqual([])
  })

  it("a configured source that finds nothing high-growth also yields no trending (no fallback to the generator)", async () => {
    const scanner = await loadScanner({ serperConfigured: true, serperKeywords: [] })
    expect(await scanner.scanCountryTrending("DE")).toEqual([])
  })

  it("real keywords from the trends source are passed through untouched", async () => {
    const scanner = await loadScanner({
      serperConfigured: true,
      serperKeywords: [{ keyword: "veste pluie", volume: 3200, growth: 88 }],
    })
    expect(await scanner.scanCountryTrending("DE")).toEqual([
      { countryCode: "DE", keyword: "veste pluie", growthRate: 88, volume: 3200 },
    ])
  })

  it("Affisell rows carry only real fields: growth, searches and competition are unknown (null), never 55 / 8000 / 3 or a formula", async () => {
    const scanner = await loadScanner({
      affisellRows: [
        { rank: 1, title: "With sales", price: 25, salesEst: 12 },
        { rank: 2, title: "No sales", price: 15, salesEst: null },
        ...Array.from({ length: 4 }, (_, i) => ({ rank: i + 3, title: `Other ${i}`, price: 10, salesEst: null })),
      ],
    })
    const winners = await scanner.scanCountryWinners("FR")
    expect(winners).toHaveLength(6)
    for (const w of winners) {
      expect(w.source).toBe("Affisell")
      expect(w.growthRate).toBeNull() // used to be min(150, 40 + sales * 2) or 55
      expect(w.searches).toBeNull() // used to be sales * 120 or 8000
      expect(w.competition).toBeNull() // used to be the constant 3
    }
    expect(winners[0]).toMatchObject({ title: "With sales", price: 25 }) // the real fields stay
  })

  it("Serper rows keep the API's growth and volume but no constant competition", async () => {
    const scanner = await loadScanner({
      serperConfigured: true,
      serperKeywords: [{ keyword: "tapis yoga", volume: 5000, growth: 90 }],
    })
    const winners = await scanner.scanCountryWinners("DE")
    const google = winners.filter((w) => w.source === "Google")
    expect(google).toHaveLength(1)
    expect(google[0]).toMatchObject({ growthRate: 90, searches: 5000, competition: null })
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// #22 — pure helpers
// ---------------------------------------------------------------------------------------------------------------------

describe("#22 generated trending is recognised and never served under a live payload", () => {
  it("recognises the hand-typed keywords of every market (also the ones stored by the old scan)", () => {
    for (const code of ["FR", "US", "JP", "SA", "DE", "BR"]) {
      for (const row of buildMockTrendingForCountry(code)) {
        expect(isGeneratedTrendingKeyword(row.keyword), `${code}: ${row.keyword}`).toBe(true)
      }
    }
    expect(isGeneratedTrendingKeyword("  AirFryer 5L ")).toBe(true)
    expect(isGeneratedTrendingKeyword("veste pluie")).toBe(false)
  })

  it("trendingForSource: live payload drops generated rows; simulated payload keeps them flagged synthetic", () => {
    const rows = [
      { id: "t1", keyword: "airfryer 5l", growthRate: 80, volume: 100, synthetic: true },
      { id: "t2", keyword: "veste pluie", growthRate: 88, volume: 3200, synthetic: false },
    ]
    expect(trendingForSource("live", rows).map((r) => r.keyword)).toEqual(["veste pluie"])
    expect(trendingForSource("mock", rows).map((r) => [r.keyword, r.synthetic])).toEqual([
      ["airfryer 5l", true],
      ["veste pluie", false],
    ])
    expect(trendingForSource("mixed", rows)).toHaveLength(2)
  })

  it("saturation: with an unknown growth rate there is no 'days until saturation' prediction", () => {
    const withGrowth = computeSaturation({ competition: 2, searches: 20_000, growthRate: 100 })
    expect(withGrowth.daysUntilSaturation).toBeGreaterThan(0)
    const unknown = computeSaturation({ competition: 2, searches: 20_000, growthRate: null })
    expect(unknown.daysUntilSaturation).toBeNull() // it used to assume growth = 1 and print "~300 jours"
    expect(unknown.prediction).toBeNull()
    expect(unknown.tier).toBe("vierge") // the tier itself only needs competition and searches
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// #22 — enrichment and store
// ---------------------------------------------------------------------------------------------------------------------

function winnerDto(over: Record<string, unknown>) {
  return {
    id: "w1",
    countryCode: "FR",
    rank: 1,
    title: "Row",
    image: null,
    source: "Affisell",
    price: 10,
    currency: "EUR",
    growthRate: null,
    searches: null,
    competition: null,
    trendingScore: 70,
    category: null,
    ...over,
  }
}

describe("#22 enrichment never computes a score from invented defaults", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/radar/supplier-match.server")
  })

  it("rows with unknown metrics get no arbitrage score and no saturation; complete rows still do", async () => {
    vi.resetModules()
    vi.doMock("@/lib/radar/supplier-match.server", () => ({ matchSuppliersForWinners: async () => new Map() }))
    const { enrichWorldRadarWinners } = await import("@/lib/radar/enrich-winners.server")
    const [unknown, partial, complete] = await enrichWorldRadarWinners([
      winnerDto({ id: "u" }),
      winnerDto({ id: "p", growthRate: 60, searches: 9000, competition: null }),
      winnerDto({ id: "c", source: "Démo", growthRate: 120, searches: 30_000, competition: 3 }),
    ] as never)
    // it used to score growth=0, searches=0, competition=10 and call the product "Vierge, saturating in ~300 days"
    expect(unknown!.arbitrage).toBeUndefined()
    expect(unknown!.saturation).toBeUndefined()
    expect(partial!.arbitrage).toBeUndefined() // competition unknown: the formula would assume 10
    expect(partial!.saturation).toBeUndefined()
    expect(complete!.arbitrage).toBeDefined()
    expect(complete!.saturation).toBeDefined()
    expect(unknown!.supplierMatch).toEqual({ count: 0, sampleNames: [] }) // the real moat is untouched
  })
})

type Row = { id: string; keyword: string; growthRate: number; volume: number | null }

async function loadStore(setup: {
  winners: Array<Record<string, unknown>>
  trending: Row[]
  scan?: { winners: Array<Record<string, unknown>>; trending: Array<Record<string, unknown>> }
}) {
  vi.resetModules()
  vi.doMock("@/lib/radar/env", () => ({ resolveRadarDatabaseUrl: () => "postgres://radar.invalid/db" }))
  vi.doMock("@/lib/prisma-radar", () => ({
    getRadarDb: () => ({
      radarCountry: {
        count: async () => 1,
        findUnique: async () => ({ lastScanAt: new Date(Date.now() - 10 * 60 * 1000), productCount: setup.winners.length }),
        findMany: async () => [],
        upsert: vi.fn(),
      },
      radarWinner: { findMany: async () => setup.winners },
      radarTrendingKeyword: { findMany: async () => setup.trending },
      $transaction: async () => undefined,
    }),
  }))
  vi.doMock("@/lib/radar/enrich-winners.server", () => ({ enrichWorldRadarWinners: async (w: unknown[]) => w }))
  vi.doMock("@/lib/radar/world-scanner", () => ({
    runWorldRadarScan: async () => ({
      winners: setup.scan?.winners ?? [],
      trending: setup.scan?.trending ?? [],
      scannedAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * HOUR),
    }),
  }))
  return import("@/lib/radar/world-radar-store.server")
}

const realRow = (i: number) => ({
  id: `r${i}`, countryCode: "FR", rank: i, title: `Real ${i}`, image: null, source: "Affisell", price: 10, currency: "EUR",
  growthRate: null, searches: null, competition: null, trendingScore: 70, category: null, createdAt: new Date(),
})

describe("#22 the live payload carries no generated trending", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    for (const m of ["@/lib/radar/env", "@/lib/prisma-radar", "@/lib/radar/enrich-winners.server", "@/lib/radar/world-scanner"]) vi.doUnmock(m)
    vi.restoreAllMocks()
  })

  it("a cache written by the OLD scan (real winners + generated trending) is served live WITHOUT the generated keywords", async () => {
    const generated = buildMockTrendingForCountry("FR").map((t, i) => ({ id: `t${i}`, keyword: t.keyword, growthRate: t.growthRate, volume: t.volume }))
    const store = await loadStore({ winners: [realRow(1), realRow(2)], trending: generated })
    const payload = await store.getWorldRadarPayload("FR")
    expect(payload.source).toBe("live")
    expect(payload.isLive).toBe(true)
    expect(payload.trendingKeywords).toEqual([]) // it used to serve "airfryer 5l +88 % 24 500/month" as live
  })

  it("real cached keywords stay, flagged non-synthetic", async () => {
    const store = await loadStore({
      winners: [realRow(1)],
      trending: [{ id: "k1", keyword: "veste pluie", growthRate: 88, volume: 3200 }],
    })
    const payload = await store.getWorldRadarPayload("FR")
    expect(payload.trendingKeywords).toEqual([{ id: "k1", keyword: "veste pluie", growthRate: 88, volume: 3200, synthetic: false }])
  })

  it("a cold real scan serves only the scanner's real keywords", async () => {
    const store = await loadStore({
      winners: [],
      trending: [],
      scan: {
        winners: [{ countryCode: "FR", rank: 1, title: "Scanned", image: null, source: "Affisell", price: 9, currency: "EUR", growthRate: null, searches: null, competition: null, trendingScore: 71, category: null }],
        trending: [],
      },
    })
    const payload = await store.getWorldRadarPayload("FR")
    expect(payload.source).toBe("live")
    expect(payload.servedFrom).toBe("scan")
    expect(payload.trendingKeywords).toEqual([])
  })

  it("the generator's payload (a demo) still shows trending, every keyword flagged synthetic", async () => {
    const store = await loadStore({ winners: [], trending: [] })
    const payload = await store.getWorldRadarPayload("DE")
    expect(payload.source).toBe("mock")
    expect(payload.trendingKeywords.length).toBeGreaterThan(0)
    expect(payload.trendingKeywords.every((t) => t.synthetic === true)).toBe(true)
  })
})

describe("#22 the terminal says so", () => {
  it("shows a demo tag on generated keywords and an honest empty state instead of an empty or invented panel", () => {
    const terminal = read("components/radar/world-radar-terminal.tsx")
    expect(terminal).toContain("kw.synthetic")
    expect(terminal).toContain('t("trendingDemo")')
    expect(terminal).toContain('t("trendingNone")')
  })

  it.each(["fr", "en", "de", "es", "it", "nl", "pl", "zh"])("%s has the new keys", (locale) => {
    const m = JSON.parse(read(`messages/${locale}.json`)) as { radarTerminal: Record<string, string> }
    for (const key of ["trendingDemo", "trendingNone", "countriesMockNotice"]) {
      expect(m.radarTerminal[key], `radarTerminal.${key}`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// #23 — globe
// ---------------------------------------------------------------------------------------------------------------------

function orderRow(i: number) {
  return {
    id: `o${i}`,
    createdAt: new Date(Date.now() - i * 60_000),
    sellingPriceCents: 2500,
    shippingAddress: { country: "DE", city: "Berlin" },
    affiliateProductId: null,
    product: { id: `p${i}`, name: `Product ${i}`, images: [], categories: ["Home"], sourceUrl: null, videoAdUrl: null },
  }
}

async function loadAggregator(setup: { orders: unknown[]; hourly?: Array<{ productId: string; _count: { _all: number } }>; spikeProducts?: unknown[]; imports?: unknown[] }) {
  vi.resetModules()
  vi.doMock("@/lib/prisma", () => ({
    prisma: {
      order: { findMany: async () => setup.orders, groupBy: async () => setup.hourly ?? [] },
      product: {
        findMany: async (args: { where?: { id?: { in?: string[] } } }) =>
          args?.where?.id?.in ? (setup.spikeProducts ?? []) : (setup.imports ?? []),
      },
      affiliateProduct: { findMany: async () => [] },
    },
  }))
  return import("@/lib/radar/live-aggregator")
}

describe("#23 globe events: only measured fields are numbers", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.doUnmock("@/lib/prisma")
    vi.restoreAllMocks()
  })

  it("a real sale has no growth, no 24 h curve and no sales/hour (they were hash(order id) and a constant 1)", async () => {
    const { aggregateRadarLiveEvents } = await loadAggregator({ orders: Array.from({ length: 14 }, (_, i) => orderRow(i + 1)) })
    const { events, source } = await aggregateRadarLiveEvents()
    expect(source).toBe("live")
    for (const e of events) {
      expect(e.type).toBe("sale")
      expect(e.growth).toBeNull()
      expect(e.sparkline).toBeNull()
      expect(e.salesPerHour).toBeNull()
      expect(e.product.price).toBe(25) // the measured fields stay
    }
  })

  it("a real spike keeps its MEASURED sales per hour but no invented growth or curve", async () => {
    const { aggregateRadarLiveEvents } = await loadAggregator({
      orders: Array.from({ length: 12 }, (_, i) => orderRow(i + 1)),
      hourly: [{ productId: "px", _count: { _all: 5 } }],
      spikeProducts: [{ id: "px", name: "Hot product", images: [], categories: ["Home"], basePriceCents: 1500, sourceUrl: null, videoAdUrl: null, affiliateProducts: [] }],
    })
    const { events } = await aggregateRadarLiveEvents()
    const spike = events.find((e) => e.type === "spike")
    expect(spike).toBeDefined()
    expect(spike!.salesPerHour).toBe(5)
    expect(spike!.growth).toBeNull() // used to be 200 + min(250, 5 * 40) = 400
    expect(spike!.sparkline).toBeNull()
  })

  it("a real import has no sales/hour, growth or curve", async () => {
    const { aggregateRadarLiveEvents } = await loadAggregator({
      orders: Array.from({ length: 12 }, (_, i) => orderRow(i + 1)),
      imports: [{ id: "pi", name: "Imported", images: [], categories: ["Home"], basePriceCents: 900, sourceUrl: "https://x.test/p", videoAdUrl: null, createdAt: new Date(), affiliateProducts: [] }],
    })
    const { events } = await aggregateRadarLiveEvents()
    const imp = events.find((e) => e.type === "import")
    expect(imp).toBeDefined()
    expect(imp!.salesPerHour).toBeNull()
    expect(imp!.growth).toBeNull()
    expect(imp!.sparkline).toBeNull()
  })

  it("only generated (demo) events carry a growth and a curve — and they are flagged synthetic", async () => {
    const { aggregateRadarLiveEvents } = await loadAggregator({ orders: [] })
    const { events } = await aggregateRadarLiveEvents()
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.synthetic).toBe(true)
      expect(typeof e.growth).toBe("number")
      expect(e.sparkline).toHaveLength(24)
    }
  })

  it("the sidebar renders growth, curve and sales/hour only when they exist; the pin colour no longer reads a made-up growth", () => {
    const sidebar = read("components/radar/GlobeSidebar.tsx")
    expect(sidebar).toMatch(/growth != null/)
    expect(sidebar).toMatch(/sparkline != null/)
    expect(sidebar).toMatch(/salesPerHour != null/)
    const globe = read("components/radar/Globe3D.tsx")
    expect(globe).toContain('from "@/lib/radar/live-pin"')
    expect(globe).not.toMatch(/\.growth\b/) // the component reads no growth at all
  })

  it("pin colour follows the measured sales per hour of a spike and ignores any growth value", () => {
    expect(pinColor({ type: "sale", salesPerHour: null })).toBe("#22c55e")
    expect(pinColor({ type: "import", salesPerHour: null })).toBe("#a78bfa")
    expect(pinColor({ type: "spike", salesPerHour: HOT_SPIKE_SALES_PER_HOUR })).toBe("#ef4444")
    expect(pinColor({ type: "spike", salesPerHour: HOT_SPIKE_SALES_PER_HOUR - 1 })).toBe("#f97316")
    expect(pinColor({ type: "spike", salesPerHour: null })).toBe("#f97316")
    // a huge growth would have turned the pin red before: the function does not even look at it
    expect(pinColor({ type: "spike", salesPerHour: 3, growth: 999 } as never)).toBe("#f97316")
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// #24 — country picker
// ---------------------------------------------------------------------------------------------------------------------

describe("#24 country picker", () => {
  it("a never-scanned country stays locked only when the list itself is real", () => {
    expect(isCountrySelectable({ productCount: 20 }, "live")).toBe(true)
    expect(isCountrySelectable({ productCount: 0 }, "live")).toBe(false)
    expect(isCountrySelectable({ productCount: undefined }, "live")).toBe(false)
    // radar database unreachable: nothing is "in progress" — every market opens (as a demo) instead of 31 locked cards
    expect(isCountrySelectable({ productCount: 0 }, "mock")).toBe(true)
    expect(isCountrySelectable({ productCount: 0 }, undefined)).toBe(false)
  })

  it("the terminal uses it, and tells the user the list is a fallback", () => {
    const terminal = read("components/radar/world-radar-terminal.tsx")
    expect(terminal).toContain("isCountrySelectable(c, countriesData?.source)")
    expect(terminal).toContain('t("countriesMockNotice")')
  })
})
