import { normalizeVariantCustomData, parseCustomColumnsFromDb } from "@/lib/product-custom-columns"
import { variantColorsMatch } from "@/lib/fulfillment/variant-color-match"
import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
import type { CustomColumn } from "@/types/product"
import {
  findVariantRowByOptionName,
  type ProductVariantLine,
  type ProductVariantsJson,
  resolveMarketplaceOptionNames,
} from "@/lib/product-variants"
import { splitVariantLineName } from "@/lib/supplier-sku-builder"

const STORAGE_KEY_RE =
  /(?:^|_)(storage|stockage|capacite|capacity|memoire|memory|rom|ssd|carte_sd)(?:_|$)/i
const STORAGE_LABEL_RE =
  /stockage|storage|capacit|mémoire|memoire|memory|\bgo\b|\bgb\b|\btb\b|carte\s*sd/i

export function isStorageCustomColumn(col: { key: string; label: string }): boolean {
  return STORAGE_KEY_RE.test(col.key) || STORAGE_LABEL_RE.test(col.label)
}

export function resolveStorageColumn(
  customColumns: CustomColumn[],
  skuMeta?: { key: string; label: string }[]
): CustomColumn | { key: string; label: string } | null {
  for (const col of customColumns) {
    if (isStorageCustomColumn(col)) return col
  }
  for (const col of skuMeta ?? []) {
    if (isStorageCustomColumn(col)) return col
  }
  return null
}

function storageSortKey(value: string): number {
  const m = value.match(/(\d+(?:[.,]\d+)?)\s*(go|gb|to|tb|mo|mb)/i)
  if (!m) return Number.MAX_SAFE_INTEGER
  const n = Number(m[1].replace(",", "."))
  const unit = m[2].toLowerCase()
  const mult =
    unit === "to" || unit === "tb" ? 1024 * 1024 : unit === "go" || unit === "gb" ? 1024 : unit === "mo" || unit === "mb" ? 1 : 1024
  return n * mult
}

export function sortStorageOptionValues(values: string[]): string[] {
  return [...values].sort((a, b) => storageSortKey(a) - storageSortKey(b) || a.localeCompare(b, "fr"))
}

export function collectStorageOptionValues(args: {
  variants: ProductVariantsJson | null
  customColumns: CustomColumn[]
  productVariantCustomData?: unknown[]
}): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (v: string) => {
    const t = v.trim()
    if (!t) return
    const k = t.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(t)
  }

  for (const s of args.variants?.storage ?? []) {
    push(s)
  }

  const storageCol = resolveStorageColumn(
    args.customColumns,
    args.variants?.skuCustomColumns
  )
  if (storageCol && "options" in storageCol && storageCol.options?.length) {
    for (const o of storageCol.options) push(o)
  }

  const storageKey = storageCol?.key
  if (storageKey) {
    for (const row of args.variants?.variantRows ?? []) {
      const raw = row.attrs?.[storageKey]
      if (raw != null && String(raw).trim()) push(String(raw))
    }
    for (const json of args.productVariantCustomData ?? []) {
      const data = normalizeVariantCustomData(args.customColumns, json)
      const raw = data[storageKey]
      if (raw != null && String(raw).trim()) push(String(raw))
    }
  }

  return sortStorageOptionValues(out)
}

/** Primary PDP pills (excludes values that belong to the storage dimension). */
export function resolveMarketplacePrimaryOptionNames(
  productColors: string[],
  variants: ProductVariantsJson | null,
  storageOptions: string[]
): string[] {
  const storageSet = new Set(storageOptions.map((s) => s.trim().toLowerCase()).filter(Boolean))
  const base = resolveMarketplaceOptionNames(productColors, variants)
  const filtered = base.filter((n) => !storageSet.has(n.trim().toLowerCase()))
  return filtered.length > 0 ? filtered : base
}

export type ShopperVariantSelection = {
  selectedPrimary: string | null | undefined
  selectedStorage: string | null | undefined
  selectedSize: string | null | undefined
}

export function findVariantRowForShopperSelection(args: {
  variants: ProductVariantsJson | null
  customColumns: CustomColumn[]
  selection: ShopperVariantSelection
}): ProductVariantLine | undefined {
  const rows = args.variants?.variantRows ?? []
  if (rows.length === 0) return undefined

  const storageCol = resolveStorageColumn(
    args.customColumns,
    args.variants?.skuCustomColumns
  )
  const storageKey = storageCol?.key
  const wantStorage = args.selection.selectedStorage?.trim() ?? ""

  if (!storageKey && !wantStorage) {
    const label = buildVariantOptionLabel(
      args.selection.selectedPrimary,
      args.selection.selectedSize
    )
    return findVariantRowByOptionName(args.variants, label || args.selection.selectedPrimary)
  }

  const primary = args.selection.selectedPrimary?.trim() ?? ""
  const wantSize = args.selection.selectedSize?.trim() ?? ""

  const matched = rows.filter((row) => {
    const { color, size } = splitVariantLineName(row.name)
    const nameLower = row.name.trim().toLowerCase()
    const primaryLower = primary.toLowerCase()

    const primaryMatch =
      !primary ||
      nameLower === primaryLower ||
      color.toLowerCase() === primaryLower ||
      variantColorsMatch(color, primary) ||
      nameLower.startsWith(`${primaryLower} /`) ||
      nameLower.endsWith(`: ${primaryLower}`) ||
      nameLower.includes(`: ${primaryLower} /`)

    const sizeMatch = !wantSize || size === wantSize

    let storageMatch = true
    if (wantStorage) {
      if (storageKey) {
        const val = row.attrs?.[storageKey]
        storageMatch = String(val ?? "")
          .trim()
          .toLowerCase() === wantStorage.toLowerCase()
      } else {
        storageMatch = nameLower.includes(wantStorage.toLowerCase())
      }
    }

    return primaryMatch && sizeMatch && storageMatch
  })

  if (matched.length === 1) return matched[0]
  if (matched.length > 1) {
    return matched.find((r) => r.stock > 0) ?? matched[0]
  }

  if (primary) {
    return findVariantRowByOptionName(args.variants, primary)
  }
  return undefined
}

/** Build `variantRows` mirror from `ProductVariant` DB lines when JSON rows are absent. */
export function variantsWithProductVariantRows(
  variants: ProductVariantsJson | null,
  productVariants: Array<{
    id: string
    color: string | null
    size: string | null
    stock: number
    supplierPrice: unknown
    customData?: unknown
  }>,
  customColumns: CustomColumn[],
  basePriceCents: number
): ProductVariantsJson | null {
  if (variants?.variantRows?.length) return variants
  if (productVariants.length === 0) return variants

  const cols = customColumns.length ? customColumns : parseCustomColumnsFromDb(null)
  const storageCol = resolveStorageColumn(cols, variants?.skuCustomColumns)
  const storageKey = storageCol?.key

  const variantRows: ProductVariantLine[] = productVariants.map((v) => {
    const data = normalizeVariantCustomData(cols, v.customData)
    const storageVal =
      storageKey && data[storageKey] != null ? String(data[storageKey]).trim() : ""
    const colorPart = v.color?.trim() ?? ""
    const sizePart = v.size?.trim() ?? ""
    let name = buildVariantOptionLabel(colorPart || null, sizePart || null)
    if (!name && storageVal) name = storageVal
    if (!name) name = "Default"

    const supplier = Number(v.supplierPrice)
    const priceCents =
      Number.isFinite(supplier) && supplier > 0
        ? Math.round(supplier * 100)
        : Math.max(0, basePriceCents)

    const attrs: Record<string, string> = {}
    for (const [k, val] of Object.entries(data)) {
      if (val != null && String(val).trim()) attrs[k] = String(val).trim()
    }

    return {
      id: v.id,
      name,
      sku: "",
      priceCents,
      stock: Math.max(0, Math.round(v.stock) || 0),
      commission: 15,
      sales: 0,
      ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    }
  })

  return {
    ...(variants ?? {}),
    variantRows,
  }
}
