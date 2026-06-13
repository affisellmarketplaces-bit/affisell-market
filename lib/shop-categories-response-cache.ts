import { loadAffiliateShopCategoryGroupsForSlug } from "@/lib/shop-storefront-data"
import {
  totalProductsInCategoryGroups,
  type StorefrontCategoryGroup,
} from "@/lib/shop-storefront-categories"

const TTL_MS = 60_000
const MAX_ENTRIES = 48

type CacheEntry = {
  expiresAt: number
  groups: StorefrontCategoryGroup[]
  totalProducts: number
}

const memory = new Map<string, CacheEntry>()

function prune(now: number) {
  if (memory.size <= MAX_ENTRIES) return
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key)
    if (memory.size <= MAX_ENTRIES * 0.75) break
  }
}

/** Short TTL cache — drawer categories hit the same slug repeatedly in dev. */
export async function loadShopCategoriesResponse(slug: string): Promise<{
  groups: StorefrontCategoryGroup[]
  totalProducts: number
}> {
  const key = slug.trim().toLowerCase()
  if (!key) return { groups: [], totalProducts: 0 }

  const now = Date.now()
  const hit = memory.get(key)
  if (hit && hit.expiresAt > now) {
    return { groups: hit.groups, totalProducts: hit.totalProducts }
  }

  const groups = await loadAffiliateShopCategoryGroupsForSlug(slug)
  const totalProducts = totalProductsInCategoryGroups(groups)
  memory.set(key, { expiresAt: now + TTL_MS, groups, totalProducts })
  prune(now)
  return { groups, totalProducts }
}

/** Test helper */
export function clearShopCategoriesResponseCacheForTests() {
  memory.clear()
}
