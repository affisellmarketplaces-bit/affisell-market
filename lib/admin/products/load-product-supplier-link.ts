import { prisma } from "@/lib/prisma"

export async function loadAdminProductSupplierLink(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      aliexpressProductId: true,
      sourceUrl: true,
      autoFulfill: true,
      supplierLink: true,
    },
  })
}

export type AdminProductSupplierLinkRow = NonNullable<
  Awaited<ReturnType<typeof loadAdminProductSupplierLink>>
>
