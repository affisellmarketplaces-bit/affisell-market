/**
 * Stock cover and restock quantity for a supplier — pure, client-safe (founder briefs 2026-11-19).
 *
 * Four notions, never mixed:
 *  - DECLARED stock: what the product sheet says (`Product.stock` or the sum of its SKU rows) — the supplier's statement;
 *  - CONFIRMED: the declared figure was typed by the supplier (no `stock_unconfirmed` marker left by an import);
 *  - RESERVED: units of paid orders not yet shipped. Whether they are already deducted from the declared figure depends
 *    on the platform's stock mode (`CHECKOUT_STOCK_MODE=enforce` deducts at payment; otherwise Affisell deducts nothing
 *    and the supplier may or may not have) — so both readings are shown, never one chosen silently;
 *  - COVER: a CALCULATION at the pace of the last 30 days — never a forecast. Judged only with enough units sold.
 *
 * Nothing is invented: an unknown lead time is « not declared », a sheet not updated for long is said, a thin pace is
 * « not judged ». The restock quantity is a calculation to READ: it is never pre-filled and never applied.
 */

/** Indicative signal kept by the founder (2026-11-19): fewer days of cover than this is worth a look. */
export const STOCK_COVER_DAYS = 14
/** Below this many units sold in 30 days, one order moves the pace too much to say anything. */
export const STOCK_COVER_MIN_UNITS = 5
/** A declared quantity whose sheet was not touched for longer than this is said to be possibly stale. */
export const STALE_SHEET_DAYS = 30
/** Cover the restock calculation aims at AFTER the lead time — a reading aid, not a recommendation of stock policy. */
export const RESTOCK_TARGET_DAYS = 30
const PACE_WINDOW_DAYS = 30
const DAY = 86_400_000

export type StockPositionInput = {
  /** Declared units (product stock or SKU rows); null when unknown (variants only in the table, unreadable rows). */
  declaredUnits: number | null
  /** The declared figure was confirmed by the supplier (no import marker). */
  confirmed: boolean
  /** Units of paid, not shipped, not closed orders. */
  pendingUnits: number
  /** True when the platform deducted those units at payment (`CHECKOUT_STOCK_MODE=enforce`). */
  pendingDeductedByPlatform: boolean
  /** Units sold on paid orders in the last 30 days. */
  units30d: number
  /** Lead time the supplier DECLARED (supply-cost declaration in force); null = not declared. */
  leadTimeDays: number | null
  /** Last modification of the product sheet (any field: it is NOT a stock-confirmation date). */
  sheetUpdatedAt: Date | null
  now: Date
}

export type StockCover = {
  judged: boolean
  /** Why not judged (no pace, nothing declared…). */
  notJudgedReason: "unknown_declared" | "thin_pace" | "nothing_left" | null
  pacePerDay: number | null
  /** Days of cover on the declared figure. */
  daysOnDeclared: number | null
  /** Days of cover if the reserved units are still inside the declared figure (only when they may be). */
  daysIfReservedNotDeducted: number | null
  /** Threshold used: max(14, declared lead time). */
  thresholdDays: number
  short: boolean
  sheetAgeDays: number | null
  stale: boolean
}

export function stockCover(p: StockPositionInput): StockCover {
  const threshold = Math.max(STOCK_COVER_DAYS, p.leadTimeDays ?? 0)
  const sheetAgeDays = p.sheetUpdatedAt ? Math.max(0, Math.floor((p.now.getTime() - p.sheetUpdatedAt.getTime()) / DAY)) : null
  const stale = sheetAgeDays != null && sheetAgeDays > STALE_SHEET_DAYS
  const base = { thresholdDays: threshold, sheetAgeDays, stale }
  if (p.declaredUnits == null) {
    return { ...base, judged: false, notJudgedReason: "unknown_declared", pacePerDay: null, daysOnDeclared: null, daysIfReservedNotDeducted: null, short: false }
  }
  if (p.units30d < STOCK_COVER_MIN_UNITS) {
    return { ...base, judged: false, notJudgedReason: "thin_pace", pacePerDay: null, daysOnDeclared: null, daysIfReservedNotDeducted: null, short: false }
  }
  if (p.declaredUnits <= 0) {
    return { ...base, judged: false, notJudgedReason: "nothing_left", pacePerDay: null, daysOnDeclared: null, daysIfReservedNotDeducted: null, short: false }
  }
  const pace = p.units30d / PACE_WINDOW_DAYS
  const daysOnDeclared = Math.floor(p.declaredUnits / pace)
  const pending = Math.max(0, p.pendingUnits)
  const daysIfReservedNotDeducted =
    !p.pendingDeductedByPlatform && pending > 0 ? Math.floor(Math.max(0, p.declaredUnits - pending) / pace) : null
  return {
    ...base,
    judged: true,
    notJudgedReason: null,
    pacePerDay: pace,
    daysOnDeclared,
    daysIfReservedNotDeducted,
    // Judged on the declared figure (the supplier's statement); the reserved reading is shown beside it, not substituted.
    short: daysOnDeclared < threshold,
  }
}

/** Backward-compatible helper: whole days of cover at the 30-day pace, null when the pace is too thin. */
export function stockCoverDays(available: number, units30d: number | undefined): number | null {
  if (units30d == null || units30d < STOCK_COVER_MIN_UNITS || available <= 0) return null
  return Math.floor(available / (units30d / PACE_WINDOW_DAYS))
}

export type RestockCalculation = {
  /** Units sold per day at the 30-day pace. */
  pacePerDay: number
  /** Lead time used and where it comes from. */
  leadTimeDays: number
  leadTimeSource: "declared" | "not_declared"
  targetCoverDays: number
  /** Units needed to cover the lead time + the target cover at the observed pace. */
  neededUnits: number
  /** Units already counted as available (declared minus reserved when they may still be inside it). */
  availableUnits: number
  /** Central calculation (never negative). */
  suggestedUnits: number
  /** Range from the count's own uncertainty (Poisson, ≈ 95 %): the pace observed on 30 days is not exact. */
  lowUnits: number
  highUnits: number
  /** Plain lines explaining every number — shown as is. */
  explanation: Array<{ code: string; value: number }>
}

/**
 * How many units would bring the cover back to the target AFTER the lead time, at the observed pace.
 * Without a declared lead time the calculation uses 0 days and SAYS so (no invented delay). Not judged (null) with a
 * thin pace or an unknown declared stock — exactly like the cover.
 */
export function restockCalculation(p: StockPositionInput, targetCoverDays = RESTOCK_TARGET_DAYS): RestockCalculation | null {
  if (p.declaredUnits == null || p.units30d < STOCK_COVER_MIN_UNITS) return null
  const lead = p.leadTimeDays ?? 0
  const horizon = lead + targetCoverDays
  const pace = p.units30d / PACE_WINDOW_DAYS
  const pending = Math.max(0, p.pendingUnits)
  const available = Math.max(0, p.declaredUnits - (p.pendingDeductedByPlatform ? 0 : pending))
  const need = (units30d: number) => Math.ceil((units30d / PACE_WINDOW_DAYS) * horizon)
  // Poisson ≈ 95 % interval on the 30-day count, then scaled to the horizon.
  const sd = Math.sqrt(p.units30d)
  const lowCount = Math.max(0, p.units30d - 1.96 * sd)
  const highCount = p.units30d + 1.96 * sd
  const needed = need(p.units30d)
  return {
    pacePerDay: pace,
    leadTimeDays: lead,
    leadTimeSource: p.leadTimeDays == null ? "not_declared" : "declared",
    targetCoverDays,
    neededUnits: needed,
    availableUnits: available,
    suggestedUnits: Math.max(0, needed - available),
    lowUnits: Math.max(0, need(lowCount) - available),
    highUnits: Math.max(0, need(highCount) - available),
    explanation: [
      { code: "units_sold_30d", value: p.units30d },
      { code: "lead_time_days", value: lead },
      { code: "target_cover_days", value: targetCoverDays },
      { code: "needed_units", value: needed },
      { code: "available_units", value: available },
      { code: "reserved_units", value: pending },
    ],
  }
}
