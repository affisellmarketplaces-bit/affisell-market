import "server-only"

import { loadResellerAlerts } from "@/lib/intelligence/profit-alerts.server"
import {
  resellerNextActions,
  supplierNextActions,
  type NextAction,
  type ShopListingState,
} from "@/lib/next-best-action/next-best-action"
import { prisma } from "@/lib/prisma"
import { listingProblem } from "@/lib/reseller-replacement/listing-state"
import { loadResellerSelection } from "@/lib/reseller-copilot/selection.server"
import { loadSupplierCatalogHealth } from "@/lib/supplier-catalog-health/diagnose.server"

const DAY = 86_400_000
const MAX_LISTINGS = 300

/** Supplier: 1–3 actions from its own catalogue health. Read-only. */
export async function loadSupplierNextActions(supplierId: string): Promise<NextAction[]> {
  return supplierNextActions(await loadSupplierCatalogHealth(supplierId))
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
  const [orders, alerts, selection] = await Promise.all([
    productIds.length
      ? prisma.order.groupBy({
          by: ["productId"],
          where: { affiliateId, productId: { in: productIds }, paidAt: { gte: since } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    loadResellerAlerts(affiliateId, 10),
    loadResellerSelection(affiliateId, 5).catch(() => null),
  ])
  const ordersBy = new Map(orders.map((o) => [o.productId as string, o._count._all]))

  const states: ShopListingState[] = listings.map((l) => {
    const p = l.product
    const problem: ShopListingState["problem"] = listingProblem(p)
    return { listingId: l.id, productId: l.productId, name: p.name, problem, paidOrders30d: ordersBy.get(l.productId) ?? 0 }
  })

  return resellerNextActions({
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
  })
}
