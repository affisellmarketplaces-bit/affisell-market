import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { affiliateCommissionDisplayPct } from "@/lib/affiliate-product-commission-display"

export const SUPPLIER_INVITE_NOTIF = {
  REGISTERED: "SUPPLIER_INVITE_REGISTERED",
  CATALOG_LIVE: "SUPPLIER_INVITE_CATALOG_LIVE",
  NEW_SUPPLIER_CATALOG: "NEW_SUPPLIER_CATALOG",
} as const

export function formatSupplierInviteRegisteredMessage(args: {
  supplierStoreName: string
}): string {
  return `Votre invitation a abouti : ${args.supplierStoreName} vient de créer son compte fournisseur. Ajoutez ses produits dès qu’ils sont en ligne.`
}

export function formatSupplierInviteCatalogLiveMessage(args: {
  supplierStoreName: string
  productName: string
  commissionPct: number
}): string {
  const pct = Number.isFinite(args.commissionPct) ? args.commissionPct.toFixed(1) : "0"
  return `${args.supplierStoreName} a publié « ${args.productName} » (${pct}% commission affilié). Listez-le sur votre vitrine.`
}

export function formatNewSupplierCatalogBroadcastMessage(args: {
  supplierStoreName: string
  productName: string
  commissionPct: number
  invitedByName: string
}): string {
  const pct = Number.isFinite(args.commissionPct) ? args.commissionPct.toFixed(1) : "0"
  return `Nouveau fournisseur : ${args.supplierStoreName} — « ${args.productName} » (${pct}% commission). Invité par ${args.invitedByName}.`
}

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
