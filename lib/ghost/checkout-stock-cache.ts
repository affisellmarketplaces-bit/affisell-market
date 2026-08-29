import type { Prisma } from "@prisma/client"

import type { StockResult } from "@/lib/ghost/types"
import {
  GHOST_CHECKOUT_CACHE_MS,
  GHOST_CHECKOUT_OOS_CACHE_MS,
} from "@/lib/ghost/types"

type GhostProductRow = {
  basePriceCents: number
  lastStockCheck?: Date | null
  lastStockStatus?: string | null
  lastPriceSupplier?: Prisma.Decimal | number | null
}

function supplierPriceEur(
  lastPriceSupplier: Prisma.Decimal | number | null | undefined,
  basePriceCents: number
): number {
  if (typeof lastPriceSupplier === "number" && Number.isFinite(lastPriceSupplier) && lastPriceSupplier > 0) {
    return lastPriceSupplier
  }
  if (
    lastPriceSupplier &&
    typeof lastPriceSupplier === "object" &&
    "toNumber" in lastPriceSupplier
  ) {
    const n = Number(lastPriceSupplier.toNumber())
    if (Number.isFinite(n) && n > 0) return n
  }
  if (basePriceCents > 0) return basePriceCents / 100
  return 0.01
}

/** Skip live supplier probe when a recent check is still trustworthy at checkout. */
export function tryCheckoutStockCache(product: GhostProductRow): StockResult | null {
  const checkedAt = product.lastStockCheck
  const status = product.lastStockStatus?.trim()
  if (!checkedAt || !status) return null

  const ageMs = Date.now() - checkedAt.getTime()
  if (ageMs < 0) return null

  const price = supplierPriceEur(product.lastPriceSupplier, product.basePriceCents)

  if (status === "in_stock" && ageMs <= GHOST_CHECKOUT_CACHE_MS) {
    return {
      status: "in_stock",
      price,
      checkedAt,
      source: "cache:checkout_in_stock",
    }
  }

  if (status === "low_stock" && ageMs <= GHOST_CHECKOUT_CACHE_MS) {
    return {
      status: "low_stock",
      price,
      checkedAt,
      source: "cache:checkout_low_stock",
    }
  }

  if (status === "out_of_stock" && ageMs <= GHOST_CHECKOUT_OOS_CACHE_MS) {
    return {
      status: "out_of_stock",
      price,
      checkedAt,
      source: "cache:checkout_out_of_stock",
    }
  }

  return null
}
