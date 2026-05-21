import type { FulfillmentStatus, Prisma } from "@prisma/client"

const FULFILLMENT_STATUSES = new Set<string>([
  "PENDING",
  "PROCESSING",
  "PARTIAL",
  "ORDERED",
  "SHIPPED",
  "DELIVERED",
  "FAILED",
  "MANUAL_REQUIRED",
])

const PAYMENT_STATUSES = new Set(["paid", "preparing", "shipped", "refunded"])

export type AdminOrdersListQuery = {
  q?: string
  fulfillmentStatus?: FulfillmentStatus
  paymentStatus?: string
  createdFrom?: Date
  createdTo?: Date
  take: number
}

export function formatOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase()
}

export function parseAdminOrdersListQuery(searchParams: URLSearchParams): AdminOrdersListQuery {
  const q = searchParams.get("q")?.trim() || undefined
  const fulfillmentRaw = searchParams.get("fulfillmentStatus")?.trim()
  const paymentRaw = searchParams.get("paymentStatus")?.trim()
  const createdFromRaw = searchParams.get("createdFrom")?.trim()
  const createdToRaw = searchParams.get("createdTo")?.trim()

  const fulfillmentStatus =
    fulfillmentRaw && FULFILLMENT_STATUSES.has(fulfillmentRaw)
      ? (fulfillmentRaw as FulfillmentStatus)
      : undefined

  const paymentStatus =
    paymentRaw && PAYMENT_STATUSES.has(paymentRaw) ? paymentRaw : undefined

  let createdFrom: Date | undefined
  let createdTo: Date | undefined
  if (createdFromRaw) {
    const d = new Date(createdFromRaw)
    if (!Number.isNaN(d.getTime())) {
      d.setUTCHours(0, 0, 0, 0)
      createdFrom = d
    }
  }
  if (createdToRaw) {
    const d = new Date(createdToRaw)
    if (!Number.isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999)
      createdTo = d
    }
  }

  const takeRaw = Number(searchParams.get("take") ?? "50")
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(1, takeRaw), 100) : 50

  return {
    q,
    fulfillmentStatus,
    paymentStatus,
    createdFrom,
    createdTo,
    take,
  }
}

export function buildAdminOrdersWhere(query: AdminOrdersListQuery): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = []

  if (query.q) {
    and.push({
      OR: [
        { id: { contains: query.q, mode: "insensitive" } },
        { customerEmail: { contains: query.q, mode: "insensitive" } },
        { stripeSessionId: { contains: query.q, mode: "insensitive" } },
      ],
    })
  }
  if (query.fulfillmentStatus) {
    and.push({ fulfillmentStatus: query.fulfillmentStatus })
  }
  if (query.paymentStatus) {
    and.push({ status: query.paymentStatus })
  }
  if (query.createdFrom || query.createdTo) {
    and.push({
      createdAt: {
        ...(query.createdFrom ? { gte: query.createdFrom } : {}),
        ...(query.createdTo ? { lte: query.createdTo } : {}),
      },
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

export function adminOrdersListSearchParams(query: AdminOrdersListQuery): string {
  const p = new URLSearchParams()
  if (query.q) p.set("q", query.q)
  if (query.fulfillmentStatus) p.set("fulfillmentStatus", query.fulfillmentStatus)
  if (query.paymentStatus) p.set("paymentStatus", query.paymentStatus)
  if (query.createdFrom) p.set("createdFrom", query.createdFrom.toISOString().slice(0, 10))
  if (query.createdTo) p.set("createdTo", query.createdTo.toISOString().slice(0, 10))
  return p.toString()
}
