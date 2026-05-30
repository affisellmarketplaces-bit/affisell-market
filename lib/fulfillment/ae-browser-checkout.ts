import type { ShippingAddressPayload } from "@/lib/auto-order/types"

export type AeBrowserCheckoutInput = {
  aeUrl: string
  aeSkuId: string | null
  shippingAddress: ShippingAddressPayload
  cardNumber: string
  cardExpMonth: number
  cardExpYear: number
  cardCvc: string
}

export type AeBrowserCheckoutResult =
  | { ok: true; aeOrderId: string; aeTracking: string | null }
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
  _input: AeBrowserCheckoutInput
): Promise<AeBrowserCheckoutResult> {
  if (!browserAutomationEnabled()) {
    return { ok: false, error: "AE_BROWSER_AUTOMATION_NOT_CONFIGURED" }
  }
  return {
    ok: false,
    error: "AE_BROWSER_CHECKOUT_USE_DOCKER_WORKER",
  }
}
