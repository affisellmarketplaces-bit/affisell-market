/** Immersive storefront layout — client-safe (no Prisma). */

import type { StorefrontLayoutMode } from "@/lib/storefront-theme-shared"

export const STOREFRONT_IMMERSIVE_ROOT_CLASS = "affisell-storefront-immersive"
export const STOREFRONT_IMMERSIVE_HERO_CLASS = "affisell-storefront-immersive-hero"
export const STOREFRONT_IMMERSIVE_CARD_CLASS = "affisell-storefront-immersive-card"
export const STOREFRONT_PDP_IMMERSIVE_CLASS = "affisell-storefront-pdp-immersive"

export function isStorefrontImmersiveLayout(
  layout: StorefrontLayoutMode | undefined | null
): boolean {
  return layout === "immersive"
}
