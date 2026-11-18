import { splitLine, validateContractModel, type ContractModel, type LineInput } from "@/lib/contract-models/model"

/**
 * Decision support for the founder WITHOUT choosing a value: an undecided rate of a draft model (B, C1, C2) is swept
 * over a grid on past order snapshots, and the effect on each party is shown, with the thresholds where Affisell stops
 * losing money and where no supplier share turns negative. Nothing is recommended: the grid is a range to look at, not a
 * proposal, and the Stripe fee is an ESTIMATE supplied per line by the caller. Pure — no order is changed.
 */
export const SWEEPABLE_PARAMETERS = ["resellerFeeBps", "procurementServiceFeeBps", "supplierFeeBps"] as const
export type SweepableParameter = (typeof SWEEPABLE_PARAMETERS)[number]

export type SweepLine = LineInput & { orderId: string; estimatedStripeFeeCents?: number }

export type SweepRow = {
  value: number
  supplierCents: number
  resellerCents: number
  affisellBeforeStripeCents: number
  /** Affisell before Stripe − the estimated Stripe fee (labelled estimate). */
  affisellAfterStripeEstimateCents: number
  /** Lines where Affisell ends below 0 after the estimated Stripe fee. */
  linesAffisellLoss: number
  /** Lines whose supplier share before the source is negative (fees above the price): never forced, reported. */
  linesSupplierNegative: number
  uncoveredAdvanceCents: number
}

export type SweepResult = {
  modelId: string
  version: number
  parameter: SweepableParameter
  undecided: boolean
  invalidModel: string[]
  lines: number
  rows: SweepRow[]
  /** Smallest swept value where Affisell's total after the estimated Stripe fee is ≥ 0 (null = none on the grid). */
  firstValueAffisellNonNegative: number | null
  /** Smallest swept value where NO line loses money for Affisell (null = none on the grid). */
  firstValueNoLossLine: number | null
  /** Largest swept value where no supplier share is negative (null = none on the grid). */
  lastValueNoNegativeSupplier: number | null
  disclaimer: string
}

/** 0 → 30 % by 1 % steps: a range to look at, not a proposal. */
export const DEFAULT_SWEEP_GRID_BPS: ReadonlyArray<number> = Array.from({ length: 31 }, (_, i) => i * 100)

export function sweepUndecidedParameter(
  model: ContractModel,
  parameter: SweepableParameter,
  lines: ReadonlyArray<SweepLine>,
  grid: ReadonlyArray<number> = DEFAULT_SWEEP_GRID_BPS
): SweepResult {
  const values = [...new Set(grid.filter((v) => Number.isInteger(v) && v >= 0 && v <= 5_000))].sort((a, b) => a - b)
  const invalid = validateContractModel(model).filter((e) => e !== "active_with_undecided_parameters")
  const rows: SweepRow[] = []
  if (invalid.length === 0) {
    for (const value of values) {
      const variant: ContractModel = { ...model, parameters: { ...model.parameters, [parameter]: value } }
      const row: SweepRow = {
        value,
        supplierCents: 0,
        resellerCents: 0,
        affisellBeforeStripeCents: 0,
        affisellAfterStripeEstimateCents: 0,
        linesAffisellLoss: 0,
        linesSupplierNegative: 0,
        uncoveredAdvanceCents: 0,
      }
      for (const l of lines) {
        const s = splitLine(variant, l)
        const after = s.affisellNetBeforeStripeCents - Math.max(0, Math.round(l.estimatedStripeFeeCents ?? 0))
        row.supplierCents += s.supplierTransferCents
        row.resellerCents += s.resellerTransferCents
        row.affisellBeforeStripeCents += s.affisellNetBeforeStripeCents
        row.affisellAfterStripeEstimateCents += after
        row.uncoveredAdvanceCents += s.uncoveredAdvanceCents
        if (after < 0) row.linesAffisellLoss += 1
        if (s.supplierTransferCents < 0) row.linesSupplierNegative += 1
      }
      rows.push(row)
    }
  }
  const first = (ok: (r: SweepRow) => boolean) => rows.find(ok)?.value ?? null
  const okSupplier = rows.filter((r) => r.linesSupplierNegative === 0)
  return {
    modelId: model.id,
    version: model.version,
    parameter,
    undecided: (model.undecided as ReadonlyArray<string>).includes(parameter),
    invalidModel: invalid,
    lines: invalid.length === 0 ? lines.length : 0,
    rows,
    firstValueAffisellNonNegative: lines.length > 0 ? first((r) => r.affisellAfterStripeEstimateCents >= 0) : null,
    firstValueNoLossLine: lines.length > 0 ? first((r) => r.linesAffisellLoss === 0) : null,
    lastValueNoNegativeSupplier: lines.length > 0 && okSupplier.length > 0 ? okSupplier[okSupplier.length - 1].value : null,
    disclaimer:
      "Simulation sur commandes passées — grille de valeurs à examiner, pas une proposition. Frais Stripe estimés. " +
      "Volume supposé inchangé quel que soit le taux. Aucune commande n'est modifiée.",
  }
}
