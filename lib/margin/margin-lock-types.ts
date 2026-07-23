/** Client-safe Margin Lock DTOs (no Prisma imports). */

export const MARGIN_LOCK_DAYS = 7
/** Supplier cost increase above this ratio breaks the lock. */
export const MARGIN_LOCK_MAX_INCREASE = 0.15

export type MarginLockStatusCode = "ACTIVE" | "EXPIRED" | "USED" | "BROKEN"

export type MarginLockDto = {
  id: string
  productId: string
  resellerId: string
  lockedCost: number
  currentCost: number
  salePrice: number
  expiresAt: string
  status: MarginLockStatusCode
  createdAt: string
  productTitle?: string | null
  productImage?: string | null
}

export type MarginLockLiveStatus = {
  isActive: boolean
  daysLeft: number
  hoursLeft: number
  hoursInDay: number
  isExpiringSoon: boolean
  profitProtected: number
  status: MarginLockStatusCode
}

export function getMarginLockStatus(lock: {
  status: string
  expiresAt: Date | string
  salePrice: number
  lockedCost: number
}): MarginLockLiveStatus {
  const expiresAt =
    typeof lock.expiresAt === "string" ? new Date(lock.expiresAt) : lock.expiresAt
  const now = Date.now()
  const msLeft = expiresAt.getTime() - now
  const hoursLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60)))
  const daysLeft = Math.floor(hoursLeft / 24)
  const hoursInDay = hoursLeft % 24
  const status = (lock.status as MarginLockStatusCode) || "ACTIVE"
  const isActive = status === "ACTIVE" && expiresAt.getTime() > now

  return {
    isActive,
    daysLeft,
    hoursLeft,
    hoursInDay,
    isExpiringSoon: isActive && hoursLeft < 24,
    profitProtected: Math.round((lock.salePrice - lock.lockedCost) * 100) / 100,
    status,
  }
}
