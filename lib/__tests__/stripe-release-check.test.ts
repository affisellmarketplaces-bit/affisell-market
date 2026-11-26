import { describe, expect, it } from "vitest"

import { decideReleaseWithStripe, isSyntheticRefundRow } from "@/lib/transfers/stripe-release-check"

const charge = { id: "ch_1", status: "succeeded", captured: true, disputed: false, currency: "eur" }
const base = {
  orderId: "ord_1",
  orderCurrency: "EUR",
  chargeOrderCount: 1,
  charge,
  stripeRefunds: [],
  localRefunds: [],
}

describe("release check with Stripe (pure)", () => {
  it("consistent: no refund anywhere", () => {
    expect(decideReleaseWithStripe(base)).toMatchObject({ ok: true, stripeRefundCents: 0, stripeRefundCount: 0 })
  })

  it("charge not captured / not succeeded / other currency: held", () => {
    expect(decideReleaseWithStripe({ ...base, charge: { ...charge, status: "pending" } })).toMatchObject({
      reason: "charge_not_succeeded",
    })
    expect(decideReleaseWithStripe({ ...base, charge: { ...charge, captured: false } })).toMatchObject({
      reason: "charge_not_succeeded",
    })
    expect(decideReleaseWithStripe({ ...base, charge: { ...charge, currency: "usd" } })).toMatchObject({
      reason: "currency_mismatch",
    })
  })

  it("multi-order charge: a refund naming another order is ignored, one naming none is ambiguous", () => {
    const other = { id: "re_o", amount: 500, status: "succeeded", metadataOrderId: "ord_2" }
    expect(decideReleaseWithStripe({ ...base, chargeOrderCount: 2, stripeRefunds: [other] })).toMatchObject({
      ok: true,
    })
    const none = { id: "re_n", amount: 500, status: "succeeded", metadataOrderId: null }
    expect(decideReleaseWithStripe({ ...base, chargeOrderCount: 2, stripeRefunds: [none] })).toMatchObject({
      reason: "ambiguous_refund",
    })
    // Single-order charge: the same refund without metadata is this order's.
    expect(decideReleaseWithStripe({ ...base, stripeRefunds: [none] })).toMatchObject({ reason: "refund_not_recorded" })
  })

  it("a lost-dispute row recorded by D7 is ours alone and never compared with Stripe's refunds", () => {
    expect(isSyntheticRefundRow("dp_123:ord_1")).toBe(true)
    expect(isSyntheticRefundRow("re_123")).toBe(false)
    expect(
      decideReleaseWithStripe({ ...base, localRefunds: [{ stripeRefundId: "dp_123:ord_1", amountCents: 13_000 }] }),
    ).toMatchObject({ ok: true })
  })

  it("unknown refund status counts as a refund (fail closed)", () => {
    expect(
      decideReleaseWithStripe({
        ...base,
        stripeRefunds: [{ id: "re_x", amount: 100, status: null, metadataOrderId: null }],
      }),
    ).toMatchObject({ reason: "refund_not_recorded" })
  })

  it("disputes: won / closed let it go, open / unknown / lost hold, flagged-but-unlisted holds", () => {
    const flagged = { ...base, charge: { ...charge, disputed: true } }
    expect(decideReleaseWithStripe({ ...flagged, stripeDisputes: [{ id: "dp", status: "won" }] })).toMatchObject({
      ok: true,
    })
    expect(
      decideReleaseWithStripe({ ...flagged, stripeDisputes: [{ id: "dp", status: "warning_closed" }] }),
    ).toMatchObject({ ok: true })
    expect(
      decideReleaseWithStripe({ ...flagged, stripeDisputes: [{ id: "dp", status: "under_review" }] }),
    ).toMatchObject({ reason: "charge_disputed" })
    expect(
      decideReleaseWithStripe({ ...flagged, stripeDisputes: [{ id: "dp", status: "something_new" }] }),
    ).toMatchObject({ reason: "charge_disputed" })
    expect(decideReleaseWithStripe({ ...flagged, stripeDisputes: [{ id: "dp", status: "lost" }] })).toMatchObject({
      reason: "dispute_lost_not_applied",
    })
    expect(decideReleaseWithStripe({ ...flagged, stripeDisputes: [] })).toMatchObject({ reason: "charge_disputed" })
  })
})
