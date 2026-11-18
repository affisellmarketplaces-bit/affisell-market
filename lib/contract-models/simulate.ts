import { splitLine, validateContractModel, type ContractModel, type LineInput } from "@/lib/contract-models/model"

/**
 * Replays a model on PAST order lines and reports what each party WOULD have received. Read-only by construction
 * (pure; the caller passes snapshots): no order is recomputed, re-settled or re-transferred — a contract change never
 * applies retroactively. "Actual" amounts are the ones frozen on the orders.
 */
export type SimulationOrder = LineInput & {
  orderId: string
  actual: { supplierTransferCents: number; resellerTransferCents: number; affisellFeesCents: number }
}

export type SimulationResult = {
  modelId: string
  version: number
  orders: number
  invalidModel: string[]
  totals: {
    supplier: { actual: number; simulated: number }
    reseller: { actual: number; simulated: number }
    affisellBeforeStripe: { actual: number; simulated: number }
    affisellPaysSource: number
    uncoveredAdvance: number
  }
  /** Lines whose supplier share before the source is negative (fees above the price): reported, never forced. */
  negativeSupplierShare: number
  disclaimer: string
}

export function simulateModelOnOrders(model: ContractModel, orders: ReadonlyArray<SimulationOrder>): SimulationResult {
  const invalid = validateContractModel(model).filter((e) => e !== "active_with_undecided_parameters")
  const totals = {
    supplier: { actual: 0, simulated: 0 },
    reseller: { actual: 0, simulated: 0 },
    affisellBeforeStripe: { actual: 0, simulated: 0 },
    affisellPaysSource: 0,
    uncoveredAdvance: 0,
  }
  let negative = 0
  if (invalid.length === 0) {
    for (const o of orders) {
      const s = splitLine(model, o)
      totals.supplier.actual += o.actual.supplierTransferCents
      totals.reseller.actual += o.actual.resellerTransferCents
      totals.affisellBeforeStripe.actual += o.actual.affisellFeesCents
      totals.supplier.simulated += s.supplierTransferCents
      totals.reseller.simulated += s.resellerTransferCents
      totals.affisellBeforeStripe.simulated += s.affisellNetBeforeStripeCents
      totals.affisellPaysSource += s.affisellPaysSourceCents
      totals.uncoveredAdvance += s.uncoveredAdvanceCents
      if (s.supplierTransferCents < 0) negative += 1
    }
  }
  return {
    modelId: model.id,
    version: model.version,
    orders: invalid.length === 0 ? orders.length : 0,
    invalidModel: invalid,
    totals,
    negativeSupplierShare: negative,
    disclaimer:
      model.undecided.length > 0
        ? `Simulation — paramètres non décidés (${model.undecided.join(", ")}) : valeurs provisoires, aucune commande n'est modifiée.`
        : "Simulation — aucune commande n'est modifiée.",
  }
}
