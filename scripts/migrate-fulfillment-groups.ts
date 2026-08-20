/**
 * One-shot: create FulfillmentGroups for existing supplier to-ship orders.
 *
 * Usage:
 *   npm run migrate:fulfillment-groups
 *   npm run migrate:fulfillment-groups -- --dry-run
 */
import { FulfillmentGroupStatus } from "@prisma/client"

import { ensureDatabaseUrlUnpooled } from "@/lib/ensure-database-url-unpooled"
import { FULFILLMENT_BACKFILL_ORDER_STATUSES } from "@/lib/fulfillment/order-eligible-statuses"
import { fulfillmentOrchestrator } from "@/lib/fulfillment/orchestrator"
import {
  resolveBaseStripeSessionId,
  stripeSessionOrderWhere,
} from "@/lib/fulfillment/stripe-session-id"
import { getPrismaDirectDatasourceUrl } from "@/lib/prisma-datasource-url"
import { fulfillmentPrisma, prisma } from "@/lib/prisma"

const SESSION_DELAY_MS = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function countPendingLinesInSession(baseSessionId: string): Promise<number> {
  return prisma.order.count({
    where: {
      ...stripeSessionOrderWhere(baseSessionId),
      status: { in: [...FULFILLMENT_BACKFILL_ORDER_STATUSES] },
      fulfillmentItem: null,
    },
  })
}

async function main() {
  ensureDatabaseUrlUnpooled()

  const dryRun = process.argv.includes("--dry-run")
  const directUrl = getPrismaDirectDatasourceUrl()
  const directHost = directUrl ? new URL(directUrl).hostname : null

  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...FULFILLMENT_BACKFILL_ORDER_STATUSES] },
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

  const statusBreakdown = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1
    return acc
  }, {})

  const sessions = new Map<string, { seedOrderId: string; seedStatus: string }>()
  for (const order of orders) {
    const base = resolveBaseStripeSessionId(order.stripeSessionId)
    if (!sessions.has(base)) {
      sessions.set(base, { seedOrderId: order.id, seedStatus: order.status })
    }
  }

  console.log("[migrate-fulfillment-groups]", {
    orderCount: orders.length,
    sessionCount: sessions.size,
    statusBreakdown,
    dryRun,
    sequential: true,
    delayMs: SESSION_DELAY_MS,
    fulfillmentDbHost: directHost,
    fulfillmentDbPooler: directHost ? /-pooler\./i.test(directHost) : null,
  })

  if (dryRun) return

  let created = 0
  let skippedComplete = 0
  let skippedIneligible = 0
  let index = 0

  for (const [baseSessionId, seed] of sessions) {
    index++
    const pendingLines = await countPendingLinesInSession(baseSessionId)
    if (pendingLines === 0) {
      skippedComplete++
      continue
    }

    const result = await fulfillmentOrchestrator.onOrderCreated(seed.seedOrderId, {
      skipAutoBuy: true,
      mode: "backfill",
    })

    if (result.groupIds.length === 0) {
      skippedIneligible++
      console.log("[migrate-fulfillment-groups]", {
        progress: `${index}/${sessions.size}`,
        baseSessionId: baseSessionId.slice(-12),
        seedStatus: seed.seedStatus,
        pendingLines,
        result: "skipped_ineligible",
      })
    } else {
      created += result.groupIds.length
      await fulfillmentPrisma.fulfillmentGroup.updateMany({
        where: {
          id: { in: result.groupIds },
          status: FulfillmentGroupStatus.PENDING,
        },
        data: { status: FulfillmentGroupStatus.AWAITING_SHIPMENT },
      })

      console.log("[migrate-fulfillment-groups]", {
        progress: `${index}/${sessions.size}`,
        baseSessionId: baseSessionId.slice(-12),
        seedStatus: seed.seedStatus,
        pendingLines,
        groupsThisSession: result.groupIds.length,
      })
    }

    if (index < sessions.size) {
      await sleep(SESSION_DELAY_MS)
    }
  }

  const remaining = await prisma.order.count({
    where: {
      status: { in: [...FULFILLMENT_BACKFILL_ORDER_STATUSES] },
      fulfillmentItem: null,
    },
  })

  console.log("[migrate-fulfillment-groups]", {
    result: "done",
    groupsCreated: created,
    sessionsSkippedComplete: skippedComplete,
    sessionsSkippedIneligible: skippedIneligible,
    ordersStillWithoutGroup: remaining,
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
