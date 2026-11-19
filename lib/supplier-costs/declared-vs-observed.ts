import { declarationInForceAt, type StoredDeclaration } from "@/lib/supplier-costs/declaration"

/**
 * Preparing the comparison of a DECLARED cost with a cost Affisell has OBSERVED itself — two kinds of figure that are
 * never merged, averaged together or substituted for one another.
 *
 * What counts as "observed" today, and its limit (said on every result):
 *  - `order_snapshot`: `Order.aeWholesaleCents` on an Affisell auto-buy order = the AliExpress price STORED on the
 *    supplier link × quantity, frozen at payment, delivery excluded. It is what Affisell's own record says the source
 *    cost, NOT what the card was really charged (that amount is recorded nowhere yet — see `report:fee-reconciliation`).
 * A future observed kind (the real Issuing capture, a supplier invoice checked by Affisell) can be added to
 * `OBSERVED_KINDS` without changing the comparison.
 *
 * The comparison pairs each observation with the declaration IN FORCE at its payment (never a later one) and compares
 * like with like: the declared UNIT cost against the observed per-unit cost (delivery is not in the snapshot). Pure.
 */
export const OBSERVED_KINDS = ["order_snapshot"] as const
export type ObservedKind = (typeof OBSERVED_KINDS)[number]

export type CostObservation = { orderId: string; paidAt: Date; quantity: number; observedTotalCents: number; kind: ObservedKind }

export type PairedObservation = {
  orderId: string
  paidAt: string
  kind: ObservedKind
  observedUnitCents: number
  declaredUnitCents: number | null
  /** observed − declared, per unit (null when no declaration was in force at that payment). */
  gapCents: number | null
}

export type DeclaredVsObserved = {
  pairs: PairedObservation[]
  comparable: number
  withoutDeclaration: number
  /** Median of the per-unit gaps (observed − declared). Shown only with ≥ 3 comparable observations. */
  medianGapCents: number | null
  /** Plain statement of what the numbers are and are not. */
  caveat: string
}

export const MIN_COMPARABLE = 3

export function compareDeclaredWithObserved(
  declarations: ReadonlyArray<StoredDeclaration>,
  observations: ReadonlyArray<CostObservation>
): DeclaredVsObserved {
  const pairs: PairedObservation[] = []
  for (const o of observations) {
    const qty = Math.max(1, Math.round(o.quantity))
    if (!(o.observedTotalCents > 0)) continue // an unknown observed cost is not an observation
    const observedUnit = Math.round(o.observedTotalCents / qty)
    const d = declarationInForceAt(declarations, o.paidAt)
    pairs.push({
      orderId: o.orderId,
      paidAt: o.paidAt.toISOString(),
      kind: o.kind,
      observedUnitCents: observedUnit,
      declaredUnitCents: d ? d.unitCostCents : null,
      gapCents: d ? observedUnit - d.unitCostCents : null,
    })
  }
  const gaps = pairs.map((p) => p.gapCents).filter((g): g is number => g !== null).sort((a, b) => a - b)
  const median =
    gaps.length < MIN_COMPARABLE
      ? null
      : gaps.length % 2 === 1
        ? gaps[(gaps.length - 1) / 2]
        : Math.round((gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2)
  return {
    pairs,
    comparable: gaps.length,
    withoutDeclaration: pairs.length - gaps.length,
    medianGapCents: median,
    caveat:
      "Coût observé = prix d'achat mémorisé par Affisell sur la commande (hors livraison), pas le montant réellement débité. " +
      "Coût déclaré = chiffre du fournisseur en vigueur au paiement. Les deux sont comparés, jamais fusionnés.",
  }
}
