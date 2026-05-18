/** Optional SKU table / fast-panel columns the supplier can hide. */
export const SKU_OPTIONAL_COLUMN_KEYS = [
  "photo",
  "size",
  "compareAt",
  "stock",
  "commission",
  "margin",
] as const

export type SkuOptionalColumnKey = (typeof SKU_OPTIONAL_COLUMN_KEYS)[number]

const KEY_SET = new Set<string>(SKU_OPTIONAL_COLUMN_KEYS)

export const SKU_OPTIONAL_COLUMN_LABELS: Record<SkuOptionalColumnKey, string> = {
  photo: "Photo couleur",
  size: "Taille",
  compareAt: "Prix barré",
  stock: "Stock",
  commission: "Commission %",
  margin: "Marge",
}

export function isSkuOptionalColumnKey(v: string): v is SkuOptionalColumnKey {
  return KEY_SET.has(v)
}

export function parseSkuHiddenColumns(raw: unknown): SkuOptionalColumnKey[] {
  if (!Array.isArray(raw)) return []
  const out: SkuOptionalColumnKey[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== "string" || !isSkuOptionalColumnKey(item) || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

export function isSkuColumnVisible(
  hidden: readonly SkuOptionalColumnKey[],
  key: SkuOptionalColumnKey
): boolean {
  return !hidden.includes(key)
}

export function toggleSkuHiddenColumn(
  hidden: SkuOptionalColumnKey[],
  key: SkuOptionalColumnKey
): SkuOptionalColumnKey[] {
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]
}
