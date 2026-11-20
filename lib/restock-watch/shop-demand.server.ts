import "server-only"

import type { Prisma } from "@prisma/client"

import { quickAddAffiliateListing } from "@/lib/affiliate-quick-add-listing.server"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { loadReplacementProposal } from "@/lib/reseller-replacement/replace.server"
import type { ReplacementProposal } from "@/lib/reseller-replacement/match"
import { aggregateRestockDemand, type WatchedVariantToday } from "@/lib/restock-watch/restock-demand"
import { locateWatchedVariant, parseRestockWatch, RESTOCK_WATCH_ACTION, variantKeyHash, type RestockWatch } from "@/lib/restock-watch/restock-watch"
import {
  RECOVERY_WINDOW_DAYS,
  SHOP_DEMAND_CHOSEN_ACTION,
  SHOP_DEMAND_RECO_ACTION,
  SHOP_DEMAND_SHOWN_ACTION,
  shopDemandChosenId,
  shopDemandRecoId,
  shopDemandShownId,
  summarizeShopRecovery,
  type ChosenMarker,
  type ShopDemandItem,
  type ShopRecoverySummary,
  type ShownMarker,
} from "@/lib/restock-watch/shop-demand"
import { rowsForChoice } from "@/lib/variant-selection"

const DAY = 86_400_000
const MAX_LISTINGS = 2_000
const MAX_WATCHES = 20_000

/** The reseller's OWN listings and the requests made on them — nothing of any other shop is read. */
async function shopWatches(affiliateId: string) {
  const listings = await prisma.affiliateProduct.findMany({
    where: { affiliateId },
    select: {
      id: true,
      productId: true,
      customTitle: true,
      product: {
        select: {
          name: true,
          variants: true,
          customColumns: true,
          productVariants: { select: { color: true, size: true, stock: true, customData: true }, take: 200 },
        },
      },
    },
    take: MAX_LISTINGS,
  })
  const byId = new Map(listings.map((l) => [l.id, l]))
  const rows = listings.length
    ? await prisma.auditLog.findMany({
        where: { action: RESTOCK_WATCH_ACTION, entityId: { in: [...byId.keys()] } },
        select: { payload: true },
        take: MAX_WATCHES,
      })
    : []
  const watches = rows
    .map((r) => parseRestockWatch(r.payload))
    .filter((w): w is RestockWatch => w !== null && byId.has(w.listingId))
  return { listings: byId, watches }
}

/** Live shop signals: distinct buyers OF THIS SHOP per listing × exact variant, ≥ 3, variant still sold out. */
export async function loadShopRestockDemand(affiliateId: string, now = new Date()): Promise<ShopDemandItem[]> {
  const { listings, watches } = await shopWatches(affiliateId)
  // The group is the LISTING (one per product in a shop): requests of other shops can never join it.
  const asListing = watches.map((w) => ({ ...w, productId: w.listingId }))
  const variantToday = (listingId: string, variantKey: string): WatchedVariantToday => {
    const l = listings.get(listingId)
    if (!l) return { status: "unknown" }
    const rows = rowsForChoice(l.product.variants, l.product.productVariants, l.product.customColumns)
    const v = locateWatchedVariant(rows, l.product.customColumns, variantKey)
    if (v.status !== "found") return { status: v.status }
    if (v.stock > 0) return { status: "available" }
    const name = String((rows as { variantRows?: Array<{ name?: unknown }> }).variantRows?.[v.index]?.name ?? "").trim()
    return { status: "sold_out", label: name || "—" }
  }
  return aggregateRestockDemand({ watches: asListing, now, variantToday }).map((d) => {
    const l = listings.get(d.productId)!
    return {
      listingId: d.productId,
      productId: l.productId,
      productName: (l.customTitle?.trim() || l.product.name).slice(0, 120),
      variantKey: d.variantKey,
      variantLabel: d.variantLabel,
      buyers: d.buyers,
    }
  })
}

/** Records, once per shop demand, that the next-action card served it. Never throws. */
export async function markShopDemandRecommended(affiliateId: string, items: ReadonlyArray<{ listingId: string; variantKey: string }>): Promise<void> {
  if (items.length === 0) return
  try {
    await prisma.auditLog.createMany({
      data: items.map((i) => ({
        id: shopDemandRecoId(i.listingId, variantKeyHash(i.variantKey)),
        action: SHOP_DEMAND_RECO_ACTION,
        entityType: "AffiliateProduct",
        entityId: i.listingId,
        actorId: affiliateId,
        payload: { affiliateId, listingId: i.listingId, variantKey: i.variantKey } as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
  } catch (error) {
    console.error("[shop-demand] reco_mark_failed", error instanceof Error ? error.message : "unknown")
  }
}

export type ShopDemandAlternatives =
  | { ok: true; demand: ShopDemandItem | null; proposal: ReplacementProposal }
  | { ok: false; error: "not_found" | "variant_key_invalid" }

/**
 * READ: alternatives for the waited variant of ONE listing of the reseller, through the existing replacement engine in
 * « wanted variant » mode (same equivalence: same GTIN, or same category + close name + options; the SAME variant must
 * be available in the alternative; real net per sale after Affisell's fee). Records that they were shown (counts).
 */
export async function loadShopDemandAlternatives(affiliateId: string, listingId: string, variantKey: string, now = new Date()): Promise<ShopDemandAlternatives> {
  if (!variantKey || variantKey.length > 400) return { ok: false, error: "variant_key_invalid" }
  const loaded = await loadReplacementProposal(affiliateId, listingId, { wantedVariantKey: variantKey })
  if (!loaded.ok) return { ok: false, error: "not_found" }
  const demand = (await loadShopRestockDemand(affiliateId, now)).find((d) => d.listingId === listingId && d.variantKey === variantKey) ?? null
  if (demand) {
    const marker: ShownMarker = {
      affiliateId,
      listingId,
      variantKey,
      alternatives: loaded.proposal.status === "found" ? loaded.proposal.alternatives.length : 0,
      day: now.toISOString().slice(0, 10),
    }
    try {
      await prisma.auditLog.createMany({
        data: [
          {
            id: shopDemandShownId(listingId, variantKeyHash(variantKey), marker.day),
            action: SHOP_DEMAND_SHOWN_ACTION,
            entityType: "AffiliateProduct",
            entityId: listingId,
            actorId: affiliateId,
            payload: marker as unknown as Prisma.InputJsonValue,
          },
        ],
        skipDuplicates: true,
      })
    } catch (error) {
      console.error("[shop-demand] shown_mark_failed", error instanceof Error ? error.message : "unknown")
    }
  }
  return { ok: true, demand, proposal: loaded.proposal }
}

export type ChooseAlternativeOutcome =
  | { ok: true; listingId: string; added: boolean; alreadyInShop: boolean }
  | { ok: false; error: "not_confirmed" | "not_found" | "alternative_not_offered" | "add_failed"; status?: number; message?: string }

/**
 * The reseller CHOOSES to offer an alternative in its shop. It is added through the existing quick add (same rules,
 * exclusivity, KYC gate) — or found already live. The requested listing is NOT withdrawn, NOT changed, and the buyers'
 * requests are NOT moved: Affisell never replaces what a buyer asked for. Recorded once.
 */
export async function chooseShopDemandAlternative(args: {
  affiliateId: string
  listingId: string
  variantKey: string
  productId: string
  confirm: boolean
  now?: Date
}): Promise<ChooseAlternativeOutcome> {
  if (args.confirm !== true) return { ok: false, error: "not_confirmed" }
  const loaded = await loadReplacementProposal(args.affiliateId, args.listingId, { wantedVariantKey: args.variantKey })
  if (!loaded.ok) return { ok: false, error: "not_found" }
  const alt = loaded.proposal.status === "found" ? loaded.proposal.alternatives.find((a) => a.productId === args.productId) : undefined
  if (!alt) return { ok: false, error: "alternative_not_offered" }
  const added = await quickAddAffiliateListing({ affiliateId: args.affiliateId, productId: args.productId })
  if (!added.ok) return { ok: false, error: "add_failed", status: added.status, message: added.message ?? added.error }
  const now = args.now ?? new Date()
  const marker: ChosenMarker = {
    affiliateId: args.affiliateId,
    listingId: args.listingId,
    variantKey: args.variantKey,
    productId: args.productId,
    chosenAt: now.toISOString(),
    added: added.created || !alt.inShop,
  }
  await prisma.auditLog.createMany({
    data: [
      {
        id: shopDemandChosenId(args.listingId, variantKeyHash(args.variantKey), args.productId),
        action: SHOP_DEMAND_CHOSEN_ACTION,
        entityType: "AffiliateProduct",
        entityId: args.listingId,
        actorId: args.affiliateId,
        payload: marker as unknown as Prisma.InputJsonValue,
      },
    ],
    skipDuplicates: true,
  })
  return { ok: true, listingId: added.listing.id, added: added.created, alreadyInShop: Boolean(alt.inShop) && !added.created }
}

/**
 * The recovery chain, aggregated — one shop (`affiliateId`) or, for the founder, all shops (`null`). Counts only: no
 * buyer, order or listing identifier is returned. Orders are those of the chosen product IN THE SAME SHOP.
 */
export async function loadShopRecovery(args: { affiliateId: string | null; days?: number; now?: Date }): Promise<ShopRecoverySummary> {
  const now = args.now ?? new Date()
  const since = new Date(now.getTime() - Math.min(365, Math.max(7, args.days ?? 90)) * DAY)
  const listingFilter = args.affiliateId
    ? (await prisma.affiliateProduct.findMany({ where: { affiliateId: args.affiliateId }, select: { id: true }, take: MAX_LISTINGS })).map((l) => l.id)
    : null
  if (listingFilter && listingFilter.length === 0) {
    return summarizeShopRecovery({ demands: [], recommended: [], shown: [], chosen: [], orders: [], waitingBuyers: new Map() })
  }
  const scope = listingFilter ? { entityId: { in: listingFilter } } : {}
  const read = (action: string) =>
    prisma.auditLog.findMany({ where: { action, createdAt: { gte: since }, ...scope }, select: { payload: true }, take: 20_000 })
  const [reco, shownRows, chosenRows] = await Promise.all([read(SHOP_DEMAND_RECO_ACTION), read(SHOP_DEMAND_SHOWN_ACTION), read(SHOP_DEMAND_CHOSEN_ACTION)])
  const pick = <T,>(rows: Array<{ payload: unknown }>) => rows.map((r) => r.payload as T).filter((p) => p && typeof p === "object")
  const shown = pick<ShownMarker>(shownRows)
  const chosen = pick<ChosenMarker>(chosenRows).filter((c) => typeof c.chosenAt === "string")
  const demands = args.affiliateId ? await loadShopRestockDemand(args.affiliateId, now) : []

  const chosenProducts = [...new Set(chosen.map((c) => c.productId))]
  const earliest = chosen.map((c) => c.chosenAt).sort()[0]
  const orders = chosenProducts.length && earliest
    ? (
        await prisma.order.findMany({
          where: { productId: { in: chosenProducts }, affiliateId: { in: [...new Set(chosen.map((c) => c.affiliateId))] }, paidAt: { gte: new Date(earliest) } },
          select: { id: true, affiliateId: true, productId: true, paidAt: true, status: true, paymentSettlementStatus: true, buyerUserId: true },
          take: 20_000,
        })
      )
        .filter((o) => o.paidAt)
        .map((o) => ({ id: o.id, affiliateId: o.affiliateId, productId: o.productId, paidAt: o.paidAt as Date, closed: isOrderClosedForPayout(o), buyerUserId: o.buyerUserId }))
    : []

  // Buyers who asked, per listing × variant — only to COUNT those who bought; never returned.
  const waitingBuyers = new Map<string, Set<string>>()
  const listingIds = [...new Set(chosen.map((c) => c.listingId))]
  if (listingIds.length) {
    const rows = await prisma.auditLog.findMany({ where: { action: RESTOCK_WATCH_ACTION, entityId: { in: listingIds } }, select: { payload: true }, take: MAX_WATCHES })
    for (const r of rows) {
      const w = parseRestockWatch(r.payload)
      if (!w) continue
      const k = `${w.listingId}\u0000${w.variantKey}`
      waitingBuyers.set(k, (waitingBuyers.get(k) ?? new Set()).add(w.userId))
    }
  }
  return summarizeShopRecovery({
    demands,
    recommended: pick<{ listingId: string; variantKey: string }>(reco),
    shown,
    chosen,
    orders,
    waitingBuyers,
  })
}

export { RECOVERY_WINDOW_DAYS }
