import "server-only"

import { prisma } from "@/lib/prisma"
import { exclusivityBlocksAffiliate } from "@/lib/product-exclusivity-shared"

export type ExclusivityGuardResult = { ok: true } | { ok: false; until: Date }

/**
 * May this reseller list (create or publish) this product? Fails ONLY when someone else holds an active
 * exclusivity. A missing product or a database hiccup never blocks here — callers already validate the product, and
 * a transient read failure must not stop an unrelated reseller from working.
 */
export async function checkAffiliateMayListProduct(
  productId: string,
  affiliateId: string,
  now: Date = new Date()
): Promise<ExclusivityGuardResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { exclusiveAffiliateId: true, exclusiveUntil: true },
    })
    if (product && exclusivityBlocksAffiliate(product, affiliateId, now) && product.exclusiveUntil) {
      return { ok: false, until: product.exclusiveUntil }
    }
  } catch (error) {
    console.error("[product-exclusivity] guard_read_failed", error instanceof Error ? error.message : String(error))
  }
  return { ok: true }
}

/** Same guard for a batch of listing ids (publish / bulk): the products held by someone else, if any. */
export async function findExclusiveProductsBlockedForAffiliate(
  productIds: readonly string[],
  affiliateId: string,
  now: Date = new Date()
): Promise<{ productId: string; until: Date }[]> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (ids.length === 0) return []
  try {
    const rows = await prisma.product.findMany({
      where: { id: { in: ids }, exclusiveAffiliateId: { not: null }, exclusiveUntil: { gt: now } },
      select: { id: true, exclusiveAffiliateId: true, exclusiveUntil: true },
    })
    return rows.flatMap((r) =>
      exclusivityBlocksAffiliate(r, affiliateId, now) && r.exclusiveUntil
        ? [{ productId: r.id, until: r.exclusiveUntil }]
        : []
    )
  } catch (error) {
    console.error("[product-exclusivity] guard_read_failed", error instanceof Error ? error.message : String(error))
    return []
  }
}

