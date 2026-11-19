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
export async function loadReplacementProposal(affiliateId: string, listingId: string): Promise<LoadedProposal> {
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
    return { ok: true, proposal: buildReplacementProposal(original, [], { affiliateFeeBps: user?.affiliatePlatformFeeBps ?? null }), listingIsListed: listing.isListed }
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
  }))

  return {
    ok: true,
    proposal: buildReplacementProposal(original, candidates, { affiliateFeeBps: user?.affiliatePlatformFeeBps ?? null }),
    listingIsListed: listing.isListed,
  }
}

export type ReplaceOutcome =
  | { ok: true; newListingId: string; newListingLive: boolean; previousListingWithdrawn: boolean }
  | {
      ok: false
      error: "not_found" | "not_confirmed" | "alternative_not_offered" | "add_failed"
      message?: string
    }

/**
 * The reseller CONFIRMED a replacement. Re-runs the proposal (the alternative must still be one of the offered,
 * sellable ones), adds it through the existing quick add (same rules and publication gates), THEN withdraws the old
 * listing from the shop: `isListed = false` — the listing row, its statistics, price history and every order stay
 * exactly as they are (nothing is deleted, no order is touched). Traced in `AuditLog` `affiliate.listing_replaced`.
 * If the add fails, nothing changes.
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
  if (proposal.status !== "found" || !proposal.alternatives.some((a) => a.productId === args.productId)) {
    return { ok: false, error: "alternative_not_offered" }
  }

  const added = await quickAddAffiliateListing({ affiliateId: args.affiliateId, productId: args.productId })
  if (!added.ok) return { ok: false, error: "add_failed", message: added.error }

  let withdrawn = false
  try {
    await prisma.$transaction(async (tx) => {
      await tx.affiliateProduct.updateMany({
        where: { id: args.listingId, affiliateId: args.affiliateId },
        data: { isListed: false },
      })
      await tx.auditLog.create({
        data: {
          action: "affiliate.listing_replaced",
          entityType: "AffiliateProduct",
          entityId: args.listingId,
          actorId: args.affiliateId,
          payload: {
            fromListingId: args.listingId,
            fromProductId: proposal.original.productId,
            toListingId: added.listing.id,
            toProductId: args.productId,
            problem: proposal.original.problem,
          },
        },
      })
    })
    withdrawn = true
  } catch (error) {
    // The new listing exists; the old one stays as it was. Said to the reseller, never hidden.
    console.error("[listing-replace] withdraw_failed", { listingId: args.listingId, error: error instanceof Error ? error.message : "unknown" })
  }
  return { ok: true, newListingId: added.listing.id, newListingLive: added.listing.isListed, previousListingWithdrawn: withdrawn }
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
