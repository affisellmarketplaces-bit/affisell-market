import { describe, expect, it } from "vitest"

import { analyzeLegacyPayoutOrder } from "@/lib/payout-legacy-backfill"
import { isLedgerPayoutRealized } from "@/lib/payout-settlement.shared"

describe("payout-legacy-backfill", () => {
  it("isLedgerPayoutRealized rejects phantom and unlinked marketplace ledger", () => {
    expect(
      isLedgerPayoutRealized({
        stripeTransferId: null,
        payoutRail: "phantom_legacy",
        blindDropshipOrderId: null,
      })
    ).toBe(false)
    expect(
      isLedgerPayoutRealized({
        stripeTransferId: null,
        payoutRail: "ledger_only",
        blindDropshipOrderId: null,
      })
    ).toBe(false)
    expect(
      isLedgerPayoutRealized({
        stripeTransferId: "tr_123",
        payoutRail: "connect",
        blindDropshipOrderId: null,
      })
    ).toBe(true)
    expect(
      isLedgerPayoutRealized({
        stripeTransferId: null,
        payoutRail: "ledger_only",
        blindDropshipOrderId: "blind_1",
      })
    ).toBe(true)
  })

  it("analyzeLegacyPayoutOrder flags phantom supplier ledger without Stripe", () => {
    const analysis = analyzeLegacyPayoutOrder({
      id: "ord_1",
      status: "shipped",
      customerEmail: "a@b.com",
      createdAt: new Date("2026-01-01"),
      splitStatus: "PENDING",
      payoutStatus: "PENDING",
      supplierPayoutAt: new Date("2026-01-10"),
      affiliatePayoutAt: null,
      supplierId: "sup_1",
      affiliateId: "aff_1",
      transferAttempts: [],
      merchantPayoutLedger: [
        {
          id: "led_1",
          beneficiaryRole: "SUPPLIER",
          amountCents: 4500,
          stripeTransferId: null,
          payoutRail: "ledger_only",
          idempotencyKey: "payout:supplier:ord_1",
          blindDropshipOrderId: null,
        },
      ],
    })

    expect(analysis.needsRemediation).toBe(true)
    expect(analysis.roles.find((r) => r.role === "SUPPLIER")?.needsConnectBackfill).toBe(true)
    expect(analysis.roles.find((r) => r.role === "AFFILIATE")?.needsConnectBackfill).toBe(false)
  })

  it("analyzeLegacyPayoutOrder skips when Stripe transfer already succeeded", () => {
    const analysis = analyzeLegacyPayoutOrder({
      id: "ord_2",
      status: "shipped",
      customerEmail: "a@b.com",
      createdAt: new Date("2026-01-01"),
      splitStatus: "SUCCESS",
      payoutStatus: "PAID",
      supplierPayoutAt: new Date(),
      affiliatePayoutAt: new Date(),
      supplierId: "sup_1",
      affiliateId: "aff_1",
      transferAttempts: [
        {
          role: "SUPPLIER",
          status: "SUCCESS",
          stripeTransferId: "tr_sup",
          amountCents: 4500,
        },
        {
          role: "AFFILIATE",
          status: "SUCCESS",
          stripeTransferId: "tr_aff",
          amountCents: 1200,
        },
      ],
      merchantPayoutLedger: [
        {
          id: "led_1",
          beneficiaryRole: "SUPPLIER",
          amountCents: 4500,
          stripeTransferId: "tr_sup",
          payoutRail: "connect",
          idempotencyKey: "stripe:tr:tr_sup",
          blindDropshipOrderId: null,
        },
      ],
    })

    expect(analysis.needsRemediation).toBe(false)
  })
})
