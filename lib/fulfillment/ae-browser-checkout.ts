import { supplierPurchaseDecision } from "@/lib/supplier-purchase/policy"
import type { ShippingAddressPayload } from "@/lib/auto-order/types"
import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import { clickAeVariantMappingOnPage } from "@/lib/fulfillment/ae-browser-variant-select"
import { launchAeBrowserPage } from "@/lib/fulfillment/ae-browser-launch"
import type { VariantMappingRecord } from "@/lib/sku/variant-mapping"

export type AeBrowserCheckoutInput = {
  aeUrl: string
  aeSkuId: string | null
  /** Product.sourceUrl — AE listing for variant chip clicks. */
  supplierUrl?: string | null
  variantMapping?: VariantMappingRecord | null
  quantity?: number
  shippingAddress: ShippingAddressPayload
  cardNumber: string
  cardExpMonth: number
  cardExpYear: number
  cardCvc: string
  /** Same purchase keys as the DS call it falls back from (`order:<id>`): see lib/supplier-purchase/guard.server.ts. */
  purchaseKeys: string[]
  purchasePath: string
}

export type AeBrowserCheckoutResult =
  | { ok: true; aeOrderId: string; aeTracking: string | null; dryRun?: boolean }
  | { ok: false; error: string }

function browserAutomationEnabled(): boolean {
  return (
    process.env.AE_BROWSER_AUTOMATION_ENABLED === "true" &&
    Boolean(process.env.AE_EMAIL?.trim()) &&
    Boolean(process.env.AE_PASSWORD?.trim())
  )
}

/**
 * Puppeteer checkout runs in an isolated Docker worker (`npm run worker:auto-buy`).
 * Next.js API routes must not launch browsers — enqueue only.
 */
export async function runAliExpressBrowserCheckout(
  input: AeBrowserCheckoutInput
): Promise<AeBrowserCheckoutResult> {
  const decision = supplierPurchaseDecision(process.env, "aliexpress")
  if (!decision.allowed) return { ok: false, error: `supplier_purchase_blocked:${decision.reason}` }
  if (!input.purchaseKeys.some((k) => k.trim())) return { ok: false, error: "supplier_purchase_missing_key" }
  if (!browserAutomationEnabled()) {
    return { ok: false, error: "AE_BROWSER_AUTOMATION_NOT_CONFIGURED" }
  }
  // NOTE: the real pay step is not implemented here (it answers AE_BROWSER_CHECKOUT_USE_DOCKER_WORKER). Whoever
  // implements it MUST wrap it in guardSupplierPurchase({ channel: "aliexpress", keys: input.purchaseKeys }) — the
  // inventory test lib/__tests__/supplier-purchase-inventory.test.ts fails otherwise.

  const listingUrl = (input.supplierUrl?.trim() || input.aeUrl).trim()
  const mapping = input.variantMapping ?? null
  const mappingKeys = mapping ? Object.keys(mapping).length : 0

  if (mapping && mappingKeys > 0 && listingUrl) {
    const launched = await launchAeBrowserPage()
    if (!launched.ok) {
      console.log("[auto-buy] browser variant select skipped", {
        aeUrl: input.aeUrl,
        reason: launched.error,
      })
    } else {
      const picked = await clickAeVariantMappingOnPage(launched.page, listingUrl, mapping)
      await launched.close()
      if (!picked.ok) {
        return { ok: false, error: picked.error }
      }
    }
  }

  // Browser flow: login → cart → address → (dry run stops here) → pay
  console.log("[auto-buy] browser checkout: login and cart steps would run here", {
    aeUrl: input.aeUrl,
    listingUrl,
    aeSkuId: input.aeSkuId,
    variantMappingKeys: mappingKeys,
    quantity: input.quantity ?? 1,
    shipTo: input.shippingAddress.name,
  })

  if (isAeDryRun()) {
    console.log("[auto-buy] DRY_RUN enabled - stopping before payment")
    console.log("[auto-buy] Would have paid with card •••• 0005")
    console.log("[auto-buy] Product:", input.aeSkuId, "Qty:", input.quantity ?? 1)
    console.log("[auto-buy] Shipping to:", input.shippingAddress.name ?? "(unknown)")
    return {
      ok: true,
      aeOrderId: `DRY_RUN_${Date.now()}`,
      aeTracking: null,
      dryRun: true,
    }
  }

  return {
    ok: false,
    error: "AE_BROWSER_CHECKOUT_USE_DOCKER_WORKER",
  }
}
