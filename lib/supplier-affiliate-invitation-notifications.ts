import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { prisma } from "@/lib/prisma"
import {
  formatAffiliateInviteListingLiveMessage,
  formatAffiliateInviteRegisteredMessage,
  SUPPLIER_AFFILIATE_INVITE_NOTIF,
} from "@/lib/supplier-affiliate-invite-notif-constants"

export {
  formatAffiliateInviteListingLiveMessage,
  formatAffiliateInviteRegisteredMessage,
  SUPPLIER_AFFILIATE_INVITE_NOTIF,
} from "@/lib/supplier-affiliate-invite-notif-constants"

export async function notifySupplierAffiliateInvitationRegistered(
  invitationId: string
): Promise<void> {
  const invitation = await prisma.supplierAffiliateInvitation.findUnique({
    where: { id: invitationId },
    include: {
      affiliate: { select: { store: { select: { name: true, logoUrl: true } } } },
    },
  })
  if (!invitation?.affiliateId) return

  const affiliateStoreName =
    invitation.affiliate?.store?.name?.trim() || "Votre invité"
  const imageUrl = invitation.affiliate?.store?.logoUrl?.trim() || null

  await prisma.notification.create({
    data: {
      userId: invitation.supplierId,
      type: SUPPLIER_AFFILIATE_INVITE_NOTIF.REGISTERED,
      message: formatAffiliateInviteRegisteredMessage({ affiliateStoreName }),
      imageUrl,
    },
  })
}

export async function notifySupplierAffiliateInvitationListingLive(args: {
  invitationId: string
  productName: string
  commissionRate: number
  variants: unknown
  basePriceCents: number
  imageUrl?: string | null
}): Promise<void> {
  const invitation = await prisma.supplierAffiliateInvitation.findUnique({
    where: { id: args.invitationId },
    include: {
      affiliate: { select: { store: { select: { name: true, logoUrl: true } } } },
      supplier: { select: { id: true } },
    },
  })
  if (!invitation?.affiliateId) return

  const affiliateStoreName =
    invitation.affiliate?.store?.name?.trim() || "Affilié"
  const commissionPct = affiliateCommissionDisplayPct({
    commissionRate: args.commissionRate,
    variants: args.variants,
    basePriceCents: args.basePriceCents,
  })
  const thumb = args.imageUrl?.trim() || invitation.affiliate?.store?.logoUrl?.trim() || null

  await prisma.notification.create({
    data: {
      userId: invitation.supplierId,
      type: SUPPLIER_AFFILIATE_INVITE_NOTIF.LISTING_LIVE,
      message: formatAffiliateInviteListingLiveMessage({
        affiliateStoreName,
        productName: args.productName,
        commissionPct,
      }),
      imageUrl: thumb,
    },
  })
}
