import type { SweepLine } from "@/lib/contract-models/sensitivity"
import { declaredSourceCostCents, resolveDeclarationForLine, type StoredDeclaration } from "@/lib/supplier-costs/declaration"
import { variantKeyFromOrderLabel } from "@/lib/supplier-costs/variant-key"
import type { CostQualification } from "@/lib/supplier-costs/qualification"
import { estimateStripeFeeCents } from "@/lib/marketplace-split-amounts"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"

/**
 * Past orders → lines a contract model can be replayed on. Same reading as the cockpit's lever simulation
 * (`representativeInput`): P = selling price HT, W = supplier price (else base price), commission = the frozen rate,
 * supplier fee rate = the frozen fee ÷ W when recorded. Two pools, never mixed:
 *  - `catalogue`: every usable order (path A — the supplier ships its own stock, no source cost);
 *  - `sourced`: only Affisell auto-buy orders with a recorded AliExpress cost — the ONLY real source costs Affisell
 *    knows. Paths B / C are replayed on these alone: inventing a source cost for a catalogue order would be fiction.
 *  - `declared`: catalogue orders whose supplier had DECLARED its supply cost before the payment
 *    (lib/supplier-costs/declaration.ts) — labelled as a declaration, not a fact; a later declaration never applies; the
 *    line's OWN variant declaration first, else the product-wide one — never another variant's.
 * The Stripe fee is the central ESTIMATE (2.9 % + 25 c of the TTC charge); the real fee is not recorded.
 */
export type HistoryLines = {
  catalogue: SweepLine[]
  sourced: SweepLine[]
  declared: SweepLine[]
  excluded: { noPrice: number; noWholesale: number; refundedOrDisputed: number }
}

/** `defaults`: the settlement's fee rate when an order stored none (legacy rows store 0), as the cockpit does. */
export function sweepLinesFromOrders(
  orders: ReadonlyArray<EconOrder & { paidAt?: Date | null; variantLabel?: string | null }>,
  defaults: { catalogue: number; autoBuy: number },
  declarations: ReadonlyMap<string, ReadonlyArray<StoredDeclaration & { qualification?: CostQualification }>> = new Map()
): HistoryLines {
  const out: HistoryLines = { catalogue: [], sourced: [], declared: [], excluded: { noPrice: 0, noWholesale: 0, refundedOrDisputed: 0 } }
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
    if (ae > 0) out.sourced.push({ ...line, sourceCostCents: ae, sourceCostKind: "recorded_purchase" })
    else if (!o.split.usesAffisellAutoBuy && o.paidAt) {
      const all = declarations.get(o.productId) ?? []
      const resolved = resolveDeclarationForLine({
        productHistory: all.filter((x) => !x.variantKey),
        variantHistory: all.filter((x) => !!x.variantKey),
        variantKey: variantKeyFromOrderLabel(o.variantLabel),
        at: o.paidAt,
      })
      const d = resolved.declaration
      if (d) {
        out.declared.push({
          ...line,
          sourceCostCents: declaredSourceCostCents(d),
          sourceCostKind: "declared_by_supplier",
          costQualification: d.qualification ?? "unverified",
          declarationScope: resolved.scope === "variant" ? "variant" : "product",
        })
      }
    }
  }
  return out
}
