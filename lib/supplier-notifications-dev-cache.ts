/** Short-lived dev cache for supplier notifications GET — cuts duplicate Neon hits on reload. */
export const SUPPLIER_NOTIFICATIONS_DEV_CACHE_MS = 12_000

type CachedPayload = {
  body: Record<string, unknown>
  expiresAt: number
}

const cacheBySupplier = new Map<string, CachedPayload>()

export function readSupplierNotificationsDevCache(
  supplierId: string
): Record<string, unknown> | null {
  if (process.env.NODE_ENV !== "development") return null
  const hit = cacheBySupplier.get(supplierId)
  if (!hit || hit.expiresAt <= Date.now()) {
    if (hit) cacheBySupplier.delete(supplierId)
    return null
  }
  return hit.body
}

export function writeSupplierNotificationsDevCache(
  supplierId: string,
  body: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "development") return
  cacheBySupplier.set(supplierId, {
    body,
    expiresAt: Date.now() + SUPPLIER_NOTIFICATIONS_DEV_CACHE_MS,
  })
}

export function invalidateSupplierNotificationsDevCache(supplierId: string): void {
  cacheBySupplier.delete(supplierId)
}

/** @internal tests */
export function resetSupplierNotificationsDevCacheForTests(): void {
  cacheBySupplier.clear()
}
