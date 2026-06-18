/** Parse supplier SKU / price fields — accepts `197,8` and `197.8`. */
export function parseSupplierDecimalInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
