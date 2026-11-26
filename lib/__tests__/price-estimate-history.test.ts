import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ created: [] as unknown[], fail: false, rows: [] as Array<{ entityId: string | null; payload: unknown }> }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      createMany: async (args: unknown) => {
        if (h.fail) throw new Error("db down")
        h.created.push(args)
        return { count: (args as { data: unknown[] }).data.length }
      },
      findMany: async () => {
        if (h.fail) throw new Error("db down")
        return h.rows
      },
    },
  },
}))

import type { ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import { isNewForecast, parseRecordedEstimate, PRICE_ESTIMATE_PAYLOAD_KEYS, priceEstimatePayload } from "@/lib/strategic-intelligence/price-estimate-history"
import { loadRecordedPriceEstimates, PRICE_ESTIMATE_ACTION, priceEstimateAuditId, recordPriceEstimates } from "@/lib/strategic-intelligence/price-estimate-history.server"
import { PR_MODEL_VERSION, PR_WINDOW_DAYS } from "@/lib/strategic-intelligence/price-response"

const now = new Date("2026-11-18T06:00:00Z")
const pool = {
  key: "root:7",
  elasticity: -1.2,
  se: 0.3,
  tau2: 0.05,
  n: 20,
  products: 8,
  resellers: 6,
  predLo: -2.1,
  predHi: -0.3,
  grade: "faible",
  lastAt: "2026-11-01T10:00:00.000Z",
  dataCutoff: "2026-11-15T10:00:00.000Z",
} as ElasticityPool

beforeEach(() => {
  h.created = []
  h.fail = false
  h.rows = []
})

describe("what a recorded forecast contains", () => {
  it("date, model version, the data it was built from, horizon and expected result — aggregates only, no identifier", () => {
    const p = priceEstimatePayload(pool, now)
    expect(Object.keys(p).sort()).toEqual([...PRICE_ESTIMATE_PAYLOAD_KEYS].sort())
    expect(p).toMatchObject({ modelVersion: PR_MODEL_VERSION, recordedAt: now.toISOString(), dataCutoff: pool.dataCutoff, horizonDays: PR_WINDOW_DAYS, eventsUsed: 20, lastEventAt: pool.lastAt })
    expect(p.expected).toMatch(/mean × ln\(p1\/p0\)/)
    // No listing / product / reseller / order / buyer identifier and no e-mail can be in it.
    expect(JSON.stringify(p)).not.toMatch(/listing|productId|resellerId|affiliate|orderId|@/)
  })
})

describe("when a forecast is written", () => {
  it("one row per pool and day (deterministic id, skipDuplicates)", async () => {
    expect(priceEstimateAuditId("root:7", now)).toBe("pr-estimate:root:7:2026-11-18")
    await recordPriceEstimates([pool], now)
    const args = h.created[0] as { data: Array<{ id: string; action: string }>; skipDuplicates: boolean }
    expect(args.skipDuplicates).toBe(true)
    expect(args.data[0]).toMatchObject({ id: "pr-estimate:root:7:2026-11-18", action: PRICE_ESTIMATE_ACTION })
  })

  it("nothing new (same version, same data) → no row; new data or a new model version → a row", async () => {
    h.rows = [{ entityId: "root:7", payload: priceEstimatePayload(pool, new Date("2026-11-16T06:00:00Z")) }]
    await expect(recordPriceEstimates([pool], now)).resolves.toBe(0)
    expect(h.created).toHaveLength(0)
    await expect(recordPriceEstimates([{ ...pool, n: 21, lastAt: "2026-11-02T10:00:00.000Z", dataCutoff: "2026-11-16T10:00:00.000Z" }], now)).resolves.toBe(1)
    const prev = priceEstimatePayload(pool, now)
    expect(isNewForecast(prev, { ...prev, modelVersion: "older" })).toBe(true)
  })

  it("never throws: a failed write records nothing, a failed read is « no history »", async () => {
    h.fail = true
    await expect(recordPriceEstimates([pool], now)).resolves.toBe(0)
    await expect(loadRecordedPriceEstimates(now)).resolves.toEqual({ available: false, rows: [] })
  })
})

describe("reading the journal back", () => {
  it("keeps only well-formed forecasts; old rows without version / cutoff, and a cutoff after the recording, are ignored", async () => {
    const ok = priceEstimatePayload(pool, now)
    h.rows = [
      { entityId: "root:7", payload: ok },
      { entityId: "root:7", payload: { ...ok, mean: "−1" } },
      { entityId: "root:7", payload: { recordedAt: now.toISOString(), mean: -1, se: 0.2, tau2: 0 } }, // previous format
      { entityId: "root:7", payload: { ...ok, se: -0.2 } },
      { entityId: "root:7", payload: { ...ok, dataCutoff: "2026-12-01T00:00:00.000Z" } }, // data from after the forecast
    ]
    const r = await loadRecordedPriceEstimates(now)
    expect(r.available).toBe(true)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ modelVersion: PR_MODEL_VERSION, mean: -1.2 })
    expect(parseRecordedEstimate("x", null)).toBeNull()
  })
})
