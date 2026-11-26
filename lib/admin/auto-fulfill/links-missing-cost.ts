import { prisma } from "@/lib/prisma"

/**
 * READ-ONLY preflight for the margin gate: the active, auto-buy-enabled AliExpress links whose cost the gate will treat as
 * UNKNOWN (and therefore refuse) — a price or a shipping amount of 0 / absent. `SupplierLink.aeShippingCents` is
 * `NOT NULL DEFAULT 0` and every importer writes 0, so a stored 0 means "never entered". Fix each link by entering the real (or
 * a deliberately conservative) amount, BEFORE enabling any autonomous purchase.
 *
 * Writes nothing.
 */
export type LinkMissingCost = {
  supplierLinkId: string
  productId: string
  productName: string | null
  aeProductId: string
  aePriceCents: number
  aeShippingCents: number
  /** Which part of the cost the gate will read as unknown. */
  missing: Array<"price" | "shipping" | "variant_price">
}

export async function listLinksMissingCost(limit = 500): Promise<{ total: number; links: LinkMissingCost[] }> {
  const where = {
    isActive: true,
    autoBuyEnabled: true,
    OR: [
      { aeShippingCents: { lte: 0 } },
      { aePriceCents: { lte: 0 } },
      { variantMappings: { some: { aePriceCents: { lte: 0 } } } },
    ],
  }
  const [total, rows] = await Promise.all([
    prisma.supplierLink.count({ where }),
    prisma.supplierLink.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(1, Math.floor(limit)), 1000),
      select: {
        id: true,
        productId: true,
        aeProductId: true,
        aePriceCents: true,
        aeShippingCents: true,
        product: { select: { name: true } },
        variantMappings: { where: { aePriceCents: { lte: 0 } }, select: { id: true }, take: 1 },
      },
    }),
  ])

  return {
    total,
    links: rows.map((r) => ({
      supplierLinkId: r.id,
      productId: r.productId,
      productName: r.product?.name ?? null,
      aeProductId: r.aeProductId,
      aePriceCents: r.aePriceCents,
      aeShippingCents: r.aeShippingCents,
      missing: [
        ...(r.aePriceCents <= 0 ? (["price"] as const) : []),
        ...(r.aeShippingCents <= 0 ? (["shipping"] as const) : []),
        ...(r.variantMappings.length > 0 ? (["variant_price"] as const) : []),
      ],
    })),
  }
}
