import { prisma } from "@/lib/prisma"

export async function loadAdminProductSupplierLink(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      affisellSku: true,
      aliexpressProductId: true,
      sourceUrl: true,
      variantMapping: true,
      supplierSku: true,
      supplierWholesaleCents: true,
      autoFulfill: true,
      autoBuyEnabled: true,
      hasVariants: true,
      supplierLink: {
        include: {
          variantMappings: {
            include: {
              productVariant: {
                select: { id: true, color: true, size: true, sku: true },
              },
            },
            orderBy: { aeLabel: "asc" },
          },
        },
      },
      productVariants: {
        select: { id: true, color: true, size: true, sku: true, publicPrice: true },
        orderBy: [{ color: "asc" }, { size: "asc" }],
      },
    },
  })
}

export type AdminProductSupplierLinkRow = NonNullable<
  Awaited<ReturnType<typeof loadAdminProductSupplierLink>>
>
