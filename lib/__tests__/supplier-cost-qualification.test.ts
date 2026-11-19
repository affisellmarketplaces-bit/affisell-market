import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { compareModelsOnOrders, pickRepresentativeOrders } from "@/lib/contract-models/comparison"
import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import type { SweepLine } from "@/lib/contract-models/sensitivity"
import type { StoredDeclaration } from "@/lib/supplier-costs/declaration"
import { compareDeclaredWithObserved } from "@/lib/supplier-costs/declared-vs-observed"
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

describe("declared vs observed — compared, never merged", () => {
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
  const obs = (id: string, at: string, total: number, qty = 1) => ({ orderId: id, paidAt: new Date(at), quantity: qty, observedTotalCents: total, kind: "order_snapshot" as const })

  it("each observation meets the declaration in force at its payment; unit cost against unit cost", () => {
    const r = compareDeclaredWithObserved(
      [decl("2026-10-01T00:00:00Z", 1_000), decl("2026-11-01T00:00:00Z", 1_200)],
      [obs("a", "2026-09-15T00:00:00Z", 900), obs("b", "2026-10-15T00:00:00Z", 2_200, 2), obs("c", "2026-11-05T00:00:00Z", 1_300), obs("d", "2026-11-06T00:00:00Z", 0)]
    )
    expect(r.pairs.map((p) => [p.orderId, p.declaredUnitCents, p.observedUnitCents, p.gapCents])).toEqual([
      ["a", null, 900, null],
      ["b", 1_000, 1_100, 100],
      ["c", 1_200, 1_300, 100],
    ])
    expect(r.withoutDeclaration).toBe(1)
    expect(r.medianGapCents).toBeNull() // fewer than 3 comparable
    expect(r.caveat).toMatch(/jamais fusionnés/)
  })
  it("median shown from three comparable observations", () => {
    const r = compareDeclaredWithObserved([decl("2026-10-01T00:00:00Z", 1_000)], [
      obs("a", "2026-10-02T00:00:00Z", 900),
      obs("b", "2026-10-03T00:00:00Z", 1_100),
      obs("c", "2026-10-04T00:00:00Z", 1_500),
    ])
    expect(r.medianGapCents).toBe(100)
  })
})
