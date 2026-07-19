import { NextResponse } from "next/server"

import {
  GOOGLE_CONNECTORS,
  LIVE_CONNECTOR_IDS,
  MARKETPLACE_CONNECTORS,
  isConnectorLive,
} from "@/lib/radar/connectors/registry"
import { gate } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/radar/connectors — list marketplaces + live status (no secrets). */
export async function GET() {
  const blocked = gate()
  if (blocked) return blocked

  const connectors = [
    ...MARKETPLACE_CONNECTORS.map((c) => ({
      id: c.id,
      name: c.name,
      logo: c.logo,
      region: c.region,
      category: c.category,
      authType: c.authType,
      requiresAuth: c.requiresAuth !== false,
      countries: c.countries ?? [],
      status: isConnectorLive(c.id) ? ("live" as const) : ("stub" as const),
    })),
    ...GOOGLE_CONNECTORS.map((c) => ({
      id: c.id,
      name: c.name,
      logo: c.logo,
      region: c.region,
      category: c.category,
      authType: c.authType,
      requiresAuth: true,
      countries: [] as string[],
      status: isConnectorLive(c.id) ? ("live" as const) : ("stub" as const),
    })),
  ]

  const live = connectors.filter((c) => c.status === "live")

  console.log("[radar/connectors]", {
    result: "ok",
    total: connectors.length,
    live: live.map((c) => c.id),
  })

  return NextResponse.json({
    connectors,
    liveIds: Array.from(LIVE_CONNECTOR_IDS),
    liveCount: live.length,
  })
}
