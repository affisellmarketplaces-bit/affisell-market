import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ created: [] as unknown[], fail: false, rows: [] as Array<{ entityId: string | null; payload: unknown }> }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      createMany: async (args: unknown) => {
        if (h.fail) throw new Error("db down")
        h.created.push(args)
        return { count: 1 }
      },
      findMany: async () => {
        if (h.fail) throw new Error("db down")
        return h.rows
      },
    },
  },
}))

import type { ElasticityPool } from "@/lib/strategic-intelligence/demand-adjusted-simulation"
import {
  loadRecordedPriceEstimates,
  parseRecordedEstimate,
  PRICE_ESTIMATE_ACTION,
  priceEstimateAuditId,
  recordPriceEstimates,
} from "@/lib/strategic-intelligence/price-estimate-history.server"

const now = new Date("2026-11-18T06:00:00Z")
const pool = { key: "root:7", elasticity: -1.2, se: 0.3, tau2: 0.05, n: 20, products: 8, grade: "faible" } as ElasticityPool

beforeEach(() => {
  h.created = []
  h.fail = false
  h.rows = []
})

describe("price-estimate history (AuditLog, no migration)", () => {
  it("one row per pool and per day, deterministic id, skipDuplicates — a second run the same day writes nothing new", async () => {
    expect(priceEstimateAuditId("root:7", now)).toBe("pr-estimate:root:7:2026-11-18")
    await recordPriceEstimates([pool], now)
    const args = h.created[0] as { data: Array<{ id: string; action: string; payload: Record<string, unknown> }>; skipDuplicates: boolean }
    expect(args.skipDuplicates).toBe(true)
    expect(args.data[0]).toMatchObject({ id: "pr-estimate:root:7:2026-11-18", action: PRICE_ESTIMATE_ACTION, payload: { mean: -1.2, se: 0.3, tau2: 0.05, grade: "faible" } })
  })

  it("never throws: a failed write records nothing, a failed read is « no history »", async () => {
    h.fail = true
    await expect(recordPriceEstimates([pool], now)).resolves.toBe(0)
    await expect(loadRecordedPriceEstimates(now)).resolves.toEqual({ available: false, rows: [] })
  })

  it("reads back only well-formed rows (a malformed payload is ignored, never trusted as a number)", async () => {
    h.rows = [
      { entityId: "marketplace", payload: { recordedAt: "2026-11-01T06:00:00.000Z", mean: -1, se: 0.2, tau2: 0 } },
      { entityId: "marketplace", payload: { recordedAt: "2026-11-02T06:00:00.000Z", mean: "−1", se: 0.2, tau2: 0 } },
      { entityId: "marketplace", payload: { recordedAt: "not a date", mean: -1, se: 0.2, tau2: 0 } },
      { entityId: "marketplace", payload: { recordedAt: "2026-11-03T06:00:00.000Z", mean: -1, se: -0.2, tau2: 0 } },
    ]
    const r = await loadRecordedPriceEstimates(now)
    expect(r.available).toBe(true)
    expect(r.rows).toHaveLength(1)
    expect(parseRecordedEstimate("x", null)).toBeNull()
  })
})
