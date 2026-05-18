import { Prisma } from "@prisma/client"
import { z } from "zod"

import { buildVariantOptionLabel } from "@/lib/marketplace-purchase-quantity"
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
  supplierPrice: z.coerce.number().positive("Coût fournisseur doit être > 0"),
  publicPrice: z.coerce.number().positive("Prix public doit être > 0"),
  stock: z.coerce.number().int().min(0, "Stock doit être ≥ 0"),
  commissionRate: z.coerce.number().min(0).max(100).default(10),
}).refine((v) => v.publicPrice >= v.supplierPrice, {
  message: "Prix public doit être ≥ coût fournisseur",
  path: ["publicPrice"],
})

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

export function serializeProductVariantRow(row: {
  id: string
  sku: string | null
  color: string | null
  size: string | null
  supplierPrice: Prisma.Decimal
  publicPrice: Prisma.Decimal
  stock: number
}): ProductVariantApiRow {
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
    commissionRate: 10,
    margin: marginEur(supplier, pub),
  }
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

function formatZodVariantIssue(issue: z.ZodIssue, rowIndex: number): string {
  const path = issue.path.join(".")
  const label = buildVariantOptionLabel(
    typeof issue.path[0] === "number" ? undefined : undefined,
    undefined
  )
  void label
  if (path.includes("color")) {
    return `Ligne ${rowIndex + 1} — couleur : ${issue.message}`
  }
  if (path.includes("supplierPrice")) {
    return `Ligne ${rowIndex + 1} — coût : ${issue.message}`
  }
  if (path.includes("publicPrice")) {
    return `Ligne ${rowIndex + 1} — prix public : ${issue.message}`
  }
  return `Ligne ${rowIndex + 1} : ${issue.message}`
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

  if (hasVariants || normalized.rows.length > 0) {
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
    select: { id: true },
  })
  const existingIds = new Set(existing.map((e) => e.id))
  const keepIds = new Set<string>()

  for (const v of variants) {
    const data = {
      sku: v.sku,
      color: v.color,
      size: v.size,
      supplierPrice: new Prisma.Decimal(v.supplierPrice.toFixed(2)),
      publicPrice: new Prisma.Decimal(v.publicPrice.toFixed(2)),
      stock: v.stock,
    }

    if (v.id && existingIds.has(v.id)) {
      await tx.productVariant.update({ where: { id: v.id }, data })
      keepIds.add(v.id)
    } else {
      const created = await tx.productVariant.create({
        data: { productId, ...data },
      })
      keepIds.add(created.id)
    }
  }

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id))
  if (toDelete.length) {
    await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } })
  }

  const agg = await tx.productVariant.aggregate({
    where: { productId },
    _sum: { stock: true },
    _min: { publicPrice: true },
  })
  const totalStock = agg._sum.stock ?? 0
  const minPublic = agg._min.publicPrice
  const baseCents =
    minPublic != null ? Math.max(100, Math.round(Number(minPublic) * 100)) : undefined

  await tx.product.update({
    where: { id: productId },
    data: {
      stock: totalStock,
      ...(baseCents != null ? { basePriceCents: baseCents } : {}),
    },
  })
}
