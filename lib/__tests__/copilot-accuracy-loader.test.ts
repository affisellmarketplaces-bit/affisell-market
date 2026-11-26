import { describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  orders: [] as Array<Record<string, unknown>>,
  ledger: [] as Array<Record<string, unknown>>,
  reversals: [] as Array<Record<string, unknown>>,
  attempts: [] as Array<Record<string, unknown>>,
  refunds: [] as Array<Record<string, unknown>>,
  audit: [] as Array<Record<string, unknown>>,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: vi.fn(async () => db.orders) },
    merchantPayoutLedger: { findMany: vi.fn(async () => db.ledger) },
    transferReversal: { findMany: vi.fn(async () => db.reversals) },
    transferAttempt: { findMany: vi.fn(async () => db.attempts) },
    orderStripeRefund: { groupBy: vi.fn(async () => db.refunds) },
    auditLog: {
      findMany: vi.fn(async ({ where }: { where: { action: string } }) =>
        db.audit.filter((a) => a.action === where.action),
      ),
    },
    $queryRaw: vi.fn(async () => []),
  },
}))

import { buildAffiliateCatalogCardEconomics } from "@/lib/affiliate-catalog-margin-display"
import { loadActionOutcomes, loadCopilotAccuracy, loadSupplierReliability } from "@/lib/copilot-insights.server"
import { prisma } from "@/lib/prisma"
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
  paidAt: new Date("2026-10-20T00:00:00Z"),
  affiliateProductId: "lst_1",
  totalCents: null,
  taxCents: 0,
  shippingCents: 0,
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
    db.attempts = []
    db.refunds = []
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

  it("after scheduling, Order.affiliatePayoutCents already holds the NET: settled comes from the transfer attempt, never re-netted", async () => {
    // schedule-from-checkout rewrote affiliatePayoutCents with the net transfer (3 200) — re-applying the settlement
    // function to it would add the markup a second time.
    db.orders = [{ ...order, affiliatePayoutCents: 3_200 }]
    db.attempts = [
      {
        orderId: "ord_000001",
        amountCents: 3_200,
        reversedAmountCents: 0,
        status: "SUCCESS",
        stripeTransferId: "tr_1",
      },
    ]
    // The same Stripe transfer is also in the ledger: counted ONCE.
    db.ledger = [{ orderId: "ord_000001", entryType: "PAYOUT", amountCents: 3_200, stripeTransferId: "tr_1" }]
    db.reversals = []
    db.refunds = []
    const { rows } = await loadCopilotAccuracy({ affiliateId: "aff_1", now })
    expect(rows[0]).toMatchObject({ settledCents: 3_200, paidCents: 3_200, dueCents: 3_200, outstandingCents: 0 })
  })

  it("a reversal recorded twice (attempt + reversal row) is deducted once; a partial refund lowers what is due", async () => {
    db.orders = [{ ...order, affiliatePayoutCents: 3_200 }]
    db.attempts = [
      {
        orderId: "ord_000001",
        amountCents: 3_200,
        reversedAmountCents: 1_600,
        status: "SUCCESS",
        stripeTransferId: "tr_1",
      },
    ]
    db.ledger = []
    db.reversals = [{ orderId: "ord_000001", amountCents: 1_600, stripeTransferId: "tr_1" }]
    db.refunds = [{ orderId: "ord_000001", _sum: { amountCents: 6_500 } }] // half of the 13 000 sale refunded
    const { rows } = await loadCopilotAccuracy({ affiliateId: "aff_1", now })
    expect(rows[0]).toMatchObject({
      settledCents: 3_200,
      dueCents: 1_600,
      paidCents: 1_600,
      outstandingCents: 0,
      refunded: true,
    })
  })

  it("did-the-advice-work uses what is really DUE: a partial refund turns an apparent gain into a loss", async () => {
    const applied = new Date("2026-09-01T00:00:00Z")
    const day = (d: number) => new Date(applied.getTime() + d * 86_400_000)
    db.audit = [
      { id: "aud_1", action: "copilot.apply", entityId: "lst_1", payload: { type: "reprice" }, createdAt: applied },
    ]
    const mk = (i: number, at: Date) => ({
      ...order,
      id: `o_${i}`,
      affiliateProductId: "lst_1",
      paidAt: at,
      affiliatePayoutCents: 3_200,
    })
    db.orders = [...[1, 2, 3, 4, 5].map((i) => mk(i, day(-10 - i))), ...[6, 7, 8, 9, 10].map((i) => mk(i, day(i)))]
    db.attempts = db.orders.map((o) => ({
      orderId: o.id,
      amountCents: 3_200,
      reversedAmountCents: 0,
      status: "PENDING",
      stripeTransferId: null,
    }))
    db.ledger = []
    db.reversals = []
    // Every sale after the action was 80 % refunded.
    db.refunds = [6, 7, 8, 9, 10].map((i) => ({ orderId: `o_${i}`, _sum: { amountCents: 10_400 } }))
    const { outcomes } = await loadActionOutcomes("aff_1", now)
    expect(outcomes[0]!.outcome.verdict).toBe("unfavourable")
  })

  it("supplier reliability reads the MOST RECENT orders when capped, and scores them in time order", async () => {
    db.orders = []
    const findMany = prisma.order.findMany as unknown as ReturnType<typeof vi.fn>
    findMany.mockClear()
    await loadSupplierReliability(["sup_1"], now)
    const supplierCall = findMany.mock.calls.find((c) => JSON.stringify(c[0].where).includes("sup_1"))!
    expect(supplierCall[0].orderBy).toEqual({ paidAt: "desc" })
  })

  it("a partial refund on a taxed sale is measured against what the buyer PAID (TTC), not the pre-tax line", async () => {
    // 13 000 HT + 2 600 VAT = 15 600 paid; 7 800 refunded = exactly half.
    db.orders = [{ ...order, affiliatePayoutCents: 3_200, totalCents: 15_600, taxCents: 2_600, shippingCents: 0 }]
    db.attempts = [
      { orderId: "ord_000001", amountCents: 3_200, reversedAmountCents: 0, status: "PENDING", stripeTransferId: null },
    ]
    db.ledger = []
    db.reversals = []
    db.refunds = [{ orderId: "ord_000001", _sum: { amountCents: 7_800 } }]
    const { rows } = await loadCopilotAccuracy({ affiliateId: "aff_1", now })
    expect(rows[0]).toMatchObject({ dueCents: 1_600 })
  })

  it("never throws", async () => {
    db.orders = null as never
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect((await loadCopilotAccuracy({ affiliateId: "aff_1", now })).rows).toEqual([])
  })
})
