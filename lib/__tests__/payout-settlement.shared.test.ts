import { describe, expect, it } from "vitest"

import {
  clawbackLedgerIdempotencyKey,
  isPayoutRail,
  ledgerIdempotencyKeyForStripeTransfer,
  legacyLedgerIdempotencyKey,
  payoutTimestampFieldForRole,
} from "@/lib/payout-settlement.shared"

describe("payout-settlement.shared", () => {
  it("ledgerIdempotencyKeyForStripeTransfer is stable per transfer", () => {
    expect(ledgerIdempotencyKeyForStripeTransfer("tr_abc123")).toBe("stripe:tr:tr_abc123")
  })

  it("legacy keys match pre-unification cron format", () => {
    expect(legacyLedgerIdempotencyKey("SUPPLIER", "ord_1")).toBe("payout:supplier:ord_1")
    expect(legacyLedgerIdempotencyKey("AFFILIATE", "ord_1")).toBe("payout:affiliate:ord_1")
  })

  it("clawback keys are distinct per role", () => {
    expect(clawbackLedgerIdempotencyKey("SUPPLIER", "ord_1")).toBe("clawback:supplier:ord_1")
    expect(clawbackLedgerIdempotencyKey("AFFILIATE", "ord_1")).toBe("clawback:affiliate:ord_1")
  })

  it("payoutTimestampFieldForRole maps roles", () => {
    expect(payoutTimestampFieldForRole("SUPPLIER")).toBe("supplierPayoutAt")
    expect(payoutTimestampFieldForRole("AFFILIATE")).toBe("affiliatePayoutAt")
  })

  it("isPayoutRail validates rails", () => {
    expect(isPayoutRail("connect")).toBe(true)
    expect(isPayoutRail("lightning")).toBe(true)
    expect(isPayoutRail("ledger_only")).toBe(true)
    expect(isPayoutRail("paypal")).toBe(false)
  })
})
