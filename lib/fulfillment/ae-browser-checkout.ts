import type { ShippingAddressPayload } from "@/lib/auto-order/types"
import { isAeDryRun } from "@/lib/fulfillment/ae-dry-run"
import {
  clickAeVariantMappingOnPage,
  launchAeBrowserPage,
} from "@/lib/fulfillment/ae-browser-variant-select"
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
  if (!browserAutomationEnabled()) {
    return { ok: false, error: "AE_BROWSER_AUTOMATION_NOT_CONFIGURED" }
  }

  const listingUrl = (input.supplierUrl?.trim() || input.aeUrl).trim()
  const mapping = input.variantMapping ?? null
  const mappingKeys = mapping ? Object.keys(mapping).length : 0

  if (mappingKeys > 0 && listingUrl) {
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
