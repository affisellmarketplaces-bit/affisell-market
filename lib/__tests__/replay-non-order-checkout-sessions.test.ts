import { beforeEach, describe, expect, it, vi } from "vitest"
import type Stripe from "stripe"

import { createFakeProcessedWebhook } from "@/lib/testing/fake-processed-webhook"

/**
 * Review #6 / #9 (P2) and #7 (P3), through the REAL replay job and the REAL processor.
 *
 * `checkout.session.completed` is on the late-replay whitelist because, for a marketplace `payment` session, its handler
 * reads the ORDERS. In `subscription` mode the same event activates Pro / Radar / Growth from the event without checking the
 * live subscription status, and a sponsor session reactivates an expired campaign: replayed days late they would revive a
 * cancelled plan for free. Only the leaves are faked: Prisma (in memory), Stripe (events.retrieve), the plan / sponsor
 * activations (spies), the ops webhook.
 */

const ledger = createFakeProcessedWebhook()
const h = vi.hoisted(() => ({
  eventsRetrieve: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({})),
  activatePro: vi.fn(async (..._args: unknown[]) => ({ activated: true as boolean, reason: null as string | null })),
  activateRadar: vi.fn(async (..._args: unknown[]) => ({ activated: false as boolean, reason: "x", plan: null })),
  activateGrowth: vi.fn(async (..._args: unknown[]) => ({ activated: false as boolean, reason: "x", plan: null })),
  activateSponsor: vi.fn(async (..._args: unknown[]) => ({ activated: true as boolean })),
  scheduleTransfers: vi.fn(async (..._args: unknown[]) => ({ orderId: "ord_1", scheduled: true })),
  opsWebhookAlert: vi.fn(async (..._args: unknown[]) => ({ slack: true, discord: false })),
  orderIds: [] as string[],
}))

vi.mock("@/lib/prisma", () => {
  const prisma = {
    processedWebhook: {
      findMany: (...a: unknown[]) => (ledger.delegate.findMany as (...x: unknown[]) => unknown)(...a),
      count: (...a: unknown[]) => (ledger.delegate.count as (...x: unknown[]) => unknown)(...a),
      findUnique: (...a: unknown[]) => (ledger.delegate.findUnique as (...x: unknown[]) => unknown)(...a),
      upsert: (...a: unknown[]) => (ledger.delegate.upsert as (...x: unknown[]) => unknown)(...a),
      updateMany: (...a: unknown[]) => (ledger.delegate.updateMany as (...x: unknown[]) => unknown)(...a),
    },
    order: { findMany: async () => [] },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  }
  return { prisma }
})
vi.mock("@/lib/stripe", () => ({ getStripeClient: () => ({ events: { retrieve: (...a: unknown[]) => h.eventsRetrieve(...a) } }) }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: (...a: unknown[]) => h.opsWebhookAlert(...a) }))
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock("@/lib/stripe-pro", () => ({
  activateProFromCheckoutSession: (...a: unknown[]) => h.activatePro(...a),
  deactivateProFromSubscription: vi.fn(),
  syncProFromSubscriptionUpdate: vi.fn(),
}))
vi.mock("@/lib/stripe-radar", () => ({
  activateRadarFromCheckoutSession: (...a: unknown[]) => h.activateRadar(...a),
  syncRadarFromSubscription: vi.fn(),
  deactivateRadarFromSubscription: vi.fn(),
}))
vi.mock("@/lib/stripe-growth", () => ({
  activateGrowthFromCheckoutSession: (...a: unknown[]) => h.activateGrowth(...a),
  syncGrowthFromSubscription: vi.fn(),
  deactivateGrowthFromSubscription: vi.fn(),
}))
vi.mock("@/lib/sponsor/activate-sponsor-campaign", () => ({
  activateSponsorCampaignFromCheckout: (...a: unknown[]) => h.activateSponsor(...a),
  isSponsorCheckoutSession: (s: { metadata?: { flow?: string } }) => s.metadata?.flow === "sponsor_campaign",
}))
vi.mock("@/lib/marketplace-checkout-fulfill", () => ({
  ensureMarketplaceCheckoutFulfilled: vi.fn(),
  marketplaceCheckoutNeedsFulfillment: vi.fn(async () => false),
}))
vi.mock("@/lib/stripe-marketplace-commission-split", () => ({
  findOrderIdsForCheckoutSession: async () => h.orderIds,
  checkoutSessionIdForPaymentIntent: async () => null,
  processMarketplaceCommissionForPaymentIntent: vi.fn(),
}))
vi.mock("@/lib/transfers/schedule-from-checkout", () => ({
  scheduleMarketplaceTransferAttempts: (...a: unknown[]) => h.scheduleTransfers(...a),
}))
vi.mock("@/lib/stripe-invoice-payment-failed", () => ({ handleStripeInvoicePaymentFailed: vi.fn() }))
vi.mock("@/lib/stripe-charge-refunded", () => ({ handleStripeChargeRefunded: vi.fn() }))
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }))

import { replayFailedStripeWebhooks } from "@/lib/cron/replay-failed-stripe-webhooks"
import { processStripeWebhookEvent } from "@/lib/stripe-webhook-processor"

const NOW = new Date("2026-11-13T12:00:00Z")
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

function checkoutCompleted(id: string, session: Record<string, unknown>): Stripe.Event {
  return { id, type: "checkout.session.completed", data: { object: { id: `cs_${id}`, payment_status: "paid", ...session } } } as unknown as Stripe.Event
}
const subscriptionSession = { mode: "subscription", subscription: "sub_1", metadata: { userId: "u1" } }
const sponsorSession = { mode: "payment", metadata: { flow: "sponsor_campaign", campaignId: "camp_1" } }
const marketplaceSession = { mode: "payment", metadata: { flow: "cart" } }

function failedRow(id: string, ageDays = 4) {
  ledger.rows.set(id, { id, orderId: null, status: "failed", error: "could not resolve user", createdAt: daysAgo(ageDays) })
}
const statusOf = (id: string) => ledger.rows.get(id)?.status

beforeEach(() => {
  vi.clearAllMocks()
  ledger.rows.clear()
  h.orderIds = []
  h.activateRadar.mockResolvedValue({ activated: false, reason: "x", plan: null })
  h.activateGrowth.mockResolvedValue({ activated: false, reason: "x", plan: null })
  h.activatePro.mockResolvedValue({ activated: true, reason: null })
})

describe("the late replay never applies a subscription / sponsor checkout snapshot (reviews #6, #9)", () => {
  it("a failed SUBSCRIPTION checkout is NOT replayed: no plan is activated, the row is closed failed_not_replayed, ops told with the reason", async () => {
    failedRow("evt_sub")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_sub", subscriptionSession))

    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(h.activatePro).not.toHaveBeenCalled()
    expect(h.activateRadar).not.toHaveBeenCalled()
    expect(h.activateGrowth).not.toHaveBeenCalled()
    expect(result).toMatchObject({ replayed: 0, notReplayed: 1, stillFailing: 0 })
    expect(statusOf("evt_sub")).toBe("failed_not_replayed")
    expect(String(h.opsWebhookAlert.mock.calls[0]?.[0])).toMatch(/evt_sub.*subscription/)
  })

  it("a failed SPONSOR checkout is NOT replayed: the campaign is not (re)activated", async () => {
    failedRow("evt_sponsor")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_sponsor", sponsorSession))

    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(h.activateSponsor).not.toHaveBeenCalled()
    expect(result).toMatchObject({ replayed: 0, notReplayed: 1 })
    expect(statusOf("evt_sponsor")).toBe("failed_not_replayed")
  })

  it.each([
    ["blind dropship", { mode: "payment", metadata: { flow: "blind_dropship" } }],
    ["setup mode", { mode: "setup", metadata: {} }],
    ["no readable mode (fail closed)", { metadata: {} }],
  ])("a failed %s checkout is not replayed either", async (_label, session) => {
    failedRow("evt_other")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_other", session))
    const result = await replayFailedStripeWebhooks({ now: NOW })
    expect(result.notReplayed).toBe(1)
    expect(h.scheduleTransfers).not.toHaveBeenCalled()
    expect(statusOf("evt_other")).toBe("failed_not_replayed")
  })

  it("CONTROL: a failed MARKETPLACE payment checkout IS replayed (orders are read, payouts scheduled)", async () => {
    failedRow("evt_market")
    h.orderIds = ["ord_1"]
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_market", marketplaceSession))

    const result = await replayFailedStripeWebhooks({ now: NOW })

    expect(result).toMatchObject({ replayed: 1, notReplayed: 0 })
    expect(h.scheduleTransfers).toHaveBeenCalledTimes(1)
    expect(statusOf("evt_market")).toBe("success")
  })

  it("CONTROL: Stripe's OWN delivery of the same subscription event does activate the plan (the spies are wired)", async () => {
    await processStripeWebhookEvent(checkoutCompleted("evt_live", subscriptionSession))
    expect(h.activatePro).toHaveBeenCalledTimes(1)
  })
})

describe("a closed event can be applied ON PURPOSE by resending it from Stripe (review #7)", () => {
  it("a failed_not_replayed row is processed when the event is resent: not a 'duplicate'", async () => {
    failedRow("evt_sub")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_sub", subscriptionSession))
    await replayFailedStripeWebhooks({ now: NOW })
    expect(statusOf("evt_sub")).toBe("failed_not_replayed")
    expect(h.activatePro).not.toHaveBeenCalled()

    // the operator decides: Stripe dashboard > Events > Resend
    const resend = await processStripeWebhookEvent(checkoutCompleted("evt_sub", subscriptionSession))

    expect(resend.duplicate).toBe(false)
    expect(h.activatePro).toHaveBeenCalledTimes(1)
    expect(statusOf("evt_sub")).toBe("success")
  })

  it("the cron never selects a failed_not_replayed row again: one alert, not one every 6 hours", async () => {
    failedRow("evt_sub")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_sub", subscriptionSession))
    await replayFailedStripeWebhooks({ now: NOW })
    h.eventsRetrieve.mockClear()
    h.opsWebhookAlert.mockClear()

    await replayFailedStripeWebhooks({ now: NOW })

    expect(h.eventsRetrieve).not.toHaveBeenCalled()
    expect(h.opsWebhookAlert).not.toHaveBeenCalled()
  })

  it("a resend of a failed_expired row (older than 30 days / gone at Stripe: it can not be resent anyway) stays a duplicate", async () => {
    ledger.rows.set("evt_old", { id: "evt_old", orderId: null, status: "failed_expired", error: "boom", createdAt: daysAgo(40) })
    const result = await processStripeWebhookEvent(checkoutCompleted("evt_old", subscriptionSession))
    expect(result.duplicate).toBe(true)
    expect(h.activatePro).not.toHaveBeenCalled()
  })

  it("the alert tells the operator exactly how to re-arm one", async () => {
    failedRow("evt_sub")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_sub", subscriptionSession))
    await replayFailedStripeWebhooks({ now: NOW })
    const text = String(h.opsWebhookAlert.mock.calls[0]?.[0])
    expect(text).toContain("Resend")
    expect(text).toContain("stripe events resend")
    expect(text).toContain("failed_not_replayed")
  })

  it("the alert is sent BEFORE the row is closed: a function cut in between repeats an alert, it never loses one", async () => {
    failedRow("evt_sub")
    h.eventsRetrieve.mockResolvedValue(checkoutCompleted("evt_sub", subscriptionSession))
    let statusAtAlert: string | undefined
    h.opsWebhookAlert.mockImplementation(async () => {
      statusAtAlert = statusOf("evt_sub")
      return { slack: true, discord: false }
    })

    await replayFailedStripeWebhooks({ now: NOW })

    expect(statusAtAlert).toBe("failed")
    expect(statusOf("evt_sub")).toBe("failed_not_replayed")
  })

  it("same order for an event older than 30 days: alert first, close after", async () => {
    failedRow("evt_ancient", 40)
    let statusAtAlert: string | undefined
    h.opsWebhookAlert.mockImplementation(async () => {
      statusAtAlert = statusOf("evt_ancient")
      return { slack: true, discord: false }
    })

    await replayFailedStripeWebhooks({ now: NOW })

    expect(statusAtAlert).toBe("failed")
    expect(statusOf("evt_ancient")).toBe("failed_expired")
  })
})
