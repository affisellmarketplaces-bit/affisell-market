import { Suspense } from "react"

import { isRadarEnabled, isRedisConfigured } from "@/lib/radar/gate"

import RadarConnectClient from "./connect-client"

export default function RadarConnectPage() {
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

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          Chargement…
        </div>
      }
    >
      <RadarConnectClient />
    </Suspense>
  )
}
