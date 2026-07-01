#!/usr/bin/env npx tsx
/**
 * Backfill Medusa fulfillments for Affisell orders already marked shipped.
 *
 * Usage:
 *   npm run heal:medusa-fulfillments
 *   npm run heal:medusa-fulfillments -- cmqt67gj60001ju04ancvvt1y
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

const HEAL_MEDUSA_RATE_LIMIT_MS = 100

const root = resolve(import.meta.dirname, "..")
const medusaEnv = resolve(root, "medusa-backend", ".env")

if (existsSync(medusaEnv)) {
  loadEnv({ path: medusaEnv, override: true })
}
loadEnv({ path: resolve(root, ".env.local"), override: false })
loadEnv({ path: resolve(root, ".env"), override: false })

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms)
  })
}

async function main() {
  const { prisma } = await import("../lib/prisma")
  const { syncAffisellShipmentToMedusaIfNeeded } = await import(
    "../lib/medusa/sync-order-fulfillment.impl"
  )

  const rawArg = process.argv[2]?.trim()
  const orderIdArg =
    rawArg && !rawArg.startsWith("#") && /^c[a-z0-9]{20,}$/i.test(rawArg) ? rawArg : null
  const token = process.env.MEDUSA_ADMIN_TOKEN?.trim()

  if (!token) {
    console.error("[heal-medusa-fulfillment] MEDUSA_ADMIN_TOKEN missing")
    process.exit(1)
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "shipped",
      medusaOrderId: { not: null },
      trackingNumber: { not: null },
      ...(orderIdArg ? { id: orderIdArg } : {}),
    },
    select: {
      id: true,
      medusaOrderId: true,
      trackingNumber: true,
      trackingCarrier: true,
    },
    orderBy: { shippedAt: "asc" },
    take: orderIdArg ? 1 : 50,
  })

  if (orders.length === 0) {
    console.log("[heal-medusa-fulfillment] No shipped orders with Medusa link + tracking")
    await prisma.$disconnect()
    return
  }

  console.log("[heal-medusa-fulfillment] Processing sequentially", {
    count: orders.length,
    rateLimitMs: HEAL_MEDUSA_RATE_LIMIT_MS,
  })

  let synced = 0
  let skipped = 0
  let failed = 0

  for (const row of orders) {
    const medusaOrderId = row.medusaOrderId?.trim()
    const trackingNumber = row.trackingNumber?.trim()
    if (!medusaOrderId || !trackingNumber) {
      skipped += 1
      continue
    }

    try {
      const result = await syncAffisellShipmentToMedusaIfNeeded({
        affisellOrderId: row.id,
        medusaOrderId,
        trackingNumber,
        trackingCarrier: row.trackingCarrier,
      })
      if (result.synced) {
        synced += 1
        console.log("[heal-medusa-fulfillment] Synced", { orderId: row.id, medusaOrderId })
      } else {
        skipped += 1
        console.log("[heal-medusa-fulfillment] Skipped", {
          orderId: row.id,
          reason: result.reason,
        })
      }
    } catch (err) {
      failed += 1
      console.error("[heal-medusa-fulfillment] Failed", {
        orderId: row.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    await sleep(HEAL_MEDUSA_RATE_LIMIT_MS)
  }

  console.log("[heal-medusa-fulfillment] Done", {
    total: orders.length,
    synced,
    skipped,
    failed,
  })
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("[heal-medusa-fulfillment] Fatal", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
