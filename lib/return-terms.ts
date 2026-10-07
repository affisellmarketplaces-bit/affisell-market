/**
 * Return window a supplier OFFERS on a product — beyond the 14 days every EU consumer already has by law.
 *
 * Decisions (owner, 2026-10-07): the supplier chooses it per product and the supplier bears the cost, exactly like a
 * return inside the legal window (the refund is taken back from the supplier's share, see `supplierReturnLiabilityCents`).
 *
 * - It can only EXTEND the legal 14 days, never shorten them: below that there is no value to store.
 * - Stored as the `ProductAttribute` row `return_window_days` (never a column on `Product`: see `listing-compliance/keys.ts`).
 *   No row = the legal 14 days.
 * - Frozen on the order at purchase (`OrderReturnTerms`), so a supplier cannot shorten what a buyer already bought under.
 *
 * Client-safe (no Prisma).
 */
import { EU_WITHDRAWAL_DAYS } from "@/lib/buyer-withdrawal-window"

export const RETURN_WINDOW_KEY = "return_window_days"

export const CANONICAL_RETURN_WINDOW_LABEL = "Return window (days)"

/** The legal minimum, in days from delivery. */
export const LEGAL_RETURN_WINDOW_DAYS = EU_WITHDRAWAL_DAYS

/** Longest window a supplier can offer: beyond this a "return" is really a warranty claim, which is a different promise. */
export const MAX_RETURN_WINDOW_DAYS = 90

/** What the form proposes. The API accepts any whole number of days in between. */
export const RETURN_WINDOW_PRESETS: readonly number[] = [30, 60, 90]

/**
 * A supplier-offered window, or `null` when there is none to honour (empty, not a whole number, at or below the legal
 * 14 days, or above the maximum). Accepts what a form or a stored row hands over (number or digits-only string).
 */
export function parseReturnWindowDays(raw: unknown): number | null {
  let n: number
  if (typeof raw === "number") n = raw
  else if (typeof raw === "string" && /^\d{1,4}$/.test(raw.trim())) n = Number(raw.trim())
  else return null
  if (!Number.isInteger(n)) return null
  return n > LEGAL_RETURN_WINDOW_DAYS && n <= MAX_RETURN_WINDOW_DAYS ? n : null
}

/** Days a buyer can return in, given what was frozen on the order (`null`/undefined = nothing offered = the legal 14). */
export function effectiveReturnWindowDays(offered: number | null | undefined): number {
  return parseReturnWindowDays(offered ?? null) ?? LEGAL_RETURN_WINDOW_DAYS
}

/**
 * Keeps the `return_window_days` row honest wherever attribute rows are accepted: a value that is not a valid EXTENSION
 * is dropped (the product then simply has the legal window), a valid one is stored in its canonical form.
 */
export function sanitizeReturnWindowRows<T extends { key: string; value: string }>(rows: T[]): T[] {
  const out: T[] = []
  for (const row of rows) {
    if (row.key !== RETURN_WINDOW_KEY) {
      out.push(row)
      continue
    }
    const days = parseReturnWindowDays(row.value)
    if (days != null) out.push({ ...row, value: String(days) })
  }
  return out
}
