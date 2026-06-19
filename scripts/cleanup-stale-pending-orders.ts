#!/usr/bin/env npx tsx
/**
 * Cancel PENDING checkout rows whose Stripe session was never paid (abandoned/expired).
 *
 * Usage:
 *   npm run cleanup:stale-pending -- --dry-run
 *   npm run cleanup:stale-pending -- --apply
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
for (const name of [".env.pre-local-merge.bak", ".env", ".env.local"]) {
  const path = resolve(root, name)
  if (existsSync(path)) config({ path, override: true })
}

import { getStripeClient } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

const MIN_AGE_MS = 60 * 60 * 1000
const BATCH = 50

async function main() {
  const apply = process.argv.includes("--apply")
  const dryRun = !apply

  const rows = await prisma.order.findMany({
    where: {
      status: "PENDING",
      stripeSessionId: { startsWith: "cs_" },
      createdAt: { lte: new Date(Date.now() - MIN_AGE_MS) },
    },
    select: { id: true, stripeSessionId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  })

  const stripe = getStripeClient()
  let cancelled = 0
  let kept = 0

  for (const row of rows) {
    const session = await stripe.checkout.sessions.retrieve(row.stripeSessionId)
    const shouldCancel = session.payment_status !== "paid"

    if (!shouldCancel) {
      kept += 1
      console.log("[cleanup-stale-pending]", {
        orderId: row.id,
        sessionId: row.stripeSessionId,
        action: "keep",
        payment_status: session.payment_status,
        status: session.status,
      })
      continue
    }

    if (dryRun) {
      cancelled += 1
      console.log("[cleanup-stale-pending]", {
        orderId: row.id,
        sessionId: row.stripeSessionId,
        action: "dry-run-cancel",
      })
      continue
    }

    await prisma.order.update({
      where: { id: row.id },
      data: { status: "CANCELLED" },
    })
    cancelled += 1
    console.log("[cleanup-stale-pending]", {
      orderId: row.id,
      sessionId: row.stripeSessionId,
      action: "cancelled",
    })
  }

  const pendingRemaining = await prisma.order.count({
    where: { status: "PENDING", stripeSessionId: { startsWith: "cs_" } },
  })

  console.log("[cleanup-stale-pending]", {
    dryRun,
    scanned: rows.length,
    cancelled,
    kept,
    pendingRemaining,
  })
}

main()
  .catch((error) => {
    console.error("[cleanup-stale-pending]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
