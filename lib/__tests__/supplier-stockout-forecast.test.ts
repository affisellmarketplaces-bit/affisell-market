/**
 * Founder brief 2026-11-19 « Anticipation intelligente des ruptures »: facts, calculation, hypotheses and limits apart;
 * reserved units never counted twice; too little or too old data = « non évaluable », never a false precision.
 */
import { describe, expect, it } from "vitest"

import {
  confirmationStillValid,
  forecastStockout,
  isPreventiveAlert,
  type StockoutInput,
} from "@/lib/supplier-catalog-health/stockout-forecast"

const now = new Date("2026-11-19T06:00:00Z")
const days = (n: number) => new Date(now.getTime() - n * 86_400_000)
/** 30 days, `perDay` units on each of the last `activeDays` days. */
const sales = (perDay: number, activeDays = 30) => Array.from({ length: 30 }, (_, i) => (i >= 30 - activeDays ? perDay : 0))
const base: StockoutInput = {
  declaredUnits: 20,
  confirmedAt: days(3),
  unconfirmedMarker: false,
  sheetUpdatedAt: days(3),
  reservedUnits: 0,
  reservedAlreadyDeducted: false,
  dailyUnits: sales(1),
  leadTimeDays: 30,
  now,
}

describe("stock-out forecast", () => {
  it("cover below the declared lead time even at the slow pace = alert, high confidence, restock now", () => {
    const f = forecastStockout({ ...base, declaredUnits: 15 })
    expect(f.calculation.coverDays).toBe(15)
    expect(f.calculation.comparedWith).toBe("declared_lead_time")
    expect(f.risk).toBe("sous_le_delai")
    expect(f.confidence).toBe("high")
    expect(f.action).toBe("restock_now")
    expect(isPreventiveAlert(f)).toBe(true)
  })

  it("reserved units are subtracted ONLY when the platform does not already deduct them", () => {
    const notDeducted = forecastStockout({ ...base, declaredUnits: 50, reservedUnits: 10 })
    expect(notDeducted.calculation.availableUnits).toBe(40)
    const deducted = forecastStockout({ ...base, declaredUnits: 50, reservedUnits: 10, reservedAlreadyDeducted: true })
    expect(deducted.calculation.availableUnits).toBe(50)
  })

  it("lead time unknown: compared with an indicative 14 days, said as a hypothesis, low confidence", () => {
    const f = forecastStockout({ ...base, declaredUnits: 10, leadTimeDays: null })
    expect(f.calculation.comparedWith).toBe("indicative_14_days")
    expect(f.hypotheses).toContain("lead_time_indicative")
    expect(f.limits).toContain("lead_time_unknown")
    expect(f.confidence).toBe("low")
  })

  it("never a false precision: few sales, sales on one day, an unconfirmed import or a stale quantity = not evaluable", () => {
    expect(forecastStockout({ ...base, dailyUnits: sales(1, 3).map((u, i) => (i === 29 ? 1 : 0)) }).risk).toBe("non_evaluable")
    const burst = forecastStockout({ ...base, dailyUnits: sales(0).map((u, i) => (i === 29 ? 30 : 0)) })
    expect(burst.risk).toBe("non_evaluable")
    expect(burst.limits).toContain("sales_on_few_days")
    const imported = forecastStockout({ ...base, unconfirmedMarker: true })
    expect(imported).toMatchObject({ risk: "non_evaluable", action: "confirm_quantity" })
    const stale = forecastStockout({ ...base, confirmedAt: days(200) })
    expect(stale.limits).toContain("confirmation_too_old")
    expect(stale.risk).toBe("non_evaluable")
    expect(forecastStockout({ ...base, declaredUnits: null }).calculation.coverDays).toBeNull()
  })

  it("below the lead time at the observed pace only = « probable »", () => {
    expect(forecastStockout(base).risk).toBe("probable")
  })

  it("enough cover is not an alert; « à surveiller » stays on the page", () => {
    expect(forecastStockout({ ...base, declaredUnits: 500 }).risk).toBe("suffisant")
    const watch = forecastStockout({ ...base, declaredUnits: 34 })
    expect(watch.risk).toBe("a_surveiller")
    expect(isPreventiveAlert(watch)).toBe(false)
  })

  it("never confirmed: the sheet's date is shown apart and is not a confirmation", () => {
    const f = forecastStockout({ ...base, confirmedAt: null })
    expect(f.facts.confirmedAt).toBeNull()
    expect(f.facts.sheetAgeDays).toBe(3)
    expect(f.limits).toContain("never_confirmed")
    expect(f.confidence).toBe("low")
  })

  it("a confirmation stays valid for the same figure, or lower only when the platform deducts sales", () => {
    const c = { units: 20, confirmedAt: days(2).toISOString(), by: "supplier" as const }
    expect(confirmationStillValid(c, 20, false)).toBe(true)
    expect(confirmationStillValid(c, 15, true)).toBe(true)
    expect(confirmationStillValid(c, 15, false)).toBe(false)
    expect(confirmationStillValid(c, 25, true)).toBe(false)
    expect(confirmationStillValid(null, 20, true)).toBe(false)
  })
})
