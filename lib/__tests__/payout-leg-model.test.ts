import { describe, expect, it } from "vitest"

import {
  buildLegTransferRequest,
  classifyCreateError,
  decideClaim,
  economicParamsHash,
  isLegPaid,
  judgeSearch,
  legIdempotencyKey,
  legProvablyUnpaid,
  orderLegKey,
  PAYOUT_LEG_LEASE_MS,
  transferLegKeyOf,
  validateEconomicParams,
  type LegRowView,
  type StripeTransferView,
} from "@/lib/payouts/leg-model"

const NOW = new Date("2026-11-25T10:00:00Z")
const HASH = economicParamsHash({ amountCents: 1000, currency: "eur", destination: "acct_A", sourceTransaction: "ch_1" })

function leg(p: Partial<LegRowView> = {}): LegRowView {
  return { state: "PENDING", generation: 1, paramsHash: null, claimedAt: null, stripeTransferId: null, ...p }
}

function transfer(p: Partial<StripeTransferView> = {}): StripeTransferView {
  return {
    id: "tr_1",
    amount: 1000,
    currency: "eur",
    destination: "acct_A",
    transfer_group: "o1",
    metadata: { affisell_leg_key: orderLegKey("o1", "SUPPLIER") },
    created: 1,
    ...p,
  }
}

const LEG = { legKey: orderLegKey("o1", "SUPPLIER"), kind: "order" as const, role: "SUPPLIER" as const, orderId: "o1" }
const EXPECTED = { amountCents: 1000, destination: "acct_A", currency: "eur" }

describe("keys", () => {
  it("one idempotency key per leg and generation, shared by every rail", () => {
    expect(legIdempotencyKey(orderLegKey("o1", "SUPPLIER"), 1)).toBe("affisell_leg:order:o1:SUPPLIER:g1")
    expect(legIdempotencyKey(orderLegKey("o1", "SUPPLIER"), 2)).not.toBe(legIdempotencyKey(orderLegKey("o1", "SUPPLIER"), 1))
  })
  it("the economic hash ignores formatting, not substance", () => {
    expect(economicParamsHash({ amountCents: 1000, currency: "EUR ", destination: " acct_A", sourceTransaction: "ch_1" })).toBe(HASH)
    expect(economicParamsHash({ amountCents: 1001, currency: "eur", destination: "acct_A", sourceTransaction: "ch_1" })).not.toBe(HASH)
    expect(economicParamsHash({ amountCents: 1000, currency: "eur", destination: "acct_B", sourceTransaction: "ch_1" })).not.toBe(HASH)
    expect(economicParamsHash({ amountCents: 1000, currency: "eur", destination: "acct_A", sourceTransaction: null })).not.toBe(HASH)
  })
  it("validates what is sent", () => {
    expect(validateEconomicParams({ amountCents: 0, currency: "eur", destination: "acct_A", sourceTransaction: null })).toBe("amount_invalid")
    expect(validateEconomicParams({ amountCents: 10, currency: "eur", destination: "nope", sourceTransaction: null })).toBe("destination_invalid")
    expect(validateEconomicParams({ amountCents: 10, currency: "eur", destination: "acct_A", sourceTransaction: "x" })).toBe("source_transaction_invalid")
    expect(validateEconomicParams({ amountCents: 10, currency: "eur", destination: "acct_A", sourceTransaction: "ch_9" })).toBeNull()
  })
  it("normalised metadata can not be overridden by a caller", () => {
    const r = buildLegTransferRequest({
      legKey: orderLegKey("o1", "SUPPLIER"),
      kind: "order",
      role: "SUPPLIER",
      rail: "lightning",
      orderId: "o1",
      generation: 1,
      transferGroup: "o1",
      params: { amountCents: 1000, currency: "EUR", destination: "acct_A", sourceTransaction: "ch_1" },
      extraMetadata: { affisell_leg_key: "forged", note: "x" },
    })
    expect(r.metadata.affisell_leg_key).toBe(orderLegKey("o1", "SUPPLIER"))
    expect(r.metadata).toMatchObject({ affisell_order_id: "o1", affisell_role: "SUPPLIER", affisell_rail: "lightning", note: "x" })
    expect(r).toMatchObject({ amount: 1000, currency: "eur", transfer_group: "o1", source_transaction: "ch_1" })
  })
})

describe("decideClaim", () => {
  it("PAID wins over everything", () => {
    expect(decideClaim({ leg: leg({ state: "PAID", stripeTransferId: "tr_9" }), evidence: { kind: "doubt", reason: "x" }, paramsHash: HASH, now: NOW }))
      .toEqual({ action: "already_paid", stripeTransferId: "tr_9" })
  })
  it("a payment recorded outside the registry is adopted, even on an in-doubt leg", () => {
    for (const state of ["PENDING", "IN_DOUBT", "FAILED_CONFIRMED", "PROCESSING"] as const) {
      expect(decideClaim({ leg: leg({ state, claimedAt: NOW }), evidence: { kind: "paid", stripeTransferId: "tr_7", source: "transfer_attempt" }, paramsHash: HASH, now: NOW }).action)
        .toBe("adopt_legacy")
    }
  })
  it("IN_DOUBT is never claimed", () => {
    expect(decideClaim({ leg: leg({ state: "IN_DOUBT" }), evidence: { kind: "none" }, paramsHash: HASH, now: NOW })).toEqual({ action: "in_doubt" })
  })
  it("a legacy trace of payment without a usable id becomes a doubt", () => {
    expect(decideClaim({ leg: leg(), evidence: { kind: "doubt", reason: "legacy_order_transfer_reference" }, paramsHash: HASH, now: NOW }))
      .toEqual({ action: "mark_in_doubt", reason: "legacy_order_transfer_reference" })
  })
  it("a live claim is busy; an expired one becomes a doubt, never a new attempt", () => {
    const fresh = new Date(NOW.getTime() - 1000)
    const stale = new Date(NOW.getTime() - PAYOUT_LEG_LEASE_MS - 1)
    expect(decideClaim({ leg: leg({ state: "PROCESSING", claimedAt: fresh }), evidence: { kind: "none" }, paramsHash: HASH, now: NOW }).action).toBe("busy")
    expect(decideClaim({ leg: leg({ state: "PROCESSING", claimedAt: stale }), evidence: { kind: "none" }, paramsHash: HASH, now: NOW }))
      .toEqual({ action: "mark_in_doubt", reason: "claim_lease_expired" })
  })
  it("frozen parameters: same generation, same hash, or refused", () => {
    expect(decideClaim({ leg: leg({ paramsHash: HASH }), evidence: { kind: "none" }, paramsHash: HASH, now: NOW }))
      .toEqual({ action: "claim", generation: 1, freezeParams: false })
    expect(decideClaim({ leg: leg({ paramsHash: "other" }), evidence: { kind: "none" }, paramsHash: HASH, now: NOW })).toEqual({ action: "params_changed" })
    expect(decideClaim({ leg: leg(), evidence: { kind: "none" }, paramsHash: HASH, now: NOW })).toEqual({ action: "claim", generation: 1, freezeParams: true })
  })
  it("after a PROVED failure the next attempt opens a new generation and re-freezes", () => {
    expect(decideClaim({ leg: leg({ state: "FAILED_CONFIRMED", generation: 2, paramsHash: "old" }), evidence: { kind: "none" }, paramsHash: HASH, now: NOW }))
      .toEqual({ action: "claim", generation: 3, freezeParams: true })
  })
})

describe("judgeSearch", () => {
  it("only a complete, empty search allows a creation", () => {
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [] })).toEqual({ verdict: "none_found" })
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: false, transfers: [] }).verdict).toBe("incomplete")
  })
  it("adopts one consistent transfer, doubts a mismatch or a duplicate", () => {
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [transfer()] }).verdict).toBe("adopt")
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [transfer({ amount: 999 })] }))
      .toEqual({ verdict: "in_doubt", reason: "existing_transfer_mismatch" })
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [transfer(), transfer({ id: "tr_2" })] }))
      .toEqual({ verdict: "in_doubt", reason: "duplicate_transfers_found" })
  })
  it("recognises every legacy metadata shape (A1 legacy transfers are adopted, not re-created)", () => {
    const standard = transfer({ metadata: { orderId: "o1", role: "SUPPLIER" } })
    const lightning = transfer({ metadata: { orderId: "o1", role: "supplier", lightning: "true" } })
    const legion = transfer({ metadata: { order_id: "o1", role: "sponsor" } })
    expect(transferLegKeyOf(standard, "order")).toBe(orderLegKey("o1", "SUPPLIER"))
    expect(transferLegKeyOf(lightning, "order")).toBe(orderLegKey("o1", "SUPPLIER"))
    expect(transferLegKeyOf(legion, "order")).toBe(orderLegKey("o1", "LEGION_SPONSOR"))
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [lightning] }).verdict).toBe("adopt")
  })
  it("another leg of the same order does not block; an unidentified transfer does", () => {
    const affiliate = transfer({ id: "tr_a", metadata: { affisell_leg_key: orderLegKey("o1", "AFFILIATE") } })
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [affiliate] })).toEqual({ verdict: "none_found" })
    const unknown = transfer({ id: "tr_u", metadata: { order_id: "o1", role: "seller" } })
    expect(judgeSearch({ leg: LEG, expected: EXPECTED, complete: true, transfers: [unknown] }))
      .toEqual({ verdict: "in_doubt", reason: "unidentified_transfer_in_group" })
  })
})

describe("classifyCreateError — allow-list of proved refusals", () => {
  it("timeouts, network errors, 5xx, idempotency conflicts and unknown errors are doubts", () => {
    expect(classifyCreateError({ type: "StripeConnectionError" })).toBe("in_doubt")
    expect(classifyCreateError({ type: "StripeAPIError", statusCode: 500 })).toBe("in_doubt")
    expect(classifyCreateError({ type: "StripeIdempotencyError", statusCode: 400 })).toBe("in_doubt")
    expect(classifyCreateError({ type: "StripeInvalidRequestError", statusCode: 409 })).toBe("in_doubt")
    expect(classifyCreateError(new Error("ETIMEDOUT"))).toBe("in_doubt")
    expect(classifyCreateError(undefined)).toBe("in_doubt")
    expect(classifyCreateError({ type: "StripeInvalidRequestError" })).toBe("in_doubt") // no status: not proved
  })
  it("4xx business / validation refusals are confirmed failures; 429 was not processed", () => {
    expect(classifyCreateError({ type: "StripeInvalidRequestError", statusCode: 400, code: "balance_insufficient" })).toBe("failed_confirmed")
    expect(classifyCreateError({ type: "StripePermissionError", statusCode: 403 })).toBe("failed_confirmed")
    expect(classifyCreateError({ type: "StripeRateLimitError", statusCode: 429 })).toBe("not_processed")
  })
  it("outcome helpers", () => {
    expect(isLegPaid({ outcome: "already_paid", stripeTransferId: "tr_1", amountCents: null, destination: null, adopted: true })).toBe(true)
    expect(legProvablyUnpaid({ outcome: "in_doubt", reason: "x" })).toBe(false)
    expect(legProvablyUnpaid({ outcome: "busy" })).toBe(false)
    expect(legProvablyUnpaid({ outcome: "failed_confirmed", errorCode: "x", errorMessage: "y" })).toBe(true)
  })
})
