import type { Prisma } from "@prisma/client"

import { requireMerchantUserId } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"
import {
  allocateUniqueSupplierAffiliateInviteToken,
  normalizeSupplierAffiliateInviteToken,
} from "@/lib/supplier-affiliate-invitation-token"
import type {
  PublicAffiliateInvitationPayload,
  SupplierAffiliateInvitationListItem,
} from "@/lib/supplier-affiliate-invitation-types"
import { supplierAffiliateInvitationPublicUrl } from "@/lib/supplier-affiliate-invitation-url"

export type {
  PublicAffiliateInvitationPayload,
  SupplierAffiliateInvitationListItem,
} from "@/lib/supplier-affiliate-invitation-types"

export const SUPPLIER_AFFILIATE_INVITE_STATUS = {
  OPEN: "OPEN",
  REGISTERED: "REGISTERED",
  LISTING_LIVE: "LISTING_LIVE",
} as const

export const SUPPLIER_AFFILIATE_INVITE_TTL_DAYS = 90

function inviteExpiresAt(from = new Date()): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + SUPPLIER_AFFILIATE_INVITE_TTL_DAYS)
  return d
}

export function parseSupplierAffiliateInviteCommissionPct(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."))
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 10) / 10
}

function serializeRow(row: {
  id: string
  token: string
  headline: string
  personalMessage?: string
  offeredCommissionPct: number | null
  categoryHint?: string | null
  status: string
  viewCount: number
  expiresAt: Date
  createdAt: Date
}) {
  return {
    id: row.id,
    token: row.token,
    headline: row.headline,
    personalMessage: row.personalMessage,
    offeredCommissionPct: row.offeredCommissionPct,
    categoryHint: row.categoryHint ?? null,
    status: row.status,
    viewCount: row.viewCount,
    url: supplierAffiliateInvitationPublicUrl(row.token),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    expired: row.expiresAt.getTime() < Date.now(),
  }
}

const listSelect = {
  id: true,
  token: true,
  headline: true,
  status: true,
  viewCount: true,
  offeredCommissionPct: true,
  affiliateId: true,
  registeredAt: true,
  listingLiveAt: true,
  expiresAt: true,
  createdAt: true,
  affiliate: { select: { store: { select: { name: true } } } },
} as const

export async function createSupplierAffiliateInvitation(
  supplierUserId: string,
  body: {
    headline?: string
    personalMessage?: string
    offeredCommissionPct?: unknown
    categoryHint?: string
  }
) {
  const supplierId = requireMerchantUserId(supplierUserId, "supplier")
  const token = await allocateUniqueSupplierAffiliateInviteToken()
  const headline = (body.headline ?? "").trim().slice(0, 120)
  const personalMessage = (body.personalMessage ?? "").trim().slice(0, 2000)
  const categoryHint = body.categoryHint?.trim().slice(0, 80) || null
  const offeredCommissionPct = parseSupplierAffiliateInviteCommissionPct(body.offeredCommissionPct)

  const row = await prisma.supplierAffiliateInvitation.create({
    data: {
      token,
      supplierId,
      headline: headline || "Rejoignez mon catalogue Affisell",
      personalMessage,
      offeredCommissionPct,
      categoryHint,
      expiresAt: inviteExpiresAt(),
    },
    select: {
      id: true,
      token: true,
      headline: true,
      personalMessage: true,
      offeredCommissionPct: true,
      categoryHint: true,
      status: true,
      viewCount: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  return serializeRow(row)
}

export async function upsertSupplierAffiliateInvitation(
  supplierUserId: string,
  body: {
    headline?: string
    personalMessage?: string
    offeredCommissionPct?: unknown
    categoryHint?: string
  }
) {
  const supplierId = requireMerchantUserId(supplierUserId, "supplier")
  const open = await prisma.supplierAffiliateInvitation.findFirst({
    where: {
      supplierId,
      status: SUPPLIER_AFFILIATE_INVITE_STATUS.OPEN,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (open) {
    const row = await prisma.supplierAffiliateInvitation.update({
      where: { id: open.id },
      data: {
        ...(body.headline !== undefined
          ? { headline: body.headline.trim().slice(0, 120) || undefined }
          : {}),
        ...(body.personalMessage !== undefined ? { personalMessage: body.personalMessage.trim().slice(0, 2000) } : {}),
        ...(body.categoryHint !== undefined
          ? { categoryHint: body.categoryHint.trim().slice(0, 80) || null }
          : {}),
        ...(body.offeredCommissionPct !== undefined
          ? { offeredCommissionPct: parseSupplierAffiliateInviteCommissionPct(body.offeredCommissionPct) }
          : {}),
      },
      select: {
        id: true,
        token: true,
        headline: true,
        personalMessage: true,
        offeredCommissionPct: true,
        categoryHint: true,
        status: true,
        viewCount: true,
        expiresAt: true,
        createdAt: true,
      },
    })
    return serializeRow(row)
  }

  return createSupplierAffiliateInvitation(supplierUserId, body)
}

export async function updateSupplierAffiliateInvitationById(
  supplierUserId: string,
  invitationId: string,
  body: {
    headline?: string
    personalMessage?: string
    offeredCommissionPct?: unknown
    categoryHint?: string
  }
) {
  const supplierId = requireMerchantUserId(supplierUserId, "supplier")
  const existing = await prisma.supplierAffiliateInvitation.findFirst({
    where: { id: invitationId, supplierId, status: SUPPLIER_AFFILIATE_INVITE_STATUS.OPEN },
  })
  if (!existing || existing.expiresAt.getTime() < Date.now()) return null

  const row = await prisma.supplierAffiliateInvitation.update({
    where: { id: invitationId },
    data: {
      ...(body.headline !== undefined
        ? { headline: body.headline.trim().slice(0, 120) || existing.headline }
        : {}),
      ...(body.personalMessage !== undefined
        ? { personalMessage: body.personalMessage.trim().slice(0, 2000) }
        : {}),
      ...(body.categoryHint !== undefined
        ? { categoryHint: body.categoryHint.trim().slice(0, 80) || null }
        : {}),
      ...(body.offeredCommissionPct !== undefined
        ? { offeredCommissionPct: parseSupplierAffiliateInviteCommissionPct(body.offeredCommissionPct) }
        : {}),
    },
    select: {
      id: true,
      token: true,
      headline: true,
      personalMessage: true,
      offeredCommissionPct: true,
      categoryHint: true,
      status: true,
      viewCount: true,
      expiresAt: true,
      createdAt: true,
    },
  })
  return serializeRow(row)
}

export async function listSupplierAffiliateInvitations(
  supplierUserId: string
): Promise<SupplierAffiliateInvitationListItem[]> {
  const supplierId = requireMerchantUserId(supplierUserId, "supplier")
  const rows = await prisma.supplierAffiliateInvitation.findMany({
    where: { supplierId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: listSelect,
  })

  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    headline: r.headline,
    status: r.status,
    viewCount: r.viewCount,
    offeredCommissionPct: r.offeredCommissionPct,
    affiliateName: r.affiliate?.store?.name ?? null,
    url: supplierAffiliateInvitationPublicUrl(r.token),
    registeredAt: r.registeredAt?.toISOString() ?? null,
    listingLiveAt: r.listingLiveAt?.toISOString() ?? null,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    expired: r.expiresAt.getTime() < Date.now(),
  }))
}

export async function loadPublicAffiliateInvitation(
  tokenRaw: string
): Promise<PublicAffiliateInvitationPayload | null> {
  const token = normalizeSupplierAffiliateInviteToken(tokenRaw) ?? tokenRaw.trim().toUpperCase()
  if (!token) return null

  try {
    const row = await prisma.supplierAffiliateInvitation.findUnique({
      where: { token },
      include: {
        supplier: {
          select: {
            name: true,
            store: { select: { name: true, slug: true, logoUrl: true } },
          },
        },
      },
    })
    if (!row) return null

    const store = row.supplier.store
    return {
      token: row.token,
      status: row.status,
      expired: row.expiresAt.getTime() < Date.now(),
      headline: row.headline,
      personalMessage: row.personalMessage,
      offeredCommissionPct: row.offeredCommissionPct,
      categoryHint: row.categoryHint,
      supplier: {
        name: store?.name?.trim() || row.supplier.name?.trim() || "Fournisseur Affisell",
        slug: store?.slug ?? null,
        logoUrl: store?.logoUrl ?? null,
      },
    }
  } catch (e) {
    console.error("[affiliate-invite] loadPublicAffiliateInvitation failed", e)
    return null
  }
}

export async function recordAffiliateInvitationView(tokenRaw: string): Promise<void> {
  const token = normalizeSupplierAffiliateInviteToken(tokenRaw)
  if (!token) return
  await prisma.supplierAffiliateInvitation.updateMany({
    where: { token, expiresAt: { gt: new Date() } },
    data: { viewCount: { increment: 1 } },
  })
}

async function findOpenInvitation(token: string) {
  return prisma.supplierAffiliateInvitation.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
      status: {
        in: [SUPPLIER_AFFILIATE_INVITE_STATUS.OPEN, SUPPLIER_AFFILIATE_INVITE_STATUS.REGISTERED],
      },
    },
  })
}

export async function claimAffiliateInvitationForUser(
  tokenRaw: string,
  affiliateUserId: string
): Promise<{ ok: boolean; reason?: string; invitationId?: string }> {
  const token = normalizeSupplierAffiliateInviteToken(tokenRaw)
  if (!token) return { ok: false, reason: "invalid_token" }

  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")

  const existing = await prisma.supplierAffiliateInvitation.findUnique({
    where: { affiliateId },
    select: { id: true, token: true },
  })
  if (existing && existing.token !== token) {
    return { ok: false, reason: "already_linked" }
  }

  const invite = await findOpenInvitation(token)
  if (!invite) return { ok: false, reason: "not_found_or_expired" }

  if (invite.affiliateId && invite.affiliateId !== affiliateId) {
    return { ok: false, reason: "taken" }
  }

  const wasOpen = invite.status === SUPPLIER_AFFILIATE_INVITE_STATUS.OPEN

  await prisma.supplierAffiliateInvitation.update({
    where: { id: invite.id },
    data: {
      affiliateId,
      status:
        invite.status === SUPPLIER_AFFILIATE_INVITE_STATUS.LISTING_LIVE
          ? SUPPLIER_AFFILIATE_INVITE_STATUS.LISTING_LIVE
          : SUPPLIER_AFFILIATE_INVITE_STATUS.REGISTERED,
      registeredAt: invite.registeredAt ?? new Date(),
    },
  })

  if (wasOpen) {
    try {
      const { notifySupplierAffiliateInvitationRegistered } = await import(
        "@/lib/supplier-affiliate-invitation-notifications"
      )
      await notifySupplierAffiliateInvitationRegistered(invite.id)
    } catch (e) {
      console.error("[affiliate-invite] register notify failed", e)
    }
  }

  return { ok: true, invitationId: invite.id }
}

/** First public listing of an inviter SKU — notify supplier. */
export async function onAffiliateListingLiveFromSupplierInvite(args: {
  affiliateId: string
  listingId: string
  productId: string
  productName: string
  commissionRate: number
  variants: unknown
  basePriceCents: number
  images: string[]
}): Promise<void> {
  const invitation = await prisma.supplierAffiliateInvitation.findUnique({
    where: { affiliateId: args.affiliateId },
    include: { supplier: { select: { id: true } } },
  })
  if (!invitation || invitation.status === SUPPLIER_AFFILIATE_INVITE_STATUS.LISTING_LIVE) return

  const product = await prisma.product.findFirst({
    where: { id: args.productId, supplierId: invitation.supplierId, active: true, isDraft: false },
    select: { id: true },
  })
  if (!product) return

  await prisma.supplierAffiliateInvitation.update({
    where: { id: invitation.id },
    data: {
      status: SUPPLIER_AFFILIATE_INVITE_STATUS.LISTING_LIVE,
      firstListingId: args.listingId,
      listingLiveAt: new Date(),
    },
  })

  try {
    const { notifySupplierAffiliateInvitationListingLive } = await import(
      "@/lib/supplier-affiliate-invitation-notifications"
    )
    await notifySupplierAffiliateInvitationListingLive({
      invitationId: invitation.id,
      productName: args.productName,
      commissionRate: args.commissionRate,
      variants: args.variants,
      basePriceCents: args.basePriceCents,
      imageUrl: args.images[0] ?? null,
    })
  } catch (e) {
    console.error("[affiliate-invite] listing live notify failed", e)
  }
}
