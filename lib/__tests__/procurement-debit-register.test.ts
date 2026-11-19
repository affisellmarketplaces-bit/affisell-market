import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  checkAllocation,
  entriesFromReconciliation,
  looksLikeCardNumber,
  movementBalances,
  movementState,
  parseAllocationInput,
  parseDebitInput,
  reconcileOrderCost,
  type AllocationRow,
  type MovementRow,
} from "@/lib/procurement-debits/register"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
import { validateObservedCostEntry } from "@/lib/supplier-costs/observed-cost-register"

const now = new Date("2026-11-19T10:00:00.000Z")
const ev = [{ type: "statement_line", reference: "relevé novembre", description: "ligne 12" }]
const base = { kind: "debit", source: "card_statement", sourceReference: "L-1", amountCents: 1300, currency: "USD", settledAmountCents: 1200, occurredAt: "2026-11-10T00:00:00.000Z", evidence: ev }

const D: MovementRow = {
  id: "d1",
  kind: "debit",
  source: "card_statement",
  sourceReference: "L-1",
  status: "recorded",
  amountCents: 1300,
  currency: "USD",
  settledAmountCents: 1200,
  parentDebitId: null,
  includesDelivery: true,
  vatTreatment: "included",
  occurredAt: "2026-11-10T00:00:00.000Z",
}
const R: MovementRow = { ...D, id: "r1", kind: "refund", sourceReference: "ipr_1", amountCents: 200, settledAmountCents: 180, parentDebitId: "d1" }
const F: MovementRow = { ...D, id: "f1", kind: "fee", currency: "EUR", sourceReference: "fx_1", amountCents: 30, settledAmountCents: 30, parentDebitId: "d1" }
const al = (id: string, debitId: string, orderId: string, amountCents: number, status: AllocationRow["status"] = "active"): AllocationRow => ({ id, debitId, orderId, amountCents, status })

describe("recording a movement", () => {
  it("keeps original amount, currency and settled euros; nothing is guessed", () => {
    const r = parseDebitInput({ ...base, includesDelivery: true, vatTreatment: "included" }, now)
    expect(r).toMatchObject({ ok: true, value: { amountCents: 1300, currency: "USD", settledAmountCents: 1200 } })
    expect(parseDebitInput({ ...base, settledAmountCents: null }, now)).toMatchObject({ ok: true, value: { settledAmountCents: null } })
  })
  it("in euros the settled amount IS the amount", () => {
    expect(parseDebitInput({ ...base, currency: "EUR", settledAmountCents: null }, now)).toMatchObject({ ok: true, value: { settledAmountCents: 1300 } })
    expect(parseDebitInput({ ...base, currency: "EUR", settledAmountCents: 1100 }, now)).toEqual({ ok: false, errors: ["eur_settled_mismatch"] })
  })
  it("refuses a card number anywhere, a statement without evidence, a refund without its debit, a future date", () => {
    expect(looksLikeCardNumber("4242 4242 4242 4242")).toBe(true)
    expect(looksLikeCardNumber("ipi_1Q2w3E")).toBe(false)
    expect(looksLikeCardNumber("ref 4111111111111111 x")).toBe(true)
    expect(looksLikeCardNumber("1731990000002")).toBe(false) // a 13-digit timestamp-like id that fails Luhn is kept
    expect(parseDebitInput({ ...base, sourceReference: "4242-4242-4242-4242" }, now)).toMatchObject({ ok: false, errors: ["reference_looks_like_card_number"] })
    expect(parseDebitInput({ ...base, source: "bank_statement", evidence: [] }, now)).toMatchObject({ ok: false, errors: ["evidence_required"] })
    expect(parseDebitInput({ ...base, source: "stripe_issuing" }, now)).toMatchObject({ ok: false, errors: ["issuing_is_imported_not_typed"] })
    expect(parseDebitInput({ ...base, source: "bank_statement", evidence: [{ type: "statement_line", description: "relevé 4242424242424242" }] }, now)).toMatchObject({
      ok: false,
      errors: ["evidence_looks_like_card_number"],
    })
    expect(parseDebitInput({ ...base, kind: "refund" }, now)).toMatchObject({ ok: false, errors: ["refund_needs_its_debit"] })
    expect(parseDebitInput({ ...base, kind: "refund_reversal" }, now)).toMatchObject({ ok: false, errors: ["refund_needs_its_debit"] })
    expect(parseDebitInput({ ...base, parentDebitId: "x" }, now)).toMatchObject({ ok: false, errors: ["debit_has_no_parent"] })
    expect(parseDebitInput({ ...base, occurredAt: "2027-01-01" }, now)).toMatchObject({ ok: false, errors: ["occurred_at_in_future"] })
  })
  it("a manual allocation needs a reason", () => {
    expect(parseAllocationInput({ orderId: "o", amountCents: 10, basis: "manual" })).toEqual({ ok: false, errors: ["manual_needs_reason"] })
    expect(parseAllocationInput({ orderId: "o", amountCents: 10, basis: "grouped_split" })).toMatchObject({ ok: true })
  })
})

describe("allocation — no double counting", () => {
  const req = (orderId: string, amountCents: number) => ({ orderId, amountCents, basis: "grouped_split" as const, note: "" })
  it("never beyond the settled amount, never twice to one order, never on an unknown euro amount", () => {
    const a = [al("a1", "d1", "o1", 700)]
    expect(checkAllocation({ movement: D, parent: null, allocations: a, siblings: [], request: req("o2", 500) })).toEqual({ ok: true, remainingAfterCents: 0 })
    expect(checkAllocation({ movement: D, parent: null, allocations: a, siblings: [], request: req("o2", 501) })).toEqual({ ok: false, error: "over_allocated", remainingCents: 500 })
    expect(checkAllocation({ movement: D, parent: null, allocations: a, siblings: [], request: req("o1", 1) })).toEqual({ ok: false, error: "already_allocated_to_order" })
    // A revoked allocation frees its amount and its order.
    expect(checkAllocation({ movement: D, parent: null, allocations: [al("a1", "d1", "o1", 700, "revoked")], siblings: [], request: req("o1", 1200) }).ok).toBe(true)
    expect(checkAllocation({ movement: { ...D, settledAmountCents: null }, parent: null, allocations: [], siblings: [], request: req("o1", 1) })).toEqual({ ok: false, error: "settled_amount_unknown" })
    expect(checkAllocation({ movement: { ...D, status: "voided" }, parent: null, allocations: [], siblings: [], request: req("o1", 1) })).toEqual({ ok: false, error: "movement_voided" })
  })
  it("a refund goes only to orders its debit covered, never beyond their share (all refunds of that debit counted)", () => {
    const R2: MovementRow = { ...R, id: "r2", sourceReference: "ipr_2", settledAmountCents: 500 }
    const a = [al("a1", "d1", "o1", 300), al("a2", "d1", "o2", 900), al("b1", "r1", "o1", 180)]
    expect(checkAllocation({ movement: R2, parent: D, allocations: a, siblings: [R, R2], request: req("o3", 10) })).toEqual({ ok: false, error: "parent_not_allocated_to_order" })
    expect(checkAllocation({ movement: R2, parent: D, allocations: a, siblings: [R, R2], request: req("o1", 121) })).toEqual({ ok: false, error: "refund_exceeds_order_share", remainingCents: 120 })
    expect(checkAllocation({ movement: R2, parent: D, allocations: a, siblings: [R, R2], request: req("o1", 120) }).ok).toBe(true)
  })
  it("balances flag an over-allocation that could only come from a bypassing write", () => {
    expect(movementBalances([D], [al("a1", "d1", "o1", 1000), al("a2", "d1", "o2", 300)])[0]).toMatchObject({ allocatedCents: 1300, remainingCents: -100, overAllocated: true })
  })
})

describe("lifecycle — review, Issuing card link, refund reversals", () => {
  const req = (orderId: string, amountCents: number) => ({ orderId, amountCents, basis: "single_order" as const, note: "" })
  const I: MovementRow = { ...D, source: "stripe_issuing", sourceReference: "ipi_c1", issuingCardId: "ic_k1", reviewState: "none" }
  it("an Issuing movement goes only to an order Affisell's own record ties to its card", () => {
    expect(checkAllocation({ movement: I, parent: null, allocations: [], siblings: [], request: req("o9", 100), cardOrderIds: ["o1"] })).toEqual({ ok: false, error: "order_not_linked_to_card" })
    expect(checkAllocation({ movement: I, parent: null, allocations: [], siblings: [], request: req("o1", 100) })).toEqual({ ok: false, error: "order_not_linked_to_card" })
    expect(checkAllocation({ movement: I, parent: null, allocations: [], siblings: [], request: req("o1", 100), cardOrderIds: ["o1"] }).ok).toBe(true)
  })
  it("a movement kept apart for review, or a refund without its debit, is never allocatable", () => {
    expect(checkAllocation({ movement: { ...D, reviewState: "needs_review" }, parent: null, allocations: [], siblings: [], request: req("o1", 1) })).toEqual({ ok: false, error: "movement_needs_review" })
    expect(checkAllocation({ movement: { ...R, parentDebitId: null }, parent: null, allocations: [], siblings: [], request: req("o1", 1) })).toEqual({ ok: false, error: "refund_without_its_debit" })
  })
  it("a reversal only takes back a refund the order received, and counts as money out again", () => {
    const V: MovementRow = { ...R, id: "v1", kind: "refund_reversal", sourceReference: "ipv_1", settledAmountCents: 100 }
    const a = [al("a1", "d1", "o1", 1200), al("b1", "r1", "o1", 180)]
    expect(checkAllocation({ movement: V, parent: D, allocations: a, siblings: [R, V], request: req("o1", 181) })).toEqual({ ok: false, error: "reversal_exceeds_order_refunds", remainingCents: 180 })
    expect(checkAllocation({ movement: V, parent: D, allocations: a, siblings: [R, V], request: req("o1", 100) }).ok).toBe(true)
    const rec = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: null, movements: [D, R, V], allocations: [...a, al("c1", "v1", "o1", 100)] })
    expect(rec).toMatchObject({ status: "reconciled", debitedCents: 1300, refundedCents: 180, realDebitedCents: 1120 })
    // After a reversal the room for refunds grows back accordingly.
    const R2: MovementRow = { ...R, id: "r2", sourceReference: "ipr_2", settledAmountCents: 1200 }
    expect(checkAllocation({ movement: R2, parent: D, allocations: [...a, al("c1", "v1", "o1", 100)], siblings: [R, V, R2], request: req("o1", 1121) })).toMatchObject({ ok: false, error: "refund_exceeds_order_share", remainingCents: 1120 })
  })
  it("a movement waiting for review on the same card keeps the order's cost provisional", () => {
    const pending: MovementRow = { ...I, id: "rp", kind: "refund", sourceReference: "ipi_r9", parentDebitId: null, reviewState: "needs_review", settledAmountCents: 300 }
    const rec = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: null, movements: [I, pending], allocations: [al("a1", "d1", "o1", 1200)] })
    expect(rec.status).toBe("incomplete")
    expect(rec.reasons[0]).toMatch(/ipi_r9 à examiner/)
  })
  it("states are distinct: voided, needs review, unallocated, partial, full, not allocatable", () => {
    expect(movementState({ ...D, status: "voided" }, [])).toBe("voided")
    expect(movementState({ ...D, reviewState: "needs_review" }, [])).toBe("needs_review")
    expect(movementState({ ...D, settledAmountCents: null }, [])).toBe("not_allocatable")
    expect(movementState(D, [])).toBe("unallocated")
    expect(movementState(D, [al("a", "d1", "o1", 100)])).toBe("partially_allocated")
    expect(movementState(D, [al("a", "d1", "o1", 1200)])).toBe("fully_allocated")
  })
})

describe("an order's cost — real only when fully reconciled", () => {
  it("not reconciled: no real cost, the stored price stays a stored price", () => {
    const r = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: 650, movements: [D], allocations: [] })
    expect(r).toMatchObject({ status: "not_reconciled", realDebitedCents: null, realFullCostCents: null, storedSourcePriceCents: 650 })
  })
  it("a grouped debit not fully shared out, or a refund / fee not shared out, keeps the cost provisional", () => {
    const partial = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: 650, movements: [D, R, F], allocations: [al("a1", "d1", "o1", 700)] })
    expect(partial.status).toBe("incomplete")
    expect(partial.realFullCostCents).toBeNull()
    expect(partial.debitedCents).toBe(700)
    expect(partial.reasons).toHaveLength(3)
  })
  it("complete: debited (net of refunds), fees apart, full cost, gap to the stored price, FX in settled euros", () => {
    const a = [al("a1", "d1", "o1", 700), al("a2", "d1", "o2", 500), al("a3", "r1", "o1", 180), al("a4", "f1", "o1", 30)]
    const r = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: 650, movements: [D, R, F], allocations: a })
    expect(r).toMatchObject({
      status: "reconciled",
      debitedCents: 700,
      refundedCents: 180,
      feesCents: 30,
      realDebitedCents: 520,
      realFullCostCents: 550,
      storedVsFullCostGapCents: -100,
      originalCurrencies: ["EUR", "USD"],
      includesDelivery: true,
      vat: "included",
    })
    expect(r.fxRates.find((x) => x.movementId === "d1")?.ratePerUnit).toBeCloseTo(1200 / 1300, 5)
    expect(reconcileOrderCost({ orderId: "o2", storedSourcePriceCents: 400, movements: [D, R, F], allocations: a }).status).toBe("reconciled")
  })
  it("a voided movement counts for nothing", () => {
    const r = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: null, movements: [{ ...D, status: "voided" }], allocations: [al("a1", "d1", "o1", 1200)] })
    expect(r.status).toBe("not_reconciled")
  })
})

describe("into the observed-cost register", () => {
  const a = [al("a1", "d1", "o1", 1200)]
  it("only a reconciled order produces a charged amount, read (constate), never an estimate", () => {
    const rec = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: 650, movements: [D], allocations: a })
    const entries = entriesFromReconciliation(rec, { productId: "p", quantity: 2, observedAt: "2026-11-10T00:00:00.000Z", variantKey: "noir|m" })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ kind: "charged_amount", amountCents: 1200, reliability: "constate", source: "procurement_debit_register" })
    expect(validateObservedCostEntry(entries[0]!)).toEqual([])
    const incomplete = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: 650, movements: [D], allocations: [al("a1", "d1", "o1", 600)] })
    expect(entriesFromReconciliation(incomplete, { productId: "p", quantity: 2, observedAt: "x", variantKey: null })).toEqual([])
  })
  it("a debit that includes delivery is never 'comparable' to a declared unit cost without delivery", () => {
    const rec = reconcileOrderCost({ orderId: "o1", storedSourcePriceCents: 650, movements: [D], allocations: a })
    const entries = entriesFromReconciliation(rec, { productId: "p", quantity: 2, observedAt: "2026-11-10T00:00:00.000Z", variantKey: null })
    const cmp = compareDeclaredWithObserved(
      [{ unitCostCents: 600, deliveryCostCents: 0, source: "own_stock", leadTimeDays: null, minimumOrderQty: null, note: "", declaredAt: "2026-10-01T00:00:00.000Z", declaredBy: "s" }],
      entries
    )
    expect(cmp.pairs[0]).toMatchObject({ comparable: false })
    expect(cmp.pairs[0]!.reasons).toContain("livraison incluse d'un côté seulement")
  })
})

describe("isolation", () => {
  it("the register touches no payment, refund or transfer path", () => {
    for (const f of ["register.ts", "register.server.ts"]) {
      const src = readFileSync(path.resolve(__dirname, `../procurement-debits/${f}`), "utf8")
      expect(src).not.toMatch(/from "@\/lib\/(stripe|transfers|marketplace-checkout|fulfillment)/)
      expect(src).not.toMatch(/refunds\.create|transfers\.create|order\.update/)
    }
  })
  it("the migration guards against double counting in the database itself", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../prisma/migrations/20261119090000_procurement_debit_register/migration.sql"), "utf8")
    expect(sql).toMatch(/ProcurementDebit_source_sourceReference_key/)
    expect(sql).toMatch(/ProcurementDebit_issuing_check/)
    expect(sql).toMatch(/"reviewState" <> 'needs_review'/)
    expect(sql).toMatch(/WHERE "status" = 'active'/)
    expect(sql).toMatch(/procurement_debit_over_allocated/)
    expect(sql).toMatch(/FOR UPDATE/)
    expect(sql).not.toMatch(/ALTER TABLE "Order"|DROP TABLE/)
  })
})
