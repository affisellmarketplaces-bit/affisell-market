import { splitLine, validateContractModel, type ContractModel } from "@/lib/contract-models/model"
import type { SimulationOrder } from "@/lib/contract-models/simulate"

/**
 * Chantier 5 — versions and their freezing per order (SIMULATION; nothing stored, nothing wired).
 *
 * Rules (founder, 2026-11-18): an order keeps the conditions of its payment; a contract change never applies to the
 * past. Hence:
 * - a published (id, version) never changes: a new content needs a new version (`nextVersion`, `checkVersionUnchanged`);
 * - an order is governed by the assignment in force AT ITS PAYMENT (`effectiveFrom <= paidAt`, a supplier-specific
 *   assignment over a global one, the most recent first); before any assignment it is `legacy`: the conditions frozen on
 *   the order itself, which a simulation reproduces unchanged;
 * - an assignment can only start in the future of its creation (`assignmentStartsInPast`): back-dating is refused.
 */
export type ModelAssignment = {
  modelId: string
  version: number
  /** null = every supplier without a specific assignment. */
  supplierId: string | null
  effectiveFrom: Date
  createdAt: Date
}

export type ModelKey = `${string}@${number}`
export const modelKey = (m: { id?: string; modelId?: string; version: number }): ModelKey =>
  `${m.id ?? m.modelId}@${m.version}` as ModelKey

export function assignmentStartsInPast(a: ModelAssignment): boolean {
  return a.effectiveFrom.getTime() < a.createdAt.getTime()
}

export type OrderGovernance = { kind: "legacy" } | { kind: "model"; model: ContractModel; assignment: ModelAssignment }

export function resolveModelForOrder(
  order: { paidAt: Date | null; supplierId: string },
  assignments: ReadonlyArray<ModelAssignment>,
  models: ReadonlyArray<ContractModel>
): OrderGovernance {
  if (!order.paidAt) return { kind: "legacy" }
  const paid = order.paidAt.getTime()
  const inForce = assignments
    .filter((a) => !assignmentStartsInPast(a) && a.effectiveFrom.getTime() <= paid)
    .filter((a) => a.supplierId == null || a.supplierId === order.supplierId)
    .sort(
      (x, y) =>
        Number(y.supplierId != null) - Number(x.supplierId != null) || y.effectiveFrom.getTime() - x.effectiveFrom.getTime()
    )
  for (const a of inForce) {
    const model = models.find((m) => m.id === a.modelId && m.version === a.version)
    if (model) return { kind: "model", model, assignment: a }
  }
  return { kind: "legacy" }
}

/** A new version of a model: the same family, version + 1, back to draft. The original object is not touched. */
export function nextVersion(model: ContractModel, change: Partial<Pick<ContractModel, "label" | "roles" | "parameters" | "undecided">>): ContractModel {
  return {
    ...model,
    ...change,
    roles: { ...model.roles, ...(change.roles ?? {}) },
    parameters: { ...model.parameters, ...(change.parameters ?? {}) },
    undecided: [...(change.undecided ?? model.undecided)],
    version: model.version + 1,
    status: "draft",
  }
}

/** A stored (id, version) whose content differs from a candidate with the same key = refused. */
export function checkVersionUnchanged(stored: ContractModel, candidate: ContractModel): "ok" | "version_already_used" {
  if (stored.id !== candidate.id || stored.version !== candidate.version) return "ok"
  const strip = (m: ContractModel) => JSON.stringify({ ...m, status: undefined })
  return strip(stored) === strip(candidate) ? "ok" : "version_already_used"
}

export type GovernedOrder = SimulationOrder & { paidAt: Date | null; supplierId: string }

export type AssignmentSimulation = {
  orders: number
  legacyOrders: number
  byModel: Record<ModelKey, number>
  totals: { supplier: { actual: number; simulated: number }; reseller: { actual: number; simulated: number }; affisell: { actual: number; simulated: number } }
  invalidModels: string[]
}

/**
 * Replays a set of assignments on past orders: each order under the model in force at ITS payment; a legacy order is
 * reproduced with its own frozen amounts. Pure; writes nothing.
 */
export function simulateAssignments(
  orders: ReadonlyArray<GovernedOrder>,
  assignments: ReadonlyArray<ModelAssignment>,
  models: ReadonlyArray<ContractModel>
): AssignmentSimulation {
  const out: AssignmentSimulation = {
    orders: orders.length,
    legacyOrders: 0,
    byModel: {},
    totals: { supplier: { actual: 0, simulated: 0 }, reseller: { actual: 0, simulated: 0 }, affisell: { actual: 0, simulated: 0 } },
    invalidModels: [],
  }
  const invalid = new Set<string>()
  for (const o of orders) {
    out.totals.supplier.actual += o.actual.supplierTransferCents
    out.totals.reseller.actual += o.actual.resellerTransferCents
    out.totals.affisell.actual += o.actual.affisellFeesCents
    const gov = resolveModelForOrder(o, assignments, models)
    const errors = gov.kind === "model" ? validateContractModel(gov.model).filter((e) => e !== "active_with_undecided_parameters") : []
    if (gov.kind === "legacy" || errors.length > 0) {
      if (gov.kind === "model") invalid.add(modelKey(gov.model))
      out.legacyOrders += 1
      out.totals.supplier.simulated += o.actual.supplierTransferCents
      out.totals.reseller.simulated += o.actual.resellerTransferCents
      out.totals.affisell.simulated += o.actual.affisellFeesCents
      continue
    }
    const key = modelKey(gov.model)
    out.byModel[key] = (out.byModel[key] ?? 0) + 1
    const s = splitLine(gov.model, o)
    out.totals.supplier.simulated += s.supplierTransferCents
    out.totals.reseller.simulated += s.resellerTransferCents
    out.totals.affisell.simulated += s.affisellNetBeforeStripeCents
  }
  out.invalidModels = [...invalid]
  return out
}
