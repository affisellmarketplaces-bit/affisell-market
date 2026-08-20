import { prisma } from "@/lib/prisma"

/** Idempotent webhook ingestion — returns false if duplicate. */
export async function recordSupplierWebhookEvent(args: {
  shopifyWebhookId: string
  topic: string
  shopDomain: string
  integrationId: string
  payload: Record<string, unknown>
}): Promise<boolean> {
  try {
    await prisma.supplierWebhookEvent.create({
      data: {
        shopifyWebhookId: args.shopifyWebhookId,
        topic: args.topic,
        shopDomain: args.shopDomain,
        integrationId: args.integrationId,
        payload: args.payload as object,
      },
    })
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Unique constraint") || msg.includes("Unique")) return false
    throw e
  }
}
