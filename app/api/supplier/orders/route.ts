import { z } from "zod"

import { auth } from "@/auth"
import { fetchSupplierOrders } from "@/lib/supplier-orders-payload"
import { toSupplierFulfillmentOrdersPublic } from "@/lib/supplier-orders-public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  tab: z.enum(["to_ship", "shipped", "all"]).optional(),
})

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
  return Response.json({ orders: toSupplierFulfillmentOrdersPublic(orders), tab })
}
