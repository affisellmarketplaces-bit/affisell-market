import { merchantVerificationGate, type MerchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"

export type PublishAffiliateListingResult =
  | { ok: true; listingId: string; alreadyLive: boolean }
  | { ok: false; reason: "not_found" | "forbidden" }
  | { ok: false; reason: "kyc"; gate: MerchantVerificationGate }

/** Flip a draft listing live when merchant KYC allows public publish. */
export async function publishAffiliateListingIfAllowed(args: {
  affiliateId: string
  listingId: string
}): Promise<PublishAffiliateListingResult> {
  const row = await prisma.affiliateProduct.findUnique({
    where: { id: args.listingId.trim() },
    select: { id: true, affiliateId: true, isListed: true },
  })

  if (!row) return { ok: false, reason: "not_found" }
  if (row.affiliateId !== args.affiliateId) return { ok: false, reason: "forbidden" }
  if (row.isListed) return { ok: true, listingId: row.id, alreadyLive: true }

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
