import { TERMINAL_RETURN_STATUSES } from "@/lib/order-return-types"
import { loadOrdersToShipSla } from "@/lib/supplier-ship-sla"
import { prisma } from "@/lib/prisma"

const LOW_STOCK_THRESHOLD = 5
const SHOP_RATING_PENALTY_PCT_PER_MESSAGE = 3

export type LowStockUrgentLine = {
  productId: string
  variantId: string | null
  label: string
  stock: number
}

export type SupplierUrgentSnapshot = {
  ordersToShip: number
  ordersToShipSlaMs: number | null
  ordersToShipPenaltyCents: number
  lowStockCount: number
  lowStockLines: LowStockUrgentLine[]
  lowStockDailyLossCents: number
  clientMessagesCount: number
  /** Display-only estimated shop rating hit per pending buyer message. */
  shopRatingImpactPct: number
  firstClientMessagePreview: string | null
}

function formatStockLabel(
  productName: string,
  color: string | null,
  size: string | null
): string {
  const c = color?.trim()
  const s = size?.trim()
  if (c && s) return `${c} ${s}`
  if (c) return c
  if (s) return s
  return productName.trim().slice(0, 48)
}

async function loadLowStockLines(supplierId: string): Promise<LowStockUrgentLine[]> {
  const [variants, simpleProducts] = await Promise.all([
    prisma.productVariant.findMany({
      where: {
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { supplierId, active: true, isDraft: false, hasVariants: true },
      },
      select: {
        id: true,
        stock: true,
        color: true,
        size: true,
        product: { select: { id: true, name: true } },
      },
      orderBy: [{ stock: "asc" }, { updatedAt: "desc" }],
      take: 6,
    }),
    prisma.product.findMany({
      where: {
        supplierId,
        active: true,
        isDraft: false,
        hasVariants: false,
        stock: { lte: LOW_STOCK_THRESHOLD },
      },
      select: { id: true, name: true, stock: true },
      orderBy: [{ stock: "asc" }, { updatedAt: "desc" }],
      take: 6,
    }),
  ])

  const lines: LowStockUrgentLine[] = [
    ...variants.map((v) => ({
      productId: v.product.id,
      variantId: v.id,
      label: formatStockLabel(v.product.name, v.color, v.size),
      stock: v.stock,
    })),
    ...simpleProducts.map((p) => ({
      productId: p.id,
      variantId: null,
      label: p.name.trim().slice(0, 48),
      stock: p.stock,
    })),
  ]

  lines.sort((a, b) => a.stock - b.stock)
  return lines.slice(0, 6)
}

async function loadClientMessages(supplierId: string): Promise<{
  count: number
  preview: string | null
}> {
  const [count, returnRequests] = await Promise.all([
    prisma.orderReturn.count({
      where: {
        status: "REQUESTED",
        order: { supplierId },
      },
    }),
    prisma.orderReturn.findMany({
      where: {
        status: "REQUESTED",
        order: { supplierId },
      },
      select: {
        order: {
          select: {
            product: { select: { name: true } },
            variantLabel: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 1,
    }),
  ])

  const first = returnRequests[0]
  const preview = first
    ? `${first.order.product.name}${first.order.variantLabel ? ` · ${first.order.variantLabel}` : ""}`
    : null

  return { count, preview }
}

async function countLowStock(supplierId: string): Promise<number> {
  const [simpleLow, variantLow] = await Promise.all([
    prisma.product.count({
      where: {
        supplierId,
        active: true,
        isDraft: false,
        hasVariants: false,
        stock: { lte: LOW_STOCK_THRESHOLD },
      },
    }),
    prisma.productVariant.count({
      where: {
        stock: { lte: LOW_STOCK_THRESHOLD },
        product: { supplierId, active: true, isDraft: false, hasVariants: true },
      },
    }),
  ])
  return simpleLow + variantLow
}

export async function loadSupplierUrgentSnapshot(supplierId: string): Promise<SupplierUrgentSnapshot> {
  const [shipSla, lowStockLines, lowStockCount, clientMessages] = await Promise.all([
    loadOrdersToShipSla(supplierId),
    loadLowStockLines(supplierId),
    countLowStock(supplierId),
    loadClientMessages(supplierId),
  ])
  const clientMessagesCount = clientMessages.count

  return {
    ordersToShip: shipSla.count,
    ordersToShipSlaMs: shipSla.msUntilBreach,
    ordersToShipPenaltyCents: shipSla.penaltyCents,
    lowStockCount,
    lowStockLines,
    lowStockDailyLossCents: lowStockCount * 600 * 100,
    clientMessagesCount,
    shopRatingImpactPct: clientMessagesCount * SHOP_RATING_PENALTY_PCT_PER_MESSAGE,
    firstClientMessagePreview: clientMessages.preview,
  }
}

/** Returns still in progress (not shown in the 3-col grid but kept for metrics). */
export async function countReturnsInProgress(supplierId: string): Promise<number> {
  return prisma.orderReturn.count({
    where: {
      order: { supplierId },
      status: { notIn: [...TERMINAL_RETURN_STATUSES] },
    },
  })
}
