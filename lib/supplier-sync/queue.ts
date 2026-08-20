import PQueue from "p-queue"

/** Shared Shopify Admin rate limiter — max ~2 req/sec (429-safe). */
const shopifyQueue = new PQueue({
  concurrency: 1,
  intervalCap: 2,
  interval: 1000,
  carryoverConcurrencyCount: true,
})

export function enqueueShopifyRequest<T>(fn: () => Promise<T>): Promise<T> {
  return shopifyQueue.add(fn) as Promise<T>
}

export function getShopifyQueueStats(): { pending: number; size: number } {
  return { pending: shopifyQueue.pending, size: shopifyQueue.size }
}
