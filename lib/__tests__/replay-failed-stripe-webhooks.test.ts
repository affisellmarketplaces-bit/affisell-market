import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

import { createFakeProcessedWebhook } from "@/lib/testing/fake-processed-webhook"

const ledger = createFakeProcessedWebhook()
const eventsRetrieve = vi.fn(async (..._args: unknown[]): Promise<unknown> => ({}))
const getStripeClient = vi.fn((..._args: unknown[]) => ({ events: { retrieve: (...a: unknown[]) => eventsRetrieve(...a) } }))
const processStripeWebhookEvent = vi.fn(async (..._args: unknown[]): Promise<unknown> => ({}))
const opsWebhookAlert = vi.fn(async (..._args: unknown[]) => ({ slack: true, discord: false }))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    processedWebhook: {
      findMany: (...a: unknown[]) => (ledger.delegate.findMany as (...x: unknown[]) => unknown)(...a),
      count: (...a: unknown[]) => (ledger.delegate.count as (...x: unknown[]) => unknown)(...a),
      findUnique: (...a: unknown[]) => (ledger.delegate.findUnique as (...x: unknown[]) => unknown)(...a),
      updateMany: (...a: unknown[]) => (ledger.delegate.updateMany as (...x: unknown[]) => unknown)(...a),
    },
  },
}))
vi.mock("@/lib/stripe", () => ({ getStripeClient: (...a: unknown[]) => getStripeClient(...a) }))
vi.mock("@/lib/stripe-webhook-processor", () => ({
  processStripeWebhookEvent: (...a: unknown[]) => processStripeWebhookEvent(...a),
}))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: (...a: unknown[]) => opsWebhookAlert(...a) }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }))

import { GET as replayRoute } from "@/app/api/cron/replay-failed-stripe-webhooks/route"
import { replayFailedStripeWebhooks } from "@/lib/cron/replay-failed-stripe-webhooks"

const NOW = new Date("2026-11-13T12:00:00Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

function seed(id: string, ageHours: number, over: Partial<{ status: string; error: string }> = {}) {
  ledger.rows.set(id, {
    id,
    orderId: null,
    status: over.status ?? "failed",
    error: over.error ?? "boom",
    createdAt: hoursAgo(ageHours),
  })
}

// A checkout.session.completed is a marketplace `payment` session unless a test says otherwise (see `replayBlockReason`).
const stripeEvent = (id: string, type = "checkout.session.completed", object: Record<string, unknown> = { mode: "payment", metadata: { flow: "cart" } }) =>
  ({ id, type, data: { object } }) as unknown as Stripe.Event
const statusOf = (id: string) => ledger.rows.get(id)?.status

beforeEach(() => {
  vi.clearAllMocks()
  ledger.rows.clear()
  eventsRetrieve.mockImplementation(async (id: unknown) => stripeEvent(String(id)))
  processStripeWebhookEvent.mockResolvedValue({ orderId: "ord_1", duplicate: false, handled: true, status: "success" })
})

describe("replayFailedStripeWebhooks — which rows are replayed", () => {
  it("takes only failed Stripe events that Stripe stopped retrying (older than 72 h) and still holds (younger than 30 days)", async () => {
    seed("evt_young", 1) // Stripe is still retrying it
    seed("evt_just_inside_window", 71)
    seed("evt_old_enough", 73)
    seed("evt_20_days", 24 * 20)
    seed("evt_success", 100, { status: "success" })
    seed("evt_skipped", 100, { status: "skipped" })
    seed("evt_processing", 100, { status: "processing" })
    seed("dispute:dp_1:ord_1", 100, { status: "failed" }) // another job's ledger row, not an event
    seed("import-csv-1", 100, { status: "failed" })

    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(eventsRetrieve.mock.calls.map((c) => c[0]).sort()).toEqual(["evt_20_days", "evt_old_enough"])
    expect(result).toMatchObject({ scanned: 2, replayed: 2, stillFailing: 0, expired: 0, deferred: 0 })
    expect(processStripeWebhookEvent).toHaveBeenCalledTimes(2)
    expect(statusOf("evt_young")).toBe("failed")
    expect(statusOf("dispute:dp_1:ord_1")).toBe("failed")
    expect(opsWebhookAlert).not.toHaveBeenCalled()
  })

  it("replays the OLDEST first (closest to Stripe's 30-day cut-off)", async () => {
    seed("evt_b", 24 * 10)
    seed("evt_a", 24 * 25)
    seed("evt_c", 24 * 5)
    await replayFailedStripeWebhooks({ now: NOW })
    expect(eventsRetrieve.mock.calls.map((c) => c[0])).toEqual(["evt_a", "evt_b", "evt_c"])
  })

  it("never calls Stripe when there is nothing to replay (no client is even created)", async () => {
    seed("evt_young", 1)
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result.scanned).toBe(0)
    expect(getStripeClient).not.toHaveBeenCalled()
    expect(eventsRetrieve).not.toHaveBeenCalled()
  })
})

describe("replayFailedStripeWebhooks — bounds", () => {
  it("never replays more than the cap per run and says how many are left", async () => {
    for (let i = 0; i < 25; i += 1) seed(`evt_${String(i).padStart(2, "0")}`, 100 + i)
    const result = await replayFailedStripeWebhooks({ now: NOW, limit: 20 })
    expect(result.scanned).toBe(20)
    expect(result.deferred).toBe(5)
    expect(processStripeWebhookEvent).toHaveBeenCalledTimes(20)
  })

  it("stops starting new events once the time budget is spent", async () => {
    seed("evt_a", 100)
    seed("evt_b", 101)
    const result = await replayFailedStripeWebhooks({ now: NOW, timeBudgetMs: -1 })
    expect(result.scanned).toBe(0)
    expect(result.deferred).toBe(2)
    expect(processStripeWebhookEvent).not.toHaveBeenCalled()
  })
})

describe("replayFailedStripeWebhooks — age cap (30 days)", () => {
  it("never retrieves an event older than 30 days: it is closed as failed_expired, error text kept, and ops are told once", async () => {
    seed("evt_31_days", 24 * 31, { error: "checkout_orders_not_found" })
    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(eventsRetrieve).not.toHaveBeenCalled()
    expect(result.expired).toBe(1)
    expect(result.expiredIds).toEqual(["evt_31_days"])
    expect(statusOf("evt_31_days")).toBe("failed_expired")
    expect(ledger.rows.get("evt_31_days")?.error).toBe("checkout_orders_not_found")
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
    expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain("evt_31_days")

    // the next run does not tell it again
    opsWebhookAlert.mockClear()
    const again = await replayFailedStripeWebhooks({ now: NOW })
    expect(again.expired).toBe(0)
    expect(opsWebhookAlert).not.toHaveBeenCalled()
  })

  it("when more than 50 rows are over 30 days old, the rows not closed yet are STILL never retrieved (closed by the next run)", async () => {
    for (let i = 0; i < 60; i += 1) seed(`evt_old_${String(i).padStart(2, "0")}`, 24 * 40 + i)
    const first = await replayFailedStripeWebhooks({ now: NOW })
    expect(eventsRetrieve).not.toHaveBeenCalled()
    expect(first.expired).toBe(50)
    const second = await replayFailedStripeWebhooks({ now: NOW })
    expect(eventsRetrieve).not.toHaveBeenCalled()
    expect(second.expired).toBe(10)
    expect([...ledger.rows.values()].every((r) => r.status === "failed_expired")).toBe(true)
  })

  it("an event Stripe no longer has (resource_missing) is closed as failed_expired too, not retried forever", async () => {
    seed("evt_gone", 100)
    eventsRetrieve.mockRejectedValue(Object.assign(new Error("No such event"), { code: "resource_missing", statusCode: 404 }))
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result).toMatchObject({ expired: 1, stillFailing: 0, replayed: 0 })
    expect(statusOf("evt_gone")).toBe("failed_expired")
    expect(processStripeWebhookEvent).not.toHaveBeenCalled()
  })
})

// Finalisation review #10: `events.retrieve` returns the event as emitted; a snapshot applied 3-30 days late must not
// overwrite today's state.
describe("replayFailedStripeWebhooks — only event types that are safe to apply late (review #10)", () => {
  const SAFE = [
    "checkout.session.completed",
    "payment_intent.succeeded",
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
    "charge.dispute.funds_withdrawn",
    "charge.dispute.funds_reinstated",
  ]
  const UNSAFE = [
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "charge.refunded",
    "account.updated",
    "checkout.session.expired",
    "some.future.event",
  ]

  it.each(SAFE)("%s is replayed", async (type) => {
    seed("evt_x", 100)
    eventsRetrieve.mockResolvedValue(stripeEvent("evt_x", type))
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(processStripeWebhookEvent).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ replayed: 1, notReplayed: 0 })
  })

  it.each(UNSAFE)("%s is NOT replayed: closed as failed_not_replayed unprocessed, ops told, never a red run", async (type) => {
    seed("evt_x", 100, { error: "boom" })
    eventsRetrieve.mockResolvedValue(stripeEvent("evt_x", type))

    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(processStripeWebhookEvent).not.toHaveBeenCalled()
    expect(result).toMatchObject({ replayed: 0, notReplayed: 1, stillFailing: 0 })
    expect(result.notReplayedEvents).toEqual([{ eventId: "evt_x", type, reason: expect.any(String) }])
    expect(statusOf("evt_x")).toBe("failed_not_replayed")
    expect(ledger.rows.get("evt_x")?.error).toBe("boom") // the evidence stays
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
    expect(String(opsWebhookAlert.mock.calls[0]?.[0])).toContain(type)
  })

  it("a stale subscription snapshot can not revive a cancelled subscription: the old `updated` is closed, the live state untouched", async () => {
    seed("evt_old_updated", 24 * 20)
    eventsRetrieve.mockResolvedValue(stripeEvent("evt_old_updated", "customer.subscription.updated"))
    await replayFailedStripeWebhooks({ now: NOW })
    expect(processStripeWebhookEvent).not.toHaveBeenCalled()
    // and the next run does not look at it again
    eventsRetrieve.mockClear()
    await replayFailedStripeWebhooks({ now: NOW })
    expect(eventsRetrieve).not.toHaveBeenCalled()
  })

  it("mixed batch: the safe event is replayed, the unsafe one closed, one alert for the closed one", async () => {
    seed("evt_a", 101)
    seed("evt_b", 100)
    eventsRetrieve.mockImplementation(async (id: unknown) =>
      stripeEvent(String(id), id === "evt_a" ? "invoice.payment_failed" : "checkout.session.completed")
    )
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result).toMatchObject({ replayed: 1, notReplayed: 1 })
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
  })
})

describe("replayFailedStripeWebhooks — outcomes and alerts", () => {
  it("a replay that succeeds raises no alert", async () => {
    seed("evt_ok", 100)
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result).toMatchObject({ replayed: 1, stillFailing: 0 })
    expect(processStripeWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_ok" }))
    expect(opsWebhookAlert).not.toHaveBeenCalled()
  })

  it("an event that fails AGAIN is reported with its id, type and error in one aggregated alert", async () => {
    seed("evt_bad", 100)
    seed("evt_bad2", 101)
    processStripeWebhookEvent.mockImplementation(async (event: unknown) => {
      const id = (event as { id: string }).id
      ledger.rows.set(id, { ...ledger.rows.get(id)!, status: "failed", error: `still broken ${id}` })
      return { orderId: null, duplicate: false, handled: true, status: "failed" }
    })

    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(result.stillFailing).toBe(2)
    expect(result.failures.map((f) => f.eventId)).toEqual(["evt_bad2", "evt_bad"])
    expect(result.failures[0]).toMatchObject({ type: "checkout.session.completed", error: "still broken evt_bad2" })
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
    const text = String(opsWebhookAlert.mock.calls[0]?.[0])
    expect(text).toContain("evt_bad")
    expect(text).toContain("evt_bad2")
    expect(statusOf("evt_bad")).toBe("failed") // it stays replayable for the next run
  })

  it("a processor that throws is counted as still failing (the run continues with the other events)", async () => {
    seed("evt_throws", 101)
    seed("evt_fine", 100)
    processStripeWebhookEvent.mockImplementation(async (event: unknown) => {
      if ((event as { id: string }).id === "evt_throws") throw new Error("kaboom")
      return { orderId: null, duplicate: false, handled: true, status: "success" }
    })
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result).toMatchObject({ replayed: 1, stillFailing: 1 })
    expect(result.failures[0]).toMatchObject({ eventId: "evt_throws", error: "kaboom" })
  })

  it("a Stripe outage while reading the event leaves the row failed for the next run and alerts", async () => {
    seed("evt_outage", 100)
    eventsRetrieve.mockRejectedValue(new Error("connect ETIMEDOUT"))
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result).toMatchObject({ stillFailing: 1, expired: 0 })
    expect(statusOf("evt_outage")).toBe("failed")
    expect(processStripeWebhookEvent).not.toHaveBeenCalled()
    expect(opsWebhookAlert).toHaveBeenCalledTimes(1)
  })

  it("an event another delivery already handled is counted, not alerted", async () => {
    seed("evt_dup", 100)
    processStripeWebhookEvent.mockResolvedValue({ orderId: "ord_1", duplicate: true, handled: true, status: "success" })
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result).toMatchObject({ alreadyHandled: 1, replayed: 0, stillFailing: 0 })
    expect(opsWebhookAlert).not.toHaveBeenCalled()
  })

  it("an alerting failure never breaks the job", async () => {
    seed("evt_bad", 100)
    processStripeWebhookEvent.mockResolvedValue({ orderId: null, duplicate: false, handled: true, status: "failed" })
    opsWebhookAlert.mockRejectedValue(new Error("slack down"))
    await expect(replayFailedStripeWebhooks({ now: NOW })).resolves.toMatchObject({ stillFailing: 1 })
  })
})

describe("GET /api/cron/replay-failed-stripe-webhooks", () => {
  const previousSecret = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret"
  })
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
  })

  const call = (headers: Record<string, string> = {}) =>
    replayRoute(new Request("https://app.test/api/cron/replay-failed-stripe-webhooks", { headers }))

  it("refuses a call without the cron secret and replays nothing", async () => {
    seed("evt_old", 100)
    const res = await call()
    expect(res.status).toBe(401)
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401)
    expect(eventsRetrieve).not.toHaveBeenCalled()
    expect(processStripeWebhookEvent).not.toHaveBeenCalled()
  })

  it("answers 200 with the result when everything replayed", async () => {
    seed("evt_old", 100)
    const res = await call({ authorization: "Bearer s3cret" })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, replayed: 1, stillFailing: 0 })
  })

  it("answers 500 — a red cron run — when an event is still failing after its replay", async () => {
    seed("evt_old", 100)
    processStripeWebhookEvent.mockResolvedValue({ orderId: null, duplicate: false, handled: true, status: "failed" })
    const res = await call({ authorization: "Bearer s3cret" })
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ ok: false, stillFailing: 1 })
  })

})
