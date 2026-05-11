import type { Order } from "@prisma/client"

import { isTerminalReturnStatus } from "@/lib/order-return-types"

/** Return window from order date (proxy for “delivered + X days” until we track delivery). */
export const ORDER_RETURN_WINDOW_DAYS = 30

/** Seller should respond to a new request within this many hours (SLA display). */
export const SELLER_RETURN_RESPONSE_HOURS = 48

export function normalizeOrderEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function orderReturnWindowEndsAt(order: Pick<Order, "createdAt">): Date {
  const d = new Date(order.createdAt)
  d.setDate(d.getDate() + ORDER_RETURN_WINDOW_DAYS)
  return d
}

export function isWithinReturnWindow(order: Pick<Order, "createdAt">, now = new Date()): boolean {
  return now <= orderReturnWindowEndsAt(order)
}

export function buyerOwnsOrder(
  order: Pick<Order, "customerEmail">,
  sessionEmail: string | null | undefined
): boolean {
  if (!sessionEmail) return false
  return normalizeOrderEmail(order.customerEmail) === normalizeOrderEmail(sessionEmail)
}

export function getActiveReturn<T extends { status: string }>(returns: T[]): T | null {
  for (const r of returns) {
    if (!isTerminalReturnStatus(r.status)) return r
  }
  return null
}

/** True if any past return prevents opening a new case (everything except buyer-cancelled). */
export function hasBlockingReturnHistory(returns: { status: string }[]): boolean {
  return returns.some((r) => r.status !== "CANCELLED")
}

export function sellerRespondByFromNow(): Date {
  const d = new Date()
  d.setHours(d.getHours() + SELLER_RETURN_RESPONSE_HOURS)
  return d
}

export function parseEvidenceUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 2000).slice(0, 8)
}
