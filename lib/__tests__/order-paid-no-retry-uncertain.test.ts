/**
 * The workers downstream of the gate (BullMQ `order-paid` and Inngest `process-order-paid`) retry a result whose text contains
 * "timeout" / "rate" / "limit" / "temporarily". A result that means "the purchase MAY exist" (or "somebody is on it", or
 * "refused on margin") must never be retried by them, whatever its text says.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  result: { ok: false, error: "x" } as Record<string, unknown>,
  processor: null as null | ((job: { data: { orderId: string }; attemptsMade: number }) => Promise<void>),
  inngestHandler: null as null | ((ctx: unknown) => Promise<unknown>),
}))

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }))
vi.mock("@/lib/aliexpress-fulfill-order", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/aliexpress-fulfill-order")>()
  return { ...real, fulfillAffisellOrderWithAliExpress: async () => h.result }
})
vi.mock("bullmq", () => ({
  Job: class {},
  Queue: class {},
  Worker: class {
    constructor(_name: string, processor: (job: never) => Promise<void>) {
      h.processor = processor as never
    }
  },
}))
vi.mock("@/lib/auto-order/redis", () => ({
  createBullMqConnection: () => ({}),
  getBullMqConnection: () => ({}),
  isAutoOrderQueueEnabled: () => true,
}))
vi.mock("@/lib/redis-namespace", () => ({ bullmqPrefix: () => "bull" }))
vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => {
      h.inngestHandler = handler
      return handler
    },
  },
}))

import { isNeverRetryFulfillError } from "@/lib/aliexpress-fulfill-order"
import { createOrderPaidWorker } from "@/lib/fulfillment/order-paid-queue"
import "@/inngest/functions/process-order-paid"

const UNCERTAIN = [
  "supplier_outcome_uncertain",
  "supplier_order_unrecorded",
  "fulfillment_in_progress",
  "margin_refused:margin_below_floor",
  // text that WOULD match the retry substrings — still never retried
  "supplier_outcome_uncertain: gateway timeout, rate limit, temporarily unavailable",
]

const runBull = async (error: string) => {
  h.result = { ok: false, error, orderId: "o1" }
  await h.processor!({ data: { orderId: "o1" }, attemptsMade: 0 })
}
const runInngest = async (error: string) => {
  h.result = { ok: false, error, orderId: "o1" }
  return h.inngestHandler!({
    event: { data: { orderId: "o1" } },
    step: { run: async (_name: string, fn: () => Promise<unknown>) => fn() },
  })
}

beforeEach(() => {
  createOrderPaidWorker()
})

describe("isNeverRetryFulfillError", () => {
  it.each(UNCERTAIN)("%s is never retried", (e) => expect(isNeverRetryFulfillError(e)).toBe(true))
  it.each(["INVENTORY_SHORTAGE", "aliexpress_api_not_configured", "rate limit exceeded", "not_paid"])(
    "%s is not on the list",
    (e) => expect(isNeverRetryFulfillError(e)).toBe(false)
  )
})

describe("BullMQ order-paid worker", () => {
  it.each(UNCERTAIN)("does NOT throw (no retry) on %s", async (error) => {
    await expect(runBull(error)).resolves.toBeUndefined()
  })
  it("still retries an ordinary transient failure (unchanged)", async () => {
    await expect(runBull("AliExpress rate limit, try again")).rejects.toThrow("rate limit")
    await expect(runBull("request timeout")).rejects.toThrow("timeout")
  })
})

describe("Inngest process-order-paid", () => {
  it.each(UNCERTAIN)("does NOT throw (no retry) on %s", async (error) => {
    await expect(runInngest(error)).resolves.toBeDefined()
  })
  it("still retries an ordinary transient failure (unchanged)", async () => {
    await expect(runInngest("AliExpress rate limit, try again")).rejects.toThrow("rate limit")
  })
})
