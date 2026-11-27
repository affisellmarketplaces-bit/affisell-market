import { chinaAgentPurchase } from "@/lib/china-buying/adapters/agent-purchase"

export type ChinaBuyAdapterResult =
  | { ok: true; status: "API_OK"; externalRef: string }
  | { ok: true; status: "STUB"; message: string }
  | { ok: false; status: "API_FAIL"; error: string }

/**
 * Superbuy API adapter — stub when SUPERBUY_API_KEY is unset.
 * Real integration: POST item URL to Superbuy cart API.
 */
export async function routeSuperbuyItem(args: {
  sourceUrl: string
  platform: string | null
  quantity: number
  /** What is bought (`order:<id>` or `china:<idempotencyKey>`) — the supplier-purchase claim keys. */
  purchaseKeys: string[]
}): Promise<ChinaBuyAdapterResult> {
  const apiKey = process.env.SUPERBUY_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: true,
      status: "STUB",
      message: "SUPERBUY_API_KEY not configured — manual routing logged",
    }
  }

  return chinaAgentPurchase({
    agent: "superbuy",
    url: "https://api.superbuy.com/v1/items/route",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: { url: args.sourceUrl, platform: args.platform, quantity: args.quantity },
    purchaseKeys: args.purchaseKeys,
    refOf: (j) => (typeof j.orderId === "string" && j.orderId ? j.orderId : undefined),
    errorOf: (j) => (typeof j.message === "string" ? j.message : undefined),
  })
}
