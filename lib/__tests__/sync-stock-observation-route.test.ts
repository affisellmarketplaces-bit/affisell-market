/**
 * The one-week observation protocol of `sync-stock` (docs/ENFORCE-READINESS-CRITERIA.md §5), proven on the real route:
 * observe writes NOTHING (no product, not even the partner's sync status), invalid values are never written, large
 * jumps are counted, every run is traceable by its run id, and `off` stops everything before any read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const m = vi.hoisted(() => ({
  products: [] as Array<{ id: string; supplierSku: string; stock: number; variants: unknown }>,
  partnerRows: [] as Array<{ sku: string; stock: unknown }>,
  partnerFails: false,
  reads: 0,
  productWrites: [] as unknown[],
  supplierWrites: [] as unknown[],
}))

vi.mock("@/lib/cron/authorize-cron-request", () => ({ authorizeCronRequest: () => null }))
vi.mock("@/lib/blind-dropship-crypto", () => ({ openBlindSecret: () => "k" }))
vi.mock("@/lib/suppliers/build-rest-adapter", () => ({
  buildSupplierAdapterFromConfig: () => ({
    getStock: async () => {
      if (m.partnerFails) throw new Error("partner down")
      return m.partnerRows
    },
  }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    blindDropshipSupplier: {
      findMany: async () => {
        m.reads += 1
        return [{ id: "s1", linkedUserId: "u1", apiKeyEncrypted: "x", apiEndpoint: "https://p.example", config: {} }]
      },
      update: async (a: unknown) => {
        m.supplierWrites.push(a)
        return {}
      },
    },
    product: {
      findMany: async (a: { where: { supplierSku: string } }) => m.products.filter((p) => p.supplierSku === a.where.supplierSku),
      update: async (a: unknown) => {
        m.productWrites.push(a)
        return {}
      },
      updateMany: async (a: unknown) => {
        m.productWrites.push(a)
        return { count: 0 }
      },
    },
  },
}))

const call = async () => {
  const { GET } = await import("@/app/api/cron/sync-stock/route")
  const res = await GET(new Request("https://x/api/cron/sync-stock"))
  return (await res.json()) as {
    mode: string
    runId?: string
    observation?: { wouldWrite: number; toZero: number; fromZero: number; largeChange: number; skipped: Record<string, number> }
    summary: Array<{ observation: { wouldWrite: number } }>
  }
}

beforeEach(() => {
  m.products = [
    { id: "a", supplierSku: "A", stock: 8, variants: null },
    { id: "b", supplierSku: "B", stock: 0, variants: null },
    { id: "c", supplierSku: "C", stock: 5, variants: null },
    { id: "d", supplierSku: "D", stock: 7, variants: null },
    { id: "e", supplierSku: "E", stock: 4, variants: { variantRows: [{ id: "r", stock: 4 }] } },
  ]
  m.partnerRows = [
    { sku: "A", stock: 0 },
    { sku: "B", stock: 3 },
    { sku: "C", stock: 60 },
    { sku: "D", stock: "n/a" },
    { sku: "E", stock: 9 },
  ]
  m.partnerFails = false
  m.reads = 0
  m.productWrites = []
  m.supplierWrites = []
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("sync-stock — observation protocol", () => {
  it("observe (default): computes everything, writes nothing at all", async () => {
    const out = await call()
    expect(out.mode).toBe("observe")
    expect(m.productWrites).toEqual([])
    expect(m.supplierWrites).toEqual([])
    expect(out.observation).toEqual({
      wouldWrite: 3,
      toZero: 1,
      fromZero: 1,
      largeChange: 1,
      skipped: { unreadable: 1, variant_rows: 1, unchanged: 0 },
    })
    expect(out.summary[0].observation.wouldWrite).toBe(3)
  })

  it("every log line of a run carries the same run id", async () => {
    const log = vi.spyOn(console, "log")
    const out = await call()
    expect(out.runId).toMatch(/^sync-stock:/)
    const lines = log.mock.calls.filter((c) => c[0] === "[sync-stock]").map((c) => c[1] as { runId?: string })
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => l.runId === out.runId)).toBe(true)
  })

  it("a failing partner is traced and still writes nothing in observe", async () => {
    m.partnerFails = true
    const out = await call()
    expect(out.summary).toHaveLength(1)
    expect(m.supplierWrites).toEqual([])
    expect(m.productWrites).toEqual([])
  })

  it("off: stops before any read or call", async () => {
    vi.stubEnv("PARTNER_STOCK_SYNC_MODE", "off")
    const out = await call()
    expect(out.mode).toBe("off")
    expect(m.reads).toBe(0)
    expect(m.productWrites).toEqual([])
  })

  it("enforce: writes only the readable, non-variant, changed values — stock only", async () => {
    vi.stubEnv("PARTNER_STOCK_SYNC_MODE", "enforce")
    await call()
    expect(m.productWrites).toEqual([
      { where: { id: "a" }, data: { stock: 0 } },
      { where: { id: "b" }, data: { stock: 3 } },
      { where: { id: "c" }, data: { stock: 60 } },
    ])
  })
})
