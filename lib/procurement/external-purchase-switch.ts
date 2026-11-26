/**
 * ONE switch for every purchase Affisell makes from an external source (AliExpress, CJ, BigBuy… — the channels of
 * `lib/auto-buy-sourcing-channels.ts`, and the China buying agents). Pure: the env is a parameter.
 *
 * Owner decision 2026-11-13 (auto-buy is OPT-IN) and the three-systems principle of 2026-11-18 (the Procurement
 * Engine is a secondary capability, activated in production only with the founder's explicit agreement): an external
 * purchase happens only when `AUTO_BUY_ENABLED=true`. The legacy kill switches (`DISABLE_AUTO_BUY=true`,
 * `AUTO_ORDER_ENABLED=false`) still win over the opt-in.
 *
 * Before this module, only `lib/fulfillment/auto-buy.ts` honoured the opt-in: the auto-order engine (sourcing channels
 * of an authorised supplier), the `order.paid` AliExpress path and the China-buy trigger did not.
 *
 * What the switch does NOT govern (on purpose — catalogue suppliers keep working whatever it says):
 * - `AFFISELL_NATIVE` / `MANUAL` jobs (the supplier ships its own stock),
 * - `BLIND_REST` (the supplier's own vetted partner API),
 * - the fulfilment orchestrator that pushes orders to the supplier's own Shopify / WooCommerce store.
 */

export type Env = Record<string, string | undefined>

export function isExternalPurchaseEnabled(env: Env = process.env): boolean {
  if (env.DISABLE_AUTO_BUY === "true" || env.AUTO_ORDER_ENABLED === "false") return false
  return env.AUTO_BUY_ENABLED === "true"
}

/** Error code returned by a purchase path that refused because the switch is off. Never retried by a worker. */
export const EXTERNAL_PURCHASE_DISABLED_ERROR = "external_purchase_disabled"

/**
 * Check BEFORE the payment (lifecycle rule 4): a product that only an external purchase can deliver — today the
 * products of the platform auto-buy account, whose payer, owner and contractual supplier is Affisell — must not take
 * a payment while external purchases are off: nobody would ship it.
 *
 * `PROCUREMENT_CHECKOUT_GATE` = `off` | `warn` (DEFAULT: logs what WOULD be refused, refuses nothing) | `enforce`
 * (refuses before the Stripe session exists). Read per request, like `CHECKOUT_STOCK_MODE`. Turning `enforce` on in
 * production changes what buyers can buy: founder decision.
 */
export type ExternalPurchaseCheckoutMode = "off" | "warn" | "enforce"

export function resolveExternalPurchaseCheckoutMode(env: Env = process.env): ExternalPurchaseCheckoutMode {
  const mode = env.PROCUREMENT_CHECKOUT_GATE?.trim().toLowerCase()
  if (mode === "off") return "off"
  if (mode === "enforce") return "enforce"
  return "warn"
}

export type ExternalPurchaseCheckoutLine = {
  productId: string
  productName?: string | null
  supplierId: string | null | undefined
}

export type ExternalPurchaseCheckoutDecision = {
  mode: ExternalPurchaseCheckoutMode
  /** First line that only an external purchase could deliver while purchases are off (null = nothing to refuse). */
  blocked: ExternalPurchaseCheckoutLine | null
  /** True only in `enforce`: the caller must refuse the checkout. */
  refuse: boolean
}

/**
 * Pure decision. `platformBuyerSupplierIds` = the supplier accounts whose products can only be delivered by an
 * external purchase (the platform auto-buy account). When purchases are enabled, nothing is ever blocked.
 */
export function decideExternalPurchaseCheckout(
  lines: ExternalPurchaseCheckoutLine[],
  platformBuyerSupplierIds: ReadonlySet<string>,
  env: Env = process.env
): ExternalPurchaseCheckoutDecision {
  const mode = resolveExternalPurchaseCheckoutMode(env)
  if (mode === "off" || isExternalPurchaseEnabled(env)) return { mode, blocked: null, refuse: false }
  const blocked =
    lines.find((line) => typeof line.supplierId === "string" && platformBuyerSupplierIds.has(line.supplierId)) ?? null
  return { mode, blocked, refuse: blocked != null && mode === "enforce" }
}
