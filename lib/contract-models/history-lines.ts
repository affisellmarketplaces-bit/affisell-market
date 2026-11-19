import type { SweepLine } from "@/lib/contract-models/sensitivity"
import { estimateStripeFeeCents } from "@/lib/marketplace-split-amounts"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"

/**
 * Past orders → lines a contract model can be replayed on. Same reading as the cockpit's lever simulation
 * (`representativeInput`): P = selling price HT, W = supplier price (else base price), commission = the frozen rate,
 * supplier fee rate = the frozen fee ÷ W when recorded. Two pools, never mixed:
 *  - `catalogue`: every usable order (path A — the supplier ships its own stock, no source cost);
 *  - `sourced`: only Affisell auto-buy orders with a recorded AliExpress cost — the ONLY real source costs Affisell
 *    knows. Paths B / C are replayed on these alone: inventing a source cost for a catalogue order would be fiction.
 * The Stripe fee is the central ESTIMATE (2.9 % + 25 c of the TTC charge); the real fee is not recorded.
 */
export type HistoryLines = {
  catalogue: SweepLine[]
  sourced: SweepLine[]
  excluded: { noPrice: number; noWholesale: number; refundedOrDisputed: number }
}

/** `defaults`: the settlement's fee rate when an order stored none (legacy rows store 0), as the cockpit does. */
export function sweepLinesFromOrders(
  orders: ReadonlyArray<EconOrder>,
  defaults: { catalogue: number; autoBuy: number }
): HistoryLines {
  const out: HistoryLines = { catalogue: [], sourced: [], excluded: { noPrice: 0, noWholesale: 0, refundedOrDisputed: 0 } }
  for (const o of orders) {
    const P = o.split.sellingPriceCents
    const W = o.split.supplierPriceCents > 0 ? o.split.supplierPriceCents : o.split.basePriceCents
    if (!(P > 0)) {
      out.excluded.noPrice += 1
      continue
    }
    if (!(W > 0)) {
      out.excluded.noWholesale += 1
      continue
    }
    // A refunded or disputed order says nothing about a contract split (its money went back) — kept out, counted.
    if (o.disputed || o.refundedCents > 0) {
      out.excluded.refundedOrDisputed += 1
      continue
    }
    const fee = o.split.supplierFeeCents ?? 0
    const line: SweepLine = {
      orderId: o.orderId,
      priceHtCents: P,
      wholesaleCents: W,
      commissionBps: o.split.supplierCommissionRateBps,
      sourceCostCents: 0,
      gridSupplierFeeBps: fee > 0 ? Math.round((fee * 10_000) / W) : o.split.usesAffisellAutoBuy ? defaults.autoBuy : defaults.catalogue,
      estimatedStripeFeeCents: estimateStripeFeeCents(Math.max(1, o.totalCents ?? P)),
      feeRateFromOrder: fee > 0,
    }
    out.catalogue.push(line)
    const ae = o.split.usesAffisellAutoBuy ? Math.max(0, o.split.aeWholesaleCents ?? 0) : 0
    if (ae > 0) out.sourced.push({ ...line, sourceCostCents: ae })
  }
  return out
}
