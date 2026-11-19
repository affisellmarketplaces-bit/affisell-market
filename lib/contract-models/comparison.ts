import { splitLine, validateContractModel, type ContractModel } from "@/lib/contract-models/model"
import type { SweepLine } from "@/lib/contract-models/sensitivity"
import { mayBackCommercialTerms, qualificationWarning } from "@/lib/supplier-costs/qualification"

/**
 * Comparing the models on REPRESENTATIVE orders without inventing a cost.
 *
 * Representative = REAL orders, not averages: the lines are split into price bands (terciles of the selling price) and
 * the order closest to each band's median price is taken. An average order would mix costs that never existed together.
 *
 * Every figure is labelled by what it rests on, five kinds never mixed:
 *  - `recorded`   : read on the order (price, supplier price, commission, AliExpress cost when stored, frozen fee);
 *  - `missing`    : needed by a model and absent → that model is NOT computed for that order (never filled in);
 *  - `hypotheses` : values used without being facts (undecided parameters = placeholders, settlement default fee,
 *                   estimated Stripe fee, unchanged volume);
 *  - `computed`   : the split each party would receive;
 *  - `risks`      : economic exposure the split reveals (Affisell loss, negative supplier share, advance not covered,
 *                   source cash Affisell pays out).
 * Pure; no order is changed, no supplier is attached to a model, no value is chosen.
 */
export type RepresentativeOrder = { band: "bas" | "milieu" | "haut"; line: SweepLine; bandSize: number }

export function pickRepresentativeOrders(lines: ReadonlyArray<SweepLine>): RepresentativeOrder[] {
  const sorted = [...lines].sort((a, b) => a.priceHtCents - b.priceHtCents || a.orderId.localeCompare(b.orderId))
  if (sorted.length === 0) return []
  const names = ["bas", "milieu", "haut"] as const
  const bands = sorted.length < 3 ? [sorted] : [0, 1, 2].map((i) => sorted.slice(Math.floor((i * sorted.length) / 3), Math.floor(((i + 1) * sorted.length) / 3)))
  return bands
    .filter((b) => b.length > 0)
    .map((band, i) => {
      const median = band[Math.floor((band.length - 1) / 2)].priceHtCents
      const pick = band.reduce((best, l) => (Math.abs(l.priceHtCents - median) < Math.abs(best.priceHtCents - median) ? l : best), band[0])
      return { band: sorted.length < 3 ? "milieu" : names[i], line: pick, bandSize: band.length }
    })
}

export type ModelOnOrder =
  | { computable: false; missing: string[] }
  | {
      computable: true
      computed: { supplierCents: number; resellerCents: number; affisellBeforeStripeCents: number; affisellAfterStripeEstimateCents: number; affisellPaysSourceCents: number }
      hypotheses: string[]
      risks: string[]
    }

export type ComparisonRow = {
  orderId: string
  band: RepresentativeOrder["band"]
  bandSize: number
  recorded: {
    priceHtCents: number
    wholesaleCents: number
    commissionBps: number
    sourceCostCents: number | null
    /** recorded_purchase = a real purchase; declared_by_supplier = the supplier's own unverified figure. */
    sourceCostOrigin: "recorded_purchase" | "declared_by_supplier" | null
    /** Qualification of a declared cost (null for a recorded purchase or no cost). */
    sourceCostQualification: string | null
    supplierFeeBps: number | null
  }
  models: Record<string, ModelOnOrder>
}

const needsSource = (m: ContractModel) => m.path !== "A_catalogue"

export function compareModelsOnOrders(models: ReadonlyArray<ContractModel>, reps: ReadonlyArray<RepresentativeOrder>): ComparisonRow[] {
  return reps.map(({ line, band, bandSize }) => {
    const out: Record<string, ModelOnOrder> = {}
    for (const model of models) {
      const invalid = validateContractModel(model).filter((e) => e !== "active_with_undecided_parameters")
      const missing: string[] = []
      if (invalid.length > 0) missing.push(`modèle invalide : ${invalid.join(", ")}`)
      if (needsSource(model) && !(line.sourceCostCents > 0)) missing.push("coût d'achat à la source non enregistré pour cette commande")
      if (missing.length > 0) {
        out[model.id] = { computable: false, missing }
        continue
      }
      const s = splitLine(model, line)
      const stripe = Math.max(0, Math.round(line.estimatedStripeFeeCents ?? 0))
      const after = s.affisellNetBeforeStripeCents - stripe
      const hypotheses = [
        ...model.undecided.map((u) => `paramètre non décidé « ${u} » : valeur provisoire`),
        "frais Stripe estimés (2,9 % + 0,25 €), le montant réel n'est pas enregistré",
        "volume de ventes supposé inchangé",
      ]
      if (needsSource(model) && line.sourceCostKind !== "declared_by_supplier") {
        hypotheses.push("coût d'achat = prix mémorisé par Affisell (hors livraison, TVA non connue), pas le montant réellement débité")
      }
      if (needsSource(model) && line.sourceCostKind === "declared_by_supplier") {
        const q = line.costQualification ?? "unverified"
        hypotheses.push(qualificationWarning(q))
        if (!mayBackCommercialTerms(q)) hypotheses.push("ne peut fonder aucun taux, engagement ou automatisme commercial")
      }
      if (model.parameters.supplierFeeBps === null && line.feeRateFromOrder === false) {
        hypotheses.push("taux de frais fournisseur absent de la commande : taux par défaut de la plateforme")
      }
      const risks: string[] = []
      if (after < 0) risks.push("Affisell perd de l'argent sur cette commande")
      if (s.supplierTransferCents < 0) risks.push("la part du fournisseur serait négative")
      if (s.uncoveredAdvanceCents > 0) risks.push("avance non couverte par la part du fournisseur")
      if (s.affisellPaysSourceCents > 0) risks.push("Affisell avance la trésorerie de l'achat")
      if (needsSource(model) && (line.costQualification === "disputed" || line.costQualification === "expired")) {
        risks.push("coût déclaré contesté ou expiré : résultat non fiable")
      }
      out[model.id] = {
        computable: true,
        computed: {
          supplierCents: s.supplierTransferCents,
          resellerCents: s.resellerTransferCents,
          affisellBeforeStripeCents: s.affisellNetBeforeStripeCents,
          affisellAfterStripeEstimateCents: after,
          affisellPaysSourceCents: s.affisellPaysSourceCents,
        },
        hypotheses,
        risks,
      }
    }
    return {
      orderId: line.orderId,
      band,
      bandSize,
      recorded: {
        priceHtCents: line.priceHtCents,
        wholesaleCents: line.wholesaleCents,
        commissionBps: line.commissionBps,
        sourceCostCents: line.sourceCostCents > 0 ? line.sourceCostCents : null,
        sourceCostOrigin: line.sourceCostCents > 0 ? (line.sourceCostKind ?? "recorded_purchase") : null,
        sourceCostQualification: line.sourceCostKind === "declared_by_supplier" ? (line.costQualification ?? "unverified") : null,
        supplierFeeBps: line.feeRateFromOrder ? line.gridSupplierFeeBps : null,
      },
      models: out,
    }
  })
}
