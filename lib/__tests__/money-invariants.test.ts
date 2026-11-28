import { describe, expect, it } from "vitest"

import {
  evaluateOrderMoneyInvariants,
  moneyInvariantsExitCode,
  summarizeMoneyInvariants,
  type OrderMoneySnapshot,
} from "@/lib/finance/money-invariants"
import { payableAfterRefunds } from "@/lib/transfers/payable-after-refunds"

const t0 = new Date("2026-11-01T10:00:00Z")
const later = (min: number) => new Date(t0.getTime() + min * 60_000)

/** A healthy €100 order: supplier 70.00 and reseller 20.00 scheduled and paid once on Connect. */
function healthy(over: Partial<OrderMoneySnapshot> = {}): OrderMoneySnapshot {
  return {
    orderId: "ord_1",
    status: "delivered",
    paymentSettlementStatus: "PAID",
    payoutStatus: "PENDING",
    totalCents: 10_000,
    subtotalCents: 10_000,
    taxCents: 0,
    sellingPriceCents: 10_000,
    refunds: [],
    attempts: [
      { role: "SUPPLIER", amountCents: 7_000, status: "SUCCESS", stripeTransferId: "tr_s" },
      { role: "AFFILIATE", amountCents: 2_000, status: "SUCCESS", stripeTransferId: "tr_a" },
    ],
    ledger: [
      {
        beneficiaryRole: "SUPPLIER",
        entryType: "PAYOUT",
        amountCents: 7_000,
        stripeTransferId: "tr_s",
        payoutRail: "connect",
        createdAt: t0,
      },
      {
        beneficiaryRole: "AFFILIATE",
        entryType: "PAYOUT",
        amountCents: 2_000,
        stripeTransferId: "tr_a",
        payoutRail: "connect",
        createdAt: t0,
      },
    ],
    disputes: [],
    ...over,
  }
}
const codes = (s: OrderMoneySnapshot) =>
  evaluateOrderMoneyInvariants(s).map((v) => `${v.code}${v.role ? `:${v.role}` : ""}`)

describe("money invariants — a healthy order", () => {
  it("has no violation", () => {
    expect(codes(healthy())).toEqual([])
  })

  it("a partial refund paid at the reduced amount (#26 rule) is healthy", () => {
    const refund = 3_000
    const pay = (scheduled: number) =>
      payableAfterRefunds({ scheduledCents: scheduled, refundCents: [refund], orderChargedTotalCents: 10_000 })
        .payableCents
    const s = healthy({
      refunds: [{ amountCents: refund }],
      paymentSettlementStatus: "PARTIALLY_REFUNDED",
      ledger: [
        {
          beneficiaryRole: "SUPPLIER",
          entryType: "PAYOUT",
          amountCents: pay(7_000),
          stripeTransferId: "tr_s",
          payoutRail: "connect",
          createdAt: t0,
        },
        {
          beneficiaryRole: "AFFILIATE",
          entryType: "PAYOUT",
          amountCents: pay(2_000),
          stripeTransferId: "tr_a",
          payoutRail: "connect",
          createdAt: t0,
        },
      ],
    })
    expect(codes(s)).toEqual([])
  })

  it("paid in full then clawed back after a refund is healthy", () => {
    const s = healthy({
      refunds: [{ amountCents: 10_000 }],
      paymentSettlementStatus: "REFUNDED",
      status: "refunded",
      ledger: [
        ...healthy().ledger,
        {
          beneficiaryRole: "SUPPLIER",
          entryType: "CLAWBACK",
          amountCents: 7_000,
          stripeTransferId: null,
          payoutRail: "connect",
          createdAt: later(60),
        },
        {
          beneficiaryRole: "AFFILIATE",
          entryType: "CLAWBACK",
          amountCents: 2_000,
          stripeTransferId: null,
          payoutRail: "connect",
          createdAt: later(60),
        },
      ],
    })
    expect(codes(s)).toEqual([])
  })

  it("ledger_only and phantom_legacy rows are not money that moved", () => {
    const s = healthy({
      ledger: [
        ...healthy().ledger,
        {
          beneficiaryRole: "SUPPLIER",
          entryType: "PAYOUT",
          amountCents: 5_000,
          stripeTransferId: null,
          payoutRail: "ledger_only",
          createdAt: t0,
        },
        {
          beneficiaryRole: "SUPPLIER",
          entryType: "CLAWBACK",
          amountCents: 7_000,
          stripeTransferId: null,
          payoutRail: "phantom_legacy",
          createdAt: t0,
        },
      ],
    })
    expect(codes(s)).toEqual([])
  })
})

describe("money invariants — each violation", () => {
  it("paid the full share although a partial refund happened first (the pre-#26 defect)", () => {
    const v = evaluateOrderMoneyInvariants(
      healthy({ refunds: [{ amountCents: 3_000 }], paymentSettlementStatus: "PARTIALLY_REFUNDED" }),
    )
    expect(v.map((x) => `${x.code}:${x.role}`)).toEqual([
      "paid_more_than_payable:SUPPLIER",
      "paid_more_than_payable:AFFILIATE",
    ])
    expect(v[0]).toMatchObject({ severity: "critical", expectedCents: 4_900, actualCents: 7_000 })
  })

  it("two transfers for one role (double payment)", () => {
    const s = healthy({
      ledger: [
        ...healthy().ledger,
        {
          beneficiaryRole: "SUPPLIER",
          entryType: "PAYOUT",
          amountCents: 7_000,
          stripeTransferId: "tr_s2",
          payoutRail: "connect",
          createdAt: later(5),
        },
      ],
    })
    expect(codes(s)).toEqual(
      expect.arrayContaining(["several_transfers_one_role:SUPPLIER", "paid_more_than_payable:SUPPLIER"]),
    )
  })

  it("paid by Lightning AND by Connect (the A3 race #13 closes)", () => {
    const s = healthy({
      payoutStatus: "PAID",
      ledger: [
        ...healthy().ledger,
        {
          beneficiaryRole: "SUPPLIER",
          entryType: "PAYOUT",
          amountCents: 7_000,
          stripeTransferId: "tr_l",
          payoutRail: "lightning",
          createdAt: later(1),
        },
      ],
    })
    expect(codes(s)).toEqual(
      expect.arrayContaining(["paid_on_two_rails:SUPPLIER", "several_transfers_one_role:SUPPLIER"]),
    )
  })

  it("a payout recorded after the dispute hold opened (what D7 #28 forbids)", () => {
    const s = healthy({
      disputes: [{ status: "dispute_open", createdAt: t0 }],
      ledger: healthy().ledger.map((r) => ({ ...r, createdAt: later(30) })),
    })
    expect(codes(s)).toEqual(["paid_after_dispute_opened:SUPPLIER", "paid_after_dispute_opened:AFFILIATE"])
  })

  it("a payout BEFORE the dispute opened is not a violation (handled when the dispute is lost)", () => {
    expect(codes(healthy({ disputes: [{ status: "dispute_open", createdAt: later(30) }] }))).toEqual([])
  })

  it("a won dispute does not count", () => {
    const s = healthy({
      disputes: [{ status: "dispute_won", createdAt: t0 }],
      ledger: healthy().ledger.map((r) => ({ ...r, createdAt: later(30) })),
    })
    expect(codes(s)).toEqual([])
  })

  it("SUCCESS attempt with no ledger row (money left, nothing recorded)", () => {
    expect(codes(healthy({ ledger: [healthy().ledger[1]!] }))).toEqual(["success_without_ledger:SUPPLIER"])
  })

  it("a Connect ledger transfer with no SUCCESS attempt", () => {
    const s = healthy({
      attempts: [{ ...healthy().attempts[0]!, status: "PENDING", stripeTransferId: null }, healthy().attempts[1]!],
    })
    expect(codes(s)).toEqual(["ledger_transfer_without_success:SUPPLIER"])
  })

  it("refunded more than charged", () => {
    const v = evaluateOrderMoneyInvariants(
      healthy({ refunds: [{ amountCents: 6_000 }, { amountCents: 6_000 }], status: "refunded" }),
    )
    expect(v[0]).toMatchObject({
      code: "refunds_exceed_charge",
      severity: "critical",
      expectedCents: 10_000,
      actualCents: 12_000,
    })
  })

  it("money moved on a cancelled order with no refund recorded", () => {
    expect(codes(healthy({ status: "cancelled" }))).toEqual([
      "paid_on_closed_order:SUPPLIER",
      "paid_on_closed_order:AFFILIATE",
    ])
  })

  it("a PENDING attempt left on a closed order", () => {
    const s = healthy({
      status: "refunded",
      paymentSettlementStatus: "REFUNDED",
      refunds: [{ amountCents: 10_000 }],
      attempts: [{ role: "SUPPLIER", amountCents: 7_000, status: "PENDING", stripeTransferId: null }],
      ledger: [],
    })
    expect(codes(s)).toEqual(["pending_attempt_on_closed_order:SUPPLIER"])
  })
})

describe("summary and exit code", () => {
  it("counts by severity and code; critical/high → 2, medium/low only → 1, none → 0", () => {
    const crit = evaluateOrderMoneyInvariants(healthy({ refunds: [{ amountCents: 3_000 }] }))
    const low = evaluateOrderMoneyInvariants(
      healthy({
        status: "refunded",
        paymentSettlementStatus: "REFUNDED",
        refunds: [{ amountCents: 10_000 }],
        attempts: [{ role: "SUPPLIER", amountCents: 7_000, status: "PENDING", stripeTransferId: null }],
        ledger: [],
      }),
    )
    const s = summarizeMoneyInvariants(3, [...crit, ...low])
    expect(s).toMatchObject({
      ordersChecked: 3,
      violations: 3,
      bySeverity: { critical: 2, high: 0, medium: 0, low: 1 },
    })
    expect(moneyInvariantsExitCode(s)).toBe(2)
    expect(moneyInvariantsExitCode(summarizeMoneyInvariants(1, low))).toBe(1)
    expect(moneyInvariantsExitCode(summarizeMoneyInvariants(1, []))).toBe(0)
  })
})
