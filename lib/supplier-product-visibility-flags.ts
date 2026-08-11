import type { Prisma } from "@prisma/client"

/**
 * Apply draft/live visibility at the END of a product write transaction.
 * Publish always wins; draft saves only touch rows that are still drafts (no race downgrade).
 */
export async function applySupplierProductVisibilityFlags(
  tx: Prisma.TransactionClient,
  productId: string,
  args: { publish: boolean; saveAsDraft: boolean }
): Promise<void> {
  if (args.publish) {
    await tx.product.update({
      where: { id: productId },
      data: { active: true, isDraft: false },
    })
    return
  }

  if (args.saveAsDraft) {
    await tx.product.updateMany({
      where: { id: productId, isDraft: true },
      data: { active: false, isDraft: true },
    })
  }
}

/** True when the row is live on the supplier catalog and visible to resellers. */
export function isSupplierProductResellerVisible(product: {
  active: boolean
  isDraft: boolean
}): boolean {
  return product.active && !product.isDraft
}
