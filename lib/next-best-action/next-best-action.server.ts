import "server-only"

import { loadResellerAlerts } from "@/lib/intelligence/profit-alerts.server"
import {
  resellerNextActions,
  supplierNextActions,
  type NextAction,
  type ShopListingState,
} from "@/lib/next-best-action/next-best-action"
import { prisma } from "@/lib/prisma"
import { loadSupplierRestockDemand } from "@/lib/restock-watch/restock-demand.server"
import { loadSupplierQualityRecommendations } from "@/lib/listing-quality/quality-effect.server"
import { markRestockRecommendationShown } from "@/lib/restock-watch/restock-funnel.server"
import { loadShopRestockDemand, markShopDemandRecommended } from "@/lib/restock-watch/shop-demand.server"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import { loadResellerSelection } from "@/lib/reseller-copilot/selection.server"
import { loadSupplierCatalogHealthAndReadiness } from "@/lib/supplier-catalog-health/diagnose.server"

const DAY = 86_400_000
const MAX_LISTINGS = 300

/** Supplier: 1–3 actions from its own catalogue health. Read-only. */
export async function loadSupplierNextActions(supplierId: string): Promise<NextAction[]> {
  const [{ report: health, readiness }, demand, quality] = await Promise.all([
    // Health report + the commercial-readiness verdict of every saved product (same reads, same engine as the forms).
    loadSupplierCatalogHealthAndReadiness(supplierId),
    // The buyers' restock signal is an extra reason, never a condition: a failed read = no restock action.
    loadSupplierRestockDemand(supplierId).catch(() => null),
    // Sheet-quality evidence (marketplace aggregate): an extra reason, never a condition.
    loadSupplierQualityRecommendations(supplierId)
      .then((r) => r.recommendations)
      .catch(() => []),
  ])
  const actions = supplierNextActions(health, 3, demand?.products ?? [], quality, readiness?.all ?? [])
  // Step 2 of the measurement chain: the recommendation was really served to this supplier (first time only).
  for (const a of actions) {
    if (a.kind !== "answer_restock_demand") continue
    const variantKey = a.key.split(":").slice(2).join(":")
    await markRestockRecommendationShown(a.productId, variantKey)
  }
  return actions
}

/** Reseller: 1–3 actions from its own shop, its open profit alerts and the copilot's ready products. Read-only. */
export async function loadResellerNextActions(affiliateId: string, now = new Date()): Promise<NextAction[]> {
  const since = new Date(now.getTime() - 30 * DAY)
  const listings = await prisma.affiliateProduct.findMany({
    where: { affiliateId, isListed: true },
    orderBy: { createdAt: "desc" },
    take: MAX_LISTINGS,
    select: {
      id: true,
      productId: true,
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
  const productIds = [...new Set(listings.map((l) => l.productId))]
  const [orders, alerts, selection, shopDemand] = await Promise.all([
    productIds.length
      ? prisma.order.groupBy({
          by: ["productId"],
          where: { affiliateId, productId: { in: productIds }, paidAt: { gte: since } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    loadResellerAlerts(affiliateId, 10),
    loadResellerSelection(affiliateId, 5).catch(() => null),
    // The shop's own buyers' restock requests: an extra reason, never a condition (a failed read = no such action).
    loadShopRestockDemand(affiliateId, now).catch(() => []),
  ])
  // Observation plans whose evaluation is due (OBSERVATION_PLAN_MODE=on only; a failed read = no such action).
  const planReviews = await import("@/lib/reseller-copilot/observation-plan.server")
    .then((m) => m.loadDuePlanReviews(affiliateId, now))
    .catch(() => [])
  const ordersBy = new Map(orders.map((o) => [o.productId as string, o._count._all]))

  const states: ShopListingState[] = listings.map((l) => {
    const p = l.product
    const problem: ShopListingState["problem"] = listingProblem(p)
    return { listingId: l.id, productId: l.productId, name: p.name, problem, paidOrders30d: ordersBy.get(l.productId) ?? 0 }
  })

  const actions = resellerNextActions({
    listings: states,
    drops: alerts.map((a) => ({
      alertId: a.id,
      productId: a.productId,
      name: a.payload.name,
      primaryCause: String(a.payload.primaryCause ?? "unknown"),
      netChangeCents: Number(a.payload.netChangeCents) || 0,
    })),
    ready: (selection?.selection ?? [])
      .filter((s) => s.readiness === "pret")
      .map((s) => ({
        productId: s.productId,
        name: s.name,
        netPerSaleCents: s.net.netCents,
        paidOrders30d: s.demand.paidOrders30d,
        resellersListing: s.demand.resellersListing,
      })),
    shopDemand,
    planReviews: planReviews
      .filter((r) => r.status.recommendation && r.status.horizonDays != null)
      .map((r) => ({
        listingId: r.listingId,
        productId: r.productId,
        productName: r.productName,
        plannedDay: r.plannedAt.slice(0, 10),
        recommendation: r.status.recommendation!,
        elapsedDays: r.status.elapsedDays,
        horizonDays: r.status.horizonDays!,
        sales: r.status.sales,
      })),
  })
  // Recovery chain, step « recommendation shown »: recorded once per shop demand, never blocking the answer.
  const served = actions.filter((a) => a.kind === "answer_shop_demand")
  await markShopDemandRecommended(
    affiliateId,
    served.map((a) => {
      const [, listingId, ...rest] = a.key.split(":")
      return { listingId: listingId!, variantKey: rest.join(":") }
    })
  )
  return actions
}
