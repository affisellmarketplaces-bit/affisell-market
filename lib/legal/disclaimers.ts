/** EU-safe copy — no guaranteed gains. */
export const REVENUE_DISCLAIMER =
  "*Estimation basée sur données marché. Résultats non garantis."

export const PROBABILITY_DISCLAIMER =
  "*Probabilité estimée à partir de signaux marché publics. Non contractuelle."

export const CONVERSION_DISCLAIMER =
  "*Impact conversion estimé — performance réelle variable selon catalogue et affiliés."

export const SMART_MARGIN_FOOTER =
  "*Estimations basées sur données marché agrégées. Aucun résultat garanti."

export function withRevenueDisclaimer(value: string): string {
  return `${value} ${REVENUE_DISCLAIMER}`
}
