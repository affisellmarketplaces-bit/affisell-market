import { autoCancelMarketplaceOrderShipSlaBreach } from "@/lib/orders/auto-cancel-ship-sla-breach"
import { expireStaleShipExtensions } from "@/lib/orders/ship-extension-actions"
import { evaluateShipPulseAutoCancel } from "@/lib/orders/ship-pulse-policy"
import { prisma } from "@/lib/prisma"
import { resolveShipDeadlineAt, SUPPLIER_SHIP_SLA_MS } from "@/lib/supplier-ship-sla-shared"

export type EnforceShipSlaCronResult = {
  extensionsExpired: number
  scanned: number
  cancelled: number
  errors: number
  results: Array<{ orderId: string; ok: boolean; error?: string; skipped?: string }>
}

export async function runEnforceSupplierShipSlaCron(
  limit = 40
): Promise<EnforceShipSlaCronResult> {
  const extensionsExpired = await expireStaleShipExtensions(80)
  const now = new Date()
  const fallbackBefore = new Date(now.getTime() - SUPPLIER_SHIP_SLA_MS)

  const candidates = await prisma.order.findMany({
    where: {
      status: { in: ["paid", "preparing"] },
      autoCancelledAt: null,
      cancelledEmailSentAt: null,
      trackingNumber: null,
      digitalDeliveredAt: null,
      OR: [
        { shipDeadlineAt: { lte: now } },
        {
          shipDeadlineAt: null,
          paidAt: { lte: fallbackBefore },
        },
        {
          shipDeadlineAt: null,
          paidAt: null,
          createdAt: { lte: fallbackBefore },
        },
      ],
    },
    select: {
      id: true,
      shipDeadlineAt: true,
      paidAt: true,
      createdAt: true,
      trackingNumber: true,
      shipExtensions: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          buyerExpiresAt: true,
          newDeadlineAt: true,
          createdAt: true,
        },
      },
      fulfillmentMessages: {
        where: { authorRole: "SUPPLIER" },
        select: { id: true },
      },
    },
    orderBy: { shipDeadlineAt: "asc" },
    take: limit * 3,
  })

  const eligibleIds: string[] = []
  for (const row of candidates) {
    if (eligibleIds.length >= limit) break
    const deadline = resolveShipDeadlineAt(row)
    const decision = evaluateShipPulseAutoCancel({
      now,
      deadline,
      trackingNumber: row.trackingNumber,
      supplierMessageCount: row.fulfillmentMessages.length,
      extensions: row.shipExtensions,
    })
    if (decision.eligible) eligibleIds.push(row.id)
  }

  const results: EnforceShipSlaCronResult["results"] = []
  let cancelled = 0
  let errors = 0

  for (const id of eligibleIds) {
    const result = await autoCancelMarketplaceOrderShipSlaBreach(id)
    results.push({
      orderId: id,
      ok: result.ok,
      error: result.error,
      skipped: result.skipped,
    })
    if (result.ok) cancelled += 1
    else if (result.error && !result.skipped) errors += 1
  }

  return {
    extensionsExpired,
    scanned: eligibleIds.length,
    cancelled,
    errors,
    results,
  }
}
