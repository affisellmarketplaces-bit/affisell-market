import "server-only"

import { prisma } from "@/lib/prisma"
import type { MatureOrder } from "@/lib/strategic-intelligence/mature-orders.server"
import { computeSupplierReliability, type SupplierReliability } from "@/lib/strategic-intelligence/supplier-reliability"

export type SupplierReliabilityResult =
  | { ok: true; window: { from: string; to: string }; suppliers: SupplierReliability[] }
  | { ok: false; error: "echantillon_tronque" | "lecture_impossible" }

/**
 * READ-ONLY. Internal index computed from the cockpit's SHARED order read (mature-orders.server.ts) — the same orders
 * the quality detector and the economics judge. Only delivery stats and supplier names are read here.
 */
export async function buildSupplierReliability(orders: MatureOrder[], window: { from: Date; to: Date }): Promise<SupplierReliabilityResult> {
  try {
    const stats = await prisma.supplierDeliveryStats.findMany({ take: 5_000, select: { supplierId: true, p90EndToEndDays: true, sampleSize: true } })
    const ids = [...new Set([...orders.map((o) => o.supplierId), ...stats.map((s) => s.supplierId)])]
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, store: { select: { name: true } } } })
    const suppliers = computeSupplierReliability({
      cohort: orders,
      delivery: new Map(stats.map((s) => [s.supplierId, { p90Days: s.p90EndToEndDays, sampleSize: s.sampleSize }])),
      names: new Map(users.map((u) => [u.id, u.store?.name?.trim() || u.name?.trim() || "Fournisseur"])),
    })
    return { ok: true, window: { from: window.from.toISOString(), to: window.to.toISOString() }, suppliers }
  } catch {
    return { ok: false, error: "lecture_impossible" }
  }
}
