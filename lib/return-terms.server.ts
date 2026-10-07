import "server-only"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { effectiveReturnWindowDays, parseReturnWindowDays, RETURN_WINDOW_KEY } from "@/lib/return-terms"

/** The table is not in the database yet: the migration lags behind the deploy. */
function isMissingSchema(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")
}

/** Only orders created this recently are frozen: a webhook replayed days later must not freeze TODAY's terms on an old order. */
const FREEZE_WITHIN_MS = 60 * 60 * 1000

/**
 * Freezes, on each order, the extended return window its product offered at purchase. Rows are only written for an
 * extension (no row = the legal 14 days), so most orders write nothing. Idempotent, and NEVER throws: it runs after the
 * payment is settled and must not be able to affect it.
 */
export async function recordOrderReturnTerms(orderIds: string[]): Promise<void> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  if (ids.length === 0) return
  try {
    const orders = await prisma.order.findMany({
      where: { id: { in: ids }, createdAt: { gte: new Date(Date.now() - FREEZE_WITHIN_MS) } },
      select: { id: true, productId: true },
    })
    if (orders.length === 0) return

    const attrs = await prisma.productAttribute.findMany({
      where: { productId: { in: [...new Set(orders.map((o) => o.productId))] }, key: RETURN_WINDOW_KEY },
      select: { productId: true, value: true },
    })
    const daysByProduct = new Map(attrs.map((a) => [a.productId, parseReturnWindowDays(a.value)]))

    const data = orders.flatMap((o) => {
      const days = daysByProduct.get(o.productId)
      return days ? [{ orderId: o.id, returnWindowDays: days }] : []
    })
    if (data.length === 0) return
    await prisma.orderReturnTerms.createMany({ data, skipDuplicates: true })
  } catch (e) {
    if (!isMissingSchema(e)) console.error("[return-terms] freeze failed", e instanceof Error ? e.message : e)
  }
}

/**
 * Days each order can be returned in (always at least the legal 14). Never throws: when the terms cannot be read the
 * buyer gets the legal window — the behaviour before this feature existed.
 */
export async function loadOrderReturnWindowDays(orderIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  const out = new Map<string, number>()
  if (ids.length === 0) return out
  try {
    const rows = await prisma.orderReturnTerms.findMany({
      where: { orderId: { in: ids } },
      select: { orderId: true, returnWindowDays: true },
    })
    for (const r of rows) out.set(r.orderId, effectiveReturnWindowDays(r.returnWindowDays))
  } catch (e) {
    if (!isMissingSchema(e)) console.error("[return-terms] read failed", e instanceof Error ? e.message : e)
  }
  return out
}

export async function loadOrderReturnWindowDaysFor(orderId: string): Promise<number> {
  return (await loadOrderReturnWindowDays([orderId])).get(orderId) ?? effectiveReturnWindowDays(null)
}
