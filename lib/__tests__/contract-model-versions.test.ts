import { describe, expect, it } from "vitest"

import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import {
  assignmentStartsInPast,
  checkVersionUnchanged,
  nextVersion,
  resolveModelForOrder,
  simulateAssignments,
  type GovernedOrder,
  type ModelAssignment,
} from "@/lib/contract-models/versions"

const catalogue = DRAFT_CONTRACT_MODELS.find((m) => m.path === "A_catalogue")!
const d = (s: string) => new Date(`${s}T00:00:00Z`)

const order = (paid: string, supplierId = "s1"): GovernedOrder => ({
  orderId: `o-${paid}-${supplierId}`,
  paidAt: d(paid),
  supplierId,
  priceHtCents: 3000,
  wholesaleCents: 2000,
  commissionBps: 1000,
  sourceCostCents: 0,
  gridSupplierFeeBps: 1000,
  actual: { supplierTransferCents: 1111, resellerTransferCents: 222, affisellFeesCents: 333 },
})

const assign = (o: Partial<ModelAssignment>): ModelAssignment => ({
  modelId: catalogue.id,
  version: catalogue.version,
  supplierId: null,
  effectiveFrom: d("2026-12-01"),
  createdAt: d("2026-11-18"),
  ...o,
})

describe("an order keeps the conditions of its payment", () => {
  it("an order paid before any assignment is legacy and its frozen amounts are reproduced unchanged", () => {
    const sim = simulateAssignments([order("2026-11-10")], [assign({})], [catalogue])
    expect(sim.legacyOrders).toBe(1)
    expect(sim.totals.supplier).toEqual({ actual: 1111, simulated: 1111 })
    expect(sim.totals.affisell).toEqual({ actual: 333, simulated: 333 })
  })

  it("adding or changing a FUTURE assignment never changes the simulation of past orders", () => {
    const past = [order("2026-10-01"), order("2026-11-15", "s2")]
    const before = simulateAssignments(past, [], [catalogue])
    const v2 = nextVersion(catalogue, { parameters: { ...catalogue.parameters } })
    const after = simulateAssignments(
      past,
      [assign({}), assign({ modelId: v2.id, version: v2.version, supplierId: "s2", effectiveFrom: d("2027-01-01") })],
      [catalogue, v2]
    )
    expect(after.totals).toEqual(before.totals)
  })

  it("a back-dated assignment is ignored (never applied to the past)", () => {
    const backDated = assign({ effectiveFrom: d("2026-01-01"), createdAt: d("2026-11-18") })
    expect(assignmentStartsInPast(backDated)).toBe(true)
    expect(resolveModelForOrder({ paidAt: d("2026-06-01"), supplierId: "s1" }, [backDated], [catalogue]).kind).toBe("legacy")
  })

  it("an order after the start date is governed by the model, a supplier-specific assignment wins", () => {
    const v2 = nextVersion(catalogue, {})
    const gov = resolveModelForOrder(
      { paidAt: d("2027-02-01"), supplierId: "s1" },
      [assign({}), assign({ version: v2.version, supplierId: "s1", effectiveFrom: d("2026-12-15") })],
      [catalogue, v2]
    )
    expect(gov.kind === "model" && gov.model.version).toBe(v2.version)
  })
})

describe("a published version never changes", () => {
  it("nextVersion bumps the version, returns to draft and leaves the original untouched", () => {
    const snapshot = JSON.stringify(catalogue)
    const v2 = nextVersion(catalogue, { label: "Catalogue v2" })
    expect(v2.version).toBe(catalogue.version + 1)
    expect(v2.status).toBe("draft")
    expect(JSON.stringify(catalogue)).toBe(snapshot)
  })
  it("same id and version with a different content is refused", () => {
    expect(checkVersionUnchanged(catalogue, { ...catalogue, label: "autre" })).toBe("version_already_used")
    expect(checkVersionUnchanged(catalogue, { ...catalogue, status: "active" })).toBe("ok")
  })
})
