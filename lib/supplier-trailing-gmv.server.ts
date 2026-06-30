import { prisma } from "@/lib/prisma"
import { SUPPLIER_VOLUME_LOOKBACK_DAYS } from "@/lib/commission-grid-dynamic"

const MARKETPLACE_COUNTABLE = ["paid", "preparing", "shipped", "refunded"] as const

/** Wholesale GMV (supplier price) over the trailing window — used for volume commission tiers. */
export async function loadSupplierTrailingGmvCents(
  supplierId: string,
  lookbackDays = SUPPLIER_VOLUME_LOOKBACK_DAYS
): Promise<number> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - lookbackDays)

  const rows = await prisma.order.findMany({
    where: {
      supplierId,
      status: { in: [...MARKETPLACE_COUNTABLE] },
      createdAt: { gte: since },
    },
    select: { supplierPriceCents: true, basePriceCents: true },
  })

  return rows.reduce(
    (sum, row) => sum + Math.max(0, row.supplierPriceCents ?? row.basePriceCents ?? 0),
    0
  )
}
