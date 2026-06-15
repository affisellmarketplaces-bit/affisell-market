import { prisma } from "@/lib/prisma"

export type ExpansionEmailEventCounts = {
  deliveredThisMonth: number
  bouncesThisMonth: number
  complaintsThisMonth: number
}

function monthStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

export async function loadExpansionEmailEventCounts(now = new Date()): Promise<ExpansionEmailEventCounts> {
  const monthStart = monthStartUtc(now)
  const [deliveredThisMonth, bouncesThisMonth, complaintsThisMonth] = await Promise.all([
    prisma.processedWebhook.count({
      where: { status: "expansion_delivered", createdAt: { gte: monthStart } },
    }),
    prisma.processedWebhook.count({
      where: { id: { startsWith: "expansion:bounce:" }, createdAt: { gte: monthStart } },
    }),
    prisma.processedWebhook.count({
      where: { id: { startsWith: "expansion:complaint:" }, createdAt: { gte: monthStart } },
    }),
  ])

  return { deliveredThisMonth, bouncesThisMonth, complaintsThisMonth }
}
