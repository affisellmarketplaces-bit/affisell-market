import { Prisma } from "@prisma/client"
import { z } from "zod"

import { normalizeVariantCustomData } from "@/lib/product-custom-columns"
import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
import type { CustomColumn, VariantCustomData } from "@/types/product"
import {
  VARIANT_COLOR_ERROR,
  VARIANT_COLOR_REGEX,
  variantColorSizeKey,
} from "@/lib/supplier-sku-builder"

export const productVariantInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  color: z
    .string()
    .trim()
    .min(1, "Couleur requise")
    .max(32)
    .regex(VARIANT_COLOR_REGEX, VARIANT_COLOR_ERROR),
  size: z
    .string()
    .trim()
    .max(16)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  sku: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  /** Prix catalogue fournisseur (wholesale) — le prix public est fixé par l'affilié. */
  supplierPrice: z.coerce.number().positive("Votre prix (EUR) doit être > 0"),
  /** Ignoré côté fournisseur ; recopié sur supplierPrice en base pour compatibilité. */
  publicPrice: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0, "Stock doit être ≥ 0"),
  commissionRate: z.coerce.number().min(0).max(100).default(10),
  weightGrams: z
    .union([z.coerce.number().int().positive().max(30000), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  ean: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v == null || typeof v !== "string") return null
      const t = v.trim()
      return t.length > 0 ? t : null
    })
    .refine((v) => v == null || /^[0-9]{8,13}$/.test(v), {
      message: "EAN : 8 à 13 chiffres",
    }),
  processingDays: z
    .union([z.coerce.number().int().min(0).max(30), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  originCountry: z
    .string()
    .trim()
    .max(2)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  warehouseCode: z
    .string()
    .trim()
    .max(16)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  videoUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  customData: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .nullable(),
}).transform((v) => ({
  ...v,
  publicPrice: v.publicPrice ?? v.supplierPrice,
}))

export const productVariantsBodySchema = z.object({
  hasVariants: z.boolean().optional(),
  variants: z.array(z.unknown()).max(500).optional(),
})

export type ProductVariantInput = z.infer<typeof productVariantInputSchema>

export type ProductVariantApiRow = ProductVariantInput & {
  margin: number
}

export function marginEur(supplierPrice: number, publicPrice: number): number {
  return Math.round((publicPrice - supplierPrice) * 100) / 100
}

export function serializeProductVariantRow(
  row: {
    id: string
    sku: string | null
    color: string | null
    size: string | null
    supplierPrice: Prisma.Decimal
    publicPrice: Prisma.Decimal
    stock: number
    weightGrams?: number | null
    processingDays?: number | null
    ean?: string | null
    originCountry?: string | null
    warehouseCode?: string | null
    videoUrl?: string | null
    customData?: unknown
  },
  defaultCommissionRate = 10
): ProductVariantApiRow {
  const supplier = Number(row.supplierPrice)
  const pub = Number(row.publicPrice)
  return {
    id: row.id,
    sku: row.sku,
    color: row.color ?? "",
    size: row.size,
    supplierPrice: supplier,
    publicPrice: pub,
    stock: row.stock,
    commissionRate: defaultCommissionRate,
    margin: marginEur(supplier, pub),
    weightGrams: row.weightGrams ?? null,
    processingDays: row.processingDays ?? null,
    ean: row.ean ?? null,
    originCountry: row.originCountry ?? null,
    warehouseCode: row.warehouseCode ?? null,
    videoUrl: row.videoUrl ?? null,
    customData: parseVariantCustomDataFromDb(row.customData),
  }
}

export function parseVariantCustomDataFromDb(json: unknown): VariantCustomData | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null
  const out: VariantCustomData = {}
  for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

export function customDataToPrismaJson(
  data: VariantCustomData | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!data || Object.keys(data).length === 0) return Prisma.DbNull
  return data as Prisma.InputJsonValue
}

export function applyCustomColumnsToVariantRows(
  rows: ProductVariantInput[],
  columns: CustomColumn[],
  rawRows: unknown[]
): ProductVariantInput[] {
  if (columns.length === 0) return rows
  return rows.map((row, i) => {
    const raw = rawRows[i]
    const source =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>).customData ??
          (raw as Record<string, unknown>).customFields
        : undefined
    const customData = normalizeVariantCustomData(columns, source ?? row.customData)
    return {
      ...row,
      customData: Object.keys(customData).length > 0 ? customData : undefined,
    }
  })
}

/** SKU matrix payload: `variants` is an array, or `hasVariants` is set explicitly. */
export function isSkuVariantsSyncBody(body: Record<string, unknown>): boolean {
  if ("hasVariants" in body) return true
  return Array.isArray(body.variants)
}

function rawSkuVariantRows(body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.variants)) return body.variants
  if (Array.isArray(body.skuVariants)) return body.skuVariants
  return []
}

export function formatVariantValidationErrors(
  issues: z.ZodIssue[],
  rows: unknown[]
): string {
  if (issues.length === 0) return "Variantes invalides"
  const first = issues[0]!
  const rowIdx =
    typeof first.path[0] === "number" ? (first.path[0] as number) : 0
  const row = rows[rowIdx]
  const color =
    row && typeof row === "object" && row !== null && "color" in row
      ? String((row as { color?: unknown }).color ?? "").trim()
      : ""
  const size =
    row && typeof row === "object" && row !== null && "size" in row
      ? String((row as { size?: unknown }).size ?? "").trim()
      : ""
  const combo = buildVariantOptionLabel(color, size || null) || `ligne ${rowIdx + 1}`
  if (first.message.includes("dupliqu")) return first.message
  if (first.code === "custom" && first.message.includes("dupliqu")) return first.message
  return `${combo} : ${first.message}`
}

export function normalizeProductVariantRows(
  rawRows: unknown[]
): { rows: ProductVariantInput[] } | { error: string; issues?: z.ZodIssue[] } {
  const cleaned: Record<string, unknown>[] = []

  for (const raw of rawRows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const r = raw as Record<string, unknown>
    const color = typeof r.color === "string" ? r.color.trim() : ""
    const size = typeof r.size === "string" ? r.size.trim() : ""
    const sku = typeof r.sku === "string" ? r.sku.trim() : ""
    if (!color && !size && !sku && r.stock == null && r.supplierPrice == null) continue
    if (!color) continue

    cleaned.push({
      ...r,
      color,
      size: size || null,
      sku: sku || null,
    })
  }

  const parsedRows: ProductVariantInput[] = []
  const issues: z.ZodIssue[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const row = cleaned[i]!
    const parsed = productVariantInputSchema.safeParse(row)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          ...issue,
          path: [i, ...issue.path],
        })
      }
      continue
    }
    parsedRows.push(parsed.data)
  }

  if (issues.length > 0) {
    return {
      error: formatVariantValidationErrors(issues, cleaned),
      issues,
    }
  }

  const deduped: ProductVariantInput[] = []
  const seen = new Map<string, number>()

  for (let i = 0; i < parsedRows.length; i++) {
    const v = parsedRows[i]!
    const key = variantColorSizeKey(v.color, v.size)
    const prev = seen.get(key)
    if (prev != null) {
      const label = buildVariantOptionLabel(v.color, v.size)
      return {
        error: `SKU ${label} dupliqué ligne ${prev + 1}`,
        issues: [
          {
            code: "custom",
            message: `SKU ${label} dupliqué ligne ${prev + 1}`,
            path: [i, "color"],
          },
        ],
      }
    }
    seen.set(key, i)
    deduped.push(v)
  }

  return { rows: deduped }
}

export function parseProductVariantsFromBody(body: unknown): {
  hasVariants: boolean
  variants: ProductVariantInput[]
} | { error: string; issues?: z.ZodIssue[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Corps de requête invalide" }
  }
  const record = body as Record<string, unknown>

  if (!isSkuVariantsSyncBody(record)) {
    return { hasVariants: false, variants: [] }
  }

  const envelope = productVariantsBodySchema.safeParse({
    hasVariants: record.hasVariants,
    variants: rawSkuVariantRows(record),
  })
  if (!envelope.success) {
    return { error: "Format des variantes invalide", issues: envelope.error.issues }
  }

  const hasVariants = Boolean(envelope.data.hasVariants)
  const rawList = envelope.data.variants ?? []

  if (!hasVariants && rawList.length === 0) {
    return { hasVariants: false, variants: [] }
  }

  const normalized = normalizeProductVariantRows(rawList)
  if ("error" in normalized) {
    return normalized
  }

  if (hasVariants && normalized.rows.length === 0) {
    return { error: "Au moins une variante SKU est requise lorsque les déclinaisons sont activées" }
  }

  if (hasVariants) {
    return { hasVariants: true, variants: normalized.rows }
  }

  return { hasVariants: false, variants: [] }
}

export async function syncProductVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  hasVariants: boolean,
  variants: ProductVariantInput[]
): Promise<void> {
  await tx.product.update({
    where: { id: productId },
    data: { hasVariants },
  })

  if (!hasVariants) {
    await tx.productVariant.deleteMany({ where: { productId } })
    return
  }

  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, color: true, size: true, sku: true },
  })
  const existingIds = new Set(existing.map((e) => e.id))
  const idByCompositeKey = new Map(
    existing.map((e) => {
      const key = variantCompositeKey(e.color, e.size, e.sku)
      return [key, e.id] as const
    })
  )
  const keepIds = new Set<string>()

  for (const v of variants) {
    const data = {
      sku: v.sku,
      color: v.color,
      size: v.size,
      supplierPrice: new Prisma.Decimal(v.supplierPrice.toFixed(2)),
      publicPrice: new Prisma.Decimal(v.supplierPrice.toFixed(2)),
      stock: v.stock,
      weightGrams: v.weightGrams ?? null,
      processingDays: v.processingDays ?? 2,
      ean: v.ean ?? null,
      originCountry: v.originCountry ?? "CN",
      warehouseCode: v.warehouseCode ?? null,
      videoUrl: v.videoUrl ?? null,
      customData: customDataToPrismaJson(v.customData ?? null),
    }

    const compositeKey = variantCompositeKey(v.color, v.size, v.sku)
    const matchedId =
      (v.id && existingIds.has(v.id) ? v.id : undefined) ?? idByCompositeKey.get(compositeKey)

    if (matchedId) {
      await tx.productVariant.update({ where: { id: matchedId }, data })
      keepIds.add(matchedId)
      // Prevent a later row with the same composite from creating a duplicate.
      idByCompositeKey.set(compositeKey, matchedId)
    } else {
      const created = await tx.productVariant.create({
        data: { productId, ...data },
      })
      keepIds.add(created.id)
      idByCompositeKey.set(compositeKey, created.id)
    }
  }

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id))
  if (toDelete.length) {
    await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } })
  }

  const agg = await tx.productVariant.aggregate({
    where: { productId },
    _sum: { stock: true },
    _min: { supplierPrice: true },
  })
  const totalStock = agg._sum.stock ?? 0
  const minSupplier = agg._min.supplierPrice
  const baseCents =
    minSupplier != null ? Math.max(100, Math.round(Number(minSupplier) * 100)) : undefined

  await tx.product.update({
    where: { id: productId },
    data: {
      stock: totalStock,
      ...(baseCents != null ? { basePriceCents: baseCents } : {}),
    },
  })
}

function variantCompositeKey(
  color: string | null | undefined,
  size: string | null | undefined,
  sku: string | null | undefined
): string {
  return `${(color ?? "").trim().toLowerCase()}\0${(size ?? "").trim().toLowerCase()}\0${(sku ?? "").trim().toLowerCase()}`
}
