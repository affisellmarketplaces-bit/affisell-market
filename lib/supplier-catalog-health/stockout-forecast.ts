/**
 * Anticipating a stock-out BEFORE the resellers' buyers meet it (founder brief 2026-11-19 « Anticipation intelligente des
 * ruptures »). Pure, client-safe. Nothing is ordered, sent or changed: a calculation to read.
 *
 * Six notions, never mixed:
 *  - DECLARED stock      what the sheet / SKU rows say (fact);
 *  - CONFIRMED           the supplier (or Affisell for an import) said « this quantity is right » on a DATE — a fact
 *                        with an age; no confirmation = « never confirmed », the sheet's modification date is shown apart
 *                        and is NOT a confirmation;
 *  - AVAILABLE           declared minus the units RESERVED by paid, unshipped orders — subtracted ONLY when the platform
 *                        does not already deduct them at payment (`CHECKOUT_STOCK_MODE=enforce` deducts; otherwise the
 *                        declared figure still contains them). Never both, never neither;
 *  - ESTIMATED pace      units sold per day over the last 30 days, with a Poisson range — an observation of the past,
 *                        projected (HYPOTHESIS: the pace stays the same);
 *  - COVER               available ÷ pace, as a range (calculation);
 *  - LEAD TIME           the restock delay the supplier DECLARED (supply-cost register); unknown = said, and the
 *                        comparison is made with an INDICATIVE 14 days labelled as such.
 * Incoming restocks: Affisell records none (no purchase-order model) — so none is assumed, and the hypothesis says it.
 * Too little or too old data → `non_evaluable` with its reasons, never a false precision.
 */

export const FORECAST_WINDOW_DAYS = 30
export const FORECAST_MIN_UNITS = 5
export const FORECAST_MIN_SALE_DAYS = 3
export const INDICATIVE_LEAD_DAYS = 14
/** A confirmation older than this is « old »: the quantity may have changed outside Affisell. */
export const CONFIRMATION_STALE_DAYS = 30
/** Beyond this, the declared quantity is not used at all (too old to project from). */
export const CONFIRMATION_UNUSABLE_DAYS = 120

export type StockoutInput = {
  /** Sheet / SKU-row units; null = unknown (variants only in the table, non-physical). */
  declaredUnits: number | null
  /** Last explicit confirmation of the quantity (supplier « right » click, admin confirmation); null = never. */
  confirmedAt: Date | null
  /** The imported « quantity to confirm » marker is present. */
  unconfirmedMarker: boolean
  sheetUpdatedAt: Date | null
  /** Units of paid, unshipped, not-closed orders. */
  reservedUnits: number
  /** `CHECKOUT_STOCK_MODE=enforce`: the platform already took the reserved units off the declared figure. */
  reservedAlreadyDeducted: boolean
  /** Units sold per day over the last FORECAST_WINDOW_DAYS days (index 0 = oldest), paid orders only. */
  dailyUnits: ReadonlyArray<number>
  leadTimeDays: number | null
  now: Date
}

export type StockoutRisk = "sous_le_delai" | "probable" | "a_surveiller" | "suffisant" | "non_evaluable"

export type StockoutForecast = {
  facts: {
    declaredUnits: number | null
    reservedUnits: number
    reservedAlreadyDeducted: boolean
    unitsSold: number
    saleDays: number
    confirmedAt: string | null
    confirmationAgeDays: number | null
    sheetAgeDays: number | null
    leadTimeDays: number | null
  }
  calculation: {
    /** Units a buyer can still take, by the platform's real rule. */
    availableUnits: number | null
    dailyPace: number | null
    dailyPaceLow: number | null
    dailyPaceHigh: number | null
    coverDays: number | null
    /** Pessimistic (fast pace) and optimistic (slow pace) cover. */
    coverDaysLow: number | null
    coverDaysHigh: number | null
    /** Lead time compared with: the declared one, else the indicative 14 days. */
    comparedWithDays: number
    comparedWith: "declared_lead_time" | "indicative_14_days"
  }
  hypotheses: Array<"pace_constant" | "no_incoming_restock" | "lead_time_indicative">
  limits: Array<
    | "too_few_sales"
    | "sales_on_few_days"
    | "declared_unknown"
    | "never_confirmed"
    | "confirmation_old"
    | "confirmation_too_old"
    | "unconfirmed_marker"
    | "lead_time_unknown"
  >
  risk: StockoutRisk
  confidence: "high" | "medium" | "low"
  action: "restock_now" | "plan_restock" | "confirm_quantity" | "declare_lead_time" | "none"
}

const DAY = 86_400_000
const ageDays = (d: Date | null, now: Date) => (d ? Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY)) : null)
const round1 = (n: number) => Math.round(n * 10) / 10

export function forecastStockout(i: StockoutInput): StockoutForecast {
  const unitsSold = i.dailyUnits.reduce((s, u) => s + Math.max(0, u), 0)
  const saleDays = i.dailyUnits.filter((u) => u > 0).length
  const confirmationAge = ageDays(i.confirmedAt, i.now)
  const limits: StockoutForecast["limits"] = []
  const hypotheses: StockoutForecast["hypotheses"] = ["pace_constant", "no_incoming_restock"]

  if (i.declaredUnits === null) limits.push("declared_unknown")
  if (i.unconfirmedMarker) limits.push("unconfirmed_marker")
  if (confirmationAge === null) limits.push("never_confirmed")
  else if (confirmationAge > CONFIRMATION_UNUSABLE_DAYS) limits.push("confirmation_too_old")
  else if (confirmationAge > CONFIRMATION_STALE_DAYS) limits.push("confirmation_old")
  if (unitsSold < FORECAST_MIN_UNITS) limits.push("too_few_sales")
  else if (saleDays < FORECAST_MIN_SALE_DAYS) limits.push("sales_on_few_days")
  const leadKnown = typeof i.leadTimeDays === "number" && i.leadTimeDays >= 0
  if (!leadKnown) {
    limits.push("lead_time_unknown")
    hypotheses.push("lead_time_indicative")
  }
  const comparedWithDays = leadKnown ? Math.max(1, i.leadTimeDays!) : INDICATIVE_LEAD_DAYS

  const available =
    i.declaredUnits === null ? null : Math.max(0, i.declaredUnits - (i.reservedAlreadyDeducted ? 0 : Math.max(0, i.reservedUnits)))

  const facts: StockoutForecast["facts"] = {
    declaredUnits: i.declaredUnits,
    reservedUnits: i.reservedUnits,
    reservedAlreadyDeducted: i.reservedAlreadyDeducted,
    unitsSold,
    saleDays,
    confirmedAt: i.confirmedAt ? i.confirmedAt.toISOString() : null,
    confirmationAgeDays: confirmationAge,
    sheetAgeDays: ageDays(i.sheetUpdatedAt, i.now),
    leadTimeDays: leadKnown ? i.leadTimeDays : null,
  }
  const empty = {
    availableUnits: available,
    dailyPace: null,
    dailyPaceLow: null,
    dailyPaceHigh: null,
    coverDays: null,
    coverDaysLow: null,
    coverDaysHigh: null,
    comparedWithDays,
    comparedWith: leadKnown ? ("declared_lead_time" as const) : ("indicative_14_days" as const),
  }

  // Not evaluable: no usable quantity, an import never confirmed, a quantity too old, or too thin a sales history.
  const blocking =
    available === null || i.unconfirmedMarker || limits.includes("confirmation_too_old") || limits.includes("too_few_sales") || limits.includes("sales_on_few_days")
  if (blocking) {
    const action = i.unconfirmedMarker || limits.includes("confirmation_too_old") || available === null ? "confirm_quantity" : "none"
    return { facts, calculation: empty, hypotheses, limits, risk: "non_evaluable", confidence: "low", action }
  }

  const n = unitsSold
  const pace = n / FORECAST_WINDOW_DAYS
  const paceLow = Math.max(0, n - 1.96 * Math.sqrt(n)) / FORECAST_WINDOW_DAYS
  const paceHigh = (n + 1.96 * Math.sqrt(n)) / FORECAST_WINDOW_DAYS
  const cover = available! / pace
  const coverLow = available! / paceHigh
  const coverHigh = paceLow > 0 ? available! / paceLow : Number.POSITIVE_INFINITY

  // Risk: compared with the lead time. « Sous le délai » = even at the SLOW pace the stock runs out before a restock
  // could arrive; « probable » = at the observed pace; « à surveiller » = only at the fast pace.
  let risk: StockoutRisk
  if (coverHigh < comparedWithDays) risk = "sous_le_delai"
  else if (cover < comparedWithDays) risk = "probable"
  else if (coverLow < comparedWithDays) risk = "a_surveiller"
  else risk = "suffisant"

  let confidence: StockoutForecast["confidence"] = "medium"
  if (n >= 20 && i.dailyUnits.filter((u) => u > 0).length >= 7 && leadKnown && confirmationAge !== null && confirmationAge <= CONFIRMATION_STALE_DAYS) {
    confidence = "high"
  }
  if (!leadKnown || confirmationAge === null || limits.includes("confirmation_old")) confidence = "low"

  const action: StockoutForecast["action"] =
    risk === "sous_le_delai"
      ? "restock_now"
      : risk === "probable"
        ? "plan_restock"
        : risk === "a_surveiller" && !leadKnown
          ? "declare_lead_time"
          : risk === "a_surveiller" && confirmationAge === null
            ? "confirm_quantity"
            : "none"

  return {
    facts,
    calculation: {
      ...empty,
      dailyPace: round1(pace),
      dailyPaceLow: round1(paceLow),
      dailyPaceHigh: round1(paceHigh),
      coverDays: round1(cover),
      coverDaysLow: round1(coverLow),
      coverDaysHigh: Number.isFinite(coverHigh) ? round1(coverHigh) : null,
    },
    hypotheses,
    limits,
    risk,
    confidence,
    action,
  }
}

/** Only these are alerts (a calculation the supplier should act on); `a_surveiller` stays on the page. */
export function isPreventiveAlert(f: StockoutForecast): boolean {
  return f.risk === "sous_le_delai" || f.risk === "probable"
}

// ---------------------------------------------------------------------------------------------------------------
// Explicit stock confirmation (no migration): « this quantity is right », dated — never changes the quantity.
// ---------------------------------------------------------------------------------------------------------------

export const STOCK_CONFIRMATION_ACTION = "supplier.stock_confirmed_unchanged"
export function stockConfirmationId(productId: string): string {
  return `stock-confirmation:${productId}`
}
export type StockConfirmationPayload = { units: number; confirmedAt: string; by: "supplier" }

/**
 * A confirmation counts for the quantity it confirmed. It stays valid when the quantity is unchanged, or LOWER while the
 * platform deducts sales at payment (`CHECKOUT_STOCK_MODE=enforce`: a decrease is explained by sales). Any increase,
 * or a decrease the platform did not make, means someone wrote a new figure that nobody confirmed: stale.
 */
export function confirmationStillValid(
  p: StockConfirmationPayload | null,
  currentUnits: number | null,
  platformDeductsSales: boolean
): boolean {
  if (!p || currentUnits === null) return false
  if (currentUnits === p.units) return true
  return platformDeductsSales && currentUnits < p.units
}

export const STOCKOUT_RISK_ALERT_WINDOW_DAYS = 14
export function stockoutRiskAlertId(productId: string, now: Date): string {
  return `supplier-stockout-risk-alert:${productId}:${Math.floor(now.getTime() / (STOCKOUT_RISK_ALERT_WINDOW_DAYS * DAY))}`
}
export function stockoutRiskObservedId(productId: string, now: Date): string {
  return `supplier-stockout-risk-observed:${productId}:${Math.floor(now.getTime() / (STOCKOUT_RISK_ALERT_WINDOW_DAYS * DAY))}`
}

export function parseStockConfirmation(raw: unknown): StockConfirmationPayload | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.units !== "number" || !Number.isInteger(r.units) || r.units < 0) return null
  if (typeof r.confirmedAt !== "string" || Number.isNaN(Date.parse(r.confirmedAt))) return null
  return { units: r.units, confirmedAt: r.confirmedAt, by: "supplier" }
}
