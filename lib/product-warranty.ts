import { parseVariantsPayload } from "@/lib/product-variants"

export function parseWarrantyMonthsValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value)
    return n > 0 && n <= 120 ? n : null
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = parseInt(value.trim(), 10)
    return n > 0 && n <= 120 ? n : null
  }
  return null
}

function maxWarranty(current: number | null, next: number | null): number | null {
  if (next == null) return current
  if (current == null) return next
  return Math.max(current, next)
}

export function maxWarrantyMonthsFromVariantJson(variantsJson: unknown): number | null {
  const payload = parseVariantsPayload(variantsJson)
  let max: number | null = null
  for (const row of payload?.variantRows ?? []) {
    max = maxWarranty(max, parseWarrantyMonthsValue(row.attrs?.warrantyMonths))
  }
  return max
}

export function maxWarrantyMonthsFromProductVariants(
  rows: Array<{ customData?: unknown }>
): number | null {
  let max: number | null = null
  for (const row of rows) {
    const customData =
      row.customData && typeof row.customData === "object" && !Array.isArray(row.customData)
        ? (row.customData as Record<string, unknown>)
        : null
    max = maxWarranty(max, parseWarrantyMonthsValue(customData?.warrantyMonths))
  }
  return max
}

export function resolveProductWarrantyMonths(product: {
  variants?: unknown
  hasVariants?: boolean
  productVariants?: Array<{ customData?: unknown }>
}): number | null {
  const fromJson = maxWarrantyMonthsFromVariantJson(product.variants)
  const fromDb =
    product.hasVariants && product.productVariants?.length
      ? maxWarrantyMonthsFromProductVariants(product.productVariants)
      : null
  if (fromDb != null && fromJson != null) return Math.max(fromDb, fromJson)
  return fromDb ?? fromJson
}

export function formatWarrantyBadgeLabel(months: number, locale = "fr"): string {
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12
    return locale.startsWith("fr")
      ? `Garantie ${years} an${years > 1 ? "s" : ""}`
      : `${years}-year warranty`
  }
  return locale.startsWith("fr") ? `Garantie ${months} mois` : `${months}-month warranty`
}

export function listingWarrantyBadgeLabel(
  showWarranty: boolean,
  warrantyMonths: number | null,
  locale = "fr"
): string | null {
  if (!showWarranty || warrantyMonths == null || warrantyMonths <= 0) return null
  return formatWarrantyBadgeLabel(warrantyMonths, locale)
}

export function parseShowWarrantyFlag(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw
  if (raw === "true" || raw === 1 || raw === "1") return true
  if (raw === "false" || raw === 0 || raw === "0") return false
  return undefined
}
