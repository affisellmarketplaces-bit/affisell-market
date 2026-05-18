import { Prisma } from "@prisma/client"
import { z } from "zod"

const optionalDim = z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))

export const productVariantInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    sku: optionalDim,
    color: optionalDim,
    size: optionalDim,
    supplierPrice: z.coerce.number().positive("supplierPrice must be > 0"),
    publicPrice: z.coerce.number().min(0, "publicPrice must be >= 0"),
    stock: z.coerce.number().int().min(0, "stock must be >= 0"),
  })
  .refine((v) => v.publicPrice >= v.supplierPrice, {
    message: "publicPrice must be >= supplierPrice",
    path: ["publicPrice"],
  })

export const productVariantsBodySchema = z.object({
  hasVariants: z.boolean().optional(),
  variants: z.array(productVariantInputSchema).max(500).optional(),
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
    color: row.color,
    size: row.size,
    supplierPrice: supplier,
    publicPrice: pub,
    stock: row.stock,
    margin: marginEur(supplier, pub),
  }
}

export function parseProductVariantsFromBody(body: unknown): {
  hasVariants: boolean
  variants: ProductVariantInput[]
} | { error: string; issues?: z.ZodIssue[] } {
  const parsed = productVariantsBodySchema.safeParse(body)
  if (!parsed.success) {
    return { error: "Invalid variants payload", issues: parsed.error.issues }
  }
  const hasVariants = Boolean(parsed.data.hasVariants)
  const variants = parsed.data.variants ?? []
  if (hasVariants && variants.length === 0) {
    return { error: "At least one variant is required when hasVariants is true" }
  }
  if (hasVariants) {
    const full = z.array(productVariantInputSchema).min(1).safeParse(variants)
    if (!full.success) {
      return { error: "Invalid variant rows", issues: full.error.issues }
    }
    return { hasVariants: true, variants: full.data }
  }
  return { hasVariants: false, variants: [] }
}

function variantUniqueKey(v: ProductVariantInput): string {
  return [v.color ?? "", v.size ?? "", v.sku ?? ""].join("\0")
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

  const keys = new Set<string>()
  for (const v of variants) {
    const k = variantUniqueKey(v)
    if (keys.has(k)) {
      throw new Error("Duplicate variant (same color, size, and SKU)")
    }
    keys.add(k)
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
