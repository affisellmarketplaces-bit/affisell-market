import "server-only"

import { prisma } from "@/lib/prisma"

/** Idempotent: mark overdue active boosts as expired. Returns rows updated. */
export async function expireLegionBoosts(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ expire_boosts: number }>>`
      SELECT expire_boosts() AS expire_boosts
    `
    const n = Number(rows[0]?.expire_boosts ?? 0)
    console.log("[legion-boost]", { result: "expire_rpc", expired: n })
    return n
  } catch (err) {
    // Fallback if SQL function missing (local / partial migrate)
    const result = await prisma.legionBoost.updateMany({
      where: { status: "active", endsAt: { lte: new Date() } },
      data: { status: "expired" },
    })
    console.log("[legion-boost]", {
      result: "expire_fallback",
      expired: result.count,
      err: err instanceof Error ? err.message : String(err),
    })
    return result.count
  }
}
