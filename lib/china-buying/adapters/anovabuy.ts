import { chinaAgentPurchase } from "@/lib/china-buying/adapters/agent-purchase"

import type { ChinaBuyAdapterResult } from "@/lib/china-buying/adapters/superbuy"

/**
 * Anovabuy API adapter — stub when ANOVABUY_API_KEY is unset.
 */
export async function routeAnovabuyItem(args: {
  sourceUrl: string
  platform: string | null
  quantity: number
  /** What is bought (`order:<id>` or `china:<idempotencyKey>`) — the supplier-purchase claim keys. */
  purchaseKeys: string[]
}): Promise<ChinaBuyAdapterResult> {
  const apiKey = process.env.ANOVABUY_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: true,
      status: "STUB",
      message: "ANOVABUY_API_KEY not configured — manual routing logged",
    }
  }

  return chinaAgentPurchase({
    agent: "anovabuy",
    url: "https://api.anovabuy.com/v1/purchase/route",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: { product_url: args.sourceUrl, platform: args.platform, qty: args.quantity },
    purchaseKeys: args.purchaseKeys,
    refOf: (j) => (typeof j.ref === "string" && j.ref ? j.ref : undefined),
    errorOf: (j) => (typeof j.error === "string" ? j.error : undefined),
  })
}
