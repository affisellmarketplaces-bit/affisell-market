import { describe, expect, it } from "vitest"

import {
  isDuplicateWebhookRecord,
  isEventTypeSafeToReplayLate,
  isReplayableWebhookRecord,
  REPLAY_SAFE_EVENT_TYPES,
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
