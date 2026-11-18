import { describe, expect, it } from "vitest"
import {
  canDecideRestock,
  canInspectReturn,
  dispositionStage,
  isReturnInspectionOutcome,
  planReturnRestock,
  resolveReturnRestockMode,
} from "@/lib/return-disposition"

const reservation = { productId: "p1", qty: 2, scope: "product" as const, variantRowName: null, stripeSessionId: "cs_1" }

describe("returned goods: received → inspected → resellable → restocked", () => {
  it("only goods the supplier has can be inspected", () => {
    expect(canInspectReturn("RECEIVED", new Date())).toBe(true)
    expect(canInspectReturn("REFUNDED", "2026-11-18")).toBe(true)
    expect(canInspectReturn("IN_TRANSIT", null)).toBe(false)
    expect(canInspectReturn("RECEIVED", null)).toBe(false)
    expect(isReturnInspectionOutcome("resellable")).toBe(true)
    expect(isReturnInspectionOutcome("as new")).toBe(false)
  })

  it("restocking is OFF by default; observe computes, enforce writes", () => {
    expect(resolveReturnRestockMode({})).toBe("off")
    expect(resolveReturnRestockMode({ RETURN_RESTOCK_MODE: "observe" })).toBe("observe")
    const base = { outcome: "resellable" as const, returnedQty: 1, alreadyRestocked: false, reservation }
    expect(planReturnRestock({ ...base, mode: "off" })).toEqual({ action: "none", reason: "mode_off" })
    expect(planReturnRestock({ ...base, mode: "observe" })).toMatchObject({ action: "would_restock", qty: 1 })
    expect(planReturnRestock({ ...base, mode: "enforce" })).toMatchObject({ action: "restock", qty: 1 })
  })

  it("never restocks goods that are not resellable, twice, or units the sale never took", () => {
    const base = { mode: "enforce" as const, returnedQty: 1, alreadyRestocked: false, reservation }
    expect(planReturnRestock({ ...base, outcome: "damaged" })).toEqual({ action: "none", reason: "not_resellable" })
    expect(planReturnRestock({ ...base, outcome: "resellable", alreadyRestocked: true })).toEqual({
      action: "none",
      reason: "already_restocked",
    })
    expect(planReturnRestock({ ...base, outcome: "resellable", reservation: null })).toEqual({
      action: "none",
      reason: "never_decremented",
    })
  })

  it("never gives back more than the sale took", () => {
    expect(
      planReturnRestock({ mode: "enforce", outcome: "resellable", returnedQty: 5, alreadyRestocked: false, reservation })
    ).toMatchObject({ qty: 2 })
  })
})

describe("dispositionStage / canDecideRestock — inspection then validation, never merged", () => {
  const at = (m: number) => new Date(Date.UTC(2026, 10, 18, 10, m)).toISOString()
  it("walks received → inspected → decided → restocked", () => {
    expect(dispositionStage([])).toBe("awaiting_reception")
    const received = { kind: "received" as const, at: at(0) }
    expect(dispositionStage([received])).toBe("awaiting_inspection")
    const ok = { kind: "inspected" as const, at: at(1), outcome: "resellable" as const, note: "" }
    expect(dispositionStage([received, ok])).toBe("awaiting_decision")
    const validated = { kind: "decided" as const, at: at(2), decision: "restock" as const, note: "", restock: "none:mode_off" }
    expect(dispositionStage([received, ok, validated])).toBe("restock_validated_not_applied")
    expect(dispositionStage([received, ok, validated, { kind: "restocked", at: at(3), qty: 1 }])).toBe("restocked")
  })
  it("a newer inspection reopens the decision; a damaged item is never awaiting a restock", () => {
    const evts = [
      { kind: "received" as const, at: at(0) },
      { kind: "inspected" as const, at: at(1), outcome: "resellable" as const, note: "" },
      { kind: "decided" as const, at: at(2), decision: "restock" as const, note: "", restock: "none:mode_off" },
      { kind: "inspected" as const, at: at(3), outcome: "damaged" as const, note: "rayure" },
    ]
    expect(dispositionStage(evts)).toBe("inspected_not_resellable")
    expect(canDecideRestock("damaged", "restock")).toBe(false)
    expect(canDecideRestock("damaged", "keep_out")).toBe(true)
    expect(canDecideRestock(null, "keep_out")).toBe(false)
    expect(canDecideRestock("resellable", "restock")).toBe(true)
  })
})
