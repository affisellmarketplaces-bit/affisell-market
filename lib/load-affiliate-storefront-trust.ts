import { prisma } from "@/lib/prisma"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"

export async function loadAffiliateStorefrontTrust(slug: string): Promise<StorefrontTrustSnapshot | null> {
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      name: true,
      partnerListingCode: true,
      userId: true,
      user: { select: { role: true } },
    },
  })
  if (!store || store.user.role !== "AFFILIATE") return null

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
}
