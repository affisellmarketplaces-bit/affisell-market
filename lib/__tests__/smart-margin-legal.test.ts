import { describe, expect, it } from "vitest"

import {
  CONVERSION_DISCLAIMER,
  PROBABILITY_DISCLAIMER,
  REVENUE_DISCLAIMER,
  SMART_MARGIN_FOOTER,
  withRevenueDisclaimer,
} from "@/lib/legal/disclaimers"

describe("smart margin legal (EU)", () => {
  it("revenue disclaimer says the figure is indicative, formula-based and not real sales", () => {
    expect(REVENUE_DISCLAIMER).toMatch(/Estimation indicative/i)
    expect(REVENUE_DISCLAIMER).toMatch(/formule/i)
    expect(REVENUE_DISCLAIMER).toMatch(/non de ventes réelles/i)
  })

  it("probability disclaimer says the score is neither a probability nor a sales forecast, and is non-contractual", () => {
    expect(PROBABILITY_DISCLAIMER).toMatch(/ni une probabilité ni une prévision de ventes/i)
    expect(PROBABILITY_DISCLAIMER).toMatch(/formule fixe/i)
    expect(PROBABILITY_DISCLAIMER).toMatch(/Non contractuelle/i)
  })

  it("withRevenueDisclaimer appends legal suffix", () => {
    const line = withRevenueDisclaimer("120 €")
    expect(line).toContain("120 €")
    expect(line).toContain(REVENUE_DISCLAIMER)
  })

  it("every disclaimer served with the analysis is a non-empty string, and the score one keeps its footnote asterisk", () => {
    for (const d of [REVENUE_DISCLAIMER, PROBABILITY_DISCLAIMER, CONVERSION_DISCLAIMER, SMART_MARGIN_FOOTER]) {
      expect(typeof d).toBe("string")
      expect(d.trim().length).toBeGreaterThan(20)
    }
    // the panel label reads "Score de succès*": the asterisk refers to this line
    expect(PROBABILITY_DISCLAIMER.startsWith("*")).toBe(true)
  })
})

describe("smart margin legal copy does not claim market data that does not exist", () => {
  it("no disclaimer says the estimate is 'based on (aggregated) market data' or on public market signals", () => {
    for (const d of [REVENUE_DISCLAIMER, PROBABILITY_DISCLAIMER, CONVERSION_DISCLAIMER, SMART_MARGIN_FOOTER]) {
      expect(d).not.toMatch(/basée?s? sur (des )?données (de )?marché/i)
      expect(d).not.toMatch(/agrégées/i)
      expect(d).not.toMatch(/signaux marché publics/i)
    }
  })

  it("no disclaimer presents the score as a probability or the revenue as a forecast of real sales", () => {
    expect(PROBABILITY_DISCLAIMER).not.toMatch(/probabilité estimée/i)
    for (const d of [REVENUE_DISCLAIMER, SMART_MARGIN_FOOTER]) {
      expect(d).toMatch(/indicative?s?/i)
      expect(d).toMatch(/formule/i)
      expect(d).toMatch(/données estimées/i)
      expect(d).toMatch(/non de ventes réelles/i)
    }
  })

  it("exact wording (supplied verbatim by the owner; any change must be a deliberate legal decision)", () => {
    expect(REVENUE_DISCLAIMER).toBe(
      "Estimation indicative, calculée par une formule à partir de données estimées, et non de ventes réelles."
    )
    expect(PROBABILITY_DISCLAIMER).toBe(
      "*Note indicative de 0 à 100, calculée par une formule fixe à partir d\u2019estimations. Ce n\u2019est ni une probabilité ni une prévision de ventes. Non contractuelle."
    )
    expect(SMART_MARGIN_FOOTER).toBe(
      "Estimations indicatives, calculées par une formule à partir de données estimées, et non de ventes réelles."
    )
    // untouched on purpose: it makes no claim about its data
    expect(CONVERSION_DISCLAIMER).toBe(
      "*Impact conversion estimé — performance réelle variable selon catalogue et affiliés."
    )
  })
})
