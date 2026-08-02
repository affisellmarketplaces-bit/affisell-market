/**
 * BullMQ worker — run locally: npm run worker:auto-order
 * Requires REDIS_URL and DATABASE_URL.
 *
 * Queues:
 * - place-order / batch-fulfill (universal auto-order)
 * - auto-buy (AE DS + browser fallback)
 * - order.paid → AliExpress DS create (retry 3× exponential backoff)
 */
import { createBatchFulfillWorker, createPlaceSupplierOrderWorker } from "@/lib/auto-order/bullmq/place-order.queue"
import { createAutoBuyWorker } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { createOrderPaidWorker } from "@/lib/fulfillment/order-paid-queue"
import { MAX_DAILY_ORDERS, MAX_ORDER_VALUE_EUR } from "@/lib/fulfillment/auto-buy"
import { getRedisUrl } from "@/lib/auto-order/redis"

const DRY_RUN = process.env.AE_DRY_RUN === "true"

async function main() {
  if (!getRedisUrl()) {
    console.error("[auto-order-worker] REDIS_URL is required")
    process.exit(1)
  }

  const placeWorker = createPlaceSupplierOrderWorker()
  const batchWorker = createBatchFulfillWorker()
  const autoBuyWorker = createAutoBuyWorker()
  const orderPaidWorker = createOrderPaidWorker()

  console.info("[auto-order-worker] listening", {
    place: placeWorker.name,
    batch: batchWorker.name,
    autoBuy: autoBuyWorker.name,
    orderPaid: orderPaidWorker.name,
    concurrency: process.env.AUTO_ORDER_WORKER_CONCURRENCY ?? "4",
    dryRun: DRY_RUN,
  })

  if (DRY_RUN) {
    console.info("[auto-order-worker] AE_DRY_RUN=true — auto-buy stops before payment (card / AE commit)")
  }

  console.log(
    `[auto-buy] Limits: ${MAX_DAILY_ORDERS} orders/day, ${MAX_ORDER_VALUE_EUR}€/order max`
  )
  console.log("[order-paid] AliExpress DS fulfill queue ready (retry 3× on rate-limit)")

  const shutdown = async () => {
    await Promise.all([
      placeWorker.close(),
      batchWorker.close(),
      autoBuyWorker.close(),
      orderPaidWorker.close(),
    ])
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((e) => {
  console.error("[auto-order-worker] fatal", e)
  process.exit(1)
})
