import { describe, expect, it } from "vitest"

import { allocateDisputeLoss, disputeOutcomeFromStripeStatus } from "@/lib/orders/dispute-state"

describe("disputeOutcomeFromStripeStatus", () => {
  it.each(["needs_response", "under_review", "warning_needs_response", "warning_under_review"])(
    "%s keeps the money held (open)",
    (status) => {
      expect(disputeOutcomeFromStripeStatus(status)).toBe("open")
    }
  )

  it("won and lost are terminal", () => {
    expect(disputeOutcomeFromStripeStatus("won")).toBe("won")
    expect(disputeOutcomeFromStripeStatus("lost")).toBe("lost")
    expect(disputeOutcomeFromStripeStatus(" LOST ")).toBe("lost")
  })

  it("an inquiry closed without a chargeback, or a prevented dispute, releases without a loss", () => {
    expect(disputeOutcomeFromStripeStatus("warning_closed")).toBe("closed")
    expect(disputeOutcomeFromStripeStatus("prevented")).toBe("closed")
  })

  it.each(["", null, undefined, "something_new", "charge_refunded"])(
    "fails closed: unknown status %s counts as open (never a release or a clawback on a value we do not know)",
    (status) => {
      expect(disputeOutcomeFromStripeStatus(status)).toBe("open")
    }
  )
})

describe("allocateDisputeLoss", () => {
  const order = (id: string, chargedTotalCents: number, currency: string | null = "EUR") => ({
    id,
    chargedTotalCents,
    currency,
  })

  it("a dispute for the whole charge of a single order is a full loss", () => {
    expect(
      allocateDisputeLoss({ disputeAmountCents: 12_000, disputeCurrency: "eur", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "full", orderIds: ["o1"], totalCents: 12_000 })
  })

  it("tolerates one cent per order on the amount", () => {
    expect(
      allocateDisputeLoss({ disputeAmountCents: 11_999, disputeCurrency: "eur", orders: [order("o1", 12_000)] }).kind
    ).toBe("full")
    expect(
      allocateDisputeLoss({ disputeAmountCents: 12_001, disputeCurrency: "eur", orders: [order("o1", 12_000)] }).kind
    ).toBe("full")
    expect(
      allocateDisputeLoss({ disputeAmountCents: 11_998, disputeCurrency: "eur", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "partial_dispute" })
  })

  it("a dispute for the whole charge of a multi-order cart loses every order", () => {
    expect(
      allocateDisputeLoss({
        disputeAmountCents: 20_000,
        disputeCurrency: "EUR",
        orders: [order("o1", 12_000), order("o2", 8_000)],
      })
    ).toEqual({ kind: "full", orderIds: ["o1", "o2"], totalCents: 20_000 })
  })

  it("never guesses on a partial dispute (single or multi-order): a human decides", () => {
    expect(
      allocateDisputeLoss({ disputeAmountCents: 5_000, disputeCurrency: "eur", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "partial_dispute" })
    expect(
      allocateDisputeLoss({
        disputeAmountCents: 12_000,
        disputeCurrency: "eur",
        orders: [order("o1", 12_000), order("o2", 8_000)],
      })
    ).toEqual({ kind: "manual", reason: "partial_dispute" })
  })

  it("never applies a dispute larger than our orders (an order missing from the lookup would be clawed back wrongly)", () => {
    expect(
      allocateDisputeLoss({ disputeAmountCents: 20_000, disputeCurrency: "eur", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "amount_exceeds_orders" })
  })

  it("refuses another currency, an unknown amount, and no orders", () => {
    expect(
      allocateDisputeLoss({ disputeAmountCents: 12_000, disputeCurrency: "usd", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "currency_mismatch" })
    expect(
      allocateDisputeLoss({ disputeAmountCents: 12_000, disputeCurrency: "", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "currency_mismatch" })
    expect(
      allocateDisputeLoss({ disputeAmountCents: 0, disputeCurrency: "eur", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "amount_unknown" })
    expect(
      allocateDisputeLoss({ disputeAmountCents: undefined, disputeCurrency: "eur", orders: [order("o1", 12_000)] })
    ).toEqual({ kind: "manual", reason: "amount_unknown" })
    expect(
      allocateDisputeLoss({ disputeAmountCents: 12_000, disputeCurrency: "eur", orders: [order("o1", 0)] })
    ).toEqual({ kind: "manual", reason: "amount_unknown" })
    expect(allocateDisputeLoss({ disputeAmountCents: 12_000, disputeCurrency: "eur", orders: [] })).toEqual({
      kind: "manual",
      reason: "no_orders",
    })
  })

  it("an order with no currency is an EUR order (the column default)", () => {
    expect(
      allocateDisputeLoss({ disputeAmountCents: 100, disputeCurrency: "eur", orders: [order("o1", 100, null)] }).kind
    ).toBe("full")
  })
})
