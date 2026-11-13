import { describe, expect, it } from "vitest"

import {
  isDuplicateWebhookRecord,
  isEventSafeToReplayLate,
  isEventTypeSafeToReplayLate,
  isReplayableWebhookRecord,
  NOT_REPLAYED_WEBHOOK_STATUS,
  REPLAY_SAFE_EVENT_TYPES,
  REPLAYABLE_WEBHOOK_STATUS,
  replayBlockReason,
} from "@/lib/stripe-webhook-replay"

describe("stripe webhook replay rule", () => {
  it("only a failed record is replayable", () => {
    expect(isReplayableWebhookRecord({ status: "failed" })).toBe(true)
    for (const status of ["success", "skipped", "processing", "FAILED", ""]) {
      expect(isReplayableWebhookRecord({ status })).toBe(false)
    }
    expect(isReplayableWebhookRecord(null)).toBe(false)
    expect(isReplayableWebhookRecord(undefined)).toBe(false)
  })

  it("every other recorded status is a duplicate; no record is not a duplicate", () => {
    expect(isDuplicateWebhookRecord({ status: "failed" })).toBe(false)
    for (const status of ["success", "skipped", "processing"]) {
      expect(isDuplicateWebhookRecord({ status })).toBe(true)
    }
    expect(isDuplicateWebhookRecord(null)).toBe(false)
    expect(isDuplicateWebhookRecord(undefined)).toBe(false)
  })
})

describe("event types the replay job may apply late (review #10)", () => {
  it("pins the list: the money events whose handlers read the orders, and the dispute events", () => {
    expect([...REPLAY_SAFE_EVENT_TYPES].sort()).toEqual([
      "charge.dispute.closed",
      "charge.dispute.created",
      "charge.dispute.funds_reinstated",
      "charge.dispute.funds_withdrawn",
      "charge.dispute.updated",
      "checkout.session.completed",
      "payment_intent.succeeded",
    ])
  })

  it.each(["customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed", "charge.refunded", "account.updated", "", null, undefined])(
    "%s is not safe to apply late",
    (type) => {
      expect(isEventTypeSafeToReplayLate(type)).toBe(false)
    }
  )

  it("is case sensitive (Stripe type names are exact)", () => {
    expect(isEventTypeSafeToReplayLate("checkout.session.completed")).toBe(true)
    expect(isEventTypeSafeToReplayLate("CHECKOUT.SESSION.COMPLETED")).toBe(false)
  })
})

describe("replayBlockReason — checkout.session.completed only for marketplace payment sessions (reviews #6, #9)", () => {
  const checkout = (object: unknown) => ({ type: "checkout.session.completed", data: { object } })

  it.each(["cart", "marketplace", "single", ""])("a payment-mode session with flow %j may be replayed late", (flow) => {
    expect(replayBlockReason(checkout({ mode: "payment", metadata: flow ? { flow } : {} }))).toBeNull()
    expect(isEventSafeToReplayLate(checkout({ mode: "payment", metadata: flow ? { flow } : {} }))).toBe(true)
  })

  it.each([
    ["subscription", { mode: "subscription", metadata: {} }, /subscription/],
    ["setup", { mode: "setup" }, /setup/],
    ["unreadable mode (fail closed)", {}, /unknown/],
    ["non-string mode", { mode: 7 }, /unknown/],
    ["sponsor campaign", { mode: "payment", metadata: { flow: "sponsor_campaign" } }, /sponsor_campaign/],
    ["blind dropship", { mode: "payment", metadata: { flow: "blind_dropship" } }, /blind_dropship/],
  ])("a %s session is blocked, with a reason for the alert", (_label, object, reason) => {
    expect(replayBlockReason(checkout(object))).toMatch(reason)
    expect(isEventSafeToReplayLate(checkout(object))).toBe(false)
  })

  it("a checkout event with no readable object is blocked", () => {
    expect(replayBlockReason({ type: "checkout.session.completed" })).not.toBeNull()
    expect(replayBlockReason(checkout(null))).not.toBeNull()
  })

  it("the other whitelisted types need no session check", () => {
    expect(replayBlockReason({ type: "payment_intent.succeeded", data: { object: {} } })).toBeNull()
    expect(replayBlockReason({ type: "charge.dispute.closed", data: { object: {} } })).toBeNull()
  })

  it("a type that is not whitelisted is blocked whatever its payload", () => {
    expect(replayBlockReason({ type: "customer.subscription.updated", data: { object: { status: "active" } } })).toMatch(/applies a snapshot/)
    expect(replayBlockReason({ type: undefined })).not.toBeNull()
    expect(replayBlockReason(null)).not.toBeNull()
  })
})

describe("what a DELIVERY (Stripe retry or an operator's Resend) may reprocess (review #7)", () => {
  it("failed and failed_not_replayed are replayable by a delivery; failed_expired is a duplicate (it can not be resent)", () => {
    expect(isReplayableWebhookRecord({ status: "failed" })).toBe(true)
    expect(isReplayableWebhookRecord({ status: NOT_REPLAYED_WEBHOOK_STATUS })).toBe(true)
    expect(isDuplicateWebhookRecord({ status: NOT_REPLAYED_WEBHOOK_STATUS })).toBe(false)
    expect(isReplayableWebhookRecord({ status: "failed_expired" })).toBe(false)
    expect(isDuplicateWebhookRecord({ status: "failed_expired" })).toBe(true)
  })

  it("the cron's own selector stays `failed` only: a closed row is never selected again", () => {
    expect(REPLAYABLE_WEBHOOK_STATUS).toBe("failed")
    expect(NOT_REPLAYED_WEBHOOK_STATUS).toBe("failed_not_replayed")
  })
})
