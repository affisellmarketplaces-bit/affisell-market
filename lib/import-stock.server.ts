import "server-only"

import { prisma } from "@/lib/prisma"
import { MAX_IMPORTED_STOCK, STOCK_UNCONFIRMED_KEY, sourceQuantity } from "@/lib/import-stock"

export type ConfirmStockOutcome =
  | { ok: true; stock: number }
  | { ok: false; error: "not_found" | "not_unconfirmed" | "has_variant_rows" | "invalid_stock" | "invalid_note" }

/**
 * An authorised ADMIN confirms the quantity of an imported product whose source gave none (founder decision
 * 2026-11-19: supplier or authorised admin validation before it can be sold). Only products that still carry the
 * marker; products with SKU rows are confirmed row by row in the product form. Writes the stock, lifts the marker and
 * leaves an `AuditLog` `product.stock_confirmed` (who, the quantity, the previous value, why) — in one transaction.
 * Publishing stays a separate, explicit step.
 */
export async function confirmImportedStock(args: {
  productId: string
  adminId: string
  stock: unknown
  note: unknown
}): Promise<ConfirmStockOutcome> {
  const stock = typeof args.stock === "number" || typeof args.stock === "string" ? sourceQuantity(args.stock) : null
  if (stock == null || stock > MAX_IMPORTED_STOCK || !Number.isInteger(Number(args.stock))) {
    return { ok: false, error: "invalid_stock" }
  }
  const note = typeof args.note === "string" ? args.note.trim().slice(0, 1000) : ""
  if (note.length < 3) return { ok: false, error: "invalid_note" }

  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    select: {
      id: true,
      stock: true,
      hasVariants: true,
      variants: true,
      attributes: { where: { key: STOCK_UNCONFIRMED_KEY }, select: { id: true } },
    },
  })
  if (!product) return { ok: false, error: "not_found" }
  if (product.attributes.length === 0) return { ok: false, error: "not_unconfirmed" }
  const rows = (product.variants as { variantRows?: unknown[] } | null)?.variantRows
  if (product.hasVariants || (Array.isArray(rows) && rows.length > 0)) return { ok: false, error: "has_variant_rows" }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { stock } })
    await tx.productAttribute.deleteMany({ where: { productId: product.id, key: STOCK_UNCONFIRMED_KEY } })
    await tx.auditLog.create({
      data: {
        action: "product.stock_confirmed",
        entityType: "Product",
        entityId: product.id,
        actorId: args.adminId,
        payload: { stock, previousStock: product.stock, note, by: "admin" },
      },
    })
  })
  return { ok: true, stock }
}
