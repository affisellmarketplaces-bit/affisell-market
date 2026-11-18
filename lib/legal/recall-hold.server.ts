import { supplierMayActivate } from "@/lib/legal/recall-hold"
import { prisma } from "@/lib/prisma"

/**
 * True when Affisell holds the product under an open recall (see `recall-hold.ts`). Fails CLOSED: if the recalls can not
 * be read, the product is treated as held — re-listing a possibly dangerous product is worse than a retry.
 */
export async function isProductHeldByRecall(productId: string): Promise<boolean> {
  try {
    const rows = await prisma.productRecall.findMany({ where: { productId }, select: { status: true } })
    return !supplierMayActivate(rows.map((r) => r.status))
  } catch (error) {
    console.error("[recall-hold]", {
      productId,
      result: "recalls_unreadable_treated_as_held",
      error: error instanceof Error ? error.message : String(error),
    })
    return true
  }
}
