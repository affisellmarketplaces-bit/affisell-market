import { Prisma } from "@prisma/client"

import { createNewDropCommunityPost } from "@/lib/community-new-drop"
import { scheduleProductAutoCategorization } from "@/lib/product-auto-categorize"
import { prisma } from "@/lib/prisma"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseSupplierProductShippingBody } from "@/lib/supplier-product-shipping"
import type { ParsedBulkProductRow } from "@/lib/supplier-bulk-excel"
import { normalizeAffiliateCommissionRatePct } from "@/lib/supplier-commission"
import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"

const BV = "supplier.bulkExcelValidation"

export function assertParsedBulkProductRow(
  row: ParsedBulkProductRow,
  locale: AppLocale = "en"
): string | null {
  const t = (key: string) => tMessage(locale, `${BV}.${key}`)
  if (!row.name.trim()) return t("missingNameShort")
  if (!Number.isFinite(row.priceEur) || row.priceEur <= 0) return t("invalidPriceShort")
  if (!row.images.length) return t("missingImagesShort")
  const comm = normalizeAffiliateCommissionRatePct(row.commissionPct, row.listingKind)
  if (!comm.ok) return comm.error
  if (row.compareAtEur != null && row.compareAtEur > 0) {
    const pc = Math.round(row.priceEur * 100)
    const cc = Math.round(row.compareAtEur * 100)
    if (cc <= pc) return t("compareAtMustExceedShort")
    const discountPct = ((cc - pc) / cc) * 100
    if (discountPct > 70) return t("compareAtDiscountOverShort")
  }
  return null
}

export async function insertBulkParsedProduct(
  supplierId: string,
  categoryId: string,
  row: ParsedBulkProductRow,
  source: "csv-import" | "excel-bulk" = "excel-bulk",
  locale: AppLocale = "en"
): Promise<{ id: string; name: string }> {
  const err = assertParsedBulkProductRow(row, locale)
  if (err) throw new Error(err)

  const normalizedPriceCents = Math.max(100, Math.round(row.priceEur * 100))

  let compareAt: Prisma.Decimal | null = null
  if (row.compareAtEur != null && row.compareAtEur > 0) {
    const compareAtCents = Math.round(row.compareAtEur * 100)
    if (compareAtCents > normalizedPriceCents) {
      const discountPct = ((compareAtCents - normalizedPriceCents) / compareAtCents) * 100
      if (discountPct <= 70) {
        compareAt = new Prisma.Decimal(row.compareAtEur.toFixed(2))
      }
    }
  }

  const ship = parseSupplierProductShippingBody(row.shippingBody)
  const attr = parseProductAttributesBody({
    categories: [],
    colors: [],
    tags: [source],
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
        supplierTag: source,
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

  if (!categoryId) {
    scheduleProductAutoCategorization(product.id)
  }

  return { id: product.id, name: product.name }
}
