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

type CatalogCapStatus = { unlimited: true } | { unlimited: false; cap: number; current: number }

/**
 * Grandfathered cap: effective cap is max(DEFAULT_CATALOG_CAP, the supplier's live product
 * count when the cap launched) — never reduces an existing seller's capacity below what they
 * already had, only stops *further* growth past the default once they're above it.
 */
async function computeCatalogCapStatus(supplierId: string): Promise<CatalogCapStatus> {
  if (isCatalogCapPaused()) return { unlimited: true }

  const user = await prisma.user.findUnique({
    where: { id: supplierId },
    select: { growthPlan: true, catalogCapBaselineCount: true },
  })
  if (user?.growthPlan === "dominator" || user?.growthPlan === "empire") {
    return { unlimited: true }
  }

  const effectiveCap = Math.max(DEFAULT_CATALOG_CAP, user?.catalogCapBaselineCount ?? 0)
  const current = await prisma.product.count({ where: { supplierId, isDraft: false } })
  return { unlimited: false, cap: effectiveCap, current }
}

export async function assertProductCreationAllowed(supplierId: string): Promise<CatalogCapCheck> {
  const status = await computeCatalogCapStatus(supplierId)
  if (status.unlimited) return { allowed: true }
  if (status.current < status.cap) return { allowed: true }
  return { allowed: false, cap: status.cap, current: status.current }
}

/**
 * For batch creation flows (bulk/CSV import): how many more live products this supplier can
 * add right now. `null` means unlimited (Dominator/Empire, or the cap is paused) — callers
 * should not throttle rows in that case rather than treating null as zero.
 */
export async function remainingCatalogCapacity(supplierId: string): Promise<number | null> {
  const status = await computeCatalogCapStatus(supplierId)
  if (status.unlimited) return null
  return Math.max(0, status.cap - status.current)
}
