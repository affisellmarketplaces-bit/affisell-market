import "server-only"

import { loadSupplierShopShippingOffersMap } from "@/lib/shipping/supplier-shipping-profile.server"

type WindowCard = {
  supplierId?: string
  deliveryMin: number | null
  deliveryMax: number | null
}

/**
 * Cards may only state a delivery window the supplier defined in their shop shipping profile.
 * One batched query per call; cards without a profile get `null` (nothing displayed).
 * Idempotent: `supplierId` is consumed so a second pass is a no-op.
 */
export async function applyShopDeliveryWindows<T extends WindowCard>(cards: T[]): Promise<T[]> {
  const pending = cards.filter((c) => c.supplierId)
  if (pending.length === 0) return cards
  const map = await loadSupplierShopShippingOffersMap(pending.map((c) => c.supplierId as string))
  return cards.map((card) => {
    if (!card.supplierId) return card
    const offers = map.get(card.supplierId) ?? []
    const { supplierId: _consumed, ...rest } = card
    return {
      ...rest,
      deliveryMin: offers.length ? Math.min(...offers.map((o) => o.deliveryMin)) : null,
      deliveryMax: offers.length ? Math.max(...offers.map((o) => o.deliveryMax)) : null,
    } as unknown as T
  })
}
