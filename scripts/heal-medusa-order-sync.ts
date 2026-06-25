#!/usr/bin/env npx tsx
/**
 * Backfill Medusa Admin orders for paid Affisell orders (mapped products only).
 * Processes one order at a time with rate limiting to avoid Medusa API races.
 *
 * Usage (from repo root):
 *   npm run heal:medusa-orders
 *   npm run heal:medusa-orders -- cmqt67gj60001ju04ancvvt1y
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
  const { syncMarketplaceOrderToMedusaIfNeeded } = await import(
    "../lib/medusa/sync-marketplace-order.impl"
  )
  const { captureMedusaOrderExternalPayment } = await import("../lib/medusa-admin.impl")

  const rawArg = process.argv[2]?.trim()
  const orderIdArg =
    rawArg && !rawArg.startsWith("#") && /^c[a-z0-9]{20,}$/i.test(rawArg) ? rawArg : null
  const token = process.env.MEDUSA_ADMIN_TOKEN?.trim()
  const regionId = process.env.MEDUSA_REGION_ID?.trim()

  if (!token) {
    console.error(
      "[heal-medusa] MEDUSA_ADMIN_TOKEN missing — add Secret API Key to medusa-backend/.env AND root .env.local"
    )
    process.exit(1)
  }
  if (!regionId) {
    console.error("[heal-medusa] MEDUSA_REGION_ID missing — run: cd medusa-backend && npm run seed:region")
    process.exit(1)
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "paid",
      product: {
        OR: [{ medusaHandle: { not: null } }, { medusaVariantId: { not: null } }],
      },
      ...(orderIdArg ? { id: orderIdArg } : {}),
    },
    select: { id: true, medusaOrderId: true },
    orderBy: { createdAt: "asc" },
    take: orderIdArg ? 1 : 50,
  })

  if (orders.length === 0) {
    console.log("[heal-medusa] No paid orders with Medusa-mapped products")
    await prisma.$disconnect()
    return
  }

  console.log("[heal-medusa] Processing sequentially", {
    count: orders.length,
    rateLimitMs: HEAL_MEDUSA_RATE_LIMIT_MS,
  })

  let synced = 0
  let captured = 0
  let failed = 0

  for (const row of orders) {
    const hadMedusa = Boolean(row.medusaOrderId?.trim())
    try {
      if (!hadMedusa) {
        await syncMarketplaceOrderToMedusaIfNeeded(row.id)
      }

      const fresh = await prisma.order.findUnique({
        where: { id: row.id },
        select: { medusaOrderId: true },
      })
      const medusaOrderId = fresh?.medusaOrderId?.trim()
      if (!medusaOrderId) {
        console.warn("[heal-medusa] Skipped — no Medusa link", { orderId: row.id })
        failed += 1
        continue
      }

      if (!hadMedusa) {
        synced += 1
        console.log("[heal-medusa] Linked", { orderId: row.id, medusaOrderId })
      }

      await captureMedusaOrderExternalPayment(medusaOrderId, 0)
      captured += 1
      console.log("[heal-medusa] Paid", { orderId: row.id, medusaOrderId })
    } catch (err) {
      failed += 1
      console.error("[heal-medusa] Failed", {
        orderId: row.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    await sleep(HEAL_MEDUSA_RATE_LIMIT_MS)
  }

  console.log("[heal-medusa] Done", {
    total: orders.length,
    synced,
    captured,
    failed,
  })
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("[heal-medusa] Fatal", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
