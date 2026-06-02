import { prisma } from "@/lib/prisma"
import { SPONSOR_STATUS } from "@/lib/sponsor/sponsor-constants"

export async function expireSponsorCampaigns() {
  const now = new Date()
  const expired = await prisma.sponsorCampaign.findMany({
    where: {
      status: SPONSOR_STATUS.ACTIVE,
      endsAt: { lte: now },
    },
    select: {
      id: true,
      affiliateProductId: true,
      setsListingFeatured: true,
    },
  })

  if (expired.length === 0) {
    return { expired: 0 }
  }

  await prisma.$transaction(async (tx) => {
    for (const campaign of expired) {
      await tx.sponsorCampaign.update({
        where: { id: campaign.id },
        data: { status: SPONSOR_STATUS.EXPIRED },
      })
      if (campaign.affiliateProductId && campaign.setsListingFeatured) {
        const otherActive = await tx.sponsorCampaign.count({
          where: {
            affiliateProductId: campaign.affiliateProductId,
            status: SPONSOR_STATUS.ACTIVE,
            endsAt: { gt: now },
            id: { not: campaign.id },
          },
        })
        if (otherActive === 0) {
          await tx.affiliateProduct.update({
            where: { id: campaign.affiliateProductId },
            data: { isFeatured: false },
          })
        }
      }
    }
  })

  console.log("[sponsor]", { expired: expired.length, result: "batch_expired" })
  return { expired: expired.length }
}
