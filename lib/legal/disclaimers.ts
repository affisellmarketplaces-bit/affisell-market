/** EU-safe copy — no guaranteed gains. */
export const REVENUE_DISCLAIMER =
  "*Estimation basée sur données marché. Résultats non garantis."

/**
 * Corrected 2026-11-13: it used to read "Probabilité estimée à partir de signaux marché publics". The score is a fixed formula
 * over estimated (not measured) inputs — it is not a probability and no public market signal is read. Owner: validate wording.
 */
export const PROBABILITY_DISCLAIMER =
  "*Score calculé par une règle à partir d'estimations non mesurées — ce n'est pas une probabilité statistique. Non contractuel."

export const CONVERSION_DISCLAIMER =
  "*Impact conversion estimé — performance réelle variable selon catalogue et affiliés."

export const SMART_MARGIN_FOOTER =
  "*Estimations basées sur données marché agrégées. Aucun résultat garanti."

export function withRevenueDisclaimer(value: string): string {
  return `${value} ${REVENUE_DISCLAIMER}`
}
