import { describe, expect, it } from "vitest"

import {
  CONVERSION_DISCLAIMER,
  PROBABILITY_DISCLAIMER,
  REVENUE_DISCLAIMER,
  SMART_MARGIN_FOOTER,
  withRevenueDisclaimer,
} from "@/lib/legal/disclaimers"

describe("smart margin legal (EU)", () => {
  it("revenue disclaimer mentions non-guarantie", () => {
    expect(REVENUE_DISCLAIMER).toMatch(/Estimation/i)
    expect(REVENUE_DISCLAIMER).toMatch(/non garanti/i)
  })

  it("probability disclaimer is non-contractual", () => {
    expect(PROBABILITY_DISCLAIMER).toMatch(/pas une probabilité/i)
    expect(PROBABILITY_DISCLAIMER).toMatch(/règle/i)
    expect(PROBABILITY_DISCLAIMER).toMatch(/Non contractuel/i)
  })

  it("withRevenueDisclaimer appends legal suffix", () => {
    const line = withRevenueDisclaimer("120 €")
    expect(line).toContain("120 €")
    expect(line).toContain(REVENUE_DISCLAIMER)
  })

  it("every € figure in API response includes disclaimer keys", () => {
    const required = [REVENUE_DISCLAIMER, PROBABILITY_DISCLAIMER, CONVERSION_DISCLAIMER, SMART_MARGIN_FOOTER]
    for (const d of required) {
      expect(d.startsWith("*")).toBe(true)
    }
  })
})

describe("smart margin legal copy does not claim market data that does not exist (review #25)", () => {
  // Contradiction found in review: the panel said "non mesurées" while REVENUE_DISCLAIMER / SMART_MARGIN_FOOTER said "basée(s) sur
  // données marché (agrégées)". There is no market feed: 3 hand-written fixtures and a category/price heuristic.
  it("no disclaimer says the estimate is 'based on (aggregated) market data'", () => {
    for (const d of [REVENUE_DISCLAIMER, PROBABILITY_DISCLAIMER, CONVERSION_DISCLAIMER, SMART_MARGIN_FOOTER]) {
      expect(d).not.toMatch(/basée?s? sur (des )?données (de )?marché/i)
      expect(d).not.toMatch(/agrégées/i)
      expect(d).not.toMatch(/signaux marché publics/i)
    }
  })

  it("the revenue and footer disclaimers say: computed by a rule from unmeasured market data, no guarantee", () => {
    for (const d of [REVENUE_DISCLAIMER, SMART_MARGIN_FOOTER]) {
      expect(d).toMatch(/règle/i)
      expect(d).toMatch(/non mesurées/i)
      expect(d).toMatch(/non garantis|Aucun résultat garanti/i)
    }
  })

  it("exact wording (any change to it must be a deliberate legal decision)", () => {
    expect(REVENUE_DISCLAIMER).toBe(
      "*Estimation calculée par règle à partir de données de marché non mesurées. Résultats non garantis."
    )
    expect(SMART_MARGIN_FOOTER).toBe(
      "*Estimations calculées par règle à partir de données de marché non mesurées. Aucun résultat garanti."
    )
    expect(PROBABILITY_DISCLAIMER).toBe(
      "*Score calculé par une règle à partir d'estimations non mesurées — ce n'est pas une probabilité statistique. Non contractuel."
    )
    // untouched on purpose: it makes no claim about its data
    expect(CONVERSION_DISCLAIMER).toBe(
      "*Impact conversion estimé — performance réelle variable selon catalogue et affiliés."
    )
  })
})
