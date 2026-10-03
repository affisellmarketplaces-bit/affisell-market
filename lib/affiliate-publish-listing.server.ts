import { merchantVerificationGate, type MerchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import { checkAffiliateMayListProduct } from "@/lib/product-exclusivity-guard.server"
import { catalogExclusivityWhere } from "@/lib/product-exclusivity-shared"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export type PublishAffiliateListingResult =
  | { ok: true; listingId: string; alreadyLive: boolean }
  | { ok: false; reason: "not_found" | "forbidden" }
  | { ok: false; reason: "exclusive"; until: Date }
  | { ok: false; reason: "kyc"; gate: MerchantVerificationGate }

export type StorefrontAutoLiveSyncResult = {
  publishedCount: number
  kycBlocked: boolean
  kycReason?: MerchantVerificationGate["reason"]
}

/** Flip a draft listing live when merchant KYC allows public publish. */
export async function publishAffiliateListingIfAllowed(args: {
  affiliateId: string
  listingId: string
}): Promise<PublishAffiliateListingResult> {
  const row = await prisma.affiliateProduct.findUnique({
    where: { id: args.listingId.trim() },
    select: { id: true, affiliateId: true, isListed: true, productId: true },
  })

  if (!row) return { ok: false, reason: "not_found" }
  if (row.affiliateId !== args.affiliateId) return { ok: false, reason: "forbidden" }
  if (row.isListed) return { ok: true, listingId: row.id, alreadyLive: true }

  const exclusivity = await checkAffiliateMayListProduct(row.productId, args.affiliateId)
  if (!exclusivity.ok) return { ok: false, reason: "exclusive", until: exclusivity.until }

  const gate = await merchantVerificationGate(args.affiliateId)
  if (!gate.allowed) {
    console.log("[affiliate-publish]", {
      affiliateId: args.affiliateId,
      listingId: row.id,
      result: "kyc_blocked",
      reason: gate.reason,
    })
    return { ok: false, reason: "kyc", gate }
  }

  await prisma.affiliateProduct.update({
    where: { id: row.id },
    data: { isListed: true },
  })

  console.log("[affiliate-publish]", {
    affiliateId: args.affiliateId,
    listingId: row.id,
    result: "published",
  })

  return { ok: true, listingId: row.id, alreadyLive: false }
}

/** Idempotent — every vitrine row goes live when KYC allows (fixes legacy drafts). */
export async function syncAffiliateStorefrontListingsLive(
  affiliateId: string
): Promise<StorefrontAutoLiveSyncResult> {
  const gate = await merchantVerificationGate(affiliateId)
  if (!gate.allowed) {
    return { publishedCount: 0, kycBlocked: true, kycReason: gate.reason }
  }

  // Never auto-relist what a product's exclusivity holder has taken off other resellers' storefronts.
  const now = new Date()
  const publishable = { affiliateId, isListed: false, product: catalogExclusivityWhere(affiliateId, now) }

  const pending = await prisma.affiliateProduct.count({
    where: publishable,
  })
  if (pending === 0) {
    return { publishedCount: 0, kycBlocked: false }
  }

  const updated = await prisma.affiliateProduct.updateMany({
    where: publishable,
    data: { isListed: true },
  })

  if (updated.count > 0) {
    await revalidateAffiliateShopfront(affiliateId)
    console.log("[affiliate-storefront-auto-live]", {
      affiliateId,
      publishedCount: updated.count,
      result: "synced",
    })
  }

  return { publishedCount: updated.count, kycBlocked: false }
}
