import { describe, expect, it } from "vitest"

import { aeOrderAmountCents, allocateChargeFee, issuingNetDebitCents, stripeFeeFromBalanceTransaction, summarizeGaps } from "@/lib/strategic-intelligence/fee-reconciliation"

describe("Stripe fee", () => {
  it("reads the balance transaction fee, EUR only", () => {
    expect(stripeFeeFromBalanceTransaction({ fee: 129, currency: "eur" })).toBe(129)
    expect(stripeFeeFromBalanceTransaction({ fee: 129, currency: "usd" })).toBeNull()
    expect(stripeFeeFromBalanceTransaction({ fee: -1, currency: "eur" })).toBeNull()
    expect(stripeFeeFromBalanceTransaction("txn_123")).toBeNull()
  })
  it("splits a cart's fee pro rata; the parts always add up", () => {
    const m = allocateChargeFee(100, [{ id: "a", chargedCents: 1000 }, { id: "b", chargedCents: 1000 }, { id: "c", chargedCents: 1000 }])
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(100)
    expect([m.get("a"), m.get("b"), m.get("c")]).toEqual([34, 33, 33])
    expect(allocateChargeFee(55, [{ id: "a", chargedCents: 3000 }, { id: "b", chargedCents: 1000 }])).toEqual(new Map([["a", 41], ["b", 14]]))
    expect(allocateChargeFee(10, [{ id: "a", chargedCents: 0 }])).toEqual(new Map([["a", 10]]))
  })
})

describe("AliExpress debit", () => {
  it("Issuing: captures minus refunds, EUR only; no transaction = unknown", () => {
    expect(issuingNetDebitCents([{ amount: -2450, currency: "eur", type: "capture" }, { amount: 300, currency: "eur", type: "refund" }])).toBe(2150)
    expect(issuingNetDebitCents([])).toBeNull()
    expect(issuingNetDebitCents([{ amount: -2450, currency: "usd", type: "capture" }])).toBeNull()
  })
  it("DS order read: EUR order_amount only", () => {
    expect(aeOrderAmountCents({ aliexpress_trade_ds_order_get_response: { result: { order_amount: { amount: "24.50", currency_code: "EUR" } } } })).toBe(2450)
    expect(aeOrderAmountCents({ result: { order_amount: { amount: 24.5, currency_code: "eur" } } })).toBe(2450)
    expect(aeOrderAmountCents({ result: { order_amount: { amount: "24.50", currency_code: "USD" } } })).toBeNull()
    expect(aeOrderAmountCents({ result: { order_amount: { amount: "abc", currency_code: "EUR" } } })).toBeNull()
  })
})

describe("gap summary", () => {
  it("real − estimate", () => {
    const s = summarizeGaps([{ estimateCents: 100, actualCents: 110 }, { estimateCents: 100, actualCents: 90 }, { estimateCents: 200, actualCents: 250 }])!
    expect(s).toMatchObject({ n: 3, meanAbsGapCents: 70 / 3, p90AbsGapCents: 50, withinTenCents: 2, relativeGap: 50 / 400 })
    expect(summarizeGaps([])).toBeNull()
  })
})
