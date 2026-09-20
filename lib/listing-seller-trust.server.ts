import "server-only"

import { prisma } from "@/lib/prisma"

export type ListingSellerTrust = {
  /** KYC-approved legal profile. */
  verified: boolean
  /** Trade / legal name — only when verified. */
  legalName: string | null
  /** ISO2 country of the legal entity — only when verified. */
  countryCode: string | null
}

const NONE: ListingSellerTrust = { verified: false, legalName: null, countryCode: null }

/** Public facts about the merchant behind a listing. Never throws (the PDP must render without it). */
export async function loadListingSellerTrust(affiliateUserId: string | null | undefined): Promise<ListingSellerTrust> {
  if (!affiliateUserId) return NONE
  try {
    const profile = await prisma.merchantLegalProfile.findUnique({
      where: { userId: affiliateUserId },
      select: { verificationStatus: true, legalEntityName: true, tradeName: true, countryCode: true },
    })
    if (profile?.verificationStatus !== "APPROVED") return NONE
    return {
      verified: true,
      legalName: profile.tradeName?.trim() || profile.legalEntityName?.trim() || null,
      countryCode: profile.countryCode?.trim().toUpperCase().slice(0, 2) || null,
    }
  } catch (error) {
    console.error("[listing-seller-trust]", error instanceof Error ? error.message : String(error))
    return NONE
  }
}
