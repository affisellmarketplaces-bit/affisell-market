import { Prisma } from "@prisma/client"

import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { prisma } from "@/lib/prisma"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import type { ParsedBulkProductRow } from "@/lib/supplier-bulk-excel"
import { normalizeAffiliateCommissionRatePct } from "@/lib/supplier-commission"

export function assertParsedBulkProductRow(row: ParsedBulkProductRow): string | null {
  if (!row.name.trim()) return "Missing name"
  if (!Number.isFinite(row.priceUsd) || row.priceUsd <= 0) return "Invalid price"
  if (!row.images.length) return "Missing images"
  const comm = normalizeAffiliateCommissionRatePct(row.commissionPct, row.listingKind)
  if (!comm.ok) return comm.error
  if (row.compareAtUsd != null && row.compareAtUsd > 0) {
    const pc = Math.round(row.priceUsd * 100)
    const cc = Math.round(row.compareAtUsd * 100)
    if (cc <= pc) return "Compare-at must exceed price"
    const discountPct = ((cc - pc) / cc) * 100
    if (discountPct > 70) return "Compare-at discount over 70%"
  }
  return null
}

export async function insertBulkParsedProduct(
  supplierId: string,
  categoryId: string,
  row: ParsedBulkProductRow
): Promise<{ id: string; name: string }> {
  const err = assertParsedBulkProductRow(row)
  if (err) throw new Error(err)

  const normalizedPriceCents = Math.max(100, Math.round(row.priceUsd * 100))

  let compareAt: Prisma.Decimal | null = null
  if (row.compareAtUsd != null && row.compareAtUsd > 0) {
    const compareAtCents = Math.round(row.compareAtUsd * 100)
    if (compareAtCents > normalizedPriceCents) {
      const discountPct = ((compareAtCents - normalizedPriceCents) / compareAtCents) * 100
      if (discountPct <= 70) {
        compareAt = new Prisma.Decimal(row.compareAtUsd.toFixed(2))
      }
    }
  }

  const ship = parseSupplierProductShippingBody(row.shippingBody)
  const attr = parseProductAttributesBody({
    categories: [],
    colors: [],
    tags: ["excel-bulk"],
  })

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        supplierId,
        name: row.name,
        description: row.description,
        images: row.images,
        colorImages:
          attr.colorImages === null
            ? Prisma.DbNull
            : (attr.colorImages as unknown as Prisma.InputJsonValue),
        categories: attr.categories,
        colors: attr.colors,
        tags: attr.tags,
        variants:
          attr.variants === null
            ? Prisma.DbNull
            : (attr.variants as unknown as Prisma.InputJsonValue),
        basePriceCents: normalizedPriceCents,
        compareAt,
        commissionRate: row.commissionPct,
        listingKind: row.listingKind,
        stock: row.stock,
        active: true,
        categoryId: categoryId || null,
        shippingCountry: ship.shippingCountry,
        warehouseType: ship.warehouseType,
        warehouseCity: ship.warehouseCity,
        processingTime: ship.processingTime,
        deliveryMin: ship.deliveryMin,
        deliveryMax: ship.deliveryMax,
        shippingMethods: ship.shippingMethods,
        freeShippingThreshold: ship.freeShippingThreshold,
        shippingCost: ship.shippingCost,
        supplierTag: "excel-bulk",
      },
    })

    if (row.productAttributes.length) {
      await tx.productAttribute.createMany({
        data: row.productAttributes.map((a) => ({
          productId: created.id,
          key: a.key,
          label: a.label || a.key,
          value: a.value,
        })),
        skipDuplicates: true,
      })
    }

    return created
  })

  const supplierStore = await prisma.store.findUnique({
    where: { userId: supplierId },
    select: { id: true },
  })
  if (supplierStore) {
    try {
      await createNewDropCommunityPost({
        storeId: supplierStore.id,
        productId: product.id,
        productName: product.name,
      })
    } catch {
      /* non-fatal */
    }
  }

  return { id: product.id, name: product.name }
}
