import "server-only"

import { prisma } from "@/lib/prisma"
import { loadOrderCohort } from "@/lib/strategic-intelligence/cohort.server"
import { computeSupplierReliability, type SupplierReliability } from "@/lib/strategic-intelligence/supplier-reliability"

export type SupplierReliabilityResult =
  | { ok: true; window: { from: string; to: string }; suppliers: SupplierReliability[] }
  | { ok: false; error: "echantillon_tronque" | "lecture_impossible" }

/** READ-ONLY. Internal index — the page that shows it is ADMIN-only; nothing is published. */
export async function loadSupplierReliability(now = new Date()): Promise<SupplierReliabilityResult> {
  try {
    const [{ from, to, orders }, stats] = await Promise.all([
      loadOrderCohort(now),
      prisma.supplierDeliveryStats.findMany({ take: 5_000, select: { supplierId: true, p90EndToEndDays: true, sampleSize: true } }),
    ])
    const ids = [...new Set([...orders.map((o) => o.supplierId), ...stats.map((s) => s.supplierId)])]
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, store: { select: { name: true } } } })
    const suppliers = computeSupplierReliability({
      cohort: orders,
      delivery: new Map(stats.map((s) => [s.supplierId, { p90Days: s.p90EndToEndDays, sampleSize: s.sampleSize }])),
      names: new Map(users.map((u) => [u.id, u.store?.name?.trim() || u.name?.trim() || "Fournisseur"])),
    })
    return { ok: true, window: { from: from.toISOString(), to: to.toISOString() }, suppliers }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message === "echantillon_tronque" ? "echantillon_tronque" : "lecture_impossible" }
  }
}
