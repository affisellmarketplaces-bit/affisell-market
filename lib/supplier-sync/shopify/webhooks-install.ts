import { shopifyAdminFetchJson } from "@/lib/shopify-admin-fetch"
import { DEFAULT_SHOPIFY_API_VERSION } from "@/lib/shopify-sync-map"
import { enqueueShopifyRequest } from "@/lib/supplier-sync/queue"
import type { ShopifyCredentials } from "@/lib/supplier-sync/types"

const WEBHOOK_TOPICS = [
  "products/update",
  "inventory_levels/update",
  "app/uninstalled",
] as const

export async function installShopifyWebhooks(args: {
  creds: ShopifyCredentials
  callbackBaseUrl: string
}): Promise<{ webhookIds: string[]; error?: string }> {
  const address = `${args.callbackBaseUrl.replace(/\/$/, "")}/api/webhooks/shopify`
  const webhookIds: string[] = []

  for (const topic of WEBHOOK_TOPICS) {
    const out = await enqueueShopifyRequest(async () =>
      shopifyAdminFetchJson({
        shopHost: args.creds.shopHost,
        accessToken: args.creds.accessToken,
        apiVersion: args.creds.apiVersion || DEFAULT_SHOPIFY_API_VERSION,
        path: "webhooks.json",
        method: "POST",
        body: {
          webhook: {
            topic,
            address,
            format: "json",
          },
        },
      })
    )

    if (!out.ok) {
      return { webhookIds, error: out.message }
    }

    const json = out.json as Record<string, unknown>
    const wh = json.webhook as Record<string, unknown> | undefined
    if (wh?.id != null) webhookIds.push(String(wh.id))
  }

  return { webhookIds }
}

export async function deleteShopifyWebhooks(args: {
  creds: ShopifyCredentials
  webhookIds: string[]
}): Promise<void> {
  for (const id of args.webhookIds) {
    await enqueueShopifyRequest(async () =>
      shopifyAdminFetchJson({
        shopHost: args.creds.shopHost,
        accessToken: args.creds.accessToken,
        apiVersion: args.creds.apiVersion || DEFAULT_SHOPIFY_API_VERSION,
        path: `webhooks/${id}.json`,
        method: "DELETE",
      })
    )
  }
}
