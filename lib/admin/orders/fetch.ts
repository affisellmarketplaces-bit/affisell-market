import type { AdminOrdersListQuery } from "@/lib/admin/orders/list-query"
import { adminOrdersListSearchParams } from "@/lib/admin/orders/list-query"
import type { AdminOrderListRow } from "@/lib/admin/orders/serialize-list"

export async function fetchAdminOrders(
  query: AdminOrdersListQuery
): Promise<AdminOrderListRow[]> {
  const qs = adminOrdersListSearchParams(query)
  const url = qs ? `/api/admin/orders?${qs}` : "/api/admin/orders"
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load orders")
  const data = (await res.json()) as { orders?: AdminOrderListRow[] }
  return data.orders ?? []
}
