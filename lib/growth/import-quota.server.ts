import "server-only"

import { prisma } from "@/lib/prisma"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Generous technical ceilings (not the literal marketing number) — protect infra, not revenue. */
export const IMPORT_QUOTA_DEFAULT_PER_WEEK = 50
export const IMPORT_QUOTA_LANCEUR_PER_WEEK = 2000

/**
 * Emergency pause for the Growth import weekly quota (default ON / enforced).
 * Set `GROWTH_IMPORT_QUOTA_PAUSED=1` to disable in prod without a redeploy if it misfires.
 */
export function isImportQuotaPaused(): boolean {
  const raw = process.env.GROWTH_IMPORT_QUOTA_PAUSED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function importQuotaCapForPlan(growthPlan: string | null | undefined): number {
  return growthPlan === "lanceur" ? IMPORT_QUOTA_LANCEUR_PER_WEEK : IMPORT_QUOTA_DEFAULT_PER_WEEK
}

export type ImportQuotaCheck =
  | { allowed: true }
  | { allowed: false; cap: number; usedThisWeek: number }

/**
 * Pre-check against ImportJob.importedCount (Phase 0 column), summed over the trailing 7 days
 * via the existing @@index([userId, createdAt]) — cheap, no new index needed.
 */
export async function assertImportQuotaAllowed(
  userId: string,
  growthPlan: string | null | undefined
): Promise<ImportQuotaCheck> {
  if (isImportQuotaPaused()) return { allowed: true }

  const cap = importQuotaCapForPlan(growthPlan)
  const startOfWindow = new Date(Date.now() - WEEK_MS)
  const agg = await prisma.importJob.aggregate({
    _sum: { importedCount: true },
    where: { userId, createdAt: { gte: startOfWindow } },
  })
  const usedThisWeek = agg._sum.importedCount ?? 0

  if (usedThisWeek >= cap) return { allowed: false, cap, usedThisWeek }
  return { allowed: true }
}
