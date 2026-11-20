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
  resetCount: 1,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fulfillmentLog: {
      findUnique: async () => h.log,
      updateMany: async (a: unknown) => {
        h.updates.push(a)
        return { count: h.resetCount }
      },
    },
  },
}))
vi.mock("@/lib/fulfillment/bullmq/auto-buy.queue", () => ({ enqueueAutoBuyJob: async (a: unknown) => void h.enqueued.push(a) }))
vi.mock("@/lib/fulfillment/auto-buy", () => ({ isAutoBuyDisabled: () => false, MAX_ATTEMPTS: 3 }))
vi.mock("@/lib/auto-order/redis", () => ({ isAutoOrderQueueEnabled: () => false }))

import { canRetryAutoBuyLog, retryAdminAutoBuyFulfillmentLog } from "@/lib/admin/auto-fulfill/retry-auto-buy"

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

function logWith(status: string, ageMinutes: number, attempts = 1, errorMsg: string | null = null) {
  h.log = {
    id: "log1",
    status,
    attempts,
    errorMsg,
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
  h.resetCount = 1
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
    // conditional on the state we read, and the last error is kept (not nulled): the next claim clears it
    expect(h.updates).toEqual([{ where: { id: "log1", status: "FAILED" }, data: { status: "PENDING" } }])
    expect(h.enqueued).toEqual([{ fulfillmentLogId: "log1" }])
  })

  it("a FAILED log claimed by another path between the read and the reset is NOT reset and NOT re-enqueued (#2)", async () => {
    logWith("FAILED", 120, 1)
    h.resetCount = 0 // the conditional update matched nothing: the log is no longer FAILED
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toEqual({ ok: false, error: "log_state_changed", status: 409 })
    expect(h.enqueued).toHaveLength(0)
  })

  it("a margin-refused log answers `margin_refused` with the trace, and changes nothing (#6)", async () => {
    const trace = "MARGIN_REFUSED:margin_below_floor:margin=-636:floor=300"
    logWith("FAILED", 120, 0, trace)
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toEqual({
      ok: false,
      error: "margin_refused",
      status: 409,
      detail: trace,
    })
    expect(h.updates).toHaveLength(0) // the trace is NOT erased, the log is NOT flipped to PENDING
    expect(h.enqueued).toHaveLength(0) // and no job is "queued" that the queue would silently ignore
  })

  it("an unknown-cost refusal is explicit too", async () => {
    logWith("FAILED", 5, 0, "MARGIN_REFUSED:cost_unknown:margin=n/a:floor=300")
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toMatchObject({ ok: false, error: "margin_refused" })
    expect(h.updates).toHaveLength(0)
  })

  it("a PENDING log is simply re-enqueued (unchanged)", async () => {
    logWith("PENDING", 5, 0)
    expect(await retryAdminAutoBuyFulfillmentLog("log1")).toMatchObject({ ok: true })
    expect(h.updates).toHaveLength(0)
    expect(h.enqueued).toHaveLength(1)
  })
})
