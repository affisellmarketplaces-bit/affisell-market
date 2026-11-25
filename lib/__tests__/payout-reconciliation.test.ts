import { describe, expect, it } from "vitest"

import type { StripeTransferView } from "@/lib/payouts/leg-model"
import { maskId, reconcilePayouts, summarize, type ReconciliationInput } from "@/lib/payouts/reconciliation"

const since = new Date("2026-11-01T00:00:00Z")
function tr(id: string, p: Partial<StripeTransferView> = {}): StripeTransferView {
  return { id, amount: 1500, currency: "eur", destination: "acct_S", transfer_group: "o1", metadata: { affisell_leg_key: "order:o1:SUPPLIER" }, created: 1, ...p }
}
function base(): ReconciliationInput {
  return {
    stripe: { transfers: [tr("tr_1")], complete: true, since },
    legs: [{ legKey: "order:o1:SUPPLIER", kind: "order", role: "SUPPLIER", orderId: "o1", state: "PAID", stripeTransferId: "tr_1", amountCents: 1500, destination: "acct_S", inDoubtReason: null }],
    attempts: [{ orderId: "o1", role: "SUPPLIER", status: "SUCCESS", stripeTransferId: "tr_1", amountCents: 1500, destination: "acct_S" }],
    ledger: [{ orderId: "o1", beneficiaryRole: "SUPPLIER", entryType: "PAYOUT", stripeTransferId: "tr_1", amountCents: 1500, payoutRail: "connect" }],
    orderRefs: [{ orderId: "o1", stripeTransferId: "tr_1", payoutTransferIds: [] }],
  }
}

describe("reconcilePayouts — read-only comparison", () => {
  it("a consistent payout produces no finding", () => {
    expect(reconcilePayouts(base())).toEqual([])
  })

  it("13. detects an orphan transfer (in Stripe, recorded nowhere)", () => {
    const input = base()
    input.stripe!.transfers.push(tr("tr_orphan", { metadata: { orderId: "o1", role: "supplier", lightning: "true" } }))
    const f = reconcilePayouts(input)
    expect(f.map((x) => x.kind).sort()).toEqual(["duplicate_transfers_for_leg", "orphan_transfer"])
    expect(f.find((x) => x.kind === "orphan_transfer")).toMatchObject({ severity: "critical", legKey: "order:o1:SUPPLIER", transferIds: ["tr_orphan"] })
  })

  it("detects a transfer of a leg not held as PAID (to adopt) and an in-doubt leg", () => {
    const input = base()
    input.legs[0] = { ...input.legs[0], state: "IN_DOUBT", stripeTransferId: null, inDoubtReason: "create_outcome_unknown" }
    const kinds = reconcilePayouts(input).map((x) => x.kind)
    expect(kinds).toContain("leg_in_doubt")
    expect(kinds).toContain("transfer_of_unpaid_leg")
  })

  it("detects records without a Stripe transfer, amount / destination / role mismatches", () => {
    const input = base()
    input.stripe!.transfers = [tr("tr_1", { amount: 1400, destination: "acct_X" })]
    input.ledger.push({ orderId: "o1", beneficiaryRole: "AFFILIATE", entryType: "PAYOUT", stripeTransferId: "tr_1", amountCents: 1500, payoutRail: "connect" })
    input.ledger.push({ orderId: "o2", beneficiaryRole: "SUPPLIER", entryType: "PAYOUT", stripeTransferId: null, amountCents: 900, payoutRail: "connect" })
    input.attempts.push({ orderId: "o3", role: "SUPPLIER", status: "SUCCESS", stripeTransferId: "tr_gone", amountCents: 100, destination: "acct_S" })
    const s = summarize(reconcilePayouts(input))
    expect(s.amount_mismatch).toBeGreaterThan(0)
    expect(s.destination_mismatch).toBeGreaterThan(0)
    expect(s.role_mismatch).toBe(1)
    expect(s.ledger_payout_without_transfer).toBe(1)
    expect(s.recorded_transfer_not_in_stripe).toBe(1)
  })

  it("plan mode (Stripe not read) still reports Affisell-side anomalies, and never claims absence", () => {
    const input = base()
    input.stripe = null
    input.orderRefs.push({ orderId: "o9", stripeTransferId: "tr_legacy", payoutTransferIds: ["tr_l2"] })
    const f = reconcilePayouts(input)
    expect(f.map((x) => x.kind)).toEqual(["order_reference_unrecorded", "order_reference_unrecorded"])
    expect(f.some((x) => x.kind === "recorded_transfer_not_in_stripe")).toBe(false)
  })

  it("an incomplete Stripe inventory never reports a recorded transfer as missing", () => {
    const input = base()
    input.stripe = { transfers: [], complete: false, since }
    expect(reconcilePayouts(input).some((x) => x.kind === "recorded_transfer_not_in_stripe")).toBe(false)
  })

  it("masks identifiers for printing", () => {
    expect(maskId("tr_1AbCdEfGh")).toBe("tr_1AbC…")
  })
})
