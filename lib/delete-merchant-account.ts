import { prisma } from "@/lib/prisma"

export type DeleteMerchantAccountResult =
  | { ok: true }
  | { ok: false; code: "HAS_ORDERS" | "NOT_MERCHANT" | "USER_NOT_FOUND" }

/**
 * Hard-delete a supplier or affiliate user when DB constraints allow it.
 * Orders as supplier/affiliate block deletion (financial / legal history).
 */
export async function deleteMerchantUser(
  userId: string,
  role: "SUPPLIER" | "AFFILIATE"
): Promise<DeleteMerchantAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })
  if (!user) return { ok: false, code: "USER_NOT_FOUND" }
  if (user.role !== role) return { ok: false, code: "NOT_MERCHANT" }

  if (role === "AFFILIATE") {
    const orderCount = await prisma.order.count({ where: { affiliateId: userId } })
    if (orderCount > 0) return { ok: false, code: "HAS_ORDERS" }

    await prisma.$transaction(async (tx) => {
      await tx.affiliateProduct.deleteMany({ where: { affiliateId: userId } })
      await tx.notification.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })
    return { ok: true }
  }

  const orderCount = await prisma.order.count({ where: { supplierId: userId } })
  if (orderCount > 0) return { ok: false, code: "HAS_ORDERS" }

  const products = await prisma.product.findMany({
    where: { supplierId: userId },
    select: { id: true },
  })
  const productIds = products.map((p) => p.id)

  await prisma.$transaction(async (tx) => {
    if (productIds.length > 0) {
      await tx.affiliateProduct.deleteMany({ where: { productId: { in: productIds } } })
    }
    await tx.product.deleteMany({ where: { supplierId: userId } })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.user.delete({ where: { id: userId } })
  })

  return { ok: true }
}
