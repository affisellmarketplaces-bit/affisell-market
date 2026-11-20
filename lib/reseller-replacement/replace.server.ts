import "server-only"

import type { Prisma } from "@prisma/client"

import { buildAffiliateCatalogProductWhere } from "@/lib/affiliate-catalog-query"
import { suggestedSellingPriceCents } from "@/lib/affiliate-catalog-margin-display"
import { quickAddAffiliateListing } from "@/lib/affiliate-quick-add-listing.server"
import { isValidGtin } from "@/lib/listing-compliance/gtin"
import { IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"
import { mayListOnProduct } from "@/lib/reseller-import/review"
import { availableUnits, listingProblem } from "@/lib/reseller-replacement/listing-state"
import {
  buildReplacementProposal,
  gtin14,
  type ReplacementCandidate,
  type ReplacementProposal,
} from "@/lib/reseller-replacement/match"
import {
  decideFinish,
  mayStartReplacement,
  pendingReplacement,
  REPLACE_DONE_ACTION,
  REPLACE_STARTED_ACTION,
  replaceDoneId,
  replaceStartedId,
  type PendingReplacement,
  type ReplacementStart,
} from "@/lib/reseller-replacement/resume"
import { locateWatchedVariant } from "@/lib/restock-watch/restock-watch"
import { rowsForChoice } from "@/lib/variant-selection"
import { effectiveReturnWindowDays, parseReturnWindowDays, RETURN_WINDOW_KEY } from "@/lib/return-terms"
import { explicitSupplierCommissionPct, productHasExplicitSupplierCommission } from "@/lib/supplier-explicit-commission"
import { resellerFacingSupplierLabel } from "@/lib/supplier-public-label"

const MAX_CANDIDATES = 200
const ATTR_KEYS = [IDENTITY_KEYS.gtin, "brand", RETURN_WINDOW_KEY]

const PRODUCT_SELECT = {
  id: true,
  name: true,
  images: true,
  categoryId: true,
  basePriceCents: true,
  commissionRate: true,
  offerMode: true,
  variants: true,
  hasVariants: true,
  stock: true,
  listingKind: true,
  active: true,
  isDraft: true,
  tags: true,
  colors: true,
  deliveryMax: true,
  customColumns: true,
  productVariants: { select: { color: true, size: true, stock: true, customData: true }, take: 200 },
  supplier: { select: { store: { select: { name: true } } } },
  attributes: { where: { key: { in: ATTR_KEYS } }, select: { key: true, value: true } },
} satisfies Prisma.ProductSelect

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>

function attr(p: ProductRow, key: string): string | null {
  return p.attributes.find((a) => a.key === key)?.value?.trim() || null
}

function sizesOf(p: ProductRow): string[] {
  const size = (p.variants as { size?: unknown } | null)?.size
  return Array.isArray(size) ? size.filter((s): s is string => typeof s === "string" && s.trim() !== "") : []
}

function returnWindow(p: ProductRow): number {
  return effectiveReturnWindowDays(parseReturnWindowDays(attr(p, RETURN_WINDOW_KEY)))
}

export type LoadedProposal =
  | { ok: true; proposal: ReplacementProposal; listingIsListed: boolean }
  | { ok: false; error: "not_found" }

/**
 * READ-ONLY: the listing's problem and up to three really equivalent, sellable alternatives with the reseller's real
 * net per sale on each side and the differences. Scoped to the reseller (another reseller's listing = not found).
 */
export async function loadReplacementProposal(
  affiliateId: string,
  listingId: string,
  opts: { wantedVariantKey?: string } = {}
): Promise<LoadedProposal> {
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id: listingId, affiliateId },
    select: { id: true, isListed: true, sellingPriceCents: true, product: { select: PRODUCT_SELECT } },
  })
  if (!listing) return { ok: false, error: "not_found" }
  const p = listing.product
  const user = await prisma.user.findUnique({ where: { id: affiliateId }, select: { affiliatePlatformFeeBps: true } })

  const original = {
    listingId: listing.id,
    productId: p.id,
    name: p.name,
    categoryId: p.categoryId,
    gtin14: gtin14(attr(p, IDENTITY_KEYS.gtin), isValidGtin),
    brand: attr(p, "brand"),
    supplierPriceCents: p.basePriceCents,
    commissionPct: explicitSupplierCommissionPct({ commissionRate: Number(p.commissionRate) || 0, variants: p.variants }),
    sellingPriceHtCents: listing.sellingPriceCents,
    colors: p.colors,
    sizes: sizesOf(p),
    deliveryMaxDays: p.deliveryMax ?? null,
    returnWindowDays: returnWindow(p),
    problem: listingProblem({ ...p, commissionRate: Number(p.commissionRate) || 0 }),
  }

  // Candidates: what this reseller may see in its catalogue (same visibility rules), sharing the barcode or the category.
  const visible = await buildAffiliateCatalogProductWhere(new URLSearchParams(), { affiliateId })
  const or: Prisma.ProductWhereInput[] = []
  if (p.categoryId) or.push({ categoryId: p.categoryId })
  const rawGtin = attr(p, IDENTITY_KEYS.gtin)
  if (original.gtin14 && rawGtin) {
    const digits = original.gtin14.replace(/^0+/, "")
    const spellings = [...new Set([rawGtin, original.gtin14, digits, digits.padStart(8, "0"), digits.padStart(12, "0"), digits.padStart(13, "0")])]
    or.push({ attributes: { some: { key: IDENTITY_KEYS.gtin, value: { in: spellings } } } })
  }
  if (or.length === 0) {
    return {
      ok: true,
      proposal: buildReplacementProposal(original, [], { affiliateFeeBps: user?.affiliatePlatformFeeBps ?? null, wantedVariant: Boolean(opts.wantedVariantKey) }),
      listingIsListed: listing.isListed,
    }
  }
  const rows = await prisma.product.findMany({
    where: { AND: [visible, { id: { not: p.id } }, { OR: or }] },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
    select: PRODUCT_SELECT,
  })
  const existing = rows.length
    ? await prisma.affiliateProduct.findMany({
        where: { affiliateId, productId: { in: rows.map((r) => r.id) } },
        select: { productId: true, sellingPriceCents: true, isListed: true },
      })
    : []
  const existingBy = new Map(existing.map((e) => [e.productId, e]))

  const candidates: ReplacementCandidate[] = rows.map((r) => ({
    productId: r.id,
    name: r.name,
    imageUrl: primaryProductImage(r.images ?? []) || null,
    categoryId: r.categoryId,
    gtin14: gtin14(attr(r, IDENTITY_KEYS.gtin), isValidGtin),
    brand: attr(r, "brand"),
    supplierLabel: resellerFacingSupplierLabel(r.supplier?.store),
    supplierPriceCents: r.basePriceCents,
    commissionPct: explicitSupplierCommissionPct({ commissionRate: Number(r.commissionRate) || 0, variants: r.variants }),
    commissionExplicit: productHasExplicitSupplierCommission({
      commissionRate: Number(r.commissionRate) || 0,
      variants: r.variants,
      offerMode: r.offerMode,
    }),
    available: availableUnits(r),
    mayList: mayListOnProduct({ active: r.active, isDraft: r.isDraft, tags: r.tags }),
    colors: r.colors,
    sizes: sizesOf(r),
    deliveryMaxDays: r.deliveryMax ?? null,
    returnWindowDays: returnWindow(r),
    existingListing: existingBy.get(r.id) ?? null,
    defaultSellingPriceCents: suggestedSellingPriceCents(r.basePriceCents),
    // Wanted-variant mode: the SAME exact variant (shared key) in the candidate — never « a similar size ».
    ...(opts.wantedVariantKey
      ? (() => {
          const v = locateWatchedVariant(rowsForChoice(r.variants, r.productVariants, r.customColumns), r.customColumns, opts.wantedVariantKey!)
          return { wantedVariant: v.status === "found" ? { status: "found" as const, stock: v.stock } : { status: v.status } }
        })()
      : {}),
  }))

  return {
    ok: true,
    proposal: buildReplacementProposal(original, candidates, {
      affiliateFeeBps: user?.affiliatePlatformFeeBps ?? null,
      wantedVariant: Boolean(opts.wantedVariantKey),
    }),
    listingIsListed: listing.isListed,
  }
}

export type ReplaceOutcome =
  | {
      ok: true
      /** `complete` = alternative in the shop AND old listing withdrawn; `partial` = alternative added, old still in. */
      status: "complete" | "partial"
      newListingId: string
      newListingLive: boolean
      previousListingWithdrawn: boolean
    }
  | {
      ok: false
      error: "not_found" | "not_confirmed" | "alternative_not_offered" | "add_failed" | "replacement_pending" | "nothing_to_finish"
      message?: string
      pending?: { toProductId: string; newListingId: string }
    }

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002")
}

/** Every replacement ever STARTED for this listing, with its done marker and the reseller's listing of the target. */
async function loadReplacementStarts(affiliateId: string, listingId: string, onlyProductId?: string): Promise<ReplacementStart[]> {
  const rows = await prisma.auditLog.findMany({
    where: { action: REPLACE_STARTED_ACTION, entityType: "AffiliateProduct", entityId: listingId, actorId: affiliateId },
    select: { id: true, createdAt: true, payload: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  const starts = rows
    .map((r) => {
      const payload = (r.payload ?? {}) as { toProductId?: unknown }
      const toProductId = typeof payload.toProductId === "string" ? payload.toProductId : null
      // The id is deterministic: a row whose id does not match its payload is not trusted.
      if (!toProductId || r.id !== replaceStartedId(listingId, toProductId)) return null
      return { toProductId, startedAt: r.createdAt }
    })
    .filter((s): s is { toProductId: string; startedAt: Date } => s !== null)
    .filter((s) => !onlyProductId || s.toProductId === onlyProductId)
  if (starts.length === 0) return []
  const productIds = [...new Set(starts.map((s) => s.toProductId))]
  const [doneRows, listings] = await Promise.all([
    prisma.auditLog.findMany({
      where: { id: { in: productIds.map((pid) => replaceDoneId(listingId, pid)) } },
      select: { id: true },
    }),
    prisma.affiliateProduct.findMany({
      where: { affiliateId, productId: { in: productIds } },
      select: { id: true, productId: true, isListed: true },
    }),
  ])
  const done = new Set(doneRows.map((d) => d.id))
  const byProduct = new Map(listings.map((l) => [l.productId, l]))
  return starts.map((s) => {
    const l = byProduct.get(s.toProductId)
    return {
      toProductId: s.toProductId,
      startedAt: s.startedAt,
      done: done.has(replaceDoneId(listingId, s.toProductId)),
      newListing: l && l.id !== listingId ? { id: l.id, isListed: l.isListed } : null,
    }
  })
}

export type PendingReplacementView = PendingReplacement & { toProductName: string | null }

/** READ-ONLY: the replacement of this listing that was added but whose withdrawal did not happen, if any. */
export async function loadPendingReplacement(
  affiliateId: string,
  listingId: string,
  oldListingIsListed: boolean,
): Promise<PendingReplacementView | null> {
  const starts = await loadReplacementStarts(affiliateId, listingId)
  const pending = pendingReplacement({ oldListingIsListed, starts })
  if (!pending) return null
  const product = await prisma.product.findUnique({ where: { id: pending.toProductId }, select: { name: true } })
  return { ...pending, toProductName: product?.name ?? null }
}

/**
 * Step 2 alone: withdraw the old listing and record the replacement as done — ONE transaction, the done marker has a
 * deterministic id (recorded at most once). Never re-adds, never touches the new listing.
 */
async function withdrawReplacedListing(args: {
  affiliateId: string
  listingId: string
  fromProductId: string
  toProductId: string
  toListingId: string
  problem: string | null
}): Promise<"withdrawn" | "already_done" | "failed"> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const already = await tx.auditLog.findUnique({ where: { id: replaceDoneId(args.listingId, args.toProductId) }, select: { id: true } })
      if (already) return "already_done" as const
      await tx.affiliateProduct.updateMany({
        where: { id: args.listingId, affiliateId: args.affiliateId },
        data: { isListed: false },
      })
      await tx.auditLog.create({
        data: {
          id: replaceDoneId(args.listingId, args.toProductId),
          action: REPLACE_DONE_ACTION,
          entityType: "AffiliateProduct",
          entityId: args.listingId,
          actorId: args.affiliateId,
          payload: {
            fromListingId: args.listingId,
            fromProductId: args.fromProductId,
            toListingId: args.toListingId,
            toProductId: args.toProductId,
            problem: args.problem,
          },
        },
      })
      return "withdrawn" as const
    })
    return result
  } catch (error) {
    // A concurrent finish recorded it first: the withdrawal is done, once.
    if (isUniqueViolation(error)) return "already_done"
    console.error("[listing-replace] withdraw_failed", {
      listingId: args.listingId,
      error: error instanceof Error ? error.message : "unknown",
    })
    return "failed"
  }
}

/**
 * The reseller CONFIRMED a replacement. Re-runs the proposal (the alternative must still be one of the offered,
 * sellable ones), records that the replacement STARTED, adds it through the existing quick add (same rules and
 * publication gates), THEN withdraws the old listing from the shop: `isListed = false` — the listing row, its
 * statistics, price history and every order stay exactly as they are (nothing is deleted, no order is touched).
 * If the add fails, nothing changes. If the withdrawal fails, the answer says `partial` and the replace page offers
 * « Terminer le remplacement » (`finishReplacement`) — a retry of the same replacement is the same finish; another
 * replacement of that listing is refused while this one is pending (it would put a third product in the shop).
 */
export async function replaceListing(args: {
  affiliateId: string
  listingId: string
  productId: string
  confirm: boolean
}): Promise<ReplaceOutcome> {
  if (args.confirm !== true) return { ok: false, error: "not_confirmed" }
  const loaded = await loadReplacementProposal(args.affiliateId, args.listingId)
  if (!loaded.ok) return { ok: false, error: "not_found" }
  const { proposal } = loaded

  const starts = await loadReplacementStarts(args.affiliateId, args.listingId)
  const pending = pendingReplacement({ oldListingIsListed: loaded.listingIsListed, starts })
  const gate = mayStartReplacement(pending, args.productId)
  if (!gate.allow) {
    return {
      ok: false,
      error: "replacement_pending",
      pending: { toProductId: gate.pending.toProductId, newListingId: gate.pending.newListingId },
    }
  }
  // Same replacement retried after a partial run: the alternative is already in the shop (so no longer « offered »);
  // only the withdrawal is left.
  if (pending && pending.toProductId === args.productId) {
    return finishReplacement({ affiliateId: args.affiliateId, listingId: args.listingId, productId: args.productId, confirm: true })
  }

  if (proposal.status !== "found" || !proposal.alternatives.some((a) => a.productId === args.productId)) {
    return { ok: false, error: "alternative_not_offered" }
  }

  await prisma.auditLog.createMany({
    data: [
      {
        id: replaceStartedId(args.listingId, args.productId),
        action: REPLACE_STARTED_ACTION,
        entityType: "AffiliateProduct",
        entityId: args.listingId,
        actorId: args.affiliateId,
        payload: {
          fromListingId: args.listingId,
          fromProductId: proposal.original.productId,
          toProductId: args.productId,
          problem: proposal.original.problem,
        },
      },
    ],
    skipDuplicates: true,
  })

  const added = await quickAddAffiliateListing({ affiliateId: args.affiliateId, productId: args.productId })
  if (!added.ok) return { ok: false, error: "add_failed", message: added.error }

  const withdrawal = await withdrawReplacedListing({
    affiliateId: args.affiliateId,
    listingId: args.listingId,
    fromProductId: proposal.original.productId,
    toProductId: args.productId,
    toListingId: added.listing.id,
    problem: proposal.original.problem,
  })
  const withdrawn = withdrawal !== "failed"
  return {
    ok: true,
    status: withdrawn ? "complete" : "partial",
    newListingId: added.listing.id,
    newListingLive: added.listing.isListed,
    previousListingWithdrawn: withdrawn,
  }
}

/**
 * « Terminer le remplacement »: a replacement whose alternative was added but whose old listing is still in the shop.
 * Withdraws the old listing ONLY (never re-adds anything), refused when that replacement was never started or its new
 * listing does not exist. Idempotent: a second call answers `complete` and writes nothing.
 */
export async function finishReplacement(args: {
  affiliateId: string
  listingId: string
  productId: string
  confirm: boolean
}): Promise<ReplaceOutcome> {
  if (args.confirm !== true) return { ok: false, error: "not_confirmed" }
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id: args.listingId, affiliateId: args.affiliateId },
    select: { id: true, isListed: true, productId: true },
  })
  if (!listing) return { ok: false, error: "not_found" }
  const [start] = await loadReplacementStarts(args.affiliateId, args.listingId, args.productId)
  const decision = decideFinish({ start: start ?? null, oldListingIsListed: listing.isListed })
  if (decision.action === "refuse") return { ok: false, error: "nothing_to_finish", message: decision.reason }
  const newListing = start?.newListing ?? null
  if (decision.action === "already_done") {
    return {
      ok: true,
      status: "complete",
      newListingId: newListing?.id ?? "",
      newListingLive: newListing?.isListed ?? false,
      previousListingWithdrawn: true,
    }
  }
  const withdrawal = await withdrawReplacedListing({
    affiliateId: args.affiliateId,
    listingId: args.listingId,
    fromProductId: listing.productId,
    toProductId: args.productId,
    toListingId: newListing!.id,
    problem: null,
  })
  const withdrawn = withdrawal !== "failed"
  return {
    ok: true,
    status: withdrawn ? "complete" : "partial",
    newListingId: newListing!.id,
    newListingLive: newListing!.isListed,
    previousListingWithdrawn: withdrawn,
  }
}

/** Withdraw only (no alternative): the listing leaves the shop, everything about it is kept. Traced. */
export async function withdrawListing(affiliateId: string, listingId: string): Promise<{ ok: boolean }> {
  const res = await prisma.$transaction(async (tx) => {
    const r = await tx.affiliateProduct.updateMany({ where: { id: listingId, affiliateId }, data: { isListed: false } })
    if (r.count === 0) return 0
    await tx.auditLog.create({
      data: {
        action: "affiliate.listing_withdrawn",
        entityType: "AffiliateProduct",
        entityId: listingId,
        actorId: affiliateId,
        payload: { via: "replacement_flow" },
      },
    })
    return r.count
  })
  return { ok: res > 0 }
}

/**
 * READ-ONLY: every LIVE listing of this reseller whose product can not be bought today (same rule as the action card,
 * the replace page and the daily notice) — the page the daily summary links to. Own listings only, ≤ 500.
 */
export async function loadUnsellableListings(
  affiliateId: string,
): Promise<Array<{ listingId: string; productName: string; problem: NonNullable<ReturnType<typeof listingProblem>> }>> {
  const rows = await prisma.affiliateProduct.findMany({
    where: { affiliateId, isListed: true },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      product: {
        select: {
          name: true,
          active: true,
          isDraft: true,
          tags: true,
          stock: true,
          hasVariants: true,
          variants: true,
          listingKind: true,
          commissionRate: true,
          offerMode: true,
        },
      },
    },
  })
  const out: Array<{ listingId: string; productName: string; problem: NonNullable<ReturnType<typeof listingProblem>> }> = []
  for (const r of rows) {
    const problem = listingProblem({ ...r.product, commissionRate: Number(r.product.commissionRate) || 0 })
    if (problem) out.push({ listingId: r.id, productName: r.product.name, problem })
  }
  return out
}
