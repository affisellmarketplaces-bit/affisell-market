import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { compareModelsOnOrders, pickRepresentativeOrders } from "@/lib/contract-models/comparison"
import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import type { SweepLine } from "@/lib/contract-models/sensitivity"
import type { StoredDeclaration } from "@/lib/supplier-costs/declaration"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
import { entryFromOrderSnapshot, type ObservedCostEntry } from "@/lib/supplier-costs/observed-cost-register"
import {
  checkQualificationRequest,
  currentQualification,
  mayBackCommercialTerms,
  parseQualificationEvent,
  qualificationWarning,
  type QualificationEvent,
} from "@/lib/supplier-costs/qualification"

const root = path.resolve(__dirname, "../..")
const ev = (n: number, state: QualificationEvent["state"], at: string, role: "admin" | "supplier" = state === "document_provided" ? "supplier" : "admin"): QualificationEvent => ({
  declarationN: n,
  state,
  by: "x",
  role,
  note: "ok",
  at,
})

describe("qualification — set by a person, per declaration version", () => {
  it("a declaration without any event is unverified; events of another version never count", () => {
    expect(currentQualification([], 2)).toBe("unverified")
    expect(currentQualification([ev(1, "verified", "2026-11-01T00:00:00Z")], 2)).toBe("unverified")
    expect(currentQualification([ev(2, "document_provided", "2026-11-01T00:00:00Z"), ev(2, "verified", "2026-11-02T00:00:00Z")], 2)).toBe("verified")
  })
  it("a supplier can only announce a document; admins verify, dispute or expire — always with a reason", () => {
    expect(checkQualificationRequest("supplier", { state: "document_provided", note: "facture 12" }).ok).toBe(true)
    expect(checkQualificationRequest("supplier", { state: "verified", note: "trust me" })).toEqual({ ok: false, error: "not_allowed_for_actor" })
    expect(checkQualificationRequest("admin", { state: "document_provided", note: "x x x" })).toEqual({ ok: false, error: "not_allowed_for_actor" })
    expect(checkQualificationRequest("admin", { state: "disputed", note: "" })).toEqual({ ok: false, error: "note_required" })
    expect(checkQualificationRequest("admin", { state: "unverified", note: "reset" })).toEqual({ ok: false, error: "state_invalid" })
  })
  it("a stored event whose role does not match its state is not an event (no forged 'verified')", () => {
    expect(parseQualificationEvent({ ...ev(1, "verified", "2026-11-01T00:00:00Z"), role: "supplier" })).toBeNull()
    expect(parseQualificationEvent(ev(1, "verified", "2026-11-01T00:00:00Z"))?.state).toBe("verified")
  })
  it("only a verified declaration may ever back commercial terms", () => {
    expect(["unverified", "document_provided", "disputed", "expired"].map((q) => mayBackCommercialTerms(q as never))).toEqual([false, false, false, false])
    expect(mayBackCommercialTerms("verified")).toBe(true)
  })
  it("nothing in the code sets a qualification automatically", () => {
    const server = readFileSync(path.join(root, "lib/supplier-costs/declaration.server.ts"), "utf8")
    expect(server.match(/recordCostQualification\(/g)?.length).toBe(1) // its definition only
    for (const f of ["app/api/supplier/products/[id]/supply-cost/qualification/route.ts", "app/api/admin/products/[id]/supply-cost/route.ts"]) {
      expect(readFileSync(path.join(root, f), "utf8")).toContain("assertSameSiteRequestOrigin(req)")
    }
  })
})

describe("simulations carry the qualification as a warning", () => {
  const line = (q: SweepLine["costQualification"]): SweepLine => ({
    orderId: "o",
    priceHtCents: 10_000,
    wholesaleCents: 8_000,
    commissionBps: 1_000,
    sourceCostCents: 5_000,
    gridSupplierFeeBps: 1_000,
    estimatedStripeFeeCents: 300,
    feeRateFromOrder: true,
    sourceCostKind: "declared_by_supplier",
    costQualification: q,
  })
  it("unverified: warned and marked unfit for commitments; disputed: also a risk", () => {
    const [u] = compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders([line("unverified")]))
    const c1 = u.models["delegated-purchase"]
    expect(c1.computable && c1.hypotheses).toEqual(expect.arrayContaining([qualificationWarning("unverified"), "ne peut fonder aucun taux, engagement ou automatisme commercial"]))
    expect(u.recorded.sourceCostQualification).toBe("unverified")
    const [d] = compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders([line("disputed")]))
    const c1d = d.models["delegated-purchase"]
    expect(c1d.computable && c1d.risks).toContain("coût déclaré contesté ou expiré : résultat non fiable")
    const [v] = compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders([line("verified")]))
    const c1v = v.models["delegated-purchase"]
    expect(c1v.computable && c1v.hypotheses.includes("ne peut fonder aucun taux, engagement ou automatisme commercial")).toBe(false)
  })
})

describe("declared vs observed — only the same perimeter is comparable", () => {
  const decl = (at: string, unit: number): StoredDeclaration => ({
    unitCostCents: unit,
    deliveryCostCents: 300,
    source: "wholesaler",
    leadTimeDays: null,
    minimumOrderQty: null,
    note: "",
    declaredAt: at,
    declaredBy: "s",
  })
  const entry = (id: string, at: string, amount: number, o: Partial<Omit<ObservedCostEntry, "perimeter">> & { perimeter?: Partial<ObservedCostEntry["perimeter"]> } = {}): ObservedCostEntry => ({
    kind: "charged_amount",
    orderId: id,
    productId: "p",
    quantity: 1,
    amountCents: amount,
    source: "supplier_invoice",
    reliability: "constate",
    observedAt: new Date(at).toISOString(),
    note: "",
    ...o,
    perimeter: { currency: "EUR", basis: "line", includesDelivery: false, vat: "excluded", variantKey: null, ...(o.perimeter ?? {}) },
  })

  it("a stored source price from an order snapshot is NOT comparable today: VAT treatment unknown", () => {
    const snap = entryFromOrderSnapshot({ orderId: "o", productId: "p", paidAt: new Date("2026-10-15"), quantity: 2, aeWholesaleCents: 2_200, currency: "EUR", variantLabel: null })!
    expect(snap.perimeter).toEqual({ currency: "EUR", basis: "line", includesDelivery: false, vat: "unknown", variantKey: null })
    const r = compareDeclaredWithObserved([decl("2026-10-01T00:00:00Z", 1_000)], [snap])
    expect(r.pairs[0]).toMatchObject({ observedUnitCents: 1_100, comparable: false, gapCents: null })
    expect(r.pairs[0].reasons).toContain("traitement de la TVA inconnu")
    expect(r.medianGapCents).toBeNull()
  })

  it("variants, currency, VAT and delivery differences each block the comparison and are named", () => {
    const d = [decl("2026-10-01T00:00:00Z", 1_000)]
    const reasonsOf = (e: ObservedCostEntry) => compareDeclaredWithObserved(d, [e]).pairs[0].reasons
    expect(reasonsOf(entry("a", "2026-10-02", 900, { perimeter: { variantKey: "Rouge · M" } }))).toEqual(["déclaration globale du produit, observation d'une variante précise"])
    expect(reasonsOf(entry("b", "2026-10-02", 900, { perimeter: { currency: "USD" } }))).toEqual(["devises différentes"])
    expect(reasonsOf(entry("c", "2026-10-02", 900, { perimeter: { vat: "included" } }))).toEqual(["HT d'un côté, TTC de l'autre"])
    expect(reasonsOf(entry("d", "2026-10-02", 900, { perimeter: { includesDelivery: true } }))).toEqual(["livraison incluse d'un côté seulement"])
  })

  it("same perimeter: the declaration in force at payment, line total divided by quantity, median from 3 pairs", () => {
    const r = compareDeclaredWithObserved(
      [decl("2026-10-01T00:00:00Z", 1_000), decl("2026-11-01T00:00:00Z", 1_200)],
      [
        entry("before", "2026-09-15", 900),
        entry("a", "2026-10-02", 1_800, { quantity: 2 }),
        entry("b", "2026-10-03", 1_100),
        entry("c", "2026-11-05", 1_500),
      ]
    )
    expect(r.pairs.map((p) => [p.orderId, p.declaredUnitCents, p.observedUnitCents, p.gapCents])).toEqual([
      ["before", null, 900, null],
      ["a", 1_000, 900, -100],
      ["b", 1_000, 1_100, 100],
      ["c", 1_200, 1_500, 300],
    ])
    expect(r.comparable).toBe(3)
    expect(r.medianGapCents).toBe(100)
    expect(r.blockingReasons).toEqual([{ reason: "aucune déclaration en vigueur à cette date", pairs: 1 }])
  })

  it("an old declaration is flagged, not hidden", () => {
    const r = compareDeclaredWithObserved([decl("2026-01-01T00:00:00Z", 1_000)], [entry("a", "2026-10-02", 1_000)])
    expect(r.pairs[0].staleDeclaration).toBe(true)
    expect(r.pairs[0].comparable).toBe(true)
  })
})
