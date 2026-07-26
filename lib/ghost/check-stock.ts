import { Prisma } from "@prisma/client"

import {
  aliexpressCheck,
  amazonCheck,
  detectGhostSupplierSource,
  temuCheck,
} from "@/lib/ghost/supplier-adapters"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { prisma } from "@/lib/prisma"
import {
  GHOST_CHECK_TIMEOUT_MS,
  GHOST_FAILS_BEFORE_DRAFT,
  type StockResult,
} from "@/lib/ghost/types"

export type GhostProductInput = {
  id: string
  supplierUrl?: string | null
  supplierSource?: string | null
  supplierProductId?: string | null
  sourceUrl?: string | null
  importSource?: string | null
  aliexpressProductId?: string | null
  lastPriceSupplier?: Prisma.Decimal | number | null
  basePriceCents?: number
  stock?: number
  name?: string
}

function asEur(v: Prisma.Decimal | number | null | undefined, fallbackCents?: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v
  if (v && typeof v === "object" && "toNumber" in v) {
    const n = Number(v.toNumber())
    if (Number.isFinite(n) && n > 0) return n
  }
  if (typeof fallbackCents === "number" && fallbackCents > 0) return fallbackCents / 100
  return 0
}

function resolveSource(product: GhostProductInput) {
  const url = product.supplierUrl?.trim() || product.sourceUrl?.trim() || null
  const source =
    (product.supplierSource?.trim() as "aliexpress" | "temu" | "amazon" | undefined) ||
    detectGhostSupplierSource(url, product.importSource) ||
    (product.aliexpressProductId ? "aliexpress" : null)
  const supplierProductId =
    product.supplierProductId?.trim() || product.aliexpressProductId?.trim() || null
  return { url, source, supplierProductId }
}

async function probeSupplier(product: GhostProductInput): Promise<StockResult | null> {
  const { url, source, supplierProductId } = resolveSource(product)
  if (!source) return null

  const run = async (): Promise<StockResult | null> => {
    if (source === "aliexpress") {
      return aliexpressCheck({ supplierProductId, supplierUrl: url })
    }
    if (source === "temu") {
      return temuCheck({ supplierUrl: url })
    }
    if (source === "amazon") {
      return amazonCheck({ supplierUrl: url })
    }
    return null
  }

  try {
    return await Promise.race([
      run(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), GHOST_CHECK_TIMEOUT_MS + 200)
      ),
    ])
  } catch (e) {
    console.log("[ghost-stock]", {
      productId: product.id,
      result: "probe_error",
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

function fallbackInStock(product: GhostProductInput, reason: string): StockResult {
  const price = asEur(product.lastPriceSupplier, product.basePriceCents)
  return {
    status: "in_stock",
    price: price > 0 ? price : Math.max(0.01, (product.basePriceCents ?? 100) / 100),
    checkedAt: new Date(),
    source: `fallback:${reason}`,
  }
}

async function maybeAutoDraft(productId: string, fails: number): Promise<void> {
  if (fails < GHOST_FAILS_BEFORE_DRAFT) return
  await prisma.product.update({
    where: { id: productId },
    data: { isDraft: true, active: false },
  })
  console.log("[ghost-stock]", { productId, result: "auto_draft", fails })
  void opsWebhookAlert(
    `[Ghost] Produit ${productId} passé en draft après ${fails} échecs stock check`
  )
}

/**
 * Live supplier stock probe — never blocks sales on timeout/scrape failure (safe fallback).
 * Idempotent logging + product last* fields update.
 */
export async function checkStock(product: GhostProductInput): Promise<StockResult> {
  const start = Date.now()
  try {
    let result = await probeSupplier(product)

    if (!result) {
      console.warn("[ghost-stock]", {
        productId: product.id,
        result: "fallback_in_stock",
        reason: "timeout_or_no_adapter",
      })
      void opsWebhookAlert(
        `[Ghost] fallback in_stock (timeout/scrape) product=${product.id}`
      )
      result = fallbackInStock(product, "timeout_or_scrape")
    }

    // Local Affisell stock can still force OOS when we trust inventory
    if (
      typeof product.stock === "number" &&
      product.stock <= 0 &&
      result.status === "in_stock" &&
      result.source.startsWith("fallback")
    ) {
      // Keep fallback — Affisell vault stock is dropship-style often
    }

    const ms = Date.now() - start
    await prisma.stockCheckLog.create({
      data: {
        productId: product.id,
        status: result.status,
        supplierPrice: result.price > 0 ? result.price : null,
        responseTimeMs: ms,
        source: result.source,
      },
    })

    await prisma.product.update({
      where: { id: product.id },
      data: {
        lastStockCheck: result.checkedAt,
        lastStockStatus: result.status,
        ...(result.price > 0
          ? { lastPriceSupplier: new Prisma.Decimal(result.price.toFixed(2)) }
          : {}),
        stockCheckFails: 0,
        ...(resolveSource(product).url && !product.supplierUrl
          ? { supplierUrl: resolveSource(product).url }
          : {}),
        ...(resolveSource(product).source && !product.supplierSource
          ? { supplierSource: resolveSource(product).source }
          : {}),
        ...(resolveSource(product).supplierProductId && !product.supplierProductId
          ? { supplierProductId: resolveSource(product).supplierProductId }
          : {}),
      },
    })

    console.log("[ghost-stock]", {
      productId: product.id,
      status: result.status,
      source: result.source,
      ms,
      result: "ok",
    })
    return result
  } catch (e) {
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { stockCheckFails: { increment: 1 } },
      select: { stockCheckFails: true },
    })
    await maybeAutoDraft(product.id, updated.stockCheckFails)
    console.log("[ghost-stock]", {
      productId: product.id,
      result: "error",
      error: e instanceof Error ? e.message : String(e),
      fails: updated.stockCheckFails,
    })
    // Never throw to checkout — safe fallback
    return fallbackInStock(product, "exception")
  }
}
