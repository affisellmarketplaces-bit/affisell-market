import { describe, expect, it } from "vitest"

import {
  computeOrderEscrowAllocation,
  resolveOrderEscrowAllocation,
} from "@/lib/order-escrow-allocation"
import {
  evaluateAffiliateTransferRelease,
  evaluateSupplierTransferRelease,
} from "@/lib/order-transfer-gating"

describe("order-escrow-allocation", () => {
  it("allocates upstream COGS only for auto-buy", () => {
    expect(
      computeOrderEscrowAllocation({
        usesAffisellAutoBuy: true,
        aeWholesaleCents: 12_000,
        supplierPayoutCents: 25_000,
      })
    ).toEqual({ upstreamCogsCents: 12_000, supplierMarginCents: 25_000 })

    expect(
      computeOrderEscrowAllocation({
        usesAffisellAutoBuy: false,
        aeWholesaleCents: 12_000,
        supplierPayoutCents: 25_000,
      })
    ).toEqual({ upstreamCogsCents: null, supplierMarginCents: 25_000 })
  })

  it("backfills from order row when margin not persisted", () => {
    expect(
      resolveOrderEscrowAllocation({
        usesAffisellAutoBuy: true,
        aeWholesaleCents: 5_000,
        supplierPayoutCents: 18_000,
      })
    ).toEqual({ upstreamCogsCents: 5_000, supplierMarginCents: 18_000 })
  })
})

describe("order-transfer-gating", () => {
  const baseShipped = {
    status: "shipped",
    usesAffisellAutoBuy: false,
    shippedAt: new Date("2026-06-01"),
    trackingNumber: "TRK1",
    deliveredAt: new Date("2026-06-03"),
    deliveryConfirmedAt: null as Date | null,
    deliveryConfirmedBy: null as string | null,
    payoutEligibleAt: null as Date | null,
    fulfillmentStatus: "SHIPPED" as const,
  }

  it("blocks supplier until ship tracking", () => {
    const r = evaluateSupplierTransferRelease({
      ...baseShipped,
      status: "paid",
      shippedAt: null,
      trackingNumber: null,
    })
    expect(r.eligible).toBe(false)
    expect(r.phase).toBe("awaiting_ship")
  })

  it("releases supplier on catalog when shipped", () => {
    expect(evaluateSupplierTransferRelease(baseShipped).eligible).toBe(true)
  })

  it("blocks auto-buy supplier until upstream bought", () => {
    const r = evaluateSupplierTransferRelease({
      ...baseShipped,
      usesAffisellAutoBuy: true,
      autoBuyLogStatus: "PENDING",
      fulfillmentStatus: "PENDING",
    })
    expect(r.eligible).toBe(false)
    expect(r.phase).toBe("awaiting_upstream")
  })

  it("releases auto-buy supplier after BOUGHT + ship", () => {
    expect(
      evaluateSupplierTransferRelease({
        ...baseShipped,
        usesAffisellAutoBuy: true,
        autoBuyLogStatus: "BOUGHT",
      }).eligible
    ).toBe(true)
  })

  it("blocks affiliate until delivery confirm window", () => {
    const r = evaluateAffiliateTransferRelease({
      ...baseShipped,
      deliveredAt: new Date("2026-06-03"),
    })
    expect(r.eligible).toBe(false)
    expect(r.phase).toBe("awaiting_delivery_confirm")
  })

  it("releases affiliate after payoutEligibleAt", () => {
    expect(
      evaluateAffiliateTransferRelease(
        {
          ...baseShipped,
          deliveryConfirmedAt: new Date("2026-06-04"),
          payoutEligibleAt: new Date("2026-06-11"),
        },
        new Date("2026-06-12")
      ).eligible
    ).toBe(true)
  })
})
