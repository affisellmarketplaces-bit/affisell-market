import "server-only"

import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"
import { LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"
import { prisma } from "@/lib/prisma"
import { checkSupplierMayActivate } from "@/lib/products/affisell-suspension.server"
import { loadSupplierCostView } from "@/lib/supplier-costs/declaration.server"
import { buildProductJourney, nextSupplierAction, type JourneyStep } from "@/lib/supplier-journey/product-journey"

/** The supplier's own product journey. Null = not found / not owned. Read-only. */
export async function loadSupplierProductJourney(
  productId: string,
  supplierId: string
): Promise<{ steps: JourneyStep[]; next: string | null } | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      supplierId: true,
      name: true,
      images: true,
      categoryId: true,
      listingKind: true,
      stock: true,
      variants: true,
      commissionRate: true,
      isDraft: true,
      active: true,
      attributes: { where: { key: { in: [...LISTING_COMPLIANCE_KEYS] } }, select: { key: true, value: true } },
    },
  })
  if (!p || p.supplierId !== supplierId) return null
  const since = new Date(Date.now() - 30 * 86_400_000)
  const [listed, sales, hold, costs] = await Promise.all([
    prisma.affiliateProduct.count({ where: { productId, isListed: true } }),
    prisma.order.count({ where: { productId, paidAt: { gte: since } } }),
    checkSupplierMayActivate(productId),
    loadSupplierCostView(productId, supplierId),
  ])
  const readiness = evaluateListingReadiness({ listingKind: p.listingKind, attributes: p.attributes })
  const rows = (p.variants as { variantRows?: Array<{ stock?: unknown }> } | null)?.variantRows
  const available = Array.isArray(rows) && rows.length > 0 ? rows.reduce((s, r) => s + (Number(r.stock) > 0 ? Number(r.stock) : 0), 0) : p.stock
  const steps = buildProductJourney({
    name: p.name,
    imageCount: p.images.length,
    hasCategory: Boolean(p.categoryId),
    safetyReady: readiness.applicable === false ? null : readiness.ready,
    safetyMissing: readiness.blocking.map((i) => i.code),
    availableUnits: available,
    commissionRate: p.commissionRate,
    isDraft: p.isDraft,
    active: p.active,
    hold: hold.held ? hold.error : null,
    listedByResellers: listed,
    paidOrders30d: sales,
    costDeclared: Boolean(costs?.current),
    costQualification: costs?.current ? costs.qualification : null,
  })
  return { steps, next: nextSupplierAction(steps) }
}
