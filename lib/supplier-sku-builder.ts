import { newVariantRowId, type ProductVariantLine } from "@/lib/product-variants"
import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
import type { ProductVariantInput } from "@/lib/product-variant-sku"

export const VARIANT_COLOR_REGEX = /^[a-zA-Z0-9\s-]+$/
export const VARIANT_COLOR_ERROR = "Pas de + ou virgule dans la couleur"

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

/** Suggested SKU: `PRD-NOI-S` from color + size. */
export function suggestVariantSku(prefix: string, color: string, size: string | null | undefined): string {
  const base = slugSkuPart(prefix || "PRD", 8)
  const c = slugSkuPart(color, 6)
  const s = size?.trim() ? slugSkuPart(size, 6) : ""
  return s ? `${base}-${c}-${s}` : `${base}-${c}`
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

export type SupplierSkuTableRow = {
  id: string
  color: string
  size: string | null
  sku: string | null
  supplierPrice: number
  publicPrice: number
  stock: number
  commissionRate: number
}

export function generateSkuTableRows(params: {
  colorsText: string
  sizesText: string
  skuPrefix: string
  baseSupplierPrice: number
  basePublicPrice: number
  defaultCommission: number
}): SupplierSkuTableRow[] {
  const colors = parseCommaList(params.colorsText)
  const sizes = parseCommaList(params.sizesText)
  const combos = buildSkuCombinations(colors, sizes)
  return combos.map((c) => ({
    id: newVariantRowId(),
    color: c.color,
    size: c.size,
    sku: suggestVariantSku(params.skuPrefix, c.color, c.size),
    supplierPrice: params.baseSupplierPrice,
    publicPrice: params.basePublicPrice,
    stock: 0,
    commissionRate: params.defaultCommission,
  }))
}

export type VariantRowValidationIssue = {
  index: number
  field: "color" | "size" | "sku" | "stock" | "supplierPrice" | "publicPrice"
  message: string
}

export function variantColorSizeKey(color: string, size: string | null | undefined): string {
  return `${color.trim().toLowerCase()}\0${(size ?? "").trim().toLowerCase()}`
}

export function validateSupplierSkuTableRows(
  rows: SupplierSkuTableRow[]
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
      issues.push({ index, field: "supplierPrice", message: "Coût EUR requis (> 0)" })
    }

    if (!Number.isFinite(row.publicPrice) || row.publicPrice <= 0) {
      issues.push({ index, field: "publicPrice", message: "Prix public requis (> 0)" })
    } else if (row.supplierPrice > 0 && row.publicPrice < row.supplierPrice) {
      issues.push({
        index,
        field: "publicPrice",
        message: "Prix public ≥ coût fournisseur",
      })
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
  })

  return issues
}

export function skuTableRowsToProductVariantLines(
  rows: SupplierSkuTableRow[],
  productBasePriceCents: number
): ProductVariantLine[] {
  return rows.map((r) => ({
    id: r.id,
    name: buildVariantOptionLabel(r.color, r.size) || r.color,
    sku: (r.sku ?? "").trim(),
    priceCents:
      r.supplierPrice > 0 ? Math.round(r.supplierPrice * 100) : Math.max(0, productBasePriceCents),
    stock: Math.max(0, Math.round(r.stock)),
    commission: Math.min(100, Math.max(0, Math.round(r.commissionRate))),
    sales: 0,
  }))
}

export function productVariantLinesToSkuTableRows(
  lines: ProductVariantLine[],
  defaultCommission: number,
  basePublicPrice: number,
  baseSupplierPrice: number
): SupplierSkuTableRow[] {
  return lines.map((r) => {
    const { color, size } = splitVariantLineName(r.name)
    return {
      id: r.id,
      color,
      size,
      sku: r.sku.trim() || null,
      supplierPrice: r.priceCents > 0 ? r.priceCents / 100 : baseSupplierPrice,
      publicPrice: basePublicPrice,
      stock: r.stock,
      commissionRate: r.commission || defaultCommission,
    }
  })
}

export function splitVariantLineName(name: string): { color: string; size: string | null } {
  const trimmed = name.trim()
  const slash = trimmed.indexOf(" / ")
  if (slash >= 0) {
    return {
      color: trimmed.slice(0, slash).trim(),
      size: trimmed.slice(slash + 3).trim() || null,
    }
  }
  return { color: trimmed, size: null }
}

export function apiRowsFromSkuTable(
  rows: SupplierSkuTableRow[],
  defaults: { baseSupplierPrice: number; basePublicPrice: number; defaultCommission: number }
): ProductVariantInput[] {
  return rows
    .filter((r) => r.color.trim())
    .map((r) => ({
      id: r.id.startsWith("new-") ? undefined : r.id,
      color: r.color.trim(),
      size: r.size?.trim() ? r.size.trim() : null,
      sku: (r.sku?.trim() || suggestVariantSku("PRD", r.color, r.size)).slice(0, 64),
      supplierPrice:
        r.supplierPrice > 0 ? r.supplierPrice : Math.max(0.01, defaults.baseSupplierPrice),
      publicPrice: r.publicPrice > 0 ? r.publicPrice : Math.max(0.01, defaults.basePublicPrice),
      stock: Math.max(0, Math.round(r.stock)),
      commissionRate: Math.min(
        100,
        Math.max(0, Math.round(r.commissionRate || defaults.defaultCommission))
      ),
    }))
}

export function sumSkuTableStock(rows: SupplierSkuTableRow[]): number {
  return rows.reduce((acc, r) => acc + Math.max(0, Math.round(r.stock) || 0), 0)
}

export function skuTableRowFromApiVariant(row: {
  id: string
  color: string | null
  size: string | null
  sku: string | null
  supplierPrice: number
  publicPrice: number
  stock: number
  commissionRate?: number
}): SupplierSkuTableRow {
  return {
    id: row.id,
    color: row.color?.trim() ?? "",
    size: row.size?.trim() ? row.size.trim() : null,
    sku: row.sku?.trim() ? row.sku.trim() : null,
    supplierPrice: Number(row.supplierPrice) || 0,
    publicPrice: Number(row.publicPrice) || 0,
    stock: Math.max(0, Math.round(row.stock) || 0),
    commissionRate: Math.min(100, Math.max(0, Math.round(row.commissionRate ?? 10))),
  }
}
