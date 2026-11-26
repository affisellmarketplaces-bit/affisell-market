/**
 * Attribute rows the classic supplier form SENDS — one function for the save and for the live sheet check, so the
 * check never counts a value the save drops (e.g. a field of a category the supplier left). Pure, client-safe.
 *
 * Rows: the current category's fields that have a value; identity + product-safety rows (reserved keys) unless a
 * category field already carries the key; the return window only when it is a valid extension of the legal 14 days.
 */
import { CANONICAL_LABELS, LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"
import { CANONICAL_RETURN_WINDOW_LABEL, parseReturnWindowDays, RETURN_WINDOW_KEY } from "@/lib/return-terms"

export type FormProductAttribute = { key: string; label: string; value: string }

export function buildFormProductAttributes(
  categoryAttrs: ReadonlyArray<{ key: string; label: string }>,
  values: Readonly<Record<string, string | undefined>>,
): FormProductAttribute[] {
  const rows: FormProductAttribute[] = categoryAttrs
    .map((a) => ({ key: a.key, label: a.label, value: (values[a.key] ?? "").trim() }))
    .filter((row) => row.value.length > 0)
  const have = new Set(rows.map((r) => r.key))
  for (const key of LISTING_COMPLIANCE_KEYS) {
    const value = (values[key] ?? "").trim()
    if (value && !have.has(key)) rows.push({ key, label: CANONICAL_LABELS[key] ?? key, value })
  }
  const returnDays = parseReturnWindowDays(values[RETURN_WINDOW_KEY])
  if (returnDays) rows.push({ key: RETURN_WINDOW_KEY, label: CANONICAL_RETURN_WINDOW_LABEL, value: String(returnDays) })
  return rows
}
