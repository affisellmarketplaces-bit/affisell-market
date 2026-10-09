import { readFileSync } from "node:fs"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The Home "Tendances" race in components/home/buyer-premium-marketplace-section.tsx (Lot 1A): 5 000 ms render deadline,
 * a single race with its diagnostic probe kept, and — above all — a deadline that only stops THIS render from waiting:
 * the loader's promise is never cancelled, replaced or detached.
 *
 * The real async server component is executed here; everything it composes is a stub.
 */

vi.mock("server-only", () => ({}))
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }))
vi.mock("@/lib/title-translation.server", () => ({ translateItemTitles: async (items: unknown[]) => items }))
vi.mock("@/components/BentoGrid", () => ({ BentoGrid: () => null }))
vi.mock("@/components/home/buyer-premium-marketplace-layout", () => ({ BuyerPremiumMarketplaceLayoutClient: () => null }))
vi.mock("@/components/home/buyer-premium-marketplace-skeleton", () => ({ BuyerPremiumMarketplaceSkeleton: () => null }))
vi.mock("@/components/home/BuyerMarketplaceExplorer", () => ({ BuyerMarketplaceExplorer: () => null }))
vi.mock("@/components/home/discovery/home-discovery-section", () => ({ HomeDiscoverySection: () => null }))
vi.mock("@/lib/home-marketplace-shell", () => ({ loadHomeMarketplaceShellSafe: async () => ({ shell: true }) }))
vi.mock("@/lib/home-discovery.server", () => ({ loadHomeDiscoverySafe: async () => ({ collections: [], directory: [] }) }))
vi.mock("@/lib/home-flash-shops.server", () => ({ loadHomeFlashDealsSafe: async () => [], loadHomeShopsSafe: async () => [] }))
vi.mock("@/lib/home-selection.server", () => ({ loadHomeSelectionSafe: async () => [] }))
vi.mock("@/lib/taxonomy/resolve-browse-departments.server", () => ({
  loadBrowseDepartmentsCached: async () => ({ departments: [{ resolved: true, id: "d1" }, { resolved: false, id: "d2" }] }),
}))

const bestSellers = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock("@/lib/public-home-cache", () => ({ loadHomeBestSellers7dBucketedSafe: bestSellers.load }))

import { BuyerPremiumMarketplaceSection } from "@/components/home/buyer-premium-marketplace-section"
import { __resetHomeRaceDiagnosticsForTests } from "@/lib/home-race-diagnostics"
import { resolveBuyerCardImageHref } from "@/lib/listing-card-image-shared"

type Trending = { id: string; name: string; image: string | null; href: string; sold: number }

const card = (id: string, over: Record<string, unknown> = {}) => ({
  listingId: `l-${id}`,
  name: `Product ${id}`,
  imageUrl: `https://cdn.example/${id}.jpg`,
  soldCount: 9,
  ...over,
})

/** Runs the real async server component and returns the props it hands to the layout. */
async function renderSection(): Promise<{ trending: Trending[]; browseDepartments: { id: string }[] }> {
  const suspense = BuyerPremiumMarketplaceSection() as unknown as { props: { children: { type: (p: unknown) => Promise<{ props: never }>; props: unknown } } }
  const inner = suspense.props.children
  const tree = (await inner.type(inner.props)) as unknown as { props: { trending: Trending[]; browseDepartments: { id: string }[] } }
  return tree.props
}

const raceEvents = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .filter((c) => c[0] === "[home_race]")
    .map((c) => c[1] as Record<string, unknown>)
    .filter((p) => p.loader === "home_best_sellers_7d")

let consoleLog: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  bestSellers.load.mockReset()
  __resetHomeRaceDiagnosticsForTests()
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("Home trending race — 5 000 ms render deadline", () => {
  it("asks the bucketed loader once, for 3 products, and maps the cards the widget reads", async () => {
    bestSellers.load.mockResolvedValue([card("a"), card("b", { imageUrl: null, soldCount: 0 })])

    const { trending, browseDepartments } = await renderSection()

    expect(bestSellers.load).toHaveBeenCalledTimes(1)
    expect(bestSellers.load).toHaveBeenCalledWith(3)
    expect(trending).toEqual([
      { id: "l-a", name: "Product a", image: resolveBuyerCardImageHref("https://cdn.example/a.jpg", "l-a"), href: "/marketplace/l-a", sold: 9 },
      { id: "l-b", name: "Product b", image: null, href: "/marketplace/l-b", sold: 0 },
    ])
    expect(browseDepartments).toEqual([{ resolved: true, id: "d1" }]) // the rest of the section is untouched
  })

  it("still waits for a loader that answers after 4 900 ms (the old 2 500 ms deadline would have dropped it)", async () => {
    bestSellers.load.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([card("slow")]), 4900)))

    const rendered = renderSection()
    await vi.advanceTimersByTimeAsync(4900)
    const { trending } = await rendered

    expect(trending.map((t) => t.id)).toEqual(["l-slow"])
    expect(raceEvents(consoleLog).map((e) => e.event)).toEqual(["START", "RACE_WON"])
  })

  it("gives up at 5 000 ms with an empty widget — and does NOT claim to stop the loader", async () => {
    let settledAt: number | undefined
    let resolveLoader!: (cards: unknown[]) => void
    const loaderPromise = new Promise<unknown[]>((resolve) => {
      resolveLoader = resolve
    })
    void loaderPromise.then(() => {
      settledAt = Date.now()
    })
    bestSellers.load.mockReturnValue(loaderPromise)
    const startedAt = Date.now()

    const rendered = renderSection()
    await vi.advanceTimersByTimeAsync(4999)
    let renderDone = false
    void rendered.then(() => {
      renderDone = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(renderDone).toBe(false) // 1 ms before the deadline the render is still waiting

    await vi.advanceTimersByTimeAsync(1)
    const { trending } = await rendered
    expect(trending).toEqual([]) // the widget degrades to nothing at 5 000 ms…
    expect(raceEvents(consoleLog).map((e) => e.event)).toEqual(["START", "TIMEOUT"])
    expect(raceEvents(consoleLog)[1]).toMatchObject({ still_running: true, timeout_ms: 5000 })

    // …but the loader promise is the same, still pending, and finishes on its own: nothing was cancelled or replaced.
    expect(settledAt).toBeUndefined()
    expect(bestSellers.load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(55_000)
    resolveLoader([card("late")])
    await vi.advanceTimersByTimeAsync(0)
    expect(settledAt).toBe(startedAt + 60_000)
    expect(raceEvents(consoleLog).map((e) => e.event)).toEqual(["START", "TIMEOUT", "PROMISE_SETTLED_AFTER_TIMEOUT"])
  })
})

describe("Home trending race — source guards", () => {
  const source = readFileSync("components/home/buyer-premium-marketplace-section.tsx", "utf8")
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  it("keeps ONE race for the widget, its diagnostic probe, and the 5 000 ms deadline", () => {
    expect(code).toMatch(/const BEST_SELLERS_TIMEOUT_MS = 5000\b/)
    expect(code.match(/Promise\.race\(/g)).toHaveLength(1)
    expect(code).toMatch(/startHomeRace\("home_best_sellers_7d", BEST_SELLERS_TIMEOUT_MS\)/)
    expect(code).toMatch(/bestSellersProbe\.watch\(loadHomeBestSellers7dBucketedSafe\(3\)\)/)
    expect(code).toMatch(/bestSellersProbe\.onTimeout\(\)/)
  })

  it("no longer calls the uncached Safe loader, and never uses after()", () => {
    expect(code).not.toMatch(/loadHomeBestSellers7dSafe/)
    expect(code).not.toMatch(/\bafter\(/)
    expect(code).not.toMatch(/from "next\/server"/)
  })
})
