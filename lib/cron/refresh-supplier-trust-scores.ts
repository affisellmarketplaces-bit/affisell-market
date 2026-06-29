import { calculateTrustScore } from "@/lib/trust-score"
import { prisma } from "@/lib/prisma"

export type RefreshSupplierTrustScoresResult = {
  scanned: number
  updated: number
  errors: number
  at: string
}

/**
 * Daily refresh of `SupplierProfile.trustScore` for Lightning Payout eligibility.
 */
export async function runRefreshSupplierTrustScoresCron(): Promise<RefreshSupplierTrustScoresResult> {
  const now = new Date()
  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: { id: true },
    orderBy: { id: "asc" },
  })

  let updated = 0
  let errors = 0

  for (const supplier of suppliers) {
    try {
      const score = await calculateTrustScore(supplier.id)
      await prisma.supplierProfile.upsert({
        where: { userId: supplier.id },
        create: {
          userId: supplier.id,
          trustScore: score,
          lightningEnabled: false,
        },
        update: { trustScore: score },
      })
      updated += 1
      console.log("[cron/refresh-supplier-trust-scores]", {
        supplierId: supplier.id,
        trustScore: score,
      })
    } catch (error) {
      errors += 1
      console.log("[cron/refresh-supplier-trust-scores]", {
        supplierId: supplier.id,
        result: "error",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    scanned: suppliers.length,
    updated,
    errors,
    at: now.toISOString(),
  }
}
