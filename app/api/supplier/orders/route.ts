import { z } from "zod"

import { auth } from "@/auth"
import { fetchSupplierOrders } from "@/lib/supplier-orders-payload"
import { toSupplierFulfillmentOrdersPublic } from "@/lib/supplier-orders-public-api"
import { resolveShipTrackingPolicy } from "@/lib/ship-tracking-policy.shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  tab: z.enum(["to_ship", "shipped", "all"]).optional(),
})

/**
 * READ-ONLY. It used to await a full Stripe reconcile + notification heal (unthrottled, on every call) before reading
 * the orders. The list only needs `fetchSupplierOrders` (plain SELECTs), so nothing else runs here any more; the
 * business catch-up is an explicit mechanism decided separately. Guarded by
 * `lib/__tests__/notifications-get-read-only.test.ts`.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ tab: url.searchParams.get("tab") ?? undefined })
  const tab = parsed.success && parsed.data.tab ? parsed.data.tab : "to_ship"

  const orders = await fetchSupplierOrders(session.user.id, tab)
  return Response.json({
    orders: toSupplierFulfillmentOrdersPublic(orders),
    tab,
    shipTrackingPolicy: resolveShipTrackingPolicy(),
  })
}
