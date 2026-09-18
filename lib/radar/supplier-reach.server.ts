import "server-only"

import { prisma } from "@/lib/prisma"

/** Distinct resellers currently listing at least one of the supplier's products. */
export async function countResellersListingSupplier(supplierId: string): Promise<number> {
  const rows = await prisma.affiliateProduct.groupBy({
    by: ["affiliateId"],
    where: { isListed: true, product: { supplierId } },
  })
  return rows.length
}
