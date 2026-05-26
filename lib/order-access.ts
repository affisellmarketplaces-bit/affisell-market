export type OrderAccessRole = "SUPPLIER" | "AFFILIATE" | "CUSTOMER"

type OrderAccessFields = {
  supplierId: string
  affiliateId: string
  buyerUserId: string | null
  customerEmail: string
}

type SessionUser = {
  id: string
  email?: string | null
}

export function resolveOrderAccessRole(
  order: OrderAccessFields,
  user: SessionUser
): OrderAccessRole | null {
  if (order.supplierId === user.id) return "SUPPLIER"
  if (order.affiliateId === user.id) return "AFFILIATE"
  if (order.buyerUserId === user.id) return "CUSTOMER"
  const email = user.email?.trim().toLowerCase()
  if (email && order.customerEmail.trim().toLowerCase() === email) return "CUSTOMER"
  return null
}

export function orderDetailBackHref(role: OrderAccessRole): string {
  if (role === "SUPPLIER") return "/dashboard/supplier/orders"
  if (role === "AFFILIATE") return "/dashboard/affiliate/earnings"
  return "/marketplace/account/orders"
}
