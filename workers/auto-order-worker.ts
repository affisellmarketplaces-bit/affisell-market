/**
 * BullMQ worker — run locally: npm run worker:auto-order
 * Requires REDIS_URL and DATABASE_URL.
 */
import { createBatchFulfillWorker, createPlaceSupplierOrderWorker } from "@/lib/auto-order/bullmq/place-order.queue"
import { createAutoBuyWorker } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { getRedisUrl } from "@/lib/auto-order/redis"

async function main() {
  if (!getRedisUrl()) {
    console.error("[auto-order-worker] REDIS_URL is required")
    process.exit(1)
  }

  const placeWorker = createPlaceSupplierOrderWorker()
  const batchWorker = createBatchFulfillWorker()
  const autoBuyWorker = createAutoBuyWorker()

  console.info("[auto-order-worker] listening", {
    place: placeWorker.name,
    batch: batchWorker.name,
    autoBuy: autoBuyWorker.name,
    concurrency: process.env.AUTO_ORDER_WORKER_CONCURRENCY ?? "4",
  })

  const shutdown = async () => {
    await Promise.all([placeWorker.close(), batchWorker.close(), autoBuyWorker.close()])
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((e) => {
  console.error("[auto-order-worker] fatal", e)
  process.exit(1)
})
