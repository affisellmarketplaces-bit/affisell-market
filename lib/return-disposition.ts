/**
 * What happens to the GOODS of a return, kept separate from the money (refund) and from the return's own status.
 * Four steps, never merged (founder rule 2026-11-18):
 *
 *   1. RECEIVED   — the supplier marked the parcel received (`OrderReturn.status` RECEIVED / REFUNDED, `receivedAt`).
 *   2. INSPECTED  — the supplier records what came back (`ReturnInspectionOutcome`) with a note.
 *   3. RESELLABLE — only the outcome `resellable` can lead back to stock; anything else never touches stock.
 *   4. RESTOCKED  — the units are given back to the product (or to the SAME variant row) ONCE.
 *
 * Step 4 is a commercial rule that is NOT active: `RETURN_RESTOCK_MODE` = `off` (default: nothing is planned beyond the
 * inspection record) | `observe` (computes and logs what WOULD be restocked) | `enforce` (writes — founder decision).
 * Units are given back only if the sale really took them (the `stock.reserved` marker written in CHECKOUT_STOCK_MODE
 * `enforce`): restocking a sale that never decremented the stock would CREATE units that do not exist.
 * Pure: the env is a parameter; the server side is `return-disposition.server.ts`.
 */
import type { StockReservationPayload } from "@/lib/stock-restitution"

export const RETURN_INSPECTION_OUTCOMES = [
  "resellable",
  "damaged",
  "defective",
  "missing_parts",
  "wrong_item_returned",
  "not_received",
] as const
export type ReturnInspectionOutcome = (typeof RETURN_INSPECTION_OUTCOMES)[number]

export function isReturnInspectionOutcome(v: unknown): v is ReturnInspectionOutcome {
  return typeof v === "string" && (RETURN_INSPECTION_OUTCOMES as readonly string[]).includes(v)
}

/** Goods can be inspected once the supplier has them: received, or already refunded after reception. */
export function canInspectReturn(status: string | null | undefined, receivedAt: Date | string | null | undefined): boolean {
  const s = (status ?? "").toUpperCase()
  return Boolean(receivedAt) && (s === "RECEIVED" || s === "REFUNDED")
}

export type ReturnRestockMode = "off" | "observe" | "enforce"

export function resolveReturnRestockMode(env: Record<string, string | undefined> = process.env): ReturnRestockMode {
  const v = env.RETURN_RESTOCK_MODE?.trim().toLowerCase()
  if (v === "observe") return "observe"
  if (v === "enforce") return "enforce"
  return "off"
}

export type ReturnRestockPlan =
  | { action: "none"; reason: "mode_off" | "not_resellable" | "already_restocked" | "never_decremented" | "invalid_quantity" }
  | { action: "would_restock" | "restock"; qty: number; reservation: StockReservationPayload }

/**
 * Whether and how many units go back to stock. `returnedQty` = the units this return covers (≤ the order quantity);
 * `reservation` = the marker the sale wrote when it really decremented the stock (null = it never did).
 */
export function planReturnRestock(args: {
  mode: ReturnRestockMode
  outcome: ReturnInspectionOutcome
  returnedQty: number
  alreadyRestocked: boolean
  reservation: StockReservationPayload | null
}): ReturnRestockPlan {
  if (args.mode === "off") return { action: "none", reason: "mode_off" }
  if (args.outcome !== "resellable") return { action: "none", reason: "not_resellable" }
  if (args.alreadyRestocked) return { action: "none", reason: "already_restocked" }
  if (!args.reservation) return { action: "none", reason: "never_decremented" }
  const qty = Math.min(Math.round(args.returnedQty), Math.round(args.reservation.qty))
  if (!Number.isFinite(qty) || qty < 1) return { action: "none", reason: "invalid_quantity" }
  return { action: args.mode === "enforce" ? "restock" : "would_restock", qty, reservation: args.reservation }
}

export const RETURN_INSPECTION_ACTION = "return.inspected"
export const RETURN_RESTOCKED_ACTION = "return.restocked"
export const returnInspectionAuditId = (returnId: string) => `return-inspection:${returnId}`
export const returnRestockedAuditId = (returnId: string) => `return-restocked:${returnId}`

/**
 * Inspection (what was OBSERVED) and decision (what the supplier VALIDATES) are two separate, traced steps
 * (founder rule 2026-11-18): recording an inspection never touches stock; only an explicit `restock` decision taken
 * on a `resellable` inspection can — and then still only within `RETURN_RESTOCK_MODE`.
 */
export const RETURN_DECISIONS = ["restock", "keep_out"] as const
export type ReturnDecision = (typeof RETURN_DECISIONS)[number]
export function isReturnDecision(v: unknown): v is ReturnDecision {
  return typeof v === "string" && (RETURN_DECISIONS as readonly string[]).includes(v)
}

export const RETURN_DECISION_ACTION = "return.disposition_decided"
export const returnInspectionHistoryId = (returnId: string, n: number) => `return-inspection:${returnId}:${n}`
export const returnDecisionId = (returnId: string, n: number) => `return-decision:${returnId}:${n}`

export type DispositionEvent =
  | { kind: "received"; at: string }
  | { kind: "inspected"; at: string; outcome: ReturnInspectionOutcome; note: string }
  | { kind: "decided"; at: string; decision: ReturnDecision; note: string; restock: string }
  | { kind: "restocked"; at: string; qty: number }

export type DispositionStage =
  | "awaiting_reception"
  | "awaiting_inspection"
  | "inspected_not_resellable"
  | "awaiting_decision"
  | "kept_out"
  | "restock_validated_not_applied"
  | "restocked"

/** Where the goods of a return stand, from its traced events (oldest first). */
export function dispositionStage(events: ReadonlyArray<DispositionEvent>): DispositionStage {
  if (events.some((e) => e.kind === "restocked")) return "restocked"
  if (!events.some((e) => e.kind === "received")) return "awaiting_reception"
  const inspections = events.filter((e): e is Extract<DispositionEvent, { kind: "inspected" }> => e.kind === "inspected")
  const last = inspections.at(-1)
  if (!last) return "awaiting_inspection"
  const decisionAfter = events
    .filter((e): e is Extract<DispositionEvent, { kind: "decided" }> => e.kind === "decided" && e.at >= last.at)
    .at(-1)
  if (last.outcome !== "resellable") return decisionAfter?.decision === "keep_out" ? "kept_out" : "inspected_not_resellable"
  if (!decisionAfter) return "awaiting_decision"
  return decisionAfter.decision === "keep_out" ? "kept_out" : "restock_validated_not_applied"
}

/** A restock can only be validated on the LATEST inspection, and only when it found the goods resellable. */
export function canDecideRestock(latestOutcome: ReturnInspectionOutcome | null, decision: ReturnDecision): boolean {
  if (latestOutcome == null) return false
  if (decision === "keep_out") return true
  return latestOutcome === "resellable"
}
