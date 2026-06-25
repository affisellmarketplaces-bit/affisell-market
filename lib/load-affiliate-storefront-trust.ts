import { cache } from "react"

import { loadAffiliateShopStore } from "@/lib/shop-storefront-data"
import { prisma } from "@/lib/prisma"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"

export const loadAffiliateStorefrontTrust = cache(async function loadAffiliateStorefrontTrust(
  slug: string
): Promise<StorefrontTrustSnapshot | null> {
  const store = await loadAffiliateShopStore(slug)
  if (!store) return null

  const profile = await prisma.merchantLegalProfile.findUnique({
    where: { userId: store.userId },
    select: {
      verificationStatus: true,
      legalEntityName: true,
      tradeName: true,
      legalStatus: true,
      countryCode: true,
      reviewedAt: true,
    },
  })

  const merchantVerified = profile?.verificationStatus === "APPROVED"
  const legalDisplayName = merchantVerified
    ? profile?.tradeName?.trim() || profile?.legalEntityName?.trim() || null
    : null

  return {
    storeName: store.name,
    partnerListingCode: store.partnerListingCode,
    merchantVerified,
    legalDisplayName,
    legalStatus: merchantVerified ? profile?.legalStatus ?? null : null,
    countryCode: merchantVerified ? profile?.countryCode ?? null : null,
    verifiedAt:
      merchantVerified && profile?.reviewedAt ? profile.reviewedAt.toISOString() : null,
  }
})
