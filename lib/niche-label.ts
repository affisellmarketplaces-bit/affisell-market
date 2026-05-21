import type { NicheKey } from "@/lib/shop-storefront-data"

/** Keys passed to `discovery.niches.*` in messages. */
export type NicheFilterKey = "all" | NicheKey

export const NICHE_FILTER_KEYS: readonly NicheFilterKey[] = [
  "all",
  "beauty",
  "fitness",
  "tech",
  "home",
  "lifestyle",
] as const

export function isNicheKey(value: string): value is NicheKey {
  return value === "beauty" || value === "fitness" || value === "tech" || value === "home" || value === "lifestyle"
}
