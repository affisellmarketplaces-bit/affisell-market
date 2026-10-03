import "server-only"

import { Prisma } from "@prisma/client"

import { cancelAuctionsForListings } from "@/lib/auction-listing-lifecycle"
import { prisma } from "@/lib/prisma"
import {
  affiliateExclusivityState,
  canSupplierRevokeExclusivity,
  clampExclusivityDays,
  EXCLUSIVITY_REQUEST_MESSAGE_MAX,
  exclusiveHolderOf,
  exclusivityEndsAt,
  type AffiliateExclusivityState,
} from "@/lib/product-exclusivity-shared"
import { primaryProductImage } from "@/lib/product-images"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const EXCLUSIVITY_NOTIF = {
  GRANTED: "EXCLUSIVITY_GRANTED",
  ENDED: "EXCLUSIVITY_ENDED",
  REQUEST: "EXCLUSIVITY_REQUEST",
  DECLINED: "EXCLUSIVITY_DECLINED",
  LISTING_REMOVED: "EXCLUSIVITY_LISTING_REMOVED",
} as const

const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

// ─── Grant ──────────────────────────────────────────────────────────────────────────────────────────────────

export type GrantExclusivityResult =
  | { ok: true; until: Date; extended: boolean; evicted: number }
  | {
      ok: false
      error:
        | "product_not_found"
        | "affiliate_not_eligible"
        | "held_by_other"
        | "other_listings"
        | "not_a_marketplace_product"
      otherListings?: number
      until?: Date
    }

/**
 * Supplier grants ONE reseller exclusivity on a product.
 *  - granting again to the current holder extends from the current end (the cooling-off window is not re-opened);
 *  - another holder's active exclusivity must end first;
 *  - other resellers already LISTING the product block the grant unless `evictOthers`, which unlists (never
 *    deletes) their listings and tells them.
 */
export async function grantProductExclusivity(args: {
  supplierId: string
  productId: string
  affiliateId: string
  days?: unknown
  evictOthers?: boolean
  now?: Date
}): Promise<GrantExclusivityResult> {
  const now = args.now ?? new Date()
  const days = clampExclusivityDays(args.days)

  type Outcome =
    | { kind: "error"; result: Extract<GrantExclusivityResult, { ok: false }> }
    | {
        kind: "ok"
        until: Date
        extended: boolean
        productName: string
        productImage: string | null
        storeName: string
        evictedListings: { id: string; affiliateId: string }[]
        declinedAffiliateIds: string[]
      }

  const outcome: Outcome = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: args.productId, supplierId: args.supplierId },
      select: {
        id: true,
        name: true,
        images: true,
        active: true,
        isDraft: true,
        exclusiveAffiliateId: true,
        exclusiveGrantedAt: true,
        exclusiveUntil: true,
      },
    })
    if (!product) return { kind: "error", result: { ok: false, error: "product_not_found" } }
    if (!product.active || product.isDraft) {
      return { kind: "error", result: { ok: false, error: "not_a_marketplace_product" } }
    }

    const affiliate = await tx.user.findFirst({
      where: { id: args.affiliateId, role: "AFFILIATE" },
      select: { id: true, store: { select: { name: true } } },
    })
    if (!affiliate?.store) return { kind: "error", result: { ok: false, error: "affiliate_not_eligible" } }

    const holder = exclusiveHolderOf(product, now)
    if (holder && holder !== args.affiliateId) {
      return { kind: "error", result: { ok: false, error: "held_by_other", until: product.exclusiveUntil ?? undefined } }
    }

    const others = await tx.affiliateProduct.findMany({
      where: { productId: product.id, isListed: true, affiliateId: { not: args.affiliateId } },
      select: { id: true, affiliateId: true },
    })
    if (others.length > 0 && !args.evictOthers) {
      return { kind: "error", result: { ok: false, error: "other_listings", otherListings: others.length } }
    }

    const extended = holder === args.affiliateId
    const base = extended && product.exclusiveUntil ? product.exclusiveUntil : now
    const until = exclusivityEndsAt(base, days)

    await tx.product.update({
      where: { id: product.id },
      data: {
        exclusiveAffiliateId: args.affiliateId,
        exclusiveGrantedAt: extended ? (product.exclusiveGrantedAt ?? now) : now,
        exclusiveUntil: until,
      },
    })

    if (others.length > 0) {
      await tx.affiliateProduct.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { isListed: false, isFeatured: false, auctionEligible: false },
      })
    }

    // The holder's own open request is fulfilled; every other open request on this product is closed.
    await tx.productExclusivityRequest.updateMany({
      where: { productId: product.id, affiliateId: args.affiliateId, status: "PENDING" },
      data: { status: "ACCEPTED", respondedAt: now },
    })
    const stillOpen = await tx.productExclusivityRequest.findMany({
      where: { productId: product.id, status: "PENDING" },
      select: { id: true, affiliateId: true },
    })
    if (stillOpen.length > 0) {
      await tx.productExclusivityRequest.updateMany({
        where: { id: { in: stillOpen.map((r) => r.id) } },
        data: { status: "DECLINED", respondedAt: now },
      })
    }

    return {
      kind: "ok",
      until,
      extended,
      productName: product.name,
      productImage: primaryProductImage(product.images) ?? null,
      storeName: affiliate.store.name,
      evictedListings: others,
      declinedAffiliateIds: [...new Set(stillOpen.map((r) => r.affiliateId))],
    }
  })

  if (outcome.kind === "error") return outcome.result

  // Side effects after the commit — a notification or cache failure must never undo a valid grant.
  await notifyBestEffort([
    {
      userId: args.affiliateId,
      type: EXCLUSIVITY_NOTIF.GRANTED,
      message: `Exclusivité accordée sur « ${outcome.productName} » jusqu'au ${fmtDate(outcome.until)}. Seule votre boutique peut le vendre.`,
      imageUrl: outcome.productImage,
    },
    ...outcome.evictedListings.map((l) => ({
      userId: l.affiliateId,
      type: EXCLUSIVITY_NOTIF.LISTING_REMOVED,
      message: `« ${outcome.productName} » est désormais en exclusivité chez un autre revendeur : il a été retiré de votre vitrine.`,
      imageUrl: outcome.productImage,
      orderId: l.id,
    })),
    ...outcome.declinedAffiliateIds.map((id) => ({
      userId: id,
      type: EXCLUSIVITY_NOTIF.DECLINED,
      message: `Votre demande d'exclusivité sur « ${outcome.productName} » n'a pas été retenue : le fournisseur l'a accordée à un autre revendeur.`,
      imageUrl: outcome.productImage,
    })),
  ])

  if (outcome.evictedListings.length > 0) {
    await cancelAuctionsForListings(outcome.evictedListings.map((l) => l.id)).catch(() => 0)
  }
  for (const id of new Set([args.affiliateId, ...outcome.evictedListings.map((l) => l.affiliateId)])) {
    await revalidateAffiliateShopfront(id).catch(() => null)
  }

  console.log("[product-exclusivity]", {
    productId: args.productId,
    affiliateId: args.affiliateId,
    until: outcome.until.toISOString(),
    extended: outcome.extended,
    evicted: outcome.evictedListings.length,
    result: "granted",
  })
  return { ok: true, until: outcome.until, extended: outcome.extended, evicted: outcome.evictedListings.length }
}

// ─── End: holder releases, supplier revokes inside the cooling-off window ───────────────────────────────────────

export type EndExclusivityResult =
  | { ok: true }
  | { ok: false; error: "product_not_found" | "not_exclusive" | "not_holder" | "revoke_window_closed" }

async function clearExclusivity(productId: string, expectHolderId: string): Promise<boolean> {
  // Guarded by the holder so two concurrent ends (or a grant that raced in) cannot clear someone else's grant.
  const res = await prisma.product.updateMany({
    where: { id: productId, exclusiveAffiliateId: expectHolderId },
    data: { exclusiveAffiliateId: null, exclusiveGrantedAt: null, exclusiveUntil: null },
  })
  return res.count > 0
}

/** The holder gives the exclusivity back at any time. */
export async function releaseProductExclusivity(args: {
  affiliateId: string
  productId: string
  now?: Date
}): Promise<EndExclusivityResult> {
  const now = args.now ?? new Date()
  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    select: { id: true, name: true, supplierId: true, exclusiveAffiliateId: true, exclusiveUntil: true },
  })
  if (!product) return { ok: false, error: "product_not_found" }
  const holder = exclusiveHolderOf(product, now)
  if (!holder) return { ok: false, error: "not_exclusive" }
  if (holder !== args.affiliateId) return { ok: false, error: "not_holder" }

  if (!(await clearExclusivity(product.id, args.affiliateId))) return { ok: false, error: "not_exclusive" }
  await notifyBestEffort([
    {
      userId: product.supplierId,
      type: EXCLUSIVITY_NOTIF.ENDED,
      message: `Le revendeur a rendu l'exclusivité de « ${product.name} » : le produit est de nouveau ouvert à tous les revendeurs.`,
    },
  ])
  console.log("[product-exclusivity]", { productId: product.id, affiliateId: args.affiliateId, result: "released" })
  return { ok: true }
}

/** The supplier undoes a grant — only inside the cooling-off window. */
export async function revokeProductExclusivity(args: {
  supplierId: string
  productId: string
  now?: Date
}): Promise<EndExclusivityResult> {
  const now = args.now ?? new Date()
  const product = await prisma.product.findFirst({
    where: { id: args.productId, supplierId: args.supplierId },
    select: { id: true, name: true, exclusiveAffiliateId: true, exclusiveGrantedAt: true, exclusiveUntil: true },
  })
  if (!product) return { ok: false, error: "product_not_found" }
  const holder = exclusiveHolderOf(product, now)
  if (!holder) return { ok: false, error: "not_exclusive" }
  if (!canSupplierRevokeExclusivity(product.exclusiveGrantedAt, now)) {
    return { ok: false, error: "revoke_window_closed" }
  }

  if (!(await clearExclusivity(product.id, holder))) return { ok: false, error: "not_exclusive" }
  await notifyBestEffort([
    {
      userId: holder,
      type: EXCLUSIVITY_NOTIF.ENDED,
      message: `Le fournisseur a annulé l'exclusivité de « ${product.name} » (erreur d'attribution).`,
    },
  ])
  console.log("[product-exclusivity]", { productId: product.id, affiliateId: holder, result: "revoked" })
  return { ok: true }
}

// ─── Requests ───────────────────────────────────────────────────────────────────────────────────────────────

export type RequestExclusivityResult =
  | { ok: true; requestId: string }
  | { ok: false; error: "product_not_found" | "own_product" | "no_store" | "already_exclusive" | "already_requested" }

export async function requestProductExclusivity(args: {
  affiliateId: string
  productId: string
  message?: unknown
  now?: Date
}): Promise<RequestExclusivityResult> {
  const now = args.now ?? new Date()
  const product = await prisma.product.findFirst({
    where: { id: args.productId, active: true, isDraft: false },
    select: { id: true, name: true, images: true, supplierId: true, exclusiveAffiliateId: true, exclusiveUntil: true },
  })
  if (!product) return { ok: false, error: "product_not_found" }
  if (product.supplierId === args.affiliateId) return { ok: false, error: "own_product" }
  if (exclusiveHolderOf(product, now)) return { ok: false, error: "already_exclusive" }

  const store = await prisma.store.findUnique({ where: { userId: args.affiliateId }, select: { name: true } })
  if (!store) return { ok: false, error: "no_store" }

  const message =
    typeof args.message === "string" ? args.message.trim().slice(0, EXCLUSIVITY_REQUEST_MESSAGE_MAX) || null : null

  let requestId: string
  try {
    const created = await prisma.productExclusivityRequest.create({
      data: { productId: product.id, supplierId: product.supplierId, affiliateId: args.affiliateId, message },
      select: { id: true },
    })
    requestId = created.id
  } catch (error) {
    // Partial unique index: one open request per reseller and product.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "already_requested" }
    }
    throw error
  }

  await notifyBestEffort([
    {
      userId: product.supplierId,
      type: EXCLUSIVITY_NOTIF.REQUEST,
      message: `${store.name} demande l'exclusivité sur « ${product.name} ».`,
      imageUrl: primaryProductImage(product.images) ?? null,
    },
  ])
  console.log("[product-exclusivity]", { productId: product.id, affiliateId: args.affiliateId, result: "requested" })
  return { ok: true, requestId }
}

export async function cancelExclusivityRequest(args: { affiliateId: string; productId: string }): Promise<boolean> {
  const res = await prisma.productExclusivityRequest.updateMany({
    where: { productId: args.productId, affiliateId: args.affiliateId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: new Date() },
  })
  return res.count > 0
}

export async function declineExclusivityRequest(args: {
  supplierId: string
  requestId: string
  now?: Date
}): Promise<{ ok: boolean }> {
  const row = await prisma.productExclusivityRequest.findFirst({
    where: { id: args.requestId, supplierId: args.supplierId, status: "PENDING" },
    select: { id: true, affiliateId: true, productId: true },
  })
  if (!row) return { ok: false }

  // Claim by status so two concurrent answers cannot both win.
  const claimed = await prisma.productExclusivityRequest.updateMany({
    where: { id: row.id, status: "PENDING" },
    data: { status: "DECLINED", respondedAt: args.now ?? new Date() },
  })
  if (claimed.count === 0) return { ok: false }

  const product = await prisma.product.findUnique({ where: { id: row.productId }, select: { name: true, images: true } })
  await notifyBestEffort([
    {
      userId: row.affiliateId,
      type: EXCLUSIVITY_NOTIF.DECLINED,
      message: `Votre demande d'exclusivité sur « ${product?.name ?? "ce produit"} » a été déclinée par le fournisseur.`,
      imageUrl: product ? (primaryProductImage(product.images) ?? null) : null,
    },
  ])
  return { ok: true }
}

// ─── Read models for the UIs ────────────────────────────────────────────────────────────────────────────────

export type SupplierProductExclusivity = {
  holder: {
    affiliateId: string
    storeName: string | null
    grantedAt: Date | null
    until: Date
    canRevoke: boolean
  } | null
  requests: { id: string; affiliateId: string; storeName: string | null; message: string | null; createdAt: Date }[]
  /** Other resellers currently listing the product — what a grant with `evictOthers` would remove. */
  liveListings: number
}

export async function loadSupplierProductExclusivity(
  supplierId: string,
  productId: string,
  now: Date = new Date()
): Promise<SupplierProductExclusivity | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, exclusiveAffiliateId: true, exclusiveGrantedAt: true, exclusiveUntil: true },
  })
  if (!product) return null

  const [requests, liveListings] = await Promise.all([
    prisma.productExclusivityRequest.findMany({
      where: { productId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, affiliateId: true, message: true, createdAt: true },
    }),
    prisma.affiliateProduct.count({ where: { productId, isListed: true } }),
  ])

  const holderId = exclusiveHolderOf(product, now)
  const affiliateIds = [...new Set([...(holderId ? [holderId] : []), ...requests.map((r) => r.affiliateId)])]
  const stores = affiliateIds.length
    ? await prisma.store.findMany({ where: { userId: { in: affiliateIds } }, select: { userId: true, name: true } })
    : []
  const storeName = (id: string) => stores.find((s) => s.userId === id)?.name ?? null

  return {
    holder:
      holderId && product.exclusiveUntil
        ? {
            affiliateId: holderId,
            storeName: storeName(holderId),
            grantedAt: product.exclusiveGrantedAt,
            until: product.exclusiveUntil,
            canRevoke: canSupplierRevokeExclusivity(product.exclusiveGrantedAt, now),
          }
        : null,
    requests: requests.map((r) => ({ ...r, storeName: storeName(r.affiliateId) })),
    liveListings,
  }
}

export async function loadAffiliateProductExclusivityState(
  affiliateId: string,
  productId: string,
  now: Date = new Date()
): Promise<{ state: AffiliateExclusivityState; until: Date | null } | null> {
  const [product, openRequest] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { exclusiveAffiliateId: true, exclusiveUntil: true },
    }),
    prisma.productExclusivityRequest.findFirst({
      where: { productId, affiliateId, status: "PENDING" },
      select: { id: true },
    }),
  ])
  if (!product) return null
  const state = affiliateExclusivityState({ product, affiliateId, hasOpenRequest: Boolean(openRequest), now })
  return { state, until: state === "mine" ? product.exclusiveUntil : null }
}

// ─── internals ──────────────────────────────────────────────────────────────────────────────────────────────

type NotificationInput = {
  userId: string
  type: string
  message: string
  imageUrl?: string | null
  orderId?: string | null
}

async function notifyBestEffort(items: NotificationInput[]): Promise<void> {
  if (items.length === 0) return
  try {
    await prisma.notification.createMany({
      data: items.map((n) => ({
        userId: n.userId,
        type: n.type,
        message: n.message,
        imageUrl: n.imageUrl ?? null,
        orderId: n.orderId ?? null,
      })),
    })
  } catch (error) {
    console.error("[product-exclusivity] notify_failed", error instanceof Error ? error.message : String(error))
  }
}
