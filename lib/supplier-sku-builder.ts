import { newVariantRowId, type ProductVariantLine } from "@/lib/product-variants"
import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
import { isCustomValueEmpty, labelToCustomColumnKey } from "@/lib/product-custom-columns"
import type { ProductVariantInput } from "@/lib/product-variant-sku"
import type { CustomColumnUi, VariantCustomData } from "@/types/product"

/** SKU matrix color (DB) — lettres accentuées, chiffres, espaces, - / & ' */
export const VARIANT_COLOR_REGEX = /^[\p{L}\p{N}\s\-/&'.]+$/u
export const VARIANT_COLOR_ERROR =
  "Caractères autorisés : lettres, chiffres, espaces, - / & ' (pas de virgule ni +)"

export function parseCommaList(text: string, max = 40): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[,;\n]/)) {
    const v = part.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v.slice(0, 120))
    if (out.length >= max) break
  }
  return out
}

export function slugSkuPart(value: string, maxLen: number): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .toUpperCase() || "SKU"
}

export const VARIANT_SKU_MAX_LEN = 64

/** Suggested SKU: `PRD-NOI-S` from color + size. */
export function suggestVariantSku(prefix: string, color: string, size: string | null | undefined): string {
  const base = slugSkuPart(prefix || "PRD", 8)
  const c = slugSkuPart(color, 6)
  const s = size?.trim() ? slugSkuPart(size, 6) : ""
  const raw = s ? `${base}-${c}-${s}` : `${base}-${c}`
  return raw.slice(0, VARIANT_SKU_MAX_LEN)
}

/** SKU suggestion with longer color slug (évite collisions type KJY-P02 vs KJY-P02S). */
export function suggestVariantSkuFromRow(
  prefix: string,
  color: string,
  size: string | null | undefined
): string {
  const base = slugSkuPart(prefix || "PRD", 12)
  const c = slugSkuPart(color, 14)
  const s = size?.trim() ? slugSkuPart(size, 8) : ""
  const raw = s ? `${base}-${c}-${s}` : `${base}-${c}`
  return raw.slice(0, VARIANT_SKU_MAX_LEN)
}

export type FillMissingVariantSkusResult = {
  rows: SupplierSkuTableRow[]
  /** Lignes où un SKU vide a été rempli. */
  filled: number
  /** Aperçu pour toast (max 5). */
  previews: string[]
}

/**
 * Remplit les SKU vides à partir couleur + taille ; ne modifie pas les SKU déjà saisis.
 * Garantit l’unicité dans le tableau (suffixe -02, -03… si collision).
 */
export function fillMissingVariantSkus(
  rows: SupplierSkuTableRow[],
  skuPrefix: string
): FillMissingVariantSkusResult {
  const used = new Set<string>()
  for (const r of rows) {
    const existing = r.sku?.trim()
    if (existing) used.add(existing.toLowerCase())
  }

  let filled = 0
  const previews: string[] = []

  const next = rows.map((row) => {
    if (row.sku?.trim()) return row
    const color = row.color.trim()
    if (!color) return row

    let candidate = suggestVariantSkuFromRow(skuPrefix, color, row.size)
    let seq = 2
    while (used.has(candidate.toLowerCase())) {
      const suffix = `-${String(seq).padStart(2, "0")}`
      candidate = `${candidate.slice(0, Math.max(1, VARIANT_SKU_MAX_LEN - suffix.length))}${suffix}`
      seq += 1
      if (seq > 99) break
    }

    used.add(candidate.toLowerCase())
    filled += 1
    if (previews.length < 5) previews.push(candidate)
    return { ...row, sku: candidate }
  })

  return { rows: next, filled, previews }
}

export type SkuCombination = { color: string; size: string | null }

export function buildSkuCombinations(colors: string[], sizes: string[]): SkuCombination[] {
  if (colors.length === 0) return []
  if (sizes.length === 0) return colors.map((color) => ({ color, size: null }))
  const out: SkuCombination[] = []
  for (const color of colors) {
    for (const size of sizes) {
      out.push({ color, size })
      if (out.length >= 500) return out
    }
  }
  return out
}

/** @deprecated alias — use `CustomColumnUi` */
export type SkuCustomColumnDef = CustomColumnUi

export type SkuFastColorRow = {
  id: string
  name: string
  image: string
}

export type SupplierSkuTableRow = {
  id: string
  color: string
  size: string | null
  sku: string | null
  /** Prix catalogue fournisseur (EUR) — visible par les affiliés, pas le prix client final. */
  supplierPrice: number
  /** Prix barré optionnel (EUR) — repère MSRP pour les affiliés */
  compareAtEur?: number | null
  stock: number
  commissionRate: number
  /** Photo pastille PDP pour cette couleur */
  colorImage?: string
  /** Champs personnalisés typés (DB `ProductVariant.customData`) */
  customData?: VariantCustomData
  /** @deprecated miroir listingVariants — préférer `customData` */
  customFields?: Record<string, string>
  weightGrams?: number | null
  processingDays?: number | null
  /** Durée de garantie fabricant / vendeur (mois) */
  warrantyMonths?: number | null
  ean?: string | null
  originCountry?: string | null
  warehouseCode?: string | null
  videoUrl?: string | null
}

export type SkuFastDefaults = {
  supplierPrice: number
  compareAtEur: number | null
  stock: number
  commissionRate: number
  customFieldValues: Record<string, string>
  weightGrams?: number | null
  processingDays?: number | null
  warrantyMonths?: number | null
  ean?: string | null
  originCountry?: string | null
  warehouseCode?: string | null
  videoUrl?: string | null
}

function parseLogisticsFromAttrs(attrs?: Record<string, string>): Partial<SupplierSkuTableRow> {
  if (!attrs) return {}
  const out: Partial<SupplierSkuTableRow> = {}
  const wg = attrs.weightGrams?.trim()
  if (wg && /^\d+$/.test(wg)) out.weightGrams = Math.min(30000, parseInt(wg, 10))
  const pd = attrs.processingDays?.trim()
  if (pd && /^\d+$/.test(pd)) out.processingDays = Math.min(30, parseInt(pd, 10))
  const wm = attrs.warrantyMonths?.trim()
  if (wm && /^\d+$/.test(wm)) out.warrantyMonths = Math.min(120, parseInt(wm, 10))
  const ean = attrs.ean?.trim()
  if (ean) out.ean = ean
  const oc = attrs.originCountry?.trim()
  if (oc) out.originCountry = oc.slice(0, 2).toUpperCase()
  const wh = attrs.warehouseCode?.trim()
  if (wh) out.warehouseCode = wh.slice(0, 16)
  const vid = attrs.videoUrl?.trim()
  if (vid) out.videoUrl = vid.slice(0, 2000)
  return out
}

function logisticsAttrsFromRow(row: SupplierSkuTableRow): Record<string, string> {
  const out: Record<string, string> = {}
  if (row.weightGrams != null && row.weightGrams > 0) out.weightGrams = String(row.weightGrams)
  if (row.processingDays != null && row.processingDays >= 0) {
    out.processingDays = String(row.processingDays)
  }
  if (row.warrantyMonths != null && row.warrantyMonths > 0) {
    out.warrantyMonths = String(row.warrantyMonths)
  }
  if (row.ean?.trim()) out.ean = row.ean.trim()
  if (row.originCountry?.trim()) out.originCountry = row.originCountry.trim()
  if (row.warehouseCode?.trim()) out.warehouseCode = row.warehouseCode.trim()
  if (row.videoUrl?.trim()) out.videoUrl = row.videoUrl.trim()
  return out
}

function normalizeCustomFields(
  raw: Record<string, string> | undefined,
  columnKeys: string[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of columnKeys) {
    const v = raw?.[key]
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 120)
  }
  return out
}

export function slugCustomColumnKey(label: string): string {
  return labelToCustomColumnKey(label)
}

export function rowCustomData(row: SupplierSkuTableRow): VariantCustomData {
  const out: VariantCustomData = { ...(row.customData ?? {}) }
  if (row.customFields) {
    for (const [k, v] of Object.entries(row.customFields)) {
      if (out[k] === undefined && typeof v === "string" && v.trim()) out[k] = v.trim()
    }
  }
  return out
}

export function applyColorImageToRows(
  rows: SupplierSkuTableRow[],
  color: string,
  image: string
): SupplierSkuTableRow[] {
  const want = color.trim().toLowerCase()
  if (!want) return rows
  return rows.map((r) =>
    r.color.trim().toLowerCase() === want ? { ...r, colorImage: image } : r
  )
}

export function colorImageByName(rows: SupplierSkuTableRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of rows) {
    const c = r.color.trim()
    if (!c) continue
    const img = r.colorImage?.trim()
    if (img && !map.has(c.toLowerCase())) map.set(c.toLowerCase(), img)
  }
  return map
}

export function firstRowIndexForColor(rows: SupplierSkuTableRow[], index: number): boolean {
  const color = rows[index]?.color.trim().toLowerCase()
  if (!color) return true
  return rows.findIndex((r) => r.color.trim().toLowerCase() === color) === index
}

export function generateSkuTableRows(params: {
  colorsText: string
  sizesText: string
  skuPrefix: string
  baseSupplierPrice: number
  defaultCommission: number
  defaultCompareAtEur?: number | null
  defaultStock?: number
  customColumns?: SkuCustomColumnDef[]
  customFieldValues?: Record<string, string>
}): SupplierSkuTableRow[] {
  const colors = parseCommaList(params.colorsText)
  const colorRows: SkuFastColorRow[] = colors.map((name) => ({
    id: newVariantRowId(),
    name,
    image: "",
  }))
  return generateSkuTableRowsFromSetup({
    colorRows,
    sizesText: params.sizesText,
    skuPrefix: params.skuPrefix,
    defaults: {
      supplierPrice: params.baseSupplierPrice,
      compareAtEur: params.defaultCompareAtEur ?? null,
      stock: params.defaultStock ?? 0,
      commissionRate: params.defaultCommission,
      customFieldValues: params.customFieldValues ?? {},
    },
    customColumns: params.customColumns ?? [],
  })
}

export function generateSkuTableRowsFromSetup(params: {
  colorRows: SkuFastColorRow[]
  sizesText: string
  skuPrefix: string
  defaults: SkuFastDefaults
  customColumns: SkuCustomColumnDef[]
}): SupplierSkuTableRow[] {
  const colors = params.colorRows
    .map((c) => ({ name: c.name.trim(), image: c.image.trim() }))
    .filter((c) => c.name.length > 0)
  const sizes = parseCommaList(params.sizesText)
  const combos = buildSkuCombinations(
    colors.map((c) => c.name),
    sizes
  )
  const columnKeys = params.customColumns.map((c) => c.key)
  const customFields = normalizeCustomFields(params.defaults.customFieldValues, columnKeys)
  const imageByColor = new Map(colors.map((c) => [c.name.toLowerCase(), c.image]))

  return combos.map((c) => ({
    id: newVariantRowId(),
    color: c.color,
    size: c.size,
    sku: suggestVariantSku(params.skuPrefix, c.color, c.size),
    supplierPrice: params.defaults.supplierPrice,
    compareAtEur: params.defaults.compareAtEur,
    stock: params.defaults.stock,
    commissionRate: params.defaults.commissionRate,
    colorImage: imageByColor.get(c.color.toLowerCase()) || undefined,
    customFields: { ...customFields },
    customData: Object.fromEntries(
      Object.entries(customFields).filter(([, v]) => v.length > 0)
    ),
    weightGrams: params.defaults.weightGrams ?? null,
    processingDays: params.defaults.processingDays ?? 2,
    warrantyMonths: params.defaults.warrantyMonths ?? null,
    ean: params.defaults.ean?.trim() || null,
    originCountry: params.defaults.originCountry?.trim() || "CN",
    warehouseCode: params.defaults.warehouseCode?.trim() || null,
    videoUrl: params.defaults.videoUrl?.trim() || null,
  }))
}

/** Copy custom field values from one column key to another on a SKU row. */
export function copySkuRowCustomColumnKey(
  row: SupplierSkuTableRow,
  fromKey: string,
  toKey: string
): SupplierSkuTableRow {
  const data: VariantCustomData = { ...rowCustomData(row) }
  if (fromKey in data) data[toKey] = data[fromKey]!
  else data[toKey] = ""

  const customFields = { ...(row.customFields ?? {}) }
  if (fromKey in customFields) customFields[toKey] = customFields[fromKey]!
  else customFields[toKey] = ""

  return { ...row, customData: data, customFields }
}

export function ensureRowCustomFields(
  rows: SupplierSkuTableRow[],
  columnKeys: string[]
): SupplierSkuTableRow[] {
  return rows.map((r) => {
    const data = rowCustomData(r)
    for (const key of columnKeys) {
      if (!(key in data)) data[key] = ""
    }
    const customFields = normalizeCustomFields(
      Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v : String(v)])
      ),
      columnKeys
    )
    return { ...r, customData: data, customFields }
  })
}

export type VariantRowValidationIssue = {
  index: number
  field:
    | "color"
    | "size"
    | "sku"
    | "stock"
    | "supplierPrice"
    | "compareAtEur"
    | string
  message: string
}

export function variantColorSizeKey(color: string, size: string | null | undefined): string {
  return `${color.trim().toLowerCase()}\0${(size ?? "").trim().toLowerCase()}`
}

export function validateSupplierSkuTableRows(
  rows: SupplierSkuTableRow[],
  customColumns: SkuCustomColumnDef[] = []
): VariantRowValidationIssue[] {
  const issues: VariantRowValidationIssue[] = []
  const seenKeys = new Map<string, number>()
  const seenSku = new Map<string, number>()

  rows.forEach((row, index) => {
    const color = row.color.trim()
    if (!color) {
      issues.push({ index, field: "color", message: "Couleur requise" })
    } else if (color.length > 32) {
      issues.push({ index, field: "color", message: "Couleur trop longue (32 max)" })
    } else if (!VARIANT_COLOR_REGEX.test(color)) {
      issues.push({ index, field: "color", message: VARIANT_COLOR_ERROR })
    }

    const size = row.size?.trim() ?? ""
    if (size.length > 16) {
      issues.push({ index, field: "size", message: "Taille trop longue (16 max)" })
    }

    if (row.stock < 0 || !Number.isFinite(row.stock)) {
      issues.push({ index, field: "stock", message: "Stock invalide" })
    }

    if (!Number.isFinite(row.supplierPrice) || row.supplierPrice <= 0) {
      issues.push({ index, field: "supplierPrice", message: "Votre prix EUR requis (> 0)" })
    }

    const compare = row.compareAtEur
    if (compare != null && Number.isFinite(compare) && compare > 0) {
      if (row.supplierPrice > 0 && compare < row.supplierPrice) {
        issues.push({
          index,
          field: "compareAtEur",
          message: "Prix barré ≥ votre prix",
        })
      }
    }

    if (row.weightGrams != null && row.weightGrams !== undefined) {
      const wg = row.weightGrams
      if (!Number.isFinite(wg) || wg <= 0 || wg > 30000 || !Number.isInteger(wg)) {
        issues.push({
          index,
          field: "weightGrams",
          message: "Poids : entier entre 1 et 30 000 g",
        })
      }
    }

    const ean = row.ean?.trim() ?? ""
    if (ean && !/^[0-9]{8,13}$/.test(ean)) {
      issues.push({ index, field: "ean", message: "EAN : 8 à 13 chiffres" })
    }

    if (row.processingDays != null && row.processingDays !== undefined) {
      const pd = row.processingDays
      if (!Number.isInteger(pd) || pd < 0 || pd > 30) {
        issues.push({
          index,
          field: "processingDays",
          message: "Délai : entier entre 0 et 30 jours",
        })
      }
    }

    if (row.warrantyMonths != null && row.warrantyMonths !== undefined) {
      const wm = row.warrantyMonths
      if (!Number.isInteger(wm) || wm < 0 || wm > 120) {
        issues.push({
          index,
          field: "warrantyMonths",
          message: "Garantie : entier entre 0 et 120 mois",
        })
      }
    }

    const sku = row.sku?.trim() ?? ""
    if (!sku) {
      issues.push({ index, field: "sku", message: "SKU requis" })
    } else {
      const skuKey = sku.toLowerCase()
      const prevSku = seenSku.get(skuKey)
      if (prevSku != null) {
        issues.push({
          index,
          field: "sku",
          message: `SKU « ${sku} » dupliqué (ligne ${prevSku + 1})`,
        })
      } else {
        seenSku.set(skuKey, index)
      }
    }

    if (color) {
      const key = variantColorSizeKey(color, size || null)
      const prev = seenKeys.get(key)
      if (prev != null) {
        const label = buildVariantOptionLabel(color, size || null)
        issues.push({
          index,
          field: "color",
          message: `Combinaison « ${label} » dupliquée (ligne ${prev + 1})`,
        })
      } else {
        seenKeys.set(key, index)
      }
    }

    const data = rowCustomData(row)
    for (const col of customColumns) {
      if (!col.required) continue
      if (isCustomValueEmpty(col.type, data[col.key])) {
        issues.push({
          index,
          field: col.key,
          message: `${col.label} requis`,
        })
      }
    }
  })

  return issues
}

export function skuTableRowsToProductVariantLines(
  rows: SupplierSkuTableRow[],
  productBasePriceCents: number
): ProductVariantLine[] {
  return rows.map((r) => {
    const line: ProductVariantLine = {
      id: r.id,
      name: buildVariantOptionLabel(r.color, r.size) || r.color,
      sku: (r.sku ?? "").trim(),
      priceCents:
        r.supplierPrice > 0 ? Math.round(r.supplierPrice * 100) : Math.max(0, productBasePriceCents),
      stock: Math.max(0, Math.round(r.stock)),
      commission: Math.min(100, Math.max(0, Math.round(r.commissionRate))),
      sales: 0,
    }
    const img = r.colorImage?.trim()
    if (img) line.image = img
    if (r.compareAtEur != null && r.compareAtEur > 0) {
      line.compareAtCents = Math.round(r.compareAtEur * 100)
    }
    const logistics = logisticsAttrsFromRow(r)
    const customStrings = Object.fromEntries(
      Object.entries(rowCustomData(r)).map(([k, v]) => [k, String(v)])
    )
    const attrs = { ...customStrings, ...logistics }
    if (Object.keys(attrs).length > 0) line.attrs = attrs
    return line
  })
}

export function productVariantLinesToSkuTableRows(
  lines: ProductVariantLine[],
  defaultCommission: number,
  baseSupplierPrice: number
): SupplierSkuTableRow[] {
  return lines.map((r) => {
    const { color, size } = splitVariantLineName(r.name)
    const fromAttrs = parseLogisticsFromAttrs(r.attrs)
    return {
      id: r.id,
      color,
      size,
      sku: r.sku.trim() || null,
      supplierPrice: r.priceCents > 0 ? r.priceCents / 100 : baseSupplierPrice,
      compareAtEur:
        r.compareAtCents != null && r.compareAtCents > 0 ? r.compareAtCents / 100 : null,
      stock: r.stock,
      commissionRate: r.commission || defaultCommission,
      colorImage: r.image?.trim() || undefined,
      customData: r.attrs
        ? Object.fromEntries(
            Object.entries(r.attrs).filter(
              ([k]) =>
                ![
                  "weightGrams",
                  "processingDays",
                  "warrantyMonths",
                  "ean",
                  "originCountry",
                  "warehouseCode",
                  "videoUrl",
                ].includes(k)
            )
          )
        : {},
      customFields: r.attrs ? { ...r.attrs } : {},
      weightGrams: fromAttrs.weightGrams ?? null,
      processingDays: fromAttrs.processingDays ?? 2,
      warrantyMonths: fromAttrs.warrantyMonths ?? null,
      ean: fromAttrs.ean ?? null,
      originCountry: fromAttrs.originCountry ?? "CN",
      warehouseCode: fromAttrs.warehouseCode ?? null,
      videoUrl: fromAttrs.videoUrl ?? null,
    }
  })
}

/** Strip AE / supplier prefixes like `Color: Noir` → `Noir`. */
export function stripVariantOptionTypePrefix(label: string): string {
  const trimmed = label.trim()
  const stripped = trimmed.replace(/^(color|couleur|colour|size|taille)\s*:\s*/i, "").trim()
  return stripped || trimmed
}

export function splitVariantLineName(name: string): { color: string; size: string | null } {
  const trimmed = name.trim()
  const slash = trimmed.indexOf(" / ")
  if (slash >= 0) {
    return {
      color: stripVariantOptionTypePrefix(trimmed.slice(0, slash).trim()),
      size: stripVariantOptionTypePrefix(trimmed.slice(slash + 3).trim()) || null,
    }
  }
  return { color: stripVariantOptionTypePrefix(trimmed), size: null }
}

export function apiRowsFromSkuTable(
  rows: SupplierSkuTableRow[],
  defaults: { baseSupplierPrice: number; defaultCommission: number }
): ProductVariantInput[] {
  return rows
    .filter((r) => r.color.trim())
    .sort((a, b) => {
      const pa =
        a.supplierPrice > 0 ? a.supplierPrice : Math.max(0.01, defaults.baseSupplierPrice)
      const pb =
        b.supplierPrice > 0 ? b.supplierPrice : Math.max(0.01, defaults.baseSupplierPrice)
      return pa - pb || a.color.localeCompare(b.color, undefined, { sensitivity: "base" })
    })
    .map((r) => {
      const supplierPrice =
        r.supplierPrice > 0 ? r.supplierPrice : Math.max(0.01, defaults.baseSupplierPrice)
      return {
      id: r.id.startsWith("new-") ? undefined : r.id,
      color: r.color.trim(),
      size: r.size?.trim() ? r.size.trim() : null,
      sku: (r.sku?.trim() || suggestVariantSku("PRD", r.color, r.size)).slice(0, 64),
      supplierPrice,
      publicPrice: supplierPrice,
      stock: Math.max(0, Math.round(r.stock)),
      commissionRate: Math.min(
        100,
        Math.max(0, Math.round(r.commissionRate || defaults.defaultCommission))
      ),
      weightGrams: r.weightGrams ?? null,
      processingDays: r.processingDays ?? null,
      ean: r.ean?.trim() || null,
      originCountry: r.originCountry?.trim() || null,
      warehouseCode: r.warehouseCode?.trim() || null,
      videoUrl: r.videoUrl?.trim() || null,
      customData: (() => {
        const d: VariantCustomData = { ...rowCustomData(r) }
        if (r.warrantyMonths != null && r.warrantyMonths > 0) {
          d.warrantyMonths = r.warrantyMonths
        }
        return Object.keys(d).length > 0 ? d : undefined
      })(),
    }
    })
}

export function sumSkuTableStock(rows: SupplierSkuTableRow[]): number {
  return rows.reduce((acc, r) => acc + Math.max(0, Math.round(r.stock) || 0), 0)
}

export function skuTableRowFromApiVariant(row: {
  id?: string
  color: string | null
  size: string | null
  sku: string | null
  supplierPrice: number
  publicPrice?: number
  stock: number
  commissionRate?: number
  weightGrams?: number | null
  processingDays?: number | null
  ean?: string | null
  originCountry?: string | null
  warehouseCode?: string | null
  videoUrl?: string | null
  customData?: VariantCustomData | null
}): SupplierSkuTableRow {
  const supplier = Number(row.supplierPrice) || Number(row.publicPrice) || 0
  const customDataRaw =
    row.customData && Object.keys(row.customData).length > 0 ? { ...row.customData } : undefined
  let warrantyMonths: number | null = null
  if (customDataRaw?.warrantyMonths != null) {
    const wm = customDataRaw.warrantyMonths
    if (typeof wm === "number" && Number.isFinite(wm)) {
      warrantyMonths = Math.min(120, Math.max(0, Math.round(wm)))
    } else if (typeof wm === "string" && /^\d+$/.test(wm.trim())) {
      warrantyMonths = Math.min(120, parseInt(wm.trim(), 10))
    }
    delete customDataRaw.warrantyMonths
  }
  const customData =
    customDataRaw && Object.keys(customDataRaw).length > 0 ? customDataRaw : undefined
  return {
    id: row.id?.trim() ? row.id.trim() : newVariantRowId(),
    color: row.color?.trim() ?? "",
    size: row.size?.trim() ? row.size.trim() : null,
    sku: row.sku?.trim() ? row.sku.trim() : null,
    supplierPrice: supplier,
    stock: Math.max(0, Math.round(row.stock) || 0),
    commissionRate: Math.min(100, Math.max(0, Math.round(row.commissionRate ?? 10))),
    compareAtEur: null,
    customData,
    customFields: customData
      ? Object.fromEntries(Object.entries(customData).map(([k, v]) => [k, String(v)]))
      : {},
    weightGrams: row.weightGrams ?? null,
    processingDays: row.processingDays ?? 2,
    warrantyMonths,
    ean: row.ean?.trim() || null,
    originCountry: row.originCountry?.trim() || "CN",
    warehouseCode: row.warehouseCode?.trim() || null,
    videoUrl: row.videoUrl?.trim() || null,
  }
}
