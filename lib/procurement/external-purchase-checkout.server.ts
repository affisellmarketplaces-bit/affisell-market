import { AFFISELL_AUTOBUY_SUPPLIER_EMAIL } from "@/lib/auto-buy-platform-supplier-shared"
import { prisma } from "@/lib/prisma"
import {
  decideExternalPurchaseCheckout,
  isExternalPurchaseEnabled,
  resolveExternalPurchaseCheckoutMode,
  type ExternalPurchaseCheckoutDecision,
  type ExternalPurchaseCheckoutLine,
} from "@/lib/procurement/external-purchase-switch"

/**
 * The check before payment for products only an external purchase can deliver (see `external-purchase-switch.ts`).
 * Shared by the cart checkout, the single-line checkout and the agent checkout. Never throws: an unreadable platform
 * account means "nothing to block" (the post-payment paths still refuse to buy while the switch is off, and the
 * order then falls back to manual fulfilment) — a database blip must not stop every checkout.
 */
export async function evaluateExternalPurchaseCheckoutGate(
  lines: ExternalPurchaseCheckoutLine[]
): Promise<ExternalPurchaseCheckoutDecision> {
  const mode = resolveExternalPurchaseCheckoutMode()
  if (mode === "off" || isExternalPurchaseEnabled() || lines.length === 0) {
    return { mode, blocked: null, refuse: false }
  }

  let platformIds = new Set<string>()
  try {
    const supplierIds = [...new Set(lines.map((l) => l.supplierId).filter((id): id is string => Boolean(id)))]
    if (supplierIds.length > 0) {
      const rows = await prisma.user.findMany({
        where: { id: { in: supplierIds }, email: AFFISELL_AUTOBUY_SUPPLIER_EMAIL },
        select: { id: true },
      })
      platformIds = new Set(rows.map((r) => r.id))
    }
  } catch (error) {
    console.error("[procurement-checkout]", {
      result: "platform_account_unreadable",
      error: error instanceof Error ? error.message : String(error),
    })
    return { mode, blocked: null, refuse: false }
  }

  const decision = decideExternalPurchaseCheckout(lines, platformIds)
  if (decision.blocked) {
    console.log("[procurement-checkout]", {
      result: decision.refuse ? "refused_external_purchase_disabled" : "would_refuse_external_purchase_disabled",
      mode: decision.mode,
      productId: decision.blocked.productId,
    })
  }
  return decision
}
