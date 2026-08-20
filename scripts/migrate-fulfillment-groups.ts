/**
 * One-shot: create FulfillmentGroups for existing paid/preparing orders awaiting shipment.
 *
 * Usage: npx tsx scripts/migrate-fulfillment-groups.ts [--dry-run]
 */
import { FulfillmentGroupStatus } from "@prisma/client"

import { fulfillmentOrchestrator } from "@/lib/fulfillment/orchestrator"
import { resolveBaseStripeSessionId } from "@/lib/fulfillment/stripe-session-id"
import { fulfillmentPrisma, prisma } from "@/lib/prisma"

const SESSION_DELAY_MS = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["paid", "preparing", "fulfilling"] },
      fulfillmentItem: null,
    },
    select: {
      id: true,
      stripeSessionId: true,
      supplierId: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const sessions = new Map<string, string>()
  for (const order of orders) {
    const base = resolveBaseStripeSessionId(order.stripeSessionId)
    if (!sessions.has(base)) sessions.set(base, order.id)
  }

  console.log("[migrate-fulfillment-groups]", {
    orderCount: orders.length,
    sessionCount: sessions.size,
    dryRun,
    sequential: true,
    delayMs: SESSION_DELAY_MS,
  })

  if (dryRun) return

  let created = 0
  let skipped = 0
  let index = 0

  for (const [baseSessionId, seedOrderId] of sessions) {
    index++
    const existing = await fulfillmentPrisma.fulfillmentGroup.count({
      where: { stripeSessionId: baseSessionId },
    })
    if (existing > 0) {
      skipped++
      continue
    }

    const result = await fulfillmentOrchestrator.onOrderCreated(seedOrderId, {
      skipAutoBuy: true,
    })

    if (result.groupIds.length > 0) {
      created += result.groupIds.length
      await fulfillmentPrisma.fulfillmentGroup.updateMany({
        where: {
          id: { in: result.groupIds },
          status: FulfillmentGroupStatus.PENDING,
        },
        data: { status: FulfillmentGroupStatus.AWAITING_SHIPMENT },
      })
    }

    console.log("[migrate-fulfillment-groups]", {
      progress: `${index}/${sessions.size}`,
      baseSessionId: baseSessionId.slice(-12),
      groupsThisSession: result.groupIds.length,
    })

    if (index < sessions.size) {
      await sleep(SESSION_DELAY_MS)
    }
  }

  console.log("[migrate-fulfillment-groups]", {
    result: "done",
    groupsCreated: created,
    sessionsSkipped: skipped,
  })
}

main()
  .catch((e) => {
    console.error("[migrate-fulfillment-groups]", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await fulfillmentPrisma.$disconnect()
  })
