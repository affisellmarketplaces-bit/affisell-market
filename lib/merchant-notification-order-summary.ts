import "server-only"

import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"
import type { MerchantNotificationOrderSummary } from "@/lib/merchant-notification-order-summary-types"

/** Inline (base64) images would bloat the poll payload — only real URLs / paths. */
function lightImage(url: string | null | undefined): string | null {
  const u = url?.trim()
  return u && !u.startsWith("data:") ? u : null
}

/**
 * Product + order facts behind an alert (photo, name, quantity, amount, status), for every notification that
 * points at an order — whatever its type (sale, ship deadline, cancellation…). Scoped to the viewer's own orders.
 */
export async function loadNotificationOrderSummaries(
  userId: string,
  orderIds: readonly string[],
  role: "SUPPLIER" | "AFFILIATE"
): Promise<Map<string, MerchantNotificationOrderSummary>> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  const out = new Map<string, MerchantNotificationOrderSummary>()
  if (ids.length === 0) return out
  try {
    const rows = await prisma.order.findMany({
      where: { id: { in: ids }, ...(role === "SUPPLIER" ? { supplierId: userId } : { affiliateId: userId }) },
      select: {
        id: true,
        quantity: true,
        variantLabel: true,
        variantImageUrl: true,
        status: true,
        totalCents: true,
        sellingPriceCents: true,
        product: { select: { name: true, images: true } },
      },
    })
    for (const o of rows) {
      out.set(o.id, {
        productName: o.product.name,
        imageUrl: lightImage(o.variantImageUrl) ?? lightImage(primaryProductImage(o.product.images)),
        quantity: o.quantity,
        variantLabel: o.variantLabel?.trim() || null,
        // Suppliers never see the reseller's resale price / what the buyer paid.
        totalCents: role === "SUPPLIER" ? null : (o.totalCents ?? o.sellingPriceCents * o.quantity),
        status: o.status,
        ref: o.id.slice(-6).toUpperCase(),
      })
    }
  } catch (error) {
    console.error("[notification-order-summary]", error instanceof Error ? error.message : error)
  }
  return out
}
