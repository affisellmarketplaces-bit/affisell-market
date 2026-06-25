#!/usr/bin/env npx tsx
/**
 * Backfill Medusa Admin orders for paid Affisell orders that have a mapped product.
 * Loads medusa-backend/.env (same as Medusa CLI) so MEDUSA_ADMIN_TOKEN is available.
 *
 * Usage:
 *   npx tsx scripts/heal-medusa-order-sync.ts
 *   npx tsx scripts/heal-medusa-order-sync.ts cmqt67gj60001ju04ancvvt1y
 */
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"

const root = resolve(import.meta.dirname, "..")
const medusaEnv = resolve(root, "medusa-backend", ".env")

if (existsSync(medusaEnv)) {
  loadEnv({ path: medusaEnv, override: true })
}
loadEnv({ path: resolve(root, ".env.local"), override: false })
loadEnv({ path: resolve(root, ".env"), override: false })

async function main() {
  const { prisma } = await import("../lib/prisma")
  const { syncMarketplaceOrderToMedusaIfNeeded } = await import(
    "../lib/medusa/sync-marketplace-order.impl"
  )

  const orderIdArg = process.argv[2]?.trim()
  const token = process.env.MEDUSA_ADMIN_TOKEN?.trim()
  const regionId = process.env.MEDUSA_REGION_ID?.trim()

  if (!token) {
    console.error(
      "[heal-medusa] MEDUSA_ADMIN_TOKEN missing — add Secret API Key to medusa-backend/.env AND root .env.local for Next.js webhooks"
    )
    process.exit(1)
  }
  if (!regionId) {
    console.error("[heal-medusa] MEDUSA_REGION_ID missing — run: cd medusa-backend && npm run seed:region")
    process.exit(1)
  }

  const orderIds = orderIdArg
    ? [orderIdArg]
    : (
        await prisma.order.findMany({
          where: {
            status: "paid",
            medusaOrderId: null,
            product: {
              OR: [{ medusaHandle: { not: null } }, { medusaVariantId: { not: null } }],
            },
          },
          select: { id: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      ).map((o) => o.id)

  if (orderIds.length === 0) {
    console.log("[heal-medusa] No paid orders to sync (product needs medusaHandle or medusaVariantId)")
    await prisma.$disconnect()
    return
  }

  console.log("[heal-medusa] Syncing", { count: orderIds.length })

  let synced = 0
  for (const orderId of orderIds) {
    const before = await prisma.order.findUnique({
      where: { id: orderId },
      select: { medusaOrderId: true },
    })
    await syncMarketplaceOrderToMedusaIfNeeded(orderId)
    const after = await prisma.order.findUnique({
      where: { id: orderId },
      select: { medusaOrderId: true },
    })
    if (after?.medusaOrderId && after.medusaOrderId !== before?.medusaOrderId) {
      synced += 1
      console.log("[heal-medusa] Linked", { orderId, medusaOrderId: after.medusaOrderId })
    } else {
      console.warn("[heal-medusa] Skipped or failed", { orderId, medusaOrderId: after?.medusaOrderId })
    }
  }

  console.log("[heal-medusa] Done", { synced, total: orderIds.length })
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("[heal-medusa] Fatal", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
