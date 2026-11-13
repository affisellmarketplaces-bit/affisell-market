/**
 * EU-safe copy — no guaranteed gains.
 *
 * Corrected 2026-11-13 (owner: validate wording). It used to read "*Estimation basée sur données marché. Résultats non
 * garantis." — but no market data is measured (3 hand-written demo fixtures and a category/price heuristic), and the same panel
 * says so. The estimate is computed by a rule from unmeasured inputs.
 */
export const REVENUE_DISCLAIMER =
  "*Estimation calculée par règle à partir de données de marché non mesurées. Résultats non garantis."

/**
 * Corrected 2026-11-13: it used to read "Probabilité estimée à partir de signaux marché publics". The score is a fixed formula
 * over estimated (not measured) inputs — it is not a probability and no public market signal is read. Owner: validate wording.
 */
export const PROBABILITY_DISCLAIMER =
  "*Score calculé par une règle à partir d'estimations non mesurées — ce n'est pas une probabilité statistique. Non contractuel."

export const CONVERSION_DISCLAIMER =
  "*Impact conversion estimé — performance réelle variable selon catalogue et affiliés."

/**
 * Corrected 2026-11-13 (owner: validate wording). It used to read "*Estimations basées sur données marché agrégées. Aucun
 * résultat garanti." — no market data is aggregated: there is no feed (see REVENUE_DISCLAIMER).
 */
export const SMART_MARGIN_FOOTER =
  "*Estimations calculées par règle à partir de données de marché non mesurées. Aucun résultat garanti."

export function withRevenueDisclaimer(value: string): string {
  return `${value} ${REVENUE_DISCLAIMER}`
}
