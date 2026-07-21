import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { recalculateAllSupplierDeliveryTrust } from "@/lib/logistics/supplier-metrics.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Recalculate delivery trust scores (MVP: manual / cron Bearer).
 * GET /api/cron/update-supplier-scores
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  try {
    const { updated, lowScore } = await recalculateAllSupplierDeliveryTrust(500)

    // Soft alert via in-app notification (email later)
    for (const row of lowScore.slice(0, 40)) {
      try {
        await prisma.notification.create({
          data: {
            userId: row.supplierId,
            type: "TRUST_SCORE_LOW",
            message: `Ton score est bas (${row.trustScore}/100) — Améliore tes délais pour rester visible`,
          },
        })
      } catch {
        // idempotent soft-fail
      }
    }

    console.log("[cron/update-supplier-scores]", {
      updated,
      lowScore: lowScore.length,
      result: "ok",
    })

    return Response.json({
      ok: true,
      updated,
      lowScoreNotified: Math.min(lowScore.length, 40),
      lowScore: lowScore.slice(0, 10),
    })
  } catch (err) {
    console.error("[cron/update-supplier-scores]", {
      error: err instanceof Error ? err.message : "unknown",
    })
    return Response.json({ ok: false, error: "failed" }, { status: 500 })
  }
}
