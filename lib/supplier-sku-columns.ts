/** Optional SKU table / fast-panel columns the supplier can hide. */
export const SKU_OPTIONAL_COLUMN_KEYS = [
  "photo",
  "size",
  "supplierPrice",
  "sku",
  "compareAt",
  "stock",
  "commission",
  "weightGrams",
  "ean",
  "processingDays",
  "originCountry",
  "warehouseCode",
  "videoUrl",
  /** UI-only: calculated affiliate commission per sale */
  "affiliateMargin",
] as const

export type SkuOptionalColumnKey = (typeof SKU_OPTIONAL_COLUMN_KEYS)[number]

const KEY_SET = new Set<string>(SKU_OPTIONAL_COLUMN_KEYS)

export const SKU_OPTIONAL_COLUMN_LABELS: Record<SkuOptionalColumnKey, string> = {
  photo: "Photo couleur",
  size: "Taille",
  supplierPrice: "Votre prix",
  sku: "SKU",
  compareAt: "Prix barré",
  stock: "Stock",
  commission: "Commission %",
  weightGrams: "Poids (g)",
  ean: "EAN",
  processingDays: "Délai (j)",
  originCountry: "Pays origine",
  warehouseCode: "Entrepôt",
  videoUrl: "Lien vidéo",
  affiliateMargin: "Marge affilié EUR",
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
