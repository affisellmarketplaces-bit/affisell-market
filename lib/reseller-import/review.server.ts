import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { CANONICAL_LABELS, LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"
import { prisma } from "@/lib/prisma"
import { isStockUnconfirmed } from "@/lib/import-stock"
import {
  canApplyReviewDecision,
  importPublicationStatus,
  importReviewStateFromTags,
  IMPORT_REVIEW_TAG_PREFIX,
  RESELLER_URL_IMPORT_SOURCE_VALUE,
  reviewableState,
  withImportReviewState,
  type ReviewDecision,
} from "@/lib/reseller-import/review"
import { declareListingPresenceSource } from "@/lib/listing-presence/record.server"

export type ResellerImportReviewRow = {
  productId: string
  name: string
  state: "pending" | "legacy_unreviewed" | "rejected" | "approved_awaiting_publication"
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
      // Approved imports leave the list once published; an approved one still a draft (safety data to complete) stays.
      OR: [{ NOT: { tags: { has: `${IMPORT_REVIEW_TAG_PREFIX}approved` } } }, { isDraft: true }],
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
      state:
        tagged === "rejected"
          ? "rejected"
          : tagged === "pending"
            ? "pending"
            : tagged === "approved"
              ? "approved_awaiting_publication"
              : "legacy_unreviewed",
      live: r.active && !r.isDraft,
      sourceUrl: r.sourceUrl,
      createdAt: r.createdAt.toISOString(),
      listings: r._count.affiliateProducts,
      listRequests: requestCount.get(r.id) ?? 0,
    }
  })
}

export type ReviewOutcome =
  | {
      ok: true
      state: "approved" | "rejected"
      /** Approval only: whether the product could be published now (compliance judged strictly). */
      published: boolean
      /** Approval only, when not published: the blocking product-safety codes to complete first. */
      blocking: string[]
      listedListings: number
      unlistedListings: number
    }
  | { ok: false; error: "not_found" | "not_a_reseller_import" | "transition_not_allowed" }

const PRODUCT_FOR_REVIEW = {
  id: true,
  supplierId: true,
  importSource: true,
  tags: true,
  listingKind: true,
  active: true,
  isDraft: true,
  attributes: { select: { key: true, value: true } },
} as const

async function requestedListingIds(productId: string): Promise<string[]> {
  const requested = await prisma.auditLog.findMany({
    where: { action: "reseller_import.submitted", entityId: productId },
    select: { payload: true },
  })
  return requested
    .map((r) => r.payload as { affiliateProductId?: unknown; listRequested?: unknown } | null)
    .filter((p) => p?.listRequested === true && typeof p.affiliateProductId === "string")
    .map((p) => p!.affiliateProductId as string)
}

/**
 * ADMIN decision on a reseller import — the REVIEW only (`importPublicationStatus` keeps review, compliance and
 * publication apart). Approve records the approval; the product is published, and the listings whose reseller asked
 * to go live are listed, ONLY when the sheet has no blocking product-safety issue — judged strictly, whatever
 * `LISTING_READINESS_MODE` says. Otherwise it stays a draft (`published: false` + the codes to complete), and
 * `publishApprovedResellerImport` publishes it once completed. A product ALREADY live (legacy) keeps its publication
 * state: pulling legacy imports is a founder decision. Reject = draft, every listing unlisted. Every decision is an
 * AuditLog row (who, what, why). Never touches an order.
 */
export async function applyResellerImportReview(args: {
  productId: string
  decision: ReviewDecision
  note: string
  adminId: string
}): Promise<ReviewOutcome> {
  const product = await prisma.product.findUnique({ where: { id: args.productId }, select: PRODUCT_FOR_REVIEW })
  if (!product) return { ok: false, error: "not_found" }
  const current = reviewableState(product)
  if (current == null) return { ok: false, error: "not_a_reseller_import" }
  if (!canApplyReviewDecision(current, args.decision)) return { ok: false, error: "transition_not_allowed" }

  const readiness = evaluateListingReadiness({ listingKind: product.listingKind, attributes: product.attributes })
  const status =
    args.decision === "approve"
      ? importPublicationStatus({
          reviewState: "approved",
          compliance: { applicable: readiness.applicable, blocking: readiness.blocking.map((i) => i.code) },
          stockUnconfirmed: isStockUnconfirmed(product.attributes),
        })
      : null
  const alreadyLive = product.active && !product.isDraft
  const publishNow = status?.publishable === true && !alreadyLive
  const listingIds = publishNow ? await requestedListingIds(product.id) : []

  return prisma.$transaction(async (tx) => {
    await declareListingPresenceSource(tx, { source: "admin_review", actorId: args.adminId })
    let listed = 0
    let unlisted = 0
    if (args.decision === "approve") {
      await tx.product.update({
        where: { id: product.id },
        data: {
          tags: withImportReviewState(product.tags, "approved"),
          ...(publishNow ? { active: true, isDraft: false } : {}),
        },
      })
      if (publishNow && listingIds.length > 0) {
        listed = (await tx.affiliateProduct.updateMany({ where: { id: { in: listingIds }, productId: product.id }, data: { isListed: true } })).count
      }
    } else {
      await tx.product.update({
        where: { id: product.id },
        data: { active: false, isDraft: true, tags: withImportReviewState(product.tags, "rejected") },
      })
      unlisted = (await tx.affiliateProduct.updateMany({ where: { productId: product.id, isListed: true }, data: { isListed: false } })).count
    }
    const blocking = status && !status.publishable ? status.blocking : []
    const published = args.decision === "approve" && (publishNow || alreadyLive)
    await tx.auditLog.create({
      data: {
        action: "reseller_import.reviewed",
        entityType: "Product",
        entityId: product.id,
        actorId: args.adminId,
        payload: {
          decision: args.decision,
          from: current,
          note: args.note.slice(0, 1000),
          listed,
          unlisted,
          published,
          alreadyLive,
          blocking,
        },
      },
    })
    return {
      ok: true as const,
      state: args.decision === "approve" ? ("approved" as const) : ("rejected" as const),
      published,
      blocking: args.decision === "approve" && !publishNow && !alreadyLive ? blocking : [],
      listedListings: listed,
      unlistedListings: unlisted,
    }
  })
}

export type PublishOutcome =
  | { ok: true; listedListings: number }
  | { ok: false; error: "not_found" | "not_approved" | "already_live" | "compliance_blocking" | "stock_unconfirmed"; blocking?: string[] }

/**
 * ADMIN: publish an APPROVED import once its sheet is complete. Compliance is re-judged strictly at this moment; the
 * listings whose reseller asked to go live are listed. AuditLog `reseller_import.published`.
 */
export async function publishApprovedResellerImport(args: { productId: string; adminId: string; note: string }): Promise<PublishOutcome> {
  const product = await prisma.product.findUnique({ where: { id: args.productId }, select: PRODUCT_FOR_REVIEW })
  if (!product || reviewableState(product) == null) return { ok: false, error: "not_found" }
  if (product.active && !product.isDraft) return { ok: false, error: "already_live" }
  const readiness = evaluateListingReadiness({ listingKind: product.listingKind, attributes: product.attributes })
  const status = importPublicationStatus({
    reviewState: importReviewStateFromTags(product.tags) ?? "legacy_unreviewed",
    compliance: { applicable: readiness.applicable, blocking: readiness.blocking.map((i) => i.code) },
    stockUnconfirmed: isStockUnconfirmed(product.attributes),
  })
  if (!status.publishable) {
    return status.reason === "compliance_blocking"
      ? { ok: false, error: "compliance_blocking", blocking: status.blocking }
      : status.reason === "stock_unconfirmed"
        ? { ok: false, error: "stock_unconfirmed" }
        : { ok: false, error: "not_approved" }
  }
  const listingIds = await requestedListingIds(product.id)
  return prisma.$transaction(async (tx) => {
    await declareListingPresenceSource(tx, { source: "admin_review", actorId: args.adminId })
    await tx.product.update({ where: { id: product.id }, data: { active: true, isDraft: false } })
    const listed =
      listingIds.length > 0
        ? (await tx.affiliateProduct.updateMany({ where: { id: { in: listingIds }, productId: product.id }, data: { isListed: true } })).count
        : 0
    await tx.auditLog.create({
      data: {
        action: "reseller_import.published",
        entityType: "Product",
        entityId: product.id,
        actorId: args.adminId,
        payload: { note: args.note.slice(0, 1000), listed },
      },
    })
    return { ok: true as const, listedListings: listed }
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
  /** Review, compliance and publication kept apart: may this product be published now? */
  publication: { publishable: boolean; reason: string | null }
  /** Current compliance values (reserved keys only), to complete them from the admin page. */
  complianceValues: Record<string, string>
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
    complianceValues: Object.fromEntries(
      product.attributes.filter((a) => LISTING_COMPLIANCE_KEYS.includes(a.key)).map((a) => [a.key, a.value])
    ),
    publication: (() => {
      const st = importPublicationStatus({
        reviewState: tagged ?? "legacy_unreviewed",
        compliance: { applicable: readiness.applicable, blocking: readiness.blocking.map((i) => i.code) },
        stockUnconfirmed: isStockUnconfirmed(product.attributes),
      })
      return { publishable: st.publishable, reason: st.publishable ? null : st.reason }
    })(),
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

export type ComplianceUpdateOutcome =
  | { ok: true; ready: boolean; blocking: string[] }
  | { ok: false; error: "not_found" | "already_live" | "invalid_body" }

/**
 * ADMIN: complete the product-safety / identity data of a reseller import that is NOT live (the Import Vault account
 * has no supplier to do it). Only the reserved compliance keys are written; other attributes are untouched. A live
 * product is refused — existing listings are not modified (founder rule). AuditLog `reseller_import.compliance_updated`
 * (keys only, never the values). Publication stays a separate, explicit action.
 */
export async function updateResellerImportCompliance(args: {
  productId: string
  adminId: string
  values: Record<string, unknown>
}): Promise<ComplianceUpdateOutcome> {
  const product = await prisma.product.findUnique({ where: { id: args.productId }, select: PRODUCT_FOR_REVIEW })
  if (!product || reviewableState(product) == null) return { ok: false, error: "not_found" }
  if (product.active && !product.isDraft) return { ok: false, error: "already_live" }
  const entries = Object.entries(args.values)
    .filter(([k, v]) => LISTING_COMPLIANCE_KEYS.includes(k) && typeof v === "string")
    .map(([k, v]) => [k, (v as string).trim().slice(0, 500)] as const)
  if (entries.length === 0) return { ok: false, error: "invalid_body" }
  const keys = entries.map(([k]) => k)
  await prisma.$transaction(async (tx) => {
    await tx.productAttribute.deleteMany({ where: { productId: product.id, key: { in: keys } } })
    const rows = entries.filter(([, v]) => v.length > 0)
    if (rows.length > 0) {
      await tx.productAttribute.createMany({
        data: rows.map(([key, value]) => ({ productId: product.id, key, label: CANONICAL_LABELS[key] ?? key, value })),
      })
    }
    await tx.auditLog.create({
      data: {
        action: "reseller_import.compliance_updated",
        entityType: "Product",
        entityId: product.id,
        actorId: args.adminId,
        payload: { keys },
      },
    })
  })
  const after = await prisma.productAttribute.findMany({ where: { productId: product.id }, select: { key: true, value: true } })
  const readiness = evaluateListingReadiness({ listingKind: product.listingKind, attributes: after })
  return { ok: true, ready: readiness.ready, blocking: readiness.blocking.map((i) => i.code) }
}
