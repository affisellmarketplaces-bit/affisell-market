import type { SupplierPurchaseChannel } from "@/lib/supplier-purchase/policy"
import { supplierPurchaseDecision } from "@/lib/supplier-purchase/policy"

/**
 * Checkout deliverability — "will this line ship if the buyer pays now?" (pure). A line is NOT deliverable when it can
 * only ship through an automatic supplier purchase whose channel is closed (lib/supplier-purchase/policy.ts):
 * paying it would leave a paid order nobody buys. Native products — the supplier ships them itself — never depend on
 * a purchase and are never blocked. The dependencies come from the engine's own read-only resolution
 * (deliverability.server.ts), so checkout and fulfilment cannot disagree.
 *
 * Rollout switch CHECKOUT_DELIVERABILITY_MODE = off | warn | enforce (default **enforce**: the supplier-purchase lock is
 * closed by default, so every product that depends on it is refused rather than sold). `warn` only logs what would be
 * refused. Anything else = enforce (fail-closed).
 */
export type DeliverabilityMode = "off" | "warn" | "enforce"
export function checkoutDeliverabilityMode(raw: string | undefined): DeliverabilityMode {
  return raw === "off" || raw === "warn" ? raw : "enforce"
}

/** Why a line needs an automatic supplier purchase (one entry per path that would buy it). */
export type PurchaseDependency = {
  channel: SupplierPurchaseChannel
  via: "auto_buy" | "engine" | "engine_payment" | "china_agent" | "blind_dropship"
}

export type LineDeliverability =
  | { deliverable: true; dependencies: PurchaseDependency[] }
  | {
      deliverable: false
      dependencies: PurchaseDependency[]
      /** Language-neutral code for the client: closed channel, or the dependency could not be determined. */
      reason: "supplier_channel_closed" | "fulfillment_unknown"
      closedChannels: SupplierPurchaseChannel[]
    }

export function decideLineDeliverability(
  deps: PurchaseDependency[] | null,
  env: Record<string, string | undefined>,
): LineDeliverability {
  if (deps === null) {
    // Could not determine how the line ships (lookup failed): never take money for an order we cannot vouch for.
    return { deliverable: false, dependencies: [], reason: "fulfillment_unknown", closedChannels: [] }
  }
  const closed = [...new Set(deps.map((d) => d.channel))].filter((c) => !supplierPurchaseDecision(env, c).allowed)
  return closed.length === 0
    ? { deliverable: true, dependencies: deps }
    : { deliverable: false, dependencies: deps, reason: "supplier_channel_closed", closedChannels: closed }
}

export type CheckoutDeliverabilityVerdict =
  | { ok: true; warnings: Array<{ productId: string; reason: string }> }
  | { ok: false; blocked: Array<{ productId: string; reason: string; closedChannels: SupplierPurchaseChannel[] }> }

/** Whole cart: ONE undeliverable line refuses the whole payment (a mixed cart is never half-charged). */
export function decideCheckoutDeliverability(
  lines: Array<{ productId: string; verdict: LineDeliverability }>,
  mode: DeliverabilityMode,
): CheckoutDeliverabilityVerdict {
  const bad = lines.flatMap((l) =>
    l.verdict.deliverable
      ? []
      : [{ productId: l.productId, reason: l.verdict.reason, closedChannels: l.verdict.closedChannels }],
  )
  if (bad.length === 0 || mode === "off") return { ok: true, warnings: [] }
  if (mode === "warn") return { ok: true, warnings: bad.map((b) => ({ productId: b.productId, reason: b.reason })) }
  return { ok: false, blocked: bad }
}

/** HTTP body for a refused checkout: language-neutral codes, the product ids to flag in the cart, no internals. */
export function deliverabilityRefusalBody(verdict: Extract<CheckoutDeliverabilityVerdict, { ok: false }>) {
  return {
    error: "PRODUCT_TEMPORARILY_UNAVAILABLE",
    code: "checkout_deliverability_refused",
    message:
      "Un ou plusieurs produits ne peuvent pas être livrés pour le moment. Retirez-les du panier pour continuer.",
    unavailableProductIds: verdict.blocked.map((b) => b.productId),
    reasons: verdict.blocked.map((b) => ({ productId: b.productId, reason: b.reason })),
  }
}
