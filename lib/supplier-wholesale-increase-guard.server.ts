import "server-only"

import { buildWholesaleAfterFromSupplierDraft } from "@/lib/supplier-wholesale-change-preview"
import { prisma } from "@/lib/prisma"
import {
  isSupplierProductLiveForWholesaleGuard,
  loadSupplierProductWholesaleRow,
  wholesaleSnapshotFromSupplierProductRow,
} from "@/lib/supplier-product-wholesale-snapshot"
import {
  evaluateSupplierWholesaleIncreaseBlock,
  SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE,
  type SupplierWholesaleIncreaseBlock,
} from "@/lib/supplier-wholesale-increase-guard-shared"

export {
  SUPPLIER_WHOLESALE_INCREASE_BLOCKED_CODE,
  type SupplierWholesaleIncreaseBlock,
  evaluateSupplierWholesaleIncreaseBlock,
} from "@/lib/supplier-wholesale-increase-guard-shared"

export async function countListedAffiliatesForProduct(productId: string): Promise<number> {
  return prisma.affiliateProduct.count({
    where: { productId, isListed: true },
  })
}

/** Hard gate — block wholesale increases while partners list live on vitrine. */
export async function assertSupplierWholesaleIncreaseAllowed(
  productId: string,
  rawBody: Record<string, unknown>,
  locale: "fr" | "en" = "fr"
): Promise<SupplierWholesaleIncreaseBlock | null> {
  const row = await loadSupplierProductWholesaleRow(productId)
  if (!row || !isSupplierProductLiveForWholesaleGuard(row)) return null

  const listedAffiliateCount = await countListedAffiliatesForProduct(productId)
  const before = wholesaleSnapshotFromSupplierProductRow(row)
  const after = buildWholesaleAfterFromSupplierDraft(row, rawBody)

  return evaluateSupplierWholesaleIncreaseBlock({
    isLive: true,
    before,
    after,
    listedAffiliateCount,
    locale,
  })
}
