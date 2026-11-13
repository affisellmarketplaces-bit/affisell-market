/**
 * The admin "retry" must never turn a purchase that is IN DOUBT into a new purchase.
 * It used to reset a BUYING log older than 10 minutes to PENDING and re-enqueue it — i.e. re-buy something that may already
 * exist at AliExpress with its answer lost. A BUYING claim is now refused (a human reconciles it), whatever its age.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  log: null as Record<string, unknown> | null,
  updates: [] as unknown[],
  enqueued: [] as unknown[],
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fulfillmentLog: {
      findUnique: async () => h.log,
      update: async (a: unknown) => void h.updates.push(a),
    },
  },
}))
vi.mock("@/lib/fulfillment/bullmq/auto-buy.queue", () => ({ enqueueAutoBuyJob: async (a: unknown) => void h.enqueued.push(a) }))
vi.mock("@/lib/fulfillment/auto-buy", () => ({ isAutoBuyDisabled: () => false, MAX_ATTEMPTS: 3 }))
vi.mock("@/lib/auto-order/redis", () => ({ isAutoOrderQueueEnabled: () => false }))

import { canRetryAutoBuyLog, retryAdminAutoBuyFulfillmentLog } from "@/lib/admin/auto-fulfill/retry-auto-buy"

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

function logWith(status: string, ageMinutes: number, attempts = 1) {
  h.log = {
    id: "log1",
    status,
    attempts,
    updatedAt: minutesAgo(ageMinutes),
    order: {
      id: "o1",
      product: { autoBuyEnabled: true, autoFulfill: true, supplierLink: { isActive: true, autoBuyEnabled: true } },
    },
  }
}

beforeEach(() => {
  h.updates.length = 0
  h.enqueued.length = 0
})

describe("canRetryAutoBuyLog", () => {
  it("a BUYING claim is not retryable (it may be a real purchase whose answer was lost)", () => {
    expect(canRetryAutoBuyLog({ status: "BUYING", attempts: 1 })).toBe(false)
  })
  it("PENDING and FAILED under the max stay retryable", () => {
    expect(canRetryAutoBuyLog({ status: "PENDING", attempts: 0 })).toBe(true)
    expect(canRetryAutoBuyLog({ status: "FAILED", attempts: 2 })).toBe(true)
  })
})

describe("retryAdminAutoBuyFulfillmentLog", () => {
  it("a FRESH BUYING claim => 409 auto_buy_in_progress, untouched", async () => {
    logWith("BUYING", 2)
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toEqual({ ok: false, error: "auto_buy_in_progress", status: 409 })
    expect(h.updates).toHaveLength(0)
    expect(h.enqueued).toHaveLength(0)
  })

  it.each([11, 60, 60 * 24, 60 * 24 * 30])(
    "a BUYING claim %i minutes old => 409 purchase_in_doubt: NOT reset to PENDING, NOT re-enqueued",
    async (age) => {
      logWith("BUYING", age)
      expect(await retryAdminAutoBuyFulfillmentLog("log1")).toEqual({ ok: false, error: "purchase_in_doubt", status: 409 })
      expect(h.updates).toHaveLength(0)
      expect(h.enqueued).toHaveLength(0)
    }
  )

  it("a FAILED log (definitive failure) is still reset to PENDING and re-enqueued (unchanged)", async () => {
    logWith("FAILED", 120, 1)
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toMatchObject({ ok: true, fulfillmentLogId: "log1" })
    expect(h.updates).toEqual([{ where: { id: "log1" }, data: { status: "PENDING", errorMsg: null } }])
    expect(h.enqueued).toEqual([{ fulfillmentLogId: "log1" }])
  })

  it("a PENDING log is simply re-enqueued (unchanged)", async () => {
    logWith("PENDING", 5, 0)
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toMatchObject({ ok: true })
    expect(h.updates).toHaveLength(0)
    expect(h.enqueued).toHaveLength(1)
  })
})
