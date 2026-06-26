import "server-only"

import { prisma } from "@/lib/prisma"
import {
  normalizeSupplierBulkDeleteDraftIds,
  type SupplierBulkDeleteDraftsResult,
} from "@/lib/supplier-delete-drafts-shared"

/** Delete supplier drafts only — idempotent per id; skips non-drafts and products with orders. */
export async function bulkDeleteSupplierDrafts(
  supplierId: string,
  rawIds: unknown
): Promise<SupplierBulkDeleteDraftsResult> {
  const requested = normalizeSupplierBulkDeleteDraftIds(rawIds)
  const deleted: string[] = []
  const skipped: SupplierBulkDeleteDraftsResult["skipped"] = []

  if (requested.length === 0) {
    return { deleted, skipped }
  }

  const rows = await prisma.product.findMany({
    where: {
      supplierId,
      id: { in: requested },
    },
    select: {
      id: true,
      isDraft: true,
      _count: { select: { orders: true } },
    },
  })

  const rowById = new Map(rows.map((r) => [r.id, r]))

  for (const id of requested) {
    const row = rowById.get(id)
    if (!row) {
      skipped.push({ id, reason: "not_found" })
      continue
    }
    if (!row.isDraft) {
      skipped.push({ id, reason: "not_draft" })
      continue
    }
    if (row._count.orders > 0) {
      skipped.push({ id, reason: "has_orders" })
      continue
    }

    await prisma.$transaction([
      prisma.affiliateProduct.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id, supplierId } }),
    ])
    deleted.push(id)
  }

  console.log("[supplier-bulk-delete-drafts]", {
    supplierId,
    requested: requested.length,
    deleted: deleted.length,
    skipped: skipped.length,
  })

  return { deleted, skipped }
}
