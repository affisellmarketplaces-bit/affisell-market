import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { decideImportPublication } from "@/lib/listing-compliance/import-publication.server"
import { prisma } from "@/lib/prisma"
import {
  canApplyReviewDecision,
  importReviewStateFromTags,
  IMPORT_REVIEW_TAG_PREFIX,
  RESELLER_URL_IMPORT_SOURCE_VALUE,
  reviewableState,
  withImportReviewState,
  type ReviewDecision,
} from "@/lib/reseller-import/review"

export type ResellerImportReviewRow = {
  productId: string
  name: string
  state: "pending" | "legacy_unreviewed" | "rejected"
  live: boolean
  sourceUrl: string | null
  createdAt: string
  listings: number
  listRequests: number
}

/** ADMIN: reseller imports waiting for a decision (pending, rejected, and legacy imports never reviewed). Read-only. */
export async function listResellerImportsForReview(limit = 100): Promise<ResellerImportReviewRow[]> {
  const rows = await prisma.product.findMany({
    where: {
      importSource: RESELLER_URL_IMPORT_SOURCE_VALUE,
      NOT: { tags: { has: `${IMPORT_REVIEW_TAG_PREFIX}approved` } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, limit), 500),
    select: {
      id: true,
      name: true,
      tags: true,
      active: true,
      isDraft: true,
      sourceUrl: true,
      createdAt: true,
      _count: { select: { affiliateProducts: true } },
    },
  })
  const requests = await prisma.auditLog.groupBy({
    by: ["entityId"],
    where: { action: "reseller_import.submitted", entityId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  })
  const requestCount = new Map(requests.map((r) => [r.entityId, r._count._all]))
  return rows.map((r) => {
    const tagged = importReviewStateFromTags(r.tags)
    return {
      productId: r.id,
      name: r.name,
      state: tagged === "rejected" ? "rejected" : tagged === "pending" ? "pending" : "legacy_unreviewed",
      live: r.active && !r.isDraft,
      sourceUrl: r.sourceUrl,
      createdAt: r.createdAt.toISOString(),
      listings: r._count.affiliateProducts,
      listRequests: requestCount.get(r.id) ?? 0,
    }
  })
}

export type ReviewOutcome =
  | { ok: true; state: "approved" | "rejected"; listedListings: number; unlistedListings: number }
  | { ok: false; error: "not_found" | "not_a_reseller_import" | "transition_not_allowed" | "listing_not_ready" }

/**
 * ADMIN decision on a reseller import. Approve = the same readiness gate as a hand-made sheet, then publication and
 * the listings whose reseller asked to go live are listed. Reject = draft, every listing of the product unlisted.
 * Every decision is an AuditLog row (who, what, why). Never touches an order.
 */
export async function applyResellerImportReview(args: {
  productId: string
  decision: ReviewDecision
  note: string
  adminId: string
}): Promise<ReviewOutcome> {
  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    select: {
      id: true,
      supplierId: true,
      importSource: true,
      tags: true,
      listingKind: true,
      attributes: { select: { key: true, value: true } },
    },
  })
  if (!product) return { ok: false, error: "not_found" }
  const current = reviewableState(product)
  if (current == null) return { ok: false, error: "not_a_reseller_import" }
  if (!canApplyReviewDecision(current, args.decision)) return { ok: false, error: "transition_not_allowed" }

  if (args.decision === "approve") {
    const publication = decideImportPublication({
      source: "import_reseller_url",
      supplierId: product.supplierId,
      productId: product.id,
      listingKind: product.listingKind,
      wantLive: true,
      attributes: product.attributes,
    })
    if (!publication.live) return { ok: false, error: "listing_not_ready" }
  }

  const requested =
    args.decision === "approve"
      ? await prisma.auditLog.findMany({
          where: { action: "reseller_import.submitted", entityId: product.id },
          select: { payload: true },
        })
      : []
  const listingIds = requested
    .map((r) => r.payload as { affiliateProductId?: unknown; listRequested?: unknown } | null)
    .filter((p) => p?.listRequested === true && typeof p.affiliateProductId === "string")
    .map((p) => p!.affiliateProductId as string)

  return prisma.$transaction(async (tx) => {
    let listed = 0
    let unlisted = 0
    if (args.decision === "approve") {
      await tx.product.update({
        where: { id: product.id },
        data: { active: true, isDraft: false, tags: withImportReviewState(product.tags, "approved") },
      })
      if (listingIds.length > 0) {
        listed = (await tx.affiliateProduct.updateMany({ where: { id: { in: listingIds }, productId: product.id }, data: { isListed: true } })).count
      }
    } else {
      await tx.product.update({
        where: { id: product.id },
        data: { active: false, isDraft: true, tags: withImportReviewState(product.tags, "rejected") },
      })
      unlisted = (await tx.affiliateProduct.updateMany({ where: { productId: product.id, isListed: true }, data: { isListed: false } })).count
    }
    await tx.auditLog.create({
      data: {
        action: "reseller_import.reviewed",
        entityType: "Product",
        entityId: product.id,
        actorId: args.adminId,
        payload: { decision: args.decision, from: current, note: args.note.slice(0, 1000), listed, unlisted },
      },
    })
    return {
      ok: true as const,
      state: args.decision === "approve" ? ("approved" as const) : ("rejected" as const),
      listedListings: listed,
      unlistedListings: unlisted,
    }
  })
}

export type ResellerImportDetail = {
  productId: string
  name: string
  state: "pending" | "legacy_unreviewed" | "rejected" | "approved"
  live: boolean
  sourceUrl: string | null
  importedAt: string
  images: string[]
  descriptionExcerpt: string
  supplierPriceCents: number
  stock: number
  listingKind: string | null
  /** Product-safety / identity data the publication gate checks (presence and format only). */
  readiness: { applicable: boolean; ready: boolean; blocking: string[]; advisory: string[] }
  listings: Array<{
    listingId: string
    resellerName: string
    sellingPriceCents: number
    isListed: boolean
    listRequested: boolean
    createdAt: string
  }>
  history: Array<{ at: string; decision: string; note: string }>
}

/** ADMIN: everything needed to VERIFY one reseller import before deciding. Read-only. */
export async function loadResellerImportDetail(productId: string): Promise<ResellerImportDetail | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      tags: true,
      importSource: true,
      active: true,
      isDraft: true,
      sourceUrl: true,
      createdAt: true,
      images: true,
      description: true,
      basePriceCents: true,
      stock: true,
      listingKind: true,
      attributes: { select: { key: true, value: true } },
      affiliateProducts: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          sellingPriceCents: true,
          isListed: true,
          createdAt: true,
          affiliate: { select: { name: true } },
        },
      },
    },
  })
  if (!product || reviewableState(product) == null) return null

  const [submitted, reviewed] = await Promise.all([
    prisma.auditLog.findMany({
      where: { action: "reseller_import.submitted", entityId: product.id },
      select: { payload: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "reseller_import.reviewed", entityId: product.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { createdAt: true, payload: true },
    }),
  ])
  const requested = new Set(
    submitted
      .map((r) => r.payload as { affiliateProductId?: unknown; listRequested?: unknown } | null)
      .filter((p) => p?.listRequested === true && typeof p.affiliateProductId === "string")
      .map((p) => p!.affiliateProductId as string)
  )
  const readiness = evaluateListingReadiness({ listingKind: product.listingKind, attributes: product.attributes })
  const tagged = importReviewStateFromTags(product.tags)
  return {
    productId: product.id,
    name: product.name,
    state:
      tagged === "approved" || tagged === "rejected" || tagged === "pending" ? tagged : "legacy_unreviewed",
    live: product.active && !product.isDraft,
    sourceUrl: product.sourceUrl,
    importedAt: product.createdAt.toISOString(),
    images: product.images.slice(0, 8),
    descriptionExcerpt: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
    supplierPriceCents: product.basePriceCents,
    stock: product.stock,
    listingKind: product.listingKind,
    readiness: {
      applicable: readiness.applicable,
      ready: readiness.ready,
      blocking: readiness.blocking.map((i) => i.code),
      advisory: readiness.advisory.map((i) => i.code),
    },
    listings: product.affiliateProducts.map((l) => ({
      listingId: l.id,
      // A display name for the admin; never the e-mail (the admin page does not need it).
      resellerName: l.affiliate.name?.trim() || "Revendeur sans nom",
      sellingPriceCents: l.sellingPriceCents,
      isListed: l.isListed,
      listRequested: requested.has(l.id),
      createdAt: l.createdAt.toISOString(),
    })),
    history: reviewed.map((r) => {
      const p = (r.payload ?? {}) as { decision?: unknown; note?: unknown }
      return {
        at: r.createdAt.toISOString(),
        decision: typeof p.decision === "string" ? p.decision : "?",
        note: typeof p.note === "string" ? p.note : "",
      }
    }),
  }
}
