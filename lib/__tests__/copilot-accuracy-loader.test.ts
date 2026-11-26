import { describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  orders: [] as Array<Record<string, unknown>>,
  ledger: [] as Array<Record<string, unknown>>,
  reversals: [] as Array<Record<string, unknown>>,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: vi.fn(async () => db.orders) },
    merchantPayoutLedger: { findMany: vi.fn(async () => db.ledger) },
    transferReversal: { findMany: vi.fn(async () => db.reversals) },
    orderStripeRefund: { groupBy: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
  },
}))

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { loadCopilotAccuracy } from "@/lib/copilot-insights.server"
import { netAffiliateTransferCents } from "@/lib/marketplace-phase1-fees"

const now = new Date("2026-11-26T00:00:00Z")
const order = {
  id: "ord_000001",
  affiliateId: "aff_1",
  productId: "prod_1",
  supplierId: "sup_1",
  quantity: 2,
  basePriceCents: 10_000,
  sellingPriceCents: 13_000,
  commissionCents: 1_000,
  affiliatePayoutCents: 1_000,
  affiliateMarginRetainedCents: 0,
  affiliateFeeCents: 800,
  affiliateMarginCents: 3_000,
  status: "delivered",
  payoutStatus: "PAID",
  payoutEligibleAt: new Date("2026-11-01T00:00:00Z"),
  product: { categoryId: "cat_a" },
  affiliate: { affiliatePlatformFeeBps: null },
}

describe("loadCopilotAccuracy (order snapshot + payout ledger)", () => {
  it("estimates with the copilot's own model on the checkout snapshot, settles with the settlement function, pays only what moved", async () => {
    db.orders = [order]
    db.ledger = [
      { orderId: "ord_000001", entryType: "PAYOUT", amountCents: 2_000, stripeTransferId: "tr_1" },
      { orderId: "ord_000001", entryType: "PAYOUT", amountCents: 500, stripeTransferId: null },
    ]
    db.reversals = []
    const { rows, overall } = await loadCopilotAccuracy({ affiliateId: "aff_1", now })
    const unit = buildAffiliateCatalogCardEconomics(5_000, 10, { listedSellingPriceCents: 6_500 }).netPartnerGainCents
    expect(rows[0]).toMatchObject({
      estimatedCents: unit * 2,
      settledCents: netAffiliateTransferCents(order),
      paidCents: 2_000,
      recordedNotTransferredCents: 500,
    })
    // The copilot's model and the settlement agree on this sale: 13 000 − 10 000 + 1 000 = 4 000 gross, 20 % fee.
    expect(rows[0]!.errorCents).toBe(0)
    expect(rows[0]!.outstandingCents).toBe(rows[0]!.dueCents - 2_000)
    expect(overall.orders).toBe(1)
    expect(overall.verdict).toBe("insufficient_data")
  })

  it("never throws", async () => {
    db.orders = null as never
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect((await loadCopilotAccuracy({ affiliateId: "aff_1", now })).rows).toEqual([])
  })
})
