import "server-only"

import type { MarginLock } from "@prisma/client"

import {
  getMarginLockStatus,
  MARGIN_LOCK_DAYS,
  MARGIN_LOCK_MAX_INCREASE,
  type MarginLockDto,
  type MarginLockStatusCode,
} from "@/lib/margin/margin-lock-types"
import { prisma } from "@/lib/prisma"

export {
  getMarginLockStatus,
  MARGIN_LOCK_DAYS,
  MARGIN_LOCK_MAX_INCREASE,
} from "@/lib/margin/margin-lock-types"

function productCostEuro(basePriceCents: number): number {
  return Math.round((basePriceCents / 100) * 100) / 100
}

export function toMarginLockDto(
  lock: MarginLock & {
    product?: { name?: string; images?: string[] } | null
  }
): MarginLockDto {
  return {
    id: lock.id,
    productId: lock.productId,
    resellerId: lock.resellerId,
    lockedCost: lock.lockedCost,
    currentCost: lock.currentCost,
    salePrice: lock.salePrice,
    expiresAt: lock.expiresAt.toISOString(),
    status: lock.status as MarginLockStatusCode,
    createdAt: lock.createdAt.toISOString(),
    productTitle: lock.product?.name ?? null,
    productImage: lock.product?.images?.[0] ?? null,
  }
}

export async function createMarginLock(args: {
  productId: string
  resellerId: string
  salePrice: number
}): Promise<MarginLock> {
  const productId = args.productId.trim()
  const resellerId = args.resellerId.trim()
  const salePrice = Number(args.salePrice)

  if (!productId || !resellerId) {
    throw new Error("product_or_reseller_required")
  }
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error("invalid_sale_price")
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, active: true },
    select: { id: true, basePriceCents: true },
  })
  if (!product) {
    throw new Error("product_not_found")
  }

  const existing = await prisma.marginLock.findFirst({
    where: {
      productId,
      resellerId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
  })
  if (existing) {
    console.log("[margin-lock]", { result: "reuse", lockId: existing.id, productId, resellerId })
    return existing
  }

  const cost = productCostEuro(product.basePriceCents)
  const expiresAt = new Date(Date.now() + MARGIN_LOCK_DAYS * 24 * 60 * 60 * 1000)

  const lock = await prisma.marginLock.create({
    data: {
      productId,
      resellerId,
      lockedCost: cost,
      currentCost: cost,
      salePrice,
      expiresAt,
      status: "ACTIVE",
    },
  })

  console.log("[margin-lock]", {
    result: "created",
    lockId: lock.id,
    productId,
    resellerId,
    lockedCost: cost,
    salePrice,
    expiresAt: expiresAt.toISOString(),
  })

  return lock
}

export async function getActiveMarginLockForProduct(args: {
  productId: string
  resellerId: string
}): Promise<MarginLock | null> {
  return prisma.marginLock.findFirst({
    where: {
      productId: args.productId,
      resellerId: args.resellerId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  })
}

export async function listActiveMarginLocksForReseller(resellerId: string) {
  return prisma.marginLock.findMany({
    where: {
      resellerId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
    },
    include: {
      product: { select: { id: true, name: true, images: true, basePriceCents: true } },
    },
    orderBy: { expiresAt: "asc" },
  })
}

/**
 * Daily cron: expire locks + break if supplier cost rose >15%.
 * Idempotent — safe to re-run.
 */
export async function checkMarginLocks(limit = 200): Promise<{
  expired: number
  broken: number
  refreshed: number
  notified: number
}> {
  const now = new Date()
  let expired = 0
  let broken = 0
  let refreshed = 0
  let notified = 0

  const expireResult = await prisma.marginLock.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  })
  expired = expireResult.count

  const active = await prisma.marginLock.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now } },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { id: true, basePriceCents: true, name: true } },
    },
  })

  for (const lock of active) {
    const current = productCostEuro(lock.product.basePriceCents)
    const threshold = lock.lockedCost * (1 + MARGIN_LOCK_MAX_INCREASE)

    if (current > threshold + 1e-9) {
      await prisma.marginLock.update({
        where: { id: lock.id },
        data: { status: "BROKEN", currentCost: current },
      })
      broken += 1
      try {
        await prisma.notification.create({
          data: {
            userId: lock.resellerId,
            type: "MARGIN_LOCK_BROKEN",
            message: `Fournisseur a augmenté >15% sur « ${lock.product.name.slice(0, 60)} » — lock cassé. Compense Affisell: -5% frais prochain listing.`,
          },
        })
        notified += 1
      } catch {
        /* soft-fail notification */
      }
      console.log("[margin-lock]", {
        result: "broken",
        lockId: lock.id,
        lockedCost: lock.lockedCost,
        currentCost: current,
      })
      continue
    }

    if (Math.abs(current - lock.currentCost) > 0.001) {
      await prisma.marginLock.update({
        where: { id: lock.id },
        data: { currentCost: current },
      })
      refreshed += 1
    }
  }

  console.log("[margin-lock]", { result: "cron", expired, broken, refreshed, notified })
  return { expired, broken, refreshed, notified }
}
