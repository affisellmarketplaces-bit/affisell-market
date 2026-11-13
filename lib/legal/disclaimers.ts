/**
 * EU-safe copy — no guaranteed gains.
 *
 * The wording of REVENUE_DISCLAIMER, PROBABILITY_DISCLAIMER and SMART_MARGIN_FOOTER was supplied VERBATIM by the owner on
 * 2026-11-13 (apostrophes are the typographic U+2019). Do not reword them without a deliberate legal decision:
 * lib/__tests__/smart-margin-legal.test.ts pins the exact strings.
 *
 * What they describe: the Smart Margin figures come from fixed formulas fed with ESTIMATED data (three hand-written demo
 * fixtures and a category/price heuristic), not from real sales, and no AI model is involved.
 */
export const REVENUE_DISCLAIMER =
  "Estimation indicative, calculée par une formule à partir de données estimées, et non de ventes réelles."

export const PROBABILITY_DISCLAIMER =
  "*Note indicative de 0 à 100, calculée par une formule fixe à partir d’estimations. Ce n’est ni une probabilité ni une prévision de ventes. Non contractuelle."

export const CONVERSION_DISCLAIMER =
  "*Impact conversion estimé — performance réelle variable selon catalogue et affiliés."

export const SMART_MARGIN_FOOTER =
  "Estimations indicatives, calculées par une formule à partir de données estimées, et non de ventes réelles."

export function withRevenueDisclaimer(value: string): string {
  return `${value} ${REVENUE_DISCLAIMER}`
}
