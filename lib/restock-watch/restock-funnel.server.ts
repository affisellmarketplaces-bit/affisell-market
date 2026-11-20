import "server-only"

import type { Prisma } from "@prisma/client"

import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import { demandGroupKey, distinctWaitingByVariant } from "@/lib/restock-watch/restock-demand"
import {
  DEMAND_FOLLOW_UP_DAYS,
  episodeView,
  nextDemandEpisode,
  openDemandEpisodeId,
  parseDemandEpisode,
  purchasesAfterReturn,
  summarizeDemandFunnel,
  type DemandEpisode,
  type DemandFunnelSummary,
  type DemandObservation,
  type EpisodeView,
  type OrderFact,
} from "@/lib/restock-watch/restock-funnel"
import {
  locateWatchedVariant,
  parseRestockWatch,
  RESTOCK_WATCH_ACTION,
  restockWatchObservedId,
  variantKeyHash,
  type RestockWatch,
} from "@/lib/restock-watch/restock-watch"
import { variantKeyFromOrderLabel, variantKeyFromRowName } from "@/lib/supplier-costs/variant-key"
import { rowsForChoice } from "@/lib/variant-selection"

export const RESTOCK_DEMAND_EPISODE_ACTION = "restock.demand_episode"
const DAY = 86_400_000
const MAX_WATCHES = 20_000
const MAX_EPISODES = 2_000
const LAPSE_WINDOW_DAYS = 7

const productSelect = {
  id: true,
  supplierId: true,
  name: true,
  updatedAt: true,
  active: true,
  isDraft: true,
  tags: true,
  stock: true,
  hasVariants: true,
  variants: true,
  listingKind: true,
  commissionRate: true,
  offerMode: true,
  customColumns: true,
  productVariants: { select: { color: true, size: true, stock: true, customData: true }, take: 200 },
} as const

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>

async function readWatches(where: Prisma.AuditLogWhereInput = {}) {
  const rows = await prisma.auditLog.findMany({
    where: { action: RESTOCK_WATCH_ACTION, ...where },
    select: { id: true, payload: true },
    take: MAX_WATCHES,
  })
  return rows.map((r) => ({ id: r.id, watch: parseRestockWatch(r.payload) })).filter((r): r is { id: string; watch: RestockWatch } => r.watch !== null)
}

async function readOpenEpisodes(productIds?: string[]) {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: RESTOCK_DEMAND_EPISODE_ACTION,
      ...(productIds ? { entityId: { in: productIds } } : {}),
      OR: [{ payload: { path: ["stage"], equals: "waiting" } }, { payload: { path: ["stage"], equals: "back" } }],
    },
    select: { id: true, payload: true },
    take: MAX_EPISODES,
  })
  return rows.map((r) => ({ id: r.id, episode: parseDemandEpisode(r.payload) })).filter((r): r is { id: string; episode: DemandEpisode } => r.episode !== null)
}

function variantNow(p: ProductRow, variantKey: string): DemandObservation["variant"] & { label?: string } {
  const rows = rowsForChoice(p.variants, p.productVariants, p.customColumns)
  const v = locateWatchedVariant(rows, p.customColumns, variantKey)
  if (v.status !== "found") return v
  const name = String((rows as { variantRows?: Array<{ name?: unknown }> }).variantRows?.[v.index]?.name ?? "").trim()
  return { status: "found", stock: v.stock, label: name || "—" }
}

/**
 * Periodic (called by the restock-watch run, never by a page): opens, follows and closes the demand episodes. Writes
 * AuditLog bookkeeping only — never a product, a stock, a listing, an order or money. A failure never fails the run.
 */
export async function trackRestockDemandEpisodes(now = new Date()): Promise<{ opened: number; returned: number; closed: number; updated: number }> {
  const out = { opened: 0, returned: 0, closed: 0, updated: 0 }
  const watches = await readWatches()
  const listingIds = [...new Set(watches.map((w) => w.watch.listingId))]
  const listings = listingIds.length
    ? await prisma.affiliateProduct.findMany({ where: { id: { in: listingIds } }, select: { id: true, productId: true } })
    : []
  const listingProduct = new Map(listings.map((l) => [l.id, l.productId]))
  // The product is the one the LISTING points to today.
  const normalised = watches
    .map((w) => ({ ...w.watch, productId: listingProduct.get(w.watch.listingId) ?? "" }))
    .filter((w) => w.productId)
  const waiting = distinctWaitingByVariant(normalised, now)
  const lapseSince = now.getTime() - LAPSE_WINDOW_DAYS * DAY
  const lapsed = new Map<string, { expired: number; cancelled: number }>()
  for (const w of normalised) {
    if ((w.state !== "expired" && w.state !== "cancelled") || Date.parse(w.updatedAt) < lapseSince) continue
    const k = demandGroupKey(w.productId, w.variantKey)
    const c = lapsed.get(k) ?? { expired: 0, cancelled: 0 }
    c[w.state as "expired" | "cancelled"] += 1
    lapsed.set(k, c)
  }
  const open = await readOpenEpisodes()
  const openBy = new Map(open.map((o) => [demandGroupKey(o.episode.productId, o.episode.variantKey), o]))
  const keys = new Set<string>([...[...waiting.entries()].filter(([, g]) => g.buyers.size >= 3).map(([k]) => k), ...openBy.keys()])
  if (keys.size === 0) return out

  const productIds = [...new Set([...keys].map((k) => k.split("\u0000")[0]!))]
  const products = new Map((await prisma.product.findMany({ where: { id: { in: productIds } }, select: productSelect })).map((p) => [p.id, p]))
  const allListings = await prisma.affiliateProduct.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true } })
  const visible = new Set(
    (await prisma.affiliateProduct.findMany({ where: { productId: { in: productIds }, ...buyerListedAffiliateProductWhere }, select: { productId: true } })).map((l) => l.productId)
  )
  const hasListing = new Set(allListings.map((l) => l.productId))

  for (const k of keys) {
    const [productId, variantKey] = k.split("\u0000") as [string, string]
    const p = products.get(productId)
    const prev = openBy.get(k) ?? null
    const v = p ? variantNow(p, variantKey) : ({ status: "gone" } as const)
    const obs: DemandObservation = {
      now,
      productId,
      variantKey,
      variantLabel: (v.status === "found" && "label" in v && v.label) || prev?.episode.variantLabel || "—",
      waitingBuyers: waiting.get(k)?.buyers.size ?? 0,
      variant: v.status === "found" ? { status: "found", stock: v.stock } : v,
      listingExists: hasListing.has(productId),
      listed: visible.has(productId),
      sellable: p ? listingProblem(p) === null : false,
      productUpdatedAt: p?.updatedAt ?? null,
      lapsed: lapsed.get(k) ?? { expired: 0, cancelled: 0 },
    }
    const t = nextDemandEpisode(prev?.episode ?? null, obs)
    if (!t.episode || t.event === "none") continue
    const payload = t.episode as unknown as Prisma.InputJsonValue
    try {
      if (t.event === "opened") {
        const r = await prisma.auditLog.createMany({
          data: [{ id: openDemandEpisodeId(productId, variantKeyHash(variantKey), now), action: RESTOCK_DEMAND_EPISODE_ACTION, entityType: "Product", entityId: productId, actorId: null, payload }],
          skipDuplicates: true,
        })
        out.opened += r.count
      } else if (prev && JSON.stringify(prev.episode) !== JSON.stringify(t.episode)) {
        await prisma.auditLog.update({ where: { id: prev.id }, data: { payload } })
        if (t.event === "returned") out.returned++
        else if (t.event === "closed") out.closed++
        else out.updated++
      }
    } catch (error) {
      console.error("[restock-demand] episode_write_failed", error instanceof Error ? error.message : "unknown")
    }
  }
  return out
}

/** Records, once, that the supplier's next-action card served the recommendation for an open episode. Never throws. */
export async function markRestockRecommendationShown(productId: string, variantKey: string, now = new Date()): Promise<void> {
  try {
    const [open] = (await readOpenEpisodes([productId])).filter((o) => o.episode.variantKey === variantKey)
    if (!open || open.episode.recommendationShownAt) return
    await prisma.auditLog.update({
      where: { id: open.id },
      data: { payload: { ...open.episode, recommendationShownAt: now.toISOString() } as unknown as Prisma.InputJsonValue },
    })
  } catch (error) {
    console.error("[restock-demand] recommendation_mark_failed", error instanceof Error ? error.message : "unknown")
  }
}

/**
 * Read-time views of the episodes (supplier: its own products only; admin: `supplierId: null`), with purchases after
 * the return (distinct orders of THAT variant, refunds / cancellations apart, association only) and notifications
 * (real sends and theoretical ones apart). Counts only — no buyer, order or shop identifier leaves this function.
 */
export async function loadDemandEpisodes(args: { supplierId: string | null; days?: number; now?: Date }): Promise<{ views: EpisodeView[]; summary: DemandFunnelSummary }> {
  const now = args.now ?? new Date()
  const since = new Date(now.getTime() - Math.min(365, Math.max(7, args.days ?? 90)) * DAY)
  let productFilter: string[] | undefined
  if (args.supplierId) {
    productFilter = (await prisma.product.findMany({ where: { supplierId: args.supplierId }, select: { id: true }, take: 5_000 })).map((p) => p.id)
    if (productFilter.length === 0) return { views: [], summary: summarizeDemandFunnel([]) }
  }
  const rows = await prisma.auditLog.findMany({
    where: { action: RESTOCK_DEMAND_EPISODE_ACTION, createdAt: { gte: since }, ...(productFilter ? { entityId: { in: productFilter } } : {}) },
    select: { payload: true },
    orderBy: { createdAt: "desc" },
    take: MAX_EPISODES,
  })
  const episodes = rows.map((r) => parseDemandEpisode(r.payload)).filter((e): e is DemandEpisode => e !== null)
  if (episodes.length === 0) return { views: [], summary: summarizeDemandFunnel([]) }
  const productIds = [...new Set(episodes.map((e) => e.productId))]

  const listings = await prisma.affiliateProduct.findMany({ where: { productId: { in: productIds } }, select: { id: true, productId: true } })
  const listingProduct = new Map(listings.map((l) => [l.id, l.productId]))
  const watches = listings.length ? await readWatches({ entityId: { in: listings.map((l) => l.id) } }) : []
  const byKey = new Map<string, Array<{ id: string; watch: RestockWatch }>>()
  for (const w of watches) {
    const pid = listingProduct.get(w.watch.listingId)
    if (!pid) continue
    const k = demandGroupKey(pid, w.watch.variantKey)
    byKey.set(k, [...(byKey.get(k) ?? []), w])
  }
  const observedIds = watches.map((w) => restockWatchObservedId(w.id, w.watch.episode))
  const observed = new Set(
    observedIds.length ? (await prisma.auditLog.findMany({ where: { id: { in: observedIds } }, select: { id: true } })).map((r) => r.id) : []
  )

  const earliestBack = episodes.map((e) => e.backAt).filter((d): d is string => Boolean(d)).sort()[0]
  const orders = earliestBack
    ? await prisma.order.findMany({
        where: { productId: { in: productIds }, paidAt: { gte: new Date(earliestBack), lte: new Date(now.getTime() + DAY) } },
        select: { id: true, productId: true, paidAt: true, quantity: true, variantLabel: true, status: true, paymentSettlementStatus: true, buyerUserId: true },
        take: 20_000,
      })
    : []

  const views = episodes.map((e) => {
    const k = demandGroupKey(e.productId, e.variantKey)
    const ws = byKey.get(k) ?? []
    // Orders meet the variant through the shared order-label identity; a capacity is not in that identity yet → not evaluable.
    const hasStorage = (e.variantKey.split("|")[2] ?? "") !== "" || (e.variantKey.split("|")[3] ?? "") !== ""
    const rowKey = hasStorage ? null : variantKeyFromRowName(e.variantLabel)
    const facts: OrderFact[] = orders
      .filter((o) => o.productId === e.productId && o.paidAt)
      .map((o) => ({
        id: o.id,
        paidAt: o.paidAt as Date,
        quantity: o.quantity ?? 1,
        variantMatches: rowKey === null ? null : variantKeyFromOrderLabel(o.variantLabel) === rowKey,
        closed: isOrderClosedForPayout(o),
        buyerUserId: o.buyerUserId,
      }))
    const waitingIds = new Set(ws.map((w) => w.watch.userId))
    const opened = Date.parse(e.openedAt)
    return episodeView(
      e,
      {
        ...purchasesAfterReturn(e, facts, waitingIds),
        notificationsSent: ws.filter((w) => w.watch.notifiedAt && Date.parse(w.watch.notifiedAt) >= opened).length,
        notificationsTheoretical: ws.filter((w) => observed.has(restockWatchObservedId(w.id, w.watch.episode)) && Date.parse(w.watch.updatedAt) >= opened).length,
      },
      now
    )
  })
  return { views, summary: summarizeDemandFunnel(views) }
}

export { DEMAND_FOLLOW_UP_DAYS }
