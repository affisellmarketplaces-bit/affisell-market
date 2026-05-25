/** Buyer-facing compare-at / discount math (no Prisma). */

export type ProductDiscountOffer = {
  price: number
  compareAt: number
  percent: number
  savingsAmount: number
}

export function resolveProductDiscount(
  price: number,
  compareAt?: number | string | null
): ProductDiscountOffer | null {
  const p = Number(price)
  const c = compareAt == null || compareAt === "" ? NaN : Number(compareAt)
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(c) || c <= p) return null
  const percent = Math.max(1, Math.min(99, Math.round(((c - p) / c) * 100)))
  const savingsAmount = Math.round((c - p) * 100) / 100
  return { price: p, compareAt: c, percent, savingsAmount }
}

export function hasProductDiscount(price: number, compareAt?: number | string | null): boolean {
  return resolveProductDiscount(price, compareAt) != null
}
