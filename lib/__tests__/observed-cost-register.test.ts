import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  entryFromOrderSnapshot,
  perimeterMismatches,
  summarizeOrderCosts,
  validateObservedCostEntry,
  type ObservedCostEntry,
} from "@/lib/supplier-costs/observed-cost-register"

const base = (o: Partial<ObservedCostEntry>): ObservedCostEntry => ({
  kind: "charged_amount",
  orderId: "o1",
  productId: "p",
  quantity: 1,
  amountCents: 1_000,
  perimeter: { currency: "EUR", basis: "line", includesDelivery: false, vat: "excluded", variantKey: null },
  source: "issuing_capture",
  reliability: "constate",
  observedAt: "2026-11-01T00:00:00Z",
  note: "",
  ...o,
})

describe("observed-cost register — kinds never mixed", () => {
  it("an order snapshot is a STORED price, estimated, delivery excluded, VAT unknown — never a debit", () => {
    const e = entryFromOrderSnapshot({ orderId: "o1", productId: "p", paidAt: new Date("2026-11-01"), quantity: 3, aeWholesaleCents: 3_000, currency: null, variantLabel: " Bleu · L " })!
    expect(e).toMatchObject({ kind: "stored_source_price", source: "order_snapshot", reliability: "estime", amountCents: 3_000 })
    expect(e.perimeter).toEqual({ currency: "EUR", basis: "line", includesDelivery: false, vat: "unknown", variantKey: "Bleu · L" })
    expect(entryFromOrderSnapshot({ orderId: "o", productId: "p", paidAt: new Date(), quantity: 1, aeWholesaleCents: 0, currency: "EUR", variantLabel: null })).toBeNull()
  })

  it("validation refuses a snapshot presented as a debit, an estimated debit, an evidence with an amount", () => {
    expect(validateObservedCostEntry(base({ source: "order_snapshot" }))).toContain("snapshot_is_not_a_debit")
    expect(validateObservedCostEntry(base({ reliability: "estime" }))).toContain("a_debit_is_read_not_estimated")
    expect(validateObservedCostEntry(base({ kind: "evidence", amountCents: 5, note: "facture" }))).toContain("evidence_has_no_amount")
    expect(validateObservedCostEntry(base({ kind: "evidence", amountCents: null, note: "" }))).toContain("evidence_needs_description")
    expect(validateObservedCostEntry(base({}))).toEqual([])
  })

  it("per order: stored and charged side by side; a gap only for the same perimeter; fees never summed across currencies", () => {
    const stored = base({ kind: "stored_source_price", source: "order_snapshot", reliability: "estime", amountCents: 1_000 })
    const charged = base({ amountCents: 1_150 })
    const [same] = summarizeOrderCosts([stored, charged])
    expect(same.storedVsChargedGapCents).toBe(150)
    const [diff] = summarizeOrderCosts([stored, base({ amountCents: 1_150, perimeter: { ...charged.perimeter, vat: "included" } })])
    expect(diff.storedVsChargedGapCents).toBeNull()
    expect(diff.gapUnavailableReason).toMatch(/périmètres différents/)
    const [fees] = summarizeOrderCosts([
      stored,
      base({ kind: "fee", amountCents: 30 }),
      base({ kind: "fee", amountCents: 40, perimeter: { ...charged.perimeter, currency: "USD" } }),
      base({ kind: "evidence", amountCents: null, note: "facture AE 123" }),
    ])
    expect(fees).toMatchObject({ feesCents: 0, unsummable: 2, evidence: ["facture AE 123"], gapUnavailableReason: "montant débité non constaté" })
  })

  it("unknown is never comparable", () => {
    const p = { currency: "EUR", basis: "unit" as const, includesDelivery: false, vat: "excluded" as const, variantKey: null }
    expect(perimeterMismatches(p, p)).toEqual([])
    expect(perimeterMismatches(p, { ...p, includesDelivery: null })).toEqual(["livraison incluse ou non inconnue"])
    expect(perimeterMismatches(p, { ...p, currency: null })).toEqual(["devise inconnue"])
  })

  it("the register module touches no money path and no database", () => {
    const src = readFileSync(path.resolve(__dirname, "../supplier-costs/observed-cost-register.ts"), "utf8")
    expect(src).not.toMatch(/from "@\/lib\/(prisma|stripe)/)
  })
})
