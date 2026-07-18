import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { isRadarEnabled, isRedisConfigured } from "@/lib/radar/gate"
import { getRadarDb } from "@/lib/prisma-radar"

import RadarConnectClient from "./connect-client"

export default async function RadarConnectPage() {
  if (isRadarEnabled() && !isRedisConfigured()) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-semibold">Redis not configured</p>
        <p className="mt-2 text-amber-900">
          `REDIS_URL` est obligatoire quand `RADAR_ENABLED=true` (state OAuth partagé entre
          instances). Ajoute-le dans Vercel Env puis redéploie.
        </p>
      </div>
    )
  }

  let tiktokShops: Array<{
    shopId: string
    shopName: string
    status: string
    expiresAt: string | null
  }> = []

  const session = await auth()
  if (session?.user?.id && resolveRadarDatabaseUrl()) {
    try {
      const rows = await getRadarDb().shopConnection.findMany({
        where: { userId: session.user.id, connectorId: "tiktok_shop" },
        orderBy: { updatedAt: "desc" },
        select: { shopId: true, shopName: true, status: true, expiresAt: true },
      })
      tiktokShops = rows.map((r) => ({
        shopId: r.shopId,
        shopName: r.shopName,
        status: r.status,
        expiresAt: r.expiresAt?.toISOString() ?? null,
      }))
    } catch (err) {
      console.warn("[radar/connect]", {
        result: "shops_load_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Chargement…
        </div>
      }
    >
      <RadarConnectClient tiktokShops={tiktokShops} />
    </Suspense>
  )
}
