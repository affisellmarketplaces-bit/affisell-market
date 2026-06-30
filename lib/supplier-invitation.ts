import { requireMerchantUserId } from "@/lib/merchant-tenant-scope"
import { prisma } from "@/lib/prisma"
import { ensureInviterDraftListingForInvite } from "@/lib/supplier-invitation-affiliate-listing"
import { allocateUniqueSupplierInviteToken } from "@/lib/supplier-invitation-token.server"
import { normalizeSupplierInviteToken } from "@/lib/supplier-invitation-token"
import { supplierInvitationPublicUrl } from "@/lib/supplier-invitation-url"
import type {
  AffiliateInvitationListItem,
  PublicSupplierInvitationPayload,
} from "@/lib/supplier-invitation-types"

export type { AffiliateInvitationListItem, PublicSupplierInvitationPayload } from "@/lib/supplier-invitation-types"

export const SUPPLIER_INVITE_STATUS = {
  OPEN: "OPEN",
  REGISTERED: "REGISTERED",
  CATALOG_LIVE: "CATALOG_LIVE",
} as const

export const SUPPLIER_INVITE_TTL_DAYS = 90

function inviteExpiresAt(from = new Date()): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + SUPPLIER_INVITE_TTL_DAYS)
  return d
}

export function parseInvitationCommissionPct(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."))
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 10) / 10
}

export async function createAffiliateSupplierInvitation(
  affiliateUserId: string,
  body: {
    headline?: string
    personalMessage?: string
    offeredCommissionPct?: unknown
    categoryHint?: string
  }
) {
  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")
  const token = await allocateUniqueSupplierInviteToken()
  const headline = (body.headline ?? "").trim().slice(0, 120)
  const personalMessage = (body.personalMessage ?? "").trim().slice(0, 2000)
  const categoryHint = body.categoryHint?.trim().slice(0, 80) || null
  const offeredCommissionPct = parseInvitationCommissionPct(body.offeredCommissionPct)

  const row = await prisma.affiliateSupplierInvitation.create({
    data: {
      token,
      affiliateId,
      headline: headline || "Vendez avec nos créateurs affiliés",
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

  return serializeInvitationRow(row)
}

function serializeInvitationRow(
  row: {
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
  }
) {
  return {
    id: row.id,
    token: row.token,
    headline: row.headline,
    personalMessage: row.personalMessage,
    offeredCommissionPct: row.offeredCommissionPct,
    categoryHint: row.categoryHint ?? null,
    status: row.status,
    viewCount: row.viewCount,
    url: supplierInvitationPublicUrl(row.token),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    expired: row.expiresAt.getTime() < Date.now(),
  }
}

/** Reuse the latest open invite or create a new link (avoids dozens of dead links). */
export async function upsertAffiliateSupplierInvitation(
  affiliateUserId: string,
  body: {
    headline?: string
    personalMessage?: string
    offeredCommissionPct?: unknown
    categoryHint?: string
  }
) {
  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")
  const open = await prisma.affiliateSupplierInvitation.findFirst({
    where: {
      affiliateId,
      status: SUPPLIER_INVITE_STATUS.OPEN,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (open) {
    const headline = (body.headline ?? "").trim().slice(0, 120)
    const personalMessage = (body.personalMessage ?? "").trim().slice(0, 2000)
    const categoryHint = body.categoryHint?.trim().slice(0, 80) || null
    const offeredCommissionPct = parseInvitationCommissionPct(body.offeredCommissionPct)

    const row = await prisma.affiliateSupplierInvitation.update({
      where: { id: open.id },
      data: {
        ...(headline ? { headline } : {}),
        ...(body.personalMessage !== undefined ? { personalMessage } : {}),
        ...(body.categoryHint !== undefined ? { categoryHint } : {}),
        ...(body.offeredCommissionPct !== undefined ? { offeredCommissionPct } : {}),
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
    return serializeInvitationRow(row)
  }

  return createAffiliateSupplierInvitation(affiliateUserId, body)
}

export async function updateAffiliateSupplierInvitationById(
  affiliateUserId: string,
  invitationId: string,
  body: {
    headline?: string
    personalMessage?: string
    offeredCommissionPct?: unknown
    categoryHint?: string
  }
) {
  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")
  const existing = await prisma.affiliateSupplierInvitation.findFirst({
    where: { id: invitationId, affiliateId, status: SUPPLIER_INVITE_STATUS.OPEN },
  })
  if (!existing || existing.expiresAt.getTime() < Date.now()) {
    return null
  }

  const row = await prisma.affiliateSupplierInvitation.update({
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
        ? { offeredCommissionPct: parseInvitationCommissionPct(body.offeredCommissionPct) }
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
  return serializeInvitationRow(row)
}

export async function listAffiliateSupplierInvitations(
  affiliateUserId: string
): Promise<AffiliateInvitationListItem[]> {
  const affiliateId = requireMerchantUserId(affiliateUserId, "affiliate")
  const rows = await prisma.affiliateSupplierInvitation.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      token: true,
      headline: true,
      status: true,
      viewCount: true,
      offeredCommissionPct: true,
      supplierId: true,
      registeredAt: true,
      catalogLiveAt: true,
      expiresAt: true,
      createdAt: true,
      supplier: { select: { store: { select: { name: true } } } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    headline: r.headline,
    status: r.status,
    viewCount: r.viewCount,
    offeredCommissionPct: r.offeredCommissionPct,
    supplierName: r.supplier?.store?.name ?? null,
    url: supplierInvitationPublicUrl(r.token),
    registeredAt: r.registeredAt?.toISOString() ?? null,
    catalogLiveAt: r.catalogLiveAt?.toISOString() ?? null,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    expired: r.expiresAt.getTime() < Date.now(),
  }))
}

export async function loadPublicSupplierInvitation(
  tokenRaw: string
): Promise<PublicSupplierInvitationPayload | null> {
  const token = normalizeSupplierInviteToken(tokenRaw) ?? tokenRaw.trim().toUpperCase()
  if (!token) return null

  try {
    const row = await prisma.affiliateSupplierInvitation.findUnique({
      where: { token },
      include: {
        affiliate: {
          select: {
            name: true,
            store: { select: { name: true, slug: true, logoUrl: true, tiktok: true } },
          },
        },
      },
    })
    if (!row) return null

    const store = row.affiliate.store
    return {
      token: row.token,
      status: row.status,
      expired: row.expiresAt.getTime() < Date.now(),
      headline: row.headline,
      personalMessage: row.personalMessage,
      offeredCommissionPct: row.offeredCommissionPct,
      categoryHint: row.categoryHint,
      affiliate: {
        name: store?.name?.trim() || row.affiliate.name?.trim() || "Créateur Affisell",
        slug: store?.slug ?? null,
        logoUrl: store?.logoUrl ?? null,
        tiktok: store?.tiktok ?? null,
      },
    }
  } catch (e) {
    console.error("[supplier-invite] loadPublicSupplierInvitation failed", e)
    return null
  }
}

export async function recordSupplierInvitationView(tokenRaw: string): Promise<void> {
  const token = normalizeSupplierInviteToken(tokenRaw)
  if (!token) return
  await prisma.affiliateSupplierInvitation.updateMany({
    where: { token, expiresAt: { gt: new Date() } },
    data: { viewCount: { increment: 1 } },
  })
}

async function findOpenInvitation(token: string) {
  return prisma.affiliateSupplierInvitation.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
      status: { in: [SUPPLIER_INVITE_STATUS.OPEN, SUPPLIER_INVITE_STATUS.REGISTERED] },
    },
  })
}

/** Link supplier account after signup or login from invite page. */
export async function claimSupplierInvitationForUser(
  tokenRaw: string,
  supplierUserId: string
): Promise<{ ok: boolean; reason?: string; invitationId?: string }> {
  const token = normalizeSupplierInviteToken(tokenRaw)
  if (!token) return { ok: false, reason: "invalid_token" }

  const supplierId = requireMerchantUserId(supplierUserId, "supplier")

  const existingSupplierInvite = await prisma.affiliateSupplierInvitation.findUnique({
    where: { supplierId },
    select: { id: true, token: true },
  })
  if (existingSupplierInvite && existingSupplierInvite.token !== token) {
    return { ok: false, reason: "already_linked" }
  }

  const invite = await findOpenInvitation(token)
  if (!invite) return { ok: false, reason: "not_found_or_expired" }

  if (invite.supplierId && invite.supplierId !== supplierId) {
    return { ok: false, reason: "taken" }
  }

  const wasOpen = invite.status === SUPPLIER_INVITE_STATUS.OPEN

  await prisma.affiliateSupplierInvitation.update({
    where: { id: invite.id },
    data: {
      supplierId,
      status:
        invite.status === SUPPLIER_INVITE_STATUS.CATALOG_LIVE
          ? SUPPLIER_INVITE_STATUS.CATALOG_LIVE
          : SUPPLIER_INVITE_STATUS.REGISTERED,
      registeredAt: invite.registeredAt ?? new Date(),
    },
  })

  if (wasOpen) {
    try {
      const { notifySupplierInvitationRegistered } = await import(
        "@/lib/supplier-invitation-notifications"
      )
      await notifySupplierInvitationRegistered(invite.id)
    } catch (e) {
      console.error("[supplier-invite] register notify failed", e)
    }
  }

  return { ok: true, invitationId: invite.id }
}

/** After first published product — notify inviter + affiliate network. */
export async function onSupplierProductPublishedFromInvite(args: {
  supplierId: string
  productId: string
  productName: string
  commissionRate: number
  variants: unknown
  basePriceCents: number
  images: string[]
}): Promise<void> {
  const invitation = await prisma.affiliateSupplierInvitation.findUnique({
    where: { supplierId: args.supplierId },
  })
  if (!invitation || invitation.status === SUPPLIER_INVITE_STATUS.CATALOG_LIVE) return

  await prisma.affiliateSupplierInvitation.update({
    where: { id: invitation.id },
    data: {
      status: SUPPLIER_INVITE_STATUS.CATALOG_LIVE,
      firstProductId: args.productId,
      catalogLiveAt: new Date(),
    },
  })

  try {
    await ensureInviterDraftListingForInvite({
      affiliateId: invitation.affiliateId,
      productId: args.productId,
    })
  } catch (e) {
    console.error("[supplier-invite] inviter draft listing failed", e)
  }

  try {
    const { notifySupplierInvitationCatalogLive } = await import(
      "@/lib/supplier-invitation-notifications"
    )
    await notifySupplierInvitationCatalogLive({
      invitationId: invitation.id,
      productId: args.productId,
      productName: args.productName,
      commissionRate: args.commissionRate,
      variants: args.variants,
      basePriceCents: args.basePriceCents,
      images: args.images,
    })
  } catch (e) {
    console.error("[supplier-invite] catalog live notify failed", e)
  }
}
