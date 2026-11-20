import "server-only"

import { compareModelsOnOrders, pickRepresentativeOrders, type ComparisonRow } from "@/lib/contract-models/comparison"
import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import { sweepLinesFromOrders } from "@/lib/contract-models/history-lines"
import { SWEEPABLE_PARAMETERS, sweepUndecidedParameter, type SweepResult } from "@/lib/contract-models/sensitivity"
import { simulateModelOnOrders, type SimulationResult } from "@/lib/contract-models/simulate"
import { DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY, resolveSupplierFeeBps } from "@/lib/marketplace-phase1-fees"
import { loadOrderFacts, MAX_ORDER_FACTS } from "@/lib/strategic-intelligence/mature-orders.server"
import { loadDeclarationHistories } from "@/lib/supplier-costs/declaration.server"

/**
 * READ-ONLY replay of the draft contract models on the last `days` days of paid orders (ADMIN cockpit / API).
 * Path A on every usable order, paths B / C on the orders whose source cost is known; every undecided numeric rate is
 * swept (no value chosen). Writes nothing, changes no order, calls nothing outside the database.
 */
export type ContractSimulationReport = {
  window: { from: string; to: string }
  truncated: boolean
  pools: { catalogue: number; sourced: number; declared: number; excluded: { noPrice: number; noWholesale: number; refundedOrDisputed: number } }
  models: Array<{ simulation: SimulationResult; sweeps: SweepResult[]; pool: "catalogue" | "sourced" | "declared" }>
  /**
   * The four models side by side on REAL representative orders: on catalogue orders (B / C not computable — no source
   * cost recorded) and on auto-buy orders with a recorded source cost (all four computable).
   */
  representative: { catalogue: ComparisonRow[]; sourced: ComparisonRow[]; declared: ComparisonRow[] }
}

export async function runContractSimulation(days: number, now = new Date()): Promise<ContractSimulationReport> {
  const span = Math.min(365, Math.max(7, Math.round(days)))
  const from = new Date(now.getTime() - span * 86_400_000)
  const orders = await loadOrderFacts({ from, to: now })
  // Supply costs DECLARED by catalogue suppliers (unverified, labelled), for orders not bought by Affisell.
  const catalogueProductIds = [...new Set(orders.filter((o) => !o.split.usesAffisellAutoBuy).map((o) => o.productId))]
  const declarations = await loadDeclarationHistories(catalogueProductIds)
  const lines = sweepLinesFromOrders(
    orders,
    { catalogue: resolveSupplierFeeBps(null), autoBuy: DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY },
    declarations
  )
  // Paths B / C are replayed twice, never mixed: on RECORDED purchase costs, and on supplier DECLARATIONS.
  // Explicit return type: without it TypeScript infers a union of array types and `flatMap` loses the element type.
  type Pool = ContractSimulationReport["models"][number]["pool"]
  const runs = DRAFT_CONTRACT_MODELS.flatMap((model): Array<{ model: typeof model; pool: Pool }> =>
    model.path === "A_catalogue" ? [{ model, pool: "catalogue" }] : [{ model, pool: "sourced" }, { model, pool: "declared" }]
  )
  const models = runs.map(({ model, pool }) => {
    const poolLines = lines[pool]
    const simulation = simulateModelOnOrders(
      model,
      poolLines.map((l) => ({ ...l, actual: { supplierTransferCents: 0, resellerTransferCents: 0, affisellFeesCents: 0 } }))
    )
    const sweeps = SWEEPABLE_PARAMETERS.filter((p) => (model.undecided as ReadonlyArray<string>).includes(p)).map((p) =>
      sweepUndecidedParameter(model, p, poolLines)
    )
    return { simulation, sweeps, pool }
  })
  return {
    window: { from: from.toISOString(), to: now.toISOString() },
    truncated: orders.length >= MAX_ORDER_FACTS,
    pools: { catalogue: lines.catalogue.length, sourced: lines.sourced.length, declared: lines.declared.length, excluded: lines.excluded },
    models,
    representative: {
      catalogue: compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders(lines.catalogue)),
      sourced: compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders(lines.sourced)),
      declared: compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders(lines.declared)),
    },
  }
}
