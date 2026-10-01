import "server-only"

import { prisma } from "@/lib/prisma"

/** Non-Dominator/Empire suppliers are capped at this many live products going forward. */
export const DEFAULT_CATALOG_CAP = 200

/**
 * Emergency pause for the Growth catalog cap (default ON / enforced).
 * Set `GROWTH_CATALOG_CAP_PAUSED=1` to disable in prod without a redeploy if it misfires.
 */
export function isCatalogCapPaused(): boolean {
  const raw = process.env.GROWTH_CATALOG_CAP_PAUSED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export type CatalogCapCheck =
  | { allowed: true }
  | { allowed: false; cap: number; current: number }

/**
 * Grandfathered cap: effective cap is max(DEFAULT_CATALOG_CAP, the supplier's live product
 * count when the cap launched) — never reduces an existing seller's capacity below what they
 * already had, only stops *further* growth past the default once they're above it.
 */
export async function assertProductCreationAllowed(supplierId: string): Promise<CatalogCapCheck> {
  if (isCatalogCapPaused()) return { allowed: true }

  const user = await prisma.user.findUnique({
    where: { id: supplierId },
    select: { growthPlan: true, catalogCapBaselineCount: true },
  })
  if (user?.growthPlan === "dominator" || user?.growthPlan === "empire") {
    return { allowed: true }
  }

  const effectiveCap = Math.max(DEFAULT_CATALOG_CAP, user?.catalogCapBaselineCount ?? 0)
  const current = await prisma.product.count({ where: { supplierId, isDraft: false } })

  if (current < effectiveCap) return { allowed: true }
  return { allowed: false, cap: effectiveCap, current }
}
