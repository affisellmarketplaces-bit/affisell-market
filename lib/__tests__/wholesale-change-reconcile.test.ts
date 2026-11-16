import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  history: [] as Array<{ id: bigint; productId: string; priceCents: number; previousCents: number | null }>,
  cursor: null as null | { payload: unknown },
  notify: vi.fn(),
  products: new Map<string, Record<string, unknown>>(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/affiliate-wholesale-change-notify", () => ({ notifyAffiliatesOfWholesaleChange: m.notify }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findUnique: vi.fn(async () => m.cursor),
      upsert: vi.fn(async ({ create, update }: { create: { payload: unknown }; update: { payload: unknown } }) => {
        m.cursor = { payload: m.cursor ? update.payload : create.payload }
      }),
    },
    productPriceHistory: {
      findMany: vi.fn(async ({ where }: { where: { id: { gt: bigint } } }) => m.history.filter((h) => h.id > where.id.gt)),
    },
    product: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => m.products.get(where.id) ?? null) },
  },
}))

import { increasesFromHistory, reconcileWholesaleIncreases } from "@/lib/wholesale-change-reconcile.server"

const product = (id: string, base: number) => ({
  id,
  name: `P ${id}`,
  images: [],
  basePriceCents: base,
  variants: null,
  colors: [],
  hasVariants: false,
  productVariants: [],
})

beforeEach(() => {
  m.history = []
  m.cursor = null
  m.products.clear()
  m.notify.mockReset()
  m.notify.mockResolvedValue({ listingsFlagged: 1, notificationsSent: 1 })
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("increasesFromHistory", () => {
  it("keeps, per product, the price before the span and the last one — only when it went up", () => {
    const map = increasesFromHistory([
      { productId: "a", priceCents: 1000, previousCents: null }, // creation: ignored
      { productId: "a", priceCents: 1200, previousCents: 1000 },
      { productId: "a", priceCents: 1100, previousCents: 1200 },
      { productId: "b", priceCents: 900, previousCents: 1000 }, // went down
      { productId: "c", priceCents: 1500, previousCents: 1000 },
      { productId: "c", priceCents: 1000, previousCents: 1500 }, // back to where it was
    ])
    expect([...map.entries()]).toEqual([["a", { beforeCents: 1000, afterCents: 1100 }]])
  })
})

describe("reconcileWholesaleIncreases", () => {
  it("runs the reseller margin guard for an increase written by ANY path, then moves its cursor", async () => {
    m.products.set("a", product("a", 1300))
    m.history = [{ id: BigInt(7), productId: "a", priceCents: 1300, previousCents: 1000 }]

    const first = await reconcileWholesaleIncreases()

    expect(m.notify).toHaveBeenCalledTimes(1)
    expect(m.notify.mock.calls[0]![0]).toMatchObject({
      productId: "a",
      before: { basePriceCents: 1000 },
      after: { basePriceCents: 1300 },
    })
    expect(first).toMatchObject({ rowsRead: 1, productsWithIncrease: 1, listingsFlagged: 1, cursor: "7", failed: 0 })

    // nothing new since the cursor: nothing re-run
    await reconcileWholesaleIncreases()
    expect(m.notify).toHaveBeenCalledTimes(1)
  })

  it("does not run the guard for a decrease, and still moves past it", async () => {
    m.products.set("a", product("a", 900))
    m.history = [{ id: BigInt(3), productId: "a", priceCents: 900, previousCents: 1000 }]

    expect(await reconcileWholesaleIncreases()).toMatchObject({ productsWithIncrease: 0, cursor: "3" })
    expect(m.notify).not.toHaveBeenCalled()
  })

  it("a failing product is counted and does not freeze the cursor", async () => {
    m.products.set("a", product("a", 1300))
    m.history = [{ id: BigInt(9), productId: "a", priceCents: 1300, previousCents: 1000 }]
    m.notify.mockRejectedValueOnce(new Error("db blip"))

    expect(await reconcileWholesaleIncreases()).toMatchObject({ failed: 1, cursor: "9" })
  })

  it("does nothing (and does not crash) while the history table does not exist", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.productPriceHistory.findMany).mockRejectedValueOnce(new Error('relation "ProductPriceHistory" does not exist'))
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    expect(await reconcileWholesaleIncreases()).toMatchObject({ rowsRead: 0, cursor: "0" })
    expect(m.notify).not.toHaveBeenCalled()
  })
})
