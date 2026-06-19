#!/usr/bin/env npx tsx
/**
 * Heal marketplace orders stuck in PENDING after paid Stripe Checkout.
 *
 * Usage:
 *   npm run reconcile:checkout
 *   npm run reconcile:checkout -- --loops 5
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

import { reconcilePendingCheckoutOrders } from "@/lib/cron/reconcile-pending-checkout-orders"
import { prisma } from "@/lib/prisma"

async function main() {
  const loopsArg = process.argv.find((a) => a.startsWith("--loops="))
  const loops = loopsArg ? Math.max(1, Number(loopsArg.split("=")[1]) || 1) : 3

  let totalHealed = 0
  let lastScanned = 0

  for (let i = 0; i < loops; i++) {
    const result = await reconcilePendingCheckoutOrders()
    totalHealed += result.healed
    lastScanned = result.scanned
    console.log("[reconcile-checkout-orders]", { loop: i + 1, ...result })
    if (result.scanned === 0) break
  }

  const pendingRemaining = await prisma.order.count({
    where: { status: "PENDING", stripeSessionId: { startsWith: "cs_" } },
  })

  console.log("[reconcile-checkout-orders]", {
    totalHealed,
    lastScanned,
    pendingRemaining,
  })
}

main()
  .catch((error) => {
    console.error("[reconcile-checkout-orders]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
