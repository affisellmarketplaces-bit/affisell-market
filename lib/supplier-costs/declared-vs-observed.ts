import { declarationEffectiveAt, resolveDeclarationForLine, type StoredDeclaration } from "@/lib/supplier-costs/declaration"
import { perimeterMismatches, type CostPerimeter, type ObservedCostEntry } from "@/lib/supplier-costs/observed-cost-register"

/**
 * Comparing a DECLARED cost with a cost Affisell OBSERVED (observed-cost-register.ts) — never merged, and only called
 * "comparable" when both amounts cover EXACTLY the same perimeter: same currency, both per unit, delivery treated the
 * same way, VAT known and treated the same way, same variant. Any difference or unknown keeps the pair visible with its
 * reasons and OUT of the median. Dates: each observation meets the declaration in force at its payment (never a later
 * one); a declaration older than `STALE_DECLARATION_DAYS` at that date is flagged, not hidden. Pure.
 */
export const MIN_COMPARABLE = 3
export const STALE_DECLARATION_DAYS = 180

/** A declaration states one unit's cost, in euros, excluding VAT (the form says HT), delivery apart — for the whole
 *  product, or for ONE variant when it is a variant declaration. */
export function declaredUnitPerimeter(variantKey: string | null = null): CostPerimeter {
  return { currency: "EUR", basis: "unit", includesDelivery: false, vat: "excluded", variantKey }
}

export type PairedObservation = {
  orderId: string
  paidAt: string
  kind: ObservedCostEntry["kind"]
  source: ObservedCostEntry["source"]
  reliability: ObservedCostEntry["reliability"]
  observedUnitCents: number
  declaredUnitCents: number | null
  /** Which declaration met the observation: the variant's own, the product-wide one, or none. */
  declarationScope: "variant" | "product" | "none"
  comparable: boolean
  /** Why the pair is not comparable (empty when comparable). */
  reasons: string[]
  /** observed − declared per unit — only for a comparable pair. */
  gapCents: number | null
  declarationAgeDays: number | null
  staleDeclaration: boolean
}

export type DeclaredVsObserved = {
  pairs: PairedObservation[]
  comparable: number
  notComparable: number
  withoutDeclaration: number
  medianGapCents: number | null
  /** The reasons that kept pairs out of the comparison, with their counts — what to fix to compare. */
  blockingReasons: Array<{ reason: string; pairs: number }>
  caveat: string
}

export function compareDeclaredWithObserved(
  declarations: ReadonlyArray<StoredDeclaration>,
  entries: ReadonlyArray<ObservedCostEntry>
): DeclaredVsObserved {
  const pairs: PairedObservation[] = []
  for (const e of entries) {
    if (e.kind !== "stored_source_price" && e.kind !== "charged_amount") continue // fees and evidence are not a unit cost
    if (e.amountCents == null || e.amountCents <= 0) continue
    const qty = Math.max(1, e.quantity)
    // A line total becomes a unit cost by dividing by the quantity — the only conversion made, and it is exact.
    const unitPerimeter: CostPerimeter = { ...e.perimeter, basis: "unit" }
    const observedUnit = e.perimeter.basis === "line" ? Math.round(e.amountCents / qty) : e.amountCents
    const paidAt = new Date(e.observedAt)
    const resolved = resolveDeclarationForLine({
      productHistory: declarations.filter((x) => !x.variantKey),
      variantHistory: declarations.filter((x) => !!x.variantKey),
      variantKey: e.perimeter.variantKey,
      at: paidAt,
    })
    const d = resolved.declaration
    const reasons = d
      ? perimeterMismatches(declaredUnitPerimeter(d.variantKey ?? null), unitPerimeter)
      : ["aucune déclaration en vigueur à cette date"]
    // A product-wide cost met with one variant's observation is a different perimeter: said in words.
    if (d && !d.variantKey && e.perimeter.variantKey) {
      const i = reasons.indexOf("variantes différentes ou non précisées")
      if (i >= 0) reasons[i] = "déclaration globale du produit, observation d'une variante précise"
    }
    const age = d ? Math.floor((paidAt.getTime() - declarationEffectiveAt(d)) / 86_400_000) : null
    const comparable = d !== null && reasons.length === 0
    pairs.push({
      orderId: e.orderId,
      paidAt: e.observedAt,
      kind: e.kind,
      source: e.source,
      reliability: e.reliability,
      observedUnitCents: observedUnit,
      declaredUnitCents: d ? d.unitCostCents : null,
      declarationScope: resolved.scope,
      comparable,
      reasons,
      gapCents: comparable ? observedUnit - d!.unitCostCents : null,
      declarationAgeDays: age,
      staleDeclaration: age !== null && age > STALE_DECLARATION_DAYS,
    })
  }
  const gaps = pairs.filter((p) => p.comparable).map((p) => p.gapCents as number).sort((a, b) => a - b)
  const median =
    gaps.length < MIN_COMPARABLE
      ? null
      : gaps.length % 2 === 1
        ? gaps[(gaps.length - 1) / 2]
        : Math.round((gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2)
  const reasonCounts = new Map<string, number>()
  for (const p of pairs) for (const r of p.reasons) reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1)
  return {
    pairs,
    comparable: gaps.length,
    notComparable: pairs.filter((p) => !p.comparable).length,
    withoutDeclaration: pairs.filter((p) => p.declaredUnitCents === null).length,
    medianGapCents: median,
    blockingReasons: [...reasonCounts.entries()].map(([reason, n]) => ({ reason, pairs: n })).sort((a, b) => b.pairs - a.pairs),
    caveat:
      "Un écart n'est calculé que si les deux montants couvrent le même périmètre (devise, unité, livraison, TVA, variante). " +
      "Le coût d'une variante n'est jamais appliqué à une autre ; une déclaration globale n'est pas comparable à l'observation d'une variante. " +
      "Prix mémorisé ≠ montant débité. Déclaré et constaté ne sont jamais fusionnés.",
  }
}
