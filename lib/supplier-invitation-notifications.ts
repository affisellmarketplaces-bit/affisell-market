import "server-only"

import type { Prisma } from "@prisma/client"

import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"
import { prisma } from "@/lib/prisma"
import {
  formatNewSupplierCatalogBroadcastMessage,
  formatSupplierInviteCatalogLiveMessage,
  formatSupplierInviteRegisteredMessage,
  SUPPLIER_INVITE_NOTIF,
} from "@/lib/supplier-invite-notif-constants"

export {
  formatNewSupplierCatalogBroadcastMessage,
  formatSupplierInviteCatalogLiveMessage,
  formatSupplierInviteRegisteredMessage,
  SUPPLIER_INVITE_NOTIF,
} from "@/lib/supplier-invite-notif-constants"

async function notifyAffiliate(
  tx: Prisma.TransactionClient,
  userId: string,
  type: string,
  message: string,
  imageUrl?: string | null
) {
  await tx.notification.create({
    data: { userId, type, message, imageUrl: imageUrl?.trim() || null },
  })
}

/** Notify inviting affiliate + broadcast to other affiliates when first SKU goes live. */
export async function notifySupplierInvitationCatalogLive(args: {
  invitationId: string
  productId: string
  productName: string
  commissionRate: number
  variants: unknown
  basePriceCents: number
  images: string[]
}): Promise<void> {
  const invitation = await prisma.affiliateSupplierInvitation.findUnique({
    where: { id: args.invitationId },
    include: {
      affiliate: { select: { id: true, name: true, store: { select: { name: true } } } },
      supplier: { select: { id: true, store: { select: { name: true } } } },
    },
  })
  if (!invitation?.supplierId || !invitation.supplier) return

  const supplierStoreName =
    invitation.supplier.store?.name?.trim() || "Nouveau fournisseur"
  const inviterName =
    invitation.affiliate.store?.name?.trim() ||
    invitation.affiliate.name?.trim() ||
    "un affilié"
  const commissionPct = affiliateCommissionDisplayPct({
    commissionRate: args.commissionRate,
    variants: args.variants,
    basePriceCents: args.basePriceCents,
  })
  const thumb = args.images[0]?.trim() || null

  const inviterMsg = formatSupplierInviteCatalogLiveMessage({
    supplierStoreName,
    productName: args.productName,
    commissionPct,
  })
  const broadcastMsg = formatNewSupplierCatalogBroadcastMessage({
    supplierStoreName,
    productName: args.productName,
    commissionPct,
    invitedByName: inviterName,
  })

  const affiliateIds = await prisma.user.findMany({
    where: { role: "AFFILIATE", id: { not: invitation.affiliateId } },
    select: { id: true },
    take: 500,
  })

  await prisma.$transaction(async (tx) => {
    await notifyAffiliate(
      tx,
      invitation.affiliateId,
      SUPPLIER_INVITE_NOTIF.CATALOG_LIVE,
      inviterMsg,
      thumb
    )
    if (affiliateIds.length > 0) {
      await tx.notification.createMany({
        data: affiliateIds.map((a) => ({
          userId: a.id,
          type: SUPPLIER_INVITE_NOTIF.NEW_SUPPLIER_CATALOG,
          message: broadcastMsg,
          imageUrl: thumb,
        })),
      })
    }
  })
}

export async function notifySupplierInvitationRegistered(invitationId: string): Promise<void> {
  const invitation = await prisma.affiliateSupplierInvitation.findUnique({
    where: { id: invitationId },
    include: {
      supplier: { select: { store: { select: { name: true, logoUrl: true } } } },
    },
  })
  if (!invitation?.supplierId) return

  const supplierStoreName =
    invitation.supplier?.store?.name?.trim() || "Votre invité"
  const imageUrl = invitation.supplier?.store?.logoUrl?.trim() || null

  await prisma.notification.create({
    data: {
      userId: invitation.affiliateId,
      type: SUPPLIER_INVITE_NOTIF.REGISTERED,
      message: formatSupplierInviteRegisteredMessage({ supplierStoreName }),
      imageUrl,
    },
  })
}
