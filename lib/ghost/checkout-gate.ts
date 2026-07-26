import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { checkStock } from "@/lib/ghost/check-stock"
import {
  calculateGhostSellPriceEur,
  isGhostPriceDriftCritical,
} from "@/lib/ghost/price-sync"
import { getSimilarInStockProducts } from "@/lib/ghost/similar-products"
import { GHOST_STOCK15_COUPON, type StockResult } from "@/lib/ghost/types"
import { prisma } from "@/lib/prisma"

type GhostProductRow = {
  id: string
  name: string
  supplierUrl: string | null
  supplierSource: string | null
  supplierProductId: string | null
  sourceUrl: string | null
  importSource: string | null
  aliexpressProductId: string | null
  lastPriceSupplier: Prisma.Decimal | null
  basePriceCents: number
  stock: number
}

/**
 * Pre-Stripe Ghost gate. Returns NextResponse on hard block, or StockResult.
 */
export async function assertGhostStockForCheckout(
  product: GhostProductRow
): Promise<NextResponse | { stock: StockResult; warning?: string }> {
  const stock = await checkStock(product)

  if (stock.status === "out_of_stock") {
    const alternatives = await getSimilarInStockProducts(product.id, 3)
    console.log("[ghost-checkout]", {
      productId: product.id,
      result: "OUT_OF_STOCK_VERIFIED",
      alternatives: alternatives.length,
    })
    return NextResponse.json(
      {
        error: "OUT_OF_STOCK_VERIFIED",
        message: "Rupture vérifiée à l’instant chez le fournisseur",
        productName: product.name,
        alternatives,
        coupon: GHOST_STOCK15_COUPON,
        checkedAt: stock.checkedAt.toISOString(),
        source: stock.source,
      },
      { status: 409 }
    )
  }

  if (
    stock.price > 0 &&
    isGhostPriceDriftCritical(
      product.lastPriceSupplier ? Number(product.lastPriceSupplier) : product.basePriceCents / 100,
      stock.price
    )
  ) {
    const newBase = Math.round(calculateGhostSellPriceEur(stock.price, product.supplierSource) * 100)
    await prisma.product.update({
      where: { id: product.id },
      data: {
        basePriceCents: Math.max(1, newBase),
        lastPriceSupplier: new Prisma.Decimal(stock.price.toFixed(2)),
      },
    })
    console.log("[ghost-checkout]", {
      productId: product.id,
      result: "price_drift_adjusted",
      supplierPrice: stock.price,
      newBaseCents: newBase,
    })
  }

  if (stock.status === "low_stock") {
    return {
      stock,
      warning: "Stock fournisseur faible — délai de livraison potentiellement plus long.",
    }
  }

  return { stock }
}
