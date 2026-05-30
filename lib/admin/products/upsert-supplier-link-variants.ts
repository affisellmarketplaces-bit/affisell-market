import type { PrismaClient } from "@prisma/client"

import type { AdminVariantMappingInput } from "@/lib/admin/products/supplier-link-variant-types"
import { canonicalVariantColorKey } from "@/lib/fulfillment/variant-color-match"

export async function replaceSupplierLinkVariants(
  prisma: PrismaClient,
  supplierLinkId: string,
  mappings: AdminVariantMappingInput[]
): Promise<void> {
  const valid = mappings.filter((m) => m.aeSkuId.trim().length > 0)

  await prisma.$transaction(async (tx) => {
    await tx.supplierLinkVariant.deleteMany({ where: { supplierLinkId } })

    if (valid.length === 0) return

    await tx.supplierLinkVariant.createMany({
      data: valid.map((m) => ({
        supplierLinkId,
        productVariantId: m.productVariantId?.trim() || null,
        matchColor: m.matchColor?.trim()
          ? canonicalVariantColorKey(m.matchColor)
          : null,
        matchSize: m.matchSize?.trim() || null,
        aeSkuId: m.aeSkuId.trim(),
        aePriceCents: Math.max(0, Math.round(m.aePriceCents)),
        aeShippingCents: Math.max(0, Math.round(m.aeShippingCents ?? 0)),
        aeLabel: m.aeLabel?.trim() || null,
      })),
    })
  })
}
