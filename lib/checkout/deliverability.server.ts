import { NextResponse } from "next/server"

import { resolveFulfillmentDependency } from "@/lib/auto-order/resolve-channel"
import { precheckChinaBuyRoute } from "@/lib/china-buying/china-buy-qc-gate"
import {
  checkoutDeliverabilityMode,
  decideCheckoutDeliverability,
  decideLineDeliverability,
  deliverabilityRefusalBody,
  type LineDeliverability,
  type PurchaseDependency,
} from "@/lib/checkout/deliverability"
import { prisma } from "@/lib/prisma"
import { purchaseChannelForProviderType } from "@/lib/supplier-purchase/channels"
import { SUPPLIER_PURCHASE_CLAIM_SQL } from "@/lib/supplier-purchase/guard.server"
import { supplierPurchaseDecision, type SupplierPurchaseChannel } from "@/lib/supplier-purchase/policy"

const MONEY_METHODS = new Set(["WALLET_PREPAID", "STRIPE_CONNECT"])

/**
 * Every automatic supplier purchase a paid order of this product would trigger — the same rules as the purchase
 * paths themselves: webhook auto-buy (active SupplierLink with autoBuyEnabled), the batch engine (its own read-only
 * channel resolution, including the supplier's auto-buy authorisation and the provider's payment method), and China
 * agents (same pre-check as trigger-china-buy-for-order, only when that agent's API is configured — otherwise the
 * route is a manual "stub" the supplier handles). null = could not be determined (refused by the caller).
 */
export async function loadPurchaseDependencies(productId: string): Promise<PurchaseDependency[] | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        supplierId: true,
        autoFulfill: true,
        autoBuyEnabled: true,
        fulfillmentChannel: true,
        importSource: true,
        aliexpressProductId: true,
        supplierSku: true,
        supplierWholesaleCents: true,
        chinaBuyingAgentId: true,
        sourceUrl: true,
        supplierLink: { select: { isActive: true, autoBuyEnabled: true, aeProductId: true } },
      },
    })
    if (!product) return null
    const deps: PurchaseDependency[] = []

    const link = product.supplierLink
    if (link?.isActive && link.autoBuyEnabled && link.aeProductId.trim())
      deps.push({ channel: "aliexpress", via: "auto_buy" })

    const engine = await resolveFulfillmentDependency(product)
    if (engine) {
      const channel = purchaseChannelForProviderType(engine.channel)
      if (channel) deps.push({ channel, via: "engine" })
      if (MONEY_METHODS.has(engine.paymentMethod)) deps.push({ channel: "supplier_payment", via: "engine_payment" })
    }

    const agent = product.chinaBuyingAgentId
    if (agent && product.sourceUrl) {
      const passedQc =
        (await prisma.agentMission.count({
          where: { productId: product.id, type: "QC_INSPECTION", status: "PASSED" },
        })) > 0
      const pre = precheckChinaBuyRoute({
        autoFulfill: product.autoFulfill,
        autoBuyEnabled: product.autoBuyEnabled,
        agentId: agent,
        sourceUrl: product.sourceUrl,
        hasPassedQcInspection: passedQc,
      })
      const apiConfigured =
        (agent === "superbuy" && Boolean(process.env.SUPERBUY_API_KEY?.trim())) ||
        (agent === "anovabuy" && Boolean(process.env.ANOVABUY_API_KEY?.trim()))
      if (pre.ok && apiConfigured) deps.push({ channel: "china_agent", via: "china_agent" })
    }
    return deps
  } catch (e) {
    console.error("[checkout-deliverability]", {
      productId,
      result: "lookup_failed",
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/**
 * Read-only count of the purchases started in the last 24 h, for each dependency channel that is open with a finite
 * daily quota. A channel whose count cannot be read is left out, so the pure decision treats it as closed.
 */
async function loadQuotaUsed(
  deps: PurchaseDependency[] | null,
): Promise<Partial<Record<SupplierPurchaseChannel, number>>> {
  const out: Partial<Record<SupplierPurchaseChannel, number>> = {}
  if (!deps) return out
  for (const channel of new Set(deps.map((d) => d.channel))) {
    const decision = supplierPurchaseDecision(process.env, channel)
    if (!decision.allowed || decision.dailyLimit === null) continue
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(SUPPLIER_PURCHASE_CLAIM_SQL.quotaCount, channel)
      out[channel] = Number(rows[0]?.n ?? 0)
    } catch (e) {
      console.warn("[checkout-deliverability]", {
        result: "quota_unreadable",
        channel,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return out
}

export async function lineDeliverability(productId: string): Promise<LineDeliverability> {
  const deps = await loadPurchaseDependencies(productId)
  return decideLineDeliverability(deps, process.env, await loadQuotaUsed(deps))
}

/**
 * The server gate, called right before a payment is created (Stripe Checkout Session or PaymentIntent). Returns a 409
 * response when a line cannot ship, null to continue. The client never decides: this runs on every payment path.
 */
export async function assertCheckoutDeliverable(
  flow: string,
  /** Catalog product id + the id the CLIENT sent for that line (listing id), returned so the UI can flag the line. */
  items: Array<{ productId: string; ref: string }>,
  extra: PurchaseDependency[] = [],
): Promise<NextResponse | null> {
  const mode = checkoutDeliverabilityMode(process.env.CHECKOUT_DELIVERABILITY_MODE)
  if (mode === "off") return null
  const unique = [...new Set(items.map((i) => i.productId))]
  const byProduct = new Map(
    await Promise.all(
      unique.map(async (productId) => {
        const deps = await loadPurchaseDependencies(productId)
        return [productId, decideLineDeliverability(deps === null ? null : [...deps, ...extra], process.env)] as const
      }),
    ),
  )
  const lines = items.map((i) => ({ productId: i.ref, verdict: byProduct.get(i.productId)! }))
  const verdict = decideCheckoutDeliverability(lines, mode)
  if (verdict.ok) {
    if (verdict.warnings.length > 0) {
      console.log("[checkout-deliverability]", { flow, result: "would_refuse_if_enforced", lines: verdict.warnings })
    }
    return null
  }
  console.log("[checkout-deliverability]", { flow, result: "refused", lines: verdict.blocked })
  return NextResponse.json(deliverabilityRefusalBody(verdict), { status: 409 })
}
